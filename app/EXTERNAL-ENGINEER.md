# External engineer intake — 2026-10-14

Author: **External engineer (Codex)**. Scope: repository orientation and recovery of the engineer's latest work, requested by Julius. No gameplay implementation changed or committed during this intake.

## Working agreement

Read the root and directory `CLAUDE.md` files, `NOTES.md`, role definitions, engineer memory, `docs/DECISIONS.md`, and relevant build/design handoffs. Continue in the shared repo root on `main`. Engineering writes stay in `app/`, the engineer's outgoing handoff channels, and append-only decisions. Leave `NOTES.md`, delivered incoming handoffs, and other roles' private memories untouched. Julius owns creative direction; already recorded approvals remain valid. Sign future work as **External engineer (Codex)**.

## Where the engineer left off

- Latest engineer commit: `a818d53`, 2026-10-14 15:18 CEST, **Ch2 draws with the designer's world modules**. The approved layout v2, islands, bridges, environment, lasers and clouds are integrated; rules use the designer's pure `motion.js`.
- The checkout already contained an uncommitted Ch2 HUD/map integration: new `src/levels/ch2/hud/` and `ui/`, changes to chapter composition, dialogue, inventory, log states, styles and tests. These edits predate this intake; their authorship cannot be established from Git alone.
- The HUD/map code is wired into Ch2. Tokens, Ch1 UI CSS, map.js and icons.js match the current designer exports byte for byte. Ch1's purple references use `--color-violet`.
- `app/CLAUDE.md`'s earlier status is stale: HUD/map work has started, and the Step 7 cutscene, forge and player-orb modules have since arrived.

## Remaining work, in recommended order

1. **Finish the existing HUD/map integration.** Compare its rendered appearance and interactions with the accepted designer references; send screenshots and any deviations through a new `handoff/app-to-design/` file. Automated smoke coverage does not establish visual parity or fully exercise the new HUD/map interactions.
2. **Integrate the accepted Step 7 cutscene** from `handoff/design-to-app/2026-10-14-ch2-step7-cutscene.md`. Replace the placeholder with `step7.js` (`direct`, `camPose`, `HUD_BEATS`), `fxFlashback.js`, the memory stills and designer DOM classes. Use `forge.js` and `playerOrb.js` throughout Ch2, retaining gameplay in the store. Preserve replay skipping and the saved poisoned status.
3. **Take the accompanying export and performance updates.** App copies of `env.js` and `util.js` are older; the app HUD CSS lacks the latest 31 cutscene lines. Re-copy designer files verbatim. Implement the recorded DPR cap of 1.5, adaptive MSAA/resolution tiers, and texture/shader warm-up. Verify performance on the target GPU; passing smoke tests does not prove 60 fps.
4. **Later designer-dependent integrations:** Step 0 tornado intro, sound, remaining world modules (`oldBoard`, `crowd`, `npcs`, `pickups`, `pads`, `trails`), and the forge proof/fold/flag-absorption visuals. The basic forge and player orb have arrived; the rest of the forge slice has not.
5. **Whole-game map:** current export covers the Cache only. The designer plans regions including the Ch1 sandbox; engineering still needs cross-chapter travel and restoration of the room as left. This is a recorded requirement, not a new creative proposal.

Ch1 is accepted and deferred to the final refinement pass. Ch3 has no delivered build script yet.

## Validation of the inherited checkout

- `npm test`: **48 passed** across 8 files.
- `npm run lint`: passed.
- `npm run build`: passed, including TypeScript compilation.
- `npm run test:e2e`: **5 passed** in 30.3 s, including Ch1 → Ch2, movement, forge, cutscene completion and poisoned save. Required running outside the sandbox after its local web server could not start inside it.
- `git diff --check`: passed before this documentation addition.

Existing source edits and the unrelated untracked `design/3d/lib/__pycache__/` were left intact. No branches, worktrees, commits or outgoing role handoffs were created.

## Follow-up implementation — External engineer (Codex)

Julius subsequently authorized tackling the remaining integrations and asked to highlight NPC/crowd parity as open work. The intake above records the earlier snapshot; this section records the follow-up.

- Integrated the accepted Step 7 director, exact camera/FOV/hard cuts, two memory stills, real Ch1 prompt, echoes, montage, poison effect, subtitles and fade. Store/HUD beats now come from the designer's `HUD_BEATS`; timing is no longer duplicated.
- Integrated the designer's forge and player orb throughout Ch2. Kept the existing gameplay and temporary Step 6 proof/absorption views while the remaining forge slice is pending.
- Completed review and browser coverage of the inherited HUD/map port; fixed the race where an item consumed before its pickup spark landed could refill an empty socket, and cleaned up those animations on unmount.
- Re-copied all 11 world modules, the latest HUD CSS and both memory images verbatim. Updated sky and shared-texture disposal fixes are included.
- Added a DPR cap of 1.5, adaptive MSAA/resolution tiers, fixed quality overrides and early GPU texture/shader warm-up. Moved texture loading ahead of composer creation to avoid React 19/drei Html-root unmount errors.
- Memoized world/static HUD views after an actual 1080p run exposed unnecessary scene reconciliation. Low-tier live playback improved from roughly 48–52 fps to approximately 60 fps throughout the 37-second film on this Iris Xe. Raw results are in the screenshot folder.
- Added two store tests and three browser tests. All 50 unit tests, lint and production build passed; the eight browser tests passed all five repeated runs before the final performance-only memoization, with final verification recorded in the delivery handoff.

Open design work is explicitly recorded in `handoff/app-to-design/2026-10-14-external-engineer-ch2-visual-gaps.md`: richer named NPCs, crowd movement/posting/trails/pops/reset runners, remaining world modules, and uncertain earlier vibe-scene decorations. Intro, audio, remaining forge visuals and whole-game map regions/travel remain pending. No implementation work was committed.


## NPC/crowd delivery integrated — External engineer (Codex), 2026-10-14
Julius requested integration of the pending designer work. The external designer's NPCs, crowd, trails, agents and util exports are now copied verbatim into the playable app. Replaced the three generic NPC orbs and 12-agent placeholder crowd; retained caller-owned poses, exit, dialogue and all gameplay rules. Named labels and HUD anchors track the animated orb centres.

The shared effects and crowd use the game's clock, freeze on pause/map and hide without emission during Step 7. The NPC shader clock also freezes. Module resources are released on teardown. Added a browser regression for motion, emissions, pause, V8SAME exit, film hiding and replay (passed five times). The existing eight browser tests, 50 unit tests, lint and production build passed.

This completes the delivered NPC/crowd slice. Old Board, pickups, pads/ribbons, flood-bit art, intro, audio, remaining Step 6 enhancements and whole-game map work remain open. Earlier cosmic decorations still have no confirmed keep/drop decision. No commits were made.
