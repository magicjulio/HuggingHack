import * as THREE from "three";
import { buildDefender, buildAgent } from "./models.js";

// Actor positions are feet; every projectile checks the same world obstruction
// hook as the player's rifle, so cover works for both teams.
export function createActors(scene, T, hooks, brand) {
  const A = T.actors;
  const enemies = [],
    allies = [],
    projectiles = [];
  const geometries = new Set(),
    materials = new Set();
  const geo = (g) => (geometries.add(g), g);
  const mat = (m) => (materials.add(m), m);
  const sphere = geo(new THREE.SphereGeometry(1, 20, 14));
  const bulletMaterial = mat(new THREE.MeshBasicMaterial({ color: 0xff7049 }));
  let floorY = 0,
    cooldown = 0,
    sequence = 0;
  const up = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();

  function enemyModel(kind) {
    const model = buildDefender(brand, kind);
    const mesh = model.root;
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xff714f,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    const aimLine = new THREE.Line(lineGeometry, lineMaterial);
    aimLine.visible = false;
    scene.add(aimLine);
    scene.add(mesh);
    return { mesh, model, shield: model.shield, aimLine };
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
      hp: temporary ? 52 : 500,
      radius: 0.5,
      lifetime: temporary ? A.callDuration : Infinity,
      spawnAge: temporary ? -0.18 * index : 2,
      shoot: 0.2 + index * 0.16,
      phase: Math.random() * 6,
      index,
      dead: false,
      target: null,
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

  function removeEnemy(e) {
    scene.remove(e.mesh, e.aimLine);
    e.aimLine.geometry.dispose();
    e.aimLine.material.dispose();
    e.model.dispose();
  }

  function clear() {
    enemies.forEach(removeEnemy);
    enemies.length = 0;
    [...allies].forEach(removeAlly);
    for (const p of projectiles) scene.remove(p.mesh);
    projectiles.length = 0;
  }

  function reset(y) {
    clear();
    floorY = y;
    cooldown = 0;
    sequence = 0;
    addAlly(-3, 5, false, 0);
    addAlly(3, 5, false, 1);
  }

  function spawnWave(spec) {
    for (let i = enemies.length - 1; i >= 0; i--)
      if (enemies[i].dead) enemies.splice(i, 1);
    for (const s of spec) {
      const m = enemyModel(s.kind);
      m.mesh.position.set(s.x, floorY, s.z);
      const hp = s.kind === "shield" ? A.shieldHealth : A.gunnerHealth;
      enemies.push({
        ...m,
        pos: m.mesh.position,
        hp,
        maxHp: hp,
        kind: s.kind,
        radius: 0.8,
        dead: false,
        yaw: Math.PI,
        timer: 0.7 + Math.random() * 1.3,
        windup: 0,
        shots: 0,
        shotTimer: 0,
        expose: 0,
        stagger: 0,
        phase: Math.random() * 6,
        flash: 0,
        target: null,
        age: 0,
        seed: sequence++,
      });
    }
  }

  function center(a, player = false) {
    return a.pos
      .clone()
      .add(new THREE.Vector3(0, player ? (a.height || 1.7) * 0.58 : 1.25, 0));
  }
  function angleDelta(a, b) {
    return Math.atan2(Math.sin(b - a), Math.cos(b - a));
  }
  function facing(e, target, dt) {
    const desired = Math.atan2(target.x - e.pos.x, target.z - e.pos.z);
    const delta = angleDelta(e.yaw, desired);
    const speed =
      e.kind === "shield" ? A.shieldTurnSpeed : A.shieldTurnSpeed * 2.5;
    e.yaw += THREE.MathUtils.clamp(delta, -speed * dt, speed * dt);
    e.mesh.rotation.y = e.yaw;
  }

  function moveToward(actor, goal, speed, dt, side) {
    const direction = goal.clone().sub(actor.pos);
    direction.y = 0;
    if (direction.lengthSq() < 0.09) return;
    direction.normalize();
    const start = actor.pos.clone();
    hooks.move(actor.pos, direction.multiplyScalar(speed * dt), actor.radius);
    if (actor.pos.distanceToSquared(start) < speed * dt * speed * dt * 0.15) {
      // Sliding along cover corners avoids getting stuck against the first block.
      const tangent = new THREE.Vector3(
        direction.z * side,
        0,
        -direction.x * side,
      );
      hooks.move(actor.pos, tangent, actor.radius);
    }
    actor.pos.y = floorY;
  }

  function hitEnemy(e, damage, shotOrigin, byAlly = false, pierce = false) {
    if (!e || e.dead) return { blocked: false, killed: false };
    let blocked = false;
    if (!pierce && e.kind === "shield" && e.expose <= 0 && e.stagger <= 0) {
      const incoming = shotOrigin.clone().sub(e.pos);
      incoming.y = 0;
      incoming.normalize();
      const front = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      blocked = incoming.dot(front) > 0.3;
      if (blocked) damage *= A.shieldReduction;
    }
    e.hp -= damage;
    e.flash = 0.13;
    e.model.setHealth(Math.max(0, e.hp / e.maxHp));
    if (blocked) {
      e.shieldHit = 0.15;
      hooks.burst(center(e), 0x66daff, 3);
    }
    if (e.hp <= 0) {
      e.dead = true;
      removeEnemy(e);
      hooks.burst(center(e), 0xffd64b, 14);
      hooks.sound("kill");
      hooks.onKill(e.kind, byAlly, e.pos.clone());
      return { blocked, killed: true };
    }
    return { blocked, killed: false };
  }

  function callIn(point) {
    if (cooldown > 0) return false;
    cooldown = A.callCooldown;
    for (let i = 0; i < A.callCount; i++) {
      const angle = (i / A.callCount) * Math.PI * 2;
      const p = point.clone();
      p.y = floorY;
      const displacement = new THREE.Vector3(
        Math.cos(angle) * 1.3,
        0,
        Math.sin(angle) * 1.3,
      );
      hooks.move(p, displacement, 0.5);
      const a = addAlly(p.x, p.z, true, i);
      a.mesh.scale.setScalar(0.01);
      hooks.beam(
        p.clone().add(new THREE.Vector3(0, 10 + i * 2, 0)),
        p.clone().add(up),
        0x9affc5,
      );
      hooks.burst(p.clone().add(up), 0xa8ffd0, 18);
    }
    for (const e of enemies)
      if (!e.dead && e.pos.distanceTo(point) < 7) e.stagger = A.callStagger;
    hooks.sound("call");
    return true;
  }

  function aim(e, target) {
    const a = center(e),
      b = center(target, !target.mesh);
    const attr = e.aimLine.geometry.attributes.position;
    attr.setXYZ(0, a.x, a.y, a.z);
    attr.setXYZ(1, b.x, b.y, b.z);
    attr.needsUpdate = true;
    e.aimLine.geometry.computeBoundingSphere();
    e.aimLine.visible = true;
  }

  function shoot(e, target) {
    if (projectiles.length >= 80) return;
    const start = center(e),
      goal = center(target, !target.mesh);
    if (hooks.blocked(start, goal)) return;
    const direction = goal.sub(start).normalize();
    const mesh = new THREE.Mesh(sphere, bulletMaterial);
    mesh.scale.set(0.075, 0.075, 0.38);
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    scene.add(mesh);
    projectiles.push({
      mesh,
      velocity: direction.multiplyScalar(A.projectileSpeed),
      life: 3,
      damage: A.gunnerDamage * (floorY === 0 ? A.floor1DamageScale : 1),
    });
    hooks.burst(start, 0xffa15a, 2);
    hooks.sound("enemy");
  }

  const lastPos = new WeakMap();
  function syncEnemyModel(e, dt, time) {
    const before = lastPos.get(e) || e.pos.clone();
    const moving = e.pos.distanceToSquared(before) > 1e-5;
    lastPos.set(e, e.pos.clone());
    e.model.update(dt, {
      time,
      phase: e.phase,
      flash: e.flash,
      windup: e.windup > 0 ? 1 - e.windup / A.enemyTelegraph : 0,
      firing: e.shots > 0,
      exposed: e.expose > 0,
      stagger: e.stagger,
      moving,
      camera: hooks.getCamera(),
      shieldHit: e.shieldHit,
    });
  }

  function updateEnemy(e, dt, time, player) {
    if (e.dead) return;
    e.age += dt;
    e.expose = Math.max(0, e.expose - dt);
    e.stagger = Math.max(0, e.stagger - dt);
    e.flash = Math.max(0, e.flash - dt);
    e.shieldHit = Math.max(0, (e.shieldHit || 0) - dt);
    const candidates = [
      player,
      ...allies.filter((a) => !a.dead && a.spawnAge > 0.3),
    ];
    let target = player,
      best = Infinity;
    for (const a of candidates) {
      if (a === player && !player.alive) continue;
      const distance =
        e.pos.distanceToSquared(a.pos) *
        (a.temporary ? 0.66 : a.mesh ? 1.5 : 1);
      if (
        distance < best &&
        !hooks.blocked(center(e), center(a, a === player))
      ) {
        best = distance;
        target = a;
      }
    }
    e.target = target;
    facing(e, target.pos, dt);
    if (e.stagger > 0) {
      e.aimLine.visible = false;
      e.windup = 0;
      e.shots = 0;
      e.timer = 0.7;
      return;
    }
    const distance = e.pos.distanceTo(target.pos);
    const visible = !hooks.blocked(
      center(e),
      center(target, target === player),
    );
    if (!visible || distance > (e.kind === "shield" ? 9 : 14)) {
      moveToward(
        e,
        target.pos,
        A.enemySpeed * (e.kind === "shield" ? 0.68 : 1),
        dt,
        e.seed % 2 ? 1 : -1,
      );
    } else if (e.windup <= 0 && e.shots === 0) {
      const side = Math.sin(time * 0.55 + e.phase) * A.enemySpeed * 0.3 * dt;
      hooks.move(
        e.pos,
        new THREE.Vector3(Math.cos(e.yaw) * side, 0, -Math.sin(e.yaw) * side),
        e.radius,
      );
    }
    e.timer -= dt;
    if (e.windup > 0) {
      e.windup -= dt;
      aim(e, target);
      if (e.windup <= 0) {
        e.aimLine.visible = false;
        e.shots = e.kind === "shield" ? 2 : 3;
        e.shotTimer = 0;
        e.expose = A.shieldExpose;
      }
    } else if (e.shots > 0) {
      e.shotTimer -= dt;
      if (e.shotTimer <= 0) {
        shoot(e, target);
        e.shots--;
        e.shotTimer = 0.17;
      }
      if (e.shots === 0)
        e.timer =
          A.enemyFireInterval *
          (floorY === 0 ? 1 : A.floor2FireScale) *
          (0.85 + Math.random() * 0.3);
    } else if (
      e.timer <= 0 &&
      visible &&
      distance < 36 &&
      Math.abs(
        angleDelta(
          e.yaw,
          Math.atan2(target.pos.x - e.pos.x, target.pos.z - e.pos.z),
        ),
      ) < 0.5 &&
      (target !== player || player.alive)
    ) {
      const attackerLimit =
        floorY === 0 ? A.floor1Attackers : A.floor2Attackers;
      const occupied = enemies.reduce(
        (n, other) =>
          n + (!other.dead && (other.windup > 0 || other.shots > 0) ? 1 : 0),
        0,
      );
      if (occupied < attackerLimit) e.windup = A.enemyTelegraph;
    }
  }

  function updateAlly(a, dt, time, player) {
    a.lifetime -= dt;
    a.spawnAge += dt;
    a.hurt = Math.max(0, a.hurt - dt);
    if (a.lifetime <= 0 || a.dead) {
      hooks.burst(center(a), 0x94ffd9, 10);
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
    let target = null,
      best = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = a.pos.distanceToSquared(e.pos);
      if (d < best && !hooks.blocked(center(a), center(e))) {
        target = e;
        best = d;
      }
    }
    a.target = target;
    a.shoot -= dt;
    if (target) {
      a.mesh.rotation.y = Math.atan2(
        target.pos.x - a.pos.x,
        target.pos.z - a.pos.z,
      );
      if (best > 12 * 12)
        moveToward(a, target.pos, A.enemySpeed * 1.4, dt, a.index % 2 ? 1 : -1);
      if (a.shoot <= 0 && best < 30 * 30) {
        a.shoot = A.allyFireInterval * (a.temporary ? 1 : 1.6);
        const start = center(a),
          end = center(target);
        if (!hooks.blocked(start, end)) {
          a.model.shoot();
          hooks.beam(start, end, a.temporary ? 0xa8ffd1 : 0x6bcfff);
          hitEnemy(
            target,
            a.temporary ? A.allyDamage : A.permanentDamage,
            start,
            true,
          );
        }
      }
      // Called agents fan around the enemy, creating useful shield flanks.
      if (a.temporary && best < 13 * 13 && target.kind === "shield") {
        const delta = a.pos.clone().sub(target.pos);
        delta.y = 0;
        if (delta.length() > 3) {
          const tangent = new THREE.Vector3(delta.z, 0, -delta.x)
            .normalize()
            .multiplyScalar(A.enemySpeed * dt * (a.index % 2 ? 1 : -1));
          hooks.move(a.pos, tangent, a.radius);
        }
      }
    } else {
      const follow = player.pos
        .clone()
        .add(new THREE.Vector3(a.index % 2 ? 2.8 : -2.8, 0, 2));
      if (a.pos.distanceTo(follow) > 2)
        moveToward(a, follow, A.enemySpeed * 1.6, dt, a.index % 2 ? 1 : -1);
    }
  }

  function projectileHit(p, previous, target, isPlayer) {
    const midpoint = center(target, isPlayer);
    const ray = new THREE.Line3(previous, p.mesh.position);
    ray.closestPointToPoint(midpoint, true, tmp);
    const horizontal = Math.hypot(tmp.x - midpoint.x, tmp.z - midpoint.z);
    return (
      horizontal < (isPlayer ? 0.47 : 0.5) &&
      Math.abs(tmp.y - midpoint.y) <
        (isPlayer ? (target.height || 1.7) * 0.5 : 0.5)
    );
  }

  function update(dt, time) {
    cooldown = Math.max(0, cooldown - dt);
    const player = hooks.getPlayer();
    for (const e of enemies) {
      updateEnemy(e, dt, time, player);
      if (!e.dead) syncEnemyModel(e, dt, time);
    }
    for (const a of [...allies]) updateAlly(a, dt, time, player);
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i],
        previous = p.mesh.position.clone();
      p.life -= dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      let remove = p.life <= 0 || hooks.blocked(previous, p.mesh.position);
      if (!remove && player.alive && projectileHit(p, previous, player, true)) {
        hooks.damagePlayer(p.damage, previous);
        remove = true;
      }
      if (!remove)
        for (const a of allies) {
          if (a.spawnAge < 0.7 || !projectileHit(p, previous, a, false))
            continue;
          a.hurt = 0.18;
          if (a.temporary) {
            a.hp -= p.damage;
            if (a.hp <= 0) a.dead = true;
          }
          hooks.burst(center(a), 0x8be4ff, 3);
          remove = true;
          break;
        }
      if (remove) {
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }
  }

  return {
    enemies,
    allies,
    reset,
    spawnWave,
    update,
    hitEnemy,
    callIn,
    reduceCooldown(s) {
      cooldown = Math.max(0, cooldown - s);
    },
    clear,
    get ready() {
      return cooldown <= 0;
    },
    get cooldown() {
      return cooldown;
    },
    get activeRemaining() {
      return Math.max(
        0,
        ...allies.filter((a) => a.temporary).map((a) => a.lifetime),
      );
    },
    dispose() {
      clear();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
