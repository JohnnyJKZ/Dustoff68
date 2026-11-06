export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly music: GainNode;
  readonly sfx: GainNode;
  readonly rotor: GainNode;
  volume = 0.8;
  muted = false;

  constructor() {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.rotor = this.ctx.createGain();
    this.music.connect(this.master);
    this.sfx.connect(this.master);
    this.rotor.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.apply();
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v));
    this.apply();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.apply();
  }

  toggleMute(): void {
    this.setMuted(!this.muted);
  }

  duck(amount: number): void {
    const now = this.ctx.currentTime;
    const target = amount;
    this.music.gain.cancelScheduledValues(now);
    this.music.gain.setTargetAtTime(target, now, 0.08);
  }

  private apply(): void {
    this.master.gain.value = this.muted ? 0 : this.volume;
  }
}
