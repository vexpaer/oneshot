import * as THREE from "three";
import { mat, mesh } from "./props";

export interface WeaponDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  type: "melee" | "throw" | "shoot";
  damage: number;
  range: number;
  angle: number; // 度
  cooldown: number;
  knockback: number;
  ammoMax?: number;
  ammoRegen?: number; // 每秒
  projSpeed?: number;
  splash?: number;
  gravity?: number;
  build: () => THREE.Group;
  animate: (g: THREE.Group, t: number, walk: number) => void; // t: 0..1 攻击进度(-1 空闲)
}

function rulerTexture() {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f3d977";
  g.fillRect(0, 0, 1024, 128);
  g.fillStyle = "#222";
  g.font = "bold 26px sans-serif";
  for (let i = 0; i <= 60; i++) {
    const x = 20 + i * 16;
    const h = i % 10 === 0 ? 46 : i % 5 === 0 ? 32 : 18;
    g.fillRect(x, 0, 3, h);
    if (i % 10 === 0) g.fillText(String(i / 10), x - 6, 78);
  }
  g.font = "bold 30px sans-serif";
  g.fillText("30 cm  DELUXE RULER", 380, 112);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildPencil() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), mat("#f2c12e"), 0, 0, 0);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wood = mesh(new THREE.ConeGeometry(0.06, 0.18, 6), mat("#e8c9a0"), 0, 0, -0.64);
  wood.rotation.x = -Math.PI / 2;
  g.add(wood);
  const tip = mesh(new THREE.ConeGeometry(0.02, 0.07, 6), mat("#222", { metalness: 0.3 }), 0, 0, -0.76);
  tip.rotation.x = -Math.PI / 2;
  g.add(tip);
  const ferrule = mesh(new THREE.CylinderGeometry(0.063, 0.063, 0.08, 12), mat("#c9c9c9", { metalness: 0.8, roughness: 0.3 }), 0, 0, 0.58);
  ferrule.rotation.x = Math.PI / 2;
  g.add(ferrule);
  const eraser = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.09, 12), mat("#f28ca0"), 0, 0, 0.66);
  eraser.rotation.x = Math.PI / 2;
  g.add(eraser);
  const text = mesh(new THREE.BoxGeometry(0.03, 0.005, 0.4), mat("#1f4b8f"), 0, 0.058, 0.1);
  g.add(text);
  return g;
}

function buildRuler() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ map: rulerTexture(), roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.95 });
  const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 1.0), [mat("#e5c96a"), mat("#e5c96a"), m, m, mat("#e5c96a"), mat("#e5c96a")]);
  r.castShadow = true;
  r.rotation.y = Math.PI / 2;
  r.rotation.z = 0;
  const holder = new THREE.Group();
  holder.add(r);
  r.rotation.set(0, -Math.PI / 2, 0);
  r.position.z = -0.35;
  g.add(holder);
  return g;
}

export function buildEraserMesh(scale = 1) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.3 * scale, 0.11 * scale, 0.16 * scale), mat("#f5f5f0", { roughness: 0.6 }), 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(0.16 * scale, 0.118 * scale, 0.168 * scale), mat("#1e5aa8"), 0.07 * scale, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(0.1 * scale, 0.04 * scale, 0.172 * scale), mat("#ffffff"), 0.07 * scale, 0.02 * scale, 0));
  return g;
}

function buildStapler() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.05, 0.5), mat("#2a2d33", { metalness: 0.4 }), 0, -0.03, 0));
  const top = mesh(new THREE.BoxGeometry(0.1, 0.06, 0.5), mat("#c8332b", { metalness: 0.2, roughness: 0.4 }), 0, 0.04, 0);
  top.name = "top";
  g.add(top);
  g.add(mesh(new THREE.BoxGeometry(0.09, 0.02, 0.48), mat("#d9d9d9", { metalness: 0.8, roughness: 0.2 }), 0, 0.005, 0));
  g.add(mesh(new THREE.BoxGeometry(0.11, 0.07, 0.08), mat("#3a3d44", { metalness: 0.5 }), 0, 0.02, 0.2));
  return g;
}

