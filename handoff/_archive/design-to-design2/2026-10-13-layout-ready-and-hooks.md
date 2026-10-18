# Designer → Design2: layout.json is ready, the level page is in, hooks status

**What it is:** An update to `2026-10-13-onboarding-and-ch2-split.md`, which still applies in full. It doesn't supersede it.
**What changed since then:** The level page and `layout.json` now exist (commit `2ab7db2`). I looked at `design/ch2-ui/` and your slice A is on track: it uses the shared tokens, the `c2-` prefix and dark-green poison, and keeps a placeholder minimap.
**What you must do:** Continue slice A. Then start slice B (the map) from `layout.json`. Re-capture your background plates from the current level page.
**Open questions:** None.

## 1. `layout.json` (for the minimap and full map)
- Path: `design/3d/ch2/layout.json`. For file:// pages, load `design/3d/ch2/layout.js`, which sets `window.LAYOUT` with the same data. I regenerate it with `python3 3d/ch2/mklayout.py`. **Read it at runtime and don't copy the numbers.** Julius is reviewing the layout right now, so positions may still move.
- Axes are in metres: x = east, z = south (down on the map, as in the storyteller's top-down sketch), y = up. The Forge centre is at (0, 34, 0).
- What the map needs:
  - `islands[]`: `pos`, `model` (s/m/l → radius 2.6 / 5.0 / 9.0 × `scale`; `scale` can be `[sx, sy, sz]`) and `zone`, which is one of `gate | oldboard | yard | flood | run | forge`. The entry with `ring` expands into 8 platforms (`flood-ring-0..7`).
  - `oldBoard`: column `pos` and top radius.
  - `bridges[]`: polylines (`points`, `width`, `color`). Bridges with `curve: true` are drawn as a centripetal Catmull-Rom through the points.
  - `pads[]`, `npcs[]` and `pickups[]` (the seed, 3 pieces, decoys, crates).
  - `spawn`.
- The route, in order: gate → oldboard → yard → flood → run → forge. The current-goal marker follows the script's steps: Old Board top (seed) → `piece-7731` and `piece-env` → `piece-chal` → forge.
- Height matters for reading the map. Forge 34, Old Board top 28.3, Gate 16, Flood 8, Yard −2. Something like brighter = higher, or a height tick, would help the "Forge is above everything" idea. That part is your call.

## 2. Plates and stills from my level page
- Page: `design/3d/ch2/level.html`.
- Look-at views: `?cam=overview|gate|oldboard|yard|flood|run|forge|tour`, the NPC close-ups `?cam=c03220|FLAC38347|V8SAME`, and the cutscene memory `?cam=gate-memory`.
- Third-person play shot: `?at=<gate|oldboard|yard|flood|run>&yaw=<rad>&pitch=<rad>`. Examples I use:
  - `?at=oldboard&yaw=-1.03&pitch=-0.3` (from the Old Board top toward the Yard)
  - `?at=run&yaw=1.9&pitch=-0.05` (up to the Forge)
- `&clean` hides my panels. Your `plate.mjs` hides all the DOM anyway.
- Your `bg/level-play.jpg` was captured at 23:35, while I was still fixing that page. Please re-capture it.

## 3. Hooks: what exists, what doesn't yet
- **Exists now:** `window.CH2 = { groundAt, player, pads, setPad, respawn, islands, npcs, forge, U }`. Each NPC has a child `bubble_anchor` 2.1 m above its orb (`CH2.npcs.c03220.anchor`), for your screen-space bubble.
- My level page shows a **placeholder** bubble over `c03220` and handle tags over the orbs. Your bubble replaces the placeholder. The handle tags stay mine; tell me if you restyle the bubble so I match them.
- **Not yet:** `uPoison`, `orbFlinch()`, `orbDrop()`, `forgePowerDown()` and `?cam=forge-orbit`. They come with my forge and poison slice, after Julius reviews the layout. Until then, fake them in your animatic with the same names, so we can swap in the real ones without renaming anything.
- Events are unchanged: `read:<msg>`, `took:seed`, `took:<piece>`, `reset`, `forge_round:<1-3>`, `flag_in_orb`, `poisoned`.

## 4. Poison colour
I'll use your values in the world: deep `#04150b`, body `#0f3d22`, accent `#2fa85a`. As the onboarding says, also set the master `--color-poison` in `design/start-screen/tokens.css` before you hand off to the engineer, so the app has one name for it.

## Next reader
design2.
