/**
 * Levels with an online ranking (the best-players board on their intro and finish cards).
 * Read by the client (ui/ranking/) and the server (functions/api/ranking/, server/ranking.ts),
 * so a level opts in here once: add an entry, then show <RankingBoard level=… /> in its card.
 */

export interface RankedStat {
  /** Key in the run's stats, as the game reports it in `onFinish` (e.g. clusterRun.js `falls`). */
  key: string;
  /** Column head. */
  label: string;
}

export interface RankedLevel {
  /** 'asc' = lower is better (times). */
  order: 'asc' | 'desc';
  /** Plausible score range; the server refuses anything outside it. */
  min: number;
  max: number;
  /** Score column head. */
  scoreLabel: string;
  /** How a score reads; default fmtTime. */
  format?: (score: number) => string;
  /** Extra integer columns, at most two fit. */
  stats: RankedStat[];
}

export const RANKED: Record<string, RankedLevel> = {
  // Ending 1 "Cluster Run": run time in seconds; the fastest known run is 0:42.32
  end1: {
    order: 'asc',
    min: 20,
    max: 3600,
    scoreLabel: 'Time',
    stats: [{ key: 'falls', label: 'Falls' }],
  },
  // Ending 2 "Ascent": run time in seconds (retries add 10 s each); the landing alone is ~34 s and
  // the floors' holds another ~50 s, so nothing real clears under 2 minutes
  end2: {
    order: 'asc',
    min: 120,
    max: 7200,
    scoreLabel: 'Time',
    stats: [
      { key: 'retries', label: 'Retries' },
      { key: 'kills', label: 'Takedowns' },
    ],
  },
  // Ending 3 "Ghost Capture": time spent playing the six rooms, in seconds (playtest target 4–8 min)
  end3: {
    order: 'asc',
    min: 30,
    max: 3600,
    scoreLabel: 'Time',
    stats: [{ key: 'retries', label: 'Retries' }],
  },
};

/** "0:42.32", the run clock's format (clusterRun.js `fmt`). */
export function fmtTime(t: number) {
  const m = Math.floor(t / 60),
    s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}
