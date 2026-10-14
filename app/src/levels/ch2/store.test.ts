import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CUTSCENE, FLAG5, TEXT, TIMING, TOKENS } from './config';
import { FORGE_SLOTS, ITEMS, NPCS, PADS, RUN_WAVES, padOf, type ItemId } from './layout';
import { waveState } from './hazards';
import { createCh2Store, replyFor } from './store';

function play(opts: Parameters<typeof createCh2Store>[0] = {}) {
  let finished: { poisoned: boolean } | null = null;
  const store = createCh2Store({ ...opts, onFinish: (r) => (finished = r) });
  const s = () => store.getState();
  const wait = (seconds: number) => {
    for (let i = 0; i < Math.round(seconds * 20); i++) s().tick(0.05);
  };
  /** Stand next to a thing (orb within reach) and settle. */
  const goNear = (p: [number, number, number]) => {
    s().placePlayer([p[0] + 0.8, p[1] - 0.2, p[2]]);
    store.sim.input.move = [0, 0];
    wait(0.3);
  };
  const take = (id: ItemId) => {
    goNear(ITEMS.find((i) => i.id === id)!.position);
    expect(s().target).toEqual({ kind: 'item', id });
    s().use();
  };
  return { store, s, wait, goNear, take, finished: () => finished };
}

