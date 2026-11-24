import type {
  CarId,
  PlayerInput,
  RaceResult,
  RaceResults,
  RaceSnapshot,
  RacerConfig,
  RacerState,
  Track,
} from './types';
import { AI_LIVERIES, getCar } from './data/cars';
import { nearestOnTrack, pointAtDistance, sampleAtDistance } from './track/geometry';
import { computeAiInput } from './ai';
import { resolveRacerCollisions, stepRacer } from './physics';
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
  };
}

export class RaceSim {
  readonly track: Track;
  readonly racers: RacerState[];
  readonly player: RacerState;
  readonly totalLaps = TOTAL_LAPS;
  elapsed = 0;

  constructor(track: Track, playerCarId: CarId) {
    this.track = track;
    const spec = getCar(playerCarId);
    const playerConfig: RacerConfig = {
      id: 'player',
      label: `${spec.name} #1`,
      carId: playerCarId,
      number: 1,
      isPlayer: true,
      palette: spec.palette,
      skill: 1,
    };
    const aiConfigs = AI_LIVERIES.map((livery) => ({ ...livery, isPlayer: false }));
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

  update(dt: number, playerInput: PlayerInput): void {
    this.elapsed += dt;
    const previous = new Map<string, number>();
    for (const racer of this.racers) {
      racer.prevX = racer.x;
      racer.prevY = racer.y;
      racer.prevAngle = racer.angle;
      previous.set(racer.id, racer.s);
      if (racer.finished) continue;

      const input = racer.isPlayer ? playerInput : computeAiInput(racer, this.racers, this.track, this.elapsed);
      const spec = getCar(racer.carId);
      stepRacer(racer, spec, this.track, input, dt);

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
    racer.prevX = hit.x;
    racer.prevY = hit.y;
    racer.prevAngle = racer.angle;
    racer.wrongWay = false;
    racer.wrongWayTime = 0;
    racer.impact = 0.6;
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
    };
  }
}
