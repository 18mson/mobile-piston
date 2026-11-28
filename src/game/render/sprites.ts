import type { CarId, CarPalette, RacerState } from '../types';

export interface CarAtlas {
  turns: HTMLCanvasElement[];
  shadows: HTMLCanvasElement[];
}

const TURN_COUNT = 32;
const SPRITE_SIZE = 34;
const BASE_WIDTH = 24;
const BASE_HEIGHT = 16;

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawNumber(ctx: CanvasRenderingContext2D, number: number, x: number, y: number, color: string): void {
  const glyphs: Record<string, string[]> = {
    '1': ['010', '110', '010', '010', '111'],
    '2': ['110', '001', '010', '100', '111'],
    '3': ['110', '001', '010', '001', '110'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '110', '001', '110'],
    '6': ['011', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '110'],
  };
  const glyph = glyphs[String(number % 10)] ?? glyphs['1'];
  ctx.fillStyle = color;
  for (let row = 0; row < glyph.length; row += 1) {
    for (let column = 0; column < glyph[row].length; column += 1) {
      if (glyph[row][column] === '1') ctx.fillRect(x + column, y + row, 1, 1);
    }
  }
}

function drawPixels(ctx: CanvasRenderingContext2D, color: string, pixels: number[][]): void {
  ctx.fillStyle = color;
  for (const [x, y, w = 1, h = 1] of pixels) {
    ctx.fillRect(x, y, w, h);
  }
}

function drawWheels(ctx: CanvasRenderingContext2D, palette: CarPalette, longBuggy = false): void {
  const wheelPositions = longBuggy
    ? [
        [3, 1, 5, 3],
        [3, 12, 5, 3],
        [17, 1, 5, 3],
        [17, 12, 5, 3],
      ]
    : [
        [4, 1, 4, 2],
        [4, 13, 4, 2],
        [16, 1, 4, 2],
        [16, 13, 4, 2],
      ];
  for (const [x, y, w, h] of wheelPositions) {
    ctx.fillStyle = palette.wheel;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#454b52';
    ctx.fillRect(x + 1, y, Math.max(1, w - 2), 1);
  }
}

function drawSirip(ctx: CanvasRenderingContext2D, palette: CarPalette, number: number): void {
  drawWheels(ctx, palette);
  drawPixels(ctx, palette.shade, [
    [5, 4, 14, 1],
    [4, 5, 16, 7],
    [5, 12, 14, 1],
    [3, 6, 2, 5],
  ]);
  drawPixels(ctx, palette.body, [
    [6, 4, 13, 1],
    [5, 5, 15, 6],
    [6, 11, 13, 1],
  ]);
  drawPixels(ctx, palette.highlight, [
    [7, 4, 8, 1],
    [21, 6, 1, 3],
  ]);
  drawPixels(ctx, palette.glass, [
    [15, 5, 3, 2],
    [18, 6, 1, 3],
    [15, 9, 3, 2],
    [7, 6, 2, 4],
  ]);
  drawPixels(ctx, palette.stripe, [
    [11, 5, 3, 6],
    [12, 4, 1, 8],
  ]);
  ctx.fillStyle = palette.body;
  ctx.fillRect(11, 5, 3, 6);
  drawNumber(ctx, number, 11, 6, palette.stripe === '#20232a' ? '#f5ebd2' : '#14232c');
  drawPixels(ctx, '#fff0b0', [
    [21, 5, 1, 1],
    [21, 10, 1, 1],
  ]);
  drawPixels(ctx, '#ff5c43', [
    [3, 6, 1, 1],
    [3, 9, 1, 1],
  ]);
}

