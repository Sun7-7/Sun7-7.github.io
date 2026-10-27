# Qi Sun — Academic Homepage + Research Portfolio

V3.1 is a review candidate on `redesign/academic-homepage-v3-1`, based on
`001a1dff3b45b99949da3454f7b3d828ec13782c`. It is a static GitHub Pages site.

## Build and preview

Python 3.10+ and the standard library are sufficient for the site build:

```powershell
python scripts/build_site.py
python -m http.server 8091 --bind 127.0.0.1
```

Open `http://127.0.0.1:8091/`. Prebuilt HTML works without Node.js or a dynamic
server. No framework migration or remote font service is required.

## Content ownership

- `data/publications.json`: the sole bibliographic authority, including author
  order, publication-date precision, research area, selected rank, and source URLs.
- `data/publication_details.json`: original scientific briefs and figure captions,
  keyed by stable slug. Scientific results and figure pixels are preserved.
- `data/profile.json`: deliberately limited public academic information. Do not
  replace it with a job-search résumé or add unverified education dates.
- `scripts/build_editorial.py`: bilingual templates and research statements.
- `posts/*.json`: original short notes with explicit English translations.
- `cv.html`, `en/cv.html`: public print-friendly CVs generated from safe data.

The two optimized portrait files are used exactly as supplied. No original
full-resolution portrait, private résumé, or source paper PDF is distributed.
Figure credits point to the source publications; third-party publisher rights
and author-sharing terms remain applicable.

Existing `papers/*.html`, `en/papers/*.html`, `blog.html`, `en/blog.html`, and
`post.html?slug=...` links are retained. Legacy query links resolve only to the
four existing note slugs. All core page text is present without JavaScript.

## Checks

```powershell
python scripts/check_site.py --report-dir tmp/review
npm ci
$env:REVIEW_PACKET_DIR = 'tmp/review'
$env:TEST_BASE_URL = 'http://127.0.0.1:8091'
npm run check:browser
npm run check:lighthouse
```

Node.js 22.19+ is needed only for QA. Windows browser checks use installed Edge;
set `BROWSER_CHANNEL=chrome` to use Chrome. On other platforms, install the
Playwright Chromium runtime with `npx playwright install chromium`. Lighthouse
uses installed Chrome; `CHROME_PATH` can override its location.

Browser checks cover four viewports, both languages, both themes, keyboard
controls, combined filters, legacy links, no-JavaScript content, and printable
CVs. The report directory includes actual screenshots and raw axe/Lighthouse
results. A local Lighthouse result is not a measurement of the production site.

## Review and release

Review the candidate and its public-content audit before merging. This branch
must not be deployed automatically to the production site. The existing Pages
source is `main`; release requires an explicit later decision by the owner.
