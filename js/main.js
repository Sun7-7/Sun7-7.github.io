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

/* Stable Research preview; only an explicit action opens the illustrated reader. */
(() => {
 'use strict';
 const desktop=matchMedia('(min-width: 960px) and (hover: hover) and (pointer: fine)');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const english=document.body.dataset.lang==='en';
 const dialog=document.getElementById('paper-reader');
 let returnFocus=null;
 dialog?.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
 dialog?.addEventListener('close',()=>{dialog.querySelector('.reader-content').replaceChildren();returnFocus?.focus({preventScroll:true});});
 document.querySelectorAll('.research-browser').forEach(browser=>{
  const rows=[...browser.querySelectorAll('.research-paper')];
  const stage=browser.querySelector('.preview-stage'),content=stage.querySelector('.stage-content');
  const status=stage.querySelector('.stage-status');
  let locked=null,hovered=null,focused=null,hold=false,timer,request=0,presented='overview';
  function cancel(){clearTimeout(timer);}
  async function render(row){
   const slug=row?.dataset.previewSlug||'overview';
   const token=++request;
   rows.forEach(item=>{item.toggleAttribute('data-active',item===row);item.querySelector('.pin-preview').setAttribute('aria-pressed',String(item===locked));});
   browser.dataset.previewState=locked?'locked':row?'preview':'overview';
   status.textContent=locked?(english?'Pinned preview':'已固定预览'):row?(english?'Paper preview':'论文预览'):(english?'Area overview':'方向概览');
   if(slug===presented){stage.removeAttribute('aria-busy');return;}
   const template=browser.querySelector(`template[data-stage-template="${slug}"]`);
   const fragment=template.content.cloneNode(true);
   stage.setAttribute('aria-busy','true');
   status.textContent=english?'Loading figures…':'正在加载图解…';
   await Promise.all([...fragment.querySelectorAll('img')].map(async img=>{
    img.loading='eager';const probe=new Image();probe.src=new URL(img.getAttribute('src'),document.baseURI).href;try{await probe.decode();}catch{img.alt+=(english?' (unavailable; use original figure link)':'（暂不可用，请使用原图入口）');}
   }));
   if(token!==request)return;
   const next=document.createElement('div');next.className='stage-layer';next.append(fragment);
   content.replaceChildren(next);content.dataset.stageSlug=slug;presented=slug;
   stage.removeAttribute('aria-busy');
   status.textContent=locked?(english?'Pinned preview':'已固定预览'):row?(english?'Paper preview':'论文预览'):(english?'Area overview':'方向概览');
   if(!reduced.matches)next.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'ease-out'});
  }
  function choose(){if(content.contains(document.activeElement))return;if(desktop.matches)render(locked||hovered||focused||(hold?rows.find(row=>row.dataset.previewSlug===presented):null));}
  rows.forEach(row=>{
   const pin=row.querySelector('.pin-preview'),read=row.querySelector('.preview-toggle');
   pin.hidden=false;read.hidden=false;
   row.addEventListener('pointerenter',()=>{
    if(!desktop.matches || locked)return;
    cancel();hovered=row;
    timer=setTimeout(choose,presented==='overview'?120:0);
   });
   row.addEventListener('pointerleave',()=>{if(!desktop.matches)return;cancel();if(hovered===row)hovered=null;timer=setTimeout(choose,150);});
   row.addEventListener('focusin',()=>{if(desktop.matches){cancel();focused=row;choose();}});
   row.addEventListener('focusout',()=>{setTimeout(()=>{
    if(row.contains(document.activeElement))return;
    if(focused===row)focused=null;
    hold=stage.contains(document.activeElement);choose();
   },0);});
   pin.addEventListener('click',()=>{cancel();locked=locked===row?null:row;choose();});
   read.addEventListener('click',()=>{
    returnFocus=read;
    dialog.querySelector('#reader-title').textContent=row.dataset.paperTitle;
    dialog.querySelector('.reader-content').replaceChildren(row.querySelector('template[data-reader-template]').content.cloneNode(true));
    dialog.querySelectorAll('img').forEach(img=>{img.loading='eager';});
    dialog.showModal();
   });
   row.addEventListener('pointerenter',()=>row.querySelector('template[data-stage-template]').content.querySelectorAll('img').forEach(img=>{const warm=new Image();warm.src=img.src;}),{once:true});
  });
  stage.addEventListener('focusin',()=>{cancel();hold=true;++request;stage.removeAttribute('aria-busy');});
  stage.addEventListener('pointerenter',()=>{cancel();hold=true;});
  stage.addEventListener('pointerleave',()=>{hold=false;timer=setTimeout(choose,150);});
  stage.addEventListener('focusout',()=>setTimeout(()=>{if(!stage.contains(document.activeElement)){hold=false;choose();}},0));
  function reset(){cancel();locked=null;hovered=null;focused=null;hold=false;render(null);}
  stage.querySelector('.reset-preview').hidden=false;
  stage.querySelector('.reset-preview').addEventListener('click',reset);
  browser.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(stage.contains(document.activeElement))stage.querySelector('.reset-preview').focus({preventScroll:true});reset();}});
  desktop.addEventListener('change',reset);
  reduced.addEventListener('change',()=>{if(reduced.matches)content.getAnimations({subtree:true}).forEach(animation=>animation.finish());});
 });
})();
