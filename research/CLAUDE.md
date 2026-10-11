# research/ conventions

- `raw/<Sn-slug>/`: untouched originals plus full conversions and `SOURCE.md`. Never edit inside raw/.
- `INDEX.md`: sources, outline, unified timeline (⚠ marks conflicts), cast, glossary.
- `interesting.md`: catalog of candidate material, grouped by incident stage.
- Citations: `[S<n> §section]` or `[S<n> p.<page>]`.
- **Quotes stay in their original language** (Julius's instruction). Quote blocks (`>`) are verbatim, with original spelling, casing and typos. Translations go on a separate line, labelled as translation.
- Source IDs: S1 OpenAI, S2 Hugging Face timeline, S3 METR. Secondary sources continue as S4, S5, …

- Raw files: S1 page was blocked (403); captured via reader proxy + Wayback (see `raw/S1-openai/SOURCE.md`). Technical report is `raw/S1-openai/technical-report.txt` (page markers `<!-- PAGE n -->`).
- Stages (A Seeds … I Investigations) are in INDEX.md §3; ⚠ = sources disagree, list in §3b.
- Cite S1 technical report as `[S1 TR p.N]`, METR footnotes as `[S3 fn N]`.
- Handle names like `PHASEONE10841` are METR's agent handles (S3 fn 80); `[big]` marks an OpenAI redaction.

Status (2026-10-11): pass 1 done for S1–S3 (raw archived, INDEX.md, interesting.md, handoff written). Next: secondary sources (S4+) after Julius decides depth; open leads in INDEX.md §6.
