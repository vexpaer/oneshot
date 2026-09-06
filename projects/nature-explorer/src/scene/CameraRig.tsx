import { useEffect, useRef, type ComponentRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useStore, type FlyTarget } from "../world/store";
import { INTRO, LOCATIONS, MICRO_ORIGIN, OVERVIEW } from "../world/content";
import { terrainHeight, U, WATER_LEVEL, world } from "../world/world";

type Controls = ComponentRef<typeof OrbitControls>;

interface Flight {
  fromPos: THREE.Vector3;
  fromLook: THREE.Vector3;
  toPos: THREE.Vector3;
  toLook: THREE.Vector3;
  t: number;
  dur: number;
  lift: number;
}

const raycaster = new THREE.Raycaster();
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function groundHit(camera: THREE.Camera, ndc: THREE.Vector2, out: THREE.Vector3): boolean {
  raycaster.setFromCamera(ndc, camera);
  const o = raycaster.ray.origin,
    d = raycaster.ray.direction;
  let prev = 0;
  for (let t = 0.5; t < 220; t += t < 30 ? 0.8 : 2.5) {
    tmp.copy(o).addScaledVector(d, t);
    const h = Math.max(terrainHeight(tmp.x, tmp.z), WATER_LEVEL);
    if (tmp.y < h) {
      // bisection refine
      let a = prev,
        b = t;
      for (let i = 0; i < 10; i++) {
        const m = (a + b) / 2;
        tmp.copy(o).addScaledVector(d, m);
        if (tmp.y < Math.max(terrainHeight(tmp.x, tmp.z), WATER_LEVEL)) b = m;
        else a = m;
      }
      out.copy(o).addScaledVector(d, (a + b) / 2);
      return true;
    }
    prev = t;
  }
  return false;
}

const ease = (x: number) => x * x * x * (x * (x * 6 - 15) + 10);

