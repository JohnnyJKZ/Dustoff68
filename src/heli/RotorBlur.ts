import { smoothstep } from '../util/math';

export function blurAmount(rpm: number): number {
  return smoothstep(0.55, 0.92, rpm);
}

export function bladeAmount(rpm: number): number {
  return 1 - smoothstep(0.45, 0.85, rpm);
}
