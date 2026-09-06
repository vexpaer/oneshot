/* Procedural Web Audio sound engine — no external assets. */

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private musicTimer: number | null = null;
  private musicNodes: AudioNode[] = [];
  private intensity = 0;
  private volumes = { master: 0.8, sfx: 0.9, music: 0.5 };
  private lastPlayed: Record<string, number> = {};
  private padFilter: BiquadFilterNode | null = null;
  private drone: GainNode | null = null;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const ctx = this.ctx;
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 4;
    this.master.connect(comp);
    comp.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
  }

  setVolumes(v: { master: number; sfx: number; music: number }) {
    this.volumes = v;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfx.gain.value = this.volumes.sfx;
    this.music.gain.value = this.volumes.music * 0.6;
  }

  suspend() {
    this.ctx?.suspend();
  }
  resume() {
    this.ctx?.resume();
  }

  private throttle(key: string, ms: number) {
    const now = performance.now();
    if (now - (this.lastPlayed[key] || 0) < ms) return true;
    this.lastPlayed[key] = now;
    return false;
  }

  private noise(dur: number, gain: number, filterType: BiquadFilterType, freq: number, q = 1, freqEnd?: number, dest?: AudioNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    if (freqEnd !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || this.sfx);
    src.start();
    src.stop(ctx.currentTime + dur + 0.05);
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
    attack = 0.002,
    dest?: AudioNode,
    delay = 0,
  ) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    const t0 = ctx.currentTime + delay;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(dest || this.sfx);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // ---------------- SFX ----------------
  shoot() {
    if (!this.ctx) return;
    this.noise(0.14, 0.5, 'bandpass', 1800 + Math.random() * 400, 0.7, 300);
    this.noise(0.08, 0.35, 'highpass', 3000, 0.5);
    this.tone('sine', 220 + Math.random() * 30, 50, 0.13, 0.5);
    this.tone('square', 2600 + Math.random() * 300, 1200, 0.03, 0.12);
  }

  hit() {
    if (!this.ctx || this.throttle('hit', 30)) return;
    this.tone('sine', 1500, 900, 0.05, 0.25);
    this.tone('triangle', 3000, 2000, 0.03, 0.12);
  }

  crit() {
    if (!this.ctx) return;
    this.tone('sine', 2200, 1400, 0.08, 0.3);
    this.tone('square', 1100, 800, 0.06, 0.1);
  }

  kill(big = false) {
    if (!this.ctx) return;
    this.noise(big ? 0.7 : 0.4, big ? 0.9 : 0.6, 'lowpass', big ? 900 : 1400, 0.8, 120);
    this.tone('sine', big ? 120 : 160, 30, big ? 0.5 : 0.3, 0.7);
    this.tone('sawtooth', 900, 100, 0.15, 0.12);
    // metal debris tinkles
    for (let i = 0; i < 3; i++) {
      this.tone('sine', 2500 + Math.random() * 2500, 1800, 0.08, 0.06, 0.002, undefined, 0.05 + Math.random() * 0.2);
    }
  }

  reloadStart() {
    if (!this.ctx) return;
    this.tone('square', 900, 500, 0.04, 0.15);
    this.noise(0.06, 0.3, 'bandpass', 2500, 2);
  }
  reloadMid() {
    if (!this.ctx) return;
    this.noise(0.05, 0.3, 'bandpass', 1800, 3);
    this.tone('triangle', 400, 300, 0.05, 0.15);
  }
  reloadEnd() {
    if (!this.ctx) return;
    this.tone('square', 1400, 900, 0.03, 0.15);
    this.tone('sine', 700, 400, 0.08, 0.2, 0.002, undefined, 0.03);
    this.noise(0.08, 0.35, 'bandpass', 3200, 2);
  }
  empty() {
    if (!this.ctx || this.throttle('empty', 150)) return;
    this.tone('square', 1200, 800, 0.03, 0.12);
  }

  hurt() {
    if (!this.ctx || this.throttle('hurt', 80)) return;
    this.noise(0.25, 0.6, 'lowpass', 600, 0.8, 100);
    this.tone('sine', 110, 40, 0.25, 0.6);
    this.tone('sawtooth', 300, 80, 0.15, 0.12);
  }

  pickup(health: boolean) {
    if (!this.ctx) return;
    const base = health ? 660 : 520;
    this.tone('sine', base, base, 0.12, 0.25);
    this.tone('sine', base * 1.5, base * 1.5, 0.15, 0.25, 0.002, undefined, 0.08);
    this.tone('triangle', base * 2, base * 2, 0.2, 0.15, 0.002, undefined, 0.16);
  }

  dash() {
    if (!this.ctx) return;
    this.noise(0.3, 0.5, 'bandpass', 500, 1.2, 3000);
    this.tone('sine', 300, 900, 0.18, 0.15);
  }

  jump() {
    if (!this.ctx) return;
    this.tone('sine', 200, 500, 0.12, 0.15);
    this.noise(0.08, 0.15, 'bandpass', 1200, 1);
  }
  land() {
    if (!this.ctx || this.throttle('land', 100)) return;
    this.noise(0.1, 0.25, 'lowpass', 500, 1);
    this.tone('sine', 120, 60, 0.1, 0.25);
  }
  step() {
    if (!this.ctx || this.throttle('step', 60)) return;
    this.noise(0.05, 0.08, 'bandpass', 900 + Math.random() * 300, 1.5);
    this.tone('sine', 140, 80, 0.05, 0.06);
  }

  enemyShoot(kind: 'bot' | 'drone' | 'turret') {
    if (!this.ctx || this.throttle('eshoot' + kind, 40)) return;
    if (kind === 'turret') {
      this.tone('square', 1500, 500, 0.08, 0.1);
      this.noise(0.06, 0.15, 'highpass', 2000, 1);
    } else if (kind === 'drone') {
      this.tone('sawtooth', 1200, 400, 0.1, 0.1);
    } else {
      this.tone('sawtooth', 700, 200, 0.16, 0.14);
      this.noise(0.1, 0.12, 'bandpass', 900, 1);
    }
  }

  spiderLunge() {
    if (!this.ctx || this.throttle('lunge', 100)) return;
    this.tone('sawtooth', 300, 1200, 0.15, 0.1);
    this.noise(0.12, 0.15, 'bandpass', 2500, 2, 5000);
  }

  spawn() {
    if (!this.ctx || this.throttle('spawn', 120)) return;
    this.tone('sine', 200, 1400, 0.35, 0.08);
    this.noise(0.3, 0.12, 'bandpass', 800, 2, 4000);
  }

  waveStart() {
    if (!this.ctx) return;
    [0, 0.12, 0.24].forEach((d, i) => this.tone('triangle', 330 * (1 + i * 0.25), 330 * (1 + i * 0.25), 0.4, 0.2, 0.01, undefined, d));
    this.noise(0.6, 0.15, 'lowpass', 300, 1);
  }
  waveClear() {
    if (!this.ctx) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone('sine', f, f, 0.5, 0.2, 0.01, undefined, i * 0.1));
  }
  upgrade() {
    if (!this.ctx) return;
    [440, 554, 659, 880].forEach((f, i) => this.tone('triangle', f, f, 0.35, 0.18, 0.01, undefined, i * 0.07));
  }
  uiClick() {
    if (!this.ctx) return;
    this.tone('square', 1800, 1400, 0.03, 0.06);
  }
  uiHover() {
    if (!this.ctx || this.throttle('hover', 40)) return;
    this.tone('sine', 900, 1100, 0.04, 0.04);
  }
  death() {
    if (!this.ctx) return;
    this.noise(1.2, 0.8, 'lowpass', 800, 0.8, 60);
    this.tone('sawtooth', 200, 30, 1.0, 0.4);
    this.tone('sine', 80, 20, 1.2, 0.6);
  }

  // ---------------- MUSIC ----------------
  setIntensity(i: number) {
    this.intensity = Math.max(0, Math.min(1, i));
    if (this.padFilter && this.ctx) {
      this.padFilter.frequency.setTargetAtTime(300 + this.intensity * 1800, this.ctx.currentTime, 1.5);
    }
  }

  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    const ctx = this.ctx;
    // Ambient pad: detuned saws through slowly modulated lowpass
    const padGain = ctx.createGain();
    padGain.gain.value = 0.06;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    filter.Q.value = 2;
    this.padFilter = filter;
    filter.connect(padGain);
    padGain.connect(this.music);
    const roots = [55, 65.41, 49, 58.27]; // A1, C2, G1, Bb1
    const oscs: OscillatorNode[] = [];
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = roots[0] * (i === 0 ? 1 : i === 1 ? 2 : 3);
      o.detune.value = (i - 1) * 8;
      o.connect(filter);
      o.start();
      oscs.push(o);
      this.musicNodes.push(o);
    }
    // LFO on filter
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 180;
    lfo.connect(lfoG);
    lfoG.connect(filter.frequency);
    lfo.start();
    this.musicNodes.push(lfo);
    // room hum
    const hum = ctx.createBufferSource();
    hum.buffer = this.noiseBuf;
    hum.loop = true;
    const humF = ctx.createBiquadFilter();
    humF.type = 'lowpass';
    humF.frequency.value = 160;
    const humG = ctx.createGain();
    humG.gain.value = 0.05;
    hum.connect(humF);
    humF.connect(humG);
    humG.connect(this.music);
    hum.start();
    this.musicNodes.push(hum);
    this.drone = padGain;

    // sequencer
    let bar = 0;
    let step = 0;
    const scale = [0, 3, 5, 7, 10, 12, 15];
    const bpm = 96;
    const stepDur = 60 / bpm / 2;
    const tick = () => {
      if (!this.ctx) return;
      const rootIdx = Math.floor(bar / 2) % roots.length;
      const root = roots[rootIdx];
      if (step === 0) {
        oscs.forEach((o, i) => {
          o.frequency.setTargetAtTime(root * (i === 0 ? 1 : i === 1 ? 2 : 3), ctx.currentTime, 0.3);
        });
      }
      // pulse bass on beats when intensity is higher
      if (step % 4 === 0 && this.intensity > 0.15) {
        this.tone('triangle', root * 2, root * 2, 0.22, 0.12 + this.intensity * 0.1, 0.005, this.music);
      }
      // hi-hat ticks
      if (this.intensity > 0.3 && step % 2 === 1) {
        this.noise(0.03, 0.03 + this.intensity * 0.04, 'highpass', 7000, 1, undefined, this.music);
      }
      // arpeggio plucks
      const density = 0.15 + this.intensity * 0.5;
      if (Math.random() < density) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        const f = root * 4 * Math.pow(2, n / 12);
        this.tone('sine', f, f, 0.35, 0.07, 0.005, this.music);
        this.tone('triangle', f * 2, f * 2, 0.2, 0.02, 0.005, this.music);
      }
      step = (step + 1) % 16;
      if (step === 0) bar++;
    };
    this.musicTimer = window.setInterval(tick, stepDur * 1000);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicNodes.forEach((n) => {
      try {
        (n as OscillatorNode).stop();
      } catch {
        /* ignore */
      }
      n.disconnect();
    });
    this.musicNodes = [];
    this.padFilter = null;
    this.drone?.disconnect();
    this.drone = null;
  }
}

export const audio = new AudioEngine();
