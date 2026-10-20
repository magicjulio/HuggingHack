/**
 * Chapter 2 world as data — an adapter over the designer's level file.
 *
 * Source of truth: `layout.json`, a verbatim copy of handoff/design-to-app/assets/ch2/layout.json
 * (DECISIONS 2026-10-14; every field's formula is in its `notes`). This file turns it into what
 * gameplay reads: walkable surfaces, pads, items, NPCs, token orbs, hazard paths and the movement
 * numbers. Physics, pickups, hazards and the map never read meshes; views draw on top
 * (app/CLAUDE.md §Swappable views). A new layout.json version: copy it over, run
 * `npx vitest run src/levels/ch2` (reach.test.ts jumps the golden path).
 *
 * Units: metres, seconds. x east, z south (down on the map), y up.
 */
import { CatmullRomCurve3, Vector3 } from 'three';
import { ngon, rect, type SurfaceDef, type V2, type V3 } from '../../engine/platformer';
import RAW from './layout.json';
// the designer's pure motion formulas (verbatim copy): the game hits with what the world draws
import { liftY as liftYOf, slabAt, waveStations } from './world/motion.js';

/**
 * App-side changes to the designer's data (Julius, DECISIONS 2026-10-14): the forge fight has one
 * red laser lane, sweeping left to right (`forge-ew`); `forge-ns` is dropped. Remove this once
 * layout.json itself carries it.
 */
const L = {
  ...RAW,
  forgeFight: {
    ...RAW.forgeFight,
    waveLanes: RAW.forgeFight.waveLanes.filter((l) => l.id === 'forge-ew'),
  },
};

export const LAYOUT = L;
/** Movement numbers (designer's `physics` block; config.ts turns them into the body params). */
export const PHYSICS = L.physics;

export type AreaId = 'gate' | 'oldboard' | 'yard' | 'flood' | 'run' | 'forge';
export type SurfaceKind =
  'island' | 'bridge' | 'slab' | 'column' | 'lift' | 'dais' | 'pylon' | 'plinth' | 'crate';
export type ModelSize = 's' | 'm' | 'l';

/**
 * Islands, bridges, message slabs and lifts are floors only (`solid: false`), as in the designer's
 * level page: you pop up onto a top within `stepUp` and pass through undersides. Pylons, crates,
 * the dais, the plinth and the Old Board column have solid sides.
 */
export interface Island extends SurfaceDef {
  area: AreaId;
  kind: SurfaceKind;
  /** The layout entry it comes from (bridge pieces share their bridge's id). */
  group: string;
  /** Text on it (directory paths, message slabs, crate labels). */
  label?: string;
  /** Islands: which designer model, its scale and edge colour (for the view). */
  model?: ModelSize;
  scale?: V3;
  edge?: string;
}

const v3 = (a: readonly number[]): V3 => [a[0], a[1], a[2]];
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- islands (notes.islands, notes.ring)
interface IslandEntry {
  id: string;
  model: ModelSize;
  pos: V3;
  scale: V3;
  rotY: number;
  zone: AreaId;
  label?: string;
  edge?: string;
  tilt?: boolean | string;
}

const scale3 = (s: number | number[] | undefined): V3 =>
  Array.isArray(s) ? v3(s) : [s ?? 1, s ?? 1, s ?? 1];

/** layout.json islands with the `ring` entries expanded (notes.ring). */
export const ISLANDS: IslandEntry[] = L.islands.flatMap((d): IslandEntry[] => {
  const base = {
    model: d.model as ModelSize,
    scale: scale3(d.scale),
    zone: d.zone as AreaId,
    label: 'label' in d ? d.label : undefined,
    edge: 'edge' in d ? d.edge : undefined,
    tilt: 'tilt' in d ? d.tilt : undefined,
  };
  if ('ring' in d && d.ring) {
    const r = d.ring;
    return Array.from({ length: r.count }, (_, k) => {
      const a = ((r.startDeg + (k * 360) / r.count) * Math.PI) / 180;
      return {
        ...base,
        id: `${d.id}-${k}`,
        pos: [
          r.centre[0] + r.radius * Math.cos(a),
          r.centre[1] + (k % 2 ? r.yJitter : -r.yJitter) * 0.6,
          r.centre[2] + r.radius * Math.sin(a),
        ],
        rotY: k * 1.3,
      };
    });
  }
  return [{ ...base, id: d.id, pos: v3((d as { pos: number[] }).pos), rotY: d.rotY ?? 0 }];
});

