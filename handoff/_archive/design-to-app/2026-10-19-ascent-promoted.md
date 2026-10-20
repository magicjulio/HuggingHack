# Design → App: Ending 2 "ASCENT" is approved for integration (2026-10-19)

**What it is:** the promotion handoff for Ending 2 (the Hugging Face branch). Julius played the boss fight in Firefox and said "works great", and asked for the engineer to put it in.
**Source:** `prototypes/end2-ascent/` at commit `5336107` (round 4 + perf pass).
**Target:** `app/src/levels/end2/`, the `end2` entry in `data/chapters.ts` (today redacted, `playable: false`), the registry in `levels/index.ts`, and the bridge's `onPick('end2')`.
**What changed since the last handoff:** nothing in the prototype. This file collects the round-3/4 and perf handoffs into one port brief.
**What the receiver must do:** port it in the same way as Ending 1 and Ending 3 (below), add an e2e spec, and report back in `handoff/app-to-design/`.
**Open questions:** none. Story text stays a placeholder (see "Decided").

## How it plays (short)
Third-person squad shooter in three parts:
- **Landing:** a dropship approach with lasers and a hull, in 5 phases, then a landing cinematic that can't be skipped.
- **Floors 1 and 2:**
  - Floor 1 is the easy atrium and ends with a hold at the lift.
  - Floor 2 is an 8-section building with locked doors, defenders already in place, and checkpoints.
- **Floor 3 and the boss:** an express lift up to floor 3, a short corridor, then the arena with the end boss **GLM-5.2**:
  - It's the Hugging Face logo face with two floating hands that slam after a red floor ring.
  - The face and a downed hand take damage.
  - There are three phases by boss health (66 % and 33 %), each with a bigger wave, and the face is angry in phase 3.
  - When the boss dies there's a death beat, then the finish card.

Full rules and every knob are in `prototypes/end2-ascent/DESIGN.md`, `FLOOR2.md`, `FLOOR3.md` and `BOSS.md`.

## Port pattern (same as E1/E3: no R3F rewrite)
Keep the prototype's own imperative three.js loop, and wrap it the way `End1.tsx`/`End3.tsx` do: `createAscent(root, opts) → { dispose }`.
- **`main.js` is a top-level page script today** (~2500 lines, with module state at the top level, the DOM looked up by id and `window.__ascent` at the end). Turn it into the factory:
  - build the DOM from `index.html` as a `markup.js` string inside `root`;
  - send every listener through an `on()` helper and every timeout through `later()`;
  - `dispose()` cancels the rAF, removes the listeners, stops the audio, frees the GPU (`forceContextLoss`) and empties `root`.
- **Listeners** are in `main.js` (13), `audio.js` (4), `flight.js` (1, `mousemove` while pointer-locked) and `fx.js` (1).
- **Imports:** the prototype uses an import map (`three` and `three/addons/`). Rewrite these to `three` and `three/examples/jsm/…`.
- **three version:** the app pins `^0.186.1`, which matches. Keep it pinned: `post.js` reads two internal fields of the bloom pass, and `?post=classic` is the old chain as a fallback.
- **URL knobs:** many modules read `location.search` (`?floor=`, `?at=`, `?phase=`, `?test`, `?msaa=`, `?res=`, `?f2=`, `?f3=`, `?light=`, `?post=`, `?perfmat=`, the boss look knobs). In the app, either feed them from `opts.debug`, or leave them reading the URL. They're harmless, because every default is the shipping value. Your call.
- **App contract:**
  - `opts.onExit`: the menu buttons on the pause and end overlays.
  - `opts.onFinish(result)`: on the finish card → `recordBestTime('end2', time)` + `finishChapter('end2')`. The card already shows elapsed time, takedowns, call-ins and retries.
  - `opts.best`: the saved best time, shown on the card if you want.
  - `opts.debug` → `window.__ascent`: the prototype's test hooks, today behind `?test=1`. They include `beginFloor`, `toArena(phase)`, `startLift`, `balance` and `setPose`.
- **Styles:** `hud.css` plus the inline `<style>` in `index.html`, scoped under `.end2`. The fonts are in `assets/fonts/` (OFL).
- **Assets:** `assets/` is about 14 MB:
  - 13 glbs in `assets/models/`;
  - `hf-logo.svg`, the official logo, which the boss's face is built from at runtime;
  - the fonts.

  Rows are in `MANIFEST.md` (`end2.*`).

## Ship / don't ship
| Ship (game code) | Don't ship (design tools) |
|---|---|
| `main.js`, `flight.js`, `flight-combat.js`, `flight-hud.js`, `flight-kit.js`, `flight-sky.js`, `barrier.js`, `hq.js`, `world.js`, `floors.js`, `floor2.js`, `floor3.js`, `lift.js`, `building.js`, `encounter.js`, `actors.js`, `enemies.js`, `enemies-extra.js`, `projectiles.js`, `looks.js`, `fx.js`, `models.js`, `art.js`, `post.js`, `audio.js`, `boss.js`, `boss-model.js`, `index.html` → `markup.js`, `hud.css`, `assets/` | `lab.html`, `lab.js`, `labfx.js`, `boss-lab.js` (asset lab), `smoke.mjs` (headless bot run, the model for your e2e), `*.md` (copy `DESIGN.md` beside the port like E1/E3) |

## Decided (keep as is)
- **Look defaults:** `T.fx.msaa = 4` and `renderScale = 1`. Julius chose this on 2026-10-19: the current look at about 56 fps in the 1080p arena, rather than a locked 60. Everywhere else runs at 59–60 fps on the Iris Xe.
- **The landing** can't be skipped. Its length comes from the `T.flight` knobs.
- **Logo:** the official Hugging Face logo stays unmodified on the HQ, the defenders and the boss. The phase-3 angry face is the one exception.
- **Boss name** is **GLM-5.2** (DECISIONS, 2026-10-19).
- **Story text:** the end card and the room and sign names are placeholders, waiting for the storyteller. Port them as they are.

## Known issues (not blockers)
- The camera can clip into a downed boss hand, and hands that are down have no collision.
- The floor-2 test bot sometimes stalls at a door; it's a bot pathing issue, not a game bug. Expect flakiness if your e2e drives floor 2, and prefer the floor-3 and arena entry points.
- The squad interrupt of a slam has only been checked in code.
- All fps numbers come from headless Chrome on the Iris Xe. Julius played the boss in Firefox without complaints.

## Catalogue entry
- **E2 title (Julius, 2026-10-19):** `title: 'Ascent'`, `meta: 'ending · storm the tower'`, `playable: true`. E1 is "Cluster Run" and E3 "Ghost Capture".
