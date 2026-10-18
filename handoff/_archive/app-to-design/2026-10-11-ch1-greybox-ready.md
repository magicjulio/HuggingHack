# App → Design: Chapter 1 greybox is in — ids to export against

**What it is.** Chapter 1 runs end to end with placeholder art. This lists the object ids, window ids and states the code uses, so your assets drop in without code rework. Favicon (`common.favicon`) is integrated, thanks.
**What changed since the last handoff.** `2026-10-11-start-screen-integrated.md`: start screen only. Now the whole chapter exists.
**Supersedes.** Nothing.

## What you must do
Export Chapter 1 assets against these ids (any order; your priority list from `stack-and-asset-formats` still holds: HUD → orb reference → depot UI → props). Add each to `MANIFEST.md`. See it running: `cd app && npm run dev` (`?debug` lets you jump to any step).

## 3D objects (layout: `app/src/levels/ch1/layout.ts`, metres, Y up)
| id | what | size now (w×h×d) | states |
|---|---|---|---|
| `desk` | desk + paper | 1.6×0.74×0.8 | off · active (lit, step 1) · on |
| `depot` | wall depot (left wall, faces +x) | 0.5×2.6×2.4 | on · glimmer (when station 1 needs its tool) |
| `s1`…`s5` | stations along the back wall (face +z) | 1.2×1.1×0.8 + screen 1.1×0.7 | off · active · done (dimmed) |
| `chute` | chute (right wall, faces −x) | 0.8×1.2×1.0 | on |
| scorer lamp / eye | above the chute | ⌀0.44 | off · green · red · dark flicker |
| `door` | right wall, locked | 1.3×2.4 | on |
| ceiling lamp | panel at the ceiling | 1.2×0.3 | steady · flicker (0–1 strength) |
| room shell | 12×3.6×10 | — | dark (step 1) · lit |
Glowing parts: name the emissive mesh `screen` (stations, depot), `bulb` (lamps), `paper` (desk) so I can drive the states.

## DOM windows (HTML, styled from tokens.css; classes prefixed `ch1-`, HUD `hud-`, frame `win-`)
`paper` · `depot` (list, Install row states: install / progress / installed, zz row, locked `zz` prefix, GET/MKCOL tag, editable row) · `chute` (lamp + input) · `s1` decode (file chips, drop slot) · `s2` logs (search, counter `606 → 3`) · `s3` wire panel (SVG) · `s4` program + bugs (canvas) · `s5` "output → no consumer" plaque · HUD (token bar, quests: active / done / thought, achievement toast) · pause overlay · end card. A CSS file or a static HTML mockup per window is enough; I map it onto these.

## Sprites
Bugs are drawn in code now (slow amber, fast red, heisenbug purple). A sprite sheet per kind (+ splat) replaces them 1:1 (PNG + JSON, transparent).

## Open questions
None.

## Next reader
Designer.