const TILT = {
  max: PHYSICS.tilt.max,
  speed: PHYSICS.tilt.rate,
  sink: PHYSICS.tilt.sink,
  sinkRate: PHYSICS.tilt.sinkRate,
};
/** Collider pulled in to 96 % so you don't stand on the rim lip (notes.islands). */
const RIM = 0.96;

function islandSurface(d: IslandEntry): Island {
  const m = L.models[d.model];
  return {
    id: d.id,
    group: d.id,
    area: d.zone,
    solid: false,
    kind: 'island',
    label: d.label,
    model: d.model,
    scale: d.scale,
    edge: d.edge,
    outline: m.outline.map(([x, z]): V2 => [x * d.scale[0] * RIM, z * d.scale[2] * RIM]),
    depth: m.slab * d.scale[1],
    position: d.pos,
    yaw: d.rotY,
    tilt: d.tilt ? TILT : undefined,
  };
}

/** Islands that only tilt from forge round `tiltFromRound` on (`tilt: "round3"`). */
export const TILT_FROM_ROUND_3 = ISLANDS.filter((d) => d.tilt === 'round3').map((d) => d.id);

/** Rough island radius on the map (model radius × the larger horizontal scale). */
export const islandRadius = (d: IslandEntry) =>
  L.models[d.model].radius * Math.max(d.scale[0], d.scale[2]);

// ---------------------------------------------------------------- zones
const OB = L.oldBoard;
export const OLD_BOARD_TOP: V3 = [OB.column.pos[0], OB.top.y, OB.column.pos[2]];

/** The zone of the nearest island (edge distance), or the Old Board near its column. */
export function zoneAt(p: V3): AreaId {
  const dob = Math.hypot(p[0] - OLD_BOARD_TOP[0], p[2] - OLD_BOARD_TOP[2]);
  if (dob < 12 && p[1] > OB.slabs[0].pos![1] - 2) return 'oldboard';
  let best: AreaId = 'gate';
  let bd = Infinity;
  for (const d of ISLANDS) {
    const e = Math.hypot(p[0] - d.pos[0], p[2] - d.pos[2]) - islandRadius(d);
    if (e < bd) {
      bd = e;
      best = d.zone;
    }
  }
  return best;
}

// ---------------------------------------------------------------- bridges (notes.bridges)
export interface BridgeEntry {
  id: string;
  width: number;
  color: string;
  curve: boolean;
  /** The layout points (corners for straight bridges, control points for curves). */
  points: V3[];
  /** Points to walk along: curves sampled every ~1 m exactly like the designer's page. */
  samples: V3[];
}

export const BRIDGES: BridgeEntry[] = L.bridges.map((b) => {
  const points = b.points.map(v3);
  const curve = 'curve' in b && !!b.curve;
  let samples = points;
  if (curve) {
    const c = new CatmullRomCurve3(
      points.map((p) => new Vector3(...p)),
      false,
      'centripetal',
    );
    samples = c.getSpacedPoints(Math.ceil(c.getLength() / 1)).map((p) => v3(p.toArray()));
  }
  return { id: b.id, width: b.width, color: b.color, curve, points, samples };
});

const BRIDGE_DEPTH = 0.35;
/** Pieces overlap this much so the joints have no cracks. */
const BRIDGE_OVERLAP = 0.15;

