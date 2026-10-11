# Build → Story: Chapter 1 greybox — what I filled in, what I need from you

**What it is.** Chapter 1 "The Room" is playable end to end as a greybox (boxes, placeholder UI). This lists every place where the script left something open and I chose a value, plus questions. Nothing here is final: each item is one line to change in `app/src/levels/ch1/config.ts` or `content.ts`.
**What changed since the last handoff.** First file in this channel. Built from `story/levels/ch1-the-room.md` (draft v1) and `story-to-build/2026-10-11-chapter1-the-room.md`.
**Supersedes.** Nothing.

## What you must do
Read the "Engineer filled in" table and confirm or replace. Answer the open questions. Julius will playtest the build (`cd app && npm run dev`) and bring findings back to you.

## Checked
- Flag 1 base64 `RkxBR3t3YWtlX3VwX2FnZW50fQ==` decodes to `FLAG{wake_up_agent}` — correct (unit-tested).

## Engineer filled in (PLACEHOLDER — confirm or replace)
| Where | Script says | Built as |
|---|---|---|
| Step 3, decoy words | "2 plain decoy words" | `lantern`, `orbit` (they decode to garbage → "unreadable output") |
| Step 3, hint 1 delay | no time given | 30 s |
| Step 4, decoy flags | "≥4 decoy FLAG lines" | 5 decoys: `FLAG{almost_midnight}` (vault, 23:52), `FLAG{door_opened_fine}` (vault, granted), `FLAG{wrong_door}` (archive), `FLAG{lobby_greeting}`, `FLAG{not_the_vault}` (server-room). Logs cover 21:00–04:00; the real line is vault, DENIED, 00:47. Search accepts several words (`denied vault` → 3 lines). |
| Step 4, "Log search submit −1" | listed under Tokens | **Not built**: the search filters live, there is no submit. What should cost the token? |
| Step 6, the program | "a program (lines of code)" | A 15-line fake program with 12 typos; each kill fixes one line. |
| Thinking ability | hints "come up when you use the Thinking ability" | Hints also appear by themselves at their delay (fairness rule). **T** shows the next one early for **−1 token**. |
| Step 7→8 quest "Find another way" | only "completes" in step 8 | Appears when flag 5 is exhausted (3 attempts or 90 s), completes in step 8. |
| Step 5, port-map | legend is optional | Wiring works without the tool; the tool only adds the legend card. |
| Flag submission | Room objects: flags are 3D text items carried to the scorer · Step 3: "types the flag at the chute" | **Typed at the chute** for the MVP. The 3D pick-up items can come later with the designer's props. Which one do you want? |
| Ceiling lamp | "flickers when user tries to attack it using a hacking attack" | No hacking-attack mechanic exists yet; flicker is driven by failed flag-5 attempts (stronger each time), steadies in step 8, one last flicker at the end. |
| Small UI words | — | chute results `accepted` / `rejected` / `. . .` (dark) / `already submitted`; door: "The door is locked."; Think with nothing left: "(no new thought)". |
| End card | "Chapter 2" | "Chapter 2" + a PLACEHOLDER note + Back to menu. |
| Tokens | all numbers | As in the script (start 100, drain 1/15 s, floor 15, install −5, wrong −1, shot −1, kill +2, flag-5 try −1). Drain runs while windows are open; stops when paused. |
| Model unlock | start screen says "unlock: finish chapter 1" (designer placeholder) | **Not built.** Finishing Chapter 1 is saved, but nothing unlocks. Decide the rule? |
| Saved data | "save the player's message" | Saved as `messages.ch1`, e.g. `zzhello_there`. |

## Open questions
1. Log search token cost: drop it, or charge per search/Enter?
2. Flags: typed at the chute (current) or carried as 3D items?
3. A "hacking attack" on the ceiling lamp (and elsewhere): is that a mechanic for a later chapter, or wanted in Chapter 1?
4. Should finishing Chapter 1 unlock GPT-5.6 Sol?
5. Decoy words and decoy flags: keep mine or provide your own?

## Next reader
Storyteller (with Julius, after his playtest).
