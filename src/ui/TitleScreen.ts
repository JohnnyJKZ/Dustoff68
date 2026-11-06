import { medalLabel, settings } from '../core/save';
import { missions } from '../gameplay/missions';

export class TitleScreen {
  readonly root: HTMLElement;
  private readonly volume: HTMLInputElement;
  private readonly assist: HTMLSelectElement;

  constructor(
    parent: HTMLElement,
    private readonly onPlay: (index: number) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'title';
    this.root.style.backgroundImage = "url('/assets/images/intro-dustoff68.jpg')";
    const menu = document.createElement('div');
    menu.className = 'menu panel';
    const h = document.createElement('h1');
    h.textContent = 'Select a mission';
    menu.append(h);
    missions.forEach((m, i) => {
      const btn = document.createElement('button');
      btn.className = 'mission-btn';
      const name = document.createElement('span');
      name.textContent = `${i + 1}  ${m.name}`;
      const medal = document.createElement('small');
      medal.textContent =
        i < settings.unlocked ? medalLabel(settings.medals[i] ?? 'none') : 'Locked';
      btn.append(name, medal);
      btn.disabled = i >= settings.unlocked;
      btn.addEventListener('click', () => this.onPlay(i));
      menu.append(btn);
    });
    this.assist = document.createElement('select');
    for (const [id, label] of [
      ['0', 'Assist off'],
      ['1', 'Stability SAS'],
      ['2', 'Auto-hover'],
    ] as const) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      this.assist.append(opt);
    }
    this.assist.value = String(settings.assist);
    const vol = document.createElement('input');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '1';
    vol.step = '0.01';
    vol.value = String(settings.volume);
    this.volume = vol;
    menu.append(labeled('Assist', this.assist), labeled('Volume', vol));
    this.root.append(menu);
    parent.append(this.root);
    this.tryCleanPlate();
  }

  onAssist(cb: (level: 0 | 1 | 2) => void): void {
    this.assist.addEventListener('change', () => cb(Number(this.assist.value) as 0 | 1 | 2));
  }

  onVolume(cb: (v: number) => void): void {
    this.volume.addEventListener('input', () => cb(Number(this.volume.value)));
  }

  refresh(): void {
    const buttons = this.root.querySelectorAll<HTMLButtonElement>('.mission-btn');
    buttons.forEach((btn, i) => {
      btn.disabled = i >= settings.unlocked;
      const small = btn.querySelector('small');
      if (small)
        small.textContent =
          i < settings.unlocked ? medalLabel(settings.medals[i] ?? 'none') : 'Locked';
    });
  }

  show(): void {
    this.refresh();
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  private tryCleanPlate(): void {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > 0) this.root.style.backgroundImage = `url('${img.src}')`;
    };
    img.src = '/assets/images/intro_dustoff68_notitle.jpg';
  }
}

function labeled(text: string, control: HTMLElement): HTMLElement {
  const row = document.createElement('div');
  row.className = 'row';
  const span = document.createElement('span');
  span.textContent = text;
  row.append(span, control);
  return row;
}
