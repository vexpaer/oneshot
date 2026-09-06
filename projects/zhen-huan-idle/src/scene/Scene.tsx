import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
type NightRef = MutableRefObject<number>;
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { useGame, rivalActive } from '../game/store';
import { RANKS, RIVALS, ALLIES, ALLY_MAP, FLIP_TIME } from '../game/data';
import { fmt } from '../game/format';
import { useUI } from '../ui/uiStore';

// ───────────────────────── 布局 ─────────────────────────
const HALL_POS = new THREE.Vector3(0, 0, -36);
const HALL_FRONT = new THREE.Vector3(0, 0, -27.5);
const PLAYER_FRONT = new THREE.Vector3(0, 0, 6.5);
// 西六宫（x<0）与东六宫（x>0），沿中轴对称排布
export const RIVAL_POS: Record<string, [number, number, number]> = {
  xiadongchun: [-14, 0, 12],
  lipin: [-14, 0, 3],
  fucha: [-14, 0, -7],
  anlingrong: [-14, 0, -17],
  huafei: [-15, 0, -28],
  caoguiren: [14, 0, 12],
  qifei: [14, 0, 3],
  qiguiren: [14, 0, -7],
  huanghou: [15, 0, -28],
};

function rivalFront(id: string): THREE.Vector3 {
  const p = RIVAL_POS[id];
  return new THREE.Vector3(p[0] > 0 ? p[0] - 5 : p[0] + 5, 0, p[2]);
}

// ───────────────────────── 材质 ─────────────────────────
const M = {
  wall: new THREE.MeshStandardMaterial({ color: '#8f2b21', roughness: 0.85 }),
  wallDim: new THREE.MeshStandardMaterial({ color: '#4a3a36', roughness: 0.95 }),
  column: new THREE.MeshStandardMaterial({ color: '#b93a2c', roughness: 0.6 }),
  columnDim: new THREE.MeshStandardMaterial({ color: '#5a4642', roughness: 0.9 }),
  marble: new THREE.MeshStandardMaterial({ color: '#d9d2c2', roughness: 0.9 }),
  floor: new THREE.MeshStandardMaterial({ color: '#5b3a2e', roughness: 0.9 }),
  beam: new THREE.MeshStandardMaterial({ color: '#26506b', roughness: 0.6 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d9ad3a', roughness: 0.35, metalness: 0.6 }),
  roofGrey: new THREE.MeshStandardMaterial({ color: '#5a5d63', roughness: 0.8 }),
  roofGreen: new THREE.MeshStandardMaterial({ color: '#3d7457', roughness: 0.55 }),
  roofGold: new THREE.MeshStandardMaterial({ color: '#d3a021', roughness: 0.45, metalness: 0.25 }),
  roofDim: new THREE.MeshStandardMaterial({ color: '#3a3a3e', roughness: 1 }),
  ridge: new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.7 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#4a3526', roughness: 1 }),
  blossom: new THREE.MeshStandardMaterial({ color: '#e9a9b8', roughness: 0.9 }),
  blossomDeep: new THREE.MeshStandardMaterial({ color: '#d47f95', roughness: 0.9 }),
  skin: new THREE.MeshStandardMaterial({ color: '#f1d7c1', roughness: 0.8 }),
  hair: new THREE.MeshStandardMaterial({ color: '#17120f', roughness: 0.9 }),
  water: new THREE.MeshStandardMaterial({ color: '#3f6f7a', roughness: 0.15, metalness: 0.3 }),
  seal: new THREE.MeshStandardMaterial({ color: '#e8dcc2', roughness: 1 }),
  wood: new THREE.MeshStandardMaterial({ color: '#6b4a32', roughness: 1 }),
};

const G = {
  roofCone: new THREE.ConeGeometry(1, 1, 4, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  body: new THREE.CylinderGeometry(0.2, 0.34, 0.95, 10),
  head: new THREE.SphereGeometry(0.17, 14, 12),
  sphere: new THREE.SphereGeometry(1, 12, 10),
  lantern: new THREE.SphereGeometry(0.22, 12, 10),
};

// ───────────────────────── 昼夜 ─────────────────────────
function sunElevation(t: number) {
  return -Math.cos(t * Math.PI * 2); // 0=子时 0.5=午时
}
const SKY_NIGHT = new THREE.Color('#0a0d1c');
const SKY_DUSK = new THREE.Color('#c9774a');
const SKY_DAY = new THREE.Color('#c8d3d6');
const tmpColor = new THREE.Color();
function skyColor(e: number, out: THREE.Color) {
  if (e < -0.25) return out.copy(SKY_NIGHT);
  if (e < 0.15) return out.copy(SKY_NIGHT).lerp(SKY_DUSK, (e + 0.25) / 0.4);
  return out.copy(SKY_DUSK).lerp(SKY_DAY, Math.min(1, (e - 0.15) / 0.45));
}

function Atmosphere({ quality }: { quality: 'high' | 'low' }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const moon = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const sunMesh = useRef<THREE.Mesh>(null);
  const moonMesh = useRef<THREE.Mesh>(null);
  const stars = useRef<THREE.Group>(null);
  const { scene } = useThree();
  const fog = useMemo(() => new THREE.Fog('#c8d3d6', 40, 120), []);
  useEffect(() => { scene.fog = fog; scene.background = new THREE.Color('#c8d3d6'); return () => { scene.fog = null; }; }, [scene, fog]);

  useFrame(() => {
    const t = useGame.getState().dayTime;
    const e = sunElevation(t);
    skyColor(e, tmpColor);
    fog.color.copy(tmpColor);
    if (scene.background instanceof THREE.Color) scene.background.copy(tmpColor);
    else scene.background = tmpColor.clone();
    const ang = (t - 0.25) * Math.PI * 2; // 卯时日出
    const sx = Math.cos(ang) * 40, sy = Math.sin(ang) * 40;
    if (sun.current) {
      sun.current.position.set(sx, Math.max(sy, -5), -10);
      sun.current.intensity = Math.max(0, e) * 2.2;
      sun.current.color.setHSL(0.09, 0.6, 0.5 + Math.min(0.4, Math.max(0, e)) * 0.9);
    }
    if (moon.current) { moon.current.position.set(-sx, Math.max(-sy, -5), -10); moon.current.intensity = Math.max(0, -e) * 0.45; }
    if (amb.current) amb.current.intensity = 0.22 + Math.max(0, e) * 0.5;
    if (hemi.current) hemi.current.intensity = 0.25 + Math.max(0, e) * 0.55;
    if (sunMesh.current) { sunMesh.current.position.set(sx * 2.2, sy * 2.2, -80); sunMesh.current.visible = sy > -3; }
    if (moonMesh.current) { moonMesh.current.position.set(-sx * 2.2, -sy * 2.2, -80); moonMesh.current.visible = -sy > -3; }
    if (stars.current) stars.current.visible = e < 0;
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.4} />
      <hemisphereLight ref={hemi} args={['#dfe6ea', '#4a3a30', 0.5]} />
      <directionalLight ref={sun} castShadow={quality === 'high'} shadow-mapSize={[2048, 2048]} shadow-camera-left={-40} shadow-camera-right={40} shadow-camera-top={40} shadow-camera-bottom={-40} shadow-camera-near={1} shadow-camera-far={120} shadow-bias={-0.0006} />
      <directionalLight ref={moon} color="#8fa6d8" />
      <mesh ref={sunMesh}><sphereGeometry args={[3.2, 16, 12]} /><meshBasicMaterial color="#ffe0a0" fog={false} /></mesh>
      <mesh ref={moonMesh}><sphereGeometry args={[2.4, 16, 12]} /><meshBasicMaterial color="#e8ecf5" fog={false} /></mesh>
      <group ref={stars}><Stars radius={90} depth={20} count={quality === 'high' ? 1500 : 500} factor={3} saturation={0} fade speed={0.4} /></group>
    </>
  );
}

// ───────────────────────── 地面与宫墙 ─────────────────────────
function makeStoneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8e857a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 40},${30 + Math.random() * 30},${20 + Math.random() * 30},${Math.random() * 0.12})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 2 + Math.random() * 6);
  }
  ctx.strokeStyle = 'rgba(40,30,25,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 40);
  tex.anisotropy = 4;
  return tex;
}

