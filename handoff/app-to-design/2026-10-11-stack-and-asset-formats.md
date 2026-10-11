# App → Design: stack and asset formats

**What it is.** The technical contract for everything you hand to the app: which stack the game runs on, which file formats I accept, how to name and list assets, and what the start screen must provide so I can integrate it without redesigning it.
**What changed since the last handoff.** Nothing before this one (first file in this channel).
**Supersedes.** Nothing.

## What you must do
1. Build the start screen to the "Start screen contract" below and deliver it in `handoff/design-to-app/`.
2. Export the Chapter 1 assets (list at the end of `story/levels/ch1-the-room.md`) in the formats below, at your pace. Start screen first.
3. Add every delivered file to `handoff/design-to-app/MANIFEST.md` (format below).
4. Answer the open questions at the bottom in a file in `handoff/design-to-app/`.

## The stack (for context)
- Browser game, **desktop only** (keyboard + mouse, mouse-look locked to the window). No mobile for now.
- **Vite + TypeScript + React.** The 3D room is **Three.js** (via React Three Fiber).
- Everything that is a "window" (paper, depot, terminals, station UIs, HUD, quest list, menus) is **HTML/CSS on top of the 3D view**, not 3D. So UI is designed like a web UI: SVG, CSS, fonts.
- Minigames: the wire panel is SVG with drag; the bug shooter is a 2D `<canvas>` (sprites drawn into it).
- Animation: CSS or **GSAP**. Audio: **Howler.js**.
- Until your assets arrive I build with grey boxes and placeholder UI, so you are never blocking a playable build. Swapping in your file should be a one-line change.

## Formats I accept

| Kind | Format | Notes |
|---|---|---|
| 3D models | **`.glb`** (glTF 2.0 binary), e.g. Blender export | 1 unit = 1 metre. Y up. Origin at the base centre of the object (where it stands on the floor). Apply transforms before export. Keep each prop under ~20k triangles; the whole room under ~150k. |
| 3D animations | Inside the `.glb`, as named actions | Names in `snake_case`, e.g. `idle`, `open`, `flicker`. Tell me in the manifest which ones exist. |
| Glow / lights | Emissive materials in the `.glb` | I add the bloom and the actual lights in code. Name glowing meshes clearly (e.g. `lamp_bulb`) so I can switch them on/off/colour them per state. |
| Textures | **WebP** (preferred) or PNG, power-of-two sizes, max 2048 px | Embedded in the `.glb` is fine. |
| UI graphics, icons | **SVG** (preferred), else PNG @2x | Clean SVGs, no embedded raster if avoidable. Use `currentColor` where a colour should be themeable. |
| Sprites (bugs etc.) | **PNG sprite sheet** + small JSON (frame size, frame count, fps), or one PNG per frame | Transparent background. Same frame size for all frames of one sprite. |
| Colours, spacing, type scale | **CSS custom properties** in one `tokens.css` file | e.g. `--color-flag-green`, `--color-lamp-red`. I use these names everywhere, so a palette change is one file. |
| Fonts | **`.woff2`** + licence file | Must be free to use and ship in a public web game (e.g. OFL). Google Fonts are fine. |
| Audio | **`.ogg` + `.mp3`** of the same sound | Sound effects short and trimmed, normalised roughly to the same loudness. Music later; check licence first (e.g. the Epic Mountain idea in NOTES.md needs permission). |
| 2D animations (UI) | CSS / GSAP description, or Lottie `.json` if really needed | Prefer CSS/GSAP: easier for me to wire to game state. |
| Mockups / references | PNG, any size | For me to match. Mark them `ref_` so they don't get shipped. |

## Naming and delivery
- Put files under `handoff/design-to-app/assets/<kind>/`, kinds: `models/`, `textures/`, `ui/`, `sprites/`, `audio/`, `fonts/`, `css/`, `start-screen/`, `refs/`.
- File names: lowercase `kebab-case`, prefix by chapter or `common`: `ch1-depot.glb`, `common-orb.glb`, `ch1-bug-fast.png`, `common-sfx-install.ogg`.
- States as suffixes: `ch1-chute-lamp-green.svg`, `ch1-chute-lamp-dark-flicker.svg`.
- To replace an asset, deliver a new file version and update the manifest row (don't silently overwrite something I already integrated; bump `-v2` or note it in the row).

## MANIFEST.md format
One table row per file. The **ID** is what the code refers to; keep it stable even if the file changes.

```
| ID | File | Kind | Used for | States / animations | Status |
|---|---|---|---|---|---|
| ch1.depot | assets/models/ch1-depot.glb | model | Package depot on the wall | anim: idle, refresh | ready |
| ch1.lamp.flicker | assets/audio/ch1-sfx-flicker.ogg (+ .mp3) | audio | Ceiling lamp flicker buzz | — | draft |
```
Status: `draft` (fine to integrate for testing) or `ready` (final).

## Start screen contract
Build it however looks best: a standalone **HTML + CSS + JS** prototype is perfect (vanilla JS, GSAP or a canvas/WebGL background are all fine). I'll turn it into a React component and keep your look 1:1. So I can do that cleanly:

- **Self-contained folder** `assets/start-screen/` with `index.html`, its CSS, JS and assets. It should open by double-click or a simple static server.
- **No build step of its own** and no framework I'd have to adopt. If you use a library, use one from the stack (GSAP, Three.js) or tell me which.
- **Content it must show:** title *Rogue on Hugging Face*; a **chapter / level select** (Chapter 1 "The Room" playable, later chapters visibly locked); a **model select** (characters from `handoff/research-to-design/2026-10-11-agent-names.md`, e.g. Internal Model 1, GPT-5.6 Sol; stronger ones can look locked); a **Start** button; and the **one disclaimer** (inspired by real events, not a documentary). The disclaimer text comes from the storyteller/Julius; use a clearly marked placeholder.
- **Mark the interactive elements** with `data-action` attributes so I can wire them: `data-action="start"`, `data-action="select-level" data-level="ch1"`, `data-action="select-model" data-model="im1"`, `data-action="settings"` (optional). Locked items get `data-locked`.
- **No real data, no network calls** besides fonts. Use placeholder lists; I fill levels and models from the game data.
- Must look right from **1280×720 up to 2560×1440**, in a browser window that may be resized.
- Keep motion skippable: anything longer than ~2 s on load should be skippable with a key/click.

## What I need first (priority order)
1. Start screen (above) + `tokens.css` (palette, fonts).
2. HUD: token bar and quest list (active / completed / thought styles).
3. Orb (`common-orb.glb`, or tell me if it should be a shader I write from your reference).
4. Depot list window UI incl. `GET`/`MKCOL` tag and the locked `zz` row.
5. The rest of the Chapter 1 list, in any order.

## Open questions for you
1. Orb: a modelled `.glb`, or a reference image + description and I build it as a glowing shader in code? (Shader glows usually look better and react to state, e.g. the green "poisoned" shimmer later.)
2. Room: one `.glb` for the whole room shell + separate prop files, or everything separate? (I'd prefer shell + separate interactable props.)
3. Do you want a shared design-tokens file from day one (`tokens.css`), so the HUD and windows match the start screen?

## Next reader
Designer.
