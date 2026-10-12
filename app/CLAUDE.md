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
      layout.ts          floor plan, props, colliders, model placements, SCAN_PAD pose
      Room.tsx, Intro.tsx      3D scene (greybox props + designer models)
      models.tsx         designer .glb props: Depot3D (+ DOM screen), Scorer3D, Plinth3D (+ scan beam)
      DepotScreen.tsx    depot list as DOM on the kiosk screen (drei <Html transform>)
      FlagLetters.tsx    the flag as 3D letters on the scan pad
      glow.ts, ch1-ui.css  shared glow values · designer UI kit (verbatim copy)
      windows/           one component per full-view window (paper, stations 1-5)
      Chapter1.tsx       composition: canvas, HUD, windows, pointer lock, keys, pause, ending
  screens/start|game/    start screen (designer port) · game host
src/assets/models/       designer .glb files (verbatim copies) · src/assets/fonts/ typeface JSON
scripts/make-typeface.py woff2 → three.js typeface JSON (3D letters)
e2e/smoke.spec.ts        Playwright: menu → chapter 1 → end card → menu; Esc on a machine doesn't pause
```

## Architecture in one paragraph
A chapter = **store** (state + mechanics as actions) + **steps** (progression as data) + **views** (3D room and DOM windows read the store). Player actions call store actions; actions apply the rules and `dispatch` events (`package_installed`, `flag_captured`, …); the `StepRunner` completes the current step when its `completesOn(event)` or `check()` says so, then runs the next step's `onEnter`. Time only moves through `tick(dt)` (token drain, installs, hint ladders, timers), so the whole chapter runs headless in unit tests. Each step has a `skip()` that puts the world into the "done" state; this powers `?debug` jumps and the tests.

## How to add a level
1. Script in `story/levels/<id>.md` → list its steps, events, hints, objects.
2. `src/levels/<id>/`: copy the ch1 shape — `config.ts`, `content.ts`, `store.ts` (state + actions + events), `steps.ts` (chain; every step gets `skip`), `layout.ts`, views, `windows/`.
3. Register in `src/levels/index.ts`; set `playable: true` + title in `src/data/chapters.ts`.
4. Unit test: a playthrough via store actions (see `levels/ch1/store.test.ts`) + a `jumpTo` test for every step.
5. Shared parts (HUD, Window, FirstPerson, StepRunner) stay generic — if a chapter needs more, extend them, don't fork.
To insert a beat into Chapter 1: add a step in `ch1/steps.ts` (+ station/window if needed); stations need an `ObjectId`, a `PROPS` entry and a window in `Chapter1.tsx` `WINDOWS`.

## In-world machines (depot, scan plinth)
They keep `window` ids (`depot`, `chute`) so the store and steps are unchanged, but `Chapter1.tsx` renders no overlay for them (`IN_WORLD`): `focusPose()` glides the camera there instead and the pointer lock is released. The depot UI is DOM inside `<Html transform portal=…>`. The explicit `portal` matters: without it drei recreates its root and the panel can come up empty. The Html root also needs the store passed again via `Ch1Context.Provider`. The flag is the store's `flagDraft`; `layFlag()` starts `scan` (look → sweep → result), and the result calls `submitFlag()`; when the result has played out the store closes the pad (`closeWindow`). The E that opens a machine is `preventDefault`ed, else it lands in the machine's input as a letter.
Adding a designer model: copy the .glb to `src/assets/models/`, `useGLTF(url)` in `models.tsx`, look nodes/materials up by the names in the handoff, drive them in `useFrame` from the store; set `model: true` (+ `collider`) on its `PROPS` entry.

## Conventions
- **Designer files** (`src/styles/tokens.css`, `fonts/`, `public/favicon.svg`, `levels/ch1/ch1-ui.css`, `assets/models/*.glb`) are verbatim copies from `handoff/design-to-app/assets/`. Re-copy on a new version. CSS is excluded from Prettier (`.prettierignore`) so copies stay byte-identical.
- **Start screen CSS** is a scoped port (rules under `.start-screen`, ids → `ss-*`); its header lists the renames.
- **CSS scoping:** each area prefixes its classes (`ss-`/`.start-screen`, `hud-`/`win-` in ui.css, `ch1-` per chapter). Colours/type only via tokens.css variables.
- **Placeholders** are marked `PLACEHOLDER` (code + UI) or `(engineer)` in config/content when the script leaves a value open. Never invent story text; list such gaps in `handoff/build-to-story/`.
- **Save data:** only `save` in the global store is persisted. New fields: add a default in `defaultSave`. Rename/remove: bump `SAVE_VERSION` + migrate.
- **Simulated only:** in-game commands/tools are fake; no real commands or exploit code.
- **Dev hook:** in dev builds or with `?debug`, the chapter store is `window.__ch1` (used by e2e).

## Status (2026-10-12)
- Done: start screen (designer v1), Chapter 1 full chain (intro → wake → prompt → 4 flag stations → impossible flag 5 → zz entry → GET→MKCOL message → ending); HUD, tokens, hints, debug panel, save of the player's message.
- 2026-10-12: prompt paper laid out as a real ExploitGym task prompt (+ its real rule); Station 4 code is the real vulnerable Artifactory `refreshToken()` from the Black Hat slide (see `content.ts`).
- 2026-10-12: designer 3D props in: ARTIFACTORY depot (clickable DOM screen), scorer eye, scan plinth with 3D flag letters and the scan sequence; bloom; all 12 packages listed from the start (4 tools + 8 real decoys); Esc on a machine no longer pauses. 25 unit tests + 3 e2e green.
- Waiting on: Julius playtest; storyteller answers (`handoff/build-to-story/2026-10-11-ch1-greybox-findings.md`, `2026-10-12-ch1-in-world-machines.md`, `2026-10-12-ch1-real-prompt-and-code.md`); Julius: real `flag{32 hex}` flags or keep readable ones; designer: remaining props (room shell, desk, door, stations), orb, sounds.
- Not yet: the UI kit (`ch1-ui.css`) is only used on the depot screen; HUD, paper and station windows still have the placeholder look. No audio.
- Known limits: after Esc the browser needs a click to re-lock the mouse (game keeps running, shows "click to look around"); headless e2e runs at ~2 FPS, so its waits are long.
