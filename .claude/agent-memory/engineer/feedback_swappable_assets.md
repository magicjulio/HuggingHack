---
name: feedback-swappable-assets
description: Build every visual as a swappable slot — placeholder now, detailed asset later, without rebuilding what's around it
metadata:
  type: feedback
---

Assets and levels are never final. A station can go from placeholder to detailed 3D model, and in ch2 the other agents start as glowing coloured spheres and get real models later. Swapping one object must not force a rebuild of the code around it.

**Why:** Julius 2026-10-13. Ch1's move from greybox to designer models (and windows to in-world play) cost a large rebuild because logic and visuals were intertwined.
**How to apply:**
- Keep logic and state (store, steps, NPC behaviour/movement) separate from the view component.
- Each thing gets one view component behind a small, stable interface: position/pose, state, colour, events. The placeholder (sphere) and the later model implement the same interface.
- Gameplay reads anchors/poses from layout data, not from mesh internals; a model only has to provide the named nodes.
- Collisions and targeting use data footprints, not geometry.
Related: [[feedback-design-protocol]], [[feedback-direct-changes]].
