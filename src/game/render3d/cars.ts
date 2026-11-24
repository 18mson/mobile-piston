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
  readonly interior = new THREE.Group(); // Detail specifically for cockpit view or visible driver
  private wheels: WheelRef[] = [];
  private flames: THREE.Mesh[] = [];
  private brakeLights: THREE.Mesh[] = [];
  private dropShadow: THREE.Mesh | null = null;
  private spin = 0;
  private nitroPulse = 0;
  private bounceTime = 0;
  private carId: CarId;

  constructor(carId: CarId, palette: CarPalette, number: number, isPlayer: boolean) {
    this.carId = carId;
    this.group.add(this.body);

    // Make car body models taller / chubbier (vertical height scale +32%)
    // while keeping length (X) and width (Z) unchanged
    this.body.scale.set(1.0, 1.32, 1.0);

    this.addDropShadow(carId);
    this.build(carId, palette, number);

    if (isPlayer) {
      const marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.85, 4),
        new THREE.MeshBasicMaterial({ color: '#ff8f3d' }),
      );
      marker.rotation.x = Math.PI;
      marker.position.y = 4.6;
      this.group.add(marker);
    }
  }

  private material(hex: string, transparent = false, opacity = 1): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({
      color: hex,
      flatShading: true,
      transparent,
      opacity,
    });
  }

  private addDropShadow(carId: CarId): void {
    const l = carId === 'bagas' ? 6.2 : carId === 'okra' ? 5.6 : carId === 'kepik' ? 5.0 : 5.4;
    const w = carId === 'bagas' ? 4.0 : carId === 'okra' ? 3.9 : carId === 'kepik' ? 3.8 : 3.7;
    const geo = new THREE.PlaneGeometry(l, w);
    const mat = new THREE.MeshBasicMaterial({
      color: '#081217',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(geo, mat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    this.group.add(shadow);
    this.dropShadow = shadow;
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
    tireColor: string,
    rimColor: string,
  ): void {
    const pivot = new THREE.Group();
    pivot.position.set(x, radius * 0.95, z);
    
    // Chunky 12-sided tire
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 10);
    tireGeo.rotateX(Math.PI / 2);
    const tireMat = this.material(tireColor);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    pivot.add(tire);

    // Chunky prominent rim that stands out from above & behind
    const rimRadius = radius * 0.62;
    const rimWidth = width + 0.06;
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, rimWidth, 8);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = this.material(rimColor);
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.castShadow = true;
    tire.add(rim);

    // Deep central nut / bolt block
    const nut = new THREE.Mesh(
      new THREE.BoxGeometry(rimRadius * 0.6, rimRadius * 0.6, rimWidth + 0.04),
      this.material('#10151a'),
    );
    tire.add(nut);

    this.group.add(pivot);
    this.wheels.push({ pivot, mesh: tire, front });
  }

  private addNumber(number: number, x: number, y: number, z: number, color: string, width: number): void {
    const map = createNumberTexture(number, color);
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), material);
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(x, y, z);
    this.body.add(roof);
    for (const side of [-1, 1]) {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.85), material);
      decal.rotation.y = side * Math.PI / 2;
      decal.position.set(-0.25, y - 0.45, side * (width / 2 + 0.04));
      this.body.add(decal);
    }
  }

  private addFlames(x: number, z: number): void {
    for (const side of [-1, 1]) {
      const flameGroup = new THREE.Group();
      flameGroup.position.set(x, 0.72, z + side * 0.48);

      const coreFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.24, 1.6, 6),
        new THREE.MeshBasicMaterial({ color: '#ffb338', transparent: true, opacity: 0.95 }),
      );
      coreFlame.rotation.z = Math.PI / 2;
      flameGroup.add(coreFlame);

      const outerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 1.2, 6),
        new THREE.MeshBasicMaterial({ color: '#ff4820', transparent: true, opacity: 0.75 }),
      );
      outerFlame.rotation.z = Math.PI / 2;
      outerFlame.position.x = -0.2;
      flameGroup.add(outerFlame);

      flameGroup.visible = false;
      this.body.add(flameGroup);
      this.flames.push(coreFlame);
    }
  }

  private addDriver(x: number, y: number, z: number, helmetColor: string, visorColor: string, scale = 1.0): void {
    // Driver torso/shoulders
    const torso = this.addBox([0.55 * scale, 0.4 * scale, 0.9 * scale], [x, y - 0.22 * scale, z], this.material('#1f2833'));
    
    // Chunky racing helmet with distinct visor
    const helmetGeo = new THREE.SphereGeometry(0.42 * scale, 8, 6);
    const helmet = new THREE.Mesh(helmetGeo, this.material(helmetColor));
    helmet.position.set(x, y + 0.15 * scale, z);
    helmet.castShadow = true;
    this.body.add(helmet);

    // Dark glossy visor
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.22 * scale, 0.18 * scale, 0.52 * scale),
      new THREE.MeshBasicMaterial({ color: visorColor }),
    );
    visor.position.set(x + 0.28 * scale, y + 0.14 * scale, z);
    this.body.add(visor);
  }

  private build(carId: CarId, palette: CarPalette, number: number): void {
    const bodyMat = this.material(palette.body);
    const shadeMat = this.material(palette.shade);
    const highlightMat = this.material(palette.highlight);
    const glassMat = this.material(palette.glass);
    const stripeMat = this.material(palette.stripe);
    const chromeMat = this.material('#e8ecf0');
    const darkTrimMat = this.material('#12171c');
    const lightMat = new THREE.MeshBasicMaterial({ color: '#fff5b8' });
    const tailMat = new THREE.MeshBasicMaterial({ color: '#ff3a2b' });

    // Distinct silhouettes, heights, and volumes
    if (carId === 'sirip') {
      // SIRIP: Chunky rally hatchback with roof scoop, flared arches, rear wing
      const length = 5.2;
      const width = 3.35;
      const wheelRadius = 0.72;
      const wheelWidth = 0.52;

      // Layer 1: Undercarriage & bumper splitters
      this.addBox([length, 0.36, width * 0.95], [0, 0.52, 0], darkTrimMat, true, true);
      this.addBox([0.35, 0.18, width * 0.92], [length / 2 + 0.08, 0.46, 0], shadeMat); // Front splitter
      this.addBox([0.35, 0.22, width * 0.88], [-length / 2 - 0.08, 0.48, 0], darkTrimMat); // Rear diffuser

      // Layer 2: Main lower muscular body & wheel arch flares
      this.addBox([length * 0.94, 0.52, width], [0, 0.88, 0], bodyMat, true, true);
      // Side skirts & accent strip
      this.addBox([length * 0.5, 0.14, width + 0.08], [0, 0.76, 0], stripeMat);

      // Layer 3: Hood & shoulder line taper
      this.addBox([length * 0.42, 0.28, width * 0.82], [length * 0.26, 1.2, 0], bodyMat, true, true);
      this.addBox([0.9, 0.12, 0.7], [length * 0.24, 1.36, 0], shadeMat); // Hood vent

      // Layer 4: Raised cabin / canopy with chunky pillars & glass
      this.addBox([length * 0.46, 0.72, width * 0.72], [-length * 0.08, 1.54, 0], glassMat, true, true);
      this.addBox([length * 0.36, 0.16, width * 0.68], [-length * 0.06, 1.94, 0], bodyMat, true, true); // Roof slab

      // Roof rally air scoop
      this.addBox([0.7, 0.22, 0.52], [-length * 0.02, 2.08, 0], stripeMat);
      this.addBox([0.15, 0.12, 0.36], [0.3, 2.08, 0], darkTrimMat); // Intake mouth

      // Driver inside cabin
      this.addDriver(-length * 0.08, 1.55, 0, '#ffffff', '#1a2228', 0.95);

      // Chunky rally rear spoiler / fin
      this.addBox([0.5, 0.12, width * 0.84], [-length / 2 - 0.12, 1.98, 0], stripeMat);
      for (const side of [-1, 1]) {
        this.addBox([0.45, 0.45, 0.1], [-length / 2 - 0.08, 1.76, side * width * 0.38], shadeMat);
      }

      // Wheels
      for (const side of [-1, 1]) {
        this.addWheel(wheelRadius, wheelWidth, length * 0.29, side * (width / 2 + 0.08), true, palette.wheel, palette.stripe);
        this.addWheel(wheelRadius, wheelWidth, -length * 0.29, side * (width / 2 + 0.08), false, palette.wheel, palette.stripe);
      }

      // Headlights & Taillights
      for (const side of [-1, 1]) {
        const head = this.addBox([0.16, 0.24, 0.48], [length / 2 - 0.02, 0.96, side * width * 0.32], lightMat, false);
        const tail = this.addBox([0.16, 0.24, 0.44], [-length / 2 + 0.02, 0.96, side * width * 0.32], tailMat, false);
        this.brakeLights.push(tail);
      }

      // Number badge
      this.addNumber(number, -length * 0.06, 2.03, 0, '#15222a', width);
      this.addFlames(-length / 2 - 0.15, 0);

    } else if (carId === 'bagas') {
      // BAGAS: Low-slung, powerful muscle car with long vented hood, supercharger blower, fastback cabin, dual quad exhausts
      const length = 6.2;
      const width = 3.6;
      const wheelRadius = 0.74;
      const wheelWidth = 0.58;

      // Layer 1: Low chassis & deep chin spoiler
      this.addBox([length, 0.36, width * 0.94], [0, 0.52, 0], darkTrimMat, true, true);
      this.addBox([0.45, 0.22, width * 0.96], [length / 2 + 0.1, 0.46, 0], shadeMat);

      // Layer 2: Wide aggressive muscle flanks
      this.addBox([length * 0.96, 0.54, width], [0, 0.88, 0], bodyMat, true, true);
      // Twin racing stripe down center
      this.addBox([length * 0.97, 0.04, 0.65], [0, 1.16, 0], stripeMat);

      // Layer 3: Long hood with chrome supercharger blower scoop!
      this.addBox([length * 0.48, 0.24, width * 0.84], [length * 0.24, 1.16, 0], bodyMat, true, true);
      // Supercharger block & triple butterflies
      this.addBox([1.1, 0.42, 0.85], [length * 0.22, 1.42, 0], chromeMat);
      this.addBox([0.2, 0.26, 0.7], [length * 0.22 + 0.5, 1.44, 0], darkTrimMat);

      // Layer 4: Fastback cabin / canopy
      this.addBox([length * 0.4, 0.64, width * 0.72], [-length * 0.12, 1.5, 0], glassMat, true, true);
      this.addBox([length * 0.28, 0.12, width * 0.66], [-length * 0.1, 1.84, 0], bodyMat, true, true); // Roof

      // Driver
      this.addDriver(-length * 0.1, 1.5, 0, '#e6ac32', '#151515', 0.98);

      // Ducktail spoiler
      this.addBox([0.38, 0.28, width * 0.82], [-length / 2 - 0.05, 1.25, 0], stripeMat);

      // Chunky wide drag wheels
      for (const side of [-1, 1]) {
        this.addWheel(wheelRadius * 0.95, wheelWidth * 0.9, length * 0.31, side * (width / 2 + 0.08), true, palette.wheel, '#d4a034');
        this.addWheel(wheelRadius * 1.08, wheelWidth * 1.15, -length * 0.28, side * (width / 2 + 0.1), false, palette.wheel, '#d4a034');
      }

      // Front double round muscle headlights
      for (const side of [-1, 1]) {
        this.addBox([0.16, 0.26, 0.34], [length / 2 - 0.02, 0.94, side * width * 0.34], lightMat, false);
        this.addBox([0.16, 0.26, 0.34], [length / 2 - 0.02, 0.94, side * width * 0.2], lightMat, false);
        const tail = this.addBox([0.16, 0.22, 0.58], [-length / 2 + 0.02, 0.94, side * width * 0.3], tailMat, false);
        this.brakeLights.push(tail);
      }

      this.addNumber(number, -length * 0.1, 1.91, 0, '#ffffff', width);
      this.addFlames(-length / 2 - 0.18, 0);

    } else if (carId === 'okra') {
      // OKRA: Heavy rugged pickup truck with tall cab, open cargo bed with wooden crates, roll bar, and chunky push bumper
      const length = 5.6;
      const width = 3.5;
      const wheelRadius = 0.78;
      const wheelWidth = 0.56;

      // Heavy lifted undercarriage & steel bull-bar
      this.addBox([length, 0.44, width * 0.92], [0, 0.58, 0], darkTrimMat, true, true);
      this.addBox([0.45, 0.55, width * 0.72], [length / 2 + 0.15, 0.82, 0], shadeMat); // Bull bar

      // Muscular flared body
      this.addBox([length * 0.94, 0.56, width], [0, 0.96, 0], bodyMat, true, true);

      // Heavy hood
      this.addBox([length * 0.34, 0.34, width * 0.84], [length * 0.28, 1.28, 0], bodyMat, true, true);
      this.addBox([length * 0.32, 0.08, width * 0.36], [length * 0.28, 1.48, 0], stripeMat); // Center hood stripe

      // Tall truck cab & upright windshield
      this.addBox([length * 0.32, 0.82, width * 0.76], [length * 0.02, 1.72, 0], glassMat, true, true);
      this.addBox([length * 0.28, 0.14, width * 0.74], [length * 0.02, 2.15, 0], bodyMat, true, true); // Cab roof

      // Driver
      this.addDriver(length * 0.02, 1.72, 0, '#588a44', '#152012', 1.0);

      // Open cargo bed & roll bars
      const bedLength = length * 0.38;
      const bedX = -length * 0.28;
      // Bed sidewalls
      for (const side of [-1, 1]) {
        this.addBox([bedLength, 0.45, 0.18], [bedX, 1.42, side * (width * 0.42)], shadeMat, true, true);
      }
      this.addBox([0.2, 0.45, width * 0.82], [-length / 2 + 0.05, 1.42, 0], shadeMat); // Tailgate

      // Heavy cargo in bed: layered wooden crates & barrel
      this.addBox([1.3, 0.58, 1.2], [bedX - 0.1, 1.45, 0.1], this.material('#8a5832'));
      this.addBox([1.32, 0.12, 1.22], [bedX - 0.1, 1.72, 0.1], this.material('#b8824f'));
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.75, 8),
        this.material('#2d4052'),
      );
      barrel.position.set(bedX + 0.65, 1.52, -0.6);
      this.body.add(barrel);

      // Steel roll bar over cab with auxiliary spotlights
      for (const side of [-1, 1]) {
        this.addBox([0.16, 0.9, 0.16], [-length * 0.13, 2.05, side * width * 0.35], darkTrimMat);
      }
      this.addBox([0.16, 0.16, width * 0.78], [-length * 0.13, 2.45, 0], darkTrimMat);
      // 4 yellow spotlights on roll bar
      for (let s = -3; s <= 3; s += 2) {
        this.addBox([0.2, 0.22, 0.22], [-length * 0.12, 2.62, s * 0.26], lightMat);
      }

      // Chunky all-terrain wheels
      for (const side of [-1, 1]) {
        this.addWheel(wheelRadius, wheelWidth, length * 0.28, side * (width / 2 + 0.1), true, palette.wheel, '#8da372');
        this.addWheel(wheelRadius, wheelWidth, -length * 0.28, side * (width / 2 + 0.1), false, palette.wheel, '#8da372');
      }

      // Lights
      for (const side of [-1, 1]) {
        this.addBox([0.18, 0.3, 0.42], [length / 2 - 0.02, 1.04, side * width * 0.3], lightMat, false);
        const tail = this.addBox([0.18, 0.38, 0.3], [-length / 2 + 0.02, 1.1, side * width * 0.38], tailMat, false);
        this.brakeLights.push(tail);
      }

      this.addNumber(number, length * 0.02, 2.23, 0, '#ffffff', width);
      this.addFlames(-length / 2 - 0.15, 0);

    } else {
      // KEPIK: Ultra-compact, rounded off-road buggy with exposed chunky tubular exoskeleton roll-cage, huge balloon tires, high-mount engine
      const length = 4.8;
      const width = 3.4;
      const wheelRadius = 0.88;
      const wheelWidth = 0.65;

      // Base buggy tub
      this.addBox([length * 0.88, 0.42, width * 0.85], [0, 0.65, 0], darkTrimMat, true, true);
      this.addBox([length * 0.8, 0.44, width * 0.88], [0, 0.98, 0], bodyMat, true, true);

      // Compact sloped nose & front bash guard
      this.addBox([length * 0.3, 0.25, width * 0.65], [length * 0.32, 1.05, 0], bodyMat, true, true);
      this.addBox([0.3, 0.45, width * 0.62], [length / 2 + 0.05, 0.85, 0], stripeMat); // Front bash bar

      // Open cockpit with exposed driver
      this.addDriver(-0.05, 1.48, 0, '#f5ebd2', '#e03a3a', 1.05);

      // Prominent tubular roll cage all around
      for (const side of [-1, 1]) {
        // Front angled strut
        const fStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), stripeMat);
        fStrut.rotation.z = -Math.PI / 4;
        fStrut.position.set(0.65, 1.65, side * width * 0.36);
        fStrut.castShadow = true;
        this.body.add(fStrut);

        // Rear angled strut
        const rStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.7, 6), stripeMat);
        rStrut.rotation.z = Math.PI / 4.2;
        rStrut.position.set(-0.75, 1.68, side * width * 0.36);
        rStrut.castShadow = true;
        this.body.add(rStrut);

        // Top horizontal rail
        const tRail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 6), stripeMat);
        tRail.rotation.x = Math.PI / 2;
        tRail.rotation.y = Math.PI / 2;
        tRail.position.set(-0.05, 2.24, side * width * 0.36);
        this.body.add(tRail);
      }
      // Cross bars over roof
      this.addBox([0.16, 0.16, width * 0.76], [0.35, 2.24, 0], stripeMat);
      this.addBox([0.16, 0.16, width * 0.76], [-0.45, 2.24, 0], stripeMat);

      // High rear engine block with visible intake filter & exhaust header
      this.addBox([1.1, 0.7, 1.3], [-length * 0.32, 1.35, 0], chromeMat);
      // Twin high-rise exhausts
      for (const side of [-1, 1]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 6), darkTrimMat);
        pipe.position.set(-length * 0.42, 1.85, side * 0.42);
        this.body.add(pipe);
      }

      // Massive chunky balloon buggy wheels
      for (const side of [-1, 1]) {
        this.addWheel(wheelRadius, wheelWidth, length * 0.28, side * (width / 2 + 0.14), true, palette.wheel, palette.stripe);
        this.addWheel(wheelRadius, wheelWidth, -length * 0.28, side * (width / 2 + 0.14), false, palette.wheel, palette.stripe);
      }

      // Round safari bug-eye headlights
      for (const side of [-1, 1]) {
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.25, 8), lightMat);
        head.rotation.z = Math.PI / 2;
        head.position.set(length * 0.42, 1.32, side * 0.72);
        this.body.add(head);

        const tail = this.addBox([0.16, 0.26, 0.32], [-length / 2 + 0.08, 1.15, side * 0.65], tailMat, false);
        this.brakeLights.push(tail);
      }

      this.addNumber(number, -0.05, 2.28, 0, '#ffffff', width);
      this.addFlames(-length / 2 - 0.2, 0);
    }
  }

  update(racer: RacerState, dt: number): void {
    this.group.visible = true;
    this.group.position.set(toSceneX(racer.x), ROAD_Y + 0.03, toSceneZ(racer.y));
    this.group.rotation.y = -racer.angle;

    const speed = Math.hypot(racer.vx, racer.vy);
    this.spin += (speed / 0.65) * dt;

    // Wheel rotation and front steering
    for (const wheel of this.wheels) {
      wheel.mesh.rotation.z = this.spin;
      if (wheel.front) {
        wheel.pivot.rotation.y = racer.steer * 0.38;
      }
    }

    // Suspension bounce and dynamic body roll in corners (gentle, no jitter)
    if (speed > 8) {
      this.bounceTime += dt * Math.min(16, speed * 0.12);
      const tinyBounce = Math.sin(this.bounceTime) * 0.008;
      this.body.position.y = tinyBounce;
    } else {
      this.body.position.y = 0;
    }

    // Body roll / lean into turns: leaning naturally during hard cornering
    const steerAmount = racer.steer * Math.min(1.2, speed / 55);
    const targetRoll = -steerAmount * 0.12; // Roll around local Z axis
    const targetPitch = racer.nitroActive ? -0.05 : 0; // Squat on nitro
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, targetRoll, Math.min(1, dt * 10));
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, targetPitch, Math.min(1, dt * 8));

    // Nitro flames
    this.nitroPulse += dt * 24;
    for (const flame of this.flames) {
      flame.visible = racer.nitroActive;
      const scale = 0.85 + Math.sin(this.nitroPulse) * 0.25;
      flame.scale.set(scale, 0.9 + Math.sin(this.nitroPulse + 1.2) * 0.35, scale);
    }

    // Brake lights
    for (const tail of this.brakeLights) {
      (tail.material as THREE.MeshBasicMaterial).color.setHex(
        speed < 8 || racer.drifting ? 0xff5030 : 0xa02518,
      );
    }
  }

  setAttractVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
