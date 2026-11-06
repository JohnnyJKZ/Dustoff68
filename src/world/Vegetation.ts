import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Sphere,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { config } from '../config';
import { styleMaterial } from '../render/styleMaterial';
import { mulberry32 } from '../util/seed';
import { cover } from './heightfield';

export interface TreeHit {
  x: number;
  z: number;
  trunk: number;
  canopy: number;
  top: number;
  ground: number;
}

interface TreeRec {
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
  kind: number;
}

const CELL = 48;
const _hits: TreeHit[] = [];

export class Vegetation {
  readonly meshes: InstancedMesh[] = [];
  density = 1;
  private trees: TreeRec[] = [];
  private readonly colliders: TreeHit[] = [];
  private readonly grid = new Map<number, number[]>();
  private readonly buckets: InstancedMesh[] = [];
  private grass: InstancedMesh | null = null;
  private rice: InstancedMesh | null = null;
  private grassRecs: TreeRec[] = [];
  private riceRecs: TreeRec[] = [];
  private grassCam = new Vector3(1e9, 0, 1e9);

  constructor(renderer: WebGLRenderer) {
    const broad = makeBroadleaf(1);
    const broadMid = makeBroadleaf(0);
    const palm = makePalm();
    const bamboo = makeBamboo();
    const broadImp = makeImpostor(renderer, broad);
    const palmImp = makeImpostor(renderer, palm);
    const grassGeo = makeGrass(new Color('#6a9a3e'), 1.3, 0.55);
    const riceGeo = makeGrass(new Color('#d2c15a'), 0.7, 0.35);

    const foliage = (geo: BufferGeometry, cap: number, mapMat?: MeshStandardMaterial) => {
      const mat =
        mapMat ??
        new MeshStandardMaterial({
          vertexColors: true,
          roughness: 0.86,
          metalness: 0,
          side: DoubleSide,
        });
      styleMaterial(mat, 'foliage');
      const mesh = new InstancedMesh(geo, mat, cap);
      mesh.instanceMatrix.setUsage(35048); // DynamicDrawUsage
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.count = 0;
      return mesh;
    };

    const impMat = (tex: WebGLRenderTarget['texture']) => {
      const m = new MeshStandardMaterial({
        map: tex,
        roughness: 1,
        metalness: 0,
        alphaTest: 0.35,
        side: DoubleSide,
        transparent: false,
      });
      return m;
    };

    this.buckets = [
      foliage(broad, 1800),
      foliage(broadMid, 3500),
      foliage(broadImp.geo, 5000, impMat(broadImp.tex)),
      foliage(palm, 800),
      foliage(palm, 1200),
      foliage(palmImp.geo, 2000, impMat(palmImp.tex)),
      foliage(bamboo, 1200),
      foliage(bamboo, 1600),
    ];
    this.grass = foliage(grassGeo, config.graphics.grassCap);
    this.rice = foliage(riceGeo, config.graphics.riceCap);
    this.meshes.push(...this.buckets, this.grass, this.rice);
    this.scatter();
  }

  setDensity(d: number): void {
    this.density = d;
  }

