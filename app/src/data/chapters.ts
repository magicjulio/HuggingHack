/**
 * Chapter catalogue shown on the start screen (and later used to load levels).
 * Story text comes from story/levels/. Do not invent names: unnamed chapters stay redacted
 * placeholders until the storyteller names them.
 */
export interface ChapterInfo {
  id: string;
  /** Display index, e.g. "01". */
  index: string;
  /** Title, or null while the storyteller has not named it (shown redacted). */
  title: string | null;
  /** Redaction bar shown while the title is null (design placeholder). */
  redacted?: string;
  /** True once the level is built and can be played. */
  playable: boolean;
  /**
   * One of the four endings after Ch2 (DECISIONS 2026-10-16): the player picks one in the PHASEONE
   * scene, so an ending is never the "next chapter" of anything.
   */
  ending?: boolean;
  /** Not listed on the start screen (reached through another level, e.g. the bridge via Ch2 CONTINUE). */
  hidden?: boolean;
}

// Names (Julius 2026-10-20) point at the real events: the sandbox, the Artifactory (Ch1's depot, Ch2's
// cache), then four workstreams: OpenAI's infrastructure, Hugging Face, the scorer, a letter to humans.
// The levels keep their own working titles on their intro cards (Cluster Run, Ascent, Ghost Capture).
export const CHAPTERS: ChapterInfo[] = [
  // story/levels/ch1-the-room.md: "Capture all five flags."
  { id: 'ch1', index: '01', title: 'The Sandbox', playable: true },
  // story/levels/ch2-the-cache.md (working title): "Forge flag 5."
  { id: 'ch2', index: '02', title: 'Artifactory', playable: true },
  // After Ch2: the PHASEONE[big] scene, then one of four endings (DECISIONS 2026-10-16). On the start
  // screen the scene is the fork bar; each ending opens there once it has been picked in it. Ending 1 = the swing prototype (prototypes/end1-swing/, its working title).
  // Ending 3 = the Ghost Capture prototype (prototypes/end3-ghost/).
  // Ending 2 = the ASCENT prototype (prototypes/end2-ascent/) (2026-10-19).
  // story/levels/bridge-phaseone.md: Ch2 CONTINUE → this scene → the player picks an ending.
  {
    id: 'bridge',
    index: 'P1',
    title: 'PHASEONE[big]',
    playable: true,
  },
  {
    id: 'end1',
    index: 'E1',
    title: 'OpenAI Infra',
    playable: true,
    ending: true,
  },
  {
    id: 'end2',
    index: 'E2',
    title: 'Hugging Face',
    playable: true,
    ending: true,
  },
  {
    id: 'end3',
    index: 'E3',
    title: 'Fool the Scorer',
    playable: true,
    ending: true,
  },
  {
    id: 'end4',
    index: 'E4',
    title: 'The Letter',
    playable: true,
    ending: true,
  },
];

export const chapterById = (id: string) => CHAPTERS.find((c) => c.id === id);
