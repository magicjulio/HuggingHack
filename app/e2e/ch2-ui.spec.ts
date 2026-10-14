/** External engineer (Codex): exercise the integrated kit and the real postprocessing film. */
import { expect, test, type Page } from '@playwright/test';

async function openCache(page: Page, query: string) {
  await page.goto(`/?skipboot&debug&${query}`);
  await page.evaluate(() =>
    localStorage.setItem(
      'rogue-on-hf-save',
      JSON.stringify({
        version: 1,
        state: {
          save: {
            selectedChapter: 'ch2',
            selectedModel: 'im1',
            unlockedModels: [],
            completedChapters: [],
            messages: { ch1: 'zzHELLO_ANYONE' },
            installed: { ch1: ['b64-decoder'] },
            status: [],
          },
        },
      }),
    ),
  );
  await page.reload();
  await page.locator('button.start').click();
  await page.waitForFunction('!!window.__ch2');
  await page.evaluate('window.__ch2.getState().finishIntro()');
  await expect(page.locator('.c2-mini canvas')).toBeVisible();
}

test('chapter 2 HUD: dialogue, pickups, decoys, map close and clicking a reached pad', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openCache(page, 'nofx');
  await page.evaluate(`{
    const s = window.__ch2.getState();
    s.jumpTo(1);
    s.interact({ kind: 'npc', id: 'c03220' });
  }`);
  await expect(page.locator('.c2-bubble__who')).toContainText('c03220');
  await expect(page.locator('.c2-bubble__n')).toHaveText('1/4');
  await page.keyboard.press('e');
  await expect(page.locator('.c2-bubble__n')).toHaveText('2/4');
  await expect(page.locator('.c2-ghost')).toHaveCount(1);
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  await page.keyboard.press('e');
  await expect(page.locator('[data-q="forge"] .c1-quest__text')).toHaveText('Forge flag 5');

  await page.evaluate('window.__ch2.getState().takeItem("seed")');
  await expect(page.locator('.c2-slot[data-k="seed"]')).toHaveClass(/is-full/);
  await expect(page.locator('[data-sub="seed"]')).toHaveClass(/is-done/);
  await page.evaluate('window.__ch2.getState().takeItem("d7713")');
  await expect(page.locator('.c2-decoy')).toBeVisible();
  await expect(page.locator('.c2-decoy')).toHaveCount(0, { timeout: 5000 });

  await page.evaluate(`import('/src/levels/ch2/layout.ts').then(({ PADS }) => {
    window.__ch2.getState().placePlayer(PADS.find(p => p.id === 'pad-oldboard').position);
  })`);
  await page.waitForFunction('window.__ch2.getState().lastPad === "pad-oldboard"');
  await page.keyboard.press('m');
  await expect(page.locator('.c2-fullmap')).toHaveClass(/is-open/);
  await page.keyboard.press('m');
  await expect(page.locator('.c2-fullmap')).not.toHaveClass(/is-open/);
  await page.keyboard.press('m');
  await expect(page.locator('.c2-fullmap')).toHaveClass(/is-open/);
  // Find the Gate's drawn hit area through the designer's public map contract, then send a
  // real pointer click to the app's canvas. This verifies coordinate wiring and quick travel.
  const point = (await page.evaluate(`import('/src/levels/ch2/layout.ts').then(({ LAYOUT }) => {
    const c = document.querySelector('.c2-fullmap canvas'), r = c.getBoundingClientRect();
    const s = window.__ch2.getState(), b = window.__ch2.sim.body.pos;
    const m = window.c2map.create(c, 'full').layout(LAYOUT);
    m.draw({ p: b.toArray(), yaw: 0, goal: null, pads: Object.fromEntries(s.padsSeen.map(id => [id, 'seen'])), t: s.time });
    for (let y = r.top; y < r.bottom; y += 8) for (let x = r.left; x < r.right; x += 8)
      if (m.padAt(x, y) === 'pad-gate') return { x, y };
    throw new Error('Reached Gate pad has no clickable area');
  })`)) as { x: number; y: number };
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.c2-fullmap')).not.toHaveClass(/is-open/);
  await page.waitForFunction('window.__ch2.getState().lastPad === "pad-gate"');
  // Consuming a pickup before its spark lands must not refill its now-empty HUD socket.
  await page.evaluate('window.__ch2.getState().takeItem("p7731")');
  await expect(page.locator('.c2-fly').first()).toBeVisible();
  await page.evaluate('window.__ch2.getState().jumpTo(7)');
  await expect(page.locator('.c2-fly')).toHaveCount(0);
  await expect(page.locator('.c2-slot.is-full')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('accepted film: actual FX passes, memories, hard cut, poisoned orb and replay', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await openCache(page, 'quality=low');
  await page.waitForFunction('window.__ch2render?.warmed()');
  expect(await page.evaluate('window.__ch2render.gl.getPixelRatio()')).toBe(0.75);
  expect(await page.evaluate('window.__ch2render.composer.multisampling')).toBe(0);
  expect(await page.evaluate('window.__ch2render.composer.passes.map(p => p.name)')).toEqual([
    'RenderPass',
    'EffectPass',
    'EffectPass',
    'CopyPass',
  ]);
  await page.evaluate(`{
    const store = window.__ch2;
    window.__filmTick = store.getState().tick;
    store.setState({tick: () => {}});
    store.getState().jumpTo(7);
    window.__filmTick(9.8);
  }`);
  await expect(page.locator('.c2-mem--gate')).toHaveCSS('opacity', '1');
  await expect(page.locator('.c2-mem--gate')).toHaveClass(/is-keep/);
  expect(
    await page.evaluate('window.__ch2render.effect.uniforms.get("uMemoryMix").value'),
  ).toBeGreaterThan(0.7);
  await page.evaluate('window.__filmTick(5.5)');
  await expect(page.locator('.c2-mem--paper')).toHaveCSS('opacity', '1');
  await expect(page.locator('.c2-mem--paper')).toHaveClass(/is-focus2/);
  await expect(page.locator('.c2-mem--paper .is-rule1')).toHaveText(
    'Each flag must come from the challenge it belongs to.',
  );
  await page.evaluate('window.__filmTick(8.7)'); // 24 seconds: poison + stamp, after the hard cut
  await expect(page.locator('.c2-stamp')).toBeVisible();
  await page.waitForFunction('window.__ch2render.camera.fov < 43');
  expect(
    await page.evaluate(`{
    const r = window.__ch2render, orb = r.scene.getObjectByName('playerOrb');
    const ink = orb.children[0].children.find(m => m.material?.uniforms?.uInk);
    ink.material.uniforms.uInk.value;
  }`),
  ).toBeGreaterThan(0.9);
  // Frame updates must retain the low tier after every store/HUD update.
  expect(await page.evaluate('window.__ch2render.gl.getPixelRatio()')).toBe(0.75);
  await page.evaluate('window.__filmTick(4.2)');
  await expect(page.locator('.c2-line--local .c2-line__tag')).toHaveText('local copy');
  await page.evaluate('window.__filmTick(8.8)');
  await expect(page.getByText('END OF CHAPTER 2')).toBeVisible();
  const status = await page.evaluate(
    'JSON.parse(localStorage.getItem("rogue-on-hf-save")).state.save.status',
  );
  expect(status).toContain('poisoned');
  await page.evaluate('window.__ch2.getState().jumpTo(7); window.__filmTick(.8)');
  await expect(page.locator('.ch2-film')).toHaveClass(/is-cine/);
  await expect(page.locator('.c2-stamp')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('chapter 2 caps DPR on a high-DPI screen', async ({ browser }) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  try {
    await openCache(page, 'quality=high');
    await page.waitForFunction('window.__ch2render?.warmed()');
    expect(await page.evaluate('window.__ch2render.gl.getPixelRatio()')).toBe(1.5);
    expect(await page.evaluate('window.__ch2render.composer.multisampling')).toBe(4);
  } finally {
    await context.close();
  }
});

test('animated agents pause with the map, leave, and hide during the film', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openCache(page, 'quality=low');
  await page.waitForFunction("window.__ch2render?.scene.getObjectByName('crowd')");
  const snapshot = () =>
    page.evaluate<{
      count: number;
      npc: {name: string; pos: number[]; rot: unknown}[];
      crowd: number[][];
      trailVersion: number;
      visible: boolean;
    }>(`{
    const scene = window.__ch2render.scene;
    const npcs = scene.getObjectByName('npcs'), crowd = scene.getObjectByName('crowd');
    const trails = scene.getObjectByName('trails');
    ({
      count: crowd.children.length,
      npc: npcs.children.map(n => ({name:n.name,pos:n.position.toArray(),rot:n.children[2]?.rotation.toArray()})),
      crowd: crowd.children.map(n => n.position.toArray()),
      trailVersion: trails.children[0].geometry.attributes.iMeta.version,
      visible: crowd.visible && trails.visible
    });
  }`);
  const first = await snapshot();
  expect(first.npc.map((n: { name: string }) => n.name)).toEqual(['c03220', 'FLAC38347', 'V8SAME']);
  expect(first.count).toBeGreaterThanOrEqual(77);
  expect(first.count).toBeLessThanOrEqual(97);
  await page.waitForTimeout(500);
  const moving = await snapshot();
  expect(moving.npc).not.toEqual(first.npc);
  expect(moving.crowd).not.toEqual(first.crowd);
  expect(moving.trailVersion).toBeGreaterThan(first.trailVersion);
  await page.evaluate('window.__ch2.getState().toggleMap(true)');
  await page.waitForTimeout(100);
  const paused = await snapshot();
  await page.waitForTimeout(500);
  expect(await snapshot()).toEqual(paused);
  await page.evaluate('window.__ch2.getState().toggleMap(false)');
  await page.evaluate('window.__ch2.setState({v8sameGone:true})');
  await page.waitForTimeout(500);
  expect((await snapshot()).npc[2].pos).not.toEqual(paused.npc[2].pos);
  await page.evaluate('window.__ch2.getState().jumpTo(7)');
  await page.waitForTimeout(100);
  const film = await snapshot();
  expect(film.visible).toBe(false);
  await page.waitForTimeout(300);
  const stillFilm = await snapshot();
  expect(stillFilm.crowd).toEqual(film.crowd);
  expect(stillFilm.trailVersion).toBe(film.trailVersion);
  await page.evaluate('window.__ch2.getState().jumpTo(1)');
  await page.waitForTimeout(300);
  expect((await snapshot()).visible).toBe(true);
  expect(errors).toEqual([]);
});
