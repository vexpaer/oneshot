export type Vec3 = [number, number, number];
export type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
export const FINGERS: FingerName[] = ['thumb', 'index', 'middle', 'ring', 'pinky'];
export const FINGER_CN: Record<FingerName, string> = {
  thumb: '拇指',
  index: '食指',
  middle: '中指',
  ring: '无名指',
  pinky: '小指',
};

/** [spread(rotY), curl1, curl2, curl3] in radians */
export type FingerPose = [number, number, number, number];
export type Fingers = Record<FingerName, FingerPose>;

export interface HandPose {
  pos: Vec3;
  rot: Vec3;
  fingers: Fingers;
}

export interface PartialHand {
  pos?: Vec3;
  rot?: Vec3;
  fingers?: Partial<Fingers>;
}

/**
 * A packet's transform is expressed as:
 *   worldCenter = pivot - R(rot) * local
 * so that keeping `local` fixed while changing `rot` rotates the packet
 * around that local point (e.g. an edge held by the fingers).
 */
export interface PacketPose {
  pivot: Vec3;
  local: Vec3;
  rot: Vec3;
  /** total fan angle across the packet (top card rotates most) */
  fan?: number;
  /** progressive tilt per card (pressure-fan bend look) */
  bend?: number;
}

export interface PacketDef {
  id: string;
  label: string;
  count: number;
}

export interface Keyframe {
  t: number;
  packets: Record<string, PacketPose>;
  left: HandPose;
  right: HandPose;
}

export interface Step {
  index: number;
  title: string;
  cn: string;
  desc: string;
  t0: number;
  t1: number;
  /** finger ids like 'L.thumb', 'R.index' */
  fingers: string[];
  /** active packet ids */
  packets: string[];
}

export interface Move {
  id: string;
  name: string;
  cn: string;
  tagline: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  category: 'cut' | 'display' | 'fan';
  packets: PacketDef[];
  keyframes: Keyframe[];
  steps: Step[];
  duration: number;
}

export interface PacketState {
  id: string;
  count: number;
  center: Vec3;
  rot: Vec3;
  fan: number;
  bend: number;
}

export interface EvalState {
  packets: PacketState[];
  left: HandPose;
  right: HandPose;
}
