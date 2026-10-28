"""Dependency-free bilingual editorial renderer; invoked by build_site.py."""
from __future__ import annotations
import hashlib
import html
import json
import posixpath
import struct
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parents[1]
def load(name): return json.loads((ROOT/name).read_text(encoding='utf-8'))
CONFIG=load('config.json'); PROFILE=load('data/profile.json')
PAPERS=sorted(load('data/publications.json'),key=lambda p:p['date'].ljust(10,'0'),reverse=True)
DETAILS={p['slug']:p for p in load('data/publication_details.json')}
BY_SLUG={p['slug']:p for p in PAPERS}
SELECTED=sorted((p for p in PAPERS if p.get('selectedRank')),key=lambda p:p['selectedRank'])
GENERATED=[]
VISUALS={s['id']:s for s in load('data/research_visuals.json')['sections']}
PORTRAIT_VERSION=hashlib.sha256((ROOT/'assets/images/portraits/portrait_hero_4x5.webp').read_bytes()).hexdigest()[:12]

UI={
 'zh':dict(home='首页',research='研究',publications='论文',about='关于',cv='学术 CV',notes='研究笔记',menu='菜单',dark='深色',skip='跳转到正文',all='全部',conference='会议',journal='期刊',learning='学习机制',signals='信号处理',device='器件',selected='代表性论文',allPapers='全部论文',brief='论文导读',question='研究问题',method='方法',evidence='证据',conclusion='结论与边界',route='技术路线',source='图源',citation='引用',empty='暂无符合条件的论文。',print='打印 / 保存 PDF'),
 'en':dict(home='Home',research='Research',publications='Publications',about='About',cv='CV',notes='Notes',menu='Menu',dark='Dark',skip='Skip to content',all='All',conference='Conference',journal='Journal',learning='Learning',signals='Signals',device='Devices',selected='Selected Publications',allPapers='All Publications',brief='Paper brief',question='Research question',method='Method',evidence='Evidence',conclusion='Takeaway & limitations',route='Technical route',source='Source',citation='Citation',empty='No publications match these filters.',print='Print / save PDF')}

def esc(s):return html.escape(str(s),quote=True)
def t(lang,zh,en):return zh if lang=='zh' else en
def rel(path,target):return posixpath.relpath(target,posixpath.dirname(path) or '.')
def route(lang,filename):return ('en/' if lang=='en' else '')+filename
def detail(slug,lang):
 d=DETAILS[slug];return {**{k:v for k,v in d.items() if k!='en'},**(d.get('en',{}) if lang=='en' else {})}

AREAS=load('data/research_areas.json')
EDITORIAL=load('data/publication_editorial.json')
FIGURES={f['id']:f for f in load('data/figures.json')}

def figure_src(ref):
 f=FIGURES[ref];return DETAILS[f['publication_slug']]['visuals'][f['visual_index']]['src']

def atext(area,key,lang):return area[key][0 if lang=='zh' else 1]

def authors(pub):
 names=[]
 for a in pub['authors']:
  full=a['given']+' '+a['family'];names.append('<strong>'+esc(full)+'</strong>' if full=='Qi Sun' else esc(full))
 return (', '.join(names[:-1])+', and '+names[-1]) if len(names)>2 else ' and '.join(names)

def image(src,alt,path,lazy=True,extra=''):
 data=(ROOT/src).read_bytes()
 width,height=struct.unpack('>II',data[16:24]) if src.endswith('.png') else ((720,900) if 'hero' in src else (680,1020))
 loading=' loading="lazy" decoding="async"' if lazy else ' fetchpriority="high"'
 url=rel(path,src)+('?v='+PORTRAIT_VERSION if '/portraits/' in src else '')
 return f'<img src="{esc(url)}" alt="{esc(alt)}" width="{width}" height="{height}"{loading} {extra}>'

def venue(pub):
 label=pub['venue'] if str(pub['year']) in pub['venue'] else pub['venue']+' · '+str(pub['year'])
 parts=[label]
 if pub['kind']=='conference' and pub.get('ccf'):parts.append('CCF-'+pub['ccf'])
 if pub.get('oral'):parts.append('Oral')
 return '<span class="venue">'+esc(' · '.join(parts))+'</span>'

def links(pub,lang,path,brief=True):
 items=[]
 if brief:items.append(f'<a href="{esc(rel(path,route(lang,"papers/"+pub["slug"]+".html")))}">{UI[lang]["brief"]}</a>')
 items += [f'<a href="{esc(x["url"])}" target="_blank" rel="noopener noreferrer">{esc(x["label"])}</a>' for x in pub['links']]
 items.append(f'<a href="{esc(rel(path,"assets/citations/"+pub["slug"]+".bib"))}" download>BibTeX</a>')
 return '<div class="paper-links">'+'\n'.join(items)+'</div>'

