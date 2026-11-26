import type {
  CarId,
  CarPalette,
  NetRacerState,
  PlayerInput,
  RaceResult,
  RaceResults,
  RaceSnapshot,
  RacerConfig,
  RacerState,
  TireId,
  Track,
  WeatherMode,
} from './types';
import { AI_LIVERIES, getCar, getCarPalette } from './data/cars';
import { nearestOnTrack, pointAtDistance, sampleAtDistance } from './track/geometry';
import { computeAiInput } from './ai';
import { resolveRacerCollisions, stepRacer, type PhysicsEnv } from './physics';
import { getTire } from './data/tires';
import { WeatherTimeline, type WeatherConfig, type WeatherState } from './weather';
import { clamp, mod } from './utils';

const TOTAL_LAPS = 3;
const NEUTRAL_INPUT: PlayerInput = { steer: 0, brake: false, nitro: false, pause: false };

function createRacer(config: RacerConfig, track: Track, slotIndex: number): RacerState {
  const slot = track.gridSlots[slotIndex];
  const gridDistance = mod(slot.distance, track.length);
  const point = pointAtDistance(track, gridDistance, slot.lateral);
  const sample = sampleAtDistance(track, gridDistance);
  return {
    id: config.id,
    label: config.label,
    carId: config.carId,
    number: config.number,
    isPlayer: config.isPlayer,
    isHuman: config.isHuman ?? config.isPlayer,
    palette: config.palette,
    skill: config.skill,
    x: point.x,
    y: point.y,
    angle: Math.atan2(sample.ty, sample.tx),
    vx: 0,
    vy: 0,
    steer: 0,
    nitro: 55,
    nitroActive: false,
    drifting: false,
    lap: 0,
    s: gridDistance,
    progress: gridDistance - track.length,
    startedLap: false,
    passedHalf: false,
    finished: false,
    finishTime: null,
    lapStartTime: 0,
    bestLapMs: null,
    lastLapMs: null,
    lapTimes: [],
    stuckTime: 0,
    impact: 0,
    padCooldown: 0,
    prevX: point.x,
    prevY: point.y,
    prevAngle: Math.atan2(sample.ty, sample.tx),
    wrongWay: false,
    wrongWayTime: 0,
    yawRate: 0,
    longAccel: 0,
    tire: config.tire ?? 'standard',
  };
}

export interface RaceParticipant {
  id: string;
  label: string;
  carId: CarId;
  colorIndex?: number;
  palette?: CarPalette;
  number?: number;
}

export interface RaceOptions {
  playerPalette?: CarPalette;
  explore?: boolean;
  totalLaps?: number;
  initialPose?: { x: number; y: number; angle: number; vx: number; vy: number; s: number };
  participants?: RaceParticipant[];
  localPlayerId?: string;
  fillWithAi?: boolean;
  /** Offline races only: weather for this race (default clear) */
  weather?: WeatherConfig;
  /** Offline races only: tyre the player runs on (default standard) */
  playerTire?: TireId;
}

/** AI tyre choices per weather mode. Mixed on purpose so the field is not all on the same gamble. */
const AI_TIRES: Record<WeatherMode, TireId[]> = {
  clear: ['standard', 'standard', 'grip', 'standard', 'standard'],
  rain: ['rain', 'standard', 'rain', 'rain', 'standard'],
  dynamic: ['standard', 'rain', 'standard', 'grip', 'standard'],
};

export class RaceSim {
  readonly track: Track;
  readonly racers: RacerState[];
  readonly player: RacerState;
  readonly totalLaps: number;
  readonly explore: boolean;
  elapsed = 0;
  readonly weatherConfig: WeatherConfig;
  private readonly weather: WeatherTimeline;
  currentWeather: WeatherState = { rain: 0, wetness: 0 };
  tick = 0;

