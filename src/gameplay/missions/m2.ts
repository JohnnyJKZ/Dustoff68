import { layout } from '../../world/layout';
import type { MissionDef } from '../types';

export const mission2: MissionDef = {
  id: 'm2',
  index: 1,
  name: 'Under the Canopy',
  briefing:
    'Three wounded are under the canopy with no clearing big enough to land. Hold a steady hover and run the hoist. One of them is urgent.',
  time: 'sunset',
  weather: 'clear',
  startFuel: 1,
  assist: null,
  parTime: 240,
  mode: 'hoist',
  lzKey: null,
  hoist: { x: layout.hoist.x, z: layout.hoist.z },
  smoke: 'green',
  passengers: [
    { triage: 'urgent', civilian: false, seconds: 220 },
    { triage: 'priority', civilian: true },
    { triage: 'routine', civilian: false },
  ],
  fire: [],
  aa: [],
  flares: false,
  radios: [
    { trigger: 'start', text: 'No clearing under that canopy. You will have to hoist them.' },
    { trigger: 'near', text: 'Smoke below. Hold still, doors open, and run the hoist.' },
    { trigger: 'hoist', text: 'Litter is on the way up. Keep her steady.' },
    { trigger: 'aboard', text: 'That is the last of them. Hospital is waiting.' },
    { trigger: 'lowfuel', text: 'Fuel state low. Refuel at base camp.' },
  ],
};
