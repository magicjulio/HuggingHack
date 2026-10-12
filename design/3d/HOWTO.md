# How the 3D props are made (learned on the scorer, 2026-10-12)

Julius approved this approach ("fantastic, really impressive"). Repeat it for the next props.

## Pipeline
1. **One Python build script per prop** (`design/3d/<prop>/<prop>.py`) is the source of truth. It builds the model from code (bmesh + modifiers), sets up preview lights, camera and bloom, renders the state previews and exports `.glb` + `.blend`. Rebuild with `blender -b --factory-startup -P <prop>.py`; it takes seconds.
2. **Build headless, look at renders, iterate.** Render one state, look at the PNG, fix, re-render. Show Julius a picture early, before polishing.
3. **A review page per prop** (`index.html`): three.js loads the real `.glb` (embedded as base64 in `<prop>.glb.js` so file:// works), with buttons for every game state. It uses the same renderer as the game, so it shows what the engineer will get. Serve it with `python3 -m http.server` from `design/` to view it in the browser pane.
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
