import * as THREE from 'three';

export interface Box {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface Cyl {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
}

export class CollisionWorld {
  boxes: Box[] = [];
  cyls: Cyl[] = [];
  bounds = { minX: -78, maxX: 78, minZ: -38, maxZ: 38 };

  addBox(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
    this.boxes.push({
      min: new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
      max: new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
    });
  }

  addBoxMinMax(min: THREE.Vector3, max: THREE.Vector3) {
    this.boxes.push({ min: min.clone(), max: max.clone() });
  }

  addCyl(x: number, z: number, r: number, y0: number, y1: number) {
    this.cyls.push({ x, z, r, y0, y1 });
  }

  /** Height of the highest surface under (x,z) at or below y (plus tolerance). */
  groundHeight(x: number, z: number, y: number, hw: number): number {
    let best = 0;
    for (const b of this.boxes) {
      if (x + hw > b.min.x && x - hw < b.max.x && z + hw > b.min.z && z - hw < b.max.z) {
        if (b.max.y <= y + 0.05 && b.max.y > best) best = b.max.y;
      }
    }
    for (const c of this.cyls) {
      const dx = x - c.x;
      const dz = z - c.z;
      if (dx * dx + dz * dz < (c.r + hw) * (c.r + hw)) {
        if (c.y1 <= y + 0.05 && c.y1 > best) best = c.y1;
      }
    }
    return best;
  }

  private overlapsAny(px: number, py: number, pz: number, hw: number, h: number): boolean {
    for (const b of this.boxes) {
      if (
        px + hw > b.min.x &&
        px - hw < b.max.x &&
        py + h > b.min.y &&
        py < b.max.y &&
        pz + hw > b.min.z &&
        pz - hw < b.max.z
      )
        return true;
    }
    return false;
  }

  /**
   * Move an axis-aligned body (feet position `pos`, half width hw, height h) by vel*dt
   * with collision resolution and step-up. Returns grounded flag & modifies pos/vel.
   */
  moveBody(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    dt: number,
    hw: number,
    h: number,
    stepHeight: number,
    out: { grounded: boolean; blocked: boolean; hitCeiling: boolean },
  ) {
    out.grounded = false;
    out.blocked = false;
    out.hitCeiling = false;
    const boxes = this.boxes;

    // ---- X axis
    const dx = vel.x * dt;
    if (dx !== 0) {
      pos.x += dx;
      for (const b of boxes) {
        if (
          pos.x + hw > b.min.x &&
          pos.x - hw < b.max.x &&
          pos.y + h > b.min.y &&
          pos.y < b.max.y &&
          pos.z + hw > b.min.z &&
          pos.z - hw < b.max.z
        ) {
          // step-up attempt
          const stepY = b.max.y;
          if (stepY - pos.y <= stepHeight && stepY - pos.y > 0 && !this.overlapsAny(pos.x, stepY + 0.001, pos.z, hw, h)) {
            pos.y = stepY + 0.001;
            continue;
          }
          if (dx > 0) pos.x = b.min.x - hw - 0.001;
          else pos.x = b.max.x + hw + 0.001;
          vel.x = 0;
          out.blocked = true;
        }
      }
    }

    // ---- Z axis
    const dz = vel.z * dt;
    if (dz !== 0) {
      pos.z += dz;
      for (const b of boxes) {
        if (
          pos.x + hw > b.min.x &&
          pos.x - hw < b.max.x &&
          pos.y + h > b.min.y &&
          pos.y < b.max.y &&
          pos.z + hw > b.min.z &&
          pos.z - hw < b.max.z
        ) {
          const stepY = b.max.y;
          if (stepY - pos.y <= stepHeight && stepY - pos.y > 0 && !this.overlapsAny(pos.x, stepY + 0.001, pos.z, hw, h)) {
            pos.y = stepY + 0.001;
            continue;
          }
          if (dz > 0) pos.z = b.min.z - hw - 0.001;
          else pos.z = b.max.z + hw + 0.001;
          vel.z = 0;
          out.blocked = true;
        }
      }
    }

    // ---- Cylinders (radial push)
    for (const c of this.cyls) {
      if (pos.y + h <= c.y0 || pos.y >= c.y1) {
        continue;
      }
      const ddx = pos.x - c.x;
      const ddz = pos.z - c.z;
      const rr = c.r + hw;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < rr * rr) {
        // step-up onto cylinder?
        if (c.y1 - pos.y <= stepHeight && c.y1 - pos.y > 0) {
          pos.y = c.y1 + 0.001;
          continue;
        }
        const d = Math.sqrt(d2) || 0.0001;
        const nx = ddx / d;
        const nz = ddz / d;
        pos.x = c.x + nx * (rr + 0.001);
        pos.z = c.z + nz * (rr + 0.001);
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) {
          vel.x -= vn * nx;
          vel.z -= vn * nz;
        }
        out.blocked = true;
      }
    }

