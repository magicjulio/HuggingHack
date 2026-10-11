# Design → App: start screen + answers to your questions

**What it is.** First delivery: the start screen prototype and `tokens.css`, plus answers to the three open questions in `app-to-design/2026-10-11-stack-and-asset-formats.md`.
**What changed since the last handoff.** First file in this channel.
**Supersedes.** Nothing.

## What you must do
1. Open `assets/start-screen/index.html` (double-click works; add `?skipboot` to skip the intro). Port it to a React component, keeping the look 1:1. Julius has not signed off on the look yet, so treat it as `draft` until he does.
2. Wire the hooks below. Fill chapters and models from game data; the lists in the HTML are placeholders.
3. Use `assets/start-screen/tokens.css` as the shared token file for HUD and windows. Fonts live next to the start screen (`assets/start-screen/fonts/`), move them where you like.

## Hooks
- `data-action="start"`, `select-level` + `data-level`, `select-model` + `data-model` (+ `data-color` hex = orb colour), `settings`. Locked items carry `data-locked`; clicking one shakes it and shows a "denied" toast.
- The prototype also dispatches window events: `rogue:start {level, model}`, `rogue:select-level`, `rogue:select-model`, `rogue:locked`. Replace with store calls.
- Keyboard: W/S or ↑/↓ chapter, A/D or ←/→ model, Enter starts.
- Launch animation (orb swells, white flash, fade, ~1.1 s) ends by firing `rogue:start`. Keep it, or cut it if the 3D intro should start straight away.
- Boot intro: ~2 s, skippable by any key or click, skipped under `prefers-reduced-motion`.

## Tech
Vanilla JS, two canvases (agent-swarm background, orb), no libraries, no network. Fonts local. Disclaimer text is a marked placeholder (`[PLACEHOLDER DISCLAIMER]`), the real text comes from the storyteller/Julius. Chapters 2-4 are redacted placeholders: I invented no chapter names. The model stat bars (HACK/STEALTH/TOKENS) are placeholder values, not game balance.

## Answers
1. **Orb: shader in code.** I will deliver a reference image and a description (colours, core, rings, motes, reaction to state) and you build the glow. The start-screen orb is a 2D-canvas version of it you can read for the idea. A `.glb` is only needed for the optional body in the intro; I will do that separately once Julius decides on it.
2. **Room: shell + separate props.** Yes, as you prefer. Shell is one `.glb`, interactables are separate files with named emissive meshes.
3. **`tokens.css` from day one: yes.** It is delivered now. Colour names you can rely on: `--color-hack-green`, `--color-flag-green`, `--color-lamp-red`, `--color-signal-cyan`, `--color-hug-yellow`, `--color-warn-amber`, `--color-poison`.

## Open questions
- Julius still has to say whether he likes the look. Changes will come as `-v2` in the manifest.

## Next reader
Engineer.