export const WEAPONS: WeaponDef[] = [
  {
    id: "pencil",
    name: "巨型铅笔",
    icon: "✏️",
    desc: "快速突刺，中等伤害",
    type: "melee",
    damage: 26,
    range: 3.8,
    angle: 32,
    cooldown: 0.32,
    knockback: 3,
    build: buildPencil,
    animate: (g, t, walk) => {
      const bob = Math.sin(walk * 2) * 0.01;
      if (t < 0) {
        g.position.set(0.32, -0.28 + bob, -0.55);
        g.rotation.set(0.15, -0.25, 0.1);
        return;
      }
      const k = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
      g.position.set(0.32 - 0.22 * k, -0.28 + 0.06 * k, -0.55 - 0.55 * k);
      g.rotation.set(0.15 - 0.2 * k, -0.25 + 0.2 * k, 0.1);
    },
  },
  {
    id: "ruler",
    name: "钢尺",
    icon: "📏",
    desc: "大范围横扫，击退敌人",
    type: "melee",
    damage: 42,
    range: 4.6,
    angle: 85,
    cooldown: 0.7,
    knockback: 8,
    build: buildRuler,
    animate: (g, t, walk) => {
      const bob = Math.sin(walk * 2) * 0.012;
      if (t < 0) {
        g.position.set(0.36, -0.25 + bob, -0.5);
        g.rotation.set(0.1, 0.35, 0.9);
        return;
      }
      const k = t < 0.4 ? t / 0.4 : 1;
      const back = t > 0.6 ? (t - 0.6) / 0.4 : 0;
      const sw = (Math.sin(k * Math.PI - Math.PI / 2) + 1) / 2;
      g.position.set(0.36 - 0.6 * sw + 0.6 * sw * back, -0.25, -0.5 - 0.1 * sw);
      g.rotation.set(0.1, 0.35 + 2.2 * sw - 2.2 * sw * back, 0.9 - 0.9 * sw + 0.9 * sw * back);
    },
  },
  {
    id: "eraser",
    name: "投掷橡皮",
    icon: "🧽",
    desc: "投掷后爆裂，范围伤害",
    type: "throw",
    damage: 70,
    range: 60,
    angle: 0,
    cooldown: 0.75,
    knockback: 6,
    ammoMax: 8,
    ammoRegen: 0.6,
    projSpeed: 28,
    splash: 3.5,
    gravity: 14,
    build: () => buildEraserMesh(1.4),
    animate: (g, t, walk) => {
      const bob = Math.sin(walk * 2) * 0.012;
      if (t < 0) {
        g.position.set(0.3, -0.27 + bob, -0.5);
        g.rotation.set(0.3, 0.5, 0);
        g.visible = true;
        return;
      }
      if (t < 0.15) {
        const k = t / 0.15;
        g.visible = true;
        g.position.set(0.3 + 0.1 * k, -0.27 + 0.15 * k, -0.5 + 0.25 * k);
        g.rotation.set(0.3 - 1.2 * k, 0.5, 0);
      } else if (t < 0.55) g.visible = false;
      else {
        const k = (t - 0.55) / 0.45;
        g.visible = true;
        g.position.set(0.3, -0.27 - 0.3 * (1 - k), -0.5);
        g.rotation.set(0.3, 0.5, 0);
      }
    },
  },
  {
    id: "stapler",
    name: "连发订书机",
    icon: "📎",
    desc: "高速连射订书钉",
    type: "shoot",
    damage: 13,
    range: 80,
    angle: 0,
    cooldown: 0.11,
    knockback: 1,
    ammoMax: 40,
    ammoRegen: 6,
    projSpeed: 70,
    gravity: 1,
    build: buildStapler,
    animate: (g, t, walk) => {
      const bob = Math.sin(walk * 2) * 0.01;
      const top = g.getObjectByName("top");
      if (t < 0) {
        g.position.set(0.28, -0.22 + bob, -0.5);
        g.rotation.set(0, 0.05, 0);
        if (top) top.rotation.x = 0;
        return;
      }
      const k = t < 0.3 ? t / 0.3 : 1 - (t - 0.3) / 0.7;
      g.position.set(0.28, -0.22 + 0.02 * k, -0.5 + 0.07 * k);
      g.rotation.set(0.15 * k, 0.05, 0);
      if (top) top.rotation.x = -0.25 * k;
    },
  },
];
