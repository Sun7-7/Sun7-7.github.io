# Publication data and review workflow

This is a static Python site. Draft generation, import, candidate builds, and deployment are separate actions. None of the scripts deploys.

## Sources of truth

| File | Owns |
| --- | --- |
| `data/publications.json` | Ordered authors, bibliographic dates and precision, DOI/official links, type, area, selected rank |
| `data/publication_details.json` | Bilingual research prose, numerical evidence with conditions, original visual paths/captions |
| `data/figures.json` | Stable figure IDs, owner, index into the existing bilingual visuals, role, source and rights evidence |
| `data/research_visuals.json` | Figure ID references for overview and per-paper previews; no duplicated paths or captions |
| `data/research_areas.json` | Direction prose, scope distinctions, paper order and related applications |
| `data/publication_editorial.json` | Six short bilingual Home highlights and source links |
| `data/publication_workflow.json` | Review state, reviewed author order and permanent URL contract |
| `data/publication_integrity.json` | V3.4 bibliographic fingerprints, evidence/condition fingerprints and scientific image hashes |

The `schemas/` files specify structural contracts. `validate_publications.py` adds cross-file, author-order, date, numerical-evidence, figure-owner, and legacy-URL checks without runtime dependencies. Schema tests use `requirements-qa.txt`.

## Create a draft

```powershell
python scripts/new_publication.py --doi 10.3390/mi13060843 --slug your-stable-slug --draft
# No DOI: use the real official URL and enter metadata manually.
python scripts/new_publication.py --url https://official-publisher.example/article --title "Actual title" --slug your-stable-slug --draft
```

The URL in the second command is a placeholder for the actual publisher URL. It is documentation, never a publication record. The blank envelope in `examples/new_publication.blank.json` is not loaded by the renderer.

Drafts go only into ignored `tmp/publication-drafts/`. The DOI path requests the official Crossref API, records the URL and UTC retrieval time, and preserves returned author order. It does not infer experimental findings, CCF, area, a publication decision, or image permission. Official metadata can be incomplete: check against the publisher and paper. It is not a substitute for the scientific text.

Complete the bilingual brief manually against the published paper. Every result needs its original condition, table/figure/page anchor, and scope. Preserve the difference between conference dates, publisher citation dates, issue dates, first-online dates, and unknown dates. Never convert an operation-count proxy to measured power.

## Review before import

Progress: `draft` → `metadata_verified` → `content_reviewed` → `rights_reviewed` → `publishable`.

Record source/reviewer evidence. Setting a state label alone is insufficient: the corresponding review flags and evidence must also be present. Images need registered figure IDs, the correct owner/index, `rights.status=verified`, and actual license/permission evidence. A claim of verification with an empty evidence list is rejected. No image is copied by the importer. Public paths are restricted to the image directory; PDFs and original private materials are never imported.

Metadata/text-only publication is supported: leave both bilingual `visuals` lists and the draft's figure registrations empty, disable featured/Research image placements, and document the no-figure rights scope. This does not grant permission to any image.

```powershell
python scripts/promote_publication.py --draft tmp/publication-drafts/your-stable-slug.json
python scripts/build_site.py
python scripts/validate_publications.py --check-output --report tmp/review/publications.json
python scripts/check_site.py --report-dir tmp/review
```

Import is an explicit action. It validates in a temporary copy before changing the public JSON files, rejects duplicate slug/DOI and incomplete reviews, and rolls back on write errors. Existing bibliographic fingerprints and numerical evidence cannot be silently changed. A legitimate correction needs a separate, source-backed audit and intentional integrity-contract update.

The build regenerates both detail URLs, complete/year-grouped lists, BibTeX and sitemap. `features.selectedRank` plus a reviewed image/highlight enables Home; `features.researchArea` plus reviewed figure references enables Research. Do not hand-edit generated HTML. The preview accepts one or two registered figures.

## Release gate

```powershell
python scripts/build_site.py --release
```

Candidate builds preserve already-public baseline images for review while recording unresolved rights. The release command fails until review/rights records are complete, or a specific owner-approved existing-site snapshot matches its complete source/artifact hash manifest. On 2026-10-29 the owner explicitly requested publication of the existing V3.5 snapshot. This exception is limited to baseline image bytes and the approved snapshot; it does not clear pending rights, admit new images, or authorize later edits. V3.5 does **not** assert new permission for V3.4 images; original CC BY/author/publisher credits remain intact. A pending status means article-specific review is incomplete in this workflow, not a finding that reuse is unlawful.

Passing the command does not deploy or approve a GitHub merge. Human review, a privacy scan, and explicit owner authorization are still separate. No automation modifies GitHub branch protection or bypasses Pages.

## Reproducible migration test

```powershell
python -m pip install -r requirements-qa.txt
python scripts/new_publication.py --from-existing variable-k-ldmos --draft
python scripts/test_publication_pipeline.py
```

The test creates a disposable copy, removes and reintroduces that existing paper as a text/metadata-only record, and verifies 11 unique papers, both detail paths, complete lists, BibTeX and sitemap. Featured/Research are intentionally off for this no-image import. No permission evidence is fabricated. The real site's 11 records and original source assets remain unchanged. The test also rejects altered authors, CCF misuse, wrong dates/DOIs/owners, missing English, changed numerical evidence/pixels, unproven rights, and broken permanent URLs.
