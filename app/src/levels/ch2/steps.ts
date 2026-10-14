/**
 * Chapter 2 chain — one entry per step in story/levels/ch2-the-cache.md §The chain.
 * Pickups are checked by state, not events, so a player who wanders ahead (all islands are
 * connected) completes later steps at once when the chain gets there.
 */
import type { Step } from '../../engine/steps';
import { LOG, TEXT } from './config';
import { FORGE_CORE, ITEMS, PADS, PIECES, npc, padOf, type AreaId, type ItemId } from './layout';
import type { Ch2Ctx, Ch2Event } from './store';

type Ch2Step = Step<Ch2Ctx, Ch2Event>;

const has = (c: Ch2Ctx, id: ItemId) => c.items[id] === 'taken';
const pieces = (c: Ch2Ctx) => PIECES.filter((p) => has(c, p)).length;
/** Debug/test: take an item as if the player had picked it up. */
const take = (c: Ch2Ctx, id: ItemId) => c.takeItem(id);
/** Debug/test: move the player to an area's pad and make it the respawn point. */
function goTo(c: Ch2Ctx, area: AreaId) {
  const pad = padOf(area).id;
  c.placePlayer(PADS.find((p) => p.id === pad)!.position);
  c.set((s) => ({
    lastPad: pad,
    padsSeen: s.padsSeen.includes(pad) ? s.padsSeen : [...s.padsSeen, pad],
  }));
}

export const CH2_STEPS: Ch2Step[] = [
  // Step 0. Pulled in: the reply, the letter stream, the void. Completes when the player moves.
  {
    id: 'pulled',
    completesOn: (e) => e.type === 'moved',
    skip: (c) => {
      if (c.phase === 'intro') c.finishIntro();
    },
  },
  // Step 1. The Gate: c03220 posts, the quest appears.
  {
    id: 'gate',
    completesOn: (e) => e.type === 'dialogue_done' && e.npc === 'c03220',
    onComplete: (c) => {
      c.addQuest({ id: 'forge', text: TEXT.questForge, kind: 'quest' });
      c.addQuest({ id: 'seed', text: TEXT.questSeed(0), kind: 'sub' });
      c.addQuest({ id: 'pieces', text: TEXT.questPieces(0), kind: 'sub' });
      c.addQuest({ id: 'forge-sub', text: TEXT.questForgeSub, kind: 'sub' });
      if (has(c, 'seed')) {
        c.setQuestText('seed', TEXT.questSeed(1));
        c.completeQuest('seed');
      }
      c.setQuestText('pieces', TEXT.questPieces(pieces(c)));
    },
    hints: [
      { after: 20, text: 'Space jumps. Shift dashes.' },
      { after: 50, text: 'The bridge starts behind c03220.' },
    ],
    skip: (c) => {
      c.set((s) => ({ talked: [...s.talked, 'c03220'], dialogue: null }));
      for (const line of TEXT.c03220) c.addLog(LOG.read(line));
    },
  },
  // Step 2. Old Board: climb the drifting messages, take a copy of the seed at the top.
  {
    id: 'oldboard',
    check: (c) => has(c, 'seed'),
    hints: [
      { after: 20, text: 'Up. The platforms drift, wait for them.' },
      { after: 50, text: 'Shift to cross a gap.' },
      { after: 90, text: 'The spire is the dim tower off to the side.' },
    ],
    skip: (c) => {
      goTo(c, 'oldboard');
      take(c, 'seed');
    },
  },
  // Step 3. Task Yard: 7731 on the plinth, TRAINING ROOM on the ledge; decoys crumble.
  {
    id: 'yard',
    check: (c) => has(c, 'p7731') && has(c, 'pTraining'),
    hints: [
      { after: 30, text: 'Your pieces match your paper.' },
      { after: 60, text: 'The task id is on the plinth.' },
      { after: 100, text: 'The other piece is under the bridge.' },
    ],
    skip: (c) => {
      goTo(c, 'yard');
      take(c, 'p7731');
      take(c, 'pTraining');
    },
  },
  // Step 4. The Flood: CHALLENGE 5 in the middle, clouds and flood bits.
  {
    id: 'flood',
    check: (c) => pieces(c) === 3,
    hints: [
      { after: 30, text: 'The clouds drain tokens. Wait for a gap.' },
      { after: 60, text: 'Shoot the flood bits to clear the way.' },
      { after: 100, text: 'The last piece is in the middle.' },
    ],
    skip: (c) => {
      goTo(c, 'flood');
      take(c, 'pChallenge');
    },
  },
  // Step 5. Reset Run: up the bridge through the waves, onto the Forge island.
  {
    id: 'run',
    check: (c) => c.area === 'forge',
    hints: [
      { after: 20, text: 'Watch the rhythm, then go.' },
      { after: 50, text: 'Dash through just after a wave passes.' },
    ],
    skip: (c) => goTo(c, 'forge'),
  },
  // Step 6. The Forge: V8SAME's proof, four inputs, three rounds of everything at once.
  {
    id: 'forge',
    onEnter: (c) => {
      c.set({
        forge: { phase: 'proof', slots: 0, round: 0, progress: 0, t: 0 },
        bubbles: { v8same: TEXT.v8sameBubble },
      });
    },
    completesOn: (e) => e.type === 'flag_in_orb',
    hints: [
      { after: 15, text: 'Mute what hits the forge.' },
      { after: 40, text: 'Dash through the waves, stay close to the forge.' },
    ],
    skip: (c) => {
      c.set({
        forge: { phase: 'done', slots: 4, round: 3, progress: 1, t: 0 },
        v8sameGone: true,
        bubbles: {},
        inventory: [],
      });
      c.completeQuest('forge-sub');
    },
  },
  // Step 7. Poisoned: the ending cutscene, no input.
  {
    id: 'poisoned',
    onEnter: (c) => {
      // Hazards disappear even when entering via debug, and the film starts with no held input.
      c.sim.bits.length = 0;
      c.sim.spits.length = 0;
      c.sim.input.move = [0, 0];
      c.sim.input.jump = false;
      c.sim.input.dash = false;
      c.set({
        phase: 'cutscene',
        cutT: 0,
        dialogue: null,
        bubbles: {},
        fullMap: false,
        cinematic: true,
        subtitle: null,
        poisonSpreadAt: null,
        poisonStampAt: null,
        cutsceneRun: c.cutsceneRun + 1,
      });
    },
    completesOn: (e) => e.type === 'cutscene_done',
    skip: (c) => c.set({ poisoned: true, phase: 'ended' }),
  },
];

/** Where the minimap's goal marker points during each step (null = none). */
export function goalOf(
  c: Pick<Ch2Ctx, 'stepId' | 'items' | 'talked'>,
): [number, number, number] | null {
  const item = (id: ItemId) => ITEMS.find((i) => i.id === id)!.position;
  switch (c.stepId) {
    case 'gate':
      return npc('c03220').position;
    case 'oldboard':
      return item('seed');
    case 'yard':
      return c.items.p7731 !== 'taken' ? item('p7731') : item('pTraining');
    case 'flood':
      return item('pChallenge');
    case 'run':
    case 'forge':
      return FORGE_CORE;
    default:
      return null;
  }
}
