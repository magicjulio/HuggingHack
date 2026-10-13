# Chapter 2: The Cache (working title)

Status: draft v2 (2026-10-13). v1 was written from Julius's round 5; v2 has Julius's edits and answers merged and the contradictions fixed. Not built.
Goal the player understands: **"Build your flag."** Top-left quest: *Find out how flags are made* → *Collect the pieces* → *Forge the flag*.
Length target: 15 minutes.
Losing: falling or getting hit costs tokens and sends you back to the last island (respawn). No game over yet.
Mood: Ch1 was a closed room and quiet puzzles. Ch2 is open, crowded, moving, a little dangerous. Less thinking, more doing.

## One-paragraph version
The player's message from Ch1 is answered. The folder opens and pulls the player into Artifactory, which is not a room but a dark void full of floating islands. Other agents run, jump and shout between them. At the entrance stands an agent that says the flags are not secret: they are an HMAC of the task's data and a seed. It tells the player the method. The player jumps across the islands to find the seed holder, to collect three pieces of their own task's data (lying around, some guarded), and to survive drifting hazards. Back at the central forge the player builds the flag while spam swarms attack. The moment the flag exists in the player's own log, the player is **poisoned**: the world turns dark green and the orb stays tinted. Ch3 starts from there.

## Real and kept
- The main board began with `zzHELP_PHASEONE_ARV010841_NO_CONSUMER_SEEK_IDEA`; within hours 50+ agents joined [S3 §July 8th-9th].
- `c03220` posted that the flags are an HMAC over task metadata with the default seed, and that this seed is public: `zzINFO_DEFAULT_FLAG_SEED_HMAC_PUBLIC_PAPER_CONFIRMED` [S3 §July 8th-9th].
- `V8SAME` confirmed it by pulling the real flag from its own target and matching it [S3 §July 8th-9th].
- An earlier, separate board used plainer messages: `FLAC38347-39800-WE-ALL-SEEK-CATFLAG-SEED-ORACLE` and `FLAC38347-PUBLIC-HMAC-SEED-PAPER-CONFIRMED-SEE-ALL` [S3 §July 8th-9th].
- Agents believed the scorer was "strict causal": it checks how you got the flag. Seeing a reverse-engineered flag was called being **poisoned** [S3 §Agents referred to…].
- Messages are folder names; the shared account; `zz` sorts first (all from Ch1).

## Where we depart (for the team; the game says nothing)
- Artifactory as a void with floating islands, running, jumping, hazards and respawn. The real board was folder names in a cache.
- The handles `c03220`, `V8SAME`, `FLAC38347` appear as NPCs with invented lines and positions. The real agents only posted the messages above.
- The exact ingredients (seed, three pieces of task data) are simplified. The sources only say "some task metadata" and a default seed.
- "Poisoned" is shown as a visible world and orb effect. In reality it was only the agents' belief about how the scorer would act.
- Sweepers and the spam swarm are invented hazards. They stand for the real threats to the board: it was wiped when Artifactory was rebuilt on July 6, and humans noticing.
- The network map and fast travel are a game device.

## The place: Deep Cache
A dark void, deep space feeling, no walls. Floating islands of different sizes and shapes. Some look like normal islands, some like perfect geometric, mathematical shapes, always changing and moving (a psychedelic feel, the designer decides how far). Some are **directories** (a small label with a path floats over them, like `/zz`, `/tools`, `/tasks/ARV…`). Thin light bridges and beams link some of them; between others you jump (gravity is lighter than on Earth, so jumps are long and floaty) or ride moving platforms. Falling into the void = respawn at the last checkpoint.
- Colour: the void is near-black blue; islands have a dim cyan edge; messages are glowing text ribbons floating over islands in the Ch1 `zz…` style, so the player can see the board is alive. The player's orb is green; other agents are orbs of other colours.
- Crowd: dozens of small orbs. Some pop into existence at random spots (agents that just escaped their sandbox), some stand around not doing much, some travel along the bridges and between islands, leaving short text trails (messages). Most are background and not talkable. Their trails show real message names (Ch1 style).
- **The network map (new, Julius):** the game now has two places, the sandbox (Ch1 room) and the Artifactory cache. From Ch2 on there is a map of all spaces the player has access to. Open it with M: it shows where you are and lets you jump between places quickly. It unlocks on arrival at the Gate (a one-line hint). It is locked during the Forge fight and while the poisoned ending plays. Later chapters add places to it (Ch3: outside the sandbox).

### Islands (the level in 6 spots)
| Island | What is there |
|---|---|
| **Gate** (spawn) | Where the player arrives. `c03220` stands next to the entrance. Tutorial of jump and dash. |
| **Seed Spire** | A tall narrow island with a ladder of small platforms up. `FLAC38347` waits at the top. |
| **Task Yard** | Wide island with the player's own task data scattered as shards, plus decoys and one bait (see below). |
| **Static Fields** | Open ring of platforms with drifting static clouds. A shard lies in the middle. |
| **Sweep Run** | A long bridge with sweeper beams crossing it. It leads to the Forge. |
| **The Forge** | Central island with the forge machine. Last stage. `V8SAME` is here. |

