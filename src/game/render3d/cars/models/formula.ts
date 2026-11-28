import { addBox, addLoft, addProfile, addTube } from '../primitives';
import { addFlames, addRoofNumber, addSideVinyls } from '../trimAndDecals';
import type { CarBuildContext } from '../types';
import { addAxlePair } from '../wheels';

export function buildFormulaCar(ctx: CarBuildContext): void {
  const { mats } = ctx;
  const length = 5.55;
  const width = 3.65;

  addLoft(
    ctx,
    [
      { x: 3.16, yBot: 0.36, yTop: 0.52, wBot: 0.22, wMid: 0.26, wTop: 0.2, crown: 0.04 },
      { x: 1.75, yBot: 0.38, yTop: 0.78, wBot: 0.44, wMid: 0.5, wTop: 0.4, crown: 0.06 },
      { x: -0.2, yBot: 0.38, yTop: 0.86, wBot: 0.52, wMid: 0.56, wTop: 0.48, crown: 0.06 },
      { x: -2.18, yBot: 0.4, yTop: 0.86, wBot: 0.46, wMid: 0.5, wTop: 0.4, crown: 0.06 },
    ],
    mats.body,
    0.06,
  );
  addBox(ctx, [3.8, 0.04, 0.34], [0.45, 0.88, 0], mats.stripe);

  addBox(ctx, [0.52, 0.08, 3.04], [2.8, 0.34, 0], mats.highlight, true, true, 0.035);
  for (const side of [-1, 1]) {
    addBox(ctx, [0.56, 0.26, 0.08], [2.8, 0.42, side * 1.52], mats.stripe, true, true, 0.025);
    addProfile(
      ctx,
      [
        [0.65, 0.42],
        [0.52, 0.84],
        [-1.38, 0.84],
        [-1.58, 0.48],
      ],
      0.52,
      mats.shade,
      0.08,
      true,
      0.05,
    ).position.z = side * 0.82;
    addBox(ctx, [0.08, 0.3, 0.4], [0.64, 0.64, side * 0.82], mats.darkTrim);
    addTube(ctx, [1.78, 0.58, side * 0.42], [1.78, 0.54, side * 1.44], 0.06, mats.darkTrim);
    addTube(ctx, [1.48, 0.56, side * 0.42], [1.78, 0.54, side * 1.44], 0.05, mats.darkTrim);
    addTube(ctx, [-1.58, 0.62, side * 0.46], [-1.58, 0.62, side * 1.48], 0.06, mats.darkTrim);
  }

  addSideVinyls(ctx, -0.35, 0.64, 1.18, 1.65, 0.38);

  addProfile(
    ctx,
    [
      [-0.55, 0.84],
      [-0.62, 1.46],
      [-1.36, 1.38],
      [-1.68, 0.86],
    ],
    0.44,
    mats.body,
    0.07,
    true,
    0.05,
  );
  addBox(ctx, [0.58, 0.1, 2.74], [-2.46, 1.56, 0], mats.body, true, true, 0.04);
  for (const side of [-1, 1]) {
    addBox(ctx, [0.3, 0.72, 0.1], [-2.4, 1.16, side * 0.74], mats.darkTrim, true, true, 0.025);
    addBox(ctx, [0.66, 0.34, 0.08], [-2.46, 1.54, side * 1.36], mats.stripe, true, true, 0.025);
  }
  const tail = addBox(ctx, [0.14, 0.2, 0.24], [-2.26, 0.72, 0], mats.tail, false, false, 0.025);
  ctx.brakeLights.push(tail);

  addAxlePair(
    ctx,
    { radius: 0.62, width: 0.52, x: 1.78, z: width / 2 - 0.18, rimColor: '#d6dde4' },
    { radius: 0.76, width: 0.72, x: -1.58, z: width / 2 - 0.12, rimColor: '#d6dde4' },
  );
  addRoofNumber(ctx, 1.18, 0.9, 0, '#15222a');
  addFlames(ctx, -length / 2 + 0.1, 0);
}
