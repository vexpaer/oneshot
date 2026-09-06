import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { buildGroundCanvas, buildTerrainMesh, buildWater, terrainHeight } from "./terrain";
import { buildCampus, CampusWorld, resolveCollision } from "./campus";
import { PLAYER_START, SPAWN_POINTS } from "./layout";
import { Player } from "./player";
import { createProp, PROP_CATALOG, mat, mesh } from "./props";
import { WEAPONS, buildEraserMesh } from "./weapons";
import { Enemy, ENEMY_DEFS, EnemyCtx, separateEnemies } from "./enemies";
import { ParticleSystem } from "./particles";
import { sfx } from "./sfx";

export type Mode = "menu" | "creative" | "combat";

export interface UIState {
  mode: Mode;
  locked: boolean;
  hp: number;
  maxHp: number;
  wave: number;
  enemiesLeft: number;
  kills: number;
  score: number;
  bestScore: number;
  waveCountdown: number;
  bossName: string;
  bossHp: number;
  weapon: number;
  ammo: number;
  ammoMax: number;
  gameOver: boolean;
  propIndex: number;
  propScale: number;
  placed: number;
  fly: boolean;
  msg: string;
  msgT: number;
  dmgT: number;
  hitT: number;
  fps: number;
  posX: number;
  posZ: number;
  yaw: number;
}

interface PlacedProp {
  id: string;
  group: THREE.Group;
}

interface Projectile {
  mesh: THREE.Object3D;
  vel: THREE.Vector3;
  dmg: number;
  from: "player" | "enemy";
  splash: number;
  gravity: number;
  life: number;
  knock: number;
}

interface Pickup {
  mesh: THREE.Group;
  type: "heal" | "ammo";
  t: number;
}

