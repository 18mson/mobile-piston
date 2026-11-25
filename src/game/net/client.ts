import type {
  CarId,
  ClientMessage,
  PlayerInput,
  RaceResults,
  RoomStatePacket,
  ServerMessage,
  TrackId,
  WorldSnapshot,
} from '../types';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface NetClientCallbacks {
  onStatusChange?: (status: ConnectionStatus) => void;
  onWelcome?: (playerId: string) => void;
  onRoomState?: (room: RoomStatePacket) => void;
  onRaceStarted?: (payload: Extract<ServerMessage, { type: 'race_started' }>) => void;
  onSnapshot?: (snapshot: WorldSnapshot) => void;
  onRaceFinished?: (results: RaceResults) => void;
  onPing?: (pingMs: number) => void;
  onError?: (message: string) => void;
}

export function defaultWsUrl(): string {
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WS_URL) {
    return process.env.NEXT_PUBLIC_WS_URL;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || '127.0.0.1';
    return `${protocol}//${host}:8080`;
  }
  return 'ws://127.0.0.1:8080';
}

export class NetClient {
  private url: string;
  private socket: WebSocket | null = null;
  private callbacks: NetClientCallbacks;
  private pingTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private manualDisconnect = false;
  private reconnectAttempts = 0;
  private lastRoomCode: string | null = null;
  private lastPlayerId: string | null = null;
  status: ConnectionStatus = 'disconnected';
  playerId: string | null = null;
  pingMs: number | null = null;

  constructor(callbacks: NetClientCallbacks = {}, url = defaultWsUrl()) {
    this.callbacks = callbacks;
    this.url = url;
  }

  setCallbacks(callbacks: NetClientCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.manualDisconnect = false;
    this.setStatus('connecting');
    try {
      const ws = new WebSocket(this.url);
      this.socket = ws;

      ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startPingLoop();
        if (this.lastRoomCode && this.lastPlayerId) {
          this.send({ type: 'rejoin_room', roomCode: this.lastRoomCode, playerId: this.lastPlayerId });
        }
      };

      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        this.handleMessage(msg);
      };

      ws.onerror = () => {
        if (!this.lastRoomCode) {
          this.callbacks.onError?.('Gagal terhubung ke server multiplayer.');
        }
      };

      ws.onclose = () => {
        this.stopPingLoop();
        this.socket = null;
        this.setStatus('disconnected');
        if (!this.manualDisconnect && this.lastRoomCode && this.lastPlayerId && this.reconnectAttempts < 4) {
          this.reconnectAttempts += 1;
          const delay = Math.min(4000, this.reconnectAttempts * 1000);
          if (typeof window !== 'undefined') {
            this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
          }
        }
      };
    } catch {
      this.setStatus('disconnected');
      this.callbacks.onError?.('WebSocket tidak dapat dibuka.');
    }
  }

  disconnect(): void {
    this.manualDisconnect = true;
    if (this.reconnectTimer != null && typeof window !== 'undefined') {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPingLoop();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.playerId = null;
    this.lastPlayerId = null;
    this.lastRoomCode = null;
    this.pingMs = null;
    this.setStatus('disconnected');
  }

  createRoom(name: string, carId: CarId, colorIndex: number, trackId: TrackId): void {
    this.send({ type: 'create_room', name, carId, colorIndex, trackId });
  }

  joinRoom(roomCode: string, name: string, carId: CarId, colorIndex: number): void {
    this.send({ type: 'join_room', roomCode, name, carId, colorIndex });
  }

  updateLoadout(carId: CarId, colorIndex: number): void {
    this.send({ type: 'update_loadout', carId, colorIndex });
  }

  setTrack(trackId: TrackId): void {
    this.send({ type: 'set_track', trackId });
  }

  setReady(ready: boolean): void {
    this.send({ type: 'set_ready', ready });
  }

  startRace(): void {
    this.send({ type: 'start_race' });
  }

  sendInput(seq: number, input: PlayerInput): void {
    this.send({ type: 'input', seq, input });
  }

  private send(msg: ClientMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.callbacks.onStatusChange?.(status);
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    if (typeof window === 'undefined') return;
    this.send({ type: 'ping', sentAt: Date.now() });
    this.pingTimer = window.setInterval(() => {
      this.send({ type: 'ping', sentAt: Date.now() });
    }, 2000);
  }

  private stopPingLoop(): void {
    if (this.pingTimer != null && typeof window !== 'undefined') {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        this.playerId = msg.playerId;
        this.lastPlayerId = msg.playerId;
        this.callbacks.onWelcome?.(msg.playerId);
        break;
      case 'room_state':
        this.lastRoomCode = msg.roomCode;
        this.callbacks.onRoomState?.(msg);
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
