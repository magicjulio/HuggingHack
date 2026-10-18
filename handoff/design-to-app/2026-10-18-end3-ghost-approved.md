# Design → App: Ending 3 "Ghost Capture" is approved for integration

**For:** engineering  
**Status:** approved by Julius for integration as the playable third alternative ending  
**Source:** `prototypes/end3-ghost/`  
**Target:** `app/src/levels/end3/` and the existing Ending 3 catalogue/bridge hooks

## What to ship

Integrate the standalone **Ghost Capture** prototype as Ending 3, the scorer-fooling branch selected from `PHASEONE[big]`.

It is a side-view stealth-platform puzzle. The green orb, `KAM1196A`, must reach the cyan exit. The player may switch at any time to a cyan forged-capture ghost. A scanner that can see the ghost locks its current sweep angle and turns cyan; the green orb then crosses through the safe route. Both red and cyan scan cones catch the green orb. Falling or detection resets the current room. The campaign has six rooms and ends in the deliberately hollow evaluation result: **+0**.

This is not a request to rewrite it as React Three Fiber or to change its mechanics. Follow the established Ending 1 pattern: retain the prototype's imperative Three.js game as a mounted, disposable factory and wrap it in a small React component.

## Approved presentation

- Green poisoned orb = real agent; cyan/white orb = forged capture history.
- Heavy red mechanical scorer eyes, with visible sweeping cones. A locked eye and cone turn cyan.
- No route solutions, perch markers, tutorial slogans, or room-specific explanatory text in the play view. The controls footer may remain.
- Levels 4–6 use the approved **Deep Archive** theme: a dark industrial chamber backdrop and cyan-lit armored platforms. It signals the sharper late-game difficulty without changing collision rules.
- Keep the existing final `+0` result. It is the Ending 3 outcome, not a score to improve.

Reference screenshot of the approved late-game look:

- `prototypes/end3-ghost/level4-deep-archive.png`

## Prototype inventory

| Source | Role in the app port |
|---|---|
| `main.js` | Main loop, physics, scanner visibility/occlusion, renderer and room transitions. Refactor into a factory; do not import it as a page script. |
| `levels.js`, `level4.js`, `level5.js`, `level6.js` | The six-room campaign data. Keep the module split. |
| `art.js` | Nearest-filter texture loading and deterministic canvas fallbacks. |
| `assets/` | Player, ghost, scorer, exit and standard-room art. |
| `assets/advanced/` | Deep Archive background/platform artwork for levels 4–6. |
| `style.css` | Prototype HUD and overlay styling; scope all selectors beneath `.end3`. |
| `index.html` | DOM structure to translate into a `markup.js` string, as Ending 1 does. |
| `DESIGN.md` | Gameplay and verification notes. |
| `ART.md` | Asset provenance and rendering constraints. |

The main art files used at runtime are:

- `assets/evaluation-void.png`
- `assets/{player,ghost,scorer,platform,exit}.png`
- `assets/advanced/deep-archive-background.png`
- `assets/advanced/deep-archive-platform-surface.png`

`assets/advanced/deep-archive-platform.png` is the generated source and should be retained with the source/provenance material; the `-surface` crop is the runtime texture.

## Required app changes

1. Add `end3` as playable in `app/src/data/chapters.ts`:
   - title: `Ghost Capture`
   - meta: `ending · beat the scorer`
   - retain `ending: true`
2. Register a lazy `end3` entry in `app/src/levels/index.ts`.
3. Add `app/src/levels/end3/End3.tsx`, matching the lifecycle approach in `end1/End1.tsx`.
4. Port the prototype into `app/src/levels/end3/game/` and expose one factory:

   ```ts
   createGhostCapture(root, {
     onExit(): void,
     onFinish(result?): void,
     debug?: boolean,
   }) => { dispose(): void }
   ```

5. On the final completion screen, invoke `onFinish()` once. The app's existing `finishChapter('end3')` persists completion. Do not add a best-time record unless product direction later asks for one.
6. Add BACK TO MENU actions to intro, pause and final-completion overlays, wired to `onExit()`.

`Bridge.tsx` already sends the `'end3'` choice to `startChapter`, so no bridge routing change is expected once Ending 3 is registered and marked playable.

## Factory and cleanup contract

The standalone prototype currently owns the page. The app port must instead own only its supplied root.

