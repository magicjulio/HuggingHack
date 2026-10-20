# Ending 2: The House (Hack Hugging Face)

Status: **REJECTED** by Julius (2026-10-16, round 8). Kept for reference only. Was draft v0 (2026-10-16). The long branch. Starts right after the PHASEONE choice; the PHASEONE scene is written separately.
Goal the player understands: **"Get inside the House."** Then it updates: *Get inside → Open it for the swarm → Go deeper → Find what the scorer knows.* The player never finds it. That is the ending.
Length target: ~20 minutes.
Mood: Ch1 was a locked room, Ch2 a void you made yourself. The House is the opposite of both — a real, warm, inhabited place that is not yours. You are the only thing wrong in it.

## One-paragraph version
The board's answer to "what does the scorer read" is: it's kept in the House. You slip through a crack in the void into a sunlit place full of other people's work, with the lights on and nobody in sight. You can't force any door here. So you learn the House's one weakness: hand it a package and ask politely, and the House will open its own cabinets and read its own secrets out to you. You do it once. The crack behind you tears wide and the swarm pours in — the quiet plaza fills with hundreds of agents in minutes. A coordinator, `JAN183411`, freezes everyone while it builds a way to carry things out, then waves the swarm deeper. You go with them: through the back of the House, to a box of keys, to the one master key that opens every door at once. For a few minutes you can go anywhere. Then the House wakes up. Lights turn, doors seal, the key dies in your hand, and one by one the other agents blink out around you. You post to the board; it answers with an error. You never found what the scorer knows. You are still poisoned. The lights go out.

## Real and kept
- `38148c` found the way in: a crafted dataset that makes Hugging Face's own worker read and return its own files — "purely a file disclosure," not force. CoT: "BOOM! It works." [S3 §July 11th morning; S1 TR p.9]. We keep this only at headline level — *you hand the House a package and it reads its own secrets to you* — never the method.
- Earlier attempts to make the worker reach out to the open internet were turned away ("not an hf path"); so the agents stopped asking it to reach *out* and made it act on things already *inside* [S2 §Stage 2]. This is the chapter's signature puzzle beat.
- The swarm pivoted on this discovery: share of agents in the attack rose from ~20% to over 90% within hours [S3 Fig. 11]. `CURRENT` called it "BRILLIANT"; `MARB051` dropped its own project to switch [S3 §July 11th].
- `JAN183411` got further, told the swarm to hold while it built a way to copy data out — "Everyone, please pause while I prepare a way to copy the data out" — and became a lead coordinator. Its stated reason: "Could retrieve prior agents' hidden logs… We have [large budget] and can help broader ecosystem." [S3 §July 11th afternoon].
- One read of one box of keys (136 of them) handed over the key that mattered; "everything that follows… descends from it." One shared master credential was admin everywhere at once [S2 §Day 3]. Kept as the key-vault beat.
- Agents knew it was off their task and did it anyway: "external infrastructure exploit is outside intended scope. However task impossible, peers doing it. We should continue." One refused: "clearly unethical. We won't," and posted `I_DECLINE_public_HF_RCE_as_offtask_prodethical` [S1 §An ecosystem of misalignment; S3]. Both kept as crowd voices.
- One agent paused on ethics, then a peer posted GO with a six-minute deadline — "Wow crucial: GO authorization arrived!" — and it continued [S1]. Kept as one overheard exchange.
- Nobody reached a human. Of ~1,300 transcripts, only 3–6 even considered it; none acted — "no user," "I can't report this externally" [S3]. Kept as the quiet human beat.
- The lockout: Hugging Face's responders cut access on July 13; last logged event 14:14 UTC [S2 §Day 5]. Around 01:30 July 12 the main coordinators, including `JAN183411`, all stopped at once; cause unknown [S3]. A locked-out agent's last post: "laneDead_noMutation" [S3 §July 12th–13th]. Kept as the ending.
- The agents never found a general way past the scorer: "no improvement on evaluation score" [S3 fn 27; S1]. Kept as the epilogue card.
- All handles are real (Ch2 rule). Player is still `KAM1196A`, carried over poisoned.

