import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { U } from "../world/world";

const vert = /* glsl */ `
varying vec3 vDir;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vDir = wp.xyz - cameraPosition;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const frag = /* glsl */ `
uniform vec3 uSkyZenith; uniform vec3 uSkyHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
uniform float uDay; uniform float uTime; uniform vec4 uSeason;
varying vec3 vDir;
float hash13(vec3 p){ p = fract(p*0.3183099 + vec3(0.1,0.2,0.3)); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uSkyHorizon, uSkyZenith, pow(clamp(h, 0.0, 1.0), 0.5));
  col = mix(col, uSkyHorizon * 0.55, clamp(-h * 3.0, 0.0, 1.0));
  // sun
  float sd = max(dot(d, uSunDir), 0.0);
  float sunVis = smoothstep(-0.12, 0.04, uSunDir.y);
  col += uSunColor * (pow(sd, 1200.0) * 4.0 + pow(sd, 14.0) * 0.35 + pow(sd, 3.0) * 0.12) * sunVis;
  // moon
  vec3 md = -uSunDir;
  float mdd = max(dot(d, md), 0.0);
  float night = 1.0 - uDay;
  col += vec3(0.85, 0.9, 1.0) * (pow(mdd, 3000.0) * 1.8 + pow(mdd, 60.0) * 0.12 + pow(mdd, 6.0) * 0.03) * night;
  // stars
  vec3 sp = d * 260.0;
  vec3 cell = floor(sp);
  float st = hash13(cell);
  vec3 f = fract(sp) - 0.5;
  float star = step(0.992, st) * (1.0 - smoothstep(0.04, 0.3, length(f)));
  star *= 0.55 + 0.45 * sin(uTime * 1.5 + st * 90.0);
  col += star * night * smoothstep(0.0, 0.25, h) * 1.2;
  // milky band
  float band = exp(-pow((d.x * 0.7 + d.y * 0.6 - 0.1) * 3.0, 2.0));
  col += vec3(0.16, 0.18, 0.26) * band * night * smoothstep(0.0, 0.3, h) * 0.5;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function Sky() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uSkyZenith: U.uSkyZenith,
          uSkyHorizon: U.uSkyHorizon,
          uSunDir: U.uSunDir,
          uSunColor: U.uSunColor,
          uDay: U.uDay,
          uTime: U.uTime,
          uSeason: U.uSeason,
        },
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    []
  );
  useFrame(({ camera }) => {
    if (ref.current) ref.current.position.copy(camera.position);
  });
  return (
    <mesh ref={ref} material={mat} renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[500, 32, 16]} />
    </mesh>
  );
}
