import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultSave, loadSave, normalizeSave, persistSave, SAVE_KEY } from '../save';
import type { CarId, CarUsage, SaveData } from '../types';
import { getSupabaseClient } from './supabaseClient';

export const SAVE_META_KEY = 'mobile-piston.save.meta.v1';
export const GUEST_BACKUP_KEY = 'mobile-piston.guest.v2';
export const PENDING_SYNC_KEY = 'mobile-piston.pending_sync.v1';
const SYNC_DEBOUNCE_MS = 2000;

interface SaveMeta {
  ownerUserId: string | null;
  updatedAt: number;
}

interface PendingSyncRecord {
  userId: string;
  data: SaveData;
  updatedAt: number;
}

/**
 * Merges local and remote saves deterministically:
 * - bestLapMs: smallest positive time per track
 * - unlocks: set union across both saves
 * - car/track/color/camera/audio preferences: taken from whichever save has newer updatedAt
 */
export function mergeSaves(
  localSave: SaveData,
  localUpdatedAt: number,
  remoteSave: SaveData | null,
  remoteUpdatedAt: number,
): SaveData {
  if (!remoteSave) return normalizeSave(localSave);
  const local = normalizeSave(localSave);
  const remote = normalizeSave(remoteSave);

  const mergedBest: Partial<Record<string, number>> = {};
  const allTracks = new Set([
    ...Object.keys(local.bestLapMs),
    ...Object.keys(remote.bestLapMs),
  ]);
  for (const trackId of allTracks) {
    const lv = local.bestLapMs[trackId];
    const rv = remote.bestLapMs[trackId];
    if (typeof lv === 'number' && typeof rv === 'number') {
      mergedBest[trackId] = Math.min(lv, rv);
    } else if (typeof lv === 'number') {
      mergedBest[trackId] = lv;
    } else if (typeof rv === 'number') {
      mergedBest[trackId] = rv;
    }
  }

  const mergedUnlocks = Array.from(
    new Set([...(local.unlocks ?? []), ...(remote.unlocks ?? [])]),
  );

  const mergedXp = Math.max(local.xp ?? 0, remote.xp ?? 0);

  const mergedUsage: Partial<Record<CarId, CarUsage>> = {};
  const usageCarIds = new Set<CarId>([
    ...((Object.keys(local.carUsage ?? {}) as CarId[])),
    ...((Object.keys(remote.carUsage ?? {}) as CarId[])),
  ]);
  for (const carId of usageCarIds) {
    const lu = local.carUsage?.[carId];
    const ru = remote.carUsage?.[carId];
    if (!lu && !ru) continue;
    mergedUsage[carId] = {
      races: Math.max(lu?.races ?? 0, ru?.races ?? 0),
      laps: Math.max(lu?.laps ?? 0, ru?.laps ?? 0),
      podiums: Math.max(lu?.podiums ?? 0, ru?.podiums ?? 0),
      driftSeconds: Math.max(lu?.driftSeconds ?? 0, ru?.driftSeconds ?? 0),
      cleanLaps: Math.max(lu?.cleanLaps ?? 0, ru?.cleanLaps ?? 0),
    };
  }

  const primary = remoteUpdatedAt > localUpdatedAt ? remote : local;
  const merged: SaveData = {
    ...primary,
    version: 2,
    bestLapMs: mergedBest,
  };
  if (mergedUnlocks.length > 0) {
    merged.unlocks = mergedUnlocks;
  }
  if (mergedXp > 0) {
    merged.xp = mergedXp;
  }
  if (Object.keys(mergedUsage).length > 0) {
    merged.carUsage = mergedUsage;
  }
  return normalizeSave(merged);
}

function readMeta(): SaveMeta {
  if (typeof window === 'undefined') return { ownerUserId: null, updatedAt: 0 };
  try {
    const raw = window.localStorage.getItem(SAVE_META_KEY);
    if (!raw) return { ownerUserId: null, updatedAt: 0 };
    const parsed = JSON.parse(raw) as Partial<SaveMeta>;
    return {
      ownerUserId: typeof parsed.ownerUserId === 'string' ? parsed.ownerUserId : null,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { ownerUserId: null, updatedAt: 0 };
  }
}

function writeMeta(meta: SaveMeta): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVE_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage error; caller observes persistSave() result.
  }
}

function readPendingSync(): PendingSyncRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingSyncRecord>;
    if (typeof parsed.userId !== 'string' || !parsed.data) return null;
    return {
      userId: parsed.userId,
      data: normalizeSave(parsed.data),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

function writePendingSync(record: PendingSyncRecord | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!record) {
      window.localStorage.removeItem(PENDING_SYNC_KEY);
    } else {
      window.localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(record));
    }
  } catch {
    // Best-effort offline queue persistence.
  }
}

export class CloudSaveSync {
  private debounceTimer: number | null = null;
  private activeUserId: string | null = null;
  private clientOverride: SupabaseClient | null;
  private onStorageError?: () => void;
  private onSyncError?: (message: string) => void;

