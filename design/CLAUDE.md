# design/ — conventions and status

Whiteboard, not a log: replace the Status block, don't add dated sections. Every earlier dated note (Ch1 props, Ch2 world, design2, ASCENT rounds 1–3) is in `HISTORY.md`. Read it only when you need the why behind an asset.

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
- Export: finished assets are copied to `handoff/design-to-app/assets/…` and listed in `MANIFEST.md`. Re-copy after every edit and bump the manifest row.

## Style rules
- Palette (`tokens.css`): hack-green #39ff9c (you, success), signal-cyan (UI chrome), hug-yellow #ffd21e (sparing), lamp-red #ff3b4e (scorer, denied), amber (warnings), `--color-violet` #b86bff (Ch1 purple), `--color-poison` #2fa85a / `-body` #0f3d22 / `-deep` #04150b (poisoned).
- Fonts: Chakra Petch (display) and JetBrains Mono (UI), both OFL.
- Shapes: panels and buttons with one cut corner, thin cyan lines, glow on active things. Locked things are dimmed, with a lock icon and a shake + red toast on click.
- Orb colour = chosen model. Agent orbs (NPCs, crowd) never bloom; only the player does (`noBloom()`, `shadedOrbMat()`).
- 3D quality bar: the worn hard-surface look of the Ch1 flag stations (chipped paint over gunmetal, seams, grime, normal/ORM maps from `kit.surface()`, modelled greebles, one glow accent). Clean flat models are first passes only.
- Hugging Face logo: Ch1/Ch2 only the yellow nod. Ending 2 uses the official logo unmodified (the boss's angry last phase is the one exception). Fix brightness with lighting, never by editing the logo.
- Motion over ~2 s is skippable and honours prefers-reduced-motion. Exception: the ASCENT landing cinematic is not skippable.
- Never invent incident facts in UI text. Speech and board lines are placeholders until the storyteller writes them.

## How Julius reviews
- Show small slices early, as an HTML page he can open, with knobs (URL flags, sliders) instead of questions. Offer two takes behind a switch when unsure.
- Performance: measure on the Iris Xe at 1080p with vsync on and report fps numbers. Target 60.
- Any NaN pixel blacks out the whole bloom (zero-scaled normals, degenerate tube frames, `pow` of a negative). Guard normals in shaders.

## Contracts with the app
- glTF node and material names are the API: the emissive meshes are `screen` / `bulb` / `paper`, and each asset's handoff lists its animatable nodes. Don't rename them without a handoff.
- Ch2 world modules: plain ES modules on three@0.186.1, no DOM or globals, `createX(ctx) → {object, update(t, dt, state), dispose()}`. Gameplay motion goes in the pure `motion.js` only. Contract: `handoff/app-to-design/2026-10-14-ch2-world-as-modules.md`.
- Film directors (`step0.js`, `step7.js`, `bridge.js`) hold all timing, camera and cues as data. Edit timing there, never in a page.

## Status (2026-10-19)
- **E4 The Letter** (built by Codex, in `app/src/levels/end4/`): Julius is reviewing it and wants a few rewrites. Unplug-shot clipping fix is handed over (`2026-10-19-end4-unplug-fix.md`; work files in `design/end4/`, preview server `vite.preview.mjs` on :5175, `shots.mjs` screenshots).
- **Ch1 and Ch2: done for now.** Refinements come after all chapters. Open: whole-game map regions (parked by Julius), bridge sound cues, and the real bridge speech lines (from the storyteller).
- **E3 Ghost Capture:** approved and handed over (`handoff/design-to-app/2026-10-18-end3-ghost-approved.md`). The engineer has integrated it.
- **E2 ASCENT** (`prototypes/end2-ascent/`): **promoted for integration** (Julius, 2026-10-19: "works great"). The engineer ports it into `app/src/levels/end2/` (`handoff/design-to-app/2026-10-19-ascent-promoted.md`). After the port the app copy is the live one; the prototype stays as the reference. All 3 floors and the GLM-5.2 boss are done, and the perf pass is in (`-ascent-perf.md`). Open: story text placeholders (storyteller) and the camera clipping into a downed hand.
- Not verified after round 3: a full `smoke.mjs` run and fps on the Iris Xe. Open: `FLOOR2-REQUESTS.md`, a door sound, dedicated laser sounds, the dropship realism pass.
