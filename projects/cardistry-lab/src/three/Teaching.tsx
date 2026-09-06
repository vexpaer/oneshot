import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html, Line } from '@react-three/drei';
import { CARD_H, CARD_W, evaluate, packetThickness as th, samplePath } from '../lib/anim';
import type { Move, Step, Vec3 } from '../lib/types';
import { tracker } from './tracker';
import { useLab } from '../store';

const PATH_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24'];

/** Glowing trajectory for each active packet of the current step */
export function Paths({ move, step }: { move: Move; step: Step | null }) {
  const data = useMemo(() => {
    if (!step) return [];
    return step.packets
      .map((id, i) => {
        const pts = samplePath(move, id, step.t0, step.t1, 40);
        const moving = pts.some((p) => Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1], p[2] - pts[0][2]) > 0.08);
        return { id, pts, color: PATH_COLORS[i % PATH_COLORS.length], moving };
      })
      .filter((d) => d.moving);
  }, [move, step]);

  return (
    <group>
      {data.map((d) => (
        <PathLine key={d.id + step?.index} pts={d.pts} color={d.color} />
      ))}
    </group>
  );
}

function PathLine({ pts, color }: { pts: Vec3[]; color: string }) {
  const cone = useRef<THREE.Mesh>(null);
  const dir = useMemo(() => {
    const n = pts.length;
    const a = new THREE.Vector3(...pts[Math.max(0, n - 4)]);
    const b = new THREE.Vector3(...pts[n - 1]);
    const d = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    return { q, end: b };
  }, [pts]);
  return (
    <group>
      <Line points={pts} color={color} lineWidth={2.2} transparent opacity={0.75} />
      <Line points={pts} color={color} lineWidth={7} transparent opacity={0.12} />
      <mesh ref={cone} position={dir.end} quaternion={dir.q}>
        <coneGeometry args={[0.13, 0.4, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh position={pts[0]}>
        <sphereGeometry args={[0.08, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

/** Packet labels following packet centers */
export function PacketLabels({ move, step, explodeRef }: { move: Move; step: Step | null; explodeRef: React.MutableRefObject<number> }) {
  return (
    <group>
      {move.packets.map((p, i) => (
        <PacketLabel key={p.id} id={p.id} index={i} label={p.label} count={p.count} active={!!step?.packets.includes(p.id)} explodeOffset={() => explodeRef.current * (move.packets.length - 1 - i)} />
      ))}
    </group>
  );
}

function PacketLabel({ id, index, label, count, active }: { id: string; index: number; label: string; count: number; explodeOffset: () => number; active: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const c = tracker.packets[id];
    // tracker already contains the explode offset; stagger labels so stacked packets don't overlap
    if (c && g.current) g.current.position.set(c.x - 1.1 + index * 0.75, c.y + 0.3 + index * 0.12, c.z + 1.2);
  });
  return (
    <group ref={g}>
      <Html center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div
          className={`select-none whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider backdrop-blur-sm transition-colors ${
            active ? 'border-sky-300/70 bg-sky-400/20 text-sky-100 shadow-[0_0_14px_rgba(56,189,248,0.45)]' : 'border-white/15 bg-black/40 text-white/60'
          }`}
        >
          {label} <span className="opacity-60">· {count}</span>
        </div>
      </Html>
    </group>
  );
}

/** Glowing dots on the active fingertips */
export function ContactPoints({ step }: { step: Step | null }) {
  const refs = useRef<THREE.Mesh[]>([]);
  useFrame(({ clock }) => {
    const ids = step?.fingers ?? [];
    const pulse = 0.9 + Math.sin(clock.elapsedTime * 6) * 0.15;
    for (let i = 0; i < 6; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const id = ids[i];
      const p = id ? tracker.tips[id] : null;
      if (p) {
        m.visible = true;
        m.position.copy(p);
        m.scale.setScalar(pulse);
      } else m.visible = false;
    }
  });
  return (
    <group>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} ref={(el) => el && (refs.current[i] = el)} visible={false}>
          <sphereGeometry args={[0.16, 12, 12]} />
          <meshBasicMaterial color="#7dd3fc" transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Amber ring that follows the finger selected via Finger Focus */
export function FocusMarker({ focusId }: { focusId: () => string | null }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock, camera }) => {
    const id = focusId();
    const p = id ? tracker.tips[id] : null;
    if (!g.current) return;
    if (!p) {
      g.current.visible = false;
      return;
    }
    g.current.visible = true;
    g.current.position.copy(p);
    g.current.quaternion.copy(camera.quaternion);
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.12;
    g.current.scale.setScalar(s);
  });
  return (
    <group ref={g} visible={false}>
      <mesh>
        <ringGeometry args={[0.3, 0.36, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.9} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.5, 0.52, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} side={THREE.DoubleSide} depthTest={false} />
      </mesh>
    </group>
  );
}

/** Semi-transparent afterimages of the packets from a few moments ago */
export function Ghosts({ move }: { move: Move }) {
  const N = 5;
  const meshes = useRef<THREE.Mesh[][]>([]);
  const mats = useMemo(
    () =>
      Array.from({ length: N }, (_, k) => new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.16 * (1 - k / (N + 1)), depthWrite: false, side: THREE.DoubleSide })),
    [],
  );
  useFrame(() => {
    const { t, speed } = useLab.getState();
    for (let k = 0; k < N; k++) {
      const tt = t - (k + 1) * 0.09 * Math.max(0.6, speed);
      const st = tt > 0 ? evaluate(move, tt) : null;
      move.packets.forEach((p, i) => {
        const m = meshes.current[k]?.[i];
        if (!m) return;
        const ps = st?.packets[i];
        if (!ps || ps.fan !== 0) {
          m.visible = false;
          return;
        }
        m.visible = true;
        m.position.set(ps.center[0], ps.center[1], ps.center[2]);
        m.rotation.set(ps.rot[0], ps.rot[1], ps.rot[2], 'XYZ');
        m.scale.set(1, th(p.count), 1);
      });
    }
  });
  return (
    <group>
      {Array.from({ length: N }, (_, k) => (
        <group key={k}>
          {move.packets.map((p, i) => (
            <mesh
              key={p.id}
              ref={(el) => {
                if (!meshes.current[k]) meshes.current[k] = [];
                if (el) meshes.current[k][i] = el;
              }}
              material={mats[k]}
            >
              <boxGeometry args={[CARD_W, 1, CARD_H]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
