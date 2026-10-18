# ASCENT — Ending 2 playable slice

Fly with the swarm into a colossal Hugging Face headquarters, fight through its atrium, and call your own squad to push up the tower.

## Director's verdict and next steps · 2026-10-16

This is an **okay MVP**, but it is not yet an engaging, finished game. The current experience feels boring, and its visuals feel like an early teenage coding project. Treat the prototype as a proof that the slice can run from intro to end card, not as an accepted gameplay or art direction.

The next phase is substantial refinement:

- Replace the placeholder look with much stronger, cohesive assets across the whole game: player, enemies, allies, weapons, effects, dropship, headquarters, atrium, lift, HUD, and end card. Improve silhouettes, materials, lighting, animation, and visual feedback so each action reads clearly and feels deliberate.
- Add visible pickups that the player can collect, with a satisfying pickup animation and useful combat rewards. Explore a clear, readable loot loop inspired by games such as Minecraft or Fortnite; decide what loot does as part of the combat redesign.
- Improve aiming substantially. It is currently hard to tell exactly what the player is aiming at. Make the reticle and target feedback easy to see, communicate when cover blocks a shot, and make the relationship between shoulder aim and the rifle's point of impact clear.
- Rework the entire combat experience for richer, more engaging play. The current loop of crouch, aim, fire, and call in allies is too repetitive. Develop meaningful decisions and varied encounters around movement, cover, enemy behavior, weapons, squad tactics, loot, and floor progression.
- Replace the improvised Hugging Face faces on the building and enemies with accurate uses of the official logo. Start from Hugging Face's [official brand assets page](https://huggingface.co/brand) and its [official brand-assets repository](https://huggingface.co/datasets/huggingface/brand-assets). Use the actual smile logo on the headquarters and enemy faces, then add the weapons or shields around it. Check the supplied brand guidance when adapting the asset for in-game use.
- Playtest and iterate on the redesigned game feel and encounters. Reassess pacing, challenge, feedback, and the value of the subagent ability before extending the climb.

## Asset pass · 2026-10-17

First pass on the verdict above. A session on the dev box was killed by the out-of-memory killer about 11 minutes in; the work was finished from a second session. Everything is on branch `end2-ascent-assets`.

- **New modules.** `art.js` (palette, procedural textures, materials, brand loader), `models.js` (player, defenders, agents, rifle, loot), `post.js` (renderer with bloom, vignette and a damage tint), `hud.css` (brand fonts, reticle states, buff chips). `lab.html` shows every model on a turntable: `?view=lineup|player|gunner|shield|agents|loot|badge`.
- **Official logo.** `assets/hf-logo.svg` and `hf-logo-with-title.svg` are the unmodified brand files. The defenders' faces, the atrium wall and the tower in the approach all use the logo extruded along its own outline, with the SVG as the front face. Weapons and shields are added around it. Fonts (Chakra Petch, JetBrains Mono) are in `assets/fonts/` with their license.
- **Loot.** Defenders drop pickups (shield-bearers almost always, gunners about 45%), weighted toward what you need. Walk over one to collect it: repair patch +35 integrity; coolant vents the rifle and stops heat for 6s; compute shard takes 10s off the subagent cooldown; overclock makes shots pierce shields for 8s. Pickups expire after 26s. These effects are first guesses and not tuned; the combat redesign still decides what loot should do.
- **Aiming.** The screen reticle shows where the camera looks. A world marker shows where the rifle actually lands, with a laser while aiming down sights. Red means an enemy is under the rifle. Amber with a cross means cover is in the way, even if the camera can see the target around it.
- **Not done:** the combat redesign itself (encounter variety, enemy behaviour, floors beyond two), the world and cover geometry, a new end card, audio, and human playtesting. `world.js` is unchanged apart from the logo. The notes about "no external assets" below predate this pass; `assets/` now exists.
- `smoke.mjs` accepts `ASCENT_URL`. The game needs the `three/addons/` import-map entry, now in `index.html`.

