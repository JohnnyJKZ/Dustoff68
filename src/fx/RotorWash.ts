import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
} from 'three';

const puffMap = (() => {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
})();

export class RotorWash {
  readonly dust: Points;
  readonly spray: Points;
  private readonly dustLife: Float32Array;
  private readonly sprayLife: Float32Array;

  constructor() {
    this.dustLife = new Float32Array(80);
    this.sprayLife = new Float32Array(60);
    this.dust = this.make(this.dustLife, '#c4a574', 0.7);
    this.spray = this.make(this.sprayLife, '#d5e4ea', 0.55);
  }

  private make(life: Float32Array, color: string, size: number): Points {
    const pos = new Float32Array(life.length * 3);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    const pts = new Points(
      geo,
      new PointsMaterial({
        color,
        size,
        map: puffMap,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    pts.frustumCulled = false;
    return pts;
  }

  update(
    dt: number,
    x: number,
    y: number,
    z: number,
    agl: number,
    strength: number,
    overWater: boolean,
  ): void {
    this.puff(this.dust, this.dustLife, dt, x, y, z, agl, overWater ? 0 : strength, 0.45);
    this.puff(this.spray, this.sprayLife, dt, x, y, z, agl, overWater ? strength : 0, 0.35);
  }

  private puff(
    points: Points,
    life: Float32Array,
    dt: number,
    x: number,
    y: number,
    z: number,
    agl: number,
    strength: number,
    alpha: number,
  ): void {
    const mat = points.material as PointsMaterial;
    mat.opacity = strength * alpha;
    const attr = points.geometry.getAttribute('position');
    const arr = attr.array as Float32Array;
    const ground = y - agl;
    for (let i = 0; i < life.length; i++) {
      life[i] -= dt;
      if (life[i]! <= 0 || strength < 0.15) {
        const ang = Math.random() * Math.PI * 2;
        const rad = 2 + Math.random() * 6;
        arr[i * 3] = x + Math.cos(ang) * rad;
        arr[i * 3 + 1] = ground + 0.2;
        arr[i * 3 + 2] = z + Math.sin(ang) * rad;
        life[i] = 0.4 + Math.random() * 0.6;
      } else {
        const dx = arr[i * 3]! - x;
        const dz = arr[i * 3 + 2]! - z;
        const len = Math.hypot(dx, dz) || 1;
        arr[i * 3]! += (dx / len) * dt * 10 * strength;
        arr[i * 3 + 2]! += (dz / len) * dt * 10 * strength;
        arr[i * 3 + 1]! += dt * (1.5 + strength * 3);
      }
    }
    attr.needsUpdate = true;
  }
}
