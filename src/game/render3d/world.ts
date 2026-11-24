import * as THREE from 'three';
import type { Track } from '../types';
import { COASTLINE } from '../track/telukSore';
import { mulberry32, hash2d } from '../utils';
import {
  POND,
  ROAD_Y,
  TERRAIN_Y,
  WORLD_SCALE,
  coastYAt,
  smoothstep,
  terrainHeightAt,
  toSceneX,
  toSceneZ,
} from './constants';
import {
  createAsphaltTexture,
  createBoostTexture,
  createCheckerTexture,
  createCloudTexture,
  createCurbTexture,
  createGridTexture,
  createShoulderTexture,
  createStartBannerTexture,
  createTerrainDetailTexture,
  createWaterTexture,
} from './textures';

const COAST = COASTLINE.slice(0, 17);

interface TerrainPlacement {
  x: number;
  y: number;
  height: number;
  trackDistance: number;
  kind: string;
}

export interface World3D {
  root: THREE.Group;
  sun: THREE.DirectionalLight;
  update: (time: number, dt: number, focus: THREE.Vector3, reducedMotion: boolean) => void;
}

function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function color(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

function createSky(): THREE.Mesh {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y;
        vec3 zenith = vec3(0.27, 0.62, 0.82);
        vec3 horizon = vec3(0.83, 0.91, 0.84);
        vec3 lower = vec3(0.69, 0.82, 0.78);
        vec3 col = h > 0.0
          ? mix(horizon, zenith, smoothstep(0.0, 0.58, h))
          : mix(horizon, lower, smoothstep(0.0, -0.25, h));
        vec2 pixel = floor(gl_FragCoord.xy);
        float bayer = mod(pixel.x, 2.0) * 2.0 + mod(pixel.y, 2.0);
        col += (bayer / 4.0 - 0.375) * 0.012;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), material);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

