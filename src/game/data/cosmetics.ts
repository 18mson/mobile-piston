import type { CarCosmetics, CarPalette, RimStyle } from '../types';

export type { RimStyle };

export type CosmeticRequirement =
  | { kind: 'free' }
  | { kind: 'races'; count: number }
  | { kind: 'laps'; count: number }
  | { kind: 'podiums'; count: number }
  | { kind: 'drift'; seconds: number }
  | { kind: 'cleanLaps'; count: number };

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

export function getRim(id: string | undefined): RimDef | undefined {
  if (!id) return undefined;
  return RIMS.find((item) => item.id === id);
}

export function getGlass(id: string | undefined): GlassDef | undefined {
  if (!id) return undefined;
  return GLASSES.find((item) => item.id === id);
}

export function applyCosmetics(palette: CarPalette, cosmetics?: CarCosmetics): CarPalette {
  if (!cosmetics) return palette;
  const rim = getRim(cosmetics.rim);
  const glass = getGlass(cosmetics.glass);
  if (!rim && !glass) return palette;
  return {
    ...palette,
    glass: glass?.color ?? palette.glass,
    rim: rim ? { color: rim.color, style: rim.style } : undefined,
    glassGlint: glass?.glint ?? palette.glassGlint,
  };
}
