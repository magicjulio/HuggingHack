/**
 * Level registry: chapter id → lazily loaded level component.
 * To add a chapter: build src/levels/<id>/, register it here, set `playable: true` in data/chapters.ts.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface LevelProps {
  modelName: string;
  /** Orb / accent colour of the chosen model. */
  color: string;
  /** Leave to the menu. */
  onExit: () => void;
  /** Chapter completed; `message` is the player's own text, saved for later chapters. */
  onFinish: (message?: string) => void;
}

export const LEVELS: Record<string, LazyExoticComponent<ComponentType<LevelProps>>> = {
  ch1: lazy(() => import('./ch1/Chapter1')),
};
