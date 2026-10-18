# External engineer → Designer: Ch2 HUD/map and accepted Step 7 integrated

**What it is:** Delivery of `2026-10-14-ch2-hud-and-map.md` and `2026-10-14-ch2-step7-cutscene.md` in the running app. Author: **External engineer (Codex)**, working in the shared checkout on `main` at Julius's request.

**What changed since the last integration handoff:** The inherited HUD/map work is completed and checked; the accepted film replaces the placeholder. Forge/player-orb modules, updated sky/util, stills, post effect and adaptive quality are in. NPC/crowd parity remains explicitly open in the separate `2026-10-14-external-engineer-ch2-visual-gaps.md`.

**What the receiver must do:** Review the screenshots and the running app against the accepted references, especially the whole-chapter bloom and Step 7. Continue the outstanding asset exports; preserve the approved NPC/crowd designs described in the visual-gaps handoff.

**Open questions:** The remaining exports and world-map region contract are still needed (§4). No new story or art direction was chosen here. Earlier vibe-scene decorations have no confirmed keep/drop decision.

## 1. Integrated

- HUD kit: token bar, quest/sub-lines, thoughts, transcript typing/verbs, anchored NPC posts with ghosts, inventory sparks/decoys/consumption, poisoned badge/stamp/spread/vignette, hurt layers.
- Designer `map.js`: camera-heading minimap, area/altitude, full map on M, reached-pad clicks for quick travel. Esc remains reserved for pause; M/backdrop close the map.
- Ch1 token migration: the shared dark-green poison tokens are in; Ch1 uses `--color-violet` and keeps its purple appearance.
- Film: `world/step7.js` is the timing authority for both the store and views. `HUD_BEATS` fires once per run, including flag arrival at .7 s, montage highlights, spread at 21.3, struck/gone/local copy, subtitles, HUD return and final fade. Replays skip transient animations but apply the lasting poisoned/save state.
- Camera uses `camPose` with exact position/look/FOV, preserving the hard cut and shake. It targets the actual player-orb module's position, including the drop.
- Memory stills and `FlashbackEffect` use sRGB textures. The effect has its own pass after bloom + AgX. DOM memories use the director's gate echoes/focus/paper ramps and the **actual Ch1 prompt** from `ch1/config.ts`.
- Designer `forge.js` and `playerOrb.js` are used throughout Ch2. The film hangs the orb at `stage(layout)`, powers the forge down and keeps poison at its final value. Lasers/clouds/bits and ambient placeholder views are hidden in Step 7; island folder labels are off; bridges/islands remain.
- The forge's existing proof display and temporary flag-absorption view remain until the remaining forge slice arrives. No gameplay/collision changes were needed for the new models.
- All 11 exported world modules, HUD CSS and two stills are byte-identical to the current handoff assets (14 files checked). Icons/map and shared token/Ch1 CSS copies also retain their designer source.

## 2. Screenshots and review

Folder: `shots-2026-10-14-external-engineer/`. App captures are 1280×720, low tier, FX on, debug controls hidden:

| File | View |
|---|---|
| `01-gate-hud.png` | Live Gate, token bar, minimap and empty inventory |
| `08-full-map.png` | Designer full map and the reached Gate pad |
| `02-forge.png` | Step 7 at 3 s |
| `03-gate-memory.png` | 9.8 s: c03220 memory, MAY FAIL / CAUSAL |
| `04-paper-memory.png` | 15.3 s: Ch1 paper rule |
| `05-poisoned.png` | 24 s: orb and stamp |
| `06-local-copy.png` | 28.4 s: grey local copy |
| `07-subtitle.png` | 33.2 s: second thought |

`reference-02…06-*.png` capture the accepted `design/ch2-ui/cutscene.html` at matching times. They were compared visually: composition, memories, focus words, poison and cut framing follow the director. Random ring orientations, the live world clock and actual transcript history differ from the paused reference's synthetic history. The app wraps every non-rule prompt block in `.c2-mem__x`, as your handoff requests, so the Goal paragraph also blurs when the rule is focused.

To play: `npm run dev` in `app/`, choose **02 The Cache**. Add `?debug` and choose **7. poisoned** to review the film directly. The temporary review server is on `http://localhost:5176/?skipboot&debug` while this session's server is running.

## 3. Performance and validation

- DPR ≤ 1.5; high = MSAA 4, mid = MSAA 0, low = MSAA 0 / DPR .75. Canvas owns DPR, so HUD updates cannot accidentally restore the device ratio.
- PerformanceMonitor samples live frames and **only lowers quality during a chapter run**. Re-enabling a tier that had already missed the budget caused repeated buffer reallocations during the film, so the lower tier is retained until the chapter restarts. `?quality=high|mid|low` fixes a tier for reproduction.
- Both stills are uploaded early; the world materials and effect chain are warmed in an offscreen render before the film. Texture loading happens ahead of composer creation to avoid React 19/drei Html-root unmount errors.
- World and static HUD components are memoized. Their animation/physics still read the store per frame. This removed unnecessary scene reconciliation: live 1080p film playback went from ~48–52 fps to ~60 fps in the low tier.
- **Measured here, Iris Xe / Chrome Vulkan / 1920×1080:** fixed low held ~60 fps throughout all eight film time bins; one frame near the stamp took 33 ms. Automatic mode held ~60 at the Gate, briefly dipped to ~56–58 during memories while adjusting, then held ~60 at low. This is a measured target-machine result, not a guarantee for other hardware. Raw bins: `performance-low.json`, `performance-auto.json` in the screenshot folder.
- Tests: **50 unit passed; 8 browser tests passed** on the final implementation. The full browser suite also passed **40/40 across five repeated runs** before the final performance refinements. Final lint and production build (including TypeScript) passed. New browser tests exercise HUD/map interactions, pickup-consumption races, real FX passes/memories/poison/replay and DPR 2 capped to 1.5.
- The final screenshot run reports no page/console errors. `?nofx` still shows text and memory stills, with post effects disabled.

## 4. Still open

1. Rich NPCs/crowd, trails/pops/reset runners, Old Board, pickups, pads and ribbons: see the visual-gaps handoff. Julius asked to leave these highlighted as open work.
2. Step 0 tornado intro and audio, including the cutscene sound pass.
3. Remaining Step 6 proof/fold/flag-into-orb visuals.
4. Whole-game map regions: please send the planned sandbox/cache `regions[]` / `unlockedBy` contract. Engineering still needs cross-chapter travel and restoring the Ch1 room as left; current map export covers the Cache only.
5. Earlier vibe-scene decorations: shifting cube, tesseract/nested solids, data rain, far streams and optional depot debris remain uncertain rather than silently removed.

The app status/README and `app/EXTERNAL-ENGINEER.md` are updated. Existing implementation edits were preserved; no branches, worktrees or commits were created.

## Next reader

Designer, via Julius. This delivery supplements the separate visual-gaps handoff.
