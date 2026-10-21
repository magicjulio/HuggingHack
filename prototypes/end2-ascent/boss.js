import * as THREE from "three";

// The end boss (fight, round 4): the brain of the floor-3 fight. The look comes
// from boss-model.js (boss agent, contract in BOSS.md); until that file loads,
// a procedural stub with the same API stands in (createStubBossModel below).
// Every number is in T.boss (main.js). Nothing here is tuned.
//
//   const boss = createBoss(T, hooks)
//   boss.start(phase)        the fight begins (phase 1..3, retries start later phases)
//   boss.update(dt, time)    per frame while on floor 3
//   boss.raycast(ray, max)   → { distance, part, weak } | null   (player rifle)
//   boss.modifier(part)      → { mult, crit, blocked }           (aim read-out)
//   boss.hit(part, dmg, from, byAlly) → { damage, crit, blocked, invuln }
//   boss.squadLanded(point, radius)   the squad's shockwave: interrupts winding-up hands
//   boss.target              ally / Maintainer proxy (hp, pos, isBoss, hit())
//   boss.threats             live tells for the smoke bot: [{ x, z, r, t, kind }]
//   boss.hp, maxHp, phase, invulnerable, active, dying, dead, done
//
// hooks = { scene, looks, arena (absolute coords), ground(x, z, y) → y,
//   player() → { pos, alive, evading }, damagePlayer(amount, from), pushPlayer(v),
//   allies() → [], hurtAlly(a, dmg), shake(a), sound(name), toast(text, t), hint(text, t),
//   burst(pos, color, n), spawnWave(phase, list), onPhase(phase), onDeath(), onDone(),
//   createModel(opts) → model }
//
// Hands: idle (float beside the face) → windup (fly over the target, red floor
// ring; `track` of the tell follows you) → slam (drop) → impact (damage, push,
// shake, breakables) → [drag: a sweep along a ring line | next ring of a chain]
// → down (lies there: the weak point, crit) → return. The squad's landing on a
// winding-up hand cuts the slam: the hand is stunned (weak) for a moment.
const UP = new THREE.Vector3(0, 1, 0);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ease = (k) => k * k * (3 - 2 * k);

