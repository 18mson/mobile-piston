import * as THREE from 'three';
import type { RacerState } from '../../types';

export interface SparkParticle {
  mesh: THREE.Mesh;
  angle: number;
  speed: number;
  vy: number;
}

export interface SmokePuff {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  vx: number;
  vy: number;
  vz: number;
}

export class CarEffects {
  private readonly sparkGroup = new THREE.Group();
  private readonly sparks: SparkParticle[] = [];
  private readonly smokeGroup = new THREE.Group();
  private readonly smokePuffs: SmokePuff[] = [];
  private readonly windTrails: THREE.Mesh[] = [];
  private sparkTimer = 0;
  private sparkDuration = 0.22;
  private impactStrength = 0;
  private nitroPulse = 0;

  constructor(group: THREE.Group, body: THREE.Group) {
    this.buildSparks(group);
    this.buildSmoke(group);
    this.buildWindTrails(body);
  }

  private buildSparks(group: THREE.Group): void {
    const mats = [
      new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      new THREE.MeshBasicMaterial({ color: '#ffe44d' }),
      new THREE.MeshBasicMaterial({ color: '#ff621f' }),
    ];
    for (let i = 0; i < 24; i += 1) {
      const mat = mats[i % 3 === 0 ? 0 : i % 2 === 0 ? 1 : 2];
      const size = 0.12 + (i % 3) * 0.04;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size * 2.4, size * 0.75, size * 0.75), mat);
      const angle = (i / 24) * Math.PI * 2 + ((i * 37) % 17) * 0.1;
      mesh.rotation.y = -angle;
      mesh.visible = false;
      this.sparkGroup.add(mesh);
      this.sparks.push({
        mesh,
        angle,
        speed: 0.75 + ((i * 23) % 10) * 0.09,
        vy: 0.8 + ((i * 13) % 10) * 0.07,
      });
    }
    group.add(this.sparkGroup);
  }

  private buildWindTrails(body: THREE.Group): void {
    const trailMat = new THREE.MeshBasicMaterial({
      color: '#e0f7ff',
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const offsets: [number, number, number][] = [
      [-1.8, 1.15, -0.9],
      [-1.8, 1.15, 0.9],
      [-1.9, 0.52, -1.2],
      [-1.9, 0.52, 1.2],
    ];
    for (const [x, y, z] of offsets) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.07), trailMat);
      mesh.position.set(x - 1.2, y, z);
      mesh.visible = false;
      body.add(mesh);
      this.windTrails.push(mesh);
    }
  }

  private buildSmoke(group: THREE.Group): void {
    const smokeMat = new THREE.MeshBasicMaterial({
      color: '#dedac8',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    const geo = new THREE.BoxGeometry(0.28, 0.24, 0.28);
    for (let i = 0; i < 12; i += 1) {
      const mesh = new THREE.Mesh(geo, smokeMat);
      mesh.visible = false;
      this.smokeGroup.add(mesh);
      this.smokePuffs.push({ mesh, life: 0, maxLife: 0.36, vx: 0, vy: 0, vz: 0 });
    }
    group.add(this.smokeGroup);
  }

  update(
    racer: RacerState,
    dt: number,
    speed: number,
    offroad: boolean,
    body: THREE.Group,
    flames: THREE.Mesh[],
    flameGroups: THREE.Group[],
    brakeLights: THREE.Mesh[],
  ): void {
    if (racer.impact > 0.16) {
      this.impactStrength = racer.impact;
      this.sparkDuration = THREE.MathUtils.lerp(0.14, 0.38, Math.min(1, racer.impact));
      this.sparkTimer = this.sparkDuration;
    }

    if (this.sparkTimer > 0) {
      this.sparkTimer -= dt;
      const progress = 1.0 - this.sparkTimer / this.sparkDuration;
      const jolt = Math.sin(this.sparkTimer * 45) * 0.12 * this.impactStrength;
      body.position.set(jolt, 0, jolt * 0.4);
      this.sparkGroup.position.set(0, 0.4, 0);

      const activeCount = this.impactStrength < 0.32 ? 8 : this.impactStrength < 0.65 ? 16 : 24;
      const burstRadius = 0.7 + progress * (2.6 + this.impactStrength * 3.8);

      for (let i = 0; i < this.sparks.length; i += 1) {
        const item = this.sparks[i];
        if (i < activeCount) {
          item.mesh.visible = true;
          const dist = burstRadius * item.speed;
          const arc = Math.sin(progress * Math.PI) * (0.5 + this.impactStrength * 1.2) * item.vy;
          item.mesh.position.set(Math.cos(item.angle) * dist, 0.2 + arc, Math.sin(item.angle) * dist);
          item.mesh.scale.setScalar(Math.max(0.08, (1.0 - progress) * (1.0 + this.impactStrength * 0.6)));
        } else {
          item.mesh.visible = false;
        }
      }
    } else {
      body.position.set(0, 0, 0);
      for (const item of this.sparks) {
        item.mesh.visible = false;
      }
    }

    this.nitroPulse += dt * 26;
    for (const group of flameGroups) {
      group.visible = racer.nitroActive;
    }
    for (const flame of flames) {
      const scale = 0.85 + Math.sin(this.nitroPulse) * 0.28;
      flame.scale.set(scale, 0.95 + Math.sin(this.nitroPulse + 1.2) * 0.45, scale);
    }
    for (let i = 0; i < this.windTrails.length; i += 1) {
      const trail = this.windTrails[i];
      trail.visible = racer.nitroActive;
      if (racer.nitroActive) {
        trail.scale.set(0.9 + Math.sin(this.nitroPulse + i * 1.5) * 0.35 + (speed / 200) * 0.4, 1.0, 1.0);
        (trail.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(this.nitroPulse * 1.4 + i) * 0.25;
      }
    }

    const brakeHex = speed < 8 || racer.drifting ? 0xff5030 : 0xa02518;
    for (const tail of brakeLights) {
      (tail.material as THREE.MeshBasicMaterial).color.setHex(brakeHex);
    }

    if ((offroad && speed > 18) || (racer.drifting && speed > 35)) {
      const puff = this.smokePuffs.find((p) => p.life <= 0);
      if (puff) {
        puff.life = puff.maxLife;
        puff.mesh.position.set(-1.05, 0.22, Math.random() > 0.5 ? 1.25 : -1.25);
        puff.mesh.scale.setScalar(0.75 + Math.random() * 0.35);
        puff.mesh.visible = true;
        (puff.mesh.material as THREE.MeshBasicMaterial).color.setHex(offroad ? 0x8c6239 : 0xdedac8);
        puff.vx = -1.6 - Math.random() * 1.0;
        puff.vy = (offroad ? 1.15 : 0.8) + Math.random() * 0.5;
        puff.vz = (Math.random() - 0.5) * 0.5;
      }
    }

    for (const puff of this.smokePuffs) {
      if (puff.life > 0) {
        puff.life -= dt;
        const progress = 1.0 - puff.life / puff.maxLife;
        puff.mesh.position.x += puff.vx * dt;
        puff.mesh.position.y += puff.vy * dt;
        puff.mesh.position.z += puff.vz * dt;
        puff.mesh.scale.setScalar((1.0 + progress * 1.5) * 0.85);
        (puff.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1.0 - progress) * 0.45);
        if (puff.life <= 0) puff.mesh.visible = false;
      }
    }
  }
}
