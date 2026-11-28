import * as THREE from 'three';
import type { CarId } from '../../types';
import { createHoodVinylTexture, createNumberTexture, createSideVinylTexture } from '../textures';
import { addBox } from './primitives';
import type { CarBuildContext } from './types';

const SHADOW_DIMS: Record<CarId, [number, number]> = {
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

export function addDropShadow(group: THREE.Group, carId: CarId): THREE.Mesh {
  const [l, w] = SHADOW_DIMS[carId];
  const mat = new THREE.MeshBasicMaterial({
    color: '#081217',
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(l, w), mat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  group.add(shadow);
  return shadow;
}

export function addSideMirrors(
  ctx: CarBuildContext,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
): void {
  for (const side of [-1, 1]) {
    const mirror = addBox(ctx, [0.18, 0.13, 0.22], [x, y, side * z], mat, true, true, 0.035);
    mirror.rotation.y = side * 0.25;
  }
}

export function addRoofNumber(
  ctx: CarBuildContext,
  x: number,
  y: number,
  z: number,
  color: string,
): void {
  const map = createNumberTexture(ctx.number, color);
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), material);
  roof.rotation.x = -Math.PI / 2;
  roof.position.set(x, y, z);
  ctx.body.add(roof);
}

export function addSideVinyls(
  ctx: CarBuildContext,
  xCenter: number,
  yCenter: number,
  zHalfWidth: number,
  panelLength: number,
  panelHeight: number,
): void {
  const tex = createSideVinylTexture(ctx.carId, ctx.palette.stripe, ctx.palette.highlight, ctx.number);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  for (const side of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(panelLength, panelHeight), mat);
    plane.rotation.y = side > 0 ? 0 : Math.PI;
    plane.position.set(xCenter, yCenter, side * zHalfWidth);
    ctx.body.add(plane);
  }
}

export function addHoodVinyl(
  ctx: CarBuildContext,
  x: number,
  y: number,
  length: number,
  width: number,
  tiltZ = 0,
): void {
  const tex = createHoodVinylTexture(ctx.carId, ctx.palette.stripe, ctx.palette.highlight);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(length, width), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.rotation.z = tiltZ;
  plane.position.set(x, y, 0);
  ctx.body.add(plane);
}

export function addFlames(ctx: CarBuildContext, x: number, z: number): void {
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
    ctx.body.add(flameGroup);
    ctx.flames.push(coreFlame);
    ctx.flameGroups.push(flameGroup);
  }
}
