import { expect, test, type Page } from '@playwright/test';

/** Run code on Ending 2's test hooks (dev builds / ?debug), see src/levels/end2/game/main.js. */
const e2 = (page: Page, code: string) =>
  page.evaluate(`(() => { const g = window.__ascent; return ${code}; })()`);

// A retry restarts at the last opened door: start() closes the doors and restore() reopens them in
// the same frame. The door has to end up passable again, not open on screen with its collider back.
test('ending 2: a floor retry at a checkpoint leaves the open door passable', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/?skipboot&debug&nofx');
  await page.getByText('Hugging Face', { exact: true }).click();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => (window as never)['__ascent'], null, { timeout: 60000 });
  await e2(page, 'g.beginFloor(2)');
  await expect.poll(() => e2(page, 'g.encounter.index'), { timeout: 20000 }).toBeGreaterThanOrEqual(0);

  // clear the first section: its exit door opens all the way
  await e2(page, 'g.actors.clearEnemies()');
  const door = 'g.building.entryDoor(1)';
  await expect.poll(() => e2(page, `${door}.progress`), { timeout: 20000 }).toBe(1);
  const passable = () =>
    e2(page, `${door}.isOpen && !g.world.colliders.some((c) => c.local === ${door}.collider)`);
  expect(await passable()).toBe(true);

  // die, retry (R): back at that door
  await e2(page, 'g.damagePlayer(99999)');
  await expect.poll(() => e2(page, 'g.snapshot.state')).toBe('dead');
  await page.keyboard.press('KeyR');
  await expect.poll(() => e2(page, 'g.snapshot.state')).toBe('combat');
  expect(await e2(page, 'g.encounter.checkpoint')).toBe(1);
  await expect.poll(passable).toBe(true);
});
