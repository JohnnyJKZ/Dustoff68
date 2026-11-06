import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
} from 'three';

interface Shot {
  life: number;
  max: number;
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

export class Tracers {
  readonly lines: LineSegments;
  private readonly shots: Shot[] = [];
  private readonly cap = 32;

  constructor() {
    const pos = new Float32Array(this.cap * 2 * 3);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setDrawRange(0, 0);
    this.lines = new LineSegments(
      geo,
      new LineBasicMaterial({ color: new Color('#ffb15a'), transparent: true, opacity: 0.85 }),
    );
    this.lines.frustumCulled = false;
    for (let i = 0; i < this.cap; i++) {
      this.shots.push({ life: 0, max: 0.25, x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 });
    }
  }

  shot(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, flak = false): void {
    const s = this.shots.find((q) => q.life <= 0) ?? this.shots[0]!;
    s.life = flak ? 0.45 : 0.22;
    s.max = s.life;
    s.x0 = x0;
    s.y0 = y0;
    s.z0 = z0;
    s.x1 = x1;
    s.y1 = y1;
    s.z1 = z1;
  }

  update(dt: number): void {
    const attr = this.lines.geometry.getAttribute('position');
    const arr = attr.array as Float32Array;
    let n = 0;
    for (const s of this.shots) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const t = 1 - s.life / s.max;
      const ax = s.x0 + (s.x1 - s.x0) * Math.max(0, t - 0.15);
      const ay = s.y0 + (s.y1 - s.y0) * Math.max(0, t - 0.15);
      const az = s.z0 + (s.z1 - s.z0) * Math.max(0, t - 0.15);
      const bx = s.x0 + (s.x1 - s.x0) * Math.min(1, t + 0.05);
      const by = s.y0 + (s.y1 - s.y0) * Math.min(1, t + 0.05);
      const bz = s.z0 + (s.z1 - s.z0) * Math.min(1, t + 0.05);
      const o = n * 6;
      arr[o] = ax;
      arr[o + 1] = ay;
      arr[o + 2] = az;
      arr[o + 3] = bx;
      arr[o + 4] = by;
      arr[o + 5] = bz;
      n++;
    }
    attr.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, n * 2);
    this.lines.visible = n > 0;
  }
}
