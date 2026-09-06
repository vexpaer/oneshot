import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { CollisionWorld } from './physics';
import {
  buildKeyLayout,
  makeKeyAtlas,
  makeWood,
  makePaper,
  makeStickyNote,
  makePhoneScreen,
  makeMousepad,
  KEY_SOLID_CELL,
  mulberry32,
} from './textures';
import type { Quality } from './store';
import screenUrl from '../assets/screen.jpg';

export interface WorldRefs {
  lamp: THREE.SpotLight;
  lampHead: THREE.Vector3;
  mugTop: THREE.Vector3;
  groundSpawns: THREE.Vector3[];
  airSpawns: THREE.Vector3[];
  turretSpots: THREE.Vector3[];
  playerSpawn: THREE.Vector3;
  animated: { update: (t: number, dt: number) => void }[];
}

const U = 1.9; // keyboard unit in cm

export async function buildWorld(
  scene: THREE.Scene,
  col: CollisionWorld,
  quality: Quality,
  progress: (p: number, stage: string) => void,
): Promise<WorldRefs> {
  const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));
  const shadows = quality !== 'low';
  const animated: WorldRefs['animated'] = [];

  const std = (opts: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(opts);
  const phys = (opts: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(opts);

  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], cast = true, receive = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast && shadows;
    m.receiveShadow = receive && shadows;
    scene.add(m);
    return m;
  };

  // =============== LIGHTING ===============
  progress(0.05, 'Warming up the desk lamp');
  const hemi = new THREE.HemisphereLight(0x6b7a9e, 0x3a2a1e, 0.9);
  scene.add(hemi);

  const lamp = new THREE.SpotLight(0xffd3a1, 0, 0, 0.78, 0.55, 1);
  lamp.intensity = 260;
  const lampHead = new THREE.Vector3(36, 40, -14);
  lamp.position.copy(lampHead);
  lamp.target.position.set(-2, 0, 8);
  scene.add(lamp);
  scene.add(lamp.target);
  if (shadows) {
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(quality === 'high' ? 2048 : 1024, quality === 'high' ? 2048 : 1024);
    lamp.shadow.camera.near = 8;
    lamp.shadow.camera.far = 160;
    lamp.shadow.bias = -0.0006;
    lamp.shadow.normalBias = 0.03;
    lamp.shadow.radius = 3;
  }

  // Cool fill from the monitor side
  const fill = new THREE.DirectionalLight(0x6f8fff, 0.35);
  fill.position.set(-20, 30, -40);
  scene.add(fill);

  // =============== ROOM ===============
  progress(0.12, 'Building the room');
  const wallMat = std({ color: 0x1b1e28, roughness: 0.95 });
  const wall = mesh(new THREE.PlaneGeometry(600, 300), wallMat, false, true);
  wall.position.set(0, 100, -47);
  const sideWall = mesh(new THREE.PlaneGeometry(400, 300), wallMat, false, true);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.position.set(-150, 100, 0);
  const floor = mesh(new THREE.PlaneGeometry(800, 800), std({ color: 0x0d0e12, roughness: 1 }), false, true);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -76;

  // =============== DESK ===============
  progress(0.2, 'Sanding the desk');
  const wood = makeWood(1024);
  wood.color.repeat.set(3, 1.6);
  wood.rough.repeat.set(3, 1.6);
  const deskMat = phys({
    map: wood.color,
    roughnessMap: wood.rough,
    roughness: 1,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    bumpMap: wood.rough,
    bumpScale: 1.5,
  });
  const desk = mesh(new THREE.BoxGeometry(172, 4, 86), deskMat, true, true);
  desk.position.set(0, -2, 0);
  // legs
  const legMat = std({ color: 0x151618, roughness: 0.5, metalness: 0.7 });
  for (const [x, z] of [
    [-80, -36],
    [80, -36],
    [-80, 36],
    [80, 36],
  ]) {
    const leg = mesh(new THREE.BoxGeometry(4, 72, 4), legMat, true, false);
    leg.position.set(x, -40, z);
  }
  col.bounds = { minX: -83, maxX: 83, minZ: -40, maxZ: 40 };

  await yieldFrame();

  // =============== MONITOR ===============
  progress(0.3, 'Booting the monitor');
  const plasticDark = std({ color: 0x141518, roughness: 0.42, metalness: 0.15 });
  const alu = std({ color: 0x9a9da3, roughness: 0.35, metalness: 0.9 });
  const base = mesh(new RoundedBoxGeometry(28, 1.2, 17, 2, 0.4), alu);
  base.position.set(0, 0.6, -30);
  col.addBox(0, 0.6, -30, 28, 1.2, 17);
  const neck = mesh(new RoundedBoxGeometry(6, 16, 3, 2, 0.5), alu);
  neck.position.set(0, 9, -35);
  col.addBox(0, 9, -35, 6, 16, 3);
  const bezel = mesh(new RoundedBoxGeometry(64, 38, 2.2, 2, 0.4), plasticDark);
  bezel.position.set(0, 28, -34.5);
  col.addBox(0, 28, -34.5, 64, 38, 2.2);

  const screenTex = await new Promise<THREE.Texture>((resolve) => {
    new THREE.TextureLoader().load(
      screenUrl,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      () => resolve(new THREE.Texture()),
    );
  });
  const screenMat = std({
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: screenTex,
    emissiveIntensity: 1.15,
    roughness: 0.2,
    metalness: 0.0,
  });
  const screen = mesh(new THREE.PlaneGeometry(61, 34.3), screenMat, false, false);
  screen.position.set(0, 28.2, -33.38);
  animated.push({
    update: (t) => {
      screenMat.emissiveIntensity = 1.1 + Math.sin(t * 60) * 0.02 + Math.sin(t * 7.3) * 0.03;
    },
  });
  if (quality !== 'low') {
    RectAreaLightUniformsLib.init();
    const rect = new THREE.RectAreaLight(0x6f9bff, 1.6, 61, 34);
    rect.position.set(0, 28.2, -33.3);
    rect.lookAt(0, 28.2, 0);
    scene.add(rect);
  } else {
    const p = new THREE.PointLight(0x6f9bff, 900, 120, 2);
    p.position.set(0, 24, -25);
    scene.add(p);
  }
  // power LED
  const led = mesh(new THREE.BoxGeometry(0.8, 0.3, 0.2), new THREE.MeshBasicMaterial({ color: 0x66ffcc }), false, false);
  led.position.set(28, 10, -33.35);

  // sticky notes on bezel
  const noteMat1 = std({ map: makeStickyNote('#ffe45c', 'CALL MOM\n(again)'), roughness: 0.9 });
  const n1 = mesh(new THREE.PlaneGeometry(7.6, 7.6), noteMat1, false, false);
  n1.position.set(-27, 42, -33.3);
  n1.rotation.z = 0.08;
  const noteMat2 = std({ map: makeStickyNote('#ff9ec7', 'DEPLOY\nFRIDAY!!'), roughness: 0.9 });
  const n2 = mesh(new THREE.PlaneGeometry(7.6, 7.6), noteMat2, false, false);
  n2.position.set(26, 44, -33.3);
  n2.rotation.z = -0.12;

  await yieldFrame();

  // =============== KEYBOARD ===============
  progress(0.42, 'Assembling the keyboard');
  const KB = { x: 0, z: 9, w: 31.6, d: 13.7, h: 1.35 };
  const kbBody = mesh(new RoundedBoxGeometry(KB.w, KB.h, KB.d, 2, 0.35), std({ color: 0x202228, roughness: 0.55, metalness: 0.3 }));
  kbBody.position.set(KB.x, KB.h / 2, KB.z);
  col.addBox(KB.x, KB.h / 2, KB.z, KB.w, KB.h, KB.d);
  // rgb glow plate
  const glowGeo = new THREE.PlaneGeometry(KB.w - 1.6, KB.d - 1.4, 24, 1);
  const gcols: number[] = [];
  const gpos = glowGeo.attributes.position;
  const tmpC = new THREE.Color();
  for (let i = 0; i < gpos.count; i++) {
    const u = (gpos.getX(i) + (KB.w - 1.6) / 2) / (KB.w - 1.6);
    tmpC.setHSL(0.55 + u * 0.35, 1, 0.55);
    gcols.push(tmpC.r, tmpC.g, tmpC.b);
  }
  glowGeo.setAttribute('color', new THREE.Float32BufferAttribute(gcols, 3));
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const glow = mesh(glowGeo, glowMat, false, false);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(KB.x, KB.h + 0.02, KB.z);
  animated.push({
    update: (t) => {
      glowMat.color.setScalar(0.75 + Math.sin(t * 1.5) * 0.25);
    },
  });

  const keys = buildKeyLayout();
  const atlas = makeKeyAtlas(keys);
  const keyGeos: THREE.BufferGeometry[] = [];
  const rowZ0 = KB.z - KB.d / 2 + 1.05;
  const keyH = 0.85;
  keys.forEach((k, i) => {
    const w = k.w * U - 0.3;
    const d = U - 0.3;
    const g = new RoundedBoxGeometry(w, keyH, d, 2, 0.14);
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const uv = g.attributes.uv;
    const colIdx = i % atlas.cols;
    const rowIdx = Math.floor(i / atlas.cols);
    const sIdx = KEY_SOLID_CELL + (k.accent ?? 0);
    const su = (sIdx % atlas.cols + 0.5) / atlas.cols;
    const sv = 1 - (Math.floor(sIdx / atlas.cols) + 0.5) / atlas.rows;
    for (let v = 0; v < pos.count; v++) {
      if (nor.getY(v) > 0.75) {
        const lx = pos.getX(v) / w + 0.5;
        const lz = pos.getZ(v) / d + 0.5;
        uv.setXY(v, (colIdx + lx) / atlas.cols, 1 - (rowIdx + lz) / atlas.rows);
      } else {
        uv.setXY(v, su, sv);
      }
    }
    const cx = KB.x - (15 * U) / 2 + (k.x + k.w / 2) * U;
    const cz = rowZ0 + (k.row + 0.5) * U;
    // slight sculpted row height variation
    const cy = KB.h + keyH / 2 + (k.row === 0 ? 0.05 : 0);
    g.translate(cx, cy, cz);
    keyGeos.push(g);
    col.addBox(cx, cy, cz, w, keyH, d);
  });
  const keyMerged = mergeGeometries(keyGeos, false)!;
  keyGeos.forEach((g) => g.dispose());
  const keyMat = std({
    map: atlas.texture,
    emissiveMap: atlas.emissive,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.6,
    metalness: 0.05,
  });
  mesh(keyMerged, keyMat);

  await yieldFrame();

  // =============== MOUSE + MOUSEPAD ===============
  progress(0.55, 'Placing the mouse');
  const padTex = makeMousepad();
  padTex.repeat.set(4, 4);
  const pad = mesh(new RoundedBoxGeometry(26, 0.4, 22, 2, 0.15), std({ map: padTex, roughness: 0.95 }));
  pad.position.set(32, 0.2, 9);
  col.addBox(32, 0.2, 9, 26, 0.4, 22);
  const mouseMat = std({ color: 0x1a1b1f, roughness: 0.45, metalness: 0.1 });
  const mouseBody = mesh(new THREE.SphereGeometry(1, 32, 20), mouseMat);
  mouseBody.scale.set(3.3, 2.1, 6.0);
  mouseBody.position.set(31, 1.6, 6);
  const mouseSkirt = mesh(new RoundedBoxGeometry(6.2, 1.4, 11.4, 2, 0.6), mouseMat);
  mouseSkirt.position.set(31, 1.0, 6);
  col.addBox(31, 1.9, 6, 6.2, 3.6, 11.2);
  const wheel = mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 16), std({ color: 0x333, roughness: 0.8 }));
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(31, 3.55, 2.6);
  const mouseLed = mesh(new THREE.BoxGeometry(3.5, 0.15, 0.4), new THREE.MeshBasicMaterial({ color: 0x33aaff }), false, false);
  mouseLed.position.set(31, 1.75, 0.9);
  animated.push({
    update: (t) => {
      (mouseLed.material as THREE.MeshBasicMaterial).color.setHSL((t * 0.05) % 1, 1, 0.6);
    },
  });

  // =============== MUG ===============
  progress(0.62, 'Pouring coffee');
  const mugPos = new THREE.Vector3(-46, 0, -6);
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0, 0.35),
    new THREE.Vector2(3.4, 0.35),
    new THREE.Vector2(3.8, 0),
    new THREE.Vector2(4.0, 0.2),
    new THREE.Vector2(4.25, 4.5),
    new THREE.Vector2(4.4, 9.3),
    new THREE.Vector2(4.35, 9.6),
    new THREE.Vector2(4.0, 9.6),
    new THREE.Vector2(3.95, 9.2),
    new THREE.Vector2(3.8, 4.5),
    new THREE.Vector2(3.5, 0.9),
    new THREE.Vector2(0, 0.9),
  ];
  const mugMat = phys({ color: 0xf1ebe0, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const mug = mesh(new THREE.LatheGeometry(profile, 48), mugMat);
  mug.position.copy(mugPos);
  const handle = mesh(new THREE.TorusGeometry(2.3, 0.6, 14, 28, Math.PI), mugMat);
  handle.position.set(mugPos.x + 4.0, 5.2, mugPos.z);
  handle.rotation.z = -Math.PI / 2;
  const coffee = mesh(new THREE.CircleGeometry(3.9, 40), phys({ color: 0x1d0f06, roughness: 0.08, metalness: 0.05, clearcoat: 1 }), false, false);
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.set(mugPos.x, 8.4, mugPos.z);
  col.addCyl(mugPos.x, mugPos.z, 4.45, 0, 9.6);
  col.addBox(mugPos.x + 5.3, 5.2, mugPos.z, 3.2, 5.8, 1.2);
  // coffee stain ring
  const stain = mesh(
    new THREE.RingGeometry(3.6, 4.4, 48),
    std({ color: 0x3a2210, roughness: 1, transparent: true, opacity: 0.45 }),
    false,
    true,
  );
  stain.rotation.x = -Math.PI / 2;
  stain.position.set(mugPos.x + 9, 0.02, mugPos.z + 11);

  await yieldFrame();

  // =============== NOTEBOOK + PEN ===============
  progress(0.7, 'Scribbling in the notebook');
  const paper = makePaper(512, true);
  const nb = { x: -44, z: 22, w: 22, d: 16, h: 1.6 };
  const pageSideMat = std({ color: 0xe9e4d6, roughness: 0.95 });
  const nbMesh = mesh(new THREE.BoxGeometry(nb.w, nb.h, nb.d), [
    pageSideMat,
    pageSideMat,
    std({ map: paper, roughness: 0.9 }),
    std({ color: 0x2f3542, roughness: 0.8 }),
    pageSideMat,
    pageSideMat,
  ]);
  nbMesh.position.set(nb.x, nb.h / 2, nb.z);
  col.addBox(nb.x, nb.h / 2, nb.z, nb.w, nb.h, nb.d);
  const ringMat = std({ color: 0xbfc3c9, roughness: 0.3, metalness: 1 });
  for (let i = 0; i < 14; i++) {
    const r = mesh(new THREE.TorusGeometry(0.95, 0.12, 8, 18), ringMat);
    r.position.set(nb.x - nb.w / 2 + 1.2 + i * 1.45, nb.h / 2 + 0.2, nb.z - nb.d / 2);
  }
  // pen
  const pen = new THREE.Group();
  const penBody = mesh(new THREE.CylinderGeometry(0.42, 0.42, 13.5, 16), phys({ color: 0x1c2a5a, roughness: 0.3, clearcoat: 1 }));
  const penTip = mesh(new THREE.ConeGeometry(0.42, 1.2, 16), alu);
  penTip.position.y = -7.35;
  penTip.rotation.x = Math.PI;
  const penClip = mesh(new THREE.BoxGeometry(0.25, 3.5, 0.2), alu);
  penClip.position.set(0, 4.5, 0.5);
  pen.add(penBody, penTip, penClip);
  pen.rotation.z = Math.PI / 2;
  pen.rotation.y = 0.25;
  pen.position.set(nb.x + 2, nb.h + 0.45, nb.z - 3);
  scene.add(pen);
  addSegmentedCollider(col, pen.position, 13.5, Math.PI / 2 + 0.25, 0.85);

  // =============== BOOK ===============
  const book = { x: -66, z: -18, w: 19, d: 26, h: 3.2 };
  const bookMesh = mesh(new RoundedBoxGeometry(book.w, book.h, book.d, 2, 0.3), [
    pageSideMat,
    std({ color: 0x6b1f1f, roughness: 0.6 }),
    std({ color: 0x6b1f1f, roughness: 0.6 }),
    std({ color: 0x6b1f1f, roughness: 0.6 }),
    pageSideMat,
    pageSideMat,
  ]);
  bookMesh.position.set(book.x, book.h / 2, book.z);
  col.addBox(book.x, book.h / 2, book.z, book.w, book.h, book.d);
  const bookTitle = mesh(new THREE.PlaneGeometry(10, 2), std({ color: 0xd9b45a, roughness: 0.4, metalness: 0.6 }), false, false);
  bookTitle.rotation.x = -Math.PI / 2;
  bookTitle.position.set(book.x, book.h + 0.01, book.z - 6);

  await yieldFrame();

  // =============== PENCILS ===============
  progress(0.76, 'Sharpening pencils');
  const pencilMat = std({ color: 0xf2b21b, roughness: 0.5 });
  const eraserMat = std({ color: 0xe88a9a, roughness: 0.9 });
  const woodTipMat = std({ color: 0xd9b382, roughness: 0.8 });
  const graphiteMat = std({ color: 0x222, roughness: 0.4, metalness: 0.4 });
  const makePencil = (x: number, z: number, angle: number) => {
    const g = new THREE.Group();
    const len = 17;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, len, 6), pencilMat);
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 1.1, 12), alu);
    ferrule.position.y = len / 2 + 0.55;
    const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12), eraserMat);
    eraser.position.y = len / 2 + 1.5;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.6, 12), woodTipMat);
    tip.position.y = -len / 2 - 0.8;
    tip.rotation.x = Math.PI;
    const lead = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 8), graphiteMat);
    lead.position.y = -len / 2 - 1.85;
    lead.rotation.x = Math.PI;
    [body, ferrule, eraser, tip, lead].forEach((m) => {
      m.castShadow = shadows;
      m.receiveShadow = shadows;
      g.add(m);
    });
    g.rotation.order = 'YXZ';
    g.rotation.y = angle;
    g.rotation.z = Math.PI / 2;
    g.position.set(x, 0.37, z);
    scene.add(g);
    addSegmentedCollider(col, g.position, len + 4, angle, 0.74);
  };
  makePencil(-22, 30, 0.35);
  makePencil(18, 30, -0.2);
  makePencil(-30, -30, 1.25);

  // =============== LAMP ===============
  progress(0.8, 'Bolting the lamp');
  const lampMat = std({ color: 0x23262b, roughness: 0.35, metalness: 0.8 });
  const lampBasePos = new THREE.Vector3(60, 0, -24);
  const lampBase = mesh(new THREE.CylinderGeometry(7.5, 8, 1.8, 40), lampMat);
  lampBase.position.set(lampBasePos.x, 0.9, lampBasePos.z);
  col.addCyl(lampBasePos.x, lampBasePos.z, 8, 0, 1.8);
  const joint1 = new THREE.Vector3(60, 30, -24);
  cylinderBetween(scene, new THREE.Vector3(60, 1.8, -24), joint1, 0.8, lampMat, shadows);
  col.addCyl(60, -24, 0.9, 1.8, 30);
  const joint2 = lampHead.clone().add(new THREE.Vector3(2, 3, -1));
  cylinderBetween(scene, joint1, joint2, 0.65, lampMat, shadows);
  const j1 = mesh(new THREE.SphereGeometry(1.2, 16, 12), lampMat);
  j1.position.copy(joint1);
  const j2 = mesh(new THREE.SphereGeometry(1.0, 16, 12), lampMat);
  j2.position.copy(joint2);
  // head (cone shade)
  const shadeProfile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(2.5, 0),
    new THREE.Vector2(3.5, 2),
    new THREE.Vector2(7.5, 9),
    new THREE.Vector2(7.7, 9.3),
    new THREE.Vector2(7.2, 9.3),
    new THREE.Vector2(3.2, 2.2),
    new THREE.Vector2(2.3, 0.4),
  ];
  const shade = new THREE.Mesh(new THREE.LatheGeometry(shadeProfile, 40), std({ color: 0x2a2d33, roughness: 0.4, metalness: 0.7, side: THREE.DoubleSide }));
  shade.castShadow = false;
  const headGroup = new THREE.Group();
  headGroup.position.copy(lampHead);
  const dir = lamp.target.position.clone().sub(lampHead).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  headGroup.quaternion.copy(q);
  shade.position.y = 0;
  shade.rotation.x = Math.PI;
  headGroup.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe9c4, toneMapped: false }));
  bulb.position.y = -3;
  headGroup.add(bulb);
  scene.add(headGroup);
  // lamp flicker
  animated.push({
    update: (t) => {
      lamp.intensity = 260 + Math.sin(t * 37) * 2 + Math.sin(t * 3) * 3;
    },
  });

  await yieldFrame();

  // =============== PHONE ===============
  progress(0.86, 'Charging the phone');
  const phone = { x: 58, z: 16, w: 7.3, d: 15, h: 0.85 };
  const phoneBody = mesh(new RoundedBoxGeometry(phone.w, phone.h, phone.d, 3, 0.4), phys({ color: 0x1c1f26, roughness: 0.2, metalness: 0.6, clearcoat: 1 }));
  phoneBody.position.set(phone.x, phone.h / 2, phone.z);
  phoneBody.rotation.y = 0.0;
  col.addBox(phone.x, phone.h / 2, phone.z, phone.w, phone.h, phone.d);
  const phoneScreenMat = std({ color: 0x000, emissive: 0xffffff, emissiveMap: makePhoneScreen(), emissiveIntensity: 1.0, roughness: 0.15 });
  const phoneScreen = mesh(new THREE.PlaneGeometry(phone.w - 0.6, phone.d - 0.8), phoneScreenMat, false, false);
  phoneScreen.rotation.x = -Math.PI / 2;
  phoneScreen.position.set(phone.x, phone.h + 0.01, phone.z);
  animated.push({
    update: (t) => {
      phoneScreenMat.emissiveIntensity = 0.9 + Math.max(0, Math.sin(t * 0.7)) * 0.3;
    },
  });

  // =============== USB DRIVES ===============
  progress(0.9, 'Scattering USB drives');
  const usbBodyMats = [std({ color: 0x2b6cb0, roughness: 0.4 }), std({ color: 0x2d3748, roughness: 0.5 }), std({ color: 0xc53030, roughness: 0.4 })];
  const usbPositions: [number, number, number][] = [
    [18, 25, 0.4],
    [-18, -16, -0.9],
    [46, -6, 2.2],
  ];
  usbPositions.forEach(([x, z, rot], i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.9, 4.2, 2, 0.25), usbBodyMats[i]);
    const plug = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 1.4), alu);
    plug.position.set(0, 0, 2.7);
    const ledm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), new THREE.MeshBasicMaterial({ color: 0x66ff88 }));
    ledm.position.set(0.5, 0.46, -1.5);
    [body, plug].forEach((m) => {
      m.castShadow = shadows;
      m.receiveShadow = shadows;
    });
    g.add(body, plug, ledm);
    g.position.set(x, 0.45, z);
    g.rotation.y = rot;
    scene.add(g);
    col.addBox(x, 0.45, z, 3.2, 0.9, 3.2);
  });

  // =============== STICKY NOTES & PADS ===============
  const noteColors = ['#ffe45c', '#9be7ff', '#c4f27a', '#ffb0c9'];
  const noteTexts = ['TODO:\nfix bugs', 'wifi:\nhunter2', 'buy\ncoffee', 'meeting\n@ 3pm'];
  const notePositions: [number, number, number][] = [
    [-12, -24, 0.3],
    [40, -20, -0.4],
    [-60, 12, 0.2],
    [8, 30, -0.15],
  ];
  notePositions.forEach(([x, z, rot], i) => {
    const m = mesh(new THREE.PlaneGeometry(7.6, 7.6), std({ map: makeStickyNote(noteColors[i], noteTexts[i]), roughness: 0.9 }), false, true);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, 0.03, z);
  });
  const padYellow = mesh(new THREE.BoxGeometry(7.6, 1.3, 7.6), std({ color: 0xffe45c, roughness: 0.9 }));
  padYellow.position.set(-24, 0.65, 14);
  padYellow.rotation.y = 0.0;
  col.addBox(-24, 0.65, 14, 7.6, 1.3, 7.6);
  const padPink = mesh(new THREE.BoxGeometry(7.6, 1.0, 7.6), std({ color: 0xffb0c9, roughness: 0.9 }));
  padPink.position.set(24, 0.5, -14);
  col.addBox(24, 0.5, -14, 7.6, 1.0, 7.6);

  // =============== PAPER CLIPS ===============
  const clipMat = std({ color: 0xd8dbe0, roughness: 0.25, metalness: 1 });
  const clipCurve = new THREE.CatmullRomCurve3(
    [
      [-1.6, -0.55],
      [1.4, -0.55],
      [1.75, 0],
      [1.4, 0.55],
      [-1.3, 0.55],
      [-1.65, 0.1],
      [-1.3, -0.25],
      [1.0, -0.25],
      [1.25, 0.05],
      [1.0, 0.3],
      [-0.9, 0.3],
    ].map(([x, z]) => new THREE.Vector3(x, 0, z)),
    false,
    'catmullrom',
    0.2,
  );
  const clipGeo = new THREE.TubeGeometry(clipCurve, 64, 0.09, 8, false);
  const rnd = mulberry32(42);
  for (let i = 0; i < 9; i++) {
    const c = mesh(clipGeo, clipMat, true, false);
    c.position.set(-70 + rnd() * 140, 0.1, -36 + rnd() * 72);
    c.rotation.y = rnd() * Math.PI * 2;
  }

  // =============== CABLES ===============
  progress(0.95, 'Routing cables');
  const cableMat = std({ color: 0x0f0f11, roughness: 0.7, metalness: 0.05 });
  const braidMat = std({ color: 0x2b2f3a, roughness: 0.85 });
  const makeCable = (pts: [number, number, number][], r: number, mat: THREE.Material) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const geo = new THREE.TubeGeometry(curve, 48, r, 8, false);
    mesh(geo, mat, true, true);
  };
  makeCable(
    [
      [KB.x - 8, 0.8, KB.z - KB.d / 2 - 0.2],
      [-10, 0.3, -2],
      [-14, 0.3, -18],
      [-16, 0.3, -30],
      [-18, 0.3, -44],
    ],
    0.3,
    braidMat,
  );
  makeCable(
    [
      [31, 1.6, 0.3],
      [28, 0.3, -6],
      [20, 0.3, -12],
      [18, 0.3, -24],
      [14, 0.3, -38],
      [14, 0.3, -44],
    ],
    0.24,
    cableMat,
  );
  makeCable(
    [
      [phone.x, 0.4, phone.z + phone.d / 2 + 0.2],
      [phone.x + 6, 0.3, phone.z + 12],
      [phone.x + 14, 0.3, phone.z + 6],
      [phone.x + 20, 0.3, -10],
      [phone.x + 20, 0.3, -44],
    ],
    0.22,
    std({ color: 0xf0f0f0, roughness: 0.8 }),
  );
  makeCable(
    [
      [lampBasePos.x + 2, 0.3, lampBasePos.z - 4],
      [lampBasePos.x + 8, 0.3, lampBasePos.z - 12],
      [lampBasePos.x + 6, 0.3, -44],
    ],
    0.28,
    cableMat,
  );

  progress(1, 'Ready');

  return {
    lamp,
    lampHead,
    mugTop: new THREE.Vector3(mugPos.x, 9.8, mugPos.z),
    groundSpawns: [
      new THREE.Vector3(-74, 0, -32),
      new THREE.Vector3(74, 0, -34),
      new THREE.Vector3(-76, 0, 34),
      new THREE.Vector3(76, 0, 34),
      new THREE.Vector3(-40, 0, -38),
      new THREE.Vector3(40, 0, -38),
      new THREE.Vector3(0, 0, 38),
      new THREE.Vector3(-78, 0, 0),
      new THREE.Vector3(78, 0, 0),
    ],
    airSpawns: [
      new THREE.Vector3(-70, 16, -20),
      new THREE.Vector3(70, 18, -20),
      new THREE.Vector3(-70, 15, 30),
      new THREE.Vector3(70, 15, 30),
      new THREE.Vector3(0, 20, -20),
      new THREE.Vector3(0, 18, 38),
    ],
    turretSpots: [
      new THREE.Vector3(nb.x, nb.h, nb.z),
      new THREE.Vector3(phone.x, phone.h, phone.z),
      new THREE.Vector3(book.x, book.h, book.z),
      new THREE.Vector3(24, 1.0, -14),
      new THREE.Vector3(-24, 1.3, 14),
      new THREE.Vector3(40, 0.4, 18),
      new THREE.Vector3(-70, 0, 34),
      new THREE.Vector3(72, 0, -34),
    ],
    playerSpawn: new THREE.Vector3(0, 0, 26),
    animated,
  };
}

function addSegmentedCollider(col: CollisionWorld, center: THREE.Vector3, length: number, angleY: number, size: number) {
  // A rod lying along direction rotated by angleY around Y (starting from +x axis)
  const dx = Math.cos(angleY);
  const dz = -Math.sin(angleY);
  const n = Math.ceil(length / (size * 0.9));
  for (let i = 0; i < n; i++) {
    const t = -length / 2 + (i + 0.5) * (length / n);
    col.addBox(center.x + dx * t, size / 2, center.z + dz * t, size * 1.1, size, size * 1.1);
  }
}

function cylinderBetween(scene: THREE.Scene, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, shadows: boolean) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r, r, len, 16);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = shadows;
  m.receiveShadow = shadows;
  m.position.copy(a).add(b).multiplyScalar(0.5);
  const dir = b.clone().sub(a).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  scene.add(m);
  return m;
}
