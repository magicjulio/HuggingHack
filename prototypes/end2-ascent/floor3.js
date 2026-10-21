import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createFloor2, PIECES, blocksAt } from "./floor2.js";

// Floor 3: the top floor, the finale (owner: arena, round 4). A short corridor on floor-2
// rules (doors, garrisons) and then the boss arena, the biggest room of the climb.
// It reuses floor2.js's generator: the layout table below goes through createFloor2(),
// so walls, colliders, ground, nav, doors, checkpoints, culling and the floor-2 kit
// dressing all work exactly as on floor 2 (building.js and the section director run
// unchanged). On top of that this module adds `level.arena` (Contract 1, brief r4), the
// arena's own pieces (pylons, the boss cradle, breakable cover), its lights and mood, and
// the floor-3 kit (design/3d/end2/floor3/ → end2-floor3-kit.glb).
// Coordinates are local to the floor-3 base (y = 0 is the floor-3 floor); world.js places
// the group at floorY = 2 × T.world.floorHeight. Map + contract notes: FLOOR3.md.

const KIT_URL = "./assets/models/end2-floor3-kit.glb";
const KIT_BUILT = true; // flip once the glb is exported (a 404 would fail smoke's console check)
const q = new URLSearchParams(location.search);
const num = (k, d) => (q.has(k) && Number.isFinite(+q.get(k)) ? +q.get(k) : d);

// Arena pieces. `hidden`: floor2.js makes the collider (and nav, cover anchors) but draws
// nothing; this module draws them (greybox now, kit pieces once the glb is in).
Object.assign(PIECES, {
  f3_break: { size: [2.6, 1.0], h: 1.2, low: true, hidden: true }, // breakable cover (slams destroy it)
  f3_pylon: { size: [2.6, 2.6], h: "ceiling", hidden: true }, // the roof's columns
  f3_cradle: { size: [11, 5], h: 2.2, hidden: true }, // the boss's base under the face (not walkable)
});

// ---------------------------------------------------------------- the arena, as numbers (knobs)
// ?f3size=1      arena scale (1 = 50 × 48 m; 0.8 … 1.3)
// ?f3ceil=26     arena ceiling (m)
// ?f3boss=far    far (north end) | mid (the middle of the room)
export const ARENA = {
  cx: 8,
  cz: 141,
  w: 50 * num("f3size", 1),
  d: 48 * num("f3size", 1),
  ceiling: num("f3ceil", 26),
  boss: q.get("f3boss") === "mid" ? "mid" : "far",
  faceY: num("f3faceY", 6), // height of the boss model's root (bottom of the face) over the floor
};

