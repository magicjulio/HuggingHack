# Designer → App: Ch2 Step 0 intro, forge ending, sound, decorations (drafts, waiting for Julius's review)

**What it is:** The last four Ch2 design pieces. With these, Ch2 has no design gap left except the whole-game map, which Julius has parked for now.

| Piece | What |
|---|---|
| **Step 0 intro** | The tornado: the reply appears in the depot list, its folder path whirls into a funnel, and you fall into the Gate. |
| **Forge ending** | Step 6: V8SAME's proof, the slots lighting up, the inputs folding per round, the flag bursting out and spiralling into the orb. |
| **Sound** | 48 synthesised one-shots named after your events, plus 5 loops. |
| **Decorations** | The mood-pass scenery Julius kept. |

**What changed since the last handoff:**
- New files: `world/step0.js`, `world/tornado.js`, `world/decor.js`, `sfx.js`.
- `world/forge.js` has new phases (backwards compatible).
- `world/step7.js` adds `SOUND` + `soundLevels` (data only, nothing else changed).
- `ch2-ui.css` appends the `.c2-intro*` classes.

**What the receiver must do:**
1. Copy the files (§5).
2. Wire them as described below. All four are **drafts**: Julius hasn't reviewed them yet. They're safe to integrate now, since any changes after his review should be small and stay inside these files.

**Open questions:** none for you. Julius asked whether V8SAME should already be at the forge: yes. Script Step 6: "V8SAME stands at the forge … runs its own inputs … leaves to post its confirmation". It's built that way, and so is your store.

## 1. Step 0 intro (`world/step0.js` + `world/tornado.js` + `.c2-intro*` CSS)
- Reference: `design/ch2-ui/intro.html`, 7 s, `?t=&paused&closed`. Type a Ch1 message in the bar; **reduced** shows the `prefers-reduced-motion` variant.
- **The director** is pure, driven by your `introT`:
  - `direct(introT, {reduced})` → `{flash, dim, window, typed, open, stream, frame, tornado: {opacity, scatter}, landed, hint}`
  - `camPose(introT, layout, orbCentre, play, reduced)` → `{pos, look, fov}`. It **ends exactly on your play camera** (`play = {pos, look}` from your ThirdPerson at the spawn), so feed it to your camera override with `immediate`.
  - `orbPos(introT, layout)`: the orb's feet while it is pulled down onto the spawn.
  - `letterPose(i, n, stream)`: each reply letter's spiral into the centre (DOM transforms).
  - `replyFor(message)`: the same as yours. Also `pathFor`, `funnel(layout)`.
  - `T0`: the beats. Flash 0, window .3, reply 1.2, open 2, stream 2.5, tornado 2.8, dive 3.4, burst 5.6, land 5.9, settle 6.2, end 7.
- **DOM:** the Ch1 depot window (`.c1-win.c1-depot.c2-intro__win`) lists the player's message, then the reply (each letter in a `.c2-intro__l` span), then the board rows (your `BOARD_WAKE` + `ZZ_ENTRY`). On the overlay:
  - `--frame` dissolves the window around the flying letters.
  - `.c2-intro__dim`, `.c2-intro__flash` and `.c2-intro__hint` take their opacity from `direct`.
  - Copy the markup from `intro.html`.
- **3D:** `createTornado({U, funnel: funnel(layout)})`, then `.setText(pathFor(reply))` and `update(t, dt, direct(...).tornado)`. One instanced draw of ~3k glyphs; glyphs fade at the lens. The world (Gate, crowd) is visible from 2.7 s. At `landed`, a pink `trails.pop` at the spawn.
- **Skip:** any key jumps to the end state. **Reduced motion:** a calm crossfade with no tornado, and the camera already at the play pose.
- Also pass the reply into `createProps({reply})`, so the Gate's first zz folder is the same reply you just fell through.

