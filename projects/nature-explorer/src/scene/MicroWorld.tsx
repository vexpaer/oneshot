import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { MICRO_ORIGIN } from "../world/content";
import { makeSoftCircle, mulberry32, U } from "../world/world";
import { useStore } from "../world/store";
import { ParticleSystem } from "./Particles";

function petalGeometry() {
  const g = new THREE.PlaneGeometry(5.2, 12, 10, 24);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i); // y from -6 .. 6 along the petal
    const t = (y + 6) / 12; // 0 base -> 1 tip
    const width = Math.sin(t * Math.PI) * 0.9 + 0.1 * (1 - t);
    const nx = x * width;
    // curl up along length + edge lift
    const z = t * t * 3.2 + Math.abs(nx) * 0.35 * t + Math.sin(t * Math.PI * 2) * 0.15;
    p.setXYZ(i, nx, y + 6, z);
  }
  g.computeVertexNormals();
  return g;
}

export function MicroWorld() {
  const scale = useStore((s) => s.scale);
  const petalGeo = useMemo(() => petalGeometry(), []);
  const petalMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#f6b3c9",
        roughness: 0.55,
        sheen: 1,
        sheenColor: new THREE.Color("#ffe1ea"),
        sheenRoughness: 0.5,
        transmission: 0.25,
        thickness: 0.8,
        side: THREE.DoubleSide,
      }),
    []
  );
  const dewMat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: "#ffffff", roughness: 0.02, transmission: 1, thickness: 1.2, ior: 1.33, clearcoat: 1 }),
    []
  );
  const pollen = useRef<THREE.InstancedMesh>(null);
  const bug = useRef<THREE.Group>(null);
  const circle = useMemo(() => makeSoftCircle(), []);
  const dews = useMemo(() => {
    const rnd = mulberry32(88);
    return Array.from({ length: 11 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = 3 + rnd() * 5.5;
      const t = r / 12;
      const z = t * t * 3.2; // curl height along the petal
      const s = 0.3 + rnd() * 0.55;
      const rad = r * Math.cos(0.28) - z * Math.sin(0.28);
      const y = r * Math.sin(0.28) + z * Math.cos(0.28) + s * 0.55;
      return { x: Math.cos(a) * rad, z: Math.sin(a) * rad, y, s };
    });
  }, []);
  const stamens = useMemo(() => {
    const rnd = mulberry32(89);
    return Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + rnd() * 0.3, r: 1 + rnd() * 1.1, h: 2.2 + rnd() * 1.4, tilt: 0.25 + rnd() * 0.3 }));
  }, []);

  useLayoutEffect(() => {
    const rnd = mulberry32(90);
    const m = new THREE.Matrix4();
    const N = 260;
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 2.3;
      const y = 0.6 + Math.cos(r / 2.3) * 0.5 + rnd() * 0.2;
      const s = 0.07 + rnd() * 0.08;
      m.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      pollen.current!.setMatrixAt(i, m);
    }
    pollen.current!.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame(() => {
    if (scale !== "micro") return;
    const t = U.uTime.value;
    if (bug.current) {
      const a = t * 0.12;
      const r = 2.45;
      bug.current.position.set(Math.cos(a) * r, 0.86, Math.sin(a) * r);
      bug.current.rotation.set(0, -a, 0.25);
    }
  });

  return (
    <group position={MICRO_ORIGIN.toArray()} visible={scale === "micro"}>
      {/* soft leaf ground far below */}
      <mesh position={[0, -6, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[80, 48]} />
        <meshStandardMaterial color="#2f5a26" roughness={1} />
      </mesh>
      {/* petals */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} geometry={petalGeo} material={petalMat} rotation={[-Math.PI / 2 + 0.28, (i / 8) * Math.PI * 2, 0]} rotation-order="YXZ" castShadow receiveShadow />
      ))}
      {/* receptacle */}
      <mesh position={[0, 0.3, 0]} scale={[1, 0.55, 1]}>
        <sphereGeometry args={[2.6, 24, 16]} />
        <meshStandardMaterial color="#d7c25a" roughness={0.9} />
      </mesh>
      <instancedMesh ref={pollen} args={[undefined, undefined, 260]} castShadow>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#f6d55c" emissive="#f2b632" emissiveIntensity={0.35} roughness={0.7} />
      </instancedMesh>
      {stamens.map((s, i) => (
        <group key={i} position={[Math.cos(s.a) * s.r, 0.8, Math.sin(s.a) * s.r]} rotation={[Math.sin(s.a) * s.tilt, 0, -Math.cos(s.a) * s.tilt]}>
          <mesh position={[0, s.h / 2, 0]}>
            <cylinderGeometry args={[0.06, 0.09, s.h, 6]} />
            <meshStandardMaterial color="#efe0a8" roughness={0.6} />
          </mesh>
          <mesh position={[0, s.h, 0]} scale={[1, 0.65, 1]}>
            <sphereGeometry args={[0.32, 10, 8]} />
            <meshStandardMaterial color="#f5c542" emissive="#f2a92e" emissiveIntensity={0.5} roughness={0.8} />
          </mesh>
        </group>
      ))}
      {/* dew drops */}
      {dews.map((d, i) => (
        <mesh key={i} position={[d.x, d.y, d.z]} scale={[1, 0.8, 1]} material={dewMat} castShadow>
          <sphereGeometry args={[d.s, 20, 14]} />
        </mesh>
      ))}
      {/* ladybug */}
      <group ref={bug}>
        <mesh scale={[0.55, 0.32, 0.7]} castShadow>
          <sphereGeometry args={[1, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshPhysicalMaterial color="#c8261f" roughness={0.3} clearcoat={1} />
        </mesh>
        <mesh position={[0, 0.02, 0.62]} scale={[0.3, 0.22, 0.3]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#111" roughness={0.4} />
        </mesh>
        {[
          [0.25, 0.2, 0.15],
          [-0.25, 0.2, 0.15],
          [0.3, 0.14, -0.3],
          [-0.3, 0.14, -0.3],
          [0, 0.3, -0.15],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        ))}
        <mesh position={[0, 0.02, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.02, 0.3, 1.3]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>
      {/* floating pollen */}
      <ParticleSystem
        mode="drift"
        count={240}
        center={[0, 2.5, 0]}
        area={[18, 5, 18]}
        color="#ffe08a"
        color2="#fff6cc"
        size={3}
        glow={1.2}
        map={circle}
        additive
        seed={91}
        vis={() => (useStore.getState().scale === "micro" ? 1 : 0)}
      />
      <pointLight position={[3, 7, 4]} intensity={30} color="#fff1d6" distance={40} decay={2} castShadow={false} />
      <Html position={[0, 5.4, -4]} center zIndexRange={[40, 0]} style={{ pointerEvents: "none" }}>
        <div className={`panel ${scale === "micro" ? "panel-on" : ""}`}>
          <h2>Inside the bloom · 花之内</h2>
          <p>Pollen grains the size of stones, dew that bends the sky, and a ladybug making her slow round.</p>
          <p>滚轮拉远、按 Esc，或点击下方「回到山谷」即可返回宏观世界。</p>
        </div>
      </Html>
    </group>
  );
}
