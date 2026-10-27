"""Dependency-free bilingual editorial renderer; invoked by build_site.py."""
from __future__ import annotations
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

UI={
 'zh':dict(home='首页',research='研究',publications='论文',about='关于',cv='学术 CV',notes='研究笔记',menu='菜单',dark='深色',skip='跳转到正文',all='全部',conference='会议',journal='期刊',learning='学习机制',signals='信号处理',device='器件',selected='代表性论文',allPapers='全部论文',brief='论文导读',question='研究问题',method='方法',evidence='证据',conclusion='结论与边界',route='技术路线',source='图源',citation='引用',empty='暂无符合条件的论文。',print='打印 / 保存 PDF'),
 'en':dict(home='Home',research='Research',publications='Publications',about='About',cv='CV',notes='Notes',menu='Menu',dark='Dark',skip='Skip to content',all='All',conference='Conference',journal='Journal',learning='Learning',signals='Signals',device='Devices',selected='Selected Publications',allPapers='All Publications',brief='Paper brief',question='Research question',method='Method',evidence='Evidence',conclusion='Takeaway & limitations',route='Technical route',source='Source',citation='Citation',empty='No publications match these filters.',print='Print / save PDF')}

def esc(s):return html.escape(str(s),quote=True)
def t(lang,zh,en):return zh if lang=='zh' else en
def rel(path,target):return posixpath.relpath(target,posixpath.dirname(path) or '.')
def route(lang,filename):return ('en/' if lang=='en' else '')+filename
def detail(slug,lang):
 d=DETAILS[slug];return {**{k:v for k,v in d.items() if k!='en'},**(d.get('en',{}) if lang=='en' else {})}

AREAS=[
 dict(id='learning',names=['脉冲学习与时序计算','Spiking Learning & Temporal Computing'],
 short=['研究脉冲网络的训练与时间表示，通过替代梯度、多尺度编码和稀疏计算，理解有限时间窗内的学习与推理。','Learning and temporal representations in spiking networks, from surrogate gradients to multi-scale encoding and sparse inference.'],
 question=['离散脉冲如何在有限时间窗中保留有效信息，并获得稳定、可控的梯度？这一问题连接训练动力学、时序表示与计算开销。','How can discrete spikes preserve useful evidence within a short horizon while supporting stable gradients? This connects training dynamics, temporal representations, and computational cost.'],
 method=['从膜电位分布与替代梯度的匹配出发，研究训练中的梯度传播；以多尺度时间编码和稀疏变换编码组织连续信号，比较匹配骨干与训练预算下的效果。','I study gradient propagation through the alignment of membrane-potential distributions and surrogate functions, and organize continuous signals through multi-scale temporal and sparse transform encoding under matched comparisons.'],
 papers=['mte-ste-continuous-temporal-signal-classification','mpo-surrogate-function-snn'],figure='mte-ste-continuous-temporal-signal-classification'),
 dict(id='signals',names=['雷达与智能信号处理','Radar & Intelligent Signal Processing'],
 short=['面向混合脉冲流与复杂时序信号，研究雷达分选、去交织和识别，结合无监督学习、相似性结构与事件驱动表示。','Radar sorting, deinterleaving, and recognition in mixed pulse streams, using unsupervised learning, similarity structure, and event-driven representations.'],
 question=['多源脉冲高度交叠、噪声增加或标签不足时，如何恢复辐射源结构，并形成可用于去噪与识别的表示？','How can emitter structure be recovered when pulse streams overlap, noise grows, or labels are scarce, while retaining representations useful for denoising and recognition?'],
 method=['以自组织竞争学习建立无监督分选路径，将脉冲间相似性与伪标签用于簇关系判断，并研究相似性分布到脉冲时序的编码。相关应用也扩展到遥感和多模态传感。','Self-organizing competitive learning provides an unsupervised route; similarity structure and pseudo-labels support cluster decisions, while similarity-guided temporal encoding connects radar inputs to SNNs. Related applications extend to remote sensing and multimodal sensing.'],
 papers=['spiking-som-radar-deinterleaving','sgte-snn-radar-emitter-denoising-recognition','adaptive-clustering-radar-signal-processing'],figure='spiking-som-radar-deinterleaving'),
 dict(id='device',names=['半导体器件与神经形态硬件','Semiconductor Devices & Neuromorphic Hardware'],
 short=['结合器件物理、TCAD 与数据建模研究功率器件设计；同时关注神经形态器件模型、神经元阵列与跨层设计问题。','Power-device design through device physics, TCAD, and data-driven models, alongside interests in neuromorphic device models, neuron arrays, and cross-layer design.'],
 question=['器件结构、边界条件与模型精度如何共同决定电学表现？器件模型又如何与神经形态计算中的神经元行为和系统约束建立联系？','How do device geometry, boundary conditions, and model fidelity shape electrical behavior, and how can device models connect with neuron dynamics and system constraints in neuromorphic computing?'],
 method=['已发表工作包括功率器件的结构设计、电场调控与机器学习辅助建模。神经形态器件与跨层设计属于另一研究层次，关注器件模型、神经元阵列建模及算法与硬件约束的联系。','Published studies address power-device structures, field management, and ML-assisted modeling. Neuromorphic devices and cross-layer design form a distinct research scope involving device models, neuron-array modeling, and connections between algorithms and hardware constraints.'],
 papers=['high-k-trench-gan-hemt','ml-ldmos-bv-optimization','sipos-umofet-fom','variable-k-ldmos'],figure='sipos-umofet-fom')]

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
 return f'<img src="{esc(rel(path,src))}" alt="{esc(alt)}" width="{width}" height="{height}"{loading} {extra}>'

