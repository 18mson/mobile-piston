import { describe, expect, it } from 'vitest';
import { TELUK_SORE } from '../src/game/track/telukSore';
import { RaceSim } from '../src/game/race';
import type { PlayerInput } from '../src/game/types';

describe('multiplayer simulation core', () => {
  it('fills remaining slots with AI bots up to 8 racers', () => {
    const race = new RaceSim(TELUK_SORE, 'mcqueen', {
      participants: [
        { id: 'p1', label: 'Andi', carId: 'mcqueen', colorIndex: 1 },
        { id: 'p2', label: 'Budi', carId: 'doc', colorIndex: 2 },
      ],
      localPlayerId: 'p1',
      fillWithAi: true,
    });

    expect(race.racers).toHaveLength(8);
    const humans = race.racers.filter((r) => r.isHuman);
    const bots = race.racers.filter((r) => !r.isHuman);
    expect(humans).toHaveLength(2);
    expect(bots).toHaveLength(6);
    expect(race.player.id).toBe('p1');
    expect(race.racers.find((r) => r.id === 'p2')?.isPlayer).toBe(false);
  });

  it('steps multiple human players independently and deterministically', () => {
    const participants = [
      { id: 'p1', label: 'Player 1', carId: 'mcqueen' as const, colorIndex: 0 },
      { id: 'p2', label: 'Player 2', carId: 'mater' as const, colorIndex: 1 },
    ];

    const simA = new RaceSim(TELUK_SORE, 'mcqueen', { participants, localPlayerId: 'p1' });
    const simB = new RaceSim(TELUK_SORE, 'mcqueen', { participants, localPlayerId: 'p2' });

    const inputs = new Map<string, PlayerInput>([
      ['p1', { steer: 0.4, brake: false, nitro: true, pause: false, gas: true }],
      ['p2', { steer: -0.4, brake: false, nitro: false, pause: false, gas: true }],
    ]);

    for (let i = 0; i < 180; i += 1) {
      simA.update(1 / 120, inputs);
      simB.update(1 / 120, inputs);
    }

    expect(simA.tick).toBe(180);
    expect(simB.tick).toBe(180);

    const stateA = simA.exportNetState();
    const stateB = simB.exportNetState();
    expect(stateA).toEqual(stateB);

    const p1 = stateA.find((r) => r.id === 'p1')!;
    const p2 = stateA.find((r) => r.id === 'p2')!;
    expect(p1.nitroActive).toBe(true);
    expect(p2.nitroActive).toBe(false);
    expect(p1.angle).not.toBe(p2.angle);
  });

  it('round-trips net state accurately via exportNetState and applyNetState', () => {
    const participants = [
      { id: 'host', label: 'Host', carId: 'chick' as const },
      { id: 'guest', label: 'Guest', carId: 'doc' as const },
    ];
    const serverSim = new RaceSim(TELUK_SORE, 'chick', { participants, localPlayerId: 'host' });
    const clientSim = new RaceSim(TELUK_SORE, 'chick', { participants, localPlayerId: 'guest' });

    const inputs = new Map<string, PlayerInput>([
      ['host', { steer: 0.2, brake: false, nitro: true, pause: false, gas: true }],
      ['guest', { steer: -0.3, brake: false, nitro: false, pause: false, gas: true }],
    ]);

    for (let i = 0; i < 60; i += 1) {
      serverSim.update(1 / 120, inputs);
    }

    const exported = serverSim.exportNetState();
    clientSim.applyNetState(exported);

    expect(clientSim.exportNetState()).toEqual(exported);
  });
});
