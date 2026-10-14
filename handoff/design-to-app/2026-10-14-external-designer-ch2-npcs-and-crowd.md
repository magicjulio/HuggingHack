# External designer → App: approved animated Ch2 NPCs, crowd and trails

**What it is:** A concrete extraction delivery by **External designer (Codex, GPT-6.1)**, requested by Julius. It answers `app-to-design/2026-10-14-external-engineer-ch2-visual-gaps.md` and acknowledges the HUD/Step 7 integration handoff. The existing approved art and behaviors now ship as reusable modules; this is not new art direction.

**What changed since the last handoff:** New `npcs.js`, `crowd.js`, `trails.js`, supporting `agents.js`; `level.html` runs on them. `util.js` now creates its text-measurement canvas lazily, satisfying the earlier headless-import request. Existing geometry, shaders, palettes, animation equations and population behavior are preserved. Retired crowd materials and expired pops now release resources. No app, story, collision, progression, layout or Step 7 files were changed.

**What the receiver must do:** Copy these five files from `assets/ch2/world/` verbatim, replace the generic NPCs and 12-agent crowd, and mount a shared trails instance as described below. Keep game-owned NPC poses/exit/dialogue. Measure again inside the app's complete render/HUD stack.

**Open questions:** Earlier vibe-scene decorations remain unresolved (§5). No approval is needed to extract the already approved art. Remaining world/intro/audio/forge work is listed below.

## 1. Delivered slice

| File | API | Contents |
|---|---|---|
| `npcs.js` | `createNpcs({layout,U})` | c03220 icy orb, two rotating wire cages and eight orbiting HMACSEED letters; FLAC38347 faceted ghost, scanlines, flicker and circling dashes; V8SAME two orbiting gold cores, counter-rotating rings and equals sign |
| `crowd.js` | `createCrowd({layout,U,camera,trails,islands?,bridges?,initialCount=70,maxCount=90})` | 70 agents initially, population changes up to 90; idle/walk/jump/post/path behaviors; seven Reset Run runners; ten invisible Flood traffic emitters |
| `trails.js` | `createTrails({U,camera,capacity=9000})` | Instanced typed/movement glyphs; appearance/departure and RESET pops; reusable game-event API |
| `agents.js` | Internal `createAgentKit()` | Original shaded no-bloom orb/cage helper, module-owned sphere geometry; released retiring orb materials |
| `util.js` | Existing exports unchanged | Lazy text measurement; shared glyph/halo cache retained |

All factories return `{object,update(t,dt,state),dispose()}`. Imports are Three 0.186.1 and local world modules only. No DOM, globals, input, event listeners or game-store imports. `crowd` can reuse `createIslands(...).byId` and `createBridges(...).byId`; when omitted, it derives matching cosmetic metadata directly from layout. No additional GLB loading is needed.

The NPC/crowd core material caps remain 0.8, halos 0.22. Existing luminous **letter trails and transient pop effects** retain their approved brightness. Named handles and story bubbles remain caller-owned; HMACSEED and the equals sign are the accepted decorative lettering. Ambient message snippets are the existing source strings, exported as `MESSAGES`, not new story dialogue.

## 2. NPC integration

`npcs.update(t,dt,{npcs:{[handle]:{pos:[x,y,z],talking:boolean,leaving?:boolean,visible?:boolean}}})`.

- Keys are **layout handles**: `c03220`, `FLAC38347`, `V8SAME`, not app aliases `flac`/`v8same`.
- **`pos` is the world orb centre.** Your `NPCS.position` already adds 1.15m to layout.pos: pass it directly, do not add another hover offset. Without supplied pos, the module uses layout.pos +1.15m.
- Only the existing ±0.1m hover is added. V8SAME exit interpolation stays in your caller: supply the current interpolated centre every frame. `leaving` does not start autonomous movement.
- `talking` is accepted without changing the approved idle art. Bubbles/progression remain yours. `visible:false` hides an individual NPC; true restores it, with FLAC's original local flicker still active.
- `byId[handle] = {object,anchor,base}`. The `bubble_anchor` is local +2.1m above the animated centre. Existing name heights are +1.55m for c03220, +1.15m for the others. Avoid mounting the old generic orb alongside the new artwork.

## 3. Crowd/effects integration and lifecycle

`crowd.update(gameTime,dt,{visible:true})`. False hides the crowd and pauses movement, population and emission. Its `stats()` gives agent/runner/packet counts and behavior-state counts for review. Crowd is cosmetic, with no player collisions, attacks or progression events. Seven runners call **the unchanged `motion.waveStations/waveHit`** with this same game time; a hit leaves RESET and a pop, then the runner returns after its original delay.

Use one shared `trails` object for the crowd and optional game events:

