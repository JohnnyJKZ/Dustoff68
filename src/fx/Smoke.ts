import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
} from 'three';

const VERT = /* glsl */ `
attribute float aAge;
varying float vAge;
uniform float uSize;
void main() {
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * (1.0 + aAge * 2.2) * (40.0 / max(-mv.z, 1.0));
  vAge = aAge;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying float vAge;
uniform vec3 uColor;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.05, d) * (1.0 - vAge) * 0.55;
  gl_FragColor = vec4(uColor, a);
}
`;

export class Smoke {
  readonly points: Points;
  private readonly ages: Float32Array;
  private readonly seeds: Float32Array;
  private active = false;
  private readonly color = new Color('#39c45a');
  baseY = 0;

  constructor() {
    const n = 70;
    const pos = new Float32Array(n * 3);
    this.ages = new Float32Array(n);
    this.seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.ages[i] = Math.random();
      this.seeds[i] = Math.random() * 10;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aAge', new Float32BufferAttribute(this.ages, 1));
    const mat = new ShaderMaterial({
      uniforms: { uColor: { value: this.color }, uSize: { value: 18 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 4;
  }

  set(x: number, z: number, mode: 'green' | 'red' | 'off', groundY: number): void {
    this.active = mode !== 'off';
    this.points.visible = this.active;
    this.points.position.set(x, 0, z);
    this.baseY = groundY;
    this.color.set(mode === 'red' ? '#e23a2a' : '#3ec25a');
  }

  update(dt: number, windX: number, windZ: number): void {
    if (!this.active) return;
    const pos = this.points.geometry.getAttribute('position');
    const age = this.points.geometry.getAttribute('aAge');
    const p = pos.array as Float32Array;
    const a = age.array as Float32Array;
    for (let i = 0; i < this.ages.length; i++) {
      a[i] += dt * 0.13;
      if (a[i] > 1) a[i] = 0;
      const t = a[i]!;
      const sway = Math.sin(this.seeds[i]! + t * 6) * t * 2.2;
      p[i * 3] = sway + windX * t * 0.35;
      p[i * 3 + 1] = this.baseY + t * 28;
      p[i * 3 + 2] = Math.cos(this.seeds[i]! + t * 5) * t * 2.2 + windZ * t * 0.35;
    }
    pos.needsUpdate = true;
    age.needsUpdate = true;
  }
}