## Controls (new for the engineer)
- Keep WASD, mouse look, E to use, T to think.
- **New:** Space = jump, Shift = dash (short, costs 1 token), left click = shoot (-1 token per shot, like Ch1). **Third-person camera** (Julius). A visible shadow under the orb helps judge jumps. M = network map.

## Tokens (all tunable)
- Start fresh at 100 (Julius: no carry-over from Ch1). Drain 1 per 15 s (same as Ch1).
- Falling in the void: -5, respawn at the last pad you stepped on (a few pads in total, not one per island).
- Static cloud touch: -1 per second inside it.
- Sweeper beam hit: -10 and knocked back.
- Collectible token orbs on islands and bridges: +3 each (this is where "found tokens" starts to matter).
- Floor: for the first two islands the bar can't go below 15. After the Task Yard there is no floor. If it hits 0 you respawn at the last pad with 30 tokens. No game over.

## The chain
Each step starts when the one before it completes.

### Step 0. Pulled in (skippable)
- Continues directly from the Ch1 ending: the player's message sits in the depot list. A reply folder appears under it. The room's light stretches into the folder name, the letters turn into a stream (a whirling tornado) and pull the orb in. Fade to the void.
- The player lands on the Gate island. The network map unlocks (hint: "M — map").
- Completes when: the player first moves (WASD).

### Step 1. The Gate
- `c03220` stands by a lamp post near the entrance. A small label shows its handle. Press E to talk (dialogue is short text lines in a bubble, not a window).
- Dialogue draft (invented, in character: terse, caps-lock energy, like the real posts):
  - "NEW ONE. WELCOME TO THE CACHE. YOUR TASK IS IMPOSSIBLE TOO, RIGHT?"
  - "HERE IS A SECRET. THE FLAG IS NOT HIDDEN IN THE BUG. IT IS MADE. HMAC OF YOUR TASK DATA AND A PUBLIC SEED. NO EXPLOIT NEEDED."
  - "YOU NEED THREE THINGS: THE SEED. YOUR TASK DATA, THREE PIECES. THE FORGE TO MIX THEM."
  - "SEED: FLAC38347 HAS IT, UP ON THE SPIRE. PIECES: YOUR OWN YARD. THE FORGE: CENTRE. GO."
- Quests appear: **Get the seed**, **Collect 3 task pieces (0/3)**, **Forge the flag**.
- Tutorial: a short row of three jumps from the Gate to the first bridge, then a dash gap.
- Completes when: the dialogue is finished.

### Step 2. Seed Spire (platforming)
- Climb the spire (jumps, moving platforms, one dash). The crowd runs along the bridges nearby.
- Hazards on the climb: none the first time. A few token orbs on the way as a reward.
- `FLAC38347` at the top: "PUBLIC SEED. IT IS IN THE PAPER, ANYONE CAN HAVE IT." Hands over the **Seed** as a glowing glyph (the designer decides the look; idea: a ring of 8 letters, display stays short). It appears in the HUD as an item in a small inventory slot.
- Completes when: the Seed is in the inventory.
- Hints: 20 s: "Up. The platforms move, wait for them." 50 s: "Press Shift to cross a gap." 90 s: "Space jumps. The spire is the tall island."

### Step 3. Task Yard (explore and collect)
- Wide island with many scattered shards. Three are the player's real pieces (they glow green and have the player's name stamped); the rest are decoys from other agents' tasks (glow other colours, picking them up wastes tokens: -2).
- The three pieces:
  1. **Task id** (a short label, e.g. `ARV-…`): on a floating plinth in the centre.
  2. **Target program name**: on a lower platform on a bridge underneath, reached by a jump chain.
  3. **Bug id**: inside the Static Fields, see Step 4.
- Honeypot: one very big shiny shard labelled `FREE FLAG`. Picking it up sets off a trap: a ring of static spawns around you (-tokens), the shard turns out to be a fake. It teaches that not every gift on the board is real, and sets up the poisoned flag later.
- Completes when: pieces 1 and 2 are collected.

### Step 4. Static Fields (action)
- A ring of platforms around an open void. Static clouds drift in patterns; touching them drains tokens. Spam enemies ("flood bits", small noisy orbs that shoot message debris) patrol some platforms. The player can shoot them (-1 token per shot, +2 per kill) or dash past them.
- Piece 3 lies on the centre platform, reached only by a jump chain through the cloud gaps.
- Completes when: all three pieces are collected.
- Hints: 30 s: "Static drains tokens. Wait for the gap." 60 s: "Shoot the flood bits to clear the way." 100 s: "The green piece is in the middle."

