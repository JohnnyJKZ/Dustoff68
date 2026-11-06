import type { ScoreResult } from '../gameplay/Scoring';

export class Results {
  readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly medal: HTMLElement;
  private readonly grid: HTMLElement;

  constructor(
    parent: HTMLElement,
    private readonly onNext: () => void,
    private readonly onRetry: () => void,
    private readonly onTitle: () => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'overlay hidden';
    const panel = document.createElement('div');
    panel.className = 'panel';
    this.title = document.createElement('h2');
    this.medal = document.createElement('div');
    this.medal.className = 'medal';
    this.grid = document.createElement('div');
    this.grid.className = 'score-grid';
    const actions = document.createElement('div');
    actions.className = 'actions';
    const next = document.createElement('button');
    next.className = 'primary';
    next.textContent = 'Next mission';
    next.addEventListener('click', () => this.onNext());
    const retry = document.createElement('button');
    retry.textContent = 'Fly it again';
    retry.addEventListener('click', () => this.onRetry());
    const title = document.createElement('button');
    title.textContent = 'Title';
    title.addEventListener('click', () => this.onTitle());
    actions.append(next, retry, title);
    this.nextBtn = next;
    panel.append(this.title, this.medal, this.grid, actions);
    this.root.append(panel);
    parent.append(this.root);
  }

  private readonly nextBtn: HTMLButtonElement;

  show(
    result: ScoreResult,
    saved: number,
    total: number,
    time: number,
    damage: number,
    hasNext: boolean,
  ): void {
    this.title.textContent = result.title;
    this.medal.textContent = `${result.medalName} · ${result.rank}`;
    const rows: [string, string][] = [
      ['Lives saved', `${saved} / ${total}`],
      ['Time', formatTime(time)],
      ['Damage', `${Math.round(damage)}`],
      ['Score', String(result.score)],
    ];
    this.grid.replaceChildren();
    for (const [k, v] of rows) {
      const a = document.createElement('span');
      a.textContent = k;
      const b = document.createElement('span');
      b.textContent = v;
      this.grid.append(a, b);
    }
    this.nextBtn.classList.toggle('hidden', !hasNext);
    this.root.classList.remove('hidden');
  }

  hide(): void {
    this.root.classList.add('hidden');
  }
}

function formatTime(t: number): string {
  const s = Math.round(t);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
