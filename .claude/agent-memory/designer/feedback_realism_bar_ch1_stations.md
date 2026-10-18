---
name: realism-bar-ch1-stations
description: Julius's quality bar for all 3D is the Ch1 flag stations' realistic, worn hard-surface look; dropship v0 is "great for now" but must get there
metadata:
  type: feedback
---

Julius, 2026-10-17, on ASCENT dropship v0: "great for now. note down this should later be more realistic looking like the flag stations in ch1 which looked fantastic we need that spirit for our project."

**Why:** the Ch1 stations (`design/3d/stations/s*_*.py`, `kit.station_materials()` / `kit.surface()`) are the look he loves: worn gunmetal carcass, off-white service panels with chipped paint, steel trim, panel seams, grime and normal maps generated with numpy, real modelled greebles, one glow accent in the dark. Clean, flat PBR (dropship v0: plain paint and no textures) is acceptable only as a first pass.

**How to apply:** for any new 3D asset (Ending 2 dropship, fleet, HQ, defenders, lift), plan a "realism pass" using the kit's texture synth: `surface()` with panel seams, chip, dirt, ORM + normal, and box-projected UVs. The fleet LOD can stay simpler, but the hero pieces need it. Keep albedo values tuned to the approach lighting (see [[bloom-nan-debug]] for the brightness checks). Related: [[feedback-visual-quality]], [[feedback-scorer-approved]].
