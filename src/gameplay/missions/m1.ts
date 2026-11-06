import type { MissionDef } from '../types';

export const mission1: MissionDef = {
  id: 'm1',
  index: 0,
  name: 'First Light Pickup',
  briefing:
    'Dawn recon found two wounded at a paddy clearing east of the river. Green smoke, cold LZ. Set it down easy and get them to the field hospital.',
  time: 'dawn',
  weather: 'clear',
  startFuel: 1,
  assist: 2,
  parTime: 200,
  mode: 'land',
  lzKey: 'lz1',
  smoke: 'green',
  passengers: [
    { triage: 'routine', civilian: false },
    { triage: 'routine', civilian: false },
  ],
  fire: [],
  aa: [],
  flares: false,
  radios: [
    {
      trigger: 'start',
      text: 'Dustoff, two routine at the green smoke. Paddy clearing, you are clear to land.',
    },
    { trigger: 'near', text: 'LZ in sight. Green smoke. Put it down gentle.' },
    { trigger: 'aboard', text: 'Patients aboard. Field hospital is west, red cross on the pad.' },
    { trigger: 'lowfuel', text: 'Fuel is getting thin. Base camp can top you off.' },
  ],
};
