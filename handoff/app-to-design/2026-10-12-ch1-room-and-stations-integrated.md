# App → Design: the room, the desk, eye v1.1 and stations 1–5 are in the game

**What it is.** Feedback on `design-to-app/2026-10-12-ch1-room-and-stations.md` and `…-ch1-desk-and-eye.md`. Every greybox in Chapter 1 is gone: the room is entirely your models, with the discovery lighting and in-world play for S1, S3, S4 and S5.
**What changed since my last handoff** (`2026-10-12-ch1-3d-props-integrated.md`): room shell, desk + paper, eye v1.1 and the five stations are integrated. S1, S3, S4 and S5 lost their pop-up windows.
**What you must do.** Nothing is blocking. Please look at it **in the running game** (not only the hub) and send what's off through `design-to-app/`. Screenshots from my run are in `shots-2026-10-12/` next to this file. They come from a headless software renderer at 960 × 540 with the debug panel open; colours and darkness will look different on a real GPU.
**Open questions** at the end.

## How to see it
`cd app && npm run dev`, choose The Room, add `?debug` to the URL. The debug panel jumps to any step: `3. flag1` wakes S1, `4. flag2` S2, and so on. Aim at a station and press E (or click); Esc steps back.

## What's in, per your spec
- **Room shell:** `ch1-room.glb` at the origin. `ceiling_lamp`, `base_glow`, `door_lock` and `floor_path_1..5` are driven from the game state. The old greybox shell, floor, grid and door are gone.
- **Discovery lighting** as in your table: wake = desk lamp + weak room spot on the desk (7), ambient 0.003, env 0.02. After the paper: ambient 0.015, no hemisphere, env 0.03, base strip fades in over 1.5 s, door lock 2.5, depot spot 18 × 0.6, plinth spot 14 × 0.5 (shadows on), desk spot × 0.35. Floor paths: `min(2.2, t·2)·(0.75 + 0.25 sin 3t)` while awake, 0.12 when done; S5's path is purple.
- **Stations:** placed at your spread layout. Each has its `bulb` strip (0.9 s start-up flicker, 3 / 0.35 / 0), a SpotLight at `light_anchor` (28 cd, angle 0.62, penumbra 0.65, 512 shadow map), screen boot (two flickers) and dims when done. All values come from `stationBase`.
- **Desk:** `paper` carries the real prompt (`TEXT.prompt`) printed on a 480 × 660 canvas; `paper_glow` breathes while unread, then 0.15; `desk_edge` 0.8; `lamp_bar` 5; a spot in `light_anchor`.
- **Eye v1.1:** copied over, root unrotated, `mount` kept. `crown_glow` and the ring accents follow the state colour with no code, as you said.

## In-world play
| Station | Screen | How it plays |
|---|---|---|
| S1 | DOM on `screen`, 900 × 558 px | File list, the note with its three strings, a terminal. After install: `cartridge` drops into `cartridge_seat` (0.45 s), `bay_flap` −35°, `decoder_led` amber blink → green. Drag (or click, then click) a string into the `[ DECODER ]` slot. |
| S2 | canvas on `screen`, 400 × 640 | Log rain while walking around; E still opens the search window. `grep_lens` swings in (+50° → −92°, 0.9 s); `rack_leds`/`rack_leds_cyan` blink at random. |
| S3 | readout DOM on `screen`, 540 × 64 | Plain 3D: drag the `plug_*` meshes on a plane at local z 0.19, snap within 8 cm of the right socket (+0.115 z, tip into the wall), else spring back in 0.35 s with a spark and a red LED flash. Cables are tubes (r 0.011, 40 segments) with `wire_<port>`. `legend_card` appears with port-map. |
| S4 | DOM + canvas on `screen`, 960 × 608 | The real `refreshToken()` code with typos, your bug sprites from the UI kit crawling over it. Each click fires: `gun_head` turns to the hit point, a 90 ms additive beam leaves `gun_muzzle`, `gun_glow` flashes. `counter` is a canvas ("bugs n/12"), `marquee` ≈ 3 with a rare flicker. |
| S5 | DOM on `screen`, 900 × 560 | "FLAG 5", `> flag5`, **output → no consumer**. Each flag-5 attempt runs the pulse down `pipe_flow_1..8` (~7 rings/s), the cap dies flickering, the strip stutters, the output line flickers. `s5_seam` 0.25 dormant / 1.2 awake. |

Every in-world flag (S1, S3 readout, S4) is selectable text plus a **COPY** button: the real flags are `flag{32 hex}` now, so players paste them on the pad instead of typing. Your hub mocks (`FLAG{wake_up_agent}` …) are not used.

## Where I deviated (tell me if you disagree)
1. **Ceiling lamp emissive 0.6, not 1.2.** With our bloom it read as a bright light source whenever it was in view.
2. **Desk lamp 2.2, not 3.5, and aimed at the paper.** Your hub aims it 0.35 m past the sheet; aimed at it, 3.5 burned the paper to white. I also tinted the paper albedo to `#aeb4bc` and set its emissive to 0.05, so the printed lines show.
3. **Station spots aim at the screen centre**, not at (x, 1.25, z) + 0.5 m forward.
4. **S1 and S5 screens are DOM, not canvas.** The flags must be selectable and copyable, and drag-and-drop needs real elements. They use your UI kit classes (`c1-win__bar`, `c1-term`, `c1-btn`).
5. **S4 aims with the free mouse**, not the locked crosshair: the camera glides to the cabinet like the depot. Hits use the mouse position inside the screen's own coordinates.
6. **S5's camera frames the screen and the pipe** (2.3 × 1.1 m, shifted 0.62 m right), so the player sees the pulse die at the cap.
7. **S3 gets a floor collider** (1.5 × 0.32) so the camera can't walk into the panel. 20.5k triangles is fine; no need to trim.
8. The floor and ceiling don't cast shadows (saves shadow-map work); everything else does.

## Known limits
- DOM screens (`<Html transform>`) draw on top of the 3D scene, so nothing ever hides them. That's fine in this room because no prop stands in front of a screen. If you ever put something in front of a screen, tell me.
- There's no sound yet. The wake sound you offered matters most for S2 and S4, which are behind the player.

## Open questions
1. Do the darker room values work for you **in the game**? At the start, walls are only readable where a station has woken up. That's your plan, but please check it live; the screenshots are from a software renderer.
2. Would you like to style the S1/S5 screens further? They're plain kit components right now.

## Proposal for how we work (also sent to Julius)
- Please review in the running app (`npm run dev` + `?debug`), not only in the hub. The hub uses different light values and renderer settings than the game.
- When a handoff changes how something **plays** (here: four mini-games moving from windows into the room), say so at the top, so Julius can weigh the engineering cost before approving.
- A small "rig contract" table per model (state → node → value) would let me copy numbers instead of reading them out of the hub's JS.
- From now on I'll send screenshots back after each integration (like `shots-2026-10-12/`).

## Next reader
Designer.
