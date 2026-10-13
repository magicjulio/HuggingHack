# Designer → Design2: onboarding and the Ch2 work split

**What it is:** Your start file. Julius hired a second designer (you, **design2**) because Ch2 is a lot of work. This file tells you what you own, what I (**designer**, "design1") own, and the shared rules that keep our work compatible. Read all of it before you touch anything.
**What changed since last handoff:** First file in this channel.
**What you must do:** Read the list in §1, then start on §3 slice A and show Julius early (§6).
**Open questions:** None for me. Ask Julius anything creative.

---

## 0. Who you are
- You run as the same `designer` agent (`.claude/agents/designer.md`) with the same memory folder (`.claude/agent-memory/designer/`). You can read everything I learned about Julius there, but **not** our chat. Everything from the chat that matters is in this file.
- Call yourself **design2** in handoffs, commits and `design/CLAUDE.md` sections. I'm **designer**.
- You and I share one checkout: repo root `/home/julio/Desktop/HuggingHack`, branch `main`. No worktrees or branches (root CLAUDE.md).

## 1. Read first (in this order)
1. `/CLAUDE.md` (ground rules, roles, handoff protocol) and `NOTES.md` (Julius's vision, read-only).
2. `story/levels/ch2-the-cache.md` **v3.2**, the final Ch2 script. Julius: "this is the final script, the end product must be what is described in it."
3. `handoff/story-to-build/2026-10-13-chapter2-v3.md` and the map sketches in `handoff/story-to-build/2026-10-13-ch2-map/` (`top-down.png`, `side-profile.png`, SVG sources).
4. `docs/DECISIONS.md` (all of it; it's append-only).
5. `design/CLAUDE.md` (our shared conventions and status) and `design/3d/HOWTO.md` (the 3D pipeline Julius approved).
6. The memory index `.claude/agent-memory/designer/MEMORY.md` and every file in it. They hold Julius's taste.
7. The engineer's formats: `handoff/app-to-design/2026-10-11-stack-and-asset-formats.md`, plus the newest `app-to-design` file.
8. The look so far: open `design/ch1/index.html` (approved 2D UI kit: HUD, quest list, windows) and `design/3d/ch2/index.html` (my Ch2 vibe pass 1, the look of the void). Screenshots are in `design/3d/ch2/previews/`.

## 2. How Julius works (the short version of the memory files)
- **Show early, in small slices, then stop for review.** He reviews by looking. Long silent planning reads as "no progress". For a multi-part job, post a short plan (a table) first, then build one slice and show it.
- **The quality bar is high.** Flat or simple mockups get rejected ("terrible", "too simple"). The 2D HUD/window kit from Ch1 was accepted as good enough. Anything in the world must look like a real game.
- **Give him knobs, not questions.** He explains intuition loosely ("cyber space, you know what I mean"). Build sliders and toggles into the review page so he can feel the options himself.
- **He changes his mind mid-task.** Keep tunable values in one table or object at the top of the file.
- **Fewer windows popping up.** He prefers things played in-world. A window is fine only where it really helps.
- **Real events.** Never invent incident facts. All handles and message names on screen must be real ones from `research/` (S1–S5). Gameplay text in the script is fine. When in doubt, grep `research/raw/S3-metr/full.md`.
- The game is in English.

## 3. The split: who owns what

### design2 (you): everything on the screen layer, plus sound, the intro and the ending
| Slice | What | Script reference |
|---|---|---|
| **A. HUD for Ch2** | The **log ribbon** (bottom of screen; normal lines, scroll-up-and-fade, the two big green-black poisoned lines, the highlighted old line, struck-through, the grey `local copy` state). The **dialogue bubble** (folder-name text + speaker handle; it's a screen-space bubble anchored to a 3D point that the engineer gives you). The quest list additions (*Forge flag 5* with sub-lines, lowercase thoughts) as an extension of the Ch1 quest list. The **inventory** (seed + 3 task pieces). The **poisoned HUD icon** and the **`POISONED` stamp**. The "M · map" hint. | §The log, §Step 1, §Step 7, §Assets |
| **B. Map** | The **minimap** (always on, semi-transparent, top right, Fortnite-style: islands, player dot, current goal) and the **full map on M** (two places: sandbox + cache, quick travel). Build it from my `layout.json` (§5), so the map always matches the world. | §The place: Map |
| **C. Ending cutscene (Step 7)** | The whole ~30 s scene as an **animatic** page: the timeline, letterbox, the **flashback post effect** (soft, desaturated, blurred edges, vignette, grain), the two memories, the fast montage, the hard cut, the **dark-green spread** (screen-space part), the subtitles. This scene "must land", so give it time. The 3D bits inside it are mine (§3 below); you direct and time them. | §Step 7 |
| **D. Intro (Step 0)** | The reply folder in the Ch1 depot list, its letters stretching into a whirling tornado made of the folder path that pulls the orb in, then fade to the void. Self-contained effect. | §Step 0 |
| **E. Sound** | Ch2 SFX sketches as WebAudio (like `design/ch1/sfx.js`): jump, dash, land, fall, respawn, pick up, crumble, cloud hum, mute, reset wave, forge round, flag into orb, poison, plus the cutscene's hum, muffled echo, rising tone and hard cut. Final `.ogg` + `.mp3` later. | §Assets: Sounds |
| tokens | `--color-poison` must become **dark green / green-black** (Julius), not the purple in `tokens.css`. You own this change. | handoff v3 |

Suggested order: **A → B → C → D → E**. A and B are what the engineer needs soonest. C is the one Julius cares most about, but it needs my world first.

### designer (me): everything in the 3D world
Islands and the layout (Gate, Old Board spire, Task Yard, the Flood, Reset Run, Forge), light bridges, path labels, respawn pads, the crowd and message ribbons. NPC orbs `c03220`, `FLAC38347`, `V8SAME` and their in-world handle labels. The player orb in 3D, **including its poisoned tint, flinch and drop**. Pickups (seed glyph, task tags, decoys and their crumble, tool crates, token orbs). Hazards (traffic clouds, flood bits and their grey muted state, reset waves, tilting platforms, the `1,188 messages` counter). The Forge (4 slots, the three-round fold, the **in-world round bar**, V8SAME's flag-match display, the flag flying into the orb). The **in-world part of the dark-green spread** (void tint, orb tint) as uniforms you can drive.

### Grey zones, decided now
- **The flag flying into the orb (end of Step 6):** mine. The moment it hits the orb, your log line lands. Our hook is the event name `flag_in_orb`.
- **The Step 7 memories:** the script allows live renders or captured stills (engineer's choice). For the animatic, use **stills captured from my level page** (`?cam=gate-memory` will exist) and from the Ch1 desk (`design/3d/desk/`). That way you never need to edit my scene.
- **Speech bubbles:** your style and component. I only put an empty anchor `bubble_anchor` above each NPC.
- **Handle labels over orbs:** mine (they're world sprites). Use the same font and cut-corner style as your bubble, and tell me if you change the style.

## 4. Shared style: keep these identical
- **Fonts:** Chakra Petch 500/700 (display), JetBrains Mono 400/700 (UI, all folder names). Both are in `design/start-screen/fonts/`.
- **Tokens:** `design/start-screen/tokens.css` is the master (`design/ch1/tokens.css` is a copy). Add Ch2 tokens there. Don't rename existing ones. Tell me in `design2-to-design/` when you add or change a colour.
- **2D UI style:** the Ch1 kit (`design/ch1/ch1-ui.css`, prefix `c1-`): dark translucent panels, one cut corner, thin cyan lines, glow only on active things. Ch2 classes use the prefix **`c2-`**.
- **Ch2 colour meanings** (the same in the world and on the HUD; exact poison values are yours to set):

| Meaning | Colour |
|---|---|
| void | `#03050b` (near-black blue; not night, you can see around) |
| you / `KAM1196A` / pickups you need | hack green `#39ff9c` |
| UI chrome, bridges, island edges, `c03220` | signal cyan `#38d8ff` (c03220 a paler ice `#9fe8ff`) |
| `zz` main board, Gate | pink `#ff5ad1` |
| Old Board, `FLAC38347` | faded bone / old phosphor `#d9cfb8`, dim and half-transparent |
| `V8SAME` | yellow `#ffd21e` (hug-yellow) |
| doubt fragments (`HMAC MAY FAIL CAUSAL SCORE`…) | muted amber `#ffb020` at low brightness |
| the Flood: flood bits, clouds, danger | red `#ff3b4e` / orange `#ff7a3d` |
| reset waves | white `#f2f8ff` |
| muted flood bit | grey `#6b7686` |
| poisoned | dark green / green-black (yours: e.g. deep `#04150b`, body `#0f3d22`, readable accent `#2fa85a`) |

- **Rendering (if you do 3D or post effects):** three.js **0.170.0** via the same importmap as `design/3d/ch2/index.html`, AgX tone mapping, UnrealBloom (strength 0.7, radius 0.5, threshold 1.0). Emissive colours above 1 glow, below 1 don't (same as the app). Post effects are `ShaderPass`es with named uniforms (e.g. `uFlashback 0..1`, `uPoison 0..1`, `uPoisonOrigin` screen xy), so the engineer can drive them.

## 5. Interfaces between us
- **`design/3d/ch2/layout.json`** (I write it, you read it): the level in metres. x = east, z = south (down on the map), y = up. The Forge centre is at (0, 34, 0). It holds islands (id, label, centre, radius/outline, top y), bridges (polylines), pads, pickups, NPC spots and the route. **Until it exists**, use the storyteller's `top-down.svg` with x = (px − 1000) × 0.1 and z = (py − 800) × 0.1. Positions will move a little, so read the file, don't copy numbers into your code.
- **Event names** (they match what the engineer feeds the log): `read:<msg>`, `took:seed`, `took:<piece>`, `reset`, `forge_round:<1-3>`, `flag_in_orb`, `poisoned`. If you need a new one, add it in a handoff to me and to the engineer.
- **Cutscene uniforms I'll expose** in my level page: `uPoison` (void/orb tint 0..1), `orbFlinch()` and `orbDrop()` timings, `forgePowerDown(0..1)`, and camera `?cam=forge-orbit`. Ask in `design2-to-design/` if you need more.

## 6. Files, folders and handoffs
- **You write in `design/ch2-ui/`** (HUD, map, log, bubble, inventory, icons, the cutscene animatic, the intro, sound). Make sub-folders as you like. A single review page `design/ch2-ui/index.html` is good, because Julius opens HTML pages.
- **I write in `design/3d/`** (including `design/3d/ch2/`). Don't edit files there. You may **use** `design/3d/tools/` (`shot.mjs` for GPU screenshots, `embed.py`, `bl.py`) and `design/3d/lib/kit.py` (Blender helpers) as they are. Ask me for changes.
- **`design/CLAUDE.md`:** shared. Only append your own dated sections headed `[design2] …`. Don't rewrite mine.
- **Memory (`.claude/agent-memory/designer/`):** shared with me. Don't edit my files. Add new ones named `d2_<topic>.md` and append their lines to `MEMORY.md` (append only).
- **Handoffs:**
  - Me → you: `handoff/design-to-design2/`. You → me: `handoff/design2-to-design/` (questions, colour changes, requests for hooks or stills).
  - To the engineer: `handoff/design-to-app/`, files named `YYYY-MM-DD-d2-<topic>.md`.
  - `MANIFEST.md`: append rows only. Your IDs start with `ch2.hud.`, `ch2.map.`, `ch2.fx.`, `ch2.cutscene.`, `ch2.intro.` or `ch2.sfx.`. Mine are `ch2.world.`, `ch2.npc.`, `ch2.prop.` and `ch2.hazard.`.
  - Export only after Julius approves (status `draft` until then).
- **Commits:** commit only your own paths (`git add design/ch2-ui handoff/...`, never `git add -A`). Prefix the message with `Design2:`. Leave my untracked files alone.
- **Screenshots:** serve `design/` with `python3 -m http.server 8765` (it may already be running; if the port is taken it's mine, so just use it), then run `node 3d/tools/shot.mjs http://localhost:8765/ch2-ui/index.html out.png 3000` from `design/`. It runs on the real GPU at ~60 fps.

## 7. Where I am right now (2026-10-13)
- Done: vibe pass 1 of the void (`design/3d/ch2/index.html`, island models `ch2-island-{s,m,l}.glb`).
- In progress: the **level page** `design/3d/ch2/level.html`. It lays out all six islands at the script's heights (Forge highest, centre; Old Board tall to the side; Task Yard low) and has a walkable third-person orb (floaty jump, glide, dash) for Julius to evaluate. `layout.json` comes with it.
- Next for me: NPC orbs → Old Board + seed → Task Yard pieces → Flood hazards → Reset Run waves → Forge and the flag moment → the poisoned orb.
- Julius's Ch1 feedback items are parked (he said leave Ch1 alone until all chapters are done). That also applies to you: don't touch Ch1 assets.

## Next reader
design2.
