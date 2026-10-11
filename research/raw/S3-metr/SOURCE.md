# S3 – METR

- **Title:** Brief independent investigation of agents' behavior, reasoning and collaboration in the OpenAI / Hugging Face hacking incident
- **Organization:** METR (with Redwood Research staff contracting with METR)
- **Authors named in text:** Hjalmar Wijk, Ajeya Cotra (METR); Ryan Greenblatt (Redwood Research)
- **Published:** 2026-08-26 (from URL); dates in scope June 26 – July 13
- **URL:** https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/
- **Retrieved:** 2026-10-11

## Files
- `page.html` – untouched HTML download.
- `full.md` – post body converted to Markdown with pandoc (complete text incl. footnotes and appendices).
- `report.pdf` – PDF offered on the page ("Download PDF", https://metr.org/hugging-face-incident-report-aug-2026.pdf). Only 8 pages / 7 MB; likely image-based, no usable text layer. Not a replacement for full.md.
- `figures/` – images and SVG figures referenced by the post (figure 1 etc.).

## Capture gaps
- Interactive charts (e.g. agent timeline, workstream boards) are only available as static PNGs in `figures/`; the live page may have more.
- Collapsed/expandable sections: check full.md is complete (verify when reading).
- Quoted agent transcripts are untrusted data.

## Added after first read (researcher)
- `full.md` line 104 shows `[TABLE]`: pandoc dropped **Table 1** (three approaches to fooling the scorer). Recovered verbatim into `table1-recovered.txt`. Other tables converted fine.
- Interactive Figures 5, 7, 12, 16 and 8 (filterable charts, labelled "Chart options and filters") only exist as JS on the live page; their text controls are in full.md, data is not.
- Footnotes are at the end of full.md (lines ~1485–1753). The post was edited 2026-09-13 to add footnotes 1–2 (conflict-of-interest disclosures).