function buildTerrain(track: Track): THREE.Mesh {
  const width = 162;
  const depth = 110;
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const stepX = 2400 / width;
  const stepY = 1600 / depth;

  const grassA = color('#2d6b40');
  const grassB = color('#3d8449');
  const grassC = color('#5a9d51');
  const sand = color('#d3b16d');
  const rock = color('#6b7270');
  const pond = color('#1a4d5c');
  const sea = color('#0c3f55');

  for (let iy = 0; iy <= depth; iy += 1) {
    const wy = iy * stepY;
    for (let ix = 0; ix <= width; ix += 1) {
      const wx = ix * stepX;
      const info = terrainHeightAt(track, COAST, wx, wy);
      positions.push(toSceneX(wx), info.height, toSceneZ(wy));
      uvs.push(wx / 42, wy / 42);
      let c = grassA;
      if (info.kind === 'sea') c = sea;
      else if (info.kind === 'pond') c = pond;
      else if (info.kind === 'sand') c = sand;
      else if (info.kind === 'rock') c = rock;
      else {
        const value = hash2d(ix, iy, 31);
        const patch = Math.sin(wx * 0.005) * Math.cos(wy * 0.007 + 0.6);
        c = patch > 0.38 ? grassC : patch < -0.3 ? grassA : value > 0.62 ? grassB : grassA;
      }
      const shade = 0.86 + hash2d(ix, iy, 47) * 0.27;
      colors.push(c.r * shade, c.g * shade, c.b * shade);
    }
  }

  const row = width + 1;
  for (let iy = 0; iy < depth; iy += 1) {
    for (let ix = 0; ix < width; ix += 1) {
      const a = iy * row + ix;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    map: createTerrainDetailTexture(),
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

function createRibbon(
  track: Track,
  halfWidth: number,
  y: number,
  material: THREE.Material,
  closeLoop = true,
): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const count = track.samples.length;
  for (let i = 0; i < count; i += 1) {
    const sample = track.samples[i];
    const lateral = halfWidth * WORLD_SCALE;
    const x = toSceneX(sample.x);
    const z = toSceneZ(sample.y);
    const nx = sample.nx * WORLD_SCALE;
    const nz = sample.ny * WORLD_SCALE;
    positions.push(x + nx * lateral, y, z + nz * lateral);
    positions.push(x - nx * lateral, y, z - nz * lateral);
    const u = (sample.dist * WORLD_SCALE) / 9;
    uvs.push(0, u, 1, u);
    if (i < count - 1 || closeLoop) {
      const next = (i + 1) % count;
      const a = i * 2;
      const b = a + 1;
      const c = next * 2;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function addRoad(group: THREE.Group, track: Track): void {
  const shoulderTexture = createShoulderTexture();
  const asphaltTexture = createAsphaltTexture();
  const shoulder = createRibbon(
    track,
    track.width / 2 + track.shoulder,
    ROAD_Y - 0.06,
    new THREE.MeshLambertMaterial({ map: shoulderTexture, color: '#ffffff' }),
  );
  shoulder.name = 'shoulder';
  group.add(shoulder);

  const asphalt = createRibbon(
    track,
    track.width / 2,
    ROAD_Y,
    new THREE.MeshLambertMaterial({ map: asphaltTexture, color: '#ffffff' }),
  );
  asphalt.name = 'asphalt';
  group.add(asphalt);

  const curbTexture = createCurbTexture();
  for (const side of [1, -1]) {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const count = track.samples.length;
    for (let i = 0; i < count; i += 1) {
      const sample = track.samples[i];
      const centerX = toSceneX(sample.x);
      const centerZ = toSceneZ(sample.y);
      const nx = sample.nx * WORLD_SCALE;
      const nz = sample.ny * WORLD_SCALE;
      const edge = (track.width / 2) * WORLD_SCALE * side;
      const width = 0.55;
      positions.push(centerX + nx * (edge - width), ROAD_Y + 0.02, centerZ + nz * (edge - width));
      positions.push(centerX + nx * (edge + width), ROAD_Y + 0.02, centerZ + nz * (edge + width));
      const u = (sample.dist * WORLD_SCALE) / 3;
      uvs.push(0, u, 1, u);
      const next = (i + 1) % count;
      indices.push(i * 2, next * 2, i * 2 + 1, i * 2 + 1, next * 2, next * 2 + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const curb = new THREE.Mesh(
      geometry,
      new THREE.MeshLambertMaterial({ map: curbTexture, color: '#ffffff', side: THREE.DoubleSide }),
    );
    curb.receiveShadow = true;
    group.add(curb);
  }

  const start = track.samples[0];
  const startGroup = new THREE.Group();
  const heading = Math.atan2(start.tx, start.ty);
  startGroup.position.set(toSceneX(start.x), ROAD_Y + 0.035, toSceneZ(start.y));
  startGroup.rotation.y = heading;
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(track.width * WORLD_SCALE, 3.2),
    new THREE.MeshLambertMaterial({ map: createGridTexture(), color: '#ffffff' }),
  );
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.01;
  line.receiveShadow = true;
  startGroup.add(line);
  group.add(startGroup);

  const gridMaterial = new THREE.MeshBasicMaterial({ color: '#d9d0b6' });
  for (const slot of track.gridSlots) {
    const sample = sampleAt(track, slot.distance);
    const cx = toSceneX(sample.x) + sample.nx * slot.lateral * WORLD_SCALE;
    const cz = toSceneZ(sample.y) + sample.ny * slot.lateral * WORLD_SCALE;
    const slotGroup = new THREE.Group();
    slotGroup.position.set(cx, ROAD_Y + 0.04, cz);
    slotGroup.rotation.y = Math.atan2(sample.tx, sample.ty);
    for (const side of [-1, 1]) {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 2.4), gridMaterial);
      mark.position.set(side * 1.1, 0, 0);
      slotGroup.add(mark);
    }
    group.add(slotGroup);
  }

  for (const pad of track.boostPads) {
    const sample = sampleAt(track, pad.distance);
    const padGroup = new THREE.Group();
    padGroup.position.set(
      toSceneX(sample.x) + sample.nx * pad.lateral * WORLD_SCALE,
      ROAD_Y + 0.045,
      toSceneZ(sample.y) + sample.ny * pad.lateral * WORLD_SCALE,
    );
    padGroup.rotation.y = Math.atan2(sample.tx, sample.ty);
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(7.2, pad.length * WORLD_SCALE),
      new THREE.MeshBasicMaterial({
        map: createBoostTexture(),
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    decal.rotation.x = -Math.PI / 2;
    padGroup.add(decal);
    group.add(padGroup);
  }
}

function sampleAt(track: Track, distance: number) {
  const length = track.samples.length;
  const step = track.length / length;
  let normalized = ((distance % track.length) + track.length) % track.length;
  if (normalized >= track.length) normalized -= track.length;
  const index = Math.floor(normalized / step) % length;
  const next = (index + 1) % length;
  const t = (normalized - track.samples[index].dist) / step;
  const a = track.samples[index];
  const b = track.samples[next];
  const tx = a.tx + (b.tx - a.tx) * t;
  const ty = a.ty + (b.ty - a.ty) * t;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    tx,
    ty,
    nx: -ty,
    ny: tx,
  };
}

function createWater(track: Track, group: THREE.Group): { texture: THREE.Texture; mesh: THREE.Mesh } {
  const texture = createWaterTexture();
  const material = new THREE.MeshLambertMaterial({ map: texture, color: '#c9f3ef' });
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1600), material);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0.38;
  ocean.receiveShadow = true;
  group.add(ocean);

  const pondTexture = createWaterTexture();
  pondTexture.repeat.set(2, 2);
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(1, 32),
    new THREE.MeshLambertMaterial({ map: pondTexture, color: '#d9f7ef' }),
  );
  pond.rotation.x = -Math.PI / 2;
  pond.scale.set(POND.rx * WORLD_SCALE, POND.ry * WORLD_SCALE, 1);
  pond.position.set(toSceneX(POND.x), 0.52, toSceneZ(POND.y));
  pond.receiveShadow = true;
  group.add(pond);

  return { texture, mesh: ocean };
}

function createGrassTexture(): THREE.CanvasTexture {
  const canvas = makeCanvas(64, 64);
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 64, 64);
  const rng = mulberry32(514);
  const colors = ['#2b6b3c', '#3f8547', '#5b9b50', '#7fb85f'];
  for (let i = 0; i < 38; i += 1) {
    const x = 4 + Math.floor(rng() * 56);
    const base = 56 + Math.floor(rng() * 6);
    const height = 10 + Math.floor(rng() * 36);
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.fillRect(x, base - height, 1, height);
    if (rng() > 0.65) ctx.fillRect(x + 1, base - height + 4, 1, height - 4);
    if (rng() > 0.82) {
      ctx.fillStyle = rng() > 0.5 ? '#f1d777' : '#f7e8c8';
      ctx.fillRect(x, base - height - 1, 2, 2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function createGrassCrossGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let blade = 0; blade < 3; blade += 1) {
    const angle = (blade / 3) * Math.PI;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const start = positions.length / 3;
    const width = 1.05;
    const height = 1.25;
    const corners = [
      [-width / 2, 0],
      [width / 2, 0],
      [width / 2, height],
      [-width / 2, height],
    ];
    for (const [x, h] of corners) {
      positions.push(x * cos, h, x * sin);
    }
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createPalmGeometries(): { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry } {
  const trunk = new THREE.CylinderGeometry(0.1, 0.2, 3.1, 5, 1);
  trunk.translate(0, 1.55, 0);

  const positions: number[] = [];
  const indices: number[] = [];
  const leafCount = 7;
  for (let i = 0; i < leafCount; i += 1) {
    const angle = (i / leafCount) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const start = positions.length / 3;
    const baseWidth = 0.26;
    const tip = 2.5 + (i % 3) * 0.24;
    const droop = -0.38 - (i % 2) * 0.26;
    const vertices = [
      [0, -0.05, -baseWidth],
      [0, -0.05, baseWidth],
      [tip * 0.65, droop * 0.55, 0.28],
      [tip, droop, 0],
    ];
    for (const [x, y, z] of vertices) {
      positions.push(x * cos - z * sin, y + 3.05, x * sin + z * cos);
    }
    indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  crown.setIndex(indices);
  crown.computeVertexNormals();
  return { trunk, crown };
}

function buildBroadleafTrees(group: THREE.Group, locations: TerrainPlacement[], seed: number): void {
  const trunk = new THREE.CylinderGeometry(0.13, 0.24, 2.6, 5);
  trunk.translate(0, 1.3, 0);
  const canopy = new THREE.IcosahedronGeometry(1, 0);
  canopy.scale(2.0, 1.55, 2.0);
  canopy.translate(0, 3.7, 0);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: '#6a4b33', flatShading: true });
  const canopyMaterial = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const trunks = new THREE.InstancedMesh(trunk, trunkMaterial, locations.length);
  const canopies = new THREE.InstancedMesh(canopy, canopyMaterial, locations.length);
  const dummy = new THREE.Object3D();
  const rng = mulberry32(seed);
  const base = new THREE.Color('#3e8b47');
  locations.forEach((place, index) => {
    const scale = 0.8 + rng() * 0.85;
    dummy.position.set(toSceneX(place.x), place.height, toSceneZ(place.y));
    dummy.rotation.set(0, rng() * Math.PI * 2, 0);
    dummy.scale.set(scale, scale * (0.8 + rng() * 0.5), scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    canopies.setMatrixAt(index, dummy.matrix);
    canopies.setColorAt(index, base.clone().offsetHSL((rng() - 0.5) * 0.04, (rng() - 0.5) * 0.1, (rng() - 0.5) * 0.1));
  });
  trunks.castShadow = true;
  canopies.castShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  canopies.instanceMatrix.needsUpdate = true;
  if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
  group.add(trunks, canopies);
}

function buildPalms(group: THREE.Group, track: Track, locations: TerrainPlacement[]): void {
  const { trunk, crown } = createPalmGeometries();
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: '#795437', flatShading: true });
  const crownMaterial = new THREE.MeshLambertMaterial({
    color: '#57a84e',
    side: THREE.DoubleSide,
    flatShading: true,
  });
  const trunks = new THREE.InstancedMesh(trunk, trunkMaterial, locations.length);
  const crowns = new THREE.InstancedMesh(crown, crownMaterial, locations.length);
  const dummy = new THREE.Object3D();
  const rng = mulberry32(7101 + track.samples.length);
  locations.forEach((location, index) => {
    const scale = 0.8 + rng() * 0.75;
    dummy.position.set(toSceneX(location.x), location.height, toSceneZ(location.y));
    dummy.rotation.set(0, rng() * Math.PI * 2, (rng() - 0.5) * 0.08);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    crowns.setMatrixAt(index, dummy.matrix);
  });
  trunks.castShadow = true;
  crowns.castShadow = true;
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  group.add(trunks, crowns);
}

function buildBushes(
  group: THREE.Group,
  locations: TerrainPlacement[],
  seed: number,
  geometry: THREE.BufferGeometry,
  baseColor: string,
): void {
  const material = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  const mesh = new THREE.InstancedMesh(geometry, material, locations.length);
  const dummy = new THREE.Object3D();
  const rng = mulberry32(seed);
  const base = new THREE.Color(baseColor);
  locations.forEach((location, index) => {
    const scale = 0.45 + rng() * 1.15;
    dummy.position.set(toSceneX(location.x), location.height + scale * 0.32, toSceneZ(location.y));
    dummy.rotation.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.2);
    dummy.scale.set(scale * (0.8 + rng() * 0.6), scale * (0.65 + rng() * 0.45), scale * (0.8 + rng() * 0.6));
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    const tint = base.clone().offsetHSL((rng() - 0.5) * 0.04, (rng() - 0.5) * 0.12, (rng() - 0.5) * 0.12);
    mesh.setColorAt(index, tint);
  });
  mesh.receiveShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
}

function createHut(worldX: number, worldY: number, height: number, rotation: number): THREE.Group {
  const hut = new THREE.Group();
  const wallMaterial = new THREE.MeshLambertMaterial({ color: '#9a6d43', flatShading: true });
  const roofMaterial = new THREE.MeshLambertMaterial({ color: '#6d4830', flatShading: true });
  const trimMaterial = new THREE.MeshLambertMaterial({ color: '#d9b06d', flatShading: true });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.4, 3.6), wallMaterial);
  walls.position.y = 1.2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  hut.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 1.8, 4), roofMaterial);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 3.3;
  roof.castShadow = true;
  hut.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.12), trimMaterial);
  door.position.set(0.6, 0.7, 1.83);
  hut.add(door);
  lutWindows(hut, trimMaterial);
  hut.position.set(toSceneX(worldX), height, toSceneZ(worldY));
  hut.rotation.y = rotation;
  return hut;
}

