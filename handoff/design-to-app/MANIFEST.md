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
| `ch1.scorer` | `models/ch1-scorer.glb` (previews `refs/ch1-scorer-preview.png`, `refs/ch1-scorer-in-room.png`) | 3D model | approved (v1.1 draft) | Armoured eye, origin = eye centre. **v1.1 (2026-10-12):** + static ceiling `mount` (spine, `crown`, `crown_glow` on material `bulb`, cables to the wall tray) and glowing accent lines on the rings (in `ring_*_nodes`, material `bulb`); 22.9k tris. Same file name and node names as v1. State glow material `bulb`; nodes `eye` (lookAt), `lid_top`/`lid_bottom`, ring `_band`/`_nodes`, `tick_1..5`. See `2026-10-12-ch1-desk-and-eye.md`. |
| `ch1.scan-plinth` | `models/ch1-scan-plinth.glb` (preview `refs/ch1-scan-plinth-preview.png`) | 3D model | draft | Pedestal under the scorer, ~1k tris. Emissive pad `screen`, node `top`. Use depends on the in-world flag proposal. |
| `ch1.room` | `models/ch1-room.glb` (previews `refs/ch1-room-overview.png`, `refs/ch1-room-discover-s1.png`, `refs/ch1-room-discover-s2.png`) | 3D model, WebP textures | approved | Room shell 12×10×3.6, origin = room centre on the floor, 6.2k tris. Door opening at three z −1.5 (`door_leaf`, `door_lock`), `ceiling_lamp`, `base_glow`, `floor_path_1..5` (discovery cue). See `2026-10-12-ch1-room-and-stations.md`. |
| `ch1.station-1` | `models/ch1-station-1.glb` (preview `refs/ch1-station-1-preview.png`) | 3D model | approved | Crypto terminal, 10k tris, in-world. `screen` 1.0×0.62, `cartridge` → `cartridge_seat`, `bay_flap`, `decoder_led`, header `bulb`, `light_anchor`. |
| `ch1.station-2` | `models/ch1-station-2.glb` (preview `refs/ch1-station-2-preview.png`) | 3D model | approved | Log rack, 9k tris. Portrait `screen` 0.78×1.25, `grep_lens` > `lens_arm` > `lens`, `rack_leds`. Search stays a window. |
| `ch1.station-3` | `models/ch1-station-3.glb` (preview `refs/ch1-station-3-preview.png`) | 3D model | approved | Port junction, 20.5k tris, played in 3D. `anchor_*`, `plug_*`, `socket_*`, `socket_led_*`, `legend_card`, readout `screen`. Cables drawn in code. |
| `ch1.station-4` | `models/ch1-station-4.glb` (preview `refs/ch1-station-4-preview.png`) | 3D model | approved | Debug-bay arcade cabinet, 7.2k tris, in-world shooting. `screen` 1.2×0.76, `counter`, `marquee`, `gun_mount` > `gun_head` > `gun_muzzle`. |
| `ch1.station-5` | `models/ch1-station-5.glb` (preview `refs/ch1-station-5-preview.png`) | 3D model | approved | Sealed "no consumer" terminal, 8.6k tris. `screen` 0.9×0.56, `pipe_flow_1..8`, `cap_glow`, `s5_seam`, plaque "OUTPUT → NO CONSUMER". |
| `ch1.desk` | `models/ch1-desk.glb` (previews `refs/ch1-desk-preview.png`, `refs/ch1-desk-close.png`) | 3D model | draft | Minimal prompt desk, 1.5k tris, origin = floor centre (three [0, 0, 0.6]). `paper` (UV 0–1 for the prompt text), `paper_glow`, `desk_edge`, `lamp_bar` (`desk_lamp`), `light_anchor`. See `2026-10-12-ch1-desk-and-eye.md`. |
