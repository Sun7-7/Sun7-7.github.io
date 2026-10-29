/* Academic Homepage + Research Portfolio. Progressive enhancement only. */
(() => {
  'use strict';
  const lang = document.body.dataset.lang === 'en' ? 'en' : 'zh';
  const themeButton = document.querySelector('.theme-toggle');
  function syncThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    if (!themeButton) return;
    themeButton.textContent = lang === 'en' ? (dark ? 'Light' : 'Dark') : (dark ? '浅色' : '深色');
    themeButton.setAttribute('aria-pressed', String(dark));
    themeButton.setAttribute('aria-label', lang === 'en' ? `Switch to ${dark ? 'light' : 'dark'} theme` : `切换${dark ? '浅色' : '深色'}主题`);
  }
  syncThemeButton();
  themeButton?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (_) { /* Storage is optional. */ }
    syncThemeButton();
  });

  const menu = document.querySelector('.menu-toggle');
  const nav = document.getElementById('primary-navigation');
  function closeMenu(returnFocus = false) {
    nav?.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
    if (returnFocus) menu?.focus();
  }
  menu?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!nav?.contains(event.target) && !menu?.contains(event.target)) closeMenu();
  });
  window.matchMedia('(min-width: 851px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  const filters = { kind: 'all', area: 'all' };
  const list = document.getElementById('all-publications-list');
  const rows = list ? [...list.querySelectorAll('[data-publication]')] : [];
  function filterPublications() {
    let count = 0;
    rows.forEach(row => {
      row.hidden = !((filters.kind === 'all' || row.dataset.kind === filters.kind) && (filters.area === 'all' || row.dataset.area === filters.area));
      if (!row.hidden) count += 1;
    });
    list?.querySelectorAll('[data-year-group]').forEach(group => {
      group.hidden = ![...group.querySelectorAll('[data-publication]')].some(row => !row.hidden);
    });
    document.querySelectorAll('[data-filter-group]').forEach(button => {
      button.setAttribute('aria-pressed', String(filters[button.dataset.filterGroup] === button.dataset.filter));
    });
    const status = document.querySelector('[data-result-status]');
    if (status) status.textContent = lang === 'en' ? `Showing ${count} of ${rows.length} publications` : `显示 ${count} / ${rows.length} 篇论文`;
    const empty = document.querySelector('[data-filter-empty]');
    if (empty) empty.hidden = count !== 0;
  }
  document.querySelectorAll('[data-filter-group]').forEach(button => {
    button.addEventListener('click', () => {
      filters[button.dataset.filterGroup] = button.dataset.filter;
      filterPublications();
    });
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const buttons = [...button.parentElement.querySelectorAll('button')];
      let index = buttons.indexOf(button);
      index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index].focus();
      buttons[index].click();
    });
  });
  document.querySelector('.print-button')?.addEventListener('click', () => window.print());

  // Retain post.html?slug=... and en/post.html?slug=... with an allowlisted redirect.
  if (document.querySelector('[data-legacy-notes]')) {
    const slug = new URLSearchParams(location.search).get('slug');
    const note = [...document.querySelectorAll('[data-note-slug]')].find(item => item.dataset.noteSlug === slug);
    if (note) location.replace(new URL(`notes/${encodeURIComponent(note.dataset.noteSlug)}.html`, location.href));
  }
})();

