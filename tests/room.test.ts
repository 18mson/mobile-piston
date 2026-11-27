import { describe, expect, it } from 'vitest';
import { GameRoom, RoomManager, sanitizeInput } from '../server/room';
import type { ServerMessage } from '../src/game/types';

describe('multiplayer room manager', () => {
  it('creates rooms, joins players, and promotes host on leave', () => {
    const manager = new RoomManager();
    const hostMsgs: ServerMessage[] = [];
    const guestMsgs: ServerMessage[] = [];

    const room = manager.createRoom('p1', 'Andi', 'sirip', 0, 'teluk-sore', (m) => hostMsgs.push(m));
    expect(room.roomCode).toHaveLength(5);
    expect(room.hostId).toBe('p1');
    expect(room.memberCount).toBe(1);

    const joinRes = manager.joinRoom(room.roomCode, 'p2', 'Budi', 'bagas', 1, (m) => guestMsgs.push(m));
    expect(joinRes.ok).toBe(true);
    expect(room.memberCount).toBe(2);

    const badJoin = manager.joinRoom('ZZZZZ', 'p3', 'Cici', 'okra', 0, () => {});
    expect(badJoin.ok).toBe(false);

    // Host leaves -> Budi becomes host
    manager.leaveCurrentRoom('p1');
    expect(room.memberCount).toBe(1);
    expect(room.hostId).toBe('p2');

    // Last player leaves -> room is cleaned up
    manager.leaveCurrentRoom('p2');
    expect(manager.roomCount).toBe(0);
  });

  it('runs countdown, steps physics with clamped inputs, and broadcasts snapshots', () => {
    const room = new GameRoom('ABC12', 'teluk-sore', 'host1');
    const msgs: ServerMessage[] = [];
    room.addMember('host1', 'Host', 'sirip', 0, (m) => msgs.push(m));
    room.addMember('guest1', 'Guest', 'kepik', 2, () => {});

    const started = room.startRace('host1', false);
    expect(started).toBe(true);
    expect(room.status).toBe('countdown');

    // Clamp extreme steer input
    const clamped = sanitizeInput({ steer: 99, brake: false, nitro: true, pause: false, gas: true });
    expect(clamped.steer).toBe(1);
    room.handleInput('host1', 1, { steer: 5, brake: false, nitro: true, pause: false, gas: true });

    // Advance past 3s countdown
    for (let i = 0; i < 35; i += 1) {
      room.step(0.1);
    }
    expect(room.status).toBe('racing');

    // Step race simulation with active input
    for (let i = 0; i < 10; i += 1) {
      room.handleInput('host1', i + 2, { steer: 5, brake: false, nitro: true, pause: false, gas: true });
      room.step(1 / 60);
    }

    const snap = room.getSnapshot();
    expect(snap).not.toBeNull();
    expect(snap!.mode).toBe('racing');
    expect(snap!.racers).toHaveLength(8);
    expect(snap!.lastProcessedSeq.host1).toBeGreaterThanOrEqual(2);
    const hostCar = snap!.racers.find((r) => r.id === 'host1')!;
    expect(hostCar.nitroActive).toBe(true);
  });

  it('allows disconnected racers to rejoin within grace window and evicts after timeout', () => {
    const manager = new RoomManager();
    const room = manager.createRoom('p1', 'Host', 'sirip', 0, 'teluk-sore', () => {});
    manager.joinRoom(room.roomCode, 'p2', 'Guest', 'bagas', 1, () => {});
    room.startRace('p1', false);

    // Guest disconnects mid-race: kept in room during grace window
    manager.handleDisconnect('p2');
    expect(room.memberCount).toBe(2);

    // Rejoins cleanly with new socket sender
    const rejoinMsgs: ServerMessage[] = [];
    const rejoined = manager.rejoinRoom(room.roomCode, 'p2', (m) => rejoinMsgs.push(m));
    expect(rejoined.ok).toBe(true);
    expect(rejoinMsgs.some((m) => m.type === 'race_started')).toBe(true);

    // If disconnected longer than 15s grace, sweeps and removes member
    room.markDisconnected('p2', 1000);
    room.step(0.016, 20000);
    expect(room.memberCount).toBe(1);
  });
});
