/** Fill "What the AI writes" from the mounted fence (Radius stashes it on the host). */
function fill() {
  const hosts = document.querySelectorAll('.radius-mount[data-radius-source], .radius-root[data-radius-source]');
  hosts.forEach((host) => {
    const source = host.dataset.radiusSource;
    if (!source) return;
    const scope = host.parentElement || document;
    const panel = scope.querySelector('details.snippet pre, .radius-snippet pre, [data-radius-snippet]');
    if (panel) panel.textContent = source.trim();
  });
  // Fallback: single-demo pages
  if (!hosts.length) {
    const host = document.querySelector('.radius-mount, .radius-root');
    const panel = document.querySelector('details.snippet pre');
    if (host?.dataset?.radiusSource && panel) {
      panel.textContent = host.dataset.radiusSource.trim();
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(fill, 0));
} else {
  setTimeout(fill, 0);
}