def venue(pub):
 parts=[pub['venue']]
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
 return f'''<article class="publication-row{' selected-row' if selected else ''}" data-publication="{pub['slug']}" data-kind="{pub['kind']}" data-area="{pub['area']}">{thumb}<div class="publication-copy"><div class="publication-meta">{venue(pub)}<time datetime="{pub['date']}">{pub['date']}</time></div><h3><a href="{esc(rel(path,route(lang,'papers/'+pub['slug']+'.html')))}">{esc(pub['title'])}</a></h3><p class="authors">{authors(pub)}.</p><p class="publication-summary">{esc(d['oneLine'])}</p>{links(pub,lang,path)}</div></article>'''

def header(path,lang,page):
 u=UI[lang];items=[]
 for key,file in [('home','index.html'),('research','research.html'),('publications','publications.html'),('about','about.html'),('cv','cv.html')]:
  active=' aria-current="page"' if key==page else '';items.append(f'<a href="{esc(rel(path,route(lang,file)))}"{active}>{u[key]}</a>')
 other=path.removeprefix('en/') if lang=='en' else 'en/'+path
 return f'''<a class="skip-link" href="#main">{u['skip']}</a><header class="site-header"><div class="container nav-bar"><a class="wordmark" href="{esc(rel(path,route(lang,'index.html')))}">Qi Sun <span lang="zh-CN">/ 孙琦</span></a><div class="nav-controls"><button class="menu-toggle" type="button" aria-controls="primary-navigation" aria-expanded="false">{u['menu']}</button><nav id="primary-navigation" class="primary-navigation" aria-label="{t(lang,'主导航','Main navigation')}">{''.join(items)}</nav><a class="language-switch" href="{esc(rel(path,other))}" lang="{'en' if lang=='zh' else 'zh-CN'}" hreflang="{'en' if lang=='zh' else 'zh-CN'}" aria-label="{t(lang,'EN — Switch to English','中 — 切换为中文')}">{'EN' if lang=='zh' else '中'}</a><button class="theme-toggle" type="button" aria-pressed="false" aria-label="{t(lang,'切换深色主题','Switch to dark theme')}">{u['dark']}</button></div></div></header>'''

def footer(path,lang):
 return f'''<footer class="site-footer"><div class="container footer-inner"><p>Qi Sun · {PROFILE['institution_zh' if lang=='zh' else 'institution_en']}<br><span>Academic Homepage + Research Portfolio</span></p><div class="footer-links"><a href="mailto:{PROFILE['email']}">{PROFILE['email']}</a><a href="https://github.com/Sun7-7">GitHub</a><a href="{esc(rel(path,route(lang,'blog.html')))}">{UI[lang]['notes']}</a></div></div></footer>'''

