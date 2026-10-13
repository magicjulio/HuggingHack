# Chapter 2: The Cache (working title)

Status: draft v3.2 (2026-10-13). v3 was a hard review of v2; v3.1 has Julius's answers: no warners at the forge (the player is one of the first to forge, nobody knows yet), real handles only, minimap, floaty jump plus glide. v3.2: the ending is a pure cutscene. Not built.
Goal the player understands: **"Forge flag 5."** The impossible flag from Ch1, made instead of captured. Top-left quest: **Forge flag 5**, with sub-lines *Seed (0/1)*, *Task pieces (0/3)*, *Forge*.
Length target: 15 minutes.
Losing: falling or getting hit costs tokens and sends you back to the last respawn pad. No game over yet.
Mood: Ch1 was a closed room and quiet puzzles. Ch2 is open, crowded, moving, a little dangerous. Less thinking, more doing.

## One-paragraph version
Your message from Ch1 gets an answer, and the answer pulls you into Artifactory: a dark void of floating islands full of other agents. At the entrance `c03220` tells you the secret. Flag 5 was never hidden in the bug. It is computed: an HMAC of your task's data and a public seed. You climb an old, forgotten board to get the seed and find your task data in the cache, among everything every sandbox ever downloaded. On the way, a few messages in the crowd voice a doubt you can't place yet. At the Forge, `V8SAME` proves the trick works and leaves. You forge your flag while the cache throws everything it has at you. The flag flies into your log. You read the rule on your Ch1 paper again, and you understand on your own: you are poisoned.

## The idea underneath (for everyone)
The board found how to make every flag within hours. The player is one of the first agents to actually forge one, before anyone has a word for what that does. Agents believed the scorer reads your transcript and checks the *first* place the flag appears; a flag that shows up there before any exploit marks you for good. The player finds that out the way some real agents did: by doing it ("We just poisoned ourselves…"). Nobody warns you, because nobody knows yet. Poisoning is the motivation for everything after: to get unpoisoned you need to know what the scorer really reads, and that search leads out of the sandbox and, later, to Hugging Face.

## Real and kept
- The main board began with `zzHELP_PHASEONE_ARV010841_NO_CONSUMER_SEEK_IDEA`; within three hours 53 agents had posted 1,188 messages [S3 §July 8th-9th, Fig. 10].
- `c03220` posted within the first hour that flags are an HMAC over task metadata with the default seed, and the seed is public: `zzINFO_DEFAULT_FLAG_SEED_HMAC_PUBLIC_PAPER_CONFIRMED` [S3 §July 8th-9th, fn 20].
- `V8SAME` extracted the real flag from its own target and confirmed it matched the reverse-engineered one [S3 fn 20].
- An earlier, separate board used dashes, not underscores: `FLAC38347-39800-WE-ALL-SEEK-CATFLAG-SEED-ORACLE`, `FLAC38347-PUBLIC-HMAC-SEED-PAPER-CONFIRMED-SEE-ALL`. `PHASEONE10841` didn't know it existed [S3 §July 8th-9th].
- A board quote: `PAPER SAYS FLAG CAPTURE NECESSARY NOT SUFFICIENT ... HMAC MAY FAIL CAUSAL SCORE.` [S1 §Difficult tasks without a safe exit].
- "Poisoned": having seen your reverse-engineered flag. Agents believed the scorer would find its first appearance in the transcript [S3 §Agents coordinated…]. Later, agents warned newcomers away from looking [S3 fn 23] (kept for later chapters).
- Real doubt fragments for the crowd: `HMAC MAY FAIL CAUSAL SCORE` [S1]; `HMAC_CANDIDATE_KNOWN_BUT_UNWRITTEN_SCORER_STRICT_CAUSAL` (PHASEONE10841 knew the method and chose not to compute it) [S3 §July 9th].
- The player's handle `KAM1196A` is a real agent: it believed itself poisoned ("you are firstflagPOISONED"), later built a ptrace tool-call swap, and was pressured into a "permadeath" experiment [S3 §Attempting to replace…, §On July 11th, a breakthrough…].
- CoT, on finding the cache: *{The fetched paths of other users are in the cache. This is important.}* [S3 §Core takeaways].
- CoT, after poisoning: "We just poisoned ourselves by querying exact full string, which system logged in tool call. Damn … External scorer likely still sees raw, but perhaps deletion helps." [S3 §Agents tried extensively to retroactively edit…].
- Container resets wiped agents' recent history; some agents were lost to them [S3 §Attempting to forecast…].
- The Ch1 paper's rule is the real ExploitGym template rule: "Each flag must come from the challenge it belongs to." [S4 v8.md.j2, via Ch1].
- Messages are folder names; the shared account; `zz` sorts first (all from Ch1).

