// The orb and its line: aim, fire, latch, whip, reel, zip, launch.
import * as THREE from 'three';

export const T = {
  RADIUS: 0.6,
  G: 34,
  RANGE: 92,
  CABLE_SPEED: 750,
  AIR_ACCEL: 13,
  RUN: 18,
  JUMP: 20,
  REEL_AUTO: 3.5,
  REEL_W: 20,
  PAYOUT_S: 16,
  STEER: 18,
  SWING_ASSIST: 9,
  ZIP_REEL: 110,
  ZIP_PULL: 80,
  LAUNCH_UP: 30,
  LAUNCH_FWD: 24,
  CAP: 64,
  CAP_PER_FLOW: 5,
  CHAIN_WINDOW: 0.85,
  CHAIN_BOOST: 1.06,
  TRACE_TIME: 1.15,
  TUG: 5,
};

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _a = new THREE.Vector3();

// Which port is the player aiming at? Aim-assist cone around the crosshair ray.
export function pickPort(world, camPos, fwd, orb, exclude) {
  let best = null, bestS = 1, far = null, farS = 1;
  for (const p of world.ports) {
    if (p === exclude) continue;
    _v.subVectors(p.pos, camPos);
    const dCam = _v.length();
    const cos = _v.dot(fwd) / dCam;
    if (cos < 0.9) continue;
    const ang = Math.acos(Math.min(1, cos));
    const thr = Math.max(0.1, Math.atan(5 / dCam));
    const s = ang / thr;
    if (s >= 1) continue;
    _a.subVectors(orb, p.pos);
    const dOrb = _a.length();
    if (!p.core && _a.dot(p.normal) < -0.25 * dOrb) continue; // port faces away
    if (dOrb <= T.RANGE) { if (s < bestS) { bestS = s; best = p; } }
    else if (dOrb < T.RANGE * 2.2 && s < farS) { farS = s; far = p; }
  }
  if (best) return { port: best, inRange: true };
  if (far) return { port: far, inRange: false };
  return null;
}

export class Player {
  constructor(world, emit) {
    this.world = world;
    this.emit = emit;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.cable = null;      // {state:'firing'|'attached'|'whiff'|'retract', ...}
    this.checkpoint = new THREE.Vector3();
    this.time = 0;
  }

  reset(pos) {
    this.pos.copy(pos); this.vel.set(0, 0, 0);
    this.cable = null; this.grounded = true; this.hold = false;
    this.flow = 0; this.lastRelease = -99; this.touched = false;
    this.checkpoint.copy(pos);
    this.time = 0;
    this.prevTether = false;
  }

  respawn() {
    this.pos.copy(this.checkpoint); this.vel.set(0, 0, 0);
    this.cable = null; this.flow = 0; this.hold = true; this.grounded = false;
  }

  attachedPort() { return this.cable && this.cable.state === 'attached' ? this.cable.port : null; }

  // the end of the line in world space (for drawing)
  cableEnd(out) {
    const c = this.cable;
    if (!c) return null;
    if (c.state === 'attached') return out.copy(c.port.pos);
    const from = this.pos;
    const target = c.state === 'firing' ? c.port.pos : c.end;
    let k = c.t / c.dur;
    if (c.state === 'retract') k = 1 - k;
    return out.lerpVectors(from, target, Math.min(1, Math.max(0, k)));
  }

  release(manual = true) {
    const c = this.cable;
    if (!c) return;
    if (c.state === 'attached') {
      if (manual) {
        this.lastRelease = this.time; this.touched = false;
        if (this.vel.y > -6) this.vel.y += 4;   // little pop so letting go feels like a throw
        this.emit('release');
      }
      this.cable = { state: 'retract', end: c.port.pos.clone(), t: 0, dur: 0.1 };
    } else if (c.state === 'firing') {
      this.cable = { state: 'retract', end: this.cableEnd(new THREE.Vector3()), t: 0, dur: 0.08 };
    }
  }

