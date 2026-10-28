"""Standard-library structural and cross-file checks; release gates are explicit."""
import argparse
import datetime as dt
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATES = ['draft', 'metadata_verified', 'content_reviewed', 'rights_reviewed', 'publishable']
CONTENT = ['oneLine', 'coreClaim', 'problem', 'method', 'whyItMatters', 'discussion']
SNAPSHOT_EXCLUDES = {'.git', 'node_modules', 'tmp', '__pycache__', 'test-results'}
AUTHORIZATION_FILE = 'data/release_authorization.json'

def snapshot_hashes(root):
    """Lock owner approval to one complete source/artifact snapshot, not future edits."""
    result={}
    for path in sorted(Path(root).rglob('*')):
        name=path.relative_to(root).as_posix()
        if not path.is_file() or name==AUTHORIZATION_FILE or SNAPSHOT_EXCLUDES.intersection(path.relative_to(root).parts):continue
        raw=path.read_bytes()
        if path.suffix.lower() not in ['.png','.webp','.jpg','.jpeg','.gif','.pdf','.woff','.woff2']:
            raw=raw.replace(b'\r\n',b'\n')
        result[name]=hashlib.sha256(raw).hexdigest()
    return result

def snapshot_approval(root):
    try:
        approval=read(Path(root),AUTHORIZATION_FILE)
        valid=(approval.get('status')=='owner_approved_existing_site_snapshot'
               and approval.get('approved_files')==snapshot_hashes(root))
        return valid
    except (OSError,ValueError):return False

def read(root, name):
    return json.loads((root / name).read_text(encoding='utf-8'))

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()

