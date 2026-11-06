import { settings } from '../core/save';

export class PauseMenu {
  readonly root: HTMLElement;
  private readonly assist: HTMLSelectElement;
  private readonly volume: HTMLInputElement;
  private readonly quality: HTMLSelectElement;
  private readonly mute: HTMLButtonElement;

  constructor(
    parent: HTMLElement,
    hooks: {
      resume: () => void;
      abort: () => void;
      assist: (n: 0 | 1 | 2) => void;
      volume: (n: number) => void;
      quality: (q: 'low' | 'high') => void;
      mute: () => void;
    },
  ) {
    this.root = document.createElement('div');
    this.root.className = 'overlay hidden';
    const panel = document.createElement('div');
    panel.className = 'panel';
    const h = document.createElement('h2');
    h.textContent = 'Holding';
    this.assist = document.createElement('select');
    for (const [id, label] of [
      ['0', 'Assist off'],
      ['1', 'Stability SAS'],
      ['2', 'Auto-hover'],
    ] as const) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = label;
      this.assist.append(o);
    }
    this.quality = document.createElement('select');
    for (const [id, label] of [
      ['high', 'High'],
      ['low', 'Low'],
    ] as const) {
      const o = document.createElement('option');
      o.value = id;
      o.textContent = label;
      this.quality.append(o);
    }
    this.volume = document.createElement('input');
    this.volume.type = 'range';
    this.volume.min = '0';
    this.volume.max = '1';
    this.volume.step = '0.01';
    this.mute = document.createElement('button');
    this.mute.textContent = 'Mute';
    const resume = document.createElement('button');
    resume.className = 'primary';
    resume.textContent = 'Resume';
    const abort = document.createElement('button');
    abort.textContent = 'Abort to title';
    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.append(resume, this.mute, abort);
    panel.append(
      h,
      row('Assist', this.assist),
      row('Quality', this.quality),
      row('Volume', this.volume),
      actions,
    );
    this.root.append(panel);
    parent.append(this.root);
    resume.addEventListener('click', () => hooks.resume());
    abort.addEventListener('click', () => hooks.abort());
    this.mute.addEventListener('click', () => hooks.mute());
    this.assist.addEventListener('change', () =>
      hooks.assist(Number(this.assist.value) as 0 | 1 | 2),
    );
    this.volume.addEventListener('input', () => hooks.volume(Number(this.volume.value)));
    this.quality.addEventListener('change', () =>
      hooks.quality(this.quality.value === 'low' ? 'low' : 'high'),
    );
  }

  show(): void {
    this.assist.value = String(settings.assist);
    this.volume.value = String(settings.volume);
    this.quality.value = settings.quality;
    this.mute.textContent = settings.muted ? 'Unmute' : 'Mute';
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  refreshMute(): void {
    this.mute.textContent = settings.muted ? 'Unmute' : 'Mute';
  }
}

function row(label: string, control: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.className = 'row';
  const s = document.createElement('span');
  s.textContent = label;
  el.append(s, control);
  return el;
}
