# Important current problems

Reviewed on 2026-10-19. This is a code review of the current working tree, focused on the playable app, its levels, and its endings. No gameplay code was changed. Visual observations below come from the rendering, assets, markup, and styles; they have not been verified in a fresh browser playthrough. Ending 2 has source files, but is not integrated into the playable level registry.

The biggest issue is that the game shares a setting and story, but does not consistently share a presentation system. Different mechanics and moods can work well together; typography, character identity, UI behavior, and visual rules need stronger continuity.

## 1. The levels change visual language too fundamentally

**Importance: high — central design-coherence problem.**

Chapters 1 and 2 use 3D environments with bloom and AGX tone mapping. Cluster Run introduces its own 3D scene, materials, effects, and race HUD. Ghost Capture switches to an orthographic, sprite-based presentation with pixelated canvas styling inside a framed 16:9 area, capped at 1500px wide. The Letter returns to full-screen 3D with cinematic framing, grain, and a quieter paper interface.

The perspective changes are not inherently problems. The issue is that texture treatment, screen framing, lighting, character presentation, and interface styling change together. This risks making the endings feel like separate games rather than different parts of one world.

**Evidence:** `app/src/levels/ch1/Chapter1.tsx`, `app/src/levels/ch2/Rendering.tsx`, `app/src/levels/end1/game/clusterRun.js`, `app/src/levels/end3/game/ghostCapture.js`, `app/src/levels/end3/game/art.js`, `app/src/levels/end3/end3.css`, `app/src/levels/end4/scene.ts`, `app/src/levels/end4/end4.css`.

**What to do:** Define a short art-direction guide using Chapters 1–2 as the starting point: environment shapes, material detail, glow strength, darkness/contrast, character silhouette, and UI framing. Keep the side-view puzzles and cinematic letter, but translate them into that visual language. Decide explicitly whether pixel art belongs in this world; if it does, introduce and explain that representation before Ending 3. Review matching screenshots from every level together, rather than approving each level in isolation.

## 2. The shared design tokens do not actually govern all levels

**Importance: high — the main reason stylistic drift will keep returning.**

`tokens.css` defines shared fonts, colors, spacing, and panel shapes. However, Ending 1 defines another palette (`--g`, `--a`, `--r`, etc.) and puts the system monospace font before JetBrains Mono. Ending 3 uses its own system monospace stack, colors, buttons, and cards. The Letter uses the shared font variables but implements another set of overlays. These are differences in the basic interface vocabulary, beyond level-specific decoration.

**Evidence:** `app/src/styles/tokens.css`, `app/src/levels/end1/end1.css`, `app/src/levels/end3/end3.css`, `app/src/levels/end4/end4.css`; the Ending 1 and 3 markup/style comments explicitly describe preserved prototype interfaces.

**What to do:** Establish shared styles/components for titles, buttons, panels, key hints, objective labels, pause menus, and result cards. Make every level consume the existing tokens. Permit a small, named set of level-specific accents while preserving common meanings for danger, interaction, success, and poison. The plain-JavaScript scenes can share CSS classes and a React overlay host; this does not require rewriting their renderers.

## 3. The endings do not have a consistent sense of closure or navigation

**Importance: high.**

Cluster Run ends with “YOU REACHED THE CLUSTER,” timing statistics, and a prominent invitation to run again. Ghost Capture reuses its intro/pause overlay for “CAPTURE HISTORY COMPLETE. +0,” with replay and menu actions. The Letter has a longer cinematic conclusion, a dedicated “The end” screen, and “Return to the choice.” Endings 1 and 3 do not offer that direct return to the branch point.

The narrative outcomes should differ, but the completion hierarchy currently differs too: one feels like a race result, another like an attempt report, and another like the conclusion of the whole game.

**Evidence:** `app/src/levels/end1/game/markup.js`, `app/src/levels/end3/game/markup.js`, `app/src/levels/end3/game/ghostCapture.js` (`finish`), `app/src/levels/end4/End4.tsx` (end screen).

