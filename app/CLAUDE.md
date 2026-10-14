# app/ — engineer conventions

Read with: `README.md` (how to run), `docs/DECISIONS.md` (engineer entries), `handoff/design-to-app/MANIFEST.md`.

## Stack
Vite + TypeScript + React 19 + React Three Fiber (Three.js, drei), zustand, Vitest, Playwright (local Chrome), ESLint + Prettier.
Also: @react-three/postprocessing (bloom + AgX tone mapping; `?nofx` turns it off).
Planned, not installed yet: GSAP (animation), Howler.js (audio) — add when first needed (CSS animations suffice so far; no sounds yet).

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
    ch2/                 Chapter 2 "The Cache" (designer layout + islands, other views PLACEHOLDER, real rules)
      config.ts          ALL tunable numbers + script texts, CUTSCENE beat times, flag values; BODY = layout physics
      layout.json        designer's level data (verbatim copy of handoff/design-to-app/assets/ch2/layout.json)
      layout.ts          adapter over layout.json: buildSurfaces(installed), PADS, ITEMS, NPCS, token orbs,
                         clouds, laser lanes, ribbons, map bounds (formulas from the JSON's `notes`)
      hazards.ts         clouds, laser scan lines (waveState/waveHit), flood bits + spit, shot targeting (tested)
      store.ts           state + `sim` (mutable body/world/bits, read per frame) + rules: tokens, pads, pickups,
                         c03220's posts, forge rounds, cutscene beats
      steps.ts           the chain (pickups checked by state, so wandering ahead is fine) + `goalOf` for the map
      world/*.js         designer world modules, VERBATIM copies (env + RENDER, islands, bridges, lasers,
                         clouds, util, motion.js = pure motion formulas the rules use); not linted/formatted
      World.tsx          3D views: `WorldModule` mounts a designer module (create after fonts → object →
                         update(t, dt, state) → dispose); PLACEHOLDER views for the rest; `Anchor` = drei Html
      Screen.tsx         DOM views: log ribbon, minimap + full map (M), Step 0 intro, Step 7 cutscene overlay
      Chapter2.tsx       composition: canvas, camera, shooter, keys, HUD, pause, end card
      reach.test.ts      autopilot runs and jumps every gap of the golden path (on layout.json)
  screens/start|game/    start screen (designer port) · game host
src/assets/models/       designer .glb files (verbatim copies) · sprites/ designer bug SVGs · fonts/ typeface JSON
scripts/make-typeface.py woff2 → three.js typeface JSON (3D letters)
e2e/smoke.spec.ts        Playwright: menu → chapter 1 → end card → menu; Esc pauses over a machine, step back leaves; in-world S1/S3/S4, S5 → board;
                         chapter 2: intro, real keys move/jump, forge, cutscene, `poisoned` in the save
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
**The level is the designer's `layout.json`** (DECISIONS 2026-10-14). `layout.ts` adapts it; ids map 1:1 except pickups (`ITEM_IDS`: `piece-7731` → `p7731` …) and NPCs (`FLAC38347` → `flac`). Islands, bridges, slabs and lifts are `solid: false` (floors, like the designer's page). Movement numbers come from its `physics` block (config.ts `BODY`). **New layout.json version:** copy it over verbatim, run `npx vitest run src/levels/ch2` (reach.test.ts walks the golden path), look at it. **World visuals = the designer's modules** in `world/` (contract `handoff/app-to-design/2026-10-14-ch2-world-as-modules.md`): `createX(ctx) → {object, update(t, dt, state), dispose()}`. New version: copy `handoff/design-to-app/assets/ch2/world/*.js` over verbatim. Mount a new one with `<WorldModule create={…} state={() => …} clock="game"|"render" U={U} />` in World.tsx: `clock="game"` (store time) for anything that hits, so it matches the rules; `U` (uTime, uPsy) is the app's. `world/util.js` touches OffscreenCanvas at import, so only `motion.js` may be imported by rules/tests. Render settings (camera, fog, bloom, env) come from `env.js` `RENDER` (`WORLD_RENDER`). Still placeholders: Old Board, NPCs, crowd, pickups, pads, forge, ribbons, bits, player orb (designer part 3 + forge slice). Dev hook `window.__ch2view.yaw/pitch` turns the camera. Screen layer slots: §4 of `2026-10-13-ch2-greybox-and-contract.md`. Dev hook: `window.__ch2` (store; `__ch2.sim` for the body).

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

## Status (2026-10-14)
- **Ch2 is the current level.** Playable end to end (script v3.2) on the **designer's layout.json v2 (findings fixed), island models and world modules part 1+2** (sky/city/env, islands, bridges, red laser scanners, text clouds; rules on `motion.js`): all 8 steps, platforming, hazards, the forge fight, the cutscene timeline, `poisoned` in the save. Julius approved the gap choices and the merge plan "my game, their world".
- **Waiting on:** designer: part 3 modules (oldBoard, crowd, npcs, pickups, pads, trails), the forge + poisoned orb slice, Step 7 camera keyframes; feedback on `app-to-design/2026-10-14-ch2-modules-1-integrated.md` (bloom match screenshots).
- **Next for the engineer:** integrate `design-to-app/2026-10-14-ch2-hud-and-map.md` (HUD + map export, `--color-poison` → `--color-violet` for Ch1) — arrived, not read yet.
- Ch1 end card → **CONTINUE** into Ch2 (`continueFrom` in the global store; the game host remounts on `run`). All chapters stay unlocked until the final refinement pass.
- Tests: 48 unit (incl. physics, a Ch2 playthrough, golden-path reachability on layout.json) + 5 e2e (Ch1 chain ends with CONTINUE → Ch2 intro).
- **Ch1 is marked done for now** (Julius). Fine-tuning comes after all chapters.
- Done: start screen (designer v1), Chapter 1 full chain (intro → wake → prompt → 4 flag stations → impossible flag 5 → zz entry → GET→MKCOL message → ending); HUD, tokens, hints, debug panel, save of the player's message.
- Story v2 in: real `flag{32 hex}` flags (copy + paste; COPY buttons on in-world flags), the real "OH MY GOD! … other agents!" thought, real board folder names in the ending, finishing a chapter unlocks the next model.
- The room is 100% designer models: room shell, desk + printed prompt, eye v1.1, depot, plinth, stations 1–5 at the spread layout, with the discovery lighting (one station lit at a time, floor paths, spot shadows). S1/S3/S4/S5 are played in-world; S2 keeps its search window.
- 2026-10-13 (Julius playtest): Esc = pause only, three other ways out of a machine; trying Station 5 reveals the board 2.5 s after its run (no wrong flags).
- Ch1 e2e drives S1 decode, an S3 plug drag, an S4 shot and the S5 → board reveal in the real 3D view. e2e: `npx playwright test`, ≈ 35 s.
- Waiting on: Julius playtest (especially: is the dark room readable on a real GPU?); designer: wake sound, feedback on `handoff/app-to-design/2026-10-12-ch1-room-and-stations-integrated.md`.
- Not yet: no audio. HUD and the paper/S2 windows still have the placeholder look (UI kit used on the depot and station screens only).
- Known limits: after leaving a machine the browser may need a click to re-lock the mouse (game keeps running, shows "click to look around"); e2e renders on the GPU (Vulkan, ~35 FPS, full suite ≈ 30 s); `E2E_SWIFTSHADER=1` falls back to CPU WebGL (~1 FPS, timeouts ×15); DOM screens are never hidden by 3D objects (fine in this room).
