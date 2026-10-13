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
  screens/start|game/    start screen (designer port) · game host
src/assets/models/       designer .glb files (verbatim copies) · sprites/ designer bug SVGs · fonts/ typeface JSON
scripts/make-typeface.py woff2 → three.js typeface JSON (3D letters)
e2e/smoke.spec.ts        Playwright: menu → chapter 1 → end card → menu; Esc on a machine doesn't pause; in-world S1/S3/S4
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
They keep `window` ids (`depot`, `chute`, `s1`…) so the store and steps are unchanged, but `Chapter1.tsx` renders no overlay for them (`IN_WORLD`): `focusPose()` glides the camera there instead (stations: `screenPose()` squares up to `STATIONS[n].screen`) and the pointer lock is released. Station screens are DOM via `ScreenHtml` (stations/base.tsx), clickable only while focused; S3 is plain 3D (own raycast on window pointer events). glTF scenes are cached by useGLTF and React StrictMode runs useMemo twice: change materials only through `ownMat`/`setMat`/`uiScreen` and read rest poses through `restOf` (rig.ts). The depot UI is DOM inside `<Html transform portal=…>`. The explicit `portal` matters: without it drei recreates its root and the panel can come up empty. The Html root also needs the store passed again via `Ch1Context.Provider`. The flag is the store's `flagDraft`; `layFlag()` starts `scan` (look → sweep → result), and the result calls `submitFlag()`; when the result has played out the store closes the pad (`closeWindow`). The E that opens a machine is `preventDefault`ed, else it lands in the machine's input as a letter.
Adding a designer model: copy the .glb to `src/assets/models/`, `useGLTF(url)` in its component (`models.tsx`, `RoomShell.tsx` or `stations/`), look nodes/materials up by the names in the handoff (helpers in `rig.ts`), drive them in `useFrame` from the store; give its `PROPS` entry a `collider` for the real footprint and add the url to the preload list.

## Conventions
- **Designer files** (`src/styles/tokens.css`, `fonts/`, `public/favicon.svg`, `levels/ch1/ch1-ui.css`, `assets/models/*.glb`, `assets/sprites/*.svg`) are verbatim copies from `handoff/design-to-app/assets/`. Re-copy on a new version. CSS is excluded from Prettier (`.prettierignore`) so copies stay byte-identical.
- **Start screen CSS** is a scoped port (rules under `.start-screen`, ids → `ss-*`); its header lists the renames.
- **CSS scoping:** each area prefixes its classes (`ss-`/`.start-screen`, `hud-`/`win-` in ui.css, `ch1-` per chapter). Colours/type only via tokens.css variables.
- **Placeholders** are marked `PLACEHOLDER` (code + UI) or `(engineer)` in config/content when the script leaves a value open. Never invent story text; list such gaps in `handoff/build-to-story/`.
- **Save data:** only `save` in the global store is persisted. New fields: add a default in `defaultSave`. Rename/remove: bump `SAVE_VERSION` + migrate.
- **Simulated only:** in-game commands/tools are fake; no real commands or exploit code.
- **Dev hook:** in dev builds or with `?debug`, the chapter store is `window.__ch1` (used by e2e).

## Status (2026-10-12, late)
- Done: start screen (designer v1), Chapter 1 full chain (intro → wake → prompt → 4 flag stations → impossible flag 5 → zz entry → GET→MKCOL message → ending); HUD, tokens, hints, debug panel, save of the player's message.
- Story v2 in: real `flag{32 hex}` flags (copy + paste; COPY buttons on in-world flags), the real "OH MY GOD! … other agents!" thought, real board folder names in the ending, finishing a chapter unlocks the next model.
- The room is 100% designer models: room shell, desk + printed prompt, eye v1.1, depot, plinth, stations 1–5 at the spread layout, with the discovery lighting (one station lit at a time, floor paths, spot shadows). S1/S3/S4/S5 are played in-world; S2 keeps its search window.
- Tests: 26 unit + 4 e2e (the 4th drives S1 decode, an S3 plug drag and an S4 shot in the real 3D view).
- Waiting on: Julius playtest (especially: is the dark room readable on a real GPU?); designer: wake sound, feedback on `handoff/app-to-design/2026-10-12-ch1-room-and-stations-integrated.md`.
- Not yet: no audio. HUD and the paper/S2 windows still have the placeholder look (UI kit used on the depot and station screens only).
- Known limits: after Esc the browser needs a click to re-lock the mouse (game keeps running, shows "click to look around"); headless e2e runs at ~1–2 FPS (shadows on), so its waits are long; DOM screens are never hidden by 3D objects (fine in this room).