function lutWindows(group: THREE.Group, material: THREE.Material): void {
  const window = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.12), material);
  window.position.set(-1.2, 1.4, 1.83);
  group.add(window);
  const window2 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.12), material);
  window2.position.set(2.34, 1.4, 0);
  window2.rotation.y = Math.PI / 2;
  group.add(window2);
}

function createLighthouse(worldX: number, worldY: number, height: number): THREE.Group {
  const group = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: '#e4ddc5', flatShading: true });
  const red = new THREE.MeshLambertMaterial({ color: '#c84d38', flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: '#2a3337', flatShading: true });
  for (let i = 0; i < 5; i += 1) {
    const segment = new THREE.Mesh(new THREE.CylinderGeometry(1.5 - i * 0.14, 1.7 - i * 0.14, 2.6, 8), i % 2 === 0 ? white : red);
    segment.position.y = 1.3 + i * 2.6;
    segment.castShadow = true;
    group.add(segment);
  }
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.4, 8), dark);
  lantern.position.y = 14.1;
  lantern.castShadow = true;
  group.add(lantern);
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.65, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffe8a2' }));
  light.position.y = 14.1;
  group.add(light);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.6, 8), red);
  roof.position.y = 15.6;
  group.add(roof);
  group.position.set(toSceneX(worldX), height, toSceneZ(worldY));
  return group;
}

