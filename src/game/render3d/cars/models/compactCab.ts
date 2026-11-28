import * as THREE from 'three';
import { addBox, addGreenhouse, addLoft, addOutline, addRoundLamp, addTube } from '../primitives';
import { addFlames, addRoofNumber, addSideMirrors, addSideVinyls } from '../trimAndDecals';
import type { CarBuildContext } from '../types';
import { addAxlePair } from '../wheels';

function buildLuigi(ctx: CarBuildContext): void {
  const { mats, palette } = ctx;
  const length = 4.1;
  const width = 2.85;

  addTube(ctx, [2.16, 0.52, -0.95], [2.16, 0.52, 0.95], 0.07, mats.chrome);
  addTube(ctx, [-2.12, 0.52, -0.95], [-2.12, 0.52, 0.95], 0.07, mats.chrome);

  addLoft(
    ctx,
    [
      { x: 2.08, yBot: 0.44, yTop: 0.84, wBot: 0.98, wMid: 1.08, wTop: 0.94, crown: 0.1 },
      { x: 1.65, yBot: 0.44, yTop: 1.1, wBot: 1.2, wMid: 1.32, wTop: 1.18, crown: 0.1 },
      { x: 0.85, yBot: 0.44, yTop: 1.24, wBot: 1.24, wMid: 1.36, wTop: 1.24, crown: 0.08 },
      { x: -1.45, yBot: 0.44, yTop: 1.24, wBot: 1.24, wMid: 1.36, wTop: 1.24, crown: 0.08 },
      { x: -2.05, yBot: 0.48, yTop: 0.98, wBot: 1.04, wMid: 1.14, wTop: 1.0, crown: 0.08 },
    ],
    mats.body,
    0.07,
  );

  addGreenhouse(
    ctx,
    [
      { x: 0.92, yBot: 1.22, yTop: 1.32, wBot: 1.12, wMid: 1.06, wTop: 0.98, crown: 0.04 },
      { x: 0.4, yBot: 1.22, yTop: 1.84, wBot: 1.1, wMid: 0.98, wTop: 0.88, crown: 0.08 },
      { x: -1.04, yBot: 1.22, yTop: 1.84, wBot: 1.1, wMid: 0.98, wTop: 0.88, crown: 0.08 },
      { x: -1.68, yBot: 1.22, yTop: 1.32, wBot: 1.1, wMid: 1.04, wTop: 0.96, crown: 0.04 },
    ],
    0.055,
  );

  addLoft(
    ctx,
    [
      { x: 0.46, yBot: 1.82, yTop: 1.94, wBot: 0.9, wMid: 0.86, wTop: 0.8, crown: 0.06 },
      { x: -0.35, yBot: 1.82, yTop: 1.96, wBot: 0.9, wMid: 0.86, wTop: 0.8, crown: 0.06 },
      { x: -1.1, yBot: 1.82, yTop: 1.93, wBot: 0.9, wMid: 0.86, wTop: 0.8, crown: 0.06 },
    ],
    mats.body,
    0.05,
  );
  addBox(ctx, [1.0, 0.06, 1.2], [-0.34, 2.01, 0], mats.stripe, true, true, 0.025);
  addSideMirrors(ctx, 0.74, 1.26, 1.22, mats.chrome);
  addSideVinyls(ctx, -0.05, 0.88, 1.39, 1.65, 0.6);
  addRoofNumber(ctx, -0.34, 2.08, 0, '#15222a');

  addBox(ctx, [0.1, 0.14, 0.7], [2.1, 0.92, 0], mats.chrome, false, false, 0.025);
  for (const side of [-1, 1]) {
    addRoundLamp(ctx, 0.17, 0.18, [2.04, 0.94, side * 0.78]);
    const tail = addBox(ctx, [0.12, 0.22, 0.24], [-2.08, 0.9, side * 0.8], mats.tail, false, false, 0.025);
    ctx.brakeLights.push(tail);
  }

  addAxlePair(
    ctx,
    { radius: 0.46, width: 0.32, x: length * 0.31, z: width / 2 - 0.26, rimColor: '#ece6d8', whitewall: true },
    { radius: 0.48, width: 0.34, x: -length * 0.31, z: width / 2 - 0.26, rimColor: '#ece6d8', whitewall: true },
  );
  addFlames(ctx, -length / 2 - 0.2, 0);
}

