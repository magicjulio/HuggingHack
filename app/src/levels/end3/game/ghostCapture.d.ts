/** Types for the plain-JS game (ghostCapture.js). */
import type { ScreenCard } from '../../../ui/LevelCard';

export interface GhostCaptureResult {
  /** Play time in seconds over the six rooms. */
  elapsed: number;
  catches: number;
  switches: number;
  locks: number;
  /** Always 0: the hollow Ending 3 outcome. */
  evaluationScore: 0;
}

export interface GhostCaptureOptions {
  /** The overlay to show as the shared level card (loading, intro, pause, final result), or null. */
  onScreen?: (card: ScreenCard | null) => void;
  /** All six rooms cleared; called once per completed campaign. */
  onFinish?: (r: GhostCaptureResult) => void;
  /** Expose test hooks as window.__end3. */
  debug?: boolean;
}

export function createGhostCapture(
  root: HTMLElement,
  opts?: GhostCaptureOptions,
): { dispose(): void };
