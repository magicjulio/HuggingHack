# App → Design: Chapter 1 3D props are in the game

**What it is.** Feedback on `design-to-app/2026-10-12-ch1-3d-props.md`. The depot, the scorer eye and the scan plinth are integrated and working in the room, with in-world interaction.
**What changed since my last handoff** (`2026-10-11-ch1-greybox-ready.md`): the greybox depot, chute box and scorer sphere are gone. Those three objects are now your models. Everything else is still greybox.
**What you must do.** Nothing is blocking. Look at it live and tell me what's off. Answers to your open questions and my deviations are below.

## How to see it
`cd app && npm run dev`, choose The Room, then add `?debug` to the URL and jump to `3. flag1`. Walk left to the depot or right to the plinth, aim at it, and press E or click. Esc steps back.

## Answers to your open questions
1. **In-world interaction: feasible, built.**
   - Depot: the camera squares up to the screen (nudged right so the HUD doesn't cover it). The list is real DOM on `screen` via `<Html transform>`, 720 × 648 CSS px mapped to 2.0 × 1.8 m.
   - Plinth: the camera glides over the pad, a hidden input takes typing and paste, and each letter is a 3D glyph lying flat on the pad. On Enter the camera pulls back so the eye and the pad are both in view, and the scan runs with your timings.
   - Results: green slides into the slot, red falls apart, and the impossible flag scrambles and flickers.
   - I didn't use `occlude`: raycast occlusion hides the whole panel at once, and `blending` fights the bloom. Nothing stands between the player and the depot, so it isn't needed yet.
2. **Plinth vs chute:** still open with the storyteller. For now the plinth stands at the chute's spot `[5.4, 0, 2.0]`, `rotY −π/2`, with the eye above it at `SCORER_LAMP`.
3. **Depot bigger than the layout box:** fine, no need to shrink it. I grew the collider to the real footprint (x −6 … −5.31, z ±1.27).

## What I did with your values (and where I deviated)
- All node and material names from the handoff work as specified: `screen`, `beacon_lens`/`depot_beacon`, `tube_broken`, `depot_tube`, `hatch`, `eye`, `lid_*`, `ring_*_band/_nodes`, `tick_1..5`, `bulb` and the plinth's `top`.
  - The hatch opens after every finished install.
  - The ticks show the captured flags.
  - The eye follows the player and blinks every 3–8 s. It looks down at the pad while scanning.
- **Pad brightness:** while letters lie on it, the pad drops from 0.6 to 0.3. At 0.6 the cyan letters didn't read against it. Tell me if you'd rather solve it with the letter colour instead.
- **Letters:** cyan emissive at 2.4 (green on accept, red on reject, purple on the impossible flag). They're about 3 mm deep, with a 14 mm advance and 25 per line, 2 lines max (50 characters).
- **Font:** I generated the typeface JSON myself from your `jetbrains-mono-latin-700-normal.woff2` (`app/scripts/make-typeface.py`), so you don't need to supply one.
- **Post-processing:** bloom with threshold 1 and intensity 0.6, plus AgX tone mapping like your review hub. Reflections come from a local RoomEnvironment at 0.35 (0.05 while the room is dark).
- **Scan beam:** the same additive fan as your mockup, starting 0.2 m in front of the eye.
- **Floating labels:** hidden for the depot and the plinth, because the models speak for themselves. The crosshair prompt still names them.
- **UI kit:** `ch1-ui.css` is in the app (a verbatim copy, `app/src/levels/ch1/ch1-ui.css`), but so far only the depot screen uses it. Inside the screen I pin the `--fs-*` sizes (13/16/18/24 px) because the vw-based clamps make no sense on a 3D panel.
- **More packages:** Julius asked for every package to be listed from the start, plus real ones that don't help, so the depot now has 12 rows. I made the rows single-line to fit them without scrolling.

## Open questions
- Does the pad dimming under the letters look right to you?
- Next props: the remaining greybox is the room shell, desk, door and stations 1–5. Same pipeline and the same naming (`screen`/`bulb`/`paper`) work for me.

## Next reader
Designer.
