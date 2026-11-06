import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  ShaderMaterial,
} from 'three';
import { riverAt, sample } from './heightfield';
import { shared } from '../render/uniforms';

const VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorld;
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uTime;
uniform vec3 uCamPos;
void main() {
  vec2 uv = vUv + vec2(uTime * 0.008, uTime * 0.003);
  float a = texture2D(uMap, uv).a;
  float fade = 1.0 - smoothstep(40.0, 520.0, distance(vWorld, uCamPos));
  float vertical = smoothstep(0.0, 8.0, vWorld.y) * (1.0 - smoothstep(40.0, 90.0, vWorld.y));
  gl_FragColor = vec4(uColor, a * fade * vertical * 0.28);
}
`;

export class Mist {
  readonly meshes: Mesh[] = [];
  private readonly mat: ShaderMaterial;

  constructor() {
    const tex = mistTexture();
    this.mat = new ShaderMaterial({
      uniforms: {
        uMap: { value: tex },
        uColor: { value: new Color('#f0d2b0') },
        uTime: shared.uTime,
        uCamPos: shared.uCamPos,
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    for (let i = 0; i < 18; i++) {
      const t = 0.08 + (i / 18) * 0.84;
      const p = riverAt(t);
      const s = sample(p.x + p.tz * 40, p.z - p.tx * 40);
      const geo = new BufferGeometry();
      const y = Math.min(s.height, p.surface) + 4 + (i % 4) * 3.5;
      const w = 90 + (i % 3) * 30;
      const positions = new Float32Array([-w, 0, -w, w, 0, -w, -w, 6, w, w, 6, w]);
      const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
      geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
      geo.setIndex([0, 2, 1, 1, 2, 3]);
      const mesh = new Mesh(geo, this.mat);
      mesh.position.set(p.x, y, p.z);
      mesh.renderOrder = 3;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
    }
  }

  setColor(hex: string): void {
    (this.mat.uniforms.uColor!.value as Color).set(hex);
  }
}

function mistTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 120);
  grd.addColorStop(0, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.globalAlpha = 0.35;
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.ellipse(40 + i * 28, 80 + (i % 3) * 40, 50, 18, i, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
