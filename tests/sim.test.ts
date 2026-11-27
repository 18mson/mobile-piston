import { describe, expect, it } from 'vitest';
import { TELUK_SORE } from '../src/game/track/telukSore';
import { MATA_AIR } from '../src/game/track/mataAir';
import { nearestOnTrack, pointAtDistance, sampleAtDistance } from '../src/game/track/geometry';
import { RaceSim } from '../src/game/race';
import { computeAiInput } from '../src/game/ai';

describe('track geometry', () => {
  it('builds a closed, ordered spline with sane length', () => {
    expect(TELUK_SORE.samples.length).toBeGreaterThan(200);
    expect(TELUK_SORE.length).toBeGreaterThan(2500);
    const start = sampleAtDistance(TELUK_SORE, 0);
    const nearStart = pointAtDistance(TELUK_SORE, 0.01);
    expect(Math.hypot(nearStart.x - start.x, nearStart.y - start.y)).toBeLessThan(1);
  });

  it('builds the Mata Air circuit as a closed spline', () => {
    expect(MATA_AIR.id).toBe('mata-air');
    expect(MATA_AIR.samples.length).toBeGreaterThan(200);
    expect(MATA_AIR.length).toBeGreaterThan(1500);
    const start = sampleAtDistance(MATA_AIR, 0);
    const headingDot = Math.cos(MATA_AIR.startHeading) * start.tx + Math.sin(MATA_AIR.startHeading) * start.ty;
    expect(headingDot).toBeGreaterThan(0.95);
  });

  it('projects points to the road and reports the side', () => {
    const point = sampleAtDistance(TELUK_SORE, TELUK_SORE.length * 0.3);
    const left = nearestOnTrack(TELUK_SORE, point.x + point.nx * 20, point.y + point.ny * 20);
    const right = nearestOnTrack(TELUK_SORE, point.x - point.nx * 20, point.y - point.ny * 20);
    expect(left.side).toBeGreaterThan(0);
    expect(right.side).toBeLessThan(0);
    expect(left.distance).toBeGreaterThan(10);
  });
});

describe('race simulation', () => {
  it('runs eight cars through three laps without NaNs or stalls', () => {
    const race = new RaceSim(TELUK_SORE, 'sirip');
    expect(race.racers).toHaveLength(8);
    let steps = 0;
    while (!race.playerFinished && steps < 120 * 180) {
      const autopilot = computeAiInput(race.player, race.racers, TELUK_SORE, race.elapsed);
      race.update(1 / 120, autopilot);
      steps += 1;
    }
    expect(race.playerFinished).toBe(true);
    expect(steps).toBeLessThan(120 * 150);
    expect(race.player.lapTimes).toHaveLength(3);
    expect(race.player.bestLapMs).not.toBeNull();
    expect(race.player.bestLapMs!).toBeGreaterThan(12000);
    for (const racer of race.racers) {
      expect(Number.isFinite(racer.x)).toBe(true);
      expect(Number.isFinite(racer.y)).toBe(true);
      expect(Number.isFinite(racer.angle)).toBe(true);
      expect(Number.isFinite(racer.vx)).toBe(true);
    }
    race.completeRace();
    const results = race.results(null);
    expect(results.results).toHaveLength(8);
    expect(results.results.every((result) => result.timeMs != null)).toBe(true);
    expect(new Set(results.results.map((result) => result.position)).size).toBe(8);
  });

  it('runs the Mata Air circuit through three timed laps', () => {
    const race = new RaceSim(MATA_AIR, 'bagas');
    let steps = 0;
    while (!race.playerFinished && steps < 120 * 150) {
      const autopilot = computeAiInput(race.player, race.racers, MATA_AIR, race.elapsed);
      race.update(1 / 120, autopilot);
      steps += 1;
    }
    expect(race.playerFinished).toBe(true);
    expect(race.player.lapTimes).toHaveLength(3);
    expect(race.player.bestLapMs).not.toBeNull();
    expect(race.player.bestLapMs!).toBeGreaterThan(8000);
    race.completeRace();
    const results = race.results(null);
    expect(results.results).toHaveLength(8);
    expect(results.results.every((result) => result.timeMs != null)).toBe(true);
  });

  it('accelerates straight from the grid', () => {
    const race = new RaceSim(TELUK_SORE, 'kepik');
    for (let i = 0; i < 90; i += 1) {
      race.update(1 / 120, { steer: 0, brake: false, nitro: false, pause: false });
    }
    expect(Math.hypot(race.player.vx, race.player.vy)).toBeGreaterThan(40);
    expect(Number.isFinite(race.player.x)).toBe(true);
  });
});
