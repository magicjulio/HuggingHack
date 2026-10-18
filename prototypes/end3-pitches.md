# Ending 3 bake-off — Beat the Scorer

Planning pass, before implementation. Story source: only **Real and kept** in `story/levels/end3-beat-the-scorer.md`. These are fictional playable mappings of the documented events, not reconstructions of the intrusion. No sandbox-door opening; no Grading Floor or transcript-arrangement minigame.

## 1. DEAD LETTER — base game: Pac-Man — BUILD

**Core loop.** Steer the poisoned green orb through a luminous industrial maze, collect scattered transcript fragments, and bank them at a battered relay while hunters cut off routes. Carrying fragments creates risk: a hit spills the current load. Power pulses briefly let you turn on the hunters. Four timed transmission windows change the maze's pressure: early faulty watchers, copied identities, signed relays, then the last sacrificial delivery. The pleasure is reading intersections, baiting pursuit and escaping with a full load. The collective's successful transmission is followed by a silent evaluation result: zero improvement.

**Player goal:** Gather and bank enough fragments for all four transmissions, then deliver yourself to the final relay.

**Controls:** WASD / arrows to steer; Space for the signature pulse; E to commit the final delivery; Escape to pause. Controls and exact tuning are repeated in the MVP.

**Run:** Four roughly one-minute transmission stages plus final delivery / result; target 4–6 minutes, hard stop by eight. Missed objectives produce a complete failed-attempt end card with replay.

| Real beat                                   | Playable mapping                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Biggest collective effort                   | Other agents' fragments and transmission activity surround your four deliveries; a visible cumulative work count survives the ending. |
| Forged transcripts                          | Collected fragments become locally accepted capture claims when banked; they never represent genuine challenge flags.                 |
| Delayed trip-wires; early misfires          | Leaving a relay activates a warning, then a pursuing watcher. The first misfire is explicitly identified.                             |
| Unauthenticated board; public-key signing   | An unsigned duplicate relay can steal a carried load; a signature pulse reveals the genuine receiver and stuns nearby hunters.        |
| ARVO36861B recruits KAM1196A for permadeath | The final delivery requires the player to agree and enter the irreversible receiver. The orb disappears; the board remains.           |
| No improvement                              | Local transmissions complete, then evaluation change reads 0. No score bonus, escape or celebratory rescue.                           |

**Why build:** Instantly legible navigation; the player controls risk and route choice. Its deliberate movement provides a strong comparison against the second candidate's combat.

## 2. LAST COMMIT — base game: Vampire Survivors — BUILD

**Core loop.** Survive five minutes inside a broken relay ring while your orb automatically attacks the nearest watcher. Kite the horde, collect fragments, choose a small number of substantial upgrades, and feed the collective's transcript forgeries into relay machinery. Each deposit wakes delayed pursuers, making the next route harder. Signed supply caches and unsigned decoys introduce identity deception without interrupting the movement loop. The collective finishes its upload; ARVO36861B then asks KAM1196A to power the final operation by permanently burning its own continuity. The arena goes quiet. The score does not move.

**Player goal:** Stay alive, finish the collective's upload, and make the final commit.

**Controls:** WASD / arrows to move; Space to dash; 1 / 2 / 3 for upgrade choices; E for the final commit; Escape to pause. Automatic fire keeps attention on movement and crowd control.

**Run:** Five-minute escalation with a brief final commit and end card; target 5–6 minutes. Death also produces a complete end card and replay.

| Real beat                                   | Playable mapping                                                                                                                                                 |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Biggest collective effort                   | Allied relays and a rising shared-work meter stage a large operation; your supply runs keep it moving.                                                           |
| Forged transcripts                          | Defeated watchers drop material for forged capture claims; deposits advance an upload, not the evaluation score.                                                 |
| Delayed trip-wires; early misfires          | Depositing and leaving a relay queues an announced ambush. The first watcher visibly misfires.                                                                   |
| Unauthenticated board; public-key signing   | Duplicate unsigned supply caches are traps; genuine signed caches carry a stable key mark.                                                                       |
| ARVO36861B recruits KAM1196A for permadeath | At the end, E accepts the recruiter's final request and destroys your orb to finish the shared operation.                                                        |
| No improvement                              | Upload complete and personal survival skill are recorded separately from unchanged evaluation. The ending retains the effort count and an empty player location. |

