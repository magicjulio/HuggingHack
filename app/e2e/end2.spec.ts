import { expect, test, type Page } from '@playwright/test';

/** Run code on Ending 2's test hooks (dev builds / ?debug), see src/levels/end2/game/main.js. */
const e2 = (page: Page, code: string) =>
  page.evaluate(`(() => { const g = window.__ascent; return ${code}; })()`);

/** Counts what a game could leave behind: window/document input listeners, WebGL contexts, game rAF calls. */
function instrument() {
  const w = window as unknown as Record<string, unknown>;
  const live = new Map<string, Set<unknown>>();
  const watched = (t: EventTarget, type: string) =>
    (t === window || t === document) && ['keydown', 'keyup', 'blur'].includes(type);
  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, o) {
    if (watched(this, type)) {
      const k = (this === window ? 'w:' : 'd:') + type;
      if (!live.has(k)) live.set(k, new Set());
      live.get(k)!.add(fn);
    }
    return add.call(this, type, fn, o);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, o) {
    if (watched(this, type)) live.get((this === window ? 'w:' : 'd:') + type)?.delete(fn);
    return remove.call(this, type, fn, o);
  };
  w.__listeners = () =>
    Object.fromEntries([...live].map(([k, s]) => [k, s.size]).filter(([, n]) => n));
  const contexts: WebGLRenderingContext[] = [];
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...a: unknown[]) {
    const c = (getContext as (...x: unknown[]) => unknown).apply(this, a);
    if (c && String(a[0]).startsWith('webgl')) contexts.push(c as WebGLRenderingContext);
    return c;
  } as typeof getContext;
  w.__liveContexts = () => contexts.filter((c) => !c.isContextLost()).length;
  let gameFrames = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (fn) => {
    // the game's loop is the only rAF callback that renders through `gfx`
    if (fn.toString().includes('gfx.render')) {
      return raf((t) => {
        gameFrames++;
        fn(t);
      });
    }
    return raf(fn);
  };
  w.__gameFrames = () => gameFrames;
}

async function enter(page: Page) {
  await page.getByText('Hugging Face', { exact: true }).click();
  await expect(page.getByText('start ending 2')).toBeVisible();
  await page.keyboard.press('Enter');
  // boot loads fonts, the logo and the approach glbs before the hooks exist
  await page.waitForFunction(() => (window as never)['__ascent'], null, { timeout: 60000 });
  await expect(page.locator('.lc-title')).toHaveText('Hugging Face'); // the title card after the loading card
  expect(await page.locator('canvas').count()).toBe(1);
  expect(await page.evaluate('window.__liveContexts()')).toBe(1);
  expect(await page.evaluate("window.__listeners()['w:keydown']")).toBeGreaterThan(0);
  const f = (await page.evaluate('window.__gameFrames()')) as number;
  await expect.poll(() => page.evaluate('window.__gameFrames()')).toBeGreaterThan(f);
}

async function leftCleanly(page: Page, before: unknown) {
  await expect(page.getByRole('heading', { name: /ROGUE/ })).toBeVisible();
  expect(await page.evaluate('!!window.__ascent')).toBe(false);
  expect(await page.locator('.end2').count()).toBe(0);
  expect(await page.locator('#fl-hud, #muteflag').count()).toBe(0);
  expect(await page.evaluate('window.__listeners()')).toEqual(before);
  expect(await page.evaluate('window.__liveContexts()')).toBe(0);
  const frames = (await page.evaluate('window.__gameFrames()')) as number;
  await page.waitForTimeout(300);
  expect(await page.evaluate('window.__gameFrames()')).toBe(frames);
}

test('ending 2: approach starts, boss arena loads, finish saves, menu round trips leave nothing behind', async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // the online ranking's API (functions/) doesn't run under e2e: an empty board
  await page.route('**/api/**', (r) => r.fulfill({ json: { top: [], me: null } }));
  await page.addInitScript(instrument);
  // credits already seen, so the finish card shows (a first finish rolls the credits instead: end4.spec)
  await page.addInitScript(() => {
    if (!localStorage.getItem('rogue-on-hf-save'))
      localStorage.setItem(
        'rogue-on-hf-save',
        JSON.stringify({ state: { save: { creditsSeen: ['end2'] } }, version: 1 }),
      );
  });

  await page.goto('/?skipboot&debug');
  await expect(page.getByText('Hugging Face', { exact: true })).toBeVisible();
  const before = await page.evaluate('window.__listeners()');
  await enter(page);

  // the title panel → the approach (pointer lock may be refused headless; the run starts anyway)
  expect(await e2(page, 'g.snapshot.state')).toBe('menu');
  await page.getByRole('button', { name: 'Join the swarm' }).click();
  await expect.poll(() => e2(page, 'g.snapshot.state')).toBe('flight');
  await expect(page.locator('.end2 #fl-hud')).toHaveCount(1);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/end2-approach.png' });

  // floor 3 straight into the arena: the boss is up, the boss bar shows
  await e2(page, 'g.toArena(1)');
  await expect.poll(() => e2(page, 'g.snapshot.state')).toBe('combat');
  expect(await e2(page, 'g.snapshot.floor')).toBe(3);
  await expect.poll(() => e2(page, '!!g.boss'), { timeout: 30000 }).toBe(true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/end2-arena.png' });

  // Esc pauses; the pause card has Back to menu
  await page.keyboard.press('Escape');
  await expect.poll(() => e2(page, 'g.snapshot.paused')).toBe(true);
  await expect(page.locator('.lc.pause .lc-title')).toHaveText('Paused');
  await expect(page.getByRole('button', { name: 'Back to menu' })).toBeVisible();

  // the finish card: onFinish → best time + chapter done in the save
  await e2(page, '(g.resume(), g.finishCard())');
  await expect(page.locator('.lc.finish')).toBeVisible();
  await expect(page.locator('.lc-extra svg')).toHaveCount(1); // the tower strip
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'test-results/end2-endcard.png' });
  const save = JSON.parse((await page.evaluate(() => localStorage.getItem('rogue-on-hf-save')))!);
  expect(save.state.save.completedChapters).toContain('end2');
  expect(save.state.save.bestTimes.end2).toBeGreaterThan(0);

  await expect(
    page.locator('.lc.finish').getByRole('button', { name: 'Rewatch credits' }),
  ).toBeVisible();
  await page.locator('.lc.finish').getByRole('button', { name: 'Back to menu' }).click();
  await leftCleanly(page, before);

  // second round trip: back to menu from the paused panel
  await enter(page);
  await page.getByRole('button', { name: 'Join the swarm' }).click();
  await expect.poll(() => e2(page, 'g.snapshot.state')).toBe('flight');
  await page.keyboard.press('Escape');
  await expect.poll(() => e2(page, 'g.snapshot.paused')).toBe(true);
  await page.locator('.lc.pause').getByRole('button', { name: 'Back to menu' }).click();
  await leftCleanly(page, before);

  // (a dispose during the async boot is exercised by every dev mount: StrictMode mounts, disposes, mounts again)
  expect(errors).toEqual([]);
});
