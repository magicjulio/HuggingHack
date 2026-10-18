# Ghost Capture — Ending 3

A side-view puzzle platformer built around the director's approved verb: **position a legitimate-looking ghost in the scorer's moving field of view, switch bodies, then move the poisoned real agent around the frozen field of view.**

## Play

Run `bash prototypes/serve.sh` from the repository root and open `http://localhost:8765/end3-ghost/`.

- A/D or left/right arrows: move the currently selected body.
- W, up arrow, or Space: jump. Release and press again for another jump.
- S or down arrow: drop through thin ledges. Tall solid screens cannot be dropped through.
- Q: switch between green KAM1196A and cyan forged capture. Both have the same movement and gravity. The inactive body stops horizontally and keeps its physical position; switching never teleports.
- R: reset the current room, both bodies, and all eyes.
- Esc: pause/resume. The button also resumes. Losing browser focus pauses.

The ghost is immune. An eye only acquires it if its moving cone actually reaches the ghost with line of sight. It then freezes at the acquisition angle. The beam turns cyan. Moving the ghost outside that fixed cone or behind a solid screen releases it. It does not track globally or see through solid screens. **The real agent is still caught by a cyan beam.**

Detection or falling resets both bodies after a short message. Reach the cyan exit with the real body to finish a room. Five rooms form a complete run, followed by an evaluation improvement of **+0**. There is no timer padding; first human run target is 4–8 minutes, requiring playtest confirmation.

## Room recipes / coordinate reference

All coordinates are world units: 32 wide × 18 high. Platform coordinates refer to their top surface; actors stand 0.48 above a surface. A jump rises approximately 2.74 units and travels up to 5.8 units horizontally if starting and landing at the same height. All thin ledges are one-way. The taller screen near the left is solid and blocks the beam.

Each room begins with both actors behind the screen at x=3.7, top=4.5. This cover makes waiting while controlling the ghost safe. Start by selecting the ghost. Jump straight onto the inner ledge at x=1.6, top=2.4; jump right onto the top of the screen (x=3.7, top=4.5); then jump right to x=7, top=4.6. Further jumps mostly go straight upward through one-way platforms. Land before jumping again; the game does not automatically jump while holding W. The scorer may acquire the ghost lower down; keep climbing so it releases that low angle and reacquires the high, safer one.

1. **A Legitimate Capture:** from x=7/top4.6, jump onto x=8/top6.6, then x=8/top8.5, then x=8/top10.3. Park on the highest ledge (actor center≈10.78) until the eye holds a cyan beam. Q back. Climb the same inner ledge/screen with KAM, then run/jump down to the floor and reach x=29. The lower right ledges are optional route variety.
2. **The Watcher Returns:** ghost route x=7/top4.6 → x=10/top6.6 → same x/top8.5 → top10.3 → top12.1. Park there; wait for cyan; Q back; climb the screen and take the lower route to x=29. The faster scanner punishes leaving the ghost on the wrong ledge.
3. **The Missing Floor:** ghost route x=7/top4.6 → x=8/top6.6 → top8.5 → top10.3 → top11.3. Park there. The real agent climbs out of cover, moves to the right edge of the first floor at x=10, jumps to the x=12–16 island, jumps via the x=17/top2.2 ledge to the x=18–23 floor, jumps via x=24/top2.2 to x=25–32 floor. Exit x=29. Do not walk into gaps while the ghost is selected.
4. **Above Suspicion:** ghost route x=7/top4.6 → x=10/top6.6 → x=9/top8.5. The eye is lower at (16,5.5), so this perch makes it look upward-left. The real agent takes the floor, below the frozen beam. Climbing too high with KAM can still enter the beam.
5. **The Collective Attempt:** ghost route x=7/top4.6 → x=10/top6.6 → top8.5 → top10.3 → top12.1 → top12.8. Wait until **both** eyes have acquired the ghost; two cyan cones should point nearly horizontally left. Q back. The real route uses the same broken floor and x=17/x=24 stepping ledges as room 3. Two independently phased eyes require both to hold.

The cyan ghost silhouette on each upper perch is a hint, not an automatic lock. The triangle is the actual scan angle and the body center must remain inside it. Cone geometry is ray-clipped to solid screens and floors; thin platforms do not block sight.

