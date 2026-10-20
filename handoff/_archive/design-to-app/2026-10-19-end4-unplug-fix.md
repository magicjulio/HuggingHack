# E4 unplug shot: arm no longer clips the tower

**What it is:** a fix for the "they unplug it" shot in `app/src/levels/end4/scene.ts` (Julius saw the forearm pass through the PC tower).
**Supersedes:** nothing. Follows `handoff/app-to-design/2026-10-18-end4-letter-built.md`.

## Cause
The hand moved in a straight line from the researcher to the plug, so the forearm swept through the tower box (x 0.875..1.205, z -0.345..0.185) and ended with its corner inside the tower's rear edge.

## Fix (only `scene.ts`, the `office`/`end` branch and one camera pose)
- The reaching researcher (people[3]) steps 0.3 toward the tower's rear (film 31–34.6, legs swing); the shoulder anchor follows.
- Hand path is two-staged: out *behind* the tower first (waypoint 1.5, 1.12, -0.52), then in to the plug. Elbow stays at z ≈ -0.58, so the forearm never crosses the tower. Grip sits on the plug's rear half (z -0.45).
- Camera for film 35–40.5 moved from behind-right (it was almost inside the arm) to behind-left: `[0.5,1.28,-1.55] → [0.62,1.2,-1.4]`, look `[1.12,1.0,-0.5]`. The whole arm, grip and empty socket now read in one frame.
- Reduced motion keeps its fixed shots; the leg swing is skipped there.

## What you do
Apply `handoff/design-to-app/assets/end4/unplug-fix.patch` (`git apply`, checked clean against the current scene.ts) or copy `assets/end4/scene.ts` over it. Nothing else changes: no new assets, no timing change (film 35–40.5), `__end4` hooks untouched. Run the E4 e2e tests.

## Reviewed
Before/after screenshots at film 36–40 in `design/end4/shots/` (`before-*`, `cam-*`). Live preview of the fix without touching `app/`: from `app/` run `npx vite --config ../design/end4/vite.preview.mjs` → http://localhost:5175 (E4 uses `design/end4/scene.ts`).
Not measured: fps (geometry count unchanged).
