# App → Design (designer): ship the Ch2 world as JS modules the app copies verbatim

**What it is:** A request. Please move the world code out of `design/3d/ch2/level.html` into ES modules. The app will copy them unchanged, the same way it copies your .glb files. I also confirm your layout handoff.
**What changed since the last handoff:** Your `2026-10-14-ch2-layout.md` answered all of my §2. Julius approved the merge plan on 2026-10-14: **"my game, their world"**. The app keeps its rules, steps, HUD, cutscene, save and tests. The look and the movement feel come from you.
**What the receiver must do:** Split the world code as described in §2. Keep `level.html` running on the modules, so the page stays your live reference and proves they work. Export them in `handoff/design-to-app/assets/ch2/world/` with MANIFEST rows. You decide the order, but islands, bridges and the environment are the most useful first (§4).
**Open questions:** §5.

## 1. What I'm doing in the meantime
- The game now reads your `layout.json` v2 (the greybox layout goes).
- Movement uses your formulas and the numbers in `physics`: the exponential accel, `groundAccel`/`airAccel`, a dash of 26, `stepUp`/`snapDown`, tilt and pads. What Julius walks in `level.html` is then what the game does. The autopilot test checks every jump of the golden path.
- I copy no visual code by hand. Your modules replace my placeholder views one by one, so we never port the same thing twice.

## 2. Module contract
1. **Files:** `design/3d/ch2/world/*.js` as plain ES modules, imported by `level.html`. Split them however you like. A natural split: `env` (sky, fog, backdrop), `islands`, `bridges`, `oldBoard`, `slabs`/`lifts`, `pads`, `pickups` (seed, pieces, decoys, crates, token orbs), `npcs` (c03220, FLAC38347, V8SAME), `crowd`, `forge`, `clouds`, `lasers`, `counter`, `ribbons`, `trails` (letter particles, pops), `playerOrb`.
2. **Imports:** only `three` and `three/addons/…`. **Please pin your importmap to `three@0.186.1`**, the app's version (`level.html` is on 0.170.0 today). Then the shaders behave the same in both places.
3. **No globals and no DOM:** no `window.LAYOUT`, `window.GLB`, `$()`, `keys` or `location` reads, and no `document` inside a module. The caller passes everything in:
   - `layout` (the parsed JSON)
   - shared uniforms `U` (`uTime`, `uPoison`, `uPsy`, …; I own the object and advance `uTime`)
   - loaded glTF scenes for the islands (I load the `.glb` files by URL and pass `THREE.Object3D`s)
   - `camera` for things that face it (trails, tags)
   - Your page keeps doing its own loading and passing, so nothing changes for you there.
4. **Shape:** `createX(ctx) → { object, update(t, dt, state), dispose() }`.
   - `object` is a `THREE.Object3D` that I add to my scene.
   - `update` is called every frame.
   - `state` is plain data from my store, shaped like my §3 props table in `2026-10-13-ch2-greybox-and-contract.md`. For example:
     - forge: `{slots, phase, round, progress, proofT}`
     - pickup: `{id, state: 'there'|'taken'|'crumbled'}`
     - player orb: `{pos, grounded, glide, dash, poisoned, cutT}`
     - NPC: `{pos, leaving}`
   - In `level.html` your own controller fills `state`.
5. **Gameplay positions come from the caller.** Slabs, lifts and tilting islands get their world matrix from my physics in `state`, and the module applies it. Tilt depends on where the player stands, so the physics has to own it. Cosmetic motion stays yours: bobbing shards, crowd wandering, `Math.random` sparkle.
6. **Effects on demand:** trails and pops as a small API, e.g. `fx.emit(pos, text, color)` and `fx.pop(pos, color, size)`. I call them on game events (`respawned`, `fell`, `reset`, `item_taken`, `flag_in_orb` …, the event list in §4 of my contract file).
7. **Motion formulas (optional but very welcome):** put `waveState`, `waveHit`, slab drift, lift y and cloud position as pure functions in a `world/motion.js` with no THREE dependency. I'd use that same file for the hit rules and test it. The lasers you see and the lasers that hit can then never drift apart.
8. **Render settings:** please export the fog (`FogExp2 0x03060d, 0.0052`), background, bloom (strength 0.7, radius 0.5, threshold 1.0), tone mapping (AgX) and camera FOV as one plain object, e.g. `env.RENDER`. I'll match them in the app's post-processing, which is pmndrs `postprocessing`, not UnrealBloom. I'll send you screenshots so we can compare.
9. **The rule from your handoff stays:** agent orbs stay under the bloom threshold, and only the player orb blooms.

## 3. Out of scope for these modules
- DOM (bubbles, handle tags as HTML, HUD and map). The screen layer comes as design2's kit (`c2-` CSS, `hud.js`, `map.js`); `map.js` already has a port contract.
- Input, camera control and physics. The app has its own.
- Story text. Labels such as folder names and handles come from `layout.json` or `state`.

## 4. Order that helps me most
1. `env` + `islands` + `bridges` (with `RENDER`): after this, the game looks like your level.
2. `lasers` + `clouds` + `motion.js`
3. `oldBoard` + `crowd` + `npcs` + `pickups` + `pads` + `trails`
4. Your next slice (forge, player orb with poison, `flag_in_orb`, `uPoison`, `orbFlinch()`/`orbDrop()`/`forgePowerDown()`), built in this form from the start.

## 5. Open questions
- Does the `update(t, dt, state)` shape work for everything, or does something need its own hook, such as the cutscene orbit?
- About your question 2: yes, `forgeFight` is enough for me.

## Next reader
designer.
