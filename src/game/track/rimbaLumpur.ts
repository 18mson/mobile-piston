import type { Track } from '../types';
import { buildTrack } from './geometry';

export const RIMBA_ROAD_WIDTH = 160;
export const RIMBA_SHOULDER_WIDTH = 22;

type P = { x: number; y: number };

/**
 * SIRKUIT RIMBA LUMPUR - a very long jungle circuit (about twice the length of the other tracks).
 * The road snakes back and forth through the forest: four long passes joined by three wide hairpins,
 * then a return run down the west edge. It mixes surfaces on purpose:
 *   - dirt sections (less grip, more drag; the Terrain tyre copes best), one of them running through a hairpin
 *   - puddles of different sizes (aquaplaning and splash drag; the Rain tyre copes best). Some sit at one side of
 *     the road so there is a dry line, one is a full-width ford, and two are mud puddles on a dirt road.
 */

// Lane centre lines (y) and hairpin geometry. The world is 2400 x 1600.
const Y1 = 1400; // start pass, heading east
const Y2 = 1000; // heading west
const Y3 = 600; // heading east
const Y4 = 200; // heading west
const EAST_X = 2050; // centre x of the two east hairpins
const WEST_X = 680; // centre x of the west hairpin
const HAIRPIN_R = 200;
const CORNER_R = 150;
const COLUMN_X = 150; // return run along the west edge

/** Smooth bump used to bend the straights: +amp at `c`, fading out over `w` */
function bump(x: number, c: number, w: number, amp: number): number {
  const t = (x - c) / w;
  return amp * Math.exp(-t * t);
}

/** Lateral wiggles (world y offsets) of each pass, chosen so neighbouring lanes never come closer than ~300 */
function wiggle1(x: number): number {
  return bump(x, 1180, 150, -46) + bump(x, 1420, 120, 52) + bump(x, 1000, 60, 0);
}
function wiggle2(x: number): number {
  return bump(x, 1560, 140, 44) + bump(x, 1180, 120, -48) + bump(x, 880, 110, 34);
}
function wiggle3(x: number): number {
  return bump(x, 980, 100, -44) + bump(x, 1210, 90, 38) + bump(x, 1700, 160, -38);
}
function wiggle4(x: number): number {
  return bump(x, 1700, 130, 40) + bump(x, 1180, 150, -36) + bump(x, 780, 110, 40);
}

