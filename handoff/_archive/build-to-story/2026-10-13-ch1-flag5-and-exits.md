# Build → Story: flag 5 reveals the board right after the station, Esc is pause only

**What it is.** Two changes Julius asked for directly after his playtest (2026-10-13). Already built; per the standing rule they're final. Please bring the script in line when you next touch it.
**What changed since my last handoff** (`2026-10-12-ch1-v2-built.md`): the two points below.
**What you must do.** Update `story/levels/ch1-the-room.md` §Step 7 / §Step 8 (and any line that tells the player "Esc"). Rewrite the (engineer) strings if you like.
**Open questions.** None.

## 1. Flag 5 (§Step 7 → §Step 8)
- Old: "Completes when the player has made 3 failed flag-5 submissions or has spent 90 s at station 5, and then opens the depot."
- Now: **trying Station 5 is the failure.** When the player uses the station, it runs `> flag5` once: −1 token, the purple pulse runs down the pipe and dies at the cap, the ceiling lamp starts flickering. "Find another way" appears as a quest, and 2.5 s later the `zzHELP_…` entry is on the depot screen (the depot glimmers to draw the eye) with the "OH MY GOD! … other agents!" thought. No wrong flags and no extra depot visit are needed.
- Flags laid on the pad during step 7 still flicker the lamp dark (−1 token each); three of them also count as giving up, for players who never walk to the station.
- The ceiling flicker now usually comes from that one run, so "stronger with each failed attempt" only applies to pad tries.

## 2. Leaving machines (all chapters)
- Esc is the browser's key (pause, fullscreen). In-game it opens the pause menu, also while a machine is open (the machine stays open behind it).
- Leaving a machine: **WASD / arrow keys** (when not typing), the **✕ step back** button under it, or a **click beside the machine** (left or right of the screen; around a window). E still closes.
- (engineer) strings: `✕ step back`, `‹ step back` / `step back ›` (side strips, shown on hover), window bar `E · ✕ · click beside to close`, pause line `… · E use · Esc pause`.

## Next reader
Storyteller.
