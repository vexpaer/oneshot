import * as THREE from 'three';
import { makeFlash, makeSoftParticle } from './textures';

interface Particle {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  gravity: number;
  drag: number;
  shrink: boolean;
  bounce: boolean;
  spin: number;
}

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

export class Effects {
  scene: THREE.Scene;
  particles: Particle[] = [];
  private inst: THREE.InstancedMesh;
  private maxParticles: number;
  private nextP = 0;

  private smoke: Particle[] = [];
  private smokeSprites: THREE.Sprite[] = [];
  private nextS = 0;

  private tracers: Tracer[] = [];
  private tracerMat: THREE.MeshBasicMaterial;
  private tracerGeo: THREE.BoxGeometry;

  flashSprite: THREE.Sprite;
  flashLight: THREE.PointLight;
  private flashTime = 0;

  private lights: { light: THREE.PointLight; life: number; maxLife: number; intensity: number }[] = [];

  trauma = 0;
  shakeOffset = new THREE.Vector3();
  shakeRot = new THREE.Vector3();
  private shakeT = 0;

  constructor(scene: THREE.Scene, quality: 'low' | 'medium' | 'high') {
    this.scene = scene;
    this.maxParticles = quality === 'low' ? 500 : quality === 'medium' ? 1000 : 1800;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.inst = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.inst.frustumCulled = false;
    this.inst.castShadow = false;
    const colors = new Float32Array(this.maxParticles * 3);
    this.inst.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.inst.instanceColor.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 0.1,
        color: new THREE.Color(),
        gravity: 0,
        drag: 0,
        shrink: true,
        bounce: false,
        spin: 0,
      });
      _m.makeScale(0, 0, 0);
      this.inst.setMatrixAt(i, _m);
    }
    scene.add(this.inst);

    // smoke sprites
    const smokeTex = makeSoftParticle();
    const smokeCount = quality === 'low' ? 40 : 90;
    for (let i = 0; i < smokeCount; i++) {
      const sm = new THREE.SpriteMaterial({
        map: smokeTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: 0x888888,
      });
      const sp = new THREE.Sprite(sm);
      sp.visible = false;
      scene.add(sp);
      this.smokeSprites.push(sp);
      this.smoke.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        size: 1,
        color: new THREE.Color(),
        gravity: 0,
        drag: 0,
        shrink: false,
        bounce: false,
        spin: 0,
      });
    }

    // tracers
    this.tracerGeo = new THREE.BoxGeometry(1, 1, 1);
    this.tracerGeo.translate(0, 0, 0.5);
    this.tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffc36b,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.tracers.push({ mesh, life: 0, maxLife: 0.08 });
    }

    // muzzle flash
    const flashMat = new THREE.SpriteMaterial({
      map: makeFlash(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    this.flashSprite = new THREE.Sprite(flashMat);
    this.flashSprite.visible = false;
    this.flashSprite.renderOrder = 999;
    scene.add(this.flashSprite);
    this.flashLight = new THREE.PointLight(0xffa040, 0, 25, 2);
    this.flashLight.visible = false;
    scene.add(this.flashLight);

    // dynamic light pool
    const lightCount = quality === 'low' ? 2 : 4;
    for (let i = 0; i < lightCount; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 30, 2);
      l.visible = false;
      scene.add(l);
      this.lights.push({ light: l, life: 0, maxLife: 1, intensity: 0 });
    }
  }

  // ---------- spawning ----------
  spawn(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: THREE.ColorRepresentation,
    opts: { life?: number; size?: number; gravity?: number; drag?: number; shrink?: boolean; bounce?: boolean; spin?: number } = {},
  ) {
    const p = this.particles[this.nextP];
    this.nextP = (this.nextP + 1) % this.maxParticles;
    p.alive = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.maxLife = opts.life ?? 0.6;
    p.life = p.maxLife;
    p.size = opts.size ?? 0.12;
    p.color.set(color);
    p.gravity = opts.gravity ?? 60;
    p.drag = opts.drag ?? 1.5;
    p.shrink = opts.shrink ?? true;
    p.bounce = opts.bounce ?? false;
    p.spin = opts.spin ?? Math.random() * 10;
  }

  smokePuff(pos: THREE.Vector3, size = 1.5, color: THREE.ColorRepresentation = 0x666666, life = 1.2, vel?: THREE.Vector3) {
    const p = this.smoke[this.nextS];
    const sp = this.smokeSprites[this.nextS];
    this.nextS = (this.nextS + 1) % this.smoke.length;
    p.alive = true;
    p.pos.copy(pos);
    p.vel.set((Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2);
    if (vel) p.vel.add(vel);
    p.maxLife = life;
    p.life = life;
    p.size = size;
    p.spin = (Math.random() - 0.5) * 2;
    (sp.material as THREE.SpriteMaterial).color.set(color);
    (sp.material as THREE.SpriteMaterial).rotation = Math.random() * Math.PI * 2;
    sp.visible = true;
  }

  sparks(pos: THREE.Vector3, normal: THREE.Vector3, count = 10, color: THREE.ColorRepresentation = 0xffb347, speed = 18) {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(0.7)
        .add(normal)
        .normalize()
        .multiplyScalar(speed * (0.3 + Math.random()));
      this.spawn(pos, v, color, {
        life: 0.25 + Math.random() * 0.4,
        size: 0.05 + Math.random() * 0.08,
        gravity: 50,
        drag: 2,
        bounce: true,
      });
    }
  }

  debris(pos: THREE.Vector3, count: number, colors: THREE.ColorRepresentation[], speed = 14, size = 0.25) {
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5)
        .normalize()
        .multiplyScalar(speed * (0.4 + Math.random()));
      this.spawn(pos, v, colors[Math.floor(Math.random() * colors.length)], {
        life: 0.8 + Math.random() * 1.2,
        size: size * (0.5 + Math.random()),
        gravity: 80,
        drag: 0.8,
        bounce: true,
        shrink: false,
      });
    }
  }

  explosion(pos: THREE.Vector3, color: THREE.ColorRepresentation, radius = 2, big = false) {
    this.sparks(pos, new THREE.Vector3(0, 1, 0), big ? 40 : 22, color, big ? 30 : 20);
    this.sparks(pos, new THREE.Vector3(0, 1, 0), big ? 16 : 8, 0xffffff, big ? 22 : 14);
    for (let i = 0; i < (big ? 6 : 3); i++) {
      const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius, Math.random() * radius * 0.5, (Math.random() - 0.5) * radius));
      this.smokePuff(p, radius * (0.8 + Math.random() * 0.6), 0x555555, 1.2 + Math.random() * 0.8);
    }
    this.smokePuff(pos, radius * 1.4, color, 0.25);
    this.light(pos, color, big ? 400 : 180, big ? 0.5 : 0.3);
  }

  light(pos: THREE.Vector3, color: THREE.ColorRepresentation, intensity: number, life: number) {
    let slot = this.lights.find((l) => l.life <= 0);
    if (!slot) {
      slot = this.lights.reduce((a, b) => (a.life < b.life ? a : b));
    }
    slot.light.position.copy(pos);
    slot.light.color.set(color);
    slot.light.visible = true;
    slot.intensity = intensity;
    slot.life = life;
    slot.maxLife = life;
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation = 0xffc36b, thickness = 0.05) {
    let t = this.tracers.find((x) => x.life <= 0);
    if (!t) t = this.tracers[0];
    const len = from.distanceTo(to);
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(thickness, thickness, len);
    t.mesh.visible = true;
    (t.mesh.material as THREE.MeshBasicMaterial).color.set(color);
    (t.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
    t.maxLife = 0.07;
    t.life = t.maxLife;
  }

  muzzleFlash(worldPos: THREE.Vector3) {
    this.flashSprite.position.copy(worldPos);
    this.flashSprite.scale.setScalar(0.5 + Math.random() * 0.4);
    (this.flashSprite.material as THREE.SpriteMaterial).rotation = Math.random() * Math.PI * 2;
    this.flashSprite.visible = true;
    this.flashTime = 0.045;
    this.flashLight.position.copy(worldPos);
    this.flashLight.visible = true;
    this.flashLight.intensity = 90;
  }

  addTrauma(t: number) {
    this.trauma = Math.min(1, this.trauma + t);
  }

  // ---------- update ----------
  update(dt: number) {
    // particles
    const inst = this.inst;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        _m.makeScale(0, 0, 0);
        inst.setMatrixAt(i, _m);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      const dragF = Math.max(0, 1 - p.drag * dt);
      p.vel.multiplyScalar(dragF);
      p.pos.addScaledVector(p.vel, dt);
      if (p.bounce && p.pos.y < 0.02) {
        p.pos.y = 0.02;
        p.vel.y = -p.vel.y * 0.4;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      const t = p.life / p.maxLife;
      const s = p.shrink ? p.size * Math.min(1, t * 2) : p.size;
      _e.set(p.spin * p.life, p.spin * 0.7 * p.life, 0);
      _q.setFromEuler(_e);
      _s.set(s, s, s);
      _m.compose(p.pos, _q, _s);
      inst.setMatrixAt(i, _m);
      if (p.shrink) {
        // fade color to darker towards end of life for hot sparks
        const c = p.color;
        inst.setColorAt(i, _tmpColor.copy(c).multiplyScalar(0.4 + 0.6 * t));
      } else {
        inst.setColorAt(i, p.color);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;

    // smoke
    for (let i = 0; i < this.smoke.length; i++) {
      const p = this.smoke[i];
      if (!p.alive) continue;
      const sp = this.smokeSprites[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        sp.visible = false;
        continue;
      }
      p.vel.multiplyScalar(Math.max(0, 1 - 1.5 * dt));
      p.pos.addScaledVector(p.vel, dt);
      const t = 1 - p.life / p.maxLife;
      const scale = p.size * (0.5 + t * 1.2);
      sp.position.copy(p.pos);
      sp.scale.set(scale, scale, 1);
      const m = sp.material as THREE.SpriteMaterial;
      m.opacity = Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.5;
      m.rotation += p.spin * dt;
    }

    // tracers
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const m = t.mesh.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(0, t.life / t.maxLife) * 0.9;
      if (t.life <= 0) t.mesh.visible = false;
    }

    // muzzle flash
    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flashLight.intensity *= Math.pow(0.001, dt * 8);
      if (this.flashTime <= 0) {
        this.flashSprite.visible = false;
        this.flashLight.visible = false;
      }
    }

    // lights
    for (const l of this.lights) {
      if (l.life <= 0) continue;
      l.life -= dt;
      const t = Math.max(0, l.life / l.maxLife);
      l.light.intensity = l.intensity * t * t;
      if (l.life <= 0) l.light.visible = false;
    }

    // shake
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.shakeT += dt * 30;
    const s = this.trauma * this.trauma;
    this.shakeOffset.set(noise(this.shakeT, 1) * 0.12 * s, noise(this.shakeT, 2) * 0.12 * s, 0);
    this.shakeRot.set(noise(this.shakeT, 3) * 0.035 * s, noise(this.shakeT, 4) * 0.035 * s, noise(this.shakeT, 5) * 0.03 * s);
  }
}

const _tmpColor = new THREE.Color();

function noise(t: number, seed: number) {
  return Math.sin(t * 1.3 + seed * 17.7) * 0.5 + Math.sin(t * 2.7 + seed * 5.1) * 0.35 + Math.sin(t * 5.3 + seed * 31.3) * 0.15;
}
