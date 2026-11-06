import type { SpotLight } from 'three';

/** Night searchlight attached to the Huey. L toggles it. */
export class Searchlight {
  on = true;

  constructor(private readonly spot: SpotLight) {}

  toggle(): void {
    this.on = !this.on;
  }

  apply(night: boolean): void {
    this.spot.intensity = !this.on ? 0 : night ? 5500 : 900;
  }
}
