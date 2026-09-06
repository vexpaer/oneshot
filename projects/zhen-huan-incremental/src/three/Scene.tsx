import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame, actions, isRivalActive } from '@/game/engine';
import { RIVALS, PRODUCERS } from '@/game/data';
import { useUI } from '@/ui/uiStore';

// ────────────────────────────────────────────────────────────
// 调色板：随位分推进，世界由春入夏、由秋入冬，再回到春天
// ────────────────────────────────────────────────────────────
interface Palette { bg: string; fog: number; sky: string; ground: string; sun: string; sunI: number; amb: number; sunPos: [number, number, number]; petal: string; petalKind: 'petal' | 'firefly' | 'leaf' | 'snow' | 'gold'; path: string; }
const PALETTES: Palette[] = [
  { bg: '#1c1526', fog: 0.018, sky: '#7a6a9a', ground: '#3b3230', sun: '#ffd6b8', sunI: 1.4, amb: 0.45, sunPos: [12, 14, 8], petal: '#f4b6c2', petalKind: 'petal', path: '#5a4f48' },
  { bg: '#1a1216', fog: 0.02, sky: '#8a6a5a', ground: '#3a302a', sun: '#ffb27a', sunI: 1.5, amb: 0.4, sunPos: [-14, 10, 10], petal: '#c8f07a', petalKind: 'firefly', path: '#5c4d42' },
  { bg: '#0f0b12', fog: 0.024, sky: '#5a4a6a', ground: '#332a28', sun: '#ffc98a', sunI: 1.1, amb: 0.32, sunPos: [10, 8, -14], petal: '#e0a040', petalKind: 'leaf', path: '#54463e' },
  { bg: '#161b26', fog: 0.02, sky: '#8a9ab8', ground: '#c9ced6', sun: '#dfe8f8', sunI: 1.3, amb: 0.5, sunPos: [-8, 16, -10], petal: '#ffffff', petalKind: 'snow', path: '#b8bec8' },
  { bg: '#1a1208', fog: 0.016, sky: '#b08a50', ground: '#3e342c', sun: '#ffd98a', sunI: 1.7, amb: 0.5, sunPos: [14, 18, 6], petal: '#ffd36a', petalKind: 'gold', path: '#6a5a48' },
];
function stageOf(rank: number): number {
  if (rank <= 1) return 0; if (rank <= 3) return 1; if (rank <= 5) return 2; if (rank <= 7) return 3; return 4;
}

// ── 工具几何 ────────────────────────────────────────────────
function hipRoof(w: number, d: number, h: number, ridge = 0.3): THREE.BufferGeometry {
  const hw = w / 2, hd = d / 2, rw = hw * ridge;
  const A = [-hw, 0, hd], B = [hw, 0, hd], C = [hw, 0, -hd], Dd = [-hw, 0, -hd];
  const R1 = [-rw, h, 0], R2 = [rw, h, 0];
  const v: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => v.push(...a, ...b, ...c);
  tri(A, B, R2); tri(A, R2, R1);          // front
  tri(C, Dd, R1); tri(C, R1, R2);         // back
  tri(B, C, R2);                           // right
  tri(Dd, A, R1);                          // left
  // 底面
  tri(B, A, Dd); tri(B, Dd, C);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function softCircleTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}

function brickTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#8a8a8a'; ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const shade = 175 + Math.floor(Math.random() * 55);
    ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 8})`;
    ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); t.anisotropy = 4; return t;
}

// ── 材质 ───────────────────────────────────────────────────
const MAT = {
  red: new THREE.MeshStandardMaterial({ color: '#8e2a22', roughness: 0.75 }),
  redDark: new THREE.MeshStandardMaterial({ color: '#5e1c18', roughness: 0.8 }),
  marble: new THREE.MeshStandardMaterial({ color: '#d9d2c4', roughness: 0.6 }),
  wood: new THREE.MeshStandardMaterial({ color: '#4a2a1c', roughness: 0.7 }),
  gold: new THREE.MeshStandardMaterial({ color: '#d7a63a', roughness: 0.35, metalness: 0.6 }),
  goldRoof: new THREE.MeshStandardMaterial({ color: '#c9971f', roughness: 0.4, metalness: 0.5 }),
  greenRoof: new THREE.MeshStandardMaterial({ color: '#3f5a55', roughness: 0.55, metalness: 0.2 }),
  greyRoof: new THREE.MeshStandardMaterial({ color: '#4b4b52', roughness: 0.7 }),
  trunk: new THREE.MeshStandardMaterial({ color: '#3b2a22', roughness: 0.9 }),
  blossom: new THREE.MeshStandardMaterial({ color: '#f2a7b8', roughness: 0.9 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#4d6b3a', roughness: 0.9 }),
  lantern: new THREE.MeshStandardMaterial({ color: '#ff5a3c', emissive: '#ff3a1a', emissiveIntensity: 1.6, roughness: 0.6 }),
  window: new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: '#ffb347', emissiveIntensity: 1.2 }),
  dark: new THREE.MeshStandardMaterial({ color: '#2a2422', roughness: 0.9 }),
  water: new THREE.MeshStandardMaterial({ color: '#1f3a4a', roughness: 0.15, metalness: 0.5 }),
};

// ── 主殿 ───────────────────────────────────────────────────
function Lanterns({ count, w, d, y }: { count: number; w: number; d: number; y: number }) {
  const geo = useMemo(() => new THREE.SphereGeometry(0.16, 10, 8), []);
  const pts = useMemo(() => {
    const out: [number, number, number][] = [];
    const perSide = Math.ceil(count / 2);
    for (let i = 0; i < perSide; i++) {
      const t = perSide === 1 ? 0.5 : i / (perSide - 1);
      const x = -w / 2 + 0.3 + t * (w - 0.6);
      out.push([x, y, d / 2 + 0.25]);
      if (out.length < count) out.push([x, y, -d / 2 - 0.25]);
    }
    return out.slice(0, count);
  }, [count, w, d, y]);
  return <>{pts.map((p, i) => <mesh key={i} geometry={geo} material={MAT.lantern} position={p} scale={[1, 1.25, 1]} />)}</>;
}

function Hall({ w, d, h, y = 0, roofMat, pillars = 4, windows = 3, cast = true }: { w: number; d: number; h: number; y?: number; roofMat: THREE.Material; pillars?: number; windows?: number; cast?: boolean }) {
  const roof = useMemo(() => hipRoof(w * 1.3, d * 1.35, h * 0.55), [w, d, h]);
  const pillarGeo = useMemo(() => new THREE.CylinderGeometry(0.09, 0.1, h, 8), [h]);
  const winGeo = useMemo(() => new THREE.PlaneGeometry(0.42, 0.55), []);
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, h / 2, 0]} material={MAT.red} castShadow={cast} receiveShadow><boxGeometry args={[w, h, d]} /></mesh>
      {Array.from({ length: pillars }).map((_, i) => {
        const x = -w / 2 + 0.25 + (i / (pillars - 1)) * (w - 0.5);
        return <mesh key={i} geometry={pillarGeo} material={MAT.redDark} position={[x, h / 2, d / 2 + 0.22]} />;
      })}
      {Array.from({ length: windows }).map((_, i) => {
        const x = -w / 2 + 0.6 + (i / Math.max(1, windows - 1)) * (w - 1.2);
        return <mesh key={i} geometry={winGeo} material={MAT.window} position={[x, h * 0.5, d / 2 + 0.01]} />;
      })}
      <mesh position={[0, h, 0]} material={MAT.wood}><boxGeometry args={[w * 1.32, 0.12, d * 1.37]} /></mesh>
      <mesh geometry={roof} material={roofMat} position={[0, h + 0.1, 0]} castShadow={cast} />
      <mesh position={[0, h + 0.1 + h * 0.55, 0]} material={MAT.gold}><boxGeometry args={[w * 0.4, 0.14, 0.16]} /></mesh>
    </group>
  );
}

function PlumTree({ position, scale = 1, blossom }: { position: [number, number, number]; scale?: number; blossom: THREE.Material }) {
  return (
    <group position={position} scale={scale}>
      <mesh material={MAT.trunk} position={[0, 0.6, 0]} castShadow><cylinderGeometry args={[0.07, 0.13, 1.2, 6]} /></mesh>
      <mesh material={MAT.trunk} position={[0.25, 1.05, 0.1]} rotation={[0, 0, -0.7]}><cylinderGeometry args={[0.04, 0.07, 0.7, 5]} /></mesh>
      <mesh material={blossom} position={[0, 1.45, 0]} castShadow><icosahedronGeometry args={[0.5, 1]} /></mesh>
      <mesh material={blossom} position={[0.45, 1.3, 0.15]}><icosahedronGeometry args={[0.32, 1]} /></mesh>
      <mesh material={blossom} position={[-0.35, 1.2, -0.1]}><icosahedronGeometry args={[0.28, 1]} /></mesh>
    </group>
  );
}

function MainPalace() {
  const rank = useGame(s => s.s.rank);
  const returned = useGame(s => s.d.returned);
  const stage = stageOf(rank);
  const group = useRef<THREE.Group>(null);
  const pulse = useRef(0);
  const lastClick = useRef(0);
  const clickPulse = useGame(s => s.s.fx.clickPulse);
  const rankPulse = useGame(s => s.s.fx.rankPulse);
  const rankBump = useRef(0);
  useEffect(() => { if (clickPulse !== lastClick.current) { lastClick.current = clickPulse; pulse.current = 1; } }, [clickPulse]);
  useEffect(() => { rankBump.current = 1; }, [rankPulse]);

  useFrame((_, dt) => {
    if (!group.current) return;
    pulse.current = Math.max(0, pulse.current - dt * 5);
    rankBump.current = Math.max(0, rankBump.current - dt * 0.8);
    const s = 1 + pulse.current * 0.03 + Math.sin(rankBump.current * Math.PI) * 0.06;
    group.current.scale.setScalar(s);
  });

  const roofMat = rank >= 6 ? MAT.goldRoof : rank >= 3 ? MAT.greenRoof : MAT.greyRoof;
  const blossom = stage === 1 ? MAT.leaf : stage === 3 ? MAT.marble : MAT.blossom;
  const w = 3.2 + rank * 0.35, d = 2.2 + rank * 0.18, h = 1.5 + rank * 0.08;
  const platformH = 0.35 + Math.min(rank, 6) * 0.08;
  const tiers = rank >= 8 ? 3 : rank >= 5 ? 2 : 1;
  const lanternCount = Math.min(14, 2 + rank * 2);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if ((e as unknown as { delta: number }).delta > 5) return;
    const v = actions.click();
    window.dispatchEvent(new CustomEvent('favor-float', { detail: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, v } }));
  };
  const setHover = useUI(s => s.setHover);

  return (
    <group>
      <group ref={group} onClick={onClick} onPointerOver={() => { document.body.style.cursor = 'pointer'; setHover('main'); }} onPointerOut={() => { document.body.style.cursor = ''; setHover(null); }}>
        {/* 台基 */}
        <mesh position={[0, platformH / 2, 0]} material={MAT.marble} receiveShadow><boxGeometry args={[w * 1.9, platformH, d * 2.2]} /></mesh>
        {rank >= 4 && <mesh position={[0, platformH + 0.12, 0]} material={MAT.marble} receiveShadow><boxGeometry args={[w * 1.6, 0.24, d * 1.9]} /></mesh>}
        {/* 台阶 */}
        <mesh position={[0, platformH / 2, d * 1.1 + 0.5]} material={MAT.marble}><boxGeometry args={[1.6, platformH, 1.0]} /></mesh>
        <group position={[0, platformH + (rank >= 4 ? 0.24 : 0), 0]}>
          <Hall w={w} d={d} h={h} roofMat={roofMat} pillars={4 + Math.min(rank, 4)} windows={3 + Math.floor(rank / 2)} />
          {tiers >= 2 && <Hall w={w * 0.72} d={d * 0.7} h={h * 0.75} y={h + 0.1 + h * 0.55 * 0.55} roofMat={roofMat} pillars={4} windows={2} />}
          {tiers >= 3 && <Hall w={w * 0.48} d={d * 0.45} h={h * 0.6} y={h + 0.1 + h * 0.55 * 0.55 + h * 0.75 + 0.1 + h * 0.75 * 0.55 * 0.5} roofMat={roofMat} pillars={2} windows={1} />}
          <Lanterns count={lanternCount} w={w} d={d} y={h - 0.15} />
          {/* 侧殿 */}
          {rank >= 3 && <group position={[-(w / 2 + 1.7), 0, -0.4]}><Hall w={1.8} d={1.4} h={1.1} roofMat={roofMat} pillars={2} windows={1} cast={false} /></group>}
          {rank >= 3 && <group position={[w / 2 + 1.7, 0, -0.4]}><Hall w={1.8} d={1.4} h={1.1} roofMat={roofMat} pillars={2} windows={1} cast={false} /></group>}
        </group>
        {/* 石狮 */}
        {rank >= 4 && [-1, 1].map(sx => (
          <group key={sx} position={[sx * 1.4, platformH, d * 1.1 + 0.3]}>
            <mesh material={MAT.gold} position={[0, 0.2, 0]}><boxGeometry args={[0.28, 0.4, 0.4]} /></mesh>
            <mesh material={MAT.gold} position={[0, 0.5, 0.1]}><sphereGeometry args={[0.16, 8, 6]} /></mesh>
          </group>
        ))}
      </group>
      {/* 梅树与庭院（不参与点击） */}
      {rank >= 2 && <PlumTree position={[-(w * 0.95 + 1.2), 0, d * 1.1 + 1.6]} blossom={blossom} />}
      {rank >= 2 && <PlumTree position={[w * 0.95 + 1.4, 0, d * 1.1 + 1.2]} scale={0.85} blossom={blossom} />}
      {rank >= 5 && <PlumTree position={[-(w * 0.95 + 2.6), 0, -1.5]} scale={1.1} blossom={blossom} />}
      {rank >= 5 && <PlumTree position={[w * 0.95 + 2.8, 0, -1.8]} scale={0.95} blossom={blossom} />}
      {/* 池 */}
      {rank >= 4 && <mesh position={[-(w * 0.95 + 3.6), 0.02, d * 1.1 + 3.4]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.water}><circleGeometry args={[1.6 + rank * 0.1, 24]} /></mesh>}
      {rank >= 4 && <mesh position={[-(w * 0.95 + 3.6), 0.01, d * 1.1 + 3.4]} rotation={[-Math.PI / 2, 0, 0]} material={MAT.marble}><ringGeometry args={[1.6 + rank * 0.1, 1.9 + rank * 0.1, 24]} /></mesh>}
      {/* 回宫后：凤鸾春恩车 */}
      {returned && (
        <group position={[3.2, 0, d * 1.1 + 2.6]} rotation={[0, -0.5, 0]}>
          <mesh material={MAT.redDark} position={[0, 0.65, 0]}><boxGeometry args={[1.1, 0.8, 0.8]} /></mesh>
          <mesh material={MAT.gold} position={[0, 1.15, 0]}><boxGeometry args={[1.3, 0.12, 1.0]} /></mesh>
          {[-0.45, 0.45].map(x => <mesh key={x} material={MAT.dark} position={[x, 0.3, 0.42]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.3, 0.3, 0.08, 12]} /></mesh>)}
        </group>
      )}
      <pointLight position={[0, h + 1.2, d / 2 + 1]} color="#ffb070" intensity={8 + rank * 2} distance={12} decay={2} />
    </group>
  );
}

// ── 对手宫殿 ───────────────────────────────────────────────
const RIVAL_SLOTS: Record<string, { angle: number; r: number }> = {
  xia: { angle: -2.55, r: 13 }, yu: { angle: 2.55, r: 13 }, cao: { angle: -2.0, r: 15 },
  hua: { angle: 3.14, r: 15 }, an: { angle: 2.0, r: 15 }, qi: { angle: -1.45, r: 16 }, hou: { angle: 1.45, r: 16 },
};

function RivalPalace({ id }: { id: string }) {
  const def = RIVALS.find(r => r.id === id)!;
  const st = useGame(s => s.s.rivals[id]);
  const active = useGame(s => isRivalActive(s.s, id));
  const share = useGame(s => { const p = s.s.rivals[id]?.power || 0; return p / (s.d.myPower + s.d.rivalPower); });
  const select = useUI(s => s.selectRival);
  const selected = useUI(s => s.selectedRival === id);
  const setHover = useUI(s => s.setHover);
  const slot = RIVAL_SLOTS[id];
  const pos: [number, number, number] = [Math.sin(slot.angle) * slot.r, 0, Math.cos(slot.angle) * slot.r];
  const lantern = useMemo(() => new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 1.5 }), [def.color]);
  const win = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffd28a', emissive: '#ffb347', emissiveIntensity: 1 }), []);
  const ref = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    const dead = st?.defeated;
    const target = dead ? 0 : 0.5 + Math.min(2.5, share * 8);
    lantern.emissiveIntensity += (target - lantern.emissiveIntensity) * Math.min(1, dt * 3);
    win.emissiveIntensity += ((dead ? 0 : 0.6 + share * 3) - win.emissiveIntensity) * Math.min(1, dt * 3);
    if (ref.current) {
      const sc = dead ? 0.82 : 0.9 + Math.min(0.6, share * 2);
      ref.current.scale.x += (sc - ref.current.scale.x) * Math.min(1, dt * 2);
      ref.current.scale.y = ref.current.scale.z = ref.current.scale.x;
    }
    if (ring.current) {
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = selected ? 0.55 + Math.sin(state.clock.elapsedTime * 4) * 0.25 : 0;
    }
  });
  if (!active) return null;
  const dead = st?.defeated;
  const size = 1 + Math.log10(def.basePower + 1) * 0.35;
  const lookAt = Math.atan2(-pos[0], -pos[2]);
  return (
    <group position={pos} rotation={[0, lookAt, 0]}>
      <group ref={ref}
        onClick={(e) => { e.stopPropagation(); if ((e as unknown as { delta: number }).delta > 5) return; select(id); }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; setHover(id); }}
        onPointerOut={() => { document.body.style.cursor = ''; setHover(null); }}>
        <mesh position={[0, 0.15, 0]} material={MAT.marble}><boxGeometry args={[size * 2.6, 0.3, size * 2.2]} /></mesh>
        <group position={[0, 0.3, 0]}>
          <Hall w={size * 1.8} d={size * 1.3} h={1.1 + size * 0.25} roofMat={dead ? MAT.greyRoof : id === 'hou' ? MAT.goldRoof : MAT.greenRoof} pillars={3} windows={2} cast={false} />
        </group>
        <mesh position={[-size * 0.9, 1.1, size * 0.8]} material={lantern}><sphereGeometry args={[0.16, 8, 6]} /></mesh>
        <mesh position={[size * 0.9, 1.1, size * 0.8]} material={lantern}><sphereGeometry args={[0.16, 8, 6]} /></mesh>
        <mesh visible={false} position={[0, 1, 0]}><boxGeometry args={[size * 2.6, 2.6, size * 2.4]} /></mesh>
      </group>
      <mesh ref={ring} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[size * 1.7, size * 1.85, 32]} />
        <meshBasicMaterial color="#e8c060" transparent opacity={0} />
      </mesh>
      {dead && <mesh position={[0, 0.02, size * 1.6]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[size * 0.9, 12]} /><meshBasicMaterial color="#000" transparent opacity={0.45} /></mesh>}
    </group>
  );
}

// ── 宫人 ───────────────────────────────────────────────────
function Attendants() {
  const total = useGame(s => PRODUCERS.reduce((a, p) => a + (s.s.producers[p.id] || 0), 0));
  const count = Math.min(56, 2 + Math.floor(total / 3));
  const MAXN = 56;
  const body = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const agents = useMemo(() => Array.from({ length: MAXN }, (_, i) => ({
    a: Math.random() * Math.PI * 2, r: 7 + Math.random() * 5, v: (0.08 + Math.random() * 0.1) * (Math.random() < 0.5 ? 1 : -1), ph: Math.random() * 10, c: i % 3,
  })), []);
  const colors = useMemo(() => [new THREE.Color('#c96a7a'), new THREE.Color('#5a6f8a'), new THREE.Color('#8a9a6a')], []);
  useEffect(() => {
    if (!body.current) return;
    for (let i = 0; i < MAXN; i++) body.current.setColorAt(i, colors[agents[i].c]);
    if (body.current.instanceColor) body.current.instanceColor.needsUpdate = true;
    (body.current.material as THREE.Material).needsUpdate = true;
  }, [agents, colors]);
  useFrame((state, dt) => {
    if (!body.current || !head.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < MAXN; i++) {
      const ag = agents[i];
      if (i < count) {
        ag.a += ag.v * dt;
        const x = Math.sin(ag.a) * ag.r, z = Math.cos(ag.a) * ag.r;
        const bob = Math.abs(Math.sin(t * 6 + ag.ph)) * 0.04;
        dummy.position.set(x, 0.32 + bob, z); dummy.rotation.set(0, ag.a + (ag.v > 0 ? Math.PI : 0), 0); dummy.scale.setScalar(1);
        dummy.updateMatrix(); body.current.setMatrixAt(i, dummy.matrix);
        dummy.position.y = 0.78 + bob; dummy.updateMatrix(); head.current.setMatrixAt(i, dummy.matrix);
      } else {
        dummy.position.set(0, -10, 0); dummy.scale.setScalar(0.001); dummy.updateMatrix();
        body.current.setMatrixAt(i, dummy.matrix); head.current.setMatrixAt(i, dummy.matrix);
      }
    }
    body.current.instanceMatrix.needsUpdate = true; head.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={body} args={[undefined, undefined, MAXN]} frustumCulled={false}>
        <cylinderGeometry args={[0.11, 0.17, 0.62, 7]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={head} args={[undefined, undefined, MAXN]} frustumCulled={false}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshStandardMaterial color="#e8cdb5" roughness={0.8} />
      </instancedMesh>
    </>
  );
}

// ── 粒子：季节 ────────────────────────────────────────────
function Season({ palette }: { palette: Palette }) {
  const N = 320;
  const ref = useRef<THREE.Points>(null);
  const tex = useMemo(softCircleTexture, []);
  const pos = useMemo(() => { const a = new Float32Array(N * 3); for (let i = 0; i < N; i++) { a[i * 3] = (Math.random() - 0.5) * 40; a[i * 3 + 1] = Math.random() * 14; a[i * 3 + 2] = (Math.random() - 0.5) * 40; } return a; }, []);
  const vel = useMemo(() => Array.from({ length: N }, () => ({ vy: 0.4 + Math.random() * 0.6, ph: Math.random() * 6 })), []);
  const mat = useRef<THREE.PointsMaterial>(null);
  useFrame((state, dt) => {
    if (!ref.current) return;
    const arr = ref.current.geometry.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    const kind = palette.petalKind;
    for (let i = 0; i < N; i++) {
      const v = vel[i];
      if (kind === 'firefly') {
        arr[i * 3 + 1] += Math.sin(t * 1.3 + v.ph) * dt * 0.4;
        arr[i * 3] += Math.cos(t * 0.7 + v.ph) * dt * 0.3;
        if (arr[i * 3 + 1] > 6) arr[i * 3 + 1] = 0.5; if (arr[i * 3 + 1] < 0.3) arr[i * 3 + 1] = 0.5;
      } else {
        arr[i * 3 + 1] -= v.vy * dt * (kind === 'snow' ? 0.6 : 1);
        arr[i * 3] += Math.sin(t + v.ph) * dt * 0.5;
        if (arr[i * 3 + 1] < 0) { arr[i * 3 + 1] = 14; arr[i * 3] = (Math.random() - 0.5) * 40; arr[i * 3 + 2] = (Math.random() - 0.5) * 40; }
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    if (mat.current) { mat.current.color.lerp(new THREE.Color(palette.petal), dt * 2); mat.current.size = kind === 'firefly' ? 0.12 : kind === 'snow' ? 0.14 : 0.18; }
  });
  return (
    <points ref={ref}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[pos, 3]} /></bufferGeometry>
      <pointsMaterial ref={mat} map={tex} size={0.18} transparent opacity={0.85} depthWrite={false} sizeAttenuation color={palette.petal} />
    </points>
  );
}

// ── 粒子：爆发 ────────────────────────────────────────────
function Bursts() {
  const N = 400;
  const ref = useRef<THREE.Points>(null);
  const tex = useMemo(softCircleTexture, []);
  const data = useMemo(() => ({
    pos: new Float32Array(N * 3), col: new Float32Array(N * 3),
    vel: new Float32Array(N * 3), life: new Float32Array(N), base: Array.from({ length: N }, () => new THREE.Color()), cursor: 0,
  }), []);
  const clickPulse = useGame(s => s.s.fx.clickPulse);
  const rankPulse = useGame(s => s.s.fx.rankPulse);
  const defeatPulse = useGame(s => s.s.fx.defeatPulse);
  const defeatId = useGame(s => s.s.fx.defeatId);
  const buyPulse = useGame(s => s.s.fx.buyPulse);
  const returnPulse = useGame(s => s.s.fx.returnPulse);
  const rank = useGame(s => s.s.rank);
  const first = useRef(true);

  const spawn = (n: number, origin: THREE.Vector3, color: string, speed: number, spread = 1) => {
    const c = new THREE.Color(color);
    for (let k = 0; k < n; k++) {
      const i = data.cursor; data.cursor = (data.cursor + 1) % N;
      data.pos[i * 3] = origin.x + (Math.random() - 0.5) * spread; data.pos[i * 3 + 1] = origin.y; data.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread;
      const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.5;
      data.vel[i * 3] = Math.cos(th) * Math.sin(ph) * speed; data.vel[i * 3 + 1] = (Math.cos(ph) * 0.8 + 0.4) * speed; data.vel[i * 3 + 2] = Math.sin(th) * Math.sin(ph) * speed;
      data.life[i] = 1; data.base[i].copy(c).multiplyScalar(0.6 + Math.random() * 0.6);
    }
  };
  const top = 1.5 + rank * 0.08 + 1.2;
  useEffect(() => { if (first.current) return; spawn(18, new THREE.Vector3(0, top, 1), '#ffcc66', 2.2, 2.5); }, [clickPulse]); // eslint-disable-line
  useEffect(() => { if (first.current) return; spawn(60, new THREE.Vector3(0, top, 0), '#ffd27a', 4, 3); spawn(50, new THREE.Vector3(0, top + 1, 0), '#ff7a5a', 4.5, 3); spawn(50, new THREE.Vector3(0, top + 2, 0), '#ffffff', 3.5, 4); }, [rankPulse]); // eslint-disable-line
  useEffect(() => { if (first.current) return; spawn(10, new THREE.Vector3(0, top, 1), '#8ad0ff', 1.5, 3); }, [buyPulse]); // eslint-disable-line
  useEffect(() => { if (first.current || !defeatId) return; const s = RIVAL_SLOTS[defeatId]; spawn(80, new THREE.Vector3(Math.sin(s.angle) * s.r, 2, Math.cos(s.angle) * s.r), '#8a8a9a', 3, 3); }, [defeatPulse]); // eslint-disable-line
  useEffect(() => { if (first.current) return; spawn(120, new THREE.Vector3(0, 3, 0), '#ffe6a0', 5, 6); }, [returnPulse]); // eslint-disable-line
  useEffect(() => { first.current = false; }, []);

  useFrame((_, dt) => {
    if (!ref.current) return;
    for (let i = 0; i < N; i++) {
      if (data.life[i] <= 0) { data.col[i * 3] = data.col[i * 3 + 1] = data.col[i * 3 + 2] = 0; continue; }
      data.life[i] -= dt * 0.9;
      data.vel[i * 3 + 1] -= 4 * dt;
      data.pos[i * 3] += data.vel[i * 3] * dt; data.pos[i * 3 + 1] += data.vel[i * 3 + 1] * dt; data.pos[i * 3 + 2] += data.vel[i * 3 + 2] * dt;
      const l = Math.max(0, data.life[i]);
      data.col[i * 3] = data.base[i].r * l; data.col[i * 3 + 1] = data.base[i].g * l; data.col[i * 3 + 2] = data.base[i].b * l;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
    ref.current.geometry.attributes.color.needsUpdate = true;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.col, 3]} />
      </bufferGeometry>
      <pointsMaterial map={tex} size={0.28} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation />
    </points>
  );
}

// ── 宫墙、地面、天光 ──────────────────────────────────────
function Walls() {
  const R = 22;
  const segs = [[0, 0, R, 0], [0, 0, -R, 0], [R, 0, 0, Math.PI / 2], [-R, 0, 0, Math.PI / 2]] as const;
  return (
    <group>
      {segs.map(([x, , z, ry], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, ry, 0]}>
          <mesh position={[0, 1.6, 0]} material={MAT.red}><boxGeometry args={[R * 2 + 1.4, 3.2, 1.2]} /></mesh>
          <mesh position={[0, 3.35, 0]} material={MAT.goldRoof}><boxGeometry args={[R * 2 + 2.2, 0.3, 1.9]} /></mesh>
        </group>
      ))}
      {[[R, R], [-R, R], [R, -R], [-R, -R]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2.2, 0]} material={MAT.red}><boxGeometry args={[3, 4.4, 3]} /></mesh>
          <mesh position={[0, 4.5, 0]} material={MAT.goldRoof}><coneGeometry args={[2.6, 1.6, 4]} /></mesh>
        </group>
      ))}
      {/* 正门 */}
      <group position={[0, 0, R]}>
        <mesh position={[0, 2.5, 0]} material={MAT.red}><boxGeometry args={[7, 5, 2.2]} /></mesh>
        <mesh position={[0, 1.4, 0]} material={MAT.dark}><boxGeometry args={[2.4, 2.8, 2.4]} /></mesh>
        <mesh position={[0, 5.6, 0]} material={MAT.goldRoof}><boxGeometry args={[8.5, 0.4, 3.2]} /></mesh>
        <group position={[0, 5.8, 0]}><Hall w={5.5} d={2} h={1.6} roofMat={MAT.goldRoof} pillars={5} windows={4} cast={false} /></group>
      </group>
    </group>
  );
}

function Ground({ palette }: { palette: Palette }) {
  const tex = useMemo(brickTexture, []);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const pathMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((_, dt) => {
    if (mat.current) mat.current.color.lerp(new THREE.Color(palette.ground), dt * 1.5);
    if (pathMat.current) pathMat.current.color.lerp(new THREE.Color(palette.path), dt * 1.5);
  });
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial ref={mat} map={tex} color={palette.ground} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 12]}>
        <planeGeometry args={[3.2, 20]} />
        <meshStandardMaterial ref={pathMat} color={palette.path} roughness={0.9} />
      </mesh>
    </>
  );
}

function Atmosphere({ palette }: { palette: Palette }) {
  const { scene } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const moon = useRef<THREE.Mesh>(null);
  const bg = useMemo(() => new THREE.Color(PALETTES[0].bg), []);
  useEffect(() => { scene.background = bg; scene.fog = new THREE.FogExp2(PALETTES[0].bg, PALETTES[0].fog); }, [scene, bg]);
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 1.2);
    bg.lerp(new THREE.Color(palette.bg), k);
    const fog = scene.fog as THREE.FogExp2; if (fog) { fog.color.copy(bg); fog.density += (palette.fog - fog.density) * k; }
    if (sun.current) {
      sun.current.color.lerp(new THREE.Color(palette.sun), k);
      sun.current.intensity += (palette.sunI - sun.current.intensity) * k;
      sun.current.position.lerp(new THREE.Vector3(...palette.sunPos), k);
    }
    if (hemi.current) { hemi.current.color.lerp(new THREE.Color(palette.sky), k); hemi.current.intensity += (palette.amb - hemi.current.intensity) * k; }
    if (moon.current) moon.current.position.lerp(new THREE.Vector3(palette.sunPos[0] * 4, palette.sunPos[1] * 3.5, palette.sunPos[2] * 4), k);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={[PALETTES[0].sky, '#1a1210', PALETTES[0].amb]} />
      <directionalLight ref={sun} castShadow position={PALETTES[0].sunPos} intensity={PALETTES[0].sunI} color={PALETTES[0].sun}
        shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-near={1} shadow-camera-far={60}
        shadow-camera-left={-14} shadow-camera-right={14} shadow-camera-top={14} shadow-camera-bottom={-14} shadow-bias={-0.0008} />
      <mesh ref={moon} position={[48, 50, 32]}>
        <sphereGeometry args={[3.2, 20, 16]} />
        <meshBasicMaterial color="#fff2d0" fog={false} />
      </mesh>
    </>
  );
}

// ── 镜头 ───────────────────────────────────────────────────
function CameraRig() {
  const { camera, gl } = useThree();
  const sph = useRef({ theta: 0.35, phi: 1.15, r: 20 });
  const target = useRef({ theta: 0.35, phi: 1.15, r: 20 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const idle = useRef(0);
  const flourish = useRef(0);
  const shake = useRef(0);
  const rankPulse = useGame(s => s.s.fx.rankPulse);
  const exposed = useGame(s => s.s.fx.exposedPulse);
  const ret = useGame(s => s.s.fx.returnPulse);
  const first = useRef(true);
  useEffect(() => { if (!first.current) flourish.current = 1; }, [rankPulse, ret]);
  useEffect(() => { if (!first.current) shake.current = 1; }, [exposed]);
  useEffect(() => { first.current = false; }, []);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; idle.current = 0; };
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      drag.current = { x: e.clientX, y: e.clientY };
      target.current.theta -= dx * 0.005;
      target.current.phi = THREE.MathUtils.clamp(target.current.phi + dy * 0.004, 0.85, 1.4);
      idle.current = 0;
    };
    const up = () => { drag.current = null; };
    const wheel = (e: WheelEvent) => { target.current.r = THREE.MathUtils.clamp(target.current.r + e.deltaY * 0.02, 9, 34); idle.current = 0; };
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    el.addEventListener('wheel', wheel, { passive: true });
    return () => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); el.removeEventListener('wheel', wheel); };
  }, [gl]);

  useFrame((state, dt) => {
    idle.current += dt;
    if (idle.current > 3 && !drag.current) target.current.theta += dt * 0.04;
    flourish.current = Math.max(0, flourish.current - dt * 0.35);
    shake.current = Math.max(0, shake.current - dt * 1.5);
    const f = Math.sin(flourish.current * Math.PI);
    const s = sph.current, t = target.current;
    const k = Math.min(1, dt * 3);
    s.theta += (t.theta - s.theta) * k; s.phi += (t.phi - s.phi) * k; s.r += (t.r - f * 7 - s.r) * k;
    const ty = 1.6 + f * 1.5;
    const x = Math.sin(s.phi) * Math.sin(s.theta) * s.r, y = Math.cos(s.phi) * s.r + ty, z = Math.sin(s.phi) * Math.cos(s.theta) * s.r;
    const sh = shake.current * 0.25;
    camera.position.set(x + (Math.random() - 0.5) * sh, y + (Math.random() - 0.5) * sh, z + (Math.random() - 0.5) * sh);
    camera.lookAt(0, ty, 0);
    void state;
  });
  return null;
}

// ── 标签投影：把 3D 位置写到 DOM ──────────────────────────
function Labels({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  const { camera, size } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const root = container.current; if (!root) return;
    const els = root.querySelectorAll<HTMLElement>('[data-anchor]');
    const rank = useGame.getState().s.rank;
    els.forEach(el => {
      const id = el.dataset.anchor!;
      if (id === 'main') v.set(0, 3.7 + rank * 0.55, 0);
      else {
        const s = RIVAL_SLOTS[id]; const def = RIVALS.find(r => r.id === id); if (!s || !def) return;
        const size = 1 + Math.log10(def.basePower + 1) * 0.35;
        v.set(Math.sin(s.angle) * s.r, 1.3 + size * 1.6, Math.cos(s.angle) * s.r);
      }
      v.project(camera);
      const behind = v.z > 1;
      const x = (v.x * 0.5 + 0.5) * size.width, y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = behind ? '0' : '1';
    });
  });
  return null;
}

function World({ labelRoot }: { labelRoot: React.RefObject<HTMLDivElement | null> }) {
  const rank = useGame(s => s.s.rank);
  const palette = PALETTES[stageOf(rank)];
  return (
    <>
      <Atmosphere palette={palette} />
      <CameraRig />
      <Ground palette={palette} />
      <Walls />
      <MainPalace />
      {RIVALS.map(r => <RivalPalace key={r.id} id={r.id} />)}
      <Attendants />
      <Season palette={palette} />
      <Bursts />
      <Labels container={labelRoot} />
    </>
  );
}

export default function Scene({ labelRoot, onFail }: { labelRoot: React.RefObject<HTMLDivElement | null>; onFail: () => void }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (failed) onFail(); }, [failed, onFail]);
  if (failed) return null;
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 36, near: 0.5, far: 200, position: [8, 9, 18] }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', () => setFailed(true)); }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <World labelRoot={labelRoot} />
    </Canvas>
  );
}
