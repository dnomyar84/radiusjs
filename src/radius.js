import { parse } from './parse.js';
import { layout, layoutReport } from './layout.js';
import { paint } from './paint.js';
import { bindInteract } from './interact.js';
import { THEME_IDS } from './themes.js';
import { ENUMS } from './parse.js';

export const version = '0.1.0';

const CSS_HREF = new URL('../dist/radius.css', import.meta.url).href;

function ensureCSS() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-radius-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.radiusCss = '1';
  document.head.appendChild(link);
}

function boardSize(el, frame) {
  const w = el.clientWidth || el.parentElement?.clientWidth || 960;
  const h = frame === 'slide' ? Math.round((w * 9) / 16) : Math.max(480, Math.round(w * 0.62));
  return { w: Math.max(640, w), h: Math.max(360, h) };
}

/**
 * Mount a Radius diagram into `el` from fence text or IR object.
 * @returns {{ spec, layout, interact, version }}
 */
export function render(el, source, opts = {}) {
  if (!el) throw new Error('Radius.render: missing element');
  ensureCSS();

  let spec;
  try {
    spec = typeof source === 'string' ? parse(source) : parse(JSON.stringify(source));
  } catch (e) {
    el.className = 'radius-root radius-error';
    el.innerHTML = `<pre class="radius-error-box">${escapeHtml(formatError(e))}</pre>`;
    throw e;
  }

  if (opts.theme) spec.theme = opts.theme;
  const size = opts.size || boardSize(el, spec.frame);
  const laid = layout(spec, size);
  paint(el, spec, laid);
  const interact = bindInteract(el, spec, laid);

  el._radius = { spec, layout: laid, interact, report: layoutReport(spec, laid), version };
  return el._radius;
}

export function mountAll(root = document) {
  ensureCSS();
  const nodes = root.querySelectorAll('pre.radius, [data-radius], code.language-radius');
  const out = [];
  nodes.forEach((node) => {
    const source = node.textContent;
    const host = document.createElement('div');
    host.className = 'radius-mount';
  // Dataset truncates poorly for huge fences — keep a JS copy too
  host._radiusSource = source;
  try {
    host.dataset.radiusSource = source;
  } catch {
    /* ignore dataset size limits */
  }
    node.replaceWith(host);
    try {
      const result = render(host, source);
      out.push(result);
      fillNearbySnippet(host, source);
    } catch {
      fillNearbySnippet(host, source);
    }
  });
  return out;
}

/** Fill a sibling "What the AI writes" panel if present. */
function fillNearbySnippet(host, source) {
  if (typeof document === 'undefined') return;
  const scope = host.parentElement || document;
  const panel = scope.querySelector('details.snippet pre, .radius-snippet pre, [data-radius-snippet]');
  if (panel && source) panel.textContent = source.trim();
}

function autoMount() {
  if (typeof document === 'undefined') return;
  const run = () => mountAll(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}

export function help() {
  return {
    version,
    learn: 'RADIUS.md',
    themes: THEME_IDS,
    templates: [...ENUMS.TEMPLATES],
    grounds: [...ENUMS.GROUNDS],
    pin: 'Never use @latest — pin major.minor.patch in the script URL.',
  };
}

function formatError(e) {
  if (e && e.radius) {
    return JSON.stringify({ path: e.path, fix: e.fix, see: e.see }, null, 2);
  }
  return String(e?.message || e);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export { parse, layout, layoutReport, paint, bindInteract };

export const Radius = { version, render, mountAll, help, parse, layout };

if (typeof window !== 'undefined') {
  window.Radius = Radius;
  autoMount();
}

export default Radius;
