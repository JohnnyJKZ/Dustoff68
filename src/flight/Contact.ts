import { Vector3 } from 'three';
import { config } from '../config';
import { clamp } from '../util/math';
import { surfaceY } from '../world/heightfield';
import { sample } from '../world/heightfield';
import type { TreeHit } from '../world/Vegetation';
import type { FlightModel } from './FlightModel';

export interface ContactResult {
  impact: number;
  message: string;
}

const skids = config.flight.skids.map((p) => new Vector3(p[0], p[1], p[2]));
const world = new Vector3();
const normal = new Vector3();

export class Contact {
  private treeCooldown = 0;
  private waterCooldown = 0;
  private wasGrounded = false;

  reset(): void {
    this.treeCooldown = 0;
    this.waterCooldown = 0;
    this.wasGrounded = false;
  }

  resolve(
    flight: FlightModel,
    dt: number,
    trees: (x: number, z: number, r: number) => TreeHit[],
  ): ContactResult {
    this.treeCooldown = Math.max(0, this.treeCooldown - dt);
    this.waterCooldown = Math.max(0, this.waterCooldown - dt);
    let message = '';
    let maxPen = -Infinity;
    let contacts = 0;
    normal.set(0, 0, 0);
    let water = false;

    for (const local of skids) {
      world.copy(local).applyQuaternion(flight.quat).add(flight.pos);
      const surf = surfaceY(world.x, world.z);
      const pen = surf.y - world.y;
      if (pen > maxPen) maxPen = pen;
      if (pen > -0.12) {
        contacts++;
        const n = sample(world.x, world.z).normal;
        normal.add(n);
        if (surf.water) water = true;
      }
    }

    let impact = 0;
    if (maxPen > 0) {
      flight.pos.y += maxPen;
      if (flight.vel.y < 0) {
        impact = -flight.vel.y;
        const slide = Math.hypot(flight.vel.x, flight.vel.z);
        flight.vel.y = 0;
        if (!this.wasGrounded && impact > 0.7) {
          if (impact > config.damage.hardLandingVy) {
            const d = (impact - config.damage.hardLandingVy) ** 2 * config.damage.hardK;
            flight.addDamage(d, 'landing');
            message = impact > 6 ? 'HARD LANDING' : 'WATCH THE SINK';
          }
          if (slide > config.damage.slideSpeed) {
            flight.addDamage((slide - config.damage.slideSpeed) * config.damage.slideK, 'slide');
            message = 'SLIDE';
          }
        }
      }
      if (normal.lengthSq() > 0) normal.normalize();
      else normal.set(0, 1, 0);
      flight.slope = Math.acos(clamp(normal.y, -1, 1));
      flight.grounded = contacts > 0;
      if (water) {
        flight.stableGround = false;
        flight.vel.x *= Math.exp(-dt * 3);
        flight.vel.z *= Math.exp(-dt * 3);
        if (this.waterCooldown <= 0) {
          flight.addDamage(config.damage.waterHit, 'water');
          this.waterCooldown = 1.2;
          message = 'OVER WATER';
        }
      } else if (flight.slope > config.damage.maxSlope) {
        flight.stableGround = false;
        const slideDir = new Vector3(normal.x, 0, normal.z);
        if (slideDir.lengthSq() > 1e-4) {
          slideDir.normalize();
          flight.vel.addScaledVector(slideDir, 10 * dt);
        }
        flight.addDamage(config.damage.slopeDps * dt, 'slope');
        message = 'SLOPE';
      } else {
        flight.stableGround = true;
        const damp = flight.collective < 0.5 ? 5.5 : 1.4;
        const f = Math.exp(-dt * damp);
        flight.vel.x *= f;
        flight.vel.z *= f;
      }
    } else {
      flight.grounded = false;
      flight.stableGround = false;
      flight.slope = 0;
    }

    const speed = flight.vel.length();
    if (
      flight.grounded &&
      flight.stableGround &&
      speed < config.flight.settleSpeed &&
      Math.abs(flight.vel.y) < 0.6
    ) {
      flight.settled += dt;
    } else {
      flight.settled = 0;
    }

    const hits = trees(flight.pos.x, flight.pos.z, 12);
    const rotorY = flight.pos.y + config.flight.rotorHeight;
    for (const tree of hits) {
      const dx = flight.pos.x - tree.x;
      const dz = flight.pos.z - tree.z;
      const dist = Math.hypot(dx, dz) || 0.0001;
      if (dist < tree.trunk && flight.pos.y < tree.top && rotorY > tree.ground) {
        const push = tree.trunk - dist + 0.3;
        flight.pos.x += (dx / dist) * push;
        flight.pos.z += (dz / dist) * push;
        flight.vel.x += (dx / dist) * 3;
        flight.vel.z += (dz / dist) * 3;
        if (this.treeCooldown <= 0) {
          flight.addDamage(config.damage.trunkHit, 'tree');
          this.treeCooldown = config.damage.treeCooldown;
          message = 'TREE STRIKE';
        }
      } else if (dist < tree.canopy && rotorY < tree.top && rotorY > tree.top - 4.5) {
        flight.vel.x += (dx / dist) * 8;
        flight.vel.z += (dz / dist) * 8;
        flight.vel.y = Math.max(flight.vel.y, 1.5);
        if (this.treeCooldown <= 0) {
          flight.addDamage(config.damage.rotorStrike, 'rotor');
          this.treeCooldown = config.damage.treeCooldown;
          message = 'ROTOR STRIKE';
        }
      }
    }

    const ground = surfaceY(flight.pos.x, flight.pos.z);
    flight.agl = flight.pos.y - config.flight.skidDrop - (ground.water ? ground.y : ground.y);
    if (flight.agl < 0) flight.agl = 0;
    const justLanded = !this.wasGrounded && flight.grounded;
    this.wasGrounded = flight.grounded;
    return { impact: justLanded ? impact : 0, message };
  }
}
