/**
 * Chapter 1 floor plan (metres). PLACEHOLDER greybox: replaced by the designer's room shell
 * (.glb) and props later; keep the object ids and rough positions so gameplay stays the same.
 *
 *            back wall (z = -5): stations 1-5
 *   depot  |                                  | door
 *  (x=-6)  |            [desk]                | chute + scorer lamp
 *          |              you                 |  (x = 6)
 *            front wall (z = 5)
 */
import { MathUtils, Object3D, Quaternion, Vector3 } from 'three';
import type { Box2 } from '../../engine/FirstPerson';
import type { ObjectId } from './store';

export const ROOM = { minX: -6, maxX: 6, minZ: -5, maxZ: 5, height: 3.6 };
export const PLAYER_START: [number, number] = [0, 2.8];

export interface PropLayout {
  id: ObjectId;
  label: string;
  /** Box centre and size. */
  pos: [number, number, number];
  size: [number, number, number];
  /** Point the player aims at to use it. */
  focus: [number, number, number];
  /** Optional glowing face (screen/panel): centre, size, and facing rotation (y radians). */
  screen?: { pos: [number, number, number]; size: [number, number]; rotY: number };
  solid: boolean;
  /** Floor footprint when it differs from `size` (e.g. a model that is bigger than the box). */
  collider?: Box2;
  /** A designer model replaces the greybox (see models.tsx); the floating label is hidden. */
  model?: boolean;
}

const station = (n: 1 | 2 | 3 | 4 | 5, x: number): PropLayout => ({
  id: `s${n}` as ObjectId,
  label: `STATION ${n}`,
  pos: [x, 0.55, -4.45],
  size: [1.2, 1.1, 0.8],
  focus: [x, 1.55, -4.6],
  screen: { pos: [x, 1.6, -4.62], size: [1.1, 0.7], rotY: 0 },
  solid: true,
});

export const PROPS: PropLayout[] = [
  {
    id: 'desk',
    label: 'PROMPT',
    pos: [0, 0.37, 0.6],
    size: [1.6, 0.74, 0.8],
    focus: [0, 0.78, 0.6],
    screen: { pos: [0, 0.76, 0.6], size: [0.42, 0.3], rotY: 0 }, // the paper (lies flat, see Room)
    solid: true,
  },
  {
    id: 'depot',
    label: 'DEPOT',
    pos: [-5.75, 1.3, 0.4],
    size: [0.5, 2.6, 2.4],
    focus: [-5.5, 1.5, 0.4],
    screen: { pos: [-5.49, 1.5, 0.4], size: [2.0, 1.8], rotY: Math.PI / 2 },
    solid: true,
    // ch1-depot.glb: back on the wall, frame and hood stick out to x = -5.31; pillars ±1.27
    collider: { minX: -6, maxX: -5.31, minZ: 0.4 - 1.27, maxZ: 0.4 + 1.27 },
    model: true,
  },
  station(1, -4),
  station(2, -2),
  station(3, 0),
  station(4, 2),
  station(5, 4),
  {
    // The scan plinth (ch1-scan-plinth.glb) stands where the chute box was; the scorer eye floats
    // above it. PLACEHOLDER placement: plinth vs chute is open for the storyteller.
    id: 'chute',
    label: 'CHUTE',
    pos: [5.4, 0.47, 2.0],
    size: [0.5, 0.94, 0.62],
    focus: [5.3, 0.95, 2.0],
    solid: true,
    model: true,
  },
  {
    id: 'door',
    label: 'DOOR',
    pos: [5.95, 1.2, -1.5],
    size: [0.1, 2.4, 1.3],
    focus: [5.9, 1.4, -1.5],
    solid: false,
  },
];

/** Scorer lamp ("eye") above the chute. Origin of ch1-scorer.glb = eye centre. */
export const SCORER_LAMP: [number, number, number] = [5.4, 2.5, 2.0];

/** Model placements: origin at the base centre, rotY turns the model's +Z (front) into the room. */
export const DEPOT_MODEL = { pos: [-5.75, 0, 0.4] as [number, number, number], rotY: Math.PI / 2 };
export const PLINTH_MODEL = { pos: [5.4, 0, 2.0] as [number, number, number], rotY: -Math.PI / 2 };

/**
 * World pose of the plinth's pad (`top` node 0.88 m up, tilted 12° toward the player; `screen`
 * 0.039 m above it). Pad plane = local XZ, normal = local +Y, local +Z points at the player.
 */
export const SCAN_PAD = (() => {
  const root = new Object3D();
  root.position.set(...PLINTH_MODEL.pos);
  root.rotation.y = PLINTH_MODEL.rotY;
  const top = new Object3D();
  top.position.set(0, 0.88, 0);
  top.rotation.x = MathUtils.degToRad(12.05);
  const pad = new Object3D();
  pad.position.set(0, 0.039, 0.02);
  root.add(top);
  top.add(pad);
  root.updateMatrixWorld(true);
  return {
    position: pad.getWorldPosition(new Vector3()),
    quaternion: pad.getWorldQuaternion(new Quaternion()),
    size: [0.38, 0.24] as [number, number],
  };
})();
export const CEILING_LAMP: [number, number, number] = [0, ROOM.height - 0.05, 0];

export const COLLIDERS: Box2[] = PROPS.filter((p) => p.solid).map(
  (p) =>
    p.collider ?? {
      minX: p.pos[0] - p.size[0] / 2,
      maxX: p.pos[0] + p.size[0] / 2,
      minZ: p.pos[2] - p.size[2] / 2,
      maxZ: p.pos[2] + p.size[2] / 2,
    },
);
