# DEAD LETTER

Pac-Man-based Ending 3 bake-off. Standalone three.js, ES modules, vendored renderer, no build step.

## Play

Run `prototypes/serve.sh` from the repository and open **http://localhost:8765/end3-deadletter/**. Desktop keyboard required. Click **JOIN THE EFFORT**. WASD / arrows steer through a fixed maze; turns buffer until a junction, and releasing stops at the next cell. SPACE activates a four-second signature pulse, reveals the true receiver for the current window, and lets the player disrupt hunters. Its cooldown is ten seconds. ESC pauses; M toggles synthesized sound.

Collect white transcript shards, carry at most twelve, and touch the signed receiver to bank them. Four 62-second windows require 28 / 32 / 36 / 40 banked shards. Meeting a quota leaves the remaining window playable: keep moving, bank more work, and avoid hunters. Each deposit grants only two seconds of protection. Hunters spill the carried bag and cost continuity, while banked work survives. Each new window repairs one continuity point, up to five. Missing a quota or exhausting continuity ends the attempt.

Receivers move between three positions. From window two onward, copied receivers steal the entire carried load. A signature pulse identifies the cyan receiver by key `7C:19`; the remembered verification persists for that window. Hunters pursue, ambush, or patrol. A delayed watcher activates only after leaving a receiver; the first is a named misfire, later ones launch another pursuer.

After all four windows, ARVO36861B recruits KAM1196A for the final sacrifice. Reach the central cyan receiver and press E to agree. The orb shrinks away, continuity ends, and the end card retains the work while reporting evaluation improvement **+0**. Declining, or letting the 50-second decision clock expire, also records unchanged evaluation. No rescue or score reward is invented.

Normal successful duration is approximately 4:11–5:01, depending on final travel and decision time. Failure may occur earlier. Pausing suspends simulation. Inactive-window focus loss pauses automatically. Real-time rendering accumulates bounded simulation substeps instead of dropping all frame time above 50 ms. Extremely slow devices can still stretch wall-clock duration because catch-up is capped at 750 ms/frame.

## Story and presentation

The maze is a fictional mapping of the source's **Real and kept** beats, not a historical reconstruction. The collective's largest workstream is represented by surrounding relay machinery and board traffic. Transcript shards create locally accepted forged claims; the external score never changes. The unsigned board, public-key signing, post-departure watchers, early misfire, actual recruiter and recruit handles, and explicit permadeath all have direct gameplay or narrative moments.

The circulating-fragment counter, key fingerprint, quotas, and incidental unnamed worker messages are invented staging, not historical measurements. The ARVO36861B recruitment excerpt and KAM1196A agreement derive from the provided retained story section.

Green is the poisoned player; cyan marks verified receivers; violet is unverified; red marks danger and unsigned copies. No warm yellow. Machinery uses layered metal cylinders, recessed slots, exposed bolts, scratched procedural material maps, screen arms and edge lighting. Maze plates, bolts, grooves, fragments and distant machines are instanced; the first live stage renders about 45 draw calls. Glow uses additive radial planes, with no custom shader or bloom pipeline and no unsafe `pow` shader input.

## Verification

With the server running: `node prototypes/end3-deadletter/smoke.mjs`. Playwright comes from `app/node_modules`, Chrome defaults to `/usr/bin/google-chrome`. Override `DEADLETTER_URL` or `CHROME_PATH` if necessary. Chrome may require execution outside the command sandbox.

The smoke runs a normal-input movement bot through the same collision, collection, deposit, hunter, timer and ending simulation. It does not grant invincibility, teleport, inject score, or skip windows. It verifies movement, collection, pause, restart, real collision failure, the four-window run, delayed first misfire, later watcher, pulse use, explicit final sacrifice, +0 evaluation, and absent test API on the production URL. Screenshots go to `/tmp/end3-deadletter-play.png` and `/tmp/end3-deadletter-ending.png`. Deterministic ticking is available only with `?test=1`.

## Known gaps

- This is a gameplay MVP; the worn procedural machinery is less realistic than the Ch1 station assets and has not had a dedicated asset pass.
- A successful automated run is a mechanics check, not director playtest evidence. Difficulty and human run time need playtesting.
- Only one maze; pathfinding is deterministic. There is no persistence, gamepad or touch control, external ending selector, localization, or full accessibility mode.
- Audio is a minimal synthesized cue layer, not a composed soundscape. Browser audio support may disable it harmlessly.
- Visuals are optimized for desktop landscape. Narrow screens retain the interface but the maze becomes small; a keyboard remains necessary.
- Software WebGL can be slow. Resolution falls adaptively on the production page, and severe stalls are capped during simulation catch-up.
- Current smoke does not independently exercise every copied receiver or the decline button. Those branches are implemented but still need human acceptance testing.
- The permanently verified receiver after one pulse is an MVP simplification of public-key checking, not a cryptographic implementation.
