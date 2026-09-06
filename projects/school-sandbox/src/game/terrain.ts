import * as THREE from "three";
import { BUILDINGS, MAP_D, MAP_W, POND, ROADS, TRACK, ZONES, FENCE } from "./layout";

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sm = (a: number, b: number, t: number) => {
  const u = clamp((t - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

/** 原始山体高度（未平整） */
export function baseHeight(x: number, z: number): number {
  let h = 0;
  h += 14 * sm(80, -180, x); // 向西升高
  h += 6 * sm(60, -157, z); // 向北升高
  const dx = x + 135, dz = z + 100;
  h += 32 * Math.exp(-(dx * dx + dz * dz) / (2 * 68 * 68)); // 西北大山
  const kx = x + 5, kz = z + 80;
  h += 9 * Math.exp(-(kx * kx + kz * kz) / (2 * 15 * 15)); // 球场边巨石山包
  const mx = x + 190, mz = z - 60;
  h += 10 * Math.exp(-(mx * mx + mz * mz) / (2 * 40 * 40)); // 西南山脊
  h += 0.7 * Math.sin(x * 0.07) * Math.cos(z * 0.05) + 0.4 * Math.sin(x * 0.15 + z * 0.11);
  h *= 1 - sm(120, 160, x); // 主干道以东为平原
  return h;
}

interface Pad {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  h: number;
  m: number;
}
const pads: Pad[] = [];

function addPad(x0: number, z0: number, x1: number, z1: number, m = 9, lower = 0) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  pads.push({ x0, x1, z0, z1, h: baseHeight(cx, cz) - lower, m });
}

for (const z of ZONES) addPad(z.x0, z.z0, z.x1, z.z1, 10, z.lower ?? 0);
for (const b of BUILDINGS) {
  if (b.noPad) continue;
  if (b.kind === "box") {
    const c = Math.abs(Math.cos(b.rot ?? 0)), s = Math.abs(Math.sin(b.rot ?? 0));
    const hw = (b.w! / 2) * c + (b.d! / 2) * s + 1.5;
    const hd = (b.w! / 2) * s + (b.d! / 2) * c + 1.5;
    addPad(b.x - hw, b.z - hd, b.x + hw, b.z + hd, b.context ? 5 : 8);
  } else {
    const r = (b.r ?? 5) + 1.5;
    addPad(b.x - r, b.z - r, b.x + r, b.z + r, 8);
  }
}

/** 最终地形高度（含台地平整） */
export function terrainHeight(x: number, z: number): number {
  const base = baseHeight(x, z);
  let wsum = 0, hsum = 0, wmax = 0;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    const dx = Math.max(p.x0 - x, 0, x - p.x1);
    const dz = Math.max(p.z0 - z, 0, z - p.z1);
    if (dx > p.m || dz > p.m) continue;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= p.m) continue;
    const w = 1 - sm(0, p.m, d);
    const w4 = w * w * w * w;
    wsum += w4;
    hsum += w4 * p.h;
    if (w > wmax) wmax = w;
  }
  if (wsum === 0) return base;
  return base * (1 - wmax) + (hsum / wsum) * wmax;
}

export function padHeightAt(x: number, z: number) {
  return terrainHeight(x, z);
}

// ================= 距离辅助 =================
export function distToPolyline(x: number, z: number, pts: [number, number][]) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const vx = bx - ax, vz = bz - az;
    const l2 = vx * vx + vz * vz || 1;
    const t = clamp(((x - ax) * vx + (z - az) * vz) / l2, 0, 1);
    const px = ax + vx * t, pz = az + vz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

export function onRoad(x: number, z: number, extra = 1) {
  for (const r of ROADS) if (distToPolyline(x, z, r.pts) < r.w / 2 + extra) return true;
  return false;
}

export function inZone(x: number, z: number, extra = 1) {
  for (const zn of ZONES) if (x > zn.x0 - extra && x < zn.x1 + extra && z > zn.z0 - extra && z < zn.z1 + extra) return true;
  return false;
}

