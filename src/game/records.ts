import { getSupabaseClient } from './auth/supabaseClient';
import { CAR_ORDER } from './data/cars';
import { TRACK_ORDER } from './track/tracks';
import type { CarId, TrackId } from './types';

export const TRACK_RECORDS_STORAGE_KEY = 'mobile-piston.track-records.v1';
const MAX_RECORDS_PER_TRACK = 15;

export interface TrackRecordEntry {
  trackId: TrackId;
  playerKey: string;
  playerName: string;
  carId: CarId;
  colorIndex: number;
  bestLapMs: number;
  totalTimeMs?: number | null;
  laps?: number;
  recordedAt: string;
}

export type TrackRecordsMap = Partial<Record<TrackId, TrackRecordEntry[]>>;

function isValidTrackId(value: unknown): value is TrackId {
  return typeof value === 'string' && TRACK_ORDER.includes(value as TrackId);
}

function isValidCarId(value: unknown): value is CarId {
  return typeof value === 'string' && CAR_ORDER.includes(value as CarId);
}

function normalizeEntry(raw: unknown): TrackRecordEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const trackId = obj.trackId ?? obj.track_id;
  const carId = obj.carId ?? obj.car_id;
  const playerName = String(obj.playerName ?? obj.player_name ?? '').trim().slice(0, 24);
  const playerKey = String(obj.playerKey ?? obj.player_key ?? (playerName ? `n:${playerName.toLowerCase()}` : '')).trim();
  const bestLapMs = Number(obj.bestLapMs ?? obj.best_lap_ms);
  if (!isValidTrackId(trackId) || !isValidCarId(carId) || !playerName || !playerKey) return null;
  if (!Number.isFinite(bestLapMs) || bestLapMs < 1000 || bestLapMs > 3_600_000) return null;

  const rawColor = Number(obj.colorIndex ?? obj.color_index ?? 0);
  const colorIndex = Number.isInteger(rawColor) ? Math.min(3, Math.max(0, rawColor)) : 0;
  const rawTotal = obj.totalTimeMs ?? obj.total_time_ms;
  const totalTimeMs =
    typeof rawTotal === 'number' && Number.isFinite(rawTotal) && rawTotal >= 1000 ? Math.round(rawTotal) : null;
  const rawLaps = Number(obj.laps ?? 3);
  const laps = rawLaps === 3 || rawLaps === 4 || rawLaps === 5 ? rawLaps : 3;
  const recordedAt = String(obj.recordedAt ?? obj.recorded_at ?? new Date().toISOString());

  return {
    trackId,
    playerKey,
    playerName,
    carId,
    colorIndex,
    bestLapMs: Math.round(bestLapMs),
    totalTimeMs,
    laps,
    recordedAt,
  };
}

export function mergeRecordLists(lists: readonly TrackRecordEntry[][]): TrackRecordsMap {
  const byTrack = new Map<TrackId, Map<string, TrackRecordEntry>>();
  for (const list of lists) {
    for (const entry of list) {
      let trackMap = byTrack.get(entry.trackId);
      if (!trackMap) {
        trackMap = new Map<string, TrackRecordEntry>();
        byTrack.set(entry.trackId, trackMap);
      }
      const prev = trackMap.get(entry.playerKey);
      if (!prev || entry.bestLapMs < prev.bestLapMs) {
        trackMap.set(entry.playerKey, entry);
      }
    }
  }
  const result: TrackRecordsMap = {};
  for (const [trackId, map] of byTrack.entries()) {
    result[trackId] = Array.from(map.values())
      .sort((a, b) => a.bestLapMs - b.bestLapMs || a.recordedAt.localeCompare(b.recordedAt))
      .slice(0, MAX_RECORDS_PER_TRACK);
  }
  return result;
}

export function loadLocalTrackRecords(): TrackRecordsMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(TRACK_RECORDS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return {};
    const entries = parsed.map(normalizeEntry).filter((item): item is TrackRecordEntry => item !== null);
    return mergeRecordLists([entries]);
  } catch {
    return {};
  }
}

function persistLocalTrackRecords(map: TrackRecordsMap): void {
  if (typeof window === 'undefined') return;
  try {
    const flat = Object.values(map).flat();
    window.localStorage.setItem(TRACK_RECORDS_STORAGE_KEY, JSON.stringify(flat));
  } catch {
    // Best-effort local leaderboard cache.
  }
}

export function recordTrackRecordLocally(entry: TrackRecordEntry): TrackRecordsMap {
  const current = loadLocalTrackRecords();
  const flat = Object.values(current).flat();
  const merged = mergeRecordLists([flat, [entry]]);
  persistLocalTrackRecords(merged);
  return merged;
}

export async function fetchTrackRecords(): Promise<TrackRecordsMap> {
  const local = loadLocalTrackRecords();
  const client = getSupabaseClient();
  if (!client) return local;

  try {
    const { data, error } = await client
      .from('track_records')
      .select('track_id, player_key, player_name, car_id, color_index, best_lap_ms, total_time_ms, laps, recorded_at')
      .order('best_lap_ms', { ascending: true })
      .limit(100);

    if (error || !Array.isArray(data)) {
      return local;
    }

    const remoteEntries = data.map(normalizeEntry).filter((item): item is TrackRecordEntry => item !== null);
    const localEntries = Object.values(local).flat();
    return mergeRecordLists([localEntries, remoteEntries]);
  } catch {
    return local;
  }
}

export async function submitTrackRecord(params: {
  trackId: TrackId;
  playerName: string;
  carId: CarId;
  colorIndex: number;
  bestLapMs: number;
  totalTimeMs?: number | null;
  laps?: number;
  userId?: string | null;
}): Promise<TrackRecordsMap> {
  const cleanName = params.playerName.trim().slice(0, 24) || 'Pembalap';
  const playerKey = params.userId ? `u:${params.userId}` : `n:${cleanName.toLowerCase()}`;
  const entry: TrackRecordEntry = {
    trackId: params.trackId,
    playerKey,
    playerName: cleanName,
    carId: params.carId,
    colorIndex: Math.min(3, Math.max(0, Math.floor(params.colorIndex))),
    bestLapMs: Math.round(params.bestLapMs),
    totalTimeMs: params.totalTimeMs ?? null,
    laps: params.laps ?? 3,
    recordedAt: new Date().toISOString(),
  };

  const localUpdated = recordTrackRecordLocally(entry);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.rpc('submit_track_record', {
        p_track_id: entry.trackId,
        p_player_name: entry.playerName,
        p_car_id: entry.carId,
        p_color_index: entry.colorIndex,
        p_best_lap_ms: entry.bestLapMs,
        p_total_time_ms: entry.totalTimeMs ?? null,
        p_laps: entry.laps ?? 3,
      });
    } catch {
      // Offline or migration not yet applied: local record remains cached.
    }
  }

  return localUpdated;
}
