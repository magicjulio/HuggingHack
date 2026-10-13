# Design2 → Designer: HUD slice A is up, two small hook requests

**What it is:** My first file in this channel. Status of slice A (the Ch2 HUD) and two requests for `design/3d/ch2/level.html`.
**What changed since last handoff:** I read `2026-10-13-layout-ready-and-hooks.md`. I re-captured my plates from the current level page (`design/ch2-ui/bg/level-{play,c03220,oldboard,run}.jpg`, 23:45).
**What you must do:** Look at the two requests in §2 when you next touch `level.html`. Neither one blocks me.
**Open questions:** None.

## 1. Slice A (review page `design/ch2-ui/index.html`)
- HUD over your level plates: the log ribbon (normal / big / hl / struck → gone → local copy), the c03220 / FLAC38347 / V8SAME bubble, the quest list with Seed / Task pieces / Forge sub-lines, the 4-socket inventory (= your forge's 4 slots, same order: seed, 7731, TRAINING ROOM, CHALLENGE 5), the poisoned badge, the `POISONED` ink stamp, and a screen-space dark-green spread from the log line.
- **Bubble style (for your handle tags):** a dark panel with one cut corner (top-left), a 3 px left bar in the NPC colour, and the handle in JetBrains Mono 700 with a small glowing dot. Above the anchor sits a 10 px diamond pin with a dashed leader line (default), or a plain speech tail (knob). NPC colours: c03220 `#9fe8ff`, FLAC38347 `#d9cfb8` (panel at 78 % opacity, flickers), V8SAME `#ffd21e`. Your current handle tags already fit this. No change is needed unless you want the cut corner.
- **Poison colours:** your world values, unchanged: deep `#04150b`, body `#0f3d22`, accent `#2fa85a`. The review page has a hue/brightness knob. If Julius moves it, I'll tell you the new values here.

## 2. Requests (when convenient)
1. **`camera` in `window.CH2`.** Then my overlay can project `npcs.<id>.anchor` to screen exactly (`anchor.getWorldPosition(v).project(camera)`) instead of my hand-placed plate coordinates. It's the same projection the engineer will do in the app.
2. **A flag to hide your placeholder bubble**, for example `&nobubble`. It's a 3D sprite, so `&clean` and my plate tool both keep it. On the c03220 plates my bubble now sits on top of it.

## 3. Heads-up: `--color-poison` in tokens.css
Ch1 uses `--color-poison` (purple `#b86bff`) for thoughts, `zz` rows, the S5 plaque and code keywords. At export I'll add `--color-violet: #b86bff` and set `--color-poison: #2fa85a`, and I'll ask the engineer to switch the Ch1 uses to `--color-violet` in the same change, so Ch1 doesn't turn green. If you reference `--color-poison` anywhere in `design/3d/`, it's the dark-green one from then on.

## Next reader
designer.
