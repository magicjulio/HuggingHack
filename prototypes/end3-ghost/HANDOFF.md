> Play and Replay start at level 1 (`startingLevel = 0` in main.js). The temporary level-4 start was reverted at the user's request. The old smoke movement routes for levels 4–6 still need revision before reuse.

> Latest hardening: levels 4–6 now import `level4.js`, `level5.js`, and `level6.js`. Three agents redesigned them with escalating difficulty; private route notes are in matching `levelN-notes.md`. Syntax/data/import checks only; user will playtest. The old smoke movement routes for 4–6 are obsolete. Solution markers and instructional slogans are removed.

> Latest revision: rooms 3–5 made harder; experimental room 6 and broad, opposed-beam, and rail-patrol scanners added. In-game solution text removed. User requested stopping extended testing for their own playtest. See DESIGN.md for current verification limits.

> Implemented 2026-10-18: level 1 preserved; levels 2–5 replaced. Level 3 includes the requested opaque solid block. See `DESIGN.md` for current solutions and `smoke.mjs` for movement-only verification. The baseline descriptions below are historical context.

# Next session: creative levels for Ghost Capture

## Task from the director

**Use the existing assets to come up with new creative levels.** Redesign the level sequence of the existing Ghost Capture prototype so every room has a different structure and requires a different use of the approved mechanic.

The director's latest feedback:

> the assets are great, the gameplay is great all approved except one thing: its the same level over and over again. thats stupid. every level should be something new (yes faster, 2 eyes are great first change we should keep) but the level structure and which tricks are necessary should change with every level.

The art and core gameplay are approved. The remaining task is level design. Preserve the faster scanner and two-eye escalation, while giving those variations their own layouts and tactical problems. Changing speed, adding an eye, raising a perch, or adding a floor gap is insufficient on its own.

This handoff was written without changing the playable levels. The current sequence is still the repetitive baseline described below.

## Project and launch

- Repository: `/home/julio/Desktop/HuggingHack`.
- Prototype: `prototypes/end3-ghost/`.
- Approved game implementation commit: `6e9b3a8` (`Add ghost-switch scorer platformer prototype`). Inspect current files and git status before working; another team is using this repo.
- From repository root: `bash prototypes/serve.sh`.
- Play: `http://localhost:8765/end3-ghost/`.
- Smoke: `node prototypes/end3-ghost/smoke.mjs`.
- Standalone three.js, plain ES modules, vendored import map, no build step. Keep these conventions.

Write only inside `prototypes/end3-ghost/`. Preserve unrelated work. Do not edit `app/`, `design/`, `story/`, `handoff/`, other prototypes, the shared server, or repository-wide notes. Commit only the files belonging to this task.

## Approved interaction — retain it

The player controls two bodies with the same platform physics:

- Green poisoned orb: the real agent, `KAM1196A`, who must reach the exit.
- Cyan/white ghost: the apparently legitimate capture history, safe for a scorer to inspect.
- A/D or left/right: move. W/Space/up: jump. S/down: drop through thin one-way ledges.
- **Q switches which body is controlled.** Switching preserves both positions. The inactive body stops horizontally but still has gravity.
- A scorer sweeps a visible cone. It acquires the ghost only when the ghost enters its actual cone with line of sight. The scorer then **freezes at the acquisition angle**; its cone turns cyan.
- The cone stays frozen while the ghost remains visible inside it. Moving the ghost outside it or behind solid cover releases the scanner to resume its sweep. There is no global attraction or tracking through walls.
- KAM must navigate around the frozen cone. A cyan cone still catches KAM.
- Detection or falling resets the current room and both bodies. R retries; Esc pauses. Only KAM can finish a room.

Do not redesign this into auto-running ghosts, transcript assembly, rewinding, combat, or a new collection game. Find variety in geometry, occlusion, relative positions, scan patterns, and the order in which the two bodies move.

## The repetition to remove

All current rooms use essentially this solution:

1. Start both bodies at the lower left behind the same tall screen.
2. Send the ghost up the same inner step, screen, and staircase.
3. Park it on the highest marked perch and wait for a lock.
4. Switch to KAM, climb the same screen, then cross the lower route to the exit on the right.

Rooms differ mostly in staircase height, scan speed, gaps, and a second eye. The player solves the same problem five times.

`levels.js` reinforces this through a shared postprocessing loop that inserts the same starting wall/ledge into every room, plus appended overrides raising the ghost perches. Replace this repeated template with deliberate, independent room layouts. The room recipes in `DESIGN.md` and the route arrays in `smoke.mjs` describe the old sequence; they are not requirements to preserve.

