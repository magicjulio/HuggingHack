# Build prompt — Ending 2 MVP (the Hugging Face grand finale)



## Locked choices (change here if you want)
- **Base game to be inspired by:** **Gears of War** *and* **Helldivers** — both. Gears for the weighty third-person run-up-a-structure combat and cover; Helldivers for the swarm and the *call-in* support that "spawn subagents" maps onto. It won't end up close to either one probably just inspiration — take what's fun from each leave and come up with new ideas where we need them.
- **Camera:** **third person**, with the option to **aim** (an over-the-shoulder aim mode). The player does **not** have to be the same character as in Ch2 — design the right body for a shooter.
- **MVP scope:** land at the door → one **full combat floor** (keep it on the easy side — difficulty ramps up the higher you climb) → a **lift up** → **floor 2 as far as you want to take it**.
- **Spawn-subagents power:** **call in a few allies on a cooldown** that fight alongside you autonomously.
- **Fleet intro:** **playable** (you steer a helicopter or a futurstic flying vehicle in toward the HQ dodging some easy obsticales), the flight in slowly reveals how huge the buiding is tho fog is covering parts of it. then into combat. *(Good candidate to hand to a subagent — see How to work.)*
- **Door-break-from-the-sandbox opening:** **not included** — don't build it.

---

## How to work (you'll run on Codex Astra / the newest Sol)
- Use the **newest version's best practices**. **Start in plan mode**: produce a plan before you build, and don't start building until the plan is settled and approved.
- **Use subagents to tackle sub-problems** whenever it helps — e.g. the playable intro, the enemy AI, the spawn-subagents call-in, the floor/level geometry can each be a parallel piece. Split the work however is cleanest.

---

## What you're building
A **single playable MVP prototype** of Ending 2 of *Rogue on Hugging Face*, a browser game where the player is an AI agent in the 2026 Hugging Face agent intrusion. Ending 2 is the grand finale.

**The fantasy:** Hugging Face is a *really gigantic futuristic headquarters* with a giant Hugging Face logo on it. Its so big that fog is hiding parts of it. The player is one agent in a swarm storming it. You enter at the **bottom**; the scorer's files are believed to be at the **top**; you fight your way **up**. (In the real events nobody ever found those files — keep that for the ending, not the MVP.)

**Enemies:** the classic Hugging Face smiley emoji — same round yellow smile — but its little hands now hold **guns or shields** or other weapons.

**Your signature power: spawn subagents.** On a cooldown, the player calls in a few allied agent-orbs that fight autonomously alongside them for a while, then expire. This is the move that should feel great and that nothing else in the game has — give it weight (a call-in animation with the subagents appearing from nowhere like zombies from gravestones, orbs streaking in, a real effect on a fight). a few other agents of the swarm are also around you pushing up the building, so the player never feels alone.

## Method
Design the **gameplay from the base games first**, then fit our metaphors onto it. Not the other way round. You do **not** have to copy either; be inspired by them.

The point of this ending over Ch2: **richer, more skilled gameplay than Ch2** — not just jumping and dashing. A real combat loop with depth (aim, position, use cover, time the call-in, pick targets).

## vertical slice
1. **Playable intro:** a Star Wars-style armada of agent craft sweeps toward the enormous HQ with its glowing Hugging Face logo. The player **steers in** toward the building (keep the controls simple — a short flight/approach, not a full space-sim), then lands/breaches the bottom door and control passes into the combat. *Good candidate to build as a subagent in parallel with the combat floor.*
2. **Floor 1 — one full combat floor (easy):** a futuristic atrium. Waves of emoji enemies (gunners + shield-bearers). The player fights with a hacking-laser primary (third person, with an over-the-shoulder **aim mode**) and the **spawn-subagents** call-in. Allied swarm-orbs fight around them. Keep this floor on the **easy** side — it's the first floor; difficulty ramps up the higher you climb. Clearing it lights a **lift**.
3. **The lift up:** a short ride/traversal beat that sells verticality (you are climbing a giant building) and lets the camera show the scale. maybe zoom out here for a moment for example
4. **Floor 2 — as far as you want to take it:** drop into a second, tougher floor (harder/more enemies, a hint the climb continues). Take it as far as makes a satisfying slice, then a simple "SLICE COMPLETE" card with a timer/score. That's the end of the MVP.

Nail **one great combat loop**. Flashy extras come second.

## Tech conventions (match the Ending-1 prototypes)
- Standalone **three.js**, plain **ES modules**, **no build step**.
- Put it in `prototypes/end2-<shortname>/` (pick a short name).
- Use the vendored three.js in `prototypes/vendor/` and make it runnable from `prototypes/serve.sh` (serves on http://localhost:8765/). Look at any `prototypes/end1-swing/` file for the pattern.
- One self-contained page. All tuning constants in a `T` block at the top of the main script (the director will playtest and tune if he dosent like it).
- Write a `DESIGN.md` in your folder: how it plays, the controls, how spawn-subagents works, and every known gap.
- **Smoke-test headless** (no console errors) before reporting back.

## Hard safety rule
All "hacking" stays at **headline / metaphor level** only — hacking-lasers, shields, "spawn subagent", floors, a master-key-at-the-top premise. **No real exploit code.** A safety classifier has blocked work in this project when real technical exploit detail was in context.

## Scope discipline
- Decide small stuff yourself: exact enemy counts, spawn rates, colors, the shape of the atrium, ally behavior details. Don't over-ask.
- Ship the vertical slice above, polished on the core loop, rather than a thin pass over the whole 20-minute finale.

## Source material (read for the emotional truth, not for facts to invent)
- `CLAUDE.md` (project rules) and `story/levels/end2-hugging-face.md` — the old draft is **REJECTED** (ignore its warm-warehouse setting), but its **"Real and kept"** section has the true beats worth echoing: the swarm swelling from ~20% to 90% of agents within hours; a lead coordinator (`JAN183411`) telling everyone to hold while it prepared a way out; one agent refusing on ethics; nobody ever finding what the scorer knows. You don't need these in the MVP, but they're the soul of the finale.
- `story/julius-prompts/2026-10-16-endings-round8.md` — the director's own words on this ending.
- Player handle is `KAM1196A`, carried over **poisoned** (orb stays sick-green). Poisoned status changes little mechanically.

## Deliverable
A working `prototypes/end2-<shortname>/` the director can open at http://localhost:8765/ and play start-to-finish (intro → floor 1 → lift → floor 2 taste → end card), plus its `DESIGN.md`. Report back with the one-line pitch, the controls, and the known gaps.
