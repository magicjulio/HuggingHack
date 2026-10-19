# Floor 3: the summit (layout map and contract notes)

Owner: arena (`floor3.js`, `world.js`, `floors.js`, `lift.js` express ride). Fight asks for changes in `FLOOR3-REQUESTS.md`.
Contract changes get a dated line under "Changelog" at the bottom; old fields keep working until fight has switched.

## How it is built
`floor3.js` feeds its own layout table through floor 2's generator (`createFloor2({ layout })`), so **every floor-2 rule holds**: walls, colliders, `ground()`, `sectionAt()`, sections with anchors, doors (locked, `open()/close()/setAlert()`, `checkpoint`), side closets, the nav graph, culling, pooled lights and the floor-2 kit dressing. `building.js` and the section director run unchanged. On top of that: `level.arena` (below), the arena's own pieces (roof columns, the boss cradle, breakable cover), arena lights with `setMood`, and the floor-3 kit (`end2-floor3-kit.glb`).

`world.setFloor(3)` uses this level: `world.level` is the floor-3 level, `world.floorY` = 144 (2 × `T.world.floorHeight`), `world.ground(x, z)` = 144 + `level.ground(x, z)`, `world.colliders` = absolute copies (re-synced on door changes **and when a breakable breaks**). The atrium deck (old lift, its rails, the legacy boxes) is hidden on floor 3. `world.levels[2|3]` reach both levels from tests.

## Layout (greybox v1, 2026-10-18)
Local floor-3 coordinates (y = 0 is the floor-3 floor), x east, z north (up the page). Everything is on one level (y 0).

```
 z 165 ┌───────────── s3 SUMMIT HALL (arena, 50 × 48 m, ceiling 26) ─────────────┐
       │ ░░░░░░░░░░░░ north wall = one huge window (night city) ░░░░░░░░░░░░░░ │
       │                  ▓▓▓▓ cradle ▓▓▓▓  ← boss home (8, 157.3)             │
  s3b ═╡   █ col          (x 2.5..13.5, z 156.3..161.3, 2.2 m)        col █   ╞═ s3d
       │     ▭b                      ▭b                                ▭b      │   ▭  low cover (vault)
       │  ▭     ▭b         ▭          ▭b           ▭b          ▭              │   ▭b breakable (slams)
       │     ▭        ▭         ▭b        ▭             ▭                     │   █  roof column (tall)
  s3a ═╡   █ col    ▭       ▭b       ▭          ▭b     ▭    col █            ╞═ s3c
       │   ▭     ▭b           ▭           ▭b          ▭                        │
       │        ▭      ▭b             ▭           ▭b                           │
 z 117 └────────────────────────────── d3 (8, 116.5) ───────────────────────────┘  x −17 .. 33
                                         │  3.6 m, the gate (closes behind you)
 z 116 ┌──────────── s2 ANTECHAMBER (room, 28 × 16, ceiling 8) ────────────┐
       │  ▭console   ▓          ▭crate          ▓          ▭console        │   x −6 .. 22
       │        ▭desk                                ▭desk                 │
       │  ▭        █col                         █col               ▭       │
 z 100 └────────────────────────── d2 (8, 99.5) ───────────────────────────┘
 z 99      ┌─ s1 SERVICE SPINE (hall 6 × 22, ceiling 4.8) ─┐
           │ ▭    ▭    ▭    ▭  (staggered barricades)      ╞═ s1a closet (east, z 90)
 z 77      └────────────── d1 (8, 76.5) ───────────────────┘   x 5 .. 11
 z 76  ┌──── s0 EXPRESS LANDING (room 16 × 10, ceiling 6) ────┐
       │ ▭                                          ▭         │   x 0 .. 16
 z 66  └──────────┐  [ cab alcove ]  ┌──────────────────────── ┘
 z 61.5           └──  x 5.5..10.5 ──┘   start (8, 63.6), facing +z (yaw π)
```

| id | name (placeholder) | kind | ceiling (local y) | entry → exit | for (proposal) |
|---|---|---|---|---|---|
| s0 | EXPRESS LANDING | room | 6 | — → d1 | the cab arrives; 2 crates; a breath |
| s1 | SERVICE SPINE | hall | 4.8 | d1 → d2 | 22 m corridor, 4 staggered barricades, Huggers out of closet `s1a` |
| s2 | ANTECHAMBER | room | 8 | d2 → d3 | the last garrison before the boss: consoles, desks, 2 pillars + 2 columns |
| s3 | SUMMIT HALL | arena | 26 | d3 → — | the boss arena |

