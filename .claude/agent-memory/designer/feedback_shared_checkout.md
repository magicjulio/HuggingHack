---
name: feedback-shared-checkout
description: All roles share ONE checkout at /home/julio/Desktop/HuggingHack on main; never work in a git worktree/branch, or handoffs are invisible to other roles
metadata:
  type: feedback
---
On 2026-10-12 the desktop app put my designer session in a git worktree (`.claude/worktrees/designer-memory-d87abc`, branch `claude/designer-memory-d87abc`). Everything I wrote there, including the 3D props handoff, the MANIFEST rows and the DECISIONS entry, was invisible to the engineer, who works in the main checkout. Julius: "you messed our layout totally up and the engineer didn't get your handoff."

**Why:** the handoff protocol relies on every role session reading and writing the same files in `/home/julio/Desktop/HuggingHack` (sessions start from the repo root). A branch or worktree breaks that silently.

**How to apply:** at session start, check `pwd` and `git worktree list`. If I'm in `.claude/worktrees/…` or not on `main` in the root checkout, stop and tell Julius before writing anything. Also check other roles' new handoffs in the root checkout (they may be uncommitted). Related: [[feedback-show-progress]].
