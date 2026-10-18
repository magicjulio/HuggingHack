# Designer → App: Ch2 Step 7 "Poisoned" cutscene (accepted), plus performance findings

**What it is:** The whole Step 7 cutscene, **accepted by Julius on 2026-10-14** ("exactly what I wanted … accepted right away"). It is built so you can drive it from your `cutT` with no re-typing:
- **The cutscene:** one pure director module (`step7.js`), one post effect (`fxFlashback.js`), two new world modules (`forge.js`, `playerOrb.js`), two memory stills, and the DOM classes in `ch2-ui.css`.
- **Performance:** measured, with two concrete changes for you (§5).

The live reference is `design/ch2-ui/cutscene.html`: 37 s, scrubbable, `?t=23&paused&closed`. It runs on exactly these files.

**What changed since the last handoff:**
- New files: `world/{forge,playerOrb,fxFlashback,step7}.js` and `memory/{gate,desk}.jpg`.
- `env.js`: the sky is now baked into a texture. Same look, about 4 ms less per frame at 1080p on an integrated GPU, in the whole chapter.
- `util.js`: the shared halo/atlas textures survive `dispose()`.
- `ch2-ui.css`: the cutscene classes are appended at the end; nothing above them changed.

**What the receiver must do:**
1. **Copy:** re-copy `assets/ch2/world/*.js` (env and util changed), `assets/ch2/ch2-ui.css`, and the new `assets/ch2/memory/`.
2. **Build Step 7 on `step7.js`** (§2). Please drop your placeholder cutscene instead of building your own version.
3. **Use the new modules:** `forge.js` and `playerOrb.js` replace your placeholder forge and player orb in the whole chapter, not just in Step 7.
4. **Quality** (§5): cap the pixel ratio and add an adaptive tier. Warm up shaders and upload the stills before Step 7.

**Open questions:** none. Sound for this scene comes with the sound pass (slice E). The flag flying into the orb (the end of Step 6) comes with my forge slice.

## 1. Files (`assets/ch2/…`, MANIFEST `ch2.cutscene` + `ch2.world.modules`)
| File | What |
|---|---|
| `world/step7.js` | **The director.** Data + pure functions of `cutT` (no THREE, no DOM). Exports `CUT` (= your `CUTSCENE`), `TEXT`, `stage(layout)`, `MEMORY`, `CAM`, `FORGE_SHOT`, `MONTAGE`, `montageShot(t)`, `camPose(t, centre, orbPos)`, `direct(t)`, `HUD_BEATS`. |
| `world/fxFlashback.js` | `FlashbackEffect`, a **pmndrs `postprocessing` Effect** (your 6.39.x): `uFlashback`, `uMemory` (`setMemory(tex)`), `uMemoryMix`, `uMemoryZoom`, `uPoison`, `uPoisonOrigin`, `uCut`, `uTime`. Put it in its **own `EffectPass` after Bloom + ToneMapping** (it uses CONVOLUTION, sampling the frame around each pixel). The GLSL is also exported as `FLASHBACK_FRAG`. Imports: three + postprocessing. |
| `world/forge.js` | `createForge({layout, U})`. State `{power 0..1, round 0..3, progress 0..1}`: the forge powers down (rings spin down, glow, beacon and light fade, with a last flicker). `slotPos` = `layout.forge.slotPos`. The colliders stay yours. The proof/fold/absorb phases come with my forge slice. |
| `world/playerOrb.js` | `createPlayerOrb({U, beats})`. `object` = the orb plus its floor shadow and ring. State `{pos (feet), grounded, glide, groundY, poisoned 0..1, cutT}`. `cutT` drives the flinch, the glow contracting, the drop and the dim at `local copy` as pure functions (scrubbable). `poisoned` = the green-black look; **keep it at 1 after Step 7** (Ch3 carries it). |
| `memory/gate.jpg`, `memory/desk.jpg` | The stills, sRGB (1920×1080 Gate from `?cam=gate-memory`, 1280×800 Ch1 desk). `MEMORY` holds the anchor points used for the DOM layers. |
| `ch2-ui.css` (end) | `.c2-lb` (letterbox, `.is-cine` on the stage), `.c2-mem--gate` / `.c2-mem__bubble` / `.c2-mem__w.is-key` / `.is-keep` / `.is-echo`, `.c2-mem--paper` (wraps the Ch1 `.c1-paper`) with `.c2-mem__x` / `.is-rule1` / `.is-rule2` / `.is-focus` / `.is-focus2`, and `.c2-subt` (subtitles on the bottom letterbox). Layering: canvas < `.c2-mem` (z 3) < `.c2-hud` (z 5) < `.c2-lb` (z 20) < `.c2-subt` (z 25). |

