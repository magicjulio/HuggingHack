import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { textPlate } from "./art.js";
import { asset } from "./assets.js";

// Floor 2: a real building fought through section by section (owner: building).
// The layout below is the single source of truth: walkable rects per section, raised
// terraces, ramps, doors, cover. Everything else (walls, colliders, ground height, the
// nav graph, cover anchors) is generated from it. Coordinates are local to the floor-2
// base: y = 0 is the floor-2 floor; world.js places the group at floorY.
// Map + contract notes: FLOOR2.md. Rects are [minX, maxX, minZ, maxZ], +z is "north".
// Look: a greybox is built at once; the Blender kit (design/3d/end2/floors/building.py →
// end2-floor2-kit.glb) then dresses the same layout: kit materials on the generated walls,
// floors and ceilings, and kit props placed at exactly their collider footprints.

export const UP = 4.5; // the upper level (mezzanine terraces, skybridge, operations, core)
const WALL = 1; // rooms sit 1 m apart; the gap becomes wall, a door passage cuts it
const KIT_URL = asset("end2-floor2-kit.glb");

// Cover and furniture kinds: footprint [x, z] at rot 0, collider height (m, or "ceiling"),
// low = vaultable cover. `kit` pieces are built at exactly this size; `proc` ones are drawn here.
export const PIECES = {
  barrier: { size: [2.7, 0.5], h: 1.2, low: true, kit: "p_barrier" },
  desk: { size: [3.4, 1.2], h: 1.2, low: true, kit: "p_desk" },
  desk_s: { size: [2.4, 0.9], h: 1.2, low: true, kit: "p_desk_s" },
  crate: { size: [2.4, 1.1], h: 1.2, low: true, kit: "p_crate" },
  trunk: { size: [2.4, 0.8], h: 1.2, low: true, kit: "p_trunk" },
  console: { size: [3.4, 1.0], h: 1.2, low: true, kit: "p_console" },
  barricade: { size: [1.8, 0.6], h: 1.2, low: true, kit: "p_barricade" },
  rack: { size: [1.6, 2.0], h: 2.8, kit: "p_rack" },
  cooler: { size: [3, 3], h: 3.8, kit: "p_cooler" },
  terminal: { size: [2.4, 2.4], h: 2.2, kit: "p_terminal" },
  cabinet: { size: [2.2, 2.4], h: 2.4, kit: "p_cabinet" },
  shaft: { size: [6, 2.2], h: 11, kit: "p_shaft" },
  pillar: { size: [1.2, 1.2], h: "ceiling", proc: "pillar" },
  column: { size: [1.6, 1.6], h: "ceiling", proc: "pillar" },
  duct: { size: [1.4, 1.8], h: "ceiling", proc: "duct" },
  post: { size: [0.5, 0.6], h: "ceiling", hidden: true },
};

// cover: [x, z, kind, rot°]. windows: [side, from, to] (side n/s/e/w = the section's wall).
// look: light = the pooled lights' colour, strip = the wall light strips, tint = wall paint,
// floor = "floor" (steel plates) or "raised" (data-centre tiles).
export const LAYOUT = {
  start: { x: 0, z: -36.6, yaw: Math.PI }, // on the lift platform, facing the first door
  goal: { x: 8, z: 61.5, y: UP },
  sections: [
    {
      id: "s0",
      name: "LIFT LANDING",
      kind: "room",
      y: 0,
      ceiling: 6.5,
      rects: [[-8, 8, -43.5, -31]],
      cover: [
        [-5.2, -33.6, "crate", 0],
        [5.4, -34.4, "crate", 90],
        [-4.25, -43.0, "post"], // the lift rails run on up through the ceiling
        [4.25, -43.0, "post"],
      ],
      look: { light: 0xffc98a, strip: 0xffb347, tint: 0xb9b3aa, floor: "floor" },
      anchors: { back: [[0, -32.4]], drop: [[-4, -38], [4, -38]] },
    },
    {
      id: "s1",
      name: "SECURITY HALL",
      kind: "hall",
      y: 0,
      ceiling: 4.2,
      rects: [
        [-2.5, 2.5, -30, -6], // the hall
        [-8, -3.5, -21, -15], // west office
        [-3.5, -2.5, -18.6, -15.4], // its doorway
        [3.5, 8, -14, -8], // east office
        [2.5, 3.5, -12.4, -9.6], // its doorway
      ],
      cover: [
        [-1.15, -25.5, "barrier", 0],
        [1.15, -20.5, "barrier", 0],
        [-1.15, -14.5, "barrier", 0],
        [1.15, -9.5, "barrier", 0],
        [-6.2, -19.9, "desk_s", 0],
        [6.0, -9.0, "desk_s", 180],
      ],
      look: { light: 0xdcecff, strip: 0xbfe2ff, tint: 0xaeb9c6, floor: "floor" },
      anchors: {
        flank: [[-6, -16.4], [-4.6, -18.4], [6, -12.6], [4.6, -10]],
        back: [[0, -7.2], [-1.4, -7.4], [1.4, -7.4]],
      },
    },
    {
      id: "s2",
      name: "OPEN OFFICE",
      kind: "room",
      y: 0,
      ceiling: 4.6,
      rects: [[-14, 14, -5, 13]],
      cover: [
        [-10, 1.8, "desk", 0],
        [-2.4, 2.4, "desk", 0],
        [3.8, 1.6, "desk", 0],
        [10.4, 2.6, "desk", 0],
        [-6.6, 6.6, "desk", 0],
        [0.8, 7.2, "desk", 0],
        [8.2, 6.8, "desk", 0],
        [-11.4, 10.6, "desk_s", 90],
        [-6.6, -1.6, "pillar"],
        [6.6, -1.6, "pillar"],
        [-3.2, 10.4, "pillar"],
        [6.6, 10.4, "pillar"],
        [12.6, 11.4, "cabinet", 180],
      ],
      windows: [["e", -4, 1.4], ["e", 6.6, 12]],
      // side closets: reinforcements step out of these when their door opens (set-pieces)
      closets: [{ id: "s2a", rect: [15, 18, 2.5, 5.5], x: 14.5, z: 4, width: 2.2, axis: "z" }],
      look: { light: 0xffe4c0, strip: 0xffd59a, tint: 0xd2cbbf, floor: "floor" },
      anchors: {
        flank: [[12, -3.4], [12.4, 8.6]],
        back: [[-12, 11.6], [-7.6, 11.8], [-12.6, 6.4]],
        drop: [[0, 4.6], [-9, 4.4], [8.8, 4.2]],
      },
    },
    {
      id: "s3",
      name: "SERVER GALLERY",
      kind: "hall",
      y: 0,
      ceiling: 5.5,
      rects: [[-48, -15, 5.5, 12.5]],
      cover: [
        [-20.5, 8, "trunk", 0],
        [-25.5, 10.4, "trunk", 0],
        [-30.5, 7.6, "trunk", 0],
        [-35.5, 10.2, "trunk", 0],
        [-40.5, 8.2, "trunk", 0],
        // rack pods jutting from the walls: pockets out of a long sightline
        [-23, 6.5, "rack", 0],
        [-28, 11.5, "rack", 0],
        [-33, 6.5, "rack", 0],
        [-38, 11.5, "rack", 0],
      ],
      windows: [["s", -47, -38.2], ["s", -32, -24.2], ["s", -22, -16]],
      closets: [{ id: "s3a", rect: [-37.5, -34.5, 1, 4.5], x: -36, z: 5, width: 2.2, axis: "x" }],
      look: { light: 0x9fd0ff, strip: 0x6fc4ff, tint: 0x8d99a8, floor: "raised" },
      anchors: {
        back: [[-46.4, 9], [-46.4, 6.6], [-46.4, 11.2]],
        flank: [[-34.4, 6.3], [-36.6, 11.7]],
        drop: [[-30, 9.4]],
      },
    },
    {
      id: "s4",
      name: "COOLING HALL",
      kind: "arena",
      y: 0,
      ceiling: 12,
      rects: [[-52, -28, 13.5, 40]],
      terraces: [
        { rect: [-52, -28, 32, 40], y: UP }, // north mezzanine
        { rect: [-34, -28, 20, 32], y: UP }, // east mezzanine
      ],
      ramps: [
        // stairs up the west wall, from the floor (z 18) to the north mezzanine (z 32)
        { rect: [-52, -48.5, 18, 32], axis: "z", from: 18, to: 32, y0: 0, y1: UP },
      ],
      // balustrade on the open side of the stairs, in steps that follow the slope
      balustrade: { x: [-48.5, -48.2], z0: 18, z1: 32, steps: 4 },
      rails: [
        [-48.5, -42, 32, 32.25],
        [-40, -34, 32, 32.25], // gap x -42..-40: a drop down from the mezzanine
        [-34, -33.75, 20, 32],
        [-34, -28, 20, 20.25],
      ],
      cover: [
        [-45, 17.2, "trunk", 0],
        [-38, 18.6, "trunk", 0],
        [-42.4, 25.6, "trunk", 90],
        [-37, 23.6, "trunk", 0],
        [-45, 29.4, "trunk", 0],
        [-45, 37.5, "trunk", 90], // up on the mezzanine
        [-31, 27, "trunk", 0],
        [-43.5, 21, "cooler", 0],
        [-38.5, 28.4, "cooler", 180],
      ],
      closets: [{ id: "s4a", rect: [-39.5, -36.5, 41, 44], x: -38, z: 40.5, width: 2.2, axis: "x", y: UP }],
      look: { light: 0x9ae6e0, strip: 0x7ff0e0, tint: 0xa3b9ba, floor: "floor" },
      anchors: {
        high: [[-45.4, 34.2], [-38, 34.4], [-31, 30.6], [-31, 23.4], [-36.5, 38.6]],
        back: [[-30.2, 38.4], [-50.2, 38.4]],
        flank: [[-30.4, 15.6], [-50.4, 15.4]],
        drop: [[-40, 22.4], [-35, 16]],
      },
    },
    {
      id: "s5",
      name: "SKYBRIDGE",
      kind: "hall",
      y: UP,
      ceiling: UP + 4,
      rects: [[-27, -3, 34, 38]],
      cover: [
        [-22, 36.6, "barricade", 90],
        [-11.8, 35.0, "barricade", 90],
        [-7, 36.8, "barricade", 90],
        // the choke: a duct casing juts from the north wall and leaves 2.2 m
        [-15, 37.1, "duct"],
      ],
      windows: [["n", -26, -16.2], ["n", -13.8, -4], ["s", -26, -4]],
      look: { light: 0xaec4ff, strip: 0x8fb4ff, tint: 0x99a3b3, floor: "floor" },
      anchors: { back: [[-4.4, 36], [-6, 35], [-6, 37]], drop: [[-11, 36]] },
    },
    {
      id: "s6",
      name: "OPERATIONS",
      kind: "room",
      y: UP,
      ceiling: UP + 5,
      rects: [[-2, 16, 26, 42]],
      cover: [
        [2.4, 32.6, "console", 90],
        [2.4, 39.4, "console", 90],
        [8.2, 29.6, "console", 0],
        [13.2, 33.4, "console", 270],
        [8.6, 39.8, "console", 180],
        [9, 34.6, "terminal", 0],
      ],
      hold: { x: 9, z: 37.2, r: 2.4 },
      windows: [["e", 27, 34.4]],
      closets: [{ id: "s6a", rect: [17, 20, 35.5, 38.5], x: 16.5, z: 37, width: 2.2, axis: "z" }],
      look: { light: 0xffb070, strip: 0xff9a40, tint: 0x9b9088, floor: "raised" },
      anchors: {
        back: [[14.6, 40.6], [14.6, 27.4], [10.4, 27.4]],
        flank: [[3.8, 27.4], [3.6, 40.8]],
        drop: [[6, 36], [12, 36.6]],
      },
    },
    {
      id: "s7",
      name: "ASCENT CORE",
      kind: "arena",
      y: UP,
      ceiling: UP + 11,
      rects: [[-6, 22, 43, 67]],
      cover: [
        [4, 47.6, "crate", 0],
        [12.4, 47.2, "crate", 0],
        [-2.4, 54.6, "trunk", 90],
        [18.6, 54.4, "trunk", 90],
        [8, 53.8, "barrier", 0],
        [3, 58.8, "trunk", 0],
        [13.2, 59, "trunk", 0],
        [0, 50.4, "column"],
        [16, 50.4, "column"],
        [0, 61, "column"],
        [16, 61, "column"],
        [8, 65.4, "shaft", 180], // the next lift (the goal stands in front of it)
      ],
      hold: { x: 8, z: 61.5, r: 3 },
      windows: [["n", -5, 4.4], ["n", 11.6, 21]],
      closets: [
        { id: "s7a", rect: [-10, -7, 54.5, 57.5], x: -6.5, z: 56, width: 2.2, axis: "z" },
        { id: "s7b", rect: [23, 26, 54.5, 57.5], x: 22.5, z: 56, width: 2.2, axis: "z" },
      ],
      look: { light: 0xffd68a, strip: 0xffc153, tint: 0xc4c0b6, floor: "floor" },
      anchors: {
        back: [[2.4, 65.2], [13.6, 65.2], [-4.4, 65.4], [20.4, 65.4]],
        flank: [[-4.4, 48.4], [20.4, 48.4], [-4.4, 58], [20.4, 58]],
        drop: [[8, 50.4], [1, 45.6], [15, 45.6], [8, 57.2]],
      },
    },
  ],
  // axis: the axis the door's width runs along. Every door sits in a 1 m wall gap.
  doors: [
    { id: "d1", from: "s0", to: "s1", x: 0, z: -30.5, width: 3.2, axis: "x" },
    { id: "d2", from: "s1", to: "s2", x: 0, z: -5.5, width: 3.2, axis: "x" },
    { id: "d3", from: "s2", to: "s3", x: -14.5, z: 9.6, width: 3.2, axis: "z" },
    { id: "d4", from: "s3", to: "s4", x: -44, z: 13, width: 3.2, axis: "x" },
    { id: "d5", from: "s4", to: "s5", x: -27.5, z: 36, width: 3.2, axis: "z" },
    { id: "d6", from: "s5", to: "s6", x: -2.5, z: 36, width: 3.2, axis: "z" },
    { id: "d7", from: "s6", to: "s7", x: 10, z: 42.5, width: 3.6, axis: "x" },
  ],
};

