/**
 * Level registry: chapter id → lazily loaded level component.
 * To add a chapter: build src/levels/<id>/, register it here, set `playable: true` in data/chapters.ts.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ChapterResult } from '../state/store';

export interface LevelProps {
  modelName: string;
  /** Orb / accent colour of the chosen model. */
  color: string;
  /** Leave to the menu. */
  onExit: () => void;
  /** Chapter completed; what it hands on (the player's message, installs, status) is saved. */
  onFinish: (result?: ChapterResult) => void;
  /** Start the next chapter (end card CONTINUE); undefined when there is no playable next chapter. */
  onContinue?: () => void;
  /** Endings: play the end credits again (finish card); undefined until they have played once. */
  onCredits?: () => void;
}

export const LEVELS: Record<string, LazyExoticComponent<ComponentType<LevelProps>>> = {
  ch1: lazy(() => import('./ch1/Chapter1')),
  ch2: lazy(() => import('./ch2/Chapter2')),
  bridge: lazy(() => import('./bridge/Bridge')),
  end1: lazy(() => import('./end1/End1')),
  end2: lazy(() => import('./end2/End2')),
  end3: lazy(() => import('./end3/End3')),
  end4: lazy(() => import('./end4/End4')),
};
