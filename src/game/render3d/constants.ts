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
    const bank = smoothstep(60, 92, trackDistance) * 0.75;
    const flat = 1 - smoothstep(88, 205, trackDistance);
    const hillMask = 1 - flat;
    const hill =
      (Math.sin(worldX * 0.012) * 0.62 +
        Math.sin(worldY * 0.016 + 1.4) * 0.34 +
        Math.sin((worldX + worldY) * 0.006) * 0.44 +
        0.72) *
      4.2;
    height += bank + hill * hillMask;
    kind = height > 6.6 ? 'rock' : worldY - coast < 26 ? 'sand' : 'grass';
  }
  return { height, kind, trackDistance };
}

let scratchTrack: Track | null = null;
function nearestDistance(track: Track, x: number, y: number): number {
  if (scratchTrack !== track) scratchTrack = track;
  const samples = track.samples;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < samples.length; i += 1) {
    const dx = x - samples[i].x;
    const dy = y - samples[i].y;
    const distance = dx * dx + dy * dy;
    if (distance < best) best = distance;
  }
  return Math.sqrt(best);
}
