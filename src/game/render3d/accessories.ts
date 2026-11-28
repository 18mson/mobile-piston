import * as THREE from 'three';
import { getAccessory } from '../data/accessories';
import type { CarId, CarPalette } from '../types';
import { addBox, addOutline, addProfile, addTube, createToonMaterial } from './cars/primitives';
import type { CarBuildContext, CarMaterials } from './cars/types';

export interface CarAnchors {
  roof: [number, number, number];
  hood: [number, number, number];
  nose: [number, number, number];
  rearDeck: [number, number, number];
  halfWidth: number;
  sideY: number;
  frontWheelX: number;
  rearWheelX: number;
}

export interface AccessoryHandle {
  update?: (dt: number, elapsed: number) => void;
}

export interface AccessoryKit {
  body: THREE.Group;
  mats: CarMaterials;
  palette: CarPalette;
  addBox: (
    size: [number, number, number],
    pos: [number, number, number],
    mat: THREE.Material,
    outline?: number,
  ) => THREE.Mesh;
  addTube: (
    a: [number, number, number],
    b: [number, number, number],
    radius: number,
    mat: THREE.Material,
  ) => THREE.Mesh;
  addProfile: (
    points: [number, number][],
    width: number,
    mat: THREE.Material,
    bevel?: number,
    outline?: number,
  ) => THREE.Mesh;
  material: (hex: string, transparent?: boolean, opacity?: number) => THREE.MeshToonMaterial;
  addMesh: (mesh: THREE.Mesh, outline?: number) => THREE.Mesh;
}

export const ACCESSORY_ANCHORS: Record<CarId, CarAnchors> = {
  mcqueen: {
    roof: [-0.35, 1.9, 0],
    hood: [1.82, 1.16, 0],
    nose: [2.86, 0.44, 0],
    rearDeck: [-2.55, 1.24, 0],
    halfWidth: 1.68,
    sideY: 0.48,
    frontWheelX: 1.75,
    rearWheelX: -1.75,
  },
  luigi: {
    roof: [-0.35, 2.02, 0],
    hood: [1.35, 1.18, 0],
    nose: [2.16, 0.46, 0],
    rearDeck: [-1.85, 1.18, 0],
    halfWidth: 1.36,
    sideY: 0.48,
    frontWheelX: 1.38,
    rearWheelX: -1.38,
  },
  guido: {
    roof: [-0.1, 1.83, 0],
    hood: [1.3, 1.02, 0],
    nose: [1.7, 0.5, 0],
    rearDeck: [-1.72, 1.06, 0],
    halfWidth: 1.16,
    sideY: 0.46,
    frontWheelX: 1.15,
    rearWheelX: -1.23,
  },
  sally: {
    roof: [-0.3, 1.92, 0],
    hood: [1.7, 1.14, 0],
    nose: [2.68, 0.44, 0],
    rearDeck: [-2.38, 1.28, 0],
    halfWidth: 1.6,
    sideY: 0.46,
    frontWheelX: 1.69,
    rearWheelX: -1.64,
  },
  chick: {
    roof: [-0.35, 1.93, 0],
    hood: [1.94, 1.23, 0],
    nose: [2.98, 0.48, 0],
    rearDeck: [-2.74, 1.24, 0],
    halfWidth: 1.68,
    sideY: 0.48,
    frontWheelX: 1.85,
    rearWheelX: -1.85,
  },
  mater: {
    roof: [0.08, 2.25, 0],
    hood: [1.85, 1.44, 0],
    nose: [2.94, 0.56, 0],
    rearDeck: [-2.65, 1.1, 0],
    halfWidth: 1.66,
    sideY: 0.56,
    frontWheelX: 1.94,
    rearWheelX: -1.88,
  },
  doc: {
    roof: [-0.3, 1.99, 0],
    hood: [2.02, 1.3, 0],
    nose: [3.08, 0.52, 0],
    rearDeck: [-2.72, 1.14, 0],
    halfWidth: 1.68,
    sideY: 0.52,
    frontWheelX: 1.96,
    rearWheelX: -1.9,
  },
  cruz: {
    roof: [-0.34, 1.77, 0],
    hood: [1.78, 1.12, 0],
    nose: [2.76, 0.44, 0],
    rearDeck: [-2.42, 1.18, 0],
    halfWidth: 1.62,
    sideY: 0.46,
    frontWheelX: 1.69,
    rearWheelX: -1.69,
  },
  francesco: {
    roof: [0.15, 0.9, 0],
    hood: [1.85, 0.72, 0],
    nose: [2.8, 0.38, 0],
    rearDeck: [-2.46, 1.56, 0],
    halfWidth: 1.12,
    sideY: 0.42,
    frontWheelX: 1.78,
    rearWheelX: -1.58,
  },
  storm: {
    roof: [-0.4, 1.69, 0],
    hood: [1.88, 1.04, 0],
    nose: [2.88, 0.4, 0],
    rearDeck: [-2.54, 1.16, 0],
    halfWidth: 1.68,
    sideY: 0.44,
    frontWheelX: 1.78,
    rearWheelX: -1.78,
  },
  ramone: {
    roof: [-0.34, 1.8, 0],
    hood: [2.04, 1.1, 0],
    nose: [3.12, 0.44, 0],
    rearDeck: [-2.82, 1.14, 0],
    halfWidth: 1.68,
    sideY: 0.42,
    frontWheelX: 1.9,
    rearWheelX: -1.9,
  },
  fillmore: {
    roof: [0.0, 2.25, 0],
    hood: [2.42, 1.2, 0],
    nose: [2.56, 0.48, 0],
    rearDeck: [-2.44, 1.24, 0],
    halfWidth: 1.52,
    sideY: 0.48,
    frontWheelX: 1.67,
    rearWheelX: -1.67,
  },
  finn: {
    roof: [-0.36, 1.8, 0],
    hood: [1.84, 1.12, 0],
    nose: [2.86, 0.48, 0],
    rearDeck: [-2.48, 1.18, 0],
    halfWidth: 1.56,
    sideY: 0.48,
    frontWheelX: 1.72,
    rearWheelX: -1.72,
  },
  shu: {
    roof: [-0.34, 1.61, 0],
    hood: [1.88, 0.98, 0],
    nose: [2.94, 0.4, 0],
    rearDeck: [-2.52, 1.12, 0],
    halfWidth: 1.68,
    sideY: 0.42,
    frontWheelX: 1.78,
    rearWheelX: -1.78,
  },
  king: {
    roof: [-0.36, 1.89, 0],
    hood: [2.04, 1.14, 0],
    nose: [3.16, 0.42, 0],
    rearDeck: [-2.78, 1.22, 0],
    halfWidth: 1.68,
    sideY: 0.46,
    frontWheelX: 1.9,
    rearWheelX: -1.9,
  },
};