function arenaSection() {
  const A = ARENA;
  // every rect edge sits on floor2.js's 0.5 m grid (else walls shift into the room)
  const snap = (v) => Math.round(v * 2) / 2;
  const x0 = snap(A.cx - A.w / 2),
    x1 = snap(A.cx + A.w / 2),
    z0 = 117,
    z1 = snap(117 + A.d);
  const cz = (z0 + z1) / 2;
  const P = (u, v) => [+(A.cx + (u * A.w) / 2).toFixed(2), +(cz + (v * A.d) / 2).toFixed(2)];
  const home = A.boss === "mid" ? P(0, 0.1) : P(0, 0.68);
  // spread-out low cover in staggered rows; every third piece breaks (f3_break)
  const cover = [];
  const rows = [
    [-0.74, [[-0.62, "barrier"], [-0.2, "f3_break"], [0.2, "barrier"], [0.62, "f3_break"]]],
    [-0.44, [[-0.84, "crate"], [-0.42, "f3_break"], [0, "trunk"], [0.42, "crate"], [0.84, "f3_break"]]],
    [-0.12, [[-0.62, "barricade", 90], [-0.22, "trunk"], [0.22, "f3_break"], [0.62, "barricade", 90]]],
    [0.2, [[-0.84, "trunk", 90], [-0.42, "f3_break"], [0, "barrier"], [0.42, "f3_break"], [0.84, "trunk", 90]]],
    [0.46, [[-0.58, "f3_break"], [0.58, "f3_break"]]],
  ];
  for (const [v, list] of rows) for (const [u, kind, rot = 0] of list) cover.push([...P(u, v), kind, rot]);
  // four columns carry the roof (hard cover from the face's gaze, never destroyed)
  for (const [u, v] of [
    [-0.78, -0.26],
    [0.78, -0.26],
    [-0.78, 0.4],
    [0.78, 0.4],
  ])
    cover.push([...P(u, v), "f3_pylon"]);
  // the boss's cradle; in "mid" mode the cover near it goes
  const keep = cover.filter(([x, z]) => Math.hypot(x - home[0], z - home[1]) > 9.5);
  keep.push([home[0], home[1] + 1.5, "f3_cradle"]);
  // side closets for the waves: two in each side wall
  const closets = [];
  for (const [side, x] of [
    ["w", x0],
    ["e", x1],
  ])
    for (const [k, v] of [
      [0, -0.3],
      [1, 0.3],
    ]) {
      const z = +(cz + (v * A.d) / 2).toFixed(2);
      const id = `s3${side === "w" ? "ab"[k] : "cd"[k]}`;
      const zs = snap(z);
      const rect = side === "w" ? [x - 4.5, x - 1, zs - 2, zs + 2] : [x + 1, x + 4.5, zs - 2, zs + 2];
      closets.push({ id, rect, x: side === "w" ? x - 0.5 : x + 0.5, z: zs, width: 3.2, axis: "z" });
    }
  const drops = [
    P(-0.5, -0.5),
    P(0.5, -0.5),
    P(-0.3, 0),
    P(0.3, 0),
    P(-0.62, 0.32),
    P(0.62, 0.32),
    P(0, -0.3),
    P(0, 0.34),
  ].filter(([x, z]) => Math.hypot(x - home[0], z - home[1]) > 8);
  return {
    sec: {
      id: "s3",
      name: "SUMMIT HALL",
      kind: "arena",
      y: 0,
      ceiling: A.ceiling,
      rects: [[x0, x1, z0, z1]],
      cover: keep,
      // the north wall is one huge window (the boss floats in front of the night city)
      windows: [
        ["n", x0 + 1, x1 - 1],
        ["w", z1 - 12, z1 - 1],
        ["e", z1 - 12, z1 - 1],
      ],
      closets,
      look: { light: 0xcfe4ff, strip: 0x9fd8ff, tint: 0x9aa4ae, floor: "floor" },
      anchors: {
        back: [P(-0.9, 0.85), P(0.9, 0.85), P(-0.45, 0.9), P(0.45, 0.9)],
        flank: [P(-0.92, -0.1), P(0.92, -0.1), P(-0.92, 0.55), P(0.92, 0.55)],
        high: [],
        drop: drops,
      },
    },
    rect: { minX: x0, maxX: x1, minZ: z0, maxZ: z1 },
    home: { x: home[0], z: home[1] },
  };
}

