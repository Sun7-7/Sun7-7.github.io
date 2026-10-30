from pathlib import Path
import json,copy,subprocess,tempfile,shutil,sys
sys.path.insert(0,'scripts');from validate_publications import validate,ROOT
out=Path('tmp/v39/logs');out.mkdir(parents=True,exist_ok=True);ds=json.loads(Path('data/publication_details.json').read_text(encoding='utf-8'))
assert len(ds)==11

# Validate the actual schema as well as cross-reference rules.
import jsonschema
for name,data in [('detail',ds),('figure',json.loads(Path('data/figures.json').read_text(encoding='utf-8')))]:
 sc=json.loads(Path('schemas/'+name+'.schema.json').read_text(encoding='utf-8'))
 for record in data:jsonschema.validate(record,sc)
results=[]
with tempfile.TemporaryDirectory(dir='tmp',prefix='v39-contract-') as t:
 site=Path(t)/'site';shutil.copytree('.',site,ignore=shutil.ignore_patterns('.git','tmp','node_modules','__pycache__'))
 p=site/'data/publication_details.json'
 for case in ['missing_en','bad_ref','bad_status']:
  v=copy.deepcopy(ds)
  if case=='missing_en':v[0]['focusBrief']['en'].pop('finding')
  if case=='bad_ref':v[0]['focusBrief']['zh']['finding']['evidenceRef']['field']='evidence.999'
  if case=='bad_status':v[0]['focusBrief']['zh']['finding']['reviewStatus']='approved'
  p.write_text(json.dumps(v,ensure_ascii=False),encoding='utf-8');assert validate(site)['errors'];results.append({'case':case,'rejected':True})
 p.write_text(json.dumps(ds,ensure_ascii=False),encoding='utf-8')
 figs=json.loads((site/'data/figures.json').read_text(encoding='utf-8'));f=copy.deepcopy(figs);f[0]['publication_slug']='wrong';(site/'data/figures.json').write_text(json.dumps(f),encoding='utf-8');assert validate(site)['errors'];results.append({'case':'wrong_owner','rejected':True});(site/'data/figures.json').write_text(json.dumps(figs),encoding='utf-8')
 # Existing paper, exact existing sentence: safe source excerpt propagation.
 d=next(d for d in ds if d['slug'].startswith('mte-ste'));slug=d['slug']
 for lang in ['zh','en']:
  ob=d if lang=='zh' else d['en'];d['focusBrief'][lang]['finding']['text']=ob['coreClaim'].split(';')[0] if lang=='en' else ob['coreClaim'].split('；')[0]
 p.write_text(json.dumps(ds,ensure_ascii=False),encoding='utf-8')
 ed=json.loads((site/'data/publication_editorial.json').read_text(encoding='utf-8'))
 for lang in ['zh','en']:ed[slug][lang]=d['focusBrief'][lang]['finding']['text']
 (site/'data/publication_editorial.json').write_text(json.dumps(ed,ensure_ascii=False),encoding='utf-8')
 run=subprocess.run([sys.executable,'scripts/build_site.py'],cwd=site,capture_output=True,text=True);assert run.returncode==0,run.stdout+run.stderr
 outputs=[]
 for lang in ['zh','en']:
  prefix='' if lang=='zh' else 'en/';text=d['focusBrief'][lang]['finding']['text']
  for file in ['index.html','research.html','papers/'+slug+'.html']:
   assert text in (site/(prefix+file)).read_text(encoding='utf-8');outputs.append(prefix+file)
(out/'pipeline_positive.json').write_text(json.dumps({'existing_paper':slug,'outputs':outputs,'fixture_only':True},indent=2),encoding='utf-8');(out/'pipeline_negative.json').write_text(json.dumps(results,indent=2),encoding='utf-8');(out/'schema_validation.json').write_text(json.dumps({'details':11,'figures':33,'passed':True}),encoding='utf-8');print('Schema, 4 negative cases, 6 propagated outputs passed')
