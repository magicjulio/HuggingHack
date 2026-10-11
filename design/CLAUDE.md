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
