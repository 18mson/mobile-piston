import type { CarId, LapCount, SaveData, SavedCameraMode, TireId, TrackId, WeatherMode } from './types';
import { CAR_ORDER } from './data/cars';
import { TRACK_ORDER } from './track/tracks';
import { isCarUnlocked, isTireUnlocked, isTrackUnlocked, MAX_XP } from './progression';
import { TIRE_ORDER } from './data/tires';
import { WEATHER_MODES } from './weather';

export const SAVE_KEY = 'mobile-piston.save.v2';
export const LEGACY_SAVE_KEY = 'mobile-piston.save.v1';
const VALID_CAMERAS: SavedCameraMode[] = ['top', 'chase', 'cockpit'];

export function defaultSave(): SaveData {
  return {
    version: 2,
    selectedCarId: 'sirip',
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
  let selectedCarId = CAR_ORDER.includes(data.selectedCarId as CarId)
    ? (data.selectedCarId as CarId)
    : fallback.selectedCarId;
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
    for (const carId of CAR_ORDER) {
      const idx = (data.selectedColors as Record<string, unknown>)[carId];
      if (typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx < 4) {
        selectedColors[carId] = idx;
      }
    }
  }
  const unlocks = Array.isArray(data.unlocks)
    ? Array.from(
        new Set(
          data.unlocks.filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
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
