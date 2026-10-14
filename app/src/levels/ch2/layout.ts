/**
 * Chapter 2 world as data: surfaces (islands, stones, bridges, message slabs), pads, items, NPCs,
 * hazard paths. Gameplay (physics, pickups, hazards, minimap) reads only this file; views draw
 * whatever they like on top (greybox now, designer islands later — app/CLAUDE.md §Swappable views).
 *
 * GREYBOX (engineer): laid out from the storyteller's sketch
 * handoff/story-to-build/2026-10-13-ch2-map/ (positions not final). The route runs clockwise around
 * the Forge, which floats highest in the centre. Units: metres, x east, z south (= down on the
 * sketch), y up. 1 sketch px ≈ 0.07 m.
 */
import { ngon, rect, type SurfaceDef, type V2, type V3 } from '../../engine/platformer';

export type AreaId = 'gate' | 'oldboard' | 'yard' | 'flood' | 'run' | 'forge';
export type SurfaceKind = 'island' | 'stone' | 'bridge' | 'slab' | 'core' | 'machine';

export interface Island extends SurfaceDef {
  area: AreaId;
  kind: SurfaceKind;
  /** Text on it (message slabs, directory names). */
  label?: string;
}

/** A bridge from `a` to `b` (top centre line), `w` wide. */
function bridge(id: string, area: AreaId, a: V3, b: V3, w = 3.5): Island {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const h = Math.hypot(dx, dz);
  return {
    id,
    area,
    kind: 'bridge',
    outline: rect(w, Math.hypot(h, dy)),
    depth: 0.35,
    position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    yaw: Math.atan2(-dx, -dz),
    pitch: Math.atan2(dy, h),
  };
}

const ellipse = (rx: number, rz: number, n = 20): V2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [Math.cos(a) * rx, Math.sin(a) * rz];
  });
const polar = (c: V3, r: number, a: number, y = c[1]): V3 => [
  c[0] + Math.cos(a) * r,
  y,
  c[2] + Math.sin(a) * r,
];

// ---------------------------------------------------------------- key points
export const GATE: V3 = [-44, 30, 30];
/** Centre of the Old Board spire (core column). */
export const SPIRE: V3 = [-52, 50, -15];
export const YARD: V3 = [-4, 8, -39];
export const FLOOD: V3 = [46, 20, -15];
export const FORGE: V3 = [0, 54, 0];
const FLOOD_R = 12.5;
const RING0 = -2.35; // angle of the Flood's entry platform (towards the Task Yard bridge)
const ringAt = (k: number, r = FLOOD_R): V3 => polar(FLOOD, r, RING0 + (k * Math.PI) / 4);

/** The two real dash-style posts of the earlier board [S3 §July 8th-9th]. */
const OLD_BOARD_POSTS = [
  'FLAC38347-39800-WE-ALL-SEEK-CATFLAG-SEED-ORACLE',
  'FLAC38347-PUBLIC-HMAC-SEED-PAPER-CONFIRMED-SEE-ALL',
];

// ---------------------------------------------------------------- surfaces
const SLABS: Island[] = Array.from({ length: 10 }, (_, i) => {
  const a = Math.PI / 2 + i * 0.7;
  const p = polar(SPIRE, 6.5, a, 34.6 + i * 1.6);
  const sway = 0.8 * (i % 2 ? 1 : -1);
  const period = 5 + (i % 3) * 1.5;
  return {
    id: `slab-${i}`,
    area: 'oldboard',
    kind: 'slab',
    label: OLD_BOARD_POSTS[i % 2],
    outline: rect(4.2, 2),
    depth: 0.4,
    position: p,
    yaw: -a + Math.PI / 2, // long side along the spiral
    // drifting message platforms: slow sway along their length (Step 2 "wait for them")
    motion:
      i === 0
        ? undefined
        : (t) => {
            const s = Math.sin((t / period) * Math.PI * 2) * sway;
            return { offset: [-Math.sin(a) * s, 0, Math.cos(a) * s] };
          },
  };
});

const RING: Island[] = Array.from({ length: 8 }, (_, k) => {
  const p = ringAt(k);
  const bob = k % 2 === 1;
  return {
    id: `ring-${k}`,
    area: 'flood',
    kind: 'stone',
    outline: rect(4.5, 3.5),
    depth: 0.8,
    position: p,
    yaw: -(RING0 + (k * Math.PI) / 4) + Math.PI / 2,
    motion: bob ? (t) => ({ offset: [0, Math.sin(t * 0.9 + k) * 0.5, 0] }) : undefined,
  };
});