def document(path,lang,page,title,description,body,profile=False):
 base=CONFIG['site']['url'];canonical=base+'/'+path;zh=path.removeprefix('en/');en='en/'+zh
 schema={'@context':'https://schema.org','@type':'ProfilePage' if profile else 'WebPage','url':canonical,'name':title,'inLanguage':'zh-CN' if lang=='zh' else 'en'}
 if profile:schema['mainEntity']={'@type':'Person','name':'Qi Sun','alternateName':'孙琦','url':base+'/en/index.html','image':base+'/assets/images/portraits/portrait_hero_4x5.webp','jobTitle':PROFILE['stage_en'],'affiliation':{'@type':'CollegeOrUniversity','name':'Xidian University'},'email':'mailto:'+PROFILE['email'],'sameAs':['https://github.com/Sun7-7']}
 structured=json.dumps(schema,ensure_ascii=False).replace('<','\\u003c')
 output=f'''<!DOCTYPE html>
<html lang="{'zh-CN' if lang=='zh' else 'en'}" data-theme="light"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{esc(title)}</title><meta name="description" content="{esc(description)}"><link rel="canonical" href="{canonical}"><link rel="alternate" hreflang="zh-CN" href="{base}/{zh}"><link rel="alternate" hreflang="en" href="{base}/{en}"><link rel="alternate" hreflang="x-default" href="{base}/{en}"><meta property="og:type" content="website"><meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(description)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="{base}/assets/images/portraits/portrait_hero_4x5.webp"><meta property="og:image:alt" content="Qi Sun professional portrait"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="{esc(title)}"><meta name="twitter:description" content="{esc(description)}"><meta name="twitter:image" content="{base}/assets/images/portraits/portrait_hero_4x5.webp"><meta name="color-scheme" content="light dark"><link rel="icon" href="{esc(rel(path,'assets/favicon.svg'))}" type="image/svg+xml"><script src="{esc(rel(path,'js/theme-init.js'))}"></script><link rel="stylesheet" href="{esc(rel(path,'css/style.css'))}"><script type="application/ld+json">{structured}</script></head><body data-page="{page}" data-lang="{lang}">{header(path,lang,page)}<main id="main" class="container" tabindex="-1">{body}</main>{footer(path,lang)}<script src="{esc(rel(path,'js/main.js'))}" defer></script></body></html>'''
 (ROOT/path).parent.mkdir(parents=True,exist_ok=True);(ROOT/path).write_text(output+'\n',encoding='utf-8');GENERATED.append(path)

def intro(eyebrow,title,description=''):
 return f'<div class="page-intro"><p class="eyebrow">{esc(eyebrow)}</p><h1>{esc(title)}</h1>'+ (f'<p class="lead">{esc(description)}</p>' if description else '')+'</div>'

def area_cards(lang,path):
 items=[]
 for i,a in enumerate(AREAS,1):
  p=BY_SLUG[a['papers'][0]]
  label=p['venue'] if str(p['year']) in p['venue'] else p['venue']+' '+str(p['year'])
  items.append(f'<article class="area-summary"><p class="section-number">0{i} / {a["id"].upper()}</p><h3><a href="research.html#{a["id"]}">{esc(atext(a,"names",lang))}</a></h3><p>{esc(atext(a,"short",lang))}</p><a class="text-link" href="papers/{p["slug"]}.html">{esc(label)}</a></article>')
 return '<div class="area-grid">'+''.join(items)+'</div>'

