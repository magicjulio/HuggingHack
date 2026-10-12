# How the 3D props are made (learned on the scorer, 2026-10-12)

Julius approved this approach ("fantastic, really impressive"). Repeat it for the next props.

## Pipeline
1. **One Python build script per prop** (`design/3d/<prop>/<prop>.py`) is the source of truth. It builds the model from code (bmesh + modifiers), sets up preview lights, camera and bloom, renders the state previews and exports `.glb` + `.blend`. Rebuild with `blender -b --factory-startup -P <prop>.py`; it takes seconds.
2. **Build headless, look at renders, iterate.** Render one state, look at the PNG, fix, re-render. Show Julius a picture early, before polishing.
3. **One review hub for all props: `design/3d/index.html`.** It has an asset picker, a top-left board with controls per asset, and a bottom-left note (where it lives, status, next). three.js loads the real `.glb`s from base64 `<name>.glb.js` files, so file:// works; run `python3 design/3d/tools/embed.py` after every export. To add an asset: add a row to `ASSETS` (label, tag, where, status, next, controls, camera), add a `<script>` tag for its `.glb.js`, and add a view in `buildViews()`. Keep the status/next text current there, because that's what Julius reads. Serve with `python3 -m http.server` from `design/` for the browser pane.
4. Only after Julius approves: export to `handoff/design-to-app/` and add it to the manifest.

## What made it look good
- **Hard-surface detail from geometry, not textures:** armour plates with gaps (split a sphere into panels, shrink each one), solidify + bevel modifiers with harden normals, a bright metal trim against dark gunmetal hulls, small greebles (grip ring, fins, lips). glTF only carries plain PBR values, so detail has to be modelled.
- **One emissive accent that tells the state**, segmented (the iris is made of 32 glowing wedges), with dark around it. Glow reads best surrounded by darkness.
- **Moving parts as separate nodes:** lids, rings and the eye pivot, so motion can be driven in code (lookAt, blink, spin) instead of baked.
- Lighting: dark world, cool key light, cyan rim light, AgX, gentle bloom (threshold ≥1).

## Pitfalls hit
- An inner sphere hid the iris: check what sits in front of emissive parts.
- Triangle budget (<20k): keep sphere/lathe segments low (36×18, 48–64 around) and bevel segments at 1–2.
- Export: deselect everything first or the user's objects get exported. `temp_override(scene=…)` around the glTF export crashed Blender 4.3. Removing meshes in the live GUI session crashed it too, so build headless.
- The browser pane shows local files as data: snapshots, so relative files break. Use a localhost server.
- The Claude Blender extension doesn't speak the installed add-on's protocol. Use `design/3d/tools/bl.py` if live Blender is needed.
- Screens that get a texture in three.js need UVs: `bm.loops.layers.uv.new()` then `create_grid(..., calc_uvs=True)`. Set `tex.flipY = false` on a CanvasTexture applied to a glTF mesh.
- Glossy screens catch the preview key light and wash out. Use roughness ~0.65 and a low emission (~0.16), and let the UI texture carry the light.
- Preview-only props (floor, wall): export only `root` + `root.children_recursive`, not every mesh.
- Worn/rusty looks: generate textures in the build script with numpy (fbm noise → chipped paint over rust, vertical drip grime, dents → normal map). Wire them as Image → Base Color, ORM image → Separate Color (G→Roughness, B→Metallic), normal image → Normal Map, which is the pattern the glTF exporter understands. Box-project world-scale UVs per mesh (v = Z on walls so drips run down) and export with `export_image_format="JPEG"`. See `depot/depot.py`.
- `create_grid(calc_uvs=True)` silently writes no UVs unless a UV layer exists first (`bm.loops.layers.uv.new()`).

## Added 2026-10-12 (room + stations)
- **Shared kit:** `lib/kit.py`. Call `kit.reset(name, OUT)` first, then `from kit import *`. Use `kit.sc` (not `sc`) in prop scripts, because the star import copies `sc` while it is still None.
- **Glow export rule:** glTF drops the emissive colour when the strength is 0. `kit.export` raises every material made with `mat(..., em=…)` to strength 1 before exporting. Don't apply this to all materials: Blender's default emission colour is white, so everything would glow.
- **Headless browser check:** serve `design/` (`python3 -m http.server 8765`) and drive `/usr/bin/google-chrome` with app's Playwright (`executablePath`, `--use-angle=swiftshader --enable-unsafe-swiftshader`). It catches JS errors and layout bugs. Animation is under 1 fps there, so judge motion by numbers, not by screenshots.
- Prism profiles drawn in XZ and turned into a side panel need rotation +90° about Z (not −90°), or they end up behind the wall.
