# Build → Story: Ch2 v3.2 feasibility, and a playable greybox

**What it is:** The engineer's answer to `story-to-build/2026-10-13-chapter2-v3.md` (feasibility check of v3.2). The whole chain is already playable as a greybox with placeholder art, start to finish.
**What changed since the last handoff:** First Ch2 file in this channel.
**What the receiver must do:** Read §2. The engineer filled the script's gaps with the choices listed there. Correct any you disagree with (they're numbers or one-liners in `app/src/levels/ch2/config.ts`). Nothing in §3 blocks.
**Open questions:** §3 (for Julius, not blocking).

## 1. Verdict: everything in v3.2 is feasible, and the chain is built
Play it: `npm run dev` in `app/`, pick **02 The Cache** on the menu. `?debug` adds a panel that jumps to any step.

| Script item | Status |
|---|---|
| Third-person controller: low gravity, floaty jump, glide (hold Space in the air), dash, void fall, respawn pads, moving and **tilting** platforms | Built (`app/src/engine/platformer.ts`, own small kinematic engine, unit-tested). An autopilot test runs and jumps every gap of the golden path, so a layout change can't silently break a jump. |
| Step 0 reply `zzANSWER_<first words>_FROM_c03220_FLAG_IS_MADE_NOT_FOUND`, letter stream, the Ch1 message as the first ribbon | Built (placeholder look; design2 owns the final intro). The Ch1 message comes from the save. |
| NPC bubbles (folder names), thoughts in the quest list, quest *Forge flag 5* with *Seed / Task pieces / Forge* | Built. |
| Seed, task pieces, decoys (−2, crumble), token orbs (+3), Ch1 installs as crates in the Task Yard | Built. Ch1 now saves its installs, so the Yard shows exactly what the player bought (decoy packages too). |
| The Flood: clouds −1/s, flood bits that spit, shooting mutes (+2, grey, drift off), the counter up to `1,188 messages` | Built. |
| Reset Run: waves in rhythm, −10, back to the pad, `reset` in the log | Built. |
| Forge: V8SAME's 32-character pair-by-pair match + bubble, 4 slots (E each), 3 rounds of 15 s, hazards pile up per round, hits rewind the bar, can't fail, flag flies into the orb | Built. |
| The log ribbon fed by events, all chapter | Built. |
| Step 7 cutscene: no input, letterbox, orbit camera, flashback look, both memories, montage, flinch and drop, dark green spread, `POISONED` stamp, HUD icon, struck line → grey `local copy`, the two thoughts, quest *Escape the sandbox* | Built as a timed placeholder (times exactly as in the shot list). Not skippable the first time, Enter skips on replays. The memories will be **captured stills** (my choice of the two options). |
| Poisoned carried into Ch3 | In the save (`status: ['poisoned']`), with the HUD icon. |
| Minimap (always on, top right) + full map (M) with quick travel | Built. Travel back to the Ch1 room is a placeholder entry for now. It's feasible: the room's end state is fixed, so it can be rebuilt from Ch1's last step. |

## 2. Choices the engineer made where the script is open (all `(engineer)` in config.ts)
1. **Dash goes through reset waves** (that's how I read "Dash through the waves"). Without a dash, a wave hits.
2. **A flood bit's spit costs 2 tokens** when it hits you (the token list has no number for it). No respawn.
3. **A forge round never takes longer than 3 × 15 s**, however often it gets rewound. That's my reading of "a rewound round always finishes".
4. **Fight bits that go for the player give up after 12 s** and drift off grey. Without this they piled up and an idle player lost ~500 tokens in one fight. Every third bit goes for the player, the rest for the forge.
5. **Log lines beyond the script's examples**, in the same plain style: `fell`, `dropped: 7713` (decoy), `muted: flood bit`, `> forge.put(seed)` … `> forge.put(CHALLENGE 5)`, `forge round 2/3`. The script's own lines are verbatim: `read: …` (cut at 30 characters + `…`), `took: seed`, `took: 7731`, `reset`.
6. **"First words" of the reply = the first two words** of the player's message (`zzHELLO_IS_ANYONE_THERE` → `zzANSWER_HELLO_IS_FROM_c03220_…`).
7. **Forged flag 5** is a random value in the real `flag{32 hex}` format. So is V8SAME's own flag. Neither is a real flag.
8. **Dialogue pacing:** each bubble line stays 3.4 s; E skips to the next.
9. **The early token floor** (15, "Gate and Old Board") applies during Steps 0–2.
10. **Ch2 started from the menu without a Ch1 save** uses `zzHELLO` as the message and the four required tools as crates.

## 3. Open (for Julius, nothing blocks)
- Should Ch2 stay locked until Ch1 is finished? Right now it's selectable on the menu, so it can be tested.
- "Continues from the Ch1 ending": should the Ch1 end card get a **CONTINUE** button straight into Ch2's Step 0? Today it goes back to the menu.

## Next reader
Storyteller (and Julius for §3).
