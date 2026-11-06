import type { MissionDef } from '../gameplay/types';

const CONTROLS =
  'W/S collective · Arrows pitch and yaw · A/D strafe · Space hoist · E doors · C camera · L searchlight · P pause';

export class Briefing {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly kicker: HTMLElement;
  private readonly body: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly onStart: () => void,
    private readonly onBack: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'overlay hidden';
    const panel = document.createElement('div');
    panel.className = 'panel';
    this.kicker = document.createElement('p');
    this.kicker.className = 'kicker';
    this.title = document.createElement('h2');
    this.body = document.createElement('p');
    const controls = document.createElement('div');
    controls.className = 'controls';
    controls.textContent = CONTROLS;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const start = document.createElement('button');
    start.className = 'primary';
    start.textContent = 'Launch';
    start.addEventListener('click', () => this.onStart());
    const back = document.createElement('button');
    back.textContent = 'Back';
    back.addEventListener('click', () => this.onBack());
    actions.append(start, back);
    panel.append(this.kicker, this.title, this.body, controls, actions);
    this.root.append(panel);
    parent.append(this.root);
  }

  show(def: MissionDef): void {
    const when = def.time === 'dawn' ? 'Dawn' : def.time === 'night' ? 'Night' : 'Sunset';
    const sky = def.weather === 'rain' ? `${when} · rain` : when;
    this.kicker.textContent = `Mission ${def.index + 1} · ${sky} · ${def.smoke} smoke`;
    this.title.textContent = def.name;
    this.body.textContent = def.briefing;
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}
