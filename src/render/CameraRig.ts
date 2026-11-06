import { PerspectiveCamera, Quaternion, Vector3 } from 'three';
import { config } from '../config';
import type { FlightModel } from '../flight/FlightModel';
import { heightAt } from '../world/heightfield';

export class CameraRig {
  readonly camera = new PerspectiveCamera(60, 1, 0.2, 14000);
  mode: 'chase' | 'cockpit' = 'chase';
  private readonly chase = new Vector3(0, 30, -40);
  private readonly desired = new Vector3();
  private readonly look = new Vector3();
  private readonly forward = new Vector3();
  private readonly offset = new Vector3();
  private bob = 0;

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  toggle(): void {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    this.camera.near = this.mode === 'cockpit' ? 0.06 : 0.2;
    this.camera.updateProjectionMatrix();
  }

  snap(pos: Vector3): void {
    this.chase.copy(pos);
  }

  update(dt: number, flight: FlightModel, pos: Vector3, quat: Quaternion): void {
    if (this.mode === 'cockpit') {
      this.bob += dt;
      this.offset.set(config.camera.cockpit[0], config.camera.cockpit[1], config.camera.cockpit[2]);
      this.offset.applyQuaternion(quat).add(pos);
      this.offset.y += Math.sin(this.bob * 18) * 0.012 * (0.4 + flight.rpm);
      this.camera.position.copy(this.offset);
      this.forward.set(0, 0, 1).applyQuaternion(quat);
      this.camera.up.set(0, 1, 0).applyQuaternion(quat);
      this.look.copy(this.camera.position).add(this.forward);
      this.camera.lookAt(this.look);
      return;
    }
    this.camera.up.set(0, 1, 0);
    this.desired.set(0, config.camera.chaseHeight, -config.camera.chaseDist);
    this.desired.applyQuaternion(quat).add(pos);
    const floor = heightAt(this.desired.x, this.desired.z) + 1.8;
    if (this.desired.y < floor) this.desired.y = floor;
    const k = 1 - Math.exp(-config.camera.chaseLambda * dt);
    this.chase.lerp(this.desired, k);
    this.camera.position.copy(this.chase);
    this.look.copy(pos);
    this.look.y += config.camera.chaseLook;
    this.camera.lookAt(this.look);
    this.camera.rotateZ(-flight.roll * 0.25);
  }

  orbit(time: number, x: number, y: number, z: number, radius: number, height: number): void {
    const a = time * 0.08;
    this.camera.up.set(0, 1, 0);
    this.camera.position.set(x + Math.sin(a) * radius, y + height, z + Math.cos(a) * radius);
    this.camera.lookAt(x, y + 4, z);
  }
}
