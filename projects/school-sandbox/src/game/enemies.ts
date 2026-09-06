import * as THREE from "three";
import { mesh } from "./props";
import type { ParticleSystem } from "./particles";

export type Behavior = "chase" | "ranged" | "hop" | "kamikaze" | "boss" | "fly";

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  range: number;
  attackCd: number;
  score: number;
  behavior: Behavior;
  hover: number; // 悬浮高度（飞行）
  radius: number;
  height: number;
  color: THREE.ColorRepresentation;
  build: (e: Enemy) => THREE.Group;
}

export interface EnemyCtx {
  playerPos: THREE.Vector3; // 眼睛位置
  camQuat: THREE.Quaternion;
  time: number;
  groundAt: (x: number, z: number) => number;
  collide: (pos: THREE.Vector3, r: number) => void;
  damagePlayer: (amount: number, from: THREE.Vector3) => void;
  fireProjectile: (from: THREE.Vector3, dir: THREE.Vector3, speed: number, dmg: number) => void;
  explode: (pos: THREE.Vector3, radius: number, dmg: number) => void;
  particles: ParticleSystem;
}

const um = (color: THREE.ColorRepresentation, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });

let faceTex: THREE.CanvasTexture | null = null;
function getFace() {
  if (faceTex) return faceTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4cfa8";
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#222";
  g.fillRect(36, 48, 14, 16);
  g.fillRect(78, 48, 14, 16);
  g.lineWidth = 5;
  g.strokeStyle = "#222";
  g.beginPath();
  g.moveTo(30, 40);
  g.lineTo(54, 46);
  g.moveTo(98, 40);
  g.lineTo(74, 46);
  g.stroke();
  g.beginPath();
  g.arc(64, 84, 14, 0, Math.PI);
  g.fillStyle = "#7a2a2a";
  g.fill();
  faceTex = new THREE.CanvasTexture(c);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  return faceTex;
}

function eyes(g: THREE.Group, x: number, y: number, z: number, r = 0.08, sep = 0.16) {
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.SphereGeometry(r, 10, 8), um("#ffffff"), x + s * sep, y, z);
    g.add(w);
    const p = mesh(new THREE.SphereGeometry(r * 0.5, 8, 6), um("#111111"), x + s * sep, y, z - r * 0.8);
    g.add(p);
  }
}

// ---------- 模型 ----------
function buildBook(e: Enemy, big = false) {
  const g = new THREE.Group();
  const cols = ["#2b5fb3", "#c0392b", "#2e8b57", "#8e44ad", "#d35400"];
  const col = big ? "#6b1d1d" : cols[Math.floor(Math.random() * cols.length)];
  const s = big ? 3.2 : 1;
  const coverMat = um(col, { roughness: 0.6 });
  const pageMat = um("#f5f1e6");
  const left = new THREE.Group();
  const right = new THREE.Group();
  const lc = mesh(new THREE.BoxGeometry(0.5 * s, 0.04 * s, 0.75 * s), coverMat, -0.25 * s, 0, 0);
  const rc = mesh(new THREE.BoxGeometry(0.5 * s, 0.04 * s, 0.75 * s), coverMat, 0.25 * s, 0, 0);
  const lp = mesh(new THREE.BoxGeometry(0.46 * s, 0.05 * s, 0.7 * s), pageMat, -0.24 * s, 0.03 * s, 0);
  const rp = mesh(new THREE.BoxGeometry(0.46 * s, 0.05 * s, 0.7 * s), pageMat, 0.24 * s, 0.03 * s, 0);
  left.add(lc, lp);
  right.add(rc, rp);
  g.add(left, right);
  const spine = mesh(new THREE.BoxGeometry(0.08 * s, 0.1 * s, 0.76 * s), coverMat, 0, 0.01 * s, 0);
  g.add(spine);
  if (big) {
    const gold = um("#e0b64a", { metalness: 0.7, roughness: 0.3 });
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.5), gold, -0.9, 0.08, 0));
    g.add(mesh(new THREE.BoxGeometry(0.3, 0.06, 0.5), gold, 0.9, 0.08, 0));
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.12, 2.2), gold, 0, 0.02, 0));
  }
  eyes(g, 0, 0.12 * s, -0.36 * s, 0.09 * s, 0.14 * s);
  // 牙齿
  const tm = um("#ffffff");
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.ConeGeometry(0.03 * s, 0.08 * s, 4), tm, (-0.18 + i * 0.12) * s, -0.02 * s, -0.37 * s).rotateX(Math.PI));
  e.parts.left = left;
  e.parts.right = right;
  return g;
}

