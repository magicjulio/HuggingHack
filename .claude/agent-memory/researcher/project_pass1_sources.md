---
name: pass1-sources-facts
description: Where the S1–S3 raw files came from and pitfalls (openai.com 403, pandoc dropping tables, spelled-out CoT duplicates)
type: project
---
openai.com/hugging-face-incident page returns 403 to curl/WebFetch (2026-10-11); worked via `r.jina.ai/<url>` and `web.archive.org/web/2026/<url>`. The technical report PDF (cdn.openai.com) downloads fine with curl. METR PDF is image-based (no text). pandoc dropped METR Table 1 (recovered by hand); the jina text of S1 contains letter-spaced duplicate CoT lines (widget artefact).

**Why:** saves hours next time sources are re-fetched or secondary sources (S4+) hit similar blocks.
**How to apply:** try jina reader + Wayback before giving up; check converted text for `[TABLE]` markers.
