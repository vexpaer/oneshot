import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { makeLeaf, makeMist, makeSoftCircle, mulberry32, terrainHeight, U, world } from "../world/world";
import { useStore } from "../world/store";

const vert = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime; uniform float uMode; uniform float uSize; uniform float uVis; uniform float uWind; uniform float uSpeed;
uniform vec3 uPointer; uniform vec3 uArea; uniform vec3 uCenter; uniform float uPx;
varying float vAlpha; varying float vRot; varying float vSeed;
#include <fog_pars_vertex>
void main(){
  vec4 s = aSeed; vec3 p = position; float t = uTime;
  float alpha = 1.0;
  if (uMode < 0.5) {
    p += vec3(sin(t * 0.6 + s.x * 6.283) * 1.7 + sin(t * 1.7 + s.y * 9.0) * 0.3,
              sin(t * 0.45 + s.y * 6.283) * 0.7,
              cos(t * 0.55 + s.z * 6.283) * 1.7);
    vec3 d = p - uPointer; float dl = length(d.xz);
    float rep = 1.0 - smoothstep(0.0, 3.5, dl);
    p.xz += (d.xz / max(dl, 0.001)) * rep * 2.6; p.y += rep * 0.9;
    alpha = 0.25 + 0.75 * pow(0.5 + 0.5 * sin(t * 2.2 + s.w * 40.0), 3.0);
  } else if (uMode < 1.5) {
    float fallT = t * uSpeed * (0.6 + s.x * 0.6);
    p.y = uCenter.y + uArea.y - mod(s.y * uArea.y + fallT, uArea.y);
    p.x += sin(t * 0.9 + s.z * 6.283) * 1.2 + mod(t * (0.4 + uWind) * 1.5 + s.w * uArea.x, uArea.x) - uArea.x * 0.5;
    p.z += cos(t * 0.7 + s.w * 6.283) * 0.8;
    alpha = 0.95;
  } else {
    p += vec3(sin(t * 1.3 + s.x * 6.283) * 0.9, sin(t * 1.1 + s.y * 6.283) * 0.45, cos(t * 1.2 + s.z * 6.283) * 0.9);
    alpha = 0.5 + 0.5 * sin(t * 3.0 + s.w * 20.0);
  }
  vRot = s.z * 6.283 + t * (0.6 + s.x) * step(0.5, uMode) * step(uMode, 1.5);
  vAlpha = alpha * uVis; vSeed = s.w;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.6 + 0.8 * s.x) * uPx * (40.0 / -mvPosition.z);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */ `
uniform sampler2D uMap; uniform vec3 uColor; uniform vec3 uColor2; uniform float uGlow;
varying float vAlpha; varying float vRot; varying float vSeed;
#include <fog_pars_fragment>
void main(){
  if (vAlpha < 0.01) discard;
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  uv = mat2(c, -s, s, c) * uv + 0.5;
  vec4 tex = texture2D(uMap, uv);
  float a = tex.a * vAlpha;
  if (a < 0.01) discard;
  vec3 col = mix(uColor, uColor2, vSeed) * (1.0 + uGlow) * (0.6 + 0.4 * tex.r);
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

type Mode = "firefly" | "fall" | "drift";
interface SysProps {
  mode: Mode;
  count: number;
  center: [number, number, number];
  area: [number, number, number];
  color: string;
  color2: string;
  size: number;
  speed?: number;
  glow?: number;
  map: THREE.Texture;
  vis: () => number; // visibility 0..1 evaluated per frame
  onGround?: boolean; // place base points on terrain
  seed?: number;
  additive?: boolean;
}

export function ParticleSystem(p: SysProps) {
  const geo = useMemo(() => {
    const rnd = mulberry32(p.seed ?? 11);
    const pos = new Float32Array(p.count * 3);
    const seed = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const x = p.center[0] + (rnd() - 0.5) * p.area[0];
      const z = p.center[2] + (rnd() - 0.5) * p.area[2];
      let y = p.center[1] + rnd() * p.area[1];
      if (p.onGround) y = terrainHeight(x, z) + 0.6 + rnd() * 2.6;
      pos.set([x, y, z], i * 3);
      seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(...p.center), Math.max(...p.area) + 20);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.count]);

  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uMode: { value: p.mode === "firefly" ? 0 : p.mode === "fall" ? 1 : 2 },
          uSize: { value: p.size },
          uVis: { value: 0 },
          uSpeed: { value: p.speed ?? 1 },
          uArea: { value: new THREE.Vector3(...p.area) },
          uCenter: { value: new THREE.Vector3(...p.center) },
          uMap: { value: p.map },
          uColor: { value: new THREE.Color(p.color) },
          uColor2: { value: new THREE.Color(p.color2) },
          uGlow: { value: p.glow ?? 0 },
          uPx: { value: Math.min(window.devicePixelRatio, 2) },
        },
      ]),
      transparent: true,
      depthWrite: false,
      blending: p.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      fog: true,
    });
    Object.assign(m.uniforms, { uTime: U.uTime, uWind: U.uWind, uPointer: U.uPointer });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ref = useRef<THREE.Points>(null);
  useFrame(() => {
    const v = p.vis();
    mat.uniforms.uVis.value += (v - mat.uniforms.uVis.value) * 0.05;
    if (ref.current) ref.current.visible = mat.uniforms.uVis.value > 0.01;
  });
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} />;
}

export function SeasonalParticles() {
  const quality = useStore((s) => s.quality);
  const tex = useMemo(() => ({ circle: makeSoftCircle(), leaf: makeLeaf() }), []);
  const k = quality === "high" ? 1 : 0.4;
  const S = world.seasonMix;
  return (
    <group>
      {/* fireflies (night, not winter) */}
      <ParticleSystem
        mode="firefly"
        count={Math.floor(420 * k)}
        center={[0, 0, 4]}
        area={[110, 4, 110]}
        color="#e8ff9a"
        color2="#ffd66e"
        size={5}
        glow={1.6}
        map={tex.circle}
        onGround
        additive
        seed={5}
        vis={() => (1 - world.dayFactor) * (1 - S.w * 0.95) * (0.6 + 0.4 * S.y)}
      />
      {/* autumn leaves */}
      <ParticleSystem
        mode="fall"
        count={Math.floor(900 * k)}
        center={[0, 1, 4]}
        area={[120, 14, 120]}
        color="#d9782a"
        color2="#c9a227"
        size={6}
        speed={0.9}
        map={tex.leaf}
        seed={6}
        vis={() => S.z}
      />
      {/* spring petals */}
      <ParticleSystem
        mode="fall"
        count={Math.floor(500 * k)}
        center={[0, 1, 4]}
        area={[110, 12, 110]}
        color="#f8c8d8"
        color2="#fff2f4"
        size={3.5}
        speed={0.55}
        map={tex.circle}
        seed={8}
        vis={() => S.x * 0.9}
      />
      {/* snow */}
      <ParticleSystem
        mode="fall"
        count={Math.floor(2400 * k)}
        center={[0, -2, 4]}
        area={[130, 26, 130]}
        color="#ffffff"
        color2="#e8f0ff"
        size={3}
        speed={1.1}
        map={tex.circle}
        seed={9}
        vis={() => S.w}
      />
      {/* summer insects / pollen (day) */}
      <ParticleSystem
        mode="drift"
        count={Math.floor(320 * k)}
        center={[0, 0, 4]}
        area={[90, 3, 90]}
        color="#fff6d0"
        color2="#ffe9a8"
        size={1.8}
        glow={0.6}
        map={tex.circle}
        onGround
        additive
        seed={10}
        vis={() => world.dayFactor * (S.y * 0.9 + S.x * 0.6)}
      />
    </group>
  );
}

/* ---------- low-lying mist sprites ---------- */
export function Mist() {
  const quality = useStore((s) => s.quality);
  const tex = useMemo(() => makeMist(), []);
  const count = quality === "high" ? 34 : 14;
  const items = useMemo(() => {
    const rnd = mulberry32(77);
    return Array.from({ length: count }, (_, i) => {
      const ang = rnd() * Math.PI * 2;
      const rad = Math.sqrt(rnd()) * 48;
      const x = Math.cos(ang) * rad,
        z = Math.sin(ang) * rad + 8;
      const y = Math.max(terrainHeight(x, z), -1.4) + 1.2 + rnd() * 1.5;
      return { x, y, z, s: 14 + rnd() * 20, phase: rnd() * 6.28, speed: 0.15 + rnd() * 0.2, i };
    });
  }, [count]);
  const refs = useRef<THREE.Sprite[]>([]);
  useFrame(() => {
    const t = U.uTime.value;
    const S = world.seasonMix;
    const dawn = Math.exp(-Math.pow((world.time - 0.29) / 0.06, 2));
    const night = 1 - world.dayFactor;
    const base = 0.05 + dawn * 0.16 + night * 0.025 + S.w * 0.08 + S.z * 0.03 - S.y * 0.02;
    refs.current.forEach((sp, i) => {
      if (!sp) return;
      const it = items[i];
      sp.position.x = it.x + Math.sin(t * it.speed + it.phase) * 3;
      sp.position.z = it.z + Math.cos(t * it.speed * 0.7 + it.phase) * 2;
      const m = sp.material as THREE.SpriteMaterial;
      m.opacity = base * (0.7 + 0.3 * Math.sin(t * 0.3 + it.phase));
      m.color.copy(U.uSkyHorizon.value).multiplyScalar(1.6 + 0.8 * world.dayFactor);
    });
  });
  return (
    <group>
      {items.map((it, i) => (
        <sprite
          key={i}
          ref={(el) => {
            if (el) refs.current[i] = el;
          }}
          position={[it.x, it.y, it.z]}
          scale={[it.s, it.s * 0.35, 1]}
          renderOrder={3}
        >
          <spriteMaterial map={tex} transparent opacity={0.1} depthWrite={false} color="#dfe8ee" fog />
        </sprite>
      ))}
    </group>
  );
}
