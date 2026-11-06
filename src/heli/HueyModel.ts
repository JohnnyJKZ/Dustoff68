import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  SpotLight,
  Vector3,
  MeshBasicMaterial,
  PointLight,
  BufferGeometry,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  AdditiveBlending,
} from 'three';
import { smoothstep } from '../util/math';
import { armyTextTexture, crossTexture, rotorBlurTexture } from './markings';
import { bladeAmount, blurAmount } from './RotorBlur';

const olive = () =>
  new MeshStandardMaterial({ color: '#4a5336', roughness: 0.58, metalness: 0.12 });
const whitePanel = () =>
  new MeshStandardMaterial({ color: '#efe8d6', roughness: 0.45, metalness: 0.04 });
const dark = () => new MeshStandardMaterial({ color: '#23261f', roughness: 0.55, metalness: 0.35 });
const glassMat = () =>
  new MeshStandardMaterial({
    color: '#9eb8b0',
    roughness: 0.05,
    metalness: 0.85,
    transparent: true,
    opacity: 0.28,
  });

export class HueyModel {
  readonly root = new Group();
  readonly searchTarget = new Object3D();
  readonly search: SpotLight;
  doorsOpen = false;
  doorAmount = 0;
  private readonly mainPivot = new Group();
  private readonly tailPivot = new Group();
  private readonly blur: Mesh;
  private readonly tailBlur: Mesh;
  private readonly blades: Mesh[] = [];
  private readonly doorL: Group;
  private readonly doorR: Group;
  private readonly hookLocal = new Vector3(1.15, -0.15, 0.35);
  private readonly doorLocalL = new Vector3(-1.25, -0.15, 0.45);
  private readonly doorLocalR = new Vector3(1.25, -0.15, 0.45);
  private readonly smoke: Points;

  constructor() {
    const body = olive();
    const shade = dark();
    const glass = glassMat();

    const cabin = new Mesh(new BoxGeometry(1.72, 1.28, 3.55), body);
    cabin.position.set(0, 0.12, 0.15);
    const roof = new Mesh(new BoxGeometry(2.2, 0.14, 3.7), body);
    roof.position.set(0, 0.78, 0.2);
    const band = new Mesh(new BoxGeometry(2.22, 0.36, 2.35), whitePanel());
    band.position.set(0, 0.48, 0.05);
    const nose = new Mesh(new SphereGeometry(0.98, 20, 14), body);
    nose.scale.set(1.08, 0.86, 1.45);
    nose.position.set(0, 0.02, 2.05);
    const belly = new Mesh(new BoxGeometry(1.55, 0.32, 3.1), shade);
    belly.position.set(0, -0.62, 0.25);
    const boom = new Mesh(new CylinderGeometry(0.14, 0.28, 7.4, 10), body);
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 0.46, -4.15);
    const fin = new Mesh(new BoxGeometry(0.1, 1.55, 0.85), body);
    fin.position.set(0, 1.15, -7.55);
    const stabL = new Mesh(new BoxGeometry(1.45, 0.07, 0.36), body);
    stabL.position.set(-0.78, 0.52, -7.15);
    const stabR = stabL.clone();
    stabR.position.x = 0.78;

    const pit = new Mesh(new SphereGeometry(0.95, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), glass);
    pit.scale.set(1.05, 0.72, 1.2);
    pit.position.set(0, 0.18, 2.55);
    const sideGlassL = new Mesh(new BoxGeometry(0.05, 0.62, 1.15), glass);
    sideGlassL.position.set(-1.02, 0.42, 1.7);
    const sideGlassR = sideGlassL.clone();
    sideGlassR.position.x = 1.02;
    const interior = new Mesh(new BoxGeometry(1.45, 0.9, 2.2), shade);
    interior.position.set(0, 0.05, -0.15);

    this.root.add(
      cabin,
      roof,
      band,
      nose,
      belly,
      boom,
      fin,
      stabL,
      stabR,
      pit,
      sideGlassL,
      sideGlassR,
      interior,
    );

    this.addSkid(-0.85);
    this.addSkid(0.85);

