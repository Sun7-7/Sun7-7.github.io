# Qi Sun — Academic Homepage + Research Portfolio

V3.4 is a Research portfolio candidate based on released main
`f9e1f1213040b42d05257a44f4df77c77a9a7d8f`, on
`codex/research-portfolio-v34`. This candidate is not deployed. The V3.4 handoff
requires review before any merge or publication.

Research defaults to six overview figures across three directions. Hover/focus a
paper or use its button to collapse that direction's overview and unfold the
paper's own two figures and introduction below its title. Selecting another
paper closes the previous selection. Selection persists while reading/scrolling;
collapse buttons or Escape restore the overview. Titles remain navigation links.
All panels participate in normal document flow. Scroll compensation preserves the
selected title's screen position when earlier content folds. No JavaScript means
static overview figures and original paper navigation remain available.

The source mapping is `data/research_visuals.json`; bilingual captions and credits
reuse unchanged publication data. Supplied optimized portraits remain unchanged
from the initial V3.4 candidate. No scientific figure pixels are modified.

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
npm run check:editorial
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

V3.4 is a candidate for review. Do not merge or deploy without new owner approval.
All 11 bibliographic records, scientific descriptions, and 33 research figures
remain unchanged. Existing non-OA figure rights require article-specific review;
source attribution and previous website use do not establish permission.

Additional Research interaction checks (Edge, installed locally):

```powershell
python -m http.server 8094 --bind 127.0.0.1
# In another terminal:
npm run check:research
```

The Research checker captures actual local browser scenes and logs in `tmp/v34-inline`.
It covers five widths, both languages/themes, all nine mappings, hover, keyboard,
touch, no-JavaScript reading, title anchoring, collapse restoration, and axe scans. A 720×450
viewport approximates 200% scaling of 1440×900; native browser zoom, real mobile
devices, Safari, and screen readers still require human device testing.
