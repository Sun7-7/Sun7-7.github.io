# V3.7 Academic Editorial + Research Portfolio

This version continues the V3.6 candidate bb41318c7ae6c814de5fce6a0aad83aa02f5ce85,
with remote main 40f94e5c0020fb87e9cb63be4274f8f2c49cc27e verified before work.
The owner explicitly authorized this iteration to be deployed on 2026-10-29.
Deployment status and final main SHA belong in the release receipt, not inferred
from source availability. No third-party rights have been newly inferred.

Research retains position-driven paper focus and adds local primary/secondary
figure focus: hover/focus is temporary, click/tap pins, reset restores the
role/aspect-based default. The image control focuses; separate Enlarge and
Original controls open the viewer or raw asset. All images preserve their ratio.
Other pages use lighter background/focus treatments, explicit shared viewers,
reading navigation and native controls. They do not copy Research's accordion.

## Build / preview

```powershell
python scripts/build_site.py
python -m http.server 8097 --bind 127.0.0.1
```

No framework or runtime dependencies were added. Complete English titles,
publication author order, sources, original images and scientific evidence are
preserved. JS-disabled and print layouts show all content. Mobile / shorter
windows use native document flow; reduced motion disables transitions.

## Data / QA

See docs/V37_MAINTENANCE.md. Metadata remains in publications; focusBrief is
an exact excerpt with an evidenceRef into the reviewed bilingual detail record.
Figure descriptions point to caption/insight fields; dimensions are read from
the original PNG. Research mappings declare the default figure and track weights.

```powershell
python scripts/validate_publications.py --check-output
python scripts/test_publication_pipeline.py
python scripts/test_v37_contract.py
python scripts/check_site.py --report-dir tmp/v37
npm ci
node scripts/check_site_v37.cjs
node scripts/check_media_v37.cjs
node scripts/record_v37.cjs
$env:TEST_BASE_URL='http://127.0.0.1:8097'
$env:REVIEW_PACKET_DIR='tmp/v37'
node scripts/run_lighthouse_v36.mjs
```

New synthetic paper/figure tests operate only in a disposable directory;
production retains eleven real publications. Existing 33 image-rights entries
remain pending. Exact owner snapshot approval is separate from copyright status.
Actual browser captures and raw reports are delivered under the primary
project's deliverables/website/V3.7 directory, excluded from public Git content.
Native menu zoom, physical devices and screen readers require manual checks;
viewport equivalents and Playwright WebKit do not certify those environments.
