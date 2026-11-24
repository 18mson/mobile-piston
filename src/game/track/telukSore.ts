import type { Track } from '../types';
import { buildTrack } from './geometry';

export const WORLD_WIDTH = 2400;
export const WORLD_HEIGHT = 1600;

export const TELUK_SORE_ROAD_WIDTH = 176;
export const TELUK_SORE_SHOULDER_WIDTH = 24;

export const TELUK_SORE: Track = buildTrack({
  id: 'teluk-sore',
  name: 'TELUK SORE',
  subtitle: 'Pesisir, kebun palem, dan satu tanjung mercusuar.',
  worldWidth: WORLD_WIDTH,
  worldHeight: WORLD_HEIGHT,
  width: TELUK_SORE_ROAD_WIDTH,
  shoulder: TELUK_SORE_SHOULDER_WIDTH,
  points: [
    { x: 460, y: 1185 },
    { x: 760, y: 1210 },
    { x: 1080, y: 1200 },
    { x: 1350, y: 1195 },
    { x: 1580, y: 1150 },
    { x: 1780, y: 1060 },
    { x: 1850, y: 900 },
    { x: 1820, y: 750 },
    { x: 1700, y: 640 },
    { x: 1510, y: 600 },
    { x: 1330, y: 640 },
    { x: 1180, y: 720 },
    { x: 1000, y: 700 },
    { x: 850, y: 620 },
    { x: 700, y: 680 },
    { x: 620, y: 830 },
    { x: 590, y: 980 },
    { x: 480, y: 1090 },
  ],
  startPoint: { x: 1080, y: 1200 },
  startHeading: 0,
  attract: { fraction: 0.4, offsetX: 34, offsetY: -104 },
  light: null,
  gridSlots: [
    { distance: -54, lateral: -32 },
    { distance: -54, lateral: 32 },
    { distance: -90, lateral: -32 },
    { distance: -90, lateral: 32 },
    { distance: -126, lateral: -32 },
    { distance: -126, lateral: 32 },
  ],
  boostPadFractions: [
    { fraction: 0.2, lateral: -18, length: 44 },
    { fraction: 0.52, lateral: 20, length: 44 },
    { fraction: 0.8, lateral: 0, length: 44 },
  ],
});

export const COASTLINE: { x: number; y: number }[] = [
  { x: 0, y: 505 },
  { x: 110, y: 455 },
  { x: 250, y: 482 },
  { x: 360, y: 420 },
  { x: 520, y: 444 },
  { x: 660, y: 392 },
  { x: 820, y: 428 },
  { x: 980, y: 382 },
  { x: 1140, y: 432 },
  { x: 1300, y: 394 },
  { x: 1460, y: 462 },
  { x: 1640, y: 414 },
  { x: 1810, y: 458 },
  { x: 1980, y: 522 },
  { x: 2110, y: 596 },
  { x: 2240, y: 650 },
  { x: 2400, y: 690 },
  { x: 2400, y: 0 },
  { x: 0, y: 0 },
];
