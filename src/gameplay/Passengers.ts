import {
  Color,
  CylinderGeometry,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { config, type Triage } from '../config';
import { heightAt } from '../world/heightfield';
import { triageSeconds } from './GoldenHour';
import type { MissionDef } from './types';

export type SoulState = 'waiting' | 'boarding' | 'aboard' | 'saved' | 'lost';

export interface Soul {
  id: number;
  triage: Triage;
  civilian: boolean;
  state: SoulState;
  timer: number;
  maxTimer: number;
  x: number;
  z: number;
  y: number;
  board: number;
  expired: boolean;
}

export interface PassengerTick {
  boarded: boolean;
  unloaded: 'saved' | 'lost' | null;
  expired: boolean;
}

const CIV = ['#6b5344', '#8a7a55', '#3d4a62', '#6a3030', '#2f4038'].map((h) => new Color(h));
const SOLDIER = new Color('#4e5536');
const LOST = new Color('#6a6a66');
const _obj = new Object3D();
const _color = new Color();

export class Passengers {
  souls: Soul[] = [];
  readonly mesh: InstancedMesh;
  readonly capacity = config.passengers.capacity;
  mode: 'land' | 'hoist' = 'land';

  constructor() {
    const body = new CylinderGeometry(0.18, 0.22, 0.75, 5);
    body.translate(0, 0.72, 0);
    const head = new SphereGeometry(0.16, 6, 5);
    head.translate(0, 1.2, 0);
    const geo = mergeGeometries([body, head]);
    if (!geo) throw new Error('person');
    const mat = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.82 });
    this.mesh = new InstancedMesh(geo, mat, 8);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  load(def: MissionDef, origin: { x: number; z: number }): void {
    this.mode = def.mode;
    this.souls = def.passengers.map((p, i) => {
      const ang = (i / def.passengers.length) * Math.PI * 2 + 0.4;
      const rad = def.mode === 'hoist' ? 1.6 : 6.5 + (i % 3) * 1.4;
      const x = origin.x + Math.cos(ang) * rad;
      const z = origin.z + Math.sin(ang) * rad;
      const max = triageSeconds(p.triage, p.seconds);
      return {
        id: i,
        triage: p.triage,
        civilian: p.civilian,
        state: 'waiting' as const,
        timer: max,
        maxTimer: max,
        x,
        z,
        y: heightAt(x, z),
        board: 0,
        expired: false,
      };
    });
    this.syncMeshes();
  }

  clear(): void {
    this.souls = [];
    this.mesh.count = 0;
  }

  get aboard(): number {
    return this.souls.filter((s) => s.state === 'aboard').length;
  }
  get saved(): number {
    return this.souls.filter((s) => s.state === 'saved').length;
  }
  get lost(): number {
    return this.souls.filter((s) => s.state === 'lost').length;
  }
  get waiting(): number {
    return this.souls.filter((s) => s.state === 'waiting' || s.state === 'boarding').length;
  }

  update(
    dt: number,
    ctx: {
      door: Vector3;
      doors: number;
      settled: number;
      onHospital: boolean;
      onLz: boolean;
      hoistComplete: boolean;
    },
  ): PassengerTick {
    const tick: PassengerTick = { boarded: false, unloaded: null, expired: false };
    for (const s of this.souls) {
      if (s.state === 'saved' || s.state === 'lost') continue;
      if (s.state === 'waiting' || s.state === 'boarding' || s.state === 'aboard') {
        s.timer -= dt;
        if (s.timer <= 0 && !s.expired) {
          s.timer = 0;
          s.expired = true;
          tick.expired = true;
          if (s.state !== 'aboard') s.state = 'lost';
        }
      }
    }

    if (ctx.onHospital && ctx.doors > 0.75 && ctx.settled > 0.55) {
      const p = this.souls.find((s) => s.state === 'aboard');
      if (p) {
        p.board += dt;
        if (p.board >= config.passengers.unloadSeconds) {
          p.state = p.expired ? 'lost' : 'saved';
          tick.unloaded = p.state === 'saved' ? 'saved' : 'lost';
          p.board = 0;
        }
      }
    }

    const room = this.aboard < this.capacity;
    if (this.mode === 'hoist' && ctx.hoistComplete && room) {
      const next = this.souls.find((s) => s.state === 'waiting');
      if (next) {
        next.state = 'aboard';
        next.board = 0;
        tick.boarded = true;
      }
    }

    if (this.mode === 'land' && ctx.onLz && ctx.doors > 0.75 && ctx.settled > 0.65 && room) {
      let walker = this.souls.find((s) => s.state === 'boarding');
      if (!walker) {
        walker = nearestWaiting(this.souls, ctx.door);
        if (walker) walker.state = 'boarding';
      }
      if (walker && walker.state === 'boarding') {
        const dx = ctx.door.x - walker.x;
        const dz = ctx.door.z - walker.z;
        const dist = Math.hypot(dx, dz) || 0.0001;
        const step = Math.min(dist, config.passengers.walkSpeed * dt);
        walker.x += (dx / dist) * step;
        walker.z += (dz / dist) * step;
        walker.y = heightAt(walker.x, walker.z);
        if (dist < 1.4) {
          walker.board += dt;
          if (walker.board > 0.28) {
            walker.state = 'aboard';
            walker.board = 0;
            tick.boarded = true;
          }
        }
      }
    } else {
      for (const s of this.souls) {
        if (s.state !== 'boarding') continue;
        if (Math.hypot(s.x - ctx.door.x, s.z - ctx.door.z) > 16) {
          s.state = 'waiting';
          s.board = 0;
        }
      }
    }

    this.syncMeshes();
    return tick;
  }

  private syncMeshes(): void {
    let n = 0;
    for (const s of this.souls) {
      if (s.state === 'aboard' || s.state === 'saved') continue;
      _obj.position.set(s.x, s.y, s.z);
      _obj.rotation.set(0, s.id, 0);
      _obj.scale.setScalar(s.state === 'lost' ? 0.8 : 1);
      if (s.triage !== 'routine' && s.state === 'waiting') {
        _obj.rotation.x = -Math.PI / 2;
        _obj.position.y = s.y + 0.35;
      }
      _obj.updateMatrix();
      this.mesh.setMatrixAt(n, _obj.matrix);
      if (s.state === 'lost') _color.copy(LOST);
      else if (s.civilian) _color.copy(CIV[s.id % CIV.length]!);
      else _color.copy(SOLDIER);
      this.mesh.setColorAt(n, _color);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

function nearestWaiting(souls: Soul[], door: Vector3): Soul | undefined {
  let best: Soul | undefined;
  let bestD = Infinity;
  for (const s of souls) {
    if (s.state !== 'waiting') continue;
    const d = Math.hypot(s.x - door.x, s.z - door.z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
