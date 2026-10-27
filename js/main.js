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
