import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { config } from '../config';
import { AudioEngine } from '../audio/AudioEngine';
import { MusicManager, type TrackId } from '../audio/MusicManager';
import { RotorSynth } from '../audio/RotorSynth';
import { Sfx } from '../audio/Sfx';
import { Stingers } from '../audio/Stingers';
import { Contact } from '../flight/Contact';
import { FlightModel } from '../flight/FlightModel';
import { Hoist } from '../flight/Hoist';
import { Flares } from '../fx/Flares';
import { LandingGuide } from '../fx/LandingGuide';
import { RotorWash } from '../fx/RotorWash';
import { Searchlight } from '../fx/Searchlight';
import { Smoke } from '../fx/Smoke';
import { Tracers } from '../fx/Tracers';
import { Autopilot, type PilotPhase } from '../gameplay/Autopilot';
import { Passengers } from '../gameplay/Passengers';
import { Fuel } from '../gameplay/Fuel';
import { MissionManager } from '../gameplay/MissionManager';
import { Radio } from '../gameplay/Radio';
import { Threats } from '../gameplay/Threats';
import { missions } from '../gameplay/missions';
import type { MissionDef } from '../gameplay/types';
import { HueyModel } from '../heli/HueyModel';
import { CameraRig } from '../render/CameraRig';
import { Renderer } from '../render/Renderer';
import { Briefing } from '../ui/Briefing';
import { HUD, type HudModel } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { Results } from '../ui/Results';
import { TitleScreen } from '../ui/TitleScreen';
import { smoothstep } from '../util/math';
import { heightAt, sample } from '../world/heightfield';
import { classifyPad, layout } from '../world/layout';
import { World } from '../world/World';
import { Input } from './Input';
import { Loop } from './Loop';
import { noteMedal, persist, settings } from './save';
import { StateMachine } from './StateMachine';

const ASSIST = ['OFF', 'SAS', 'AUTO'] as const;

