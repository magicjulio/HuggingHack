# Cluster Run (end1-swing)

Ending prototype for the OpenAI-infra ending. Serve with `prototypes/serve.sh`, open http://localhost:8765/end1-swing/.

## Inspiration: Spider-Man (Insomniac web-swinging)
What I took:
- **The city is the level.** Computers are the skyscrapers. You are a small green orb (`KAM1196A`) in a dark hall where towers, server racks and monitors stand 40 to 110 units tall. The orb is 1.2 units across.
- **Momentum is everything.** A line that snaps tight turns your fall into a swing instead of stopping you. Letting go throws you. The faster you link swings together, the faster you go.
- **Camera sells speed.** FOV opens with speed, the camera leans into the swing, there are speed lines and a trail, and the camera turns toward your flight when you stop moving the mouse.

What I changed: Spider-Man picks the anchor for you. Here **you aim every line yourself**, and lines only stick to **ports**. That makes aiming and fast orientation the core skill, which is what Julius asked for.

## Moment to moment
Look ahead and find a glowing port. Aim at it, hold right mouse, swing. Let go on the forward arc. While you're flying, find the next port and connect again within 0.85 s for a **chain**. Shoot what blocks you without letting go of the line. Repeat about 40 times down a hall about 2.4 km long, then climb the cluster wall to the core on top. The timer runs the whole time.

## Controls
| Input | Action |
|---|---|
| Mouse | look / aim (crosshair at centre) |
| Hold **right mouse** (or **F**) | fire the line at the aimed port. Hold to stay connected, let go to fly |
| **Left click** (hold for auto-fire) | hacking laser |
| **Space** | while connected: zip in and launch. On a roof: jump |
| **W / S** | while connected: reel in (smaller radius, faster whip) / let line out |
| **A / D** | while connected: push the swing sideways. In the air: small drift |
| **R** | restart run. **Esc** pauses |

## The jump, exactly
1. **Aim.** The aim assist is a small cone (about 6° or 5 units around the crosshair). It picks the port nearest the crosshair that is within 92 units and faces you. Brackets lock onto it with its state and distance: `OPEN 54`, `WATCHED`, `NO RIGHTS 1/3`. Ports that are too far show grey `OUT OF RANGE`. If you fire with no lock, the line whips out and falls back (a miss costs time).
2. **Fire.** The line travels at 750 u/s, so it lands in about 0.1 s with a visible wave. Releasing the button before it lands cancels it.
3. **Latch.** The rope length is set to your current distance. If you're standing on a roof, the line yanks you off it.
4. **Swing / whip.** Rope physics with no stretch. **The moment the line snaps tight, 65% of the speed it would have killed goes into the swing**, so you whip around a port instead of stopping dead. Below the port a small push keeps the arc alive. Ports sit on the vertical corner edges of towers, so a swing often **whips you around the machine's corner**: you come in along one side and leave along the other. Monitor panels have ports on their underside for classic pendulum swings beneath the screen.
5. **Shape it.** W reels in, which shrinks the radius, raises the speed and gives a tighter turn. S pays the line out. A/D push the arc sideways.
6. **Release.** Let go of right mouse and you fly off along the tangent, with a small upward pop.
7. **Chain.** Connect again within 0.85 s without touching anything and you get CHAIN ×n: +6% speed and a higher speed cap (64 + 5 per link, up to ×5). The trail and line glow brighter, the FOV opens and a rising chime plays. Hitting a wall hard, landing, being traced or being scanned resets the chain.
8. **Zip-launch (Space).** The line reels in at 110 u/s. At the port you're thrown up and forward. This is how you gain height to reach taller machines, and it's the whole climb up the cluster wall.

Falling to the floor is **LINK LOST**: after 0.9 s you respawn on the roof of the last machine you connected to. The timer keeps running, and you float until you give input.

## Machines: safe and not safe
The port colour tells you what you can do:
- **Green, open.** Connect freely.
- **Amber, watched.** A dome camera on the roof watches the machine. Connecting starts a **trace**: a red pulse runs down your line from the port toward you, and the ticking speeds up as it gets closer. It arrives after 1.15 s and you are **TRACED**: the line is cut, you lose 45% of your speed and get +34 detection. Either swing short and let go in time, or **shoot the eye** (1 hit). All its ports turn green, and a trace already running is cut ("TRACE CUT").
- **Red, no rights.** The line bounces off ("NO RIGHTS"). The port has three lock rings. Each laser hit removes one: USER, ADMIN, ROOT. Then it's green. This is meant to be done mid-flight: hold the line, shoot the next lock, let go, connect.
- **Antivirus drones** float in the gaps between machines and sweep a red scan sheet around them like a lighthouse. Touching the sheet means **SCANNED**: line cut, -30% speed, +28 detection. Two hits destroy one.

**Detection** (bottom left) cools down after 2.5 s without a hit. At 100% you get CONNECTION TERMINATED and the run restarts.

## The course (seeded, the same every run)
The hall is 38 rows of 3 to 4 machines, meandering, with decor towers along the edges. The zone name is shown under the goal line:
1. **Open machines** (rows 0–6). Green only, plus one monitor. Learn swing and chain.
2. **Watched machines** (7–14). Half the machines have eyes.
3. **No rights** (15–22). About 40% of ports are locked.
4. **Antivirus** (23–30). One drone per gap, plus watchers and locks.
5. **Server racks** (31–37). Tall racks, which you have to zip up to reach.
6. **The research cluster.** A wall 560 wide and 300 tall with blinking rack LEDs. It ignores fog, so it is visible from the start. It has a checkerboard of ports (some locked) and four drones. You climb it with connect, Space, connect. The **core** is a white ring on top with a beam. Connecting to it zips you in automatically. That ends the run and shows the finish screen: time, best time (saved locally), chains, takedowns, unlocks, times traced, falls.

A run starts on the start roof in front of the blown-open `SANDBOX 7731` cube: the camera looks back at the door during the 3-2-1, then turns to the hall. An autopilot bot that never shoots finishes in about 85 s. A first human run should take 2 to 4 minutes.

## Files
`main.js` (loop, input, camera, HUD, events) · `player.js` (line physics, all movement tuning in `T`) · `world.js` (seeded hall, ports, colliders, cluster shader) · `enemies.js` (eyes, drones, locks, laser picking) · `fx.js` (glow points, ribbons, beams, outlines, speed lines) · `audio.js` (WebAudio synth) · `textures.js` (canvas textures).

## Not built / known gaps
- No breaking through the Ch1 sandbox door. The cube is only set dressing at the start.
- No predicted-arc preview, no ghost of your best run, no leaderboard.
- The camera can clip into machines on tight whips (you see through the wall). It doesn't collide yet.
- The line does not wrap around corners. It passes through geometry.
- Not tuned against human playtests: `T` in `player.js` (gravity 34, cap 64, trace 1.15 s, chain window 0.85 s) is the first place to adjust.
- Only checked headless (software GL). Not profiled on a real integrated GPU. It uses about 200 draw calls with instancing.
- `window.__game` exposes test hooks used by the automated smoke test.
