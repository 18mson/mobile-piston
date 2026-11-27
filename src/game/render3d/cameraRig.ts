import * as THREE from 'three';
import type { RacerState } from '../types';
import { ROAD_Y, toSceneX, toSceneZ } from './constants';
import { shortestAngle } from '../utils';

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
export const TOP_DOWN_CAMERA_HEIGHT = 65.0;

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

  // Smoothed heading used by the top & chase cameras so drifts and spin-outs don't whip the view around
  private camHeading = 0;

  // Target and origin for smooth flight
  private startFlightPos = new THREE.Vector3();
  private startFlightLook = new THREE.Vector3();
  private fromFov = 46;
  private activeFov = 46;

  // Shake & kicks
  private shake = 0;
  private fovKick = 0;
  private reducedMotion = false;
  private celebrationTime = 0;

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

  syncFromWorld(pos: THREE.Vector3, look: THREE.Vector3): void {
    this.currentCamPos.copy(pos);
    this.currentCamTarget.copy(look);
    this.initialized = true;
  }

  private getBaseParams(mode: CameraMode): CameraParams {
    switch (mode) {
      case 'top':
        return {
          posOffset: new THREE.Vector3(0, TOP_DOWN_CAMERA_HEIGHT, 18.0),
          targetOffset: new THREE.Vector3(0, 0, 0),
          fov: 48,
          followLag: 8.0,
          isWorldRelative: true,
        };
      case 'cockpit':
        return {
          posOffset: new THREE.Vector3(0.42, 2.05, 0.0), // Elevated driver view for wide open road visibility
          targetOffset: new THREE.Vector3(30.0, 1.85, 0.0), // Looking forward along track
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

  /**
   * Heading the chase / top cameras follow. Normally the car's nose; when the car is sliding
   * sideways it leans toward the direction of travel, so a drift stays readable and a spin-out
   * doesn't spin the whole screen.
   */
  private updateHeading(player: RacerState, dt: number): void {
    const speed = Math.hypot(player.vx, player.vy);
    let target = player.angle;
    if (speed > 28) {
      const travel = Math.atan2(player.vy, player.vx);
      const slip = shortestAngle(player.angle, travel);
      const t = THREE.MathUtils.clamp((Math.abs(slip) - 0.15) / 0.75, 0, 1);
      const weight = t * t * (3 - 2 * t) * 0.85;
      target = player.angle + slip * weight;
    }
    if (!this.initialized || dt <= 0) {
      this.camHeading = target;
      return;
    }
    const rate = 1 - Math.exp(-dt * 9);
    this.camHeading += shortestAngle(this.camHeading, target) * rate;
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
      const forwardHeading = new THREE.Vector3(Math.cos(this.camHeading), 0, Math.sin(this.camHeading));
      const lookAheadDist = THREE.MathUtils.lerp(8.0, 26.0, speedNorm);
      const lookAhead = forwardHeading.clone().multiplyScalar(lookAheadDist);
      pos.copy(carPos).add(params.posOffset).add(lookAhead.clone().multiplyScalar(0.65));
      look.copy(carPos).add(lookAhead.clone().multiplyScalar(0.85));
    } else {
      // Car-relative orientation (chase & cockpit)
      const heading = mode === 'chase' ? this.camHeading : player.angle;
      const cosA = Math.cos(heading);
      const sinA = Math.sin(heading);

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

  private computeCelebrationTarget(player: RacerState): { pos: THREE.Vector3; look: THREE.Vector3; fov: number } {
    const carPos = new THREE.Vector3(toSceneX(player.x), ROAD_Y, toSceneZ(player.y));
    const t = this.celebrationTime;
    const phase = Math.floor(t / 4.5) % 4;
    const phaseT = t % 4.5;
    const carHeading = player.angle;

    let orbitAngle = carHeading + Math.PI + t * 0.55;
    let radius = 15.5;
    let height = 5.8;
    let fov = 54;
    let lookAhead = 2.0;

    if (phase === 1) {
      // Front-quarter hero angle sweeping across the nose
      orbitAngle = carHeading + 0.38 + (phaseT / 4.5 - 0.5) * 0.55;
      radius = 14.2;
      height = 3.8;
      fov = 50;
      lookAhead = 0.8;
    } else if (phase === 2) {
      // Low side-to-rear dynamic chase sweep
      orbitAngle = carHeading + Math.PI + Math.sin(t * 0.9) * 0.95;
      radius = 14.5;
      height = 4.2;
      fov = 58;
      lookAhead = 4.5;
    } else if (phase === 3) {
      // High sweeping crane / helicopter orbit
      orbitAngle = carHeading + Math.PI * 0.65 + phaseT * 0.48;
      radius = 24.0;
      height = 16.5;
      fov = 48;
      lookAhead = 3.0;
    }

    const pos = new THREE.Vector3(
      carPos.x + Math.cos(orbitAngle) * radius,
      carPos.y + height,
      carPos.z + Math.sin(orbitAngle) * radius,
    );
    const look = new THREE.Vector3(
      carPos.x + Math.cos(carHeading) * lookAhead,
      carPos.y + 1.35,
      carPos.z + Math.sin(carHeading) * lookAhead,
    );
    return { pos, look, fov };
  }

  update(player: RacerState, dt: number, impact: number, celebrate = false): void {
    const speed = Math.hypot(player.vx, player.vy);
    const nitroActive = player.nitroActive;

    // Nitro FOV kick in all views
    const targetFovKick = nitroActive ? 5.5 : 0;
    this.fovKick = THREE.MathUtils.lerp(this.fovKick, targetFovKick, Math.min(1, dt * 8));

    this.updateHeading(player, dt);
    if (celebrate) {
      this.celebrationTime += dt;
    } else {
      this.celebrationTime = 0;
    }
    const celebration = celebrate ? this.computeCelebrationTarget(player) : null;
    const targetModeWorld = celebration ?? this.computeTargetWorld(player, this.currentMode);
    const targetParams = this.getBaseParams(this.currentMode);

    let desiredPos = targetModeWorld.pos;
    let desiredLook = targetModeWorld.look;
    const desiredFov = celebration ? celebration.fov : targetParams.fov;

    if (this.isTransitioning) {
      this.transitionTimer += dt;
      const progress = Math.min(1, this.transitionTimer / CAMERA_TRANSITION_DURATION);
      // Smooth cubic ease-in-out
      const ease = progress * progress * (3 - 2 * progress);
      this.transitionAlpha = ease;

      // Blend FOV
      this.activeFov = THREE.MathUtils.lerp(this.fromFov, desiredFov, ease);

      if (progress >= 1) {
        this.isTransitioning = false;
        this.transitionAlpha = 1.0;
      }
    } else {
      this.activeFov = THREE.MathUtils.lerp(this.activeFov, desiredFov, celebrate ? Math.min(1, dt * 3) : 1);
      this.transitionAlpha = 1.0;
    }

    // Follow tracking
    if (!this.initialized || dt <= 0) {
      this.currentCamPos.copy(desiredPos);
      this.currentCamTarget.copy(desiredLook);
      this.initialized = true;
    } else {
      const followRate = this.isTransitioning ? 14.0 : celebrate ? 3.8 : targetParams.followLag;
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

    const speedRatio = Math.min(1.2, speed / 240);
    const speedFov = THREE.MathUtils.lerp(0, 6.0, Math.max(0, speedRatio - 0.25));
    this.camera.fov = this.activeFov + this.fovKick + speedFov;
    this.camera.updateProjectionMatrix();
  }
}
