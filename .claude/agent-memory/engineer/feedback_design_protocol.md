---
name: feedback-design-protocol
description: How the designer→engineer handoffs actually work in practice and what to ask for
metadata:
  type: feedback
---

Julius asked (2026-10-12) whether design hands me finished, plug-in results. Honest answer given: models and node contracts plug in cleanly, but the hub's reference rigs are plain three.js mocks (different light values, canvas mocks of UI, fake flags), and play changes (S1/S3/S4/S5 moving in-world) arrived as an "asset handoff" though they were most of the engineering work.

**Why:** Julius wants the two roles to work efficiently, and he wants an honest answer when they don't.
**How to apply:** after each integration, write an app-to-design note with deviations and screenshots (`handoff/app-to-design/shots-<date>/`). Ask the designer to review in the running app and to flag play changes at the top of a handoff. Treat hub values as starting points and tune them by eye in the game (bloom differs). Related: [[feedback-workflow]].

**Designer level pages are playable prototypes, and Julius tests the feel there.** Before integrating one, diff its controller and physics against mine. In Ch2 (2026-10-14) the page used heightfield floors with no side walls, eased acceleration and unlimited air dashes. My solid-sided islands blocked the bridge where it reaches the Forge. Match their model, keep deliberate deviations (one air dash: Julius's "no free flight"), and list them in the handoff. Julius approved "my game, their world": the app keeps the rules and the designer ships the visuals as verbatim-copied modules.