Keep the grand tower, armada approach, squad-assault premise, poisoned `KAM1196A`, and spawn-subagents fantasy as direction to build on. Do not treat the current placeholder art or combat tuning as approved final choices.

## Floor 2 as a building (round 3, fight) · 2026-10-18

Julius: "level 2 gets boring … the same over and over". Floor 2 is now a real building (`floor2.js`, building's layout, map in `FLOOR2.md`) fought through **section by section**. Status: **in the game**, proposal for Julius; every number is in `T.building` and `T.encounter.sections[2]` (`main.js`).

- **Flow.** Eight sections from the lift to the next lift shaft (s0 LIFT LANDING → s1 SECURITY HALL → s2 OPEN OFFICE → s3 SERVER GALLERY → s4 COOLING HALL (stairs up) → s5 SKYBRIDGE → s6 OPERATIONS → s7 ASCENT CORE). Every door is **locked (orange) until its section is clear**, then opens (green). Defenders are **already in place** behind the next door (dormant until it opens, or until they see you up close or get shot); drop-ins and side-door reinforcements are only set-pieces.
- **Every section asks something different:** a gunner corridor with Huggers out of the side offices (s1), a shield-led desk line kept alive by a Maintainer at the back (s2), a Warden covering a 33 m hall with rack pods as pockets (s3), gunners holding a mezzanine with a Maintainer up top and Huggers on the floor, taken by the stairs (s4), a shield wall at a 2 m choke (s5), an ambush behind a door that flashes red first, then a hold at the terminal with reinforcements walking in (s6), and a final mixed room with a dropped-in second wave, then reach the lift shaft (s7).
- **Retry:** checkpoint at the last opened door (`T.building.checkpoint`, on). You respawn on the near side of that door; the section behind it is reset.
- **Engine:** movement, enemies, drops and loot follow the ground (stairs, upper level; the player can drop off a ledge, enemies never do); colliders with their own `baseY`; enemies route through doors and round corners on the level's nav graph (`building.js`, A*); the camera does a cheap sphere cast and stays under the section ceiling; drop-ins start under the ceiling. Floor 1 is unchanged (flat rules when `world.level` is null).
- **Script format** (`encounter.js` → `createSections`): per section `{ title, hint, garrison: [{ kind, at: "cover:0" | "high:1" | "back" | [x, z, y], wake: "door" | "enter", mode, leash }], events: [{ on: "door" | "enter" | "half" | "clear" | "time" | "hold", via: "drop" | "walk", spawn }], ambush, hold: { time, after: "clear", trickle } }`.
- **HUD:** `Section n / 8 · NAME · hostiles` (only awake ones), `door unlocking`, `HOLD %`.
- `?f2=arena` (building's knob) brings back the old arena; floor 2 then runs the old beat list.

## Combat redesign v1 (proposal) · 2026-10-17
**Status 2026-10-18:** in the game since round 2 (see `handoff/design-to-app/2026-10-17-ascent-combat-r2.md`).

Answers "crouch, aim, fire, call in allies is boring". Everything below is a proposal for Julius; every number goes in `T`.
**Status:** designed and partly coded, **not yet in the game**. The run was stopped for budget before wiring. The game still plays the old loop described further down. Staged modules (none imported yet): `enemies.js`, `enemies-extra.js`, `encounter.js`, `projectiles.js`, `looks.js`, `actors.next.js`. To-do: `handoff/design-to-app/2026-10-17-ascent-combat.md`.

**Loop: read → position → strike → push.** Every threat has a readable tell (a red line, a red floor ring, a charging beam, a yellow tether). You answer with position (cover, flank, vault, dodge), a target choice, and the squad. Each floor is a push from the entrance to the lift, in **beats** rather than identical waves; it ends with a hold at the lift.

**Roster.** Each type asks a different question.
| Type | Role | Answer |
|---|---|---|
| Gunner | Ducks behind cover, pops up for a telegraphed burst | Shoot the pop-up, aim over the cover lip, or flank |
| Shield-bearer | Frontal block, advances, bashes you out of cover up close | Wait for its firing window, flank, overclock, or a squad drop |
| **Hugger** (new) | Rusher. Low HP, fast, lunges *over* cover after a red floor ring | Kill it on approach or dodge the lunge (Space) |
| **Warden** (new) | Heavy emplacement. Sweeping beam that cover blocks, armoured front, glowing rear core, vents after each sweep | Flank to the core, hit it while it vents, or let the squad turn it |
| **Maintainer** (new) | Support. Hangs back and heals the most hurt defender through a visible tether; flees you | Priority target; always drops a compute shard |

**Beats.** Floor 1 (easy, teaches one thing at a time): *breach* (gunners in cover) → *shield line* → *flank rush* (huggers from the balconies) → *hold the lift* while it powers up. Floor 2 (harder, damage ×1 instead of ×0.6, more attackers at once): *sentinel line* (Warden + Maintainer behind gunners) → *counter-push* (a shield wall advances on you) → *hold the ascent* under a flanking Warden, then a closing line that the climb goes on.

**Your tools.** The rifle gains **crits** (rear hits ×1.5, the Warden's core ×2.5) and an **active vent** (R, or forced on overheat: tap R again inside the window for an instant vent and a short damage buff; miss and it jams). Movement gains a **vault** (Space into low cover) and **snap to cover** (sprint into cover = crouch).

**Subagents (Q) create the decisions.** Q throws a beacon at the aimed point. After a short drop delay the squad **slams in**: a shockwave staggers everything nearby (shields swing open, Warden armour opens, lunges and heals are cut). For a few seconds they **taunt**: defenders turn to them, which bares a Warden's core or a shield-bearer's flank to you. **Q again while they are out = order**: aim at an enemy to focus it, or at the floor to move them there. So: drop on the enemy line for the stagger, behind you as a screen against huggers, or on the Warden's flank to turn it.

**Loot** drops where defenders fall, often in the open, so grabbing it is a risk. Pickups pull toward you within a few metres. Patch (+35), coolant (no heat), compute shard (squad −10 s), overclock (pierce shields and armour). Maintainers always drop compute, Wardens overclock.

Run `prototypes/serve.sh` from the repository root and open **http://localhost:8765/end2-ascent/**. Desktop keyboard and mouse; click JOIN THE SWARM to capture the mouse. Standalone three.js ES modules, using the existing vendored library; no build, downloads, or external assets.

## The playable sequence

1. A roughly 35-second steerable dropship approach. Forward flight is automatic. Dodge three broad hovering obstacles while the enormous headquarters and its emblem emerge through fog. Collisions jolt the camera and briefly delay flight. Final landing alignment is automatic.
2. Floor 1: three waves of 4, 5, and 6 smiling gunner/shield enemies in an atrium with staggered cover and open flank lanes. Two permanent allied orbs accompany you. Clearing the floor enables the lift.
3. Walk onto the far lift and press E. A nine-second ride on a moving platform pulls the camera back through the tower's exterior structure.
4. Floor 2: nine enemies, more shields, stronger shots and more concurrent attackers. Clearing the encounter produces the SLICE COMPLETE card with elapsed time, takedowns, call-ins, and retries. The real finale and the scorer-file revelation are beyond this slice.

The player is KAM1196A, represented by a poisoned green orb in an armored biped. Poison has no additional mechanical penalty. Story framing remains metaphorical; the prototype contains no real intrusion techniques.

## Controls

| Input | Flight | Combat |
|---|---|---|
| WASD / arrow keys | Steer horizontally / vertically | Move relative to camera |
| Mouse | — | Look |
| Left mouse, held | — | Fire pulse rifle |
| Right mouse, held | — | Shoulder aim; stand to fire when crouched |
| C | — | Toggle crouch |
| Shift | — | Sprint; cannot fire while sprinting |
| Space | — | Short directional dodge |
| Q | — | Spawn subagents near the aimed point |
| E | — | Activate cleared lift when nearby |
| Esc | Pause | Pause |
| R on defeat | — | Retry current floor |

The pause/defeat screens also offer a complete approach restart. Completing the slice offers another full run.

## Combat loop

Crouch behind physical cover, watch the red targeting lines and orange projectiles, rise into shoulder aim, fire controlled bursts, then move before pressure builds. The laser rifle has unlimited ammunition and heat: uninterrupted fire overheats it, while pauses cool it. Hip fire has spread; shoulder aim is precise. Shots originate at the rifle muzzle and stop at cover, even if the camera can see a target around it. Camera collision pulls the view inward near walls.

Gunners approach and fire telegraphed bursts. Shield-bearers turn more slowly, absorb most frontal damage, and lower their shields during attack windows. Flanking or distracting them is faster than firing continuously into the shield. Enemy shots travel and can be dodged. Health regenerates after four seconds without damage. Defeat restarts the current floor, restores the call-in, and adds ten seconds to elapsed time.

Floor 1 limits simultaneous enemy attacks and reduces shot damage. Floor 2 raises pressure. A perfect-aim automated player clears considerably faster than a first human run; human pacing and difficulty still need playtesting.

## Spawn subagents

Q selects a nearby deployment point along your aim, clamped to the current floor and a 16-unit reach. Three mint orbs arrive with streaks, ground rings, rising animations, particles, and a bass sound. Enemies within seven units briefly stagger. The orbs acquire targets, fire autonomously, draw attention, and move sideways around shield enemies. They expire after 12 seconds or can be destroyed; the ability recharges in 24 seconds from activation.

Two blue permanent allies provide weaker background support. Temporary agents deal substantially more damage. Their HUD shows active lifetime and the next call's cooldown. Friendly shots do not damage the player.

## Files and tuning

- `main.js`: the central **T** block at the top contains gameplay, encounter, camera, flight, world dimensions, and effects tuning; also player movement, rifle, camera, state flow, audio, HUD, and collision helpers.
- `actors.js`: enemy/ally models, combat AI, projectiles, shielding, and call-ins.
- `world.js`: two cover layouts, atrium, tower shell, fleet, and moving lift.
- `flight.js`: reusable approach sequence and craft controls.
- `index.html`: single-page shell and HUD.
- `smoke.mjs`: reproducible headless integration playthrough using the existing app's Playwright dependency.

Geometry/art proportions remain local to their modules. Gameplay balancing belongs in T. Test hooks are exposed only when the URL contains `?test=1`.

## Validation and known gaps

- Full approach → three floor-1 waves → activated lift → floor-2 encounter → completion card passed in headless Chromium with software WebGL, with zero console errors. Run `node prototypes/end2-ascent/smoke.mjs` with the server running (set `CHROME_PATH` if needed). Independent actor checks cover frontal/rear shield damage, line-of-sight blocking, cooldown, expiry, reset/disposal, and the simultaneous-attack caps.
- This is a procedural-art prototype: simple geometric bodies and synth sounds, no imported character animation, voice acting, music, or production effects.
- Navigation uses collision sliding and local steering, not a navigation mesh. Actors can take awkward routes around cover. Permanent allies are resilient background support rather than fully simulated squadmates.
- Floor 2 reuses the atrium architecture with a different cover layout. The rest of the climb, actual finale, campaign integration, saves, controller/mobile support, and settings menu are not built.
- Flight has a fixed forward route and assisted landing. The landing-to-combat handoff is a cut.
- The lift camera is scripted. The tower beyond the two playable floors is scenery.
- Human feel, difficulty, audio balance, integrated-GPU performance, and browsers other than Chromium remain unverified. Pointer lock requires a desktop browser and user click.
- The automated combat player uses perfect target knowledge and accelerated simulation; its finish time is not a human playtime benchmark.
