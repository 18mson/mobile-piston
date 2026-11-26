import type { CarColorOption, CarId, CarPalette, CarSpec } from '../types';

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
      wheel: '#323a46',
    },
  },
  go: {
    id: 'go',
    name: 'GO',
    kind: 'City Car',
    blurb: 'Kecil, tinggi, dan irit napas. Jalannya makin kencang di lurusan, tapi lambat saat keluar tikungan.',
    stats: {
      topSpeed: 240,
      acceleration: 214,
      grip: 8.9,
      steerRate: 2.65,
      nitroBoost: 66,
      nitroAcceleration: 170,
      mass: 0.96,
    },
    palette: {
      body: '#dfe7ec',
      shade: '#8d9ca8',
      highlight: '#ffffff',
      stripe: '#e0452f',
      glass: '#233746',
      wheel: '#323a46',
    },
  },
  bagas: {
    id: 'bagas',
    name: 'BAGAS',
    kind: 'Muskel',
    blurb: 'Panjang dan buas. Raja lurusan, tapi ekornya suka lepas kalau masuk tikungan tanpa rem.',
    stats: {
      topSpeed: 262,
      acceleration: 220,
      grip: 7.9,
      steerRate: 2.45,
      nitroBoost: 76,
      nitroAcceleration: 195,
      mass: 1.18,
    },
    palette: {
      body: '#e6ac32',
      shade: '#a86a22',
      highlight: '#ffe68b',
      stripe: '#323b47',
      glass: '#243b47',
      wheel: '#323a46',
    },
  },
  okra: {
    id: 'okra',
    name: 'OKRA',
    kind: 'Pikap',
    blurb: 'Berat dan lengket. Paling tenang saat rem dan banting setir.',
    stats: {
      topSpeed: 220,
      acceleration: 248,
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
      wheel: '#323a46',
    },
  },
  kepik: {
    id: 'kepik',
    name: 'KEPIK',
    kind: 'Buggy',
    blurb: 'Lincah dan ringan. Akselerasi tajam dan tenang di tikungan, tapi bukan raja lurusan.',
    stats: {
      topSpeed: 226,
      acceleration: 244,
      grip: 9.1,
      steerRate: 2.9,
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
      wheel: '#323a46',
    },
  },
  hachi: {
    id: 'hachi',
    name: 'HACHI',
    kind: 'Drift Coupe',
    blurb: 'Coupe ringan bergaya tahu-panda. Ekornya gampang melebar, dan drift panjang mengisi nitro jauh lebih banyak.',
    stats: {
      topSpeed: 236,
      acceleration: 228,
      grip: 8.7,
      steerRate: 2.85,
      nitroBoost: 66,
      nitroAcceleration: 185,
      mass: 0.94,
      rearGrip: 0.94,
      driftBoost: 1.8,
      slideAssist: 1,
    },
    palette: {
      body: '#f1f3f4',
      shade: '#aab3b9',
      highlight: '#ffffff',
      stripe: '#323b47',
      glass: '#1f2f3a',
      wheel: '#323a46',
    },
  },
  kart: {
    id: 'kart',
    name: 'KART',
    kind: 'Go-Kart',
    blurb: 'Sangat kecil, sangat tajam. Grip dan setir paling tinggi, tapi napasnya habis di lurusan panjang dan nitronya kecil.',
    stats: {
      topSpeed: 210,
      acceleration: 270,
      grip: 10.4,
      steerRate: 3.15,
      nitroBoost: 38,
      nitroAcceleration: 170,
      mass: 0.55,
    },
    palette: {
      body: '#e8392f',
      shade: '#9c211d',
      highlight: '#ff8f7d',
      stripe: '#f6f1e4',
      glass: '#1f2a33',
      wheel: '#323a46',
    },
  },
  tanduk: {
    id: 'tanduk',
    name: 'TANDUK',
    kind: 'Rally Turbo',
    blurb: 'Sedan reli turbo 4WD dengan lampu kabut ganda. Traksi kuat di tikungan dan tetap tangguh saat melibas pinggir jalan.',
    stats: {
      topSpeed: 238,
      acceleration: 242,
      grip: 9.4,
      steerRate: 2.75,
      nitroBoost: 64,
      nitroAcceleration: 190,
      mass: 1.05,
      slideAssist: 1.05,
    },
    palette: {
      body: '#2a62c9',
      shade: '#1a3f8a',
      highlight: '#70a8ff',
      stripe: '#f4c63d',
      glass: '#263a4d',
      wheel: '#323a46',
    },
  },
  bima: {
    id: 'bima',
    name: 'BIMA',
    kind: 'Formula V8',
    blurb: 'Mobil balap roda terbuka bermesin V8. Sangat cepat di tikungan dan lurusan, tapi ringan saat beradu bodi.',
    stats: {
      topSpeed: 258,
      acceleration: 252,
      grip: 10.1,
      steerRate: 3.0,
      nitroBoost: 68,
      nitroAcceleration: 195,
      mass: 0.72,
    },
    palette: {
      body: '#d9352b',
      shade: '#8c1b16',
      highlight: '#ff8578',
      stripe: '#f5efe0',
      glass: '#263a4d',
      wheel: '#323a46',
    },
  },
  rota: {
    id: 'rota',
    name: 'ROTA',
    kind: 'Rotary Coupe',
    blurb: 'Coupe mesin rotary putaran tinggi. Tarikan awalnya halus, tapi dorongan nitronya paling panjang dan buas.',
    stats: {
      topSpeed: 248,
      acceleration: 234,
      grip: 9.2,
      steerRate: 2.88,
      nitroBoost: 84,
      nitroAcceleration: 225,
      mass: 0.92,
      rearGrip: 0.96,
      driftBoost: 1.35,
    },
    palette: {
      body: '#f2be2e',
      shade: '#ad7c12',
      highlight: '#ffea8a',
      stripe: '#323b47',
      glass: '#263a4d',
      wheel: '#323a46',
    },
  },
};

