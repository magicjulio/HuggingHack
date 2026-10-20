import * as THREE from "three";

// Enemy behaviours for the combat redesign. One function per kind; actors.js
// owns the shared state (spawn-in, targeting, stagger, damage) and calls
// BEHAVIOUR[kind](e, c) once per frame with a context:
//   c = { dt, time, target, player, floor (T.floors[n]), api }
// `api` is the small toolkit actors.js exposes (movement, line of sight, bolts,
// telegraph lines, attack slots, cover posts, player damage and push).
// Every number comes from e.cfg (= T.enemies[kind]); nothing is tuned here.

const v = new THREE.Vector3();

// Shared ranged burst: red telegraph line → N bolts. Gunners and shield-bearers.
function burst(e, c, visible, distance, allowed = true) {
  const { api, dt, target } = c;
  if (e.windup > 0) {
    e.windup -= dt;
    api.aim(e, target);
    if (e.windup <= 0) {
      api.hideAim(e);
      e.shots = e.cfg.burst;
      e.shotTimer = 0;
      e.expose = e.cfg.expose || 0;
    }
    return;
  }
  if (e.shots > 0) {
    e.shotTimer -= dt;
    if (e.shotTimer <= 0) {
      api.shoot(e, target);
      e.shots--;
      e.shotTimer = e.cfg.shotGap;
    }
    if (e.shots === 0) e.timer = e.cfg.interval * c.floor.fireScale * (0.85 + Math.random() * 0.3);
    return;
  }
  e.timer -= dt;
  if (
    allowed &&
    e.timer <= 0 &&
    visible &&
    distance < e.cfg.maxRange &&
    api.facingWithin(e, target.pos, 0.5) &&
    api.attackSlots() > 0
  ) {
    e.windup = e.cfg.telegraph;
    api.sound("enemy-tell");
  }
}
const busy = (e) => e.windup > 0 || e.shots > 0;

