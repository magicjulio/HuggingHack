# ASCENT team run: characters area (2026-10-17)

**What it is:** the characters area of the team run (brief: `2026-10-17-ascent-team-brief.md`). The run was stopped early because of the usage budget, so steps 1 and 2 are done, step 3 (`fx.js`) is written but untested and not wired, steps 4 and 5 are not started.
**What changed since the last handoff:** `2026-10-17-ascent-asset-pass.md` had a toy-like gun and a flat hex-sheet shield. Both are replaced.
**What the receiver must do:** nothing is required for the game to run. To finish the area, follow the numbered to-do below.
**Open questions:** see "For Julius".

## Done
- **Gunner blaster** (Blender, `design/3d/end2/characters/defender_kit.py` -> `end2-char-defender-kit.glb`, copied to `prototypes/end2-ascent/assets/models/`). Worn yellow paint over gunmetal (`kit.surface()`), sliding barrel, side capacitors, red optic, power cell. Wind-up telegraph (`windup` 0..1): four coil rings light one after another toward the muzzle (orange to white-hot), then the muzzle ring flares, the optic blinks. `firing` flares everything. `model.kick()` slides the barrel back (for the muzzle flash call).
- **Shield-bearer tower shield**: armoured frame (hinge knuckles, latch, kick plate with hazard chevrons, emitter pods and strips) and a hard-light pane shader (hex cells, scan band, emitter rim, you see the logo through it). `open` swings the frame out and dissolves the pane cell by cell; emitters flicker. `model.shieldRipple(dirToShooter)` lights the hex cells around the impact and sends a ring across the pane, plus a whole-pane flash from `shieldHit`. **Frontal vs flank read:** an amber fan on the floor in front of the shield-bearer marks the covered arc (matches the game's 0.3 dot threshold, about 145 degrees); it fades out while the shield is open, and brightens during the wind-up.
- `models.js`: loads the glb with a top-level await; if it fails, the old procedural gun and shield are used (so the game always runs). `lab.js`: `windup=<0..1>`, `firing`, `open` params, `window.__ready`.
- Previews in `design/3d/end2/previews/`: `characters-before-lineup/gunner/shield.png`, `characters-after-lineup.png`, `characters-shield-open.png`, `characters-gunner-windup.png`, plus Blender renders `characters-gun-*.png`, `characters-shield-*.png`.
- View: `prototypes/end2-ascent/lab.html?view=gunner&windup=0.8`, `?view=shield&open`, `?view=lineup`.

## Verified
`node prototypes/end2-ascent/smoke.mjs` passes (intro to end card, no browser errors) with the new weapons in the real game. Lab screenshots on the real GPU show no errors. `fx.js` only passed `node --check` (syntax), it has not been run in a browser.

## Not done (to-do for a later session)
1. **Test `fx.js`**: add `lab.html?view=fx` (a loop firing bolts, impacts, shield hits, deaths) and fix whatever breaks. The module is complete and documented at its top (`createFx(scene)` -> `bolt`, `muzzle`, `impact`, `shieldHit`, `death`, `spark`, `update`, `clear`, `dispose`, `stats`). Seven draw calls total, all pooled.
2. **Wire it in `actors.js`** with minimal edits (re-read first, combat owns it): `const fx = createFx(scene)` in `createActors`; in `shoot()` replace the `new THREE.Mesh(sphere, bulletMaterial)` creation with `const mesh = fx.bolt(start, direction, e.kind === "shield" ? "shield" : "gunner", e.model.muzzle)` and drop the scale/quaternion lines (the returned handle is a bare Object3D already in the scene, so `p.mesh.position` and `scene.remove(p.mesh)` keep working, and removal spawns the impact automatically); add `fx.muzzle(e.model, kind)` next to the shot sound; in `hitEnemy`'s blocked branch add `fx.shieldHit(e.model, incoming)`; at death `fx.death(center(e), e.kind, floorY)`; `fx.update(dt, time, hooks.getCamera())` in `update`; `fx.clear()` in `clear()`.
3. Retune the gun and shield after seeing them in motion (gun could be chunkier; the yellow paint reads right in three.js but looks green-ish in the Blender preview only).
4. Trim polygons: gun 5.3k and shield 6.0k tris are above the 4k repeated-prop guideline (fine for 15 instances, but trim the torus and cylinder segment counts if the frame rate suffers).
5. Player polish (rifle impact sparks via `fx.impact(at, normal, "rifle")` in `main.js`, a worn pass on the player armour).
6. Restyle `enemies-extra.js` (Hugger, Warden, Maintainer) with the same kit language: worn yellow over gunmetal, a coil or emitter that telegraphs, shared hit flash. Not touched.

## Requests for other areas
- combat: items in to-do 2 are small edits in `actors.js`. If you restructured `shoot()`, just keep the creation in one spot so `fx.bolt` can replace it.
- If enemies get new weapons, use `BOLT_KINDS` in `fx.js` ("heavy" exists) rather than new meshes.

## For Julius
- Does the gun now read as a serious blaster, and is the shield (hard-light hex pane, logo visible through it, floor fan for the covered side) the right idea? Both are proposals.
- The floor fan is an extra gameplay read. Keep it, or rely on the pane alone?
