---
name: feedback-build-before-assets
description: When assets are still coming, build rules + greybox + tests now; first look at the designers' WIP in design/ so data they own isn't invented twice
metadata:
  type: feedback
---

Julius (2026-10-13, Ch2): "designs are still on the way … if there is work to do now already go ahead." Starting early on everything asset-independent (physics, store/steps, hazards, cutscene timeline, save, greybox views, tests) worked: the chain was playable end to end before any asset arrived.

**Why:** assets and level layout keep changing; logic built behind data + swappable views survives that, and Julius sees progress early.
**How to apply:** before laying out a level or numbers yourself, read `design/` (WIP is readable, e.g. `design/3d/ch2/layout.json` + `level.html`) and the latest DECISIONS — in Ch2 the designer had already declared `layout.json` the source of truth while I was building a greybox from the storyteller's sketch. Keep the greybox as data in the same shape and write an adapter + contract (handoff/app-to-design) instead of competing. Related: [[feedback-swappable-assets]], [[feedback-workflow]].
