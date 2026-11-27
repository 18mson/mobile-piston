import type { SurfaceKind, SurfaceZone, Track, TrackId, TrackSample, TrackTheme } from '../types';
import { clamp, mod } from '../utils';

interface Vec2 {
  x: number;
  y: number;
}

export interface TrackHit {
  s: number;
  distance: number;
  side: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  index: number;
}

export interface TrackPoint {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  index: number;
}

export interface BuildTrackOptions {
  id: TrackId;
  name: string;
  subtitle: string;
  theme?: TrackTheme;
  worldWidth: number;
  worldHeight: number;
  width: number;
  shoulder: number;
  points: Vec2[];
  startPoint: Vec2;
  startHeading: number;
  gridSlots: { distance: number; lateral: number }[];
  boostPadFractions: { fraction: number; lateral: number; length: number }[];
  /** Boost pads placed by world position (resolved to the nearest point of the road) */
  boostPadAnchors?: { x: number; y: number; lateral: number; length: number }[];
  /**
   * Dirt sections and puddles, placed by world position: `from`/`to` are points on (or next to) the road,
   * in driving direction. Puddles use the middle of the range as their centre.
   */
  surfaces?: {
    kind: SurfaceKind;
    from: Vec2;
    to: Vec2;
    lateral?: number;
    halfWidth?: number;
  }[];
  attract: { fraction: number; offsetX: number; offsetY: number };
  light?: { color: string; alpha: number } | null;
}

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

function pointDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function buildTrack(options: BuildTrackOptions): Track {
  const points = options.points;
  const stepsPerSegment = 72;
  const raw: Vec2[] = [];

  for (let i = 0; i < points.length; i += 1) {
    const p0 = points[(i - 1 + points.length) % points.length];
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p3 = points[(i + 2) % points.length];
    for (let step = 0; step < stepsPerSegment; step += 1) {
      raw.push(catmullRom(p0, p1, p2, p3, step / stepsPerSegment));
    }
  }

  const rawDistances: number[] = [0];
  for (let i = 1; i <= raw.length; i += 1) {
    const previous = raw[i - 1];
    const current = raw[i % raw.length];
    rawDistances.push(rawDistances[i - 1] + pointDistance(previous, current));
  }
  const totalLength = rawDistances[raw.length];
  const spacing = 4;
  const sampleCount = Math.max(160, Math.round(totalLength / spacing));
  const uniformStep = totalLength / sampleCount;
  const resampled: Vec2[] = [];

  let segment = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const target = i * uniformStep;
    while (segment < raw.length - 1 && rawDistances[segment + 1] < target) segment += 1;
    const startDistance = rawDistances[segment];
    const endDistance = rawDistances[segment + 1];
    const t = endDistance === startDistance ? 0 : (target - startDistance) / (endDistance - startDistance);
    const a = raw[segment];
    const b = raw[(segment + 1) % raw.length];
    resampled.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }

  let startIndex = 0;
  let closest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < resampled.length; i += 1) {
    const d = pointDistance(resampled[i], options.startPoint);
    if (d < closest) {
      closest = d;
      startIndex = i;
    }
  }

  let ordered = [...resampled.slice(startIndex), ...resampled.slice(0, startIndex)];
  const headingA = ordered[0];
  const headingB = ordered[1];
  const rawHeading = Math.atan2(headingB.y - headingA.y, headingB.x - headingA.x);
  const wantsReverse =
    Math.cos(rawHeading - options.startHeading) < 0;
  if (wantsReverse) ordered = [ordered[0], ...ordered.slice(1).reverse()];

  const samples: TrackSample[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const previous = ordered[(i - 1 + ordered.length) % ordered.length];
    const next = ordered[(i + 1) % ordered.length];
    const txRaw = next.x - previous.x;
    const tyRaw = next.y - previous.y;
    const magnitude = Math.hypot(txRaw, tyRaw) || 1;
    const tx = txRaw / magnitude;
    const ty = tyRaw / magnitude;
    samples.push({
      x: ordered[i].x,
      y: ordered[i].y,
      tx,
      ty,
      nx: -ty,
      ny: tx,
      dist: i * uniformStep,
    });
  }

  const length = samples.length * uniformStep;
  const distanceOf = (point: Vec2): number => {
    let best = Number.POSITIVE_INFINITY;
    let bestDist = 0;
    for (const sample of samples) {
      const d = (sample.x - point.x) ** 2 + (sample.y - point.y) ** 2;
      if (d < best) {
        best = d;
        bestDist = sample.dist;
      }
    }
    return bestDist;
  };
  const surfaces: SurfaceZone[] = (options.surfaces ?? []).map((zone) => {
    const a = distanceOf(zone.from);
    const b = distanceOf(zone.to);
    return {
      kind: zone.kind,
      start: a,
      length: Math.max(8, mod(b - a, length)),
      lateral: zone.lateral ?? 0,
      halfWidth: zone.halfWidth ?? options.width / 2 + options.shoulder,
    };
  });
  const track: Track = {
    id: options.id,
    theme: options.theme ?? 'coast',
    name: options.name,
    subtitle: options.subtitle,
    width: options.width,
    shoulder: options.shoulder,
    worldWidth: options.worldWidth,
    worldHeight: options.worldHeight,
    samples,
    length,
    startPoint: { x: samples[0].x, y: samples[0].y },
    startHeading: Math.atan2(samples[0].ty, samples[0].tx),
    boostPads: [
      ...options.boostPadFractions.map((pad) => ({
        distance: pad.fraction * length,
        lateral: pad.lateral,
        length: pad.length,
      })),
      ...(options.boostPadAnchors ?? []).map((pad) => ({
        distance: distanceOf(pad),
        lateral: pad.lateral,
        length: pad.length,
      })),
    ],
    ...(surfaces.length > 0 ? { surfaces } : {}),
    gridSlots: options.gridSlots,
    attract: options.attract,
    light: options.light ?? null,
  };

  return track;
}

