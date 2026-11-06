import { config } from '../config';
import type { FlightModel } from '../flight/FlightModel';
import type { HueyModel } from '../heli/HueyModel';
import { angNorm, clamp } from '../util/math';
import type { Passengers } from './Passengers';

export type PilotPhase = 'lift' | 'cruise' | 'approach' | 'settle' | 'board';

/**
 * Files mission 1 the way a careful dustoff pilot would:
 * climb, cruise, bleed speed, set down, doors, then the hospital.
 * Writes the same stick axes the player uses. SAS (assist 1) is assumed.
 */
export class Autopilot {
  phase: PilotPhase = 'lift';

  reset(): PilotPhase {
    this.phase = 'lift';
    return this.phase;
  }

  drive(
    flight: FlightModel,
    heli: HueyModel,
    passengers: Passengers,
    target: { x: number; z: number },
    atHospital: boolean,
    holding: boolean,
  ): PilotPhase {
    const dx = target.x - flight.pos.x;
    const dz = target.z - flight.pos.z;
    const dist = Math.hypot(dx, dz);
    const wantPickup = passengers.waiting > 0;
    const wantDrop = !wantPickup && passengers.aboard > 0;
    const onPad = dist < (atHospital ? 36 : 18);

    if (holding || (flight.grounded && onPad && (wantPickup || wantDrop))) {
      this.phase = 'board';
    } else if (dist < 55 && flight.agl < 22) {
      this.phase = 'settle';
    } else if (dist < 200) {
      this.phase = 'approach';
    } else if (flight.agl < 18 && this.phase !== 'cruise') {
      this.phase = 'lift';
    } else {
      this.phase = 'cruise';
    }

    const forwardX = Math.sin(flight.yaw);
    const forwardZ = Math.cos(flight.yaw);
    const rightX = forwardZ;
    const rightZ = -forwardX;
    const nose = flight.vel.x * forwardX + flight.vel.z * forwardZ;
    const side = flight.vel.x * rightX + flight.vel.z * rightZ;

    let yawErr = angNorm(Math.atan2(dx, dz) - flight.yaw);
    if (this.phase === 'board' || (this.phase === 'settle' && dist < 16)) yawErr *= 0.15;

    let wantSpeed = 8;
    if (this.phase === 'cruise') wantSpeed = dist > 500 ? 34 : 26;
    else if (this.phase === 'approach') wantSpeed = clamp(dist * 0.11, 5, 16);
    else if (this.phase === 'settle' || this.phase === 'board') wantSpeed = 0;

    let pitchCmd = clamp((wantSpeed - nose) * 0.04, -0.1, 0.32);
    if (this.phase === 'board' || (this.phase === 'settle' && flight.agl < 2.5)) pitchCmd = 0;

    const cosP = Math.max(0.75, Math.cos(flight.pitch));
    const rotor = config.flight.rotorRadius * 2;
    const ge =
      flight.agl < rotor ? 1 + config.flight.groundEffect * (1 - flight.agl / rotor) ** 2 : 1;
    const hover =
      (flight.mass * 9.81) / (config.flight.maxThrust * flight.rpm * flight.rpm * cosP * ge);
    let aglTarget = 46;
    if (this.phase === 'lift') aglTarget = 34;
    else if (this.phase === 'approach') aglTarget = clamp(8 + dist * 0.12, 10, 32);
    else if (this.phase === 'settle') aglTarget = flight.agl > 6 ? 3 : 0.3;
    else if (this.phase === 'board') aglTarget = 0;

    let wantVy = clamp((aglTarget - flight.agl) * 0.45, -3.5, 5);
    if (this.phase === 'settle') wantVy = flight.agl > 4 ? -1.15 : -0.4;
    if (this.phase === 'board') wantVy = flight.grounded ? 0 : -0.6;

    let col = hover + (wantVy - flight.vel.y) * 0.055;
    if (this.phase === 'board' && flight.grounded) col = 0.18;
    col = clamp(col, 0.04, 0.93);

    flight.input.collective = clamp((col - flight.collective) * 5.5, -1, 1);
    flight.input.pitch = clamp(pitchCmd / config.flight.maxPitch, -1, 1);
    flight.input.yaw = clamp(yawErr / 0.45, -1, 1);
    flight.input.roll = clamp(-side / (8 * config.flight.maxRoll), -1, 1);

    const doors =
      this.phase === 'board' || (this.phase === 'settle' && dist < 22 && flight.agl < 5);
    heli.doorsOpen = doors && (wantPickup || wantDrop || holding);
    if (this.phase === 'lift' || this.phase === 'cruise') heli.doorsOpen = false;

    return this.phase;
  }
}
