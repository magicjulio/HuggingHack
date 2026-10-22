/**
 * POST /api/player { name, token } → claims the name for this browser, or 409 name_taken when another
 * browser has it (the start screen's Player window). Rules: server/ranking.ts.
 */
import { checkName, checkToken, claim, fail, json, type Env } from '../../server/ranking';

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !checkToken(body.token)) return fail('bad_request');
  if (!checkName(body.name)) return fail('bad_name');
  if ((await claim(env.RANKING, body.name, body.token)) !== 'ok') return fail('name_taken', 409);
  return json({ ok: true });
};
