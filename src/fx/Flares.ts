import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  PointLight,
  Points,
  ShaderMaterial,
} from 'three';

const VERT = /* glsl */ `
attribute float aAge;
varying float vAge;
void main() {
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = (1.0 - aAge) * 28.0 * (30.0 / max(-mv.z, 1.0));
  vAge = aAge;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying float vAge;
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d) * (1.0 - vAge);
  gl_FragColor = vec4(uColor, a);
}
`;

export class Flares {
  readonly group = new Group();
  active = false;
  private readonly ages: Float32Array;
  private readonly points: Points;
  private readonly lights: PointLight[] = [];
  private ground = 0;

  constructor() {
    const n = 24;
    this.ages = new Float32Array(n);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this.ages[i] = Math.random();
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aAge', new Float32BufferAttribute(this.ages, 1));
    const mat = new ShaderMaterial({
      uniforms: { uColor: { value: new Color('#ff7a3a') } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geo, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    for (let i = 0; i < 2; i++) {
      const l = new PointLight('#ff6a30', 0, 46, 2);
      this.lights.push(l);
      this.group.add(l);
    }
    this.group.visible = false;
  }

  set(x: number, z: number, ground: number, on: boolean): void {
    this.active = on;
    this.group.visible = on;
    this.group.position.set(x, 0, z);
    this.ground = ground;
  }

  update(dt: number): void {
    if (!this.active) return;
    const pos = this.points.geometry.getAttribute('position');
    const age = this.points.geometry.getAttribute('aAge');
    const p = pos.array as Float32Array;
    const a = age.array as Float32Array;
    for (let i = 0; i < this.ages.length; i++) {
      a[i] += dt * 0.18;
      if (a[i]! > 1) a[i] = 0;
      const t = a[i]!;
      const ang = i * 1.7;
      p[i * 3] = Math.cos(ang) * (2 + t * 6);
      p[i * 3 + 1] = this.ground + 28 - t * 26;
      p[i * 3 + 2] = Math.sin(ang) * (2 + t * 6);
    }
    pos.needsUpdate = true;
    age.needsUpdate = true;
    this.lights[0]!.position.set(0, this.ground + 8, 0);
    this.lights[1]!.position.set(3, this.ground + 14, -2);
    const pulse = 30 + Math.sin(performance.now() * 0.008) * 18;
    this.lights[0]!.intensity = pulse;
    this.lights[1]!.intensity = pulse * 0.6;
  }
}
