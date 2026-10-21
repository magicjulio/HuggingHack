// Third-person camera: over-the-shoulder, lags a little at speed, widens FOV, leans in swings.
import * as THREE from 'three';
import { rayColliders } from './world.js';

const SENS = 0.0022;
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class CamRig {
  constructor(game) {
    this.game = game;
    this.cam = game.camera;
    this.yaw = 0; this.pitch = 0.16;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.flatForward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.focus = new THREE.Vector3();
    this.fov = 72; this.kickV = 0; this.shakeV = 0; this.roll = 0; this.dist = 6.5;
  }
  look(dx, dy) {
    this.yaw -= dx * SENS;
    this.pitch = Math.max(-1.35, Math.min(1.25, this.pitch - dy * SENS));
    this.updateAxes();
  }
  setYawTo(from, to) {
    this.yaw = Math.atan2(-(to.x - from.x), -(to.z - from.z));
    this.pitch = -0.08;
    this.updateAxes();
  }
  updateAxes() {
    const cp = Math.cos(this.pitch);
    this.forward.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    this.flatForward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }
  kick(deg) { this.kickV = Math.max(this.kickV, deg); }
  shake(a) { this.shakeV = Math.min(1, Math.max(this.shakeV, a)); }
  snap(p) { this.focus.copy(p); }
  update(dt) {
    const p = this.game.player;
    const sp = p.speed;
    // follow with a speed-dependent lag (the orb pulls ahead when you go fast)
    // while zipping into the core the camera holds still and watches you go
    const k = p.finishing ? 0 : 1 - Math.exp(-(p.alive ? 22 : 4) * dt);
    this.focus.lerp(p.pos, k);
    const targetDist = 6.2 + Math.min(4, sp * 0.04) + (p.sail ? 1.5 : 0);
    this.dist += (targetDist - this.dist) * Math.min(1, dt * 4);
    const up = 1.05;
    _a.copy(this.focus);
    _a.y += up;
    _a.addScaledVector(this.right, 1.0);           // shoulder offset: crosshair is not on the orb
    const want = _b.copy(_a).addScaledVector(this.forward, -this.dist);
    // keep the camera out of machines
    _a.copy(this.focus); _a.y += up;
    const dir = want.clone().sub(_a); const len = dir.length(); dir.multiplyScalar(1 / len);
    const hit = rayColliders(this.game.world, _a, dir, len);
    if (hit) want.copy(_a).addScaledVector(dir, Math.max(0.6, hit.t - 0.5));
    if (want.y < 0.6) want.y = 0.6;
    this.cam.position.copy(want);
    // shake
    if (this.shakeV > 0.001) {
      const s = this.shakeV * this.shakeV * 0.9;
      this.cam.position.x += (Math.random() - 0.5) * s;
      this.cam.position.y += (Math.random() - 0.5) * s;
      this.cam.position.z += (Math.random() - 0.5) * s;
      this.shakeV *= Math.exp(-7 * dt);
    }
    this.cam.lookAt(_a.copy(this.cam.position).add(this.forward));
    // lean into sideways swings while tethered
    const lat = p.attached ? p.vel.dot(this.right) : 0;
    const rollT = Math.max(-0.14, Math.min(0.14, -lat * 0.004));
    this.roll += (rollT - this.roll) * Math.min(1, dt * 5);
    this.cam.rotateZ(this.roll);
    // FOV: speed + sling kick
    this.kickV *= Math.exp(-4 * dt);
    const fovT = 72 + Math.max(0, Math.min(24, (sp - 14) * 0.38)) + this.kickV;
    this.fov += (fovT - this.fov) * Math.min(1, dt * 6);
    if (Math.abs(this.cam.fov - this.fov) > 0.01) { this.cam.fov = this.fov; this.cam.updateProjectionMatrix(); }
  }
}
