import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BUILDINGS, BuildingDef, FENCE, ROADS, TRACK, ZONES, MAP_W, MAP_D } from "./layout";
import { baseHeight, inZone, mulberry32, onRoad, terrainHeight } from "./terrain";
import { createProp, mat } from "./props";

export interface Collider {
  x: number;
  z: number;
  hw: number;
  hd: number;
  cos: number;
  sin: number;
  r?: number; // 圆柱
  top: number;
}

export interface CampusWorld {
  buildings: THREE.Group;
  trees: THREE.Group;
  decor: THREE.Group;
  colliders: Collider[];
  buildingMeshes: THREE.Mesh[];
}

// ---------- 立面纹理 ----------
function facadeTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#e8e6df";
  g.fillRect(0, 0, 512, 256);
  for (let y = 0; y < 4; y++) {
    g.fillStyle = "rgba(0,0,0,0.06)";
    g.fillRect(0, y * 64 + 58, 512, 6);
    for (let x = 0; x < 8; x++) {
      const px = x * 64 + 14, py = y * 64 + 12;
      g.fillStyle = "#8f9aa3";
      g.fillRect(px - 2, py - 2, 40, 38);
      const grad = g.createLinearGradient(px, py, px + 36, py + 34);
      grad.addColorStop(0, "#5b7d9c");
      grad.addColorStop(0.5, "#89adc9");
      grad.addColorStop(1, "#3f5f7d");
      g.fillStyle = grad;
      g.fillRect(px, py, 36, 34);
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.fillRect(px + 2, py + 2, 12, 30);
      g.fillStyle = "#c9cbc7";
      g.fillRect(px + 17, py, 2, 34);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

let facadeBase: THREE.CanvasTexture | null = null;
function facadeMat(color: string, repX: number, repY: number) {
  if (!facadeBase) facadeBase = facadeTexture();
  const t = facadeBase.clone();
  t.repeat.set(Math.max(1, Math.round(repX)), Math.max(1, Math.round(repY)));
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ color, map: t, roughness: 0.7, metalness: 0.05 });
}

