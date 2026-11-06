import { config } from '../config';
import { smoothstep } from '../util/math';
import { heightAt, losBlocked } from '../world/heightfield';
import type { FlightModel } from '../flight/FlightModel';

export interface FireZone {
  x: number;
  z: number;
  radius: number;
}

export interface AaSite {
  x: number;
  z: number;
}

export interface Shot {
  kind: 'tracer' | 'flak';
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}

export class Threats {
  zones: FireZone[] = [];
  aa: AaSite[] = [];
  underFire = 0;
  private aaWarned = false;

  configure(zones: FireZone[], aa: AaSite[]): void {
    this.zones = zones;
    this.aa = aa;
    this.underFire = 0;
    this.aaWarned = false;
  }

  clear(): void {
    this.configure([], []);
  }

  get hot(): boolean {
    return this.underFire > 0;
  }

  inside(x: number, z: number): boolean {
    return this.zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.radius);
  }

  update(dt: number, flight: FlightModel): { aaWarn: boolean; hit: boolean; shots: Shot[] } {
    this.underFire = Math.max(0, this.underFire - dt);
    const shots: Shot[] = [];
    let hit = false;
    let aaWarn = false;
    const speed = Math.hypot(flight.vel.x, flight.vel.z);
    const exposure = 0.2 + 0.8 * (1 - smoothstep(8, 42, speed));

    for (const zone of this.zones) {
      const d = Math.hypot(flight.pos.x - zone.x, flight.pos.z - zone.z);
      if (d > zone.radius || flight.agl > 95) continue;
      if (Math.random() < config.threats.groundRate * exposure * dt) {
        flight.addDamage(config.threats.groundHit * (0.7 + Math.random() * 0.5), 'fire');
        this.underFire = config.threats.alertTime;
        hit = true;
        const ang = Math.random() * Math.PI * 2;
        const x0 = zone.x + Math.cos(ang) * zone.radius * 0.75;
        const z0 = zone.z + Math.sin(ang) * zone.radius * 0.75;
        shots.push({
          kind: 'tracer',
          x0,
          y0: heightAt(x0, z0) + 1.2,
          z0,
          x1: flight.pos.x + (Math.random() - 0.5) * 5,
          y1: flight.pos.y + (Math.random() - 0.5) * 1.2,
          z1: flight.pos.z + (Math.random() - 0.5) * 5,
        });
      }
    }

    for (const gun of this.aa) {
      const d = Math.hypot(flight.pos.x - gun.x, flight.pos.z - gun.z);
      if (d > config.threats.aaRange) continue;
      if (!this.aaWarned) {
        this.aaWarned = true;
        aaWarn = true;
      }
      if (flight.grounded || flight.agl < config.threats.aaMinAgl) continue;
      const gy = heightAt(gun.x, gun.z) + 6;
      if (losBlocked(gun.x, gy, gun.z, flight.pos.x, flight.pos.y, flight.pos.z)) continue;
      if (Math.random() < config.threats.aaRate * dt) {
        const miss = Math.random() < 0.5;
        if (!miss) {
          flight.addDamage(config.threats.aaHit, 'aa');
          hit = true;
        }
        this.underFire = config.threats.alertTime;
        shots.push({
          kind: 'flak',
          x0: gun.x,
          y0: gy,
          z0: gun.z,
          x1: flight.pos.x + (Math.random() - 0.5) * 10,
          y1: flight.pos.y + (Math.random() - 0.5) * 6,
          z1: flight.pos.z + (Math.random() - 0.5) * 10,
        });
      }
    }

    return { aaWarn, hit, shots };
  }
}
