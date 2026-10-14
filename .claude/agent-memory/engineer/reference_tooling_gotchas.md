---
name: reference-tooling-gotchas
description: Tooling traps hit in this repo — zsh bare redirect hangs, prettier on CSS, drei Html root, headless GPU (Vulkan) for e2e
metadata:
  type: reference
---

- zsh: a bare `> file` runs `cat` (NULLCMD) and waits on stdin. Use `: >| file` to truncate. Don't `pkill -f` a pattern that also matches your own shell command line.
- `npm run format` (prettier on src) used to reformat all CSS, which broke the designer's verbatim copies. `app/.prettierignore` now excludes `*.css`; run prettier on ts/tsx only.
- drei `<Html>` creates its own React root: React context does not reach it (re-provide it), and pass an explicit `portal` or the root is recreated once R3F connects events and the panel can come up empty.
- Headless Chrome: SwiftShader (CPU) ran the room at 0.3–2 FPS → 15 min e2e. This laptop's Iris Xe works headless with `--use-gl=angle --use-angle=vulkan --enable-features=Vulkan` (~35 FPS, suite ≈ 30 s; `--use-angle=gl`/`egl` silently fall back to SwiftShader — check UNMASKED_RENDERER_WEBGL). Fast FPS exposes races slow FPS hid: Targeting rewrites `target` every frame (use `__ch1view.aim(id)` + wait for it), and assert on counted actions, not token totals. Run `--repeat-each=5` after changing e2e.
- React StrictMode runs `useMemo` twice in dev: anything that swaps a mesh's material inside a memo ends up driving a copy that isn't on the mesh (dormant screens glowed). Use the idempotent helpers in `levels/ch1/rig.ts` (`ownMat`, `setMat`, `uiScreen`). useGLTF caches scenes across replays, so read rest poses via `restOf`, never `node.position.clone()` at mount.
- Screenshots of the 3D room: temporary spec (kept in the job tmp as `zz-shots.spec.ts`) against `npx vite --port 5175`, 960×540, wait ~30 s per camera glide with fx on. `window.__ch1view.at(name, dy, dz)` gives a node's screen position for clicks/drags.
- drei `<Html>` mounted/unmounted inside a render logs "Attempted to synchronously unmount a root while React was already rendering" (React 19). Keep it always mounted with an explicit `portal` and toggle its children (ch2 `Anchor`).
- Ad-hoc GPU screenshots without a spec: a node script importing `app/node_modules/playwright/index.mjs`, `chromium.launch({channel:'chrome', args:[Vulkan flags]})`, dev server on 5175; pick a chapter by writing the save (`rogue-on-hf-save`, `{version:1,state:{save:{…}}}`) to localStorage, reload, press Enter on the start screen. `page.evaluate(fn, arg)` — don't drop the arg in a wrapper.
- Level reachability: `levels/ch2/reach.test.ts` autopilot (run to the edge, jump; glide/dash options; jump when the target is a step up). It caught slabs over the start platform (head bumps), a bridge attached to the wrong side and too little air control.
