import { config } from '../config';
import type { AudioEngine } from './AudioEngine';

export type TrackId = 'title' | 'flight' | 'hot' | 'night';

const URLS: Record<TrackId, string> = {
  title: '/assets/music/title_theme.mp3',
  flight: '/assets/music/mission_flight.mp3',
  hot: '/assets/music/hot_lz.mp3',
  night: '/assets/music/night_mission.mp3',
};

interface Voice {
  name: TrackId;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export class MusicManager {
  private buffers = new Map<TrackId, AudioBuffer>();
  private current: Voice | null = null;
  private want: TrackId | null = null;

  constructor(private readonly engine: AudioEngine) {}

  async load(onProgress?: (s: string) => void): Promise<void> {
    const entries = Object.entries(URLS) as [TrackId, string][];
    await Promise.all(
      entries.map(async ([id, url]) => {
        onProgress?.(`Spinning up ${id.replace('_', ' ')}…`);
        try {
          const res = await fetch(url);
          const raw = await res.arrayBuffer();
          const buf = await this.engine.ctx.decodeAudioData(raw.slice(0));
          this.buffers.set(id, buf);
        } catch (err) {
          console.warn('music failed', id, err);
        }
      }),
    );
  }

  play(name: TrackId | null): void {
    if (name === this.want) return;
    this.want = name;
    const ctx = this.engine.ctx;
    const now = ctx.currentTime;
    const fade = config.audio.crossfade;
    if (this.current) {
      const old = this.current;
      old.gain.gain.cancelScheduledValues(now);
      old.gain.gain.setValueAtTime(old.gain.gain.value, now);
      old.gain.gain.linearRampToValueAtTime(0, now + fade);
      old.source.stop(now + fade + 0.05);
      this.current = null;
    }
    if (!name) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + fade);
    source.connect(gain);
    gain.connect(this.engine.music);
    source.start(now);
    this.current = { name, source, gain };
  }
}
