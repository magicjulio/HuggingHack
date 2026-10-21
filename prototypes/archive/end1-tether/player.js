// The orb (KAM1196A): movement, the tether, the sling, the sail, and how they look.
import * as THREE from 'three';
import { Ribbon } from './fx.js';
import { glowTex, shadowTex, textSprite } from './textures.js';
import { closestPointAABB, rayColliders, COL } from './world.js';
import { sfx } from './audio.js';

export const R = 0.55;          // orb radius. Machines are 40-160 tall.
export const RANGE = 80;        // tether range
const G = 34;                   // gravity
const HOOK_SPEED = 480;         // how fast the hook flies out
const VMAX = 98;
const REEL_MAX = 46;            // reel speed at chain x1
const REEL_RAMP = 170;          // how fast the reel winds up
const PULL = 175;               // max accel the reel applies along the line
const SUB = 4;                  // physics substeps per frame

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0), ZF = new THREE.Vector3(0, 0, 1);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const C_TETHER = new THREE.Color(0x7dffb0), C_WIN = new THREE.Color(0xfff0a0), C_DENY = new THREE.Color(0xff3355),
  C_WHIFF = new THREE.Color(0x667788), C_YANK = new THREE.Color(0xffb050), C_TRAIL = new THREE.Color(0x3dff8e),
  C_GOLD = new THREE.Color(0xffd56a), _col = new THREE.Color(), _cc = new THREE.Color();

