// Locks (no rights -> root), antivirus sentinels, their bolts, watchdog lights, the hacking laser.
import * as THREE from 'three';
import { glowTex, textSprite } from './textures.js';
import { rayColliders, setMachineState, breakDoor, COL } from './world.js';
import { sfx } from './audio.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// Orient a unit cylinder (height 1 along Y) between a and b.
export function placeBeam(mesh, a, b, width) {
  _v.subVectors(b, a);
  const len = _v.length();
  mesh.position.copy(a).addScaledVector(_v, 0.5);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(UP, _v.multiplyScalar(1 / len));
  mesh.scale.set(width, len, width);
}
const beamGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true);
function beamMesh(color, opacity = 1) {
  const m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false }));
  m.frustumCulled = false;
  return m;
}

const LABELS = {
  3: ['NO RIGHTS', 'USER', 'ADMIN', 'ROOT'],
  5: ['NO RIGHTS', 'GUEST', 'USER', 'OPERATOR', 'ADMIN', 'ROOT'],
};

class Lock {
  constructor(game, spot) {
    this.game = game; this.spot = spot;
    this.pos = spot.pos; this.radius = spot.radius; this.n = spot.rings;
    this.machine = spot.machine; this.kind = spot.core ? 'core' : spot.door ? 'door' : 'machine';
    const g = this.group = new THREE.Group();
    g.position.copy(this.pos);
    g.lookAt(_v.copy(this.pos).add(spot.normal));
    game.scene.add(g);
    const r = this.radius;
    this.coreMat = new THREE.MeshBasicMaterial({ color: COL.locked });
    this.core = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.3, 1), this.coreMat);
    g.add(this.core);
    this.rings = [];
    for (let i = 0; i < this.n; i++) {
      const rr = r * (0.48 + 0.52 * i / Math.max(1, this.n - 1));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, r * 0.055, 6, 40, Math.PI * 1.6),
        new THREE.MeshBasicMaterial({ color: COL.locked, transparent: true }));
      ring.userData.spin = (i % 2 ? -1 : 1) * (0.6 + i * 0.25);
      g.add(ring); this.rings.push(ring);
    }
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: COL.locked, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, opacity: 0.7, fog: this.kind !== 'core' }));
    this.halo.scale.setScalar(r * 3.2); g.add(this.halo);
    const labels = LABELS[this.n];
    this.label = textSprite('NO RIGHTS', { color: '#ff5470', size: 40, height: r * 0.42, fog: this.kind !== 'core' });
    this.label.position.set(0, r * 1.35, 0.2); g.add(this.label);
    this.labels = labels;
    this.flying = [];
    this.reset();
  }
  reset() {
    this.hp = this.n; this.open = false; this.fade = 0;
    this.group.visible = true; this.group.scale.setScalar(1);
    this.rings.forEach(r => { r.visible = true; r.material.opacity = 1; r.material.color.setHex(COL.locked); });
    this.coreMat.color.setHex(COL.locked); this.halo.material.color.setHex(COL.locked);
    this.label.userData.setText(this.labels[0], '#ff5470');
    for (const f of this.flying) this.game.scene.remove(f.m);
    this.flying = [];
    this.flash = 0;
  }
  get alive() { return !this.open; }
  hit(point) {
    if (this.open) return;
    const fx = this.game.fx;
    const ring = this.rings[this.hp - 1];
    this.hp--;
    // the outer ring flies off
    const m = ring.clone(); m.material = ring.material.clone();
    ring.getWorldPosition(m.position); ring.getWorldQuaternion(m.quaternion);
    this.game.scene.add(m); ring.visible = false;
    this.flying.push({ m, v: this.spot.normal.clone().multiplyScalar(10).add(new THREE.Vector3((Math.random() - .5) * 8, 6, (Math.random() - .5) * 8)), t: 0 });
    fx.burst(point || this.pos, 0xff8899, 18, 14, 0.5);
    sfx.ring(this.n - this.hp - 1);
    this.flash = 1;
    const lvl = this.n - this.hp;
    const txt = this.labels[lvl];
    if (this.hp > 0) {
      this.label.userData.setText(txt, '#ffb36b');
      this.game.hud.toast(txt, 'warn');
    } else this.unlock();
  }
  unlock() {
    this.open = true;
    const g = this.game;
    this.label.userData.setText('ROOT', '#5dff9a');
    this.coreMat.color.setHex(COL.owned); this.halo.material.color.setHex(COL.owned);
    g.hud.toast('ROOT', 'good');
    sfx.root();
    g.fx.burst(this.pos, COL.owned, 40, 20, 0.8);
    g.fx.ripple(this.pos, this.spot.normal, COL.owned, this.radius * 4, 0.6);
    g.shake(0.35);
    if (this.kind === 'machine') {
      setMachineState(this.machine, 'open');
      this.machine.pulse = 1;
      this.fade = 1;
    } else if (this.kind === 'door') {
      breakDoor(g.world);
      g.onDoorBroken();
      this.fade = 1;
    } else if (this.kind === 'core') {
      g.hud.hint('The core is open. Tether in.', 6);
    }
  }
  update(dt, t) {
    this.rings.forEach(r => { r.rotation.z += r.userData.spin * dt; });
    this.core.rotation.y += dt * 1.3;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 4);
      this.halo.scale.setScalar(this.radius * (3.2 + this.flash * 2));
    }
    if (this.kind === 'core' && this.open) {
      const s = 1 + 0.12 * Math.sin(t * 6);
      this.core.scale.setScalar(s * 1.6);
    }
    if (this.fade > 0) {
      this.fade = Math.max(0, this.fade - dt * 1.6);
      this.group.scale.setScalar(Math.max(0.001, this.fade));
      if (this.fade === 0) this.group.visible = false;
    }
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt; f.v.y -= 30 * dt;
      f.m.position.addScaledVector(f.v, dt);
      f.m.rotation.x += dt * 9; f.m.rotation.y += dt * 5;
      f.m.material.opacity = Math.max(0, 1 - f.t / 0.9);
      if (f.t > 0.9) { this.game.scene.remove(f.m); this.flying.splice(i, 1); }
    }
  }
}

