import { addBox, addExhaustPipe, addGreenhouse, addLoft, addProfile, addRoundLamp } from '../primitives';
import { addFlames, addHoodVinyl, addRoofNumber, addSideMirrors, addSideVinyls } from '../trimAndDecals';
import type { CarBuildContext, CarMaterials, LoftStation } from '../types';
import { addAxlePair } from '../wheels';

type MatKey = keyof Pick<CarMaterials, 'body' | 'shade' | 'stripe' | 'chrome' | 'darkTrim' | 'light'>;

interface CoupeSpec {
  splitter?: { stations: LoftStation[]; mat: MatKey; outline: number };
  frontBumper?: { size: [number, number, number]; pos: [number, number, number]; outline: number };
  body: LoftStation[];
  greenhouse: LoftStation[];
  roof: { stations: LoftStation[]; mat: MatKey; outline: number };
  hoodVents?: { size: [number, number, number]; pos: [number, number, number]; rotZ: number };
  dorsalFin?: { points: [number, number][]; width: number };
  spoilerProfile?: { points: [number, number][]; width: number; bevel: number; outline: number };
  wing?: {
    size: [number, number, number];
    pos: [number, number, number];
    mat: MatKey;
    struts?: { size: [number, number, number]; pos: [number, number, number]; mat: MatKey };
  };
  mirrors: { x: number; y: number; z: number; mat: MatKey };
  sideVinyl: [number, number, number, number, number];
  hoodVinyl: [number, number, number, number, number?];
  roofNumber: { x: number; y: number; color: string };
  grille: { size: [number, number, number]; pos: [number, number, number]; outline: number };
  chromeBar?: { size: [number, number, number]; pos: [number, number, number] };
  roundLamps?: { radius: number; depth: number; pos: [number, number, number] };
  headBoxes?: {
    size: [number, number, number];
    pos: [number, number, number];
    mat: MatKey;
    rotY?: number;
    rotZ?: number;
    outline: number;
  };
  tail: { size: [number, number, number]; pos: [number, number, number]; outline: number };
  exhaust?: { radius: number; length: number; pos: [number, number, number] };
  wheels: {
    front: [number, number, number, number, 'body' | 'stripe' | string];
    rear: [number, number, number, number, 'body' | 'stripe' | string];
    whitewall?: boolean;
  };
  flamesX: number;
}

const COUPE_SPECS: Record<
  'mcqueen' | 'sally' | 'chick' | 'doc' | 'cruz' | 'storm' | 'ramone' | 'finn' | 'shu' | 'king',
  CoupeSpec
