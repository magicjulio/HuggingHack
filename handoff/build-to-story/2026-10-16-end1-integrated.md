# Build → Story: Ending 1 (swing) is in the app

**From:** engineer · **To:** storyteller (designer: FYI) · **Date:** 2026-10-16
**Answers:** `handoff/story-to-build/2026-10-16-end1-swing-promoted.md`
**Supersedes:** nothing.

## What changed
- The swing prototype runs inside the game: start screen → **E1 "Cluster Run"** → the prototype's briefing → the run → finish screen. Code: `app/src/levels/end1/` (the prototype's modules, ported as they are; `clusterRun.js` is its `main.js` turned into a mount/cleanup factory).
- Gameplay, look, HUD texts and all tuning (`T` in `game/player.js`) are unchanged from `prototypes/end1-swing/`.
- App additions only: BACK TO MENU on the briefing, pause, fail and finish panels; the best time is kept in the game save (was the prototype's own localStorage key); finishing marks Ending 1 completed; leaving the level frees the GPU and silences the wind.
- Start screen: the old redacted Ch3/Ch4 rows are now **E1** (playable) and **E2–E4** (redacted, locked). The start button reads "start ending 1".
- From now on the app copy is the live version. Changes to the prototype folder will not reach the game.

## What the receiver must do
1. **The bridge from Ch2 to the endings is missing.** The Ch2 end card still says "PLACEHOLDER · next chapter not written yet" and has only BACK TO MENU. To build it I need the `PHASEONE[big]` scene script: what plays after Ch2's CONTINUE, how the board hands out workstreams, and what the choice looks like (four options, which texts, can the player go back, can a finished ending be picked again). Until then, endings are picked on the start screen. I see `story/levels/bridge-phaseone.md` (draft v0) is in progress. I'll build from it once it comes as a handoff.
2. **Moving enemies:** I'm not starting yet, because your handoff asks Julius's two questions first (lift from C/D or fresh design; sandbox-door opening yes/no). Send me the answers when you have them.

## Open questions
- Is **"Cluster Run"** the title you want shown? It's the prototype's working title. The meta line "ending · race to the cluster" is mine (engineer).
- Should E2–E4 show their names on the start screen once they're scripted, or stay hidden until the PHASEONE choice is reached in play?
- After the finish screen, what comes next in the story (an ending card, the real quote, credits)? Today it offers only RUN AGAIN / BACK TO MENU.

## Next reader
Storyteller (with Julius). Designer: the look is the prototype's for now; tell the engineer if you want to restyle the E1 HUD and panels to the app's UI kit.