  constructor(track: Track, playerCarId: CarId, paletteOrOptions?: CarPalette | RaceOptions) {
    this.track = track;
    const opts: RaceOptions =
      paletteOrOptions && 'body' in paletteOrOptions
        ? { playerPalette: paletteOrOptions }
        : (paletteOrOptions ?? {});
    this.explore = Boolean(opts.explore);
    this.totalLaps = opts.totalLaps && opts.totalLaps >= 1 ? Math.floor(opts.totalLaps) : TOTAL_LAPS;
    this.weatherConfig = opts.weather ?? { mode: 'clear', seed: 1 };
    this.weather = new WeatherTimeline(this.weatherConfig);
    this.currentWeather = this.weather.at(0);

    if (opts.participants && opts.participants.length > 0) {
      const localId = opts.localPlayerId ?? opts.participants[0].id;
      const humanConfigs: RacerConfig[] = opts.participants.slice(0, 6).map((p, idx) => ({
        id: p.id,
        label: p.label,
        carId: p.carId,
        number: p.number ?? idx + 1,
        isPlayer: p.id === localId,
        isHuman: true,
        palette: p.palette ?? getCarPalette(p.carId, p.colorIndex ?? 0),
        skill: 1,
      }));

      const fillWithAi = opts.fillWithAi ?? true;
      const aiNeeded = fillWithAi ? Math.max(0, 6 - humanConfigs.length) : 0;
      const aiConfigs: RacerConfig[] = AI_LIVERIES.slice(0, aiNeeded).map((livery) => ({
        ...livery,
        isPlayer: false,
        isHuman: false,
      }));

      // AI starts in front slots, human racers start together behind
      const configurations: RacerConfig[] = [...aiConfigs, ...humanConfigs];
      this.racers = configurations.map((config, index) => createRacer(config, track, index));
      this.player = this.racers.find((r) => r.isPlayer) ?? this.racers[0];
      return;
    }

    const spec = getCar(playerCarId);
    const playerConfig: RacerConfig = {
      id: 'player',
      label: `${spec.name} #1`,
      carId: playerCarId,
      number: 1,
      isPlayer: true,
      isHuman: true,
      palette: opts.playerPalette ?? spec.palette,
      skill: 1,
    };

    if (this.explore) {
      const solo = createRacer(playerConfig, track, 0);
      if (opts.initialPose) {
        solo.x = opts.initialPose.x;
        solo.y = opts.initialPose.y;
        solo.angle = opts.initialPose.angle;
        solo.vx = opts.initialPose.vx;
        solo.vy = opts.initialPose.vy;
        solo.s = opts.initialPose.s;
        solo.prevX = opts.initialPose.x;
        solo.prevY = opts.initialPose.y;
        solo.prevAngle = opts.initialPose.angle;
      }
      solo.nitro = 100;
      this.racers = [solo];
      this.player = solo;
      return;
    }

    const aiPool = AI_LIVERIES.filter((livery) => livery.carId !== playerConfig.carId);
    let trackHash = 0;
    for (const ch of track.id) trackHash = (trackHash * 31 + ch.charCodeAt(0)) >>> 0;
    const aiConfigs = Array.from({ length: 5 }, (_, i) => {
      const livery = aiPool[(trackHash + i) % aiPool.length];
      return { ...livery, isPlayer: false, isHuman: false, tire: AI_TIRES[this.weatherConfig.mode][i] };
    });
    playerConfig.tire = opts.playerTire ?? 'standard';
    const configurations: RacerConfig[] = [
      aiConfigs[0],
      aiConfigs[1],
      aiConfigs[2],
      aiConfigs[3],
      aiConfigs[4],
      playerConfig,
    ];
    const slots = [0, 1, 2, 3, 4, 5];
    this.racers = configurations.map((config, index) => createRacer(config, track, slots[index]));
    this.player = this.racers[5];
  }

  get playerFinished(): boolean {
    return this.player.finished;
  }

  get allFinished(): boolean {
    return this.racers.every((racer) => racer.finished);
  }

