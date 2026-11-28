import { describe, expect, it } from 'vitest';
import {
  ACCESSORIES,
  accessoriesForCar,
  getAccessory,
  isAccessoryAvailable,
  isExclusive,
} from '../src/game/data/accessories';
import { CAR_COLORS, CAR_ORDER, CARS, deriveCarRole, getCarPalette } from '../src/game/data/cars';
import { applyCosmetics, carHasGlass } from '../src/game/data/cosmetics';
import { applyCarUsage, describeRequirement, getUsage, isAccessoryUnlocked, isGlassUnlocked, isRimUnlocked } from '../src/game/garage';
import { ACCESSORY_ANCHORS, ACCESSORY_BUILDERS } from '../src/game/render3d/accessories';
import { GREENHOUSE } from '../src/game/render3d/greenhouse';
import { mergeSaves } from '../src/game/auth/sync';
import { isCarUnlocked, isGarageUnlocked, unlocksBetween, xpForLevel } from '../src/game/progression';
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
      wins: 0,
      wetRaces: 0,
    });
    expect(merged.cosmetics?.mcqueen?.glass).toBe('cermin');
    expect(isRimUnlocked('mcqueen', 'putih-rally', merged)).toBe(true);
  });

  it('applies rim, glass, and accessory cosmetics onto base car palette without mutating base', () => {
    const base = getCarPalette('mcqueen', 0);
    const updated = applyCosmetics(base, { rim: 'putih-rally', glass: 'biru-laut' }, { rear: 'lightning-wing', roof: 'antenna-flag' });
    expect(updated.glass).toBe('#2c6fb0');
    expect(updated.rim).toEqual({ color: '#f4f1ea', style: 'spoke' });
    expect(updated.accessories).toEqual(['antenna-flag', 'lightning-wing']);
    expect(base.rim).toBeUndefined();
    expect(base.accessories).toBeUndefined();
  });

  it('keeps francesco without custom glass tints and limits its accessories to exclusive F1 items', () => {
    expect(carHasGlass('francesco')).toBe(false);
    expect(isGlassUnlocked('francesco', 'asap', { carUsage: { francesco: { races: 10, laps: 30, podiums: 5, driftSeconds: 100, cleanLaps: 10, wins: 5, wetRaces: 2 } } })).toBe(false);

    const francescoItems = accessoriesForCar('francesco');
    expect(francescoItems.map((i) => i.id)).toEqual(['halo', 'double-wing', 'front-flaps', 'sidepod-fins']);
    expect(francescoItems.every((i) => isExclusive(i))).toBe(true);
  });

  it('tracks wins and wetRaces, unlocks accessories per car, and maps all catalog items to 3D builders', () => {
    for (const def of ACCESSORIES) {
      expect(ACCESSORY_BUILDERS[def.builder], `missing builder for ${def.id}`).toBeDefined();
    }
    for (const carId of CAR_ORDER) {
      expect(accessoriesForCar(carId).length).toBeGreaterThan(0);
    }
    const fog = getAccessory('fog-lights');
    expect(fog?.cars.mcqueen).toEqual({ kind: 'races', count: 4 });
    expect(fog?.cars.sally).toEqual({ kind: 'races', count: 3 });

    let save = defaultSave();
    // 2 wins on MCQUEEN unlocks Knalpot Samping (side-exhaust) for MCQUEEN only
    save = applyCarUsage(save, makeFinishedRace()).save;
    const win2 = applyCarUsage(save, makeFinishedRace());
    save = win2.save;
    expect(getUsage(save, 'mcqueen').wins).toBe(2);
    expect(isAccessoryUnlocked('mcqueen', 'side-exhaust', save)).toBe(true);
    expect(isAccessoryUnlocked('luigi', 'side-exhaust', save)).toBe(false);
    expect(win2.unlocked?.items).toContainEqual({ kind: 'accessory', label: 'Knalpot Samping' });

    // 3 wet races on MATER unlocks Ember Karatan (rusty-bucket)
    const materRace = (weather: 'clear' | 'rain' | 'dynamic') =>
      makeFinishedRace({
        weather,
        results: [
          { id: 'player', label: 'Pemain', carId: 'mater', number: 51, isPlayer: true, position: 2, timeMs: 65_000, bestLapMs: 21_000 },
          { id: 'ai-1', label: 'Bot', carId: 'doc', number: 51, isPlayer: false, position: 1, timeMs: 64_000, bestLapMs: 20_500 },
        ],
      });
    save = applyCarUsage(save, materRace('rain')).save;
    save = applyCarUsage(save, materRace('dynamic')).save;
    save = applyCarUsage(save, materRace('clear')).save;
    expect(getUsage(save, 'mater').wetRaces).toBe(2);
    expect(isAccessoryUnlocked('mater', 'rusty-bucket', save)).toBe(false);
    save = applyCarUsage(save, materRace('rain')).save;
    expect(getUsage(save, 'mater').wetRaces).toBe(3);
    expect(isAccessoryUnlocked('mater', 'rusty-bucket', save)).toBe(true);
    expect(describeRequirement({ kind: 'wetRaces', count: 3 }, 'MATER')).toContain('saat hujan');
  });

  it('sanitizes invalid, locked, mismatched-slot accessories and merges newer cloud accessories', () => {
    const sanitized = normalizeSave({
      selectedCarId: 'mcqueen',
      carUsage: {
        mcqueen: { races: 4, laps: 12, podiums: 1, driftSeconds: 10, cleanLaps: 2, wins: 2, wetRaces: 0 },
      },
      accessories: {
        mcqueen: {
          roof: 'antenna-flag', // unlocked (races 3)
          front: 'hood-scoop', // locked (races 12)
          rear: 'fog-lights', // wrong slot (fog-lights is front)
          side: 'side-exhaust', // unlocked (wins 2)
        },
        francesco: {
          front: 'fog-lights', // not available on francesco
        },
      },
    });

    expect(isAccessoryAvailable('mcqueen', 'antenna-flag')).toBe(true);
    expect(sanitized.accessories?.mcqueen).toEqual({
      roof: 'antenna-flag',
      side: 'side-exhaust',
    });
    expect(sanitized.accessories?.francesco).toBeUndefined();

    const older = normalizeSave({
      ...defaultSave(),
      carUsage: { mcqueen: { races: 4, laps: 12, podiums: 1, driftSeconds: 10, cleanLaps: 2, wins: 1, wetRaces: 1 } },
      accessories: { mcqueen: { roof: 'antenna-flag' } },
    });
    const newer = normalizeSave({
      ...defaultSave(),
      carUsage: { mcqueen: { races: 2, laps: 5, podiums: 0, driftSeconds: 5, cleanLaps: 1, wins: 2, wetRaces: 2 } },
      accessories: { mcqueen: { side: 'side-exhaust' } },
    });
    const merged = mergeSaves(older, 100, newer, 200);
    expect(merged.carUsage?.mcqueen).toEqual({
      races: 4,
      laps: 12,
      podiums: 1,
      driftSeconds: 10,
      cleanLaps: 2,
      wins: 2,
      wetRaces: 2,
    });
    expect(merged.accessories?.mcqueen).toEqual({ side: 'side-exhaust' });
  });

  it('registers all 15 cars across stats, colors, 3D greenhouse/anchors, role labels, and staggered unlocks', () => {
    expect(CAR_ORDER).toHaveLength(15);
    for (const id of CAR_ORDER) {
      expect(CARS[id]).toBeDefined();
      expect(CAR_COLORS[id]).toHaveLength(4);
      expect(ACCESSORY_ANCHORS[id]).toBeDefined();
      expect(id in GREENHOUSE).toBe(true);
      expect(deriveCarRole(CARS[id]).length).toBeGreaterThan(0);
    }

    expect(deriveCarRole(CARS.mcqueen)).toBe('Balance');
    expect(deriveCarRole(CARS.ramone)).toBe('Drifter');
    expect(deriveCarRole(CARS.fillmore)).toBe('Mudah Dikuasai');
    expect(deriveCarRole(CARS.shu)).toBe('Grip Tinggi');
    expect(deriveCarRole(CARS.king)).toBe('Top Speed Tinggi');

    expect(isCarUnlocked('ramone', { xp: xpForLevel(14) })).toBe(false);
    expect(isCarUnlocked('ramone', { xp: xpForLevel(15) })).toBe(true);
    expect(isCarUnlocked('fillmore', { xp: xpForLevel(17) })).toBe(true);
    expect(isCarUnlocked('finn', { xp: xpForLevel(19) })).toBe(true);
    expect(isCarUnlocked('shu', { xp: xpForLevel(21) })).toBe(true);
    expect(isCarUnlocked('king', { xp: xpForLevel(23) })).toBe(false);
    expect(isCarUnlocked('king', { xp: xpForLevel(24) })).toBe(true);

    const gated = normalizeSave({ version: 2, selectedCarId: 'king', xp: 0 });
    expect(gated.selectedCarId).toBe('mcqueen');
  });
});
