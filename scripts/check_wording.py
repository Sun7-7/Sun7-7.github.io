"""Check V3.3 bilingual terminology in templates and generated pages."""
import argparse
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OLD=['\u5df2\u53d1\u8868\u8bc1\u636e','Published'+' evidence','\u5b66\u672f\u7b80\u4ecb','Academic'+' Biography']

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--report-dir',required=True);args=parser.parse_args()
    paths=[ROOT/'scripts/build_editorial.py']+[p for p in ROOT.rglob('*.html') if not {'tmp','node_modules','.git'}.intersection(p.relative_to(ROOT).parts)]
    failures=[]
    for path in paths:
        content=path.read_text(encoding='utf-8')
        if any(term in content for term in OLD):failures.append(path.relative_to(ROOT).as_posix())
    checks=[]
    for prefix,heading,title in [('', '已发表论文','个人简介'),('en/','Published Papers','Biography')]:
        research=(ROOT/prefix/'research.html').read_text(encoding='utf-8')
        about=(ROOT/prefix/'about.html').read_text(encoding='utf-8')
        assert research.count('>'+heading+'</h3>')==3
        assert re.search(r'<h1>(.*?)</h1>',about).group(1)==title
        checks.append(dict(language='zh' if not prefix else 'en',research_heading=heading,research_sections=3,about_h1=title))
    output=Path(args.report_dir)/'logs';output.mkdir(parents=True,exist_ok=True)
    (output/'terminology_checks.json').write_text(json.dumps(dict(files_checked=len(paths),failures=failures,checks=checks),ensure_ascii=False,indent=2),encoding='utf-8')
    assert not failures,failures
    print('PASS: V3.3 terms in renderer and 44 pages; three Research headings and About H1 correct in both languages.')

if __name__=='__main__':main()
