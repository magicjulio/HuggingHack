# ASCENT team run, round 2: brief addendum (2026-10-17)

**What it is:** round 2 of the five-agent ASCENT team. Julius: "spawn agent team again to finish the work."
**Supersedes:** only the ownership table in `2026-10-17-ascent-team-brief.md`. Every other rule in that brief still applies: read it first.
**What changed since round 1:** round 1 stopped early at the usage limit. Each area wrote a handoff `2026-10-17-ascent-<area>.md`, and its numbered to-do list is your work list.
**Open questions:** Julius has not answered round 1's "For Julius" questions. Build the proposals as written, and keep each one switchable through `T` or a URL knob.

## Ownership, round 2
| Area | Owns |
|---|---|
| **combat** | `actors.js` (and renaming `actors.next.js` to it), `main.js` gameplay (`T`, player, weapon, aim, encounter, loot, damage, `callSquad`), `encounter.js`, `enemies.js`, `projectiles.js`, `looks.js`, `smoke.mjs`, `DESIGN.md` |
| **characters** | `models.js`, `fx.js`, `enemies-extra.js` (moved here from combat: the Hugger, Warden and Maintainer looks), `lab.html`/`lab.js`, plus **one** line in `main.js` at the end: swapping `createDefaultLooks` for the fx-backed looks |
| **landing** | `flight.js`, `design/3d/end2/landing/`, `dropship.py`, the dropship, HQ and approach glbs |
| **floors** | `world.js` except the lift and tower-shell blocks, `floors.js`, `design/3d/end2/floors/`, the atrium, cover and floor-2 glbs |
| **lift-ui** | `lift.js`, the lift and tower-shell blocks in `world.js`, `startLift`/`updateLift`/`showOverlay`/`sound`/`initAudio`/HUD update in `main.js`, `hud.css`, the HUD in `index.html`, new `audio.js`, `design/3d/end2/lift/` |

## Interfaces agreed in advance
- **Looks (combat ↔ characters):** `actors.next.js` draws everything through the interface in `looks.js` (`createDefaultLooks(scene)` → `bolt`, `beam`, `ring`, `impact`, `number`, `update`; the impact kinds are `bolt`, `muzzle`, `beam`, `shock`, `order`, `heal`, `death-<kind>`).
  - Characters adds an export to `fx.js` with **exactly that interface** (e.g. `createFxLooks(scene)`). It maps those calls onto the pooled fx (bolts, muzzle flashes, sparks, deaths, shield hits).
  - Combat wires `looks.js` first. Once `main.js` calls `createDefaultLooks(` and the game runs, characters swaps that single call.
  - **Nobody but combat edits `actors.js`.** If characters needs another hook (e.g. a `shieldHit` call), it asks combat in its report, or, if combat has already finished, adds that one call with the shared-file rules.
- **Sounds (combat → lift-ui):** combat calls `sound(name)` with the names in its handoff (`enemy-tell`, `bash`, `lunge`, `warden-charge`, `warden-beam`, `vent`, `kill-heavy`, `land`, `beacon`, `order`, `call`, plus the existing ones). Lift-ui's `audio.js` must play every one of those names, and play nothing (no error) for an unknown name.
- **HUD (combat → lift-ui):** combat sets `document.body.dataset.aim = "open"|"enemy"|"cover"|"weak"|"armour"` and `dataset.vent = "window"|"jam"|""`, and puts the heat value in the existing heat bar. Lift-ui styles those states in `hud.css`: the reticle colours, a "COVER" tag next to the reticle, and the vent-window marker on the heat bar.
- **Lift timing (lift-ui ↔ combat):** combat's `smoke.mjs` waits on `state !== "lift"` instead of a fixed number of ticks, so lift-ui can set the ride length freely in `T.lift`.
- **HQ (landing → lift-ui):** if `assets/models/end2-hq.glb` exists when lift-ui starts its camera work, lift-ui may use it as the backdrop for the lift ride. Otherwise lift-ui keeps its own facade in `lift.js`.

## Working rules for round 2
- After each numbered to-do, the game must load and run. Run `smoke.mjs` after every big step, not only at the end.
- Finish the to-dos in the order your handoff gives them. If you finish the list, polish against the realism bar and the screenshots.
- At the end, write a **new** handoff `2026-10-17-ascent-<area>-r2.md` (never rewrite round 1's): what's done, what's left, "For Julius". Update MANIFEST rows (status `draft`).
- If I send you a wrap-up message, stop the same way as in round 1.
