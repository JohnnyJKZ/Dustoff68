import { Euler, Quaternion, Vector3 } from 'three';
import { config } from '../config';
import { bus } from '../core/events';
import { clamp, lerp, smoothstep, angNorm } from '../util/math';
import { Stabilizer, type Stick } from './Stabilizer';

export class FlightModel {
  readonly pos = new Vector3();
  readonly prevPos = new Vector3();
  readonly vel = new Vector3();
  readonly quat = new Quaternion();
  readonly stabilizer = new Stabilizer();
  readonly input: Stick = { collective: 0, pitch: 0, roll: 0, yaw: 0 };

  pitch = 0;
  roll = 0;
  yaw = 0;
  prevPitch = 0;
  prevRoll = 0;
  prevYaw = 0;
  pitchRate = 0;
  rollRate = 0;
  collective = 0.15;
  rpm = 1;
  damage = 0;
  mass: number = config.flight.emptyMass;
  agl = 0;
  slope = 0;
  grounded = false;
  stableGround = false;
  settled = 0;
  destroyed = false;
  fuelOut = false;

  private phase = 0;
  private readonly euler = new Euler(0, 0, 0, 'YXZ');
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly accel = new Vector3();

  spawn(x: number, y: number, z: number, yaw: number): void {
    this.pos.set(x, y, z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.pitch = 0;
    this.roll = 0;
    this.yaw = yaw;
    this.prevPitch = 0;
    this.prevRoll = 0;
    this.prevYaw = yaw;
    this.pitchRate = 0;
    this.rollRate = 0;
    this.collective = 0.12;
    this.rpm = 1;
    this.damage = 0;
    this.destroyed = false;
    this.fuelOut = false;
    this.grounded = true;
    this.stableGround = true;
    this.settled = 1.5;
    this.mass = config.flight.emptyMass;
    this.agl = 0;
    this.slope = 0;
    this.syncQuat(this.quat);
  }

  setMass(mass: number): void {
    this.mass = Math.max(400, mass);
  }

  addDamage(amount: number, source: string): void {
    if (amount <= 0 || this.destroyed) return;
    this.damage = Math.min(config.damage.fatal, this.damage + amount);
    bus.emit('damage', { amount, total: this.damage, source });
    if (this.damage >= config.damage.fatal) this.destroyed = true;
  }

  beginStep(): void {
    this.prevPos.copy(this.pos);
    this.prevPitch = this.pitch;
    this.prevRoll = this.roll;
    this.prevYaw = this.yaw;
  }

  integrate(dt: number, wind: Vector3): void {
    if (this.fuelOut) this.rpm = Math.max(0, this.rpm - dt * config.flight.engineOutSpool);
    else this.rpm += (1 - this.rpm) * (1 - Math.exp(-dt * 1.4));

    this.collective = clamp(
      this.collective + this.input.collective * config.flight.collectiveRate * dt,
      0,
      1,
    );

    this.syncQuat(this.quat);
    this.forward.set(0, 0, 1).applyQuaternion(this.quat);
    this.right.set(1, 0, 0).applyQuaternion(this.quat);
    const stab = this.stabilizer.solve(this.input, this.vel, this.forward, this.right);

    if (this.stabilizer.level === 0) {
      this.pitchRate += this.input.pitch * config.flight.ratePitch * dt;
      this.rollRate += this.input.roll * config.flight.rateRoll * dt;
      const nose = clamp(this.vel.dot(this.forward) / 28, -1, 1);
      this.rollRate -= this.input.yaw * nose * config.flight.autoBank * dt * 1.6;
      this.pitchRate *= Math.exp(-dt * 2.4);
      this.rollRate *= Math.exp(-dt * 2.4);
      this.pitch += this.pitchRate * dt;
      this.roll += this.rollRate * dt;
    } else {
      const sp = config.flight.attitudeStiffness;
      const sd = config.flight.attitudeDamping;
      this.pitchRate += ((stab.pitch - this.pitch) * sp - this.pitchRate * sd) * dt;
      this.rollRate += ((stab.roll - this.roll) * sp - this.rollRate * sd) * dt;
      this.pitch += this.pitchRate * dt;
      this.roll += this.rollRate * dt;
    }
    this.yaw += stab.yawRate * dt;

    if (this.damage > 58) {
      this.phase += dt;
      const w = (this.damage - 58) / 42;
      this.roll += Math.sin(this.phase * 8) * 0.045 * w;
      this.pitch += Math.sin(this.phase * 5.5) * 0.02 * w;
    }
    this.pitch = clamp(this.pitch, -0.62, 0.62);
    this.roll = clamp(this.roll, -0.72, 0.72);

    this.syncQuat(this.quat);
    this.up.set(0, 1, 0).applyQuaternion(this.quat);

    const ge = groundEffect(Math.max(0, this.agl));
    const horiz = Math.hypot(this.vel.x, this.vel.z);
    const etl =
      1 +
      config.flight.etlAmount *
        smoothstep(config.flight.etlSpeed, config.flight.etlSpeed * 2.5, horiz);
    const health = 1 - (this.damage / 100) * 0.38;
    const thrust =
      this.collective * config.flight.maxThrust * ge * etl * this.rpm * this.rpm * health;

    this.accel.copy(this.up).multiplyScalar(thrust / this.mass);
    this.accel.y -= 9.81;
    const speed = this.vel.length();
    if (speed > 1e-4) {
      this.accel.addScaledVector(this.vel, (-config.flight.drag * speed) / this.mass);
    }
    this.accel.x += (wind.x - this.vel.x) * 0.22;
    this.accel.z += (wind.z - this.vel.z) * 0.22;
    this.accel.y += wind.y * 0.12;

    this.vel.addScaledVector(this.accel, dt);
    if (this.vel.length() > 82) this.vel.setLength(82);
    this.pos.addScaledVector(this.vel, dt);

    const dist = Math.hypot(this.pos.x, this.pos.z);
    const lim = config.world.playRadius;
    if (dist > lim) {
      const k = ((dist - lim) / 160) * config.flight.borderPush * dt;
      this.vel.x -= (this.pos.x / dist) * k;
      this.vel.z -= (this.pos.z / dist) * k;
    }
  }

  renderPose(alpha: number, outPos: Vector3, outQuat: Quaternion): void {
    outPos.lerpVectors(this.prevPos, this.pos, alpha);
    const pitch = lerp(this.prevPitch, this.pitch, alpha);
    const roll = lerp(this.prevRoll, this.roll, alpha);
    const yaw = this.prevYaw + angNorm(this.yaw - this.prevYaw) * alpha;
    this.euler.set(pitch, yaw, roll, 'YXZ');
    outQuat.setFromEuler(this.euler);
  }

  forwardAt(q: Quaternion, out: Vector3): Vector3 {
    return out.set(0, 0, 1).applyQuaternion(q);
  }

  private syncQuat(out: Quaternion): void {
    this.euler.set(this.pitch, this.yaw, this.roll, 'YXZ');
    out.setFromEuler(this.euler);
  }
}

function groundEffect(agl: number): number {
  const R = config.flight.rotorRadius * 2;
  if (agl >= R) return 1;
  const t = 1 - agl / R;
  return 1 + config.flight.groundEffect * t * t;
}
