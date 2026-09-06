import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { CARD_T } from '../lib/anim';
import type { PacketState } from '../lib/types';
import { cardGeometry, makePacketMaterials } from './cards';

interface Props {
  count: number;
  /** mutable ref holding the latest evaluated state for this packet */
  stateRef: React.MutableRefObject<PacketState | null>;
  highlightRef: React.MutableRefObject<boolean>;
  explodeRef: React.MutableRefObject<number>;
  transparent: boolean;
  wire: boolean;
  dimmed: boolean;
}

const PIVOT = new THREE.Vector3(-1.25, 0, 1.75);
const HIGHLIGHT = new THREE.Color('#38bdf8');
const _q = new THREE.Quaternion();
const _qy = new THREE.Quaternion();
const _qx = new THREE.Quaternion();
const _v = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);

export function Packet({ count, stateRef, highlightRef, explodeRef, transparent, wire, dimmed }: Props) {
  const group = useRef<THREE.Group>(null);
  const cards = useRef<THREE.Mesh[]>([]);
  const geo = useMemo(() => cardGeometry(), []);
  const mats = useMemo(() => makePacketMaterials(), []);
  const glow = useRef(0);

  useEffect(() => () => mats.all.forEach((m) => m.dispose()), [mats]);

  useEffect(() => {
    for (const m of mats.all) {
      m.transparent = transparent;
      m.opacity = transparent ? 0.28 : 1;
      m.depthWrite = !transparent;
      m.wireframe = wire;
      m.needsUpdate = true;
    }
  }, [transparent, wire, mats]);

  useFrame((_, dt) => {
    const st = stateRef.current;
    const g = group.current;
    if (!st || !g) return;
    g.position.set(st.center[0], st.center[1] + explodeRef.current, st.center[2]);
    g.rotation.set(st.rot[0], st.rot[1], st.rot[2], 'XYZ');

    const n = count;
    const fan = st.fan, bend = st.bend;
    for (let i = 0; i < n; i++) {
      const m = cards.current[i];
      if (!m) continue;
      const y = (i - (n - 1) / 2) * CARD_T;
      if (fan === 0 && bend === 0) {
        m.position.set(0, y, 0);
        m.quaternion.identity();
      } else {
        const k = n > 1 ? i / (n - 1) : 0;
        _qy.setFromAxisAngle(Y, fan * k);
        _qx.setFromAxisAngle(X, bend * k * 0.6);
        _q.copy(_qx).multiply(_qy);
        _v.set(0, y, 0).sub(PIVOT).applyQuaternion(_q).add(PIVOT);
        m.position.copy(_v);
        m.quaternion.copy(_q);
      }
    }

    // highlight glow (smoothed)
    const target = highlightRef.current ? 1 : 0;
    glow.current += (target - glow.current) * Math.min(1, dt * 10);
    const gl = glow.current;
    const dim = dimmed ? 0.35 : 0;
    for (const m of mats.all) {
      m.emissive.copy(HIGHLIGHT);
      m.emissiveIntensity = gl * 0.45;
      m.color.setScalar(1 - dim);
    }
    mats.edgeA.color.set('#efe9dc').multiplyScalar(1 - dim);
    mats.edgeB.color.set('#d9d2c3').multiplyScalar(1 - dim);
  });

  const items = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  return (
    <group ref={group}>
      {items.map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) cards.current[i] = el;
          }}
          geometry={geo}
          material={[mats.face, mats.back, i % 2 ? mats.edgeA : mats.edgeB]}
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}
