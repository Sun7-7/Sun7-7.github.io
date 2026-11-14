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
      for (const attr of ['href', 'src', 'data-pdf']) {
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
const pdfOrigin = 'https://raw.githubusercontent.com';
const supportedRemote = url => url.origin === pdfOrigin && /^\/mlresearch\/v\d+\/main\/assets\//.test(url.pathname);
const errors = {
  missing: tr('原文文件不存在（404）。', 'The PDF was not found (404).'),
  permission: tr('来源需要登录或拒绝访问。', 'The source requires sign-in or denied access.'),
  format: tr('来源返回的内容无法作为 PDF 打开。', 'The source did not return a readable PDF.'),
  network: tr('无法读取原文。请检查网络连接或跨域访问限制。', 'The source could not be reached. Check your connection or the source’s cross-origin policy.'),
  timeout: tr('加载超时。', 'Loading timed out.'),
  worker: tr('PDF.js 渲染组件未能启动。', 'The PDF.js rendering components could not start.'),
  size: tr('文件超过站内阅读器的 64 MB 上限。', 'This file exceeds the reader’s 64 MB limit.'),
  source: tr('此论文通过正式来源提供原文。你也可以打开本地 PDF。', 'Read this paper at its official source, or open a local PDF.'),
};

async function bytesFor(input, signal) {
  if (input instanceof File) {
    if (input.size > byteLimit) throw Error('size');
    return new Uint8Array(await input.arrayBuffer());
  }
  const url = new URL(input, location.href);
  if (url.origin !== location.origin && !supportedRemote(url)) throw Error('source');
  let response;
  try {
    response = await fetch(url, {signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer'});
  } catch {
    throw Error('network');
  }
  if (response.status === 404) throw Error('missing');
  if ([401, 403].includes(response.status)) throw Error('permission');
  if (!response.ok) throw Error('network');
  if (response.headers.get('content-type')?.includes('text/html')) throw Error('format');
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
  const header = element.querySelector('.reading-bar');
  const heading = header.querySelector('h2');
  const controls = node('div', '', {class: 'reading-tools'});
  const fileLabel = node('label', tr('打开本地 PDF（仅此设备）', 'Open local PDF (on this device)'));
  const file = node('input', '', {type: 'file', accept: '.pdf,application/pdf'});
  fileLabel.append(file);
  controls.append(node('span', link.dataset.venue || ''), node('a', tr('正式来源 ↗', 'Official source ↗'), {href: link.href, target: '_blank', rel: 'noopener noreferrer'}), fileLabel);
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
    heading.textContent = input instanceof File ? tr('本地文件 · ', 'Local file · ') + input.name : title;
    const current = {controller: new AbortController()};
    job = current;
    current.timeout = setTimeout(() => fail(current.phase === 'viewer' ? 'worker' : 'timeout'), 20000);
    status.textContent = tr('正在加载 PDF…', 'Loading PDF…');
    status.dataset.state = 'loading';
    try {
      const data = await bytesFor(input, current.controller.signal);
      if (job !== current) return;
      if (!new TextDecoder().decode(data.subarray(0, 1024)).includes('%PDF-')) throw Error('format');
      current.phase = 'viewer';
      const url = new URL('vendor/pdfjs/web/viewer.html', root);
      url.searchParams.set('lang', zh ? 'zh' : 'en');
      url.searchParams.set('theme', document.documentElement.dataset.theme);
      current.data = data;
      current.name = input instanceof File ? input.name : new URL(input, location.href).pathname.split('/').pop();
      current.frame = node('iframe', '', {title: tr('PDF 正文和工具栏', 'PDF content and toolbar'), src: url.href});
      surface.replaceChildren(current.frame);
    } catch (error) {
      if (job === current) fail(error.message);
    }
  }

  async function onViewerMessage(event) {
    const current = job;
    if (!current?.frame || event.origin !== location.origin || event.source !== current.frame.contentWindow) return;
    if (event.data?.type === 'qisun-viewer-open-local') {
      file.click();
      return;
    }
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
  file.addEventListener('change', () => {
    const selected = file.files[0];
    file.value = '';
    if (selected) load(selected);
  });
  element.addEventListener('close', () => {
    window.removeEventListener('message', onViewerMessage);
    dispose();
    activeReader = undefined;
  }, {once: true});
  if (link.dataset.pdf) load(link.dataset.pdf);
  else status.textContent = errors.source;
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[data-story], a[data-pdf]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  event.preventDefault();
  if (link.hasAttribute('data-story')) openStory(link);
  else openReader(link);
});
