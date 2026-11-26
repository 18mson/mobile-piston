import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  mapAuthError,
  normalizeUsername,
  toSyntheticEmail,
  validatePassword,
  validateUsername,
} from '../src/game/auth/supabaseClient';
import {
  CloudSaveSync,
  GUEST_BACKUP_KEY,
  mergeSaves,
  PENDING_SYNC_KEY,
} from '../src/game/auth/sync';
import { defaultSave, loadSave, persistSave, SAVE_KEY } from '../src/game/save';
import type { SaveData } from '../src/game/types';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe('username auth validation & synthetic email', () => {
  it('normalizes usernames to lowercase and maps to synthetic email', () => {
    expect(normalizeUsername('  PemBalap_86 ')).toBe('pembalap_86');
    expect(toSyntheticEmail('PemBalap_86')).toBe('pembalap_86@mobile-piston.local');
  });

  it('rejects invalid usernames and short passwords', () => {
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('bad name!')).not.toBeNull();
    expect(validateUsername('valid_user_01')).toBeNull();

    expect(validatePassword('1234567')).not.toBeNull();
    expect(validatePassword('12345678')).toBeNull();
  });

  it('maps duplicate username and 429 rate limits to friendly Indonesian errors without leaking login details', () => {
    expect(mapAuthError({ code: 'user_already_exists', message: 'User already registered' }, 'register')).toBe(
      'Username sudah dipakai.',
    );
    expect(mapAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'login')).toBe(
      'Username atau password salah.',
    );
    expect(mapAuthError({ status: 429, message: 'Too many requests' }, 'login')).toContain('Terlalu banyak percobaan');
  });
});

describe('cloud save merge & offline sync', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const localStorage = createMemoryStorage();
    Object.defineProperty(globalThis, 'window', {
      value: {
        localStorage,
        setTimeout: globalThis.setTimeout.bind(globalThis),
        clearTimeout: globalThis.clearTimeout.bind(globalThis),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('merges two browser saves taking minimum bestLapMs, union of unlocks, and newest car/color', () => {
    const localSave: SaveData = {
      ...defaultSave(),
      selectedCarId: 'hachi',
      selectedColors: { hachi: 2 },
      bestLapMs: { 'teluk-sore': 21500, 'mata-air': 18900 },
      unlocks: ['track-lereng'],
    };
    const remoteSave: SaveData = {
      ...defaultSave(),
      selectedCarId: 'kart',
      selectedColors: { kart: 1 },
      bestLapMs: { 'teluk-sore': 22400, 'lereng-kopi': 25100 },
      unlocks: ['car-kart'],
    };

    const merged = mergeSaves(localSave, 1000, remoteSave, 2000);
    expect(merged.bestLapMs).toEqual({
      'teluk-sore': 21500,
      'mata-air': 18900,
      'lereng-kopi': 25100,
    });
    expect(merged.unlocks).toEqual(['track-lereng', 'car-kart']);
    expect(merged.selectedCarId).toBe('kart');
    expect(merged.selectedColors).toEqual({ kart: 1 });
  });

  it('queues failed offline writes and flushes when back online', async () => {
    let online = false;
    const upserts: { user_id: string; data: SaveData }[] = [];

    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
        upsert: async (row: { user_id: string; data: SaveData }) => {
          if (!online) {
            return { error: { message: 'Failed to fetch' } };
          }
          upserts.push(row);
          return { error: null };
        },
      }),
    } as unknown as SupabaseClient;

    const sync = new CloudSaveSync({ client: mockClient });
    const save = { ...defaultSave(), selectedCarId: 'go' as const, bestLapMs: { 'teluk-sore': 20100 } };

    // Guest or offline save still persists locally
    expect(sync.saveLocalAndSchedule(save, 'user-a')).toBe(true);
    expect(loadSave().selectedCarId).toBe('go');
    expect(window.localStorage.getItem(PENDING_SYNC_KEY)).not.toBeNull();

    // Flush fails while offline, keeps pending queue intact
    expect(await sync.flushPending('user-a')).toBe(false);
    expect(upserts).toHaveLength(0);
    expect(window.localStorage.getItem(PENDING_SYNC_KEY)).not.toBeNull();

    // Back online -> flush succeeds and clears pending queue
    online = true;
    expect(await sync.flushPending('user-a')).toBe(true);
    expect(upserts).toHaveLength(1);
    expect(upserts[0].user_id).toBe('user-a');
    expect(upserts[0].data.bestLapMs['teluk-sore']).toBe(20100);
    expect(window.localStorage.getItem(PENDING_SYNC_KEY)).toBeNull();
    sync.dispose();
  });

  it('clears account cache on logout so account progress never leaks to guest mode', async () => {
    const guestSave: SaveData = { ...defaultSave(), selectedCarId: 'okra', bestLapMs: { 'teluk-sore': 29000 } };
    persistSave(guestSave);

    const accountRemote: SaveData = {
      ...defaultSave(),
      selectedCarId: 'bagas',
      bestLapMs: { 'teluk-sore': 19500 },
      unlocks: ['vip'],
    };

    const mockClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { data: accountRemote, updated_at: new Date().toISOString() },
              error: null,
            }),
          }),
        }),
        upsert: async () => ({ error: null }),
      }),
    } as unknown as SupabaseClient;

    const sync = new CloudSaveSync({ client: mockClient });
    const merged = await sync.syncOnLogin('user-a');
    expect(merged.bestLapMs['teluk-sore']).toBe(19500);
    expect(window.localStorage.getItem(GUEST_BACKUP_KEY)).not.toBeNull();

    // Logout restores guest save and removes account progress from SAVE_KEY
    const afterLogout = sync.handleLogout();
    expect(afterLogout.selectedCarId).toBe('okra');
    expect(afterLogout.bestLapMs['teluk-sore']).toBe(29000);
    expect(afterLogout.unlocks).toBeUndefined();
    expect(JSON.parse(window.localStorage.getItem(SAVE_KEY)!).selectedCarId).toBe('okra');
    sync.dispose();
  });

  it('notifies UI via onStorageError when localStorage write fails', () => {
    const onStorageError = vi.fn();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {},
      },
      configurable: true,
    });

    const sync = new CloudSaveSync({ onStorageError });
    const ok = sync.saveLocalAndSchedule(defaultSave(), null);
    expect(ok).toBe(false);
    expect(onStorageError).toHaveBeenCalledTimes(1);
    sync.dispose();
  });
});
