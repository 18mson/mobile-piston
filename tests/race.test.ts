import { describe, expect, it } from 'vitest';
import { TELUK_SORE } from '../src/game/track/telukSore';
import { RaceSim } from '../src/game/race';
import { computeAiInput } from '../src/game/ai';
import { resolveRacerCollisions } from '../src/game/physics';

function autopilotRace(car: 'sirip' | 'bagas' | 'okra' | 'kepik' = 'okra') {
  const race = new RaceSim(TELUK_SORE, car);
  let steps = 0;
  while (!race.playerFinished && steps < 120 * 160) {
    const input = computeAiInput(race.player, race.racers, TELUK_SORE, race.elapsed);
    race.update(1 / 120, input);
    steps += 1;
  }
  return { race, steps };
}

describe('race outcomes', () => {
  it('records exactly three timed laps and a real finish order', () => {
    const { race } = autopilotRace('kepik');
    expect(race.playerFinished).toBe(true);
    expect(race.player.lapTimes).toHaveLength(3);
    expect(race.player.bestLapMs).toBe(Math.min(...race.player.lapTimes));
    expect(race.player.finishTime).not.toBeNull();
    race.completeRace();
    const results = race.results(null);
    expect(results.results).toHaveLength(6);
    expect(new Set(results.results.map((result) => result.position))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(results.results.filter((result) => result.isPlayer)).toHaveLength(1);
    expect(results.results.every((result) => result.timeMs != null && result.timeMs > 0)).toBe(true);
    expect(results.isNewRecord).toBe(true);
  });

  it('marks an improvement over a previous best as a new record only when faster', () => {
    const { race } = autopilotRace('sirip');
    const slower = race.results((race.player.bestLapMs ?? 0) - 1);
    expect(slower.isNewRecord).toBe(false);
    const faster = race.results((race.player.bestLapMs ?? 0) + 1);
    expect(faster.isNewRecord).toBe(true);
  });

  it('separates overlapping cars and keeps velocities finite', () => {
    const race = new RaceSim(TELUK_SORE, 'bagas');
    const a = race.racers[0];
    const b = race.racers[1];
    a.x = 1000;
    a.y = 900;
    b.x = 1004;
    b.y = 900;
    a.vx = 120;
    b.vx = -60;
    resolveRacerCollisions(race.racers);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(15);
    for (const racer of race.racers) {
      expect(Number.isFinite(racer.vx)).toBe(true);
      expect(Number.isFinite(racer.vy)).toBe(true);
    }
  });

  it('does not count an immediate start-line crossing as a completed lap', () => {
    const race = new RaceSim(TELUK_SORE, 'sirip');
    for (let i = 0; i < 120 * 4; i += 1) {
      const input = computeAiInput(race.player, race.racers, TELUK_SORE, race.elapsed);
      race.update(1 / 120, input);
    }
    expect(race.player.startedLap).toBe(true);
    expect(race.player.lap).toBe(0);
  });

  it('supports explore mode without resets, wrong-way flags, or race finish', () => {
    const sample = TELUK_SORE.samples[20];
    const race = new RaceSim(TELUK_SORE, 'bagas', {
      explore: true,
      initialPose: {
        x: sample.x,
        y: sample.y,
        angle: Math.atan2(sample.ty, sample.tx) + Math.PI,
        vx: 0,
        vy: 0,
        s: sample.dist,
      },
    });
    expect(race.racers).toHaveLength(1);
    for (let i = 0; i < 120 * 4; i += 1) {
      race.update(1 / 120, { steer: 0, brake: false, nitro: false, pause: false, gas: false });
    }
    expect(race.player.wrongWay).toBe(false);
    expect(race.player.stuckTime).toBe(0);
    expect(race.playerFinished).toBe(false);
    expect(race.snapshot('explore', null).mode).toBe('explore');
  });
});