/* V3.6: position-driven focus, fixed desktop deck, native document scrolling. */
(() => {
  'use strict';
  const journeys = [...document.querySelectorAll('.focus-journey')];
  if (!journeys.length) return;
  const desktop = matchMedia('(min-width: 1100px) and (min-height: 850px) and (hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const english = document.body.dataset.lang === 'en';
  const viewer = document.getElementById('figure-viewer');
  const records = [];
  let frame = 0, lastScroll = -Infinity, returnFocus = null, areaTarget = null, areaTimer;
  document.addEventListener('researchareanavigate',event=>{areaTarget=event.detail.id;clearTimeout(areaTimer);for(const r of records){clearTimeout(r.timer);clearTimeout(r.settle);r.intent=null;r.hover=null;r.focus=null;}areaTimer=setTimeout(()=>{areaTarget=null;schedule();},1800);});
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const behavior = () => reduced.matches ? 'auto' : 'smooth';

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const r of records) {
        if (r.journey.dataset.mode !== 'scroll') continue;
        if(areaTarget && r.journey.closest('section').id!==areaTarget)continue;
        const bounds=r.journey.getBoundingClientRect();if(bounds.bottom<0||bounds.top>innerHeight)continue;
        const travel = r.journey.offsetHeight - r.stage.offsetHeight;
        const top = r.journey.getBoundingClientRect().top - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--area-nav-height'))||0) - 16;
        r.scrollIndex = clamp(Math.round(-top / Math.max(1, travel) * (r.cards.length - 1)), 0, r.cards.length - 1);
        if (r.intent !== null) continue;
        // Never remove a keyboard user's focused control, including a modal opener.
        if (viewer.open || r.cards.some(card => card.querySelector('.paper-body').contains(document.activeElement))) continue;
        r.draw(r.hover ?? r.focus ?? r.scrollIndex);
      }
    });
  }

  for (const journey of journeys) {
    const stage = journey.querySelector('.focus-stage'), deck = journey.querySelector('.focus-deck');
    const cards = [...deck.querySelectorAll('.focus-paper')];
    const r = {journey, stage, deck, cards, current: -2, scrollIndex: 0, hover: null, focus: null, intent: null, timer: 0, settle: 0};
    records.push(r);
    r.draw = (index, announce = false) => {
      if (index === r.current) return;
      const old = r.current; r.current = index;
      journey.dataset.activeIndex = String(index);
      deck.style.gridTemplateRows = cards.map((_, i) => i === index ? 'minmax(0, 1fr)' : '68px').join(' ');
      cards.forEach((card, i) => {
        const active = i === index, panel = card.querySelector('.paper-body');
        card.classList.toggle('is-active', active);
        card.querySelector('.paper-trigger').setAttribute('aria-expanded', String(active));
        card.querySelector('.paper-indicator').textContent = active ? '−' : '+';
        panel.setAttribute('aria-hidden', String(!active)); panel.inert = !active;
        if (active) panel.querySelectorAll('img').forEach(img => {img.loading = 'eager';});
      });
      journey.querySelector('.focus-count').textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
      if (announce) journey.querySelector('.focus-status').textContent = (english ? 'Selected: ' : '已选中：') + (index < 0 ? (english ? 'All collapsed' : '全部收起') : cards[index].querySelector('.paper-short').textContent);
      journey.dispatchEvent(new CustomEvent('researchfocuschange', {bubbles:true, detail:{from:old, to:index, cause:r.hover !== null ? 'hover' : r.intent !== null ? 'activate' : r.focus !== null ? 'focus' : 'position'}}));
    };
    function clearPreview() { clearTimeout(r.timer); r.hover = null; r.pendingHover = null; }
    r.configure = () => {
      clearPreview(); r.focus = null; r.intent = null; clearTimeout(r.settle);
      journey.dataset.mode = desktop.matches ? 'scroll' : 'manual';
      journey.style.setProperty('--journey-travel', `${Math.round((cards.length - 1) * Math.min(540, innerHeight * .6))}px`);
      r.draw(Math.max(0, r.current)); schedule();
    };
    function activate(index) {
      clearPreview(); r.focus = null;
      if (journey.dataset.mode !== 'scroll') {
        r.draw(r.current === index ? -1 : index, true);
        const trigger = cards[index].querySelector('.paper-trigger');
        if (trigger.getBoundingClientRect().top < 0) trigger.scrollIntoView({block:'start', behavior:behavior()});
        return;
      }
      r.intent = index; r.draw(index, true);
      const travel = journey.offsetHeight - stage.offsetHeight;
      const start = journey.getBoundingClientRect().top + scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--area-nav-height'))||0) - 16;
      // One native navigation action. No wheel cancellation or scrolling compensation.
      window.scrollTo({top: start + travel * index / Math.max(1, cards.length - 1), behavior:behavior()});
      clearTimeout(r.settle);
      r.settle = setTimeout(() => {r.intent = null; schedule();}, reduced.matches ? 0 : 900);
    }
    deck.addEventListener('pointermove', event => {
      if (journey.dataset.mode !== 'scroll' || event.pointerType === 'touch' || performance.now() - lastScroll < 220 || viewer.open) return;
      const card = event.target.closest('.focus-paper');
      if (!card) {clearPreview(); schedule(); return;}
      const index = cards.indexOf(card);
      if (r.hover === index || r.pendingHover === index) return;
      clearTimeout(r.timer); r.pendingHover = index;
      r.timer = setTimeout(() => {
        r.pendingHover = null;
        if (performance.now() - lastScroll < 220 || r.intent !== null || r.cards.some(c => c.querySelector('.paper-body').contains(document.activeElement))) return;
        r.hover = index; r.draw(index);
      }, 120);
    });
    // Layout animation may move a card away from a stationary pointer. Only an
    // actual pointer move chooses another row; leaving the deck restores position.
    deck.addEventListener('pointerleave', () => {clearPreview(); r.pendingHover = null; schedule();});
    cards.forEach((card, index) => {
      const trigger = card.querySelector('.paper-trigger');
      trigger.addEventListener('click', () => activate(index));
      trigger.addEventListener('keydown', event => {
        if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : clamp(index + (event.key === 'ArrowDown' ? 1 : -1), 0, cards.length - 1);
        cards[next].querySelector('.paper-trigger').focus({preventScroll:true});
        if (journey.dataset.mode === 'scroll') activate(next); else r.draw(next, true);
      });
      trigger.addEventListener('focus', () => {
        if (journey.dataset.mode === 'scroll' && trigger.matches(':focus-visible')) {clearPreview(); r.focus = index; r.draw(index, true);}
      });
      card.addEventListener('focusout', () => setTimeout(() => {
        if (!deck.contains(document.activeElement)) {r.focus = null; schedule();}
      }, 0));
      card.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
        img.alt += english ? ' (unavailable; open original figure)' : '（暂不可用，可打开原图）';
        img.closest('.focus-figure').dataset.imageError = 'true';
      }, {once:true}));
    });
    r.configure();
  }
  addEventListener('scroll', () => {
    lastScroll = performance.now();
    for (const r of records) {clearTimeout(r.timer); r.pendingHover = null; r.hover = null; r.focus = null;}
    schedule();
  }, {passive:true});
  addEventListener('wheel', () => {
    areaTarget=null;clearTimeout(areaTimer);
    if (!viewer.open && document.activeElement.matches('.figure-select')) document.activeElement.blur();
    for (const r of records) {r.intent = null; clearTimeout(r.settle);}
  }, {passive:true});
  addEventListener('resize', () => {for (const r of records) r.configure();}, {passive:true});
  desktop.addEventListener('change', () => {for (const r of records) r.configure();});
  reduced.addEventListener('change', () => {
    if (reduced.matches) document.getAnimations().forEach(animation => animation.finish());
  });

  schedule();
})();

