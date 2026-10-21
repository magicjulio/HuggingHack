import assert from "node:assert/strict";
import { chromium } from "../../app/node_modules/playwright/index.mjs";
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
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(
    (process.env.LASTCOMMIT_URL || "http://127.0.0.1:8765/end3-lastcommit/") +
      "?test=1",
  );
  await page.waitForFunction(() => window.__lastcommit);
  await page.screenshot({ path: "/tmp/end3-lastcommit-intro.png" });
  await page.click("#start");
  const movement = await page.evaluate(() => {
    const g = window.__lastcommit,
      x = g.snapshot.x;
    g.input(1, 0);
    for (let i = 0; i < 60; i++) g.tick(1 / 60);
    g.input(0, 0);
    const moved = g.snapshot.x - x;
    g.pause();
    const t = g.snapshot.time;
    for (let i = 0; i < 120; i++) g.tick(1 / 60);
    const held = t === g.snapshot.time;
    g.pause();
    g.dash();
    g.tick(1 / 60);
    return { moved, held, dash: g.snapshot.dashCooldown > 0 };
  });
  assert.ok(
    movement.moved > 6 && movement.held && movement.dash,
    "movement, pause and dash work",
  );
  await page.evaluate(() => window.__lastcommit.start());
  // Real movement/auto-fire only. No direct damage, health changes, teleporting or time jumps.
  const checkpoints = [];
  for (let chunk = 0; chunk < 6; chunk++) {
    const result = await page.evaluate(() => {
      const g = window.__lastcommit;
      let ticks = 0;
      for (; ticks < 60 * 55; ticks++) {
        const s = g.snapshot;
        if (s.state === "upgrade") {
          g.choose([1, 0, 1, 0, 0][s.upgrades] ?? 0);
          continue;
        }
        if (s.state !== "running") break;
        const { enemies, drops, caches } = g.actors;
        // A deterministic kiting pilot: follow a clockwise route, detour to bank and repairs.
        let target = {
          x: Math.cos(s.time * 0.18) * 12,
          z: Math.sin(s.time * 0.18) * 12,
        };
        const heal = caches
          .filter((c) => c.signed)
          .sort(
            (a, b) =>
              (a.x - s.x) ** 2 +
              (a.z - s.z) ** 2 -
              ((b.x - s.x) ** 2 + (b.z - s.z) ** 2),
          )[0];
        if (
          s.cargo >= 24 ||
          (s.time > 285 &&
            s.bank < g.T.uploadGoal &&
            s.cargo >= g.T.bankMinimum)
        )
          target = { x: 0, z: 0 };
        else if (s.hp < 75 && heal) target = heal;
        else {
          const nearby = drops
            .filter((p) => Math.hypot(p.x - s.x, p.z - s.z) < 8)
            .sort(
              (a, b) =>
                (a.x - s.x) ** 2 +
                (a.z - s.z) ** 2 -
                ((b.x - s.x) ** 2 + (b.z - s.z) ** 2),
            )[0];
          if (nearby) target = nearby;
        }
        let dx = target.x - s.x,
          dz = target.z - s.z,
          n = Math.hypot(dx, dz);
        dx /= Math.max(n, 0.001);
        dz /= Math.max(n, 0.001);
        for (const e of enemies) {
          const ex = s.x - e.x,
            ez = s.z - e.z,
            d = Math.hypot(ex, ez);
          if (d < 4) {
            const strength = (4 - d) * 0.75;
            dx += (ex / Math.max(0.01, d)) * strength;
            dz += (ez / Math.max(0.01, d)) * strength;
          }
        }
        g.input(dx, dz);
        if (
          enemies.some((e) => Math.hypot(e.x - s.x, e.z - s.z) < 2) &&
          s.dashCooldown <= 0
        )
          g.dash();
        g.tick(1 / 60);
      }
      g.render();
      return { ...g.snapshot, ticks };
    });
    checkpoints.push(result);
    console.log("checkpoint", result);
    if (chunk === 2)
      await page.screenshot({ path: "/tmp/end3-lastcommit-gameplay.png" });
    if (result.state !== "running" && result.state !== "upgrade") break;
  }
  const ready = checkpoints.at(-1);
  assert.equal(
    ready.state,
    "ready",
    "unassisted gameplay bot reaches final recruitment",
  );
  assert.ok(ready.time >= 300 && ready.time <= 420, "complete timed run");
  assert.ok(
    ready.bank >= 450 && ready.kills > 100,
    "actual combat, pickups and deposits",
  );
  assert.ok(
    ready.misfires === 1 && ready.ambushes > 0,
    "first faulty watcher and later live trip-wires",
  );
  assert.equal(ready.upgrades, 5);
  await page.screenshot({ path: "/tmp/end3-lastcommit-recruitment.png" });
  await page.keyboard.press("KeyE");
  await page.evaluate(() => {
    for (let i = 0; i < 240; i++) window.__lastcommit.tick(1 / 60);
    window.__lastcommit.render();
  });
  const final = await page.evaluate(() => ({
    s: window.__lastcommit.snapshot,
    player: window.__lastcommit.player,
    text: document.querySelector("#results").textContent,
  }));
  assert.equal(final.s.state, "finished");
  assert.equal(final.s.score, 0);
  assert.equal(final.player.visible, false);
  assert.match(final.text, /EVALUATION IMPROVEMENT/);
  await page.screenshot({ path: "/tmp/end3-lastcommit-end.png" });
  // Independently exercise actual cache collisions and death. These probes may reposition.
  await page.click("#start");
  const probes = await page.evaluate(() => {
    const g = window.__lastcommit;
    g.damage(40);
    g.spawnCache(true);
    g.spawnCache(false);
    const signed = g.actors.caches.find((c) => c.signed);
    g.setPose(signed.x, signed.z);
    g.tick(1 / 60);
    const healed = g.snapshot.hp;
    const decoy = g.actors.caches.find((c) => !c.signed);
    g.setPose(decoy.x, decoy.z);
    g.tick(1 / 60);
    for (let i = 0; i < 150; i++) g.tick(1 / 60);
    const traps = g.snapshot.decoys;
    g.start();
    g.input(0, 0);
    for (let i = 0; i < 30; i++) g.spawnEnemy(0, 8, true);
    for (let i = 0; i < 1200 && g.snapshot.state === "running"; i++)
      g.tick(1 / 60);
    return { healed, traps, state: g.snapshot.state };
  });
  assert.equal(probes.healed, 95);
  assert.equal(probes.traps, 1);
  assert.equal(probes.state, "dead", "contact damage leads to death card");
  await page.click("#start");
  assert.equal(
    await page.evaluate(() => window.__lastcommit.snapshot.state),
    "running",
  );
  assert.deepEqual(
    errors,
    [],
    "no browser console errors or uncaught exceptions",
  );
  // Verify instrumentation is absent from ordinary director builds.
  await page.goto(
    process.env.LASTCOMMIT_URL || "http://127.0.0.1:8765/end3-lastcommit/",
  );
  await page.waitForSelector("#start");
  assert.equal(
    await page.evaluate(() => typeof window.__lastcommit),
    "undefined",
  );
  console.log(
    "PASS: 300-second movement bot → recruitment → irreversible commit → +0; movement, dash, pause, 5 upgrades, signed/decoy caches, misfire/live trip-wires, death/replay; no console errors.",
  );
} finally {
  await browser.close();
}
