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

Detection or falling resets both bodies after a short message. Reach the cyan exit with the real body to finish a room. Six rooms form a complete run, followed by an evaluation improvement of **+0**. There is no timer padding; first human run target is 4–8 minutes, requiring playtest confirmation.

## Room recipes / coordinate reference

World: 32 × 18. Platform y is the top surface; a standing actor is 0.48 above it. Jumps rise about 2.74 units and span up to 5.8 at equal height. Thin ledges pass light; thick blocks and screens stop both bodies and sight. Every room now has its own explicit layout. There is no shared spawn-wall postprocessing. Level 1 retains its approved geometry, scan, spawns and exit.

### 1 — A Legitimate Capture (unchanged tutorial)

Both bodies start behind the left screen. Select the ghost; jump to (1.6, 2.4), (3.7, 4.5), (7, 4.6), (8, 6.6), (8, 8.5), (8, 10.3). Wait for cyan, then switch to KAM. Climb the inner ledge and screen and cross the lower floor to x29. The high, leftward frozen cone clears the real route; the screen protects KAM during setup.

### 2 — Under the Watcher

An elevated bridge spans a low eye. KAM starts on a high left balcony behind a solid pier; the ghost starts separately on the lower floor. Move the ghost to x16 directly below the eye at (16, 6). Wait for cyan, switch, jump KAM onto the pier at (6, 10), then across bridge islands at x9, 14, 19, 24, 29, all top10.

The 1.1 rad/s scanner is faster than the tutorial and can sweep above itself. The ghost pins it downward, so the entire upper jump arc stays clear. KAM can wait indefinitely behind the balcony pier. This reverses the tutorial's vertical roles: no ghost staircase, a low lure, a high exit, and precision bridge jumps.

### 3 — The Blind Side

A broad, left-mounted searchlight covers a low passage and an upper return. The large solid central block hides the right-hand staging position. The ghost starts in the upper exit passage, holding a horizontal beam. KAM must pass below the block and climb the right steps first. Then drop the ghost to the lower floor, wait for acquisition, and return KAM across the crown to the left exit. The exit passage has a full-height ceiling to prevent jumping over its beam. Moving the ghost down too early cuts off the outbound route.

### 4 — The Hinge (harder / Luna)

A floor-to-crown solid divider closes the ground crossing. Two side-specific eyes require ghost relocation between the wings; KAM climbs the right approach, stages on the opaque crown, then completes the left exit approach. The spawn roof protects initial ghost setup. See `level4-notes.md` for private route notes.

### 5 — Moving the Goalposts (much harder)

Four ghost holds connect an outbound relay, far-side climb, overhead opposed-eye lock, and sheltered upper return. A hanging exit wall and missing middle bridge remove direct access from the setup ladder. See `level5-notes.md` for private route notes.

### 6 — Five Versions of the Truth (much, much, much harder / Sol)

Five stacked traversals, two high/low lure reversals, long ghost backtracks, and a final oblique opposed-eye lock. Thick ceilings prevent jumping between floors or vaulting the passage beams. KAM must reach protected staging positions before the ghost relocates. See `level6-notes.md` for private route notes and clearance caveats.

Solutions are documented in developer notes only. The game contains no room instructions, narrative popups, perch silhouettes, or solution-position markers.

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

## Verification and playtest status

Levels 4–6 were redesigned by three parallel agents and integrated as separate modules. Syntax, basic level-data validity, imports, and HTTP availability are checked. No browser route run was performed for this revision, honoring the user's preference to playtest personally. The new routes are intended solutions, not proof of solvability or freedom from every timing exploit. Level 6's narrow tunnel clearances and acquisition angles especially need human feedback.

The movement pilot in `smoke.mjs` predates these modules and is obsolete for levels 4–6. Its historical complete-run results do not validate the current campaign. Existing scanner behavior checks apply to the unchanged engine; full route coverage would need updating before using that script for campaign validation.

Launch with `bash prototypes/serve.sh`, then visit `http://localhost:8765/end3-ghost/`.
