import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { shared } from '../render/uniforms';
import type { SkyPreset } from './TimeOfDay';

const VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vDir = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uBottom;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uCloud;
uniform float uStars;
uniform float uTime;
uniform float uFlash;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i); float b = hash(i+vec2(1.0,0.0));
  float c = hash(i+vec2(0.0,1.0)); float d = hash(i+vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0; float a = 0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p = p*2.02 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = dir.y;
  vec3 col = mix(uBottom, uHorizon, smoothstep(-0.08, 0.16, h));
  col = mix(col, uTop, smoothstep(0.05, 0.55, h));

  float sunD = dot(dir, normalize(uSunDir));
  float disc = smoothstep(0.9992, 0.9998, sunD);
  float halo = pow(max(sunD, 0.0), 28.0);
  float wide = pow(max(sunD, 0.0), 6.0);
  col += uSunColor * (disc * 2.4 + halo * 0.85 + wide * 0.28);

  float beams = pow(max(sunD, 0.0), 10.0);
  beams *= 0.45 + 0.55 * sin(atan(dir.x, dir.z) * 14.0);
  col += uSunColor * beams * 0.18 * (1.0 - smoothstep(0.0, 0.55, h));

  vec2 cuv = dir.xz / max(h + 0.35, 0.15);
  float c = fbm(cuv * 1.6 + vec2(uTime * 0.012, 0.0));
  float clouds = smoothstep(0.4, 0.7, c) * uCloud * smoothstep(-0.04, 0.06, h) * (1.0 - smoothstep(0.42, 0.75, h));
  vec3 cloudCol = mix(uSunColor, vec3(1.0, 0.92, 0.75), 0.45);
  cloudCol = mix(cloudCol * 0.35, cloudCol, smoothstep(0.0, 0.4, sunD));
  col = mix(col, cloudCol, clouds * 0.72);

  float starN = hash(floor((dir.xz / max(h, 0.2)) * 90.0));
  float stars = step(0.992, starN) * uStars * smoothstep(0.1, 0.4, h);
  col += vec3(stars);
  col += vec3(0.7, 0.8, 1.0) * uFlash * 0.45;
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly sunDir = new Vector3();

  constructor() {
    this.sunDir.copy(shared.uSunDir.value);
    this.mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new Color('#24344e') },
        uHorizon: { value: new Color('#ffb15a') },
        uBottom: { value: new Color('#6a3818') },
        uSunDir: { value: this.sunDir },
        uSunColor: { value: new Color('#ff9a3a') },
        uCloud: { value: 0.6 },
        uStars: { value: 0 },
        uTime: { value: 0 },
        uFlash: { value: 0 },
      },
    });
    this.mesh = new Mesh(new SphereGeometry(7000, 32, 20), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.mesh.name = 'sky';
  }

  apply(p: SkyPreset): void {
    const u = this.mat.uniforms;
    (u.uTop!.value as Color).set(p.skyTop);
    (u.uHorizon!.value as Color).set(p.skyHorizon);
    (u.uBottom!.value as Color).set(p.skyBottom);
    (u.uSunColor!.value as Color).set(p.sunColor);
    u.uCloud!.value = p.cloud;
    u.uStars!.value = p.stars;
  }

  update(dt: number, camX: number, camY: number, camZ: number, flash: number): void {
    this.mesh.position.set(camX, camY * 0.2, camZ);
    this.mat.uniforms.uTime!.value += dt;
    this.sunDir.copy(shared.uSunDir.value);
    this.mat.uniforms.uFlash!.value = flash;
  }
}
