import type { CarId, SaveData, TrackId } from './types';
import { CAR_ORDER } from './data/cars';
import { TRACK_ORDER } from './track/tracks';

export const SAVE_KEY = 'mobile-piston.save.v2';
export const LEGACY_SAVE_KEY = 'mobile-piston.save.v1';

export function defaultSave(): SaveData {
  return {
    version: 2,
    selectedCarId: 'sirip',
    selectedTrackId: 'teluk-sore',
    bestLapMs: {},
    audioMuted: false,
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
  return {
    version: 2,
    selectedCarId,
    selectedTrackId,
    bestLapMs,
    audioMuted: typeof data.audioMuted === 'boolean' ? data.audioMuted : false,
  };
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

export function persistSave(save: SaveData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }
}
