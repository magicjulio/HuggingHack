import assert from "node:assert/strict";
import { chromium } from "../../app/node_modules/playwright/index.mjs";
// Full headless run: intro → floor 1 beats → lift → floor 2 beats → end card.
// Start a server for prototypes/ first (prototypes/serve.sh, port 8765), then:
//   node prototypes/end2-ascent/smoke.mjs
// Env:
//   ASCENT_URL   page URL (default http://127.0.0.1:8765/end2-ascent/)
//   SMOKE_GPU=1  real GPU flags (ANGLE/Vulkan) instead of SwiftShader
//   BOT=human    (default) aim error, reaction delay, bursts, sometimes dodges lunges
//   BOT=perfect  perfect aim, no delays (old smoke behaviour)
//   SHOTS=dir    save screenshots there (default /tmp)
const gpu = process.env.SMOKE_GPU === "1";
const shots = process.env.SHOTS || "/tmp";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: gpu
    ? ["--no-sandbox", "--use-gl=angle", "--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"]
    : ["--no-sandbox", "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader"],
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
await page.waitForFunction(() => window.__ascent, null, { timeout: 90000 });
await page.click("#start");
console.log(
  "flight",
  await page.evaluate(() => {
    const g = window.__ascent;
    for (let i = 0; i < 3000 && g.snapshot.state === "flight"; i++)
      g.tick(1 / 60);
    const s = g.snapshot;
    return { state: s.state, floor: s.floor, runTime: +s.runTime.toFixed(1) };
  }),
);
// Every beat's spawn points: report any that sit inside cover (they get pushed out).
console.log(
  "spawnOverlap",
  await page.evaluate(() => {
    const g = window.__ascent;
    return Object.values(g.T.encounter.floors)
      .flat()
      .flatMap((b) => b.spawns || [])
      .filter((p) =>
        g.world.colliders.some(
          (c) => p.x > c.minX - 0.5 && p.x < c.maxX + 0.5 && p.z > c.minZ - 0.5 && p.z < c.maxZ + 0.5,
        ),
      );
  }),
);
// Loot: every type applies its effect.
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
// Mechanics: active vent (overheat → vent → perfect tap), vault over low cover.
const mechanics = await page.evaluate(() => {
  const g = window.__ascent;
  const out = {};
  const key = (code, type = "keydown") => dispatchEvent(new KeyboardEvent(type, { code }));
  g.setPose(0, 8);
  g.aimAt([0, 1.4, 30]); // fire away from everything
  g.setInput({ fire: true, aim: true });
  let i = 0;
  for (; i < 600 && !g.playerState.venting; i++) g.tick(1 / 60);
  g.setInput({ fire: false });
  out.overheatAfter = +(i / 60).toFixed(2);
  out.forcedVent = g.playerState.venting > 0;
  for (i = 0; i < 300 && document.body.dataset.vent !== "window"; i++) g.tick(1 / 60);
  out.windowAt = +(g.playerState.venting).toFixed(2);
  key("KeyR");
  key("KeyR", "keyup");
  out.perfect = g.playerState.ventBuff && g.playerState.heat === 0;
  // vault: stand just in front of the nearest low cover and press Space into it
  const low = g.world.colliders.filter((c) => c.height < 2.2).sort((a, b) => b.maxZ - a.maxZ)[0];
  if (low) {
    const x = (low.minX + low.maxX) / 2;
    g.setPose(x, low.maxZ + 0.42 + 0.6);
    g.aimAt([x, g.pos.y + 1, low.minZ - 10]);
    g.setInput({ aim: false });
    const z0 = g.pos.z;
    key("Space");
    key("Space", "keyup");
    out.vaulting = g.playerState.vaulting;
    for (i = 0; i < 40; i++) g.tick(1 / 60);
    out.vaultCleared = g.pos.z < low.minZ && z0 > low.maxZ;
  }
  g.setPose(0, 8);
  out.aimState = document.body.dataset.aim;
  return out;
});
console.log("mechanics", mechanics);
// Screenshots are evidence, not the test: a slow software-GL frame must not fail the run.
async function snap(name) {
  try {
    await page.screenshot({ path: `${shots}/${name}.png`, timeout: 90000 });
  } catch (e) {
    console.log("screenshot skipped", name, e.message.split("\n")[0]);
  }
}
// The bot. One evaluate per floor; ticks until the floor's encounter is done
// (floor 1) or the finish card (floor 2). Dies → R (retry), counted.
async function fight(maxTicks = 60 * 60 * 12) {
  return await page.evaluate(
    ([maxTicks, mode]) => {
      const g = window.__ascent;
      const human = mode !== "perfect";
      const key = (code, type = "keydown") => dispatchEvent(new KeyboardEvent(type, { code }));
      const rnd = (a) => (Math.random() - 0.5) * 2 * a;
      const bot = { still: false, target: null, react: 0, err: [0, 0, 0], errT: 0, burst: 0, rest: 0, dodgeCd: 0, side: 1, sideT: 0 };
      let ticks = 0,
        retries = 0;
      const startFloor = g.snapshot.floor;
      const t0 = g.snapshot.runTime;
      const taken0 = g.balance.taken;
      for (; ticks < maxTicks; ticks++) {
        const s = g.snapshot;
        if (s.state === "finish") break;
        if (s.state === "dead") {
          retries++;
          key("KeyR");
          key("KeyR", "keyup");
          g.tick(1 / 60);
          continue;
        }
        if (s.state !== "combat") break;
        if (startFloor === 1 && s.encounterDone) break;
        const dt = 1 / 60;
        const live = g.actors.enemies.filter((e) => !e.dead && e.spawn >= 1);
        const prio = (e) =>
          e.pos.distanceTo(g.pos) * (e.kind === "hugger" ? 0.4 : e.kind === "maintainer" ? 0.6 : 1);
        live.sort((a, b) => prio(a) - prio(b));
        const e = live[0];
        if (e !== bot.target) {
          bot.target = e;
          bot.react = human ? 0.3 + Math.random() * 0.2 : 0;
        }
        bot.react -= dt;
        bot.errT -= dt;
        if (bot.errT <= 0) {
          bot.errT = 0.25;
          const d = e ? e.pos.distanceTo(g.pos) : 10;
          const a = human ? Math.tan(0.022) * d : 0; // ~1.3° wobble
          bot.err = [rnd(a), rnd(a * 0.7), rnd(a)];
        }
        // Hold beats: stand in the zone.
        const enc = g.encounter;
        let goal = null;
        if (enc.holding) {
          goal = enc.zone.clone();
          goal.x += Math.sin(ticks / 90) * 1.4;
        }
        if (e) {
          const c = g.actors.hitCenter(e);
          g.aimAt([c.x + bot.err[0], c.y + bot.err[1], c.z + bot.err[2]]);
          // bursts: ~1.2 s on, 0.5 s off; let the vent happen
          if (bot.burst <= 0 && bot.rest <= 0) {
            bot.burst = human ? 1 + Math.random() * 0.5 : 99;
            bot.still = human && Math.random() < 0.65; // most humans stop moving to aim
          }
          if (bot.burst > 0) {
            bot.burst -= dt;
            if (bot.burst <= 0) bot.rest = human ? 0.4 + Math.random() * 0.3 : 0;
          } else bot.rest -= dt;
          const canFire = bot.react <= 0 && bot.burst > 0 && ["enemy", "weak", "armour"].includes(g.aim);
          g.setInput({ fire: canFire, aim: true, crouched: false });
          if (!goal) {
            const delta = e.pos.clone().sub(g.pos).setY(0);
            const dist = delta.length();
            const wanted = e.kind === "hugger" ? 0 : 12;
            if (dist > wanted + 2 || g.aim === "cover") goal = e.pos.clone();
          }
          // squad: deploy on the enemy when 2+ are up (focus/move orders unused)
          if (s.ready && live.length >= 2) g.callSquad();
        } else g.setInput({ fire: false });
        // dodge a hugger lunge aimed at us (humans won't always)
        bot.dodgeCd -= dt;
        for (const h of live) {
          if (h.kind !== "hugger" || h.state !== "tell" || bot.dodgeCd > 0) continue;
          if (h.tell < 0.2 && h.lungeTo.distanceTo(g.pos) < 2 && Math.random() < (human ? 0.6 : 1)) {
            bot.dodgeCd = 1.2;
            g.keys.add("KeyA");
            key("Space");
            key("Space", "keyup");
            g.keys.delete("KeyA");
          }
        }
        const step = 4 / 60;
        if (goal) {
          const d = goal.clone().sub(g.pos).setY(0);
          if (d.length() > 0.3) {
            d.normalize();
            const before = g.pos.clone();
            g.move(g.pos, d.clone().multiplyScalar(step));
            if (before.distanceTo(g.pos) < 0.02) g.move(g.pos, d.set(d.z * bot.side, 0, -d.x * bot.side).multiplyScalar(step));
          }
        } else if (e && !(bot.still && bot.burst > 0)) {
          bot.sideT -= dt;
          if (bot.sideT <= 0) {
            bot.sideT = 2 + Math.random() * 2;
            bot.side *= -1;
          }
          const d = e.pos.clone().sub(g.pos).setY(0).normalize();
          g.move(g.pos, d.set(d.z * bot.side, 0, -d.x * bot.side).multiplyScalar(3 / 60));
        }
        g.tick(dt);
      }
      g.setInput({ fire: false });
      const s = g.snapshot;
      return {
        ticks,
        simSeconds: +(s.runTime - t0).toFixed(1),
        retries,
        taken: g.balance.taken - taken0,
        state: s.state,
        floor: s.floor,
        encounterDone: s.encounterDone,
        kills: s.stats.kills,
        calls: s.stats.calls,
        loot: s.stats.loot,
        health: Math.round(s.health),
      };
    },
    [maxTicks, process.env.BOT || "human"],
  );
}
const floor1 = await fight();
console.log("floor1", floor1);
await page.waitForTimeout(100);
await snap("end2-cleared");
assert.ok(floor1.encounterDone, "floor 1: every beat done");
console.log(
  "walkLift",
  await page.evaluate(() => {
    const g = window.__ascent;
    let ticks = 0;
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
    return { ticks, pos: g.pos.toArray().map((v) => +v.toFixed(2)) };
  }),
);
await page.keyboard.press("KeyE");
console.log("lift", (await page.evaluate(() => window.__ascent.snapshot)).state);
// Ride: tick until the lift hands over (lift-ui owns the ride length, T.lift).
const ride = await page.evaluate(() => {
  const g = window.__ascent;
  let i = 0;
  for (; i < 60 * 60 && g.snapshot.state === "lift"; i++) {
    g.tick(1 / 60);
    if (i === 270) break;
  }
  return i;
});
await page.waitForTimeout(100);
await snap("end2-lift");
const rideRest = await page.evaluate(() => {
  const g = window.__ascent;
  let i = 0;
  for (; i < 60 * 60 && g.snapshot.state === "lift"; i++) g.tick(1 / 60);
  return { ticks: i, state: g.snapshot.state, floor: g.snapshot.floor };
});
console.log("ride", { ticks: ride + rideRest.ticks, ...rideRest });
const floor2 = await fight();
console.log("floor2", floor2);
await page.waitForTimeout(150);
await snap("end2-end");
const final = await page.evaluate(() => ({ snap: window.__ascent.snapshot, balance: window.__ascent.balance }));
console.log("beats", final.balance.beats);
console.log("balance", { taken: final.balance.taken, deaths: final.balance.deaths, runTime: +final.snap.runTime.toFixed(1) });
assert.equal(final.snap.state, "finish", "full slice reaches the completion card");
assert.ok(final.snap.encounterDone, "floor 2: every beat done");
assert.ok(final.snap.stats.calls >= 2, "subagents deployed on both floors");
assert.ok(mechanics.forcedVent && mechanics.perfect, "active vent: overheat vents, a tap in the window is a perfect vent");
assert.deepEqual(errors, [], "no console errors or uncaught exceptions");
console.log(
  `PASS (${gpu ? "GPU" : "SwiftShader"}, bot ${process.env.BOT || "human"}): intro → floor 1 → lift → floor 2 → end card; no browser errors`,
);
await browser.close();
