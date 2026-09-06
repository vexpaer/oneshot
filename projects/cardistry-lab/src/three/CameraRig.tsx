import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useLab, type View } from '../store';
import { tracker } from './tracker';

const PRESETS: Record<Exclude<View, 'finger' | 'orbit'>, { pos: THREE.Vector3; target: THREE.Vector3 }> = {
  front: { pos: new THREE.Vector3(0.4, 6.2, 11.2), target: new THREE.Vector3(0, 0.2, 0) },
  audience: { pos: new THREE.Vector3(-0.4, 4.5, -11.0), target: new THREE.Vector3(0, 0.3, 0) },
  side: { pos: new THREE.Vector3(11.5, 3.2, 0.8), target: new THREE.Vector3(0, 0.2, 0) },
  top: { pos: new THREE.Vector3(0, 12.5, 0.8), target: new THREE.Vector3(0, 0, 0) },
};

const _pos = new THREE.Vector3();
const _tgt = new THREE.Vector3();

export function CameraRig({ focusFingerId }: { focusFingerId: () => string | null }) {
  const view = useLab((s) => s.view);
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const fingerOffset = useRef(new THREE.Vector3(2.4, 1.9, 2.9));

  useEffect(() => {
    if (view === 'orbit' && controls.current) controls.current.update();
  }, [view]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (view === 'orbit') {
      c.update();
      return;
    }
    const k = 1 - Math.exp(-dt * 4.5);
    if (view === 'finger') {
      const id = focusFingerId();
      const tp = id ? tracker.tips[id] : null;
      if (tp) {
        _tgt.copy(tp);
        _pos.copy(tp).add(fingerOffset.current);
      } else {
        _tgt.copy(PRESETS.front.target);
        _pos.copy(PRESETS.front.pos);
      }
    } else {
      const p = PRESETS[view];
      _pos.copy(p.pos);
      _tgt.copy(p.target);
    }
    camera.position.lerp(_pos, k);
    c.target.lerp(_tgt, k);
    c.update();
  });

  return <OrbitControls ref={controls} makeDefault enabled={view === 'orbit'} enableDamping dampingFactor={0.08} minDistance={3} maxDistance={30} maxPolarAngle={Math.PI * 0.95} />;
}
