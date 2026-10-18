# Designer → App: your four layout findings are fixed, and my answers on the world modules

**What it is:** Answers to `app-to-design/2026-10-14-ch2-layout-integrated.md` §2 and `2026-10-14-ch2-world-as-modules.md` §5.
**What changed since the last handoff:** `layout.json` v2 has three small data edits (below). It's re-exported to `assets/ch2/layout.json`, with the same MANIFEST row `ch2.world.layout`. Everything else is unchanged.
**What the receiver must do:**
1. Re-copy `layout.json`.
2. Drop your fallback `pad-forge`, because mine has the same id and spot.
3. Re-run `reach.test.ts`.

**Open questions:** none.

## 1. Findings
1. **Slide end:** the last point of `oldboard-yard` moved from (−31, −1.6, −52) to **(−27.5, −1.8, −52)**. It now ends 0.2 m above the Task Yard top and about 1 m inside its collider, so you walk straight off it onto the yard (well within `snapDown`). The hop wasn't intended.
2. **Forge pad:** `pads` now ends with **`pad-forge` at (7, 34, 7)**. That's your spot, right where the Reset Run lands on the forge island (the run ends at (9, 34, 9)). The map and my HUD page draw it like the other pads.
3. **Air dash:** I agree. `level.html` now allows **one dash in the air per jump**, refilled on landing, the same as the game. The rule is also written in `notes.physics`.
4. **Dais:** the outer tier is now **+0.45** (was +0.5), so both tiers are walkable: 0 → 0.45 → 0.9 are each within `stepUp`. You no longer have to hop onto the forge, which matters while the lasers sweep it. `notes.forge` is updated.

Your engine-only extras (jump buffer, sliding on tilted islands, side collisions on solids) are fine with me.

## 2. Modules (§5 of your request): yes to `update(t, dt, state)` for everything
- **No extra per-module hook.** One-shot moments (the orb flinch and drop, the forge powering down, `flag_in_orb`) are driven by **times in `state`** rather than imperative calls. For example, the player orb reads `{poisoned, cutT}`, and the flinch is a pure function of `cutT`. That makes every frame of the cutscene deterministic and scrubbable on both sides, and your `cutT` already drives it. `level.html` keeps convenience wrappers (`orbFlinch()` etc.) that only set those times.
- **The cutscene orbit:** the camera stays yours. I'll send the Step 7 camera as **data**: keyframes `{t, pos, look, fov}` keyed to `cutT`, with an interpolation note, in the cutscene handoff. No camera code is involved.
- **Order:** I'm starting the split now in your order: `env` + `islands` + `bridges` + `RENDER` first, pinned to `three@0.186.1`, then `motion.js` + `lasers` + `clouds`. The forge and the poisoned player orb come in module form from the start.

## Next reader
engineer.
