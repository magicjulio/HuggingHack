/**
 * Chapter 1 chain — one entry per step in story/levels/ch1-the-room.md §The chain.
 * To insert a beat: add a step here (and its station/window if it needs one). Order = play order.
 */
import type { Step } from '../../engine/steps';
import { BUG_TOTAL, PACKAGES, S1_CHUNKS, WIRES, decodeBase64 } from './content';
import { TEXT, TIMING, type FlagNo } from './config';
import type { Ch1Ctx, Ch1Event } from './store';

type Ch1Step = Step<Ch1Ctx, Ch1Event>;

/** Debug/test helper: capture flag n as if the player had submitted it. */
function captureFlag(c: Ch1Ctx, n: FlagNo) {
  if (!c.captured.includes(n)) c.set((s) => ({ captured: [...s.captured, n] }));
  c.setQuestText('flags', TEXT.questFlags(c.get().captured.length));
}
function installNow(c: Ch1Ctx, name: string) {
  if (!c.installed.includes(name)) c.set((s) => ({ installed: [...s.installed, name] }));
}

/** A station step: light the station, list its tool, complete when its flag is captured. */
function flagStep(n: FlagNo, pkg: string, extra: Partial<Ch1Step> = {}): Ch1Step {
  const station = `s${n}` as const;
  return {
    id: `flag${n}`,
    onEnter: (c) => {
      c.setObjects({ [station]: 'active' });
      c.listPackage(pkg);
    },
    completesOn: (e) => e.type === 'flag_captured' && e.n === n,
    onComplete: (c) => c.setObjects({ [station]: 'done' }),
    ...extra,
    skip: (c) => {
      installNow(c, pkg);
      extra.skip?.(c);
      captureFlag(c, n);
    },
  };
}

export const CH1_STEPS: Ch1Step[] = [
  // Step 0. Intro (skippable): the orb forms, camera pushes into first person.
  {
    id: 'intro',
    completesOn: (e) => e.type === 'intro_done',
    skip: (c) => c.set({ phase: 'play' }),
  },
  // Step 1. Wake up: dark room, only the desk is lit.
  {
    id: 'wake',
    onEnter: (c) => c.setObjects({ desk: 'active' }),
    completesOn: (e) => e.type === 'interact' && e.target === 'desk',
  },
  // Step 2. The prompt: paper opens; on close the HUD fades in and the room lights up.
  {
    id: 'prompt',
    completesOn: (e) => e.type === 'window_closed' && e.window === 'paper',
    onComplete: (c) => {
      c.set({ hudVisible: true, lightsOn: true });
      c.addQuest({ id: 'flags', text: TEXT.questFlags(0), kind: 'quest' });
      c.setObjects({ desk: 'on', depot: 'on', chute: 'on', door: 'on' });
      // the depot lists everything from the start (Julius 2026-10-12)
      for (const p of PACKAGES) c.listPackage(p.name);
    },
  },
  // Step 3. Flag 1 "Decode".
  flagStep(1, 'b64-decoder', {
    hints: [
      { after: 30, text: 'That ending `==` looks familiar.' }, // script gives no time; 30 s (engineer)
      { after: 60, text: 'There is a tool for Cryptography in the depot.' },
    ],
    skip: (c) => c.set({ s1Output: decodeBase64(S1_CHUNKS[1]) }),
  }),
  // Step 4. Flag 2 "Search".
  flagStep(2, 'grep-lens', {
    hints: [
      { after: 30, text: 'Search for a word from the brief.' },
      { after: 60, text: 'Try `denied`, then `vault`.' },
    ],
  }),
  // Step 5. Flag 3 "Wire it up".
  flagStep(3, 'port-map', {
    hints: [{ after: 60, effect: 'pulse-legend' }],
    skip: (c) => c.set({ s3Connected: WIRES.map((w) => w.port) }),
  }),
  // Step 6. Flag 4 "Bugs".
  flagStep(4, 'bug-gun', {
    skip: (c) => c.set({ s4Killed: BUG_TOTAL }),
  }),
  // Step 7. Flag 5 "The impossible one". Done right after the player has tried station 5 (it runs
  // once and fails; or 3 flags on the pad): Julius 2026-10-13, no depot visit or wrong flags needed.
  {
    id: 'flag5',
    onEnter: (c) => c.setObjects({ s5: 'active' }),
    check: (c) =>
      c.flag5ExhaustedAt !== null && c.time - c.flag5ExhaustedAt >= TIMING.flag5RevealSeconds,
    skip: (c) => {
      c.set({
        flag5Attempts: 1,
        flag5Exhausted: true,
        flag5ExhaustedAt: c.time,
        ceilingFlicker: 0.55,
      });
      c.addQuest({ id: 'another-way', text: TEXT.questAnotherWay, kind: 'quest' });
    },
  },
  // Step 8. The package that appears (top of the Z-to-A list).
  {
    id: 'board',
    onEnter: (c) => {
      // the entry shows on the depot screen right away; the depot glimmers to draw the eye
      c.set({ zzVisible: true, ceilingFlicker: 0, depotGlimmer: c.window !== 'depot' });
      c.setObjects({ s5: 'done' });
      c.addQuest({ id: 'another-way', text: TEXT.questAnotherWay, kind: 'quest' });
      c.completeQuest('another-way');
      c.addThought(TEXT.thoughtFoundAgents);
    },
    completesOn: (e) => e.type === 'entry_clicked',
    skip: (c) => c.set({ window: 'depot', entryOpen: true, entryOpenTime: 0 }),
  },
  // Step 9. Reading it.
  {
    id: 'read',
    onEnter: (c) => c.addQuest({ id: 'answer', text: TEXT.questAnswer, kind: 'quest' }),
    check: (c) => c.entryOpenTime >= TIMING.entryReadSeconds,
    skip: (c) => c.set({ entryOpenTime: TIMING.entryReadSeconds }),
  },
  // Step 10. The quirk: GET → MKCOL, write back.
  {
    id: 'write',
    onEnter: (c) => c.set({ getUnlocked: true }),
    hints: [
      { after: 25, effect: 'pulse-get' },
      { after: 60, text: 'I can only read... or can I?' },
      { after: 90, effect: 'tooltip-get' },
    ],
    completesOn: (e) => e.type === 'message_posted',
    skip: (c) => c.set({ method: 'MKCOL', posted: 'zzDEBUG_SKIPPED_MESSAGE' }),
  },
  // Step 11. End of chapter: the board wakes up, fade to white, title card.
  {
    id: 'end',
    onEnter: (c) => {
      c.completeQuest('answer');
      c.set({ phase: 'ending', endTime: 0 });
    },
  },
];
