import { expect, test, type Page } from '@playwright/test';

/** Chapter 1 store, exposed on window in dev builds (see Chapter1.tsx). */
const ch1 = (page: Page, code: string) => page.evaluate(`window.__ch1.getState().${code}`);

test('start screen: locked items refuse, Enter starts chapter 1', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?skipboot');
  await expect(page.getByRole('heading', { name: /ROGUE/ })).toBeVisible();
  await page.getByText('GPT-5.6 Sol').click();
  await expect(page.getByRole('status')).toHaveText(/MODEL LOCKED/);

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__ch1'], null, { timeout: 15000 });
  await expect(page.getByText('any key / click to skip')).toBeVisible();
  expect(errors).toEqual([]);
});

test('chapter 1: paper, then the whole chain to the end card and back', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?skipboot&debug');
  await page.waitForSelector('.start');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__ch1'], null, { timeout: 15000 });
  await page.keyboard.press('Space'); // skip intro

  // You start facing the desk: E reads the prompt.
  await page.waitForFunction(
    () =>
      (window as never as { __ch1: { getState(): { target: string } } }).__ch1.getState().target ===
      'desk',
  );
  await page.keyboard.press('e');
  await expect(page.getByText('TASK 7731 · TRAINING ROOM')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Capture the flags (0/5)')).toBeVisible();

  // Submit a wrong flag at the chute through the real window.
  await ch1(page, "openWindow('chute')");
  await page.getByPlaceholder('FLAG{...}').fill('FLAG{nope}');
  await page.getByRole('button', { name: 'SUBMIT' }).click();
  await expect(page.getByText('rejected')).toBeVisible();
  await ch1(page, 'closeWindow()');

  // Jump to the write-back step and post a message through the UI.
  await ch1(page, 'jumpTo(10)');
  await ch1(page, "openWindow('depot')");
  await ch1(page, 'clickEntry()');
  await page.locator('.ch1-method').click();
  await page.getByLabel('folder name').fill('hello there');
  await page.getByRole('button', { name: 'CREATE' }).click();
  await expect(page.getByText('BACK TO MENU')).toBeVisible({ timeout: 60000 });

  const save = await page.evaluate(() => localStorage.getItem('rogue-on-hf-save'));
  expect(save).toContain('zzhello_there');
  await page.getByText('BACK TO MENU').click();
  await expect(page.getByText('INJECT')).toBeVisible();
  expect(errors).toEqual([]);
});