function gableRoof(w: number, d: number, color: string) {
  const shape = new THREE.Shape();
  const rh = Math.min(w, d) * 0.28 + 0.5;
  shape.moveTo(-w / 2 - 0.4, 0);
  shape.lineTo(w / 2 + 0.4, 0);
  shape.lineTo(0, rh);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d + 0.8, bevelEnabled: false });
  geo.translate(0, 0, -(d + 0.8) / 2);
  const m = new THREE.Mesh(geo, mat(color, { roughness: 0.85 }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function buildCampus(): CampusWorld {
  const buildings = new THREE.Group();
  buildings.name = "Buildings";
  const trees = new THREE.Group();
  trees.name = "Vegetation";
  const decor = new THREE.Group();
  decor.name = "Decor";
  const colliders: Collider[] = [];
  const buildingMeshes: THREE.Mesh[] = [];
  const rnd = mulberry32(2024);

  const addBox = (b: BuildingDef) => {
    const w = b.w!, d = b.d!, h = b.h;
    const groundY = terrainHeight(b.x, b.z);
    const y0 = groundY + (b.y0 ?? 0);
    const g = new THREE.Group();
    g.name = b.name;
    g.position.set(b.x, y0, b.z);
    g.rotation.y = b.rot ?? 0;
    const sink = b.y0 ? 0 : 1.2;
    const geo = new THREE.BoxGeometry(w, h + sink, d);
    const side = b.windows ? facadeMat(b.color ?? "#eee", w / 24, h / 12.8) : mat(b.color ?? "#eee");
    const side2 = b.windows ? facadeMat(b.color ?? "#eee", d / 24, h / 12.8) : side;
    const roof = mat(b.roof ?? "#555", { roughness: 0.9 });
    const m = new THREE.Mesh(geo, [side2, side2, roof, roof, side, side]);
    m.position.y = (h + sink) / 2 - sink;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    buildingMeshes.push(m);
    // 屋顶细节
    if (b.roofType === "gable") {
      const r = gableRoof(w, d, b.roof ?? "#b0332b");
      r.position.y = h;
      g.add(r);
    } else if (b.roofType === "solar") {
      const pm = mat("#1d2f52", { metalness: 0.6, roughness: 0.3 });
      const n = Math.floor(w / 3.2);
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, d * 0.6), pm);
        p.position.set(-w / 2 + 1.6 + i * 3.2, h + 0.5, 0);
        p.rotation.x = -0.35;
        p.castShadow = true;
        g.add(p);
      }
    } else if (b.roofType === "vents") {
      const vm = mat("#b7bcc2", { metalness: 0.5, roughness: 0.4 });
      const nx = Math.max(1, Math.floor(w / 6)), nz = Math.max(1, Math.floor(d / 6));
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
          if ((i + j) % 2) continue;
          const v = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 2.2), vm);
          v.position.set(-w / 2 + 3 + i * 6, h + 0.6, -d / 2 + 3 + j * 6);
          v.castShadow = true;
          g.add(v);
        }
    } else if (!b.context && b.windows && h > 8) {
      // 女儿墙 + 空调机组
      const par = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.8, d + 0.3), mat(b.color ?? "#eee"));
      par.position.y = h + 0.2;
      g.add(par);
      const ac = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.4), mat("#cfd3d6"));
      ac.position.set(w * 0.25, h + 0.9, d * 0.2);
      ac.castShadow = true;
      g.add(ac);
    }
    // 入口雨棚
    if (!b.context && b.windows && !b.y0) {
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(Math.min(8, w * 0.5), 0.25, 2.5), mat("#4a4f55"));
      canopy.position.set(0, 3.4, d / 2 + 1.2);
      canopy.castShadow = true;
      g.add(canopy);
      const door = new THREE.Mesh(new THREE.BoxGeometry(Math.min(5, w * 0.35), 3, 0.2), mat("#2b3f55", { metalness: 0.4, roughness: 0.3 }));
      door.position.set(0, 1.5, d / 2 + 0.05);
      g.add(door);
    }
    buildings.add(g);
    if (!b.y0) {
      colliders.push({ x: b.x, z: b.z, hw: w / 2, hd: d / 2, cos: Math.cos(b.rot ?? 0), sin: Math.sin(b.rot ?? 0), top: y0 + h });
    }
  };

  const addCyl = (b: BuildingDef) => {
    const r = b.r!, h = b.h;
    const y0 = terrainHeight(b.x, b.z);
    const g = new THREE.Group();
    g.name = b.name;
    g.position.set(b.x, y0, b.z);
    const geo = new THREE.CylinderGeometry(r, r, h + 1.2, 40);
    const side = facadeMat(b.color ?? "#eee", (2 * Math.PI * r) / 24, h / 12.8);
    const roof = mat(b.roof ?? "#666");
    const m = new THREE.Mesh(geo, [side, roof, roof]);
    m.position.y = (h + 1.2) / 2 - 1.2;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    buildingMeshes.push(m);
    if (b.roofType === "dome") {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r * 0.95, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat("#d9dcdf", { metalness: 0.3, roughness: 0.4 }));
      dome.position.y = h;
      dome.castShadow = true;
      g.add(dome);
    } else {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r - 0.4, 0.3, 8, 48), mat(b.color ?? "#eee"));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = h + 0.2;
      g.add(ring);
    }
    buildings.add(g);
    colliders.push({ x: b.x, z: b.z, hw: r, hd: r, cos: 1, sin: 0, r, top: y0 + h });
  };

  const addArc = (b: BuildingDef) => {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, b.r!, b.a0!, b.a1!, false);
    shape.absarc(0, 0, b.ri!, b.a1!, b.a0!, true);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: b.h + 1.2, bevelEnabled: false, curveSegments: 32 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, mat(b.color ?? "#eee", { roughness: 0.7 }));
    const y0 = terrainHeight(b.x, b.z);
    m.position.set(b.x, y0 - 1.2, b.z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.name = b.name;
    buildings.add(m);
    buildingMeshes.push(m);
    // 楼层线
    for (let f = 1; f * 3.5 < b.h; f++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(b.r! + 0.05, 0.12, 6, 64, b.a1! - b.a0!), mat("#6d7b8a"));
      band.rotation.x = Math.PI / 2;
      band.rotation.z = b.a0!;
      band.position.set(b.x, y0 + f * 3.5, b.z);
      buildings.add(band);
    }
    colliders.push({ x: b.x, z: b.z, hw: b.r!, hd: b.r!, cos: 1, sin: 0, r: b.r!, top: y0 + b.h });
  };

  for (const b of BUILDINGS) {
    if (b.kind === "box") addBox(b);
    else if (b.kind === "cyl") addCyl(b);
    else addArc(b);
  }

  // ---------- 围墙（合并为单一网格）----------
  {
    const walls: THREE.BufferGeometry[] = [];
    const posts: THREE.BufferGeometry[] = [];
    const tmp = new THREE.Object3D();
    for (let i = 0; i < FENCE.length; i++) {
      const [ax, az] = FENCE[i], [bx, bz] = FENCE[(i + 1) % FENCE.length];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.ceil(len / 6);
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n;
        const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0;
        const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        if (onRoad(cx, cz, 0.5)) continue; // 大门开口
        const y = terrainHeight(cx, cz);
        const seg = new THREE.BoxGeometry(Math.hypot(x1 - x0, z1 - z0), 1.6, 0.25);
        tmp.position.set(cx, y + 0.5, cz);
        tmp.rotation.set(0, -Math.atan2(z1 - z0, x1 - x0), 0);
        tmp.updateMatrix();
        seg.applyMatrix4(tmp.matrix);
        walls.push(seg);
        const post = new THREE.BoxGeometry(0.4, 2.0, 0.4);
        tmp.position.set(x0, terrainHeight(x0, z0) + 0.8, z0);
        tmp.rotation.set(0, 0, 0);
        tmp.updateMatrix();
        post.applyMatrix4(tmp.matrix);
        posts.push(post);
      }
    }
    const wallMesh = new THREE.Mesh(mergeGeometries(walls), mat("#d8d6cf"));
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    wallMesh.name = "CampusWall";
    const postMesh = new THREE.Mesh(mergeGeometries(posts), mat("#8f9297"));
    postMesh.castShadow = true;
    postMesh.name = "WallPosts";
    decor.add(wallMesh, postMesh);
  }

  // ---------- 树木（实例化）----------
  type TreeKind = "round" | "autumn" | "pine";
  const treeList: { x: number; z: number; kind: TreeKind; s: number }[] = [];
  const insideBuilding = (x: number, z: number, pad = 2.5) => {
    for (const c of colliders) {
      const dx = x - c.x, dz = z - c.z;
      if (c.r) {
        if (dx * dx + dz * dz < (c.r + pad) * (c.r + pad)) return true;
        continue;
      }
      const lx = c.cos * dx - c.sin * dz, lz = c.sin * dx + c.cos * dz;
      if (Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad) return true;
    }
    return false;
  };
  const inTrack = (x: number, z: number) => {
    const dz = Math.max(0, Math.abs(z - TRACK.cz) - TRACK.hs);
    return Math.hypot(x - TRACK.cx, dz) < TRACK.r + 2;
  };
  const free = (x: number, z: number) => !insideBuilding(x, z) && !onRoad(x, z, 1.5) && !inZone(x, z, 1) && !inTrack(x, z);
  const tryTree = (x: number, z: number, kind: TreeKind, s = 1) => {
    if (Math.abs(x) > MAP_W / 2 - 3 || Math.abs(z) > MAP_D / 2 - 3) return;
    if (!free(x, z)) return;
    treeList.push({ x, z, kind, s });
  };
  // 道路两侧行道树
  for (const r of ROADS) {
    if (r.kind === "dirt") continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let d = 4; d < len; d += 7 + rnd() * 3) {
        const t = d / len, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        const off = r.w / 2 + 2.6;
        const kind: TreeKind = rnd() > 0.35 ? "autumn" : "round";
        tryTree(x + nx * off, z + nz * off, kind, 0.85 + rnd() * 0.4);
        if (r.kind !== "highway" || rnd() > 0.4) tryTree(x - nx * off, z - nz * off, kind, 0.85 + rnd() * 0.4);
      }
    }
  }
  // 跑道两侧
  for (let z = -96; z < -4; z += 5) {
    tryTree(TRACK.cx + TRACK.r + 4 + rnd(), z, "autumn", 0.9 + rnd() * 0.3);
    tryTree(TRACK.cx - TRACK.r - 3.5 - rnd(), z, "round", 0.8 + rnd() * 0.3);
  }
  // 山地林
  for (let i = 0; i < 700; i++) {
    const x = -235 + rnd() * 215, z = -157 + rnd() * 200;
    const h = baseHeight(x, z);
    if (h < 4) continue;
    if (h > 34 && rnd() > 0.35) continue;
    const kind: TreeKind = rnd() > 0.6 ? "pine" : rnd() > 0.5 ? "round" : "autumn";
    tryTree(x, z, kind, 0.7 + rnd() * 0.7);
  }
  // 校园内散布
  const clusters: [number, number, number, number][] = [
    [-12, 50, 20, 45],
    [40, 55, 25, 50],
    [50, 5, 20, 12],
    [-100, 0, 60, 20],
    [-120, 90, 50, 14],
    [10, -85, 30, 30],
    [-45, -20, 20, 12],
    [-140, 60, 18, 40],
    [100, 40, 40, 40],
    [-60, 100, 60, 12],
    [0, 130, 100, 25],
  ];
  for (const [cx, cz, hw, hd] of clusters)
    for (let i = 0; i < 25; i++) tryTree(cx + (rnd() - 0.5) * 2 * hw, cz + (rnd() - 0.5) * 2 * hd, rnd() > 0.5 ? "round" : "autumn", 0.7 + rnd() * 0.6);

  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const roundGeo = new THREE.IcosahedronGeometry(1, 1);
  const pineGeo = new THREE.ConeGeometry(1, 1, 7);
  pineGeo.translate(0, 0.5, 0);
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, mat("#6b4a2f"), treeList.length);
  const canopyList = treeList.filter((t) => t.kind !== "pine");
  const pineList = treeList.filter((t) => t.kind === "pine");
  const canopyMesh = new THREE.InstancedMesh(roundGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 0.9 }), canopyList.length * 2);
  const pineMesh = new THREE.InstancedMesh(pineGeo, new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 0.9 }), pineList.length * 3);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const col = new THREE.Color();
  const greens = ["#4f8a3a", "#417a34", "#5d9a44", "#6aa04a"];
  const autumns = ["#e2b23a", "#d98a2b", "#f0c548", "#c8742a", "#e9a034"];
  treeList.forEach((t, i) => {
    const y = terrainHeight(t.x, t.z) - 0.2;
    const th = (t.kind === "pine" ? 1.6 : 2.4) * t.s;
    v.set(t.x, y, t.z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
    sc.set(t.s, th, t.s);
    m4.compose(v, q, sc);
    trunkMesh.setMatrixAt(i, m4);
  });
  canopyList.forEach((t, i) => {
    const y = terrainHeight(t.x, t.z) - 0.2;
    const pal = t.kind === "autumn" ? autumns : greens;
    for (let k = 0; k < 2; k++) {
      const r = (k === 0 ? 1.6 : 1.1) * t.s;
      v.set(t.x + (k ? (rnd() - 0.5) * 1.4 * t.s : 0), y + (k ? 3.9 : 3.3) * t.s, t.z + (k ? (rnd() - 0.5) * 1.4 * t.s : 0));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
      sc.set(r, r * 0.95, r);
      m4.compose(v, q, sc);
      canopyMesh.setMatrixAt(i * 2 + k, m4);
      col.set(pal[Math.floor(rnd() * pal.length)]);
      canopyMesh.setColorAt(i * 2 + k, col);
    }
  });
  const pines = ["#2f6b3a", "#2a5f34", "#3a7a42"];
  pineList.forEach((t, i) => {
    const y = terrainHeight(t.x, t.z) - 0.2;
    col.set(pines[Math.floor(rnd() * pines.length)]);
    for (let k = 0; k < 3; k++) {
      const r = (1.7 - k * 0.45) * t.s, h = (2.6 - k * 0.4) * t.s;
      v.set(t.x, y + (1.2 + k * 1.3) * t.s, t.z);
      q.identity();
      sc.set(r, h, r);
      m4.compose(v, q, sc);
      pineMesh.setMatrixAt(i * 3 + k, m4);
      pineMesh.setColorAt(i * 3 + k, col);
    }
  });
  for (const im of [trunkMesh, canopyMesh, pineMesh]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    trees.add(im);
  }
  trunkMesh.name = "Trunks";
  canopyMesh.name = "Canopies";
  pineMesh.name = "Pines";

  // ---------- 岩石 ----------
  {
    const rocks: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 400; i++) {
      const x = -235 + rnd() * 215, z = -157 + rnd() * 190;
      const h = baseHeight(x, z);
      if (h < 20 || onRoad(x, z, 1) || insideBuilding(x, z)) continue;
      if (rnd() > (h - 20) / 25) continue;
      rocks.push({ x, z, s: 0.8 + rnd() * 2.6 });
    }
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 16;
      const x = -5 + Math.cos(a) * r, z = -80 + Math.sin(a) * r;
      if (inZone(x, z, 0) || onRoad(x, z, 1)) continue;
      rocks.push({ x, z, s: 1 + rnd() * 3 });
    }
    const geo = new THREE.DodecahedronGeometry(1, 1);
    const im = new THREE.InstancedMesh(geo, mat("#8d8b84", { flatShading: true, roughness: 0.95 }), rocks.length);
    rocks.forEach((r, i) => {
      v.set(r.x, terrainHeight(r.x, r.z) + r.s * 0.25, r.z);
      q.setFromEuler(new THREE.Euler(rnd() * 0.6, rnd() * Math.PI, rnd() * 0.6));
      sc.set(r.s * (0.8 + rnd() * 0.6), r.s * 0.65, r.s);
      m4.compose(v, q, sc);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = true;
    im.receiveShadow = true;
    im.name = "Rocks";
    trees.add(im);
  }

  // ---------- 装饰道具 ----------
  const place = (id: string, x: number, z: number, rot = 0, s = 1) => {
    const p = createProp(id);
    p.position.set(x, terrainHeight(x, z), z);
    p.rotation.y = rot;
    p.scale.setScalar(s);
    decor.add(p);
    return p;
  };
  // 路灯沿主要道路
  for (const r of ROADS.slice(0, 3)) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let d = 12; d < len; d += 30) {
        const t = d / len;
        const x = ax + (bx - ax) * t + nx * (r.w / 2 + 1), z = az + (bz - az) * t + nz * (r.w / 2 + 1);
        if (insideBuilding(x, z, 0.5)) continue;
        place("lamp", x, z, Math.atan2(nx, nz) + Math.PI);
      }
    }
  }
  // 篮球架
  const cols = [-79.5, -64.5, -49.5];
  const rows: [number, number][] = [[-86, -73], [-71, -58], [-56, -43]];
  for (const cx of cols)
    for (const [z0, z1] of rows) {
      place("hoop", cx + 6.5, z0 + 0.6, -Math.PI / 2);
      place("hoop", cx + 6.5, z1 - 0.6, Math.PI / 2);
    }
  place("hoop", -12.5, -44, -Math.PI / 2);
  place("hoop", -12.5, -24, Math.PI / 2);
  // 球门
  place("goal", -61, -98, 0);
  place("goal", -37, -98, Math.PI);
  place("goal", 90, -50 - TRACK.hs - 14, Math.PI / 2, 1.5);
  place("goal", 90, -50 + TRACK.hs + 14, -Math.PI / 2, 1.5);
  // 广场
  place("flag", 15, 12);
  place("statue", 2, 30, Math.PI, 1.3);
  for (const x of [-2, 8, 22, 32]) {
    place("bench", x, 50, Math.PI);
    place("trash", x + 3, 50.5);
  }
  for (const x of [26, 34]) place("lamp", x, 12, Math.PI / 2, 0.8);
  place("vending", 36, 30, -Math.PI / 2);
  place("vending", 36, 32, -Math.PI / 2);
  place("sign", 62, 32, Math.PI / 4);
  place("sign", -3, -13, 0);
  place("flowerbed", -2, 45);
  place("flowerbed", 8, 13);
  place("flowerbed", 73, 23, 0, 1.6);
  place("bigpencil", 26, 40, 0, 1.2);
  // 停车与自行车
  for (let i = 0; i < 12; i++) place("bike", -44 + i * 1.2, 8, 0.2);
  for (let i = 0; i < 8; i++) place("bike", -98 + i * 1.2, 26, 0);
  for (let i = 0; i < 6; i++) place("cone", 20 + i * 4, -19 + (i % 2) * 5);
  // 水塘周围
  place("picnic", -8, 62, 0.4);
  place("picnic", 12, 84, -0.3);
  place("bench", 16, 60, -Math.PI / 2);
  place("bench", 16, 66, -Math.PI / 2);
  place("lamp", -10, 78, Math.PI / 2, 0.8);
  place("lamp", 18, 76, -Math.PI / 2, 0.8);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    place("bush", 2 + Math.cos(a) * 19, 70 + Math.sin(a) * 20, 0, 0.9 + rnd() * 0.5);
  }
  // 宿舍区
  for (let i = 0; i < 4; i++) place("trash", -125 + i * 12, 38.5);
  for (let i = 0; i < 4; i++) place("stonebench", -128 + i * 12, 40, 0);
  place("hydrant", -90, 20);
  place("hydrant", 40, 8);
  place("picnic", -140, 75, 0.2);
  place("picnic", -150, 78, -0.5);
  for (let i = 0; i < 6; i++) place("fence", -130 + i * 2.5, 18);
  // 体育馆旁
  for (let i = 0; i < 4; i++) place("bench", 52 + i * 0.01, -70 + i * 8, Math.PI / 2);
  place("trash", 12, -30);
  place("trash", 48, -12);
  place("crate", 44, -22, 0.3);
  place("crate", 45.2, -22.3, 0.8);
  place("crate", 44.6, -21.4, 0.1).position.y += 1;

  return { buildings, trees, decor, colliders, buildingMeshes };
}

