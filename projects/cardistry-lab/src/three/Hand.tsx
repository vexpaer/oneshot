import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import type { FingerName, HandPose } from '../lib/types';
import { FINGERS } from '../lib/types';
import { tip } from './tracker';

interface FingerDef {
  base: [number, number, number];
  baseRot: [number, number, number];
  lengths: [number, number, number];
  radius: number;
}

// Left hand, palm up (+Y), fingers pointing -Z, thumb on -X side.
export const FINGER_DEFS: Record<FingerName, FingerDef> = {
  thumb: { base: [-1.45, 0.08, -1.05], baseRot: [0.15, Math.PI / 4, -0.62], lengths: [1.45, 1.15, 0.85], radius: 0.34 },
  index: { base: [-1.15, 0, -3.4], baseRot: [0, 0.03, 0], lengths: [1.55, 0.95, 0.7], radius: 0.285 },
  middle: { base: [-0.4, 0, -3.55], baseRot: [0, 0, 0], lengths: [1.7, 1.05, 0.75], radius: 0.285 },
  ring: { base: [0.35, 0, -3.45], baseRot: [0, -0.03, 0], lengths: [1.55, 1.0, 0.7], radius: 0.265 },
  pinky: { base: [1.08, 0, -3.15], baseRot: [0, -0.08, 0], lengths: [1.2, 0.75, 0.6], radius: 0.23 },
};

const SKIN = '#c4b3a2';
const HI = new THREE.Color('#38bdf8');
const FOCUS = new THREE.Color('#f59e0b');

interface Props {
  side: 'left' | 'right';
  poseRef: React.MutableRefObject<HandPose>;
  highlightRef: React.MutableRefObject<Set<string>>;
  /** returns the focused finger id (e.g. 'L.index') or null */
  focusId: () => string | null;
  wire: boolean;
}

interface FingerRefs {
  j1: THREE.Group | null;
  j2: THREE.Group | null;
  j3: THREE.Group | null;
  tip: THREE.Object3D | null;
}

