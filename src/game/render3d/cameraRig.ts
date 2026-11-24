import * as THREE from 'three';
import type { RacerState } from '../types';
import { ROAD_Y, toSceneX, toSceneZ } from './constants';

export type CameraMode = 'top' | 'chase' | 'cockpit';

export const CAMERA_MODES: CameraMode[] = ['top', 'chase', 'cockpit'];

export interface CameraParams {
  posOffset: THREE.Vector3;
  targetOffset: THREE.Vector3;
  fov: number;
  followLag: number;
  isWorldRelative: boolean; // true for north-up top view, false for car-relative
}

export const CAMERA_TRANSITION_DURATION = 0.65; // ~0.65s damped smooth fly-through
export const TOP_DOWN_CAMERA_HEIGHT = 46.0;

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private modeIndex = 0; // 0: 'top' default
  private currentMode: CameraMode = 'top';

  // Smooth flight interpolation state
  private isTransitioning = false;
  private transitionTimer = 0;
  private transitionAlpha = 1.0;

  // Active blended states in world coordinates
  private currentCamPos = new THREE.Vector3();
  private currentCamTarget = new THREE.Vector3();
  private initialized = false;

  // Target and origin for smooth flight
  private startFlightPos = new THREE.Vector3();
  private startFlightLook = new THREE.Vector3();
  private fromFov = 46;
  private activeFov = 46;

  // Shake & kicks
  private shake = 0;
  private fovKick = 0;
  private reducedMotion = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(46, aspect, 0.1, 1600);
    this.setMode('top', true);
  }

  get mode(): CameraMode {
    return this.currentMode;
  }

  get inCockpit(): boolean {
    // Only consider fully in cockpit when transition is at least 85% complete
    // so outside car body is visible flying into the car from behind/above!
    return this.currentMode === 'cockpit' && (!this.isTransitioning || this.transitionAlpha > 0.85);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  cycle(): CameraMode {
    this.modeIndex = (this.modeIndex + 1) % CAMERA_MODES.length;
    this.setMode(CAMERA_MODES[this.modeIndex], false);
    return this.currentMode;
  }

  setMode(mode: CameraMode, immediate = false): void {
    const targetIdx = CAMERA_MODES.indexOf(mode);
    if (targetIdx !== -1) this.modeIndex = targetIdx;
    const prevMode = this.currentMode;
    this.currentMode = mode;

    if (immediate || !this.initialized) {
      this.isTransitioning = false;
      this.transitionTimer = 0;
      this.transitionAlpha = 1.0;
      this.activeFov = this.getBaseParams(mode).fov;
    } else if (prevMode !== mode || !this.isTransitioning) {
      // Begin smooth flying transition from current camera world position and lookAt
      this.startFlightPos.copy(this.currentCamPos);
      this.startFlightLook.copy(this.currentCamTarget);
      this.fromFov = this.camera.fov;
      this.transitionTimer = 0;
      this.transitionAlpha = 0;
      this.isTransitioning = true;
    }
  }

  triggerImpact(intensity: number): void {
    this.shake = Math.max(this.shake, Math.min(1.2, intensity));
  }

  reset(): void {
    this.initialized = false;
  }

  private getBaseParams(mode: CameraMode): CameraParams {
    switch (mode) {
      case 'top':
        return {
          posOffset: new THREE.Vector3(0, TOP_DOWN_CAMERA_HEIGHT, 14.0),
          targetOffset: new THREE.Vector3(0, 0, 0),
          fov: 46,
          followLag: 9.0,
          isWorldRelative: true,
        };
      case 'cockpit':
        return {
          posOffset: new THREE.Vector3(0.12, 1.85, 0.0), // Eye-level driver view
          targetOffset: new THREE.Vector3(30.0, 1.6, 0.0), // Looking forward along track
          fov: 70,
          followLag: 16.0,
          isWorldRelative: false,
        };
      case 'chase':
      default:
        return {
          posOffset: new THREE.Vector3(-19.0, 10.2, 0.0),
          targetOffset: new THREE.Vector3(18.0, 1.5, 0.0),
          fov: 59,
          followLag: 6.5,
          isWorldRelative: false,
        };
    }
  }

  private computeTargetWorld(player: RacerState, mode: CameraMode): { pos: THREE.Vector3; look: THREE.Vector3 } {
    const params = this.getBaseParams(mode);
    const carPos = new THREE.Vector3(toSceneX(player.x), ROAD_Y, toSceneZ(player.y));
    const speed = Math.hypot(player.vx, player.vy);
    const speedNorm = Math.min(1, speed / 210);
    const nitroActive = player.nitroActive;

    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();

    if (params.isWorldRelative) {
      // North-up fixed orientation with smooth speed/heading look-ahead
      const forwardHeading = new THREE.Vector3(Math.cos(player.angle), 0, Math.sin(player.angle));
      const lookAhead = forwardHeading.clone().multiplyScalar(THREE.MathUtils.lerp(4.0, 12.0, speedNorm));
      pos.copy(carPos).add(params.posOffset).add(lookAhead.clone().multiplyScalar(0.4));
      look.copy(carPos).add(lookAhead);
    } else {
      // Car-relative orientation (chase & cockpit)
      const cosA = Math.cos(player.angle);
      const sinA = Math.sin(player.angle);

      const pullBack = nitroActive ? (mode === 'chase' ? 2.5 : 0.3) : 0;
      const localPosX = params.posOffset.x - pullBack;
      const localPosY = params.posOffset.y;
      const localPosZ = params.posOffset.z;

      const worldOffsetX = localPosX * cosA - localPosZ * sinA;
      const worldOffsetZ = localPosX * sinA + localPosZ * cosA;
      pos.set(carPos.x + worldOffsetX, carPos.y + localPosY, carPos.z + worldOffsetZ);

      const localLookX = params.targetOffset.x;
      const localLookY = params.targetOffset.y;
      const localLookZ = params.targetOffset.z;

      const worldLookX = localLookX * cosA - localLookZ * sinA;
      const worldLookZ = localLookX * sinA + localLookZ * cosA;
      look.set(carPos.x + worldLookX, carPos.y + localLookY, carPos.z + worldLookZ);
    }

    return { pos, look };
  }

  update(player: RacerState, dt: number, impact: number): void {
    const speed = Math.hypot(player.vx, player.vy);
    const nitroActive = player.nitroActive;

    // Nitro FOV kick in all views
    const targetFovKick = nitroActive ? 5.5 : 0;
    this.fovKick = THREE.MathUtils.lerp(this.fovKick, targetFovKick, Math.min(1, dt * 8));

    const targetModeWorld = this.computeTargetWorld(player, this.currentMode);
    const targetParams = this.getBaseParams(this.currentMode);

    let desiredPos = targetModeWorld.pos;
    let desiredLook = targetModeWorld.look;

    if (this.isTransitioning) {
      this.transitionTimer += dt;
      const progress = Math.min(1, this.transitionTimer / CAMERA_TRANSITION_DURATION);
      // Smooth cubic ease-in-out
      const ease = progress * progress * (3 - 2 * progress);
      this.transitionAlpha = ease;

      // Blend FOV
      this.activeFov = THREE.MathUtils.lerp(this.fromFov, targetParams.fov, ease);

      if (progress >= 1) {
        this.isTransitioning = false;
        this.transitionAlpha = 1.0;
      }
    } else {
      this.activeFov = targetParams.fov;
      this.transitionAlpha = 1.0;
    }

    // Follow tracking
    if (!this.initialized || dt <= 0) {
      this.currentCamPos.copy(desiredPos);
      this.currentCamTarget.copy(desiredLook);
      this.initialized = true;
    } else {
      const followRate = this.isTransitioning ? 14.0 : targetParams.followLag;
      const alpha = 1 - Math.exp(-dt * followRate);
      this.currentCamPos.lerp(desiredPos, alpha);
      this.currentCamTarget.lerp(desiredLook, alpha * 0.94);
    }

    // Camera shake on impacts and cockpit rumble
    this.triggerImpact(impact > 0.2 ? impact : 0);
    this.shake = Math.max(0, this.shake - dt * 3.5);

    let shakeX = 0;
    let shakeY = 0;
    if (!this.reducedMotion) {
      const t = performance.now() * 0.06;
      if (this.shake > 0) {
        const amt = this.shake * 0.35;
        shakeX += Math.sin(t * 1.3) * amt;
        shakeY += Math.cos(t * 1.5) * amt;
      }
      if (this.currentMode === 'cockpit' && speed > 20 && !this.isTransitioning) {
        const rumbleAmt = (speed / 200) * 0.035;
        shakeX += Math.sin(t * 2.8) * rumbleAmt;
        shakeY += Math.cos(t * 3.2) * rumbleAmt;
      }
    }

    this.camera.position.set(
      this.currentCamPos.x + shakeX,
      this.currentCamPos.y + shakeY,
      this.currentCamPos.z,
    );
    this.camera.lookAt(this.currentCamTarget);

    this.camera.fov = this.activeFov + this.fovKick;
    this.camera.updateProjectionMatrix();
  }
}
