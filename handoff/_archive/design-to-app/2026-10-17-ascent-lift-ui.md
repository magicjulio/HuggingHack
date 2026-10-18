# ASCENT lift-ui: lift model done, lift/end card/HUD/audio code NOT done (2026-10-17)

**What it is:** area report for `lift-ui` of the ASCENT team run (`2026-10-17-ascent-team-brief.md`). The run was cut short by the usage budget, so only the lift assets and a ready-to-wire module exist.
**What changed:** no shared file was touched (`main.js`, `world.js`, `index.html`, `hud.css`, `smoke.mjs` are unchanged by me). The game behaves as before.
**What the receiver must do:** nothing yet; the next lift-ui session continues with the to-do below.
**Open questions:** see "For Julius".

## Done
- `design/3d/end2/lift/lift.py` (run `blender -b --factory-startup -P lift.py`, and `-- rail` for the rail) builds:
  - `end2-lift.glb` (26k tris, 1.6 MB): 7.3 m freight platform, diamond-tread plate, worn gunmetal and safety-yellow paint (`kit.surface` look), hazard bands, guard rails, back fence, 4 HF yellow beacons, two clamps with rollers and drive housings, console, crate, extinguisher, damper struts, under-glow. Origin = deck centre, deck top at y = 0, front = glTF +z.
  - `end2-lift-rail.glb` (1.8k tris): `rail_6m` and `rail_bracket` for instancing.
  - Copied to `prototypes/end2-ascent/assets/models/`. Previews: `design/3d/end2/previews/lift-ui-platform-{iso,front,back,underside}.png`, `lift-ui-rail.png`.
- `prototypes/end2-ascent/lift.js` (written, syntax-checked, **not imported yet, not run in a browser**): `createLift({scene, root, deck, T, resources})` returns `{assembly, ready, setReady(v, floor), setProgress(p), setRiding(on), update(dt, time, camera), shot(t, base, camera)}`. It loads both glbs and merges them by material, instances the rails and brackets, and adds a status sign, a hazard pit frame, a textured tower facade with canyon wings, gallery slabs, plaza, skyline, sky dome, swarm motes, other lifts, parked and cruising fleet ships (uses `end2-dropship-fleet.glb`), two escort riders, beacon sweep and a platform point light. `shot()` is the cinematic camera: close on the rider, pull out through the canyon mouth to a wide shot, back in.

## To do (in order)
1. Wire `lift.js` into `world.js`: replace the "complete assembly travels with the player" block and the "stationary architectural shell" block with `const lift = createLift({scene, root, deck, T, resources})`; make `setLiftReady` call `lift.setReady(value, activeFloor)`, `setLiftProgress` call `lift.setProgress`, and `update` call `lift.update(dt, time, camera)` (needs the camera passed in). Re-read the floors agent's current `world.js` first. Run it and screenshot the ride (`window.__ascent.startLift()` with `?test=1`); fix whatever looks wrong (facade tile, sky horizon, fleet scale).
2. `main.js`: add `T.lift = { duration: 9.5 }` (keep it under 9.6 s until `smoke.mjs` waits on `state` instead of a fixed 270+310 ticks, or ask combat to change that); in `startLift` call `lift.setRiding(true)`, set `yaw = 0`, `pitch = -0.06`; in `updateLift` use `lift.shot(t, base, camera)`, blend to the gameplay camera over t 0.8 to 0.97, ease the player from where they stood to the platform centre, call `playerModel.update`, tween `scene.fog.far` to about 520 and back, dip to black around t = 1 (the floor-2 deck pops in at `beginFloor(2)`), then `setRiding(false)`.
3. End card (`showOverlay("finish")`): new `#endcard` in `index.html` + `hud.css` using Chakra Petch / JetBrains Mono and `P`; time, takedowns, call-ins, retries, `stats.loot`; placeholder tease "THE SCORER'S FILES ARE ABOVE" (storyteller to confirm); a replay button calling `startRun`.
4. HUD: fix `#hint` overlapping the lower HUD (move it above `#vitals`, or cap its width); check health, heat, subagent cooldown, buffs, floor/wave and the reticle states at 1600x900 and 1280x720.
5. `audio.js`: procedural WebAudio kit behind the existing `sound(name)` names (`fire hit shield kill call spawn hurt wave lift overheat pickup drop enemy`), plus waveclear, lift loop/arrival, low health, a combat drone; `T.audio = { volume, music, mute }`, M to mute.
6. Previews of the ride at three moments, the end card and the HUD at both sizes (`design/3d/end2/previews/lift-ui-*.png`), then `node prototypes/end2-ascent/smoke.mjs`.

## For Julius
- Lift look: yellow weathered freight platform with HF yellow beacons. Is yellow right, or should it match the grey dropship?
- Tower and sky are my own proposal (facade canyon, plaza, haze horizon). The landing agent's `end2-hq*.glb` was not available, so nothing uses it.
- Proposed ride: close on the player and escorts, pull out through the canyon mouth to a wide shot with fleet, swarm motes and other lifts, return and fade into floor 2.

## Requests for other areas
- combat: make `smoke.mjs` wait for `state !== "lift"` rather than a fixed tick count, so the lift can be 10 to 12 s.
