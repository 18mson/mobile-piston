import type { CarId, CarSpec } from '../types';

export const CARS: Record<CarId, CarSpec> = {
  sirip: {
    id: 'sirip',
    name: 'SIRIP',
    kind: 'Hatchback',
    blurb: 'Ringan dan seimbang. Pintu masuk paling ramah untuk semua tikungan.',
    stats: {
      topSpeed: 232,
      acceleration: 236,
      grip: 8.8,
      steerRate: 2.7,
      nitroBoost: 68,
      nitroAcceleration: 180,
      mass: 1,
    },
    palette: {
      body: '#f05f3f',
      shade: '#a93630',
      highlight: '#ffb07a',
      stripe: '#f7e6c4',
      glass: '#223447',
      wheel: '#181b22',
    },
  },
  bagas: {
    id: 'bagas',
    name: 'BAGAS',
    kind: 'Muskel',
    blurb: 'Panjang dan buas. Menang di lurus, ekornya suka lepas di tikungan.',
    stats: {
      topSpeed: 258,
      acceleration: 206,
      grip: 7.2,
      steerRate: 2.35,
      nitroBoost: 76,
      nitroAcceleration: 195,
      mass: 1.18,
    },
    palette: {
      body: '#e6ac32',
      shade: '#a86a22',
      highlight: '#ffe68b',
      stripe: '#20232a',
      glass: '#243b47',
      wheel: '#17191f',
    },
  },
  okra: {
    id: 'okra',
    name: 'OKRA',
    kind: 'Pikap',
    blurb: 'Berat dan lengket. Paling tenang saat rem dan banting setir.',
    stats: {
      topSpeed: 222,
      acceleration: 224,
      grip: 9.6,
      steerRate: 2.5,
      nitroBoost: 62,
      nitroAcceleration: 175,
      mass: 1.26,
    },
    palette: {
      body: '#2e9e90',
      shade: '#176a68',
      highlight: '#8ce0c8',
      stripe: '#f2dfb8',
      glass: '#203843',
      wheel: '#171b20',
    },
  },
  kepik: {
    id: 'kepik',
    name: 'KEPIK',
    kind: 'Buggy',
    blurb: 'Lincah dan ringan. Akselerasi tajam, tapi lurus panjang bukan rumahnya.',
    stats: {
      topSpeed: 210,
      acceleration: 274,
      grip: 10.2,
      steerRate: 2.95,
      nitroBoost: 56,
      nitroAcceleration: 205,
      mass: 0.86,
    },
    palette: {
      body: '#8fbd3d',
      shade: '#507c26',
      highlight: '#d8ea74',
      stripe: '#f7e7c2',
      glass: '#23343b',
      wheel: '#191b1f',
    },
  },
};

export const CAR_ORDER: CarId[] = ['sirip', 'bagas', 'okra', 'kepik'];

export const AI_LIVERIES: {
  id: string;
  label: string;
  carId: CarId;
  number: number;
  palette: CarSpec['palette'];
  skill: number;
}[] = [
  {
    id: 'ai-bagas',
    label: 'BAGAS #2',
    carId: 'bagas',
    number: 2,
    palette: { body: '#e6ac32', shade: '#9d6120', highlight: '#ffe68b', stripe: '#20232a', glass: '#243b47', wheel: '#17191f' },
    skill: 0.98,
  },
  {
    id: 'ai-okra',
    label: 'OKRA #7',
    carId: 'okra',
    number: 7,
    palette: { body: '#2e9e90', shade: '#176a68', highlight: '#8ce0c8', stripe: '#f2dfb8', glass: '#203843', wheel: '#171b20' },
    skill: 0.95,
  },
  {
    id: 'ai-kepik',
    label: 'KEPIK #5',
    carId: 'kepik',
    number: 5,
    palette: { body: '#d7c94d', shade: '#8b7d26', highlight: '#f4ee9b', stripe: '#26252a', glass: '#23343b', wheel: '#191b1f' },
    skill: 0.97,
  },
  {
    id: 'ai-sirip',
    label: 'SIRIP #9',
    carId: 'sirip',
    number: 9,
    palette: { body: '#4a8fd4', shade: '#275b90', highlight: '#9ed2ff', stripe: '#f5e7c7', glass: '#223447', wheel: '#181b22' },
    skill: 0.94,
  },
  {
    id: 'ai-kepik-4',
    label: 'KEPIK #4',
    carId: 'kepik',
    number: 4,
    palette: { body: '#c965a0', shade: '#843a6b', highlight: '#f3a8ce', stripe: '#f7e7c2', glass: '#23343b', wheel: '#191b1f' },
    skill: 0.92,
  },
];

export function getCar(id: CarId): CarSpec {
  return CARS[id];
}

export function statRatio(car: CarSpec, key: 'topSpeed' | 'acceleration' | 'grip'): number {
  const values = {
    topSpeed: [210, 258],
    acceleration: [206, 274],
    grip: [7.2, 10.2],
  } as const;
  const [min, max] = values[key];
  return Math.max(0, Math.min(1, (car.stats[key] - min) / (max - min)));
}