**What to do:** Give every ending the same outer completion structure: ending number/title, a clear narrative outcome, optional gameplay statistics, and consistent actions for returning to the choice, replaying, and returning to the menu. Preserve Ghost Capture’s intentional zero-score outcome, but clearly distinguish narrative completion from evaluation score. Let each ending retain its own cinematic content inside that structure.

## 4. The bridge offers a route to an unfinished ending

**Importance: high — concrete broken journey.**

The bridge can select `end2` and calls `startChapter(ending)` without checking availability. However, the chapter catalogue marks Ending 2 unplayable and the level registry has no `end2` component. `startChapter` does not validate the destination, so this route reaches the game host’s generic “PLACEHOLDER … is not built yet” screen. The start menu prevents selecting this ending, but the bridge does not.

**Evidence:** `app/src/levels/ch2/world/bridge.js`, `app/src/levels/bridge/bridgeScene.js` (`rideStep`), `app/src/levels/bridge/Bridge.tsx`, `app/src/data/chapters.ts`, `app/src/levels/index.ts`, `app/src/state/store.ts` (`startChapter`), `app/src/screens/game/GameScreen.tsx`.

**What to do:** Either finish integrating Ending 2 or clearly mark its route unavailable before the player commits. Use one availability check for both menu selections and in-world routes, with a safe fallback for unavailable destinations. Do not present a placeholder as a completed narrative choice.

## 5. The bridge breaks established control and pause behavior

**Importance: high — inconsistent interaction and missing escape route.**

The bridge uses its own movement controller and click-drag camera rotation after Chapter 2’s pointer-lock controls. It has no implemented Escape pause menu or menu-exit action. Its React wrapper receives `onExit` but never passes it into the scene. A player who wants to stop or leave at this point loses controls available in the surrounding chapters.

**Evidence:** `app/src/levels/bridge/Bridge.tsx`, `app/src/levels/bridge/bridgeScene.js` (input handlers and animation loop), `app/src/levels/bridge/markup.js`; compare `app/src/levels/ch2/Chapter2.tsx`.

**What to do:** Give the bridge the same pause/resume/menu behavior and camera conventions as Chapter 2. If any control must change, explain it at the handoff. Share the controller where practical and ensure pause stops the scene timeline as well as player movement.

## 6. Character appearance and carried state are inconsistent between scenes

**Importance: medium-high — weakens the feeling of playing the same character.**

The game host supplies the selected model’s name and color to each level. Endings 1 and 3 do not forward either value into their game factories. Cluster Run instead constructs a fixed-color orb and a hard-coded KAM1196A label; Ghost Capture also uses a fixed label and its own player artwork. The bridge hard-codes the poison icon and poisoned player state. The Letter, by contrast, reads saved poison status and uses the selected color when unpoisoned.

The bridge’s poisoned state may match the intended normal story path, but that assumption is embedded in presentation code rather than supplied through a consistent state contract.

**Evidence:** `app/src/screens/game/GameScreen.tsx`, `app/src/levels/end1/End1.tsx`, `app/src/levels/end1/game/clusterRun.js`, `app/src/levels/end3/End3.tsx`, `app/src/levels/end3/game/markup.js`, `app/src/levels/bridge/bridgeScene.js`, `app/src/levels/end4/End4.tsx`.

**What to do:** Define a common character-presentation input containing selected identity, accent color, and story status. Pass it into every scene, including the bridge. Decide whether KAM1196A is a permanent story identity or the selected model’s display name, and use that rule consistently. Adapt the same recognizable character features to 3D, side-view, and cinematic scenes.

## Suggested order of work

1. Close the unfinished Ending 2 route and add the bridge’s missing pause/menu controls.
2. Agree on the shared visual rules and compare representative screens from all chapters and endings.
3. Unify typography, buttons, overlays, and completion navigation through shared tokens and components.
4. Restore character/state continuity, then bring the world art and effects into the agreed style.
5. Play through Chapter 1 → Chapter 2 → bridge → each available ending, checking transitions, controls, identity, and completion screens. Repeat at a standard laptop resolution and an ultrawide resolution, where Ending 3’s framing will differ most visibly.

The target should be one recognizable game with different activities and moods. Shared UI, character identity, and art rules should remain visible even when the camera or mechanics change.
