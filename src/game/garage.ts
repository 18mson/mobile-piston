import { ACCESSORIES, isAccessoryUnlocked } from './data/accessories';
import {
  type CosmeticRequirement,
  GLASSES,
  RIMS,
  carHasGlass,
  emptyUsage,
  getGlass,
  getRim,
  getUsage,
  requirementProgress,
} from './data/cosmetics';
import { CARS } from './data/cars';
import type { CosmeticUnlockItem, CosmeticUnlockSummary } from './progression';
import type { CarId, CarUsage, RaceResults, SaveData } from './types';

export const MAX_CAR_USAGE_STAT = 100_000;

export { emptyUsage, getUsage, requirementProgress, isAccessoryUnlocked };

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
    case 'wins':
      return `Menang ${req.count} balapan dengan ${carName}`;
    case 'wetRaces':
      return `Finis ${req.count} balapan saat hujan dengan ${carName}`;
  }
}

export function isRimUnlocked(carId: CarId, rimId: string, save: Pick<SaveData, 'carUsage'>): boolean {
  const def = getRim(rimId);
  if (!def) return false;
  return requirementProgress(def.req, getUsage(save, carId)).done;
}

export function isGlassUnlocked(carId: CarId, glassId: string, save: Pick<SaveData, 'carUsage'>): boolean {
  if (!carHasGlass(carId)) return false;
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
  const hasOpponents = results.results.length >= 2;
  const podiumHit = playerRow.position <= 3 && hasOpponents ? 1 : 0;
  const winHit = playerRow.position === 1 && hasOpponents ? 1 : 0;
  const wetHit = results.weather === 'rain' || results.weather === 'dynamic' ? 1 : 0;

  const nextUsage: CarUsage = {
    races: clampStat(prevUsage.races + 1),
    laps: clampStat(prevUsage.laps + Math.max(0, Math.floor(stats?.lapsCompleted ?? 0))),
    podiums: clampStat(prevUsage.podiums + podiumHit),
    driftSeconds: clampStat(prevUsage.driftSeconds + Math.max(0, Math.floor(stats?.driftSeconds ?? 0))),
    cleanLaps: clampStat(prevUsage.cleanLaps + Math.max(0, Math.floor(stats?.cleanLaps ?? 0))),
    wins: clampStat(prevUsage.wins + winHit),
    wetRaces: clampStat(prevUsage.wetRaces + wetHit),
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
  if (carHasGlass(carId)) {
    for (const glass of GLASSES) {
      const wasUnlocked = requirementProgress(glass.req, prevUsage).done;
      const nowUnlocked = requirementProgress(glass.req, nextUsage).done;
      if (!wasUnlocked && nowUnlocked) {
        items.push({ kind: 'glass', label: `Kaca ${glass.label}` });
      }
    }
  }
  for (const accessory of ACCESSORIES) {
    const req = accessory.cars[carId];
    if (!req) continue;
    const wasUnlocked = requirementProgress(req, prevUsage).done;
    const nowUnlocked = requirementProgress(req, nextUsage).done;
    if (!wasUnlocked && nowUnlocked) {
      items.push({ kind: 'accessory', label: accessory.label });
    }
  }

  return {
    save: nextSave,
    unlocked: items.length > 0 ? { carId, items } : null,
  };
}
