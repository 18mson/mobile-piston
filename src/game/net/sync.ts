import { getCar } from '../data/cars';
import { stepRacer } from '../physics';
import { RaceSim, type RaceParticipant } from '../race';
import type {
  NetRacerState,
  PlayerInput,
  RaceSnapshot,
  Track,
  WorldSnapshot,
} from '../types';
import { shortestAngle } from '../utils';

const INTERP_DELAY_MS = 85;
const MAX_PENDING_INPUTS = 180;
const RECONCILE_THRESHOLD = 3.5;

interface PendingInput {
  seq: number;
  input: PlayerInput;
  dt: number;
}

interface BufferedSnapshot {
  receivedAt: number;
  snapshot: WorldSnapshot;
}

export class NetRaceSync {
  readonly sim: RaceSim;
  readonly localPlayerId: string;
  private pendingInputs: PendingInput[] = [];
  private snapshotBuffer: BufferedSnapshot[] = [];
  private latestSnapshot: WorldSnapshot | null = null;
  private nextSeq = 1;
  private errorOffsetX = 0;
  private errorOffsetY = 0;
  private errorOffsetAngle = 0;

  constructor(track: Track, participants: RaceParticipant[], localPlayerId: string) {
    this.localPlayerId = localPlayerId;
    this.sim = new RaceSim(track, participants[0]?.carId ?? 'sirip', {
      participants,
      localPlayerId,
      fillWithAi: false, // Server already provides the full 6-car participant list
    });
  }

  get currentMode(): 'countdown' | 'racing' | 'finished' {
    return this.latestSnapshot?.mode ?? 'countdown';
  }

  get currentCountdown(): number | null {
    return this.latestSnapshot ? this.latestSnapshot.countdown : 3;
  }

  /**
   * Records and locally predicts the local player's next fixed physics step.
   * Returns the sequence number assigned to this input.
   */
  predictLocal(input: PlayerInput, dt: number): number {
    const seq = this.nextSeq;
    this.nextSeq += 1;

    if (this.currentMode !== 'racing') {
      return seq;
    }

    this.pendingInputs.push({ seq, input, dt });
    if (this.pendingInputs.length > MAX_PENDING_INPUTS) {
      this.pendingInputs.shift();
    }

    const player = this.sim.player;
    player.prevX = player.x;
    player.prevY = player.y;
    player.prevAngle = player.angle;
    if (!player.finished) {
      const spec = getCar(player.carId);
      stepRacer(player, spec, this.sim.track, input, dt);
    }
    return seq;
  }

  /**
   * Ingests an authoritative snapshot from the server:
   * - Buffers it for smooth remote-entity interpolation
   * - Reconciles the local player's predicted state against server truth
   */
  applyServerSnapshot(snapshot: WorldSnapshot, receivedAt = Date.now()): void {
    if (this.latestSnapshot && snapshot.tick < this.latestSnapshot.tick) {
      return;
    }
    this.latestSnapshot = snapshot;
    this.sim.elapsed = snapshot.elapsed;
    this.sim.tick = snapshot.tick;

    const prevBuffered = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    const smoothReceivedAt =
      prevBuffered && snapshot.elapsed > prevBuffered.snapshot.elapsed
        ? Math.max(receivedAt, prevBuffered.receivedAt + 35)
        : receivedAt;
    this.snapshotBuffer.push({ receivedAt: smoothReceivedAt, snapshot });
    if (this.snapshotBuffer.length > 24) {
      this.snapshotBuffer.shift();
    }

    const ackSeq = snapshot.lastProcessedSeq[this.localPlayerId] ?? 0;
    this.pendingInputs = this.pendingInputs.filter((item) => item.seq > ackSeq);

    const serverLocal = snapshot.racers.find((r) => r.id === this.localPlayerId);
    if (!serverLocal) return;

    const player = this.sim.player;
    const oldX = player.x;
    const oldY = player.y;
    const oldVx = player.vx;
    const oldVy = player.vy;
    const oldAngle = player.angle;
    const oldYawRate = player.yawRate;
    const oldLongAccel = player.longAccel;
    const oldSteer = player.steer;
    const oldDrifting = player.drifting;
    const oldPrevX = player.prevX;
    const oldPrevY = player.prevY;
    const oldPrevAngle = player.prevAngle;
    const oldVisualX = player.x + this.errorOffsetX;
    const oldVisualY = player.y + this.errorOffsetY;
    const oldVisualAngle = player.angle + this.errorOffsetAngle;

    // Reset local player to authoritative server state
    this.copyNetToRacer(serverLocal, player);

    // Replay unacknowledged local inputs on top of server state
    if (snapshot.mode === 'racing' && !player.finished) {
      const spec = getCar(player.carId);
      for (const pending of this.pendingInputs) {
        stepRacer(player, spec, this.sim.track, pending.input, pending.dt);
      }
    }

    const dx = oldVisualX - player.x;
    const dy = oldVisualY - player.y;
    const err = Math.hypot(dx, dy);

    if (err <= RECONCILE_THRESHOLD) {
      // Within normal clock-phase tolerance: keep smooth local physics and gently nudge position
      const nudgeX = (player.x - oldX) * 0.04;
      const nudgeY = (player.y - oldY) * 0.04;
      player.x = oldX + nudgeX;
      player.y = oldY + nudgeY;
      player.vx = oldVx;
      player.vy = oldVy;
      player.angle = oldAngle;
      player.yawRate = oldYawRate;
      player.longAccel = oldLongAccel;
      player.steer = oldSteer;
      player.drifting = oldDrifting;
      player.prevX = (oldPrevX ?? oldX) + nudgeX;
      player.prevY = (oldPrevY ?? oldY) + nudgeY;
      player.prevAngle = oldPrevAngle ?? oldAngle;
      return;
    }

    // Maintain continuous prevX/prevY/prevAngle for sub-frame alpha interpolation
    player.prevX = player.x - player.vx * (1 / 120);
    player.prevY = player.y - player.vy * (1 / 120);
    player.prevAngle = player.angle - (player.yawRate ?? 0) * (1 / 120);

    // Absorb larger position/heading difference into visual offset so the car never pops
    if (err < 60) {
      this.errorOffsetX = dx;
      this.errorOffsetY = dy;
      this.errorOffsetAngle = shortestAngle(player.angle, oldVisualAngle);
    } else {
      this.errorOffsetX = 0;
      this.errorOffsetY = 0;
      this.errorOffsetAngle = 0;
    }
  }

