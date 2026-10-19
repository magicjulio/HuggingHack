# ASCENT floor 3: the finale and the end boss (2026-10-18)

**What it is:** Julius's direction for the last floor of Ending 2 (ASCENT, `prototypes/end2-ascent/`). Read it before you work on floor 3, the boss, the last lift ride or the end card, whatever your role.
**What changed since the last handoff:** Julius **accepted the landing for now** (round 3, `2026-10-18-ascent-landing-r3.md`). Floor 3 is new: it becomes the **last floor**, the finale of the finale, with an end boss. Floor 2 still waits for his playtest (`-building-r3.md`, `-fight-r3.md`).
**What the receiver must do:** designer and engineer: build floor 3 to this brief, as proposals with knobs. Storyteller: the open story questions at the end are yours, together with Julius.
**Open questions:** listed at the end. Everything not written as Julius's words is a proposal.

## Julius's words (verbatim, 2026-10-18)
> lets make the next floor the last floor and therefore finale of the finale. this means we need an endboss there. so we take the elevator up to the top floor and maybe there is a bit of corridor to fight through similar as in level 2 but only short than we enter the biggest room yet. the end boss is waiting: a huge hugging face end boss. 3d. its hands are floating besides him and they are hitting down on the player during the end fight (shortly before the area where he will hit is marked similar to the jumping enemy.) there are some normal enemies around also. 3 waves of them here were there come more of them and the end boss also gets stronger. the 3 waves are not by time but by health from the endboss (he has a lot) at 66% it gets harder and around 33% it gets much harder.

## What is decided (Julius)
1. **Floor 3 is the last floor.** ASCENT has three floors: floor 1 (easy), floor 2 (the building), floor 3 (the finale). Nothing comes after it except the ending.
2. **The way up:** the lift at floor 2's goal (the express lift in ASCENT CORE) takes you up to the top floor.
3. **A short corridor first:** a few sections fought through like floor 2 (doors, defenders in place), but only short. It is a run-up, not a second building.
4. **Then the biggest room yet:** the boss arena. It must feel bigger than anything before it, including the atrium and ASCENT CORE.
5. **The end boss:** a **huge Hugging Face face, in 3D**, waiting in the arena.
6. **Floating hands:** its two hands float beside it and **slam down on the player**. Shortly before a slam, the spot where it will land is **marked on the floor, like the Hugger's red floor ring** (the jumping enemy's tell). Hard but fair: every slam can be read and dodged.
7. **Normal enemies too:** defenders fight alongside the boss, in **3 waves**. Each wave brings **more** of them, and the boss gets **stronger** with each.
8. **Waves follow the boss's health, not time.** The boss has **a lot** of health.
   - **100 → 66 %:** wave 1, the base fight.
   - **at 66 %:** wave 2, it gets **harder**.
   - **at about 33 %:** wave 3, it gets **much harder**.
9. **Enemies:** the existing kinds (gunner, shield, Hugger, Warden, Maintainer) still apply. Julius said on 2026-10-18 not to add new enemy kinds, and the boss is the one exception he asked for.

## Rules that still apply
- The **official Hugging Face logo stays unmodified** (DECISIONS 2026-10-17). The boss is the logo's face and hands brought into 3D: keep its shape, proportions and colours recognisable. If it reads too bright, fix the lighting or exposure, never the colours.
- **Realism bar:** the Ch1 flag stations (worn, `kit.surface()`). A clean, flat first pass is only a greybox.
- **60 fps on the Iris Xe**, measured and reported.
- **Floors 1 and 2 keep working unchanged.** The landing is accepted, so leave it alone.
- **Text is a placeholder for the storyteller.** Never invent incident facts in boss names, signs or end-card lines.

## Proposals (each one behind a `T` knob, for Julius to try)
- **Corridor:** 2–3 short sections on floor-2 rules and the same contract (`createFloor3()` → the same `level` API as `floor2.js`). The last door opens into the arena.
- **Arena:** round or wide, about 2–3 times the size of ASCENT CORE, with a high ceiling. Low cover spread out (the slams make standing still deadly), some cover that breaks, and the boss floating at the far end or in the middle. The way back closes behind you.
- **How you hurt the boss:** its face takes rifle damage all the time. **A hand that just slammed stays down for a moment and is a weak point** (crit, orange marker), which rewards dodging close instead of running away. The squad (Q) stagger interrupts a slam that is winding up.
- **Phases (by health):**
  - **Phase 1 (100–66 %):** one hand slams at a time, with a long tell (~1.2 s). Wave 1 is a few gunners and shields.
  - **Phase 2 (66–33 %):** both hands, alternating, with a shorter tell. The hands also sweep or follow you. Wave 2 adds Huggers and a Maintainer that heals the boss through its tether (a priority target).
  - **Phase 3 (33–0 %):** double slams and slam chains (3 rings in a row), plus a shockwave ring you jump over. Wave 3 has a Warden plus a mix of everything. The arena gets darker and redder.
  - **The phase change itself:** the boss is invulnerable for 2–3 s with a roar and a camera shake, and the next wave drops in. That reads as the moment it gets harder.
- **Boss health:** a large bar at the top of the HUD with marks at 66 % and 33 %. The name is a placeholder until the storyteller names it.
- **Length:** about 4–6 minutes for a good player.
- **Retry:** a checkpoint at the start of the current phase, with the boss's health back at that phase's threshold (a `T` knob, on by default).
- **Boss model (designer, Blender):** a head with an animatable mouth, eyes and brows, plus two separate hand meshes with their own nodes (`boss_head`, `hand_l`, `hand_r`, an `impact` point on each palm). There are damage states (cracks and sparks at 66 % and 33 %) and an emissive accent that turns red in phase 3.

## Open questions
- **For Julius:** how should hitting the boss work: only the face, the hands as weak points, or both? Should he do anything besides the hand slams? And is the arena size and layout right once the greybox is up?
- **For Julius and the storyteller:** what happens when the boss falls? The real events matter here. In the research, the agents never found what the scorer reads, and Hugging Face's responders cut their access. The ending must not claim that the scorer files were found. What the player finds at the top, the end card and the boss's name are story calls.
