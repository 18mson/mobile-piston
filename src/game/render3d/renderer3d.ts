import * as THREE from 'three';
import type { RacerState, Track } from '../types';
import { createWorld, type World3D } from './world';
import { CarView } from './cars';
import { CameraRig, type CameraMode } from './cameraRig';
import { AI_LIVERIES } from '../data/cars';
import { sampleAtDistance } from '../track/geometry';
import { RENDER_HEIGHT, RENDER_WIDTH, ROAD_Y, toSceneX, toSceneZ } from './constants';

export { type CameraMode } from './cameraRig';

interface RenderMode {
  paused?: boolean;
}

export class Renderer3D {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cameraRig = new CameraRig(RENDER_WIDTH / RENDER_HEIGHT);
  private world: World3D;
  private track: Track;
  private carRoot = new THREE.Group();
  private attractRoot = new THREE.Group();
  private attractCars: CarView[] = [];
  private cars = new Map<string, CarView>();
  private playerCar: CarView | null = null;
  private player: RacerState | null = null;
  private reducedMotion = false;

  // Cockpit view overlay parts (attached to camera when in cockpit view)
  private cockpitRoot = new THREE.Group();
  private steeringWheel: THREE.Group | null = null;

  // Attract camera smoothing
  private attractCamPos = new THREE.Vector3();
  private attractCamLook = new THREE.Vector3();
  private attractInitialized = false;

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
    canvas.dataset.cameraMode = this.cameraRig.mode;

    this.scene.fog = new THREE.Fog('#a8cfd5', 210, 720);
    this.world = createWorld(track);
    this.scene.add(this.world.root);
    this.scene.add(this.carRoot);
    this.scene.add(this.attractRoot);
    this.scene.add(this.cameraRig.camera);

    this.buildCockpitView();
    this.cameraRig.camera.add(this.cockpitRoot);

    for (let i = 0; i < 3; i += 1) {
      const livery = AI_LIVERIES[i];
      const view = new CarView(livery.carId, livery.palette, livery.number, false);
      this.attractCars.push(view);
      this.attractRoot.add(view.group);
    }

