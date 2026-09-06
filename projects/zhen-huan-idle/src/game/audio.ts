// 轻量合成音效：无需任何外部资源
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slide = 0) {
  const c = ac();
  if (!c || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t = c.currentTime + when;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// 五声音阶（宫商角徵羽）
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

export const sfx = {
  click(combo = 0) {
    const n = PENTA[Math.min(PENTA.length - 1, Math.floor(combo / 4) % PENTA.length)];
    tone(n, 0.08, 'triangle', 0.06);
  },
  buy() {
    tone(659, 0.09, 'sine', 0.08);
    tone(988, 0.14, 'sine', 0.06, 0.07);
  },
  deny() {
    tone(180, 0.15, 'square', 0.03, 0, -60);
  },
  combo() {
    PENTA.forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, i * 0.05));
  },
  chime() {
    // 编钟
    tone(1046, 1.2, 'sine', 0.1);
    tone(1568, 0.9, 'sine', 0.05, 0.02);
    tone(523, 1.6, 'triangle', 0.05, 0.05);
  },
  ceremony() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.9, 'triangle', 0.09, i * 0.18));
    tone(261, 2.2, 'sine', 0.08, 0.7);
  },
  drum() {
    tone(90, 0.35, 'sine', 0.25, 0, -50);
    tone(60, 0.5, 'triangle', 0.12, 0.02, -30);
  },
  bad() {
    tone(220, 0.4, 'sawtooth', 0.04, 0, -90);
    tone(110, 0.6, 'sine', 0.08, 0.05, -40);
  },
  event() {
    tone(440, 0.3, 'sine', 0.06);
    tone(554, 0.4, 'sine', 0.05, 0.15);
  },
  scheme() {
    tone(330, 0.12, 'triangle', 0.07, 0, -80);
    tone(247, 0.2, 'triangle', 0.05, 0.08, -60);
  },
};
