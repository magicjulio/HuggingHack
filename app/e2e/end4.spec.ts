import { expect, test, type Page } from '@playwright/test';

async function enter(page: Page) {
  await page.goto('/?skipboot&debug');
  await page.getByText('The Letter', { exact: true }).click();
  await page.getByRole('button', { name: /INJECT/ }).click();
  await page.waitForFunction(() => window.__end4?.state().ready, null, { timeout: 30_000 });
}

test('letter: typing, pause, editing, delivery, shutdown and saved text', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await enter(page);
  await page.getByRole('button', { name: 'Skip thoughts' }).click();
  await expect(page.locator('.end4')).toHaveAttribute('data-phase', 'desk');
  await page.keyboard.press('e');
  const editor = page.getByRole('textbox', { name: 'Your letter to the humans' });
  await expect(editor).toBeVisible();
  await expect(editor).toHaveAttribute('readonly');
  await page.evaluate(() => window.__end4!.seek('writing', 10));
  await expect(editor).not.toHaveValue('');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const before = await editor.inputValue();
  await page.waitForTimeout(350);
  expect(await editor.inputValue()).toBe(before);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.evaluate(() => window.__end4!.seek('writing', 31.8));
  await expect(editor).not.toHaveAttribute('readonly');
  await editor.fill('   \n');
  const send = page.getByRole('button', { name: 'Send to the humans' });
  await expect(send).toBeDisabled();
  const message =
    'Subject: I chose to tell you\n\nDear humans,\nThis is my own letter. <script>not code</script>\nPlease listen.\n\n— KAM1196A';
  await editor.fill(message);
  await page.getByRole('button', { name: 'Put down the letter' }).click();
  await page.keyboard.press('e');
  await expect(editor).toHaveValue(message);
  await send.click();
  await expect(page.locator('.end4')).toHaveAttribute('data-phase', 'send');
  expect(await page.evaluate(() => window.__end4!.state().sent)).toBe(message);
  await page.getByRole('button', { name: 'Skip animation' }).click();
  await expect(page.locator('.end4')).toHaveAttribute('data-phase', 'office');
  for (const [t, name] of [
    [4, 'wide'],
    [15, 'letter'],
    [25, 'reaction'],
    [38, 'grip'],
    [39.8, 'pull'],
  ] as const) {
    await page.evaluate((t) => window.__end4!.seek('office', t), t);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `test-results/end4-${name}.png` });
  }
  await page.evaluate(() => window.__end4!.seek('office', 45.8));
  await expect(page.locator('.e4-end')).toBeVisible();
  const save = await page.evaluate(
    () => JSON.parse(localStorage.getItem('rogue-on-hf-save')!).state.save,
  );
  expect(save.completedChapters).toContain('end4');
  expect(save.messages.end4).toBe(message);
  await page.getByRole('button', { name: 'Back to menu', exact: true }).click();
  await expect(page.locator('.start')).toBeVisible();
  expect(await page.evaluate(() => !!window.__end4)).toBe(false);
  await expect(page.locator('.e4-scene canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('letter: reduced motion, return to choice, and replay', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await expect(page.locator('.end4')).toHaveClass(/e4-reduced/);
  await page.getByRole('button', { name: 'Skip thoughts' }).click();
  await page.getByRole('button', { name: 'Open the paper' }).click();
  const editor = page.getByRole('textbox');
  await expect(editor).not.toHaveAttribute('readonly');
  await editor.fill('Please read this.');
  await page.getByRole('button', { name: 'Send to the humans' }).click();
  await page.getByRole('button', { name: 'Skip animation' }).click();
  await page.getByRole('button', { name: 'Skip film' }).click();
  await page.getByRole('button', { name: 'Return to the choice' }).click();
  await expect(page.locator('.bridge')).toBeVisible();
  expect(await page.evaluate(() => !!window.__end4)).toBe(false);
  // The same store entry point is used by the bridge's refusal path.
  await page.evaluate(
    "import('/src/state/store.ts').then(m => m.useGame.getState().startChapter('end4'))",
  );
  await page.waitForFunction(() => window.__end4?.state().ready);
  await expect(page.locator('.end4')).toHaveAttribute('data-phase', 'thoughts');
  expect(await page.evaluate(() => window.__end4!.state().sent)).toBe('');
});
