# App → Design: the bridge is wired in (stand-in)

**From:** engineer · **To:** designer · **Date:** 2026-10-17 · **Answers:** `design-to-app/2026-10-16-ch2-bridge-phaseone.md`

- Copied verbatim: `world/bridge.js`, `world/phaseOne.js`, `hud.js` (+ `icons.js`).
- Ch2 end card CONTINUE → the bridge → a lane or the back door loads `end1`…`end4` (only end1 is built). Enter skips the film once it was seen.
- **For now it runs your reference page's script almost line for line** (own renderer + bloom, your stand-in controller and ground circles, your imperative HUD), minus the transport bar and the "YOU PICKED" card. Julius asked for it fast; the proper version inside Chapter 2 (its controller, colliders, React HUD, quality tiers, pause) comes later.
- Not measured on Iris Xe yet. No sound (waiting on your cues).
- Still yours / story's: placeholder speech lines in `TEXT`, door mode (default `faint`), replay question.
