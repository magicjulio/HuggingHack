# Ending 3 — approved ghost prototype

Build the director's two-character side-profile platformer, independently of the earlier bake-off candidates.

## Core interaction

- Move the poisoned green KAM1196A orb with A/D; W or Space jumps, S drops through one-way ledges. Arrow keys are aliases.
- Q switches control to the legitimate-looking ghost. Both actors use the same movement and gravity; switching preserves both positions.
- Scorers sweep visible cones. A scorer that sees the ghost stops its sweep at that angle while the ghost stays visible in the cone. The ghost is safe to scan.
- Switch back to KAM and take a route around the stationary cone. Standing inside that same cone is still dangerous for KAM.
- If the scorer sees KAM, restart the current room, including ghost and scorer positions. R also retries the room.
- Reach the exit as KAM. The ghost cannot finish the room. Several rooms introduce harder layouts and scan patterns.

The visual cone and detection must match, including occlusion by solid walls. Ghost acquisition requires the actual current field of view. Keep the two-character interaction as the only new mechanic; use platform layout and scanner patterns to increase difficulty.

## Story and presentation

The ghost is a playable representation of fabricated capture history; the scanner is a local evaluation watcher. These are fictional physical mappings of the documented transcript-forgery effort. Room completion is never proof that the real scorer was beaten. Complete the run and preserve the hollow evaluation result: **+0**.

The art is a dark pixel-art industrial void: green poisoned orb, white/cyan ghost, red/coral scanner, cold cyan exit. No warm Hugging Face yellow. Target a first-play run of 4–8 minutes without waiting timers; actual duration needs director playtesting.

## Work split

- `ghost_game`: game, levels, HTML/CSS and `DESIGN.md`.
- `ghost_art`: pixel assets, `art.js` and `ART.md`.
- Parent: integration, `smoke.mjs`, browser inspection, fixes and a commit scoped to this new folder.

No changes to the other prototypes, shared server, application, design, story or handoff files.