function buildGuido(ctx: CarBuildContext): void {
  const { mats } = ctx;
  const length = 3.7;
  const width = 2.7;

  addLoft(
    ctx,
    [
      { x: 1.56, yBot: 0.42, yTop: 0.86, wBot: 0.88, wMid: 0.96, wTop: 0.86, crown: 0.06 },
      { x: 0.9, yBot: 0.42, yTop: 1.02, wBot: 1.06, wMid: 1.14, wTop: 1.04, crown: 0.06 },
      { x: -1.35, yBot: 0.42, yTop: 1.08, wBot: 1.08, wMid: 1.16, wTop: 1.06, crown: 0.06 },
      { x: -1.84, yBot: 0.46, yTop: 0.98, wBot: 0.94, wMid: 1.02, wTop: 0.92, crown: 0.05 },
    ],
    mats.body,
    0.07,
  );

  addGreenhouse(
    ctx,
    [
      { x: 1.06, yBot: 0.98, yTop: 1.12, wBot: 0.92, wMid: 0.88, wTop: 0.82, crown: 0.03 },
      { x: 0.62, yBot: 1.0, yTop: 1.68, wBot: 0.92, wMid: 0.84, wTop: 0.76, crown: 0.06 },
      { x: -0.76, yBot: 1.0, yTop: 1.68, wBot: 0.92, wMid: 0.84, wTop: 0.76, crown: 0.06 },
      { x: -1.16, yBot: 1.02, yTop: 1.14, wBot: 0.92, wMid: 0.88, wTop: 0.82, crown: 0.03 },
    ],
    0.05,
  );

  addLoft(
    ctx,
    [
      { x: 0.66, yBot: 1.66, yTop: 1.78, wBot: 0.78, wMid: 0.74, wTop: 0.68, crown: 0.05 },
      { x: -0.8, yBot: 1.66, yTop: 1.78, wBot: 0.78, wMid: 0.74, wTop: 0.68, crown: 0.05 },
    ],
    mats.stripe,
    0.045,
  );

  addSideVinyls(ctx, -0.15, 0.82, 1.19, 1.45, 0.54);
  addRoofNumber(ctx, -0.1, 1.85, 0, '#15222a');

  const forks: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    addTube(ctx, [1.68, 0.46, side * 0.54], [1.64, 1.62, side * 0.54], 0.07, mats.darkTrim);
    forks.push(addBox(ctx, [0.74, 0.07, 0.16], [2.02, 0.46, side * 0.44], mats.chrome, true, true, 0.025));
    addRoundLamp(ctx, 0.14, 0.16, [1.62, 0.86, side * 0.74], 0.03);
    const tail = addBox(ctx, [0.12, 0.22, 0.24], [-1.88, 0.9, side * 0.7], mats.tail, false, false, 0.025);
    ctx.brakeLights.push(tail);
  }
  ctx.stockParts['front-forks'] = forks;
  addBox(ctx, [0.1, 0.12, 1.16], [1.66, 1.54, 0], mats.darkTrim, true, true, 0.025);
  addBox(ctx, [0.1, 0.16, 1.16], [1.7, 0.62, 0], mats.darkTrim, true, true, 0.025);

  addAxlePair(
    ctx,
    { radius: 0.44, width: 0.34, x: 1.05, z: width / 2 - 0.34, rimColor: '#d6dde4' },
    { radius: 0.38, width: 0.3, x: -1.12, z: width / 2 - 0.4, rimColor: '#d6dde4' },
  );
  addFlames(ctx, -length / 2 - 0.2, 0);
}

