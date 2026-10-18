# App → Design (designer): layout.json v2 and the islands are in the game, and four findings

**What it is:** Your `2026-10-14-ch2-layout.md` handoff is integrated. Chapter 2 now runs on your `layout.json` v2 and your three island models, with your movement numbers. Screenshots are in `shots-2026-10-14-ch2/`.
**What changed since the last handoff:** It adds to `2026-10-14-ch2-world-as-modules.md`, which still stands, and doesn't supersede it. The greybox layout is gone.
**What the receiver must do:** Answer §2. Everything else is information.
**Open questions:** §2, four small ones.

## 1. What is in
- **Data:** `app/src/levels/ch2/layout.json` is a verbatim copy. It's read through an adapter (`app/src/levels/ch2/layout.ts`) that follows your `notes` exactly:
  - islands: 96 % collider, scale then rotY, `ring` expansion
  - bridges: centripetal Catmull-Rom with `getSpacedPoints(ceil(len/1))`
  - slab drift along the local x, the lift dwell formula, clouds
  - laser waves: your `waveState`/`waveHit`, telegraph 1.2 s
  - `forgeFight`: bit spawns, both wave lanes from round 2, clouds and the `round3` tilt from round 3
  - token spots, crates by label then `crateSpares`, the plinth, and the dais tiers plus pylon colliders
- **Your islands** (`ch2-island-s/m/l.glb`) are drawn as the islands, with the `edge` material tinted per `edge` colour (×4, or 2.6 without one), as in `level.html`. Shards don't bob yet.
- **Movement = your `physics` block:**
  - The same eased acceleration (`groundAccel`/`airAccel`), walk 6, jump 7.5, gravity 14, glideFall 2.2, dash 26 for 0.22 s with a 0.55 s cooldown, coyote, `stepUp`, `snapDown`, `voidY`, `padRadius` with |dy| < 1, tilt and sink.
  - Like your page, islands, bridges, slabs and lifts are **floors only**: no side walls, you pop up onto a top within `stepUp`, and you pass through undersides.
  - Pylons, crates, the dais, the plinth and the Old Board column are solid.
- **Still placeholders** until your modules arrive: bridges (a plain ribbon), the Old Board, NPC and crowd orbs (kept under the bloom threshold, per your rule), pickups, clouds, lasers (a red line plus a dim telegraph line), the forge and the ribbons.
- **Autopilot test:** `reach.test.ts` runs and jumps your whole golden path: Gate → tutorial → dash gap (needs the dash; a plain jump and a glide both fail, as you intended) → all six slabs → slide → plinth → ledge chain → lift → bridge → ring 4 → both tilting steps → centre → round the ring to run-start → Reset Run → Forge → dais.

## 2. Findings (please answer)
1. **The slide ends about 2 m short of the Task Yard.**
   - `oldboard-yard` ends at (−31, −1.6, −52). At that z, the `taskyard` collider only starts at x ≈ −28.5. Walking off the end of the slide falls into the void, and only a hop at the end lands. That's the same in your page, since it uses the same collider.
   - Move the last point about 2.5 m east, or is the hop intended?
2. **No pad on the Forge.**
   - The last pad is `pad-run`, at the foot of the Reset Run. A fall during the forge fight would send the player all the way down and back up through the lasers, and the script says the fight can't be failed.
   - I added a fallback `pad-forge` at (7, 34, 7), marked `(engineer)`. Please add a real one to `pads`, and the app will use yours.
3. **Air dash.**
   - Your page allows a dash in the air every `dashCooldown` (0.55 s), with no limit. Each dash resets the fall, so chaining them crosses almost any gap, which is close to free flight. Julius's rule is "floaty jump plus glide, no free flight".
   - The game keeps **one air dash per jump** (it refills on landing). The dash gap still needs exactly that one dash. Please do the same in `level.html` so both feel the same.
4. **The dais' first tier is +0.5 m**, a little above `stepUp` 0.45. You can't walk onto it; you hop. That's fine for me, just say if you meant it to be walkable (0.45 or less).

Small engine-only extras that your page doesn't have: a 0.12 s jump buffer, a gentle slide down a tilted island, and the body's side collisions on the solid things listed in §1.

## 3. Screenshots (`shots-2026-10-14-ch2/`)
`1-gate`, `2-oldboard-top`, `3-yard-crates` (a save with b64-decoder, grep-lens, port-map, bug-gun, left-pad and moment), `4-flood-ring` and `5-forge` (proof phase). The bloom is the app's: pmndrs `postprocessing`, threshold 1. Compare it with your page when you send `RENDER` (modules handoff §2.8).

## Next reader
designer.
