// The orb and its link (the "bionic arm"): fire, yank, swing, reel, release.
import * as THREE from 'three';
const V = THREE.Vector3;

export const P = {
  R: 0.45,            // orb radius
  G: 38,              // gravity
  LINK_RANGE: 36,     // how far a link can reach
  SWING_LEN: 12,      // rope length the link yanks you to after latching
  MIN_LEN: 2.2,       // shortest rope (fully reeled in)
  YANK: 34,           // speed at which the link pulls the rope in after latching
  REEL: 18,           // Space: reel speed
  LINK_SPEED: 190,    // link head travel speed
  RETRACT_SPEED: 260,
  AIR_ACC: 10, SWING_ACC: 18,
  GROUND_ACC: 55, GROUND_MAX: 13, JUMP: 14,
  MAX_SPEED: 62,
  SLING_MUL: 1.22, SLING_UP: 3,
};

const _a = new V(), _b = new V(), _n = new V();

export class Player {
  constructor() {
    this.pos = new V(); this.vel = new V();
    this.grounded = false; this.groundHost = null; this.inVent = null;
    this.link = { mode: 0, port: null, tip: new V(), target: new V(), L: 0, Lt: 0 }; // mode 0 idle, 1 flying, 2 latched, 3 retracting
    this.taut = false; this.stun = 0; this.inWindow = false;
  }
  reset(p) {
    this.pos.copy(p); this.vel.set(0, 0, 0);
    Object.assign(this.link, { mode: 0, port: null, L: 0, Lt: 0 });
    this.link.tip.copy(p);
    this.stun = 0; this.grounded = false; this.inWindow = false; this.taut = false;
  }
  get linked() { return this.link.mode === 2; }

  fireAt(port, ev) {
    const L = this.link; L.mode = 1; L.port = port; L.tip.copy(this.pos); L.target.copy(port.pos); ev.fire();
  }
  fireMiss(point, ev) {
    const L = this.link; L.mode = 1; L.port = null; L.tip.copy(this.pos); L.target.copy(point); ev.fire();
  }
  cut() {
    const L = this.link;
    if (L.mode === 1 || L.mode === 2) { L.mode = 3; L.port = null; }
  }
  release(ev) {
    const L = this.link; if (L.mode !== 2) return;
    let sling = false;
    if (this.inWindow) { this.vel.multiplyScalar(P.SLING_MUL); this.vel.y += P.SLING_UP; sling = true; }
    if (L.L < 3.8) this.vel.y = Math.max(this.vel.y, 13); // reeled all the way in: pop up over the edge
    const zip = L.L > L.Lt + 0.5;
    const port = L.port; L.mode = 3; L.port = null; this.inWindow = false;
    ev.release(sling, port, zip);
  }

