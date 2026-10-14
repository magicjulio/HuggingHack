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
- **Round 2 (2026-10-12), waiting for Julius's review.** The review hub is now `design/3d/index.html`; it replaces `scorer/index.html`.
  - `ch1.scan-plinth` (`design/3d/plinth/`): a small table under the scorer where the player lays the flag. It has a tilted glowing pad (mesh `screen`) and a return slot.
  - Scorer **smooth** variant: `SCORER_VARIANT=smooth`, written to `ch1-scorer-smooth.glb`, with the same node names.
  - "Scan station" mockup: flag on the pad → eye looks down → scan sweep (1.4 s) → green/red/dark.
  - Open question for story/engineer (via Julius): today the flag is typed at the chute; Julius wants it laid on the plinth and scanned.
- **Depot v1 (2026-10-12), waiting for Julius's review.** `ch1.depot` (`design/3d/depot/depot.py` → `ch1-depot.glb`, ~6.7k tris, previews `depot-on/glimmer.png`). It's a 2.4 × 2.6 × 0.5 wall unit with its origin at the base centre and its back on the wall. Glowing mesh `screen` is a 2.0 × 1.8 plane with UVs at the layout screen spot (0.26 m in front of the unit centre, 1.5 m up), and the list stays HTML. Side bays have green LEDs (one amber). The header has the DEPOT sign, a segmented light bar and a downlight. At the bottom is a delivery bay whose `hatch` node is animatable, plus `fan_l`/`fan_r`. The hub shows it with off/on/glimmer (amber chase on the light bar) and a canvas mock of the Z-to-A list.
  - Open idea (look only): an installed tool drops into the delivery bay.
- **Depot v2 (2026-10-12) replaces v1.** Julius rejected v1 as "too modern / clean" and asked for a rusty cyberpunk drop-point kiosk (Cyberpunk 2077 refs) with ARTIFACTORY as the sign. `depot.py` now generates worn paint/rust/grime albedo + ORM + normal textures with numpy (`depot/tex/`), embedded as JPEG. ~10.6k tris, 1.4 MB. It is 3.0 m tall (layout box 2.6), and the frame/hood stick out ~0.17 m in front; the engineer needs to know once it's approved. New nodes: `service_door`, `beacon` (blinks on glimmer), `tube_broken` (flickers). Waiting for review.
- **Handoff 2026-10-12:** `handoff/design-to-app/2026-10-12-ch1-3d-props.md` + MANIFEST rows. Depot v2 (approved, WebP textures), scorer v1 (approved, trimmed to 19.8k tris), plinth (draft). It includes the station behaviour and in-world interaction, **approved by Julius**: depot UI via drei `<Html transform>` on `screen`, and the flag typed as flat 3D letters on the plinth pad. Still open: the storyteller on plinth vs chute. Next reader: engineer.

## Room + stations v1 (2026-10-12, APPROVED by Julius)
- Shared build kit `design/3d/lib/kit.py` (materials, texture synth, box/cyl/torus/plane/text/wire/hazard, `station_header`, preview `stage`, `export`). New prop scripts import it; see the top of any `stations/s*_*.py`.
- Stations: `design/3d/stations/s1_decode.py … s5_impossible.py` → `ch1-station-<n>.glb` + `previews/`. The room shell is `design/3d/room/room.py` → `ch1-room.glb`; it also renders whole-room previews with every prop placed at the spread layout.
- Station family: worn gunmetal + off-white panels + steel trim, a shared numbered header with a light strip `bulb`, and a `light_anchor`. S4 has a red ribbed arcade cabinet. S5 is deliberately clean black obsidian with purple seams (ominous, unlike the rest).
- Julius: spread the stations around the room (S2 and S4 behind the player) and make discovery one at a time (the room was too bright). S1/S4/S5 are played in-world, S3 by dragging 3D cables, S2 keeps its window.
- Hub `design/3d/index.html`: views Room walkthrough (beats 0–6) and Station 1–5 (playable: install, drag wires, shoot bugs, flag-5 pulse).
- Exported as draft: `handoff/design-to-app/2026-10-12-ch1-room-and-stations.md` + MANIFEST rows.
- Next: Julius reviews → desk + paper prop, station wake sound, maybe the orb body. S3 is at 20.5k tris (trim if the engineer asks).