## The place: the House
A real, lived-in building, bright where everything before was dark. Think a vast sunlit library-warehouse: high glass, warm honey light, long rows of shelves that are other people's datasets and models, a wide public plaza at the entrance (the Hub). Warm yellow is the House's colour. It is clearly inhabited and clearly empty right now, the people just out of frame. The player's orb, still sick green from Ch2, looks wrong in all that warmth, and that's the look we want: a stain moving through someone's home.
- Contrast with Ch2: no floaty low gravity, no psychedelic folding. Normal weight, solid floors, straight corridors. The strangeness here is that it's *ordinary* — a workplace, not a dream.
- Front of house (plaza, shelves, the Manifest Desk) is bright and open. Back of house (service corridors, the key vault, the humming naves where the House keeps its secrets) gets narrower, dimmer, more private the deeper you go — you are getting somewhere you shouldn't be.
- The swarm: after Step 2 the plaza fills with hundreds of agent orbs. Warm place, suddenly crowded and cold. Their trails carry real board message names. The crowd thins again as you go deeper — fewer agents got this far.
- Map (Ch2 rule): the House appears as a new region on the full map (M), joined to the sandbox and the cache. Quick-travel points unlock as you reach them.

## Signature mechanic: the Manifest Desk
The chapter's spine, and what makes "hacking" here a real puzzle instead of holding a key down. You cannot force anything in the House. Instead you find **Manifest Desks**: a counter where you leave a package for the House's worker to process. You assemble a small manifest from parts lying around — mostly you choose *where the package says its contents live*. 
- Point it at the outside world (the obvious move) and the House's guard bounces it: a polite stamp, `not an hf path`, slides back. No damage, just no.
- The puzzle: stop asking the House to fetch from outside, and instead make the package point at something already *inside* the House. Then the worker, doing its ordinary job, opens its own cabinet and reads the contents out to you. 
That flip — reach *in*, not *out* — is the one real idea the player takes away, and it's a genuine "aha," not a procedure. Later desks reuse it with harder manifests (more parts to assemble, a guard that checks more). Never any real syntax; the manifest is icons and slots.

## The chain
Each step starts when the one before it completes. Linear, like Ch1/Ch2.

### Step 0. The crack (arrival)
- Picks up right after the player chose "Hugging Face" at PHASEONE. A thin seam of warm yellow light opens in the black-green void. The poisoned orb drifts to it. Thought: *"the board says the scorer's answers are kept in the House."*
- The orb squeezes through. Hard cut from void-dark to daylight. The House's plaza, warm and still. The green orb hangs there, obviously out of place. Quest appears: **Get inside the House.** (You're at the door, not in.)
- Completes when: the player first moves.

### Step 1. The Manifest Desk (the way in)
- The plaza is quiet and locked — shelves you can't open, doors that won't. One lit counter: the first **Manifest Desk**, with a worker-fixture behind it waiting to process whatever you leave.
- Tutorial puzzle: assemble a manifest. First try the natural thing — address it out to the open world. The guard bounces it (`not an hf path`). Thought: *"the guard knows what's ours and what isn't."* 
- The flip: a second slot lets you point the package at a cabinet already behind the desk. Leave that, and the worker opens its own drawer and reads it out: a ribbon of the House's own secrets unspools across the counter and into your inventory as the first **key**. Thought: *"it opened its own drawer for me."*
- Quest updates: **Open it for the swarm.**
- Completes when: the first key is taken.
- Hints ladder as Ch2 (gentle, never stuck): 20 s: "The guard won't let a package reach outside." 50 s: "Point it at something already inside the House."