type AccessoryBuilderFn = (kit: AccessoryKit, a: CarAnchors, palette: CarPalette) => AccessoryHandle | void;

export const ACCESSORY_BUILDERS: Record<string, AccessoryBuilderFn> = {
  'antenna-flag': (kit, a, palette) => {
    const base: [number, number, number] = [a.roof[0] - 0.38, a.roof[1] - 0.02, -0.46];
    kit.addTube(base, [base[0], base[1] + 0.78, base[2]], 0.024, kit.mats.chrome);
    kit.addBox([0.36, 0.18, 0.04], [base[0] - 0.18, base[1] + 0.66, base[2]], kit.material(palette.stripe), 0.02);
  },

  'fog-lights': (kit, a) => {
    const barPos: [number, number, number] = [a.nose[0] + 0.04, a.nose[1] + 0.18, 0];
    kit.addBox([0.08, 0.06, 1.24], barPos, kit.mats.darkTrim, 0.02);
    const glow = new THREE.MeshBasicMaterial({ color: '#fff3a8' });
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 12), glow);
      lamp.rotation.z = Math.PI / 2;
      lamp.position.set(barPos[0] + 0.04, barPos[1] + 0.02, side * 0.42);
      kit.addMesh(lamp, 0.025);
    }
  },

  'front-splitter': (kit, a, palette) => {
    const y = Math.max(0.28, a.sideY - 0.14);
    const width = a.halfWidth * 1.65;
    kit.addBox([0.5, 0.06, width], [a.nose[0] - 0.04, y, 0], kit.mats.darkTrim, 0.025);
    const accentMat = kit.material(palette.stripe);
    for (const side of [-1, 1]) {
      kit.addBox([0.28, 0.14, 0.06], [a.nose[0] - 0.02, y + 0.06, side * (width * 0.5)], accentMat, 0.02);
    }
  },

  'mud-flaps': (kit, a, palette) => {
    const mat = kit.material(palette.shade);
    const zPos = Math.max(0.75, a.halfWidth - 0.28);
    for (const side of [-1, 1]) {
      kit.addBox([0.06, 0.34, 0.42], [a.rearWheelX - 0.62, a.sideY - 0.12, side * zPos], mat, 0.02);
    }
  },

  'side-skirts': (kit, a) => {
    const span = Math.max(1.2, Math.abs(a.frontWheelX - a.rearWheelX) - 1.55);
    const cx = (a.frontWheelX + a.rearWheelX) * 0.5;
    for (const side of [-1, 1]) {
      kit.addBox([span, 0.1, 0.14], [cx, a.sideY - 0.12, side * (a.halfWidth + 0.02)], kit.mats.darkTrim, 0.025);
    }
  },

  'roof-beacon': (kit, a) => {
    kit.addBox([0.34, 0.08, 0.44], [a.roof[0], a.roof[1] + 0.03, 0], kit.mats.darkTrim, 0.025);
    const beaconSpin = new THREE.Group();
    beaconSpin.position.set(a.roof[0], a.roof[1] + 0.14, 0);
    const amber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.16, 0.16, 10),
      new THREE.MeshBasicMaterial({ color: '#ffb326' }),
    );
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.08, 0.09),
      new THREE.MeshBasicMaterial({ color: '#fff3b8' }),
    );
    beaconSpin.add(amber, bar);
    kit.body.add(beaconSpin);
    return {
      update: (dt) => {
        beaconSpin.rotation.y += dt * 7.5;
      },
    };
  },

  'hood-scoop': (kit, a) => {
    kit.addBox([0.72, 0.16, 0.66], [a.hood[0], a.hood[1] + 0.06, 0], kit.mats.body, 0.03);
    kit.addBox([0.08, 0.11, 0.52], [a.hood[0] + 0.35, a.hood[1] + 0.06, 0], kit.mats.darkTrim, 0.02);
  },

  'gt-wing': (kit, a, palette) => {
    const span = a.halfWidth * 1.62;
    const wingY = a.rearDeck[1] + 0.38;
    const x = a.rearDeck[0];
    kit.addBox([0.46, 0.08, span], [x, wingY, 0], kit.mats.darkTrim, 0.03);
    const stripeMat = kit.material(palette.stripe);
    for (const side of [-1, 1]) {
      kit.addBox([0.2, 0.42, 0.08], [x + 0.04, wingY - 0.22, side * 0.68], kit.mats.darkTrim, 0.02);
      kit.addBox([0.52, 0.22, 0.06], [x, wingY, side * (span * 0.5)], stripeMat, 0.02);
    }
  },

  underglow: (kit, a, palette) => {
    const glowColor = palette.stripe;
    const span = Math.max(1.5, Math.abs(a.frontWheelX - a.rearWheelX) - 1.35);
    const cx = (a.frontWheelX + a.rearWheelX) * 0.5;
    const glowMat = new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.78,
    });
    for (const side of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(span, 0.05, 0.16), glowMat);
      strip.position.set(cx, 0.26, side * (a.halfWidth - 0.14));
      kit.body.add(strip);
    }
    return {
      update: (_dt, elapsed) => {
        glowMat.opacity = 0.64 + Math.sin(elapsed * 5.2) * 0.22;
      },
    };
  },

  'lightning-wing': (kit, a, palette) => {
    const x = a.rearDeck[0] - 0.08;
    const wingY = a.rearDeck[1] + 0.42;
    const wingMat = kit.material(palette.stripe);
    kit.addBox([0.5, 0.08, 2.74], [x, wingY, 0], wingMat, 0.03);
    for (const side of [-1, 1]) {
      kit.addProfile(
        [
          [x + 0.16, wingY - 0.34],
          [x + 0.02, wingY + 0.02],
          [x - 0.2, wingY + 0.02],
          [x - 0.02, wingY - 0.34],
        ],
        0.08,
        kit.mats.body,
        0.02,
        0.025,
      ).position.z = side * 0.78;
      kit.addBox([0.56, 0.24, 0.06], [x, wingY + 0.03, side * 1.36], kit.mats.body, 0.02);
    }
  },

  'roof-scoop': (kit, a) => {
    kit.addBox([0.66, 0.15, 0.56], [a.roof[0] + 0.08, a.roof[1] + 0.04, 0], kit.mats.body, 0.03);
    kit.addBox([0.08, 0.1, 0.42], [a.roof[0] + 0.39, a.roof[1] + 0.04, 0], kit.mats.darkTrim, 0.02);
  },

  'side-exhaust': (kit, a) => {
    const cx = (a.frontWheelX + a.rearWheelX) * 0.5 - 0.35;
    for (const side of [-1, 1]) {
      kit.addBox([1.2, 0.1, 0.14], [cx, a.sideY - 0.04, side * (a.halfWidth + 0.04)], kit.mats.chrome, 0.025);
      kit.addBox([0.22, 0.12, 0.18], [cx - 0.58, a.sideY - 0.04, side * (a.halfWidth + 0.06)], kit.mats.darkTrim, 0.02);
    }
  },

  'tire-stack': (kit, a) => {
    const tireMat = kit.material('#2a313b');
    const stripeMat = kit.mats.stripe;
    for (let i = 0; i < 2; i += 1) {
      const y = a.roof[1] + 0.06 + i * 0.17;
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.16, 16), tireMat);
      tire.position.set(a.roof[0], y, 0);
      kit.addMesh(tire, 0.025);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.17, 12), stripeMat);
      hub.position.set(a.roof[0], y, 0);
      kit.addMesh(hub, 0.015);
    }
  },

  'luggage-rack': (kit, a) => {
    const y = a.rearDeck[1] + 0.06;
    const x = a.rearDeck[0];
    kit.addBox([0.52, 0.05, 1.38], [x, y, 0], kit.mats.chrome, 0.025);
    for (const side of [-1, 1]) {
      kit.addTube([x + 0.22, y - 0.08, side * 0.6], [x + 0.22, y + 0.08, side * 0.6], 0.035, kit.mats.chrome);
      kit.addTube([x - 0.22, y - 0.08, side * 0.6], [x - 0.22, y + 0.08, side * 0.6], 0.035, kit.mats.chrome);
    }
  },

  'gold-ornament': (kit, a) => {
    const gold = kit.material('#f2c84b');
    kit.addBox([0.16, 0.08, 0.18], [a.hood[0] + 0.42, a.hood[1] - 0.06, 0], gold, 0.02);
    kit.addBox([0.18, 0.14, 0.06], [a.hood[0] + 0.4, a.hood[1] + 0.02, 0], gold, 0.02);
  },

  'long-forks': (kit, a) => {
    for (const side of [-1, 1]) {
      kit.addBox([1.15, 0.08, 0.16], [a.nose[0] + 0.52, a.sideY, side * 0.44], kit.mats.chrome, 0.025);
    }
  },

  'tool-cart': (kit, a) => {
    const boxPos: [number, number, number] = [a.rearDeck[0] - 0.18, a.sideY + 0.18, 0];
    kit.addBox([0.48, 0.4, 1.18], boxPos, kit.material('#d4382c'), 0.03);
    kit.addBox([0.5, 0.08, 1.2], [boxPos[0], boxPos[1] + 0.22, 0], kit.mats.chrome, 0.02);
    kit.addBox([0.12, 0.08, 0.96], [boxPos[0] - 0.26, boxPos[1], 0], kit.mats.darkTrim, 0.015);
  },

  'tire-pole': (kit, a) => {
    const z = a.halfWidth + 0.06;
    for (const side of [-1, 1]) {
      kit.addTube([a.roof[0] - 0.42, a.sideY + 0.25, side * z], [a.roof[0] - 0.42, a.roof[1] + 0.48, side * z], 0.045, kit.mats.chrome);
    }
  },

  ducktail: (kit, a) => {
    kit.addProfile(
      [
        [a.rearDeck[0] + 0.22, a.rearDeck[1] - 0.04],
        [a.rearDeck[0] - 0.24, a.rearDeck[1] + 0.26],
        [a.rearDeck[0] - 0.3, a.rearDeck[1] + 0.12],
        [a.rearDeck[0] - 0.02, a.rearDeck[1] - 0.08],
      ],
      2.3,
      kit.mats.body,
      0.035,
      0.04,
    );
  },

  'chrome-sill': (kit, a) => {
    const span = Math.max(1.2, Math.abs(a.frontWheelX - a.rearWheelX) - 1.5);
    const cx = (a.frontWheelX + a.rearWheelX) * 0.5;
    for (const side of [-1, 1]) {
      kit.addBox([span, 0.09, 0.12], [cx, a.sideY - 0.08, side * (a.halfWidth + 0.02)], kit.mats.chrome, 0.02);
    }
  },

  'hood-emblem': (kit, a) => {
    const gold = kit.material('#e8b83a');
    kit.addBox([0.22, 0.05, 0.22], [a.hood[0] + 0.48, a.hood[1] - 0.1, 0], kit.mats.chrome, 0.02);
    kit.addBox([0.14, 0.08, 0.14], [a.hood[0] + 0.48, a.hood[1] - 0.08, 0], gold, 0.015);
  },

  'stock-wing': (kit, a) => {
    kit.addProfile(
      [
        [a.rearDeck[0] + 0.2, a.rearDeck[1] - 0.02],
        [a.rearDeck[0] - 0.24, a.rearDeck[1] + 0.34],
        [a.rearDeck[0] - 0.32, a.rearDeck[1] + 0.24],
        [a.rearDeck[0] - 0.02, a.rearDeck[1] - 0.06],
      ],
      2.82,
      kit.mats.stripe,
      0.03,
      0.04,
    );
    for (const side of [-1, 1]) {
      kit.addBox([0.4, 0.26, 0.08], [a.rearDeck[0] - 0.08, a.rearDeck[1] + 0.14, side * 1.44], kit.mats.shade, 0.02);
    }
  },

  'bull-guard': (kit, a) => {
    const x = a.nose[0] + 0.08;
    kit.addTube([x, a.sideY + 0.04, -1.04], [x, a.sideY + 0.04, 1.04], 0.05, kit.mats.darkTrim);
    kit.addTube([x, a.sideY + 0.38, -0.96], [x, a.sideY + 0.38, 0.96], 0.05, kit.mats.darkTrim);
    for (const side of [-1, 1]) {
      kit.addTube([x, a.sideY - 0.04, side * 0.72], [x, a.sideY + 0.44, side * 0.72], 0.055, kit.mats.darkTrim);
    }
  },

  'exhaust-stacks': (kit, a) => {
    for (const side of [-1, 1]) {
      kit.addTube([0.3, a.sideY + 0.02, side * (a.halfWidth + 0.04)], [-0.65, a.sideY + 0.02, side * (a.halfWidth + 0.06)], 0.075, kit.mats.chrome);
    }
  },

  'tow-boom': (kit, a, palette) => {
    const gold = kit.material(palette.highlight);
    for (const side of [-1, 1]) {
      kit.addTube([-0.92, 1.08, side * 0.94], [-2.72, 2.28, 0], 0.1, kit.mats.darkTrim);
      kit.addTube([-2.38, 1.08, side * 0.86], [-2.72, 2.28, 0], 0.085, gold);
    }
    kit.addTube([-2.72, 2.28, 0], [-2.94, 1.42, 0], 0.06, kit.mats.chrome);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 8, 14), kit.mats.chrome);
    hook.position.set(-2.94, 1.24, 0);
    kit.addMesh(hook, 0.025);
  },

  'bull-bar': (kit, a) => {
    const x = a.nose[0] + 0.14;
    kit.addTube([x, 0.86, -1.16], [x, 0.86, 1.16], 0.055, kit.mats.chrome);
    for (const side of [-1, 1]) {
      kit.addTube([x, 0.56, side * 0.88], [x, 1.06, side * 0.88], 0.06, kit.mats.chrome);
    }
  },

  'rusty-bucket': (kit) => {
    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.15, 0.28, 12),
      kit.material('#7a4b2c'),
    );
    bucket.position.set(2.88, 0.68, -1.12);
    kit.addMesh(bucket, 0.025);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 12), kit.mats.chrome);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(2.88, 0.82, -1.12);
    kit.addMesh(rim);
  },

  'sun-visor': (kit, a) => {
    kit.addBox([0.36, 0.07, 2.18], [a.roof[0] + 0.72, a.roof[1] - 0.16, 0], kit.mats.body, 0.03);
    kit.addBox([0.08, 0.05, 2.2], [a.roof[0] + 0.88, a.roof[1] - 0.18, 0], kit.mats.chrome, 0.02);
  },

  'hood-ornament': (kit, a) => {
    kit.addBox([0.28, 0.08, 0.12], [a.hood[0] + 0.62, a.hood[1] - 0.08, 0], kit.mats.chrome, 0.02);
    kit.addBox([0.2, 0.14, 0.06], [a.hood[0] + 0.64, a.hood[1] + 0.01, 0], kit.mats.chrome, 0.02);
  },

  'fender-skirts': (kit, a) => {
    const skirtMat = kit.mats.stripe;
    for (const side of [-1, 1]) {
      kit.addBox([0.92, 0.34, 0.1], [a.rearWheelX, a.sideY + 0.18, side * (a.halfWidth + 0.01)], skirtMat, 0.025);
    }
  },

  spotlights: (kit, a) => {
    const glow = new THREE.MeshBasicMaterial({ color: '#fff4be' });
    for (const side of [-1, 1]) {
      kit.addBox([0.16, 0.14, 0.2], [a.roof[0] + 0.64, a.roof[1] - 0.12, side * 1.1], kit.mats.chrome, 0.025);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12), glow);
      lens.rotation.z = Math.PI / 2;
      lens.position.set(a.roof[0] + 0.72, a.roof[1] - 0.12, side * 1.1);
      kit.addMesh(lens);
    }
  },

  'trainer-rack': (kit, a) => {
    kit.addBox([0.78, 0.05, 1.38], [a.roof[0], a.roof[1] + 0.02, 0], kit.mats.darkTrim, 0.025);
    const coneMat = kit.material('#ff7828');
    for (const side of [-1, 1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 10), coneMat);
      cone.position.set(a.roof[0], a.roof[1] + 0.24, side * 0.42);
      kit.addMesh(cone, 0.02);
    }
  },

  'rear-diffuser': (kit, a, palette) => {
    const x = a.rearDeck[0] - 0.34;
    kit.addBox([0.28, 0.12, 2.38], [x, 0.46, 0], kit.mats.darkTrim, 0.025);
    const strakeMat = kit.material(palette.stripe);
    for (const z of [-0.72, 0, 0.72]) {
      kit.addBox([0.32, 0.22, 0.06], [x - 0.04, 0.44, z], strakeMat, 0.02);
    }
  },

  halo: (kit) => {
    const stemMat = kit.mats.darkTrim;
    kit.addTube([0.78, 0.86, 0], [0.22, 1.28, 0], 0.06, stemMat);
    for (const side of [-1, 1]) {
      kit.addTube([0.22, 1.28, 0], [-0.58, 1.22, side * 0.42], 0.055, stemMat);
    }
  },

  'double-wing': (kit, a) => {
    const x = a.rearDeck[0];
    kit.addBox([0.52, 0.08, 2.74], [x, a.rearDeck[1] - 0.04, 0], kit.mats.body, 0.03);
    kit.addBox([0.42, 0.07, 2.74], [x - 0.06, a.rearDeck[1] + 0.24, 0], kit.mats.stripe, 0.03);
    for (const side of [-1, 1]) {
      kit.addBox([0.68, 0.52, 0.08], [x - 0.02, a.rearDeck[1] + 0.08, side * 1.38], kit.mats.stripe, 0.025);
      kit.addBox([0.28, 0.72, 0.09], [x + 0.06, a.rearDeck[1] - 0.4, side * 0.74], kit.mats.darkTrim, 0.02);
    }
  },

  'front-flaps': (kit, a) => {
    for (const side of [-1, 1]) {
      const flap = kit.addBox([0.34, 0.07, 0.92], [a.nose[0] - 0.04, a.nose[1] + 0.14, side * 1.02], kit.mats.stripe, 0.02);
      flap.rotation.z = -0.18;
    }
  },

  'sidepod-fins': (kit, a) => {
    for (const side of [-1, 1]) {
      kit.addBox([0.56, 0.36, 0.07], [0.78, 0.64, side * (a.halfWidth + 0.02)], kit.mats.stripe, 0.025);
    }
  },

  canards: (kit, a, palette) => {
    const finMat = kit.material(palette.stripe);
    for (const side of [-1, 1]) {
      const fin = kit.addBox([0.36, 0.06, 0.28], [a.nose[0] - 0.24, 0.62, side * (a.halfWidth - 0.16)], finMat, 0.02);
      fin.rotation.y = side * 0.28;
    }
  },

  'carbon-wing': (kit, a) => {
    const x = a.rearDeck[0];
    const wingY = a.rearDeck[1] + 0.42;
    kit.addBox([0.54, 0.09, 3.16], [x, wingY, 0], kit.mats.darkTrim, 0.035);
    for (const side of [-1, 1]) {
      kit.addBox([0.24, 0.46, 0.09], [x + 0.06, wingY - 0.24, side * 0.94], kit.mats.darkTrim, 0.025);
      kit.addBox([0.62, 0.28, 0.07], [x, wingY + 0.02, side * 1.58], kit.mats.stripe, 0.025);
    }
  },

  'surfboard-rack': (kit, a, palette) => {
    const y = a.roof[1] + 0.06;
    kit.addBox([1.4, 0.06, 1.48], [a.roof[0], y, 0], kit.mats.chrome, 0.025);
    const board = kit.addBox([2.35, 0.08, 0.56], [a.roof[0], y + 0.07, -0.34], kit.material(palette.stripe), 0.03);
    board.rotation.y = 0.04;
    kit.addBox([1.95, 0.09, 0.12], [a.roof[0], y + 0.075, -0.34], kit.material(palette.body), 0.015);
  },

  'spy-wing': (kit, a) => {
    const x = a.rearDeck[0];
    const y = a.rearDeck[1] + 0.28;
    kit.addBox([0.38, 0.07, 2.36], [x, y, 0], kit.mats.body, 0.03);
    for (const side of [-1, 1]) {
      kit.addBox([0.18, 0.28, 0.08], [x + 0.04, y - 0.14, side * 0.72], kit.mats.darkTrim, 0.02);
    }
  },

  'superbird-wing': (kit, a, palette) => {
    const x = a.rearDeck[0];
    const y = a.rearDeck[1] + 0.92;
    const stripeMat = kit.material(palette.stripe);
    kit.addBox([0.48, 0.1, 3.02], [x, y, 0], stripeMat, 0.035);
    for (const side of [-1, 1]) {
      kit.addBox([0.26, 0.94, 0.1], [x + 0.04, y - 0.48, side * 1.2], kit.mats.body, 0.025);
    }
  },
};