  update(dt: number, inputOrMap: PlayerInput | Map<string, PlayerInput>): void {
    this.elapsed += dt;
    this.tick += 1;
    this.currentWeather = this.weather.at(this.elapsed);
    const wetness = this.currentWeather.wetness;

    if (this.explore) {
      const racer = this.player;
      racer.prevX = racer.x;
      racer.prevY = racer.y;
      racer.prevAngle = racer.angle;
      const spec = getCar(racer.carId);
      const exploreInput = inputOrMap instanceof Map ? (inputOrMap.get(racer.id) ?? NEUTRAL_INPUT) : inputOrMap;
      stepRacer(racer, spec, this.track, exploreInput, dt, { wetness: 0, tire: getTire(racer.tire) });
      racer.wrongWay = false;
      racer.wrongWayTime = 0;
      racer.stuckTime = 0;
      if (!racer.nitroActive) {
        racer.nitro = Math.min(100, racer.nitro + dt * 10);
      }
      return;
    }

    const previous = new Map<string, number>();
    for (const racer of this.racers) {
      racer.prevX = racer.x;
      racer.prevY = racer.y;
      racer.prevAngle = racer.angle;
      previous.set(racer.id, racer.s);
      if (racer.finished) continue;

      const isHuman = racer.isHuman ?? racer.isPlayer;
      const input = isHuman
        ? (inputOrMap instanceof Map ? (inputOrMap.get(racer.id) ?? NEUTRAL_INPUT) : inputOrMap)
        : computeAiInput(racer, this.racers, this.track, this.elapsed);
      const spec = getCar(racer.carId);
      const env: PhysicsEnv = { wetness, tire: getTire(racer.tire) };
      stepRacer(racer, spec, this.track, input, dt, env);

      if (Math.hypot(racer.vx, racer.vy) < 5) {
        racer.stuckTime += dt;
      } else {
        racer.stuckTime = Math.max(0, racer.stuckTime - dt * 2);
      }

      if (racer.stuckTime > 2.6) {
        const hit = nearestOnTrack(this.track, racer.x, racer.y);
        const point = pointAtDistance(this.track, hit.s, clamp(hit.side, -6, 6));
        racer.x = point.x;
        racer.y = point.y;
        const sample = sampleAtDistance(this.track, hit.s);
        racer.angle = Math.atan2(sample.ty, sample.tx);
        racer.vx = sample.tx * 44;
        racer.vy = sample.ty * 44;
        racer.yawRate = 0;
        racer.longAccel = 0;
        racer.stuckTime = 0;
        racer.impact = 0.5;
      }
    }

    resolveRacerCollisions(this.racers);

    for (const racer of this.racers) {
      if (racer.finished) continue;
      const hit = nearestOnTrack(this.track, racer.x, racer.y);
      racer.s = hit.s;
      const before = previous.get(racer.id) ?? racer.s;
      if (!racer.passedHalf && racer.s > this.track.length * 0.52) {
        racer.passedHalf = true;
      }

      const crossedLine =
        before > this.track.length * 0.78 &&
        racer.s < this.track.length * 0.22;

      if (crossedLine && !racer.startedLap) {
        racer.startedLap = true;
        racer.lapStartTime = this.elapsed;
        racer.passedHalf = false;
      } else if (crossedLine && racer.passedHalf) {
        const lapSeconds = this.elapsed - racer.lapStartTime;
        const lapMs = Math.max(1, Math.round(lapSeconds * 1000));
        racer.lapTimes.push(lapMs);
        racer.lastLapMs = lapMs;
        racer.bestLapMs = racer.bestLapMs == null ? lapMs : Math.min(racer.bestLapMs, lapMs);
        racer.lapStartTime = this.elapsed;
        racer.passedHalf = false;
        racer.lap += 1;

        if (racer.lap >= this.totalLaps) {
          racer.finished = true;
          racer.finishTime = this.elapsed;
          racer.progress = this.totalLaps * this.track.length;
        }
      }

      if (!racer.finished) {
        racer.progress = racer.startedLap
          ? racer.lap * this.track.length + racer.s
          : racer.s - this.track.length;
      }
    }
  }

  completeRace(): void {
    let simulated = 0;
    const maxSimulation = 90;
    while (!this.allFinished && simulated < maxSimulation) {
      this.update(1 / 120, NEUTRAL_INPUT);
      simulated += 1 / 120;
    }
    for (const racer of this.racers) {
      if (!racer.finished) {
        racer.finished = true;
        const estLap = racer.bestLapMs ? racer.bestLapMs / 1000 : 25;
        racer.finishTime = this.elapsed + (this.totalLaps - racer.lap) * estLap;
      }
    }
  }

