import { getCar } from '../data/cars';
import { stepRacer } from '../physics';
import { RaceSim, type RaceParticipant } from '../race';
import { nearestOnTrack } from '../track/geometry';
import type {
  NetRacerState,
  PlayerInput,
  RaceSnapshot,
  RacerState,
  SequencedInput,
  Track,
  WorldSnapshot,
} from '../types';
import { clamp, shortestAngle } from '../utils';

const INITIAL_INTERP_DELAY_MS = 110;
const MIN_INTERP_DELAY_MS = 95;
const MAX_INTERP_DELAY_MS = 220;
const MAX_EXTRAP_MS = 150;
const MAX_PENDING_INPUTS = 180;
const MAX_RECENT_INPUTS = 8;
const DEADZONE_POS = 0.5;
const DEADZONE_ANGLE = 0.01;
const TELEPORT_THRESHOLD = 60;

interface PendingInput {
  seq: number;
  input: PlayerInput;
  dt: number;
}

interface BufferedSnapshot {
  serverTimeMs: number;
  receivedAt: number;
  snapshot: WorldSnapshot;
}

export interface NetDebugStats {
  posError: number;
  angleError: number;
  avgPosError: number;
  avgAngleError: number;
  snapshotIntervalMs: number;
  avgSnapshotIntervalMs: number;
  starvationFrames: number;
  remoteJitterSpikes: number;
  maxRemoteJitterRatio: number;
  interpDelayMs: number;
  rttMs: number | null;
  pendingInputs: number;
}

export class NetRaceSync {
  readonly sim: RaceSim;
  readonly localPlayerId: string;
  readonly isSpectator: boolean;
  private spectateTargetId: string;
  private pendingInputs: PendingInput[] = [];
  private recentInputs: SequencedInput[] = [];
  private snapshotBuffer: BufferedSnapshot[] = [];
  private latestSnapshot: WorldSnapshot | null = null;
  private nextSeq = 1;
  private errorOffsetX = 0;
  private errorOffsetY = 0;
  private errorOffsetAngle = 0;

  // Server-time clock sync & adaptive interpolation delay
  private clockOffsetMs: number | null = null;
  private interpDelayMs = INITIAL_INTERP_DELAY_MS;
  private renderServerTimeMs: number | null = null;
  private lastSnapshotServerMs: number | null = null;
  private lastSnapshotReceivedMs: number | null = null;
  private snapshotIntervalMs = 33.3;
  private avgSnapshotIntervalMs = 33.3;
  private avgJitterMs = 15;
  private remoteExtrapolating = new Set<string>();

  // Reusable caches to avoid per-frame allocations
  private renderPlayerCache: RacerState;
  private renderRacersCache: RacerState[];

  // Debug telemetry (?netdebug=1 & headless harness)
  private posError = 0;
  private angleError = 0;
  private avgPosError = 0;
  private avgAngleError = 0;
  private starvationFrames = 0;
  private remoteJitterSpikes = 0;
  private maxRemoteJitterRatio = 0;

  constructor(
    track: Track,
    participants: RaceParticipant[],
    localPlayerId: string,
    totalLaps?: number,
    isSpectator = false,
  ) {
    this.localPlayerId = localPlayerId;
    this.isSpectator = isSpectator;
    this.spectateTargetId = isSpectator ? (participants[0]?.id ?? localPlayerId) : localPlayerId;
    this.sim = new RaceSim(track, participants[0]?.carId ?? 'sirip', {
      participants,
      localPlayerId,
      fillWithAi: false, // Server already provides the full 6-car participant list
      totalLaps,
    });
    this.renderPlayerCache = { ...this.sim.player };
    this.renderRacersCache = [...this.sim.racers];
  }

  getSpectateTarget(): { id: string; label: string } | null {
    if (!this.isSpectator || this.sim.racers.length === 0) return null;
    const found = this.sim.racers.find((r) => r.id === this.spectateTargetId) ?? this.sim.racers[0];
    return { id: found.id, label: found.label };
  }

  cycleSpectateTarget(dir: 1 | -1 = 1): { id: string; label: string } | null {
    if (!this.isSpectator || this.sim.racers.length === 0) return null;
    const idx = this.sim.racers.findIndex((r) => r.id === this.spectateTargetId);
    const cur = idx >= 0 ? idx : 0;
    const nextIdx = (cur + dir + this.sim.racers.length) % this.sim.racers.length;
    const next = this.sim.racers[nextIdx];
    this.spectateTargetId = next.id;
    return { id: next.id, label: next.label };
  }

