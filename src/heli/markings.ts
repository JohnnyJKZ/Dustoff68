import { CanvasTexture, SRGBColorSpace } from 'three';

function tex(draw: (g: CanvasRenderingContext2D, s: number) => void, size = 256): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  draw(g, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

export function crossTexture(): CanvasTexture {
  return tex((g, s) => {
    g.clearRect(0, 0, s, s);
    g.fillStyle = '#c41616';
    const t = s * 0.22;
    g.fillRect((s - t) / 2, s * 0.08, t, s * 0.84);
    g.fillRect(s * 0.08, (s - t) / 2, s * 0.84, t);
  });
}

export function armyTextTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 512, 64);
  g.fillStyle = '#1a1c16';
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = '#d7d2c4';
  g.font = '600 28px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('UNITED STATES ARMY', 256, 34);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function rotorBlurTexture(): CanvasTexture {
  return tex((g, s) => {
    const ctx = g;
    ctx.clearRect(0, 0, s, s);
    const grd = ctx.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s * 0.5);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(0.55, 'rgba(20,22,16,0.05)');
    grd.addColorStop(0.78, 'rgba(20,22,16,0.45)');
    grd.addColorStop(0.9, 'rgba(20,22,16,0.2)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }, 512);
}
