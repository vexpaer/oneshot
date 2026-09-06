import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CollisionWorld, raySphere } from './physics';
import { Effects } from './effects';
import { buildWorld, WorldRefs } from './world';
import { Enemy, EnemyKind, BoltPool, EnemyCtx } from './enemies';
import { audio } from './audio';
import { store, GamePhase, HudState, Quality, Settings } from './store';
import { applyUpgrades, PlayerStats, rollUpgrades } from './upgrades';
import { makeSoftParticle } from './textures';

const PLAYER = { hw: 0.55, h: 2.6, eye: 2.3, step: 1.0, speed: 15, jump: 30, gravity: 80 };

interface Pickup {
  group: THREE.Group;
  type: 'health' | 'ammo';
  pos: THREE.Vector3;
  life: number;
  phase: number;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _n = new THREE.Vector3();
const moveOut = { grounded: false, blocked: false, hitCeiling: false };

export class Game {
  canvas: HTMLCanvasElement;
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera!: THREE.PerspectiveCamera;
  composer: EffectComposer | null = null;
  bloom: UnrealBloomPass | null = null;
  bokeh: BokehPass | null = null;
  col = new CollisionWorld();
  fx!: Effects;
  world!: WorldRefs;
  bolts!: BoltPool;
  enemies: Enemy[] = [];
  pickups: Pickup[] = [];

  phase: GamePhase = 'loading';
  settings: Settings = store.snapshot.settings;

  // input
  keys: Record<string, boolean> = {};
  mouseDown = false;
  mouseDX = 0;
  mouseDY = 0;

  // player
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  grounded = false;
  wasGrounded = false;
  coyote = 0;
  jumpBuffer = 0;
  dashTimer = 0;
  dashCd = 0;
  dashDir = new THREE.Vector3();
  invuln = 0;
  bobPhase = 0;
  bobAmt = 0;
  landDip = 0;
  camKick = 0;
  fovBoost = 0;
  hp = 100;
  stats: PlayerStats = applyUpgrades({});
  owned: Record<string, number> = {};
  sinceDamage = 0;
  deadT = 0;

  // weapon
  mag = 18;
  reserve = 90;
  fireTimer = 0;
  reloadT = -1;
  reloadStage = 0;
  bloomSpread = 0;
  viewmodel = new THREE.Group();
  muzzle = new THREE.Object3D();
  recoilPos = new THREE.Vector3();
  recoilRot = new THREE.Vector3();
  swayX = 0;
  swayY = 0;
  cellMat!: THREE.MeshStandardMaterial;

  // waves
  wave = 0;
  spawnQueue: EnemyKind[] = [];
  spawnTimer = 0;
  waveClearT = -1;
  score = 0;
  combo = 0;
  comboT = 0;
  kills = 0;
  shotsFired = 0;
  shotsHit = 0;
  startTime = 0;
  playTime = 0;

  hud: HudState = { ...store.snapshot.hud };
  private hudTimer = 0;
  private lastT = 0;
  private time = 0;
  private raf = 0;
  private steamT = 0;
  private titleAngle = 0;
  private focusDist = 20;
  private dust!: THREE.Points;
  private dustVel: Float32Array | null = null;
  private fpsAcc = 0;
  private fpsN = 0;
  private envTex: THREE.Texture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  // =====================================================================
  // INIT
  // =====================================================================
  async init() {
    const q = this.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q === 'low', powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = q !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, 1, 0.05, 600);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.background = new THREE.Color(0x07080c);
    this.scene.fog = new THREE.FogExp2(0x0a0b12, 0.0032);

    store.set({ loadProgress: 0.02, loadStage: 'Initializing renderer' });

    // environment reflections
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.22;
    pmrem.dispose();

    this.world = await buildWorld(this.scene, this.col, q, (p, stage) => {
      store.set({ loadProgress: 0.05 + p * 0.8, loadStage: stage });
    });

    this.fx = new Effects(this.scene, q);
    this.bolts = new BoltPool(this.scene);
    this.buildViewmodel();
    this.buildDust();
    this.setupPost();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());

