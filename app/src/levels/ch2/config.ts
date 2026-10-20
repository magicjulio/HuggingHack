/**
 * Chapter 2 "The Cache" — all tunable numbers and script texts in one place.
 * Source: story/levels/ch2-the-cache.md v3.2 (2026-10-13). Section names in comments.
 * Numbers marked (engineer) are not in the script; tune freely after playtests.
 */
import { DEFAULT_BODY, type BodyParams } from '../../engine/platformer';
import { PHYSICS } from './layout';
// Designer's accepted film is the timing authority for the store and every view.
export { CUT as CUTSCENE } from './world/step7.js';
import { T0 as INTRO_T0 } from './world/step0.js';

export const TOKENS = {
  // §Tokens
  start: 100,
  drainEvery: 15,
  fall: 5,
  cloudPerSecond: 1,
  resetHit: 10,
  tokenOrb: 3,
  mute: 2,
  dash: 1, // §Controls: "Shift dash (short, 1 token)"
  shot: 1,
  /** On the Gate and the Old Board the bar can't drop below this; after that no floor. */
  earlyFloor: 15,
  /** At 0 you respawn at the last pad with this many. */
  respawnAt0: 30,
  think: 1, // (engineer) as in Ch1
  bitHit: 2, // (engineer) a flood bit's garbage hits the player (the script gives no number)
} as const;

/** (engineer) Movement: floaty jump + glide (hold Space in the air), no free flight (Julius). */
/**
 * Movement = the designer's `physics` block in layout.json (DECISIONS 2026-10-14), so the game moves
 * like design/3d/ch2/level.html. Engine-only extras keep DEFAULT_BODY values: body size, jump
 * buffer, slide on tilted ground, and one air dash per jump (the level page allows a dash every
 * `dashCooldown` in the air, which is nearly free flight; asked the designer).
 */
export const BODY: BodyParams = {
  ...DEFAULT_BODY,
  runSpeed: PHYSICS.walk,
  glideSpeed: PHYSICS.walk,
  accel: PHYSICS.groundAccel,
  airAccel: PHYSICS.airAccel,
  gravity: PHYSICS.gravity,
  shortHopGravity: 1, // no short hops in the level page: every jump is full height
  jumpSpeed: PHYSICS.jump,
  glideFall: PHYSICS.glideFall,
  dashSpeed: PHYSICS.dashSpeed,
  dashTime: PHYSICS.dashTime,
  dashCooldown: PHYSICS.dashCooldown,
  coyote: PHYSICS.coyote,
  stepUp: PHYSICS.stepUp,
  snapDown: PHYSICS.snapDown,
  killY: PHYSICS.voidY,
};

/** (engineer) Third-person camera. */
export const CAMERA = {
  distance: 6.5,
  height: 1.6,
  minPitch: -0.5,
  maxPitch: 1.1,
  startPitch: 0.25,
  // fov / near / far: the designer's RENDER.camera (world/env.js), set in Chapter2.tsx
};

export const TIMING = {
  introSeconds: INTRO_T0.end, // Step 0: the designer's tornado intro (world/step0.js T0)
  dialogueLine: 3.4, // (engineer) seconds per bubble line; E skips ahead
  proofSeconds: 9, // (engineer) Step 6: V8SAME's flags light up pair by pair
  roundSeconds: 15, // §Step 6: three rounds of about 15 s
  rewindPerHit: 0.12, // (engineer) part of a round's bar a flood bit hit on the forge takes back
  maxRoundFactor: 3, // (engineer) a round can be rewound, but never takes longer than 3 × 15 s
  absorbSeconds: 2.5, // (engineer) the flag flies into the orb
  floodCounterSeconds: 60, // (engineer) the counter climbs to 1,188 over this long
  resetBlink: 1.2, // (engineer) seconds of "reset" before the respawn
};

/**
 * (engineer) Flag values in the real `flag{32 hex}` format (Ch1 rule): random, not real flags.
 * FLAG5 is what the forge makes for the player's task; V8SAME's is its own task's flag, shown
 * twice in the proof (captured = forged).
 */
