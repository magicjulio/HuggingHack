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
  /** Short line under the title. */
  meta: string;
  /** True once the level is built and can be played. */
  playable: boolean;
}

export const CHAPTERS: ChapterInfo[] = [
  // story/levels/ch1-the-room.md: "Capture all five flags."
  { id: 'ch1', index: '01', title: 'The Room', meta: 'sandbox · 5 flags', playable: true },
  // story/levels/ch2-the-cache.md (working title): "Forge flag 5." Meta line (engineer).
  { id: 'ch2', index: '02', title: 'The Cache', meta: 'deep cache · forge flag 5', playable: true },
  // PLACEHOLDER: chapters 3-4 not written yet (design placeholders).
  { id: 'ch3', index: '03', title: null, redacted: '██████ ████', meta: '—', playable: false },
  { id: 'ch4', index: '04', title: null, redacted: '███ █████ ██', meta: '—', playable: false },
];

export const chapterById = (id: string) => CHAPTERS.find((c) => c.id === id);
