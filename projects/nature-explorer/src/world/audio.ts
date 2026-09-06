/* Procedural ambience: wind (filtered noise), water (bandpassed noise), birds (chirp sweeps), crickets (night). */
interface Params {
  day: number;
  season: number[];
  lakeDist: number;
  wind: number;
  muted: boolean;
  micro: boolean;
}

class Ambience {
  ctx: AudioContext | null = null;
  master!: GainNode;
  windGain!: GainNode;
  windFilter!: BiquadFilterNode;
  waterGain!: GainNode;
  birdGain!: GainNode;
  cricketGain!: GainNode;
  nextBird = 0;
  started = false;

  start() {
    if (this.started) return;
    this.started = true;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // noise buffer
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      data[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    }
    const mk = () => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };

    // wind
    const wind = mk();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = "lowpass";
    this.windFilter.frequency.value = 400;
    this.windFilter.Q.value = 0.8;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.3;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 220;
    lfo.connect(lfoG).connect(this.windFilter.frequency);
    lfo.start();

    // water
    const water = mk();
    const wf = ctx.createBiquadFilter();
    wf.type = "bandpass";
    wf.frequency.value = 1800;
    wf.Q.value = 0.6;
    const wf2 = ctx.createBiquadFilter();
    wf2.type = "highpass";
    wf2.frequency.value = 700;
    this.waterGain = ctx.createGain();
    this.waterGain.gain.value = 0;
    water.connect(wf).connect(wf2).connect(this.waterGain).connect(this.master);
    const wlfo = ctx.createOscillator();
    wlfo.frequency.value = 0.31;
    const wlfoG = ctx.createGain();
    wlfoG.gain.value = 500;
    wlfo.connect(wlfoG).connect(wf.frequency);
    wlfo.start();

    // birds bus
    this.birdGain = ctx.createGain();
    this.birdGain.gain.value = 0.5;
    this.birdGain.connect(this.master);

    // crickets
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    this.cricketGain.connect(this.master);
    const cr = ctx.createOscillator();
    cr.type = "triangle";
    cr.frequency.value = 4300;
    const crAm = ctx.createGain();
    crAm.gain.value = 0;
    const amOsc = ctx.createOscillator();
    amOsc.type = "square";
    amOsc.frequency.value = 26;
    const amG = ctx.createGain();
    amG.gain.value = 0.5;
    amOsc.connect(amG).connect(crAm.gain);
    const crF = ctx.createBiquadFilter();
    crF.type = "bandpass";
    crF.frequency.value = 4300;
    crF.Q.value = 6;
    cr.connect(crAm).connect(crF).connect(this.cricketGain);
    cr.start();
    amOsc.start();
  }

  chirp(t0: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    const base = 2200 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 4);
    let t = t0;
    for (let i = 0; i < notes; i++) {
      const dur = 0.07 + Math.random() * 0.08;
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), t);
      o.frequency.exponentialRampToValueAtTime(base * (1.1 + Math.random() * 0.5), t + dur * 0.5);
      o.frequency.exponentialRampToValueAtTime(base * (0.8 + Math.random() * 0.2), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12 + Math.random() * 0.08, t + dur * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      t += dur + 0.04 + Math.random() * 0.1;
    }
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = Math.random() * 2 - 1;
      o.connect(g).connect(pan).connect(this.birdGain);
    } else o.connect(g).connect(this.birdGain);
    o.start(t0);
    o.stop(t + 0.1);
  }

  update(p: Params) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (ctx.state === "suspended" && !p.muted) ctx.resume();
    const now = ctx.currentTime;
    const tc = 0.4;
    this.master.gain.setTargetAtTime(p.muted ? 0 : 0.9, now, tc);
    const [sp, su, au, wi] = p.season;
    this.windGain.gain.setTargetAtTime(0.12 + p.wind * 0.35 + wi * 0.15 + au * 0.1, now, tc);
    this.windFilter.Q.value = 0.8 + wi * 0.5;
    const near = Math.max(0, 1 - Math.max(0, p.lakeDist - 8) / 30);
    this.waterGain.gain.setTargetAtTime((p.micro ? 0 : near * near * 0.35) * (1 - wi * 0.85), now, tc);
    this.cricketGain.gain.setTargetAtTime((1 - p.day) * (su * 0.05 + sp * 0.015 + au * 0.03) * (p.micro ? 0.3 : 1), now, tc);
    const birdRate = p.day * (sp * 1.0 + su * 0.7 + au * 0.35 + wi * 0.08);
    if (now > this.nextBird) {
      if (Math.random() < birdRate * 0.9) this.chirp(now + Math.random() * 0.3);
      this.nextBird = now + 0.8 + Math.random() * 3.5;
    }
  }
}

export const audio = new Ambience();
