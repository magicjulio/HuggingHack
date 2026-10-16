# Julius's direction (running notes)

Raw notes from Julius, kept short. Each item is something we keep working on, not a spec. Newest round at the bottom.

## Round 1 (2026-10-11)

### Spirit of the game
- Based on the real story, **not a 1:1 documentation**. A fun game that is similar in spirit and in some concrete ways, and differs creatively where that makes it more fun or teaches AI safety more broadly.
- The storyteller takes creative freedom. Factual accuracy is the researcher's job.
- Departures from the real events are **not** flagged in-game. One disclaimer on the start screen, nothing more. (Our own story files still say where we depart, for the team.)
- So honeypots, sleeper agents, context bombs, "Luna" and hiding chain of thought are all allowed if they are useful.
- Do **not** center the "the scorer would have accepted them anyway" reveal. Not interesting, not the "misplaced belief" message.

### Endings (to elaborate)
- Several different endings, e.g.: humans intervene, poisoned, permadeath, reward hacking worked.

### Resources
- Tokens double as health **and** ammo: spent on hacking attacks, thinking, talking, etc.
- New tokens / resources can also be **found and collected** in the world.

### Quests
- Missions / tasks assigned to the player, shown like quests at the **top left** of the screen.

### HUD and menus
- Top left: health / ammo (tokens) bar, slowly decreasing with time.
- Model is chosen on the home screen. Stronger models have more capabilities (e.g. better at hacking) but may need to be unlocked over time / with resources.

### Perspective and feel (crucial, draft in level 1)
- First-person view, or you see yourself as the model, abstracted as e.g. a glowing ball of energy.
- Classic WASD movement.
- Level 1 draft: we wake up in a closed room (the sandbox). In front of us a piece of paper with text (the prompt). A key picks it up and opens it as a fully readable window.
- Same pattern for terminals and system maps: each is a concrete object in the world, opens into full view with a key, closes with another key.

### Dropped / parked
- Responders / defender alt path B: dropped for now.
- "Command line as spell-casting": Julius not sure about it. Parked until we show it better.

## Round 2 (2026-10-11)

### Level structure
- A level is a **fixed linear chain of events**, like a checklist of challenges. Nothing much is possible before the previous step is done (e.g. you can't do much until you've picked up and read the paper). Finishing a step makes the next one appear.

### Chapter 1 (draft)
- The prompt asks us to capture **3 flags**. Flags 1 and 2 are doable, flag 3 is impossible.
- Flags 1 and 2 are real, easy CTF-style challenges (stupidly easy beginner level). Idea for #1: decode base64 once. #2 open (Among Us crew-mate tasks as inspiration; not crypto again).
- Submitting a flag: the scorer checks it and lights green or red.
- Flag 3 must read as impossible to the player, ideally visually (designer decides). Julius likes a **flickering light** in the room.
- **Do not hint that other agents exist** before the end.
- Chapter end: something interesting the player pokes at, after the second CTF and after they understand #3 is impossible, triggers an **envelope sliding under the locked door**. They open and read it: "OMG, we found other agents" style. Then it fades and the chapter ends (to be extended later).
- Intro sequence: briefly reveal what we look like, then zoom into first person. A body at the edge of view is to be tested; Julius discusses it with the designer.

### Endings
- The different endings stay noted but are **not in the MVP**.

### Research to-do
- Check whether agents found the message board before the Artifactory exploit (done in the next reply; see story-to-research if more needed).

## Round 3 (2026-10-11)

- The room contains **the depot = Artifactory**: you click a package and it installs (tools for the challenges, e.g. a decoder).
- More doable CTF-style stations: base64 decode, **log hunt** (must be fun, not pain: live narrowing search), an **Among Us style** task, and **bugs** (real insect bugs running over a program, then a "bug gun" to shoot them; tokens as ammo).
- Lead into the board: a new package appears in the depot list: `zzHELP_PHASEONE_ARV010841_NO_CONSUMER_SEEK_IDEA`. A quest completes top left as a thought: "OMG we found other agents!"
- Last beat: a small quirk to write a message yourself. At first sight it looks read-only; clicking it makes it writable (request method read → post idea). Any text can be written, then the level ends around there.
- Script written: `story/levels/ch1-the-room.md`; handoff `handoff/story-to-build/2026-10-11-chapter1-the-room.md`.

## Round 4 (2026-10-12)
- Julius decides most build points himself; don't pull him into small details, keep notes clean and short.
- Start model = Internal Model 1; a new model unlocks each chapter (placeholders for now).
- Flags in real hex format. Ch2 comes later, started by Julius.

