/**
 * The bridge between the 3D view and the DOM HUD: `ScreenProjector` (inside the Canvas) writes
 * screen points every frame into `SCREEN`; HUD parts read them in their own rAF (the bubble's
 * pin, the pickup sparks). Nothing here goes through React state.
 */
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useCh2Store } from '../context';
import { TEXT } from '../config';
import { ORB_LIFT, npc, type NpcId } from '../layout';
import type { Ch2State } from '../store';

/** View-owned animated centres; gameplay continues to use layout positions. */
export const NPC_CENTRES = new Map<NpcId, Vector3>();

/** Screen pixels (relative to the game screen). */
export const SCREEN = {
  orb: { x: 0, y: 0 },
  /** The speaking agent's bubble anchor; `on` = in front of the camera and near enough. */
  bubble: { x: 0, y: 0, on: false },
};

/** The bubble anchor sits 2.1 m above the agent's orb (designer: `bubble_anchor`). */
const ANCHOR_UP = 2.1;
/** Farther than this the bubble is hidden (m). */
const BUBBLE_RANGE = 60;

export interface Speech {
  npc: NpcId;
  text: string;
  /** Post i of n (c03220's dialogue). */
  i: number;
  n: number;
  /** E advances it (c03220's dialogue); other posts just stand. */
  dialogue: boolean;
}

/** Who is posting what right now: c03220's dialogue > a posted bubble > FLAC38347 on the board. */
export function speechOf(
  s: Pick<Ch2State, 'bubbles' | 'area' | 'stepId'> & {
    line: number | null;
  },
): Speech | null {
  if (s.line !== null)
    return {
      npc: 'c03220',
      text: TEXT.c03220[s.line],
      i: s.line + 1,
      n: TEXT.c03220.length,
      dialogue: true,
    };
  for (const id of ['v8same', 'flac', 'c03220'] as NpcId[]) {
    const text = s.bubbles[id];
    if (text) return { npc: id, text, i: 1, n: 1, dialogue: false };
  }
  if (s.area === 'oldboard' || s.stepId === 'oldboard')
    return { npc: 'flac', text: TEXT.flacPost, i: 1, n: 1, dialogue: false };
  return null;
}
/** Speech from the full state (dialogue only counts while it is c03220's). */
export const speechOfState = (s: Ch2State) =>
  speechOf({ ...s, line: s.dialogue?.npc === 'c03220' ? s.dialogue.line : null });

export function ScreenProjector() {
  const store = useCh2Store();
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const b = store.sim.body.pos;
    v.set(b.x, b.y + ORB_LIFT, b.z).project(camera);
    SCREEN.orb.x = ((v.x + 1) / 2) * size.width;
    SCREEN.orb.y = ((1 - v.y) / 2) * size.height;
    const sp = speechOfState(store.getState());
    if (!sp) {
      SCREEN.bubble.on = false;
      return;
    }
    const p = npc(sp.npc).position;
    v.copy(NPC_CENTRES.get(sp.npc) ?? v.set(...p));
    v.y += ANCHOR_UP;
    const far = camera.position.distanceTo(v) > BUBBLE_RANGE;
    v.project(camera);
    SCREEN.bubble.on = !far && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    SCREEN.bubble.x = ((v.x + 1) / 2) * size.width;
    SCREEN.bubble.y = ((1 - v.y) / 2) * size.height;
  });
  return null;
}