export function floor3Layout() {
  const arena = arenaSection();
  return {
    arena,
    layout: {
      start: { x: 8, z: 63.6, yaw: Math.PI }, // in the express cab, facing the first door (+z)
      goal: { x: ARENA.cx, z: arena.home.z - 12, y: 0 }, // no lift up here: the arena centre
      sections: [
        {
          id: "s0",
          name: "EXPRESS LANDING",
          kind: "room",
          y: 0,
          ceiling: 6,
          rects: [
            [0, 16, 66, 76],
            [5.5, 10.5, 61.5, 66], // the cab alcove (the express lift arrives here)
          ],
          cover: [
            [2.6, 72.6, "crate", 90],
            [13.2, 69.8, "crate", 90],
          ],
          look: { light: 0xffd2a0, strip: 0xffb347, tint: 0xb6b0a6, floor: "floor" },
          anchors: { back: [[8, 74.6]], drop: [[4, 70], [12, 72]] },
        },
        {
          id: "s1",
          name: "SERVICE SPINE",
          kind: "hall",
          y: 0,
          ceiling: 4.8,
          rects: [[5, 11, 77, 99]],
          cover: [
            [6.35, 82.5, "barricade", 0],
            [9.65, 87.5, "barricade", 0],
            [6.35, 92.5, "barricade", 0],
            [9.65, 96.4, "barricade", 0],
          ],
          windows: [["w", 78, 98]],
          closets: [{ id: "s1a", rect: [12, 15, 88.5, 91.5], x: 11.5, z: 90, width: 2.2, axis: "z" }],
          look: { light: 0xdcecff, strip: 0xbfe2ff, tint: 0xa9b3bf, floor: "floor" },
          anchors: {
            back: [[8, 97.6], [6.4, 98.2], [9.6, 98.2]],
            flank: [[10, 90], [6, 86]],
          },
        },
        {
          id: "s2",
          name: "ANTECHAMBER",
          kind: "room",
          y: 0,
          ceiling: 8,
          rects: [[-6, 22, 100, 116]],
          cover: [
            [-1.6, 104.6, "console", 0],
            [17.6, 104.6, "console", 0],
            [2.8, 109.4, "desk", 0],
            [13.2, 109.4, "desk", 0],
            [8, 105.4, "crate", 0],
            [-3, 113, "trunk", 90],
            [19, 113, "trunk", 90],
            [3.2, 101.8, "pillar"],
            [12.8, 101.8, "pillar"],
            [3.2, 113.6, "column"],
            [12.8, 113.6, "column"],
          ],
          windows: [
            ["w", 101, 115],
            ["e", 101, 115],
          ],
          look: { light: 0xffb878, strip: 0xff9a40, tint: 0x9b948c, floor: "raised" },
          anchors: {
            back: [[8, 114.6], [0, 114.8], [16, 114.8]],
            flank: [[-4.6, 101.6], [20.6, 101.6], [-4.6, 108], [20.6, 108]],
            drop: [[8, 112], [0, 108], [16, 108]],
          },
        },
        arena.sec,
      ],
      doors: [
        { id: "d1", from: "s0", to: "s1", x: 8, z: 76.5, width: 3.2, axis: "x" },
        { id: "d2", from: "s1", to: "s2", x: 8, z: 99.5, width: 3.2, axis: "x" },
        { id: "d3", from: "s2", to: "s3", x: 8, z: 116.5, width: 3.6, axis: "x" },
      ],
    },
  };
}

