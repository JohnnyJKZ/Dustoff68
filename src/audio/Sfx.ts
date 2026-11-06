import type { AudioEngine } from './AudioEngine';

export class Sfx {
  private wind: GainNode;
  private windFilter: BiquadFilterNode;
  private noise: AudioBufferSourceNode;
  private hoistOsc: OscillatorNode;
  private hoistGain: GainNode;
  private started = false;

  constructor(private readonly engine: AudioEngine) {
    const ctx = engine.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 400;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0;
    this.noise.connect(this.windFilter);
    this.windFilter.connect(this.wind);
    this.wind.connect(engine.sfx);

    this.hoistOsc = ctx.createOscillator();
    this.hoistOsc.type = 'square';
    this.hoistOsc.frequency.value = 90;
    this.hoistGain = ctx.createGain();
    this.hoistGain.gain.value = 0;
    const hoistFilter = ctx.createBiquadFilter();
    hoistFilter.type = 'lowpass';
    hoistFilter.frequency.value = 240;
    this.hoistOsc.connect(hoistFilter);
    hoistFilter.connect(this.hoistGain);
    this.hoistGain.connect(engine.sfx);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.noise.start();
    this.hoistOsc.start();
  }

  update(speed: number, hoistMoving: boolean): void {
    if (!this.started) return;
    const now = this.engine.ctx.currentTime;
    this.wind.gain.setTargetAtTime(Math.min(0.18, speed * 0.004), now, 0.1);
    this.windFilter.frequency.setTargetAtTime(280 + speed * 18, now, 0.1);
    this.hoistGain.gain.setTargetAtTime(hoistMoving ? 0.04 : 0, now, 0.05);
  }

  thud(strength: number): void {
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90 - strength * 4, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
    g.gain.setValueAtTime(Math.min(0.45, 0.08 + strength * 0.05), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    osc.connect(g);
    g.connect(this.engine.sfx);
    osc.start(now);
    osc.stop(now + 0.34);
  }

  blip(): void {
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const g = ctx.createGain();
    g.gain.value = 0.15;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    src.connect(bp);
    bp.connect(g);
    g.connect(this.engine.sfx);
    src.start(now);
  }

  beep(): void {
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = 880;
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g);
    g.connect(this.engine.sfx);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  thunder(): void {
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(50, now + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.engine.sfx);
    src.start(now);
    src.stop(now + 1.5);
  }
}
