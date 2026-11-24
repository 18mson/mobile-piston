import type { Track } from '../types';
import { buildTrack } from './geometry';

export const MATA_AIR_ROAD_WIDTH = 160;
export const MATA_AIR_SHOULDER_WIDTH = 22;

export const MATA_AIR: Track = buildTrack({
  id: 'mata-air',
  name: 'MATA AIR',
  subtitle: 'Lingkar sempit di sekitar danau kecil, dikelilingi kebun palem.',
  worldWidth: 2400,
  worldHeight: 1600,
  width: MATA_AIR_ROAD_WIDTH,
  shoulder: MATA_AIR_SHOULDER_WIDTH,
  points: [
    { x: 790, y: 1120 },
    { x: 810, y: 960 },
    { x: 920, y: 830 },
    { x: 1100, y: 780 },
    { x: 1300, y: 800 },
    { x: 1440, y: 920 },
    { x: 1480, y: 1080 },
    { x: 1370, y: 1190 },
    { x: 1170, y: 1210 },
    { x: 970, y: 1180 },
    { x: 830, y: 1110 },
  ],
  startPoint: { x: 1140, y: 1205 },
  startHeading: Math.PI,
  gridSlots: [
    { distance: -44, lateral: -24 },
    { distance: -44, lateral: 24 },
    { distance: -80, lateral: -24 },
    { distance: -80, lateral: 24 },
    { distance: -116, lateral: -24 },
    { distance: -116, lateral: 24 },
  ],
  boostPadFractions: [
    { fraction: 0.2, lateral: -16, length: 40 },
    { fraction: 0.56, lateral: 18, length: 40 },
    { fraction: 0.82, lateral: 0, length: 40 },
  ],
  attract: { fraction: 0.94, offsetX: -120, offsetY: -90 },
  light: { color: '#ff9a46', alpha: 0.055 },
});
