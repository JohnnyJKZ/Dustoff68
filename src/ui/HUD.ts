import type { Triage } from '../config';

export interface HudSoul {
  label: string;
  triage: Triage;
  timer: number;
  state: string;
}

export interface HudModel {
  visible: boolean;
  agl: number;
  speedKt: number;
  fuel: number;
  damage: number;
  collective: number;
  heading: number;
  assist: string;
  subtitle: string;
  toast: string;
  hint: string;
  stats: string;
  hoist: number | null;
  aboard: number;
  capacity: number;
  souls: HudSoul[];
  markers: { label: string; rel: number; dist: number; primary: boolean }[];
}

export class HUD {
  private readonly root: HTMLElement;
  private readonly needles: Record<string, SVGLineElement>;
  private readonly values: Record<string, SVGTextElement>;
  private readonly souls: HTMLElement;
  private readonly subtitle: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly coll: HTMLElement;
  private readonly tape: HTMLElement;
  private readonly caret: HTMLElement;
  private readonly markers: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud hidden';
    const gauges = document.createElement('div');
    gauges.className = 'gauges';
    this.needles = {};
    this.values = {};
    for (const g of [
      ['alt', 'AGL'],
      ['spd', 'KTS'],
      ['fuel', 'FUEL'],
      ['dmg', 'DMG'],
    ] as const) {
      const svg = gauge(g[0], g[1]);
      gauges.append(svg.svg);
      this.needles[g[0]] = svg.needle;
      this.values[g[0]] = svg.value;
    }
    const coll = document.createElement('div');
    coll.className = 'collective';
    this.coll = document.createElement('i');
    coll.append(this.coll);
    const compass = document.createElement('div');
    compass.className = 'compass-wrap';
    this.tape = document.createElement('div');
    this.tape.className = 'tape';
    this.tape.textContent = tapeMarks();
    this.caret = document.createElement('div');
    this.caret.className = 'compass-caret';
    this.markers = document.createElement('div');
    compass.append(this.tape, this.markers, this.caret);
    this.souls = document.createElement('div');
    this.souls.className = 'souls';
    this.subtitle = document.createElement('div');
    this.subtitle.className = 'subtitle';
    this.toast = document.createElement('div');
    this.toast.className = 'toast';
    this.hint = document.createElement('div');
    this.hint.className = 'hint';
    this.stats = document.createElement('div');
    this.stats.className = 'stats hidden';
    this.root.append(
      gauges,
      coll,
      compass,
      this.souls,
      this.subtitle,
      this.toast,
      this.hint,
      this.stats,
    );
    parent.append(this.root);
  }

  update(m: HudModel): void {
    this.root.classList.toggle('hidden', !m.visible);
    if (!m.visible) return;
    setNeedle(this.needles.alt!, this.values.alt!, m.agl / 300, `${Math.round(m.agl)}`);
    setNeedle(this.needles.spd!, this.values.spd!, m.speedKt / 120, `${Math.round(m.speedKt)}`);
    setNeedle(this.needles.fuel!, this.values.fuel!, m.fuel, `${Math.round(m.fuel * 100)}`);
    setNeedle(this.needles.dmg!, this.values.dmg!, m.damage / 100, `${Math.round(m.damage)}`);
    this.coll.style.height = `${Math.round(m.collective * 100)}%`;
    const pxPerDeg = 4.2;
    this.tape.style.transform = `translateX(${260 - m.heading * pxPerDeg}px)`;
    this.caret.textContent = `${pad(Math.round(m.heading))}°  ${m.assist}  ${m.aboard}/${m.capacity}`;
    this.markers.replaceChildren();
    for (const mk of m.markers) {
      let rel = mk.rel;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      const el = document.createElement('div');
      el.className = 'wp';
      el.style.left = `${260 + ((rel * 180) / Math.PI) * pxPerDeg}px`;
      el.textContent = `${mk.primary ? '▼ ' : ''}${mk.label} ${Math.round(mk.dist)}m`;
      this.markers.append(el);
    }
    this.souls.replaceChildren();
    for (const s of m.souls) {
      const row = document.createElement('div');
      row.className = `soul ${s.state === 'lost' ? 'lost' : s.triage}`;
      const name = document.createElement('span');
      name.textContent = s.label;
      const time = document.createElement('span');
      time.textContent =
        s.state === 'saved' ? 'SAFE' : s.state === 'lost' ? 'CLOSED' : clock(s.timer);
      row.append(name, time);
      this.souls.append(row);
    }
    const hoist = m.hoist === null ? '' : `HOIST ${Math.round(m.hoist * 100)}%`;
    this.subtitle.textContent = m.subtitle || hoist;
    this.toast.textContent = m.toast;
    this.hint.textContent = m.hint;
    this.stats.classList.toggle('hidden', !m.stats);
    this.stats.textContent = m.stats;
  }
}

function gauge(
  id: string,
  label: string,
): { svg: SVGSVGElement; needle: SVGLineElement; value: SVGTextElement } {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.classList.add('gauge');
  svg.dataset.id = id;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  ring.setAttribute('cx', '50');
  ring.setAttribute('cy', '54');
  ring.setAttribute('r', '34');
  ring.setAttribute('fill', 'rgba(10,8,6,0.45)');
  ring.setAttribute('stroke', 'rgba(230,177,90,0.45)');
  svg.append(ring);
  for (let i = 0; i <= 8; i++) {
    const a = ((-210 + i * 30) * Math.PI) / 180;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', `${50 + Math.sin(a) * 28}`);
    line.setAttribute('y1', `${54 - Math.cos(a) * 28}`);
    line.setAttribute('x2', `${50 + Math.sin(a) * 34}`);
    line.setAttribute('y2', `${54 - Math.cos(a) * 34}`);
    line.setAttribute('class', 'tick');
    svg.append(line);
  }
  const needle = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  needle.setAttribute('x1', '50');
  needle.setAttribute('y1', '54');
  needle.setAttribute('x2', '50');
  needle.setAttribute('y2', '26');
  needle.setAttribute('class', 'needle');
  const value = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  value.setAttribute('x', '50');
  value.setAttribute('y', '70');
  value.setAttribute('text-anchor', 'middle');
  value.textContent = '0';
  const cap = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  cap.setAttribute('x', '50');
  cap.setAttribute('y', '96');
  cap.setAttribute('text-anchor', 'middle');
  cap.textContent = label;
  svg.append(needle, value, cap);
  return { svg, needle, value };
}

function setNeedle(needle: SVGLineElement, value: SVGTextElement, t: number, text: string): void {
  const clamped = Math.max(0, Math.min(1, t));
  const deg = -120 + clamped * 240;
  needle.setAttribute('transform', `rotate(${deg} 50 54)`);
  value.textContent = text;
}

function tapeMarks(): string {
  let s = '';
  for (let d = -360; d <= 720; d += 10) {
    const n = ((d % 360) + 360) % 360;
    const label = n % 30 === 0 ? String(n).padStart(3, '0') : '·';
    s += label + '  ';
  }
  return s;
}

function pad(n: number): string {
  const v = ((n % 360) + 360) % 360;
  return String(v).padStart(3, '0');
}

function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
