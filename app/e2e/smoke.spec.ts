import { expect, test, type Page } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> }; // no @types/node here
/**
 * Timeouts are sized for the GPU renderer (~35 FPS, see playwright.config.ts). The SwiftShader
 * fallback runs at ~1 FPS, so it gets 15× the time.
 */
const T = (ms: number) => (process.env.E2E_SWIFTSHADER ? ms * 15 : ms);

/** Chapter 1 store, exposed on window in dev builds (see Chapter1.tsx). */
const ch1 = (page: Page, code: string) => page.evaluate(`window.__ch1.getState().${code}`);

/**
 * Wait until a camera glide has come to rest: it settles in ~1 s of camera time. At low FPS game
 * time (`time`, dt clamped to 0.1) runs up to 2× faster than the camera's (dt clamped to 0.05),
 * so wait for 3.5 s of game time.
 */
async function settle(page: Page) {
  const t0 = (await ch1(page, 'time')) as number;
  await page.waitForFunction(
    (t) =>
      (window as never as { __ch1: { getState(): { time: number } } }).__ch1.getState().time >
      t + 3.5,
    t0,
    { timeout: T(20_000) },
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

test('chapter 1: paper, the whole chain to the end card, CONTINUE into chapter 2', async ({
  page,
}) => {
  test.setTimeout(T(90_000));
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
  await page.keyboard.press('w'); // walking away closes a window (Esc doesn't)
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
    { timeout: T(20_000) },
  );
  await ch1(page, 'closeWindow()');

  // Install a tool by clicking it on the depot screen.
  await ch1(page, "interact('depot')");
  await settle(page);
  await page.locator('[data-package="b64-decoder"] .c1-btn').click({ timeout: T(15_000) });
  await page.waitForFunction(
    () =>
      (window as never as { __ch1: { getState(): { installed: string[] } } }).__ch1
        .getState()
        .installed.includes('b64-decoder'),
    null,
    { timeout: T(20_000) },
  );
  await page.mouse.click(4, 300); // a click beside the machine steps back
  expect(await ch1(page, 'window')).toBeNull();

  // Jump to the write-back step and post a message through the UI.
  await ch1(page, 'jumpTo(10)');
  await ch1(page, "openWindow('depot')");
  await ch1(page, 'clickEntry()');
  await page.locator('.c1-method').click();
  await page.getByLabel('folder name').fill('hello there');
  await page.getByRole('button', { name: 'CREATE', exact: true }).click();
  await expect(page.getByText('BACK TO MENU')).toBeVisible({ timeout: T(30_000) }); // 6 s ending

  const save = await page.evaluate(() => localStorage.getItem('rogue-on-hf-save'));
  expect(save).toContain('zzhello_there');
  // CONTINUE goes straight into Chapter 2's intro, which answers the message just written
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await page.waitForFunction(() => (window as never)['__ch2'], null, { timeout: T(15_000) });
  await expect(page.getByText(/zzANSWER_hello_there/i)).toBeVisible({ timeout: T(5000) });
  expect(errors).toEqual([]);
});

test('E opens the pad without typing; Esc pauses over it; step back leaves', async ({ page }) => {
  test.setTimeout(T(30_000));
  await page.goto('/?skipboot');
  await page.waitForSelector('.start');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__ch1'], null, { timeout: 15000 });
  await page.keyboard.press('Space'); // skip intro
  await ch1(page, 'jumpTo(3)');
  // E at the pad opens it without typing an "e" into the flag
  // the view hook mounts with the 3D scene, after the store hook
  await page.waitForFunction(() => (window as never)['__ch1view'], null, { timeout: T(15_000) });
  await page.evaluate("window.__ch1view.aim('chute')"); // as if the crosshair were on the pad
  await page.waitForFunction(
    () =>
      (window as never as { __ch1: { getState(): { target: string } } }).__ch1.getState().target ===
      'chute',
  );
  await page.keyboard.press('e');
  await expect(page.getByText('type or paste a flag')).toBeVisible();
  expect(await ch1(page, 'flagDraft')).toBe('');
  // Esc is the pause key, also at a machine (Julius 2026-10-13); the machine stays open
  const pause = page.locator('.overlay-pause'); // "PAUSED" (or "CLICK TO TAKE CONTROL" at t = 0)
  await page.keyboard.press('Escape');
  await expect(pause).toBeVisible();
  expect(await ch1(page, 'window')).toBe('chute');
  await pause.click();
  await expect(pause).toBeHidden();
  expect(await ch1(page, 'window')).toBe('chute');
  // the step-back button leaves without pausing
  await page.getByRole('button', { name: '✕ step back' }).click();
  await expect(pause).toBeHidden(); // (the click may re-lock the mouse at once, so no hint check)
  expect(await ch1(page, 'window')).toBeNull();
});

test('in-world stations: decode at S1, wire a plug at S3, shoot at S4', async ({ page }) => {
  test.setTimeout(T(90_000));
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
  await page
    .locator('.ch1-chunk')
    .nth(1)
    .click({ timeout: T(15_000) });
  await page.locator('.ch1-slot').click();
  await expect(page.locator('.ch1-st .ch1-copy')).toHaveText(/^flag\{8963411d/);
  await ch1(page, 'closeWindow()');

  // S3: drag plug 22 onto "secure shell" (the socket mouth, at the plug's drag depth)
  await ch1(page, 'jumpTo(5)');
  await ch1(page, "interact('s3')");
  await settle(page);
  await page.addStyleTag({ content: '.debug{display:none}' }); // the panel covers the plug tray
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
    { timeout: T(10_000) },
  );
  await ch1(page, 'closeWindow()');

  // S4: with the bug gun, a click on the screen fires (1 token)
  await ch1(page, 'jumpTo(6)');
  await install('bug-gun');
  await ch1(page, "interact('s4')");
  await settle(page);
  const bugs = page.locator('.ch1-bugs');
  await expect(bugs).toBeVisible({ timeout: T(15_000) });
  // count shots (a shot that also hits a bug nets +1 token, so tokens alone can't tell)
  await page.evaluate(`{
    const st = window.__ch1.getState(), fire = st.fireShot;
    window.__shots = 0;
    window.__ch1.setState({ fireShot: () => (window.__shots++, fire()) });
  }`);
  await bugs.click();
  expect(await page.evaluate('window.__shots')).toBe(1);
  await page.keyboard.press('a'); // walking away leaves the machine
  expect(await ch1(page, 'window')).toBeNull();

  // S5: trying the station is the failure; the board entry follows without any flag
  await ch1(page, 'jumpTo(7)');
  await ch1(page, "interact('s5')");
  await page.waitForFunction(
    () =>
      (window as never as { __ch1: { getState(): { stepId: string } } }).__ch1.getState().stepId ===
      'board',
    null,
    { timeout: T(30_000) },
  );
  expect(await ch1(page, 'zzVisible')).toBe(true);
  expect(errors).toEqual([]);
});

/** Chapter 2 store (dev builds, see Chapter2.tsx). */
const ch2 = (page: Page, code: string) => page.evaluate(`window.__ch2.getState().${code}`);
const ch2Wait = (page: Page, cond: string, ms: number) =>
  page.waitForFunction(`(() => { const s = window.__ch2.getState(); return ${cond}; })()`, null, {
    timeout: T(ms),
  });

test('chapter 2: intro, real keys move the orb, forge, cutscene, poisoned in the save', async ({
  page,
}) => {
  test.setTimeout(T(120_000));
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  // a save that finished Ch1 with a message and installs, Ch2 selected
  await page.goto('/?skipboot&debug&nofx');
  await page.evaluate(() =>
    localStorage.setItem(
      'rogue-on-hf-save',
      JSON.stringify({
        version: 1,
        state: {
          save: {
            selectedChapter: 'ch2',
            selectedModel: 'im1',
            unlockedModels: ['sol'],
            completedChapters: ['ch1'],
            messages: { ch1: 'zzHELLO_ANYONE' },
            installed: { ch1: ['b64-decoder', 'left-pad'] },
            status: [],
          },
        },
      }),
    ),
  );
  await page.goto('/?skipboot&debug&nofx');
  await page.waitForSelector('.start');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__ch2'], null, { timeout: 15000 });
  await expect(page.getByText('zzANSWER_HELLO_ANYONE_FROM_c03220')).toBeVisible({
    timeout: T(5000),
  });
  await page.keyboard.press('Space'); // skip the intro
  await ch2Wait(page, "s.phase === 'play' && window.__ch2.sim.body.ground !== null", 10_000);
  expect(await ch2(page, 'log[0].text')).toBe('read: zzHELLO_ANYONE');

  // real keys: W walks (first move completes Step 0), Space jumps
  await page.keyboard.down('KeyW');
  await ch2Wait(page, "s.stepId === 'gate'", 5000);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('Space');
  await page.waitForFunction(
    `window.__ch2.sim.body.ground === null && window.__ch2.sim.body.vel.y > 0`,
    null,
    { timeout: T(3000) },
  );
  await page.keyboard.up('Space');

  // the forge: proof, four inputs, three rounds (fast-forwarded), the flag goes into the orb
  await ch2(page, 'jumpTo(6)');
  await ch2Wait(page, "s.forge.phase === 'ready'", 20_000);
  await ch2(page, 'placePlayer([2.4, 34.95, 0.5])'); // on the dais by slot 1 (layout.json forge)
  await ch2Wait(page, "s.target && s.target.kind === 'forge'", 5000);
  for (let i = 0; i < 4; i++) await page.keyboard.press('e');
  expect(await ch2(page, 'forge.phase')).toBe('forging');
  await page.evaluate(`{
    const st = window.__ch2.getState();
    for (let i = 0; i < 2000 && window.__ch2.getState().forge.phase === 'forging'; i++) {
      st.addTokens(5);
      window.__ch2.getState().tick(0.1);
    }
  }`);
  await ch2Wait(page, "s.phase === 'cutscene'", 15_000);
  await expect(page.locator('.c2-letterbox.on')).toBeVisible();

  // the cutscene runs without input (fast-forward), then the end card; the save is poisoned
  await page.evaluate(`{ for (let i = 0; i < 400; i++) window.__ch2.getState().tick(0.1); }`);
  await expect(page.getByText('END OF CHAPTER 2')).toBeVisible({ timeout: T(10_000) });
  const save = JSON.parse((await page.evaluate(() => localStorage.getItem('rogue-on-hf-save')))!);
  expect(save.state.save.status).toEqual(['poisoned']);
  expect(save.state.save.completedChapters).toContain('ch2');
  expect(errors).toEqual([]);
});
