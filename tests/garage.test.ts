import { describe, expect, it } from 'vitest';
import { getCarPalette } from '../src/game/data/cars';
import { applyCosmetics } from '../src/game/data/cosmetics';
import { applyCarUsage, getUsage, isGlassUnlocked, isRimUnlocked } from '../src/game/garage';
import { mergeSaves } from '../src/game/auth/sync';
import { isGarageUnlocked, unlocksBetween, xpForLevel } from '../src/game/progression';
import { defaultSave, normalizeSave } from '../src/game/save';
import type { RaceResults } from '../src/game/types';

function makeFinishedRace(overrides?: Partial<RaceResults>): RaceResults {
  return {
    results: [
      { id: 'player', label: 'Pemain', carId: 'mcqueen', number: 95, isPlayer: true, position: 1, timeMs: 62_000, bestLapMs: 20_000 },
      { id: 'ai-1', label: 'Bot', carId: 'luigi', number: 59, isPlayer: false, position: 2, timeMs: 63_500, bestLapMs: 20_400 },
    ],
    playerPosition: 1,
    playerBestLapMs: 20_000,
    previousBestLapMs: null,
    isNewRecord: true,
    totalTimeMs: 62_000,
    totalLaps: 3,
    stats: {
      driftSeconds: 12.6,
      offroadSeconds: 1,
      hits: 0,
      cleanLaps: 2,
      lapsCompleted: 3,
    },
    ...overrides,
  };
}

describe('garage feature unlocks, per-car usage, and cosmetics', () => {
  it('gates Garasi at Level 3 and includes it in level-up unlocks', () => {
    const level3Xp = xpForLevel(3);
    expect(isGarageUnlocked({ xp: 0 })).toBe(false);
    expect(isGarageUnlocked({ xp: level3Xp - 1 })).toBe(false);
    expect(isGarageUnlocked({ xp: level3Xp })).toBe(true);
    const gained = unlocksBetween(1, 3).map((u) => u.id);
    expect(gained).toContain('feature:garage');
  });

  it('tracks car usage per car and unlocks cosmetics progressively without unlocking other cars', () => {
    let save = defaultSave();

    // Race 1 with MCQUEEN: races=1, not enough for Kaca Asap (2 races)
    const r1 = applyCarUsage(save, makeFinishedRace());
    save = r1.save;
    expect(getUsage(save, 'mcqueen').races).toBe(1);
    expect(getUsage(save, 'mcqueen').laps).toBe(3);
    expect(getUsage(save, 'mcqueen').podiums).toBe(1);
    expect(getUsage(save, 'mcqueen').driftSeconds).toBe(12);
    expect(getUsage(save, 'mcqueen').cleanLaps).toBe(2);
    expect(isGlassUnlocked('mcqueen', 'asap', save)).toBe(false);
    expect(r1.unlocked).toBeNull();

    // Race 2 with MCQUEEN: races=2 -> Kaca Asap unlocks for mcqueen only
    const r2 = applyCarUsage(save, makeFinishedRace());
    save = r2.save;
    expect(getUsage(save, 'mcqueen').races).toBe(2);
    expect(isGlassUnlocked('mcqueen', 'asap', save)).toBe(true);
    expect(isGlassUnlocked('luigi', 'asap', save)).toBe(false);
    expect(r2.unlocked?.carId).toBe('mcqueen');
    expect(r2.unlocked?.items.map((i) => i.label)).toContain('Kaca Asap');

    // Race with timeMs == null (did not finish) does not increment usage
    const rDnf = applyCarUsage(
      save,
      makeFinishedRace({
        results: [
          { id: 'player', label: 'Pemain', carId: 'mcqueen', number: 95, isPlayer: true, position: 2, timeMs: null, bestLapMs: null },
          { id: 'ai-1', label: 'Bot', carId: 'luigi', number: 59, isPlayer: false, position: 1, timeMs: 60_000, bestLapMs: 19_500 },
        ],
      }),
    );
    expect(getUsage(rDnf.save, 'mcqueen').races).toBe(2);
    expect(rDnf.unlocked).toBeNull();
  });

  it('normalizes legacy and invalid cosmetics safely without dropping old saves', () => {
    const legacy = normalizeSave({ version: 2, selectedCarId: 'mcqueen', selectedTrackId: 'teluk-sore', bestLapMs: {}, audioMuted: false });
    expect(legacy.cosmetics).toBeUndefined();
    expect(legacy.carUsage).toBeUndefined();

    const sanitized = normalizeSave({
      selectedCarId: 'mcqueen',
      carUsage: {
        sirip: { races: 5, laps: 15, podiums: 1, driftSeconds: 20, cleanLaps: 3, bogus: 99 },
      },
      cosmetics: {
        sirip: { rim: 'putih-rally', glass: 'ungu-malam' }, // putih-rally unlocked (5 races), ungu-malam locked (15 races)
        luigi: { rim: 'krom' }, // locked for luigi
      },
    });

    expect(sanitized.carUsage?.mcqueen?.races).toBe(5);
    expect(sanitized.cosmetics?.mcqueen?.rim).toBe('putih-rally');
    expect(sanitized.cosmetics?.mcqueen?.glass).toBeUndefined();
    expect(sanitized.cosmetics?.luigi).toBeUndefined();
  });

  it('merges carUsage with max per field during cloud sync and keeps unlocked cosmetics', () => {
    const local = normalizeSave({
      ...defaultSave(),
      carUsage: { mcqueen: { races: 5, laps: 10, podiums: 1, driftSeconds: 10, cleanLaps: 2 } },
      cosmetics: { mcqueen: { rim: 'putih-rally' } },
    });
    const remote = normalizeSave({
      ...defaultSave(),
      carUsage: { mcqueen: { races: 2, laps: 14, podiums: 3, driftSeconds: 25, cleanLaps: 5 } },
      cosmetics: { mcqueen: { glass: 'cermin' } },
    });

    const merged = mergeSaves(local, 100, remote, 200);
    expect(merged.carUsage?.mcqueen).toEqual({
      races: 5,
      laps: 14,
      podiums: 3,
      driftSeconds: 25,
      cleanLaps: 5,
    });
    expect(merged.cosmetics?.mcqueen?.glass).toBe('cermin');
    expect(isRimUnlocked('mcqueen', 'putih-rally', merged)).toBe(true);
  });

  it('applies rim and glass cosmetics onto base car palette without mutating base', () => {
    const base = getCarPalette('mcqueen', 0);
    const updated = applyCosmetics(base, { rim: 'putih-rally', glass: 'biru-laut' });
    expect(updated.glass).toBe('#2c6fb0');
    expect(updated.rim).toEqual({ color: '#f4f1ea', style: 'spoke' });
    expect(base.rim).toBeUndefined();
  });
});
