import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  ShaderMaterial,
  Vector3,
} from 'three';
import { damp } from '../util/math';
import { shared } from '../render/uniforms';

const RAIN_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform vec3 uCam;
varying float vSeed;
void main() {
  vec3 p = position;
  float h = 70.0;
  p.y = mod(p.y - uTime * (28.0 + aSeed * 16.0) + uCam.y, h) + uCam.y - h * 0.5;
  p.x += uCam.x;
  p.z += uCam.z;
  p.x += sin(uTime * 0.4 + aSeed * 6.0) * 1.5;
  vec4 mv = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 18.0 * (1.0 / -mv.z);
  vSeed = aSeed;
}
`;

const RAIN_FRAG = /* glsl */ `
precision highp float;
varying float vSeed;
uniform float uAmount;
void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float streak = smoothstep(0.5, 0.0, abs(uv.x) * 8.0) * smoothstep(0.5, 0.05, abs(uv.y));
  if (streak < 0.05) discard;
  gl_FragColor = vec4(0.75, 0.8, 0.85, streak * uAmount * 0.45);
}
`;

export class Weather {
  readonly points: Points;
  readonly wind = new Vector3();
  mode: 'clear' | 'rain' = 'clear';
  flash = 0;
  private gust = new Vector3(2.2, 0, -1.4);
  private gustTarget = new Vector3(2.2, 0, -1.4);
  private gustTimer = 2;
  private bolt = 0;
  private readonly mat: ShaderMaterial;
  private amountTarget = 0;

  constructor() {
    const n = 2200;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
      seed[i] = Math.random();
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 1));
    this.mat = new ShaderMaterial({
      uniforms: {
        uTime: shared.uTime,
        uCam: shared.uCamPos,
        uAmount: { value: 0 },
      },
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
    this.points.renderOrder = 5;
  }

  setMode(mode: 'clear' | 'rain'): void {
    this.mode = mode;
    this.amountTarget = mode === 'rain' ? 1 : 0;
    this.points.visible = mode === 'rain';
  }

  /** Returns true on the frame a bolt strikes. */
  update(dt: number): boolean {
    let struck = false;
    if (this.mode === 'rain') {
      this.gustTimer -= dt;
      if (this.gustTimer <= 0) {
        this.gustTimer = 1.6 + Math.random() * 3.2;
        this.gustTarget.set(
          (Math.random() - 0.5) * 18,
          (Math.random() - 0.4) * 5,
          (Math.random() - 0.5) * 18,
        );
      }
      if (Math.random() < dt * 0.18) {
        this.flash = 1;
        this.bolt = 0.12;
        struck = true;
      }
    } else {
      this.gustTarget.set(2.4, 0, -0.8);
    }
    this.gust.lerp(this.gustTarget, 1 - Math.exp(-dt * 0.8));
    this.wind.copy(this.gust);
    this.flash = Math.max(0, this.flash - dt * 1.8);
    this.bolt = Math.max(0, this.bolt - dt);
    const cur = this.mat.uniforms.uAmount!.value as number;
    this.mat.uniforms.uAmount!.value = damp(cur, this.amountTarget, 2, dt);
    shared.uFlash.value = this.flash;
    if (this.mode === 'rain') {
      shared.uWet.value = damp(shared.uWet.value, 0.65, 1.5, dt);
      shared.uFogDensity.value = damp(shared.uFogDensity.value, 0.0017, 1.2, dt);
    } else {
      shared.uWet.value = damp(shared.uWet.value, 0, 1.2, dt);
    }
    return struck;
  }
}
