---
name: feedback-esc-key
description: Never bind "close/leave" to Esc in the game; Esc is the browser's (pause, fullscreen, pointer lock)
metadata:
  type: feedback
---

Esc must not close machines or windows. It pauses the game (and the browser uses it to leave fullscreen and pointer lock). Leaving something needs other, intuitive ways: WASD/arrows, a visible step-back button, and a click beside the thing.

**Why:** Julius playtest 2026-10-13: closing a machine with Esc also paused the game (likely: the re-lock after closing gets released by the browser's own Esc handling; not verified). He asked for Esc to be reserved for pausing.
**How to apply:** in every new chapter or UI, give each modal or focus state those three exits and test them in e2e. Related: [[feedback-direct-changes]].