def home(lang):
 path=route(lang,'index.html');u=UI[lang]
 description=t(lang,'我的研究围绕脉冲神经网络的学习与时序计算展开，并关注雷达信号智能处理及半导体器件与神经形态硬件设计。研究从算法机制、实际信号任务与器件建模三个层面推进。','My research spans spiking neural network learning and temporal computation, intelligent radar signal processing, and semiconductor devices and neuromorphic hardware, connecting learning mechanisms with signal-domain applications and device-oriented investigations.')
 body=f'''<section class="hero" aria-labelledby="home-name"><div class="hero-copy"><p class="eyebrow">{t(lang,'博士研究生 · 西安电子科技大学','Ph.D. Student · Xidian University')}</p><h1 id="home-name">Qi Sun <span lang="zh-CN">孙琦</span></h1><p class="identity">{esc(PROFILE['school_zh' if lang=='zh' else 'school_en'])}<br>{esc(PROFILE['stage_zh' if lang=='zh' else 'stage_en'])}</p><p class="research-position">{t(lang,'类脑计算 · 雷达与信号智能 · 半导体器件','Neuromorphic Computing · Radar & Signal Intelligence · Semiconductor Devices')}</p><p class="hero-description">{esc(description)}</p><div class="hero-links"><a class="button" href="cv.html">{u['cv']}</a><a href="mailto:{PROFILE['email']}">Email</a><a href="https://github.com/Sun7-7">GitHub</a></div></div>{image('assets/images/portraits/portrait_hero_4x5.webp',t(lang,'孙琦的职业照','Professional portrait of Qi Sun'),path,False,'class="hero-portrait"')}</section><section id="research" class="home-section" aria-labelledby="areas-title"><div class="section-heading"><h2 id="areas-title">{t(lang,'研究方向','Research Areas')}</h2><a href="research.html">{t(lang,'研究陈述','Research statement')} <span aria-hidden="true">↗</span></a></div>{area_cards(lang,path)}</section><section id="selected-publications" class="home-section" aria-labelledby="selected-title"><span id="featured-publications" class="anchor-alias"></span><div class="section-heading"><div><h2 id="selected-title">{u['selected']}</h2><p>{t(lang,'学习机制、信号处理与器件研究中的代表工作。','Representative work in learning, signal processing, and device research.')}</p></div><a href="publications.html">{t(lang,'全部论文','All publications')} <span aria-hidden="true">↗</span></a></div><div class="publication-list">{''.join(row(p,lang,path,True) for p in SELECTED)}</div></section>'''
 document(path,lang,'home','Qi Sun / 孙琦 — Academic Homepage',CONFIG['site']['description'][lang],body,True)

def research(lang):
 path=route(lang,'research.html');u=UI[lang]
 body=intro('Research',u['research'],t(lang,'研究围绕三个相互关联的层次展开：学习与时序计算机制、实际信号任务，以及器件建模与硬件约束。已发表成果与当前研究兴趣在各方向中分别说明。','My research connects learning and temporal computation, signal-domain tasks, and device models with hardware constraints. Published evidence and current interests are distinguished within each theme.'))
 body+='<nav class="section-index" aria-label="'+t(lang,'研究方向目录','Research themes')+'">'+''.join(f'<a href="#{a["id"]}">0{i} / {u[a["id"]]}</a>' for i,a in enumerate(AREAS,1))+'</nav>'
 for i,a in enumerate(AREAS,1):
  subs=''
  if a['id']=='device':subs=f'''<div class="device-scopes"><h3>Semiconductor Device Design & Modeling</h3><p>{t(lang,'APL、IEEE TED 与 Micromachines 论文提供功率器件结构、电场调控与数据驱动建模的公开证据。','The APL, IEEE TED, and Micromachines papers provide published evidence on power-device structures, field management, and data-driven modeling.')}</p><h3>Neuromorphic Devices & Cross-layer Design</h3><p>{t(lang,'当前研究兴趣包括神经形态器件模型、神经元阵列建模与跨层设计。上述功率器件论文不作为神经形态芯片已完成流片或系统验证的证据。','Current interests include neuromorphic device models, neuron-array modeling, and cross-layer design. The power-device papers above do not establish a fabricated or system-validated neuromorphic chip.')}</p></div>'''
  p=BY_SLUG[a['figure']];v=detail(p['slug'],lang)['visuals'][0]
  figure=f'<figure class="research-figure"><a href="{esc(rel(path,v["src"]))}">{image(v["src"],v["title"],path)}</a><figcaption>{esc(v["title"])}. {u["source"]}: <a href="{esc(p["links"][0]["url"])}">{esc(p["venue"])}, {p["year"]}</a>. {esc(p["figureCredit"])}</figcaption></figure>'
  refs=''.join(f'<li><a href="papers/{s}.html">{esc(BY_SLUG[s]["title"])}</a><span>{esc(BY_SLUG[s]["venue"])} · {BY_SLUG[s]["year"]}</span></li>' for s in a['papers'])
  body+=f'<section id="{a["id"]}" class="research-theme"><div class="theme-heading"><span class="section-number">0{i}</span><h2>{esc(atext(a,"names",lang))}</h2></div><div class="research-columns"><div class="prose"><h3>{u["question"]}</h3><p>{esc(atext(a,"question",lang))}</p><h3>{u["method"]}</h3><p>{esc(atext(a,"method",lang))}</p>{subs}</div>{figure}</div><h3 class="small-heading">{t(lang,"相关发表","Related publications")}</h3><ul class="research-references">{refs}</ul></section>'
 document(path,lang,'research',u['research']+' | Qi Sun',CONFIG['site']['description'][lang],body)