function buildStudent(e: Enemy) {
  const g = new THREE.Group();
  const uni = um(Math.random() > 0.5 ? "#2c4f8a" : "#3d7a5c");
  const skin = um("#f4cfa8");
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), uni, 0, 1.0, 0));
  g.add(mesh(new THREE.BoxGeometry(0.52, 0.16, 0.32), um("#ffffff"), 0, 1.28, 0));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), [skin, skin, um("#2b2b2b"), skin, skin, um("#f4cfa8", { map: getFace() })]);
  head.position.y = 1.58;
  head.castShadow = true;
  g.add(head);
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.12, 0.46), um("#2b2b2b"), 0, 1.78, -0.02));
  g.add(mesh(new THREE.BoxGeometry(0.36, 0.42, 0.18), um("#c0392b"), 0, 1.05, 0.23));
  g.add(mesh(new THREE.BoxGeometry(0.4, 0.1, 0.05), um("#e74c3c"), 0, 1.34, -0.17));
  const mk = (x: number, y: number, w: number, h: number, m: THREE.Material) => {
    const grp = new THREE.Group();
    grp.position.set(x, y, 0);
    grp.add(mesh(new THREE.BoxGeometry(w, h, w), m, 0, -h / 2, 0));
    g.add(grp);
    return grp;
  };
  e.parts.armL = mk(-0.33, 1.28, 0.14, 0.55, uni);
  e.parts.armR = mk(0.33, 1.28, 0.14, 0.55, uni);
  e.parts.legL = mk(-0.13, 0.7, 0.18, 0.68, um("#1f2a3a"));
  e.parts.legR = mk(0.13, 0.7, 0.18, 0.68, um("#1f2a3a"));
  e.parts.armL.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), skin, 0, -0.6, 0));
  e.parts.armR.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), skin, 0, -0.6, 0));
  // 手持三角尺
  const tri = new THREE.Shape();
  tri.moveTo(0, 0);
  tri.lineTo(0.35, 0);
  tri.lineTo(0, 0.35);
  tri.closePath();
  const trim = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.02, bevelEnabled: false }), um("#7fd1ff", { transparent: true, opacity: 0.7 }));
  trim.position.set(0.05, -0.75, 0);
  trim.rotation.y = Math.PI / 2;
  e.parts.armR.add(trim);
  return g;
}

function buildGhost(e: Enemy) {
  const g = new THREE.Group();
  const m = um("#f7f7f5", { transparent: true, opacity: 0.85, roughness: 0.4 });
  g.add(mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.8, 16), m, 0, 0.4, 0));
  g.add(mesh(new THREE.SphereGeometry(0.34, 16, 12), m, 0, 0.8, 0));
  const tail = mesh(new THREE.ConeGeometry(0.42, 0.5, 16), m, 0, -0.25, 0);
  tail.rotation.x = Math.PI;
  g.add(tail);
  eyes(g, 0, 0.85, -0.3, 0.07, 0.13);
  const stick = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8), um("#ffffff"), 0.35, 0.5, -0.1);
  stick.rotation.z = 0.5;
  g.add(stick);
  e.parts.body = g;
  return g;
}

function buildSlime(e: Enemy) {
  const g = new THREE.Group();
  const m = um("#141a3a", { roughness: 0.25, metalness: 0.3 });
  const body = mesh(new THREE.SphereGeometry(0.65, 20, 14), m, 0, 0.5, 0);
  body.scale.set(1, 0.78, 1);
  g.add(body);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), m, Math.cos(a) * 0.55, 0.12, Math.sin(a) * 0.55));
  }
  eyes(g, 0, 0.6, -0.5, 0.1, 0.2);
  e.parts.body = body;
  return g;
}