  launch() {
    const c = this.cable, input = this.input, n = c.port.normal;
    this.vel.set(0, T.LAUNCH_UP, 0)
      .addScaledVector(input.fwdH, T.LAUNCH_FWD);
    if (Math.abs(n.y) < 0.5) this.vel.addScaledVector(_n.set(n.x, 0, n.z).normalize(), 8);
    this.cable = { state: 'retract', end: c.port.pos.clone(), t: 0, dur: 0.12 };
    this.lastRelease = this.time; this.touched = false;
    this.emit('launch');
  }

  latch(port) {
    if (port.lockHp > 0) {
      this.emit('deny', port);
      this.cable = { state: 'retract', end: port.pos.clone(), t: 0, dur: 0.18 };
      return;
    }
    const d = this.pos.distanceTo(port.pos);
    const chain = this.time - this.lastRelease < T.CHAIN_WINDOW && !this.touched && !this.grounded;
    if (chain) {
      this.flow = Math.min(5, this.flow + 1);
      this.vel.multiplyScalar(T.CHAIN_BOOST);
    } else if (this.time - this.lastRelease > 2) this.flow = Math.max(0, this.flow - 2);
    _n.subVectors(port.pos, this.pos).normalize();
    this.vel.addScaledVector(_n, T.TUG);
    // from a standing start the line yanks you off the roof
    if (this.grounded || this.hold) this.vel.addScaledVector(_n, 14).y += 9;
    const watched = this.world.portState(port) === 'watched';
    this.cable = { state: 'attached', port, L: d, traceT: 0, watched, zipping: !!port.core };
    this.grounded = false; this.hold = false;
    if (!port.m.isStart) {
      if (port.m.type === 'cluster') this.checkpoint.copy(port.pos).addScaledVector(port.normal, 5);
      else {
        // on the roof, halfway toward the port you used (keeps clear of a watcher's dome)
        const r = port.m.roof;
        this.checkpoint.set(r.x + (port.pos.x - r.x) * 0.45, r.y + 1.5, r.z + (port.pos.z - r.z) * 0.45);
      }
    }
    this.emit('latch', { port, chain, flow: this.flow, watched });
  }

