// Sparks, ripples and camera-facing ribbons (trail, tether, laser).
import * as THREE from 'three';
import { glowTex } from './textures.js';

export class Fx {
  constructor(scene) {
    this.scene = scene;
    const N = this.N = 700;
    this.p = new Float32Array(N * 3); this.v = new Float32Array(N * 3);
    this.c0 = new Float32Array(N * 3); this.col = new Float32Array(N * 3);
    this.life = new Float32Array(N); this.max = new Float32Array(N); this.grav = new Float32Array(N);
    this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.7, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let k = 0; k < N; k++) this.p[k * 3 + 1] = -999;
    // ripple rings
    this.rings = [];
    const rg = new THREE.RingGeometry(0.85, 1, 48);
    for (let k = 0; k < 14; k++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; scene.add(m);
      this.rings.push({ m, t: 0, dur: 1, size: 1 });
    }
    this.ri = 0;
  }
  burst(pos, color, count = 20, speed = 10, life = 0.6, grav = 0, dir = null, spread = 1) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.i; this.i = (this.i + 1) % this.N;
      let vx = Math.random() * 2 - 1, vy = Math.random() * 2 - 1, vz = Math.random() * 2 - 1;
      const l = Math.hypot(vx, vy, vz) || 1;
      vx /= l; vy /= l; vz /= l;
      if (dir) { vx = dir.x + vx * spread; vy = dir.y + vy * spread; vz = dir.z + vz * spread; }
      const s = speed * (0.4 + Math.random() * 0.6);
      this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z;
      this.v[i * 3] = vx * s; this.v[i * 3 + 1] = vy * s; this.v[i * 3 + 2] = vz * s;
      this.c0[i * 3] = c.r; this.c0[i * 3 + 1] = c.g; this.c0[i * 3 + 2] = c.b;
      this.life[i] = this.max[i] = life * (0.6 + Math.random() * 0.4);
      this.grav[i] = grav;
    }
  }
  ripple(pos, normal, color, size = 6, dur = 0.5) {
    const r = this.rings[this.ri]; this.ri = (this.ri + 1) % this.rings.length;
    r.m.visible = true; r.m.position.copy(pos);
    r.m.lookAt(pos.clone().add(normal));
    r.m.material.color.set(color);
    r.t = 0; r.dur = dur; r.size = size;
  }
  update(dt) {
    const { p, v, col, c0, life, max, grav } = this;
    for (let i = 0; i < this.N; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const k = Math.max(0, life[i] / max[i]);
      v[i * 3 + 1] -= grav[i] * dt;
      const drag = Math.exp(-2.5 * dt);
      v[i * 3] *= drag; v[i * 3 + 1] *= drag; v[i * 3 + 2] *= drag;
      p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      col[i * 3] = c0[i * 3] * k; col[i * 3 + 1] = c0[i * 3 + 1] * k; col[i * 3 + 2] = c0[i * 3 + 2] * k;
      if (life[i] <= 0) { p[i * 3 + 1] = -999; }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    for (const r of this.rings) {
      if (!r.m.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.m.visible = false; continue; }
      const s = r.size * (0.2 + 0.8 * (1 - (1 - k) * (1 - k)));
      r.m.scale.set(s, s, s);
      r.m.material.opacity = (1 - k) * 0.9;
    }
  }
}

// A flat strip that always faces the camera. Width and colour per point.
export class Ribbon {
  constructor(scene, n, { blending = THREE.AdditiveBlending, fog = true } = {}) {
    this.n = n;
    this.pos = new Float32Array(n * 2 * 3);
    this.col = new Float32Array(n * 2 * 3);
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false,
      blending, side: THREE.DoubleSide, fog }));
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this._t = new THREE.Vector3(); this._s = new THREE.Vector3(); this._v = new THREE.Vector3();
  }
  // pts: array of Vector3 (length n), width(i)->number, color(i)->THREE.Color
  set(pts, camPos, width, color) {
    const { pos, col, n } = this;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      this._t.subVectors(b, a);
      if (this._t.lengthSq() < 1e-8) this._t.set(0, 1, 0);
      this._v.subVectors(camPos, p);
      this._s.crossVectors(this._t, this._v).normalize().multiplyScalar(width(i) * 0.5);
      pos[i * 6] = p.x + this._s.x; pos[i * 6 + 1] = p.y + this._s.y; pos[i * 6 + 2] = p.z + this._s.z;
      pos[i * 6 + 3] = p.x - this._s.x; pos[i * 6 + 4] = p.y - this._s.y; pos[i * 6 + 5] = p.z - this._s.z;
      const c = color(i);
      col[i * 6] = col[i * 6 + 3] = c.r; col[i * 6 + 1] = col[i * 6 + 4] = c.g; col[i * 6 + 2] = col[i * 6 + 5] = c.b;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}