const BOLT_SPEED = 52;

class Sentinel {
  constructor(game, spot) {
    this.game = game; this.spot = spot; this.home = spot.pos.clone();
    this.radius = 1.9;
    const g = this.group = new THREE.Group(); game.scene.add(g);
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a0710, emissive: 0xff2244, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.6, flatShading: true });
    this.body = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), this.bodyMat);
    this.body.scale.set(1, 1.25, 1); g.add(this.body);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eye.position.z = 1.15; this.head = new THREE.Group(); this.head.add(eye); g.add(this.head);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.1, 6, 32), new THREE.MeshBasicMaterial({ color: 0xff3355 }));
    ring.rotation.x = Math.PI / 2; g.add(ring); this.ring = ring;
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff2244, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.6 }));
    this.halo.scale.setScalar(7); g.add(this.halo);
    const tag = textSprite('ANTIVIRUS', { color: '#ff6a80', size: 36, height: 0.9 });
    tag.position.y = 3.4; g.add(tag); this.tag = tag;
    // scan beam (shows where it looks) and aim telegraph line
    this.scan = beamMesh(0xff2244, 0.18); game.scene.add(this.scan);
    this.tele = beamMesh(0xff2244, 0.0); game.scene.add(this.tele);
    this.vel = new THREE.Vector3(); this.spin = new THREE.Vector3();
    this.reset();
  }
  reset() {
    this.state = 'scan'; this.hp = 2; this.timer = 0; this.yaw = Math.random() * 6; this.flash = 0;
    this.group.visible = true; this.group.position.copy(this.home); this.group.rotation.set(0, 0, 0);
    this.scan.visible = true; this.tele.visible = false;
  }
  get alive() { return this.state === 'scan' || this.state === 'charge' || this.state === 'cool'; }
  get center() { return this.group.position; }
  hitLaser(point) {
    if (!this.alive) return;
    this.hp--; this.flash = 1;
    this.game.fx.burst(point || this.center, 0xff5566, 14, 12, 0.4);
    sfx.ring(0);
    if (this.hp <= 0) this.kill();
  }
  kill() {
    const g = this.game;
    this.state = 'dead'; this.group.visible = false; this.scan.visible = false; this.tele.visible = false;
    g.fx.burst(this.center, 0xff3355, 50, 22, 0.8, 10);
    g.fx.burst(this.center, 0xffffff, 16, 10, 0.4);
    g.fx.ripple(this.center, g.camRig.forward.clone().negate(), 0xff3355, 8, 0.45);
    g.hud.toast('PURGED', 'good'); g.timeScale = 0.45;
    sfx.kill();
  }
  yank(from) {
    if (!this.alive) return;
    const g = this.game;
    this.state = 'falling';
    this.scan.visible = false; this.tele.visible = false;
    this.vel.subVectors(from, this.center).normalize().multiplyScalar(22).add(new THREE.Vector3(0, 8, 0));
    this.spin.set(9, 4, 7);
    g.hud.toast('UNPLUGGED', 'good'); g.timeScale = 0.45;
    g.fx.burst(this.center, 0xffd27a, 30, 16, 0.6);
    sfx.yank();
  }
  update(dt, t) {
    const g = this.game, p = g.player;
    if (this.state === 'dead') return;
    if (this.state === 'falling') {
      this.vel.y -= 34 * dt;
      this.group.position.addScaledVector(this.vel, dt);
      this.group.rotation.x += this.spin.x * dt; this.group.rotation.z += this.spin.z * dt;
      if (Math.random() < 0.5) g.fx.burst(this.center, 0xff7744, 1, 3, 0.4);
      if (this.group.position.y < 1) { this.state = 'dead'; this.group.visible = false; g.fx.burst(this.center, 0xff3355, 40, 18, 0.7, 8); sfx.kill(); }
      return;
    }
    const pos = this.group.position;
    pos.y = this.home.y + Math.sin(t * 2 + this.home.x) * 0.35;
    this.body.rotation.y += dt * 1.2;
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 5); }
    this.bodyMat.emissive.setHex(this.flash > 0.01 ? 0xffffff : 0xff2244);

    _v.subVectors(p.pos, pos);
    const d = _v.length();
    let see = false;
    if (d < 72 && p.alive) {
      _w.copy(_v).multiplyScalar(1 / d);
      const hit = rayColliders(g.world, pos, _w, d);
      see = !hit;
    }
    let lookDir;
    if (this.state === 'scan') {
      this.yaw += dt * 0.8;
      lookDir = _w.set(Math.sin(this.yaw), -0.35, Math.cos(this.yaw)).normalize();
      if (see && p.invuln <= 0) { this.state = 'charge'; this.timer = 0.85; sfx.charge(); }
    } else {
      lookDir = _w.copy(_v).normalize();
      if (this.state === 'charge') {
        this.timer -= dt;
        if (!see) { this.state = 'scan'; }
        else if (this.timer <= 0) {
          // aim with a little lead
          const lead = (d / BOLT_SPEED) * 0.55;
          const target = p.pos.clone().addScaledVector(p.vel, lead);
          g.combat.spawnBolt(pos.clone(), target.sub(pos).normalize().multiplyScalar(BOLT_SPEED));
          this.state = 'cool'; this.timer = 1.4; sfx.bolt();
        }
      } else if (this.state === 'cool') {
        this.timer -= dt;
        if (this.timer <= 0) this.state = 'scan';
      }
    }
    this.head.lookAt(_v.copy(pos).add(lookDir));
    placeBeam(this.scan, pos, _v.copy(pos).addScaledVector(lookDir, 16), 0.12);
    this.tele.visible = this.state === 'charge';
    if (this.tele.visible) {
      const k = 1 - this.timer / 0.85;
      placeBeam(this.tele, pos, p.pos, 0.05 + k * 0.15);
      this.tele.material.opacity = 0.25 + k * 0.6 + (Math.sin(t * 50) > 0 ? 0.15 : 0);
    }
    this.ring.rotation.z += dt * (this.state === 'charge' ? 8 : 1);
  }
}

