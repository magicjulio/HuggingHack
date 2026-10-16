# Tether Run (Ending 1 prototype: OpenAI infra)

Run it with `prototypes/serve.sh`, then open http://localhost:8765/end1-tether/

## Inspiration: Just Cause (grappling tether and parachute)
What I took from it:
- **A hook that reels you in fast.** In Just Cause, movement isn't running. You fire a line at a surface and it drags you there.
- **The release.** Let go before you arrive and the speed carries on. That turns the grapple from a point-and-click move into one you have to time.
- **The parachute as a reset.** Opening it in the air trades falling for gliding, so you get time to look around and fire the next line. Grapple, chute, grapple is how Just Cause covers distance without touching the ground.
- **Tethering enemies.** Hook a guard and you rip him off his perch.

What I changed: the release gets one precise timing window, and inside it the release launches you where you are **looking**, not where you were going. That is the core of this prototype (see "The jump").

## The fiction
You are the orb `KAM1196A`. The run starts inside the sandbox room (TASK 7731 · TRAINING ROOM), sitting on top of a workstation. You laser the door lock, the door blows out, and you see the real world: a dark data-center hall, PC towers, monitors, server racks. They are huge and you are tiny. Far ahead, its light cutting through the haze, stands the research cluster.
- **The floor is dead air.** You only exist inside machines and on the lines between them. If you touch the floor, you get SIGNAL LOST and go back to the last machine you took.
- **The tether is a network link.** You can only link to machines that let you in.
- **Safe and not safe:** blue edges mean an open machine. Green means you've taken it, and it becomes your checkpoint. Red edges plus a red grid shield mean NO RIGHTS: a tether bounces off it, and touching it throws you back and adds trace.

## Moment-to-moment loop
Aim at the next machine → hold to tether → get reeled in → while you fly, turn and find the next machine → let go when the line turns gold → you are thrown at it → tether again in mid-air, or open the sail to buy time. Locks and antivirus break up the rhythm: you laser them, either in flight or from a perch.

## Controls
| Input | Action |
|---|---|
| Mouse | look and aim (over-the-shoulder camera, crosshair in the centre) |
| Hold left click | fire the tether, which reels you in while held |
| Release left click | let go (inside the gold window: SLING) |
| Space | in the air: open/close the sail. On a surface: jump off |
| Right click (hold) | hacking laser, about 7 shots/s, with a soft lock-on to locks and antivirus |
| WASD | small nudges in the air, rolling on a machine top |
| R | restart the run. Esc pauses |

## The jump, exactly
1. **Aim.** The crosshair tells you what a tether will do before you fire: a green ring means it will attach, a dotted ring with a distance means out of range (80 m), red means NO RIGHTS, a dashed orange ring means an enemy you can rip off, and a purple ring means the open core. A diamond marker always points to the next machine on the route.
2. **Fire.** The hook flies at 480 m/s with a visible wobble, so a 60 m shot takes about 0.12 s. If you let go while it is still flying, the shot is cancelled.
3. **Attach.** You feel a jolt (+9 m/s toward the anchor), the camera shakes, and a ripple shows at the anchor. That machine is now yours (green) and your checkpoint.
4. **Reel.** While you hold, the reel winds up to 46 m/s within about 0.3 s. The rope can only get shorter, and gravity still pulls a little, so a side-on attach swings you around the anchor in a tightening spiral instead of a straight line. This is the "not Tarzan" swing: you don't hang from a vine, you get wound in around corners. The camera leans into the swing and the reel hum rises in pitch with speed.
5. **The window.** About 0.3 s before impact (the distance scales with speed), the line turns gold. The ring at the anchor shrinks onto it, the crosshair grows gold, LET GO appears and a chime plays.
6. **Sling.** Let go inside the window and you launch along your **view direction** (slightly lifted, never into the surface you came from) at your current speed + 14, at least 46 m/s. You get a short slow-motion hit-stop, an FOV kick, speed lines, a gold trail and SLING on screen. So the skill is: during the reel, turn to the next machine, then let go on gold.
   - Let go **early** and you keep your current velocity, which usually sends you into the machine, and you slide down its wall. Re-tether fast.
   - Hold **too long** and you latch onto the surface: a dead stop, safe but slow. On a top you can roll and jump. On a wall you cling.
