/* Host integration for Mozilla PDF.js. Runs before the upstream viewer module. */
const viewerUrl = new URL(location.href);
for (const key of [...viewerUrl.searchParams.keys()]) {
  if (key !== 'lang' && key !== 'theme' && key !== 'v') viewerUrl.searchParams.delete(key);
}
history.replaceState(null, '', viewerUrl.pathname + viewerUrl.search);
const readerParams = new URLSearchParams(location.search);
const readerLang = readerParams.get('lang') === 'en' ? 'en-US' : 'zh-CN';
document.documentElement.lang = readerLang;
document.documentElement.dataset.theme = readerParams.get('theme') === 'dark' ? 'dark' : 'light';
const hostDocument = window.parent.document;
function configureReader(event) {
  if (event.detail.source !== window) return;
  hostDocument.removeEventListener('webviewerloaded', configureReader);
  const options = window.PDFViewerApplicationOptions;
  options.setAll({
    defaultUrl: '', disablePreferences: true, disableHistory: true,
    localeProperties: {lang: readerLang}, viewerCssTheme: document.documentElement.dataset.theme === 'dark' ? 2 : 1,
    enableScripting: false, enableMerge: false, enableSplitMerge: false, annotationEditorMode: -1, enableSignatureEditor: false,
    enablePermissions: true, externalLinkTarget: 2,
  });
  window.PDFViewerApplication.initializedPromise.then(() => {
    parent.postMessage({type: 'qisun-viewer-ready'}, location.origin);
  });
}
hostDocument.addEventListener('webviewerloaded', configureReader);
addEventListener('pagehide', () => hostDocument.removeEventListener('webviewerloaded', configureReader));
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || event.defaultPrevented ||
      !document.getElementById('findbar')?.classList.contains('hidden') ||
      document.querySelector('dialog[open]') ||
      document.getElementById('secondaryToolbar')?.classList.contains('toggled')) return;
  parent.postMessage({type: 'qisun-viewer-escape'}, location.origin);
}, {capture: true});

// Prevent file drops from navigating away from the paper.
for (const type of ['drop','dragover']) {
  document.addEventListener(type, event => {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, {capture: true});
}
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') {
    event.preventDefault();
    event.stopImmediatePropagation();

  }
}, {capture: true});
