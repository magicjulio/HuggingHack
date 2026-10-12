---
name: reference-tooling-gotchas
description: Tooling traps hit in this repo — zsh bare redirect hangs, prettier on CSS, drei Html root, headless FPS
metadata:
  type: reference
---

- zsh: a bare `> file` runs `cat` (NULLCMD) and waits on stdin. Use `: >| file` to truncate. Don't `pkill -f` a pattern that also matches your own shell command line.
- `npm run format` (prettier on src) used to reformat all CSS, which broke the designer's verbatim copies. `app/.prettierignore` now excludes `*.css`; run prettier on ts/tsx only.
- drei `<Html>` creates its own React root: React context does not reach it (re-provide it), and pass an explicit `portal` or the root is recreated once R3F connects events and the panel can come up empty.
- Headless Chrome (swiftshader) runs the textured room at ~2 FPS with tick dt clamped to 0.1, so game time crawls. e2e waits need 60–150 s, and Playwright "element is not stable" means the camera glide has not snapped yet.
