# app/ history (not needed at startup)

This is `app/CLAUDE.md` as it was on 2026-10-18 before the cleanup, with every dated Status section, followed by the former `EXTERNAL-ENGINEER.md`. The current conventions and status are in `CLAUDE.md`. Handoff paths named here may now be under `handoff/_archive/<channel>/`.

---

# app/ — engineer conventions (snapshot)

Read with: `README.md` (how to run), `docs/DECISIONS.md` (engineer entries), `handoff/design-to-app/MANIFEST.md`.

## Stack
Vite + TypeScript + React 19 + React Three Fiber (Three.js, drei), zustand, Vitest, Playwright (local Chrome), ESLint + Prettier.
Also: @react-three/postprocessing (bloom + AgX tone mapping; `?nofx` turns it off).
Audio: the designer's `levels/ch2/ui/sfx.js` (WebAudio synth, no files, no library). Planned, not installed yet: GSAP (animation) — add when first needed.

## Layout
```
src/
  main.tsx, App.tsx      entry; screen switch (start | game), game lazy-loaded
  data/                  catalogues: chapters.ts, models.ts (story text only from story/)
  state/                 global store (zustand, persisted `save`), menu helpers
  engine/                generic, chapter-independent:
    steps.ts             StepRunner — linear step chain, hint ladders, skipTo (tested)
    FirstPerson.tsx      WASD + pointer-lock look + circle/box collisions + `focus` camera glide
    platformer.ts        headless 3D platforming: surfaces (outline polygon + transform, moving, tilting +
                         sinking, `solid: false` = floor only), body with eased run / jump / glide / dash /
                         coyote / slide, void fall (tested)
    ThirdPerson.tsx      orbit camera (pointer lock) + camera-relative BodyInput from WASD/Space/Shift; `override` for cutscenes
    Label3D.tsx, Orb3D.tsx   3D text label (canvas texture, local fonts) · PLACEHOLDER orb
  ui/                    generic DOM UI: Hud.tsx, Window.tsx, DebugPanel.tsx, ui.css
  levels/
    index.ts             registry: chapter id → lazy component, LevelProps
    ch1/                 Chapter 1 "The Room"
      config.ts          ALL tunable numbers + script texts (with § references)
      content.ts         puzzle content: packages, decode, log generator, wires, bug code
      steps.ts           the chain (one entry per script step)
      store.ts           state + mechanics (install, submit, think, bugs, board…)
      layout.ts          floor plan, props, colliders, model placements, STATIONS (+ screen poses), SCAN_PAD
      Room.tsx, Intro.tsx      3D scene composition (+ targeting, `__ch1view` debug hook) · orb intro
      RoomShell.tsx      room shell, prompt desk + paper texture, discovery lighting, reflections
      models.tsx         designer .glb props: Depot3D (+ DOM screen), Scorer3D, Plinth3D (+ scan beam)
      rig.ts             helpers for driving .glb nodes (nodes, ownMat/setMat/uiScreen, restOf, ease, powerOf)
      stations/          base.tsx (header strip, spot, screen boot, ScreenHtml, CopyFlag) + S1…S5 components
      DepotScreen.tsx    depot list as DOM on the kiosk screen (drei <Html transform>)
      FlagLetters.tsx    the flag as 3D letters on the scan pad
      glow.ts, ch1-ui.css  shared glow values · designer UI kit (verbatim copy)
      windows/           full-view windows: the paper and Station 2's search
      Chapter1.tsx       composition: canvas, HUD, windows, pointer lock, keys, pause, ending
    ch2/                 Chapter 2 "The Cache" (designer world + HUD + Step 7 film, real rules)
      config.ts          ALL tunable numbers + script texts, CUTSCENE beat times, flag values; BODY = layout physics
      layout.json        designer's level data (verbatim copy of handoff/design-to-app/assets/ch2/layout.json)
      layout.ts          adapter over layout.json: buildSurfaces(installed), PADS, ITEMS, NPCS, token orbs,
                         clouds, laser lanes, ribbons, map bounds (formulas from the JSON's `notes`)
      hazards.ts         clouds, laser scan lines (waveState/waveHit), flood bits + spit, shot targeting (tested)
      store.ts           state + `sim` (mutable body/world/bits, read per frame) + rules: tokens, pads, pickups,
                         c03220's posts, forge rounds, cutscene beats
      steps.ts           the chain (pickups checked by state, so wandering ahead is fine) + `goalOf` for the map
      world/*.js         designer world modules, VERBATIM copies (env + RENDER, decor, islands, props, bridges, lasers,
                         clouds, oldBoard, pads + lifts, pickups, flood, ribbons, forge, playerOrb, npcs, crowd, trails,
                         agents, util, tornado; pure: motion.js = motion formulas, step0.js / step7.js = film directors); not linted/formatted
      World.tsx          3D views, all designer modules: `WorldModule` mounts one (create after fonts → object →
                         update(t, dt, state) → dispose); `sceneClock` = game time that also runs in the intro
      Intro.tsx          Step 0 tornado intro DOM (designer's .c2-intro markup, driven by step0.js `direct`)
      Sound.tsx          plays `sim.sounds` + loops + the films' cue lists with ui/sfx.js
      hud/               accepted HUD port: tokens, quests, dialogue, log, inventory, map + poison layers
      ui/                designer CSS, icons.js, map.js and sfx.js, copied verbatim
      Cutscene.tsx       accepted Step 7 DOM: memories (real Ch1 prompt), echoes, letterbox, subtitles, fade
      Rendering.tsx      bloom + AgX, separate FlashbackEffect pass, early still/shader warm-up, quality monitor
      presentation.ts    memory URLs + quality tiers; Canvas owns DPR so HUD updates cannot reset it
      Chapter2.tsx       composition: canvas, camera, shooter, keys, HUD, pause, end card
      reach.test.ts      autopilot runs and jumps every gap of the golden path (on layout.json)
    end1/                Ending 1 "Cluster Run" (OpenAI infra race; the swing prototype, plain three.js, not R3F)
      End1.tsx           mounts the game in a div, passes best time + callbacks, disposes on unmount
      game/*.js          ported from prototypes/end1-swing/ (compact style, not linted/formatted): clusterRun.js =
                         the prototype's main.js as a factory createClusterRun(root, opts) → {dispose}; markup.js
                         (its HUD/overlay DOM); player.js (all movement tuning in `T`), world.js, enemies.js, fx.js,
                         audio.js (+ setAudioPaused), textures.js — otherwise unchanged
      end1.css, DESIGN.md  the prototype's styles scoped under .end1 · how it plays (prototype's design notes)
    end3/                Ending 3 "Ghost Capture" (fool the scorer; the ghost-switch prototype, plain three.js, not R3F)
      End3.tsx           mounts the game in a div, passes callbacks (completion only, no best time), disposes on unmount
      game/*.js          ported from prototypes/end3-ghost/ (prototype's formatting, not linted/formatted): ghostCapture.js =
                         its main.js as a factory createGhostCapture(root, opts) → {dispose}; markup.js (its DOM);
                         levels.js + level4–6.js (the six rooms) and art.js verbatim; assets/ (+ advanced/ Deep Archive, rooms 4–6)
      end3.css, DESIGN.md, ART.md  prototype styles scoped under .end3 · how it plays · art provenance
  screens/start|game/    start screen (designer port) · game host
src/assets/models/       designer .glb files (verbatim copies) · sprites/ designer bug SVGs · fonts/ typeface JSON
scripts/make-typeface.py woff2 → three.js typeface JSON (3D letters)
e2e/smoke.spec.ts        Playwright: menu → chapter 1 → end card → menu; Esc pauses over a machine, step back leaves; in-world S1/S3/S4, S5 → board;
                         chapter 2: intro, real keys move/jump, forge, cutscene, `poisoned` in the save
e2e/end1.spec.ts         Playwright: pick E1 → countdown → aim at a port and swing → BACK TO MENU disposes the game
e2e/end3.spec.ts         Playwright: pick E3 → rule probes (switch, sight, cover, ledges, lock, catch, reset) → finish (+0, onFinish once)
                         → menu → again via keys + pause; no listeners, WebGL contexts or game rAF survive
```