function Ground() {
  const tex = useMemo(makeStoneTexture, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow position-y={0}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial map={tex} roughness={0.95} />
      </mesh>
      {/* 御道 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, -12]} receiveShadow>
        <planeGeometry args={[4.5, 60]} />
        <meshStandardMaterial color="#c9c0ae" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Walls() {
  const segs: { p: [number, number, number]; s: [number, number, number] }[] = [
    { p: [0, 2.2, -48], s: [80, 4.4, 1.2] },
    { p: [-40, 2.2, -8], s: [1.2, 4.4, 80] },
    { p: [40, 2.2, -8], s: [1.2, 4.4, 80] },
  ];
  return (
    <group>
      {segs.map((w, i) => (
        <group key={i} position={w.p}>
          <mesh geometry={G.box} material={M.wall} scale={w.s} castShadow receiveShadow />
          <mesh geometry={G.box} material={M.roofGold} scale={[w.s[0] + 0.8, 0.5, w.s[2] + 0.8]} position-y={w.s[1] / 2 + 0.2} />
        </group>
      ))}
      {/* 角楼 */}
      {[[-40, -48], [40, -48]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={G.box} material={M.wall} scale={[5, 6, 5]} position-y={3} />
          <mesh geometry={G.roofCone} material={M.roofGold} scale={[4.6, 2.4, 4.6]} rotation-y={Math.PI / 4} position-y={7.2} />
        </group>
      ))}
    </group>
  );
}

// ───────────────────────── 宫殿 ─────────────────────────
interface PalaceProps {
  tier: number;
  dim?: boolean;
  night: NightRef;
  lanternBoost?: NightRef;
  sealed?: boolean;
}

