"""Explicitly import a reviewed draft, transactionally. Does not deploy or copy PDFs."""
import argparse
import copy
import json
import shutil
import tempfile
from pathlib import Path
from validate_publications import ROOT, validate

def promote(draft_path,root=ROOT):
    root=Path(root);draft=json.loads(Path(draft_path).read_text(encoding='utf-8'));review=draft['review'];pub=copy.deepcopy(draft['publication']);detail=draft['detail'];features=draft['features'];slug=pub['slug']
    if not all(review.get(x) is True for x in ['metadata_verified','content_reviewed','rights_reviewed','publishable']) or review.get('state')!='publishable' or not review.get('evidence'):
        raise ValueError('Review stages and explicit source/review evidence must be complete before import')
    if review.get('author_order')!=pub['authors']:raise ValueError('Author order does not match the reviewed record')
    pubs=json.loads((root/'data/publications.json').read_text(encoding='utf-8'))
    if any(p['slug']==slug or (pub.get('doi') and p.get('doi','').lower()==pub['doi'].lower()) for p in pubs):raise ValueError('Duplicate slug or DOI; no public files changed')
    pub['selectedRank']=features.get('selectedRank')
    if detail.get('slug')!=slug:raise ValueError('Detail slug mismatch')
    if pub['selectedRank'] is not None and (not detail.get('visuals') or not all(features.get('highlight',{}).get(lang) for lang in ['zh','en'])):raise ValueError('Featured work requires a reviewed image and bilingual highlight')
    with tempfile.TemporaryDirectory(prefix='qisun-publication-review-') as tmp:
        test=Path(tmp);shutil.copytree(root/'data',test/'data');shutil.copytree(root/'assets/images/paper-figures',test/'assets/images/paper-figures')
        changed={}
        def load(name):return json.loads((test/name).read_text(encoding='utf-8'))
        def save(name,value):changed[name]=value;(test/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        save('data/publications.json',pubs+[pub]);save('data/publication_details.json',load('data/publication_details.json')+[detail])
        workflow=load('data/publication_workflow.json');workflow['records'][slug]={**review,'legacy_urls':['papers/'+slug+'.html','en/papers/'+slug+'.html']};save('data/publication_workflow.json',workflow)
        figures=load('data/figures.json')+draft.get('figures',[])
        for f in figures:
            if f['publication_slug']==slug and (f['rights']['status']!='verified' or not f['rights'].get('evidence')):raise ValueError('New/reintroduced images require verified rights evidence')
        # A nonempty visual list must have matching reviewed figure registrations.
        if {f['visual_index'] for f in figures if f['publication_slug']==slug}!=set(range(len(detail.get('visuals',[])))):raise ValueError('Unregistered or unreviewed images')
        save('data/figures.json',figures)
        if features.get('researchArea'):
            if not features.get('figureRefs'):raise ValueError('Research preview requires reviewed figure IDs')
            mapping=load('data/research_visuals.json');section=next(s for s in mapping['sections'] if s['id']==features['researchArea']);section['previews'].append({'slug':slug,'figureRefs':features['figureRefs']});save('data/research_visuals.json',mapping)
            areas=load('data/research_areas.json');next(a for a in areas if a['id']==features['researchArea'])['papers'].append(slug);save('data/research_areas.json',areas)
        if pub['selectedRank'] is not None:
            editorial=load('data/publication_editorial.json');editorial[slug]={**features['highlight'],'sources':pub['metadataSources']};save('data/publication_editorial.json',editorial)
        result=validate(test)
        if result['errors']:raise ValueError('; '.join(result['errors']))
        backups={name:(root/name).read_bytes() for name in changed}
        try:
            for name in changed:shutil.copyfile(test/name,root/name)
        except OSError:
            for name,content in backups.items():(root/name).write_bytes(content)
            raise
    return {'slug':slug,'files_updated':list(changed),'deployed':False}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--draft',type=Path,required=True);p.add_argument('--root',type=Path,default=ROOT);args=p.parse_args()
    try:print(json.dumps(promote(args.draft,args.root),ensure_ascii=False))
    except (ValueError,KeyError,StopIteration,OSError) as exc:p.exit(1,'Import blocked: '+str(exc)+'\n')

if __name__=='__main__':main()
