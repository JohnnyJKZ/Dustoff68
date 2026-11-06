import type { AudioEngine } from './AudioEngine';

export class RotorSynth {
  private readonly noise: AudioBufferSourceNode;
  private readonly lfo: OscillatorNode;
  private readonly slap: GainNode;
  private readonly slapLevel: GainNode;
  private readonly offset: ConstantSourceNode;
  private readonly turbine: GainNode;
  private readonly oscA: OscillatorNode;
  private readonly oscB: OscillatorNode;
  private started = false;

  constructor(private readonly engine: AudioEngine) {
    const ctx = engine.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 190;
    bp.Q.value = 3.2;
    this.slap = ctx.createGain();
    this.slap.gain.value = 0;
    this.slapLevel = ctx.createGain();
    this.slapLevel.gain.value = 0;
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sawtooth';
    this.lfo.frequency.value = 10;
    const depth = ctx.createGain();
    depth.gain.value = 0.45;
    this.offset = ctx.createConstantSource();
    this.offset.offset.value = 0.5;
    this.lfo.connect(depth);
    depth.connect(this.slap.gain);
    this.offset.connect(this.slap.gain);
    this.noise.connect(bp);
    bp.connect(this.slap);
    this.slap.connect(this.slapLevel);
    this.slapLevel.connect(engine.rotor);

    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscA.frequency.value = 74;
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'triangle';
    this.oscB.frequency.value = 148;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.turbine = ctx.createGain();
    this.turbine.gain.value = 0;
    this.oscA.connect(filter);
    this.oscB.connect(filter);
    filter.connect(this.turbine);
    this.turbine.connect(engine.rotor);
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.noise.start();
    this.lfo.start();
    this.offset.start();
    this.oscA.start();
    this.oscB.start();
  }

  update(rpm: number, collective: number, speed: number, cockpit: boolean): void {
    if (!this.started) return;
    const now = this.engine.ctx.currentTime;
    const bpf = Math.max(4, 10.6 * rpm);
    this.lfo.frequency.setTargetAtTime(bpf, now, 0.05);
    this.oscA.frequency.setTargetAtTime(68 + collective * 36 + rpm * 18, now, 0.08);
    this.oscB.frequency.setTargetAtTime(136 + collective * 50 + speed * 0.4, now, 0.08);
    const level = rpm * rpm * (0.12 + collective * 0.22) * (cockpit ? 0.55 : 0.9);
    this.turbine.gain.setTargetAtTime(level, now, 0.08);
    this.slapLevel.gain.setTargetAtTime(0.2 + level * 1.6, now, 0.08);
    this.engine.rotor.gain.setTargetAtTime(cockpit ? 0.55 : 0.8, now, 0.1);
  }
}
