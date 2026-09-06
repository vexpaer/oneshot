import { CARD_T, packetCenter, rebase } from './anim';
import type { Fingers, HandPose, Keyframe, Move, PacketDef, PacketPose, PartialHand, Step, Vec3 } from './types';

// ---------------------------------------------------------------------------
// Hand pose library
// ---------------------------------------------------------------------------
const PI = Math.PI;

export const RELAXED: Fingers = {
  thumb: [0, 0.25, 0.25, 0.15],
  index: [0.08, 0.35, 0.35, 0.2],
  middle: [0, 0.4, 0.4, 0.25],
  ring: [-0.05, 0.45, 0.45, 0.25],
  pinky: [-0.15, 0.5, 0.45, 0.25],
};

export const L_REST: HandPose = { pos: [-5.2, -1.2, 3.0], rot: [0.35, 0.55, 0.15], fingers: RELAXED };
export const R_REST: HandPose = { pos: [5.2, -1.2, 3.0], rot: [0.35, -0.55, -0.15], fingers: RELAXED };

/** Left hand mechanic's grip: deck resting in palm, fingers curled on the right long edge, thumb on top-left */
export const L_MECH: HandPose = {
  pos: [-1.55, -0.68, 1.75],
  rot: [0, -0.87, 0],
  fingers: {
    thumb: [0.55, 0.35, 0.2, 0.1],
    index: [0.0, 0.62, 0.95, 0.45],
    middle: [0, 0.66, 1.0, 0.5],
    ring: [0, 0.68, 1.0, 0.5],
    pinky: [0, 0.78, 1.0, 0.5],
  },
};

/** Left hand fingertip (Charlier) grip: deck across the fingertips, thumb on the near long edge */
export const L_TIP: HandPose = {
  pos: [0.35, -1.6, 3.4],
  rot: [0.05, 0, 0],
  fingers: {
    thumb: [-0.45, 1.05, 0.55, 0.3],
    index: [0.05, 0.25, 0.35, 0.2],
    middle: [0, 0.5, 0.9, 0.6],
    ring: [0, 0.5, 0.92, 0.6],
    pinky: [0.05, 0.56, 0.9, 0.6],
  },
};

/** Left hand holding the near-left corner of the deck for fanning */
export const L_FAN: HandPose = {
  pos: [-2.5, -0.8, 3.6],
  rot: [0.05, -0.45, 0],
  fingers: {
    thumb: [-0.25, 0.75, 0.45, 0.25],
    index: [0.05, 0.45, 0.7, 0.4],
    middle: [0, 0.5, 0.8, 0.45],
    ring: [0, 0.55, 0.85, 0.45],
    pinky: [0, 0.6, 0.85, 0.45],
  },
};

/** Right hand biddle grip from above, over a deck centered at c */
export function R_BIDDLE(c: Vec3, opts: { open?: boolean; lift?: number } = {}): HandPose {
  const lift = opts.lift ?? 0;
  const open = opts.open ?? false;
  return {
    pos: [c[0] + 0.55, c[1] + 1.95 + lift, c[2] + 2.55],
    rot: [0, 0.3, PI],
    fingers: {
      thumb: open ? [0.1, 0.5, 0.3, 0.2] : [0.15, 0.95, 0.65, 0.35],
      index: open ? [0.05, 0.4, 0.5, 0.3] : [0.05, 0.72, 0.8, 0.35],
      middle: open ? [0, 0.4, 0.5, 0.3] : [0, 0.76, 0.82, 0.35],
      ring: open ? [0, 0.4, 0.5, 0.3] : [0, 0.78, 0.82, 0.35],
      pinky: open ? [-0.05, 0.4, 0.5, 0.3] : [-0.05, 0.72, 0.8, 0.35],
    },
  };
}

/** Right hand hovering palm-down, index extended (pointing / pressing) */
export function R_POINT(c: Vec3): HandPose {
  return {
    pos: [c[0] + 0.7, c[1] + 1.8, c[2] + 2.3],
    rot: [0.15, 0.25, PI],
    fingers: {
      thumb: [0.2, 0.7, 0.5, 0.3],
      index: [0.0, 0.55, 0.4, 0.2],
      middle: [0, 1.2, 1.3, 0.8],
      ring: [0, 1.3, 1.3, 0.8],
      pinky: [-0.05, 1.3, 1.3, 0.8],
    },
  };
}