  query(x: number, z: number, radius: number): TreeHit[] {
    _hits.length = 0;
    const x0 = Math.floor((x - radius) / CELL);
    const x1 = Math.floor((x + radius) / CELL);
    const z0 = Math.floor((z - radius) / CELL);
    const z1 = Math.floor((z + radius) / CELL);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const list = this.grid.get(ix + iz * 4096);
        if (!list) continue;
        for (const idx of list) {
          const t = this.colliders[idx]!;
          if (Math.hypot(t.x - x, t.z - z) <= radius + t.canopy) _hits.push(t);
        }
      }
    }
    return _hits;
  }

  update(camX: number, camZ: number): void {
    const counts = new Array(this.buckets.length).fill(0) as number[];
    const arrays = this.buckets.map((m) => m.instanceMatrix.array as Float32Array);
    const keep = this.density;
    for (let i = 0; i < this.trees.length; i++) {
      if (keep < 0.99 && ((i * 17) % 100) / 100 > keep) continue;
      const t = this.trees[i]!;
      const dx = t.x - camX;
      const dz = t.z - camZ;
      const dist = Math.hypot(dx, dz);
      if (dist > config.graphics.treeRadius) continue;
      let bucket = -1;
      if (t.kind === 0) {
        bucket = dist < config.graphics.fullDist ? 0 : dist < config.graphics.midDist ? 1 : 2;
      } else if (t.kind === 1) {
        bucket = dist < config.graphics.fullDist ? 3 : dist < config.graphics.midDist ? 4 : 5;
      } else {
        if (dist > config.graphics.midDist) continue;
        bucket = dist < config.graphics.fullDist ? 6 : 7;
      }
      const slot = counts[bucket]!;
      const cap = this.buckets[bucket]!.instanceMatrix.count;
      if (slot >= cap) continue;
      writeMat(arrays[bucket]!, slot, t.x, t.y, t.z, t.rot, t.scale);
      counts[bucket] = slot + 1;
    }
    for (let b = 0; b < this.buckets.length; b++) {
      const mesh = this.buckets[b]!;
      mesh.count = counts[b]!;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.visible = mesh.count > 0;
    }

    if (Math.hypot(camX - this.grassCam.x, camZ - this.grassCam.z) > 28) {
      this.grassCam.set(camX, 0, camZ);
      this.fillNear(this.grass, this.grassRecs, camX, camZ, config.graphics.grassRadius);
      this.fillNear(this.rice, this.riceRecs, camX, camZ, 260);
    }
  }

  private fillNear(
    mesh: InstancedMesh | null,
    recs: TreeRec[],
    camX: number,
    camZ: number,
    radius: number,
  ): void {
    if (!mesh) return;
    const arr = mesh.instanceMatrix.array as Float32Array;
    let n = 0;
    const cap = mesh.instanceMatrix.count;
    for (let i = 0; i < recs.length && n < cap; i++) {
      const t = recs[i]!;
      if (Math.hypot(t.x - camX, t.z - camZ) > radius) continue;
      writeMat(arr, n, t.x, t.y, t.z, t.rot, t.scale);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = n > 0;
  }

  private scatter(): void {
    const rand = mulberry32(1968);
    const extent = 1880;
    const step = 22;
    const picked: TreeRec[] = [];
    for (let z = -extent; z <= extent; z += step) {
      for (let x = -extent; x <= extent; x += step) {
        const jx = x + (rand() - 0.5) * step;
        const jz = z + (rand() - 0.5) * step;
        const s = cover(jx, jz);
        if (s.deep || s.pad > 0.3 || s.paddy > 0.5) continue;
        const nearBank = s.valley > 0.42 && s.mud > 0.25 && !s.deep;
        let kind = 0;
        let chance = 0;
        if (nearBank && rand() < 0.65) {
          kind = 1;
          chance = 0.72;
        } else if (s.jungle > 0.28) {
          kind = rand() < 0.14 ? 2 : 0;
          chance = 0.34 + s.jungle * 0.28;
        } else if (s.valley > 0.35) {
          kind = rand() < 0.16 ? 2 : 0;
          chance = 0.16;
        }
        if (rand() > chance) continue;
        const scale = kind === 1 ? 0.85 + rand() * 0.55 : 0.7 + rand() * 0.75;
        picked.push({ x: jx, y: s.height, z: jz, rot: rand() * Math.PI * 2, scale, kind });
      }
    }
    const cap = config.graphics.treeCap;
    if (picked.length > cap) {
      const stride = picked.length / cap;
      for (let i = 0; i < cap; i++) this.trees.push(picked[Math.floor(i * stride)]!);
    } else {
      this.trees = picked;
    }
    for (const rec of this.trees) {
      if (rec.kind === 2) continue;
      const hit: TreeHit = {
        x: rec.x,
        z: rec.z,
        trunk: 0.55 * rec.scale,
        canopy: (rec.kind === 1 ? 2.4 : 3.4) * rec.scale,
        top: rec.y + (rec.kind === 1 ? 9.5 : 8.5) * rec.scale,
        ground: rec.y,
      };
      const idx = this.colliders.length;
      this.colliders.push(hit);
      const key = Math.floor(rec.x / CELL) + Math.floor(rec.z / CELL) * 4096;
      let list = this.grid.get(key);
      if (!list) {
        list = [];
        this.grid.set(key, list);
      }
      list.push(idx);
    }

    const gstep = 14;
    for (let z = -extent; z <= extent; z += gstep) {
      for (let x = -extent; x <= extent; x += gstep) {
        if (rand() > 0.62) continue;
        const jx = x + (rand() - 0.5) * gstep;
        const jz = z + (rand() - 0.5) * gstep;
        const s = cover(jx, jz);
        if (s.deep || s.pad > 0.25) continue;
        const rec: TreeRec = {
          x: jx,
          y: s.height,
          z: jz,
          rot: rand() * Math.PI,
          scale: 0.7 + rand() * 0.8,
          kind: 0,
        };
        if (s.paddy > 0.45) {
          if (this.riceRecs.length < 20000) this.riceRecs.push(rec);
        } else if (s.valley > 0.25) {
          if (this.grassRecs.length < 50000) this.grassRecs.push(rec);
        }
      }
    }
  }
}