function Lantern({ x, y, z, night, boost }: { x: number; y: number; z: number; night: NightRef; boost?: NightRef }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!mat.current) return;
    mat.current.emissiveIntensity = 0.15 + night.current * 1.6 + (boost?.current ?? 0) * 1.5;
  });
  return (
    <group position={[x, y, z]}>
      <mesh geometry={G.lantern} castShadow={false}>
        <meshStandardMaterial ref={mat} color="#d8302a" emissive="#ff6a3a" emissiveIntensity={0.2} roughness={0.5} />
      </mesh>
      <mesh geometry={G.cyl} material={M.gold} scale={[0.08, 0.06, 0.08]} position-y={0.24} />
      <mesh geometry={G.cyl} material={M.gold} scale={[0.05, 0.14, 0.05]} position-y={-0.28} />
    </group>
  );
}

function Palace({ tier, dim, night, lanternBoost, sealed }: PalaceProps) {
  const w = 3.2 + tier * 1.1; // 面阔
  const d = 2.4 + tier * 0.6; // 进深
  const h = 1.9 + tier * 0.25;
  const cols = 2 + Math.min(4, tier);
  const roofMat = dim ? M.roofDim : tier >= 3 ? M.roofGold : tier >= 1 ? M.roofGreen : M.roofGrey;
  const wallMat = dim ? M.wallDim : M.wall;
  const colMat = dim ? M.columnDim : M.column;
  const roofR = (w / 2 + 0.9) * Math.SQRT2;
  const roofH = 1.1 + tier * 0.28;
  const colXs = useMemo(() => Array.from({ length: cols + 1 }, (_, i) => -w / 2 + (w / cols) * i), [cols, w]);
  return (
    <group>
      {/* 须弥座 */}
      <mesh geometry={G.box} material={M.marble} scale={[w + 1.6, 0.5, d + 1.6]} position-y={0.25} receiveShadow castShadow />
      <mesh geometry={G.box} material={M.marble} scale={[1.8, 0.25, 1.2]} position={[0, 0.125, d / 2 + 1.3]} />
      {tier >= 2 && <mesh geometry={G.box} material={M.marble} scale={[w + 2.6, 0.3, d + 2.6]} position-y={0.15} receiveShadow />}
      {/* 地面 */}
      <mesh geometry={G.box} material={M.floor} scale={[w + 0.4, 0.1, d + 0.4]} position-y={0.55} />
      {/* 后墙与侧墙 */}
      <mesh geometry={G.box} material={wallMat} scale={[w, h, 0.25]} position={[0, 0.55 + h / 2, -d / 2]} castShadow receiveShadow />
      <mesh geometry={G.box} material={wallMat} scale={[0.25, h, d]} position={[-w / 2, 0.55 + h / 2, 0]} castShadow />
      <mesh geometry={G.box} material={wallMat} scale={[0.25, h, d]} position={[w / 2, 0.55 + h / 2, 0]} castShadow />
      {/* 隔扇门 */}
      <mesh geometry={G.box} material={wallMat} scale={[w - 0.5, h - 0.35, 0.12]} position={[0, 0.55 + (h - 0.35) / 2, d / 2 - 0.55]} />
      <mesh geometry={G.box} material={dim ? M.ridge : M.gold} scale={[0.9, h - 0.6, 0.02]} position={[0, 0.55 + (h - 0.6) / 2, d / 2 - 0.48]} />
      {/* 柱 */}
      {colXs.map((x, i) => (
        <mesh key={i} geometry={G.cyl} material={colMat} scale={[0.14, h, 0.14]} position={[x, 0.55 + h / 2, d / 2]} castShadow />
      ))}
      {/* 额枋 */}
      <mesh geometry={G.box} material={dim ? M.ridge : M.beam} scale={[w + 0.4, 0.28, 0.32]} position={[0, 0.55 + h + 0.12, d / 2]} />
      <mesh geometry={G.box} material={dim ? M.ridge : M.gold} scale={[w + 0.4, 0.05, 0.34]} position={[0, 0.55 + h + 0.28, d / 2]} />
      {/* 匾额 */}
      {tier >= 1 && !dim && <mesh geometry={G.box} material={M.gold} scale={[1.2, 0.4, 0.06]} position={[0, 0.55 + h - 0.15, d / 2 + 0.1]} />}
      {/* 屋顶 */}
      <mesh geometry={G.box} material={roofMat} scale={[w + 1.8, 0.18, d + 1.8]} position-y={0.55 + h + 0.35} castShadow />
      <mesh geometry={G.roofCone} material={roofMat} scale={[roofR, roofH, roofR * ((d + 1.8) / (w + 1.8))]} rotation-y={Math.PI / 4} position-y={0.55 + h + 0.44 + roofH / 2} castShadow />
      <mesh geometry={G.box} material={M.ridge} scale={[w * 0.5, 0.16, 0.2]} position-y={0.55 + h + 0.44 + roofH} />
      {/* 重檐 */}
      {tier >= 3 && (
        <>
          <mesh geometry={G.box} material={wallMat} scale={[w * 0.55, 0.8, d * 0.5]} position-y={0.55 + h + 0.44 + roofH + 0.3} />
          <mesh geometry={G.roofCone} material={roofMat} scale={[roofR * 0.62, roofH * 0.8, roofR * 0.62 * ((d + 1.8) / (w + 1.8))]} rotation-y={Math.PI / 4} position-y={0.55 + h + 0.44 + roofH + 0.75 + roofH * 0.4} castShadow />
          <mesh geometry={G.box} material={M.ridge} scale={[w * 0.28, 0.14, 0.18]} position-y={0.55 + h + 0.44 + roofH + 0.78 + roofH * 0.8} />
        </>
      )}
      {/* 侧配殿 */}
      {tier >= 4 && [-1, 1].map((sg) => (
        <group key={sg} position={[sg * (w / 2 + 2.2), 0, -0.3]}>
          <mesh geometry={G.box} material={M.marble} scale={[2.6, 0.4, 2.2]} position-y={0.2} />
          <mesh geometry={G.box} material={wallMat} scale={[2.2, 1.5, 1.8]} position-y={1.15} castShadow />
          <mesh geometry={G.roofCone} material={roofMat} scale={[2.4, 0.9, 2.1]} rotation-y={Math.PI / 4} position-y={2.35} castShadow />
        </group>
      ))}
      {/* 灯笼 */}
      {!dim && colXs.filter((_, i) => i === 0 || i === colXs.length - 1 || (tier >= 2 && i % 2 === 0)).map((x, i) => (
        <Lantern key={i} x={x} y={0.55 + h - 0.35} z={d / 2 + 0.4} night={night} boost={lanternBoost} />
      ))}
      {/* 封条 */}
      {sealed && (
        <group position={[0, 0.55 + h / 2, d / 2 + 0.08]}>
          <mesh geometry={G.box} material={M.wood} scale={[2.2, 0.16, 0.06]} rotation-z={0.5} />
          <mesh geometry={G.box} material={M.wood} scale={[2.2, 0.16, 0.06]} rotation-z={-0.5} />
          <mesh geometry={G.box} material={M.seal} scale={[0.3, 1.1, 0.04]} position-z={0.04} />
        </group>
      )}
    </group>
  );
}