/* Inner figure focus never calls the outer controller or a scroll API. */
(() => {
 const english=document.body.dataset.lang==='en';
 const hover=matchMedia('(hover:hover) and (pointer:fine)');
 document.querySelectorAll('.focus-figures').forEach(stage=>{
  const tiles=[...stage.querySelectorAll('.focus-figure')];
  const fallback=Math.max(0,tiles.findIndex(t=>t.dataset.figureRef===stage.dataset.defaultPrimary));
  let pinned=null,preview=null,timer;
  stage.dataset.mediaEnhanced='true';
  const reset=stage.querySelector('.reset-figure');reset.hidden=false;
  function draw(index,announce=false){
   stage.dataset.primaryIndex=String(index);stage.dataset.mediaState=pinned!==null?'pinned':preview!==null?'preview':'default';
   // CSS arithmetic cannot interpolate a variable with a fr suffix. Compute
   // numeric track values from the validated data instead.
   const style=getComputedStyle(stage),primary=Number(style.getPropertyValue('--primary-weight'))||2.4,secondary=Number(style.getPropertyValue('--secondary-weight'))||1;
   stage.style.setProperty('--media-tracks',tiles.map((_,i)=>`minmax(0,${i===index?primary:secondary}fr)`).join(' '));
   tiles.forEach((tile,i)=>{tile.classList.toggle('is-primary',i===index);tile.querySelector('.figure-select').setAttribute('aria-pressed',String(i===index));});
   if(announce)stage.querySelector('.media-status').textContent=(english?'Figure focus: ':'主图：')+tiles[index].querySelector('h4').textContent;
  }
  function restore(){clearTimeout(timer);preview=null;draw(pinned??fallback);}
  stage.addEventListener('pointermove',event=>{
   if(!hover.matches||event.pointerType==='touch'||event.buttons)return;
   const tile=event.target.closest('.focus-figure');if(!tile){restore();return;}
   const index=tiles.indexOf(tile);if(preview===index)return;
   clearTimeout(timer);timer=setTimeout(()=>{preview=index;draw(index);},100);
  });
  stage.addEventListener('pointerleave',restore);
  stage.addEventListener('focusout',()=>setTimeout(()=>{if(!stage.contains(document.activeElement))restore();},0));
  tiles.forEach((tile,index)=>{
   const button=tile.querySelector('.figure-select');
   // Pointer focus happens before mouseup; changing geometry there can move
   // the target away and swallow its click. Keyboard focus may preview safely.
   button.addEventListener('pointerdown',()=>clearTimeout(timer));
   button.addEventListener('focus',()=>{if(button.matches(':focus-visible')){preview=index;draw(index);}});
   button.addEventListener('click',()=>{clearTimeout(timer);pinned=index;preview=null;draw(index,true);});
   button.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tiles.length-1:(index+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+tiles.length)%tiles.length;
    tiles[next].querySelector('.figure-select').focus({preventScroll:true});
   });
  });
  function resetFocus(){pinned=null;preview=null;clearTimeout(timer);draw(fallback,true);}
  reset.addEventListener('click',resetFocus);
  stage.addEventListener('keydown',event=>{if(event.key==='Escape'&&!document.getElementById('figure-viewer').open){event.preventDefault();resetFocus();}});
  stage.closest('.focus-journey').addEventListener('researchfocuschange',()=>{pinned=null;preview=null;clearTimeout(timer);draw(fallback);});
  draw(fallback);
 });
})();

