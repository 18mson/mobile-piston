import * as THREE from 'three';
import type { RacerState } from '../types';
import { ROAD_Y, toSceneX, toSceneZ } from './constants';

type Kind = 0 | 1 | 2; // 0 = dirt chunk, 1 = smoke puff, 2 = spark
const DIRT: Kind = 0;
const SMOKE: Kind = 1;
const SPARK: Kind = 2;

const DIRT_COLORS = ['#8b6a3f', '#a2814f', '#6e5232', '#b08d58', '#5f8f3c'].map((c) => new THREE.Color(c));
const SMOKE_COLORS = ['#eef0f2', '#d6dade', '#c3c8ce'].map((c) => new THREE.Color(c));
const SPRAY_COLORS = ['#e6f1f8', '#cfe2ee', '#b9d2e2'].map((c) => new THREE.Color(c));
const SPARK_COLORS = ['#ffd45a', '#ff9a2e', '#fff1b0'].map((c) => new THREE.Color(c));

/**
 * One instanced mesh that renders every effect particle (voxel-style cubes, matching the low-poly look):
 *  - dirt chunks thrown up by the tyres when a car is off the asphalt
 *  - tyre smoke while drifting
 *  - sparks when cars hit each other or a barrier
 * Particles live in a ring buffer, so the cost is fixed no matter how many cars emit.
 */
export class ParticleFx {
  readonly mesh: THREE.InstancedMesh;
  private readonly max = 460;
  private head = 0;

  private readonly px = new Float32Array(this.max);
  private readonly py = new Float32Array(this.max);
  private readonly pz = new Float32Array(this.max);
  private readonly vx = new Float32Array(this.max);
  private readonly vy = new Float32Array(this.max);
  private readonly vz = new Float32Array(this.max);
  private readonly life = new Float32Array(this.max); // seconds left
  private readonly maxLife = new Float32Array(this.max);
  private readonly size0 = new Float32Array(this.max);
  private readonly size1 = new Float32Array(this.max);
  private readonly spin = new Float32Array(this.max);
  private readonly kind = new Uint8Array(this.max);

  private readonly dummy = new THREE.Object3D();
  private readonly accumDirt = new Map<string, number>();
  private readonly accumSmoke = new Map<string, number>();
  private readonly accumSpray = new Map<string, number>();
  private readonly lastImpact = new Map<string, number>();

