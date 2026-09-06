import * as THREE from 'three';
import { CollisionWorld } from './physics';
import { Effects } from './effects';
import { audio } from './audio';
import { makeCalcScreen } from './textures';

export type EnemyKind = 'bot' | 'spider' | 'drone' | 'turret';

export interface EnemyCtx {
  playerPos: THREE.Vector3; // feet
  playerEye: THREE.Vector3;
  playerVel: THREE.Vector3;
  col: CollisionWorld;
  fx: Effects;
  time: number;
  difficulty: number; // 1 = wave 1
  fire: (pos: THREE.Vector3, dir: THREE.Vector3, speed: number, dmg: number, color: number, kind: EnemyKind) => void;
  meleePlayer: (dmg: number, from: THREE.Vector3) => void;
  enemies: Enemy[];
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const moveOut = { grounded: false, blocked: false, hitCeiling: false };

export const ENEMY_STATS: Record<EnemyKind, { hp: number; speed: number; score: number; radius: number; hitY: number; hw: number; h: number }> = {
  bot: { hp: 45, speed: 9.5, score: 100, radius: 1.5, hitY: 1.4, hw: 0.75, h: 2.6 },
  spider: { hp: 22, speed: 17, score: 75, radius: 1.1, hitY: 0.6, hw: 0.7, h: 1.0 },
  drone: { hp: 32, speed: 13, score: 150, radius: 1.7, hitY: 0, hw: 0.9, h: 1.4 },
  turret: { hp: 140, speed: 0, score: 300, radius: 2.4, hitY: 1.6, hw: 2.5, h: 3.2 },
};

// ---------- shared geometry ----------
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 16, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  rotor: new THREE.CylinderGeometry(1, 1, 0.06, 18),
};

export class Enemy {
  kind: EnemyKind;
  group = new THREE.Group();
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  hp: number;
  maxHp: number;
  radius: number;
  hitY: number;
  dead = false;
  removeMe = false;
  flashT = 0;
  materials: THREE.MeshStandardMaterial[] = [];
  private emissiveBase: THREE.Color[] = [];
  speed: number;
  yaw = 0;
  // timers
  fireCd = 0;
  meleeCd = 0;
  blockedT = 0;
  sideT = 0;
  sideDir = 1;
  burst = 0;
  lungeCd = 0;
  lunging = false;
  orbitDir = Math.random() > 0.5 ? 1 : -1;
  orbitR = 13 + Math.random() * 6;
  hoverH = 7 + Math.random() * 4;
  spawnT = 0.6; // spawn-in animation
  phase = Math.random() * 10;
  parts: Record<string, THREE.Object3D> = {};
  grounded = false;
  hitByRay = 0;
  scoreValue: number;
  color: number;

  constructor(kind: EnemyKind, pos: THREE.Vector3, difficulty: number) {
    this.kind = kind;
    const st = ENEMY_STATS[kind];
    this.pos.copy(pos);
    const hpScale = 1 + (difficulty - 1) * 0.16;
    this.maxHp = Math.round(st.hp * hpScale);
    this.hp = this.maxHp;
    this.radius = st.radius;
    this.hitY = st.hitY;
    this.speed = st.speed * (1 + (difficulty - 1) * 0.025);
    this.scoreValue = st.score;
    this.color = kind === 'bot' ? 0xff4d2e : kind === 'spider' ? 0x3fd0ff : kind === 'drone' ? 0xff9f1c : 0x8cff5a;
    this.build();
    this.group.position.copy(pos);
    this.group.scale.setScalar(0.01);
  }

  private mat(opts: THREE.MeshStandardMaterialParameters) {
    const m = new THREE.MeshStandardMaterial(opts);
    this.materials.push(m);
    this.emissiveBase.push(m.emissive.clone());
    return m;
  }

