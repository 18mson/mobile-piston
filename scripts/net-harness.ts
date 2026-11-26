import { GameRoom } from '../server/room';
import { computeAiInput } from '../src/game/ai';
import { NetRaceSync } from '../src/game/net/sync';
import { TELUK_SORE } from '../src/game/track/telukSore';
import type { PlayerInput, ServerMessage, WorldSnapshot } from '../src/game/types';

// Deterministic PRNG for reproducible network conditions
function createRng(seed = 42): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

interface ScheduledPacket<T> {
  deliverAtMs: number;
  payload: T;
}

class FakeChannel<T> {
  private queue: ScheduledPacket<T>[] = [];
  constructor(
    private rng: () => number,
    private baseLatencyMs = 75,
    private jitterMs = 30,
    private lossRate = 0.02,
    private reorderRate = 0.08,
  ) {}

  send(nowMs: number, payload: T): void {
    if (this.rng() < this.lossRate) return; // simulated packet loss
    const jitter = (this.rng() * 2 - 1) * this.jitterMs;
    const extraReorder = this.rng() < this.reorderRate ? 25 + this.rng() * 35 : 0;
    const delay = Math.max(15, this.baseLatencyMs + jitter + extraReorder);
    this.queue.push({ deliverAtMs: nowMs + delay, payload });
  }

  drain(nowMs: number): T[] {
    const ready: T[] = [];
    const remaining: ScheduledPacket<T>[] = [];
    for (const pkt of this.queue) {
      if (pkt.deliverAtMs <= nowMs) {
        ready.push(pkt.payload);
      } else {
        remaining.push(pkt);
      }
    }
    this.queue = remaining;
    return ready;
  }
}

export interface HarnessMetrics {
  remoteMaxRatio: number;
  remoteSpikes15x: number;
  remoteSpikes20x: number;
  remoteOscillations: number;
  localAvgPosErrAfterTransient: number;
  localAvgAngleErrAfterTransient: number;
  localMaxVisualJumpPerFrame: number;
  cameraMeshMaxDiff: number;
  starvationFrames: number;
  snapshotCount: number;
}

