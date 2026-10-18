import * as THREE from "three";

// Encounter director: each floor is a list of beats from T.encounter.floors[n].
//   { id, type: "clear" | "push" | "hold", title, hint, spawns: [{ kind, x, z, delay? }],
//     hold?: { x, z, r, time }, trickle?: { every, max, pool: [kind], points: [[x, z]] } }
// "clear": beat ends when its defenders are down. "push": same, but they
// advance on you instead of holding cover. "hold": stand in the zone until the
// meter fills (it pauses while you are outside), with reinforcements trickling
// in; then clear what is left. The director only calls hooks; it owns no art
// except the zone ring, which comes from looks.ring("hold").
function createBeats(T, hooks) {
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
    hide() {
      zone.hide();
    },
    dispose() {
      zone.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Section director (floor 2 as a building; brief r3). The floor is a chain of
// sections joined by doors (building.js adapter `bld`). Each section has a
// script in T.encounter.sections[floor][sectionId]:
//   { title, hint, hintTime,
//     garrison: [{ kind, at: "cover:0" | "high:1" | "flank" | "back" | "drop" | [x, z, y?],
//                  wake?: "door" (default: wakes when the section's door opens) | "enter",
//                  mode?: "hold" | "advance", leash?: metres }],
//     events: [{ on: "door" | "enter" | "half" | "clear" | "time" | "hold", t?, at?,
//                via?: "drop" | "walk", toast?, sound?, spawn: [ same as garrison ] }],
//     ambush?: true,             // red door light + warning (T.building.doorTell) before it opens
//     hold?: { time, at?: [x, z, y?], r?, trickle?: { every, max, pool, via, at: [anchor] } } }
// Flow: the garrison of the next section is placed (dormant) behind its closed
// door; when the current section is clear its exit door opens (green), the
// garrison wakes, and the one after is placed. Entering a section fires its
// "enter" events and sets the checkpoint (retry at the last opened door).
function createSections(T, hooks) {
  const E = T.encounter,
    B = T.building;
  const zone = hooks.looks.ring("hold");
  const zonePos = new THREE.Vector3();
  let bld = null,
    scripts = [],
    cur = 0,
    opened = 0,
    checkpoint = 0,
    done = false,
    wait = 0,
    since = 0, // seconds since the current section was entered
    progress = 0,
    inZone = false,
    trickleTimer = 0,
    trickled = 0,
    pending = null, // { section, t, tell }
    garrisonSize = [],
    fired = [],
    placed = [],
    entered = [],
    cleared = [];
  const warnings = [];

  function scriptFor(i, floor) {
    const all = E.sections?.[floor] || {};
    const s = bld.sections[i];
    return all[s.id] || all[i] || {};
  }
  // Resolve a spec's position: an anchor of section i ("cover:2"), or local [x, z, y].
  const used = new Map();
  function resolve(i, spec, fallbackKind = "drop") {
    const s = bld.sections[i];
    const at = spec.at ?? fallbackKind;
    if (Array.isArray(at)) {
      const [x, z, y] = at;
      return new THREE.Vector3(x, bld.floorY + (y || 0), z);
    }
    const [type, n] = String(at).split(":");
    const list = s.anchors[type] || [];
    if (list.length) {
      let k;
      if (n !== undefined) k = +n % list.length;
      else {
        // next unused anchor of that type in this section
        const key = i + ":" + type;
        k = (used.get(key) || 0) % list.length;
        used.set(key, k + 1);
      }
      return list[k].clone();
    }
    warnings.push(`section ${s.id}: no "${type}" anchor, using the centre`);
    const p = s.center.clone();
    p.x += (Math.random() - 0.5) * 3;
    p.z += (Math.random() - 0.5) * 3;
    p.y = bld.ground(p.x, p.z, p.y) ?? p.y;
    return p;
  }
  function facing(i, p) {
    // face the way the player comes in: toward the entry door (or the start)
    const d = bld.entryDoor(i);
    const t = d ? bld.doorPoint(d) : bld.start;
    return Math.atan2(t.x - p.x, t.z - p.z);
  }
  function spawnList(i, list, opts) {
    const specs = list.map((g) => {
      const p = resolve(i, g, opts.fallback);
      return {
        kind: g.kind,
        x: p.x,
        z: p.z,
        y: p.y,
        section: i,
        mode: g.mode || opts.mode || "hold",
        leash: g.leash ?? opts.leash ?? 0,
        wake: g.wake || "door",
        dormant: opts.dormant,
        placed: opts.placed,
        delay: g.delay || 0,
        yaw: facing(i, p),
      };
    });
    return hooks.spawn(specs);
  }
  function placeGarrison(i, dormant) {
    if (i < 0 || i >= bld.sections.length || placed[i]) return;
    placed[i] = true;
    const g = scripts[i].garrison || [];
    garrisonSize[i] = g.length;
    if (g.length) spawnList(i, g, { dormant, placed: true, fallback: "cover" });
  }
  function fire(i, on, extra) {
    const evs = scripts[i].events || [];
    evs.forEach((ev, k) => {
      if (fired[i].has(k) || ev.on !== on) return;
      if (on === "time" && since < (ev.t || 0)) return;
      if (on === "hold" && progress < (ev.at ?? 0.5)) return;
      fired[i].add(k);
      const via = ev.via || "drop";
      if (ev.spawn?.length)
        spawnList(i, ev.spawn, {
          dormant: false,
          placed: via === "walk",
          mode: via === "walk" ? "advance" : "hold",
          fallback: via === "walk" ? "back" : "drop",
        });
      if (ev.toast) hooks.toast(ev.toast, 2.2);
      if (ev.hint) hooks.hint(ev.hint, ev.hintTime || 6);
      hooks.sound(ev.sound || (via === "walk" ? "enemy-tell" : "wave"));
    });
  }
  const pendingEvents = (i) => (scripts[i].events || []).some((ev, k) => !fired[i].has(k) && ev.on !== "door" && ev.on !== "hold");

  function start(floor, y, building) {
    bld = building;
    scripts = bld.sections.map((_, i) => scriptFor(i, floor));
    const n = bld.sections.length;
    fired = Array.from({ length: n }, () => new Set());
    placed = new Array(n).fill(false);
    entered = new Array(n).fill(false);
    cleared = new Array(n).fill(false);
    garrisonSize = new Array(n).fill(0);
    used.clear();
    warnings.length = 0;
    done = false;
    pending = null;
    progress = 0;
    zone.hide();
    for (let k = 1; k < n; k++) {
      const d = bld.entryDoor(k);
      if (d && d.isOpen) d.close();
    }
    cur = 0;
    opened = 0;
    checkpoint = 0;
    wait = E.initialDelay;
    placeGarrison(0, true);
    placeGarrison(1, true);
  }

  // Retry at the checkpoint (the last opened door, section k's entry). Returns
  // where the player respawns: { pos, yaw }.
  function restore(floor, k) {
    start(floor, 0, bld);
    // start() placed 0 and 1; re-run the chain up to k without fights
    hooks.clearEnemies();
    placed.fill(false);
    used.clear();
    for (let s = 1; s <= k; s++) {
      const d = bld.entryDoor(s);
      if (d && !d.isOpen) d.open();
    }
    for (let s = 0; s < k; s++) {
      entered[s] = cleared[s] = true;
      for (let e = 0; e < (scripts[s].events || []).length; e++) fired[s].add(e);
    }
    cur = k - 1;
    opened = k;
    checkpoint = k;
    wait = 0;
    placeGarrison(k, true);
    placeGarrison(k + 1, true);
    // a short grace, then the defenders behind the open door react
    pending = { wake: k, t: 1.5 };
    const door = bld.entryDoor(k);
    const pos = bld.doorSide(door, k - 1, 2.2);
    const dp = bld.doorPoint(door);
    return { pos, yaw: Math.atan2(-(dp.x - pos.x), -(dp.z - pos.z)) };
  }

  function openNext(i) {
    const door = bld.exitDoor(i) || bld.entryDoor(i + 1);
    if (door) hooks.openDoor(door, i + 1);
    opened = i + 1;
    checkpoint = i + 1;
    hooks.wakeSection(i + 1, (e) => e.wake !== "enter");
    fire(i + 1, "door");
    placeGarrison(i + 2, true);
    hooks.sound("waveclear");
  }

  function enter(j) {
    for (let k = cur + 1; k < j; k++) entered[k] = cleared[k] = true; // walked through
    entered[j] = true;
    cur = j;
    since = 0;
    progress = 0;
    trickled = 0;
    zone.shown = false;
    const sc = scripts[j];
    trickleTimer = sc.hold?.trickle?.every || 0;
    hooks.wakeSection(j);
    fire(j, "enter");
    if (sc.title) hooks.toast(sc.title, 2.6);
    if (sc.hint) hooks.hint(sc.hint, sc.hintTime || 8);
    const h = sc.hold && (sc.hold.at ? { x: sc.hold.at[0], z: sc.hold.at[1], y: bld.floorY + (sc.hold.at[2] || 0), r: sc.hold.r } : bld.sections[j].hold || bld.goal);
    if (h) zonePos.set(h.x, h.y ?? bld.floorY, h.z);
    zonePos.r = h?.r || sc.hold?.r || 3.2;
  }

  function update(dt, time) {
    if (done || !bld) return;
    if (pending) {
      pending.t -= dt;
      if (pending.wake !== undefined) {
        if (pending.t <= 0) {
          hooks.wakeSection(pending.wake, (e) => e.wake !== "enter");
          fire(pending.wake, "door");
          pending = null;
        }
      } else if (pending.t <= 0) {
        if (pending.tell && !pending.told) {
          pending.told = true;
          pending.t = B.doorTell;
          const door = bld.exitDoor(pending.section);
          hooks.doorAlarm?.(door, true);
          hooks.toast(scripts[pending.section + 1].tellText || "MOVEMENT BEHIND THE DOOR", B.doorTell + 0.6);
          hooks.sound("enemy-tell");
        } else {
          const i = pending.section;
          pending = null;
          if (i + 1 >= bld.sections.length) {
            done = true;
            zone.hide();
          } else openNext(i);
        }
      }
    }
    if (wait > 0) {
      wait -= dt;
      if (wait <= 0) enter(0);
      return;
    }
    // the player walked into a newly opened section
    const ps = hooks.playerSection();
    if (ps > cur && ps <= opened && hooks.playerAlive()) enter(ps);
    const i = cur;
    if (!entered[i] || cleared[i]) return;
    since += dt;
    const sc = scripts[i];
    const alive = hooks.aliveIn(i);
    fire(i, "time");
    if (alive <= Math.floor(garrisonSize[i] / 2)) fire(i, "half");
    if (alive === 0) fire(i, "clear");
    // hold: stand in the ring until the meter fills; trickle meanwhile.
    // hold.after === "clear": the ring only appears once the room is clear.
    const holdReady = sc.hold && (sc.hold.after !== "clear" || (hooks.aliveIn(i) === 0 && !pendingEvents(i)));
    if (holdReady) {
      if (sc.hold.after === "clear" && progress === 0 && !inZone && !zone.shown) {
        zone.shown = true;
        hooks.toast(sc.hold.readyTitle || "GET TO THE RING", 2.2);
      }
      const p = hooks.playerPos();
      inZone = hooks.playerAlive() && Math.hypot(p.x - zonePos.x, p.z - zonePos.z) < zonePos.r && Math.abs(p.y - zonePos.y) < 2;
      if (progress < 1) {
        if (inZone) progress = Math.min(1, progress + dt / sc.hold.time);
        fire(i, "hold");
        const tr = sc.hold.trickle;
        if (tr && progress < 1) {
          trickleTimer -= dt;
          if (trickleTimer <= 0 && hooks.aliveIn(i) < tr.max) {
            trickleTimer = tr.every;
            const kind = tr.pool[trickled % tr.pool.length];
            const at = tr.at ? tr.at[trickled % tr.at.length] : undefined;
            trickled++;
            spawnList(i, [{ kind, at }], {
              dormant: false,
              placed: tr.via === "walk",
              mode: tr.via === "walk" ? "advance" : "hold",
              fallback: tr.via === "walk" ? "back" : "drop",
            });
          }
        }
        if (progress >= 1) {
          hooks.toast(sc.hold.doneTitle || "HELD", 2.2);
          hooks.sound("wave");
        }
      }
      zone.set(zonePos, {
        radius: zonePos.r,
        progress,
        alpha: progress >= 1 ? 0.35 : inZone ? 1 : 0.6 + Math.sin(time * 6) * 0.3,
        time,
      });
      if (progress < 1) return;
    }
    if (hooks.aliveIn(i) > 0 || pendingEvents(i) || (sc.hold && progress < 1)) return;
    cleared[i] = true;
    if (sc.hold) zone.hide();
    const next = scripts[i + 1];
    const last = i + 1 >= bld.sections.length;
    if (!last) hooks.toast(sc.clearTitle || "SECTION CLEAR / DOOR UNLOCKED", 2);
    pending = { section: i, t: last ? E.completionDelay * 0 + 0.2 : B.sectionDelay, tell: !!next?.ambush && B.doorTell > 0 };
  }

  return {
    start,
    restore,
    update,
    alarm(section) {
      if (section > opened) return; // behind a closed door: nobody there can hear
      hooks.wakeSection(section);
    },
    get done() {
      return done;
    },
    get beat() {
      const s = bld?.sections[cur];
      return s ? { id: s.id, title: scripts[cur]?.title || s.name } : null;
    },
    get index() {
      return wait > 0 ? -1 : cur;
    },
    get count() {
      return bld ? bld.sections.length : 0;
    },
    get progress() {
      return progress;
    },
    get inZone() {
      return inZone;
    },
    get holding() {
      return !!(bld && entered[cur] && !cleared[cur] && scripts[cur]?.hold && progress < 1);
    },
    get section() {
      return cur;
    },
    get opened() {
      return opened;
    },
    get checkpoint() {
      return checkpoint;
    },
    get cleared() {
      return !!cleared[cur];
    },
    get pending() {
      return !!pending;
    },
    get warnings() {
      return warnings.slice();
    },
    get name() {
      return bld?.sections[cur]?.name || "";
    },
    // the section being fought: the newest opened one (you often fight it
    // through its door before stepping in), else the one you stand in
    get front() {
      if (!bld) return null;
      const k = opened > cur && !cleared[opened] ? opened : cur;
      return bld.sections[k]?.id ?? null;
    },
    zone: zonePos,
    hide() {
      zone.hide();
    },
    dispose() {
      zone.dispose();
    },
  };
}

// Floors 1 (and floor 2 without a building) run beats; a floor with a level and
// a T.encounter.sections[floor] script runs sections.
export function createEncounter(T, hooks) {
  const beats = createBeats(T, hooks),
    sections = createSections(T, hooks);
  let mode = beats;
  const api = {
    start(floor, y, building = null) {
      beats.hide();
      sections.hide();
      mode = building && T.encounter.sections?.[floor] ? sections : beats;
      mode.start(floor, y, building);
    },
    restore(floor, k) {
      return sections.restore(floor, k);
    },
    update: (dt, time) => mode.update(dt, time),
    alarm: (s) => mode === sections && sections.alarm(s),
    get mode() {
      return mode === sections ? "sections" : "beats";
    },
    dispose() {
      beats.dispose();
      sections.dispose();
    },
  };
  for (const k of ["done", "beat", "index", "count", "progress", "inZone", "holding", "zone", "section", "opened", "checkpoint", "cleared", "pending", "warnings", "name", "front"])
    Object.defineProperty(api, k, { get: () => mode[k] });
  return api;
}
