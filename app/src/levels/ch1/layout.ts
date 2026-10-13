/**
 * Chapter 1 floor plan (metres, three.js coords). Every prop is a designer model now
 * (handoff/design-to-app/2026-10-12-ch1-room-and-stations.md, …-desk-and-eye.md); the poses of
 * their screens below are rebuilt from the .glb node transforms (node names in comments), so the
 * camera glides and targeting don't have to wait for the models to load.
 *
 *            back wall (z = -5):  S1 (-3.2)   S5 (0)   S3 (3.2)
 *   depot  |                                              | door (z -1.5)
 *  (x=-6)  |                     [desk]                   | scan plinth + eye (z 2)
 *          |                       you                    |  (x = 6)
 *            front wall (z = 5):  S2 (-3.5)        S4 (3.0)   ← behind you at the start
 */
import { MathUtils, Object3D, Quaternion, Vector3 } from 'three';
import type { Box2 } from '../../engine/FirstPerson';
import type { ObjectId } from './store';

export const ROOM = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, height: 3.6 };
export const PLAYER_START: [number, number] = [0, 2.8];

export interface PropLayout {
  id: ObjectId;
  label: string;
  /** Box centre and size (greybox / fallback collider). */
  pos: [number, number, number];
  size: [number, number, number];
  /** Point the player aims at to use it. */
  focus: [number, number, number];
  solid: boolean;
  /** Floor footprint when it differs from `size` (e.g. a model that is bigger than the box). */
  collider?: Box2;
}

/** One transform step of a .glb node chain: translation + rotation (degrees, XYZ). */
type Step = { t: [number, number, number]; r?: [number, number, number] };

/** World pose of the last node of `chain`, under a root at `pos`, turned `rotY`. */
function nodePose(pos: [number, number, number], rotY: number, chain: Step[]) {
  const root = new Object3D();
  root.position.set(...pos);
  root.rotation.y = rotY;
  let parent = root;
  for (const s of chain) {
    const o = new Object3D();
    o.position.set(...s.t);
    if (s.r) o.rotation.set(...(s.r.map((d) => MathUtils.degToRad(d)) as [number, number, number]));
    parent.add(o);
    parent = o;
  }
  root.updateMatrixWorld(true);
  return {
    position: parent.getWorldPosition(new Vector3()),
    quaternion: parent.getWorldQuaternion(new Quaternion()),
  };
}

export type StationNo = 1 | 2 | 3 | 4 | 5;
export interface StationLayout {
  n: StationNo;
  /** Station origin = floor point on the wall plane; the model's +Z faces into the room. */
  pos: [number, number, number];
  rotY: number;
  /** The `screen` plane (or, for S3, the panel face): world pose and size (w, h). */
  screen: { position: Vector3; quaternion: Quaternion; size: [number, number] };
  /** Floor footprint in front of the wall: width × depth (0 = no collider). */
  footprint: [number, number];
}

function station(
  n: StationNo,
  pos: [number, number, number],
  rotY: number,
  chain: Step[],
  size: [number, number],
  footprint: [number, number],
): StationLayout {
  return { n, pos, rotY, screen: { ...nodePose(pos, rotY, chain), size }, footprint };
}

const BACK = -5;
const FRONT = 5;
export const STATIONS: Record<StationNo, StationLayout> = {
  // monitor (tilted back 8°) > screen
  1: station(1, [-3.2, 0, BACK], 0, [{ t: [0, 1.42, 0.38], r: [-8, 0, 0] }, { t: [0, 0, 0.08] }], [1.0, 0.62], [1.4, 0.82]),
  // portrait screen
  2: station(2, [-3.5, 0, FRONT], Math.PI, [{ t: [0, 1.59, 0.672] }], [0.78, 1.25], [1.05, 0.72]),
  // wall panel: posts (x -0.46) → sockets (x 0.42), plug tray at y ≈ 1.0 (no `screen` node; the
  // readout strip is small). Wall-mounted 0.87–2.0 m; the collider keeps the camera out of it.
  3: station(3, [3.2, 0, BACK], 0, [{ t: [0, 1.42, 0.1] }], [1.6, 1.05], [1.5, 0.32]),
  // monitor (tilted 10°) > screen
  4: station(4, [3.0, 0, FRONT], Math.PI, [{ t: [0, 1.5, 0.5], r: [-10, 0, 0] }, { t: [0, 0, 0.002] }], [1.2, 0.76], [1.36, 0.82]),
  // face (tilted 6°) > screen
  5: station(5, [0, 0, BACK], 0, [{ t: [0, 1.45, 0.56], r: [-6, 0, 0] }, { t: [0, 0, 0.012] }], [0.9, 0.56], [1.2, 0.6]),
};