## Desk + paper v1 minimal (2026-10-12, handed to the engineer as draft)
- `design/3d/desk/desk.py` → `ch1-desk.glb` (~1.5k tris, 80 KB), previews `desk-wake.png` / `desk-close.png`. Julius asked for "not rusty but fits in, minimalistic": a plain matte slab with waterfall legs, a slim T-lamp (`lamp_bar` `desk_lamp`, `light_anchor`), a recessed cyan frame `paper_glow` (breathes while the paper is unread) and a curled sheet `paper` (UV 0–1 for the prompt text texture). Hairline `desk_edge`.
- Hub: "Prompt desk + paper" view (dark / unread / read), and it replaces the greybox desk in the room walkthrough (the room's desk spot is lowered to 7, because the lamp carries the light).
- Exported: `handoff/design-to-app/2026-10-12-ch1-desk-and-eye.md` + MANIFEST row (draft).

## Scorer eye v1.1 (2026-10-12, handed to the engineer)
- Julius asked whether the eye still fits the room. My verdict: the eye stays clean (the judge, like S5), but it floated unanchored and was unreadable in the dark. Added to `scorer.py` (`build_mount`): a static ceiling `mount` (plate, telescoping spine, `crown` + `crown_glow` on `bulb`, cables, a feed into the right wall tray at +x), plus glowing accent lines on the ring arcs (merged into `ring_*_nodes`, `bulb`). 22.9k tris. The smooth variant was rebuilt too.
- `scorer/context.py` renders the eye in its real app pose with the room (`-- <glb> <png> [ambient]`). The "before" was 19.8k tris without the mount (kept only as a render: `previews/scorer-in-room-before.png`).

## Ch2 "Deep Cache" vibe pass 1 (2026-10-13, waiting for Julius's review)
- Julius: Ch1 is done for now (refinements after all chapters). Ch2 look = "wild cyber universe space", psychedelic "middle", rust optional and probably not. Review in small slices so we can pivot. The script may still change today (Julius ↔ storyteller), islands stay.
- `3d/ch2/islands.py` → `ch2-island-{s,m,l}.glb` (238/318/418 tris, ~200 KB each: textures are duplicated per file, merge them before handoff). Data-shard islands: flat circuit deck (emissive texture, 1 tex = 8 m), gunmetal rim, cyan `edge` line (tint per island), faceted crystal underside with cyan/violet vein emissive, `shard_<n>` nodes to bob. Origin = top centre, walkable plane y = 0; an `outline` empty carries the collider polygon as JSON (custom prop → glTF extras).
- `3d/ch2/index.html`: live three.js vibe scene (file:// works). Sky nebula shader, stars, far grid at y −95 with pulse rings, instanced data towers, data rain, light bridges (chevron shader), shifting 6×6 cube island (flat → ziggurat → exploded → spiral stair), tesseract over /tools, nested wire solids far away, directory labels, message ribbons (real board names), crowd of ~46–64 agent orbs (walk, bridge, floaty jump, "post" = type their message beside them, pop in/out), letter trails (instanced glyph atlas), far point streams. Psychedelic slider (calm→trip) and toggles incl. rusty debris (the ch1 depot tumbling far off, off by default). Cameras: `?cam=0..3`.
- Tool: `3d/tools/shot.mjs` screenshots a page on the real GPU (Vulkan, ~60 fps). Serve `design/` on 8765 first.
- Next after review: NPCs (c03220, FLAC38347, V8SAME), seed glyph + task pieces, hazards, forge + flag moment, poison, map. Re-read the script first.

## Two designers (2026-10-13)
- Julius added **design2**. Split and shared rules: `handoff/design-to-design2/2026-10-13-onboarding-and-ch2-split.md`. Short version: designer owns `design/3d/` (Ch2 world, NPCs, props, hazards, forge, player orb); design2 owns `design/ch2-ui/` (HUD, log, bubble, map, cutscene animatic + flashback fx, intro tornado, sound). Each appends only its own dated sections here (design2's headed `[design2]`).
- Level geometry contract: `design/3d/ch2/layout.json`.

## Ch2 level layout v1 (2026-10-13, waiting for Julius's review)
- Script v3.2 is final (Julius: "make sure the end product is what is described in the script"). `3d/ch2/level.html` builds the whole route from `3d/ch2/layout.json` (→ `layout.js` via `python3 3d/ch2/mklayout.py`; edit the JSON, not the JS): Gate (/zz, pink, zz folder cards, c03220) → tutorial stones + bridge + 9.4 m dash gap → Old Board (bone-coloured column, 6 dash-message slabs drifting, FLAC38347 ghost, seed ring broadcasting above) → data slide → Task Yard (/tasks/7731, paper tags 7731 on a floating plinth / TRAINING ROOM on the ledge under the bridge / decoys 7713, TRAINING RM, CHALLENGE 3, Ch1 crates, neighbour dirs ARV010841 / V8REG_OS1608 / LIBRAW42535, lift back up) → Flood (ring of 8, tilting stones, CHALLENGE 5 centre, text clouds, flood bits spitting garbage, counter → 1,188) → Reset Run (polyline climbing 8 → 34, 6 wave stations: walls slide sideways across the bridge, telegraph line + far emitters, runners blink out leaving RESET) → Forge (0, 34, 0; dais, 4 slots, 3 segmented rings, round-bar arcs, beacon, V8SAME = two gold cores circling).
- Walkable reference controller (WASD, Space jump / hold glide, Shift dash, R respawn, pads, carry on moving slabs/lift, tilting platforms, void fall). Physics numbers in layout.json `physics`. All gaps are measured: everything is jump+glide except the dash gap.
- Islands now export glTF extras (`kit.export(..., export_extras=True)`), so the `outline` node carries the collider polygon (userData.outline in three.js).
- Previews: `3d/ch2/previews/level/*.png`. Cams: `?cam=overview|gate|oldboard|yard|flood|run|forge|tour|c03220|FLAC38347|V8SAME|gate-memory`, `?at=<pad>&yaw=&pitch=` for play shots, `&clean` hides panels.
- Next after review: pickups working (E), forge rounds + flag-into-orb, poisoned orb, then Blender versions of forge / Old Board / tags for the engineer.

## Ch2 level v2 + handoff (2026-10-14, ACCEPTED by Julius)
- Julius accepted the level layout, the bloom fix and the red-laser reset waves. `layout.json` v2 has a `notes` block with every formula; exported as `ch2.world.layout` + `ch2.world.island-s/m/l` (`handoff/design-to-app/2026-10-14-ch2-layout.md`, answers the engineer's §2).
- Agents never bloom: `noBloom()` + `shadedOrbMat()` in level.html (`&agentbloom` = old look). The player keeps bloom.
- Reset waves = red laser scan lines sweeping ALONG the bridge (`waveState`/`waveHit`). Two looks: `?lasers=scan` (default, scanner head above, like the Ch1 scorer) and `?lasers=grid` (3 beams between posts). Close-up: `?cam=lasers`. Ask Julius which take if still unknown.
- Hooks for the screen layer: `window.CH2.camera`, `.scene`, `.tokenOrbs`; `&nobubble`. Tool: `3d/tools/evalpage.mjs <url> '<js>'` prints a page value as JSON.
- I also took over design2's `design/ch2-ui/` (Julius, 2026-10-14): slice B map done; C cutscene, D intro, E sound next. Status there.
- Next (mine): pickups (E), forge rounds + flag into orb, poisoned orb + hooks `uPoison`/`orbFlinch`/`orbDrop`/`forgePowerDown`/`?cam=forge-orbit`, forge fight data preview (`forgeFight`).
