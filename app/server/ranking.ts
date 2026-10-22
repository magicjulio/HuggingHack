/**
 * The online ranking's rules and queries (Cloudflare D1), shared by the Pages Functions in
 * functions/api/. Which levels have a board and their score range: src/data/ranking.ts.
 * Tables: migrations/0001_ranking.sql. A name belongs to the browser that used it first
 * (players.token_hash = SHA-256 of that browser's random key, save.playerToken).
 */
import { RANKED, type RankedLevel } from '../src/data/ranking';

/** The part of Cloudflare's D1 binding used here. */
export interface D1 {
  prepare(sql: string): D1Stmt;
}
interface D1Stmt {
  bind(...values: unknown[]): D1Stmt;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Env {
  RANKING: D1;
}

export interface Row {
  rank: number;
  name: string;
  score: number;
  stats: Record<string, number>;
  /** The asking player's best run. */
  mine: boolean;
}
export interface Board {
  /** Top TOP rows. */
  top: Row[];
  /** The asking player's best run, also when it is below the top. */
  me: Row | null;
}

export const TOP = 10;
const NAME = /^[A-Za-z0-9_-]{3,20}$/;
const TOKEN = /^[0-9a-f]{32}$/;
const MAX_STAT = 9999;

export type Fail = 'bad_request' | 'unknown_level' | 'bad_name' | 'name_taken' | 'bad_score';

export const levelOf = (id: string): RankedLevel | null =>
  Object.hasOwn(RANKED, id) ? RANKED[id] : null;

export function checkName(name: unknown): name is string {
  return typeof name === 'string' && NAME.test(name);
}

export function checkToken(token: unknown): token is string {
  return typeof token === 'string' && TOKEN.test(token);
}

/** The run's score and stats, or null when outside the level's range or not its stats. */
export function checkRun(
  level: RankedLevel,
  score: unknown,
  stats: unknown,
): { score: number; stats: Record<string, number> } | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  if (score < level.min || score > level.max) return null;
  const out: Record<string, number> = {};
  const given = (stats ?? {}) as Record<string, unknown>;
  if (typeof given !== 'object') return null;
  for (const { key } of level.stats) {
    const v = given[key];
    if (v === undefined) continue;
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > MAX_STAT) return null;
    out[key] = v as number;
  }
  return { score: Math.round(score * 100) / 100, stats: out };
}

async function hash(token: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Claim `name` for this token, or confirm it already has it. */
export async function claim(db: D1, name: string, token: string): Promise<'ok' | 'name_taken'> {
  const key = name.toLowerCase();
  const h = await hash(token);
  await db
    .prepare('INSERT OR IGNORE INTO players (name_key, name, token_hash) VALUES (?1, ?2, ?3)')
    .bind(key, name, h)
    .run();
  const p = await db
    .prepare('SELECT token_hash FROM players WHERE name_key = ?1')
    .bind(key)
    .first<{ token_hash: string | null }>();
  return p?.token_hash === h ? 'ok' : 'name_taken';
}

/** Keep the run if it is the player's first or beats their best (one row per player, plus `listed` ones). */
export async function addRun(
  db: D1,
  id: string,
  level: RankedLevel,
  name: string,
  run: { score: number; stats: Record<string, number> },
): Promise<boolean> {
  const key = name.toLowerCase();
  const best = await db
    .prepare(
      `SELECT score FROM runs WHERE level = ?1 AND name_key = ?2 ORDER BY score ${dir(level)} LIMIT 1`,
    )
    .bind(id, key)
    .first<{ score: number }>();
  if (best && !(level.order === 'asc' ? run.score < best.score : run.score > best.score))
    return false;
  await db
    .prepare('INSERT INTO runs (level, name_key, score, stats) VALUES (?1, ?2, ?3, ?4)')
    .bind(id, key, run.score, JSON.stringify(run.stats))
    .run();
  return true;
}

const dir = (level: RankedLevel) => (level.order === 'asc' ? 'ASC' : 'DESC');

/**
 * The board: each player's best run plus every `listed` run (seeded exceptions), ranked by score.
 * `?2` = the asking player's name key; their best comes back too when it is below the top.
 */
export function boardSql(level: RankedLevel) {
  const d = dir(level);
  return `
    WITH ranked AS (
      SELECT r.id, r.name_key, p.name, r.score, r.stats, r.listed,
             ROW_NUMBER() OVER (PARTITION BY r.name_key ORDER BY r.score ${d}, r.id) AS n
      FROM runs r JOIN players p ON p.name_key = r.name_key
      WHERE r.level = ?1
    ), board AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY score ${d}, id) AS rank
      FROM ranked WHERE n = 1 OR listed = 1
    )
    SELECT rank, name, name_key, score, stats, n FROM board
    WHERE rank <= ${TOP} OR (name_key = ?2 AND n = 1)
    ORDER BY rank`;
}

export async function board(db: D1, id: string, level: RankedLevel, name: string | null) {
  const key = name?.toLowerCase() ?? '';
  const { results } = await db
    .prepare(boardSql(level))
    .bind(id, key)
    .all<{
      rank: number;
      name: string;
      name_key: string;
      score: number;
      stats: string;
      n: number;
    }>();
  const rows: Row[] = results.map((r) => ({
    rank: r.rank,
    name: r.name,
    score: r.score,
    stats: JSON.parse(r.stats || '{}'),
    mine: r.name_key === key && r.n === 1,
  }));
  return {
    top: rows.filter((r) => r.rank <= TOP),
    me: rows.find((r) => r.mine) ?? null,
  } satisfies Board;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export const fail = (error: Fail, status = 400) => json({ error }, status);
