import * as THREE from 'three';

/**
 * Falling rain streaks around the camera focus. One instanced mesh; only the first `count` instances are drawn,
 * and `count` follows the rain intensity, so a drizzle is cheap and a downpour is dense.
 */
export class WeatherFx {
  readonly mesh: THREE.InstancedMesh;
  private readonly max = 900;
  private readonly px = new Float32Array(this.max);
  private readonly py = new Float32Array(this.max);
  private readonly pz = new Float32Array(this.max);
  private readonly speed = new Float32Array(this.max);
  private readonly dummy = new THREE.Object3D();
  private readonly half = 40; // half-size of the rain box (x and z)
  private readonly height = 26;
  private seeded = false;

  constructor() {
    const geometry = new THREE.BoxGeometry(0.03, 1.15, 0.03);
    const material = new THREE.MeshBasicMaterial({ color: '#cfe4f5', transparent: true, opacity: 0.5, depthWrite: false, fog: false });
    this.mesh = new THREE.InstancedMesh(geometry, material, this.max);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.renderOrder = 6;
    this.mesh.count = 0;
    this.mesh.visible = false;
    for (let i = 0; i < this.max; i += 1) this.speed[i] = 46 + Math.random() * 20;
  }

  private seed(focus: THREE.Vector3): void {
    for (let i = 0; i < this.max; i += 1) {
      this.px[i] = focus.x + (Math.random() * 2 - 1) * this.half;
      this.pz[i] = focus.z + (Math.random() * 2 - 1) * this.half;
      this.py[i] = Math.random() * this.height;
    }
    this.seeded = true;
  }

  clear(): void {
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.seeded = false;
  }

  update(dt: number, focus: THREE.Vector3, rain: number): void {
    const visible = Math.floor(this.max * Math.min(1, Math.max(0, rain)));
    if (visible < 12) {
      this.mesh.visible = false;
      this.mesh.count = 0;
      return;
    }
    if (!this.seeded) this.seed(focus);
    this.mesh.visible = true;
    this.mesh.count = visible;
    const wind = 5;
    const step = Math.max(0, dt);
    for (let i = 0; i < visible; i += 1) {
      this.py[i] -= this.speed[i] * step;
      this.px[i] += wind * step;
      // respawn at the top when the drop hits the ground
      if (this.py[i] < 0) {
        this.py[i] += this.height;
        this.px[i] = focus.x + (Math.random() * 2 - 1) * this.half;
        this.pz[i] = focus.z + (Math.random() * 2 - 1) * this.half;
      }
      // keep the rain box centred on the camera focus
      if (this.px[i] - focus.x > this.half) this.px[i] -= this.half * 2;
      else if (this.px[i] - focus.x < -this.half) this.px[i] += this.half * 2;
      if (this.pz[i] - focus.z > this.half) this.pz[i] -= this.half * 2;
      else if (this.pz[i] - focus.z < -this.half) this.pz[i] += this.half * 2;

      this.dummy.position.set(this.px[i], this.py[i], this.pz[i]);
      this.dummy.rotation.set(0, 0, 0.1);
      this.dummy.scale.set(1, 1, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