// ───────────────────────── 人物 ─────────────────────────
function Figure({ color, position, rotationY = 0, scale = 1, phase = 0, hair = 'qitou', flower = '#e78fa3' }: { color: string; position: [number, number, number]; rotationY?: number; scale?: number; phase?: number; hair?: 'qitou' | 'bun' | 'hat' | 'cap'; flower?: string }) {
  const g = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.75 }), [color]);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const t = clock.elapsedTime + phase;
    g.current.position.y = position[1] + Math.sin(t * 1.6) * 0.03;
    g.current.rotation.y = rotationY + Math.sin(t * 0.5) * 0.08;
  });
  return (
    <group ref={g} position={position} rotation-y={rotationY} scale={scale}>
      <mesh geometry={G.body} material={mat} position-y={0.48} castShadow />
      <mesh geometry={G.cyl} material={mat} scale={[0.26, 0.22, 0.26]} position-y={0.98} />
      <mesh geometry={G.head} material={M.skin} position-y={1.2} castShadow />
      {hair === 'qitou' && (
        <>
          <mesh geometry={G.box} material={M.hair} scale={[0.56, 0.1, 0.13]} position-y={1.42} />
          <mesh geometry={G.sphere} material={M.hair} scale={[0.17, 0.12, 0.17]} position-y={1.34} />
          <mesh geometry={G.sphere} scale={0.07} position={[0.17, 1.46, 0.05]}><meshStandardMaterial color={flower} /></mesh>
        </>
      )}
      {hair === 'bun' && <mesh geometry={G.sphere} material={M.hair} scale={[0.19, 0.14, 0.19]} position-y={1.33} />}
      {hair === 'hat' && (
        <>
          <mesh geometry={G.cyl} material={M.hair} scale={[0.2, 0.16, 0.2]} position-y={1.4} />
          <mesh geometry={G.sphere} material={M.gold} scale={0.05} position-y={1.5} />
        </>
      )}
      {hair === 'cap' && <mesh geometry={G.cyl} material={M.hair} scale={[0.18, 0.1, 0.18]} position-y={1.37} />}
    </group>
  );
}

function PlumTree({ position, scale = 1, deep }: { position: [number, number, number]; scale?: number; deep?: boolean }) {
  const mat = deep ? M.blossomDeep : M.blossom;
  return (
    <group position={position} scale={scale}>
      <mesh geometry={G.cyl} material={M.trunk} scale={[0.14, 1.6, 0.14]} position-y={0.8} castShadow />
      <mesh geometry={G.cyl} material={M.trunk} scale={[0.08, 1, 0.08]} position={[0.4, 1.5, 0.1]} rotation-z={-0.7} />
      <mesh geometry={G.sphere} material={mat} scale={[0.9, 0.7, 0.9]} position={[0, 2.0, 0]} castShadow />
      <mesh geometry={G.sphere} material={mat} scale={[0.6, 0.5, 0.6]} position={[0.8, 1.85, 0.2]} castShadow />
      <mesh geometry={G.sphere} material={mat} scale={[0.5, 0.45, 0.5]} position={[-0.6, 1.7, -0.2]} />
    </group>
  );
}

