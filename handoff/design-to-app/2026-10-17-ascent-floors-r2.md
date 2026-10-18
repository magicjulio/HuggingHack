# ASCENT floors r2: atrium kit in the game, cover and floor-2 kits scripted but not built (2026-10-17)

**What it is:** round 2 of the floors area (team brief `2026-10-17-ascent-team-brief.md` + `-r2.md`). It was stopped early at Julius's budget.
**Supersedes:** nothing. It continues `2026-10-17-ascent-floors.md`, whose to-do steps 1–3 are done here.
**What the receiver must do:** nothing to integrate. The next floors session continues the to-do below.
**Open questions:** see "For Julius".

## Done
1. **Measured** (Iris Xe, 1600x900, real GPU). Before: 60 fps vsync, about 80 fps uncapped, 280–360 draw calls (real WebGL count). After the atrium kit: about 280 draw calls at spawn. During the run, 4 other agents' Chrome GPU processes were running, so fps is unreliable. A GPU timer-query A/B (`/tmp/floors-r2/bench.mjs`, not in the repo) gave about 20–23 ms with the kit vs 12 ms with the greybox. **The kit costs about 8 ms GPU, which is a perf risk.** Re-measure on an idle GPU.
2. **Cropped sign fixed:** `world.js sign()` now uses art.js `textPlate`, so the canvas fits the text (Chakra Petch). `size` keeps its old meaning. Preview `floors-r2-sign-fix.png`.
3. **Atrium kit** `design/3d/end2/floors/floors.py -- atrium` → `end2-atrium-kit.glb` (20k tris): polished stone floor with a lighter runway, yellow inlaid lines, trench grates and a medallion; 4 pillars (30 m, yellow light slots, collars); 8 glass curtain bays on the right; 8 wall bays on the left with mezzanines at 7.5/15 m, lit offices, doors and info walls; a coffered skylight at 30 m with an opening for the lift; 3 halo chandeliers; the emblem wall with a recessed centre; the entrance portal (glass above, so the lift camera can fly out). All `kit.surface` textures are cached in `floors/tex/`.
   - `floors.js createFloorSets()` loads the kit, merges every placement into one mesh per material per floor, and adds: the emblems + wall signs (moved out of the deck), a **vista** shader card outside the right glass (a ray-cast city, plaza and sky with real parallax), one-draw-call light shafts, dust motes, cheap fresnel glass, and a textured office glow. It is wired in `world.js` (my part only): the greybox is now a `legacy` group, shown only while a floor's kit is missing; `floorSets.cover()` in `createCover` (colliders unchanged); `setFloor`/`update` hooks; `world.floors`.
   - Knobs: `?sets=0` (greybox only), `?shafts=`, `?alarm=`, `?alarmPower=`, `?emblem=`.
- `smoke.mjs`: **PASS** (intro → floor 1 → lift → floor 2 → end card, no errors).
- Previews: `design/3d/end2/previews/floors-r2-atrium-{play,wide}.png`. They were taken before the stone-vein, grime, glass and office fixes, which have not been screenshotted yet.

## To do (next floors session)
1. Screenshot the current atrium (the vein, grime, glass, office and shaft fixes are untested visually). Then **cut the GPU cost**: A/B with `bench.mjs`-style timer queries per material (`only:`/`no:` variants). Suspects: the glass layers, the stone env reflection and the 2 emblem spots.
2. Build the cover kit: `blender -b --factory-startup -P design/3d/end2/floors/floors.py -- cover` (desk, planter, barrier, checkpoint, 3 rack rows, 2 hard-light barriers at the exact slot widths; the shimmer shader is ready in floors.js). Copy it to `assets/models/` and add `cover:` to `KITS` in floors.js.
3. Build the floor-2 kit: `-- floor2` (raised floor with the lift hole, rack towers, rack wall, window bays, ceiling with cable trays, beacons, blast far wall and entrance). Add `floor2:` to `KITS`. Alarm sweeps (2 spot lights + cones), a vista at the windows, LED blinking and the small emblem are already coded.
4. Check the lift ride with both sets visible (`riding()` shows both). Check that the camera passes through the glass, not the walls.
5. Previews `floors-r2-{emblem,cover,floor2-wide,floor2-alarm}.png`, then MANIFEST rows for the cover and floor2 glbs.

## For Julius
- Atrium look: a grand lobby with an HF yellow light language, a glass wall to a night city on the right, office mezzanines on the left, halo chandeliers and the logo in a recessed bay. OK as the direction?
- The far-wall signs say "HUGGING FACE", "HEADQUARTERS / ASCENT CONTROL" and "01 ARRIVAL ATRIUM". The floor-2 signs ("RESTRICTED: SCORING CLUSTER", "AUTHORISED AGENTS ONLY") are placeholders; the storyteller should confirm them.

## Requests for other areas
- **lift-ui:** your canyon wings (x ±22.4) sit behind my glass wall. The vista card at x = 21.2 hides them from inside and is invisible from the ride camera (one-sided). The skylight has an opening at x ±5.4, z −34..−44 for the platform.
