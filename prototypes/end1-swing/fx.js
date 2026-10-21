// Visual effects: glow points (halos, particles), camera-facing ribbons (cable, trail, laser),
// machine "taken" outline flash, and the 2D speed-line overlay.
import * as THREE from 'three';

// ---------- Glow points: one draw call for many soft additive dots ----------
const GP_VERT = /* glsl */`
attribute float size;
attribute vec3 color;
uniform float uScale;
uniform float uMin;
uniform float uFar;
varying vec3 vColor;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = size * uScale / max(-mv.z, 0.1);
  gl_PointSize = size > 0.0 ? clamp(s, uMin, 300.0) : 0.0;
  float fade = uFar > 0.0 ? smoothstep(uFar, uFar * 0.45, -mv.z) : 1.0;
  if (size > 30.0) fade = 1.0;
  vColor = color * fade;
}`;
const GP_FRAG = /* glsl */`
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  if (r > 1.0) discard;
  float a = 1.0 - r;
  a = a * a * (0.55 + 0.45 * a) + smoothstep(0.35, 0.0, r) * 0.6;
  gl_FragColor = vec4(vColor * a, 1.0);
  #include <colorspace_fragment>
}`;

export class GlowPoints {
  constructor(capacity, minPx = 4) {
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 500 }, uMin: { value: minPx }, uFar: { value: 0 } },
      vertexShader: GP_VERT, fragmentShader: GP_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.geo = g;
  }
  set(i, p, c, s) {
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    if (c) { this.col[i * 3] = c.r; this.col[i * 3 + 1] = c.g; this.col[i * 3 + 2] = c.b; }
    if (s !== undefined) this.size[i] = s;
  }
  dirty() {
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}

// ---------- Particles ----------
export class Particles {
  constructor(scene, cap = 600) {
    this.gp = new GlowPoints(cap, 1.5);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.base = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.cols = new Float32Array(cap * 3);
    this.i = 0;
    scene.add(this.gp.points);
  }
  spawn(p, v, color, size, life, grav = 0) {
    const i = this.i; this.i = (this.i + 1) % this.gp.cap;
    this.gp.set(i, p, color, size);
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.cols[i * 3] = color.r; this.cols[i * 3 + 1] = color.g; this.cols[i * 3 + 2] = color.b;
    this.life[i] = life; this.max[i] = life; this.base[i] = size; this.grav[i] = grav;
  }
  burst(p, color, n, speed, size = 1.2, life = 0.6, grav = 0) {
    const v = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize()
        .multiplyScalar(speed * (0.3 + Math.random() * 0.7));
      this.spawn(p, v, color, size * (0.6 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), grav);
    }
  }
  update(dt) {
    const g = this.gp, P = g.pos;
    for (let i = 0; i < g.cap; i++) {
      if (this.life[i] <= 0) { g.size[i] = 0; continue; }
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.max[i]);
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      const drag = Math.exp(-2.5 * dt);
      this.vel[i * 3] *= drag; this.vel[i * 3 + 1] *= drag; this.vel[i * 3 + 2] *= drag;
      P[i * 3] += this.vel[i * 3] * dt; P[i * 3 + 1] += this.vel[i * 3 + 1] * dt; P[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      g.size[i] = this.base[i] * (0.3 + 0.7 * k);
      g.col[i * 3] = this.cols[i * 3] * k; g.col[i * 3 + 1] = this.cols[i * 3 + 1] * k; g.col[i * 3 + 2] = this.cols[i * 3 + 2] * k;
    }
    g.dirty();
  }
}

// ---------- Camera-facing ribbon through a list of points ----------
const _t = new THREE.Vector3(), _c = new THREE.Vector3(), _s = new THREE.Vector3();
export class Ribbon {
  constructor(scene, maxPts, { fog = true } = {}) {
    this.max = maxPts;
    this.pos = new Float32Array(maxPts * 2 * 3);
    this.col = new Float32Array(maxPts * 2 * 3);
    const idx = [];
    for (let i = 0; i < maxPts - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, fog,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }
  // pts: Vector3[]; colorAt(i) -> THREE.Color; widthAt(i) -> number
  build(pts, camPos, colorAt, widthAt) {
    const n = Math.min(pts.length, this.max);
    if (n < 2) { this.mesh.visible = false; return; }
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      _t.subVectors(b, a);
      _c.subVectors(camPos, p);
      _s.crossVectors(_t, _c);
      const l = _s.length();
      if (l < 1e-6) _s.set(0, 1, 0); else _s.multiplyScalar(1 / l);
      const w = widthAt(i) * 0.5;
      const o = i * 6;
      this.pos[o] = p.x + _s.x * w; this.pos[o + 1] = p.y + _s.y * w; this.pos[o + 2] = p.z + _s.z * w;
      this.pos[o + 3] = p.x - _s.x * w; this.pos[o + 4] = p.y - _s.y * w; this.pos[o + 5] = p.z - _s.z * w;
      const col = colorAt(i);
      this.col[o] = this.col[o + 3] = col.r; this.col[o + 1] = this.col[o + 4] = col.g; this.col[o + 2] = this.col[o + 5] = col.b;
    }
    this.geo.setDrawRange(0, (n - 1) * 6);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.mesh.visible = true;
  }
  hide() { this.mesh.visible = false; }
}