  get currentMode(): 'countdown' | 'racing' | 'finished' {
    return this.latestSnapshot?.mode ?? 'countdown';
  }

  get currentCountdown(): number | null {
    return this.latestSnapshot ? this.latestSnapshot.countdown : 3;
  }

  /**
   * Returns the most recent `count` sequenced inputs for redundant batching.
   */
  getRecentInputs(count = 4): SequencedInput[] {
    if (this.recentInputs.length <= count) {
      return this.recentInputs.slice();
    }
    return this.recentInputs.slice(this.recentInputs.length - count);
  }

  getDebugStats(rttMs: number | null = null): NetDebugStats {
    return {
      posError: this.posError,
      angleError: this.angleError,
      avgPosError: this.avgPosError,
      avgAngleError: this.avgAngleError,
      snapshotIntervalMs: this.snapshotIntervalMs,
      avgSnapshotIntervalMs: this.avgSnapshotIntervalMs,
      starvationFrames: this.starvationFrames,
      remoteJitterSpikes: this.remoteJitterSpikes,
      maxRemoteJitterRatio: this.maxRemoteJitterRatio,
      interpDelayMs: this.interpDelayMs,
      rttMs,
      pendingInputs: this.pendingInputs.length,
    };
  }

  /**
   * Records and locally predicts the local player's next fixed physics step.
   * Returns the sequence number assigned to this input.
   */
  predictLocal(input: PlayerInput, dt: number): number {
    if (this.isSpectator || this.currentMode !== 'racing') {
      return 0;
    }

    const seq = this.nextSeq;
    this.nextSeq += 1;

    const inputCopy: PlayerInput = { ...input };
    this.pendingInputs.push({ seq, input: inputCopy, dt });
    if (this.pendingInputs.length > MAX_PENDING_INPUTS) {
      this.pendingInputs.shift();
    }
    this.recentInputs.push({ seq, input: inputCopy });
    if (this.recentInputs.length > MAX_RECENT_INPUTS) {
      this.recentInputs.shift();
    }

    const player = this.sim.player;
    player.prevX = player.x;
    player.prevY = player.y;
    player.prevAngle = player.angle;
    if (!player.finished) {
      const spec = getCar(player.carId);
      stepRacer(player, spec, this.sim.track, inputCopy, dt);
      player.s = nearestOnTrack(this.sim.track, player.x, player.y).s;
    }
    return seq;
  }

