# ASCENT team run, round 3: brief (2026-10-18)

**What it is:** round 3 of the ASCENT team, with three Opus agents: **landing**, **building** (floor 2 layout and art) and **fight** (floor 2 gameplay).
**Supersedes:** the ownership table in `2026-10-17-ascent-team-brief.md` and `-r2.md`. Every other rule in the round-1 brief still applies: the shared-file rules, the look and quality rules, testing, and the deliverables. Read it first.
**What changed since round 2:** Julius played it ("much better now for sure … we're making real progress"). Everything up to now is committed (`1b0a174`). His two asks are below.
**Open questions:** every gameplay or look choice is a proposal for Julius. Keep each one switchable through `T` or a URL knob, and list it under "For Julius" in your handoff.

## Julius's asks (verbatim where quoted)
1. **Landing:** "the landing scene has to get a bit more difficult. more objects floating around to dodge or shoot. currently its also boring." Round 3: "should make the landing scene more richer. more objects floating around, maybe the ship can shoot lasers to break through some obstacles or enemies."
2. **Floor 2:** "level 2 gets boring after a while because there its just the same over and over again." Round 3: "making the second floor a longer floor. maybe doors mark sections and we fight through it instead of new enemies spawning the whole time. not just straight but sometimes go left or right or a little bit upstairs like an actual building with smaller halls and bigger areas we have to push through."
3. **Keep:** "the kinds of enemies we have right now are great btw! already very diverse (healer, jumper, the big laser shooter, normal etc.)". **Don't add new enemy kinds.** Variety comes from layout, placement, combinations and set-pieces.
4. **Keep:** the landing cinematic stays **not skippable** (Julius, 2026-10-17). Floor 1 stays as it is: easy, the atrium, the hold at the lift.

## Ownership, round 3
| Agent | Owns |
|---|---|
| **landing** | `flight.js`, `barrier.js`, `hq.js`, any new `flight-*.js` modules, `design/3d/end2/landing/`, `design/3d/end2/dropship.py`, the `end2-dropship*`, `end2-hq*` and `end2-approach-*` glbs, the `T.flight` block in `main.js`, and the flight branch of the main loop (`state === "flight"`: passing mouse and fire input to `flight.update`) |
| **building** | new `floor2.js` (the floor-2 level: layout, geometry, doors, colliders, ground height, nav graph, lighting, culling), `floors.js`, `world.js` (all of it this round; nobody else edits it), the floor-2 arrival in `lift.js` (small edits only, if the lift must land in the new building), `design/3d/end2/floors/`, the `end2-floor2*` and `end2-cover*` glbs, and `prototypes/end2-ascent/FLOOR2.md` (the layout map and contract notes) |
| **fight** | `main.js` gameplay (`T` except `T.flight`; the player, the camera, aim, the encounter, loot, retry), `encounter.js`, `actors.js`, `enemies.js`, `enemies-extra.js`, `projectiles.js`, `looks.js`, `smoke.mjs`, `DESIGN.md`, and `prototypes/end2-ascent/FLOOR2-REQUESTS.md` (requests to building) |

**Shared:** `main.js` (fight owns it; landing edits only `T.flight` and the flight branch), `audio.js` (anyone may add new sound names with small edits, but don't change existing ones), `index.html`/`hud.css` (only add new elements or rules for your own feature; don't restyle existing ones). `fx.js`/`models.js`/`lift.js` have no owner this round: only small, additive edits if you really need them.

## The floor-2 contract (building ↔ fight)
Both agents start at the same time. **Building delivers a playable greybox of the whole layout with this full API first** (before any Blender art), so fight can play against real geometry early. Until then, fight works on the engine side (ground height, camera, nav, director) against a stub.

`floor2.js` exports `createFloor2(opts) → level`. Coordinates are local to the floor-2 base (y = 0 is the floor-2 floor; `world` adds `floorY`):
```
level = {
  group,                               // all floor-2 geometry
  start: { x, z, yaw },                // where the player begins (ideally where the lift arrives)
  colliders: [{ minX, maxX, minZ, maxZ, baseY, height, low?, door? }],   // walls, pillars, cover; low = vaultable cover (height ≤ ~1.4)
  ground(x, z) → y,                    // walkable height: 0 on the main floor, rising along ramps or stairs, flat on upper levels
  sections: [{
    id, name, kind: "hall" | "room" | "arena" | "stair",
    rects: [{ minX, maxX, minZ, maxZ }],      // the walkable area (union of rects)
    ceiling,                                  // height for the camera
    entry: doorId | null, exit: doorId | null,
    anchors: { cover: [[x, z, y]], high: [[x, z, y]], flank: [[x, z, y]], back: [[x, z, y]], drop: [[x, z, y]] },
    hold?: { x, z, y, r },                    // optional objective spot
  }],
  doors: [{ id, x, z, y, width, axis, isOpen, open(), close(), collider }],   // open() animates, and drops the collider once passable
  nav: { nodes: [[x, z, y]], edges: [[i, j]] },  // waypoint graph through doors, round corners, up the stairs (enemies and the smoke bot)
  goal: { x, z, y },                   // the end objective of the floor
  setSection(id),                      // the section the player is in (culling, lighting, alarms)
  update(dt, time),
}
```
- `world.setFloor(2)` uses `level` instead of the arena: its colliders, spawn anchors and start. `world` exposes `world.level` (null on floor 1) and `world.ground(x, z)` (absolute y; `floorY` on floor 1).
- Contract changes: building writes them in `FLOOR2.md` (with a dated line) and keeps the old fields working until fight has switched. Fight asks for anything new in `FLOOR2-REQUESTS.md`. **Both re-read the other's file at every numbered step.**

