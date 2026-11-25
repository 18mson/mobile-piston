import Peer, { type DataConnection } from 'peerjs';
import { GameRoom } from '../../../server/room';
import type {
  CarId,
  ClientMessage,
  PlayerInput,
  RoomStatePacket,
  ServerMessage,
  TrackId,
} from '../types';
import type { ConnectionStatus, NetClientCallbacks } from './client';

const ROOM_PREFIX = 'mp-piston-';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * Browser-hosted WebRTC PeerJS multiplayer client.
 * When creating a room, the host's browser runs GameRoom locally and accepts
 * DataConnection peers directly (working over Local WiFi LAN and the internet
 * with zero backend server required).
 */
export class PeerNetClient {
  private peer: Peer | null = null;
  private hostRoom: GameRoom | null = null;
  private guestConns = new Map<string, DataConnection>();
  private connToHost: DataConnection | null = null;
  private callbacks: NetClientCallbacks;
  private pingTimer: number | null = null;

  status: ConnectionStatus = 'disconnected';
  playerId: string | null = null;
  pingMs: number | null = null;

  constructor(callbacks: NetClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  setCallbacks(callbacks: NetClientCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  connect(): void {
    // PeerJS opens a peer lazily on createRoom or joinRoom; mark ready immediately.
    this.setStatus('connected');
  }

  disconnect(): void {
    this.stopPingLoop();
    if (this.hostRoom) {
      this.hostRoom.stopLoop();
      this.hostRoom = null;
    }
    for (const conn of this.guestConns.values()) {
      conn.close();
    }
    this.guestConns.clear();
    if (this.connToHost) {
      this.connToHost.close();
      this.connToHost = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.playerId = null;
    this.pingMs = null;
    this.setStatus('disconnected');
  }

  createRoom(name: string, carId: CarId, colorIndex: number, trackId: TrackId): void {
    this.disconnect();
    this.setStatus('connecting');

    const code = generateRoomCode();
    const peer = new Peer(`${ROOM_PREFIX}${code}`);
    this.peer = peer;

    peer.on('open', () => {
      this.playerId = 'host';
      this.pingMs = 0;
      this.callbacks.onWelcome?.('host');
      this.setStatus('connected');

      const room = new GameRoom(code, trackId, 'host');
      this.hostRoom = room;
      room.addMember('host', name, carId, colorIndex, (msg) => {
        this.handleServerMessage(msg);
      });
    });

    peer.on('connection', (conn) => {
      const guestId = `p-${Math.random().toString(36).slice(2, 7)}`;
      this.guestConns.set(guestId, conn);

      conn.on('data', (raw) => {
        const msg = raw as ClientMessage;
        if (!msg || typeof msg !== 'object') return;
        const room = this.hostRoom;
        if (!room) return;

        switch (msg.type) {
          case 'ping':
            if (conn.open) {
              conn.send({ type: 'pong', sentAt: msg.sentAt, serverTime: Date.now() } satisfies ServerMessage);
            }
            break;
          case 'join_room': {
            if (conn.open) {
              conn.send({ type: 'welcome', playerId: guestId } satisfies ServerMessage);
            }
            const ok = room.addMember(guestId, msg.name, msg.carId, msg.colorIndex, (sMsg) => {
              if (conn.open) conn.send(sMsg);
            });
            if (!ok && conn.open) {
              conn.send({
                type: 'error',
                message: 'Room penuh atau balapan sudah dimulai.',
              } satisfies ServerMessage);
            }
            break;
          }
          case 'update_loadout':
            room.updateLoadout(guestId, msg.carId, msg.colorIndex);
            break;
          case 'set_ready':
            room.setReady(guestId, msg.ready);
            break;
          case 'input':
            room.handleInput(guestId, msg.seq, msg.input);
            break;
        }
      });

      conn.on('close', () => {
        this.guestConns.delete(guestId);
        this.hostRoom?.markDisconnected(guestId);
      });
    });

    peer.on('error', (err) => {
      this.setStatus('disconnected');
      this.callbacks.onError?.(`Gagal membuat room P2P (${err.type ?? 'error'}). Coba lagi.`);
    });
  }

  joinRoom(roomCode: string, name: string, carId: CarId, colorIndex: number): void {
    const cleanCode = roomCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      this.callbacks.onError?.('Kode room tidak valid.');
      return;
    }

    this.disconnect();
    this.setStatus('connecting');

    const peer = new Peer();
    this.peer = peer;

    peer.on('open', () => {
      const conn = peer.connect(`${ROOM_PREFIX}${cleanCode}`, { reliable: true });
      this.connToHost = conn;

      conn.on('open', () => {
        this.setStatus('connected');
        conn.send({
          type: 'join_room',
          roomCode: cleanCode,
          name,
          carId,
          colorIndex,
        } satisfies ClientMessage);
        this.startPingLoop();
      });

      conn.on('data', (raw) => {
        this.handleServerMessage(raw as ServerMessage);
      });

      conn.on('close', () => {
        this.stopPingLoop();
        this.setStatus('disconnected');
        this.callbacks.onError?.('Koneksi ke Host terputus.');
      });
    });

    peer.on('error', (err) => {
      this.setStatus('disconnected');
      const msg =
        err.type === 'peer-unavailable'
          ? `Room "${cleanCode}" tidak ditemukan atau Host sudah keluar.`
          : `Gagal terhubung ke Host (${err.type ?? 'error'}).`;
      this.callbacks.onError?.(msg);
    });
  }

  updateLoadout(carId: CarId, colorIndex: number): void {
    if (this.hostRoom) {
      this.hostRoom.updateLoadout('host', carId, colorIndex);
    } else {
      this.sendToHost({ type: 'update_loadout', carId, colorIndex });
    }
  }

  setTrack(trackId: TrackId): void {
    if (this.hostRoom) {
      this.hostRoom.setTrack('host', trackId);
    }
  }

  setReady(ready: boolean): void {
    if (this.hostRoom) {
      this.hostRoom.setReady('host', ready);
    } else {
      this.sendToHost({ type: 'set_ready', ready });
    }
  }

  startRace(): void {
    if (this.hostRoom) {
      this.hostRoom.startRace('host', true);
    }
  }

  sendInput(seq: number, input: PlayerInput): void {
    if (this.hostRoom) {
      this.hostRoom.handleInput('host', seq, input);
    } else {
      this.sendToHost({ type: 'input', seq, input });
    }
  }

  private sendToHost(msg: ClientMessage): void {
    if (this.connToHost && this.connToHost.open) {
      this.connToHost.send(msg);
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    if (typeof window === 'undefined') return;
    this.sendToHost({ type: 'ping', sentAt: Date.now() });
    this.pingTimer = window.setInterval(() => {
      this.sendToHost({ type: 'ping', sentAt: Date.now() });
    }, 2000);
  }

  private stopPingLoop(): void {
    if (this.pingTimer != null && typeof window !== 'undefined') {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleServerMessage(msg: ServerMessage): void {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.callbacks.onWelcome?.(msg.playerId);
        break;
      case 'room_state':
        this.callbacks.onRoomState?.(msg as RoomStatePacket);
        break;
      case 'race_started':
        this.callbacks.onRaceStarted?.(msg);
        break;
      case 'snapshot':
        this.callbacks.onSnapshot?.(msg.snapshot);
        break;
      case 'race_finished':
        this.callbacks.onRaceFinished?.(msg.results);
        break;
      case 'pong': {
        const rtt = Math.max(1, Date.now() - msg.sentAt);
        this.pingMs = rtt;
        this.callbacks.onPing?.(rtt);
        break;
      }
      case 'error':
        this.callbacks.onError?.(msg.message);
        break;
    }
  }
}
