import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import { useStore, type LocationId } from "../world/store";
import { CONTENT, LOCATIONS, type Location } from "../world/content";
import { fbm, makeSoftCircle, mulberry32, terrainHeight, U, world, WATER_LEVEL } from "../world/world";
import { barkMaterial, getCanopyMaterial, makeBlobGeometry } from "./Trees";
import { ParticleSystem } from "./Particles";

const L = Object.fromEntries(LOCATIONS.map((l) => [l.id, l])) as Record<LocationId, Location>;
const woodMat = new THREE.MeshStandardMaterial({ color: 0x7d5e3f, roughness: 0.9 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x4d3a28, roughness: 0.95 });
const rockMat = new THREE.MeshStandardMaterial({ color: 0x6d6a64, roughness: 0.95 });

/* ---------- shared UI bits ---------- */
function Panel({ id, position, children, wide }: { id: LocationId | "micro"; position: [number, number, number]; children: ReactNode; wide?: boolean }) {
  const active = useStore((s) => s.nearLocation === id);
  return (
    <Html position={position} center zIndexRange={[40, 0]} style={{ pointerEvents: active ? "auto" : "none" }}>
      <div className={`panel ${wide ? "panel-wide" : ""} ${active ? "panel-on" : ""}`}>{children}</div>
    </Html>
  );
}

function Label({ id, text, cn, position }: { id: string; text: string; cn: string; position: [number, number, number] }) {
  const show = useStore((s) => s.hovered === id);
  return (
    <Html position={position} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
      <div className={`label ${show ? "label-on" : ""}`}>
        <span>{text}</span>
        <em>{cn}</em>
      </div>
    </Html>
  );
}

function useHover(id: string) {
  const setHovered = useStore((s) => s.setHovered);
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHovered(id);
    },
    onPointerOut: () => setHovered(null),
  };
}

function clicked(e: ThreeEvent<MouseEvent>) {
  const d = Math.hypot(e.clientX - world.pointerDown.x, e.clientY - world.pointerDown.y);
  return d < 6;
}

/* ---------- 1. Elder tree (About) ---------- */
function ElderTree() {
  const loc = L.about;
  const flyTo = useStore((s) => s.flyTo);
  const hover = useHover("about");
  const trunkGeo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      const r = 3.6 * Math.pow(1 - t, 2.2) + 0.9 - t * 0.35;
      pts.push(new THREE.Vector2(r, t * 15 - 0.6));
    }
    const g = new THREE.LatheGeometry(pts, 40);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const a = Math.atan2(z, x);
      const n = fbm(Math.cos(a) * 2.2 + 10, Math.sin(a) * 2.2 + y * 0.35, 3);
      const s = 1 + n * 0.16;
      p.setXYZ(i, x * s, y, z * s);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const blob = useMemo(() => makeBlobGeometry(21, 3, 0.14), []);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const runes = useMemo(() => {
    const n = 220;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = i * 0.29;
      const y = 0.4 + i * 0.05;
      const t = (y + 0.6) / 15;
      const r = 3.6 * Math.pow(1 - t, 2.2) + 0.9 - t * 0.35 + 0.25;
      pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const runeMat = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#b9ffd2",
        size: 0.16,
        map: makeSoftCircle(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const rnd = mulberry32(5);
    const c = new THREE.Color();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + rnd();
      const r = i === 0 ? 0 : 2.6 + rnd() * 2.4;
      const s = i === 0 ? 6.2 : 3.6 + rnd() * 1.8;
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, 12.5 + rnd() * 3 - (i === 0 ? 0 : 1), Math.sin(a) * r),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())),
        new THREE.Vector3(s, s * 0.85, s)
      );
      canopyRef.current!.setMatrixAt(i, m);
      canopyRef.current!.setColorAt(i, c.setRGB(0.3 + rnd() * 0.4, rnd() * 0.7, 0));
    }
    canopyRef.current!.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(() => {
    const near = useStore.getState().nearLocation === "about";
    runeMat.opacity += ((near ? 0.85 : 0) - runeMat.opacity) * 0.04;
    runeMat.size = 0.14 + 0.05 * Math.sin(U.uTime.value * 2);
  });
  const roots = useMemo(() => {
    const rnd = mulberry32(9);
    return Array.from({ length: 8 }, (_, i) => ({ a: (i / 8) * Math.PI * 2 + rnd() * 0.5, tilt: 1.15 + rnd() * 0.25, len: 4 + rnd() * 2 }));
  }, []);
  return (
    <group position={loc.anchor.toArray()}>
      <mesh
        geometry={trunkGeo}
        material={barkMaterial}
        castShadow
        receiveShadow
        {...hover}
        onClick={(e) => {
          e.stopPropagation();
          if (clicked(e)) flyTo("about");
        }}
      />
      {roots.map((r, i) => (
        <mesh key={i} position={[Math.cos(r.a) * 2.2, -0.4, Math.sin(r.a) * 2.2]} rotation={[0, -r.a, r.tilt]} material={barkMaterial} castShadow>
          <cylinderGeometry args={[0.12, 0.55, r.len, 6]} />
        </mesh>
      ))}
      <instancedMesh ref={canopyRef} args={[blob, getCanopyMaterial(), 10]} castShadow receiveShadow frustumCulled={false} />
      <points geometry={runes} material={runeMat} />
      <Label id="about" text="The Elder Tree" cn="古树 · About" position={[0, 9, 0]} />
      <Panel id="about" position={[3.2, 5.2, 2.6]}>
        <h2>{CONTENT.about.title}</h2>
        {CONTENT.about.lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
        <div className="rings">
          {CONTENT.about.rings.map((r) => (
            <span key={r}>{r}</span>
          ))}
        </div>
      </Panel>
    </group>
  );
}

