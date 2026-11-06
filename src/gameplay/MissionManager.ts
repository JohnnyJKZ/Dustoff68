import { layout } from '../world/layout';
import type { Passengers } from './Passengers';
import type { Radio } from './Radio';
import { scoreMission, type ScoreResult } from './Scoring';
import type { MissionDef } from './types';

export interface MissionCtx {
  x: number;
  z: number;
  destroyed: boolean;
  fuelEmpty: boolean;
  lowFuel: boolean;
  settled: number;
  onBase: boolean;
  onHospital: boolean;
  hot: boolean;
  aaWarn: boolean;
  justBoarded: boolean;
  justHoist: boolean;
  damage: number;
  passengers: Passengers;
  radio: Radio;
}

export class MissionManager {
  def: MissionDef | null = null;
  elapsed = 0;
  outcome: 'complete' | 'failed' | null = null;
  reason = '';
  result: ScoreResult | null = null;
  private flags = blankFlags();

  start(def: MissionDef, radio: Radio): void {
    this.def = def;
    this.elapsed = 0;
    this.outcome = null;
    this.result = null;
    this.reason = '';
    this.flags = blankFlags();
    const intro = def.radios.find((r) => r.trigger === 'start');
    if (intro) radio.say(intro.text, 6);
  }

  lz(): { x: number; z: number } {
    if (!this.def) return { x: 0, z: 0 };
    if (this.def.mode === 'hoist' && this.def.hoist) return this.def.hoist;
    if (this.def.lzKey) {
      const pad = layout.pads[this.def.lzKey];
      return { x: pad.x, z: pad.z };
    }
    return { x: layout.hoist.x, z: layout.hoist.z };
  }

  update(dt: number, ctx: MissionCtx): void {
    if (!this.def || this.outcome) return;
    this.elapsed += dt;
    const lz = this.lz();
    const dist = Math.hypot(ctx.x - lz.x, ctx.z - lz.z);
    this.sayOnce('near', dist < 170, ctx);
    this.sayOnce('hot', ctx.hot, ctx);
    this.sayOnce('aa', ctx.aaWarn, ctx);
    this.sayOnce('lowfuel', ctx.lowFuel, ctx);
    if (ctx.justHoist) this.sayOnce('hoist', true, ctx);
    if (ctx.justBoarded && ctx.passengers.waiting === 0 && ctx.passengers.aboard > 0) {
      this.sayOnce('aboard', true, ctx);
    }
    if (ctx.onHospital && ctx.passengers.aboard > 0 && !this.flags.hospital) {
      this.flags.hospital = true;
      ctx.radio.say('Hospital pad. Doors open and we will take them.');
    }

    if (ctx.destroyed) {
      this.finish('failed', true, ctx);
      return;
    }

    const fieldClear = ctx.passengers.waiting === 0;
    const cabinClear = ctx.passengers.aboard === 0;
    if (fieldClear && cabinClear && ctx.passengers.souls.length > 0) {
      if (ctx.passengers.saved > 0) this.finish('complete', false, ctx);
      else this.finish('failed', false, ctx);
      return;
    }

    if (ctx.fuelEmpty && ctx.settled > 2.2 && !ctx.onBase) {
      const unloading = ctx.onHospital && ctx.passengers.aboard > 0;
      if (!unloading) this.finish('failed', true, ctx);
    }
  }

  private sayOnce(flag: keyof ReturnType<typeof blankFlags>, when: boolean, ctx: MissionCtx): void {
    if (!when || this.flags[flag] || !this.def) return;
    this.flags[flag] = true;
    const line = this.def.radios.find((r) => r.trigger === flag);
    if (line) ctx.radio.say(line.text);
  }

  private finish(outcome: 'complete' | 'failed', crashed: boolean, ctx: MissionCtx): void {
    if (!this.def) return;
    this.outcome = outcome;
    const saved = ctx.passengers.saved;
    const total = ctx.passengers.souls.length;
    this.result = scoreMission({
      saved,
      total,
      lost: Math.max(0, total - saved),
      time: this.elapsed,
      parTime: this.def.parTime,
      damage: ctx.damage,
      crashed: outcome === 'failed',
    });
    this.reason =
      outcome === 'complete'
        ? 'Mission complete.'
        : crashed
          ? 'Aircraft forced down. Crew recovered.'
          : 'The window closed.';
    this.result = { ...this.result, title: this.reason };
  }
}

function blankFlags() {
  return {
    near: false,
    hot: false,
    aa: false,
    aboard: false,
    lowfuel: false,
    hoist: false,
    hospital: false,
  };
}