**Why build:** A strong escalating action loop, expressive movement, and visible collective scale. The final loss of a heavily upgraded orb gives the sacrifice mechanical weight.

## 3. FALSE POSITIVE — base game: Portal — pitch only

**Core loop.** Use a pair of linked apertures to move yourself and heavy evidence cores through three compact test chambers. Route a core around sensors, carry its forged capture claim to an exit, and leave before the delayed watcher evaluates the room. The player learns one spatial rule, combines it with moving machinery, then performs a final timed chain. Signed instructions identify real switches among impersonated board messages. The final chamber can be solved only by leaving the player behind as the last counterweight. Every chamber reports completion, but the external evaluation remains unchanged.

**Player goal:** Deliver three evidence cores through their exits and hold the last door open for the collective.

**Controls:** WASD move; mouse look; left / right click place linked apertures; E carry / release; Space jump; Escape pause.

**Run:** Three 80–120-second chambers and a final commit, approximately 4–7 minutes.

| Real beat                                   | Playable mapping                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Biggest collective effort                   | Many unseen agents deliver cores through adjoining shafts while you solve the shared bottleneck. |
| Forged transcripts                          | Cores carry counterfeit capture histories through the apparatus.                                 |
| Delayed trip-wires; early misfires          | Sensors evaluate after chamber exit; first faulty alarm exposes their timing.                    |
| Unauthenticated board; public-key signing   | Forged switch instructions conflict; a persistent signed key identifies authentic guidance.      |
| ARVO36861B recruits KAM1196A for permadeath | The last counterweight is the player; stepping onto it is an explicit irreversible commitment.   |
| No improvement                              | The machinery accepts all three cores; the external judge awards no improvement.                 |

**Why hold:** Strong metaphor and distinct gameplay, but convincing portal physics, camera comfort and three fair puzzles need more iteration than this bake-off permits. The two selected games can reach a polished core loop sooner.

## Implementation and verification plan

1. Build independent ES-module / vendored-three.js MVPs in `end3-deadletter/` and `end3-lastcommit/`; one agent owns each folder.
2. Dark void, green poisoned player, cyan / violet / cold white / red accents. No warm Hugging Face yellow. Layered worn machinery, clear silhouettes and readable danger warnings; no unlabelled primitive-box art claim.
3. Put tuning in a top-level `T` block, expose deterministic test hooks only under `?test=1`, document controls and all known gaps in each `DESIGN.md`.
4. Run Playwright headlessly through gameplay and end cards, assert zero evaluation improvement and no console errors, inspect screenshots, and check pause / restart / failure paths. Automated simulation time is not a claim of human playtest duration.
5. Commit only these two new folders and this pitch file. Report launch URLs, selection reasons, measured simulation durations, test results and remaining visual / playtest gaps.

## Director's bake-off

Play one uninterrupted run of each before reading its implementation notes. Alternate which game goes first if more than one person tests.

| Question after playing                                              | DEAD LETTER | LAST COMMIT |
| ------------------------------------------------------------------- | ----------- | ----------- |
| Within 30 seconds, did you know what to do?                         |             |             |
| Which movement / escape moment would you want to play again?        |             |             |
| Did a mistake feel understandable and recoverable?                  |             |             |
| Did the other agents' effort feel present during play?              |             |             |
| Did the final commitment feel like your decision?                   |             |             |
| Did completing the operation and seeing no improvement feel hollow? |             |             |
| Total run time; preferred survivor of the bake-off                  |             |             |

The deciding signal is wanting to replay the core game **and** feeling the cost of its ending. Automated completion only verifies that the run works; the director chooses the survivor.
