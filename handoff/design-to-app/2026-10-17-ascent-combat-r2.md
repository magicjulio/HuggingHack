# ASCENT combat redesign, round 2: wired into the game (partial)

**What it is:** the combat area's round-2 handoff (brief: `2026-10-17-ascent-team-brief-r2.md`). Stopped early at 90% of Julius's budget.
**Supersedes:** nothing. It follows `2026-10-17-ascent-combat.md` (round 1).
**What changed:** the combat redesign now runs in the game. Round 1's to-do items 1–9 are done, item 10 is partly done and item 11 is not done.
**What the receiver must do:** the next combat session works through the to-do below.
**Open questions:** see "For Julius". Every item is a proposal with a knob.

## What's in the game (`prototypes/end2-ascent/`)
- **`actors.js`**: `actors.next.js` was renamed to `actors.js` (the old file was unchanged since HEAD, so nothing was lost). It handles five enemy kinds, drop-in spawns, crits, Warden armour, the beacon squad call (with its shockwave, stagger and taunt), Q orders (focus or move), and squad flanking.
- **`enemies.js`**: Huggers now climb over low cover on their approach (`api.coverUnder`, `moveToward(..., overLow)`), so they no longer get stuck behind it.
- **`main.js`**:
  - **`T`**: new blocks `floors`, `enemies`, `crit`, `squad`, `loot`, `aim`, `hitStop`, plus new keys in `player` (vault, snap, knock) and `weapon` (active vent). `T.actors` is removed, and so are the old `waves`/`floor2` lists. The beats are in `T.encounter.floors`.
  - **Hooks:** `free()`, `move`/`blocked`/`worldHit` with an `ignoreLow` flag, `pushPlayer` (knock-back), `shake`, `rayLength`, `colliders`, and `damagePlayer(amount, from, continuous)`, which throttles the hurt sound and shake when `continuous` is true.
  - **Looks:** `const looks = createDefaultLooks(scene)`. This is the single line that characters swaps.
  - **Encounter director:** `createEncounter` runs floor 1 as breach → shield line → flank rush → hold the lift (15 s), and floor 2 as sentinel line → counter-push → hold the ascent (20 s), then shows "THE CLIMB CONTINUES" and the finish card. The HUD detail line reads `Beat n / N · hostiles · HOLD %`.
  - **Aim:** hit detection uses `hitCenter`/`hitRadius` and ignores enemies that are still dropping in. The aim states are `open|enemy|cover|weak|armour`, written to `body[data-aim]`. The world marker keeps a constant angular size (`T.aim.marker`).
  - **Player:**
    - vault: Space next to low cover, with i-frames;
    - snap to cover: sprinting into cover crouches;
    - knock-back;
    - active vent: R starts it, and an overheat forces it. Tapping R in the window vents instantly and gives ×1.3 damage for 5 s; a tap outside the window jams it. `body[data-vent]` is `window|jam|""`, and the window's position on the heat bar is in the CSS variables `--vent-from`/`--vent-to`;
    - hit-stop on kills (2.5× on a Warden);
    - damage numbers via `looks.number`.
  - **Loot:** drop chances per kind, guaranteed drops (Maintainer → compute, Warden → overclock), drops placed with `free()`, a magnet pull, and overclock pierces Warden armour too.
  - **Test hooks:** `__ascent.encounter`, `.balance` (damage taken, deaths, and time and damage per beat), `.aim` and `.playerState`.
- **`smoke.mjs`**:
  - the bot plays like a human (aim wobble of about 1.3°, reaction delay, bursts, standing still to aim, dodging about 60% of lunges, standing in the hold zone);
  - it retries after a death and counts the retries;
  - it checks the vent and vault mechanics;
  - it waits on `state !== "lift"`;
  - it passes when every beat is done;
  - screenshots can't fail the run;
  - `SMOKE_GPU=1` switches to the GPU flags and `BOT=perfect` gives the old perfect bot.

## Test results (SwiftShader, port 8783)
- **Previous smoke run:** passed (intro → floor 1 → lift → floor 2 → end card, no errors).
- **Latest smoke run:**
  - gameplay passed and every beat was done on both floors;
  - the console-error assertion failed only because of 2 × 404 for `end2-cover-kit.glb` and `end2-floor2-kit.glb`. These are the floors area's glbs that aren't exported yet, not combat;
  - the lift screenshot times out under SwiftShader. Lift-ui's ride is slow to render; this was logged and the run continued.