const SAVE_KEY = "hillside-campus-layout-v1";
const BEST_KEY = "hillside-campus-best";

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
  world: CampusWorld;
  terrain: THREE.Mesh;
  water: THREE.Mesh;
  groundCanvas: HTMLCanvasElement;
  sun: THREE.DirectionalLight;
  player: Player;
  particles = new ParticleSystem(900);
  mode: Mode = "menu";
  keys = new Set<string>();
  locked = false;
  private raf = 0;
  private last = performance.now();
  private time = 0;
  private disposed = false;
  private onUI: (s: UIState) => void;
  private uiTimer = 0;
  private fpsAcc = 0;
  private fpsN = 0;
  private fps = 60;
  private msg = "";
  private msgT = 0;
  private dmgT = 0;
  private hitT = 0;
  private shake = 0;
  private raycaster = new THREE.Raycaster();

  // 创造模式
  propsGroup = new THREE.Group();
  placed: PlacedProp[] = [];
  undoStack: PlacedProp[] = [];
  propIndex = 0;
  propScale = 1;
  propRot = 0;
  private ghost: THREE.Group | null = null;
  private ghostId = "";
  private ghostMat = new THREE.MeshStandardMaterial({ color: "#4ade80", transparent: true, opacity: 0.55, depthWrite: false, emissive: "#16a34a", emissiveIntensity: 0.4 });

  // 战斗模式
  enemies: Enemy[] = [];
  enemyGroup = new THREE.Group();
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  wave = 0;
  waveState: "idle" | "spawning" | "active" | "break" = "idle";
  spawnQueue: string[] = [];
  spawnTimer = 0;
  breakTimer = 0;
  kills = 0;
  score = 0;
  bestScore = 0;
  weaponIndex = 0;
  weaponRoot = new THREE.Group();
  weaponModels: THREE.Group[] = [];
  weaponAnim = -1;
  cooldown = 0;
  pendingHit = -1;
  ammo: number[] = [];
  gameOver = false;
  mouseDown = false;
  private enemyCtx: EnemyCtx;

  constructor(container: HTMLElement, onUI: (s: UIState) => void) {
    this.container = container;
    this.onUI = onUI;
    this.bestScore = Number(localStorage.getItem(BEST_KEY) ?? 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.75;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.camera = new THREE.PerspectiveCamera(72, container.clientWidth / container.clientHeight, 0.08, 1200);
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(new THREE.Color("#c9d6e2"), 180, 700);

    // 天空与光照
    const sky = new Sky();
    sky.scale.setScalar(5000);
    const u = sky.material.uniforms;
    u.turbidity.value = 5;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.006;
    u.mieDirectionalG.value = 0.8;
    const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 42), THREE.MathUtils.degToRad(160));
    u.sunPosition.value.copy(sunDir);
    this.scene.add(sky);
    const hemi = new THREE.HemisphereLight("#cfe3ff", "#6a7250", 0.75);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff4e0", 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    const s = 85;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.6;
    this.sun = sun;
    this.scene.add(sun, sun.target);
    this.sunDir = sunDir.clone().multiplyScalar(160);

    // 世界
    this.groundCanvas = buildGroundCanvas();
    this.terrain = buildTerrainMesh(this.groundCanvas);
    this.water = buildWater();
    this.world = buildCampus();
    this.scene.add(this.terrain, this.water, this.world.buildings, this.world.trees, this.world.decor);
    this.propsGroup.name = "PlacedProps";
    this.enemyGroup.name = "Enemies";
    this.scene.add(this.propsGroup, this.enemyGroup, this.particles.points);

    // 玩家
    this.player = new Player(PLAYER_START.x, PLAYER_START.z, PLAYER_START.yaw, terrainHeight(PLAYER_START.x, PLAYER_START.z));

    // 武器
    this.camera.add(this.weaponRoot);
    for (const w of WEAPONS) {
      const g = w.build();
      g.visible = false;
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = false;
          o.frustumCulled = false;
        }
      });
      this.weaponRoot.add(g);
      this.weaponModels.push(g);
      this.ammo.push(w.ammoMax ?? 0);
    }

    this.enemyCtx = {
      playerPos: new THREE.Vector3(),
      camQuat: new THREE.Quaternion(),
      time: 0,
      groundAt: terrainHeight,
      collide: (p, r) => {
        resolveCollision(p, r, this.world.colliders);
      },
      damagePlayer: (a, from) => this.damagePlayer(a, from),
      fireProjectile: (from, dir, speed, dmg) => this.spawnEnemyProjectile(from, dir, speed, dmg),
      explode: (pos, radius, dmg) => this.explodeAtPlayer(pos, radius, dmg),
      particles: this.particles,
    };

    this.bind();
    this.loadLayout(true);
    this.loop();
  }

  private sunDir: THREE.Vector3;

  // ================= 事件 =================
  private handlers: [EventTarget, string, EventListenerOrEventListenerObject][] = [];
  private on(t: EventTarget, type: string, fn: (e: never) => void, opts?: AddEventListenerOptions) {
    t.addEventListener(type, fn as EventListener, opts);
    this.handlers.push([t, type, fn as EventListener]);
  }

  private bind() {
    const el = this.renderer.domElement;
    this.on(window, "resize", () => this.resize());
    this.on(document, "pointerlockchange", () => {
      this.locked = document.pointerLockElement === el;
      this.keys.clear();
      this.mouseDown = false;
      this.pushUI();
    });
    this.on(document, "keydown", (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.code);
      if (this.mode === "menu") return;
      if (["Space", "Tab", "KeyQ", "KeyE", "KeyR", "KeyF"].includes(e.code)) e.preventDefault();
      this.onKey(e);
    });
    this.on(document, "keyup", (e: KeyboardEvent) => this.keys.delete(e.code));
    this.on(document, "mousemove", (e: MouseEvent) => {
      if (!this.locked || this.mode === "menu") return;
      this.player.look(e.movementX, e.movementY);
    });
    this.on(el, "mousedown", (e: MouseEvent) => {
      if (this.mode === "menu") return;
      if (!this.locked) {
        this.lock();
        return;
      }
      if (e.button === 0) {
        this.mouseDown = true;
        this.primary();
      } else if (e.button === 2) this.secondary();
    });
    this.on(document, "mouseup", (e: MouseEvent) => {
      if (e.button === 0) this.mouseDown = false;
    });
    this.on(el, "contextmenu", (e: Event) => e.preventDefault());
    this.on(
      el,
      "wheel",
      (e: WheelEvent) => {
        if (!this.locked) return;
        e.preventDefault();
        const dir = e.deltaY > 0 ? 1 : -1;
        if (this.mode === "creative") this.selectProp((this.propIndex + dir + PROP_CATALOG.length) % PROP_CATALOG.length);
        else if (this.mode === "combat") this.selectWeapon((this.weaponIndex + dir + WEAPONS.length) % WEAPONS.length);
      },
      { passive: false }
    );
  }

  private onKey(e: KeyboardEvent) {
    const c = e.code;
    if (c === "KeyV") {
      this.player.fly = !this.player.fly;
      this.toast(this.player.fly ? "飞行模式：空格上升 / C 下降" : "步行模式");
    }
    if (this.mode === "creative") {
      if (c === "KeyZ") this.undo();
      if (c === "KeyX") this.propRot = 0;
      if (/^Digit[1-9]$/.test(c)) this.selectProp((Number(c[5]) - 1) % PROP_CATALOG.length);
    }
    if (this.mode === "combat") {
      if (/^Digit[1-4]$/.test(c)) this.selectWeapon(Number(c[5]) - 1);
      if (c === "KeyR" && this.gameOver) this.startCombat();
    }
  }

  lock() {
    if (this.mode === "menu") return;
    try {
      const r = this.renderer.domElement.requestPointerLock?.() as unknown;
      if (r && typeof (r as Promise<void>).catch === "function") (r as Promise<void>).catch(() => undefined);
    } catch {
      /* 忽略：浏览器拒绝锁定时用户可再次点击 */
    }
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  toast(m: string) {
    this.msg = m;
    this.msgT = performance.now();
    this.pushUI();
  }

  // ================= 模式 =================
  setMode(mode: Mode) {
    this.mode = mode;
    this.keys.clear();
    if (mode === "menu") {
      this.unlock();
      this.clearCombat();
      this.setGhost(false);
      this.weaponModels.forEach((w) => (w.visible = false));
    } else {
      const gy = terrainHeight(PLAYER_START.x, PLAYER_START.z);
      this.player.pos.set(PLAYER_START.x, gy, PLAYER_START.z);
      this.player.vel.set(0, 0, 0);
      this.player.yaw = PLAYER_START.yaw;
      this.player.pitch = -0.05;
      this.player.fly = false;
    }
    if (mode === "creative") {
      this.clearCombat();
      this.weaponModels.forEach((w) => (w.visible = false));
      this.setGhost(true);
      this.toast("创造模式：滚轮切换道具，左键放置，右键删除，Q/E 旋转，R/F 缩放，Z 撤销，V 飞行");
    }
    if (mode === "combat") {
      this.setGhost(false);
      this.startCombat();
    }
    this.pushUI();
    setTimeout(() => this.lock(), 50);
  }

  // ================= 创造模式 =================
  private setGhost(on: boolean) {
    if (this.ghost) {
      this.scene.remove(this.ghost);
      this.ghost = null;
      this.ghostId = "";
    }
    if (!on) return;
    const id = PROP_CATALOG[this.propIndex].id;
    const g = createProp(id);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = this.ghostMat;
        o.castShadow = false;
      }
    });
    this.ghost = g;
    this.ghostId = id;
    this.scene.add(g);
  }

  selectProp(i: number) {
    this.propIndex = i;
    if (this.mode === "creative") this.setGhost(true);
    sfx("click");
    this.pushUI();
  }

  private aimPoint(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 70;
    const hits = this.raycaster.intersectObjects([this.terrain, ...this.world.buildingMeshes, this.propsGroup, this.world.decor], true);
    if (hits.length) return hits[0].point;
    return null;
  }

  private updateGhost(dt: number) {
    if (!this.ghost) return;
    if (this.keys.has("KeyQ")) this.propRot += dt * 2;
    if (this.keys.has("KeyE")) this.propRot -= dt * 2;
    if (this.keys.has("KeyR")) this.propScale = Math.min(10, this.propScale * (1 + dt * 1.5));
    if (this.keys.has("KeyF")) this.propScale = Math.max(0.1, this.propScale / (1 + dt * 1.5));
    const p = this.aimPoint();
    if (p) {
      this.ghost.visible = true;
      this.ghost.position.copy(p);
    } else this.ghost.visible = false;
    this.ghost.rotation.y = this.propRot;
    this.ghost.scale.setScalar(this.propScale);
  }

  placeProp() {
    if (!this.ghost || !this.ghost.visible) return;
    const g = createProp(this.ghostId);
    g.position.copy(this.ghost.position);
    g.rotation.y = this.propRot;
    g.scale.setScalar(this.propScale);
    this.propsGroup.add(g);
    this.placed.push({ id: this.ghostId, group: g });
    this.undoStack = [];
    sfx("place");
    this.particles.emit(g.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 12, "#a3e635", 2.5, 4, 0.5);
    this.pushUI();
  }

  removeProp() {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 70;
    const hits = this.raycaster.intersectObjects(this.propsGroup.children, true);
    if (!hits.length) return;
    let o: THREE.Object3D | null = hits[0].object;
    while (o && o.parent !== this.propsGroup) o = o.parent;
    if (!o) return;
    const idx = this.placed.findIndex((p) => p.group === o);
    if (idx >= 0) {
      const [rec] = this.placed.splice(idx, 1);
      this.propsGroup.remove(rec.group);
      this.undoStack.push(rec);
      sfx("remove");
      this.particles.emit(rec.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)), 12, "#f87171", 3, 5, 0.5);
      this.pushUI();
    }
  }

  undo() {
    if (this.undoStack.length) {
      const rec = this.undoStack.pop()!;
      this.propsGroup.add(rec.group);
      this.placed.push(rec);
      this.toast("已恢复删除的道具");
    } else if (this.placed.length) {
      const rec = this.placed.pop()!;
      this.propsGroup.remove(rec.group);
      this.toast("已撤销放置");
    }
    this.pushUI();
  }

  clearProps() {
    for (const p of this.placed) this.propsGroup.remove(p.group);
    this.placed = [];
    this.undoStack = [];
    this.toast("已清空所有放置的道具");
  }

  getLayoutJSON() {
    return JSON.stringify({
      version: 1,
      props: this.placed.map((p) => ({
        id: p.id,
        x: +p.group.position.x.toFixed(3),
        y: +p.group.position.y.toFixed(3),
        z: +p.group.position.z.toFixed(3),
        rot: +p.group.rotation.y.toFixed(4),
        scale: +p.group.scale.x.toFixed(3),
      })),
    });
  }

  loadLayoutJSON(json: string) {
    try {
      const data = JSON.parse(json) as { props: { id: string; x: number; y: number; z: number; rot: number; scale: number }[] };
      for (const p of this.placed) this.propsGroup.remove(p.group);
      this.placed = [];
      for (const p of data.props ?? []) {
        const g = createProp(p.id);
        g.position.set(p.x, p.y, p.z);
        g.rotation.y = p.rot;
        g.scale.setScalar(p.scale);
        this.propsGroup.add(g);
        this.placed.push({ id: p.id, group: g });
      }
      this.pushUI();
      return true;
    } catch {
      return false;
    }
  }

  saveLayout() {
    localStorage.setItem(SAVE_KEY, this.getLayoutJSON());
    this.toast(`已保存 ${this.placed.length} 个道具到浏览器`);
    sfx("pickup");
  }

  loadLayout(silent = false) {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) {
      if (!silent) this.toast("没有找到存档");
      return;
    }
    if (this.loadLayoutJSON(s) && !silent) this.toast(`已载入 ${this.placed.length} 个道具`);
  }

  downloadText(text: string, name: string, type = "application/json") {
    const blob = new Blob([text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  exportGLB(opts: { terrain: boolean; buildings: boolean; vegetation: boolean; decor: boolean; props: boolean }, done: (ok: boolean, size?: number) => void) {
    const objs: THREE.Object3D[] = [];
    if (opts.terrain) objs.push(this.terrain, this.water);
    if (opts.buildings) objs.push(this.world.buildings);
    if (opts.vegetation) objs.push(this.world.trees);
    if (opts.decor) objs.push(this.world.decor);
    if (opts.props) objs.push(this.propsGroup);
    if (!objs.length) {
      done(false);
      return;
    }
    const exporter = new GLTFExporter();
    exporter.parse(
      objs,
      (result) => {
        const buf = result as ArrayBuffer;
        const blob = new Blob([buf], { type: "model/gltf-binary" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `hillside-campus-${Date.now()}.glb`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        sfx("export");
        done(true, buf.byteLength);
      },
      (err) => {
        console.error(err);
        done(false);
      },
      { binary: true, onlyVisible: true, maxTextureSize: 2048 }
    );
  }

  // ================= 战斗模式 =================
  startCombat() {
    this.clearCombat();
    this.gameOver = false;
    this.player.hp = this.player.maxHp;
    this.kills = 0;
    this.score = 0;
    this.wave = 0;
    this.ammo = WEAPONS.map((w) => w.ammoMax ?? 0);
    this.selectWeapon(0);
    this.waveState = "break";
    this.breakTimer = 4;
    const gy = terrainHeight(PLAYER_START.x, PLAYER_START.z);
    this.player.pos.set(PLAYER_START.x, gy, PLAYER_START.z);
    this.player.vel.set(0, 0, 0);
    this.toast("战斗模式：文具大战即将开始！1-4 切换武器，左键攻击");
    this.pushUI();
  }

  clearCombat() {
    for (const e of this.enemies) this.enemyGroup.remove(e.group);
    this.enemies = [];
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles = [];
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.pickups = [];
    this.waveState = "idle";
    this.spawnQueue = [];
  }

  selectWeapon(i: number) {
    this.weaponIndex = i;
    this.weaponModels.forEach((w, k) => (w.visible = k === i));
    this.weaponAnim = -1;
    sfx("click");
    this.pushUI();
  }

  private startWave(n: number) {
    this.wave = n;
    const pool: string[] = ["book"];
    if (n >= 2) pool.push("student");
    if (n >= 3) pool.push("clock");
    if (n >= 4) pool.push("slime");
    if (n >= 5) pool.push("ghost");
    const count = Math.min(34, 5 + n * 2);
    this.spawnQueue = [];
    for (let i = 0; i < count; i++) this.spawnQueue.push(pool[Math.floor(Math.random() * pool.length)]);
    if (n % 5 === 0) {
      this.spawnQueue.splice(Math.floor(count / 2), 0, "boss");
      sfx("boss");
      this.toast(`第 ${n} 波 —— 警告：巨型字典出现！`);
    } else {
      sfx("wave");
      this.toast(`第 ${n} 波来袭：${count} 个敌人`);
    }
    this.waveState = "spawning";
    this.spawnTimer = 0.5;
  }

  private spawnFromQueue() {
    const id = this.spawnQueue.shift();
    if (!id) return;
    const pp = this.player.pos;
    const cands = SPAWN_POINTS.map(([x, z]) => ({ x, z, d: Math.hypot(x - pp.x, z - pp.z) })).filter((c) => c.d > 22 && c.d < 80);
    let x: number, z: number;
    if (cands.length) {
      const c = cands[Math.floor(Math.random() * cands.length)];
      x = c.x + (Math.random() - 0.5) * 8;
      z = c.z + (Math.random() - 0.5) * 8;
    } else {
      const a = Math.random() * Math.PI * 2;
      x = pp.x + Math.cos(a) * 30;
      z = pp.z + Math.sin(a) * 30;
    }
    const def = ENEMY_DEFS[id];
    const hpMul = 1 + (this.wave - 1) * 0.09;
    const e = new Enemy(def, x, z, terrainHeight(x, z), hpMul);
    resolveCollision(e.pos, def.radius + 0.5, this.world.colliders);
    this.enemyGroup.add(e.group);
    this.enemies.push(e);
    this.particles.emit(e.pos.clone().add(new THREE.Vector3(0, 1, 0)), 20, "#a78bfa", 4, 3, 0.7);
  }

  private primary() {
    if (this.mode === "creative") this.placeProp();
    else if (this.mode === "combat") this.attack();
  }
  private secondary() {
    if (this.mode === "creative") this.removeProp();
  }

  private attack() {
    if (this.gameOver || this.cooldown > 0) return;
    const w = WEAPONS[this.weaponIndex];
    if (w.ammoMax && this.ammo[this.weaponIndex] < 1) {
      sfx("click");
      return;
    }
    this.cooldown = w.cooldown;
    this.weaponAnim = 0;
    if (w.type === "melee") {
      this.pendingHit = 0.09;
      sfx("swing");
    } else {
      this.ammo[this.weaponIndex] -= 1;
      const dir = this.player.forward();
      const from = this.camera.getWorldPosition(new THREE.Vector3()).addScaledVector(dir, 0.6).add(new THREE.Vector3(0, -0.15, 0));
      let m: THREE.Object3D;
      if (w.type === "throw") {
        m = buildEraserMesh(1.6);
        sfx("throw");
      } else {
        m = mesh(new THREE.BoxGeometry(0.05, 0.02, 0.22), mat("#d0d0d0", { metalness: 0.8, roughness: 0.2 }));
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);
        sfx("shoot");
      }
      m.position.copy(from);
      this.scene.add(m);
      const vel = dir.clone().multiplyScalar(w.projSpeed ?? 30);
      if (w.type === "throw") vel.y += 3;
      this.projectiles.push({ mesh: m, vel, dmg: w.damage, from: "player", splash: w.splash ?? 0, gravity: w.gravity ?? 0, life: 4, knock: w.knockback });
      this.pushUI();
    }
  }

  private meleeHit() {
    const w = WEAPONS[this.weaponIndex];
    const fwd = this.player.forward();
    const eye = this.camera.position;
    const cosA = Math.cos(THREE.MathUtils.degToRad(w.angle));
    let hitAny = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const c = e.pos.clone().add(new THREE.Vector3(0, e.def.height * 0.45, 0));
      const to = c.sub(eye);
      const d = to.length() - e.def.radius;
      if (d > w.range) continue;
      to.normalize();
      if (to.dot(fwd) < cosA && d > 0.6) continue;
      const kdir = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      e.hit(w.damage, kdir, w.knockback, this.enemyCtx);
      hitAny = true;
      this.onEnemyHit(e);
    }
    if (hitAny) {
      sfx("hit");
      this.hitT = performance.now();
    }
  }

  private onEnemyHit(e: Enemy) {
    if (e.dead && !e.group.userData.counted) {
      e.group.userData.counted = true;
      this.kills++;
      this.score += e.def.score;
      sfx("die");
      if (Math.random() < 0.28 || e.def.behavior === "boss") this.spawnPickup(e.pos.clone(), Math.random() < 0.6 ? "heal" : "ammo");
      if (e.def.behavior === "boss") this.toast("巨型字典被击败！+250 分");
    }
  }

  private spawnPickup(p: THREE.Vector3, type: "heal" | "ammo") {
    const g = new THREE.Group();
    if (type === "heal") {
      g.add(mesh(new THREE.BoxGeometry(0.35, 0.5, 0.25), mat("#f8fafc")));
      g.add(mesh(new THREE.BoxGeometry(0.36, 0.14, 0.26), mat("#2563eb"), 0, 0.05, 0));
      g.add(mesh(new THREE.BoxGeometry(0.2, 0.08, 0.27), mat("#dc2626"), 0, -0.14, 0));
    } else {
      g.add(mesh(new THREE.BoxGeometry(0.6, 0.2, 0.3), mat("#f59e0b")));
      g.add(mesh(new THREE.BoxGeometry(0.62, 0.06, 0.32), mat("#7c2d12"), 0, 0.1, 0));
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), mat("#fbbf24"), 0.1, 0.16, 0).rotateZ(Math.PI / 2));
    }
    g.position.set(p.x, terrainHeight(p.x, p.z) + 0.6, p.z);
    this.scene.add(g);
    this.pickups.push({ mesh: g, type, t: 0 });
  }

  private spawnEnemyProjectile(from: THREE.Vector3, dir: THREE.Vector3, speed: number, dmg: number) {
    const m = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.45, 8), mat("#ffffff", { emissive: "#dddddd", emissiveIntensity: 0.3 }));
    m.position.copy(from);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(m);
    this.projectiles.push({ mesh: m, vel: dir.clone().multiplyScalar(speed), dmg, from: "enemy", splash: 0, gravity: 2, life: 4, knock: 0 });
  }

  private explodeAtPlayer(pos: THREE.Vector3, radius: number, dmg: number) {
    const d = pos.distanceTo(this.player.pos.clone().add(new THREE.Vector3(0, 0.9, 0)));
    if (d < radius) this.damagePlayer(dmg * (1 - (d / radius) * 0.5), pos);
    sfx("explode");
    this.shake = Math.max(this.shake, 0.5);
  }

  private explodeSplash(p: THREE.Vector3, radius: number, dmg: number, knock: number) {
    this.particles.emit(p, 40, "#f1f5f9", 8, 10, 0.7);
    this.particles.emit(p, 20, "#3b82f6", 6, 8, 0.6);
    sfx("explode");
    let any = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const c = e.pos.clone().add(new THREE.Vector3(0, e.def.height * 0.4, 0));
      const d = c.distanceTo(p);
      if (d < radius + e.def.radius) {
        const dir = new THREE.Vector3(c.x - p.x, 0, c.z - p.z).normalize();
        e.hit(dmg * (1 - Math.max(0, d - e.def.radius) / radius * 0.6), dir, knock, this.enemyCtx);
        this.onEnemyHit(e);
        any = true;
      }
    }
    if (any) this.hitT = performance.now();
  }

  private damagePlayer(amount: number, from: THREE.Vector3) {
    if (this.gameOver || this.mode !== "combat") return;
    const now = performance.now();
    if (now - this.dmgT < 320) return; // 短暂无敌帧
    this.player.hp = Math.max(0, this.player.hp - amount);
    this.dmgT = now;
    this.shake = Math.max(this.shake, 0.35);
    sfx("hurt");
    const dir = this.player.pos.clone().sub(from).setY(0).normalize();
    this.player.vel.addScaledVector(dir, 4);
    if (this.player.hp <= 0) {
      this.gameOver = true;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        localStorage.setItem(BEST_KEY, String(this.bestScore));
      }
      sfx("gameover");
      this.unlock();
    }
    this.pushUI();
  }

  private updateCombat(dt: number) {
    const pp = this.player.pos;
    this.cooldown -= dt;
    // 弹药回复
    for (let i = 0; i < WEAPONS.length; i++) {
      const w = WEAPONS[i];
      if (w.ammoMax && this.ammo[i] < w.ammoMax) this.ammo[i] = Math.min(w.ammoMax, this.ammo[i] + (w.ammoRegen ?? 0) * dt);
    }
    if (this.mouseDown && !this.gameOver && WEAPONS[this.weaponIndex].type === "shoot") this.attack();
    // 脱战 6 秒后缓慢回血
    if (!this.gameOver && performance.now() - this.dmgT > 6000 && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 2 * dt);
    }
    if (this.pendingHit >= 0) {
      this.pendingHit -= dt;
      if (this.pendingHit < 0) {
        this.meleeHit();
        this.pendingHit = -1;
      }
    }
    if (this.gameOver) {
      for (const e of this.enemies) e.update(dt, this.enemyCtx);
      return;
    }
    // 波次
    if (this.waveState === "break") {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) this.startWave(this.wave + 1);
    } else if (this.waveState === "spawning") {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnFromQueue();
        this.spawnTimer = this.wave % 5 === 0 ? 0.55 : 0.7;
        if (!this.spawnQueue.length) this.waveState = "active";
      }
    } else if (this.waveState === "active") {
      if (this.enemies.every((e) => e.dead)) {
        this.waveState = "break";
        this.breakTimer = 6;
        this.score += 50 + this.wave * 10;
        this.toast(`第 ${this.wave} 波清除！奖励 ${50 + this.wave * 10} 分`);
        sfx("heal");
      }
    }
    // 敌人
    this.enemyCtx.playerPos.copy(this.camera.position);
    this.enemyCtx.camQuat.copy(this.camera.quaternion);
    this.enemyCtx.time = this.time;
    for (const e of this.enemies) e.update(dt, this.enemyCtx);
    separateEnemies(this.enemies);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) this.onEnemyHit(e);
      if (e.remove) {
        this.enemyGroup.remove(e.group);
        this.enemies.splice(i, 1);
      }
    }
    // 投射物
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.from === "player" && p.splash) p.mesh.rotation.x += dt * 12;
      let hit = false;
      const m = p.mesh.position;
      if (m.y < terrainHeight(m.x, m.z)) hit = true;
      const test = m.clone();
      if (!hit && resolveCollision(test, 0.1, this.world.colliders)) hit = true;
      if (!hit) {
        if (p.from === "player") {
          for (const e of this.enemies) {
            if (e.dead) continue;
            const c = e.pos.clone().add(new THREE.Vector3(0, e.def.height * 0.45, 0));
            if (c.distanceTo(m) < e.def.radius + 0.35) {
              hit = true;
              if (!p.splash) {
                const dir = new THREE.Vector3(p.vel.x, 0, p.vel.z).normalize();
                e.hit(p.dmg, dir, p.knock, this.enemyCtx);
                this.onEnemyHit(e);
                this.hitT = performance.now();
                sfx("hit");
              }
              break;
            }
          }
        } else {
          const eye = this.camera.position;
          if (m.distanceTo(eye) < 0.9 || m.distanceTo(pp) < 0.8) {
            hit = true;
            this.damagePlayer(p.dmg, m);
          }
        }
      }
      if (hit || p.life <= 0) {
        if (p.splash && p.from === "player") this.explodeSplash(m.clone(), p.splash, p.dmg, p.knock);
        else if (p.from === "enemy") this.particles.emit(m.clone(), 8, "#ffffff", 3, 6, 0.4);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
    // 拾取
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t += dt;
      k.mesh.rotation.y += dt * 2;
      k.mesh.position.y += Math.sin(k.t * 3) * 0.003;
      if (k.mesh.position.distanceTo(pp.clone().add(new THREE.Vector3(0, 0.6, 0))) < 1.6) {
        if (k.type === "heal") {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
          this.toast("喝了一盒牛奶：+30 HP");
          sfx("heal");
        } else {
          this.ammo = WEAPONS.map((w) => w.ammoMax ?? 0);
          this.toast("文具盒：弹药全满！");
          sfx("pickup");
        }
        this.particles.emit(k.mesh.position.clone(), 20, k.type === "heal" ? "#4ade80" : "#fbbf24", 4, 4, 0.6);
        this.scene.remove(k.mesh);
        this.pickups.splice(i, 1);
        this.pushUI();
      } else if (k.t > 30) {
        this.scene.remove(k.mesh);
        this.pickups.splice(i, 1);
      }
    }
  }

  // ================= 主循环 =================
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1;
    this.time += dt;
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) {
      this.fps = Math.round(this.fpsN / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsN = 0;
    }

    if (this.mode === "menu") {
      const a = this.time * 0.05;
      const r = 170;
      this.camera.position.set(Math.cos(a) * r, 95 + Math.sin(this.time * 0.1) * 10, 20 + Math.sin(a) * r);
      this.camera.lookAt(-10, 10, 10);
      this.camera.rotation.z = 0;
    } else {
      if (this.locked && !this.gameOver) this.player.update(dt, this.keys, terrainHeight, this.world.colliders, () => sfx("jump"));
      else this.player.update(dt, new Set(), terrainHeight, this.world.colliders);
      this.player.applyCamera(this.camera);
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt * 1.5);
        this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.25;
        this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.25;
        this.camera.rotation.z += (Math.random() - 0.5) * this.shake * 0.03;
      }
      this.camera.updateMatrixWorld();
      if (this.mode === "creative") this.updateGhost(dt);
      if (this.mode === "combat" && (this.locked || this.gameOver)) {
        this.updateCombat(dt);
        // 武器动画
        const w = WEAPONS[this.weaponIndex];
        const g = this.weaponModels[this.weaponIndex];
        if (this.weaponAnim >= 0) {
          this.weaponAnim += dt / Math.max(0.2, w.cooldown);
          if (this.weaponAnim >= 1) this.weaponAnim = -1;
        }
        w.animate(g, this.weaponAnim, this.player.walkT);
      }
    }
    // 光照跟随
    const target = this.mode === "menu" ? new THREE.Vector3(0, 0, 10) : this.player.pos;
    this.sun.position.copy(target).add(this.sunDir);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();

    this.particles.update(dt);
    // 水面微动
    (this.water.material as THREE.MeshStandardMaterial).roughness = 0.12 + Math.sin(this.time * 1.5) * 0.04;
    this.renderer.render(this.scene, this.camera);

    this.uiTimer += dt;
    if (this.uiTimer > 0.1) {
      this.uiTimer = 0;
      this.pushUI();
    }
  };

  pushUI() {
    const w = WEAPONS[this.weaponIndex];
    const boss = this.enemies.find((e) => e.def.behavior === "boss" && !e.dead);
    this.onUI({
      mode: this.mode,
      locked: this.locked,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      wave: this.wave,
      enemiesLeft: this.enemies.filter((e) => !e.dead).length + this.spawnQueue.length,
      kills: this.kills,
      score: this.score,
      bestScore: this.bestScore,
      waveCountdown: this.waveState === "break" ? Math.max(0, this.breakTimer) : 0,
      bossName: boss ? boss.def.name : "",
      bossHp: boss ? boss.hp / boss.maxHp : 0,
      weapon: this.weaponIndex,
      ammo: Math.floor(this.ammo[this.weaponIndex] ?? 0),
      ammoMax: w.ammoMax ?? 0,
      gameOver: this.gameOver,
      propIndex: this.propIndex,
      propScale: this.propScale,
      placed: this.placed.length,
      fly: this.player.fly,
      msg: this.msg,
      msgT: this.msgT,
      dmgT: this.dmgT,
      hitT: this.hitT,
      fps: this.fps,
      posX: this.player.pos.x,
      posZ: this.player.pos.z,
      yaw: this.player.yaw,
    });
  }

  getEnemyPositions() {
    return this.enemies.filter((e) => !e.dead).map((e) => [e.pos.x, e.pos.z, e.def.behavior === "boss"] as [number, number, boolean]);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const [t, type, fn] of this.handlers) t.removeEventListener(type, fn);
    this.unlock();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
