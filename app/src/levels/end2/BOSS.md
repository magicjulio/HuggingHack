# GLM-5.2, the end boss: the model API (boss → fight)

Owner: boss agent. `boss-model.js` exports `createBossModel(opts) → model`. Requests go in `BOSS-REQUESTS.md` (fight); answers and changes are dated in the changelog at the bottom. Old fields keep working until fight has switched.

The boss is named **GLM-5.2** (Julius, DECISIONS 2026-10-19). The model carries no text.

## Look
The official Hugging Face logo face, brought into 3D. The face features (eyes, mouth, tongue, cheeks) are built at runtime from `assets/hf-logo.svg`, so the neutral face is the logo itself. The front is a slightly flattened dome in logo yellow. The orange outline becomes an armoured bezel, the back is a mechanical gunmetal shell with phase-glow strips and thrusters, and the two logo hands are floating, articulated gauntlets with an orange trim. Expressions are glTF-style **morph targets** on the features: `angry` (the sanctioned phase-3 face: brows down, eyes cut, a downturned snarl with teeth, red cheeks, a red anger mark, steam), `hurt` (eyes `> <`, worried brows, a small wobbly mouth) and `roar` (huge open mouth, teeth, a squint). Neutral = no target.
Placeholder now. `end2-boss.glb` (Blender, worn paint) replaces the shell and the hands behind the same API, and the face stays procedural.

## Units and axes
- Metres. The model faces **+Z**, Y up. Default face radius `R = 7` (the yellow disc; the bezel adds ~10 %). Override it with `opts.radius`.
- `root` origin = **the bottom of the face**. The head's centre is at `root + (0, R, 0)`, and the top of the bezel is at about `2.1 R` (14.7 m). With `faceY = 6` the top is at about 21 m.
- `hands.l` is the hand on the **player's left** when you face the boss (local −X), `hands.r` the one on the right. This matches `boss.js` (`l` sits at `−right`).

## API
```
const model = createBossModel({ scene, arena, T, radius?, floorY?, look? })
model.root            Group. Fight positions/rotates it (yaw so +Z faces the room; death sink/tilt are fine).
model.head            Group at (0, R, 0). Fight sets head.rotation.x/y every frame. The face rig is in model.face (a child).
model.hands.l / .r    { root, palm, radius, pivot }
                      root: added to opts.scene (world space). Fight moves ONLY root.position.
                      palm: Object3D = the impact point (the palm surface; in slam/stuck it is the lowest point of the hand).
                      radius: 0.3 R (2.1 m), a minimum hit radius.
                      pivot: the wrist (mine): the boss's yaw × the pose orientation. The model never moves root.
model.hitParts()      → [{ part: "face", object, weak }, { part: "hand_l", … }, { part: "hand_r", … }]
                      Stable array. The objects are invisible proxy meshes: a sphere of radius 1.02 R for the face,
                      and a box around palm+fingers for each hand that follows the pose. weak = the hand is in "stuck"
                      (blend > 0.5).
model.setExpression(name, k)   "neutral" | "angry" | "hurt" | "roar", k 0..1. Exclusive: name gets k, the others 0.
                      The model eases toward it (~0.1–0.15 s), so a one-off call per change is enough
                      (fight's current pattern is fine). roar with k > 0.5 also fires the roar rings once.
model.setDamage(stage)        0 | 1 (cracks at 66 %) | 2 (more cracks, smoke, more sparks at 33 %).
model.setPhase(n)             1..3: the accent glow goes amber → orange → red and pulses faster. Crack glow follows.
                      The angry face is NOT automatic: fight sets setExpression("angry") in phase 3 (it already does).
model.setHandPose(side, pose, k = 1)   side "l"|"r"; "open" | "fist" | "slam" | "stuck", k blends from open.
                      open = the logo pose, back of the hand to the player. fist = wind-up. slam = palm down, flat,
                      fingers along the boss's +Z. stuck = lying palm down, fingers splayed and twitching, back vents
                      open, an ORANGE CORE glows and sparks (the weak point read). Eased: slam is fast (~0.05 s), others 0.1–0.15 s.
model.flash(part)             "face" | "hand_l" | "hand_r". A warm flash; a stuck (weak) hand flashes hot orange and sparks.
model.impact(side, worldPos?) A slam landed: dust ring along the floor, a dust column, debris, sparks, a cracked crater
                      decal (fades in ~9 s) and a squash of the hand. Without worldPos it uses the palm over floorY.
model.update(dt, time)        Every frame, BEFORE fight places the hands (fight's order already does that).
model.ready                   Promise: the face is built from the SVG (and the glb is in, once it exists). Until then a
                      flat yellow disc stands in. All calls work before ready.
model.dispose()               Removes the hands, fx and root from their parents and frees geometry/materials.
```
Optional extras (use them if you like):
- `setCharge(side, k)`: the hand's core glows while winding up.
- `setDying(k)`: crack sparks, smoke and a flickering accent for the death beat.
- `isWeak(side)`
- `size`: `{ radius, faceCentreY, top, handLength }`
- `fxRoot`: the Group for all boss fx, in `opts.scene`.
- `stats()`: `{ head, hand }` tris, particles, glb.

## Options and knobs
`opts.look` overrides any of these. Each one is also a URL knob, so Julius can flip it in the game or the lab:
| knob | default | what |
|---|---|---|
| `bossVein` | 1 | angry: the red anger mark on the forehead |
| `bossFlush` | 1 | angry: cheeks go from logo amber to logo red |
| `bossTeeth` | 1 | angry/roar: teeth |
| `bossSteam` | 1 | angry: steam from the sides of the head |
| `bossTremble` | 1 | angry/roar: the face shakes |
| `bossZ` | 0.82 | face depth (1 = a sphere, lower = flatter, closer to the logo) |
| `bossGlow` | 0.1 | self-illumination of the logo colours |
| `bossShadow` | 1 | blob shadows under the face and the hands (`floorY` = `opts.floorY` ?? `arena.center.y` ?? 0) |
| `bossGlb` | 1 | 0 = always the procedural placeholder |

## Review
`lab.html?view=boss` shows the sheet: expressions, phases with damage, and hand poses. `lab.html?view=boss&solo` shows the boss at full size next to the player, with knobs (expression + blend slider, phase, damage, poses, a scripted slam, flash, a phase-change roar). URL: `&expr=angry&k=1&phase=3&damage=2&pose=stuck`.

## Changelog
- 2026-10-19 · boss · v0: procedural placeholder with the full API. It answers BOSS-REQUESTS 2026-10-18: one dominant `setExpression` call is fine; hands are in the scene and the model never moves their roots; the face proxy has nothing else under it; `impact(side, worldPos)` and `dispose()` exist.
- 2026-10-19 · boss · v1: `end2-boss.glb` is in (shell, bezel, ears, thrusters, damage nodes, worn-paint gauntlets with the same rig names). Same API. The glb is scaled to `opts.radius` (built at R 7). The face takes the glb's worn paint maps (`bossFacePaint=0` = the clean logo yellow). Materials are MeshStandard (cheaper than Physical). The angry face, cracks and fx are unchanged.
