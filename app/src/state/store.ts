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

export interface SaveData {
  selectedChapter: string;
  selectedModel: string;
  /** Model ids unlocked by play, on top of the ones unlocked by default. */
  unlockedModels: string[];
  completedChapters: string[];
  /** The player's own messages per chapter (e.g. ch1 board message), reused by later chapters. */
  messages: Record<string, string>;
  /** Packages installed per chapter (Ch1 depot), shown again later (Ch2 Task Yard crates). */
  installed: Record<string, string[]>;
  /** Lasting conditions carried between chapters, e.g. 'poisoned' (Ch2 ending → Ch3). */
  status: string[];
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
}

const defaultSave: SaveData = {
  selectedChapter: CHAPTERS[0].id,
  selectedModel: MODELS[0].id,
  unlockedModels: [],
  completedChapters: [],
  messages: {},
  installed: {},
  status: [],
};

/** Fill missing fields with defaults and drop selections that no longer exist or are locked. */
export function sanitizeSave(raw: Partial<SaveData> | undefined): SaveData {
  const s: SaveData = { ...defaultSave, ...(raw ?? {}) };
  if (!chapterById(s.selectedChapter)?.playable) s.selectedChapter = defaultSave.selectedChapter;
  const m = modelById(s.selectedModel);
  if (!m || (m.lockedByDefault && !s.unlockedModels.includes(m.id))) {
    s.selectedModel = defaultSave.selectedModel;
  }
  return s;
}

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      save: defaultSave,
      screen: 'start',
      bootShown: false,
      run: 0,

      isChapterLocked: (id) => !chapterById(id)?.playable,
      isModelLocked: (id) => {
        const m = modelById(id);
        return !m || (m.lockedByDefault && !get().save.unlockedModels.includes(id));
      },
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
      startGame: () => set((s) => ({ screen: 'game', run: s.run + 1 })),
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
        return next?.playable ? next.id : null;
      },
      continueFrom: (id) => {
        const next = get().nextChapter(id);
        if (!next) return false;
        set((s) => ({
          save: { ...s.save, selectedChapter: next },
          screen: 'game',
          run: s.run + 1,
        }));
        return true;
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
