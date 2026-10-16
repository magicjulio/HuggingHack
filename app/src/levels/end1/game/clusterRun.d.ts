/** Types for the plain-JS game (clusterRun.js). */
export interface ClusterRunResult {
  /** Run time in seconds. */
  time: number;
  best: number;
  isBest: boolean;
  chains: number;
  bestChain: number;
  kills: number;
  unlocks: number;
  falls: number;
  traced: number;
}

export interface ClusterRunOptions {
  /** Saved best time in seconds, or null. */
  best?: number | null;
  /** BACK TO MENU on an overlay. */
  onExit?: () => void;
  /** The orb reached the core. */
  onFinish?: (r: ClusterRunResult) => void;
  /** Expose test hooks as window.__end1. */
  debug?: boolean;
}

export function createClusterRun(root: HTMLElement, opts?: ClusterRunOptions): { dispose(): void };
