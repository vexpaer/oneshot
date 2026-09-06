import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { MOVES } from '../lib/moves';
import { useLab } from '../store';

const CAT_COLOR: Record<string, string> = { cut: '#38bdf8', display: '#a78bfa', fan: '#34d399' };

/** Floating move-selection nodes arranged in an arc behind the demo area */
export function MoveNodes() {
  const moveId = useLab((s) => s.moveId);
  const setMove = useLab((s) => s.setMove);
  const layout = useMemo(() => {
    const n = MOVES.length;
    return MOVES.map((m, i) => {
      const a = Math.PI * (0.1 + (0.8 * i) / (n - 1)); // 18° .. 162°
      const R = 7.4;
      const y = [2.6, 0.6, 3.2, -0.9, 3.2, 0.6, 2.6, -0.9][i % 8];
      return { move: m, pos: new THREE.Vector3(Math.cos(a) * R, y, -Math.sin(a) * R * 0.7 - 2.2), color: CAT_COLOR[m.category] };
    });
  }, []);
  return (
    <group>
      {layout.map((l, i) => (
        <Node key={l.move.id} index={i} pos={l.pos} color={l.color} active={l.move.id === moveId} name={l.move.name} cn={l.move.cn} onClick={() => setMove(l.move.id)} />
      ))}
    </group>
  );
}

function Node({ index, pos, color, active, name, cn, onClick }: { index: number; pos: THREE.Vector3; color: string; active: boolean; name: string; cn: string; onClick: () => void }) {
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) g.current.position.set(pos.x, pos.y + Math.sin(t * 0.8 + index * 1.3) * 0.18, pos.z);
    if (ring.current) {
      ring.current.rotation.x = t * 0.4 + index;
      ring.current.rotation.y = t * 0.6;
      const s = active ? 1.25 : 1;
      ring.current.scale.setScalar(s);
    }
  });
  return (
    <group ref={g}>
      <mesh ref={ring}>
        <torusGeometry args={[0.42, 0.018, 8, 48]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.95 : 0.4} />
      </mesh>
      <mesh onClick={(e) => { e.stopPropagation(); onClick(); }} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1.6 : 0.5} roughness={0.3} />
      </mesh>
      {/* invisible bigger hit-area */}
      <mesh onClick={(e) => { e.stopPropagation(); onClick(); }} visible={false}>
        <sphereGeometry args={[0.6, 8, 8]} />
      </mesh>
      <Html center position={[0, -0.75, 0]} zIndexRange={[6, 0]} style={{ pointerEvents: 'auto' }}>
        <button
          onClick={onClick}
          className={`group flex select-none flex-col items-center whitespace-nowrap rounded-lg border px-2.5 py-1 text-center backdrop-blur-md transition-all ${
            active ? 'border-white/40 bg-white/10 text-white shadow-[0_0_24px_rgba(56,189,248,0.25)]' : 'border-white/10 bg-black/35 text-white/60 hover:border-white/30 hover:text-white'
          }`}
        >
          <span className="text-[11px] font-semibold tracking-wide">{name}</span>
          <span className="text-[10px] opacity-70">{cn}</span>
        </button>
      </Html>
    </group>
  );
}
