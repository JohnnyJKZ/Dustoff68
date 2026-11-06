import { config } from '../config';
import { clamp } from '../util/math';

export class Fuel {
  amount = 1;
  warned = false;

  reset(amount: number): void {
    this.amount = clamp(amount, 0, 1);
    this.warned = this.amount < config.fuel.warn;
  }

  update(dt: number, collective: number, rpm: number, refueling: boolean): boolean {
    if (refueling && this.amount < 1) {
      this.amount = clamp(this.amount + config.fuel.refuelRate * dt, 0, 1);
      if (this.amount > config.fuel.warn) this.warned = false;
      return false;
    }
    if (rpm > 0.25) {
      const burn = config.fuel.burnIdle + collective * config.fuel.burnCollective;
      this.amount = clamp(this.amount - burn * dt, 0, 1);
    }
    if (!this.warned && this.amount < config.fuel.warn && this.amount > 0) {
      this.warned = true;
      return true;
    }
    return false;
  }

  get empty(): boolean {
    return this.amount <= 0.001;
  }
}
