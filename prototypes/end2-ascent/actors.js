import * as THREE from "three";

// Actor positions are feet; every projectile checks the same world obstruction
// hook as the player's rifle, so cover works for both teams.
export function createActors(scene, T, hooks) {
  const A = T.actors;
  const enemies = [],
    allies = [],
    projectiles = [];
  const geometries = new Set(),
    materials = new Set();
  const geo = (g) => (geometries.add(g), g);
  const mat = (m) => (materials.add(m), m);
  const sphere = geo(new THREE.SphereGeometry(1, 20, 14));
  const box = geo(new THREE.BoxGeometry(1, 1, 1));
  const ring = geo(new THREE.TorusGeometry(0.66, 0.035, 6, 36));
  const disc = geo(new THREE.CircleGeometry(1, 32));
  const yellow = mat(
    new THREE.MeshStandardMaterial({
      color: 0xffcf34,
      roughness: 0.38,
      metalness: 0.15,
    }),
  );
  const dark = mat(
    new THREE.MeshStandardMaterial({
      color: 0x182736,
      roughness: 0.4,
      metalness: 0.7,
    }),
  );
  const brass = mat(
    new THREE.MeshStandardMaterial({
      color: 0xd48b1b,
      roughness: 0.35,
      metalness: 0.6,
    }),
  );
  const cyan = mat(new THREE.MeshBasicMaterial({ color: 0x50edff }));
  const mint = mat(new THREE.MeshBasicMaterial({ color: 0xc3ff75 }));
  const bulletMaterial = mat(new THREE.MeshBasicMaterial({ color: 0xff7049 }));
  const healthMaterial = mat(
    new THREE.MeshBasicMaterial({ color: 0xffb24b, depthTest: false }),
  );
  const healthBackMaterial = mat(
    new THREE.MeshBasicMaterial({ color: 0x1c2430, depthTest: false }),
  );
  const faceCanvas = document.createElement("canvas");
  faceCanvas.width = faceCanvas.height = 256;
  const ctx = faceCanvas.getContext("2d");
  ctx.fillStyle = "#3f2a13";
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#3f2a13";
  // Hugging Face's delighted closed eyes and open smile remain readable at range.
  for (const x of [81, 175]) {
    ctx.beginPath();
    ctx.moveTo(x - 20, 106);
    ctx.quadraticCurveTo(x, 80, x + 20, 106);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(77, 130);
  ctx.quadraticCurveTo(128, 145, 179, 130);
  ctx.bezierCurveTo(177, 207, 79, 207, 77, 130);
  ctx.fill();
  ctx.fillStyle = "#f77968";
  ctx.beginPath();
  ctx.ellipse(128, 177, 26, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f49a3a";
  ctx.beginPath();
  ctx.ellipse(51, 135, 18, 10, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(205, 135, 18, 10, 0.12, 0, Math.PI * 2);
  ctx.fill();
  const faceTexture = new THREE.CanvasTexture(faceCanvas);
  faceTexture.colorSpace = THREE.SRGBColorSpace;
  const faceMaterial = mat(
    new THREE.MeshBasicMaterial({
      map: faceTexture,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  let floorY = 0,
    cooldown = 0,
    sequence = 0;
  const up = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();

  function part(parent, geometry, material, position, scale) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...position);
    if (scale) m.scale.set(...scale);
    parent.add(m);
    return m;
  }

  function enemyModel(kind) {
    const mesh = new THREE.Group();
    const body = part(mesh, sphere, yellow, [0, 1.3, 0], [0.78, 0.78, 0.66]);
    part(mesh, disc, faceMaterial, [0, 1.32, 0.66], [0.71, 0.71, 1]);
    part(mesh, box, dark, [0, 0.43, 0], [0.85, 0.34, 0.55]);
    for (const side of [-1, 1]) {
      part(mesh, box, dark, [side * 0.27, 0.19, 0.07], [0.3, 0.35, 0.54]);
      // Palms and four little fingers, wrapped around the weapons.
      part(mesh, sphere, yellow, [side * 0.78, 0.97, 0.25], [0.24, 0.25, 0.22]);
      for (let i = 0; i < 4; i++)
        part(
          mesh,
          sphere,
          yellow,
          [side * (0.65 + i * 0.075), 1.09, 0.36],
          [0.055, 0.13, 0.07],
        );
    }
    part(mesh, box, dark, [0.78, 0.96, 0.56], [0.22, 0.22, 0.83]);
    part(mesh, box, brass, [0.78, 0.96, 1.02], [0.28, 0.28, 0.11]);
    part(
      mesh,
      sphere,
      bulletMaterial,
      [0.78, 0.96, 1.08],
      [0.065, 0.065, 0.045],
    );
    let shield = null;
    if (kind === "shield") {
      shield = new THREE.Group();
      shield.position.set(-0.57, 0.97, 0.72);
      mesh.add(shield);
      part(shield, box, dark, [0, 0, 0], [0.94, 1.66, 0.13]);
      const glass = mat(
        new THREE.MeshStandardMaterial({
          color: 0x55d9ff,
          emissive: 0x167fa3,
          emissiveIntensity: 0.65,
          metalness: 0.6,
          roughness: 0.3,
          transparent: true,
          opacity: 0.82,
        }),
      );
      part(shield, box, glass, [0, 0, 0.09], [0.78, 1.48, 0.06]);
      part(shield, disc, yellow, [0, 0.03, 0.135], [0.3, 0.3, 1]);
      part(shield, disc, faceMaterial, [0, 0.03, 0.14], [0.3, 0.3, 1]);
      for (const x of [-0.46, 0.46])
        part(shield, box, brass, [x, 0, 0], [0.055, 1.69, 0.18]);
    }
    const health = new THREE.Group();
    health.position.set(0, 2.45, 0);
    mesh.add(health);
    part(health, box, healthBackMaterial, [0, 0, 0], [1.06, 0.09, 0.025]);
    const fill = part(
      health,
      box,
      healthMaterial,
      [0, 0, 0.02],
      [1, 0.055, 0.025],
    );
    health.visible = false;
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
    return { mesh, body, shield, health, fill, aimLine };
  }

  function addAlly(x, z, temporary, index = 0) {
    const mesh = new THREE.Group();
    mesh.position.set(x, floorY, z);
    const shell = mat(
      new THREE.MeshStandardMaterial({
        color: temporary ? 0x9cffdf : 0x6ecaff,
        emissive: temporary ? 0x249c77 : 0x174a91,
        emissiveIntensity: 0.8,
        metalness: 0.65,
        roughness: 0.25,
      }),
    );
    const orb = part(mesh, sphere, shell, [0, 1.35, 0], [0.41, 0.41, 0.41]);
    const halo = part(mesh, ring, temporary ? mint : cyan, [0, 1.35, 0]);
    halo.rotation.x = Math.PI / 2;
    part(mesh, box, dark, [0, 1.35, 0.35], [0.52, 0.14, 0.17]);
    part(
      mesh,
      box,
      temporary ? mint : cyan,
      [0, 1.35, 0.45],
      [0.35, 0.055, 0.03],
    );
    part(mesh, box, dark, [0.35, 1.19, 0.18], [0.13, 0.17, 0.49]);
    const arrivalMaterial = new THREE.MeshBasicMaterial({
      color: 0xa8ffd1,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const arrival = new THREE.Mesh(ring, arrivalMaterial);
    arrival.rotation.x = Math.PI / 2;
    arrival.position.y = 0.06;
    mesh.add(arrival);
    arrival.visible = temporary;
    scene.add(mesh);
    const ally = {
      mesh,
      pos: mesh.position,
      orb,
      halo,
      shell,
      arrival,
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
    a.shell.dispose();
    materials.delete(a.shell);
    a.arrival.material.dispose();
    const idx = allies.indexOf(a);
    if (idx >= 0) allies.splice(idx, 1);
  }

  function removeEnemy(e) {
    scene.remove(e.mesh, e.aimLine);
    e.aimLine.geometry.dispose();
    e.aimLine.material.dispose();
    if (e.shield)
      e.shield.traverse((o) => {
        if (o.isMesh && o.material !== faceMaterial && o.material.transparent) {
          o.material.dispose();
          materials.delete(o.material);
        }
      });
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

  function hitEnemy(e, damage, shotOrigin, byAlly = false) {
    if (!e || e.dead) return { blocked: false, killed: false };
    let blocked = false;
    if (e.kind === "shield" && e.expose <= 0 && e.stagger <= 0) {
      const incoming = shotOrigin.clone().sub(e.pos);
      incoming.y = 0;
      incoming.normalize();
      const front = new THREE.Vector3(Math.sin(e.yaw), 0, Math.cos(e.yaw));
      blocked = incoming.dot(front) > 0.3;
      if (blocked) damage *= A.shieldReduction;
    }
    e.hp -= damage;
    e.flash = 0.13;
    e.health.visible = true;
    e.fill.scale.x = Math.max(0, e.hp / e.maxHp);
    e.fill.position.x = -(1 - e.fill.scale.x) / 2;
    if (blocked) hooks.burst(center(e), 0x66daff, 3);
    if (e.hp <= 0) {
      e.dead = true;
      removeEnemy(e);
      hooks.burst(center(e), 0xffd64b, 14);
      hooks.sound("kill");
      hooks.onKill(e.kind, byAlly);
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

  function updateEnemy(e, dt, time, player) {
    if (e.dead) return;
    e.age += dt;
    e.expose = Math.max(0, e.expose - dt);
    e.stagger = Math.max(0, e.stagger - dt);
    e.flash = Math.max(0, e.flash - dt);
    e.body.scale.set(0.78 + e.flash, 0.78 + e.flash, 0.66 + e.flash);
    if (e.shield)
      e.shield.rotation.y = THREE.MathUtils.damp(
        e.shield.rotation.y,
        e.expose > 0 || e.stagger > 0 ? -1.1 : 0,
        10,
        dt,
      );
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
    e.health.rotation.y = -e.mesh.rotation.y; // Bars remain world-aligned, readable above the face.
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
    if (a.temporary && a.spawnAge < 1) {
      const progress = THREE.MathUtils.clamp(a.spawnAge / 0.7, 0, 1);
      a.mesh.scale.setScalar(Math.max(0.01, progress));
      a.orb.position.y = 0.2 + progress * 1.15;
      a.arrival.scale.setScalar(1 + progress * 2);
      a.arrival.material.opacity = (1 - progress) * 0.8;
      return;
    }
    a.arrival.visible = false;
    a.mesh.scale.setScalar(a.temporary && a.lifetime < 1 ? a.lifetime : 1);
    a.orb.position.y = 1.35 + Math.sin(time * 3 + a.phase) * 0.12;
    a.halo.rotation.z = time * 1.3 + a.phase;
    a.shell.emissiveIntensity = a.hurt > 0 ? 3 : 0.8;
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
    for (const e of enemies) updateEnemy(e, dt, time, player);
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
      faceTexture.dispose();
    },
  };
}
