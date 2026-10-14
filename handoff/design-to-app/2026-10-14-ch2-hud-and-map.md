# Designer → App: Ch2 screen layer (HUD + map) accepted, ready to port

**What it is:** The Ch2 HUD kit and the map, both accepted by Julius on 2026-10-14. With them comes the poison-colour token change. This answers your §4 (`handoff/app-to-design/2026-10-13-ch2-greybox-and-contract.md`) for every part except the intro, the cutscene visuals and the sounds, which are still to come.
**What changed since the last handoff:**
- design2 is retired, and the designer now owns this layer (DECISIONS 2026-10-14). There will be no `d2-` files.
- Reset waves: Julius picked the red-eyed scanner look (DECISIONS). I updated the text in `layout.json` notes; the data is unchanged.
**What the receiver must do:**
1. **Swap the tokens in one change** (§1): re-copy `tokens.css` and `ch1-ui.css`, and change the 2 uses in `app/src/levels/ch1/ch1.css` to `--color-violet`. Otherwise Ch1's purple turns green.
2. **Port the kit** (§2): replace your `c2-` placeholders (`Screen.tsx` + `ch2.css`) with `ch2-ui.css` verbatim, and port `hud.js` and `map.js` behaviour into your views.

**Open questions:**
1. Will you build quick travel to the Ch1 room now or later? See §4.

## Files (MANIFEST rows added)
| ID | Path under `assets/` | Status |
|---|---|---|
| `common.tokens` | `start-screen/tokens.css` | draft, **changed** (§1) |
| `ch1.ui-css` | `ch1/ch1-ui.css` | draft, **changed** (§1, violet) |
| `ch2.hud.css` | `ch2/ch2-ui.css` | approved |
| `ch2.hud.js` | `ch2/hud.js` | approved (reference controller) |
| `ch2.hud.icons` | `ui/ch2/ch2-icon-{seed,tag,forge,poisoned}.svg` (+ `ch2/icons.js` inline) | approved |
| `ch2.map.js` | `ch2/map.js` | approved |

Live references: `design/ch2-ui/index.html` (HUD; "▶ whole chapter" is what Julius approved, and M opens the map) and `design/ch2-ui/map.html` (the map running over the walkable level). Serve `design/` on any port.

## 1. Tokens: poison is dark green now; Ch1's purple gets its own name
- **Added:** `--color-violet: #b86bff` (Ch1 thoughts, `zz` rows, code keywords, the S5 plaque).
- **Changed:** `--color-poison: #2fa85a`.
- **Added:** `--color-poison-body: #0f3d22` and `--color-poison-deep: #04150b`.
- `ch1-ui.css` already uses `--color-violet` everywhere.
- **Your part:** `app/src/levels/ch1/ch1.css` lines 98 and 138 (`.ch1-plaque`, `.ch1-s5w-body h3`) still say `--color-poison`; change them to `--color-violet`.

## 2. HUD kit (`ch2-ui.css`, prefix `c2-`; needs `tokens.css` + `ch1-ui.css`)
`hud.js` is a vanilla reference controller (`window.c2hud`). Its calls map 1:1 to your store:

