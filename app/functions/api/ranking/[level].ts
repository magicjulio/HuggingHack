/**
 * GET  /api/ranking/:level?name=…  → the board (top 10 + the player's own best)
 * POST /api/ranking/:level { name, token, score, stats } → claims the name if free, keeps the run if
 * it is the player's best, answers with the board. Rules and queries: server/ranking.ts.
 */
import {
  addRun,
  board,
  checkName,
  checkRun,
  checkToken,
  claim,
  fail,
  json,
  levelOf,
  type Env,
} from '../../../server/ranking';

interface Ctx {
  request: Request;
  env: Env;
  params: { level: string };
}

export const onRequestGet = async ({ request, env, params }: Ctx) => {
  const level = levelOf(params.level);
  if (!level) return fail('unknown_level', 404);
  const name = new URL(request.url).searchParams.get('name');
  return json(await board(env.RANKING, params.level, level, checkName(name) ? name : null));
};

export const onRequestPost = async ({ request, env, params }: Ctx) => {
  const level = levelOf(params.level);
  if (!level) return fail('unknown_level', 404);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !checkToken(body.token)) return fail('bad_request');
  if (!checkName(body.name)) return fail('bad_name');
  const run = checkRun(level, body.score, body.stats);
  if (!run) return fail('bad_score');
  if ((await claim(env.RANKING, body.name, body.token)) !== 'ok') return fail('name_taken', 409);
  const best = await addRun(env.RANKING, params.level, level, body.name, run);
  return json({ ...(await board(env.RANKING, params.level, level, body.name)), best });
};