/** 碰撞推离：返回是否发生碰撞 */
export function resolveCollision(pos: THREE.Vector3, radius: number, colliders: Collider[], height = 1.7): boolean {
  let hit = false;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (pos.y > c.top + 0.5) continue;
    const dx = pos.x - c.x, dz = pos.z - c.z;
    if (c.r) {
      const d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d < min) {
        const k = d < 1e-4 ? 1 : (min - d) / d;
        pos.x += dx * k;
        pos.z += dz * k;
        hit = true;
      }
      continue;
    }
    if (Math.abs(dx) > c.hw + c.hd + radius || Math.abs(dz) > c.hw + c.hd + radius) continue;
    const lx = c.cos * dx - c.sin * dz, lz = c.sin * dx + c.cos * dz;
    const px = c.hw + radius - Math.abs(lx), pz = c.hd + radius - Math.abs(lz);
    if (px > 0 && pz > 0) {
      let ox = 0, oz = 0;
      if (px < pz) ox = lx > 0 ? px : -px;
      else oz = lz > 0 ? pz : -pz;
      pos.x += c.cos * ox + c.sin * oz;
      pos.z += -c.sin * ox + c.cos * oz;
      hit = true;
    }
  }
  void height;
  return hit;
}

export const ZONE_IDS = ZONES.map((z) => z.id);