export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ================= 地面纹理绘制 =================
function stadiumPath(g: CanvasRenderingContext2D, cx: number, cz: number, r: number, hs: number) {
  g.beginPath();
  g.moveTo(cx - r, cz - hs);
  g.arc(cx, cz - hs, r, Math.PI, Math.PI * 2);
  g.lineTo(cx + r, cz + hs);
  g.arc(cx, cz + hs, r, 0, Math.PI);
  g.closePath();
}

function drawTrack(g: CanvasRenderingContext2D, cx: number, cz: number, r: number, hs: number, lanes: number, laneW: number) {
  const inner = r - lanes * laneW;
  // 内场
  stadiumPath(g, cx, cz, inner, hs);
  g.fillStyle = "#7f9a52";
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = "rgba(160,140,90,0.55)";
  g.fillRect(cx - inner * 0.55, cz - hs - inner * 0.6, inner * 1.1, hs * 2 + inner * 1.2);
  g.fillStyle = "rgba(120,150,80,0.5)";
  g.fillRect(cx - inner * 0.3, cz - hs - inner * 0.3, inner * 0.6, hs * 2 + inner * 0.6);
  g.restore();
  // 跑道环
  stadiumPath(g, cx, cz, (r + inner) / 2, hs);
  g.lineWidth = r - inner;
  g.strokeStyle = "#b8493a";
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.85)";
  g.lineWidth = 0.14;
  for (let k = 0; k <= lanes; k++) {
    stadiumPath(g, cx, cz, inner + k * laneW, hs);
    g.stroke();
  }
  // 足球门区
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 0.15;
  g.strokeRect(cx - inner * 0.8, cz - hs - inner * 0.55, inner * 1.6, hs * 2 + inner * 1.1);
  g.beginPath();
  g.arc(cx, cz, 5, 0, Math.PI * 2);
  g.stroke();
}

function drawRoad(g: CanvasRenderingContext2D, pts: [number, number][], w: number, kind: string) {
  const path = () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  };
  g.lineJoin = "round";
  g.lineCap = "round";
  g.setLineDash([]);
  if (kind === "dirt") {
    path();
    g.lineWidth = w;
    g.strokeStyle = "#9a8a62";
    g.stroke();
    return;
  }
  if (kind === "path") {
    path();
    g.lineWidth = w;
    g.strokeStyle = "#bdb9ad";
    g.stroke();
    return;
  }
  // 人行道
  path();
  g.lineWidth = w + 3.5;
  g.strokeStyle = kind === "highway" ? "#a8a59c" : "#b9b5a9";
  g.stroke();
  path();
  g.lineWidth = w;
  g.strokeStyle = kind === "highway" ? "#4c4e52" : "#5a5c60";
  g.stroke();
  // 车道线
  path();
  g.lineWidth = kind === "highway" ? 0.35 : 0.22;
  g.strokeStyle = kind === "highway" ? "#e2c24a" : "#e9e9e9";
  g.setLineDash(kind === "highway" ? [] : [2.5, 2.5]);
  g.stroke();
  if (kind === "highway") {
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.lineWidth = 0.25;
    g.setLineDash([3, 4]);
    for (const off of [-w * 0.33, w * 0.33, -w * 0.14, w * 0.14]) {
      g.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i];
        const n = i < pts.length - 1 ? pts[i + 1] : pts[i - 1];
        const dir = i < pts.length - 1 ? 1 : -1;
        const dx = (n[0] - x) * dir, dz = (n[1] - z) * dir;
        const l = Math.hypot(dx, dz) || 1;
        const ox = (-dz / l) * off, oz = (dx / l) * off;
        if (i === 0) g.moveTo(x + ox, z + oz);
        else g.lineTo(x + ox, z + oz);
      }
      g.stroke();
    }
  }
  g.setLineDash([]);
}

