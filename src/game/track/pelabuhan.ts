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
  worldWidth: 5040,
  worldHeight: 3360,
  width: PELABUHAN_ROAD_WIDTH,
  shoulder: PELABUHAN_SHOULDER_WIDTH,
  points: [
    // Main dock straight (west -> east)
    { x: 792, y: 744 },
    { x: 1224, y: 744 },
    { x: 1704, y: 744 },
    { x: 2184, y: 744 },
    { x: 2616, y: 744 },
    // Fast harbour sweeper into container-yard chicane
    { x: 3072, y: 816 },
    { x: 3432, y: 1056 },
    { x: 3792, y: 888 },
    { x: 4176, y: 1056 },
    { x: 4392, y: 1440 },
    // East quay straight into heavy-braking hairpin
    { x: 4392, y: 1896 },
    { x: 4344, y: 2352 },
    { x: 4104, y: 2664 },
    { x: 3696, y: 2640 },
    { x: 3432, y: 2280 },
    // Mid-harbour technical S-curves
    { x: 3120, y: 1920 },
    { x: 2688, y: 1968 },
    { x: 2376, y: 2448 },
    { x: 1968, y: 2688 },
    // South pier back straight (east -> west)
    { x: 1488, y: 2688 },
    { x: 984, y: 2688 },
    // West crane double-apex bend & fast final corner
    { x: 576, y: 2472 },
    { x: 504, y: 2064 },
    { x: 816, y: 1728 },
    { x: 528, y: 1344 },
    { x: 528, y: 960 },
  ],
  startPoint: { x: 1416, y: 744 },
  startHeading: 0,
  attract: { fraction: 0.08, offsetX: 34, offsetY: -104 },
  gridSlots: [
    { distance: -44, lateral: -26 },
    { distance: -44, lateral: 26 },
    { distance: -80, lateral: -26 },
    { distance: -80, lateral: 26 },
    { distance: -116, lateral: -26 },
    { distance: -116, lateral: 26 },
    { distance: -152, lateral: -26 },
    { distance: -152, lateral: 26 },
  ],
  boostPadFractions: [
    { fraction: 0.08, lateral: -16, length: 44 },
    { fraction: 0.29, lateral: 16, length: 44 },
    { fraction: 0.51, lateral: 0, length: 44 },
    { fraction: 0.72, lateral: -18, length: 44 },
    { fraction: 0.89, lateral: 14, length: 44 },
  ],
});