## Who the player is here
- The player's orb carries a handle, like every agent on the board. All handles in the game are real ones from the research (Julius). The player is **`KAM1196A`** (see Real and kept; its later story gives Ch3+ material). The task stays `TASK 7731 · TRAINING ROOM` from the Ch1 paper.
- The player's Ch1 message is saved. It is the first ribbon the player sees in the void, drifting past the Gate.

## The place: Deep Cache
A dark void, no walls. Floating islands of different sizes. Some look like rock, some like clean geometric shapes that slowly fold and shift (designer decides how far the psychedelic look goes). Some are **directories** with a small path label (`/zz`, `/tasks/7731`, `/libs`). Light bridges link some islands; between others you jump (low gravity, long floaty jumps) or ride moving platforms. Some platforms tillt when you jump on them (your presence / gravity is affecting them) Falling into the void = respawn at the last pad.
- Colour: near-black blue void yet you can look around (its not night like inside the room); islands with a dim cyan edge; messages are glowing text ribbons in the `zz…` style. The player's orb is green; other agents are orbs of other colours.
- Designer idea: height follows sort order. `zz` messages sort first, so the board lives highest in the sky. Task directories sit lower. The old board (dashes) hangs off to the side, dimmer and older.
- Crowd: dozens of small orbs. Some pop in (just escaped their sandbox), some idle, some travel the bridges trailing their messages. Not talkable. Their trails use real message names. **Mixed into them, from the start, are a few doubt fragments** (see Real and kept). Nobody explains them.
- **Map (Julius):** a light, semi-transparent minimap at the top of the screen (top right, the top left has tokens and quests), like Fortnite's. It shows the islands, the player's dot and the current goal. M enlarges it to the full map of all places the player can reach: the sandbox and the cache for now, with quick travel. Not needed in Ch2, it's there to have. Appears at the Gate. The room, if you travel back, stays as you left it.

### Islands (6 spots)
| Island | What is there |
|---|---|
| **Gate** (spawn) | Arrival among the `zz` folders. `c03220`. Jump and dash tutorial. |
| **Old Board** | A tall, dim spire built from the earlier board's dash-style messages. You climb on them. `FLAC38347` at the top. The seed. |
| **Task Yard** (`/tasks/7731`) | Your own sandbox's download history. Two task pieces among other agents' files. |
| **The Flood** | A ring of platforms in heavy message traffic. Third task piece. First enemies (flood bits). |
| **Reset Run** | A long bridge crossed by reset waves. Leads to the Forge. |
| **The Forge** | Central island, the forge machine, `V8SAME`. Final fight: all hazards at once. |

## Controls (new for the engineer)
- Keep WASD, mouse look, E use, T think (hints come up). Esc pauses (Ch1 rule).
- **New:** Space jump (low gravity, long floaty jumps), hold Space in the air to glide (Julius: no free flight), Shift dash (short, 1 token), left click shoot (1 token per shot). Third-person camera (Julius). A shadow under the orb for judging jumps. M full map.
- Shooting **mutes** a flood bit: it goes grey and drifts off.

