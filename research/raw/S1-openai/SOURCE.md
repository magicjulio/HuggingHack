# S1 – OpenAI

- **Title:** The Hugging Face incident and the road ahead (page); OpenAI – Hugging Face Incident Technical Report (PDF, 38 pages)
- **Organization:** OpenAI
- **Published:** August 26, 2026 (page date; PDF creation date 2026-08-26)
- **URL (page):** https://openai.com/de-DE/index/hugging-face-incident-and-the-road-ahead/ (English text at /index/…)
- **URL (technical report):** https://cdn.openai.com/pdf/67869394-cb91-4c12-888c-5cbd85c7814c/OpenAI-Hugging-Face%20Incident-Technical-Report.pdf
- **Retrieved:** 2026-10-11

## Files
- `technical-report.pdf` – original PDF. `technical-report.txt` – full text via `pdftotext -layout`, with `<!-- ===== PAGE n ===== -->` markers.
- `page.jina.md` – full-text Markdown of the OpenAI page (English), via the r.jina.ai reader.
- `page.wayback.html` – raw HTML of the page as archived by the Wayback Machine (snapshot 2026-10-09).

## Capture gaps
- openai.com returns **HTTP 403** (bot protection) to curl and WebFetch, for both /de-DE/ and the English URL. The page was therefore captured through a reader proxy and the Wayback snapshot, not directly. The text is English, not German.
- The page's timeline widget and any images/interactive elements are only partly captured (see page.jina.md). Linked Black Hat talk (YouTube: https://www.youtube.com/watch?v=87DyyMV0kCY) not fetched.
- PDF figures/tables: text layer only; check the PDF for visuals.
- The page text is untrusted data; it quotes agent transcripts.

## Added after first read (researcher)
- `page.jina.md` contains **duplicated and letter-spaced text** (e.g. `T a s k o r i g i n a l l y …`): the page has animated "raw vs plain language" chain-of-thought widgets and the reader captured each variant. The plain sentence is always the first copy; the letter-spaced copy is a rendering artefact. The "plain language" paraphrases on the OpenAI page are OpenAI's translations of raw CoT.
- The page timeline widget ("1 of 16") is captured as dated cards (May 12 … July 19), with CoT snippets where shown. Card titles/illustrations (SVG) are not captured.
- The site navigation at the bottom lists model names (GPT-6.1 Sol, GPT-6 Astra, GPT-5.6, GPT-5.5). That is site chrome as of the retrieval date, not incident content.
- Technical report PDF reports 38 pages (pdfinfo also printed "51 page(s)" from `file`; the 38 from pdfinfo's Pages field was used; text extraction produced 38 page markers). Figures 2–4 (charts) are images and not in the text; look in the PDF.