// ───────────────────────── 玩家宫殿 ─────────────────────────
function PlayerPalace({ night, onTap }: { night: NightRef; onTap: (p: THREE.Vector3) => void }) {
  const rank = useGame((s) => s.rank);
  const buffed = useGame((s) => s.favorBuffUntil > Date.now());
  const tier = RANKS[rank].tier;
  const boost = useRef(0);
  const g = useRef<THREE.Group>(null);
  const press = useRef(0);
  useFrame((_, dt) => {
    const s = useGame.getState();
    const sedanHere = s.flipDoneToday && s.lastFlip?.winner === 'player' && s.dayTime >= FLIP_TIME;
    boost.current += ((sedanHere || buffed ? 1 : 0) - boost.current) * Math.min(1, dt * 2);
    if (g.current) {
      press.current = Math.max(0, press.current - dt * 6);
      const sc = 1 - press.current * 0.035;
      g.current.scale.set(sc, 1 - press.current * 0.06, sc);
    }
  });
  const handle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    press.current = 1;
    onTap(e.point.clone());
  };
  const trees = useMemo(() => {
    const n = 2 + Math.min(8, rank * 1.2);
    return Array.from({ length: Math.floor(n) }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + 0.6;
      const r = 8.6 + (i % 3) * 1.4;
      // 避开中轴御道与两侧宫人列队
      const x = Math.cos(a) * r;
      const px = Math.abs(x) < 2.6 ? Math.sign(x || 1) * 2.6 : x;
      return { p: [px, 0, Math.sin(a) * r * 0.7 + 2] as [number, number, number], s: 0.8 + (i % 4) * 0.12, deep: i % 3 === 0 };
    });
  }, [rank]);
  return (
    <group>
      <group ref={g} onClick={handle} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
        <Palace tier={tier} night={night} lanternBoost={boost} />
      </group>
      {trees.map((t, i) => <PlumTree key={i} position={t.p} scale={t.s} deep={t.deep} />)}
      {/* 池塘 */}
      {tier >= 3 && (
        <group position={[9.8, 0.03, 9]}>
          <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[2.6, 24]} /><primitive object={M.water} attach="material" /></mesh>
          <mesh rotation-x={-Math.PI / 2} position-y={-0.01}><ringGeometry args={[2.6, 3.0, 24]} /><primitive object={M.marble} attach="material" /></mesh>
        </group>
      )}
      {/* 旌旗 */}
      {tier >= 4 && [-1, 1].map((sg) => (
        <group key={sg} position={[sg * 5.5, 0, 6]}>
          <mesh geometry={G.cyl} material={M.wood} scale={[0.06, 5, 0.06]} position-y={2.5} />
          <mesh geometry={G.box} material={M.gold} scale={[0.05, 1.4, 0.9]} position={[0, 4.2, -0.45]} />
        </group>
      ))}
      <Html position={[0, 4.6 + tier * 1.1, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }} distanceFactor={22}>
        <PlayerLabel />
      </Html>
    </group>
  );
}

function PlayerLabel() {
  const rank = useGame((s) => s.rank);
  const pc = useGame((s) => s.prestigeCount);
  const buffed = useGame((s) => s.favorBuffUntil > Date.now());
  const def = RANKS[rank];
  return (
    <div className={`label3d ${buffed ? 'label3d-gold' : ''}`}>
      <div className="label3d-title">{def.titles[pc > 0 ? 1 : 0]}</div>
      <div className="label3d-sub">{def.palace}{buffed ? ' · 承恩' : ''}</div>
    </div>
  );
}

// ───────────────────────── 对手宫殿 ─────────────────────────
function RivalPalace({ id, night }: { id: string; night: NightRef }) {
  const def = RIVALS.find((r) => r.id === id)!;
  const fallen = useGame((s) => s.rivals[id].fallen);
  const active = useGame((s) => rivalActive(s, id));
  const pos = RIVAL_POS[id];
  const tier = def.flipWeight >= 5 ? 3 : def.flipWeight >= 2.5 ? 2 : def.flipWeight >= 1.5 ? 1 : 0;
  const boost = useRef(0);
  useFrame((_, dt) => {
    const s = useGame.getState();
    const here = s.flipDoneToday && s.lastFlip?.winner === id && s.dayTime >= FLIP_TIME;
    boost.current += ((here ? 1 : 0) - boost.current) * Math.min(1, dt * 2);
  });
  const select = useUI((s) => s.selectRival);
  return (
    <group position={pos} rotation-y={pos[0] > 0 ? Math.PI / 2 : -Math.PI / 2}>
      <group onClick={(e) => { e.stopPropagation(); select(id); }} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = 'auto')}>
        <Palace tier={tier} dim={fallen || !active} night={night} lanternBoost={boost} sealed={fallen} />
      </group>
      {!fallen && active && <Figure color={def.color} position={[0, 0.6, tier * 0.3 + 0.8]} scale={0.85} phase={pos[2]} flower={def.id === 'huanghou' ? '#f2c94c' : '#e78fa3'} />}
      {(active || fallen) && (
        <Html position={[0, 4.4 + tier * 0.9, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }} distanceFactor={22}>
          <RivalLabel id={id} />
        </Html>
      )}
    </group>
  );
}