/* One explicit image viewer across Research, paper briefs and Home. */
(() => {
 const viewer=document.getElementById('figure-viewer'); if(!viewer)return;
 const english=document.body.dataset.lang==='en'; let returnFocus=null;
  // Native dialog provides focus containment and Escape across supported engines.
  document.querySelectorAll('.figure-zoom, .media-open').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof viewer.showModal !== 'function') return;
    event.preventDefault(); returnFocus = link;
    const figure = link.closest('figure'); const originalImg = figure?.querySelector('img') || link.previousElementSibling?.querySelector('img');
    const img = originalImg ? originalImg.cloneNode() : new Image(); img.src = link.href; img.loading = 'eager'; if (!img.alt) img.alt = link.dataset.mediaTitle || (english ? 'Research figure' : '科研图');
    viewer.querySelector('#figure-viewer-title').textContent = figure?.querySelector('h3,h4')?.textContent || link.dataset.mediaTitle || img.alt;
    viewer.querySelector('.viewer-image').replaceChildren(img);
    const original = document.createElement('a'); original.href = link.href; original.target = '_blank'; original.rel = 'noopener noreferrer'; original.textContent = english ? 'Open original figure ↗' : '打开原图 ↗';
    const caption = document.createElement('div');
    if (figure?.querySelector('figcaption')) caption.append(...[...figure.querySelector('figcaption').childNodes].map(node => node.cloneNode(true)));
    const oldHeading = caption.querySelector('h3,h4'); if (oldHeading) { const heading = document.createElement('h3'); heading.textContent = oldHeading.textContent; oldHeading.replaceWith(heading); }
    caption.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
    viewer.querySelector('.viewer-caption').replaceChildren(caption, original);
    viewer.showModal();
  }));
  viewer.querySelector('.dialog-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => {
    viewer.querySelector('.viewer-image').replaceChildren();
    returnFocus?.focus({preventScroll:true});
  });
})();
/* V3.8: a semantic area directory; scrollspy never navigates or resets figures. */
(()=>{
 const nav=document.querySelector('.area-navigator');if(!nav)return;
 const sections=[...document.querySelectorAll('.research-theme')],explorer=document.querySelector('.area-explorer');
 const links=[...document.querySelectorAll('[data-area-link]')],progress=nav.querySelector('.area-progress span');let frame=0,current='';
 function update(){frame=0;const offset=nav.getBoundingClientRect().height+16,threshold=offset+Math.min(64,innerHeight*.2);let active=sections[0];
  for(const section of sections){if(section.getBoundingClientRect().top<=threshold)active=section;}
  if(current!==active.id){current=active.id;document.body.dataset.activeArea=current;
   links.filter(a=>!a.classList.contains('area-bridge')).forEach(a=>{if(a.dataset.areaLink===current)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current');});
   nav.querySelector('.area-position').textContent=String(sections.indexOf(active)+1).padStart(2,'0')+' / '+String(sections.length).padStart(2,'0');
  }
  const rect=active.getBoundingClientRect(),fraction=Math.max(0,Math.min(1,(offset-rect.top)/Math.max(1,rect.height-innerHeight+offset)));
  progress.style.transform=`scaleX(${(sections.indexOf(active)+fraction)/sections.length})`;
  nav.classList.toggle('is-stuck',explorer.getBoundingClientRect().bottom<=0);
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(update);}
 function measure(){document.documentElement.style.scrollPaddingTop='0px';document.documentElement.style.setProperty('--area-nav-height',nav.getBoundingClientRect().height+'px');schedule();}
 links.forEach(link=>link.addEventListener('click',event=>{
  if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const target=sections.find(s=>s.id===link.dataset.areaLink);if(!target)return;
  event.preventDefault();if(location.hash!=='#'+target.id)history.pushState(null,'','#'+target.id);
  // A single native navigation; the outer paper controller observes position.
  document.dispatchEvent(new CustomEvent('researchareanavigate',{detail:{id:target.id}}));
  document.activeElement?.blur();target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
  target.querySelector('h2').setAttribute('tabindex','-1');target.querySelector('h2').focus({preventScroll:true});schedule();
 }));
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',measure,{passive:true});
 addEventListener('popstate',()=>{const s=sections.find(s=>'#'+s.id===location.hash);if(s)s.scrollIntoView({block:'start',behavior:'auto'});schedule();});
 function restoreHash(){const target=sections.find(s=>'#'+s.id===location.hash);if(target)requestAnimationFrame(()=>{target.scrollIntoView({block:'start',behavior:'auto'});schedule();});}
 addEventListener('hashchange',restoreHash);addEventListener('pageshow',restoreHash);
 new ResizeObserver(measure).observe(nav);measure();
 // Font/layout initialization may precede native hash restoration.
 if(location.hash){const target=sections.find(s=>'#'+s.id===location.hash);if(target)requestAnimationFrame(()=>target.scrollIntoView({block:'start',behavior:'auto'}));}
})();