  private add(geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = this.group) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = false;
    parent.add(m);
    return m;
  }

  private build() {
    const g = this.group;
    if (this.kind === 'bot') {
      const body = this.mat({ color: 0x3a3f4a, roughness: 0.45, metalness: 0.7 });
      const accent = this.mat({ color: 0xc8352a, roughness: 0.4, metalness: 0.5 });
      const eye = this.mat({ color: 0x000, emissive: 0xff3b1f, emissiveIntensity: 3 });
      const torso = this.add(G.box, body);
      torso.scale.set(1.5, 1.3, 1.1);
      torso.position.y = 1.35;
      const chest = this.add(G.box, accent);
      chest.scale.set(1.0, 0.5, 0.2);
      chest.position.set(0, 1.5, 0.6);
      const head = this.add(G.box, body);
      head.scale.set(1.1, 0.7, 0.9);
      head.position.y = 2.35;
      const visor = this.add(G.box, eye);
      visor.scale.set(0.8, 0.18, 0.1);
      visor.position.set(0, 2.4, 0.47);
      const armL = this.add(G.cyl, body);
      armL.scale.set(0.22, 1.1, 0.22);
      armL.position.set(-0.95, 1.3, 0);
      const armR = this.add(G.cyl, body);
      armR.scale.set(0.22, 1.1, 0.22);
      armR.position.set(0.95, 1.3, 0);
      const gun = this.add(G.box, accent);
      gun.scale.set(0.3, 0.3, 0.9);
      gun.position.set(0.95, 0.8, 0.5);
      const treadL = this.add(G.box, this.mat({ color: 0x15171a, roughness: 0.8 }));
      treadL.scale.set(0.5, 0.7, 1.4);
      treadL.position.set(-0.6, 0.35, 0);
      const treadR = this.add(G.box, treadL.material as THREE.MeshStandardMaterial);
      treadR.scale.set(0.5, 0.7, 1.4);
      treadR.position.set(0.6, 0.35, 0);
      this.parts = { torso, head, armL, armR, gun };
    } else if (this.kind === 'spider') {
      const plastic = this.mat({ color: 0x1f2a44, roughness: 0.4, metalness: 0.3 });
      const metal = this.mat({ color: 0xbfc4cc, roughness: 0.3, metalness: 1 });
      const eye = this.mat({ color: 0x000, emissive: 0x2fd6ff, emissiveIntensity: 3 });
      const body = this.add(G.box, plastic);
      body.scale.set(1.0, 0.55, 2.0);
      body.position.y = 0.7;
      const plug = this.add(G.box, metal);
      plug.scale.set(0.7, 0.3, 0.9);
      plug.position.set(0, 0.7, 1.35);
      const e1 = this.add(G.sphere, eye);
      e1.scale.setScalar(0.12);
      e1.position.set(-0.25, 0.85, 1.8);
      const e2 = this.add(G.sphere, eye);
      e2.scale.setScalar(0.12);
      e2.position.set(0.25, 0.85, 1.8);
      const legs: THREE.Object3D[] = [];
      for (let i = 0; i < 6; i++) {
        const side = i < 3 ? -1 : 1;
        const z = (i % 3) * 0.7 - 0.7;
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.5, 0.6, z);
        const upper = this.add(G.cyl, metal, pivot);
        upper.scale.set(0.08, 0.9, 0.08);
        upper.rotation.z = side * 1.0;
        upper.position.set(side * 0.35, 0.2, 0);
        const lower = this.add(G.cyl, metal, pivot);
        lower.scale.set(0.06, 0.9, 0.06);
        lower.rotation.z = side * 0.25;
        lower.position.set(side * 0.85, -0.2, 0);
        g.add(pivot);
        legs.push(pivot);
        this.parts['leg' + i] = pivot;
      }
      this.parts.body = body;
    } else if (this.kind === 'drone') {
      const shell = this.mat({ color: 0xe8e8ec, roughness: 0.35, metalness: 0.1 });
      const dark = this.mat({ color: 0x24262c, roughness: 0.6 });
      const led = this.mat({ color: 0x000, emissive: 0xff8c1a, emissiveIntensity: 3 });
      const body = this.add(G.sphere, shell);
      body.scale.set(1.3, 0.75, 2.0);
      const seam = this.add(G.box, dark);
      seam.scale.set(0.08, 0.7, 1.4);
      seam.position.set(0, 0.2, 0.6);
      const wheel = this.add(G.cyl, dark);
      wheel.scale.set(0.25, 0.25, 0.5);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.7, 0.9);
      const eyeM = this.add(G.sphere, led);
      eyeM.scale.setScalar(0.28);
      eyeM.position.set(0, -0.1, 2.0);
      for (let i = 0; i < 4; i++) {
        const sx = i % 2 ? 1 : -1;
        const sz = i < 2 ? 1 : -1;
        const arm = this.add(G.box, dark);
        arm.scale.set(1.6, 0.12, 0.2);
        arm.position.set(sx * 1.2, 0.1, sz * 1.1);
        arm.rotation.y = sz * sx * 0.5;
        const rotor = this.add(G.rotor, this.mat({ color: 0x777, roughness: 0.3, transparent: true, opacity: 0.55 }));
        rotor.scale.set(1.0, 1, 1.0);
        rotor.position.set(sx * 1.9, 0.3, sz * 1.6);
        rotor.castShadow = false;
        this.parts['rotor' + i] = rotor;
      }
      this.parts.body = body;
    } else {
      // turret: calculator
      const shellMat = this.mat({ color: 0x2f3239, roughness: 0.5, metalness: 0.2 });
      const btnMat = this.mat({ color: 0x9aa0aa, roughness: 0.6 });
      const scr = this.mat({ color: 0x000, emissive: 0xffffff, emissiveMap: makeCalcScreen('ERR ' + Math.floor(Math.random() * 8999 + 1000)), emissiveIntensity: 1.2 });
      const gunMat = this.mat({ color: 0x1c1e22, roughness: 0.35, metalness: 0.8 });
      const eye = this.mat({ color: 0x000, emissive: 0x7dff4a, emissiveIntensity: 3 });
      const base = this.add(G.box, shellMat);
      base.scale.set(5, 0.9, 7.2);
      base.position.y = 0.45;
      const screen = this.add(G.box, scr);
      screen.scale.set(3.8, 0.1, 1.4);
      screen.position.set(0, 0.92, -2.3);
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
          const b = this.add(G.box, btnMat);
          b.scale.set(0.8, 0.25, 0.7);
          b.position.set(-1.6 + c * 1.07, 1.0, -0.6 + r * 1.0);
        }
      const pivot = new THREE.Group();
      pivot.position.set(0, 1.1, -0.2);
      const dome = this.add(G.sphere, gunMat, pivot);
      dome.scale.set(1.3, 0.9, 1.3);
      dome.position.y = 0.4;
      const barrel = this.add(G.cyl, gunMat, pivot);
      barrel.scale.set(0.28, 2.4, 0.28);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.7, 1.4);
      const barrel2 = this.add(G.cyl, gunMat, pivot);
      barrel2.scale.set(0.2, 2.6, 0.2);
      barrel2.rotation.x = Math.PI / 2;
      barrel2.position.set(0.45, 0.6, 1.4);
      const sensor = this.add(G.sphere, eye, pivot);
      sensor.scale.setScalar(0.22);
      sensor.position.set(0, 1.0, 0.9);
      g.add(pivot);
      this.parts = { pivot, barrel, base };
    }
  }

  takeDamage(amount: number, hitPoint: THREE.Vector3, fx: Effects): boolean {
    if (this.dead) return false;
    this.hp -= amount;
    this.flashT = 0.09;
    fx.sparks(hitPoint, _v.copy(hitPoint).sub(this.group.position).normalize(), 6, this.color, 16);
    fx.debris(hitPoint, 2, [0x444a55, 0x222], 8, 0.14);
    if (this.kind !== 'turret') {
      // knockback away from the hit side
      _v.y = 0;
      this.vel.addScaledVector(_v, this.kind === 'spider' ? -4 : -2.5);
    }
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  get center(): THREE.Vector3 {
    return _v3.copy(this.pos).setY(this.pos.y + this.hitY);
  }

  update(dt: number, ctx: EnemyCtx) {
    // spawn-in
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      const s = 1 - Math.max(0, this.spawnT / 0.6);
      const e = 1 - Math.pow(1 - s, 3);
      this.group.scale.setScalar(Math.max(0.01, e * 1.15 - 0.15 * s));
      if (this.spawnT <= 0) this.group.scale.setScalar(1);
    }
    // hit flash
    if (this.flashT > 0) {
      this.flashT -= dt;
      const f = this.flashT > 0 ? 1 : 0;
      this.materials.forEach((m, i) => {
        if (f) m.emissive.setRGB(1, 1, 1);
        else m.emissive.copy(this.emissiveBase[i]);
      });
    }
    switch (this.kind) {
      case 'bot':
        this.updateBot(dt, ctx);
        break;
      case 'spider':
        this.updateSpider(dt, ctx);
        break;
      case 'drone':
        this.updateDrone(dt, ctx);
        break;
      case 'turret':
        this.updateTurret(dt, ctx);
        break;
    }
    this.group.position.copy(this.pos);
  }

  private separate(ctx: EnemyCtx, strength = 12) {
    for (const o of ctx.enemies) {
      if (o === this || o.dead || o.kind === 'drone' || o.kind === 'turret') continue;
      const dx = this.pos.x - o.pos.x;
      const dz = this.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      const minD = 2.2;
      if (d2 < minD * minD && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (minD - d) / minD;
        this.vel.x += (dx / d) * push * strength;
        this.vel.z += (dz / d) * push * strength;
      }
    }
  }

  private faceDir(dx: number, dz: number, dt: number, rate = 8) {
    const target = Math.atan2(dx, dz);
    let diff = target - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += diff * Math.min(1, rate * dt);
    this.group.rotation.y = this.yaw;
  }

  private groundMove(dt: number, ctx: EnemyCtx, desiredX: number, desiredZ: number, accel: number, hw: number, h: number) {
    this.vel.x += (desiredX - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (desiredZ - this.vel.z) * Math.min(1, accel * dt);
    this.vel.y -= 80 * dt;
    const px = this.pos.x;
    const pz = this.pos.z;
    ctx.col.moveBody(this.pos, this.vel, dt, hw, h, 1.0, moveOut);
    this.grounded = moveOut.grounded;
    const moved = Math.hypot(this.pos.x - px, this.pos.z - pz);
    const wanted = Math.hypot(desiredX, desiredZ) * dt;
    if (moveOut.blocked || (wanted > 0.02 && moved < wanted * 0.3)) {
      this.blockedT += dt;
    } else {
      this.blockedT = Math.max(0, this.blockedT - dt * 2);
    }
    if (this.blockedT > 0.35 && this.grounded) {
      this.vel.y = 30;
      this.blockedT = 0;
      this.sideT = 0.6;
      this.sideDir = Math.random() > 0.5 ? 1 : -1;
    }
  }

  private hasLOS(from: THREE.Vector3, to: THREE.Vector3, ctx: EnemyCtx) {
    _v.copy(to).sub(from);
    const d = _v.length();
    _v.divideScalar(d);
    return ctx.col.raycast(from, _v, d) >= d - 0.01;
  }

  // ------------------------------------------------ BOT
  private updateBot(dt: number, ctx: EnemyCtx) {
    const st = ENEMY_STATS.bot;
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const nx = dx / (dist || 1);
    const nz = dz / (dist || 1);
    let mx = 0;
    let mz = 0;
    if (dist > 11) {
      mx = nx;
      mz = nz;
    } else if (dist < 6) {
      mx = -nx * 0.5;
      mz = -nz * 0.5;
    } else {
      // strafe
      mx = -nz * this.sideDir * 0.7;
      mz = nx * this.sideDir * 0.7;
    }
    if (this.sideT > 0) {
      this.sideT -= dt;
      mx = -nz * this.sideDir;
      mz = nx * this.sideDir;
    }
    this.phase += dt;
    if (Math.random() < dt * 0.4) this.sideDir *= -1;
    this.separate(ctx);
    this.groundMove(dt, ctx, mx * this.speed, mz * this.speed, 6, st.hw, st.h);
    this.faceDir(dx, dz, dt);

    // animation
    const walk = Math.hypot(this.vel.x, this.vel.z) / this.speed;
    const t = ctx.time * 12 + this.phase;
    this.parts.torso.position.y = 1.35 + Math.abs(Math.sin(t)) * 0.08 * walk;
    this.parts.head.position.y = 2.35 + Math.abs(Math.sin(t)) * 0.08 * walk;
    this.parts.armL.rotation.x = Math.sin(t) * 0.5 * walk;
    this.parts.armR.rotation.x = -Math.sin(t) * 0.5 * walk;

    // ranged attack
    this.fireCd -= dt;
    if (this.fireCd <= 0 && dist < 45 && this.spawnT <= 0) {
      const muzzle = _v2.set(this.pos.x, this.pos.y + 0.9, this.pos.z).addScaledVector(_v.set(nx, 0, nz), 1.0);
      if (this.hasLOS(muzzle, ctx.playerEye, ctx)) {
        const target = _v.copy(ctx.playerEye).addScaledVector(ctx.playerVel, 0.15);
        target.y -= 0.6;
        const dir = target.sub(muzzle).normalize();
        dir.x += (Math.random() - 0.5) * 0.06;
        dir.y += (Math.random() - 0.5) * 0.04;
        dir.z += (Math.random() - 0.5) * 0.06;
        dir.normalize();
        ctx.fire(muzzle, dir, 34, 9, 0xff5a2e, 'bot');
        this.fireCd = 1.9 / (1 + (ctx.difficulty - 1) * 0.06);
        (this.parts.gun as THREE.Mesh).position.z = 0.2;
      }
    }
    (this.parts.gun as THREE.Mesh).position.z += (0.5 - (this.parts.gun as THREE.Mesh).position.z) * Math.min(1, dt * 10);
    // melee
    this.meleeCd -= dt;
    if (dist < 2.4 && this.meleeCd <= 0 && Math.abs(ctx.playerPos.y - this.pos.y) < 2.5) {
      ctx.meleePlayer(12, this.pos);
      this.meleeCd = 1.1;
    }
  }

  // ------------------------------------------------ SPIDER
  private updateSpider(dt: number, ctx: EnemyCtx) {
    const st = ENEMY_STATS.spider;
    const dx = ctx.playerPos.x - this.pos.x;
    const dz = ctx.playerPos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const nx = dx / (dist || 1);
    const nz = dz / (dist || 1);
    this.phase += dt;
    this.lungeCd -= dt;
    let mx = nx;
    let mz = nz;
    if (!this.lunging) {
      const zig = Math.sin(this.phase * 5) * 0.75;
      mx = nx * Math.cos(zig) - nz * Math.sin(zig);
      mz = nx * Math.sin(zig) + nz * Math.cos(zig);
    }
    this.separate(ctx, 16);
    if (this.lunging) {
      // ballistic: only gravity + collision
      this.vel.y -= 80 * dt;
      ctx.col.moveBody(this.pos, this.vel, dt, st.hw, st.h, 0.6, moveOut);
      this.grounded = moveOut.grounded;
      if (this.grounded) this.lunging = false;
      if (dist < 2.0 && Math.abs(ctx.playerPos.y - this.pos.y) < 2.6 && this.meleeCd <= 0) {
        ctx.meleePlayer(10, this.pos);
        this.meleeCd = 1.2;
        this.lunging = false;
        this.vel.set(-nx * 12, 10, -nz * 12);
      }
    } else {
      this.groundMove(dt, ctx, mx * this.speed, mz * this.speed, 10, st.hw, st.h);
      if (dist < 9 && dist > 2.5 && this.grounded && this.lungeCd <= 0 && this.spawnT <= 0) {
        this.lunging = true;
        this.lungeCd = 2.2;
        const dy = ctx.playerPos.y - this.pos.y;
        this.vel.set(nx * 24, 16 + Math.max(0, dy) * 4, nz * 24);
        audio.spiderLunge();
      }
    }
    this.meleeCd -= dt;
    if (!this.lunging && dist < 1.8 && this.meleeCd <= 0 && Math.abs(ctx.playerPos.y - this.pos.y) < 2.2) {
      ctx.meleePlayer(7, this.pos);
      this.meleeCd = 0.9;
    }
    this.faceDir(this.vel.x || dx, this.vel.z || dz, dt, 12);
    // leg animation
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const t = ctx.time * 22 + this.phase;
    for (let i = 0; i < 6; i++) {
      const leg = this.parts['leg' + i];
      const ph = (i % 2) * Math.PI + (i % 3) * 0.8;
      leg.rotation.y = Math.sin(t + ph) * 0.45 * Math.min(1, speed / 8);
      leg.rotation.x = Math.cos(t + ph) * 0.2 * Math.min(1, speed / 8);
    }
    this.parts.body.position.y = 0.7 + Math.sin(t * 0.5) * 0.04;
  }

  // ------------------------------------------------ DRONE
  private updateDrone(dt: number, ctx: EnemyCtx) {
    this.phase += dt;
    const target = _v.copy(ctx.playerPos);
    const dx = this.pos.x - target.x;
    const dz = this.pos.z - target.z;
    const dist = Math.hypot(dx, dz) || 1;
    // orbit point
    const ang = Math.atan2(dz, dx) + this.orbitDir * (this.speed / this.orbitR) * dt * 1.1;
    const wantR = this.orbitR;
    const gx = target.x + Math.cos(ang) * wantR;
    const gz = target.z + Math.sin(ang) * wantR;
    const gy = target.y + this.hoverH + Math.sin(this.phase * 2.1) * 1.2;
    const desired = _v2.set(gx - this.pos.x, gy - this.pos.y, gz - this.pos.z);
    const dl = desired.length();
    if (dl > 0.01) desired.multiplyScalar(Math.min(this.speed, dl * 3) / dl);
    // avoid other drones
    for (const o of ctx.enemies) {
      if (o === this || o.kind !== 'drone' || o.dead) continue;
      const ox = this.pos.x - o.pos.x;
      const oy = this.pos.y - o.pos.y;
      const oz = this.pos.z - o.pos.z;
      const d2 = ox * ox + oy * oy + oz * oz;
      if (d2 < 25 && d2 > 0.001) {
        const d = Math.sqrt(d2);
        desired.x += (ox / d) * (5 - d) * 3;
        desired.y += (oy / d) * (5 - d) * 3;
        desired.z += (oz / d) * (5 - d) * 3;
      }
    }
    this.vel.lerp(desired, Math.min(1, dt * 3));
    this.pos.addScaledVector(this.vel, dt);
    // don't clip into world
    const b = ctx.col.bounds;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, b.minX + 2, b.maxX - 2);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, b.minZ + 2, b.maxZ - 2);
    const gh = ctx.col.groundHeight(this.pos.x, this.pos.z, 100, 1.2);
    if (this.pos.y < gh + 2.5) {
      this.pos.y = gh + 2.5;
      if (this.vel.y < 0) this.vel.y = 0;
    }
    if (Math.random() < dt * 0.15) this.orbitDir *= -1;

    // face player, tilt with velocity
    this.faceDir(target.x - this.pos.x, target.z - this.pos.z, dt, 6);
    const fwd = Math.cos(this.yaw) * this.vel.z + Math.sin(this.yaw) * this.vel.x;
    const side = Math.cos(this.yaw) * this.vel.x - Math.sin(this.yaw) * this.vel.z;
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, fwd * 0.03, dt * 5);
    this.group.rotation.z = THREE.MathUtils.lerp(this.group.rotation.z, -side * 0.03, dt * 5);
    for (let i = 0; i < 4; i++) this.parts['rotor' + i].rotation.y += dt * 60 * (i % 2 ? 1 : -1);
    this.parts.body.position.y = Math.sin(this.phase * 6) * 0.05;

    // shooting: bursts of 3
    this.fireCd -= dt;
    if (this.spawnT <= 0 && this.fireCd <= 0 && dist < 40) {
      const muzzle = _v2.set(this.pos.x, this.pos.y - 0.3, this.pos.z);
      if (this.hasLOS(muzzle, ctx.playerEye, ctx)) {
        const aim = _v.copy(ctx.playerEye).addScaledVector(ctx.playerVel, 0.12);
        aim.y -= 0.8;
        const dir = aim.sub(muzzle).normalize();
        dir.x += (Math.random() - 0.5) * 0.05;
        dir.y += (Math.random() - 0.5) * 0.05;
        dir.z += (Math.random() - 0.5) * 0.05;
        dir.normalize();
        ctx.fire(muzzle, dir, 42, 6, 0xffa322, 'drone');
        this.burst++;
        if (this.burst >= 3) {
          this.burst = 0;
          this.fireCd = 2.4 / (1 + (ctx.difficulty - 1) * 0.06);
        } else this.fireCd = 0.13;
      } else this.fireCd = 0.3;
    }
  }

  // ------------------------------------------------ TURRET
  private updateTurret(dt: number, ctx: EnemyCtx) {
    const pivot = this.parts.pivot as THREE.Group;
    const from = _v2.set(this.pos.x, this.pos.y + 1.9, this.pos.z);
    const to = _v.copy(ctx.playerEye).sub(from);
    const dist = to.length();
    const targetYaw = Math.atan2(to.x, to.z);
    let diff = targetYaw - pivot.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.min(Math.abs(diff), 2.2 * dt) * Math.sign(diff);
    pivot.rotation.y += turn;
    const pitch = -Math.asin(THREE.MathUtils.clamp(to.y / dist, -1, 1));
    pivot.rotation.x = THREE.MathUtils.lerp(pivot.rotation.x, pitch * 0.8, dt * 4);
    this.fireCd -= dt;
    const aligned = Math.abs(diff) < 0.12;
    if (this.spawnT <= 0 && aligned && this.fireCd <= 0 && dist < 75) {
      if (this.hasLOS(from, ctx.playerEye, ctx)) {
        const dir = to.normalize();
        dir.x += (Math.random() - 0.5) * 0.03;
        dir.y += (Math.random() - 0.5) * 0.03;
        dir.z += (Math.random() - 0.5) * 0.03;
        dir.normalize();
        const muzzle = from.clone().addScaledVector(dir, 2.6);
        ctx.fire(muzzle, dir, 60, 5, 0x9dff4a, 'turret');
        (this.parts.barrel as THREE.Mesh).position.z = 1.0;
        this.burst++;
        if (this.burst >= 5) {
          this.burst = 0;
          this.fireCd = 2.2;
        } else this.fireCd = 0.11;
      } else this.fireCd = 0.4;
    }
    const barrel = this.parts.barrel as THREE.Mesh;
    barrel.position.z += (1.4 - barrel.position.z) * Math.min(1, dt * 12);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    this.materials.forEach((m) => m.dispose());
  }
}

