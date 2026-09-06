import * as THREE from "three";

export interface PropDef {
  id: string;
  name: string;
  icon: string;
  create: () => THREE.Group;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = color + JSON.stringify(opts);
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, ...opts });
    matCache.set(key, m);
  }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  me.receiveShadow = true;
  return me;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sph = (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d);

function rock() {
  const g = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(1, 1);
  const p = geo.attributes.position as THREE.BufferAttribute;
  let s = 3;
  for (let i = 0; i < p.count; i++) {
    s = (s * 16807) % 2147483647;
    const f = 0.8 + (s / 2147483647) * 0.4;
    p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 0.7, p.getZ(i) * f);
  }
  geo.computeVertexNormals();
  const m = mesh(geo, mat("#8d8b84", { flatShading: true, roughness: 0.95 }), 0, 0.55, 0);
  m.scale.set(1.2, 1, 1);
  g.add(m);
  return g;
}

function tree() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.18, 0.28, 2.2, 7), mat("#6b4a2f"), 0, 1.1, 0));
  const leaf = mat("#4f8a3a", { flatShading: true });
  g.add(mesh(sph(1.5), leaf, 0, 3.2, 0));
  g.add(mesh(sph(1.1), leaf, 0.8, 3.9, 0.3));
  g.add(mesh(sph(1.0), leaf, -0.7, 4.0, -0.4));
  return g;
}

function autumnTree() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.16, 0.25, 2.4, 7), mat("#7a5233"), 0, 1.2, 0));
  const leaf = mat("#e2b23a", { flatShading: true });
  g.add(mesh(sph(1.4), leaf, 0, 3.4, 0));
  g.add(mesh(sph(1.0), leaf, 0.6, 4.2, 0.4));
  g.add(mesh(sph(0.9), mat("#d98a2b", { flatShading: true }), -0.7, 4.0, -0.3));
  return g;
}

function pine() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.15, 0.25, 1.6, 7), mat("#5b3d26"), 0, 0.8, 0));
  const m = mat("#2f6b3a", { flatShading: true });
  g.add(mesh(new THREE.ConeGeometry(1.6, 2.4, 8), m, 0, 2.4, 0));
  g.add(mesh(new THREE.ConeGeometry(1.2, 2.0, 8), m, 0, 3.7, 0));
  g.add(mesh(new THREE.ConeGeometry(0.8, 1.6, 8), m, 0, 4.8, 0));
  return g;
}

function bush() {
  const g = new THREE.Group();
  const m = mat("#3f7d33", { flatShading: true });
  g.add(mesh(sph(0.7), m, 0, 0.55, 0));
  g.add(mesh(sph(0.55), m, 0.55, 0.45, 0.2));
  g.add(mesh(sph(0.5), m, -0.5, 0.42, -0.25));
  g.add(mesh(sph(0.45), m, 0.1, 0.4, 0.55));
  return g;
}

function crate() {
  const g = new THREE.Group();
  g.add(mesh(box(1, 1, 1), mat("#b07a3c"), 0, 0.5, 0));
  const edge = mat("#7a5024");
  for (const [x, z] of [[0.45, 0.45], [-0.45, 0.45], [0.45, -0.45], [-0.45, -0.45]]) g.add(mesh(box(0.12, 1.02, 0.12), edge, x, 0.5, z));
  g.add(mesh(box(1.02, 0.12, 0.12), edge, 0, 0.5, 0.45));
  g.add(mesh(box(1.02, 0.12, 0.12), edge, 0, 0.5, -0.45));
  return g;
}

function lamp() {
  const g = new THREE.Group();
  const m = mat("#3a3d42", { metalness: 0.5, roughness: 0.5 });
  g.add(mesh(cyl(0.12, 0.18, 6, 8), m, 0, 3, 0));
  g.add(mesh(cyl(0.3, 0.35, 0.2, 8), m, 0, 0.1, 0));
  const arm = mesh(box(1.6, 0.1, 0.1), m, 0.7, 6, 0);
  g.add(arm);
  g.add(mesh(box(0.7, 0.18, 0.35), m, 1.4, 5.98, 0));
  g.add(mesh(box(0.6, 0.06, 0.28), mat("#fff3c4", { emissive: "#ffe9a8", emissiveIntensity: 1.5 }), 1.4, 5.87, 0));
  return g;
}

function trash() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.35, 0.3, 0.9, 12), mat("#2f6f4f"), 0, 0.45, 0));
  g.add(mesh(cyl(0.38, 0.38, 0.08, 12), mat("#244f3a"), 0, 0.93, 0));
  g.add(mesh(box(0.5, 0.02, 0.5), mat("#111"), 0, 0.98, 0));
  return g;
}

