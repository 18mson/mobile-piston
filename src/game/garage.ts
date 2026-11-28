import type { CosmeticRequirement } from './data/cosmetics';
import { GLASSES, RIMS, getGlass, getRim } from './data/cosmetics';
import { CARS } from './data/cars';
import type { CosmeticUnlockItem, CosmeticUnlockSummary } from './progression';
import type { CarId, CarUsage, RaceResults, SaveData } from './types';

export const MAX_CAR_USAGE_STAT = 100_000;

export function emptyUsage(): CarUsage {
  return {
    races: 0,
    laps: 0,
    podiums: 0,
    driftSeconds: 0,
    cleanLaps: 0,
  };
}

export function getUsage(save: Pick<SaveData, 'carUsage'>, carId: CarId): CarUsage {
  const raw = save.carUsage?.[carId];
  if (!raw) return emptyUsage();
  return {
    races: raw.races ?? 0,
    laps: raw.laps ?? 0,
    podiums: raw.podiums ?? 0,
    driftSeconds: raw.driftSeconds ?? 0,
    cleanLaps: raw.cleanLaps ?? 0,
  };
}

export function requirementProgress(
  req: CosmeticRequirement,
  usage: CarUsage,
): { current: number; target: number; done: boolean } {
  switch (req.kind) {
    case 'free':
      return { current: 1, target: 1, done: true };
    case 'races':
      return { current: Math.min(req.count, usage.races), target: req.count, done: usage.races >= req.count };
    case 'laps':
      return { current: Math.min(req.count, usage.laps), target: req.count, done: usage.laps >= req.count };
    case 'podiums':
      return { current: Math.min(req.count, usage.podiums), target: req.count, done: usage.podiums >= req.count };
    case 'drift':
      return {
        current: Math.min(req.seconds, usage.driftSeconds),
        target: req.seconds,
        done: usage.driftSeconds >= req.seconds,
      };
    case 'cleanLaps':
      return { current: Math.min(req.count, usage.cleanLaps), target: req.count, done: usage.cleanLaps >= req.count };
  }
}

export function describeRequirement(req: CosmeticRequirement, carName: string): string {
  switch (req.kind) {
    case 'free':
      return `Tersedia bawaan untuk ${carName}`;
    case 'races':
      return `Finis ${req.count} balapan dengan ${carName}`;
    case 'laps':
      return `Selesaikan ${req.count} putaran dengan ${carName}`;
    case 'podiums':
      return `Finis podium P1-P3 ${req.count} kali dengan ${carName}`;
    case 'drift':
      return `Drift ${req.seconds} detik dengan ${carName}`;
    case 'cleanLaps':
      return `Selesaikan ${req.count} putaran bersih dengan ${carName}`;
  }
}

export function isRimUnlocked(carId: CarId, rimId: string, save: Pick<SaveData, 'carUsage'>): boolean {
  const def = getRim(rimId);
  if (!def) return false;
  return requirementProgress(def.req, getUsage(save, carId)).done;
}

export function isGlassUnlocked(carId: CarId, glassId: string, save: Pick<SaveData, 'carUsage'>): boolean {
  const def = getGlass(glassId);
  if (!def) return false;
  return requirementProgress(def.req, getUsage(save, carId)).done;
}

function clampStat(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_CAR_USAGE_STAT, Math.floor(value));
}

export function applyCarUsage(
  save: SaveData,
  results: RaceResults,
): { save: SaveData; unlocked: CosmeticUnlockSummary | null } {
  const playerRow = results.results.find((row) => row.isPlayer);
  if (!playerRow || playerRow.timeMs == null) {
    return { save, unlocked: null };
  }

  const carId = playerRow.carId;
  if (!CARS[carId]) {
    return { save, unlocked: null };
  }

  const prevUsage = getUsage(save, carId);
  const stats = results.stats;
  const podiumHit = playerRow.position <= 3 && results.results.length >= 2 ? 1 : 0;

  const nextUsage: CarUsage = {
    races: clampStat(prevUsage.races + 1),
    laps: clampStat(prevUsage.laps + Math.max(0, Math.floor(stats?.lapsCompleted ?? 0))),
    podiums: clampStat(prevUsage.podiums + podiumHit),
    driftSeconds: clampStat(prevUsage.driftSeconds + Math.max(0, Math.floor(stats?.driftSeconds ?? 0))),
    cleanLaps: clampStat(prevUsage.cleanLaps + Math.max(0, Math.floor(stats?.cleanLaps ?? 0))),
  };

  const nextSave: SaveData = {
    ...save,
    carUsage: {
      ...(save.carUsage ?? {}),
      [carId]: nextUsage,
    },
  };

  const items: CosmeticUnlockItem[] = [];
  for (const rim of RIMS) {
    const wasUnlocked = requirementProgress(rim.req, prevUsage).done;
    const nowUnlocked = requirementProgress(rim.req, nextUsage).done;
    if (!wasUnlocked && nowUnlocked) {
      items.push({ kind: 'rim', label: `Velg ${rim.label}` });
    }
  }
  for (const glass of GLASSES) {
    const wasUnlocked = requirementProgress(glass.req, prevUsage).done;
    const nowUnlocked = requirementProgress(glass.req, nextUsage).done;
    if (!wasUnlocked && nowUnlocked) {
      items.push({ kind: 'glass', label: `Kaca ${glass.label}` });
    }
  }

  return {
    save: nextSave,
    unlocked: items.length > 0 ? { carId, items } : null,
  };
}
