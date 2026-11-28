import type { CarId } from '../types';

export interface GreenhouseSplit {
  /** Normalized position 0..1 from front to rear of the greenhouse loft. */
  at: number;
  /** Physical width of the pillar slice in world X units. */
  width: number;
}

export interface GreenhouseSpec {
  splits: GreenhouseSplit[];
  pillar: 'body' | 'shade' | 'darkTrim';
}

/**
 * Per-car greenhouse pillar layout. `null` leaves open-cockpit / minimal-cab cars intact.
 */
export const GREENHOUSE: Record<CarId, GreenhouseSpec | null> = {
  mcqueen: {
    splits: [{ at: 0.62, width: 0.16 }],
    pillar: 'body',
  },
  luigi: {
    splits: [{ at: 0.56, width: 0.11 }],
    pillar: 'body',
  },
  guido: null,
  sally: {
    splits: [{ at: 0.64, width: 0.14 }],
    pillar: 'body',
  },
  chick: {
    splits: [
      { at: 0.44, width: 0.11 },
      { at: 0.68, width: 0.14 },
    ],
    pillar: 'body',
  },
  mater: {
    // Upright single-window pickup cab: front/rear frame & rails, no center B-pillar
    splits: [],
    pillar: 'body',
  },
  doc: {
    splits: [
      { at: 0.46, width: 0.11 },
      { at: 0.72, width: 0.14 },
    ],
    pillar: 'body',
  },
  cruz: {
    splits: [{ at: 0.62, width: 0.15 }],
    pillar: 'body',
  },
  francesco: null,
  storm: {
    splits: [{ at: 0.60, width: 0.15 }],
    pillar: 'body',
  },
};
