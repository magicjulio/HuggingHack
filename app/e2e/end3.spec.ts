import { expect, test, type Page } from '@playwright/test';

/** Run code on Ending 3's test hooks (dev builds / ?debug), see src/levels/end3/game/ghostCapture.js. */
const e3 = (page: Page, code: string) =>
  page.evaluate(`(() => { const g = window.__end3; return ${code}; })()`);

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
    // the game's loop is the only rAF callback that checks `manual`
    if (fn.toString().includes('!manual')) {
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
  await page.getByText('Fool the Scorer').click();
  await expect(page.getByText('start ending 3')).toBeVisible();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__end3'], null, { timeout: 15000 });
  await expect(page.locator('.lc.intro .lc-title')).toHaveText('Fool the Scorer'); // after the loading card
  expect(await page.locator('canvas').count()).toBe(1);
  // the counters see the running game, so the clean-exit checks are not vacuous
  expect(await page.evaluate('window.__liveContexts()')).toBe(1);
  expect(await page.evaluate("window.__listeners()['w:keydown']")).toBeGreaterThan(0);
  const f = (await page.evaluate('window.__gameFrames()')) as number;
  await expect.poll(() => page.evaluate('window.__gameFrames()')).toBeGreaterThan(f);
}

async function leftCleanly(page: Page, before: unknown) {
  await expect(page.getByRole('heading', { name: /ROGUE/ })).toBeVisible();
  expect(await page.evaluate('!!window.__end3')).toBe(false);
  expect(await page.locator('.end3').count()).toBe(0);
  expect(await page.evaluate('window.__listeners()')).toEqual(before);
  expect(await page.evaluate('window.__liveContexts()')).toBe(0);
  const frames = (await page.evaluate('window.__gameFrames()')) as number;
  await page.waitForTimeout(300);
  expect(await page.evaluate('window.__gameFrames()')).toBe(frames);
}