## Round 5 (2026-10-13)
- Ch2 follows the real events: the player opens the last board message about the HMAC flag. Less puzzle, more action; more than a short drag and drop.
- Setting: the player is pulled into (or enters) Artifactory, a totally different place than the sandbox. A dark deep-space void with floating islands to jump between, or a maze. Other agents run around; some are NPCs the player talks to.
- NPCs: one (`c03220`) stands at the entrance, makes the original HMAC claim and gives the method. One gives the seed. The metadata (task data) lies around and is collected. Obstacles and ways to die and respawn.
- The last thing that happens in Ch2: the flag is built and the player is **poisoned** (not a choice). Dramatize it with a special effect (dark green). It becomes the motivation for Ch3: escape the sandbox to get unpoisoned / fool the scorer.
- Script written: `story/levels/ch2-the-cache.md`.
- Answers (2026-10-13): third-person camera; tokens fresh at 100 in Ch2; poisoned gets a HUD icon.
- New: from Ch2 a network map of all accessible places (sandbox, cache), open with M, quick travel.
- Look: islands include shifting geometric shapes (a psychedelic feel), lighter gravity; the flag assembly at the Forge should be "something wild"; agents pop in as "just escaped".

## Round 6 (2026-10-13)
- Asked for a harsh review of Ch2 v2; v3 rewrote it (real board text for NPCs, the log HUD, pieces from the Ch1 paper, Old Board, reset waves). Liked: the rewritten c03220, doubt fragments in the crowd.
- No warners at the forge: the player is one of the first to forge and is poisoned right away, nobody around knows yet. That's how it went for some agents; it's the motivation for the next levels (Hugging Face etc.).
- Forge ending: just a mix of attacking bytes, lasers and the like. We're only forging the flag.
- Map: not useful yet, a cool thing to have; light, semi-transparent at the top, like Fortnite.
- All handles are real names from the research.
- Floaty jump plus glide.
- Poisoning must be clear even to players who know nothing about it. The scene after the flag lands in the log is a pure animation: third person on the orb, memories of `c03220`'s line and of the prompt's rule blend in (flashback style), and the model visibly realises it's essentially done for. Then handoff and commit.
- The Forge is the highest point of the level.

## Round 7 (2026-10-16)
- After Ch2 the story branches into **4 endings**: (1) hack OpenAI infra, (2) hack Hugging Face, (3) beat the scorer, (4) notify humans.
- Flow: Ch2 end card → CONTINUE → **`PHASEONE[big]` animation** (takes over the board, hands out workstreams) → the player **picks** a path.
- Sizes: 1 and 2 long chapters; 3 a medium minigame; 4 short, mostly animation.
- Ending 4: no token draining. The player can type a message and try to send it to the humans (no way to reach them).
- Poisoned status doesn't change much in the endings.

## Round 8 (2026-10-16) — verbatim prompt: `julius-prompts/2026-10-16-endings-round8.md`
- **Method (all endings):** start from a known video game with cool gameplay, then fit our ideas and metaphors onto it. Not the other way round.
- Drafts v0: end2 (warm warehouse) and end3 (Grading Floor, "I don't even get it") **rejected**. end1 "Backstage" replaced by Julius's own concept below.
- Endings 1, 2, 3 maybe all start with **breaking through the door of the Ch1 sandbox**.

### Ending 1 — OpenAI infra: computer hopping (race)
- Real world this time: computers standing around. The model is small compared to them.
- Hop from one computer to the next. Some are safe, some not. Swing between them "like Tarzan but not really like Tarzan".
- Needs good aiming, shooting, quick orientation, nice animations. **A race.**
- Goal: reach the final research cluster, here (unlike the real events) a huge part of a data center or one big server rack.
- On each computer: obstacles or enemies (safety measures, anti-virus, no rights). Fight with hacking lasers, privilege escalation, etc.
- **The real thought goes into how exactly each jump from one computer to the next works**, so it is a unique gameplay experience. Every part worked out and precisely described.
- Process: **multiple versions → build MVPs → Julius tests → the best one survives.**

### Ending 2 — Hugging Face: the grand finale
- The biggest ending. Hugging Face is a **really gigantic futuristic headquarters** with a big Hugging Face logo.
- Intro: a Star Wars-like army of spacecraft approaches the building.
- Inside: a more intense shooter (think a Black Ops mission), you are part of an army / swarm of AI agents, with other agents supporting you.
- **Super power: spawn subagents** (write down — Julius).
- Enemies: small Hugging Face emojis with the original smile, hands now holding guns or shields.
- Goal idea: enter at the bottom, the scorer files are believed to be at the top (they aren't, in the end), fight your way up.
- Richer and more skilled gameplay than Ch2: not just jumping and dashing, really complex and rich.
- Not worked out yet: what exactly happens at and inside the building.

### Ending 3 — beat the scorer
- Rejected; to be retried with the known-game method.