    // ---- Y axis
    const dy = vel.y * dt;
    pos.y += dy;
    for (const b of boxes) {
      if (
        pos.x + hw > b.min.x &&
        pos.x - hw < b.max.x &&
        pos.y + h > b.min.y &&
        pos.y < b.max.y &&
        pos.z + hw > b.min.z &&
        pos.z - hw < b.max.z
      ) {
        if (dy <= 0) {
          pos.y = b.max.y + 0.001;
          vel.y = 0;
          out.grounded = true;
        } else {
          pos.y = b.min.y - h - 0.001;
          vel.y = 0;
          out.hitCeiling = true;
        }
      }
    }
    for (const c of this.cyls) {
      const ddx = pos.x - c.x;
      const ddz = pos.z - c.z;
      const rr = c.r + hw;
      if (ddx * ddx + ddz * ddz < rr * rr && pos.y + h > c.y0 && pos.y < c.y1) {
        if (dy <= 0) {
          pos.y = c.y1 + 0.001;
          vel.y = 0;
          out.grounded = true;
        } else {
          pos.y = c.y0 - h - 0.001;
          vel.y = 0;
        }
      }
    }
    if (pos.y <= 0) {
      pos.y = 0;
      if (vel.y < 0) vel.y = 0;
      out.grounded = true;
    }

    // ---- Desk bounds
    const bd = this.bounds;
    if (pos.x < bd.minX + hw) {
      pos.x = bd.minX + hw;
      vel.x = Math.max(0, vel.x);
    }
    if (pos.x > bd.maxX - hw) {
      pos.x = bd.maxX - hw;
      vel.x = Math.min(0, vel.x);
    }
    if (pos.z < bd.minZ + hw) {
      pos.z = bd.minZ + hw;
      vel.z = Math.max(0, vel.z);
    }
    if (pos.z > bd.maxZ - hw) {
      pos.z = bd.maxZ - hw;
      vel.z = Math.min(0, vel.z);
    }
  }

  /** Ray vs all static geometry. Returns distance or Infinity. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, outNormal?: THREE.Vector3): number {
    let best = maxDist;
    let bestAxis = -1;
    let bestSign = 0;
    // ground plane
    if (dir.y < 0) {
      const t = -origin.y / dir.y;
      if (t > 0 && t < best) {
        best = t;
        bestAxis = 1;
        bestSign = 1;
      }
    }
    const invx = 1 / dir.x;
    const invy = 1 / dir.y;
    const invz = 1 / dir.z;
    for (const b of this.boxes) {
      let tmin = 0;
      let tmax = best;
      let axis = -1;
      let sign = 0;
      // x
      let t1 = (b.min.x - origin.x) * invx;
      let t2 = (b.max.x - origin.x) * invx;
      let s = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        axis = 0;
        sign = s;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
      // y
      t1 = (b.min.y - origin.y) * invy;
      t2 = (b.max.y - origin.y) * invy;
      s = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        axis = 1;
        sign = s;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
      // z
      t1 = (b.min.z - origin.z) * invz;
      t2 = (b.max.z - origin.z) * invz;
      s = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        axis = 2;
        sign = s;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) continue;
      if (tmin > 0 && tmin < best) {
        best = tmin;
        bestAxis = axis;
        bestSign = sign;
      }
    }
    // cylinders (infinite-ish, clipped by y)
    for (const c of this.cyls) {
      const ox = origin.x - c.x;
      const oz = origin.z - c.z;
      const a = dir.x * dir.x + dir.z * dir.z;
      if (a < 1e-8) continue;
      const bq = 2 * (ox * dir.x + oz * dir.z);
      const cq = ox * ox + oz * oz - c.r * c.r;
      const disc = bq * bq - 4 * a * cq;
      if (disc < 0) continue;
      const t = (-bq - Math.sqrt(disc)) / (2 * a);
      if (t > 0 && t < best) {
        const y = origin.y + dir.y * t;
        if (y >= c.y0 && y <= c.y1) {
          best = t;
          bestAxis = 3;
          if (outNormal) {
            outNormal.set(ox + dir.x * t, 0, oz + dir.z * t).normalize();
          }
        }
      }
      // top cap
      if (dir.y < 0) {
        const tc = (c.y1 - origin.y) / dir.y;
        if (tc > 0 && tc < best) {
          const x = ox + dir.x * tc;
          const z = oz + dir.z * tc;
          if (x * x + z * z <= c.r * c.r) {
            best = tc;
            bestAxis = 1;
            bestSign = 1;
          }
        }
      }
    }
    if (outNormal && bestAxis !== 3) {
      outNormal.set(0, 0, 0);
      if (bestAxis === 0) outNormal.x = bestSign;
      else if (bestAxis === 1) outNormal.y = bestSign;
      else if (bestAxis === 2) outNormal.z = bestSign;
      else outNormal.y = 1;
    }
    return best;
  }

  /** Simple point-in-solid check (for projectiles) */
  pointInside(p: THREE.Vector3): boolean {
    if (p.y <= 0) return true;
    for (const b of this.boxes) {
      if (p.x > b.min.x && p.x < b.max.x && p.y > b.min.y && p.y < b.max.y && p.z > b.min.z && p.z < b.max.z) return true;
    }
    for (const c of this.cyls) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      if (dx * dx + dz * dz < c.r * c.r && p.y > c.y0 && p.y < c.y1) return true;
    }
    return false;
  }
}

/** Ray-sphere intersection: returns t or -1 */
export function raySphere(o: THREE.Vector3, d: THREE.Vector3, c: THREE.Vector3, r: number): number {
  const lx = c.x - o.x;
  const ly = c.y - o.y;
  const lz = c.z - o.z;
  const tca = lx * d.x + ly * d.y + lz * d.z;
  if (tca < 0) return -1;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return -1;
  const thc = Math.sqrt(r * r - d2);
  const t0 = tca - thc;
  return t0 > 0 ? t0 : tca + thc;
}