function RivalLabel({ id }: { id: string }) {
  const def = RIVALS.find((r) => r.id === id)!;
  const st = useGame((s) => s.rivals[id]);
  const pct = Math.min(100, (st.power / def.power) * 100);
  return (
    <div className={`label3d ${st.fallen ? 'label3d-dead' : 'label3d-rival'}`}>
      <div className="label3d-title">{def.title}</div>
      {st.fallen ? <div className="label3d-sub">已倒台</div> : (
        <div className="label3d-bar"><div style={{ width: `${pct}%`, background: def.color }} /></div>
      )}
    </div>
  );
}

// ───────────────────────── 养心殿 ─────────────────────────
function EmperorHall({ night }: { night: NightRef }) {
  return (
    <group position={HALL_POS.toArray() as [number, number, number]}>
      <Palace tier={5} night={night} />
      <Html position={[0, 11.5, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }} distanceFactor={24}>
        <div className="label3d label3d-hall"><div className="label3d-title">养心殿</div></div>
      </Html>
    </group>
  );
}

// ───────────────────────── 盟友 ─────────────────────────
function Allies() {
  const allies = useGame((s) => s.allies);
  const pc = useGame((s) => s.prestigeCount);
  const list = ALLIES.filter((a) => allies.includes(a.id));
  return (
    <group>
      <Figure color={pc > 0 ? '#c9a23a' : '#b8506a'} position={[0, 0, 4.2]} rotationY={Math.PI} scale={1.05} flower="#f2c94c" />
      <Html position={[0, 2.1, 4.2]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }} distanceFactor={18}>
        <div className="label3d label3d-me"><div className="label3d-title">{pc > 0 ? '钮祜禄·甄嬛' : '甄嬛'}</div></div>
      </Html>
      {list.map((a, i) => {
        const n = list.length;
        const ang = n === 1 ? Math.PI * 0.3 : Math.PI * 0.12 + (i / (n - 1)) * Math.PI * 0.76;
        const r = 5.4;
        const px = Math.cos(ang) * r;
        const pz = 5.6 + Math.sin(ang) * 2.4;
        const hair = a.id === 'guojunwang' || a.id === 'zhenyuandao' ? 'hat' : a.id === 'wenshichu' || a.id === 'supeisheng' ? 'cap' : a.id === 'liuzhu' || a.id === 'huanbi' || a.id === 'jinxi' ? 'bun' : 'qitou';
        return (
          <group key={a.id}>
            <Figure color={a.color} position={[px, 0, pz]} rotationY={Math.atan2(px, pz - 4.2) + Math.PI} scale={0.9} phase={i * 1.7} hair={hair} />
            <Html position={[px, 1.9, pz]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }} distanceFactor={18}>
              <div className="label3d label3d-ally"><div className="label3d-title">{a.name}</div></div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

// ───────────────────────── 宫人（实例化） ─────────────────────────
const MAX_MAIDS = 60;
function Maids() {
  const count = useGame((s) => Math.min(MAX_MAIDS, (s.producers.gongnv ?? 0) + (s.producers.taijian ?? 0)));
  const maids = useGame((s) => s.producers.gongnv ?? 0);
  const bodies = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const slots = useMemo(() => Array.from({ length: MAX_MAIDS }, (_, i) => {
    const row = Math.floor(i / 10), col = i % 10;
    const side = i % 2 === 0 ? -1 : 1;
    return { x: side * (9.6 + row * 1.1 + (col % 2) * 0.4), z: -1 + col * 1.1 - 4 + row * 0.2, phase: Math.random() * 6 };
  }), []);
  useEffect(() => {
    if (!bodies.current || !heads.current) return;
    const cMaid = new THREE.Color('#c48fa8'), cEun = new THREE.Color('#6f7a8c');
    for (let i = 0; i < MAX_MAIDS; i++) {
      bodies.current.setColorAt(i, i < Math.min(maids, MAX_MAIDS) ? cMaid : cEun);
    }
    bodies.current.instanceColor!.needsUpdate = true;
  }, [maids]);
  useFrame(({ clock }) => {
    if (!bodies.current || !heads.current) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < MAX_MAIDS; i++) {
      const s = slots[i];
      const vis = i < count;
      const bob = Math.sin(t * 1.5 + s.phase) * 0.03;
      dummy.position.set(s.x, vis ? 0.36 + bob : -10, s.z);
      dummy.rotation.set(0, s.x > 0 ? -Math.PI / 2 : Math.PI / 2, 0);
      dummy.scale.setScalar(0.75);
      dummy.updateMatrix();
      bodies.current.setMatrixAt(i, dummy.matrix);
      dummy.position.y = vis ? 0.9 + bob : -10;
      dummy.updateMatrix();
      heads.current.setMatrixAt(i, dummy.matrix);
    }
    bodies.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <instancedMesh ref={bodies} args={[G.body, undefined, MAX_MAIDS]} castShadow frustumCulled={false}>
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[G.head, M.skin, MAX_MAIDS]} frustumCulled={false} />
    </group>
  );
}

// ───────────────────────── 落梅 ─────────────────────────
function Petals({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = Math.random() * 14;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50 - 5;
      spd[i] = 0.5 + Math.random() * 0.8;
    }
    return { pos, spd };
  }, [count]);
  useFrame(({ clock }, dt) => {
    const p = data.pos;
    const t = clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      p[i * 3 + 1] -= data.spd[i] * dt;
      p[i * 3] += Math.sin(t * 0.8 + i) * dt * 0.5;
      p[i * 3 + 2] += Math.cos(t * 0.6 + i * 0.3) * dt * 0.3;
      if (p[i * 3 + 1] < 0) { p[i * 3 + 1] = 12 + Math.random() * 3; p[i * 3] = (Math.random() - 0.5) * 50; p[i * 3 + 2] = (Math.random() - 0.5) * 50 - 5; }
    }
    if (ref.current) (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[data.pos, 3]} /></bufferGeometry>
      <pointsMaterial size={0.16} color="#f3b3c3" transparent opacity={0.85} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ───────────────────────── 龙辇 ─────────────────────────
function Sedan({ night }: { night: NightRef }) {
  const g = useRef<THREE.Group>(null);
  const pos = useRef(HALL_FRONT.clone());
  const target = useRef(HALL_FRONT.clone());
  const lantern = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }, dt) => {
    const s = useGame.getState();
    const out = s.flipDoneToday && s.lastFlip && s.dayTime >= FLIP_TIME;
    if (out) target.current.copy(s.lastFlip!.winner === 'player' ? PLAYER_FRONT : rivalFront(s.lastFlip!.winner));
    else target.current.copy(HALL_FRONT);
    const k = 1 - Math.exp(-dt * 0.9);
    const before = pos.current.clone();
    pos.current.lerp(target.current, k);
    const moving = before.distanceTo(pos.current) > 0.002;
    if (g.current) {
      g.current.position.copy(pos.current);
      g.current.position.y = Math.sin(clock.elapsedTime * (moving ? 6 : 1.5)) * 0.05;
      if (moving) {
        const dir = target.current.clone().sub(pos.current);
        if (dir.lengthSq() > 0.01) g.current.rotation.y = Math.atan2(dir.x, dir.z);
      }
    }
    if (lantern.current) lantern.current.emissiveIntensity = 0.3 + night.current * 2;
    if (light.current) light.current.intensity = night.current * 6;
  });
  return (
    <group ref={g}>
      <mesh geometry={G.box} material={M.roofGold} scale={[1.3, 1.1, 1.5]} position-y={1.25} castShadow />
      <mesh geometry={G.box} material={M.wall} scale={[1.1, 0.7, 1.3]} position-y={1.25} />
      <mesh geometry={G.roofCone} material={M.roofGold} scale={[1.5, 0.7, 1.6]} rotation-y={Math.PI / 4} position-y={2.15} />
      <mesh geometry={G.box} material={M.wood} scale={[3.2, 0.08, 0.08]} position={[0, 0.85, 0.65]} />
      <mesh geometry={G.box} material={M.wood} scale={[3.2, 0.08, 0.08]} position={[0, 0.85, -0.65]} />
      {[[-1.2, 0.65], [1.2, 0.65], [-1.2, -0.65], [1.2, -0.65]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]} scale={0.7}>
          <mesh geometry={G.body} position-y={0.48}><meshStandardMaterial color="#5a4a3a" /></mesh>
          <mesh geometry={G.head} material={M.skin} position-y={1.15} />
        </group>
      ))}
      <mesh geometry={G.lantern} position={[0, 2.3, 0.9]} scale={0.8}><meshStandardMaterial ref={lantern} color="#d8302a" emissive="#ffb04a" emissiveIntensity={0.5} /></mesh>
      <pointLight ref={light} position={[0, 2.3, 0.9]} color="#ffb060" distance={10} decay={2} />
    </group>
  );
}

