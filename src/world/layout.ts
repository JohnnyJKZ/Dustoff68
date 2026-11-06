export interface Pad {
  id: string;
  x: number;
  z: number;
  radius: number;
  y: number;
  kind: 'base' | 'hospital' | 'lz' | 'village';
}

export interface PointXZ {
  x: number;
  z: number;
}

export const layout = {
  river: [
    { x: -180, z: 1980 },
    { x: 220, z: 1400 },
    { x: -60, z: 860 },
    { x: 280, z: 280 },
    { x: -20, z: -360 },
    { x: 340, z: -980 },
    { x: 60, z: -1620 },
    { x: 180, z: -2050 },
  ] as PointXZ[],
  pads: {
    base: { id: 'base', x: -1040, z: 460, radius: 82, y: 0, kind: 'base' },
    hospital: { id: 'hospital', x: -1320, z: -280, radius: 70, y: 0, kind: 'hospital' },
    lz1: { id: 'lz1', x: 700, z: 140, radius: 40, y: 0, kind: 'lz' },
    lz3: { id: 'lz3', x: 980, z: 720, radius: 36, y: 0, kind: 'lz' },
    lz4: { id: 'lz4', x: 460, z: 1040, radius: 48, y: 0, kind: 'village' },
    villeB: { id: 'villeB', x: -220, z: -860, radius: 42, y: 0, kind: 'village' },
  } satisfies Record<string, Pad>,
  hoist: { x: 180, z: -540 },
  aa: [{ x: -40, z: 1180 }],
  fireM3: { x: 760, z: 700, radius: 150 },
  fireM4: { x: 300, z: 980, radius: 90 },
};

export function allPads(): Pad[] {
  return Object.values(layout.pads);
}

export type PadId = 'base' | 'hospital' | 'lz' | null;

export function classifyPad(x: number, z: number, lzKey: keyof typeof layout.pads | null): PadId {
  const b = layout.pads.base;
  if (Math.hypot(x - b.x, z - b.z) < b.radius * 0.82) return 'base';
  const h = layout.pads.hospital;
  if (Math.hypot(x - h.x, z - h.z) < h.radius * 0.82) return 'hospital';
  if (lzKey && lzKey !== 'base' && lzKey !== 'hospital') {
    const lz = layout.pads[lzKey];
    if (Math.hypot(x - lz.x, z - lz.z) < lz.radius + 6) return 'lz';
  }
  return null;
}
