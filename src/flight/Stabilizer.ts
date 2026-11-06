import { Vector3 } from 'three';
import { config, type AssistLevel } from '../config';
import { clamp } from '../util/math';

export interface Stick {
  collective: number;
  pitch: number;
  roll: number;
  yaw: number;
}

export class Stabilizer {
  level: AssistLevel = 1;

  solve(
    stick: Stick,
    vel: Vector3,
    forward: Vector3,
    right: Vector3,
  ): { pitch: number; roll: number; yawRate: number } {
    const nose = vel.dot(forward);
    const side = vel.dot(right);
    let pitch = stick.pitch * config.flight.maxPitch;
    let roll = stick.roll * config.flight.maxRoll;
    const bank = clamp(nose / 28, -1, 1);
    roll -= stick.yaw * bank * config.flight.autoBank;
    if (this.level >= 2) {
      pitch += clamp(-nose * config.flight.velDamp, -0.16, 0.16);
      roll += clamp(side * config.flight.velDamp, -0.18, 0.18);
    }
    return {
      pitch,
      roll,
      yawRate: stick.yaw * config.flight.maxYawRate,
    };
  }
}
