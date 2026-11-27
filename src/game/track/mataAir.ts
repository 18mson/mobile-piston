import type { Track } from '../types';
import { buildTrack } from './geometry';

export const MATA_AIR_ROAD_WIDTH = 160;
export const MATA_AIR_SHOULDER_WIDTH = 22;

export const MATA_AIR: Track = buildTrack({
  id: 'mata-air',
  name: 'MATA AIR',
  subtitle: 'Lingkar sempit di sekitar danau kecil, dikelilingi kebun palem.',
  worldWidth: 3360,
  worldHeight: 2240,
  width: MATA_AIR_ROAD_WIDTH,
  shoulder: MATA_AIR_SHOULDER_WIDTH,
  points: [
    { x: 1020, y: 1580 },
    { x: 1050, y: 1320 },
    { x: 1220, y: 1120 },
    { x: 1500, y: 1050 },
    { x: 1780, y: 1120 },
    { x: 2040, y: 1020 },
    { x: 2240, y: 1180 },
    { x: 2260, y: 1480 },
    { x: 2060, y: 1680 },
    { x: 1740, y: 1720 },
    { x: 1380, y: 1690 },
    { x: 1120, y: 1620 },
  ],
  startPoint: { x: 1620, y: 1710 },
  startHeading: Math.PI,
  gridSlots: [
    { distance: -44, lateral: -24 },
    { distance: -44, lateral: 24 },
    { distance: -80, lateral: -24 },
    { distance: -80, lateral: 24 },
    { distance: -116, lateral: -24 },
    { distance: -116, lateral: 24 },
    { distance: -152, lateral: -24 },
    { distance: -152, lateral: 24 },
  ],
  boostPadFractions: [
    { fraction: 0.16, lateral: -16, length: 40 },
    { fraction: 0.42, lateral: 18, length: 40 },
    { fraction: 0.66, lateral: 0, length: 40 },
    { fraction: 0.88, lateral: -14, length: 40 },
  ],
  attract: { fraction: 0.94, offsetX: -120, offsetY: -90 },
  light: { color: '#ff9a46', alpha: 0.055 },
});
