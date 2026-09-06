import { create } from 'zustand';
import { MOVES, MOVE_MAP } from './lib/moves';
import { stepAt } from './lib/anim';
import type { FingerName } from './lib/types';

export type Mode = 'free' | 'teach' | 'steps';
export type View = 'front' | 'audience' | 'side' | 'top' | 'finger' | 'orbit';

interface LabState {
  moveId: string;
  compareId: string;
  mode: Mode;
  view: View;
  playing: boolean;
  speed: number;
  t: number;
  ghost: boolean;
  explode: boolean;
  transparent: boolean;
  wire: boolean;
  compare: boolean;
  focusFinger: FingerName | null;
  hudHidden: boolean;

  setMove: (id: string) => void;
  setCompareId: (id: string) => void;
  setMode: (m: Mode) => void;
  setView: (v: View) => void;
  setT: (t: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: number) => void;
  replay: () => void;
  nextStep: () => void;
  prevStep: () => void;
  gotoStep: (i: number) => void;
  toggleFlag: (k: 'ghost' | 'explode' | 'transparent' | 'wire' | 'compare' | 'hudHidden') => void;
  setFocusFinger: (f: FingerName | null) => void;
}

export const useLab = create<LabState>((set, get) => ({
  moveId: MOVES[0].id,
  compareId: MOVES[1].id,
  mode: 'teach',
  view: 'front',
  playing: true,
  speed: 1,
  t: 0,
  ghost: false,
  explode: false,
  transparent: false,
  wire: false,
  compare: false,
  focusFinger: null,
  hudHidden: false,

  setMove: (id) => set({ moveId: id, t: 0, playing: true, focusFinger: null }),
  setCompareId: (id) => set({ compareId: id, t: 0, playing: true }),
  setMode: (mode) => set({ mode, t: 0, playing: true }),
  setView: (view) => set({ view }),
  setT: (t) => set({ t }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  toggle: () => {
    const { playing, t, moveId, mode } = get();
    const move = MOVE_MAP[moveId];
    if (!playing && mode === 'steps') {
      const s = stepAt(move, t);
      if (t >= s.t1 - 0.01) {
        if (s.index >= move.steps.length - 1) set({ t: 0, playing: true });
        else get().nextStep();
        return;
      }
    }
    if (!playing && t >= move.duration - 1e-3) {
      set({ t: 0, playing: true });
      return;
    }
    set({ playing: !playing });
  },
  setSpeed: (speed) => set({ speed }),
  replay: () => set({ t: 0, playing: true }),
  nextStep: () => {
    const { moveId, t } = get();
    const move = MOVE_MAP[moveId];
    const s = stepAt(move, t);
    const next = move.steps[Math.min(s.index + 1, move.steps.length - 1)];
    if (next.index === s.index && t >= s.t1 - 1e-3) return;
    set({ t: next.index === s.index ? s.t0 : next.t0, playing: true });
  },
  prevStep: () => {
    const { moveId, t } = get();
    const move = MOVE_MAP[moveId];
    const s = stepAt(move, t);
    // if we are well inside a step, restart it; otherwise go to the previous one
    const target = t - s.t0 > 0.35 ? s : move.steps[Math.max(0, s.index - 1)];
    set({ t: target.t0, playing: true });
  },
  gotoStep: (i) => {
    const move = MOVE_MAP[get().moveId];
    const s = move.steps[Math.max(0, Math.min(i, move.steps.length - 1))];
    set({ t: s.t0, playing: true });
  },
  toggleFlag: (k) => set({ [k]: !get()[k] } as Partial<LabState>),
  setFocusFinger: (f) => set({ focusFinger: f, view: f ? 'finger' : get().view === 'finger' ? 'front' : get().view }),
}));
