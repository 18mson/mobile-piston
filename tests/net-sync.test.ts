import { describe, expect, it } from 'vitest';
import { TELUK_SORE } from '../src/game/track/telukSore';
import { NetRaceSync } from '../src/game/net/sync';
import type { WorldSnapshot } from '../src/game/types';

describe('client netcode prediction & interpolation', () => {
  const participants = [
    { id: 'p1', label: 'Host', carId: 'mcqueen' as const, colorIndex: 0 },
    { id: 'p2', label: 'Guest', carId: 'doc' as const, colorIndex: 1 },
  ];

  it('predicts local player movement immediately and reconciles against server snapshot', () => {
    const sync = new NetRaceSync(TELUK_SORE, participants, 'p1');
    const initialStates = sync.sim.exportNetState();

    // Enter racing mode via initial snapshot
    const startSnap: WorldSnapshot = {
      tick: 1,
      elapsed: 0.1,
      mode: 'racing',
      countdown: null,
      lastProcessedSeq: { p1: 0, p2: 0 },
      racers: initialStates,
    };
    sync.applyServerSnapshot(startSnap, 1000);

    const startX = sync.sim.player.x;
    const seq1 = sync.predictLocal({ steer: 0, brake: false, nitro: true, pause: false, gas: true }, 1 / 120);
    const seq2 = sync.predictLocal({ steer: 0, brake: false, nitro: true, pause: false, gas: true }, 1 / 120);
    expect(seq2).toBeGreaterThan(seq1);
    expect(sync.sim.player.x).not.toBe(startX);

    // Server acks seq1 with a slight collision push (+4 units in Y)
    const serverRacers = sync.sim.exportNetState();
    const serverP1 = serverRacers.find((r) => r.id === 'p1')!;
    serverP1.x = startX + 0.5;
    serverP1.y += 4.0;

    sync.applyServerSnapshot(
      {
        tick: 10,
        elapsed: 0.2,
        mode: 'racing',
        countdown: null,
        lastProcessedSeq: { p1: seq1, p2: 0 },
        racers: serverRacers,
      },
      1050,
    );

    // Visual offset should smooth the 4-unit jump, then decay toward 0
    const renderBefore = sync.getRenderPlayer();
    expect(renderBefore.y).not.toBe(sync.sim.player.y);
    sync.updateVisuals(0.5, 1100);
    const renderAfter = sync.getRenderPlayer();
    expect(Math.abs(renderAfter.y - sync.sim.player.y)).toBeLessThan(0.1);
  });

  it('interpolates remote racer positions smoothly between buffered snapshots on server timeline', () => {
    const sync = new NetRaceSync(TELUK_SORE, participants, 'p1');
    const racersA = sync.sim.exportNetState();
    const racersB = sync.sim.exportNetState();
    const p2A = racersA.find((r) => r.id === 'p2')!;
    const p2B = racersB.find((r) => r.id === 'p2')!;

    p2A.x = 100;
    p2A.y = 200;
    p2A.vx = 2000;
    p2B.x = 200;
    p2B.y = 200;
    p2B.vx = 2000;

    sync.applyServerSnapshot(
      { tick: 1, elapsed: 0.1, mode: 'racing', countdown: null, lastProcessedSeq: {}, racers: racersA },
      1000,
    );
    sync.applyServerSnapshot(
      { tick: 4, elapsed: 0.15, mode: 'racing', countdown: null, lastProcessedSeq: {}, racers: racersB },
      1050,
    );

    // Server time at now=1135 with clockOffset=900 and adaptive interpDelay (~108ms) is near midpoint (~127ms)
    sync.updateVisuals(1 / 60, 1135);
    const remoteP2 = sync.sim.racers.find((r) => r.id === 'p2')!;
    expect(remoteP2.x).toBeGreaterThan(140);
    expect(remoteP2.x).toBeLessThan(165);
    // Remote racers lock prev = current so renderer fixed-step alpha does not double-lerp
    expect(remoteP2.prevX).toBe(remoteP2.x);
    expect(remoteP2.prevY).toBe(remoteP2.y);
  });

  it('smooths angle corrections with errorOffsetAngle and ignores deadzone micro-errors', () => {
    const sync = new NetRaceSync(TELUK_SORE, participants, 'p1');
    const initialStates = sync.sim.exportNetState();
    sync.applyServerSnapshot(
      { tick: 1, elapsed: 0.1, mode: 'racing', countdown: null, lastProcessedSeq: { p1: 0 }, racers: initialStates },
      1000,
    );

    const serverRacers = sync.sim.exportNetState();
    const serverP1 = serverRacers.find((r) => r.id === 'p1')!;
    const origAngle = serverP1.angle;
    serverP1.angle = origAngle + 0.25; // significant heading correction

    sync.applyServerSnapshot(
      { tick: 4, elapsed: 0.15, mode: 'racing', countdown: null, lastProcessedSeq: { p1: 0 }, racers: serverRacers },
      1050,
    );

    const beforeDecay = sync.getRenderPlayer();
    expect(Math.abs(beforeDecay.angle - origAngle)).toBeLessThan(0.05);
    expect(beforeDecay.prevAngle).toBeCloseTo(beforeDecay.angle, 3);

    sync.updateVisuals(0.4, 1450);
    const afterDecay = sync.getRenderPlayer();
    expect(Math.abs(afterDecay.angle - (origAngle + 0.25))).toBeLessThan(0.02);
  });
});
