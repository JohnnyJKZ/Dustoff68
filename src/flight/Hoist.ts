import { Vector3 } from 'three';
import { config } from '../config';
import { moveTowards } from '../util/math';

export class Hoist {
  deployed = 0;
  target = 0;
  progress = 0;
  readonly points: Vector3[];
  private readonly prev: Vector3[];

  constructor() {
    const n = config.hoist.segments + 1;
    this.points = Array.from({ length: n }, () => new Vector3());
    this.prev = Array.from({ length: n }, () => new Vector3());
  }

  toggle(): void {
    this.target = this.target > 0.5 ? 0 : 1;
  }

  retract(): void {
    this.target = 0;
    this.progress = 0;
  }

  reset(hook: Vector3): void {
    this.deployed = 0;
    this.target = 0;
    this.progress = 0;
    for (const p of this.points) p.copy(hook);
    for (const p of this.prev) p.copy(hook);
  }

  update(dt: number, hook: Vector3, gaining: boolean): void {
    const n = this.points.length;
    const length = Math.max(0.05, this.deployed * config.hoist.maxLength);
    const seg = length / (n - 1);
    this.points[0]!.copy(hook);
    for (let i = 1; i < n; i++) {
      const p = this.points[i]!;
      const q = this.prev[i]!;
      const vx = (p.x - q.x) * 0.985;
      const vy = (p.y - q.y) * 0.985;
      const vz = (p.z - q.z) * 0.985;
      q.copy(p);
      p.x += vx;
      p.y += vy - 22 * dt * dt;
      p.z += vz;
    }
    for (let iter = 0; iter < 8; iter++) {
      this.points[0]!.copy(hook);
      for (let i = 0; i < n - 1; i++) {
        const a = this.points[i]!;
        const b = this.points[i + 1]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dy, dz) || 1e-4;
        const diff = (dist - seg) / dist;
        const ox = dx * diff;
        const oy = dy * diff;
        const oz = dz * diff;
        if (i === 0) {
          b.x -= ox;
          b.y -= oy;
          b.z -= oz;
        } else {
          a.x += ox * 0.5;
          a.y += oy * 0.5;
          a.z += oz * 0.5;
          b.x -= ox * 0.5;
          b.y -= oy * 0.5;
          b.z -= oz * 0.5;
        }
      }
    }
    this.points[0]!.copy(hook);
    this.deployed = moveTowards(this.deployed, this.target, config.hoist.retractSpeed * dt);
    if (gaining && this.deployed > 0.72)
      this.progress = Math.min(1, this.progress + dt / config.hoist.seconds);
    else if (this.progress < 1) this.progress = Math.max(0, this.progress - dt * 0.4);
  }

  get tip(): Vector3 {
    return this.points[this.points.length - 1]!;
  }
}