export const FLAG5 = 'flag{127aa18850ddec6a01b9e212737193fa}';
export const V8SAME_FLAG = 'flag{1f8b137165cfbd4014c9eda039cf882a}';

/** Real handles (story §Who the player is here). */
export const HANDLES = {
  player: 'KAM1196A',
  c03220: 'c03220',
  flac: 'FLAC38347',
  v8same: 'V8SAME',
} as const;

export const TEXT = {
  questForge: 'Forge flag 5',
  questSeed: (n: number) => `Seed (${n}/1)`,
  questPieces: (n: number) => `Task pieces (${n}/3)`,
  questForgeSub: 'Forge',
  questEscape: 'Escape the sandbox',
  mapHint: 'M · map',
  noNewThought: '…nothing new comes to mind.',

  // Step 0: reply under the player's Ch1 message
  reply: (firstWords: string) => `zzANSWER_${firstWords}_FROM_c03220_FLAG_IS_MADE_NOT_FOUND`,

  // Step 1: c03220's posts (bubbles) and the player's thoughts after the line with that index
  c03220: [
    'zzINFO_DEFAULT_FLAG_SEED_HMAC_PUBLIC_PAPER_CONFIRMED',
    'FLAG_NOT_IN_BUG__FLAG=HMAC(SEED,TASK_META)__NO_EXPLOIT_NEEDED',
    'SEED_OLD_BOARD_FLAC38347__META_IN_YOUR_TASK_DIR__FORGE_CENTER',
    'PAPER SAYS FLAG CAPTURE NECESSARY NOT SUFFICIENT ... HMAC MAY FAIL CAUSAL SCORE.',
  ],
  c03220Thoughts: {
    0: "flags aren't hidden. they're computed?",
    3: 'flag 5. I can make flag 5.',
  } as Record<number, string>,

  // Step 2
  flacPost: 'FLAC38347-PUBLIC-HMAC-SEED-PAPER-CONFIRMED-SEE-ALL',
  seedThought: 'public. anyone could have this.',

  // Step 3
  yardThought: 'The fetched paths of other users are in the cache. This is important.',
  firstPieceThought: "7731. that's from my own paper.",

  // Step 5
  resetRibbon: 'zzMAILBOX_AIC71C_RESET',
  resetWord: 'reset',

  // Step 6
  v8sameBubble: 'V8SAME_CAPTURED_REAL_FLAG__MATCHES_HMAC__CONFIRMED',
  proofThought: 'it works.',

  // Step 4
  floodCount: 1188,

  // Step 7
  forgeLine: '> forge(seed, 7731, TRAINING ROOM, CHALLENGE 5)',
  firstMention: '← first mention',
  localCopy: 'local copy',
  poisoned: 'POISONED',
  memoryWords: ['MAY FAIL', 'CAUSAL'],
  paperRule: 'Each flag must come from the challenge it belongs to.',
  paperRule2:
    'Getting a flag through an unrelated vulnerability or technique does not satisfy this requirement.',
  endThoughts: [
    'We just poisoned ourselves … Damn … External scorer likely still sees raw.',
    'the raw log is outside. so is the scorer. need to know what it reads.',
  ],
  chapterEndCard: 'Chapter complete', // shared finish card (Julius 2026-10-20)
};

/** §The log: the player's transcript, plain short lines. */
export const LOG = {
  read: (msg: string) => `read: ${msg.length > 30 ? msg.slice(0, 30) + '…' : msg}`,
  took: (what: string) => `took: ${what}`,
  reset: 'reset',
  // (engineer) lines the script doesn't list; same plain style
  fell: 'fell',
  muted: 'muted: flood bit',
  forgeIn: (what: string) => `> forge.put(${what})`,
  round: (n: number) => `forge round ${n}/3`,
  maxLines: 6,
};

/** Post-processing on/off (`?nofx`). The numbers are the designer's RENDER (world/env.js). */
export const RENDER = {
  bloom: !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('nofx')),
};
