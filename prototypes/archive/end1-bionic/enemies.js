// Safety measures: scanner sweeps, the cluster scan line, antivirus drones and their pulses.
import * as THREE from 'three';
const V = THREE.Vector3;

const sheetVS = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const sheetFS = `uniform float uT, uA; uniform vec3 uC; varying vec2 vUv;
  void main(){
    float lines = 0.55 + 0.45*sin(vUv.y*120.0 - uT*14.0);
    float edge = smoothstep(0.93, 1.0, vUv.y) * 1.6;
    float fade = 1.0 - smoothstep(0.9, 1.0, vUv.x);
    gl_FragColor = vec4(uC, uA*fade*(0.16*lines + edge*0.6 + 0.08));
  }`;

function wrapPi(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

export class Enemies {
  constructor(scene, world, fx, sfx) {
    this.scene = scene; this.world = world; this.fx = fx; this.sfx = sfx;
    this.time = { value: 0 };
    this.scanners = []; this.scanlines = []; this.drones = []; this.pulses = [];
    const red = new THREE.Color(0xff2a48);

    for (const s of world.scannerSpecs) {
      const g = new THREE.Group(); g.position.copy(s.pos); scene.add(g);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2, 0.8, 16), new THREE.MeshLambertMaterial({ color: 0x2a2e36 }));
      base.position.y = 0.4; g.add(base);
      const domeMat = new THREE.MeshLambertMaterial({ color: 0x3a1018, emissive: 0xff2040, emissiveIntensity: 0.5 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      dome.position.y = 0.8; g.add(dome);
      const head = new THREE.Group(); head.position.y = 1.4; g.add(head);
      const lens = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xff4060 }));
      lens.position.x = 1.0; head.add(lens);
      const H = s.pos.y + 4;
      const u = { uT: this.time, uA: { value: 1 }, uC: { value: red } };
      const sheetGeo = new THREE.PlaneGeometry(s.R, H); sheetGeo.translate(s.R / 2, H / 2 - s.pos.y, 0);
      const sheet = new THREE.Mesh(sheetGeo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: sheetVS, fragmentShader: sheetFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      sheet.frustumCulled = false; head.add(sheet); sheet.position.y = -1.4;
      const ring = new THREE.Mesh(new THREE.RingGeometry(s.R - 0.6, s.R, 72), new THREE.MeshBasicMaterial({ color: 0xff2a48, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(s.pos.x, 0.08, s.pos.z); scene.add(ring);
      this.scanners.push({ spec: s, g, head, sheet, dome, domeMat, ring, a: Math.random() * 6.28, prevA: 0, hp: 3, alive: true, H, flash: 0 });
    }

    for (const s of world.scanlineSpecs) {
      const w = s.x1 - s.x0, d = s.z1 - s.z0;
      const geo = new THREE.PlaneGeometry(w, d); geo.rotateX(-Math.PI / 2);
      const u = { uT: this.time, uA: { value: 0.9 }, uC: { value: red } };
      const fs = `uniform float uT,uA; uniform vec3 uC; varying vec2 vUv; void main(){ float l=0.6+0.4*sin(vUv.x*300.0-uT*20.0); float f=smoothstep(0.0,0.3,vUv.y); gl_FragColor=vec4(uC, uA*(0.10+0.25*f)*l); }`;
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, vertexShader: sheetVS, fragmentShader: fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.position.set((s.x0 + s.x1) / 2, s.y0, (s.z0 + s.z1) / 2); m.frustumCulled = false; scene.add(m);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.6), new THREE.MeshBasicMaterial({ color: 0xff4060, fog: false }));
      edge.position.set((s.x0 + s.x1) / 2, s.y0, s.z0 + 0.3); scene.add(edge);
      this.scanlines.push({ spec: s, m, edge, y: s.y0, prevY: s.y0, dir: 1 });
    }

    const droneGeo = new THREE.OctahedronGeometry(0.95, 0);
    const ringGeo = new THREE.TorusGeometry(1.55, 0.08, 6, 32);
    for (const d of world.droneSpecs) {
      const g = new THREE.Group(); g.position.copy(d.pos); scene.add(g);
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a0a10, emissive: 0xff2a48, emissiveIntensity: 0.6 });
      const body = new THREE.Mesh(droneGeo, bodyMat); g.add(body);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xff4a64 })); g.add(ring);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.glowTex, color: 0xff3050, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      halo.scale.setScalar(5); g.add(halo);
      this.drones.push({ home: d.pos.clone(), g, body, bodyMat, ring, halo, alive: true, cd: 1 + Math.random() * 1.5, charge: 0, ph: Math.random() * 6.28 });
    }

    const pg = new THREE.SphereGeometry(0.55, 10, 8);
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0xff3a58 }));
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.glowTex, color: 0xff2040, blending: THREE.AdditiveBlending, depthWrite: false }));
      h.scale.setScalar(3.2); m.add(h); m.visible = false; scene.add(m);
      this.pulses.push({ m, v: new V(), life: 0 });
    }
    this._a = new V(); this._b = new V();
  }

  reset() {
    for (const s of this.scanners) { s.alive = true; s.hp = 3; s.sheet.visible = true; s.ring.visible = true; s.domeMat.emissiveIntensity = 0.5; s.domeMat.color.set(0x3a1018); }
    for (const d of this.drones) { d.alive = true; d.g.visible = true; d.cd = 1 + Math.random() * 1.5; d.charge = 0; }
    for (const p of this.pulses) { p.life = 0; p.m.visible = false; }
  }

  // things the hack laser can hit
  targets(out) {
    for (const s of this.scanners) if (s.alive) out.push({ kind: 'scanner', ref: s, pos: this._tmpPos(s) });
    for (const d of this.drones) if (d.alive) out.push({ kind: 'drone', ref: d, pos: d.g.position });
    return out;
  }
  _tmpPos(s) { if (!s._p) s._p = new V(); s._p.copy(s.g.position); s._p.y += 1.4; return s._p; }

  damage(t, ev) {
    if (t.kind === 'drone') {
      const d = t.ref; d.alive = false; d.g.visible = false;
      this.fx.burst(d.g.position, 40, 0xff4060, 18, 0.9, 0.7, 10, 2);
      this.fx.burst(d.g.position, 14, 0xffc23d, 10, 1.4, 0.4, 0, 3);
      this.fx.ring(d.g.position, null, 0xff4060, 6, 0.35);
      this.sfx.kill(); ev.text(d.g.position, 'PROCESS KILLED', 'red');
    } else if (t.kind === 'scanner') {
      const s = t.ref; s.hp--; s.flash = 0.15;
      this.fx.burst(t.pos, 12, 0xffc23d, 10, 0.7, 0.4, 8, 2);
      if (s.hp <= 0) {
        s.alive = false; s.sheet.visible = false; s.ring.visible = false;
        s.domeMat.emissiveIntensity = 0; s.domeMat.color.set(0x15171b);
        this.fx.burst(t.pos, 50, 0xff4060, 20, 1, 0.8, 12, 2);
        this.sfx.kill(); ev.text(t.pos, 'SCANNER DOWN', 'red');
      } else { this.sfx.zap(); ev.text(t.pos, `${s.hp}`, 'gold'); }
    }
  }

  update(dt, t, player, linkA, linkB, onHit, active) {
    this.time.value = t;
    const pp = player.pos, R = 0.45;
    // scanners: rotating vertical sheets
    for (const s of this.scanners) {
      if (s.flash > 0) { s.flash -= dt; s.domeMat.emissiveIntensity = s.alive ? (s.flash > 0 ? 2 : 0.5) : 0; }
      if (!s.alive) continue;
      if (s.a > Math.PI * 2) s.a -= Math.PI * 2;
      s.prevA = s.a; s.a += s.spec.speed * dt;
      s.head.rotation.y = -s.a;
      if (!active) continue;
      const hitP = (p) => {
        const dx = p.x - s.g.position.x, dz = p.z - s.g.position.z;
        const r = Math.hypot(dx, dz); if (r > s.spec.R || r < 0.5 || p.y > s.g.position.y + 4) return false;
        const phi = Math.atan2(dz, dx);
        const margin = (R + 0.35) / r;
        const d1 = wrapPi(phi - s.prevA), sweep = s.a - s.prevA;
        return d1 >= -margin && d1 <= sweep + margin;
      };
      if (hitP(pp)) onHit('scan', null, false);
      else if (linkA && this._segHit(linkA, linkB, hitP)) onHit('scan', null, true);
    }
    // cluster scan line moving up and down the face
    for (const s of this.scanlines) {
      const sp = s.spec; s.prevY = s.y; s.y += s.dir * sp.speed * dt;
      if (s.y > sp.y1) { s.y = sp.y1; s.dir = -1; } if (s.y < sp.y0) { s.y = sp.y0; s.dir = 1; }
      s.m.position.y = s.y; s.edge.position.y = s.y;
      if (!active) continue;
      const lo = Math.min(s.prevY, s.y) - R - 0.25, hi = Math.max(s.prevY, s.y) + R + 0.25;
      const hitP = (p) => p.x > sp.x0 && p.x < sp.x1 && p.z > sp.z0 - 1 && p.z < sp.z1 && p.y > lo && p.y < hi;
      if (hitP(pp)) onHit('scan', null, false);
      else if (linkA) {
        // the link crosses the plane if its ends are on opposite sides
        const ya = linkA.y - s.y, yb = linkB.y - s.y;
        if (ya * yb < 0) { const f = ya / (ya - yb); const x = linkA.x + (linkB.x - linkA.x) * f, z = linkA.z + (linkB.z - linkA.z) * f;
          if (x > sp.x0 && x < sp.x1 && z > sp.z0 - 1 && z < sp.z1) onHit('scan', null, true); }
      }
    }
    // drones: hover, charge, fire slow pulses
    for (const d of this.drones) {
      if (!d.alive) continue;
      const g = d.g, ph = d.ph;
      g.position.set(d.home.x + Math.sin(t * 0.7 + ph) * 3.5, d.home.y + Math.sin(t * 1.3 + ph) * 1.2, d.home.z + Math.cos(t * 0.7 + ph) * 3.5);
      d.ring.rotation.x = t * 2 + ph; d.ring.rotation.y = t * 1.3;
      d.body.rotation.y = t * 1.5;
      const dist = g.position.distanceTo(pp);
      if (!active || dist > 42) { d.charge = 0; d.bodyMat.emissiveIntensity = 0.6; d.halo.material.opacity = 0.5; continue; }
      if (d.charge > 0) {
        d.charge -= dt;
        const k = 1 - d.charge / 0.75;
        d.bodyMat.emissiveIntensity = 0.6 + k * 2.5; d.halo.material.opacity = 0.5 + k * 0.5; d.halo.scale.setScalar(5 + k * 4);
        if (d.charge <= 0) {
          const p = this.pulses.find(p => p.life <= 0);
          if (p) {
            p.m.position.copy(g.position); p.v.subVectors(pp, g.position).normalize().multiplyScalar(30);
            p.life = 2.6; p.m.visible = true; this.sfx.pulse();
          }
          d.cd = 1.6 + Math.random() * 1.2; d.halo.scale.setScalar(5);
        }
      } else {
        d.cd -= dt; d.bodyMat.emissiveIntensity = 0.6; d.halo.material.opacity = 0.5;
        if (d.cd <= 0) { d.charge = 0.75; this.sfx.charge(); }
      }
    }
    for (const p of this.pulses) {
      if (p.life <= 0) continue;
      p.life -= dt; p.m.position.addScaledVector(p.v, dt);
      if (Math.random() < 0.6) this.fx.spawn(p.m.position, 0, 0, 0, 0xff3050, 1.2, 0.25);
      if (p.life <= 0) { p.m.visible = false; continue; }
      if (active && p.m.position.distanceTo(pp) < R + 0.75) {
        p.life = 0; p.m.visible = false;
        onHit('pulse', this._a.copy(p.v).normalize(), false);
      }
    }
  }
  _segHit(a, b, test) {
    const q = this._b;
    for (let i = 1; i <= 10; i++) { q.lerpVectors(a, b, i / 11); if (test(q)) return true; }
    return false;
  }
}
