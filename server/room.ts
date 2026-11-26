import { getTrack } from '../src/game/track/tracks';
import { RaceSim, type RaceParticipant } from '../src/game/race';
import { clamp } from '../src/game/utils';
import type {
  CarId,
  PlayerInput,
  RoomPlayerInfo,
  RoomStatePacket,
  SequencedInput,
  ServerMessage,
  TrackId,
  WorldSnapshot,
} from '../src/game/types';

export const MAX_ROOM_PLAYERS = 6;
export const RECONNECT_GRACE_MS = 15_000;
const FIXED_STEP = 1 / 120;
const SNAPSHOT_INTERVAL_SECONDS = 1 / 30; // 30 Hz network broadcast
const MAX_HOLD_TICKS = 6; // Repeat last input briefly on jitter before falling back to neutral
const MAX_INPUT_QUEUE = 32;

export type SendMessageFn = (msg: ServerMessage) => void;

interface RoomMember {
  id: string;
  name: string;
  carId: CarId;
  colorIndex: number;
  ready: boolean;
  connected: boolean;
  disconnectedAt: number | null;
  send: SendMessageFn;
  latestInput: PlayerInput;
  lastSeq: number;
  lastEnqueuedSeq: number;
  inputQueue: SequencedInput[];
  emptyQueueTicks: number;
}

const NEUTRAL_INPUT: PlayerInput = { steer: 0, brake: false, nitro: false, pause: false, gas: false };

export function sanitizeInput(raw: PlayerInput): PlayerInput {
  return {
    steer: clamp(Number.isFinite(raw.steer) ? raw.steer : 0, -1, 1),
    brake: Boolean(raw.brake),
    nitro: Boolean(raw.nitro),
    pause: false,
    gas: raw.gas !== false,
  };
}

export class GameRoom {
  readonly roomCode: string;
  trackId: TrackId;
  hostId: string;
  status: 'lobby' | 'countdown' | 'racing' | 'finished' = 'lobby';
  private members = new Map<string, RoomMember>();
  private sim: RaceSim | null = null;
  private countdownRemaining = 0;
  private accumulator = 0;
  private snapshotAccum = 0;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private lastTickMs = 0;
  private allHumansFinishedTimer = 0;

  constructor(roomCode: string, trackId: TrackId, hostId: string) {
    this.roomCode = roomCode;
    this.trackId = trackId;
    this.hostId = hostId;
  }

  get memberCount(): number {
    return this.members.size;
  }

  hasMember(playerId: string): boolean {
    return this.members.has(playerId);
  }

  addMember(id: string, name: string, carId: CarId, colorIndex: number, send: SendMessageFn): boolean {
    if (this.members.size >= MAX_ROOM_PLAYERS || this.status !== 'lobby') {
      return false;
    }
    const cleanName = name.trim().slice(0, 16) || `Pembalap ${this.members.size + 1}`;
    this.members.set(id, {
      id,
      name: cleanName,
      carId,
      colorIndex,
      ready: id === this.hostId,
      connected: true,
      disconnectedAt: null,
      send,
      latestInput: { ...NEUTRAL_INPUT },
      lastSeq: 0,
      lastEnqueuedSeq: 0,
      inputQueue: [],
      emptyQueueTicks: 0,
    });
    this.broadcastRoomState();
    return true;
  }

  markDisconnected(id: string, nowMs = Date.now()): boolean {
    const member = this.members.get(id);
    if (!member) return false;
    if (this.status === 'lobby' || this.status === 'finished') {
      this.removeMember(id);
      return true;
    }
    member.connected = false;
    member.disconnectedAt = nowMs;
    member.latestInput = { ...NEUTRAL_INPUT };
    member.inputQueue.length = 0;
    member.emptyQueueTicks = MAX_HOLD_TICKS + 1;
    this.broadcastRoomState();
    return false;
  }

  rejoinMember(id: string, send: SendMessageFn): boolean {
    const member = this.members.get(id);
    if (!member) return false;
    member.connected = true;
    member.disconnectedAt = null;
    member.send = send;
    this.broadcastRoomState();

    if (this.sim && (this.status === 'countdown' || this.status === 'racing')) {
      const participants = this.sim.racers.map((r) => {
        const m = this.members.get(r.id);
        return {
          id: r.id,
          name: r.label,
          carId: r.carId,
          colorIndex: m?.colorIndex ?? 0,
          isHuman: Boolean(r.isHuman),
          number: r.number,
        };
      });
      send({
        type: 'race_started',
        trackId: this.trackId,
        participants,
      });
      const snap = this.getSnapshot();
      if (snap) send({ type: 'snapshot', snapshot: snap });
    }
    return true;
  }

