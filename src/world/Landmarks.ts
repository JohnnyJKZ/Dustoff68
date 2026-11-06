import {
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
} from 'three';
import { allPads, type Pad } from './layout';
import { heightAt } from './heightfield';

const olive = new MeshStandardMaterial({ color: '#4a5340', roughness: 0.86, metalness: 0.04 });
const canvasMat = new MeshStandardMaterial({ color: '#cbb892', roughness: 0.9 });
const dark = new MeshStandardMaterial({ color: '#2c2418', roughness: 0.8 });
const red = new MeshStandardMaterial({
  color: '#b42318',
  roughness: 0.5,
  emissive: '#3a0a06',
  emissiveIntensity: 0.2,
});
const white = new MeshStandardMaterial({ color: '#e6e0d4', roughness: 0.7 });

export class Landmarks {
  readonly group = new Group();

  constructor() {
    for (const pad of allPads()) {
      if (pad.kind === 'base') this.base(pad);
      else if (pad.kind === 'hospital') this.hospital(pad);
      else if (pad.kind === 'village' || pad.id === 'lz4')
        this.village(pad, pad.id === 'lz4' ? 7 : 5);
      else this.clearing(pad);
    }
    this.group.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
  }

  private padDisc(pad: Pad, letter: string, radius: number): void {
    const y = heightAt(pad.x, pad.z) + 0.08;
    const ring = new Mesh(new RingGeometry(radius * 0.72, radius * 0.86, 40), white);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pad.x, y, pad.z);
    this.group.add(ring);
    const disc = new Mesh(
      CircleLike(radius * 0.7),
      new MeshStandardMaterial({ map: padTexture(letter), roughness: 0.95 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(pad.x, y + 0.02, pad.z);
    this.group.add(disc);
  }

  private base(pad: Pad): void {
    this.padDisc(pad, 'H', 16);
    const y = heightAt(pad.x, pad.z);
    this.tent(pad.x - 22, y, pad.z - 18, 10, 4.2, canvasMat);
    this.tent(pad.x - 24, y, pad.z + 10, 8, 3.4, olive);
    this.tent(pad.x + 18, y, pad.z - 16, 7, 3.2, olive);
    this.tower(pad.x + 26, y, pad.z + 16);
    this.drums(pad.x - 8, y, pad.z + 22);
    this.windsock(pad.x + 8, y, pad.z + 14);
    this.sandbags(pad.x, y, pad.z - 24);
  }

  private hospital(pad: Pad): void {
    this.padDisc(pad, '+', 18);
    const y = heightAt(pad.x, pad.z);
    this.tent(pad.x - 18, y, pad.z + 20, 16, 5, white);
    this.tent(pad.x + 16, y, pad.z + 18, 12, 4.4, canvasMat);
    this.tent(pad.x - 20, y, pad.z - 16, 9, 3.6, olive);
    const pole = new Mesh(new CylinderGeometry(0.12, 0.12, 8, 6), dark);
    pole.position.set(pad.x + 8, y + 4, pad.z - 8);
    this.group.add(pole);
    const flag = new Mesh(new PlaneGeometry(2.4, 1.4), red);
    flag.position.set(pad.x + 9.4, y + 7.2, pad.z - 8);
    this.group.add(flag);
    const cross = new Mesh(
      new PlaneGeometry(1.2, 1.2),
      new MeshStandardMaterial({ map: crossTex(), transparent: true }),
    );
    cross.position.set(pad.x - 18, y + 3.2, pad.z + 20 - 4.2);
    this.group.add(cross);
  }

  private village(pad: Pad, huts: number): void {
    const y = heightAt(pad.x, pad.z);
    for (let i = 0; i < huts; i++) {
      const ang = (i / huts) * Math.PI * 2;
      const r = 10 + (i % 3) * 4;
      this.hut(pad.x + Math.cos(ang) * r, y, pad.z + Math.sin(ang) * r, 1.6 + (i % 2) * 0.6);
    }
  }

  private clearing(pad: Pad): void {
    const y = heightAt(pad.x, pad.z) + 0.05;
    const ring = new Mesh(new RingGeometry(pad.radius * 0.55, pad.radius * 0.68, 28), white);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(pad.x, y, pad.z);
    this.group.add(ring);
  }

  private tent(
    x: number,
    y: number,
    z: number,
    len: number,
    h: number,
    mat: MeshStandardMaterial,
  ): void {
    const body = new Mesh(new BoxGeometry(len, h * 0.55, len * 0.55), mat);
    body.position.set(x, y + h * 0.28, z);
    const roof = new Mesh(new ConeGeometry(len * 0.42, h * 0.55, 4), mat);
    roof.position.set(x, y + h * 0.7, z);
    roof.rotation.y = Math.PI / 4;
    this.group.add(body, roof);
  }

  private hut(x: number, y: number, z: number, s: number): void {
    const stilts = new Mesh(new CylinderGeometry(0.08, 0.08, 1.2, 4), dark);
    stilts.position.set(x, y + 0.6, z);
    const floor = new Mesh(
      new BoxGeometry(2.4 * s, 0.2, 2.2 * s),
      new MeshStandardMaterial({ color: '#6a5038', roughness: 0.9 }),
    );
    floor.position.set(x, y + 1.3, z);
    const roof = new Mesh(
      new ConeGeometry(1.8 * s, 1.5 * s, 6),
      new MeshStandardMaterial({ color: '#8a6840', roughness: 1 }),
    );
    roof.position.set(x, y + 2.2, z);
    this.group.add(stilts, floor, roof);
  }

  private tower(x: number, y: number, z: number): void {
    const pole = new Mesh(new CylinderGeometry(0.35, 0.5, 9, 6), olive);
    pole.position.set(x, y + 4.5, z);
    const top = new Mesh(new BoxGeometry(2.4, 1.4, 2.4), dark);
    top.position.set(x, y + 9.2, z);
    this.group.add(pole, top);
  }

  private drums(x: number, y: number, z: number): void {
    for (let i = 0; i < 4; i++) {
      const d = new Mesh(new CylinderGeometry(0.55, 0.55, 1.1, 8), i % 2 ? olive : dark);
      d.position.set(x + i * 1.3, y + 0.55, z);
      this.group.add(d);
    }
  }

  private sandbags(x: number, y: number, z: number): void {
    for (let i = 0; i < 6; i++) {
      const b = new Mesh(new BoxGeometry(1.1, 0.45, 0.6), canvasMat);
      b.position.set(x + (i - 2.5) * 1.05, y + 0.25, z);
      this.group.add(b);
    }
  }

  private windsock(x: number, y: number, z: number): void {
    const pole = new Mesh(new CylinderGeometry(0.06, 0.08, 5, 5), dark);
    pole.position.set(x, y + 2.5, z);
    const sock = new Mesh(
      new ConeGeometry(0.28, 1.6, 6),
      new MeshStandardMaterial({ color: '#d4552a', roughness: 0.6 }),
    );
    sock.rotation.z = Math.PI / 2;
    sock.position.set(x + 0.9, y + 4.8, z);
    this.group.add(pole, sock);
  }
}

function CircleLike(r: number) {
  return new PlaneGeometry(r * 2, r * 2);
}

function padTexture(letter: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5c5344';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#efe6d4';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(128, 128, 108, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#efe6d4';
  g.font = 'bold 120px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(letter, 128, 134);
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  tex.anisotropy = 4;
  return tex;
}

function crossTex(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 128, 128);
  g.fillStyle = '#c42018';
  g.fillRect(52, 16, 24, 96);
  g.fillRect(16, 52, 96, 24);
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
