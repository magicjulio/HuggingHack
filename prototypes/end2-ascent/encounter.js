import * as THREE from "three";

// Encounter director: each floor is a list of beats from T.encounter.floors[n].
//   { id, type: "clear" | "push" | "hold", title, hint, spawns: [{ kind, x, z, delay? }],
//     hold?: { x, z, r, time }, trickle?: { every, max, pool: [kind], points: [[x, z]] } }
// "clear": beat ends when its defenders are down. "push": same, but they
// advance on you instead of holding cover. "hold": stand in the zone until the
// meter fills (it pauses while you are outside), with reinforcements trickling
// in; then clear what is left. The director only calls hooks; it owns no art
// except the zone ring, which comes from looks.ring("hold").
export function createEncounter(T, hooks) {
  const E = T.encounter;
  let beats = [],
    index = -1,
    wait = 0,
    floorY = 0,
    progress = 0,
    trickleTimer = 0,
    spawned = 0,
    active = false,
    done = false,
    inZone = false;
  const zone = hooks.looks.ring("hold");
  const zonePos = new THREE.Vector3();

  function start(floor, y) {
    beats = E.floors[floor] || [];
    index = -1;
    wait = E.initialDelay;
    floorY = y;
    progress = 0;
    active = false;
    done = false;
    zone.hide();
  }

  function begin(i) {
    index = i;
    const b = beats[i];
    active = true;
    progress = 0;
    spawned = 0;
    trickleTimer = b.trickle ? b.trickle.every : 0;
    hooks.spawn(b.spawns || [], b.type === "push" ? "advance" : "hold");
    hooks.toast(b.title, 2.6);
    if (b.hint) hooks.hint(b.hint, b.hintTime || 8);
    hooks.sound("wave");
    if (b.hold) zonePos.set(b.hold.x, floorY, b.hold.z);
  }

  function update(dt, time) {
    if (done) return;
    if (!active) {
      wait -= dt;
      if (wait <= 0) {
        if (index + 1 < beats.length) begin(index + 1);
        else {
          done = true;
          zone.hide();
        }
      }
      return;
    }
    const b = beats[index];
    const alive = hooks.alive();
    if (b.hold) {
      const p = hooks.playerPos();
      inZone = hooks.playerAlive() && Math.hypot(p.x - zonePos.x, p.z - zonePos.z) < b.hold.r;
      if (progress < 1) {
        if (inZone) progress = Math.min(1, progress + dt / b.hold.time);
        if (b.trickle && progress < 1) {
          trickleTimer -= dt;
          if (trickleTimer <= 0 && alive < b.trickle.max) {
            trickleTimer = b.trickle.every;
            const kind = b.trickle.pool[spawned % b.trickle.pool.length];
            const [x, z] = b.trickle.points[spawned % b.trickle.points.length];
            spawned++;
            hooks.spawn([{ kind, x, z }], "hold");
          }
        }
        if (progress >= 1) {
          hooks.toast(b.doneTitle || "HELD", 2.2);
          hooks.sound("wave");
        }
      }
      zone.set(zonePos, {
        radius: b.hold.r,
        progress,
        alpha: progress >= 1 ? 0.35 : inZone ? 1 : 0.6 + Math.sin(time * 6) * 0.3,
        time,
      });
      if (progress < 1) return;
    }
    if (alive === 0) {
      active = false;
      wait = E.beatDelay;
      if (b.hold) zone.hide();
      if (index + 1 >= beats.length) wait = 0;
    }
  }

  return {
    start,
    update,
    get done() {
      return done;
    },
    get beat() {
      return beats[index] || null;
    },
    get index() {
      return index;
    },
    get count() {
      return beats.length;
    },
    get progress() {
      return progress;
    },
    get inZone() {
      return inZone;
    },
    get holding() {
      const b = beats[index];
      return !!(active && b && b.hold && progress < 1);
    },
    zone: zonePos,
    dispose() {
      zone.dispose();
    },
  };
}
