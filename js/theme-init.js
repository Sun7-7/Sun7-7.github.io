// Apply the saved preference before paint. New visitors always start in light mode.
document.documentElement.classList.add('js');
try {
  document.documentElement.dataset.theme = localStorage.getItem('theme') === 'dark' ? 'dark' : 'light';
} catch (_) {
  document.documentElement.dataset.theme = 'light';
}