export function CameraRig() {
  const controls = useRef<Controls>(null);
  const { camera, gl } = useThree();
  const flight = useRef<Flight | null>(null);
  const keys = useRef(new Set<string>());
  const transitioning = useRef(false);
  const entered = useStore((s) => s.entered);
  const scale = useStore((s) => s.scale);

  const startFlight = (toPos: THREE.Vector3, toLook: THREE.Vector3, durOverride?: number) => {
    const c = controls.current;
    if (!c) return;
    const dist = camera.position.distanceTo(toPos);
    flight.current = {
      fromPos: camera.position.clone(),
      fromLook: c.target.clone(),
      toPos: toPos.clone(),
      toLook: toLook.clone(),
      t: 0,
      dur: durOverride ?? THREE.MathUtils.clamp(dist / 13, 1.4, 4.2),
      lift: Math.min(7, dist * 0.18),
    };
  };

  const teleport = (pos: THREE.Vector3, look: THREE.Vector3, newScale: "macro" | "micro") => {
    const st = useStore.getState();
    transitioning.current = true;
    flight.current = null;
    st.setFade(true);
    setTimeout(() => {
      camera.position.copy(pos);
      controls.current?.target.copy(look);
      controls.current?.update();
      st.setScale(newScale);
      st.setNear(newScale === "micro" ? "micro" : null);
      setTimeout(() => {
        st.setFade(false);
        transitioning.current = false;
      }, 350);
    }, 700);
  };

  const handleFly = (target: FlyTarget) => {
    const st = useStore.getState();
    if (target === "micro") {
      if (st.scale === "micro" || transitioning.current) return;
      teleport(MICRO_ORIGIN.clone().add(new THREE.Vector3(6, 11, 9)), MICRO_ORIGIN.clone().add(new THREE.Vector3(0, 1.5, 0)), "micro");
      return;
    }
    if (target === "macro") {
      if (st.scale === "macro" || transitioning.current) return;
      const f = LOCATIONS.find((l) => l.id === "flower")!;
      teleport(f.anchor.clone().add(new THREE.Vector3(3.5, 2.6, 5)), f.anchor.clone().add(f.lookOffset), "macro");
      return;
    }
    if (st.scale === "micro") {
      // leave micro first, then fly
      const f = LOCATIONS.find((l) => l.id === "flower")!;
      teleport(f.anchor.clone().add(new THREE.Vector3(3.5, 2.6, 5)), f.anchor.clone().add(f.lookOffset), "macro");
      setTimeout(() => handleFly(target), 1200);
      return;
    }
    if (target === "overview") {
      startFlight(OVERVIEW.pos, OVERVIEW.look);
      return;
    }
    const L = LOCATIONS.find((l) => l.id === target);
    if (!L) return;
    startFlight(L.anchor.clone().add(L.camOffset), L.anchor.clone().add(L.lookOffset));
  };

  // subscriptions
  useEffect(() => {
    const unsub = useStore.subscribe((s, prev) => {
      if (s.flyRequest && s.flyRequest !== prev.flyRequest) handleFly(s.flyRequest.target);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!entered) {
      camera.position.copy(INTRO.pos);
      controls.current?.target.copy(INTRO.look);
      controls.current?.update();
    } else {
      startFlight(OVERVIEW.pos, OVERVIEW.look, 5.5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entered]);

  // keyboard + pointer bookkeeping
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      keys.current.add(e.code);
      if (e.code === "Escape") {
        const st = useStore.getState();
        if (st.scale === "micro") st.flyTo("macro");
        else st.setFocusItem(null);
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const pd = (e: PointerEvent) => {
      world.pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    gl.domElement.addEventListener("pointerdown", pd);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      gl.domElement.removeEventListener("pointerdown", pd);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(delta, 0.05);
    const st = useStore.getState();
    const micro = st.scale === "micro";

    // pointer on ground (analytic)
    if (!micro && groundHit(camera, state.pointer, tmp2)) world.pointer.copy(tmp2);
    else world.pointer.set(9999, 0, 9999);

    // walk request from a ground click
    if (world.walkRequest && !micro && !flight.current && st.entered) {
      const p = world.walkRequest;
      world.walkRequest = null;
      const look = p.clone();
      look.y = Math.max(terrainHeight(p.x, p.z), WATER_LEVEL) + 1.1;
      const dir = camera.position.clone().sub(c.target).normalize();
      const dist = Math.min(camera.position.distanceTo(c.target), 6);
      const pos = look.clone().addScaledVector(dir, dist);
      pos.y = Math.max(pos.y, terrainHeight(pos.x, pos.z) + 1.6);
      startFlight(pos, look);
    }

    // flight
    if (flight.current) {
      const f = flight.current;
      f.t += dt;
      const k = ease(Math.min(1, f.t / f.dur));
      camera.position.lerpVectors(f.fromPos, f.toPos, k);
      camera.position.y += Math.sin(k * Math.PI) * f.lift;
      c.target.lerpVectors(f.fromLook, f.toLook, k);
      c.enabled = false;
      if (f.t >= f.dur) {
        flight.current = null;
        c.enabled = true;
      }
    } else if (st.entered && !transitioning.current) {
      c.enabled = true;
      // roam
      const k = keys.current;
      const fwd = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
      const side = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
      if (fwd || side) {
        const speed = (k.has("ShiftLeft") ? 16 : 8) * dt * (micro ? 0.6 : 1);
        tmp.subVectors(c.target, camera.position);
        tmp.y = 0;
        tmp.normalize();
        tmp2.crossVectors(tmp, camera.up).normalize();
        const move = tmp.multiplyScalar(fwd * speed).addScaledVector(tmp2, side * speed);
        camera.position.add(move);
        c.target.add(move);
        if (!micro) {
          const th = terrainHeight(c.target.x, c.target.z);
          const want = Math.max(th, WATER_LEVEL) + 1.2;
          const dy = (want - c.target.y) * Math.min(1, dt * 4);
          c.target.y += dy;
          camera.position.y += dy;
        }
      }
    }

    // keep above the ground
    if (!micro) {
      const minY = Math.max(terrainHeight(camera.position.x, camera.position.z), WATER_LEVEL) + 1.1;
      if (camera.position.y < minY) camera.position.y = minY;
      const tMin = Math.max(terrainHeight(c.target.x, c.target.z), WATER_LEVEL) + 0.4;
      if (c.target.y < tMin) c.target.y = tMin;
    }
    c.autoRotate = !st.entered;
    c.update();

    // proximity reveal
    if (st.entered && !transitioning.current) {
      if (micro) {
        if (camera.position.distanceTo(c.target) > 34) st.flyTo("macro");
      } else {
        let best: (typeof LOCATIONS)[number] | null = null;
        let bestD = 1e9;
        for (const L of LOCATIONS) {
          const d = camera.position.distanceTo(L.anchor);
          if (d < L.radius && d < bestD) {
            best = L;
            bestD = d;
          }
        }
        const id = best ? best.id : null;
        if (st.nearLocation !== id) st.setNear(id);
        // scale surprise: dive into the flower
        const f = LOCATIONS[LOCATIONS.length - 1];
        if (!flight.current && camera.position.distanceTo(f.anchor.clone().add(f.lookOffset)) < 1.9) st.flyTo("micro");
      }
    }
    U.uCamPos.value.copy(camera.position);
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      enablePan={false}
      rotateSpeed={0.45}
      zoomSpeed={0.7}
      minDistance={scale === "micro" ? 2 : 1.2}
      maxDistance={scale === "micro" ? 40 : 75}
      maxPolarAngle={1.56}
      minPolarAngle={0.08}
      autoRotate={!entered}
      autoRotateSpeed={0.18}
    />
  );
}