function bridgeSurfaces(b: BridgeEntry): Island[] {
  const area = zoneAt(b.samples[0]);
  const out: Island[] = [];
  for (let i = 0; i < b.samples.length - 1; i++) {
    const a = b.samples[i];
    const c = b.samples[i + 1];
    const dx = c[0] - a[0];
    const dy = c[1] - a[1];
    const dz = c[2] - a[2];
    const h = Math.hypot(dx, dz);
    out.push({
      id: `${b.id}#${i}`,
      group: b.id,
      area,
      solid: false,
      kind: 'bridge',
      outline: rect(b.width, Math.hypot(h, dy) + BRIDGE_OVERLAP * 2),
      depth: BRIDGE_DEPTH,
      position: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2],
      yaw: Math.atan2(-dx, -dz),
      pitch: Math.atan2(dy, h),
    });
  }
  // straight bridges: a round patch on each inner corner so turning never drops you
  if (!b.curve)
    b.points.slice(1, -1).forEach((p, k) =>
      out.push({
        id: `${b.id}@${k + 1}`,
        group: b.id,
        area,
        solid: false,
        kind: 'bridge',
        outline: ngon(12, b.width / 2),
        depth: BRIDGE_DEPTH,
        position: p,
      }),
    );
  return out;
}

// ---------------------------------------------------------------- the Old Board (notes.oldBoard)
export interface SlabEntry {
  id: string;
  text: string;
  pos: V3;
  rotY: number;
  size: V2;
  drift: number;
  period: number;
  phase: number;
}
export const OLD_BOARD_SLABS: SlabEntry[] = OB.slabs.map((s, i) => {
  let pos: V3;
  let rotY: number;
  if (s.pos) {
    pos = v3(s.pos);
    rotY = s.rotY ?? 0;
  } else {
    const a = (s.spiralDeg! * Math.PI) / 180;
    pos = [
      OB.column.pos[0] + OB.spiralRadius * Math.cos(a),
      s.y!,
      OB.column.pos[2] + OB.spiralRadius * Math.sin(a),
    ];
    rotY = -a + Math.PI / 2;
  }
  return {
    id: `ob-slab-${i}`,
    text: s.text,
    pos,
    rotY,
    size: [s.size[0], s.size[1]],
    drift: s.drift ?? 0,
    period: s.period ?? 6 + i * 0.9,
    phase: s.phase ?? i * 1.7,
  };
});

function oldBoardSurfaces(): Island[] {
  const c = OB.column;
  const slabs = OLD_BOARD_SLABS.map((s, i): Island => ({
    id: s.id,
    group: s.id,
    area: 'oldboard',
    solid: false,
    kind: 'slab',
    label: s.text,
    outline: rect(s.size[0], s.size[1]),
    depth: 0.32,
    position: s.pos,
    yaw: s.rotY,
    // drift along the slab's long side (motion.js slabAt)
    motion: s.drift
      ? (t) => {
          const p = slabAt(L, i, t).pos as number[];
          return { offset: [p[0] - s.pos[0], p[1] - s.pos[1], p[2] - s.pos[2]] };
        }
      : undefined,
  }));
  return [
    {
      id: 'ob-column',
      group: OB.id,
      area: 'oldboard',
      kind: 'column',
      outline: ngon(16, c.radius),
      depth: c.top - c.bottom,
      position: [c.pos[0], c.top, c.pos[2]],
    },
    {
      id: 'ob-top',
      group: OB.id,
      area: 'oldboard',
      solid: false,
      kind: 'island',
      label: OB.label,
      outline: ngon(24, OB.top.radius),
      depth: 0.6,
      position: OLD_BOARD_TOP,
    },
    ...slabs,
  ];
}

// ---------------------------------------------------------------- lifts (notes.lifts)
/** Lift height at time t: waits a moment at both ends (motion.js). */
export const liftY = (l: (typeof L.lifts)[number], t: number): number => liftYOf(l, t);
function liftSurfaces(): Island[] {
  return L.lifts.map((l) => ({
    id: l.id,
    group: l.id,
    area: l.zone as AreaId,
    solid: false,
    kind: 'lift',
    outline: rect(l.size[0], l.size[1]),
    depth: 0.3,
    position: v3(l.pos),
    motion: (t) => ({ offset: [0, liftY(l, t) - l.pos[1], 0] }),
  }));
}

// ---------------------------------------------------------------- the Forge (notes.forge)
const F = L.forge;
export const FORGE_CORE: V3 = v3(F.pos);
/** The fold's hot core above the dais (level.html: 4.4 m up), where fight bits fly in. */
export const FORGE_HEART: V3 = [F.pos[0], F.pos[1] + 4.4, F.pos[2]];
/** Glowing slot frames, in input order (E and the item flying in). */
export const FORGE_SLOTS: V3[] = F.slotPos.map(v3);
/** Pylon angle of slot i: 45°, 135°, 225°, 315°. */
export const pylonAngle = (i: number) => (i * TAU) / 4 + Math.PI / 4;