  /**
   * Ingests an authoritative snapshot from the server:
   * - Drops stale/duplicate ticks (tick <= latest)
   * - Tracks server-time clock offset and adaptive interpolation delay
   * - Reconciles the local player's predicted state against server truth
   */
  applyServerSnapshot(snapshot: WorldSnapshot, receivedAt = Date.now()): void {
    if (this.latestSnapshot && snapshot.tick <= this.latestSnapshot.tick) {
      return;
    }
    this.latestSnapshot = snapshot;
    this.sim.elapsed = snapshot.elapsed;
    this.sim.tick = snapshot.tick;

    const serverTimeMs = snapshot.elapsed * 1000;
    if (snapshot.mode === 'racing' && serverTimeMs > 0) {
      if (this.lastSnapshotServerMs !== null && serverTimeMs > this.lastSnapshotServerMs) {
        const serverDt = serverTimeMs - this.lastSnapshotServerMs;
        const arrivalDt = receivedAt - (this.lastSnapshotReceivedMs ?? receivedAt);
        const jitter = Math.abs(arrivalDt - serverDt);
        this.snapshotIntervalMs = arrivalDt;
        this.avgSnapshotIntervalMs += (serverDt - this.avgSnapshotIntervalMs) * 0.15;
        this.avgJitterMs += (jitter - this.avgJitterMs) * 0.15;
        const targetDelay = clamp(
          this.avgSnapshotIntervalMs * 2 + Math.max(25, this.avgJitterMs * 2),
          MIN_INTERP_DELAY_MS,
          MAX_INTERP_DELAY_MS,
        );
        this.interpDelayMs += (targetDelay - this.interpDelayMs) * 0.15;
      }
      this.lastSnapshotServerMs = serverTimeMs;
      this.lastSnapshotReceivedMs = receivedAt;

      const sampleOffset = receivedAt - serverTimeMs;
      if (this.clockOffsetMs === null) {
        this.clockOffsetMs = sampleOffset;
      } else {
        // Asymmetric EMA (min-filter style): tracks lower-latency packets closely, resists jitter spikes
        const alpha = sampleOffset < this.clockOffsetMs ? 0.08 : 0.015;
        this.clockOffsetMs += (sampleOffset - this.clockOffsetMs) * alpha;
      }
    }

    this.snapshotBuffer.push({ serverTimeMs, receivedAt, snapshot });
    if (this.snapshotBuffer.length > 24) {
      this.snapshotBuffer.shift();
    }

    if (this.isSpectator) return;

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
        player.s = nearestOnTrack(this.sim.track, player.x, player.y).s;
      }
    }

    const dx = oldVisualX - player.x;
    const dy = oldVisualY - player.y;
    const err = Math.hypot(dx, dy);
    const angleDiff = shortestAngle(player.angle, oldVisualAngle);
    const absAngleDiff = Math.abs(angleDiff);

    this.posError = Math.hypot(oldX - player.x, oldY - player.y);
    this.angleError = Math.abs(shortestAngle(player.angle, oldAngle));
    this.avgPosError += (this.posError - this.avgPosError) * 0.1;
    this.avgAngleError += (this.angleError - this.avgAngleError) * 0.1;

    // Dead zone: ignore micro-corrections from float/ULP differences
    if (err < DEADZONE_POS && absAngleDiff < DEADZONE_ANGLE) {
      const nudgeX = (player.x - oldX) * 0.08;
      const nudgeY = (player.y - oldY) * 0.08;
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

    // Large error (respawn or severe collision): clean teleport without smoothing
    if (err >= TELEPORT_THRESHOLD) {
      this.errorOffsetX = 0;
      this.errorOffsetY = 0;
      this.errorOffsetAngle = 0;
      player.prevX = player.x;
      player.prevY = player.y;
      player.prevAngle = player.angle;
      return;
    }

    // Maintain continuous prevX/prevY/prevAngle for sub-frame alpha interpolation
    player.prevX = player.x - player.vx * (1 / 120);
    player.prevY = player.y - player.vy * (1 / 120);
    player.prevAngle = player.angle - (player.yawRate ?? 0) * (1 / 120);

    // Absorb position and heading difference into decaying visual offsets
    this.errorOffsetX = dx;
    this.errorOffsetY = dy;
    this.errorOffsetAngle = angleDiff;
  }

  /**
   * Updates remote racers via server-time snapshot interpolation and decays local visual error offsets.
   */
  updateVisuals(dt: number, nowMs = Date.now()): void {
    const decay = Math.exp(-dt * 10);
    const nextOffX = this.errorOffsetX * decay;
    const nextOffY = this.errorOffsetY * decay;
    const stepX = this.errorOffsetX - nextOffX;
    const stepY = this.errorOffsetY - nextOffY;
    const stepDist = Math.hypot(stepX, stepY);
    const maxStep = Math.max(0.1, dt * 95);
    if (stepDist > maxStep) {
      const scale = maxStep / stepDist;
      this.errorOffsetX -= stepX * scale;
      this.errorOffsetY -= stepY * scale;
    } else {
      this.errorOffsetX = nextOffX;
      this.errorOffsetY = nextOffY;
    }
    this.errorOffsetAngle *= decay;
    if (Math.abs(this.errorOffsetX) < 0.01) this.errorOffsetX = 0;
    if (Math.abs(this.errorOffsetY) < 0.01) this.errorOffsetY = 0;
    if (Math.abs(this.errorOffsetAngle) < 0.001) this.errorOffsetAngle = 0;

    if (this.snapshotBuffer.length === 0) {
      this.lockRemotePrevToCurrent();
      return;
    }

    const isRacing = this.latestSnapshot?.mode === 'racing' && this.clockOffsetMs !== null;
    if (!isRacing) {
      const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
      for (const racer of this.sim.racers) {
        if (!this.isSpectator && racer.id === this.localPlayerId) continue;
        const state = latest.snapshot.racers.find((r) => r.id === racer.id);
        if (state) {
          this.copyNetToRacer(state, racer);
        }
      }
      this.lockRemotePrevToCurrent();
      return;
    }

    const estimatedServerNowMs = nowMs - (this.clockOffsetMs as number);
    const targetRenderTimeMs = estimatedServerNowMs - this.interpDelayMs;
    if (
      this.renderServerTimeMs === null ||
      Math.abs(targetRenderTimeMs - this.renderServerTimeMs) > 120
    ) {
      this.renderServerTimeMs = targetRenderTimeMs;
    } else {
      const dtMs = Math.max(0, dt * 1000);
      const nominalNext = this.renderServerTimeMs + dtMs;
      const correction = (targetRenderTimeMs - nominalNext) * 0.08;
      const stepMs = clamp(dtMs + correction, 0, dtMs * 1.25);
      this.renderServerTimeMs += stepMs;
    }
    const renderServerTimeMs = this.renderServerTimeMs;

    // Find two snapshots bracketing renderServerTimeMs
    let before: BufferedSnapshot | null = null;
    let after: BufferedSnapshot | null = null;
    for (let i = 0; i < this.snapshotBuffer.length; i += 1) {
      const entry = this.snapshotBuffer[i];
      if (entry.serverTimeMs <= renderServerTimeMs) {
        before = entry;
      } else {
        after = entry;
        break;
      }
    }

    const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    if (!after && renderServerTimeMs > latest.serverTimeMs) {
      this.starvationFrames += 1;
    }

    const blendRecover = 1 - Math.exp(-dt * 18);
    const blendExtrap = 1 - Math.exp(-dt * 20);

    for (const racer of this.sim.racers) {
      if (!this.isSpectator && racer.id === this.localPlayerId) continue;

      const prevVisX = racer.x;
      const prevVisY = racer.y;
      const prevVisAngle = racer.angle;

      if (before && after) {
        const spanMs = Math.max(1, after.serverTimeMs - before.serverTimeMs);
        const spanSec = spanMs / 1000;
        const t = clamp((renderServerTimeMs - before.serverTimeMs) / spanMs, 0, 1);
        const a = before.snapshot.racers.find((r) => r.id === racer.id);
        const b = after.snapshot.racers.find((r) => r.id === racer.id);
        if (a && b) {
          this.copyNetToRacer(b, racer);

          const dv = Math.hypot(b.vx - a.vx, b.vy - a.vy);
          let targetX: number;
          let targetY: number;
          if (dv > 40) {
            // Collision/wall-hit velocity discontinuity: linear interp avoids Hermite overshoot
            targetX = a.x + (b.x - a.x) * t;
            targetY = a.y + (b.y - a.y) * t;
          } else {
            // Cubic Hermite interpolation for C1-continuous position & velocity
            const t2 = t * t;
            const t3 = t2 * t;
            const h00 = 2 * t3 - 3 * t2 + 1;
            const h10 = t3 - 2 * t2 + t;
            const h01 = -2 * t3 + 3 * t2;
            const h11 = t3 - t2;

            targetX = h00 * a.x + h10 * (a.vx * spanSec) + h01 * b.x + h11 * (b.vx * spanSec);
            targetY = h00 * a.y + h10 * (a.vy * spanSec) + h01 * b.y + h11 * (b.vy * spanSec);
          }
          let targetAngle = a.angle + shortestAngle(a.angle, b.angle) * t;

          if (this.remoteExtrapolating.has(racer.id)) {
            const jumpDist = Math.hypot(targetX - prevVisX, targetY - prevVisY);
            if (jumpDist < TELEPORT_THRESHOLD && jumpDist > 0.05) {
              targetX = prevVisX + (targetX - prevVisX) * blendRecover;
              targetY = prevVisY + (targetY - prevVisY) * blendRecover;
              targetAngle = prevVisAngle + shortestAngle(prevVisAngle, targetAngle) * blendRecover;
            } else {
              this.remoteExtrapolating.delete(racer.id);
            }
          }

          racer.x = targetX;
          racer.y = targetY;
          racer.angle = targetAngle;
          racer.vx = a.vx + (b.vx - a.vx) * t;
          racer.vy = a.vy + (b.vy - a.vy) * t;
          racer.steer = a.steer + (b.steer - a.steer) * t;

          this.recordRemoteJitter(prevVisX, prevVisY, racer, dt);
          continue;
        }
      }

      // Starvation fallback: smooth bounded velocity extrapolation from latest snapshot (max 150ms)
      const state = latest.snapshot.racers.find((r) => r.id === racer.id);
      if (state) {
        this.copyNetToRacer(state, racer);
        const extrapMs = clamp(renderServerTimeMs - latest.serverTimeMs, 0, MAX_EXTRAP_MS);
        const extrapSec = extrapMs / 1000;
        let targetX = state.x + state.vx * extrapSec;
        let targetY = state.y + state.vy * extrapSec;
        let targetAngle = state.angle + (state.yawRate ?? 0) * extrapSec;

        const jumpDist = Math.hypot(targetX - prevVisX, targetY - prevVisY);
        if (jumpDist < TELEPORT_THRESHOLD) {
          targetX = prevVisX + (targetX - prevVisX) * blendExtrap;
          targetY = prevVisY + (targetY - prevVisY) * blendExtrap;
          targetAngle = prevVisAngle + shortestAngle(prevVisAngle, targetAngle) * blendExtrap;
        }

        this.remoteExtrapolating.add(racer.id);
        racer.x = targetX;
        racer.y = targetY;
        racer.angle = targetAngle;
        this.recordRemoteJitter(prevVisX, prevVisY, racer, dt);
      }
    }

    // P0-1: Lock prev = current for all remote racers so fixed-step renderer alpha is a no-op
    this.lockRemotePrevToCurrent();
  }

  private lockRemotePrevToCurrent(): void {
    for (const racer of this.sim.racers) {
      if (!this.isSpectator && racer.id === this.localPlayerId) continue;
      racer.prevX = racer.x;
      racer.prevY = racer.y;
      racer.prevAngle = racer.angle;
    }
  }

  private recordRemoteJitter(prevX: number, prevY: number, racer: RacerState, dt: number): void {
    if (dt <= 0) return;
    const move = Math.hypot(racer.x - prevX, racer.y - prevY);
    const expected = Math.hypot(racer.vx, racer.vy) * dt;
    if (expected > 0.05 && move < 40) {
      const ratio = move / expected;
      if (ratio > this.maxRemoteJitterRatio) {
        this.maxRemoteJitterRatio = ratio;
      }
      if (ratio > 2.0) {
        this.remoteJitterSpikes += 1;
      }
    }
  }

  getRenderPlayer(): RacerState {
    if (this.isSpectator) {
      return this.sim.racers.find((r) => r.id === this.spectateTargetId) ?? this.sim.racers[0];
    }
    const p = this.sim.player;
    if (this.errorOffsetX === 0 && this.errorOffsetY === 0 && this.errorOffsetAngle === 0) {
      return p;
    }
    Object.assign(this.renderPlayerCache, p);
    this.renderPlayerCache.x = p.x + this.errorOffsetX;
    this.renderPlayerCache.y = p.y + this.errorOffsetY;
    this.renderPlayerCache.angle = p.angle + this.errorOffsetAngle;
    this.renderPlayerCache.prevX = (p.prevX ?? p.x) + this.errorOffsetX;
    this.renderPlayerCache.prevY = (p.prevY ?? p.y) + this.errorOffsetY;
    this.renderPlayerCache.prevAngle = (p.prevAngle ?? p.angle) + this.errorOffsetAngle;
    return this.renderPlayerCache;
  }

  getRenderRacers(): RacerState[] {
    if (this.isSpectator) {
      return this.sim.racers;
    }
    const renderPlayer = this.getRenderPlayer();
    const racers = this.sim.racers;
    if (this.renderRacersCache.length !== racers.length) {
      this.renderRacersCache = new Array(racers.length);
    }
    for (let i = 0; i < racers.length; i += 1) {
      const r = racers[i];
      this.renderRacersCache[i] = r.id === this.localPlayerId ? renderPlayer : r;
    }
    return this.renderRacersCache;
  }

  toHudSnapshot(): RaceSnapshot {
    const mode = this.currentMode === 'countdown' ? 'countdown' : 'racing';
    const snap = this.sim.snapshot(mode, this.currentCountdown);
    if (!this.isSpectator) return snap;
    const target = this.sim.racers.find((r) => r.id === this.spectateTargetId) ?? this.sim.racers[0];
    if (!target) return snap;
    const targetRow = snap.racers.find((r) => r.id === target.id);
    return {
      ...snap,
      lap: target.startedLap ? Math.min(this.sim.totalLaps, target.lap + 1) : 1,
      position: targetRow?.position ?? snap.position,
      nitro: target.nitro,
      speed: Math.hypot(target.vx, target.vy),
      playerFinished: target.finished,
      wrongWay: Boolean(target.wrongWay),
      playerAngle: target.angle,
      playerX: target.x,
      playerY: target.y,
    };
  }

  private copyNetToRacer(src: NetRacerState, dst: RacerState): void {
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
    if (src.impactKind !== undefined) dst.impactKind = src.impactKind;
    if (src.padCooldown !== undefined) dst.padCooldown = src.padCooldown;
    if (src.wrongWayTime !== undefined) dst.wrongWayTime = src.wrongWayTime;
    if (src.stuckTime !== undefined) dst.stuckTime = src.stuckTime;
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