## 2. Forge ending (`world/forge.js`)
- Reference: `design/ch2-ui/step6.html`. Rounds play at 6 s for review; the bar button switches to your real 15 s.
- **New state:** `{phase, t, slots, round, progress, orb: [x, y, z]}`, which is exactly your `ForgeState`, plus the orb centre. New ctx `flags: {v8: V8SAME_FLAG, player: FLAG5}`.
  - **proof (9 s):** a panel above the core with V8SAME's captured flag over the forged one. The 16 pairs light up over the first 80 % (as your `FlagMatch` does), with `=` between the rows, then **MATCH**. You can drop your DOM `FlagMatch`.
  - **ready:** each filled slot glows and shows what went in.
  - **forging:** the four inputs orbit the core as words and fold into it every round; the rings and core speed up per round.
  - **absorb (2.5 s):** the flag's 38 characters burst from the core into a ring, then spiral into `orb` and shrink into it, with a ring flash on arrival at ~2.3 s. These characters bloom on purpose. You can drop your temporary flag label.
  - **done:** pass `power: .6` until Step 7 powers it down.
- **V8SAME leaving** stays your movement. My page sends it down the Reset Run over 2.2 s.

## 3. Sound (`sfx.js`, WebAudio, no files)
- Reference / sound board: `design/ch2-ui/sfx.html`. The films have a 🔊 button in `intro.html`, `cutscene.html` and `step6.html`.
- **Setup:** `const sfx = createSfx(); sfx.unlock()` on the first user gesture (the title-screen click or key).
- **Events → `sfx.play(name, opts)`:**
  - **body:** `jump`, `land {speed}`, `dash`, `glide`, `fell`
  - **game:** `respawned {why}`, `item_taken`, `crumble` (a decoy), `token`, `pad` (a new respawn pad), `talk` (each bubble line), `shoot` (left click), `muted`, `hit` (a spit), `cloud_tick` (each drain tick), `reset` (a laser hit), `laser_sweep` (a pass starting within ~12 m)
  - **forge:** `slot_in`, `proof_tick` (each pair), `proof_done`, `forge_started`, `forge_rewind`, `round_done {n}`, `flag_fly` (at absorb start), `flag_in_orb`, `poison`
- **Loops:** `sfx.loop(name, level)` returns `{set(level), stop()}`.
  - `ambience`: always, `.6`
  - `forge_hum`: within ~40 m of the forge; `.3` idle, `.4 + .2 × round` while forging
  - `cloud_hum`: falls off with distance to the nearest cloud; 1 inside
  - `tornado`: Step 0
  - `hum`: Step 7
- **Films:**
  - `step0.soundCues(reply.length)` + `step0.soundLevels(introT)`
  - `step7.SOUND` + `step7.soundLevels(cutT)` → `{muffle, hum, duck, forgeHum}`. `sfx.muffle(k)` gives the memory echo; `sfx.duck(k)` pulls the world down.
  - Fire each cue once when the time passes it. Skip cues when replays skip the film.

## 4. Decorations (`world/decor.js`): Julius keeps the mood-pass scenery
- `createDecor({layout, U, models: {s, m, l}, depot?})` and `update(t, dt)`; no state, nothing walkable.
- **What's in it:**
  - the shifting cube island right of the Gate's view
  - a tesseract over the Task Yard
  - 16 far islands, with streams of dim distant agents flowing to and from the level
  - three faint nested wire solids at the edge of the void
  - data rain
  - the Ch1 depot kiosk drifting by as rusty debris. Pass your loaded `ch1-depot.glb` as `depot`; leave it out to skip the debris.
- **Toned down as Julius asked:**
  - **data rain:** 300 streaks instead of 700, 70–230 m out, 45 % brightness
  - **nested solids:** 28 % opacity instead of 90 %
- **Cost:** measured steady 60 fps on the Iris Xe with and without it (`level.html?cam=tour`).

## 5. Files (`assets/ch2/`)
`world/step0.js`, `world/tornado.js`, `world/forge.js` (updated), `world/step7.js` (+ sound data), `world/decor.js`, `sfx.js`, `ch2-ui.css` (+ `.c2-intro*`). MANIFEST rows: `ch2.intro`, `ch2.sfx`, `ch2.world.decor`, `ch2.world.modules` (forge).

## Next reader
engineer. Wait for Julius's OK only if you'd rather not touch these twice.