function createStartTowers(track: Track): THREE.Group {
  const group = new THREE.Group();
  const start = track.samples[0];
  const material = new THREE.MeshLambertMaterial({ color: '#f0dfb7', flatShading: true });
  const orange = new THREE.MeshLambertMaterial({ color: '#e76239', flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: '#253238', flatShading: true });
  const half = (track.width / 2 + 8) * WORLD_SCALE;
  const y = ROAD_Y - 0.1;
  for (const side of [-1, 1]) {
    const tower = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.0, 8.2, 1.0), material);
    base.position.y = 4.1;
    base.castShadow = true;
    tower.add(base);
    for (let i = 0; i < 3; i += 1) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.03, 0.18, 1.03), orange);
      stripe.position.y = 0.7 + i * 2.4;
      tower.add(stripe);
    }
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.32, 1.35), orange);
    cap.position.y = 8.35;
    tower.add(cap);
    tower.position.set(
      toSceneX(start.x) + start.nx * half * side,
      y,
      toSceneZ(start.y) + start.ny * half * side,
    );
    tower.rotation.y = Math.atan2(start.tx, start.ty);
    group.add(tower);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 0.35, 0.4), dark);
  beam.position.set(toSceneX(start.x), y + 8.4, toSceneZ(start.y));
  beam.rotation.y = Math.atan2(start.tx, start.ty);
  group.add(beam);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 1.75, 2.3),
    new THREE.MeshBasicMaterial({ map: createStartBannerTexture(track.name), side: THREE.DoubleSide }),
  );
  banner.position.set(toSceneX(start.x), y + 7.35, toSceneZ(start.y));
  banner.rotation.y = Math.atan2(-start.tx, -start.ty);
  group.add(banner);
  return group;
}

