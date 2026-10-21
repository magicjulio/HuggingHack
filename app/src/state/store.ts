import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CHAPTERS, chapterById } from '../data/chapters';
import { MODELS, modelById } from '../data/models';

/**
 * Global game state. Two parts:
 * - `save`: persisted to localStorage. New fields only need a default in `defaultSave`
 *   (sanitizeSave fills them in); renaming/removing fields needs SAVE_VERSION + a migration.
 * - everything else: session only.
 */
export const SAVE_VERSION = 1;

export type Screen = 'start' | 'game';

export type Quality = 'auto' | 'high' | 'mid' | 'low';

/** Start screen settings. PLACEHOLDER: stored, not wired into the levels yet. */
export interface Settings {
  /** 0–1. */
  music: number;
  /** 0–1. */
  sfx: number;
  quality: Quality;
  /** Mouse look multiplier, 0.5–2. */
  sensitivity: number;
  /** Every level selectable straight away. */
  unlockAll: boolean;
}

export interface SaveData {
  selectedChapter: string;
  selectedModel: string;
  /** Model ids unlocked by play, on top of the ones unlocked by default. */
  unlockedModels: string[];
  completedChapters: string[];
  /** Levels started at least once (an ending picked in PHASEONE[big] opens it on the start screen). */
  played: string[];
  /** The player's own messages per chapter (e.g. ch1 board message), reused by later chapters. */
  messages: Record<string, string>;
  /** Packages installed per chapter (Ch1 depot), shown again later (Ch2 Task Yard crates). */
  installed: Record<string, string[]>;
  /** Lasting conditions carried between chapters, e.g. 'poisoned' (Ch2 ending → Ch3). */
  status: string[];
  /** Best run time in seconds per level, for timed levels (Ending 1 race). */
  bestTimes: Record<string, number>;
  /** Endings whose end credits have played once; after that they only play on request. */
  creditsSeen: string[];
  settings: Settings;
}

/** What a finished chapter hands to the save. */
export interface ChapterResult {
  message?: string;
  installed?: string[];
  status?: string[];
}

interface GameState {
  save: SaveData;
  screen: Screen;
  /** The start screen's boot intro plays once per browser session. */
  bootShown: boolean;
  /** The Spotify dock is playing (start screen music steps aside). */
  spotifyPlaying: boolean;
  /** Where the Spotify dock shows itself (Settings' slot), or null = off screen, still playing. */
  spotifySlot: HTMLElement | null;
  /** Bumped on every chapter start, so the game host remounts the level (e.g. Ch1 → Ch2 CONTINUE). */
  run: number;

  isChapterLocked: (id: string) => boolean;
  isModelLocked: (id: string) => boolean;
  selectChapter: (id: string) => boolean;
  selectModel: (id: string) => boolean;
  markBootShown: () => void;
  startGame: () => void;
  quitToMenu: () => void;
  finishChapter: (id: string, result?: ChapterResult) => void;
  /** The playable chapter after `id`, or null (the end card then shows only BACK TO MENU). */
  nextChapter: (id: string) => string | null;
  /** End card CONTINUE: select the next chapter and start it straight away. */
  continueFrom: (id: string) => boolean;
  /** Start a level straight away (the bridge's pick); unbuilt ones show the host's placeholder. */
  startChapter: (id: string) => void;
  /** Keep `seconds` as the level's best time if it beats the saved one. */
  recordBestTime: (id: string, seconds: number) => void;
  /** The end credits have played after ending `id`. */
  markCreditsSeen: (id: string) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  /** Delete the save, every setting and all other browser data of this site, then reload. */
  resetAll: () => void;
}

const defaultSave: SaveData = {
  selectedChapter: CHAPTERS[0].id,
  selectedModel: MODELS[0].id,
  unlockedModels: [],
  completedChapters: [],
  played: [],
  messages: {},
  installed: {},
  status: [],
  bestTimes: {},
  creditsSeen: [],
  settings: { music: 0.7, sfx: 0.8, quality: 'auto', sensitivity: 1, unlockAll: false },
};

/** Playing Ch1 through opens Ch2 and PHASEONE[big]; an ending opens once it has been played. */
export const OPENS_ALL = 'ch1';
const debugUnlock =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

/**
 * Built, and reached: Ch1 always; Ch2 and PHASEONE[big] after Ch1 is finished; an ending once it has
 * been played (picked in PHASEONE[big]); all of them with the Unlock all setting / `?debug`.
 */
export function chapterLocked(id: string, save: SaveData): boolean {
  const c = chapterById(id);
  if (!c?.playable) return true;
  if (id === OPENS_ALL || save.settings.unlockAll || debugUnlock) return false;
  if (c.ending) return !save.played.includes(id) && !save.completedChapters.includes(id);
  return !save.completedChapters.includes(OPENS_ALL);
}

/** Locked unless unlocked by a finished chapter, the Unlock all setting or `?debug`. */
export function modelLocked(id: string, save: SaveData): boolean {
  const m = modelById(id);
  if (!m) return true;
  if (!m.lockedByDefault || save.settings.unlockAll || debugUnlock) return false;
  return !save.unlockedModels.includes(id);
}

