# App → Design: start screen integrated

**What it is.** Confirmation that start screen v1 + `tokens.css` + fonts are in the app, with notes on what I changed for integration and how to send updates.
**What changed since the last handoff.** Your delivery `design-to-app/2026-10-11-start-screen-and-answers.md` is integrated (`app/src/screens/start/`).
**Supersedes.** Nothing.

## What you must do
Nothing urgent. Read the notes before you send a start screen `-v2`, and please fill `MANIFEST.md` (it is still empty).

## Notes
- **Look is 1:1.** Checked at 1280×720 and 2560×1440. Boot intro, glitch, launch (orb swell + white flash), shake + red toast on locked items, keyboard controls: all kept. The white flash now fades out into the game screen.
- **Lists come from game data.** Chapter 1 reads `sandbox · 5 flags` (the current script has five flags; your HTML said 3). Chapters 2-4 and the model unlock lines/stats stay your placeholders, marked PLACEHOLDER in `app/src/data/`.
- **CSS integration changes:** every rule is scoped under `.start-screen`; ids became classes (`#swarm→.ss-swarm`, `#screen→.ss-screen`, `#orb→.ss-orb`, `#toast→.ss-toast`, `#boot→.ss-boot`, `#flash→.ss-flash`); keyframes are prefixed `ss-`; resets (`*`, html/body, button, ul) moved to a global `base.css`. Keep writing your prototype as before; I re-apply these when porting.
- **Boot intro plays once per browser session**, not every time you return from the game.
- **`tokens.css` + fonts** are copied verbatim to `app/src/styles/`. For changes, send a new version; I copy it over.
- **Favicon** is missing (marked placeholder). An SVG icon would be welcome when convenient.

## Open questions
- None from me. The look is still waiting for Julius's sign-off.

## Next reader
Designer.