function drawBagas(ctx: CanvasRenderingContext2D, palette: CarPalette, number: number): void {
  drawWheels(ctx, palette);
  drawPixels(ctx, palette.shade, [
    [3, 4, 18, 1],
    [2, 5, 20, 6],
    [3, 11, 18, 1],
    [1, 5, 2, 6],
  ]);
  drawPixels(ctx, palette.body, [
    [4, 4, 16, 1],
    [3, 5, 18, 6],
    [4, 11, 16, 1],
  ]);
  drawPixels(ctx, palette.highlight, [
    [6, 4, 7, 1],
    [20, 5, 1, 1],
  ]);
  drawPixels(ctx, palette.glass, [
    [14, 5, 3, 2],
    [18, 6, 1, 3],
    [14, 9, 3, 2],
    [9, 6, 2, 4],
  ]);
  drawPixels(ctx, palette.stripe, [
    [11, 4, 2, 8],
    [5, 5, 4, 1],
    [16, 10, 5, 1],
  ]);
  drawNumber(ctx, number, 11, 6, '#f5ebd2');
  drawPixels(ctx, '#fff0b0', [
    [21, 5, 1, 1],
    [21, 10, 1, 1],
  ]);
  drawPixels(ctx, '#ff5c43', [
    [2, 6, 1, 1],
    [2, 9, 1, 1],
  ]);
  drawPixels(ctx, palette.wheel, [
    [1, 7, 1, 1],
    [1, 8, 1, 1],
  ]);
}

function drawOkra(ctx: CanvasRenderingContext2D, palette: CarPalette, number: number): void {
  drawWheels(ctx, palette);
  drawPixels(ctx, palette.shade, [
    [4, 3, 17, 1],
    [3, 4, 19, 8],
    [4, 12, 16, 1],
    [2, 5, 2, 6],
  ]);
  drawPixels(ctx, palette.body, [
    [5, 3, 15, 1],
    [4, 4, 17, 7],
    [5, 11, 14, 1],
  ]);
  drawPixels(ctx, palette.glass, [
    [15, 4, 4, 2],
    [19, 5, 1, 5],
    [15, 10, 4, 1],
  ]);
  drawPixels(ctx, palette.highlight, [
    [5, 3, 9, 1],
    [5, 4, 2, 1],
  ]);
  drawPixels(ctx, palette.stripe, [
    [6, 4, 8, 1],
    [6, 11, 8, 1],
    [8, 5, 1, 6],
    [11, 5, 1, 6],
  ]);
  ctx.fillStyle = '#9b7448';
  ctx.fillRect(7, 6, 5, 4);
  ctx.fillStyle = '#c99b5d';
  ctx.fillRect(7, 6, 5, 1);
  ctx.fillStyle = '#715033';
  ctx.fillRect(9, 6, 1, 4);
  drawNumber(ctx, number, 17, 6, '#14232c');
  drawPixels(ctx, '#fff0b0', [
    [21, 5, 1, 1],
    [21, 10, 1, 1],
  ]);
  drawPixels(ctx, '#ff5c43', [
    [2, 5, 1, 1],
    [2, 10, 1, 1],
  ]);
}

function drawKepik(ctx: CanvasRenderingContext2D, palette: CarPalette, number: number): void {
  drawWheels(ctx, palette, true);
  drawPixels(ctx, palette.shade, [
    [6, 4, 13, 1],
    [5, 5, 15, 6],
    [6, 11, 13, 1],
    [10, 3, 5, 1],
  ]);
  drawPixels(ctx, palette.body, [
    [7, 4, 11, 1],
    [6, 5, 13, 5],
    [7, 10, 11, 1],
  ]);
  drawPixels(ctx, palette.highlight, [
    [7, 4, 6, 1],
    [20, 5, 1, 2],
  ]);
  drawPixels(ctx, '#23343b', [
    [8, 6, 8, 3],
    [15, 5, 2, 1],
  ]);
  drawPixels(ctx, palette.stripe, [
    [5, 4, 1, 3],
    [5, 9, 1, 3],
    [19, 4, 1, 3],
    [19, 9, 1, 3],
    [8, 3, 1, 1],
    [17, 3, 1, 1],
    [8, 12, 1, 1],
    [17, 12, 1, 1],
  ]);
  ctx.fillStyle = '#f5ebd2';
  ctx.fillRect(11, 6, 2, 2);
  ctx.fillStyle = palette.body;
  ctx.fillRect(11, 7, 2, 1);
  drawNumber(ctx, number, 17, 7, '#14232c');
  drawPixels(ctx, '#fff0b0', [
    [21, 6, 1, 1],
    [21, 9, 1, 1],
  ]);
}

