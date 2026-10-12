# Design → App: Chapter 1 room shell + stations 1–5, spread layout, and "discover one at a time" lighting

**What it is.** The rest of the room as 3D models: the room shell (walls, floor, ceiling, door) and the five flag stations. It also sets out how they are placed, played and lit. Assets are **draft**: Julius reviews them in the hub (`design/3d/index.html`, "Room walkthrough" and "Station 1–5") before sign-off. The node names and contracts below are stable, so you can start building against them.

**What changed since my last handoff** (`2026-10-12-ch1-3d-props.md`): last time it was the depot, scorer and plinth. This one adds `ch1.room` and `ch1.station-1` … `ch1.station-5`. **Julius decided that the stations spread around the room** instead of standing in a row on the back wall. Stations 1, 4 and 5 are now played in-world (no window), like the depot. Station 2 keeps its terminal window, and station 3 is played fully in 3D.

**What you must do.**
1. **The room is too bright right away (Julius).** The player should feel they are discovering the stations one after another. See "Lighting: discovery" below. This is the most important part of this handoff.
2. Replace the greybox shell and the station boxes with the new models at the new positions (table below).
3. Build the in-world play for S1, S3, S4 and S5 as specified. There are working reference implementations in the hub's JS: `s1Rig` … `s5Rig` and `buildRoom` in `design/3d/index.html`.

**Open questions** are at the bottom.

---

## Files (under `assets/`)
| ID | File | Tris / size | Preview |
|---|---|---|---|
| `ch1.room` | `models/ch1-room.glb` | 6.2k / 490 KB | `refs/ch1-room-overview.png`, `refs/ch1-room-discover-s1.png`, `refs/ch1-room-discover-s2.png` |
| `ch1.station-1` | `models/ch1-station-1.glb` | 10k / 590 KB | `refs/ch1-station-1-preview.png` |
| `ch1.station-2` | `models/ch1-station-2.glb` | 9k / 530 KB | `refs/ch1-station-2-preview.png` |
| `ch1.station-3` | `models/ch1-station-3.glb` | 20.5k / 980 KB | `refs/ch1-station-3-preview.png` |
| `ch1.station-4` | `models/ch1-station-4.glb` | 7.2k / 440 KB | `refs/ch1-station-4-preview.png` |
| `ch1.station-5` | `models/ch1-station-5.glb` | 8.6k / 470 KB | `refs/ch1-station-5-preview.png` |

Source of truth: `design/3d/stations/s<n>_*.py`, `design/3d/room/room.py`, shared helpers `design/3d/lib/kit.py`. Textures are WebP, embedded.

## Conventions (same for all six)
- glTF +Z = the front, facing into the room.
- **Station origin = the floor point on the wall plane.** The prop stands in front of it (+Z). Place it with `position = [x, 0, wallZ]` and `rotation.y` as in the table.
- **Glow materials ship with their colour at emissive strength 1.** Drive `emissiveIntensity` per state in code; 0 = off. (glTF loses the colour when the strength is 0, which is why nothing ships dark.)
- Where one material is shared but needs per-mesh control, clone it (e.g. `pipe_flow`).
- `screen` = the glowing UI plane with UVs 0–1 (u right, v down in glTF, so `CanvasTexture.flipY = false`). Use the node's world matrix for `<Html transform>` / camera poses rather than my numbers.
- Every station has the same **header**:
  - a number plate,
  - a light strip `bulb` (one material per file, colour `#38d8ff`; set it to `#b86bff` on S5),
  - an empty `light_anchor`: about 1 m in front of the station at 3.3 m height. That's where its spotlight goes.

## Layout (three coords; replaces `station()` in layout.ts)
| Station | Wall | Origin `[x, 0, z]` | rotY | Floor footprint in front of the wall | Notes |
|---|---|---|---|---|---|
| S1 decode | back | `[-3.2, 0, -5]` | 0 | 1.4 wide × 0.82 deep | Console desk + monitor |
| S5 impossible | back, centre | `[0, 0, -5]` | 0 | 1.2 × 0.6 | Pipe runs x 0.6…1.8 at 1.1–1.8 m height (no collider needed) |
| S3 wires | back | `[3.2, 0, -5]` | 0 | wall-mounted, 1.5 × 0.3 at 0.87–2.0 m | No floor collider (only a thin ground pipe) |
| S2 log rack | front | `[-3.5, 0, 5]` | π | 1.05 × 0.72 | When swung in, the lens arm reaches ~0.9 m out |
| S4 debug bay | front | `[3.0, 0, 5]` | π | 1.36 × 0.82 | Arcade cabinet |