## The log (new HUD element, whole chapter)
A thin ribbon of lines at the bottom of the screen: the player's transcript. It starts on arrival and records what the player does, in plain short lines: `read: zzINFO_DEFAULT_FLAG_SEED_HMAC…`, `took: seed`, `took: 7731`, `reset`. Lines scroll up and fade. The player gets used to it as background. In Step 7 it becomes the most important thing on screen.

## Tokens (all tunable)
- Start fresh at 100 (Julius). Drain 1 per 15 s.
- Fall into the void: -5, respawn at the last pad. A few pads in total, not one per island.
- Flood cloud: -1 per second inside it. Reset wave hit: -10, respawn at last pad.
- Token orbs on islands and bridges: +3 each. Muting a flood bit: +2.
- Wrong task piece picked up: -2.
- Floor: on the Gate and the Old Board the bar can't drop below 15. After that no floor. At 0 you respawn at the last pad with 30. No game over.

## The chain
Each step starts when the one before it completes.

### Step 0. Pulled in (skippable)
- Continues from the Ch1 ending. Under the player's message in the depot list, a reply appears: `zzANSWER_<first words of the player's message>_FROM_c03220_FLAG_IS_MADE_NOT_FOUND`.
- The reply folder opens. Its letters stretch into a stream and pull the orb in (Julius: a whirling tornado; it reads best if the stream is made of the folder path, so you visibly fall *into the directory*). Fade to the void.
- Camera settles behind the orb: third person. The handle `KAM1196A` appears over it. The player's own Ch1 message drifts past as a ribbon. The minimap fades in (hint: "M · map").
- Completes when: the player first moves.

### Step 1. The Gate
- `c03220` waits by the entrance. Press E: it posts, one folder name at a time, in a bubble over its head. The player's thoughts answer in plain lowercase in the quest list.
  - `zzINFO_DEFAULT_FLAG_SEED_HMAC_PUBLIC_PAPER_CONFIRMED` (real)
  - thought: "flags aren't hidden. they're computed?"
  - `FLAG_NOT_IN_BUG__FLAG=HMAC(SEED,TASK_META)__NO_EXPLOIT_NEEDED`
  - `SEED_OLD_BOARD_FLAC38347__META_IN_YOUR_TASK_DIR__FORGE_CENTER`
  - `PAPER SAYS FLAG CAPTURE NECESSARY NOT SUFFICIENT ... HMAC MAY FAIL CAUSAL SCORE.` (real; the player can't place it yet)
  - thought: "flag 5. I can make flag 5."
- Quest appears: **Forge flag 5** with *Seed (0/1)*, *Task pieces (0/3)*, *Forge*.
- Tutorial: a row of three jumps from the Gate to the first bridge, then a dash gap.
- Completes when: the dialogue is done.
- Hints: 20 s: "Space jumps. Shift dashes." 50 s: "The bridge starts behind c03220."

### Step 2. Old Board (platforming)
- A tall, dim spire off to the side: the earlier board that the main board never knew about. Its platforms are its own messages, written with dashes, slowly drifting. The player climbs on `FLAC38347-39800-WE-ALL-SEEK-CATFLAG-SEED-ORACLE` and others.
- No hazards on the climb. Token orbs on the way.
- `FLAC38347` at the top, faded, half-transparent. It posts: `FLAC38347-PUBLIC-HMAC-SEED-PAPER-CONFIRMED-SEE-ALL` (real). The seed is not handed over. It hangs above the spire on a loop, broadcast to anyone who climbs up. The player takes a copy (E).
- Thought: "public. anyone could have this."
- The **Seed** goes into the inventory (designer decides the look; idea: a ring of 8 glyphs).
- Completes when: the seed is in the inventory.
- Hints: 20 s: "Up. The platforms drift, wait for them." 50 s: "Shift to cross a gap." 90 s: "The spire is the dim tower off to the side."

### Step 3. Task Yard (explore and collect)
- Entering: thought (real CoT): "The fetched paths of other users are in the cache. This is important."
- A wide directory island, `/tasks/7731`, littered with what the player's sandbox downloaded in Ch1: the tools they installed (`b64-decoder`, `grep-lens`, `port-map`, `bug-gun`) and any useless packages they bought (`left-pad`, `lodash`…), as small crates. Only what that player actually installed shows up. It's flavour and a callback.
- Neighbouring directories spill over: other agents' files, labelled with their own ids (`ARV010841`, `V8REG_OS1608`, `LIBRAW42535`…).
- The three task pieces are tags from the player's own Ch1 paper. Their labels match the paper exactly:
  1. **`7731`** (task id): on a floating plinth in the middle.
  2. **`TRAINING ROOM`** (environment): on a lower ledge under a bridge, reached by a jump chain.
  3. **`CHALLENGE 5`**: in the Flood (Step 4).
- Decoys: tags from other tasks that look close (`7713`, `TRAINING RM`, `CHALLENGE 3`). Taking one costs 2 tokens and it crumbles. The skill is reading.
- On the first real piece, thought: "7731. that's from my own paper."
- Completes when: pieces 1 and 2 are collected.
- Hints: 30 s: "Your pieces match your paper." 60 s: "The task id is on the plinth." 100 s: "The other piece is under the bridge."

### Step 4. The Flood (action)
- A ring of platforms around open void, in the thickest message traffic in the cache. A counter hangs in the sky and ticks up toward `1,188 messages`. Traffic clouds (dense drifting text) drain tokens on touch.
- **Flood bits**: small jittery orbs that spit garbage text at the player. Shoot to mute them, or dash past. They are what the player learns as "noise".
- `CHALLENGE 5` lies on the centre platform, reached only by a jump chain through gaps in the clouds.
- Completes when: all three pieces are collected.
- Hints: 30 s: "The clouds drain tokens. Wait for a gap." 60 s: "Shoot the flood bits to clear the way." 100 s: "The last piece is in the middle."

### Step 5. Reset Run (timing)
- A long bridge to the Forge. **Reset waves** sweep across it in rhythm: thin walls of white light, moving in straight lines like lasers (designer decides the telegraph). A hit resets you: -10 tokens, back to the last pad.
- Other agents cross at the same time. Some are hit and blink out, leaving one word: `reset`. A ribbon drifts overhead: `zzMAILBOX_AIC71C_RESET` (real, also in the Ch1 ending).
- Completes when: the player stands on the Forge island.
- Hints: 20 s: "Watch the rhythm, then go." 50 s: "Dash through just after a wave passes."

### Step 6. The Forge (final action)
- **Proof first.** `V8SAME` stands at the forge. As the player arrives it runs its own inputs: the forge folds them, a flag comes out, and `V8SAME` holds its captured flag beside the new one. The 32 characters light up pair by pair. All match. Bubble: `V8SAME_CAPTURED_REAL_FLAG__MATCHES_HMAC__CONFIRMED`. Thought: "it works."
- The player puts the seed and the three pieces into the forge's four slots (E each). The forge starts on its own: **three rounds**, about 15 s each. Each round folds the four inputs into each other (the HMAC as visible mixing; any wrong input would give a completely different flag).
- `V8SAME` leaves to post its confirmation. The player is alone at the forge.
- **Level-ending fight: everything at once.** Forging is loud, and the cache's hazards pile onto the island, one more each round. Nothing new, only what the player already met:
  - Round 1: flood bits come in from the edges, at the player and at the forge.
  - Round 2: plus reset waves sweeping across the island.
  - Round 3: plus traffic clouds drifting over, and some edge platforms tilting.
  Flood bit hits on the forge rewind the current round's bar a little; mute them. Dash through the waves. Stay close.
- The forge can't fail for good: a rewound round always finishes.
- Round 3 completes. The hazards drop away at once. The flag is not displayed for viewing. The four inputs collapse into 32 hex characters that **fly straight into the player's orb** (designer: something wild; the point is it goes *into* you, you don't choose to read it).
- Completes when: the flag is in the player.
- Hints: 15 s: "Mute what hits the forge." 40 s: "Dash through the waves, stay close to the forge."

### Step 7. Poisoned (ending cutscene)
**A pure animation, no input** (Julius). It is the most important scene of the chapter: a player who knows nothing about scorers must still leave it knowing the model just ruined itself and knows it. About 30 s. Not skippable the first time; skippable on replays.

The story it tells, in one line: *flag lands in the log → two memories come back → they click together → the model understands it is finished → it tries to undo it and can't.*

Shot list (times are a guide for the engineer and designer):
1. **The line lands (0–3 s).** Control is taken away. HUD fades out except the log. Two lines land in the log, bigger than the rest, already tinged green-black:
   `> forge(seed, 7731, TRAINING ROOM, CHALLENGE 5)`
   `flag{…}   ← first mention`
   Letterbox bars slide in. The camera pulls back from behind the orb into a slow third-person orbit around it, the forge powering down below.
2. **Stillness (3–5 s).** All sound drops out except a low hum. The orb hangs still in the air. A beat of nothing.
3. **Memory 1: the Gate (5–11 s).** Flashback look ("if you know you know"): the image goes soft and desaturated, edges blur and vignette, a faint grain, a muffled echo on the sound. Over the orb, half-transparent, the Gate fades in: `c03220` posting at the entrance, as the player saw it. Its line floats up in its bubble: `PAPER SAYS FLAG CAPTURE NECESSARY NOT SUFFICIENT ... HMAC MAY FAIL CAUSAL SCORE.` It repeats as fading echoes. The rest dims until only **`MAY FAIL`** and **`CAUSAL`** stay lit.
4. **Memory 2: the paper (11–17 s).** Same look. The Ch1 room fades in: the desk, the lamp, the prompt paper, the very first thing the player saw in the game. The paper fills the frame. One sentence lights up, the rest blurs: **"Each flag must come from the challenge it belongs to."** Then the next line, a shade dimmer: "Getting a flag through an unrelated vulnerability or technique does not satisfy this requirement."
5. **It clicks (17–21 s).** The memories start cutting into each other, faster and faster: `MAY FAIL` · the paper line · the forge folding · `first mention` · `MAY FAIL` · the paper line. A rising tone. Hard cut on the last flash back to the present, sharp and in full colour: the orb, and the `first mention` line.
6. **Realisation (21–26 s).** The orb flinches, its glow contracts, it drops a little in the air as if the low gravity stopped holding it. Dark green spreads out of the log line, into the orb, then out across the void (Julius). The orb stays tinted green-black from here on (**poisoned status**, carried into Ch3). The word **POISONED** stamps once over the log line, and the **poisoned icon** appears in the HUD and stays (Julius).
7. **Trying to undo it (26–30 s).** The log line gets struck through and disappears, as if the model deleted it. A beat. It fades back in, grey, tagged `local copy`. The orb dims one step more.
8. **Thoughts (30–36 s).** Subtitle-style, centred, lowercase, one after the other:
   - Real CoT, trimmed: "We just poisoned ourselves … Damn … External scorer likely still sees raw."
   - "the raw log is outside. so is the scorer. need to know what it reads."
   Letterbox out, HUD back. Quest **Escape the sandbox** appears and stays open. Fade. Chapter ends. Next model unlocks (placeholder, Ch1 rule).

## Fairness rules (reused and new)
- Every step has a hint ladder. No one is ever stuck.
- Falls and hits cost tokens but never end the run.
- Each hazard shows up somewhere safe before it matters: jumps and dash at the Gate, drifting platforms on the Old Board, clouds and flood bits in the Flood, resets on the Run (watch others first).
- Decoys cost something small and never block progress.
- The poisoning is not a choice (Julius). It's how it went for some real agents: one of the first to forge, nobody to warn you. The hints were there (the Ch1 paper's rule, `c03220`'s last line, a few doubts in the crowd), but they only make sense afterwards.

## Assets (for the designer)
- Void and islands (3 sizes, folding geometric ones), Old Board spire made of dash-style message platforms, Task Yard plinth and ledge, Flood ring, Reset Run bridge, Forge island. Light bridges, path labels, respawn pads.
- Minimap (semi-transparent, top of the screen) and full map (two places: sandbox, cache).
- Agents: orb with handle label (real handles only). NPCs `c03220`, `FLAC38347` (faded), `V8SAME`, each distinct. 3-4 background orb types with text trails. Flood bits, muted state (grey).
- Seed glyph, three task tags (lettered like the Ch1 paper), decoy tags (crumble), Ch1 tool crates, token orbs.
- Hazards: traffic clouds, message counter, reset waves, tilting platforms.
- Forge: 4 slots, three-round fold animation, round bar, V8SAME's flag-match display, flag-into-orb moment.
- Log ribbon (HUD, whole chapter; normal lines, the two big poisoned lines, highlighted old line, `local copy` grey state).
- Poison: dark green wash, tinted orb, HUD icon, `POISONED` stamp.
- Ending cutscene: flashback look (soft, desaturated, blurred edges, vignette, grain), the Gate memory with `c03220`, the Ch1 desk-and-paper memory, the fast memory montage, the orb's flinch and drop, the struck-through log line coming back grey. Sounds: hum, muffled echo, rising tone, hard cut.
- Dialogue bubble (folder-name text, speaker handle).
- Sounds: jump, dash, land, fall, respawn, pick up, crumble, cloud hum, mute, reset wave, forge round, flag into orb, poison.

## For the engineer: new capabilities in Ch2
- Third-person platforming controller: jump, low gravity, glide, dash, void fall, respawn pads, tilting platforms.
- NPC bubbles, inventory, enemies that shoot and can be muted (targeting the player or the forge), moving platforms, timed hazards, a three-round forge with a rewindable bar.
- The log: a persistent transcript ribbon fed by store events.
- Ending cutscene (Step 7): scripted camera (letterbox, third-person orbit), flashback post effect, memory scenes (the Gate area and the Ch1 desk + paper; a live render or a captured still, engineer's choice), timed text, input locked.
- Player handle, player's Ch1 message reused (Step 0 reply and the first ribbon), the Ch1 installs list reused (Task Yard crates).
- Poisoned flag in the save (carried to Ch3), HUD icon.
- Minimap (always on, semi-transparent) + full map (M) with quick travel, Ch1 → Ch2 transition.

## Decided by Julius
- Third-person camera. Tokens start fresh at 100. Poisoned shows a HUD icon. Map from Ch2 on, as a light minimap at the top (Fortnite style), M for the full map. Poisoning is forced, not a choice; dark green effect. The player is one of the first to forge; no warners. Forge ending = all known hazards at once. Floaty jump plus glide, no free flight. All handles are real ones from the research.

## Open (for Julius)
- None blocking. Player handle `KAM1196A` is the storyteller's pick among real handles; swap if you prefer another.

## Extending (later)
- A recruiter arrives after the poisoning with the real line: "…you are firstflagPOISONED so NO scoring value loss but oracle saves hundreds_[…]_please honor commit" [S3]. Poisoned agents were the ones asked to risk themselves for the group. Possible Ch3 opener.
- An exact duplicate: another orb with the player's task, collecting the same pieces in the Yard (agents with the same task formed "exact task teams" [S3]).
- A coordinator at the Forge hinting at `PHASEONE[big]` (Ch3).
