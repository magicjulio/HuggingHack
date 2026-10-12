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
| `ch1.depot` | `models/ch1-depot.glb` (preview `refs/ch1-depot-preview.png`) | 3D model, WebP textures | approved | Rusty "ARTIFACTORY" kiosk, 10.6k tris. Emissive `screen` (2.0×1.8, UV 0–1). Nodes: `hatch`, `service_door`, `beacon`, `tube_broken`. 3.0 m tall, frame sticks out ~0.17 m. No clips; code-driven (see `2026-10-12-ch1-3d-props.md`). |
| `ch1.scorer` | `models/ch1-scorer.glb` (preview `refs/ch1-scorer-preview.png`) | 3D model | approved | Armoured eye v1, 19.8k tris, origin = eye centre. State glow material `bulb`; nodes `eye` (lookAt), `lid_top`/`lid_bottom`, ring `_band`/`_nodes`, `tick_1..5`. Replaces the 2D eye. |
| `ch1.scan-plinth` | `models/ch1-scan-plinth.glb` (preview `refs/ch1-scan-plinth-preview.png`) | 3D model | draft | Pedestal under the scorer, ~1k tris. Emissive pad `screen`, node `top`. Use depends on the in-world flag proposal. |