// ───────────────────────── 特效爆发 ─────────────────────────
const BURST_N = 90;
function Bursts() {
  const ref = useRef<THREE.Points>(null);
  const st = useRef({ active: false, t: 0, vel: new Float32Array(BURST_N * 3), pos: new Float32Array(BURST_N * 3), life: 1.3 });
  const mat = useRef<THREE.PointsMaterial>(null);
  useEffect(() => {
    return useGame.subscribe((s, prev) => {
      if (!s.fx || s.fx === prev.fx) return;
      const fx = s.fx;
      const origin = fx.target === 'player' ? new THREE.Vector3(0, 3, 0) : new THREE.Vector3(...(RIVAL_POS[fx.target] ?? [0, 0, 0])).add(new THREE.Vector3(0, 3, 0));
      const d = st.current;
      for (let i = 0; i < BURST_N; i++) {
        d.pos[i * 3] = origin.x; d.pos[i * 3 + 1] = origin.y; d.pos[i * 3 + 2] = origin.z;
        const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, sp = 3 + Math.random() * 5;
        d.vel[i * 3] = Math.cos(a) * Math.cos(b) * sp; d.vel[i * 3 + 1] = Math.sin(b) * sp + 3; d.vel[i * 3 + 2] = Math.sin(a) * Math.cos(b) * sp;
      }
      d.active = true; d.t = 0;
      if (mat.current) mat.current.color.set(fx.kind === 'gold' ? '#ffd76a' : fx.kind === 'red' ? '#ff5a4a' : '#f7b7c8');
      if (ref.current) ref.current.visible = true;
    });
  }, []);
  useFrame((_, dt) => {
    const d = st.current;
    if (!d.active || !ref.current) return;
    d.t += dt;
    for (let i = 0; i < BURST_N; i++) {
      d.vel[i * 3 + 1] -= 6 * dt;
      d.pos[i * 3] += d.vel[i * 3] * dt; d.pos[i * 3 + 1] += d.vel[i * 3 + 1] * dt; d.pos[i * 3 + 2] += d.vel[i * 3 + 2] * dt;
    }
    (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    if (mat.current) mat.current.opacity = Math.max(0, 1 - d.t / d.life);
    if (d.t > d.life) { d.active = false; ref.current.visible = false; }
  });
  return (
    <points ref={ref} visible={false} frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[st.current.pos, 3]} /></bufferGeometry>
      <pointsMaterial ref={mat} size={0.3} color="#ffd76a" transparent opacity={1} sizeAttenuation depthWrite={false} />
    </points>
  );
}

