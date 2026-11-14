const zh = document.documentElement.lang === 'zh-CN';
const tr = (chinese, english) => zh ? chinese : english;
const root = new URL('../', import.meta.url);
let activeReader;
let activeStory;

function node(tag, text, attributes = {}) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function dialog(name, title, opener) {
  const element = node('dialog', '', {class: 'reading-dialog ' + name, 'aria-labelledby': name + '-title'});
  const header = node('header', '', {class: 'reading-bar'});
  const heading = node('h2', title, {id: name + '-title'});
  const close = node('button', tr('返回', 'Back'), {type: 'button', autofocus: ''});
  close.addEventListener('click', () => element.close());
  header.append(heading, close);
  element.append(header);
  const x = window.scrollX, y = window.scrollY;
  document.documentElement.classList.add('paper-reading-open');
  document.body.append(element);
  element.showModal();
  element.addEventListener('close', () => {
    element.remove();
    if (opener?.isConnected) opener.focus({preventScroll: true});
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo({left: x, top: y, behavior: 'instant'});
    if (!document.querySelector('.reading-dialog[open]')) document.documentElement.classList.remove('paper-reading-open');
  }, {once: true});
  return element;
}

async function openStory(link) {
  if (activeStory) return;
  const controller = new AbortController();
  const element = dialog('story-dialog', tr('研究导读', 'Paper Story'), link);
  activeStory = element;
  const body = node('div', '', {class: 'story-scroll', tabindex: '0', role: 'region', 'aria-label': tr('导读正文', 'Story content')});
  const status = node('p', tr('正在加载导读…', 'Loading the story…'), {role: 'status'});
  body.append(status);
  element.append(body);
  element.addEventListener('close', () => {
    controller.abort();
    activeStory = undefined;
  }, {once: true});
  try {
    const response = await fetch(link.href, {signal: controller.signal});
    if (!response.ok) throw Error('Story response ' + response.status);
    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');
    const article = parsed.querySelector('.paper-story');
    if (!article) throw Error('Missing story');
    if (controller.signal.aborted || !element.open) return;
    article.querySelectorAll('[href],[src]').forEach(item => {
      for (const attr of ['href', 'src']) {
        if (item.getAttribute(attr)) item.setAttribute(attr, new URL(item.getAttribute(attr), link.href).href);
      }
    });
    body.replaceChildren(article);
    element.querySelector('.reading-bar').append(node('a', tr('独立页面', 'Standalone story'), {href: link.href}));
  } catch {
    if (!controller.signal.aborted) {
      status.textContent = tr('导读加载失败。', 'The story could not load.');
      status.append(' ', node('a', tr('打开导读页面', 'Open the story page'), {href: link.href}));
    }
  }
}

const byteLimit = 64 * 1024 * 1024;
const allowedOfficialHosts = new Set(['doi.org', 'proceedings.mlr.press', 'ojs.aaai.org', 'www.mdpi.com', 'pubs.aip.org']);
function officialURL(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || !allowedOfficialHosts.has(url.host)) throw Error('source');
  return url.href;
}
function paperURL(value) {
  const url = new URL(value, root);
  const local = url.origin === root.origin && url.pathname.startsWith(new URL('assets/papers/',root).pathname);
  const pmlr = url.origin === 'https://raw.githubusercontent.com' && /^\/mlresearch\/v\d+\/main\/assets\//.test(url.pathname);
  const mdpi = url.origin === 'https://mdpi-res.com' && url.pathname.startsWith('/d_attachment/');
  if (!(local || pmlr || mdpi) || !url.pathname.endsWith('.pdf') || url.username || url.password) throw Error('source');
  return url;
}
let registryRequest;
function registry() {
  registryRequest ??= fetch(new URL('data/pdf_sources.json',root), {credentials:'same-origin'})
    .then(response => { if (!response.ok) throw Error('network'); return response.json(); })
    .then(rows => new Map(rows.map(row => [row.paperId,row])))
    .catch(() => { registryRequest=undefined; throw Error('network'); });
  return registryRequest;
}
const errors = {
  missing: tr('原文文件不存在（404）。', 'The PDF was not found (404).'),
  permission: tr('来源需要登录或拒绝访问。', 'The source requires sign-in or denied access.'),
  format: tr('来源返回的内容无法作为 PDF 打开。', 'The source did not return a readable PDF.'),
  network: tr('无法读取原文。请检查网络连接或跨域访问限制。', 'The source could not be reached. Check your connection or the source’s cross-origin policy.'),
  timeout: tr('加载超时。', 'Loading timed out.'),
  worker: tr('PDF.js 渲染组件未能启动。', 'The PDF.js rendering components could not start.'),
  size: tr('文件超过站内阅读器的 64 MB 上限。', 'This file exceeds the reader’s 64 MB limit.'),
  source: tr('此论文的原文由出版方提供，请从正式来源继续阅读。', 'Continue reading at the official source.'),
};

async function bytesFor(input, signal) {
  const url = paperURL(input);
  let response;
  try {
    response = await fetch(url, {signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'});
  } catch {
    throw Error('network');
  }
  if (response.status === 404) throw Error('missing');
  if ([401, 403].includes(response.status)) throw Error('permission');
  if (!response.ok) throw Error('network');
  const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!['application/pdf','application/octet-stream'].includes(mime)) throw Error('format');
  if (Number(response.headers.get('content-length')) > byteLimit) throw Error('size');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > byteLimit) throw Error('size');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data;
}

