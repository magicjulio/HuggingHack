// Effects: pooled particles, expanding rings, beams, floating world text.
import * as THREE from 'three';
const V = THREE.Vector3;

export class Fx {
  constructor(scene, camera, glowTex) {
    this.scene = scene; this.camera = camera;
    const N = this.N = 1400;
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 4); this.size = new Float32Array(N);
    this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N);
    this.s0 = new Float32Array(N); this.grav = new Float32Array(N); this.drag = new Float32Array(N); this.alpha0 = new Float32Array(N);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('col', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    this.uScale = { value: 500 };
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: glowTex }, uScale: this.uScale },
      vertexShader: `attribute float size; attribute vec4 col; varying vec4 vC; uniform float uScale;
        void main(){ vC=col; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=min(256.0, size*uScale/max(0.1,-mv.z)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec4 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vC.rgb, vC.a*t.a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; scene.add(this.points);
    this.geo = g;

    // rings
    this.rings = [];
    const rg = new THREE.RingGeometry(0.8, 1, 40);
    for (let i = 0; i < 12; i++) {
      const r = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      r.visible = false; r.userData = { t: 0, life: 1, s: 1 }; scene.add(r); this.rings.push(r);
    }
    // floating text
    this.texts = [];
    const layer = document.getElementById('wtext');
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('div'); el.className = 'wt'; layer.appendChild(el);
      this.texts.push({ el, pos: new V(), t: 0, life: 0, active: false });
    }
    this._c = new THREE.Color(); this._v = new V();
  }
  setScale(h, fovDeg) { this.uScale.value = h / (2 * Math.tan(fovDeg * Math.PI / 360)); }

  spawn(p, vx, vy, vz, color, size, life, grav = 0, drag = 0, alpha = 1) {
    const i = this.next; this.next = (i + 1) % this.N;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    const c = this._c.set(color);
    this.col[i * 4] = c.r; this.col[i * 4 + 1] = c.g; this.col[i * 4 + 2] = c.b; this.col[i * 4 + 3] = alpha;
    this.alpha0[i] = alpha; this.s0[i] = size; this.size[i] = size;
    this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  burst(p, n, color, speed, size, life, grav = 0, drag = 2) {
    for (let k = 0; k < n; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = Math.sqrt(1 - u * u), sp = speed * (0.35 + Math.random() * 0.65);
      this.spawn(p, Math.cos(a) * s * sp, u * sp, Math.sin(a) * s * sp, color, size * (0.6 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), grav, drag);
    }
  }
  ring(p, normal, color, scale, life) {
    const r = this.rings.find(r => !r.visible) || this.rings[0];
    r.visible = true; r.position.copy(p); r.material.color.set(color);
    if (normal) r.lookAt(this._v.copy(p).add(normal)); else r.userData.face = true;
    r.userData.face = !normal; r.userData.t = 0; r.userData.life = life; r.userData.s = scale;
  }
  text(p, str, cls = '', life = 1.1) {
    const t = this.texts.find(t => !t.active) || this.texts[0];
    t.active = true; t.pos.copy(p); t.t = 0; t.life = life;
    t.el.textContent = str; t.el.className = 'wt ' + cls; t.el.style.display = 'block';
  }
  clear() {
    this.life.fill(0); for (let i = 0; i < this.N; i++) this.col[i * 4 + 3] = 0;
    for (const r of this.rings) r.visible = false;
    for (const t of this.texts) { t.active = false; t.el.style.display = 'none'; }
  }
  update(dt, w, h) {
    const P = this.pos, Vl = this.vel;
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.col[i * 4 + 3] = 0; this.size[i] = 0; continue; }
      const k = Math.exp(-this.drag[i] * dt);
      Vl[i * 3] *= k; Vl[i * 3 + 1] = Vl[i * 3 + 1] * k - this.grav[i] * dt; Vl[i * 3 + 2] *= k;
      P[i * 3] += Vl[i * 3] * dt; P[i * 3 + 1] += Vl[i * 3 + 1] * dt; P[i * 3 + 2] += Vl[i * 3 + 2] * dt;
      const f = this.life[i] / this.max[i];
      this.col[i * 4 + 3] = this.alpha0[i] * f; this.size[i] = this.s0[i] * (0.3 + 0.7 * f);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.col.needsUpdate = true; this.geo.attributes.size.needsUpdate = true;

    for (const r of this.rings) {
      if (!r.visible) continue;
      const u = r.userData; u.t += dt; const f = u.t / u.life;
      if (f >= 1) { r.visible = false; continue; }
      if (u.face) r.quaternion.copy(this.camera.quaternion);
      const e = 1 - Math.pow(1 - f, 3);
      r.scale.setScalar(0.3 + u.s * e); r.material.opacity = 1 - f;
    }
    for (const t of this.texts) {
      if (!t.active) continue;
      t.t += dt; const f = t.t / t.life;
      if (f >= 1) { t.active = false; t.el.style.display = 'none'; continue; }
      const v = this._v.copy(t.pos); v.y += f * 2.2; v.project(this.camera);
      if (v.z > 1) { t.el.style.display = 'none'; continue; }
      t.el.style.display = 'block';
      t.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%,-50%) scale(${1 + (f < 0.15 ? (0.15 - f) * 4 : 0)})`;
      t.el.style.opacity = f < 0.7 ? 1 : (1 - f) / 0.3;
    }
  }
}

// A glowing cylinder between two points; data dashes flow along it.
export class Beam {
  constructor(scene, color, coreR, glowR) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5);
    this.uniforms = { uT: { value: 0 }, uLen: { value: 1 }, uA: { value: 1 }, uC: { value: new THREE.Color(color) }, uFlow: { value: 1 } };
    const core = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform float uT,uLen,uA,uFlow; uniform vec3 uC; varying vec2 vUv;
        void main(){ float d = fract(vUv.y*uLen*0.35 + uT*uFlow*3.0); float dash = smoothstep(0.0,0.15,d)*smoothstep(0.6,0.4,d);
          gl_FragColor = vec4(mix(uC, vec3(1.0), 0.35*dash), uA*(0.65+0.35*dash)); }`,
    });
    this.core = new THREE.Mesh(geo, core);
    this.glow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.coreR = coreR; this.glowR = glowR;
    this.core.frustumCulled = this.glow.frustumCulled = false;
    scene.add(this.core, this.glow);
    this.hide();
  }
  set(a, b, alpha = 1, thick = 1) {
    const L = a.distanceTo(b); if (L < 0.01) { this.hide(); return; }
    for (const m of [this.core, this.glow]) { m.visible = true; m.position.copy(a); m.lookAt(b); }
    this.core.scale.set(this.coreR * thick, this.coreR * thick, L);
    this.glow.scale.set(this.glowR * thick, this.glowR * thick, L);
    this.uniforms.uLen.value = L; this.uniforms.uA.value = alpha; this.glow.material.opacity = 0.18 * alpha;
  }
  hide() { this.core.visible = this.glow.visible = false; }
}
