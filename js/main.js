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
  const desktop = matchMedia('(min-width: 960px) and (min-height: 700px) and (hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const english = document.body.dataset.lang === 'en';
  const viewer = document.getElementById('figure-viewer');
  const records = [];
  let frame = 0, lastScroll = -Infinity, returnFocus = null;
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const behavior = () => reduced.matches ? 'auto' : 'smooth';

  function schedule() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      for (const r of records) {
        if (r.journey.dataset.mode !== 'scroll') continue;
        const travel = r.journey.offsetHeight - r.stage.offsetHeight;
        const top = r.journey.getBoundingClientRect().top - 24;
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
      const start = journey.getBoundingClientRect().top + scrollY - 24;
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
    for (const r of records) {r.intent = null; clearTimeout(r.settle);}
  }, {passive:true});
  addEventListener('resize', () => {for (const r of records) r.configure();}, {passive:true});
  desktop.addEventListener('change', () => {for (const r of records) r.configure();});
  reduced.addEventListener('change', () => {
    if (reduced.matches) document.getAnimations().forEach(animation => animation.finish());
  });
  // Native dialog provides focus containment and Escape across supported engines.
  document.querySelectorAll('.figure-zoom').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof viewer.showModal !== 'function') return;
    event.preventDefault(); returnFocus = link;
    const figure = link.closest('figure'), img = link.querySelector('img').cloneNode(); img.loading = 'eager';
    viewer.querySelector('#figure-viewer-title').textContent = figure.querySelector('h4').textContent;
    viewer.querySelector('.viewer-image').replaceChildren(img);
    const original = document.createElement('a'); original.href = link.href; original.target = '_blank'; original.rel = 'noopener noreferrer'; original.textContent = english ? 'Open original figure ↗' : '打开原图 ↗';
    const caption = document.createElement('div');
    caption.append(...[...figure.querySelector('figcaption').childNodes].map(node => node.cloneNode(true)));
    const heading = document.createElement('h3'); heading.textContent = caption.querySelector('h4').textContent;
    caption.querySelector('h4').replaceWith(heading);
    viewer.querySelector('.viewer-caption').replaceChildren(caption, original);
    viewer.showModal();
  }));
  viewer.querySelector('.dialog-close').addEventListener('click', () => viewer.close());
  viewer.addEventListener('close', () => {
    viewer.querySelector('.viewer-image').replaceChildren();
    returnFocus?.focus({preventScroll:true});
  });
  schedule();
})();
