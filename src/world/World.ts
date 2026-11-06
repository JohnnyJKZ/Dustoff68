import {
  AmbientLight,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  PMREMGenerator,
  Mesh,
  SphereGeometry,
  MeshBasicMaterial,
  Group,
} from 'three';
import type { TimePreset } from '../config';
import { shared } from '../render/uniforms';
import { heightAt } from './heightfield';
import { initWorld } from './heightfield';
import { Landmarks } from './Landmarks';
import { Mist } from './Mist';
import { Sky } from './Sky';
import { Terrain } from './Terrain';
import { applyTime, type SkyPreset } from './TimeOfDay';
import { Vegetation, type TreeHit } from './Vegetation';
import { Water } from './Water';
import { Weather } from './Weather';
import { layout } from './layout';

export class World {
  readonly scene = new Scene();
  readonly sun: DirectionalLight;
  readonly sunMesh: Mesh;
  readonly weather: Weather;
  readonly vegetation: Vegetation;
  readonly water: Water;
  private readonly sky: Sky;
  private readonly hemi: HemisphereLight;
  private readonly ambient: AmbientLight;
  private readonly terrain: Terrain;
  private preset: SkyPreset;
  private pmrem: PMREMGenerator | null = null;
  private readonly content = new Group();

  constructor(renderer: WebGLRenderer, onProgress: (s: string) => void) {
    onProgress('Reading the map…');
    initWorld();
    this.scene.fog = new FogExp2('#c4783a', 0.0011);
    this.sun = new DirectionalLight('#ff9a3a', 4.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 8;
    this.sun.shadow.camera.far = 420;
    this.sun.shadow.camera.left = -110;
    this.sun.shadow.camera.right = 110;
    this.sun.shadow.camera.top = 110;
    this.sun.shadow.camera.bottom = -110;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);

    this.hemi = new HemisphereLight('#ffb56a', '#1a2412', 0.85);
    this.ambient = new AmbientLight('#fff4e5', 0.28);
    this.scene.add(this.hemi, this.ambient);

    this.sky = new Sky();
    this.scene.add(this.sky.mesh);

    this.sunMesh = new Mesh(
      new SphereGeometry(40, 16, 12),
      new MeshBasicMaterial({
        color: '#fff1c4',
        fog: false,
        transparent: true,
        opacity: 1,
        depthWrite: false,
      }),
    );
    this.sunMesh.frustumCulled = false;
    this.sunMesh.name = 'sunDisc';
    this.scene.add(this.sunMesh);

    onProgress('Folding the hills…');
    this.terrain = new Terrain();
    const base = layout.pads.base;
    this.terrain.prewarm(base.x, base.z);
    this.content.add(this.terrain.group);

    this.preset = applyTime('sunset', this.sun, this.hemi, this.ambient);
    this.sky.apply(this.preset);
    (this.scene.fog as FogExp2).color.set(this.preset.fog);

    onProgress('Flooding the paddies…');
    this.pmrem = new PMREMGenerator(renderer);
    const env = this.bakeEnv();
    this.scene.environment = env;
    this.water = new Water(env);
    this.content.add(this.water.mesh);

    onProgress('Raising the jungle…');
    this.vegetation = new Vegetation(renderer);
    for (const m of this.vegetation.meshes) this.content.add(m);

    onProgress('Staking the camps…');
    const landmarks = new Landmarks();
    this.content.add(landmarks.group);
    const mist = new Mist();
    for (const m of mist.meshes) this.content.add(m);
    this.weather = new Weather();
    this.content.add(this.weather.points);
    this.scene.add(this.content);
  }

  private bakeEnv() {
    const bake = new Scene();
    bake.add(this.sky.mesh.clone());
    return this.pmrem!.fromScene(bake, 0.04).texture;
  }

  setTime(id: TimePreset, renderer: WebGLRenderer): void {
    this.preset = applyTime(id, this.sun, this.hemi, this.ambient);
    this.sky.apply(this.preset);
    (this.scene.fog as FogExp2).color.set(this.preset.fog);
    this.water.setNight(id === 'night' ? 1 : 0);
    const env = this.bakeEnv();
    this.scene.environment = env;
    this.water.setEnv(env);
    void renderer;
  }

  setQuality(high: boolean): void {
    this.water.setQuality(high);
    this.vegetation.setDensity(high ? 1 : 0.55);
    const size = high ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null;
  }

  queryTrees(x: number, z: number, r: number): TreeHit[] {
    return this.vegetation.query(x, z, r);
  }

  update(
    dt: number,
    camera: PerspectiveCamera,
    renderer: WebGLRenderer,
    heli: Vector3,
    wash: number,
  ): boolean {
    shared.uTime.value += dt;
    shared.uHeliPos.value.copy(heli);
    shared.uWash.value = wash;
    shared.uCamPos.value.copy(camera.position);
    this.sky.update(
      dt,
      camera.position.x,
      camera.position.y,
      camera.position.z,
      this.weather.flash,
    );
    this.terrain.update(camera.position.x, camera.position.z);
    this.vegetation.update(camera.position.x, camera.position.z);
    const struck = this.weather.update(dt);

    const follow = heli.lengthSq() > 1 ? heli : camera.position;
    this.sun.position.copy(follow).addScaledVector(shared.uSunDir.value, 180);
    this.sun.target.position.copy(follow);
    this.sunMesh.position.copy(follow).addScaledVector(shared.uSunDir.value, 1400);

    const waterY = heightAt(camera.position.x, camera.position.z);
    this.water.updateReflection(renderer, this.scene, camera, Math.min(waterY, 12));
    return struck;
  }
}
