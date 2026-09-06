import * as THREE from 'three';
import { CARD_H, CARD_T, CARD_W } from '../lib/anim';

let _geo: THREE.BufferGeometry | null = null;

/** Rounded-corner card geometry. groups: 0 = face (-Y), 1 = back (+Y), 2 = edges */
export function cardGeometry() {
  if (_geo) return _geo;
  const r = 0.14;
  const w = CARD_W / 2, h = CARD_H / 2;
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h);
  s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);
  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r);
  s.quadraticCurveTo(-w, -h, -w + r, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: CARD_T, bevelEnabled: false, curveSegments: 3 });
  const sides = g.groups[g.groups.length - 1];
  const lidCount = sides.start;
  g.clearGroups();
  g.addGroup(0, lidCount / 2, 0);
  g.addGroup(lidCount / 2, lidCount / 2, 1);
  g.addGroup(sides.start, sides.count, 2);
  g.rotateX(-Math.PI / 2);
  g.translate(0, -CARD_T / 2, 0);
  g.computeVertexNormals();
  _geo = g;
  return g;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function spade(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s);
  ctx.bezierCurveTo(cx + s * 0.05, cy - s * 0.6, cx + s, cy - s * 0.1, cx + s, cy + s * 0.25);
  ctx.bezierCurveTo(cx + s, cy + s * 0.75, cx + s * 0.25, cy + s * 0.8, cx + s * 0.12, cy + s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.15, cy + s * 0.8, cx + s * 0.35, cy + s * 1.0, cx + s * 0.45, cy + s * 1.1);
  ctx.lineTo(cx - s * 0.45, cy + s * 1.1);
  ctx.bezierCurveTo(cx - s * 0.35, cy + s * 1.0, cx - s * 0.15, cy + s * 0.8, cx - s * 0.12, cy + s * 0.45);
  ctx.bezierCurveTo(cx - s * 0.25, cy + s * 0.8, cx - s, cy + s * 0.75, cx - s, cy + s * 0.25);
  ctx.bezierCurveTo(cx - s, cy - s * 0.1, cx - s * 0.05, cy - s * 0.6, cx, cy - s);
  ctx.closePath();
  ctx.fill();
}

function makeTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, flipX = false) {
  const w = 512, h = 716;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  // ExtrudeGeometry lid UVs are in shape units -> map to [0,1]
  tex.repeat.set((flipX ? -1 : 1) / CARD_W, 1 / CARD_H);
  tex.offset.set(0.5, 0.5);
  return tex;
}

let _tex: { back: THREE.Texture; face: THREE.Texture } | null = null;
export function cardTextures() {
  if (_tex) return _tex;
  const back = makeTexture((ctx, w, h) => {
    ctx.fillStyle = '#f3efe6';
    ctx.fillRect(0, 0, w, h);
    const m = 26;
    ctx.fillStyle = '#12213a';
    roundRect(ctx, m, m, w - 2 * m, h - 2 * m, 18);
    ctx.fill();
    // lattice
    ctx.save();
    roundRect(ctx, m + 10, m + 10, w - 2 * m - 20, h - 2 * m - 20, 12);
    ctx.clip();
    ctx.strokeStyle = 'rgba(120,180,220,0.22)';
    ctx.lineWidth = 1.5;
    const step = 34;
    for (let i = -h; i < w + h; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(i, h);
      ctx.lineTo(i + h, 0);
      ctx.stroke();
    }
    ctx.restore();
    // inner frame
    ctx.strokeStyle = 'rgba(200,225,245,0.55)';
    ctx.lineWidth = 3;
    roundRect(ctx, m + 22, m + 22, w - 2 * m - 44, h - 2 * m - 44, 10);
    ctx.stroke();
    // emblem
    ctx.fillStyle = '#12213a';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 96, 96, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,225,245,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, 88, 88, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#dbeafe';
    spade(ctx, w / 2, h / 2 - 12, 40);
    ctx.font = '600 22px ui-sans-serif, system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(219,234,254,0.9)';
    ctx.fillText('CARDISTRY LAB', w / 2, h / 2 + 76);
  });
  const face = makeTexture((ctx, w, h) => {
    ctx.fillStyle = '#f7f4ee';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#d6d0c4';
    ctx.lineWidth = 2;
    roundRect(ctx, 14, 14, w - 28, h - 28, 20);
    ctx.stroke();
    ctx.fillStyle = '#111827';
    ctx.font = '700 84px ui-serif, Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('A', 34, 104);
    spade(ctx, 62, 156, 24);
    ctx.save();
    ctx.translate(w, h);
    ctx.rotate(Math.PI);
    ctx.fillText('A', 34, 104);
    spade(ctx, 62, 156, 24);
    ctx.restore();
    spade(ctx, w / 2, h / 2 - 30, 120);
  }, true);
  _tex = { back, face };
  return _tex;
}

export interface PacketMats {
  face: THREE.MeshStandardMaterial;
  back: THREE.MeshStandardMaterial;
  edgeA: THREE.MeshStandardMaterial;
  edgeB: THREE.MeshStandardMaterial;
  all: THREE.MeshStandardMaterial[];
}

export function makePacketMaterials(): PacketMats {
  const { back, face } = cardTextures();
  const faceM = new THREE.MeshStandardMaterial({ map: face, roughness: 0.55, metalness: 0.02 });
  const backM = new THREE.MeshStandardMaterial({ map: back, roughness: 0.5, metalness: 0.05 });
  const edgeA = new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.9 });
  const edgeB = new THREE.MeshStandardMaterial({ color: '#d9d2c3', roughness: 0.9 });
  return { face: faceM, back: backM, edgeA, edgeB, all: [faceM, backM, edgeA, edgeB] };
}