  private ranked(): RacerState[] {
    return [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
  }

  resetPlayerCar(): void {
    const racer = this.player;
    const hit = nearestOnTrack(this.track, racer.x, racer.y);
    racer.x = hit.x;
    racer.y = hit.y;
    racer.angle = Math.atan2(hit.ty, hit.tx);
    racer.vx = 0;
    racer.vy = 0;
    racer.yawRate = 0;
    racer.longAccel = 0;
    racer.prevX = hit.x;
    racer.prevY = hit.y;
    racer.prevAngle = racer.angle;
    racer.wrongWay = false;
    racer.wrongWayTime = 0;
    racer.impact = 0;
  }

  snapshot(mode: RaceSnapshot['mode'], countdown: number | null, totalRacers = this.racers.length): RaceSnapshot {
    const ranked = this.ranked();
    const playerPosition = ranked.findIndex((racer) => racer.isPlayer) + 1;
    return {
      mode,
      countdown,
      time: Math.max(0, this.elapsed * 1000),
      laps: this.totalLaps,
      lap: this.player.startedLap ? Math.min(this.totalLaps, this.player.lap + 1) : 1,
      position: playerPosition,
      totalRacers,
      nitro: this.player.nitro,
      speed: Math.hypot(this.player.vx, this.player.vy),
      bestLapMs: this.player.bestLapMs,
      lastLapMs: this.player.lastLapMs,
      playerFinished: this.player.finished,
      wrongWay: Boolean(this.player.wrongWay),
      weather: { rain: this.currentWeather.rain, wetness: this.currentWeather.wetness },
      playerAngle: this.player.angle,
      playerX: this.player.x,
      playerY: this.player.y,
      racers: ranked.map((racer, index) => ({
        id: racer.id,
        number: racer.number,
        isPlayer: racer.isPlayer,
        lap: Math.min(this.totalLaps, racer.lap + 1),
        position: index + 1,
        finished: racer.finished,
        finishTime: racer.finishTime,
        x: racer.x,
        y: racer.y,
        s: racer.s,
        angle: racer.angle,
      })),
    };
  }

  results(previousBestLapMs: number | null): RaceResults {
    const ranked = this.ranked();
    const results: RaceResult[] = ranked.map((racer, index) => ({
      id: racer.id,
      label: racer.label,
      carId: racer.carId,
      number: racer.number,
      isPlayer: racer.isPlayer,
      position: index + 1,
      timeMs: racer.finishTime == null ? null : Math.round(racer.finishTime * 1000),
      bestLapMs: racer.bestLapMs,
    }));
    const playerResult = results.find((result) => result.isPlayer);
    const playerBest = this.player.bestLapMs;
    const isNewRecord =
      playerBest != null && (previousBestLapMs == null || playerBest < previousBestLapMs);
    return {
      results,
      playerPosition: playerResult?.position ?? 1,
      playerBestLapMs: playerBest,
      previousBestLapMs,
      isNewRecord,
      totalTimeMs: this.player.finishTime == null ? 0 : Math.round(this.player.finishTime * 1000),
      totalLaps: this.totalLaps,
      weather: this.weatherConfig.mode,
      tire: this.player.tire ?? 'standard',
    };
  }

  exportNetState(): NetRacerState[] {
    return this.racers.map((racer) => ({
      id: racer.id,
      x: racer.x,
      y: racer.y,
      angle: racer.angle,
      vx: racer.vx,
      vy: racer.vy,
      steer: racer.steer,
      nitro: racer.nitro,
      nitroActive: racer.nitroActive,
      drifting: racer.drifting,
      impact: racer.impact,
      impactKind: racer.impactKind,
      padCooldown: racer.padCooldown,
      wrongWayTime: racer.wrongWayTime,
      stuckTime: racer.stuckTime,
      lap: racer.lap,
      s: racer.s,
      progress: racer.progress,
      startedLap: racer.startedLap,
      passedHalf: racer.passedHalf,
      finished: racer.finished,
      finishTime: racer.finishTime,
      wrongWay: racer.wrongWay,
      yawRate: racer.yawRate,
      longAccel: racer.longAccel,
    }));
  }

  applyNetState(states: NetRacerState[]): void {
    const byId = new Map(states.map((state) => [state.id, state]));
    for (const racer of this.racers) {
      const next = byId.get(racer.id);
      if (!next) continue;
      racer.prevX = racer.x;
      racer.prevY = racer.y;
      racer.prevAngle = racer.angle;
      racer.x = next.x;
      racer.y = next.y;
      racer.angle = next.angle;
      racer.vx = next.vx;
      racer.vy = next.vy;
      racer.steer = next.steer;
      racer.nitro = next.nitro;
      racer.nitroActive = next.nitroActive;
      racer.drifting = next.drifting;
      racer.impact = next.impact;
      if (next.impactKind !== undefined) racer.impactKind = next.impactKind;
      if (next.padCooldown !== undefined) racer.padCooldown = next.padCooldown;
      if (next.wrongWayTime !== undefined) racer.wrongWayTime = next.wrongWayTime;
      if (next.stuckTime !== undefined) racer.stuckTime = next.stuckTime;
      racer.lap = next.lap;
      racer.s = next.s;
      racer.progress = next.progress;
      racer.startedLap = next.startedLap;
      racer.passedHalf = next.passedHalf;
      racer.finished = next.finished;
      racer.finishTime = next.finishTime;
      racer.wrongWay = next.wrongWay;
      racer.yawRate = next.yawRate;
      racer.longAccel = next.longAccel;
    }
  }
}
