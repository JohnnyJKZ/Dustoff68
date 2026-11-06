import { Vector3 } from 'three';
import { clamp, lerp, smoothstep } from '../util/math';
import { allPads, layout, type Pad } from './layout';
import { fbm, ridged } from './noise';

export interface Surface {
  height: number;
  slope: number;
  normal: Vector3;
  river: number;
  deep: boolean;
  waterY: number;
  paddy: number;
  pad: number;
  mud: number;
  jungle: number;
  valley: number;
}

interface RiverHit {
  dist: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  side: number;
  t: number;
  width: number;
}

const segs: { ax: number; az: number; bx: number; bz: number; len: number; t0: number }[] = [];
let riverLen = 0;

function buildRiver(): void {
  segs.length = 0;
  riverLen = 0;
  const pts = layout.river;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    segs.push({ ax: a.x, az: a.z, bx: b.x, bz: b.z, len, t0: riverLen });
    riverLen += len;
  }
}
buildRiver();

export function riverAt(t01: number): {
  x: number;
  z: number;
  tx: number;
  tz: number;
  width: number;
  bed: number;
  surface: number;
} {
  const d = clamp(t01, 0, 1) * riverLen;
  let seg = segs[segs.length - 1]!;
  for (const s of segs) {
    if (d <= s.t0 + s.len) {
      seg = s;
      break;
    }
  }
  const u = clamp((d - seg.t0) / (seg.len || 1), 0, 1);
  const t = (seg.t0 + u * seg.len) / riverLen;
  const tx = (seg.bx - seg.ax) / (seg.len || 1);
  const tz = (seg.bz - seg.az) / (seg.len || 1);
  const width = 18 + 14 * Math.sin(t * Math.PI) + 4 * Math.sin(t * 17);
  const bed = 6.5 + t * 2.4;
  return {
    x: lerp(seg.ax, seg.bx, u),
    z: lerp(seg.az, seg.bz, u),
    tx,
    tz,
    width,
    bed,
    surface: bed + 1.7,
  };
}

function closestRiver(x: number, z: number): RiverHit {
  let best = Infinity;
  let hit: RiverHit = { dist: 9999, x: 0, z: 0, tx: 1, tz: 0, side: 1, t: 0, width: 20 };
  for (const s of segs) {
    const dx = s.bx - s.ax;
    const dz = s.bz - s.az;
    const len2 = dx * dx + dz * dz || 1;
    let u = ((x - s.ax) * dx + (z - s.az) * dz) / len2;
    u = clamp(u, 0, 1);
    const px = s.ax + dx * u;
    const pz = s.az + dz * u;
    const dist = Math.hypot(x - px, z - pz);
    if (dist < best) {
      best = dist;
      const len = Math.sqrt(len2);
      const tx = dx / len;
      const tz = dz / len;
      const t = (s.t0 + u * s.len) / riverLen;
      const width = 18 + 14 * Math.sin(t * Math.PI) + 4 * Math.sin(t * 17);
      const side = tx * (z - pz) - tz * (x - px);
      hit = { dist, x: px, z: pz, tx, tz, side, t, width };
    }
  }
  return hit;
}

let padsReady = false;

function applyPads(x: number, z: number, h: number): { h: number; pad: number } {
  if (!padsReady) return { h, pad: 0 };
  let pad = 0;
  let out = h;
  for (const p of allPads()) {
    const d = Math.hypot(x - p.x, z - p.z);
    const m = smoothstep(p.radius, p.radius * 0.42, d);
    if (m > 0) {
      out = lerp(out, p.y, m);
      if (m > pad) pad = m;
    }
  }
  return { h: out, pad };
}

interface Raw {
  h: number;
  river: number;
  deep: boolean;
  waterY: number;
  paddy: number;
  mud: number;
  valley: number;
}

function terrainRaw(x: number, z: number): Raw {
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const border = smoothstep(1480, 2040, edge);
  const n = fbm(x * 0.00052, z * 0.00052, 5);
  const r = ridged(x * 0.00028, z * 0.00028, 4);
  const roll = fbm(x * 0.0017, z * 0.0017, 4) - 0.42;
  const detail = fbm(x * 0.0042, z * 0.0042, 3);
  let h = 14 + n * 22 + r * 34 + roll * 16 + detail * 2.6;

  const rv = closestRiver(x, z);
  const valley = 1 - smoothstep(24, 160, rv.dist);
  const bed = 6.5 + rv.t * 2.4;
  h = lerp(h, bed + 5 + rv.dist * 0.028, valley * 0.88);

  const half = rv.width * 0.5;
  const river = 1 - smoothstep(half * 0.3, half + 28, rv.dist);
  const riverBed = bed - 2.4;
  h = lerp(h, riverBed, smoothstep(0.15, 0.85, river));

  const mud = smoothstep(half + 55, half + 4, rv.dist) * (1 - smoothstep(0.7, 1, river));

  let paddy = 0;
  if (
    rv.side > 0 &&
    rv.dist > half + 6 &&
    rv.dist < 230 &&
    border < 0.15 &&
    rv.t > 0.1 &&
    rv.t < 0.9
  ) {
    const band = smoothstep(half + 4, half + 22, rv.dist) * (1 - smoothstep(150, 230, rv.dist));
    paddy = band * (1 - border);
    const step = 1.65;
    const baseH = bed + (rv.dist - half) * 0.025;
    const terr = Math.floor(lerp(h, baseH, 0.7) / step) * step;
    h = lerp(h, terr, paddy);
  }

  h += border * (150 + r * 80);
  h += border * border * 70;

  const deep = river > 0.62 && paddy < 0.2;
  return { h, river, deep, waterY: riverBed + 1.85, paddy, mud, valley };
}

