import type { AssistLevel, MedalId } from '../config';

export interface SaveData {
  unlocked: number;
  medals: MedalId[];
  assist: AssistLevel;
  volume: number;
  muted: boolean;
  quality: 'low' | 'high';
}

const KEY = 'dustoff68';
const MEDAL_RANK: Record<MedalId, number> = { none: 0, air: 1, dfc: 2, ss: 3 };

const fallback = (): SaveData => ({
  unlocked: 1,
  medals: ['none', 'none', 'none', 'none'],
  assist: 1,
  volume: 0.8,
  muted: false,
  quality: 'high',
});

function load(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    const base = fallback();
    return {
      unlocked: clampInt(parsed.unlocked, 1, 4, base.unlocked),
      medals: Array.isArray(parsed.medals) ? (parsed.medals.slice(0, 4) as MedalId[]) : base.medals,
      assist: parsed.assist === 0 || parsed.assist === 1 || parsed.assist === 2 ? parsed.assist : 1,
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : 0.8,
      muted: Boolean(parsed.muted),
      quality: parsed.quality === 'low' ? 'low' : 'high',
    };
  } catch {
    return fallback();
  }
}

function clampInt(v: unknown, a: number, b: number, d: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return d;
  return Math.max(a, Math.min(b, Math.round(v)));
}

export const settings: SaveData = load();

export function persist(): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export function noteMedal(missionIndex: number, medal: MedalId): void {
  const prev = settings.medals[missionIndex] ?? 'none';
  if (MEDAL_RANK[medal] > MEDAL_RANK[prev]) settings.medals[missionIndex] = medal;
  if (medal !== 'none' && missionIndex + 1 >= settings.unlocked && missionIndex < 3) {
    settings.unlocked = missionIndex + 2;
  }
  persist();
}

export function medalLabel(id: MedalId): string {
  switch (id) {
    case 'ss':
      return 'Silver Star';
    case 'dfc':
      return 'Distinguished Flying Cross';
    case 'air':
      return 'Air Medal';
    default:
      return '—';
  }
}
