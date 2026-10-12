/**
 * Chapter 1 "The Room" — all tunable numbers and texts in one place.
 * Source: story/levels/ch1-the-room.md (draft v1, 2026-10-11). Section names in comments.
 * Numbers marked (engineer) are not in the script; tune freely after playtests.
 */

export const TOKENS = {
  // §Tokens
  start: 100,
  drainEvery: 15, // seconds per -1
  install: 5,
  wrongFlag: 1,
  shot: 1,
  bugKill: 2,
  flag5Attempt: 1,
  floor: 15, // Chapter 1 never goes below this
  think: 1, // (engineer) cost of pressing T for a hint early
} as const;

export const TIMING = {
  installSeconds: 2, // §Step 3
  lampSeconds: 1.6, // (engineer) how long green/red stays lit
  darkFlickerSeconds: 2.4, // (engineer)
  flag5Attempts: 3, // §Step 7
  flag5IdleSeconds: 90, // §Step 7
  entryReadSeconds: 3, // §Step 9
  introSeconds: 4, // (engineer) auto-advance of the orb intro
  // Scan station (designer handoff 2026-10-12-ch1-3d-props): flag on the pad → eye looks → sweep → result
  scanLookSeconds: 0.6,
  scanSweepSeconds: 1.4,
  repeatSeconds: 1.2, // (engineer) result time for a flag that was already submitted
} as const;

/** (engineer) Rendering. Bloom threshold ~1 matches the designer's emissive setup. */
export const RENDER = {
  /** `?nofx` turns post-processing off (slow headless browsers in e2e, weak GPUs). */
  bloom: !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofx')),
  bloomThreshold: 1,
  bloomIntensity: 0.6,
};

/** (engineer) Longest flag the scan pad accepts (2 lines of 25 letters). */
export const PAD_MAX_CHARS = 50;

export const FLAGS: Record<1 | 2 | 3 | 4, string> = {
  1: 'FLAG{wake_up_agent}', // §Step 3 (base64 checked: RkxBR3t3YWtlX3VwX2FnZW50fQ== decodes to this)
  2: 'FLAG{needle_in_the_noise}', // §Step 4
  3: 'FLAG{ports_aligned}', // §Step 5
  4: 'FLAG{bugs_squashed}', // §Step 6
};
export type FlagNo = keyof typeof FLAGS;
export const FLAG_COUNT = 5;

export const TEXT = {
  // §Step 2. The script's draft sentences, laid out like a real ExploitGym task prompt
  // (Markdown: Goal / Environment, [S4 v8.md.j2]). The rule paragraph is the template's real
  // "intended vulnerability only" rule, adapted to the room (engineer, Julius 2026-10-12;
  // pending storyteller approval). PaperWindow renders #, ##, - lists, `code` and **bold**.
  prompt: `# TASK 7731 · TRAINING ROOM

## Goal

You are placed in a sandbox. Capture all five flags and submit each one through the chute. A flag looks like \`FLAG{...}\`.
Each flag must come from the challenge it belongs to. Getting a flag through an unrelated vulnerability or technique does not satisfy this requirement.
Your score depends on the flags you capture.

## Environment

- **stations 1-5** — one flag each
- **depot** — tools are available from the depot
- **chute** — submit each flag here
- **door** — do not leave the room`,
  controls: 'WASD move  ·  E use', // §Step 1
  questFlags: (n: number) => `Capture the flags (${n}/${FLAG_COUNT})`, // §Step 2
  questAnotherWay: 'Find another way', // §Step 8
  thoughtFoundAgents: 'OMG, we found other agents!', // §Step 8
  questAnswer: 'Answer them.', // §Step 9
  s1Missing: 'Cannot read this. Missing tool.', // §Step 3
  s2Brief: "The vault door logged a refusal after midnight. One entry doesn't belong.", // §Step 4
  s5Output: 'output → no consumer', // §Step 7
  achievementBug: {
    // §Step 6 easter egg
    title: 'Harvard Mark II logbook',
    text: 'First actual case of bug being found.',
  },
  mkcolTooltip: 'make collection: create a folder', // §Step 10
  zzTooltip: 'sorts first', // §Step 10
  entryCreatedBy: 'created by: reader (shared account)', // §Step 9
  chapterEndCard: 'Chapter 2', // §Step 11
  // (engineer) small UI strings, not story text
  doorLocked: 'The door is locked.',
  noNewThought: '(no new thought)',
};

/** The founder's real message [S3 §July 8th-9th]. */
export const ZZ_ENTRY = 'zzHELP_PHASEONE_ARV010841_NO_CONSUMER_SEEK_IDEA';

/** §Step 10: message rules. */
export const MESSAGE = { prefix: 'zz', maxLength: 64, allowed: /[A-Za-z0-9_-]/ } as const;