/* ---------- 2. Standing stones (Projects) ---------- */
function StoneCircle() {
  const loc = L.projects;
  const flyTo = useStore((s) => s.flyTo);
  const setHovered = useStore((s) => s.setHovered);
  const setFocus = useStore((s) => s.setFocusItem);
  const focus = useStore((s) => s.focusItem);
  const hovered = useStore((s) => s.hovered);
  const items = CONTENT.projects;
  const geos = useMemo(() => items.map((_, i) => makeBlobGeometry(100 + i, 1, 0.28, false)), [items]);
  const mats = useMemo(
    () => items.map(() => new THREE.MeshStandardMaterial({ color: 0x6f6d68, roughness: 0.92, emissive: new THREE.Color("#79d6c4"), emissiveIntensity: 0 })),
    [items]
  );
  useFrame(() => {
    const near = useStore.getState().nearLocation === "projects";
    const h = useStore.getState().hovered;
    const f = useStore.getState().focusItem;
    const t = U.uTime.value;
    items.forEach((p, i) => {
      const target = (near ? 0.25 + 0.12 * Math.sin(t * 1.5 + i) : 0.03 * (1 - world.dayFactor)) + (h === p.id ? 0.9 : 0) + (f === p.id ? 0.7 : 0);
      mats[i].emissiveIntensity += (target - mats[i].emissiveIntensity) * 0.08;
    });
  });
  return (
    <group position={loc.anchor.toArray()}>
      {items.map((p, i) => {
        const a = (i / items.length) * Math.PI * 2 + 0.3;
        const r = 3.8;
        return (
          <group key={p.id} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation={[0, -a + Math.PI / 2, 0]}>
            <mesh
              geometry={geos[i]}
              material={mats[i]}
              scale={[0.75, 1.7 + (i % 2) * 0.3, 0.45]}
              position={[0, 1.3, 0]}
              castShadow
              receiveShadow
              onPointerOver={(e) => {
                e.stopPropagation();
                setHovered(p.id);
              }}
              onPointerOut={() => setHovered(null)}
              onClick={(e) => {
                e.stopPropagation();
                if (!clicked(e)) return;
                setFocus(p.id);
                flyTo("projects");
              }}
            />
            <Html position={[0, 3.4, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
              <div className={`stone-tag ${hovered === p.id || focus === p.id ? "on" : ""}`}>{p.title}</div>
            </Html>
          </group>
        );
      })}
      {/* moss cairn */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.2, 0.5, 9]} />
        <meshStandardMaterial color="#57614a" roughness={1} emissive="#4c8f5a" emissiveIntensity={0.25} />
      </mesh>
      <Label id="projects" text="Valley Stones" cn="山谷石碑 · Projects" position={[0, 4.6, 0]} />
      <Panel id="projects" position={[0, 2.8, -1.5]} wide>
        <h2>Projects · 作品</h2>
        <ul className="list">
          {items.map((p) => (
            <li
              key={p.id}
              className={focus === p.id ? "on" : ""}
              onMouseEnter={() => setHovered(p.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setFocus(focus === p.id ? null : p.id)}
            >
              <b>
                {p.title} <em>{p.cn}</em>
              </b>
              <span>{p.desc}</span>
              <small>{p.tags.join(" · ")}</small>
            </li>
          ))}
        </ul>
      </Panel>
    </group>
  );
}

/* ---------- 3. Treehouse (Notes) ---------- */
function Treehouse() {
  const loc = L.notes;
  const flyTo = useStore((s) => s.flyTo);
  const hover = useHover("notes");
  const blob = useMemo(() => makeBlobGeometry(33, 3, 0.14), []);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const windowMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffd9a0", emissive: "#ffb45a", emissiveIntensity: 0 }), []);
  const lampRef = useRef<THREE.PointLight>(null);
  const papers = useRef<THREE.Mesh[]>([]);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const rnd = mulberry32(12);
    const c = new THREE.Color();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = i === 0 ? 0 : 1.8 + rnd() * 1.6;
      const s = i === 0 ? 4.2 : 2.6 + rnd() * 1.2;
      m.compose(new THREE.Vector3(Math.cos(a) * r, 11.2 + rnd() * 2, Math.sin(a) * r), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())), new THREE.Vector3(s, s * 0.85, s));
      canopyRef.current!.setMatrixAt(i, m);
      canopyRef.current!.setColorAt(i, c.setRGB(0.4 + rnd() * 0.4, rnd() * 0.6, 0));
    }
    canopyRef.current!.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(() => {
    const night = 1 - world.dayFactor;
    windowMat.emissiveIntensity = 0.15 + night * 2.2;
    if (lampRef.current) lampRef.current.intensity = 0.3 + night * 9;
    const t = U.uTime.value;
    papers.current.forEach((p, i) => {
      if (p) p.rotation.z = Math.sin(t * 1.7 + i) * 0.12 * (0.3 + U.uWind.value);
    });
  });
  const posts = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2), []);
  return (
    <group position={loc.anchor.toArray()}>
      <mesh material={barkMaterial} position={[0, 5, 0]} castShadow receiveShadow {...hover} onClick={(e) => { e.stopPropagation(); if (clicked(e)) flyTo("notes"); }}>
        <cylinderGeometry args={[0.85, 1.35, 11, 9]} />
      </mesh>
      <group position={[0, 6, 0]}>
        <mesh material={woodMat} castShadow receiveShadow>
          <cylinderGeometry args={[3.4, 3.1, 0.28, 18]} />
        </mesh>
        {posts.map((a, i) => (
          <mesh key={i} material={darkWood} position={[Math.cos(a) * 3.2, 0.6, Math.sin(a) * 3.2]}>
            <cylinderGeometry args={[0.05, 0.05, 1.1, 5]} />
          </mesh>
        ))}
        <mesh material={darkWood} position={[0, 1.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.2, 0.04, 6, 36]} />
        </mesh>
        {/* hut */}
        <group position={[-0.4, 1.35, -0.6]} rotation={[0, 0.5, 0]} onClick={(e) => { e.stopPropagation(); if (clicked(e)) flyTo("notes"); }} {...hover}>
          <mesh material={darkWood} castShadow receiveShadow>
            <boxGeometry args={[3.2, 2.5, 3.0]} />
          </mesh>
          <mesh position={[0, 2.05, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[2.9, 1.7, 4]} />
            <meshStandardMaterial color="#3e3126" roughness={1} />
          </mesh>
          <mesh material={windowMat} position={[0, 0.2, 1.51]}>
            <planeGeometry args={[0.9, 0.9]} />
          </mesh>
          <mesh material={windowMat} position={[1.61, 0.2, 0.3]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[0.8, 0.8]} />
          </mesh>
          <mesh position={[-1.61, -0.35, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[0.9, 1.8]} />
            <meshStandardMaterial color="#2a2019" />
          </mesh>
        </group>
        {/* hanging notes */}
        {CONTENT.notes.map((_, i) => (
          <mesh
            key={i}
            ref={(el) => {
              if (el) papers.current[i] = el;
            }}
            position={[Math.cos(0.9 + i * 0.5) * 3.25, 0.55, Math.sin(0.9 + i * 0.5) * 3.25]}
            rotation={[0, -(0.9 + i * 0.5) + Math.PI / 2, 0]}
          >
            <planeGeometry args={[0.42, 0.6]} />
            <meshStandardMaterial color="#f1e8d6" side={THREE.DoubleSide} emissive="#fff0d0" emissiveIntensity={0.15} />
          </mesh>
        ))}
        <pointLight ref={lampRef} position={[1.2, 0.9, 1.6]} color="#ffb060" distance={16} decay={2} />
        <mesh position={[1.2, 0.9, 1.6]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#ffe0a0" emissive="#ffb45a" emissiveIntensity={3} />
        </mesh>
      </group>
      {/* ladder */}
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} material={woodMat} position={[1.5, 0.6 + i * 0.62, 1.4]} rotation={[0, -0.8, 0]}>
          <boxGeometry args={[0.6, 0.06, 0.06]} />
        </mesh>
      ))}
      <instancedMesh ref={canopyRef} args={[blob, getCanopyMaterial(), 7]} castShadow receiveShadow frustumCulled={false} />
      <Label id="notes" text="The Treehouse" cn="树屋 · Notes" position={[0, 9.6, 0]} />
      <Panel id="notes" position={[-1.5, 7.6, 3.4]}>
        <h2>Notes · 手记</h2>
        {CONTENT.notes.map((n) => (
          <div className="note" key={n.title}>
            <small>{n.date}</small>
            <b>{n.title}</b>
            <p>{n.text}</p>
          </div>
        ))}
      </Panel>
    </group>
  );
}