    const mast = new Mesh(new CylinderGeometry(0.12, 0.14, 1.1, 8), shade);
    mast.position.set(0, 1.35, 0.2);
    this.root.add(mast);
    this.mainPivot.position.set(0, 1.85, 0.2);
    const bladeGeo = new BoxGeometry(14.4, 0.05, 0.32);
    for (let i = 0; i < 2; i++) {
      const b = new Mesh(bladeGeo, shade);
      b.rotation.y = i * Math.PI;
      this.mainPivot.add(b);
      this.blades.push(b);
    }
    const hub = new Mesh(new CylinderGeometry(0.28, 0.28, 0.16, 10), shade);
    this.mainPivot.add(hub);
    this.blur = new Mesh(
      new PlaneGeometry(14.6, 14.6),
      new MeshBasicMaterial({
        map: rotorBlurTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.blur.rotation.x = -Math.PI / 2;
    this.blur.userData.noShadow = true;
    this.mainPivot.add(this.blur);
    this.root.add(this.mainPivot);

    this.tailPivot.position.set(0.18, 0.62, -7.7);
    this.tailBlur = new Mesh(
      new PlaneGeometry(1.7, 1.7),
      new MeshBasicMaterial({
        map: rotorBlurTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0,
      }),
    );
    this.tailBlur.rotation.y = Math.PI / 2;
    this.tailBlur.userData.noShadow = true;
    this.tailPivot.add(this.tailBlur);
    const tBlade = new BoxGeometry(0.16, 1.5, 0.08);
    for (let i = 0; i < 2; i++) {
      const b = new Mesh(tBlade, shade);
      b.rotation.x = i * Math.PI;
      this.tailPivot.add(b);
    }
    this.root.add(this.tailPivot);

    const crossMat = new MeshStandardMaterial({
      map: crossTexture(),
      transparent: true,
      roughness: 0.5,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const noseCross = new Mesh(new PlaneGeometry(0.72, 0.72), crossMat);
    noseCross.position.set(0, 0.08, 3.42);
    const doorCrossL = new Mesh(new PlaneGeometry(0.62, 0.62), crossMat);
    doorCrossL.position.set(-1.12, 0.48, 0.05);
    doorCrossL.rotation.y = -Math.PI / 2;
    const doorCrossR = doorCrossL.clone();
    doorCrossR.position.x = 1.12;
    doorCrossR.rotation.y = Math.PI / 2;
    const roofCross = new Mesh(new PlaneGeometry(0.85, 0.85), crossMat);
    roofCross.rotation.x = -Math.PI / 2;
    roofCross.position.set(0, 0.86, 0.15);
    this.root.add(noseCross, doorCrossL, doorCrossR, roofCross);

    const army = new Mesh(
      new PlaneGeometry(2.4, 0.28),
      new MeshStandardMaterial({ map: armyTextTexture(), roughness: 0.7 }),
    );
    army.position.set(0, 0.46, -4.4);
    army.rotation.y = Math.PI / 2;
    const army2 = army.clone();
    army2.rotation.y = -Math.PI / 2;
    army2.position.x = 0;
    this.root.add(army, army2);

    this.doorL = this.makeDoor(-1);
    this.doorR = this.makeDoor(1);
    this.root.add(this.doorL, this.doorR);

    this.seat(-0.35, 1.7);
    this.seat(0.35, 1.7);
    this.seat(-0.4, 0.2);
    this.seat(0.4, 0.2);
    const panel = new Mesh(new BoxGeometry(1.2, 0.35, 0.2), shade);
    panel.position.set(0, 0.05, 2.55);
    this.root.add(panel);
    for (let i = 0; i < 4; i++) {
      const lamp = new Mesh(
        new SphereGeometry(0.035, 6, 6),
        new MeshBasicMaterial({ color: i % 2 ? '#7dff6a' : '#ffb15a' }),
      );
      lamp.position.set(-0.35 + i * 0.22, 0.12, 2.66);
      this.root.add(lamp);
    }

    this.nav(-1.05, 0.2, 0.8, '#ff3030');
    this.nav(1.05, 0.2, 0.8, '#30ff60');
    this.nav(0, 1.35, -7.7, '#fff6d0');

    this.search = new SpotLight('#fff3cc', 0, 170, 0.42, 0.4, 1);
    this.search.position.set(0, -0.15, 2.6);
    this.searchTarget.position.set(0, -12, 22);
    this.search.target = this.searchTarget;
    this.search.castShadow = false;
    this.root.add(this.search, this.searchTarget);
    const beacon = new PointLight('#ff5530', 0, 8);
    beacon.position.set(0, 1.1, -0.4);
    this.root.add(beacon);
    this.root.userData.beacon = beacon;

    const smokeGeo = new BufferGeometry();
    const sp = new Float32Array(40 * 3);
    smokeGeo.setAttribute('position', new Float32BufferAttribute(sp, 3));
    this.smoke = new Points(
      smokeGeo,
      new PointsMaterial({
        color: '#222',
        size: 0.45,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.smoke.position.set(0, 0.4, -1.2);
    this.root.add(this.smoke);

    this.root.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && !m.userData.noShadow) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.blur.castShadow = false;
  }

  private addSkid(x: number): void {
    const mat = dark();
    const skid = new Mesh(new BoxGeometry(0.14, 0.08, 3.3), mat);
    skid.position.set(x, -1.42, 0.15);
    const strutA = new Mesh(new CylinderGeometry(0.045, 0.045, 0.7, 5), mat);
    strutA.position.set(x, -1.05, 1.15);
    const strutB = strutA.clone();
    strutB.position.set(x, -1.05, -0.75);
    this.root.add(skid, strutA, strutB);
  }

  private makeDoor(side: number): Group {
    const pivot = new Group();
    pivot.position.set(side * 1.03, 0.12, 1.2);
    const door = new Mesh(new BoxGeometry(0.06, 1.2, 1.4), olive());
    door.position.set(0, 0, -0.55);
    pivot.add(door);
    return pivot;
  }

  private seat(x: number, z: number): void {
    const cushion = new Mesh(new BoxGeometry(0.42, 0.08, 0.42), dark());
    cushion.position.set(x, -0.42, z);
    const back = new Mesh(new BoxGeometry(0.42, 0.46, 0.06), dark());
    back.position.set(x, -0.12, z - 0.18);
    this.root.add(cushion, back);
  }

  private nav(x: number, y: number, z: number, color: string): void {
    const lamp = new Mesh(new SphereGeometry(0.055, 6, 6), new MeshBasicMaterial({ color }));
    lamp.position.set(x, y, z);
    lamp.userData.noShadow = true;
    this.root.add(lamp);
  }

  toggleDoors(): void {
    this.doorsOpen = !this.doorsOpen;
  }

  setSearch(on: boolean, night: boolean): void {
    this.search.intensity = on && night ? 5500 : on ? 800 : 0;
    const beacon = this.root.userData.beacon as PointLight;
    beacon.intensity = night ? 1.4 + Math.sin(performance.now() * 0.01) * 0.8 : 0.15;
  }

  update(dt: number, rpm: number, damage: number): void {
    this.mainPivot.rotation.y += rpm * 33 * dt;
    this.tailPivot.rotation.x += rpm * 95 * dt;
    const blur = blurAmount(rpm);
    const blades = bladeAmount(rpm);
    (this.blur.material as MeshBasicMaterial).opacity = blur * 0.92;
    (this.tailBlur.material as MeshBasicMaterial).opacity = blur * 0.75;
    for (const b of this.blades) b.visible = blades > 0.08;
    this.doorAmount += ((this.doorsOpen ? 1 : 0) - this.doorAmount) * Math.min(1, dt * 6);
    this.doorL.rotation.y = -this.doorAmount * 1.25;
    this.doorR.rotation.y = this.doorAmount * 1.25;
    const mat = this.smoke.material as PointsMaterial;
    mat.opacity = smoothstep(40, 80, damage) * 0.45;
    if (mat.opacity > 0.02) {
      const arr = this.smoke.geometry.getAttribute('position');
      const a = arr.array as Float32Array;
      for (let i = 0; i < 40; i++) {
        a[i * 3 + 1] += dt * (1.2 + (i % 5) * 0.15);
        a[i * 3] += Math.sin(i + performance.now() * 0.001) * dt * 0.2;
        if (a[i * 3 + 1] > 3) {
          a[i * 3] = (Math.random() - 0.5) * 0.4;
          a[i * 3 + 1] = 0;
          a[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
        }
      }
      arr.needsUpdate = true;
    }
  }

  pose(pos: Vector3, quat: Quaternion): void {
    this.root.position.copy(pos);
    this.root.quaternion.copy(quat);
  }

  hook(out: Vector3): Vector3 {
    this.root.updateWorldMatrix(true, false);
    return this.root.localToWorld(out.copy(this.hookLocal));
  }

  nearestDoor(out: Vector3, world: Vector3): Vector3 {
    this.root.updateWorldMatrix(true, false);
    const left = _doorL.copy(this.doorLocalL);
    const right = _doorR.copy(this.doorLocalR);
    this.root.localToWorld(left);
    this.root.localToWorld(right);
    return out.copy(world.distanceToSquared(right) < world.distanceToSquared(left) ? right : left);
  }
}

const _doorL = new Vector3();
const _doorR = new Vector3();

export function doorOpenAmount(heli: HueyModel): number {
  return heli.doorAmount;
}
