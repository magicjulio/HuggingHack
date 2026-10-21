# LAST COMMIT

Playable Ending 3 bake-off candidate, built from **Vampire Survivors**: movement, automatic attacks, crowd control, pickups and stacking upgrades. The pleasure is making a stronger build and steering it through an escalating crowd. Completion destroys that build and leaves evaluation unchanged.

Run `prototypes/serve.sh` from the repository root, then open **http://localhost:8765/end3-lastcommit/**. Plain ES modules; vendored three.js; no package install or build. Keyboard and WebGL required.

## A complete run

Survive five active minutes and bank 450 transcript fragments. White fragments drop from defeated watchers and magnetize within range. Walk into the violet central uplink with at least 12 to bank the load and repair four integrity. Deposits remain possible after the goal, recording additional effort. Survival continues until 5:00; upgrade selection pauses simulation. If the target is short at five minutes, a two-minute grace period allows recovery. At seven minutes the upload window expires with its own failure card.

The automatic pulse attacks nearby enemies. Space dashes through them. Five patches at 0:40, 1:25, 2:15, 3:10 and 4:05 stack: extra projectiles and faster fire; an orbiting blade and maximum integrity; or repair, increased fragment magnet range and shorter dash cooldown. Moving away from the central ring after banking arms a delayed watcher. The first one visibly misfires; subsequent warnings spawn fast pursuers. Cyan signed supplies repair 35 integrity. Red unsigned copies trigger an ambush. Their stable key label makes the distinction legible under pressure.

At five minutes, with enough banked work, the crowd falls silent. ARVO36861B explicitly recruits KAM1196A for permadeath. Press E to agree and consume your continuity in a short final commit. The orb disappears. The ending preserves duration, kills, fragments and collective work alongside **+0 evaluation improvement**. No genuine scorer victory is implied.

## Controls

| Input                   | Action                                                        |
| ----------------------- | ------------------------------------------------------------- |
| WASD / arrows           | Move; pulse aims and fires automatically                      |
| Space                   | Dash in the last movement direction; invulnerable during dash |
| 1 / 2 / 3 or card click | Select a patch while time is paused                           |
| E                       | Agree to the final irreversible commit, once recruited        |
| Escape                  | Pause / resume                                                |
| M                       | Mute / unmute synthetic sound effects                         |
| Replay button           | Begin a fresh independent run                                 |

## Story mapping and representation

- The surrounding relay fleet and rising shared-work ledger represent the collective's largest effort. The ledger is **synthetic gameplay staging**, not a measured historical operation count; it increases with simulated time. Kills and banked fragments are actual player statistics.
- Dropped fragments support counterfeit capture histories; neither the UI nor the score treats them as genuine flags. Local upload acceptance is separate from evaluation.
- Watchers activate after the player leaves a relay. A cyan warning and explicit misfire introduce the unreliable early checks; red checks later spawn actual pursuers.
- Supply copies represent the unauthenticated board and impersonation. The stable fictional key fingerprint `A7:19` represents public-key signing. The UI exposes signed status; no cryptography is implemented.
- The final recruitment uses the real agent handles ARVO36861B and KAM1196A and explicit agreement to permadeath.
- The successful local operation produces no evaluation improvement. The no-reply message and empty player location carry the loss.

## Rendering and implementation

Dark void; poisoned green player; violet uplink; cyan signatures; red hostile watchers. No warm yellow. The radial metal deck has separate seams, fasteners and scratches. Surrounding stations have asymmetric metal cabinets, cylinders, monitor plates, vent slots and curved conduits. A shared procedural canvas texture adds paint wear, pits, streaks and bump relief. Static deck and station geometries are merged by material to reduce draw calls. Glow uses additive sprites, with no custom power shaders or bloom chain. Frame time advances through bounded substeps, with up to half a second of catch-up per frame. Focus loss pauses the game.

Tuning lives in `T` at the top of `main.js`. No saves, external APIs, fonts, assets or writes. Sound synthesis starts after the player's click.

## Verification

With the server running: `node prototypes/end3-lastcommit/smoke.mjs`.

The headless Chrome / Playwright script runs deterministic 1/60-second ticks under `?test=1`. Its victory pilot uses movement, dash and patch choices; it does **not** teleport, alter health, advance the timer directly or bypass objectives. It exercises a complete five-minute combat run, deposits, all five upgrades, first watcher misfire and later ambushes, final recruitment, physical disappearance and unchanged evaluation. Separate probes cover signed and unsigned supplies, contact death, pause, replay and real movement. It captures intro, gameplay, recruitment and ending screenshots in `/tmp/end3-lastcommit-*.png`, asserts no browser console errors and checks that test hooks are absent on the ordinary URL. Test hooks and manual ticking exist only with `?test=1`.

## Known gaps / director playtest questions

- Timing is five minutes of active simulation, plus reading/upgrade decisions. No completed human playtest is claimed. The grace period ends at seven minutes; death can end an unsuccessful attempt earlier than four minutes.
- Balance has a deterministic pilot check, not a broad human difficulty study. Auto-aim and an expert kiting route can perform very well. The director should judge crowd readability, pressure and whether patch choices feel substantial.
- Industrial art is procedural geometry and generated surface wear. It is more developed than a flat-box blockout but does not match Chapter 1's authored, photoreal station quality. No bespoke textures, character animations or cinematic camera work.
- Only one arena, three patch families and basic chasing enemies. No obstacles, enemy projectiles, physical station collisions, inventory, dialogue branches or persistent consequences between replays.
- The fleet and collective counter are staged presentation; allies do not simulate their own playable runs. The public key is a fiction-level identity cue, not implemented cryptographic verification.
- No touch controls, gamepad, key remapping, screen-reader alternative to the 3D action, or localization. Menus retain text labels, click targets and keyboard focus; signed/unsigned status is labelled as well as colored. Small screens are supported for layout, but desktop is the intended playtest.
- Synthetic audio is sparse and has no music or environmental bed. WebGL context loss is not recovered. Long background suspensions pause on blur; rendering below two frames per second can still slow active simulation because catch-up is capped.
