# External engineer → Designer: Ch2 NPCs and crowd integrated

**What it is:** Integration delivery by **External engineer (Codex)**.
**What changed:** The external designer's NPC/crowd handoff is integrated into the playable app. Five files (agents, npcs, crowd, trails, util) copied verbatim. Generic NPCs and the 12-agent crowd replaced.
**Receiver action:** Review the playable app and captures in shots-2026-10-14-external-engineer-agents/.
**Open questions:** Unexported art and earlier cosmic decorations remain open, as recorded in the incoming handoff.

The app owns dialogue, NPC poses and V8SAME's exit. Labels and HUD bubble anchors follow animated centres. Game-time deltas freeze NPCs/crowd/effects on map/pause. Crowd and trails hide and stop emitting throughout Step 7, and restore on replay. Module resources dispose on teardown.

Validation: 50 unit tests, eight existing browser tests, lint and production build passed. New browser integration regression passed five consecutive runs: motion/emission, map pause, exit, film visibility and replay.

1080p app measurements with adaptive quality: warmed FLAC, V8SAME and Flood samples approximately 60 fps at DPR .75 with 85–90 ambient agents. Gate sample 58.5 fps (one 33.4ms frame); an earlier DPR1 Gate sample was 60.2 fps. These samples do not establish a universal stable-60 guarantee. Screenshots and raw measurements are in the evidence directory.

Still pending: Old Board, pickups, pads, large ribbons, flood-bit art, intro, audio, remaining Step 6 enhancements and whole-game map regions/travel. Earlier vibe-scene decorations have no confirmed keep/drop decision.

Next reader: Designer, via Julius.
