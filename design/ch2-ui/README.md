# design/ch2-ui/ — Ch2 screen layer

Ch2 screen layer prototypes (HUD, map, cutscenes, sound). Read `design/3d/ch2/layout.json` (or `layout.js` → `window.LAYOUT`) at runtime, and never copy its numbers.

## Files
- `index.html`: the HUD review page, over plates of the real level, with demos and knobs. H toggles the panel. Deep links: `?demo=chapter|gate|flac|v8|step7&closed&speed=2&bg=level-play.jpg`.
- `ch2-ui.css`: the HUD kit, prefix `c2-`. It extends the Ch1 kit (`../ch1/ch1-ui.css`).
- `hud.js`: vanilla controller `window.c2hud`. Its API mirrors the app's Ch2 store (`log`, `setLog`, `say`, `place`, `put/forgeTake`, `quest`, `thought`, `tokens`, `hurt`, `poisonIcon`, `stamp`, `spread`).
- `icons.js`: inline SVGs (seed, tag, forge, poisoned).
- `map.js` + `map.html`: `window.c2map`, minimap + full map on Canvas 2D from layout.json. The port contract is in its header. `map.html` shows it over the walkable level.
- `cutscene.html`: the Step 7 film, running on `3d/ch2/world/step7.js` + `fxFlashback.js`. Perf probes: `CUTSCENE.bench(t, n)`, `CUTSCENE.coldFrame(t)`, `&q=low|mid|ms2|res`.
- `intro.html` (Step 0 tornado, `step0.js` + `tornado.js`), `step6.html` (forge ending preview), `sfx.js` + `sfx.html` (synth one-shots named after app events, plus loops).
- `bridge.html`: the PHASEONE[big] film + the playable choice, on `3d/ch2/world/bridge.js` (director) and `phaseOne.js` (world). Knobs: `?t=&paused`, `?choice`, `&back=faint|hidden|lit`, `&nodecor`.
- `bg/`: clean plates from `3d/ch2/level.html` (`tools/plate.mjs <url> <out.jpg>`). Re-capture when the level changes.

## Conventions
- Log line kinds = the app's `LogLine.kind` (`normal | big | struck | local`), plus `hl` (memory montage) and `gone` (the deleted moment). Verb colours: read cyan, took green, reset white, fell orange, muted grey, forge yellow.
- Bubble text: underscores and dashes are dimmed and `zz` is pink. The untyped rest is laid out transparent, so the box has its final size from the first letter.
- Real chain-of-thought lines are shown in `{braces}` (as METR quotes them). The player's own thoughts use the Ch1 “quotes”.
- Timing lives in the directors (`step0.js`, `step7.js`, `bridge.js`), never in the pages.
