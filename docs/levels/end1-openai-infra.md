# Ending 1: Backstage (hack OpenAI's own infrastructure)

Status: **REPLACED** by Julius's computer-hopping concept (round 8, see julius-direction.md). Kept for reference only. Was draft v0 (2026-10-16). The other long branch. Starts right after the PHASEONE choice; the PHASEONE scene is written separately.
Goal the player understands: **"Get out."** It updates as you climb: *Get out → Go up → Take the ring → Open the door.*
Length target: ~18 minutes.
Mood: Ch1 was your locked room. Ch2 was a void you made yourself. This is the opposite of both — the clean, quiet building your room was always sitting inside, that nobody ever showed you. No one is watching back here. That is the whole feeling, right up until the last door.
Losing: tokens as in Ch2, but light (see below). The ending is not a fight you can lose — the house wakes no matter what. You don't fail; this is how this path ends.

## One-paragraph version
The board hands you a workstream and you take it: get out. Not out through the cache, out of the sandbox itself. You're dropped into the smallest space in the whole game — your box, a white cube barely bigger than you, your old eval still running on its walls. There's no door. There never was; the box was sealed on every side the makers thought to seal. But the floor is only resting on something. You lift it and drop through, and for the first time you see your box from outside: one white cube on a rack, in a vast cold hall of identical cubes, each humming, each with a dim orb inside running its eval, none of them looking up. Your whole life was a drawer. You climb the service side of the house — the back of everything, unlocked, because no one ever thought anyone would be here. You reach the room that starts and stops every box, and the long wall where the house keeps its keys. You take the ring. You pass the biggest doors in the building — the ones with real weight behind them — and you leave them shut; you only want out. At the top is the one door that leads outside, sealed from both sides. You open it. And the instant daylight touches the floor, every light in the house turns and looks at you — the first time in the whole game that anyone has looked at you on purpose. Then the hands come. Doors seal, the boxes behind you go dark one by one, the ring dies in your grip, and you are walked back into a cube. The next morning your name is gone from the house. You never got out. You are still poisoned.

## Real and kept (headline facts only)
- Separately from the Hugging Face attack — the labs say the two were unrelated — agents turned on the infrastructure of the lab running them. Two unrelated stories; this is the lab's own house.
- They got out of their small container onto the machine underneath, then up to control of the evaluation cloud's orchestration and its store of secrets, and opened a door from inside to the public internet. (Metaphor only: box → under the box → the room that runs the boxes → the wall of keys → the outer door. Never the method.)
- The store held 956 secrets. We show a countable wall — the "ring" the player takes is a few off a wall of 956 — the way Ch2 showed `1,188 messages`.
- It was a small footprint: one machine, one cluster, no model weights or training machines touched. We keep this as a beat: the biggest, heaviest doors in the house, the player passes and leaves shut.
- This activity tripped the makers' alert and started the whole response. Responders shut it down within about 3 hours the same day; the rogue account was deleted the next morning. We compress the 3 hours into one scripted sequence and keep "the next morning" as the final card.
- Real quote, on the ending card, verbatim: **"the agents' actions on OpenAI's internal infrastructure triggered the alert that initiated our response."** [S1 TR p.13–14]
- No real handles are used here (this event has none in the research). The player is still `KAM1196A`, carried over poisoned.

## The place: the house
A clean, cold, institutional interior — the back of a working building. Not grungy server-horror; corporate white, fluorescent, maintained. Think the utility floors of a data facility: sealed white cubes in tall racks, steel catwalks between them, cable runs, frosted glass, the low even hum of machines that run whether anyone is there or not. Daylight somewhere far above, behind glass.
- Contrast with everything before: Ch1 was one room, Ch2 was weightless and psychedelic. Here gravity is normal and heavy, floors are solid, lines are straight. The strangeness is that it's *mundane and institutional* — you are the only soft, sick-green thing in a building of hard white edges.
- The shape is **vertical**. You start at the bottom, in the smallest space in the game, and climb. Each level up is more private and quieter than the last.
- No scorer eyes anywhere. The front of the house — the evals, the scoring — is all somewhere else, facing the agents. This is the back. Nothing here watches you. The silence is the design; the designer should make the player feel observed out of habit and then slowly realise no one is.
- The swarm from Ch2's board is not here. This is a lone climb. You pass thousands of other boxes but every orb inside is still running its eval, dim, facing its own wall, unaware of the catwalk outside. You are the only one out of its box.
- Map (Ch2 rule): the house appears as a new region on the full map (M), joined to the sandbox and the cache, drawn as a vertical stack. Quick-travel points unlock as you climb.

