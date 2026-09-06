import { useMemo } from "react";
import * as THREE from "three";
import { mulberry32, terrainHeight, U, WATER_LEVEL } from "../world/world";
import { useStore } from "../world/store";

const vert = /* glsl */ `
attribute vec3 aOffset; attribute vec4 aData;
uniform float uTime; uniform vec3 uPointer; uniform float uWind; uniform vec4 uSeason;
varying float vH; varying float vVar;
#include <fog_pars_vertex>
void main(){
  float camD = distance(cameraPosition.xz, aOffset.xz);
  float s = aData.x * (1.0 - uSeason.w * 0.55) * (1.0 - smoothstep(38.0, 62.0, camD));
  float r = aData.y; vVar = aData.z;
  vec3 p = position;
  p.y *= s;
  float c = cos(r), sn = sin(r);
  p.xz = mat2(c, -sn, sn, c) * p.xz;
  float h = position.y; vH = h;
  float w = sin(uTime * 1.5 + aOffset.x * 0.32 + aOffset.z * 0.21 + aData.w) * 0.55
          + sin(uTime * 2.9 + aOffset.z * 0.75 + aData.w * 2.0) * 0.22;
  vec2 windDir = vec2(0.85, 0.45);
  p.xz += windDir * w * (0.25 + uWind) * h * h * 0.55;
  vec2 d = aOffset.xz - uPointer.xz;
  float dl = length(d);
  float push = (1.0 - smoothstep(0.0, 2.4, dl)) * h * h * 1.1;
  p.xz += (d / max(dl, 0.001)) * push;
  p.y -= push * 0.35;
  vec3 wp = aOffset + p;
  vec4 mvPosition = modelViewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */ `
uniform vec4 uSeason; uniform vec3 uSunDir; uniform float uDay; uniform vec3 uSunColor; uniform vec3 uSkyZenith;
varying float vH; varying float vVar;
#include <fog_pars_fragment>
void main(){
  vec3 spring = vec3(0.46, 0.70, 0.30);
  vec3 summer = vec3(0.24, 0.50, 0.17);
  vec3 autumn = vec3(0.66, 0.54, 0.24);
  vec3 winter = vec3(0.72, 0.74, 0.72);
  vec3 col = spring * uSeason.x + summer * uSeason.y + autumn * uSeason.z + winter * uSeason.w;
  col *= (0.72 + 0.55 * vVar) * 0.72;
  col *= mix(0.42, 1.08, vH);
  // tip tint
  col = mix(col, col * vec3(1.15, 1.05, 0.8), vH * vH * uSeason.z);
  float sunUp = clamp(uSunDir.y * 2.0, 0.0, 1.0);
  vec3 light = uSunColor * (0.25 + 0.55 * sunUp) * uDay + uSkyZenith * 0.35 + vec3(0.05, 0.06, 0.09) * (1.0 - uDay);
  col *= light;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const flowerVert = /* glsl */ `
attribute float aVar;
uniform float uTime; uniform vec4 uSeason; uniform float uPx;
varying float vVar; varying float vVis;
#include <fog_pars_vertex>
void main(){
  vVar = aVar;
  float vis = uSeason.x * 1.0 + uSeason.y * 0.75 + uSeason.z * 0.18 + uSeason.w * 0.0;
  vVis = vis;
  vec3 p = position;
  p.x += sin(uTime * 1.6 + p.z * 0.4 + aVar * 6.0) * 0.05;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (2.2 + 2.0 * aVar) * uPx * (50.0 / -mvPosition.z) * step(0.02, vis) * (0.5 + 0.5 * vis);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const flowerFrag = /* glsl */ `
uniform vec4 uSeason; uniform float uDay; varying float vVar; varying float vVis;
#include <fog_pars_fragment>
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float ang = atan(uv.y, uv.x);
  float r = length(uv) * 2.0;
  float petal = 0.55 + 0.45 * abs(cos(ang * 2.5 + vVar * 3.0));
  if (r > petal) discard;
  vec3 spring = mix(vec3(0.98, 0.78, 0.86), vec3(0.98, 0.96, 0.9), step(0.5, vVar));
  vec3 summer = mix(vec3(0.98, 0.85, 0.35), vec3(0.75, 0.6, 0.95), step(0.55, vVar));
  vec3 autumn = vec3(0.9, 0.7, 0.4);
  vec3 col = (spring * uSeason.x + summer * uSeason.y + autumn * uSeason.z) / max(uSeason.x + uSeason.y + uSeason.z, 0.001);
  col = mix(col, vec3(0.98, 0.9, 0.4), 1.0 - smoothstep(0.15, 0.35, r));
  col *= 0.22 + 0.5 * uDay;
  gl_FragColor = vec4(col, vVis * 0.9);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function okSpot(x: number, z: number) {
  const h = terrainHeight(x, z);
  if (h < WATER_LEVEL + 0.35) return -1;
  const dx = terrainHeight(x + 0.6, z) - h;
  const dz = terrainHeight(x, z + 0.6) - h;
  if (dx * dx + dz * dz > 0.42) return -1;
  // keep cave interior clear
  if (Math.hypot(x + 27, z - 23) < 7) return -1;
  return h;
}

export function Grass() {
  const quality = useStore((s) => s.quality);
  const { geo, flowerGeo } = useMemo(() => {
    const count = quality === "high" ? 70000 : 16000;
    const rnd = mulberry32(99);
    // blade geometry: 3 segments, tapered
    const segs = 3;
    const verts: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const w = 0.07 * (1 - t * 0.85);
      verts.push(-w, t, 0, w, t, 0);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const base = new THREE.BufferGeometry();
    base.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    base.setIndex(idx);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.attributes.position = base.attributes.position;
    const offsets = new Float32Array(count * 3);
    const data = new Float32Array(count * 4);
    let n = 0;
    let tries = 0;
    while (n < count && tries < count * 4) {
      tries++;
      const ang = rnd() * Math.PI * 2;
      const rad = Math.sqrt(rnd()) * 78;
      const x = Math.cos(ang) * rad,
        z = Math.sin(ang) * rad + 6;
      const h = okSpot(x, z);
      if (h < 0) continue;
      offsets[n * 3] = x;
      offsets[n * 3 + 1] = h - 0.02;
      offsets[n * 3 + 2] = z;
      data[n * 4] = 0.28 + rnd() * 0.45;
      data[n * 4 + 1] = rnd() * Math.PI * 2;
      data[n * 4 + 2] = rnd();
      data[n * 4 + 3] = rnd() * 6.28;
      n++;
    }
    g.instanceCount = n;
    g.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offsets, 3));
    g.setAttribute("aData", new THREE.InstancedBufferAttribute(data, 4));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 6), 120);

    // flowers
    const fcount = quality === "high" ? 1800 : 600;
    const fpos = new Float32Array(fcount * 3);
    const fvar = new Float32Array(fcount);
    let m = 0;
    tries = 0;
    while (m < fcount && tries < fcount * 6) {
      tries++;
      const ang = rnd() * Math.PI * 2;
      const rad = Math.sqrt(rnd()) * 60;
      const x = Math.cos(ang) * rad,
        z = Math.sin(ang) * rad + 6;
      const h = okSpot(x, z);
      if (h < 0) continue;
      if (h > 9) continue;
      fpos[m * 3] = x;
      fpos[m * 3 + 1] = h + 0.35 + rnd() * 0.25;
      fpos[m * 3 + 2] = z;
      fvar[m] = rnd();
      m++;
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute("position", new THREE.BufferAttribute(fpos.subarray(0, m * 3), 3));
    fg.setAttribute("aVar", new THREE.BufferAttribute(fvar.subarray(0, m), 1));
    fg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 6), 120);
    return { geo: g, flowerGeo: fg };
  }, [quality]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
        side: THREE.DoubleSide,
        fog: true,
      }),
    []
  );
  const flowerMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: flowerVert,
        fragmentShader: flowerFrag,
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uPx: { value: 1 } }]),
        transparent: true,
        depthWrite: false,
        fog: true,
      }),
    []
  );
  // share global uniforms (merge clones, so assign by reference after)
  Object.assign(mat.uniforms, {
    uTime: U.uTime,
    uPointer: U.uPointer,
    uWind: U.uWind,
    uSeason: U.uSeason,
    uSunDir: U.uSunDir,
    uDay: U.uDay,
    uSunColor: U.uSunColor,
    uSkyZenith: U.uSkyZenith,
  });
  Object.assign(flowerMat.uniforms, { uTime: U.uTime, uSeason: U.uSeason, uDay: U.uDay });
  flowerMat.uniforms.uPx.value = Math.min(window.devicePixelRatio, 2);

  return (
    <group>
      <mesh geometry={geo} material={mat} frustumCulled={false} />
      <points geometry={flowerGeo} material={flowerMat} frustumCulled={false} />
    </group>
  );
}
