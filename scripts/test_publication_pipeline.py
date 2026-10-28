"""Exercise actual draft gates and an existing-paper migration in a disposable copy."""
import copy
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
import jsonschema
from validate_publications import ROOT,validate
from promote_publication import promote
from new_publication import make_draft

def read(path):return json.loads(path.read_text(encoding='utf-8'))
def write(path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def snapshot(root):return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in (root/'data').glob('*.json')}

def main():
    out=ROOT/'tmp/v35/logs';out.mkdir(parents=True,exist_ok=True);report={'schema_checks':[],'negative_checks':[]}
    for schema_name,data_name in [('publication','publications'),('detail','publication_details'),('figure','figures')]:
        schema=read(ROOT/f'schemas/{schema_name}.schema.json');jsonschema.Draft202012Validator.check_schema(schema)
        for record in read(ROOT/f'data/{data_name}.json'):jsonschema.validate(record,schema)
        report['schema_checks'].append({'schema':schema_name,'records':len(read(ROOT/f'data/{data_name}.json'))})
    jsonschema.validate(read(ROOT/'examples/new_publication.blank.json'),read(ROOT/'schemas/draft.schema.json'))
    real_before=snapshot(ROOT)
    with tempfile.TemporaryDirectory(prefix='qisun-v35-pipeline-') as temp:
        sandbox=Path(temp)/'site'
        shutil.copytree(ROOT,sandbox,ignore=shutil.ignore_patterns('.git','node_modules','tmp','__pycache__'))
        originals={p.name:read(p) for p in (sandbox/'data').glob('*.json')}
        def reset():
            for name,value in originals.items():write(sandbox/'data'/name,value)
        cases=[
            ('author_order','publications.json',lambda d:d[0]['authors'].reverse()),
            ('journal_ccf','publications.json',lambda d:d[0].update(ccf='A')),
            ('invalid_date','publications.json',lambda d:d[0].update(date='2026-02-30')),
            ('duplicate_doi','publications.json',lambda d:d[1].update(doi=d[0]['doi'])),
            ('evidence_changed','publication_details.json',lambda d:d[0]['evidence'][0].update(value='changed')),
            ('missing_english','publication_details.json',lambda d:d[0]['en'].pop('method')),
            ('missing_source','publications.json',lambda d:d[0].update(metadataSources=[])),
            ('wrong_figure_owner','research_visuals.json',lambda d:d['sections'][0]['previews'][0]['figureRefs'].append('variable-k-ldmos#device-structure')),
            ('unproven_verified_rights','figures.json',lambda d:d[0]['rights'].update(status='verified',evidence=[])),
            ('legacy_url','publication_workflow.json',lambda d:next(iter(d['records'].values())).update(legacy_urls=['renamed.html'])),
            ('new_unreviewed_record','publication_workflow.json',lambda d:next(iter(d['records'].values())).update(state='publishable')),
        ]
        for name,file,mutation in cases:
            reset();data=read(sandbox/'data'/file);mutation(data);write(sandbox/'data'/file,data);result=validate(sandbox)
            assert result['errors'],name;report['negative_checks'].append({'name':name,'blocked':True,'errors':result['errors']})
        reset();image=sandbox/next(iter(read(sandbox/'data/publication_integrity.json')['images']));before=image.read_bytes();image.write_bytes(before+b'changed');assert validate(sandbox)['errors'];image.write_bytes(before);report['negative_checks'].append({'name':'scientific_pixels','blocked':True})
        reset()
        draft=make_draft(existing='variable-k-ldmos');jsonschema.validate(draft,read(ROOT/'schemas/draft.schema.json'))
        draft_copy=Path(temp)/'draft.json';write(draft_copy,draft)
        before_import=snapshot(sandbox)
        try:promote(draft_copy,sandbox)
        except ValueError as exc:report['unreviewed_draft']={'blocked':True,'reason':str(exc)}
        else:raise AssertionError('Unreviewed draft was imported')
        assert snapshot(sandbox)==before_import
        # Existing, non-featured paper; simulate metadata/text-only reintroduction.
        # No image permission is synthesized, and this copy never leaves the temporary directory.
        slug='variable-k-ldmos'
        for name in ['publications.json','publication_details.json']:
            write(sandbox/'data'/name,[p for p in read(sandbox/'data'/name) if p['slug']!=slug])
        workflow=read(sandbox/'data/publication_workflow.json');workflow['records'].pop(slug);write(sandbox/'data/publication_workflow.json',workflow)
        write(sandbox/'data/figures.json',[f for f in read(sandbox/'data/figures.json') if f['publication_slug']!=slug])
        mapping=read(sandbox/'data/research_visuals.json')
        for section in mapping['sections']:section['previews']=[p for p in section['previews'] if p['slug']!=slug]
        write(sandbox/'data/research_visuals.json',mapping)
        areas=read(sandbox/'data/research_areas.json')
        for area in areas:area['papers']=[p for p in area['papers'] if p!=slug]
        write(sandbox/'data/research_areas.json',areas)
        stages=['draft','metadata_verified','content_reviewed','rights_reviewed','publishable']
        draft['detail']['visuals']=[];draft['detail']['en']['visuals']=[]
        draft['review'].update(state='publishable',metadata_verified=True,content_reviewed=True,rights_reviewed=True,publishable=True,
            evidence=[{'url':draft['publication']['metadataSources'][0],'scope':'Disposable migration of already-reviewed text/metadata. No figures used; no new image authorization.'}])
        write(draft_copy,draft);result=promote(draft_copy,sandbox);assert not validate(sandbox)['errors']
        built=subprocess.run([sys.executable,'scripts/build_site.py'],cwd=sandbox,capture_output=True,text=True);assert built.returncode==0,built.stderr+built.stdout
        assert len(read(sandbox/'data/publications.json'))==11
        for relative in ['papers/'+slug+'.html','en/papers/'+slug+'.html','assets/citations/'+slug+'.bib','publications.html','en/publications.html','sitemap.xml']:
            assert (sandbox/relative).is_file(),relative
            if relative.endswith(('publications.html','sitemap.xml')):assert slug in (sandbox/relative).read_text(encoding='utf-8')
        report['existing_migration']={'slug':slug,'stages':stages,'publication_count':11,'duplicate_slugs':0,'bilingual_details':True,'bibtex':True,'sitemap':True,'features':draft['features'],'figure_rights_scope':'No images in this simulated imported record; pending images never marked verified.','result':result,'build_stdout':built.stdout}
    assert real_before==snapshot(ROOT),'Real data changed during simulation'
    release=validate(ROOT,release=True);assert release['errors'];report['release_gate']={'blocked':True,'reasons':release['errors']}
    report['real_publications_unchanged_by_tests']=True
    write(out/'pipeline_tests.json',report)
    print(json.dumps({'schemas':report['schema_checks'],'negative_cases':len(report['negative_checks']),'existing_migration':'passed','real_data_unchanged':True,'release_gate':'blocked as expected'}))

if __name__=='__main__':main()
