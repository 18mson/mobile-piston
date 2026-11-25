import * as THREE from 'three';
import type { CarSpec } from '../types';
import { CarView } from './cars';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
const cache = new Map<string, string>();
let activeKey = '';
let activeView: CarView | null = null;

function createPreviewRenderer(): boolean {
  if (renderer) return true;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(1);
    renderer.setSize(256, 256, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    camera.position.set(7.4, 4.4, 7.8);
    camera.lookAt(0, 1.15, 0);

    scene.add(new THREE.HemisphereLight('#d7f1ff', '#3d4a33', 1.1));
    const sun = new THREE.DirectionalLight('#fff3d3', 2.1);
    sun.position.set(6, 10, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 8;
    sun.shadow.camera.bottom = -8;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 30;
    scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 24),
      new THREE.ShadowMaterial({ opacity: 0.32 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 32),
      new THREE.MeshBasicMaterial({ color: '#0c1820', transparent: true, opacity: 0.2, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.01;
    scene.add(disc);
    return true;
  } catch {
    renderer = null;
    scene = null;
    camera = null;
    return false;
  }
}

function disposeCarView(view: CarView): void {
  view.group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else if (material) material.dispose();
  });
}

function ensurePreviewView(car: CarSpec, number: number): CarView | null {
  if (!createPreviewRenderer() || !renderer || !scene || !camera) return null;
  const key = `${car.id}-${number}-${car.palette.body}-${car.palette.stripe}`;
  if (activeView && activeKey === key) return activeView;
  if (activeView) {
    scene.remove(activeView.group);
    disposeCarView(activeView);
  }
  activeKey = key;
  activeView = new CarView(car.id, car.palette, number, false);
  scene.add(activeView.group);
  return activeView;
}

export function renderCarPreview3D(
  targetCanvas: HTMLCanvasElement,
  car: CarSpec,
  number = 1,
  yaw = 0.72,
  pitch = 0.4,
): boolean {
  if (typeof document === 'undefined') return false;
  const view = ensurePreviewView(car, number);
  if (!view || !renderer || !scene || !camera) return false;

  const radius = 11.2;
  const clampedPitch = Math.max(0.15, Math.min(0.88, pitch));
  camera.position.set(
    Math.cos(clampedPitch) * Math.sin(0.75) * radius,
    1.15 + Math.sin(clampedPitch) * radius,
    Math.cos(clampedPitch) * Math.cos(0.75) * radius,
  );
  camera.lookAt(0, 1.15, 0);
  view.group.rotation.y = yaw;
  renderer.render(scene, camera);

  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return false;
  ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
  ctx.drawImage(renderer.domElement, 0, 0, targetCanvas.width, targetCanvas.height);
  return true;
}

export function getCarPreview(car: CarSpec, number = 1): string | null {
  if (typeof document === 'undefined') return null;
  const key = `${car.id}-${number}-${car.palette.body}-${car.palette.stripe}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const view = ensurePreviewView(car, number);
  if (!view || !renderer || !scene || !camera) return null;

  camera.position.set(7.4, 4.4, 7.8);
  camera.lookAt(0, 1.15, 0);
  view.group.rotation.y = 0;
  renderer.render(scene, camera);
  const data = (renderer.domElement as HTMLCanvasElement).toDataURL('image/png');
  cache.set(key, data);
  return data;
}
