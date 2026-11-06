import type { TimePreset, Triage } from '../config';

export interface SoulDef {
  triage: Triage;
  civilian: boolean;
  seconds?: number;
}

export interface RadioLine {
  trigger: 'start' | 'near' | 'hot' | 'aa' | 'aboard' | 'lowfuel' | 'hospital' | 'hoist';
  text: string;
}

export interface MissionDef {
  id: string;
  index: number;
  name: string;
  briefing: string;
  time: TimePreset;
  weather: 'clear' | 'rain';
  startFuel: number;
  /** null uses the player's saved assist level. */
  assist: 0 | 1 | 2 | null;
  parTime: number;
  mode: 'land' | 'hoist';
  lzKey: 'lz1' | 'lz3' | 'lz4' | null;
  hoist?: { x: number; z: number };
  smoke: 'green' | 'red';
  passengers: SoulDef[];
  fire: { x: number; z: number; radius: number }[];
  aa: { x: number; z: number }[];
  radios: RadioLine[];
  flares: boolean;
}
