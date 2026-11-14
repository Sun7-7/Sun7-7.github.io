"""Validate the story and PDF registries against published records."""
import hashlib
import json
from pathlib import PurePosixPath
from urllib.parse import urlsplit

SECTIONS = {'question','method','evidence','significance','figures','scope','references'}
TEMPLATES = {'method','theory','experiment','device','basic'}


def validate_reading(root, publications, details, figures, baseline_slugs):
    errors = []
    for filename in ('paper_stories.json', 'pdf_sources.json'):
        try:
            rows = json.loads((root/'data'/filename).read_text(encoding='utf-8'))
            assert isinstance(rows, list) and all(isinstance(row, dict) for row in rows)
            key = 'slug' if filename == 'paper_stories.json' else 'paperId'
            slugs = [row[key] for row in rows]
            assert len(slugs) == len(set(slugs)) and set(baseline_slugs) <= set(slugs) <= set(publications)
        except (OSError, ValueError, TypeError, KeyError, AssertionError):
            errors.append(filename + ': invalid, duplicate, missing or unknown publication record')
            continue
        for row in rows:
            slug = row[key]
            try:
                if filename == 'paper_stories.json':
                    assert row['template'] in TEMPLATES
                    assert len(row['sectionOrder']) == len(SECTIONS) and set(row['sectionOrder']) == SECTIONS
                    refs = row['figureRefs']
                    assert len(refs) == len(set(refs)) and all(figures[ref]['publication_slug'] == slug for ref in refs)
                    assert all(ref == 'focusBrief.finding' and all(details[slug]['focusBrief'][lang]['finding']['text'] for lang in ('zh','en')) for ref in row.get('evidenceRefs', []))
                    review = row['copyReview']
                    assert review['status'] in ('draft','source_checked','author_approved')
                    assert all(loc['url'] in {x['url'] for x in publications[slug]['links']} and loc['location'] for loc in review['sourceLocations'])
                    if 'copy' in row:
                        assert review['status'] != 'draft' and review['sourceLocations']
                        assert set(row['copy']) == {'zh','en'}
                        assert all(set(text) == {'evidence','scope'} and all(isinstance(v, str) and v.strip() for v in text.values()) for text in row['copy'].values())
                else:
                    landing = urlsplit(row['landingUrl'])
                    assert landing.scheme == 'https' and landing.netloc in {'doi.org','proceedings.mlr.press','ojs.aaai.org','www.mdpi.com','pubs.aip.org'}
                    assert row['landingUrl'] in {x['url'] for x in publications[slug]['links']}
                    assert row['version'] in {'published','accepted_manuscript','preprint'}
                    assert row['reviewStatus'] in {'local_verified','remote_verified','official_source_only'}
                    assert isinstance(row['mayPublishLocal'],bool) and isinstance(row['licenseEvidence'],list)
                    local, remote, external = row['localPdfPath'], row['remotePdfUrl'], row['externalPdfUrl']
                    if local:
                        assert local == 'assets/papers/'+slug+'.pdf'
                        assert row['mayPublishLocal'] and row['reviewStatus']=='local_verified' and row['licenseEvidence']
                        data = (root/local).read_bytes()
                        assert data.startswith(b'%PDF-') and hashlib.sha256(data).hexdigest()==row['sha256']
                    else:
                        assert not row['mayPublishLocal'] and row['sha256'] is None
                    if remote:
                        url = urlsplit(remote)
                        assert url.scheme=='https' and url.path.endswith('.pdf') and not url.query
                        assert ((url.netloc=='raw.githubusercontent.com' and url.path.startswith('/mlresearch/') and '/main/assets/' in url.path) or (url.netloc=='mdpi-res.com' and url.path.startswith('/d_attachment/')))
                        assert row['licenseEvidence'] and row['reviewStatus'] in {'remote_verified','local_verified'}
                    if external:
                        url = urlsplit(external)
                        assert url.scheme=='https' and url.netloc=='ojs.aaai.org' and url.path.startswith('/index.php/AAAI/article/download/') and not url.query
                        assert row['licenseEvidence']
                    if not local and not remote:
                        assert row['reviewStatus']=='official_source_only'
            except (AssertionError, KeyError, TypeError, ValueError, AttributeError, IndexError, OSError):
                errors.append(f'{filename}: invalid source, section or ownership for {slug}')
    return errors
