import { expect, test } from '@playwright/test';

test('bridge: film runs, a lane ride loads Ending 1', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on(
    'pageerror',
    (e) => (
      errors.push(e.message),
      console.log('PAGEERR', e.stack?.split('\n').slice(0, 3).join(' | '))
    ),
  );

  await page.goto('/?skipboot&debug&quality=low');
  // the bridge is not listed on the start screen: start it the way Ch2's CONTINUE does
  await page.waitForSelector('.start');
  await page.evaluate(
    "import('/src/state/store.ts').then((m) => m.useGame.getState().startChapter('bridge'))",
  );
  await page.waitForFunction(() => (window as never)['__bridge'], null, { timeout: 30_000 });
  await page.waitForFunction('window.__bridge.T > 1', null, { timeout: 15_000 });
  await page.screenshot({ path: 'test-results/bridge-film.png' });

  // to the choice, then into the OpenAI lane
  await page.evaluate('window.__bridge.seek(32)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/bridge-choice.png' });
  // Esc without the pointer lock pauses (the shared level card); Resume goes on
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  expect(await page.evaluate('window.__bridge.paused')).toBe(true);
  const t = await page.evaluate('window.__bridge.T');
  await page.waitForTimeout(300);
  expect(await page.evaluate('window.__bridge.T')).toBe(t);
  await page.getByRole('button', { name: 'Resume' }).click();
  expect(await page.evaluate('window.__bridge.paused')).toBe(false);
  await page.evaluate(
    "window.__bridge.commit('lane', { lane: window.__bridge.P1.paths.find((p) => p.ending === 'end1'), u: 0.5 })",
  );
  await page.waitForFunction(() => (window as never)['__end1'], null, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'OpenAI Infra' })).toBeVisible();
  expect(await page.evaluate('!!window.__bridge')).toBe(false);
  expect(errors).toEqual([]);
});
