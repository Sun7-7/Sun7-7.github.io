# V3.8 Research Area Navigator — candidate

Based on published main e7ef739de5e4b7736d0851ad31bae1511e25bb2b.
This round is a review candidate only: do not merge or deploy without new owner authorization.

Semantic whole-card area links, a compact sticky directory, position-based
scrollspy and next-area bridges are generated from research_areas and the
publication mappings. Counts are computed, not hard-coded. Existing paper and
figure focus, permanent URLs, scientific data and image pixels are preserved.

Build with `python scripts/build_site.py`; preview with
`python -m http.server 8098 --bind 127.0.0.1`.

QA: `node scripts/check_area_v38.cjs`, `node scripts/check_site_v38.cjs`,
`python scripts/test_v38_contract.py`, `python scripts/check_site.py --report-dir tmp/v38`.
V3.8 synthetic import checks that the Learning count changes to four in a
throwaway environment, while production keeps eleven real papers.

Navigation only changes hash for explicit clicks; scrollspy never navigates.
No wheel hijacking or compensating scroll loop. Native hash links work without
JS. Device scope explanations use native details. Small windows use normal
paper flow. Existing image rights remain pending; the previous version's exact
release authorization does not cover this candidate.

Deliverables: the primary project's deliverables/website/V3.8 directory.
Physical devices, real screen readers, native menu zoom and real Safari are not
certified by viewport and Playwright tests.