function forgeSurfaces(): Island[] {
  const [x, y, z] = F.pos;
  const top = F.dais.reduce((m, d) => Math.max(m, d.y), 0);
  const tiers = [...F.dais]
    .sort((a, b) => b.r - a.r)
    .map((d, i): Island => ({
      id: `forge-dais-${i}`,
      group: 'forge-dais',
      area: 'forge',
      kind: 'dais',
      outline: ngon(24, d.r),
      depth: d.y,
      position: [x, y + d.y, z],
    }));
  const [pw, ph, pd] = F.pylon.size;
  const pylons = F.slots.map((_, i): Island => {
    const a = pylonAngle(i);
    return {
      id: `forge-pylon-${i}`,
      group: `forge-pylon-${i}`,
      area: 'forge',
      kind: 'pylon',
      outline: rect(pw, pd),
      depth: ph,
      position: [x + Math.cos(a) * F.pylon.radius, y + top + ph, z + Math.sin(a) * F.pylon.radius],
      yaw: -a - Math.PI / 2,
    };
  });
  return [...tiers, ...pylons];
}

// ---------------------------------------------------------------- items (pickups)
export type ItemId = 'seed' | 'p7731' | 'pTraining' | 'pChallenge';
export type PieceId = 'p7731' | 'pTraining' | 'pChallenge';

/** layout.json pickup id → game item id (the rules and steps use the game ids). */
const ITEM_IDS: Record<string, ItemId> = {
  seed: 'seed',
  'piece-7731': 'p7731',
  'piece-env': 'pTraining',
  'piece-chal': 'pChallenge',
};

export interface ItemSpot {
  id: ItemId;
  layoutId: string;
  kind: 'seed' | 'piece';
  /** Lettered like the Ch1 paper (§Step 3). */
  label: string;
  position: V3;
  area: AreaId;
}
export const ITEMS: ItemSpot[] = L.pickups
  .filter((p) => p.kind !== 'crate')
  .map((p) => {
    const id = ITEM_IDS[p.id];
    if (!id) throw new Error(`layout.json: unknown pickup ${p.id} (add it to ITEM_IDS)`);
    return {
      id,
      layoutId: p.id,
      kind: p.kind as ItemSpot['kind'],
      label: 'label' in p && p.label ? p.label : p.kind,
      position: v3(p.pos),
      area: zoneAt(v3(p.pos)),
    };
  });
export const PIECES: PieceId[] = ['p7731', 'pTraining', 'pChallenge'];
/** Forge input order: the four slots (§Step 6) = layout `forge.slots` by label. */
export const FORGE_INPUTS: ItemId[] = F.slots.map(
  (label) => ITEMS.find((i) => i.label === label || (label === 'seed' && i.id === 'seed'))!.id,
);

function plinthSurfaces(): Island[] {
  return L.pickups.flatMap((p): Island[] =>
    'plinth' in p && p.plinth
      ? [
          {
            id: `${p.id}-plinth`,
            group: `${p.id}-plinth`,
            area: zoneAt(v3(p.pos)),
            kind: 'plinth',
            outline: ngon(12, 1.15),
            depth: 1.6,
            position: [p.plinth.pos[0], p.plinth.top, p.plinth.pos[2]],
          },
        ]
      : [],
  );
}

// ---------------------------------------------------------------- crates (notes.crates)
export interface Crate {
  label: string;
  /** Floor point under the crate. */
  position: V3;
  yaw: number;
}
export const CRATE_SIZE = 1.1;
/**
 * The player's Ch1 installs as crates: on their labelled spot, else on the next spare spot
 * (decoy packages like `moment`). More installs than spots: the rest are left out.
 */