class Watchdog {
  constructor(game, spot) {
    this.game = game; this.spot = spot;
    const s = game.scene;
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x1a1f28, roughness: 0.7, metalness: 0.5 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, spot.h, 10), mastMat);
    mast.position.copy(spot.base).setY(spot.h / 2); s.add(mast);
    this.apex = spot.base.clone().setY(spot.h + 2);
    this.head = new THREE.Group(); this.head.position.copy(this.apex); s.add(this.head);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 4, 16), mastMat);
    lamp.rotation.x = Math.PI / 2; this.head.add(lamp);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(2.9, 24), new THREE.MeshBasicMaterial({ color: 0xdff1ff }));
    lens.position.z = 2.05; this.head.add(lens);
    this.len = 150; this.half = THREE.MathUtils.degToRad(9);
    const cg = new THREE.ConeGeometry(Math.tan(this.half) * this.len, this.len, 32, 1, true);
    cg.translate(0, -this.len / 2, 0); cg.rotateX(-Math.PI / 2);
    this.coneMat = new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.09,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.cone = new THREE.Mesh(cg, this.coneMat); this.head.add(this.cone);
    const tag = textSprite('WATCHDOG', { color: '#cfe6ff', size: 36, height: 1.6 });
    tag.position.copy(this.apex).add(new THREE.Vector3(0, 5, 0)); s.add(tag);
    this.target = new THREE.Vector3(); this.axis = new THREE.Vector3();
    this.inside = false;
  }
  update(dt, t) {
    const sp = this.spot;
    const ph = t * sp.speed;
    this.target.set(sp.aim.x + Math.sin(ph * 0.7) * sp.sweep.x, sp.aim.y + Math.sin(ph * 1.3) * sp.sweep.y, sp.aim.z + Math.sin(ph) * sp.sweep.z);
    this.head.lookAt(this.target);
    this.axis.subVectors(this.target, this.apex).normalize();
    const p = this.game.player;
    _v.subVectors(p.pos, this.apex);
    const d = _v.length();
    const along = _v.dot(this.axis);
    this.inside = p.alive && along > 0 && along < this.len && Math.acos(Math.min(1, along / d)) < this.half * 1.05;
    this.coneMat.color.setHex(this.inside ? 0xff4060 : 0xbfe3ff);
    this.coneMat.opacity = this.inside ? 0.2 : 0.09;
  }
}