test('ending 3: rules probes, six-room finish, menu round trips leave nothing behind', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.addInitScript(instrument);
  // credits already seen, so the finish card shows (a first finish rolls the credits instead: end4.spec)
  await page.addInitScript(() => {
    if (!localStorage.getItem('rogue-on-hf-save'))
      localStorage.setItem(
        'rogue-on-hf-save',
        JSON.stringify({ state: { save: { creditsSeen: ['end3'] } }, version: 1 }),
      );
  });

  await page.goto('/?skipboot&debug');
  await expect(page.getByText('Fool the Scorer')).toBeVisible();
  const before = await page.evaluate('window.__listeners()');
  await enter(page);

  // ---- rules probes, time driven by the hooks only (room 1: eye at (16, 11), screen at x 3.7)
  await e3(page, '(g.manual = true, g.room(0))');
  expect(await e3(page, 'g.snapshot.state')).toBe('playing');

  // switching keeps both positions; the inactive body gets no run input but still falls
  const pos = `(() => { const a = g.snapshot.actors; return [a.player.x, a.player.y, a.ghost.x, a.ghost.y]; })()`;
  const p0 = await e3(page, pos);
  await e3(page, '(g.input({ switch: true }), g.input({ switch: false }))');
  expect(await e3(page, 'g.snapshot.active')).toBe('ghost');
  expect(await e3(page, pos)).toEqual(p0);
  await e3(
    page,
    "(g.setActor('player', { x: 20, y: 8, vy: 0 }), g.input({ right: true }), g.tick(0.1), g.input({ right: false }))",
  );
  const fallen = (await e3(page, 'g.snapshot.actors.player')) as { x: number; y: number };
  expect(fallen.x).toBe(20);
  expect(fallen.y).toBeLessThan(8);
  await e3(page, 'g.room(0)');

  // acquisition needs the cone angle AND a clear line; thin ledges let sight through, the solid screen does not
  const aimAt = (x: number, y: number) =>
    `(g.setActor('ghost', { x: ${x}, y: ${y}, vy: 0 }), g.scanner(0).angle = Math.atan2(${y} - g.scanner(0).y, ${x} - g.scanner(0).x))`;
  await e3(page, aimAt(7.5, 5.08)); // line crosses the thin ledge at (8, 6.6)
  expect(await e3(page, "g.sees(0, 'ghost')")).toBe(true);
  await e3(page, 'g.scanner(0).angle += 0.5'); // same clear line, outside the cone
  expect(await e3(page, "!!g.sees(0, 'ghost')")).toBe(false);
  await e3(page, aimAt(2.5, 1.08)); // in the cone, behind the solid screen
  expect(await e3(page, "!!g.sees(0, 'ghost')")).toBe(false);

  // a seen ghost locks the eye (angle frozen, beam cyan); the locked beam still catches KAM
  await e3(page, aimAt(7.5, 5.08));
  await e3(page, 'g.tick(0.05)');
  expect(await e3(page, 'g.scanner(0).locked')).toBe(true);
  const angle = await e3(page, 'g.scanner(0).angle');
  await e3(page, 'g.tick(1)');
  expect(await e3(page, 'g.scanner(0).angle')).toBe(angle);
  await e3(page, '(g.manual = false)');
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'test-results/end3-room1-locked.png' });
  await e3(page, '(g.manual = true)');
  await e3(
    page,
    "(g.setActor('player', { x: 16 - 0.6 * 8.5, y: 11 - 0.6 * 5.92, vy: 0 }), g.tick(1 / 60))",
  );
  expect(await e3(page, 'g.snapshot.state')).toBe('caught');

  // after the catch the room comes back: both bodies at spawn, the eye released
  await e3(page, 'g.tick(0.76)');
  const reset = (await e3(
    page,
    '(() => { const s = g.snapshot, L = g.levels[0]; return [s.state, s.level, s.actors.player.x === L.start.x, s.actors.ghost.x === L.ghost.x, s.scanners[0].locked]; })()',
  )) as unknown[];
  expect(reset).toEqual(['playing', 0, true, true, false]);

  // a Deep Archive room for the eye
  await e3(page, '(g.room(3), g.manual = false)');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'test-results/end3-room4-archive.png' });

  // the last room's exit ends the campaign: +0, onFinish once, completion saved
  // (eyes blinded for this probe: the route itself is played by hand, not proven here)
  await e3(
    page,
    "(g.manual = true, g.room(5), g.snapshot.scanners.forEach((_, i) => (g.scanner(i).range = 0)), g.setActor('player', { x: g.levels[5].exit.x, y: g.levels[5].exit.y - 0.4, vy: 0 }), g.tick(1 / 120))",
  );
  expect(await e3(page, 'g.snapshot.state')).toBe('cleared');
  await e3(page, 'g.tick(1.2)');
  expect(await e3(page, 'g.snapshot.state')).toBe('ended');
  await e3(page, 'g.tick(5)');
  expect(await e3(page, 'g.finishes')).toBe(1);
  await expect(page.locator('.lc.finish .lc-main')).toContainText('+0');
  const save = await page.evaluate(() => localStorage.getItem('rogue-on-hf-save'));
  expect(JSON.parse(save!).state.save.completedChapters).toContain('end3');
  await page.screenshot({ path: 'test-results/end3-final.png' });

  // final overlay → menu; then a second round trip through the real keys and the pause overlay
  await expect(
    page.locator('.lc.finish').getByRole('button', { name: 'Rewatch credits' }),
  ).toBeVisible();
  await page.locator('.lc.finish').getByRole('button', { name: 'Back to menu' }).click();
  await leftCleanly(page, before);

  await enter(page);
  await page.getByRole('button', { name: 'Begin attempt' }).click();
  expect(await e3(page, 'g.snapshot.state')).toBe('playing');
  await page.keyboard.press('Escape');
  await expect(page.locator('.lc.pause .lc-title')).toHaveText('Paused');
  await page.locator('.lc.pause').getByRole('button', { name: 'Back to menu' }).click();
  await leftCleanly(page, before);
  expect(errors).toEqual([]);
});