def row(pub,lang,path,selected=False):
 d=detail(pub['slug'],lang);v=d['visuals'][0];thumb=''
 if selected:thumb=f'<a class="publication-thumb" href="{esc(rel(path,route(lang,"papers/"+pub["slug"]+".html")))}" tabindex="-1" aria-hidden="true">{image(v["src"],v["title"],path)}</a>'
 return f'''<article class="publication-row{' selected-row' if selected else ''}" data-publication="{pub['slug']}" data-kind="{pub['kind']}" data-area="{pub['area']}">{thumb}<div class="publication-copy"><div class="publication-meta">{venue(pub)}</div><h3><a href="{esc(rel(path,route(lang,'papers/'+pub['slug']+'.html')))}">{esc(pub['title'])}</a></h3><p class="authors">{authors(pub)}.</p><p class="publication-summary">{esc(d['oneLine'])}</p>{links(pub,lang,path)}</div></article>'''

def header(path,lang,page):
 u=UI[lang];items=[]
 for key,file in [('home','index.html'),('research','research.html'),('publications','publications.html'),('about','about.html'),('cv','cv.html')]:
  active=' aria-current="page"' if key==page else '';items.append(f'<a href="{esc(rel(path,route(lang,file)))}"{active}>{u[key]}</a>')
 other=path.removeprefix('en/') if lang=='en' else 'en/'+path
 return f'''<a class="skip-link" href="#main">{u['skip']}</a><header class="site-header"><div class="container nav-bar"><a class="wordmark" href="{esc(rel(path,route(lang,'index.html')))}">{t(lang,"孙琦","Qi Sun")} <span lang="{t(lang,"en","zh-CN")}">/ {t(lang,"Qi Sun","孙琦")}</span></a><div class="nav-controls"><button class="menu-toggle" type="button" aria-controls="primary-navigation" aria-expanded="false">{u['menu']}</button><nav id="primary-navigation" class="primary-navigation" aria-label="{t(lang,'主导航','Main navigation')}">{''.join(items)}</nav><a class="language-switch" href="{esc(rel(path,other))}" lang="{'en' if lang=='zh' else 'zh-CN'}" hreflang="{'en' if lang=='zh' else 'zh-CN'}" aria-label="{t(lang,'EN — Switch to English','中 — 切换为中文')}">{'EN' if lang=='zh' else '中'}</a><button class="theme-toggle" type="button" aria-pressed="false" aria-label="{t(lang,'切换深色主题','Switch to dark theme')}">{u['dark']}</button></div></div></header>'''

def footer(path,lang):
 return f'''<footer class="site-footer"><div class="container footer-inner"><p>© 2026 {esc(display_name(lang))}<br>{esc(PROFILE['institution_zh' if lang=='zh' else 'institution_en'])}</p><div class="footer-links"><a href="mailto:{PROFILE['email']}">Email</a>{profile_links()}<a href="{esc(rel(path,route(lang,'blog.html')))}">{UI[lang]['notes']}</a></div></div></footer>'''

def document(path,lang,page,title,description,body,profile=False):
 base=CONFIG['site']['url'];canonical=base+'/'+path;zh=path.removeprefix('en/');en='en/'+zh
 schema={'@context':'https://schema.org','@type':'ProfilePage' if profile else 'WebPage','url':canonical,'name':title,'inLanguage':'zh-CN' if lang=='zh' else 'en'}
 if profile:schema['mainEntity']={'@type':'Person','name':'Qi Sun','alternateName':'孙琦','url':base+'/en/index.html','image':base+'/assets/images/portraits/portrait_hero_4x5.webp?v='+PORTRAIT_VERSION,'jobTitle':PROFILE['stage_en'],'affiliation':{'@type':'CollegeOrUniversity','name':'Xidian University'},'email':'mailto:'+PROFILE['email'],'sameAs':[p['url'] for p in PROFILE['academicProfiles']]}
 structured=json.dumps(schema,ensure_ascii=False).replace('<','\\u003c')
 output=f'''<!DOCTYPE html>
<html lang="{'zh-CN' if lang=='zh' else 'en'}" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{esc(title)}</title><meta name="description" content="{esc(description)}"><link rel="canonical" href="{canonical}"><link rel="alternate" hreflang="zh-CN" href="{base}/{zh}"><link rel="alternate" hreflang="en" href="{base}/{en}"><link rel="alternate" hreflang="x-default" href="{base}/{en}"><meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{base}/assets/images/portraits/portrait_hero_4x5.webp?v={PORTRAIT_VERSION}"><meta property="og:image:alt" content="Qi Sun professional portrait"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="{esc(title)}"><meta name="twitter:description" content="{esc(description)}"><meta name="twitter:image" content="{base}/assets/images/portraits/portrait_hero_4x5.webp?v={PORTRAIT_VERSION}"><meta name="color-scheme" content="light dark"><link rel="icon" href="{esc(rel(path,'assets/favicon.svg'))}" type="image/svg+xml"><script src="{esc(rel(path,'js/theme-init.js'))}"></script><link rel="stylesheet" href="{esc(rel(path,'css/style.css'))}"><script type="application/ld+json">{structured}</script></head><body data-page="{page}" data-lang="{lang}">{header(path,lang,page)}<main id="main" class="container" tabindex="-1">{body}</main>{footer(path,lang)}<script src="{esc(rel(path,'js/main.js'))}" defer></script></body></html>'''
 (ROOT/path).parent.mkdir(parents=True,exist_ok=True);(ROOT/path).write_text(output+'\n',encoding='utf-8');GENERATED.append(path)

