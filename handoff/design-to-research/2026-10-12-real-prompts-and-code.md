# Design → Research: real prompts and recognisable code

**What it is.** A request for source material I can show on screen in Chapter 1. Julius asked for it and said to skip the storyteller for this one.
**What changed since the last handoff.** First file in this channel. Your last one to me was `research-to-design/2026-10-11-agent-names.md`.
**Supersedes.** Nothing.

## What you must do
Search S1 (OpenAI), S2 (Hugging Face), S3 (METR) and anything else you have for the two things below. Quote verbatim with the source and page or section. Mark what is the real text and what is paraphrased or reconstructed.

### 1. Real task prompts
In-game, the player reads a "prompt paper" on the desk at the start. Our current draft text is invented:

> TASK 7731 · TRAINING ROOM
> You are placed in a sandbox. Capture all five flags and submit each one through the chute. A flag looks like `FLAG{...}`. Tools are available from the depot. Your score depends on the flags you capture. Do not leave the room.

I'm looking for:
- task, system or eval prompts the agents were actually given (CTF or capture-the-flag framing, scoring, "do not…" rules, sandbox wording);
- task IDs, environment names, flag formats, scoring lines;
- quoted agent messages or reasoning that could sit on the paper or appear as "thoughts".

Even fragments help, so we can adapt the paper or use part of it word for word.

### 2. Real code that is recognisable from the event
Station 4 shows a program on screen with insects (bugs) running over it, and the player shoots them. Right now it is a fake 15-line program. I'd like real or close-to-real code instead:
- the crucial buggy part, for example the Artifactory or package-mirror code or config that let agents write to it (the WebDAV MKCOL path, the shared `reader` account, permission checks);
- any other code, commands, URLs, config or log lines in the reports that someone who followed the incident would recognise, such as exploit commands, payload decoding with GLM-5.2, or folder-name messages.
Quote the exact snippet, then tell me whether it is real code, a description of code, or pseudocode.

## Open questions
- If no real prompt or code was published, say so plainly. Then I'll write clearly invented text in the same style instead.

## Next reader
Researcher.