def publications(lang):
 path=route(lang,'publications.html');u=UI[lang]
 body=intro('Publications',u['publications'],t(lang,'代表性工作与完整发表目录。作者顺序遵循正式出版记录；完整目录按出版日期倒序排列。','Selected work and the complete publication record. Authors follow publisher order; the full list is sorted by publication date.'))
 body+=f'<section aria-labelledby="selected-title"><div class="section-heading"><h2 id="selected-title">{u["selected"]}</h2></div><div class="publication-list">'+''.join(row(p,lang,path,True) for p in SELECTED)+'</div></section>'
 filters=[]
 for group,values in [('kind',['all','conference','journal']),('area',['all','learning','signals','device'])]:
  btns=''.join(f'<button type="button" data-filter-group="{group}" data-filter="{v}" aria-pressed="{"true" if v=="all" else "false"}" aria-controls="all-publications-list">{u[v]}</button>' for v in values)
  label=t(lang,'论文类型' if group=='kind' else '研究方向','Publication type' if group=='kind' else 'Research area')
  filters.append(f'<div class="filter-group" role="group" aria-label="{label}">{btns}</div>')
 body+=f'<section id="all-publications" class="all-publications" aria-labelledby="all-title"><div class="section-heading"><h2 id="all-title">{u["allPapers"]}</h2><a href="{rel(path,"assets/citations/all-publications.bib")}" download>{t(lang,"下载全部 BibTeX","Download all BibTeX")}</a></div><div class="publication-filters">'+''.join(filters)+f'</div><p class="filter-status" role="status" aria-live="polite" data-result-status>{t(lang,"显示 11 篇论文","Showing 11 publications")}</p><div id="all-publications-list" class="publication-list">'+''.join(row(p,lang,path) for p in PAPERS)+f'</div><p class="empty-state" data-filter-empty hidden>{u["empty"]}</p><noscript><p>{t(lang,"筛选需要 JavaScript；完整论文列表已显示。","Filtering requires JavaScript; the complete publication list is displayed.")}</p></noscript></section>'
 document(path,lang,'publications',u['publications']+' | Qi Sun',t(lang,'孙琦的代表性论文与完整发表目录。','Selected publications and the full publication record of Qi Sun.'),body)

def education(lang):
 return f'<dl class="education"><div><dt>{t(lang,"博士研究生 · 智能科学与技术","Ph.D. Student · Intelligence Science and Technology")}</dt><dd>{PROFILE["institution_zh" if lang=="zh" else "institution_en"]} · {t(lang,"在读","In progress")}</dd></div><div><dt>{t(lang,"工学学士 · 智能科学与技术","B.Eng. · Intelligence Science and Technology")}</dt><dd>{PROFILE["institution_zh" if lang=="zh" else "institution_en"]} · 2019-09 – 2023-06</dd></div></dl>'

def about(lang,cv=False):
 path=route(lang,'cv.html' if cv else 'about.html');u=UI[lang];bio=PROFILE['bio_zh' if lang=='zh' else 'bio_en']
 if cv:
  body=intro('Curriculum Vitae','Qi Sun / 孙琦',PROFILE['stage_zh' if lang=='zh' else 'stage_en'])
  body+=f'<p class="cv-affiliation">{PROFILE["school_zh" if lang=="zh" else "school_en"]} · {PROFILE["institution_zh" if lang=="zh" else "institution_en"]}</p><p class="print-actions"><button class="button print-button" type="button">{u["print"]}</button></p>'
 else:
  body=intro('About',t(lang,'学术简介','Academic Biography'))
  body+=f'<div class="biography-layout"><div class="prose"><p class="lead">{esc(bio)}</p><p>{t(lang,"研究关注学习机制、时序信号中的结构与器件物理约束之间的联系，以公开论文所报告的实验和分析作为讨论依据。","I am interested in how learning mechanisms, temporal signal structure, and physical device constraints inform one another, grounding these questions in the experiments and analyses reported in my publications.")}</p></div>{image("assets/images/portraits/portrait_about_2x3.webp",t(lang,"孙琦的职业照","Professional portrait of Qi Sun"),path,False,"class=about-portrait")}</div>'
 body+=f'<section class="about-section"><h2>{t(lang,"教育经历","Education")}</h2>{education(lang)}</section><section class="about-section"><h2>{t(lang,"研究兴趣","Research Interests")}</h2><ul class="interest-list">'+''.join(f'<li><a href="research.html#{a["id"]}">{esc(atext(a,"names",lang))}</a><p>{esc(atext(a,"short",lang))}</p></li>' for a in AREAS)+'</ul></section>'
 if cv:body+=f'<section class="about-section"><h2>{u["publications"]}</h2><div class="publication-list">'+''.join(row(p,lang,path) for p in PAPERS)+'</div></section>'
 body+=f'<section id="contact" class="about-section"><h2>{t(lang,"学术入口与联系","Academic Profiles & Contact")}</h2><div class="contact-list"><a href="mailto:{PROFILE["email"]}">{PROFILE["email"]}</a><a href="https://github.com/Sun7-7">GitHub / Sun7-7</a><a href="publications.html">{u["publications"]}</a>'+('' if cv else f'<a href="cv.html">{u["cv"]}</a>')+'</div></section>'
 document(path,lang,'cv' if cv else 'about',('Academic CV' if cv else u['about'])+' | Qi Sun',bio,body,not cv)

