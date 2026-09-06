import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { U, world, SEASONS, LAKE_CENTER } from "../world/world";
import { useStore } from "../world/store";
import { audio } from "../world/audio";

const C = {
  dayZ: new THREE.Color("#3f7bbd"),
  dayH: new THREE.Color("#b8d3e6"),
  duskZ: new THREE.Color("#4a4f86"),
  duskH: new THREE.Color("#f0a066"),
  nightZ: new THREE.Color("#070a16"),
  nightH: new THREE.Color("#182238"),
  sunLow: new THREE.Color("#ffa060"),
  sunHigh: new THREE.Color("#fff3df"),
  moon: new THREE.Color("#8ea6d8"),
};
const seasonTintH = [new THREE.Color("#f2f6f0"), new THREE.Color("#ffffff"), new THREE.Color("#ffe9d2"), new THREE.Color("#e6ecf4")];
const seasonTintZ = [new THREE.Color("#f4f8ff"), new THREE.Color("#ffffff"), new THREE.Color("#f6f0ea"), new THREE.Color("#dde6f2")];
const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const tmpC = new THREE.Color();

export function Atmosphere() {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const quality = useStore((s) => s.quality);
  const fog = useMemo(() => new THREE.FogExp2("#b8d3e6", 0.012), []);

  useEffect(() => {
    scene.fog = fog;
    (window as unknown as { __ne: Record<string, unknown> }).__ne.scene = scene;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.1);
    const st = useStore.getState();
    // clock
    if (st.timeAuto && st.entered) world.time = (world.time + d / world.dayLength) % 1;
    U.uTime.value += d;

    // season blend
    const target = SEASONS.indexOf(st.season);
    const S = world.seasonMix;
    const k = 1 - Math.pow(0.001, d); // ~ smooth in a couple of seconds
    const arr = [S.x, S.y, S.z, S.w];
    for (let i = 0; i < 4; i++) arr[i] += ((i === target ? 1 : 0) - arr[i]) * k * 0.3;
    const sum = arr[0] + arr[1] + arr[2] + arr[3];
    S.set(arr[0] / sum, arr[1] / sum, arr[2] / sum, arr[3] / sum);

    // sun
    const ang = (world.time - 0.25) * Math.PI * 2;
    const sunDir = U.uSunDir.value.set(Math.cos(ang) * 0.9, Math.sin(ang), -0.42 + Math.sin(ang) * 0.1).normalize();
    const elev = sunDir.y;
    world.sunElev = elev;
    const day = THREE.MathUtils.smoothstep(elev, -0.1, 0.2);
    world.dayFactor = day;
    U.uDay.value = day;
    const dusk = Math.exp(-Math.pow(elev / 0.16, 2));

    // sky colors
    tmpA.copy(C.nightZ).lerp(C.dayZ, day);
    tmpB.copy(C.nightH).lerp(C.dayH, day);
    tmpA.lerp(C.duskZ, dusk * 0.7);
    tmpB.lerp(C.duskH, dusk * 0.9);
    // season tint
    tmpC.setRGB(0, 0, 0);
    for (let i = 0; i < 4; i++) tmpC.add(seasonTintH[i].clone().multiplyScalar(arr[i] / sum));
    tmpB.multiply(tmpC);
    tmpC.setRGB(0, 0, 0);
    for (let i = 0; i < 4; i++) tmpC.add(seasonTintZ[i].clone().multiplyScalar(arr[i] / sum));
    tmpA.multiply(tmpC);
    U.uSkyZenith.value.copy(tmpA);
    U.uSkyHorizon.value.copy(tmpB);

    const sunCol = U.uSunColor.value.copy(C.sunLow).lerp(C.sunHigh, THREE.MathUtils.clamp(elev * 2.5, 0, 1));

    // fog
    fog.color.copy(tmpB);
    const dawnMist = Math.exp(-Math.pow((world.time - 0.29) / 0.07, 2));
    fog.density = 0.0065 + dawnMist * 0.0045 + S.w * 0.006 + S.z * 0.0015 - S.y * 0.001 + (1 - day) * 0.002;
    if (st.scale === "micro") fog.density = 0.02;

    // lights
    if (sun.current) {
      const l = sun.current;
      const useMoon = elev < -0.02;
      const dir = useMoon ? sunDir.clone().negate() : sunDir.clone();
      l.position.copy(dir).multiplyScalar(90);
      if (st.scale === "micro") l.position.y += -300;
      l.target.position.set(0, st.scale === "micro" ? -300 : 0, 6);
      l.target.updateMatrixWorld();
      if (useMoon) {
        l.color.copy(C.moon);
        l.intensity = 0.45 * (1 - day);
      } else {
        l.color.copy(sunCol);
        l.intensity = 0.4 + 2.6 * day * THREE.MathUtils.clamp(elev * 3, 0.25, 1);
      }
    }
    if (hemi.current) {
      hemi.current.color.copy(tmpA).lerp(tmpB, 0.4);
      hemi.current.groundColor.setRGB(0.25, 0.2, 0.14).lerp(new THREE.Color(0.7, 0.72, 0.78), S.w);
      hemi.current.intensity = 0.25 + 0.75 * day;
    }
    if (amb.current) amb.current.intensity = 0.06 + 0.1 * (1 - day);

    // wind gusts
    const t = U.uTime.value;
    const gust = 0.35 + 0.25 * Math.sin(t * 0.23) + 0.2 * Math.sin(t * 0.61 + 1.3) + 0.1 * Math.sin(t * 1.7);
    const seasonWind = 0.7 + S.z * 0.6 + S.w * 0.3 - S.y * 0.2;
    U.uWind.value = Math.max(0.05, gust * seasonWind);
    world.windGust = U.uWind.value;

    // camera pos for shaders
    world.camPos.copy(state.camera.position);
    world.lakeDist = Math.hypot(state.camera.position.x - LAKE_CENTER.x, state.camera.position.z - LAKE_CENTER.z);

    // audio
    audio.update({
      day,
      season: arr.map((v) => v / sum),
      lakeDist: world.lakeDist,
      wind: U.uWind.value,
      muted: st.muted || !st.entered,
      micro: st.scale === "micro",
    });
  });

  const shadowSize = quality === "high" ? 2048 : 1024;
  return (
    <>
      <directionalLight
        ref={sun}
        castShadow
        intensity={2}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-62}
        shadow-camera-right={62}
        shadow-camera-top={62}
        shadow-camera-bottom={-62}
        shadow-camera-near={10}
        shadow-camera-far={220}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
      />
      <hemisphereLight ref={hemi} intensity={0.6} />
      <ambientLight ref={amb} intensity={0.1} />
    </>
  );
}