export const BEHAVIOUR = {
  // Holds a post behind low cover, ducks, and rises to fire. If the player can
  // see it while it is ducked (flanked), it relocates to another post.
  gunner(e, c) {
    const { api, dt, target, time } = c;
    const cfg = e.cfg;
    api.face(e, target.pos, dt);
    const advancing = e.mode === "advance";
    const distance = e.pos.distanceTo(target.pos);
    if (!advancing) {
      e.postTimer -= dt;
      const seenDucked = e.atPost && !busy(e) && api.visibleFrom(e, target, -cfg.duck);
      e.flankedFor = seenDucked ? e.flankedFor + dt : 0;
      if (!busy(e) && (e.postTimer <= 0 || e.flankedFor > cfg.relocate)) {
        e.post = api.coverPost(e, target.pos);
        e.postTimer = cfg.repost * (0.8 + Math.random() * 0.4);
        e.flankedFor = 0;
      }
    } else e.post = null;
    e.atPost = false;
    if (e.post && !busy(e)) {
      if (Math.hypot(e.pos.x - e.post.x, e.pos.z - e.post.z) > 0.4) api.moveToward(e, e.post, cfg.speed, dt);
      else e.atPost = true;
    }
    e.liftGoal = busy(e) ? cfg.pop : e.atPost ? -cfg.duck : 0;
    const visible = api.visibleFrom(e, target, cfg.pop);
    const range = advancing ? cfg.pushRange : cfg.range;
    if (!e.post && !busy(e)) {
      if (!visible || distance > range) api.moveToward(e, target.pos, cfg.speed, dt);
      else api.strafe(e, cfg.speed, dt, time);
    }
    // Moving to a post: hold fire until it gets there (unless already in the open close by).
    burst(e, c, visible, distance, !e.post || e.atPost || distance < range * 0.6);
  },

  // Frontal block; advances to mid range, opens during its own burst, and
  // bashes a player who comes too close (knock-back out of cover).
  shield(e, c) {
    const { api, dt, target, player, time } = c;
    const cfg = e.cfg;
    api.face(e, target.pos, dt);
    const distance = e.pos.distanceTo(target.pos);
    if (e.bash > 0) {
      e.bash -= dt;
      if (e.bash <= 0) {
        e.bashCd = cfg.bashCooldown;
        if (player.alive && e.pos.distanceTo(player.pos) < cfg.bashRange + 0.6) {
          v.subVectors(player.pos, e.pos).setY(0).normalize();
          api.damagePlayer(cfg.bashDamage * c.floor.damage, e.pos);
          api.pushPlayer(v.multiplyScalar(cfg.bashPush));
          api.sound("bash");
        }
      }
      return;
    }
    e.bashCd -= dt;
    if (target === player && player.alive && distance < cfg.bashRange && e.bashCd <= 0 && !busy(e)) {
      e.bash = cfg.bashWindup;
      api.sound("enemy-tell");
      return;
    }
    const visible = api.visibleFrom(e, target, 0);
    const range = e.mode === "advance" ? cfg.pushRange : cfg.range;
    if (!busy(e)) {
      if (!visible || distance > range) api.moveToward(e, target.pos, cfg.speed, dt);
      else api.strafe(e, cfg.speed, dt, time);
    }
    burst(e, c, visible, distance);
  },

  // Rusher: weaves in, telegraphs with a red floor ring on the target, then
  // lunges straight through (and over) low cover. Dodge it or kill it early.
  hugger(e, c) {
    const { api, dt, target, player, time } = c;
    const cfg = e.cfg;
    if (e.state === "tell") {
      e.tell -= dt;
      const t = 1 - e.tell / cfg.telegraph;
      if (t < cfg.track) e.lungeTo.copy(target.pos);
      api.face(e, e.lungeTo, dt);
      api.ring(e, e.lungeTo, { radius: cfg.contact + 0.3, progress: t, time });
      if (e.tell <= 0) {
        e.state = "lunge";
        e.lungeDir.subVectors(e.lungeTo, e.pos).setY(0);
        e.lungeLeft = Math.min(e.lungeDir.length() + 1.6, cfg.lungeSpeed * cfg.lungeTime);
        e.lungeLen = e.lungeLeft;
        e.lungeDir.normalize();
        e.lungeHit = false;
        api.hideRing(e);
        api.sound("lunge");
      }
      return;
    }
    if (e.state === "lunge") {
      const step = Math.min(e.lungeLeft, cfg.lungeSpeed * dt);
      api.moveFree(e, v.copy(e.lungeDir).multiplyScalar(step));
      e.lungeLeft -= step;
      e.lift = Math.sin(Math.PI * (1 - e.lungeLeft / e.lungeLen)) * cfg.arc;
      if (!e.lungeHit) {
        if (player.alive && Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z) < cfg.contact) {
          e.lungeHit = true;
          api.damagePlayer(cfg.damage * c.floor.damage, e.pos);
          api.pushPlayer(v.copy(e.lungeDir).multiplyScalar(cfg.push));
          api.sound("bash");
        } else {
          const ally = api.allyNear(e.pos, cfg.contact);
          if (ally) {
            e.lungeHit = true;
            api.hurtAlly(ally, cfg.damage);
          }
        }
      }
      if (e.lungeLeft <= 0.001) {
        e.state = "recover";
        e.rec = cfg.recover;
        e.lift = 0;
        api.unstick(e);
      }
      return;
    }
    if (e.state === "recover") {
      e.rec -= dt;
      if (e.rec <= 0) {
        e.state = "approach";
        e.cool = cfg.cooldown;
      }
      return;
    }
    // Approach: weave toward the target.
    e.cool -= dt;
    api.face(e, target.pos, dt);
    const distance = e.pos.distanceTo(target.pos);
    if (distance > cfg.lungeRange * 0.8) {
      v.subVectors(target.pos, e.pos).setY(0).normalize();
      const weave = Math.sin(time * cfg.weaveRate + e.phase) * cfg.weave;
      const goal = target.pos.clone().addScaledVector(new THREE.Vector3(v.z, 0, -v.x), weave);
      api.moveToward(e, goal, cfg.speed, dt, true);
    }
    // Scrambles over low cover on the way in instead of getting stuck behind it.
    e.lift = THREE.MathUtils.damp(e.lift, api.coverUnder(e), 14, dt);
    if (distance < cfg.lungeRange && e.cool <= 0 && api.lungeSlots() > 0 && api.visibleFrom(e, target, cfg.arc, true)) {
      e.state = "tell";
      e.tell = cfg.telegraph;
      e.lungeTo.copy(target.pos);
      api.sound("enemy-tell");
    }
  },

  // Heavy emplacement. Charges (thin red sight line), then sweeps a beam that
  // cover stops, then vents: the armoured front opens and the rear core flares.
  warden(e, c) {
    const { api, dt, target } = c;
    const cfg = e.cfg;
    const turn = e.state === "beam" ? cfg.beamTurn : cfg.turn;
    if (e.state !== "vent") api.face(e, target.pos, dt, turn);
    // Pitch the projector toward the target's centre.
    const from = api.beamOrigin(e);
    const to = api.center(target);
    const flat = Math.hypot(to.x - from.x, to.z - from.z);
    e.aimPitch = THREE.MathUtils.damp(e.aimPitch, Math.atan2(to.y - from.y, flat), 3, dt);
    if (e.state === "cool") {
      e.timer -= dt;
      if (e.timer <= 0 && from.distanceTo(to) < cfg.range && api.visibleFrom(e, target, 0)) {
        e.state = "charge";
        e.t = cfg.telegraph;
        api.sound("warden-charge");
      }
      api.hideBeam(e);
    } else if (e.state === "charge") {
      e.t -= dt;
      api.sweep(e, false, cfg.telegraph ? 1 - e.t / cfg.telegraph : 1);
      if (e.t <= 0) {
        e.state = "beam";
        e.t = cfg.beamTime;
        api.sound("warden-beam");
      }
    } else if (e.state === "beam") {
      e.t -= dt;
      api.sweep(e, true, 1, cfg.beamDps * c.floor.damage * dt);
      if (e.t <= 0) {
        e.state = "vent";
        e.t = cfg.vent;
        e.expose = cfg.vent;
        api.hideBeam(e);
        api.sound("vent");
      }
    } else if (e.state === "vent") {
      e.t -= dt;
      if (e.t <= 0) {
        e.state = "cool";
        e.timer = cfg.cooldown;
      }
    }
  },

  // Support: hangs back, flees the player, heals the most damaged defender in
  // range through a visible tether. Never attacks.
  maintainer(e, c) {
    const { api, dt, player } = c;
    const cfg = e.cfg;
    const patient = api.mostDamaged(e, cfg.healRange * 2);
    let goal = null;
    if (player.alive && e.pos.distanceTo(player.pos) < cfg.keepAway) {
      v.subVectors(e.pos, player.pos).setY(0).normalize();
      goal = e.pos.clone().addScaledVector(v, 3);
    } else if (patient && e.pos.distanceTo(patient.pos) > cfg.healRange * 0.7) {
      v.subVectors(patient.pos, player.pos).setY(0).normalize();
      goal = patient.pos.clone().addScaledVector(v, cfg.healRange * 0.4);
    }
    if (goal) api.moveToward(e, goal, goal && player.alive && e.pos.distanceTo(player.pos) < cfg.keepAway ? cfg.fleeSpeed : cfg.speed, dt);
    api.face(e, patient ? patient.pos : player.pos, dt);
    e.healing = false;
    if (patient && e.pos.distanceTo(patient.pos) < cfg.healRange && api.visibleFrom(e, patient, 0)) {
      e.healing = true;
      api.heal(e, patient, cfg.heal * dt);
    } else api.hideTether(e);
  },
};

// What a stagger interrupts, per kind.
export function interrupt(e, api) {
  e.windup = 0;
  e.shots = 0;
  e.bash = 0;
  e.timer = Math.max(e.timer || 0, 0.7);
  api.hideAim(e);
  if (e.kind === "hugger" && (e.state === "tell" || e.state === "lunge")) {
    e.state = "recover";
    e.rec = e.cfg.recover;
    e.lift = 0;
    api.hideRing(e);
    api.unstick(e);
  }
  if (e.kind === "warden" && (e.state === "charge" || e.state === "beam")) {
    e.state = "vent";
    e.t = e.cfg.vent;
    e.expose = e.cfg.vent;
    api.hideBeam(e);
  }
  if (e.kind === "maintainer") api.hideTether(e);
}