  sweepExpiredDisconnects(nowMs = Date.now()): void {
    for (const [id, member] of this.members.entries()) {
      if (!member.connected && member.disconnectedAt != null && nowMs - member.disconnectedAt > RECONNECT_GRACE_MS) {
        this.removeMember(id);
      }
    }
  }

  removeMember(id: string): void {
    this.members.delete(id);
    if (this.members.size === 0) {
      this.stopLoop();
      return;
    }
    if (this.hostId === id) {
      const nextHost = this.members.keys().next().value;
      if (nextHost) {
        this.hostId = nextHost;
        const member = this.members.get(nextHost);
        if (member) member.ready = true;
      }
    }
    this.broadcastRoomState();
  }

  updateLoadout(id: string, carId: CarId, colorIndex: number, name?: string): void {
    const member = this.members.get(id);
    if (!member || this.status !== 'lobby') return;
    member.carId = carId;
    member.colorIndex = colorIndex;
    if (name !== undefined) {
      const cleaned = name.trim().slice(0, 16);
      if (cleaned) member.name = cleaned;
    }
    this.broadcastRoomState();
  }

  setTrack(id: string, trackId: TrackId): void {
    if (id !== this.hostId || this.status !== 'lobby') return;
    this.trackId = trackId;
    this.broadcastRoomState();
  }

  setReady(id: string, ready: boolean): void {
    const member = this.members.get(id);
    if (!member || this.status !== 'lobby') return;
    member.ready = ready;
    this.broadcastRoomState();
  }

  startRace(requesterId: string, startInterval = true): boolean {
    if (requesterId !== this.hostId || this.status !== 'lobby') return false;
    if (this.members.size === 0) return false;

    const track = getTrack(this.trackId);
    const participants: RaceParticipant[] = [];
    let idx = 1;
    for (const member of this.members.values()) {
      participants.push({
        id: member.id,
        label: member.name,
        carId: member.carId,
        colorIndex: member.colorIndex,
        number: idx,
      });
      member.latestInput = { ...NEUTRAL_INPUT };
      member.lastSeq = 0;
      member.lastEnqueuedSeq = 0;
      member.inputQueue.length = 0;
      member.emptyQueueTicks = 0;
      idx += 1;
    }

    this.sim = new RaceSim(track, participants[0].carId, {
      participants,
      localPlayerId: participants[0].id,
      fillWithAi: true,
    });

    this.status = 'countdown';
    this.countdownRemaining = 3;
    this.accumulator = 0;
    this.snapshotAccum = 0;
    this.allHumansFinishedTimer = 0;

    const participantList = this.sim.racers.map((r) => {
      const member = this.members.get(r.id);
      return {
        id: r.id,
        name: r.label,
        carId: r.carId,
        colorIndex: member?.colorIndex ?? 0,
        isHuman: Boolean(r.isHuman),
        number: r.number,
      };
    });

    this.broadcast({
      type: 'race_started',
      trackId: this.trackId,
      participants: participantList,
    });
    this.broadcastRoomState();
    this.broadcastSnapshot();

    if (startInterval) {
      this.startLoop();
    }
    return true;
  }

  handleInput(id: string, seq: number, input: PlayerInput, inputs?: SequencedInput[]): void {
    const member = this.members.get(id);
    if (!member) return;

    const batch = inputs && inputs.length > 0 ? inputs : [{ seq, input }];
    let added = false;
    for (const item of batch) {
      if (!Number.isFinite(item.seq) || item.seq <= member.lastSeq) continue;
      if (member.inputQueue.some((q) => q.seq === item.seq)) continue;
      member.inputQueue.push({
        seq: item.seq,
        input: sanitizeInput(item.input),
      });
      if (item.seq > member.lastEnqueuedSeq) {
        member.lastEnqueuedSeq = item.seq;
      }
      added = true;
    }

    if (added) {
      member.inputQueue.sort((a, b) => a.seq - b.seq);
      if (member.inputQueue.length > MAX_INPUT_QUEUE) {
        member.inputQueue.splice(0, member.inputQueue.length - MAX_INPUT_QUEUE);
      }
    }
  }