export function Hand({ side, poseRef, highlightRef, focusId, wire }: Props) {
  const root = useRef<THREE.Group>(null);
  const refs = useRef<Record<FingerName, FingerRefs>>({
    thumb: { j1: null, j2: null, j3: null, tip: null },
    index: { j1: null, j2: null, j3: null, tip: null },
    middle: { j1: null, j2: null, j3: null, tip: null },
    ring: { j1: null, j2: null, j3: null, tip: null },
    pinky: { j1: null, j2: null, j3: null, tip: null },
  });
  const glow = useRef<Record<FingerName, number>>({ thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 });

  const palmMat = useMemo(() => new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85, metalness: 0.0 }), []);
  const fingerMats = useMemo(() => {
    const o = {} as Record<FingerName, THREE.MeshStandardMaterial>;
    for (const f of FINGERS) o[f] = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.85 });
    return o;
  }, []);
  const nailMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e8dccf', roughness: 0.4 }), []);

  useEffect(() => {
    palmMat.wireframe = wire;
    palmMat.transparent = wire;
    palmMat.opacity = wire ? 0.35 : 1;
    nailMat.wireframe = wire;
    for (const f of FINGERS) {
      fingerMats[f].wireframe = wire;
      fingerMats[f].transparent = wire;
      fingerMats[f].opacity = wire ? 0.6 : 1;
    }
  }, [wire, palmMat, fingerMats, nailMat]);

  useEffect(
    () => () => {
      palmMat.dispose();
      nailMat.dispose();
      Object.values(fingerMats).forEach((m) => m.dispose());
    },
    [palmMat, fingerMats, nailMat],
  );

  const prefix = side === 'left' ? 'L' : 'R';

  useFrame((_, dt) => {
    const pose = poseRef.current;
    const g = root.current;
    if (!g || !pose) return;
    g.position.set(pose.pos[0], pose.pos[1], pose.pos[2]);
    g.rotation.set(pose.rot[0], pose.rot[1], pose.rot[2], 'XYZ');
    g.scale.set(side === 'right' ? -1 : 1, 1, 1);
    const focus = focusId();

    for (const f of FINGERS) {
      const fp = pose.fingers[f];
      const r = refs.current[f];
      if (r.j1) r.j1.rotation.set(fp[1], fp[0], 0, 'YXZ');
      if (r.j2) r.j2.rotation.x = fp[2];
      if (r.j3) r.j3.rotation.x = fp[3];
      if (r.tip) r.tip.getWorldPosition(tip(`${prefix}.${f}`));

      const id = `${prefix}.${f}`;
      const isHi = highlightRef.current.has(id);
      const isFocus = focus === id;
      const target = isFocus ? 1 : isHi ? 0.7 : 0;
      const gl = glow.current;
      gl[f] += (target - gl[f]) * Math.min(1, dt * 10);
      const m = fingerMats[f];
      m.emissive.copy(isFocus ? FOCUS : HI);
      m.emissiveIntensity = gl[f] * 0.55;
    }
  });

  return (
    <group ref={root}>
      {/* palm */}
      <RoundedBox args={[3.05, 0.72, 3.5]} radius={0.32} smoothness={3} position={[0, 0, -1.72]} material={palmMat} />
      {/* thumb mount */}
      <RoundedBox args={[1.35, 0.66, 1.8]} radius={0.3} smoothness={3} position={[-1.3, -0.02, -0.95]} rotation={[0, 0.4, 0]} material={palmMat} />
      {/* wrist + forearm */}
      <RoundedBox args={[2.5, 0.8, 3.6]} radius={0.36} smoothness={3} position={[0, -0.06, 1.6]} material={palmMat} />
      <mesh position={[0, -0.06, 3.5]} rotation={[Math.PI / 2, 0, 0]} material={palmMat}>
        <cylinderGeometry args={[1.05, 1.25, 1.5, 16]} />
      </mesh>

      {FINGERS.map((f) => {
        const d = FINGER_DEFS[f];
        const [l1, l2, l3] = d.lengths;
        const r1 = d.radius, r2 = d.radius * 0.92, r3 = d.radius * 0.84;
        const mat = fingerMats[f];
        return (
          <group key={f} position={d.base} rotation={d.baseRot}>
            <group ref={(el) => (refs.current[f].j1 = el)}>
              <mesh material={mat}>
                <sphereGeometry args={[r1, 12, 10]} />
              </mesh>
              <mesh material={mat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -l1 / 2]}>
                <capsuleGeometry args={[r1, l1, 3, 10]} />
              </mesh>
              <group position={[0, 0, -l1]} ref={(el) => (refs.current[f].j2 = el)}>
                <mesh material={mat}>
                  <sphereGeometry args={[r2, 12, 10]} />
                </mesh>
                <mesh material={mat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -l2 / 2]}>
                  <capsuleGeometry args={[r2, l2, 3, 10]} />
                </mesh>
                <group position={[0, 0, -l2]} ref={(el) => (refs.current[f].j3 = el)}>
                  <mesh material={mat}>
                    <sphereGeometry args={[r3, 12, 10]} />
                  </mesh>
                  <mesh material={mat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -l3 / 2]}>
                    <capsuleGeometry args={[r3, l3, 3, 10]} />
                  </mesh>
                  {/* nail (on the back side, -Y) */}
                  <mesh material={nailMat} position={[0, -r3 * 0.8, -l3 * 0.6]} scale={[1, 1, 1.5]}>
                    <cylinderGeometry args={[r3 * 0.5, r3 * 0.5, 0.08, 10]} />
                  </mesh>
                  <object3D position={[0, r3 * 0.6, -l3 - r3 * 0.6]} ref={(el) => (refs.current[f].tip = el)} />
                </group>
              </group>
            </group>
          </group>
        );
      })}
    </group>
  );
}