export function createBoss(T, hooks) {
  const B = T.boss;
  const A = hooks.arena;
  const looks = hooks.looks;
  const model = hooks.createModel({ scene: hooks.scene, T, arena: A });
  const root = model.root;
  if (!root.parent) hooks.scene.add(root);
  root.position.set(A.bossHome.x, A.bossHome.y, A.bossHome.z);
  // the boss faces the middle of the arena (model faces +z in its own space)
  const yaw0 = Math.atan2(A.center.x - A.bossHome.x, A.center.z - A.bossHome.z);
  root.rotation.y = yaw0;
  const fwd = new THREE.Vector3(Math.sin(yaw0), 0, Math.cos(yaw0)),
    right = new THREE.Vector3(Math.cos(yaw0), 0, -Math.sin(yaw0));
  const floorY = hooks.ground(A.center.x, A.center.z, A.center.y) ?? A.center.y;

  let hp = B.hp,
    phase = 1,
    active = false,
    dying = 0,
    done = false,
    invuln = 0,
    roarT = 0,
    nextMove = B.startDelay,
    hurtK = 0,
    angryK = 0,
    flashCd = 0,
    time = 0,
    lastSide = "r",
    deathFired = false;
  const P = () => B.phases[phase];
  const thresholds = B.thresholds; // [0.66, 0.33]
  const phaseTop = (n) => (n === 1 ? 1 : thresholds[n - 2]) * B.hp;
  const phaseFloor = (n) => (n >= 3 ? 0 : thresholds[n - 1] * B.hp);

  // ---------------------------------------------------------------- hands
  const pool = []; // red floor rings (tells), reused
  const ring = () => pool.find((r) => !r.busy) || (pool.push({ look: looks.ring("lunge"), busy: false }), pool[pool.length - 1]);
  function makeHand(side) {
    const h = model.hands[side === "l" ? "l" : "r"];
    const p = new THREE.Vector3();
    idlePos(side, p, 0);
    return {
      side,
      part: side === "l" ? "hand_l" : "hand_r",
      m: h,
      pos: p, // palm position (world): what slams into the floor
      state: "idle",
      t: 0,
      tell: 1,
      target: new THREE.Vector3(),
      from: new THREE.Vector3(),
      queue: [], // remaining chain targets / sweep path
      move: null,
      ring: null,
      rings: [],
      hitPlayer: false,
      pose: "open",
      stun: 0,
    };
  }
  function idlePos(side, out, t) {
    const s = side === "l" ? -1 : 1;
    const H = B.hand;
    out.copy(A.bossHome).addScaledVector(right, s * H.idleSide).addScaledVector(fwd, H.idleFwd);
    out.y = A.bossHome.y + H.idleUp + Math.sin(t * 1.3 + (s > 0 ? 0 : 2)) * H.bob;
    return out;
  }
  const hands = { l: makeHand("l"), r: makeHand("r") };
  const list = [hands.l, hands.r];
  const busyAttack = (h) => h.state === "windup" || h.state === "slam" || h.state === "drag";

  // clamp a floor point into the slam zone (hands never land inside walls)
  function clampZone(p) {
    const zones = A.slamZone || [];
    if (!zones.length) return p;
    let best = null,
      bd = Infinity;
    for (const z of zones) {
      const x = THREE.MathUtils.clamp(p.x, z.minX, z.maxX),
        zz = THREE.MathUtils.clamp(p.z, z.minZ, z.maxZ);
      const d = Math.hypot(x - p.x, zz - p.z);
      if (d < bd) {
        bd = d;
        best = [x, zz];
      }
    }
    p.x = best[0];
    p.z = best[1];
    p.y = hooks.ground(p.x, p.z, floorY) ?? floorY;
    return p;
  }

  function setPose(h, pose, k = 1) {
    if (h.pose === pose && k === 1) return;
    h.pose = pose;
    model.setHandPose?.(h.side, pose, k);
  }

  // ---------------------------------------------------------------- moves
  // A move hands one or both hands a target (and a queue for chains/sweeps).
  function startWindup(h, target, tell, opts = {}) {
    h.state = "windup";
    h.t = 0;
    h.tell = tell;
    h.track = opts.track ?? P().track;
    h.target.copy(target);
    clampZone(h.target);
    h.from.copy(h.pos);
    h.move = opts.move || "single";
    h.shock = !!opts.shock;
    h.hitPlayer = false;
    if (!h.ring) {
      h.ring = ring();
      h.ring.busy = true;
    }
    setPose(h, "fist");
    if (!opts.quiet) hooks.sound("boss-tell");
  }
  function releaseRing(h) {
    if (h.ring) {
      h.ring.look.hide();
      h.ring.busy = false;
      h.ring = null;
    }
    for (const r of h.rings) {
      r.look.hide();
      r.busy = false;
    }
    h.rings.length = 0;
  }
  const playerPos = () => hooks.player().pos;
  const tmp = new THREE.Vector3(),
    tmp2 = new THREE.Vector3();

  function pickHand(target) {
    const idle = list.filter((h) => h.state === "idle");
    if (!idle.length) return null;
    if (idle.length === 1) return idle[0];
    // alternate, but prefer the hand on the target's side when it is clearly closer
    const dl = flat(hands.l.pos, target),
      dr = flat(hands.r.pos, target);
    if (Math.abs(dl - dr) > 8) return dl < dr ? hands.l : hands.r;
    return lastSide === "l" ? hands.r : hands.l;
  }
  function weighted(moves) {
    const entries = Object.entries(moves).filter(([k, w]) => w > 0 && canDo(k));
    if (!entries.length) return null;
    let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0);
    for (const [k, w] of entries) if ((r -= w) <= 0) return k;
    return entries[0][0];
  }
  function canDo(kind) {
    const idle = list.filter((h) => h.state === "idle").length;
    if (kind === "double" || kind === "shockwave") return idle === 2;
    return idle >= 1;
  }
  function startMove(kind) {
    const p = P();
    const pp = playerPos().clone();
    if (kind === "double") {
      // both hands at once: one on you, one where you are heading (or beside you)
      const v = hooks.player().vel || tmp.set(0, 0, 0);
      const lead = tmp2.copy(pp).addScaledVector(v, p.tell * 0.8);
      if (flat(lead, pp) < B.slam.radius * 1.6) lead.copy(pp).addScaledVector(right, (Math.random() < 0.5 ? -1 : 1) * B.slam.radius * 2.1);
      const a = flat(hands.l.pos, pp) < flat(hands.r.pos, pp) ? hands.l : hands.r;
      const b = a === hands.l ? hands.r : hands.l;
      startWindup(a, pp, p.tell, { move: "double", shock: !!p.doubleShock });
      startWindup(b, lead, p.tell, { move: "double", shock: !!p.doubleShock, track: 0, quiet: true });
      return;
    }
    if (kind === "shockwave") {
      // both hands together in front of the face: a ring of force rolls out
      const c = A.center.clone().lerp(A.bossHome, B.shockwave.originAt);
      c.y = floorY;
      startWindup(hands.l, tmp.copy(c).addScaledVector(right, -B.slam.radius * 0.9), p.tell * B.shockwave.tellScale, { move: "shockwave", shock: true, track: 0 });
      startWindup(hands.r, tmp.copy(c).addScaledVector(right, B.slam.radius * 0.9), p.tell * B.shockwave.tellScale, { move: "shockwave", shock: false, track: 0, quiet: true });
      hooks.toast(B.text.shockwave, 1.6);
      return;
    }
    const h = pickHand(pp);
    if (!h) return;
    lastSide = h.side;
    if (kind === "chain") {
      startWindup(h, pp, p.chain.tell, { move: "chain", track: p.chain.track });
      h.queue = [p.chain.count - 1];
      return;
    }
    if (kind === "sweep") {
      // a line of rings across your path; the hand lands at one end and drags to the other
      const S = B.sweep;
      const toP = tmp.subVectors(pp, A.bossHome).setY(0).normalize();
      const across = tmp2.set(toP.z, 0, -toP.x).multiplyScalar(Math.random() < 0.5 ? 1 : -1);
      const a = pp.clone().addScaledVector(across, -S.length / 2),
        b = pp.clone().addScaledVector(across, S.length / 2);
      clampZone(a);
      clampZone(b);
      startWindup(h, a, p.tell * S.tellScale, { move: "sweep", track: 0 });
      h.queue = [b];
      for (let i = 1; i <= S.rings; i++) {
        const r = ring();
        r.busy = true;
        r.at = a.clone().lerp(b, i / S.rings);
        h.rings.push(r);
      }
      return;
    }
    startWindup(h, pp, p.tell, { move: kind === "follow" ? "follow" : "single", track: kind === "follow" ? p.followTrack : p.track });
  }

  // ---------------------------------------------------------------- impact
  function impact(h, power = 1) {
    const S = B.slam,
      p = P(),
      at = h.target;
    const pl = hooks.player();
    hooks.sound("boss-slam");
    const d = flat(pl.pos, at);
    hooks.shake(THREE.MathUtils.lerp(S.shake, S.shakeFar, THREE.MathUtils.clamp(d / 30, 0, 1)) * power);
    if (pl.alive && d < S.radius + 0.25 && Math.abs(pl.pos.y - at.y) < 2.5) {
      hooks.damagePlayer(S.damage * p.damage * power, at);
      tmp.subVectors(pl.pos, at).setY(0);
      if (tmp.lengthSq() < 0.01) tmp.copy(fwd);
      hooks.pushPlayer(tmp.normalize().multiplyScalar(S.push));
    }
    for (const a of hooks.allies()) if (!a.dead && flat(a.pos, at) < S.radius) hooks.hurtAlly(a, S.allyDamage);
    if (A.breakAt) A.breakAt(at.x, at.z, S.radius, tmp2.subVectors(at, A.bossHome).setY(0).normalize());
    else for (const b of A.breakables || []) {
      if (b.broken) continue;
      const c = b.collider;
      const cx = THREE.MathUtils.clamp(at.x, c.minX, c.maxX),
        cz = THREE.MathUtils.clamp(at.z, c.minZ, c.maxZ);
      if (Math.hypot(cx - at.x, cz - at.z) < S.radius) {
        b.broken = true;
        b.break?.();
      }
    }
    shockRing(at, S.radius * 1.9, 0.35, 0xff6a3a, 0.9);
    hooks.burst(tmp.copy(at).setY(at.y + 0.4), 0xc9b48a, 22);
    hooks.burst(tmp.copy(at).setY(at.y + 0.2), 0xff8a3a, 10);
    model.impact?.(h.side, at);
    if (h.shock) waves.push({ c: at.clone(), r: S.radius, hit: false, life: B.shockwave.maxRadius / B.shockwave.speed });
  }

  // expanding red shockwave rings you dodge through (Space: the dodge's i-frames)
  const waves = [];
  const blips = []; // one-shot impact rings: { c, r1, t, life, color }
  function shockRing(c, r1, life, color, alpha) {
    blips.push({ c: c.clone(), r1, t: 0, life, col: new THREE.Color(color), alpha });
  }
  const fx = looks.fx;
  const waveRing = fx ? null : looks.ring("lunge");
  const C1 = new THREE.Color(0xff3b2e);
  if (fx)
    fx.onFrame(() => {
      for (const w of waves) fx.draw.ring(w.c, w.r, 3, 0, C1.r, C1.g, C1.b, 1.2);
      for (const b of blips) {
        const k = b.t / b.life;
        fx.draw.ring(b.c, 0.6 + (b.r1 - 0.6) * ease(Math.min(1, k)), 3, 0, b.col.r, b.col.g, b.col.b, b.alpha * (1 - k));
      }
    });
  function updateWaves(dt) {
    const W = B.shockwave;
    const pl = hooks.player();
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i];
      w.r += W.speed * dt;
      w.life -= dt;
      if (!w.hit && pl.alive) {
        const d = flat(pl.pos, w.c);
        if (Math.abs(d - w.r) < W.width / 2 + T.player.radius && Math.abs(pl.pos.y - w.c.y) < 1.5) {
          if (pl.evading) {
            w.hit = true; // dodged through it
            hooks.onDodge?.("shockwave");
          } else {
            w.hit = true;
            hooks.damagePlayer(W.damage * P().damage, w.c);
            tmp.subVectors(pl.pos, w.c).setY(0).normalize();
            hooks.pushPlayer(tmp.multiplyScalar(W.push));
          }
        }
      }
      if (w.life <= 0 || w.r > W.maxRadius) waves.splice(i, 1);
    }
    if (waveRing) {
      if (waves[0]) waveRing.set(waves[0].c, { radius: waves[0].r, progress: 0.97, time });
      else waveRing.hide();
    }
    for (let i = blips.length - 1; i >= 0; i--) if ((blips[i].t += dt) >= blips[i].life) blips.splice(i, 1);
  }

  // ---------------------------------------------------------------- per hand
  function updateHand(h, dt) {
    const H = B.hand,
      p = P();
    h.t += dt;
    if (h.state === "idle") {
      idlePos(h.side, tmp, time);
      h.pos.lerp(tmp, 1 - Math.exp(-dt * 3));
      setPose(h, "open");
    } else if (h.state === "windup") {
      const k = Math.min(1, h.t / h.tell);
      if (k < h.track) {
        tmp.copy(playerPos());
        h.target.lerp(clampZone(tmp), 1 - Math.exp(-dt * 10));
      }
      // fly over the target in the first part of the tell, rise a little at the end
      const over = tmp.copy(h.target);
      over.y = h.target.y + H.riseHeight + ease(Math.max(0, (k - 0.6) / 0.4)) * H.lift;
      h.pos.lerp(over, 1 - Math.exp(-dt * H.follow));
      h.ring.look.set(h.target, { radius: B.slam.radius, progress: k, time, alpha: 1 });
      for (const r of h.rings) r.look.set(r.at, { radius: B.slam.radius * 0.75, progress: k * 0.6, time, alpha: 0.7 });
      if (k >= 1) {
        h.state = "slam";
        h.t = 0;
        h.from.copy(h.pos);
        setPose(h, "slam");
      }
    } else if (h.state === "slam") {
      const k = Math.min(1, h.t / H.slamTime);
      h.pos.lerpVectors(h.from, h.target, k * k);
      h.ring.look.set(h.target, { radius: B.slam.radius, progress: 1, time, alpha: 1 });
      if (k >= 1) {
        h.pos.copy(h.target);
        impact(h);
        if (h.move === "chain" && h.queue[0] > 0) {
          h.queue[0]--;
          // the next ring of the chain: where you are now
          h.ring.look.hide();
          h.state = "windup";
          h.t = 0;
          h.tell = p.chain.tell;
          h.track = p.chain.track;
          h.target.copy(clampZone(tmp.copy(playerPos())));
          h.from.copy(h.pos);
          hooks.sound("boss-tell");
          return;
        }
        if (h.move === "sweep" && h.queue[0]) {
          h.state = "drag";
          h.t = 0;
          h.from.copy(h.pos);
          h.dragTo = h.queue.shift();
          h.dragLen = Math.max(0.1, flat(h.from, h.dragTo));
          h.ring.look.hide();
          return;
        }
        toDown(h);
      }
    } else if (h.state === "drag") {
      const S = B.sweep;
      const k = Math.min(1, (h.t * S.speed) / h.dragLen);
      h.pos.lerpVectors(h.from, h.dragTo, k);
      h.pos.y = hooks.ground(h.pos.x, h.pos.z, h.pos.y) ?? h.pos.y;
      // the ring line goes out as the hand passes each ring
      for (const r of h.rings) if (!r.gone && flat(r.at, h.from) <= k * h.dragLen + 0.2) (r.gone = true), r.look.hide();
      for (const r of h.rings) if (!r.gone) r.look.set(r.at, { radius: B.slam.radius * 0.75, progress: 1, time, alpha: 0.9 });
      const pl = hooks.player();
      if (!h.hitPlayer && pl.alive && flat(pl.pos, h.pos) < S.radius && !pl.evading) {
        h.hitPlayer = true;
        hooks.damagePlayer(S.damage * p.damage, h.pos);
        tmp.subVectors(pl.pos, h.pos).setY(0).normalize();
        hooks.pushPlayer(tmp.multiplyScalar(S.push));
      }
      if (Math.random() < 0.5) hooks.burst(tmp.copy(h.pos).setY(h.pos.y + 0.3), 0xc9b48a, 2);
      if (k >= 1) {
        h.target.copy(h.pos);
        for (const r of h.rings) r.gone = false;
        toDown(h);
      }
    } else if (h.state === "down" || h.state === "stunned") {
      if (h.state === "stunned") {
        h.pos.y += Math.sin(time * 18) * 0.02;
        h.stun -= dt;
      }
      if ((h.state === "down" && h.t >= p.down) || (h.state === "stunned" && h.stun <= 0)) {
        h.state = "return";
        h.t = 0;
        h.from.copy(h.pos);
        setPose(h, "open");
      }
    } else if (h.state === "return") {
      const k = Math.min(1, h.t / H.returnTime);
      idlePos(h.side, tmp, time);
      h.pos.lerpVectors(h.from, tmp, ease(k));
      if (k >= 1) h.state = "idle";
    }
  }
  function toDown(h) {
    h.state = "down";
    h.t = 0;
    h.queue.length = 0;
    releaseRing(h);
    setPose(h, "stuck");
    hooks.sound("boss-down");
  }
  // cancel any attack in progress (phase change, interrupt, death)
  function cancel(h, to = "return") {
    releaseRing(h);
    h.queue.length = 0;
    if (to === "stunned") {
      h.state = "stunned";
      h.stun = B.interrupt.stun;
      setPose(h, "stuck");
    } else if (h.state !== "idle") {
      h.state = "return";
      h.from.copy(h.pos);
      setPose(h, "open");
    }
    h.t = 0;
  }

  // Place the model's hand nodes so their palms sit at h.pos.
  const palmW = new THREE.Vector3(),
    rootW = new THREE.Vector3();
  function placeHand(h) {
    const node = h.m.root;
    const parent = node.parent;
    node.updateWorldMatrix(true, true);
    const palm = h.m.palm || node;
    palm.getWorldPosition(palmW);
    node.getWorldPosition(rootW);
    // world position wanted for the node: h.pos minus the palm offset
    tmp.copy(h.pos).sub(palmW).add(rootW);
    if (parent) parent.worldToLocal(tmp);
    node.position.copy(tmp);
  }

  // ---------------------------------------------------------------- hits
  const spheres = { face: new THREE.Sphere(), hand_l: new THREE.Sphere(), hand_r: new THREE.Sphere() };
  const box = new THREE.Box3(),
    size = new THREE.Vector3();
  function updateSpheres() {
    for (const part of model.hitParts()) {
      const s = spheres[part.part];
      if (!s) continue;
      box.setFromObject(part.object);
      if (box.isEmpty()) continue;
      box.getCenter(s.center);
      box.getSize(size);
      const hand = part.part !== "face" && model.hands[part.part === "hand_l" ? "l" : "r"];
      s.radius = hand?.radius ? Math.max(hand.radius, Math.max(size.x, size.y, size.z) * 0.42) : Math.max(size.x, size.y, size.z) * B.faceHit;
    }
  }
  const handOf = (part) => (part === "hand_l" ? hands.l : part === "hand_r" ? hands.r : null);
  const isWeak = (part) => {
    const h = handOf(part);
    return !!h && (h.state === "down" || h.state === "stunned");
  };
  const hitPoint = new THREE.Vector3();
  function raycast(ray, maxDist) {
    if (!active || done || dying) return null;
    let best = null;
    for (const part of ["face", "hand_l", "hand_r"]) {
      const s = spheres[part];
      if (!s.radius || !ray.intersectSphere(s, hitPoint)) continue;
      const d = hitPoint.distanceTo(ray.origin);
      if (d < maxDist && (!best || d < best.distance)) best = { distance: d, part, weak: isWeak(part) };
    }
    return best;
  }
  function modifier(part) {
    if (invuln > 0 || !active) return { mult: 0, crit: false, blocked: true };
    if (part === "face") return { mult: B.faceMult, crit: false, blocked: false };
    if (isWeak(part)) return { mult: B.handCrit, crit: true, blocked: false };
    return { mult: B.handArmour, crit: false, blocked: true };
  }
  function hit(part, damage, from, byAlly = false) {
    if (!active || done || dying) return { damage: 0, crit: false, blocked: true, invuln: false };
    const m = modifier(part);
    if (invuln > 0) return { damage: 0, crit: false, blocked: true, invuln: true };
    const dealt = damage * m.mult * (byAlly ? B.squadMult : 1);
    hp = Math.max(0, hp - dealt);
    if (flashCd <= 0) {
      model.flash?.(part);
      flashCd = 0.06;
    }
    if (m.crit) hurtK = Math.min(1, hurtK + 0.25);
    stats.damage += dealt;
    if (m.crit) stats.crit += dealt;
    if (byAlly) stats.squad += dealt;
    checkPhase();
    return { damage: dealt, crit: m.crit, blocked: m.blocked, invuln: false };
  }
  function checkPhase() {
    if (hp <= 0) return die();
    if (phase < 3 && hp <= phaseFloor(phase)) {
      hp = phaseFloor(phase); // no overflow through the roar
      enterPhase(phase + 1, true);
    }
  }
  function enterPhase(n, roar) {
    phase = n;
    model.setPhase?.(n);
    model.setDamage?.(n - 1);
    A.setMood?.(n - 1);
    for (const h of list) cancel(h);
    waves.length = 0;
    if (roar) {
      invuln = B.roar;
      roarT = B.roar;
      hooks.shake(B.roarShake);
      hooks.sound("boss-roar");
      hooks.toast(B.text.phase[n], B.roar + 0.6);
    }
    nextMove = (roar ? B.roar : 0) + B.phases[n].firstMove;
    hooks.onPhase?.(n);
    hooks.spawnWave(n, B.phases[n].wave);
    refillT = B.phases[n].refill?.after ?? Infinity;
    refills = 0;
  }
  let refillT = Infinity,
    refills = 0;

  // ---------------------------------------------------------------- death
  function die() {
    if (dying) return;
    hp = 0;
    dying = 1e-6;
    for (const h of list) cancel(h, "down");
    for (const h of list) {
      h.state = "dead";
      h.from.copy(h.pos);
      h.t = 0;
    }
    waves.length = 0;
    hooks.sound("boss-die");
    hooks.shake(B.death.shake);
    hooks.toast(B.text.death, B.death.time);
    hooks.onDeath?.();
  }
  function updateDeath(dt) {
    dying += dt;
    const k = Math.min(1, dying / B.death.time);
    model.setDying?.(k);
    // the hands fall, the face shudders, tilts and sinks
    for (const h of list) {
      const g = hooks.ground(h.pos.x, h.pos.z, h.pos.y) ?? floorY;
      h.pos.y = THREE.MathUtils.lerp(h.from.y, g, ease(Math.min(1, dying / 0.8)));
      if (dying > 0.8 && !h.landed) {
        h.landed = true;
        h.target.copy(h.pos);
        hooks.sound("boss-slam");
        hooks.burst(tmp.copy(h.pos).setY(h.pos.y + 0.4), 0xc9b48a, 18);
        shockRing(h.pos, 5, 0.5, 0xffb03a, 0.8);
        hooks.shake(0.35);
      }
    }
    root.position.y = A.bossHome.y - ease(k) * B.death.sink;
    root.rotation.x = ease(k) * B.death.tilt;
    root.position.x = A.bossHome.x + Math.sin(dying * 40) * 0.12 * (1 - k);
    if (Math.random() < 0.35 * (1 - k * 0.5)) {
      const s = spheres.face;
      tmp.copy(s.center).add(new THREE.Vector3((Math.random() - 0.5) * s.radius, (Math.random() - 0.5) * s.radius, (Math.random() - 0.5) * s.radius).multiplyScalar(1.4));
      hooks.burst(tmp, Math.random() < 0.5 ? 0xffd21e : 0xff8a3a, 10);
      if (Math.random() < 0.2) hooks.sound("kill-heavy");
    }
    if (flashCd <= 0) {
      model.flash?.("face");
      flashCd = 0.12;
    }
    if (dying >= B.death.time && !done) {
      done = true;
      hooks.onDone?.();
    }
  }

  // ---------------------------------------------------------------- per frame
  const stats = { damage: 0, crit: 0, squad: 0, healed: 0, phaseTime: [0, 0, 0, 0], slams: 0, interrupts: 0 };
  const look = new THREE.Vector3();
  let headYaw = 0,
    headPitch = 0;
  function update(dt, t) {
    time = t;
    flashCd -= dt;
    model.update?.(dt, t);
    if (!active) {
      for (const h of list) {
        idlePos(h.side, h.pos, t);
        placeHand(h);
      }
      expression(dt);
      updateSpheres();
      return;
    }
    if (dying) {
      updateDeath(dt);
      for (const h of list) placeHand(h);
      expression(dt);
      updateWaves(dt);
      updateSpheres();
      return;
    }
    stats.phaseTime[phase] += dt;
    invuln = Math.max(0, invuln - dt);
    roarT = Math.max(0, roarT - dt);
    hurtK = Math.max(0, hurtK - dt * 1.5);
    const pl = hooks.player();
    if (pl.alive) {
      // attack scheduler: next move when the cooldown is done and enough hands are free
      const p = P();
      const attacking = list.filter(busyAttack).length;
      const busy = list.filter((h) => h.state !== "idle").length;
      const free = p.concurrent === 1 ? busy === 0 : attacking < p.concurrent;
      if (roarT <= 0 && free) nextMove -= dt;
      if (nextMove <= 0 && roarT <= 0 && free) {
        const kind = weighted(p.moves);
        if (kind) {
          startMove(kind);
          stats.slams++;
          nextMove = THREE.MathUtils.lerp(p.gap[0], p.gap[1], Math.random());
        }
      }
      // refill: once the wave is down, a few more come in while the phase lasts
      const R = p.refill;
      if (R && refills < R.max) {
        refillT -= dt;
        if (refillT <= 0) {
          if (hooks.alive() <= R.below) {
            refills++;
            hooks.spawnWave(phase, [R.pool[(refills - 1) % R.pool.length]].map((k) => (typeof k === "string" ? { kind: k, via: R.via || "drop" } : k)));
          }
          refillT = R.every;
        }
      }
    }
    for (const h of list) {
      if (!pl.alive && busyAttack(h)) cancel(h);
      updateHand(h, dt);
      placeHand(h);
    }
    updateWaves(dt);
    // the face looks at you
    look.subVectors(pl.pos, A.bossHome);
    const wantYaw = THREE.MathUtils.clamp(Math.atan2(look.x, look.z) - yaw0, -B.headTurn, B.headTurn);
    headYaw = THREE.MathUtils.damp(headYaw, Math.atan2(Math.sin(wantYaw), Math.cos(wantYaw)), 3, dt);
    const wantPitch = THREE.MathUtils.clamp(-Math.atan2(A.bossHome.y + B.faceLift - pl.pos.y, Math.hypot(look.x, look.z)), -0.4, 0.15);
    headPitch = THREE.MathUtils.damp(headPitch, wantPitch, 3, dt);
    if (model.head) {
      model.head.rotation.y = headYaw;
      model.head.rotation.x = -headPitch * 0.6;
    }
    root.position.y = A.bossHome.y + Math.sin(t * 0.7) * B.hand.bob * 0.5;
    expression(dt);
    updateSpheres();
  }
  // Expressions: neutral (phases 1-2), angry (phase 3, blended in), roar (phase
  // change), hurt (crits, death). One dominant expression per frame.
  let shown = "";
  function expression(dt) {
    angryK = THREE.MathUtils.damp(angryK, phase >= 3 && active ? 1 : 0, 2, dt);
    let name = "neutral",
      k = 1;
    if (dying) name = "hurt";
    else if (roarT > 0) {
      name = "roar";
      k = Math.min(1, Math.min(B.roar - roarT, roarT) / 0.35);
    } else if (hurtK > 0.35) {
      name = "hurt";
      k = hurtK;
    } else if (angryK > 0.02) {
      name = "angry";
      k = angryK;
    }
    const key = name + ":" + k.toFixed(2);
    if (key !== shown) {
      shown = key;
      model.setExpression?.(name, k);
    }
  }

  // ---------------------------------------------------------------- squad and the Maintainer
  function squadLanded(point, radius) {
    let n = 0;
    if (!active || dying) return 0;
    for (const h of list) {
      if (h.state !== "windup") continue;
      const near = flat(h.target, point) < radius + B.slam.radius * 0.5 || flat(h.pos, point) < radius + (h.m.radius || 2);
      if (!near) continue;
      cancel(h, "stunned");
      n++;
    }
    if (n) {
      stats.interrupts += n;
      hurtK = 1;
      hooks.toast(B.text.interrupt, 1.8);
      hooks.sound("boss-down");
    }
    return n;
  }
  // The proxy allies shoot and the Maintainer heals: stands on the floor in front
  // of the face (`pos`), its hit centre is the face (pos.y + cfg.height).
  const anchor = new THREE.Vector3();
  {
    // the walkable point nearest the boss on the line to the arena centre
    for (let k = 0; k <= 1.0001; k += 0.05) {
      anchor.lerpVectors(A.bossHome, A.center, k);
      anchor.y = floorY;
      const zoneOk = !(A.slamZone || []).length || A.slamZone.some((z) => anchor.x >= z.minX && anchor.x <= z.maxX && anchor.z >= z.minZ && anchor.z <= z.maxZ);
      if (zoneOk) break;
    }
    anchor.addScaledVector(fwd, B.tetherIn);
    anchor.y = hooks.ground(anchor.x, anchor.z, floorY) ?? floorY;
  }
  const target = {
    isBoss: true,
    kind: "boss",
    pos: anchor,
    cfg: { height: 1 },
    lift: 0,
    dropY: 0,
    spawn: 1,
    dormant: false,
    yaw: yaw0 + Math.PI,
    model: { setHealth() {} },
    get dead() {
      return !active || !!dying || done;
    },
    get maxHp() {
      return phaseTop(phase); // a Maintainer can heal up to the top of the current phase
    },
    get hp() {
      return hp;
    },
    set hp(v) {
      // Maintainer heal: amount × T.boss.heal.scale, capped at the phase's top
      if (!active || dying || invuln > 0) return;
      const add = (v - hp) * B.heal.scale;
      if (add <= 0) return;
      const before = hp;
      hp = Math.min(phaseTop(phase), hp + add);
      stats.healed += hp - before;
    },
    hit(damage, from) {
      return hit("face", damage, from, true);
    },
  };
  function syncTarget() {
    target.cfg.height = Math.max(1, spheres.face.center.y - anchor.y);
  }

  function start(n = 1) {
    active = true;
    dying = 0;
    done = false;
    deathFired = false;
    hp = phaseTop(n);
    invuln = 0;
    roarT = 0;
    root.position.set(A.bossHome.x, A.bossHome.y, A.bossHome.z);
    root.rotation.set(0, yaw0, 0);
    for (const h of list) {
      releaseRing(h);
      h.state = "idle";
      h.landed = false;
      idlePos(h.side, h.pos, time);
    }
    waves.length = 0;
    phase = n;
    model.setPhase?.(n);
    model.setDamage?.(n - 1);
    A.setMood?.(n - 1, true);
    A.resetBreakables?.();
    shown = "";
    angryK = n >= 3 ? 1 : 0;
    enterPhase(n, false);
    nextMove = B.startDelay;
  }
  function stop() {
    active = false;
    for (const h of list) releaseRing(h);
    waves.length = 0;
    A.setMood?.(0);
  }

  return {
    model,
    root,
    start,
    stop,
    update(dt, t) {
      update(dt, t);
      syncTarget();
    },
    raycast,
    modifier,
    hit,
    squadLanded,
    // a grace before the next move (phase retries)
    delay(s) {
      nextMove = Math.max(nextMove, s);
    },
    setVisible(v) {
      root.visible = v;
      for (const h of list) if (h.m.root !== root && !root.getObjectById(h.m.root.id)) h.m.root.visible = v;
    },
    target,
    stats,
    hands,
    get threats() {
      const out = [];
      for (const h of list) {
        if (h.state === "windup") out.push({ x: h.target.x, z: h.target.z, r: B.slam.radius, t: h.tell - h.t, kind: h.move, side: h.side });
        else if (h.state === "slam") out.push({ x: h.target.x, z: h.target.z, r: B.slam.radius, t: 0, kind: h.move, side: h.side });
        if (h.state === "windup" || h.state === "slam" || h.state === "drag")
          for (const r of h.rings) if (!r.gone) out.push({ x: r.at.x, z: r.at.z, r: B.sweep.radius, t: h.state === "windup" ? h.tell - h.t : 0, kind: "sweep", side: h.side });
      }
      return out;
    },
    get waves() {
      return waves.map((w) => ({ x: w.c.x, z: w.c.z, r: w.r, speed: B.shockwave.speed, hit: w.hit }));
    },
    weakParts() {
      return list.filter((h) => h.state === "down" || h.state === "stunned").map((h) => ({ part: h.part, center: spheres[h.part].center.clone(), left: h.state === "down" ? P().down - h.t : h.stun }));
    },
    sphere: (part) => spheres[part],
    get hp() {
      return hp;
    },
    set hp(v) {
      // test hook: jump the health (crossing a threshold still triggers the phase change)
      hp = Math.max(0, Math.min(B.hp, v));
      checkPhase();
    },
    get maxHp() {
      return B.hp;
    },
    get phase() {
      return phase;
    },
    get invulnerable() {
      return invuln > 0;
    },
    get roaring() {
      return roarT > 0;
    },
    get active() {
      return active;
    },
    get dying() {
      return !!dying;
    },
    get dead() {
      return !!dying || done;
    },
    get done() {
      return done;
    },
    dispose() {
      stop();
      for (const r of pool) r.look.dispose();
      waveRing?.dispose();
      fx && (waves.length = blips.length = 0);
      model.dispose?.();
      root.parent?.remove(root);
    },
  };
}

