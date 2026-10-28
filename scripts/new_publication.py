"""Create an ignored draft, never a public record or an invented scientific brief."""
import argparse
import datetime as dt
import json
import re
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def make_draft(doi=None,url=None,title=None,slug=None,existing=None):
    now=dt.datetime.now(dt.timezone.utc).isoformat()
    pub={};detail=None;sources=[]
    if existing:
        pubs=json.loads((ROOT/'data/publications.json').read_text(encoding='utf-8'))
        details=json.loads((ROOT/'data/publication_details.json').read_text(encoding='utf-8'))
        pub=next(p for p in pubs if p['slug']==existing)
        detail=next(d for d in details if d['slug']==existing)
        sources=[{'url':x,'retrieved_at':now,'basis':'Existing reviewed record; not a new online verification'} for x in pub['metadataSources']]
    elif doi:
        doi=re.sub(r'^https?://(?:dx\.)?doi.org/','',doi,flags=re.I).strip()
        if not re.fullmatch(r'10\.\d{4,9}/\S+',doi):raise ValueError('Invalid DOI')
        source='https://api.crossref.org/works/'+urllib.parse.quote(doi,safe='/')
        req=urllib.request.Request(source,headers={'User-Agent':'QiSun-publication-draft/3.5'})
        with urllib.request.urlopen(req,timeout=30) as response:data=json.load(response)['message']
        date_key=next((k for k in ['published-online','published','issued'] if data.get(k,{}).get('date-parts')),None)
        parts=data[date_key]['date-parts'][0] if date_key else []
        pub={'title':data.get('title',[''])[0], 'authors':[{'given':a.get('given',''),'family':a.get('family','')} for a in data.get('author',[])],
             'doi':data.get('DOI',doi),'kind':'conference' if data.get('type')=='proceedings-article' else 'journal' if data.get('type')=='journal-article' else None,
             'publication':data.get('container-title',[''])[0], 'venue':data.get('container-title',[''])[0], 'publisher':data.get('publisher',''),
             'year':parts[0] if parts else None,'date':'-'.join(str(v).zfill(4 if i==0 else 2) for i,v in enumerate(parts)) or None,
             'datePrecision':{1:'year',2:'month',3:'day'}.get(len(parts)), 'dateBasis':'Crossref_'+str(date_key),
             'volume':data.get('volume',''),'issue':data.get('issue',''),'pages':data.get('page',data.get('article-number','')),
             'metadataSources':[source], 'links':[{'label':'DOI','url':'https://doi.org/'+doi}]}
        sources=[{'url':source,'retrieved_at':now,'basis':'Official Crossref metadata; scientific conclusions not extracted'}]
    else:
        if not url or not url.startswith('https://'):raise ValueError('Provide a DOI, an existing slug, or an HTTPS official URL')
        pub={'title':title or '', 'metadataSources':[url], 'links':[{'label':'Paper','url':url}]}
        sources=[{'url':url,'retrieved_at':now,'basis':'User-provided official URL; metadata awaits manual review'}]
    pub={**{'slug':slug or existing or '', 'title':'','authors':[],'year':None,'kind':None,'area':None,'venue':'','publication':'','publisher':'',
            'date':None,'datePrecision':None,'dateBasis':'','selectedRank':None,'pages':'','citationKey':slug or existing or ''},**pub}
    if slug:pub['slug']=slug;pub['citationKey']=slug
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',pub['slug']):raise ValueError('A stable --slug is required')
    blank={key:'' for key in ['oneLine','coreClaim','problem','method','whyItMatters','discussion']}
    blank.update({key:[] for key in ['evidence','highlights','pipeline','visuals','keywords']})
    detail=detail or {'slug':pub['slug'],**blank,'en':dict(blank)}
    return {'schema_version':1,'publication':pub,'detail':detail,'review':{'state':'draft','metadata_verified':False,'content_reviewed':False,'rights_reviewed':False,'publishable':False,'author_order':pub['authors'],'evidence':[]},'features':{'selectedRank':None,'researchArea':None,'figureRefs':[],'highlight':{'zh':'','en':''}},'figures':[],'provenance':sources}

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--doi');p.add_argument('--url');p.add_argument('--title');p.add_argument('--slug');p.add_argument('--from-existing');p.add_argument('--draft',action='store_true',required=True)
    args=p.parse_args()
    try:draft=make_draft(args.doi,args.url,args.title,args.slug,args.from_existing)
    except (ValueError,KeyError,StopIteration,OSError) as exc:p.exit(1,'Draft creation failed: '+str(exc)+'\n')
    output=ROOT/'tmp/publication-drafts'/(draft['publication']['slug']+'.json');output.parent.mkdir(parents=True,exist_ok=True)
    if output.exists():p.exit(1,'Draft already exists; edit it or choose a new slug. Nothing was overwritten.\n')
    output.write_text(json.dumps(draft,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(output)

if __name__=='__main__':main()