  private nowHighRes(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private startLoop(): void {
    this.stopLoop();
    this.lastTickMs = this.nowHighRes();
    this.loopTimer = setInterval(() => {
      const now = this.nowHighRes();
      const dt = Math.min(0.1, Math.max(0, (now - this.lastTickMs) / 1000));
      this.lastTickMs = now;
      this.step(dt);
    }, 1000 / 60);
  }

  stopLoop(): void {
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }

  step(dt: number, nowMs = Date.now()): void {
    this.sweepExpiredDisconnects(nowMs);
    if (!this.sim) return;

    if (this.status === 'countdown') {
      this.countdownRemaining = Math.max(0, this.countdownRemaining - dt);
      this.snapshotAccum += dt;
      if (this.snapshotAccum >= 0.1) {
        this.snapshotAccum = 0;
        this.broadcastSnapshot();
      }
      if (this.countdownRemaining <= 0) {
        this.status = 'racing';
        this.accumulator = 0;
        this.snapshotAccum = 0;
        this.broadcastRoomState();
        this.broadcastSnapshot();
      }
      return;
    }

    if (this.status !== 'racing') return;

    this.accumulator += dt;
    const inputMap = new Map<string, PlayerInput>();

    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < 12) {
      for (const member of this.members.values()) {
        const next = member.inputQueue.shift();
        if (next) {
          member.latestInput = next.input;
          member.lastSeq = next.seq;
          member.emptyQueueTicks = 0;
          inputMap.set(member.id, next.input);
        } else {
          member.emptyQueueTicks += 1;
          if (member.emptyQueueTicks <= MAX_HOLD_TICKS) {
            inputMap.set(member.id, member.latestInput);
          } else {
            inputMap.set(member.id, NEUTRAL_INPUT);
          }
        }
      }
      this.sim.update(FIXED_STEP, inputMap);
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }

    this.snapshotAccum += dt;
    if (this.snapshotAccum >= SNAPSHOT_INTERVAL_SECONDS) {
      this.snapshotAccum = 0;
      this.broadcastSnapshot();
    }

    const humanRacers = this.sim.racers.filter((r) => r.isHuman && this.members.has(r.id));
    const allHumansDone = humanRacers.length > 0 && humanRacers.every((r) => r.finished);
    if (allHumansDone) {
      this.allHumansFinishedTimer += dt;
    }

    if (this.sim.allFinished || this.allHumansFinishedTimer >= 4.0) {
      this.sim.completeRace();
      this.status = 'finished';
      this.stopLoop();
      this.broadcastSnapshot();
      this.broadcast({
        type: 'race_finished',
        results: this.sim.results(null),
      });
      this.broadcastRoomState();
    }
  }

  getSnapshot(): WorldSnapshot | null {
    if (!this.sim) return null;
    const lastProcessedSeq: Record<string, number> = {};
    for (const member of this.members.values()) {
      lastProcessedSeq[member.id] = member.lastSeq;
    }
    return {
      tick: this.sim.tick,
      elapsed: Math.round(this.sim.elapsed * 10000) / 10000,
      mode: this.status === 'countdown' ? 'countdown' : this.status === 'finished' ? 'finished' : 'racing',
      countdown: this.status === 'countdown' ? Math.max(1, Math.ceil(this.countdownRemaining)) : null,
      lastProcessedSeq,
      racers: this.sim.exportNetState().map((r) => ({
        ...r,
        x: Math.round(r.x * 100) / 100,
        y: Math.round(r.y * 100) / 100,
        angle: Math.round(r.angle * 1000) / 1000,
        vx: Math.round(r.vx * 100) / 100,
        vy: Math.round(r.vy * 100) / 100,
        steer: Math.round(r.steer * 1000) / 1000,
        nitro: Math.round(r.nitro * 10) / 10,
        s: Math.round(r.s * 100) / 100,
        progress: Math.round(r.progress * 100) / 100,
        yawRate: Math.round(r.yawRate * 1000) / 1000,
        longAccel: Math.round(r.longAccel * 100) / 100,
        padCooldown: r.padCooldown != null ? Math.round(r.padCooldown * 1000) / 1000 : undefined,
        wrongWayTime: r.wrongWayTime != null ? Math.round(r.wrongWayTime * 1000) / 1000 : undefined,
        stuckTime: r.stuckTime != null ? Math.round(r.stuckTime * 1000) / 1000 : undefined,
      })),
    };
  }