export const CAR_ORDER: CarId[] = [
  'sirip',
  'go',
  'hachi',
  'kart',
  'bagas',
  'okra',
  'kepik',
  'tanduk',
  'bima',
  'rota',
];

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
    palette: { body: '#e6ac32', shade: '#9d6120', highlight: '#ffe68b', stripe: '#323b47', glass: '#243b47', wheel: '#323a46' },
    skill: 0.98,
  },
  {
    id: 'ai-okra',
    label: 'OKRA #7',
    carId: 'okra',
    number: 7,
    palette: { body: '#2e9e90', shade: '#176a68', highlight: '#8ce0c8', stripe: '#f2dfb8', glass: '#203843', wheel: '#323a46' },
    skill: 0.95,
  },
  {
    id: 'ai-kepik',
    label: 'KEPIK #5',
    carId: 'kepik',
    number: 5,
    palette: { body: '#d7c94d', shade: '#8b7d26', highlight: '#f4ee9b', stripe: '#323b47', glass: '#23343b', wheel: '#323a46' },
    skill: 0.97,
  },
  {
    id: 'ai-sirip',
    label: 'SIRIP #9',
    carId: 'sirip',
    number: 9,
    palette: { body: '#4a8fd4', shade: '#275b90', highlight: '#9ed2ff', stripe: '#f5e7c7', glass: '#223447', wheel: '#323a46' },
    skill: 0.94,
  },
  {
    id: 'ai-go',
    label: 'GO #4',
    carId: 'go',
    number: 4,
    palette: { body: '#e8742f', shade: '#a3471b', highlight: '#ffc08a', stripe: '#f4ece0', glass: '#233746', wheel: '#323a46' },
    skill: 0.92,
  },
  {
    id: 'ai-hachi',
    label: 'HACHI #86',
    carId: 'hachi',
    number: 86,
    palette: { body: '#f1f3f4', shade: '#aab3b9', highlight: '#ffffff', stripe: '#323b47', glass: '#1f2f3a', wheel: '#323a46' },
    skill: 0.96,
  },
  {
    id: 'ai-kart',
    label: 'KART #1',
    carId: 'kart',
    number: 1,
    palette: { body: '#3a7bd5', shade: '#214b8f', highlight: '#9cc4ff', stripe: '#f6f1e4', glass: '#1f2a33', wheel: '#323a46' },
    skill: 0.95,
  },
  {
    id: 'ai-tanduk',
    label: 'TANDUK #14',
    carId: 'tanduk',
    number: 14,
    palette: { body: '#2a62c9', shade: '#1a3f8a', highlight: '#70a8ff', stripe: '#f4c63d', glass: '#263a4d', wheel: '#323a46' },
    skill: 0.97,
  },
  {
    id: 'ai-bima',
    label: 'BIMA #8',
    carId: 'bima',
    number: 8,
    palette: { body: '#d9352b', shade: '#8c1b16', highlight: '#ff8578', stripe: '#f5efe0', glass: '#263a4d', wheel: '#323a46' },
    skill: 0.99,
  },
  {
    id: 'ai-rota',
    label: 'ROTA #77',
    carId: 'rota',
    number: 77,
    palette: { body: '#f2be2e', shade: '#ad7c12', highlight: '#ffea8a', stripe: '#323b47', glass: '#263a4d', wheel: '#323a46' },
    skill: 0.98,
  },
];

