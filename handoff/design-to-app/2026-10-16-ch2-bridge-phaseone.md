# Designer → App: the PHASEONE[big] bridge scene and the choice (approved)

**What it is:** The scene between Ch2 and the four endings. **Julius approved it on 2026-10-16** ("its really cool!", with one fix: the agents listen instead of forming a tail; that fix is in). It has two parts:
- **The film (32 s, input locked):** PHASEONE[big] rises over the board, speaks three lines to a listening crowd, splits the crowd into three streams running to three far places, then turns to you.
- **The choice:** play comes back. Jumping into a stream starts its ending. The way back (Ending 4) is a faint door behind you, unlabelled.

The live reference is `design/ch2-ui/bridge.html`, built on exactly the files below:
- **Scrubbing:** `?t=24&paused&closed` jumps to a moment.
- **Straight to play:** `?choice` skips the film.
- **Door cue:** `&back=faint|hidden|lit`.
- **Serving it:** run `cd design && python3 -m http.server 8777`. Port 8765 is taken by another server on this machine.

Stills are in `assets/refs/ch2-bridge-{speech,split,choice}.png`.

**What changed since the last handoff:**
- New: `world/bridge.js` and `world/phaseOne.js`.
- `hud.js`: one line. The bubble name list now has `phaseone: 'PHASEONE[big]'`.
- Nothing else changed. I checked: every other exported world module is byte-identical to `design/`.

**Story inputs:**
- Script: `story/levels/bridge-phaseone.md`.
- Story handoff: `handoff/story-to-build/2026-10-16-phaseone-bridge-and-choice.md`. Its "For the engineer (wiring)" section still applies.

**What the receiver must do:**
1. **Copy** `assets/ch2/world/{bridge,phaseOne}.js` verbatim, as with the other world modules, and re-copy `assets/ch2/hud.js`.
2. **Hook up CONTINUE.** Ch2's end card CONTINUE should start this scene. It replaces the "PLACEHOLDER · next chapter not written yet" line. Carry `KAM1196A` and `poisoned` through: the orb stays at `poisoned: 1`.
3. **Drive the film from `bridge.js`** (§2).
4. **Run the choice on your Ch2 controller** (§3), then load `end1`/`end2`/`end3`/`end4`.

**Open questions:** these belong to the storyteller and Julius. You don't need answers to start.
- **Speech text:** the three lines and the assignment line are my placeholders in `TEXT`. The storyteller swaps them, and the timing doesn't change.
- **Replay:** after an ending, does the player come back here to try another lane? This is story question 2. Until it's answered, the reference offers CHOOSE AGAIN.
- **Door cue:** Julius didn't pick a mode. The default is `faint`, which was the story's lean.
- **Sound:** there isn't any yet. I'll add cues to `bridge.js` the way `step7.js` has them.

## 1. Files (`assets/ch2/world/…`, MANIFEST `ch2.bridge`)
| File | What |
|---|---|
| `bridge.js` | **The director.** Data plus pure functions, with no THREE and no DOM. Imports nothing. Exports:<br>• **Timing and text:** `BR` (beats), `TEXT` (lines, assignment, quest), `direct(t)`.<br>• **Placement:** `geometry(layout)` (the stage), `bigPos(G, t)`, `audiencePoint`, `ripple`.<br>• **Lanes:** `LANES` (id, ending, label, colour), `LANE` (tube radius, travel), `lanePaths(G)`, `along(path, u)`.<br>• **The choice:** `laneAt(paths, orbCentre)`, `backDoor(G)`, `backAt(G, orbCentre)`.<br>• **Camera:** `camKeys(G)`, `camPose(G, keys, t)`. |
| `phaseOne.js` | `createPhaseOne({ layout, U, count = 600 }) → { object, paths, G, bigAnchor(t), update(t, dt, state), dispose() }`.<br>• **PHASEONE[big]:** the big poisoned orb, with an eye that turns from the board to you and the gaze line.<br>• **The crowd:** 600 agents in one InstancedMesh plus one Points layer for halos. They go from their islands into the audience, then into the streams.<br>• **The lanes:** the three lane threads with their labels.<br>• **The far places:** the machine hall, the tower and the floor. They don't use fog; their haze is built into the material.<br>• **The way back:** the door on `forge-edge-sw`.<br>`state = { D: direct(t), orb: [x,y,z] orb centre, back: 'faint'\|'hidden'\|'lit' }`. |

