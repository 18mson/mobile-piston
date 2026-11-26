import type { CarId, CarPalette, PlayerInput, RaceResults, RaceSnapshot, RacerState, SequencedInput, Track, WorldSnapshot } from './types';
import { getCar } from './data/cars';
import { RaceSim, type RaceParticipant } from './race';
import { Renderer3D, type CameraMode } from './render3d/renderer3d';
import { InputManager } from './input';
import { GameAudio } from './audio';
import { clamp } from './utils';
import { RaceStatsTracker } from './raceStats';
import { computeAiInput } from './ai';
import { NetRaceSync, type NetDebugStats } from './net/sync';

export interface NetTransport {
  sendInput(seq: number, input: PlayerInput, inputs?: SequencedInput[]): void;
  pingMs?: number | null;
}

type EngineMode = 'attract' | 'countdown' | 'racing' | 'explore' | 'online' | 'paused' | 'finished' | 'error';

export interface EngineCallbacks {
  onReady: () => void;
  onSnapshot: (snapshot: RaceSnapshot) => void;
  onFinished: (results: RaceResults) => void;
  onPause: () => void;
  onExitExplore?: () => void;
  onError: (message: string) => void;
  onCameraChange?: (mode: CameraMode) => void;
}

const FIXED_STEP = 1 / 120;

export class GameEngine {
  private callbacks: EngineCallbacks;
  private canvas: HTMLCanvasElement;
  private track: Track;
  private renderer: Renderer3D;
  private input = new InputManager();
  private audio = new GameAudio();
  private race: RaceSim | null = null;
  private mode: EngineMode = 'attract';
  private pausedFrom: 'countdown' | 'racing' = 'racing';
  private countdownRemaining = 0;
  private countdownLastShown = 0;
  private goTimer = 0;
  private accumulator = 0;
  private lastFrame = 0;
  private visualTime = 0;
  private snapshotTimer = 0;
  private raf = 0;
  private destroyed = false;
  private reducedMotion = false;
  private selectedCar: CarId = 'sirip';
  private previousBestLapMs: number | null = null;
  private impactSoundCooldown = 0;
  private raceStats = new RaceStatsTracker();
  private motionQuery: MediaQueryList | null = null;
  private onlineSync: NetRaceSync | null = null;
  private netClient: NetTransport | null = null;
  private netInputTimer = 0;
  private lastSentInput: PlayerInput | null = null;