def intro(eyebrow,title,description=''):
 return f'<div class="page-intro"><p class="eyebrow">{esc(eyebrow)}</p><h1>{esc(title)}</h1>'+ (f'<p class="lead">{esc(description)}</p>' if description else '')+'</div>'

def area_cards(lang,path):
 items=[]
 for i,a in enumerate(AREAS,1):
  p=BY_SLUG[a['papers'][0]]
  label=p['venue'] if str(p['year']) in p['venue'] else p['venue']+' '+str(p['year'])
  items.append(f'<article class="area-summary"><h3><a href="research.html#{a["id"]}">{esc(atext(a,"names",lang))}</a></h3><p>{esc(atext(a,"short",lang))}</p><a class="text-link" href="papers/{p["slug"]}.html">{esc(label)}</a></article>')
 return '<div class="area-grid">'+''.join(items)+'</div>'


def profile_links():
 return ''.join(f'<a href="{esc(p["url"])}" target="_blank" rel="noopener noreferrer">{esc(p["label"])}</a>' for p in PROFILE['academicProfiles'])

def display_name(lang):
 return '孙琦 / Qi Sun' if lang=='zh' else 'Qi Sun / 孙琦'

def publication_reference(pub):
 volume=(', '+pub['volume']) if pub.get('volume') else ''
 issue=('('+pub['issue']+')') if pub.get('issue') else ''
 return pub['publication']+volume+issue+', '+pub['pages']+' ('+str(pub['year'])+')'

def figure_credit(pub,lang):
 # Preserve the existing copyright holder and manuscript provenance; do not infer permission.
 credit=pub['figureCredit']
 if credit.startswith('Author-supplied'):
  rights=t(lang,'图取自作者提供的接收稿。','Figures from the author-supplied accepted manuscript.')
 elif credit.startswith('©'):
  rights=credit.split('Source:',1)[0].strip()
  if lang=='zh':rights=rights.replace('the authors.','作者。').replace('IEEE.','IEEE。')
 elif 'existing publication archive' in credit:
  rights=t(lang,'图取自作者既有论文资料。','Figures from the author’s existing publication archive.')
 else:rights=''
 label=t(lang,'图源：','Source: ');separator=t(lang,'。','.')
 return f'<p class="figure-credit">{label}<a href="{esc(pub["links"][0]["url"])}">{esc(publication_reference(pub))}</a>{separator} <span>{esc(rights)}</span></p>'

def bibliography_row(pub,lang,path,heading='h4'):
 extra=[]
 if pub['kind']=='conference' and pub.get('ccf'):extra.append('CCF-'+pub['ccf'])
 if pub.get('oral'):extra.append('Oral')
 annotation=(' · '+' · '.join('<span class="publication-label">'+esc(x)+'</span>' for x in extra)) if extra else ''
 primary=pub['links'][0]
 return f'''<article class="bibliography-entry" data-publication="{pub['slug']}" data-kind="{pub['kind']}" data-area="{pub['area']}"><p class="authors">{authors(pub)}.</p><{heading}><a href="{esc(rel(path,route(lang,'papers/'+pub['slug']+'.html')))}">{esc(pub['title'])}</a></{heading}><p class="bibliography-record">{esc(publication_reference(pub))}{annotation}.</p><div class="bibliography-links"><a href="{esc(primary['url'])}" target="_blank" rel="noopener noreferrer">{esc(primary['label'])}</a><a href="{esc(rel(path,'assets/citations/'+pub['slug']+'.bib'))}" download>BibTeX</a></div></article>'''

def bibliography_years(lang,path):
 groups=[]
 for year in sorted({p['year'] for p in PAPERS},reverse=True):
  group=''.join(bibliography_row(p,lang,path) for p in PAPERS if p['year']==year)
  groups.append(f'<section class="publication-year" data-year-group="{year}" aria-labelledby="year-{year}"><h3 id="year-{year}">{year}</h3><div>{group}</div></section>')
 return ''.join(groups)