> = {
  mcqueen: {
    splitter: {
      mat: 'darkTrim',
      outline: 0.04,
      stations: [
        { x: 2.86, yBot: 0.32, yTop: 0.44, wBot: 1.18, wMid: 1.24, wTop: 1.2, crown: 0.02 },
        { x: 2.4, yBot: 0.34, yTop: 0.48, wBot: 1.44, wMid: 1.5, wTop: 1.46, crown: 0.02 },
        { x: -2.65, yBot: 0.34, yTop: 0.48, wBot: 1.44, wMid: 1.5, wTop: 1.46, crown: 0.02 },
      ],
    },
    body: [
      { x: 2.82, yBot: 0.44, yTop: 0.78, wBot: 1.18, wMid: 1.26, wTop: 1.12, crown: 0.08 },
      { x: 2.46, yBot: 0.44, yTop: 0.98, wBot: 1.46, wMid: 1.6, wTop: 1.42, crown: 0.1 },
      { x: 1.15, yBot: 0.44, yTop: 1.14, wBot: 1.52, wMid: 1.66, wTop: 1.48, crown: 0.1 },
      { x: -1.15, yBot: 0.44, yTop: 1.18, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.1 },
      { x: -2.35, yBot: 0.46, yTop: 1.24, wBot: 1.48, wMid: 1.62, wTop: 1.44, crown: 0.09 },
      { x: -2.74, yBot: 0.5, yTop: 1.04, wBot: 1.28, wMid: 1.38, wTop: 1.24, crown: 0.06 },
    ],
    greenhouse: [
      { x: 1.08, yBot: 1.12, yTop: 1.22, wBot: 1.36, wMid: 1.3, wTop: 1.2, crown: 0.04 },
      { x: 0.24, yBot: 1.14, yTop: 1.72, wBot: 1.34, wMid: 1.18, wTop: 1.02, crown: 0.08 },
      { x: -0.96, yBot: 1.16, yTop: 1.72, wBot: 1.34, wMid: 1.18, wTop: 1.02, crown: 0.08 },
      { x: -2.04, yBot: 1.18, yTop: 1.26, wBot: 1.34, wMid: 1.26, wTop: 1.16, crown: 0.04 },
    ],
    roof: {
      mat: 'body',
      outline: 0.055,
      stations: [
        { x: 0.3, yBot: 1.69, yTop: 1.81, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.06 },
        { x: -0.35, yBot: 1.7, yTop: 1.84, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.06 },
        { x: -1.02, yBot: 1.69, yTop: 1.8, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.06 },
      ],
    },
    spoilerProfile: {
      points: [
        [-2.35, 1.22],
        [-2.78, 1.56],
        [-2.86, 1.46],
        [-2.52, 1.16],
      ],
      width: 2.68,
      bevel: 0.04,
      outline: 0.05,
    },
    mirrors: { x: 0.7, y: 1.22, z: 1.44, mat: 'body' },
    sideVinyl: [-0.05, 0.86, 1.68, 2.2, 0.68],
    hoodVinyl: [1.82, 1.21, 1.35, 1.45, 0],
    roofNumber: { x: -0.38, y: 1.92, color: '#f7c933' },
    grille: { size: [0.1, 0.22, 1.42], pos: [2.85, 0.58, 0], outline: 0.03 },
    headBoxes: { size: [0.14, 0.18, 0.5], pos: [2.78, 0.82, 0.94], mat: 'light', rotY: -0.22, rotZ: -0.25, outline: 0.03 },
    tail: { size: [0.12, 0.18, 0.54], pos: [-2.76, 0.92, 0.9], outline: 0.03 },
    exhaust: { radius: 0.08, length: 0.4, pos: [-0.55, 0.42, 1.62] },
    wheels: {
      front: [0.62, 0.44, 5.5 * 0.29, 3.45 / 2 - 0.3, 'body'],
      rear: [0.65, 0.48, -5.5 * 0.29, 3.45 / 2 - 0.3, 'body'],
    },
    flamesX: -5.5 / 2 - 0.24,
  },
  sally: {
    body: [
      { x: 2.66, yBot: 0.42, yTop: 0.76, wBot: 1.14, wMid: 1.24, wTop: 1.08, crown: 0.08 },
      { x: 2.22, yBot: 0.42, yTop: 0.98, wBot: 1.38, wMid: 1.52, wTop: 1.36, crown: 0.1 },
      { x: 1.02, yBot: 0.42, yTop: 1.14, wBot: 1.44, wMid: 1.56, wTop: 1.4, crown: 0.1 },
      { x: -1.2, yBot: 0.42, yTop: 1.2, wBot: 1.46, wMid: 1.6, wTop: 1.44, crown: 0.09 },
      { x: -2.26, yBot: 0.46, yTop: 1.24, wBot: 1.42, wMid: 1.54, wTop: 1.38, crown: 0.08 },
      { x: -2.6, yBot: 0.5, yTop: 0.98, wBot: 1.2, wMid: 1.3, wTop: 1.14, crown: 0.06 },
    ],
    greenhouse: [
      { x: 1.04, yBot: 1.14, yTop: 1.22, wBot: 1.28, wMid: 1.22, wTop: 1.14, crown: 0.04 },
      { x: 0.2, yBot: 1.14, yTop: 1.74, wBot: 1.26, wMid: 1.12, wTop: 0.96, crown: 0.08 },
      { x: -0.84, yBot: 1.16, yTop: 1.74, wBot: 1.26, wMid: 1.12, wTop: 0.96, crown: 0.08 },
      { x: -1.96, yBot: 1.2, yTop: 1.28, wBot: 1.26, wMid: 1.2, wTop: 1.12, crown: 0.04 },
    ],
    roof: {
      mat: 'body',
      outline: 0.05,
      stations: [
        { x: 0.24, yBot: 1.72, yTop: 1.82, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.06 },
        { x: -0.3, yBot: 1.72, yTop: 1.86, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.06 },
        { x: -0.9, yBot: 1.72, yTop: 1.82, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.06 },
      ],
    },
    wing: { size: [0.42, 0.08, 2.24], pos: [-2.38, 1.38, 0], mat: 'stripe' },
    mirrors: { x: 0.7, y: 1.2, z: 1.36, mat: 'body' },
    sideVinyl: [-0.05, 0.84, 1.6, 1.95, 0.62],
    hoodVinyl: [1.7, 1.19, 1.3, 1.35],
    roofNumber: { x: -0.3, y: 1.94, color: '#15222a' },
    grille: { size: [0.1, 0.18, 1.36], pos: [2.68, 0.56, 0], outline: 0.025 },
    headBoxes: { size: [0.34, 0.2, 0.44], pos: [2.46, 0.88, 0.96], mat: 'light', rotY: -0.24, rotZ: -0.26, outline: 0.03 },
    tail: { size: [0.14, 0.18, 0.58], pos: [-2.62, 0.92, 0.9], outline: 0.03 },
    exhaust: { radius: 0.09, length: 0.36, pos: [-2.64, 0.46, 0.7] },
    wheels: {
      front: [0.58, 0.4, 5.15 * 0.3, 3.3 / 2 - 0.28, '#d6dde4'],
      rear: [0.62, 0.46, -5.15 * 0.29, 3.3 / 2 - 0.28, '#d6dde4'],
    },
    flamesX: -5.15 / 2 - 0.22,
  },
  chick: {
    body: [
      { x: 2.94, yBot: 0.44, yTop: 0.98, wBot: 1.34, wMid: 1.44, wTop: 1.32, crown: 0.06 },
      { x: 2.55, yBot: 0.44, yTop: 1.12, wBot: 1.54, wMid: 1.66, wTop: 1.52, crown: 0.07 },
      { x: 1.1, yBot: 0.44, yTop: 1.22, wBot: 1.56, wMid: 1.68, wTop: 1.54, crown: 0.07 },
      { x: -1.3, yBot: 0.44, yTop: 1.24, wBot: 1.56, wMid: 1.68, wTop: 1.54, crown: 0.07 },
      { x: -2.65, yBot: 0.48, yTop: 1.24, wBot: 1.52, wMid: 1.62, wTop: 1.48, crown: 0.06 },
      { x: -2.96, yBot: 0.52, yTop: 1.06, wBot: 1.36, wMid: 1.44, wTop: 1.3, crown: 0.04 },
    ],
    greenhouse: [
      { x: 1.04, yBot: 1.2, yTop: 1.3, wBot: 1.38, wMid: 1.32, wTop: 1.24, crown: 0.04 },
      { x: 0.36, yBot: 1.2, yTop: 1.8, wBot: 1.38, wMid: 1.24, wTop: 1.1, crown: 0.06 },
      { x: -1.06, yBot: 1.22, yTop: 1.8, wBot: 1.38, wMid: 1.24, wTop: 1.1, crown: 0.06 },
      { x: -1.8, yBot: 1.22, yTop: 1.3, wBot: 1.38, wMid: 1.32, wTop: 1.24, crown: 0.04 },
    ],
    roof: {
      mat: 'body',
      outline: 0.05,
      stations: [
        { x: 0.42, yBot: 1.78, yTop: 1.88, wBot: 1.12, wMid: 1.08, wTop: 1.0, crown: 0.05 },
        { x: -1.12, yBot: 1.78, yTop: 1.88, wBot: 1.12, wMid: 1.08, wTop: 1.0, crown: 0.05 },
      ],
    },
    wing: {
      size: [0.46, 0.1, 2.84],
      pos: [-2.74, 1.58, 0],
      mat: 'stripe',
      struts: { size: [0.24, 0.34, 0.1], pos: [-2.7, 1.38, 1.1], mat: 'shade' },
    },
    mirrors: { x: 0.74, y: 1.26, z: 1.48, mat: 'body' },
    sideVinyl: [-0.05, 0.88, 1.7, 2.3, 0.68],
    hoodVinyl: [1.94, 1.28, 1.45, 1.5],
    roofNumber: { x: -0.32, y: 1.95, color: '#15222a' },
    grille: { size: [0.12, 0.26, 1.7], pos: [2.98, 0.78, 0], outline: 0.03 },
    chromeBar: { size: [0.08, 0.07, 1.62], pos: [3.02, 0.78, 0] },
    headBoxes: { size: [0.14, 0.2, 0.44], pos: [2.96, 0.84, 1.08], mat: 'light', outline: 0.025 },
    tail: { size: [0.14, 0.22, 0.58], pos: [-2.98, 0.94, 1.0], outline: 0.025 },
    wheels: {
      front: [0.62, 0.44, 5.8 * 0.29, 3.55 / 2 - 0.32, 'stripe'],
      rear: [0.65, 0.48, -5.8 * 0.29, 3.55 / 2 - 0.34, 'stripe'],
    },
    flamesX: -5.8 / 2 - 0.22,
  },
  doc: {
    frontBumper: { size: [0.34, 0.18, 2.86], pos: [3.08, 0.52, 0], outline: 0.035 },
    body: [
      { x: 3.0, yBot: 0.48, yTop: 0.96, wBot: 1.24, wMid: 1.36, wTop: 1.2, crown: 0.1 },
      { x: 2.52, yBot: 0.48, yTop: 1.18, wBot: 1.5, wMid: 1.64, wTop: 1.46, crown: 0.11 },
      { x: 1.18, yBot: 0.48, yTop: 1.3, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.1 },
      { x: -1.4, yBot: 0.48, yTop: 1.24, wBot: 1.54, wMid: 1.68, wTop: 1.48, crown: 0.09 },
      { x: -2.64, yBot: 0.52, yTop: 1.12, wBot: 1.44, wMid: 1.56, wTop: 1.38, crown: 0.08 },
      { x: -3.0, yBot: 0.54, yTop: 0.94, wBot: 1.24, wMid: 1.34, wTop: 1.18, crown: 0.06 },
    ],
    greenhouse: [
      { x: 1.12, yBot: 1.28, yTop: 1.36, wBot: 1.32, wMid: 1.26, wTop: 1.18, crown: 0.04 },
      { x: 0.34, yBot: 1.28, yTop: 1.84, wBot: 1.3, wMid: 1.16, wTop: 1.02, crown: 0.08 },
      { x: -0.88, yBot: 1.26, yTop: 1.84, wBot: 1.3, wMid: 1.16, wTop: 1.02, crown: 0.08 },
      { x: -2.28, yBot: 1.18, yTop: 1.26, wBot: 1.3, wMid: 1.24, wTop: 1.14, crown: 0.04 },
    ],
    roof: {
      mat: 'stripe',
      outline: 0.05,
      stations: [
        { x: 0.4, yBot: 1.82, yTop: 1.92, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.07 },
        { x: -0.96, yBot: 1.82, yTop: 1.92, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.07 },
      ],
    },
    mirrors: { x: 0.84, y: 1.34, z: 1.44, mat: 'chrome' },
    sideVinyl: [-0.05, 0.9, 1.7, 2.4, 0.66],
    hoodVinyl: [2.02, 1.36, 1.45, 1.45],
    roofNumber: { x: -0.34, y: 2.01, color: '#2a4a78' },
    grille: { size: [0.12, 0.24, 1.66], pos: [3.04, 0.78, 0], outline: 0.03 },
    chromeBar: { size: [0.08, 0.07, 1.74], pos: [3.08, 0.78, 0] },
    roundLamps: { radius: 0.17, depth: 0.18, pos: [3.0, 0.88, 1.1] },
    tail: { size: [0.14, 0.2, 0.44], pos: [-3.02, 0.86, 1.04], outline: 0.025 },
    wheels: {
      front: [0.62, 0.42, 5.95 * 0.3, 3.52 / 2 - 0.32, '#d9dfe6'],
      rear: [0.64, 0.44, -5.95 * 0.29, 3.52 / 2 - 0.34, '#d9dfe6'],
      whitewall: true,
    },
    flamesX: -5.95 / 2 - 0.24,
  },
  cruz: {
    body: [
      { x: 2.74, yBot: 0.42, yTop: 0.76, wBot: 1.16, wMid: 1.24, wTop: 1.1, crown: 0.08 },
      { x: 2.32, yBot: 0.42, yTop: 0.96, wBot: 1.42, wMid: 1.56, wTop: 1.38, crown: 0.09 },
      { x: 1.02, yBot: 0.42, yTop: 1.12, wBot: 1.48, wMid: 1.6, wTop: 1.44, crown: 0.08 },
      { x: -1.25, yBot: 0.42, yTop: 1.16, wBot: 1.5, wMid: 1.62, wTop: 1.46, crown: 0.08 },
      { x: -2.4, yBot: 0.46, yTop: 1.16, wBot: 1.44, wMid: 1.54, wTop: 1.38, crown: 0.07 },
      { x: -2.72, yBot: 0.5, yTop: 0.96, wBot: 1.22, wMid: 1.32, wTop: 1.18, crown: 0.05 },
    ],
    hoodVents: { size: [0.5, 0.05, 0.42], pos: [1.54, 1.13, 0.54], rotZ: -0.12 },
    greenhouse: [
      { x: 1.0, yBot: 1.1, yTop: 1.2, wBot: 1.3, wMid: 1.24, wTop: 1.14, crown: 0.04 },
      { x: 0.18, yBot: 1.1, yTop: 1.64, wBot: 1.28, wMid: 1.14, wTop: 0.98, crown: 0.07 },
      { x: -0.84, yBot: 1.12, yTop: 1.64, wBot: 1.28, wMid: 1.14, wTop: 0.98, crown: 0.07 },
      { x: -1.94, yBot: 1.14, yTop: 1.22, wBot: 1.28, wMid: 1.22, wTop: 1.12, crown: 0.04 },
    ],
    roof: {
      mat: 'body',
      outline: 0.05,
      stations: [
        { x: 0.24, yBot: 1.62, yTop: 1.72, wBot: 1.0, wMid: 0.96, wTop: 0.88, crown: 0.05 },
        { x: -0.9, yBot: 1.62, yTop: 1.72, wBot: 1.0, wMid: 0.96, wTop: 0.88, crown: 0.05 },
      ],
    },
    wing: {
      size: [0.44, 0.09, 2.78],
      pos: [-2.42, 1.5, 0],
      mat: 'stripe',
      struts: { size: [0.22, 0.4, 0.1], pos: [-2.38, 1.24, 0.86], mat: 'darkTrim' },
    },
    mirrors: { x: 0.7, y: 1.16, z: 1.38, mat: 'body' },
    sideVinyl: [-0.05, 0.82, 1.63, 2.1, 0.62],
    hoodVinyl: [1.78, 1.18, 1.35, 1.35],
    roofNumber: { x: -0.34, y: 1.79, color: '#15222a' },
    grille: { size: [0.1, 0.18, 1.42], pos: [2.76, 0.58, 0], outline: 0.025 },
    headBoxes: { size: [0.14, 0.15, 0.52], pos: [2.7, 0.8, 0.98], mat: 'light', outline: 0.025 },
    tail: { size: [0.12, 0.18, 0.6], pos: [-2.74, 0.88, 0.92], outline: 0.025 },
    wheels: {
      front: [0.6, 0.42, 5.3 * 0.29, 3.4 / 2 - 0.3, '#d6dde4'],
      rear: [0.63, 0.46, -5.3 * 0.29, 3.4 / 2 - 0.32, '#d6dde4'],
    },
    flamesX: -5.3 / 2 - 0.24,
  },
  storm: {
    body: [
      { x: 2.86, yBot: 0.38, yTop: 0.7, wBot: 1.18, wMid: 1.28, wTop: 1.14, crown: 0.06 },
      { x: 2.38, yBot: 0.38, yTop: 0.92, wBot: 1.48, wMid: 1.62, wTop: 1.44, crown: 0.08 },
      { x: 1.0, yBot: 0.38, yTop: 1.08, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.07 },
      { x: -1.35, yBot: 0.38, yTop: 1.14, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.07 },
      { x: -2.52, yBot: 0.44, yTop: 1.14, wBot: 1.48, wMid: 1.58, wTop: 1.42, crown: 0.06 },
      { x: -2.84, yBot: 0.48, yTop: 0.9, wBot: 1.28, wMid: 1.38, wTop: 1.22, crown: 0.04 },
    ],
    greenhouse: [
      { x: 0.96, yBot: 1.06, yTop: 1.16, wBot: 1.32, wMid: 1.24, wTop: 1.14, crown: 0.03 },
      { x: 0.14, yBot: 1.06, yTop: 1.56, wBot: 1.3, wMid: 1.14, wTop: 0.96, crown: 0.06 },
      { x: -0.92, yBot: 1.08, yTop: 1.56, wBot: 1.3, wMid: 1.14, wTop: 0.96, crown: 0.06 },
      { x: -2.14, yBot: 1.12, yTop: 1.2, wBot: 1.3, wMid: 1.22, wTop: 1.1, crown: 0.03 },
    ],
    roof: {
      mat: 'body',
      outline: 0.05,
      stations: [
        { x: 0.2, yBot: 1.54, yTop: 1.64, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.05 },
        { x: -1.0, yBot: 1.54, yTop: 1.64, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.05 },
      ],
    },
    dorsalFin: {
      points: [
        [-0.92, 1.58],
        [-2.48, 1.52],
        [-2.52, 1.14],
        [-1.4, 1.14],
      ],
      width: 0.08,
    },
    wing: {
      size: [0.48, 0.08, 2.98],
      pos: [-2.54, 1.48, 0],
      mat: 'body',
      struts: { size: [0.22, 0.36, 0.1], pos: [-2.5, 1.24, 1.08], mat: 'darkTrim' },
    },
    mirrors: { x: 0.7, y: 1.12, z: 1.44, mat: 'body' },
    sideVinyl: [-0.05, 0.8, 1.69, 2.25, 0.6],
    hoodVinyl: [1.88, 1.1, 1.4, 1.45],
    roofNumber: { x: -0.4, y: 1.71, color: '#ffffff' },
    grille: { size: [0.1, 0.18, 1.46], pos: [2.88, 0.54, 0], outline: 0.025 },
    headBoxes: { size: [0.14, 0.1, 0.64], pos: [2.82, 0.72, 0.98], mat: 'stripe', outline: 0.025 },
    tail: { size: [0.12, 0.12, 0.7], pos: [-2.86, 0.86, 0.96], outline: 0.025 },
    wheels: {
      front: [0.62, 0.46, 5.6 * 0.29, 3.58 / 2 - 0.34, 'stripe'],
      rear: [0.65, 0.5, -5.6 * 0.29, 3.58 / 2 - 0.36, 'stripe'],
    },
    flamesX: -5.6 / 2 - 0.22,
  },
  ramone: {
    frontBumper: { size: [0.3, 0.16, 2.94], pos: [3.1, 0.44, 0], outline: 0.035 },
    body: [
      { x: 3.04, yBot: 0.36, yTop: 0.86, wBot: 1.28, wMid: 1.4, wTop: 1.24, crown: 0.09 },
      { x: 2.48, yBot: 0.36, yTop: 1.04, wBot: 1.52, wMid: 1.66, wTop: 1.48, crown: 0.1 },
      { x: 1.05, yBot: 0.36, yTop: 1.12, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.08 },
      { x: -1.4, yBot: 0.36, yTop: 1.12, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.08 },
      { x: -2.74, yBot: 0.4, yTop: 1.14, wBot: 1.48, wMid: 1.6, wTop: 1.44, crown: 0.06 },
      { x: -3.08, yBot: 0.44, yTop: 0.94, wBot: 1.26, wMid: 1.38, wTop: 1.24, crown: 0.04 },
    ],
    greenhouse: [
      { x: 0.98, yBot: 1.1, yTop: 1.2, wBot: 1.32, wMid: 1.26, wTop: 1.18, crown: 0.04 },
      { x: 0.3, yBot: 1.1, yTop: 1.66, wBot: 1.32, wMid: 1.18, wTop: 1.04, crown: 0.07 },
      { x: -0.98, yBot: 1.1, yTop: 1.66, wBot: 1.32, wMid: 1.18, wTop: 1.04, crown: 0.07 },
      { x: -1.9, yBot: 1.12, yTop: 1.2, wBot: 1.32, wMid: 1.26, wTop: 1.16, crown: 0.04 },
    ],
    roof: {
      mat: 'body',
      outline: 0.05,
      stations: [
        { x: 0.36, yBot: 1.64, yTop: 1.74, wBot: 1.06, wMid: 1.02, wTop: 0.94, crown: 0.06 },
        { x: -1.04, yBot: 1.64, yTop: 1.74, wBot: 1.06, wMid: 1.02, wTop: 0.94, crown: 0.06 },
      ],
    },
    mirrors: { x: 0.72, y: 1.16, z: 1.46, mat: 'chrome' },
    sideVinyl: [-0.05, 0.78, 1.7, 2.35, 0.58],
    hoodVinyl: [2.04, 1.18, 1.42, 1.46],
    roofNumber: { x: -0.34, y: 1.82, color: '#f5b82e' },
    grille: { size: [0.12, 0.2, 1.72], pos: [3.08, 0.68, 0], outline: 0.03 },
    chromeBar: { size: [0.08, 0.07, 1.82], pos: [3.12, 0.68, 0] },
    roundLamps: { radius: 0.15, depth: 0.16, pos: [3.04, 0.78, 1.12] },
    tail: { size: [0.14, 0.18, 0.54], pos: [-3.1, 0.8, 1.0], outline: 0.025 },
    exhaust: { radius: 0.08, length: 0.38, pos: [-2.9, 0.38, 0.78] },
    wheels: {
      front: [0.6, 0.42, 5.95 * 0.29, 3.56 / 2 - 0.32, '#e8ecf0'],
      rear: [0.6, 0.44, -5.95 * 0.29, 3.56 / 2 - 0.34, '#e8ecf0'],
      whitewall: true,
    },
    flamesX: -6.0 / 2 - 0.24,
  },
  finn: {
    frontBumper: { size: [0.24, 0.14, 2.6], pos: [2.86, 0.48, 0], outline: 0.03 },
    body: [
      { x: 2.82, yBot: 0.44, yTop: 0.84, wBot: 1.16, wMid: 1.26, wTop: 1.1, crown: 0.08 },
      { x: 2.32, yBot: 0.44, yTop: 1.06, wBot: 1.4, wMid: 1.54, wTop: 1.38, crown: 0.09 },
      { x: 0.96, yBot: 0.44, yTop: 1.14, wBot: 1.44, wMid: 1.56, wTop: 1.4, crown: 0.08 },
      { x: -1.3, yBot: 0.44, yTop: 1.18, wBot: 1.44, wMid: 1.56, wTop: 1.4, crown: 0.08 },
      { x: -2.42, yBot: 0.48, yTop: 1.16, wBot: 1.36, wMid: 1.46, wTop: 1.3, crown: 0.06 },
      { x: -2.74, yBot: 0.52, yTop: 0.94, wBot: 1.18, wMid: 1.26, wTop: 1.12, crown: 0.05 },
    ],
    greenhouse: [
      { x: 0.92, yBot: 1.12, yTop: 1.2, wBot: 1.26, wMid: 1.2, wTop: 1.12, crown: 0.04 },
      { x: 0.18, yBot: 1.12, yTop: 1.66, wBot: 1.24, wMid: 1.1, wTop: 0.96, crown: 0.07 },
      { x: -0.9, yBot: 1.14, yTop: 1.66, wBot: 1.24, wMid: 1.1, wTop: 0.96, crown: 0.07 },
      { x: -2.02, yBot: 1.14, yTop: 1.22, wBot: 1.24, wMid: 1.18, wTop: 1.1, crown: 0.04 },
    ],
    roof: {
      mat: 'body',
      outline: 0.05,
      stations: [
        { x: 0.24, yBot: 1.64, yTop: 1.74, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.06 },
        { x: -0.96, yBot: 1.64, yTop: 1.74, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.06 },
      ],
    },
    mirrors: { x: 0.68, y: 1.18, z: 1.36, mat: 'chrome' },
    sideVinyl: [-0.08, 0.84, 1.58, 2.05, 0.56],
    hoodVinyl: [1.84, 1.19, 1.35, 1.3],
    roofNumber: { x: -0.36, y: 1.82, color: '#ffffff' },
    grille: { size: [0.1, 0.2, 1.38], pos: [2.84, 0.68, 0], outline: 0.025 },
    chromeBar: { size: [0.06, 0.06, 1.32], pos: [2.87, 0.68, 0] },
    roundLamps: { radius: 0.16, depth: 0.16, pos: [2.8, 0.84, 0.96] },
    tail: { size: [0.12, 0.18, 0.46], pos: [-2.76, 0.88, 0.9], outline: 0.025 },
    exhaust: { radius: 0.075, length: 0.34, pos: [-2.76, 0.48, 0.68] },
    wheels: {
      front: [0.58, 0.4, 5.4 * 0.29, 3.32 / 2 - 0.28, '#e8ecf0'],
      rear: [0.6, 0.42, -5.4 * 0.29, 3.32 / 2 - 0.3, '#e8ecf0'],
    },
    flamesX: -5.4 / 2 - 0.22,
  },
  shu: {
    splitter: {
      mat: 'darkTrim',
      outline: 0.04,
      stations: [
        { x: 2.94, yBot: 0.3, yTop: 0.42, wBot: 1.24, wMid: 1.3, wTop: 1.24, crown: 0.02 },
        { x: 2.38, yBot: 0.32, yTop: 0.46, wBot: 1.5, wMid: 1.56, wTop: 1.5, crown: 0.02 },
        { x: -2.6, yBot: 0.32, yTop: 0.46, wBot: 1.5, wMid: 1.56, wTop: 1.5, crown: 0.02 },
      ],
    },
    body: [
      { x: 2.9, yBot: 0.38, yTop: 0.68, wBot: 1.22, wMid: 1.32, wTop: 1.18, crown: 0.07 },
      { x: 2.34, yBot: 0.38, yTop: 0.92, wBot: 1.5, wMid: 1.66, wTop: 1.48, crown: 0.08 },
      { x: 0.95, yBot: 0.38, yTop: 1.02, wBot: 1.54, wMid: 1.68, wTop: 1.52, crown: 0.07 },
      { x: -1.35, yBot: 0.38, yTop: 1.08, wBot: 1.54, wMid: 1.68, wTop: 1.52, crown: 0.07 },
      { x: -2.5, yBot: 0.42, yTop: 1.08, wBot: 1.48, wMid: 1.6, wTop: 1.44, crown: 0.06 },
      { x: -2.8, yBot: 0.46, yTop: 0.86, wBot: 1.28, wMid: 1.38, wTop: 1.22, crown: 0.04 },
    ],
    greenhouse: [
      { x: 1.1, yBot: 0.98, yTop: 1.08, wBot: 1.08, wMid: 1.02, wTop: 0.92, crown: 0.04 },
      { x: 0.2, yBot: 1.0, yTop: 1.48, wBot: 1.06, wMid: 0.94, wTop: 0.8, crown: 0.07 },
      { x: -0.88, yBot: 1.02, yTop: 1.48, wBot: 1.06, wMid: 0.94, wTop: 0.8, crown: 0.07 },
      { x: -1.9, yBot: 1.04, yTop: 1.12, wBot: 1.04, wMid: 0.98, wTop: 0.88, crown: 0.04 },
    ],
    roof: {
      mat: 'body',
      outline: 0.05,
      stations: [
        { x: 0.24, yBot: 1.46, yTop: 1.56, wBot: 0.82, wMid: 0.78, wTop: 0.7, crown: 0.05 },
        { x: -0.94, yBot: 1.46, yTop: 1.56, wBot: 0.82, wMid: 0.78, wTop: 0.7, crown: 0.05 },
      ],
    },
    dorsalFin: {
      points: [
        [-0.86, 1.5],
        [-2.48, 1.44],
        [-2.52, 1.06],
        [-1.36, 1.06],
      ],
      width: 0.09,
    },
    wing: {
      size: [0.5, 0.09, 2.94],
      pos: [-2.52, 1.5, 0],
      mat: 'stripe',
      struts: { size: [0.22, 0.42, 0.1], pos: [-2.48, 1.24, 1.02], mat: 'darkTrim' },
    },
    mirrors: { x: 0.68, y: 1.04, z: 1.26, mat: 'body' },
    sideVinyl: [-0.05, 0.76, 1.7, 2.2, 0.56],
    hoodVinyl: [1.88, 1.06, 1.4, 1.45],
    roofNumber: { x: -0.34, y: 1.63, color: '#d92929' },
    grille: { size: [0.1, 0.16, 1.38], pos: [2.92, 0.48, 0], outline: 0.025 },
    headBoxes: { size: [0.22, 0.14, 0.48], pos: [2.76, 0.72, 1.02], mat: 'light', rotZ: -0.22, outline: 0.025 },
    tail: { size: [0.12, 0.14, 0.62], pos: [-2.82, 0.8, 0.96], outline: 0.025 },
    wheels: {
      front: [0.62, 0.46, 5.6 * 0.29, 3.58 / 2 - 0.34, '#e8ecf0'],
      rear: [0.65, 0.5, -5.6 * 0.29, 3.58 / 2 - 0.36, '#e8ecf0'],
    },
    flamesX: -5.6 / 2 - 0.24,
  },
  king: {
    splitter: {
      mat: 'body',
      outline: 0.04,
      stations: [
        { x: 3.16, yBot: 0.34, yTop: 0.62, wBot: 1.12, wMid: 1.18, wTop: 1.02, crown: 0.06 },
        { x: 2.6, yBot: 0.4, yTop: 0.96, wBot: 1.46, wMid: 1.56, wTop: 1.4, crown: 0.08 },
      ],
    },
    body: [
      { x: 3.12, yBot: 0.4, yTop: 0.72, wBot: 1.16, wMid: 1.24, wTop: 1.08, crown: 0.07 },
      { x: 2.52, yBot: 0.42, yTop: 1.08, wBot: 1.5, wMid: 1.64, wTop: 1.48, crown: 0.08 },
      { x: 1.05, yBot: 0.44, yTop: 1.18, wBot: 1.54, wMid: 1.68, wTop: 1.52, crown: 0.07 },
      { x: -1.35, yBot: 0.44, yTop: 1.2, wBot: 1.54, wMid: 1.68, wTop: 1.52, crown: 0.07 },
      { x: -2.68, yBot: 0.48, yTop: 1.2, wBot: 1.48, wMid: 1.6, wTop: 1.44, crown: 0.06 },
      { x: -3.0, yBot: 0.52, yTop: 1.0, wBot: 1.3, wMid: 1.4, wTop: 1.24, crown: 0.04 },
    ],
    greenhouse: [
      { x: 1.02, yBot: 1.16, yTop: 1.26, wBot: 1.36, wMid: 1.3, wTop: 1.22, crown: 0.04 },
      { x: 0.3, yBot: 1.16, yTop: 1.76, wBot: 1.36, wMid: 1.22, wTop: 1.06, crown: 0.06 },
      { x: -1.04, yBot: 1.18, yTop: 1.76, wBot: 1.36, wMid: 1.22, wTop: 1.06, crown: 0.06 },
      { x: -1.96, yBot: 1.18, yTop: 1.26, wBot: 1.36, wMid: 1.3, wTop: 1.2, crown: 0.04 },
    ],
    roof: {
      mat: 'body',
      outline: 0.05,
      stations: [
        { x: 0.36, yBot: 1.74, yTop: 1.84, wBot: 1.08, wMid: 1.04, wTop: 0.96, crown: 0.05 },
        { x: -1.1, yBot: 1.74, yTop: 1.84, wBot: 1.08, wMid: 1.04, wTop: 0.96, crown: 0.05 },
      ],
    },
    wing: {
      size: [0.44, 0.1, 2.92],
      pos: [-2.78, 2.02, 0],
      mat: 'body',
      struts: { size: [0.24, 0.84, 0.1], pos: [-2.74, 1.56, 1.16], mat: 'body' },
    },
    mirrors: { x: 0.72, y: 1.22, z: 1.46, mat: 'body' },
    sideVinyl: [-0.08, 0.84, 1.7, 2.35, 0.64],
    hoodVinyl: [2.04, 1.22, 1.48, 1.45],
    roofNumber: { x: -0.36, y: 1.91, color: '#f4f8fc' },
    grille: { size: [0.12, 0.18, 1.48], pos: [3.14, 0.5, 0], outline: 0.025 },
    headBoxes: { size: [0.16, 0.14, 0.44], pos: [2.88, 0.84, 1.0], mat: 'stripe', outline: 0.025 },
    tail: { size: [0.14, 0.2, 0.56], pos: [-3.02, 0.88, 1.0], outline: 0.025 },
    wheels: {
      front: [0.62, 0.44, 5.95 * 0.29, 3.56 / 2 - 0.32, '#d6dde4'],
      rear: [0.64, 0.48, -5.95 * 0.29, 3.56 / 2 - 0.34, '#d6dde4'],
    },
    flamesX: -5.95 / 2 - 0.24,
  },
};