// ---------- Laser beams (short-lived straight ribbons) ----------
export class Beams {
  constructor(scene) {
    this.pool = [];
    for (let i = 0; i < 6; i++) this.pool.push({ r: new Ribbon(scene, 2, { fog: false }), t: 0, a: new THREE.Vector3(), b: new THREE.Vector3(), col: new THREE.Color() });
    this.k = 0;
  }
  fire(a, b, color) {
    const s = this.pool[this.k]; this.k = (this.k + 1) % this.pool.length;
    s.a.copy(a); s.b.copy(b); s.t = 0.13; s.col.copy(color);
  }
  update(dt, camPos) {
    const tmp = new THREE.Color();
    for (const s of this.pool) {
      if (s.t <= 0) { s.r.hide(); continue; }
      s.t -= dt;
      const k = Math.max(0, s.t / 0.13);
      tmp.copy(s.col).multiplyScalar(1.6 * k);
      s.r.build([s.a, s.b], camPos, () => tmp, (i) => (i === 0 ? 0.25 : 0.7) * (0.4 + k));
    }
  }
}

// ---------- Outline flash when a machine is taken ----------
export class Outlines {
  constructor(scene) {
    const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.pool = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5dff9a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; scene.add(m);
      this.pool.push({ m, t: 0, size: new THREE.Vector3() });
    }
    this.k = 0;
  }
  flash(center, size, yaw, color = 0x5dff9a) {
    const s = this.pool[this.k]; this.k = (this.k + 1) % this.pool.length;
    s.m.position.copy(center); s.m.rotation.set(0, yaw, 0); s.size.copy(size); s.t = 0.7;
    s.m.material.color.set(color); s.m.visible = true;
  }
  update(dt) {
    for (const s of this.pool) {
      if (!s.m.visible) continue;
      s.t -= dt;
      if (s.t <= 0) { s.m.visible = false; continue; }
      const k = s.t / 0.7;
      const g = 1 + (1 - k) * 0.12;
      s.m.scale.set(s.size.x * g, s.size.y * (1 + (1 - k) * 0.04), s.size.z * g);
      s.m.material.opacity = k;
    }
  }
}

// ---------- 2D speed lines overlay ----------
export class SpeedLines {
  constructor(canvas) {
    this.c = canvas; this.g = canvas.getContext('2d');
    this.lines = [];
    for (let i = 0; i < 46; i++) this.lines.push({ a: Math.random() * Math.PI * 2, r: Math.random(), s: 0.6 + Math.random() * 0.8 });
    this.resize();
  }
  resize() { this.c.width = innerWidth; this.c.height = innerHeight; }
  draw(intensity, dt, tint = '200,255,225') {
    const g = this.g, w = this.c.width, h = this.c.height;
    g.clearRect(0, 0, w, h);
    if (intensity <= 0.02) return;
    const cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy);
    g.lineCap = 'round';
    for (const l of this.lines) {
      l.r += dt * l.s * (1.5 + intensity * 3);
      if (l.r > 1) { l.r = 0.35 + Math.random() * 0.2; l.a = Math.random() * Math.PI * 2; }
      const r0 = R * l.r, r1 = r0 + R * 0.12 * intensity * l.s;
      const ca = Math.cos(l.a), sa = Math.sin(l.a);
      g.strokeStyle = `rgba(${tint},${0.32 * intensity * l.r})`;
      g.lineWidth = 1 + 2 * l.s * intensity;
      g.beginPath(); g.moveTo(cx + ca * r0, cy + sa * r0); g.lineTo(cx + ca * r1, cy + sa * r1); g.stroke();
    }
  }
}