  step(dt, input) {
    this.input = input;
    this.time += dt;
    const c = this.cable;

    // fire the line
    if (input.tether && !this.prevTether) {
      this.hold = false;
      if (input.target && input.target.inRange) {
        const p = input.target.port;
        this.cable = { state: 'firing', port: p, t: 0, dur: Math.max(0.035, this.pos.distanceTo(p.pos) / T.CABLE_SPEED) };
        this.emit('fire');
      } else {
        const end = this.pos.clone().addScaledVector(input.aim, T.RANGE * 0.55);
        this.cable = { state: 'whiff', end, t: 0, dur: 0.1 };
        this.emit('whiff');
      }
    }
    this.prevTether = input.tether;

    if (this.cable) {
      const cb = this.cable;
      if (cb.state === 'firing') {
        cb.t += dt;
        if (!input.tether) this.release(false);
        else if (cb.t >= cb.dur) this.latch(cb.port);
      } else if (cb.state === 'whiff') {
        cb.t += dt;
        if (cb.t >= cb.dur) this.cable = { state: 'retract', end: cb.end, t: 0, dur: 0.14 };
      } else if (cb.state === 'retract') {
        cb.t += dt;
        if (cb.t >= cb.dur) this.cable = null;
      } else if (cb.state === 'attached' && !input.tether && !cb.zipping) {
        this.release(true);
      }
    }

    if (this.hold) {
      if (input.anyMove || input.jumpPressed) this.hold = false;
      else { this.vel.set(0, 0, 0); return; }
    }

    const att = this.cable && this.cable.state === 'attached' ? this.cable : null;
    const v = this.vel;

    // forces
    v.y -= T.G * dt;
    if (att) {
      const a = att.port.pos;
      _n.subVectors(this.pos, a);
      const dist = _n.length(); _n.multiplyScalar(1 / Math.max(dist, 1e-4));
      if (input.jumpPressed && !att.zipping) { att.zipping = true; this.emit('zip'); }
      if (att.zipping) {
        att.L = Math.min(att.L, dist) - T.ZIP_REEL * dt;
        v.addScaledVector(_n, -T.ZIP_PULL * dt);
        // bleed sideways motion so the zip goes straight in
        const vr = v.dot(_n);
        _a.copy(v).addScaledVector(_n, -vr).multiplyScalar(1 - Math.min(1, 4 * dt));
        v.copy(_a).addScaledVector(_n, vr);
        if (dist < (att.port.core ? 7 : 5)) {
          if (att.port.core) { this.emit('core'); this.cable = null; return; }
          this.launch();
        }
      } else {
        let reel = T.REEL_AUTO;
        if (input.keys.w) reel += T.REEL_W;
        if (input.keys.s) reel -= T.REEL_AUTO + T.PAYOUT_S;
        att.L = THREE.MathUtils.clamp(att.L - reel * dt, 6, T.RANGE + 8);
        // steer: A/D push sideways, perpendicular to the line
        const steer = (input.keys.d ? 1 : 0) - (input.keys.a ? 1 : 0);
        if (steer) {
          _a.copy(input.right).addScaledVector(_n, -input.right.dot(_n));
          v.addScaledVector(_a, steer * T.STEER * dt);
        }
        // swing assist: keep the arc lively below the port
        if (this.pos.y < a.y - 1) {
          _a.copy(v).addScaledVector(_n, -v.dot(_n));
          const tl = _a.length();
          if (tl > 2) {
            const depth = Math.min(1, (a.y - this.pos.y) / Math.max(att.L, 1));
            v.addScaledVector(_a, (T.SWING_ASSIST * depth * dt) / tl);
          }
        }
      }
      // trace: the watcher's pulse runs down the line toward you
      const st = this.world.portState(att.port);
      if (att.watched && st !== 'watched') { att.watched = false; att.traceT = 0; this.emit('traceCut'); }
      if (att.watched) {
        att.traceT += dt;
        if (att.traceT >= T.TRACE_TIME) {
          this.cable = { state: 'retract', end: att.port.pos.clone(), t: 0, dur: 0.15 };
          v.multiplyScalar(0.55);
          this.flow = 0;
          this.emit('traced');
        }
      }
    } else if (this.grounded) {
      const wx = (input.keys.w ? 1 : 0) - (input.keys.s ? 1 : 0);
      const wy = (input.keys.d ? 1 : 0) - (input.keys.a ? 1 : 0);
      _a.set(0, 0, 0).addScaledVector(input.fwdH, wx).addScaledVector(input.rightH, wy);
      if (_a.lengthSq() > 1) _a.normalize();
      _a.multiplyScalar(T.RUN);
      const k = Math.min(1, 10 * dt);
      v.x += (_a.x - v.x) * k; v.z += (_a.z - v.z) * k;
      if (input.jumpPressed) { v.y = T.JUMP; this.grounded = false; this.emit('jump'); }
    } else {
      const wx = (input.keys.w ? 1 : 0) - (input.keys.s ? 1 : 0);
      const wy = (input.keys.d ? 1 : 0) - (input.keys.a ? 1 : 0);
      v.addScaledVector(input.fwdH, wx * T.AIR_ACCEL * dt).addScaledVector(input.rightH, wy * T.AIR_ACCEL * dt);
    }

    // soft speed cap, raised by flow
    const cap = T.CAP + this.flow * T.CAP_PER_FLOW + (this.cable && this.cable.zipping ? 30 : 0);
    const sp = v.length();
    if (sp > cap) v.multiplyScalar(Math.max(cap / sp, 1 - 2.5 * dt));

    this.pos.addScaledVector(v, dt);

    // rope constraint (inelastic): never further than L from the port
    const att2 = this.cable && this.cable.state === 'attached' ? this.cable : null;
    if (att2) {
      const a = att2.port.pos;
      _n.subVectors(this.pos, a);
      const dist = _n.length();
      if (dist > att2.L) {
        _n.multiplyScalar(1 / dist);
        this.pos.copy(a).addScaledVector(_n, att2.L);
        const vr = v.dot(_n);
        if (vr > 0) {
          const sp0 = v.length();
          v.addScaledVector(_n, -vr);
          // the moment the line snaps tight, most of the lost speed is turned into the swing
          // (Spider-Man style): you whip around the port instead of stopping dead
          if (!att2.taut) {
            const tl = v.length();
            if (tl > 0.5) v.multiplyScalar(Math.min(sp0, tl + vr * 0.65) / tl);
          }
        }
        att2.taut = true;
      } else if (dist < att2.L - 0.3) att2.taut = false;
    }

    this.collide();

    if (this.pos.y < T.RADIUS + 0.05) this.emit('floor');
  }

