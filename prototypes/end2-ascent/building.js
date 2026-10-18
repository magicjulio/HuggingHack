import * as THREE from "three";

// Fight's adapter over the floor-2 level contract (floor2.js, brief r3): world
// coordinates, which section a point is in, the nav graph with door gating, A*
// routes, and "can I walk straight there" checks. Gameplay code (main.js,
// actors.js, encounter.js, smoke.mjs) talks to this, never to the raw level, so a
// contract change only touches this file.
//   level  = world.level (local coordinates, y = 0 is the floor-2 floor)
//   floorY = world.floorY (added to every y here)
//   hooks  = { ground(x, z, y) → absolute y, colliders() → world.colliders,
//              stepUp (max climb per step, m) }
export function createBuilding(level, floorY, hooks) {
  const V = (x, z, y) => new THREE.Vector3(x, floorY + (y || 0), z);
  const sections = level.sections.map((s, index) => {
    const anchors = {};
    for (const [k, list] of Object.entries(s.anchors || {})) anchors[k] = (list || []).map(([x, z, y]) => V(x, z, y));
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const r of s.rects) {
      minX = Math.min(minX, r.minX);
      maxX = Math.max(maxX, r.maxX);
      minZ = Math.min(minZ, r.minZ);
      maxZ = Math.max(maxZ, r.maxZ);
    }
    return {
      index,
      id: s.id,
      name: s.name || s.id,
      kind: s.kind,
      rects: s.rects,
      bounds: { minX, maxX, minZ, maxZ },
      center: new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2),
      ceiling: s.ceiling == null ? Infinity : floorY + s.ceiling,
      entry: s.entry ?? null,
      exit: s.exit ?? null,
      anchors,
      hold: s.hold ? { x: s.hold.x, z: s.hold.z, y: floorY + (s.hold.y || 0), r: s.hold.r || 3 } : null,
      raw: s,
    };
  });
  for (const s of sections) s.center.y = ground(s.center.x, s.center.z);
  const byId = new Map(sections.map((s) => [s.id, s]));
  const doors = level.doors || [];
  const doorById = new Map(doors.map((d) => [d.id, d]));
  const doorOpen = (d) => !!d.isOpen;

  function ground(x, z, y) {
    const g = hooks.ground(x, z, y);
    return Number.isFinite(g) ? g : null;
  }
  const inRect = (r, x, z, pad = 0) => x >= r.minX - pad && x <= r.maxX + pad && z >= r.minZ - pad && z <= r.maxZ + pad;
  // Section index at a point; overlapping rects (stairs under a balcony) are
  // told apart by the ground height nearest to `y`.
  const idIndex = new Map(sections.map((s) => [s.id, s.index]));
  function sectionAt(x, z, y, pad = 0) {
    if (level.sectionAt && !pad) {
      const id = level.sectionAt(x, z);
      return id == null ? -1 : idIndex.get(id) ?? -1;
    }
    let best = -1,
      bestDy = Infinity;
    for (const s of sections)
      for (const r of s.rects)
        if (inRect(r, x, z, pad)) {
          const dy = y === undefined ? 0 : Math.abs(s.levelY - y);
          if (dy < bestDy) {
            bestDy = dy;
            best = s.index;
          }
        }
    return best;
  }
  const inSection = (index, x, z, pad = 0) => index >= 0 && sections[index]?.rects.some((r) => inRect(r, x, z, pad));
  // Within any section, or in a doorway.
  function walkable(x, z, pad = 0.35) {
    if (sections.some((s) => s.rects.some((r) => inRect(r, x, z, pad)))) return true;
    return doors.some((d) => Math.hypot(d.x - x, d.z - z) < d.width / 2 + 0.6);
  }

  // ---------------------------------------------------------------- nav graph
  const nodes = level.nav.nodes.map(([x, z, y]) => V(x, z, y));
  const adj = nodes.map(() => []);
  // Doors an edge passes through (closed doors cut the edge).
  function doorsOn(a, b) {
    const out = [];
    for (const d of doors) {
      const half = d.width / 2 + 0.3;
      const c = d.collider || (d.axis === "x"
        ? { minX: d.x - half, maxX: d.x + half, minZ: d.z - 0.4, maxZ: d.z + 0.4 }
        : { minX: d.x - 0.4, maxX: d.x + 0.4, minZ: d.z - half, maxZ: d.z + half });
      if (segBox2(a, b, c.minX - 0.1, c.maxX + 0.1, c.minZ - 0.1, c.maxZ + 0.1)) out.push(d);
    }
    return out;
  }
  for (const [i, j, doorId] of level.nav.edges) {
    if (!nodes[i] || !nodes[j]) continue;
    const cost = nodes[i].distanceTo(nodes[j]);
    // the level tags edges through a door (third element); else find them here
    const via = doorId !== undefined ? [doorById.get(doorId)].filter(Boolean) : doorsOn(nodes[i], nodes[j]);
    adj[i].push({ j, cost, via });
    adj[j].push({ j: i, cost, via });
  }
  // spatial buckets (4 m) for nearest-node queries
  const CELL = 4,
    buckets = new Map();
  const bkey = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  nodes.forEach((n, i) => {
    const k = bkey(n.x, n.z);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(i);
  });
  function nodesNear(p, rings = 1) {
    const cx = Math.floor(p.x / CELL),
      cz = Math.floor(p.z / CELL),
      out = [];
    for (let dx = -rings; dx <= rings; dx++)
      for (let dz = -rings; dz <= rings; dz++) {
        const b = buckets.get(`${cx + dx},${cz + dz}`);
        if (b) out.push(...b);
      }
    return out;
  }
  const passable = (edge) => edge.via.every(doorOpen);
  // A section's typical floor height (mean of its nav nodes), to tell stacked
  // sections apart in sectionAt.
  for (const s of sections) {
    const inside = nodes.filter((n) => s.rects.some((r) => inRect(r, n.x, n.z)));
    s.levelY = inside.length ? inside.reduce((a, n) => a + n.y, 0) / inside.length : s.center.y ?? floorY;
  }

  // Can an actor walk the straight line a → b? No tall collider (or closed door)
  // in the way at knee and chest height, and the ground has no step bigger than
  // stepUp along it (no walking off a balcony or up a wall).
  const tmpA = new THREE.Vector3(),
    tmpB = new THREE.Vector3(),
    dir = new THREE.Vector3();
  function straight(a, b, radius = 0.4, ignoreLow = false) {
    const flat = Math.hypot(b.x - a.x, b.z - a.z);
    if (flat < 0.05) return Math.abs(a.y - b.y) < 1;
    for (const h of [0.6, 1.3]) {
      tmpA.set(a.x, a.y + h, a.z);
      tmpB.set(b.x, b.y + h, b.z);
      if (hooks.blocked(tmpA, tmpB, ignoreLow)) return false;
    }
    // sideways clearance for the body: two offset rays at knee height
    dir.set(b.z - a.z, 0, -(b.x - a.x)).normalize().multiplyScalar(radius);
    for (const s of [1, -1]) {
      tmpA.set(a.x + dir.x * s, a.y + 0.6, a.z + dir.z * s);
      tmpB.set(b.x + dir.x * s, b.y + 0.6, b.z + dir.z * s);
      if (hooks.blocked(tmpA, tmpB, ignoreLow)) return false;
    }
    const n = Math.ceil(flat / 0.6);
    let y = a.y;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const g = ground(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, y);
      if (g === null || Math.abs(g - y) > hooks.stepUp) return false;
      y = g;
    }
    return Math.abs(y - b.y) < 1.2;
  }

  // Nearest nodes to p that p can walk to directly (up to `count` candidates).
  function anchorNodes(p, count = 3) {
    let near = nodesNear(p, 1);
    if (near.length < 4) near = nodesNear(p, 3);
    if (!near.length) near = nodes.map((_, i) => i);
    const order = near
      .map((i) => ({ i, d: Math.hypot(nodes[i].x - p.x, nodes[i].z - p.z) + Math.abs(nodes[i].y - p.y) * 3 }))
      .sort((a, b) => a.d - b.d);
    const out = [];
    for (const o of order.slice(0, 8)) {
      if (straight(p, nodes[o.i], 0.45)) out.push(o);
      if (out.length >= count) break;
    }
    if (!out.length && order.length) out.push(order[0]); // last resort: the closest one
    return out;
  }

  // A* from p to q over open edges; returns waypoints (Vector3s ending at q) or null.
  function path(p, q) {
    const from = anchorNodes(p),
      to = anchorNodes(q);
    if (!from.length || !to.length) return null;
    const goalCost = new Map(to.map((o) => [o.i, o.d]));
    const g = new Map(),
      prev = new Map(),
      open = heap();
    for (const o of from) {
      g.set(o.i, o.d);
      open.push({ i: o.i, f: o.d + nodes[o.i].distanceTo(q) });
    }
    let found = -1,
      best = Infinity;
    while (open.size) {
      const { i, f } = open.pop();
      if (f >= best) break;
      if (goalCost.has(i)) {
        const total = g.get(i) + goalCost.get(i);
        if (total < best) {
          best = total;
          found = i;
        }
      }
      for (const e of adj[i]) {
        if (!passable(e)) continue;
        const ng = g.get(i) + e.cost;
        if (ng < (g.get(e.j) ?? Infinity)) {
          g.set(e.j, ng);
          prev.set(e.j, i);
          open.push({ i: e.j, f: ng + nodes[e.j].distanceTo(q) });
        }
      }
    }
    if (found < 0) return null;
    const pts = [q.clone()];
    for (let i = found; i !== undefined; i = prev.get(i)) pts.unshift(nodes[i].clone());
    // drop leading nodes we can already skip (light string pulling)
    while (pts.length > 2 && straight(p, pts[1], 0.45)) pts.shift();
    return pts;
  }

  // Point on the near side of a door, inside `section` (respawns, bot goals).
  function doorSide(door, section, depth = 1.6) {
    const s = sections[section];
    let best = null,
      bestD = Infinity;
    for (const r of s.rects) {
      const x = THREE.MathUtils.clamp(door.x, r.minX + depth, r.maxX - depth),
        z = THREE.MathUtils.clamp(door.z, r.minZ + depth, r.maxZ - depth);
      const d = Math.hypot(x - door.x, z - door.z);
      if (d < bestD) {
        bestD = d;
        best = [x, z];
      }
    }
    const p = new THREE.Vector3(best[0], 0, best[1]);
    p.y = ground(p.x, p.z, floorY + (door.y || 0)) ?? floorY;
    return p;
  }
  const doorPoint = (d) => new THREE.Vector3(d.x, floorY + (d.y || 0), d.z);

  return {
    level,
    sections,
    byId,
    doors,
    doorById,
    nodes,
    adj,
    floorY,
    start: V(level.start.x, level.start.z, 0),
    startYaw: level.start.yaw || 0,
    goal: level.goal ? V(level.goal.x, level.goal.z, level.goal.y) : null,
    ground,
    sectionAt,
    inSection,
    walkable,
    straight,
    path,
    doorSide,
    doorPoint,
    entryDoor: (i) => (sections[i]?.entry ? doorById.get(sections[i].entry) : null),
    exitDoor: (i) => (sections[i]?.exit ? doorById.get(sections[i].exit) : null),
    ceilingAt(x, z, y) {
      const i = sectionAt(x, z, y);
      return i < 0 ? Infinity : sections[i].ceiling;
    },
  };
  // a tiny binary min-heap on .f
  function heap() {
    const a = [];
    return {
      get size() {
        return a.length;
      },
      push(x) {
        a.push(x);
        let i = a.length - 1;
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (a[p].f <= a[i].f) break;
          [a[p], a[i]] = [a[i], a[p]];
          i = p;
        }
      },
      pop() {
        const top = a[0],
          last = a.pop();
        if (a.length) {
          a[0] = last;
          let i = 0;
          for (;;) {
            const l = 2 * i + 1,
              r = l + 1;
            let m = i;
            if (l < a.length && a[l].f < a[m].f) m = l;
            if (r < a.length && a[r].f < a[m].f) m = r;
            if (m === i) break;
            [a[m], a[i]] = [a[i], a[m]];
            i = m;
          }
        }
        return top;
      },
    };
  }
  function segBox2(a, b, minX, maxX, minZ, maxZ) {
    // 2D slab test of segment a→b (x/z) against a rectangle
    let t0 = 0,
      t1 = 1;
    for (const [p, d, lo, hi] of [
      [a.x, b.x - a.x, minX, maxX],
      [a.z, b.z - a.z, minZ, maxZ],
    ]) {
      if (Math.abs(d) < 1e-9) {
        if (p < lo || p > hi) return false;
        continue;
      }
      let u = (lo - p) / d,
        v = (hi - p) / d;
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u);
      t1 = Math.min(t1, v);
      if (t0 > t1) return false;
    }
    return true;
  }
}