export function initWorld(): void {
  padsReady = false;
  const pads = allPads();
  for (const p of pads) nudgePad(p);
  for (const p of pads) {
    const raw = terrainRaw(p.x, p.z);
    p.y = raw.h + (p.kind === 'lz' || p.kind === 'base' || p.kind === 'hospital' ? 0.85 : 0.45);
  }
  // Hoist site: keep it on land, off the river.
  if (terrainRaw(layout.hoist.x, layout.hoist.z).deep) {
    layout.hoist.x += 80;
  }
  padsReady = true;
}

function nudgePad(p: Pad): void {
  if (!terrainRaw(p.x, p.z).deep) return;
  for (let r = 20; r < 400; r += 20) {
    for (let a = 0; a < 8; a++) {
      const x = p.x + Math.cos((a / 8) * Math.PI * 2) * r;
      const z = p.z + Math.sin((a / 8) * Math.PI * 2) * r;
      if (!terrainRaw(x, z).deep) {
        p.x = x;
        p.z = z;
        return;
      }
    }
  }
}

export function heightAt(x: number, z: number): number {
  const raw = terrainRaw(x, z);
  return applyPads(x, z, raw.h).h;
}

export interface Cover {
  height: number;
  deep: boolean;
  paddy: number;
  pad: number;
  mud: number;
  valley: number;
  river: number;
  jungle: number;
}

/** Slope-free surface query for scattering. */
export function cover(x: number, z: number): Cover {
  const raw = terrainRaw(x, z);
  const padded = applyPads(x, z, raw.h);
  const jungle =
    clamp((1 - raw.valley) * 0.8, 0, 1) * (1 - padded.pad) * (raw.deep ? 0 : 1) * (1 - raw.paddy);
  return {
    height: padded.h,
    deep: raw.deep && padded.pad < 0.4,
    paddy: raw.paddy * (1 - padded.pad),
    pad: padded.pad,
    mud: raw.mud,
    valley: raw.valley,
    river: raw.river,
    jungle,
  };
}

const _normal = new Vector3();

export function sample(x: number, z: number): Surface {
  const raw = terrainRaw(x, z);
  const padded = applyPads(x, z, raw.h);
  const h = padded.h;
  const e = 2.5;
  const hx = applyPads(x + e, z, terrainRaw(x + e, z).h).h;
  const hz = applyPads(x, z + e, terrainRaw(x, z + e).h).h;
  _normal.set(h - hx, e, h - hz).normalize();
  const slope = Math.acos(clamp(_normal.y, -1, 1));
  const steep = 1 - _normal.y;
  let jungle =
    clamp((1 - raw.valley) * 0.75 + steep * 1.6, 0, 1) *
    (1 - padded.pad) *
    (1 - (raw.deep ? 1 : 0)) *
    (1 - raw.paddy * 0.92);
  if (raw.valley > 0.55 && steep < 0.18) jungle *= 0.35;
  return {
    height: h,
    slope,
    normal: _normal,
    river: raw.river,
    deep: raw.deep && padded.pad < 0.4,
    waterY: raw.waterY,
    paddy: raw.paddy * (1 - padded.pad),
    pad: padded.pad,
    mud: raw.mud * (1 - padded.pad),
    jungle,
    valley: raw.valley,
  };
}

export function normalAt(x: number, z: number): Vector3 {
  return sample(x, z).normal;
}

/** True when the straight line dips into terrain. */
export function losBlocked(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): boolean {
  const steps = 12;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = lerp(x0, x1, t);
    const y = lerp(y0, y1, t);
    const z = lerp(z0, z1, t);
    if (heightAt(x, z) + 1.5 > y) return true;
  }
  return false;
}

export function surfaceY(x: number, z: number): { y: number; water: boolean } {
  const s = sample(x, z);
  if (s.deep) return { y: Math.max(s.height, s.waterY), water: true };
  return { y: s.height, water: false };
}