  /** Engine, tyre squeal, dirt crunch and boost-pad sounds for the car the player drives. */
  private updateRaceAudio(racer: RacerState, racing: boolean): void {
    const speed = Math.hypot(racer.vx, racer.vy);
    const topSpeed = getCar(racer.carId).stats.topSpeed;
    this.audio.updateEngine(speed, topSpeed, racer.drifting, racer.nitroActive, racing);
    const lateral = -racer.vx * Math.sin(racer.angle) + racer.vy * Math.cos(racer.angle);
    const slip = speed > 30 ? clamp(Math.abs(lateral) / speed / 0.45, 0, 1) : 0;
    this.audio.updateDriving({
      speed,
      maxSpeed: topSpeed,
      slip,
      drifting: racer.drifting,
      offroad: Boolean(racer.offroad),
      padHit: racer.padCooldown > 0.6,
      racing,
    });
  }

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks, track: Track) {
    this.callbacks = callbacks;
    this.canvas = canvas;
    this.track = track;
    try {
      this.renderer = new Renderer3D(canvas, track);
    } catch (error) {
      this.mode = 'error';
      throw error;
    }
    this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.motionQuery.matches;
    this.renderer.setReducedMotion(this.reducedMotion);
    this.motionQuery.addEventListener('change', this.handleMotionChange);
    this.attachWindowListeners();
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    this.callbacks.onReady();
  }

  get audioController(): GameAudio {
    return this.audio;
  }

  get currentMode(): EngineMode {
    return this.mode;
  }

  get currentTrackId(): string {
    return this.track.id;
  }

  setTrack(track: Track): void {
    if (this.destroyed || track.id === this.track.id) return;
    try {
      this.track = track;
      this.race = null;
      this.mode = 'attract';
      this.accumulator = 0;
      this.input.clearTouch();
      this.input.clearKeys();
      this.renderer.dispose();
      this.renderer = new Renderer3D(this.canvas, track);
      this.renderer.setReducedMotion(this.reducedMotion);
      this.audio.updateEngine(0, 1, false, false, false);
    } catch (error) {
      console.error(error);
      this.mode = 'error';
      this.callbacks.onError('Lintasan gagal dimuat. Coba pilih lintasan lain.');
    }
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  resetCar(): void {
    if (this.destroyed || !this.race || (this.mode !== 'racing' && this.mode !== 'countdown')) return;
    this.race.resetPlayerCar();
    this.audio.beep(520, 0.12, 0.2);
    this.emitSnapshot();
  }

  cycleCamera(): CameraMode {
    const next = this.renderer.cycleCamera();
    this.callbacks.onCameraChange?.(next);
    return next;
  }

  setTouchControl(action: 'left' | 'right' | 'brake' | 'nitro', pressed: boolean): void {
    this.input.setTouch(action, pressed);
    if (pressed) void this.audio.unlock();
  }

  startRace(
    carId: CarId,
    previousBestLapMs: number | null,
    cameraMode?: CameraMode,
    playerPalette?: CarPalette,
    totalLaps?: number,
  ): void {
    if (this.destroyed) return;
    void this.audio.unlock();
    this.selectedCar = carId;
    this.previousBestLapMs = previousBestLapMs;
    this.raceStats.reset();
    this.race = new RaceSim(this.track, carId, { playerPalette, totalLaps });
    this.renderer.setRacers(this.race.racers, cameraMode);
    this.renderer.resetMarks();
    this.mode = 'countdown';
    this.countdownRemaining = 3;
    this.countdownLastShown = 3;
    this.goTimer = 0;
    this.accumulator = 0;
    this.snapshotTimer = 0;
    this.input.clearTouch();
    this.audio.beep(420, 0.09, 0.12);
    this.emitSnapshot();
  }

  startExplore(cameraMode?: CameraMode): void {
    if (this.destroyed) return;
    void this.audio.unlock();
    const lead = this.renderer.getAttractLeadState(this.visualTime);
    this.selectedCar = lead.carId;
    this.race = new RaceSim(this.track, lead.carId, {
      playerPalette: lead.palette,
      explore: true,
      initialPose: lead,
    });
    this.renderer.setRacers(this.race.racers, cameraMode, true);
    this.renderer.resetMarks();
    this.mode = 'explore';
    this.onlineSync = null;
    this.netClient = null;
    this.accumulator = 0;
    this.snapshotTimer = 0;
    this.input.clearTouch();
    this.emitSnapshot();
  }

  startOnlineRace(
    track: Track,
    participants: RaceParticipant[],
    localPlayerId: string,
    client: NetTransport,
    cameraMode?: CameraMode,
    totalLaps?: number,
    isSpectator = false,
  ): void {
    if (this.destroyed) return;
    void this.audio.unlock();
    if (track.id !== this.track.id) {
      this.track = track;
      this.renderer.dispose();
      this.renderer = new Renderer3D(this.canvas, track);
      this.renderer.setReducedMotion(this.reducedMotion);
    }
    this.onlineSync = new NetRaceSync(
      this.track,
      participants,
      isSpectator ? '__spectator__' : localPlayerId,
      totalLaps,
      isSpectator,
    );
    this.netClient = client;
    this.race = this.onlineSync.sim;
    this.selectedCar = this.race.player.carId;
    this.renderer.setRacers(this.race.racers, cameraMode, false);
    this.renderer.resetMarks();
    this.raceStats.reset();
    this.mode = 'online';
    this.accumulator = 0;
    this.snapshotTimer = 0;
    this.netInputTimer = 0;
    this.input.clearTouch();
    this.audio.beep(420, 0.09, 0.12);
    this.callbacks.onSnapshot(this.onlineSync.toHudSnapshot());
  }

  applyOnlineSnapshot(snapshot: WorldSnapshot): void {
    if (!this.onlineSync || this.mode !== 'online') return;
    const prevMode = this.onlineSync.currentMode;
    this.onlineSync.applyServerSnapshot(snapshot);
    if (prevMode === 'countdown' && snapshot.mode === 'racing') {
      this.goTimer = 0.78;
      this.audio.beep(980, 0.2, 0.18);
    }
  }

  finishOnlineRace(results: RaceResults): void {
    if (this.mode !== 'online') return;
    this.mode = 'finished';
    this.audio.updateEngine(0, 1, false, false, false);
    this.callbacks.onFinished({ ...results, stats: this.raceStats.result() });
  }

  pause(): void {
    if (this.mode !== 'racing' && this.mode !== 'countdown') return;
    this.pausedFrom = this.mode;
    this.mode = 'paused';
    this.input.clearKeys();
    this.input.clearTouch();
    this.audio.updateEngine(0, 1, false, false, false);
    this.callbacks.onPause();
  }

  resume(): void {
    if (this.mode !== 'paused') return;
    this.mode = this.pausedFrom;
    this.lastFrame = performance.now();
    this.input.clearKeys();
    this.input.clearTouch();
  }

  quitToTitle(): void {
    this.mode = 'attract';
    this.race = null;
    this.accumulator = 0;
    this.input.clearTouch();
    this.input.clearKeys();
    this.audio.updateEngine(0, 1, false, false, false);
  }

  debugState(): Record<string, number | string> {
    return {
      mode: this.mode,
      track: this.track.id,
      countdown: this.countdownRemaining,
      visualTime: this.visualTime,
      elapsed: this.race?.elapsed ?? 0,
    };
  }

  getNetDebugStats(): NetDebugStats | null {
    if (!this.onlineSync) return null;
    return this.onlineSync.getDebugStats(this.netClient?.pingMs ?? null);
  }

  cycleSpectator(dir: 1 | -1 = 1): { id: string; label: string } | null {
    return this.onlineSync?.cycleSpectateTarget(dir) ?? null;
  }

  getSpectateTarget(): { id: string; label: string } | null {
    return this.onlineSync?.getSpectateTarget() ?? null;
  }

  debugFinishRace(): boolean {
    if (!this.race) return false;
    this.mode = 'racing';
    this.goTimer = 0;
    let steps = 0;
    while (!this.race.playerFinished && steps < 120 * 150) {
      const input = computeAiInput(this.race.player, this.race.racers, this.track, this.race.elapsed);
      this.race.update(1 / 120, input);
      steps += 1;
    }
    if (!this.race.playerFinished) return false;
    this.finishRace();
    return true;
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.detachWindowListeners();
    this.motionQuery?.removeEventListener('change', this.handleMotionChange);
    this.renderer.dispose();
    this.audio.dispose();
  }

  private handleMotionChange = (): void => {
    this.reducedMotion = Boolean(this.motionQuery?.matches);
    this.renderer.setReducedMotion(this.reducedMotion);
  };

  private attachWindowListeners(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private detachWindowListeners(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    const gameKeys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowDown',
      'ArrowUp',
      'KeyA',
      'KeyD',
      'KeyS',
      'Space',
      'Escape',
      'KeyP',
      'KeyV',
      'KeyR',
    ];
    const isDriving =
      this.mode === 'racing' || this.mode === 'countdown' || this.mode === 'explore' || this.mode === 'online';
    if (gameKeys.includes(event.code) && isDriving) {
      event.preventDefault();
    }
    if (event.code === 'KeyV' && isDriving) {
      if (!event.repeat) {
        const next = this.renderer.cycleCamera();
        this.callbacks.onCameraChange?.(next);
      }
      return;
    }
    if (event.code === 'KeyR' && (this.mode === 'racing' || this.mode === 'countdown')) {
      if (!event.repeat) this.resetCar();
      return;
    }
    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (!event.repeat) {
        if (this.mode === 'explore' && event.code === 'Escape') {
          this.quitToTitle();
          this.callbacks.onExitExplore?.();
        } else if (this.mode === 'racing' || this.mode === 'countdown') {
          this.pause();
        }
      }
      return;
    }
    this.input.setKey(event.code, true, event.repeat);
    if (isDriving) void this.audio.unlock();
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    this.input.setKey(event.code, false);
  };

  private handleWindowBlur = (): void => {
    this.input.clearKeys();
    this.input.clearTouch();
    if (this.mode === 'racing' || this.mode === 'countdown') this.pause();
  };

  private handleVisibility = (): void => {
    if (document.hidden && (this.mode === 'racing' || this.mode === 'countdown')) {
      this.pause();
    }
  };

  private frame = (now: number): void => {
    if (this.destroyed) return;
    const frameDt = clamp((now - this.lastFrame) / 1000, 0, 0.1);
    this.lastFrame = now;
    this.visualTime += frameDt;
    try {
      this.input.update(frameDt);
      if (this.input.consumePauseRequest()) {
        if (this.mode === 'racing' || this.mode === 'countdown') this.pause();
      }
      if (this.input.consumeCameraRequest() && (this.mode === 'racing' || this.mode === 'countdown' || this.mode === 'explore' || this.mode === 'online')) {
        const next = this.renderer.cycleCamera();
        this.callbacks.onCameraChange?.(next);
      }
      if (this.input.consumeResetRequest() && (this.mode === 'racing' || this.mode === 'countdown')) {
        this.resetCar();
      }
      if (this.mode === 'attract') {
        this.renderer.renderAttract(this.visualTime, frameDt);
      } else if (this.mode === 'countdown') {
        this.updateCountdown(frameDt);
      } else if (this.mode === 'racing' || this.mode === 'explore') {
        this.updateRace(frameDt);
      } else if (this.mode === 'online') {
        this.updateOnline(frameDt);
      } else if (this.mode === 'paused' || this.mode === 'finished') {
        this.renderCurrentFrame(0);
      }
    } catch (error) {
      console.error(error);
      this.mode = 'error';
      this.callbacks.onError('Game gagal dimuat. Coba muat ulang.');
      return;
    }

    if (!this.destroyed && this.mode !== 'error') {
      this.raf = requestAnimationFrame(this.frame);
    }
  };

  private updateCountdown(dt: number): void {
    if (!this.race) return;
    this.countdownRemaining = Math.max(0, this.countdownRemaining - dt);
    const shown = Math.ceil(this.countdownRemaining);
    if (shown !== this.countdownLastShown && shown > 0) {
      this.countdownLastShown = shown;
      this.audio.beep(shown === 1 ? 740 : 600, 0.1, 0.14);
    }
    this.race.elapsed = 0;
    if (this.countdownRemaining <= 0) {
      this.mode = 'racing';
      this.goTimer = 0.78;
      this.audio.beep(980, 0.2, 0.18);
    }
    this.renderCurrentFrame(dt);
    this.snapshotTimer += dt;
    if (this.snapshotTimer >= 0.06) {
      this.snapshotTimer = 0;
      this.emitSnapshot();
    }
    this.audio.updateEngine(0, 1, false, false, false);
  }

  private updateRace(dt: number): void {
    if (!this.race) return;
    this.goTimer = Math.max(0, this.goTimer - dt);
    this.accumulator += dt;
    const playerInput = this.input.getInput();
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < 16) {
      this.race.update(FIXED_STEP, playerInput);
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }

    this.impactSoundCooldown = Math.max(0, this.impactSoundCooldown - dt);
    if (this.race.player.impact > 0.34 && this.impactSoundCooldown <= 0) {
      this.audio.impact(this.race.player.impact, this.race.player.impactKind);
      this.impactSoundCooldown = 0.16;
    }
    this.updateRaceAudio(this.race.player, true);
    if (this.mode === 'racing') this.raceStats.update(dt, this.race.player);

    const alpha = clamp(this.accumulator / FIXED_STEP, 0, 1);
    this.renderCurrentFrame(dt, alpha);
    this.snapshotTimer += dt;
    if (this.snapshotTimer >= 0.075) {
      this.snapshotTimer = 0;
      this.emitSnapshot();
    }

    if (this.race.playerFinished) {
      this.finishRace();
    }
  }

  private updateOnline(dt: number): void {
    if (!this.onlineSync || !this.netClient) return;
    this.goTimer = Math.max(0, this.goTimer - dt);
    this.accumulator += dt;
    const playerInput = this.input.getInput();

    let lastSeq = 0;
    let steps = 0;
    while (this.accumulator >= FIXED_STEP && steps < 16) {
      if (!this.onlineSync.isSpectator) {
        lastSeq = this.onlineSync.predictLocal(playerInput, FIXED_STEP);
      }
      this.accumulator -= FIXED_STEP;
      steps += 1;
    }

    this.netInputTimer += dt;
    const inputChanged =
      !this.lastSentInput ||
      this.lastSentInput.steer !== playerInput.steer ||
      this.lastSentInput.brake !== playerInput.brake ||
      this.lastSentInput.nitro !== playerInput.nitro ||
      this.lastSentInput.gas !== playerInput.gas;
    if (!this.onlineSync.isSpectator && lastSeq > 0 && (inputChanged || this.netInputTimer >= 0.016)) {
      this.netInputTimer = 0;
      this.lastSentInput = { ...playerInput };
      this.netClient.sendInput(lastSeq, playerInput, this.onlineSync.getRecentInputs(8));
    }

    this.onlineSync.updateVisuals(dt, Date.now());
    const renderPlayer = this.onlineSync.getRenderPlayer();
    const renderRacers = this.onlineSync.getRenderRacers();

    this.impactSoundCooldown = Math.max(0, this.impactSoundCooldown - dt);
    if (renderPlayer.impact > 0.34 && this.impactSoundCooldown <= 0) {
      this.audio.impact(renderPlayer.impact, renderPlayer.impactKind);
      this.impactSoundCooldown = 0.16;
    }
    this.updateRaceAudio(renderPlayer, this.onlineSync.currentMode === 'racing');
    if (this.onlineSync.currentMode === 'racing') this.raceStats.update(dt, renderPlayer);

    const alpha = clamp(this.accumulator / FIXED_STEP, 0, 1);
    const snapshotMode = this.onlineSync.currentMode === 'countdown' ? 'countdown' : 'racing';
    this.renderer.renderRace(
      renderRacers,
      renderPlayer,
      this.visualTime,
      dt,
      renderPlayer.impact,
      snapshotMode,
      alpha,
    );

    this.snapshotTimer += dt;
    if (this.snapshotTimer >= 0.075) {
      this.snapshotTimer = 0;
      this.callbacks.onSnapshot(this.onlineSync.toHudSnapshot());
    }
  }

  private finishRace(): void {
    if (!this.race) return;
    this.race.completeRace();
    const results = { ...this.race.results(this.previousBestLapMs), stats: this.raceStats.result() };
    this.mode = 'finished';
    this.audio.updateEngine(0, 1, false, false, false);
    this.emitSnapshot();
    this.callbacks.onFinished(results);
  }

  private renderCurrentFrame(dt: number, alpha = 1): void {
    if (!this.race) {
      this.renderer.renderAttract(this.visualTime, dt);
      return;
    }
    const snapshotMode =
      this.mode === 'paused'
        ? 'paused'
        : this.mode === 'finished'
          ? 'finished'
          : this.mode === 'countdown'
            ? 'countdown'
            : 'racing';
    this.renderer.renderRace(
      this.race.racers,
      this.race.player,
      this.visualTime,
      dt,
      this.race.player.impact,
      snapshotMode,
      alpha,
    );
  }

  private emitSnapshot(): void {
    if (!this.race) return;
    const countdown =
      this.mode === 'countdown'
        ? Math.max(1, Math.ceil(this.countdownRemaining))
        : this.mode === 'racing' && this.goTimer > 0
          ? 0
          : null;
    this.callbacks.onSnapshot(
      this.race.snapshot(
        this.mode === 'countdown' ? 'countdown' : this.mode === 'explore' ? 'explore' : 'racing',
        countdown,
      ),
    );
  }

}
