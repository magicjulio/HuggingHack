# ASCENT round 4, fight: floor 3 and the end boss

**What it is:** the fight agent's handoff from the round-4 team run (brief: `2026-10-18-ascent-team-brief-r4.md`, spec: `2026-10-18-ascent-floor3-finale.md`).
**Supersedes:** nothing. It follows `2026-10-18-ascent-fight-r3.md`.
**What changed:** floor 2's goal now leads up the express lift to floor 3: a short corridor, then the boss arena. The new `boss.js` runs the end boss: hand slams with a red floor ring, weak points, three phases by health with waves, a roar at each change, a boss bar, a phase checkpoint, and a death beat into the finish card.
**What the receiver must do:** Julius plays floor 3 (`?floor=3`, or `?floor=3&at=arena&phase=1..3`) and answers "For Julius". The next fight session works through "Left to do".
**Open questions:** see "For Julius". The boss is named **GLM-5.2** (Julius, 2026-10-19): it is on the bar and in the toasts, with no other story claims. The end text is still a placeholder for the storyteller.

## Done (`prototypes/end2-ascent/`)
- **`boss.js` (new):** the boss's brain, numbers in `T.boss`.
  - **Hands:** idle beside the face → wind-up (the hand flies over its target and a red floor ring marks it, `looks.ring("lunge")` at 3.4 m) → slam (damage, knock-back, shake, breakable cover in the ring breaks through `arena.breakAt`) → **down** (the hand lies there: weak, crit ×2.5) → return.
  - **Moves:** single, follow (the ring tracks you for part of the tell), sweep (a line of rings the hand drags along), double (one ring on you, one where you are heading), chain (3 slams in a row), shockwave (both hands together, a red ring of force rolls out; you dodge through it with Space, the whole dodge or vault counts).
  - **Damage:** the face always takes damage (×1). A hand in the air is armoured (×0.12, it reads as "armour"/blue). A down or stunned hand takes crits (×2.5, yellow "weak" read-out).
  - **Phases by health:** at 66 % and 33 %. Each change: 2.6 s invulnerable roar (`setExpression("roar")`, "IMMUNE" read-out), camera shake, `arena.setMood(phase − 1)`, `setPhase`/`setDamage`, and that phase's wave drops in (`drop` from `arena.drops`, `side` through the arena's side doors). Damage never carries through a threshold. Small refills come in while a phase lasts.
  - **Phase 3:** the angry face blends in (`setExpression("angry", k)`), plus double slams, chains and the shockwave.
  - **Squad (Q):** the landing cuts any slam that is winding up near it; the hand is stunned (weak) for 1.8 s.
  - **The Maintainer** heals the boss first, through its tether (×4 its normal heal, never above the top of the current phase).
  - **Death beat** (4.5 s): the hands fall, the face shudders, sinks and tilts, sparks; the remaining defenders go down with it; then the finish card.
  - **Model:** the boss agent's `createBossModel` (`boss-model.js`, the logo face built from the SVG, morph-target expressions) is wired behind the same calls. `boss.js` also calls its optional `impact(side, pos)` and `setDying(k)`. `createStubBossModel` stays as the fallback if the file is missing or throws (guarded dynamic import).
