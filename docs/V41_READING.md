# Paper Story and PDF reader

Run `python scripts/build_site.py` to generate the bilingual site, then serve this directory over HTTP. The generator adds one standalone story per language and paper. Existing paper metadata, details, figures and citations remain the source records.

The Story and PDF controls are links with real destinations. JavaScript enhances ordinary clicks with native modal dialogs. The dialog stack restores the opener and scroll position. Research focus controllers pause while a reading dialog is open. Modal actions do not create browser history entries. Use Back in the dialog or Escape to return. Browser Back continues to navigate between pages.

`data/paper_stories.json` configures layout, figure ownership and checked editorial excerpts. The source and reuse registry is `data/pdf_sources.json`. Drafts can carry optional `reading.story` and `reading.pdfSource` records for transactional promotion. Omitting them generates a basic story and official-source link.

Mozilla PDF.js 6.5.438 is pinned under `vendor/pdfjs` with its release license. The upstream Viewer renders the PDF, text layer and search results. It opens on demand, uses local worker/fonts/maps, and reads the allowlisted PMLR PDF with browser CORS. The host verifies the response, limits downloads to 64 MB, times out loading, and releases the iframe and PDF task when closed. The paper ID selects an approved local asset or a verified publisher PDF from the registry. Official source links remain available when embedding is unavailable. The embedded viewer disables PDF JavaScript and document fingerprint persistence.

For browser QA, install the development dependencies, serve port 8103 and run `node scripts/check_reading_v41.cjs`. The check opens all eleven paper entries with no file selection and verifies both rendered documents and the official-source fallback. Results and coverage limits are documented in the review packet.
