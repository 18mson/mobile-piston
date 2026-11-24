import { afterEach, describe, expect, it, vi } from 'vitest';
import { InputManager } from '../src/game/input';

interface FakePad {
  id: string;
  index: number;
  connected: boolean;
  mapping: GamepadMappingType;
  axes: number[];
  buttons: { pressed: boolean; touched: boolean; value: number }[];
  timestamp: number;
  vibrationActuator: null;
}

function makePad(overrides: Partial<FakePad> = {}): FakePad {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  return {
    id: 'Test Pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons,
    timestamp: 0,
    vibrationActuator: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('input manager', () => {
  it('smooths keyboard steering and supports braking and nitro', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const input = new InputManager();
    input.setKey('KeyD', true);
    for (let i = 0; i < 45; i += 1) input.update(1 / 60);
    expect(input.getInput().steer).toBeGreaterThan(0.5);
    input.setKey('Space', true);
    input.setKey('KeyS', true);
    expect(input.getInput().nitro).toBe(true);
    expect(input.getInput().brake).toBe(true);
    input.clearKeys();
    for (let i = 0; i < 4; i += 1) input.update(1 / 60);
    expect(input.getInput().steer).toBeLessThan(0.5);
    input.setKey('KeyA', true);
    for (let i = 0; i < 45; i += 1) input.update(1 / 60);
    expect(input.getInput().steer).toBeLessThan(-0.5);
  });

  it('turns touch controls into the same driving input', () => {
    vi.stubGlobal('navigator', { getGamepads: () => [] });
    const input = new InputManager();
    input.setTouch('left', true);
    for (let i = 0; i < 45; i += 1) input.update(1 / 60);
    expect(input.getInput().steer).toBeLessThan(-0.5);
    input.setTouch('right', true);
    for (let i = 0; i < 15; i += 1) input.update(1 / 60);
    expect(Math.abs(input.getInput().steer)).toBeLessThan(0.1);
  });

  it('maps standard gamepad axes, triggers, and start edge', () => {
    const pad = makePad({ axes: [0.82, 0, 0, 0] });
    pad.buttons[7] = { pressed: true, touched: true, value: 1 };
    vi.stubGlobal('navigator', { getGamepads: () => [pad] });
    const input = new InputManager();
    for (let i = 0; i < 60; i += 1) input.update(1 / 60);
    expect(input.getInput().steer).toBeGreaterThan(0.5);
    expect(input.getInput().nitro).toBe(true);
    expect(input.consumePauseRequest()).toBe(false);

    pad.buttons[9] = { pressed: true, touched: true, value: 1 };
    input.update(1 / 60);
    expect(input.consumePauseRequest()).toBe(true);
    input.update(1 / 60);
    expect(input.consumePauseRequest()).toBe(false);
  });
});
