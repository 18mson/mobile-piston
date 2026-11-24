import * as THREE from 'three';
import type { CarId, CarPalette, RacerState } from '../types';
import { ROAD_Y, toSceneX, toSceneZ } from './constants';
import { createNumberTexture } from './textures';

interface WheelRef {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  front: boolean;
}

export class CarView {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  private wheels: WheelRef[] = [];
  private flames: THREE.Mesh[] = [];
  private brakeLights: THREE.Mesh[] = [];
  private spin = 0;
  private nitroPulse = 0;

  constructor(carId: CarId, palette: CarPalette, number: number, isPlayer: boolean) {
    this.group.add(this.body);
    this.build(carId, palette, number);
    if (isPlayer) {
      const marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.75, 4),
        new THREE.MeshBasicMaterial({ color: '#ff8f3d' }),
      );
      marker.rotation.x = Math.PI;
      marker.position.y = 3.5;
      this.group.add(marker);
    }
  }

  private material(hex: string, transparent = false): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({
      color: hex,
      flatShading: true,
      transparent,
      opacity: transparent ? 0.95 : 1,
    });
  }

  private addBox(
    size: [number, number, number],
    position: [number, number, number],
    material: THREE.Material,
    cast = true,
    outline = false,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    if (outline) {
      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: '#15222a' }),
      );
      mesh.add(edge);
    }
    return mesh;
  }

  private addWheel(
    radius: number,
    width: number,
    x: number,
    z: number,
    front: boolean,
    material: THREE.Material,
  ): void {
    const pivot = new THREE.Group();
    pivot.position.set(x, radius, z);
    const geometry = new THREE.CylinderGeometry(radius, radius, width, 8);
    geometry.rotateX(Math.PI / 2);
    const wheel = new THREE.Mesh(geometry, material);
    wheel.castShadow = true;
    pivot.add(wheel);
    const hub = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, radius * 1.1, radius * 1.1),
      this.material('#d6c7a8'),
    );
    hub.position.z = width / 2 + 0.01;
    wheel.add(hub);
    this.group.add(pivot);
    this.wheels.push({ pivot, mesh: wheel, front });
  }

  private addNumber(number: number, x: number, y: number, z: number, color: string, width: number): void {
    const map = createNumberTexture(number, color);
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), material);
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(x, y, z);
    this.body.add(roof);
    for (const side of [-1, 1]) {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.72), material);
      decal.rotation.y = side * Math.PI / 2;
      decal.position.set(-0.25, 1.17, side * (width / 2 + 0.03));
      this.body.add(decal);
    }
  }

  private addFlames(x: number, z: number): void {
    for (const side of [-1, 1]) {
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 1.4, 6),
        new THREE.MeshBasicMaterial({ color: side < 0 ? '#ffd777' : '#ff8a35', transparent: true, opacity: 0.95 }),
      );
      flame.rotation.z = Math.PI / 2;
      flame.position.set(x, 0.62, z + side * 0.42);
      flame.visible = false;
      this.body.add(flame);
      this.flames.push(flame);
    }
  }

  private build(carId: CarId, palette: CarPalette, number: number): void {
    const bodyMat = this.material(palette.body);
    const shadeMat = this.material(palette.shade);
    const glassMat = this.material(palette.glass);
    const wheelMat = this.material(palette.wheel);
    const stripeMat = this.material(palette.stripe);
    const lightMat = new THREE.MeshBasicMaterial({ color: '#fff0b0' });
    const tailMat = new THREE.MeshBasicMaterial({ color: '#ff5a3f' });

    const length = carId === 'bagas' ? 5.8 : carId === 'okra' ? 5.3 : carId === 'kepik' ? 4.7 : 5.0;
    const width = carId === 'bagas' ? 3.4 : carId === 'okra' ? 3.3 : carId === 'kepik' ? 3.15 : 3.1;
    const wheelRadius = carId === 'kepik' ? 0.82 : 0.65;
    const wheelWidth = carId === 'kepik' ? 0.55 : 0.45;

    this.addBox([length, 0.42, width], [0, 0.64, 0], shadeMat, true, true);
    this.addBox([length * 0.94, 0.32, width * 0.9], [0, 0.92, 0], bodyMat, true, true);
    this.addBox([length * 0.55, 0.16, width * 0.58], [-0.1, 1.08, 0], bodyMat, true, true);
    if (carId !== 'kepik') {
      this.addBox([length * 0.4, 0.56, width * 0.62], [-length * 0.06, 1.25, 0], glassMat);
      this.addBox([length * 0.27, 0.08, width * 0.54], [-length * 0.06, 1.55, 0], stripeMat);
    } else {
      this.addBox([length * 0.32, 0.22, width * 0.6], [-0.2, 1.2, 0], glassMat);
      this.addBox([0.32, 0.12, width * 0.82], [length * 0.42, 1.38, 0], stripeMat);
      this.addBox([0.32, 0.12, width * 0.82], [-length * 0.48, 1.28, 0], stripeMat);
    }

    if (carId === 'okra') {
      this.addBox([2.0, 0.24, width * 0.7], [-length * 0.36, 1.16, 0], shadeMat);
      for (const side of [-1, 1]) {
        this.addBox([1.7, 0.08, 0.1], [-length * 0.36, 1.55, side * width * 0.32], stripeMat);
      }
      this.addBox([1.4, 0.48, 1.25], [-length * 0.38, 1.32, 0], this.material('#a97a4a'));
      this.addBox([1.42, 0.1, 1.27], [-length * 0.38, 1.53, 0], this.material('#d29b5d'));
    }

    if (carId === 'bagas') {
      this.addBox([1.5, 0.12, 0.75], [length * 0.24, 1.08, 0], shadeMat);
      this.addBox([0.18, 0.24, 0.32], [length * 0.23, 1.18, 0], glassMat);
    }

    if (carId === 'kepik') {
      for (const side of [-1, 1]) {
        const cage = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 2.0, 5),
          this.material(palette.stripe),
        );
        cage.rotation.z = Math.PI / 2;
        cage.position.set(-0.8, 1.6, side * width * 0.33);
        cage.castShadow = true;
        this.body.add(cage);
        const sideBar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.05, 1.7, 5),
          this.material(palette.stripe),
        );
        sideBar.rotation.x = Math.PI / 2;
        sideBar.position.set(0.2, 1.85, side * width * 0.33);
        this.body.add(sideBar);
      }
      this.addBox([0.22, 0.14, 1.9], [0.0, 1.9, 0], stripeMat);
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 6, 4),
        this.material('#f5ebd2'),
      );
      helmet.position.set(-0.15, 1.5, 0);
      helmet.castShadow = true;
      this.body.add(helmet);
    } else {
      const helmet = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 6, 3),
        this.material('#e2b083'),
      );
      helmet.position.set(-length * 0.04, 1.42, 0);
      this.body.add(helmet);
    }

    for (const side of [-1, 1]) {
      this.addWheel(wheelRadius, wheelWidth, length * 0.31, side * (width / 2 + 0.06), true, wheelMat);
      this.addWheel(wheelRadius, wheelWidth, -length * 0.31, side * (width / 2 + 0.06), false, wheelMat);
    }

    for (const side of [-1, 1]) {
      const head = this.addBox([0.12, 0.18, 0.4], [length / 2 - 0.03, 0.92, side * width * 0.27], lightMat, false);
      head.castShadow = false;
      const tail = this.addBox([0.12, 0.18, 0.36], [-length / 2 + 0.03, 0.92, side * width * 0.27], tailMat, false);
      tail.castShadow = false;
      this.brakeLights.push(tail);
    }

    this.addBox([0.22, 0.1, width * 0.76], [-length / 2 - 0.22, 1.24, 0], stripeMat);
    for (const side of [-1, 1]) {
      this.addBox([0.14, 0.34, 0.1], [-length / 2 - 0.16, 1.05, side * width * 0.3], shadeMat);
    }

    if (carId === 'sirip' || carId === 'bagas') {
      this.addBox([0.2, 0.12, 0.6], [length / 2 + 0.03, 1.0, 0], palette.stripe === '#20232a' ? stripeMat : bodyMat);
    }

    const stripePositions = carId === 'okra' ? [-length * 0.08, 1.6, 0] : [-0.3, 1.64, 0];
    this.addNumber(number, stripePositions[0], stripePositions[1], stripePositions[2], palette.stripe === '#20232a' ? '#f5ebd2' : '#15222a', width);

    this.addFlames(-length / 2 - 0.15, 0);
  }

  update(racer: RacerState, dt: number): void {
    this.group.visible = true;
    this.group.position.set(toSceneX(racer.x), ROAD_Y + 0.03, toSceneZ(racer.y));
    this.group.rotation.y = -racer.angle;
    const speed = Math.hypot(racer.vx, racer.vy);
    this.spin += (speed / 0.65) * dt;
    for (const wheel of this.wheels) {
      wheel.mesh.rotation.z = this.spin;
      if (wheel.front) wheel.pivot.rotation.y = racer.steer * 0.32;
    }
    const steerAmount = racer.steer * Math.min(1, speed / 60);
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, -steerAmount * 0.075, Math.min(1, dt * 8));
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, racer.nitroActive ? -0.035 : 0, Math.min(1, dt * 5));
    this.nitroPulse += dt * 18;
    for (const flame of this.flames) {
      flame.visible = racer.nitroActive;
      const scale = 0.8 + Math.sin(this.nitroPulse) * 0.18;
      flame.scale.set(scale, 0.8 + Math.sin(this.nitroPulse + 1) * 0.3, scale);
    }
    for (const tail of this.brakeLights) {
      (tail.material as THREE.MeshBasicMaterial).color.setHex(speed < 8 || racer.drifting ? 0xff7a50 : 0xb83c2b);
    }
  }

  setAttractVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