function bench() {
  const g = new THREE.Group();
  const wood = mat("#a56f3a");
  const iron = mat("#2b2b2b", { metalness: 0.6 });
  for (let i = 0; i < 3; i++) g.add(mesh(box(1.8, 0.05, 0.12), wood, 0, 0.45, -0.15 + i * 0.15));
  for (let i = 0; i < 2; i++) g.add(mesh(box(1.8, 0.12, 0.05), wood, 0, 0.7 + i * 0.16, -0.25));
  for (const x of [-0.75, 0.75]) {
    g.add(mesh(box(0.08, 0.45, 0.45), iron, x, 0.22, 0));
    g.add(mesh(box(0.08, 0.5, 0.06), iron, x, 0.7, -0.25));
  }
  return g;
}

function flowerbed() {
  const g = new THREE.Group();
  g.add(mesh(cyl(1.2, 1.3, 0.5, 16), mat("#9e9a90"), 0, 0.25, 0));
  g.add(mesh(cyl(1.1, 1.1, 0.1, 16), mat("#4a3524"), 0, 0.52, 0));
  const cols = ["#e94b6a", "#f5c542", "#ffffff", "#b25cd9", "#ff7a3d"];
  let s = 5;
  for (let i = 0; i < 14; i++) {
    s = (s * 16807) % 2147483647;
    const a = (i / 14) * Math.PI * 2, r = 0.3 + ((s % 100) / 100) * 0.65;
    g.add(mesh(sph(0.16, 0), mat(cols[i % cols.length], { flatShading: true }), Math.cos(a) * r, 0.75, Math.sin(a) * r));
    g.add(mesh(cyl(0.03, 0.03, 0.3, 4), mat("#3f7d33"), Math.cos(a) * r, 0.62, Math.sin(a) * r));
  }
  g.add(mesh(sph(0.5, 1), mat("#3f7d33", { flatShading: true }), 0, 0.75, 0));
  return g;
}

function fence() {
  const g = new THREE.Group();
  const m = mat("#e6e6e0");
  for (const x of [-1.2, 0, 1.2]) g.add(mesh(box(0.1, 1.1, 0.1), m, x, 0.55, 0));
  g.add(mesh(box(2.5, 0.06, 0.06), m, 0, 0.95, 0));
  g.add(mesh(box(2.5, 0.06, 0.06), m, 0, 0.45, 0));
  for (let i = 0; i < 8; i++) g.add(mesh(box(0.05, 0.8, 0.05), m, -1.05 + i * 0.3, 0.6, 0));
  return g;
}

function cone() {
  const g = new THREE.Group();
  g.add(mesh(box(0.5, 0.05, 0.5), mat("#e8541e"), 0, 0.025, 0));
  g.add(mesh(new THREE.ConeGeometry(0.22, 0.7, 12), mat("#f0662a"), 0, 0.38, 0));
  g.add(mesh(cyl(0.13, 0.17, 0.12, 12), mat("#ffffff"), 0, 0.42, 0));
  return g;
}

function bike() {
  const g = new THREE.Group();
  const tire = new THREE.TorusGeometry(0.33, 0.04, 8, 20);
  const dark = mat("#222", { metalness: 0.3 });
  const frame = mat("#2b6cb0", { metalness: 0.5, roughness: 0.4 });
  for (const x of [-0.5, 0.5]) {
    const w = mesh(tire, dark, x, 0.36, 0);
    w.rotation.y = Math.PI / 2;
    g.add(w);
  }
  const bar = mesh(box(0.9, 0.04, 0.04), frame, 0, 0.75, 0);
  g.add(bar);
  const d1 = mesh(box(0.55, 0.04, 0.04), frame, -0.28, 0.55, 0);
  d1.rotation.z = 0.8;
  g.add(d1);
  const d2 = mesh(box(0.55, 0.04, 0.04), frame, 0.28, 0.55, 0);
  d2.rotation.z = -0.8;
  g.add(d2);
  g.add(mesh(box(0.04, 0.04, 0.45), dark, 0.45, 0.85, 0));
  g.add(mesh(box(0.25, 0.05, 0.12), dark, -0.3, 0.85, 0));
  return g;
}

