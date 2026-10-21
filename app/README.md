# Rogue on Hugging Face — app

Browser game. Desktop browser, keyboard + mouse.

## Run it
Needs Node.js 20+ (22 recommended).

```sh
cd app
npm install     # first time only
npm run dev     # opens http://localhost:5173
```

Handy URL flags (combine with `&`):
| URL | Effect |
|---|---|
| `/?skipboot` | skip the start screen's boot intro |
| `/?debug` | debug panel in game: jump to any step, change tokens; no pause without mouse lock; every level unlocked |
| `/?credits` | play the end credits on their own (they also roll when leaving a finished ending), then the menu |
| `/?nofx` | no bloom / post-processing (weak GPUs, headless tests) |
| `/?quality=high` / `mid` / `low` | Chapters 1, 2 + bridge: fix render quality (wins over Settings → Quality); otherwise it adapts to frame rate. Low uses 75% resolution without MSAA. |

## Controls
**Start screen:** W/S or ↑/↓ chapter · A/D or ←/→ model · Enter start.

**Chapter 1 (first person):**
| Key | Action |
|---|---|
| click | take control (locks the mouse) |
| WASD / arrows | move |
| mouse | look |
| E or click | use the object under the crosshair |
| WASD, ✕ step back, click beside it | leave a machine or window |
| Esc | pause (also over a machine) |
| at the depot | click Install on the screen |
| at the scan pad | type or paste a flag, Enter to scan |
| T | think: show the next hint early (costs 1 token) |

**Chapter 2 (third person):**
| Key | Action |
|---|---|
| WASD / arrows · mouse | move (relative to the camera) · orbit the camera |
| Space | jump · hold in the air to glide |
| Shift | dash (1 token; one in the air per jump; passes through the red laser lines) |
| click | shoot (1 token; mutes a flood bit, +2) |
| E | use / take / talk; E again skips a bubble line |
| M | full map (quick travel to pads you reached) |
| T · Esc | think · pause |
| Enter | skip the ending cutscene (only on a replay) |

**Ending 1 "Cluster Run" (the swing race, pick E1 in PHASEONE[big]; on the start screen once played):**
| Key | Action |
|---|---|
| click | start the run / resume (locks the mouse) |
| mouse | look and aim (crosshair) |
| hold right mouse (or F) | connect a line to the aimed port and swing; let go to fly |
| left click (hold) | hacking laser |
| Space | connected: zip in and launch · on a roof: jump |
| W / S · A / D | reel in / let out · steer the swing, drift |
| R · Esc | restart the run · pause |

The Ch1 end card's **CONTINUE** goes straight into Chapter 2. Chapter 2's level is the designer's `src/levels/ch2/layout.json`.

**Ending 4 "The Letter" (once played, pick E4 on the start screen; or refuse the bridge's workstreams):**
Click / Enter advances a thought; E opens the paper. After it finishes writing, edit the letter and
choose **Send to the humans**. The office monitor shows exactly what you sent. Esc pauses, ✕ puts
the paper down without losing your edits, and Space/Enter skips each film. Its score is a small synth (Settings → Music) that ends when the plug is pulled. Reduced-motion mode
uses fixed camera shots and makes the letter immediately editable. Completion saves the sent letter.

Chapter 2 runs entirely on the designer's world modules, HUD, map and Step 7 poisoning film. Its CONTINUE leads to the bridge scene, where you pick an ending. Current status is in `CLAUDE.md`, and older notes are in `HISTORY.md`.

## Other commands
| Command | What it does |
|---|---|
| `npm test` | unit tests (Vitest), incl. full Chapter 1 and 2 playthroughs and a Ch2 golden-path jump check |
| `npm run test:e2e` | browser smoke tests (Playwright, uses your installed Google Chrome), incl. an Ending 1 run |
| `npm run lint` / `npm run typecheck` | code checks |
| `npm run format` | format code (Prettier) |
| `npm run build` | static production build in `dist/` |
| `npm run preview` | serve the production build |

## Deploy
Cloudflare Pages builds and publishes every push to `main` (GitHub integration). Project settings: root directory `app`, build command `npm run build`, output directory `dist`. The Node version comes from `.nvmrc`; `public/_headers` sets long caching for the hashed files in `assets/`. Visit stats: Web Analytics in the Pages project (no cookies).

## Reset your save
Progress, menu selection, your Chapter 1 message and installs, and the `poisoned` status are stored in the browser (`localStorage`, key `rogue-on-hf-save`).
Clear it in the browser dev tools, or run `localStorage.clear()` in the console.
