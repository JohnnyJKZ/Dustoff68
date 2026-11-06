import type { MedalId } from '../config';

export interface ScoreInput {
  saved: number;
  total: number;
  lost: number;
  time: number;
  parTime: number;
  damage: number;
  crashed: boolean;
}

export interface ScoreResult {
  score: number;
  medal: MedalId;
  medalName: string;
  rank: string;
  title: string;
}

export function scoreMission(input: ScoreInput): ScoreResult {
  const timeBonus = Math.max(0, Math.round((input.parTime - input.time) * 4));
  const score = input.saved * 1000 - input.lost * 350 - Math.round(input.damage) * 8 + timeBonus;
  let medal: MedalId = 'none';
  if (!input.crashed && input.saved > 0) {
    const clean = input.saved === input.total && input.damage < 12 && input.time <= input.parTime;
    const solid = input.saved === input.total && input.damage < 38;
    medal = clean ? 'ss' : solid ? 'dfc' : 'air';
  }
  const names: Record<MedalId, { medalName: string; rank: string }> = {
    none: { medalName: 'No award', rank: 'Crew' },
    air: { medalName: 'Air Medal', rank: 'Warrant Officer' },
    dfc: { medalName: 'Distinguished Flying Cross', rank: 'Chief Warrant Officer' },
    ss: { medalName: 'Silver Star', rank: 'Dustoff Lead' },
  };
  const meta = names[medal];
  return {
    score: Math.max(0, score),
    medal,
    medalName: meta.medalName,
    rank: meta.rank,
    title: input.crashed
      ? 'Aircraft forced down. Crew recovered.'
      : input.saved === 0
        ? 'The window closed.'
        : 'Mission complete.',
  };
}