// ---------------------------------------------------------------------------
// Stub boss model with the BOSS.md API: a rough yellow face and two box hands.
// Only used until boss-model.js (boss agent) loads.
export function createStubBossModel({ scene }) {
  const root = new THREE.Group();
  root.name = "boss (stub)";
  const R = 7;
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd21e, roughness: 0.6, metalness: 0.1, emissive: 0x000000 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a2a12, roughness: 0.8 });
  const head = new THREE.Group();
  head.position.y = R;
  root.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), yellow);
  head.add(face);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(R * 0.13, 12, 10), dark);
    e.position.set(s * R * 0.35, R * 0.22, R * 0.9);
    head.add(e);
    return e;
  });
  const brows = [-1, 1].map((s) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(R * 0.36, R * 0.07, R * 0.1), dark);
    b.position.set(s * R * 0.35, R * 0.45, R * 0.88);
    b.userData.s = s;
    head.add(b);
    return b;
  });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(R * 0.38, R * 0.06, 8, 20, Math.PI), dark);
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, -R * 0.12, R * 0.93);
  head.add(mouth);
  const handMat = new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.55, metalness: 0.2, emissive: 0x000000 });
  const hands = {};
  for (const side of ["l", "r"]) {
    const g = new THREE.Group();
    const palmMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 3.6), handMat.clone());
    palmMesh.position.y = 0.9;
    g.add(palmMesh);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 1.6), palmMesh.material);
      f.position.set(-1.2 + i * 0.8, 0.9, 2.4);
      g.add(f);
    }
    const palm = new THREE.Object3D();
    palm.position.y = 0;
    g.add(palm);
    scene.add(g);
    hands[side] = { root: g, palm, radius: 2.4, mat: palmMesh.material };
  }
  let flashT = 0,
    flashPart = "face";
  const expr = { name: "neutral", k: 0 };
  return {
    root,
    head,
    hands,
    hitParts: () => [
      { part: "face", object: face, weak: false },
      { part: "hand_l", object: hands.l.root, weak: false },
      { part: "hand_r", object: hands.r.root, weak: false },
    ],
    setExpression(name, k) {
      expr.name = name;
      expr.k = k;
    },
    setDamage() {},
    setPhase(n) {
      yellow.emissive.setHex(n >= 3 ? 0x330400 : 0x000000);
    },
    setHandPose(side, pose) {
      hands[side].mat.emissive.setHex(pose === "stuck" ? 0x884400 : 0x000000);
    },
    flash(part) {
      flashT = 0.08;
      flashPart = part;
    },
    update(dt) {
      flashT -= dt;
      const angry = expr.name === "angry" ? expr.k : 0,
        roar = expr.name === "roar" ? expr.k : 0;
      for (const b of brows) b.rotation.z = -b.userData.s * angry * 0.5;
      mouth.scale.set(1, 1 - angry * 1.6 + roar, 1);
      for (const e of eyes) e.scale.y = 1 - angry * 0.4;
      face.material.emissiveIntensity = 1;
      if (flashT > 0 && flashPart === "face") face.material.emissive.setHex(0x442200);
      else if (flashT <= 0) face.material.emissive.setHex(expr.name === "angry" ? 0x330400 : 0x000000);
    },
    ready: Promise.resolve(),
    dispose() {
      for (const h of Object.values(hands)) scene.remove(h.root);
    },
  };
}
