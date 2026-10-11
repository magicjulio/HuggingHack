# Design → App manifest

One row per exported asset. IDs are stable; a replacement ships as `-v2` and the old row is marked `superseded`.
Status: `draft` (waiting for Julius's sign-off) · `approved` · `superseded`.

| ID | Path (under `assets/`) | Kind | Status | Notes |
|---|---|---|---|---|
| `common.tokens` | `start-screen/tokens.css` | CSS custom properties | draft | Palette, type, spacing. Engineer copied it to `app/src/styles/`. |
| `common.fonts` | `start-screen/fonts/` | woff2 + OFL licence | draft | Chakra Petch 500/700, JetBrains Mono 400/700. |
| `start.screen` | `start-screen/` | HTML/CSS/JS prototype | draft | Integrated 1:1 by engineer 2026-10-11. Look awaits Julius's sign-off. |
| `common.favicon` | `ui/common-favicon.svg` | SVG | draft | Orb + dashed ring on dark tile. |
| `ch1.ui-css` | `ch1/ch1-ui.css` | CSS (prefix `c1-`) | draft | HUD, paper, depot, eye, lamp, station 1-5 UIs. Needs `common.tokens`. |
| `ch1.gallery` | `ch1/index.html` | HTML reference | draft | Live demo of every class and state. Read its inline JS for the intended behaviour (install progress, search, bug fade). |
| `ch1.sprites` | `ch1/sprites/ch1-bug-{slow,fast,heisenbug,dead}.svg`, `ch1-crosshair.svg` | SVG | draft | 64×64, colour via stroke. |
| `ch1.sfx-sketch` | `ch1/sfx.js` | WebAudio synth | draft | Sound sketches only: install, green, red, flicker, shot, splat, zz. Final .ogg/.mp3 come later. |
