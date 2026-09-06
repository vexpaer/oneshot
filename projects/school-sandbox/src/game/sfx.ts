// 使用 WebAudio 合成的轻量音效
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType, vol = 0.5, slide = 1, delay = 0) {
  const c = ensure();
  if (!c || !master || muted) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  const t = c.currentTime + delay;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.4, freq = 1000, q = 1, slide = 1) {
  const c = ensure();
  if (!c || !master || !noiseBuf || muted) return;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = q;
  const t = c.currentTime;
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(50, freq * slide), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

export type SfxName =
  | "swing" | "hit" | "shoot" | "throw" | "hurt" | "die" | "pickup" | "place" | "remove"
  | "wave" | "explode" | "gameover" | "jump" | "click" | "boss" | "heal" | "export";

export function sfx(name: SfxName) {
  switch (name) {
    case "swing": noise(0.18, 0.3, 600, 0.8, 3); break;
    case "hit": noise(0.08, 0.5, 1800, 1.5, 0.4); tone(180, 0.1, "square", 0.25, 0.5); break;
    case "shoot": tone(900, 0.07, "square", 0.25, 0.4); noise(0.05, 0.2, 3000, 2); break;
    case "throw": noise(0.25, 0.25, 400, 0.7, 4); break;
    case "hurt": tone(140, 0.25, "sawtooth", 0.4, 0.6); noise(0.15, 0.3, 300, 1); break;
    case "die": tone(400, 0.3, "triangle", 0.3, 0.25); noise(0.2, 0.3, 800, 1, 0.3); break;
    case "pickup": tone(660, 0.1, "sine", 0.3); tone(880, 0.12, "sine", 0.3, 1, 0.08); tone(1320, 0.18, "sine", 0.3, 1, 0.16); break;
    case "heal": tone(523, 0.12, "sine", 0.3); tone(659, 0.12, "sine", 0.3, 1, 0.1); tone(784, 0.2, "sine", 0.3, 1, 0.2); break;
    case "place": tone(520, 0.08, "triangle", 0.3, 1.3); noise(0.05, 0.15, 2000, 1); break;
    case "remove": tone(300, 0.12, "triangle", 0.3, 0.5); break;
    case "click": tone(1200, 0.04, "square", 0.12); break;
    case "wave": tone(392, 0.25, "sawtooth", 0.2); tone(494, 0.25, "sawtooth", 0.2, 1, 0.15); tone(587, 0.4, "sawtooth", 0.25, 1, 0.3); break;
    case "boss": tone(110, 0.8, "sawtooth", 0.4, 0.7); tone(82, 0.9, "square", 0.3, 0.8, 0.2); noise(0.6, 0.3, 200, 0.5); break;
    case "explode": noise(0.5, 0.7, 300, 0.5, 0.2); tone(80, 0.4, "sine", 0.6, 0.3); break;
    case "gameover": tone(330, 0.4, "sawtooth", 0.3, 0.8); tone(262, 0.5, "sawtooth", 0.3, 0.8, 0.35); tone(196, 0.9, "sawtooth", 0.3, 0.7, 0.75); break;
    case "jump": tone(300, 0.12, "sine", 0.15, 1.8); break;
    case "export": tone(700, 0.1, "sine", 0.25); tone(1050, 0.25, "sine", 0.25, 1, 0.1); break;
  }
}