def paper(pub,lang):
 path=route(lang,'papers/'+pub['slug']+'.html');u=UI[lang];d=detail(pub['slug'],lang)
 record=pub['publication']+(', '+pub['volume'] if pub.get('volume') else '')+('('+pub['issue']+')' if pub.get('issue') else '')+' · '+pub['pages']
 body=f'<header class="paper-header"><a class="back-link" href="../publications.html">← {t(lang,"全部论文","All publications")}</a><p class="eyebrow">{u["brief"]}</p><h1>{esc(pub["title"])}</h1><p class="authors">{authors(pub)}.</p><div class="publication-meta">{venue(pub)}<time datetime="{pub["date"]}">{pub["date"]}</time></div><p class="publication-record">{esc(record)}</p>{links(pub,lang,path,False)}<p class="key-takeaway">{esc(d["oneLine"])}</p></header>'
 steps=''.join(f'<li><strong>{esc(x["label"])}</strong><p>{esc(x["text"])}</p></li>' for x in d['pipeline'])
 metrics=''.join(f'<div><dt>{esc(x["metric"])}</dt><dd><strong>{esc(x["value"])}</strong><p>{esc(x["note"])}</p></dd></div>' for x in d['evidence'])
 body+=f'<div class="paper-body"><section class="paper-section prose"><h2>{u["question"]}</h2><p>{esc(d["problem"])}</p></section><section class="paper-section prose"><h2>{u["method"]}</h2><p>{esc(d["method"])}</p><details class="technical-route"><summary>{u["route"]}</summary><ol>{steps}</ol></details></section><section class="paper-section"><h2>{u["evidence"]}</h2><dl class="evidence-list">{metrics}</dl><div class="figure-gallery">'
 for v in d['visuals']:
  label=t(lang,'打开原尺寸图表：','Open full-size figure: ')+v['title']
  body+=f'<figure><a href="{esc(rel(path,v["src"]))}" aria-label="{esc(label)}">{image(v["src"],v["title"]+". "+v["caption"],path)}</a><figcaption><h3>{esc(v["title"])}</h3><p>{esc(v["caption"])}</p><p>{esc(v["insight"])}</p><p class="figure-credit">{esc(pub["figureCredit"])} <a href="{esc(pub["links"][0]["url"])}">{u["source"]}</a>.</p></figcaption></figure>'
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
 assert len(PAPERS)==11 and len(SELECTED)==6 and set(BY_SLUG)==set(DETAILS)
 assert [p['area'] for p in SELECTED]==['learning','learning','signals','signals','device','device']
 for p in PAPERS:
  assert p['kind']=='conference' or not p.get('ccf')
  assert sum(a['given']=='Qi' and a['family']=='Sun' for a in p['authors'])==1
  for lang in ['zh','en']:assert all(detail(p['slug'],lang).get(k) for k in ['oneLine','coreClaim','problem','method','whyItMatters','pipeline','evidence','highlights','discussion','visuals'])
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
 print(f'Built {len(GENERATED)} bilingual HTML pages, 11 individual BibTeX files, combined bibliography, sitemap and robots.txt.')
 print('Metadata: data/publications.json; public profile: data/profile.json. All old paper and note entry points retained.')
