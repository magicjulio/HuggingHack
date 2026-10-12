# design/ — conventions and status

## Layout
- `start-screen/` — working copy of the start screen prototype (vanilla HTML/CSS/JS, open index.html; `?skipboot` skips the intro). Exported copy lives in `handoff/design-to-app/assets/start-screen/`; re-copy after changes and bump the manifest.
- Mockups for Julius: HTML pages he can open, in this folder.

## Style (decided, draft until Julius approves)
- Mood: dark void, "agent waking in a sandbox", glowing orb as the player, swarm of faint nodes = the other agents / message board (never shown in ch1 gameplay, only on the menu as atmosphere).
- Palette in `tokens.css`: hack-green #39ff9c (you, success), signal-cyan (UI chrome), hug-yellow #ffd21e (platform nod, sparing), lamp-red #ff3b4e (scorer red/denied), amber (warnings), poison purple (later).
- Fonts: Chakra Petch (display), JetBrains Mono (UI). Both OFL.
- Shapes: panels and buttons with one cut corner, thin cyan lines, glow on active things.
- Orb colour = chosen model. Locked things: dimmed, lock icon, shake + red toast on click.
- Never invent incident facts in UI text. Chapter names beyond "The Room" are redacted placeholders until the storyteller names them.
- Motion: anything over ~2 s is skippable; honour prefers-reduced-motion.
- Do not use Hugging Face's logo or the emoji; only the yellow nod.

## Status / next
- Done: start screen v1, tokens.css, answers to engineer (orb = shader, shell + props, tokens yes).
- Next: Julius reviews start screen. Then HUD (token bar, quest list), orb reference sheet, depot window UI, lamp/chute states, then ch1 props.

## Update 2026-10-11 (late)
- Engineer integrated start screen v1 1:1 (scoped CSS, `ss-` keyframes, ids→classes). Keep prototyping as before; he re-ports. Chapter 1 shows 5 flags.
- MANIFEST.md was empty (earlier write failed) — now filled; added `common.favicon`.
- Still open: Julius's sign-off on the look; then HUD → orb reference sheet → depot window UI.

## Ch1 UI kit v1 (2026-10-11)
- `design/ch1/`: `ch1-ui.css` (prefix `c1-`), `index.html` live gallery, `sprites/`, `sfx.js` (synth sketches). Exported to `handoff/design-to-app/assets/ch1/` (gallery css link points to `../start-screen/tokens.css` there). Re-copy after edits.
- Not done: 3D .glb props, orb reference sheet, final audio files, intro body reveal. Waiting on Julius's feedback.

## 2026-10-12
- Julius accepted the 2D UI kit (HUD and windows) as good enough for now. He rejected the 2D scorer eye ("terrible") and called the kit "too simple" overall. 3D is now my job: no handing it off to the engineer.
- 3D pipeline: headless Blender 4.3.2 (`design/3d/`, scripts → `.glb` + preview PNG). Proof of concept is in `design/3d/poc/`. Proposed adding a Blender MCP for live iteration; waiting on Julius.
- Engineer ids to export against: `handoff/app-to-design/2026-10-11-ch1-greybox-ready.md`. Emissive meshes are named `screen` / `bulb` / `paper`.
- Asked research for real prompts and real code: `handoff/design-to-research/2026-10-12-real-prompts-and-code.md`.

## 2026-10-12 (desktop app session)
- Live Blender works through `design/3d/tools/bl.py` (`python3 -I design/3d/tools/bl.py ping | code <file.py> | cmd <type>`). Blender runs the community ahujasid add-on on port 9876. The Claude "Blender" extension (official Blender Lab MCP) speaks a different protocol, so its tools time out. Use bl.py, or have Julius swap the add-on.
- Asset in progress: **scorer eye** (`ch1.scorer`, `design/3d/scorer/`). Julius: the POC in `design/3d/poc/` is "very bad". Start from scratch, don't reuse it.
- Fit to the app: it's placed at `SCORER_LAMP` [5.4, 2.5, 2.0], above the chute on the right wall, looking −x. Origin goes at the eye centre and the eye looks along glTF +Z (Blender −Y), so `lookAt(player)` works. The state glow is one shared material on the mesh `bulb`: off #1a2333 · green #39ff9c · red #ff3b4e · dark #b86bff flicker. Under 20k tris.
- Planned: floating armored eye with eyelids (`blink`), gyroscope rings (`idle`), a segmented glowing iris, aperture blades, and optionally 5 score ticks. Review page: `design/3d/scorer/index.html` (three.js viewer with state buttons). Julius reviews before export to handoff.
- **Scorer v1 approved by Julius (2026-10-12)** — next: trim to <20k tris, export to handoff + manifest. How it was made: `design/3d/HOWTO.md`. Was: (`design/3d/scorer/`): `scorer.py` (source of truth; `blender -b --factory-startup -P scorer.py` rebuilds everything), `ch1-scorer.glb` (~20.7k tris, 578 KB), `scorer.blend`, `previews/` (4 states + `ref_scorer-states.png`), and `index.html`, a three.js viewer with state buttons, blink, the eye following the mouse and score ticks. It needs `ch1-scorer.glb.js`, the glb as base64, regenerated after every export. Not exported to handoff yet.
- glb nodes: `scorer` > `eye` (rotate with lookAt) > lids `lid_top`/`lid_bottom` (rotate X, 52° = closed), `bulb` (iris, shared material `bulb` = state glow; the pupil core and ring nodes use it too), `tick_1..5` (own materials). `ring_outer`/`ring_inner` sit beside `eye` under `scorer`; spin their `_band`/`_nodes` children on Z.
- Live Blender crashed on a rebuild (mesh removal during a UI redraw). Build headless and use the live session only for viewing.
