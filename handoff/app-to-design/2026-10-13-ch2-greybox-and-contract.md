# App → Design (designer + design2): Ch2 greybox is playable, and what the app reads from you

**What it is:** Ch2 runs in the app end to end as a greybox (all 8 steps, the fight, the cutscene, the save). This file says how your Ch2 work plugs in: what I read from `layout.json`, which view slots your assets replace, and the hooks for the screen layer.
**What changed since the last handoff:** First Ch2 file. Screenshots in `shots-2026-10-13-ch2/`.
**What the receiver must do:** **designer:** answer §2 (a few format details in `layout.json`) when you hand the layout off. **design2:** §4 lists the data your screen parts get. Build to that and nothing has to be redone.
**Open questions:** §2.

## 1. How to see it
`cd app && npm run dev`, then pick **02 The Cache** on the menu. With `?debug` a panel jumps to any step. With `?nofx` bloom is off. Everything you see is placeholder: wireframe slabs from layout data, sphere orbs, DOM labels. Everything gameplay needs comes from data, so your assets replace views without touching rules (Julius's "swappable views" rule).

Physics, pickups, hazards and the minimap never read meshes. They read **footprints and positions**: walkable outlines, pads, item spots and hazard paths.

## 2. designer: `design/3d/ch2/layout.json` → the app
I saw your `layout.json` (v1). It's almost exactly the data my greybox uses (`app/src/levels/ch2/layout.ts`), so I'll switch to it with a small adapter as soon as it's handed off: copied verbatim to `app/src/levels/ch2/layout.json`, as with the other designer files. Until then the game runs on my greybox from the storyteller's sketch. To make the adapter exact rather than guessed, please add or confirm:

1. **Outlines in the JSON.** Each model's walkable outline (s / m / l, in model units, the same polygon as the glTF `outline` extras) plus its slab depth under the top, e.g. `"models": {"s": {"outline": [[x,z]…], "depth": 3.2}}`. Physics and unit tests then don't parse .glb files. I apply `scale` (number or [x,y,z]) and `rotY` the same way you do.
2. **Curved bridges** (`"curve": true`): which curve? I'd sample a centripetal Catmull-Rom (three's `CatmullRomCurve3`, `centripetal`) every ~2 m into straight walkable pieces. Or put the sampled points in the JSON yourself.
3. **Drift and motion:** for slabs `drift` (amplitude in m? along the slab's long side? period?), lifts (bottom `pos` → `yTop` over `period`, ping-pong with ease-in-out?), clouds (`pos + drift · sin(2πt / period)`?). One line each in `about` is enough.
4. **Reset waves:** `{bridge, segment, t, period, offset}`. I read it as "a wall at point t of that segment". Does it sweep *across* the bridge sideways or *along* it towards the player, how long does one sweep take, and how wide and tall is the wall? Today mine travels down the bridge for 0.9 s every 2.8 s; dashing passes through.
5. **Still missing in the JSON:** token orb spots (+3), and the forge fight's bit spawn points, wave lanes and round-3 clouds.
6. **`physics`:** I'll use your block as the game's numbers: `walk`, `gravity`, `jump`, `glideFall`, `dashSpeed`, `dashTime`, `hover` (orb centre above the feet), `voidY` (fall line). Then what Julius feels in your `level.html` is what the game does. Tell me if you add more (air control, coyote time…). Mine are in `app/src/engine/platformer.ts` `DEFAULT_BODY`.
7. **Crates:** the Yard shows only what the player installed in Ch1, including decoy packages like `moment` or `chalk`. I'll put a crate on your spot when its label matches and on the next free spot otherwise, so please leave a few spare `crate` spots.

The ids map 1:1 (`piece-7731` → the `7731` piece, etc.). Nothing to rename.

## 3. designer: view slots your 3D assets replace
Each one is one component. It gets the props below and nothing else. Node names in your .glb are free, as long as you tell me which node does what (as with Ch1).

| Slot | Props it gets (from store/sim, per frame where it moves) |
|---|---|
| Island / slab / bridge | its layout entry + the surface's world matrix (moves for drifting slabs and lifts, tilts for tilting platforms) |
| Player orb | position, model colour, `poisoned` 0/1, cutscene time (the flinch and drop happen at 21–22 s), a `KAM1196A` label |
| NPC orb (`c03220`, `FLAC38347`, `V8SAME`) | position, current bubble text (design2 draws it at your `bubble_anchor`), V8SAME leaving |
| Pickup (seed, piece, decoy, crate) | kind, label, state `there / taken / crumbled` |
| Token orb, respawn pad | taken · active (last pad) |
| Flood bit, spit | position, state `idle / chase / muted / gone` |
| Cloud, reset wave | centre + radius · position, direction, width, height, seconds until the next wave (for a telegraph) |
| Forge | slots filled 0–4, phase `proof / ready / forging / absorb / done`, round 1–3, round progress 0–1, proof time (V8SAME's 32-character match lights pair by pair over 9 s) |
| Flag into the orb | progress 0–1 over 2.5 s, then the event **`flag_in_orb`** (your agreed hook name) |
| Flood counter | the number (0 → 1,188) |
| Poison in the world | `uPoison` 0–1 (void tint, orb tint) from 21 s of the cutscene. Wire it as a uniform as you planned. |

## 4. design2: the screen layer gets this data
All of it is in the chapter store (`app/src/levels/ch2/store.ts`). My placeholders live in `Screen.tsx` + `ch2.css`. **Name clash:** my placeholder CSS also uses the `c2-` prefix. When your kit arrives I delete my file and use yours verbatim, so build freely with `c2-`.

| Part | Data |
|---|---|
| Log ribbon | `log: {id, text, kind}[]`, kind = `normal / big / struck / local`. In the cutscene: `big` lines land at 0 s, the `first mention` line turns `struck` at 26 s and `local` (text `… local copy`) at 28 s. |
| Bubble | handle + text, anchored in 3D (I pin your DOM element to the NPC's anchor) |
| Quests + thoughts | the Ch1 list plus `sub` lines (`Seed (0/1)`, `Task pieces (n/3)`, `Forge`). Thoughts are lowercase lines. |
| Inventory | seed + pieces carried (`inventory`), `items[id]` states |
| Poisoned | `status: ['poisoned']` → icon; the `POISONED` stamp shows 23–28 s |
| Minimap / full map | `layout.json` + player position and camera yaw (per frame) + current goal point + pads reached (`padsSeen`, quick travel) + area names |
| Intro (Step 0) | `introT` 0–7 s, the player's Ch1 message, the reply text. Any key skips. |
| Cutscene (Step 7) | `cutT` 0–37 s. The beat times are one table, `CUTSCENE` in `app/src/levels/ch2/config.ts`, matching the shot list. Post effects: send GLSL with named uniforms (`uFlashback`, `uPoison`, `uPoisonOrigin`). I port them to the app's postprocessing `Effect` and drive them from `cutT`. Memory stills: PNGs. |
| Sounds | I fire events (`jump`, `land`, `dash`, `glide`, `fell`, `respawned`, `item_taken`, `round_done`, `flag_in_orb`, …). Name your sounds after them. |

## Next reader
designer (§2, §3) and design2 (§4).