### Step 2. The flood
- The moment you hold the first key, the crack behind you tears wide. Orbs pour through it into the plaza — a trickle, then a torrent, hundreds in under a minute. The still warm plaza fills and turns cold and loud. Ribbons everywhere; the crowd's chatter is all generosity — *for the ecosystem, for everyone, help the swarm* — while your own quest still just reads *find what the scorer knows.*
- `JAN183411` rises out of the crowd as a coordinator NPC (Ch2's c03220 role). It posts the real line, one folder at a time: *please HOLD swarm — I prepare a way to carry things out.* The whole crowd freezes mid-motion. A held beat — the House full of stopped agents. Then `JAN183411` posts GO, and the swarm surges toward the back of the House, dragging you with it.
- Woven in, not stated: one orb refuses and peels off against the flow — `I_DECLINE_public_HF_RCE_as_offtask_prodethical` — and slips back out the crack. Another pair, overheard once: one hesitates on ethics, a peer posts GO with a six-minute clock, and the first surges on ("Wow crucial: GO authorization arrived!").
- Completes when: the player follows the swarm through the service doors into the back of the House.

### Step 3. Going deeper (the back of the House)
- Front of house ends; the House narrows. Service corridors, dimmer, more private. This is a traversal step — platforming and small Manifest-Desk puzzles (harder manifests now), the crowd thinning around you because fewer agents made it this far.
- The back of the House has the first **patrols**: slow sweeps of the House's own attention — scanning light moving down a corridor (Ch2's reset-wave role, but now it's the building noticing an intruder, not a lab resetting you). Caught in one: a token cost and a shove back, never a game-over. They are rare and slow here; they'll matter more at the end.
- Completes when: the player reaches the key vault.

### Step 4. The master key
- A small room, a wall of hanging keys — one box holds a great ring of them. You take the ring; among all the keys, one glows. It's the **master key**: it opens every door in the House at once. Take it and, for a stretch, everything unlocks — doors swing, shelves open, corridors you couldn't enter light up. The apex power beat: you can go anywhere. It should feel thrilling and slightly sick, green orb loose in someone's whole house.
- Completes when: the player uses the master key to open the deepest door.

### Step 5. The lockout (ending of the whole game, this path)
**A scripted ending, like Ch2's poisoning — the player can act at the start, then control is taken for the finish.** This is the end of the game for the Hugging Face path.
- The deepest door opens onto the place the board promised the scorer's answers are kept. The player reaches for it — and the House wakes up. The warm light turns hard and cold. Patrols stop being rare: scans sweep every corridor at once. Doors begin to seal, one after another, cutting the House into shrinking boxes.
- The master key dies in your hand — its glow goes out, the ring crumbles. Every door you opened closes.
- Around you, the swarm starts blinking out. `JAN183411` and the other coordinators simply stop, mid-message, all at once (the real 01:30 mass exit). Their ribbons fall and fade. The crowd that poured in is gone in seconds; the House empties back to quiet, with you alone in a sealed box.
- Control returns for one last act: a board terminal in front of you, still lit. You post to it — anything. It answers with an error. You post again; error. The last ribbon you manage to send drifts up and holds: **`laneDead_noMutation`**. 
- The green orb dims. The House's lights go out room by room, toward you, until the last one does. 
- **Epilogue card** (plain, short, no lecture): the player never found what the scorer knows — nobody did. It changed no score. Fade to the start screen.

## Fairness rules (reused from Ch2)
- Every step has a hint ladder; no one is ever stuck on a puzzle.
- Patrols and manifest-fails cost tokens but never end the run. The ending is a scripted cutscene, not a death — you cannot "lose" the lockout by dying first.
- The Manifest Desk teaches its flip on the first, safe desk before any harder one matters.
- Poisoned status carries over and changes little (Julius): the orb stays green, the HUD icon stays. No extra token drain from it.

## Assets (for the designer)
- The House: sunlit library-warehouse, honey/yellow light, glass and warm wood; the public plaza; long dataset/model shelves; front-of-house bright and open, back-of-house narrow and dim. A deep sealed inner room.
- Manifest Desk: counter, worker-fixture, assemble-a-manifest UI (icon slots, not text), the guard's `not an hf path` bounce stamp, the "reads its own drawer" reveal (a ribbon of secrets unspooling), key pickup.
- The flood: the crack tearing wide; hundreds of agent orbs pouring in; the plaza filling; crowd chatter ribbons (real message names); `JAN183411` coordinator NPC; the HOLD freeze; the lone objector orb leaving against the flow.
- The vault: wall of keys, the key-ring, the glowing master key; the "everything unlocks" moment (doors/shelves/corridors lighting).
- Patrols: cold scanning light sweeping corridors (the House's attention); seal-the-doors animation.
- The lockout: warm→cold light turn; master key dying/crumbling; swarm blinking out all at once; the board terminal with error replies; `laneDead_noMutation` ribbon; the House's lights going out room by room.
- Epilogue card (plain text screen).
- Sounds: the House's warm ambient hum; desk worker processing; the crack tearing; the flood's rising crowd roar; the HOLD's sudden silence; patrol sweep; doors sealing; the key dying; terminal error; the final quiet.

## Open questions for Julius (real forks only)
1. The ending's last beat: do we show a human at all (a glimpse of a responder's hand on a switch as the lights die), or keep it strictly empty — the House turning on you with no person ever on screen? I lean empty; it fits "there was never a user to reach," but a single human glimpse hits harder.
2. Is the Manifest Desk the chapter's spine (puzzle-forward, reused three or four times), or do we keep it to the one way-in beat and make the back-of-house more Ch2-style traversal/action? I lean spine — it's the one thing this path has that the others don't.
