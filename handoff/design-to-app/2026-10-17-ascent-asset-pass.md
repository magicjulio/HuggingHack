# ASCENT (Ending 2 prototype): asset pass, integrated and playable

**For:** engineer and designer (both read this; role-specific next steps are at the bottom).
**What it is:** the first asset pass on `prototypes/end2-ascent/`, answering the 2026-10-16 verdict in its `DESIGN.md`. It is merged to `main` (commits `db9b949`..`46529f3`) and it runs.
**Changed since the last handoff:** there was none for this prototype. Before this, ASCENT was procedural boxes and spheres with synth sound.
**Who made it:** two Claude sessions run outside the usual role setup, so none of it went through design review. Treat every look and gameplay choice below as a proposal for Julius.

## How to run it

```bash
cd prototypes && ./serve.sh            # http://localhost:8765/
# game:  /end2-ascent/        asset lab: /end2-ascent/lab.html
node prototypes/end2-ascent/smoke.mjs  # full headless playthrough (server must be running)
```
`smoke.mjs` needs Google Chrome at `/usr/bin/google-chrome` (override with `CHROME_PATH`) and `ASCENT_URL` to point at another server. It passed on 2026-10-17: intro, floor 1, lift, floor 2, end card, no browser errors, loot effects applied.

The asset lab shows every model on a turntable under atrium lighting. Pick a model with `?view=lineup|player|gunner|shield|agents|loot|badge`. Other parameters: `t=<s>` freezes time, `angle=`, `walk`, `crouch`, `heat=0..1`, `windup`, `open` (shield open), `arrive`.

## What was done

| Area | Files | State |
|---|---|---|
| Palette, procedural textures, materials, brand loader | `art.js` | New. `P` is the palette. Also has `panelSet`, `hazardStripes`, `normalFromHeight`, `textPlate`, `blobShadow`, `glowSprite`, `additive`. |
| Models: player, rifle, defender (gunner and shield), agent (escort and subagent), 4 loot pickups | `models.js` | New and in the game. Each builder returns `{ root, update(dt, state), dispose() }` plus named parts. The state fields are documented in the comment above each `update`. |
| Renderer: bloom, vignette, damage tint | `post.js` | New and in the game. `createRenderer()` returns `{ renderer, render, resize, grade }`. The `hurt` uniform is driven by `damageFlash`. |
| Official Hugging Face logo | `assets/hf-logo.svg`, `assets/hf-logo-with-title.svg` | Unmodified brand files. `loadBrand()` rasterises them and extrudes the logo's own outline (`brand.badge({face, depth})`). Used on the atrium wall (`world.js`), the approach tower (`flight.js`) and every defender face. |
| Fonts | `assets/fonts/` | Chakra Petch 500/700 and JetBrains Mono 400/700, with their license. Wired in by `hud.css`. |
| HUD styling | `hud.css`, `index.html` | `hud.css` loads after the inline styles and overrides them. It holds the fonts, the reticle states and the buff chips. |
| Loot loop | `main.js` (`dropLoot`, `applyLoot`, `updatePickups`) | New. See the table below. |
| Aim read-out | `main.js` (`traceShot`, `updateAim`), `hud.css` | New. The screen reticle shows where the camera looks. A world marker shows where the rifle lands. Red means an enemy is under it; amber with a cross means cover blocks the shot. A laser shows while aiming. |
| Actors | `actors.js` | Rewritten to use `models.js`. AI and tuning are unchanged. Added `hitEnemy(..., pierce)`, `reduceCooldown(s)`, an `onKill` position argument and a `getCamera` hook. |
| Game | `main.js`, `index.html` | `index.html` import map gained `three/addons/` (needed by post-processing and the SVG loader). `main.js` now uses `buildPlayer()` and `createRenderer()`, and awaits `loadFonts()` and `loadBrand()` at the top. |

### Loot (first guesses; Julius has not seen these)
| Pickup | Effect |
|---|---|
| Repair patch | +35 integrity |
| Coolant | vents the rifle, no heat gain for 6 s |
| Compute shard | subagent cooldown −10 s |
| Overclock | shots pierce shield-bearers for 8 s (pink beams) |

