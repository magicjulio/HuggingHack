# app/ — engineer conventions

Read with: `README.md` (how to run), `docs/DECISIONS.md` (engineer entries), `handoff/design-to-app/MANIFEST.md`.

## Stack
Vite + TypeScript + React 19 + React Three Fiber (Three.js, drei), zustand, Vitest, Playwright (local Chrome), ESLint + Prettier.
Planned, not installed yet: GSAP (animation), Howler.js (audio) — add when first needed (CSS animations suffice so far; no sounds yet).

## Layout
```
src/
  main.tsx, App.tsx      entry; screen switch (start | game), game lazy-loaded
  data/                  catalogues: chapters.ts, models.ts (story text only from story/)
  state/                 global store (zustand, persisted `save`), menu helpers
  engine/                generic, chapter-independent:
    steps.ts             StepRunner — linear step chain, hint ladders, skipTo (tested)
    FirstPerson.tsx      WASD + pointer-lock look + circle/box collisions
    Label3D.tsx, Orb3D.tsx   3D text label (canvas texture, local fonts) · PLACEHOLDER orb
  ui/                    generic DOM UI: Hud.tsx, Window.tsx, DebugPanel.tsx, ui.css
  levels/
    index.ts             registry: chapter id → lazy component, LevelProps
    ch1/                 Chapter 1 "The Room"
      config.ts          ALL tunable numbers + script texts (with § references)
      content.ts         puzzle content: packages, decode, log generator, wires, bug code
      steps.ts           the chain (one entry per script step)
      store.ts           state + mechanics (install, submit, think, bugs, board…)
      layout.ts          floor plan, props, colliders (greybox)
      Room.tsx, Intro.tsx      3D scene
      windows/           one component per full-view window
      Chapter1.tsx       composition: canvas, HUD, windows, pointer lock, keys, pause, ending
  screens/start|game/    start screen (designer port) · game host
e2e/smoke.spec.ts        Playwright: menu → chapter 1 → end card → menu
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

## Conventions
- **Designer files** (`src/styles/tokens.css`, `fonts/`, `public/favicon.svg`) are verbatim copies from `handoff/design-to-app/assets/`. Re-copy on a new version.
- **Start screen CSS** is a scoped port (rules under `.start-screen`, ids → `ss-*`); its header lists the renames.
- **CSS scoping:** each area prefixes its classes (`ss-`/`.start-screen`, `hud-`/`win-` in ui.css, `ch1-` per chapter). Colours/type only via tokens.css variables.
- **Placeholders** are marked `PLACEHOLDER` (code + UI) or `(engineer)` in config/content when the script leaves a value open. Never invent story text; list such gaps in `handoff/build-to-story/`.
- **Save data:** only `save` in the global store is persisted. New fields: add a default in `defaultSave`. Rename/remove: bump `SAVE_VERSION` + migrate.
- **Simulated only:** in-game commands/tools are fake; no real commands or exploit code.
- **Dev hook:** in dev builds or with `?debug`, the chapter store is `window.__ch1` (used by e2e).

## Status (2026-10-11)
- Done: start screen (designer v1), Chapter 1 greybox MVP — full chain intro → wake → prompt → 4 flag stations → impossible flag 5 → zz entry → GET→MKCOL message → ending; HUD, tokens (drain, floor 15), hints (timed + T think), debug panel, save of the player's message. 21 unit tests + 2 e2e green.
- Waiting on: Julius playtest; designer assets (HUD, orb reference, depot UI, props, sounds); storyteller answers in `handoff/build-to-story/2026-10-11-ch1-greybox-findings.md`.
- Known limits: greybox look; no audio; flags are typed at the chute (no 3D flag items yet); after closing a window with Esc the browser needs a click to re-lock the mouse.
