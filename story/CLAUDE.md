# story/ conventions

Storyteller's folder. Creative work only, no code.

## Files: which script is live
| Level | Live spec | Status |
|---|---|---|
| Ch1 "The Room" | `levels/ch1-the-room.md` (v2) | built, accepted |
| Ch2 "The Cache" | `levels/ch2-the-cache.md` (v3.2) | built, "fine for now" |
| Bridge, PHASEONE[big] + choice | `levels/bridge-phaseone.md` (v0) | built as a stand-in; speech lines still placeholders |
| E1 "Cluster Run" | `prototypes/end1-swing/DESIGN.md`; bake-off in `levels/end1-prototypes.md` | integrated; moving enemies requested |
| E2 "ASCENT" | `prototypes/end2-ascent/DESIGN.md` + `FLOOR2.md`, handoffs `design-to-app/2026-10-18-ascent-*` | prototype team rounds; floor 3 + boss in progress |
| E3 "Ghost Capture" | `prototypes/end3-ghost/DESIGN.md`; pitches in `prototypes/end3-pitches.md` | approved, integrated |
| E4 "The Letter" | `levels/end4-the-letter.md` (v1, supersedes `end4-notify-humans.md` v0) | script written, waiting for Julius's review |

**Rejected, reference only. Don't build from them:** `levels/end1-openai-infra.md` ("Backstage" v0), `levels/end2-hugging-face.md` (warm warehouse v0), `levels/end3-beat-the-scorer.md` (Grading Floor v0).

Also:
- `julius-direction.md`: Julius's direction as short running notes, newest round at the bottom. Read it first.
- `julius-prompts/`: verbatim copies of Julius's long direction prompts.
- `end2-subagent-prompt.md`: the build prompt for the first ASCENT MVP (Gears of War + Helldivers as base games).

## Ground rules for this folder
- The game is inspired by the real incident, not a documentation of it. Creative freedom is intended (see `julius-direction.md`).
- Level scripts don't list where they depart from the real events (Julius, 2026-10-13: the metaphors are obvious). The game itself shows only a start-screen disclaimer. Real facts we keep still go under "Real and kept".
- Endings start from a known game's gameplay; several MVPs, Julius tests, the best survives.
- Handoffs to the engineer and designer go to `handoff/story-to-build/`.
- Whiteboard, not a log: replace the Status below, don't add dated sections.

## Status (2026-10-18)
- Story-side open items: what happens after the ASCENT boss (it must not claim the scorer files were found: `handoff/design-to-app/2026-10-18-ascent-floor3-finale.md`), the real PHASEONE[big] speech lines for the bridge, E4 v1 script ("The Letter") waiting for Julius's review, and whether endings 1–3 open by breaking the Ch1 sandbox door.
- An overview of the whole story mode is still to come.