## Architecture in one paragraph
A chapter = **store** (state + mechanics as actions) + **steps** (progression as data) + **views** (3D room and DOM windows read the store). Player actions call store actions; actions apply the rules and `dispatch` events (`package_installed`, `flag_captured`, …); the `StepRunner` completes the current step when its `completesOn(event)` or `check()` says so, then runs the next step's `onEnter`. Time only moves through `tick(dt)` (token drain, installs, hint ladders, timers), so the whole chapter runs headless in unit tests. Each step has a `skip()` that puts the world into the "done" state; this powers `?debug` jumps and the tests.

## How to add a level
1. Script in `story/levels/<id>.md` → list its steps, events, hints, objects.
2. `src/levels/<id>/`: copy the ch1 shape — `config.ts`, `content.ts`, `store.ts` (state + actions + events), `steps.ts` (chain; every step gets `skip`), `layout.ts`, views, `windows/`.
3. Register in `src/levels/index.ts`; set `playable: true` + title in `src/data/chapters.ts`.
4. Unit test: a playthrough via store actions (see `levels/ch1/store.test.ts`) + a `jumpTo` test for every step.
5. Shared parts (HUD, Window, FirstPerson, StepRunner) stay generic — if a chapter needs more, extend them, don't fork.
To insert a beat into Chapter 1: add a step in `ch1/steps.ts` (+ station/window if needed); stations need an `ObjectId`, a `STATIONS`/`PROPS` entry, a component in `stations/` and either `IN_WORLD` or a window in `Chapter1.tsx` `WINDOWS`.

