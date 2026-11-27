export type CarId =
  | 'mcqueen'
  | 'luigi'
  | 'guido'
  | 'sally'
  | 'chick'
  | 'mater'
  | 'doc'
  | 'cruz'
  | 'francesco'
  | 'storm';
export type TrackId = 'teluk-sore' | 'mata-air' | 'lereng-kopi' | 'pelabuhan';
export type TrackTheme = 'coast' | 'highland';
export type TireId = 'standard' | 'grip' | 'rain' | 'terrain';
export type WeatherMode = 'clear' | 'rain' | 'dynamic';

export type ScreenName = 'loading' | 'title' | 'garage' | 'racing' | 'paused' | 'results' | 'error';

export interface CarStats {
  topSpeed: number;
  acceleration: number;
  grip: number;
  steerRate: number;
  nitroBoost: number;
  nitroAcceleration: number;
  mass: number;
  rearGrip?: number;
  driftBoost?: number;
  slideAssist?: number;
}

export interface CarPalette {
  body: string;
  shade: string;
  highlight: string;
  stripe: string;
  glass: string;
  wheel: string;
}

export interface CarCollision {
  radius: number;
  axleOffset: number;
  circleRadius: number;
}

export interface CarSpec {
  id: CarId;
  name: string;
  kind: string;
  blurb: string;
  number?: number;
  stats: CarStats;
  collision?: CarCollision;
  palette: CarPalette;
}

export interface RacerConfig {
  id: string;
  label: string;
  carId: CarId;
  number: number;
  isPlayer: boolean;
  isHuman?: boolean;
  palette: CarPalette;
  skill: number;
  tire?: TireId;
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
  theme?: TrackTheme;
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
  gas?: boolean;
}

export interface RacerState {
  id: string;
  label: string;
  carId: CarId;
  number: number;
  isPlayer: boolean;
  isHuman?: boolean;
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
  /** What caused the latest impact (for sound/particles). Optional, local-only. */
  impactKind?: 'wall' | 'car';
  /** Tyre compound this car races on (default: standard). */
  tire?: TireId;
  /** Grip multiplier from tyre + weather applied this step (1 = dry road, standard tyre). Local-only. */
  gripMul?: number;
  /** True while the tyres are off the asphalt (dirt/grass). Optional, local-only. */
  offroad?: boolean;
  padCooldown: number;
  prevX: number;
  prevY: number;
  prevAngle: number;
  wrongWay: boolean;
  wrongWayTime: number;
  yawRate: number;
  longAccel: number;
}

export interface RaceSnapshot {
  mode: 'attract' | 'countdown' | 'racing' | 'finished' | 'explore';
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
  wrongWay: boolean;
  /** Current weather: rain intensity and road wetness, both 0..1 */
  weather?: { rain: number; wetness: number };
  playerAngle?: number;
  playerX?: number;
  playerY?: number;
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
    angle?: number;
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

export interface RaceStats {
  driftSeconds: number;
  offroadSeconds: number;
  hits: number;
  cleanLaps: number;
  lapsCompleted: number;
}

export interface RaceResults {
  results: RaceResult[];
  playerPosition: number;
  playerBestLapMs: number | null;
  previousBestLapMs: number | null;
  isNewRecord: boolean;
  totalTimeMs: number;
  totalLaps?: number;
  stats?: RaceStats;
  weather?: WeatherMode;
  tire?: TireId;
}

export type SavedCameraMode = 'top' | 'chase' | 'cockpit';
export type LapCount = 3 | 4 | 5;

export interface CarColorOption {
  id: string;
  label: string;
  palette: CarPalette;
}

export interface SaveData {
  version: 2;
  selectedCarId: CarId;
  selectedTrackId: TrackId;
  bestLapMs: Partial<Record<string, number>>;
  audioMuted: boolean;
  cameraMode?: SavedCameraMode;
  selectedColors?: Partial<Record<CarId, number>>;
  selectedLaps?: LapCount;
  unlocks?: string[];
  selectedTire?: TireId;
  selectedWeather?: WeatherMode;
  xp?: number;
}

export interface HudUpdate {
  screen: 'countdown' | 'racing';
  snapshot: RaceSnapshot;
}

// ---------------------------------------------------------------------------
// Online Multiplayer Protocol Types (shared between client & WebSocket server)
// ---------------------------------------------------------------------------

export interface NetRacerState {
  id: string;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  steer: number;
  nitro: number;
  nitroActive: boolean;
  drifting: boolean;
  impact: number;
  impactKind?: 'wall' | 'car';
  padCooldown?: number;
  wrongWayTime?: number;
  stuckTime?: number;
  lap: number;
  s: number;
  progress: number;
  startedLap: boolean;
  passedHalf: boolean;
  finished: boolean;
  finishTime: number | null;
  wrongWay: boolean;
  yawRate: number;
  longAccel: number;
}

export interface SequencedInput {
  seq: number;
  input: PlayerInput;
}

export interface WorldSnapshot {
  tick: number;
  elapsed: number;
  mode: 'countdown' | 'racing' | 'finished';
  countdown: number | null;
  lastProcessedSeq: Record<string, number>;
  racers: NetRacerState[];
}

export interface RoomPlayerInfo {
  id: string;
  name: string;
  carId: CarId;
  colorIndex: number;
  ready: boolean;
  isHost: boolean;
  connected?: boolean;
}

export interface RoomStatePacket {
  type: 'room_state';
  roomCode: string;
  trackId: TrackId;
  totalLaps?: LapCount;
  weather?: WeatherMode;
  hostId: string;
  status: 'lobby' | 'countdown' | 'racing' | 'finished';
  players: RoomPlayerInfo[];
}

export type ClientMessage =
  | { type: 'create_room'; name: string; carId: CarId; colorIndex: number; trackId: TrackId }
  | { type: 'join_room'; roomCode: string; name: string; carId: CarId; colorIndex: number }
  | { type: 'rejoin_room'; roomCode: string; playerId: string }
  | { type: 'update_loadout'; carId: CarId; colorIndex: number; name?: string }
  | { type: 'set_track'; trackId: TrackId }
  | { type: 'set_laps'; totalLaps: LapCount }
  | { type: 'set_weather'; weather: WeatherMode }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'start_race' }
  | { type: 'input'; seq: number; input: PlayerInput; inputs?: SequencedInput[] }
  | { type: 'ping'; sentAt: number };

export type ServerMessage =
  | { type: 'welcome'; playerId: string }
  | RoomStatePacket
  | { type: 'race_started'; trackId: TrackId; totalLaps?: LapCount; weather?: WeatherMode; weatherSeed?: number; isSpectator?: boolean; participants: { id: string; name: string; carId: CarId; colorIndex: number; isHuman: boolean; number: number }[] }
  | { type: 'snapshot'; snapshot: WorldSnapshot }
  | { type: 'race_finished'; results: RaceResults }
  | { type: 'pong'; sentAt: number; serverTime: number }
  | { type: 'error'; message: string };