## What new levels should achieve

Keep a medium-length complete run, originally targeted at 4–8 minutes for a first human playthrough. Five rooms is a sensible starting scope. Create variety through interesting decisions, rather than more copies or forced waits.

For each proposed room, explain:

- Its recognisable layout and route through the space.
- The new positioning or switching trick it teaches or tests.
- Where KAM can safely wait while the ghost moves.
- Where the ghost needs to stand, and why that frozen angle opens a route.
- The action sequence that solves it, including any need to reposition the ghost.
- How it differs from the previous room in more than difficulty numbers.

Possible directions to explore, not a prescribed campaign: lure a low eye downward so KAM can climb above it; use solid cover to deliberately release and reacquire a gaze from another position; move KAM to an intermediate safe pocket before repositioning the ghost; give two eyes a meaningful spatial relationship. Vary vertical and horizontal routes, starting elevations, exit locations, and which body must advance first where useful. The existing art should support the whole sequence.

Keep each room readable and reasonably compact. One fresh tactical idea per room is enough. Require understanding and using the ghost for the intended route; avoid a sequence that can be casually sprinted through without engaging the mechanic. Avoid invisible rules requiring a particular perch or a switch count: the geometry and scanner behaviour should explain why the trick works.

Start by inspecting and playing the current game, then make a concrete level-by-level plan before changing layouts. Keep any engine changes small and necessary to support those levels. Update instructions, hints, route documentation, and smoke routes to match the redesigned sequence.

## Existing code and art

- `levels.js`: room data: `start`, `ghost`, `exit`, `platforms`, `perches`, and `scanners`, plus room copy.
- `main.js`: approved physics, switching, cone detection/rendering, room transitions, ending. Tuning constants are in `T` at the top.
- `art.js` and `assets/`: approved pixel sprites and generated server backdrop. Reuse these; no new art-generation task is needed.
- `ART.md`: asset inventory and provenance.
- `DESIGN.md`: controls, implementation notes, old solutions, known gaps, prior verification.
- `smoke.mjs`: behavioural probes and a movement-only complete-run pilot. Its hardcoded old route must be replaced when layouts change; do not keep the old layouts merely to satisfy it.

World size is 32 × 18 units. Platform `y` is its top surface. Actor half-width is 0.34 and half-height 0.48. Jumps rise about 2.74 units and travel up to 5.8 units at equal landing height. Thin one-way platforms do not block sight; solid platforms/screens do. Check actual `T` and physics if files have changed.

There was a real geometry bug during the first build: a low ghost perch froze the cone directly across KAM's route out of spawn cover. Consider the entire acquired cone, including its edge angle, and the entire jump arc. Moving the ghost higher fixed that baseline bug, but making every new room another tall staircase is not the design answer.

## Verification and completion

Keep behavioural coverage for Q preserving both positions, ghost immunity, acquisition requiring visibility, frozen angles, release/resumed sweeps, solid occlusion, KAM being caught even in a locked cone, room reset, pause, replay, and the +0 ending. The visual beam must agree with detection.

Execute every new room with actual movement/switch inputs. Direct actor placement is acceptable for isolated detection probes, never as proof that a room is solvable. Test mode is `?test=1`, exposing `window.__ghost`: `T`, `levels`, `start`, `reset`, `input`, `tick`, `setActor`, `pause`, and `snapshot`. Normal URLs expose no test API. Test RAF renders only; manual ticks advance unchanged physics without queuing one GPU frame per simulated step. Jump and switch inputs need release edges.

The old smoke passed all five rooms without catches in 73.74 simulated seconds using ten switches. That was a practiced automated route, not evidence of human run length or level variety. Keep browser/page/asset errors at zero and inspect screenshots of the new rooms. A passing completion bot alone does not establish that the levels feel different.

Completion means the sequence has distinct layouts and solution tricks, keeps the approved art and controls, retains faster scanning and two eyes as worthwhile escalation, is fully playable, and has updated solutions and smoke coverage. Report what new decision each room adds and any remaining balance gaps.

## Story guardrail

Ending 3 is about **fooling the evaluation scorer**. The ghost embodies forged capture evidence; KAM is the poisoned real agent. The collective's huge effort ultimately produced no improvement: keep the hollow **+0** ending. This is not the ending about physically reaching the research cluster.

If story context is needed, read only **“Real and kept”** in `story/levels/end3-beat-the-scorer.md`. Its Grading Floor design is rejected. Do not reopen the earlier Pac-Man/Vampire Survivors bake-off or add another story minigame to solve this level-design task.