  constructor() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geometry, material, this.max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.renderOrder = 4;
    // allocate per-instance colours
    this.mesh.setColorAt(0, new THREE.Color('#ffffff'));
    this.clear();
  }

  clear(): void {
    this.life.fill(0);
    this.head = 0;
    this.accumDirt.clear();
    this.accumSmoke.clear();
    this.accumSpray.clear();
    this.lastImpact.clear();
    this.dummy.position.set(0, -999, 0);
    this.dummy.scale.set(0, 0, 0);
    this.dummy.updateMatrix();
    for (let i = 0; i < this.max; i += 1) this.mesh.setMatrixAt(i, this.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private spawn(
    kind: Kind,
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size0: number,
    size1: number,
    color: THREE.Color,
  ): void {
    const i = this.head;
    this.head = (this.head + 1) % this.max;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.size0[i] = size0;
    this.size1[i] = size1;
    this.spin[i] = Math.random() * Math.PI * 2;
    this.kind[i] = kind;
    this.mesh.setColorAt(i, color);
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /**
   * Emit particles for one car this frame.
   * (sceneX/sceneZ are already in scene units; angle is the car heading; dt in seconds)
   */
  emitForRacer(racer: RacerState, worldX: number, worldY: number, angle: number, dt: number, wetness = 0): void {
    if (dt <= 0) return;
    const id = racer.id;
    const speed = Math.hypot(racer.vx, racer.vy);
    const sceneX = toSceneX(worldX);
    const sceneZ = toSceneZ(worldY);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const carVx = racer.vx * 0.25; // world -> scene velocity
    const carVz = racer.vy * 0.25;

    // --- dirt kicked up by the rear tyres while off the asphalt (or on a dirt section of the road)
    const kickingDirt = Boolean(racer.offroad || racer.surface === 'dirt');
    if (kickingDirt && speed > 28) {
      const rate = clamp(speed / 55, 0.4, 4) * 22; // particles / second
      let acc = (this.accumDirt.get(id) ?? 0) + rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        const back = -1.25 + (Math.random() - 0.5) * 0.4;
        const lat = side * (1.1 + Math.random() * 0.3);
        const x = sceneX + back * cosA - lat * sinA;
        const z = sceneZ + back * sinA + lat * cosA;
        const kick = 3 + Math.random() * 5;
        this.spawn(
          DIRT,
          x,
          ROAD_Y + 0.15,
          z,
          carVx * 0.35 - cosA * kick + (Math.random() - 0.5) * 4 + -sinA * side * 2.4,
          3.5 + Math.random() * 5.5 * clamp(speed / 160, 0.4, 1.2),
          carVz * 0.35 - sinA * kick + (Math.random() - 0.5) * 4 + cosA * side * 2.4,
          0.45 + Math.random() * 0.45,
          0.2 + Math.random() * 0.2,
          0.05,
          DIRT_COLORS[(Math.random() * DIRT_COLORS.length) | 0],
        );
      }
      this.accumDirt.set(id, acc);
    } else {
      this.accumDirt.delete(id);
    }

    // --- tyre smoke while drifting on the road (dust-coloured when the slide happens on dirt)
    if (racer.drifting && speed > 40) {
      const rate = clamp(speed / 120, 0.5, 1.6) * 26;
      let acc = (this.accumSmoke.get(id) ?? 0) + rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        const back = -1.2 + (Math.random() - 0.5) * 0.3;
        const lat = side * 1.2;
        const x = sceneX + back * cosA - lat * sinA;
        const z = sceneZ + back * sinA + lat * cosA;
        const color = kickingDirt ? DIRT_COLORS[1] : SMOKE_COLORS[(Math.random() * SMOKE_COLORS.length) | 0];
        this.spawn(
          SMOKE,
          x,
          ROAD_Y + 0.25,
          z,
          carVx * 0.12 + (Math.random() - 0.5) * 1.2,
          1.2 + Math.random() * 1.6,
          carVz * 0.12 + (Math.random() - 0.5) * 1.2,
          0.55 + Math.random() * 0.45,
          0.45,
          1.7 + Math.random() * 0.7,
          color,
        );
      }
      this.accumSmoke.set(id, acc);
    } else {
      this.accumSmoke.delete(id);
    }

    // --- water spray & puddle splashes behind/beside the wheels
    const inPuddle = racer.surface === 'puddle';
    const sprayWet = inPuddle ? 1 : wetness;
    if (sprayWet > 0.25 && !racer.offroad && speed > (inPuddle ? 20 : 55)) {
      const rate = sprayWet * clamp(speed / 100, 0.5, 2.2) * 48 * (inPuddle ? 3.0 : 1);
      let acc = (this.accumSpray.get(id) ?? 0) + rate * dt;
      while (acc >= 1) {
        acc -= 1;
        const side = Math.random() < 0.5 ? -1 : 1;
        const back = inPuddle ? (Math.random() < 0.5 ? 0.9 : -1.1) : -1.3 + (Math.random() - 0.5) * 0.3;
        const lat = side * (1.1 + Math.random() * 0.3);
        const x = sceneX + back * cosA - lat * sinA;
        const z = sceneZ + back * sinA + lat * cosA;
        const outward = inPuddle ? 2.4 + Math.random() * 2.2 : 0;
        const sideVx = -sinA * side * outward;
        const sideVz = cosA * side * outward;
        this.spawn(
          SMOKE,
          x,
          ROAD_Y + 0.2,
          z,
          carVx * 0.18 - cosA * (1 + Math.random() * 2) + sideVx + (Math.random() - 0.5) * 1.4,
          (inPuddle ? 2.6 : 1.6) + Math.random() * 2.4,
          carVz * 0.18 - sinA * (1 + Math.random() * 2) + sideVz + (Math.random() - 0.5) * 1.4,
          (inPuddle ? 0.52 : 0.38) + Math.random() * 0.3,
          inPuddle ? 0.32 : 0.25,
          (inPuddle ? 1.15 : 0.9) + Math.random() * 0.5,
          SPRAY_COLORS[(Math.random() * SPRAY_COLORS.length) | 0],
        );
      }
      this.accumSpray.set(id, acc);
    } else {
      this.accumSpray.delete(id);
    }

    // --- sparks on a fresh impact (value jumps up); wall hits throw a few more
    const previous = this.lastImpact.get(id) ?? 0;
    if (racer.impact > previous + 0.22 && racer.impact > 0.3) {
      const strength = clamp(racer.impact, 0.3, 1);
      const count = Math.round(7 + strength * 15) + (racer.impactKind === 'wall' ? 4 : 0);
      for (let n = 0; n < count; n += 1) {
        const a = Math.random() * Math.PI * 2;
        const r = 0.9 + Math.random() * 1.1;
        const burst = 6 + Math.random() * 12 * strength;
        this.spawn(
          SPARK,
          sceneX + Math.cos(a) * r,
          ROAD_Y + 0.5 + Math.random() * 0.5,
          sceneZ + Math.sin(a) * r,
          carVx * 0.3 + Math.cos(a) * burst,
          2.5 + Math.random() * 6,
          carVz * 0.3 + Math.sin(a) * burst,
          0.3 + Math.random() * 0.3,
          0.16 + Math.random() * 0.1,
          0.03,
          SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0],
        );
      }
    }
    this.lastImpact.set(id, racer.impact);
  }

  update(dt: number): void {
    if (dt <= 0) return;
    let dirty = false;
    for (let i = 0; i < this.max; i += 1) {
      if (this.life[i] <= 0) continue;
      dirty = true;
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i]; // 0 -> 1 over the lifetime
      const k = this.kind[i];

      if (this.life[i] <= 0) {
        this.dummy.position.set(0, -999, 0);
        this.dummy.scale.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        continue;
      }

      if (k === DIRT) {
        this.vy[i] -= 30 * dt;
      } else if (k === SPARK) {
        this.vy[i] -= 24 * dt;
      } else {
        this.vy[i] += 0.6 * dt; // smoke drifts up
        const drag = Math.exp(-2.2 * dt);
        this.vx[i] *= drag;
        this.vz[i] *= drag;
      }
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;

      // dirt and sparks bounce off the ground
      if (k !== SMOKE && this.py[i] < ROAD_Y + 0.05) {
        this.py[i] = ROAD_Y + 0.05;
        this.vy[i] = Math.abs(this.vy[i]) * 0.3;
        this.vx[i] *= 0.6;
        this.vz[i] *= 0.6;
      }

      // size: smoke grows then fades by shrinking; dirt and sparks shrink
      let size: number;
      if (k === SMOKE) {
        size = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
        if (t > 0.65) size *= 1 - (t - 0.65) / 0.35;
      } else {
        size = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      }
      this.dummy.position.set(this.px[i], this.py[i], this.pz[i]);
      this.dummy.rotation.set(this.spin[i] + t * 4, this.spin[i] * 0.5 + t * 3, 0);
      this.dummy.scale.set(size, size, size);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
