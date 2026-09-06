import { useMemo } from "react";
import * as THREE from "three";
import { U, GLSL_NOISE, WATER_LEVEL, LAKE_CENTER, world } from "../world/world";
import type { ThreeEvent } from "@react-three/fiber";

const vert = /* glsl */ `
uniform float uTime; uniform vec4 uSeason;
varying vec3 vWPos;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float wave = sin(wp.x * 0.7 + uTime * 1.1) * 0.025 + sin(wp.z * 0.9 - uTime * 0.8 + wp.x * 0.3) * 0.025;
  wp.y += wave * (1.0 - uSeason.w);
  vWPos = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const frag = /* glsl */ `
uniform vec3 uSkyZenith; uniform vec3 uSkyHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uCamPos;
uniform float uDay; uniform float uTime; uniform vec4 uSeason; uniform vec4 uRipple; uniform vec3 uPointer;
varying vec3 vWPos;
${GLSL_NOISE}
#include <fog_pars_fragment>
float waveH(vec2 p, float t){
  float h = 0.0;
  h += sin(p.x * 1.3 + t * 1.4) * 0.5;
  h += sin((p.x * 0.6 + p.y * 1.1) - t * 1.1) * 0.4;
  h += sin((p.y * 1.7 - p.x * 0.4) + t * 1.9) * 0.25;
  h += vnoise(p * 1.4 + vec2(t * 0.25, -t * 0.2)) * 0.9;
  h += vnoise(p * 3.1 - vec2(t * 0.35, t * 0.15)) * 0.35;
  return h;
}
void main(){
  vec2 p = vWPos.xz;
  float t = uTime;
  float calm = 1.0 - uSeason.w * 0.85;
  float e = 0.08;
  float h0 = waveH(p, t);
  float hx = waveH(p + vec2(e, 0.0), t);
  float hz = waveH(p + vec2(0.0, e), t);
  vec3 n = normalize(vec3(-(hx - h0) / e * 0.06 * calm, 1.0, -(hz - h0) / e * 0.06 * calm));
  // click ripple
  float rt = t - uRipple.z;
  if (rt > 0.0 && rt < 5.0) {
    vec2 rd = p - uRipple.xy;
    float d = length(rd);
    float front = rt * 2.2;
    float ring = sin(d * 6.0 - rt * 9.0) * exp(-abs(d - front) * 1.2) * exp(-rt * 0.9) * (1.0 - smoothstep(front - 1.0, front + 0.6, d));
    n.xz += (rd / max(d, 0.001)) * ring * 0.35 * calm;
    n = normalize(n);
  }
  // pointer hover ripple
  vec2 pd = p - uPointer.xz;
  float pdl = length(pd);
  if (pdl < 2.0) {
    float pr = sin(pdl * 9.0 - t * 7.0) * (1.0 - smoothstep(0.0, 2.0, pdl)) * 0.12 * calm;
    n.xz += (pd / max(pdl, 0.001)) * pr;
    n = normalize(n);
  }
  vec3 V = normalize(uCamPos - vWPos);
  float fres = pow(1.0 - max(dot(V, n), 0.0), 3.0);
  vec3 R = reflect(-V, n);
  vec3 sky = mix(uSkyHorizon, uSkyZenith, clamp(R.y * 1.6, 0.0, 1.0));
  vec3 deep = mix(vec3(0.03, 0.07, 0.08), vec3(0.08, 0.20, 0.19), uDay);
  deep = mix(deep, deep * vec3(1.2, 1.0, 0.7), uSeason.z * 0.5);
  deep *= 0.12 + 0.88 * uDay;
  vec3 col = mix(deep, sky, 0.22 + 0.78 * fres);
  float spec = pow(max(dot(R, uSunDir), 0.0), 260.0) * uDay;
  col += uSunColor * spec * 2.0;
  col += vec3(0.6, 0.7, 0.95) * pow(max(dot(R, -uSunDir), 0.0), 500.0) * (1.0 - uDay) * 1.2;
  // ice
  float frost = vnoise(p * 0.25) * 0.5 + vnoise(p * 1.3) * 0.3 + vnoise(p * 4.0) * 0.2;
  float shoreDist = length(p - vec2(${LAKE_CENTER.x.toFixed(1)}, ${LAKE_CENTER.z.toFixed(1)}));
  float iceMask = uSeason.w * (0.55 + 0.45 * smoothstep(6.0, 16.0, shoreDist + (frost - 0.5) * 6.0));
  vec3 iceCol = mix(vec3(0.70, 0.78, 0.86), vec3(0.92, 0.95, 0.98), frost) * (0.08 + 0.92 * uDay);
  iceCol = mix(iceCol, sky, 0.25 * fres);
  col = mix(col, iceCol, iceMask);
  float alpha = mix(0.86 + 0.14 * fres, 0.98, iceMask);
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function Water() {
  const mat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {}]),
      transparent: true,
      fog: true,
    });
    Object.assign(m.uniforms, {
      uTime: U.uTime,
      uSeason: U.uSeason,
      uSkyZenith: U.uSkyZenith,
      uSkyHorizon: U.uSkyHorizon,
      uSunDir: U.uSunDir,
      uSunColor: U.uSunColor,
      uCamPos: U.uCamPos,
      uDay: U.uDay,
      uRipple: U.uRipple,
      uPointer: U.uPointer,
    });
    return m;
  }, []);

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    world.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = Math.hypot(e.clientX - world.pointerDown.x, e.clientY - world.pointerDown.y);
    if (d < 6) U.uRipple.value.set(e.point.x, e.point.z, U.uTime.value, 1);
  };

  return (
    <mesh
      position={[LAKE_CENTER.x, WATER_LEVEL, LAKE_CENTER.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={mat}
      renderOrder={2}
      onPointerDown={onDown}
      onPointerUp={onUp}
    >
      <planeGeometry args={[66, 66, 48, 48]} />
    </mesh>
  );
}