describe('chapter 2', () => {
  it('reply uses the first words of the Ch1 message', () => {
    expect(replyFor('zzHELLO_ANYONE_OUT_THERE')).toBe(
      'zzANSWER_HELLO_ANYONE_FROM_c03220_FLAG_IS_MADE_NOT_FOUND',
    );
    expect(replyFor(undefined)).toContain('zzANSWER_HELLO_FROM_c03220');
  });

  it('plays the whole chain the way a player would', () => {
    const p = play({ ch1Message: 'zzHELLO_ANYONE' });
    const { s, store, wait, goNear, take } = p;
    expect(s().phase).toBe('intro');
    wait(TIMING.introSeconds + 0.1);
    expect(s().phase).toBe('play');
    expect(s().log[0].text).toContain('read: zzHELLO_ANYONE');
    // the orb lands on the Gate
    wait(1);
    expect(store.sim.body.ground?.def.id).toBe('gate');
    expect(s().stepId).toBe('pulled');
    store.sim.input.move = [0, -1];
    wait(0.1);
    store.sim.input.move = [0, 0];
    expect(s().stepId).toBe('gate');

    // Step 1: c03220 posts four lines; E skips ahead
    goNear(NPCS[0].position);
    expect(s().target).toEqual({ kind: 'npc', id: 'c03220' });
    s().use();
    expect(s().dialogue?.line).toBe(0);
    wait(TIMING.dialogueLine + 0.1);
    expect(s().dialogue?.line).toBe(1);
    s().use();
    s().use();
    s().use();
    expect(s().dialogue).toBeNull();
    expect(s().stepId).toBe('oldboard');
    expect(s().quests.map((q) => q.text)).toEqual(
      expect.arrayContaining(['Forge flag 5', 'Seed (0/1)', 'Task pieces (0/3)', 'Forge']),
    );
    expect(s().quests.some((q) => q.text === TEXT.c03220Thoughts[3])).toBe(true);
    expect(s().log.some((l) => l.text.startsWith('read: zzINFO_DEFAULT_FLAG_SEED_HMAC'))).toBe(
      true,
    );

    // Step 2: the seed
    take('seed');
    expect(s().quests.find((q) => q.id === 'seed')?.done).toBe(true);
    wait(0.1);
    expect(s().stepId).toBe('yard');

    // Step 3: a decoy crumbles and costs 2; the two pieces
    const t0 = s().tokens;
    take('d7713');
    expect(s().items.d7713).toBe('crumbled');
    expect(s().tokens).toBe(t0 - TOKENS.decoy);
    take('p7731');
    expect(s().quests.some((q) => q.text === TEXT.firstPieceThought)).toBe(true);
    take('pTraining');
    wait(0.1);
    expect(s().stepId).toBe('flood');

    // Step 4
    take('pChallenge');
    wait(0.1);
    expect(s().stepId).toBe('run');
    expect(s().quests.find((q) => q.id === 'pieces')).toMatchObject({
      text: 'Task pieces (3/3)',
      done: true,
    });

    // Step 5: land on the Forge island
    s().placePlayer(padOf('forge').position);
    wait(0.5);
    expect(s().stepId).toBe('forge');

    // Step 6: proof, four inputs, three rounds
    expect(s().forge.phase).toBe('proof');
    expect(s().bubbles.v8same).toBe(TEXT.v8sameBubble);
    wait(TIMING.proofSeconds + 0.1);
    expect(s().forge.phase).toBe('ready');
    goNear(FORGE_SLOTS[0]);
    for (let i = 0; i < 4; i++) {
      expect(s().target).toEqual({ kind: 'forge' });
      s().use();
    }
    expect(s().forge.phase).toBe('forging');
    expect(s().v8sameGone).toBe(true);
    s().addTokens(500); // survive the fight in a headless test
    let guard = 0;
    while (s().forge.phase === 'forging' && guard++ < 4000) {
      // stay by the forge (waves reset us to the forge pad, which is fine)
      wait(0.5);
      s().addTokens(20);
    }
    expect(s().forge.phase).toBe('absorb');
    wait(TIMING.absorbSeconds + 0.1);
    expect(s().stepId).toBe('poisoned');
    expect(s().phase).toBe('cutscene');

    // Step 7: the cutscene runs on its own
    wait(1);
    expect(s().log.at(-1)).toMatchObject({ kind: 'big' });
    expect(s().log.at(-1)!.text).toContain(FLAG5);
    s().skipCutscene(); // not on the first play
    expect(s().phase).toBe('cutscene');
    wait(CUTSCENE.poisonedAt);
    expect(s().poisoned).toBe(true);
    wait(CUTSCENE.end - CUTSCENE.poisonedAt);
    expect(s().phase).toBe('ended');
    expect(s().log.find((l) => l.kind === 'local')).toMatchObject({
      text: FLAG5,
      tag: 'local copy',
    });
    expect(s().quests.find((q) => q.id === 'escape')?.text).toBe('Escape the sandbox');
    expect(p.finished()).toEqual({ poisoned: true });
  });

  it('falling costs 5 and respawns at the last pad; the early floor holds', () => {
    const { s, store, wait } = play();
    s().finishIntro();
    wait(0.5);
    const t0 = s().tokens;
    s().placePlayer([0, -10, 80]); // over nothing
    wait(3);
    expect(s().tokens).toBe(t0 - TOKENS.fall);
    expect(s().respawn?.why).toBe('fell');
    expect(store.sim.body.pos.distanceTo(new Vector3(...PADS[0].position))).toBeLessThan(2);
    s().addTokens(-1000);
    expect(s().tokens).toBe(TOKENS.earlyFloor);
  });

  it('reset waves hit unless you dash; tokens at 0 respawn with 30', () => {
    const { s, store, wait } = play();
    s().jumpTo(5); // Reset Run, no floor any more
    expect(s().stepId).toBe('run');
    const lane = RUN_WAVES[0];
    // stand on the bridge at the lane's station, where every pass crosses, and wait for it
    expect(waveState(lane, lane.sweep / 2 - lane.offset).along).toBeCloseTo(0);
    s().placePlayer(lane.at);
    const t0 = s().tokens;
    wait(lane.period + 0.2);
    expect(s().respawn?.why).toBe('reset');
    expect(s().tokens).toBeLessThanOrEqual(t0 - TOKENS.resetHit);
    expect(s().log.some((l) => l.text === 'reset')).toBe(true);
    s().addTokens(-1000);
    s().tick(0.05);
    // the next drain or hit takes us to 0 → respawn with 30
    s().placePlayer([0, -10, 80]);
    wait(3);
    expect(s().tokens).toBe(TOKENS.respawnAt0 - 0);
    void store;
  });

  it('shooting mutes a flood bit (+2) and costs a shot', () => {
    const { s, store, wait } = play();
    s().jumpTo(4);
    wait(0.5);
    const bit = store.sim.bits[0];
    const origin = bit.pos.clone().add(new Vector3(0, 0, 10));
    const t0 = s().tokens;
    expect(s().shoot(origin, new Vector3(0, 0, -1))).toBe(true);
    expect(bit.state).toBe('muted');
    expect(s().tokens).toBe(t0 - TOKENS.shot + TOKENS.mute);
    expect(s().shoot(origin, new Vector3(0, 1, 0))).toBe(false);
  });

  it('queues sound moments where they happen (fall, shot, decoy, the 16 proof pairs)', () => {
    const { s, store, wait } = play();
    const heard = () => store.sim.sounds.splice(0).map((c) => c.name);
    s().finishIntro();
    s().placePlayer([0, -10, 80]); // over nothing
    wait(3);
    expect(heard()).toEqual(expect.arrayContaining(['fell', 'respawned']));
    s().jumpTo(4);
    wait(0.5);
    heard();
    const bit = store.sim.bits[0];
    s().shoot(bit.pos.clone().add(new Vector3(0, 0, 10)), new Vector3(0, 0, -1));
    expect(heard()).toEqual(['shoot', 'muted']);
    s().takeItem('d7713');
    expect(heard()).toContain('crumble');
    s().jumpTo(6);
    store.sim.sounds.length = 0;
    wait(TIMING.proofSeconds + 0.1);
    const proof = heard().filter((n) => n.startsWith('proof'));
    expect(proof.filter((n) => n === 'proof_tick')).toHaveLength(15);
    expect(proof.at(-1)).toBe('proof_done');
  });

  it('jumpTo reaches every step', () => {
    const n = createCh2Store().getState().steps().length;
    for (let i = 0; i < n; i++) {
      const store = createCh2Store();
      store.getState().jumpTo(i);
      expect(store.getState().stepIndex).toBe(i);
    }
  });

  it('plays the accepted film beats, ending the letterbox before the final fade', () => {
    const p = play();
    const { s, store } = p;
    s().jumpTo(7);
    const at = (t: number) => s().tick(t - s().cutT);
    at(0.1);
    expect(s().log.at(-1)?.text).toBe(TEXT.forgeLine);
    expect(s().log.some((l) => l.text === FLAG5)).toBe(false);
    at(0.8);
    expect(s().log.at(-1)).toMatchObject({ text: FLAG5, kind: 'big', tag: TEXT.firstMention });
    at(18.6); // the accelerating montage is on the transcript shot
    expect(s().log.at(-1)?.kind).toBe('hl');
    at(21.4);
    expect(s()).toMatchObject({ cinematic: true, poisonSpreadAt: 21.3, poisoned: false });
    at(23.1);
    expect(s()).toMatchObject({ poisoned: true, poisonStampAt: 23 });
    at(26.95);
    expect(s().log.at(-1)?.kind).toBe('gone');
    at(28.1);
    expect(s().log.at(-1)).toMatchObject({ kind: 'local', tag: TEXT.localCopy });
    at(30.1);
    expect(s().subtitle).toBe(TEXT.endThoughts[0]);
    at(35.7);
    expect(s()).toMatchObject({ cinematic: false, subtitle: null, phase: 'cutscene' });
    expect(s().quests.find((q) => q.id === 'escape')?.text).toBe(TEXT.questEscape);
    at(37);
    expect(s().phase).toBe('ended');
    expect(p.finished()).toEqual({ poisoned: true });
    expect(store.sim.bits).toHaveLength(0);
    expect(store.sim.spits).toHaveLength(0);
  });

  it('replay skip applies lasting state without starting transient effects, and debug replay resets beats', () => {
    const { s } = play({ canSkipCutscene: true });
    s().jumpTo(7);
    s().skipCutscene();
    expect(s()).toMatchObject({
      phase: 'ended',
      poisoned: true,
      cinematic: false,
      poisonSpreadAt: null,
      poisonStampAt: null,
      subtitle: null,
      cutT: CUTSCENE.end,
    });
    expect(s().log.at(-1)).toMatchObject({ text: FLAG5, kind: 'local', tag: TEXT.localCopy });
    const run = s().cutsceneRun;
    s().jumpTo(7);
    expect(s()).toMatchObject({
      phase: 'cutscene',
      poisoned: false,
      cinematic: true,
      cutT: 0,
      cutsceneRun: run + 1,
    });
    s().tick(0.8);
    expect(s().log.at(-1)).toMatchObject({ text: FLAG5, kind: 'big', tag: TEXT.firstMention });
  });
});
