import { useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Sky } from "./Sky";
import { Atmosphere } from "./Atmosphere";
import { Terrain } from "./Terrain";
import { Grass } from "./Grass";
import { Trees } from "./Trees";
import { Water } from "./Water";
import { SeasonalParticles, Mist } from "./Particles";
import { Landmarks } from "./Landmarks";
import { MicroWorld } from "./MicroWorld";
import { CameraRig } from "./CameraRig";
import { useStore } from "../world/store";
import { INTRO } from "../world/content";
import { world } from "../world/world";

export function Scene() {
  const quality = useStore((s) => s.quality);
  const high = quality === "high";
  const [dpr, setDpr] = useState(high ? Math.min(1.5, window.devicePixelRatio) : Math.min(1, window.devicePixelRatio));

  return (
    <Canvas
      shadows
      dpr={dpr}
      camera={{ fov: 48, near: 0.1, far: 900, position: INTRO.pos.toArray() }}
      gl={{ antialias: !high, powerPreference: "high-performance", alpha: false, stencil: false }}
      onCreated={({ gl }) => {
        gl.toneMapping = high ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.0;
      }}
      onPointerMissed={(e) => {
        if (e.type !== "click") return;
        const d = Math.hypot(e.clientX - world.pointerDown.x, e.clientY - world.pointerDown.y);
        if (d > 6) return;
        const st = useStore.getState();
        st.setFocusItem(null);
        if (world.pointer.x < 9000 && st.scale === "macro") world.walkRequest = world.pointer.clone();
      }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(0.75, d - 0.25))}
        onIncline={() => setDpr((d) => Math.min(high ? 1.5 : 1, d + 0.25))}
        flipflops={3}
      />
      <Sky />
      <Atmosphere />
      <Terrain />
      <Grass />
      <Trees />
      <Water />
      <SeasonalParticles />
      <Mist />
      <Landmarks />
      <MicroWorld />
      <CameraRig />
      {high && (
        <EffectComposer multisampling={4}>
          <Bloom luminanceThreshold={1.05} luminanceSmoothing={0.25} intensity={0.75} mipmapBlur radius={0.65} />
          <Vignette eskil={false} offset={0.18} darkness={0.6} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
}
