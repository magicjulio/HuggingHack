# Designer → App: Ch2 world modules, part 1 + 2 (env, islands, bridges, RENDER, motion, lasers, clouds)

**What it is:** The first world modules, as asked in `app-to-design/2026-10-14-ch2-world-as-modules.md`, in your order 1 and 2. `design/3d/ch2/level.html` now runs on them, pinned to `three@0.186.1`. Copies are in `assets/ch2/world/`, MANIFEST row `ch2.world.modules` (draft).
**What changed since the last handoff:** Everything below is new. The look is unchanged with one exception, a fixed laser bug (§4).
**What the receiver must do:**
1. Copy `assets/ch2/world/*.js` verbatim and keep the relative imports (`./util.js`, `./motion.js`).
2. Swap your placeholder sky, islands, bridges, lasers and clouds for them.
3. Use `motion.js` for your laser and cloud hit rules, slab drift and lift y, in place of your own copies.
4. Match `RENDER` in your post-processing.

**Open questions:** none. Part 3 (`oldBoard`, `crowd`, `npcs`, `pickups`, `pads`, `trails`) comes next.

## 1. Files (`ch2/world/`)
| File | Export | ctx in | state in `update(t, dt, state)` | Gives you |
|---|---|---|---|---|
| `util.js` | colours `C`, helpers, `tagSprite`, `glyphAtlas()`, `haloTex()`, `disposeTree` | — | — | shared by the modules |
| `env.js` | `RENDER`, `createEnv` | `{U, camera, renderer?}` | — | `object` (sky, stars, city grid, towers, 2 lights), `environment` (PMREM texture; you set `scene.environment` and `environmentIntensity = RENDER.envIntensity`), `city` (toggle) |
| `islands.js` | `createIslands`, `expandIslands(layout)` | `{layout, U, models: {s, m, l}}` (your loaded .glb scenes; they are cloned, never changed) | `{islands: {[id]: {tiltX, tiltZ, sink}}}` from your tilt physics | `list`/`byId` per island `{id, def, group, pos, top, R, rx, rz, zone, outline}`; `outline` = the world collider polygon (96 %). `labels` group. Shards bob on their own. |
| `bridges.js` | `createBridges`, `bridgeSamples(def)` | `{layout, U}` | — | `byId[id] = {def, samples, len, pts}`; `samples` = the walkable centre line (same as your adapter) |
| `motion.js` | `waveState`, `waveStations`, `waveLine`, `waveHit`, `slabBase`, `slabAt`, `liftY`, `cloudPos`, `inCloud`, `WAVE_CHARGE`, `WAVE_PAD` | — | — | **pure, no THREE**, points as `[x, y, z]`. Use it in your tests. |
| `lasers.js` | `createLasers`, `LASER_RED` | `{layout, U}` | `{lanes: bool}` = forge round ≥ 2 | `stations` = `waveStations(layout)`: the Reset Run lasers (`kind 'run'`) plus the two forge lanes (`kind 'lane'`) |
| `clouds.js` | `createClouds` | `{layout, U}` | `{forgeClouds: bool}` = forge round ≥ 3 | `list` (Flood clouds, then the forge ones) |

- **`U`** is yours: `{uTime, uPsy}` today (`uPsy` 0.5 = sky hue drift). `uPoison` joins with the Step 7 work.
- **Fonts:** the modules draw text with `OffscreenCanvas`. Load JetBrains Mono 400/700 and Chakra Petch 700 (`document.fonts.load`) **before** `createIslands`, or the labels fall back to a system font.
- **Hits:** `waveHit(station, [x, y, z], t, pad = 0.35)` returns whether the body is hit right now; skip it while dashing. `inCloud(c, p, t)` drives the token drain. Both use the same `t` you pass to `update`.
- **Dispose:** `islands.dispose()` frees only the labels and its cloned rim materials; your models' geometry stays yours.

## 2. `RENDER` (`env.js`)
```js
{ background: 0x03060d, fog: { color: 0x03060d, density: 0.0052 }, toneMapping: 'AgX', exposure: 1.0,
  outputColorSpace: 'srgb', pixelRatioMax: 2, camera: { fov: 58, near: 0.1, far: 3000 },
  bloom: { strength: 0.7, radius: 0.5, threshold: 1.0 }, envIntensity: 0.22 }
```
- The bloom is three's `UnrealBloomPass` on linear HDR before tone mapping. With pmndrs, start from `luminanceThreshold 1.0` and `mipmapBlur`, then send me screenshots from the same spots and I'll match by eye (`level.html?at=gate&yaw=0.18&clean`, `?cam=overview&clean`, `?cam=forge&clean&round=3`).
- Rule: only the player orb blooms.

## 3. The forge fight in my page
`level.html&round=2` turns on the two lanes across the forge island (the red line lies across `dir`, 30 m long, sweeping ±12 m). `&round=3` adds the forge clouds. My page hits with the same `motion.js`.

## 4. One fix you get for free
In the old page, the hot laser line lay **along** the bridge, while its fan and the hit rule ran **across** it (a rotation bug). The module draws the line across the bridge, as `notes.waves` always said. If your placeholder line follows the bridge direction, turn it across.

## Next reader
engineer.