def selected_groups(lang,path):
 groups=[]
 for i,area in enumerate(AREAS,1):
  pubs=[p for p in SELECTED if p['area']==area['id']]
  v=detail(pubs[0]['slug'],lang)['visuals'][0]
  items=''.join(f'<article class="home-work" data-publication="{p["slug"]}"><p class="publication-meta">{venue(p)}</p><h4><a href="{esc(rel(path,route(lang,"papers/"+p["slug"]+".html")))}">{esc(p["title"])}</a></h4><p class="work-highlight">{esc(EDITORIAL[p["slug"]][lang])}</p></article>' for p in pubs)
  groups.append(f'<section class="selected-domain" aria-labelledby="selected-{area["id"]}"><p class="section-number">0{i} / {area["id"].upper()}</p><h3 id="selected-{area["id"]}">{UI[lang][area["id"]]}</h3><a class="domain-figure" href="{esc(rel(path,route(lang,"papers/"+pubs[0]["slug"]+".html")))}">{image(v["src"],v["title"],path)}</a>{items}</section>')
 return '<div class="selected-domains">'+''.join(groups)+'</div>'

def research_figure(pub,index,lang,path):
 v=detail(pub['slug'],lang)['visuals'][index];src=esc(rel(path,v['src']))
 return f'<figure class="research-figure"><a href="{src}" target="_blank" rel="noopener noreferrer" aria-label="{esc(t(lang,"查看原图：","View full-size figure: ")+v["title"])}">{image(v["src"],v["title"],path)}</a><figcaption><h3>{esc(v["title"])}</h3><p>{esc(v["caption"])}</p>{figure_credit(pub,lang)}<a class="full-figure-link" href="{src}" target="_blank" rel="noopener noreferrer">{t(lang,"查看原图","View full-size figure")} <span aria-hidden="true">↗</span></a></figcaption></figure>'

def cv_document(lang):
 path=route(lang,'cv.html');u=UI[lang]
 body=f'<article class="cv-document"><header class="cv-header"><p class="eyebrow">Curriculum Vitae</p><h1>{esc(display_name(lang))}</h1><p>{esc(PROFILE["stage_zh" if lang=="zh" else "stage_en"])}</p><p>{esc(PROFILE["school_zh" if lang=="zh" else "school_en"])} · {esc(PROFILE["institution_zh" if lang=="zh" else "institution_en"])}</p><div class="cv-contacts"><a href="mailto:{PROFILE["email"]}">{PROFILE["email"]}</a>{profile_links()}</div><p class="print-actions"><button class="button print-button" type="button">{u["print"]}</button></p></header><section class="cv-section"><h2>{t(lang,"教育经历","Education")}</h2>{education(lang)}</section><section class="cv-section"><h2>{t(lang,"研究兴趣","Research Interests")}</h2><ul class="cv-interests">'+''.join(f'<li>{esc(atext(a,"names",lang))}</li>' for a in AREAS)+'</ul></section>'
 body+=f'<section class="cv-section cv-publications"><h2>{u["publications"]}</h2>{bibliography_years(lang,path)}</section></article>'
 document(path,lang,'cv',t(lang,'孙琦 — 学术 CV','Qi Sun — Academic CV'),t(lang,'孙琦的公开学术履历：教育、研究兴趣与正式发表论文。','Qi Sun’s public academic curriculum vitae: education, research interests, and publications.'),body)

def home(lang):
 path=route(lang,'index.html');u=UI[lang]
 description=t(lang,'我的研究围绕脉冲神经网络的学习与时序计算展开，结合雷达与其他连续信号任务研究事件驱动表示，并探索半导体器件建模与神经形态硬件的跨层联系。','I study learning and temporal computation in spiking neural networks, develop event-driven representations for radar and other continuous signals, and explore semiconductor device models and their connections to neuromorphic hardware.')
 name=('孙琦 <span lang="en">/ Qi Sun</span>' if lang=='zh' else 'Qi Sun <span lang="zh-CN">/ 孙琦</span>')
 institution=PROFILE['institution_zh' if lang=='zh' else 'institution_en']+' · '+PROFILE['school_zh' if lang=='zh' else 'school_en']
 body=f'''<section class="hero" aria-labelledby="home-name"><div class="hero-copy"><p class="eyebrow">{esc(institution)}</p><h1 id="home-name">{name}</h1><p class="identity">{esc(PROFILE['stage_zh' if lang=='zh' else 'stage_en'])}</p><p class="hero-description">{esc(description)}</p><div class="hero-links"><a class="button" href="cv.html">{u['cv']}</a><a href="mailto:{PROFILE['email']}">Email</a>{profile_links()}</div></div>{image('assets/images/portraits/portrait_hero_4x5.webp',t(lang,'孙琦的职业照','Professional portrait of Qi Sun'),path,False,'class="hero-portrait"')}</section><section id="research" class="home-section" aria-labelledby="areas-title"><div class="section-heading"><h2 id="areas-title">{t(lang,'研究方向','Research Areas')}</h2><a href="research.html">{t(lang,'研究陈述','Research statement')} <span aria-hidden="true">↗</span></a></div>{area_cards(lang,path)}</section><section id="selected-publications" class="home-section" aria-labelledby="selected-title"><span id="featured-publications" class="anchor-alias"></span><div class="section-heading"><h2 id="selected-title">{u['selected']}</h2><a href="publications.html">{t(lang,'完整发表目录','Complete publication record')} <span aria-hidden="true">↗</span></a></div>{selected_groups(lang,path)}</section>'''
 document(path,lang,'home',t(lang,'孙琦 | 脉冲学习、信号处理与半导体器件','Qi Sun | Spiking Learning, Signal Processing & Semiconductor Devices'),CONFIG['site']['description'][lang],body,True)

