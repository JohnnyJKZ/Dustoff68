import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshStandardMaterial,
  Uint32BufferAttribute,
} from 'three';
import { config } from '../config';
import { styleMaterial } from '../render/styleMaterial';
import { clamp } from '../util/math';
import { sample, type Surface } from './heightfield';

const COL = {
  grass: new Color('#5eae46'),
  jungle: new Color('#1f6b34'),
  dirt: new Color('#8d4a2a'),
  mud: new Color('#6a5030'),
  pad: new Color('#8a6a40'),
  paddy: new Color('#7ea04a'),
  rock: new Color('#6d655c'),
  waterbed: new Color('#2e4630'),
};
const tmp = new Color();

function tint(s: Surface, out: Color): void {
  const steep = 1 - s.normal.y;
  out.copy(COL.grass);
  tmp.copy(COL.jungle);
  out.lerp(tmp, clamp(s.jungle * 0.55, 0, 1));
  tmp.copy(COL.dirt);
  out.lerp(tmp, clamp((steep - 0.42) / 0.28, 0, 1));
  tmp.copy(COL.rock);
  out.lerp(tmp, clamp((steep - 0.62) / 0.22, 0, 1));
  tmp.copy(COL.mud);
  out.lerp(tmp, clamp(s.mud, 0, 1) * 0.28);
  tmp.copy(COL.paddy);
  out.lerp(tmp, clamp(s.paddy, 0, 1));
  tmp.copy(COL.pad);
  out.lerp(tmp, clamp(s.pad, 0, 1));
  if (s.deep) out.lerp(COL.waterbed, 0.65);
}

interface Chunk {
  ox: number;
  oz: number;
  lod: number;
  built: (Mesh | null)[];
  active: Mesh | null;
}

export class Terrain {
  readonly group = new Group();
  readonly meshes: Mesh[] = [];
  private readonly chunks: Chunk[] = [];
  private readonly material: MeshStandardMaterial;
  private readonly size: number;

  constructor() {
    const count = config.world.chunkCount;
    this.size = config.world.mapSize / count;
    this.material = new MeshStandardMaterial({
      color: '#3f9a3c',
      vertexColors: true,
      roughness: 0.88,
      metalness: 0,
    });
    styleMaterial(this.material, 'terrain');
    const half = config.world.mapSize * 0.5;
    for (let cz = 0; cz < count; cz++) {
      for (let cx = 0; cx < count; cx++) {
        this.chunks.push({
          ox: -half + cx * this.size,
          oz: -half + cz * this.size,
          lod: -1,
          built: [null, null, null],
          active: null,
        });
      }
    }
  }

  /** Build the LOD each chunk needs around a point. Returns mesh list to add. */
  prewarm(x: number, z: number): Mesh[] {
    const out: Mesh[] = [];
    for (const chunk of this.chunks) {
      const cx = chunk.ox + this.size * 0.5;
      const cz = chunk.oz + this.size * 0.5;
      const lod = this.lodFor(Math.hypot(cx - x, cz - z));
      const mesh = this.ensure(chunk, lod);
      out.push(mesh);
    }
    this.meshes.splice(0, this.meshes.length, ...out);
    return this.meshes;
  }

  update(x: number, z: number): void {
    for (const chunk of this.chunks) {
      const cx = chunk.ox + this.size * 0.5;
      const cz = chunk.oz + this.size * 0.5;
      const lod = this.lodFor(Math.hypot(cx - x, cz - z));
      if (lod === chunk.lod) continue;
      if (chunk.active) chunk.active.visible = false;
      const mesh = this.ensure(chunk, lod);
      mesh.visible = true;
      if (!this.meshes.includes(mesh)) this.meshes.push(mesh);
    }
  }

  private lodFor(dist: number): number {
    if (dist < config.world.lodDistances[0]) return 0;
    if (dist < config.world.lodDistances[1]) return 1;
    return 2;
  }

  private ensure(chunk: Chunk, lod: number): Mesh {
    let mesh = chunk.built[lod];
    if (!mesh) {
      const seg = config.world.lodSegs[lod]!;
      const geo = buildChunk(chunk.ox, chunk.oz, this.size, seg);
      mesh = new Mesh(geo, this.material);
      mesh.position.set(chunk.ox, 0, chunk.oz);
      mesh.receiveShadow = true;
      mesh.castShadow = false;
      mesh.matrixAutoUpdate = true;
      this.group.add(mesh);
      chunk.built[lod] = mesh;
    }
    chunk.lod = lod;
    chunk.active = mesh;
    return mesh;
  }
}

function buildChunk(ox: number, oz: number, size: number, seg: number): BufferGeometry {
  const n = seg + 3;
  const lip = 8;
  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  const normals = new Float32Array(n * n * 3);
  const col = new Color();
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const skirt = ix === 0 || iz === 0 || ix === n - 1 || iz === n - 1;
      const gx = clamp(ix === 0 ? 0 : ix === n - 1 ? seg : ix - 1, 0, seg);
      const gz = clamp(iz === 0 ? 0 : iz === n - 1 ? seg : iz - 1, 0, seg);
      let lx = (gx / seg) * size;
      let lz = (gz / seg) * size;
      if (ix === 0) lx -= lip;
      else if (ix === n - 1) lx += lip;
      if (iz === 0) lz -= lip;
      else if (iz === n - 1) lz += lip;
      const s = sample(ox + (gx / seg) * size, oz + (gz / seg) * size);
      const y = s.height - (skirt ? 14 : 0);
      const i = iz * n + ix;
      positions[i * 3] = lx;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = lz;
      normals[i * 3] = s.normal.x;
      normals[i * 3 + 1] = s.normal.y;
      normals[i * 3 + 2] = s.normal.z;
      tint(s, col);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
  }
  const idx: number[] = [];
  for (let iz = 0; iz < n - 1; iz++) {
    for (let ix = 0; ix < n - 1; ix++) {
      const a = iz * n + ix;
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geo.setIndex(new Uint32BufferAttribute(idx, 1));
  return geo;
}