function drawBaseCar(carId: CarId, palette: CarPalette, number: number): HTMLCanvasElement {
  const canvas = makeCanvas(BASE_WIDTH, BASE_HEIGHT);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;
  if (carId === 'doc' || carId === 'chick' || carId === 'ramone' || carId === 'king') drawBagas(ctx, palette, number);
  else if (carId === 'mater' || carId === 'fillmore') drawOkra(ctx, palette, number);
  else if (carId === 'luigi' || carId === 'guido') drawKepik(ctx, palette, number);
  else drawSirip(ctx, palette, number);
  return canvas;
}

function makeShadow(base: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, (SPRITE_SIZE - BASE_WIDTH) / 2, (SPRITE_SIZE - BASE_HEIGHT) / 2 + 2);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = 'rgba(5, 13, 18, 0.32)';
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return canvas;
}

export function buildCarAtlas(carId: CarId, palette: CarPalette, number: number): CarAtlas {
  const base = drawBaseCar(carId, palette, number);
  const shadowsBase = makeShadow(base);
  const turns: HTMLCanvasElement[] = [];
  const shadows: HTMLCanvasElement[] = [];

  for (let i = 0; i < TURN_COUNT; i += 1) {
    const angle = (i / TURN_COUNT) * Math.PI * 2;
    const canvas = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.imageSmoothingEnabled = false;
    ctx.translate(SPRITE_SIZE / 2, SPRITE_SIZE / 2);
    ctx.rotate(angle);
    ctx.drawImage(base, -BASE_WIDTH / 2, -BASE_HEIGHT / 2);
    turns.push(canvas);

    const shadowCanvas = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
    const shadowCtx = shadowCanvas.getContext('2d') as CanvasRenderingContext2D;
    shadowCtx.imageSmoothingEnabled = false;
    shadowCtx.translate(SPRITE_SIZE / 2, SPRITE_SIZE / 2);
    shadowCtx.rotate(angle);
    shadowCtx.drawImage(shadowsBase, -SPRITE_SIZE / 2, -SPRITE_SIZE / 2);
    shadows.push(shadowCanvas);
  }
  return { turns, shadows };
}

export function buildAtlasForRacers(racers: RacerState[]): Map<string, CarAtlas> {
  const atlases = new Map<string, CarAtlas>();
  for (const racer of racers) {
    atlases.set(racer.id, buildCarAtlas(racer.carId, racer.palette, racer.number));
  }
  return atlases;
}

export function drawCarPreview(
  canvas: HTMLCanvasElement,
  carId: CarId,
  palette: CarPalette,
  number: number,
  scale = 4,
  angle = -0.22,
): void {
  const base = drawBaseCar(carId, palette, number);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rotated = makeCanvas(SPRITE_SIZE, SPRITE_SIZE);
  const rctx = rotated.getContext('2d') as CanvasRenderingContext2D;
  rctx.imageSmoothingEnabled = false;
  rctx.translate(SPRITE_SIZE / 2, SPRITE_SIZE / 2);
  rctx.rotate(angle);
  rctx.drawImage(base, -BASE_WIDTH / 2, -BASE_HEIGHT / 2);
  ctx.drawImage(rotated, 0, 0, SPRITE_SIZE * scale, SPRITE_SIZE * scale);
}

export function getTurnIndex(angle: number): number {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return Math.round((normalized / (Math.PI * 2)) * TURN_COUNT) % TURN_COUNT;
}

export const CAR_SPRITE_SIZE = SPRITE_SIZE;