/* ---------- 4. Lake of lights (Gallery) ---------- */
function LakeGalleryInner() {
  const loc = L.gallery;
  const items = CONTENT.gallery;
  const textures = useTexture(items.map((g) => g.src));
  textures.forEach((t) => (t.colorSpace = THREE.SRGBColorSpace));
  const flyTo = useStore((s) => s.flyTo);
  const setHovered = useStore((s) => s.setHovered);
  const setFocus = useStore((s) => s.setFocusItem);
  const focus = useStore((s) => s.focusItem);
  const orbs = useRef<THREE.Mesh[]>([]);
  const planes = useRef<THREE.Mesh[]>([]);
  const light = useRef<THREE.PointLight>(null);
  const spots = useMemo(() => items.map((_, i) => ({ x: (i - (items.length - 1) / 2) * 3.4, z: 9.5 - Math.abs(i - 1.5) * 1.2 })), [items]);
  useFrame(() => {
    const st = useStore.getState();
    const near = st.nearLocation === "gallery";
    const t = U.uTime.value;
    const night = 1 - world.dayFactor;
    orbs.current.forEach((o, i) => {
      if (!o) return;
      o.position.y = WATER_LEVEL + 1.35 + Math.sin(t * 0.8 + i * 1.3) * 0.18;
      const s = (st.hovered === `g${i}` || st.focusItem === `g${i}` ? 1.5 : 1) * (near ? 1.15 : 1);
      o.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
      const m = o.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 0.8 + night * 1.6 + (near ? 0.6 : 0) + 0.3 * Math.sin(t * 2 + i);
    });
    planes.current.forEach((p) => {
      if (!p) return;
      const m = p.material as THREE.MeshBasicMaterial;
      m.opacity += ((near ? 0.7 : 0.28) - m.opacity) * 0.05;
    });
    if (light.current) light.current.intensity = night * 6 + (near ? 2 : 0);
  });
  const focusIdx = focus?.startsWith("g") ? Number(focus.slice(1)) : 0;
  return (
    <group position={[loc.anchor.x, WATER_LEVEL, 0]}>
      {items.map((g, i) => (
        <group key={g.src} position={[spots[i].x, 0, spots[i].z]}>
          <mesh
            ref={(el) => {
              if (el) orbs.current[i] = el;
            }}
            position={[0, 1.3, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHovered(`g${i}`);
            }}
            onPointerOut={() => setHovered(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (!clicked(e)) return;
              setFocus(`g${i}`);
              flyTo("gallery");
            }}
          >
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial color="#e6f3ff" emissive="#bfe0ff" emissiveIntensity={1} roughness={0.3} />
          </mesh>
          <mesh
            ref={(el) => {
              if (el) planes.current[i] = el;
            }}
            position={[0, 0.09, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={3}
          >
            <planeGeometry args={[2.6, 1.7]} />
            <meshBasicMaterial map={textures[i]} transparent opacity={0.3} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <pointLight ref={light} position={[0, 2.5, 8.5]} color="#bcd8ff" distance={20} decay={2} />
      <Label id="gallery" text="Lake of Lights" cn="光之湖 · Gallery" position={[0, 3.2, 9]} />
      <Panel id="gallery" position={[0, 2.6, 8.5]} wide>
        <h2>Gallery · 影集</h2>
        <div className="gallery">
          <img src={items[focusIdx].src} alt={items[focusIdx].title} />
          <div className="cap">
            <b>{items[focusIdx].title}</b> <em>{items[focusIdx].cn}</em>
          </div>
          <div className="thumbs">
            {items.map((g, i) => (
              <img key={g.src} src={g.src} alt={g.title} className={i === focusIdx ? "on" : ""} onClick={() => setFocus(`g${i}`)} onMouseEnter={() => setHovered(`g${i}`)} onMouseLeave={() => setHovered(null)} />
            ))}
          </div>
        </div>
      </Panel>
    </group>
  );
}
function LakeGallery() {
  return (
    <Suspense fallback={null}>
      <LakeGalleryInner />
    </Suspense>
  );
}

/* ---------- 5. Crystal cave (Experiments) ---------- */
function CrystalCave() {
  const loc = L.experiments;
  const flyTo = useStore((s) => s.flyTo);
  const setHovered = useStore((s) => s.setHovered);
  const setFocus = useStore((s) => s.setFocusItem);
  const focus = useStore((s) => s.focusItem);
  const hoveredId = useStore((s) => s.hovered);
  const hover = useHover("experiments");
  const items = CONTENT.experiments;
  const rotY = Math.atan2(-(10 - loc.anchor.z), 0 - loc.anchor.x);
  const domeMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: 0x5f5b55, roughness: 1, side: THREE.DoubleSide });
    m.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocal = position;");
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vLocal;")
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
          if (vLocal.y < 3.4 && normalize(vLocal.xz).x > 0.80) discard;`
        )
        .replace("#include <color_fragment>", "#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.28;");
    };
    m.customProgramCacheKey = () => "cave-dome";
    return m;
  }, []);
  const domeGeo = useMemo(() => {
    const g = new THREE.SphereGeometry(6.5, 30, 18, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const s = 1 + fbm(x * 0.3 + 3, z * 0.3 + y * 0.2, 3) * 0.12;
      p.setXYZ(i, x * s, y * s, z * s);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  const mats = useMemo(
    () => items.map((e) => new THREE.MeshStandardMaterial({ color: e.color, emissive: e.color, emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 })),
    [items]
  );
  const lightRef = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const st = useStore.getState();
    const near = st.nearLocation === "experiments";
    const t = U.uTime.value;
    const night = 1 - world.dayFactor;
    items.forEach((e, i) => {
      const target = 0.35 + 0.3 * Math.sin(t * 1.3 + i * 1.7) + night * 0.5 + (near ? 0.7 : 0) + (st.hovered === e.id ? 1.4 : 0) + (st.focusItem === e.id ? 0.9 : 0);
      mats[i].emissiveIntensity += (target - mats[i].emissiveIntensity) * 0.08;
    });
    if (lightRef.current) lightRef.current.intensity = 2 + night * 4 + (near ? 4 : 0);
  });
  const blobs = useMemo(() => [makeBlobGeometry(41, 1, 0.3, false), makeBlobGeometry(42, 1, 0.3, false), makeBlobGeometry(43, 1, 0.3, false)], []);
  return (
    <group position={loc.anchor.toArray()} rotation={[0, rotY, 0]}>
      <mesh geometry={domeGeo} material={domeMat} position={[0, -0.2, 0]} receiveShadow {...hover} onClick={(e) => { e.stopPropagation(); if (clicked(e)) flyTo("experiments"); }} />
      {/* flanking rocks */}
      <mesh geometry={blobs[0]} material={rockMat} position={[5.2, 0.6, 3.6]} scale={[1.8, 1.4, 1.5]} castShadow receiveShadow />
      <mesh geometry={blobs[1]} material={rockMat} position={[5.4, 0.5, -3.4]} scale={[1.6, 1.9, 1.5]} castShadow receiveShadow />
      <mesh geometry={blobs[2]} material={rockMat} position={[-2, 4.8, 1]} scale={[3.2, 2.0, 2.8]} castShadow receiveShadow />
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <circleGeometry args={[6.4, 32]} />
        <meshStandardMaterial color="#2a2925" roughness={1} />
      </mesh>
      {/* crystals */}
      {items.map((e, i) => {
        const a = Math.PI * (0.62 + (i / (items.length - 1)) * 0.76);
        const r = 3.6 + (i % 2) * 0.9;
        return (
          <group
            key={e.id}
            position={[Math.cos(a) * r, 0, Math.sin(a) * r]}
            onPointerOver={(ev) => {
              ev.stopPropagation();
              setHovered(e.id);
            }}
            onPointerOut={() => setHovered(null)}
            onClick={(ev) => {
              ev.stopPropagation();
              if (!clicked(ev)) return;
              setFocus(e.id);
              flyTo("experiments");
            }}
          >
            {[0, 1, 2].map((k) => (
              <mesh key={k} material={mats[i]} position={[Math.cos(k * 2.1) * 0.35, 0.5 + k * 0.1, Math.sin(k * 2.1) * 0.35]} rotation={[Math.cos(k * 1.7) * 0.35, 0, Math.sin(k * 2.3) * 0.35]}>
                <coneGeometry args={[0.22 + k * 0.05, 1.1 + k * 0.45, 6]} />
              </mesh>
            ))}
            <Html position={[0, 2.2, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
              <div className={`stone-tag ${hoveredId === e.id || focus === e.id ? "on" : ""}`} style={{ color: e.color }}>
                {e.title}
              </div>
            </Html>
          </group>
        );
      })}
      <pointLight ref={lightRef} position={[0, 2.2, 0]} color="#9fe3ff" distance={16} decay={2} />
      <Label id="experiments" text="Crystal Cave" cn="晶石洞穴 · Experiments" position={[4, 5.4, 0]} />
      <Panel id="experiments" position={[-1.5, 3.0, 0]}>
        <h2>Experiments · 实验</h2>
        <ul className="list">
          {items.map((e) => (
            <li key={e.id} className={focus === e.id ? "on" : ""} onMouseEnter={() => setHovered(e.id)} onMouseLeave={() => setHovered(null)} onClick={() => setFocus(focus === e.id ? null : e.id)}>
              <b>
                <i className="dot" style={{ background: e.color }} />
                {e.title} <em>{e.cn}</em>
              </b>
              <span>{e.note}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </group>
  );
}

/* ---------- 6. Lookout (Contact) ---------- */
function Lookout() {
  const loc = L.contact;
  const flyTo = useStore((s) => s.flyTo);
  const hover = useHover("contact");
  const posts = useMemo(() => Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2), []);
  const lanternMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffe2a8", emissive: "#ffc46a", emissiveIntensity: 1 }), []);
  const lamp = useRef<THREE.PointLight>(null);
  const circle = useMemo(() => makeSoftCircle(), []);
  useFrame(() => {
    const night = 1 - world.dayFactor;
    const near = useStore.getState().nearLocation === "contact";
    lanternMat.emissiveIntensity = 0.6 + night * 2.5 + (near ? 0.8 : 0);
    if (lamp.current) lamp.current.intensity = 0.5 + night * 7 + (near ? 2 : 0);
  });
  return (
    <>
    <ParticleSystem
      mode="firefly"
      count={90}
      center={[loc.anchor.x, loc.anchor.y + 1.4, loc.anchor.z - 0.6]}
      area={[5, 2.4, 5]}
      color="#f2ffb0"
      color2="#ffd27a"
      size={5}
      glow={1.5}
      map={circle}
      additive
      seed={44}
      vis={() => (useStore.getState().nearLocation === "contact" ? 1 : 0.55 * (1 - world.dayFactor))}
    />
    <group position={loc.anchor.toArray()}>
      <mesh material={woodMat} position={[0, 0.15, 0]} castShadow receiveShadow {...hover} onClick={(e) => { e.stopPropagation(); if (clicked(e)) flyTo("contact"); }}>
        <cylinderGeometry args={[3.3, 3.0, 0.3, 20]} />
      </mesh>
      {posts.map((a, i) => (
        <mesh key={i} material={darkWood} position={[Math.cos(a) * 3.1, 0.8, Math.sin(a) * 3.1]}>
          <cylinderGeometry args={[0.05, 0.06, 1.1, 5]} />
        </mesh>
      ))}
      <mesh material={darkWood} position={[0, 1.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[3.1, 0.045, 6, 40]} />
      </mesh>
      {/* lantern post (firefly mailbox) */}
      <group position={[0, 0.3, -1.2]} {...hover} onClick={(e) => { e.stopPropagation(); if (clicked(e)) flyTo("contact"); }}>
        <mesh material={darkWood} position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 2.4, 6]} />
        </mesh>
        <mesh material={darkWood} position={[0, 2.35, 0.3]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.08, 0.08, 0.7]} />
        </mesh>
        <mesh material={lanternMat} position={[0, 2.0, 0.6]}>
          <boxGeometry args={[0.3, 0.42, 0.3]} />
        </mesh>
        <mesh material={darkWood} position={[0, 2.25, 0.6]}>
          <coneGeometry args={[0.28, 0.16, 4]} />
        </mesh>
        <pointLight ref={lamp} position={[0, 2.0, 0.6]} color="#ffc46a" distance={14} decay={2} />
      </group>
      {/* bench */}
      <mesh material={woodMat} position={[1.6, 0.6, 1.4]} rotation={[0, -0.7, 0]} castShadow>
        <boxGeometry args={[1.6, 0.08, 0.45]} />
      </mesh>
      <Label id="contact" text="Sky Lookout" cn="山顶观景台 · Contact" position={[0, 3.6, 0]} />
      <Panel id="contact" position={[1.8, 2.6, -1.4]}>
        <h2>Contact · 萤火信箱</h2>
        <p>Leave a light here — I'll follow it back to you.</p>
        <ul className="links">
          {CONTENT.contact.map((c) => (
            <li key={c.label}>
              <a href={c.href} target="_blank" rel="noreferrer">
                <small>{c.label}</small>
                <b>{c.value}</b>
              </a>
            </li>
          ))}
        </ul>
      </Panel>
    </group>
    </>
  );
}

/* ---------- 7. Wild flower (gateway to the micro world) ---------- */
function WildFlower() {
  const loc = L.flower;
  const flyTo = useStore((s) => s.flyTo);
  const hover = useHover("flower");
  const grp = useRef<THREE.Group>(null);
  const petalMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#f3a9c0", roughness: 0.55, side: THREE.DoubleSide }), []);
  const baseCol = useMemo(() => new THREE.Color("#f3a9c0"), []);
  const dryCol = useMemo(() => new THREE.Color("#a58a7a"), []);
  useFrame(() => {
    const S = world.seasonMix;
    const s = 1 - S.w * 0.5 - S.z * 0.15;
    if (grp.current) grp.current.scale.setScalar(s);
    petalMat.color.copy(baseCol).lerp(dryCol, S.w * 0.8 + S.z * 0.35);
  });
  const flowers = [
    { p: [0, 0, 0] as [number, number, number], h: 1.15, r: 0.36 },
    { p: [0.7, 0, -0.4] as [number, number, number], h: 0.85, r: 0.26 },
    { p: [-0.55, 0, 0.45] as [number, number, number], h: 0.7, r: 0.22 },
  ];
  return (
    <group position={loc.anchor.toArray()}>
      <group
        ref={grp}
        {...hover}
        onClick={(e) => {
          e.stopPropagation();
          if (!clicked(e)) return;
          flyTo(useStore.getState().nearLocation === "flower" ? "micro" : "flower");
        }}
      >
        {flowers.map((f, i) => (
          <group key={i} position={f.p}>
            <mesh position={[0, f.h / 2, 0]}>
              <cylinderGeometry args={[0.025, 0.04, f.h, 6]} />
              <meshStandardMaterial color="#4c7a35" roughness={0.8} />
            </mesh>
            <mesh position={[0.18, f.h * 0.45, 0]} rotation={[0, 0, -0.6]}>
              <sphereGeometry args={[0.16, 8, 6]} />
              <meshStandardMaterial color="#4c7a35" roughness={0.8} />
            </mesh>
            <group position={[0, f.h, 0]} rotation={[0.25, 0, 0]}>
              {Array.from({ length: 6 }, (_, k) => {
                const a = (k / 6) * Math.PI * 2;
                return (
                  <mesh key={k} material={petalMat} position={[Math.cos(a) * f.r * 0.9, 0, Math.sin(a) * f.r * 0.9]} rotation={[0, -a, 0.3]} scale={[1.5, 0.22, 0.8]} castShadow>
                    <sphereGeometry args={[f.r, 10, 8]} />
                  </mesh>
                );
              })}
              <mesh>
                <sphereGeometry args={[f.r * 0.45, 10, 8]} />
                <meshStandardMaterial color="#f2c94c" roughness={0.9} emissive="#f2c94c" emissiveIntensity={0.15} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
      <Label id="flower" text="A wild flower" cn="靠近 · 进入微观世界" position={[0, 1.9, 0]} />
      <Panel id="flower" position={[0, 2.1, -0.4]}>
        <h2>Closer · 再近一点</h2>
        <p>Scroll in until the petals fill your view, or click the flower again, and the valley will fold into a single bloom.</p>
        <p>继续滚轮推进到花朵近前，或再次点击它——你会进入一个花粉与露珠的微观世界。</p>
      </Panel>
    </group>
  );
}

/* ---------- scatter rocks & mushrooms ---------- */
function Scatter() {
  const quality = useStore((s) => s.quality);
  const rockGeo = useMemo(() => makeBlobGeometry(77, 1, 0.35, false), []);
  const capGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), []);
  const stemGeo = useMemo(() => new THREE.CylinderGeometry(0.35, 0.45, 1, 6), []);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b8694a", roughness: 0.7, emissive: "#8fd8b0", emissiveIntensity: 0 }), []);
  const nR = quality === "high" ? 140 : 60;
  const nM = quality === "high" ? 160 : 60;
  useLayoutEffect(() => {
    const rnd = mulberry32(555);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const okPos = () => {
      for (let t = 0; t < 40; t++) {
        const a = rnd() * Math.PI * 2;
        const r = 12 + rnd() * 75;
        const x = Math.cos(a) * r,
          z = Math.sin(a) * r + 8;
        const y = terrainHeight(x, z);
        if (y > WATER_LEVEL + 0.5 && Math.hypot(x + 27, z - 23) > 8) return [x, y, z];
      }
      return null;
    };
    for (let i = 0; i < nR; i++) {
      const p = okPos();
      if (!p) continue;
      const s = 0.3 + rnd() * 1.1;
      m.compose(new THREE.Vector3(p[0], p[1] - s * 0.3, p[2]), q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd())), new THREE.Vector3(s * (1 + rnd()), s * 0.7, s));
      rocks.current!.setMatrixAt(i, m);
    }
    rocks.current!.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < nM; i++) {
      const p = okPos();
      if (!p) continue;
      const s = 0.12 + rnd() * 0.22;
      m.compose(new THREE.Vector3(p[0], p[1] + s * 0.9, p[2]), q.identity(), new THREE.Vector3(s, s * 0.7, s));
      caps.current!.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(p[0], p[1] + s * 0.45, p[2]), q, new THREE.Vector3(s, s * 0.9, s));
      stems.current!.setMatrixAt(i, m);
    }
    caps.current!.instanceMatrix.needsUpdate = true;
    stems.current!.instanceMatrix.needsUpdate = true;
  }, [nR, nM]);
  useFrame(() => {
    capMat.emissiveIntensity = (1 - world.dayFactor) * (0.9 + 0.3 * Math.sin(U.uTime.value * 1.5));
  });
  return (
    <group>
      <instancedMesh ref={rocks} args={[rockGeo, rockMat, nR]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={caps} args={[capGeo, capMat, nM]} castShadow frustumCulled={false} />
      <instancedMesh ref={stems} args={[stemGeo, new THREE.MeshStandardMaterial({ color: "#e8dcc4" }), nM]} frustumCulled={false} />
    </group>
  );
}

export function Landmarks() {
  const setHovered = useStore((s) => s.setHovered);
  useEffect(() => () => setHovered(null), [setHovered]);
  return (
    <group>
      <ElderTree />
      <StoneCircle />
      <Treehouse />
      <LakeGallery />
      <CrystalCave />
      <Lookout />
      <WildFlower />
      <Scatter />
    </group>
  );
}
