import type { Track } from '../types';
import { buildTrack } from './geometry';

export const MATA_AIR: Track = buildTrack({
  id: 'mata-air',
  name: 'MATA AIR',
  subtitle: 'Lingkar sempit di sekitar danau kecil, dikelilingi kebun palem.',
  worldWidth: 2400,
  worldHeight: 1600,
  width: 88,
  shoulder: 16,
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
    { distance: -54, lateral: -18 },
    { distance: -54, lateral: 18 },
    { distance: -82, lateral: -18 },
    { distance: -82, lateral: 18 },
    { distance: -110, lateral: -18 },
    { distance: -110, lateral: 18 },
  ],
  boostPadFractions: [
    { fraction: 0.2, lateral: -6, length: 30 },
    { fraction: 0.56, lateral: 8, length: 30 },
    { fraction: 0.82, lateral: 0, length: 30 },
  ],
  attract: { fraction: 0.94, offsetX: -120, offsetY: -90 },
  light: { color: '#ff9a46', alpha: 0.055 },
});