export function buildAccessories(ctx: CarBuildContext): AccessoryHandle[] {
  const ids = ctx.palette.accessories;
  if (!ids || ids.length === 0) return [];

  const anchors = ACCESSORY_ANCHORS[ctx.carId];
  const kit: AccessoryKit = {
    body: ctx.body,
    mats: ctx.mats,
    palette: ctx.palette,
    addBox: (size, pos, mat, outline = 0.025) => addBox(ctx, size, pos, mat, true, true, outline),
    addTube: (a, b, radius, mat) => addTube(ctx, a, b, radius, mat),
    addProfile: (points, width, mat, bevel = 0.04, outline = 0.03) =>
      addProfile(ctx, points, width, mat, bevel, true, outline),
    material: createToonMaterial,
    addMesh: (mesh, outline = 0) => {
      mesh.castShadow = true;
      ctx.body.add(mesh);
      if (outline > 0) addOutline(mesh, ctx.mats.outline, outline);
      return mesh;
    },
  };

  const handles: AccessoryHandle[] = [];
  for (const id of ids) {
    const def = getAccessory(id);
    if (!def || def.cars[ctx.carId] == null) continue;
    if (def.replaces) {
      const hidden = ctx.stockParts[def.replaces];
      if (hidden) {
        for (const obj of hidden) {
          obj.visible = false;
        }
      }
    }
    const builder = ACCESSORY_BUILDERS[def.builder];
    if (!builder) continue;
    const handle = builder(kit, anchors, ctx.palette);
    if (handle?.update) handles.push(handle);
  }
  return handles;
}