  /**
   * Updates remote racers via snapshot interpolation and decays local visual error offset.
   */
  updateVisuals(dt: number, nowMs = Date.now()): void {
    const decay = Math.exp(-dt * 10);
    this.errorOffsetX *= decay;
    this.errorOffsetY *= decay;
    this.errorOffsetAngle *= decay;
    if (Math.abs(this.errorOffsetX) < 0.01) this.errorOffsetX = 0;
    if (Math.abs(this.errorOffsetY) < 0.01) this.errorOffsetY = 0;
    if (Math.abs(this.errorOffsetAngle) < 0.001) this.errorOffsetAngle = 0;

    if (this.snapshotBuffer.length === 0) return;

    const renderTime = nowMs - INTERP_DELAY_MS;

    // Find two snapshots bracketing renderTime
    let before: BufferedSnapshot | null = null;
    let after: BufferedSnapshot | null = null;
    for (let i = 0; i < this.snapshotBuffer.length; i += 1) {
      const entry = this.snapshotBuffer[i];
      if (entry.receivedAt <= renderTime) {
        before = entry;
      } else {
        after = entry;
        break;
      }
    }

    for (const racer of this.sim.racers) {
      if (racer.id === this.localPlayerId) continue;

      if (before && after) {
        const span = Math.max(1, after.receivedAt - before.receivedAt);
        const t = Math.max(0, Math.min(1, (renderTime - before.receivedAt) / span));
        const a = before.snapshot.racers.find((r) => r.id === racer.id);
        const b = after.snapshot.racers.find((r) => r.id === racer.id);
        if (a && b) {
          this.copyNetToRacer(b, racer);
          racer.x = a.x + (b.x - a.x) * t;
          racer.y = a.y + (b.y - a.y) * t;
          racer.angle = a.angle + shortestAngle(a.angle, b.angle) * t;
          racer.vx = a.vx + (b.vx - a.vx) * t;
          racer.vy = a.vy + (b.vy - a.vy) * t;
          racer.steer = a.steer + (b.steer - a.steer) * t;
          racer.prevX = racer.x;
          racer.prevY = racer.y;
          racer.prevAngle = racer.angle;
          continue;
        }
      }

      // Fallback: latest snapshot (with brief velocity extrapolation up to 80ms)
      const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
      const state = latest.snapshot.racers.find((r) => r.id === racer.id);
      if (state) {
        this.copyNetToRacer(state, racer);
        const ageSec = Math.min(0.08, Math.max(0, (renderTime - latest.receivedAt) / 1000));
        racer.x += state.vx * ageSec;
        racer.y += state.vy * ageSec;
        racer.prevX = racer.x;
        racer.prevY = racer.y;
        racer.prevAngle = racer.angle;
      }
    }
  }

  getRenderPlayer(): typeof this.sim.player {
    const p = this.sim.player;
    if (this.errorOffsetX === 0 && this.errorOffsetY === 0 && this.errorOffsetAngle === 0) return p;
    return {
      ...p,
      x: p.x + this.errorOffsetX,
      y: p.y + this.errorOffsetY,
      angle: p.angle + this.errorOffsetAngle,
      prevX: (p.prevX ?? p.x) + this.errorOffsetX,
      prevY: (p.prevY ?? p.y) + this.errorOffsetY,
      prevAngle: (p.prevAngle ?? p.angle) + this.errorOffsetAngle,
    };
  }

  toHudSnapshot(): RaceSnapshot {
    const mode = this.currentMode === 'countdown' ? 'countdown' : 'racing';
    return this.sim.snapshot(mode, this.currentCountdown);
  }

  private copyNetToRacer(src: NetRacerState, dst: typeof this.sim.player): void {
    dst.x = src.x;
    dst.y = src.y;
    dst.angle = src.angle;
    dst.vx = src.vx;
    dst.vy = src.vy;
    dst.steer = src.steer;
    dst.nitro = src.nitro;
    dst.nitroActive = src.nitroActive;
    dst.drifting = src.drifting;
    dst.impact = src.impact;
    dst.lap = src.lap;
    dst.s = src.s;
    dst.progress = src.progress;
    dst.startedLap = src.startedLap;
    dst.passedHalf = src.passedHalf;
    dst.finished = src.finished;
    dst.finishTime = src.finishTime;
    dst.wrongWay = src.wrongWay;
    dst.yawRate = src.yawRate;
    dst.longAccel = src.longAccel;
  }
}
