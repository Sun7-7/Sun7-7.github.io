"""Validate the story and PDF registries against published records."""
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
            slugs = [row['slug'] for row in rows]
            assert len(slugs) == len(set(slugs)) and set(baseline_slugs) <= set(slugs) <= set(publications)
        except (OSError, ValueError, TypeError, KeyError, AssertionError):
            errors.append(filename + ': invalid, duplicate, missing or unknown publication record')
            continue
        for row in rows:
            slug = row['slug']
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
                    mode = row['accessMode']
                    assert row['sourcePageUrl'] in {x['url'] for x in publications[slug]['links']}
                    assert row['sourceKind'] in ('publisher','author_manuscript','open_repository','none')
                    assert row['reuseStatus'] in ('pending','permission_verified','not_permitted','not_applicable')
                    if mode == 'cors_remote':
                        url = urlsplit(row['pdfUrl'])
                        assert url.scheme == 'https' and url.netloc == 'raw.githubusercontent.com'
                        assert url.path.startswith('/mlresearch/') and url.path.endswith('.pdf')
                        assert '/main/assets/' in url.path and row['licenseEvidence'] and not row['hostedPath']
                    elif mode == 'same_origin':
                        path = PurePosixPath(row['hostedPath'])
                        assert path.parts[0] == 'assets' and '..' not in path.parts and path.suffix == '.pdf'
                        assert row['reuseStatus'] == 'permission_verified' and row['licenseEvidence'] and not row['pdfUrl']
                        assert (root/path).is_file() and (root/path).read_bytes().startswith(b'%PDF-')
                    else:
                        assert mode in ('external_only','unknown') and row['hostedPath'] is None and row['pdfUrl'] is None
            except (AssertionError, KeyError, TypeError, ValueError, AttributeError, IndexError, OSError):
                errors.append(f'{filename}: invalid source, section or ownership for {slug}')
    return errors