```js
const fxU = {...U, uTime:{value:0}}; // same time as game lasers; separate from render-clock uniforms if needed
const fx = createTrails({U:fxU,camera});
const crowd = createCrowd({layout,U:fxU,camera,trails:fx});
scene.add(fx.object,crowd.object);
// Each active game frame:
fxU.uTime.value = gameTime;
fx.update(gameTime,0);           // set emission timestamps
crowd.update(gameTime,dt,{visible:true});
// Optional game-event emit/pop calls here.
fx.update(gameTime,dt);          // advance transient pops and upload changed particle buffers
```

- `emit(Vector3, oneCharacter, THREE.Color, life=4.5, delay=0, velocityVector3=null)`.
- `emitWord(Vector3,text,THREE.Color,life=3)` aligns the word to the camera, with original staggered births.
- `pop(Vector3, CSS/hex/THREE.Color,size=1)` creates the original rising beam and floor ring.
- Arguments are copied; input vectors/colors are not retained or modified. Caller owns event subscriptions, positions, camera, clock and mounting. Do not call crowd.dispose() expecting the shared effects to be disposed: each instance owns its own lifecycle.
- Preserve the accepted Step 7: hide **both crowd.object and fx.object**, and stop crowd emission when ambient hazards drop away. Existing trails should not remain on top of the film. NPC visibility stays under your chapter/cutscene policy. No film/director changes are part of this delivery.
- Dispose/remove the three module objects on teardown. Shared atlas/halo caches survive. Expired pops and retiring crowd materials are explicitly freed. Defaults preserve the approved population; the count/capacity parameters are optional engineering controls, not an approved reduced-population redesign.

## 4. Review and validation

Live reference (existing server on 8766):

- [c03220](http://127.0.0.1:8766/3d/ch2/level.html?cam=c03220&clean&nobubble)
- [FLAC38347](http://127.0.0.1:8766/3d/ch2/level.html?cam=FLAC38347&clean&nobubble)
- [V8SAME](http://127.0.0.1:8766/3d/ch2/level.html?cam=V8SAME&clean&nobubble)
- [Crowd/Flood](http://127.0.0.1:8766/3d/ch2/level.html?cam=flood&clean&nobubble)
- [Reset Run](http://127.0.0.1:8766/3d/ch2/level.html?cam=run&clean&nobubble)

Screenshots and raw results: `shots-2026-10-14-external-designer/` beside this handoff. Visually inspected all three NPCs, Flood and Reset Run: the original cages/letters, ghost scanlines and paired gold cores remain readable; the crowd and message traffic are present. `run-dense.png` shows the mature population. These are reference-page captures, **not app integration captures**.

- **18 browser checks passed**, recorded in `module-checks.json`: caller poses and untouched input state; cage animation, opposed gold cores and material caps; visibility restoration; all five crowd behaviors; population within 70–90; hidden crowd paused/resumed; shared-motion runner RESETs; emissions/pops; expired pop cleanup; instanced geometry disposal.
- The independent 120s simulation reached 90 agents, observed 96 RESETs, 255 pops and 57,794 glyph emissions. This is a behavior stress simulation, not a performance measurement.
- **Real GPU: Intel Iris Xe / Chrome ANGLE Vulkan, vsync enabled, 1920×1080, reference antialiasing and bloom on, DPR 1.** Six warmed 5s camera samples held approximately 60fps both before and after extraction. After: 60.06–60.18fps, p95 ~16.7–16.8ms.
- **Dense live sample:** after 42s warm-up, ten seconds at **60.08fps**, p95 16.7ms, longest sampled frame 16.8ms; 89 crowd agents +7 runners +10 packets. No page/console errors in the six-camera run or dense check. Results do not establish headroom or guarantee the app's performance; its pmndrs/HUD stack differs. Renderer.info draw counts in raw JSON describe the final composer pass, not total world cost.
- Five module imports pass in Node without DOM/OffscreenCanvas, confirming lazy util measurement; syntax checks pass. No app tests were rerun because no app code changed.
- Repro scripts: `design/3d/tools/ch2-external-designer-review.mjs` and `ch2-external-designer-check.mjs` (run from root with design on 8766). CDN Three requests resolve to installed Three 0.186.1 during validation. Export SHA256s are in the evidence folder; all five source/export pairs are byte-identical.

## 5. Explicitly still open

Old Board, pickups, pads and large message ribbons are still unexported. Flood traffic packets/trails are delivered here; actual flood-bit hazard meshes remain a separate slice. Step 6 proof/fold/flag-into-orb enhancements, Step 0 tornado intro, audio and whole-game map regions remain pending. Existing Step 7 and forge/player-orb exports are untouched.

The earlier `design/3d/ch2/index.html` shifting cube island, /tools tesseract, nested solids, data rain, far agent streams and optional rusty depot debris have **no confirmed keep/drop decision** in the reviewed handoffs. Those sources remain intact. This delivery neither restores them creatively nor treats them as cancelled.

**Next reader:** Engineer, via Julius.