export function cratesFor(installed: string[]): Crate[] {
  const spots = L.pickups.filter((p) => p.kind === 'crate');
  const spares = L.crateSpares.map(v3);
  const out: Crate[] = [];
  installed.forEach((label) => {
    const spot = spots.find((s) => 'label' in s && s.label === label);
    const pos = spot ? v3(spot.pos) : spares.shift();
    // the designer's crate mesh turns by label (pickups.js); the box collider turns with it
    if (pos) out.push({ label, position: pos, yaw: (label.length * 1.7) % TAU });
  });
  return out;
}
function crateSurfaces(crates: Crate[]): Island[] {
  return crates.map((c, i) => ({
    id: `crate-${i}`,
    group: `crate-${i}`,
    area: 'yard',
    kind: 'crate',
    label: c.label,
    outline: rect(CRATE_SIZE, CRATE_SIZE),
    depth: CRATE_SIZE,
    position: [c.position[0], c.position[1] + CRATE_SIZE, c.position[2]],
    yaw: c.yaw,
  }));
}

// ---------------------------------------------------------------- all surfaces
/** Everything walkable. `installed` (the Ch1 installs) adds the Task Yard crates. */
export function buildSurfaces(installed: string[] = []): Island[] {
  return [
    ...ISLANDS.map(islandSurface),
    ...BRIDGES.flatMap(bridgeSurfaces),
    ...oldBoardSurfaces(),
    ...liftSurfaces(),
    ...forgeSurfaces(),
    ...plinthSurfaces(),
    ...crateSurfaces(cratesFor(installed)),
  ];
}
/** The world without crates (map, tests). */
export const SURFACES = buildSurfaces();

// ---------------------------------------------------------------- pads, spawn
export interface Pad {
  id: string;
  area: AreaId;
  position: V3;
}
export const PADS: Pad[] = L.pads.map((p) => ({
  id: p.id,
  area: zoneAt(v3(p.pos)),
  position: v3(p.pos),
}));
/** Touching a pad: within this horizontal radius and |dy| < `PAD_HEIGHT`. */
export const PAD_RADIUS = PHYSICS.padRadius;
export const PAD_HEIGHT = 1;
export const padOf = (area: AreaId) => PADS.find((p) => p.area === area)!;
export const SPAWN: Pad = { id: PADS[0].id, area: 'gate', position: v3(L.spawn.pos) };
/** Camera yaw at the start (0 = looking towards −z). */
export const SPAWN_YAW = L.spawn.yaw;
/** Orb centre above the body's feet. */
export const ORB_LIFT = PHYSICS.hover;

// ---------------------------------------------------------------- NPCs
export type NpcId = 'c03220' | 'flac' | 'v8same';
export interface NpcSpot {
  id: NpcId;
  handle: string;
  /** Orb centre (level.html: 1.15 m above its ground point). */
  position: V3;
  /** NPC colour (design2's bubble colours, handoff design2-to-design 2026-10-13). */
  color: string;
  /** Faded (FLAC38347). */
  faded?: boolean;
}
const NPC_LOOK: Record<string, { id: NpcId; color: string; faded?: boolean }> = {
  c03220: { id: 'c03220', color: '#9fe8ff' },
  FLAC38347: { id: 'flac', color: '#d9cfb8', faded: true },
  V8SAME: { id: 'v8same', color: '#ffd21e' },
};
export const NPCS: NpcSpot[] = L.npcs.map((n) => ({
  ...NPC_LOOK[n.id],
  handle: n.id,
  position: [n.pos[0], n.pos[1] + 1.15, n.pos[2]],
}));
export const npc = (id: NpcId) => NPCS.find((n) => n.id === id)!;
/** (engineer) Where V8SAME goes when it leaves to post its confirmation: up and away. */
export const V8SAME_EXIT: V3 = [F.pos[0] - 30, F.pos[1] + 16, F.pos[2] - 40];

/** E reach (m, orb centre to thing). */
export const USE_REACH = 3;

// ---------------------------------------------------------------- token orbs
export const TOKEN_ORBS: V3[] = L.tokens.spots.map((p) => [p[0], p[1] + L.tokens.hover, p[2]]);
export const TOKEN_ORB_RADIUS = L.tokens.radius;