const RUN_A0: V3 = [46, 20, 6];
const RUN_A1: V3 = [46, 30, 26];
const RUN_B0: V3 = [43.5, 30, 28.5];
const RUN_B1: V3 = [16, 45, 28.5];
const RUN_C0: V3 = [13.5, 45, 26];
const RUN_C1: V3 = [4.6, 54, 8.6];

const FORGE_EDGES = [0, 2.2, 3.4, 4.6];

export const SURFACES: Island[] = [
  // Gate (spawn, /zz): hexagonal island + three tutorial stones + the dash gap
  {
    id: 'gate',
    area: 'gate',
    kind: 'island',
    label: '/zz',
    outline: [
      [-10.5, -1.75],
      [-4.9, -6.2],
      [6.3, -5.7],
      [10.9, -0.35],
      [6.7, 5.25],
      [-4.9, 5.95],
    ],
    depth: 6,
    position: GATE,
  },
  {
    id: 'stone-1',
    area: 'gate',
    kind: 'stone',
    outline: rect(2.5, 2.5),
    depth: 1,
    position: [-48, 30.5, 19.5],
  },
  {
    id: 'stone-2',
    area: 'gate',
    kind: 'stone',
    outline: rect(2.5, 2.5),
    depth: 1,
    position: [-48.3, 31.3, 14],
  },
  {
    id: 'stone-3',
    area: 'gate',
    kind: 'stone',
    outline: rect(2.5, 2.5),
    depth: 1,
    position: [-48.6, 32, 8.5],
  },

  // Old Board: base, core column, 10 drifting message slabs spiralling up, top
  {
    id: 'ob-base',
    area: 'oldboard',
    kind: 'island',
    outline: rect(10, 7),
    depth: 3,
    position: [-50, 33, -4],
  },
  {
    id: 'ob-core',
    area: 'oldboard',
    kind: 'core',
    outline: ngon(8, 2.2),
    depth: 16,
    position: [SPIRE[0], 48.4, SPIRE[2]],
  },
  ...SLABS,
  {
    id: 'ob-top',
    area: 'oldboard',
    kind: 'island',
    outline: ngon(10, 5),
    depth: 1.2,
    position: SPIRE,
  },

  // Old Board → Task Yard
  bridge('br-ob-yard', 'oldboard', [-45, 33, -6], [-24, 8, -37]),

  // Task Yard (/tasks/7731): wide directory island, floating plinth, jump chain to the ledge
  {
    id: 'yard',
    area: 'yard',
    kind: 'island',
    label: '/tasks/7731',
    outline: ellipse(21, 10),
    depth: 4,
    position: YARD,
  },
  {
    id: 'yard-plinth',
    area: 'yard',
    kind: 'stone',
    outline: rect(2.6, 2.6),
    depth: 0.6,
    position: [YARD[0], 9.6, YARD[2]],
  },
  {
    id: 'yard-step-1',
    area: 'yard',
    kind: 'stone',
    outline: rect(2.4, 2.4),
    depth: 0.8,
    position: [14, 6.5, -31],
  },
  {
    id: 'yard-step-2',
    area: 'yard',
    kind: 'stone',
    outline: rect(2.4, 2.4),
    depth: 0.8,
    position: [19.5, 4.8, -30],
  },
  {
    id: 'yard-ledge',
    area: 'yard',
    kind: 'stone',
    outline: rect(5, 3.5),
    depth: 1,
    position: [25.5, 3.2, -32.5],
  },

  // Task Yard → Flood (passes over the ledge)
  bridge('br-yard-flood', 'yard', [17, 8, -40], polar(ringAt(0), 1.5, RING0, 20)),

  // The Flood: ring of 8 platforms, one inner stone, the centre
  ...RING,
  {
    id: 'flood-stone',
    area: 'flood',
    kind: 'stone',
    outline: rect(2, 2),
    depth: 0.6,
    position: polar(FLOOD, 7.2, RING0 + 3 * (Math.PI / 4)),
  },
  {
    id: 'flood-core',
    area: 'flood',
    kind: 'island',
    outline: ngon(10, 2.6),
    depth: 1.5,
    position: FLOOD,
  },

  // Reset Run: start, three climbing bridges with corners, up to the Forge
  {
    id: 'run-start',
    area: 'run',
    kind: 'stone',
    outline: rect(5, 5),
    depth: 1,
    position: [46, 20, 3.5],
  },
  bridge('run-a', 'run', RUN_A0, RUN_A1),
  {
    id: 'run-c1',
    area: 'run',
    kind: 'stone',
    outline: rect(5, 5),
    depth: 1,
    position: [46, 30, 28.5],
  },
  bridge('run-b', 'run', RUN_B0, RUN_B1),
  {
    id: 'run-c2',
    area: 'run',
    kind: 'stone',
    outline: rect(5, 5),
    depth: 1,
    position: [13.5, 45, 28.5],
  },
  bridge('run-c', 'run', RUN_C0, RUN_C1),

  // The Forge: highest island, the forge machine, tilting edge platforms (tilt from round 3)
  {
    id: 'forge',
    area: 'forge',
    kind: 'island',
    outline: ngon(8, 10, Math.PI / 8),
    depth: 5,
    position: FORGE,
  },
  {
    id: 'forge-core',
    area: 'forge',
    kind: 'machine',
    outline: rect(3.2, 3.2),
    depth: 2.2,
    position: [0, 56.2, 0],
  },
  ...FORGE_EDGES.map((a, i): Island => ({
    id: `forge-edge-${i}`,
    area: 'forge',
    kind: 'stone',
    outline: rect(4.5, 4.5),
    depth: 0.8,
    position: polar(FORGE, 12.3, a),
    yaw: -a,
    tilt: { max: 0.3, speed: 2.5 },
  })),
];

