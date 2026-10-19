# App → Design: Ending 3 "Ghost Capture" is integrated

**What it is:** report on `handoff/design-to-app/2026-10-18-end3-ghost-approved.md`. Ghost Capture is playable in the app as **E3**.
**What changed since the last handoff:** this is the first app-side delivery of Ending 3.
**What the receiver must do:** look at the screenshots and confirm that the app's look matches the approved prototype. Report differences through `design-to-app/`. Julius plays the six rooms by hand.
**Open questions:** see the end.

## Done
- `app/src/levels/end3/`: the prototype's own imperative three.js loop, wrapped like Ending 1. `End3.tsx` mounts `createGhostCapture(root, { onExit, onFinish, debug }) → { dispose }`.
- Gameplay is the prototype's, with no changes: movement, Q switch, acquisition (cone **and** line of sight), lock freeze, cyan beam still catches KAM, solid cover vs thin ledges, reset/R/Esc, all scanner variants and the six rooms (`levels.js`, `level4–6.js` and `art.js` copied verbatim). Assets were copied byte-identical to `game/assets/`. Deep Archive art loads for rooms 4–6 only (`visualTheme: "archive"`).
- `main.js` → `ghostCapture.js`. The only changes are app lifecycle ones: the DOM is built inside `root` (`markup.js`), window listeners go through `on()`, the art loads before the first room, and `dispose()` frees the rAF, listeners, meshes, textures and renderer (`forceContextLoss`). `?test`/`window.__ghost` became `window.__end3` (dev/`?debug` only). `style.css` is scoped under `.end3` (`end3.css`). The only layout tweak: `#game` is also capped at the viewport height (`min(100vw, 1500px, 177.78vh)`), so the 16:9 field never overflows a wide screen.
- **BACK TO MENU** sits next to the main button on the one overlay, which serves intro, pause and the final `+0` card. Finishing calls `onFinish` once → `end3` is saved as completed. No best time is recorded.
- Catalogue: `end3` = "Ghost Capture", "ending · beat the scorer", `ending: true`. The bridge's `end3` pick now lands in the game.
- No route notes, perch markers or room text appear in the UI.

## Start screen side effect (please review)
With E3 named, its title wraps to two lines, and the six chapter rows no longer fit a 1280 × 720 screen: INJECT was pushed off the bottom. Fix in `app/src/screens/start/start-screen.css`: the chapter panel stays inside its grid row and scrolls (`min-height:0; overflow-y:auto`). W/S keeps the selected row in view. Larger screens look the same. A tighter row design would be the designer's call. See `shots-2026-10-18-end3/start-screen-720p.png`.

## Checked
- 53 unit + 12 browser tests pass. The new `e2e/end3.spec.ts` covers:
  - picking E3, then probes for: switching keeps positions; the inactive body gets no run input but falls; sight needs both angle and line; the solid screen blocks; a thin ledge does not; the lock freezes the angle; the locked beam catches KAM; reset restores the room.
  - finishing room 6 (eyes blinded for that probe): `+0`, `onFinish` exactly once, completion saved.
  - menu → E3 again through BEGIN + Esc pause → menu. Afterwards no window input listeners, WebGL contexts or game rAF calls survive.
- Screenshots in `shots-2026-10-18-end3/`: room 1 with a locked cyan cone, room 4 (Deep Archive), the final `+0` card and the 720p start screen.
- **Not proven:** that rooms 4–6 can be completed. As the handoff says, the old `smoke.mjs` routes are obsolete, and the e2e test does not walk the routes.

## Open questions
1. Sound: none yet (as the handoff says). When there is a cue list, the app plays it through its usual path.
2. DECISIONS 2026-10-18 (designer) says "Ending 3 is not decided yet: both MVPs stay open" (ASCENT vs this). For now the app's `end3` id = Ghost Capture, per this approval. If ASCENT also ships, Julius decides which slot it takes.
