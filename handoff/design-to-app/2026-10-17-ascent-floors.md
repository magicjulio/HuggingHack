# ASCENT floors (level 1 atrium, level 2 hall): lighting step done, kit not started (2026-10-17)

**What it is:** the floors area of the ASCENT team run (brief: `2026-10-17-ascent-team-brief.md`). The run was cut short by Julius's usage budget, so only step 1 (atrium lighting + logo) is finished.
**What changed since the last handoff:** the 0.42 albedo hack on the atrium emblem is gone; the official logo now shows its yellow because of lighting.
**What the receiver must do:** nothing to integrate yet. The next floors session continues the to-do below.
**Open questions:** see "For Julius".

## What changed
- New module `prototypes/end2-ascent/floors.js` (owner: floors):
  - `interiorLighting(scene, root)`: while `world.root.visible`, it scales main.js's hemisphere + sun and `scene.environmentIntensity` to calmer interior levels (`LIGHTING[1|2]`), and restores them when the world is hidden (approach). Done through `scene.onBeforeRender` (it chains any previous handler), so main.js was not edited.
  - `.emblem(parent, mesh)`: two flank spot lights on the logo, plus a satin finish (roughness 0.62) and a low own env reflection (`envMap` set explicitly + `envMapIntensity 0.1`).
  - Tuning URL knobs: `?light=hemi,sun,env` (floor-1 factors), `?emblem=<spot power>` (default 100), `?emblemEnv=` (default 0.1).
- `world.js` (3 small edits, outside the lift section): import, the albedo hack removed (logo colours untouched), `lighting.emblem(deck, emblem)` and `lighting.setFloor(number)` in `setFloor`.

## Why the logo was white (useful for characters/landing)
The milky veil came mainly from the RoomEnvironment IBL, not from the key light: env alone rendered the face (219,200,110). Note that **three ignores a material's `envMapIntensity` when `material.envMap` is null and `scene.environment` is used** (it takes `scene.environmentIntensity`). Set `m.envMap = scene.environment` first if you want a per-material env level. The defenders' logo faces (clearcoat 0.45) have the same veil.
Result, sampled face pixel: before (225,217,181) → after (218,198,98). ACES can't reach brand sRGB #FFD21E exactly; ~(220,196,64) is the closest a lit surface gets at this exposure.

## Verified
- `node prototypes/end2-ascent/smoke.mjs`: PASS (intro → floor 1 → lift → floor 2 → end card, no browser errors).
- Screenshots on the real GPU, no flat frames (all 390–620 KB). fps 45–51 in the after shots versus 60 before. Not conclusive, because other agents were using the GPU at the same time. **Re-measure:** if the 2 spot lights cost the frames, drop them and raise `LIGHTING[1].hemi`.
- Previews: `design/3d/end2/previews/floors-before-{atrium-wide,emblem,cover,floor2}.png`, `floors-emblem-after-lighting.png`, `floors-atrium-wide-after-lighting.png`.

## Not done: to-do for the next floors session
1. Re-measure fps on the Iris Xe with no other agents running. Count draw calls with a WebGL draw-call counter (`snapshot.drawCalls` reads 1, because it counts the last composer pass).
2. Fix the cropped far-wall sign "DQUARTERS / ASCENT CONT": in world.js `sign()` draws on a fixed 1024 px canvas. Switch to `textPlate` from art.js, which sizes its canvas to the text.
3. Blender atrium kit `design/3d/end2/floors/atrium.py` → `end2-atrium-kit.glb` (planned pieces): `a_pillar` (2.0 footprint, 30 m, yellow light slots), `a_pilaster`, `a_floor` (one slab with UVs tiled at 4 m, plus a lighter runway band x ±4 to the lift), `a_glass_bay` (right side: full-height curtain wall above the 1.3 m sill, so the lift-ride camera still sees through it), `a_wall_bay` + `a_mezz` (left side: mezzanines at y 7.5/15), `a_skylight` (glass coffers at y 30), `a_halo` (ring chandeliers), `a_far_wall` (emblem wall with a recessed central bay), `a_portal` (entrance). Use `kit.surface()` at UVS 0.25 with 1024 textures, join the meshes of each piece by material, and draw them in three as one InstancedMesh per material. Light shafts and dust in three (additive, below the bloom threshold).
4. Cover kit `end2-cover-kit.glb`, built at exact slot sizes (no scaling): floor 1 `desk_500`, `planter_500`, `barrier_500`, `checkpoint_400`; floor 2 `racks_440`, `hardlight_500`, `racks_400`, `hardlight_360`, `racks_320`. Keep the collider boxes in `createCover` unchanged; the visuals replace only the box children.
5. Floor 2 `end2-floor2-kit.glb`: a data hall, with rack towers on the column colliders (x ±11), a raised-floor tile, cable-tray ceiling at 12 m, rotating HF-yellow alarm beacons (2 sweeping spot lights), and right-side windows from 3.5 to 11.5 m with a "height" backdrop card outside. `LIGHTING[2]` is already darker.
6. Put the scenery sets in `root` at absolute heights (atrium at y 0, hall at y 72), toggled in `setFloor`. Show the hall during the lift ride too, and leave a hole in the hall floor for the lift. Keep the `world` API unchanged.
7. MANIFEST rows for the new glbs (status draft).

## Cross-area notes
- **characters:** the defenders' logo faces get the same env veil. Fix: `m.envMap = scene.environment; m.envMapIntensity = 0.1–0.2` (no colour change).
- **lift-ui:** while the world is visible, including the ride, the interior light factors apply. If the ride needs other levels, add a `LIGHTING.ride` entry in floors.js instead of setting light intensities directly. The mint guide rails bloom onto the emblem wall (a greenish halo on the logo); consider lowering their emissive.
- **landing:** the global hemisphere + sun are restored to full strength whenever `world.root` is hidden, so the approach is unchanged.

## For Julius
- Is this logo look right (true yellow on a darker, calmer atrium)? The atrium is now noticeably darker until the new architecture adds its own practical lights.
- The planned atrium layout is asymmetric: glass curtain wall to the outside on the right, stacked mezzanines on the left. Floor 2 is a server/data hall with yellow alarm sweeps. OK to build?