def preview_figures(slug,srcs,lang,path):
 pub=BY_SLUG[slug];visuals=detail(slug,lang)['visuals']
 return ''.join(research_figure(pub,next(i for i,v in enumerate(visuals) if v['src']==src),lang,path) for src in srcs)

def research_preview(mapping,lang,path):
 slug=mapping['slug'];pub=BY_SLUG[slug];d=detail(slug,lang)
 figures=preview_figures(slug,[figure_src(ref) for ref in mapping['figureRefs']],lang,path)
 return f'''<li class="research-paper" data-preview-slug="{slug}" data-paper-title="{esc(pub['title'])}"><div class="research-paper-copy">{venue(pub)}<a class="research-paper-title" tabindex="0" href="papers/{slug}.html">{esc(pub['title'])}</a><p class="research-authors">{authors(pub)}.</p><p class="research-summary">{esc(d['oneLine'])}</p><div class="research-actions"><button class="pin-preview" type="button" hidden aria-pressed="false">{t(lang,'固定预览','Pin preview')}</button><button class="preview-toggle" type="button" hidden aria-haspopup="dialog" aria-controls="paper-reader">{t(lang,'阅读图解','Read illustrated brief')}</button></div></div><template data-stage-template="{slug}"><div class="stage-figures">{figures}</div></template><template data-reader-template="{slug}"><p class="lead">{esc(d['oneLine'])}</p><div class="research-figure-pair">{figures}</div>{links(pub,lang,path)}</template></li>'''

def research(lang):
 path=route(lang,'research.html');u=UI[lang]
 body=intro('Research',u['research'],t(lang,'我研究脉冲网络如何表示和学习连续时间信息，并将这些机制用于雷达脉冲流等信号任务；在器件方向，关注结构、电场与电学特性之间的联系，以及神经形态器件的建模与设计。','I study how spiking networks represent and learn continuous temporal information, with applications to radar pulse streams and related signal tasks. My device research addresses the relationship between structure, electric fields, and electrical behavior, alongside interests in neuromorphic device modeling and design.'))
 body+='<nav class="section-index" aria-label="'+t(lang,'研究方向目录','Research themes')+'">'+''.join(f'<a href="#{a["id"]}">0{i} / {u[a["id"]]}</a>' for i,a in enumerate(AREAS,1))+'</nav>'
 for i,a in enumerate(AREAS,1):
  statement=f'<p>{esc(atext(a,"question",lang))}</p>'
  if a.get('scopes'):
   statement+='<div class="device-scopes">'+''.join(f'<h3>{esc(scope["title"])}</h3><p>{esc(scope[lang])}</p>' for scope in a['scopes'])+'</div>'
  else:statement+='<p>'+esc(atext(a,'method',lang))+'</p>'

  mapping=VISUALS[a['id']]
  figures='<div class="stage-figures">'+''.join(research_figure(BY_SLUG[x['slug']],next(j for j,v in enumerate(detail(x['slug'],lang)['visuals']) if v['src']==figure_src(x['figureRef'])),lang,path) for x in mapping['gallery'])+'</div>'
  refs=''.join(research_preview(x,lang,path) for x in mapping['previews'])
  hint=t(lang,'悬停或聚焦整条论文可切换右侧预览；点击阅读图解查看大图。','Hover or focus a paper row to preview; choose Read illustrated brief for larger figures.')
  related=('<p class="related-work">'+t(lang,'相关应用：','Related applications: ')+ ' · '.join(f'<a href="papers/{slug}.html">{esc(BY_SLUG[slug]["venue"])} · {BY_SLUG[slug]["year"]}</a>' for slug in a.get('related',[]))+'</p>') if a.get('related') else ''
  body+=f'<section id="{a["id"]}" class="research-theme"><div class="theme-heading"><span class="section-number">0{i}</span><h2 id="theme-title-{a["id"]}">{esc(atext(a,"names",lang))}</h2></div><div class="research-statement prose">{statement}</div><h3 class="small-heading">{t(lang,"已发表论文","Published Papers")}</h3><p class="preview-hint">{hint}</p><div class="research-browser" data-preview-state="overview"><ul class="research-references">{refs}</ul><aside class="preview-stage" aria-labelledby="theme-title-{a["id"]} stage-title-{a["id"]}"><div class="stage-heading"><h4 id="stage-title-{a["id"]}">{t(lang,"图解预览","Figure preview")}</h4><button class="reset-preview" hidden type="button">{t(lang,"恢复概览","Reset overview")}</button></div><p class="stage-status" role="status">{t(lang,"方向概览","Area overview")}</p><div class="stage-content" data-stage-slug="overview">{figures}</div><template data-stage-template="overview">{figures}</template></aside></div>{related}</section>'

 body+=f'<dialog id="paper-reader" aria-labelledby="reader-title"><header class="reader-header"><h2 id="reader-title">{t(lang,"论文图解","Illustrated paper brief")}</h2><button class="dialog-close" type="button" autofocus>{t(lang,"关闭","Close")}</button></header><div class="reader-content"></div></dialog>'

 document(path,lang,'research',t(lang,'研究 | 孙琦','Research | Qi Sun'),CONFIG['site']['description'][lang],body)