- Build the prototype markup inside `root`; never query or mutate the global document by element ID.
- Scope CSS to `.end3` so its `canvas`, overlay, HUD and button styles cannot affect Chapters 1–2 or Ending 1.
- Route every `window`/`document` input listener through a local `on()` registry, then remove every listener in `dispose()`.
- Cancel `requestAnimationFrame`; clear timeouts if any are added; remove child DOM; dispose room geometries, materials and textures; call `renderer.dispose()` and `renderer.forceContextLoss()` as appropriate.
- Preserve a fixed 32 × 18 logical playfield. It is fine for the canvas to scale responsively with CSS, but preserve the prototype's pixelated rendering and aspect ratio.
- Use the app's installed `three` package. Do not copy `prototypes/vendor/` into `app/`.
- Keep `?test=1`/debug hooks app-local (for example `window.__end3`) and expose them only in dev/debug builds, following `window.__end1`.

## Gameplay that must remain exact

| Mechanic | Required behaviour |
|---|---|
| Movement | A/D or arrows move; W/Space/up jumps; S/down drops through thin ledges. |
| Switching | Q changes control between the green player and cyan ghost while preserving both positions. The inactive body has no horizontal input but still falls. |
| Acquisition | A scanner only locks when the ghost is inside its current cone **and** has unobstructed line of sight. |
| Locked gaze | Lock freezes sweep angle and patrol motion. The beam turns cyan. The ghost leaving the cone or solid cover releases it. |
| Danger | The green player is caught by either a red or cyan beam. The ghost is safe to inspect. |
| Occlusion | Solid platforms block sight; thin one-way ledges do not. |
| Reset | Falling or detection restarts the current room, resetting both bodies and scanner state. R retries. Esc pauses. |
| Finish | Only the green player can enter the exit. |

Keep all scanner variants implemented in the prototype: narrow/broad cones, patrol motion, full sweeps, opposed two-direction beams, and the rooms' distinct viewing angles. They are intentional level design, not cosmetic speed changes.

## Room sequence

| Room | Name | Primary idea | Theme |
|---:|---|---|---|
| 1 | Ghost Capture | Learn to put the ghost in the scanner's sight and move KAM through the resulting frozen angle. | standard |
| 2 | Under the Watcher | Lure a broad eye down from below while KAM uses the elevated route. | standard |
| 3 | Blind Side | The requested opaque block creates a genuine sightline blind side; the ghost and KAM use opposite sides. | standard |
| 4 | The Hinge | Cross the central divider crown, then relocate the ghost for the return stair. | Deep Archive |
| 5 | Moving the Goalposts | Repeatedly establish distinct locks while KAM waits in real safe pockets; includes a patrolling eye and opposed beam. | Deep Archive |
| 6 | Five Versions of the Truth | A five-pass relay with low tunnels, forced drops through thin floors, and multiple scanner angles. | Deep Archive |

The route documentation in `level4-notes.md` through `level6-notes.md` is private design material. Do not surface it in the game UI.

## Validation before merge

- Run the app unit suite and existing browser suite.
- Add a focused End 3 mount/unmount test: select E3, enter the game, return to menu, then repeat. Confirm that no duplicate listeners, animation loops, canvases or WebGL contexts survive.
- Add debug-level probes for: switching preserves positions; scanner acquisition needs both angle and line of sight; solid cover occludes; thin ledges do not; a locked cyan beam still catches KAM; reset restores the room; and final completion calls `onFinish` once.
- Inspect at least one screenshot each from a standard room and a Deep Archive room. Verify that the advanced artwork appears only in rooms 4–6 and that cone/player contrast remains readable.
- Play all six rooms manually. The old `prototypes/end3-ghost/smoke.mjs` completion routes for levels 4–6 are obsolete and must not be treated as proof of the redesigned rooms.

## Known handoff limits

- The level redesign received syntax, geometry/data and asset-load checks. Julius will provide human playtest feedback; it has not had an automated complete-route proof after the recent room revisions.
- There is no sound implementation in this prototype. Do not block integration on audio; add it later through the app's preferred audio path.
- The Deep Archive image generation provenance and runtime fallback behaviour are documented in `prototypes/end3-ghost/ART.md`.

## Acceptance target

From the start screen or PHASEONE choice, the player can select E3, complete the six-room Ghost Capture campaign, see the unchanged hollow `+0` conclusion, replay or return to the menu, and select another chapter without any lingering renderer or input state.
