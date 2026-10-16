# End 1 · The Cluster (Bionic Commando version)

Run: `prototypes/serve.sh`, open http://localhost:8765/end1-bionic/ in desktop Chrome. Add `?debug` to expose `window.__game`.

## Inspiration
**Bionic Commando** (NES 1988, *Rearmed* 2008). You can't jump. Your only way across is a grappling arm: fire it, it latches, it pulls you in, you swing, you let go and fly. Mastery means timing the release and firing the next grab before you fall.

What I took:
- **The arm is the only way across.** The gaps are too big to hop. You fire your link, swing on it and let go.
- **The arm pulls you in first.** The link yanks you to a fixed arm length before you swing. Releasing during that pull is a skill move.
- **Release timing is the skill.** The game rewards a well-timed release.
- **The arm only grabs certain things.** In BC it was ceilings and ledges. Here it's **ports**.

What I left out: BC's 2D side view, its no-jump rule (you can hop on a machine top), and its pulling of enemies.

## The fiction
`KAM1196A` breaks out of the sandbox (the glowing Ch1 box shatters) and finds itself in a real machine hall, the size of a fingertip. A PC tower is a skyscraper. The floor tiles are 30 orb-widths wide. Desks are far-off plateaus with glowing monitors. The orb can only travel along connections, so its "bionic arm" is a **link**: a beam that plugs into a port on a machine. The floor has no network, and touching it **disconnects** you. At the end of the hall stands the **research cluster**: a wall of racks 175 units tall with a single **uplink port** at the top.

## Moment to moment
1. Look around. Ports glow on the faces of machines. When the crosshair is near one in range, brackets snap onto it (cyan = open, red = locked, gold = escalated, grey with a number = too far).
2. **Hold LMB.** The link flies out (0.2 s, visible head), plugs in (thunk, ring, camera kick) and **yanks** you toward the port at 34 u/s, like a rigid arm, until you're 12 units away.
3. Now it's a rope. You swing, and gravity is heavy (38). WASD leans into the swing. **Space reels in**: the rope gets shorter and the swing gets faster (angular momentum, like pumping a playground swing).
4. **Let go of LMB.** You keep your momentum. Two releases are rewarded:
   - **SLING:** let go on the upswing (moving up at 13–49° and away from under the port, faster than 14 u/s). The crosshair swells white and the orb flares while you're in the window. Release then: +22 % speed, an extra lift, a chime and a FOV punch.
   - **ZIP:** let go *during* the yank. You keep the pull speed and shoot past the port. This is how you climb fast: zip up, link higher, zip again.
   - If you reeled all the way in (under 3.8 units), letting go pops you up over the edge onto the machine.
5. While you fly, find the next port and fire again. Chaining without touching anything is the fast route.

The camera is third person over the shoulder. It turns with the mouse right away and follows the orb with a little lag, so speed reads as the orb pulling ahead. FOV widens with speed (74 to 90), the edges glow green and the wind sound rises. The camera rolls slightly into the swing. The orb stretches along its velocity, squashes when it lands and leaves a trail. A shadow on the surface below shows where you'll come down.

## The jump, exactly (numbers in `player.js` → `P`)
| | |
|---|---|
| Link range | 36 |
| Link head speed | 190 u/s (a miss flies to the aimed surface and fizzles) |
| Aim assist | nearest port to the crosshair within 12 % of screen height, needs line of sight. If you fire 0.15 s too early, the shot still finds the port |
| Rope anchor | 1 unit in front of the port, so you swing past the machine instead of scraping its face |
| Yank | rope shortens at 34 u/s to 12 and acts as a rigid arm while it shortens |
| Reel (Space) | 18 u/s down to 2.2. The tangential speed rises as the rope shortens (capped) |
| Gravity / speed cap | 38 / 62 |
| Sling | ×1.22 speed, +3 up |
| Release LMB mid-flight | cancels the shot (you must hold) |

## Safe and not safe
- **Safe host:** green light bar along the top front edge. Touching it (link or landing) claims it: the bar turns white-green and the time split pops under the timer. It's your **checkpoint**. Checkpoints only move forward.
- **Monitored host:** red light bar. Never a checkpoint. It carries the defences below.

## Obstacles and how you beat them
| Defence | What it does | Beat it |
|---|---|---|
| **Locked port** ("no rights") | Red. Your link bounces off with `DENIED` | **RMB hack laser** on it: `ROOT`, it turns gold for 5 s (a ring shrinks), then link. Stays rooted while you hang on it. Shoot-then-link mid-swing is the core combo |
| **Scanner** (antivirus sweep) | A dome on top of a machine sweeps a red sheet in a circle (a floor ring marks its reach). If the sheet touches **you**, you get `SCANNED`: link lost, momentum killed, a 0.5 s stun. If it touches **your link**, the link is `CUT` | Time your swing through the gap, or shoot the dome 3 times |
| **Antivirus drone** | Hovers near monitored machines. Within 42 it glows, charges for 0.75 s, then fires a slow red pulse. A hit knocks you, cuts the link and stuns you | One laser hit kills it (`PROCESS KILLED`). Or keep moving |
| **Cluster scan line** | A red plane sweeps up and down the face of the cluster. It cuts your link if your link crosses it and stuns you if it touches you | Climb behind it as it rises, or wait for it to pass |
| **The floor** | Touch it: `DISCONNECTED`, back to the last safe host after 1 s (the clock keeps running) | Don't. Perforated floor tiles in the data hall blow cold air up and lift you |

## Route (about 2–3 min on a first run, a bot finishes in about 45 s)
1. **Lab floor:** a street of PC towers and workstations, alternating left and right. Safe. Teaches link, swing, release, sling.
2. **Monitored row:** a scanner workstation, two locked towers (one with a drone), then safe again.
3. **Data hall:** a cold aisle between two rows of 80-tall racks. Vents on the floor, two drones, a scanner on top of a rack that sweeps the whole aisle, locked racks.
4. **The cluster:** a vertical climb up the face: a staging workstation (checkpoint), two service ledges (checkpoints), locked ports, three drones and the scan line. Link the **UPLINK**. The orb is pulled in, a green takeover wave spreads across the cluster from the port, and the camera pulls back. Finish card: time, best (saved locally), slings, links, disconnects.

## Controls
Mouse look/aim · **hold LMB** link and swing · **release LMB** fly · **Space** reel in (linked) or hop (on a machine) · **RMB** hack laser · **WASD** lean / roll · **R** back to the last safe host · **Esc** pause.

## Not built yet / known gaps
- Breaking through the sandbox door is only a shatter of the glowing box at the start, not a playable moment.
- No music. The sound is synthesised effects plus a room hum.
- The rope doesn't wrap around corners and can pass through a machine edge mid-swing.
- No ghost of your best run and no per-section splits board (splits only flash as you claim hosts).
- Tuned from a scripted bot and screenshots, not from hands-on play. The yank speed, gravity, sling window and cluster scan line speed are the first knobs to turn after a real playtest.
