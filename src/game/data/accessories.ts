import type { AccessorySlot, CarId, SaveData } from '../types';
import { type CosmeticRequirement, getUsage, requirementProgress } from './cosmetics';

export type { AccessorySlot };

export interface AccessoryDef {
  id: string;
  label: string;
  slot: AccessorySlot;
  builder: string;
  replaces?: string;
  /** Cars that support this item mapped to their per-car unlock requirement. */
  cars: Partial<Record<CarId, CosmeticRequirement>>;
}

export const ACCESSORY_SLOTS: { id: AccessorySlot; label: string }[] = [
  { id: 'roof', label: 'Atap' },
  { id: 'front', label: 'Depan' },
  { id: 'rear', label: 'Belakang' },
  { id: 'side', label: 'Samping' },
];

export const ACCESSORIES: AccessoryDef[] = [
  // Shared accessories
  {
    id: 'antenna-flag',
    label: 'Bendera Antena',
    slot: 'roof',
    builder: 'antenna-flag',
    cars: {
      mcqueen: { kind: 'races', count: 3 },
      luigi: { kind: 'races', count: 2 },
      chick: { kind: 'races', count: 3 },
      doc: { kind: 'races', count: 4 },
      mater: { kind: 'races', count: 2 },
      cruz: { kind: 'races', count: 3 },
      ramone: { kind: 'races', count: 2 },
      fillmore: { kind: 'races', count: 2 },
      finn: { kind: 'races', count: 2 },
    },
  },
  {
    id: 'fog-lights',
    label: 'Lampu Kabut',
    slot: 'front',
    builder: 'fog-lights',
    cars: {
      mcqueen: { kind: 'races', count: 4 },
      sally: { kind: 'races', count: 3 },
      cruz: { kind: 'races', count: 4 },
      storm: { kind: 'races', count: 3 },
      doc: { kind: 'races', count: 5 },
      chick: { kind: 'races', count: 4 },
      finn: { kind: 'races', count: 3 },
      fillmore: { kind: 'races', count: 3 },
    },
  },
  {
    id: 'front-splitter',
    label: 'Splitter Karbon',
    slot: 'front',
    builder: 'front-splitter',
    cars: {
      storm: { kind: 'races', count: 4 },
      mcqueen: { kind: 'races', count: 5 },
      cruz: { kind: 'races', count: 5 },
      sally: { kind: 'races', count: 7 },
      luigi: { kind: 'races', count: 8 },
      shu: { kind: 'races', count: 4 },
      king: { kind: 'races', count: 5 },
    },
  },
  {
    id: 'mud-flaps',
    label: 'Penahan Lumpur',
    slot: 'rear',
    builder: 'mud-flaps',
    cars: {
      mater: { kind: 'races', count: 3 },
      chick: { kind: 'races', count: 5 },
      doc: { kind: 'races', count: 6 },
      cruz: { kind: 'races', count: 6 },
      mcqueen: { kind: 'races', count: 7 },
      fillmore: { kind: 'races', count: 5 },
      ramone: { kind: 'races', count: 4 },
    },
  },
  {
    id: 'side-skirts',
    label: 'Rok Samping',
    slot: 'side',
    builder: 'side-skirts',
    cars: {
      sally: { kind: 'races', count: 6 },
      storm: { kind: 'races', count: 6 },
      cruz: { kind: 'races', count: 7 },
      mcqueen: { kind: 'races', count: 8 },
      luigi: { kind: 'races', count: 9 },
      chick: { kind: 'races', count: 10 },
      finn: { kind: 'races', count: 6 },
      shu: { kind: 'races', count: 6 },
      king: { kind: 'races', count: 6 },
    },
  },
  {
    id: 'roof-beacon',
    label: 'Lampu Rotator',
    slot: 'roof',
    builder: 'roof-beacon',
    cars: {
      guido: { kind: 'races', count: 1 },
      mater: { kind: 'races', count: 6 },
      chick: { kind: 'podiums', count: 3 },
    },
  },
  {
    id: 'hood-scoop',
    label: 'Hood Scoop',
    slot: 'front',
    builder: 'hood-scoop',
    cars: {
      chick: { kind: 'races', count: 8 },
      storm: { kind: 'races', count: 10 },
      mcqueen: { kind: 'races', count: 12 },
    },
  },
  {
    id: 'gt-wing',
    label: 'Sayap GT',
    slot: 'rear',
    builder: 'gt-wing',
    replaces: 'rear-wing',
    cars: {
      luigi: { kind: 'races', count: 10 },
      cruz: { kind: 'races', count: 10 },
    },
  },
  {
    id: 'underglow',
    label: 'Lampu Kolong Neon',
    slot: 'side',
    builder: 'underglow',
    cars: {
      storm: { kind: 'races', count: 12 },
      mcqueen: { kind: 'drift', seconds: 120 },
      sally: { kind: 'drift', seconds: 90 },
      cruz: { kind: 'drift', seconds: 90 },
      luigi: { kind: 'drift', seconds: 90 },
    },
  },

  // Car-exclusive accessories
  {
    id: 'lightning-wing',
    label: 'Sayap Petir',
    slot: 'rear',
    builder: 'lightning-wing',
    replaces: 'rear-wing',
    cars: { mcqueen: { kind: 'podiums', count: 3 } },
  },
  {
    id: 'roof-scoop',
    label: 'Scoop Atap',
    slot: 'roof',
    builder: 'roof-scoop',
    cars: { mcqueen: { kind: 'races', count: 10 } },
  },
  {
    id: 'side-exhaust',
    label: 'Knalpot Samping',
    slot: 'side',
    builder: 'side-exhaust',
    cars: { mcqueen: { kind: 'wins', count: 2 } },
  },

  {
    id: 'tire-stack',
    label: 'Tumpukan Ban Mini',
    slot: 'roof',
    builder: 'tire-stack',
    cars: { luigi: { kind: 'races', count: 4 } },
  },
  {
    id: 'luggage-rack',
    label: 'Rak Bagasi',
    slot: 'rear',
    builder: 'luggage-rack',
    cars: { luigi: { kind: 'races', count: 7 } },
  },
  {
    id: 'gold-ornament',
    label: 'Hiasan Kap Emas',
    slot: 'front',
    builder: 'gold-ornament',
    cars: { luigi: { kind: 'cleanLaps', count: 5 } },
  },

  {
    id: 'long-forks',
    label: 'Garpu Panjang',
    slot: 'front',
    builder: 'long-forks',
    replaces: 'front-forks',
    cars: { guido: { kind: 'races', count: 3 } },
  },
  {
    id: 'tool-cart',
    label: 'Troli Perkakas',
    slot: 'rear',
    builder: 'tool-cart',
    cars: { guido: { kind: 'races', count: 5 } },
  },
  {
    id: 'tire-pole',
    label: 'Tiang Ban',
    slot: 'side',
    builder: 'tire-pole',
    cars: { guido: { kind: 'races', count: 8 } },
  },

  {
    id: 'ducktail',
    label: 'Ekor Bebek',
    slot: 'rear',
    builder: 'ducktail',
    replaces: 'rear-wing',
    cars: { sally: { kind: 'races', count: 4 } },
  },
  {
    id: 'chrome-sill',
    label: 'Sill Krom',
    slot: 'side',
    builder: 'chrome-sill',
    cars: { sally: { kind: 'races', count: 9 } },
  },
  {
    id: 'hood-emblem',
    label: 'Lambang Kap',
    slot: 'front',
    builder: 'hood-emblem',
    cars: { sally: { kind: 'drift', seconds: 60 } },
  },

  {
    id: 'stock-wing',
    label: 'Sayap Stock 80-an',
    slot: 'rear',
    builder: 'stock-wing',
    replaces: 'rear-wing',
    cars: { chick: { kind: 'races', count: 3 } },
  },
  {
    id: 'bull-guard',
    label: 'Pelindung Depan',
    slot: 'front',
    builder: 'bull-guard',
    cars: { chick: { kind: 'podiums', count: 2 } },
  },
  {
    id: 'exhaust-stacks',
    label: 'Knalpot Vertikal',
    slot: 'side',
    builder: 'exhaust-stacks',
    cars: { chick: { kind: 'races', count: 9 } },
  },

  {
    id: 'tow-boom',
    label: 'Derek & Kait',
    slot: 'rear',
    builder: 'tow-boom',
    replaces: 'tow-boom',
    cars: { mater: { kind: 'races', count: 4 } },
  },
  {
    id: 'bull-bar',
    label: 'Bull Bar',
    slot: 'front',
    builder: 'bull-bar',
    cars: { mater: { kind: 'races', count: 7 } },
  },
  {
    id: 'rusty-bucket',
    label: 'Ember Karatan',
    slot: 'front',
    builder: 'rusty-bucket',
    cars: { mater: { kind: 'wetRaces', count: 3 } },
  },

  {
    id: 'sun-visor',
    label: 'Visor Matahari',
    slot: 'roof',
    builder: 'sun-visor',
    cars: { doc: { kind: 'races', count: 5 } },
  },
  {
    id: 'hood-ornament',
    label: 'Patung Kap',
    slot: 'front',
    builder: 'hood-ornament',
    cars: { doc: { kind: 'races', count: 6 } },
  },
  {
    id: 'fender-skirts',
    label: 'Skirt Roda Putih',
    slot: 'side',
    builder: 'fender-skirts',
    cars: { doc: { kind: 'races', count: 9 } },
  },
  {
    id: 'spotlights',
    label: 'Lampu Sorot',
    slot: 'roof',
    builder: 'spotlights',
    cars: { doc: { kind: 'races', count: 12 } },
  },

  {
    id: 'trainer-rack',
    label: 'Rak Kerucut Latihan',
    slot: 'roof',
    builder: 'trainer-rack',
    cars: { cruz: { kind: 'races', count: 5 } },
  },
  {
    id: 'rear-diffuser',
    label: 'Diffuser Belakang',
    slot: 'rear',
    builder: 'rear-diffuser',
    cars: { cruz: { kind: 'races', count: 8 } },
  },

  {
    id: 'halo',
    label: 'Halo',
    slot: 'roof',
    builder: 'halo',
    cars: { francesco: { kind: 'races', count: 3 } },
  },
  {
    id: 'double-wing',
    label: 'Sayap Ganda',
    slot: 'rear',
    builder: 'double-wing',
    replaces: 'rear-wing',
    cars: { francesco: { kind: 'races', count: 6 } },
  },
  {
    id: 'front-flaps',
    label: 'Sayap Depan Lanjut',
    slot: 'front',
    builder: 'front-flaps',
    cars: { francesco: { kind: 'races', count: 9 } },
  },
  {
    id: 'sidepod-fins',
    label: 'Sirip Sidepod',
    slot: 'side',
    builder: 'sidepod-fins',
    cars: { francesco: { kind: 'races', count: 12 } },
  },

  {
    id: 'canards',
    label: 'Canard',
    slot: 'front',
    builder: 'canards',
    cars: { storm: { kind: 'races', count: 3 } },
  },
  {
    id: 'roof-scoop-storm',
    label: 'Scoop Atap',
    slot: 'roof',
    builder: 'roof-scoop',
    cars: { storm: { kind: 'races', count: 5 } },
  },
  {
    id: 'carbon-wing',
    label: 'Sayap Karbon Besar',
    slot: 'rear',
    builder: 'carbon-wing',
    replaces: 'rear-wing',
    cars: { storm: { kind: 'races', count: 7 } },
  },

  // New character exclusives (Ramone, Fillmore, Finn, Shu, King)
  {
    id: 'lowrider-pipes',
    label: 'Knalpot Krom Lowrider',
    slot: 'side',
    builder: 'side-exhaust',
    cars: { ramone: { kind: 'drift', seconds: 45 } },
  },
  {
    id: 'ramone-visor',
    label: 'Visor Lowrider',
    slot: 'roof',
    builder: 'sun-visor',
    cars: { ramone: { kind: 'races', count: 5 } },
  },
  {
    id: 'surfboard-rack',
    label: 'Rak Papan Selancar',
    slot: 'roof',
    builder: 'surfboard-rack',
    cars: { fillmore: { kind: 'races', count: 3 } },
  },
  {
    id: 'bus-chrome-sill',
    label: 'Trim Krom Samping',
    slot: 'side',
    builder: 'chrome-sill',
    cars: { fillmore: { kind: 'races', count: 6 } },
  },
  {
    id: 'spy-wing',
    label: 'Sayap Agen',
    slot: 'rear',
    builder: 'spy-wing',
    cars: { finn: { kind: 'wins', count: 2 } },
  },
  {
    id: 'spy-ornament',
    label: 'Emblem Agen',
    slot: 'front',
    builder: 'hood-emblem',
    cars: { finn: { kind: 'cleanLaps', count: 4 } },
  },
  {
    id: 'shu-roof-scoop',
    label: 'Scoop Atap LMP',
    slot: 'roof',
    builder: 'roof-scoop',
    cars: { shu: { kind: 'races', count: 3 } },
  },
  {
    id: 'shu-canards',
    label: 'Canard Kabuki',
    slot: 'front',
    builder: 'canards',
    cars: { shu: { kind: 'podiums', count: 3 } },
  },
  {
    id: 'superbird-wing',
    label: 'Sayap Superbird Kontras',
    slot: 'rear',
    builder: 'superbird-wing',
    replaces: 'rear-wing',
    cars: { king: { kind: 'podiums', count: 2 } },
  },
  {
    id: 'king-roof-scoop',
    label: 'Scoop Atap Aero',
    slot: 'roof',
    builder: 'roof-scoop',
    cars: { king: { kind: 'races', count: 4 } },
  },
];

export function getAccessory(id: string | undefined): AccessoryDef | undefined {
  if (!id) return undefined;
  return ACCESSORIES.find((item) => item.id === id);
}

export function accessoriesForCar(carId: CarId): AccessoryDef[] {
  return ACCESSORIES.filter((item) => item.cars[carId] != null);
}

export function isAccessoryAvailable(carId: CarId, id: string): boolean {
  const def = getAccessory(id);
  return Boolean(def && def.cars[carId] != null);
}

export function isAccessoryUnlocked(carId: CarId, id: string, save: Pick<SaveData, 'carUsage'>): boolean {
  const def = getAccessory(id);
  const req = def?.cars[carId];
  if (!req) return false;
  return requirementProgress(req, getUsage(save, carId)).done;
}

export function isExclusive(def: AccessoryDef): boolean {
  return Object.keys(def.cars).length === 1;
}