function openReader(link) {
  if (activeReader) return;
  const title = link.dataset.paperTitle || tr('PDF 阅读器', 'PDF reader');
  const element = dialog('pdf-dialog', title, link);
  activeReader = element;
  if (activeStory) element.querySelector('.reading-bar button').textContent = tr('返回导读','Back to story');
  const header = element.querySelector('.reading-bar');
  const controls = node('div', '', {class: 'reading-tools'});
  const source = node('a', tr('访问原文 ↗', 'Official source ↗'), {href: officialURL(link.dataset.official), target:'_blank', rel:'noopener noreferrer'});
  controls.append(node('span', link.dataset.venue || ''), source);
  if (link.dataset.doi && /^10\.\d+\/[a-z0-9.\-_/]+$/i.test(link.dataset.doi)) {
    controls.append(node('a', 'DOI ↗', {href:'https://doi.org/'+link.dataset.doi,target:'_blank',rel:'noopener noreferrer'}));
  }
  const mobile = node('div', '', {class:'reader-mobile-tools', hidden:''});
  for (const [label, action] of [
    [tr('上一页','Previous page'), viewer => viewer.previousPage()],
    [tr('下一页','Next page'), viewer => viewer.nextPage()],
    [tr('适合页宽','Fit width'), viewer => {viewer.currentScaleValue='page-width';}],
    [tr('适合整页','Fit page'), viewer => {viewer.currentScaleValue='page-fit';}],
  ]) {
    const button = node('button',label,{type:'button'});
    button.addEventListener('click',()=>{if(job?.app?.pdfDocument)action(job.app.pdfViewer);});
    mobile.append(button);
  }
  header.after(controls, mobile);
  const status = node('p', '', {class: 'reader-status', role: 'status'});
  const surface = node('div', '', {class: 'pdf-surface'});
  element.append(status, surface);
  let job;

  function dispose() {
    if (!job) return;
    mobile.hidden = true;
    job.controller.abort();
    clearTimeout(job.timeout);
    job.app?.close().catch(() => {});
    job.frame?.remove();
    job = undefined;
  }

  function fail(code) {
    dispose();
    status.textContent = errors[code] || errors.worker;
    status.dataset.state = code;
  }

  async function load(input) {
    dispose();
    const current = {controller: new AbortController()};
    job = current;
    current.timeout = setTimeout(() => fail(current.phase === 'viewer' ? 'worker' : 'timeout'), 20000);
    status.textContent = tr('正在加载 PDF…', 'Loading PDF…');
    status.dataset.state = 'loading';
    try {
      const entry = (await registry()).get(input);
      if (job !== current) return;
      if (entry?.externalPdfUrl) {
        controls.append(node('a',tr('打开出版方 PDF ↗','Open publisher PDF ↗'),{href:officialURL(entry.externalPdfUrl),target:'_blank',rel:'noopener noreferrer'}));
      }
      const candidates = [entry?.mayPublishLocal ? entry.localPdfPath : null, entry?.remotePdfUrl].filter(Boolean);
      if (!candidates.length) throw Error('source');
      let data, selected;
      for (const candidate of candidates) {
        try {
          data = await bytesFor(candidate,current.controller.signal);
          if (!new TextDecoder().decode(data.subarray(0,1024)).includes('%PDF-')) throw Error('format');
          selected=candidate;
          break;
        } catch (error) {
          data=undefined;
          if (current.controller.signal.aborted || candidate===candidates.at(-1)) throw error;
        }
      }
      if (job !== current) return;
      current.phase = 'viewer';
      const url = new URL('vendor/pdfjs/web/viewer.html', root);
      url.searchParams.set('v', '4.1.1');
      url.searchParams.set('lang', zh ? 'zh' : 'en');
      url.searchParams.set('theme', document.documentElement.dataset.theme);
      current.data = data;
      current.name = paperURL(selected).pathname.split('/').pop();
      current.frame = node('iframe', '', {title: tr('PDF 正文和工具栏', 'PDF content and toolbar'), src: url.href});
      surface.replaceChildren(current.frame);
    } catch (error) {
      if (job === current) fail(error.message);
    }
  }

  async function onViewerMessage(event) {
    const current = job;
    if (!current?.frame || event.origin !== location.origin || event.source !== current.frame.contentWindow) return;
    if (event.data?.type === 'qisun-viewer-escape') {
      element.close();
      return;
    }
    if (event.data?.type !== 'qisun-viewer-ready' || current.app) return;
    current.app = event.source.PDFViewerApplication;
    try {
      current.app.eventBus.on('pagesinit', () => {
        if (job !== current) return;
        current.app.pdfViewer.currentScaleValue = 'page-width';

      }, {once: true});
      current.app.eventBus.on('pagerendered', () => {
        if (job !== current) return;
        clearTimeout(current.timeout);
        status.textContent = '';
        status.dataset.state = 'ready';
        mobile.hidden = false;
      }, {once: true});
      await current.app.open({data: current.data, filename: current.name, isEvalSupported: false});
      current.data = undefined;
    } catch (error) {
      if (job === current) fail(error.name === 'InvalidPDFException' ? 'format' : 'worker');
    }
  }
  window.addEventListener('message', onViewerMessage);
  element.addEventListener('close', () => {
    window.removeEventListener('message', onViewerMessage);
    dispose();
    activeReader = undefined;
  }, {once: true});
  load(link.dataset.paperId);
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-story], a[data-paper-id]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  event.preventDefault();
  if (link.hasAttribute('data-story')) openStory(link);
  else openReader(link);
});

