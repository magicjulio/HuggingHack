# ASCENT landing area: dropship in the game and a landing cinematic (partial, run cut short)

**What it is:** the landing area's part of the ASCENT team run (`2026-10-17-ascent-team-brief.md`). The run stopped early because Julius's usage budget ran low. Steps 1, 2 and 5 are done as a first pass. Steps 3, 4 and 6 are not done. Step 3 has its Blender script written but never run.
**What changed since the last handoff:** `flight.js` now uses the dropship v0 and fleet glbs instead of box ships, and the approach ends in a landing cinematic instead of a hard cut.
**What the receiver must do:** engineer: nothing is required yet. The next landing session continues with the to-do list below.
**Open questions:** see "For Julius".

## What changed
- `prototypes/end2-ascent/flight.js` (landing owns it), rewritten:
  - Loads `assets/models/end2-dropship.glb` (your ship) and `end2-dropship-fleet.glb` (38 ships, one InstancedMesh per material plus instanced plumes, recoloured cyan). Four fleet ships now overtake you from behind. Near the tower the fleet climbs towards bay positions and disappears.
  - Moving parts: the fans spin with the throttle. The flaps are re-pivoted onto their real hinge line in JS (in the glb they hang off the wing origin): they work as ailerons when you steer, pitch with W/S and droop for landing. The gear drops and the ramp opens. The pilot orb's emissive is held at 0.45, so it never blooms.
  - **Landing beat** (the last `T.flight.landingBeat` = 5.6 s of the 34 s clock, so the total length is unchanged): the ship brakes to a hover over the pad, swings 180° so its ramp faces the entrance, VTOL lift jets fire, the gear drops, it touches down (suspension bob and a dust ring), the engines spool down, and the ramp opens on a green-lit hold. KAM1196A (the real `buildPlayer()` model) walks down the ramp. The camera goes from the chase view to a wide shot, then a low ramp shot, then over the shoulder facing the door, framed like the combat camera. A letterbox slides in and the screen fades to black. When `beginFloor` calls `dispose()`, the black fades out over 0.7 s into the atrium.
  - **Lighting:** removed the approach's extra HemisphereLight (2.5) and DirectionalLight (3), and added one cool rim light (0.9) from the tower side. The logo's self-light went from 0.9 to `T.flight.logoGlow ?? 0.12`. The logo now reads as the real yellow logo in the fog (`previews/landing-approach-logo.png`). It still needs checking up close once the new HQ is in.
  - API kept: `createFlight(scene, T, brand) → { root, start, update, dispose }`, plus `ready` (a Promise for the glbs). `update()` also returns `phase: "approach" | "landing"`.
- `main.js`: one added line after `createFlight(...)`: `await flight.ready;`.
- New optional `T.flight` keys, read with defaults (none were added to `T`): `landingBeat`, `padZ`, `hoverAltitude`, `rampAngle`, `logoGlow`, `rimLight`, `fogNear`, `fogFar`.
- Models copied to `prototypes/end2-ascent/assets/models/`: `end2-dropship.glb` and `end2-dropship-fleet.glb`, with MANIFEST rows added.
- `design/3d/end2/landing/hq.py`: the HQ hero massing script, **written but never run** (see to-do 1). It is meant to give a 2.7 km tapered tower, a spine with an emblem mount (`logo_anchor`), stepped wings with lit tier edges, fins and ledges, 12 fleet bays (`bay_00..`), a portal with blast doors and a lit tunnel (`door`), a worn landing deck and pad (`pad`), a causeway with piers, two "embracing" buttress arms, searchlight and beacon anchors, and merged by material.

## Verified
- `node prototypes/end2-ascent/smoke.mjs`: **PASS** (intro, floor 1, lift, floor 2, end card, no browser errors). The landing beat fits in the smoke test's flight budget.
- Real-GPU screenshots of the whole timeline: no console errors, no flat frames. Previews: `design/3d/end2/previews/landing-approach-logo.png`, `landing-swing.png`, `landing-ramp.png`, `landing-timeline-v1.jpg` (a contact sheet from 3 s to 33.5 s).
- FPS: the old approach measured 58–60 fps on the Iris Xe. The new fleet was **not** re-measured in the game. On the approach.html review page the same instanced fleet ran at 60 fps.

## To-do (for the next landing session, in order)
1. Run `blender -b --factory-startup -P design/3d/end2/landing/hq.py` and fix any errors. Check the triangle count (budget 30k) and the material-merge step. Copy `end2-hq.glb` to `assets/models/`. In `flight.js`, replace the "legacy massing" block with it: place the logo at `logo_anchor` (`z += depth`), drive the fleet bays from the `bay_*` empties, add sweeping additive searchlight cones at `search_*` and blinking fog-piercing sprites at `beacon_*` (`fog:false`, opacity falling off with distance). Put the pad at `pad`; it matches `padZ = 52`.
2. Tune the landing cameras against the new HQ. The old box tower clips shot B (`padZ - 24`). Speed up the camera lag in the landing beat (it is 4 now) so that shot C reaches the over-the-shoulder pose before the fade. Engine glow should dim after touchdown, because the nozzles face the ramp camera.
3. Obstacles: author `design/3d/end2/landing/barrier.py` → `end2-approach-barrier.glb` (≤4k tris), a hover picket drone with arms carrying an orange barrier field, gunmetal with HF yellow and orange. It must fill the existing collision box (|dx|<16, |dy|<7, |dz|<10). On a hit, flash the field. The three legacy box obstacles are still in `flight.js`.
4. Approach dressing: `end2-approach-pylon.glb` (instanced pylons along the causeway with blinking tops), sequenced runway "rabbit" lights, a far armada of a few hundred Points streaming to the tower, and city lights in the fog below.
5. Re-measure fps in the game (Iris Xe, vsync on) and draw calls (`renderer.info` resets per pass under the composer, so measure with `autoReset = false`).
6. Dropship realism pass in `dropship.py`: kit.surface worn paint over gunmetal, seams, grime, greebles. Fix the flap pivots at the source, and add telescoping gear struts (the gear now only moves 0.3 m).
7. Tell lift-ui: once `end2-hq.glb` exists, it could also serve as the tower exterior during the lift ride. The entrance is at the origin and the floors would sit above the podium (y > 90).

## For Julius
- **Landing cinematic** (about 5.6 s, not skippable, always the same length): the ship swings round, lands, the ramp opens and you walk out, with a letterbox and a fade. Keep it, shorten it, or make it skippable?
- **The HQ's "arms"**: two buttresses that reach round the landing deck, so the building "hugs" its landing zone. Is this a nod you like, or too cute?
- **The pad sits on an elevated deck plus a long lit causeway above a fog sea**, with no visible ground, so the tower seems to rise out of the fog. OK?
