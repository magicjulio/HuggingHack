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
| `/?debug` | debug panel in game: jump to any step, change tokens; no pause without mouse lock |
| `/?nofx` | no bloom / post-processing (weak GPUs, headless tests) |

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

The Ch1 end card's **CONTINUE** goes straight into Chapter 2. Chapter 2's level is the designer's `src/levels/ch2/layout.json`.

## Other commands
| Command | What it does |
|---|---|
| `npm test` | unit tests (Vitest), incl. full Chapter 1 and 2 playthroughs and a Ch2 golden-path jump check |
| `npm run test:e2e` | browser smoke tests (Playwright, uses your installed Google Chrome) |
| `npm run lint` / `npm run typecheck` | code checks |
| `npm run format` | format code (Prettier) |
| `npm run build` | static production build in `dist/` |
| `npm run preview` | serve the production build |

## Reset your save
Progress, menu selection, your Chapter 1 message and installs, and the `poisoned` status are stored in the browser (`localStorage`, key `rogue-on-hf-save`).
Clear it in the browser dev tools, or run `localStorage.clear()` in the console.
