import type { Track } from '../types';
import { clamp } from '../utils';

export const RENDER_WIDTH = 960;
export const RENDER_HEIGHT = 540;
export const WORLD_SCALE = 0.25;
export const WORLD_CENTER_X = 1200;
export const WORLD_CENTER_Y = 800;
export const TERRAIN_Y = 1.22;
export const ROAD_Y = 1.32;
export const POND = { x: 1120, y: 1062, rx: 128, ry: 46 };

export function toSceneX(worldX: number): number {
  return (worldX - WORLD_CENTER_X) * WORLD_SCALE;
}

export function toSceneZ(worldY: number): number {
  return (worldY - WORLD_CENTER_Y) * WORLD_SCALE;
}

export function toWorldX(sceneX: number): number {
  return sceneX / WORLD_SCALE + WORLD_CENTER_X;
}

export function worldToScene(worldX: number, worldY: number): { x: number; z: number } {
  return { x: toSceneX(worldX), z: toSceneZ(worldY) };
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function coastYAt(x: number, coastline: { x: number; y: number }[]): number {
  if (x <= coastline[0].x) return coastline[0].y;
  for (let i = 1; i < coastline.length; i += 1) {
    const a = coastline[i - 1];
    const b = coastline[i];
    if (x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
  }
  return coastline[coastline.length - 1].y;
}

export function terrainHeightAt(
  track: Track,
  coastline: { x: number; y: number }[],
  worldX: number,
  worldY: number,
): { height: number; kind: 'sea' | 'sand' | 'grass' | 'rock' | 'pond'; trackDistance: number } {
  const roadClear = track.width / 2 + track.shoulder + 22;

  if (track.theme === 'highland') {
    // Mountain slopes: no sea, no pond. Flat corridor around the road, rolling ridges further out.
    const distance = Math.min(9999, nearestDistance(track, worldX, worldY));
    const bank = smoothstep(roadClear, roadClear + 40, distance) * 0.8;
    const flat = 1 - smoothstep(roadClear + 36, roadClear + 185, distance);
    const ridges =
      (Math.sin(worldX * 0.009) * 0.7 +
        Math.sin(worldY * 0.011 + 1.1) * 0.5 +
        Math.sin((worldX + worldY) * 0.005) * 0.5 +
        Math.sin(worldX * 0.021 - worldY * 0.017) * 0.18 +
        1.2) *
      7.2;
    const edgeRise = smoothstep(180, 420, Math.min(worldX, 2400 - worldX, worldY, 1600 - worldY) * -1 + 420) * 5;
    let height = 0.6 + bank + ridges * (1 - flat) + edgeRise;
    if (distance < roadClear) height = Math.min(height, ROAD_Y - 0.14);
    return { height, kind: height > 11.5 ? 'rock' : 'grass', trackDistance: distance };
  }
  if (track.theme === 'wetland') {
    // Jungle flats: low, gently rolling ground between the lanes (so the road stays visible),
    // a raised tree-line berm around the edge of the map. No sea, no pond.
    const distance = Math.min(9999, nearestDistance(track, worldX, worldY));
    const bank = smoothstep(roadClear, roadClear + 40, distance) * 0.55;
    const rise = smoothstep(roadClear + 40, roadClear + 225, distance);
    const rolling =
      (Math.sin(worldX * 0.008) * 0.5 + Math.sin(worldY * 0.011 + 0.8) * 0.4 + Math.sin((worldX - worldY) * 0.006) * 0.35 + 1.2) *
      1.5;
    const edge = Math.min(worldX, 2400 - worldX, worldY, 1600 - worldY);
    const edgeRise = smoothstep(150, 20, edge) * 5.5;
    let height = 0.55 + bank + rolling * rise + edgeRise;
    if (distance < roadClear) height = Math.min(height, ROAD_Y - 0.14);
    return { height, kind: 'grass', trackDistance: distance };
  }
  const coast = coastYAt(worldX, coastline);
  if (worldY < coast - 2) {
    return { height: -1.4, kind: 'sea', trackDistance: 9999 };
  }
  const pondX = (worldX - POND.x) / POND.rx;
  const pondY = (worldY - POND.y) / POND.ry;
  const pondDistance = pondX * pondX + pondY * pondY;
  const shore = smoothstep(0, 34, worldY - coast);
  let height = -0.7 + shore * 1.93;
  let kind: 'sand' | 'grass' | 'rock' | 'pond' = 'sand';

  const trackDistance = Math.min(9999, nearestDistance(track, worldX, worldY));
  if (pondDistance < 1.55) {
    const blend = smoothstep(1.55, 0.9, pondDistance);
    height = height * (1 - blend) + (-0.25 * blend);
    kind = 'pond';
  } else {
    const bank = smoothstep(roadClear, roadClear + 36, trackDistance) * 0.75;
    const flat = 1 - smoothstep(roadClear + 32, roadClear + 150, trackDistance);
    const hillMask = 1 - flat;
    const hill =
      (Math.sin(worldX * 0.012) * 0.62 +
        Math.sin(worldY * 0.016 + 1.4) * 0.34 +
        Math.sin((worldX + worldY) * 0.006) * 0.44 +
        0.72) *
      4.2;
    height += bank + hill * hillMask;
    if (trackDistance < roadClear) height = Math.min(height, ROAD_Y - 0.14);
    kind = height > 6.6 ? 'rock' : worldY - coast < 26 ? 'sand' : 'grass';
  }
  return { height, kind, trackDistance };
}

let scratchTrack: Track | null = null;
function nearestDistance(track: Track, x: number, y: number): number {
  if (scratchTrack !== track) scratchTrack = track;
  const samples = track.samples;
  const length = samples.length;
  let best = Number.POSITIVE_INFINITY;
  let bestIdx = 0;

  for (let i = 0; i < length; i += 1) {
    const dx = x - samples[i].x;
    const dy = y - samples[i].y;
    const d = dx * dx + dy * dy;
    if (d < best) {
      best = d;
      bestIdx = i;
    }
  }

  // Exact segment projection to prevent discretization inaccuracies across curves
  let exactBest = Math.sqrt(best);
  for (const startIdx of [bestIdx - 1, bestIdx]) {
    const a = samples[(startIdx + length) % length];
    const b = samples[(startIdx + 1) % length];
    const segX = b.x - a.x;
    const segY = b.y - a.y;
    const segLenSq = segX * segX + segY * segY || 1;
    const t = clamp(((x - a.x) * segX + (y - a.y) * segY) / segLenSq, 0, 1);
    const px = a.x + segX * t;
    const py = a.y + segY * t;
    const dist = Math.hypot(x - px, y - py);
    if (dist < exactBest) {
      exactBest = dist;
    }
  }

  return exactBest;
}