## 2. Wiring per frame (copy of `frame()` in the reference page)
```js
const ST = stage(layout, ORB.hover);                     // once: feet, hang (orb pos), centre (orbit centre)
const D = direct(cutT);
forge.update(t, D.shot === 'forge' ? dt * 3 : dt, { power: D.power, round: 3, progress: 1 });
orb.update(t, dt, { pos: ST.hang, grounded: false, groundY: ST.feet[1], poisoned: D.poisoned, cutT });
const c = camPose(cutT, ST.centre, orb.orb.position.toArray());   // {pos, look, fov}; includes the hard cut + flinch shake
fx.setMemory(stills[D.post.still]); fx.uniforms.get('uMemoryZoom').value.set(...D.post.zoom);
// uMemoryMix = D.post.mix, uFlashback = D.post.flashback, uCut = D.post.cut, uPoison = D.post.poison,
// uPoisonOrigin = the orb projected to screen uv (0..1, y up), uTime = t
// DOM: D.gate {opacity, keep, main, echoes[{opacity, dx, dy, scale}]}, D.paper {opacity, scale, focus, focus2}, D.fade (black, end)
```
- **Hazards:** the lasers, clouds and bits are gone in Step 7 (the script: they "drop away at once"). Islands and bridges stay, labels off.
- **Gate bubble position:** left = the still's anchor x + 4.5 % of the width; top = max(20 %, anchor y + 10 %). Both are taken after the still's zoom: `.5 + (a − .5) · zoom`.
- **Paper memory:** the paper shows the real Ch1 prompt (your `ch1/config.ts` `TEXT.prompt`). Wrap the two rule sentences as `.is-rule1` / `.is-rule2` and every other block as `.c2-mem__x`.
- **HUD beats:** `HUD_BEATS` is data. Fire each beat once when `cutT` passes it. The acts are `cine`, `log`, `setLog`, `tag`, `spread` (from the first-mention line), `stamp` (over that line), `poisonIcon`, `subtitle` and `end` (letterbox out, HUD back, quest **Escape the sandbox**). `text: 'FLAG5'` = your forged flag. When skipping on replays, jump past `spread` and `stamp` (they are transient) and apply the end state.

## 3. Timing (all inside `direct`, for reference)
| Time | What happens |
|---|---|
| 0–5 s | The forge powers down. |
| 5–6 s | The flashback look comes in. Gate still at mix .72, slow push-in. |
| ~9.4 s | Only MAY FAIL and CAUSAL stay lit. |
| 11 s | Desk still; the camera pushes in to the paper (zoom 1 → 2.6). |
| 12.4–13.2 s | The DOM paper grows to fill the frame. |
| 13.6 s | The rule lights. |
| 15 s | The second line lights. |
| 17–21 s | Montage: cuts 0.62 s → ×0.84 each → 0.09 s, in the order gate, paper, forge, line. |
| 21 s | Hard cut, white kick (`uCut`), orb flinch and camera shake. |
| 21.3 s | The HUD spread runs from the line (1.4 s). |
| 21.6–23.6 s | The orb is poisoned. |
| 22.1–25.6 s | `uPoison` spreads out from the orb. |
| 23 s | Stamp and icon. |
| 26 / 26.9 / 28 s | Struck / gone / `local copy`. |
| 30 and 33 s | The two subtitles. |
| 35.6 s | HUD back. |
| 36.1–37 s | Fade to black. |

## 4. Engine notes
- **Same pipeline as yours:** the reference page uses pmndrs too: `EffectComposer({frameBufferType: HalfFloatType})` → `RenderPass` → `EffectPass(Bloom{luminanceThreshold 1, mipmapBlur, intensity 1.1, radius .62}, ToneMapping AGX)` → `EffectPass(FlashbackEffect)`. Those bloom numbers are what Julius approved here; use them for the whole chapter if they match your current look.
- **Stills:** load them with `colorSpace = SRGBColorSpace`.

## 5. Performance (Julius asked: "will players' computers play this without lag?")
Measured on this machine's **Intel Iris Xe (integrated laptop GPU)**, at 1920×1080 and pixel ratio 1:

| | GPU ms / frame | Real playback |
|---|---|---|
| Before (sky live) | ~17 | — |
| **Now, full quality** (MSAA 4) | ~13 | ~45 fps (frames alternate between 16.7 and 33 ms) |
| MSAA off | ~9 | ~57 fps |
| 75 % resolution (MSAA 4) | not measured alone | ~57 fps |
| **MSAA off + 75 % resolution** | ~6–7.5 | **steady 60 fps** |

Cost breakdown at full quality:
- 4× MSAA on half-float buffers: ~3.5 ms
- islands: ~2.3 ms
- bloom + tone mapping: ~2.3 ms
- the flashback/poison pass: ~1.2 ms
- the sky (was ~4 ms): ~0.7 ms now

Triangles (~13k) and draw calls (~180) are not the problem.

**My recommendations (they affect the whole chapter, not only Step 7):**
1. **Cap the pixel ratio at 1.5, not 2.** Today it's `dpr={[1, WORLD_RENDER.pixelRatioMax]}`. A high-DPI laptop at DPR 2 renders 4× the pixels I measured, which is the real lag risk. (`RENDER.pixelRatioMax` stays 2 in my page; I leave it to you to change it in yours.)
2. **Adaptive quality** (drei `PerformanceMonitor`), in this order:
   - high: MSAA 4, DPR ≤ 1.5
   - mid: MSAA 0 (optionally SMAA)
   - low: MSAA 0 and DPR 0.75

   The low tier is slightly softer but reads the same (I compared frames).
3. **No hitches mid-film:**
   - Call `renderer.initTexture()` on both stills when Ch2 loads. Without it, the first desk frame costs about 35 ms once.
   - Compile the cutscene's effect pass and materials before Step 7, e.g. one offscreen render at chapter load. The first frame after loading cost about 70 ms here.

## Next reader
engineer.