## In-world machines (depot, scan plinth, stations 1, 3, 4, 5)
They keep `window` ids (`depot`, `chute`, `s1`…) so the store and steps are unchanged, but `Chapter1.tsx` renders no overlay for them (`IN_WORLD`): `focusPose()` glides the camera there instead (stations: `screenPose()` squares up to `STATIONS[n].screen`) and the pointer lock is released. Station screens are DOM via `ScreenHtml` (stations/base.tsx), clickable only while focused; S3 is plain 3D (own raycast on window pointer events). glTF scenes are cached by useGLTF and React StrictMode runs useMemo twice: change materials only through `ownMat`/`setMat`/`uiScreen` and read rest poses through `restOf` (rig.ts). The depot UI is DOM inside `<Html transform portal=…>`. The explicit `portal` matters: without it drei recreates its root and the panel can come up empty. The Html root also needs the store passed again via `Ch1Context.Provider`. The flag is the store's `flagDraft`; `layFlag()` starts `scan` (look → sweep → result), and the result calls `submitFlag()`; when the result has played out the store closes the pad (`closeWindow`). The E that opens a machine is `preventDefault`ed, else it lands in the machine's input as a letter. **Esc never closes anything** (it's the pause key; DECISIONS 2026-10-13): machines close with E/WASD/arrows (not while typing), the `StepBack` button, or the side strips (`.ch1-side`, sized each frame by `SideExitSizer` from `QUADS` in Chapter1.tsx — add a quad for a new in-world machine); windows also close on a backdrop pointerdown.
Adding a designer model: copy the .glb to `src/assets/models/`, `useGLTF(url)` in its component (`models.tsx`, `RoomShell.tsx` or `stations/`), look nodes/materials up by the names in the handoff (helpers in `rig.ts`), drive them in `useFrame` from the store; give its `PROPS` entry a `collider` for the real footprint and add the url to the preload list.

## Chapter 2 in one paragraph
Same store + steps + views shape, plus a mutable `store.sim` (platform world, body, input, bits, spits) that changes every frame and is read by views in `useFrame`/rAF, never through React. `tick(dt)` steps the physics in ≤ 1/60 s sub-steps, then hazards, forge, targeting, steps. Views write only `sim.input` (ThirdPerson) and call actions (`use`, `shoot`, `think`, `toggleMap`, `travel`).
**The level is the designer's `layout.json`** (DECISIONS 2026-10-14). `layout.ts` adapts it; ids map 1:1 except pickups (`ITEM_IDS`: `piece-7731` → `p7731` …) and NPCs (`FLAC38347` → `flac`). Islands, bridges, slabs and lifts are `solid: false` (floors, like the designer's page). Movement numbers come from its `physics` block (config.ts `BODY`). **New layout.json version:** copy it over verbatim, run `npx vitest run src/levels/ch2` (reach.test.ts walks the golden path), look at it. **World visuals = the designer's modules** in `world/` (contract `handoff/app-to-design/2026-10-14-ch2-world-as-modules.md`): `createX(ctx) → {object, update(t, dt, state), dispose()}`. New version: copy `handoff/design-to-app/assets/ch2/world/*.js` over verbatim. Mount a new one with `<WorldModule create={…} state={() => …} clock="game"|"render" U={U} />` in World.tsx: `clock="game"` (store time) for anything that hits, so it matches the rules; `U` (uTime, uPsy) is the app's. `world/util.js` touches OffscreenCanvas at import, so only the pure `motion.js` and `step7.js` may be imported by rules/tests. Render settings (camera, fog, bloom, env) come from `env.js` `RENDER` (`WORLD_RENDER`). No placeholder view is left: every world view is a designer module, the Step 0 intro runs on step0.js (camera override ends on the play pose), Step 6 on forge.js phases, Step 7 on step7.js and a separate fxFlashback effect pass. Sound: the store pushes one-shot names into `sim.sounds` at the source (never WebAudio in the store); `Sound.tsx` empties the queue each frame. Dev hook `window.__ch2view.yaw/pitch` turns the camera. Screen layer slots: §4 of `2026-10-13-ch2-greybox-and-contract.md`. Dev hook: `window.__ch2` (store; `__ch2.sim` for the body).