function buildClock(e: Enemy) {
  const g = new THREE.Group();
  const red = um("#d8322f", { roughness: 0.4, metalness: 0.2 });
  const body = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.28, 24), red, 0, 0.6, 0);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const face = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 24), um("#fdfdf5"), 0, 0.6, -0.15);
  face.rotation.x = Math.PI / 2;
  g.add(face);
  const hand = mesh(new THREE.BoxGeometry(0.03, 0.25, 0.01), um("#222"), 0, 0.7, -0.165);
  hand.name = "hand";
  const hand2 = mesh(new THREE.BoxGeometry(0.03, 0.18, 0.01), um("#222"), 0.07, 0.63, -0.165);
  hand2.rotation.z = -1.2;
  g.add(hand, hand2);
  const gold = um("#e6c04a", { metalness: 0.7, roughness: 0.3 });
  g.add(mesh(new THREE.SphereGeometry(0.13, 12, 8), gold, -0.25, 0.98, 0));
  g.add(mesh(new THREE.SphereGeometry(0.13, 12, 8), gold, 0.25, 0.98, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), gold, 0, 0.98, 0));
  const legm = um("#333", { metalness: 0.5 });
  for (const x of [-0.22, 0.22]) {
    const l = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 6), legm, x, 0.18, 0);
    l.rotation.z = x > 0 ? -0.35 : 0.35;
    g.add(l);
  }
  eyes(g, 0, 0.66, -0.17, 0.06, 0.12);
  e.parts.hand = hand;
  return g;
}

export const ENEMY_DEFS: Record<string, EnemyDef> = {
  book: { id: "book", name: "暴走课本", hp: 55, speed: 5.2, damage: 8, range: 1.6, attackCd: 1.0, score: 10, behavior: "fly", hover: 1.4, radius: 0.6, height: 1.9, color: "#2b5fb3", build: (e) => buildBook(e) },
  student: { id: "student", name: "作业狂人", hp: 90, speed: 4.2, damage: 12, range: 1.7, attackCd: 1.1, score: 15, behavior: "chase", hover: 0, radius: 0.5, height: 2.2, color: "#f4cfa8", build: buildStudent },
  ghost: { id: "ghost", name: "粉笔幽灵", hp: 45, speed: 3.4, damage: 7, range: 16, attackCd: 2.0, score: 20, behavior: "ranged", hover: 1.5, radius: 0.5, height: 2.9, color: "#ffffff", build: buildGhost },
  slime: { id: "slime", name: "墨水史莱姆", hp: 140, speed: 6, damage: 16, range: 1.8, attackCd: 1.4, score: 20, behavior: "hop", hover: 0, radius: 0.7, height: 1.4, color: "#2a2f7a", build: buildSlime },
  clock: { id: "clock", name: "自爆闹钟", hp: 35, speed: 7.2, damage: 28, range: 2.3, attackCd: 1, score: 15, behavior: "kamikaze", hover: 0, radius: 0.45, height: 1.5, color: "#d8322f", build: buildClock },
  boss: { id: "boss", name: "巨型字典 · 词海霸主", hp: 950, speed: 3.2, damage: 32, range: 4.5, attackCd: 2.2, score: 250, behavior: "boss", hover: 1.8, radius: 2.0, height: 4.2, color: "#6b1d1d", build: (e) => buildBook(e, true) },
};

let nextId = 1;

export class Enemy {
  id = nextId++;
  def: EnemyDef;
  group = new THREE.Group();
  parts: Record<string, THREE.Object3D> = {};
  mats: THREE.MeshStandardMaterial[] = [];
  hp: number;
  maxHp: number;
  vel = new THREE.Vector3();
  cd = 0;
  flash = 0;
  dead = false;
  deadT = 0;
  remove = false;
  seed = Math.random() * 100;
  onGround = false;
  bar: THREE.Group;
  barFg: THREE.Mesh;
  private state = 0;

