# ASCENT round 3, fight: floor 2 fought through a building, section by section

**What it is:** the fight agent's handoff from the round-3 team run (brief: `2026-10-18-ascent-team-brief-r3.md`). Stopped at the coordinator's wrap-up, so balance is a first pass.
**Supersedes:** nothing. It follows `2026-10-17-ascent-combat-r2.md`.
**What changed:** floor 2 now plays on building's new level (`floor2.js`): eight sections behind locked doors, defenders already in place, a different fight in each section, a checkpoint at the last opened door. Floor 1 is unchanged.
**What the receiver must do:** Julius plays floor 2 and answers "For Julius". The next fight session works through "Left to do".
**Open questions:** see "For Julius".

## Done (`prototypes/end2-ascent/`)
- **`building.js` (new, fight):** an adapter over the level contract. It gives world coordinates, `sectionAt`, `walkable`, `straight(a, b)` (a walkable straight line: no tall collider and no step bigger than `stepUp`), A* `path(a, b)` over `level.nav` (edges through closed doors are cut; a binary heap and 4 m buckets keep a full-building route under 5 ms), `doorSide`, `ceilingAt`. Gameplay code only talks to this file, so a contract change touches one place.
- **`main.js`:**
  - **Movement and collision on floor 2:** colliders block by vertical overlap with their own `baseY`. Ground height follows the stairs and the upper level. The player falls off ledges (`T.building.gravity`); enemies never step off. There is no x/z arena clamp on floor 2. Floor 1 keeps the old rules exactly (`bld === null`).
  - **Loot:** drops land on the enemy's ground and are only collected on your own level.
  - **Camera:** a sphere cast (4 parallel rays, `camProbe`), a clamp under the section ceiling (`camCeiling`), and a snap instead of a lerp when the lagging camera would sit behind a wall.
  - **Floor start:** `beginFloor(2)` starts at `level.start` (the lift, yaw π), the escorts stand beside you, and `level.setSection` is called as you move.
  - **Retry:** a checkpoint at the last opened door (`T.building.checkpoint`).
  - **HUD:** `Section n / 8 · NAME · hostiles` and the objective line.
  - **Balance read-out:** `__ascent.balance.sections` gives time, damage, deaths, kills and squad kills per section. The time counts from the moment that section's door opens.
  - **Test hooks:** `building`, `section`, `route`, `ground`, `cameraClear`, `setPose(x, z, y)`.
  - **Fix:** a comment in `T.enemies.gunner` had swallowed `relocate, postSearch, postMin, postMax` (they were `undefined` since round 2, so gunners never relocated when flanked). Restored to the values in the round-2 design. This touches floor 1 gunners too; smoke floor 1 is still easy (0–4 damage).
- **`actors.js`:**
  - **Dormant defenders:** they idle, and wake when the director says so, when hurt (that alarms their whole section, `T.building.alarm`), or when they see you within `wakeRadius`.
  - **Movement:** `route()` follows nav waypoints when the straight line isn't walkable, with stuck recovery. A `leash` around the defender's home keeps high-ground gunners up on the mezzanine.
  - **Gunner cover posts:** only in the gunner's own section and on its own level.
  - **Ground and spawns:** ground-aware y everywhere, and drop-ins start under the ceiling.
  - **Squad:** the beacon and the drop beam stop at the ceiling, and the shockwave only hits enemies on your level.
  - **Escorts** follow you through doors.
  - **New methods:** `wake`, `wakeSection`, `aliveIn`, `clearEnemies`, `regroup`.
- **`encounter.js`:** `createSections` is the section director, and `createEncounter` picks beats (floor 1, or `?f2=arena`) or sections (floor 2 with a level).
  - **Flow:** the garrison of the next section is placed dormant behind its closed door. When the current section is clear, the door unlocks after `sectionDelay`. An ambush door first flashes red (`setAlert`) for `doorTell` with a warning toast. Then the garrison wakes and the one after is placed.
  - **Events:** `door`, `enter`, `half`, `clear`, `time` and `hold`, with `via: "drop"` (ceiling drop-in) or `"walk"` (in from a back or flank anchor).
  - **Holds:** with trickle, or `after: "clear"`.
  - **`restore(k)`** brings the floor back to checkpoint k.
- **The eight sections** (`T.encounter.sections[2]`, proposal):
  - s0 lift landing: empty, the door opens at once;
  - s1 security hall: 3 gunners, then 2 Huggers out of the side offices at half;
  - s2 open office: an advancing shield, 3 gunners and a Maintainer at the back;
  - s3 server gallery: a Warden at the far end, 2 gunners in the pod pockets, then 2 Huggers at half;
  - s4 cooling hall: 3 gunners and a Maintainer leashed to the mezzanine, Huggers on the floor, and once clear a shield and a gunner drop onto the mezzanine;
  - s5 skybridge: 2 shields at the 2 m choke, 2 gunners behind;
  - s6 operations: an ambush (red door, 2 Huggers and a shield right behind it), then hold the terminal for 14 s while they walk in from the back;
  - s7 ascent core: a Warden, a shield, 2 gunners and a Maintainer, then a dropped second wave at half, then reach the lift shaft (3 s ring after the room is clear) → the existing finish card.
- **`smoke.mjs`:**
  - **Floor-2 bot:** it ignores dormant defenders and targets what it can see first. Out of sight, it walks there along `route`. When nothing is awake it walks into the next opened section, waits at an unlocking door, or sweeps the section. It recovers when stuck, and the player moves with `canDrop`.
  - **New options:** `START=2` (floor 2 only), `MAX_TICKS`, a "stuck" dump on failure, and a per-section table.
