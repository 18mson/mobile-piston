import * as THREE from 'three';

export interface GlassSharedUniforms {
  uSunDir: { value: THREE.Vector3 };
  uSunStrength: { value: number };
  uGlintEnabled: { value: number };
}

export interface GlassInstanceUniforms {
  uGlint: { value: number };
  uBoundsMin: { value: THREE.Vector3 };
  uBoundsMax: { value: THREE.Vector3 };
  uSunLocal: { value: THREE.Vector3 };
}

export const sharedGlassUniforms: GlassSharedUniforms = {
  uSunDir: { value: new THREE.Vector3(0.55, 0.9, 0.45).normalize() },
  uSunStrength: { value: 1.0 },
  uGlintEnabled: { value: 1.0 },
};

const instanceUniformMap = new WeakMap<THREE.MeshToonMaterial, GlassInstanceUniforms>();
const _invQuat = new THREE.Quaternion();

export function setGlassSunLight(dir: THREE.Vector3, strength: number, glintEnabled = true): void {
  sharedGlassUniforms.uSunDir.value.copy(dir).normalize();
  sharedGlassUniforms.uSunStrength.value = Math.max(0, Math.min(1, strength));
  sharedGlassUniforms.uGlintEnabled.value = glintEnabled ? 1.0 : 0.0;
}

export function setGlassBounds(
  mat: THREE.MeshToonMaterial,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): void {
  const u = instanceUniformMap.get(mat);
  if (!u) return;
  u.uBoundsMin.value.set(minX, minY, minZ);
  u.uBoundsMax.value.set(maxX, maxY, maxZ);
}

export function syncGlassSunLocal(mat: THREE.MeshToonMaterial, carQuaternion: THREE.Quaternion): void {
  const u = instanceUniformMap.get(mat);
  if (!u) return;
  _invQuat.copy(carQuaternion).invert();
  u.uSunLocal.value.copy(sharedGlassUniforms.uSunDir.value).applyQuaternion(_invQuat).normalize();
}

/**
 * Toon glass material with crisp diagonal pixel-art glint bands across every window panel.
 * Uses object-space panel bounds + car-local sun vector so bands span bottom-to-top smoothly.
 */
export function createGlassMaterial(
  tintHex: string,
  gradientMap: THREE.DataTexture,
  glint = 1,
): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color: tintHex,
    gradientMap,
  });

  const instanceUniforms: GlassInstanceUniforms = {
    uGlint: { value: glint },
    uBoundsMin: { value: new THREE.Vector3(-2.2, 1.0, -1.4) },
    uBoundsMax: { value: new THREE.Vector3(1.2, 2.0, 1.4) },
    uSunLocal: { value: sharedGlassUniforms.uSunDir.value.clone() },
  };
  instanceUniformMap.set(mat, instanceUniforms);

  mat.customProgramCacheKey = () => 'mobile-piston-glass-toon-v2';
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = sharedGlassUniforms.uSunDir;
    shader.uniforms.uSunStrength = sharedGlassUniforms.uSunStrength;
    shader.uniforms.uGlintEnabled = sharedGlassUniforms.uGlintEnabled;
    shader.uniforms.uGlint = instanceUniforms.uGlint;
    shader.uniforms.uBoundsMin = instanceUniforms.uBoundsMin;
    shader.uniforms.uBoundsMax = instanceUniforms.uBoundsMax;
    shader.uniforms.uSunLocal = instanceUniforms.uSunLocal;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vObjPos;
varying vec3 vObjNormal;
varying vec3 vGlassWorldNormal;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vObjPos = position;
vObjNormal = normal;
vGlassWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uSunDir;
uniform float uSunStrength;
uniform float uGlintEnabled;
uniform float uGlint;
uniform vec3 uBoundsMin;
uniform vec3 uBoundsMax;
uniform vec3 uSunLocal;
varying vec3 vObjPos;
varying vec3 vObjNormal;
varying vec3 vGlassWorldNormal;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `if (uGlintEnabled > 0.5) {
  vec3 gSpan = max(uBoundsMax - uBoundsMin, vec3(0.05));
  float yN = clamp((vObjPos.y - uBoundsMin.y) / gSpan.y, 0.0, 1.0);
  // Derive the flat triangle face normal in object space so smooth vertex normals near roof seams never split sloped windows.
  vec3 absFaceN = abs(cross(dFdx(vObjPos), dFdy(vObjPos)));
  float useX = step(absFaceN.x, absFaceN.z);
  float hX = clamp((vObjPos.x - uBoundsMin.x) / gSpan.x, 0.0, 1.0);
  float hZ = clamp((vObjPos.z - uBoundsMin.z) / gSpan.z, 0.0, 1.0);
  // Measure horizontal coordinate and sun tangent left-to-right from outside each panel so all windows slant "/" consistently.
  float hFrontRear = vObjNormal.x < 0.0 ? hZ : 1.0 - hZ;
  float hSide = vObjNormal.z < 0.0 ? 1.0 - hX : hX;
  float hR = mix(hFrontRear, hSide, useX);
  float sunFrontRear = vObjNormal.x < 0.0 ? uSunLocal.z : -uSunLocal.z;
  float sunSide = vObjNormal.z < 0.0 ? -uSunLocal.x : uSunLocal.x;
  float phase = mix(sunFrontRear, sunSide, useX) * 0.9;
  float d = hR - yN * 0.75;
  float t = fract(d * 1.5 - phase);
  float wideBand = step(0.12, t) - step(0.30, t);
  float thinBand = step(0.40, t) - step(0.46, t);
  float lit = step(0.0, dot(normalize(vGlassWorldNormal), uSunDir));
  float k = mix(0.55, 1.0, lit);
  float str = max(uSunStrength, 0.35);
  float gMask = max(wideBand * k, thinBand * k * 0.8) * str * uGlint;
  vec3 glintCol = mix(diffuseColor.rgb, vec3(1.0), 0.88);
  outgoingLight = mix(outgoingLight, glintCol, min(1.0, gMask));
}
#include <opaque_fragment>`,
      );
  };

  return mat;
}