def publications(lang):
 path=route(lang,'publications.html');u=UI[lang]
 body=intro('Publications',u['publications'],t(lang,'代表性工作与完整发表目录。作者顺序遵循正式出版记录；完整目录按出版日期倒序排列。','Selected work and the complete publication record. Authors follow publisher order; the full list is sorted by publication date.'))
 body+=f'<section aria-labelledby="selected-title"><div class="section-heading"><h2 id="selected-title">{u["selected"]}</h2></div><div class="publication-list">'+''.join(row(p,lang,path,True) for p in SELECTED)+'</div></section>'
 filters=[]
 for group,values in [('kind',['all','conference','journal']),('area',['all','learning','signals','device'])]:
  btns=''.join(f'<button type="button" data-filter-group="{group}" data-filter="{v}" aria-pressed="{"true" if v=="all" else "false"}" aria-controls="all-publications-list">{u[v]}</button>' for v in values)
  label=t(lang,'论文类型' if group=='kind' else '研究方向','Publication type' if group=='kind' else 'Research area')
  filters.append(f'<div class="filter-group" role="group" aria-label="{label}">{btns}</div>')
 body+=f'<section id="all-publications" class="all-publications" aria-labelledby="all-title"><div class="section-heading"><h2 id="all-title">{u["allPapers"]}</h2><a href="{rel(path,"assets/citations/all-publications.bib")}" download>{t(lang,"下载全部 BibTeX","Download all BibTeX")}</a></div><div class="publication-filters">'+''.join(filters)+f'</div><p class="filter-status" role="status" aria-live="polite" data-result-status>{t(lang,"显示 "+str(len(PAPERS))+" 篇论文","Showing "+str(len(PAPERS))+" publications")}</p><div id="all-publications-list" class="publication-list">'+bibliography_years(lang,path)+f'</div><p class="empty-state" data-filter-empty hidden>{u["empty"]}</p><noscript><p>{t(lang,"筛选需要 JavaScript；完整论文列表已显示。","Filtering requires JavaScript; the complete publication list is displayed.")}</p></noscript></section>'
 document(path,lang,'publications',u['publications']+' | Qi Sun',t(lang,'孙琦的代表性论文与完整发表目录。','Selected publications and the full publication record of Qi Sun.'),body)

def education(lang):
 return f'<dl class="education"><div><dt>{t(lang,"博士研究生 · 智能科学与技术","Ph.D. Student · Intelligence Science and Technology")}</dt><dd>{PROFILE["institution_zh" if lang=="zh" else "institution_en"]} · {t(lang,"在读","In progress")}</dd></div><div><dt>{t(lang,"工学学士 · 智能科学与技术","B.Eng. · Intelligence Science and Technology")}</dt><dd>{PROFILE["institution_zh" if lang=="zh" else "institution_en"]} · 2019-09 – 2023-06</dd></div></dl>'