// =====================================================================
// Enemy projectiles
// =====================================================================
interface Bolt {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
  active: boolean;
  color: number;
}

export class BoltPool {
  bolts: Bolt[] = [];
  private geo = new THREE.SphereGeometry(0.28, 10, 8);
  constructor(scene: THREE.Scene, count = 80) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.bolts.push({ mesh, vel: new THREE.Vector3(), life: 0, dmg: 0, active: false, color: 0xffffff });
    }
  }

  fire(pos: THREE.Vector3, dir: THREE.Vector3, speed: number, dmg: number, color: number) {
    let b = this.bolts.find((x) => !x.active);
    if (!b) b = this.bolts[0];
    b.active = true;
    b.mesh.visible = true;
    b.mesh.position.copy(pos);
    b.vel.copy(dir).multiplyScalar(speed);
    b.life = 3;
    b.dmg = dmg;
    b.color = color;
    (b.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    b.mesh.lookAt(pos.clone().add(dir));
    b.mesh.scale.set(1, 1, 2.6);
  }

  update(
    dt: number,
    col: CollisionWorld,
    fx: Effects,
    playerPos: THREE.Vector3,
    playerH: number,
    onHitPlayer: (dmg: number, from: THREE.Vector3) => void,
  ) {
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.life -= dt;
      const p = b.mesh.position;
      p.addScaledVector(b.vel, dt);
      // player hit (capsule-ish)
      const cy = THREE.MathUtils.clamp(p.y, playerPos.y + 0.3, playerPos.y + playerH - 0.2);
      const dx = p.x - playerPos.x;
      const dy = p.y - cy;
      const dz = p.z - playerPos.z;
      if (dx * dx + dy * dy + dz * dz < 1.1) {
        onHitPlayer(b.dmg, p);
        fx.sparks(p, _v.copy(b.vel).normalize().negate(), 6, b.color, 10);
        this.kill(b);
        continue;
      }
      if (b.life <= 0 || col.pointInside(p)) {
        fx.sparks(p, _v.copy(b.vel).normalize().negate(), 5, b.color, 12);
        fx.smokePuff(p, 0.7, 0x333333, 0.5);
        this.kill(b);
        continue;
      }
    }
  }

  private kill(b: Bolt) {
    b.active = false;
    b.mesh.visible = false;
  }

  clear() {
    this.bolts.forEach((b) => this.kill(b));
  }
}