// Collision convention (FLOOR2.md): a collider blocks an actor whose feet are at y when
// baseY - STEP_DOWN <= y < baseY + height - STEP_UP.
export const STEP_UP = 0.35;
export const STEP_DOWN = 0.5;
export const blocksAt = (c, y) => y >= c.baseY - STEP_DOWN && y < c.baseY + c.height - STEP_UP;

export function createFloor2(opts = {}) {
  const L = opts.layout || LAYOUT;
  const q = new URLSearchParams(location.search);
  const resources = opts.resources || new Set();
  const own = (x) => (resources.add(x), x);
  const group = new THREE.Group();
  group.name = "floor 2: building";

  // ------------------------------------------------------------------ regions
  // Every walkable piece with its height function. Later entries win on overlap.
  const sections = L.sections.map((s, index) => ({ ...s, index, rects: s.rects.map(([a, b, c, d]) => ({ minX: a, maxX: b, minZ: c, maxZ: d })) }));
  const secById = new Map(sections.map((s) => [s.id, s]));
  const regions = [];
  const R = ([a, b, c, d]) => ({ minX: a, maxX: b, minZ: c, maxZ: d });
  for (const s of sections) for (const r of s.rects) regions.push({ ...r, sec: s.index, h: () => s.y });
  const passage = (x, z, width, axis) => {
    const half = width / 2,
      depth = WALL / 2;
    return axis === "x"
      ? { minX: x - half, maxX: x + half, minZ: z - depth, maxZ: z + depth }
      : { minX: x - depth, maxX: x + depth, minZ: z - half, maxZ: z + half };
  };
  const doorSpecs = L.doors.map((d) => {
    const from = secById.get(d.from),
      to = secById.get(d.to);
    const y = Math.max(from.y, to.y);
    const rect = passage(d.x, d.z, d.width, d.axis);
    regions.push({ ...rect, sec: from.index, door: d.id, h: () => y });
    return { ...d, y, rect, fromSec: from, toSec: to };
  });
  // side closets: a small room behind a side door, part of its section
  for (const s of sections)
    for (const c of s.closets || []) {
      const y = c.y ?? s.y;
      const r = R(c.rect);
      regions.push({ ...r, sec: s.index, closet: c.id, y, h: () => y });
      s.rects.push(r);
      const rect = passage(c.x, c.z, c.width, c.axis);
      regions.push({ ...rect, sec: s.index, door: c.id, h: () => y });
      doorSpecs.push({ id: c.id, from: s.id, to: null, side: true, x: c.x, z: c.z, width: c.width, axis: c.axis, y, rect, closet: r, fromSec: s, toSec: null });
    }
  for (const s of sections) {
    for (const t of s.terraces || []) {
      const r = R(t.rect);
      regions.push({ ...r, sec: s.index, terrace: true, h: () => t.y });
      s.rects.push(r); // part of the section's walkable area too (already inside its main rect)
    }
    for (const rp of s.ramps || []) {
      const r = R(rp.rect);
      const k = (v) => THREE.MathUtils.clamp((v - rp.from) / (rp.to - rp.from), 0, 1);
      regions.push({
        ...r,
        sec: s.index,
        ramp: rp,
        h: (x, z) => THREE.MathUtils.lerp(rp.y0, rp.y1, k(rp.axis === "z" ? z : x)),
      });
    }
  }

  // ------------------------------------------------------------------ grid (0.5 m)
  const CELL = 0.5;
  let bx0 = Infinity,
    bx1 = -Infinity,
    bz0 = Infinity,
    bz1 = -Infinity;
  for (const r of regions) {
    bx0 = Math.min(bx0, r.minX);
    bx1 = Math.max(bx1, r.maxX);
    bz0 = Math.min(bz0, r.minZ);
    bz1 = Math.max(bz1, r.maxZ);
  }
  const bounds = { minX: bx0, maxX: bx1, minZ: bz0, maxZ: bz1 };
  const gx0 = bx0 - 2,
    gz0 = bz0 - 2;
  const NX = Math.ceil((bx1 - bx0 + 4) / CELL),
    NZ = Math.ceil((bz1 - bz0 + 4) / CELL);
  const walk = new Int16Array(NX * NZ).fill(-1); // region index
  regions.forEach((r, ri) => {
    const i0 = Math.max(0, Math.round((r.minX - gx0) / CELL)),
      i1 = Math.min(NX, Math.round((r.maxX - gx0) / CELL)),
      j0 = Math.max(0, Math.round((r.minZ - gz0) / CELL)),
      j1 = Math.min(NZ, Math.round((r.maxZ - gz0) / CELL));
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) walk[j * NX + i] = ri;
  });
  // nearest walkable region for every other cell (ground() outside the walkable area)
  const near = Int16Array.from(walk);
  {
    let frontier = [];
    for (let k = 0; k < near.length; k++) if (near[k] >= 0) frontier.push(k);
    while (frontier.length) {
      const next = [];
      for (const k of frontier) {
        const i = k % NX,
          j = (k / NX) | 0;
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const a = i + di,
            b = j + dj;
          if (a < 0 || b < 0 || a >= NX || b >= NZ) continue;
          const n = b * NX + a;
          if (near[n] < 0) {
            near[n] = near[k];
            next.push(n);
          }
        }
      }
      frontier = next;
    }
  }
  const cellOf = (x, z) => {
    const i = THREE.MathUtils.clamp(Math.floor((x - gx0) / CELL), 0, NX - 1),
      j = THREE.MathUtils.clamp(Math.floor((z - gz0) / CELL), 0, NZ - 1);
    return j * NX + i;
  };
  const regionAt = (x, z) => walk[cellOf(x, z)];
  function ground(x, z) {
    const r = regions[near[cellOf(x, z)]];
    return r.h(THREE.MathUtils.clamp(x, r.minX, r.maxX), THREE.MathUtils.clamp(z, r.minZ, r.maxZ));
  }
  function sectionAt(x, z) {
    const r = walk[cellOf(x, z)];
    return r >= 0 ? sections[regions[r].sec].id : null;
  }

  // ------------------------------------------------------------------ colliders
  const colliders = [];
  const box = (minX, maxX, minZ, maxZ, baseY, height, extra = {}) => ({ minX, maxX, minZ, maxZ, baseY, height, ...extra });
  const wallBoxes = []; // [sectionIndex, box] (visual: one wall box per section run)
  // walls: non-walkable cells within 1 m of walkable ones, merged into boxes
  const wallKey = new Array(NX * NZ).fill(null);
  const wallInfo = new Map();
  for (let j = 0; j < NZ; j++)
    for (let i = 0; i < NX; i++) {
      const k = j * NX + i;
      if (walk[k] >= 0) continue;
      let base = Infinity,
        top = -Infinity,
        sec = -1,
        secD = 9;
      for (let dj = -2; dj <= 2; dj++)
        for (let di = -2; di <= 2; di++) {
          const a = i + di,
            b = j + dj;
          if (a < 0 || b < 0 || a >= NX || b >= NZ) continue;
          const ri = walk[b * NX + a];
          if (ri < 0) continue;
          const r = regions[ri];
          const s = sections[r.sec];
          const y = r.h(gx0 + (a + 0.5) * CELL, gz0 + (b + 0.5) * CELL);
          base = Math.min(base, Math.floor((y + 0.01) / UP) * UP);
          top = Math.max(top, s.ceiling + 0.35);
          const d = Math.max(Math.abs(di), Math.abs(dj));
          if (d < secD || (d === secD && r.sec < sec)) (secD = d), (sec = r.sec);
        }
      if (sec < 0) continue;
      const key = `${sec}|${base}|${top}`;
      wallKey[k] = key;
      wallInfo.set(key, { sec, base, top });
    }
  function merge(keyAt) {
    const used = new Uint8Array(NX * NZ),
      out = [];
    for (let j = 0; j < NZ; j++)
      for (let i = 0; i < NX; i++) {
        const k0 = j * NX + i;
        if (used[k0]) continue;
        const key = keyAt(k0);
        if (key == null) continue;
        let w = 1;
        while (i + w < NX && !used[k0 + w] && keyAt(k0 + w) === key) w++;
        let h = 1;
        grow: while (j + h < NZ) {
          for (let t = 0; t < w; t++) {
            const kk = (j + h) * NX + i + t;
            if (used[kk] || keyAt(kk) !== key) break grow;
          }
          h++;
        }
        for (let a = 0; a < h; a++) for (let t = 0; t < w; t++) used[(j + a) * NX + i + t] = 1;
        out.push({ key, minX: gx0 + i * CELL, maxX: gx0 + (i + w) * CELL, minZ: gz0 + j * CELL, maxZ: gz0 + (j + h) * CELL });
      }
    return out;
  }
  for (const b of merge((k) => wallKey[k])) {
    const { sec, base, top } = wallInfo.get(b.key);
    wallBoxes.push([sec, box(b.minX, b.maxX, b.minZ, b.maxZ, base, top - base)]);
  }
  // colliders merged across sections (fewer boxes to test)
  const baseKey = (k) => (wallKey[k] ? wallInfo.get(wallKey[k]).base : null);
  for (const b of merge(baseKey)) {
    let top = 0;
    for (let z = b.minZ + CELL / 2; z < b.maxZ; z += CELL)
      for (let x = b.minX + CELL / 2; x < b.maxX; x += CELL) top = Math.max(top, wallInfo.get(wallKey[cellOf(x, z)]).top);
    colliders.push(box(b.minX, b.maxX, b.minZ, b.maxZ, b.key, top - b.key, { kind: "wall" }));
  }
  // cover, furniture, terrace masses, railings
  const placements = []; // { sec, kind, P, x, z, y, rot, c }
  const masses = [],
    railBoxes = [];
  for (const s of sections) {
    for (const [x, z, kind, rot = 0, hOver] of s.cover || []) {
      const P = PIECES[kind];
      const gy = ground(x, z);
      const [sx, sz] = rot % 180 ? [P.size[1], P.size[0]] : P.size;
      const h = hOver ?? (P.h === "ceiling" ? s.ceiling - gy : P.h);
      const c = box(x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2, gy, h, { kind: P.low ? "cover" : "block", section: s.id, piece: kind });
      if (P.low) c.low = true;
      colliders.push(c);
      placements.push({ sec: s.index, kind, P, x, z, y: gy, rot, c });
    }
    for (const t of s.terraces || []) {
      const [a, b2, c, d] = t.rect;
      const m = box(a, b2, c, d, s.y, t.y - s.y, { kind: "ledge", section: s.id });
      colliders.push(m);
      masses.push([s.index, m]);
    }
    for (const [a, b2, c, d] of s.rails || []) {
      const r = box(a, b2, c, d, UP, 1.1, { low: true, kind: "rail", section: s.id });
      colliders.push(r);
      railBoxes.push([s.index, r]);
    }
    if (s.balustrade) {
      const B = s.balustrade;
      const rp = s.ramps[0];
      for (let i = 0; i < B.steps; i++) {
        const z0 = B.z0 + ((B.z1 - B.z0) * i) / B.steps,
          z1 = B.z0 + ((B.z1 - B.z0) * (i + 1)) / B.steps;
        const yTop = THREE.MathUtils.lerp(rp.y0, rp.y1, (z1 - rp.from) / (rp.to - rp.from)) + 1.1;
        const c = box(B.x[0], B.x[1], z0, z1, s.y, yTop - s.y, { kind: "rail", section: s.id, balustrade: true });
        colliders.push(c);
        railBoxes.push([s.index, c]);
      }
    }
  }

  // spatial buckets for point / segment queries (nav build, anchors)
  const BK = 4;
  const buckets = new Map();
  const bkey = (i, j) => i * 10007 + j;
  for (const c of colliders) {
    for (let i = Math.floor(c.minX / BK); i <= Math.floor(c.maxX / BK); i++)
      for (let j = Math.floor(c.minZ / BK); j <= Math.floor(c.maxZ / BK); j++) {
        const k = bkey(i, j);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(c);
      }
  }
  function pointFree(x, z, y, r) {
    if (walk[cellOf(x, z)] < 0) return false;
    for (let i = Math.floor((x - r) / BK); i <= Math.floor((x + r) / BK); i++)
      for (let j = Math.floor((z - r) / BK); j <= Math.floor((z + r) / BK); j++)
        for (const c of buckets.get(bkey(i, j)) || [])
          if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r && blocksAt(c, y)) return false;
    return true;
  }
  function segClear(ax, az, bx, bz, r = 0.4) {
    const len = Math.hypot(bx - ax, bz - az),
      n = Math.max(1, Math.ceil(len / 0.25));
    let prev = ground(ax, az);
    for (let i = 0; i <= n; i++) {
      const x = ax + ((bx - ax) * i) / n,
        z = az + ((bz - az) * i) / n,
        y = ground(x, z);
      if (Math.abs(y - prev) > 0.3 || !pointFree(x, z, y, r)) return false;
      prev = y;
    }
    return true;
  }

  // ------------------------------------------------------------------ doors (logic + their own meshes)
  const doors = [];
  const DOOR_H = 3.3;
  const COLOR = { locked: new THREE.Color(0xff8a1e), open: new THREE.Color(0x56ffb0), alert: new THREE.Color(0xff3b1e) };
  let version = 0;
  const listeners = [];
  for (const d of doorSpecs) {
    const top = Math.max(d.fromSec.ceiling, d.toSec ? d.toSec.ceiling : 0) + 0.35;
    const g = new THREE.Group();
    g.name = `door ${d.id}`;
    g.position.set(d.x, d.y, d.z);
    if (d.axis === "z") g.rotation.y = Math.PI / 2;
    group.add(g);
    const w = d.width;
    const fr = d.fromSec.rects[0];
    const fromSide = Math.sign(d.axis === "x" ? fr.minZ + fr.maxZ - 2 * d.z : fr.minX + fr.maxX - 2 * d.x);
    // status light bars on both faces: one mesh, its own material
    const lightMat = own(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: COLOR.locked, emissiveIntensity: 2.2, roughness: 0.4 }));
    {
      const bars = [-1, 1].map((s) => new THREE.BoxGeometry(w + 0.3, 0.1, 0.05).translate(0, DOOR_H + 0.27, s * (WALL / 2 + 0.06)));
      const m = new THREE.Mesh(own(mergeGeometries(bars)), lightMat);
      bars.forEach((b) => b.dispose());
      g.add(m);
    }
    // a sign over the door, on the side you come from, names the next section
    if (!d.side) {
      const label = textPlate(`${String(d.toSec.index).padStart(2, "0")}  ${d.toSec.name}`, { width: Math.min(w + 1.4, 5.2), px: 72, color: "#e8d9b8", letter: 0.1 });
      own(label.geometry);
      own(label.material);
      own(label.material.map);
      label.position.set(0, DOOR_H + 0.95, fromSide * (WALL / 2 + 0.03));
      if (fromSide < 0) label.rotation.y = Math.PI;
      g.add(label);
    }
    // leaves: the greybox builds two boxes; the kit swaps in one merged mesh per material
    const leaves = new THREE.Group();
    g.add(leaves);
    const collider = box(d.rect.minX, d.rect.maxX, d.rect.minZ, d.rect.maxZ, d.y, top - d.y, { door: d.id, kind: "door" });
    colliders.push(collider);
    // route doors: a checkpoint 2.4 m into the next section, facing in (retry knob)
    let checkpoint = null;
    if (!d.side) {
      const dx = d.axis === "z" ? -fromSide : 0,
        dz = d.axis === "x" ? -fromSide : 0;
      checkpoint = { x: d.x + dx * 2.4, z: d.z + dz * 2.4, y: d.y, yaw: Math.atan2(-dx, -dz) };
    }
    const door = {
      id: d.id,
      from: d.from,
      to: d.to,
      side: !!d.side,
      checkpoint,
      x: d.x,
      z: d.z,
      y: d.y,
      width: w,
      axis: d.axis,
      rect: d.rect,
      collider,
      group: g,
      top,
      progress: 0,
      target: 0,
      alert: false,
      isOpen: false,
      get state() {
        return this.target === 1 ? (this.progress >= 1 ? "open" : "opening") : this.progress <= 0 ? "closed" : "closing";
      },
      open() {
        if (this.target === 1) return;
        this.target = 1;
        this.alert = false;
        emit(this, "opening");
      },
      close() {
        if (this.target === 0) return;
        this.target = 0;
        if (!colliders.includes(collider)) {
          colliders.push(collider);
          this.isOpen = false;
          version++;
        }
        emit(this, "closing");
      },
      setAlert(on) {
        this.alert = !!on;
      },
      _leaves: leaves,
      _slide: null, // set by the visuals: (eased progress) => void
      _light: lightMat,
    };
    doors.push(door);
  }
  const doorById = new Map(doors.map((d) => [d.id, d]));
  function emit(door, event) {
    for (const f of listeners) f(door, event);
    level.onDoor?.(door, event);
  }

  // ------------------------------------------------------------------ sections out (contract)
  const out = sections.map((s) => {
    const entry = doorSpecs.find((d) => d.to === s.id)?.id ?? null;
    const exit = doorSpecs.find((d) => d.from === s.id && !d.side)?.id ?? null;
    const A = s.anchors || {};
    const y3 = ([x, z]) => [x, z, +ground(x, z).toFixed(3)];
    // cover anchors: behind every low piece, on the side away from the way in
    const from = entry ? doorById.get(entry) : { x: L.start.x, z: L.start.z };
    const cover = [];
    for (const c of colliders) {
      if (!c.low || c.section !== s.id || c.balustrade) continue;
      const cx = (c.minX + c.maxX) / 2,
        cz = (c.minZ + c.maxZ) / 2;
      const dx = cx - from.x,
        dz = cz - from.z;
      const alongX = c.maxX - c.minX >= c.maxZ - c.minZ;
      const pts = [];
      if (alongX) {
        const z = dz > 0 ? c.maxZ + 0.7 : c.minZ - 0.7;
        const n = Math.max(1, Math.floor((c.maxX - c.minX) / 1.6));
        for (let i = 0; i < n; i++) pts.push([c.minX + ((i + 0.5) * (c.maxX - c.minX)) / n, z]);
      } else {
        const x = dx > 0 ? c.maxX + 0.7 : c.minX - 0.7;
        const n = Math.max(1, Math.floor((c.maxZ - c.minZ) / 1.6));
        for (let i = 0; i < n; i++) pts.push([x, c.minZ + ((i + 0.5) * (c.maxZ - c.minZ)) / n]);
      }
      for (const [x, z] of pts) {
        const y = ground(x, z);
        if (sectionAt(x, z) === s.id && pointFree(x, z, y, 0.4)) cover.push([+x.toFixed(2), +z.toFixed(2), +y.toFixed(3)]);
      }
    }
    // side: spawn spots inside each closet, [x, z, y, doorId]
    const side = [];
    for (const d of doorSpecs) {
      if (!d.side || d.from !== s.id) continue;
      const c = d.closet,
        cx = (c.minX + c.maxX) / 2,
        cz = (c.minZ + c.maxZ) / 2;
      for (const [ox, oz] of [
        [0, 0],
        [-0.8, 0.8],
        [0.8, -0.8],
      ])
        side.push([cx + ox, cz + oz, d.y, d.id]);
    }
    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      index: s.index,
      y: s.y,
      rects: s.rects.map((r) => ({ ...r })),
      ceiling: s.ceiling,
      entry,
      exit,
      anchors: {
        cover,
        high: (A.high || []).map(y3),
        flank: (A.flank || []).map(y3),
        back: (A.back || []).map(y3),
        drop: (A.drop || []).map(y3),
        side,
      },
      hold: s.hold ? { x: s.hold.x, z: s.hold.z, y: ground(s.hold.x, s.hold.z), r: s.hold.r } : null,
    };
  });
  const outById = new Map(out.map((s) => [s.id, s]));

  // ------------------------------------------------------------------ nav graph
  // Two interleaved 2 m lattices over the walkable area (odd,odd and even,even: every
  // 2 m gap gets a node), kept where an actor fits, linked to the 4 diagonal neighbours of
  // the other lattice and the 4 straight ones of its own where the line is clear and never
  // crosses a ledge; plus one node in every door passage. Closed doors are not colliders here.
  const navColliders = colliders.filter((c) => c.door);
  for (const c of navColliders) colliders.splice(colliders.indexOf(c), 1);
  const nodes = [],
    nodeSec = [],
    edges = [];
  const lattice = new Map();
  for (let z = Math.floor(bz0); z < bz1; z += 1)
    for (let x = Math.floor(bx0) + ((Math.floor(bx0) + z) & 1 ? 1 : 0); x < bx1; x += 2) {
      const ri = regionAt(x, z);
      if (ri < 0 || regions[ri].door) continue;
      const y = ground(x, z);
      if (!pointFree(x, z, y, 0.55)) continue;
      lattice.set(`${x},${z}`, nodes.length);
      nodes.push([x, z, +y.toFixed(3)]);
      nodeSec.push(sections[regions[ri].sec].id);
    }
  const seen = new Set();
  const link = (a, b, door) => {
    const k = a < b ? `${a},${b}` : `${b},${a}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push(door ? [a, b, door] : [a, b]);
  };
  for (const [key, a] of lattice) {
    const [x, z] = key.split(",").map(Number);
    for (const [dx, dz] of [
      [2, 0],
      [0, 2],
      [1, 1],
      [-1, 1],
    ]) {
      const b = lattice.get(`${x + dx},${z + dz}`);
      if (b === undefined) continue;
      if (segClear(x, z, x + dx, z + dz)) link(a, b);
    }
  }
  const doorNodes = {};
  for (const d of doors) {
    const i = nodes.length;
    nodes.push([d.x, d.z, d.y]);
    nodeSec.push(d.from);
    doorNodes[d.id] = i;
    for (const [j, n] of nodes.entries()) {
      if (j === i || Math.hypot(n[0] - d.x, n[1] - d.z) > 3.4) continue;
      if (segClear(d.x, d.z, n[0], n[1], 0.35)) link(i, j, d.id);
    }
  }
  colliders.push(...navColliders); // doors start closed
  const nav = { nodes, edges, section: nodeSec, doorNodes };
  nav.nearest = (x, z, y = null) => {
    let best = -1,
      bd = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      if (y !== null && Math.abs(n[2] - y) > 1.5) continue;
      const d = (n[0] - x) ** 2 + (n[1] - z) ** 2;
      if (d < bd) (bd = d), (best = i);
    }
    return best;
  };

  // ------------------------------------------------------------------ boundary runs (decor)
  // Wall faces next to walkable cells, merged into runs: { sec, axis, at, from, to, n (into the room), y }.
  // Also ledge runs: terrace cells next to a lower walkable cell.
  const runs = [],
    ledges = [];
  {
    const dirs = [
      [0, 1, "z", 1],
      [0, -1, "z", -1],
      [1, 0, "x", 1],
      [-1, 0, "x", -1],
    ];
    for (const [di, dj, axis, sgn] of dirs) {
      const open = new Map(); // key -> run being extended
      const lines = axis === "z" ? NZ : NX,
        along = axis === "z" ? NX : NZ;
      for (let l = 0; l < lines; l++) {
        let cur = null,
          curL = null;
        for (let t = 0; t <= along; t++) {
          let hit = null,
            ledge = null;
          if (t < along) {
            const i = axis === "z" ? t : l,
              j = axis === "z" ? l : t;
            const k = j * NX + i;
            const ri = walk[k];
            const a = i + di,
              b = j + dj;
            if (ri >= 0 && a >= 0 && b >= 0 && a < NX && b < NZ) {
              const r = regions[ri];
              const nk = b * NX + a;
              const y = r.h(gx0 + (i + 0.5) * CELL, gz0 + (j + 0.5) * CELL);
              if (walk[nk] < 0 && !r.door && !r.ramp) hit = `${r.sec}|${y}`;
              else if (walk[nk] >= 0 && r.terrace) {
                const ny = regions[walk[nk]].h(gx0 + (a + 0.5) * CELL, gz0 + (b + 0.5) * CELL);
                if (y - ny > 1) ledge = `${r.sec}|${y}`;
              }
            }
          }
          const coord = axis === "z" ? gz0 + (l + (sgn > 0 ? 1 : 0)) * CELL : gx0 + (l + (sgn > 0 ? 1 : 0)) * CELL;
          const pos = (axis === "z" ? gx0 : gz0) + t * CELL;
          if (cur && cur.key !== hit) {
            cur.to = pos;
            runs.push(cur);
            cur = null;
          }
          if (hit && !cur) {
            const [sec, y] = hit.split("|").map(Number);
            cur = { key: hit, sec, axis, at: coord, from: pos, to: pos, n: -sgn, y };
          }
          if (curL && curL.key !== ledge) {
            curL.to = pos;
            ledges.push(curL);
            curL = null;
          }
          if (ledge && !curL) {
            const [sec, y] = ledge.split("|").map(Number);
            curL = { key: ledge, sec, axis, at: coord, from: pos, to: pos, n: sgn, y };
          }
        }
        void open;
      }
    }
  }

  // ------------------------------------------------------------------ visuals
  const secGroups = sections.map((s) => {
    const g = new THREE.Group();
    g.name = `floor 2: ${s.id} ${s.name}`;
    group.add(g);
    return g;
  });
  // box with world-space uvs in metres (projected on the face's dominant axis)
  const tmpV = new THREE.Vector3();
  function worldUV(geo, scale = 1) {
    const p = geo.attributes.position,
      n = geo.attributes.normal,
      uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      tmpV.set(Math.abs(n.getX(i)), Math.abs(n.getY(i)), Math.abs(n.getZ(i)));
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      if (tmpV.y >= tmpV.x && tmpV.y >= tmpV.z) uv.setXY(i, x * scale, z * scale);
      else if (tmpV.x >= tmpV.z) uv.setXY(i, z * scale, y * scale);
      else uv.setXY(i, x * scale, y * scale);
    }
    return geo;
  }
  const cuboid = (minX, maxX, minY, maxY, minZ, maxZ) =>
    new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ).translate((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  const cbox = (c) => cuboid(c.minX, c.maxX, c.baseY, c.baseY + c.height, c.minZ, c.maxZ);

  function gridTexture(base, line, accent, tile = 256) {
    const c = document.createElement("canvas");
    c.width = c.height = tile;
    const g = c.getContext("2d");
    g.fillStyle = base;
    g.fillRect(0, 0, tile, tile);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`;
      g.fillRect(rnd() * tile, rnd() * tile, 2 + rnd() * 18, 2 + rnd() * 18);
    }
    g.strokeStyle = line;
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, tile - 3, tile - 3);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(tile / 2, 0);
    g.lineTo(tile / 2, tile);
    g.moveTo(0, tile / 2);
    g.lineTo(tile, tile / 2);
    g.stroke();
    if (accent) {
      g.fillStyle = accent;
      g.fillRect(tile * 0.06, tile * 0.06, tile * 0.06, tile * 0.015);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return own(t);
  }
  // greybox materials (uvs: one 256 px tile per 2 m)
  const G = {
    wall: own(new THREE.MeshStandardMaterial({ name: "f2g_wall", map: gridTexture("#3a4652", "#26303a"), roughness: 0.8, metalness: 0.25 })),
    floor: own(new THREE.MeshStandardMaterial({ name: "f2g_floor", map: gridTexture("#2c3640", "#1a2129", "#c8920f"), roughness: 0.75, metalness: 0.3 })),
    ceiling: own(new THREE.MeshStandardMaterial({ name: "f2g_ceiling", color: 0x161d25, roughness: 0.9, metalness: 0.2 })),
    low: own(new THREE.MeshStandardMaterial({ name: "f2g_low", color: 0x55687a, roughness: 0.6, metalness: 0.45 })),
    tall: own(new THREE.MeshStandardMaterial({ name: "f2g_tall", color: 0x2a3540, roughness: 0.55, metalness: 0.55 })),
    rail: own(new THREE.MeshStandardMaterial({ name: "f2g_rail", color: 0x7d8a96, roughness: 0.4, metalness: 0.8 })),
    trim: own(new THREE.MeshStandardMaterial({ name: "f2g_trim", color: 0x000000, emissive: 0xffc153, emissiveIntensity: 1.1, roughness: 0.4 })),
    panel: own(new THREE.MeshStandardMaterial({ name: "f2g_panel", color: 0x000000, emissive: 0xdfe9f0, emissiveIntensity: 0.9, roughness: 0.4 })),
    frame: own(new THREE.MeshStandardMaterial({ name: "f2g_frame", color: 0x1c242c, roughness: 0.5, metalness: 0.7 })),
    door: own(new THREE.MeshStandardMaterial({ name: "f2g_door", map: gridTexture("#59636c", "#2b333b", "#ffc153"), roughness: 0.5, metalness: 0.6 })),
  };

  // ---- the kit
  const kit = { pieces: new Map(), mats: new Map(), loaded: false };
  const SCALE = { wall: 0.25, mass: 0.25, floor: 0.25, raised: 1 / 2.4, ceiling: 1 / 2.4, gun: 0.5, steel: 0.5, yellow: 0.5, hazard: 1, dark: 1 };
  const EMISSIVE = { b_glow_y: 1.6, b_glow_w: 1.5, b_screen: 0.9, b_screen_o: 1.0, b_rack: 1.4 };
  const leafSide = { value: 0 };
  function kitMaterial(m) {
    if (kit.mats.has(m.name)) {
      if (kit.mats.get(m.name) !== m) m.dispose();
      return kit.mats.get(m.name);
    }
    if (m.name in EMISSIVE) m.emissiveIntensity = EMISSIVE[m.name];
    if (m.name === "b_glass") {
      m.transparent = true;
      m.opacity = 0.35;
      m.depthWrite = false;
    }
    for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"])
      if (m[k]) {
        m[k].anisotropy = 8;
        m[k].wrapS = m[k].wrapT = THREE.RepeatWrapping;
        own(m[k]);
      }
    kit.mats.set(m.name, own(m));
    return m;
  }
  async function loadKit() {
    const gltf = await new GLTFLoader().loadAsync(KIT_URL);
    const scn = gltf.scene;
    scn.updateWorldMatrix(true, true);
    for (const p of scn.children[0]?.children ?? []) {
      const inv = new THREE.Matrix4().copy(p.matrixWorld).invert();
      const parts = [];
      p.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        parts.push({ geometry: own(g.index ? g.toNonIndexed() : g), material: kitMaterial(o.material) });
        o.geometry.dispose();
      });
      kit.pieces.set(p.name, parts);
    }
    kit.loaded = true;
  }
  // per-section tinted wall paint and wall light strips
  const secMats = new Map();
  function secMat(kind, s) {
    const key = `${kind}:${s.index}`;
    if (secMats.has(key)) return secMats.get(key);
    let m;
    if (kind === "wall") {
      m = kit.mats.get("b_wall").clone();
      m.color.setHex(s.look?.tint ?? 0xffffff);
    } else if (kind === "strip") {
      m = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: s.look?.strip ?? 0xffffff, emissiveIntensity: 1.3, roughness: 0.4 });
    }
    m.name = key;
    secMats.set(key, own(m));
    return m;
  }

  // ---- vista: the outside, painted on the window glass (one shader per outward direction)
  // Ray-casts a night city, the plaza far below and the sky from the real camera, so the
  // parallax and the drop are right. The pane sits on the inner wall face.
  const uTime = { value: 0 };
  const vistas = new Map();
  function vistaMaterial(ox, oz) {
    const key = `${ox},${oz}`;
    if (vistas.has(key)) return vistas.get(key);
    const m = own(
      new THREE.ShaderMaterial({
        fog: false,
        uniforms: {
          uTime,
          outDir: { value: new THREE.Vector2(ox, oz) },
          groundY: { value: -1 },
          top: { value: new THREE.Color(0x0a111c) },
          mid: { value: new THREE.Color(0x14233a) },
          hor: { value: new THREE.Color(0x35597a) },
          warm: { value: new THREE.Color(0x7a4b2a) },
        },
        vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform float uTime; uniform float groundY; uniform vec2 outDir; uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 warm;
          varying vec3 vWorld;
          float hash(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
          float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          vec3 sky(vec3 d){
            float h = clamp(d.y, -0.2, 1.0);
            vec3 c = mix(hor, mid, smoothstep(0.0, 0.25, h));
            c = mix(c, top, smoothstep(0.2, 0.9, h));
            c += warm * exp(-abs(h) * 14.0) * 0.35;
            return c;
          }
          vec4 towers(vec3 o, vec3 d, float X, float cellW, float hMax, float seed){
            float t = (X - o.x) / max(d.x, 1e-3);
            vec3 p = o + d * t;
            float cell = floor(p.z / cellW);
            float r = hash(cell + seed);
            float h = groundY + 30.0 + pow(clamp(r, 0.0, 1.0), 1.6) * hMax;
            float fz = fract(p.z / cellW);
            float gap = step(0.12, fz) * step(fz, 0.88);
            if (p.y > h || gap < 0.5 || r < 0.12) return vec4(0.0);
            vec2 win = vec2(floor(fz * cellW / 2.2), floor((p.y - groundY) / 3.6));
            float lit = step(0.72, hash2(win + cell * 7.0 + seed));
            vec2 wf = vec2(fract(fz * cellW / 2.2), fract((p.y - groundY) / 3.6));
            float pane = step(0.25, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y) * step(wf.y, 0.7);
            vec3 wc = mix(vec3(1.0, 0.62, 0.25), vec3(0.55, 0.8, 1.0), step(0.6, hash2(win.yx + cell)));
            vec3 c = vec3(0.025, 0.035, 0.05) + wc * lit * pane * 0.9;
            float crown = smoothstep(1.2, 0.0, h - p.y) * step(0.7, r);
            c += vec3(1.0, 0.7, 0.3) * crown * 0.6;
            float fog = 1.0 - exp(-t * 0.0028);
            return vec4(mix(c, hor * 0.9, fog), 1.0);
          }
          void main(){
            vec3 dw = normalize(vWorld - cameraPosition);
            vec2 side = vec2(-outDir.y, outDir.x);
            vec3 o = vec3(dot(cameraPosition.xz, outDir), cameraPosition.y, dot(cameraPosition.xz, side));
            vec3 d = vec3(dot(dw.xz, outDir), dw.y, dot(dw.xz, side));
            vec3 c = sky(d);
            for (int i = 0; i < 5; i++) {
              float fi = float(i);
              float t = (260.0 + fi * 90.0 - o.x) / max(d.x, 1e-3);
              vec3 p = o + d * t;
              vec2 q = vec2(mod(p.z + uTime * (6.0 + fi * 2.0) + fi * 157.0, 400.0) - 200.0, p.y - (groundY + 120.0 + fi * 35.0));
              float l = exp(-dot(q, q) * 0.35) * (0.6 + 0.4 * step(0.5, fract(uTime * 0.9 + fi * 0.37)));
              c += vec3(1.0, 0.85, 0.5) * l;
            }
            vec4 far = towers(o, d, o.x + 700.0, 64.0, 420.0, 3.0);
            c = mix(c, far.rgb, far.a);
            vec4 nearT = towers(o, d, o.x + 240.0, 46.0, 260.0, 11.0);
            c = mix(c, nearT.rgb, nearT.a);
            if (d.y < 0.0) {
              float t = (groundY - o.y) / d.y;
              vec3 p = o + d * t;
              if (nearT.a < 0.5 && t < 2400.0) {
                vec2 g = p.xz / 9.0;
                vec2 f = abs(fract(g) - 0.5);
                float grid = smoothstep(0.47, 0.5, max(f.x, f.y));
                vec2 lp = p.xz / vec2(18.0, 6.0);
                float lights = step(0.86, hash2(floor(lp))) * smoothstep(0.25, 0.0, length(fract(lp) - 0.5));
                vec3 gc = vec3(0.03, 0.035, 0.04) + vec3(0.2, 0.17, 0.12) * grid * 0.25 + vec3(1.0, 0.6, 0.15) * lights * 1.2;
                c = mix(gc, hor * 0.8, 1.0 - exp(-t * 0.0035));
              }
            }
            gl_FragColor = vec4(clamp(c, 0.0, 1.6), 1.0);
          }`,
      }),
    );
    vistas.set(key, m);
    return m;
  }

  // ---- build (kit = null → greybox)
  function build(useKit) {
    for (const g of secGroups)
      for (const c of [...g.children]) {
        g.remove(c);
        c.geometry?.dispose();
      }
    const parts = sections.map(() => new Map()); // material -> geometries
    const put = (sec, mat, geo) => {
      const p = parts[sec];
      if (!p.has(mat)) p.set(mat, []);
      p.get(mat).push(geo.index ? geo.toNonIndexed() : geo);
      if (geo.index) geo.dispose();
    };
    const km = (n) => kit.mats.get(n);
    // generated surface: material + uv scale per role
    const surf = (s, role) => {
      if (!useKit) return [{ wall: G.wall, mass: G.wall, floor: G.floor, raised: G.floor, ceiling: G.ceiling, gun: G.tall, steel: G.rail, yellow: G.trim, hazard: G.trim, dark: G.frame, strip: G.trim, glow_w: G.panel, glow_y: G.trim }[role], 0.5];
      if (role === "wall") return [secMat("wall", s), SCALE.wall];
      if (role === "strip") return [secMat("strip", s), 1];
      if (role === "mass") return [km("b_gun"), SCALE.mass];
      return [km(`b_${role}`), SCALE[role] ?? 1];
    };
    const addBox = (s, role, geo) => {
      const [m, sc] = surf(s, role);
      put(s.index, m, worldUV(geo, sc));
    };
    const placePiece = (sec, name, matrix, scaleX = 1) => {
      for (const part of kit.pieces.get(name) || []) {
        const g = part.geometry.clone();
        if (scaleX !== 1) g.scale(scaleX, 1, 1);
        put(sec, part.material, g.applyMatrix4(matrix));
      }
    };
    const at = (x, y, z, rotDeg = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY((rotDeg * Math.PI) / 180));

    // walls (+ door lintels above the frames)
    for (const [sec, c] of wallBoxes) addBox(sections[sec], "wall", cbox(c));
    for (const d of doors) {
      const s = secById.get(d.from);
      const r = d.rect;
      const y0 = d.y + (useKit ? 3.92 : DOOR_H);
      const pad = useKit ? 0.6 : 0.3;
      const [minX, maxX, minZ, maxZ] = d.axis === "x" ? [r.minX - pad, r.maxX + pad, r.minZ, r.maxZ] : [r.minX, r.maxX, r.minZ - pad, r.maxZ + pad];
      addBox(s, "wall", cuboid(minX, maxX, y0, d.top, minZ, maxZ));
    }
    // floors + ceilings over every walkable rect; terrace masses
    for (const r of regions) {
      const s = sections[r.sec];
      if (r.ramp) continue;
      const y = r.h(r.minX, r.minZ);
      const fl = s.look?.floor === "raised" && !r.terrace ? "raised" : "floor";
      addBox(s, fl, cuboid(r.minX, r.maxX, y - 0.3, y, r.minZ, r.maxZ));
      if (!r.terrace && !r.door) addBox(s, "ceiling", cuboid(r.minX - 0.5, r.maxX + 0.5, s.ceiling, s.ceiling + 0.3, r.minZ - 0.5, r.maxZ + 0.5));
    }
    for (const [sec, m] of masses) addBox(sections[sec], "mass", cbox({ ...m, height: m.height - 0.3 }));
    // ceiling lights every 4 m along each main rect
    for (const s of sections)
      for (const r of s.rects) {
        if (regions.find((x) => x.minX === r.minX && x.maxX === r.maxX && x.minZ === r.minZ && x.maxZ === r.maxZ)?.terrace) continue;
        const alongX = r.maxX - r.minX >= r.maxZ - r.minZ;
        const len = alongX ? r.maxX - r.minX : r.maxZ - r.minZ;
        const wid = alongX ? r.maxZ - r.minZ : r.maxX - r.minX;
        const rows = Math.max(1, Math.round(wid / 6));
        for (let a = 2; a < len - 1; a += 4)
          for (let b = 0; b < rows; b++) {
            const off = ((b + 0.5) / rows) * wid;
            const x = alongX ? r.minX + a : r.minX + off;
            const z = alongX ? r.minZ + off : r.minZ + a;
            if (useKit) placePiece(s.index, "p_lamp", at(x, s.ceiling, z, alongX ? 0 : 90));
            else {
              const [sx, sz] = alongX ? [1.6, 0.35] : [0.35, 1.6];
              put(s.index, G.panel, cuboid(x - sx / 2, x + sx / 2, s.ceiling - 0.04, s.ceiling, z - sz / 2, z + sz / 2));
            }
          }
      }
    // cover and furniture
    for (const p of placements) {
      const s = sections[p.sec];
      if (p.P.hidden) continue;
      if (useKit && p.P.kit && kit.pieces.has(p.P.kit)) {
        placePiece(p.sec, p.P.kit, at(p.x, p.y, p.z, p.rot));
        continue;
      }
      const c = p.c;
      if (useKit && p.P.proc === "pillar") {
        addBox(s, "dark", cuboid(c.minX - 0.08, c.maxX + 0.08, c.baseY, c.baseY + 0.12, c.minZ - 0.08, c.maxZ + 0.08));
        addBox(s, "gun", cuboid(c.minX, c.maxX, c.baseY + 0.12, c.baseY + c.height, c.minZ, c.maxZ));
        addBox(s, "yellow", cuboid(c.minX - 0.03, c.maxX + 0.03, c.baseY + 0.9, c.baseY + 1.15, c.minZ - 0.03, c.maxZ + 0.03));
        for (const yy of [2.6, c.height - 0.9]) addBox(s, "steel", cuboid(c.minX - 0.05, c.maxX + 0.05, c.baseY + yy, c.baseY + yy + 0.2, c.minZ - 0.05, c.maxZ + 0.05));
        const gl = Math.min(c.height - 1.8, 6);
        for (const [ox, oz] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ]) {
          const cx = (c.minX + c.maxX) / 2 + ox * ((c.maxX - c.minX) / 2 + 0.01),
            cz = (c.minZ + c.maxZ) / 2 + oz * ((c.maxZ - c.minZ) / 2 + 0.01);
          addBox(s, "glow_y", cuboid(cx - (ox ? 0.01 : 0.03), cx + (ox ? 0.01 : 0.03), c.baseY + 1.4, c.baseY + 1.4 + gl, cz - (oz ? 0.01 : 0.03), cz + (oz ? 0.01 : 0.03)));
        }
        continue;
      }
      if (useKit && p.P.proc === "duct") {
        addBox(s, "steel", cuboid(c.minX, c.maxX, c.baseY, c.baseY + c.height, c.minZ, c.maxZ));
        for (let yy = 0.4; yy < c.height - 0.2; yy += 0.9) addBox(s, "gun", cuboid(c.minX - 0.04, c.maxX + 0.04, c.baseY + yy, c.baseY + yy + 0.12, c.minZ - 0.04, c.maxZ));
        addBox(s, "hazard", cuboid(c.minX - 0.01, c.maxX + 0.01, c.baseY, c.baseY + 0.3, c.minZ - 0.01, c.maxZ));
        continue;
      }
      put(p.sec, p.P.low ? G.low : G.tall, cbox(c));
      if (p.P.low) put(p.sec, G.trim, cuboid(c.minX + 0.08, c.maxX - 0.08, c.baseY + c.height, c.baseY + c.height + 0.03, c.minZ + 0.08, c.maxZ - 0.08));
    }
    // railings (kit: 2 m modules stretched to fit) and the stair balustrade
    for (const [sec, r] of railBoxes) {
      if (useKit) {
        if (r.balustrade) continue; // part of p_stairs
        const alongX = r.maxX - r.minX >= r.maxZ - r.minZ;
        const len = alongX ? r.maxX - r.minX : r.maxZ - r.minZ;
        const n = Math.max(1, Math.round(len / 2));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const x = alongX ? r.minX + t * len : (r.minX + r.maxX) / 2;
          const z = alongX ? (r.minZ + r.maxZ) / 2 : r.minZ + t * len;
          placePiece(sec, "p_rail", at(x, r.baseY, z, alongX ? 0 : 90), len / n / 2);
        }
      } else put(sec, G.rail, cbox(r));
    }
    // stairs
    for (const s of sections)
      for (const rp of s.ramps || []) {
        const [a, b, c, d] = rp.rect;
        if (useKit && kit.pieces.has("p_stairs")) {
          placePiece(s.index, "p_stairs", at((a + b) / 2, rp.y0, rp.from));
          continue;
        }
        const run = rp.to - rp.from,
          rise = rp.y1 - rp.y0;
        const len = Math.hypot(run, rise),
          ang = Math.atan2(rise, run);
        const g = new THREE.BoxGeometry(b - a, 0.4, len);
        g.applyMatrix4(new THREE.Matrix4().makeRotationX(-ang));
        g.translate((a + b) / 2, (rp.y0 + rp.y1) / 2 - 0.2 * Math.cos(ang), (c + d) / 2);
        put(s.index, G.wall, worldUV(g, 0.5));
      }
    // wall decor: kick plates, light strips, pilasters (kit look only)
    if (useKit) {
      const winCover = (s, run, p) =>
        (s.windows || []).some(([side, f, t]) => {
          const R0 = s.rects[0];
          const onSide = { n: run.axis === "z" && run.n < 0 && Math.abs(run.at - R0.maxZ) < 0.01, s: run.axis === "z" && run.n > 0 && Math.abs(run.at - R0.minZ) < 0.01, e: run.axis === "x" && run.n < 0 && Math.abs(run.at - R0.maxX) < 0.01, w: run.axis === "x" && run.n > 0 && Math.abs(run.at - R0.minX) < 0.01 }[side];
          return onSide && p > f - 0.4 && p < t + 0.4;
        });
      for (const run of runs) {
        const s = sections[run.sec];
        const len = run.to - run.from;
        if (len < 0.4) continue;
        const face = (o0, o1, y0, y1, a0 = run.from, a1 = run.to) =>
          run.axis === "z"
            ? cuboid(a0, a1, y0, y1, Math.min(run.at + run.n * o0, run.at + run.n * o1), Math.max(run.at + run.n * o0, run.at + run.n * o1))
            : cuboid(Math.min(run.at + run.n * o0, run.at + run.n * o1), Math.max(run.at + run.n * o0, run.at + run.n * o1), y0, y1, a0, a1);
        addBox(s, "dark", face(0, 0.05, run.y, run.y + 0.18));
        addBox(s, "strip", face(0, 0.035, s.ceiling - 0.42, s.ceiling - 0.36));
        if (len < 2.5) continue;
        for (let p = Math.ceil((run.from + 0.6) / 4) * 4; p < run.to - 0.6; p += 4) {
          if (winCover(s, run, p)) continue;
          addBox(s, "gun", face(0, 0.22, run.y, s.ceiling, p - 0.25, p + 0.25));
          addBox(s, "yellow", face(0.22, 0.24, run.y + 0.9, run.y + 1.05, p - 0.25, p + 0.25));
          if ((p / 4) % 2 === 0) addBox(s, "glow_y", face(0.22, 0.235, run.y + 1.4, Math.min(run.y + 3.6, s.ceiling - 0.8), p - 0.025, p + 0.025));
        }
      }
      // ledge fascia: steel cap, hazard band and an under-glow on the mezzanine edges
      for (const run of ledges) {
        const s = sections[run.sec];
        const face = (o0, o1, y0, y1) =>
          run.axis === "z"
            ? cuboid(run.from, run.to, y0, y1, Math.min(run.at + run.n * o0, run.at + run.n * o1), Math.max(run.at + run.n * o0, run.at + run.n * o1))
            : cuboid(Math.min(run.at + run.n * o0, run.at + run.n * o1), Math.max(run.at + run.n * o0, run.at + run.n * o1), y0, y1, run.from, run.to);
        addBox(s, "steel", face(-0.3, 0.04, run.y - 0.14, run.y + 0.01));
        addBox(s, "hazard", face(0, 0.03, run.y - 0.45, run.y - 0.17));
        addBox(s, "strip", face(0, 0.03, run.y - 0.6, run.y - 0.55));
      }
      // door frames (static, merged into the section the door leads out of)
      for (const d of doors) {
        const tag = String(Math.round(d.width * 10)).padStart(2, "0");
        placePiece(secById.get(d.from).index, `p_frame_${tag}`, at(d.x, d.y, d.z, d.axis === "z" ? 90 : 0));
      }
    } else {
      for (const d of doors) {
        const s = secById.get(d.from);
        const m = new THREE.Matrix4().makeTranslation(d.x, d.y, d.z).multiply(new THREE.Matrix4().makeRotationY(d.axis === "z" ? Math.PI / 2 : 0));
        for (const sx of [-1, 1]) put(s.index, G.frame, worldUV(cuboid(sx * (d.width / 2 + 0.12) - 0.17, sx * (d.width / 2 + 0.12) + 0.17, 0, DOOR_H + 0.2, -WALL / 2 - 0.08, WALL / 2 + 0.08).applyMatrix4(m), 0.5));
        put(s.index, G.frame, worldUV(cuboid(-d.width / 2 - 0.3, d.width / 2 + 0.3, DOOR_H - 0.1, DOOR_H + 0.2, -WALL / 2 - 0.08, WALL / 2 + 0.08).applyMatrix4(m), 0.5));
      }
    }
    // windows: the vista pane on the inner wall face, mullions, sill and head
    for (const s of sections)
      for (const [side, f, t] of s.windows || []) {
        const R0 = s.rects[0];
        const y0 = s.y + 1.0,
          y1 = s.ceiling - 0.7;
        const [ox, oz] = { n: [0, 1], s: [0, -1], e: [1, 0], w: [-1, 0] }[side];
        const at0 = { n: R0.maxZ, s: R0.minZ, e: R0.maxX, w: R0.minX }[side];
        const inward = -(ox || oz);
        const along = ox ? "z" : "x";
        const pane = new THREE.PlaneGeometry(t - f, y1 - y0);
        pane.rotateY({ n: Math.PI, s: 0, e: -Math.PI / 2, w: Math.PI / 2 }[side]);
        pane.translate(along === "x" ? (f + t) / 2 : at0 + inward * 0.02, (y0 + y1) / 2, along === "z" ? (f + t) / 2 : at0 + inward * 0.02);
        put(s.index, vistaMaterial(ox, oz), pane);
        if (!useKit) continue;
        const face = (o0, o1, a0, a1, b0, b1) =>
          along === "x"
            ? cuboid(a0, a1, b0, b1, Math.min(at0 + inward * o0, at0 + inward * o1), Math.max(at0 + inward * o0, at0 + inward * o1))
            : cuboid(Math.min(at0 + inward * o0, at0 + inward * o1), Math.max(at0 + inward * o0, at0 + inward * o1), b0, b1, a0, a1);
        addBox(s, "steel", face(0, 0.3, f - 0.1, t + 0.1, y0 - 0.12, y0));
        addBox(s, "gun", face(0, 0.18, f - 0.1, t + 0.1, y1, y1 + 0.2));
        const n = Math.max(1, Math.round((t - f) / 2));
        for (let i = 0; i <= n; i++) {
          const p = f + ((t - f) * i) / n;
          addBox(s, "gun", face(0, 0.14, p - 0.07, p + 0.07, y0, y1));
        }
        addBox(s, "gun", face(0, 0.08, f, t, (y0 + y1) / 2 - 0.04, (y0 + y1) / 2 + 0.04));
      }
    // merge: one mesh per material per section
    for (const [i, p] of parts.entries())
      for (const [mat, geos] of p) {
        const geo = mergeGeometries(geos, false);
        geos.forEach((x) => x.dispose());
        if (!geo) continue;
        const mesh = new THREE.Mesh(own(geo), mat);
        mesh.name = `${sections[i].id}:${mat.name}`;
        mesh.receiveShadow = true;
        if (mat.transparent) mesh.renderOrder = 2;
        secGroups[i].add(mesh);
      }
    // door leaves: greybox boxes, or the kit leaves merged per material with a slide attribute
    for (const d of doors) {
      const g = d._leaves;
      for (const c of [...g.children]) {
        g.remove(c);
        c.geometry?.dispose();
      }
      const tag = String(Math.round(d.width * 10)).padStart(2, "0");
      const leaf = useKit && kit.pieces.get(`p_leaf_${tag}`);
      const byMat = new Map();
      for (const sx of [-1, 1]) {
        const parts2 = leaf ? leaf.map((p) => [p.material, p.geometry.clone()]) : [[G.door, new THREE.BoxGeometry(d.width / 2, DOOR_H, 0.18).translate(0, DOOR_H / 2, 0)]];
        for (const [m, geo0] of parts2) {
          const geo = geo0.index ? geo0.toNonIndexed() : geo0;
          if (!leaf) worldUV(geo, 0.5);
          geo.translate((sx * d.width) / 4, 0, 0);
          geo.setAttribute("aSide", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill(sx), 1));
          if (!byMat.has(m)) byMat.set(m, []);
          byMat.get(m).push(geo);
        }
      }
      const slide = { value: 0 };
      for (const [m, geos] of byMat) {
        const geo = mergeGeometries(geos, false);
        geos.forEach((x) => x.dispose());
        const mat = m.clone();
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uSlide = slide;
          sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\nattribute float aSide;\nuniform float uSlide;")
            .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.x += aSide * uSlide;");
        };
        mat.customProgramCacheKey = () => "f2-door-leaf";
        g.add(new THREE.Mesh(own(geo), own(mat)));
      }
      d._slide = (e) => (slide.value = e * (d.width / 2 - 0.05));
      d._slide(d.progress * d.progress * (3 - 2 * d.progress));
    }
  }
  build(false);
  const ready =
    q.get("f2kit") === "0"
      ? Promise.resolve(false)
      : loadKit().then(
          () => (build(true), true),
          (e) => (console.warn("floor 2: kit missing, greybox stays", e), false),
        );

  // ------------------------------------------------------------------ lights (pooled)
  // Three point lights follow the player's section and its neighbours, in each section's
  // colour; the count never changes, so no shader recompiles when sections switch.
  const pool = [0, 1, 2].map(() => {
    const l = new THREE.PointLight(0xffe2b8, 0, 30, 1.4);
    group.add(l);
    return l;
  });
  const lightPower = +(q.get("f2light") || 90);

  // ------------------------------------------------------------------ culling
  // Visible: the player's section, its neighbours, and one more section beyond any open door.
  const adj = new Map(sections.map((s) => [s.id, []]));
  for (const d of doors) {
    if (d.side) continue;
    adj.get(d.from).push([d.to, d]);
    adj.get(d.to).push([d.from, d]);
  }
  let current = null;
  function refresh() {
    const id = current;
    const show = new Set([id]);
    for (const [b, d1] of adj.get(id)) {
      show.add(b);
      if (d1.isOpen || d1.progress > 0) for (const [c2, d2] of adj.get(b)) if (d2.isOpen || d2.progress > 0) show.add(c2);
    }
    for (const s of sections) secGroups[s.index].visible = show.has(s.id);
    for (const d of doors) d.group.visible = show.has(d.from) || (d.to && show.has(d.to));
    const lit = [id, ...adj.get(id).map(([b]) => b)].slice(0, pool.length);
    pool.forEach((l, i) => {
      const s = secById.get(lit[i]);
      if (!s) return (l.intensity = 0);
      const r = s.rects[0];
      l.color.setHex(s.look?.light ?? 0xffe2b8);
      l.position.set((r.minX + r.maxX) / 2, s.ceiling - 1.2, (r.minZ + r.maxZ) / 2);
      l.distance = Math.max(18, Math.hypot(r.maxX - r.minX, r.maxZ - r.minZ) * 0.8);
      l.intensity = lightPower * (i === 0 ? 1 : 0.55) * (s.ceiling - s.y > 8 ? 2.2 : 1);
    });
  }
  function setSection(id) {
    if (!secById.has(id) || id === current) return;
    current = id;
    refresh();
  }
  setSection(sectionAt(L.start.x, L.start.z));

  // ------------------------------------------------------------------ update
  const tmp = new THREE.Color();
  function update(dt, time) {
    uTime.value = time;
    let moved = false;
    for (const d of doors) {
      const before = d.progress;
      d.progress = THREE.MathUtils.clamp(d.progress + ((d.target ? 1 : -1) * dt) / 0.9, 0, 1);
      if (d.progress !== before) {
        moved = true;
        d._slide?.(d.progress * d.progress * (3 - 2 * d.progress));
        if (d.target === 1 && !d.isOpen && d.progress > 0.55) {
          d.isOpen = true;
          const k = colliders.indexOf(d.collider);
          if (k >= 0) colliders.splice(k, 1);
          version++;
        }
        if (d.progress === 1 && before < 1) emit(d, "open");
        if (d.progress === 0 && before > 0) emit(d, "closed");
      }
      // light: orange locked, green open, a fast red/orange flash on alert (an ambush tell)
      if (d.alert) tmp.copy(COLOR.alert).lerp(COLOR.locked, 0.5 + 0.5 * Math.sin(time * 14));
      else tmp.copy(COLOR.locked).lerp(COLOR.open, d.progress);
      d._light.emissive.copy(tmp);
      d._light.emissiveIntensity = d.alert ? 3 : 2.2;
    }
    if (moved && current) refresh();
  }

  // ?f2doors=open: every door starts open (layout walks, before the director drives them)
  if (q.get("f2doors") === "open")
    for (const d of doors) {
      d.target = d.progress = 1;
      d.isOpen = true;
      colliders.splice(colliders.indexOf(d.collider), 1);
      d._slide?.(1);
    }

  const level = {
    group,
    start: { ...L.start },
    goal: { ...L.goal },
    bounds,
    colliders,
    ground,
    sectionAt,
    sections: out,
    section: (id) => outById.get(id),
    doors,
    door: (id) => doorById.get(id),
    nav,
    ready,
    get current() {
      return current;
    },
    get version() {
      return version;
    },
    onDoor: null,
    addDoorListener: (f) => listeners.push(f),
    setSection,
    update,
    blocksAt,
    pointFree,
    segClear,
    dispose() {
      group.removeFromParent();
      for (const r of resources) r.dispose?.();
    },
  };
  return level;
}
