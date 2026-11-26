import type { CarId, SaveData, SavedCameraMode, TrackId } from './types';
import { CAR_ORDER } from './data/cars';
import { TRACK_ORDER } from './track/tracks';

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
  const selectedCarId = CAR_ORDER.includes(data.selectedCarId as CarId)
    ? (data.selectedCarId as CarId)
    : fallback.selectedCarId;
  const selectedTrackId = TRACK_ORDER.includes(data.selectedTrackId as TrackId)
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