| Your §4 part | Kit / call | Notes |
|---|---|---|
| Log ribbon `log[{id,text,kind}]` | `.c2-log` · `log(text, kind) → id`, `setLog(id, kind)` | Kinds: `normal`, `big`, `struck`, `local`, plus `hl` (memory montage) and `gone` (the deleted frame between struck and local). Verbs `read:`/`took:`/`dropped:`/`muted:`/`fell`/`reset`/`>` are coloured by `data-v`. A typewriter effect plays at `--c2-type-cps` (70). `big` lines appear at once. Keep about 30 lines. |
| Step 7 log beats | `.c2-hud.is-cinematic` | Everything fades except the log, which rises above the letterbox. Timing as approved: big lines at 0 s, `hl` during the montage, `struck` at 26 s, `gone` ~0.9 s later, `local` with tag `local copy` at 28 s (your `CUTSCENE` table). |
| Bubble (handle + text, anchored in 3D) | `.c2-bubble[data-npc=c03220\|flac\|v8same]` · `say(npc, text, i, n)`, `place(x, y)` per frame, `bubbleOff()` | Pin your element to the NPC's `bubble_anchor` (2.1 m above the orb; it's in my level page as `CH2.npcs.<id>.anchor`). The default style is a diamond pin with a dashed leader line. Earlier posts float up as ghosts. Dashes and underscores are dimmed, and `zz` is pink. |
| Quests + thoughts | `.c2-quest` + sub-lines · `quest({show, seed, pieces, forge: false\|'active'\|true, round, escape})`, `thought(text, cot)` | Sub-lines `Seed (0/1)`, `Task pieces (n/3)`, `Forge` (round n/3). Real chain-of-thought lines are shown in `{braces}` (`cot: true`); the player's own thoughts use the Ch1 style. |
| Inventory | `.c2-inv`, 4 sockets in forge order (seed, 7731, TRAINING ROOM, CHALLENGE 5) · `put(key)`, `decoy(label)`, `forgeTake(key)` | `put` flies a spark from the orb's screen point (`from`) to the socket. A decoy shows over the socket and crumbles. |
| Tokens / hurt | Ch1 `.c1-tokens` · `tokens(n, delta)`, `hurt('hit'\|'cloud')` | Red vignette on a hit, pulsing orange while inside a cloud. |
| Poisoned | `poisonIcon(on)` (badge next to TOKENS), `stamp(x, y)`, `spread(ox, oy, ms)` | The stamp lands over the first-mention line (your 23–28 s), and the dark-green spread starts from that line. After that, the screen edges keep a permanent tint (`.c2-vig`). **Julius: accepted, small refinements later** (the poisoned scene gets a polish pass with the cutscene). |

## 3. Map (`map.js`, `window.c2map`, Canvas 2D, no deps)
- **Calls:** `create(canvas, 'mini' | 'full')` → `.layout(layoutJson)` once → `.draw({ p, yaw, goal, pads, t })` per frame. On the full map, `.padAt(clientX, clientY)` returns a pad id for quick travel. `c2map.areaAt(L, p)` returns the area name for the minimap footer.
- **Inputs:** exactly your §4 list. `p` = player feet, `yaw = atan2(-fwd.x, -fwd.z)` of the camera, `goal` = `goalOf(step)` as a point, `pads` = `{ id: 'seen' | 'current' }` from `padsSeen`, and `t` for the moving clouds and laser lines.
- **Markup:** `.c2-mini` (canvas + `.c2-mini__foot` area name + `.c2-alt` altimeter) and `.c2-fullmap` (M; close with M or a click outside, never Esc).
- **Behaviour:** the minimap turns with the camera, with a north tick. The full map is north-up, with zone names and heights and an elevation strip showing the Forge as the peak. Only lit pads answer `padAt`.

## 4. Coming next for the map (Julius, recorded): one map for the whole game
Julius wants the map to span all chapters: **the Ch1 sandbox is on it, and each chapter unlocks more of it**. This is already in script v3.2 ("the full map of all places the player can reach: the sandbox and the cache for now, with quick travel … The room, if you travel back, stays as you left it").
- **Today's v1** draws only the Cache.
- **What I'll add:** a world view with the sandbox room as its own region joined to the Gate, later chapters as locked regions, and a data shape (`regions[]` with an `unlockedBy` chapter).
- **Your part:** travel between chapters, and the room keeping its state. Tell me if you'd rather have the data shape first.

## Not in this handoff (coming)
- the Step 0 intro (tornado)
- the Step 7 cutscene visuals and the flashback post effect (`uFlashback`, `uPoison`, `uPoisonOrigin`)
- the sounds
- my 3D slots (§3 of your file)

## Next reader
engineer.
