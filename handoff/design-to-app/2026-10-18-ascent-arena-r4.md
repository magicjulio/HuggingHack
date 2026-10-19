# ASCENT arena r4: floor 3, the summit (2026-10-18)

**What it is:** the arena agent's round-4 handoff (brief `2026-10-18-ascent-team-brief-r4.md`, direction `2026-10-18-ascent-floor3-finale.md`). It covers floor 3's corridor and boss arena, the express ride from floor 2 up to floor 3, and the floor-3 Blender kit.
**What changed since the last handoff:** floor 3 is new. Floor 2 (`floor2.js`) is untouched; floor 3 runs through its generator.
**What the receiver must do:** Julius: playtest floor 3 and answer "For Julius". Engineer: nothing to port yet (prototype only).
**Open questions:** see "For Julius".

## Done
- **`floor3.js`** (new): `createFloor3() → level` passes its own layout table through `createFloor2({ layout })`, so it has the full floor-2 API: sections, doors, checkpoints, side closets, nav, culling, ground and colliders. `building.js` and the section director run unchanged. It adds **`level.arena`** (Contract 1): `section`, `gate`, `rect`, `center`, `radius`, `ceiling`, `bossHome`, `cradle`, `slamZone`, `inSlamZone()`, `drops`, `sideDoors`, `cover`, `breakables`, `breakAt()`, `resetBreakables()`, `setMood(k)`. The map and contract are in `prototypes/end2-ascent/FLOOR3.md`.
- **Layout:** EXPRESS LANDING (the cab arrives) → SERVICE SPINE (a 22 m hall with a side closet) → ANTECHAMBER (the last garrison) → **SUMMIT HALL**, the arena: 50 × 48 m (2400 m², about 3.6× ASCENT CORE and larger than the atrium), with a 26 m ceiling. It has five staggered rows of low cover (20 pieces, 9 of them **breakable**), four roof columns, and the boss's cradle at the far end in front of a **window wall the full width of the room** (the night city behind the boss). There are four side closets for the waves, and the gate (d3) closes behind you.
- **Mood:** `setMood(0|1|2)` blends the hall lights and the glow strips from cool white to amber to dark red, and the beacons pulse in phase 3. The light count is fixed on floor 3, so there are no shader recompiles when sections cull.
- **Express ride** (`lift.js` → `world.express`): a through-car cab that climbs the outside of the tower's prow from floor 2's EXPRESS gate to the floor-3 alcove. It has a cinematic camera (inside → wide outside → looking down the drop → back inside in the gameplay pose). Fight drives it from main.js with the call sequence in `FLOOR3.md`.
- **`world.js`:** floor 3 at y 144, `world.level` is the active floor's level, `world.levels[2|3]`, `world.express`, and colliders re-synced on doors and breaks. The atrium deck and lift rails are hidden on floor 3. **`floors.js`:** `LIGHTING[3]`, and the atrium and hall sets are hidden on floor 3.
- **Art:** `design/3d/end2/floor3/summit.py` → `end2-floor3-kit.glb` (21.8k tris, 1.4 MB, worn `kit.surface()` sets reused from the floor-2 kit). It contains the octagonal roof columns (collars, beacons, mood glow slots, conduits), the boss cradle (vents, emitter ring, corner beacons, cable trunks), breakable coolant-cell cages (they read as fragile next to the steel crates), the arena gate surround, the roof trusses, the floor ring and the express cab. The corridor wears the floor-2 kit.
- Preview: `design/3d/end2/previews/arena-r4-arena.png` (real GPU, in game, phase 1, with the boss model).

## Verified
- **Full `smoke.mjs` PASS** (SwiftShader, human bot): intro → floor 1 → lift → floor 2 → express → floor 3 → boss → end card, with no browser errors. `START=2` and `START=3` also PASS. One earlier full run stalled on floor 2: the bot got stuck at the s6→s7 door. It looks like flaky bot pathing; the re-run passed.
- Level probe: every nav node (1325) is reachable from the start, all doors are linked, and the checkpoints land in the right sections.
- **fps on the Iris Xe:** a headless real-GPU run at 1920×1080, in the arena in phase 3 with wave 3 and the boss awake, measured **27 fps** (p50 33 ms, p95 67 ms, about 640 draw calls per frame). The load average was 9–15 from the other agents, so the number is pessimistic, but **60 is not reached**. I did not get a measurement on a quiet machine with headed Chrome.

## Left / not done
1. **Performance.** Levers in order:
   - Merge the 9 breakables into one mesh per material, hiding a broken one through an instance or an attribute. Today each is its own 8-material group, about 72 draw calls.
   - Drop the side-closet door leaves when they are not visible.
   - Fight's and the boss's draw calls (the hands are about 50 meshes each, the Warden about 46).
   - The full-width vista window shader.
   
   Then re-measure headed on a quiet machine.
2. The nav graph is not rebuilt when a breakable breaks. Routes stay valid but are a little cautious.
3. The ride's cab is procedural and lit only by its lamp. It could reuse `q_cab` from the kit. A quick look at the exterior shots made them read busy (tower slabs passing).
4. The round-1 ownership rule moved `world.js`/`lift.js`/`floors.js` to arena this round. Fight's `main.js` and `smoke.mjs` already use the floor-3 API.

## For Julius
- **Arena size and shape:** 50 × 48 m, ceiling 26 m, flat (no balconies in v1). Knobs: `?f3size=0.8…1.3` and `?f3ceil=`. Is it big enough, or too big for the slams?
- **Boss position:** at the far end in front of the window wall (default), or `?f3boss=mid` in the middle of the room (the cover near it is removed).
- **Breakable cover:** 9 of the 20 low pieces are coolant-cell cages that a slam destroys (fight calls `breakAt`). Is that the right number and look?
- **Mood per phase:** cool white → amber → dark red with pulsing beacons. Knobs: `?f3light=` (hall power) and `?f3spot=` (the spot on the face).
- **Express ride:** the cab climbs the outside of the tower with the fleet passing, then cuts to the top floor. Is it worth keeping, or should it be a short fade?
- **Names are placeholders for the storyteller:** "EXPRESS LANDING", "SERVICE SPINE", "ANTECHAMBER", "SUMMIT HALL", the "SUMMIT" stencil on the gate and on the columns, and the cab's "03". The boss name in the HUD is fight's placeholder.
