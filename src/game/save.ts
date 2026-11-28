import type { CarCosmetics, CarId, CarUsage, LapCount, SaveData, SavedCameraMode, TireId, TrackId, WeatherMode } from './types';
import { CAR_ORDER } from './data/cars';
import { getGlass, getRim } from './data/cosmetics';
import { isGlassUnlocked, isRimUnlocked, MAX_CAR_USAGE_STAT } from './garage';
import { TRACK_ORDER } from './track/tracks';
import { isCarUnlocked, isTireUnlocked, isTrackUnlocked, MAX_XP } from './progression';
import { TIRE_ORDER } from './data/tires';
import { WEATHER_MODES } from './weather';

export const SAVE_KEY = 'mobile-piston.save.v2';
export const LEGACY_SAVE_KEY = 'mobile-piston.save.v1';
const VALID_CAMERAS: SavedCameraMode[] = ['top', 'chase', 'cockpit'];

const LEGACY_CAR_MAP: Record<string, CarId> = {
  sirip: 'mcqueen',
  go: 'luigi',
  kart: 'guido',
  hachi: 'sally',
  kepik: 'chick',
  okra: 'mater',
  bagas: 'doc',
  tanduk: 'cruz',
  bima: 'francesco',
  rota: 'storm',
};

function resolveCarId(rawId: unknown): CarId | null {
  if (typeof rawId !== 'string') return null;
  if (CAR_ORDER.includes(rawId as CarId)) return rawId as CarId;
  return LEGACY_CAR_MAP[rawId] ?? null;
}

function sanitizeUsageCounter(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.min(MAX_CAR_USAGE_STAT, Math.floor(raw));
}

function normalizeCarUsage(raw: unknown): Partial<Record<CarId, CarUsage>> {
  const result: Partial<Record<CarId, CarUsage>> = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const [rawKey, val] of Object.entries(raw as Record<string, unknown>)) {
    const carId = resolveCarId(rawKey);
    if (!carId || !val || typeof val !== 'object') continue;
    const obj = val as Record<string, unknown>;
    const usage: CarUsage = {
      races: sanitizeUsageCounter(obj.races),
      laps: sanitizeUsageCounter(obj.laps),
      podiums: sanitizeUsageCounter(obj.podiums),
      driftSeconds: sanitizeUsageCounter(obj.driftSeconds),
      cleanLaps: sanitizeUsageCounter(obj.cleanLaps),
    };
    if (usage.races > 0 || usage.laps > 0 || usage.podiums > 0 || usage.driftSeconds > 0 || usage.cleanLaps > 0) {
      result[carId] = usage;
    }
  }
  return result;
}

function normalizeCosmetics(
  raw: unknown,
  carUsage: Partial<Record<CarId, CarUsage>>,
): Partial<Record<CarId, CarCosmetics>> {
  const result: Partial<Record<CarId, CarCosmetics>> = {};
  if (!raw || typeof raw !== 'object') return result;
  const usageSave = { carUsage };
  for (const [rawKey, val] of Object.entries(raw as Record<string, unknown>)) {
    const carId = resolveCarId(rawKey);
    if (!carId || !val || typeof val !== 'object') continue;
    const obj = val as Record<string, unknown>;
    const entry: CarCosmetics = {};
    if (typeof obj.rim === 'string' && getRim(obj.rim) && isRimUnlocked(carId, obj.rim, usageSave)) {
      entry.rim = obj.rim;
    }
    if (typeof obj.glass === 'string' && getGlass(obj.glass) && isGlassUnlocked(carId, obj.glass, usageSave)) {
      entry.glass = obj.glass;
    }
    if (entry.rim || entry.glass) {
      result[carId] = entry;
    }
  }
  return result;
}

export function defaultSave(): SaveData {
  return {
    version: 2,
    selectedCarId: 'mcqueen',
    selectedTrackId: 'teluk-sore',
    bestLapMs: {},
    audioMuted: false,
    cameraMode: 'top',
    selectedColors: {},
  };
}

