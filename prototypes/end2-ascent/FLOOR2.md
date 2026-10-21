# Floor 2: the building (layout map and contract notes)

Owner: building (`floor2.js`, `world.js`, `floors.js`). Fight asks for changes in `FLOOR2-REQUESTS.md`.
Contract changes get a dated line under "Changelog" at the bottom; old fields keep working until fight has switched.

## Layout (greybox v1, 2026-10-18)
Top view, local floor-2 coordinates (y = 0 is the floor-2 floor). x grows to the right (east), z grows up the page (north). Rooms sit 1 m apart; the gap is wall, and a door cuts a 1 m deep passage through it.

```
 z
 67 ┌──────────────── s7 ASCENT CORE (arena, y 4.5, ceiling 15.5) ─────┐
    │ back     ▓0           [NEXT LIFT SHAFT ▓▓▓]            ▓16  back│   goal (8, 61.5) hold r 3
    │          ▓            ( hold )                          ▓        │
 43 └─────────────────────────────── d7 ─────────────────────────────────┘   x -6..22
                                     │ (10, 42.5)
 42 ┌── s6 OPERATIONS (room, y 4.5, ceiling 9.5) ──┐
    │  ▭              (terminal ▓ hold 9,37.2)      │
 36 d6 ─ ─  ▭    ▭          ▭             ▭        │   x -2..16, z 26..42
    │  ▭                                           │
 26 └───────────────────────────────────────────────┘
          ▲ (-2.5, 36)
 38 ┌────────── s5 SKYBRIDGE (hall, y 4.5, ceiling 8.5) ──────────┐
 36 d5 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ▓ choke 2 m ▓ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ d6     x -27..-3
 34 └──────────────────────────────────────────────────────────────┘
    ▲ (-27.5, 36)
 40 ┌──── s4 COOLING HALL (arena, ceiling 12) ────┐
    │ ███ north mezzanine y 4.5 (z 32..40) ██████ d5
 32 │ ╱╱ ─rail─ gap ─rail─────────┐ east mezz   │
    │ ╱╱ ramp      ▓cooler         │ y 4.5       │
    │ ╱╱ y 0→4.5          ▭        │ (z 20..32)  │
 18 │ ╱╱ (x -52..-48.5)  ▓cooler   └─rail────────│
    │      ▭           ▭                         │
13.5└────── d4 ───────────────────────────────────┘   x -52..-28
            │ (-44, 13)
12.5┌─────────────── s3 SERVER GALLERY (hall, ceiling 5.5) ───────────┐
    │ back  ▭   ▓pod   ▭   ▓pod  ▭   ▓pod  ▭   ▓pod  ▭             d3 ── (-14.5, 9.6)
 5.5└──────────────────────────────────────────────────────────────────┘   x -48..-15
                                                              13 ┌──────── s2 OPEN OFFICE ─────────┐
                                                                 d3  ▓      ▭       ▓      ▓cab   │
                                                                 │   ▭   ▭     ▭    ▭     ▭       │  (room, ceiling 4.6)
                                                                 │  ▓              ▓              │  x -14..14
                                                              -5 └──────────── d2 ────────────────┘
                                                                               │ (0, -5.5)
                                                                    ┌────┐  ┌──┴──┐
                                                         west office│ ▭  ═══ │ ▭   │   s1 SECURITY HALL
                                                         (-8..-3.5) │    │  │  ▭  ═══ ┌────┐ east office
                                                                    └────┘  │ ▭   │   │ ▭  │ (3.5..8)
                                                                            │  ▭  │   └────┘
                                                                            │ ▭   │   (hall 5 m wide, ceiling 4.2)
                                                                       -30  └──┬──┘   x -2.5..2.5
                                                                               │ d1 (0, -30.5)
                                                                     -31 ┌─────┴─────┐
                                                                         │  s0 LIFT   │ (room, ceiling 6.5)
                                                                         │ ▭ [lift] ▭ │ start (0, -36.6) facing +z
                                                                   -43.5 └────────────┘ x -8..8
```
`▭` low cover (1.2 m, vaultable), `▓` tall blocks (pillars, racks, coolers), `═══` open doorway (no door).

