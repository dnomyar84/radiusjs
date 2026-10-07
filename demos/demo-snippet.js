/**
 * Demo page chrome: fill "What the AI writes", collapse by default,
 * and enter embed mode when loaded in the gallery iframe (?embed=1).
 */
function isEmbed() {
  try {
    return new URLSearchParams(location.search).has('embed');
  } catch {
    return false;
  }
}

function applyEmbed() {
  if (!isEmbed()) return;
  document.body.classList.add('embed');
  document.querySelectorAll('details.snippet[open]').forEach((el) => {
    el.removeAttribute('open');
  });
}

/** Fill "What the AI writes" from the mounted fence (Radius stashes it on the host). */
function fill() {
  const hosts = document.querySelectorAll(
    '.radius-mount[data-radius-source], .radius-root[data-radius-source]',
  );
  hosts.forEach((host) => {
    const source = host.dataset.radiusSource;
    if (!source) return;
    const scope = host.parentElement || document;
    const panel = scope.querySelector(
      'details.snippet pre, .radius-snippet pre, [data-radius-snippet]',
    );
    if (panel) panel.textContent = source.trim();
  });
  if (!hosts.length) {
    const host = document.querySelector('.radius-mount, .radius-root');
    const panel = document.querySelector('details.snippet pre');
    if (host?.dataset?.radiusSource && panel) {
      panel.textContent = host.dataset.radiusSource.trim();
    }
  }
}

function boot() {
  applyEmbed();
  // Keep snippets collapsed unless the user opens them (diagram-first).
  document.querySelectorAll('details.snippet[open]').forEach((el) => {
    if (isEmbed() || !el.hasAttribute('data-keep-open')) el.removeAttribute('open');
  });
  fill();
  // Radius mounts async — retry briefly for source fill
  let n = 0;
  const t = setInterval(() => {
    fill();
    if (++n > 12) clearInterval(t);
  }, 120);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
