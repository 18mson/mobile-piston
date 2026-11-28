import * as THREE from 'three';
import { addOutline, createToonMaterial } from './primitives';
import type { CarBuildContext, LoftStation, WheelSpec } from './types';

function hullAt(
  hulls: LoftStation[][],
  x: number,
): { yBot: number; yTop: number; wBot: number; wMid: number; wTop: number } | null {
  let best: { yBot: number; yTop: number; wBot: number; wMid: number; wTop: number } | null = null;
  for (const st of hulls) {
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

function hullXRange(hulls: LoftStation[][]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const st of hulls) {
    for (const s of st) {
      lo = Math.min(lo, s.x);
      hi = Math.max(hi, s.x);
    }
  }
  return [lo, hi];
}

function addWheelWell(
  ctx: CarBuildContext,
  x: number,
  cy: number,
  rw: number,
  wallZ: number,
  sgn: number,
  yBotG: number,
  yTopG: number,
  front: boolean,
): void {
  const ySc = ctx.body.scale.y;
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
  const well = new THREE.Mesh(geo, ctx.mats.well);
  well.position.set(x, cy / ySc, sgn * wallZ);
  if (sgn < 0) well.rotation.y = Math.PI;
  ctx.body.add(well);

  const lipMat = !front && ctx.mats.rearLip ? ctx.mats.rearLip : ctx.mats.lip;
  const lipR = rw + 0.02;
  const addLip = (from: number, to: number): void => {
    if (to - from < 0.05) return;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(lipR, 0.05, 6, 18, to - from), lipMat);
    lip.geometry.scale(1, 1 / ySc, 1);
    lip.rotation.z = from;
    lip.position.set(x, cy / ySc, sgn * (wallZ + 0.01));
    ctx.body.add(lip);
  };
  if (aH > Math.PI / 2 - 0.02) {
    addLip(aL, Math.PI - aL);
  } else {
    addLip(aL, aH);
    addLip(Math.PI - aH, Math.PI - aL);
  }
}

function attachRim(
  ctx: CarBuildContext,
  tire: THREE.Mesh,
  r: number,
  width: number,
  rimColor: string,
  whitewall: boolean,
): void {
  const rimRadius = r * 0.58;
  const rimWidth = width + 0.06;
  const rimOverride = ctx.palette.rim;
  const effectiveRimColor = rimOverride?.color ?? rimColor;
  const rimStyle = rimOverride?.style ?? 'disc';

  const makeDiscGeo = (radius: number, depth: number, radialSegments = 16) => {
    const geo = new THREE.CylinderGeometry(radius, radius, depth, radialSegments);
    geo.rotateX(Math.PI / 2);
    return geo;
  };

  if (rimStyle === 'spoke') {
    tire.add(new THREE.Mesh(makeDiscGeo(rimRadius * 0.96, rimWidth * 0.85), createToonMaterial('#2e3742')));

    const spokeMat = createToonMaterial(effectiveRimColor);
    const spokeGeo = new THREE.BoxGeometry(rimRadius * 1.88, Math.max(0.06, rimRadius * 0.24), rimWidth * 1.02);
    for (let i = 0; i < 3; i += 1) {
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.rotation.z = (i * Math.PI) / 3;
      tire.add(spoke);
    }
    tire.add(new THREE.Mesh(makeDiscGeo(rimRadius * 0.36, rimWidth + 0.04, 12), createToonMaterial('#3a4350')));
    return;
  }

  if (rimStyle === 'dish') {
    const dishRadius = Math.min(r * 0.66, whitewall ? r * 0.72 : r * 0.68);
    const dish = new THREE.Mesh(makeDiscGeo(dishRadius, rimWidth), createToonMaterial(effectiveRimColor));
    dish.castShadow = true;
    tire.add(dish);
    tire.add(new THREE.Mesh(makeDiscGeo(dishRadius * 0.72, rimWidth + 0.015), createToonMaterial('#222933')));
    tire.add(new THREE.Mesh(makeDiscGeo(dishRadius * 0.34, rimWidth + 0.03, 12), createToonMaterial(effectiveRimColor)));
    return;
  }

  const rim = new THREE.Mesh(makeDiscGeo(rimRadius, rimWidth), createToonMaterial(effectiveRimColor));
  rim.castShadow = true;
  tire.add(rim);
  tire.add(new THREE.Mesh(makeDiscGeo(rimRadius * 0.34, rimWidth + 0.04, 12), createToonMaterial('#3a4350')));
}

export function addWheel(
  ctx: CarBuildContext,
  spec: WheelSpec,
  front: boolean,
): void {
  const { radius, width, x, z, rimColor, whitewall = false } = spec;
  const ySc = ctx.body.scale.y;
  let r = radius;
  let wx = x;
  let wz = z;
  let well: { cy: number; rw: number; wallZ: number; sgn: number; yBotG: number; yTopG: number } | null = null;

  if (!ctx.openWheel && ctx.hulls.length > 0) {
    // Push closed-body axles toward the corners and clamp radius to fit beneath the fender top.
    const [lo, hi] = hullXRange(ctx.hulls);
    const margin = radius * 0.8 + 0.2;
    wx = THREE.MathUtils.clamp(x * 1.1, lo + margin, hi - margin);

    const hull = hullAt(ctx.hulls, wx);
    if (hull) {
      const wellK = 1.24;
      const topG = hull.yTop * ySc;
      const targetR = radius * 0.84;
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
  const tire = new THREE.Mesh(tireGeo, createToonMaterial(ctx.palette.wheel));
  tire.castShadow = true;
  addOutline(tire, ctx.mats.outline, 0.05);
  pivot.add(tire);

  if (whitewall) {
    const wallGeo = new THREE.CylinderGeometry(r * 0.78, r * 0.78, width + 0.03, 20);
    wallGeo.rotateX(Math.PI / 2);
    tire.add(new THREE.Mesh(wallGeo, createToonMaterial('#ece6d8')));
  }

  attachRim(ctx, tire, r, width, rimColor, whitewall);
  ctx.group.add(pivot);
  ctx.wheels.push({ pivot, mesh: tire, front });

  if (well) {
    addWheelWell(ctx, wx, well.cy, well.rw, well.wallZ, well.sgn, well.yBotG, well.yTopG, front);
  }
}

export function addAxlePair(ctx: CarBuildContext, front: WheelSpec, rear: WheelSpec): void {
  for (const side of [-1, 1]) {
    addWheel(ctx, { ...front, z: side * front.z }, true);
    addWheel(ctx, { ...rear, z: side * rear.z }, false);
  }
}
