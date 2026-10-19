# ASCENT perf pass: 60 fps on the Iris Xe (2026-10-19)

**What it is:** the perf agent's pass on the ASCENT prototype (`prototypes/end2-ascent/`), aimed at the floor-3 boss arena on this machine's Intel Iris Xe.
**What changed since the last handoff:** `post.js` (new post chain + quality knobs), `floor3.js` (breakables merged), `main.js` (HUD writes, hidden-matrix skip, `T.fx.msaa`/`renderScale`, two test hooks). There are no glb changes, so no MANIFEST row.
**What the receiver must do:** Julius: play the arena once and answer "For Julius". Engineer: nothing (prototype only). The arena, fight and boss agents: the APIs are unchanged.
**Open questions:** see "For Julius".

## Results (deterministic replay: seeded fight, fixed-step tick, 10 s, real GPU, headless Chrome/Vulkan)
| place | res | before (HEAD) fps · GPU ms | after fps · GPU ms |
|---|---|---|---|
| arena phase 3 (wave 3 + boss awake, inside the arena facing the boss) | 1920×1080 | 36.6 · 24.4 | **55.7** · 15.3 |
| arena phase 1 | 1920×1080 | 35.8 · 23.6 | **55.9** · 14.7 |
| arena phase 3 | 1440×900 | 57.4 · 15.4 (36 slow frames) | **60.0** · 10.6 (2 slow frames) |
| arena phase 1 | 1440×900 | 55.7 · 15.3 | **60.0** · 10.4 |
| landing approach | 1920×1080 | 56.7 · 15.7 | **60.0** · 9.3 |
| floor 1 | 1920×1080 | 38.3 · 23.9 | **59.3** · 15.7 |
| floor 2 | 1920×1080 | 41.9 · 20.9 | **59.4** · 12.3 |
| floor 3 corridor | 1920×1080 | 37.6 · 20.9 | **59.9** · 12.6 |

Arena at 1080p with a knob (phase 3): `?res=0.9` **60.0** (GPU 12.5) · `?res=0.85` **60.0** · `?msaa=0` **60.0** · `?msaa=2` 57.6.
The numbers before the reboot (same machine, under load) were lower on both sides, but the ratio held: arena 1080p 25 → 42 fps.

## What was slow (profiled first)
- **Post-processing: ~10 ms GPU at 1080p.** The EffectComposer's full-screen passes (bloom blend, grade) each wrote into a **4× MSAA half-float target** and resolved it, which costs ~4.5 ms + ~3.8 ms for nothing.
- **Main pass: ~18 ms GPU at 1080p**, mostly per-pixel shading (PBR × 5 point lights + spot + hemi + sun + IBL + normal/ORM maps over ~2 M pixels). Neither overdraw (a depth pre-pass or front-to-back sort saved nothing), nor the vista window shader, nor anisotropy, nor a single mesh dominated.
- CPU: ~650 draw calls, a layout pass every frame from the HUD, and ~1200 hidden objects that still had their matrices updated each frame.

## Fixes (none changes the look by default)
1. **`post.js`: a fused post chain.** The scene renders once into a 4× MSAA half-float target, the bloom mip chain runs as before, then bloom-add + grade + ACES tone map + sRGB happen in **one** full-screen pass to the canvas (which no longer needs its own MSAA). The maths is the same; a pixel A/B against the old chain on the same frame differs by at most **1/255** (half-float rounding), including with hurt/aberration on. Post costs 10 → 2 ms. The old chain stays behind `?post=classic`.
2. **`floor3.js`: breakables merged.** All 9 coolant-cell cages are one mesh per material with a per-piece flag in the vertex shader, so ~63 fewer draws. The glass stays per piece (transparent sorting unchanged). `break()`/`reset()`/`b.group` work as before (FLOOR3.md changelog).
3. **`main.js` HUD:** `updateHud` writes text/styles only when they change. Layout went from 162 to 20 ms per 5 s.
4. **`post.js` `skipHiddenMatrices` (wired in `main.js`):** hidden subtrees of the world and the approach armada skip their matrix updates and refresh on the frame they show again. `updateMatrixWorld` dropped 77 → 35 ms/s. `?perfmat=0` turns it off.
5. Test hooks only: `window.__ascent.gfx` and `.renderer` (with `?test`).

Tried and dropped (no measurable gain, or a risk to the look): a light-skip shader patch, a depth pre-pass, front-to-back sorting, lower anisotropy, the boss gauntlets/shell as rigidly skinned merged meshes (−70 draws, but neutral in fps), and per-subtree culling.

## Checks
- Deterministic before/after frames of the arena (boss loaded): identical except one specular glint on a coolant cell (a sub-pixel highlight that flips with float rounding of the merged vertices).
- GPU screenshots of the arena and floor 2: 1.3–1.4 MB each (no flat frames), no console errors anywhere.
- `smoke.mjs` `START=arena PHASE=3` (GPU, human bot): **PASS**, boss → end card, no browser errors. The full chain run was not done (short tests only, as asked).

## Knobs (new)
- `T.fx.msaa` / `?msaa=0|2|4`: scene MSAA, default 4 (the current look).
- `T.fx.renderScale` / `?res=0.5..1`: render resolution, default 1.
- `?post=classic` (old chain), `?perfmat=0` (no hidden-matrix skip).

## What's left
- **1080p arena is ~56 fps, not a locked 60**, at the full look: the GPU is at ~15 ms mean, p95 ~20 ms. What remains is shading cost, which only a visible change removes (the knobs above), or fewer lights/IBL in the arena (an art call).
- Draw calls are still ~380–430. The actors (Warden ~49 meshes, gunner ~40) and the boss (hands ~43 meshes, 8 materials) are the bulk; a merge didn't pay off in fps measurements, so it's only worth it if the CPU becomes the limit.
- Transparent DoubleSide glass (doors, breakables) is drawn twice by three and re-checks its program each draw (~0.3 ms CPU). That could be fixed by splitting back/front faces.
- The camera inside a slammed hand (31 fps before) wasn't re-measured separately; the hands still aren't camera colliders (fight's item).
- Headless Chrome numbers; a headed check on Julius's browser would confirm them.

## For Julius
1. **1080p arena: 56 fps at the current look, or a locked 60 with `?res=0.9`** (10 % fewer pixels per axis, slightly softer) or `?msaa=0` (more jagged edges). `?msaa=2` gets 57.6. Which do you want as the default? Today's look stays the default until you say.
2. At 1440×900, and everywhere outside the arena, it now holds 60 at the full look.