## Floor 2 direction (building + fight)
- **A real building, fought through section by section.** About 6–9 sections from the lift arrival to the goal:
  - **a mix of sizes:** narrow halls, offices, a big open area or two, and a final arena;
  - **at least two turns** (left and right) and **at least one climb**: stairs or a ramp up to a mezzanine or upper level, with enemies holding the high ground;
  - **doors between sections:** closed and locked until the section is clear, then they open (an animation, a light change from orange to green, and a sound).
- **Defenders are already in place** (a garrison in cover, on balconies, behind the next door) instead of dropping in all the time. Use drop-ins and side-door reinforcements sparingly, as set-pieces.
- **Every section should feel different:** for example a gunner corridor, a Warden covering a long hall, Huggers out of side offices, a shield wall at a choke, a Maintainer that has to be reached up the stairs, an ambush when a door opens, a hold at a terminal, and a final room that mixes everything. Same enemy kinds, new combinations and spaces.
- **Pacing:** about 3–5 minutes for a good player. Floor 2 is the hard floor. Hard but fair: tell clearly what's coming (door lights, a tell before ambushes).
- **Retry:** propose a checkpoint at the last opened door (as a `T` knob, on by default), because a long floor restarted from the beginning punishes too hard.
- **The end:** the floor ends at `goal` (for example a hold at a terminal or the next lift shaft), then the existing finish and end card. Text stays a placeholder for the storyteller; never invent incident facts.
- **Engine work this needs (fight):**
  - movement, enemies, drops and loot on `ground()`;
  - colliders with their own `baseY`;
  - a third-person **camera that doesn't clip into walls** in narrow halls;
  - enemies that path through doors and round corners (`nav`);
  - enemies in sections the player hasn't reached stay dormant;
  - the director extended to sections;
  - the smoke bot walks the building along `nav`.
  - **Floor 1 must keep working unchanged.**
- **Look (building):** the realism bar is the Ch1 flag stations (worn, `kit.surface()`), with a modular Blender kit (wall, door frame and door, stairs or ramp, railing, window bay, ceiling pieces, cover pieces), instanced or merged. **Drop the unbuilt old floor-2 and cover kits, or build them**, so there are no more 404s. Keep the HF yellow/orange language. Only render the sections near the player; 60 fps on the Iris Xe.

## Landing direction (landing)
- **Richer and harder.** The sky is full of things: drifting wreckage and debris fields, cargo pods, broken drones, barrier pickets (`barrier.js`), interceptor drones that shoot at you, defence turrets on the approach. Some must be dodged, some can be shot, and some **must** be shot to get through, such as a barrier gate whose emitter nodes you break with your lasers.
- **Ship lasers:** the dropship fires (left mouse, or a key if the mouse is awkward; your call), with a clear reticle, satisfying hits and break-up effects. Propose a hull or penalty model with a knob, and keep failure fair. The approach can get longer than 34 s if the pacing needs it (`T.flight.duration`); build it as phases that escalate.
- **Also from round 1:**
  - check what's on disk from the stopped round-2 landing agent (`hq.js`, `end2-hq.glb`, `barrier.js`, the barrier glb), and finish or fix it;
  - land the ship against the real HQ with clean cameras.
- **Keep:** the landing cinematic (not skippable), the official HF logo unmodified, the fleet, and 60 fps (instanced debris, pooled lasers and bursts).

## Testing and ports
Landing 8781, building 8782, fight 8783 (8765 and 8778 are already running; don't stop them). Run `node prototypes/end2-ascent/smoke.mjs` after every big step. Fight keeps the smoke run passing through the new floor 2, and building keeps the game loading at every step. Real-GPU screenshots with `design/3d/tools/shot.mjs`, using the flat-frame check.

## At the end
A new handoff `handoff/design-to-app/2026-10-18-ascent-<agent>-r3.md` (done, left, "For Julius"), previews in `design/3d/end2/previews/<agent>-r3-*.png`, MANIFEST rows for new glbs (status `draft`), and a short final report. **No commits.** If you get a wrap-up message, stop at the next safe point: the game loads, smoke passes or the failure is documented, and the handoff is written.
