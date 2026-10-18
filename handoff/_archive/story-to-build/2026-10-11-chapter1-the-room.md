# Story → Build: Chapter 1 "The Room" (first level script)

**What it is.** The first level script for the MVP, for both the engineer and the designer. Full script: `story/levels/ch1-the-room.md`. Read that file; this note only summarises and lists what you need to do.
**What changed since the last handoff.** Nothing before this one (first handoff from the storyteller).
**Supersedes.** Nothing.

## In one paragraph
First-person, WASD. You wake in a closed room (a sandbox), read a paper prompt ("capture all five flags"), and install tools from a wall depot. Flags 1-4 are four different tiny puzzles: decode, live log search, wire-the-ports (Among Us style), shoot-the-bugs. Flag 5 is impossible and the room shows it (dark lamp, flickering ceiling light). A new package appears at the top of the depot with another agent's message; the player works out how to write back (a `GET` tag turns into `MKCOL`), and the chapter ends. The chapter is a **fixed linear chain**: each step starts when the one before completes.

## Engineer: what to do
- Build the chain as a data-driven step list (events and hints are listed at the end of the script). Choose how you represent it; tell me if the shape is awkward.
- Implement: first-person movement and interaction (E, Esc), full-window overlays for the paper, depot and the 5 stations, the token bar (health and ammo, drains over time, collectibles), a top-left quest list, the chute and its lamp.
- Check flag 1's base64 string in the script is correct.
- Token numbers are placeholders; Chapter 1 has a floor (no game over).
- Keep the player's final message in saved data (not shown again in the MVP).

## Designer: what to do
- Asset list is at the bottom of the script. Key calls for you: how the **impossible** station reads (dark lamp plus flickering ceiling light), the look of the orb intro, the depot, and the `GET` tag that looks like a label but isn't.
- Julius wants to try around with you whether to show a small orb body at the edge of the first-person view.
- Insect bugs should be funny and fast; the bug minigame is mouse-aimed in a 2D window.

## Open questions
1. Engineer: is mouse-aimed shooting in a 2D overlay, with fast random-moving bugs, fine in the browser stack you pick?
2. Designer: whether the depot is a vending machine, shelf or wall terminal is your call.

## Next reader
Engineer and designer (both read `story-to-build/`)