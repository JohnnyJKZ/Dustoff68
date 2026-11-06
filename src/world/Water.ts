import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  LinearFilter,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Plane,
  RGBAFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
  type Texture,
} from 'three';
import { riverAt, sample } from './heightfield';
import { shared } from '../render/uniforms';

const VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vCol;
varying float vDeep;
uniform float uTime;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vCol = color;
  vDeep = color.r;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vCol;
varying float vDeep;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uCamPos;
uniform vec3 uHeliPos;
uniform float uWash;
uniform vec3 uFogColor;
uniform samplerCube uEnv;
uniform sampler2D uRefl;
uniform float uHasRefl;
uniform mat4 uReflMatrix;
uniform float uNight;

void main() {
  vec2 p = vWorld.xz;
  float rip = sin(p.x * 0.35 + uTime * 1.4) * sin(p.y * 0.28 - uTime * 1.1);
  rip += sin(p.x * 0.9 - uTime * 0.7) * 0.35;
  float d = distance(p, uHeliPos.xz);
  float ring = sin(d * 1.3 - uTime * 7.0) * exp(-d * 0.09) * uWash;
  vec3 n = normalize(vec3(-(rip + ring) * 0.18, 1.0, (rip * 0.6 + ring) * 0.18));
  vec3 view = normalize(uCamPos - vWorld);
  float fres = pow(1.0 - max(dot(view, n), 0.0), 3.0);
  vec3 sky = textureCube(uEnv, reflect(-view, n)).rgb;
  vec3 waterCol = mix(vec3(0.55, 0.62, 0.32), vec3(0.15, 0.28, 0.22), vDeep);
  waterCol = mix(waterCol, uSunColor, 0.18 * (1.0 - uNight));
  vec2 ruv = vec2(0.0);
  vec3 planar = sky;
  if (uHasRefl > 0.5) {
    vec4 proj = uReflMatrix * vec4(vWorld, 1.0);
    ruv = proj.xy / proj.w * 0.5 + 0.5;
    ruv += n.xz * 0.04;
    if (ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0) {
      planar = texture2D(uRefl, ruv).rgb;
    }
  }
  vec3 refl = mix(sky, planar, uHasRefl);
  vec3 col = mix(waterCol, refl, fres * 0.75 + 0.08);
  float glint = pow(max(dot(reflect(-view, n), normalize(uSunDir)), 0.0), 90.0);
  col += uSunColor * glint * (1.0 - uNight);
  float fogD = distance(vWorld, uCamPos);
  float fog = 1.0 - exp(-fogD * 0.0009);
  col = mix(col, uFogColor, clamp(fog, 0.0, 0.85));
  float alpha = mix(0.78, 0.9, vDeep);
  gl_FragColor = vec4(col, alpha);
}
`;

export class Water {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private reflTarget: WebGLRenderTarget | null = null;
  private readonly reflCam = new PerspectiveCamera();
  private readonly reflMatrix = new Matrix4();
  private frame = 0;
  enabledReflection = true;
  constructor(envTexture: Texture) {
    const geo = buildWater();
    this.mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: shared.uTime,
        uSunDir: shared.uSunDir,
        uSunColor: shared.uSunColor,
        uCamPos: shared.uCamPos,
        uHeliPos: shared.uHeliPos,
        uWash: shared.uWash,
        uFogColor: shared.uFogColor,
        uEnv: { value: envTexture },
        uRefl: { value: placeholderTex() },
        uHasRefl: { value: 0 },
        uReflMatrix: { value: this.reflMatrix },
        uNight: { value: 0 },
      },
    });
    this.mat.vertexColors = true;
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.name = 'water';
    this.mesh.renderOrder = 2;
  }

  setEnv(tex: Texture): void {
    this.mat.uniforms.uEnv!.value = tex;
  }

  setNight(n: number): void {
    this.mat.uniforms.uNight!.value = n;
  }

  setQuality(high: boolean): void {
    this.enabledReflection = high;
    if (!high) this.mat.uniforms.uHasRefl!.value = 0;
  }

  updateReflection(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    waterY: number,
  ): void {
    if (!this.enabledReflection) return;
    this.frame++;
    if (this.frame % 2 !== 0) return;
    if (!this.reflTarget) {
      this.reflTarget = new WebGLRenderTarget(512, 512, {
        type: UnsignedByteType,
        depthBuffer: true,
      });
      this.reflTarget.texture.minFilter = LinearFilter;
      this.reflTarget.texture.magFilter = LinearFilter;
      this.mat.uniforms.uRefl!.value = this.reflTarget.texture;
    }
    this.reflCam.copy(camera);
    const dy = this.reflCam.position.y - waterY;
    this.reflCam.position.y = waterY - dy;
    const e = camera.rotation.clone();
    this.reflCam.rotation.set(-e.x, e.y, -e.z, e.order);
    this.reflCam.up.set(0, -1, 0);
    this.reflCam.updateMatrixWorld();
    const prevTarget = renderer.getRenderTarget();
    const prevClip = renderer.clippingPlanes;
    const clip = new Plane(new Vector3(0, 1, 0), -waterY + 1.2);
    this.mesh.visible = false;
    renderer.clippingPlanes = [clip];
    renderer.setRenderTarget(this.reflTarget);
    renderer.clear();
    renderer.render(scene, this.reflCam);
    renderer.setRenderTarget(prevTarget);
    renderer.clippingPlanes = prevClip;
    this.mesh.visible = true;
    const tex = this.reflMatrix;
    tex.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tex.multiply(this.reflCam.projectionMatrix);
    tex.multiply(this.reflCam.matrixWorldInverse);
    this.mat.uniforms.uHasRefl!.value = 1;
  }
}

function placeholderTex(): DataTexture {
  const data = new Uint8Array([20, 40, 30, 255]);
  const t = new DataTexture(data, 1, 1, RGBAFormat);
  t.needsUpdate = true;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  return t;
}

function buildWater(): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const push = (x: number, y: number, z: number, deep: number) => {
    positions.push(x, y, z);
    colors.push(deep, 0.8, 0.3);
    return positions.length / 3 - 1;
  };

  const steps = 120;
  for (let i = 0; i < steps; i++) {
    const a = riverAt(i / steps);
    const b = riverAt((i + 1) / steps);
    const aw = a.width * 0.5;
    const bw = b.width * 0.5;
    const alx = -a.tz * aw;
    const alz = a.tx * aw;
    const blx = -b.tz * bw;
    const blz = b.tx * bw;
    const i0 = push(a.x + alx, a.surface, a.z + alz, 1);
    const i1 = push(a.x - alx, a.surface, a.z - alz, 1);
    const i2 = push(b.x + blx, b.surface, b.z + blz, 1);
    const i3 = push(b.x - blx, b.surface, b.z - blz, 1);
    indices.push(i0, i2, i1, i1, i2, i3);
  }

  for (let z = -1700; z <= 1700; z += 26) {
    for (let x = -200; x <= 1500; x += 26) {
      const s = sample(x, z);
      if (s.paddy < 0.55 || s.deep || s.pad > 0.12) continue;
      const y = s.height + 0.55;
      const h = 13;
      const a = push(x - h, y, z - h, 0.05);
      const b = push(x + h, y, z - h, 0.05);
      const c = push(x - h, y, z + h, 0.05);
      const d = push(x + h, y, z + h, 0.05);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
