import * as THREE from "three";

// Enemy projectile logic only. How a bolt looks comes from `looks.bolt(kind)`
// (placeholder in looks.js, replaceable by the characters area's fx.js), and
// impacts from `looks.impact(pos, "bolt")`. Bolts travel, stop at cover, and
// hit the player or an ally whose body they pass through.
export function createProjectiles({ max = 80, looks, blocked, center }) {
  const list = [];
  const seg = new THREE.Line3(),
    closest = new THREE.Vector3(),
    prev = new THREE.Vector3();

  function spawn(kind, start, dir, speed, damage) {
    if (list.length >= max) return false;
    const look = looks.bolt(kind);
    look.root.position.copy(start);
    look.update(0, { dir, age: 0 });
    list.push({ kind, look, pos: look.root.position, dir: dir.clone(), speed, damage, life: 3, age: 0 });
    return true;
  }

  // Swept test against an upright capsule-ish body around `mid`.
  function passes(p, mid, radius, halfHeight) {
    seg.set(prev, p.pos);
    seg.closestPointToPoint(mid, true, closest);
    return Math.hypot(closest.x - mid.x, closest.z - mid.z) < radius && Math.abs(closest.y - mid.y) < halfHeight;
  }

  function remove(i, impact) {
    const p = list[i];
    if (impact) looks.impact(p.pos.clone(), "bolt");
    p.look.dispose();
    list.splice(i, 1);
  }

  // player: { pos, height, alive }; allies: array with { pos, spawnAge };
  // onPlayer(damage, from) and onAlly(ally, damage) apply the hit.
  function update(dt, player, allies, onPlayer, onAlly) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      prev.copy(p.pos);
      p.life -= dt;
      p.age += dt;
      p.pos.addScaledVector(p.dir, p.speed * dt);
      p.look.update(dt, { dir: p.dir, age: p.age });
      if (p.life <= 0) {
        remove(i, false);
        continue;
      }
      if (blocked(prev, p.pos)) {
        remove(i, true);
        continue;
      }
      if (player.alive && passes(p, center(player, true), 0.47, (player.height || 1.7) * 0.5)) {
        onPlayer(p.damage, prev.clone());
        remove(i, true);
        continue;
      }
      for (const a of allies) {
        if (a.dead || a.spawnAge < 0.7 || !passes(p, center(a), 0.5, 0.5)) continue;
        onAlly(a, p.damage);
        remove(i, true);
        break;
      }
    }
  }

  function clear() {
    while (list.length) remove(list.length - 1, false);
  }

  return { list, spawn, update, clear };
}
