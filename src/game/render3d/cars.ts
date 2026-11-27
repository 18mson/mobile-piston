import * as THREE from 'three';
import type { CarId, CarPalette, RacerState } from '../types';
import { ROAD_Y, toSceneX, toSceneZ } from './constants';
import { createHoodVinylTexture, createNumberTexture, createSideVinylTexture } from './textures';

interface WheelRef {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  front: boolean;
}

interface LoftStation {
  x: number;
  yBot: number;
  yTop: number;
  wBot: number;
  wMid: number;
  wTop: number;
  crown?: number;
}

let sharedToonRamp: THREE.DataTexture | null = null;
function getToonRamp(): THREE.DataTexture {
  if (sharedToonRamp) return sharedToonRamp;
  // 3 crisp cel-shading bands: shadow, midtone, bright top highlight
  const data = new Uint8Array([
    115, 115, 115, 255,
    200, 200, 200, 255,
    255, 255, 255, 255,
  ]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  sharedToonRamp = tex;
  return tex;
}

const OUTLINE_COLOR = '#161c24';

export class CarView {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly interior = new THREE.Group();
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
  private hulls: LoftStation[][] = [];
  private openWheel = false;
  private wellMat: THREE.Material = new THREE.MeshToonMaterial({ color: '#262c34', gradientMap: getToonRamp() });
  private lipMat: THREE.Material = new THREE.MeshToonMaterial({ color: '#c83228', gradientMap: getToonRamp() });
  private rearLipMat: THREE.Material | null = null;
  private outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });

  constructor(carId: CarId, palette: CarPalette, number: number, isPlayer: boolean) {
    this.carId = carId;
    this.group.add(this.body);

    // Sleek automotive proportion so curves read like pixel-art 3D from all 360 angles
    this.body.scale.set(1.0, 1.14, 1.0);

    this.openWheel = carId === 'francesco';
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
      marker.position.y = 4.4;
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

  private material(hex: string, transparent = false, opacity = 1): THREE.MeshToonMaterial {
    return new THREE.MeshToonMaterial({
      color: hex,
      gradientMap: getToonRamp(),
      transparent,
      opacity,
    });
  }

  private addOutline(mesh: THREE.Mesh, thickness = 0.065): void {
    const src = mesh.geometry;
    if (!src.attributes.normal) src.computeVertexNormals();
    const outGeo = src.clone();
    const pos = outGeo.attributes.position;
    const norm = outGeo.attributes.normal;
    if (pos && norm) {
      for (let i = 0; i < pos.count; i += 1) {
        pos.setXYZ(
          i,
          pos.getX(i) + norm.getX(i) * thickness,
          pos.getY(i) + norm.getY(i) * thickness,
          pos.getZ(i) + norm.getZ(i) * thickness,
        );
      }
      pos.needsUpdate = true;
    }
    const outline = new THREE.Mesh(outGeo, this.outlineMat);
    mesh.add(outline);
  }

  /**
   * Builds a sculpted 3D lofted mesh from longitudinal stations (+X nose to -X tail)
   * with compound curves (tapered nose/tail, crowned hood, tumblehome cabin) and crisp pixel outline.
   */
  private addLoft(
    stations: LoftStation[],
    material: THREE.Material,
    outlineThickness = 0.065,
    cast = true,
  ): THREE.Mesh {
    // Remember lower-body lofts so wheel wells can follow the real fender surface
    if (stations.length >= 2 && stations[0].yBot <= 0.62) this.hulls.push(stations);

    const ringSize = 8;
    const positions: number[] = [];
    const indices: number[] = [];

    for (const s of stations) {
      const yMid = s.yBot + (s.yTop - s.yBot) * 0.56;
      const crown = s.crown ?? 0.08;
      const ring: [number, number, number][] = [
        [s.x, s.yTop + crown, 0],
        [s.x, s.yTop, -s.wTop],
        [s.x, yMid, -s.wMid],
        [s.x, s.yBot, -s.wBot],
        [s.x, s.yBot, 0],
        [s.x, s.yBot, s.wBot],
        [s.x, yMid, s.wMid],
        [s.x, s.yTop, s.wTop],
      ];
      for (const [px, py, pz] of ring) {
        positions.push(px, py, pz);
      }
    }

    for (let i = 0; i < stations.length - 1; i += 1) {
      const r0 = i * ringSize;
      const r1 = (i + 1) * ringSize;
      for (let j = 0; j < ringSize; j += 1) {
        const jNext = (j + 1) % ringSize;
        const a = r0 + j;
        const b = r0 + jNext;
        const c = r1 + j;
        const d = r1 + jNext;
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    // Front cap (+X normal)
    const f = stations[0];
    const fCenterIdx = positions.length / 3;
    positions.push(f.x, (f.yBot + f.yTop) * 0.5, 0);
    for (let j = 0; j < ringSize; j += 1) {
      const jNext = (j + 1) % ringSize;
      indices.push(fCenterIdx, j, jNext);
    }

    // Rear cap (-X normal)
    const l = stations[stations.length - 1];
    const lBase = (stations.length - 1) * ringSize;
    const lCenterIdx = positions.length / 3;
    positions.push(l.x, (l.yBot + l.yTop) * 0.5, 0);
    for (let j = 0; j < ringSize; j += 1) {
      const jNext = (j + 1) % ringSize;
      indices.push(lCenterIdx, lBase + jNext, lBase + j);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    if (outlineThickness > 0) {
      this.addOutline(mesh, outlineThickness);
    }
    return mesh;
  }

  private addDropShadow(carId: CarId): void {
    const dims: Record<CarId, [number, number]> = {
      mcqueen: [5.7, 3.8],
      luigi: [4.3, 3.1],
      guido: [3.9, 3.0],
      sally: [5.3, 3.6],
      chick: [6.0, 3.9],
      mater: [6.2, 4.1],
      doc: [6.2, 3.9],
      cruz: [5.5, 3.7],
      francesco: [5.8, 3.9],
      storm: [5.8, 3.9],
    };
    const [l, w] = dims[carId];
    const geo = new THREE.PlaneGeometry(l, w);
    const mat = new THREE.MeshBasicMaterial({
      color: '#081217',
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    const shadow = new THREE.Mesh(geo, mat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.04;
    this.group.add(shadow);
    this.dropShadow = shadow;
  }

  private addBox(
    size: [number, number, number],
    pos: [number, number, number],
    material: THREE.Material,
    cast = true,
    receive = true,
    outline = 0,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...pos);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    this.body.add(mesh);
    if (outline > 0) this.addOutline(mesh, outline);
    return mesh;
  }

  private addProfile(
    points: [number, number][],
    width: number,
    material: THREE.Material,
    bevel = 0.08,
    cast = true,
    outline = 0.055,
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
      bevelSegments: 3,
      curveSegments: 8,
    });
    geo.translate(0, 0, -width / 2);

    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    if (outline > 0) this.addOutline(mesh, outline);
    return mesh;
  }

  private addTube(
    a: [number, number, number],
    b: [number, number, number],
    radius: number,
    material: THREE.Material,
    cast = true,
  ): THREE.Mesh {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const dir = vb.clone().sub(va);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 12), material);
    mesh.position.copy(va).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    mesh.castShadow = cast;
    this.body.add(mesh);
    return mesh;
  }

  /** Body surface at longitudinal position x: fender top height + max half-width, from the lower-body lofts. */
  private hullAt(x: number): { yBot: number; yTop: number; wBot: number; wMid: number; wTop: number } | null {
    let best: { yBot: number; yTop: number; wBot: number; wMid: number; wTop: number } | null = null;
    for (const st of this.hulls) {
      for (let i = 0; i < st.length - 1; i += 1) {
        const a = st[i];
        const b = st[i + 1];
        const hi = Math.max(a.x, b.x);
        const lo = Math.min(a.x, b.x);
        if (x > hi || x < lo) continue;
        const t = (x - a.x) / (b.x - a.x || 1);
        const lerp = (u: number, v: number) => u + (v - u) * t;
        const cur = {
          yBot: lerp(a.yBot, b.yBot),
          yTop: lerp(a.yTop, b.yTop),
          wBot: lerp(a.wBot, b.wBot),
          wMid: lerp(a.wMid, b.wMid),
          wTop: lerp(a.wTop, b.wTop),
        };
        if (!best || cur.wMid > best.wMid) best = cur;
      }
    }
    return best;
  }

  private hullXRange(): [number, number] {
    let lo = Infinity;
    let hi = -Infinity;
    for (const st of this.hulls) {
      for (const s of st) {
        lo = Math.min(lo, s.x);
        hi = Math.max(hi, s.x);
      }
    }
    return [lo, hi];
  }

  /**
   * Carves a dark wheel arch into the body side: a black wedge (clipped to the body's
   * underside / fender top) plus a raised fender lip, so the tyre sits inside the bodywork.
   */
  private addWheelWell(
    x: number,
    cy: number,
    rw: number,
    wallZ: number,
    sgn: number,
    yBotG: number,
    yTopG: number,
    front: boolean,
  ): void {
    const ySc = this.body.scale.y;
    const dLow = THREE.MathUtils.clamp(yBotG - cy, -rw * 0.98, rw * 0.98);
    const dHigh = THREE.MathUtils.clamp(yTopG - 0.03 - cy, dLow + 0.2, rw);
    const aL = Math.asin(dLow / rw);
    const aH = Math.asin(Math.min(1, dHigh / rw));

    const shape = new THREE.Shape();
    shape.moveTo(rw * Math.cos(aL), rw * Math.sin(aL));
    shape.absarc(0, 0, rw, aL, aH, false);
    shape.lineTo(rw * Math.cos(Math.PI - aH), rw * Math.sin(Math.PI - aH));
    shape.absarc(0, 0, rw, Math.PI - aH, Math.PI - aL, false);
    shape.closePath();

    const depth = 0.75;
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
    geo.translate(0, 0, -depth);
    geo.scale(1, 1 / ySc, 1);
    const well = new THREE.Mesh(geo, this.wellMat);
    well.position.set(x, cy / ySc, sgn * wallZ);
    if (sgn < 0) well.rotation.y = Math.PI;
    this.body.add(well);

    // Body-colored fender lip around the arch (matching Cars film silhouettes)
    const lipMat = !front && this.rearLipMat ? this.rearLipMat : this.lipMat;
    const lipR = rw + 0.02;
    const addLip = (from: number, to: number): void => {
      if (to - from < 0.05) return;
      const lip = new THREE.Mesh(new THREE.TorusGeometry(lipR, 0.05, 6, 18, to - from), lipMat);
      lip.geometry.scale(1, 1 / ySc, 1);
      lip.rotation.z = from;
      lip.position.set(x, cy / ySc, sgn * (wallZ + 0.01));
      this.body.add(lip);
    };
    if (aH > Math.PI / 2 - 0.02) {
      addLip(aL, Math.PI - aL);
    } else {
      addLip(aL, aH);
      addLip(Math.PI - aH, Math.PI - aL);
    }
  }

  private addWheel(
    radius: number,
    width: number,
    x: number,
    z: number,
    front: boolean,
    tireColor: string,
    rimColor: string,
    whitewall = false,
  ): void {
    const ySc = this.body.scale.y;
    let r = radius;
    let wx = x;
    let wz = z;
    let well: { cy: number; rw: number; wallZ: number; sgn: number; yBotG: number; yTopG: number } | null = null;

    if (!this.openWheel && this.hulls.length > 0) {
      // Push the axles slightly toward the corners (sportier stance like the reference), keep inside the body
      const [lo, hi] = this.hullXRange();
      wx = x * 1.1;
      const margin = radius * 0.8 + 0.2;
      wx = THREE.MathUtils.clamp(wx, lo + margin, hi - margin);

      const hull = this.hullAt(wx);
      if (hull) {
        const wellK = 1.24;
        const topG = hull.yTop * ySc;
        const targetR = radius * 0.84;
        // Shrink the tyre if the arch would not fit under the fender top
        const maxR = (topG - 0.14) / (0.95 + wellK);
        r = Math.max(targetR * 0.76, Math.min(targetR, maxR));
        const cy = r * 0.95;
        const wall = Math.max(hull.wMid, hull.wBot);
        const sgn = z >= 0 ? 1 : -1;
        wz = sgn * (wall + 0.1 - width / 2);
        well = {
          cy,
          rw: r * wellK,
          wallZ: wall + 0.03,
          sgn,
          yBotG: hull.yBot * ySc,
          yTopG: topG,
        };
      }
    }

    const pivot = new THREE.Group();
    pivot.position.set(wx, r * 0.95, wz);

    const tireGeo = new THREE.CylinderGeometry(r, r, width, 24);
    tireGeo.rotateX(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, this.material(tireColor));
    tire.castShadow = true;
    this.addOutline(tire, 0.05);
    pivot.add(tire);

    if (whitewall) {
      const wallGeo = new THREE.CylinderGeometry(r * 0.78, r * 0.78, width + 0.03, 20);
      wallGeo.rotateX(Math.PI / 2);
      const wall = new THREE.Mesh(wallGeo, this.material('#ece6d8'));
      tire.add(wall);
    }

    const rimRadius = r * 0.58;
    const rimWidth = width + 0.06;
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, rimWidth, 16);
    rimGeo.rotateX(Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, this.material(rimColor));
    rim.castShadow = true;
    tire.add(rim);

    const nutGeo = new THREE.CylinderGeometry(rimRadius * 0.34, rimRadius * 0.34, rimWidth + 0.04, 12);
    nutGeo.rotateX(Math.PI / 2);
    const nut = new THREE.Mesh(nutGeo, this.material('#3a4350'));
    tire.add(nut);

    this.group.add(pivot);
    this.wheels.push({ pivot, mesh: tire, front });

    if (well) {
      this.addWheelWell(wx, well.cy, well.rw, well.wallZ, well.sgn, well.yBotG, well.yTopG, front);
    }
  }

  private addSideMirrors(x: number, y: number, z: number, mat: THREE.Material): void {
    for (const side of [-1, 1]) {
      const mirror = this.addBox([0.18, 0.13, 0.22], [x, y, side * z], mat, true, true, 0.035);
      mirror.rotation.y = side * 0.25;
    }
  }

  private addRoofNumber(number: number, x: number, y: number, z: number, color: string): void {
    const map = createNumberTexture(number, color);
    const material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), material);
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(x, y, z);
    this.body.add(roof);
  }

  private addSideVinyls(
    carId: CarId,
    palette: CarPalette,
    number: number,
    xCenter: number,
    yCenter: number,
    zHalfWidth: number,
    panelLength: number,
    panelHeight: number,
  ): void {
    const tex = createSideVinylTexture(carId, palette.stripe, palette.highlight, number);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    for (const side of [-1, 1]) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(panelLength, panelHeight), mat);
      plane.rotation.y = side > 0 ? 0 : Math.PI;
      plane.position.set(xCenter, yCenter, side * zHalfWidth);
      this.body.add(plane);
    }
  }

  private addHoodVinyl(
    carId: CarId,
    palette: CarPalette,
    x: number,
    y: number,
    length: number,
    width: number,
    tiltZ = 0,
  ): void {
    const tex = createHoodVinylTexture(carId, palette.stripe, palette.highlight);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(length, width), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = tiltZ;
    plane.position.set(x, y, 0);
    this.body.add(plane);
  }

  private addFlames(x: number, z: number): void {
    for (const side of [-1, 1]) {
      const flameGroup = new THREE.Group();
      flameGroup.position.set(x, 0.72, z + side * 0.48);

      const coreFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 1.8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffe066', transparent: true, opacity: 0.95 }),
      );
      coreFlame.rotation.z = Math.PI / 2;
      flameGroup.add(coreFlame);

      const outerFlame = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 1.3, 8),
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

  private build(carId: CarId, palette: CarPalette, number: number): void {
    const bodyMat = this.material(palette.body);
    const shadeMat = this.material(palette.shade);
    const wellColor = new THREE.Color(palette.wheel).lerp(new THREE.Color('#14181f'), 0.28);
    this.wellMat = new THREE.MeshToonMaterial({ color: wellColor, gradientMap: getToonRamp() });
    this.lipMat = bodyMat;
    this.rearLipMat = carId === 'mater' ? shadeMat : null;
    const highlightMat = this.material(palette.highlight);
    const glassMat = this.material(palette.glass);
    const stripeMat = this.material(palette.stripe);
    const chromeMat = this.material('#e8ecf0');
    const darkTrimMat = this.material('#2e3742');
    const lightMat = new THREE.MeshBasicMaterial({ color: '#fff5b8' });
    const tailMat = new THREE.MeshBasicMaterial({ color: '#ff3a2b' });

    if (carId === 'mcqueen') {
      // LIGHTNING MCQUEEN (#95): Sculpted curved NASCAR/Le Mans body, tapered nose, crowned hood, lightning door vinyl
      const length = 5.5;
      const width = 3.45;

      // Sculpted lower chin splitter
      this.addLoft(
        [
          { x: 2.86, yBot: 0.32, yTop: 0.44, wBot: 1.18, wMid: 1.24, wTop: 1.2, crown: 0.02 },
          { x: 2.4, yBot: 0.34, yTop: 0.48, wBot: 1.44, wMid: 1.5, wTop: 1.46, crown: 0.02 },
          { x: -2.65, yBot: 0.34, yTop: 0.48, wBot: 1.44, wMid: 1.5, wTop: 1.46, crown: 0.02 },
        ],
        darkTrimMat,
        0.04,
      );

      // Curved sculpted body with tapered nose, flared fenders & muscular rear haunches
      this.addLoft(
        [
          { x: 2.82, yBot: 0.44, yTop: 0.78, wBot: 1.18, wMid: 1.26, wTop: 1.12, crown: 0.08 },
          { x: 2.46, yBot: 0.44, yTop: 0.98, wBot: 1.46, wMid: 1.6, wTop: 1.42, crown: 0.1 },
          { x: 1.15, yBot: 0.44, yTop: 1.14, wBot: 1.52, wMid: 1.66, wTop: 1.48, crown: 0.1 },
          { x: -1.15, yBot: 0.44, yTop: 1.18, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.1 },
          { x: -2.35, yBot: 0.46, yTop: 1.24, wBot: 1.48, wMid: 1.62, wTop: 1.44, crown: 0.09 },
          { x: -2.74, yBot: 0.5, yTop: 1.04, wBot: 1.28, wMid: 1.38, wTop: 1.24, crown: 0.06 },
        ],
        bodyMat,
        0.075,
      );

      // Tapered fastback greenhouse (tumblehome inward slope on all 4 sides)
      this.addLoft(
        [
          { x: 1.08, yBot: 1.12, yTop: 1.22, wBot: 1.36, wMid: 1.3, wTop: 1.2, crown: 0.04 },
          { x: 0.24, yBot: 1.14, yTop: 1.72, wBot: 1.34, wMid: 1.18, wTop: 1.02, crown: 0.08 },
          { x: -0.96, yBot: 1.16, yTop: 1.72, wBot: 1.34, wMid: 1.18, wTop: 1.02, crown: 0.08 },
          { x: -2.04, yBot: 1.18, yTop: 1.26, wBot: 1.34, wMid: 1.26, wTop: 1.16, crown: 0.04 },
        ],
        glassMat,
        0.055,
      );

      // Curved roof cap
      this.addLoft(
        [
          { x: 0.3, yBot: 1.69, yTop: 1.81, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.06 },
          { x: -0.35, yBot: 1.7, yTop: 1.84, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.06 },
          { x: -1.02, yBot: 1.69, yTop: 1.8, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.06 },
        ],
        bodyMat,
        0.055,
      );

      // Swept NASCAR rear spoiler
      this.addProfile(
        [
          [-2.35, 1.22],
          [-2.78, 1.56],
          [-2.86, 1.46],
          [-2.52, 1.16],
        ],
        2.68,
        bodyMat,
        0.04,
        true,
        0.05,
      );

      this.addSideMirrors(0.7, 1.22, 1.44, bodyMat);
      this.addSideVinyls('mcqueen', palette, number, -0.05, 0.86, 1.68, 2.2, 0.68);
      this.addHoodVinyl('mcqueen', palette, 1.82, 1.21, 1.35, 1.45, 0);
      this.addRoofNumber(number, -0.38, 1.92, 0, '#f7c933');

      // Front grille, proud headlights & taillights
      this.addBox([0.1, 0.22, 1.42], [2.85, 0.58, 0], darkTrimMat, false, false, 0.03);
      for (const side of [-1, 1]) {
        const head = this.addBox([0.14, 0.18, 0.5], [2.78, 0.82, side * 0.94], lightMat, false, false, 0.03);
        head.rotation.y = -side * 0.22;
        head.rotation.z = -0.25;
        const tail = this.addBox([0.12, 0.18, 0.54], [-2.76, 0.92, side * 0.9], tailMat, false, false, 0.03);
        this.brakeLights.push(tail);
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 12), chromeMat);
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(-0.55, 0.42, side * 1.62);
        this.body.add(pipe);
      }

      for (const side of [-1, 1]) {
        this.addWheel(0.62, 0.44, length * 0.29, side * (width / 2 - 0.3), true, palette.wheel, palette.body);
        this.addWheel(0.65, 0.48, -length * 0.29, side * (width / 2 - 0.3), false, palette.wheel, palette.body);
      }
      this.addFlames(-length / 2 - 0.24, 0);

    } else if (carId === 'luigi') {
      // LUIGI: Rounded 1959 Fiat 500 dome/bubble body with tapered nose, canvas sunroof & chrome bumpers
      const length = 4.1;
      const width = 2.85;

      this.addTube([2.16, 0.52, -0.95], [2.16, 0.52, 0.95], 0.07, chromeMat);
      this.addTube([-2.12, 0.52, -0.95], [-2.12, 0.52, 0.95], 0.07, chromeMat);

      this.addLoft(
        [
          { x: 2.08, yBot: 0.44, yTop: 0.84, wBot: 0.98, wMid: 1.08, wTop: 0.94, crown: 0.1 },
          { x: 1.65, yBot: 0.44, yTop: 1.1, wBot: 1.2, wMid: 1.32, wTop: 1.18, crown: 0.1 },
          { x: 0.85, yBot: 0.44, yTop: 1.24, wBot: 1.24, wMid: 1.36, wTop: 1.24, crown: 0.08 },
          { x: -1.45, yBot: 0.44, yTop: 1.24, wBot: 1.24, wMid: 1.36, wTop: 1.24, crown: 0.08 },
          { x: -2.05, yBot: 0.48, yTop: 0.98, wBot: 1.04, wMid: 1.14, wTop: 1.0, crown: 0.08 },
        ],
        bodyMat,
        0.07,
      );

      this.addLoft(
        [
          { x: 0.92, yBot: 1.22, yTop: 1.32, wBot: 1.12, wMid: 1.06, wTop: 0.98, crown: 0.04 },
          { x: 0.4, yBot: 1.22, yTop: 1.84, wBot: 1.1, wMid: 0.98, wTop: 0.88, crown: 0.08 },
          { x: -1.04, yBot: 1.22, yTop: 1.84, wBot: 1.1, wMid: 0.98, wTop: 0.88, crown: 0.08 },
          { x: -1.68, yBot: 1.22, yTop: 1.32, wBot: 1.1, wMid: 1.04, wTop: 0.96, crown: 0.04 },
        ],
        glassMat,
        0.055,
      );

      this.addLoft(
        [
          { x: 0.46, yBot: 1.82, yTop: 1.94, wBot: 0.9, wMid: 0.86, wTop: 0.8, crown: 0.06 },
          { x: -0.35, yBot: 1.82, yTop: 1.96, wBot: 0.9, wMid: 0.86, wTop: 0.8, crown: 0.06 },
          { x: -1.1, yBot: 1.82, yTop: 1.93, wBot: 0.9, wMid: 0.86, wTop: 0.8, crown: 0.06 },
        ],
        bodyMat,
        0.05,
      );
      this.addBox([1.0, 0.06, 1.2], [-0.34, 2.01, 0], stripeMat, true, true, 0.025);
      this.addSideMirrors(0.74, 1.26, 1.22, chromeMat);
      this.addSideVinyls('luigi', palette, number, -0.05, 0.88, 1.39, 1.65, 0.6);
      this.addRoofNumber(number, -0.34, 2.08, 0, '#15222a');

      this.addBox([0.1, 0.14, 0.7], [2.1, 0.92, 0], chromeMat, false, false, 0.025);
      for (const side of [-1, 1]) {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.18, 16), lightMat);
        lamp.rotation.z = Math.PI / 2;
        lamp.position.set(2.04, 0.94, side * 0.78);
        this.addOutline(lamp, 0.035);
        this.body.add(lamp);
        const tail = this.addBox([0.12, 0.22, 0.24], [-2.08, 0.9, side * 0.8], tailMat, false, false, 0.025);
        this.brakeLights.push(tail);
      }

      for (const side of [-1, 1]) {
        this.addWheel(0.46, 0.32, length * 0.31, side * (width / 2 - 0.26), true, palette.wheel, '#ece6d8', true);
        this.addWheel(0.48, 0.34, -length * 0.31, side * (width / 2 - 0.26), false, palette.wheel, '#ece6d8', true);
      }
      this.addFlames(-length / 2 - 0.2, 0);

    } else if (carId === 'guido') {
      // GUIDO: Compact rounded forklift cab, twin vertical mast & front steel fork tines
      const length = 3.7;
      const width = 2.7;

      this.addLoft(
        [
          { x: 1.56, yBot: 0.42, yTop: 0.86, wBot: 0.88, wMid: 0.96, wTop: 0.86, crown: 0.06 },
          { x: 0.9, yBot: 0.42, yTop: 1.02, wBot: 1.06, wMid: 1.14, wTop: 1.04, crown: 0.06 },
          { x: -1.35, yBot: 0.42, yTop: 1.08, wBot: 1.08, wMid: 1.16, wTop: 1.06, crown: 0.06 },
          { x: -1.84, yBot: 0.46, yTop: 0.98, wBot: 0.94, wMid: 1.02, wTop: 0.92, crown: 0.05 },
        ],
        bodyMat,
        0.07,
      );

      this.addLoft(
        [
          { x: 1.06, yBot: 0.98, yTop: 1.12, wBot: 0.92, wMid: 0.88, wTop: 0.82, crown: 0.03 },
          { x: 0.62, yBot: 1.0, yTop: 1.68, wBot: 0.92, wMid: 0.84, wTop: 0.76, crown: 0.06 },
          { x: -0.76, yBot: 1.0, yTop: 1.68, wBot: 0.92, wMid: 0.84, wTop: 0.76, crown: 0.06 },
          { x: -1.16, yBot: 1.02, yTop: 1.14, wBot: 0.92, wMid: 0.88, wTop: 0.82, crown: 0.03 },
        ],
        glassMat,
        0.05,
      );

      this.addLoft(
        [
          { x: 0.66, yBot: 1.66, yTop: 1.78, wBot: 0.78, wMid: 0.74, wTop: 0.68, crown: 0.05 },
          { x: -0.8, yBot: 1.66, yTop: 1.78, wBot: 0.78, wMid: 0.74, wTop: 0.68, crown: 0.05 },
        ],
        stripeMat,
        0.045,
      );

      this.addSideVinyls('guido', palette, number, -0.15, 0.82, 1.19, 1.45, 0.54);
      this.addRoofNumber(number, -0.1, 1.85, 0, '#15222a');

      for (const side of [-1, 1]) {
        this.addTube([1.68, 0.46, side * 0.54], [1.64, 1.62, side * 0.54], 0.07, darkTrimMat);
        this.addBox([0.74, 0.07, 0.16], [2.02, 0.46, side * 0.44], chromeMat, true, true, 0.025);
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 14), lightMat);
        lamp.rotation.z = Math.PI / 2;
        lamp.position.set(1.62, 0.86, side * 0.74);
        this.addOutline(lamp, 0.03);
        this.body.add(lamp);
        const tail = this.addBox([0.12, 0.22, 0.24], [-1.88, 0.9, side * 0.7], tailMat, false, false, 0.025);
        this.brakeLights.push(tail);
      }
      this.addBox([0.1, 0.12, 1.16], [1.66, 1.54, 0], darkTrimMat, true, true, 0.025);
      this.addBox([0.1, 0.16, 1.16], [1.7, 0.62, 0], darkTrimMat, true, true, 0.025);

      for (const side of [-1, 1]) {
        this.addWheel(0.44, 0.34, 1.05, side * (width / 2 - 0.34), true, palette.wheel, '#d6dde4');
        this.addWheel(0.38, 0.3, -1.12, side * (width / 2 - 0.4), false, palette.wheel, '#d6dde4');
      }
      this.addFlames(-length / 2 - 0.2, 0);

    } else if (carId === 'sally') {
      // SALLY CARRERA: 2002 Porsche 911 (996) sloped nose, curved fastback roofline & Carrera wing
      const length = 5.15;
      const width = 3.3;

      this.addLoft(
        [
          { x: 2.66, yBot: 0.42, yTop: 0.76, wBot: 1.14, wMid: 1.24, wTop: 1.08, crown: 0.08 },
          { x: 2.22, yBot: 0.42, yTop: 0.98, wBot: 1.38, wMid: 1.52, wTop: 1.36, crown: 0.1 },
          { x: 1.02, yBot: 0.42, yTop: 1.14, wBot: 1.44, wMid: 1.56, wTop: 1.4, crown: 0.1 },
          { x: -1.2, yBot: 0.42, yTop: 1.2, wBot: 1.46, wMid: 1.6, wTop: 1.44, crown: 0.09 },
          { x: -2.26, yBot: 0.46, yTop: 1.24, wBot: 1.42, wMid: 1.54, wTop: 1.38, crown: 0.08 },
          { x: -2.6, yBot: 0.5, yTop: 0.98, wBot: 1.2, wMid: 1.3, wTop: 1.14, crown: 0.06 },
        ],
        bodyMat,
        0.075,
      );

      this.addLoft(
        [
          { x: 1.04, yBot: 1.14, yTop: 1.22, wBot: 1.28, wMid: 1.22, wTop: 1.14, crown: 0.04 },
          { x: 0.2, yBot: 1.14, yTop: 1.74, wBot: 1.26, wMid: 1.12, wTop: 0.96, crown: 0.08 },
          { x: -0.84, yBot: 1.16, yTop: 1.74, wBot: 1.26, wMid: 1.12, wTop: 0.96, crown: 0.08 },
          { x: -1.96, yBot: 1.2, yTop: 1.28, wBot: 1.26, wMid: 1.2, wTop: 1.12, crown: 0.04 },
        ],
        glassMat,
        0.055,
      );

      this.addLoft(
        [
          { x: 0.24, yBot: 1.72, yTop: 1.82, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.06 },
          { x: -0.3, yBot: 1.72, yTop: 1.86, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.06 },
          { x: -0.9, yBot: 1.72, yTop: 1.82, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.06 },
        ],
        bodyMat,
        0.05,
      );
      this.addSideMirrors(0.7, 1.2, 1.36, bodyMat);
      this.addSideVinyls('sally', palette, number, -0.05, 0.84, 1.6, 1.95, 0.62);
      this.addHoodVinyl('sally', palette, 1.7, 1.19, 1.3, 1.35);
      this.addRoofNumber(number, -0.3, 1.94, 0, '#15222a');

      this.addBox([0.42, 0.08, 2.24], [-2.38, 1.38, 0], stripeMat, true, true, 0.035);
      this.addBox([0.1, 0.18, 1.36], [2.68, 0.56, 0], darkTrimMat, false, false, 0.025);
      for (const side of [-1, 1]) {
        const head = this.addBox([0.34, 0.2, 0.44], [2.46, 0.88, side * 0.96], lightMat, false, false, 0.03);
        head.rotation.z = -0.26;
        head.rotation.y = -side * 0.24;
        const tail = this.addBox([0.14, 0.18, 0.58], [-2.62, 0.92, side * 0.9], tailMat, false, false, 0.03);
        this.brakeLights.push(tail);
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.36, 12), chromeMat);
        pipe.rotation.z = Math.PI / 2;
        pipe.position.set(-2.64, 0.46, side * 0.7);
        this.body.add(pipe);
      }

      for (const side of [-1, 1]) {
        this.addWheel(0.58, 0.4, length * 0.3, side * (width / 2 - 0.28), true, palette.wheel, '#d6dde4');
        this.addWheel(0.62, 0.46, -length * 0.29, side * (width / 2 - 0.28), false, palette.wheel, '#d6dde4');
      }
      this.addFlames(-length / 2 - 0.22, 0);

    } else if (carId === 'chick') {
      // CHICK HICKS (#86): 1980s NASCAR stock muscle with wide grille, quad headlamps & tall wing
      const length = 5.8;
      const width = 3.55;

      this.addLoft(
        [
          { x: 2.94, yBot: 0.44, yTop: 0.98, wBot: 1.34, wMid: 1.44, wTop: 1.32, crown: 0.06 },
          { x: 2.55, yBot: 0.44, yTop: 1.12, wBot: 1.54, wMid: 1.66, wTop: 1.52, crown: 0.07 },
          { x: 1.1, yBot: 0.44, yTop: 1.22, wBot: 1.56, wMid: 1.68, wTop: 1.54, crown: 0.07 },
          { x: -1.3, yBot: 0.44, yTop: 1.24, wBot: 1.56, wMid: 1.68, wTop: 1.54, crown: 0.07 },
          { x: -2.65, yBot: 0.48, yTop: 1.24, wBot: 1.52, wMid: 1.62, wTop: 1.48, crown: 0.06 },
          { x: -2.96, yBot: 0.52, yTop: 1.06, wBot: 1.36, wMid: 1.44, wTop: 1.3, crown: 0.04 },
        ],
        bodyMat,
        0.075,
      );

      this.addLoft(
        [
          { x: 1.04, yBot: 1.2, yTop: 1.3, wBot: 1.38, wMid: 1.32, wTop: 1.24, crown: 0.04 },
          { x: 0.36, yBot: 1.2, yTop: 1.8, wBot: 1.38, wMid: 1.24, wTop: 1.1, crown: 0.06 },
          { x: -1.06, yBot: 1.22, yTop: 1.8, wBot: 1.38, wMid: 1.24, wTop: 1.1, crown: 0.06 },
          { x: -1.8, yBot: 1.22, yTop: 1.3, wBot: 1.38, wMid: 1.32, wTop: 1.24, crown: 0.04 },
        ],
        glassMat,
        0.055,
      );

      this.addLoft(
        [
          { x: 0.42, yBot: 1.78, yTop: 1.88, wBot: 1.12, wMid: 1.08, wTop: 1.0, crown: 0.05 },
          { x: -1.12, yBot: 1.78, yTop: 1.88, wBot: 1.12, wMid: 1.08, wTop: 1.0, crown: 0.05 },
        ],
        bodyMat,
        0.05,
      );
      this.addSideMirrors(0.74, 1.26, 1.48, bodyMat);
      this.addSideVinyls('chick', palette, number, -0.05, 0.88, 1.7, 2.3, 0.68);
      this.addHoodVinyl('chick', palette, 1.94, 1.28, 1.45, 1.5);
      this.addRoofNumber(number, -0.32, 1.95, 0, '#15222a');

      this.addBox([0.12, 0.26, 1.7], [2.98, 0.78, 0], darkTrimMat, false, false, 0.03);
      this.addBox([0.08, 0.07, 1.62], [3.02, 0.78, 0], chromeMat, false);
      this.addBox([0.46, 0.1, 2.84], [-2.74, 1.58, 0], stripeMat, true, true, 0.035);
      for (const side of [-1, 1]) {
        this.addBox([0.24, 0.34, 0.1], [-2.7, 1.38, side * 1.1], shadeMat, true, true, 0.025);
        this.addBox([0.14, 0.2, 0.44], [2.96, 0.84, side * 1.08], lightMat, false, false, 0.025);
        const tail = this.addBox([0.14, 0.22, 0.58], [-2.98, 0.94, side * 1.0], tailMat, false, false, 0.025);
        this.brakeLights.push(tail);
      }

      for (const side of [-1, 1]) {
        this.addWheel(0.62, 0.44, length * 0.29, side * (width / 2 - 0.32), true, palette.wheel, palette.stripe);
        this.addWheel(0.65, 0.48, -length * 0.29, side * (width / 2 - 0.34), false, palette.wheel, palette.stripe);
      }
      this.addFlames(-length / 2 - 0.22, 0);

    } else if (carId === 'mater') {
      // TOW MATER: 1951 International Harvester L-170 rounded cab, open V8 bay, flatbed & rear tow boom + hook
      const length = 5.9;
      const width = 3.65;

      this.addBox([0.34, 0.2, 2.86], [2.92, 0.54, 0], chromeMat, true, true, 0.035);

      // Rounded 1951 pickup front hood & cab lower body
      this.addLoft(
        [
          { x: 2.84, yBot: 0.52, yTop: 1.12, wBot: 1.24, wMid: 1.36, wTop: 1.18, crown: 0.12 },
          { x: 2.2, yBot: 0.52, yTop: 1.32, wBot: 1.48, wMid: 1.62, wTop: 1.42, crown: 0.12 },
          { x: 1.15, yBot: 0.52, yTop: 1.42, wBot: 1.54, wMid: 1.66, wTop: 1.5, crown: 0.1 },
          { x: -0.58, yBot: 0.52, yTop: 1.42, wBot: 1.54, wMid: 1.66, wTop: 1.5, crown: 0.08 },
        ],
        bodyMat,
        0.075,
      );

      // Flatbed rear deck
      this.addLoft(
        [
          { x: -0.52, yBot: 0.54, yTop: 1.06, wBot: 1.54, wMid: 1.64, wTop: 1.58, crown: 0.04 },
          { x: -2.92, yBot: 0.58, yTop: 1.06, wBot: 1.5, wMid: 1.6, wTop: 1.54, crown: 0.04 },
        ],
        shadeMat,
        0.065,
      );

      // Exposed V8 engine bay on hood
      this.addBox([1.05, 0.22, 1.05], [1.85, 1.46, 0], darkTrimMat, true, true, 0.03);
      const airCleaner = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16), chromeMat);
      airCleaner.position.set(1.88, 1.68, 0);
      this.addOutline(airCleaner, 0.035);
      this.body.add(airCleaner);

      // Upright 50s truck cab glass & roof
      this.addLoft(
        [
          { x: 1.12, yBot: 1.4, yTop: 1.52, wBot: 1.36, wMid: 1.3, wTop: 1.24, crown: 0.04 },
          { x: 0.62, yBot: 1.4, yTop: 2.08, wBot: 1.36, wMid: 1.26, wTop: 1.16, crown: 0.07 },
          { x: -0.44, yBot: 1.4, yTop: 2.08, wBot: 1.36, wMid: 1.26, wTop: 1.16, crown: 0.07 },
          { x: -0.6, yBot: 1.4, yTop: 1.52, wBot: 1.36, wMid: 1.3, wTop: 1.24, crown: 0.04 },
        ],
        glassMat,
        0.055,
      );
      this.addLoft(
        [
          { x: 0.68, yBot: 2.06, yTop: 2.18, wBot: 1.18, wMid: 1.14, wTop: 1.08, crown: 0.07 },
          { x: -0.5, yBot: 2.06, yTop: 2.18, wBot: 1.18, wMid: 1.14, wTop: 1.08, crown: 0.07 },
        ],
        bodyMat,
        0.055,
      );

      this.addSideVinyls('mater', palette, number, 0.3, 1.0, 1.68, 1.45, 0.58);
      this.addRoofNumber(number, 0.08, 2.27, 0, '#f2e6cf');

      for (const side of [-1, 1]) {
        this.addTube([-0.92, 1.06, side * 0.92], [-2.55, 2.12, 0], 0.095, darkTrimMat);
        this.addTube([-2.38, 1.06, side * 0.85], [-2.55, 2.12, 0], 0.08, darkTrimMat);
        this.addBox([0.2, 0.26, 0.12], [0.85, 1.72, side * 1.54], chromeMat, true, true, 0.03);
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.2, 16), lightMat);
        lamp.rotation.z = Math.PI / 2;
        lamp.position.set(2.86, 1.02, side * 1.04);
        this.addOutline(lamp, 0.035);
        this.body.add(lamp);
        const tail = this.addBox([0.14, 0.22, 0.42], [-2.96, 0.84, side * 1.08], tailMat, false, false, 0.025);
        this.brakeLights.push(tail);
      }
      this.addTube([-2.55, 2.12, 0], [-2.78, 1.44, 0], 0.055, chromeMat);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 14), chromeMat);
      hook.position.set(-2.78, 1.32, 0);
      this.body.add(hook);
      this.addTube([-0.68, 1.08, -1.24], [-0.68, 2.38, -1.24], 0.09, chromeMat);

      for (const side of [-1, 1]) {
        this.addWheel(0.66, 0.46, length * 0.3, side * (width / 2 - 0.38), true, palette.wheel, palette.stripe);
        this.addWheel(0.78, 0.62, -length * 0.29, side * (width / 2 - 0.22), false, palette.wheel, palette.stripe);
      }
      this.addFlames(-length / 2 - 0.22, 0);

    } else if (carId === 'doc') {
      // DOC HUDSON (#51): 1951 Hudson Hornet low-slung curved fastback with chrome bar grille & whitewalls
      const length = 5.95;
      const width = 3.52;

      this.addBox([0.34, 0.18, 2.86], [3.08, 0.52, 0], chromeMat, true, true, 0.035);

      this.addLoft(
        [
          { x: 3.0, yBot: 0.48, yTop: 0.96, wBot: 1.24, wMid: 1.36, wTop: 1.2, crown: 0.1 },
          { x: 2.52, yBot: 0.48, yTop: 1.18, wBot: 1.5, wMid: 1.64, wTop: 1.46, crown: 0.11 },
          { x: 1.18, yBot: 0.48, yTop: 1.3, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.1 },
          { x: -1.4, yBot: 0.48, yTop: 1.24, wBot: 1.54, wMid: 1.68, wTop: 1.48, crown: 0.09 },
          { x: -2.64, yBot: 0.52, yTop: 1.12, wBot: 1.44, wMid: 1.56, wTop: 1.38, crown: 0.08 },
          { x: -3.0, yBot: 0.54, yTop: 0.94, wBot: 1.24, wMid: 1.34, wTop: 1.18, crown: 0.06 },
        ],
        bodyMat,
        0.075,
      );

      this.addLoft(
        [
          { x: 1.12, yBot: 1.28, yTop: 1.36, wBot: 1.32, wMid: 1.26, wTop: 1.18, crown: 0.04 },
          { x: 0.34, yBot: 1.28, yTop: 1.84, wBot: 1.3, wMid: 1.16, wTop: 1.02, crown: 0.08 },
          { x: -0.88, yBot: 1.26, yTop: 1.84, wBot: 1.3, wMid: 1.16, wTop: 1.02, crown: 0.08 },
          { x: -2.28, yBot: 1.18, yTop: 1.26, wBot: 1.3, wMid: 1.24, wTop: 1.14, crown: 0.04 },
        ],
        glassMat,
        0.055,
      );

      this.addLoft(
        [
          { x: 0.4, yBot: 1.82, yTop: 1.92, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.07 },
          { x: -0.96, yBot: 1.82, yTop: 1.92, wBot: 1.04, wMid: 1.0, wTop: 0.92, crown: 0.07 },
        ],
        stripeMat,
        0.05,
      );
      this.addSideMirrors(0.84, 1.34, 1.44, chromeMat);
      this.addSideVinyls('doc', palette, number, -0.05, 0.9, 1.7, 2.4, 0.66);
      this.addHoodVinyl('doc', palette, 2.02, 1.36, 1.45, 1.45);
      this.addRoofNumber(number, -0.34, 2.01, 0, '#2a4a78');

      this.addBox([0.12, 0.24, 1.66], [3.04, 0.78, 0], darkTrimMat, false, false, 0.03);
      this.addBox([0.08, 0.07, 1.74], [3.08, 0.78, 0], chromeMat, false);
      for (const side of [-1, 1]) {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.18, 16), lightMat);
        lamp.rotation.z = Math.PI / 2;
        lamp.position.set(3.0, 0.88, side * 1.1);
        this.addOutline(lamp, 0.035);
        this.body.add(lamp);
        const tail = this.addBox([0.14, 0.2, 0.44], [-3.02, 0.86, side * 1.04], tailMat, false, false, 0.025);
        this.brakeLights.push(tail);
      }

      for (const side of [-1, 1]) {
        this.addWheel(0.62, 0.42, length * 0.3, side * (width / 2 - 0.32), true, palette.wheel, '#d9dfe6', true);
        this.addWheel(0.64, 0.44, -length * 0.29, side * (width / 2 - 0.34), false, palette.wheel, '#d9dfe6', true);
      }
      this.addFlames(-length / 2 - 0.24, 0);

    } else if (carId === 'cruz') {
      // CRUZ RAMIREZ (#51): Modern 2017 CRS Sports Coupe with sculpted loft curves, vented hood & GT wing
      const length = 5.3;
      const width = 3.4;

      this.addLoft(
        [
          { x: 2.74, yBot: 0.42, yTop: 0.76, wBot: 1.16, wMid: 1.24, wTop: 1.1, crown: 0.08 },
          { x: 2.32, yBot: 0.42, yTop: 0.96, wBot: 1.42, wMid: 1.56, wTop: 1.38, crown: 0.09 },
          { x: 1.02, yBot: 0.42, yTop: 1.12, wBot: 1.48, wMid: 1.6, wTop: 1.44, crown: 0.08 },
          { x: -1.25, yBot: 0.42, yTop: 1.16, wBot: 1.5, wMid: 1.62, wTop: 1.46, crown: 0.08 },
          { x: -2.4, yBot: 0.46, yTop: 1.16, wBot: 1.44, wMid: 1.54, wTop: 1.38, crown: 0.07 },
          { x: -2.72, yBot: 0.5, yTop: 0.96, wBot: 1.22, wMid: 1.32, wTop: 1.18, crown: 0.05 },
        ],
        bodyMat,
        0.075,
      );

      for (const side of [-1, 1]) {
        const vent = this.addBox([0.5, 0.05, 0.42], [1.54, 1.13, side * 0.54], darkTrimMat, false, false, 0.02);
        vent.rotation.z = -0.12;
      }

      this.addLoft(
        [
          { x: 1.0, yBot: 1.1, yTop: 1.2, wBot: 1.3, wMid: 1.24, wTop: 1.14, crown: 0.04 },
          { x: 0.18, yBot: 1.1, yTop: 1.64, wBot: 1.28, wMid: 1.14, wTop: 0.98, crown: 0.07 },
          { x: -0.84, yBot: 1.12, yTop: 1.64, wBot: 1.28, wMid: 1.14, wTop: 0.98, crown: 0.07 },
          { x: -1.94, yBot: 1.14, yTop: 1.22, wBot: 1.28, wMid: 1.22, wTop: 1.12, crown: 0.04 },
        ],
        glassMat,
        0.055,
      );
      this.addLoft(
        [
          { x: 0.24, yBot: 1.62, yTop: 1.72, wBot: 1.0, wMid: 0.96, wTop: 0.88, crown: 0.05 },
          { x: -0.9, yBot: 1.62, yTop: 1.72, wBot: 1.0, wMid: 0.96, wTop: 0.88, crown: 0.05 },
        ],
        bodyMat,
        0.05,
      );

      this.addSideMirrors(0.7, 1.16, 1.38, bodyMat);
      this.addSideVinyls('cruz', palette, number, -0.05, 0.82, 1.63, 2.1, 0.62);
      this.addHoodVinyl('cruz', palette, 1.78, 1.18, 1.35, 1.35);
      this.addRoofNumber(number, -0.34, 1.79, 0, '#15222a');

      this.addBox([0.44, 0.09, 2.78], [-2.42, 1.5, 0], stripeMat, true, true, 0.035);
      this.addBox([0.1, 0.18, 1.42], [2.76, 0.58, 0], darkTrimMat, false, false, 0.025);
      for (const side of [-1, 1]) {
        this.addBox([0.22, 0.4, 0.1], [-2.38, 1.24, side * 0.86], darkTrimMat, true, true, 0.025);
        this.addBox([0.14, 0.15, 0.52], [2.7, 0.8, side * 0.98], lightMat, false, false, 0.025);
        const tail = this.addBox([0.12, 0.18, 0.6], [-2.74, 0.88, side * 0.92], tailMat, false, false, 0.025);
        this.brakeLights.push(tail);
      }

      for (const side of [-1, 1]) {
        this.addWheel(0.6, 0.42, length * 0.29, side * (width / 2 - 0.3), true, palette.wheel, '#d6dde4');
        this.addWheel(0.63, 0.46, -length * 0.29, side * (width / 2 - 0.32), false, palette.wheel, '#d6dde4');
      }
      this.addFlames(-length / 2 - 0.24, 0);

    } else if (carId === 'francesco') {
      // FRANCESCO BERNOULLI (#1): Tapered F1 monocoque nose, curved sidepods, open cockpit & F1 wings
      const length = 5.55;
      const width = 3.65;

      this.addLoft(
        [
          { x: 3.16, yBot: 0.36, yTop: 0.52, wBot: 0.22, wMid: 0.26, wTop: 0.2, crown: 0.04 },
          { x: 1.75, yBot: 0.38, yTop: 0.78, wBot: 0.44, wMid: 0.5, wTop: 0.4, crown: 0.06 },
          { x: -0.2, yBot: 0.38, yTop: 0.86, wBot: 0.52, wMid: 0.56, wTop: 0.48, crown: 0.06 },
          { x: -2.18, yBot: 0.4, yTop: 0.86, wBot: 0.46, wMid: 0.5, wTop: 0.4, crown: 0.06 },
        ],
        bodyMat,
        0.06,
      );
      this.addBox([3.8, 0.04, 0.34], [0.45, 0.88, 0], stripeMat);

      this.addBox([0.52, 0.08, 3.04], [2.8, 0.34, 0], highlightMat, true, true, 0.035);
      for (const side of [-1, 1]) {
        this.addBox([0.56, 0.26, 0.08], [2.8, 0.42, side * 1.52], stripeMat, true, true, 0.025);
        this.addProfile(
          [
            [0.65, 0.42],
            [0.52, 0.84],
            [-1.38, 0.84],
            [-1.58, 0.48],
          ],
          0.52,
          shadeMat,
          0.08,
          true,
          0.05,
        ).position.z = side * 0.82;
        this.addBox([0.08, 0.3, 0.4], [0.64, 0.64, side * 0.82], darkTrimMat);
        this.addTube([1.78, 0.58, side * 0.42], [1.78, 0.54, side * 1.44], 0.06, darkTrimMat);
        this.addTube([1.48, 0.56, side * 0.42], [1.78, 0.54, side * 1.44], 0.05, darkTrimMat);
        this.addTube([-1.58, 0.62, side * 0.46], [-1.58, 0.62, side * 1.48], 0.06, darkTrimMat);
      }

      this.addSideVinyls('francesco', palette, number, -0.35, 0.64, 1.18, 1.65, 0.38);

      this.addProfile(
        [
          [-0.55, 0.84],
          [-0.62, 1.46],
          [-1.36, 1.38],
          [-1.68, 0.86],
        ],
        0.44,
        bodyMat,
        0.07,
        true,
        0.05,
      );
      this.addBox([0.58, 0.1, 2.74], [-2.46, 1.56, 0], bodyMat, true, true, 0.04);
      for (const side of [-1, 1]) {
        this.addBox([0.3, 0.72, 0.1], [-2.4, 1.16, side * 0.74], darkTrimMat, true, true, 0.025);
        this.addBox([0.66, 0.34, 0.08], [-2.46, 1.54, side * 1.36], stripeMat, true, true, 0.025);
      }
      const tail = this.addBox([0.14, 0.2, 0.24], [-2.26, 0.72, 0], tailMat, false, false, 0.025);
      this.brakeLights.push(tail);

      for (const side of [-1, 1]) {
        this.addWheel(0.62, 0.52, 1.78, side * (width / 2 - 0.18), true, palette.wheel, '#d6dde4');
        this.addWheel(0.76, 0.72, -1.58, side * (width / 2 - 0.12), false, palette.wheel, '#d6dde4');
      }
      this.addRoofNumber(number, 1.18, 0.9, 0, '#15222a');
      this.addFlames(-length / 2 + 0.1, 0);

    } else if (carId === 'storm') {
      // JACKSON STORM (#20): Next-Gen Hybrid Supercar with sculpted aero loft, dorsal fin & LED blades
      const length = 5.6;
      const width = 3.58;

      this.addLoft(
        [
          { x: 2.86, yBot: 0.38, yTop: 0.7, wBot: 1.18, wMid: 1.28, wTop: 1.14, crown: 0.06 },
          { x: 2.38, yBot: 0.38, yTop: 0.92, wBot: 1.48, wMid: 1.62, wTop: 1.44, crown: 0.08 },
          { x: 1.0, yBot: 0.38, yTop: 1.08, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.07 },
          { x: -1.35, yBot: 0.38, yTop: 1.14, wBot: 1.54, wMid: 1.68, wTop: 1.5, crown: 0.07 },
          { x: -2.52, yBot: 0.44, yTop: 1.14, wBot: 1.48, wMid: 1.58, wTop: 1.42, crown: 0.06 },
          { x: -2.84, yBot: 0.48, yTop: 0.9, wBot: 1.28, wMid: 1.38, wTop: 1.22, crown: 0.04 },
        ],
        bodyMat,
        0.075,
      );

      this.addLoft(
        [
          { x: 0.96, yBot: 1.06, yTop: 1.16, wBot: 1.32, wMid: 1.24, wTop: 1.14, crown: 0.03 },
          { x: 0.14, yBot: 1.06, yTop: 1.56, wBot: 1.3, wMid: 1.14, wTop: 0.96, crown: 0.06 },
          { x: -0.92, yBot: 1.08, yTop: 1.56, wBot: 1.3, wMid: 1.14, wTop: 0.96, crown: 0.06 },
          { x: -2.14, yBot: 1.12, yTop: 1.2, wBot: 1.3, wMid: 1.22, wTop: 1.1, crown: 0.03 },
        ],
        glassMat,
        0.055,
      );
      this.addLoft(
        [
          { x: 0.2, yBot: 1.54, yTop: 1.64, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.05 },
          { x: -1.0, yBot: 1.54, yTop: 1.64, wBot: 0.98, wMid: 0.94, wTop: 0.86, crown: 0.05 },
        ],
        bodyMat,
        0.05,
      );

      this.addProfile(
        [
          [-0.92, 1.58],
          [-2.48, 1.52],
          [-2.52, 1.14],
          [-1.4, 1.14],
        ],
        0.08,
        stripeMat,
        0.02,
        true,
        0.03,
      );
      this.addSideMirrors(0.7, 1.12, 1.44, bodyMat);
      this.addSideVinyls('storm', palette, number, -0.05, 0.8, 1.69, 2.25, 0.6);
      this.addHoodVinyl('storm', palette, 1.88, 1.1, 1.4, 1.45);
      this.addRoofNumber(number, -0.4, 1.71, 0, '#ffffff');

      this.addBox([0.48, 0.08, 2.98], [-2.54, 1.48, 0], bodyMat, true, true, 0.035);
      this.addBox([0.1, 0.18, 1.46], [2.88, 0.54, 0], darkTrimMat, false, false, 0.025);
      for (const side of [-1, 1]) {
        this.addBox([0.22, 0.36, 0.1], [-2.5, 1.24, side * 1.08], darkTrimMat, true, true, 0.025);
        this.addBox([0.14, 0.1, 0.64], [2.82, 0.72, side * 0.98], stripeMat, false, false, 0.025);
        const tail = this.addBox([0.12, 0.12, 0.7], [-2.86, 0.86, side * 0.96], tailMat, false, false, 0.025);
        this.brakeLights.push(tail);
      }

      for (const side of [-1, 1]) {
        this.addWheel(0.62, 0.46, length * 0.29, side * (width / 2 - 0.34), true, palette.wheel, palette.stripe);
        this.addWheel(0.65, 0.5, -length * 0.29, side * (width / 2 - 0.36), false, palette.wheel, palette.stripe);
      }
      this.addFlames(-length / 2 - 0.22, 0);
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

    for (const wheel of this.wheels) {
      wheel.mesh.rotation.z = this.spin;
      if (wheel.front) {
        wheel.pivot.rotation.y = -racer.steer * 0.38;
      }
    }

    const steerAmount = racer.steer * Math.min(1.2, speed / 55);
    const targetRoll = -steerAmount * 0.12;
    const targetPitch = racer.nitroActive ? -0.05 : 0;
    this.body.rotation.z = THREE.MathUtils.lerp(this.body.rotation.z, targetRoll, Math.min(1, dt * 10));
    this.body.rotation.x = THREE.MathUtils.lerp(this.body.rotation.x, targetPitch, Math.min(1, dt * 8));

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

    for (const tail of this.brakeLights) {
      (tail.material as THREE.MeshBasicMaterial).color.setHex(
        speed < 8 || racer.drifting ? 0xff5030 : 0xa02518,
      );
    }

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