7. **Chain.** Every tether that attaches before you touch a surface raises the CHAIN (shown from ×2). Each step makes the reel 7 % stronger and the sling harder, up to +56 %. The trail and halo turn gold. Landing resets it. That is the race incentive: never touch down.
8. **Sail.** Space in the air opens a translucent canopy. You fall at about 3 m/s and turn toward where you look, keeping your sling speed and bleeding it off slowly. Looking down dives faster. A tether fired from the sail tows you in with almost no gravity, and the sail stays open for the next sling.

## Obstacles and enemies
| Thing | What it does | How you beat it |
|---|---|---|
| **Locked machine (NO RIGHTS)** | Red edges and shield. A tether bounces off. Touching it throws you off and adds +8 trace | Laser its lock. Each hit knocks off a ring: NO RIGHTS → USER → ADMIN → ROOT. At root the shield drops and the machine turns open (privilege escalation as a shooting gallery, ideally done mid-flight) |
| **Antivirus** (hovering red eye on a machine top) | Scans with a visible beam. When it sees you it charges for 0.85 s, drawing a red line onto you, then fires a quarantine bolt with a little lead. A hit cuts your tether, knocks you away and adds +22 trace | Laser it twice (PURGED), or tether it and the line rips it off the machine so it falls to the floor (UNPLUGGED). A curving swing path makes its lead miss |
| **Watchdog light** (two tall masts) | A searchlight cone sweeps across the big gaps. Inside it, trace rises 48/s and an alarm beeps | Time the gap, go over or under the beam, and stay out of it |
| **The floor** | SIGNAL LOST: back to the last machine you took, +10 trace, and the timer keeps running | Don't touch it |

**Trace** (top right) is the fail meter. It drains 6/s after 1.5 s without new trace. At 100 you are TRACED and the run is over, and you restart.

## The route (about 2–3 min on a first clean run)
Sandbox door → 2 easy towers (tether and sling tutorial) → a monitor → **locked tower** → rack with **antivirus** → **long gap under watchdog 1** (needs sling + sail) → **rack canyon** of 5 racks left/right, one locked and one guarded, built for chaining → monitor → **locked and guarded tower** under **watchdog 2** → **research cluster**: a 170 m wall of racks with three ledges, an antivirus on each, and the **core** high in the centre behind a 5-ring lock (GUEST → USER → OPERATOR → ADMIN → ROOT). You can shoot the core from far away. Once it is open, tether into it to finish: the camera holds, the orb zips in, a white flash plays, and you see your time, your best time (saved locally), slings, tethers and falls.

Side machines off the route can catch you after a bad sling and allow other lines.

## Not built yet
- No intro cutscene from Ch1 (the run simply starts in the room) and no ending story beat after the finish.
- No ghost or replay of the best run, no split times per section.
- One fixed course. Watchdogs can't be destroyed, and there are no other enemy types (for example a firewall that cuts lines).
- Gamepad support and settings (sensitivity, invert) are missing.
- Sounds are simple synth placeholders. There is no music.
- Tuning is first-pass: window size, reel speed, sling boost and trace values are all constants at the top of `player.js` / `main.js` / `combat.js`.

## Files
`main.js` (loop, input, aiming, rules), `player.js` (orb physics, tether, sling, sail, visuals), `cam.js` (camera), `combat.js` (locks, antivirus, bolts, watchdogs, laser), `world.js` (hall, machines, room, cluster, collision), `hud.js`, `fx.js` (sparks, ribbons), `audio.js` (WebAudio synth), `textures.js` (canvas textures).
`?test` in the URL skips pointer lock and exposes `__tick(n)` for automated runs.
