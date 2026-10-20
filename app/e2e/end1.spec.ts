import { expect, test, type Page } from '@playwright/test';

/** Run code on Ending 1's test hooks (dev builds / ?debug), see src/levels/end1/game/clusterRun.js. */
const e1 = (page: Page, code: string) =>
  page.evaluate(`(() => { const g = window.__end1; return ${code}; })()`);

test('ending 1: picked on the start screen, runs, swings, back to the menu cleans up', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto('/?skipboot&debug');
  await page.getByText('OpenAI Infra', { exact: true }).click();
  await expect(page.getByText('start ending 1')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__end1'], null, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'CLUSTER RUN' })).toBeVisible();

  // the 3-2-1 countdown, then the run (headless: no pointer lock, so start through the hook)
  await e1(page, '(g.start(), g.advance(240, 1 / 60))');
  expect(await e1(page, 'g.state')).toBe('run');

  // aim at the nearest open port ahead (re-aimed while the camera settles), hold the line, swing
  const z0 = (await e1(page, 'g.player.pos.z')) as number;
  const port = await e1(
    page,
    `(() => {
      const me = g.player.pos;
      const ahead = g.world.ports.filter((p) => !p.lockHp && p.pos.z < me.z - 10 && p.pos.distanceTo(me) < 80);
      ahead.sort((a, b) => a.pos.distanceTo(me) - b.pos.distanceTo(me));
      const p = ahead[0];
      for (let i = 0; i < 6; i++) {
        const d = p.pos.clone().sub(g.camera.position);
        g.setAim(Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)));
        g.advance(1, 1 / 60);
      }
      return g.target && g.target.port === p && g.target.inRange;
    })()`,
  );
  expect(port).toBe(true);
  await e1(
    page,
    "(g.press('rmb', true), g.advance(60, 1 / 60), g.press('rmb', false), g.advance(30, 1 / 60))",
  );
  expect(await e1(page, 'g.runTime')).toBeGreaterThan(1);
  expect(await e1(page, 'g.player.pos.z')).not.toBe(z0);
  await e1(page, 'g.render()');

  await page.screenshot({ path: 'test-results/end1-run.png' });

  // the pause card's Back to menu returns to the start screen and disposes the game
  // (headless never holds the pointer lock, so pause through the hook)
  await e1(page, 'g.pause()');
  const card = page.locator('.lc-layer');
  await expect(card.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await card.getByRole('button', { name: 'Back to menu' }).click();
  await expect(page.getByRole('heading', { name: /ROGUE/ })).toBeVisible();
  expect(await page.evaluate('!!window.__end1')).toBe(false);
  expect(await page.locator('.end1').count()).toBe(0);
  expect(errors).toEqual([]);
});
