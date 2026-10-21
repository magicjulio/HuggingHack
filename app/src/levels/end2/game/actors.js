import * as THREE from "three";
import { buildDefender, buildAgent } from "./models.js";
import { buildHugger, buildWarden, buildMaintainer } from "./enemies-extra.js";
import { BEHAVIOUR, interrupt } from "./enemies.js";
import { createProjectiles } from "./projectiles.js";

// Actors: defenders, the player's squad and escorts. Positions are feet; every
// shot checks the same world obstruction hook as the player's rifle, so cover
// works for both teams. Numbers: T.enemies (per kind), T.floors (per-floor
// scaling), T.squad (subagents and escorts), T.crit. Behaviours per enemy kind
// live in enemies.js; projectile logic in projectiles.js; every look (bolts,
// beams, floor rings, impacts) comes from hooks.looks (looks.js, or fx.js).
export function createActors(scene, T, hooks, brand) {
  const E = T.enemies,
    S = T.squad;
  const looks = hooks.looks;
  const enemies = [],
    allies = [];
  let floorY = 0,
    floorN = 1,
    cooldown = 0,
    orderCd = 0,
    sequence = 0,
    now = 0,
    beacon = null;
  let player = { pos: new THREE.Vector3(), alive: false, height: 1.8, isPlayer: true };
  const tmp = new THREE.Vector3(),
    tmp2 = new THREE.Vector3(),
    seg = new THREE.Line3(),
    closest = new THREE.Vector3();
  const floorCfg = () => (hooks.bossTarget?.() ? T.floors.boss : T.floors[floorN]) || T.floors[1];
  // Floor 2 is a building (main.js hooks.building() → building.js adapter):
  // ground height, sections, nav routes. null on floor 1 (flat floor at floorY).
  const bld = () => hooks.building?.() || null;
  const groundY = (p) => (bld() ? hooks.ground(p.x, p.z, p.y) : floorY);
  const builders = {
    gunner: (b) => buildDefender(b, "gunner"),
    shield: (b) => buildDefender(b, "shield"),
    hugger: buildHugger,
    warden: buildWarden,
    maintainer: buildMaintainer,
  };

  // ------------------------------------------------------------ geometry
  function hitCenter(e, lift = e.lift) {
    return new THREE.Vector3(e.pos.x, e.pos.y + e.cfg.height + lift + e.dropY, e.pos.z);
  }
  function centerOf(t) {
    if (t.cfg) return hitCenter(t);
    if (t.isPlayer) return t.pos.clone().add(new THREE.Vector3(0, (t.height || 1.7) * 0.58, 0));
    return t.pos.clone().add(new THREE.Vector3(0, 1.25, 0));
  }
  // floor 2: clearance from p up to the section ceiling (beams from the sky stop there)
  const b2c = (p) => Math.max(2, bld().ceilingAt(p.x, p.z, p.y) - p.y - 0.2);
  const angleDelta = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
  const flatDist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const projectiles = createProjectiles({
    looks,
    blocked: (a, b) => hooks.blocked(a, b),
    center: (t, isPlayer) => (isPlayer ? centerOf(player) : centerOf(t)),
  });

  // ------------------------------------------------------------ per-enemy looks
  function look(e, key) {
    e.looks ??= {};
    if (!e.looks[key]) {
      const [type, kind] = key.split(":");
      e.looks[key] = looks[type](kind);
    }
    return e.looks[key];
  }
  function hideLook(e, key) {
    e.looks?.[key]?.hide();
  }

  // ------------------------------------------------------------ spawning
  // opts (floor 2): { y, section, dormant, wake, placed (already in position:
  // no drop-in), leash (m around home), yaw }
  function makeEnemy(kind, x, z, mode = "hold", delay = 0, opts = {}) {
    const cfg = E[kind];
    const model = builders[kind](brand);
    const holder = new THREE.Group();
    holder.add(model.root);
    holder.position.set(x, opts.y ?? floorY, z);
    hooks.free(holder.position, cfg.radius);
    const b = bld();
    // Drop-ins start under the ceiling indoors (T.building.dropCeiling).
    const dropH = opts.placed
      ? 0
      : b
        ? THREE.MathUtils.clamp(b.ceilingAt(x, z, holder.position.y) - holder.position.y - (T.building?.dropCeiling ?? 0.6), 1.5, E.dropHeight)
        : E.dropHeight;
    scene.add(holder);
    let aimLine = null;
    if (kind === "gunner" || kind === "shield") {
      aimLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color: 0xff714f, transparent: true, opacity: 0.5, depthWrite: false }),
      );
      aimLine.visible = false;
      aimLine.frustumCulled = false;
      scene.add(aimLine);
    }
    const e = {
      kind,
      cfg,
      model,
      mesh: holder,
      pos: holder.position,
      aimLine,
      hp: cfg.hp,
      maxHp: cfg.hp,
      radius: cfg.radius,
      hitRadius: cfg.hit,
      dead: false,
      yaw: Math.PI,
      timer: 0.7 + Math.random() * 1.3,
      windup: 0,
      shots: 0,
      shotTimer: 0,
      expose: 0,
      stagger: 0,
      flash: 0,
      shieldHit: 0,
      target: null,
      age: 0,
      seed: sequence++,
      phase: Math.random() * 6,
      mode,
      lift: 0,
      liftGoal: 0,
      dropH,
      dropY: dropH,
      spawn: opts.placed ? 1 : -delay / E.dropTime,
      section: opts.section ?? -1,
      dormant: !!opts.dormant,
      wake: opts.wake || "door",
      home: holder.position.clone(),
      leash: opts.leash || 0,
      nav: null,
      lastPos: holder.position.clone(),
      // gunner
      post: null,
      postTimer: 0,
      flankedFor: 0,
      atPost: false,
      // shield
      bash: 0,
      bashCd: 0,
      // hugger / warden
      state: kind === "warden" ? "cool" : "approach",
      tell: 0,
      rec: 0,
      cool: 0,
      t: 0,
      lungeTo: new THREE.Vector3(),
      lungeDir: new THREE.Vector3(),
      lungeLeft: 0,
      lungeLen: 1,
      aimPitch: 0,
      // maintainer
      healing: false,
      healTick: 0,
    };
    if (kind === "warden") e.timer = cfg.cooldown;
    if (opts.yaw !== undefined) e.yaw = opts.yaw;
    holder.rotation.y = e.yaw;
    holder.visible = e.spawn >= 0;
    model.root.position.y = e.dropY;
    enemies.push(e);
    return e;
  }

  function spawnWave(spec, mode = "hold") {
    return spec.map((s) => makeEnemy(s.kind, s.x, s.z, s.mode || mode, s.delay || 0, s));
  }
  // Dormant defenders (sections the player hasn't reached) wake here: by the
  // director (door opened, section entered) or when hurt / seeing you up close.
  function wake(e) {
    if (!e.dormant || e.dead) return;
    e.dormant = false;
    e.timer = Math.max(e.timer, 0.5 + Math.random() * 0.6); // a beat to react
  }
  function wakeSection(section, filter = () => true) {
    let n = 0;
    for (const e of enemies)
      if (e.dormant && !e.dead && e.section === section && filter(e)) {
        wake(e);
        n++;
      }
    return n;
  }

  function removeEnemy(e) {
    scene.remove(e.mesh);
    if (e.aimLine) {
      scene.remove(e.aimLine);
      e.aimLine.geometry.dispose();
      e.aimLine.material.dispose();
    }
    if (e.looks) for (const l of Object.values(e.looks)) l.dispose();
    e.looks = null;
    e.model.dispose();
  }

  function addAlly(x, z, temporary, index = 0) {
    const model = buildAgent(temporary ? "subagent" : "escort");
    const mesh = model.root;
    mesh.position.set(x, floorY, z);
    scene.add(mesh);
    const ally = {
      mesh,
      model,
      pos: mesh.position,
      temporary,
      hp: temporary ? S.hp : S.escortHp,
      radius: 0.5,
      lifetime: temporary ? S.duration : Infinity,
      spawnAge: temporary ? -0.15 * index : 2,
      shoot: 0.2 + index * 0.16,
      phase: Math.random() * 6,
      index,
      dead: false,
      target: null,
      focus: null,
      rally: null,
      taunt: 0,
      hurt: 0,
    };
    allies.push(ally);
    return ally;
  }

  function removeAlly(a) {
    scene.remove(a.mesh);
    a.model.dispose();
    const idx = allies.indexOf(a);
    if (idx >= 0) allies.splice(idx, 1);
  }

  function clearBeacon() {
    if (!beacon) return;
    beacon.ring.dispose();
    beacon.column.dispose();
    beacon = null;
  }

  function clear() {
    enemies.forEach(removeEnemy);
    enemies.length = 0;
    [...allies].forEach(removeAlly);
    projectiles.clear();
    clearBeacon();
  }

  // start (floor 2): { pos, yaw } of the player, so the escorts stand beside you.
  function reset(y, floor = 1, start = null) {
    clear();
    floorY = y;
    floorN = floor;
    cooldown = 0;
    orderCd = 0;
    sequence = 0;
    if (!start) {
      addAlly(-3, 5, false, 0);
      addAlly(3, 5, false, 1);
      return;
    }
    addAlly(start.pos.x, start.pos.z, false, 0);
    addAlly(start.pos.x, start.pos.z, false, 1);
    regroup(start.pos, start.yaw);
  }
  // Re-place the permanent escorts beside and a little behind the player.
  function regroup(pos, yaw) {
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    for (const a of allies) {
      if (a.temporary) continue;
      const side = a.index % 2 ? 1 : -1;
      // right = (cos, -sin), back = (sin, cos)
      a.pos.set(pos.x + c * side * 1.8 + s * 1.2, pos.y, pos.z - s * side * 1.8 + c * 1.2);
      hooks.free(a.pos, 0.5);
      a.pos.y = groundY(a.pos);
      a.nav = null;
    }
  }

  // ------------------------------------------------------------ damage
  // How a shot from `origin` lands on `e`: shield fronts and Warden armour
  // block unless opened (firing, venting, staggered) or pierced; rear hits crit.
  function shotModifier(e, origin, pierce = false) {
    if (!e || e.dead) return { mult: 0, blocked: false, crit: false };
    tmp.subVectors(origin, e.pos).setY(0).normalize();
    const dot = tmp.dot(tmp2.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)));
    const open = e.expose > 0 || e.stagger > 0;
    const rear = dot < T.crit.rearArc;
    if (e.kind === "warden") {
      if (rear) return { mult: e.cfg.core, blocked: false, crit: true };
      if (!pierce && !open) return { mult: e.cfg.armour, blocked: true, crit: false };
      return { mult: 1, blocked: false, crit: false };
    }
    if (e.kind === "shield" && !pierce && !open && dot > 0.3) return { mult: e.cfg.block, blocked: true, crit: false };
    if (rear) return { mult: T.crit.rear, blocked: false, crit: true };
    return { mult: 1, blocked: false, crit: false };
  }

  function hitEnemy(e, damage, origin, byAlly = false, pierce = false) {
    if (!e || e.dead) return { blocked: false, killed: false, crit: false, damage: 0 };
    if (e.dormant) {
      wake(e);
      if (T.building?.alarm !== false) hooks.onAlarm?.(e.section);
    }
    const m = shotModifier(e, origin, pierce);
    const dealt = damage * m.mult;
    e.hp -= dealt;
    e.flash = 0.13;
    e.model.setHealth(Math.max(0, e.hp / e.maxHp));
    if (m.blocked) {
      e.shieldHit = 0.15;
      hooks.burst(hitCenter(e), 0x66daff, 3);
    }
    if (e.hp <= 0) {
      kill(e, byAlly);
      return { blocked: m.blocked, killed: true, crit: m.crit, damage: dealt };
    }
    return { blocked: m.blocked, killed: false, crit: m.crit, damage: dealt };
  }

  function kill(e, byAlly) {
    const at = e.pos.clone(),
      c = hitCenter(e);
    e.dead = true;
    removeEnemy(e);
    hooks.burst(c, 0xffd64b, e.kind === "warden" ? 32 : 14);
    looks.impact(c, "death-" + e.kind);
    hooks.sound(e.kind === "warden" ? "kill-heavy" : "kill");
    hooks.onKill(e.kind, byAlly, at, e);
  }

  function stagger(e, time) {
    if (e.dead) return;
    e.stagger = Math.max(e.stagger, time);
    interrupt(e, api);
  }

  function hurtAlly(a, damage) {
    a.hurt = 0.18;
    if (a.temporary) {
      a.hp -= damage;
      if (a.hp <= 0) a.dead = true;
    }
    hooks.burst(centerOf(a), 0x8be4ff, 3);
  }

  // ------------------------------------------------------------ the toolkit behaviours use
  const api = {
    sound: (n) => hooks.sound(n),
    center: centerOf,
    face(e, pos, dt, rate = e.cfg.turn) {
      const desired = Math.atan2(pos.x - e.pos.x, pos.z - e.pos.z);
      e.yaw += THREE.MathUtils.clamp(angleDelta(e.yaw, desired), -rate * dt, rate * dt);
      e.mesh.rotation.y = e.yaw;
    },
    facingWithin(e, pos, tolerance) {
      return Math.abs(angleDelta(e.yaw, Math.atan2(pos.x - e.pos.x, pos.z - e.pos.z))) < tolerance;
    },
    // overLow: walk over low cover (huggers); pair with coverUnder() for the hop height.
    moveToward(actor, goal, speed, dt, overLow = false) {
      if (actor.leash > 0 && actor.home) {
        const dx = goal.x - actor.home.x,
          dz = goal.z - actor.home.z,
          d = Math.hypot(dx, dz);
        if (d > actor.leash) goal = tmp2.set(actor.home.x + (dx / d) * actor.leash, actor.home.y, actor.home.z + (dz / d) * actor.leash);
      }
      moveToward(actor, goal, speed, dt, actor.seed % 2 ? 1 : -1, overLow);
    },
    // Height of the low cover under an actor's footprint (0 if none).
    coverUnder(e) {
      let h = 0;
      for (const c of hooks.colliders()) {
        if (c.height > 2.2 || c.disabled || Math.abs(c.baseY - (bld() ? e.pos.y : floorY)) > 0.5) continue;
        const r = e.radius * 0.8;
        if (e.pos.x > c.minX - r && e.pos.x < c.maxX + r && e.pos.z > c.minZ - r && e.pos.z < c.maxZ + r) h = Math.max(h, c.height);
      }
      return h;
    },
    moveFree(e, delta) {
      hooks.move(e.pos, delta, e.radius, true);
      e.pos.y = groundY(e.pos);
    },
    unstick(e) {
      hooks.free(e.pos, e.radius);
      e.pos.y = groundY(e.pos);
    },
    strafe(e, speed, dt, time) {
      const side = Math.sin(time * 0.55 + e.phase) * speed * 0.3 * dt;
      hooks.move(e.pos, tmp.set(Math.cos(e.yaw) * side, 0, -Math.sin(e.yaw) * side), e.radius);
    },
    visibleFrom(e, target, lift = 0, ignoreLow = false) {
      return !hooks.blocked(hitCenter(e, lift), centerOf(target), ignoreLow);
    },
    coverPost,
    attackSlots() {
      let busy = 0;
      for (const o of enemies) if (!o.dead && !o.dormant && (o.windup > 0 || o.shots > 0)) busy++;
      return floorCfg().attackers - busy;
    },
    lungeSlots() {
      let busy = 0;
      for (const o of enemies) if (!o.dead && o.kind === "hugger" && (o.state === "tell" || o.state === "lunge")) busy++;
      return floorCfg().lunges - busy;
    },
    aim(e, target) {
      const a = hitCenter(e),
        b = centerOf(target);
      const attr = e.aimLine.geometry.attributes.position;
      attr.setXYZ(0, a.x, a.y, a.z);
      attr.setXYZ(1, b.x, b.y, b.z);
      attr.needsUpdate = true;
      e.aimLine.visible = true;
    },
    hideAim(e) {
      if (e.aimLine) e.aimLine.visible = false;
    },
    shoot(e, target) {
      const start = hitCenter(e),
        goal = centerOf(target);
      if (hooks.blocked(start, goal)) return;
      const dir = goal.sub(start).normalize();
      if (projectiles.spawn(e.kind, start, dir, e.cfg.boltSpeed, e.cfg.damage * floorCfg().damage)) {
        looks.impact(start, "muzzle");
        hooks.sound("enemy");
      }
    },
    ring(e, pos, s) {
      look(e, "ring:lunge").set(pos, s);
    },
    hideRing(e) {
      hideLook(e, "ring:lunge");
    },
    damagePlayer: (amount, from) => hooks.damagePlayer(amount, from),
    pushPlayer: (v) => hooks.pushPlayer(v),
    allyNear(pos, r) {
      return allies.find((a) => !a.dead && a.spawnAge > 0.7 && flatDist(a.pos, pos) < r);
    },
    hurtAlly,
    beamOrigin(e) {
      return new THREE.Vector3(
        e.pos.x + Math.sin(e.yaw) * 0.9,
        e.pos.y + e.cfg.beamHeight,
        e.pos.z + Math.cos(e.yaw) * 0.9,
      );
    },
    sweep(e, live, k, damage = 0) {
      const o = api.beamOrigin(e);
      const c = Math.cos(e.aimPitch);
      const dir = new THREE.Vector3(Math.sin(e.yaw) * c, Math.sin(e.aimPitch), Math.cos(e.yaw) * c);
      const len = hooks.rayLength(o, dir, e.cfg.range);
      const end = o.clone().addScaledVector(dir, len);
      hideLook(e, live ? "beam:warden-aim" : "beam:warden");
      look(e, live ? "beam:warden" : "beam:warden-aim").set(o, end, { intensity: live ? 1 : 0.35 + 0.65 * k, time: now });
      if (!live) return;
      seg.set(o, end);
      if (player.alive) {
        seg.closestPointToPoint(centerOf(player), true, closest);
        if (closest.distanceTo(centerOf(player)) < e.cfg.beamWidth) hooks.damagePlayer(damage, o, true);
      }
      for (const a of allies) {
        if (a.dead || a.spawnAge < 0.7) continue;
        seg.closestPointToPoint(centerOf(a), true, closest);
        if (closest.distanceTo(centerOf(a)) < 0.6) hurtAlly(a, damage);
      }
      if (Math.random() < 0.25) looks.impact(end, "beam");
    },
    hideBeam(e) {
      hideLook(e, "beam:warden");
      hideLook(e, "beam:warden-aim");
    },
    mostDamaged(self, range) {
      // floor 3: a Maintainer tethers to the hurt boss first (boss.target proxy)
      const boss = hooks.bossTarget?.();
      if (boss && boss.hp < boss.maxHp - 1) return boss;
      let best = null,
        ratio = 0.999;
      for (const o of enemies) {
        if (o === self || o.dead || o.spawn < 1 || o.kind === "maintainer") continue;
        const r = o.hp / o.maxHp;
        if (r < ratio && o.pos.distanceTo(self.pos) < range) {
          ratio = r;
          best = o;
        }
      }
      return best;
    },
    heal(e, patient, amount) {
      patient.hp = Math.min(patient.maxHp, patient.hp + amount);
      patient.model.setHealth(patient.hp / patient.maxHp);
      const from = e.model.emitter ? e.model.emitter.getWorldPosition(new THREE.Vector3()) : hitCenter(e);
      look(e, "beam:tether").set(from, hitCenter(patient), { intensity: 0.8, time: now });
      e.healTick += amount;
      if (e.healTick >= 10) {
        looks.number(hitCenter(patient).add(tmp.set(0, 0.9, 0)), "+" + Math.round(e.healTick), "heal");
        e.healTick = 0;
      }
    },
    hideTether(e) {
      hideLook(e, "beam:tether");
    },
  };

  // Low cover between the defender and the threat: the far side of the nearest
  // suitable block, spread along it so several defenders can share one.
  function coverPost(e, threat) {
    const cfg = e.cfg,
      W = T.world,
      b = bld();
    let best = null,
      bestScore = Infinity;
    for (const c of hooks.colliders()) {
      if (c.height > 2.2 || c.disabled) continue;
      // building: only cover on the defender's own level and in its own section
      if (b && Math.abs(c.baseY - e.pos.y) > 0.5) continue;
      if (b && e.section >= 0 && !b.inSection(e.section, (c.minX + c.maxX) / 2, (c.minZ + c.maxZ) / 2, 0.5)) continue;
      const cx = (c.minX + c.maxX) / 2,
        cz = (c.minZ + c.maxZ) / 2,
        hx = (c.maxX - c.minX) / 2,
        hz = (c.maxZ - c.minZ) / 2;
      let dx = cx - threat.x,
        dz = cz - threat.z;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      dx /= len;
      dz /= len;
      const reach = Math.abs(dx) * hx + Math.abs(dz) * hz + e.radius + 0.2;
      const slot = (e.seed % 3) - 1;
      let px = cx + dx * reach + slot * hx * 0.55 * Math.abs(dz),
        pz = cz + dz * reach + slot * hz * 0.55 * Math.abs(dx);
      if (!b) {
        px = THREE.MathUtils.clamp(px, -W.width / 2 + 1, W.width / 2 - 1);
        pz = THREE.MathUtils.clamp(pz, W.farZ + 1, W.nearZ - 1);
      } else if (!b.walkable(px, pz, 0) || (e.leash > 0 && Math.hypot(px - e.home.x, pz - e.home.z) > e.leash)) continue;
      const toThreat = Math.hypot(px - threat.x, pz - threat.z);
      if (toThreat < cfg.postMin || toThreat > cfg.postMax) continue;
      const d = Math.hypot(px - e.pos.x, pz - e.pos.z);
      if (d > cfg.postSearch) continue;
      let taken = 0;
      for (const o of enemies) if (o !== e && !o.dead && o.post && Math.hypot(o.post.x - px, o.post.z - pz) < 1.2) taken += 6;
      const score = d + taken;
      if (score < bestScore) {
        bestScore = score;
        best = new THREE.Vector3(px, b ? e.pos.y : floorY, pz);
      }
    }
    return best;
  }

  // Floor 2: the next waypoint toward goal (straight if walkable, else an A*
  // route over the nav graph through open doors); null = no way there yet.
  function route(actor, goal, overLow = false) {
    const b = bld();
    if (!b) return goal;
    const nav = (actor.nav ??= { goal: new THREE.Vector3(1e9, 0, 0), pts: null, i: 0, next: 0, direct: true });
    if (now >= nav.next || nav.goal.distanceToSquared(goal) > 2.25) {
      nav.next = now + 0.45 + Math.random() * 0.35;
      nav.goal.copy(goal);
      nav.direct = b.straight(actor.pos, goal, actor.radius, overLow);
      nav.pts = nav.direct ? null : b.path(actor.pos, goal);
      nav.i = 0;
    }
    if (nav.direct) return goal;
    if (!nav.pts) return null;
    while (nav.i < nav.pts.length - 1 && Math.hypot(actor.pos.x - nav.pts[nav.i].x, actor.pos.z - nav.pts[nav.i].z) < 0.8) nav.i++;
    // stuck on a corner for a second: skip to the next waypoint and re-plan soon
    nav.stuckAt ??= actor.pos.clone();
    if (actor.pos.distanceToSquared(nav.stuckAt) > 0.25) {
      nav.stuckAt.copy(actor.pos);
      nav.stuckT = now;
    } else if (now - (nav.stuckT ?? now) > 1.1) {
      nav.stuckT = now;
      nav.i = Math.min(nav.i + 1, nav.pts.length - 1);
      nav.next = now + 0.3;
    }
    return nav.pts[nav.i];
  }
  function moveToward(actor, goal, speed, dt, side, overLow = false) {
    goal = route(actor, goal, overLow);
    if (!goal) return;
    const direction = tmp.subVectors(goal, actor.pos);
    direction.y = 0;
    if (direction.lengthSq() < 0.09) return;
    direction.normalize();
    const start = actor.pos.clone();
    hooks.move(actor.pos, direction.clone().multiplyScalar(speed * dt), actor.radius, overLow);
    if (actor.pos.distanceToSquared(start) < speed * dt * speed * dt * 0.15) {
      // Sliding along cover corners avoids getting stuck against the first block.
      hooks.move(actor.pos, new THREE.Vector3(direction.z * side, 0, -direction.x * side).multiplyScalar(speed * dt), actor.radius, overLow);
    }
    actor.pos.y = groundY(actor.pos);
  }

  // ------------------------------------------------------------ the squad call
  // Q: beacon at the aimed point → after T.squad.dropDelay the squad slams in,
  // staggering and taunting nearby defenders. Q while a squad is out: order it
  // (focus the aimed enemy, or move to the aimed point).
  function callIn(point, focus = null) {
    if (cooldown <= 0 && !beacon) {
      deploy(point);
      return "deploy";
    }
    const squad = allies.filter((a) => a.temporary && !a.dead);
    if (squad.length && orderCd <= 0) {
      orderCd = S.orderCooldown;
      for (const a of squad) {
        a.focus = focus && !focus.dead ? focus : null;
        a.rally = focus ? null : point.clone().setY(groundY(point));
      }
      looks.impact(focus ? hitCenter(focus) : point.clone().setY(groundY(point) + 0.2), "order");
      hooks.sound("order");
      return focus ? "focus" : "move";
    }
    return false;
  }

  function deploy(point) {
    cooldown = S.cooldown;
    const pos = point.clone().setY(groundY(point));
    beacon = { pos, t: S.dropDelay, ring: looks.ring("beacon"), column: looks.beam("beacon") };
    hooks.sound("beacon");
    if (S.dropDelay <= 0) land();
  }

  function updateBeacon(dt) {
    if (!beacon) return;
    beacon.t -= dt;
    const k = 1 - Math.max(0, beacon.t) / Math.max(0.001, S.dropDelay);
    beacon.ring.set(beacon.pos, { radius: S.shockRadius, progress: k, alpha: 0.5 + k * 0.5, time: now });
    beacon.column.set(beacon.pos.clone().setY(beacon.pos.y + (bld() ? Math.min(40, b2c(beacon.pos)) : 40)), beacon.pos, { intensity: 0.3 + 0.7 * k, time: now });
    if (beacon.t <= 0) land();
  }

  function land() {
    const point = beacon.pos.clone();
    clearBeacon();
    for (let i = 0; i < S.count; i++) {
      const angle = (i / S.count) * Math.PI * 2;
      const p = point.clone();
      hooks.move(p, new THREE.Vector3(Math.cos(angle) * 1.3, 0, Math.sin(angle) * 1.3), 0.5);
      const a = addAlly(p.x, p.z, true, i);
      const gy = bld() ? point.y : floorY;
      a.pos.y = gy;
      a.taunt = S.taunt;
      a.mesh.scale.setScalar(0.01);
      hooks.beam(p.clone().setY(gy + (bld() ? Math.min(10 + i * 2, b2c(p)) : 10 + i * 2)), p.clone().setY(gy + 1), 0x9affc5);
      hooks.burst(p.clone().setY(gy + 1), 0xa8ffd0, 18);
    }
    let hit = 0;
    for (const e of enemies) {
      if (e.dead || e.spawn < 1 || flatDist(e.pos, point) > S.shockRadius || Math.abs(e.pos.y - point.y) > 2.5) continue;
      hit++;
      stagger(e, S.stagger);
      if (e.kind !== "warden") {
        const away = tmp.subVectors(e.pos, point).setY(0);
        if (away.lengthSq() < 0.01) away.set(1, 0, 0);
        hooks.move(e.pos, away.normalize().multiplyScalar(S.shockPush), e.radius);
      }
      hitEnemy(e, S.shockDamage, point.clone().setY(point.y + 1), true, true);
    }
    looks.impact(point, "shock");
    hooks.sound("call");
    hooks.shake(S.shake);
    hooks.onSquad?.("landed", hit);
    hooks.onSquadLand?.(point, S.shockRadius); // floor 3: interrupts a winding-up boss slam
  }

  // ------------------------------------------------------------ per frame
  function pickTarget(e) {
    let target = null,
      best = Infinity;
    const from = hitCenter(e);
    const consider = (a, weight) => {
      const d = e.pos.distanceToSquared(a.pos) * weight;
      if (d < best && (e.kind === "hugger" || !hooks.blocked(from, centerOf(a)))) {
        best = d;
        target = a;
      }
    };
    if (player.alive) consider(player, 1);
    for (const a of allies) {
      if (a.dead || a.spawnAge < 0.3) continue;
      consider(a, a.temporary ? (a.taunt > 0 ? S.tauntWeight : 0.66) : 1.5);
    }
    return target || player;
  }

  function updateEnemy(e, dt, time) {
    if (e.dead) return;
    if (e.dormant) {
      // Not reached yet: idle in place. Wakes on sight up close (or when hurt).
      if (player.alive && Math.abs(player.pos.y - e.pos.y) < 2.5 && flatDist(player.pos, e.pos) < (T.building?.wakeRadius ?? 7) && api.visibleFrom(e, player, 0)) {
        wake(e);
        if (T.building?.alarm !== false) hooks.onAlarm?.(e.section);
      }
      return;
    }
    if (e.spawn < 1) {
      // Spawn-in: dropped from the ceiling onto an orange warning ring.
      e.spawn += dt / E.dropTime;
      e.mesh.visible = e.spawn >= 0;
      if (e.spawn >= 0) {
        const s = Math.min(1, e.spawn);
        e.dropY = (1 - s) * (1 - s) * e.dropH;
        look(e, "ring:spawn").set(e.pos, { radius: e.radius + 0.5, progress: s, alpha: 1 - s * 0.4, time });
        if (s >= 1) {
          e.dropY = 0;
          hideLook(e, "ring:spawn");
          hooks.burst(e.pos.clone().setY(e.pos.y + 0.3), 0xffa64b, 8);
          hooks.sound("land");
        }
      }
      return;
    }
    e.age += dt;
    e.expose = Math.max(0, e.expose - dt);
    e.stagger = Math.max(0, e.stagger - dt);
    e.flash = Math.max(0, e.flash - dt);
    e.shieldHit = Math.max(0, e.shieldHit - dt);
    if (e.kind !== "hugger") e.lift = THREE.MathUtils.damp(e.lift, e.liftGoal, 7, dt);
    const target = pickTarget(e);
    e.target = target;
    if (e.stagger > 0) {
      e.liftGoal = 0;
      if (e.kind !== "warden") api.face(e, target.pos, dt);
      return;
    }
    BEHAVIOUR[e.kind](e, { dt, time, target, player, floor: floorCfg(), api });
  }

  function syncEnemyModel(e, dt, time) {
    const moving = e.pos.distanceToSquared(e.lastPos) > 1e-5;
    e.lastPos.copy(e.pos);
    e.model.root.position.y = e.lift + e.dropY;
    const cfg = e.cfg;
    let windup = 0;
    if (e.windup > 0) windup = 1 - e.windup / cfg.telegraph;
    else if (e.bash > 0) windup = 1 - e.bash / cfg.bashWindup;
    else if (e.state === "tell") windup = 1 - e.tell / cfg.telegraph;
    e.model.update(dt, {
      time,
      phase: e.phase,
      flash: e.flash,
      windup,
      firing: e.kind === "warden" ? e.state === "beam" : e.shots > 0,
      exposed: e.expose > 0,
      stagger: e.stagger,
      moving,
      camera: hooks.getCamera(),
      shieldHit: e.shieldHit,
      lunging: e.state === "lunge",
      recover: e.state === "recover",
      charge: e.state === "charge" ? 1 - e.t / cfg.telegraph : 0,
      venting: e.state === "vent",
      aimPitch: e.kind === "warden" ? e.aimPitch : 0,
      healing: e.healing,
    });
  }

  function updateAlly(a, dt, time) {
    a.lifetime -= dt;
    a.spawnAge += dt;
    a.hurt = Math.max(0, a.hurt - dt);
    a.taunt = Math.max(0, a.taunt - dt);
    if (a.lifetime <= 0 || a.dead) {
      hooks.burst(centerOf(a), 0x94ffd9, 10);
      removeAlly(a);
      return;
    }
    a.model.update(dt, {
      time,
      phase: a.phase,
      arrive: a.temporary ? THREE.MathUtils.clamp(a.spawnAge / 0.7, 0, 1) : 1,
      hurt: a.hurt,
      fade: a.temporary && a.lifetime < 1 ? a.lifetime : 1,
    });
    if (a.temporary && a.spawnAge < 1) return;
    const side = a.index % 2 ? 1 : -1;
    const speed = a.temporary ? S.speed : S.escortSpeed;
    if (a.focus && a.focus.dead) a.focus = null;
    if (a.rally) {
      moveToward(a, a.rally, speed * 1.4, dt, side);
      if (flatDist(a.pos, a.rally) < 1.2) a.rally = null;
    }
    const start = centerOf(a);
    let target = null,
      best = Infinity;
    if (a.focus && a.focus.spawn >= 1) {
      target = a.focus;
      best = a.pos.distanceToSquared(target.pos);
    } else
      for (const e of enemies) {
        if (e.dead || e.spawn < 1 || e.dormant) continue;
        const d = a.pos.distanceToSquared(e.pos);
        if (d < best && !hooks.blocked(start, hitCenter(e))) {
          target = e;
          best = d;
        }
      }
    // floor 3: nothing else in sight → shoot the boss's face (boss.target proxy)
    if (!target && !a.rally) {
      const boss = hooks.bossTarget?.();
      if (boss) {
        target = boss;
        best = a.pos.distanceToSquared(boss.pos);
      }
    }
    a.target = target;
    a.shoot -= dt;
    if (target) {
      a.mesh.rotation.y = Math.atan2(target.pos.x - a.pos.x, target.pos.z - a.pos.z);
      const end = hitCenter(target);
      const visible = !hooks.blocked(start, end);
      if (!a.rally) {
        if (a.temporary && (target.kind === "shield" || target.kind === "warden") && best < 18 * 18) {
          // Called agents work around armoured fronts toward the open side.
          const back = tmp2.set(-Math.sin(target.yaw), 0, -Math.cos(target.yaw));
          const goal = target.pos
            .clone()
            .addScaledVector(back, S.flankDistance)
            .add(new THREE.Vector3(back.z, 0, -back.x).multiplyScalar(side * (a.index + 1) * 1.2));
          if (flatDist(a.pos, goal) > 1) moveToward(a, goal, speed, dt, side);
        } else if (target.isBoss) {
          // the boss: keep near the player and fire at the face; walk only to get a line
          const follow = player.pos.clone().add(new THREE.Vector3(side * 2.8, 0, 2));
          if (!visible) moveToward(a, target.pos, speed, dt, side);
          else if (a.pos.distanceTo(follow) > 3) moveToward(a, follow, speed * 1.15, dt, side);
        } else if (best > 12 * 12 || !visible) moveToward(a, target.pos, speed, dt, side);
      }
      if (a.shoot <= 0 && best < (target.isBoss ? 70 * 70 : 30 * 30) && visible) {
        a.shoot = a.temporary ? S.interval : S.escortInterval;
        a.model.shoot();
        hooks.beam(start, end, a.temporary ? 0xa8ffd1 : 0x6bcfff);
        if (target.isBoss) target.hit(a.temporary ? S.damage : S.escortDamage, start);
        else hitEnemy(target, a.temporary ? S.damage : S.escortDamage, start, true);
      }
    } else if (!a.rally) {
      const follow = player.pos.clone().add(new THREE.Vector3(side * 2.8, 0, 2));
      if (a.pos.distanceTo(follow) > 2) moveToward(a, follow, speed * 1.15, dt, side);
    }
  }

  function update(dt, time) {
    now = time;
    cooldown = Math.max(0, cooldown - dt);
    orderCd = Math.max(0, orderCd - dt);
    player = Object.assign(hooks.getPlayer(), { isPlayer: true });
    updateBeacon(dt);
    for (const e of enemies) {
      updateEnemy(e, dt, time);
      if (!e.dead) syncEnemyModel(e, dt, time);
    }
    for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].dead) enemies.splice(i, 1);
    for (const a of [...allies]) updateAlly(a, dt, time);
    projectiles.update(dt, player, allies, (damage, from) => hooks.damagePlayer(damage, from), hurtAlly);
  }

  return {
    enemies,
    allies,
    projectiles: projectiles.list,
    reset,
    spawnWave,
    update,
    hitEnemy,
    shotModifier,
    hitCenter,
    callIn,
    stagger,
    wake,
    wakeSection,
    regroup,
    clearEnemies() {
      enemies.forEach(removeEnemy);
      enemies.length = 0;
      projectiles.clear();
    },
    aliveIn(section) {
      return enemies.filter((e) => !e.dead && e.section === section).length;
    },
    reduceCooldown(s) {
      cooldown = Math.max(0, cooldown - s);
    },
    clear,
    get ready() {
      return cooldown <= 0 && !beacon;
    },
    get cooldown() {
      return cooldown;
    },
    get dropping() {
      return !!beacon;
    },
    get squadActive() {
      return allies.some((a) => a.temporary && !a.dead);
    },
    get activeRemaining() {
      return Math.max(0, ...allies.filter((a) => a.temporary).map((a) => a.lifetime));
    },
    get alive() {
      return enemies.filter((e) => !e.dead).length;
    },
    dispose() {
      clear();
    },
  };
}
