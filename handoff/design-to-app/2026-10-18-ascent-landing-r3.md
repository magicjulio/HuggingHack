# ASCENT landing r3: the approach is now a fight in phases, with ship lasers and a hull

**What it is:** the landing agent's part of the ASCENT team's round 3 (`2026-10-18-ascent-team-brief-r3.md`). It answers Julius's ask: "more objects floating around to dodge or shoot, maybe the ship can shoot lasers".
**What changed since the last handoff:** round 2 had no landing handoff. On disk it had `hq.js` + `end2-hq.glb` (working: logo on its mount, searchlights, beacons, fleet bays) and `barrier.js` + `end2-approach-barrier.glb` (3 picket drones, 70 draw calls each). Both are kept. The approach now runs about 40 s plus the 5.6 s landing. It has five phases, lasers, a hull and a checkpoint. Everything is instanced.
**What the receiver must do:** engineer or fight: nothing is required. There are two small requests under "Requests". Julius: play it and pick the knobs under "For Julius".
**Open questions:** the difficulty and the fail model (see "For Julius").

## How it plays now
- **Controls:** WASD or the arrow keys steer, as before. The **mouse moves a reticle**, and **left mouse or Space fires** twin wing lasers (green). The lasers have heat: holding fire overheats them in about 5 s and locks them for a moment. The reticle snaps onto a target near it and turns orange (a lock diamond), and the shots lead moving targets.
- **Phases** (reference clock, scaled with `T.flight.duration`), each with a banner:
  1. **Weapons free** (0–3.6 s): three cargo pods dead ahead, to learn to shoot.
  2. **Debris field** (3.6–12.4 s): wreckage every ~15 m (hull plates, broken girders, burnt nacelles), with yellow cargo pods among it. A pod bursts and takes its neighbours with it (chain reaction). Wreckage can be dodged, or shot apart (2–3 hits).
  3. **Interceptors** (12.4–20.4 s): HF-yellow drones dive in from ahead and from the sides. They hold a slot ahead of you, weave, and fire. **Tell:** a red eye glow 0.55 s before each shot. After about 7 s they break past you, and they can ram you.
  4. **Barrier gate** (20.4–29.8 s): six picket drones whose fields you fly round (or shoot the pod and the field collapses). Then a 120 m gate across the whole corridor with **four emitters** (HUD pips). Shoot all four or bounce off the field: you take damage and are thrown back about 2 s. After 2 bounces the escorts burn the emitters down (cyan beams), so nobody gets stuck.
  5. **HQ defences** (29.8–36.6 s): seven flak towers on the causeway edges (solid masts you can crash into), plus heads on the HQ's arm claws and podium. **Tell:** a red sight line, then a 3-round flak burst.
  6. **Cleared to land**: the autopilot takes over. Then the landing cinematic, unchanged and still **not skippable**.
- **Hull:** 100. Crash 14–22, bolt 7, flak 8, picket field 20, gate 26. There is a 0.4 s grace after each hit, and the hull regenerates 3/s after 3 s without a hit. Below 40 % the ship trails embers, and the HUD shows red edges and a pulsing bar.
- **Hull 0 (checkpoint mode):** a "HULL BREACH · rerouting" card, then back to the start of the current phase with a full hull. After 2 failures in the same phase it gets about 40 % thinner. A passive player who never touches a key still finishes in about 76 s (tested), so it never softlocks.
- **HUD** (own DOM, `fl-` styles, no shared CSS touched): reticle and lock, hull and laser bars, a "DOWNED" counter, the phase banner, gate pips and the breach card.

## Files (all landing-owned)
- New `flight-combat.js`: phases, targets, lasers, enemy bolts, turrets, interceptors, the gate, hull and breach, the test bot, and the instanced FX pools (sprites, beams, rings, shards).
- New `flight-kit.js`: `bakePrefab` and `createInstancer` (a glb prefab → one InstancedMesh per material) and `freezeStatic`. The hero dropship goes from about 150 draw calls to about 35, with the moving parts merged in their own frames.
- New `flight-hud.js` (the HUD) and `flight-sky.js` (a far armada of 420 running lights streaming into the tower, plus city light under the fog: 2 draws).
- `flight.js`: wires the combat in, adds the mouse reticle (its own `mousemove` listener while the pointer is locked), the gate knockback, the breach rewind and the wing cannons. The old box and picket obstacles are gone. Landing shot B lasts until 4.4 s. Shot C is now lower and further back, so KAM1196A walks away into a full-body over-the-shoulder frame (it was cut off before).
- `barrier.js`: rewritten to draw the picket drones instanced (body, fans, eyes and fields), with fields that collapse. It exports `fieldMaterial` and `fieldInstances` (the gate uses them too).
- `main.js` (two small edits): the `T.flight` block (duration 46, plus all the new knobs), and the flight branch now calls `flight.update(dt, keys, camera, { fire: mouseFire, sound })`.
- Blender: `design/3d/end2/landing/approach_kit.py` → `end2-approach-kit.glb` (7.7k tris, kit.surface materials `ap_*`). Previews are in `design/3d/end2/landing/previews/kit-*.png` and `design/3d/end2/previews/landing-r3-*.png` (debris, pickets and interceptors, gate, gate field, defences, the shoulder shot, the Blender kit).
- MANIFEST: added rows for `end2.approach-kit`, plus the missing round-2 rows for `end2.hq` and `end2.approach-barrier`.

