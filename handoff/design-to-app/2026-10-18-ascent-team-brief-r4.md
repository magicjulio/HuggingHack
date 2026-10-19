# ASCENT team run, round 4: floor 3 and the end boss (2026-10-18)

**What it is:** the brief for round 4 of the ASCENT team: three Opus agents, **arena** (floor 3 layout and art), **boss** (the boss model and its look API) and **fight** (floor 3 gameplay and the boss fight).
**Supersedes:** the ownership tables in the earlier team briefs. Every other rule in the round-1 brief (`2026-10-17-ascent-team-brief.md`) still applies: shared-file rules, look and quality, testing and deliverables. Read it first.
**What changed since round 3:** Julius accepted the landing, so don't touch it. Floor 3 becomes the last floor, with an end boss. The direction is in `2026-10-18-ascent-floor3-finale.md`. Read it fully; it is the spec. Julius answered two of its questions (below).
**Open questions:** every gameplay or look choice is a proposal for Julius. Keep each one switchable through `T` or a URL knob, and list it under "For Julius" in your handoff.

## Julius's answers (2026-10-18)
1. **The boss takes damage on the face and on the hands.** The proposal in the finale brief stands: the face always takes rifle damage, and a hand that just slammed stays down for a moment and is a weak point.
2. **In the last phase the emoji gets angrier,** "if that's doable" (Julius: "it would be funny"). Phases 1–2 show the official logo face unmodified. Phase 3 (below about 33 %) blends into an angry face: brows down, narrowed eyes, the smile turned into a snarl or a frown. It stays recognisably the Hugging Face face, and the colours stay the logo's. This is the one sanctioned change to the logo face.