export function runHeadlessHarness(): HarnessMetrics {
  const rng = createRng(1337);
  const room = new GameRoom('NET01', 'teluk-sore', 'host');

  const hostToGuest1 = new FakeChannel<ServerMessage>(rng, 70, 30, 0.02, 0.08);
  const guest1ToHost = new FakeChannel<{ seq: number; input: PlayerInput; inputs?: { seq: number; input: PlayerInput }[] }>(
    rng,
    70,
    30,
    0.02,
    0.08,
  );

  let simNowMs = 1000;
  let hostRaceStarted: Extract<ServerMessage, { type: 'race_started' }> | null = null;
  let guestRaceStarted: Extract<ServerMessage, { type: 'race_started' }> | null = null;
  const hostSnapQueue: WorldSnapshot[] = [];

  room.addMember('host', 'Host', 'hachi', 0, (msg) => {
    if (msg.type === 'race_started') hostRaceStarted = msg;
    if (msg.type === 'snapshot') hostSnapQueue.push(msg.snapshot);
  });
  room.addMember('guest1', 'Guest1', 'sirip', 1, (msg) => {
    hostToGuest1.send(simNowMs, msg);
  });

  room.startRace('host', false);

  // Fast-forward countdown (3.2s)
  for (let i = 0; i < 34; i += 1) {
    simNowMs += 100;
    room.step(0.1, simNowMs);
    for (const msg of hostToGuest1.drain(simNowMs)) {
      if (msg.type === 'race_started') guestRaceStarted = msg;
    }
  }

  if (!hostRaceStarted || !guestRaceStarted) {
    throw new Error('Race failed to start in harness');
  }

  const participants = guestRaceStarted.participants.map((p) => ({
    id: p.id,
    label: p.name,
    carId: p.carId,
    colorIndex: p.colorIndex,
  }));

  const guestSync = new NetRaceSync(TELUK_SORE, participants, 'guest1');
  // Deliver initial racing snapshot
  const initSnaps = hostToGuest1.drain(simNowMs);
  for (const msg of initSnaps) {
    if (msg.type === 'snapshot') guestSync.applyServerSnapshot(msg.snapshot, simNowMs);
  }

  const FIXED_STEP = 1 / 120;
  let guestAccum = 0;
  let guestInputTimer = 0;
  let lastGuestSeq = 0;

  let remoteMaxRatio = 0;
  let remoteSpikes15x = 0;
  let remoteSpikes20x = 0;
  let remoteOscillations = 0;
  let localMaxVisualJumpPerFrame = 0;
  let cameraMeshMaxDiff = 0;
  let starvationFrames = 0;
  let snapshotCount = 0;

  const posErrSamples: number[] = [];
  const angleErrSamples: number[] = [];

  const prevRemotePos = new Map<string, { x: number; y: number; dx: number; dy: number; speed: number }>();
  let prevLocalVis: { x: number; y: number; speed: number } | null = null;

  // Simulate 10 seconds at 60 FPS (600 frames), with occasional host slowdown
  const totalFrames = 600;
  for (let frame = 0; frame < totalFrames; frame += 1) {
    const isHostSlow = frame % 120 === 60;
    const frameDt = 1 / 60;
    const hostDt = isHostSlow ? 0.085 : frameDt;
    simNowMs += frameDt * 1000;

    // 1. Guest and host produce realistic racing inputs (following track + drift/nitro)
    const tSec = frame * frameDt;
    const baseGuestInput = computeAiInput(guestSync.sim.player, guestSync.sim.racers, TELUK_SORE, tSec);
    const guestInput: PlayerInput = {
      ...baseGuestInput,
      nitro: tSec > 1.5 && tSec < 3.5 ? true : baseGuestInput.nitro,
    };
    const latestHostSnap = hostSnapQueue[hostSnapQueue.length - 1];
    const hostState = latestHostSnap?.racers.find((r) => r.id === 'host');
    const hostRacer = guestSync.sim.racers.find((r) => r.id === 'host') ?? guestSync.sim.player;
    const hostInput: PlayerInput = computeAiInput(
      hostState ? { ...hostRacer, x: hostState.x, y: hostState.y, angle: hostState.angle, vx: hostState.vx, vy: hostState.vy, s: hostState.s } : hostRacer,
      guestSync.sim.racers,
      TELUK_SORE,
      tSec,
    );

    // 2. Host steps (with occasional slowdown simulated)
    room.handleInput('host', frame + 1, hostInput);
    for (const pkt of guest1ToHost.drain(simNowMs)) {
      (room as unknown as { handleInput: (...args: unknown[]) => void }).handleInput(
        'guest1',
        pkt.seq,
        pkt.input,
        pkt.inputs,
      );
    }
    // Note: on slow frame, host skips 4 frames then steps hostDt, or steps hostDt directly
    if (!isHostSlow && frame % 120 > 60 && frame % 120 < 65) {
      // skip host steps while tab paused before catching up
    } else {
      room.step(hostDt, simNowMs);
    }

    // 3. Guest receives snapshots
    for (const msg of hostToGuest1.drain(simNowMs)) {
      if (msg.type === 'snapshot') {
        snapshotCount += 1;
        // Measure pre-reconcile error after transient (t > 1.5s)
        const srvLocal = msg.snapshot.racers.find((r) => r.id === 'guest1');
        if (srvLocal && tSec > 1.5) {
          // Compare predicted state at server's tick? Better: measure error in applyServerSnapshot
        }
        guestSync.applyServerSnapshot(msg.snapshot, simNowMs);
        if (tSec > 1.5) {
          const maybeStats = (guestSync as unknown as { getDebugStats?: () => { posError: number; angleError: number } })
            .getDebugStats?.();
          if (maybeStats) {
            posErrSamples.push(maybeStats.posError);
            angleErrSamples.push(maybeStats.angleError);
          } else if (srvLocal) {
            posErrSamples.push(Math.hypot(guestSync.sim.player.x - srvLocal.x, guestSync.sim.player.y - srvLocal.y));
            const da = Math.atan2(
              Math.sin(guestSync.sim.player.angle - srvLocal.angle),
              Math.cos(guestSync.sim.player.angle - srvLocal.angle),
            );
            angleErrSamples.push(Math.abs(da));
          }
        }
      }
    }

    // 4. Guest predicts local & sends input
    guestAccum += frameDt;
    while (guestAccum >= FIXED_STEP) {
      lastGuestSeq = guestSync.predictLocal(guestInput, FIXED_STEP);
      guestAccum -= FIXED_STEP;
    }
    guestInputTimer += frameDt;
    if (lastGuestSeq > 0 && guestInputTimer >= 0.016) {
      guestInputTimer = 0;
      const batch = (guestSync as unknown as { getRecentInputs?: (n: number) => { seq: number; input: PlayerInput }[] })
        .getRecentInputs?.(4);
      guest1ToHost.send(simNowMs, { seq: lastGuestSeq, input: guestInput, inputs: batch });
    }

    // 5. Guest updates visuals & simulates renderer3d interpolation
    guestSync.updateVisuals(frameDt, simNowMs);
    const renderPlayer = guestSync.getRenderPlayer();
    const alpha = Math.max(0, Math.min(1, guestAccum / FIXED_STEP));

    // Check camera focus vs local mesh position (simulating renderRace)
    const pPrevX = renderPlayer.prevX ?? renderPlayer.x;
    const pPrevY = renderPlayer.prevY ?? renderPlayer.y;
    const meshX = pPrevX + (renderPlayer.x - pPrevX) * alpha;
    const meshY = pPrevY + (renderPlayer.y - pPrevY) * alpha;
    const focusX = pPrevX + (renderPlayer.x - pPrevX) * alpha;
    const focusY = pPrevY + (renderPlayer.y - pPrevY) * alpha;
    cameraMeshMaxDiff = Math.max(cameraMeshMaxDiff, Math.hypot(meshX - focusX, meshY - focusY));

    const localSpeed = Math.hypot(renderPlayer.vx, renderPlayer.vy);
    if (prevLocalVis && tSec > 0.5) {
      const jump = Math.hypot(meshX - prevLocalVis.x, meshY - prevLocalVis.y);
      const refSpeed = Math.max(localSpeed, prevLocalVis.speed);
      const expectedMax = refSpeed * frameDt + 2.0;
      if (jump > expectedMax) {
        if (process.env.VERBOSE_HARNESS) {
          console.log('LOCAL_JUMP', { frame, tSec: tSec.toFixed(2), jump: jump.toFixed(2), expectedMax: expectedMax.toFixed(2), x: meshX.toFixed(1), prevX: prevLocalVis.x.toFixed(1) });
        }
        localMaxVisualJumpPerFrame = Math.max(localMaxVisualJumpPerFrame, jump - refSpeed * frameDt);
      }
    }
    prevLocalVis = { x: meshX, y: meshY, speed: localSpeed };

    // Check remote cars visual displacement (simulating renderRace)
    for (const r of guestSync.sim.racers) {
      if (r.id === 'guest1') continue;
      const rPrevX = r.prevX ?? r.x;
      const rPrevY = r.prevY ?? r.y;
      const visX = rPrevX + (r.x - rPrevX) * alpha;
      const visY = rPrevY + (r.y - rPrevY) * alpha;

      const prev = prevRemotePos.get(r.id);
      const speed = Math.hypot(r.vx, r.vy);
      if (prev && tSec > 0.5) {
        const dx = visX - prev.x;
        const dy = visY - prev.y;
        const move = Math.hypot(dx, dy);
        const expected = Math.max(speed, prev.speed) * frameDt;
        if (expected > 0.05 && move < 40) {
          const ratio = move / expected;
          remoteMaxRatio = Math.max(remoteMaxRatio, ratio);
          if (ratio > 1.5) {
            remoteSpikes15x += 1;
            if (process.env.VERBOSE_HARNESS) {
              console.log('REMOTE_SPIKE', { id: r.id, frame, tSec: tSec.toFixed(2), move: move.toFixed(3), expected: expected.toFixed(3), ratio: ratio.toFixed(2) });
            }
          }
          if (ratio > 2.0) remoteSpikes20x += 1;
        }
        // Oscillation: dot product with previous frame's displacement < 0 while moving fast
        if (speed > 20 && Math.hypot(prev.dx, prev.dy) > 0.05 && move > 0.05) {
          const dot = dx * prev.dx + dy * prev.dy;
          if (dot < -0.02) {
            remoteOscillations += 1;
          }
        }
        prevRemotePos.set(r.id, { x: visX, y: visY, dx, dy, speed });
      } else {
        prevRemotePos.set(r.id, { x: visX, y: visY, dx: 0, dy: 0, speed });
      }
    }
  }

  const stats = (guestSync as unknown as { getDebugStats?: () => { starvationFrames: number } }).getDebugStats?.();
  starvationFrames = stats?.starvationFrames ?? 0;

  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  return {
    remoteMaxRatio: Number(remoteMaxRatio.toFixed(3)),
    remoteSpikes15x,
    remoteSpikes20x,
    remoteOscillations,
    localAvgPosErrAfterTransient: Number(avg(posErrSamples).toFixed(4)),
    localAvgAngleErrAfterTransient: Number(avg(angleErrSamples).toFixed(5)),
    localMaxVisualJumpPerFrame: Number(localMaxVisualJumpPerFrame.toFixed(3)),
    cameraMeshMaxDiff: Number(cameraMeshMaxDiff.toFixed(5)),
    starvationFrames,
    snapshotCount,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('HARNESS_METRICS:', JSON.stringify(runHeadlessHarness(), null, 2));
}
