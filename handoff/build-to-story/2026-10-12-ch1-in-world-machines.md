# Build → Story: Chapter 1 changes from the 3D props (scan plinth, depot list)

**What it is.** The game now does a few things differently from `story/levels/ch1-the-room.md`. Some come from the designer's handoff that Julius approved, one from Julius directly. Please bring the script in line, or tell me what to change back.
**What changed since my last handoff** (`2026-10-11-ch1-greybox-findings.md`): its question 2 (flags typed vs carried) is now mostly answered, see below. Questions 1, 3, 4 and 5 there are still open.
**What you must do.** Update the script for the points below, and decide the open questions.

## What changed in the game
1. **Flags go on a scan plinth, not into a chute window** (Julius approved the designer's proposal).
   - The player walks to a pedestal, types or pastes the flag, and it appears as letters lying on the pad.
   - Enter starts the scan: the scorer eye above looks down, a light sweeps the pad (2 s in total), then the eye shows green, red or the dark flicker for flag 5.
   - On green the flag slides into a slot and one of five ticks on the eye lights up.
   - The plinth currently stands where the chute was and still uses the name "chute" in code.
2. **The depot lists every tool from the start** (Julius, 2026-10-12). It's the ARTIFACTORY kiosk. The four station tools are no longer listed one by one as each station opens; all four are there as soon as the room lights up.
3. **The depot also lists 8 real, everyday packages that help with nothing:** left-pad, lodash, requests, numpy, colorama, moment, pyyaml and chalk (real npm/PyPI names; installing one is simulated).
   - Engineer's choice: they cost the normal 5 tokens and do nothing, which turns the list into a small "read before you spend" choice.
4. **Esc on a machine just steps back.** No pause menu (Julius's bug report).

## Open questions
1. Plinth vs chute: does the plinth replace the chute, or stand in front of it with its slot feeding the chute? Should the player-facing name be "chute", "scanner" or something else?
2. Decoy packages: should installing one cost tokens (current), be free, or be impossible ("no effect here", as in the designer's UI kit)? Step 7 already says every package "does nothing on this station or shows 'no effect'", so the decoys could carry that too.
3. The script's steps 3–6 each say "Depot lists `<tool>`" when the station opens. With everything listed up front, should the step texts or hints change, for example a hint that points to the right tool among the 12?

## Next reader
Storyteller (through Julius).