- The depot, plinth, scorer and door stay where they are.
- The desk stays at `[0, *, 0.6]` (still greybox; I design it next).
- S2 and S4 are **behind the player** at the start, so the player has to turn around to find them. That's on purpose.
- Focus points: the screen centre of each station. Targeting works as now (the 2.6 m range and cone still fit).

## Room shell `ch1-room.glb`
- Origin = room centre on the floor. Bounds match `ROOM`: x ±6, z ±5, height 3.6.
- Panelled walls, ribs every 2 m, a cable tray all around at 3.1 m, ceiling beams, and a lamp housing at `CEILING_LAMP`.
- The right wall has a **door opening** at z −1.5 (1.4 wide, 2.5 high), filled by `door_leaf`, with a stencilled "NO EXIT". `door_lock` (red) lights up with the room.
- Nodes and materials:
  - `ceiling_lamp` (material `ceiling_lamp`): the lamp panel. Keep your point light and the flicker logic.
  - `base_glow`: a thin cyan strip along the bottom of every wall. It's the room's "power on" signal.
  - `floor_path_1..5` (material `floor_path_n` each): glowing floor inlays from the desk to each station's front. **This is the discovery cue**, see below.
- Remove the greybox shell box and the greybox door.

## Lighting: discovery (the room is too bright right away)
Today `lightsOn` switches the whole room on: ambient 0.45, hemisphere 0.35, ceiling point light 22 and environment 0.35. Everything is visible at once, so there's nothing left to discover. Instead, light only what is awake. The walkthrough in the hub plays exactly these beats (buttons 0–6; beat 6 "all lit" shows what to avoid).

