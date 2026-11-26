import type { Track } from '../types';
import { buildTrack } from './geometry';

export const PELABUHAN_ROAD_WIDTH = 160;
export const PELABUHAN_SHOULDER_WIDTH = 22;

/**
 * SIRKUIT PELABUHAN - fast harbour circuit.
 * Two long straights (the dock and the quay) with big braking zones: a fast right at the end of the dock,
 * a container-yard chicane, a tight right onto the bottom straight, a hard corner at its end, an S-chicane
 * on the west side and a fast final corner. Carrying full speed into the heavy braking zones without
 * braking ends in a slide or a spin, but a clean exit gives a big straight-line speed advantage.
 */
export const PELABUHAN: Track = buildTrack({
  id: 'pelabuhan',
  name: 'SIRKUIT PELABUHAN',
  subtitle: 'Sirkuit dermaga panjang: lurusan cepat, chicane kontainer, hairpin dermaga, S-curve, dan tikungan ganda.',
  worldWidth: 4200,
  worldHeight: 2800,
  width: PELABUHAN_ROAD_WIDTH,
  shoulder: PELABUHAN_SHOULDER_WIDTH,
  points: [
    // Main dock straight (west -> east)
    { x: 660, y: 620 },
    { x: 1020, y: 620 },
    { x: 1420, y: 620 },
    { x: 1820, y: 620 },
    { x: 2180, y: 620 },
    // Fast harbour sweeper into container-yard chicane
    { x: 2560, y: 680 },
    { x: 2860, y: 880 },
    { x: 3160, y: 740 },
    { x: 3480, y: 880 },
    { x: 3660, y: 1200 },
    // East quay straight into heavy-braking hairpin
    { x: 3660, y: 1580 },
    { x: 3620, y: 1960 },
    { x: 3420, y: 2220 },
    { x: 3080, y: 2200 },
    { x: 2860, y: 1900 },
    // Mid-harbour technical S-curves
    { x: 2600, y: 1600 },
    { x: 2240, y: 1640 },
    { x: 1980, y: 2040 },
    { x: 1640, y: 2240 },
    // South pier back straight (east -> west)
    { x: 1240, y: 2240 },
    { x: 820, y: 2240 },
    // West crane double-apex bend & fast final corner
    { x: 480, y: 2060 },
    { x: 420, y: 1720 },
    { x: 680, y: 1440 },
    { x: 440, y: 1120 },
    { x: 440, y: 800 },
  ],
  startPoint: { x: 1180, y: 620 },
  startHeading: 0,
  attract: { fraction: 0.08, offsetX: 34, offsetY: -104 },
  gridSlots: [
    { distance: -44, lateral: -26 },
    { distance: -44, lateral: 26 },
    { distance: -80, lateral: -26 },
    { distance: -80, lateral: 26 },
    { distance: -116, lateral: -26 },
    { distance: -116, lateral: 26 },
  ],
  boostPadFractions: [
    { fraction: 0.08, lateral: -16, length: 44 },
    { fraction: 0.29, lateral: 16, length: 44 },
    { fraction: 0.51, lateral: 0, length: 44 },
    { fraction: 0.72, lateral: -18, length: 44 },
    { fraction: 0.89, lateral: 14, length: 44 },
  ],
});
