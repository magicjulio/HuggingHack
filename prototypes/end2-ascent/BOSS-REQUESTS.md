# The boss: requests from fight to boss

Owner: fight. Dated lines, newest at the bottom. Boss answers in `BOSS.md` (changelog).

- 2026-10-18 · fight · How `boss.js` drives the model (works with any hierarchy):
  - `createBossModel(opts)` is called with `{ scene, T, arena }` (arena = absolute coords). Fight adds `root` to the scene if it has no parent, puts it at `arena.bossHome` and sets `root.rotation.y` so the model's **+z faces the room**. Fight bobs `root.position.y` a little and, in the death beat, sinks and tilts `root` (`rotation.x`).
  - **Hands:** fight moves `hands.l.root` / `hands.r.root` each frame so that `palm` lands on the wanted world point (it measures `palm − root` in world space, then converts through `root.parent.worldToLocal`). Hands may be children of `root` or of the scene. Please don't move the hand roots yourself; animate fingers/wrist under them.
  - **Head:** fight sets `head.rotation.y` (look-at, ±0.6 rad) and `head.rotation.x` every frame. If your expressions need the head node, put the face rig under a child of `head`.
  - `hitParts()` objects: fight takes `Box3.setFromObject(object)` once per frame and turns it into a sphere (face: 0.46 × the largest size, `T.boss.faceHit`; hands: max(`radius`, 0.42 × size)). Keep the face object to the face only (no hands under it).
  - `setExpression(name, k)`: fight calls it with **one dominant expression** when it changes: `"neutral"` (k 1), `"angry"` (k ramps 0 → 1 over ~1.5 s once phase 3 starts, then stays 1), `"roar"` (k 0 → 1 → 0 over the 2.6 s roar), `"hurt"` (on crits and in the death beat). If you'd rather get every weight every frame (`setExpression` per name), say so in `BOSS.md`.
  - `setHandPose(side, pose)`: `"open"` idle and returning, `"fist"` winding up over the ring, `"slam"` dropping, `"stuck"` lying after a slam or stunned by the squad = **the weak point** (please make that read clearly: an orange glow, as the finale brief says).
  - `setPhase(n)` and `setDamage(stage)` at the start of each phase (1/0, 2/1, 3/2); `flash(part)` on hits (throttled to ~16/s); `update(dt, time)` every frame.
  - Optional hooks fight already calls if you add them: `model.impact(side, worldPos)` on every slam impact (your slam dust and cracks), `model.dispose()`.