| Phase | What is lit |
|---|---|
| Wake (step 1) | Only the desk spot + the paper. Ambient ≈ 0.003, environment ≈ 0.02. |
| Paper closed (step 2) | **No lights-on.** The room "powers up" faintly: `base_glow` ≈ 0.35 (fade in over 1.5 s), `door_lock` on, ceiling lamp at ~12 % of today (a glow, not a light source), ambient ≤ 0.015, hemisphere off, environment ≈ 0.02–0.05. Depot and plinth each get a dim spot (≈ 60 % / 50 %). The desk spot drops to ≈ 35 %. |
| Station n wakes | Its header `bulb` flickers on (0.9 s fluorescent start-up), its **SpotLight** at `light_anchor` fades up over ~1 s, aimed at the screen (angle ≈ 0.62, penumbra 0.65, castShadow, 512 map), the screen boots (two flickers, then on) and `floor_path_n` lights and pulses gently (≈ 2.2 × (0.75 + 0.25 sin 3t)). S2 and S4 are behind the player: the glowing path and a positional wake sound guide the turn. |
| Station n done | Spot ≈ 12 %, `bulb` 0.35, screen ≈ 0.22, `floor_path_n` 0.12 (a faint trace of where you've been). |
| Dormant stations | Spot 0, `screen` 0, `bulb` 0. Not targetable (as now). S5's `s5_seam` stays at 0.25: a faint purple silhouette in the centre from the start, so the player wonders about it. |
| S5 | Purple header, purple path. Ceiling lamp flicker as in the script. |

Starting values I used in three (AgX, your bloom): station spot ≈ 28 cd (decay 1.6, distance 9), desk 22, depot 18, plinth 14. Tune them by eye. The goal is that walls are only readable where a station has woken.

## Stations: nodes and how they play
### S1 "Decode": in-world, like the depot
- `screen` 1.0 × 0.62 m (tilted back 8°). The file explorer + note + terminal are DOM on the screen (`<Html transform>`); the content is the script's.
- Decoder bay on the front right of the desk:
  - `cartridge`: hidden until `b64-decoder` is installed. On install, it slides from its rest pose to the `cartridge_seat` empty (0.45 s, ease). Same parent, so `position.lerpVectors(rest, seat.position)` works.
  - `bay_flap`: rotate X −35° from rest while it drops.
  - `decoder_led`: blinks amber at 2 Hz while the terminal says "Missing tool", then steady green once loaded.
- Playing it: after the install, the player drags (or clicks) the odd string onto the `[ DECODER ]` drop zone on the screen, and the plain text replaces it.

### S2 "Search": the rack is the landmark, the search stays a terminal window
- `screen` 0.78 × 1.25 m (portrait): log rain (canvas texture) while walking around. The window opens on E as now.
- `grep_lens`: hidden until `grep-lens` is installed. Then `lens_arm.rotation.y` animates from its rest value (+50°) to −92° over 0.9 s, and you set `lens.rotation.y = -lens_arm.rotation.y` every frame so the glass faces the room. `lens_rim` glows cyan; `lens_glass` is transparent.
- `rack_leds` / `rack_leds_cyan`: random blink.

### S3 "Wire it up": fully 3D, no window (Julius: "directly manipulate 3D wires")
- `anchor_22/53/80/443`: empties where each cable leaves its coloured post (fixed).
- `plug_22/53/80/443`: plug heads at rest in the tray. Origin = the cable attach point; the tip points down (−Y).
- `socket_ssh/dns/http/https`: empties at each socket mouth. Correct pairs: 22→ssh, 53→dns, 80→http, 443→https. The socket labels show plain names ("secure shell", "name lookup", "web", "secure web"), in shuffled order.
- `socket_led_<svc>` (own material each): green when its right plug is in; a red flash on a wrong try.
- `legend_card`: hide until `port-map` is installed.
- `screen` 0.54 × 0.065: readout strip, "n/4 LINKED", then `FLAG{ports_aligned}` in green.
- **Cables are drawn in code:** a `TubeGeometry` (r 0.011, 40 segments) over a CatmullRom curve from anchor → anchor + (0.02, −0.02, 0.05) → sagging midpoint → 7 cm behind the plug (above it while hanging, in front of it while carried or plugged) → plug. Use the plug's `wire_<port>` material.
- How it plays:
  - The camera glides to a pose in front of the box (like the depot) and the mouse is freed.
  - Raycast the plug meshes. The dragged plug follows the mouse on a plane parallel to the wall at local z ≈ 0.19, with the tip turned to the wall (`rotation.x = π/2`).
  - Release within 8 cm of the **right** socket: it snaps to the socket + 0.115 m in z and the LED turns green.
  - Wrong socket or empty air: it springs back to rest in 0.35 s, with a small orange spark (a point light at the socket) and a red LED flash. No penalty.
- Reference: `s3Rig` in the hub. Drag it yourself in "Station 3 · wires".

### S4 "Bugs": in-world shooting, no window
- `screen` 1.2 × 0.76 m (tilted 10°). The code and bugs are a canvas texture. Shooting = the normal first-person crosshair: raycast the screen and use the hit UV for the bug hit test. Bugs, heisenbug and splat behaviour as in the script (the canvas in `s4Rig` is only a mock; use the designer sprites). The program shown is your real `refreshToken()` code with typos, per DECISIONS 2026-10-12: each kill fixes a line, which the monitor now shows in-world. Keep it large enough to read from ~1.2 m (≈ 22 lines on the 0.76 m height).
- `counter` (0.36 × 0.045): "bugs n/12".
- `marquee`: the red "DEBUG BAY" sign, ≈ 3 while awake, with a rare flicker.
- `gun_mount`: hidden until `bug-gun` is installed. Each shot: `gun_head.lookAt(hitPoint)`, a short green beam from `gun_muzzle` to the hit point (90 ms, additive), and `gun_glow` flashes. This is the "green magic shot" moment.
- While the player shoots at S4, consider a soft camera assist (stand still, look free), as in the depot glide.

### S5 "The impossible one": in-world
- `screen` 0.9 × 0.56 m (DOM or canvas) ends with **"output → no consumer"**. The stamped plaque on the pipe says the same thing.
- `pipe_flow_1..8`: rings along the output pipe, ordered from the terminal to the cap. Clone the `pipe_flow` material per ring.
- `cap_glow`: ring at the blind flange.
- On each flag-5 attempt: a purple pulse runs ring 1 → 8 (≈ 7 rings/s), the cap flickers hard as it "dies", the header strip stutters and the screen line flickers. Then it falls back to idle (rings 0.15, cap 0.4).
- `s5_seam`: faint purple body seams, 0.25 while dormant and 1.2 while awake.

## Open questions
1. **Layout:** Julius still needs to confirm the exact spots (the hub walkthrough shows them).
2. **Wake sound:** I'll deliver a short "power-up" sound for stations (until then, `sfx.js` has synth sketches). It matters most for S2 and S4 behind the player.
3. **S3 triangle count:** 20.5k (the plugs, sockets and ring LEDs add up). Say if that's a problem and I'll trim it.
4. **Next from me:** the desk + paper prop, and an optional orb body.

## Next reader
Engineer, after Julius has looked at the hub (`design/3d/index.html` → "Room walkthrough").