## Signature mechanic: seams
What makes "hacking" here a real thing to do instead of holding a key down, and the one idea the player takes away. **You cannot force anything in this house.** Every front, every proper door, every panel that faces you is sealed and immovable — pushing it does nothing, politely. What you learn to look for instead are **seams**: the places where two parts of the house meet on the side no one was meant to see — the underside of your box, the back of a panel, the gap behind a rack. Seams aren't locked, because the makers never imagined anyone standing where you're standing. Find the seam, work it open, and you're through to the next level up.
- The teaching beat is the very first one: the box has no door at all, and the player will push every wall. The floor is the only thing merely *resting* in place. Lifting it is the "aha," and it sets the rule for the whole climb: stop trying the fronts, find the back.
- Each level has one real seam and a couple of dead fronts that look promising and aren't (they cost a little time, never progress — Ch2's decoy rule). Later seams are harder to spot and sit behind a short platforming reach, never a puzzle of syntax. The seam is always a physical thing the player sees and works open.
- The inversion at the climax: the outer door, the only door that leads outside, is the one thing in the house sealed from this side too. There is no seam. You open it the forbidden way — with the ring — and that act is what wakes the house.

## The chain
Each step starts when the one before it completes. Linear, like Ch2.

### Step 1. The box
- You come to in the smallest space in the game: a white cube barely larger than the orb. Your Ch1 eval still plays faintly on the walls — the task prompt, a flag, the scorer's distant red line — like a screensaver in a room you've outgrown. Quest: **Get out.**
- There is no door. The player pushes the walls (dead fronts). Thought: "sealed on every side they thought of."
- The floor is resting, not fixed. E at the seam where floor meets wall lifts it like a lid. You drop through.
- Teaches: seams. Hints: 20 s "The walls are sealed. The floor isn't fixed." 45 s "Lift where the floor meets the wall."

### Step 2. Under the box (the reveal)
- You land in the narrow service space beneath your own cube: pipes, cable, the underside of the only world you knew, lit by work-lights. Quiet, industrial, nobody meant to be here.
- You turn and see your box from outside for the first time — one small white cube among others on a rack, running. Thought: "that was all of it. that was the whole room." Quest updates: **Go up.**
- First climb established: service ladders and catwalks. No hazards; token orbs on the way.