export function windowDist(speed) { return Math.min(20, Math.max(7, speed * 0.3)); }

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.clingN = new THREE.Vector3();
    const scene = game.scene;
    // --- orb
    this.root = new THREE.Group(); scene.add(this.root);
    this.orb = new THREE.Group(); this.root.add(this.orb);
    this.core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.62, 20, 14), new THREE.MeshBasicMaterial({ color: 0xeafff2 }));
    this.shellMat = new THREE.MeshBasicMaterial({ color: 0x3dff8e, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), this.shellMat);
    this.orb.add(this.core, this.shell);
    this.eye = new THREE.Mesh(new THREE.SphereGeometry(R * 0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x062012 }));
    this.root.add(this.eye);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0x3dff8e, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 }));
    this.halo.scale.setScalar(3.4); this.root.add(this.halo);
    this.label = textSprite('KAM1196A', { color: '#9dffc4', size: 36, height: 0.3 });
    this.label.position.y = 1.2; this.root.add(this.label);
    // --- sail (the parachute)
    this.sailG = new THREE.Group(); this.root.add(this.sailG);
    this.sailMat = new THREE.MeshBasicMaterial({ color: 0x3dff8e, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 6, 0, Math.PI * 2, 0, 0.85), this.sailMat);
    dome.scale.set(1.25, 0.55, 0.9); dome.position.y = 2.2; this.sailG.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.4 * Math.sin(0.85), 0.05, 4, 40), new THREE.MeshBasicMaterial({ color: 0x9dffc4 }));
    rim.rotation.x = Math.PI / 2; rim.scale.set(1.25, 0.9, 1); rim.position.y = 2.2 + 2.4 * Math.cos(0.85) * 0.55; this.sailG.add(rim);
    const lp = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, rr = 2.4 * Math.sin(0.85);
      lp.push(0, 0, 0, Math.cos(a) * rr * 1.25, rim.position.y, Math.sin(a) * rr * 0.9);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.sailG.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x9dffc4, transparent: true, opacity: 0.6 })));
    this.sailG.visible = false; this.sailK = 0;
    // --- trail, tether, anchor mark, shadow
    this.trailN = 44;
    this.trail = new Ribbon(scene, this.trailN);
    this.trailPts = Array.from({ length: this.trailN }, () => new THREE.Vector3());
    this.tetherN = 22;
    this.rope = new Ribbon(scene, this.tetherN);
    this.ropePts = Array.from({ length: this.tetherN }, () => new THREE.Vector3());
    this.rope.mesh.visible = false;
    this.markMat = new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.mark = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), this.markMat);
    this.mark.visible = false; scene.add(this.mark);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; scene.add(this.shadow);
    this.stats = { slings: 0, falls: 0, tethers: 0 };
  }

  reset(pos, mode = 'ground') {
    this.pos.copy(pos); this.vel.set(0, 0, 0);
    this.mode = mode; this.teth = null; this.sail = false; this.sailK = 0;
    this.chain = 0; this.alive = true; this.deadT = 0; this.invuln = 1.2;
    this.squash = 0; this.slingT = 0; this.finishing = null;
    for (const p of this.trailPts) p.copy(pos);
    this.root.visible = true;
  }
  get speed() { return this.vel.length(); }
  get mult() { return 1 + 0.07 * Math.min(Math.max(this.chain - 1, 0), 8); }
  get attached() { return this.teth && this.teth.phase === 'attached'; }
  get reeling() { return this.attached; }

  // ---------------------------------------------------------------- tether
  fire(aim) {
    if (!this.alive || this.finishing) return;
    const tt = aim.tether; // computed by main: {action, point, normal, machine, ref, dist}
    this.teth = {
      phase: 'fly', action: tt.action, point: tt.point.clone(), normal: tt.normal ? tt.normal.clone() : UP.clone(),
      machine: tt.machine, ref: tt.ref, tip: this.pos.clone(), t: 0, flyT: Math.max(0.03, tt.dist / HOOK_SPEED),
      L: 0, L0: 0, rs: 0, inWin: false, from: this.pos.clone(),
    };
    sfx.fire();
  }
  release() {
    const T = this.teth;
    if (!T) return;
    if (T.phase === 'attached') {
      if (T.inWin && this.speed > 10) this.sling();
      T.phase = 'retract'; T.t = 0;
    } else if (T.phase === 'fly' && (T.action === 'attach' || T.action === 'core')) {
      T.phase = 'retract'; T.t = 0;
    }
  }
  resolveHook() {
    const T = this.teth, g = this.game;
    if (T.action === 'attach' || T.action === 'core') {
      T.phase = 'attached';
      T.L = T.L0 = this.pos.distanceTo(T.point);
      T.rs = 0;
      this.chain = this.mode === 'air' ? this.chain + 1 : 1;
      if (this.mode === 'cling' || this.mode === 'ground') this.mode = 'air';
      _a.subVectors(T.point, this.pos).normalize();
      this.vel.addScaledVector(_a, 9);                 // the yank you feel on attach
      g.shake(0.12);
      g.fx.burst(T.point, 0x9dffc4, 12, 9, 0.35, 0, T.normal, 0.8);
      g.fx.ripple(T.point.clone().addScaledVector(T.normal, 0.1), T.normal, 0x7dffb0, 3, 0.35);
      sfx.attach();
      this.stats.tethers++;
      if (T.machine) g.ownMachine(T.machine);
      if (this.chain >= 2) g.hud.chain(this.chain);
      g.onFirstAttach && g.onFirstAttach();
      if (T.action === 'core') { this.finishing = { t: 0, from: this.pos.clone() }; this.closeSail(); }
    } else if (T.action === 'deny') {
      g.denied(T.machine, T.point, T.normal);
      T.phase = 'retract'; T.t = 0;
    } else if (T.action === 'yank') {
      T.ref.yank(this.pos);
      T.phase = 'retract'; T.t = 0;
    } else {
      T.phase = 'retract'; T.t = 0; sfx.whiff();
    }
  }
  sling() {
    const g = this.game, T = this.teth;
    const aim = g.camRig.forward;
    _a.copy(aim).addScaledVector(UP, 0.1).normalize();
    const dn = _a.dot(T.normal);
    if (dn < 0.1) _a.addScaledVector(T.normal, 0.1 - dn).normalize();
    const sp = Math.min(VMAX, Math.max(this.speed, 32) + 14 * this.mult);
    this.vel.copy(_a).multiplyScalar(sp);
    this.stats.slings++;
    this.slingT = 1;
    g.shake(0.18); g.camRig.kick(9); g.timeScale = 0.3;
    g.fx.burst(this.pos, 0xffe08a, 26, 16, 0.45, 0, _b.copy(_a).negate(), 0.5);
    g.fx.ripple(this.pos, _a, 0xffe08a, 5, 0.35);
    g.hud.toast(this.chain >= 2 ? `SLING ×${this.chain}` : 'SLING', 'sling');
    sfx.sling();
    g.onSling && g.onSling();
  }
  latch() {
    const T = this.teth, g = this.game;
    this.pos.copy(T.point).addScaledVector(T.normal, R + 0.02);
    this.vel.set(0, 0, 0);
    this.mode = T.normal.y > 0.6 ? 'ground' : 'cling';
    this.clingN.copy(T.normal);
    this.teth = null;
    this.chain = 0; this.closeSail();
    this.squash = 1;
    sfx.latch();
    if (T.machine) g.ownMachine(T.machine);
  }
  cutTether() { if (this.teth) { this.teth.phase = 'retract'; this.teth.t = 0; } }

  toggleSail() {
    if (!this.alive || this.mode !== 'air') return;
    if (this.sail) this.closeSail(); else { this.sail = true; sfx.sailOpen(); this.game.onSail && this.game.onSail(); }
  }
  closeSail() { if (this.sail) sfx.sailClose(); this.sail = false; }

  jump() {
    if (this.mode === 'ground') {
      const f = this.game.camRig.flatForward;
      this.vel.y = 15; this.vel.addScaledVector(f, 4);
      this.mode = 'air'; sfx.land();
    } else if (this.mode === 'cling') {
      this.vel.copy(this.clingN).multiplyScalar(11).addScaledVector(UP, 15);
      this.mode = 'air'; sfx.land();
    }
  }

  hitByBolt(dir) {
    const g = this.game;
    g.addTrace(22, 'bolt');
    this.cutTether();
    _a.copy(dir).normalize();
    this.vel.addScaledVector(_a, 16);
    if (this.mode === 'cling') this.mode = 'air';
    this.invuln = 0.9;
    g.shake(0.5); g.hud.flash('hit'); g.hud.toast('QUARANTINED', 'bad');
    g.fx.burst(this.pos, 0xff3355, 30, 14, 0.5);
    sfx.hit();
  }

  die() {
    if (!this.alive) return;
    const g = this.game;
    this.alive = false; this.deadT = 0.9;
    this.teth = null; this.sail = false;
    this.stats.falls++;
    this.root.visible = false;
    g.fx.burst(this.pos, 0x3dff8e, 40, 12, 0.8);
    g.onSignalLost();
  }

  // ---------------------------------------------------------------- update
  update(dt, input) {
    const g = this.game;
    this.invuln = Math.max(0, this.invuln - dt);
    this.slingT = Math.max(0, this.slingT - dt * 2.2);
    this.squash = Math.max(0, this.squash - dt * 5);
    if (!this.alive) {
      this.deadT -= dt;
      if (this.deadT <= 0) g.respawn();
      this.updateVisuals(dt);
      return;
    }
    if (this.finishing) { this.updateFinish(dt); this.updateVisuals(dt); return; }

    // hook flight / retract
    const T = this.teth;
    if (T && T.phase === 'fly') {
      if (T.action === 'yank' && T.ref.alive) T.point.copy(T.ref.center);
      T.t += dt;
      const k = Math.min(1, T.t / T.flyT);
      T.tip.lerpVectors(this.pos, T.point, k);
      if (k >= 1) this.resolveHook();
    } else if (T && T.phase === 'retract') {
      T.t += dt;
      _a.subVectors(this.pos, T.tip);
      const d = _a.length(), step = 260 * dt;
      if (d <= step) this.teth = null; else T.tip.addScaledVector(_a, step / d);
    }

    if (this.mode === 'cling' && !this.attached) {
      this.vel.set(0, 0, 0);
    } else {
      const h = dt / SUB;
      let grounded = false, groundM = null, bonk = 0, lockedHit = null;
      for (let s = 0; s < SUB; s++) {
        const r = this.step(h, input);
        if (r.latched) break;
        grounded = grounded || r.grounded; if (r.groundM) groundM = r.groundM;
        bonk = Math.max(bonk, r.bonk); if (r.locked) lockedHit = r.locked;
      }
      if (this.mode !== 'cling') {
        const was = this.mode;
        if (this.attached) this.mode = 'air';
        else this.mode = grounded ? 'ground' : 'air';
        if (was === 'air' && this.mode === 'ground') { this.squash = Math.min(1, this.squash + 0.7); sfx.land(); }
      }
      if (this.mode === 'ground') { this.chain = 0; this.closeSail(); if (groundM) g.ownMachine(groundM); }
      if (bonk > 0) { g.shake(Math.min(0.4, bonk / 120)); sfx.bonk(); }
      if (lockedHit) g.lockedTouch(lockedHit.machine, lockedHit.point);
    }
    if (this.attached && this.teth.inWin && !this.teth.winSounded) { this.teth.winSounded = true; sfx.windowOpen(); }

    // floor = no network. Out of bounds too.
    if (this.pos.y < R + 0.15 || Math.abs(this.pos.x) > 260 || this.pos.z > 90 || this.pos.z < -1000) this.die();
    this.updateVisuals(dt);
  }

  step(h, input) {
    const g = this.game, T = this.teth, v = this.vel, p = this.pos;
    const res = { grounded: false, groundM: null, bonk: 0, locked: null, latched: false };
    const fwd = g.camRig.flatForward, right = g.camRig.right;
    let mx = 0, mz = 0;
    if (input.keys.KeyW) mz += 1; if (input.keys.KeyS) mz -= 1;
    if (input.keys.KeyD) mx += 1; if (input.keys.KeyA) mx -= 1;
    _b.set(0, 0, 0).addScaledVector(fwd, mz).addScaledVector(right, mx);
    if (_b.lengthSq() > 0) _b.normalize();

    if (T && T.phase === 'attached') {
      _a.subVectors(T.point, p);
      const dist = _a.length();
      if (dist < R + 0.8) { this.latch(); res.latched = true; return res; }
      _a.multiplyScalar(1 / dist);
      const m = this.mult;
      T.rs = Math.min(REEL_MAX * m, T.rs + REEL_RAMP * h);
      const va = v.dot(_a);
      if (va < T.rs) v.addScaledVector(_a, Math.min(T.rs - va, PULL * m * h));
      // bleed sideways speed a little so spirals converge
      _c.copy(v).addScaledVector(_a, -v.dot(_a));
      v.addScaledVector(_c, -(1 - Math.exp(-1.1 * h)));
      v.y -= G * (this.sail ? 0.12 : 0.4) * h;
      v.addScaledVector(_b, 10 * h);
      T.inWin = dist < windowDist(this.speed) + R;
    } else if (this.mode === 'ground') {
      v.y -= G * h;
      const hv = _c.set(v.x, 0, v.z);
      if (_b.lengthSq() > 0) {
        hv.addScaledVector(_b, 70 * h);
        const l = hv.length(); if (l > 18) hv.multiplyScalar(18 / l);
      } else hv.multiplyScalar(Math.exp(-9 * h));
      v.x = hv.x; v.z = hv.z;
    } else {
      // free flight
      if (this.sail) this.sailPhysics(h);
      else v.y -= G * h;
      v.addScaledVector(_b, (this.sail ? 6 : 12) * h);
      v.multiplyScalar(Math.exp(-0.04 * h));
    }
    const sp = v.length(); if (sp > VMAX) v.multiplyScalar(VMAX / sp);
    p.addScaledVector(v, h);

    // rope: can only get shorter
    if (T && T.phase === 'attached') {
      _a.subVectors(p, T.point);
      const d = _a.length();
      T.L = Math.min(T.L, Math.max(d, 0));
      if (d > T.L + 1e-4) {
        _a.multiplyScalar(1 / d);
        p.copy(T.point).addScaledVector(_a, T.L);
        const out = v.dot(_a); if (out > 0) v.addScaledVector(_a, -out);
      }
    }

    // collisions: sphere vs boxes
    for (const c of g.world.colliders) {
      if (c.disabled) continue;
      if (p.x < c.min.x - R || p.x > c.max.x + R || p.y < c.min.y - R || p.y > c.max.y + R || p.z < c.min.z - R || p.z > c.max.z + R) continue;
      const cp = closestPointAABB(p, c.min, c.max, _c);
      _d.subVectors(p, cp);
      let d2 = _d.lengthSq();
      if (d2 >= R * R) continue;
      let n;
      if (d2 < 1e-10) { // centre inside: push out on the shallowest axis
        const pen = [p.x - c.min.x, c.max.x - p.x, p.y - c.min.y, c.max.y - p.y, p.z - c.min.z, c.max.z - p.z];
        let k = 0; for (let i = 1; i < 6; i++) if (pen[i] < pen[k]) k = i;
        n = _d.set(0, 0, 0); n.setComponent(k >> 1, k % 2 ? 1 : -1);
        p.setComponent(k >> 1, k % 2 ? c.max.getComponent(k >> 1) + R : c.min.getComponent(k >> 1) - R);
      } else {
        const d = Math.sqrt(d2);
        n = _d.multiplyScalar(1 / d);
        p.copy(cp).addScaledVector(n, R + 1e-3);
      }
      const vn = v.dot(n);
      if (c.machine && c.machine.state === 'locked') {
        // no rights: the surface throws you off
        v.addScaledVector(n, -2 * Math.min(vn, 0)).multiplyScalar(0.55).addScaledVector(n, 14);
        res.locked = { machine: c.machine, point: cp.clone() };
        if (T && T.phase === 'attached') this.cutTether();
        continue;
      }
      if (vn < 0) {
        if (-vn > 30 && n.y < 0.6) res.bonk = Math.max(res.bonk, -vn);
        v.addScaledVector(n, -vn);
        if (n.y < 0.6 && !(T && T.phase === 'attached')) v.multiplyScalar(Math.exp(-3 * h)); // wall friction
      }
      if (n.y > 0.6) { res.grounded = true; res.groundM = c.machine; }
    }
    return res;
  }

  sailPhysics(h) {
    const v = this.vel, cam = this.game.camRig;
    // steer horizontal velocity toward where the camera looks
    let hs = Math.hypot(v.x, v.z);
    const f = cam.flatForward;
    let ang = Math.atan2(v.x, v.z);
    const want = Math.atan2(f.x, f.z);
    let da = want - ang; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    ang += Math.max(-2.4 * h, Math.min(2.4 * h, da));
    const dive = Math.min(1, Math.max(0, -cam.pitch * 1.6));
    const target = 22 + 34 * dive;
    hs += (target - hs) * (hs > target ? 0.35 : 0.9) * h;
    v.x = Math.sin(ang) * hs; v.z = Math.cos(ang) * hs;
    if (v.y > 0) v.y -= G * 0.6 * h;
    else { const vt = -3.2 - 24 * dive; v.y += (vt - v.y) * 2.6 * h; }
  }

  updateFinish(dt) {
    const F = this.finishing, T = this.teth;
    F.t += dt;
    const k = Math.min(1, F.t / 0.75);
    const e = k * k * (3 - 2 * k);
    this.pos.lerpVectors(F.from, this.game.world.corePos, e);
    this.vel.subVectors(this.game.world.corePos, F.from).multiplyScalar(1.3);
    if (T) T.tip.copy(this.game.world.corePos);
    if (k > 0.85 && !F.flashed) { F.flashed = true; this.game.fx.burst(this.game.world.corePos, 0xffffff, 80, 30, 1.2); this.game.fx.ripple(this.game.world.corePos, new THREE.Vector3(0, 0, 1), 0xc79bff, 40, 1.2); }
    if (k >= 1 && !F.done) { F.done = true; this.root.visible = false; this.teth = null; this.game.finish(); }
  }

  // ---------------------------------------------------------------- visuals
  updateVisuals(dt) {
    const g = this.game, cam = g.camera, t = g.clock;
    const sp = this.speed;
    this.root.position.copy(this.pos);
    // stretch along velocity, squash on landing
    if (this.squash > 0.01) {
      this.orb.quaternion.identity();
      const s = this.squash;
      this.orb.scale.set(1 + s * 0.35, 1 - s * 0.4, 1 + s * 0.35);
    } else if (sp > 2) {
      _a.copy(this.vel).multiplyScalar(1 / sp);
      this.orb.quaternion.setFromUnitVectors(ZF, _a);
      const st = 1 + Math.min(sp / 60, 0.85);
      this.orb.scale.set(1 / Math.sqrt(st), 1 / Math.sqrt(st), st);
    } else this.orb.scale.set(1, 1, 1);
    // the eye looks where you aim
    this.eye.position.copy(g.camRig.forward).multiplyScalar(R * 0.92);
    const chainGlow = Math.min(1, this.chain / 6);
    this.halo.scale.setScalar(3.2 + chainGlow * 2 + this.slingT * 3 + Math.sin(t * 6) * 0.15);
    this.halo.material.color.copy(C_TRAIL).lerp(C_GOLD, Math.max(chainGlow * 0.6, this.slingT));
    this.shellMat.color.copy(this.halo.material.color);
    // label fades after the door
    const lf = g.labelFade;
    this.label.visible = lf > 0.01; this.label.material.opacity = lf;

    // sail
    this.sailK += ((this.sail ? 1 : 0) - this.sailK) * Math.min(1, dt * 14);
    this.sailG.visible = this.sailK > 0.02;
    if (this.sailG.visible) {
      const pop = this.sail ? 1 + Math.sin(Math.min(1, this.sailK) * Math.PI) * 0.15 : 1;
      const ss = this.sailK * 0.75;
      this.sailG.scale.set(ss * pop, ss, ss * pop);
      const ang = Math.atan2(this.vel.x, this.vel.z);
      this.sailG.rotation.set(-0.25, ang, 0, 'YXZ');
      this.sailMat.opacity = 0.16 + 0.06 * Math.sin(t * 9);
    }

    // trail
    const pts = this.trailPts;
    if (pts[0].distanceToSquared(this.pos) > 0.04 || !this.alive) {
      for (let i = pts.length - 1; i > 0; i--) pts[i].copy(pts[i - 1]);
      pts[0].copy(this.pos);
    }
    const intensity = this.alive ? Math.min(1, 0.25 + sp / 60) : 0;
    const wbase = 0.22 + Math.min(1, sp / 70) * 0.3 + chainGlow * 0.22;
    _col.copy(C_TRAIL).lerp(C_GOLD, Math.max(chainGlow * 0.5, this.slingT));
    // segments that pass close to the camera fade out, so the trail never smears across the screen
    const near = i => { const d = pts[i].distanceTo(cam.position); return Math.min(1, Math.max(0, (d - 2.5) / 9)); };
    this.trail.set(pts, cam.position,
      i => wbase * (1 - i / (this.trailN - 1)) * (0.4 + 0.6 * near(i)),
      i => { const k = (1 - i / (this.trailN - 1)) * intensity * near(i); return _cc.setRGB(_col.r * k, _col.g * k, _col.b * k); });

    // tether rope
    const T = this.teth;
    this.rope.mesh.visible = !!T && this.alive;
    this.mark.visible = false;
    if (T && this.alive) {
      let amp = 0, col = C_TETHER, w = 0.16;
      if (T.phase === 'fly') { amp = 0.9 * (1 - Math.min(1, T.t / T.flyT)); }
      else if (T.phase === 'retract') { amp = 0.6; }
      else amp = 0.04;
      if (T.action === 'deny') col = C_DENY; else if (T.action === 'whiff') col = C_WHIFF; else if (T.action === 'yank') col = C_YANK;
      if (T.phase === 'attached' && T.inWin) { col = C_WIN; w = 0.3; }
      if (T.phase === 'retract') w = 0.1;
      _a.subVectors(T.tip, this.pos);
      _b.crossVectors(_a, UP); if (_b.lengthSq() < 1e-6) _b.set(1, 0, 0); _b.normalize();
      const n = this.tetherN;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const wob = Math.sin(k * Math.PI * 5 - t * 40) * amp * Math.sin(k * Math.PI);
        this.ropePts[i].copy(this.pos).addScaledVector(_a, k).addScaledVector(_b, wob).addScaledVector(UP, wob * 0.5);
      }
      const bright = T.phase === 'retract' ? 0.5 : 1;
      this.rope.set(this.ropePts, cam.position, () => w, () => _cc.copy(col).multiplyScalar(bright));
      if (T.phase === 'attached') {
        // the approach ring: shrinks as you close in, turns gold in the sling window
        const dist = this.pos.distanceTo(T.point);
        const wd = windowDist(sp);
        const r = T.inWin ? 1.1 + Math.sin(t * 30) * 0.12 : Math.min(4, 1.1 + (dist - wd) / wd * 1.6);
        this.mark.visible = true;
        this.mark.position.copy(T.point).addScaledVector(T.normal, 0.15);
        this.mark.lookAt(cam.position);
        this.mark.scale.setScalar(r);
        this.markMat.color.copy(T.inWin ? C_WIN : C_TETHER);
        this.markMat.opacity = T.inWin ? 1 : 0.7;
      }
    }

    // blob shadow straight down
    const hit = rayColliders(g.world, this.pos, DOWN, 400);
    const gy = hit ? this.pos.y - hit.t : 0;
    const hgt = this.pos.y - gy;
    this.shadow.visible = this.alive && hgt < 160;
    this.shadow.position.set(this.pos.x, gy + 0.08, this.pos.z);
    this.shadow.scale.setScalar(0.9 + hgt * 0.02);
    this.shadow.material.opacity = Math.max(0.15, 0.9 - hgt / 110);
  }
}
