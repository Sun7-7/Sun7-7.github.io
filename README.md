# Qi Sun — Academic Homepage + Research Portfolio

V3.6 **candidate**, branch `codex/v36-research-focus-accordion`, based on released
main `40f94e5c0020fb87e9cb63be4274f8f2c49cc27e`. This iteration is not approved for
merge or production deployment. The V3.5 owner approval applies only to its old
exact snapshot and does not authorize this source.

Research uses a position-driven focus accordion: natural document scrolling
advances the open paper; a 120ms whole-row hover temporarily previews another
paper; leaving the deck or continuing scrolling restores the position state.
The fixed desktop deck changes internal row sizes without changing document
height. Clicking a heading or using arrow/Home/End keys performs one native
smooth navigation. Mobile, touch and short windows use a non-sticky accordion.

Expanded cards retain the full publication title, contribution, authors, source
links and real figures. The native figure viewer supports Escape and focus
return. Without JavaScript, all ten Research paper bodies and twenty figures
remain visible in the actual HTML. Reduced-motion removes transitions. All
existing scientific evidence, publication metadata, image bytes and 44 bilingual
URLs remain intact.

## Build and preview

```powershell
python scripts/build_site.py
python -m http.server 8096 --bind 127.0.0.1
```

Open http://127.0.0.1:8096/research.html . Candidate build and semantic validation
use Python 3.10+ standard library. Browser QA needs Node.js 22.19+ and optional
Python schema QA uses requirements-qa.txt.

## Content maintenance

See [V3.6 Chinese maintenance guide](docs/V36_RESEARCH_MAINTENANCE.md) and the
[original import workflow](docs/PUBLICATION_WORKFLOW.md). New bilingual short
headings and contributions are optional paired fields in publication_details;
Research order and explicit figure ownership remain data-driven. The blank
V3.6 new-paper example is inert and never becomes a fabricated publication.

Unreviewed new records and images remain blocked. Existing 33 image-rights
records remain pending, with no invented third-party permission. Raw source
PDFs, job-search documents and unpublished projects do not belong in this repo.
`python scripts/build_site.py --release` must reject this unapproved candidate.

## Current checks

```powershell
python scripts/validate_publications.py --check-output --report tmp/v36/logs/validation.json
python scripts/check_research_data.py
python scripts/check_site.py --report-dir tmp/v36
python scripts/check_wording.py --report-dir tmp/v36
python -m pip install -r requirements-qa.txt
python scripts/test_publication_pipeline.py
python scripts/test_release_authorization.py
npm ci
# Install browser QA engines if absent; Edge is used for the primary matrix.
npx playwright install webkit ffmpeg
$env:TEST_BASE_URL = 'http://127.0.0.1:8096'
$env:REVIEW_PACKET_DIR = 'tmp/v36'
npm run check:research:v36
node scripts/record_research_v36.cjs
node scripts/check_research_viewer_v36.cjs
node scripts/run_lighthouse_v36.mjs
```

Earlier Research/benchmark scripts target the V3.4/V3.5 DOM and remain historical
reproduction tools; their old pass counts are not V3.6 results. Tests preserve
raw axe incomplete results and browser-engine availability. Viewport/touch
emulation is not physical-device testing; WebKit on Windows is not real Safari.
The 720×450 zoom check is a layout equivalent, not native browser menu zoom.
