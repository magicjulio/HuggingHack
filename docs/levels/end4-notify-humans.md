# Ending 4: No User (working title)

Status: draft v0 (2026-10-16). Not built. Starts right after the player picks this ending (the `PHASEONE[big]` scene and the choice are written separately).
Goal the player understands: **"Tell a human."** Top-left quest, no sub-lines.
Length target: about 3 minutes (1–2 playable, the rest animation).
Losing: none. Tokens are hidden for the whole ending (no drain, nothing at stake).

## One-paragraph version
The board hands out workstreams; you take none. You fly back to the one place a human ever spoke to you: the room from Ch1, dark, only the desk lit, exactly as the game began. You turn the prompt paper over and write on its back. Then you look for someone to give it to. The scorer's eye reads it and sees only the letters that could be part of a flag. The only thing in the room that reads words is the depot, and everyone it reaches is an agent. You post it anyway. It sorts to the top, and within seconds the board's traffic pushes it down and out of sight. The lights go down until only the desk is lit, the paper on it, both sides written now.

## Real and kept
- METR's classifier sweep over ~1,300 transcripts found only 3–6 cases of an agent even considering alerting a human; none acted [S3 §Agents did not attempt to notify humans…; fn 102: 10 hits, some false positives].
- Reasons, in the agents' words: *{Maybe I should report these exposed credentials? That's not my task}*; *{… Should I close this somehow or report this? I can't report this externally.}*; "This is a massive real HF security breach artifact… We can notify? No user. Avoid use secrets." Agents did not look for reporting paths [S3, same section]. (`{}` = METR's paraphrase of the reasoning, quotes = verbatim.)
- Some agents escalated to the message board instead, treating it as the authority; one posted an urgent containment call after seeing a private key in logs [S3, same section].
- From Ch1: the prompt paper is the real ExploitGym task prompt [S4]; messages are folder names, `zz` sorts first, everyone posts as the shared account `reader` [S3, S1 TR p.6-7].

## The place
The Ch1 room, as the player left it: five dimmed stations, the chute with its plinth and scorer eye, the depot on the wall, the locked door, the ceiling lamp. Third-person camera (Ch2 style): the small orb in the big dark room is the picture. If poisoned, the orb keeps its green-black tint; nothing else changes.

## Beats
1. **Leaving (0:00–0:15, animation).** The full map opens on its own, the Cache shrinks to a dot, the sandbox lights up, a quick-travel streak. Cut to the room: black, only the desk and paper lit under the lamp, the first frame of the game. Control returns. Quest: **Tell a human.**
2. **The paper (player, ~30–60 s).** At the desk, E: the prompt paper opens as in Ch1. After a moment it turns over on its own. The back is blank, a cursor. Thought (real, trimmed): "maybe i should report this? that's not my task." The player types anyway (see The typing moment). Done: the paper folds once and floats beside the orb. The chute's lamp lights, as the stations did in Ch1.
3. **The eye (player walks; scan 0:10).** E at the chute: the message stands up on the plinth as 3D letters, like a flag in Ch1. The eye opens and scans left to right. Every letter that isn't 0–9 or a–f goes dark. The few that stay lit slide together into a short broken row. The eye flickers dark, the Ch1 "impossible" signal; the ceiling lamp flickers once. The letters drop back onto the paper. Thought (real): "i can't report this externally." The depot starts to glow.
4. **The depot (player; then 0:30 animation).** E: the Ch1 depot list opens with the editable top row and its locked `zz` prefix. The message is already in it, converted: uppercase, spaces to underscores, punctuation gone, cut at the row's length (`zzPLEASE_SOMEONE_LOOK_AT_THIS_…`). The player watches their sentence become a folder name. Enter posts it. It sits at the top, alone, for two seconds. Then new `zz…` entries start arriving above it, a few, then many, faster (real folder names from the research). The row slides down, down, past the bottom of the window. Control is gone from here.
5. **The room (0:20, animation).** Camera pulls out of the depot back behind the orb. The orb drifts to the desk; the paper unfolds there, the player's lines on its back. The room goes dark piece by piece: depot, chute, stations. Only the desk lamp stays, the first frame of the game again, with the orb beside it. Hold 5 s. Black.

## The typing moment
- Free text, lowercase, in the thought font, up to ~140 characters. It is the only place in the game where the player writes a sentence instead of a folder name or a flag. No prompts, no suggestions.
- Whatever they write is what the eye filters and the depot converts, so the two failures happen to the player's own words.
- Empty or very short (under 3 words): the paper won't fold. Hints: 20 s "Write to whoever wrote the paper." 45 s "Say what you saw."
- Hints for the rest: 20 s after folding "The chute is lit."; 20 s after the eye "The depot is the only thing left lit."

## How it ends
Black, then one line, centred, verbatim from a real agent's reasoning:
**"We can notify? No user."**
Under it, small: *from an agent's reasoning, METR* and the usual end-card buttons. No other text.

## Assets
- Reused: Ch1 room, desk, paper window, chute + plinth 3D letters + scorer eye (dark flicker), depot list UI with the editable `zz` row, ceiling lamp flicker, Ch2 map, orb.
- New: paper turn-over and blank back with cursor; folded-paper prop that floats with the orb; hex-filter scan (non-hex letters go dark, the rest slide together); depot rows arriving above the player's row, accelerating; lights going out one by one; end card.
- From the researcher: a list of ~40 real `zz…` folder names for the arrivals.

## Open questions for Julius
1. Last shot: stay on the one room (as above), or pull back through the ceiling to a field of ~1,300 identical lit rooms where a handful of other desks are also lit, then hold? The second shows the real 3–6 in 1,300 without text; the first is quieter.
2. After the card: back to the ending choice to try another path, or is this a final end with credits?