export function createFloor3(opts = {}) {
  const resources = opts.resources || new Set();
  const own = (x) => (resources.add(x), x);
  const { layout, arena: A0 } = floor3Layout();
  const level = createFloor2({ ...opts, resources, layout });
  const group = level.group;
  group.name = "floor 3: summit";
  const secGroup = (id) => group.children.find((g) => g.name.startsWith(`floor 2: ${id} `));
  const arenaGroup = secGroup("s3");
  const art = new THREE.Group();
  art.name = "floor 3: arena pieces";
  group.add(art);
  const cabArt = new THREE.Group();
  cabArt.name = "floor 3: express cab";
  group.add(cabArt);

  // ---------------------------------------------------------------- materials (greybox)
  const M = {
    gun: own(new THREE.MeshStandardMaterial({ name: "f3g_gun", color: 0x2a323b, roughness: 0.5, metalness: 0.6 })),
    steel: own(new THREE.MeshStandardMaterial({ name: "f3g_steel", color: 0x6b7682, roughness: 0.38, metalness: 0.8 })),
    low: own(new THREE.MeshStandardMaterial({ name: "f3g_low", color: 0x6d5a3a, roughness: 0.6, metalness: 0.35 })),
    dark: own(new THREE.MeshStandardMaterial({ name: "f3g_dark", color: 0x0b0e12, roughness: 0.8, metalness: 0.3 })),
    yellow: own(new THREE.MeshStandardMaterial({ name: "f3g_yellow", color: 0xd9a514, roughness: 0.5, metalness: 0.1 })),
    // the mood materials: their emissive follows setMood
    glow: own(new THREE.MeshStandardMaterial({ name: "f3g_glow", color: 0x000000, emissive: 0x9fd8ff, emissiveIntensity: 1.4, roughness: 0.4 })),
    warn: own(new THREE.MeshStandardMaterial({ name: "f3g_warn", color: 0x000000, emissive: 0xff8a1e, emissiveIntensity: 0.0, roughness: 0.4 })),
    crack: own(new THREE.MeshStandardMaterial({ name: "f3g_crack", color: 0x000000, emissive: 0xffa040, emissiveIntensity: 1.6, roughness: 0.4 })),
  };
  const cuboid = (minX, maxX, minY, maxY, minZ, maxZ) =>
    new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ).translate((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);

  // ---------------------------------------------------------------- arena data
  const arenaSec = level.section("s3");
  const R = arenaSec.rects[0];
  const pieces = level.colliders.filter((c) => c.section === "s3" && c.piece?.startsWith("f3_"));
  const cradle = pieces.find((c) => c.piece === "f3_cradle");
  const pylons = pieces.filter((c) => c.piece === "f3_pylon");
  const breakCols = pieces.filter((c) => c.piece === "f3_break");
  const home = A0.home;
  const center = { x: (R.minX + R.maxX) / 2, z: (R.minZ + R.maxZ) / 2, y: 0 };

  // slam zone: the walkable arena floor minus a 1.2 m strip along the walls and the cradle
  const m = 1.2;
  const slamZone = [];
  {
    const cr = cradle;
    const zMid = cr.minZ - 1;
    slamZone.push({ minX: R.minX + m, maxX: R.maxX - m, minZ: R.minZ + 3.5, maxZ: zMid, y: 0 }); // keep clear of the gate
    slamZone.push({ minX: R.minX + m, maxX: cr.minX - 1, minZ: zMid, maxZ: R.maxZ - m, y: 0 });
    slamZone.push({ minX: cr.maxX + 1, maxX: R.maxX - m, minZ: zMid, maxZ: R.maxZ - m, y: 0 });
    if (cr.maxZ + 1 < R.maxZ - m) slamZone.push({ minX: cr.minX - 1, maxX: cr.maxX + 1, minZ: cr.maxZ + 1, maxZ: R.maxZ - m, y: 0 });
  }

  // ---------------------------------------------------------------- breakables
  // Each one is its own small mesh group (greybox, or the kit piece), so breaking one only
  // hides it. break() removes the collider and bumps level.version (world.js re-syncs).
  const versionOf = Object.getOwnPropertyDescriptor(level, "version").get;
  let bump = 0;
  Object.defineProperty(level, "version", { get: () => versionOf() + bump, configurable: true });
  const debris = [];
  // perf: with the kit, the opaque parts of all breakables are merged (see dress()); a broken
  // piece is collapsed in the vertex shader through this per-piece flag.
  const gone = { value: new Float32Array(Math.max(1, breakCols.length)) };
  const breakables = breakCols.map((c, i) => {
    const g = new THREE.Group();
    g.name = `breakable ${i}`;
    g.position.set((c.minX + c.maxX) / 2, c.baseY, (c.minZ + c.maxZ) / 2);
    const rotated = c.maxZ - c.minZ > c.maxX - c.minX;
    if (rotated) g.rotation.y = Math.PI / 2;
    art.add(g);
    const b = {
      id: `b${i}`,
      collider: c,
      group: g,
      broken: false,
      hp: 1,
      break(dir) {
        if (this.broken) return false;
        this.broken = true;
        const k = level.colliders.indexOf(c);
        if (k >= 0) level.colliders.splice(k, 1);
        bump++;
        g.visible = false;
        gone.value[i] = 1;
        spawnDebris(g.position, dir);
        level.onBreak?.(this);
        return true;
      },
      reset() {
        if (!this.broken) return;
        this.broken = false;
        if (!level.colliders.includes(c)) level.colliders.push(c);
        bump++;
        g.visible = true;
        gone.value[i] = 0;
      },
    };
    return b;
  });
  // debris: a handful of chunks thrown out of a broken piece, settling on the floor
  const chunkGeo = own(new THREE.BoxGeometry(1, 1, 1));
  function spawnDebris(p, dir) {
    for (let i = 0; i < 9; i++) {
      const s = 0.18 + Math.random() * 0.32;
      const mesh = new THREE.Mesh(chunkGeo, i % 3 ? M.low : M.dark);
      mesh.scale.set(s * 1.6, s, s);
      mesh.position.set(p.x + (Math.random() - 0.5) * 2, p.y + 0.6 + Math.random() * 0.4, p.z + (Math.random() - 0.5) * 0.8);
      art.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * 4, 4 + Math.random() * 4, Math.sin(a) * 4);
      if (dir) v.addScaledVector(dir, 3);
      debris.push({ mesh, v, spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0), life: 6 });
    }
  }

  // ---------------------------------------------------------------- greybox pieces
  const grey = new THREE.Group();
  grey.name = "floor 3: greybox pieces";
  art.add(grey);
  function buildGrey() {
    const parts = new Map();
    const put = (mat, geo) => {
      if (!parts.has(mat)) parts.set(mat, []);
      parts.get(mat).push(geo.index ? geo.toNonIndexed() : geo);
    };
    for (const c of pylons) {
      put(M.gun, cuboid(c.minX, c.maxX, 0, c.baseY + c.height, c.minZ, c.maxZ));
      put(M.dark, cuboid(c.minX - 0.25, c.maxX + 0.25, 0, 0.5, c.minZ - 0.25, c.maxZ + 0.25));
      for (const y of [3, 9, 15, 21]) put(M.glow, cuboid(c.minX - 0.04, c.maxX + 0.04, y, y + 0.12, c.minZ - 0.04, c.maxZ + 0.04));
    }
    {
      const c = cradle;
      put(M.gun, cuboid(c.minX, c.maxX, 0, c.height, c.minZ, c.maxZ));
      put(M.yellow, cuboid(c.minX - 0.05, c.maxX + 0.05, c.height - 0.25, c.height, c.minZ - 0.05, c.maxZ + 0.05));
      put(M.glow, cuboid(c.minX + 1, c.maxX - 1, c.height, c.height + 0.06, c.minZ + 1, c.maxZ - 1));
    }
    for (const [mat, geos] of parts) {
      const mesh = new THREE.Mesh(own(mergeGeometries(geos, false)), mat);
      geos.forEach((g) => g.dispose());
      grey.add(mesh);
    }
    // arena floor inlay: a ring and a cross of glow lines under the fight (reads the scale)
    const ring = new THREE.Mesh(own(new THREE.RingGeometry(14.8, 15.1, 96)), M.glow);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, 0.02, center.z - 2);
    grey.add(ring);
    for (const b of breakables) {
      const w = PIECES.f3_break.size[0],
        d = PIECES.f3_break.size[1];
      b.group.add(new THREE.Mesh(own(new THREE.BoxGeometry(w, 1.2, d).translate(0, 0.6, 0)), M.low));
      b.group.add(new THREE.Mesh(own(new THREE.BoxGeometry(w - 0.3, 0.06, 0.04).translate(0, 0.9, d / 2 + 0.01)), M.crack));
    }
  }
  buildGrey();

  // ---------------------------------------------------------------- lights and mood
  // Two big hall lights high up, one spot on the boss's face. setMood(k) blends the hall
  // (and the arena's glow strips) from cool white (0) to amber (1) to a dark red (2).
  const MOOD = [
    { hall: new THREE.Color(0xcfe4ff), power: 1, glow: new THREE.Color(0x9fd8ff), warn: 0, spot: 1, fog: 1 },
    { hall: new THREE.Color(0xffc890), power: 0.85, glow: new THREE.Color(0xffb04a), warn: 0.6, spot: 1, fog: 0.9 },
    { hall: new THREE.Color(0xff5a3a), power: 0.55, glow: new THREE.Color(0xff3b1e), warn: 2.2, spot: 0.85, fog: 0.75 },
  ];
  const hallPower = num("f3light", 160);
  const hall = [-1, 1].map((s) => {
    const l = new THREE.PointLight(MOOD[0].hall, hallPower, 70, 1.25);
    l.position.set(center.x + s * ARENA.w * 0.24, ARENA.ceiling * 0.72, center.z - 3);
    group.add(l);
    return l;
  });
  const spot = new THREE.SpotLight(0xfff1dc, num("f3spot", 420), 0, 0.42, 0.6, 1.6);
  spot.position.set(home.x, ARENA.ceiling - 3, home.z - 22);
  spot.target.position.set(home.x, ARENA.faceY + 7, home.z);
  group.add(spot, spot.target);
  let mood = 0,
    moodTarget = 0;
  const tmpC = new THREE.Color();
  const lerpMood = (key, k) => {
    const a = MOOD[Math.floor(k)],
      b = MOOD[Math.min(2, Math.floor(k) + 1)],
      f = k - Math.floor(k);
    return typeof a[key] === "number" ? THREE.MathUtils.lerp(a[key], b[key], f) : tmpC.copy(a[key]).lerp(b[key], f);
  };
  // kit strip materials (named strip:<section index>) join the mood once the kit is in
  const moodMats = new Set([M.glow]);
  function collectMoodMats() {
    arenaGroup.traverse((o) => {
      if (o.isMesh && o.material?.name === `strip:${arenaSec.index}`) moodMats.add(o.material);
    });
  }
  // The lights stay in the scene on floor 3 (a fixed light count: no shader recompiles
  // when sections cull); they go dark while the arena is culled.
  let lit = 1;
  function applyMood(k) {
    const power = lerpMood("power", k);
    hall.forEach((l) => {
      l.color.copy(lerpMood("hall", k));
      l.intensity = hallPower * power * lit;
    });
    spot.intensity = num("f3spot", 420) * lerpMood("spot", k) * lit;
    const glow = lerpMood("glow", k).clone();
    for (const mat of moodMats) mat.emissive.copy(glow);
    M.warn.emissiveIntensity = lerpMood("warn", k);
    if (M.warnKit) M.warnKit.emissiveIntensity = Math.max(0.35, lerpMood("warn", k));
  }
  applyMood(0);

  // ---------------------------------------------------------------- the kit (end2-floor3-kit.glb)
  // Named pieces, each built at its collider footprint (origin = floor centre, front +z):
  // q_pylon, q_cradle, q_break, q_gate (arena side of d3), q_cab (the arrival cab),
  // q_truss (roof truss module, 8 m), q_inlay (arena floor ring). Missing pieces keep the greybox.
  const kit = { pieces: new Map(), loaded: false };
  const EMISSIVE = { q_glow: 1.4, q_warn: 1.0, q_crack: 1.6, q_screen: 0.9 };
  async function loadKit() {
    const gltf = await new GLTFLoader().loadAsync(KIT_URL);
    const scn = gltf.scene;
    scn.updateWorldMatrix(true, true);
    const mats = new Map();
    for (const p of scn.children[0]?.children ?? []) {
      const inv = new THREE.Matrix4().copy(p.matrixWorld).invert();
      const parts = [];
      p.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
        let mat = mats.get(o.material.name);
        if (!mat) {
          mat = o.material;
          if (mat.name in EMISSIVE) mat.emissiveIntensity = EMISSIVE[mat.name];
          if (mat.name === "q_glass") Object.assign(mat, { transparent: true, opacity: 0.32, depthWrite: false });
          for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"])
            if (mat[k]) {
              mat[k].anisotropy = 8;
              mat[k].wrapS = mat[k].wrapT = THREE.RepeatWrapping;
              own(mat[k]);
            }
          mats.set(mat.name, own(mat));
        }
        parts.push({ geometry: own(g.index ? g.toNonIndexed() : g), material: mat });
        o.geometry.dispose();
      });
      kit.pieces.set(p.name, parts);
    }
    kit.mats = mats;
    kit.loaded = true;
  }
  const kitGroup = new THREE.Group();
  kitGroup.name = "floor 3: kit pieces";
  art.add(kitGroup);
  function dress() {
    const parts = new Map();
    const at = (x, y, z, rot = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(rot));
    const place = (name, matrix, into = parts) => {
      const list = kit.pieces.get(name);
      if (!list) return false;
      for (const part of list) {
        const g = part.geometry.clone().applyMatrix4(matrix);
        if (!into.has(part.material)) into.set(part.material, []);
        into.get(part.material).push(g);
      }
      return true;
    };
    const flush = (map, parent, name) => {
      for (const [mat, geos] of map) {
        const mesh = new THREE.Mesh(own(mergeGeometries(geos, false)), mat);
        geos.forEach((g) => g.dispose());
        mesh.name = `${name}:${mat.name}`;
        mesh.receiveShadow = true;
        if (mat.transparent) mesh.renderOrder = 2;
        parent.add(mesh);
      }
    };
    let dressed = 0;
    for (const c of pylons) dressed += place("q_pylon", at((c.minX + c.maxX) / 2, 0, (c.minZ + c.maxZ) / 2)) ? 1 : 0;
    if (place("q_cradle", at((cradle.minX + cradle.maxX) / 2, 0, (cradle.minZ + cradle.maxZ) / 2))) dressed++;
    const gate = level.door("d3");
    place("q_gate", at(gate.x, 0, gate.z));
    place("q_inlay", at(center.x, 0, center.z - 2));
    const span = new THREE.Matrix4().makeScale(1, 1, (R.maxZ - R.minZ - 1) / 48);
    for (let x = R.minX + 5; x < R.maxX - 3; x += 8) place("q_truss", at(x, ARENA.ceiling, center.z).multiply(span));
    flush(parts, kitGroup, "arena");
    // the cab (s0): its own group, shown with s0
    const cab = new Map();
    if (place("q_cab", at(8, 0, 63.75), cab)) flush(cab, cabArt, "cab");
    // breakables (perf, 2026-10-19): the opaque parts of all of them merge into one mesh per
    // material, with a per-vertex piece index; a broken piece collapses in the vertex shader
    // (uGone). ~63 draw calls → 7. The glass stays one small mesh per piece in b.group, so the
    // transparent sorting is as before, and b.group still hides with the piece.
    const merged = new Map();
    for (const [i, b] of breakables.entries()) {
      const one = new Map();
      if (!place("q_break", new THREE.Matrix4(), one)) continue;
      for (const ch of [...b.group.children]) b.group.remove(ch);
      b.group.updateMatrix();
      const glass = new Map();
      for (const [mat, geos] of one) {
        if (mat.transparent) {
          glass.set(mat, geos);
          continue;
        }
        if (!merged.has(mat)) merged.set(mat, []);
        for (const g of geos) {
          g.applyMatrix4(b.group.matrix);
          g.setAttribute("aPiece", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(i), 1));
          merged.get(mat).push(g);
        }
      }
      flush(glass, b.group, b.id);
    }
    const n = gone.value.length;
    for (const [mat, geos] of merged) {
      const m = own(mat.clone());
      m.emissive = mat.emissive; // shared Color: mood/emissive changes on the kit material carry over
      Object.defineProperty(m, "emissiveIntensity", { get: () => mat.emissiveIntensity, set() {}, configurable: true });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uGone = gone;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", `#include <common>\nattribute float aPiece;\nuniform float uGone[${n}];`)
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nif (uGone[int(aPiece + 0.5)] > 0.5) transformed = vec3(0.0);");
      };
      m.customProgramCacheKey = () => `f3-break-${n}`;
      const mesh = new THREE.Mesh(own(mergeGeometries(geos, false)), m);
      geos.forEach((g) => g.dispose());
      mesh.name = `breakables:${mat.name}`;
      mesh.receiveShadow = true;
      art.add(mesh);
    }
    if (dressed) grey.visible = false;
    collectMoodMats();
    for (const mat of kit.mats.values()) if (mat.name === "q_glow") moodMats.add(mat);
    for (const mat of kit.mats.values()) if (mat.name === "q_warn") M.warnKit = mat;
    applyMood(mood);
  }
  const kitReady =
    q.get("f3kit") === "0" || !KIT_BUILT
      ? Promise.resolve(false)
      : loadKit().then(
          () => (dress(), true),
          (e) => (console.info("floor 3: kit not in yet, greybox stays", e?.message || e), false),
        );
  const ready = Promise.all([level.ready, kitReady]).then(([a, b]) => {
    collectMoodMats();
    applyMood(mood);
    return a && b;
  });

  // ---------------------------------------------------------------- update (wraps floor2's)
  const baseUpdate = level.update;
  const s0Group = secGroup("s0");
  function update(dt, time) {
    baseUpdate(dt, time);
    art.visible = arenaGroup.visible;
    cabArt.visible = s0Group.visible;
    const on = art.visible ? 1 : 0;
    if (on !== lit) {
      lit = on;
      applyMood(mood);
    }
    if (Math.abs(mood - moodTarget) > 1e-3) {
      mood = THREE.MathUtils.damp(mood, moodTarget, 1.6, dt);
      if (Math.abs(mood - moodTarget) < 0.002) mood = moodTarget;
      applyMood(mood);
    }
    // phase 3: the warning beacons pulse
    if (mood > 1) {
      const p = (mood - 1) * (0.55 + 0.45 * Math.sin(time * 5));
      M.warn.emissiveIntensity = 2.2 * p;
      if (M.warnKit) M.warnKit.emissiveIntensity = 2.2 * p;
    }
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.life -= dt;
      if (d.mesh.position.y > 0.12 || d.v.y > 0) {
        d.v.y -= 22 * dt;
        d.mesh.position.addScaledVector(d.v, dt);
        d.mesh.rotation.x += d.spin.x * dt;
        d.mesh.rotation.y += d.spin.y * dt;
        if (d.mesh.position.y < 0.12) {
          d.mesh.position.y = 0.12;
          d.v.multiplyScalar(0.3);
          d.v.y = d.v.y < -2 ? -d.v.y * 0.25 : 0;
          d.spin.multiplyScalar(0.4);
        }
      }
      if (d.life < 0) {
        art.remove(d.mesh);
        debris.splice(i, 1);
      }
    }
  }
  level.update = update;
  level.ready = ready;

  // ---------------------------------------------------------------- level.arena (Contract 1)
  level.arena = {
    section: "s3",
    gate: "d3", // the door you come in by (close it behind the player)
    rect: { ...R }, // the arena's walkable rect
    center,
    radius: Math.min(R.maxX - R.minX, R.maxZ - R.minZ) / 2 - 2,
    ceiling: ARENA.ceiling,
    bossHome: { x: home.x, z: home.z, y: ARENA.faceY },
    cradle: { minX: cradle.minX, maxX: cradle.maxX, minZ: cradle.minZ, maxZ: cradle.maxZ, top: cradle.height },
    slamZone,
    drops: arenaSec.anchors.drop.map((p) => [...p]),
    sideDoors: level.doors.filter((d) => d.side && d.from === "s3").map((d) => d.id),
    cover: arenaSec.anchors.cover.map((p) => [...p]),
    breakables,
    // break every breakable whose footprint is within r of (x, z); returns how many broke
    breakAt(x, z, r = 2.5, dir) {
      let n = 0;
      for (const b of breakables) {
        if (b.broken) continue;
        const c = b.collider;
        const dx = Math.max(c.minX - x, 0, x - c.maxX),
          dz = Math.max(c.minZ - z, 0, z - c.maxZ);
        if (Math.hypot(dx, dz) <= r && b.break(dir)) n++;
      }
      return n;
    },
    resetBreakables() {
      for (const b of breakables) b.reset();
      for (const d of debris.splice(0)) art.remove(d.mesh);
    },
    // inside the slam zone?
    inSlamZone(x, z) {
      return slamZone.some((r) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ);
    },
    setMood(k, instant = false) {
      moodTarget = THREE.MathUtils.clamp(k, 0, 2);
      if (instant) {
        mood = moodTarget;
        applyMood(mood);
      }
    },
    get mood() {
      return mood;
    },
  };
  level.floor = 3;
  level.blocksAt = blocksAt;
  return level;
}
