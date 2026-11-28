import * as THREE from 'three';
import { setGlassBounds } from '../glassMaterial';
import type { CarBuildContext, LoftStation } from './types';

export const OUTLINE_COLOR = '#161c24';

let sharedToonRamp: THREE.DataTexture | null = null;

export function getToonRamp(): THREE.DataTexture {
  if (sharedToonRamp) return sharedToonRamp;
  // Three crisp cel-shading bands: shadow, midtone, highlight.
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

export function createToonMaterial(hex: string, transparent = false, opacity = 1): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: hex,
    gradientMap: getToonRamp(),
    transparent,
    opacity,
  });
}

export function addOutline(
  mesh: THREE.Mesh,
  outlineMat: THREE.Material,
  thickness = 0.065,
): void {
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
  mesh.add(new THREE.Mesh(outGeo, outlineMat));
}

export function addLoft(
  ctx: CarBuildContext,
  stations: LoftStation[],
  material: THREE.Material,
  outlineThickness = 0.065,
  cast = true,
): THREE.Mesh {
  // Record lower-body lofts so wheel arches clip cleanly to fender contours.
  if (stations.length >= 2 && stations[0].yBot <= 0.62) {
    ctx.hulls.push(stations);
  }

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
      indices.push(a, b, c, b, d, c);
    }
  }

  const front = stations[0];
  const fCenterIdx = positions.length / 3;
  positions.push(front.x, (front.yBot + front.yTop) * 0.5, 0);
  for (let j = 0; j < ringSize; j += 1) {
    indices.push(fCenterIdx, j, (j + 1) % ringSize);
  }

  const last = stations[stations.length - 1];
  const lBase = (stations.length - 1) * ringSize;
  const lCenterIdx = positions.length / 3;
  positions.push(last.x, (last.yBot + last.yTop) * 0.5, 0);
  for (let j = 0; j < ringSize; j += 1) {
    indices.push(lCenterIdx, lBase + ((j + 1) % ringSize), lBase + j);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  ctx.body.add(mesh);
  if (outlineThickness > 0) {
    addOutline(mesh, ctx.mats.outline, outlineThickness);
  }
  return mesh;
}

function sampleStationAtX(stations: LoftStation[], x: number): LoftStation {
  if (x >= stations[0].x) return { ...stations[0], x };
  const last = stations[stations.length - 1];
  if (x <= last.x) return { ...last, x };

  for (let i = 0; i < stations.length - 1; i += 1) {
    const a = stations[i];
    const b = stations[i + 1];
    if (x <= a.x && x >= b.x) {
      const span = Math.max(1e-5, a.x - b.x);
      const t = (a.x - x) / span;
      return {
        x,
        yBot: a.yBot + (b.yBot - a.yBot) * t,
        yTop: a.yTop + (b.yTop - a.yTop) * t,
        wBot: a.wBot + (b.wBot - a.wBot) * t,
        wMid: a.wMid + (b.wMid - a.wMid) * t,
        wTop: a.wTop + (b.wTop - a.wTop) * t,
        crown: (a.crown ?? 0.08) + ((b.crown ?? 0.08) - (a.crown ?? 0.08)) * t,
      };
    }
  }
  return { ...last, x };
}

function sliceStations(
  stations: LoftStation[],
  xFront: number,
  xBack: number,
  widen = 0,
  raiseTop = 0,
): LoftStation[] {
  const out: LoftStation[] = [];
  const pushAdjusted = (s: LoftStation) => {
    out.push({
      x: s.x,
      yBot: s.yBot,
      yTop: s.yTop + raiseTop,
      wBot: s.wBot + widen,
      wMid: s.wMid + widen,
      wTop: s.wTop + widen,
      crown: s.crown,
    });
  };
  pushAdjusted(sampleStationAtX(stations, xFront));
  for (const st of stations) {
    if (st.x < xFront - 0.01 && st.x > xBack + 0.01) {
      pushAdjusted(st);
    }
  }
  pushAdjusted(sampleStationAtX(stations, xBack));
  return out;
}

