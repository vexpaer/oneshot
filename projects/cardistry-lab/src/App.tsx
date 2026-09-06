import { Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { LabScene } from './three/Scene';
import { HUD } from './ui/HUD';
import { useLab } from './store';
import { MOVE_MAP } from './lib/moves';

function LabCanvas({ moveId, primary, showNodes }: { moveId: string; primary: boolean; showNodes: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 36, near: 0.1, far: 80, position: [0.4, 6.2, 11.2] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
    >
      <Suspense fallback={null}>
        <LabScene moveId={moveId} primary={primary} showNodes={showNodes} />
      </Suspense>
    </Canvas>
  );
}

export default function App() {
  const compare = useLab((s) => s.compare);
  const moveId = useLab((s) => s.moveId);
  const compareId = useLab((s) => s.compareId);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const s = useLab.getState();
      if (e.code === 'Space') {
        e.preventDefault();
        s.toggle();
      } else if (e.code === 'ArrowRight') s.nextStep();
      else if (e.code === 'ArrowLeft') s.prevStep();
      else if (e.key === 'r') s.replay();
      else if (e.key === 'g') s.toggleFlag('ghost');
      else if (e.key === 'e') s.toggleFlag('explode');
      else if (e.key === 't') s.toggleFlag('transparent');
      else if (e.key === 'w') s.toggleFlag('wire');
      else if (e.key >= '1' && e.key <= '6') {
        const views = ['front', 'audience', 'side', 'top', 'finger', 'orbit'] as const;
        s.setView(views[parseInt(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#07090d]">
      {compare ? (
        <div className="grid h-full w-full grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1">
          <div className="relative border-b border-white/10 md:border-b-0 md:border-r">
            <LabCanvas moveId={moveId} primary showNodes={false} />
            <SplitLabel name={MOVE_MAP[moveId].name} cn={MOVE_MAP[moveId].cn} side="A" />
          </div>
          <div className="relative">
            <LabCanvas moveId={compareId} primary={false} showNodes={false} />
            <SplitLabel name={MOVE_MAP[compareId].name} cn={MOVE_MAP[compareId].cn} side="B" />
          </div>
        </div>
      ) : (
        <LabCanvas moveId={moveId} primary showNodes />
      )}
      <HUD />
      <Vignette />
    </div>
  );
}

function SplitLabel({ name, cn, side }: { name: string; cn: string; side: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-24 z-10 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-center backdrop-blur-md md:top-28">
      <span className="mr-2 text-[10px] tracking-widest text-violet-200/70">{side}</span>
      <span className="text-xs font-medium text-white/90">{name}</span>
      <span className="ml-2 text-[10px] text-white/50">{cn}</span>
    </div>
  );
}

function Vignette() {
  return <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55)_100%)]" />;
}