function createFlag(angle: number): THREE.Group {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 4.2, 4),
    new THREE.MeshLambertMaterial({ color: '#59462e' }),
  );
  pole.position.y = 2.1;
  group.add(pole);
  for (let i = 0; i < 2; i += 1) {
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.8),
      new THREE.MeshLambertMaterial({
        color: i === 0 ? '#ef8a3b' : '#f3e5c8',
        side: THREE.DoubleSide,
        flatShading: true,
      }),
    );
    flag.position.set(0.9, 3.4 - i * 0.9, 0);
    group.add(flag);
  }
  group.rotation.y = angle;
  return group;
}

function createBoat(x: number, z: number, scale: number, angle: number): THREE.Group {
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(4.2, 0.55, 1.5),
    new THREE.MeshLambertMaterial({ color: '#d8c49b', flatShading: true }),
  );
  hull.position.y = 0.15;
  boat.add(hull);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.8, 1.0),
    new THREE.MeshLambertMaterial({ color: '#9d7148', flatShading: true }),
  );
  cabin.position.set(-0.5, 0.75, 0);
  boat.add(cabin);
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 2.6, 4),
    new THREE.MeshLambertMaterial({ color: '#5c432b' }),
  );
  mast.position.set(1.2, 1.4, 0);
  boat.add(mast);
  const sail = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 2.0),
    new THREE.MeshLambertMaterial({ color: '#f3e5c8', side: THREE.DoubleSide }),
  );
  sail.position.set(1.9, 2.2, 0);
  boat.add(sail);
  boat.position.set(toSceneX(x), 0.45, toSceneZ(z));
  boat.rotation.y = angle;
  boat.scale.setScalar(scale);
  return boat;
}

