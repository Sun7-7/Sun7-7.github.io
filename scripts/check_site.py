"""Check generated links, metadata, bilingual structure, and public content.

Usage: python scripts/check_site.py --report-dir PATH
Reports contain finding categories and file locations, never sensitive matches.
"""
import argparse
import csv
import hashlib
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT=Path(__file__).resolve().parents[1]

class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.ids=[];self.images=[];self.headings=[];self.lang='';self.canonical=[];self.hreflang={};self.text=[];self.tag='';self.structured=[];self.pub=[];self.in_all=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);self.tag=tag
        if tag=='html':self.lang=a.get('lang','')
        if a.get('id'):self.ids.append(a['id'])
        if tag in ['a','link','script','img']:
            target=a.get('href') or a.get('src')
            if target:self.links.append(target)
        if tag=='img':self.images.append(a)
        if re.fullmatch(r'h[1-6]',tag):self.headings.append(tag)
        if tag=='link' and a.get('rel')=='canonical':self.canonical.append(a.get('href'))
        if tag=='link' and a.get('hreflang'):self.hreflang[a['hreflang']]=a.get('href')
        if a.get('data-publication'):self.pub.append(a['data-publication'])
    def handle_data(self,data):self.text.append(data)

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--report-dir',required=True);args=ap.parse_args()
    out=Path(args.report_dir);out.mkdir(parents=True,exist_ok=True)
    paths=sorted(p for p in ROOT.rglob('*.html') if not {'tmp','.git','node_modules'}.intersection(p.relative_to(ROOT).parts))
    pages={}
    for p in paths:
        page=Page();page.feed(p.read_text(encoding='utf-8'));pages[p.resolve()]=page
    checks=[];errors=[]
    for path,page in pages.items():
        name=path.relative_to(ROOT).as_posix()
        expected_lang='en' if name.startswith('en/') else 'zh-CN'
        if page.lang!=expected_lang:errors.append([name,'incorrect_lang'])
        if page.headings.count('h1')!=1:errors.append([name,'h1_count'])
        if len(page.ids)!=len(set(page.ids)):errors.append([name,'duplicate_id'])
        if page.canonical!=['https://sun7-7.github.io/'+name]:errors.append([name,'canonical'])
        if not all(x in page.hreflang for x in ['zh-CN','en','x-default']):errors.append([name,'hreflang'])
        for im in page.images:
            if not im.get('alt') or not im.get('width') or not im.get('height'):errors.append([name,'image_accessibility_or_dimensions'])
        for link in page.links:
            u=urlsplit(link)
            if u.scheme or u.netloc:continue
            target=(path.parent/unquote(u.path)).resolve() if u.path else path
            exists=target.exists()
            fragment_ok=not u.fragment or target not in pages or unquote(u.fragment) in pages[target].ids
            ok=exists and fragment_ok
            checks.append(dict(page=name,target=link,status='PASS' if ok else 'FAIL'))
            if not ok:errors.append([name,'broken_internal_link',link])
    with (out/'07_LINK_CHECK_REPORT.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['page','target','status']);w.writeheader();w.writerows(checks)
    bilingual=[]
    for p,page in pages.items():
        name=p.relative_to(ROOT).as_posix()
        if name.startswith('en/'):continue
        translated=pages[(ROOT/'en'/name).resolve()]
        equal=(page.pub==translated.pub and len(page.images)==len(translated.images) and page.headings==translated.headings)
        bilingual.append(dict(page=name,publication_order_equal=page.pub==translated.pub,image_count_equal=len(page.images)==len(translated.images),heading_structure_equal=page.headings==translated.headings,status='PASS' if equal else 'FAIL'))
        if not equal:errors.append([name,'bilingual_structure'])
    (out/'logs').mkdir(exist_ok=True)
    (out/'logs/bilingual_structure.json').write_text(json.dumps(bilingual,indent=2),encoding='utf-8')
    papers=json.loads((ROOT/'data/publications.json').read_text(encoding='utf-8'))
    expected_selected=[p['slug'] for p in sorted([p for p in papers if p.get('selectedRank')],key=lambda p:p['selectedRank'])]
    expected_all=[p['slug'] for p in sorted(papers,key=lambda p:p['date'].ljust(10,'0'),reverse=True)]
    assert len(papers)==11 and len(expected_selected)==6
    for lang in ['', 'en/']:
        assert pages[(ROOT/lang/'index.html').resolve()].pub==expected_selected
        assert pages[(ROOT/lang/'publications.html').resolve()].pub==expected_selected+expected_all
    assert len(next(p for p in papers if p['slug']=='variable-k-ldmos')['authors'])==6
    assert next(p for p in papers if p['slug']=='mpo-surrogate-function-snn')['kind']=='conference'
    for page in pages.values():
        content=' '.join(page.text)
        assert not any(a['family']+', '+a['given'] in content for p in papers for a in p['authors'])
    try:
        tracked=subprocess.check_output(['git','ls-files'],cwd=ROOT,stderr=subprocess.DEVNULL).decode('utf-8').splitlines()
    except (subprocess.CalledProcessError,FileNotFoundError):
        # The review packet is also a runnable source snapshot without .git.
        tracked=[]
    all_files={ROOT/name for name in tracked if (ROOT/name).is_file()}
    all_files.update(p for p in ROOT.rglob('*') if p.is_file() and not {'.git','tmp','node_modules','test-results'}.intersection(p.relative_to(ROOT).parts))
    # Category patterns only; do not embed actual private strings in this checker.
    rules={'phone_number':r'(?<![\w\d])(?:\+86[- ]?)?1[3-9]\d{9}(?!\d)',
           'private_email_domain':r'[\w.+-]+@(?:qq\.com|163\.com|126\.com|gmail\.com)',
           'private_resume_filename':r'(?:求职|个人简历|resume).*\.(?:pdf|docx?)',
           'unconfirmed_doctoral_start':r'(?:Ph\.?D\.?|博士)[^\n<]{0,60}(?:2023[-./]09|2024[-./]09)',
           'disallowed_public_section':r'<h[1-6][^>]*>\s*(?:Projects|Teaching|Academic Service|Leadership|Competition|科研项目|教学经历|学生工作|竞赛)\s*</h[1-6]>'}
    findings=[];manifest=[]
    for p in sorted(all_files):
        name=p.relative_to(ROOT).as_posix();manifest.append(dict(path=name,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
        if p.suffix.lower() in ['.html','.json','.js','.cjs','.mjs','.css','.svg','.xml','.txt','.md','.sh','.ps1','.bib','.py']:
            content=p.read_text(encoding='utf-8-sig',errors='replace')
            if name=='scripts/check_site.py':continue
            for category,pattern in rules.items():
                for match in re.finditer(pattern,content,re.I):
                    findings.append(dict(file=name,category=category,line=content[:match.start()].count('\n')+1))
        elif p.suffix.lower() in ['.doc','.docx','.pdf','.map']:
            findings.append(dict(file=name,category='binary_document_requires_review',line=0))
    (out/'logs/public_content_scan.json').write_text(json.dumps(dict(files_scanned=len(manifest),rules=list(rules),findings=findings,matched_text_logged=False),indent=2),encoding='utf-8')
    (out/'logs/public_file_manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    summary=dict(html_pages=len(pages),internal_links=len(checks),bilingual_pairs=len(bilingual),publication_records=len(papers),errors=errors,privacy_findings=findings)
    (out/'logs/static_checks.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
    if errors or findings:raise SystemExit(1)

if __name__=='__main__':main()
