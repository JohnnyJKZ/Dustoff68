import { Mesh, MeshBasicMaterial, RingGeometry, Vector3 } from 'three';
import { sample } from '../world/heightfield';

export class LandingGuide {
  readonly mesh: Mesh;
  private readonly mat: MeshBasicMaterial;

  constructor() {
    this.mat = new MeshBasicMaterial({
      color: '#9be07a',
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.mesh = new Mesh(new RingGeometry(5.2, 6.4, 28), this.mat);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.renderOrder = 3;
  }

  update(
    x: number,
    z: number,
    agl: number,
    vy: number,
    speed: number,
    slope: number,
    show: boolean,
  ): void {
    if (!show || agl > 55 || agl < 0.4) {
      this.mat.opacity = 0;
      return;
    }
    const s = sample(x, z);
    this.mesh.position.set(x, s.height + 0.35, z);
    this.mesh.quaternion.setFromUnitVectors(_up, s.normal);
    const safe = vy > -2.2 && speed < 5 && slope < 0.22 && !s.deep;
    this.mat.color.set(safe ? '#9be07a' : '#e25a3a');
    this.mat.opacity = 0.55 * (1 - agl / 55);
  }
}

const _up = new Vector3(0, 1, 0);