    const ambient = new THREE.AmbientLight('#ffffff', 0.28);
    this.scene.add(ambient);
  }

  private buildCockpitView(): void {
    // Low-poly cockpit dashboard, hood preview, rearview mirror, steering wheel, and pixel hands
    // Positioned relative to camera local space (looking down -Z in standard Three.js camera)
    const darkMat = new THREE.MeshLambertMaterial({ color: '#182026', flatShading: true });
    const dashMat = new THREE.MeshLambertMaterial({ color: '#25303a', flatShading: true });
    const trimMat = new THREE.MeshLambertMaterial({ color: '#ff8f3d', flatShading: true });
    const mirrorMat = new THREE.MeshBasicMaterial({ color: '#567280' });
    const skinMat = new THREE.MeshLambertMaterial({ color: '#e2b083', flatShading: true });
    const gloveMat = new THREE.MeshLambertMaterial({ color: '#d83a2b', flatShading: true });

    // Dashboard base
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.8), dashMat);
    dash.position.set(0, -0.42, -0.85);
    this.cockpitRoot.add(dash);

    // Instrument cluster hood
    const cluster = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.35), darkMat);
    cluster.position.set(0, -0.22, -0.72);
    this.cockpitRoot.add(cluster);

    // Front hood / bonnet visible out front
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 1.4), trimMat);
    hood.position.set(0, -0.48, -1.65);
    this.cockpitRoot.add(hood);

    // Center rearview mirror
    const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.24, 0.08), darkMat);
    mirrorFrame.position.set(0, 0.46, -0.85);
    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.18), mirrorMat);
    mirrorGlass.position.set(0, 0.46, -0.8);
    this.cockpitRoot.add(mirrorFrame, mirrorGlass);

    // Steering wheel pivot & wheel
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, -0.26, -0.56);
    wheelGroup.rotation.x = Math.PI / 8; // Slanted towards driver

    // Chunky pixel-style wheel rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.045, 5, 10), darkMat);
    wheelGroup.add(rim);

    // Center spoke
    const centerCap = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.04, 6), trimMat);
    centerCap.rotation.x = Math.PI / 2;
    wheelGroup.add(centerCap);

    // Driver hands on 9-and-3
    for (const side of [-1, 1]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.14), gloveMat);
      hand.position.set(side * 0.23, 0, 0.02);
      wheelGroup.add(hand);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.26), skinMat);
      arm.position.set(side * 0.24, -0.06, 0.18);
      arm.rotation.x = -Math.PI / 6;
      wheelGroup.add(arm);
    }

    this.cockpitRoot.add(wheelGroup);
    this.steeringWheel = wheelGroup;
    this.cockpitRoot.visible = false;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.cameraRig.setReducedMotion(reduced);
  }

  cycleCamera(): CameraMode {
    const nextMode = this.cameraRig.cycle();
    this.canvas.dataset.cameraMode = nextMode;
    return nextMode;
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraRig.setMode(mode, false);
    this.canvas.dataset.cameraMode = mode;
  }

  get viewMode(): CameraMode {
    return this.cameraRig.mode;
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
    this.cameraRig.setMode('top', true);
    this.canvas.dataset.cameraMode = 'top';
  }

  resetMarks(): void {
    // Persistent tyre mark layer slot
  }

  renderAttract(time: number, dt: number): void {
    this.carRoot.visible = false;
    this.attractRoot.visible = true;
    this.cockpitRoot.visible = false;

    const clock = this.reducedMotion ? 0 : time;
    const baseDistance = this.track.length * this.track.attract.fraction + clock * 36;
    let leadScene = new THREE.Vector3();
    let leadForward = new THREE.Vector3(1, 0, 0);

    this.attractCars.forEach((view, index) => {
      const ahead = index * 38;
      const lateral = index === 0 ? 0 : index === 1 ? -16 : 16;
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

    // Attract view: pleasant overview chase
    const desired = leadScene.clone().addScaledVector(leadForward, -26).add(new THREE.Vector3(0, 14.0, 0));
    const look = leadScene.clone().addScaledVector(leadForward, 24).add(new THREE.Vector3(0, 1.5, 0));

    if (!this.attractInitialized) {
      this.attractCamPos.copy(desired);
      this.attractCamLook.copy(look);
      this.attractInitialized = true;
    } else {
      const alpha = Math.min(1, dt * 2.8);
      this.attractCamPos.lerp(desired, alpha);
      this.attractCamLook.lerp(look, alpha);
    }

    this.cameraRig.camera.position.copy(this.attractCamPos);
    this.cameraRig.camera.lookAt(this.attractCamLook);
    this.cameraRig.camera.fov = 54;
    this.cameraRig.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.cameraRig.camera);
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
    const isPaused = mode === 'paused';
    const effectiveDt = isPaused ? 0 : dt;

    for (const racer of racers) {
      this.cars.get(racer.id)?.update(racer, effectiveDt);
    }

    const playerView = this.cars.get(player.id);
    this.playerCar = playerView ?? null;

    // Cockpit visibility & clipping handling:
    // Only switch to driver interior when the camera rig actually arrives inside
    const isCockpit = this.cameraRig.inCockpit;
    if (this.playerCar) {
      // Hide player's full body mesh only when fully seated in cockpit to prevent eye clipping
      // When flying in from outside, the car body remains visible as the camera enters
      this.playerCar.group.visible = !isCockpit;
    }
    this.cockpitRoot.visible = isCockpit;

    if (isCockpit && this.steeringWheel) {
      // Steer the steering wheel with player input
      this.steeringWheel.rotation.z = -player.steer * 0.95;
    }

    const focus = new THREE.Vector3(toSceneX(player.x), ROAD_Y, toSceneZ(player.y));
    this.world.update(time, effectiveDt, focus, this.reducedMotion);

    // Update unified camera rig
    this.cameraRig.update(player, effectiveDt, impact);

    this.renderer.render(this.scene, this.cameraRig.camera);
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
}
