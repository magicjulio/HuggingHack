# Rogue on Hugging Face

A browser game and educational AI-safety project. The player is an AI agent, shown through a metaphor of the agent's point of view, living through the 2026 Hugging Face agent intrusion. Every level has one clear goal the player understands. The game is in English.

The game is built; the work now is refinement.

## Where things are
- `app/`: the game (Vite + TypeScript + React + React Three Fiber). Start with `app/README.md` (run, controls, URL flags) and `app/CLAUDE.md` (architecture, conventions).
- `docs/GAME.md`: design reference (flow, levels, look and sound, build decisions). `docs/levels/`: level scripts.
- `design/`: source files for assets (Blender scripts, review pages, tools). Shipped copies are in `app/`. See `design/README.md`.
- `prototypes/`: the standalone prototypes the endings were ported from. Reference only; the copies in `app/src/levels/` are live. Local only (gitignored), so it is missing from a fresh clone.
- `NOTES.md`: Julius's original notes. Read it, never edit it. Local only (gitignored).

## Ground rules
- Julius (the user) owns creative direction. When a change alters how the game plays or looks, ask instead of deciding silently.
- These are real events. Never invent facts about the incident. Creative freedom in how they are shown is fine.
- In-game commands and tools are simulated. No real commands or exploit code.
- Work directly on `main` in this checkout.
