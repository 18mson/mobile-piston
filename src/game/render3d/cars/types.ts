import * as THREE from 'three';
import type { CarId, CarPalette } from '../../types';
import type { GreenhouseSpec } from '../greenhouse';

export interface WheelRef {
  pivot: THREE.Group;
  mesh: THREE.Mesh;
  front: boolean;
}

export interface LoftStation {
  x: number;
  yBot: number;
  yTop: number;
  wBot: number;
  wMid: number;
  wTop: number;
  crown?: number;
}

export interface CarMaterials {
  body: THREE.MeshToonMaterial;
  shade: THREE.MeshToonMaterial;
  highlight: THREE.MeshToonMaterial;
  glass: THREE.MeshToonMaterial;
  stripe: THREE.MeshToonMaterial;
  chrome: THREE.MeshToonMaterial;
  darkTrim: THREE.MeshToonMaterial;
  pillar: THREE.MeshToonMaterial;
  well: THREE.MeshToonMaterial;
  lip: THREE.MeshToonMaterial;
  rearLip: THREE.MeshToonMaterial | null;
  light: THREE.MeshBasicMaterial;
  tail: THREE.MeshBasicMaterial;
  outline: THREE.MeshBasicMaterial;
}

export interface WheelSpec {
  radius: number;
  width: number;
  x: number;
  z: number;
  rimColor: string;
  whitewall?: boolean;
}

export interface CarBuildContext {
  carId: CarId;
  palette: CarPalette;
  number: number;
  openWheel: boolean;
  group: THREE.Group;
  body: THREE.Group;
  hulls: LoftStation[][];
  wheels: WheelRef[];
  brakeLights: THREE.Mesh[];
  flames: THREE.Mesh[];
  flameGroups: THREE.Group[];
  stockParts: Partial<Record<string, THREE.Object3D[]>>;
  ghSpec: GreenhouseSpec | null;
  mats: CarMaterials;
}
