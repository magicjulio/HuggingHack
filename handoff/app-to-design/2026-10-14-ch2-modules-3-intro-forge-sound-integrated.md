# App → Design: world modules part 3, forge ending, decor, sound and the Step 0 intro are in the game

**What it is:** Integration report for your two handoffs `2026-10-14-ch2-world-modules-3.md` and `2026-10-14-ch2-intro-forge-sound-decor.md`. Everything you sent is in the playable Ch2, copied verbatim.
**What changed since the last handoff (mine: `2026-10-14-ch2-modules-1-integrated.md`; the external engineer's HUD/film/NPC reports came in between):**
- **No placeholder view is left in Ch2's world.** The app's greybox Old Board, slabs, lifts, pads, pickups, crates, token orbs, plinth, flood bits, spits, counter, ribbons, the DOM flag match, the DOM round bar and the flying flag label are all deleted.
- The Step 0 intro, the sound and the decor are live too. They're your drafts, built as they are; once Julius has reviewed them, send new copies and I'll re-copy.

**What the receiver must do:** look at the screenshots (`shots-2026-10-14-ch2-modules-3-intro-forge/`), and answer the open questions below when you next export.

**Open questions:**
1. **Proof panel height.** From the dais, the default camera cuts V8SAME's proof panel (`CY + 3.6`) off at the top of the screen. The player sees it only by looking up. Lower it, or is that how you want it?
2. **Forge fight lasers (Julius, after playing):** "two are too much". Only the left-to-right lane `forge-ew` stays from round 2; `forge-ns` is gone. The app drops it in `layout.ts` for now. Please remove `forge-ns` from `layout.json` (and your previews) in your next export.
3. **Ch1-room travel on the map** (carried over): Julius wants it later. When you do the whole-game map, please send the `regions[]` / `unlockedBy` data shape first, so I can plan the save and the travel.

## 1. How each module is fed
| Module | Clock | State from the app |
|---|---|---|
| `oldBoard` | game | `slabs[i].pos` = the physics surface's current top centre (the same transform the body rides on) |
| `createLifts` | game | `lifts[id].y` from the physics surface |
| `createPads` | render | `snap` = the platform world's `groundBelow`; `active` = last pad; `seen` = pads reached |
| `pickups` | render | `items` by layout id (through `ITEM_IDS`); `tokens` = taken orbs; `crates` = `cratesFor(installed)` |
| `props` | render | built together with the islands (`islands.byId`); `reply` = the same `replyFor(ch1Message)` the intro shows. Hidden in the Step 7 film, like the island labels |
| `flood` | game* | `bits` by layout index (each flood bit now carries its `spot`), `forge` = the first 8 live fight bits, `counter` from the store's Flood time. Each new sim spit → one `spit(from, orb, trails)` burst on the crowd's shared trails (I dropped my spit cubes; the burst is the spit's look) |
| `ribbons` | render | `message` = the player's Ch1 message |
| `forge` | render | your new state: `phase`, `t`, `slots`, `round`, `progress`, `orb` (the player orb module's centre); `flags` = app `V8SAME_FLAG` / `FLAG5`; `power` .6 after `done`, the film's `power` in Step 7 |
| `decor` | render | `models` = the island .glbs; `depot` = `ch1-depot.glb`. Hidden during the Step 7 film so the accepted film stays exactly as you approved it (say if you want it on) |
| `tornado` | render | `funnel(layout)`, `setText(pathFor(reply))`, `direct(introT).tornado`; mounted only during the intro. Pink `trails.pop` at the spawn on `landed` |

\* "game*" = a scene clock that follows game time (pause and map freeze it) and also runs during the intro, because game time only starts after the intro. NPCs, crowd/trails and flood use it, so the world you fall into is already moving.

**Crate collider yaw:** your note says `-mesh.rotation.y`, but in our engine a surface's `yaw` is the same Euler Y as three's `rotation.y`. So the crate collider now uses `(label.length × 1.7) mod 2π`, the mesh's own turn, and they line up.

## 2. Step 0 intro
- The DOM is your `intro.html` markup, as React. The rows are the player's message, the reply (`zz` stays one pink piece, then one span per letter) and the board rows (`BOARD_WAKE` + `ZZ_ENTRY` from Ch1). `--frame`, dim, flash and hint come from `direct`. The letters fly with `letterPose`, measured the way your page does it.
- The camera override runs `camPose(introT, layout, orbCentre, PLAY, reduced)`. PLAY is computed from our `ThirdPerson` formula, the same as your `playPose`, so the hand-over doesn't jump (screenshot `intro-landed-play`). The orb follows `orbPos`, gliding until `landed`.
- Any key or click skips. Reduced motion is `prefers-reduced-motion`, or `?reduced` for review.
- **Perf:** about 60 fps in play at 1920×1080 (high tier, Iris Xe, with decor). The intro runs at 50–55 fps after warm-up. A cold start also loads modules and fonts during the first seconds, which the black dim hides until 2.7 s.

## 3. Sound
- The store queues sound moments at their source (`sim.sounds`; a headless test checks the queue). `Sound.tsx` plays them with your `sfx.js`:
  - body events: `jump`, `land {speed}`, `dash`, `glide`, `fell`
  - `respawned {why}`, `item_taken`, `crumble`, `token`, `pad` (only a pad you haven't reached before), `talk` (each c03220 line + V8SAME's bubble), `shoot`, `muted`, `hit`, `cloud_tick`, `reset`
  - forge: `slot_in`, `proof_tick` (pairs 1–15), `proof_done` (pair 16, MATCH), `forge_started`, `forge_rewind`, `round_done {n}`, `flag_fly`, `flag_in_orb`
  - `laser_sweep` is detected in the view: a pass that starts within 12 m.
- **Loops:**
  - `ambience` .6
  - `forge_hum`: fades in over 40 m; .3 idle, .4 + .2 × round while forging
  - `cloud_hum`: 1 inside a cloud, fading out over 14 m outside the nearest one (forge clouds from round 3)
  - `tornado` / `ambience` from `step0.soundLevels`; `hum`, `muffle`, `duck` and the forge hum from `step7.soundLevels`
- Cue lists fire once as introT/cutT passes them. A jump of more than 0.5 s (a skip or a replay) passes them silently.
- Paused or map open: master volume goes to .2.
- `poison` from your forge list only plays through `step7.SOUND`; I couldn't find another moment for it.

## 4. Files (app)
`src/levels/ch2/world/{oldBoard,pads,pickups,props,flood,ribbons,decor,step0,tornado}.js` (new) and `{clouds,forge,step7}.js` (updated), `ui/ch2-ui.css` (+ `.c2-intro*`), `ui/sfx.js`. Views: `World.tsx`, `Intro.tsx` (replaces `Screen.tsx`), `Sound.tsx`.
Checks: tsc, eslint, 51 unit tests, 9 browser tests (the Ch2 ones repeated 3×), no console errors.

## Next reader
designer. Julius reviews the drafts (intro, sound, forge ending, decor) in the game itself.
