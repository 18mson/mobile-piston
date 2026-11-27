import { getSupabaseClient, getSupabaseRestConfig } from '../auth/supabaseClient';
import type { LapCount, TrackId } from '../types';

export interface PublicRoomInfo {
  roomCode: string;
  hostName: string;
  trackId: TrackId;
  totalLaps: LapCount;
  playerCount: number;
  maxPlayers: number;
  status: 'lobby' | 'countdown' | 'racing' | 'finished';
  updatedAt: string;
}

const STALE_ROOM_MS = 12_000;

export async function publishPublicRoom(info: Omit<PublicRoomInfo, 'updatedAt'>): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    const { error } = await client.from('rooms').upsert(
      {
        room_code: info.roomCode,
        host_name: info.hostName.slice(0, 16) || 'Host',
        track_id: info.trackId,
        total_laps: info.totalLaps,
        player_count: info.playerCount,
        max_players: info.maxPlayers,
        status: info.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'room_code' },
    );
    if (error) {
      console.warn('[roomDirectory] publishPublicRoom failed:', error.code, error.message);
    }
  } catch {
    // Best-effort directory publish; PeerJS room continues working regardless.
  }
}

export async function removePublicRoom(roomCode: string): Promise<void> {
  const client = getSupabaseClient();
  if (!client || !roomCode) return;
  try {
    await client.from('rooms').delete().eq('room_code', roomCode);
  } catch {
    // Best-effort cleanup.
  }
}

/** Sends a keepalive DELETE so room cleanup survives browser tab close / pagehide. */
export function removePublicRoomKeepalive(roomCode: string): void {
  const cfg = getSupabaseRestConfig();
  if (!cfg || !roomCode || typeof fetch === 'undefined') return;
  try {
    void fetch(`${cfg.url}/rest/v1/rooms?room_code=eq.${encodeURIComponent(roomCode)}`, {
      method: 'DELETE',
      keepalive: true,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
    }).catch(() => {});
  } catch {
    // Best-effort cleanup on unload.
  }
}

export async function listPublicRooms(): Promise<PublicRoomInfo[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  try {
    const cutoffIso = new Date(Date.now() - STALE_ROOM_MS).toISOString();
    const { data, error } = await client
      .from('rooms')
      .select('room_code, host_name, track_id, total_laps, player_count, max_players, status, updated_at')
      .in('status', ['lobby', 'countdown', 'racing'])
      .gte('updated_at', cutoffIso)
      .order('updated_at', { ascending: false })
      .limit(20);

    if (error || !data) {
      if (error) {
        console.warn('[roomDirectory] listPublicRooms failed:', error.code, error.message);
      }
      return [];
    }

    return data.map((row) => ({
      roomCode: String(row.room_code),
      hostName: String(row.host_name ?? 'Host'),
      trackId: (row.track_id as TrackId) ?? 'teluk-sore',
      totalLaps: (row.total_laps === 4 || row.total_laps === 5 ? row.total_laps : 3) as LapCount,
      playerCount: Number(row.player_count ?? 1),
      maxPlayers: Number(row.max_players ?? 8),
      status: (row.status as PublicRoomInfo['status']) ?? 'lobby',
      updatedAt: String(row.updated_at),
    }));
  } catch {
    return [];
  }
}
