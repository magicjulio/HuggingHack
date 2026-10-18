# External engineer → Designer: preserve the approved Ch2 NPCs and crowd

**What it is:** An audit requested by Julius: the game feels less alive than the approved world, especially its NPCs. Author: **External engineer (Codex)**.

**What changed since the last handoff:** The app is integrating the accepted HUD/map and Step 7 film, forge and player orb. Named NPCs, crowd and ambient trails remain engineer placeholders. Julius asked to highlight this as open work and continue the delivered integrations.

**What the receiver must do:** Export the outstanding `npcs`, `crowd`, `trails` and other part 3 modules under the existing world-module contract. Preserve the established designs and behaviours below. Review the earlier vibe-scene omissions separately rather than silently treating them as removed.

**Open questions:** The named NPCs and richer crowd are explicitly on the existing module backlog. The earlier cosmic scene's extra decorations have no explicit keep/drop decision that I found. Please identify what survives and bring any creative changes to Julius.

## Confirmed pending, not deliberately dropped

Source: `design/3d/ch2/level.html` (named NPC factories around lines 378–435; crowd around 674–740; animation loop around 884–930), `design/CLAUDE.md`'s world-module section, and `2026-10-14-ch2-modules-1-integrated.md` §3.

| Feature in the design | Current app | Needed export |
|---|---|---|
| c03220: icy orb, two rotating wire cages, eight orbiting HMACSEED letters, hover | Generic cyan orb and name | `npcs` |
| FLAC38347: faceted ghost, scanlines/flicker, slowly circling dashes | Generic faded orb and name | `npcs` |
| V8SAME: two gold cores orbiting, counter-rotating rings, equals sign | Single generic gold orb; exit movement exists | `npcs` (pose/exit remains app-owned) |
| Crowd: 70 agents initially, population changes up to 90; island wandering, jumps, bridge walks, posting | 12 agents moving slowly back and forth on bridges, static message labels | `crowd` |
| Typed message trails, movement trails, appearance/disappearance pops, Flood traffic packets | No matching trail system | `trails` / `crowd` |
| Seven Reset Run runners; laser hits blink them out and leave RESET | No matching runners | `crowd`, using pure `motion.js` for laser timing |

Keep the agreed no-bloom treatment for NPCs/crowd. These are presentation changes; do not make NPCs attack or alter player collisions, progression or controls. The existing handoff provides app-owned NPC poses, talking state, pickup states and pad states.

## Earlier vibe scene: intention uncertain

`design/3d/ch2/index.html` also contains a shifting cube island, the /tools tesseract, nested distant solids, data rain, far agent streams and optional rusty depot debris. I did not find these in the current walkable level/export or an explicit cancellation. Their sources are still present; I cannot establish that they are all planned for the final level. Julius has not identified which of the two prototypes he meant, so this remains an open comparison.

Other pending world modules in the existing plan: Old Board, pickups, pads and ribbons/trails. The Step 6 proof/fold/flag-into-orb visuals remain a later forge slice; the basic forge and poisoned player module are already delivered.

## Next reader

Designer, via Julius. This handoff records open work; it does not authorize new art direction or change the approved level layout.
