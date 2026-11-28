import type { CarId, RaceResults, SaveData, TireId, TrackId } from './types';

/**
 * Level / XP progression.
 *
 * Level is DERIVED from total XP (single source of truth), so it can never disagree with the XP stored in the
 * save. Unlocks are derived from the level (plus any explicit ids in `save.unlocks`), so a lost or merged save
 * can always be recomputed.
 */

export const LEVEL_CAP = 30;
const XP_BASE = 90;
const XP_EXPONENT = 1.45;
export const MAX_XP = 1_000_000;

/** Total XP needed to REACH `level` (level 1 needs 0). */
export function xpForLevel(level: number): number {
  const l = Math.min(LEVEL_CAP, Math.max(1, Math.floor(level)));
  return l <= 1 ? 0 : Math.round(XP_BASE * Math.pow(l - 1, XP_EXPONENT));
}

export function levelFromXp(xp: number): number {
  const safe = Number.isFinite(xp) ? Math.max(0, xp) : 0;
  for (let level = LEVEL_CAP; level > 1; level -= 1) {
    if (safe >= xpForLevel(level)) return level;
  }
  return 1;
}

export interface LevelProgress {
  level: number;
  xp: number;
  levelStartXp: number;
  /** XP needed for the next level, or null at the level cap */
  nextLevelXp: number | null;
  /** 0..1 progress through the current level */
  fraction: number;
  xpIntoLevel: number;
  xpToNext: number | null;
}

export function levelProgress(xp: number): LevelProgress {
  const safe = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  const level = levelFromXp(safe);
  const levelStartXp = xpForLevel(level);
  if (level >= LEVEL_CAP) {
    return { level, xp: safe, levelStartXp, nextLevelXp: null, fraction: 1, xpIntoLevel: safe - levelStartXp, xpToNext: null };
  }
  const nextLevelXp = xpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - levelStartXp);
  return {
    level,
    xp: safe,
    levelStartXp,
    nextLevelXp,
    fraction: Math.min(1, Math.max(0, (safe - levelStartXp) / span)),
    xpIntoLevel: safe - levelStartXp,
    xpToNext: nextLevelXp - safe,
  };
}

// ---------------------------------------------------------------------------
// Unlocks (add tyres / tracks here later: same table, new `kind`)
// ---------------------------------------------------------------------------

export type UnlockKind = 'car' | 'tire' | 'track' | 'feature';

export interface UnlockDef {
  id: string;
  kind: UnlockKind;
  refId: string;
  level: number;
  label: string;
}

export const UNLOCKS: UnlockDef[] = [
  { id: 'car:chick', kind: 'car', refId: 'chick', level: 3, label: 'Chick' },
  { id: 'feature:garage', kind: 'feature', refId: 'garage', level: 3, label: 'Garasi' },
  { id: 'car:mater', kind: 'car', refId: 'mater', level: 5, label: 'Mater' },
  { id: 'tire:grip', kind: 'tire', refId: 'grip', level: 5, label: 'Ban Grip' },
  { id: 'track:pelabuhan', kind: 'track', refId: 'pelabuhan', level: 5, label: 'Sirkuit Pelabuhan' },
  { id: 'car:doc', kind: 'car', refId: 'doc', level: 7, label: 'Doc' },
  { id: 'car:cruz', kind: 'car', refId: 'cruz', level: 9, label: 'Cruz' },
  { id: 'car:francesco', kind: 'car', refId: 'francesco', level: 10, label: 'Francesco' },
  { id: 'tire:rain', kind: 'tire', refId: 'rain', level: 10, label: 'Ban Hujan' },
  { id: 'car:storm', kind: 'car', refId: 'storm', level: 12, label: 'Storm' },
  { id: 'track:rimba-lumpur', kind: 'track', refId: 'rimba-lumpur', level: 14, label: 'Rimba Lumpur' },
  { id: 'tire:terrain', kind: 'tire', refId: 'terrain', level: 14, label: 'Ban Tanah' },
  { id: 'car:ramone', kind: 'car', refId: 'ramone', level: 15, label: 'Ramone' },
  { id: 'car:fillmore', kind: 'car', refId: 'fillmore', level: 17, label: 'Fillmore' },
  { id: 'car:finn', kind: 'car', refId: 'finn', level: 19, label: 'Finn' },
  { id: 'car:shu', kind: 'car', refId: 'shu', level: 21, label: 'Shu' },
  { id: 'car:king', kind: 'car', refId: 'king', level: 24, label: 'King' },
];

export function carUnlockDef(carId: CarId): UnlockDef | null {
  return UNLOCKS.find((item) => item.kind === 'car' && item.refId === carId) ?? null;
}

export function isCarUnlocked(carId: CarId, save: Pick<SaveData, 'xp' | 'unlocks'>): boolean {
  const def = carUnlockDef(carId);
  if (!def) return true; // free car
  if (save.unlocks?.includes(def.id)) return true;
  return levelFromXp(save.xp ?? 0) >= def.level;
}

export function tireUnlockDef(tireId: TireId): UnlockDef | null {
  return UNLOCKS.find((item) => item.kind === 'tire' && item.refId === tireId) ?? null;
}

