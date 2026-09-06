import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// small deterministic PRNG
export function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tex(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/** Walnut-ish wood grain. Returns color + roughness maps. */
export function makeWood(size = 1024) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  const rnd = mulberry32(1337);
  ctx.fillStyle = '#4a2f1d';
  ctx.fillRect(0, 0, size, size);

  // broad tonal bands
  for (let i = 0; i < 60; i++) {
    const y = rnd() * size;
    const h = 20 + rnd() * 120;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    const a = 0.08 + rnd() * 0.15;
    const light = rnd() > 0.5;
    g.addColorStop(0, `rgba(${light ? '120,80,45' : '30,16,8'},0)`);
    g.addColorStop(0.5, `rgba(${light ? '120,80,45' : '30,16,8'},${a})`);
    g.addColorStop(1, `rgba(${light ? '120,80,45' : '30,16,8'},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, y, size, h);
  }
  // grain lines (wavy)
  ctx.lineWidth = 1;
  for (let i = 0; i < 900; i++) {
    const y0 = rnd() * size;
    const amp = 2 + rnd() * 6;
    const freq = 0.002 + rnd() * 0.004;
    const phase = rnd() * 10;
    const dark = rnd() > 0.35;
    const alpha = dark ? 0.05 + rnd() * 0.12 : 0.04 + rnd() * 0.08;
    ctx.strokeStyle = dark ? `rgba(25,12,5,${alpha})` : `rgba(150,105,65,${alpha})`;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const y = y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 3.7 + phase * 2) * amp * 0.3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // fine noise
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n * 0.8;
    d[i + 2] += n * 0.6;
  }
  ctx.putImageData(img, 0, 0);

  const color = tex(c);
  // roughness: derived, lighter grain = smoother
  const rc = canvas(size, size);
  const rctx = rc.getContext('2d')!;
  rctx.drawImage(c, 0, 0);
  const rimg = rctx.getImageData(0, 0, size, size);
  const rd = rimg.data;
  for (let i = 0; i < rd.length; i += 4) {
    const l = (rd[i] + rd[i + 1] + rd[i + 2]) / 3;
    const v = 150 - (l - 70) * 0.9;
    rd[i] = rd[i + 1] = rd[i + 2] = Math.max(90, Math.min(200, v));
  }
  rctx.putImageData(rimg, 0, 0);
  const rough = tex(rc, false);
  return { color, rough };
}

export interface KeyDef {
  label: string;
  w: number; // in units
  x: number; // unit position
  row: number;
  accent?: number; // 0 none, 1 orange, 2 mod
}

export const KEY_ROWS: string[][] = [
  ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Del'],
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Back'],
  ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'Enter'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
  ['Ctrl', 'Win', 'Alt', '', 'Alt', 'Fn', 'Menu', 'Ctrl'],
];

const WIDE: Record<string, number> = {
  Back: 2,
  Tab: 1.5,
  '\\': 1.5,
  Caps: 1.75,
  Enter: 2.25,
  Shift: 2.25,
  Ctrl: 1.25,
  Win: 1.25,
  Alt: 1.25,
  Fn: 1.25,
  Menu: 1.25,
  '': 6.25,
};

export function buildKeyLayout(): KeyDef[] {
  const keys: KeyDef[] = [];
  KEY_ROWS.forEach((row, ri) => {
    let x = 0;
    row.forEach((label, ci) => {
      let w = WIDE[label] ?? 1;
      if (ri === 4 && ci === row.length - 1) w = 2.75; // right shift
      const accent =
        label === 'Esc' || label === 'Enter' || ['W', 'A', 'S', 'D'].includes(label)
          ? 1
          : w > 1 || ri === 0
            ? 2
            : 0;
      keys.push({ label, w, x, row: ri, accent });
      x += w;
    });
  });
  return keys;
}

export const KEY_COLORS = ['#2c2e35', '#e2652b', '#1d1f25'];
const KEY_TEXT = ['#e6e6ea', '#2a1508', '#d6d7dc'];
const KEY_GLOW = ['#ffc98a', '#000000', '#ffb870'];
/** Solid cells for key sides: indices 125,126,127 correspond to accent 0,1,2 */
export const KEY_SOLID_CELL = 125;

/** Keycap legend atlas: 16 x 8 cells. cell index = key index. Returns color + emissive atlases. */
export function makeKeyAtlas(keys: KeyDef[]) {
  const cols = 16;
  const rows = 8;
  const cell = 128;
  const c = canvas(cols * cell, rows * cell);
  const ctx = c.getContext('2d')!;
  const ec = canvas(cols * cell, rows * cell);
  const ectx = ec.getContext('2d')!;
  ctx.fillStyle = KEY_COLORS[0];
  ctx.fillRect(0, 0, c.width, c.height);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, ec.width, ec.height);

  const drawCell = (i: number, accent: number, label: string, w: number) => {
    const cx = (i % cols) * cell;
    const cy = Math.floor(i / cols) * cell;
    ctx.fillStyle = KEY_COLORS[accent];
    ctx.fillRect(cx, cy, cell, cell);
    // subtle top-surface shading (lighter center)
    const g = ctx.createRadialGradient(cx + cell / 2, cy + cell / 2, cell * 0.1, cx + cell / 2, cy + cell / 2, cell * 0.8);
    g.addColorStop(0, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fillRect(cx, cy, cell, cell);
    if (!label) return;
    const big = label.length === 1;
    const font = `${big ? 'bold 62px' : '600 32px'} Inter, "Segoe UI", Arial, sans-serif`;
    for (const [context, color] of [
      [ctx, KEY_TEXT[accent]],
      [ectx, KEY_GLOW[accent]],
    ] as const) {
      context.save();
      context.translate(cx + cell / 2, cy + cell / 2);
      context.scale(1 / w, 1);
      context.fillStyle = color;
      context.font = font;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(label, 0, big ? 3 : 0);
      context.restore();
    }
  };
  keys.forEach((k, i) => drawCell(i, k.accent ?? 0, k.label, k.w));
  for (let a = 0; a < 3; a++) {
    const i = KEY_SOLID_CELL + a;
    const cx = (i % cols) * cell;
    const cy = Math.floor(i / cols) * cell;
    ctx.fillStyle = KEY_COLORS[a];
    ctx.fillRect(cx, cy, cell, cell);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const e = tex(ec);
  e.wrapS = e.wrapT = THREE.ClampToEdgeWrapping;
  return { texture: t, emissive: e, cols, rows };
}

export function makePaper(size = 512, ruled = true) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f2eee4';
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(7);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  if (ruled) {
    ctx.strokeStyle = 'rgba(90,140,200,0.45)';
    ctx.lineWidth = 2;
    for (let y = 40; y < size; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(220,90,90,0.5)';
    ctx.beginPath();
    ctx.moveTo(70, 0);
    ctx.lineTo(70, size);
    ctx.stroke();
    // scribbles
    ctx.strokeStyle = 'rgba(40,40,60,0.7)';
    ctx.lineWidth = 3;
    for (let y = 40; y < size - 100; y += 32) {
      const len = 100 + rnd() * 300;
      ctx.beginPath();
      let x = 90;
      ctx.moveTo(x, y + 20);
      while (x < 90 + len) {
        x += 6 + rnd() * 8;
        ctx.lineTo(x, y + 8 + rnd() * 18);
      }
      ctx.stroke();
    }
  }
  return tex(c);
}

export function makeStickyNote(color: string, text: string) {
  const c = canvas(256, 256);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(0,0,0,0.12)');
  g.addColorStop(0.15, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.05)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(30,30,50,0.85)';
  ctx.font = 'italic 600 30px "Segoe Print", "Comic Sans MS", cursive, sans-serif';
  ctx.textAlign = 'center';
  const lines = text.split('\n');
  lines.forEach((l, i) => ctx.fillText(l, 128, 100 + i * 40));
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function makePhoneScreen() {
  const c = canvas(256, 512);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 256, 512);
  g.addColorStop(0, '#1b1f4a');
  g.addColorStop(1, '#3a1650');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 512);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 20px Inter, Arial';
  ctx.fillText('12:42', 20, 40);
  ctx.font = 'bold 80px Inter, Arial';
  ctx.textAlign = 'center';
  ctx.fillText('12:42', 128, 160);
  ctx.font = '400 20px Inter, Arial';
  ctx.fillText('Tue, Nov 4', 128, 195);
  // notification card
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.roundRect(20, 240, 216, 80, 16);
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = '600 16px Inter, Arial';
  ctx.fillText('SECURITY', 40, 268);
  ctx.font = '400 14px Inter, Arial';
  ctx.fillText('Unknown devices detected', 40, 292);
  ctx.fillText('on desk network...', 40, 308);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function makeCalcScreen(text = 'ERR 0xDEAD') {
  const c = canvas(256, 96);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#9fb58a';
  ctx.fillRect(0, 0, 256, 96);
  ctx.fillStyle = '#1a2414';
  ctx.font = 'bold 44px "Courier New", monospace';
  ctx.textAlign = 'right';
  ctx.fillText(text, 240, 64);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function makeMousepad(size = 512) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#15171c';
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(99);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 12;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c);
}

export function makeSoftParticle() {
  const c = canvas(64, 64);
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function makeFlash() {
  const c = canvas(128, 128);
  const ctx = c.getContext('2d')!;
  ctx.translate(64, 64);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,220,150,0.9)');
  g.addColorStop(0.5, 'rgba(255,140,40,0.35)');
  g.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(-64, -64, 128, 128);
  // spikes
  ctx.strokeStyle = 'rgba(255,240,200,0.8)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(60, 0);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(c);
}
