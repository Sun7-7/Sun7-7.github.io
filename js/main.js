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

/* In-flow Research accordion: default overview or a paper's two figures. */
(() => {
 'use strict';
 const hover = matchMedia('(hover: hover) and (pointer: fine)');
 document.querySelectorAll('.research-browser').forEach(browser => {
  const section = browser.closest('.research-theme');
  const overview = section.querySelector(':scope > .research-figure-pair');
  const rows = [...browser.querySelectorAll('.research-paper')];
  let active = null, timer, suppressFocus = false;
  function cancel() { clearTimeout(timer); }
  // Preserve the selected title's screen position as content above it folds.
  function mutateAt(row, change) {
   const anchor = row.querySelector('.research-paper-title');
   const before = anchor.getBoundingClientRect().top;
   change();
   const delta = anchor.getBoundingClientRect().top - before;
   if (Math.abs(delta) > 1) window.scrollBy({top:delta,behavior:'instant'});
  }
  function setRow(row, open) {
   row.toggleAttribute('data-active',open);
   row.querySelector('.paper-preview').hidden = !open;
   const button=row.querySelector('.preview-toggle');
   button.setAttribute('aria-expanded',String(open));
   button.textContent=open?button.dataset.closeLabel:button.dataset.openLabel;
  }
  function close(restore = false) {
   cancel(); if(!active)return;
   const previous=active;
   mutateAt(previous,()=>{
    setRow(previous,false); overview.hidden=false; active=null;
    browser.dataset.previewState='idle';
   });
   if(restore){
    suppressFocus=true;
    const trigger=previous.querySelector('.preview-toggle');
    trigger.focus({preventScroll:true});
    const rect=trigger.getBoundingClientRect();
    if(rect.top<0 || rect.bottom>innerHeight)trigger.scrollIntoView({block:'center',behavior:'instant'});
    suppressFocus=false;
   }
  }
  function show(row,state) {
   cancel(); if(active===row)return;
   mutateAt(row,()=>{
    if(active)setRow(active,false);
    overview.hidden=true; active=row;setRow(row,true);
    browser.dataset.previewState=state;
   });
  }
  rows.forEach(row=>{
   const title=row.querySelector('.research-paper-title');
   const button=row.querySelector('.preview-toggle');
   const panel=row.querySelector('.paper-preview');
   button.hidden=false;
   title.addEventListener('mouseenter',()=>{
    if(!hover.matches)return;
    cancel();timer=setTimeout(()=>show(row,'hover-expanded'),120);
   });
   title.addEventListener('mouseleave',cancel);
   title.addEventListener('focus',()=>{if(!suppressFocus)show(row,'focus-expanded');});
   button.addEventListener('pointerdown',cancel);
   button.addEventListener('click',()=>active===row?close():show(row,'button-expanded'));
   panel.querySelector('.preview-close').addEventListener('click',()=>close(true));
   panel.querySelectorAll('img').forEach(image=>image.addEventListener('error',()=>{
    panel.querySelector('.preview-error').hidden=false;
   }));
  });
  section.addEventListener('keydown',event=>{
   if(event.key==='Escape' && active){event.preventDefault();close(true);}
  });
  // Selection persists while scrolling/reading. Explicit collapse restores overview.
 });
})();