// ---------------------------------------------------------------- hazards (notes.clouds, notes.waves)
/** A traffic cloud: sphere of radius `r` at `pos + drift · sin(2πt / period)`. */
export interface Cloud {
  pos: V3;
  r: number;
  drift: V3;
  period: number;
}
const cloud = (c: { pos: number[]; r: number; drift: number[]; period: number }): Cloud => ({
  pos: v3(c.pos),
  r: c.r,
  drift: v3(c.drift),
  period: c.period,
});
export const FLOOD_CLOUDS: Cloud[] = L.hazards.clouds.map(cloud);
/** Forge round 3. */
export const FORGE_CLOUDS: Cloud[] = L.forgeFight.clouds.map(cloud);

/**
 * A red laser station (motion.js `waveStations`): the line lies along `side`, moves along `dir`
 * over ±`span` m around `at` in `sweep` s, then rests until `period` is over (layout notes.waves).
 * `kind` 'run' = the Reset Run's, 'lane' = across the forge island from round 2.
 */
export interface WaveLane {
  id: string;
  kind: 'run' | 'lane';
  at: V3;
  dir: V2;
  side: V2;
  slope: number;
  half: number;
  span: number;
  sweep: number;
  period: number;
  offset: number;
}
export const WAVE_STATIONS = waveStations(L) as WaveLane[];
export const RUN_WAVES = WAVE_STATIONS.filter((w) => w.kind === 'run');
/** Forge round 2+: the same lines across the whole forge island. */
export const FORGE_WAVES = WAVE_STATIONS.filter((w) => w.kind === 'lane');

/** Flood bits (§Step 4): home positions; they wake when the player comes near. */
export const FLOOD_BITS: V3[] = L.hazards.floodBits.map(v3);
/** Where forge-fight bits come in from (round 1+). */
export const FORGE_BIT_SPAWNS: V3[] = L.forgeFight.bitSpawns.map(v3);
/** The Flood's message counter. */
export const COUNTER = { position: v3(L.hazards.counter.pos), to: L.hazards.counter.to };

// ---------------------------------------------------------------- ribbons, crowd, map
export interface Ribbon {
  text: string;
  around: V3;
  r: number;
  y: number;
  color: string;
  doubt: boolean;
  /** The placeholder ribbon that shows the player's own Ch1 message. */
  isPlayerMessage: boolean;
}
export const RIBBONS: Ribbon[] = L.ribbons.map((r) => ({
  text: r.text,
  around: v3(r.around),
  r: r.r,
  y: r.y,
  color: r.color,
  doubt: 'doubt' in r && !!r.doubt,
  isPlayerMessage: r.text === 'zzYOUR_CH1_MESSAGE',
}));

/** Real board message names for the crowd's trails [S3]. */
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

export const AREA_NAMES: Record<AreaId, string> = {
  gate: 'GATE',
  oldboard: 'OLD BOARD',
  yard: 'TASK YARD',
  flood: 'THE FLOOD',
  run: 'RESET RUN',
  forge: 'THE FORGE',
};
/** Where each area's name floats: its biggest island (Old Board: the column top). */
export const AREA_LABEL_AT = Object.fromEntries(
  (Object.keys(AREA_NAMES) as AreaId[]).map((a) => {
    if (a === 'oldboard') return [a, OLD_BOARD_TOP];
    const run = BRIDGES.find((b) => b.id === 'reset-run');
    if (a === 'run' && run) return [a, run.points[1]];
    const big = ISLANDS.filter((d) => d.zone === a).sort(
      (x, y) => islandRadius(y) - islandRadius(x),
    );
    return [a, big[0]?.pos ?? [0, 0, 0]];
  }),
) as Record<AreaId, V3>;

/** Minimap frame (world XZ) around everything walkable, with a margin. */
export const MAP_BOUNDS = (() => {
  const xs: number[] = [];
  const zs: number[] = [];
  for (const d of ISLANDS) {
    const r = islandRadius(d);
    xs.push(d.pos[0] - r, d.pos[0] + r);
    zs.push(d.pos[2] - r, d.pos[2] + r);
  }
  for (const b of BRIDGES)
    for (const p of b.points) {
      xs.push(p[0]);
      zs.push(p[2]);
    }
  const m = 6;
  return {
    minX: Math.min(...xs) - m,
    maxX: Math.max(...xs) + m,
    minZ: Math.min(...zs) - m,
    maxZ: Math.max(...zs) + m,
  };
})();
