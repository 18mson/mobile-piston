import type { Track } from '../types';
import { buildTrack } from './geometry';

export const WORLD_WIDTH = 3360;
export const WORLD_HEIGHT = 2240;

export const TELUK_SORE_ROAD_WIDTH = 176;
export const TELUK_SORE_SHOULDER_WIDTH = 24;

export const TELUK_SORE: Track = buildTrack({
  id: 'teluk-sore',
  name: 'TELUK SORE',
  subtitle: 'Pesisir panjang, kebun palem, dan satu tanjung mercusuar.',
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
  width: TELUK_SORE_ROAD_WIDTH,
  shoulder: TELUK_SORE_SHOULDER_WIDTH,
  points: [
    { x: 644, y: 1659 },
    { x: 1064, y: 1694 },
    { x: 1512, y: 1680 },
    { x: 1890, y: 1673 },
    { x: 2212, y: 1610 },
    { x: 2492, y: 1484 },
    { x: 2590, y: 1260 },
    { x: 2548, y: 1050 },
    { x: 2380, y: 896 },
    { x: 2114, y: 840 },
    { x: 1862, y: 896 },
    { x: 1652, y: 1008 },
    { x: 1400, y: 980 },
    { x: 1190, y: 868 },
    { x: 980, y: 952 },
    { x: 868, y: 1162 },
    { x: 826, y: 1372 },
    { x: 672, y: 1526 },
  ],
  startPoint: { x: 1512, y: 1680 },
  startHeading: 0,
  attract: { fraction: 0.4, offsetX: 34, offsetY: -104 },
  light: null,
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
    { fraction: 0.16, lateral: -18, length: 44 },
    { fraction: 0.42, lateral: 20, length: 44 },
    { fraction: 0.68, lateral: 0, length: 44 },
    { fraction: 0.88, lateral: -14, length: 44 },
  ],
});

export const COASTLINE: { x: number; y: number }[] = [
  { x: 0, y: 707 },
  { x: 154, y: 637 },
  { x: 350, y: 675 },
  { x: 504, y: 588 },
  { x: 728, y: 622 },
  { x: 924, y: 549 },
  { x: 1148, y: 599 },
  { x: 1372, y: 535 },
  { x: 1596, y: 605 },
  { x: 1820, y: 552 },
  { x: 2044, y: 647 },
  { x: 2296, y: 580 },
  { x: 2534, y: 641 },
  { x: 2772, y: 731 },
  { x: 2954, y: 834 },
  { x: 3136, y: 910 },
  { x: 3360, y: 966 },
  { x: 3360, y: 0 },
  { x: 0, y: 0 },
];