// ───────────────────────── 飘字 ─────────────────────────
interface Floater { id: number; p: THREE.Vector3; text: string; big: boolean }
function Floaters({ items }: { items: Floater[] }) {
  return (
    <>
      {items.map((f) => (
        <Html key={f.id} position={f.p} center zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`floater ${f.big ? 'floater-big' : ''}`}>{f.text}</div>
        </Html>
      ))}
    </>
  );
}

// ───────────────────────── 昼夜数值驱动 ─────────────────────────
function NightDriver({ night }: { night: NightRef }) {
  useFrame(() => {
    const e = sunElevation(useGame.getState().dayTime);
    night.current = THREE.MathUtils.clamp((0.1 - e) / 0.35, 0, 1);
  });
  return null;
}

function CameraRig() {
  const autoRotate = useGame((s) => s.settings.autoRotate);
  return <OrbitControls makeDefault target={[0, 2.2, -4]} minDistance={9} maxDistance={55} minPolarAngle={0.45} maxPolarAngle={1.45} enablePan={false} enableDamping dampingFactor={0.08} autoRotate={autoRotate} autoRotateSpeed={0.22} />;
}

// ───────────────────────── 场景入口 ─────────────────────────
export default function Scene() {
  const quality = useGame((s) => s.settings.quality);
  const night = useRef(0);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const idRef = useRef(0);
  const click = useGame((s) => s.click);

  const onTap = (p: THREE.Vector3) => {
    const r = click();
    const id = ++idRef.current;
    const jitter = new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6);
    const f: Floater = { id, p: p.clone().add(jitter), text: r.burst ? `圣心大悦 +${fmt(r.value)}` : `+${fmt(r.value)}`, big: r.burst };
    setFloaters((arr) => [...arr.slice(-14), f]);
    setTimeout(() => setFloaters((arr) => arr.filter((x) => x.id !== id)), r.burst ? 1500 : 900);
  };

  return (
    <Canvas
      key={quality}
      shadows={quality === 'high'}
      dpr={quality === 'high' ? [1, 1.6] : [0.8, 1]}
      camera={{ position: [0, 11, 26], fov: 42, near: 0.5, far: 220 }}
      gl={{ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <NightDriver night={night} />
      <Atmosphere quality={quality} />
      <Ground />
      <Walls />
      <EmperorHall night={night} />
      <PlayerPalace night={night} onTap={onTap} />
      {RIVALS.map((r) => <RivalPalace key={r.id} id={r.id} night={night} />)}
      <Allies />
      <Maids />
      <Petals count={quality === 'high' ? 260 : 90} />
      <Sedan night={night} />
      <Bursts />
      <Floaters items={floaters} />
      <CameraRig />
    </Canvas>
  );
}

export { ALLY_MAP };