Route ≈ 60 m of corridor, then the arena. **Arena:** 50 × 48 m = 2400 m² (ASCENT CORE is 672 m², the atrium ≈ 2100 m²), ceiling 26 m (core 11 m above its floor, atrium ≈ 18). Five staggered rows of low cover (20 pieces, 9 of them breakable), four roof columns (2.6 m, full height), the boss cradle at the far end in front of a window wall the full width of the room. Four side closets (two per side wall) with side doors for the waves.

## The `level` API
Exactly `FLOOR2.md`'s "The `level` API" (same fields, same rules, local coordinates). Notes for floor 3:
- `level.start` = in the express cab, facing +z. `level.goal` = the arena centre (there is no lift up here).
- `level.sections`: s0..s3 as above. Arena `anchors.cover` (20 spots behind low cover), `anchors.drop` (8), `anchors.side` (12 spots in 4 closets, `[x, z, y, doorId]`), `back`, `flank`. No `high` (the arena is flat in v1).
- Doors: route doors `d1` `d2` `d3` (all start closed and locked, `checkpoint` on each), side doors `s1a`, `s3a` `s3b` (west) `s3c` `s3d` (east).
- Collider `piece` names on floor 3: `f3_break` (breakable low cover, `low: true`), `f3_pylon` (roof column, `kind: "block"`), `f3_cradle` (the boss's base, `kind: "block"`, 2.2 m, not vaultable).

## `level.arena` (Contract 1)
All local (add `world.floorY` to y), like the rest of the level.
```
level.arena = {
  section: "s3", gate: "d3",              // the arena section; the door you came in by (close() it behind you)
  rect: {minX, maxX, minZ, maxZ},         // the arena's walkable rect (−17..33, 117..165)
  center: {x, z, y}, radius,              // (8, 141, 0), 22: the fight space
  ceiling: 26,
  bossHome: {x, z, y},                    // (8, 157.3, 6): x/z = under the face's centre; y = height of the
                                          //   boss model's root (bottom of the face) over the floor (?f3faceY)
  cradle: {minX, maxX, minZ, maxZ, top},  // the block under the boss (not walkable, not a slam target)
  slamZone: [{minX, maxX, minZ, maxZ, y}],// where hands may land: the floor minus a 1.2 m wall strip, the gate
                                          //   mouth (3.5 m) and the cradle. 4 rects, y = 0
  inSlamZone(x, z) → bool,
  drops: [[x, z, y]],                     // 8 drop-in spots (same as anchors.drop)
  sideDoors: ["s3a", "s3b", "s3c", "s3d"],// open one, spawn at anchors.side entries with that door id
  cover: [[x, z, y]],                     // anchors.cover of the arena
  breakables: [{id, collider, group, broken, break(dir?), reset()}],
  breakAt(x, z, r = 2.5, dir?) → count,   // break every breakable within r of (x, z) (a slam's impact)
  resetBreakables(),                      // a phase retry: everything back
  setMood(k, instant?),                   // 0 calm (cool white), 1 phase 2 (amber), 2 phase 3 (dark red, beacons pulse)
  mood,                                   // current (blends ~1 s)
}
```
- `break()` removes the collider from `level.colliders` and bumps `level.version`; `world.colliders` re-syncs on the next `world.update`. The nav graph is **not** rebuilt (it was built with the cover in place, so routes stay valid, only a little cautious). `level.onBreak = (b) => …` fires on each break (sound hook). `dir` (a `THREE.Vector3`, optional) throws the debris away from the impact.
- The arena lights stay in the scene for the whole of floor 3 (no shader recompiles when sections cull); they go dark while the arena is culled.

## The express ride (floor 2 → floor 3)
`world.express` (lift.js). A through-car cab climbing the outside of the tower's prow from the EXPRESS ASCENT gate in ASCENT CORE to the top floor. Board through its back door (from floor 2), get off through the front (floor 3). Absolute coordinates.
```
world.express = {
  config: { duration: 8.5, walkTime: 1.1, blendFrom: 0.8, blendTo: 0.96, fogFar: 640, fadeIn: 0.05, fadeOut: 0.93 },  // + T.express overrides
  entry,              // Vector3: floor 2's goal (where the walk into the cab starts)
  begin(),            // show the ride set, hide floor 2 (world.update does it while active)
  setProgress(p),     // 0..1: cab height floor 2 → floor 3 (pass the eased t)
  base(out?) → Vector3, // the cab floor centre now (where the player stands)
  shot(t, base, camera),// cinematic camera for ride time t (0..1), like world.lift.shot
  end(),              // hide the ride (world.setFloor() calls it; safe to call twice)
  active, assembly,   // the cab group
}
```
Suggested `updateRide3` for main.js (fight owns main.js; this mirrors `updateLift`):
```js
function startRide3() { /* as now */ world.express.begin(); liftRide.from.copy(pos); }
function updateRide3(dt) {
  phaseTime += dt;
  const X = world.express, C = X.config;
  const t = Math.min(1, phaseTime / C.duration), smooth = t * t * (3 - 2 * t);
  X.setProgress(smooth);
  const base = X.base(liftRide.base);
  const walk = liftEase(0, C.walkTime, phaseTime);       // from where you stood into the cab
  pos.set(THREE.MathUtils.lerp(liftRide.from.x, base.x, walk), base.y, THREE.MathUtils.lerp(liftRide.from.z, base.z, walk));
  body.position.copy(pos);
  body.rotation.set(0, THREE.MathUtils.lerp(body.rotation.y, Math.PI, 1 - Math.exp(-dt * 8)), 0); // face +z (out of the front)
  playerModel.update(dt, { speed: walk < 1 ? T.player.speed * 0.6 : 0, crouch: false, pitch: 0, heat: 0, firing: 0, dodge: false, time: runTime, hurt: 0 });
  X.shot(t, base, camera);
  const blend = liftEase(C.blendFrom, C.blendTo, t);      // ease onto the gameplay camera (yaw = π) like updateLift
  if (blend > 0) { /* same block as updateLift, with yaw = Math.PI */ }
  const wide = liftEase(0.2, 0.4, t) * (1 - liftEase(0.66, 0.85, t));
  scene.fog.far = THREE.MathUtils.lerp(T.fx.fogFar, C.fogFar, wide);
  const fade = $("fade");                                  // in from black at the start, out at the end
  if (fade) { fade.style.transition = "none"; fade.style.opacity = Math.max(1 - liftEase(0, C.fadeIn, t), liftEase(C.fadeOut, 1, t)); }
  if (t >= 1) { scene.fog.far = T.fx.fogFar; sound("arrive"); beginFloor(3); /* fade back in as now */ }
}
```
The camera keys start inside the cab behind the player looking out of the front door at the city, cut wide outside as the cab climbs past the tower's top floors, look down the drop, and end back inside behind the player in the gameplay pose (facing +z). `beginFloor(3)` then puts the player at `level.start`, in the same cab on floor 3.

## Knobs (URL)
`?f3=off` no floor-3 level · `?f3size=1` arena scale (0.8–1.3) · `?f3ceil=26` arena ceiling · `?f3boss=far|mid` boss at the far end (default) or in the middle (cover near it is removed) · `?f3faceY=6` boss root height · `?f3light=160` arena hall light power · `?f3spot=420` the spot on the face · `?f3kit=0` greybox only. Floor 2's `?f2doors=open`, `?f2light`, `?f2kit=0` apply on floor 3 too (same generator).

## Changelog
- 2026-10-18 · v1 greybox: the full API above, `level.arena`, `world.express`. Kit pending (greybox pieces until `end2-floor3-kit.glb` is in).
- 2026-10-19 · v1.1: art pass. `end2-floor3-kit.glb` dresses the arena (columns, cradle, breakables, gate, roof trusses, floor ring) and the cab; the corridor wears the floor-2 kit. API unchanged. Answers to `FLOOR3-REQUESTS.md` (2026-10-18): nothing to change. The hands' idle spots (11 m beside the face, 4 m toward the room) clear the roof columns (19.5 m off-centre) and the window wall (z 165).
