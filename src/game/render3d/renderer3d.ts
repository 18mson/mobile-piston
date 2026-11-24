import * as THREE from 'three';
import type { RacerState, Track } from '../types';
import { createWorld, type World3D } from './world';
import { CarView } from './cars';
import { AI_LIVERIES } from '../data/cars';
import { sampleAtDistance } from '../track/geometry';
import { RENDER_HEIGHT, RENDER_WIDTH, ROAD_Y, toSceneX, toSceneZ, WORLD_SCALE } from './constants';

export type CameraMode = 'chase' | 'top' | 'cockpit';

interface RenderMode {
  paused?: boolean;
}

export class Renderer3D {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, RENDER_WIDTH / RENDER_HEIGHT, 0.1, 1600);
  private world: World3D;
  private track: Track;
  private carRoot = new THREE.Group();
  private attractRoot = new THREE.Group();
  private attractCars: CarView[] = [];
  private cars = new Map<string, CarView>();
  private playerCar: CarView | null = null;
  private player: RacerState | null = null;
  private cameraInitialized = false;
  private cameraTarget = new THREE.Vector3();
  private cameraPosition = new THREE.Vector3();
  private reducedMotion = false;
  private cameraMode: CameraMode = 'chase';
  private shake = 0;

  constructor(canvas: HTMLCanvasElement, track: Track) {
    this.canvas = canvas;
    this.track = track;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(RENDER_WIDTH, RENDER_HEIGHT, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setClearColor('#8ebfcb', 1);
    canvas.width = RENDER_WIDTH;
    canvas.height = RENDER_HEIGHT;
    canvas.dataset.cameraMode = this.cameraMode;

    this.scene.fog = new THREE.Fog('#a8cfd5', 210, 720);
    this.world = createWorld(track);
    this.scene.add(this.world.root);
    this.scene.add(this.carRoot);
    this.scene.add(this.attractRoot);
    this.scene.add(this.camera);

    for (let i = 0; i < 3; i += 1) {
      const livery = AI_LIVERIES[i];
      const view = new CarView(livery.carId, livery.palette, livery.number, false);
      this.attractCars.push(view);
      this.attractRoot.add(view.group);
    }

    const ambient = new THREE.AmbientLight('#ffffff', 0.24);
    this.scene.add(ambient);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  cycleCamera(): CameraMode {
    const modes: CameraMode[] = ['chase', 'top', 'cockpit'];
    const index = modes.indexOf(this.cameraMode);
    this.cameraMode = modes[(index + 1) % modes.length];
    this.cameraInitialized = false;
    this.canvas.dataset.cameraMode = this.cameraMode;
    return this.cameraMode;
  }

  get viewMode(): CameraMode {
    return this.cameraMode;
  }

  setRacers(racers: RacerState[]): void {
    this.disposeCars();
    for (const racer of racers) {
      const view = new CarView(racer.carId, racer.palette, racer.number, racer.isPlayer);
      this.cars.set(racer.id, view);
      this.carRoot.add(view.group);
      if (racer.isPlayer) {
        this.playerCar = view;
        this.player = racer;
      }
    }
    this.cameraInitialized = false;
  }

  resetMarks(): void {
    // The 3D renderer has no persistent tyre mark layer yet.
  }

  renderAttract(time: number, dt: number): void {
    this.carRoot.visible = false;
    this.attractRoot.visible = true;
    const clock = this.reducedMotion ? 0 : time;
    const baseDistance = this.track.length * this.track.attract.fraction + clock * 36;
    let leadScene = new THREE.Vector3();
    let leadForward = new THREE.Vector3(1, 0, 0);
    this.attractCars.forEach((view, index) => {
      const ahead = index * 38;
      const lateral = index === 0 ? 0 : index === 1 ? -10 : 10;
      const sample = sampleAtDistance(this.track, baseDistance + ahead);
      const worldX = sample.x + sample.nx * lateral;
      const worldY = sample.y + sample.ny * lateral;
      const fake = {
        id: `attract-${index}`,
        label: '',
        carId: AI_LIVERIES[index].carId,
        number: AI_LIVERIES[index].number,
        isPlayer: false,
        palette: AI_LIVERIES[index].palette,
        skill: 1,
        x: worldX,
        y: worldY,
        angle: Math.atan2(sample.ty, sample.tx),
        vx: sample.tx * 36,
        vy: sample.ty * 36,
        steer: Math.sin(clock * 1.1 + index) * 0.12,
        nitro: 0,
        nitroActive: false,
        drifting: false,
        lap: 0,
        s: 0,
        progress: 0,
        startedLap: true,
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
      } as RacerState;
      view.update(fake, dt);
      if (index === 0) {
        leadScene = new THREE.Vector3(toSceneX(worldX), ROAD_Y, toSceneZ(worldY));
        leadForward = new THREE.Vector3(sample.tx, 0, sample.ty);
      }
    });
    const focus = new THREE.Vector3(leadScene.x, 1.2, leadScene.z);
    this.world.update(time, dt, focus, this.reducedMotion);
    const desired = leadScene.clone().addScaledVector(leadForward, -17).add(new THREE.Vector3(0, 8.5, 0));
    const look = leadScene.clone().addScaledVector(leadForward, 26).add(new THREE.Vector3(0, 1.5, 0));
    if (!this.cameraInitialized) {
      this.camera.position.copy(desired);
      this.cameraTarget.copy(look);
      this.cameraInitialized = true;
    } else {
      const alpha = Math.min(1, dt * 2.6);
      this.camera.position.lerp(desired, alpha);
      this.cameraTarget.lerp(look, alpha);
    }
    this.camera.lookAt(this.cameraTarget);
    this.camera.fov = 59;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }

  renderRace(
    racers: RacerState[],
    player: RacerState,
    time: number,
    dt: number,
    impact: number,
    mode: 'countdown' | 'racing' | 'finished' | 'paused' | RenderMode,
  ): void {
    this.player = player;
    this.carRoot.visible = true;
    this.attractRoot.visible = false;
    for (const racer of racers) {
      this.cars.get(racer.id)?.update(racer, mode === 'paused' ? 0 : dt);
    }
    const playerView = this.cars.get(player.id);
    this.playerCar = playerView ?? null;
    if (this.playerCar) this.playerCar.group.visible = this.cameraMode !== 'cockpit';
    const focus = new THREE.Vector3(toSceneX(player.x), ROAD_Y, toSceneZ(player.y));
    this.world.update(time, mode === 'paused' ? 0 : dt, focus, this.reducedMotion);
    this.updateCamera(player, mode === 'paused' ? 0 : dt, impact);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.disposeCars();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const item of material) this.disposeMaterial(item);
      } else if (material) {
        this.disposeMaterial(material);
      }
    });
    this.renderer.dispose();
  }

  private disposeMaterial(material: THREE.Material): void {
    const typed = material as THREE.MeshLambertMaterial & { map?: THREE.Texture };
    if (typed.map) typed.map.dispose();
    material.dispose();
  }

  private disposeCars(): void {
    for (const view of this.cars.values()) {
      this.carRoot.remove(view.group);
      view.group.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((item) => {
            const typed = item as THREE.MeshLambertMaterial & { map?: THREE.Texture };
            typed.map?.dispose();
            item.dispose();
          });
        } else if (material) {
          const typed = material as THREE.MeshLambertMaterial & { map?: THREE.Texture };
          typed.map?.dispose();
          material.dispose();
        }
      });
    }
    this.cars.clear();
    this.playerCar = null;
  }

  private updateCamera(player: RacerState, dt: number, impact: number): void {
    const forward = new THREE.Vector3(Math.cos(player.angle), 0, Math.sin(player.angle));
    const car = new THREE.Vector3(toSceneX(player.x), ROAD_Y, toSceneZ(player.y));
    const speed = Math.hypot(player.vx, player.vy);
    const speedNorm = Math.min(1, speed / 200);
    let desiredPosition: THREE.Vector3;
    let desiredTarget: THREE.Vector3;
    let fov = 58;

    if (this.cameraMode === 'top') {
      desiredPosition = car.clone().addScaledVector(forward, -5).add(new THREE.Vector3(0, 31, 0));
      desiredTarget = car.clone().addScaledVector(forward, 8).add(new THREE.Vector3(0, 1, 0));
      fov = 43;
    } else if (this.cameraMode === 'cockpit') {
      desiredPosition = car.clone().addScaledVector(forward, 3.4).add(new THREE.Vector3(0, 2.0, 0));
      desiredTarget = car.clone().addScaledVector(forward, 34).add(new THREE.Vector3(0, 1.4, 0));
      fov = 68;
    } else {
      const distance = 17.5 + speedNorm * 3.5;
      desiredPosition = car
        .clone()
        .addScaledVector(forward, -distance)
        .add(new THREE.Vector3(0, 9.2 + speedNorm * 1.0, 0));
      desiredTarget = car
        .clone()
        .addScaledVector(forward, 17 + speedNorm * 5)
        .add(new THREE.Vector3(0, 1.4, 0));
      fov = 60 + speedNorm * 3;
    }

    if (!this.cameraInitialized || dt <= 0) {
      this.camera.position.copy(desiredPosition);
      this.cameraTarget.copy(desiredTarget);
      this.cameraInitialized = true;
    } else {
      const alpha = 1 - Math.exp(-dt * (this.cameraMode === 'chase' ? 6.5 : 9));
      this.camera.position.lerp(desiredPosition, alpha);
      this.cameraTarget.lerp(desiredTarget, alpha * 0.85);
    }

    this.shake = Math.max(this.shake, impact > 0.2 ? impact : 0);
    this.shake = Math.max(0, this.shake - dt * 3.5);
    if (this.shake > 0 && !this.reducedMotion) {
      const amount = this.shake * 0.35;
      this.camera.position.x += Math.sin(performance.now() * 0.07) * amount;
      this.camera.position.y += Math.cos(performance.now() * 0.09) * amount;
    }

    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fov, Math.min(1, dt * 5));
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.cameraTarget);
  }
}