- **Not run:** the GPU smoke run and the preview screenshots.

## Balance (human bot, one run each; more runs are needed)
| | Floor 1 | Floor 2 |
|---|---|---|
| Time | 40–53 s | 59–65 s |
| Damage taken | 0–8 | 7–56 |
| Deaths | 0 | 0 |

- **Beat times:** breach 11 s, shield line 7 s, flank rush 8 s, hold 21 s; sentinel line 13 s, counter-push 16 s (most of the damage), hold 25 s.
- **Reference:** a player standing still in the open on floor 1 takes about 4 HP/s from 2 gunners (97 HP in 25 s). Bolts can be dodged by moving.
- **Reading:** floor 1 is safe for a first-timer. Floor 2 is probably too easy for a bot that keeps moving; `T` is not tuned yet.

## To-do (in order)
1. Re-run `smoke.mjs` once floors has exported the cover/floor-2 glbs (or once floors stops requesting them). Then run it with `SMOKE_GPU=1`.
2. Balance with 5+ runs per floor. If floor 2 stays too easy, raise `T.floors[2].attackers`, `T.enemies.warden.beamTurn` or `T.enemies.gunner.interval`. Keep floor 1 at about ≤ 30 damage per run.
3. Take previews of each new enemy in action: `design/3d/end2/previews/combat-{hugger,warden,maintainer,beacon,hold}.png`, with `node design/3d/tools/shot.mjs` and the GPU flags.
4. Update `DESIGN.md`: the Controls section (R vent, Space vault, sprint snaps to cover, Q again for orders), the Combat loop and Spawn subagents sections, and mark the "Combat redesign v1" status as "in the game".
5. Mechanics to check in the browser: the vault arc, snapping to cover while sprinting along a wall, the Hugger climbing over cover (visual), and `dataset.aim` staying set after leaving combat.
6. Remove the coolant-before-vent ordering quirk in the smoke test. The loot test's coolant delays the overheat by 6 s; harmless.

## Requests for other areas
- **lift-ui:**
  - style `body[data-aim=weak|armour|cover]` and `body[data-vent=window|jam]`, using `--vent-from`/`--vent-to` for the marker on the heat bar;
  - show a "VENTING · TAP R" label while `overheated`;
  - add a buff chip for the vent buff;
  - `audio.js` must play: `enemy-tell bash lunge warden-charge warden-beam vent kill-heavy land beacon order call`;
  - the HUD `onenemy` class only covers `enemy`; switch to the dataset.
- **floors:** stop requesting `end2-cover-kit.glb` and `end2-floor2-kit.glb` until they exist; the 404s fail the smoke test. Keep low cover below 2.2 m high, because the posts, vault and Hugger climbing depend on it.
- **characters:** swap the `createDefaultLooks(scene)` line in `main.js` for the fx-backed looks. Impact kinds now also include `crit`.

## For Julius (proposals, each with its knob)
1. The new roster (Hugger, Warden, Maintainer). Knobs: `T.enemies.<kind>`, and the beat lists in `T.encounter.floors`.
2. Floors play as beats that end in a hold at the lift. Knobs: `T.encounter.floors[n][i].hold.time`, `.trickle`.
3. Squad: beacon → drop → stagger → taunt; Q again gives orders. Knobs: `T.squad.dropDelay` (0 = instant), `shockRadius`, `stagger`, `taunt`, `orderCooldown`.
4. Crits and armour. Knobs: `T.crit.rear`, `T.enemies.warden.armour`/`core`.
5. Active vent on R. Knobs: `T.weapon.activeVent` (false = the old passive cooling), `ventWindow`, `ventBuff`, `ventJam`.
6. Vault and snap to cover. Knobs: `T.player.vaultReach` (0 turns vault off), `T.player.snapToCover`.
7. Hit-stop on kills. Knob: `T.hitStop.time` (0 = off).
8. Hugger hops over cover while approaching (new this round). Knob: the `overLow` argument in `enemies.js` hugger.
9. Gunners rise visibly above cover to fire and drop behind it. Knob: `T.enemies.gunner.pop`/`duck`.