export function buildCoupeRacer(
  ctx: CarBuildContext,
  carId: keyof typeof COUPE_SPECS,
): void {
  const spec = COUPE_SPECS[carId];
  const { mats, palette } = ctx;

  if (spec.splitter) {
    addLoft(ctx, spec.splitter.stations, mats[spec.splitter.mat], spec.splitter.outline);
  }
  if (spec.frontBumper) {
    addBox(ctx, spec.frontBumper.size, spec.frontBumper.pos, mats.chrome, true, true, spec.frontBumper.outline);
  }

  addLoft(ctx, spec.body, mats.body, 0.075);

  if (spec.hoodVents) {
    const [vx, vy, vz] = spec.hoodVents.pos;
    for (const side of [-1, 1]) {
      const vent = addBox(ctx, spec.hoodVents.size, [vx, vy, side * vz], mats.darkTrim, false, false, 0.02);
      vent.rotation.z = spec.hoodVents.rotZ;
    }
  }

  addGreenhouse(ctx, spec.greenhouse, 0.055);
  addLoft(ctx, spec.roof.stations, mats[spec.roof.mat], spec.roof.outline);

  if (spec.dorsalFin) {
    addProfile(ctx, spec.dorsalFin.points, spec.dorsalFin.width, mats.stripe, 0.02, true, 0.03);
  }
  if (spec.spoilerProfile) {
    const spoiler = addProfile(
      ctx,
      spec.spoilerProfile.points,
      spec.spoilerProfile.width,
      mats.body,
      spec.spoilerProfile.bevel,
      true,
      spec.spoilerProfile.outline,
    );
    ctx.stockParts['rear-wing'] = [spoiler];
  }
  if (spec.wing) {
    const parts = [addBox(ctx, spec.wing.size, spec.wing.pos, mats[spec.wing.mat], true, true, 0.035)];
    if (spec.wing.struts) {
      const { size, pos, mat } = spec.wing.struts;
      for (const side of [-1, 1]) {
        parts.push(addBox(ctx, size, [pos[0], pos[1], side * pos[2]], mats[mat], true, true, 0.025));
      }
    }
    ctx.stockParts['rear-wing'] = parts;
  }

  addSideMirrors(ctx, spec.mirrors.x, spec.mirrors.y, spec.mirrors.z, mats[spec.mirrors.mat]);
  addSideVinyls(ctx, ...spec.sideVinyl);
  addHoodVinyl(ctx, ...spec.hoodVinyl);
  addRoofNumber(ctx, spec.roofNumber.x, spec.roofNumber.y, 0, spec.roofNumber.color);

  addBox(ctx, spec.grille.size, spec.grille.pos, mats.darkTrim, false, false, spec.grille.outline);
  if (spec.chromeBar) {
    addBox(ctx, spec.chromeBar.size, spec.chromeBar.pos, mats.chrome, false);
  }

  for (const side of [-1, 1]) {
    if (spec.roundLamps) {
      const [lx, ly, lz] = spec.roundLamps.pos;
      addRoundLamp(ctx, spec.roundLamps.radius, spec.roundLamps.depth, [lx, ly, side * lz]);
    }
    if (spec.headBoxes) {
      const { size, pos, mat, rotY, rotZ, outline } = spec.headBoxes;
      const head = addBox(ctx, size, [pos[0], pos[1], side * pos[2]], mats[mat], false, false, outline);
      if (rotY !== undefined) head.rotation.y = side * rotY;
      if (rotZ !== undefined) head.rotation.z = rotZ;
    }
    const tail = addBox(
      ctx,
      spec.tail.size,
      [spec.tail.pos[0], spec.tail.pos[1], side * spec.tail.pos[2]],
      mats.tail,
      false,
      false,
      spec.tail.outline,
    );
    ctx.brakeLights.push(tail);
    if (spec.exhaust) {
      addExhaustPipe(ctx, spec.exhaust.radius, spec.exhaust.length, [
        spec.exhaust.pos[0],
        spec.exhaust.pos[1],
        side * spec.exhaust.pos[2],
      ]);
    }
  }

  const resolveRim = (key: string) =>
    key === 'body' ? palette.body : key === 'stripe' ? palette.stripe : key;
  const [fr, fw, fx, fz, fRim] = spec.wheels.front;
  const [rr, rw, rx, rz, rRim] = spec.wheels.rear;
  addAxlePair(
    ctx,
    { radius: fr, width: fw, x: fx, z: fz, rimColor: resolveRim(fRim), whitewall: spec.wheels.whitewall },
    { radius: rr, width: rw, x: rx, z: rz, rimColor: resolveRim(rRim), whitewall: spec.wheels.whitewall },
  );
  addFlames(ctx, spec.flamesX, 0);
}