export function mergeHand(base: HandPose, p?: PartialHand): HandPose {
  if (!p) return base;
  return {
    pos: p.pos ?? base.pos,
    rot: p.rot ?? base.rot,
    fingers: { ...base.fingers, ...(p.fingers ?? {}) } as Fingers,
  };
}

export function moved(h: HandPose, d: Vec3, dr: Vec3 = [0, 0, 0]): HandPose {
  return { ...h, pos: [h.pos[0] + d[0], h.pos[1] + d[1], h.pos[2] + d[2]], rot: [h.rot[0] + dr[0], h.rot[1] + dr[1], h.rot[2] + dr[2]] };
}

// ---------------------------------------------------------------------------
// Packet helpers
// ---------------------------------------------------------------------------
export const th = (n: number) => n * CARD_T;

/** flat packet with its center at c */
export function flat(c: Vec3, rot: Vec3 = [0, 0, 0], extra: Partial<PacketPose> = {}): PacketPose {
  return { pivot: c, local: [0, 0, 0], rot, ...extra };
}

/**
 * Squared deck: `order` bottom -> top, whole-deck center at `center`.
 * Returns packet poses keyed by id with local = [0,0,0].
 */
export function squared(defs: PacketDef[], order: string[], center: Vec3 = [0, 0, 0], rot: Vec3 = [0, 0, 0]) {
  const total = order.reduce((s, id) => s + th(defs.find((d) => d.id === id)!.count), 0);
  let y = -total / 2;
  const out: Record<string, PacketPose> = {};
  // rotation of the whole deck: offsets along the deck normal
  const nx = Math.sin(rot[2]) * -1, ny = Math.cos(rot[0]) * Math.cos(rot[2]), nz = Math.sin(rot[0]);
  for (const id of order) {
    const t = th(defs.find((d) => d.id === id)!.count);
    const cy = y + t / 2;
    out[id] = { pivot: [center[0] + nx * cy, center[1] + ny * cy, center[2] + nz * cy], local: [0, 0, 0], rot: [...rot] as Vec3 };
    y += t;
  }
  return out;
}

/** Same world transform, but pivoting around a local point (edge/corner) */
export function pivotAt(p: PacketPose, local: Vec3): PacketPose {
  return rebase(p, local);
}

/** rotate a pose in place around its current local pivot */
export function rotTo(p: PacketPose, rot: Vec3, pivot?: Vec3): PacketPose {
  return { ...p, rot, pivot: pivot ?? p.pivot };
}

export function centerOf(p: PacketPose): Vec3 {
  return packetCenter(p);
}

// ---------------------------------------------------------------------------
// Move builder
// ---------------------------------------------------------------------------
interface Override {
  packets?: Record<string, PacketPose>;
  left?: PartialHand | HandPose;
  right?: PartialHand | HandPose;
}

interface StepMeta {
  fingers?: string[];
  packets?: string[];
}

export class MoveBuilder {
  private kfs: Keyframe[] = [];
  private steps: Step[] = [];
  constructor(
    private meta: Omit<Move, 'keyframes' | 'steps' | 'duration'>,
    initialPackets: Record<string, PacketPose>,
    left: HandPose,
    right: HandPose,
  ) {
    this.kfs.push({ t: 0, packets: { ...initialPackets }, left, right });
  }

  get last() {
    return this.kfs[this.kfs.length - 1];
  }
  packet(id: string) {
    return this.last.packets[id];
  }

  /** Add a keyframe at time t; unspecified values carry over from the previous keyframe. */
  at(t: number, o: Override = {}) {
    const prev = this.last;
    const left = mergeHand(prev.left, o.left as PartialHand | undefined);
    const right = mergeHand(prev.right, o.right as PartialHand | undefined);
    this.kfs.push({ t, packets: { ...prev.packets, ...(o.packets ?? {}) }, left, right });
    return this;
  }

  step(title: string, cn: string, desc: string, t0: number, t1: number, m: StepMeta = {}) {
    this.steps.push({ index: this.steps.length, title, cn, desc, t0, t1, fingers: m.fingers ?? [], packets: m.packets ?? [] });
    return this;
  }

  build(): Move {
    const duration = this.kfs[this.kfs.length - 1].t;
    return { ...this.meta, keyframes: this.kfs, steps: this.steps, duration };
  }
}