  private broadcastRoomState(): void {
    const players: RoomPlayerInfo[] = Array.from(this.members.values()).map((m) => ({
      id: m.id,
      name: m.name,
      carId: m.carId,
      colorIndex: m.colorIndex,
      ready: m.ready,
      isHost: m.id === this.hostId,
      connected: m.connected,
    }));
    const packet: RoomStatePacket = {
      type: 'room_state',
      roomCode: this.roomCode,
      trackId: this.trackId,
      hostId: this.hostId,
      status: this.status,
      players,
    };
    this.broadcast(packet);
  }

  private broadcastSnapshot(): void {
    const snapshot = this.getSnapshot();
    if (!snapshot) return;
    this.broadcast({ type: 'snapshot', snapshot });
  }

  private broadcast(msg: ServerMessage): void {
    for (const member of this.members.values()) {
      if (member.connected) {
        member.send(msg);
      }
    }
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private playerToRoom = new Map<string, string>();

  get roomCount(): number {
    return this.rooms.size;
  }

  private generateCode(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      let code = '';
      for (let i = 0; i < 5; i += 1) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return `MP${Date.now().toString().slice(-4)}`;
  }

  createRoom(
    hostId: string,
    name: string,
    carId: CarId,
    colorIndex: number,
    trackId: TrackId,
    send: SendMessageFn,
  ): GameRoom {
    this.leaveCurrentRoom(hostId);
    const code = this.generateCode();
    const room = new GameRoom(code, trackId, hostId);
    this.rooms.set(code, room);
    this.playerToRoom.set(hostId, code);
    room.addMember(hostId, name, carId, colorIndex, send);
    return room;
  }

  joinRoom(
    roomCode: string,
    playerId: string,
    name: string,
    carId: CarId,
    colorIndex: number,
    send: SendMessageFn,
  ): { ok: true; room: GameRoom } | { ok: false; error: string } {
    const normalized = roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room) {
      return { ok: false, error: `Room "${normalized}" tidak ditemukan.` };
    }
    if (room.status !== 'lobby') {
      return { ok: false, error: 'Balapan di room ini sudah dimulai.' };
    }
    if (room.memberCount >= MAX_ROOM_PLAYERS) {
      return { ok: false, error: 'Room sudah penuh (maksimal 6 pemain).' };
    }
    this.leaveCurrentRoom(playerId);
    const added = room.addMember(playerId, name, carId, colorIndex, send);
    if (!added) {
      return { ok: false, error: 'Gagal bergabung ke room.' };
    }
    this.playerToRoom.set(playerId, normalized);
    return { ok: true, room };
  }

  getRoomForPlayer(playerId: string): GameRoom | null {
    const code = this.playerToRoom.get(playerId);
    if (!code) return null;
    return this.rooms.get(code) ?? null;
  }

  rejoinRoom(
    roomCode: string,
    targetPlayerId: string,
    send: SendMessageFn,
  ): { ok: true; room: GameRoom } | { ok: false; error: string } {
    const normalized = roomCode.trim().toUpperCase();
    const room = this.rooms.get(normalized);
    if (!room || !room.hasMember(targetPlayerId)) {
      return { ok: false, error: 'Sesi balapan tidak ditemukan atau sudah berakhir.' };
    }
    const ok = room.rejoinMember(targetPlayerId, send);
    if (!ok) {
      return { ok: false, error: 'Gagal menyambungkan ulang ke room.' };
    }
    this.playerToRoom.set(targetPlayerId, normalized);
    return { ok: true, room };
  }

  handleDisconnect(playerId: string): void {
    const code = this.playerToRoom.get(playerId);
    if (!code) return;
    const room = this.rooms.get(code);
    if (!room) {
      this.playerToRoom.delete(playerId);
      return;
    }
    const removedImmediately = room.markDisconnected(playerId);
    if (removedImmediately) {
      this.playerToRoom.delete(playerId);
    }
    if (room.memberCount === 0) {
      room.stopLoop();
      this.rooms.delete(code);
    }
  }

  leaveCurrentRoom(playerId: string): void {
    const code = this.playerToRoom.get(playerId);
    if (!code) return;
    this.playerToRoom.delete(playerId);
    const room = this.rooms.get(code);
    if (!room) return;
    room.removeMember(playerId);
    if (room.memberCount === 0) {
      room.stopLoop();
      this.rooms.delete(code);
    }
  }
}