def validate(root=ROOT, release=False, check_output=False):
    root = Path(root)
    errors, warnings = [], []
    approved_snapshot=snapshot_approval(root) if release else False
    def require(ok, field):
        if not ok: errors.append(field)
    try:
        papers = read(root, 'data/publications.json')
        details = read(root, 'data/publication_details.json')
        figures = read(root, 'data/figures.json')
        workflow = read(root, 'data/publication_workflow.json')['records']
        baseline = read(root, 'data/publication_integrity.json')
        mappings = read(root, 'data/research_visuals.json')['sections']
    except (ValueError, OSError, KeyError) as exc:
        return {'errors': ['Data contract could not be loaded: '+str(exc)], 'warnings': []}
    pubs = {p['slug']: p for p in papers}
    ds = {d['slug']: d for d in details}
    fs = {f['id']: f for f in figures}
    require(len(pubs) == len(papers), 'Duplicate publication slug')
    require(len(ds) == len(details), 'Duplicate detail slug')
    require(len(fs) == len(figures), 'Duplicate figure ID')
    require(set(pubs) == set(ds) == set(workflow), 'Publication/detail/workflow sets differ')
    require(set(baseline['publications']) <= set(pubs), 'Baseline publication removed')
    doi_seen, ranks = set(), []
    for slug, pub in pubs.items():
        prefix = slug+': '
        require(bool(re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug)), prefix+'invalid slug')
        for name in ['title','venue','publication','publisher','pages','citationKey','dateBasis']:
            require(isinstance(pub.get(name),str) and bool(pub[name].strip()), prefix+'missing '+name)
        require(pub.get('kind') in ['conference','journal'], prefix+'invalid kind')
        require(pub.get('area') in ['learning','signals','device'], prefix+'invalid area')
        require(pub.get('kind')=='conference' or not pub.get('ccf'), prefix+'CCF is conference-only')
        require(not pub.get('ccf') or pub['ccf'] in ['A','B'], prefix+'invalid CCF')
        authors = pub.get('authors', [])
        require(bool(authors) and all(isinstance(a.get(k),str) and a[k].strip() for a in authors for k in ['given','family']),prefix+'invalid authors')
        rec = workflow.get(slug, {})
        require(authors == rec.get('author_order'),prefix+'author order differs from reviewed snapshot')
        require(rec.get('state') in STATES,prefix+'invalid review state')
        require(rec.get('state')=='draft' or rec.get('metadata_verified') is True,prefix+'metadata gate incomplete')
        require(rec.get('state') not in STATES[2:] or rec.get('content_reviewed') is True,prefix+'content gate incomplete')
        require(rec.get('state') not in STATES[3:] or rec.get('rights_reviewed') is True,prefix+'rights gate incomplete')
        require(rec.get('state')!='publishable' or rec.get('publishable') is True,prefix+'publication gate incomplete')
        if slug not in baseline['publications']:
            require(rec.get('state')=='publishable' and rec.get('publishable') is True,prefix+'new publication is not publishable')
        else:
            require(hashlib.sha256(canonical(pub)).hexdigest()==baseline['publications'][slug],prefix+'reviewed bibliographic fields changed')
        require(bool(pub.get('metadataSources')) and all(str(x).startswith('https://') for x in pub.get('metadataSources',[])),prefix+'missing metadata provenance')
        doi = pub.get('doi','').lower()
        if doi:
            require(bool(re.fullmatch(r'10\.\d{4,9}/\S+',doi)),prefix+'invalid DOI')
            require(doi not in doi_seen,prefix+'duplicate DOI');doi_seen.add(doi)
        require(bool(pub.get('links')) and all(x.get('url','').startswith('https://') for x in pub.get('links',[])),prefix+'invalid links')
        date=pub.get('date','');precision=pub.get('datePrecision')
        try:
            require(len(date)=={'day':10,'month':7,'year':4}.get(precision,0),prefix+'date precision mismatch')
            dt.date.fromisoformat(date+('-01' if precision=='month' else '-01-01' if precision=='year' else ''))
            require(int(date[:4])==pub['year'],prefix+'publication year/date mismatch')
        except (ValueError,KeyError,TypeError): errors.append(prefix+'invalid publication date')
        if pub.get('publisher_citation_publication_date'):
            require(pub['publisher_citation_publication_date']==date and bool(pub.get('date_provenance')),prefix+'citation date provenance mismatch')
        if pub.get('selectedRank') is not None:ranks.append(pub['selectedRank'])
        d=ds.get(slug,{})
        for lang,obj in [('zh',d),('en',d.get('en',{}))]:
            require(all(isinstance(obj.get(k),str) and obj[k].strip() for k in CONTENT),prefix+lang+' incomplete content')
            for k in ['evidence','highlights','pipeline','visuals']:require(isinstance(obj.get(k),list),prefix+lang+' missing array '+k)
        require([v.get('src') for v in d.get('visuals',[])]==[v.get('src') for v in d.get('en',{}).get('visuals',[])],prefix+'bilingual figure sources differ')
        if slug in baseline.get('evidence',{}):
            evidence_hash=hashlib.sha256(canonical({'zh':d.get('evidence'),'en':d.get('en',{}).get('evidence')})).hexdigest()
            require(evidence_hash==baseline['evidence'][slug],prefix+'reviewed numerical evidence or conditions changed')
        registered={f.get('visual_index') for f in figures if f.get('publication_slug')==slug}
        require(registered==set(range(len(d.get('visuals',[])))),prefix+'unregistered or duplicated detail figures')
        expected_urls=['papers/'+slug+'.html','en/papers/'+slug+'.html']
        require(rec.get('legacy_urls')==expected_urls,prefix+'permanent URLs changed')
        if check_output:
            for url in expected_urls:require((root/url).is_file(),prefix+'missing output '+url)
        if release and not rec.get('publishable') and not approved_snapshot:errors.append(prefix+'release review not approved')
    require(len(ranks)==len(set(ranks)), 'Duplicate selectedRank')
    for f in figures:
        slug=f.get('publication_slug');prefix=f.get('id','unknown')+': '
        require(slug in ds,prefix+'unknown owner')
        try:
            v=ds[slug]['visuals'][f['visual_index']];src=v['src'];fp=(root/src).resolve()
            require(fp.is_relative_to((root/'assets/images/paper-figures').resolve()) and fp.is_file(),prefix+'invalid figure path')
            require(f['id']==slug+'#'+Path(src).stem.removeprefix(slug+'-'),prefix+'semantic figure ID/index mismatch')
            require(f.get('role') in ['framework','result','table','device'],prefix+'invalid role')
            require(str(f.get('sourceUrl','')).startswith('https://'),prefix+'missing source')
            rights=f.get('rights',{})
            require(rights.get('status') in ['verified','pending','not-reusable'],prefix+'invalid rights status')
            if rights.get('status')=='verified':require(bool(rights.get('evidence')),prefix+'verified rights without evidence')
            if rights.get('status')!='verified':
                warnings.append(prefix+'figure rights '+str(rights.get('status')))
                approved_legacy=(approved_snapshot and rights.get('status')=='pending' and src in baseline['images'] and slug in baseline['publications'])
                if (release and not approved_legacy) or slug not in baseline['publications']:errors.append(prefix+'image release gate blocked')
        except (IndexError,KeyError,TypeError):errors.append(prefix+'invalid visual index')
    for src,sha in baseline['images'].items():
        require((root/src).is_file() and hashlib.sha256((root/src).read_bytes()).hexdigest()==sha,'Baseline scientific pixels changed: '+src)
    areas=read(root,'data/research_areas.json')
    require({a['id'] for a in areas}=={s['id'] for s in mappings},'Area/mapping sets differ')
    for area in areas:
        section=next((s for s in mappings if s['id']==area['id']),{})
        require(set(area['papers'])=={p['slug'] for p in section.get('previews',[])},'Area paper/preview sets differ')
        require(all(slug in pubs for slug in area.get('related',[])),'Unknown related publication')
    for section in mappings:
        for x in section['gallery']:
            require(x.get('figureRef') in fs and fs[x['figureRef']]['publication_slug']==x['slug'],'Overview owner/ref mismatch')
        for x in section['previews']:
            require(1<=len(x.get('figureRefs',[]))<=2,'Preview must use one or two figures')
            for ref in x.get('figureRefs',[]):require(ref in fs and fs[ref]['publication_slug']==x['slug'],'Preview owner/ref mismatch: '+ref)
    return {'publication_records':len(papers),'figure_records':len(figures),'mode':'release' if release else 'candidate','owner_approved_snapshot':approved_snapshot,'errors':errors,'warnings':warnings}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=ROOT)
    parser.add_argument('--release',action='store_true')
    parser.add_argument('--check-output',action='store_true')
    parser.add_argument('--report',type=Path)
    args=parser.parse_args();result=validate(args.root,args.release,args.check_output)
    if args.report:args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='warnings'},ensure_ascii=False))
    raise SystemExit(bool(result['errors']))

if __name__=='__main__':main()
