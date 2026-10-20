/** Types for the plain-JS game (main.js). */
import type { ScreenCard } from '../../../ui/LevelCard';

export interface AscentResult {
  /** Run time in seconds (retry penalties included). */
  time: number;
  kills: number;
  allyKills: number;
  calls: number;
  retries: number;
  loot: number;
  /** Floor the run ended on (3 = the boss fell). */
  floor: number;
}

export interface AscentOptions {
  /** Saved best time in seconds, or null. */
  best?: number | null;
  /** The overlay to show as the shared level card (loading, menu, pause, regroup, end), or null. */
  onScreen?: (card: ScreenCard | null) => void;
  /** The finish card came up. */
  onFinish?: (r: AscentResult) => void;
  /** Expose test hooks as window.__ascent. */
  debug?: boolean;
}

export const T: Record<string, unknown>;
export function createAscent(root: HTMLElement, opts?: AscentOptions): { dispose(): void };
