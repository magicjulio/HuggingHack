import { expect, test } from '@playwright/test';

test('bridge: film runs, a lane ride loads Ending 1', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?skipboot&debug&quality=low');
  await page.getByText('PHASEONE[big]').click();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__bridge'], null, { timeout: 30_000 });
  await page.waitForFunction('window.__bridge.T > 1', null, { timeout: 15_000 });
  await page.screenshot({ path: 'test-results/bridge-film.png' });

  // to the choice, then into the OpenAI lane
  await page.evaluate('window.__bridge.seek(32)');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/bridge-choice.png' });
  await page.evaluate(
    "window.__bridge.commit('lane', { lane: window.__bridge.P1.paths.find((p) => p.ending === 'end1'), u: 0.5 })",
  );
  await page.waitForFunction(() => (window as never)['__end1'], null, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'CLUSTER RUN' })).toBeVisible();
  expect(await page.evaluate('!!window.__bridge')).toBe(false);
  expect(errors).toEqual([]);
});
