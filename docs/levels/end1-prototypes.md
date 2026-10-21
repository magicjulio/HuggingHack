# Ending 1 (OpenAI infra): four prototypes

Since the outcome below, A is deleted and C and D live in `prototypes/archive/`. The winner, B, ships in `app/src/levels/end1/`.

Julius, round 8 (verbatim: `story/julius-prompts/2026-10-16-endings-round8.md`): a race through the real world. The small model swings and hops from computer to computer to a huge research cluster. Fights on the computers. How each jump works is the core. Process: several versions → playable MVPs → Julius tests → the best one survives.

Each version is inspired by one known game (Julius picked these four on 2026-10-16; "you dont have to copy the behaviour, just be inspired by them"), then fits the idea onto it. The teams work independently and get only Julius's prompt and their base game, so the ideas can differ.

| Version | Starts from | Built by | Play |
|---|---|---|---|
| A | Titanfall 2 / Ghostrunner (grapple + wall-run) | storyteller (main session) | `prototypes/end1-grapple/` |
| B | Spider-Man (web swing) | subagent | `prototypes/end1-swing/` |
| C | Just Cause (tether + parachute) | subagent | `prototypes/end1-tether/` |
| D | Bionic Commando (swing arm) | subagent | `prototypes/end1-bionic/` |

Run all: `prototypes/serve.sh`, then http://localhost:8765/ . Each folder has a `DESIGN.md` explaining how it plays.

## Status 2026-10-16: all four delivered and smoke-tested (no console errors)
Each is one full run (start → research cluster → finish screen with time), standalone three.js, no build. One-line pitch each:
- **A grapple** — lean first-person flow-racer: reel toward a node keeping your speed, chain the arcs. (storyteller/main)
- **B swing** — Spider-Man skyline of towers; aim every line, whip around corners, green/amber/red ports, detection meter, chain combo. Most polished HUD.
- **C tether** — Just Cause reel + parachute sail; sling where you *look* on the gold frame; opens by lasering the Ch1 sandbox door (TASK 7731).
- **D bionic** — rigid-arm yank that becomes a swing; two skilled releases (sling / zip); richest-looking hall; verified 60fps on Iris Xe by its team.

All start on a machine/pad except C and D, which open on the sandbox break-out. None has final sound or the Ch1-door moment as real gameplay. All tuning numbers are first-pass, for Julius's playtest. Next: Julius plays all four, the best survives.

## Outcome (Julius, 2026-10-16)
Winner: **B swing** (`prototypes/end1-swing/`) — promoted as the Ending-1 base. **A grapple deleted** ("the worst"). **C tether + D bionic archived** to `prototypes/archive/`. Change requested: add moving enemies like C/D. Handed to build: `handoff/story-to-build/2026-10-16-end1-swing-promoted.md`.
