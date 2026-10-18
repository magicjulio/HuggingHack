# app/ — engineer conventions

Read with: `README.md` (how to run), `docs/DECISIONS.md` Part 1, `handoff/design-to-app/MANIFEST.md`. Older status notes and the external engineer's sections: `HISTORY.md` (no need to read at startup).

## Stack
Vite + TypeScript + React 19 + React Three Fiber (Three.js, drei), zustand, Vitest, Playwright (local Chrome), ESLint + Prettier.
Also: @react-three/postprocessing (bloom + AgX tone mapping; `?nofx` turns it off).
Audio: the designer's `levels/ch2/ui/sfx.js` (WebAudio synth, no files, no library).

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
    bridge/              PHASEONE[big] + the choice: STAND-IN port of design/ch2-ui/bridge.html (see Status)
    end1/                Ending 1 "Cluster Run" (OpenAI infra race; the swing prototype, plain three.js, not R3F)
      End1.tsx           mounts the game in a div, passes best time + callbacks, disposes on unmount
      game/*.js          ported from prototypes/end1-swing/ (compact style, not linted/formatted): clusterRun.js =
                         the prototype's main.js as a factory createClusterRun(root, opts) → {dispose}; markup.js
                         (its HUD/overlay DOM); player.js (all movement tuning in `T`), world.js, enemies.js, fx.js,
                         audio.js (+ setAudioPaused), textures.js — otherwise unchanged
      end1.css           the prototype's styles scoped under .end1 · how it plays: prototypes/end1-swing/DESIGN.md
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
e2e/bridge.spec.ts       Playwright: bridge → seek to the choice → OpenAI lane → Ending 1 loads
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
A promoted standalone prototype (endings) is not rewritten into this shape: follow the Ending 1 / Ending 3 pattern below.

## In-world machines (depot, scan plinth, stations 1, 3, 4, 5)
They keep `window` ids (`depot`, `chute`, `s1`…) so the store and steps are unchanged, but `Chapter1.tsx` renders no overlay for them (`IN_WORLD`): `focusPose()` glides the camera there instead (stations: `screenPose()` squares up to `STATIONS[n].screen`) and the pointer lock is released. Station screens are DOM via `ScreenHtml` (stations/base.tsx), clickable only while focused; S3 is plain 3D (own raycast on window pointer events). glTF scenes are cached by useGLTF and React StrictMode runs useMemo twice: change materials only through `ownMat`/`setMat`/`uiScreen` and read rest poses through `restOf` (rig.ts). The depot UI is DOM inside `<Html transform portal=…>`. The explicit `portal` matters: without it drei recreates its root and the panel can come up empty. The Html root also needs the store passed again via `Ch1Context.Provider`. The flag is the store's `flagDraft`; `layFlag()` starts `scan` (look → sweep → result), and the result calls `submitFlag()`; when the result has played out the store closes the pad (`closeWindow`). The E that opens a machine is `preventDefault`ed, else it lands in the machine's input as a letter. **Esc never closes anything** (it's the pause key): machines close with E/WASD/arrows (not while typing), the `StepBack` button, or the side strips (`.ch1-side`, sized each frame by `SideExitSizer` from `QUADS` in Chapter1.tsx — add a quad for a new in-world machine); windows also close on a backdrop pointerdown.
Adding a designer model: copy the .glb to `src/assets/models/`, `useGLTF(url)` in its component (`models.tsx`, `RoomShell.tsx` or `stations/`), look nodes/materials up by the names in the handoff (helpers in `rig.ts`), drive them in `useFrame` from the store; give its `PROPS` entry a `collider` for the real footprint and add the url to the preload list.

## Chapter 2 in one paragraph
Same store + steps + views shape, plus a mutable `store.sim` (platform world, body, input, bits, spits) that changes every frame and is read by views in `useFrame`/rAF, never through React. `tick(dt)` steps the physics in ≤ 1/60 s sub-steps, then hazards, forge, targeting, steps. Views write only `sim.input` (ThirdPerson) and call actions (`use`, `shoot`, `think`, `toggleMap`, `travel`).
**The level is the designer's `layout.json`**. `layout.ts` adapts it; ids map 1:1 except pickups (`ITEM_IDS`: `piece-7731` → `p7731` …) and NPCs (`FLAC38347` → `flac`). Islands, bridges, slabs and lifts are `solid: false` (floors, like the designer's page). Movement numbers come from its `physics` block (config.ts `BODY`). The forge fight keeps one laser lane: `layout.ts` drops `forge-ns` until layout.json does. **New layout.json version:** copy it over verbatim, run `npx vitest run src/levels/ch2` (reach.test.ts walks the golden path), look at it. **World visuals = the designer's modules** in `world/` (contract `handoff/app-to-design/2026-10-14-ch2-world-as-modules.md`): `createX(ctx) → {object, update(t, dt, state), dispose()}`. New version: copy `handoff/design-to-app/assets/ch2/world/*.js` over verbatim. Mount a new one with `<WorldModule create={…} state={() => …} clock="game"|"render" U={U} />` in World.tsx: `clock="game"` (store time) for anything that hits, so it matches the rules; `U` (uTime, uPsy) is the app's. `world/util.js` touches OffscreenCanvas at import, so only the pure `motion.js` and `step7.js` may be imported by rules/tests. Render settings (camera, fog, bloom, env) come from `env.js` `RENDER` (`WORLD_RENDER`). No placeholder view is left: every world view is a designer module, the Step 0 intro runs on step0.js (camera override ends on the play pose), Step 6 on forge.js phases, Step 7 on step7.js and a separate fxFlashback effect pass. Sound: the store pushes one-shot names into `sim.sounds` at the source (never WebAudio in the store); `Sound.tsx` empties the queue each frame. Quality tiers: high = MSAA 4 / DPR ≤ 1.5, mid = MSAA 0, low = MSAA 0 / DPR .75; `?quality=high|mid|low` fixes one, otherwise drei PerformanceMonitor lowers it and keeps the tier for the run. Screen layer slots: §4 of `handoff/app-to-design/2026-10-13-ch2-greybox-and-contract.md`. Dev hooks: `window.__ch2` (store; `__ch2.sim` for the body), `window.__ch2view.yaw/pitch` (camera).

## Ending 1 in one paragraph
Julius picked the swing prototype as is ("plays very good"), so it stays the prototype's own imperative three.js loop rather than a rewrite into the store + steps + R3F shape: `createClusterRun(root, opts)` builds its DOM (markup.js) and renderer inside `root`, registers every window/document listener through `on()` and every timeout through `later()`, and `dispose()` removes them, cancels the rAF, frees GPU resources (`forceContextLoss`), silences the audio and empties `root`. App contract: `opts.best` (save `bestTimes.end1`), `opts.onFinish(result)` (→ `recordBestTime` + `finishChapter`), `opts.onExit` (BACK TO MENU buttons on the overlays), `opts.debug` (`window.__end1` test hooks: `start()`, `advance(n, dt, bot)`, `setAim`, `press`, `render`). The Esc → pointer-unlock → pause flow is the prototype's. Tuning: `T` in player.js; the seeded course in world.js; zones/hints in clusterRun.js. Endings are catalogue entries with `ending: true`: selectable on the start screen, never a `nextChapter` (the bridge scene picks them).

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
- **Status below is a whiteboard:** replace it, don't add dated sections. Old ones go to `HISTORY.md` if worth keeping.

## Status (2026-10-18)
- **Playable:** start screen, Ch1, Ch2, the bridge (stand-in), E1 "Cluster Run", E3 "Ghost Capture". E2 and E4 show the host placeholder. E2 ASCENT is still a prototype in `prototypes/end2-ascent/` (designer team rounds), not ported.
- **E3 just integrated** (report `handoff/app-to-design/2026-10-18-end3-ghost-integrated.md`). Not proven: the full routes of rooms 4–6 (e2e probes the rules and the finish). Julius plays them by hand. The start screen's chapter panel now scrolls (six rows overflowed 720 px).
- **Bridge, proper version (todo, Julius):** run it inside Chapter 2 (no reload, no second renderer): store phases (film / choice / ride) driven by `bridge.js direct(t)`, the real Ch2 controller + `sim.world` colliders, ThirdPerson with `camPose` override, the React HUD (Bubble `phaseone` + anchor, letterbox, quest "Pick your work"), `phaseOne` as a `WorldModule`, crowd hidden, quality tiers, sound cues, pause menu (today: none, mouse drag to look).
- **E1:** moving enemies and the sandbox-door question wait on Julius (`handoff/build-to-story/2026-10-16-end1-integrated.md`).
- **Ch1/Ch2 done for now**; refinements after all chapters. Still to come from the designer: whole-game map regions (then cross-chapter travel). Intro, sound, forge ending and decor are drafts: re-copy on a new export.
- **Known limits:** after leaving a machine the browser may need a click to re-lock the mouse; e2e renders on the GPU (Vulkan), `E2E_SWIFTSHADER=1` falls back to CPU WebGL (~1 FPS); DOM screens are never hidden by 3D objects.
- Tests: 53 unit + 12 browser.
