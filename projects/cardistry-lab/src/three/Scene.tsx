import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import { evaluate, stepAt } from '../lib/anim';
import { MOVE_MAP, MOVES } from '../lib/moves';
import type { HandPose, PacketState, Step } from '../lib/types';
import { L_REST } from '../lib/builder';
import { useLab } from '../store';
import { Packet } from './Packet';
import { Hand } from './Hand';
import { CameraRig } from './CameraRig';
import { MoveNodes } from './Nodes';
import { ContactPoints, FocusMarker, Ghosts, PacketLabels, Paths } from './Teaching';
import { tracker } from './tracker';

interface Props {
  moveId: string;
  /** primary scene drives the playback clock */
  primary: boolean;
  showNodes: boolean;
}

export function LabScene({ moveId, primary, showNodes }: Props) {
  const move = MOVE_MAP[moveId];
  const mode = useLab((s) => s.mode);
  const ghost = useLab((s) => s.ghost);
  const transparent = useLab((s) => s.transparent);
  const wire = useLab((s) => s.wire);

  const packetRefs = useRef<Record<string, React.MutableRefObject<PacketState | null>>>({});
  const hiRefs = useRef<Record<string, React.MutableRefObject<boolean>>>({});
  const exRefs = useRef<Record<string, React.MutableRefObject<number>>>({});
  const explodeAmt = useRef(0);
  const leftPose = useRef<HandPose>(L_REST);
  const rightPose = useRef<HandPose>(L_REST);
  const fingerHi = useRef<Set<string>>(new Set());
  const [step, setStep] = useState<Step | null>(null);
  const stepIdx = useRef(-1);

  // (re)create refs per packet
  for (const p of move.packets) {
    if (!packetRefs.current[p.id]) packetRefs.current[p.id] = { current: null };
    if (!hiRefs.current[p.id]) hiRefs.current[p.id] = { current: false };
    if (!exRefs.current[p.id]) exRefs.current[p.id] = { current: 0 };
  }

  useEffect(() => {
    stepIdx.current = -1;
    setStep(null);
  }, [moveId, mode]);

  // Which hand should the finger-focus camera follow?
  const focusHandFor = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of move.steps) for (const f of s.fingers) counts[f] = (counts[f] ?? 0) + (s.t1 - s.t0);
    return (finger: string, current: Step | null) => {
      const L = `L.${finger}`, R = `R.${finger}`;
      if (current?.fingers.includes(L)) return L;
      if (current?.fingers.includes(R)) return R;
      return (counts[R] ?? 0) > (counts[L] ?? 0) ? R : L;
    };
  }, [move]);

  const currentStepRef = useRef<Step | null>(null);
  /** finger explicitly chosen via Finger Focus (for glow) */
  const focusOnly = () => {
    const f = useLab.getState().focusFinger;
    return f ? focusHandFor(f, currentStepRef.current) : null;
  };
  /** finger the close-up camera should follow */
  const focusId = () => {
    const explicit = focusOnly();
    if (explicit) return explicit;
    const cur = currentStepRef.current;
    if (cur && cur.fingers.length) return cur.fingers[0];
    return null;
  };

  useFrame((_, dt) => {
    const s = useLab.getState();
    // ---- playback clock (primary only)
    if (primary && s.playing) {
      const d = Math.min(dt, 0.05) * s.speed;
      let t = s.t + d;
      if (s.mode === 'steps') {
        const st = stepAt(move, s.t);
        if (t >= st.t1) {
          t = Math.min(st.t1, move.duration) - 0.0005;
          useLab.setState({ t, playing: false });
        } else useLab.setState({ t });
      } else {
        const loopDur = s.compare ? Math.max(move.duration, MOVE_MAP[s.compareId].duration) : move.duration;
        if (t >= loopDur + 0.4) t = 0;
        useLab.setState({ t });
      }
    }
    const t = useLab.getState().t;

    // ---- evaluate
    const ev = evaluate(move, t);
    leftPose.current = ev.left;
    rightPose.current = ev.right;
    const cur = s.mode === 'free' ? null : stepAt(move, t);
    currentStepRef.current = cur;
    if ((cur?.index ?? -1) !== stepIdx.current) {
      stepIdx.current = cur?.index ?? -1;
      setStep(cur);
    }

    // explode amount
    const target = s.explode ? 0.85 : 0;
    explodeAmt.current += (target - explodeAmt.current) * Math.min(1, dt * 6);
    const n = move.packets.length;

    ev.packets.forEach((ps, i) => {
      packetRefs.current[ps.id].current = ps;
      hiRefs.current[ps.id].current = !!cur && cur.packets.includes(ps.id);
      exRefs.current[ps.id].current = explodeAmt.current * (n - 1 - i);
      let v = tracker.packets[ps.id];
      if (!v) v = tracker.packets[ps.id] = new THREE.Vector3();
      v.set(ps.center[0], ps.center[1] + exRefs.current[ps.id].current, ps.center[2]);
    });

    // finger highlights
    const set = fingerHi.current;
    set.clear();
    if (cur) for (const f of cur.fingers) set.add(f);
  });

  const explodeRefForLabels = useRef(0);
  useFrame(() => {
    explodeRefForLabels.current = explodeAmt.current;
  });

  const teaching = mode !== 'free';
  const dimOthers = teaching && !!step && step.packets.length > 0 && step.packets.length < move.packets.length;

  return (
    <>
      <color attach="background" args={['#07090d']} />
      <fog attach="fog" args={['#07090d', 20, 42]} />
      <Lights />
      <Decor />
      <CameraRig focusFingerId={focusId} />

      <group key={move.id}>
        {move.packets.map((p) => (
          <Packet
            key={p.id}
            count={p.count}
            stateRef={packetRefs.current[p.id]}
            highlightRef={hiRefs.current[p.id]}
            explodeRef={exRefs.current[p.id]}
            transparent={transparent}
            wire={wire}
            dimmed={dimOthers && !step!.packets.includes(p.id)}
          />
        ))}
      </group>

      <Hand side="left" poseRef={leftPose} highlightRef={fingerHi} focusId={focusOnly} wire={wire} />
      <Hand side="right" poseRef={rightPose} highlightRef={fingerHi} focusId={focusOnly} wire={wire} />

      {ghost && <Ghosts move={move} />}
      <FocusMarker focusId={focusOnly} />
      {teaching && (
        <>
          <Paths move={move} step={step} />
          <PacketLabels move={move} step={step} explodeRef={explodeRefForLabels} />
          <ContactPoints step={step} />
        </>
      )}
      {showNodes && <MoveNodes />}
    </>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={0.22} />
      <hemisphereLight args={['#8fb0cc', '#15171c', 0.55]} />
      <directionalLight position={[5, 9, 6]} intensity={1.7} color="#fff4e6" />
      <directionalLight position={[-7, 4, 5]} intensity={0.55} color="#c7dcff" />
      <pointLight position={[-4, 3.5, -6]} intensity={28} distance={18} color="#38bdf8" />
      <pointLight position={[6, 2.5, -5]} intensity={16} distance={16} color="#f6c177" />
      <pointLight position={[0, -3, 3]} intensity={6} distance={10} color="#7dd3fc" />
    </>
  );
}

function Decor() {
  const pts = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 420;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 34;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 16 + 1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 34;
    }
    return arr;
  }, []);
  useFrame(({ clock }) => {
    if (pts.current) pts.current.rotation.y = clock.elapsedTime * 0.012;
  });
  return (
    <>
      <points ref={pts}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} color="#9fd7ff" transparent opacity={0.45} sizeAttenuation depthWrite={false} />
      </points>
      <Grid position={[0, -4.3, 0]} args={[60, 60]} cellSize={1} cellThickness={0.6} cellColor="#1c2533" sectionSize={5} sectionThickness={1} sectionColor="#2c3a4f" fadeDistance={34} fadeStrength={1.2} infiniteGrid />
      {/* soft light disc under the hands */}
      <mesh position={[0, -4.28, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[6, 48]} />
        <meshBasicMaterial color="#0f1a26" transparent opacity={0.9} />
      </mesh>
    </>
  );
}

export { MOVES };