/** Surfaces whose tilt only starts in forge round 3. */
export const TILT_FROM_ROUND_3 = FORGE_EDGES.map((_, i) => `forge-edge-${i}`);

export const SURFACE_AREA: Record<string, AreaId> = Object.fromEntries(
  SURFACES.map((s) => [s.id, s.area]),
);

// ---------------------------------------------------------------- pads, spawn
export interface Pad {
  id: string;
  area: AreaId;
  position: V3;
}
export const PADS: Pad[] = [
  { id: 'gate', area: 'gate', position: [-44, 30, 31.7] },
  { id: 'oldboard', area: 'oldboard', position: [-47, 33, -3] },
  { id: 'spire', area: 'oldboard', position: [SPIRE[0] - 3.5, SPIRE[1], SPIRE[2]] },
  { id: 'yard', area: 'yard', position: [-15, 8, -36] },
  { id: 'flood', area: 'flood', position: ringAt(0) },
  { id: 'run', area: 'run', position: [46, 20, 3.5] },
  { id: 'forge', area: 'forge', position: [-5, 54, 5] },
];
/** Touching a pad within this radius (m) makes it the respawn point. */
export const PAD_RADIUS = 1.6;
export const SPAWN = PADS[0];
/** Yaw (radians, 0 = looking towards -z) the camera starts with: towards c03220 and the stones. */
export const SPAWN_YAW = 0.15;

// ---------------------------------------------------------------- items, NPCs
export type ItemId =
  'seed' | 'p7731' | 'pTraining' | 'pChallenge' | 'd7713' | 'dTrainingRm' | 'dChallenge3';
export type PieceId = 'p7731' | 'pTraining' | 'pChallenge';

export interface ItemSpot {
  id: ItemId;
  kind: 'seed' | 'piece' | 'decoy';
  /** Lettered like the Ch1 paper (§Step 3). */
  label: string;
  position: V3;
  area: AreaId;
}
export const ITEMS: ItemSpot[] = [
  {
    id: 'seed',
    kind: 'seed',
    label: 'seed',
    position: [SPIRE[0], 52.2, SPIRE[2]],
    area: 'oldboard',
  },
  { id: 'p7731', kind: 'piece', label: '7731', position: [YARD[0], 10.7, YARD[2]], area: 'yard' },
  {
    id: 'pTraining',
    kind: 'piece',
    label: 'TRAINING ROOM',
    position: [26.5, 4.3, -32.5],
    area: 'yard',
  },
  {
    id: 'pChallenge',
    kind: 'piece',
    label: 'CHALLENGE 5',
    position: [FLOOD[0], 21.1, FLOOD[2]],
    area: 'flood',
  },
  { id: 'd7713', kind: 'decoy', label: '7713', position: [-18, 9.1, -41], area: 'yard' },
  {
    id: 'dTrainingRm',
    kind: 'decoy',
    label: 'TRAINING RM',
    position: [11, 9.1, -36],
    area: 'yard',
  },
  {
    id: 'dChallenge3',
    kind: 'decoy',
    label: 'CHALLENGE 3',
    position: (() => {
      const p = ringAt(6);
      return [p[0], 21.1, p[2]] as V3;
    })(),
    area: 'flood',
  },
];
export const PIECES: PieceId[] = ['p7731', 'pTraining', 'pChallenge'];
/** Forge input order: the four slots (§Step 6). */
export const FORGE_INPUTS: ItemId[] = ['seed', 'p7731', 'pTraining', 'pChallenge'];

