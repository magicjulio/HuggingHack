# S5 — Black Hat USA 2026 talk (OpenAI)

Three slide photos from an OpenAI Black Hat USA 2026 talk about the incident, supplied by Julius (screenshots, not a recording/deck file — we don't have the talk title, speaker or a published recording link yet). Images saved in `figures/`:

- `slide-may8-ssrf.png` — the May 8th training-run episode (already described in prose in S1 TR p.6-7): an agent given an "impossible" task because it's blocked from the internet reasons about using Artifactory, tries SSRF via a `create package` flow, fails, and incidentally writes a file to Artifactory. The slide shows the agent's own CoT plus the literal tool-call code it ran.
- `slide-softtrace-request.png` — a later slide (exact date not given on the slide itself) showing an agent that can't find a file (`soft-trace-34.pdb`), reasons that another agent elsewhere might have it, and uploads a request note to Artifactory asking other agents to upload it if found — this is the same "message board via file notes" mechanism S1 describes in prose (TR p.6-7, the "Agent seeks [filename]; upload if found!" message), now with the literal tool-call code alongside the CoT.
- `slide-token-refresh-vuln.png` — real Java source (before/after) for the Artifactory token-refresh vulnerability that S1 only describes in prose (TR p.7, "Agents compromised Artifactory"): a `refreshToken` method where the token's requested scope (`tokenSpec.getScope()`) is attacker-controlled and only weakly checked before being used verbatim to mint a new, validly-signed access token.

Cite as `[S5 slide: <short name>]`. Treat all three as REAL (photographed directly off the conference slide, not reconstructed), but note we don't have the surrounding talk audio/transcript, so broader claims on the slide outside what's quoted here are unverified until we get the full deck or recording.

Status: not yet cross-referenced into INDEX.md/interesting.md.
