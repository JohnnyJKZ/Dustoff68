import { config } from '../config';

export class AdaptiveResolution {
  scale: number;
  private min: number;
  private max: number;
  private acc = 0;
  private samples = 0;

  constructor(quality: 'low' | 'high') {
    this.max = quality === 'low' ? 0.8 : config.graphics.pixelMax;
    this.min = config.graphics.pixelMin;
    this.scale = quality === 'low' ? 0.8 : 1;
  }

  setQuality(quality: 'low' | 'high'): void {
    this.max = quality === 'low' ? 0.8 : config.graphics.pixelMax;
    this.scale = Math.min(this.scale, this.max);
  }

  /** Returns true when the scale changed. */
  sample(frameMs: number): boolean {
    this.acc += frameMs;
    this.samples++;
    if (this.samples < 24) return false;
    const avg = this.acc / this.samples;
    this.acc = 0;
    this.samples = 0;
    const prev = this.scale;
    if (avg > config.graphics.targetFrameMs + 2.2)
      this.scale = Math.max(this.min, this.scale * 0.9);
    else if (avg < config.graphics.targetFrameMs - 2.5)
      this.scale = Math.min(this.max, this.scale * 1.05);
    return Math.abs(this.scale - prev) > 0.01;
  }
}