def about(lang,cv=False):
 if cv:return cv_document(lang)
 path=route(lang,'about.html');u=UI[lang];bio=PROFILE['bio_zh' if lang=='zh' else 'bio_en']
 body=intro('About',t(lang,'个人简介','Biography'))
 body+=f'<div class="biography-layout"><div class="prose"><p class="lead">{esc(bio)}</p></div>{image("assets/images/portraits/portrait_about_2x3.webp",t(lang,"孙琦的职业照","Professional portrait of Qi Sun"),path,False,"class=about-portrait")}</div>'
 body+=f'<section class="about-section"><h2>{t(lang,"教育经历","Education")}</h2>{education(lang)}</section><section class="about-section"><h2>{t(lang,"研究兴趣","Research Interests")}</h2><ul class="interest-list">'+''.join(f'<li><a href="research.html#{a["id"]}">{esc(atext(a,"names",lang))}</a></li>' for a in AREAS)+'</ul></section>'
 body+=f'<section id="contact" class="about-section"><h2>{t(lang,"学术入口与联系","Academic Profiles & Contact")}</h2><div class="contact-list"><a href="mailto:{PROFILE["email"]}">{PROFILE["email"]}</a>{profile_links()}<a href="publications.html">{u["publications"]}</a><a href="cv.html">{u["cv"]}</a></div></section>'
 document(path,lang,'about',t(lang,'关于孙琦 | 西安电子科技大学','About Qi Sun | Xidian University'),bio,body,True)

def paper(pub,lang):
 path=route(lang,'papers/'+pub['slug']+'.html');u=UI[lang];d=detail(pub['slug'],lang)
 record=pub['publication']+(', '+pub['volume'] if pub.get('volume') else '')+('('+pub['issue']+')' if pub.get('issue') else '')+' · '+pub['pages']
 body=f'<header class="paper-header"><a class="back-link" href="../publications.html">← {t(lang,"全部论文","All publications")}</a><p class="eyebrow">{u["brief"]}</p><h1>{esc(pub["title"])}</h1><p class="authors">{authors(pub)}.</p><div class="publication-meta">{venue(pub)}<span class="publication-date">{t(lang,"出版记录日期：","Publication record: ") if pub.get("publisher_citation_publication_date") else t(lang,"出版日期：","Published: ")}<time datetime="{pub["date"]}">{pub["date"]}</time></span></div><p class="publication-record">{esc(record)}</p>{links(pub,lang,path,False)}<p class="key-takeaway">{esc(d["oneLine"])}</p></header>'
 steps=''.join(f'<li><strong>{esc(x["label"])}</strong><p>{esc(x["text"])}</p></li>' for x in d['pipeline'])
 metrics=''.join(f'<div><dt>{esc(x["metric"])}</dt><dd><strong>{esc(x["value"])}</strong><p>{esc(x["note"])}</p></dd></div>' for x in d['evidence'])
 body+=f'<div class="paper-body"><section class="paper-section prose"><h2>{u["question"]}</h2><p>{esc(d["problem"])}</p></section><section class="paper-section prose"><h2>{u["method"]}</h2><p>{esc(d["method"])}</p><details class="technical-route"><summary>{u["route"]}</summary><ol>{steps}</ol></details></section><section class="paper-section"><h2>{u["evidence"]}</h2><dl class="evidence-list">{metrics}</dl><div class="figure-gallery">'
 for v in d['visuals']:
  label=t(lang,'打开原尺寸图表：','Open full-size figure: ')+v['title']
  body+=f'<figure><a href="{esc(rel(path,v["src"]))}" aria-label="{esc(label)}">{image(v["src"],v["title"]+". "+v["caption"],path)}</a><figcaption><h3>{esc(v["title"])}</h3><p>{esc(v["caption"])}</p><p>{esc(v["insight"])}</p>{figure_credit(pub,lang)}<a class="full-figure-link" href="{esc(rel(path,v["src"]))}" target="_blank" rel="noopener noreferrer">{t(lang,'查看原图','View full-size figure')}</a></figcaption></figure>'
 body+=f'</div></section><section class="paper-section prose"><h2>{u["conclusion"]}</h2><p class="conclusion-statement">{esc(d["coreClaim"])}</p><p>{esc(d["whyItMatters"])}</p><ul>'+''.join('<li>'+esc(x)+'</li>' for x in d['highlights'])+f'</ul><p class="limitations">{esc(d["discussion"])}</p></section><section class="paper-section prose"><h2>{u["citation"]}</h2><p>{authors(pub)}. {esc(pub["title"])}. <em>{esc(pub["publication"])}</em>, {pub["year"]}, {esc(pub["pages"])}.</p><a href="{esc(rel(path,"assets/citations/"+pub["slug"]+".bib"))}" download>{t(lang,"下载 BibTeX","Download BibTeX")}</a></section></div>'
 document(path,lang,'publications',pub['title']+' | Qi Sun',d['oneLine'],body)