function hoop() {
  const g = new THREE.Group();
  const m = mat("#2f3238", { metalness: 0.5 });
  g.add(mesh(cyl(0.08, 0.1, 3.2, 8), m, 0, 1.6, 0));
  g.add(mesh(box(1.2, 0.08, 0.08), m, 0.6, 3.2, 0));
  g.add(mesh(box(0.06, 1.05, 1.8), mat("#f5f5f5"), 1.2, 3.3, 0));
  g.add(mesh(box(0.07, 0.45, 0.6), mat("#e33a2f"), 1.2, 3.15, 0));
  const ring = mesh(new THREE.TorusGeometry(0.23, 0.02, 6, 16), mat("#f06a2a"), 1.48, 3.05, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  return g;
}

function flagpole() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.06, 0.08, 10, 8), mat("#dcdcdc", { metalness: 0.7, roughness: 0.3 }), 0, 5, 0));
  g.add(mesh(cyl(0.6, 0.7, 0.4, 12), mat("#9e9a90"), 0, 0.2, 0));
  g.add(mesh(box(1.8, 1.2, 0.02), mat("#d8262a", { side: THREE.DoubleSide }), 0.95, 9.3, 0));
  return g;
}

function sign() {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.05, 0.05, 2.2, 6), mat("#555"), 0, 1.1, 0));
  g.add(mesh(box(1.4, 0.7, 0.05), mat("#1f5fa8"), 0, 2.2, 0));
  g.add(mesh(box(1.2, 0.5, 0.06), mat("#ffffff"), 0, 2.2, 0));
  g.add(mesh(box(0.9, 0.12, 0.07), mat("#1f5fa8"), 0, 2.28, 0));
  g.add(mesh(box(0.6, 0.08, 0.07), mat("#1f5fa8"), 0, 2.1, 0));
  return g;
}

function vending() {
  const g = new THREE.Group();
  g.add(mesh(box(1, 1.9, 0.8), mat("#d8322f"), 0, 0.95, 0));
  g.add(mesh(box(0.6, 1.1, 0.05), mat("#9fd9ff", { emissive: "#7ac6ff", emissiveIntensity: 0.6 }), -0.12, 1.2, 0.4));
  g.add(mesh(box(0.2, 0.9, 0.05), mat("#333"), 0.33, 1.1, 0.4));
  g.add(mesh(box(0.7, 0.25, 0.05), mat("#222"), -0.1, 0.35, 0.4));
  return g;
}

function statue() {
  const g = new THREE.Group();
  const stone = mat("#b9b5aa", { roughness: 0.6 });
  g.add(mesh(box(1.6, 0.4, 1.6), stone, 0, 0.2, 0));
  g.add(mesh(box(1.1, 1.4, 1.1), stone, 0, 1.1, 0));
  const bronze = mat("#6e5a3a", { metalness: 0.7, roughness: 0.35 });
  g.add(mesh(box(0.55, 1.2, 0.4), bronze, 0, 2.4, 0));
  g.add(mesh(sph(0.28, 2), bronze, 0, 3.25, 0));
  const arm = mesh(box(0.15, 0.9, 0.15), bronze, 0.4, 2.85, 0.1);
  arm.rotation.z = -1.2;
  g.add(arm);
  g.add(mesh(box(0.4, 0.5, 0.08), bronze, -0.2, 2.6, 0.3));
  return g;
}

function hydrant() {
  const g = new THREE.Group();
  const m = mat("#d8322f");
  g.add(mesh(cyl(0.15, 0.18, 0.7, 10), m, 0, 0.35, 0));
  g.add(mesh(sph(0.16, 1), m, 0, 0.72, 0));
  g.add(mesh(cyl(0.07, 0.07, 0.45, 8), m, 0, 0.45, 0).rotateZ(Math.PI / 2));
  g.add(mesh(cyl(0.22, 0.22, 0.06, 10), m, 0, 0.03, 0));
  return g;
}

function picnic() {
  const g = new THREE.Group();
  const wood = mat("#9c6a3a");
  g.add(mesh(box(1.8, 0.06, 0.8), wood, 0, 0.72, 0));
  g.add(mesh(box(1.8, 0.05, 0.3), wood, 0, 0.45, 0.65));
  g.add(mesh(box(1.8, 0.05, 0.3), wood, 0, 0.45, -0.65));
  for (const x of [-0.7, 0.7]) {
    const a = mesh(box(0.08, 0.9, 0.08), wood, x, 0.38, 0.35);
    a.rotation.x = 0.5;
    g.add(a);
    const b = mesh(box(0.08, 0.9, 0.08), wood, x, 0.38, -0.35);
    b.rotation.x = -0.5;
    g.add(b);
  }
  return g;
}