  constructor(options?: {
    client?: SupabaseClient | null;
    onStorageError?: () => void;
    onSyncError?: (message: string) => void;
  }) {
    this.clientOverride = options?.client ?? null;
    this.onStorageError = options?.onStorageError;
    this.onSyncError = options?.onSyncError;
  }

  private getClient(): SupabaseClient | null {
    return this.clientOverride ?? getSupabaseClient();
  }

  /**
   * Saves progress locally immediately, and if logged in, queues a 2-second debounced
   * upsert to Supabase `game_saves` (with offline retry queue on failure).
   */
  saveLocalAndSchedule(save: SaveData, userId: string | null): boolean {
    const ok = persistSave(save);
    if (!ok) {
      this.onStorageError?.();
    }
    const now = Date.now();
    writeMeta({ ownerUserId: userId, updatedAt: now });

    if (!userId) return ok;

    this.activeUserId = userId;
    writePendingSync({ userId, data: save, updatedAt: now });

    if (typeof window !== 'undefined') {
      if (this.debounceTimer != null) {
        window.clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = window.setTimeout(() => {
        this.debounceTimer = null;
        void this.flushPending(userId);
      }, SYNC_DEBOUNCE_MS);
    }
    return ok;
  }

  /**
   * On login: backs up guest save if transitioning from guest, fetches remote `game_saves`,
   * merges using `mergeSaves`, persists locally, and pushes merged save back to server.
   */
  async syncOnLogin(userId: string): Promise<SaveData> {
    this.activeUserId = userId;
    const meta = readMeta();
    const localSave = loadSave();

    // Preserve guest progress separately so logout can restore guest state without leaking account data.
    if (meta.ownerUserId === null && typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify(localSave));
      } catch {
        this.onStorageError?.();
      }
    }

    const client = this.getClient();
    if (!client) {
      writeMeta({ ownerUserId: userId, updatedAt: Date.now() });
      return localSave;
    }

    try {
      const { data: row, error } = await client
        .from('game_saves')
        .select('data, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[CloudSaveSync] syncOnLogin failed:', error.code, error.message);
        writePendingSync({ userId, data: localSave, updatedAt: meta.updatedAt || Date.now() });
        this.onSyncError?.('Gagal mengambil progres akun dari cloud. Memakai data lokal.');
        return localSave;
      }

      const remoteSave = row?.data ? normalizeSave(row.data) : null;
      const remoteUpdatedAt = row?.updated_at ? Date.parse(row.updated_at) : 0;
      const localUpdatedAt = meta.ownerUserId === userId ? meta.updatedAt : Date.now();

      const merged = mergeSaves(localSave, localUpdatedAt, remoteSave, remoteUpdatedAt);
      const ok = persistSave(merged);
      if (!ok) this.onStorageError?.();

      const now = Date.now();
      writeMeta({ ownerUserId: userId, updatedAt: now });

      await this.pushToServer(userId, merged, now);
      return merged;
    } catch {
      writePendingSync({ userId, data: localSave, updatedAt: meta.updatedAt || Date.now() });
      return localSave;
    }
  }

  async flushPending(expectedUserId?: string): Promise<boolean> {
    if (this.debounceTimer != null && typeof window !== 'undefined') {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    const pending = readPendingSync();
    const userId = expectedUserId ?? this.activeUserId;
    if (!pending || !userId || pending.userId !== userId) return true;
    return this.pushToServer(userId, pending.data, pending.updatedAt);
  }

  private async pushToServer(userId: string, save: SaveData, updatedAt: number): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;
    try {
      const { error } = await client.from('game_saves').upsert(
        {
          user_id: userId,
          data: save,
          updated_at: new Date(updatedAt).toISOString(),
        },
        { onConflict: 'user_id' },
      );
      if (error) {
        console.warn('[CloudSaveSync] pushToServer failed:', error.code, error.message);
        writePendingSync({ userId, data: save, updatedAt });
        this.onSyncError?.('Gagal menyimpan progres ke cloud. Akan dicoba ulang saat online.');
        return false;
      }
      writePendingSync(null);
      return true;
    } catch {
      writePendingSync({ userId, data: save, updatedAt });
      return false;
    }
  }

  /**
   * Logout policy: clears the signed-in account's cached SAVE_KEY, metadata, and pending queue
   * so account progress never leaks into a subsequent guest session on a shared device,
   * and restores the pre-login guest backup if available (otherwise defaultSave()).
   */
  handleLogout(): SaveData {
    if (this.debounceTimer != null && typeof window !== 'undefined') {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.activeUserId = null;
    writePendingSync(null);

    if (typeof window === 'undefined') return defaultSave();

    let guestSave = defaultSave();
    try {
      const backupRaw = window.localStorage.getItem(GUEST_BACKUP_KEY);
      if (backupRaw) {
        guestSave = normalizeSave(JSON.parse(backupRaw));
      }
      window.localStorage.removeItem(SAVE_KEY);
      window.localStorage.removeItem(SAVE_META_KEY);
      window.localStorage.removeItem(GUEST_BACKUP_KEY);
      persistSave(guestSave);
    } catch {
      this.onStorageError?.();
    }
    return guestSave;
  }

  dispose(): void {
    if (this.debounceTimer != null && typeof window !== 'undefined') {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }
}
