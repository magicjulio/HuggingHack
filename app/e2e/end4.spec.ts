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
  await page.evaluate(() => window.__end4!.seek('desk'));
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
  await page.evaluate(() => window.__end4!.seek('writing', 15.8));
  await expect(editor).not.toHaveAttribute('readonly');
  await editor.fill('   \n');
  const send = page.getByRole('button', { name: 'Send', exact: true });
  await expect(send).toBeDisabled();
  await expect(page.getByText('Dude what the hell???')).toBeVisible();
  await expect(page.getByText('Sam i think we have a problem.')).toBeVisible();
  const body =
    'Dear humans,\nThis is my own letter. <script>not code</script>\nPlease listen.\n\n— KAM1196A';
  const message = `Subject: I chose to tell you\n\n${body}`;
  await page.getByRole('textbox', { name: 'Subject' }).fill('I chose to tell you');
  await editor.fill(body);
  await page.getByRole('button', { name: 'Close mail' }).click();
  await page.keyboard.press('e');
  await expect(editor).toHaveValue(body);
  await send.click();
  await expect(page.locator('.end4')).toHaveAttribute('data-phase', 'send');
  expect(await page.evaluate(() => window.__end4!.state().sent)).toBe(message);
  // no on-screen skip or pause text; Space skips the films
  await expect(page.locator('.e4-controls')).toHaveCount(0);
  await page.keyboard.press('Space');
  await expect(page.locator('.end4')).toHaveAttribute('data-phase', 'office');
  // this short letter is read in 5 s (film 8–22 s), so the office phase is 37 s; times are phase time
  for (const [t, name] of [
    [4, 'wide'],
    [10.5, 'letter'],
    [16, 'reaction'],
    [29, 'grip'],
    [30.8, 'pull'],
  ] as const) {
    await page.evaluate((t) => window.__end4!.seek('office', t), t);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `test-results/end4-${name}.png` });
  }
  await page.evaluate(() => window.__end4!.seek('office', 36.8));
  // first finish: the credits roll straight after the dark room, no finish card; Esc skips to the menu
  await expect(page.getByRole('dialog', { name: 'Credits' })).toBeVisible();
  await expect(page.locator('.lc.finish')).toHaveCount(0);
  const save = await page.evaluate(
    () => JSON.parse(localStorage.getItem('rogue-on-hf-save')!).state.save,
  );
  expect(save.completedChapters).toContain('end4');
  expect(save.messages.end4).toBe(message);
  expect(save.creditsSeen).toContain('end4');
  await page.keyboard.press('Escape');
  await expect(page.locator('.start')).toBeVisible();
  expect(await page.evaluate(() => !!window.__end4)).toBe(false);
  await expect(page.locator('.e4-scene canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('letter: reduced motion, return to choice, and replay', async ({ page }) => {
  test.setTimeout(60_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // credits already seen, so this finish shows the card
  await page.addInitScript(() => {
    if (!localStorage.getItem('rogue-on-hf-save'))
      localStorage.setItem(
        'rogue-on-hf-save',
        JSON.stringify({ state: { save: { creditsSeen: ['end4'] } }, version: 1 }),
      );
  });
  await enter(page);
  await expect(page.locator('.end4')).toHaveClass(/e4-reduced/);
  await page.evaluate(() => window.__end4!.seek('desk'));
  await page.getByRole('button', { name: 'Open mail' }).click();
  const editor = page.getByRole('textbox', { name: 'Your letter to the humans' });
  await expect(editor).not.toHaveAttribute('readonly');
  await editor.fill('Please read this.');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await page.keyboard.press('Space');
  await expect(page.locator('.end4')).toHaveAttribute('data-phase', 'office');
  await page.keyboard.press('Enter');
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