## Knobs
- `T.flight`: `duration`, `difficulty` (scales wave sizes, debris density, enemy fire rate and damage), `hull`, `hullRegen`, `regenDelay`, `failMode` (`checkpoint` | `soft`), `mercyAfter`, `laser*`, `aimAssist`, `aimSensitivity`, `bolt*`, `interceptor*`, `flak*`, `turret*`, `fieldDamage`, `gateDamage`, `gateKnockback`, `seed`, `decorCount`.
- URL: `?flightdiff=0.6`, `?failmode=soft`, `?flightbot=1|0`. The bot (autopilot plus gunner) is **on by default with `?test=1`**, so `smoke.mjs` flies the real fight.

## Verified
- Headless ticked runs (like smoke) with no errors: bot run **46.3 s** of flight (1 hit, 0 breaches), then floor 1. A forced breach rewinds correctly. A passive run finishes, as above.
- `smoke.mjs` (port 8781): **the flight part passes** (`flight { state: 'combat', floor: 1, runTime: 46.3 }`), and so does floor 1. The full run **failed at the end card on floor 2**: beat `2:s0` never finished (720 s). That is the floor-2 rebuild by building and fight that is in progress, not the approach. The last smoke run (after the final small edits) was cut off by the wrap-up. All changed files pass `node --check`, and the game loaded and flew into floor 1 on the real GPU just before.
- Real GPU (Iris Xe): no console errors. FPS readings were **noisy**, because the load average was 16–20 from the other agents' Blender and Chrome runs. In a quieter moment it measured 61 fps at the debris peak, with 155 draw calls (76 from the fight, about 35 from the ship). Earlier, under load, it dipped to 40–55. **Re-measure on a quiet machine.**

## Not done or left
- Re-measure fps on a quiet machine. If it's short, the next levers are fewer materials per prefab (merge `ap_dark` and `ap_steel` into `ap_gun`) and `decorCount`.
- The dropship realism pass (`dropship.py`: kit.surface wear, telescoping gear) is not done.
- Sounds reuse existing names (`fire`, `hit`, `kill`, `kill-heavy`, `enemy-tell`, `enemy`, `hurt`, `wave`, `waveclear`, `bash`, `shield`, `overheat`, `lowhealth`). Dedicated ship-laser and explosion sounds would help.
- Human playtest of the difficulty. The bot is near perfect, and the passive run takes about 21 hits.

## Requests (to fight, owner of `main.js` and `smoke.mjs`)
1. The `startRun()` hint still says "WASD / arrow keys steer. Fly around the illuminated structures." Suggested: `"WASD steers · mouse aims · left mouse or Space fires lasers."`
2. The smoke flight budget is `3000` ticks (50 s), and the bot needs 46.3 s. Raise it to `4200` for headroom (a gate bounce or a breach adds 2–10 s).

## For Julius
- **Difficulty:** `difficulty: 1` is meant to be "hard but fair". If it's too much, try `?flightdiff=0.6`. If it's too easy, try 1.3.
- **Failing:** `checkpoint` (hull 0 sends you back to the start of the phase, and after 2 failures the phase gets lighter), or `soft` (you can't fail; hits only cost hull and time). Which one?
- **The gate mercy:** after 2 bounces your escorts shoot the emitters for you. Keep it, or make you do it yourself?
- **Length:** the approach went from 34 s to 46 s (40.4 s of flying plus the 5.6 s landing). Is that right, or should it be shorter?
- **Aiming:** a mouse reticle plus WASD steering, with light aim assist (`aimAssist`). Or would you rather steer with the mouse?
- **Look of the new things:** the interceptors and flak towers are HF yellow and gunmetal, and the cargo pods are yellow with glowing seams. See the previews `landing-r3-*.png`.