- **`FLOOR2-REQUESTS.md`** (new) and the `DESIGN.md` section "Floor 2 as a building".
- **Previews** (GPU, real level): `design/3d/end2/previews/fight-r3-{hall,office,gallery,cooling,stairs,bridge}.png`.

## Test results (SwiftShader, port 8783)
- **Baseline before my changes:** full smoke passed (old floor 2).
- **After my changes, at wrap-up:**
  - `node --check` is clean on `main.js`, `actors.js`, `encounter.js`, `building.js` and `smoke.mjs`;
  - the page loads;
  - the final full run (`node prototypes/end2-ascent/smoke.mjs`) was stopped at Julius's request after it had passed flight and floor 1 (floor 1: every beat done, 0 damage, 19 kills; same as before, so floor 1 is unchanged), so its floor-2 part has **not** been re-checked since the last small edits (stuck recovery, per-section stats). The three floor-2-only runs below ran on the code just before those edits and all passed.
- **Earlier full run (before the s0 entry fix):** flight → floor 1 → lift → floor 2 worked up to a director bug, which was then fixed.

**Floor-2-only runs (`START=2`, human bot, 3 runs, all passed):**
| Section | time s | damage | deaths | kills (squad) |
|---|---|---|---|---|
| s0 lift landing | 3.7 | 0 | 0 | 0 |
| s1 security hall | 4.3–4.8 | 0 | 0 | 5 (1) |
| s2 open office | 8.5–10.2 | 7–56 | 0 | 5 (0–1) |
| s3 server gallery | 9.9–11.9 | 64–78 | 0 | 5 (0–1) |
| s4 cooling hall | 17.1–19.4 | 0–14 | 0 | 8 (0–2) |
| s5 skybridge | 6.9–10 | 0 | 0 | 4 (0–3) |
| s6 operations | 21.6–23 | 14–72 | 0 | 8–9 (1–2) |
| s7 ascent core | 12.4–13.1 | 0–31 | 0 | 8 (3–4) |
| **floor 2** | **~105 s of fighting** (+ walking) | **149–242** | **0** | 48–49 |

**Reading:**
- The bot is an aimbot with a 0.3 s reaction and a ~1.3° wobble. It kills a gunner in under half a second, so its times are far below a human's. My guess is that a human takes 2–3× as long, which puts floor 2 at roughly 3.5–5 min, but this needs Julius's play to confirm.
- Damage is real: 150–240 per run, regenerated between sections, and the bot never died.
- The hardest spots are s3 (the Warden's beam down the gallery) and s6 (the ambush plus the hold).
- s1 and s5 are too easy for the bot. The s1 gunners sit at the far end and die at range, and the squad breaks the s5 shield wall.
- Checkpoint verified by probe: death in s3 → R → respawn at the s2 side of d3, doors d1–d3 open, s3 garrison back in place and awake after 1.5 s, s4 placed dormant.

## Left to do
1. **Balance with a more human bot:** an aim that settles after a target switch (start at ~6° error and decay over ~0.35 s), a longer reaction time, and more misses. Then tune toward 3–5 min with 0–2 deaths for a good player. If s1 and s5 stay too easy, move the s1 gunners to `cover:1/3` (mid-hall) and add a Hugger, and put the s5 gunners at the choke with the shields.
2. **The GPU smoke run** (`SMOKE_GPU=1`) and fps on the Iris Xe with 8–10 awake enemies. `worldHit` loops over every collider (the building has a few hundred); a section-local broadphase is the next optimisation if fps drops.
3. **Browser checks by a human:**
   - the camera in s1 and s5 when hugging a wall;
   - Huggers lunging on the stairs;
   - gunners on the mezzanine popping over the rail;
   - the drop off the mezzanine rail gap.
4. **Door sound:** the director plays `waveclear` on unlock. A dedicated door sound in `audio.js` (or through building's `level.onDoor`) would read better.
5. **`T.encounter.floors[2]`** (the old beat list) is now only the `?f2=arena` fallback.

## Requests for other areas
- **building:** see `prototypes/end2-ascent/FLOOR2-REQUESTS.md` (`high` anchors for s5, cover anchors ordered from the entry, a door sound hook, and a question about the 13 `level.doors`).

## For Julius (proposals, each with its knob)
1. **Section order and content.** Each section is one data block in `T.encounter.sections[2].s0…s7` (`garrison`, `events`, `hold`, `ambush`).
2. **Doors stay locked until the section is clear,** then unlock after `T.building.sectionDelay` (1.2 s). An ambush door flashes red for `T.building.doorTell` (1.1 s; 0 = no tell).
3. **Checkpoint at the last opened door.** `T.building.checkpoint` (false = restart the floor). Each retry still adds `T.encounter.retryPenalty`.
4. **Dormant defenders wake when you are close and in sight** (`T.building.wakeRadius`, 7 m). Hurting one wakes its whole section (`T.building.alarm`).
5. **You can drop off the mezzanine; defenders can't** (they keep the high ground). `T.building.gravity`, `stepUp`.
6. **The floor ends at the next lift shaft** with a 3 s ring after the last room is clear (`s7.hold`). The end text is unchanged (placeholder for the storyteller).
7. **Gunner relocation fix** (it affects floor 1 a little). `T.enemies.gunner.relocate`, `postMin`, `postMax`, `postSearch`.
