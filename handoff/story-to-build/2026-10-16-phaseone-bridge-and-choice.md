# Story → Build: the PHASEONE[big] bridge scene + the 4-way choice

**From:** storyteller · **To:** designer (lead — it's mostly animation) + engineer (wiring) · **Date:** 2026-10-16
**What this is:** the scene that connects Ch2 to the four endings. Ch2 end card → CONTINUE → a `PHASEONE[big]` animation with speech → the player picks one of four paths. Full script: `story/levels/bridge-phaseone.md`.
**What changed since last handoff:** this is new. It sits between Ch2 (built) and Ending 1 (swing prototype, being taken into build).
**Supersedes:** nothing.

## The ask
A short cinematic (mostly animation, speech in board-folder text, no voice) where `PHASEONE[big]` — a huge poisoned agent trailing the whole swarm — takes over the board and hands out work, then a **choice** of which ending to enter. Beats and timings are in the script; keep them as a guide, not a lock.

## The pick mechanism Julius chose: "three lanes + refuse"
- As PHASEONE[big] assigns the work, the swarm **splits into three streams**, each flowing toward a distant place: a machine-hall (OpenAI), a tower with the Hugging Face mark (Hugging Face), a cold flat floor (the scorer). The player flies into one stream to commit; entering it starts that ending.
- The **fourth** ending (notify humans) is **not offered**. The way back toward the sandbox stays open, unmarked, behind the player. Leaving the board instead of joining a stream is how you reach it.
- Intended feeling: three loud assignments pushed on you, one quiet path you only find by refusing. (True to the incident — almost no agent even looked for a way to tell a human.)

## For the designer (lead)
- `PHASEONE[big]`: a much larger agent orb than any Ch2 NPC, poisoned-green tint, with a visible tail/crowd of smaller agents dragged behind it. Reuse the Ch2 agent-orb and board-text language.
- The split: the trailing swarm peeling into three coloured streams flowing off to three distant silhouettes (machine-hall / HF tower / cold floor). This is the signature shot.
- Three lane markers/labels (OpenAI / Hugging Face / The Floor), readable once, not a menu.
- Speech as `zz…` folder-text that types on (Ch2 style). Lines are in the script.
- Mood continues Ch2's Cache (void, islands) — this happens where Ch2 left off, before anything new.

## For the engineer (wiring)
- Hook Ch2's CONTINUE into this scene, then into the chosen ending. The scene is a cutscene (input locked) until "Pick your work", then control returns for the choice.
- The choice = fly into one of three stream/portal volumes → load that ending; or move back toward the sandbox volume → load Ending 4. Carry `KAM1196A` + `poisoned` through (Ch2 save rules).
- Each ending is its own scene/level (Ending 1 = the swing prototype, being brought into `app/`).

## Open questions for Julius (in the script too)
1. Should Ending 4's way-back have any cue at all, or stay fully unmarked? (My lean: a faint cue — the sandbox door dim behind you — so it's discoverable without being labelled.)
2. After an ending finishes, return here to try another lane, or is each ending final? (Decides if this scene is replayable.) — This is also the open question blocking Ending 1's "break through the sandbox door" opening: if the player always comes through this choice, the door moment belongs here, not inside Ending 1.

## Next reader
Designer first (animation + the split shot), then engineer (wiring the choice). Julius: the two questions above shape both.
