import * as THREE from "three";
import { createNoise2D } from "simplex-noise";

/* ---------- deterministic randomness ---------- */
export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise2 = createNoise2D(mulberry32(20240607));

export function fbm(x: number, z: number, oct = 4) {
  let a = 1,
    f = 1,
    s = 0,
    n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise2(x * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

export function smooth01(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
const gauss = (d: number, s: number) => Math.exp(-(d * d) / (s * s));
const dist = (x: number, z: number, px: number, pz: number) => Math.hypot(x - px, z - pz);

/* ---------- terrain ---------- */
export const WATER_LEVEL = -1.4;
export const LAKE_CENTER = { x: 0, z: 10 };

// spots that get flattened so landmarks sit nicely: [x, z, height, radius]
export const FLAT_SPOTS: [number, number, number, number][] = [
  [-16, -6, 1.5, 10], // elder tree (about)
  [18, 14, 0.9, 9], // stone circle (projects)
  [14, -18, 2.2, 8], // treehouse (notes)
  [-25, 21, 5.0, 9], // cave (experiments)
  [30, -8, 15.0, 7], // lookout (contact)
  [-5, -3, 0.6, 5], // wild flower (micro)
];

export function terrainHeight(x: number, z: number) {
  const dx = x - LAKE_CENTER.x,
    dz = z - LAKE_CENTER.z;
  const r = Math.sqrt(dx * dx + dz * dz);
  let h = Math.pow(Math.max(0, r - 18) / 45, 1.7) * 26;
  const nAmp = 0.45 + 0.55 * smooth01(6, 22, r);
  h += (fbm(x * 0.025, z * 0.025, 4) * 4.5 + fbm(x * 0.08 + 7, z * 0.08, 3) * 1.1) * nAmp;
  h -= smooth01(18, 5, r) * 4.2;
  h += 9 * gauss(dist(x, z, 30, -8), 12);
  h += 6 * gauss(dist(x, z, -28, 25), 10);
  for (const [fx, fz, fh, fr] of FLAT_SPOTS) {
    const d = dist(x, z, fx, fz);
    if (d < fr) {
      const w = smooth01(fr, fr * 0.35, d);
      h = h + (fh - h) * w;
    }
  }
  return h;
}

/* ---------- shared runtime + shader uniforms ---------- */
export const world = {
  time: 0.335, // 0 = midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset
  dayLength: 320, // seconds per full cycle
  dayFactor: 1,
  sunElev: 1,
  seasonMix: new THREE.Vector4(0, 1, 0, 0),
  pointer: new THREE.Vector3(9999, 0, 9999),
  pointerNdc: new THREE.Vector2(0, 0),
  pointerDown: { x: 0, y: 0, t: 0 },
  walkRequest: null as THREE.Vector3 | null,
  camPos: new THREE.Vector3(),
  lakeDist: 30,
  windGust: 0.5,
};

export const U = {
  uTime: { value: 0 },
  uSeason: { value: world.seasonMix },
  uDay: { value: 1 },
  uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  uSkyZenith: { value: new THREE.Color(0.3, 0.5, 0.8) },
  uSkyHorizon: { value: new THREE.Color(0.7, 0.8, 0.9) },
  uPointer: { value: world.pointer },
  uWind: { value: 0.5 },
  uRipple: { value: new THREE.Vector4(0, 0, -100, 0) },
  uCamPos: { value: world.camPos },
};

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

/* ---------- small shader helpers ---------- */
export const GLSL_NOISE = /* glsl */ `
float hash21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y); }
`;

/* ---------- canvas textures ---------- */
export function makeSoftCircle(size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.6)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function makeLeaf(size = 64) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.translate(size / 2, size / 2);
  ctx.fillStyle = "rgba(255,255,255,1)";
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.42);
  ctx.bezierCurveTo(size * 0.32, -size * 0.2, size * 0.28, size * 0.25, 0, size * 0.42);
  ctx.bezierCurveTo(-size * 0.28, size * 0.25, -size * 0.32, -size * 0.2, 0, -size * 0.42);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,120,120,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.38);
  ctx.lineTo(0, size * 0.38);
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

export function makeMist(size = 256) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size / 2;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 4, 0, size / 2, size / 4, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size / 2);
  return new THREE.CanvasTexture(c);
}