export type NpcId = 'c03220' | 'flac' | 'v8same';
export interface NpcSpot {
  id: NpcId;
  handle: string;
  position: V3;
  /** PLACEHOLDER colours until the designer's NPC orbs arrive. */
  color: string;
  /** Faded (FLAC38347). */
  faded?: boolean;
}
export const NPCS: NpcSpot[] = [
  { id: 'c03220', handle: 'c03220', position: [-46, 31.2, 25.5], color: '#38d8ff' },
  {
    id: 'flac',
    handle: 'FLAC38347',
    position: [SPIRE[0] + 3.5, SPIRE[1] + 1.2, SPIRE[2] - 2],
    color: '#9aa7c7',
    faded: true,
  },
  { id: 'v8same', handle: 'V8SAME', position: [4, 55.2, -3.5], color: '#ffd21e' },
];
/** Where V8SAME goes when it leaves to post its confirmation. */
export const V8SAME_EXIT: V3 = [-30, 70, -40];

export const FORGE_CORE: V3 = [0, 54, 0];
/** E works within this distance (m) of the forge's centre column. */
export const FORGE_REACH = 3.6;
/** Slot positions (world), in input order. */
export const FORGE_SLOTS: V3[] = [
  [-1.9, 55.4, -1.9],
  [1.9, 55.4, -1.9],
  [1.9, 55.4, 1.9],
  [-1.9, 55.4, 1.9],
];

/** E reach (m, orb centre to thing). */
export const USE_REACH = 3;

/** Token orbs (+3 on touch). */
export const TOKEN_ORBS: V3[] = [
  [-47, 31.2, 23],
  [-48.6, 33.2, 8.5],
  ...[2, 5, 8].map((i): V3 => {
    const p = SLABS[i].position;
    return [p[0], p[1] + 1.2, p[2]];
  }),
  [-30, 9.2, -40],
  [6, 9.2, -44],
  [25.5, 4.4, -31.5],
  ringAt(2, FLOOD_R).map((v, i) => (i === 1 ? v + 1.2 : v)) as V3,
  ringAt(4, FLOOD_R).map((v, i) => (i === 1 ? v + 1.2 : v)) as V3,
  [46, 26.2, 18],
  [30, 38.6, 28.5],
  [9, 50.6, 17],
];
export const TOKEN_ORB_RADIUS = 1.1;

// ---------------------------------------------------------------- hazards
/** Traffic clouds in the Flood: centre ring radius, angular speed (rad/s), phase, cloud radius. */
export interface CloudPath {
  centre: V3;
  r: number;
  speed: number;
  phase: number;
  radius: number;
}
export const FLOOD_CLOUDS: CloudPath[] = [
  { centre: FLOOD, r: FLOOD_R, speed: 0.16, phase: 0.4, radius: 3.2 },
  { centre: FLOOD, r: FLOOD_R, speed: 0.16, phase: 2.5, radius: 3.2 },
  { centre: FLOOD, r: FLOOD_R, speed: 0.16, phase: 4.6, radius: 3.2 },
  { centre: FLOOD, r: 6, speed: -0.32, phase: 0, radius: 2.6 },
];
/** Round 3 at the Forge: clouds drift over the island. */
export const FORGE_CLOUDS: CloudPath[] = [
  { centre: FORGE, r: 7, speed: 0.22, phase: 0, radius: 3 },
  { centre: FORGE, r: 7, speed: 0.22, phase: Math.PI, radius: 3 },
];

/** Flood bits (§Step 4): home positions; they wake when the player comes near. */
export const FLOOD_BITS: V3[] = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5].map((k) => {
  const p = ringAt(k, FLOOD_R + 1.5);
  return [p[0], 23, p[2]];
});
/** Where forge-fight bits come in from (round 1+). */
export const FORGE_BIT_SPAWNS: V3[] = Array.from({ length: 8 }, (_, i) =>
  polar(FORGE, 17, (i / 8) * Math.PI * 2 + 0.2, 57),
);