export const CAR_COLORS: Record<CarId, CarColorOption[]> = {
  sirip: [
    { id: 'coral', label: 'Koral Api', palette: CARS.sirip.palette },
    {
      id: 'ocean',
      label: 'Biru Samudra',
      palette: { body: '#2f7de1', shade: '#1b4f9c', highlight: '#82beff', stripe: '#f7e6c4', glass: '#223447', wheel: '#181b22' },
    },
    {
      id: 'rally',
      label: 'Putih Reli',
      palette: { body: '#eef2f6', shade: '#9ca8b4', highlight: '#ffffff', stripe: '#e64833', glass: '#223447', wheel: '#181b22' },
    },
    {
      id: 'taxi',
      label: 'Kuning Taksi',
      palette: { body: '#f2b938', shade: '#b57b1b', highlight: '#ffe88a', stripe: '#323b47', glass: '#223447', wheel: '#323a46' },
    },
  ],
  go: [
    { id: 'silver', label: 'Putih Kota', palette: CARS.go.palette },
    {
      id: 'sunset',
      label: 'Oranye Senja',
      palette: { body: '#e8742f', shade: '#a3471b', highlight: '#ffc08a', stripe: '#f4ece0', glass: '#233746', wheel: '#323a46' },
    },
    {
      id: 'mint',
      label: 'Hijau Mint',
      palette: { body: '#4eb89a', shade: '#287561', highlight: '#9ef0d6', stripe: '#f7f1e3', glass: '#233746', wheel: '#323a46' },
    },
    {
      id: 'navy',
      label: 'Biru Malam',
      palette: { body: '#36588c', shade: '#1f3659', highlight: '#7da5e0', stripe: '#f5b942', glass: '#233746', wheel: '#323a46' },
    },
  ],
  bagas: [
    { id: 'amber', label: 'Emas Gurun', palette: CARS.bagas.palette },
    {
      id: 'crimson',
      label: 'Merah Bara',
      palette: { body: '#d93829', shade: '#8d1d18', highlight: '#ff8a73', stripe: '#f5f0e1', glass: '#243b47', wheel: '#323a46' },
    },
    {
      id: 'carbon',
      label: 'Abu Karbon',
      palette: { body: '#434d5b', shade: '#2a313b', highlight: '#8594a8', stripe: '#ff8f3d', glass: '#243b47', wheel: '#323a46' },
    },
    {
      id: 'violet',
      label: 'Ungu Malam',
      palette: { body: '#7b4bc4', shade: '#4c2985', highlight: '#ba92ff', stripe: '#f2d06b', glass: '#243b47', wheel: '#323a46' },
    },
  ],
  okra: [
    { id: 'teal', label: 'Toska Pantai', palette: CARS.okra.palette },
    {
      id: 'forest',
      label: 'Hijau Rimba',
      palette: { body: '#3f7d47', shade: '#244e2a', highlight: '#7dc485', stripe: '#e8d49b', glass: '#203843', wheel: '#323a46' },
    },
    {
      id: 'steel',
      label: 'Biru Baja',
      palette: { body: '#4a6b8a', shade: '#2c445c', highlight: '#8ab1d6', stripe: '#ff9447', glass: '#203843', wheel: '#323a46' },
    },
    {
      id: 'terracotta',
      label: 'Merah Bata',
      palette: { body: '#b84a39', shade: '#782b20', highlight: '#e68c7d', stripe: '#f2e5cb', glass: '#203843', wheel: '#323a46' },
    },
  ],
  kepik: [
    { id: 'lime', label: 'Lime Segar', palette: CARS.kepik.palette },
    {
      id: 'flamingo',
      label: 'Pink Flamingo',
      palette: { body: '#d95b96', shade: '#8f2d5e', highlight: '#ff9ec9', stripe: '#ffffff', glass: '#23343b', wheel: '#323a46' },
    },
    {
      id: 'cyan',
      label: 'Sian Elektrik',
      palette: { body: '#2eb8d9', shade: '#17758f', highlight: '#8be8ff', stripe: '#323b47', glass: '#23343b', wheel: '#323a46' },
    },
    {
      id: 'tangerine',
      label: 'Oranye Jeruk',
      palette: { body: '#f07829', shade: '#a64514', highlight: '#ffb87a', stripe: '#fff3cc', glass: '#23343b', wheel: '#323a46' },
    },
  ],
  hachi: [
    { id: 'panda', label: 'Putih Tahu', palette: CARS.hachi.palette },
    {
      id: 'midnight',
      label: 'Grafit Malam',
      palette: { body: '#3f4754', shade: '#272d36', highlight: '#7e8b9e', stripe: '#f1f3f4', glass: '#1f2f3a', wheel: '#323a46' },
    },
    {
      id: 'redtop',
      label: 'Merah Puncak',
      palette: { body: '#d8362b', shade: '#8a1d17', highlight: '#ff8c7c', stripe: '#323b47', glass: '#1f2f3a', wheel: '#323a46' },
    },
    {
      id: 'blueline',
      label: 'Biru Garis',
      palette: { body: '#2f6fd1', shade: '#1b418a', highlight: '#8dbaff', stripe: '#f1f3f4', glass: '#1f2f3a', wheel: '#323a46' },
    },
  ],
  kart: [
    { id: 'redline', label: 'Merah Sirkuit', palette: CARS.kart.palette },
    {
      id: 'azure',
      label: 'Biru Pit',
      palette: { body: '#3a7bd5', shade: '#214b8f', highlight: '#9cc4ff', stripe: '#f6f1e4', glass: '#1f2a33', wheel: '#323a46' },
    },
    {
      id: 'lime',
      label: 'Hijau Neon',
      palette: { body: '#7ed321', shade: '#4a8a0f', highlight: '#c5f77a', stripe: '#323b47', glass: '#1f2a33', wheel: '#323a46' },
    },
    {
      id: 'amberkart',
      label: 'Oranye Paddock',
      palette: { body: '#f28c1c', shade: '#a85a0b', highlight: '#ffc27a', stripe: '#323b47', glass: '#1f2a33', wheel: '#323a46' },
    },
  ],
  tanduk: [
    { id: 'rally-blue', label: 'Biru Reli', palette: CARS.tanduk.palette },
    {
      id: 'ivory',
      label: 'Putih Gading',
      palette: { body: '#ece8dc', shade: '#9da299', highlight: '#ffffff', stripe: '#d93829', glass: '#263a4d', wheel: '#323a46' },
    },
    {
      id: 'forest-gold',
      label: 'Hijau Hutan',
      palette: { body: '#2d7a4f', shade: '#1a4a30', highlight: '#6bc490', stripe: '#f0b840', glass: '#263a4d', wheel: '#323a46' },
    },
    {
      id: 'ember',
      label: 'Merah Bara',
      palette: { body: '#d6412b', shade: '#8a2216', highlight: '#ff8a73', stripe: '#f7efe0', glass: '#263a4d', wheel: '#323a46' },
    },
  ],
  bima: [
    { id: 'crimson-gp', label: 'Merah Sirkuit', palette: CARS.bima.palette },
    {
      id: 'british-green',
      label: 'Hijau Balap',
      palette: { body: '#256b48', shade: '#14402a', highlight: '#5cb584', stripe: '#f2c144', glass: '#263a4d', wheel: '#323a46' },
    },
    {
      id: 'papaya',
      label: 'Oranye Papaya',
      palette: { body: '#f27927', shade: '#a34812', highlight: '#ffba7a', stripe: '#354963', glass: '#263a4d', wheel: '#323a46' },
    },
    {
      id: 'cobalt',
      label: 'Biru Kobalt',
      palette: { body: '#2d68c4', shade: '#193e7d', highlight: '#7cb3ff', stripe: '#f7f3e8', glass: '#263a4d', wheel: '#323a46' },
    },
  ],
  rota: [
    { id: 'sunburst', label: 'Kuning Surya', palette: CARS.rota.palette },
    {
      id: 'montego',
      label: 'Hijau Montego',
      palette: { body: '#23786e', shade: '#144a44', highlight: '#63c4b7', stripe: '#f5ebd6', glass: '#263a4d', wheel: '#323a46' },
    },
    {
      id: 'ruby',
      label: 'Merah Rubi',
      palette: { body: '#c73242', shade: '#7d1b27', highlight: '#ff7d8d', stripe: '#f2e8d5', glass: '#263a4d', wheel: '#323a46' },
    },
    {
      id: 'slate',
      label: 'Abu Granit',
      palette: { body: '#5f6f82', shade: '#394452', highlight: '#9db1c7', stripe: '#ff8f3d', glass: '#263a4d', wheel: '#323a46' },
    },
  ],
};

export function getCar(id: CarId): CarSpec {
  return CARS[id];
}

export function getCarPalette(id: CarId, colorIndex = 0): CarPalette {
  const options = CAR_COLORS[id];
  return options[colorIndex]?.palette ?? CARS[id].palette;
}

export function statRatio(car: CarSpec, key: 'topSpeed' | 'acceleration' | 'grip' | 'nitroBoost'): number {
  const values = {
    topSpeed: [200, 264],
    acceleration: [210, 272],
    grip: [7.6, 10.4],
    nitroBoost: [34, 86],
  } as const;
  const [min, max] = values[key];
  return Math.max(0, Math.min(1, (car.stats[key] - min) / (max - min)));
}