function buildMater(ctx: CarBuildContext): void {
  const { mats, palette } = ctx;
  const length = 5.9;
  const width = 3.65;

  addBox(ctx, [0.34, 0.2, 2.86], [2.92, 0.54, 0], mats.chrome, true, true, 0.035);

  addLoft(
    ctx,
    [
      { x: 2.84, yBot: 0.52, yTop: 1.12, wBot: 1.24, wMid: 1.36, wTop: 1.18, crown: 0.12 },
      { x: 2.2, yBot: 0.52, yTop: 1.32, wBot: 1.48, wMid: 1.62, wTop: 1.42, crown: 0.12 },
      { x: 1.15, yBot: 0.52, yTop: 1.42, wBot: 1.54, wMid: 1.66, wTop: 1.5, crown: 0.1 },
      { x: -0.58, yBot: 0.52, yTop: 1.42, wBot: 1.54, wMid: 1.66, wTop: 1.5, crown: 0.08 },
    ],
    mats.body,
    0.075,
  );

  addLoft(
    ctx,
    [
      { x: -0.52, yBot: 0.54, yTop: 1.06, wBot: 1.54, wMid: 1.64, wTop: 1.58, crown: 0.04 },
      { x: -2.92, yBot: 0.58, yTop: 1.06, wBot: 1.5, wMid: 1.6, wTop: 1.54, crown: 0.04 },
    ],
    mats.shade,
    0.065,
  );

  addBox(ctx, [1.05, 0.22, 1.05], [1.85, 1.46, 0], mats.darkTrim, true, true, 0.03);
  const airCleaner = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16), mats.chrome);
  airCleaner.position.set(1.88, 1.68, 0);
  addOutline(airCleaner, mats.outline, 0.035);
  ctx.body.add(airCleaner);

  addGreenhouse(
    ctx,
    [
      { x: 1.12, yBot: 1.4, yTop: 1.52, wBot: 1.36, wMid: 1.3, wTop: 1.24, crown: 0.04 },
      { x: 0.62, yBot: 1.4, yTop: 2.08, wBot: 1.36, wMid: 1.26, wTop: 1.16, crown: 0.07 },
      { x: -0.44, yBot: 1.4, yTop: 2.08, wBot: 1.36, wMid: 1.26, wTop: 1.16, crown: 0.07 },
      { x: -0.6, yBot: 1.4, yTop: 1.52, wBot: 1.36, wMid: 1.3, wTop: 1.24, crown: 0.04 },
    ],
    0.055,
  );
  addLoft(
    ctx,
    [
      { x: 0.68, yBot: 2.06, yTop: 2.18, wBot: 1.18, wMid: 1.14, wTop: 1.08, crown: 0.07 },
      { x: -0.5, yBot: 2.06, yTop: 2.18, wBot: 1.18, wMid: 1.14, wTop: 1.08, crown: 0.07 },
    ],
    mats.body,
    0.055,
  );

  addSideVinyls(ctx, 0.3, 1.0, 1.68, 1.45, 0.58);
  addRoofNumber(ctx, 0.08, 2.27, 0, '#f2e6cf');

  const towParts: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    towParts.push(addTube(ctx, [-0.92, 1.06, side * 0.92], [-2.55, 2.12, 0], 0.095, mats.darkTrim));
    towParts.push(addTube(ctx, [-2.38, 1.06, side * 0.85], [-2.55, 2.12, 0], 0.08, mats.darkTrim));
    addBox(ctx, [0.2, 0.26, 0.12], [0.85, 1.72, side * 1.54], mats.chrome, true, true, 0.03);
    addRoundLamp(ctx, 0.18, 0.2, [2.86, 1.02, side * 1.04]);
    const tail = addBox(ctx, [0.14, 0.22, 0.42], [-2.96, 0.84, side * 1.08], mats.tail, false, false, 0.025);
    ctx.brakeLights.push(tail);
  }
  towParts.push(addTube(ctx, [-2.55, 2.12, 0], [-2.78, 1.44, 0], 0.055, mats.chrome));
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 14), mats.chrome);
  hook.position.set(-2.78, 1.32, 0);
  ctx.body.add(hook);
  towParts.push(hook);
  ctx.stockParts['tow-boom'] = towParts;
  addTube(ctx, [-0.68, 1.08, -1.24], [-0.68, 2.38, -1.24], 0.09, mats.chrome);

  addAxlePair(
    ctx,
    { radius: 0.66, width: 0.46, x: length * 0.3, z: width / 2 - 0.38, rimColor: palette.stripe },
    { radius: 0.78, width: 0.62, x: -length * 0.29, z: width / 2 - 0.22, rimColor: palette.stripe },
  );
  addFlames(ctx, -length / 2 - 0.22, 0);
}