function courtLines(g: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number, type: "basket" | "tennis") {
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 0.12;
  g.strokeRect(x0, z0, x1 - x0, z1 - z0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  if (type === "basket") {
    g.beginPath();
    g.moveTo(x0, cz);
    g.lineTo(x1, cz);
    g.stroke();
    g.beginPath();
    g.arc(cx, cz, 1.8, 0, Math.PI * 2);
    g.stroke();
    const kw = (x1 - x0) * 0.35;
    g.strokeRect(cx - kw / 2, z0, kw, 4.5);
    g.strokeRect(cx - kw / 2, z1 - 4.5, kw, 4.5);
    g.beginPath();
    g.arc(cx, z0 + 1.2, 5.5, 0.2, Math.PI - 0.2);
    g.stroke();
    g.beginPath();
    g.arc(cx, z1 - 1.2, 5.5, Math.PI + 0.2, Math.PI * 2 - 0.2);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(x0, cz);
    g.lineTo(x1, cz);
    g.moveTo(x0 + 1, z0);
    g.lineTo(x0 + 1, z1);
    g.moveTo(x1 - 1, z0);
    g.lineTo(x1 - 1, z1);
    g.moveTo(x0 + 1, cz - 3.5);
    g.lineTo(x1 - 1, cz - 3.5);
    g.moveTo(x0 + 1, cz + 3.5);
    g.lineTo(x1 - 1, cz + 3.5);
    g.moveTo(cx, cz - 3.5);
    g.lineTo(cx, cz + 3.5);
    g.stroke();
  }
}

export function buildGroundCanvas(): HTMLCanvasElement {
  const W = 2048, H = Math.round((2048 * MAP_D) / MAP_W);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const s = W / MAP_W;
  g.setTransform(s, 0, 0, s, W / 2, H / 2);
  const rnd = mulberry32(42);

  // 底色
  g.fillStyle = "#77844f";
  g.fillRect(-MAP_W / 2, -MAP_D / 2, MAP_W, MAP_D);
  // 城区铺装
  g.fillStyle = "#a9a59b";
  g.fillRect(150, -MAP_D / 2, 100, MAP_D);
  g.fillRect(-45, -MAP_D / 2, 200, 45);
  g.fillRect(-60, 108, 130, 60);
  g.fillStyle = "#b3a58b";
  g.fillRect(-150, 100, 100, 60);
  // 山地噪声
  for (let i = 0; i < 6000; i++) {
    const x = (rnd() - 0.5) * MAP_W, z = (rnd() - 0.5) * MAP_D;
    const h = baseHeight(x, z);
    const r = 1.5 + rnd() * 6;
    let col: string;
    if (h > 30) col = rnd() > 0.5 ? "#8c8a80" : "#77786f";
    else if (h > 16) col = rnd() > 0.5 ? "#8b7a52" : "#6f7a45";
    else col = rnd() > 0.5 ? "#6d7f45" : "#849356";
    g.globalAlpha = 0.28 + rnd() * 0.3;
    g.fillStyle = col;
    g.beginPath();
    g.arc(x, z, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // 校园内草坪（略亮）
  g.beginPath();
  g.moveTo(FENCE[0][0], FENCE[0][1]);
  for (let i = 1; i < FENCE.length; i++) g.lineTo(FENCE[i][0], FENCE[i][1]);
  g.closePath();
  g.fillStyle = "rgba(112,140,80,0.55)";
  g.fill();

  // 校内铺装区域
  g.fillStyle = "#c6c3b9";
  const plaza = ZONES.find((z) => z.id === "plaza")!;
  g.fillRect(plaza.x0, plaza.z0, plaza.x1 - plaza.x0, plaza.z1 - plaza.z0);
  g.fillRect(-64, -12, 110, 20); // 主楼前
  g.fillRect(-66, 10, 30, 50); // 艺术楼旁
  g.fillRect(-70, 50, 30, 45); // 科技楼周边
  g.fillRect(-120, 25, 40, 60); // 宿舍区
  g.fillRect(-150, 40, 40, 50);
  // 广场网格 + 台阶
  g.strokeStyle = "rgba(0,0,0,0.08)";
  g.lineWidth = 0.1;
  for (let x = plaza.x0; x <= plaza.x1; x += 4) {
    g.beginPath();
    g.moveTo(x, plaza.z0);
    g.lineTo(x, plaza.z1);
    g.stroke();
  }
  for (let z = plaza.z0; z <= plaza.z1; z += 4) {
    g.beginPath();
    g.moveTo(plaza.x0, z);
    g.lineTo(plaza.x1, z);
    g.stroke();
  }
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let z = 14; z < 44; z += 2) g.fillRect(12, z, 24, 0.5);
  // 广场绿地
  g.fillStyle = "#6f9a4e";
  g.fillRect(-4, 40, 9, 11);
  g.fillRect(6, 8, 6, 10);
  g.fillRect(30, 44, 6, 8);
  g.beginPath();
  g.ellipse(6, 18, 3, 7, 0, 0, Math.PI * 2);
  g.fill();
  // 大门圆形广场 + 喷泉
  g.fillStyle = "#c0bdb3";
  g.beginPath();
  g.arc(73, 23, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5f8fb3";
  g.beginPath();
  g.arc(73, 23, 3.5, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.lineWidth = 0.15;
  for (let k = 4.5; k < 9; k += 1.5) {
    g.beginPath();
    g.arc(73, 23, k, 0, Math.PI * 2);
    g.stroke();
  }
  // 停车场
  const pk = ZONES.find((z) => z.id === "parking")!;
  g.fillStyle = "#8d8f92";
  g.fillRect(pk.x0, pk.z0, pk.x1 - pk.x0, pk.z1 - pk.z0);
  g.strokeStyle = "rgba(255,255,255,0.8)";
  g.lineWidth = 0.12;
  for (let x = pk.x0 + 1; x < pk.x1; x += 2.6) {
    g.beginPath();
    g.moveTo(x, pk.z0 + 1);
    g.lineTo(x, pk.z0 + 5.5);
    g.moveTo(x, pk.z1 - 1);
    g.lineTo(x, pk.z1 - 5.5);
    g.stroke();
  }

  // 道路
  for (const r of ROADS) drawRoad(g, r.pts, r.w, r.kind);
  // 斑马线
  g.fillStyle = "rgba(255,255,255,0.85)";
  for (let k = 0; k < 6; k++) g.fillRect(-1 + k * 0.9, -12.5, 0.45, 7);
  for (let k = 0; k < 8; k++) g.fillRect(64 + k * 0.9, 5, 0.45, 8);

  // 足球场
  const fb = ZONES.find((z) => z.id === "football")!;
  g.fillStyle = "#4f9a3f";
  g.fillRect(fb.x0, fb.z0, fb.x1 - fb.x0, fb.z1 - fb.z0);
  g.fillStyle = "rgba(255,255,255,0.08)";
  for (let x = fb.x0; x < fb.x1; x += 4) g.fillRect(x, fb.z0, 2, fb.z1 - fb.z0);
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 0.15;
  g.strokeRect(fb.x0 + 1, fb.z0 + 1, fb.x1 - fb.x0 - 2, fb.z1 - fb.z0 - 2);
  g.beginPath();
  g.arc((fb.x0 + fb.x1) / 2, (fb.z0 + fb.z1) / 2, 4, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo((fb.x0 + fb.x1) / 2, fb.z0 + 1);
  g.lineTo((fb.x0 + fb.x1) / 2, fb.z1 - 1);
  g.stroke();
  g.strokeRect(fb.x0 + 1, (fb.z0 + fb.z1) / 2 - 5, 4, 10);
  g.strokeRect(fb.x1 - 5, (fb.z0 + fb.z1) / 2 - 5, 4, 10);

  // 篮球场区
  const bk = ZONES.find((z) => z.id === "basketball")!;
  g.fillStyle = "#3d9c6c";
  g.fillRect(bk.x0, bk.z0, bk.x1 - bk.x0, bk.z1 - bk.z0);
  const cols = [-79.5, -64.5, -49.5];
  const rows: [number, number][] = [[-86, -73], [-71, -58], [-56, -43]];
  for (const cx of cols)
    for (const [z0, z1] of rows) {
      g.fillStyle = "#d3603a";
      g.fillRect(cx, z0, 13, z1 - z0);
      courtLines(g, cx, z0, cx + 13, z1, "basket");
    }
  // 网球场
  const tn = ZONES.find((z) => z.id === "tennis")!;
  g.fillStyle = "#3d9c6c";
  g.fillRect(tn.x0, tn.z0, tn.x1 - tn.x0, tn.z1 - tn.z0);
  for (const cx of [-31.5, -20.5])
    for (const [z0, z1] of [[-87, -75], [-74, -62], [-61, -50]]) {
      g.fillStyle = "#d3603a";
      g.fillRect(cx, z0, 10, z1 - z0);
      courtLines(g, cx + 1, z0 + 1, cx + 9, z1 - 1, "tennis");
    }
  const c2 = ZONES.find((z) => z.id === "courts2")!;
  g.fillStyle = "#3d9c6c";
  g.fillRect(c2.x0, c2.z0, c2.x1 - c2.x0, c2.z1 - c2.z0);
  g.fillStyle = "#d3603a";
  g.fillRect(-31, -45, 12, 22);
  courtLines(g, -30, -44, -20, -24, "tennis");
  courtLines(g, -17, -45, -8, -23, "basket");

  // 跑道
  drawTrack(g, TRACK.cx, TRACK.cz, TRACK.r, TRACK.hs, TRACK.lanes, TRACK.laneW);
  // 校外东南操场
  g.save();
  g.translate(190, 100);
  g.rotate(-0.12);
  drawTrack(g, 0, 0, 34, 20, 8, 1.22);
  g.restore();
  // 跑道东侧看台绿地
  g.fillStyle = "#5e9a55";
  g.fillRect(52, -98, 6, 96);

  // 水塘
  g.beginPath();
  g.moveTo(POND[0][0], POND[0][1]);
  for (let i = 1; i < POND.length; i++) g.lineTo(POND[i][0], POND[i][1]);
  g.closePath();
  g.fillStyle = "#3d5866";
  g.fill();
  // 水塘周边步道
  g.strokeStyle = "#c6c3b9";
  g.lineWidth = 2;
  g.stroke();

  // 围墙线
  g.beginPath();
  g.moveTo(FENCE[0][0], FENCE[0][1]);
  for (let i = 1; i < FENCE.length; i++) g.lineTo(FENCE[i][0], FENCE[i][1]);
  g.closePath();
  g.strokeStyle = "rgba(90,90,85,0.6)";
  g.lineWidth = 0.6;
  g.stroke();

  // 细微颗粒
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rnd() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.06)";
    g.fillRect((rnd() - 0.5) * MAP_W, (rnd() - 0.5) * MAP_D, 0.6, 0.6);
  }
  return c;
}

export function buildTerrainMesh(canvas: HTMLCanvasElement) {
  const segX = 235, segZ = 157;
  const geo = new THREE.PlaneGeometry(MAP_W, MAP_D, segX, segZ);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrainHeight(x, z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = "Terrain";
  return mesh;
}

export function buildWater() {
  const shape = new THREE.Shape();
  POND.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: "#2f6f8f",
    roughness: 0.15,
    metalness: 0.4,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const pond = ZONES.find((z) => z.id === "pond")!;
  mesh.position.y = terrainHeight((pond.x0 + pond.x1) / 2, (pond.z0 + pond.z1) / 2) + 1.0;
  mesh.name = "Water";
  return mesh;
}