export class Game {
  private readonly input = new Input();
  private readonly fsm = new StateMachine();
  private readonly flight = new FlightModel();
  private readonly contact = new Contact();
  private readonly hoist = new Hoist();
  private readonly passengers = new Passengers();
  private readonly threats = new Threats();
  private readonly fuel = new Fuel();
  private readonly radio = new Radio();
  private readonly missions = new MissionManager();
  private readonly autopilot = new Autopilot();
  private readonly camera = new CameraRig();
  private renderer!: Renderer;
  private world!: World;
  private heli!: HueyModel;
  private audio!: AudioEngine;
  private music!: MusicManager;
  private rotor!: RotorSynth;
  private sfx!: Sfx;
  private stingers!: Stingers;
  private search!: Searchlight;
  private smoke!: Smoke;
  private wash!: RotorWash;
  private flares!: Flares;
  private tracers!: Tracers;
  private guide!: LandingGuide;
  private hoistLine!: Line;
  private litter!: Mesh;
  private readonly hud: HUD;
  private readonly title: TitleScreen;
  private readonly briefing: Briefing;
  private readonly results: Results;
  private readonly pause: PauseMenu;
  private loop!: Loop;
  private pending: MissionDef | null = null;
  private time = 0;
  private toast = '';
  private toastT = 0;
  private hintT = 0;
  private ended = false;
  private readonly renderPos = new Vector3();
  private readonly renderQuat = new Quaternion();
  private readonly hook = new Vector3();
  private readonly door = new Vector3();
  private readonly scratch = new Vector3();
  private titleIdle = 0;
  private pointerEdge = false;
  private demoRestartT = 0;
  private pilotPhase: PilotPhase = 'lift';
  private readonly demoBanner: HTMLElement;
  private readonly demoLine: HTMLElement;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    ui: HTMLElement,
  ) {
    this.hud = new HUD(ui);
    this.title = new TitleScreen(
      ui,
      (i) => this.openBriefing(i),
      () => this.startDemo(),
    );
    this.demoBanner = document.createElement('div');
    this.demoBanner.className = 'demo-banner hidden';
    const demoTitle = document.createElement('strong');
    demoTitle.textContent = 'Demo';
    this.demoLine = document.createElement('span');
    const demoHint = document.createElement('small');
    demoHint.textContent = 'Any key returns to the title';
    this.demoBanner.append(demoTitle, this.demoLine, demoHint);
    ui.append(this.demoBanner);
    this.briefing = new Briefing(
      ui,
      () => this.startMission(),
      () => this.showTitle(),
    );
    this.results = new Results(
      ui,
      () => this.openBriefing((this.pending?.index ?? 0) + 1),
      () => this.openBriefing(this.pending?.index ?? 0),
      () => this.showTitle(),
    );
    this.pause = new PauseMenu(ui, {
      resume: () => this.resume(),
      abort: () => this.showTitle(),
      assist: (n) => this.setAssist(n),
      volume: (n) => this.setVolume(n),
      quality: (q) => this.setQuality(q),
      mute: () => this.toggleMute(),
    });
    this.title.onAssist((n) => this.setAssist(n));
    this.title.onVolume((n) => this.setVolume(n));
  }

  async init(progress: (s: string) => void): Promise<void> {
    this.audio = new AudioEngine();
    this.audio.setVolume(settings.volume);
    this.audio.setMuted(settings.muted);
    this.music = new MusicManager(this.audio);
    this.rotor = new RotorSynth(this.audio);
    this.sfx = new Sfx(this.audio);
    this.stingers = new Stingers(this.audio);
    this.renderer = new Renderer(this.canvas, settings.quality);
    this.world = new World(this.renderer.gl, progress);
    this.heli = new HueyModel();
    this.search = new Searchlight(this.heli.search);
    this.world.scene.add(this.heli.root, this.passengers.mesh);
    this.smoke = new Smoke();
    this.wash = new RotorWash();
    this.flares = new Flares();
    this.tracers = new Tracers();
    this.guide = new LandingGuide();
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute(
      'position',
      new BufferAttribute(new Float32Array((config.hoist.segments + 1) * 3), 3),
    );
    this.hoistLine = new Line(lineGeo, new LineBasicMaterial({ color: 0x1a1a16 }));
    this.hoistLine.frustumCulled = false;
    this.litter = new Mesh(
      new BoxGeometry(0.7, 0.12, 1.3),
      new MeshStandardMaterial({ color: '#6d5a40', roughness: 0.8 }),
    );
    this.world.scene.add(
      this.smoke.points,
      this.wash.dust,
      this.wash.spray,
      this.flares.group,
      this.tracers.lines,
      this.guide.mesh,
      this.hoistLine,
      this.litter,
    );
    this.renderer.attach(this.world.scene, this.camera.camera, this.world.sunMesh);
    this.world.setQuality(settings.quality === 'high');
    this.camera.resize(window.innerWidth, window.innerHeight);
    progress('Tuning the radio…');
    await this.music.load(progress);
    this.input.attach();
    window.addEventListener('resize', () => {
      this.renderer.resize();
      this.camera.resize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('pointerdown', () => {
      this.pointerEdge = true;
      void this.unlock();
    });
    window.addEventListener(
      'wheel',
      () => {
        this.pointerEdge = true;
      },
      { passive: true },
    );
    this.showTitle();
  }

  start(): void {
    this.loop = new Loop(
      (dt) => this.tick(dt),
      (alpha, frameDt) => this.draw(alpha, frameDt),
    );
    this.loop.start();
  }

  private tick(dt: number): void {
    this.time += dt;
    const state = this.fsm.state;
    if (state === 'demo') {
      if (this.input.anyEdge()) this.showTitle();
      else this.simulate(dt);
      this.radio.update(dt);
      this.toastT = Math.max(0, this.toastT - dt);
      this.pointerEdge = false;
      return;
    }
    if (this.input.consume('KeyM')) this.toggleMute();
    if (this.input.consume('F3')) this.renderer.showStats = !this.renderer.showStats;
    if (state === 'title') {
      if (this.input.anyEdge() || this.pointerEdge) this.titleIdle = 0;
      else this.titleIdle += dt;
      for (let i = 0; i < 4; i++) {
        if (this.input.consume(`Digit${i + 1}`) && i < settings.unlocked) this.openBriefing(i);
      }
      if (this.fsm.state === 'title' && this.titleIdle >= config.demo.idleSeconds) this.startDemo();
    } else if (state === 'briefing') {
      if (this.input.consume('Enter')) this.startMission();
      if (this.input.consume('Escape')) this.showTitle();
    } else if (state === 'paused') {
      if (this.input.consume('Escape') || this.input.consume('KeyP')) this.resume();
    } else if (state === 'playing') {
      if (this.input.consume('Escape') || this.input.consume('KeyP')) this.hold();
      else this.simulate(dt);
    }
    this.radio.update(dt);
    this.toastT = Math.max(0, this.toastT - dt);
    this.pointerEdge = false;
  }

  private simulate(dt: number): void {
    const def = this.pending;
    if (!def) return;
    const demo = this.fsm.state === 'demo';
    if (demo) {
      const lz = this.missions.lz();
      const drop = this.passengers.waiting === 0 && this.passengers.aboard > 0;
      const target = drop ? layout.pads.hospital : lz;
      this.pilotPhase = this.autopilot.drive(
        this.flight,
        this.heli,
        this.passengers,
        target,
        drop,
        Boolean(this.missions.outcome),
      );
    } else {
      if (this.input.consume('KeyC')) this.camera.toggle();
      if (this.input.consume('KeyE')) this.heli.toggleDoors();
      if (this.input.consume('Space')) this.hoist.toggle();
      if (this.input.consume('KeyL')) this.search.toggle();
      this.flight.input.collective = this.input.axis('KeyS', 'KeyW');
      this.flight.input.pitch = this.input.axis('ArrowDown', 'ArrowUp');
      this.flight.input.roll = this.input.axis('KeyA', 'KeyD');
      this.flight.input.yaw = this.input.axis('ArrowRight', 'ArrowLeft');
    }
    this.flight.fuelOut = this.fuel.empty;
    this.flight.setMass(
      config.flight.emptyMass +
        this.fuel.amount * config.fuel.capacityKg +
        this.passengers.aboard * config.flight.paxKg,
    );
    this.flight.beginStep();
    this.flight.integrate(dt, this.world.weather.wind);
    const hit = this.contact.resolve(this.flight, dt, (x, z, r) => this.world.queryTrees(x, z, r));
    if (hit.impact > 0.85) this.sfx.thud(hit.impact);
    if (hit.message) this.flash(hit.message);
    this.heli.pose(this.flight.pos, this.flight.quat);
    const hook = this.heli.hook(this.hook);
    const lz = this.missions.lz();
    const dist = Math.hypot(this.flight.pos.x - lz.x, this.flight.pos.z - lz.z);
    const spd = Math.hypot(this.flight.vel.x, this.flight.vel.z);
    const pad = classifyPad(this.flight.pos.x, this.flight.pos.z, def.lzKey);
    const refueling = pad === 'base' && this.flight.grounded && this.flight.settled > 0.35;
    const low = this.fuel.update(dt, this.flight.collective, this.flight.rpm, refueling);
    if (low) this.sfx.beep();
    const wantHoist =
      def.mode === 'hoist' &&
      this.passengers.waiting > 0 &&
      this.passengers.aboard < this.passengers.capacity;
    const stable =
      wantHoist &&
      this.heli.doorAmount > 0.65 &&
      !this.flight.grounded &&
      dist < config.hoist.radius &&
      spd < config.hoist.maxSpeed &&
      this.flight.agl > config.hoist.minAgl &&
      this.flight.agl < config.hoist.maxAgl;
    this.hoist.update(dt, hook, stable);
    let justHoist = false;
    if (this.hoist.progress >= 1) {
      justHoist = wantHoist;
      this.hoist.retract();
    }
    this.scratch.set(lz.x, this.flight.pos.y, lz.z);
    const door = this.heli.nearestDoor(this.door, this.scratch);
    const boarded = this.passengers.update(dt, {
      door,
      doors: this.heli.doorAmount,
      settled: this.flight.settled,
      onHospital: pad === 'hospital',
      onLz: pad === 'lz' && def.mode === 'land',
      hoistComplete: justHoist,
    });
    if (boarded.expired) this.radio.say('Window closed on one of them.');
    if (boarded.unloaded === 'saved') this.sfx.blip();
    const shots = this.threats.update(dt, this.flight);
    for (const s of shots.shots) {
      this.tracers.shot(s.x0, s.y0, s.z0, s.x1, s.y1, s.z1, s.kind === 'flak');
    }
    if (shots.hit) this.flash('UNDER FIRE');
    this.missions.update(dt, {
      x: this.flight.pos.x,
      z: this.flight.pos.z,
      destroyed: this.flight.destroyed,
      fuelEmpty: this.fuel.empty,
      lowFuel: low,
      settled: this.flight.settled,
      onBase: pad === 'base',
      onHospital: pad === 'hospital',
      hot: this.threats.hot,
      aaWarn: shots.aaWarn,
      justBoarded: boarded.boarded,
      justHoist,
      damage: this.flight.damage,
      passengers: this.passengers,
      radio: this.radio,
    });
    if (demo && this.missions.outcome) {
      this.demoRestartT += dt;
      if (this.demoRestartT >= config.demo.restartHold) this.startDemo();
    } else if (this.missions.outcome && !this.ended) this.finish();
    this.hintT = Math.max(0, this.hintT - dt);
    if (refueling && this.fuel.amount < 0.995) this.flash('REFUELING');
    else if (def.mode === 'hoist' && this.flight.grounded && dist < 24)
      this.flash('NO CLEARING — HOIST');
    else if (
      pad === 'lz' &&
      def.mode === 'land' &&
      this.flight.settled > 0.4 &&
      this.heli.doorAmount < 0.4
    ) {
      this.flash('OPEN DOORS');
    } else if (this.flight.fuelOut) this.flash('ENGINE OUT');
  }

  private draw(alpha: number, frameDt: number): void {
    const state = this.fsm.state;
    const frameMs = frameDt * 1000;
    let wash = 0;
    let heliPos = this.flight.pos;
    if (state === 'title') {
      this.camera.orbit(this.time, 80, 30, 40, 640, 180);
      this.heli.update(frameDt, 0, 0);
    } else if (state === 'briefing') {
      const pad = layout.pads.base;
      const y = heightAt(pad.x, pad.z);
      this.camera.orbit(this.time, pad.x, y, pad.z, 78, 26);
      this.heli.pose(this.flight.pos, this.flight.quat);
      this.heli.update(frameDt, 0.45, 0);
    } else {
      const a = state === 'playing' || state === 'demo' ? alpha : 1;
      this.flight.renderPose(a, this.renderPos, this.renderQuat);
      this.heli.pose(this.renderPos, this.renderQuat);
      this.heli.update(frameDt, this.flight.rpm, this.flight.damage);
      if (state === 'demo')
        this.camera.cinematic(frameDt, this.time, this.pilotPhase, this.renderPos, this.renderQuat);
      else if (state === 'playing')
        this.camera.update(frameDt, this.flight, this.renderPos, this.renderQuat);
      heliPos = this.renderPos;
      wash = this.flight.rpm * this.flight.collective * (1 - smoothstep(3, 20, this.flight.agl));
      this.updateHoistLine();
      const surf = sample(this.renderPos.x, this.renderPos.z);
      this.wash.update(
        frameDt,
        this.renderPos.x,
        this.renderPos.y,
        this.renderPos.z,
        this.flight.agl,
        wash,
        surf.deep || surf.paddy > 0.45,
      );
      this.guide.update(
        this.renderPos.x,
        this.renderPos.z,
        this.flight.agl,
        this.flight.vel.y,
        Math.hypot(this.flight.vel.x, this.flight.vel.z),
        this.flight.slope,
        state === 'playing',
      );
    }
    this.demoLine.textContent = state === 'demo' ? this.radio.line : '';
    const night = this.pending?.time === 'night';
    this.search.apply(Boolean(night) && state !== 'title');
    this.smoke.update(frameDt, this.world.weather.wind.x, this.world.weather.wind.z);
    this.flares.update(frameDt);
    this.tracers.update(frameDt);
    const thunder = this.world.update(frameDt, this.camera.camera, this.renderer.gl, heliPos, wash);
    if (thunder && (state === 'playing' || state === 'demo')) this.sfx.thunder();
    this.pickMusic();
    this.audio.duck(this.radio.active ? config.audio.musicDuck : 1);
    const speed = Math.hypot(this.flight.vel.x, this.flight.vel.z);
    if (state === 'playing' || state === 'demo') {
      this.rotor.update(
        this.flight.rpm,
        this.flight.collective,
        speed,
        this.camera.mode === 'cockpit',
      );
      this.sfx.update(speed, Math.abs(this.hoist.deployed - this.hoist.target) > 0.02);
    }
    this.hud.update(this.hudModel(state));
    this.renderer.render(frameMs);
    this.input.endFrame();
  }

  private hudModel(state: string): HudModel {
    const playing = state === 'playing' || state === 'paused';
    const fwd = this.scratch.set(0, 0, 1).applyQuaternion(this.flight.quat);
    let heading = (Math.atan2(fwd.x, fwd.z) * 180) / Math.PI;
    if (heading < 0) heading += 360;
    const markers = [];
    if (playing && this.pending) {
      const lz = this.missions.lz();
      const spots = [
        { label: 'LZ', p: lz, primary: this.passengers.waiting > 0 },
        {
          label: 'AID',
          p: layout.pads.hospital,
          primary: this.passengers.waiting === 0 && this.passengers.aboard > 0,
        },
        { label: 'BASE', p: layout.pads.base, primary: false },
      ];
      for (const s of spots) {
        const to = new Vector3(s.p.x - this.flight.pos.x, 0, s.p.z - this.flight.pos.z);
        const dist = Math.hypot(to.x, to.z);
        const right = new Vector3(1, 0, 0).applyQuaternion(this.flight.quat);
        const rel = Math.atan2(to.dot(right), to.dot(fwd));
        markers.push({ label: s.label, rel, dist, primary: s.primary });
      }
    }
    const souls = this.passengers.souls.map((s, i) => ({
      label: `${s.civilian ? 'CIV' : 'GI'} ${i + 1} ${s.triage.toUpperCase()}`,
      triage: s.triage,
      timer: s.timer,
      state: s.state,
    }));
    const hint =
      playing && this.hintT > 0
        ? 'W/S lift   Arrows nose / yaw   A/D strafe   E doors   Space hoist'
        : '';
    return {
      visible: playing,
      agl: this.flight.agl,
      speedKt: Math.hypot(this.flight.vel.x, this.flight.vel.z) * 1.94384,
      fuel: this.fuel.amount,
      damage: this.flight.damage,
      collective: this.flight.collective,
      heading,
      assist: ASSIST[this.flight.stabilizer.level],
      subtitle: this.radio.line,
      toast: this.toastT > 0 ? this.toast : '',
      hint,
      stats: this.renderer.showStats
        ? `${this.renderer.fps} fps  calls ${this.renderer.gl.info.render.calls}  tris ${this.renderer.gl.info.render.triangles}`
        : '',
      hoist: this.hoist.deployed > 0.05 ? this.hoist.progress : null,
      aboard: this.passengers.aboard,
      capacity: this.passengers.capacity,
      souls,
      markers,
    };
  }

  private updateHoistLine(): void {
    const show = this.hoist.deployed > 0.04 && this.fsm.state !== 'title';
    this.hoistLine.visible = show;
    this.litter.visible = show;
    if (!show) return;
    const attr = this.hoistLine.geometry.getAttribute('position') as BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < this.hoist.points.length; i++) {
      const p = this.hoist.points[i]!;
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    attr.needsUpdate = true;
    this.litter.position.copy(this.hoist.tip);
  }

  private pickMusic(): void {
    const state = this.fsm.state;
    let track: TrackId | null = null;
    if (state === 'title' || state === 'briefing') track = 'title';
    else if (state === 'demo') track = 'flight';
    else if ((state === 'playing' || state === 'paused') && this.pending) {
      const lz = this.missions.lz();
      const nearHot =
        this.pending.smoke === 'red' &&
        Math.hypot(this.flight.pos.x - lz.x, this.flight.pos.z - lz.z) < 260;
      if (this.threats.hot || nearHot) track = 'hot';
      else if (this.pending.time === 'night') track = 'night';
      else track = 'flight';
    }
    this.music.play(track);
  }

  private openBriefing(index: number): void {
    const def = missions[index];
    if (!def || index >= settings.unlocked) return;
    void this.unlock();
    this.pending = def;
    this.ended = false;
    this.results.hide();
    this.pause.hide();
    this.title.hide();
    this.world.setTime(def.time, this.renderer.gl);
    this.world.weather.setMode(def.weather);
    this.placeAtBase(def);
    this.fuel.reset(def.startFuel);
    this.passengers.clear();
    this.threats.clear();
    this.smoke.set(0, 0, 'off', 0);
    this.flares.set(0, 0, 0, false);
    this.fsm.set('briefing');
    this.briefing.show(def);
  }

  private startMission(): void {
    const def = this.pending;
    if (!def) return;
    void this.unlock();
    this.placeAtBase(def);
    this.contact.reset();
    this.heli.pose(this.flight.pos, this.flight.quat);
    this.hoist.reset(this.heli.hook(this.hook));
    this.fuel.reset(def.startFuel);
    this.flight.stabilizer.level = def.assist ?? settings.assist;
    const lz = lzOf(def);
    this.passengers.load(def, lz);
    this.threats.configure(def.fire, def.aa);
    const gy = heightAt(lz.x, lz.z);
    this.smoke.set(lz.x, lz.z, def.smoke, gy);
    this.flares.set(lz.x, lz.z, gy, def.flares);
    this.search.on = def.time === 'night';
    this.missions.start(def, this.radio);
    this.ended = false;
    this.hintT = def.index === 0 ? 22 : 8;
    this.camera.mode = 'chase';
    this.camera.snap(this.flight.pos.clone().add(new Vector3(0, 8, -16)));
    this.briefing.hide();
    this.results.hide();
    this.pause.hide();
    this.fsm.set('playing');
  }

  private finish(): void {
    this.ended = true;
    const result = this.missions.result;
    if (!result || !this.pending) return;
    if (this.missions.outcome === 'complete') {
      noteMedal(this.pending.index, result.medal);
      this.stingers.complete();
      this.fsm.set('complete');
    } else {
      this.stingers.fail();
      this.fsm.set('failed');
    }
    this.results.show(
      result,
      this.passengers.saved,
      this.passengers.souls.length,
      this.missions.elapsed,
      this.flight.damage,
      this.missions.outcome === 'complete' && this.pending.index < 3,
    );
  }

  private hold(): void {
    this.fsm.set('paused');
    this.pause.show();
  }

  private resume(): void {
    this.pause.hide();
    if (this.pending) this.fsm.set('playing');
  }

  private startDemo(): void {
    const def = missions[0];
    if (!def) return;
    void this.unlock();
    this.pending = def;
    this.ended = false;
    this.demoRestartT = 0;
    this.titleIdle = 0;
    this.results.hide();
    this.pause.hide();
    this.briefing.hide();
    this.title.hide();
    this.world.setTime(def.time, this.renderer.gl);
    this.world.weather.setMode(def.weather);
    this.placeAtBase(def);
    this.flight.stabilizer.level = 1;
    this.contact.reset();
    this.heli.pose(this.flight.pos, this.flight.quat);
    this.hoist.reset(this.heli.hook(this.hook));
    this.fuel.reset(def.startFuel);
    const lz = lzOf(def);
    this.passengers.load(def, lz);
    this.threats.clear();
    const gy = heightAt(lz.x, lz.z);
    this.smoke.set(lz.x, lz.z, def.smoke, gy);
    this.flares.set(lz.x, lz.z, gy, false);
    this.search.on = false;
    this.missions.start(def, this.radio);
    this.pilotPhase = this.autopilot.reset();
    this.camera.mode = 'chase';
    this.camera.cinematic(0, this.time, this.pilotPhase, this.flight.pos, this.flight.quat, true);
    this.demoBanner.classList.remove('hidden');
    this.fsm.set('demo');
  }

  private showTitle(): void {
    this.fsm.set('title');
    this.titleIdle = 0;
    this.pending = null;
    this.briefing.hide();
    this.results.hide();
    this.pause.hide();
    this.demoBanner.classList.add('hidden');
    this.passengers.clear();
    this.threats.clear();
    this.smoke.set(0, 0, 'off', 0);
    this.flares.set(0, 0, 0, false);
    this.title.show();
    this.world.setTime('sunset', this.renderer.gl);
    this.world.weather.setMode('clear');
  }

  private placeAtBase(def: MissionDef): void {
    const pad = layout.pads.base;
    const y = heightAt(pad.x, pad.z) + config.flight.skidDrop + 0.08;
    const lz = lzOf(def);
    const yaw = Math.atan2(lz.x - pad.x, lz.z - pad.z);
    this.flight.spawn(pad.x, y, pad.z, yaw);
    this.flight.stabilizer.level = def.assist ?? settings.assist;
    this.heli.doorsOpen = false;
    this.heli.pose(this.flight.pos, this.flight.quat);
  }

  private flash(text: string): void {
    this.toast = text;
    this.toastT = 1.15;
  }

  private setAssist(level: 0 | 1 | 2): void {
    settings.assist = level;
    this.flight.stabilizer.level = level;
    persist();
  }

  private setVolume(v: number): void {
    settings.volume = v;
    this.audio.setVolume(v);
    persist();
  }

  private setQuality(q: 'low' | 'high'): void {
    settings.quality = q;
    this.world.setQuality(q === 'high');
    this.renderer.setQuality(q);
    persist();
  }

  private toggleMute(): void {
    settings.muted = !settings.muted;
    this.audio.setMuted(settings.muted);
    this.pause.refreshMute();
    persist();
  }

  private async unlock(): Promise<void> {
    await this.audio.resume();
    this.rotor.start();
    this.sfx.start();
  }
}

function lzOf(def: MissionDef): { x: number; z: number } {
  if (def.mode === 'hoist' && def.hoist) return def.hoist;
  if (def.lzKey) {
    const pad = layout.pads[def.lzKey];
    return { x: pad.x, z: pad.z };
  }
  return { x: layout.hoist.x, z: layout.hoist.z };
}
