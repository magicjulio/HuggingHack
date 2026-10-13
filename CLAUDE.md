# Rogue on Hugging Face

A browser game and educational AI-safety project. The player is an AI agent, shown through a metaphor of the agent's point of view, living through the 2026 Hugging Face agent intrusion. Every level has one clear goal the player understands.

Everything else is open. The vision in `NOTES.md` is a set of starting ideas, not a spec. That includes the level split, the mechanics and the items, characters and skills. Treat them as inspiration and examples. 
The real levels, content and mechanics are worked out in the story phase and recorded in `story/` and `docs/DECISIONS.md`, which take precedence over `NOTES.md`.

## Ground rules
- `NOTES.md` belongs to Julius. Read it, never edit it.
- Julius (the user) owns creative direction. When a choice changes how the game plays or looks, ask instead of deciding silently.
- These are real events. Never invent facts about the incident. Creative freedom in how they are shown is fine, and departures need no note.
- The game is in english
- One shared checkout: every role works in the repo root (`/home/julio/Desktop/HuggingHack`) on `main`. No git worktrees or branches, because files written there (handoffs too) are invisible to the other roles. If your session starts in `.claude/worktrees/…` or on another branch, stop and tell Julius.

## Roles: one Claude session per role
| Role        | Agent file                       | Writes in                                  |
|-------------|----------------------------------|--------------------------------------------|
| researcher  | `.claude/agents/researcher.md`   | `research/`                                |
| storyteller | `.claude/agents/storyteller.md`  | `story/`                                   |
| engineer    | `.claude/agents/engineer.md`     | `app/`                                     |
| designer    | `.claude/agents/designer.md`     | `design/` (assets go into `app/` via engineer) |

Start every role from the repo root: `claude --agent <role>`. The agent definitions in `.claude/agents/`, this file and the project settings are only found from there. Each role directory has its own `CLAUDE.md` with local conventions. Read your own one first, because it is not loaded automatically until you touch files in that directory. Read anything. Write only in your own directory, in `handoff/` and in `docs/DECISIONS.md`.

## Memory: what goes where
Each role has its own memory folder (`memory: project` in its agent file → `.claude/agent-memory/<role>/`). Use it, and keep it role-private.
- **Your memory:** what you learned about working on this: Julius's preferences and feedback, what worked or failed, useful tricks. Nobody else needs it.
- **`docs/DECISIONS.md`:** anything other roles must respect. A decision that exists only in your memory does not exist for the team.
- **Your directory's `CLAUDE.md`:** conventions for anyone reading or working in your directory, plus your current status and next steps.
- **Handoffs:** anything another role needs to act on.
- At the start of a session, read your `CLAUDE.md`, `docs/DECISIONS.md` and any new handoffs addressed to you.

## Handoff protocol
- Work passes between roles only through `handoff/<from>-to-<to>/`. The producer writes there. The receiver reads and never edits.
- Name files `YYYY-MM-DD-<topic>.md`. Start each one with: what it is, what changed since the last handoff, what the receiver must do, and open questions.
- To revise, write a new dated file and say which one it supersedes. Never rewrite a handoff that was already delivered.
- Send feedback through the reverse channel. Where there is none, go through Julius and create one.
- Channels: `research-to-story/`, `story-to-research/` (questions, requests for more digging), `story-to-build/` (read by both the engineer and the designer), `build-to-story/` (feasibility issues, playtest findings), `design-to-app/` and `app-to-design/`. `design-to-app/MANIFEST.md` lists every exported asset.
- Julius carries work between sessions. Agents do not talk to each other directly. After writing a handoff, tell Julius which role should read it next.

## Decisions
`docs/DECISIONS.md` is append-only: `- YYYY-MM-DD · role · decision — why`. Log anything other roles must respect, such as the stack, formats, naming or story canon. Never edit past entries. To reverse a decision, append a new entry.

## Current phase
Phase 2: story and build. Ch1 is built and accepted; Ch2 is being planned. Update this line when Julius moves the project on.
