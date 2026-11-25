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
  private flameGroups: THREE.Group[] = [];
  private windTrails: THREE.Mesh[] = [];
  private brakeLights: THREE.Mesh[] = [];
  private dropShadow: THREE.Mesh | null = null;
  private sparkGroup = new THREE.Group();
  private sparks: { mesh: THREE.Mesh; angle: number; speed: number; vy: number }[] = [];
  private sparkTimer = 0;
  private sparkDuration = 0.22;
  private impactStrength = 0;
  private smokeGroup = new THREE.Group();
  private smokePuffs: { mesh: THREE.Mesh; life: number; maxLife: number; vx: number; vy: number; vz: number }[] = [];
  private spin = 0;
  private nitroPulse = 0;
  private carId: CarId;

  constructor(carId: CarId, palette: CarPalette, number: number, isPlayer: boolean) {
    this.carId = carId;
    this.group.add(this.body);

    // Make car body models taller / chubbier (vertical height scale +32%)
    // while keeping length (X) and width (Z) unchanged
    this.body.scale.set(1.0, 1.32, 1.0);

    this.addDropShadow(carId);
    this.build(carId, palette, number);
    this.buildSparks();
    this.buildSmoke();
    this.buildWindTrails();

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

  private buildSparks(): void {
    const yellowMat = new THREE.MeshBasicMaterial({ color: '#ffe44d' });
    const orangeMat = new THREE.MeshBasicMaterial({ color: '#ff621f' });
    const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    for (let i = 0; i < 24; i += 1) {
      const mat = i % 3 === 0 ? whiteMat : i % 2 === 0 ? yellowMat : orangeMat;
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
    this.group.add(this.sparkGroup);
  }

  private buildWindTrails(): void {
    const trailMat = new THREE.MeshBasicMaterial({
      color: '#e0f7ff',
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    // Streamline wind streaks trailing from rear corners and roof
    const offsets: [number, number, number][] = [
      [-1.8, 1.15, -0.9],
      [-1.8, 1.15, 0.9],
      [-1.9, 0.52, -1.2],
      [-1.9, 0.52, 1.2],
    ];
    for (const [x, y, z] of offsets) {
      const geo = new THREE.PlaneGeometry(2.4, 0.07);
      const mesh = new THREE.Mesh(geo, trailMat);
      mesh.position.set(x - 1.2, y, z);
      mesh.rotation.y = 0;
      mesh.visible = false;
      this.body.add(mesh);
      this.windTrails.push(mesh);
    }
  }

  private buildSmoke(): void {
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
    this.group.add(this.smokeGroup);
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
    const l = carId === 'bagas' ? 6.2 : carId === 'okra' ? 5.6 : carId === 'kepik' ? 5.0 : carId === 'go' ? 5.0 : carId === 'hachi' ? 5.4 : carId === 'kart' ? 3.8 : 5.4;
    const w = carId === 'bagas' ? 4.0 : carId === 'okra' ? 3.9 : carId === 'kepik' ? 3.8 : carId === 'go' ? 3.5 : carId === 'hachi' ? 3.6 : carId === 'kart' ? 3.2 : 3.7;
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

  private addProfile(
    points: [number, number][],
    width: number,
    material: THREE.Material,
    bevel = 0.08,
    cast = true,
  ): THREE.Mesh {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 4,
    });
    geo.translate(0, 0, -width / 2);

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    return mesh;
  }

  private addTube(
    a: [number, number, number],
    b: [number, number, number],
    radius: number,
    material: THREE.Material,
    cast = true,
  ): THREE.Mesh {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), material);
    mesh.position.copy(start).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = cast;
    this.body.add(mesh);
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
        new THREE.ConeGeometry(0.20, 1.8, 6),
        new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.95 }),
      );
      coreFlame.rotation.z = Math.PI / 2;
      flameGroup.add(coreFlame);

      const outerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 1.3, 6),
        new THREE.MeshBasicMaterial({ color: '#ff4820', transparent: true, opacity: 0.8 }),
      );
      outerFlame.rotation.z = Math.PI / 2;
      outerFlame.position.x = -0.2;
      flameGroup.add(outerFlame);

      flameGroup.visible = false;
      this.body.add(flameGroup);
      this.flames.push(coreFlame);
      this.flameGroups.push(flameGroup);
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
      // SIRIP: Sculpted rally hatchback with sloped hood & windshield, flared fenders, roof scoop, and rear wing
      const length = 5.2;
      const width = 3.35;
      const wheelRadius = 0.72;
      const wheelWidth = 0.52;

      // Undercarriage & low splitter/diffuser
      this.addBox([4.85, 0.24, 2.86], [0, 0.42, 0], darkTrimMat, true, false);
      this.addBox([0.38, 0.12, width * 0.9], [2.52, 0.44, 0], shadeMat);
      this.addBox([0.36, 0.16, width * 0.86], [-2.48, 0.46, 0], darkTrimMat);

      // Sculpted lower body (sloped front bumper, sloped hood, muscular beltline, rear hatch)
      this.addProfile(
        [
          [2.38, 0.48],
          [2.6, 0.6],
          [2.62, 0.92],
          [2.4, 1.12],
          [1.1, 1.3],
          [-2.05, 1.36],
          [-2.48, 1.24],
          [-2.56, 0.92],
          [-2.5, 0.58],
          [-2.28, 0.48],
        ],
        3.04,
        bodyMat,
        0.14,
      );

      // Side skirts & rally stripe
      for (const side of [-1, 1]) {
        this.addBox([2.4, 0.11, 0.08], [-0.04, 0.76, side * 1.66], stripeMat, false, false);
        const mirror = this.addBox([0.24, 0.16, 0.28], [0.88, 1.38, side * 1.54], bodyMat);
        mirror.rotation.y = side * 0.22;
      }

      // Hood rally vent
      const hoodVent = this.addBox([0.85, 0.1, 0.76], [1.68, 1.24, 0], shadeMat);
      hoodVent.rotation.z = -0.14;

      // Sculpted greenhouse glass with raked windshield and fastback rear glass
      this.addProfile(
        [
          [1.12, 1.28],
          [0.18, 1.98],
          [-1.38, 1.96],
          [-2.16, 1.28],
          [-2.16, 1.22],
          [1.12, 1.22],
        ],
        2.5,
        glassMat,
        0.05,
      );

      // Arched roof cap
      this.addProfile(
        [
          [0.22, 1.97],
          [-0.58, 2.06],
          [-1.44, 1.96],
          [-1.44, 1.9],
          [0.22, 1.9],
        ],
        2.42,
        bodyMat,
        0.08,
      );

      // Angled A-pillars, dark B-pillars, C-pillars
      const aLen = Math.hypot(1.12 - 0.18, 1.98 - 1.28);
      const aTilt = Math.atan2(1.98 - 1.28, 1.12 - 0.18);
      const cLen = Math.hypot(2.16 - 1.38, 1.96 - 1.28);
      const cTilt = Math.atan2(1.96 - 1.28, 2.16 - 1.38);
      for (const side of [-1, 1]) {
        const aPillar = this.addBox([aLen, 0.12, 0.14], [0.65, 1.63, side * 1.23], bodyMat, true, false);
        aPillar.rotation.z = -aTilt;
        this.addBox([0.14, 0.66, 0.08], [-0.42, 1.62, side * 1.28], darkTrimMat, false, false);
        const cPillar = this.addBox([cLen, 0.2, 0.18], [-1.77, 1.62, side * 1.18], bodyMat, true, false);
        cPillar.rotation.z = cTilt;
      }

      // Roof rally air scoop
      this.addBox([0.68, 0.2, 0.5], [-0.14, 2.12, 0], stripeMat);
      this.addBox([0.14, 0.11, 0.36], [0.18, 2.12, 0], darkTrimMat);

      // Driver inside cabin
      this.addDriver(-0.22, 1.54, 0, '#ffffff', '#1a2228', 0.95);

      // Angled rally rear wing
      const wing = this.addBox([0.52, 0.11, width * 0.84], [-2.56, 2.04, 0], stripeMat);
      wing.rotation.z = -0.1;
      for (const side of [-1, 1]) {
        const strut = this.addBox([0.42, 0.56, 0.1], [-2.44, 1.74, side * width * 0.36], shadeMat);
        strut.rotation.z = 0.22;
      }

      // Wheels
      for (const side of [-1, 1]) {
        this.addWheel(wheelRadius, wheelWidth, length * 0.29, side * (width / 2 + 0.04), true, palette.wheel, palette.stripe);
        this.addWheel(wheelRadius, wheelWidth, -length * 0.29, side * (width / 2 + 0.04), false, palette.wheel, palette.stripe);
      }

      // Swept headlights & taillights
      for (const side of [-1, 1]) {
        const head = this.addBox([0.38, 0.22, 0.48], [2.4, 0.98, side * 1.06], lightMat, false);
        head.rotation.y = -side * 0.28;
        head.rotation.z = -0.18;
        const tail = this.addBox([0.22, 0.26, 0.48], [-2.44, 0.98, side * 1.06], tailMat, false);
        tail.rotation.y = side * 0.22;
        this.brakeLights.push(tail);
      }

      this.addNumber(number, -0.58, 2.08, 0, '#15222a', width * 0.9);
      this.addFlames(-length / 2 - 0.15, 0);

    } else if (carId === 'hachi') {
      // HACHI: sculpted AE86 Trueno drift coupe with sloped nose & hood, raked windshield,
      // fastback rear hatch, ducktail spoiler, and panda two-tone trim
      const length = 5.3;
      const width = 3.25;
      const wheelRadius = 0.68;
      const wheelWidth = 0.52;

      // Undercarriage & front chin lip
      this.addBox([4.85, 0.22, 2.8], [0, 0.42, 0], darkTrimMat, true, false);
      const lip = this.addBox([0.3, 0.14, 2.94], [2.56, 0.44, 0], darkTrimMat);
      lip.rotation.z = -0.15;

      // Sculpted lower body (wedge nose, long hood, flat beltline, fastback rear)
      this.addProfile(
        [
          [2.42, 0.48],
          [2.64, 0.64],
          [2.6, 0.96],
          [2.28, 1.12],
          [1.04, 1.26],
          [-2.08, 1.28],
          [-2.52, 1.18],
          [-2.6, 0.92],
          [-2.54, 0.56],
          [-2.3, 0.48],
        ],
        2.96,
        bodyMat,
        0.13,
      );

      // Panda two-tone bumpers, side skirts, Initial D door stripe, and black hood
      this.addBox([0.22, 0.34, 3.06], [2.66, 0.66, 0], stripeMat); // Front black bumper
      this.addBox([0.22, 0.34, 3.04], [-2.6, 0.68, 0], stripeMat); // Rear black bumper
      for (const side of [-1, 1]) {
        this.addBox([3.6, 0.2, 0.1], [-0.04, 0.62, side * 1.62], stripeMat, false, false); // Panda lower skirt
        this.addBox([2.55, 0.1, 0.08], [-0.15, 0.96, side * 1.63], stripeMat, false, false); // Side door stripe
        const mirror = this.addBox([0.22, 0.15, 0.26], [0.82, 1.36, side * 1.48], stripeMat);
        mirror.rotation.y = side * 0.22;
      }
      const hoodPanel = this.addBox([1.44, 0.08, 2.48], [1.66, 1.26, 0], stripeMat);
      hoodPanel.rotation.z = -0.11;

      // Open Initial D pop-up headlights ("mata terbuka"), front grille, and bumper fog lights
      for (const side of [-1, 1]) {
        const pod = this.addBox([0.42, 0.28, 0.64], [2.24, 1.24, side * 0.98], bodyMat);
        pod.rotation.z = -0.1;
        this.addBox([0.1, 0.22, 0.52], [2.46, 1.22, side * 0.98], lightMat, false);
        const fog = this.addBox([0.12, 0.14, 0.44], [2.74, 0.74, side * 1.02], lightMat, false);
        fog.rotation.y = -side * 0.15;
      }
      this.addBox([0.1, 0.18, 1.12], [2.74, 0.92, 0], darkTrimMat, false);

      // Sculpted greenhouse glass with raked windshield and fastback hatch
      this.addProfile(
        [
          [1.06, 1.24],
          [0.24, 1.88],
          [-1.08, 1.88],
          [-2.14, 1.26],
          [-2.14, 1.2],
          [1.06, 1.2],
        ],
        2.44,
        glassMat,
        0.05,
      );

      // Sleek panda-black roof cap
      this.addProfile(
        [
          [0.28, 1.87],
          [-0.42, 1.94],
          [-1.14, 1.87],
          [-1.14, 1.82],
          [0.28, 1.82],
        ],
        2.36,
        stripeMat,
        0.07,
      );

      // Angled A-pillars, B-pillars, C-pillars
      const haLen = Math.hypot(1.06 - 0.24, 1.88 - 1.24);
      const haTilt = Math.atan2(1.88 - 1.24, 1.06 - 0.24);
      const hcLen = Math.hypot(2.14 - 1.08, 1.88 - 1.26);
      const hcTilt = Math.atan2(1.88 - 1.26, 2.14 - 1.08);
      for (const side of [-1, 1]) {
        const aPillar = this.addBox([haLen, 0.11, 0.14], [0.65, 1.56, side * 1.2], bodyMat, true, false);
        aPillar.rotation.z = -haTilt;
        this.addBox([0.12, 0.62, 0.08], [-0.36, 1.56, side * 1.25], darkTrimMat, false, false);
        const cPillar = this.addBox([hcLen, 0.18, 0.16], [-1.61, 1.57, side * 1.16], bodyMat, true, false);
        cPillar.rotation.z = hcTilt;
      }

      // Ducktail spoiler
      const ducktail = this.addBox([0.34, 0.12, 2.52], [-2.46, 1.32, 0], stripeMat);
      ducktail.rotation.z = -0.35;

      // Driver
      this.addDriver(-0.24, 1.5, 0, '#f1f3f4', '#1a2228', 0.9);

      // Wide silver rims
      for (const side of [-1, 1]) {
        this.addWheel(wheelRadius, wheelWidth, length * 0.3, side * (width / 2 + 0.03), true, palette.wheel, '#cdd3d8');
        this.addWheel(wheelRadius, wheelWidth + 0.06, -length * 0.3, side * (width / 2 + 0.06), false, palette.wheel, '#cdd3d8');
      }

      const tail = this.addBox([0.16, 0.24, 2.42], [-2.54, 0.98, 0], tailMat, false);
      this.brakeLights.push(tail);

      this.addNumber(number, -0.44, 1.96, 0, '#f1f3f4', width * 0.85);
      this.addFlames(-length / 2 - 0.15, 0);

    } else if (carId === 'kart') {
      // KART: sculpted open-wheel racing go-kart with curved nose fairing, aerodynamic side pods,
      // molded bucket seat, tubular chrome bumpers, round steering wheel, and rear engine
      const length = 3.8;
      const width = 2.9;

      // Sculpted floor pan
      this.addProfile(
        [
          [1.68, 0.4],
          [1.76, 0.54],
          [-1.68, 0.54],
          [-1.62, 0.4],
        ],
        1.64,
        darkTrimMat,
        0.05,
      );

      // Aerodynamic sloped nose fairing & front Nassau panel
      this.addProfile(
        [
          [1.82, 0.54],
          [1.64, 0.8],
          [0.72, 1.02],
          [0.64, 0.54],
        ],
        1.14,
        bodyMat,
        0.09,
      );

      // Sculpted side pods (left & right)
      for (const side of [-1, 1]) {
        this.addProfile(
          [
            [0.78, 0.56],
            [0.68, 0.9],
            [-0.46, 0.92],
            [-0.62, 0.56],
          ],
          0.46,
          bodyMat,
          0.08,
        ).position.z = side * 0.96;
      }

      // Tubular chrome front & rear wraparound bumpers + side rails
      this.addTube([1.92, 0.54, -1.16], [1.92, 0.54, 1.16], 0.065, chromeMat);
      this.addTube([-1.88, 0.58, -1.18], [-1.88, 0.58, 1.18], 0.065, chromeMat);
      for (const side of [-1, 1]) {
        this.addTube([1.92, 0.54, side * 1.16], [1.55, 0.54, side * 0.84], 0.065, chromeMat);
        this.addTube([-1.88, 0.58, side * 1.18], [-1.52, 0.58, side * 0.84], 0.065, chromeMat);
        this.addTube([1.45, 0.58, side * 0.84], [-1.45, 0.58, side * 0.84], 0.055, chromeMat);
      }

      // Molded racing bucket seat
      this.addProfile(
        [
          [-0.08, 0.56],
          [-0.58, 0.56],
          [-0.96, 1.38],
          [-0.82, 1.44],
          [-0.48, 0.72],
          [-0.08, 0.68],
        ],
        0.84,
        shadeMat,
        0.06,
      );

      // Angled steering column & round racing steering wheel
      this.addTube([0.66, 0.82, 0], [0.22, 1.24, 0], 0.055, chromeMat);
      const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 8, 16), darkTrimMat);
      wheelRing.rotation.y = Math.PI / 2;
      wheelRing.rotation.x = 0.45;
      wheelRing.position.set(0.22, 1.24, 0);
      this.body.add(wheelRing);

      // Cylindrical rear engine & swept exhaust pipe
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.56, 10), chromeMat);
      eng.position.set(-1.32, 0.84, 0.46);
      this.body.add(eng);
      this.addTube([-1.28, 0.78, -0.4], [-1.84, 0.92, -0.48], 0.065, chromeMat);

      // Driver
      this.addDriver(-0.5, 1.54, 0, palette.stripe, '#1a2228', 1.05);

      // Exposed slick kart wheels
      for (const side of [-1, 1]) {
        this.addWheel(0.46, 0.42, length * 0.36, side * (width / 2 + 0.02), true, palette.wheel, '#cfd5da');
        this.addWheel(0.58, 0.62, -length * 0.3, side * (width / 2 + 0.06), false, palette.wheel, '#cfd5da');
      }

      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 8), tailMat);
      tail.rotation.z = Math.PI / 2;
      tail.position.set(-1.82, 0.76, 0);
      this.body.add(tail);
      this.brakeLights.push(tail);

      this.addNumber(number, 1.12, 0.98, 0, '#15222a', width * 0.82);
      this.addFlames(-length / 2 - 0.16, 0);

    } else if (carId === 'go') {
      // GO: sculpted compact hatchback (Datsun GO) with sloped hood & windshield,
      // arched roofline, angled C-pillars, and signature hexagonal chrome grille
      const length = 4.95;
      const width = 3.16;
      const wheelRadius = 0.68;
      const wheelWidth = 0.46;

      // Undercarriage floorpan
      this.addBox([4.4, 0.24, 2.66], [0, 0.42, 0], darkTrimMat, true, false);

      // Sculpted lower body (sloped front bumper, sloped hood, gentle beltline, rounded rear bumper)
      this.addProfile(
        [
          [2.22, 0.46],
          [2.44, 0.58],
          [2.48, 0.94],
          [2.28, 1.14],
          [1.12, 1.32],
          [-1.95, 1.38],
          [-2.34, 1.24],
          [-2.42, 0.94],
          [-2.38, 0.58],
          [-2.16, 0.46],
        ],
        2.86,
        bodyMat,
        0.14,
      );

      // Sculpted greenhouse glass with raked windshield and sloped rear hatch window
      this.addProfile(
        [
          [1.14, 1.29],
          [0.2, 2.04],
          [-1.38, 2.04],
          [-2.08, 1.34],
          [-2.08, 1.26],
          [1.14, 1.26],
        ],
        2.44,
        glassMat,
        0.05,
      );

      // Arched roof cap
      this.addProfile(
        [
          [0.24, 2.03],
          [-0.55, 2.13],
          [-1.44, 2.03],
          [-1.44, 1.97],
          [0.24, 1.97],
        ],
        2.38,
        bodyMat,
        0.08,
      );

      // Angled A-pillars, slim dark B-pillars, sculpted C-pillars, side mirrors, and subtle side crease
      const aPillarLen = Math.hypot(1.14 - 0.2, 2.04 - 1.3);
      const aPillarTilt = Math.atan2(2.04 - 1.3, 1.14 - 0.2);
      const cPillarLen = Math.hypot(2.08 - 1.38, 2.04 - 1.34);
      const cPillarTilt = Math.atan2(2.04 - 1.34, 2.08 - 1.38);

      for (const side of [-1, 1]) {
        const aPillar = this.addBox([aPillarLen, 0.12, 0.14], [0.67, 1.67, side * 1.2], bodyMat, true, false);
        aPillar.rotation.z = -aPillarTilt;

        this.addBox([0.14, 0.72, 0.08], [-0.36, 1.66, side * 1.25], darkTrimMat, false, false);

        const cPillar = this.addBox([cPillarLen, 0.2, 0.18], [-1.73, 1.68, side * 1.17], bodyMat, true, false);
        cPillar.rotation.z = cPillarTilt;

        // Black door mirrors at base of A-pillar
        const mirror = this.addBox([0.24, 0.18, 0.3], [0.92, 1.42, side * 1.44], darkTrimMat);
        mirror.rotation.y = side * 0.22;

        // Subtle lower door crease
        this.addBox([2.1, 0.08, 0.06], [-0.15, 0.76, side * 1.56], shadeMat, false, false);
      }

      // Integrated rear hatch roof spoiler
      const spoiler = this.addBox([0.36, 0.09, 2.1], [-1.52, 2.04, 0], bodyMat);
      spoiler.rotation.z = -0.14;

      // Signature Datsun hexagonal front grille (chrome surround + dark mesh + emblem bar)
      const grilleFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 6), chromeMat);
      grilleFrame.rotation.z = Math.PI / 2;
      grilleFrame.scale.set(1, 1, 1.32);
      grilleFrame.position.set(2.49, 0.9, 0);
      this.body.add(grilleFrame);

      const grilleInner = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.13, 6), darkTrimMat);
      grilleInner.rotation.z = Math.PI / 2;
      grilleInner.scale.set(1, 1, 1.28);
      grilleInner.position.set(2.51, 0.9, 0);
      this.body.add(grilleInner);

      this.addBox([0.08, 0.1, 0.34], [2.56, 0.92, 0], chromeMat, false);

      // Lower bumper intake + license plate + angled corner fog pockets
      this.addBox([0.1, 0.18, 1.15], [2.49, 0.58, 0], darkTrimMat, false);
      this.addBox([0.08, 0.16, 0.62], [2.52, 0.68, 0], chromeMat, false);
      for (const side of [-1, 1]) {
        const fog = this.addBox([0.14, 0.22, 0.44], [2.37, 0.64, side * 1.1], darkTrimMat, false);
        fog.rotation.y = -side * 0.34;
      }

      // Swept-back wrap-around headlights & vertical-ish rear tail lights
      for (const side of [-1, 1]) {
        const head = this.addBox([0.42, 0.24, 0.48], [2.25, 1.04, side * 1.08], lightMat, false);
        head.rotation.y = -side * 0.32;
        head.rotation.z = -0.22;

        const tail = this.addBox([0.22, 0.44, 0.3], [-2.3, 1.08, side * 1.14], tailMat, false);
        tail.rotation.y = side * 0.25;
        tail.rotation.z = 0.2;
        this.brakeLights.push(tail);
      }

      // Driver visible through the sloped windshield
      this.addDriver(-0.18, 1.56, 0, '#e0452f', '#1a2228', 0.92);

      // Hubcap wheels
      for (const side of [-1, 1]) {
        this.addWheel(wheelRadius, wheelWidth, length * 0.3, side * (width / 2 - 0.02), true, palette.wheel, '#d6dde2');
        this.addWheel(wheelRadius, wheelWidth, -length * 0.3, side * (width / 2 - 0.02), false, palette.wheel, '#d6dde2');
      }

      this.addNumber(number, -0.58, 2.15, 0, '#15222a', width * 0.85);
      this.addFlames(-length / 2 - 0.1, 0);

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
      // OKRA: Sculpted rugged pickup truck with sloped hood & windshield, tubular bull-bar, cargo bed & roll bar
      const length = 5.6;
      const width = 3.5;
      const wheelRadius = 0.78;
      const wheelWidth = 0.56;

      // Lifted undercarriage & front skid plate
      this.addBox([5.15, 0.28, 2.94], [0, 0.52, 0], darkTrimMat, true, false);
      const skid = this.addBox([0.46, 0.16, 2.2], [2.72, 0.52, 0], shadeMat);
      skid.rotation.z = 0.35;

      // Sculpted pickup body (beveled nose, sloped hood, long bed beltline, rounded rear bumper)
      this.addProfile(
        [
          [2.56, 0.58],
          [2.78, 0.72],
          [2.8, 1.12],
          [2.64, 1.3],
          [1.02, 1.46],
          [-2.58, 1.44],
          [-2.78, 1.28],
          [-2.8, 0.74],
          [-2.56, 0.58],
        ],
        3.14,
        bodyMat,
        0.15,
      );

      // Sloped hood stripe & grille
      const hoodStripe = this.addBox([1.56, 0.06, 1.12], [1.82, 1.41, 0], stripeMat);
      hoodStripe.rotation.z = -0.1;
      this.addBox([0.1, 0.34, 1.82], [2.84, 1.04, 0], darkTrimMat, false);

      // Tubular steel bull-bar
      const bullTop = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.1, 8), shadeMat);
      bullTop.rotation.x = Math.PI / 2;
      bullTop.position.set(2.96, 1.06, 0);
      this.body.add(bullTop);
      for (const side of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 8), shadeMat);
        post.rotation.z = -0.15;
        post.position.set(2.92, 0.8, side * 0.72);
        this.body.add(post);
      }

      // Sculpted cab glass with raked windshield
      this.addProfile(
        [
          [1.04, 1.44],
          [0.4, 2.12],
          [-0.58, 2.12],
          [-0.72, 1.44],
        ],
        2.62,
        glassMat,
        0.05,
      );

      // Cab roof cap
      this.addProfile(
        [
          [0.44, 2.11],
          [-0.08, 2.2],
          [-0.62, 2.11],
          [-0.62, 2.05],
          [0.44, 2.05],
        ],
        2.54,
        bodyMat,
        0.08,
      );

      // Angled A-pillars, rear cab pillars, mirrors, and side trim
      const cabALen = Math.hypot(1.04 - 0.4, 2.12 - 1.44);
      const cabATilt = Math.atan2(2.12 - 1.44, 1.04 - 0.4);
      for (const side of [-1, 1]) {
        const aPillar = this.addBox([cabALen, 0.13, 0.14], [0.72, 1.78, side * 1.3], bodyMat, true, false);
        aPillar.rotation.z = -cabATilt;
        this.addBox([0.2, 0.72, 0.16], [-0.64, 1.78, side * 1.28], bodyMat, true, false);
        const mirror = this.addBox([0.24, 0.22, 0.3], [0.84, 1.54, side * 1.62], darkTrimMat);
        mirror.rotation.y = side * 0.2;
        this.addBox([2.4, 0.1, 0.08], [0.1, 0.84, side * 1.72], shadeMat, false, false);
      }

      // Driver
      this.addDriver(0.08, 1.7, 0, '#588a44', '#152012', 1.0);

      // Beveled cargo bed sidewalls & tailgate
      const bedX = -1.68;
      for (const side of [-1, 1]) {
        this.addProfile(
          [
            [-0.72, 1.4],
            [-0.72, 1.7],
            [-2.62, 1.68],
            [-2.68, 1.4],
          ],
          0.16,
          shadeMat,
          0.05,
        ).position.z = side * 1.38;
      }
      this.addBox([0.18, 0.34, 2.7], [-2.68, 1.54, 0], shadeMat);

      // Cargo in bed: wooden crate & barrel
      this.addBox([1.26, 0.56, 1.16], [bedX - 0.08, 1.52, 0.12], this.material('#8a5832'));
      this.addBox([1.28, 0.12, 1.18], [bedX - 0.08, 1.8, 0.12], this.material('#b8824f'));
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.72, 10),
        this.material('#2d4052'),
      );
      barrel.position.set(bedX + 0.62, 1.6, -0.58);
      this.body.add(barrel);

      // Tubular steel roll bar over cab with 4 round spotlights
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.95, 8), darkTrimMat);
        leg.rotation.z = -0.22;
        leg.position.set(-0.78, 2.02, side * 1.16);
        this.body.add(leg);
      }
      const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.46, 8), darkTrimMat);
      topBar.rotation.x = Math.PI / 2;
      topBar.position.set(-0.68, 2.45, 0);
      this.body.add(topBar);
      for (let s = -3; s <= 3; s += 2) {
        const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 8), lightMat);
        spot.rotation.z = Math.PI / 2;
        spot.position.set(-0.66, 2.6, s * 0.27);
        this.body.add(spot);
      }

      // Chunky all-terrain wheels
      for (const side of [-1, 1]) {
        this.addWheel(wheelRadius, wheelWidth, length * 0.28, side * (width / 2 + 0.04), true, palette.wheel, '#8da372');
        this.addWheel(wheelRadius, wheelWidth, -length * 0.28, side * (width / 2 + 0.04), false, palette.wheel, '#8da372');
      }

      // Swept headlights & taillights
      for (const side of [-1, 1]) {
        const head = this.addBox([0.3, 0.26, 0.44], [2.66, 1.06, side * 1.14], lightMat, false);
        head.rotation.y = -side * 0.25;
        const tail = this.addBox([0.2, 0.36, 0.3], [-2.68, 1.1, side * 1.28], tailMat, false);
        tail.rotation.y = side * 0.2;
        this.brakeLights.push(tail);
      }

      this.addNumber(number, -0.08, 2.22, 0, '#ffffff', width * 0.85);
      this.addFlames(-length / 2 - 0.15, 0);

    } else {
      // KEPIK: Proper open-wheel off-road dune buggy with tapered sculpted tub,
      // exposed tubular suspension A-arms & coilovers, full exoskeleton roll-cage,
      // roof light bar, and exposed rear engine with swept megaphone exhausts
      const length = 4.8;
      const width = 3.4;
      const wheelRadius = 0.88;
      const wheelWidth = 0.65;

      // Narrow sculpted skid-pan & chassis tub (leaves wheels exposed!)
      this.addProfile(
        [
          [2.26, 0.68],
          [1.92, 0.42],
          [-2.08, 0.42],
          [-2.32, 0.7],
          [-2.18, 0.86],
          [2.05, 0.86],
        ],
        1.78,
        darkTrimMat,
        0.08,
      );

      // Sculpted buggy body shell with sloped nose, open cockpit dip, and rear engine cowl
      this.addProfile(
        [
          [2.12, 0.74],
          [1.82, 1.04],
          [0.72, 1.24],
          [0.52, 0.94],
          [-0.86, 0.94],
          [-1.05, 1.26],
          [-1.92, 1.18],
          [-2.12, 0.82],
          [-1.9, 0.68],
          [1.92, 0.68],
        ],
        1.88,
        bodyMat,
        0.12,
      );

      // Tapered nose cone & front bash hoop (tubular, not boxy)
      this.addProfile(
        [
          [2.32, 0.72],
          [2.05, 1.0],
          [0.95, 1.2],
          [0.95, 0.72],
        ],
        1.22,
        bodyMat,
        0.1,
      );
      const bashTop = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.46, 8), stripeMat);
      bashTop.rotation.x = Math.PI / 2;
      bashTop.position.set(2.44, 0.92, 0);
      this.body.add(bashTop);
      for (const side of [-1, 1]) {
        const bashLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.56, 8), stripeMat);
        bashLeg.rotation.z = -0.52;
        bashLeg.position.set(2.3, 0.72, side * 0.68);
        this.body.add(bashLeg);

        // Side tubular rock-sliders / nerf bars
        const nerf = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.75, 8), darkTrimMat);
        nerf.rotation.z = Math.PI / 2;
        nerf.position.set(0, 0.56, side * 1.16);
        this.body.add(nerf);
      }

      // Exposed suspension A-arms & angled coilover shocks to all 4 wheels
      for (const xPos of [length * 0.29, -length * 0.29]) {
        for (const side of [-1, 1]) {
          this.addTube([xPos, 0.64, side * 0.75], [xPos, 0.64, side * 1.62], 0.065, darkTrimMat);
          this.addTube([xPos, 1.18, side * 0.88], [xPos, 0.7, side * 1.48], 0.075, stripeMat);
        }
      }

      // Open cockpit with exposed driver & racing seat
      this.addBox([0.28, 0.65, 0.74], [-0.46, 1.24, 0], darkTrimMat);
      this.addDriver(-0.08, 1.44, 0, '#f5ebd2', '#e03a3a', 1.02);

      // Full tubular exoskeleton roll-cage connected directly to roof corners and chassis
      for (const side of [-1, 1]) {
        const z = side * 0.86;
        // Front A-pillar tube: hood mount -> roof front corner
        this.addTube([0.96, 1.14, z], [0.46, 2.15, z], 0.075, stripeMat);
        // Top roof rail: roof front -> roof rear
        this.addTube([0.46, 2.15, z], [-0.64, 2.15, z], 0.075, stripeMat);
        // Rear B/C-pillar tube: roof rear corner -> engine deck
        this.addTube([-0.64, 2.15, z], [-1.02, 1.2, z], 0.075, stripeMat);
        // Rear engine-cage brace: roof rear corner -> rear bumper
        this.addTube([-0.64, 2.15, z], [-2.02, 0.94, side * 0.74], 0.065, stripeMat);
      }
      // Roof front & rear crossbars
      this.addTube([0.46, 2.15, -0.86], [0.46, 2.15, 0.86], 0.07, stripeMat);
      this.addTube([-0.64, 2.15, -0.86], [-0.64, 2.15, 0.86], 0.07, stripeMat);

      // Sleek aluminum buggy roof panel sitting flush on the roll-cage rails
      this.addProfile(
        [
          [0.48, 2.18],
          [-0.08, 2.24],
          [-0.64, 2.18],
          [-0.64, 2.12],
          [0.48, 2.12],
        ],
        1.72,
        bodyMat,
        0.04,
      );

      // Roof off-road light bar with 4 round rally pods
      const lightBar = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.68, 8), darkTrimMat);
      lightBar.rotation.x = Math.PI / 2;
      lightBar.position.set(0.36, 2.28, 0);
      this.body.add(lightBar);
      for (let s = -3; s <= 3; s += 2) {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 8), lightMat);
        pod.rotation.z = Math.PI / 2;
        pod.position.set(0.4, 2.34, s * 0.22);
        this.body.add(pod);
      }

      // Exposed rear engine block, intake filter cylinder & twin swept megaphone exhausts
      const engineCore = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 0.78, 8), chromeMat);
      engineCore.rotation.z = Math.PI / 2;
      engineCore.position.set(-1.52, 1.24, 0);
      this.body.add(engineCore);
      const airFilter = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.36, 8), darkTrimMat);
      airFilter.position.set(-1.32, 1.62, 0);
      this.body.add(airFilter);

      for (const side of [-1, 1]) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.075, 0.88, 8), darkTrimMat);
        pipe.rotation.z = 0.62;
        pipe.position.set(-1.98, 1.54, side * 0.44);
        this.body.add(pipe);
      }

      // Massive chunky balloon buggy wheels
      for (const side of [-1, 1]) {
        this.addWheel(wheelRadius, wheelWidth, length * 0.29, side * (width / 2 + 0.06), true, palette.wheel, palette.stripe);
        this.addWheel(wheelRadius, wheelWidth, -length * 0.29, side * (width / 2 + 0.06), false, palette.wheel, palette.stripe);
      }

      // Round safari bug-eye headlights & round rear tail lights
      for (const side of [-1, 1]) {
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.22, 10), lightMat);
        head.rotation.z = Math.PI / 2;
        head.position.set(1.94, 1.18, side * 0.62);
        this.body.add(head);

        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.16, 8), tailMat);
        tail.rotation.z = Math.PI / 2;
        tail.position.set(-2.14, 1.04, side * 0.62);
        this.body.add(tail);
        this.brakeLights.push(tail);
      }

      this.addNumber(number, -0.08, 2.26, 0, '#15222a', 2.0);
      this.addFlames(-length / 2 - 0.16, 0);
    }
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

    const speed = Math.hypot(racer.vx, racer.vy);
    this.spin += (speed / 0.65) * dt;

    // Wheel rotation and front steering (turning matches steer direction)
    for (const wheel of this.wheels) {
      wheel.mesh.rotation.z = this.spin;
      if (wheel.front) {
        wheel.pivot.rotation.y = -racer.steer * 0.38;
      }
    }

    // Dynamic body roll in corners (stable, no vertical jitter)
    const steerAmount = racer.steer * Math.min(1.2, speed / 55);
    const targetRoll = -steerAmount * 0.12; // Roll around local Z axis
    const targetPitch = racer.nitroActive ? -0.05 : 0; // Squat on nitro
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, targetRoll, Math.min(1, dt * 10));
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, targetPitch, Math.min(1, dt * 8));

    // Collision impact response: chassis jolt and spark particles
    if (racer.impact > 0.16) {
      this.impactStrength = racer.impact;
      this.sparkDuration = THREE.MathUtils.lerp(0.14, 0.38, Math.min(1, racer.impact));
      this.sparkTimer = this.sparkDuration;
    }

    if (this.sparkTimer > 0) {
      this.sparkTimer -= dt;
      const progress = 1.0 - this.sparkTimer / this.sparkDuration;
      const jolt = Math.sin(this.sparkTimer * 45) * 0.12 * this.impactStrength;
      this.body.position.set(jolt, 0, jolt * 0.4);
      this.sparkGroup.position.set(0, 0.4, 0);

      // Scale spark count and burst dispersion according to collision force
      const activeCount = this.impactStrength < 0.32 ? 8 : this.impactStrength < 0.65 ? 16 : 24;
      const burstRadius = 0.7 + progress * (2.6 + this.impactStrength * 3.8);

      for (let i = 0; i < this.sparks.length; i += 1) {
        const item = this.sparks[i];
        if (i < activeCount) {
          item.mesh.visible = true;
          const dist = burstRadius * item.speed;
          const arc = Math.sin(progress * Math.PI) * (0.5 + this.impactStrength * 1.2) * item.vy;
          item.mesh.position.set(
            Math.cos(item.angle) * dist,
            0.2 + arc,
            Math.sin(item.angle) * dist,
          );
          const sparkScale = Math.max(0.08, (1.0 - progress) * (1.0 + this.impactStrength * 0.6));
          item.mesh.scale.setScalar(sparkScale);
        } else {
          item.mesh.visible = false;
        }
      }
    } else {
      this.body.position.set(0, 0, 0);
      for (const item of this.sparks) {
        item.mesh.visible = false;
      }
    }

    // Nitro flames & wind trails
    this.nitroPulse += dt * 26;
    for (const group of this.flameGroups) {
      group.visible = racer.nitroActive;
    }
    for (const flame of this.flames) {
      const scale = 0.85 + Math.sin(this.nitroPulse) * 0.28;
      flame.scale.set(scale, 0.95 + Math.sin(this.nitroPulse + 1.2) * 0.45, scale);
    }
    for (let i = 0; i < this.windTrails.length; i += 1) {
      const trail = this.windTrails[i];
      trail.visible = racer.nitroActive;
      if (racer.nitroActive) {
        const streakScale = 0.9 + Math.sin(this.nitroPulse + i * 1.5) * 0.35 + (speed / 200) * 0.4;
        trail.scale.set(streakScale, 1.0, 1.0);
        const mat = trail.material as THREE.MeshBasicMaterial;
        mat.opacity = 0.45 + Math.sin(this.nitroPulse * 1.4 + i) * 0.25;
      }
    }

    // Brake lights
    for (const tail of this.brakeLights) {
      (tail.material as THREE.MeshBasicMaterial).color.setHex(
        speed < 8 || racer.drifting ? 0xff5030 : 0xa02518,
      );
    }

    // Drift tire smoke & offroad dirt dust
    if ((offroad && speed > 18) || (racer.drifting && speed > 35)) {
      const puff = this.smokePuffs.find((p) => p.life <= 0);
      if (puff) {
        puff.life = puff.maxLife;
        const side = Math.random() > 0.5 ? 1.25 : -1.25;
        puff.mesh.position.set(-1.05, 0.22, side);
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

  setAttractVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