Shield-bearers drop about 95% of the time, gunners about 45%. The type is weighted toward need (low health favours patches, a hot rifle favours coolant, a ready squad disfavours compute shards). Pickups last 26 s and blink for the last 5. The numbers are in `PICKUP` and `dropLoot()` in `main.js`.

## What was verified and what was not

Checked by running it: the smoke test above; screenshots of the lab, the approach, the atrium, combat, the emblem, a loot drop and the aim marker. All of it ran headless with software WebGL.

Not checked: real mouse and keyboard feel; **the lift ride, floor 2 and the end card visually** (they run, but nobody looked at them with the new look); performance on a real or integrated GPU (bloom plus 4× MSAA on a half-float target is the first suspect); browsers other than Chromium.

## Known rough edges

- `world.js` is unchanged except for the logo: atrium, cover, lift and tower shell still have the old look, and now clash with the new characters. `flight.js` fleet craft and the player's dropship are also still primitive.
- The brand yellow washes to white under the atrium lights. The emblem's albedo is scaled to 0.42 in `world.js` and the glow is 0 to compensate. A proper lighting pass should replace that hack.
- Enemy shots are still plain orange capsules (`actors.js`). The end card is unchanged and does not show loot collected (`stats.loot` exists).
- The tutorial hint box got wider with the new font and now overlaps the lower HUD in some frames.
- Aim logic: `updateAim` runs every combat tick. It reuses `traceShot` (also used by `fire`), so any change to how shots resolve only needs one edit.
- Nothing here changes the combat loop. The verdict's main complaint (repetitive crouch, aim, fire) is **not** addressed beyond loot.
- No incident facts were added or invented. The logo is used as the brand guidance allows, and weapons and shields were added around it.

## Status against the 2026-10-16 verdict

| Verdict item | Status |
|---|---|
| Stronger, cohesive assets across the game | Partly: player, enemies, allies, rifle, loot, post-processing, HUD font. Not yet: dropship, atrium and cover, lift, tower shell, effects, end card. |
| Visible pickups with a collect animation | Done, first pass (rules above). |
| Much better aiming feedback | Done, first pass. |
| Rework combat | Not started. |
| Official logo on HQ and enemy faces | Done. |
| Playtest and iterate | Not done. |

## How to continue

**Engineer**
1. Pull `main`, run the server and play a full run with a real mouse. Fix whatever feels wrong first (aim marker size and distance scaling, loot pickup radius `PICKUP.radius`, the hint box).
2. Profile on a real GPU. If bloom is too heavy, `createRenderer(..., { bloom: false })` falls back to a plain render, and `pixelRatio` is in `T.fx.maxPixelRatio`.
3. Decide whether this prototype gets ported into `app/` the way Ending 1 was (see the 2026-10-16 engineer entry in `docs/DECISIONS.md`). The modules are plain three.js with no build step, so they port without a rewrite.
4. Combat redesign hooks that now exist: `hitEnemy(..., pierce)`, `reduceCooldown`, `onKill(kind, byAlly, at)`, and the `loot` stat. New enemy types should add a builder to `models.js` and a case in `actors.js` `enemyModel`.
5. The test hooks (`?test=1`) now also expose `applyLoot` and `pickups`.
6. This machine class has 4 GB of RAM. One session was killed by the out-of-memory killer while subagents wrote files and a browser ran. Run one browser at a time and commit often.

**Designer**
1. Review the lab (`lab.html?view=lineup`) first, then a run. Everything in the table above is a proposal: palette (`P` in `art.js`), the defender design (logo on a hover hull), the player armour, loot shapes and colours.
2. Next asset targets, in order of how much they clash today: atrium and cover (use `panelSet`, `hazardStripes`, `normalFromHeight` in `art.js`), the lift, the dropship and fleet craft, enemy projectiles and impact effects, the end card.
3. Fix the lighting so the logo doesn't need the albedo hack: a calmer atrium key light, or a dedicated emblem light with a lower exposure.
4. Export format: this prototype builds geometry in code, not glTF. If you want authored models instead, say so through `handoff/design-to-app/` and list them in `MANIFEST.md`.
5. Julius owns direction: loot types and effects, the red and amber aim colours and the overall look were chosen by the build sessions without asking him. Show him before building more on top.
