# App → Design: Ending 2 "Ascent" is integrated (2026-10-19)

**What it is:** the engineer's report on the port asked for in `handoff/design-to-app/2026-10-19-ascent-promoted.md` (now in `_archive/design-to-app/`).
**What changed since the last handoff:** ASCENT runs in the app as Ending 2: start screen row **E2 "Ascent" · ending · storm the tower**, and the bridge's Hugging Face lane (`onPick('end2')`). The app copy in `app/src/levels/end2/` is now the live one. The prototype stays as the reference.
**What the receiver must do:** nothing is blocking. Julius should play it once in the app (`npm run dev` → E2), ideally the whole run. From now on, gameplay or art changes go to the app copy through a handoff, not into the prototype alone.
**Open questions:** none from the engineer. The story text (end card, room and sign names) is still a placeholder, as decided.

## What was ported
- From `prototypes/end2-ascent/` at `5336107`: every file in the "Ship" column plus `assets/` (13 glbs, `hf-logo.svg`, `hf-logo-with-title.svg`, fonts). `DESIGN.md`, `FLOOR2.md`, `FLOOR3.md` and `BOSS.md` are copied next to the port.
- `looks.js` was left out because nothing in the game imports it any more (`fx.js` replaced it). The lab files and `smoke.mjs` were left out as agreed.
- The gameplay code and every number are unchanged. The edits are only these, and each is marked "app port" in the code:
  - **`main.js`** became `createAscent(root, opts) → { dispose }`:
    - The boot is still async (fonts, logo, approach glbs), and a dispose during the boot stops it cleanly.
    - Listeners go through `on()`, and `requestAnimationFrame` ids are tracked.
    - `body[data-aim|data-vent]` and `--vent-*` now live on the game's root element.
    - `window.__ascent` is set by `opts.debug` (dev builds or `?debug`) instead of `?test`.
  - **`host.js`** (new) lends the root and `on()` to `flight.js` (letterbox, fade, mousemove), `flight-hud.js` (HUD and its `<style>`) and `audio.js` (mute flag, M key, visibilitychange). Nothing is attached to `document.body` any more.
  - **`audio.js`** has a new `close()` that stops the music scheduler and closes the AudioContext.
  - **`assets.js`** (new) is a table of URLs that Vite can bundle. A directory URL like `"./assets/models/" + name` doesn't survive a production build, so every model and SVG path goes through `asset(name)`.
  - **Imports:** `three/addons/` became `three/examples/jsm/`. three stays pinned at 0.186.
  - **Styles:** the inline `<style>` and `hud.css` are now `end2.css`, scoped under `.end2`.
- **"Back to menu"** buttons were added:
  - On the panel, for the title, pause and REGROUP screens, as a text link under the main button like "Restart entire approach".
  - On the end card, next to FLY AGAIN.
  - If you want a different look for them, send a new style.
- **The finish** calls the app: `recordBestTime('end2', runTime)` and `finishChapter('end2')`. The card itself is the prototype's. The saved best time is passed in but not shown anywhere yet, so tell me if the card should show it.
- **URL knobs:** `?floor=3&at=arena&phase=2`, `?msaa=`, `?res=`, `?post=classic`, and the others still work in the app URL.
- **Look defaults:** `msaa 4` and `renderScale 1` are unchanged.

## Verified
- `npm run build` passes. The top-level awaits in `models.js` and `enemies-extra.js` build fine on Vite 8. All 13 glbs, both SVGs and the fonts land in `dist/`.
- **New e2e test, `app/e2e/end2.spec.ts`.** It runs:
  1. Pick E2, then the title panel, then the approach (flight HUD up).
  2. `toArena(1)`: floor 3, GLM-5.2 up, boss bar.
  3. Esc pauses.
  4. Finish card: the save gets `completedChapters` with `end2` and `bestTimes.end2`.
  5. Back to menu, and a second round trip through pause → Back to menu.
  6. Both exits are checked: no window/document listeners left, no live WebGL context, no game rAF, no `#fl-hud` or `#muteflag` left.

  Screenshots of the approach, the arena and the end card are in `app/test-results/end2-*.png`.
- The full suite passes: 53 unit tests and 15 browser tests. One store test was updated because E2 is no longer locked.

## Not proven
- **The full run.** The test doesn't drive it: landing → floor 1 hold → lift → floor 2's 8 sections → express lift → boss kill. Julius plays it by hand. Your `smoke.mjs` bot isn't ported, because floor 2 was flaky.
- **Frame rate inside the app.** It should be the same as the prototype, because it's the same renderer and the app draws nothing else while E2 runs. It wasn't measured.
- **The known issues from the promotion handoff** are unchanged: the camera clips into a downed hand, and downed hands have no collision.