- **`main.js`:**
  - **Floor flow:** floor 2 done → "EXPRESS LIFT TO THE TOP" → `startLift(3)` → arena's `world.express` ride (walk in, the climb, blend onto the gameplay camera, fade) → `beginFloor(3)`. A fade stub covers a missing express. `T.floor3.on = false` restores the old ending after floor 2.
  - **Floor 3:** `level.arena` turned into absolute coordinates; a stub arena (the plain deck) when floor 3 has no level. The arena door (`d3`) seals once you are 4 m in.
  - **Rifle and aim:** the boss's face and hands are hit spheres in the same ray as the enemies. The aim read-out shows enemy, weak or armour, and the hit numbers sit on the hit point.
  - **Retry:** the phase checkpoint puts you just inside the arena, and the boss restarts at that phase with its health at the threshold, the breakables reset, and that phase's wave again. The death screen says "Retry phase n".
  - **HUD:** `#bossbar` (new elements in `index.html`, rules at the end of `hud.css`) with the name **GLM-5.2**, the phase, 66/33 marks, a trailing ghost bar, the bar turning red in phase 3, and an IMMUNE flicker. The objective line reads "Bring it down · Phase n / 3".
  - **End card:** "THREE FLOORS SECURED", three floors lit, the end text is a placeholder (nothing claims the scorer's files were found).
  - **`T`:** `T.floors[3]`, `T.floor3`, `T.boss`, and `T.encounter.sections[3]` (s0–s2 scripts, `s3: { boss: true }`).
  - **Test entry:** `?floor=2|3`, `?at=arena`, `?phase=n`. Hooks: `boss`, `arena`, `arenaIndex`, `toArena(phase)`, `startBoss`, `bossBalance`.
- **`encounter.js`:** a section with `boss: true` calls `hooks.bossEnter` on entry and only clears once `hooks.bossDone()`.
- **`actors.js`:** allies shoot the boss's face when nothing else is in sight (`target.isBoss`); a squad focus order on the boss works; the Maintainer's `mostDamaged` prefers the hurt boss; the squad's landing reports its point (`hooks.onSquadLand`).
- **`audio.js` (additive):** `boss-tell`, `boss-slam`, `boss-down`, `boss-roar`, `boss-die`.
- **`smoke.mjs`:** the run goes on through the express ride and floor 3 to the finish card. The bot reads the boss: it gets out of rings after a 0.32 s reaction at sprint speed (misses 12 %), dodges just before impact, dodges through shockwaves (80 %), sometimes drops the squad on a winding-up hand, prioritises close Huggers, Maintainers, weak hands, then adds, then the face. New options: `START=3`, `START=arena PHASE=n`, `MAX_TICKS3`; the per-phase table `boss`.
- **`FLOOR3-REQUESTS.md`, `BOSS-REQUESTS.md`** (new), the `DESIGN.md` section "Floor 3 and the end boss".

## Test results
Julius stopped the long runs, so the last checks are short. Server on port 8786.

- **Short check (GPU, Iris Xe, `?test=1&floor=3`), zero console errors:**
  - The page loads.
  - `?floor=3` starts in the express cab on arena's real floor-3 level (`level.arena` present, arena = section s3).
  - `toArena(1)`: the boss is active in phase 1, and the bar is shown with **"GLM-5.2"**.
  - Rifle on the face: aim read-out "enemy", 5 shots took 120 hp.
  - A slam: one hand slammed (the player in the ring took 30), then lay down. The aim read-out on it was "weak", and one shot crit for 60.
  - Health set to 65 %: phase 2 at once, invulnerable (roar), health clamped to the 66 % threshold, and wave 2 dropped in (Huggers and a Maintainer through the side doors, gunners and a shield from the ceiling).
  - Health set to 30 %: phase 3. The model's `angry` weight is 0.96 after the roar, the bar reads "PHASE 3 / 3", and the arena mood is 2.
  - Health set to 0: the death beat, then the finish card "THREE FLOORS SECURED".
- **Earlier full smoke runs (SwiftShader, human bot), before the stop:**
  - `START=2`: **PASS** floor 2 → express ride → floor 3 corridor → boss → end card, no browser errors. The boss fight took 81 s (phases 24 / 24 / 32 s), with 0 deaths and 146 damage taken on floor 3.
  - `START=arena`: passed the fight in 106 s with 1 death in phase 3, after I eased phase 3. The run before that easing died 14 times in phase 3, which is why the tell, gap, damage and wave 3 are now gentler.
  - **Full run from the approach:** floor 1 and the lift passed. Floor 2's bot then got stuck at d2 (open office) for 12 simulated minutes, with defenders awake but out of sight; this is r3's floor-2 bot, and the same floor passed cleanly in the `START=2` run. A second full run was stopped at Julius's request. So the whole chain floor 1 → 2 → 3 → boss in one run is **not verified**; its parts are.
  - Maintainer probe: it walks from its closet and heals the boss through the tether (~56 hp/s), capped at the phase's top.
- **fps (Iris Xe, Vulkan, 1440 × 900, phase 3 with the boss and wave 3 awake, from the arena's south-west corner, 10 s):** **44.5 fps** (p95 33 ms). The same spot reads 41–46 fps with the boss hidden, the adds cleared, or both, so the arena scene itself is the cost, not the fight. Standing under a slammed hand (camera inside the gauntlet) dropped to 31 fps. **Not at 60.**

## Left to do
1. **fps:** 44 fps in the arena on the Iris Xe. The cost is the arena scene (arena's lights, kit and post), not the boss or the adds; a profile for arena. The camera can end up inside a slammed hand (31 fps, and it looks bad): the hands are not colliders for the camera.
2. **One full smoke run** from the approach to the end card, after the floor-2 bot's stall at d2 is looked at (r3's bot; intermittent).
3. **Human playtest:** whether 9000 hp, the tells and wave 3 land at 4–6 min, hard but fair. The bot fights in 80–110 s, about 2–3× faster than a human.
4. **The squad interrupt** works by probe logic but the bot never triggered it in the runs (0 interrupts): check by hand.
5. The hands have no collision: you can walk through a hand that is down.

## For Julius (proposals, each with its knob)
1. **Boss health 9000, phases at 66 % / 33 %:** `T.boss.hp`, `T.boss.thresholds`. Bot fight 80–110 s, so my guess for a good human is 4–6 min; your play decides.
2. **Where it is hurt:** the face ×1 always, a down hand ×2.5, a hand in the air ×0.12: `T.boss.faceMult`, `handCrit`, `handArmour`. How long a hand stays down per phase: `phases[n].down` (2.6 / 2.1 / 1.8 s).
3. **The tells:** ring radius 3.4 m (`T.boss.slam.radius`); tell 1.2 / 0.95 / 0.9 s; how much of the tell the ring follows you: `track`/`followTrack`. Slam damage 30 × 1 / 1.15 / 1.15 (`slam.damage`, `phases[n].damage`).
4. **The moves per phase:** `phases[n].moves` (weights). Phase 1 is single slams only, strictly one hand at a time (`concurrent: 1`). Phase 2 adds follow and sweep. Phase 3 adds double, chain and the shockwave (`T.boss.shockwave`, dodge through it with Space).
5. **The waves:** `phases[n].wave` and `refill`. Wave 1: 3 gunners + a shield; wave 2: 2 Huggers and a Maintainer through the side doors, 2 gunners and a shield from the ceiling; wave 3: a Warden, a Maintainer, a Hugger, 2 gunners, a shield.
6. **Roar at each change:** 2.6 s invulnerable (`T.boss.roar`).
7. **The squad cuts a slam:** `T.boss.interrupt.stun` (1.8 s of weak hand).
8. **The Maintainer heals the boss:** `T.boss.heal.scale` (×4; 0 turns it off).
9. **Phase checkpoint:** `T.boss.checkpoint` (true). The retry penalty is unchanged.
10. **The arena door seals behind you:** `T.floor3.closeDoor`, `closeAfter` (4 m).
11. **The corridor:** `T.encounter.sections[3].s1/s2` (short, on floor-2 rules).
12. **The defenders fall with the boss:** `T.boss.death.killAdds`. Death beat length `T.boss.death.time` (4.5 s).
13. **Allies shoot the face** when nothing else is up, at 0.6 of their damage: `T.boss.squadMult`.
