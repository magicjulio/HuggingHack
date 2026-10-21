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
    for (let i = 0; i < 4200 && g.snapshot.state === "flight"; i++)
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
async function fight(maxTicks = +(process.env.MAX_TICKS || 60 * 60 * 12)) {
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
        const enc = g.encounter;
        // Floor 2 building: dormant defenders (behind closed doors) are not targets;
        // targets in sight come first; out of sight, the bot walks there on the nav graph.
        const bm = enc.mode === "sections";
        const live = g.actors.enemies.filter((e) => !e.dead && e.spawn >= 1 && !e.dormant);
        const prio = (e) =>
          e.pos.distanceTo(g.pos) * (e.kind === "hugger" ? 0.4 : e.kind === "maintainer" ? 0.6 : 1);
        const eye = g.pos.clone();
        eye.y += 1.5;
        const seenNow = new Map(live.map((e) => [e, !bm || !g.blocked(eye, g.actors.hitCenter(e))]));
        live.sort((a, b) => seenNow.get(b) - seenNow.get(a) || prio(a) - prio(b));
        let e = live[0];
        let seen = e && seenNow.get(e);
        // Floor 3, the boss: a down (or stunned) hand is a crit target; the face is
        // always there. Priority: a close Hugger, a Maintainer (it heals the boss),
        // a weak hand, the adds in sight, the face.
        const B = g.boss;
        const bossOn = s.floor === 3 && B && B.active && !B.dead;
        let bossAim = null;
        if (bossOn) {
          const weak = B.weakParts().filter((w) => !g.blocked(eye, w.center) && w.left > 0.35);
          const urgent = live.find((x) => seenNow.get(x) && ((x.kind === "hugger" && x.pos.distanceTo(g.pos) < 9) || x.kind === "maintainer"));
          if (urgent) e = urgent, seen = true;
          else if (weak.length) bossAim = { key: weak[0].part, at: weak[0].center };
          else if (!e || !seen) bossAim = { key: "face", at: B.sphere("face").center.clone() };
        }
        const tkey = bossAim ? bossAim.key : e;
        if (tkey !== bot.target) {
          bot.target = tkey;
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
        let goal = null;
        if (enc.holding) {
          goal = enc.zone.clone();
          goal.x += Math.sin(ticks / 90) * 1.4;
        }
        if (e && !seen && !bossAim) {
          // awake but out of sight: go find it (aim ahead, don't fire)
          g.setInput({ fire: false, aim: false, crouched: false });
          if (!goal) goal = e.pos.clone();
        } else if (e || bossAim) {
          const c = bossAim ? bossAim.at : g.actors.hitCenter(e);
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
          if (!goal && !bossAim) {
            const delta = e.pos.clone().sub(g.pos).setY(0);
            const dist = delta.length();
            const wanted = e.kind === "hugger" ? 0 : 12;
            if (dist > wanted + 2 || g.aim === "cover") goal = e.pos.clone();
          }
          // squad: deploy on the enemy when 2+ are up (focus/move orders unused)
          if (s.ready && live.filter((x) => seenNow.get(x)).length >= 2) g.callSquad();
        } else {
          g.setInput({ fire: false, aim: false });
          if (bm && !goal) {
            // nothing awake: move on. Next open section → walk in; door unlocking →
            // wait at it; else sweep the section (wakes anyone dormant).
            const b = g.building;
            if (enc.opened > enc.section) goal = b.sections[enc.opened].center.clone();
            else if (enc.pending || enc.cleared) {
              const d = b.exitDoor(enc.section);
              if (d) goal = b.doorSide(d, enc.section, 1.5);
            } else goal = b.sections[enc.section].center.clone();
          }
        }
        // Floor 3: read the boss. Get out of a red ring (after a reaction time; sprint
        // speed), dodge (Space) when it is about to land, dodge through a shockwave,
        // and sometimes drop the squad on a winding-up hand to cut the slam.
        let escape = false;
        bot.dodgeCd -= dt;
        if (bossOn) {
          bot.seenRing ??= new Map();
          const now = s.runTime;
          for (const th of B.threats) {
            const k = th.side + th.kind + Math.round(th.x) + "," + Math.round(th.z);
            if (!bot.seenRing.has(k)) bot.seenRing.set(k, { t: now, ok: !human || Math.random() < 0.88 });
            const seenR = bot.seenRing.get(k);
            const dx = g.pos.x - th.x,
              dz = g.pos.z - th.z,
              d = Math.hypot(dx, dz);
            if (d > th.r + 0.9 || !seenR.ok) continue;
            if (now - seenR.t < (human ? 0.32 : 0.05)) continue; // reaction time
            const out = d > 0.2 ? [dx / d, dz / d] : [1, 0];
            goal = g.pos.clone();
            goal.x = th.x + out[0] * (th.r + 2.2);
            goal.z = th.z + out[1] * (th.r + 2.2);
            escape = true;
            if (th.t < 0.22 && d < th.r + 0.3 && bot.dodgeCd <= 0) {
              bot.dodgeCd = 1.2;
              g.keys.add("KeyW");
              g.aimAt([goal.x, g.pos.y + 1, goal.z]);
              key("Space");
              key("Space", "keyup");
              g.keys.delete("KeyW");
            }
            // the squad lands on the hand: the slam is cut
            if (s.ready && th.t > 0.75 && Math.random() < (human ? 0.012 : 0.05)) g.callSquad();
          }
          for (const w of B.waves) {
            const d = Math.hypot(g.pos.x - w.x, g.pos.z - w.z);
            if (!w.hit && d > w.r && d - w.r < w.speed * 0.09 && bot.dodgeCd <= 0) {
              bot.dodgeCd = 1.2;
              if (!human || Math.random() < 0.8) {
                key("Space");
                key("Space", "keyup");
              }
            }
          }
          // keep to the middle band of the arena: not under the face, not in a corner
          if (!goal) {
            const A = g.arena;
            const dc = Math.hypot(g.pos.x - A.center.x, g.pos.z - A.center.z);
            const dh = Math.hypot(g.pos.x - A.bossHome.x, g.pos.z - A.bossHome.z);
            if (dc > 14 || dh < 15) goal = A.center.clone().setY(g.pos.y);
          }
        }
        // dodge a hugger lunge aimed at us (humans won't always)
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
        const step = (escape ? 7 : 4) / 60;
        if (goal && bm) {
          // follow a nav route (re-planned every 0.5 s or when the goal moves)
          bot.pathT = (bot.pathT ?? 0) - dt;
          if (!bot.path || bot.pathT <= 0 || bot.pathGoal.distanceTo(goal) > 1.5) {
            const b = g.building;
            bot.path = b.straight(g.pos, goal, 0.42) ? [goal.clone()] : g.route(g.pos.clone(), goal) || [goal.clone()];
            bot.pathI = 0;
            bot.pathT = 0.5;
            bot.pathGoal = goal.clone();
          }
          while (bot.pathI < bot.path.length - 1 && Math.hypot(g.pos.x - bot.path[bot.pathI].x, g.pos.z - bot.path[bot.pathI].z) < 0.7) bot.pathI++;
          // no progress for 1.2 s (a corner, a teammate): skip a waypoint, re-plan
          bot.stuckAt ??= g.pos.clone();
          bot.stuckT = (bot.stuckT ?? 0) + dt;
          if (g.pos.distanceTo(bot.stuckAt) > 0.6) {
            bot.stuckAt.copy(g.pos);
            bot.stuckT = 0;
          } else if (bot.stuckT > 1.2) {
            bot.stuckT = 0;
            bot.pathI = Math.min(bot.pathI + 1, bot.path.length - 1);
            bot.pathT = 0.4;
            bot.side *= -1;
          }
          goal = bot.path[bot.pathI];
        }
        if (goal) {
          const d = goal.clone().sub(g.pos).setY(0);
          if (d.length() > 0.3) {
            d.normalize();
            const before = g.pos.clone();
            g.move(g.pos, d.clone().multiplyScalar(step), 0.42, false, true);
            if (before.distanceTo(g.pos) < 0.02) g.move(g.pos, d.set(d.z * bot.side, 0, -d.x * bot.side).multiplyScalar(step), 0.42, false, true);
          }
        } else if ((e || bossAim) && !(bot.still && bot.burst > 0)) {
          bot.sideT -= dt;
          if (bot.sideT <= 0) {
            bot.sideT = 2 + Math.random() * 2;
            bot.side *= -1;
          }
          const d = (bossAim ? bossAim.at : e.pos).clone().sub(g.pos).setY(0).normalize();
          g.move(g.pos, d.set(d.z * bot.side, 0, -d.x * bot.side).multiplyScalar(3 / 60), 0.42, false, true);
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
// START=2: skip floor 1 and the lift (quick floor-2 balance runs).
const only2 = process.env.START === "2";
// START=3: floor 3 from the express cab; START=arena (PHASE=1..3): straight into the boss.
const start3 = process.env.START === "3" || process.env.START === "arena";
if (only2) await page.evaluate(() => window.__ascent.beginFloor(2));
if (start3)
  await page.evaluate((p) => (p.arena ? window.__ascent.toArena(p.phase) : window.__ascent.beginFloor(3)), { arena: process.env.START === "arena", phase: +(process.env.PHASE || 1) });
const floor1 = only2 || start3 ? { encounterDone: true, skipped: true } : await fight();
console.log("floor1", floor1);
await page.waitForTimeout(100);
if (!only2 && !start3) await snap("end2-cleared");
assert.ok(floor1.encounterDone, "floor 1: every beat done");
if (!only2 && !start3) {
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
}
const floor2 = start3 ? { state: "lift", skipped: true } : await fight();
console.log("floor2", floor2);
// Round 4: floor 2's goal leads to the express lift → floor 3 → the boss → the end card.
let floor3 = null;
if (floor2.state === "lift" || start3) {
  if (!start3) {
    const ride3 = await page.evaluate(() => {
      const g = window.__ascent;
      let i = 0;
      for (; i < 60 * 30 && g.snapshot.state === "lift"; i++) {
        g.tick(1 / 60);
        if (i === 300) break;
      }
      return i;
    });
    await page.waitForTimeout(100);
    await snap("end2-express");
    const rest3 = await page.evaluate(() => {
      const g = window.__ascent;
      let i = 0;
      for (; i < 60 * 30 && g.snapshot.state === "lift"; i++) g.tick(1 / 60);
      return { ticks: i, state: g.snapshot.state, floor: g.snapshot.floor, pos: g.pos.toArray().map((v) => +v.toFixed(1)) };
    });
    console.log("ride3", { ticks: ride3 + rest3.ticks, ...rest3 });
  }
  floor3 = await fight(+(process.env.MAX_TICKS3 || 60 * 60 * 20));
  console.log("floor3", floor3);
  console.log("boss", await page.evaluate(() => window.__ascent.bossBalance));
}
if (floor3 ? floor3.state !== "finish" : floor2.state !== "finish")
  console.log(
    "stuck",
    JSON.stringify(await page.evaluate(() => {
      const g = window.__ascent,
        e = g.encounter,
        f = (v) => v.toArray().map((x) => +x.toFixed(1));
      return {
        pos: f(g.pos),
        section: g.section,
        enc: { mode: e.mode, section: e.section, opened: e.opened, pending: e.pending, cleared: e.cleared, holding: e.holding },
        enemies: g.actors.enemies.filter((x) => !x.dead).map((x) => ({ kind: x.kind, section: x.section, dormant: x.dormant, spawn: +x.spawn.toFixed(2), pos: f(x.pos), seen: !g.blocked(g.pos.clone().setY(g.pos.y + 1.5), g.actors.hitCenter(x)) })),
        aim: g.aim,
        boss: g.boss && { active: g.boss.active, hp: Math.round(g.boss.hp), phase: g.boss.phase, dead: g.boss.dead, done: g.boss.done, hands: Object.values(g.boss.hands).map((h) => h.state) },
      };
    })),
  );
await page.waitForTimeout(150);
await snap("end2-end");
const final = await page.evaluate(() => ({ snap: window.__ascent.snapshot, balance: window.__ascent.balance, mode: window.__ascent.encounter.mode, warnings: window.__ascent.encounter.warnings, boss: window.__ascent.boss && { done: window.__ascent.boss.done } }));
console.log("beats", final.balance.beats);
// Floor 2 as a building: time, damage and deaths per section (survive checkpoint retries).
console.log("floor2 mode", final.mode, final.warnings.length ? final.warnings : "");
if (final.mode === "sections") console.table(final.balance.sections);
console.log("balance", { taken: final.balance.taken, deaths: final.balance.deaths, runTime: +final.snap.runTime.toFixed(1) });
assert.equal(final.snap.state, "finish", "full slice reaches the completion card");
assert.ok(final.snap.encounterDone, start3 ? "floor 3: every section done" : "floor 2: every beat done");
if (floor3) assert.ok(final.boss && final.boss.done, "floor 3: the boss falls before the end card");
assert.ok(final.snap.stats.calls >= (only2 || start3 ? 1 : 2), "subagents deployed on both floors");
assert.ok(mechanics.forcedVent && mechanics.perfect, "active vent: overheat vents, a tap in the window is a perfect vent");
assert.deepEqual(errors, [], "no console errors or uncaught exceptions");
console.log(
  `PASS (${gpu ? "GPU" : "SwiftShader"}, bot ${process.env.BOT || "human"}): ${start3 ? "floor 3 only" : only2 ? "floor 2 → express → floor 3" : "intro → floor 1 → lift → floor 2 → express → floor 3"}${floor3 ? " → boss" : ""} → end card; no browser errors`,
);
await browser.close();