## Ownership, round 4
| Agent | Owns |
|---|---|
| **arena** | new `floor3.js` (corridor + boss arena: layout, geometry, doors, colliders, ground, nav, lighting, culling), `world.js` (all of it this round; nobody else edits it), `floors.js`, `lift.js` (the ride from floor 2's goal up to floor 3 and the floor-3 arrival), `design/3d/end2/floor3/`, the `end2-floor3*` glbs, `prototypes/end2-ascent/FLOOR3.md` (map + contract notes) |
| **boss** | new `boss-model.js` (the boss's look: model loading, rig, expressions, damage states, phase looks, its own fx such as slam dust and cracks), `design/3d/end2/boss/`, the `end2-boss*` glbs, the boss view in `lab.html`/`lab.js` (add a view; don't change the others), `prototypes/end2-ascent/BOSS.md` (the model API contract) |
| **fight** | `main.js` gameplay (`T` except `T.flight`; the floor flow 2 → lift → 3, player, camera, aim, damage, retry, the finish card after the boss), new `boss.js` (the boss AI: slams, tells, weak points, phases by health, waves), `encounter.js`, `actors.js`, `enemies.js`, `enemies-extra.js`, `projectiles.js`, `looks.js`, `building.js`, `smoke.mjs`, `DESIGN.md`, the boss health bar (new elements in `index.html`/`hud.css`), `FLOOR3-REQUESTS.md` (to arena) and `BOSS-REQUESTS.md` (to boss) |

**Shared:** `main.js` belongs to fight; others make no edits there. Put requests in your handoff. `audio.js` takes small additive edits only: new sound names, no changes to existing ones. `index.html`/`hud.css` take new elements or rules for your own feature only. `fx.js`/`models.js` have no owner: small additive edits only. **Don't touch** the landing (`flight*.js`, `barrier.js`, `hq.js`), `floor2.js`, or anything in `app/`. Another session is working in `app/` right now.

## Contract 1: floor 3 level (arena → fight)
`floor3.js` exports `createFloor3(opts) → level` with **the same API as `floor2.js`** (see `FLOOR2.md`), so `building.js` and the section director work unchanged. On top of that it adds:
```
level.arena = {
  section: id,                         // the arena's section id
  center: { x, z, y }, radius,         // the fight space (or rects in the section)
  bossHome: { x, z, y },               // where the boss floats (the face's base point)
  slamZone: [{ minX, maxX, minZ, maxZ }],   // where hands may land (walkable, not inside walls)
  drops: [[x, z, y]], sideDoors: [doorId],  // where waves come in
  breakables: [{ id, collider, break() }],  // cover that slams destroy (optional)
  setMood(k),                          // 0 = calm, 1 = phase 2, 2 = phase 3 (darker, redder lighting)
}
```
- **Layout:** 2–3 **short** corridor sections on floor-2 rules (doors, garrisons), then the arena. The **biggest room yet**: about 2–3× ASCENT CORE, with a high ceiling, spread-out low cover, room to dodge, and the boss at the far end or in the middle. The door behind you closes.
- `world.setFloor(3)` uses this level, like floor 2. **Arena delivers a playable greybox with the full API first**, before any Blender art, so fight can play against real geometry early. Until then, fight works against a stub.
- **The lift:** the ride starts at floor 2's goal (the express lift in ASCENT CORE) and arrives at `level.start` on floor 3. Arena builds the lift geometry and arrival; fight triggers it from the floor flow. Agree on the call in `FLOOR3.md`.

## Contract 2: boss model (boss → fight)
`boss-model.js` exports `createBossModel(opts) → model`. **Boss delivers a procedural placeholder with the full API first** (a rough face and two hands), then swaps in the glb behind the same API:
```
model = {
  root,                                // place at level.arena.bossHome
  head,                                // Object3D: fight aims and turns it at the player
  hands: { l, r },                     // each { root, palm /* Object3D impact point */, radius }
  hitParts() → [{ part: "face" | "hand_l" | "hand_r", object, weak }],   // raycast targets; weak = currently a weak spot
  setExpression(name, k),              // "neutral" | "angry" | "hurt" | "roar", k 0..1 blend; angry = the phase-3 face
  setDamage(stage),                    // 0 | 1 (cracks at 66 %) | 2 (more at 33 %)
  setPhase(n),                         // 1..3: accent glow, colour shift (phase 3 red)
  setHandPose(side, pose, k),          // "open" | "fist" | "slam" | "stuck" (lying after a slam = weak spot glow)
  flash(part),                         // hit feedback
  update(dt, time),
  ready,                               // Promise, resolves when the glb is in
  dispose(),
}
```
- **Look:** the official Hugging Face logo face and its two hands, brought into 3D and **huge** (the face several storeys tall). Keep the shape, proportions and colours recognisable. The realism bar is the Ch1 flag stations (worn, `kit.surface()`), and an armoured, mechanical take is welcome if it still reads as the logo. Hands are separate meshes with their own nodes. Expressions come from bones or shape keys (glTF morph targets) or swappable parts, your call, as long as `setExpression` blends smoothly. The angry face is the round-4 highlight, so make it funny and readable from far away.
- Hero budget ≤ 30k tris for the head, ≤ 8k for each hand.
- Contract changes: the owner writes them in `FLOOR3.md` / `BOSS.md` with a dated line and keeps the old fields working until fight has switched. Fight asks in `FLOOR3-REQUESTS.md` / `BOSS-REQUESTS.md`. **All three re-read the other files at every numbered step.**

## The boss fight (fight), from Julius's direction
- **Hand slams:** a hand rises over the target spot, a **red floor ring** marks it shortly before impact (reuse the Hugger's tell, `looks.ring("lunge")`, or a bigger variant), then it slams. There is damage and knockback in the ring, a shockwave, and camera shake. After a slam the hand **stays down** for a moment as a **weak point**.
- **Damage:** the face always takes damage; hands that are down take crit damage. The boss has **a lot** of health.
- **Three phases by boss health, not time.** Each one brings a **bigger wave** of normal enemies (existing kinds only), and the boss gets **stronger**:
  - **100–66 %:** one hand at a time, long tell (~1.2 s). Wave 1 is small: gunners and shields.
  - **at 66 %:** phase 2, **harder**. Both hands alternate, the tell gets shorter, and the hands can follow or sweep. Wave 2 adds Huggers and a Maintainer that heals the boss through its tether.
  - **at about 33 %:** phase 3, **much harder**. The **angry face**, double slams and slam chains, a shockwave ring to jump over. Wave 3 brings a Warden plus a mix of everything. `level.arena.setMood(2)`.
  - **Each phase change:** the boss is invulnerable for 2–3 s, roars (`setExpression("roar")`), the camera shakes, and the next wave drops in.
- **HUD:** a big boss bar at the top with marks at 66 % and 33 %. The name is a placeholder ("[BOSS NAME]" style) for the storyteller.
- **Squad (Q):** the stagger interrupts a slam that is winding up.
- **Retry:** checkpoint at the start of the current phase, with the boss's health back at the threshold (`T.boss.checkpoint`, on by default).
- **Length:** about 4–6 minutes for a good player. Hard but fair: every hit can be read.
- **The end:** when the boss falls, a short death beat (fight + boss), then the existing finish card. The finish moves from floor 2 to after the boss. **End text stays a placeholder.** The storyteller and Julius decide what happens; never claim the scorer files were found.
- **The floor flow:** floor 2's goal now leads to the lift to floor 3 instead of the finish card. Keep `?floor=` style test entry points working, or add `?floor=3` to start straight on floor 3.
- **Floors 1 and 2 keep working unchanged** (smoke must still pass through them).

## Testing and ports
Arena 8784, boss 8785, fight 8786 (8765 and 8781–8783 are already running; don't stop them). Run `node prototypes/end2-ascent/smoke.mjs` after every big step. Fight extends it through the lift ride and the boss fight to the finish card. Real-GPU screenshots go through `design/3d/tools/shot.mjs`, with the flat-frame check. **Measure fps on the Iris Xe** in the arena with the boss and wave 3 awake, and report the number.

## At the end
- A new handoff `handoff/design-to-app/2026-10-18-ascent-<agent>-r4.md` (done, left, "For Julius").
- Previews in `design/3d/end2/previews/<agent>-r4-*.png`.
- MANIFEST rows for new glbs (status `draft`), and a short final report.
- **No commits.** If you get a wrap-up message, stop at the next safe point: the game loads, smoke passes or the failure is documented, and the handoff is written.
