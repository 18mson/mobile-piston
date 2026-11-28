import * as THREE from 'three';
import type { CarId, CarPalette, RacerState } from '../types';
import { ROAD_Y, toSceneX, toSceneZ } from './constants';
import { createGlassMaterial, syncGlassSunLocal } from './glassMaterial';
import { GREENHOUSE } from './greenhouse';
import { CarEffects } from './cars/effects';
import { buildCompactCab } from './cars/models/compactCab';
import { buildCoupeRacer } from './cars/models/coupeRacer';
import { buildFormulaCar } from './cars/models/formula';
import { OUTLINE_COLOR, createToonMaterial, getToonRamp } from './cars/primitives';
import { addDropShadow } from './cars/trimAndDecals';
import type { CarBuildContext, CarMaterials, WheelRef } from './cars/types';

function createCarMaterials(carId: CarId, palette: CarPalette): CarMaterials {
  const body = createToonMaterial(palette.body);
  const shade = createToonMaterial(palette.shade);
  const darkTrim = createToonMaterial('#2e3742');
  const wellColor = new THREE.Color(palette.wheel).lerp(new THREE.Color('#14181f'), 0.28);
  const ghSpec = GREENHOUSE[carId];
  const pillar = ghSpec?.pillar === 'shade' ? shade : ghSpec?.pillar === 'darkTrim' ? darkTrim : body;

  return {
    body,
    shade,
    highlight: createToonMaterial(palette.highlight),
    glass: createGlassMaterial(palette.glass, getToonRamp(), palette.glassGlint ?? 1),
    stripe: createToonMaterial(palette.stripe),
    chrome: createToonMaterial('#e8ecf0'),
    darkTrim,
    pillar,
    well: new THREE.MeshToonMaterial({ color: wellColor, gradientMap: getToonRamp() }),
    lip: body,
    rearLip: carId === 'mater' ? shade : null,
    light: new THREE.MeshBasicMaterial({ color: '#fff5b8' }),
    tail: new THREE.MeshBasicMaterial({ color: '#ff3a2b' }),
    outline: new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide }),
  };
}

const CAR_BUILDERS: Record<CarId, (ctx: CarBuildContext) => void> = {
  mcqueen: (ctx) => buildCoupeRacer(ctx, 'mcqueen'),
  sally: (ctx) => buildCoupeRacer(ctx, 'sally'),
  chick: (ctx) => buildCoupeRacer(ctx, 'chick'),
  doc: (ctx) => buildCoupeRacer(ctx, 'doc'),
  cruz: (ctx) => buildCoupeRacer(ctx, 'cruz'),
  storm: (ctx) => buildCoupeRacer(ctx, 'storm'),
  luigi: (ctx) => buildCompactCab(ctx, 'luigi'),
  guido: (ctx) => buildCompactCab(ctx, 'guido'),
  mater: (ctx) => buildCompactCab(ctx, 'mater'),
  francesco: buildFormulaCar,
};

export class CarView {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  private readonly wheels: WheelRef[] = [];
  private readonly flames: THREE.Mesh[] = [];
  private readonly flameGroups: THREE.Group[] = [];
  private readonly brakeLights: THREE.Mesh[] = [];
  private readonly glassMat: THREE.MeshToonMaterial;
  private readonly effects: CarEffects;
  private spin = 0;

  constructor(carId: CarId, palette: CarPalette, number: number, isPlayer: boolean) {
    this.group.add(this.body);
    // Keep vertical proportion consistent with the pixel-art 3D silhouette across all camera angles.
    this.body.scale.set(1.0, 1.14, 1.0);

    addDropShadow(this.group, carId);

    const mats = createCarMaterials(carId, palette);
    this.glassMat = mats.glass;

    const ctx: CarBuildContext = {
      carId,
      palette,
      number,
      openWheel: carId === 'francesco',
      group: this.group,
      body: this.body,
      hulls: [],
      wheels: this.wheels,
      brakeLights: this.brakeLights,
      flames: this.flames,
      flameGroups: this.flameGroups,
      ghSpec: GREENHOUSE[carId],
      mats,
    };
    CAR_BUILDERS[carId](ctx);

    this.effects = new CarEffects(this.group, this.body);

    if (isPlayer) {
      const marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.85, 4),
        new THREE.MeshBasicMaterial({ color: '#ff8f3d' }),
      );
      marker.rotation.x = Math.PI;
      marker.position.y = 4.4;
      this.group.add(marker);
    }
  }

  syncGlassSun(): void {
    syncGlassSunLocal(this.glassMat, this.group.quaternion);
  }

  update(
    racer: RacerState,
    dt: number,
    interpX?: number,
    interpY?: number,
    interpAngle?: number,
    offroad = false,
  ): void {
    this.group.visible = true;
    const posX = interpX ?? racer.x;
    const posY = interpY ?? racer.y;
    const angle = interpAngle ?? racer.angle;

    this.group.position.set(toSceneX(posX), ROAD_Y + 0.03, toSceneZ(posY));
    this.group.rotation.y = -angle;
    this.syncGlassSun();

    const speed = Math.hypot(racer.vx, racer.vy);
    this.spin += (speed / 0.65) * dt;

    for (const wheel of this.wheels) {
      wheel.mesh.rotation.z = this.spin;
      if (wheel.front) {
        wheel.pivot.rotation.y = -racer.steer * 0.38;
      }
    }

    const steerAmount = racer.steer * Math.min(1.2, speed / 55);
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, -steerAmount * 0.12, Math.min(1, dt * 10));
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, racer.nitroActive ? -0.05 : 0, Math.min(1, dt * 8));

    this.effects.update(racer, dt, speed, offroad, this.body, this.flames, this.flameGroups, this.brakeLights);
  }

  setAttractVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
