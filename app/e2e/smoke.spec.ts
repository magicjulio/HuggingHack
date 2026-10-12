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
  test.setTimeout(300_000); // headless WebGL runs at a few FPS; camera glides take a while
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?skipboot&debug&nofx');
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

  // Type a wrong flag on the scan pad; the eye scans it and turns red.
  await ch1(page, "interact('chute')");
  await page.getByLabel('flag').pressSequentially('FLAG{nope}');
  expect(await ch1(page, 'flagDraft')).toBe('FLAG{nope}');
  await page.keyboard.press('Enter');
  await expect(page.getByText('scanning…')).toBeVisible();
  await page.waitForFunction(
    () =>
      (
        window as never as { __ch1: { getState(): { scan: { result: string } | null } } }
      ).__ch1.getState().scan?.result === 'red',
    null,
    { timeout: 90_000 },
  );
  await page.keyboard.press('Escape');

  // Install a tool by clicking it on the depot screen.
  await ch1(page, "interact('depot')");
  await page.locator('[data-package="b64-decoder"] .c1-btn').click({ timeout: 60_000 });
  await page.waitForFunction(
    () =>
      (window as never as { __ch1: { getState(): { installed: string[] } } }).__ch1
        .getState()
        .installed.includes('b64-decoder'),
    null,
    { timeout: 90_000 },
  );
  await page.keyboard.press('Escape');

  // Jump to the write-back step and post a message through the UI.
  await ch1(page, 'jumpTo(10)');
  await ch1(page, "openWindow('depot')");
  await ch1(page, 'clickEntry()');
  await page.locator('.c1-method').click();
  await page.getByLabel('folder name').fill('hello there');
  await page.getByRole('button', { name: 'CREATE', exact: true }).click();
  await expect(page.getByText('BACK TO MENU')).toBeVisible({ timeout: 150_000 });

  const save = await page.evaluate(() => localStorage.getItem('rogue-on-hf-save'));
  expect(save).toContain('zzhello_there');
  await page.getByText('BACK TO MENU').click();
  await expect(page.getByText('INJECT')).toBeVisible();
  expect(errors).toEqual([]);
});

test('E opens the pad without typing; Esc leaves it without pausing', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/?skipboot');
  await page.waitForSelector('.start');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__ch1'], null, { timeout: 15000 });
  await page.keyboard.press('Space'); // skip intro
  await ch1(page, 'jumpTo(3)');
  // E at the pad opens it without typing an "e" into the flag
  await page.evaluate("window.__ch1.setState({ target: 'chute' })");
  await page.keyboard.press('e');
  await expect(page.getByText('type or paste a flag')).toBeVisible();
  expect(await ch1(page, 'flagDraft')).toBe('');
  await page.keyboard.press('Escape');
  await expect(page.getByText('click to look around')).toBeVisible();
  await expect(page.getByText('PAUSED')).toBeHidden();
  expect(await ch1(page, 'window')).toBeNull();
});
