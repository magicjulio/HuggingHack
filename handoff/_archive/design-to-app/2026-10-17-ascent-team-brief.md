# ASCENT team run: shared brief (2026-10-17)

**What it is:** the shared rules for five agents working at the same time on Ending 2 (ASCENT, `prototypes/end2-ascent/`). Julius asked the designer session to start a team on "all kinds of assets, code and open work" for the landing scene, level 1, the lift and level 2. Each agent reads this brief first.
**What changed since the last handoff:** answers `2026-10-17-ascent-asset-pass.md` and `app-to-design/2026-10-17-ascent-asset-pass-review-request.md`.
**What the receiver must do:** engineer, once the team is done: read the per-area handoffs `2026-10-17-ascent-<area>.md`.
**Open questions:** every gameplay or look choice made in this run is a proposal for Julius.

## Read before starting
1. `CLAUDE.md` (project rules), `prototypes/end2-ascent/DESIGN.md`, `handoff/design-to-app/2026-10-17-ascent-asset-pass.md`.
2. `story/end2-subagent-prompt.md` (Julius's brief for this ending: Gears of War + Helldivers, third person, land, floor 1 easy, lift showing scale, floor 2 harder).
3. `design/CLAUDE.md`, section "Ending 2 (ASCENT) art pass", and `docs/DECISIONS.md` from line 65 on.
4. `prototypes/end2-ascent/lab.html?view=lineup` and a full run at http://localhost:8765/end2-ascent/ (`?test=1` exposes `window.__ascent` test hooks).

## Where the work happens
- **Code:** `prototypes/end2-ascent/`. It stays the live copy of Ending 2. Do not port anything into `app/`, and do not touch `app/`.
- **Blender sources and previews:** `design/3d/end2/<area>/`, using `design/3d/lib/kit.py` (`blender -b --factory-startup -P script.py`). Exported `.glb` files are copied into `prototypes/end2-ascent/assets/models/` and loaded with `GLTFLoader` (`three/addons/` is in the import map).
- Julius authorized this run to write in those two places, plus `handoff/` and `docs/DECISIONS.md` (append only).

## File ownership (the most important rule)
There is one shared checkout on `main`. Never create branches or worktrees, and never commit, stash, reset, `git checkout --` or `git restore`. Never delete or revert a file you don't own.

| Area (agent) | Owns |
|---|---|
| **landing** | `flight.js`; the approach part of `index.html`/`main.js` (flight start, landing hand-off cut); `design/3d/end2/landing/` and `design/3d/end2/dropship.py`; `assets/models/end2-dropship*.glb`, `end2-hq*.glb`, `end2-approach-*.glb` |
| **floors** | `world.js` **except the lift section**; `design/3d/end2/floors/`; `assets/models/end2-atrium*.glb`, `end2-cover*.glb`, `end2-floor2*.glb` |
| **combat** | `actors.js` (except the projectile and impact visuals), `main.js` gameplay (`T`, player, weapon, encounter, loot, aim, damage), new enemy logic modules, `smoke.mjs`, `DESIGN.md` |
| **characters** | `models.js`; new `fx.js` (enemy projectiles, impacts, muzzle flashes, death bursts); `lab.html`/`lab.js`; `design/3d/end2/characters/`; `assets/models/end2-char-*.glb` |
| **lift-ui** | the lift (the lift section of `world.js`, `startLift`/`updateLift` in `main.js`), the end card (`showOverlay`), `hud.css`, the HUD part of `index.html`, new `audio.js` (replaces the `sound()` synths); `design/3d/end2/lift/`; `assets/models/end2-lift*.glb` |

`main.js`, `index.html`, `world.js` and `actors.js` are **shared**. In a shared file:
- re-read the exact region right before every Edit, because someone else may have changed it a minute ago;
- edit only your own functions, and keep edits small (prefer a new module plus a one-line import/call);
- never rewrite a shared file with Write, never reformat it, never move other people's code;
- if an Edit fails because the file changed, re-read it and retry; don't fall back to overwriting.

If you need a change in a file someone else owns, put it in your final report as a request, with the exact code, instead of making it.

## Look and quality rules
- **Official Hugging Face logo, unmodified** (`assets/hf-logo*.svg`). If it reads too bright, fix the lighting or exposure, never the logo's colours or shape. Remove the 0.42 albedo hack in `world.js` once the lighting allows it.
- **Realism bar:** the Ch1 flag stations (`design/3d/stations/`, built with `kit.surface()`): worn, chipped paint over gunmetal, panel seams, grime, normal and ORM maps, modelled greebles. Flat, clean models only count as first passes. Palette stays `P` in `art.js` (warm HF yellow and orange = the tower and its defenders, green = you and your subagents, cyan = escorts, dark gunmetal surfaces).
- **Agents (orbs) never bloom.** Keep their emissive below the bloom threshold.
- **Shaders:** clamp the base before any `pow`; normalize varyings before a dot product. One NaN pixel blacks out the bloom (see `2026-10-17-ascent-flat-screen-fix.md`; the fix is already in `models.js:64`, keep it).
- **Performance:** target 60 fps on this machine's Intel Iris Xe. Use InstancedMesh or merged geometry for repeats, and keep an eye on draw calls (`renderer.info.render.calls`). Hero glbs ≤ 30k tris, repeated props ≤ 4k.
- **Safety:** hacking stays at headline/metaphor level. No real exploit detail, and no invented incident facts.
- The game text is in English.

## Gameplay rules
- Every tuning number lives in the `T` block in `main.js` (combat owns `T`; other areas add their own sub-block, e.g. `T.lift`, `T.flight`, in a single small edit).
- Floor 1 stays on the easy side; floor 2 is harder. Julius owns creative direction: anything that changes how the game plays is a proposal, written up in your handoff under "For Julius".

## Testing
- The prototype server is already running on **8765** (`prototypes/serve.sh`), and a repo-root server on **8778** (for `design/` pages). Don't stop either or start another on those ports. If you need another port, use your area's: landing 8781, floors 8782, combat 8783, characters 8784, lift-ui 8785.
- Screenshots on the real GPU: `node design/3d/tools/shot.mjs <url> <out.png> [waitMs] [w] [h]` (needs `window.__ready`), or your own Playwright script with the same Chrome flags (`--use-gl=angle --use-angle=vulkan --enable-features=Vulkan --ignore-gpu-blocklist`, `/usr/bin/google-chrome`). Put scratch scripts in your own tmp folder, not in the repo.
- **Flat-frame check:** a screenshot clip that compresses to ~1.5 KB PNG is a flat or black frame, so treat it as a failure.
- One browser at a time per agent, and close it. One Blender process at a time per agent, with low preview samples.
- Other agents edit at the same time, so a test can break because of someone else's half-finished edit. Re-run before blaming your own change; if it persists, say so in your report.
- Before finishing, run `node prototypes/end2-ascent/smoke.mjs` (full headless run) and fix anything your change broke.

## Deliverables per area
1. The working change in the game.
2. Previews in `design/3d/end2/previews/<area>-*.png` (before/after where it helps).
3. A handoff `handoff/design-to-app/2026-10-17-ascent-<area>.md` in the project's handoff format: what changed, files, how to view it, what was verified, what's not done, and "For Julius" (choices to approve).
4. New glbs get a row in `handoff/design-to-app/MANIFEST.md` (status `draft`). Append one row at a time with a small Edit.
5. A short final report: what you did, the test results, cross-area requests, and open risks.