function straightX(from: number, to: number, y: number, wig: (x: number) => number, step = 64): P[] {
  const out: P[] = [];
  const dir = Math.sign(to - from);
  const count = Math.max(1, Math.round(Math.abs(to - from) / step));
  for (let i = 0; i < count; i += 1) {
    const x = from + ((to - from) * i) / count;
    // fade the wiggle out at both ends so it joins the hairpins on the lane centre line
    const fade = Math.min(1, Math.abs(x - from) / 120, Math.abs(to - x) / 120);
    out.push({ x, y: y + wig(x) * fade });
  }
  void dir;
  return out;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number, step = 0.28): P[] {
  const out: P[] = [];
  const count = Math.max(2, Math.round(Math.abs(a1 - a0) / step));
  for (let i = 0; i < count; i += 1) {
    const a = a0 + ((a1 - a0) * i) / count;
    out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return out;
}

function buildPoints(): P[] {
  const pts: P[] = [];
  // pass 1: east along the bottom (start / finish straight)
  pts.push(...straightX(CORNER_R * 2, EAST_X, Y1, wiggle1));
  // east hairpin 1 (bottom -> pass 2), radius 200
  pts.push(...arc(EAST_X, (Y1 + Y2) / 2, HAIRPIN_R, Math.PI / 2, -Math.PI / 2));
  // pass 2: west
  pts.push(...straightX(EAST_X, WEST_X, Y2, wiggle2));
  // west hairpin (pass 2 -> pass 3)
  pts.push(...arc(WEST_X, (Y2 + Y3) / 2, HAIRPIN_R, Math.PI / 2, (3 * Math.PI) / 2));
  // pass 3: east
  pts.push(...straightX(WEST_X, EAST_X, Y3, wiggle3));
  // east hairpin 2 (pass 3 -> pass 4)
  pts.push(...arc(EAST_X, (Y3 + Y4) / 2, HAIRPIN_R, Math.PI / 2, -Math.PI / 2));
  // pass 4: west, all the way to the corner
  pts.push(...straightX(EAST_X, CORNER_R * 2, Y4, wiggle4));
  // corner down into the return run
  pts.push(...arc(CORNER_R * 2, Y4 + CORNER_R, CORNER_R, -Math.PI / 2, -Math.PI));
  // return run along the west edge (gentle kinks)
  const top = Y4 + CORNER_R;
  const bottom = Y1 - CORNER_R;
  const steps = Math.round((bottom - top) / 70);
  for (let i = 0; i < steps; i += 1) {
    const y = top + ((bottom - top) * i) / steps;
    const kink = bump(y, 560, 90, 26) + bump(y, 900, 100, -22) + bump(y, 1130, 70, 18);
    pts.push({ x: COLUMN_X + kink, y });
  }
  // corner back onto the start pass
  pts.push(...arc(CORNER_R * 2, Y1 - CORNER_R, CORNER_R, Math.PI, Math.PI / 2));
  return pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

export const RIMBA_LUMPUR: Track = buildTrack({
  id: 'rimba-lumpur',
  theme: 'wetland',
  name: 'RIMBA LUMPUR',
  subtitle:
    'Dua kali lebih panjang dari sirkuit biasa. Jalan aspal, tanah berlumpur, dan genangan air bergantian menembus hutan.',
  worldWidth: 2400,
  worldHeight: 1600,
  width: RIMBA_ROAD_WIDTH,
  shoulder: RIMBA_SHOULDER_WIDTH,
  points: buildPoints(),
  startPoint: { x: 760, y: Y1 },
  startHeading: 0,
  attract: { fraction: 0.05, offsetX: 34, offsetY: -104 },
  gridSlots: [
    { distance: -44, lateral: -26 },
    { distance: -44, lateral: 26 },
    { distance: -80, lateral: -26 },
    { distance: -80, lateral: 26 },
    { distance: -116, lateral: -26 },
    { distance: -116, lateral: 26 },
    { distance: -152, lateral: -26 },
    { distance: -152, lateral: 26 },
  ],
  boostPadFractions: [],
  boostPadAnchors: [
    { x: 1050, y: Y1, lateral: 0, length: 44 }, // start straight
    { x: 1500, y: Y3, lateral: -18, length: 44 }, // before the muddy road on pass 3
    { x: 1900, y: Y4, lateral: 18, length: 44 }, // before the ford on pass 4
    { x: COLUMN_X, y: 760, lateral: 0, length: 44 }, // return run
  ],
  surfaces: [
    // --- start pass + east hairpin 1: dirt all through the bend
    { kind: 'dirt', from: { x: 1560, y: Y1 }, to: { x: EAST_X, y: Y2 } },
    // --- pass 2: three puddles, each on a different side of the road, then dirt into the west hairpin
    { kind: 'puddle', from: { x: 1860, y: Y2 }, to: { x: 1620, y: Y2 }, lateral: -42, halfWidth: 54 },
    { kind: 'puddle', from: { x: 1500, y: Y2 }, to: { x: 1230, y: Y2 }, lateral: 44, halfWidth: 60 },
    { kind: 'puddle', from: { x: 1120, y: Y2 }, to: { x: 930, y: Y2 }, lateral: -6, halfWidth: 50 },
    { kind: 'dirt', from: { x: 880, y: Y2 }, to: { x: WEST_X - HAIRPIN_R, y: (Y2 + Y3) / 2 } },
    // --- pass 3: muddy road with two mud puddles
    { kind: 'dirt', from: { x: 1240, y: Y3 }, to: { x: 1900, y: Y3 } },
    { kind: 'puddle', from: { x: 1370, y: Y3 }, to: { x: 1560, y: Y3 }, lateral: 0, halfWidth: 70 },
    { kind: 'puddle', from: { x: 1640, y: Y3 }, to: { x: 1790, y: Y3 }, lateral: 40, halfWidth: 52 },
    // --- pass 4: full-width ford, then a long dirt run into the corner
    { kind: 'puddle', from: { x: 1480, y: Y4 }, to: { x: 1200, y: Y4 }, lateral: 0, halfWidth: 100 },
    { kind: 'dirt', from: { x: 1020, y: Y4 }, to: { x: 520, y: Y4 } },
    // --- return run: puddles at the edges
    { kind: 'puddle', from: { x: COLUMN_X, y: 640 }, to: { x: COLUMN_X, y: 840 }, lateral: 36, halfWidth: 48 },
    { kind: 'puddle', from: { x: COLUMN_X, y: 980 }, to: { x: COLUMN_X, y: 1150 }, lateral: -34, halfWidth: 46 },
  ],
});
