import { expect, test, type Page } from '@playwright/test';

/** Chapter 1 store, exposed on window in dev builds (see Chapter1.tsx). */
const ch1 = (page: Page, code: string) => page.evaluate(`window.__ch1.getState().${code}`);

/**
 * Wait until a camera glide has come to rest. Headless Chrome renders the room at ~1 FPS; a glide
 * settles in ~1 s of camera time, and game time (`time`, dt clamped to 0.1) runs 2× faster than
 * the camera's (dt clamped to 0.05), so wait for 3.5 s of game time.
 */
async function settle(page: Page) {
  const t0 = (await ch1(page, 'time')) as number;
  await page.waitForFunction(
    (t) =>
      (window as never as { __ch1: { getState(): { time: number } } }).__ch1.getState().time >
      t + 3.5,
    t0,
    { timeout: 150_000 },
  );
}

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
  test.setTimeout(600_000); // headless WebGL runs at ~1 FPS; camera glides take a while
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
  await settle(page);
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
  await expect(page.getByText('BACK TO MENU')).toBeVisible({ timeout: 400_000 }); // 6 s ending at ~0.5 FPS

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

test('in-world stations: decode at S1, wire a plug at S3, shoot at S4', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  /** Where a named 3D node is on screen (Room.tsx DebugView). */
  const at = (name: string, dy = 0, dz = 0) =>
    page.evaluate(`window.__ch1view.at(${JSON.stringify(name)}, ${dy}, ${dz})`) as Promise<
      [number, number]
    >;
  const install = (name: string) =>
    page.evaluate(
      `window.__ch1.setState({ installed: [...window.__ch1.getState().installed, '${name}'] })`,
    );

  await page.goto('/?skipboot&debug&nofx');
  await page.waitForSelector('.start');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__ch1'], null, { timeout: 15000 });
  await page.keyboard.press('Space');

  // S1: the odd string goes into the decoder on the monitor; the flag can be copied
  await ch1(page, 'jumpTo(3)');
  await install('b64-decoder');
  await ch1(page, "interact('s1')");
  await settle(page);
  await page.locator('.ch1-chunk').nth(1).click({ timeout: 60_000 });
  await page.locator('.ch1-slot').click();
  await expect(page.locator('.ch1-st .ch1-copy')).toHaveText(/^flag\{8963411d/);
  await ch1(page, 'closeWindow()');

  // S3: drag plug 22 onto "secure shell" (the socket mouth, at the plug's drag depth)
  await ch1(page, 'jumpTo(5)');
  await ch1(page, "interact('s3')");
  await settle(page);
  const [px, py] = await at('plug_22', -0.05);
  await page.mouse.move(px, py);
  await page.mouse.down();
  const [sx, sy] = await at('socket_ssh', 0, 0.11);
  await page.mouse.move(sx, sy, { steps: 4 });
  await page.waitForTimeout(1500);
  await page.mouse.up();
  await page.waitForFunction(
    () =>
      (window as never as { __ch1: { getState(): { s3Connected: number[] } } }).__ch1
        .getState()
        .s3Connected.includes(22),
    null,
    { timeout: 30_000 },
  );
  await ch1(page, 'closeWindow()');

  // S4: with the bug gun, a click on the screen fires (1 token)
  await ch1(page, 'jumpTo(6)');
  await install('bug-gun');
  await ch1(page, "interact('s4')");
  await settle(page);
  const bugs = page.locator('.ch1-bugs');
  await expect(bugs).toBeVisible({ timeout: 60_000 });
  const before = (await ch1(page, 'tokens')) as number;
  await bugs.click();
  expect(await ch1(page, 'tokens')).toBeLessThan(before);
  expect(errors).toEqual([]);
});
