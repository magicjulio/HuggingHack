/**
 * Client for the online ranking (functions/api/, server/ranking.ts). The player is the save's
 * `playerName`; `playerToken` is this browser's random key that owns the name. Every call gives up
 * after a few seconds and returns 'offline', so a card never waits on the network.
 */
import { useGame } from '../../state/store';

export interface Row {
  rank: number;
  name: string;
  score: number;
  stats: Record<string, number>;
  mine: boolean;
}
export interface Board {
  top: Row[];
  me: Row | null;
}
/** A finished run as a level reports it: score (seconds for timed levels) + its stats columns. */
export interface RankedRun {
  score: number;
  stats: Record<string, number>;
}
export type Problem = 'offline' | 'name_taken' | 'bad_name' | 'bad_score';

const TIMEOUT_MS = 5000;
export const NAME_RULE = /^[A-Za-z0-9_-]{3,20}$/;

/** This browser's key, created on first use. */
export function playerToken() {
  const { save } = useGame.getState();
  if (save.playerToken) return save.playerToken;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const token = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  useGame.setState((s) => ({ save: { ...s.save, playerToken: token } }));
  return token;
}

async function call<T>(path: string, body?: unknown): Promise<T | Problem> {
  try {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data) return data as T;
    const err = data?.error;
    return err === 'name_taken' || err === 'bad_name' || err === 'bad_score' ? err : 'offline';
  } catch {
    return 'offline';
  }
}

export const isProblem = <T>(r: T | Problem): r is Problem => typeof r === 'string';

export function fetchBoard(level: string) {
  const name = useGame.getState().save.playerName;
  return call<Board>(`/api/ranking/${level}` + (name ? `?name=${encodeURIComponent(name)}` : ''));
}

/** Posts a finished run under `name` (default: the saved one); the server keeps it if it's the player's best. */
export function postRun(
  level: string,
  score: number,
  stats: Record<string, number>,
  name = useGame.getState().save.playerName,
) {
  return call<Board>(`/api/ranking/${level}`, { name, token: playerToken(), score, stats });
}

const posted = new WeakMap<RankedRun, Promise<Board | Problem>>();

/**
 * Posts `run` under the saved name once, however often it is asked (the level's onFinish, then its
 * finish card). Call it from onFinish: the first ending finish rolls the credits and shows no card.
 * Without a saved name it does nothing and returns null.
 */
export function submitRun(level: string, run: RankedRun) {
  if (!useGame.getState().save.playerName) return null;
  let p = posted.get(run);
  if (!p) posted.set(run, (p = postRun(level, run.score, run.stats)));
  return p;
}

/** Claims `name` for this browser (Player window). */
export function claimName(name: string) {
  return call<{ ok: true }>('/api/player', { name, token: playerToken() });
}

export function setPlayerName(name: string) {
  useGame.setState((s) => ({ save: { ...s.save, playerName: name } }));
}

export const PROBLEM_TEXT: Record<Problem, string> = {
  offline: 'Ranking offline, try again later',
  name_taken: 'That name is taken',
  bad_name: '3–20 letters, digits, _ or -',
  bad_score: 'This run cannot be ranked',
};