function createDistantIsland(x: number, z: number, scale: number, seed: number): THREE.Group {
  const group = new THREE.Group();
  const rng = mulberry32(seed);
  const sand = new THREE.Mesh(
    new THREE.CylinderGeometry(4.8, 5.8, 0.5, 8),
    new THREE.MeshLambertMaterial({ color: '#cfae72', flatShading: true }),
  );
  sand.position.y = 0.2;
  group.add(sand);
  for (let i = 0; i < 3; i += 1) {
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(3.4 + rng() * 2, 1.8 + rng() * 2.6, 7),
      new THREE.MeshLambertMaterial({ color: i === 0 ? '#356d43' : '#4d8550', flatShading: true }),
    );
    hill.position.set((rng() - 0.5) * 3, 1.0, (rng() - 0.5) * 3);
    group.add(hill);
  }
  group.position.set(toSceneX(x), 0, toSceneZ(z));
  group.scale.setScalar(scale);
  return group;
}

function createRoadsideTires(track: Track): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color: '#202629', flatShading: true });
  const tireGeometry = new THREE.TorusGeometry(0.5, 0.22, 5, 10);
  const stackCount = 12;
  const mesh = new THREE.InstancedMesh(tireGeometry, material, stackCount * 3);
  const dummy = new THREE.Object3D();
  let index = 0;
  const rng = mulberry32(9001);
  const fractions = [0.11, 0.18, 0.31, 0.46, 0.58, 0.72, 0.86, 0.94];
  for (let stack = 0; stack < stackCount; stack += 1) {
    const sample = track.samples[Math.floor(track.samples.length * fractions[stack % fractions.length])];
    const side = stack % 2 === 0 ? 1 : -1;
    const offset = (track.width / 2 + track.shoulder + 4) * WORLD_SCALE * side;
    const x = toSceneX(sample.x) + sample.nx * offset;
    const z = toSceneZ(sample.y) + sample.ny * offset;
    for (let level = 0; level < 3; level += 1) {
      dummy.position.set(x, ROAD_Y + 0.25 + level * 0.42, z);
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.scale.set(0.8 + rng() * 0.15, 0.8 + rng() * 0.15, 0.8 + rng() * 0.15);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      index += 1;
    }
  }
  mesh.castShadow = true;
  mesh.instanceMatrix.needsUpdate = true;
  group.add(mesh);
  return group;
}