export function addGreenhouse(
  ctx: CarBuildContext,
  stations: LoftStation[],
  outlineThickness = 0.055,
): void {
  const { glass: glassMat, pillar: pillarMat } = ctx.mats;
  const spec = ctx.ghSpec;
  if (!spec || stations.length < 2) {
    addLoft(ctx, stations, glassMat, outlineThickness);
    return;
  }

  const xMax = stations[0].x;
  const xMin = stations[stations.length - 1].x;
  const totalLen = Math.max(0.2, xMax - xMin);

  let yMin = Infinity;
  let yMax = -Infinity;
  let zMax = 0;
  for (const st of stations) {
    const top = st.yTop + (st.crown ?? 0.08);
    if (st.yBot < yMin) yMin = st.yBot;
    if (top > yMax) yMax = top;
    zMax = Math.max(zMax, st.wBot, st.wMid, st.wTop);
  }
  setGlassBounds(glassMat, xMin, yMin, -zMax, xMax, yMax, zMax);

  const pillars = [...spec.splits]
    .sort((a, b) => a.at - b.at)
    .map((split) => {
      const cx = xMax - split.at * totalLen;
      const half = split.width * 0.5;
      return { xFront: cx + half, xBack: cx - half };
    })
    .filter((p) => p.xFront < xMax - 0.08 && p.xBack > xMin + 0.08);

  let cursor = xMax;
  for (const p of pillars) {
    if (cursor - p.xFront > 0.04) {
      addLoft(ctx, sliceStations(stations, cursor, p.xFront), glassMat, outlineThickness);
    }
    addLoft(ctx, sliceStations(stations, p.xFront, p.xBack, 0.024, 0.014), pillarMat, Math.min(0.038, outlineThickness));
    cursor = p.xBack;
  }
  if (cursor - xMin > 0.04) {
    addLoft(ctx, sliceStations(stations, cursor, xMin), glassMat, outlineThickness);
  }

  const f0 = stations[0];
  const f1 = stations[1];
  const rPrev = stations[stations.length - 2];
  const rLast = stations[stations.length - 1];
  for (const side of [-1, 1]) {
    addTube(
      ctx,
      [f0.x, f0.yBot + 0.03, side * (f0.wBot + 0.02)],
      [f1.x, f1.yTop, side * (f1.wTop + 0.02)],
      0.058,
      pillarMat,
    );
    addTube(
      ctx,
      [rPrev.x, rPrev.yTop, side * (rPrev.wTop + 0.02)],
      [rLast.x, rLast.yBot + 0.03, side * (rLast.wBot + 0.02)],
      0.058,
      pillarMat,
    );
    if (stations.length >= 4 && f1.x - rPrev.x > 0.2) {
      addTube(
        ctx,
        [f1.x, f1.yTop, side * (f1.wTop + 0.015)],
        [rPrev.x, rPrev.yTop, side * (rPrev.wTop + 0.015)],
        0.046,
        pillarMat,
      );
    }
  }
}

export function addBox(
  ctx: CarBuildContext,
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
  ctx.body.add(mesh);
  if (outline > 0) addOutline(mesh, ctx.mats.outline, outline);
  return mesh;
}

export function addProfile(
  ctx: CarBuildContext,
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
  ctx.body.add(mesh);
  if (outline > 0) addOutline(mesh, ctx.mats.outline, outline);
  return mesh;
}

export function addTube(
  ctx: CarBuildContext,
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
  ctx.body.add(mesh);
  return mesh;
}

export function addRoundLamp(
  ctx: CarBuildContext,
  radius: number,
  depth: number,
  pos: [number, number, number],
  outline = 0.035,
): THREE.Mesh {
  const segments = radius >= 0.17 ? 16 : 14;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, segments), ctx.mats.light);
  lamp.rotation.z = Math.PI / 2;
  lamp.position.set(...pos);
  addOutline(lamp, ctx.mats.outline, outline);
  ctx.body.add(lamp);
  return lamp;
}

export function addExhaustPipe(
  ctx: CarBuildContext,
  radius: number,
  length: number,
  pos: [number, number, number],
): THREE.Mesh {
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), ctx.mats.chrome);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(...pos);
  ctx.body.add(pipe);
  return pipe;
}