/** Fill missing fields with defaults and drop selections that no longer exist or are locked. */
export function sanitizeSave(raw: Partial<SaveData> | undefined): SaveData {
  const s: SaveData = { ...defaultSave, ...(raw ?? {}) };
  s.settings = { ...defaultSave.settings, ...raw?.settings };
  if (chapterLocked(s.selectedChapter, s)) s.selectedChapter = defaultSave.selectedChapter;
  if (modelLocked(s.selectedModel, s)) s.selectedModel = defaultSave.selectedModel;
  return s;
}

/** `save` with `id` in its played list. */
const played = (save: SaveData, id: string): SaveData =>
  save.played.includes(id) ? save : { ...save, played: [...save.played, id] };

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      save: defaultSave,
      screen: 'start',
      bootShown: false,
      spotifyPlaying: false,
      spotifySlot: null,
      run: 0,

      isChapterLocked: (id) => chapterLocked(id, get().save),
      isModelLocked: (id) => modelLocked(id, get().save),
      selectChapter: (id) => {
        if (get().isChapterLocked(id)) return false;
        set((s) => ({ save: { ...s.save, selectedChapter: id } }));
        return true;
      },
      selectModel: (id) => {
        if (get().isModelLocked(id)) return false;
        set((s) => ({ save: { ...s.save, selectedModel: id } }));
        return true;
      },
      markBootShown: () => set({ bootShown: true }),
      startGame: () =>
        set((s) => ({
          save: played(s.save, s.save.selectedChapter),
          screen: 'game',
          run: s.run + 1,
        })),
      quitToMenu: () => set({ screen: 'start' }),
      // Story v2 §Models: finishing chapter n (0-based in CHAPTERS) unlocks MODELS[n + 1].
      finishChapter: (id, result = {}) =>
        set((s) => ({
          save: {
            ...s.save,
            unlockedModels: (() => {
              const next = MODELS[CHAPTERS.findIndex((c) => c.id === id) + 1];
              const have = s.save.unlockedModels;
              return next && CHAPTERS.some((c) => c.id === id) && !have.includes(next.id)
                ? [...have, next.id]
                : have;
            })(),
            completedChapters: s.save.completedChapters.includes(id)
              ? s.save.completedChapters
              : [...s.save.completedChapters, id],
            messages: result.message
              ? { ...s.save.messages, [id]: result.message }
              : s.save.messages,
            installed: result.installed
              ? { ...s.save.installed, [id]: result.installed }
              : s.save.installed,
            status: [...new Set([...s.save.status, ...(result.status ?? [])])],
          },
        })),
      nextChapter: (id) => {
        const i = CHAPTERS.findIndex((c) => c.id === id);
        const next = i < 0 ? undefined : CHAPTERS[i + 1];
        return next?.playable && !next.ending ? next.id : null;
      },
      continueFrom: (id) => {
        const next = get().nextChapter(id);
        if (!next) return false;
        set((s) => ({
          save: { ...played(s.save, next), selectedChapter: next },
          screen: 'game',
          run: s.run + 1,
        }));
        return true;
      },
      startChapter: (id) =>
        set((s) => ({
          save: { ...played(s.save, id), selectedChapter: id },
          screen: 'game',
          run: s.run + 1,
        })),
      recordBestTime: (id, seconds) =>
        set((s) => {
          const old = s.save.bestTimes[id];
          if (old !== undefined && old <= seconds) return {};
          return { save: { ...s.save, bestTimes: { ...s.save.bestTimes, [id]: seconds } } };
        }),
      markCreditsSeen: (id) =>
        set((s) =>
          s.save.creditsSeen.includes(id)
            ? {}
            : { save: { ...s.save, creditsSeen: [...s.save.creditsSeen, id] } },
        ),
      setSetting: (key, value) =>
        set((s) => {
          const save = { ...s.save, settings: { ...s.save.settings, [key]: value } };
          // switching Unlock all off can leave a locked level or model selected
          if (chapterLocked(save.selectedChapter, save)) save.selectedChapter = OPENS_ALL;
          if (modelLocked(save.selectedModel, save)) save.selectedModel = defaultSave.selectedModel;
          return { save };
        }),
      resetAll: () => {
        // Settings → Reset: everything this site keeps in the browser, then a fresh page.
        useGame.persist.clearStorage();
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch {
          /* storage blocked: nothing to clear */
        }
        const dbs = indexedDB?.databases?.() ?? Promise.resolve([]);
        const caches_ = typeof caches !== 'undefined' ? caches.keys() : Promise.resolve([]);
        void Promise.all([
          dbs.then((l) => l.forEach((d) => d.name && indexedDB.deleteDatabase(d.name))),
          caches_.then((k) => Promise.all(k.map((n) => caches.delete(n)))),
        ])
          .catch(() => {})
          .finally(() => location.replace(location.pathname));
      },
    }),
    {
      name: 'rogue-on-hf-save',
      version: SAVE_VERSION,
      partialize: (s) => ({ save: s.save }),
      // Merge so new SaveData fields get defaults when an older save is loaded.
      merge: (persisted, current) => ({
        ...current,
        save: sanitizeSave((persisted as { save?: Partial<SaveData> })?.save),
      }),
    },
  ),
);