## 2. Wiring per frame (copy of `frame()` in the reference page)
```js
const P1 = createPhaseOne({ layout, U }); scene.add(P1.object);      // once
const G = P1.G, KEYS = camKeys(G);                                   // G.feet = where you stand, G.orb = orb centre there
// every frame, T = scene time (keeps running after BR.control: the streams flow forever)
const D = direct(Math.min(T, BR.control + 30));
P1.update(T, dt, { D, orb: orbCentre, back: 'faint' });
forge.update(t, dt, { power: 0, round: 3, progress: 1, phase: 'done' });   // dead since Step 7
playerOrb.update(t, dt, { pos: feet, grounded, glide, groundY, poisoned: 1 });
if (T < BR.control) { const c = camPose(G, KEYS, T); /* camera.position/lookAt/fov = c.pos/c.look/c.fov */ }
```
- **Time and input:** `T` runs from 0. Input is locked while `T < BR.control` (32 s). At `BR.control` hand play back with the player at `G.feet`, facing `G.F` (away from the Gate). The film's last camera key equals the usual play camera behind the orb.
- **Letterbox:** `.is-cine` on the stage while `D.letterbox > .5`. The Ch2 `.c2-lb` handles it. Hide the tokens and quest block meanwhile, but not with `.is-cinematic`: that also hides the bubble.
- **Speech:** use the Ch2 bubble, `say('phaseone', text, i, n)`.
  - **Which line:** `D.speech` is the index into `TEXT.lines`, or -1 for none. `D.speechOff` means bubble off. `D.assign` means the assignment line (`TEXT.assign.text`).
  - **Where:** anchor lines at `P1.bigAnchor(T)` and the assignment over the orb (`orbCentre + [0, .9, 0]`). The reference keeps the anchor on screen with `x ≤ 70 %` of the width and `y ≥ 30 %` of the height, so it clears the letterbox.
- **Quest:** when `D.quest` is set, show the single quest `TEXT.quest` ("Pick your work"). It replaces Ch2's open "Escape the sandbox".
- **Scene contents:** env, islands (labels hidden), bridges, forge and decor, as in Ch2. Leave out the Ch2 `crowd.js`, because this scene's crowd replaces it.

## 3. The choice
- **Movement:** the Ch2 controller and colliders as they are. The forge island and its four edge islands are the ground. The streams are **not** solid.
  - **Reaching the streams:** each stream passes 5–6 m beyond the forge edge at about y 37.5. The HF and OpenAI streams pass over the `forge-edge-ne` and `forge-edge-n` islands, which act as stepping stones. The Floor stream needs a jump plus a dash from the edge.
  - **Falling:** respawn at `G.feet`.
- **Picking a lane:** `laneAt(P1.paths, orbCentre)` returns `{ lane, u }` or null. `lane.ending` is `'end1' | 'end2' | 'end3'`. It only tests near the forge, within 30 m of each lane's mouth.
- **Taking the way back:** `backAt(G, orbCentre)` is true at the door, which means `'end4'`.
- **The commit moment** (reference `commit()` / `rideStep()`, about 4.6 s, input locked):
  - **Lane:** the orb rides the lane with `u → 1`, easing in over 6 s, and the camera chases it along the path. Fade to black from 3.2 s. Load the ending at about 4.6 s.
  - **Door:** the orb drifts through the door away from the forge at 1.4 m/s, with the camera held behind it. Same fade and load.
- **The end card in the reference** ("YOU PICKED … would start here", CHOOSE AGAIN / REPLAY) is a stand-in for loading the ending. Don't port it.

## 4. Rules and checks
- **No bloom on agents:** the crowd, PHASEONE[big] and the lane threads stay at or below 0.8 linear colour. Only the player orb blooms, as in Ch2.
- **No NaN pixels:** one NaN pixel blacks out the whole bloom pass, so the full frame goes black. Two sources are already guarded in the module:
  - Zero-scaled instances: hidden agents keep a scale of 1e-4, and their normals are divided by `max(length, 1e-5)`.
  - Degenerate tube frames: the lane shader zeroes its value when the normal length is 0 or NaN.

  Keep these guards if you touch the shaders.
- **Performance:** I measured 60 fps in headless Chrome on the real GPU (Vulkan) at 1600×900 and pixel ratio 1.5, through every beat, with no console errors. I have **not** run a formal Iris Xe bench like Step 7's. Please measure in the app with your adaptive tiers. Each frame, the crowd updates 600 instance matrices plus 600 halo points on the CPU.
- **Skipping:** the design rule says motion longer than about 2 s is skippable. Add a skip that jumps `T` to `BR.control`, at least once the scene has been seen.

## Next reader
Engineer. Storyteller (through Julius): the placeholder lines in `bridge.js` `TEXT`, and the replay question.