| id | name | kind | floor y | ceiling (local y) | entry → exit | what it is for (proposal) |
|---|---|---|---|---|---|---|
| s0 | LIFT LANDING | room | 0 | 6.5 | — → d1 | arrival, catch your breath, 2 crates |
| s1 | SECURITY HALL | hall | 0 | 4.2 | d1 → d2 | gunner corridor, staggered barriers; Huggers out of the two side offices |
| s2 | OPEN OFFICE | room | 0 | 4.6 | d2 → d3 | desk rows, 4 pillars; exit in the far-left corner (**turn left**) |
| s3 | SERVER GALLERY | hall | 0 | 5.5 | d3 → d4 | 33 m long hall: a Warden at the far end covers the length; rack pods are pockets out of the beam; exit on the right (**turn right**) |
| s4 | COOLING HALL | arena | 0 + 4.5 | 12 | d4 → d5 | two levels: an L-shaped mezzanine (north + east) holds the high ground; **stairs up the west wall**; a Maintainer up top; exit from the mezzanine (**turn right**) |
| s5 | SKYBRIDGE | hall | 4.5 | 8.5 | d5 → d6 | narrow bridge with a 2 m choke: a shield wall |
| s6 | OPERATIONS | room | 4.5 | 9.5 | d6 → d7 | ambush behind the door, a hold at the terminal; exit north (**turn left**) |
| s7 | ASCENT CORE | arena | 4.5 | 15.5 | d7 → goal | the final room, everything mixed; the goal is the next lift shaft |

**Side closets** (small rooms behind a side door, for reinforcement set-pieces; part of their section): `s2a` east wall of the open office (14.5, 4) · `s3a` south wall of the gallery (−36, 5) · `s4a` back of the north mezzanine (−38, 40.5, y 4.5) · `s6a` east wall of operations (16.5, 37) · `s7a` / `s7b` west and east walls of the core (−6.5, 56) / (22.5, 56).

Route length about 180 m. Turns: left (s2→s3), right (s3→s4), climb (s4 stairs), right (s4→s5), left (s6→s7).

## The `level` API (as built)
`createFloor2(opts) → level` (`floor2.js`). `world.js` creates it once, places `level.group` at `floorY` (72) and shows it on floor 2 only (hidden during the lift ride; the tower backdrop is hidden while you are inside). `?f2=arena` brings back the old floor-2 arena.

