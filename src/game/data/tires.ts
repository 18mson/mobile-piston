import type { TireId } from '../types';

export interface TireSpec {
  id: TireId;
  name: string;
  kind: string;
  blurb: string;
  /** Lateral-grip multiplier on a dry road */
  dryGrip: number;
  /** Fraction of grip lost on a fully wet road (0.3 = 30% less grip) */
  wetLoss: number;
  /** Multiplier on top speed */
  topSpeed: number;
  /** Scales how much grip, power and speed are lost on grass/dirt (1 = normal, 0.45 = copes much better) */
  offroadPenalty: number;
}

/**
 * Tyres can be fitted to any car. Each one trades dry grip against wet grip or off-road ability:
 * with wetness w (0..1) the grip multiplier is dryGrip * (1 - wetLoss * w).
 *   standard: 1.00 dry, 0.70 fully wet
 *   grip    : 1.07 dry, 0.58 fully wet   (best when dry, bad in the rain)
 *   rain    : 0.93 dry, 0.84 fully wet   (best when wet, a little slow when dry)
 *   terrain : 0.96 dry, 0.77 fully wet   (copes with grass and dirt)
 */
export const TIRES: Record<TireId, TireSpec> = {
  standard: {
    id: 'standard',
    name: 'STANDAR',
    kind: 'Serba bisa',
    blurb: 'Ban bawaan. Tidak ada kelebihan, tidak ada kelemahan besar.',
    dryGrip: 1,
    wetLoss: 0.3,
    topSpeed: 1,
    offroadPenalty: 1,
  },
  grip: {
    id: 'grip',
    name: 'GRIP',
    kind: 'Aspal kering',
    blurb: 'Lengket di aspal kering dan sedikit lebih kencang, tapi licin sekali di jalan basah.',
    dryGrip: 1.07,
    wetLoss: 0.46,
    topSpeed: 1.008,
    offroadPenalty: 1.2,
  },
  rain: {
    id: 'rain',
    name: 'HUJAN',
    kind: 'Jalan basah',
    blurb: 'Alur dalam yang menjaga cengkeraman di jalan basah. Sedikit lebih licin dan lambat saat kering.',
    dryGrip: 0.93,
    wetLoss: 0.1,
    topSpeed: 0.985,
    offroadPenalty: 1,
  },
  terrain: {
    id: 'terrain',
    name: 'TANAH',
    kind: 'Semua medan',
    blurb: 'Bergerigi untuk rumput dan tanah. Tidak banyak kehilangan tenaga di luar aspal, tapi kalah di aspal kering.',
    dryGrip: 0.96,
    wetLoss: 0.2,
    topSpeed: 0.985,
    offroadPenalty: 0.45,
  },
};

export const TIRE_ORDER: TireId[] = ['standard', 'grip', 'rain', 'terrain'];

export function getTire(id: TireId | undefined): TireSpec {
  return TIRES[id ?? 'standard'] ?? TIRES.standard;
}

/** Grip multiplier a tyre gives at a given road wetness. */
export function tireGripMultiplier(tire: TireSpec, wetness: number): number {
  const w = Math.min(1, Math.max(0, wetness));
  return tire.dryGrip * (1 - tire.wetLoss * w);
}
