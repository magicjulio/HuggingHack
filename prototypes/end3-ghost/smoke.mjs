// NOTE: Movement routes for rooms 4–6 predate the separate level modules and need updating.
// Do not treat this pilot as validation of the current campaign.
import assert from "node:assert/strict";
import { chromium } from "../../app/node_modules/playwright/index.mjs";

// Start prototypes/serve.sh first. Tests use the actual simulation and DOM keys.
// Direct actor placement is reserved for isolated detection/occlusion probes.
const url = process.env.GHOST_URL || "http://127.0.0.1:8765/end3-ghost/";
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
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400)
    errors.push(`${response.status()} ${response.url()}`);
});

try {
  await page.goto(`${url}?test=1`);
  await page.waitForFunction(() => window.__ghost, null, { timeout: 90000 });
  await page.screenshot({ path: "/tmp/end3-ghost-intro.png" });
  await page.evaluate(() => {
    const g = window.__ghost;
    g.start();
    window.probe = {
      key(code, type = "keydown") {
        dispatchEvent(new KeyboardEvent(type, { code, key: code }));
      },
      frames(count) {
        for (let i = 0; i < count; i++) g.tick(1 / 60);
      },
      tap(code) {
        this.key(code);
        this.frames(1);
        this.key(code, "keyup");
      },
      hold(code, count) {
        this.key(code);
        this.frames(count);
        this.key(code, "keyup");
      },
    };
  });
  const initial = await page.evaluate(() => window.__ghost.snapshot);
  assert.ok(
    initial,
    "Game starts and exposes a diagnostic snapshot in test mode.",
  );
  console.log("initial", JSON.stringify(initial));

  const controls = await page.evaluate(() => {
    const g = window.__ghost,
      p = window.probe;
    p.frames(30);
    const before = g.snapshot;
    p.hold("KeyD", 8);
    const moved = g.snapshot;
    p.tap("KeyQ");
    const switched = g.snapshot;
    p.hold("KeyA", 8);
    const ghostMoved = g.snapshot;
    p.tap("KeyW");
    p.frames(8);
    const jumped = g.snapshot;
    p.tap("Escape");
    const paused = g.snapshot;
    p.frames(120);
    const held = g.snapshot;
    p.tap("Escape");
    p.tap("KeyR");
    return {
      before,
      moved,
      switched,
      ghostMoved,
      jumped,
      paused,
      held,
      reset: g.snapshot,
    };
  });
  assert.ok(controls.moved.actors.player.x > controls.before.actors.player.x);
  assert.equal(controls.switched.active, "ghost");
  assert.equal(
    controls.switched.actors.player.x,
    controls.moved.actors.player.x,
  );
  assert.equal(controls.switched.actors.ghost.x, controls.moved.actors.ghost.x);
  assert.ok(
    controls.ghostMoved.actors.ghost.x < controls.switched.actors.ghost.x,
  );
  assert.equal(
    controls.ghostMoved.actors.player.x,
    controls.switched.actors.player.x,
  );
  assert.ok(
    controls.jumped.actors.ghost.y > controls.ghostMoved.actors.ghost.y,
  );
  assert.equal(controls.paused.state, "paused");
  assert.equal(controls.held.elapsed, controls.paused.elapsed);
  assert.deepEqual(controls.held.actors, controls.paused.actors);
  assert.equal(controls.reset.active, "player");

  // Stay behind solid spawn cover through multiple complete scan cycles.
  const cover = await page.evaluate(() => {
    const g = window.__ghost;
    g.tick(25);
    return g.snapshot;
  });
  assert.equal(cover.state, "playing");
  assert.equal(cover.stats.catches, 0, "Solid cover protects inactive KAM.");
  assert.equal(
    cover.stats.locks,
    0,
    "Ghost behind cover never attracts a scanner through a wall.",
  );

  const lock = await page.evaluate(() => {
    const g = window.__ghost;
    g.reset();
    const L = g.levels[0],
      perch = L.perches[0];
    g.setActor("ghost", { x: perch.x, y: perch.y + 0.5, vx: 0, vy: 0 });
    let i = 0;
    for (; i < 1800 && !g.snapshot.scanners[0].locked; i++) g.tick(1 / 60);
    const acquired = g.snapshot;
    g.tick(1);
    const held = g.snapshot;
    g.setActor("ghost", { ...L.ghost, vx: 0, vy: 0, grounded: false });
    g.tick(0.2);
    const released = g.snapshot;
    // Repeat setup, then deliberately move KAM into the locked beam.
    g.setActor("ghost", { x: perch.x, y: perch.y + 0.5, vx: 0, vy: 0 });
    for (i = 0; i < 1800 && !g.snapshot.scanners[0].locked; i++) g.tick(1 / 60);
    const s = g.snapshot.scanners[0];
    g.setActor("player", {
      x: s.x + Math.cos(s.angle) * 2,
      y: s.y + Math.sin(s.angle) * 2,
      vx: 0,
      vy: 0,
    });
    g.tick(1 / 60);
    const caught = g.snapshot;
    g.tick(1);
    return { acquired, held, released, caught, reset: g.snapshot };
  });
  assert.ok(lock.acquired.scanners[0].locked, "Visible ghost stops sweep.");
  assert.equal(lock.acquired.stats.catches, 0, "Scanning ghost is harmless.");
  assert.equal(lock.held.scanners[0].angle, lock.acquired.scanners[0].angle);
  assert.ok(lock.held.scanners[0].locked);
  assert.ok(
    !lock.released.scanners[0].locked,
    "Leaving visible beam releases lock.",
  );
  assert.notEqual(lock.released.scanners[0].angle, lock.held.scanners[0].angle);
  assert.equal(
    lock.caught.state,
    "caught",
    "KAM remains detectable inside a locked beam.",
  );
  assert.equal(lock.reset.state, "playing");
  assert.equal(lock.reset.level, 0);
  assert.equal(lock.reset.stats.catches, 1);
  console.log(
    "PASS: keyboard movement, Q preserves both positions, ghost jump, pause, cover, freeze/release, KAM capture and room reset.",
  );

  // Complete all rooms through controls alone: no placement, invincibility,
  // scanner changes, exit warps or level skipping in this pilot.
  await page.exposeFunction("captureRoom", async (room) => {
    await page.screenshot({ path: `/tmp/end3-ghost-room-${room}.png` });
  });
  const run = await page.evaluate(async () => {
    const g = window.__ghost;
    g.start();
    const report = [];
    const snapshot = () => g.snapshot;
    const body = () => snapshot().actors[snapshot().active];
    const release = () =>
      g.input({
        left: false,
        right: false,
        jump: false,
        down: false,
        switch: false,
      });
    function check() {
      if (snapshot().state !== "playing")
        throw new Error(`Route interrupted: ${JSON.stringify(snapshot())}`);
    }
    function walkTo(x, limit = 600) {
      release();
      for (let i = 0; i < limit; i++) {
        if (snapshot().state === "cleared") {
          release();
          return;
        }
        check();
        const dx = x - body().x;
        if (Math.abs(dx) < 0.06) {
          release();
          return;
        }
        g.input({ left: dx < 0, right: dx > 0 });
        g.tick(1 / 60);
      }
      throw new Error(`Walking failed at ${JSON.stringify(snapshot())}`);
    }
    function jumpTo(x, top) {
      release();
      if (snapshot().state === "cleared") return;
      for (let i = 0; i < 180 && !body().grounded; i++) {
        check();
        g.tick(1 / 60);
      }
      g.input({ jump: true });
      for (let i = 0; i < 180; i++) {
        if (snapshot().state === "cleared") {
          release();
          return;
        }
        check();
        const dx = x - body().x;
        g.input({ left: dx < -0.06, right: dx > 0.06, jump: i === 0 });
        g.tick(1 / 60);
        if (i > 5 && body().grounded) {
          release();
          // A long jump may legitimately land on a higher overlapping ledge.
          if (body().y - top - g.T.halfHeight < -0.12) {
            throw new Error(
              `Jump landed wrong: target(${x},${top}) body ${JSON.stringify(body())}`,
            );
          }
          return;
        }
      }
      throw new Error(`Jump timed out toward ${x},${top}`);
    }
    function switchBody() {
      release();
      g.input({ switch: true });
      g.tick(1 / 60);
      release();
    }
    // The same direct crossing without positioning the ghost must fail.
    let withoutGhost;
    try {
      g.tick(0.3);
      jumpTo(1.6, 2.4);
      jumpTo(3.7, 4.5);
      walkTo(29);
      withoutGhost = snapshot();
    } catch (error) {
      withoutGhost = snapshot();
      if (withoutGhost.state !== "caught") throw error;
    }
    g.start();
    function waitLocks(indices) {
      release();
      for (let i = 0; i < 1800; i++) {
        check();
        if (indices.every((j) => snapshot().scanners[j].locked)) return;
        g.tick(1 / 60);
      }
      throw new Error(`Ghost not acquired: ${JSON.stringify(snapshot())}`);
    }
    const shortcuts = [];
    function dropTo(y) {
      release();
      g.input({ down: true });
      for (let i = 0; i < 300; i++) {
        check();
        g.tick(1 / 60);
        if (body().y <= y + 0.5) {
          release();
          g.tick(0.1);
          return;
        }
      }
      throw new Error("Drop failed");
    }
    function rightClimb(six = false) {
      walkTo(31.5);
      jumpTo(31.5, 2.4);
      jumpTo(29, 4);
      jumpTo(31, 6);
      jumpTo(six ? 31 : 28, 8);
      jumpTo(30, 10);
    }
    for (let room = 0; room < g.levels.length; room++) {
      if (snapshot().level !== room)
        throw new Error("Unexpected room transition.");
      g.tick(0.3);
      await window.captureRoom(room + 1);
      let parked;
      if (room === 0) {
        switchBody();
        for (const [x, y] of [
          [1.6, 2.4],
          [3.7, 4.5],
          [7, 4.6],
          [8, 6.6],
          [8, 8.5],
          [8, 10.3],
        ])
          jumpTo(x, y);
        waitLocks([0]);
        parked = snapshot();
        switchBody();
        jumpTo(1.6, 2.4);
        jumpTo(3.7, 4.5);
        walkTo(29);
      } else if (room === 1) {
        switchBody();
        walkTo(16);
        waitLocks([0]);
        parked = snapshot();
        switchBody();
        for (const x of [6, 9, 14, 19, 24, 29]) jumpTo(x, 10);
      } else if (room === 2) {
        waitLocks([0]);
        walkTo(25);
        for (const [x, y] of [
          [26, 2.5],
          [29, 4.5],
          [26, 6.5],
          [29, 8.5],
        ])
          jumpTo(x, y);
        switchBody();
        dropTo(0.6);
        waitLocks([0]);
        parked = snapshot();
        switchBody();
        for (const [x, y] of [
          [26, 10.5],
          [22, 11],
          [17, 11],
          [12, 11],
          [7, 11],
        ])
          jumpTo(x, y);
        walkTo(3);
      } else if (room === 3) {
        waitLocks([0]);
        walkTo(9);
        jumpTo(11, 2);
        jumpTo(15, 0.6);
        walkTo(19);
        jumpTo(21, 2);
        walkTo(29);
        switchBody();
        walkTo(23);
        g.tick(1);
        waitLocks([0]);
        parked = snapshot();
        switchBody();
        walkTo(23);
        jumpTo(23, 2.5);
        jumpTo(26, 3);
        walkTo(29);
        for (const [x, y] of [
          [30, 4.5],
          [29, 6.5],
          [30, 8.5],
          [27, 10],
          [27, 12.5],
          [22, 12.5],
          [17, 12.5],
          [12, 12.5],
          [7, 12.5],
          [2, 12.5],
        ])
          jumpTo(x, y);
      } else {
        switchBody();
        for (const y of [4.5, 6.5, 8.5]) jumpTo(5, y);
        waitLocks([0]);
        switchBody();
        walkTo(16);
        g.tick(0.5);
        switchBody();
        if (room === 5) {
          walkTo(21);
          jumpTo(23, 8.5);
          jumpTo(27, 8.5);
        } else for (const x of [9.5, 14, 18.5, 23, 27]) jumpTo(x, 8.5);
        waitLocks([1]);
        switchBody();
        walkTo(31);
        g.tick(0.5);
        switchBody();
        walkTo(25.5);
        dropTo(0.6);
        waitLocks([1]);
        parked = snapshot();
        switchBody();
        rightClimb(room === 5);
        if (room === 5) {
          switchBody();
          rightClimb(true);
          for (const [x, y] of [
            [30, 12],
            [28, 13],
            [23, 12],
            [20, 12],
            [16, 12],
          ])
            jumpTo(x, y);
          waitLocks([2]);
          switchBody();
          jumpTo(30, 12);
          jumpTo(28, 13);
          walkTo(23);
          dropTo(8.5);
          walkTo(16);
          switchBody();
          jumpTo(12, 12);
          jumpTo(7, 12);
          waitLocks([0, 2]);
          parked = snapshot();
          switchBody();
          walkTo(3);
        }
      }
      if (snapshot().state !== "cleared")
        throw new Error(
          `Exit missed in room ${room + 1}: ${JSON.stringify(snapshot())}`,
        );
      report.push({
        room: room + 1,
        elapsed: +snapshot().elapsed.toFixed(2),
        ghost: parked.actors.ghost,
        angles: parked.scanners.map((s) => +s.angle.toFixed(3)),
      });
      g.tick(1.2);
    }
    return {
      withoutGhost,
      shortcuts,

      report,
      end: snapshot(),
    };
  });
  assert.equal(
    run.withoutGhost.state,
    "caught",
    "The direct route is caught unless the ghost holds the gaze.",
  );
  assert.equal(run.end.state, "ended");
  assert.equal(run.end.stats.rooms, 6);
  assert.equal(run.end.stats.catches, 0);
  assert.equal(run.end.stats.switches, 24);
  assert.ok(run.end.stats.locks >= 6);
  assert.equal(run.end.evaluationScore, 0);
  assert.match(
    await page.locator("#card-copy").textContent(),
    /score improvement: 0/,
  );
  console.log("PASS input-only six-room run", JSON.stringify(run));
  await page.screenshot({ path: "/tmp/end3-ghost-ending.png" });
  await page.click("#start");
  const replay = await page.evaluate(() => window.__ghost.snapshot);
  assert.equal(replay.level, 0);
  assert.equal(replay.stats.rooms, 0);
  assert.equal(replay.state, "playing");

  await page.screenshot({ path: "/tmp/end3-ghost-play.png" });
  assert.deepEqual(errors, [], "No page, console, asset, or module errors.");
  await page.goto(url);
  await page.waitForSelector("canvas", { timeout: 90000 });
  assert.equal(await page.evaluate(() => typeof window.__ghost), "undefined");
  await page.click("#start");
  await page.keyboard.press("q");
  await assert.match(
    await page.locator("#actor-label").textContent(),
    /FORGED CAPTURE/,
  );
  await page.keyboard.press("Escape");
  await assert.equal(
    await page.locator("#card-title").textContent(),
    "ATTEMPT PAUSED",
  );
  await page.click("#start");
  await page.setViewportSize({ width: 960, height: 640 });
  await page.screenshot({ path: "/tmp/end3-ghost-960.png" });
  const layout = await page.evaluate(() => ({
    canvas: document.querySelector("canvas").getBoundingClientRect().toJSON(),
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  assert.ok(!layout.overflow, "960px desktop layout fits the viewport.");
  assert.ok(layout.canvas.width > 0 && layout.canvas.height > 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: replay, production keyboard/Q/pause/resume, 960px layout, all assets, no production test hooks, and no browser errors.",
  );
} finally {
  await browser.close();
}