- `world.level`: the level on floor 2, `null` on floor 1. `world.ground(x, z)`: absolute walkable y (`floorY` on floor 1).
- `world.colliders` on floor 2: **absolute copies** of `level.colliders` (`baseY + floorY`, `.local` points at the original). Re-synced automatically when a door opens or closes (`level.version` changes). `world.spawnPoints` on floor 2 = every section's `drop` anchors (absolute), only so old code keeps working.
- `level.start {x, z, yaw}`: on the lift platform, facing +z (yaw = π in main.js's convention, where yaw 0 looks at −z).
- `level.goal {x, z, y}`; `level.bounds {minX, maxX, minZ, maxZ}` of the walkable area (**replace the `T.world` x/z clamp in main.js with this on floor 2**).
- `level.colliders`: `{minX, maxX, minZ, maxZ, baseY, height, kind, low?, door?, section?}`. `kind`: `wall`, `block` (pillars, racks), `cover` (low), `rail` (mezzanine railing and stair balustrade; railings are `low`), `ledge` (the solid mass under a mezzanine: blocks you on the ground, you stand on top of it), `door`.
- **Collision rule** (exported as `blocksAt(c, y)`): a collider blocks an actor whose feet are at `y` when `baseY − 0.5 ≤ y < baseY + height − 0.35`. Main.js's current `|baseY − y| > 0.5 → skip` is not enough for the upper level: walls there have `baseY` 0 and are 8–16 m tall. Bullets: colliders are plain boxes, as now.
- `level.ground(x, z) → y`: 0 on the floor, rising on the stairs, 4.5 on the mezzanines and the upper sections. Outside the walkable area it returns the height of the nearest walkable spot. Moving off a mezzanine edge (the rail gap at x −42..−40) drops you to 0; the only way up is the stairs.
- `level.sectionAt(x, z) → id | null` (door passages count as the section the door leads out of).
- `level.sections[]`: `{id, name, kind, index, y, rects, ceiling, entry, exit, anchors, hold}`. `ceiling` is the **local y of the ceiling** (not a height above the section floor). `anchors.cover` is generated: 0.7 m behind every low piece, on the side away from the entry door. `high`, `flank`, `back`, `drop` are placed by hand. All anchors are `[x, z, y]`, local.
- `level.doors[]`: `{id, from, to, x, z, y, width, axis, rect, collider, isOpen, state, open(), close(), setAlert(on)}`. `axis` is the axis the door's width runs along. All doors start **closed and locked** (orange light). `open()` slides the panels (0.9 s); the collider leaves `level.colliders` at 55 % (`isOpen` becomes true). `close()` puts it back at once. `setAlert(true)` flashes the light red/orange (the tell before an ambush); `open()` clears it. `state`: closed, opening, open, closing.
- **Side doors** are in `level.doors` too, with `side: true`, `to: null`; they start closed. Spawn spots inside each closet are in the section's `anchors.side` as `[x, z, y, doorId]`. Open the door when the set-piece fires.
- **Checkpoints:** every route door has `door.checkpoint {x, z, y, yaw}`: 2.4 m into the next section, facing in (yaw in main.js's convention). Side doors have `null`.
- Door events for sound: set `level.onDoor = (door, event) => …` (event: opening, open, closing, closed), or `level.addDoorListener(fn)`.
- `level.nav`: `{nodes: [[x, z, y]], edges: [[i, j, doorId?]], section: [id per node], doorNodes: {doorId: node}, nearest(x, z, y?)}`. A 2 m lattice (odd coordinates) kept where an actor fits (0.55 m), linked to 8 neighbours along clear lines that never cross a ledge, plus one node in each door passage. An edge with a third element passes through that door: only use it when `door.isOpen`.
- `level.setSection(id)`: call it when the player enters a section. It shows the sections up to two doors away and moves the three pooled lights (current + neighbours). `level.current` is the last one set.
- `level.update(dt, time)`: door animation and lights. `world.update` calls it on floor 2; nothing to do in main.js.
- Helpers: `level.pointFree(x, z, y, r)`, `level.segClear(ax, az, bx, bz, r)` (walkable, no ledge, no collider; closed doors ignored), `level.blocksAt(c, y)`.

## Knobs
`?f2=arena` old floor 2 · `?f2doors=open` all doors start open (layout walks) · `?f2light=<power>` pooled light power (default 90) · `?f2kit=0` greybox only (no Blender kit).

## Changelog
- 2026-10-18 · v1.2: art pass. Kit `end2-floor2-kit.glb` dresses the layout (`level.ready` resolves when it is in). Layout cover is now `[x, z, kind, rot]` with sizes from `PIECES` (collider footprints unchanged in spirit; a few pieces moved by < 0.4 m to fit kit sizes). Windows with a city vista on s2, s3, s5, s6, s7. Culling: current section + neighbours + one more beyond an open door. API unchanged.
- 2026-10-18 · v1.1: side closets + side doors (`door.side`, `anchors.side`), `door.checkpoint`. Additive, nothing renamed.
- 2026-10-18 · v1 greybox: the full API above. Fight: switch `beginFloor(2)` to `level.start`, the x/z clamp to `level.bounds`, movement onto `world.ground` with the collision rule above.
