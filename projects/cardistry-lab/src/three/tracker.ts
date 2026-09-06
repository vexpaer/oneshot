import * as THREE from 'three';

/** Mutable per-frame data shared between the 3D scene, camera rig and overlays (no React re-renders). */
export const tracker = {
  tips: {} as Record<string, THREE.Vector3>,
  packets: {} as Record<string, THREE.Vector3>,
};

export function tip(id: string) {
  let v = tracker.tips[id];
  if (!v) {
    v = new THREE.Vector3();
    tracker.tips[id] = v;
  }
  return v;
}