function writeMat(
  arr: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  rot: number,
  s: number,
): void {
  const c = Math.cos(rot);
  const si = Math.sin(rot);
  const o = i * 16;
  arr[o] = c * s;
  arr[o + 1] = 0;
  arr[o + 2] = -si * s;
  arr[o + 3] = 0;
  arr[o + 4] = 0;
  arr[o + 5] = s;
  arr[o + 6] = 0;
  arr[o + 7] = 0;
  arr[o + 8] = si * s;
  arr[o + 9] = 0;
  arr[o + 10] = c * s;
  arr[o + 11] = 0;
  arr[o + 12] = x;
  arr[o + 13] = y;
  arr[o + 14] = z;
  arr[o + 15] = 1;
}

function mergeParts(parts: BufferGeometry[], label: string): BufferGeometry {
  const flat = parts.map((g) => {
    if (!g.index) return g;
    const flatGeo = g.toNonIndexed();
    g.dispose();
    return flatGeo;
  });
  const merged = mergeGeometries(flat);
  for (const g of flat) g.dispose();
  if (!merged) throw new Error(`${label} merge failed`);
  merged.computeVertexNormals();
  return merged;
}

function paint(geo: BufferGeometry, color: Color, jitter = 0): BufferGeometry {
  const pos = geo.getAttribute('position');
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const j = 1 + ((i * 13) % 7) * 0.01 * jitter;
    arr[i * 3] = color.r * j;
    arr[i * 3 + 1] = color.g * j;
    arr[i * 3 + 2] = color.b * j;
  }
  geo.setAttribute('color', new Float32BufferAttribute(arr, 3));
  return geo;
}

function makeBroadleaf(detail: number): BufferGeometry {
  const trunk = new CylinderGeometry(0.18, 0.42, 4.2, detail > 0 ? 6 : 4);
  trunk.translate(0, 2.1, 0);
  paint(trunk, new Color('#4a3424'));
  const crown = new IcosahedronGeometry(2.35, detail);
  crown.scale(1.25, 0.72, 1.25);
  crown.translate(0, 5.0, 0);
  paint(crown, new Color('#3e8f46'), 8);
  const crown2 = new IcosahedronGeometry(1.45, 0);
  crown2.translate(1.1, 6.1, 0.2);
  paint(crown2, new Color('#2f6e38'), 6);
  return mergeParts([trunk, crown, crown2], 'tree');
}

function makePalm(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const trunk = new CylinderGeometry(0.16, 0.28, 6.2, 5);
  trunk.translate(0, 3.1, 0);
  trunk.translate(0.4, 0, 0);
  paint(trunk, new Color('#6b5340'));
  parts.push(trunk);
  const leafCol = new Color('#2f7a38');
  for (let i = 0; i < 7; i++) {
    const leaf = new PlaneGeometry(0.7, 3.4, 1, 3);
    leaf.translate(0, 1.5, 0);
    const m = new Matrix4();
    m.makeRotationY((i / 7) * Math.PI * 2);
    const droop = new Matrix4().makeRotationX(0.7);
    leaf.applyMatrix4(droop);
    leaf.applyMatrix4(m);
    leaf.translate(0, 6.3, 0);
    paint(leaf, leafCol, 4);
    parts.push(leaf);
  }
  return mergeParts(parts, 'palm');
}

function makeBamboo(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const col = new Color('#7ea34a');
  for (let i = 0; i < 6; i++) {
    const culm = new CylinderGeometry(0.05, 0.07, 5.5, 4);
    const ang = (i / 6) * Math.PI * 2;
    culm.translate(Math.cos(ang) * 0.35, 2.7, Math.sin(ang) * 0.35);
    paint(culm, col, 5);
    parts.push(culm);
  }
  return mergeParts(parts, 'bamboo');
}

function makeGrass(color: Color, h: number, w: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const p = new PlaneGeometry(w, h, 1, 3);
    p.translate(0, h * 0.5, 0);
    p.rotateY((i / 3) * Math.PI);
    paint(p, color, 6);
    parts.push(p);
  }
  return mergeParts(parts, 'grass');
}

function makeImpostor(
  renderer: WebGLRenderer,
  source: BufferGeometry,
): { geo: BufferGeometry; tex: WebGLRenderTarget['texture'] } {
  const mat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const mesh = new Mesh(source, mat);
  const scene = new Scene();
  scene.add(mesh);
  const cam = new OrthographicCamera(-5, 5, 9, -0.4, 0.1, 40);
  cam.position.set(12, 4.5, 6);
  cam.lookAt(0, 4, 0);
  const rt = new WebGLRenderTarget(256, 256);
  const prev = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prev);
  renderer.setClearColor(prevColor, prevAlpha);
  mat.dispose();

  const a = new PlaneGeometry(8.5, 9);
  a.translate(0, 4.5, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const geo = mergeParts([a, b], 'impostor');
  geo.boundingSphere = new Sphere(new Vector3(0, 4, 0), 8);
  return { geo, tex: rt.texture };
}