function desk() {
  const g = new THREE.Group();
  const w = mat("#d9b57c");
  const iron = mat("#4a5568", { metalness: 0.5 });
  g.add(mesh(box(0.7, 0.04, 0.5), w, 0, 0.75, 0));
  for (const [x, z] of [[-0.32, -0.22], [0.32, -0.22], [-0.32, 0.22], [0.32, 0.22]]) g.add(mesh(box(0.04, 0.75, 0.04), iron, x, 0.37, z));
  g.add(mesh(box(0.4, 0.04, 0.4), w, 0, 0.45, 0.6));
  g.add(mesh(box(0.4, 0.4, 0.04), w, 0, 0.67, 0.8));
  for (const [x, z] of [[-0.17, 0.42], [0.17, 0.42], [-0.17, 0.78], [0.17, 0.78]]) g.add(mesh(box(0.03, 0.45, 0.03), iron, x, 0.22, z));
  return g;
}

function bigPencil() {
  const g = new THREE.Group();
  const body = mesh(cyl(0.25, 0.25, 4.5, 6), mat("#f2c12e"), 0, 2.9, 0);
  g.add(body);
  g.add(mesh(new THREE.ConeGeometry(0.25, 0.7, 6), mat("#e8c9a0"), 0, 0.55, 0).rotateX(Math.PI));
  g.add(mesh(new THREE.ConeGeometry(0.08, 0.25, 6), mat("#222"), 0, 0.12, 0).rotateX(Math.PI));
  g.add(mesh(cyl(0.26, 0.26, 0.3, 12), mat("#c9c9c9", { metalness: 0.8, roughness: 0.3 }), 0, 5.25, 0));
  g.add(mesh(cyl(0.24, 0.24, 0.4, 12), mat("#f28ca0"), 0, 5.55, 0));
  return g;
}

function bench2() {
  const g = new THREE.Group();
  g.add(mesh(box(1.8, 0.4, 0.5), mat("#9e9a90"), 0, 0.2, 0));
  g.add(mesh(box(1.9, 0.08, 0.6), mat("#b5b0a5"), 0, 0.44, 0));
  return g;
}

function goal() {
  const g = new THREE.Group();
  const m = mat("#f7f7f7");
  g.add(mesh(cyl(0.05, 0.05, 2.4, 6), m, 0, 1.2, -2));
  g.add(mesh(cyl(0.05, 0.05, 2.4, 6), m, 0, 1.2, 2));
  g.add(mesh(box(0.1, 0.1, 4.1), m, 0, 2.4, 0));
  g.add(mesh(box(1.2, 0.03, 4), mat("#ffffff", { transparent: true, opacity: 0.35, side: THREE.DoubleSide }), -0.6, 1.2, 0).rotateZ(0.6));
  return g;
}

export const PROP_CATALOG: PropDef[] = [
  { id: "rock", name: "石头", icon: "🪨", create: rock },
  { id: "tree", name: "大树", icon: "🌳", create: tree },
  { id: "autumn", name: "银杏树", icon: "🍂", create: autumnTree },
  { id: "pine", name: "松树", icon: "🌲", create: pine },
  { id: "bush", name: "灌木", icon: "🌿", create: bush },
  { id: "crate", name: "木箱", icon: "📦", create: crate },
  { id: "lamp", name: "路灯", icon: "💡", create: lamp },
  { id: "trash", name: "垃圾桶", icon: "🗑️", create: trash },
  { id: "bench", name: "长椅", icon: "🪑", create: bench },
  { id: "stonebench", name: "石凳", icon: "🧱", create: bench2 },
  { id: "flowerbed", name: "花坛", icon: "🌸", create: flowerbed },
  { id: "fence", name: "栅栏", icon: "🚧", create: fence },
  { id: "cone", name: "路锥", icon: "🔶", create: cone },
  { id: "bike", name: "自行车", icon: "🚲", create: bike },
  { id: "hoop", name: "篮球架", icon: "🏀", create: hoop },
  { id: "goal", name: "球门", icon: "🥅", create: goal },
  { id: "flag", name: "旗杆", icon: "🚩", create: flagpole },
  { id: "sign", name: "路牌", icon: "🪧", create: sign },
  { id: "vending", name: "售货机", icon: "🥤", create: vending },
  { id: "statue", name: "雕像", icon: "🗿", create: statue },
  { id: "hydrant", name: "消防栓", icon: "🧯", create: hydrant },
  { id: "picnic", name: "野餐桌", icon: "🍱", create: picnic },
  { id: "desk", name: "课桌椅", icon: "📚", create: desk },
  { id: "bigpencil", name: "巨型铅笔雕塑", icon: "✏️", create: bigPencil },
];

export function createProp(id: string) {
  const def = PROP_CATALOG.find((p) => p.id === id) ?? PROP_CATALOG[0];
  const g = def.create();
  g.name = def.name;
  g.userData.propId = def.id;
  return g;
}