export class Combat {
  constructor(game) {
    this.game = game;
    const W = game.world;
    this.locks = W.lockSpots.map(s => new Lock(game, s));
    this.doorLock = this.locks.find(l => l.kind === 'door');
    this.coreLock = this.locks.find(l => l.kind === 'core');
    this.sentinels = W.sentinelSpots.map(s => new Sentinel(game, s));
    this.watchdogs = W.watchdogSpots.map(s => new Watchdog(game, s));
    this.bolts = [];
    const boltGeo = new THREE.SphereGeometry(0.55, 10, 8);
    const boltMat = new THREE.MeshBasicMaterial({ color: 0xffd0d6 });
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(boltGeo, boltMat);
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff2244, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      h.scale.setScalar(4); m.add(h);
      m.visible = false; game.scene.add(m);
      this.bolts.push({ m, v: new THREE.Vector3(), life: 0 });
    }
    this.beams = [];
    for (let i = 0; i < 6; i++) { const b = beamMesh(0xffa040, 1); b.visible = false; game.scene.add(b); this.beams.push({ m: b, t: 0 }); }
    this.bi = 0;
    this.alarm = false;
  }
  reset() {
    this.locks.forEach(l => l.reset());
    this.sentinels.forEach(s => s.reset());
    this.bolts.forEach(b => { b.life = 0; b.m.visible = false; });
  }
  // Aim targets: spheres the laser and tether can lock on to.
  targets() {
    const out = [];
    for (const l of this.locks) {
      if (!l.open) out.push({ kind: 'lock', ref: l, center: l.pos, radius: l.radius });
      else if (l.kind === 'core') out.push({ kind: 'core', ref: l, center: l.pos, radius: l.radius });
    }
    for (const s of this.sentinels) if (s.alive) out.push({ kind: 'sentinel', ref: s, center: s.center, radius: s.radius });
    return out;
  }
  spawnBolt(pos, vel) {
    const b = this.bolts.find(b => b.life <= 0);
    if (!b) return;
    b.m.position.copy(pos); b.v.copy(vel); b.life = 3; b.m.visible = true;
  }
  fireLaser(from, to, target) {
    const g = this.game;
    const b = this.beams[this.bi]; this.bi = (this.bi + 1) % this.beams.length;
    b.m.visible = true; b.t = 0.08;
    placeBeam(b.m, from, to, 0.22);
    b.m.material.color.setHex(target ? 0xffb050 : 0xff9a3a);
    sfx.laser();
    if (target) {
      if (target.kind === 'lock') target.ref.hit(to);
      else if (target.kind === 'sentinel') target.ref.hitLaser(to);
      else g.fx.burst(to, 0xffb050, 6, 6, 0.25);
    } else {
      g.fx.burst(to, 0xffa040, 5, 5, 0.2);
    }
  }
  update(dt, t) {
    const g = this.game, p = g.player;
    for (const l of this.locks) l.update(dt, t);
    for (const s of this.sentinels) s.update(dt, t);
    this.alarm = false;
    for (const w of this.watchdogs) { w.update(dt, t); if (w.inside) this.alarm = true; }
    if (this.alarm) g.addTrace(48 * dt, 'watch');
    for (const b of this.bolts) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.m.position.addScaledVector(b.v, dt);
      if (p.alive && p.invuln <= 0 && b.m.position.distanceTo(p.pos) < 1.5) {
        p.hitByBolt(b.v);
        b.life = 0;
      }
      if (b.life > 0) for (const c of g.world.colliders) {
        if (c.disabled) continue;
        const q = b.m.position;
        if (q.x > c.min.x && q.x < c.max.x && q.y > c.min.y && q.y < c.max.y && q.z > c.min.z && q.z < c.max.z) {
          g.fx.burst(q, 0xff3355, 10, 8, 0.3); b.life = 0; break;
        }
      }
      if (b.m.position.y < 0.5) b.life = 0;
      if (b.life <= 0) b.m.visible = false;
    }
    for (const b of this.beams) {
      if (!b.m.visible) continue;
      b.t -= dt;
      b.m.material.opacity = Math.max(0, b.t / 0.08);
      if (b.t <= 0) b.m.visible = false;
    }
  }
}