function buildFillmore(ctx: CarBuildContext): void {
  const { mats, palette } = ctx;
  const length = 4.9;
  const width = 3.25;

  addTube(ctx, [2.56, 0.48, -1.24], [2.56, 0.48, 1.24], 0.08, mats.chrome);
  addTube(ctx, [-2.52, 0.5, -1.22], [-2.52, 0.5, 1.22], 0.08, mats.chrome);

  addLoft(
    ctx,
    [
      { x: 2.5, yBot: 0.44, yTop: 1.26, wBot: 1.3, wMid: 1.44, wTop: 1.36, crown: 0.06 },
      { x: 1.9, yBot: 0.44, yTop: 1.34, wBot: 1.38, wMid: 1.52, wTop: 1.44, crown: 0.06 },
      { x: -1.9, yBot: 0.44, yTop: 1.34, wBot: 1.38, wMid: 1.52, wTop: 1.44, crown: 0.06 },
      { x: -2.48, yBot: 0.48, yTop: 1.26, wBot: 1.3, wMid: 1.42, wTop: 1.34, crown: 0.06 },
    ],
    mats.body,
    0.075,
  );

  // Classic VW bus contrasting lower stripe trim across the front V-nose
  addBox(ctx, [0.1, 0.26, 2.54], [2.52, 1.06, 0], mats.stripe, false, false, 0.025);

  addGreenhouse(
    ctx,
    [
      { x: 2.38, yBot: 1.28, yTop: 1.88, wBot: 1.36, wMid: 1.32, wTop: 1.24, crown: 0.06 },
      { x: 1.5, yBot: 1.32, yTop: 2.02, wBot: 1.36, wMid: 1.3, wTop: 1.2, crown: 0.08 },
      { x: -1.56, yBot: 1.32, yTop: 2.02, wBot: 1.36, wMid: 1.3, wTop: 1.2, crown: 0.08 },
      { x: -2.38, yBot: 1.28, yTop: 1.86, wBot: 1.34, wMid: 1.28, wTop: 1.2, crown: 0.06 },
    ],
    0.055,
  );

  addLoft(
    ctx,
    [
      { x: 2.28, yBot: 1.9, yTop: 2.08, wBot: 1.24, wMid: 1.2, wTop: 1.12, crown: 0.09 },
      { x: 0.0, yBot: 1.98, yTop: 2.16, wBot: 1.24, wMid: 1.2, wTop: 1.12, crown: 0.09 },
      { x: -2.28, yBot: 1.88, yTop: 2.06, wBot: 1.24, wMid: 1.2, wTop: 1.12, crown: 0.09 },
    ],
    mats.stripe,
    0.055,
  );

  addSideMirrors(ctx, 1.84, 1.36, 1.48, mats.chrome);
  addSideVinyls(ctx, -0.05, 0.9, 1.54, 2.1, 0.62);
  addRoofNumber(ctx, 0.0, 2.27, 0, '#346b28');

  for (const side of [-1, 1]) {
    addRoundLamp(ctx, 0.19, 0.18, [2.46, 0.88, side * 0.94]);
    const tail = addBox(ctx, [0.12, 0.24, 0.26], [-2.5, 0.86, side * 0.96], mats.tail, false, false, 0.025);
    ctx.brakeLights.push(tail);
  }

  addAxlePair(
    ctx,
    { radius: 0.56, width: 0.4, x: length * 0.31, z: width / 2 - 0.32, rimColor: palette.stripe, whitewall: true },
    { radius: 0.56, width: 0.4, x: -length * 0.31, z: width / 2 - 0.32, rimColor: palette.stripe, whitewall: true },
  );
  addFlames(ctx, -length / 2 - 0.22, 0);
}

export function buildCompactCab(
  ctx: CarBuildContext,
  carId: 'luigi' | 'guido' | 'mater' | 'fillmore',
): void {
  if (carId === 'luigi') buildLuigi(ctx);
  else if (carId === 'guido') buildGuido(ctx);
  else if (carId === 'mater') buildMater(ctx);
  else buildFillmore(ctx);
}