export function isTireUnlocked(tireId: TireId, save: Pick<SaveData, 'xp' | 'unlocks'>): boolean {
  const def = tireUnlockDef(tireId);
  if (!def) return true; // the standard tyre is always available
  if (save.unlocks?.includes(def.id)) return true;
  return levelFromXp(save.xp ?? 0) >= def.level;
}

export function trackUnlockDef(trackId: TrackId): UnlockDef | null {
  return UNLOCKS.find((item) => item.kind === 'track' && item.refId === trackId) ?? null;
}

export function isTrackUnlocked(trackId: TrackId, save: Pick<SaveData, 'xp' | 'unlocks'>): boolean {
  const def = trackUnlockDef(trackId);
  if (!def) return true;
  if (save.unlocks?.includes(def.id)) return true;
  return levelFromXp(save.xp ?? 0) >= def.level;
}

export function garageUnlockDef(): UnlockDef | null {
  return UNLOCKS.find((item) => item.kind === 'feature' && item.refId === 'garage') ?? null;
}

export function isGarageUnlocked(save: Pick<SaveData, 'xp' | 'unlocks'>): boolean {
  const def = garageUnlockDef();
  if (!def) return true;
  if (save.unlocks?.includes(def.id)) return true;
  return levelFromXp(save.xp ?? 0) >= def.level;
}

/** Unlocks gained by going from `levelBefore` up to `levelAfter`. */
export function unlocksBetween(levelBefore: number, levelAfter: number): UnlockDef[] {
  // listed in the order the player earned them
  return UNLOCKS.filter((item) => item.level > levelBefore && item.level <= levelAfter).sort((a, b) => a.level - b.level);
}

// ---------------------------------------------------------------------------
// XP rewards
// ---------------------------------------------------------------------------

export interface XpRow {
  id: string;
  label: string;
  xp: number;
}

export interface XpAward {
  rows: XpRow[];
  total: number;
}

const FINISH_XP = 25;
const POSITION_XP = [100, 70, 50, 35, 25, 15];
const DRIFT_XP_PER_SECOND = 2;
const DRIFT_XP_CAP = 40;
const CLEAN_LAP_XP = 15;
const RECORD_XP = 25;
const WEATHER_XP = { rain: 20, dynamic: 15 } as const;

/** Pure function: what a finished race is worth. Returns zero if the player did not finish. */
export function computeRaceXp(results: RaceResults): XpAward {
  const player = results.results.find((row) => row.isPlayer);
  if (!player || player.timeMs == null) return { rows: [], total: 0 };

  const rows: XpRow[] = [{ id: 'finish', label: 'Finis balapan', xp: FINISH_XP }];

  // Placing only counts against real opponents: a lone player gets no position XP.
  const fieldSize = results.results.length;
  if (fieldSize >= 2) {
    const fieldFactor = Math.min(1, 0.5 + (fieldSize - 2) * 0.17);
    const base = POSITION_XP[results.playerPosition - 1] ?? 10;
    const xp = Math.round(base * fieldFactor);
    if (xp > 0) rows.push({ id: 'position', label: `Posisi P${results.playerPosition}`, xp });
  }

  const stats = results.stats;
  if (stats) {
    const drift = Math.min(DRIFT_XP_CAP, Math.floor(stats.driftSeconds * DRIFT_XP_PER_SECOND));
    if (drift > 0) rows.push({ id: 'drift', label: 'Drift terkendali', xp: drift });
    if (stats.cleanLaps > 0) {
      rows.push({ id: 'clean', label: `Putaran bersih x${stats.cleanLaps}`, xp: stats.cleanLaps * CLEAN_LAP_XP });
    }
  }
  if (results.isNewRecord) rows.push({ id: 'record', label: 'Rekor putaran baru', xp: RECORD_XP });
  if (results.weather === 'rain' || results.weather === 'dynamic') {
    rows.push({ id: 'weather', label: 'Bonus cuaca', xp: WEATHER_XP[results.weather] });
  }

  return { rows, total: rows.reduce((sum, row) => sum + row.xp, 0) };
}

export interface CosmeticUnlockItem {
  kind: 'rim' | 'glass' | 'accessory';
  label: string;
}

export interface CosmeticUnlockSummary {
  carId: CarId;
  items: CosmeticUnlockItem[];
}

export interface XpReport {
  award: XpAward;
  xpBefore: number;
  xpAfter: number;
  levelBefore: number;
  levelAfter: number;
  unlocked: UnlockDef[];
  cosmeticUnlocks?: CosmeticUnlockSummary | null;
}

/** Applies an award to a save. Returns the new save plus a report for the results screen. */
export function applyXp(save: SaveData, award: XpAward): { save: SaveData; report: XpReport } {
  const xpBefore = Math.min(MAX_XP, Math.max(0, Math.floor(save.xp ?? 0)));
  const xpAfter = Math.min(MAX_XP, xpBefore + award.total);
  const levelBefore = levelFromXp(xpBefore);
  const levelAfter = levelFromXp(xpAfter);
  const nextSave: SaveData = xpAfter > 0 ? { ...save, xp: xpAfter } : { ...save };
  return {
    save: nextSave,
    report: { award, xpBefore, xpAfter, levelBefore, levelAfter, unlocked: unlocksBetween(levelBefore, levelAfter) },
  };
}
