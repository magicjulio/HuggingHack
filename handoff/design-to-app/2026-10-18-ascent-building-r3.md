# ASCENT building r3: floor 2 is a real building (2026-10-18)

**What it is:** the building agent's round-3 handoff (brief `2026-10-18-ascent-team-brief-r3.md`). Floor 2 is now a multi-section building with doors, two levels and a Blender kit, instead of the repeated arena.
**What changed since the last handoff:** supersedes the floor-2 parts of `2026-10-17-ascent-floors-r2.md`. The old data-hall/cover kits are no longer needed (`?f2=arena` still shows the old floor 2).
**What the receiver must do:** fight/engineer: play against `world.level` (contract in `prototypes/end2-ascent/FLOOR2.md`). Julius: review the layout and look ("For Julius").
**Open questions:** see "For Julius". Stopped early at Julius's request ("hurry"): **smoke.mjs was not re-run after the art pass** (see Verified).

## Done
- **`floor2.js`** (new): `createFloor2() → level` with the full contract API: `group`, `start`, `goal`, `bounds`, `colliders` (with `baseY`, `low`, `door`, `kind`), `ground(x, z)`, `sectionAt`, `sections[]` (rects, `ceiling` as local y, entry/exit, anchors cover/high/flank/back/drop/side, `hold`), `doors[]` (open/close/setAlert, `isOpen`, `state`, `checkpoint`, `side`), `nav` (nodes/edges with door ids, `nearest`), `setSection`, `update`, `onDoor`, `ready`. Everything (walls, colliders, ground, nav, cover anchors) is generated from one `LAYOUT` table.
- **Layout:** 8 sections, about 180 m: LIFT LANDING → SECURITY HALL (narrow, side offices) → OPEN OFFICE (big) → *turn left* → SERVER GALLERY (33 m long hall, rack pockets) → *turn right* → COOLING HALL (two levels: L-shaped mezzanine at 4.5 m, **stairs up**, a drop gap) → *turn right* → SKYBRIDGE (upper level, 2.2 m choke) → OPERATIONS (terminal hold) → *turn left* → ASCENT CORE (final arena, goal at the next express lift). 7 route doors (locked orange → green on open, red flash = ambush tell) and 6 side closets with doors for reinforcement set-pieces. The map is in `FLOOR2.md`.
- **`world.js`:** builds the level, places it at floor 2, `world.level` / `world.ground()`, absolute `world.colliders` re-synced when doors change, hides the tower backdrop inside and the level during the lift ride. Floor 1 is untouched. **`floors.js`:** `useBuilding()` hides the old hall set and greybox on floor 2.
- **Art:** `design/3d/end2/floors/building.py` → `end2-floor2-kit.glb` (28k tris, 2.7 MB; worn kit.surface textures, atrium gunmetal/yellow/hazard reused): security barrier, desks, crates, equipment trunks, ops consoles, barricades, server racks (LED), cooling units, terminal, lockers, the express-lift gate, stairs, railing, door frames + sliding leaves (3 widths), ceiling lamps, plus wall/floor/raised-floor/ceiling materials for the generated architecture. In three: per-section paint tint and light colour, kick plates, light strips, pilasters with yellow slots, mezzanine fascia, windows with a ray-cast city vista (s2, s3, s5, s6, s7), merged one mesh per material per section, leaves animated in the vertex shader (one draw call per material per door), 3 pooled point lights, culling to the current section + neighbours (+1 beyond an open door). The greybox shows until the kit loads (`?f2kit=0` keeps it).
- Previews: `design/3d/end2/previews/building-r3-{start,office,gallery,cooling,bridge,core}.png` (real GPU, doors forced open).

## Verified
- `node --check` passes on floor2.js, world.js, floors.js. The page loads floor 2 with the kit on the real GPU with no console errors.
- Level probe: 159 colliders, 994 nav nodes, **all reachable from the start, goal reachable**, every door linked, checkpoints land in the right sections, ground correct on the floor, the stairs, the mezzanine and the upper sections.
- smoke.mjs (greybox stage, before the art pass): floor 1 PASS; floor 2 stayed in combat (fight was still switching the director to sections). Not re-run after the art pass.

## Not done / left
1. Re-run `smoke.mjs` and measure fps / draw calls on the Iris Xe with the kit (not measured; risk: ~20 materials per section × 3 visible sections, plus the vista shader on large windows).
2. Iterate the layout from playtests: no `FLOOR2-REQUESTS.md` from fight arrived during this run.
3. Door sounds: `level.onDoor` exists, but no sound is hooked up (fight/audio).
4. Old `floors.py -- cover|floor2` targets are dead code (never exported, not loaded, so no 404s); delete them when convenient.
5. A Blender lineup preview of the props (the `preview` arg in building.py is a stub).

## For Julius
- Is the route right? 8 sections, two left and two right turns, one climb to a mezzanine, then an upper level to the end. Each section is built for a different fight (gunner corridor, Warden down a long hall, high ground with a Maintainer, shield wall at a choke, door ambush + terminal hold, mixed final room).
- Section names on the door signs ("SECURITY HALL", "ASCENT CORE", "EXPRESS ASCENT / FL 03+" on the goal gate, …) are placeholders for the storyteller.
- Side closets (reinforcements through side doors) and per-door checkpoints are available. Using them is fight's/your call.
- Windows show a generic night city (metaphorical, not the real HQ surroundings).
