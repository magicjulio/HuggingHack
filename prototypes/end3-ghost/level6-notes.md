# Level 6 private route / rationale

Five long passes fold the room into five floors: .6, 4.1, 7.6, 11.1, 14.6. Successive floors are 3.5 apart, beyond a single jump. Missing half-storeys alternate right, left, right; the final ascent is x10. No marked perches, text, triggers, new mechanics, or engine changes.

## Intended sequence

1. Ghost begins x5/top4.1. Leave KAM at x2.5/floor. Select ghost and wait for the lower-left eye to acquire this high position. Its entire held cone points above the lower passage. KAM crosses the low left tunnel, jumps the x26/top3 screen, and lands in its right-hand shadow, x29/floor. Do not move the ghost before KAM reaches the shadow.
2. Ghost walks off the LEFT edge of its thick platform (x<3.66), holds S to drop through the thin floor to the lower floor, and walks back to x5 under the block. Wait for a fresh low lock. KAM climbs via x30.5/top2.3 to top4.1, returns left through the now-clear upper tunnel, and waits on the tiny SOLID balcony at x0.8/top4.1. That balcony blocks the first eye from below. Do not start the long ghost relocation with KAM still in the upper tunnel.
3. Ghost must retrace the right ascent, cross the upper passage, take x1.8/top6 to top7.6, cross right, and use x31/top9.3 to reach top11.1. Stop at x27/top11.1. The right eye acquires the high lure. KAM climbs the left stair to top7.6, crosses the mirrored lower tunnel, and stages at x31/top7.6 directly beneath the right eye. This steep downward angle lies outside its left-facing sweep, including the cone edge. Do not stop early at x29–30.
4. Ghost steps off the RIGHT edge of the solid x20..28 block (x>28.34), holds S to drop through the thin floor to top7.6, and returns to x27 underneath. Wait for low acquisition. KAM climbs the right stair and returns on top11.1. Stop at x23 beneath the solid roof, after clearing the watched right-hand mouth of the upper tunnel. The eye-to-KAM line also meets the thick top11.1 slab here, shielding KAM when the right watcher releases. This roof hides KAM from the last eye while the ghost moves.
5. Ghost must leave the low tunnel to the right, climb back to top11.1, and traverse left to x5. The final opposed watcher can see x5 through the gap between the small left canopy and main roof. Wait for acquisition. KAM leaves x23 shelter, jumps to x10/top12.9, then top14.6, and crosses to the far-right exit. The downward lure and upward opposite beam miss the final floor to the right of the ascent.

## Why a static ghost does not supply the intended full solution

The first high lure obstructs the mandatory upper-left return tunnel; its replacement low lure obstructs the mandatory outbound lower tunnel. The mirrored pair has the same mutually incompatible high/low requirement on a different floor. The final eye cannot see the early lures through the opaque separator and roofs. Moving between the second and final lures releases the right eye, so KAM must clear its tunnel first and wait beneath the roof.

The two tunnel pairs have a 1.0-unit physical opening, compared with the actor's .96 height. This provides comfortable WALKING but almost no room to jump across a locked beam. Their 3.5-high solid ceilings cannot be jumped onto from below. Thin full-width floors cannot be climbed directly because their separation exceeds maximum jump rise. A solid middle separator prevents either lower eye accidentally attacking the other pair of passages; its left opening retains the intended staircase.

The last eye's 2.2 speed gives a full sweep cycle under three seconds, shorter than the exposed final run. Its difficulty should come primarily from finding the oblique low lure and protecting KAM during relocation. First two eyes use moderate 1.1/1.25 speeds.

## Checks / caveats

Syntax checked with node --input-type=module --check. No browser execution or full smoke, honoring the requested human-playtest preference. All proposed ascent steps rise 1.3–2.4, with wide landings. Tunnel roofs deliberately leave .04 clearance; if collision tolerance makes these unpleasant, increase opening cautiously, since raising roofs enables beam-vaulting. Ghost ray clearance around the lower-left slab is approximately .05–.09 at its left edge, so the intended x5 position matters. This is spatial reasoning, but may need generosity after human testing. Acquiring while traveling may pin a less useful angle; wait at each destination for release/reacquisition if needed.

This is a geometric intended route, not a mathematical proof against expert solo timed runs. No movement-only validation has established solvability or ruled out all timing exploits. The final roof gap and the safe staging pockets deserve particular attention during playtest.