export function normalizeSave(raw: unknown): SaveData {
  const fallback = defaultSave();
  if (!raw || typeof raw !== 'object') return fallback;
  const data = raw as Partial<SaveData>;
  let selectedCarId = resolveCarId(data.selectedCarId) ?? fallback.selectedCarId;
  let selectedTrackId = TRACK_ORDER.includes(data.selectedTrackId as TrackId)
    ? (data.selectedTrackId as TrackId)
    : fallback.selectedTrackId;
  const bestLapMs: Partial<Record<string, number>> = {};
  if (data.bestLapMs && typeof data.bestLapMs === 'object') {
    for (const [key, value] of Object.entries(data.bestLapMs)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        bestLapMs[key] = value;
      }
    }
  }
  const cameraMode = VALID_CAMERAS.includes(data.cameraMode as SavedCameraMode)
    ? (data.cameraMode as SavedCameraMode)
    : fallback.cameraMode;
  const selectedColors: Partial<Record<CarId, number>> = {};
  if (data.selectedColors && typeof data.selectedColors === 'object') {
    for (const [rawKey, idx] of Object.entries(data.selectedColors as Record<string, unknown>)) {
      const carId = resolveCarId(rawKey);
      if (carId && typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < 4) {
        selectedColors[carId] = idx;
      }
    }
  }
  const unlocks = Array.isArray(data.unlocks)
    ? Array.from(
        new Set(
          data.unlocks
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .map((item) => {
              if (!item.startsWith('car:')) return item;
              const mapped = resolveCarId(item.slice(4));
              return mapped ? `car:${mapped}` : item;
            }),
        ),
      )
    : undefined;

  const xp =
    typeof data.xp === 'number' && Number.isFinite(data.xp) ? Math.min(MAX_XP, Math.max(0, Math.floor(data.xp))) : 0;
  const selectedLaps: LapCount | undefined =
    data.selectedLaps === 3 || data.selectedLaps === 4 || data.selectedLaps === 5 ? data.selectedLaps : undefined;

  if (!isCarUnlocked(selectedCarId, { xp, unlocks })) {
    selectedCarId = fallback.selectedCarId;
  }
  if (!isTrackUnlocked(selectedTrackId, { xp, unlocks })) {
    selectedTrackId = fallback.selectedTrackId;
  }

  const normalized: SaveData = {
    version: 2,
    selectedCarId,
    selectedTrackId,
    bestLapMs,
    audioMuted: typeof data.audioMuted === 'boolean' ? data.audioMuted : false,
    cameraMode,
    selectedColors,
  };
  if (unlocks && unlocks.length > 0) {
    normalized.unlocks = unlocks;
  }
  if (xp > 0) {
    normalized.xp = xp;
  }
  if (selectedLaps && selectedLaps !== 3) {
    normalized.selectedLaps = selectedLaps;
  }
  const tire = data.selectedTire as TireId | undefined;
  if (tire && tire !== 'standard' && TIRE_ORDER.includes(tire) && isTireUnlocked(tire, { xp, unlocks })) {
    normalized.selectedTire = tire;
  }
  const weather = data.selectedWeather as WeatherMode | undefined;
  if (weather && weather !== 'clear' && WEATHER_MODES.includes(weather)) {
    normalized.selectedWeather = weather;
  }
  const carUsage = normalizeCarUsage(data.carUsage);
  if (Object.keys(carUsage).length > 0) {
    normalized.carUsage = carUsage;
  }
  const cosmetics = normalizeCosmetics(data.cosmetics, carUsage);
  if (Object.keys(cosmetics).length > 0) {
    normalized.cosmetics = cosmetics;
  }
  return normalized;
}

export function loadSave(): SaveData {
  if (typeof window === 'undefined') return defaultSave();
  try {
    const current = window.localStorage.getItem(SAVE_KEY);
    const raw = current ?? window.localStorage.getItem(LEGACY_SAVE_KEY);
    const save = raw ? normalizeSave(JSON.parse(raw)) : defaultSave();
    if (!current && raw) persistSave(save);
    return save;
  } catch {
    return defaultSave();
  }
}

export function persistSave(save: SaveData): boolean {
  if (typeof window === 'undefined') return true;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    // Caller can inspect boolean return value and show a UI warning when storage is blocked/full.
    return false;
  }
}
