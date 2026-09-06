import * as THREE from "three";
import type { Collider } from "./campus";
import { resolveCollision } from "./campus";
import { MAP_D, MAP_W } from "./layout";

export interface InputState {
  keys: Set<string>;
  dx: number;
  dy: number;
}

export class Player {
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  onGround = false;
  hp = 100;
  maxHp = 100;
  eye = 1.7;
  radius = 0.45;
  walkT = 0;
  speed = 6.5;
  sprint = 11;
  fly = false;

  constructor(x: number, z: number, yaw: number, groundY: number) {
    this.pos.set(x, groundY, z);
    this.yaw = yaw;
  }

  look(dx: number, dy: number, sens = 0.0022) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
  }

  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  update(dt: number, keys: Set<string>, groundAt: (x: number, z: number) => number, colliders: Collider[], onJump?: () => void) {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(f.z, 0, -f.x).negate();
    const move = new THREE.Vector3();
    if (keys.has("KeyW") || keys.has("ArrowUp")) move.add(f);
    if (keys.has("KeyS") || keys.has("ArrowDown")) move.sub(f);
    if (keys.has("KeyA") || keys.has("ArrowLeft")) move.sub(r);
    if (keys.has("KeyD") || keys.has("ArrowRight")) move.add(r);
    const sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const spd = (sprint ? this.sprint : this.speed) * (this.fly ? 2.5 : 1);
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(spd);
      this.walkT += dt * (sprint ? 14 : 9);
    }
    // 水平速度平滑
    const accel = this.onGround || this.fly ? 12 : 4;
    this.vel.x += (move.x - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (move.z - this.vel.z) * Math.min(1, accel * dt);

    if (this.fly) {
      let vy = 0;
      if (keys.has("Space")) vy += spd;
      if (keys.has("ControlLeft") || keys.has("KeyC")) vy -= spd;
      this.vel.y += (vy - this.vel.y) * Math.min(1, 10 * dt);
    } else {
      this.vel.y -= 22 * dt;
      if (keys.has("Space") && this.onGround) {
        this.vel.y = 7.5;
        this.onGround = false;
        onJump?.();
      }
    }
    this.pos.addScaledVector(this.vel, dt);
    // 地面
    const gy = groundAt(this.pos.x, this.pos.z);
    if (this.pos.y <= gy) {
      this.pos.y = gy;
      if (this.vel.y < 0) this.vel.y = 0;
      this.onGround = true;
    } else this.onGround = this.fly ? true : false;
    // 碰撞
    const p = this.pos;
    resolveCollision(p, this.radius, colliders);
    const lim = 2;
    p.x = Math.max(-MAP_W / 2 + lim, Math.min(MAP_W / 2 - lim, p.x));
    p.z = Math.max(-MAP_D / 2 + lim, Math.min(MAP_D / 2 - lim, p.z));
    const gy2 = groundAt(p.x, p.z);
    if (p.y < gy2) p.y = gy2;
  }

  applyCamera(cam: THREE.PerspectiveCamera) {
    const bob = this.onGround && this.vel.lengthSq() > 1 ? Math.sin(this.walkT) * 0.05 : 0;
    cam.position.set(this.pos.x, this.pos.y + this.eye + bob, this.pos.z);
    cam.rotation.set(0, 0, 0);
    cam.rotation.order = "YXZ";
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;
  }
}
