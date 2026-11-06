import { layout } from '../../world/layout';
import type { MissionDef } from '../types';

export const mission3: MissionDef = {
  id: 'm3',
  index: 2,
  name: 'Hot LZ',
  briefing:
    'Red smoke. The LZ is under fire from the west — approach from the east. Five wounded, and you cannot take them all at once. Triple-A sits on the ridge north of the river. Stay low in the valley.',
  time: 'sunset',
  weather: 'clear',
  startFuel: 1,
  assist: null,
  parTime: 380,
  mode: 'land',
  lzKey: 'lz3',
  smoke: 'red',
  passengers: [
    { triage: 'urgent', civilian: false },
    { triage: 'priority', civilian: false },
    { triage: 'priority', civilian: true },
    { triage: 'routine', civilian: false },
    { triage: 'routine', civilian: true },
  ],
  fire: [layout.fireM3],
  aa: layout.aa,
  flares: false,
  radios: [
    {
      trigger: 'start',
      text: 'Dustoff, LZ is hot. Approach from the east. Ground fire is west of the smoke.',
    },
    { trigger: 'aa', text: 'Triple-A on the ridge. Get down in the valley and stay masked.' },
    { trigger: 'near', text: 'Red smoke. Make it quick — they have the western treeline.' },
    { trigger: 'hot', text: 'Taking fire. Do not hover in the open.' },
    { trigger: 'aboard', text: 'Cabin is full. Hospital first, then back for the rest.' },
    { trigger: 'lowfuel', text: 'You are burning too much. Base camp, then back out.' },
  ],
};
