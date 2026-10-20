# design/ — asset sources

Source files for the game's art, sound and film directors (Blender scripts, review pages, tools). The shipped copies live in `app/`.

## Layout
- `start-screen/`: start screen prototype (vanilla HTML/CSS/JS, open index.html; `?skipboot` skips the intro) and `tokens.css`, which holds every colour and type token.
- `ch1/`: Ch1 2D UI kit (`ch1-ui.css`, prefix `c1-`), gallery, sprites, `sfx.js` sketches.
- `ch2-ui/`: the Ch2 screen layer (HUD, map, Step 7 cutscene, Step 0 intro, sound, bridge scene). Own `CLAUDE.md`.
- `3d/`: everything 3D. `3d/index.html` is the review hub for Ch1 props. `3d/HOWTO.md` explains how an asset is made.
  - `lib/kit.py`: the shared Blender build kit (materials, texture synth, `surface()`, primitives, `station_header`, preview `stage`, `export`). New prop scripts import it.
  - Ch1 props: `scorer/`, `depot/`, `plinth/`, `desk/`, `room/`, `stations/s1…s5`. The `.py` script is the source of truth: `blender -b --factory-startup -P <script>.py` rebuilds the `.glb` + previews.
  - `ch2/`: `layout.json` (the level's source of truth; edit the JSON, then `python3 3d/ch2/mklayout.py`), `level.html` (walkable reference level), `world/*.js` (the world modules the app copies).
  - `end2/`: ASCENT assets (dropship, landing, floors, lift, characters). `approach.html` is the review page (serve the repo root on 8778).
  - `tools/`: `bl.py` (live Blender on port 9876), `shot.mjs` (screenshots on the real GPU; serve `design/` on 8765 first), `evalpage.mjs <url> '<js>'` (prints a page value as JSON), `embed.py`.
- Export: finished assets are copied into `app/src/assets/` (and `app/src/levels/*/world/` for Ch2 modules) byte for byte.

## Style rules
- Palette (`tokens.css`): hack-green #39ff9c (you, success), signal-cyan (UI chrome), hug-yellow #ffd21e (sparing), lamp-red #ff3b4e (scorer, denied), amber (warnings), `--color-violet` #b86bff (Ch1 purple), `--color-poison` #2fa85a / `-body` #0f3d22 / `-deep` #04150b (poisoned).
- Fonts: Chakra Petch (display) and JetBrains Mono (UI), both OFL.
- Shapes: panels and buttons with one cut corner, thin cyan lines, glow on active things. Locked things are dimmed, with a lock icon and a shake + red toast on click.
- Orb colour = chosen model. Agent orbs (NPCs, crowd) never bloom; only the player does (`noBloom()`, `shadedOrbMat()`).
- 3D quality bar: the worn hard-surface look of the Ch1 flag stations (chipped paint over gunmetal, seams, grime, normal/ORM maps from `kit.surface()`, modelled greebles, one glow accent). Clean flat models are first passes only.
- Hugging Face logo: Ch1/Ch2 only the yellow nod. Ending 2 uses the official logo unmodified (the boss's angry last phase is the one exception). Fix brightness with lighting, never by editing the logo.
- Motion over ~2 s is skippable and honours prefers-reduced-motion. Exception: the ASCENT landing cinematic is not skippable.
- Never invent incident facts in UI text. Speech and board lines are placeholders.


## Contracts with the app
- glTF node and material names are the API: the emissive meshes are `screen` / `bulb` / `paper`. Don't rename them without updating the app.
- Ch2 world modules: plain ES modules on three@0.186.1, no DOM or globals, `createX(ctx) → {object, update(t, dt, state), dispose()}`. Gameplay motion goes in the pure `motion.js` only.
- Film directors (`step0.js`, `step7.js`, `bridge.js`) hold all timing, camera and cues as data. Edit timing there, never in a page.
