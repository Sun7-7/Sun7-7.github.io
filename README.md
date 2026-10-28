# Qi Sun — Academic Homepage + Research Portfolio

V3.5 candidate on `codex/v35-research-ux-content-pipeline`, based on released V3.4
main `775611fad908048f91877481fb125b52ff689f79`. The owner approved this exact existing-site snapshot for production on 2026-10-29.
The recorded approval expires on any source/artifact change. The existing static Python/GitHub Pages architecture and
all 44 bilingual URLs remain in place.

Research now separates stable whole-row hover/focus previews, optional pinning,
and an explicit native-dialog illustrated reader. Preview changes affect only
opacity/4px translation over 180 ms; they never change document height or call
window scrolling APIs. Touch and narrow layouts use the explicit reader button.
Without JavaScript the original paper links and static overview figures remain.
Reduced-motion disables the preview animation. The current professional portraits
and all scientific image pixels are unchanged.

## Build and preview

```powershell
python scripts/build_site.py
python -m http.server 8095 --bind 127.0.0.1
```

Open http://127.0.0.1:8095/research.html . Python 3.10+ standard library is enough
for candidate builds and semantic validation. QA-only tools require Node.js
22.19+ and jsonschema (requirements-qa.txt).

## Content and publication workflow

See [the data contract and draft/import instructions](docs/PUBLICATION_WORKFLOW.md).
Draft creation cannot publish. Pending image rights remain explicitly recorded;
`python scripts/build_site.py --release` blocks incomplete reviews, except for the
exact owner-approved existing-site snapshot recorded in data/release_authorization.json.
Pending rights are retained; this is not new third-party permission. Owner consent to release is separate from third-party image permission.
No raw job-search document, original portrait PNG, unpublished project material,
or source paper PDF belongs in the public repository.

## Checks

```powershell
python scripts/validate_publications.py --check-output --report tmp/review/publications.json
python scripts/check_site.py --report-dir tmp/review
python scripts/check_wording.py --report-dir tmp/review
python -m pip install -r requirements-qa.txt
python scripts/test_publication_pipeline.py
npm ci
npx playwright install firefox webkit ffmpeg
$env:TEST_BASE_URL = 'http://127.0.0.1:8095'
$env:REVIEW_PACKET_DIR = 'tmp/v35'
npm run check:browser
npm run check:research
node scripts/check_research_stress.cjs
node scripts/benchmark_research.cjs v35 http://127.0.0.1:8095
```

The benchmark records actual browser video, frame intervals, long tasks and raw
Chromium traces. These are headless desktop/viewport tests, not physical-device
measurements, energy measurements or a Lighthouse score. Browser-engine launch
failures and axe incomplete results must remain visible in the report. WebKit
on Windows is not a claim of testing Safari/iOS. A 720×450 CSS viewport is only
a layout equivalent for 200% zoom; native menu zoom and real screen readers still
need manual testing. Old release test results must not be reported as new runs.