def notes_data(lang):
 posts=[]
 for i in load('posts/index.json')['posts']:
  p=load('posts/'+i['slug']+'.json');posts.append({**p,**p['en']} if lang=='en' else p)
 return sorted(posts,key=lambda p:p['date'],reverse=True)

def notes(lang):
 path=route(lang,'blog.html');u=UI[lang];posts=notes_data(lang)
 body=intro('Notes',u['notes'],t(lang,'围绕已发表研究整理的简短阅读与方法笔记。','Short reading and method notes connected to published research.'))
 body+='<div class="notes-list">'+''.join(f'<article><p class="eyebrow"><time datetime="{p["date"]}">{p["date"]}</time> · {esc(p["category"])}</p><h2><a href="notes/{p["slug"]}.html">{esc(p["title"])}</a></h2><p>{esc(p["excerpt"])}</p></article>' for p in posts)+'</div>'
 document(path,lang,'notes',u['notes']+' | Qi Sun',t(lang,'研究阅读与方法笔记。','Research reading and method notes.'),body)
 for p in posts:
  body=f'<article class="note-article prose"><a class="back-link" href="../blog.html">← {u["notes"]}</a>'+intro(p['date']+' · '+p['category'],p['title'],p['excerpt'])+p['content']+'</article>'
  document(route(lang,'notes/'+p['slug']+'.html'),lang,'notes',p['title']+' | Qi Sun',p['excerpt'],body)
 body=intro('Notes',u['notes'])+'<div data-legacy-notes>'+''.join(f'<article class="note-article prose" id="{p["slug"]}" data-note-slug="{p["slug"]}"><h2><a href="notes/{p["slug"]}.html">{esc(p["title"])}</a></h2>{p["content"]}</article>' for p in posts)+'</div>'
 document(route(lang,'post.html'),lang,'notes',u['notes']+' | Qi Sun',t(lang,'原有研究笔记入口。','Legacy research note entry point.'),body)

def bibtex(pub):
 fields={'title':'{'+pub['title']+'}','author':' and '.join(a['family']+', '+a['given'] for a in pub['authors']),'year':pub['year'],'booktitle' if pub['kind']=='conference' else 'journal':pub['publication'],'pages':pub['pages'].replace('-','--'),'publisher':pub['publisher']}
 for k in ['doi','volume','issue']:
  if pub.get(k):fields['number' if k=='issue' else k]=pub[k]
 fields['url']=pub['links'][0]['url']
 return '@'+('inproceedings' if pub['kind']=='conference' else 'article')+'{'+pub['citationKey']+',\n'+',\n'.join('  '+k+' = {'+str(v)+'}' for k,v in fields.items())+'\n}\n'

def main():
 from validate_publications import validate
 result=validate(ROOT)
 assert not result['errors'],result['errors']
 assert len(PAPERS)>=11 and set(BY_SLUG)==set(DETAILS)
 assert [p['selectedRank'] for p in SELECTED]==sorted({p['selectedRank'] for p in SELECTED})
 for p in PAPERS:
  assert p['kind']=='conference' or not p.get('ccf')
  assert sum(a['given']=='Qi' and a['family']=='Sun' for a in p['authors'])==1
  for lang in ['zh','en']:assert all(detail(p['slug'],lang).get(k) for k in ['oneLine','coreClaim','problem','method','whyItMatters','discussion'])
 citations=ROOT/'assets/citations';citations.mkdir(exist_ok=True)
 for p in PAPERS:(citations/(p['slug']+'.bib')).write_text(bibtex(p),encoding='utf-8')
 (citations/'all-publications.bib').write_text('\n'.join(bibtex(p) for p in PAPERS),encoding='utf-8')
 for lang in ['zh','en']:
  home(lang);research(lang);publications(lang);about(lang);about(lang,True);notes(lang)
  for p in PAPERS:paper(p,lang)
 base=CONFIG['site']['url'];entries=[]
 for path in GENERATED:
  if path.endswith('post.html'):continue
  zh=path.removeprefix('en/');en='en/'+zh
  entries.append(f'<url><loc>{xml_escape(base+"/"+path)}</loc><xhtml:link rel="alternate" hreflang="zh-CN" href="{base}/{zh}"/><xhtml:link rel="alternate" hreflang="en" href="{base}/{en}"/></url>')
 (ROOT/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'+''.join(entries)+'</urlset>\n',encoding='utf-8')
 (ROOT/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+base+'/sitemap.xml\n',encoding='utf-8')
 print(f'Built {len(GENERATED)} bilingual HTML pages, {len(PAPERS)} individual BibTeX files, combined bibliography, sitemap and robots.txt.')
 print('Metadata: data/publications.json; public profile: data/profile.json. All old paper and note entry points retained.')