  step(dt, input, world, ev) {
    const L = this.link, v = this.vel;
    this.stun = Math.max(0, this.stun - dt);

    // ---- link head ----
    if (L.mode === 1) {
      if (!input.link) { L.mode = 3; L.port = null; }
      else {
        _a.subVectors(L.target, L.tip); const d = _a.length(), s = P.LINK_SPEED * dt;
        if (d <= s) {
          L.tip.copy(L.target);
          if (L.port) {
            if (world.usable(L.port)) {
              L.mode = 2; L.L = this.pos.distanceTo(L.port.anchor); L.Lt = Math.min(L.L, P.SWING_LEN);
              ev.latch(L.port);
            } else { const p = L.port; L.mode = 3; L.port = null; ev.denied(p); }
          } else { L.mode = 3; ev.miss(L.tip); }
        } else L.tip.addScaledVector(_a, s / d);
      }
    } else if (L.mode === 3) {
      _a.subVectors(this.pos, L.tip); const d = _a.length(), s = P.RETRACT_SPEED * dt;
      if (d <= s + 0.3) L.mode = 0; else L.tip.addScaledVector(_a, s / d);
    }
    if (L.mode === 2 && !input.link) this.release(ev);
    const linked = L.mode === 2;
    if (linked) L.tip.copy(L.port.pos);

    // ---- forces ----
    v.y -= P.G * dt;
    const w = input.wish;
    if (this.grounded && !linked) {
      v.x += w.x * P.GROUND_ACC * dt; v.z += w.z * P.GROUND_ACC * dt;
      const hs = Math.hypot(v.x, v.z);
      const moving = w.x * w.x + w.z * w.z > 0.01;
      const fr = hs > P.GROUND_MAX ? 2.5 : (moving ? 0 : 9);
      const k = Math.exp(-fr * dt); v.x *= k; v.z *= k;
      if (input.jump) { v.y = P.JUMP; this.grounded = false; ev.jump(); }
    } else {
      const acc = linked ? P.SWING_ACC : P.AIR_ACC;
      v.x += w.x * acc * dt; v.z += w.z * acc * dt;
      v.multiplyScalar(1 - 0.03 * dt);
    }
    this.inVent = null;
    for (const vt of world.vents) {
      const dx = this.pos.x - vt.x, dz = this.pos.z - vt.z;
      if (dx * dx + dz * dz < vt.r * vt.r && this.pos.y < vt.top + 10) {
        const f = this.pos.y < vt.top ? 1 : 1 - (this.pos.y - vt.top) / 10;
        v.y += ((vt.lift - v.y) * 3.2 + P.G) * f * dt;
        this.inVent = vt;
      }
    }

    // ---- rope length: yank after latching, reel with Space ----
    let shrink = 0, anchor = null;
    if (linked) {
      anchor = L.port.anchor;
      const dist = this.pos.distanceTo(anchor);
      if (input.reel) L.Lt = Math.max(P.MIN_LEN, Math.min(L.Lt, dist) - P.REEL * dt);
      L.L = Math.max(L.Lt, Math.min(L.L, dist)); // rope takes up slack, never below target
      if (L.L > L.Lt) { const nl = Math.max(L.Lt, L.L - P.YANK * dt); shrink = L.L - nl; L.L = nl; }
    }

    const sp = v.length();
    if (sp > P.MAX_SPEED) v.multiplyScalar(P.MAX_SPEED / sp);
    this.pos.addScaledVector(v, dt);

    // ---- rope constraint ----
    this.taut = false;
    if (linked) {
      _a.subVectors(this.pos, anchor); const d = _a.length();
      // while the link is pulling in (yank or reel) it acts like a rigid arm, after that like a rope
      const pulling = shrink > 0;
      if ((d > L.L || (pulling && d < L.L)) && d > 1e-6) {
        _n.copy(_a).divideScalar(d);
        this.pos.copy(anchor).addScaledVector(_n, L.L);
        const vr = v.dot(_n), sr = shrink / dt;
        if (vr > -sr || pulling) {
          if (input.reel && shrink > 0) {
            // reeling in a taut rope speeds up the swing (angular momentum)
            _b.copy(v).addScaledVector(_n, -vr).multiplyScalar(Math.min(1 + 1.2 * dt, (L.L + shrink) / L.L));
            v.copy(_b).addScaledVector(_n, -sr);
          } else v.addScaledVector(_n, -sr - vr);
        }
        this.taut = true;
      }
    }

    // ---- collisions (sphere vs boxes) ----
    const wasGrounded = this.grounded; const preVy = v.y;
    this.grounded = false; this.groundHost = null;
    const R = P.R, p = this.pos;
    for (const b of world.boxes) {
      if (p.x < b.min.x - R || p.x > b.max.x + R || p.y < b.min.y - R || p.y > b.max.y + R || p.z < b.min.z - R || p.z > b.max.z + R) continue;
      const cx = Math.min(Math.max(p.x, b.min.x), b.max.x), cy = Math.min(Math.max(p.y, b.min.y), b.max.y), cz = Math.min(Math.max(p.z, b.min.z), b.max.z);
      let dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= R * R) continue;
      let push;
      if (d2 > 1e-10) { const d = Math.sqrt(d2); dx /= d; dy /= d; dz /= d; push = R - d; }
      else {
        // centre inside the box: leave along the shallowest axis
        const pen = [p.x - b.min.x, b.max.x - p.x, p.y - b.min.y, b.max.y - p.y, p.z - b.min.z, b.max.z - p.z];
        let mi = 0; for (let i = 1; i < 6; i++) if (pen[i] < pen[mi]) mi = i;
        dx = mi === 0 ? -1 : mi === 1 ? 1 : 0; dy = mi === 2 ? -1 : mi === 3 ? 1 : 0; dz = mi === 4 ? -1 : mi === 5 ? 1 : 0;
        push = pen[mi] + R;
      }
      p.x += dx * push; p.y += dy * push; p.z += dz * push;
      const vn = v.x * dx + v.y * dy + v.z * dz;
      if (vn < 0) { const k = dy > 0.6 ? 1 : 1.12; v.x -= dx * vn * k; v.y -= dy * vn * k; v.z -= dz * vn * k; }
      if (dy > 0.6) { this.grounded = true; this.groundHost = b.host; }
    }
    if (this.grounded && !wasGrounded && preVy < -9) ev.land(-preVy);

    // ---- floor ----
    if (p.y < R) {
      if (this.inVent) { p.y = R; if (v.y < 0) v.y = 0; }
      else ev.floor();
    }

    // ---- sling window: release now for a boost ----
    this.inWindow = false;
    if (linked && this.taut) {
      const s = v.length();
      if (s > 14 && v.y > 0) {
        const r = v.y / s;
        if (r > 0.22 && r < 0.75) {
          _a.subVectors(p, anchor);
          if (_a.x * v.x + _a.z * v.z > 0) this.inWindow = true;
        }
      }
    }
  }
}
