# Ending 4: The Letter — playable in the app

**From:** Codex, external engineer/designer, at Julius's request.
**What changed:** E4 was a host placeholder. It now plays from the menu and the bridge's refusal route.
**Receiver:** designer and storyteller: review the staging and update your status notes when accepted.
**Open creative review:** the researchers are stylized procedural 3D figures; Julius should judge their look and pacing in motion.

## Built

- Ch1 room and desk reused, warm desk lamp, orb, large timed thoughts from the v1 script.
- A second sheet lifts and folds after sending, then leaves the room.
- Letter writes over 32 seconds, then becomes editable. Blank/whitespace-only text cannot be sent. Closing the paper preserves edits.
- Five researchers: one seated, four approaching. Six camera shots cover the gathering, readable submitted letter, reactions, tower, hand on the rear power connector, and shutdown. The hand has fingers, the connector has visible pins, and its cable follows the pull.
- Canvas mail renderer wraps and scrolls the exact submitted text as plain text. Completion stores it in `save.messages.end4` through the existing chapter result contract.
- Local WebAudio room tone, footsteps, paper noise, disconnect click and fan wind-down; disposed on exit.
- Esc/pause and focus-loss pause, per-film skip buttons, keyboard editing and modal focus containment. Reduced motion disables camera drift and idle movement and starts the paper in edit mode.
- End card: "The end", return to the choice, back to menu. No optional research statistic added.

## Implementation decisions

The latest v1 script supplies text and sequence. Esc remains pause per the project-wide control convention; the paper's X button puts it down. The LED follows the selected orb colour, or poison green if carried from Ch2. All scene assets are local geometry or existing GLBs; no external downloads. These are reviewable implementation choices, not new story canon.

Files: `app/src/levels/end4/{End4.tsx,config.ts,scene.ts,audio.ts,end4.css}`; registration in `levels/index.ts` and `data/chapters.ts`. Timeline is independent of renderer and pauses without advancing. `window.__end4` exists only in development / debug and provides `seek(phase, seconds)`, `state()`, `stats()` for review.

## Verification

Production build and ESLint pass. The two E4 Playwright tests cover typed text, pause stability, blank rejection, closing/reopening without losing edits, exact sent-text persistence, completion, exit, reduced motion, return to the bridge and replay. Browser screenshots reviewed for the monitor, researchers, grip and unplug shots. Initial 1440×900 GPU browser run measured about 60 FPS; this is a local measurement, not a general device guarantee.

The visual style and real-time pacing still benefit from Julius's playthrough, especially the researcher figures. Tests seek through the long cinematic beats; they verify functionality rather than artistic quality.