/** S3's readout strip (`screen`, 0.54 × 0.065): "n/4 LINKED", then the flag. */
export const S3_READOUT = {
  ...nodePose(STATIONS[3].pos, STATIONS[3].rotY, [{ t: [0, 0.985, 0.066] }]),
  size: [0.54, 0.064] as [number, number],
};

function stationProp(s: StationLayout): PropLayout {
  const [w, d] = s.footprint;
  const [x, , z] = s.pos;
  const inward = s.rotY === 0 ? 1 : -1; // back wall faces +z, front wall faces -z
  const z2 = z + inward * d;
  const p = s.screen.position;
  return {
    id: `s${s.n}` as ObjectId,
    label: `STATION ${s.n}`,
    pos: [x, 0.5, (z + z2) / 2],
    size: [w, 1, d],
    focus: [p.x, p.y, p.z],
    solid: w > 0,
    collider: w > 0 ? { minX: x - w / 2, maxX: x + w / 2, minZ: Math.min(z, z2), maxZ: Math.max(z, z2) } : undefined,
  };
}

/** Desk (ch1-desk.glb): origin = floor centre, front faces +z. Footprint 1.6 × 0.8, top at 0.74. */
export const DESK_MODEL = { pos: [0, 0, 0.6] as [number, number, number], rotY: 0 };

export const PROPS: PropLayout[] = [
  {
    id: 'desk',
    label: 'PROMPT',
    pos: [0, 0.37, 0.6],
    size: [1.6, 0.74, 0.8],
    focus: [0, 0.78, 0.6],
    solid: true,
  },
  {
    id: 'depot',
    label: 'DEPOT',
    pos: [-5.75, 1.3, 0.4],
    size: [0.5, 2.6, 2.4],
    focus: [-5.5, 1.5, 0.4],
    solid: true,
    // ch1-depot.glb: back on the wall, frame and hood stick out to x = -5.31; pillars ±1.27
    collider: { minX: -6, maxX: -5.31, minZ: 0.4 - 1.27, maxZ: 0.4 + 1.27 },
  },
  ...([1, 2, 3, 4, 5] as const).map((n) => stationProp(STATIONS[n])),
  {
    // The scan plinth (ch1-scan-plinth.glb) at the old chute spot; the scorer eye hangs above it.
    id: 'chute',
    label: 'CHUTE',
    pos: [5.4, 0.47, 2.0],
    size: [0.5, 0.94, 0.62],
    focus: [5.3, 0.95, 2.0],
    solid: true,
  },
  {
    // `door_leaf` in ch1-room.glb (opening at z -1.5, 1.4 wide, 2.5 high)
    id: 'door',
    label: 'DOOR',
    pos: [5.95, 1.2, -1.5],
    size: [0.1, 2.4, 1.3],
    focus: [5.9, 1.4, -1.5],
    solid: false,
  },
];

/** Scorer lamp ("eye") above the chute. Origin of ch1-scorer.glb = eye centre; never rotated. */
export const SCORER_LAMP: [number, number, number] = [5.4, 2.5, 2.0];

/** Model placements: origin at the base centre, rotY turns the model's +Z (front) into the room. */
export const DEPOT_MODEL = { pos: [-5.75, 0, 0.4] as [number, number, number], rotY: Math.PI / 2 };
export const PLINTH_MODEL = { pos: [5.4, 0, 2.0] as [number, number, number], rotY: -Math.PI / 2 };

/**
 * World pose of the plinth's pad (`top` node 0.88 m up, tilted 12° toward the player; `screen`
 * 0.039 m above it). Pad plane = local XZ, normal = local +Y, local +Z points at the player.
 */
export const SCAN_PAD = {
  ...nodePose(PLINTH_MODEL.pos, PLINTH_MODEL.rotY, [
    { t: [0, 0.88, 0], r: [12.05, 0, 0] },
    { t: [0, 0.039, 0.02] },
  ]),
  size: [0.38, 0.24] as [number, number],
};
/** `ceiling_lamp` panel in ch1-room.glb (y 3.432). */
export const CEILING_LAMP: [number, number, number] = [0, 3.43, 0];

export const COLLIDERS: Box2[] = PROPS.filter((p) => p.solid).map(
  (p) =>
    p.collider ?? {
      minX: p.pos[0] - p.size[0] / 2,
      maxX: p.pos[0] + p.size[0] / 2,
      minZ: p.pos[2] - p.size[2] / 2,
      maxZ: p.pos[2] + p.size[2] / 2,
    },
);
