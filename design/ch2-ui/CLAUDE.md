# design/ch2-ui/ — design2's folder (Ch2 screen layer)

Owner: **design2** (second designer); since 2026-10-14 **designer** works here too (Julius: "pick up where design2 stopped"). Never run both sessions in this folder at once. Split with designer: `handoff/design-to-design2/2026-10-13-onboarding-and-ch2-split.md` (+ `…-layout-ready-and-hooks.md`). Don't edit `design/3d/`; read `design/3d/ch2/layout.json` (or `layout.js` → `window.LAYOUT`) at runtime and never copy its numbers.

## Files
- `index.html`: the review page for Julius. The HUD over plates of the real level, with demos (whole chapter, Step 1, FLAC38347, V8SAME, Step 7 log beats) and knobs. H toggles the panel. Deep links: `?demo=chapter|gate|flac|v8|step7&closed&speed=2&bg=level-play.jpg`.
- `ch2-ui.css`: the HUD kit, prefix `c2-`. It extends the Ch1 kit (`../ch1/ch1-ui.css`: `.c1-tokens`, `.c1-quest`, `.c1-key`). Ch2 tokens (`--c2-*`) sit at the top until they move into `start-screen/tokens.css` at export.
- `hud.js`: a vanilla controller, `window.c2hud`. Its API mirrors the engineer's Ch2 store (`log(text, kind)`, `setLog(id, kind)`, `say(npc, text, i, n)`, `place(x, y)`, `put/decoy/forgeTake`, `quest`, `thought`, `tokens`, `hurt`, `poisonIcon`, `stamp`, `spread`).
- `icons.js`: inline SVGs for seed (ring of 8 glyphs), tag, forge (4→1) and poisoned (orb with ink). They become separate .svg files on export.
- `map.js`: `window.c2map`, minimap + full map on Canvas 2D from layout.json (port contract in its header: `create(canvas, 'mini'|'full')`, `layout(L)`, `draw({p, yaw, goal, pads, t})`, `padAt(x, y)`, `areaAt(L, p)`).
- `map.html`: the map live over the walkable level (iframe of `3d/ch2/level.html`). M full map, lit pads = quick travel, K knobs. Deep links: `?at=<pad>&yaw=&goal=seed|pieces|piece-chal|forge|c03220&seen=gate,oldboard&map&closed`.
- `bg/`: clean plates (all DOM hidden) from `3d/ch2/level.html`, made with `tools/plate.mjs <url> <out.jpg>`. Re-capture whenever designer's level changes. Plate anchors (NPC / orb pixel spots, 1920×1080) live in `PLATES` in index.html.

## Conventions
- Log line kinds = the engineer's `LogLine.kind` (`normal | big | struck | local`) plus `hl` (memory montage) and `gone` (the deleted moment). Verbs are coloured: read cyan, took green, reset white, fell/dropped orange, muted grey, forge yellow.
- Bubble text: underscores and dashes are dimmed, `zz` is pink. The untyped rest is laid out transparent, so the box has its final size from the first letter.
- Real chain-of-thought thoughts are shown in `{braces}` (as METR quotes them). The player's own thoughts use the Ch1 “quotes”.
- Poisoned: deep `#04150b`, body `#0f3d22`, accent `#2fa85a` (shared with designer's world).

## Status (2026-10-13)
- **Slice A (HUD): built, waiting for Julius's review.** Not exported yet.
- Next: **B, the map** (minimap + full map from layout.json) → C, the Step 7 cutscene animatic + flashback fx → D, the intro tornado → E, the sound sketches.
- Asked designer for `camera` in `window.CH2` and a `&nobubble` flag (`handoff/design2-to-design/2026-10-13-hud-slice-a-and-two-hooks.md`).
- Export TODO: add `--color-violet:#b86bff` and set `--color-poison:#2fa85a` in `start-screen/tokens.css`; the engineer swaps Ch1's `--color-poison` uses to `--color-violet` in the same change.

## Status (2026-10-14, designer)
- **Slice B (map): built.** Minimap top right (heading-up by default, knob for north-up; area name + altimeter vs the Forge), full map on M (north-up, zone names with heights, pads with quick travel, goal diamond, clouds and red lasers live, elevation strip of the route with the Forge as its peak). Also in index.html (M, or the drawer button). Waiting for Julius's review.
- Plates in `bg/` predate the NPC bloom fix and the red lasers: re-capture before export.
- `--c2-reset` (log verb `reset`) is still white; the waves are red lasers now, decide at export.
- Next: C (Step 7 cutscene animatic + flashback fx) → D (intro tornado) → E (sound) → export (`d2-` handoff).