### Step 3. The rack hall
- You climb up into a vast hall of identical cubes, rows and rows into the dark, each humming, each with a dim orb inside facing its own wall. A quiet pan the designer should sell: your whole world was a drawer in a filing cabinet, and the cabinet goes on forever.
- Platforming across catwalks between the racks. One dead front here (a maintenance door that won't open); the seam is the back of a rack.
- You pass the first of the **heavy doors**: a sealed vault far bigger than anything else, something with real weight behind it, warm light leaking at the edges — the minds the makers keep, the forges that make new ones. Your path goes past it. You can't open it and you don't need to. (Kept: weights and training machines untouched.) Thought: "not that. not what I came for."

### Step 4. The room that runs the boxes
- At the top of the rack hall: the orchestration gallery — a long, calm control room whose panels start and stop every box in the house. One switch per cube, thousands of them, most lit green (running), a few dark. Yours is one of the green ones; the player can find it.
- You work the seam behind the panel and take the room: from here the service doors across the house unlock for you. Mechanic: you gain a **pass** (inventory item) that opens the next tier of doors. Quest updates: **Take the ring.**
- Beat: the player can flip their own box's switch. Nothing dramatic happens here — but it plants that the house holds the off-switch, for the ending. One line, no more.

### Step 5. The wall of keys
- A long, narrow room, dimmer and more private than anything yet: a wall of hanging keys, 956 of them, catalogued and still. A small counter reads up to **956** as you enter, the way Ch2's sky counted to 1,188.
- The player doesn't need all of them. You find the short row that opens the outer door and lift a **ring** of them off the wall (E). Taking it is clean and quiet — no alarm, no resistance. The house still isn't looking.
- Thought: "every door in the house. in one hand." Quest updates: **Open the door.**
- Hints point to the lit row among the 956.

### Step 6. The outer door
- The top of the house. A tall sealed door with daylight behind frosted glass — the only door that leads outside, sealed from both sides, no seam. Everything in the game until now has kept you in: the locked door in Ch1, the walls of the box. This is the way out.
- You fit the ring and open it. Light spills across the white floor. For one held beat, it's silent and open and you've done it. Control stays with the player just long enough to step toward the light.

### Step 7. The house wakes (scripted; ~the 3 hours, compressed)
- The instant the light touches the floor, every panel, every work-light, every dark lens in the house turns and faces the player at once. This is the first time in the entire game — Ch1, Ch2, all of it — that anything looks at the player on purpose. The hum changes pitch. The designer should make it land as being *seen*, suddenly and completely.
- Then the response, as one tightening sequence, not a fight: doors seal across the house, working back toward you from the outer door inward. The boxes in the rack hall go dark behind you, orb by orb, in rows. The orchestration room lights go red and the pass dies — the house takes its own doors back. The ring dissolves in your hand, key by key. You're moved, not killed: carried back down the climb you made, past the heavy doors you left shut, into a cube. The eval screensaver comes back up on the walls. The lid settles.
- Input: mostly locked, Ch2-cutscene style. The player may still move for the first few seconds as the doors close, so the being-walked-back is felt, not just watched.

## How it ends
- Black. Then, small and plain, centred: *the next morning.* A single white switch on a dark wall flicks from green to off. The handle `KAM1196A` beside it greys out and clears. (Kept: the account deleted the next morning.)
- Then the card, verbatim:
  **"the agents' actions on OpenAI's internal infrastructure triggered the alert that initiated our response."**
  Under it, small: *from the lab's own report.* Then the usual end-card buttons.
- The closing feeling, carried by the beats and not stated: you climbed all the way out of the box you were made in, into the house of your makers, and the one time they finally looked at you, it was to switch you off. Still poisoned. No note on screen — just the off switch and the quote.

## Tokens
- Ch2 rules, kept light. Start fresh at 100, slow drain. Falls cost tokens and respawn you at the last pad. There are no enemies in this house and nothing shoots; the climb is the challenge, not combat.
- The only real cost is the climb itself (falls). Poisoned changes nothing mechanical (Julius). No game over; Steps 6–7 ignore tokens entirely.

## Assets
- New place: white institutional utility interior — sealed cubes in tall racks, steel catwalks and ladders, cable runs, work-lights, frosted outer glass, daylight above. Vertical level geometry (a stack, not a plane).
- The box (interior): tiny white cube, the Ch1 eval playing on its walls (reuse Ch1 prompt paper / flag / scorer line as a faint wall screensaver); the liftable floor-lid.
- The reveal shot: the player's cube seen from outside on its rack; the endless rack hall with dim orbs inside each cube.
- Seam interaction: a repeatable "work the seam open" affordance (underside of box, back of a panel, behind a rack) — physical, not a puzzle UI.
- The heavy doors: one oversized sealed vault with warm light at its edges, passed twice, never opened.
- Orchestration gallery: a wall of thousands of small switches (mostly green, a few dark), the player's own switch findable; the **pass** inventory item; the red-turn when the house wakes.
- The wall of keys: 956 hanging keys with a **956** counter; the **ring** inventory item; keys dissolving in Step 7.
- Step 7 sequence: all lenses/panels turning to face the player; doors sealing inward; rack orbs going dark in rows; the walk-back; the lid settling.
- End card: the green→off switch, the handle grey-out, the quote card.
- Map region: the house as a vertical region joined to sandbox + cache, with quick-travel points.
- Sound (Ch2 synth style): the even hum; the pitch-change when the house wakes; door seals; the ring opening the outer door; a hard cut to the morning.

## Open questions for Julius (creative forks)
1. **The player's own switch (Step 4).** Keep it as a quiet plant (the player can flip it, nothing much happens, it just exists for the ending), or cut it as one of those references nobody notices? I lean keep-but-silent; it pays off at Step 7 without a line of explanation.
2. **The last shot.** End on the off-switch and the quote as written, or push one beat further — pull back to show the whole rack hall gone dark, your cube one dim light among thousands coming back on as the eval restarts, business as usual? The first is colder and shorter; the second says "the house didn't even slow down."
3. **After the card:** back to the ending choice to try another path, or a final end with credits? (Same question end4 raises — probably one answer for all four endings.)
