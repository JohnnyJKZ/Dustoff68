const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const grad2 = [
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const perm = new Uint8Array(512);
{
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = 68;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    const tmp = p[i]!;
    p[i] = p[j]!;
    p[j] = tmp;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]!;
}

/** 2D simplex noise, roughly -1..1. */
export function noise2(xin: number, yin: number): number {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = x0 > y0 ? 0 : 1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0;
  let n1 = 0;
  let n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    const g = grad2[perm[ii + perm[jj]!]! & 7]!;
    t0 *= t0;
    n0 = t0 * t0 * (g[0]! * x0 + g[1]! * y0);
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    const g = grad2[perm[ii + i1 + perm[jj + j1]!]! & 7]!;
    t1 *= t1;
    n1 = t1 * t1 * (g[0]! * x1 + g[1]! * y1);
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    const g = grad2[perm[ii + 1 + perm[jj + 1]!]! & 7]!;
    t2 *= t2;
    n2 = t2 * t2 * (g[0]! * x2 + g[1]! * y2);
  }
  return 70 * (n0 + n1 + n2);
}

export function fbm(x: number, z: number, octaves = 5): number {
  let a = 0;
  let amp = 1;
  let freq = 1;
  let sum = 0;
  for (let i = 0; i < octaves; i++) {
    a += amp * noise2(x * freq, z * freq);
    sum += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return a / sum;
}

export function ridged(x: number, z: number, octaves = 4): number {
  let a = 0;
  let amp = 1;
  let freq = 1;
  let sum = 0;
  for (let i = 0; i < octaves; i++) {
    let n = 1 - Math.abs(noise2(x * freq, z * freq));
    n *= n;
    a += n * amp;
    sum += amp;
    amp *= 0.5;
    freq *= 2.12;
  }
  return a / sum;
}
