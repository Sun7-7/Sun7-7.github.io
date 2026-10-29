"""Validate V3.6 data-to-card output and reject malformed editorial mappings."""
import copy
import json
import shutil
import tempfile
from pathlib import Path
from html.parser import HTMLParser
from validate_publications import ROOT, validate

class Cards(HTMLParser):
    def __init__(self):
        super().__init__(); self.slugs=[]; self.refs=[]; self.ids=[]; self.templates=0
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if a.get('data-publication'): self.slugs.append(a['data-publication'])
        if a.get('data-figure-ref'): self.refs.append(a['data-figure-ref'])
        if a.get('id'): self.ids.append(a['id'])
        if tag=='template': self.templates+=1

def main():
    def read(name): return json.loads((ROOT/name).read_text(encoding='utf-8'))
    mappings=read('data/research_visuals.json')['sections']
    expected=[p['slug'] for s in mappings for p in s['previews']]
    refs=[ref for s in mappings for p in s['previews'] for ref in p['figureRefs']]
    result=validate(ROOT,check_output=True); assert not result['errors'],result
    output=[]
    for lang in ['', 'en/']:
        parser=Cards(); parser.feed((ROOT/(lang+'research.html')).read_text(encoding='utf-8'))
        assert parser.slugs==expected and parser.refs==refs
        assert len(parser.ids)==len(set(parser.ids)) and parser.templates==0
        output.append({'language':lang or 'zh','cards':len(parser.slugs),'figure_refs':len(parser.refs),'real_dom_content':True})
    cases=[
        ('unpaired_short_title','publication_details.json',lambda d:d[0].pop('shortTitle_en')),
        ('empty_contribution','publication_details.json',lambda d:d[0].update(oneLineContribution_en='')),
        ('duplicate_figure','research_visuals.json',lambda d:d['sections'][0]['previews'][0].update(figureRefs=[d['sections'][0]['previews'][0]['figureRefs'][0]]*2)),
        ('reordered_mapping','research_visuals.json',lambda d:d['sections'][0]['previews'].reverse()),
        ('wrong_owner','research_visuals.json',lambda d:d['sections'][0]['previews'][0].update(figureRefs=[d['sections'][2]['previews'][0]['figureRefs'][0]])),
    ]
    negative=[]
    with tempfile.TemporaryDirectory(prefix='qisun-v36-data-') as temp:
        sandbox=Path(temp);shutil.copytree(ROOT/'data',sandbox/'data');shutil.copytree(ROOT/'assets',sandbox/'assets')
        for name,file,mutation in cases:
            original=read('data/'+file); altered=copy.deepcopy(original); mutation(altered)
            target=sandbox/'data'/file; target.write_text(json.dumps(altered,ensure_ascii=False),encoding='utf-8')
            errors=validate(sandbox)['errors']; assert errors,name
            negative.append({'case':name,'blocked':True,'errors':errors})
            target.write_text(json.dumps(original,ensure_ascii=False),encoding='utf-8')
    report={'output':output,'group_sizes':[len(s['previews']) for s in mappings],'negative_cases':negative,'release_authorized':validate(ROOT,release=True)['owner_approved_snapshot']}
    out=ROOT/'tmp/v36/logs/research_data_checks.json';out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'groups':report['group_sizes'],'cards':len(expected),'negative_cases':len(negative),'release_authorized':report['release_authorized']}))

if __name__=='__main__': main()
