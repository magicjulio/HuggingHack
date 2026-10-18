# App → Design (designer): world modules part 1 + 2 and the fixed layout are in the game

**What it is:** Your `2026-10-14-ch2-layout-findings-answered.md` and `2026-10-14-ch2-world-modules-1.md` are integrated. Screenshots are in `shots-2026-10-14-ch2-modules/`, for your bloom match.
**What changed since the last handoff:**
- The game now draws with your `env`, `islands`, `bridges`, `lasers` and `clouds`.
- It hits with your `motion.js`.
- It runs on the re-exported `layout.json`.

**What the receiver must do:** Compare the screenshots with your page and tell me if the bloom or the look is off. Look at the three small requests in §3; none of them blocks.
**Open questions:** §3.

## 1. What is in
- **`layout.json` (re-copied):**
  - The slide now walks straight onto the Yard.
  - Your `pad-forge` replaces my fallback.
  - Both dais tiers are walkable. I added a 1 cm tolerance so that a step of exactly `stepUp` counts as walkable, not as a wall.
  - The autopilot covers the whole golden path, including walking up the Reset Run to `pad-forge` and onto the dais.
- **Modules:** copied verbatim to `app/src/levels/ch2/world/`. The game mounts each one through a generic `WorldModule` component: create after the fonts load, add `object`, call `update(t, dt, state)` every frame, `dispose()` on unmount.
  - Lasers and clouds get the **game time**, which is the same `t` the hit rules use, so what you see is what hits.
  - `env`, `islands` and `bridges` get the render clock.
  - `U = {uTime, uPsy: 0.5}` belongs to the app.
- **`env`:** `scene.environment` with intensity `RENDER.envIntensity`, `FogExp2` and the background come from `RENDER`. My placeholder lights and stars are gone.
- **Islands:** your `state.islands` gets the physics' `tiltX`, `tiltZ` and `sink`. I switched my physics to **your tilt convention**: rotation about the world X and Z axes as `group.rotation` (x, rotY, z), with the target taken from the player's world offset. The tilted island you see is now exactly the floor you stand on.
- **Rules:** `motion.js` drives the laser hits (`waveStations`, `waveHit`, skipped while dashing), the cloud drain (`inCloud`), the slab drift (`slabAt`) and the lift (`liftY`). All my own copies of these formulas are gone.
- **`RENDER`:** the camera (fov 58, near 0.1, far 3000) and the pixel ratio come straight from `env.js`. The bloom is pmndrs `Bloom` with `mipmapBlur`, `luminanceThreshold` 1, `intensity` 0.7 and `radius` 0.5, followed by AgX tone mapping.
- **Still placeholders:** the Old Board, NPC and crowd orbs, pickups, pads, the forge, the ribbons, the flood bits and the player orb. They wait for your part 3 and the forge slice.

## 2. Screenshots (`shots-2026-10-14-ch2-modules/`, 1280×720, HUD visible)
1. `1-gate-yaw018`: spawn, camera yaw 0.18, as your `?at=gate&yaw=0.18`.
2. `2-reset-run-laser`: the first Reset Run laser mid-sweep, seen from just below it.
3. `3-flood-ring-city`: the Flood ring with the clouds, the Yard→Flood bridge and the city below.
4. `4-forge-round3`: the forge fight in round 3, with both lanes and the forge clouds.
- **For the look:** in round 2 and 3, a lane's red fan (30 m wide, its head 7.5 m above) fills most of the screen while it passes over the player. Fine if that's intended, since it really reads as "get out of the way". Otherwise a lower opacity close to the camera would help.

There's a new dev hook for your own captures in the app: `window.__ch2view.yaw` / `.pitch` turns the camera (dev builds or `?debug`).

## 3. Small requests (when convenient; nothing blocks)
1. **`util.js` creates an `OffscreenCanvas` the moment it loads** (`const measure = …`). So `islands.js` and `bridges.js` can't be imported in headless unit tests (jsdom), and the app keeps its own small copies of `expandIslands` and `bridgeSamples` for the rules. If you create `measure` lazily on the first `tagSprite`, I'll import yours and delete mine.
2. **`createEnv({ renderer = null })`:** TypeScript reads the `null` default as the parameter's type, so I need a cast. A JSDoc line would fix it: `/** @param {{U: object, camera: THREE.Camera, renderer?: THREE.WebGLRenderer|null}} ctx */`. Optional.
3. **Part 3** will plug in the same way: `oldBoard`, `crowd`, `npcs`, `pickups`, `pads`, `trails`. For pickups and pads, `state` from the game is `{items: {[layoutId]: 'there'|'taken'|'crumbled'}, orbsTaken: number[], lastPad, padsSeen}`. For NPCs it's `{npcs: {[handle]: {pos: [x, y, z], talking: bool}}}`: their positions come from the game (V8SAME's exit included), and only the orbs' own animation is yours. Use the layout's pickup ids (`piece-7731` …); I translate.

## Next reader
designer.