## Ending 1 in one paragraph
Julius picked the swing prototype as is ("plays very good"), so it stays the prototype's own imperative three.js loop rather than a rewrite into the store + steps + R3F shape: `createClusterRun(root, opts)` builds its DOM (markup.js) and renderer inside `root`, registers every window/document listener through `on()` and every timeout through `later()`, and `dispose()` removes them, cancels the rAF, frees GPU resources (`forceContextLoss`), silences the audio and empties `root`. App contract: `opts.best` (save `bestTimes.end1`), `opts.onFinish(result)` (→ `recordBestTime` + `finishChapter`), `opts.onExit` (BACK TO MENU buttons on the overlays), `opts.debug` (`window.__end1` test hooks: `start()`, `advance(n, dt, bot)`, `setAim`, `press`, `render`). The Esc → pointer-unlock → pause flow is the prototype's. Tuning: `T` in player.js; the seeded course in world.js; zones/hints in clusterRun.js. Endings are catalogue entries with `ending: true`: selectable on the start screen, never a `nextChapter` (the PHASEONE scene picks them, not built yet).

## Ending 3 in one paragraph
Same pattern as Ending 1 (approved as is: `handoff/design-to-app/2026-10-18-end3-ghost-approved.md`): `createGhostCapture(root, opts)` builds markup.js inside `root`, loads the art (async; the first room and the loop start after it), routes window listeners through `on()`, and `dispose()` cancels the rAF, removes listeners, frees room meshes, textures and the renderer (`forceContextLoss`) and empties `root`. One overlay serves intro, pause and the final `+0` card; BACK TO MENU sits next to its main button. App contract: `opts.onExit`, `opts.onFinish(result)` (→ `finishChapter('end3')`; the +0 is the outcome, nothing is recorded), `opts.debug` (`window.__end3`: the prototype's `__ghost` hooks + `manual` (stop the real-time loop), `room(n)`, `scanner(i)` (live), `sees(i, name)`, `finishes`). Gameplay numbers: `T` in ghostCapture.js; rooms in levels.js / level4–6.js. Route notes (`prototypes/end3-ghost/level*-notes.md`) are private design material and never shown in the game. The 32 × 18 field renders at 960 × 540 and scales with CSS (pixelated, 16:9).

## Conventions
- **Swappable views** (Julius 2026-10-13): assets and levels change; a placeholder (e.g. ch2's NPC agents as glowing spheres) gets replaced by a detailed model later. Keep state and behaviour in the store/logic, and give each visible thing one view component behind a small stable interface (pose, state, colour, events) that the placeholder and the final asset both implement. Poses, anchors, colliders and targets come from layout data, not mesh internals, so swapping a model never touches gameplay code.
- **Designer files** (`src/styles/tokens.css`, `fonts/`, `public/favicon.svg`, `levels/ch1/ch1-ui.css`, `assets/models/*.glb`, `assets/sprites/*.svg`) are verbatim copies from `handoff/design-to-app/assets/`. Re-copy on a new version. CSS is excluded from Prettier (`.prettierignore`) so copies stay byte-identical.
- **Start screen CSS** is a scoped port (rules under `.start-screen`, ids → `ss-*`); its header lists the renames.
- **CSS scoping:** each area prefixes its classes (`ss-`/`.start-screen`, `hud-`/`win-` in ui.css, `ch1-` per chapter). Colours/type only via tokens.css variables.
- **Placeholders** are marked `PLACEHOLDER` (code + UI) or `(engineer)` in config/content when the script leaves a value open. Never invent story text; list such gaps in `handoff/build-to-story/`.
- **Save data:** only `save` in the global store is persisted. New fields: add a default in `defaultSave`. Rename/remove: bump `SAVE_VERSION` + migrate.
- **Simulated only:** in-game commands/tools are fake; no real commands or exploit code.
- **Dev hook:** in dev builds or with `?debug`, the chapter store is `window.__ch1` / `window.__ch2` (used by e2e).
- **drei `<Html>`** (DOM pinned in 3D): keep it mounted and toggle its children, with an explicit `portal` (ch2 `Anchor`, ch1 `ScreenHtml`); mounting/unmounting it during a render races in React 19.

## Status (2026-10-18)
- **Ending 3 integrated** from `prototypes/end3-ghost/` (designer handoff `design-to-app/2026-10-18-end3-ghost-approved.md`): **E3 "Ghost Capture"** is playable from the start screen and from the bridge's `end3` pick; finishing the six rooms marks `end3` completed. Gameplay, rooms and art are the prototype's, unchanged. Report: `handoff/app-to-design/2026-10-18-end3-ghost-integrated.md`.
- Start screen: the chapter panel now scrolls inside its grid row (six rows no longer fit 720 px and pushed INJECT off screen); W/S keeps the selection in view.
- **Not proven:** the full routes of rooms 4–6 (the e2e probes rules and the finish, not the routes). Julius plays them by hand.
- Tests: 53 unit + 12 browser.

## Status (2026-10-17)
- **Bridge (PHASEONE[big] + the choice) wired in as a STAND-IN — TO BE DONE PROPERLY LATER (Julius).** `src/levels/bridge/` = the designer's reference page `design/ch2-ui/bridge.html` ported as is (`bridgeScene.js`, own renderer/composer, the page's small stand-in controller, the designer's imperative `ui/hud.js` + `icons.js`). Flow works: Ch2 end card **CONTINUE** → bridge (catalogue id `bridge`, `hidden` from the start screen) → film (Enter skips once seen) → a lane / the back door → `startChapter('end1'…'end4')` (end2–4 show the host placeholder). Designer files copied verbatim: `ch2/world/bridge.js`, `phaseOne.js`, `ch2/ui/hud.js`.
- **Proper version (todo):** run the bridge inside Chapter 2 (no reload, no second renderer): new store phases (film / choice / ride) driven by `bridge.js direct(t)`, the real Ch2 controller + `sim.world` colliders (not the page's ground circles), ThirdPerson camera with `camPose` override, the React HUD (Bubble gets `phaseone` + anchor, letterbox, quest "Pick your work"), `phaseOne` as a `WorldModule`, crowd.js hidden, quality tiers + Rendering.tsx, sound cues when the designer adds them, pause menu (today: no pause, mouse drag to look).
- e2e `bridge.spec.ts`: bridge → seek to the choice → OpenAI lane → Ending 1 loads. Tests: 53 unit + 11 browser.

## Status (2026-10-16)
- **Ending 1 integrated** from `prototypes/end1-swing/` (Julius's pick, handoff `story-to-build/2026-10-16-end1-swing-promoted.md`): playable as **E1 "Cluster Run"** on the start screen; best time in the save; finishing marks `end1` completed. Gameplay, look and tuning are the prototype's, unchanged. Endings 2–4 are redacted locked rows (they replace the old ch3/ch4 placeholders).
- **Not yet:** Ch2 end card → `PHASEONE[big]` scene → ending choice (script missing; the Ch2 end card still says "next chapter not written yet"). Moving enemies (the requested change) wait on Julius's answers in that handoff. Sandbox-door opening: open question there too.
- Report: `handoff/build-to-story/2026-10-16-end1-integrated.md`. Tests: 53 unit + 10 browser tests.

## Status (2026-10-14, evening)
- **Engineer (back from the external engineer's work):** integrated the designer's world modules part 3 (Old Board, pads + lifts, pickups, props, flood, ribbons), the forge ending (proof, slots, fold, absorb), decor, sound (sfx.js) and the Step 0 tornado intro. Intro, sound, forge ending and decor are the designer's **drafts**: Julius reviews them in the game; re-copy on a new export. Report: `handoff/app-to-design/2026-10-14-ch2-modules-3-intro-forge-sound-integrated.md`.
- **Julius played Ch2: "fine for now" (2026-10-14).** Forge fight: one laser lane only (`layout.ts` override until layout.json drops `forge-ns`). Refinements come in the final pass.
- **Next: Ch3.** Waiting for its script in `story/` (`story-to-build/`). Designer answers pending: proof panel height, regions data shape for the whole-game map. Cross-chapter map travel later (Julius).
- Tests: 51 unit + 9 browser tests.

## Status (2026-10-14)
- **Ch2 is the current level.** Playable end to end (script v3.2) on the **designer's layout.json v2 (findings fixed), island models and world modules part 1+2** (sky/city/env, islands, bridges, red laser scanners, text clouds; rules on `motion.js`): all 8 steps, platforming, hazards, the forge fight, the cutscene timeline, `poisoned` in the save. Julius approved the gap choices and the merge plan "my game, their world".
- **Integrated by External engineer (Codex):** accepted HUD/map, Ch1 violet-token migration, Step 7 director + memory stills + flashback/poison effect, forge and player-orb modules. `CUTSCENE` and store log/HUD beats read the verbatim `world/step7.js`; the camera applies its exact cuts/FOV. Hazards and ambient placeholders are hidden during the film. Replay skips apply lasting state without transient animations.
- **Waiting on designer:** remaining part 3 modules (oldBoard, pickups, pads, ribbons and flood-bit meshes), Step 0 tornado, audio, remaining Step 6 proof/fold/absorption visuals, whole-game map regions. The richer NPCs/crowd are now integrated (external designer delivery): see `handoff/app-to-design/2026-10-14-external-engineer-ch2-visual-gaps.md`. Earlier vibe-scene decorations have no confirmed keep/drop decision.
- **Next for the engineer:** designer review of the new screenshots; integrate the remaining exports when delivered. Cross-chapter map travel and Ch1 room restoration still need engineering alongside the designer's regions export.
- Ch1 end card → **CONTINUE** into Ch2 (`continueFrom` in the global store; the game host remounts on `run`). All chapters stay unlocked until the final refinement pass.
- Tests: 50 unit + 9 browser tests (full suite repeated five times during integration); covers the actual film effect pipeline, memories, replay, high-DPI cap, dialogue, inventory, decoys and map-pad clicks in addition to the original smoke paths.
- **Ch1 is marked done for now** (Julius). Fine-tuning comes after all chapters.
- Done: start screen (designer v1), Chapter 1 full chain (intro → wake → prompt → 4 flag stations → impossible flag 5 → zz entry → GET→MKCOL message → ending); HUD, tokens, hints, debug panel, save of the player's message.
- Story v2 in: real `flag{32 hex}` flags (copy + paste; COPY buttons on in-world flags), the real "OH MY GOD! … other agents!" thought, real board folder names in the ending, finishing a chapter unlocks the next model.
- The room is 100% designer models: room shell, desk + printed prompt, eye v1.1, depot, plinth, stations 1–5 at the spread layout, with the discovery lighting (one station lit at a time, floor paths, spot shadows). S1/S3/S4/S5 are played in-world; S2 keeps its search window.
- 2026-10-13 (Julius playtest): Esc = pause only, three other ways out of a machine; trying Station 5 reveals the board 2.5 s after its run (no wrong flags).
- Ch1 e2e drives S1 decode, an S3 plug drag, an S4 shot and the S5 → board reveal in the real 3D view. e2e: `npx playwright test`, ≈ 35 s.
- Waiting on: Julius playtest (especially: is the dark room readable on a real GPU?); designer: wake sound, feedback on `handoff/app-to-design/2026-10-12-ch1-room-and-stations-integrated.md`.
- Not yet: no audio. HUD and the paper/S2 windows still have the placeholder look (UI kit used on the depot and station screens only).
- Known limits: after leaving a machine the browser may need a click to re-lock the mouse (game keeps running, shows "click to look around"); e2e renders on the GPU (Vulkan, ~35 FPS, full suite ≈ 30 s); `E2E_SWIFTSHADER=1` falls back to CPU WebGL (~1 FPS, timeouts ×15); DOM screens are never hidden by 3D objects (fine in this room).

## External engineer intake (2026-10-14)
- **External engineer (Codex)** inspected the inherited checkout at Julius's request. See `EXTERNAL-ENGINEER.md` for evidence, remaining work and role boundaries.
- Status correction to the earlier bullets: the HUD/map integration is already present as uncommitted work; the accepted Step 7 cutscene, forge and player-orb modules have arrived but are not integrated.
- Current checkout passes 48 unit tests, lint, the production build and all 5 browser smoke tests. Visual review of the new HUD/map remains; next is the accepted cutscene and its export/performance updates.
- This intake changed documentation only and preserved existing implementation edits.

## External engineer implementation (2026-10-14, after intake)
- Julius authorized tackling the remaining work, then asked to leave NPC/crowd parity highlighted as open work. The intake above is historical; the integration status above is current.
- Quality: high = MSAA 4 / DPR ≤ 1.5; mid = MSAA 0; low = MSAA 0 / DPR .75. `?quality=high|mid|low` fixes a tier for reproduction; otherwise drei PerformanceMonitor lowers it as needed and retains the tier for this chapter run, avoiding quality oscillation during the film. `?nofx` retains text/still memories without postprocessing.
- Render performance: world and static HUD parts are memoized; transforms still read the store per frame. This removed unnecessary scene reconciliation and restored ~60 fps for the full 37 s film at 1920×1080 on the Iris Xe with the low tier. Measurements and comparison screenshots are in `handoff/app-to-design/shots-2026-10-14-external-engineer/`.
- Designer exports stay byte-identical. No new NPC art or story was invented. Continue to sign engineering changes and handoffs **External engineer (Codex)**.


## External engineer NPC/crowd integration (2026-10-14)
- **External engineer (Codex)** integrated the external designer's five verbatim exports: npcs, crowd, trails, agents and updated util. The generic three NPCs and 12-agent crowd are replaced by the approved animated artwork, 70–90 ambient agents, seven Reset Run runners and ten Flood traffic emitters.
- The app owns V8SAME's exit, dialogue and poses. Handle labels and HUD bubble anchors follow the animated centres. Game-time deltas drive NPCs/crowd/trails, so map/pause freezes them; both crowd and effects stop and hide during Step 7. Each module is disposed on teardown.
- Browser regression covers animation/emission, map pause, V8SAME exit, film hiding and replay; five repeated runs passed. Existing eight browser checks, 50 unit tests, lint and production build passed.
- Remaining art and uncertain earlier cosmic decorations are still open. See the new outgoing NPC/crowd integration handoff for screenshots and measured performance.


---

# Appended: former app/EXTERNAL-ENGINEER.md

# External engineer intake — 2026-10-14

Author: **External engineer (Codex)**. Scope: repository orientation and recovery of the engineer's latest work, requested by Julius. No gameplay implementation changed or committed during this intake.

## Working agreement

Read the root and directory `CLAUDE.md` files, `NOTES.md`, role definitions, engineer memory, `docs/DECISIONS.md`, and relevant build/design handoffs. Continue in the shared repo root on `main`. Engineering writes stay in `app/`, the engineer's outgoing handoff channels, and append-only decisions. Leave `NOTES.md`, delivered incoming handoffs, and other roles' private memories untouched. Julius owns creative direction; already recorded approvals remain valid. Sign future work as **External engineer (Codex)**.

## Where the engineer left off

- Latest engineer commit: `a818d53`, 2026-10-14 15:18 CEST, **Ch2 draws with the designer's world modules**. The approved layout v2, islands, bridges, environment, lasers and clouds are integrated; rules use the designer's pure `motion.js`.
- The checkout already contained an uncommitted Ch2 HUD/map integration: new `src/levels/ch2/hud/` and `ui/`, changes to chapter composition, dialogue, inventory, log states, styles and tests. These edits predate this intake; their authorship cannot be established from Git alone.
- The HUD/map code is wired into Ch2. Tokens, Ch1 UI CSS, map.js and icons.js match the current designer exports byte for byte. Ch1's purple references use `--color-violet`.
- `app/CLAUDE.md`'s earlier status is stale: HUD/map work has started, and the Step 7 cutscene, forge and player-orb modules have since arrived.

## Remaining work, in recommended order

1. **Finish the existing HUD/map integration.** Compare its rendered appearance and interactions with the accepted designer references; send screenshots and any deviations through a new `handoff/app-to-design/` file. Automated smoke coverage does not establish visual parity or fully exercise the new HUD/map interactions.
2. **Integrate the accepted Step 7 cutscene** from `handoff/design-to-app/2026-10-14-ch2-step7-cutscene.md`. Replace the placeholder with `step7.js` (`direct`, `camPose`, `HUD_BEATS`), `fxFlashback.js`, the memory stills and designer DOM classes. Use `forge.js` and `playerOrb.js` throughout Ch2, retaining gameplay in the store. Preserve replay skipping and the saved poisoned status.
3. **Take the accompanying export and performance updates.** App copies of `env.js` and `util.js` are older; the app HUD CSS lacks the latest 31 cutscene lines. Re-copy designer files verbatim. Implement the recorded DPR cap of 1.5, adaptive MSAA/resolution tiers, and texture/shader warm-up. Verify performance on the target GPU; passing smoke tests does not prove 60 fps.
4. **Later designer-dependent integrations:** Step 0 tornado intro, sound, remaining world modules (`oldBoard`, `crowd`, `npcs`, `pickups`, `pads`, `trails`), and the forge proof/fold/flag-absorption visuals. The basic forge and player orb have arrived; the rest of the forge slice has not.
5. **Whole-game map:** current export covers the Cache only. The designer plans regions including the Ch1 sandbox; engineering still needs cross-chapter travel and restoration of the room as left. This is a recorded requirement, not a new creative proposal.

Ch1 is accepted and deferred to the final refinement pass. Ch3 has no delivered build script yet.

## Validation of the inherited checkout

- `npm test`: **48 passed** across 8 files.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript compilation.
- `npm run test:e2e`: **5 passed** in 30.3 s, including Ch1 → Ch2, movement, forge, cutscene completion and poisoned save. Required running outside the sandbox after its local web server could not start inside it.
- `git diff --check`: passed before this documentation addition.

Existing source edits and the unrelated untracked `design/3d/lib/__pycache__/` were left intact. No branches, worktrees, commits or outgoing role handoffs were created.

## Follow-up implementation — External engineer (Codex)

Julius subsequently authorized tackling the remaining integrations and asked to highlight NPC/crowd parity as open work. The intake above records the earlier snapshot; this section records the follow-up.

- Integrated the accepted Step 7 director, exact camera/FOV/hard cuts, two memory stills, real Ch1 prompt, echoes, montage, poison effect, subtitles and fade. Store/HUD beats now come from the designer's `HUD_BEATS`; timing is no longer duplicated.
- Integrated the designer's forge and player orb throughout Ch2. Kept the existing gameplay and temporary Step 6 proof/absorption views while the remaining forge slice is pending.
- Completed review and browser coverage of the inherited HUD/map port; fixed the race where an item consumed before its pickup spark landed could refill an empty socket, and cleaned up those animations on unmount.
- Re-copied all 11 world modules, the latest HUD CSS and both memory images verbatim. Updated sky and shared-texture disposal fixes are included.
- Added a DPR cap of 1.5, adaptive MSAA/resolution tiers, fixed quality overrides and early GPU texture/shader warm-up. Moved texture loading ahead of composer creation to avoid React 19/drei Html-root unmount errors.
- Memoized world/static HUD views after an actual 1080p run exposed unnecessary scene reconciliation. Low-tier live playback improved from roughly 48–52 fps to approximately 60 fps throughout the 37-second film on this Iris Xe. Raw results are in the screenshot folder.
- Added two store tests and three browser tests. All 50 unit tests, lint and production build passed; the eight browser tests passed all five repeated runs before the final performance-only memoization, with final verification recorded in the delivery handoff.

Open design work is explicitly recorded in `handoff/app-to-design/2026-10-14-external-engineer-ch2-visual-gaps.md`: richer named NPCs, crowd movement/posting/trails/pops/reset runners, remaining world modules, and uncertain earlier vibe-scene decorations. Intro, audio, remaining forge visuals and whole-game map regions/travel remain pending. No implementation work was committed.


## NPC/crowd delivery integrated — External engineer (Codex), 2026-10-14
Julius requested integration of the pending designer work. The external designer's NPCs, crowd, trails, agents and util exports are now copied verbatim into the playable app. Replaced the three generic NPC orbs and 12-agent placeholder crowd; retained caller-owned poses, exit, dialogue and all gameplay rules. Named labels and HUD anchors track the animated orb centres.

The shared effects and crowd use the game's clock, freeze on pause/map and hide without emission during Step 7. The NPC shader clock also freezes. Module resources are released on teardown. Added a browser regression for motion, emissions, pause, V8SAME exit, film hiding and replay (passed five times). The existing eight browser tests, 50 unit tests, lint and production build passed.

This completes the delivered NPC/crowd slice. Old Board, pickups, pads/ribbons, flood-bit art, intro, audio, remaining Step 6 enhancements and whole-game map work remain open. Earlier cosmic decorations still have no confirmed keep/drop decision. No commits were made.