export function sampleAtDistance(track: Track, distance: number): TrackPoint {
  const s = mod(distance, track.length);
  const step = track.length / track.samples.length;
  const index = Math.floor(s / step) % track.samples.length;
  const nextIndex = (index + 1) % track.samples.length;
  const current = track.samples[index];
  const next = track.samples[nextIndex];
  const local = (s - current.dist) / step;
  const txRaw = current.tx + (next.tx - current.tx) * local;
  const tyRaw = current.ty + (next.ty - current.ty) * local;
  const magnitude = Math.hypot(txRaw, tyRaw) || 1;
  const tx = txRaw / magnitude;
  const ty = tyRaw / magnitude;
  return {
    x: current.x + (next.x - current.x) * local,
    y: current.y + (next.y - current.y) * local,
    tx,
    ty,
    nx: -ty,
    ny: tx,
    index,
  };
}

export function pointAtDistance(track: Track, distance: number, lateral = 0): Vec2 {
  const point = sampleAtDistance(track, distance);
  return { x: point.x + point.nx * lateral, y: point.y + point.ny * lateral };
}

export function nearestOnTrack(track: Track, x: number, y: number): TrackHit {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < track.samples.length; i += 1) {
    const sample = track.samples[i];
    const dx = x - sample.x;
    const dy = y - sample.y;
    const d = dx * dx + dy * dy;
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }

  let best: TrackHit | null = null;
  const length = track.samples.length;
  for (const startIndex of [bestIndex - 1, bestIndex]) {
    const a = track.samples[(startIndex + length) % length];
    const b = track.samples[(startIndex + 1) % length];
    const segX = b.x - a.x;
    const segY = b.y - a.y;
    const segLengthSq = segX * segX + segY * segY || 1;
    const t = clamp(((x - a.x) * segX + (y - a.y) * segY) / segLengthSq, 0, 1);
    const px = a.x + segX * t;
    const py = a.y + segY * t;
    const distance = Math.hypot(x - px, y - py);
    if (best == null || distance < best.distance) {
      const segLength = Math.sqrt(segLengthSq);
      const tx = segX / segLength;
      const ty = segY / segLength;
      const nx = -ty;
      const ny = tx;
      const side = (x - px) * nx + (y - py) * ny;
      const sampleStep = track.length / track.samples.length;
      const s = a.dist + t * sampleStep;
      best = {
        s,
        distance,
        side,
        x: px,
        y: py,
        tx,
        ty,
        nx,
        ny,
        index: (startIndex + length) % length,
      };
    }
  }

  return best as TrackHit;
}

/** How much of each special surface is under a point of the road (0..1): `s` along the track, `side` = lateral offset. */
export function surfaceAt(track: Track, s: number, side: number, wetness = 0): { dirt: number; puddle: number } {
  let dirt = 0;
  let puddle = 0;
  const zones = track.surfaces;
  if (!zones) return { dirt, puddle };
  const puddleScale = 0.42 + 0.58 * clamp(wetness, 0, 1);
  for (const zone of zones) {
    const rel = mod(s - zone.start, track.length);
    if (rel > zone.length) continue;
    if (zone.kind === 'dirt') {
      // soft edges so the road does not change grip like a switch
      const edge = clamp(Math.min(rel, zone.length - rel) / 26, 0, 1);
      dirt = Math.max(dirt, edge * edge * (3 - 2 * edge));
    } else {
      const u = (rel - zone.length / 2) / ((zone.length / 2) * puddleScale);
      const v = (side - zone.lateral) / (zone.halfWidth * puddleScale);
      const e = u * u + v * v;
      if (e < 1) puddle = Math.max(puddle, clamp((1 - e) * 2.4, 0, 1));
    }
  }
  return { dirt, puddle };
}

export function curvatureAt(track: Track, distance: number, lookAhead = 48): number {
  const a = sampleAtDistance(track, distance);
  const b = sampleAtDistance(track, distance + lookAhead);
  const angleA = Math.atan2(a.ty, a.tx);
  const angleB = Math.atan2(b.ty, b.tx);
  let delta = angleB - angleA;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta / lookAhead;
}
