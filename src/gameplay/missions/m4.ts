import { layout } from '../../world/layout';
import type { MissionDef } from '../types';

export const mission4: MissionDef = {
  id: 'm4',
  index: 3,
  name: 'Monsoon Night',
  briefing:
    'Night evacuation from the village east of the river. Flares are up. Rain, gusts, and a tight fuel load. Use the searchlight (L). Do not loiter.',
  time: 'night',
  weather: 'rain',
  startFuel: 0.46,
  assist: null,
  parTime: 360,
  mode: 'land',
  lzKey: 'lz4',
  smoke: 'green',
  passengers: [
    { triage: 'urgent', civilian: false },
    { triage: 'priority', civilian: true },
    { triage: 'routine', civilian: true },
    { triage: 'routine', civilian: true },
  ],
  fire: [layout.fireM4],
  aa: [],
  flares: true,
  radios: [
    {
      trigger: 'start',
      text: 'Night Dustoff. Village is marked with flares. Weather is down the valley. Fuel is tight.',
    },
    { trigger: 'near', text: 'Flares at your twelve. Watch the gusts on short final.' },
    { trigger: 'hot', text: 'Sporadic fire south of the village. Keep the landing short.' },
    { trigger: 'aboard', text: 'Loaded. Hospital, and watch your fuel.' },
    { trigger: 'lowfuel', text: 'Fuel critical. Base camp is the only place to fill up.' },
  ],
};