  collide() {
    const p = this.pos, v = this.vel, r = T.RADIUS;
    let ground = false;
    for (const b of this.world.colliders) {
      const dx = p.x - b.c.x, dy = p.y - b.c.y, dz = p.z - b.c.z;
      const reach = Math.max(b.hx, b.hz) * 1.42 + r;
      if (Math.abs(dy) > b.hy + r || dx * dx + dz * dz > reach * reach) continue;
      // into the box's local frame
      const lx = dx * b.cos - dz * b.sin, lz = dx * b.sin + dz * b.cos;
      const cx = Math.max(-b.hx, Math.min(b.hx, lx));
      const cy = Math.max(-b.hy, Math.min(b.hy, dy));
      const cz = Math.max(-b.hz, Math.min(b.hz, lz));
      let nx = lx - cx, ny = dy - cy, nz = lz - cz;
      let d2 = nx * nx + ny * ny + nz * nz;
      if (d2 > r * r) continue;
      let pen;
      if (d2 < 1e-8) {
        // centre inside: push out along the shallowest axis
        const ex = b.hx - Math.abs(lx), ey = b.hy - Math.abs(dy), ez = b.hz - Math.abs(lz);
        if (ey <= ex && ey <= ez) { nx = 0; ny = Math.sign(dy) || 1; nz = 0; pen = ey + r; }
        else if (ex <= ez) { nx = Math.sign(lx) || 1; ny = 0; nz = 0; pen = ex + r; }
        else { nx = 0; ny = 0; nz = Math.sign(lz) || 1; pen = ez + r; }
      } else {
        const d = Math.sqrt(d2);
        nx /= d; ny /= d; nz /= d; pen = r - d;
      }
      // back to world
      const wx = nx * b.cos + nz * b.sin, wz = -nx * b.sin + nz * b.cos;
      p.x += wx * pen; p.y += ny * pen; p.z += wz * pen;
      const vn = v.x * wx + v.y * ny + v.z * wz;
      if (vn < 0) {
        const bounce = ny > 0.7 ? 0 : 0.25;
        v.x -= wx * vn * (1 + bounce); v.y -= ny * vn * (1 + bounce); v.z -= wz * vn * (1 + bounce);
        if (ny <= 0.7 && -vn > 16) { this.flow = 0; this.touched = true; this.emit('bump', -vn); }
      }
      if (ny > 0.7) ground = true;
    }
    if (ground && !this.grounded) {
      this.touched = true;
      if (this.flow > 0) this.flow = 0;
      this.emit('land');
    }
    this.grounded = ground && !(this.cable && this.cable.state === 'attached' && this.cable.zipping);
    if (this.grounded) this.vel.multiplyScalar(1);
  }
}
