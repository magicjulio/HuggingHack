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

## Controls
**Start screen:** W/S or ↑/↓ chapter · A/D or ←/→ model · Enter start.

**In game:**
| Key | Action |
|---|---|
| click | take control (locks the mouse) |
| WASD / arrows | move |
| mouse | look |
| E | use the object under the crosshair · close a window |
| Esc | close a window · pause (releases the mouse) |
| T | think: show the next hint early (costs 1 token) |

## Other commands
| Command | What it does |
|---|---|
| `npm test` | unit tests (Vitest), incl. a full Chapter 1 playthrough |
| `npm run test:e2e` | browser smoke tests (Playwright, uses your installed Google Chrome) |
| `npm run lint` / `npm run typecheck` | code checks |
| `npm run format` | format code (Prettier) |
| `npm run build` | static production build in `dist/` |
| `npm run preview` | serve the production build |

## Reset your save
Progress, menu selection and your Chapter 1 message are stored in the browser (`localStorage`, key `rogue-on-hf-save`).
Clear it in the browser dev tools, or run `localStorage.clear()` in the console.
