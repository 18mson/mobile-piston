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
  private cockpitHoodMat = new THREE.MeshLambertMaterial({ color: '#ff8f3d', flatShading: true });
  private cockpitShadeMat = new THREE.MeshLambertMaterial({ color: '#d93b2b', flatShading: true });
  private cockpitRevLeds: THREE.Mesh[] = [];

  // Skid marks on road surface when drifting or slipping
  private skidMesh: THREE.InstancedMesh;
  private skidDummy = new THREE.Object3D();
  private skidIndex = 0;
  private maxSkids = 800;
  private lastSkidPos = new Map<string, { x: number; y: number }>();

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

    // Tire skid marks on road surface
    const skidGeo = new THREE.PlaneGeometry(0.36, 0.85);
    skidGeo.rotateX(-Math.PI / 2);
    const skidMat = new THREE.MeshBasicMaterial({
      color: 0x14161a,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    this.skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, this.maxSkids);
    this.skidMesh.frustumCulled = false;
    for (let i = 0; i < this.maxSkids; i += 1) {
      this.skidDummy.position.set(0, -999, 0);
      this.skidDummy.scale.set(0, 0, 0);
      this.skidDummy.updateMatrix();
      this.skidMesh.setMatrixAt(i, this.skidDummy.matrix);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.skidMesh);
  }

  private buildCockpitView(): void {
    // Pixel-art GT cockpit interior matching reference image (windshield frame, mirrors, dash, digital cluster, racing wheel & gloves)
    // Positioned in camera local space (looking down -Z)
    const interiorDarkMat = new THREE.MeshLambertMaterial({ color: '#141a20', flatShading: true });
    const dashMat = new THREE.MeshLambertMaterial({ color: '#222b34', flatShading: true });
    const trimAccentMat = new THREE.MeshLambertMaterial({ color: '#3b4a56', flatShading: true });
    const screenMat = new THREE.MeshBasicMaterial({ color: '#12222d' });
    const mirrorGlassMat = new THREE.MeshBasicMaterial({ color: '#58788a' });
    const mirrorRoadMat = new THREE.MeshBasicMaterial({ color: '#243038' });
    const mirrorCarMat = new THREE.MeshBasicMaterial({ color: '#ff5238' });
    const gloveDarkMat = new THREE.MeshLambertMaterial({ color: '#1b2128', flatShading: true });
    const gloveYellowMat = new THREE.MeshLambertMaterial({ color: '#f5c518', flatShading: true });

    // 1. Windshield frame: roof header bar and left/right A-pillars
    const roofBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.22), interiorDarkMat);
    roofBar.position.set(0, 0.46, -0.65);
    this.cockpitRoot.add(roofBar);

    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.78, 0.18), interiorDarkMat);
    leftPillar.position.set(-0.76, 0.10, -0.66);
    leftPillar.rotation.z = -0.34;
    this.cockpitRoot.add(leftPillar);

    const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.78, 0.18), interiorDarkMat);
    rightPillar.position.set(0.76, 0.10, -0.66);
    rightPillar.rotation.z = 0.34;
    this.cockpitRoot.add(rightPillar);

    // 2. Left side mirror (outside left A-pillar, matching car body color)
    const sideMirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.03, 0.04), interiorDarkMat);
    sideMirrorArm.position.set(-0.70, -0.09, -0.72);
    const sideMirrorHousing = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.075, 0.05), this.cockpitHoodMat);
    sideMirrorHousing.position.set(-0.78, -0.07, -0.73);
    const sideMirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.055), mirrorGlassMat);
    sideMirrorGlass.position.set(-0.78, -0.07, -0.703);
    this.cockpitRoot.add(sideMirrorArm, sideMirrorHousing, sideMirrorGlass);

    // 3. Rearview mirror (tucked in upper-right windshield, angled toward driver)
    const mirrorGroup = new THREE.Group();
    mirrorGroup.position.set(0.28, 0.29, -0.70);
    mirrorGroup.rotation.y = 0.14;

    const mirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), interiorDarkMat);
    mirrorStem.position.set(0, 0.08, -0.01);
    const mirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.07, 0.024), interiorDarkMat);
    const mirrorSky = new THREE.Mesh(new THREE.PlaneGeometry(0.215, 0.05), mirrorGlassMat);
    mirrorSky.position.set(0, 0, 0.013);
    const mirrorRoad = new THREE.Mesh(new THREE.PlaneGeometry(0.215, 0.025), mirrorRoadMat);
    mirrorRoad.position.set(0, -0.012, 0.014);
    const mirrorTrailingCar = new THREE.Mesh(new THREE.PlaneGeometry(0.032, 0.018), mirrorCarMat);
    mirrorTrailingCar.position.set(0.03, -0.008, 0.015);
    mirrorGroup.add(mirrorStem, mirrorFrame, mirrorSky, mirrorRoad, mirrorTrailingCar);
    this.cockpitRoot.add(mirrorGroup);

    // 4. Visible Hood & Front Fenders (color matches player's selected car)
    const centerHood = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.06, 0.68), this.cockpitHoodMat);
    centerHood.position.set(0, -0.35, -1.06);
    centerHood.rotation.x = 0.05;
    this.cockpitRoot.add(centerHood);

    const hoodScoop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.36), this.cockpitShadeMat);
    hoodScoop.position.set(0, -0.315, -1.08);
    hoodScoop.rotation.x = 0.05;
    this.cockpitRoot.add(hoodScoop);

    for (const side of [-1, 1]) {
      const fender = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 0.70), this.cockpitShadeMat);
      fender.position.set(side * 0.58, -0.31, -1.05);
      fender.rotation.x = 0.04;
      this.cockpitRoot.add(fender);
    }

    // 5. Sculpted Dashboard & Center Console
    const dashDeck = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 0.42), dashMat);
    dashDeck.position.set(0, -0.39, -0.68);
    this.cockpitRoot.add(dashDeck);

    const dashTrim = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.025, 0.04), trimAccentMat);
    dashTrim.position.set(0, -0.31, -0.50);
    this.cockpitRoot.add(dashTrim);

    // Center console stack on right side
    const consoleStack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.22), interiorDarkMat);
    consoleStack.position.set(0.28, -0.44, -0.62);
    const consoleScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.10), screenMat);
    consoleScreen.position.set(0.28, -0.36, -0.505);
    const consoleGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.02), new THREE.MeshBasicMaterial({ color: '#ff8f3d' }));
    consoleGlow.position.set(0.28, -0.38, -0.503);
    this.cockpitRoot.add(consoleStack, consoleScreen, consoleGlow);

    // 6. Instrument Binnacle & Digital Gauge Cluster behind wheel
    const binnacleHood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.20), interiorDarkMat);
    binnacleHood.position.set(-0.06, -0.22, -0.60);
    const clusterBack = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.12), screenMat);
    clusterBack.position.set(-0.06, -0.22, -0.498);
    this.cockpitRoot.add(binnacleHood, clusterBack);

    // Rev indicator LEDs inside cluster
    this.cockpitRevLeds = [];
    const ledColors = ['#34d399', '#34d399', '#a3e635', '#facc15', '#fb923c', '#ef4444', '#ef4444'];
    for (let i = 0; i < ledColors.length; i += 1) {
      const led = new THREE.Mesh(
        new THREE.PlaneGeometry(0.028, 0.016),
        new THREE.MeshBasicMaterial({ color: ledColors[i] }),
      );
      led.position.set(-0.15 + i * 0.032, -0.185, -0.495);
      led.visible = false;
      this.cockpitRoot.add(led);
      this.cockpitRevLeds.push(led);
    }

    // Digital speedometer core graphic on cluster
    const clusterRing = new THREE.Mesh(
      new THREE.RingGeometry(0.028, 0.038, 12),
      new THREE.MeshBasicMaterial({ color: '#ff8f3d', side: THREE.DoubleSide }),
    );
    clusterRing.position.set(-0.06, -0.23, -0.495);
    this.cockpitRoot.add(clusterRing);

    // 7. Steering Column & Racing Wheel with Gloved Hands
    const steeringColumn = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.22, 6), interiorDarkMat);
    steeringColumn.position.set(-0.06, -0.34, -0.52);
    steeringColumn.rotation.x = Math.PI / 5;
    this.cockpitRoot.add(steeringColumn);

    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(-0.06, -0.28, -0.43);
    wheelGroup.rotation.x = Math.PI / 6.5;

    // Sport rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.019, 6, 12), interiorDarkMat);
    wheelGroup.add(rim);

    // Center spoke + horn emblem
    const spokeH = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.024, 0.016), trimAccentMat);
    const spokeV = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.11, 0.016), trimAccentMat);
    spokeV.position.y = -0.05;
    const centerBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.022, 6), interiorDarkMat);
    centerBoss.rotation.x = Math.PI / 2;
    const emblem = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.025), this.cockpitHoodMat);
    wheelGroup.add(spokeH, spokeV, centerBoss, emblem);

    // Driver hands at 9-and-3 wearing dark racing gloves with yellow accents (matching photo)
    for (const side of [-1, 1]) {
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.058, 0.072), gloveDarkMat);
      glove.position.set(side * 0.112, 0, 0.015);
      wheelGroup.add(glove);

      const gloveStripe = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.022, 0.045), gloveYellowMat);
      gloveStripe.position.set(side * 0.112, 0.01, 0.022);
      wheelGroup.add(gloveStripe);

      const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.048, 0.18), interiorDarkMat);
      sleeve.position.set(side * 0.125, -0.06, 0.11);
      sleeve.rotation.x = -Math.PI / 6;
      wheelGroup.add(sleeve);
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

  setRacers(racers: RacerState[], cameraMode?: CameraMode, smoothFromAttract = false): void {
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
    const mode = cameraMode ?? this.cameraRig.mode;
    if (smoothFromAttract && this.attractInitialized) {
      this.cameraRig.syncFromWorld(this.attractCamPos, this.attractCamLook);
      this.cameraRig.setMode(mode, false);
    } else {
      this.cameraRig.setMode(mode, true);
    }
    this.canvas.dataset.cameraMode = mode;
  }

  getAttractLeadState(time: number) {
    const clock = this.reducedMotion ? 0 : time;
    const baseDistance = this.track.length * this.track.attract.fraction + clock * 36;
    const sample = sampleAtDistance(this.track, baseDistance);
    const livery = AI_LIVERIES[0];
    return {
      carId: livery.carId,
      palette: livery.palette,
      x: sample.x,
      y: sample.y,
      angle: Math.atan2(sample.ty, sample.tx),
      vx: sample.tx * 36,
      vy: sample.ty * 36,
      s: ((baseDistance % this.track.length) + this.track.length) % this.track.length,
    };
  }

  resetMarks(): void {
    this.skidIndex = 0;
    this.lastSkidPos.clear();
    for (let i = 0; i < this.maxSkids; i += 1) {
      this.skidDummy.position.set(0, -999, 0);
      this.skidDummy.scale.set(0, 0, 0);
      this.skidDummy.updateMatrix();
      this.skidMesh.setMatrixAt(i, this.skidDummy.matrix);
    }
    this.skidMesh.instanceMatrix.needsUpdate = true;
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
        prevX: worldX,
        prevY: worldY,
        prevAngle: Math.atan2(sample.ty, sample.tx),
        wrongWay: false,
        wrongWayTime: 0,
        yawRate: 0,
        longAccel: 0,
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
    alpha = 1,
  ): void {
    this.player = player;
    this.carRoot.visible = true;
    this.attractRoot.visible = false;
    const isPaused = mode === 'paused';
    const effectiveDt = isPaused ? 0 : dt;

    for (const racer of racers) {
      const src = racer.id === player.id ? player : racer;
      const prevX = src.prevX ?? src.x;
      const prevY = src.prevY ?? src.y;
      const prevAngle = src.prevAngle ?? src.angle;
      const diffAngle = Math.atan2(Math.sin(src.angle - prevAngle), Math.cos(src.angle - prevAngle));
      const interpAngle = prevAngle + diffAngle * alpha;
      const interpX = THREE.MathUtils.lerp(prevX, src.x, alpha);
      const interpY = THREE.MathUtils.lerp(prevY, src.y, alpha);
      this.cars.get(racer.id)?.update(src, effectiveDt, interpX, interpY, interpAngle);

      // Deposit tire skid marks on road surface when drifting or slipping
      const speed = Math.hypot(src.vx, src.vy);
      if (src.drifting && speed > 32 && !isPaused) {
        const last = this.lastSkidPos.get(racer.id);
        const dist = last ? Math.hypot(interpX - last.x, interpY - last.y) : 999;
        if (dist >= 0.58) {
          this.lastSkidPos.set(racer.id, { x: interpX, y: interpY });

          const sceneX = toSceneX(interpX);
          const sceneZ = toSceneZ(interpY);
          const cosA = Math.cos(interpAngle);
          const sinA = Math.sin(interpAngle);

          // Rear wheel offsets relative to car heading
          const rearX = -0.95;
          for (const side of [-1.22, 1.22]) {
            const markX = sceneX + rearX * cosA - side * sinA;
            const markZ = sceneZ + rearX * sinA + side * cosA;

            this.skidDummy.position.set(markX, ROAD_Y + 0.024, markZ);
            this.skidDummy.rotation.set(0, -interpAngle, 0);
            this.skidDummy.scale.set(1, 1, 1);
            this.skidDummy.updateMatrix();

            this.skidMesh.setMatrixAt(this.skidIndex, this.skidDummy.matrix);
            this.skidIndex = (this.skidIndex + 1) % this.maxSkids;
          }
          this.skidMesh.instanceMatrix.needsUpdate = true;
        }
      } else {
        this.lastSkidPos.delete(racer.id);
      }
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

    if (isCockpit) {
      if (this.steeringWheel) {
        this.steeringWheel.rotation.z = -player.steer * 0.95;
      }
      this.cockpitHoodMat.color.set(player.palette.body);
      this.cockpitShadeMat.color.set(player.palette.shade);

      const speed = Math.hypot(player.vx, player.vy);
      const revRatio = Math.min(1, speed / 220);
      const litLeds = Math.round(revRatio * this.cockpitRevLeds.length);
      for (let i = 0; i < this.cockpitRevLeds.length; i += 1) {
        this.cockpitRevLeds[i].visible = i < litLeds;
      }
    }

    const playerPrevX = player.prevX ?? player.x;
    const playerPrevY = player.prevY ?? player.y;
    const playerPrevAngle = player.prevAngle ?? player.angle;
    const playerDiff = Math.atan2(Math.sin(player.angle - playerPrevAngle), Math.cos(player.angle - playerPrevAngle));
    const playerInterpAngle = playerPrevAngle + playerDiff * alpha;
    const playerInterpX = THREE.MathUtils.lerp(playerPrevX, player.x, alpha);
    const playerInterpY = THREE.MathUtils.lerp(playerPrevY, player.y, alpha);
    const interpPlayer = {
      ...player,
      x: playerInterpX,
      y: playerInterpY,
      angle: playerInterpAngle,
    };

    const focus = new THREE.Vector3(toSceneX(playerInterpX), ROAD_Y, toSceneZ(playerInterpY));
    this.world.update(time, effectiveDt, focus, this.reducedMotion);

    // Update unified camera rig with smoothly interpolated player
    this.cameraRig.update(interpPlayer, effectiveDt, impact);

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