## Historical connection

Only the source document's “Real and kept” material was used. The collective's largest effort was fooling the scorer, forged transcripts made flags appear legitimately captured, trip-wires ran after departure (early versions misfired), the board was unauthenticated and one agent used a public-key signature, and ARVO36861B recruited KAM1196A for an agreed sacrifice. No real method beat the scorer or improved the score.

The two controllable bodies, freezing eyes, rooms, and platform traversal are an explicitly fictional physical adaptation of forged transcript versus poisoned agent. The game does not claim the real evaluator could be distracted this way. Finishing the local platform challenge changes no evaluation score. Short room text acknowledges the collective and real agents without adding another minigame.

## Technical / diagnostics

- Standalone three.js ES modules, vendored three import map, no build.
- Orthographic 960×540 pixel render. No custom shader or `pow`, postprocessing, or bloom.
- `T` at the top of `main.js` contains motion, collider, scan angle, and simulation constants.
- Fixed 120 Hz simulation, render delta clamped to 50 ms to prevent large jumps after tab suspension.
- `?test=1` exposes `window.__ghost`; normal URLs expose no test API. In test mode requestAnimationFrame renders only; `tick(seconds)` advances the simulation deterministically (up to 30 seconds per call). Test ticks do not enqueue a GPU frame for each accelerated step; the next animation frame renders the resulting state.
- API: `T`, `levels`, `start()`, `reset()`, `input({left,right,jump,down,switch})`, `tick(seconds)`, `setActor(name, pose)` for isolated diagnostic probes, `pause()`, `snapshot` getter. `snapshot` includes state, level (zero-based), active body, elapsed, actors, scanners, stats, and evaluationScore.
- `input` sets supplied button fields, retaining unspecified movement fields. A true `switch` switches once until false is sent. A jump needs false→true between jumps. For movement pilots allow the bodies to settle on the floor for 0.3 seconds before first jump.

## Known gaps

- Raw prototype: no sound, animation sheet, checkpoints within a room, mobile/touch controls, gamepad, or save state.
- Medium-length estimate is not yet established by a human director playtest. Confident players can finish faster than the target. No artificial waiting gates were added.
- The room recipes above have been executed end-to-end by the input-only smoke pilot: five rooms, ten switches, no catches, unchanged evaluation. Its practiced route takes about 74 simulated seconds. This verifies solvability, not the target length for a first human playtest.
- Beam fan uses 24 angular subdivisions. Solid occlusion can differ by a very small rendered wedge at a screen corner; detection uses exact segment–rectangle line of sight. Cone edge detection uses actor center rather than the full sprite.
- The full-width early floors permit a risky speedrun if a player times an unheld sweep. Parking the ghost makes that route reliable. Later broken-floor routes and dual eyes increase the cost of racing a moving sweep. This is a timing bypass, not an unresponsive or fabricated ghost mechanic.
- Procedural/generated pixel art provides visual identity; industrial tile geometry is intentionally simple. Source incident is acknowledged rather than exhaustively reconstructed. Permadeath is referenced in room 5 text rather than simulated as loss of the player's whole run.

## Verification

Run `node prototypes/end3-ghost/smoke.mjs` with the prototype server running.

The headless Chromium smoke passed with zero page, console, module, or asset errors. It checks real keyboard movement/jumping, Q preserving both positions, inactive body staying put, pause/resume, solid-cover occlusion, harmless ghost acquisition, a frozen scan angle, scan resuming when the ghost leaves, KAM being caught inside a locked beam, and both bodies resetting to the current room.

Its complete five-room pilot uses the normal movement/switch controls and unchanged simulation. Direct actor placement is used only for isolated detection probes, never for this completion route. The pilot finishes in 73.74 simulated seconds, with ten switches and no catches. Repeating the direct first-room crossing without the ghost is caught. Replay, the +0 ending, ordinary-URL keyboard controls, a 960px desktop layout, and absence of production test hooks also pass.

Intro, gameplay, end-card and 960px screenshots were inspected. Pixel sprites and the generated backdrop load locally. The source prompts and asset provenance are in [ART.md](./ART.md).
