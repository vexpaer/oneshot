import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32, terrainHeight, U, WATER_LEVEL, FLAT_SPOTS } from "../world/world";
import { useStore } from "../world/store";

/* ---------- shared canopy material (deciduous, season aware, wind) ---------- */
function injectCanopy(shader: THREE.WebGLProgramParametersWithUniforms, pine: boolean) {
  shader.uniforms.uSeason = U.uSeason;
  shader.uniforms.uTime = U.uTime;
  shader.uniforms.uWind = U.uWind;
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
      uniform vec4 uSeason; uniform float uTime; uniform float uWind;
      varying vec3 vWN; varying float vFall;`
    )
    .replace(
      "#include <begin_vertex>",
      `vec3 transformed = vec3(position);
      #ifdef USE_INSTANCING
        vec3 tpos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 tpos = vec3(0.0);
      #endif
      #ifdef USE_INSTANCING_COLOR
        float variant = instanceColor.r;
      #else
        float variant = 0.5;
      #endif
      ${
        pine
          ? `float fall = 1.0;`
          : `float fall = 1.0 - smoothstep(variant * 0.45, variant * 0.45 + 0.5, uSeason.w);
             fall *= 0.82 + 0.18 * uSeason.y + 0.06 * uSeason.x;`
      }
      vFall = fall;
      transformed *= fall;
      float sway = sin(uTime * 1.1 + tpos.x * 0.21 + tpos.z * 0.17) * 0.09 * (0.3 + uWind)
                 + sin(uTime * 3.1 + tpos.z * 0.5 + position.y * 1.7) * 0.025 * (0.3 + uWind);
      transformed.x += sway * (transformed.y + 1.0);
      transformed.z += sway * 0.4 * (transformed.y + 1.0);
      vec4 wn = vec4(objectNormal, 0.0);
      #ifdef USE_INSTANCING
        wn = instanceMatrix * wn;
      #endif
      vWN = normalize((modelMatrix * wn).xyz);`
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
      uniform vec4 uSeason; varying vec3 vWN; varying float vFall;`
    )
    .replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      {
        #ifdef USE_COLOR
          float v = vColor.r; float v2 = vColor.g;
        #else
          float v = 0.5; float v2 = 0.5;
        #endif
        ${
          pine
            ? `vec3 base = mix(vec3(0.11, 0.30, 0.15), vec3(0.19, 0.38, 0.17), v);
               base = mix(base, base * vec3(1.15, 1.2, 0.9), uSeason.x * 0.5);
               base = mix(base, base * vec3(1.05, 0.95, 0.8), uSeason.z * 0.4);
               float snow = uSeason.w * smoothstep(0.15, 0.6, vWN.y + (v2 - 0.5) * 0.3);
               vec3 col = mix(base, vec3(0.92, 0.94, 0.98), snow);`
            : `vec3 spring = mix(vec3(0.52, 0.76, 0.34), vec3(0.96, 0.74, 0.80), step(0.74, v2));
               vec3 summer = vec3(0.19, 0.42, 0.15) * (0.85 + 0.3 * v);
               vec3 autumn = mix(vec3(0.88, 0.47, 0.12), vec3(0.82, 0.66, 0.16), v);
               autumn = mix(autumn, vec3(0.64, 0.19, 0.09), smoothstep(0.62, 1.0, v2));
               vec3 winter = vec3(0.5, 0.42, 0.34);
               vec3 col = spring * uSeason.x + summer * uSeason.y + autumn * uSeason.z + winter * uSeason.w;`
        }
        diffuseColor.rgb = col;
      }`
    );
}

let canopyMat: THREE.MeshStandardMaterial | null = null;
export function getCanopyMaterial() {
  if (!canopyMat) {
    canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
    canopyMat.onBeforeCompile = (s) => injectCanopy(s, false);
    canopyMat.customProgramCacheKey = () => "canopy-deciduous";
  }
  return canopyMat;
}
let pineMat: THREE.MeshStandardMaterial | null = null;
export function getPineMaterial() {
  if (!pineMat) {
    pineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    pineMat.onBeforeCompile = (s) => injectCanopy(s, true);
    pineMat.customProgramCacheKey = () => "canopy-pine";
  }
  return pineMat;
}
export const barkMaterial = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });

export function makeBlobGeometry(seed = 1, detail = 2, jitter = 0.18, smooth = true) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  if (smooth) g = mergeVertices(g, 1e-4); // indexed -> smooth normals
  const rnd = mulberry32(seed);
  const p = g.attributes.position as THREE.BufferAttribute;
  const map = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    let s = map.get(key);
    if (s === undefined) {
      s = 1 + (rnd() - 0.5) * 2 * jitter;
      map.set(key, s);
    }
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.85, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- placement ---------- */
export interface TreeSpec {
  x: number;
  z: number;
  y: number;
  scale: number;
  rot: number;
  pine: boolean;
  variant: number;
  v2: number;
}

const CLEAR: [number, number, number][] = [
  ...FLAT_SPOTS.map(([x, z, , r]) => [x, z, r * 0.8] as [number, number, number]),
  [0, 10, 19], // lake
  [-9, 36, 7], // overview cam
];

export function generateTrees(count: number, seed = 7): TreeSpec[] {
  const rnd = mulberry32(seed);
  const out: TreeSpec[] = [];
  let tries = 0;
  while (out.length < count && tries < count * 30) {
    tries++;
    const ang = rnd() * Math.PI * 2;
    const rad = 14 + Math.pow(rnd(), 0.8) * 84;
    const x = Math.cos(ang) * rad,
      z = Math.sin(ang) * rad + 8;
    const y = terrainHeight(x, z);
    if (y < WATER_LEVEL + 0.8) continue;
    let bad = false;
    for (const [cx, cz, cr] of CLEAR) if (Math.hypot(x - cx, z - cz) < cr) bad = true;
    if (bad) continue;
    for (const t of out)
      if (Math.hypot(x - t.x, z - t.z) < 3.2) {
        bad = true;
        break;
      }
    if (bad) continue;
    const slope = Math.abs(terrainHeight(x + 1, z) - y) + Math.abs(terrainHeight(x, z + 1) - y);
    if (slope > 1.6) continue;
    const pineP = Math.min(0.85, Math.max(0.12, (y - 3) / 14));
    out.push({
      x,
      z,
      y,
      scale: 0.75 + rnd() * 0.7,
      rot: rnd() * Math.PI * 2,
      pine: rnd() < pineP,
      variant: rnd(),
      v2: rnd(),
    });
  }
  return out;
}

/* ---------- component ---------- */
export function Trees() {
  const quality = useStore((s) => s.quality);
  const trees = useMemo(() => generateTrees(quality === "high" ? 380 : 170), [quality]);
  const decid = useMemo(() => trees.filter((t) => !t.pine), [trees]);
  const pines = useMemo(() => trees.filter((t) => t.pine), [trees]);

  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.16, 0.42, 4.2, 7, 1), []);
  const branchGeo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.03, 0.11, 2.4, 5, 1);
    g.translate(0, 1.2, 0);
    return g;
  }, []);
  const blobGeo = useMemo(() => makeBlobGeometry(3, quality === "high" ? 3 : 2, 0.14), [quality]);
  const pineTrunkGeo = useMemo(() => new THREE.CylinderGeometry(0.12, 0.32, 3.2, 6, 1), []);
  const coneGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(1.5, 3.0, 9, 1);
    g.translate(0, 1.5, 0);
    return g;
  }, []);

  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const branchRef = useRef<THREE.InstancedMesh>(null);
  const blobRef = useRef<THREE.InstancedMesh>(null);
  const pTrunkRef = useRef<THREE.InstancedMesh>(null);
  const coneRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const col = new THREE.Color();
    const rnd = mulberry32(31);
    // deciduous
    decid.forEach((t, i) => {
      const s = t.scale;
      m.compose(new THREE.Vector3(t.x, t.y + 2.1 * s - 0.3, t.z), q.setFromEuler(e.set(0, t.rot, 0)), new THREE.Vector3(s, s, s));
      trunkRef.current!.setMatrixAt(i, m);
      for (let b = 0; b < 4; b++) {
        const yaw = t.rot + (b / 4) * Math.PI * 2 + rnd() * 0.6;
        const tilt = 0.75 + rnd() * 0.5;
        e.set(0, yaw, 0);
        q.setFromEuler(e);
        const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tilt));
        q.multiply(q2);
        m.compose(new THREE.Vector3(t.x, t.y + (3.0 + rnd() * 1.0) * s, t.z), q, new THREE.Vector3(s, s * (0.8 + rnd() * 0.5), s));
        branchRef.current!.setMatrixAt(i * 4 + b, m);
      }
      for (let b = 0; b < 4; b++) {
        const yaw = (b / 4) * Math.PI * 2 + rnd();
        const off = b === 0 ? 0 : 1.1 + rnd() * 0.6;
        const bs = (b === 0 ? 2.4 : 1.6 + rnd() * 0.7) * s;
        const pos = new THREE.Vector3(
          t.x + Math.cos(yaw) * off * s,
          t.y + (b === 0 ? 5.6 : 4.6 + rnd() * 1.4) * s,
          t.z + Math.sin(yaw) * off * s
        );
        m.compose(pos, q.setFromEuler(e.set(rnd(), rnd() * 6, rnd())), new THREE.Vector3(bs, bs * 0.9, bs));
        blobRef.current!.setMatrixAt(i * 4 + b, m);
        blobRef.current!.setColorAt(i * 4 + b, col.setRGB(t.variant, t.v2, rnd()));
      }
    });
    trunkRef.current!.instanceMatrix.needsUpdate = true;
    branchRef.current!.instanceMatrix.needsUpdate = true;
    blobRef.current!.instanceMatrix.needsUpdate = true;
    if (blobRef.current!.instanceColor) blobRef.current!.instanceColor.needsUpdate = true;
    // pines
    pines.forEach((t, i) => {
      const s = t.scale * 1.1;
      m.compose(new THREE.Vector3(t.x, t.y + 1.6 * s - 0.3, t.z), q.setFromEuler(e.set(0, t.rot, 0)), new THREE.Vector3(s, s, s));
      pTrunkRef.current!.setMatrixAt(i, m);
      for (let b = 0; b < 3; b++) {
        const cs = (1.0 - b * 0.25) * s;
        m.compose(
          new THREE.Vector3(t.x, t.y + (2.4 + b * 2.0) * s, t.z),
          q.setFromEuler(e.set(0, t.rot + b, 0)),
          new THREE.Vector3(cs, s * 1.05, cs)
        );
        coneRef.current!.setMatrixAt(i * 3 + b, m);
        coneRef.current!.setColorAt(i * 3 + b, col.setRGB(t.variant, t.v2, 0));
      }
    });
    pTrunkRef.current!.instanceMatrix.needsUpdate = true;
    coneRef.current!.instanceMatrix.needsUpdate = true;
    if (coneRef.current!.instanceColor) coneRef.current!.instanceColor.needsUpdate = true;
  }, [decid, pines]);

  const canopy = getCanopyMaterial();
  const pine = getPineMaterial();

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[trunkGeo, barkMaterial, decid.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={branchRef} args={[branchGeo, barkMaterial, decid.length * 4]} castShadow frustumCulled={false} />
      <instancedMesh ref={blobRef} args={[blobGeo, canopy, decid.length * 4]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={pTrunkRef} args={[pineTrunkGeo, barkMaterial, pines.length]} castShadow frustumCulled={false} />
      <instancedMesh ref={coneRef} args={[coneGeo, pine, pines.length * 3]} castShadow receiveShadow frustumCulled={false} />
    </group>
  );
}
