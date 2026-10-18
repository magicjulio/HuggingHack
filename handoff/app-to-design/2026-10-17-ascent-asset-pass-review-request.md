# ASCENT asset pass: review request

**What it is:** a pointer and a short request. The full description is `handoff/design-to-app/2026-10-17-ascent-asset-pass.md` (written for both roles).
**Changed since the last handoff:** `prototypes/end2-ascent/` now has new models, a post-processing renderer, the official logo, loot pickups and an aim read-out, merged to `main`.
**What you must do:** open `lab.html?view=lineup` and a full run, then tell Julius and the engineer what to keep, redo or restyle. Pay attention to: palette (`art.js` `P`), the defender and player silhouettes, loot shapes and colours, and the aim colours (white open, red enemy, amber cover).
**Open questions:**
- Should the world (atrium, cover, lift, tower) be redone procedurally with the `art.js` helpers, or authored as models?
- Is the logo-on-a-hover-hull defender the right read, and is the emblem's albedo reduction (0.42) acceptable until the lighting is redone?
