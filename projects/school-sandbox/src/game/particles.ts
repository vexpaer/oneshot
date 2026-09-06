import * as THREE from "three";

export class ParticleSystem {
  points: THREE.Points;
  private cap: number;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private grav: Float32Array;
  private head = 0;

  constructor(cap = 800) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    for (let i = 0; i < cap; i++) this.pos[i * 3 + 1] = -1000;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.28, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = "Particles";
  }

  emit(p: THREE.Vector3, count: number, color: THREE.ColorRepresentation, speed = 5, gravity = 12, life = 0.6) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.head;
      this.head = (this.head + 1) % this.cap;
      this.pos[i * 3] = p.x;
      this.pos[i * 3 + 1] = p.y;
      this.pos[i * 3 + 2] = p.z;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * s;
      this.vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * s + 1;
      this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
      const j = 0.75 + Math.random() * 0.5;
      this.col[i * 3] = Math.min(1, c.r * j);
      this.col[i * 3 + 1] = Math.min(1, c.g * j);
      this.col[i * 3 + 2] = Math.min(1, c.b * j);
      this.life[i] = life * (0.6 + Math.random() * 0.8);
      this.grav[i] = gravity;
    }
  }

  update(dt: number) {
    let any = false;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -1000;
        continue;
      }
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    if (any) {
      (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
