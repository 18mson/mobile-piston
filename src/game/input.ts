import type { PlayerInput } from './types';
import { clamp } from './utils';

type TouchAction = 'left' | 'right' | 'brake' | 'nitro';

const DEADZONE = 0.18;

export class InputManager {
  private keys = new Set<string>();
  private touch: Record<TouchAction, boolean> = { left: false, right: false, brake: false, nitro: false };
  private gamepadSteer = 0;
  private gamepadBrake = false;
  private gamepadNitro = false;
  private gamepadPause = false;
  private prevGamepadPause = false;
  private gamepadCamera = false;
  private prevGamepadCamera = false;
  private cameraRequested = false;
  private resetRequested = false;
  private steer = 0;
  private pauseRequested = false;
  private manualThrottleUsed = false;
  private gamepadReset = false;
  private prevGamepadReset = false;
  lastSource: 'keyboard' | 'touch' | 'gamepad' = 'keyboard';

  setKey(code: string, pressed: boolean, isRepeat = false): void {
    if (pressed && !isRepeat) this.lastSource = 'keyboard';
    if (pressed) this.keys.add(code);
    else this.keys.delete(code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code)) {
      if (pressed && isRepeat && code === 'Space') return;
    }
  }

  clearKeys(): void {
    this.keys.clear();
  }

  setTouch(action: TouchAction, pressed: boolean): void {
    this.touch[action] = pressed;
    if (pressed) this.lastSource = 'touch';
  }

  clearTouch(): void {
    this.touch = { left: false, right: false, brake: false, nitro: false };
  }

  requestPause(): void {
    this.pauseRequested = true;
  }

  requestReset(): void {
    this.resetRequested = true;
  }

  consumePauseRequest(): boolean {
    if (!this.pauseRequested) return false;
    this.pauseRequested = false;
    return true;
  }

  consumeCameraRequest(): boolean {
    if (!this.cameraRequested) return false;
    this.cameraRequested = false;
    return true;
  }

  consumeResetRequest(): boolean {
    if (!this.resetRequested) return false;
    this.resetRequested = false;
    return true;
  }

  update(dt: number): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    let padSteer = 0;
    this.gamepadBrake = false;
    this.gamepadNitro = false;
    this.gamepadPause = false;
    this.gamepadCamera = false;
    this.gamepadReset = false;

    if (pad) {
      const axis = pad.axes[0] ?? 0;
      if (Math.abs(axis) > DEADZONE) {
        padSteer = ((Math.abs(axis) - DEADZONE) / (1 - DEADZONE)) * Math.sign(axis);
      }
      if (pad.buttons[14]?.pressed) padSteer = -1;
      if (pad.buttons[15]?.pressed) padSteer = 1;
      this.gamepadBrake = Boolean(pad.buttons[6]?.pressed || pad.buttons[1]?.pressed);
      this.gamepadNitro = Boolean(pad.buttons[7]?.pressed || pad.buttons[0]?.pressed);
      this.gamepadPause = Boolean(pad.buttons[9]?.pressed);
      this.gamepadCamera = Boolean(pad.buttons[3]?.pressed);
      this.gamepadReset = Boolean(pad.buttons[8]?.pressed || pad.buttons[12]?.pressed);
      if (padSteer !== 0 || this.gamepadBrake || this.gamepadNitro) this.lastSource = 'gamepad';
      if (this.gamepadPause && !this.prevGamepadPause) this.pauseRequested = true;
      if (this.gamepadCamera && !this.prevGamepadCamera) this.cameraRequested = true;
      if (this.gamepadReset && !this.prevGamepadReset) this.resetRequested = true;
      this.prevGamepadPause = this.gamepadPause;
      this.prevGamepadCamera = this.gamepadCamera;
      this.prevGamepadReset = this.gamepadReset;
      this.gamepadSteer = padSteer;
    } else {
      this.gamepadSteer = 0;
      this.prevGamepadPause = false;
      this.prevGamepadCamera = false;
      this.prevGamepadReset = false;
    }

    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touch.left;
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touch.right;
    let keyboardSteer = (right ? 1 : 0) - (left ? 1 : 0);
    if (this.gamepadSteer !== 0) keyboardSteer = this.gamepadSteer;
    const target = clamp(this.touch.left && this.touch.right ? 0 : keyboardSteer, -1, 1);
    const response = this.lastSource === 'gamepad' ? 18 : 15;
    this.steer += (target - this.steer) * Math.min(1, dt * response);
    if (Math.abs(this.steer) < 0.01) this.steer = 0;
  }

  getInput(): PlayerInput {
    const brake =
      this.keys.has('ArrowDown') ||
      this.keys.has('KeyS') ||
      this.keys.has('Space') ||
      this.touch.brake ||
      this.gamepadBrake;

    const manualGasPressed =
      this.keys.has('ArrowUp') ||
      this.keys.has('KeyW');

    if (manualGasPressed) {
      this.manualThrottleUsed = true;
    }

    let gas: boolean;
    if (this.manualThrottleUsed && this.lastSource === 'keyboard') {
      gas = manualGasPressed;
    } else {
      gas = !brake;
    }

    return {
      steer: clamp(this.steer, -1, 1),
      brake,
      nitro:
        this.keys.has('ShiftLeft') ||
        this.keys.has('ShiftRight') ||
        this.touch.nitro ||
        this.gamepadNitro,
      pause: false,
      gas,
    };
  }

  get isTouch(): boolean {
    return this.lastSource === 'touch';
  }
}