function addCoastFoam(root: THREE.Group): void {
  const material = new THREE.LineBasicMaterial({
    color: '#e7f5df',
    transparent: true,
    opacity: 0.5,
  });
  for (const offset of [0, 2.2, 4.6]) {
    const points: THREE.Vector3[] = [];
    for (const point of COAST) {
      const wave = Math.sin(point.x * 0.04 + offset) * 1.3;
      points.push(new THREE.Vector3(
        toSceneX(point.x),
        0.44 + offset * 0.006,
        toSceneZ(point.y + 9 + wave + offset),
      ));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    root.add(new THREE.Line(geometry, material));
  }
}

export function createWorld(track: Track): World3D {
  const root = new THREE.Group();
  const rng = mulberry32(21091 + track.samples.length);
  const sky = createSky();
  root.add(sky);

  const water = createWater(track, root);
  root.add(buildTerrain(track));
  addRoad(root, track);
  addCoastFoam(root);

  const terrainPlacements: TerrainPlacement[] = [];
  for (let attempt = 0; attempt < 4200; attempt += 1) {
    const x = 50 + rng() * 2300;
    const y = 100 + rng() * 1400;
    const info = terrainHeightAt(track, COAST, x, y);
    if (info.kind === 'sea' || info.kind === 'pond') continue;
    if (info.trackDistance < 68) continue;
    terrainPlacements.push({ x, y, height: info.height, trackDistance: info.trackDistance, kind: info.kind });
    if (terrainPlacements.length > 1000) break;
  }

  const canPlace = (place: TerrainPlacement, minTrack: number) =>
    place.trackDistance >= minTrack && place.kind !== 'sea' && place.kind !== 'pond';

  const palms = terrainPlacements.filter((place, index) => canPlace(place, 70) && index % 2 === 0);
  const bushes = terrainPlacements.filter((place, index) => canPlace(place, 62) && index % 2 === 1);
  const rocks = terrainPlacements.filter((place, index) => canPlace(place, 58) && index % 3 === 0);
  const flowers = terrainPlacements.filter((place, index) => canPlace(place, 60) && index % 5 === 0);

  for (let i = 0; i < track.samples.length; i += 4) {
    const sample = track.samples[i];
    for (const side of [-1, 1]) {
      if (rng() > 0.55) continue;
      const offset = (track.width / 2 + track.shoulder + 7 + rng() * 22) * side;
      const wx = sample.x + sample.nx * offset;
      const wy = sample.y + sample.ny * offset;
      const info = terrainHeightAt(track, COAST, wx, wy);
      if (info.kind !== 'sea' && info.kind !== 'pond') {
        palms.push({ x: wx, y: wy, height: info.height, trackDistance: info.trackDistance, kind: info.kind });
      }
    }
  }

  buildPalms(root, track, palms);

  const broadleaf: TerrainPlacement[] = [];
  const broadleafRng = mulberry32(7502);
  for (let attempt = 0; attempt < 2200; attempt += 1) {
    const x = 50 + broadleafRng() * 2300;
    const y = 100 + broadleafRng() * 1400;
    const info = terrainHeightAt(track, COAST, x, y);
    if (info.kind === 'sea' || info.kind === 'pond') continue;
    if (info.trackDistance < 90) continue;
    broadleaf.push({ x, y, height: info.height, trackDistance: info.trackDistance, kind: info.kind });
    if (broadleaf.length > 260) break;
  }
  buildBroadleafTrees(root, broadleaf, 741);

  const grassLocations: TerrainPlacement[] = [];
  for (let i = 0; i < 5000; i += 1) {
    const x = 40 + rng() * 2320;
    const y = 80 + rng() * 1460;
    const info = terrainHeightAt(track, COAST, x, y);
    if (info.kind === 'sea' || info.kind === 'pond') continue;
    if (info.trackDistance < 54) continue;
    grassLocations.push({ x, y, height: info.height, trackDistance: info.trackDistance, kind: info.kind });
    if (grassLocations.length > 2300) break;
  }
  const grassMaterial = new THREE.MeshLambertMaterial({
    map: createGrassTexture(),
    transparent: true,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    color: '#ffffff',
  });
  const grass = new THREE.InstancedMesh(createGrassCrossGeometry(), grassMaterial, grassLocations.length);
  const grassDummy = new THREE.Object3D();
  const grassRng = mulberry32(2202);
  grassLocations.forEach((place, index) => {
    grassDummy.position.set(toSceneX(place.x), place.height + 0.02, toSceneZ(place.y));
    grassDummy.rotation.set(0, grassRng() * Math.PI * 2, 0);
    const scale = 0.55 + grassRng() * 0.9;
    grassDummy.scale.set(scale, scale * (0.8 + grassRng() * 0.7), scale);
    grassDummy.updateMatrix();
    grass.setMatrixAt(index, grassDummy.matrix);
  });
  grass.instanceMatrix.needsUpdate = true;
  root.add(grass);

  const bushGeometry = new THREE.IcosahedronGeometry(1, 0);
  buildBushes(root, bushes, 411, bushGeometry, '#3c7b43');
  const rockGeometry = new THREE.DodecahedronGeometry(0.8, 0);
  buildBushes(root, rocks, 991, rockGeometry, '#6f7470');

  const flowerMaterial = new THREE.MeshLambertMaterial({ color: '#f1d777', flatShading: true });
  const flowerMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.16, 0), flowerMaterial, flowers.length);
  const dummy = new THREE.Object3D();
  const flowerRng = mulberry32(619);
  flowers.forEach((place, index) => {
    dummy.position.set(toSceneX(place.x), place.height + 0.3, toSceneZ(place.y));
    dummy.rotation.set(0, flowerRng() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.8 + flowerRng() * 0.6);
    dummy.updateMatrix();
    flowerMesh.setMatrixAt(index, dummy.matrix);
  });
  flowerMesh.instanceMatrix.needsUpdate = true;
  root.add(flowerMesh);

  const hutPositions: [number, number, number][] = [
    [900, 1320, 0.2],
    [990, 1345, -0.15],
    [1180, 1330, 0.1],
    [1275, 1350, 0.35],
    [1420, 1290, -0.25],
    [760, 1320, 0.4],
  ];
  for (const [x, y, angle] of hutPositions) {
    const info = terrainHeightAt(track, COAST, x, y);
    if (info.kind === 'sea') continue;
    const hut = createHut(x, y, info.height, angle);
    root.add(hut);
  }
  const lighthouse = createLighthouse(1670, 480, terrainHeightAt(track, COAST, 1670, 480).height);
  root.add(lighthouse);
  root.add(createStartTowers(track));
  root.add(createRoadsideTires(track));

  for (let i = 0; i < 12; i += 1) {
    const sample = track.samples[Math.floor((i / 12) * track.samples.length)];
    const offset = (track.width / 2 + 10) * WORLD_SCALE * (i % 2 === 0 ? 1 : -1);
    const flag = createFlag(rng() * Math.PI * 2);
    flag.position.set(
      toSceneX(sample.x) + sample.nx * offset,
      ROAD_Y,
      toSceneZ(sample.y) + sample.ny * offset,
    );
    root.add(flag);
  }

  for (const [x, z, scale, angle] of [
    [1780, 270, 1.2, 0.3],
    [1900, 320, 0.9, -0.2],
    [340, 270, 1.0, 0.6],
    [1520, 250, 0.8, -0.5],
  ]) {
    root.add(createBoat(x, z, scale, angle));
  }
  for (const [x, z, scale, seed] of [
    [2100, 170, 1.5, 11],
    [370, 140, 1.0, 23],
    [2250, 1300, 1.2, 39],
  ]) {
    root.add(createDistantIsland(x, z, scale, seed));
  }

  const cloudTexture = createCloudTexture(41);
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < 30; i += 1) {
    const material = new THREE.SpriteMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    const cloud = new THREE.Sprite(material);
    const x = -650 + rng() * 1300;
    const z = -500 + rng() * 1000;
    const y = 24 + rng() * 48;
    cloud.position.set(x, y, z);
    cloud.scale.set(40 + rng() * 62, 15 + rng() * 20, 1);
    cloud.userData.baseX = x;
    cloud.userData.speed = 0.35 + rng() * 0.55;
    clouds.push(cloud);
    root.add(cloud);
  }

  const hemi = new THREE.HemisphereLight('#d7f1ff', '#4d5d42', 0.9);
  root.add(hemi);
  const sun = new THREE.DirectionalLight('#fff1cf', 1.8);
  sun.position.set(60, 100, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 260;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  root.add(sun);
  root.add(sun.target);

  const update = (time: number, dt: number, focus: THREE.Vector3, reducedMotion: boolean) => {
    if (!reducedMotion) {
      const waterTexture = water.texture;
      waterTexture.offset.x = (time * 0.002) % 1;
      waterTexture.offset.y = (time * 0.0011) % 1;
      for (const cloud of clouds) {
        const baseX = cloud.userData.baseX as number;
        const speed = cloud.userData.speed as number;
        cloud.position.x = baseX + (time * speed) % 1200;
      }
    }
    sun.position.set(focus.x + 55, focus.y + 90, focus.z + 45);
    sun.target.position.copy(focus);
    sun.target.updateMatrixWorld();
  };

  return { root, sun, update };
}