  constructor(def: EnemyDef, x: number, z: number, groundY: number, hpMul = 1) {
    this.def = def;
    this.hp = this.maxHp = Math.round(def.hp * hpMul);
    const model = def.build(this);
    this.group.add(model);
    this.group.position.set(x, groundY + def.hover, z);
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = (o as THREE.Mesh).material;
        const arr = Array.isArray(m) ? m : [m];
        for (const mm of arr) if ((mm as THREE.MeshStandardMaterial).isMeshStandardMaterial) this.mats.push(mm as THREE.MeshStandardMaterial);
      }
    });
    this.group.userData.enemyId = this.id;
    // 血条
    this.bar = new THREE.Group();
    const w = def.behavior === "boss" ? 4 : 1;
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.12), new THREE.MeshBasicMaterial({ color: "#222", depthTest: false, transparent: true, opacity: 0.8 }));
    this.barFg = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.1), new THREE.MeshBasicMaterial({ color: def.behavior === "boss" ? "#e74c3c" : "#2ecc71", depthTest: false }));
    this.barFg.position.z = 0.001;
    this.bar.add(bg, this.barFg);
    this.bar.position.y = def.height;
    this.bar.renderOrder = 999;
    this.group.add(this.bar);
  }

  get pos() {
    return this.group.position;
  }

  hit(dmg: number, dir: THREE.Vector3, knock: number, ctx: EnemyCtx) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.12;
    const kb = this.def.behavior === "boss" ? knock * 0.15 : knock;
    this.vel.x += dir.x * kb;
    this.vel.z += dir.z * kb;
    if (this.def.hover === 0) this.vel.y += kb * 0.4;
    ctx.particles.emit(this.pos.clone().add(new THREE.Vector3(0, this.def.height * 0.4, 0)), 10, this.def.color, 5, 10, 0.5);
    if (this.hp <= 0) this.die(ctx);
  }

  die(ctx: EnemyCtx) {
    this.dead = true;
    this.deadT = 0;
    this.hp = 0;
    this.bar.visible = false;
    ctx.particles.emit(this.pos.clone().add(new THREE.Vector3(0, this.def.height * 0.4, 0)), 35, this.def.color, 7, 10, 0.8);
    ctx.particles.emit(this.pos.clone().add(new THREE.Vector3(0, this.def.height * 0.4, 0)), 15, "#ffffff", 4, 6, 0.6);
  }

  update(dt: number, ctx: EnemyCtx) {
    const g = this.group;
    const p = g.position;
    if (this.dead) {
      this.deadT += dt;
      const k = Math.max(0, 1 - this.deadT / 0.6);
      g.scale.setScalar(Math.max(0.001, k));
      g.rotation.x += dt * 4;
      p.y -= dt * 2;
      if (this.deadT > 0.6) this.remove = true;
      return;
    }
    // 受击闪烁
    if (this.flash > 0) {
      this.flash -= dt;
      const on = this.flash > 0;
      for (const m of this.mats) m.emissive.set(on ? "#ff3020" : "#000000");
    }
    const d = this.def;
    const toP = new THREE.Vector3(ctx.playerPos.x - p.x, 0, ctx.playerPos.z - p.z);
    const dist = toP.length();
    if (dist > 1e-4) toP.divideScalar(dist);
    const t = ctx.time + this.seed;
    this.cd -= dt;
    const groundY = ctx.groundAt(p.x, p.z);
    const face = () => {
      g.rotation.y = Math.atan2(toP.x, toP.z) + Math.PI;
    };
    const attack = () => {
      if (this.cd <= 0) {
        this.cd = d.attackCd;
        this.state = 1;
        ctx.damagePlayer(d.damage, p);
      }
    };
    const damp = Math.exp(-6 * dt);

    switch (d.behavior) {
      case "fly": {
        const want = dist > d.range * 0.8 ? d.speed : 0;
        this.vel.x += (toP.x * want - this.vel.x) * (1 - damp);
        this.vel.z += (toP.z * want - this.vel.z) * (1 - damp);
        const targetY = groundY + d.hover + Math.sin(t * 3) * 0.25 + (dist < 3 ? 0.3 : 0);
        p.y += (targetY - p.y) * Math.min(1, dt * 4);
        face();
        const flap = Math.sin(t * 12) * 0.6;
        if (this.parts.left) this.parts.left.rotation.z = -0.3 - flap;
        if (this.parts.right) this.parts.right.rotation.z = 0.3 + flap;
        if (dist < d.range) attack();
        break;
      }
      case "boss": {
        const want = dist > d.range * 0.75 ? d.speed : 0;
        this.vel.x += (toP.x * want - this.vel.x) * (1 - damp);
        this.vel.z += (toP.z * want - this.vel.z) * (1 - damp);
        const slam = this.cd < 0.3 && dist < d.range ? Math.max(0, this.cd) * 8 : 0;
        const targetY = groundY + d.hover + Math.sin(t * 2) * 0.4 + slam;
        p.y += (targetY - p.y) * Math.min(1, dt * 5);
        face();
        const flap = Math.sin(t * 6) * 0.5;
        if (this.parts.left) this.parts.left.rotation.z = -0.4 - flap;
        if (this.parts.right) this.parts.right.rotation.z = 0.4 + flap;
        if (dist < d.range && this.cd <= 0) {
          this.cd = d.attackCd;
          ctx.explode(p, d.range + 1, d.damage);
          ctx.particles.emit(new THREE.Vector3(p.x, groundY + 0.2, p.z), 40, "#c9a45c", 9, 14, 0.8);
        }
        break;
      }
      case "ranged": {
        let want = 0;
        if (dist > 15) want = d.speed;
        else if (dist < 8) want = -d.speed * 0.8;
        this.vel.x += (toP.x * want - this.vel.x) * (1 - damp);
        this.vel.z += (toP.z * want - this.vel.z) * (1 - damp);
        p.y += (groundY + d.hover + Math.sin(t * 2.5) * 0.3 - p.y) * Math.min(1, dt * 4);
        face();
        g.rotation.z = Math.sin(t * 2) * 0.1;
        if (dist < d.range && this.cd <= 0) {
          this.cd = d.attackCd;
          const from = p.clone().add(new THREE.Vector3(0, 0.6, 0));
          const dir = ctx.playerPos.clone().sub(from).normalize();
          ctx.fireProjectile(from, dir, 22, d.damage);
        }
        break;
      }
      case "hop": {
        this.vel.y -= 20 * dt;
        if (this.onGround) {
          this.vel.x *= 0.85;
          this.vel.z *= 0.85;
          if (this.cd <= 0.9 * d.attackCd && this.state === 0 && Math.sin(t * 2.2) > 0.6) {
            this.vel.y = 7;
            this.vel.x = toP.x * d.speed;
            this.vel.z = toP.z * d.speed;
            this.state = 2;
          }
        }
        if (this.state === 2 && this.onGround) this.state = 0;
        const sq = this.onGround ? 1 : 1.25;
        const b = this.parts.body;
        if (b) {
          b.scale.y += ((this.onGround ? 0.7 : 0.95) - b.scale.y) * Math.min(1, dt * 10);
          b.scale.x = b.scale.z = 1.6 - b.scale.y * sq * 0.7;
        }
        face();
        if (dist < d.range && this.cd <= 0) attack();
        break;
      }
      case "kamikaze": {
        this.vel.x += (toP.x * d.speed - this.vel.x) * (1 - damp);
        this.vel.z += (toP.z * d.speed - this.vel.z) * (1 - damp);
        this.vel.y -= 20 * dt;
        face();
        const j = dist < 6 ? 0.06 : 0.02;
        g.children[0].position.set((Math.random() - 0.5) * j, Math.abs(Math.sin(t * 20)) * 0.15, (Math.random() - 0.5) * j);
        if (this.parts.hand) this.parts.hand.rotation.z = -t * 10;
        if (dist < d.range) {
          ctx.explode(p, 4, d.damage);
          ctx.particles.emit(p.clone(), 60, "#ff8a3c", 10, 10, 0.8);
          ctx.particles.emit(p.clone(), 25, "#ffffff", 6, 5, 0.5);
          this.die(ctx);
        }
        break;
      }
      default: {
        const want = dist > d.range * 0.85 ? d.speed : 0;
        this.vel.x += (toP.x * want - this.vel.x) * (1 - damp);
        this.vel.z += (toP.z * want - this.vel.z) * (1 - damp);
        this.vel.y -= 20 * dt;
        face();
        const sp = Math.hypot(this.vel.x, this.vel.z);
        const sw = Math.sin(t * 9) * Math.min(1, sp / 3) * 0.8;
        if (this.parts.armL) this.parts.armL.rotation.x = sw;
        if (this.parts.armR) this.parts.armR.rotation.x = this.state === 1 ? -2.2 + (d.attackCd - this.cd) * 2.5 : -sw;
        if (this.parts.legL) this.parts.legL.rotation.x = -sw;
        if (this.parts.legR) this.parts.legR.rotation.x = sw;
        if (this.state === 1 && this.cd < d.attackCd - 0.6) this.state = 0;
        if (dist < d.range) attack();
      }
    }

    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    if (d.hover === 0) {
      p.y += this.vel.y * dt;
      const gy = ctx.groundAt(p.x, p.z);
      if (p.y <= gy) {
        p.y = gy;
        this.vel.y = 0;
        this.onGround = true;
      } else this.onGround = false;
    }
    ctx.collide(p, d.radius);
    // 血条朝向相机
    this.bar.quaternion.copy(ctx.camQuat);
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.barFg.scale.x = Math.max(0.001, ratio);
    const w = d.behavior === "boss" ? 4 : 1;
    this.barFg.position.x = (-(1 - ratio) * w) / 2;
  }
}

/** 敌人之间的简单分离 */
export function separateEnemies(list: Enemy[]) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
      const min = a.def.radius + b.def.radius;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5;
        a.pos.x -= dx * push;
        a.pos.z -= dz * push;
        b.pos.x += dx * push;
        b.pos.z += dz * push;
      }
    }
  }
}
