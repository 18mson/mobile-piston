export type CarId = 'sirip' | 'bagas' | 'okra' | 'kepik';
export type TrackId = 'teluk-sore' | 'mata-air';

export type ScreenName = 'loading' | 'title' | 'garage' | 'racing' | 'paused' | 'results' | 'error';

export interface CarStats {
  topSpeed: number;
  acceleration: number;
  grip: number;
  steerRate: number;
  nitroBoost: number;
  nitroAcceleration: number;
  mass: number;
}

export interface CarPalette {
  body: string;
  shade: string;
  highlight: string;
  stripe: string;
  glass: string;
  wheel: string;
}

export interface CarSpec {
  id: CarId;
  name: string;
  kind: string;
  blurb: string;
  stats: CarStats;
  palette: CarPalette;
}

export interface RacerConfig {
  id: string;
  label: string;
  carId: CarId;
  number: number;
  isPlayer: boolean;
  palette: CarPalette;
  skill: number;
}

export interface TrackSample {
  x: number;
  y: number;
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  dist: number;
}

export interface BoostPad {
  distance: number;
  lateral: number;
  length: number;
}

export interface Track {
  id: TrackId;
  name: string;
  subtitle: string;
  width: number;
  shoulder: number;
  worldWidth: number;
  worldHeight: number;
  samples: TrackSample[];
  length: number;
  startPoint: { x: number; y: number };
  startHeading: number;
  boostPads: BoostPad[];
  gridSlots: { distance: number; lateral: number }[];
  attract: { fraction: number; offsetX: number; offsetY: number };
  light: { color: string; alpha: number } | null;
}

export interface PlayerInput {
  steer: number;
  brake: boolean;
  nitro: boolean;
  pause: boolean;
}

export interface RacerState {
  id: string;
  label: string;
  carId: CarId;
  number: number;
  isPlayer: boolean;
  palette: CarPalette;
  skill: number;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  steer: number;
  nitro: number;
  nitroActive: boolean;
  drifting: boolean;
  lap: number;
  s: number;
  progress: number;
  startedLap: boolean;
  passedHalf: boolean;
  finished: boolean;
  finishTime: number | null;
  lapStartTime: number;
  bestLapMs: number | null;
  lastLapMs: number | null;
  lapTimes: number[];
  stuckTime: number;
  impact: number;
  padCooldown: number;
}

export interface RaceSnapshot {
  mode: 'attract' | 'countdown' | 'racing' | 'finished';
  countdown: number | null;
  time: number;
  laps: number;
  lap: number;
  position: number;
  totalRacers: number;
  nitro: number;
  speed: number;
  bestLapMs: number | null;
  lastLapMs: number | null;
  playerFinished: boolean;
  racers: {
    id: string;
    number: number;
    isPlayer: boolean;
    lap: number;
    position: number;
    finished: boolean;
    finishTime: number | null;
    x: number;
    y: number;
    s: number;
  }[];
}

export interface RaceResult {
  id: string;
  label: string;
  carId: CarId;
  number: number;
  isPlayer: boolean;
  position: number;
  timeMs: number | null;
  bestLapMs: number | null;
}

export interface RaceResults {
  results: RaceResult[];
  playerPosition: number;
  playerBestLapMs: number | null;
  previousBestLapMs: number | null;
  isNewRecord: boolean;
  totalTimeMs: number;
}

export interface SaveData {
  version: 2;
  selectedCarId: CarId;
  selectedTrackId: TrackId;
  bestLapMs: Partial<Record<string, number>>;
  audioMuted: boolean;
}

export interface HudUpdate {
  screen: 'countdown' | 'racing';
  snapshot: RaceSnapshot;
}
