import type { AccessorySlot, CarCosmetics, CarId, CarPalette, CarUsage, RimStyle, SaveData } from '../types';

export type { RimStyle };

export type CosmeticRequirement =
  | { kind: 'free' }
  | { kind: 'races'; count: number }
  | { kind: 'laps'; count: number }
  | { kind: 'podiums'; count: number }
  | { kind: 'drift'; seconds: number }
  | { kind: 'cleanLaps'; count: number }
  | { kind: 'wins'; count: number }
  | { kind: 'wetRaces'; count: number };

export interface RimDef {
  id: string;
  label: string;
  color: string;
  style: RimStyle;
  req: CosmeticRequirement;
}

export interface GlassDef {
  id: string;
  label: string;
  color: string;
  glint?: number;
  req: CosmeticRequirement;
}

export const RIMS: RimDef[] = [
  { id: 'baja', label: 'Baja', color: '#9aa4b0', style: 'disc', req: { kind: 'free' } },
  { id: 'krom', label: 'Krom', color: '#e8ecf0', style: 'disc', req: { kind: 'races', count: 3 } },
  { id: 'putih-rally', label: 'Putih Rally', color: '#f4f1ea', style: 'spoke', req: { kind: 'races', count: 5 } },
  { id: 'merah-sport', label: 'Merah Sport', color: '#e0322b', style: 'spoke', req: { kind: 'podiums', count: 3 } },
  { id: 'gunmetal', label: 'Gunmetal', color: '#3b4452', style: 'spoke', req: { kind: 'races', count: 8 } },
  { id: 'emas', label: 'Emas', color: '#e8b83a', style: 'dish', req: { kind: 'races', count: 12 } },
  { id: 'neon-cyan', label: 'Neon Cyan', color: '#38d6ff', style: 'dish', req: { kind: 'drift', seconds: 60 } },
];

export const GLASSES: GlassDef[] = [
  { id: 'asap', label: 'Asap', color: '#12171e', glint: 0.7, req: { kind: 'races', count: 2 } },
  { id: 'biru-laut', label: 'Biru Laut', color: '#2c6fb0', req: { kind: 'races', count: 4 } },
  { id: 'amber', label: 'Amber', color: '#c98a2b', req: { kind: 'races', count: 7 } },
  { id: 'hijau-botol', label: 'Hijau Botol', color: '#2f8f5e', req: { kind: 'laps', count: 10 } },
  { id: 'cermin', label: 'Cermin', color: '#a8bccb', glint: 1.4, req: { kind: 'cleanLaps', count: 5 } },
  { id: 'ungu-malam', label: 'Ungu Malam', color: '#6a4bb5', req: { kind: 'races', count: 15 } },
];

const SLOT_ORDER: AccessorySlot[] = ['roof', 'front', 'rear', 'side'];

export function carHasGlass(carId: CarId): boolean {
  return carId !== 'francesco';
}

export function getRim(id: string | undefined): RimDef | undefined {
  if (!id) return undefined;
  return RIMS.find((item) => item.id === id);
}

export function getGlass(id: string | undefined): GlassDef | undefined {
  if (!id) return undefined;
  return GLASSES.find((item) => item.id === id);
}

export function emptyUsage(): CarUsage {
  return {
    races: 0,
    laps: 0,
    podiums: 0,
    driftSeconds: 0,
    cleanLaps: 0,
    wins: 0,
    wetRaces: 0,
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
    wins: raw.wins ?? 0,
    wetRaces: raw.wetRaces ?? 0,
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
    case 'wins':
      return { current: Math.min(req.count, usage.wins), target: req.count, done: usage.wins >= req.count };
    case 'wetRaces':
      return { current: Math.min(req.count, usage.wetRaces), target: req.count, done: usage.wetRaces >= req.count };
  }
}

export function collectAccessoryIds(
  accessories?: Partial<Record<AccessorySlot, string>> | string[],
): string[] {
  if (!accessories) return [];
  if (Array.isArray(accessories)) {
    return Array.from(new Set(accessories.filter((id) => typeof id === 'string' && id.length > 0)));
  }
  const out: string[] = [];
  for (const slot of SLOT_ORDER) {
    const id = accessories[slot];
    if (typeof id === 'string' && id.length > 0 && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}

export function applyCosmetics(
  palette: CarPalette,
  cosmetics?: CarCosmetics,
  accessories?: Partial<Record<AccessorySlot, string>> | string[],
): CarPalette {
  const rim = cosmetics ? getRim(cosmetics.rim) : undefined;
  const glass = cosmetics ? getGlass(cosmetics.glass) : undefined;
  const accessoryIds = collectAccessoryIds(accessories);
  if (!rim && !glass && accessoryIds.length === 0) return palette;
  return {
    ...palette,
    glass: glass?.color ?? palette.glass,
    rim: rim ? { color: rim.color, style: rim.style } : undefined,
    glassGlint: glass?.glint ?? palette.glassGlint,
    accessories: accessoryIds.length > 0 ? accessoryIds : undefined,
  };
}
