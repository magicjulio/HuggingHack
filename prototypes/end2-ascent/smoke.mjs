import assert from "node:assert/strict";
import { chromium } from "../../app/node_modules/playwright/index.mjs";
// Start prototypes/serve.sh first; run: node prototypes/end2-ascent/smoke.mjs
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: [
    "--no-sandbox",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(
  (process.env.ASCENT_URL || "http://127.0.0.1:8765/end2-ascent/") + "?test=1",
);
await page.waitForFunction(() => window.__ascent);
await page.click("#start");
console.log(
  "flight",
  await page.evaluate(() => {
    const g = window.__ascent;
    for (let i = 0; i < 2300 && g.snapshot.state === "flight"; i++)
      g.tick(1 / 60);
    return g.snapshot;
  }),
);
console.log(
  "spawnOverlap",
  await page.evaluate(() => {
    const g = window.__ascent;
    return g.T.encounter.waves
      .flat()
      .filter((p) =>
        g.world.colliders.some(
          (c) =>
            p.x > c.minX - 0.8 &&
            p.x < c.maxX + 0.8 &&
            p.z > c.minZ - 0.8 &&
            p.z < c.maxZ + 0.8,
        ),
      );
  }),
);
// Loot: every type applies its effect; pickups exist as objects in the scene.
console.log(
  "loot",
  await page.evaluate(() => {
    const g = window.__ascent;
    g.damagePlayer(50);
    const hurt = g.snapshot.health;
    g.applyLoot("patch");
    const healed = g.snapshot.health;
    g.applyLoot("coolant");
    g.applyLoot("compute");
    g.applyLoot("overclock");
    return { hurt, healed, loot: g.snapshot.stats.loot };
  }),
);
async function fight() {
  return await page.evaluate(() => {
    const g = window.__ascent;
    let ticks = 0;
    for (; ticks < 24000 && g.snapshot.state === "combat"; ticks++) {
      const targets = g.actors.enemies.filter((e) => !e.dead);
      targets.sort((a, b) => a.pos.distanceTo(g.pos) - b.pos.distanceTo(g.pos));
      const e = targets[0];
      if (e) {
        const target = e.pos.clone();
        target.y += 1.45;
        for (let k = 0; k < 3; k++) g.aimAt(target.toArray());
        g.setInput({ fire: true, aim: true });
        const delta = e.pos.clone().sub(g.pos);
        delta.y = 0;
        const dist = delta.length();
        delta.normalize();
        if (dist > 12) {
          const before = g.pos.clone();
          g.move(g.pos, delta.clone().multiplyScalar(4 / 60));
          if (before.distanceTo(g.pos) < 0.02)
            g.move(
              g.pos,
              delta
                .clone()
                .set(delta.z, 0, -delta.x)
                .multiplyScalar(4 / 60),
            );
        } else {
          const side = Math.floor(ticks / 180) % 2 ? 1 : -1;
          g.move(
            g.pos,
            delta
              .clone()
              .set(delta.z, 0, -delta.x)
              .multiplyScalar((side * 3) / 60),
          );
        }
        if (g.snapshot.ready && targets.length >= 2) g.callSquad();
      } else g.setInput({ fire: false });
      g.tick(1 / 60);
      if (
        g.snapshot.floor === 1 &&
        g.snapshot.wave === 3 &&
        g.snapshot.enemies === 0
      )
        break;
    }
    g.setInput({ fire: false });
    return { ticks, end: g.snapshot };
  });
}
console.log("floor1", await fight());
await page.waitForTimeout(100);
await page.screenshot({ path: "/tmp/end2-cleared.png" });
if ((await page.evaluate(() => window.__ascent.snapshot)).state === "combat") {
  console.log(
    "walkLift",
    await page.evaluate(() => {
      const g = window.__ascent;
      let ticks = 0;
      for (let i = 0; i < 240; i++) {
        const d = g.pos.clone().set(0, g.pos.y, g.pos.z).sub(g.pos);
        if (d.length() < 0.08) break;
        g.move(g.pos, d.normalize().multiplyScalar(5 / 60));
        g.tick(1 / 60);
      }
      for (; ticks < 3000; ticks++) {
        const d = g.world.liftPosition.clone().sub(g.pos);
        d.y = 0;
        if (d.length() < 3) break;
        d.normalize().multiplyScalar(5 / 60);
        const before = g.pos.clone();
        g.move(g.pos, d);
        if (before.distanceTo(g.pos) < 0.02) g.move(g.pos, d.set(d.z, 0, -d.x));
        g.tick(1 / 60);
      }
      return { ticks, pos: g.pos.toArray() };
    }),
  );
  await page.keyboard.press("KeyE");
  console.log("lift", await page.evaluate(() => window.__ascent.snapshot));
  await page.evaluate(() => {
    for (let i = 0; i < 270; i++) window.__ascent.tick(1 / 60);
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "/tmp/end2-lift.png" });
  await page.evaluate(() => {
    for (let i = 0; i < 310; i++) window.__ascent.tick(1 / 60);
  });
  console.log("floor2", await fight());
  await page.waitForTimeout(150);
  await page.screenshot({ path: "/tmp/end2-end.png" });
}
const final = await page.evaluate(() => window.__ascent.snapshot);
assert.equal(final.state, "finish", "full slice reaches the completion card");
assert.equal(final.stats.kills, 24, "all combat waves completed");
assert.ok(final.stats.calls >= 2, "subagents deployed on both floors");
assert.deepEqual(errors, [], "no console errors or uncaught exceptions");
console.log(
  "PASS: intro → floor 1 → lift → floor 2 → end card; no browser errors",
);
await browser.close();
