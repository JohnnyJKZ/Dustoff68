import type { AudioEngine } from './AudioEngine';

export class Stingers {
  constructor(private readonly engine: AudioEngine) {}

  complete(): void {
    this.tone([523, 659, 784], 0.18, 'sine', 0.2);
  }

  fail(): void {
    this.tone([196, 155, 110], 0.28, 'triangle', 0.22);
  }

  private tone(freqs: number[], dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = f;
      const t = now + i * dur * 0.85;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.engine.sfx);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  }
}
