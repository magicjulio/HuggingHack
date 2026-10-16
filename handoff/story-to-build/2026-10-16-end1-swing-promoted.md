# Story → Build: Ending 1 winner is the SWING prototype

**From:** storyteller · **To:** engineer + designer · **Date:** 2026-10-16
**What this is:** Julius played the four Ending-1 prototypes (the OpenAI-infra "computer-hopping race"). He picked one. This hands the winner to the build and lists the one change he asked for.
**What changed since last handoff:** the four prototypes were built in `prototypes/end1-<name>/` (see `story/levels/end1-prototypes.md`). Julius's verdict is now in.
**Supersedes:** nothing. First Ending-1 build handoff.

## Julius's verdict
- **WINNER — "swing" (Spider-Man-inspired):** `prototypes/end1-swing/`. "the best." This is the Ending-1 gameplay we build on.
- **Deleted — "grapple" (version A):** "the worst", removed completely. Gone from the repo.
- **Archived — "tether" (C) and "bionic" (D):** moved to `prototypes/archive/`. Kept for reference / for borrowing ideas, not a live path.

## The one change Julius asked for
**Add moving enemies to the swing prototype, like C and D had.**
- Today the swing version's threats are mostly stationary: a roof **dome eye** (starts a trace down your line), **no-rights locks** (laser USER/ADMIN/ROOT), and **antivirus drones** that sweep a scan sheet in place like a lighthouse.
- The archived C and D had **moving** enemies worth copying the feel of: C's antivirus eyes that aim a line at you and fire a bolt, and watchdog searchlights sweeping the gaps; D's antivirus drones that charge and fire slow pulses, and scanners sweeping a machine face. Julius wants that kind of active, moving threat in the swing version.
- Not fully specified by Julius beyond "like C and D" — treat the exact enemy design as open (see questions). The point is enemies that move/patrol and actively threaten the player mid-swing, not just static hazards to route around.

## What the receiver should do
- Engineer: take the swing prototype as the Ending-1 base. It's standalone three.js (plain ES modules, no build) — files listed in `prototypes/end1-swing/DESIGN.md`. Decide how it folds into `app/` (it is NOT wired to the app yet; it's its own page using a vendored three.js copy).
- Designer: the look is already strong (dark machine-hall skyline, green orb `KAM1196A`, green/amber/red ports, chain combo, detection meter). The new moving enemies need a visual language that reads at swing speed.
- Everyone: all tuning numbers are first-pass (`T` at the top of `prototypes/end1-swing/player.js`). Julius will playtest-tune; don't treat current values as final.

## Known gaps already noted in the prototype (from its DESIGN.md)
- No real "break through the Ch1 sandbox door" moment (the cube is set dressing). C and D built a laser-the-door opening; Julius liked that idea — worth bringing over.
- No sound beyond synth placeholders; camera can clip into machines on tight whips; line doesn't wrap corners; only checked in headless Chrome, not profiled on a real integrated GPU.

## Answered by Julius (2026-10-16)
1. **Enemies:** build **patrolling drones** (moving through the hall, threatening mid-swing). **Also try sweeping watchdog lights** (from C/D) — prototype them and see if they add. These are the moving enemies to add to the swing version.
2. **Sandbox-door opening:** deferred — it depends on how Ch2's ending flows into picking one of the four endings (the `PHASEONE[big]` scene + the choice, being designed now with the designer). Don't build the door opening into Ending 1 until that flow is set.

## Next reader
Engineer (then designer): start on the patrolling drones (and a sweeping-light trial). Hold the sandbox-door opening until the Ch2→choice flow lands.
