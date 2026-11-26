import { getSupabaseClient } from '../auth/supabaseClient';
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

const STALE_ROOM_MS = 35_000;

export async function publishPublicRoom(info: Omit<PublicRoomInfo, 'updatedAt'>): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  try {
    await client.from('rooms').upsert(
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

    if (error || !data) return [];

    return data.map((row) => ({
      roomCode: String(row.room_code),
      hostName: String(row.host_name ?? 'Host'),
      trackId: (row.track_id as TrackId) ?? 'teluk-sore',
      totalLaps: (row.total_laps === 4 || row.total_laps === 5 ? row.total_laps : 3) as LapCount,
      playerCount: Number(row.player_count ?? 1),
      maxPlayers: Number(row.max_players ?? 6),
      status: (row.status as PublicRoomInfo['status']) ?? 'lobby',
      updatedAt: String(row.updated_at),
    }));
  } catch {
    return [];
  }
}