    store.set({ loadProgress: 0.9, loadStage: 'Compiling shaders' });
    this.pos.copy(this.world.playerSpawn);
    this.updateCamera(0);
    try {
      await this.renderer.compileAsync(this.scene, this.camera);
    } catch {
      /* ignore */
    }
    store.set({ loadProgress: 1, loadStage: 'Ready' });
    await new Promise((r) => setTimeout(r, 300));
    this.setPhase('title');
    this.lastT = performance.now();
    this.loop();
  }

  private setupPost() {
    const q = this.settings.quality;
    if (q === 'low') {
      this.composer = null;
      return;
    }
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: q === 'high' ? 4 : 2,
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bokeh = new BokehPass(this.scene, this.camera, { focus: 20, aperture: 0.00009, maxblur: 0.0065 });
    this.bokeh.enabled = q === 'high';
    this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.42, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  private buildViewmodel() {
    const vm = this.viewmodel;
    const gun = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.35, metalness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x121317, roughness: 0.5, metalness: 0.6 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xd9541e, roughness: 0.4, metalness: 0.3 });
    this.cellMat = new THREE.MeshStandardMaterial({ color: 0x000, emissive: 0xff8a2a, emissiveIntensity: 2.5 });
    const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      vm.add(mesh);
      return mesh;
    };
    add(new RoundedBoxGeometry(0.24, 0.28, 0.85, 2, 0.04), gun, 0, 0, 0);
    add(new RoundedBoxGeometry(0.12, 0.06, 0.6, 1, 0.02), dark, 0, 0.17, -0.05);
    add(new THREE.CylinderGeometry(0.06, 0.07, 0.55, 16), dark, 0, 0.03, -0.66).rotation.x = Math.PI / 2;
    add(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 16), orange, 0, 0.03, -0.9).rotation.x = Math.PI / 2;
    add(new RoundedBoxGeometry(0.18, 0.34, 0.16, 1, 0.03), dark, 0, -0.28, 0.22).rotation.x = 0.25;
    add(new THREE.BoxGeometry(0.26, 0.08, 0.3), this.cellMat, 0, -0.05, 0.1);
    add(new THREE.BoxGeometry(0.05, 0.05, 0.5), orange, 0.13, 0.06, -0.2);
    add(new THREE.BoxGeometry(0.05, 0.05, 0.5), orange, -0.13, 0.06, -0.2);
    this.muzzle.position.set(0, 0.03, -0.98);
    vm.add(this.muzzle);
    vm.position.set(0.42, -0.4, -0.8);
    this.camera.add(vm);
  }

  private buildDust() {
    const n = this.settings.quality === 'low' ? 150 : 400;
    const pos = new Float32Array(n * 3);
    this.dustVel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -40 + Math.random() * 90;
      pos[i * 3 + 1] = Math.random() * 40;
      pos[i * 3 + 2] = -34 + Math.random() * 70;
      this.dustVel[i * 3] = (Math.random() - 0.5) * 0.6;
      this.dustVel[i * 3 + 1] = (Math.random() - 0.5) * 0.4;
      this.dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.22,
      map: makeSoftParticle(),
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffd9a8,
      sizeAttenuation: true,
    });
    this.dust = new THREE.Points(geo, mat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  // =====================================================================
  // INPUT
  // =====================================================================
  private bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys[e.code] = true;
      if (this.phase === 'playing') {
        if (e.code === 'Space') {
          this.jumpBuffer = 0.14;
          e.preventDefault();
        }
        if (e.code === 'KeyR') this.startReload();
        if (e.code === 'KeyE' || e.code === 'KeyQ') this.tryDash();
        if (e.code === 'KeyP') this.pause();
      } else if (this.phase === 'paused' && e.code === 'KeyP') {
        this.resume();
      }
      if (e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
    document.addEventListener('mousedown', (e) => {
      if (this.phase !== 'playing') return;
      if (document.pointerLockElement !== this.canvas && !store.snapshot.pointerLockFailed) {
        this.lockPointer();
        return;
      }
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.tryDash();
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.phase !== 'playing') return;
      if (document.pointerLockElement !== this.canvas && !store.snapshot.pointerLockFailed) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) {
        this.lockAttempts = 0;
        this.pointerWasLocked = true;
        if (store.snapshot.pointerLockFailed) store.set({ pointerLockFailed: false });
        return;
      }
      if (this.phase === 'playing' && this.pointerWasLocked) {
        this.pointerWasLocked = false;
        this.pause();
      }
    });
    document.addEventListener('pointerlockerror', () => this.onLockError());
    window.addEventListener('blur', () => {
      this.keys = {};
      this.mouseDown = false;
      if (this.phase === 'playing') this.pause();
    });
  }

  private lockRetry = 0;
  private lockAttempts = 0;
  private pointerWasLocked = false;

  private lockPointer() {
    if (document.pointerLockElement === this.canvas) return;
    try {
      const req = this.canvas.requestPointerLock as unknown as (opts?: { unadjustedMovement: boolean }) => Promise<void> | undefined;
      const p = req.call(this.canvas, { unadjustedMovement: true });
      if (p && typeof p.catch === 'function') p.catch(() => this.onLockError());
    } catch {
      try {
        this.canvas.requestPointerLock();
      } catch {
        this.onLockError();
      }
    }
  }

  private onLockError() {
    if (this.lockRetry) return;
    // Browsers enforce a short cooldown after Esc exits pointer lock; retry shortly.
    this.lockRetry = window.setTimeout(() => {
      this.lockRetry = 0;
      if (this.phase === 'playing' && document.pointerLockElement !== this.canvas) {
        this.lockAttempts++;
        if (this.lockAttempts > 2) {
          store.set({ pointerLockFailed: true });
          return;
        }
        this.lockPointer();
      }
    }, 1100);
  }

  // =====================================================================
  // STATE
  // =====================================================================
  setPhase(p: GamePhase) {
    this.phase = p;
    store.set({ phase: p });
  }

  applySettings(s: Settings) {
    const prevQ = this.settings.quality;
    this.settings = s;
    audio.setVolumes({ master: s.master, sfx: s.sfx, music: s.music });
    if (this.camera) this.camera.fov = s.fov;
    if (prevQ !== s.quality) this.applyQuality(s.quality);
  }

  private applyQuality(q: Quality) {
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 1) : q === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
    const shadows = q !== 'low';
    this.renderer.shadowMap.enabled = shadows;
    this.world.lamp.castShadow = shadows;
    if (shadows) {
      const size = q === 'high' ? 2048 : 1024;
      this.world.lamp.shadow.mapSize.set(size, size);
      if (this.world.lamp.shadow.map) {
        this.world.lamp.shadow.map.dispose();
        this.world.lamp.shadow.map = null;
      }
    }
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) {
        if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
        else m.needsUpdate = true;
      }
    });
    if (q === 'low') {
      this.composer = null;
    } else {
      if (!this.composer) this.setupPost();
      if (this.bokeh) this.bokeh.enabled = q === 'high';
    }
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const q = this.settings.quality;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'low' ? Math.min(dpr, 1) : q === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.composer.setSize(size.x, size.y);
    }
  }

  start() {
    audio.init();
    audio.setVolumes({ master: this.settings.master, sfx: this.settings.sfx, music: this.settings.music });
    this.resetRun();
    this.setPhase('playing');
    this.lockPointer();
    audio.startMusic();
    audio.setIntensity(0.2);
    this.startWave(1);
  }

  private resetRun() {
    this.enemies.forEach((e) => e.dispose(this.scene));
    this.enemies = [];
    this.pickups.forEach((p) => this.scene.remove(p.group));
    this.pickups = [];
    this.bolts.clear();
    this.owned = {};
    this.stats = applyUpgrades({});
    this.hp = this.stats.maxHp;
    this.mag = this.stats.magSize;
    this.reserve = this.stats.magSize * 5;
    this.reloadT = -1;
    this.pos.copy(this.world.playerSpawn);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.dashCd = 0;
    this.dashTimer = 0;
    this.score = 0;
    this.combo = 0;
    this.kills = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.wave = 0;
    this.spawnQueue = [];
    this.waveClearT = -1;
    this.deadT = 0;
    this.playTime = 0;
    this.camera.rotation.z = 0;
    this.fx.trauma = 0;
    store.set({ ownedUpgrades: {} });
  }

  pause() {
    if (this.phase !== 'playing') return;
    this.setPhase('paused');
    this.mouseDown = false;
    this.keys = {};
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    audio.suspend();
  }

  resume() {
    if (this.phase !== 'paused') return;
    audio.resume();
    this.setPhase('playing');
    this.lockPointer();
    this.lastT = performance.now();
  }

  quitToTitle() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    audio.resume();
    audio.stopMusic();
    this.resetRun();
    this.setPhase('title');
  }

  chooseUpgrade(id: string) {
    this.owned[id] = (this.owned[id] || 0) + 1;
    const oldMax = this.stats.maxHp;
    const oldMag = this.stats.magSize;
    this.stats = applyUpgrades(this.owned);
    if (this.stats.maxHp > oldMax) this.hp = Math.min(this.stats.maxHp, this.hp + (this.stats.maxHp - oldMax));
    if (this.stats.magSize > oldMag) this.mag += this.stats.magSize - oldMag;
    store.set({ ownedUpgrades: { ...this.owned } });
    audio.upgrade();
    // between-wave resupply
    this.reserve += this.stats.magSize * 2;
    this.hp = Math.min(this.stats.maxHp, this.hp + 20);
    this.setPhase('playing');
    this.lockPointer();
    this.lastT = performance.now();
    this.startWave(this.wave + 1);
  }

  private die() {
    this.setPhase('dead');
    this.deadT = 0;
    this.mouseDown = false;
    audio.death();
    audio.stopMusic();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    store.setHighScore(this.score);
    store.set({
      finalStats: {
        score: this.score,
        wave: this.wave,
        kills: this.kills,
        accuracy: this.shotsFired ? this.shotsHit / this.shotsFired : 0,
        time: this.playTime,
      },
    });
    this.fx.addTrauma(0.8);
  }

  // =====================================================================
  // WAVES
  // =====================================================================
  private startWave(n: number) {
    this.wave = n;
    const total = Math.min(44, 6 + n * 3);
    const q: EnemyKind[] = [];
    const turrets = n >= 3 ? Math.min(4, 1 + Math.floor((n - 3) / 2)) : 0;
    const drones = n >= 2 ? Math.round(total * Math.min(0.28, 0.1 + n * 0.03)) : 0;
    const spiders = Math.round((total - drones) * 0.45);
    const bots = total - drones - spiders;
    for (let i = 0; i < bots; i++) q.push('bot');
    for (let i = 0; i < spiders; i++) q.push('spider');
    for (let i = 0; i < drones; i++) q.push('drone');
    // shuffle
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    // first few should be ground units for readable openings
    q.sort((a, b) => (a === 'drone' ? 1 : 0) - (b === 'drone' ? 1 : 0) || 0);
    if (n > 2) {
      for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
    }
    for (let i = 0; i < turrets; i++) q.splice(Math.min(q.length, 2 + i * 6), 0, 'turret');
    this.spawnQueue = q;
    this.spawnTimer = 1.2;
    this.waveClearT = -1;
    this.banner(`WAVE ${n}`);
    audio.waveStart();
    audio.setIntensity(Math.min(1, 0.25 + n * 0.08));
    // initial burst
    for (let i = 0; i < Math.min(3, q.length); i++) this.spawnNext();
  }

  private spawnNext() {
    const kind = this.spawnQueue.shift();
    if (!kind) return;
    let pos: THREE.Vector3;
    if (kind === 'drone') {
      pos = this.pickSpawn(this.world.airSpawns, 20).clone();
      pos.x += (Math.random() - 0.5) * 6;
      pos.z += (Math.random() - 0.5) * 6;
    } else if (kind === 'turret') {
      const free = this.world.turretSpots.filter(
        (s) => !this.enemies.some((e) => e.kind === 'turret' && !e.dead && e.pos.distanceTo(s) < 3) && s.distanceTo(this.pos) > 18,
      );
      pos = (free.length ? free[Math.floor(Math.random() * free.length)] : this.world.turretSpots[0]).clone();
    } else {
      pos = this.pickSpawn(this.world.groundSpawns, 28).clone();
      pos.x += (Math.random() - 0.5) * 4;
      pos.z += (Math.random() - 0.5) * 4;
    }
    const e = new Enemy(kind, pos, this.wave);
    this.scene.add(e.group);
    this.enemies.push(e);
    // spawn fx
    const c = pos.clone().setY(pos.y + 1);
    this.fx.light(c, e.color, 120, 0.5);
    this.fx.sparks(c, new THREE.Vector3(0, 1, 0), 14, e.color, 12);
    this.fx.smokePuff(c, 2, 0x445, 0.8);
    audio.spawn();
  }

  private pickSpawn(list: THREE.Vector3[], minDist: number) {
    const far = list.filter((p) => p.distanceTo(this.pos) > minDist);
    const arr = far.length ? far : list;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private banner(text: string) {
    this.hud.banner = text;
    this.hud.bannerTime = performance.now();
  }

  // =====================================================================
  // COMBAT
  // =====================================================================
  private startReload() {
    if (this.reloadT >= 0 || this.mag >= this.stats.magSize || this.reserve <= 0) return;
    this.reloadT = 0;
    this.reloadStage = 0;
    audio.reloadStart();
  }

  private tryDash() {
    if (this.dashCd > 0 || this.dashTimer > 0 || this.phase !== 'playing') return;
    const dir = this.inputDir();
    if (dir.lengthSq() < 0.01) dir.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.dashDir.copy(dir.normalize());
    this.dashTimer = 0.17;
    this.dashCd = this.stats.dashCd;
    this.invuln = 0.25;
    this.fovBoost = 10;
    this.fx.addTrauma(0.15);
    audio.dash();
    for (let i = 0; i < 8; i++) {
      _v.copy(this.pos).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.2 + Math.random() * 1.5, (Math.random() - 0.5) * 1.2));
      this.fx.spawn(_v, _v2.copy(this.dashDir).multiplyScalar(-8), 0x9fd3ff, { life: 0.35, size: 0.1, gravity: 0, drag: 3 });
    }
  }

  private inputDir() {
    let fx = 0;
    let fz = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) fz -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) fz += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) fx -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) fx += 1;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    return new THREE.Vector3(fx * cos + fz * sin, 0, -fx * sin + fz * cos);
  }

  private fire() {
    this.mag--;
    this.fireTimer = 1 / this.stats.fireRate;
    this.shotsFired++;
    this.camera.updateMatrixWorld(true);
    const muzzleW = this.muzzle.getWorldPosition(new THREE.Vector3());
    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const fwd = this.camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3().crossVectors(fwd, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const pellets = this.stats.pellets;
    const baseSpread = (0.004 + this.bloomSpread * 0.035) * this.stats.spread;
    let anyHit = false;
    let anyKill = false;
    for (let p = 0; p < pellets; p++) {
      const spread = baseSpread + (pellets > 1 ? 0.02 : 0);
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const worldDist = this.col.raycast(origin, dir, 400, _n);
      const hitNormal = _n.clone();
      // enemies
      const hits: { e: Enemy; t: number }[] = [];
      for (const e of this.enemies) {
        if (e.dead) continue;
        const t = raySphere(origin, dir, e.center, e.radius);
        if (t > 0 && t < worldDist) hits.push({ e, t });
      }
      hits.sort((a, b) => a.t - b.t);
      const maxHits = 1 + this.stats.pierce;
      let endT = worldDist;
      let count = 0;
      for (const h of hits) {
        if (count >= maxHits) break;
        count++;
        const crit = Math.random() < this.stats.crit;
        const dmg = this.stats.damage * (crit ? 2.5 : 1) * (count > 1 ? 0.7 : 1);
        const hp = origin.clone().addScaledVector(dir, h.t);
        const killed = h.e.takeDamage(dmg, hp, this.fx);
        anyHit = true;
        if (crit) {
          audio.crit();
          this.fx.sparks(hp, dir.clone().negate(), 10, 0xffffff, 22);
        }
        if (killed) {
          anyKill = true;
          this.onKill(h.e);
        }
        endT = h.t;
      }
      // If the shot still has penetration left, it continues to the world surface.
      const reachedWorld = count < maxHits;
      if (reachedWorld) endT = worldDist;
      const end = origin.clone().addScaledVector(dir, Math.min(endT, 400));
      this.fx.tracer(muzzleW, end, 0xffc36b, 0.045);
      if (reachedWorld) {
        if (worldDist < 400) {
          this.fx.sparks(end, hitNormal, 5, 0xffd08a, 12);
          this.fx.debris(end, 2, [0x8a7a66, 0x5a4a3a], 6, 0.1);
          if (Math.random() < 0.5) this.fx.smokePuff(end, 0.5, 0x777777, 0.5);
        }
      }
    }
    if (anyHit) {
      this.shotsHit++;
      this.hud.hitMarker = performance.now();
      audio.hit();
    }
    if (anyKill) this.hud.killMarker = performance.now();
    // feedback
    this.fx.muzzleFlash(muzzleW);
    this.recoilPos.z += 0.12;
    this.recoilPos.y += 0.02;
    this.recoilRot.x += 0.09;
    this.recoilRot.z += (Math.random() - 0.5) * 0.06;
    this.camKick += 0.011 + Math.random() * 0.004;
    this.fx.addTrauma(0.14);
    this.bloomSpread = Math.min(1, this.bloomSpread + 0.18);
    audio.shoot();
    if (this.mag <= 0) this.startReload();
  }

  private onKill(e: Enemy) {
    this.kills++;
    const c = e.center.clone();
    const big = e.kind === 'turret';
    this.fx.explosion(c, e.color, big ? 3.5 : 1.8, big);
    this.fx.debris(c, big ? 24 : 12, [0x3a3f4a, 0x1a1c20, e.color], big ? 20 : 14, big ? 0.35 : 0.22);
    audio.kill(big);
    this.fx.addTrauma(big ? 0.45 : 0.2);
    // combo & score
    if (this.comboT > 0) this.combo++;
    else this.combo = 1;
    this.comboT = 3;
    const gained = Math.round(e.scoreValue * (1 + (this.combo - 1) * 0.15) * (1 + (this.wave - 1) * 0.05));
    this.score += gained;
    if (this.stats.lifesteal) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.lifesteal);
    // drops
    const roll = Math.random();
    const hpRatio = this.hp / this.stats.maxHp;
    const ammoStarved = this.reserve + this.mag < this.stats.magSize * 1.5;
    const dropChance = big ? 0.9 : ammoStarved ? 0.55 : 0.22;
    if (roll < dropChance) {
      const type: Pickup['type'] = ammoStarved ? (Math.random() < 0.8 ? 'ammo' : 'health') : Math.random() < (hpRatio < 0.5 ? 0.6 : 0.35) ? 'health' : 'ammo';
      this.spawnPickup(type, c);
    }
    e.dispose(this.scene);
  }

  private spawnPickup(type: Pickup['type'], at: THREE.Vector3) {
    const g = new THREE.Group();
    const color = type === 'health' ? 0x4dff88 : 0xffa53a;
    const mat = new THREE.MeshStandardMaterial({ color: 0x222, emissive: color, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.5 });
    const shell = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.3, metalness: 0.8 });
    if (type === 'health') {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.22), mat);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), mat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 24), shell);
      g.add(a, b, ring);
    } else {
      const box = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.6, 0.5, 1, 0.08), shell);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.52), mat);
      g.add(box, strip);
    }
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    const pos = at.clone();
    pos.y = this.col.groundHeight(pos.x, pos.z, pos.y + 0.5, 0.4) + 0.9;
    g.position.copy(pos);
    this.scene.add(g);
    this.pickups.push({ group: g, type, pos, life: 25, phase: Math.random() * 6 });
  }

  private damagePlayer(amount: number, from: THREE.Vector3) {
    if (this.phase !== 'playing' || this.invuln > 0) return;
    const scaled = amount * (1 + (this.wave - 1) * 0.05);
    this.hp -= scaled;
    this.sinceDamage = 0;
    this.hud.damageFlash = performance.now();
    this.fx.addTrauma(Math.min(0.6, 0.25 + scaled * 0.01));
    audio.hurt();
    // knock camera a bit away from source
    _v.copy(this.pos).sub(from).setY(0).normalize();
    this.vel.addScaledVector(_v, 4);
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  // =====================================================================
  // LOOP
  // =====================================================================
  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (dt > 0.05) dt = 0.05;
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) {
      this.hud.fps = Math.round(this.fpsN / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsN = 0;
    }
    this.update(dt);
    this.render();
  };

  private update(dt: number) {
    this.time += dt;
    for (const a of this.world.animated) a.update(this.time, dt);
    this.updateDust(dt);
    // mug steam
    this.steamT -= dt;
    if (this.steamT <= 0) {
      this.steamT = 0.28;
      _v.copy(this.world.mugTop).add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
      this.fx.smokePuff(_v, 1.6 + Math.random(), 0x8a8a90, 2.4, new THREE.Vector3(0, -1.5, 0));
    }

    if (this.phase === 'title') {
      this.titleAngle += dt;
      const a = Math.sin(this.titleAngle * 0.13) * 1.05;
      const r = 46 + Math.cos(this.titleAngle * 0.09) * 6;
      this.camera.position.set(2 + Math.sin(a) * r, 13 + Math.cos(this.titleAngle * 0.11) * 4, 6 + Math.cos(a) * r);
      this.camera.lookAt(-2 + Math.sin(this.titleAngle * 0.07) * 8, 5, 0);
      this.viewmodel.visible = false;
      this.fx.update(dt);
      this.focusDist = THREE.MathUtils.lerp(this.focusDist, this.camera.position.distanceTo(new THREE.Vector3(0, 4, 4)), dt * 2);
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 55, dt * 2);
      this.camera.updateProjectionMatrix();
    } else if (this.phase === 'playing') {
      this.viewmodel.visible = true;
      this.playTime += dt;
      this.updatePlayer(dt);
      this.updateWeapon(dt);
      this.updateEnemies(dt);
      this.updatePickups(dt);
      this.updateWaves(dt);
      this.fx.update(dt);
      this.updateCamera(dt);
    } else if (this.phase === 'dead') {
      this.deadT += dt;
      this.fx.update(dt);
      // fall over
      const t = Math.min(1, this.deadT / 1.2);
      const e = 1 - Math.pow(1 - t, 3);
      this.camera.rotation.z = e * 0.9;
      this.camera.position.y = this.pos.y + THREE.MathUtils.lerp(PLAYER.eye, 0.6, e);
      this.viewmodel.visible = false;
      // enemies still idle-animate
      for (const en of this.enemies) if (!en.dead) en.group.position.copy(en.pos);
    } else if (this.phase === 'upgrade' || this.phase === 'paused') {
      // frozen
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 1 / 20;
      this.syncHud();
    }
  }

  private updateDust(dt: number) {
    if (!this.dustVel) return;
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const n = pos.count;
    for (let i = 0; i < n; i++) {
      arr[i * 3] += this.dustVel[i * 3] * dt;
      arr[i * 3 + 1] += this.dustVel[i * 3 + 1] * dt;
      arr[i * 3 + 2] += this.dustVel[i * 3 + 2] * dt;
      if (arr[i * 3 + 1] < 0.2 || arr[i * 3 + 1] > 42) this.dustVel[i * 3 + 1] *= -1;
      if (arr[i * 3] < -40 || arr[i * 3] > 50) this.dustVel[i * 3] *= -1;
      if (arr[i * 3 + 2] < -34 || arr[i * 3 + 2] > 36) this.dustVel[i * 3 + 2] *= -1;
    }
    pos.needsUpdate = true;
  }

  private updatePlayer(dt: number) {
    // look
    const sens = 0.0021 * this.settings.sensitivity;
    this.yaw -= this.mouseDX * sens;
    this.pitch -= this.mouseDY * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    this.swayX = THREE.MathUtils.lerp(this.swayX, THREE.MathUtils.clamp(this.mouseDX * 0.0015, -0.08, 0.08), Math.min(1, dt * 12));
    this.swayY = THREE.MathUtils.lerp(this.swayY, THREE.MathUtils.clamp(this.mouseDY * 0.0015, -0.08, 0.08), Math.min(1, dt * 12));
    this.mouseDX = 0;
    this.mouseDY = 0;

    // timers
    this.coyote = this.grounded ? 0.12 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.sinceDamage += dt;
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    if (this.stats.regen && this.sinceDamage > 4) this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.regen * dt);

    const dir = this.inputDir();
    const moving = dir.lengthSq() > 0.01;
    if (moving) dir.normalize();
    const sprinting = (this.keys.ShiftLeft || this.keys.ShiftRight) && moving && dir.z * -Math.cos(this.yaw) + dir.x * -Math.sin(this.yaw) > 0.3;
    const targetSpeed = PLAYER.speed * this.stats.speedMul * (sprinting ? 1.5 : 1);

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vel.x = this.dashDir.x * 62;
      this.vel.z = this.dashDir.z * 62;
      if (this.vel.y < 0) this.vel.y *= 0.6;
      this.vel.y -= PLAYER.gravity * 0.3 * dt;
    } else {
      const accel = this.grounded ? 14 : 5;
      const tx = dir.x * targetSpeed;
      const tz = dir.z * targetSpeed;
      if (moving || this.grounded) {
        this.vel.x += (tx - this.vel.x) * Math.min(1, accel * dt);
        this.vel.z += (tz - this.vel.z) * Math.min(1, accel * dt);
      } else {
        this.vel.x *= Math.max(0, 1 - 0.4 * dt);
        this.vel.z *= Math.max(0, 1 - 0.4 * dt);
      }
      this.vel.y -= PLAYER.gravity * dt;
    }
    // jump
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0)) {
      this.vel.y = PLAYER.jump;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.grounded = false;
      audio.jump();
    }
    if (!this.keys.Space && this.vel.y > 8 && !this.grounded) this.vel.y -= PLAYER.gravity * 0.8 * dt; // variable jump height

    const prevVy = this.vel.y;
    this.wasGrounded = this.grounded;
    this.col.moveBody(this.pos, this.vel, dt, PLAYER.hw, PLAYER.h, PLAYER.step, moveOut);
    this.grounded = moveOut.grounded;
    if (moveOut.hitCeiling) this.vel.y = 0;
    if (this.grounded && !this.wasGrounded) {
      this.landDip = Math.min(0.45, Math.abs(prevVy) * 0.011);
      if (Math.abs(prevVy) > 12) {
        audio.land();
        this.fx.addTrauma(Math.min(0.2, Math.abs(prevVy) * 0.004));
      }
    }
    // bob & footsteps
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    const ratio = Math.min(1.4, hspeed / PLAYER.speed);
    if (this.grounded && hspeed > 2) {
      const prev = this.bobPhase;
      this.bobPhase += dt * (7 + ratio * 4);
      if (Math.floor(prev / Math.PI) !== Math.floor(this.bobPhase / Math.PI)) audio.step();
    }
    this.bobAmt = THREE.MathUtils.lerp(this.bobAmt, this.grounded && hspeed > 2 ? ratio : 0, Math.min(1, dt * 8));
    this.landDip = THREE.MathUtils.lerp(this.landDip, 0, Math.min(1, dt * 7));
    const fovTarget = this.settings.fov + (sprinting ? 6 : 0);
    this.fovBoost = THREE.MathUtils.lerp(this.fovBoost, 0, Math.min(1, dt * 6));
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fovTarget + this.fovBoost, Math.min(1, dt * 8));
    this.camera.updateProjectionMatrix();
  }

  private ammoTrickle = 0;

  private updateWeapon(dt: number) {
    this.fireTimer -= dt;
    this.bloomSpread = Math.max(0, this.bloomSpread - dt * 1.3);
    // emergency reactor: slowly regenerate reserve ammo when running dry
    if (this.reserve < this.stats.magSize) {
      this.ammoTrickle += dt;
      if (this.ammoTrickle > 1.5) {
        this.ammoTrickle = 0;
        this.reserve++;
      }
    }
    // reload
    if (this.reloadT >= 0) {
      this.reloadT += dt / this.stats.reloadTime;
      if (this.reloadStage === 0 && this.reloadT > 0.45) {
        this.reloadStage = 1;
        audio.reloadMid();
      }
      if (this.reloadT >= 1) {
        const need = this.stats.magSize - this.mag;
        const take = Math.min(need, this.reserve);
        this.mag += take;
        this.reserve -= take;
        this.reloadT = -1;
        audio.reloadEnd();
      }
    } else if (this.mouseDown && this.fireTimer <= 0) {
      if (this.mag > 0) this.fire();
      else {
        audio.empty();
        this.startReload();
        this.fireTimer = 0.25;
      }
    }
    // viewmodel dynamics
    const k = Math.min(1, dt * 14);
    this.recoilPos.multiplyScalar(Math.max(0, 1 - dt * 12));
    this.recoilRot.multiplyScalar(Math.max(0, 1 - dt * 11));
    this.camKick *= Math.max(0, 1 - dt * 9);
    const bobX = Math.sin(this.bobPhase) * 0.035 * this.bobAmt;
    const bobY = Math.abs(Math.cos(this.bobPhase)) * 0.025 * this.bobAmt;
    const reloadAnim = this.reloadT >= 0 ? Math.sin(Math.min(1, this.reloadT) * Math.PI) : 0;
    const vm = this.viewmodel;
    vm.position.x = THREE.MathUtils.lerp(vm.position.x, 0.42 + bobX - this.swayX * 0.6 + this.recoilPos.x, k);
    vm.position.y = THREE.MathUtils.lerp(vm.position.y, -0.4 + bobY + this.swayY * 0.5 + this.recoilPos.y - reloadAnim * 0.3 - this.landDip * 0.15, k);
    vm.position.z = THREE.MathUtils.lerp(vm.position.z, -0.8 + this.recoilPos.z, k);
    vm.rotation.x = THREE.MathUtils.lerp(vm.rotation.x, this.recoilRot.x + this.swayY * 0.5 - reloadAnim * 0.7, k);
    vm.rotation.y = THREE.MathUtils.lerp(vm.rotation.y, -this.swayX * 0.7 + this.recoilRot.y, k);
    vm.rotation.z = THREE.MathUtils.lerp(vm.rotation.z, this.recoilRot.z + this.swayX * 0.3 + reloadAnim * 0.4, k);
    const ammoRatio = this.mag / this.stats.magSize;
    this.cellMat.emissiveIntensity = 0.4 + ammoRatio * 2.4;
    this.cellMat.emissive.setHSL(0.08 * ammoRatio, 1, 0.55);
  }

  private updateEnemies(dt: number) {
    const ctx: EnemyCtx = {
      playerPos: this.pos,
      playerEye: _v2.set(this.pos.x, this.pos.y + PLAYER.eye, this.pos.z),
      playerVel: this.vel,
      col: this.col,
      fx: this.fx,
      time: this.time,
      difficulty: this.wave,
      fire: (p, d, s, dmg, c, kind) => {
        this.bolts.fire(p, d, s, dmg, c);
        audio.enemyShoot(kind as 'bot' | 'drone' | 'turret');
      },
      meleePlayer: (dmg, from) => this.damagePlayer(dmg, from),
      enemies: this.enemies,
    };
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.update(dt, ctx);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.bolts.update(dt, this.col, this.fx, this.pos, PLAYER.h, (dmg, from) => this.damagePlayer(dmg, from));
  }

  private updatePickups(dt: number) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      p.phase += dt;
      const dx = this.pos.x - p.pos.x;
      const dz = this.pos.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      // magnet
      if (d < 6 && Math.abs(this.pos.y - p.pos.y) < 4) {
        p.pos.x += (dx / d) * dt * 12;
        p.pos.z += (dz / d) * dt * 12;
        p.pos.y += (this.pos.y + 1.2 - p.pos.y) * dt * 6;
      }
      p.group.position.set(p.pos.x, p.pos.y + Math.sin(p.phase * 3) * 0.15, p.pos.z);
      p.group.rotation.y = p.phase * 2;
      const blink = p.life < 4 ? Math.sin(p.life * 12) > 0 : true;
      p.group.visible = blink;
      if (d < 1.5 && Math.abs(this.pos.y + 1 - p.pos.y) < 2.5) {
        if (p.type === 'health') this.hp = Math.min(this.stats.maxHp, this.hp + 30);
        else this.reserve += this.stats.magSize * 2;
        audio.pickup(p.type === 'health');
        this.fx.sparks(p.group.position, new THREE.Vector3(0, 1, 0), 14, p.type === 'health' ? 0x4dff88 : 0xffa53a, 8);
        this.fx.light(p.group.position, p.type === 'health' ? 0x4dff88 : 0xffa53a, 60, 0.3);
        this.hud.hitMarker = this.hud.hitMarker; // no-op
        this.scene.remove(p.group);
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.life <= 0) {
        this.scene.remove(p.group);
        this.pickups.splice(i, 1);
      }
    }
  }

  private updateWaves(dt: number) {
    if (this.phase !== 'playing') return;
    if (this.spawnQueue.length) {
      const alive = this.enemies.length;
      const maxAlive = Math.min(22, 7 + this.wave * 1.5);
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && alive < maxAlive) {
        this.spawnNext();
        this.spawnTimer = Math.max(0.5, 2.0 - this.wave * 0.11) * (0.7 + Math.random() * 0.6);
      }
    } else if (this.enemies.length === 0) {
      if (this.waveClearT < 0) {
        this.waveClearT = 0;
        this.score += 250 * this.wave;
        this.banner('WAVE CLEARED');
        audio.waveClear();
      } else {
        this.waveClearT += dt;
        if (this.waveClearT > 1.6) {
          this.waveClearT = -1;
          store.set({ upgradeChoices: rollUpgrades(this.owned) });
          this.setPhase('upgrade');
          this.mouseDown = false;
          if (document.pointerLockElement === this.canvas) document.exitPointerLock();
        }
      }
    }
    audio.setIntensity(Math.min(1, 0.2 + this.wave * 0.07 + Math.min(0.3, this.enemies.length * 0.02)));
  }

  private updateCamera(dt: number) {
    const bobY = Math.sin(this.bobPhase * 2) * 0.045 * this.bobAmt;
    this.camera.position.set(this.pos.x, this.pos.y + PLAYER.eye + bobY - this.landDip, this.pos.z);
    this.camera.rotation.set(this.pitch + this.camKick + this.fx.shakeRot.x, this.yaw + this.fx.shakeRot.y, this.fx.shakeRot.z + Math.sin(this.bobPhase) * 0.006 * this.bobAmt);
    // shake offset in camera local space
    _v.copy(this.fx.shakeOffset).applyEuler(this.camera.rotation);
    this.camera.position.add(_v);
    // DOF focus
    if (this.bokeh && this.bokeh.enabled) {
      const fwd = this.camera.getWorldDirection(_v2);
      let d = this.col.raycast(this.camera.position, fwd, 200);
      for (const e of this.enemies) {
        const t = raySphere(this.camera.position, fwd, e.center, e.radius * 2);
        if (t > 0 && t < d) d = t;
      }
      this.focusDist = THREE.MathUtils.lerp(this.focusDist, Math.min(d, 120), Math.min(1, dt * 4));
    }
  }

  private render() {
    if (this.bokeh) {
      const u = this.bokeh.uniforms as unknown as Record<string, { value: number }>;
      u.focus.value = this.focusDist;
    }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  private syncHud() {
    const h = this.hud;
    h.hp = Math.ceil(this.hp);
    h.maxHp = this.stats.maxHp;
    h.mag = this.mag;
    h.magSize = this.stats.magSize;
    h.reserve = this.reserve;
    h.reloading = this.reloadT;
    h.score = this.score;
    h.wave = this.wave;
    h.enemiesLeft = this.enemies.length + this.spawnQueue.length;
    h.combo = this.combo;
    h.dashCd = this.stats.dashCd > 0 ? 1 - this.dashCd / this.stats.dashCd : 1;
    h.lowHp = this.hp / this.stats.maxHp < 0.3;
    store.setHud(h);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
  }
}
