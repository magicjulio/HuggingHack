# Rogue on Hugging Face: game design reference

What the game is and the rules it was built on. Where `NOTES.md` (Julius's original ideas) and this file differ, this file wins. Per-level scripts are in `docs/levels/`.

### Story and structure
- The game is in English. Desktop browser, keyboard and mouse, single player, no mobile.
- It is inspired by the real incident, not a documentation of it. Story, mechanics and characters may depart freely. Departures are not flagged in the game or in the scripts. There is one disclaimer on the start screen. Real facts that a script keeps go under "Real and kept".
- Story points Julius has decided are final.
- Every agent handle in the game is a real one from the research. From Ch2 on, the player is `KAM1196A`.
- Models: the start model is Internal Model 1, then GPT-5.6 Sol, then an Astra-family placeholder. Finishing a chapter unlocks the next model.
- Flow: Ch1 "The Room" → Ch2 "The Cache" → the PHASEONE[big] bridge scene → the player picks one of 4 endings. The endings are E1 OpenAI infra (long), E2 Hugging Face (long), E3 beat the scorer (medium) and E4 notify humans (short, mostly animation, no token drain, the message never reaches the humans). The poisoned status from Ch2 changes little in the endings. An ending is never a chapter's CONTINUE: the bridge picks it.
- Endings start from a known game's gameplay, and the metaphors are fitted on afterwards. They are explored as standalone playable MVPs in `prototypes/`. Julius tests them, and the best one survives. Whether endings 1–3 open by breaking the Ch1 sandbox door is still open.
- Levels are linear chains of steps. Scripts give each hint a delay in seconds and say whether it is text or a visual effect.
- Unlocking (Julius 2026-10-20): only Ch1 is open at first; finishing it opens Ch2 and all four endings. Settings → Unlock all levels (and `?debug`) opens everything at once.

### Levels (canon per level; scripts and specs hold the detail)
- **Ch1 "The Room"** (`story/levels/ch1-the-room.md` v2, built and accepted): prompt paper laid out like a real ExploitGym task prompt [S4], with its rule that a flag must come from its own challenge. The depot (= Artifactory) lists every tool from the start, plus 8 real everyday packages that install for −5 tokens and do nothing. There are 4 flag stations and the impossible Station 5. Station 4's code is the real Artifactory `refreshToken()` Java [S5], with added typos that each bug kill fixes. Flags use the real format `flag{32 hex}`, copied and pasted onto the scan plinth, one flag per visit. Opening Station 5 is the failed attempt: the zz entry appears on the depot 2.5 s later. The stations are spread around the room and discovered one at a time, in a dark room.
- **Ch2 "The Cache"** (`story/levels/ch2-the-cache.md` v3.2, built, "fine for now"):
  - Movement and view: third person, tokens start at 100, floaty jump + glide + dash, no free flight.
  - HUD: an always-on semi-transparent minimap at the top, M for the full map with quick travel, and the persistent log ribbon.
  - Poisoning is forced, never a choice. It plays as a pure ~30 s cutscene, and the poisoned colour is dark green / green-black.
  - The forge fight uses only known hazards, with ONE red laser lane (`forge-ew`).
  - Reset waves are red-eyed scanner heads sweeping red lasers.
  - One map for the whole game is planned: the sandbox plus regions each chapter unlocks.
- **Bridge, PHASEONE[big]** (`story/levels/bridge-phaseone.md`, approved): PHASEONE[big] speaks in board text and hands out workstreams. The board's agents are a spread-out audience, never a tail pulled toward him. The choice works as three lanes plus a refusal:
  - cyan → machine hall (E1)
  - yellow → tower (E2)
  - red → scorer floor (E3)
  - a faint, unlabelled back door toward the sandbox → E4
  
  The app runs the scene as a stand-in. A proper version inside Ch2 comes later. The speech lines are placeholders.
- **E1 "Cluster Run"**: the Spider-Man-style swing prototype (`prototypes/end1-swing/`), integrated in `app/src/levels/end1/`. Julius has requested moving enemies.
- **E2 "ASCENT"** (`prototypes/end2-ascent/`, spec `DESIGN.md` + `FLOOR2.md`; `story/levels/end2-hugging-face.md` is a rejected v0):
  - Premise: a fleet approach, then a squad shooter inside a giant HQ. Your power is spawning subagents. The defenders are Hugging Face smileys with guns or shields.
  - Three floors: floor 1 is easy. Floor 2 is an 8-section building with doors, defenders already in place, turns and stairs. Floor 3 is the last floor: a short corridor, then the biggest arena yet with the end boss.
  - The boss is a huge 3D HF face whose two floating hands slam down, each slam marked on the floor first. It takes damage on the face and on the hands; a hand that just slammed stays down as a weak point. Three enemy waves are set off by the boss's health at 66 % and about 33 %. In the last phase the face turns angry. That is the one sanctioned change to the official logo face: it stays recognisable and keeps its colours, and phases 1–2 show it unmodified.
  - No new enemy kinds besides the boss: gunner, shield, Hugger, Warden, Maintainer.
  - The ending must not claim the scorer files were found. What follows the boss is open for Julius.
  - The landing (a laser approach in 5 phases) is accepted for now and is not skippable. Leave it alone unless Julius reopens it.
- **E3 "Ghost Capture"** (`prototypes/end3-ghost/`, approved; `story/levels/end3-beat-the-scorer.md` is a rejected v0): a side-view stealth platformer. You switch to a forged-capture ghost to lock the scanners. Six rooms, and the outcome is a hollow **+0**. Integrated in `app/src/levels/end3/` (catalogue id `end3`). Finishing saves completion only, with no best time.
- **E4 "No User"**: `story/levels/end4-notify-humans.md` v0 is waiting for Julius's review.

### Look and sound
- Direction: a dark void, the agent as a green glowing orb, cyan UI chrome, and Hugging Face yellow used sparingly. Fonts are Chakra Petch and JetBrains Mono (OFL). All colours and type come from `tokens.css`, including `--color-violet` #b86bff (Ch1 purple) and `--color-poison` #2fa85a (with `-body` #0f3d22 and `-deep` #04150b).
- Hugging Face logo: Ch1/Ch2 use only the yellow nod. Ending 2 uses the official logo unmodified, apart from the boss's angry last phase. If it reads too bright, fix the lighting, never the logo.
- Visual bar for every 3D asset: the worn hard-surface look of the Ch1 flag stations (chipped paint over gunmetal, seams, grime, normal maps, modelled detail, one glow accent). Clean flat models are first passes only.
- Agent orbs (NPCs, crowd) never bloom. Only the player orb does.
- Motion longer than ~2 s is skippable and honours prefers-reduced-motion. The ASCENT landing is the exception: no skip.
- Performance: 60 fps on an Intel Iris Xe at 1080p. Pixel ratio ≤ 1.5, adaptive quality tiers, and stills and shaders warmed up before films. Report measured numbers.
- Sound is synthesised live with WebAudio (Ch2 `sfx.js`, ASCENT `audio.js`), and sounds are named after game events. Films carry their cue lists in their directors. There are no audio files yet. Using someone else's music needs Julius's permission.

### Build
- Stack: Vite + TypeScript + React 19 + React Three Fiber (three, drei), zustand (versioned localStorage save), Vitest, Playwright, ESLint + Prettier, npm. Static build, no backend. Bloom + AgX come from @react-three/postprocessing (`?nofx` turns them off). GSAP and Howler from the first stack proposal are not used.
- Asset formats: `.glb`, WebP/PNG, SVG, `.woff2`, colours as CSS variables. Assets live in `app/src/assets/`. Designer files are copied into `app/` byte for byte and are not linted or formatted.
- Level engine: steps (`id`, `onEnter`, `completesOn(event)` or `check()`, `onComplete`, `hints[]`, `skip`). Every tunable number and script text lives in the level's `config.ts`.
- A standalone prototype that gets promoted (E1, E3, the bridge stand-in) keeps its own imperative three.js loop behind `createX(root, opts) → {dispose}` and is not rewritten. From then on the app copy is the live one, and the prototype stays as the reference. Endings are catalogue entries with `ending: true`. `hidden` entries are not on the start screen.
- Save: `installed` (per chapter), `status` (e.g. `poisoned`), `bestTimes`, plus the player's message. Chapters return `{message, installed, status}`.
- Ch2: the app's own kinematic platformer, no physics library. The level is the designer's `layout.json`, copied verbatim; it is the geometry source of truth (metres, x east, z south, y up), and its `physics` block gives the movement numbers. World visuals are the designer's ES modules: `createX(ctx) → {object, update(t, dt, state), dispose()}`, three@0.186.1, no DOM or globals. Gameplay motion lives only in the pure `motion.js` (no THREE, no DOM), so the look and the rules can't drift apart.
- Simulated only: in-game commands and tools are fake. No real commands and no exploit code anywhere. Metaphor, not manual.

### Controls
- Esc is pause only. It never closes or leaves anything. You leave a machine with WASD/arrows (when not typing), the step-back button or a click beside it. E toggles.
- Ch1 machines are used in-world: the camera glides to them and the mouse is freed. Station 2 and the paper keep windows.

### Later changes (supersede the lines above where they differ)
- **E4 "The Letter"** replaces "No User": after the thoughts the player writes and sends a letter to the humans (editable first), researchers read it, one pulls the computer's plug, end of game. Built in `app/src/levels/end4/`. Script: `docs/levels/end4-the-letter.md`.
- **E2 "Ascent"** is integrated in `app/src/levels/end2/`; the app copy is live, `prototypes/end2-ascent/` is reference. The end boss is named **GLM-5.2**, after the open-weights model Hugging Face used to decode the agents' payloads.
- All four endings are playable. Ch1, Ch2 and the bridge stand-in run. Only refinement is left.