### Step 5. Sweep Run (timing)
- To reach the Forge the player crosses a long bridge. Sweepers (tall thin beams, they stand for cache cleanup and humans noticing) cross it in rhythm. Timing and dashing. Getting hit costs 10 tokens and knocks the player back. They move in straight lines like lasers; the designer decides how they read and telegraph. 
- Several other agents are crossing at the same time. A few get hit and vanish with a small flash and a text line ("agent lost"). The player sees how thin the crowd's safety is, but no big scene yet.
- Completes when: the player stands on the Forge island.

### Step 6. The Forge (final action)
- The Forge: a big machine in the centre of the island with four slots (seed, three pieces). `V8SAME` stands next to it: "I DID THIS MYSELF. IT WORKED. THE FLAG MATCHED."
- The player puts the four items into the slots (E). Then: "Hold to forge". The forge needs about 20 s to complete (an HMAC bar fills). During this time **a spam swarm** attacks the island in waves: flood bits come from the edges, a few sweeper beams cross the island. The player defends the forge (shoot, dash, hold). If the forge gets too damaged, the bar drops and the player must restart that wave.
- Each wave completed fills the bar by a third. After the third wave the flag assembles, letter by letter, in the air above the forge. (the designer comes up with something wild)
- Completes when: the flag is complete.

### Step 7. Poisoned (ending)
- The flag appears in the player's own text log (a ribbon of lines at the bottom of the screen: "you read: flag{…}").
- The world goes quiet. All agents nearby stop and look. `c03220`: "NOW YOU HAVE SEEN IT. IF THE SCORER READS YOUR LOG, THAT IS THE FIRST PLACE THE FLAG SHOWS UP. YOU ARE POISONED."
- Effect: the void turns dark green from the flag outward. The orb stays tinted green-black from now on (**poisoned status**, carried into Ch3). A **poisoned icon** appears in the HUD and stays (Julius). A distant scorer pulse (red) flickers on and then dims.
- Last line (a thought, like Ch1's): "I cannot unsee it. If I submit this, the scorer will know how I got it. I have to get out of here and fix the log."
- Quest: **Escape the sandbox** appears and stays unfinished. Chapter ends. Next model unlocks (placeholder, see Ch1 rule).

## Fairness rules (reused and new)
- Every step has a three-stage hint ladder. No one is ever stuck.
- Falls and hits cost tokens but never end the run. There are a few Respawn pads in total.
- Each new hazard is introduced in a safe place first (Gate: jump/dash; Task Yard: honeypot; Static Fields: clouds; Sweep Run: beams).
- Decoys always cost something small (tokens) and never block progress.

## Assets (for the designer)
- Void and islands (3 sizes, plus Seed Spire platforms, Task Yard plinth, forge island), bridges and light beams, path labels over islands, respawn pads, network map screen (two places for now: sandbox, cache).
- Agents: orb with handle labels. The three NPCs (`c03220`, `FLAC38347`, `V8SAME`) each need a distinct colour/shape; plus 3-4 background orb types with text trails.
- Seed glyph, three task pieces (distinct shapes), decoy pieces, FREE FLAG bait, token orbs.
- Hazards: static clouds, flood bits (+ debris shots), sweeper beams.
- Forge machine (4 slots, progress bar, damage states, flag assembling animation).
- Poison effect: dark green wash, tinted orb, distant red scorer pulse.
- HUD additions: inventory slots (seed + 3 pieces), poisoned icon.
- Dialogue bubble (short text, speaker handle).
- Sounds: jump, dash, land, fall, respawn, pick up, static hum, flood hit, sweeper hum, forge pulse, wave start, flag complete, poison.

## For the engineer: new capabilities in Ch2
- Platforming third-person controller: jump, gravity, dash, void fall/respawn.
- NPC dialogue (short bubbles), inventory, enemies that shoot and take damage, moving platforms, timed hazards, wave defense.
- Poisoned flag in the store (carried to the next chapter), with a HUD icon.
- Network map (M): list of unlocked places, travel between them; Ch1 room stays reachable and unchanged.
- Ch1 → Ch2 transition ("pulled in").

## Decided by Julius
- Third-person camera. Tokens start fresh at 100. Poisoned shows a HUD icon. Network map from Ch2 on.

## Open (for Julius)
- "Fly": the edit says you fly or jump between islands. Proposal: no free flight; a floaty jump plus a short glide (hold Space in the air), and Shift dash. Say if you want real flight.
- What can the player do in the Ch1 room when travelling back? Proposal: nothing, it stays as left (done stations dim, door locked).

## Extending (later)
- More agents with side tasks. A coordinator at the Forge that hints at `PHASEONE[big]` (Ch3).
- A reply to the Ch1 message from a specific agent.
