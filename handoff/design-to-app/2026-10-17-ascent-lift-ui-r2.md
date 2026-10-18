# ASCENT lift-ui round 2: lift ride, end card, HUD and sound are in the game (2026-10-17)

**What it is:** lift-ui area report, round 2. Supersedes the "to do" of `2026-10-17-ascent-lift-ui.md` (round 1).
**What changed:** `lift.js` is wired in; new `audio.js`; end card; HUD styling. Files: `lift.js`, `audio.js`, `world.js` (lift block only, now `createLift`), `main.js` (T.lift, T.audio, `startLift`/`updateLift`, `showOverlay`/`fillEndCard`, sound wrapper, `updateAudio`, test hooks `stats`/`audio`/`finishCard`), `index.html` (`#fade`, `#endcard`), `hud.css`.
**What the receiver must do:** see the numbered to-do. Open questions: "For Julius".

## In the game
- **Ride (9.5 s, `T.lift`: duration, walkTime, blendFrom/To, fogFar, railGlow):** player walks onto the platform, close shot, pull-out through the canyon with a camera that lags the rise (the platform visibly climbs a huge tower, fleet passes), back in, eased onto the gameplay camera, dip to black (`#fade`), floor 2 pops in. Rail glow lowered (`railGlow` 0.7). `world.lift` exposes the module.
- **End card** (`showOverlay("finish")`, in `#overlay`): time, takedowns (+ squad takedowns), call-ins, retries, loot, tower strip, tease line badged PLACEHOLDER for the storyteller, FLY AGAIN button (calls `startRun`, focused so Enter works). The in-game HUD fades out behind it.
- **HUD:** hint moved to a top-centre "field note" (no overlap with the player or the lower HUD, checked at 1600x900 and 1280x720); reticle states by `body[data-aim]` (open, enemy, cover with COVER tag, weak with WEAK POINT tag, armour with ARMOUR tag); heat bar gradient with an edge tick; `data-vent="window"` pulses the bar green with "TAP R NOW", `"jam"` turns it red with "VENT JAMMED". The marker follows the draining fill edge, so it needs no extra numbers from combat.
- **Sound** (`audio.js`, procedural): all 29 names (every `sound()` name in the code, the r2 brief list, plus `waveclear`, `heartbeat`/`lowhealth`, `click`). Unknown names return false silently. Combat bed: A-minor drone plus bass/kick/hats/arp, intensity from hostiles, hold (with progress riser), low health, floor 2. `T.audio = { volume, sfx, music, mute }`; M mutes (a small SOUND OFF flag shows). Listen and see spectrograms: `design/3d/end2/lift/audio-check.html` (serve the repo root; 29 sounds + 4 music states OK offline: no NaN, no clipping, no silence).
- Previews: `design/3d/end2/previews/lift-ui-r2-{ride-start,ride-wide,ride-arrival,endcard,hud-1600x900,hud-1280x720}.png`.

## Verified
- Real GPU ride captured at many points; floor 2 starts correctly; replay button works; audio check page passes; in-game `audio.play` for all names true, unknown false, M toggles mute.
- `smoke.mjs` (SwiftShader) plays the whole run to the end card (waits on `state`, so the ride length is free). It fails only the "no console errors" assert because of two 404s from the floors area: `end2-floor2-kit.glb` and `end2-cover-kit.glb` are not there yet (floors falls back to greybox).

## To do
1. Floors: check that the platform really passes the new atrium roof (it looked fine in the ride frames); the wide shot looks in through the glass front.
2. Listen to the kit with real speakers and tune levels (`T.audio`, gains in `audio.js`). I could only check it by offline render.
3. Storyteller: replace the end-card tease (`#ec-tease` in `index.html`).
4. `end2-hq.glb` is not used for the ride: it models the exterior approach in its own coordinates. The own tower canyon in `lift.js` fits the atrium. Revisit if Julius wants the real HQ in the wide shot.
5. Not tested in a real run: the vent/aim HUD states with combat's final values (CSS only, tested by setting the dataset by hand); the combat bed with a real hold.

## For Julius
- Is the ride right (tower canyon, platform climbing past fleet ships, 9.5 s)? Length is `T.lift.duration`.
- Sound has no music of its own beyond a procedural drone/pulse bed. Real music (self-made or open source) later is your call.
- End card tease is placeholder text: "The Scorer's files are above. The climb continues."
