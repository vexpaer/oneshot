import * as THREE from 'three';
import type { EvalState, FingerPose, Fingers, HandPose, Move, PacketPose, Step, Vec3 } from './types';
import { FINGERS } from './types';

export const CARD_W = 2.5;
export const CARD_H = 3.5;
export const CARD_T = 0.0115;

export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const lerp3 = (a: Vec3, b: Vec3, u: number): Vec3 => [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
export const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

export function packetCenter(p: PacketPose): Vec3 {
  _e.set(p.rot[0], p.rot[1], p.rot[2], 'XYZ');
  _q.setFromEuler(_e);
  _v.set(p.local[0], p.local[1], p.local[2]).applyQuaternion(_q);
  return [p.pivot[0] - _v.x, p.pivot[1] - _v.y, p.pivot[2] - _v.z];
}

/** Re-express a pose with a different local pivot but the same world transform */
export function rebase(p: PacketPose, local: Vec3): PacketPose {
  const c = packetCenter(p);
  _e.set(p.rot[0], p.rot[1], p.rot[2], 'XYZ');
  _q.setFromEuler(_e);
  _v.set(local[0], local[1], local[2]).applyQuaternion(_q);
  return { ...p, local: [...local] as Vec3, pivot: [c[0] + _v.x, c[1] + _v.y, c[2] + _v.z] };
}

function lerpPacket(a: PacketPose, b: PacketPose, u: number): PacketPose {
  return {
    pivot: lerp3(a.pivot, b.pivot, u),
    local: lerp3(a.local, b.local, u),
    rot: lerp3(a.rot, b.rot, u),
    fan: lerp(a.fan ?? 0, b.fan ?? 0, u),
    bend: lerp(a.bend ?? 0, b.bend ?? 0, u),
  };
}

function lerpFinger(a: FingerPose, b: FingerPose, u: number): FingerPose {
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
}

function lerpHand(a: HandPose, b: HandPose, u: number): HandPose {
  const fingers = {} as Fingers;
  for (const f of FINGERS) fingers[f] = lerpFinger(a.fingers[f], b.fingers[f], u);
  return { pos: lerp3(a.pos, b.pos, u), rot: lerp3(a.rot, b.rot, u), fingers };
}

export function evaluate(move: Move, time: number): EvalState {
  const kfs = move.keyframes;
  const t = clamp(time, 0, move.duration);
  let i = 0;
  while (i < kfs.length - 2 && kfs[i + 1].t <= t) i++;
  const a = kfs[i];
  const b = kfs[Math.min(i + 1, kfs.length - 1)];
  const span = b.t - a.t;
  const u = span > 0 ? easeInOut(clamp((t - a.t) / span, 0, 1)) : 1;

  const packets = move.packets.map((def) => {
    const p = lerpPacket(a.packets[def.id], b.packets[def.id], u);
    return { id: def.id, count: def.count, center: packetCenter(p), rot: p.rot, fan: p.fan ?? 0, bend: p.bend ?? 0 };
  });
  return { packets, left: lerpHand(a.left, b.left, u), right: lerpHand(a.right, b.right, u) };
}

export function stepAt(move: Move, t: number): Step {
  const steps = move.steps;
  for (let i = steps.length - 1; i >= 0; i--) if (t >= steps[i].t0 - 1e-6) return steps[i];
  return steps[0];
}

/** sample the world center trajectory of a packet over [t0,t1] */
export function samplePath(move: Move, packetId: string, t0: number, t1: number, n = 32): Vec3[] {
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    const s = evaluate(move, t);
    const p = s.packets.find((x) => x.id === packetId);
    if (p) out.push(p.center);
  }
  return out;
}

export function packetThickness(count: number) {
  return count * CARD_T;
}