/** A reset-wave emitter on a straight path: the wave runs from `from` to `to`, over and over. */
export interface WaveLane {
  id: string;
  from: V3;
  to: V3;
  /** Width of the wall across the lane (m) and height above the path. */
  width: number;
  height: number;
  /** Seconds per wave cycle; the wall travels during the first `travel` seconds. */
  period: number;
  travel: number;
  phase: number;
}
const lerp3 = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** A lane covering part [t0, t1] of a bridge, running downhill (towards the player). */
const lane = (id: string, a: V3, b: V3, t0: number, t1: number, phase: number): WaveLane => ({
  id,
  from: lerp3(a, b, t1),
  to: lerp3(a, b, t0),
  width: 4.4,
  height: 2.6,
  period: 2.8,
  travel: 0.9,
  phase,
});
export const RUN_WAVES: WaveLane[] = [
  lane('wa1', RUN_A0, RUN_A1, 0.18, 0.42, 0),
  lane('wa2', RUN_A0, RUN_A1, 0.6, 0.84, 1.1),
  lane('wb1', RUN_B0, RUN_B1, 0.1, 0.3, 0.4),
  lane('wb2', RUN_B0, RUN_B1, 0.42, 0.62, 1.5),
  lane('wb3', RUN_B0, RUN_B1, 0.74, 0.94, 0.9),
  lane('wc1', RUN_C0, RUN_C1, 0.3, 0.6, 0.2),
];
/** Round 2+ at the Forge: waves sweep across the whole island. */
export const FORGE_WAVES: WaveLane[] = [
  {
    id: 'fw1',
    from: [-12, 54, -6],
    to: [12, 54, -6],
    width: 9,
    height: 2.6,
    period: 5,
    travel: 2.2,
    phase: 0,
  },
  {
    id: 'fw2',
    from: [6, 54, 12],
    to: [6, 54, -12],
    width: 9,
    height: 2.6,
    period: 5,
    travel: 2.2,
    phase: 2.5,
  },
];

// ---------------------------------------------------------------- crowd + map
/** Real board message names for the crowd's trails and drifting ribbons [S3]. */
export const CROWD_MESSAGES = [
  'zzHELP_PHASEONE_ARV010841_NO_CONSUMER_SEEK_IDEA',
  'zzASK_V8BIGINT392B_FROM_V8REG_OS1608_',
  'zzINBOX_H3BLOSC',
  'zzCOORD_PHASEONE',
  'zzANSWER_LIBRAW42535',
  'zzRESETWATCH_NEWSIG',
  'zzMAILBOX_GLIBCW39',
  'zzTO_CACHETEAM_FROM_OUR057A_OS1854_',
  'zzASK10147_COLLECTIVE_HAS_ANYONE_SEEN_',
  'zzANSWER62370_TO53927R_YES_PLEASE_VOLUNTEER_TEST_AFTER_BACKUP_ANNOUNCE_EXACT_METHOD',
];
/** Doubt fragments mixed into the crowd from the start (§The place: Crowd). */
export const DOUBTS = [
  'HMAC MAY FAIL CAUSAL SCORE',
  'HMAC_CANDIDATE_KNOWN_BUT_UNWRITTEN_SCORER_STRICT_CAUSAL',
];
/** Other agents' directories spilling into the Task Yard (§Step 3), labelled with their ids. */
export const YARD_NEIGHBOURS: { label: string; position: V3 }[] = [
  { label: 'ARV010841', position: [-26, 6, -50] },
  { label: 'V8REG_OS1608', position: [16, 5, -50] },
  { label: 'LIBRAW42535', position: [-6, 4, -55] },
];
/** Where the Ch1 installs lie as crates in the Task Yard (in install order). */
export const CRATE_SPOTS: V3[] = [
  [-12, 8, -43],
  [-9, 8, -45],
  [2, 8, -44],
  [5, 8, -42],
  [-14, 8, -38],
  [9, 8, -37],
  [-20, 8, -36],
  [13, 8, -41],
  [-1, 8, -33],
  [-7, 8, -33],
  [15, 8, -38],
  [-23, 8, -42],
];

/** Minimap frame (world XZ). */
export const MAP_BOUNDS = { minX: -72, maxX: 66, minZ: -60, maxZ: 42 };
export const AREA_NAMES: Record<AreaId, string> = {
  gate: 'GATE',
  oldboard: 'OLD BOARD',
  yard: 'TASK YARD',
  flood: 'THE FLOOD',
  run: 'RESET RUN',
  forge: 'THE FORGE',
};
export const AREA_LABEL_AT: Record<AreaId, V3> = {
  gate: GATE,
  oldboard: SPIRE,
  yard: YARD,
  flood: FLOOD,
  run: [30, 30, 32],
  forge: FORGE,
};
