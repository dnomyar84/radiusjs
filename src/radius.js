import { parse } from './parse.js';
import { layout, layoutAsync, layoutReport } from './layout.js';
import { paint, applyWiresFilter } from './paint.js';
import { bindInteract } from './interact.js';
import { applyUserSizes } from './resize.js';
import { THEME_IDS } from './themes.js';
import { ENUMS, normalizeWires, wireVisible } from './parse.js';
import { snapshotFlip, playFlip, prefersReducedMotion } from './flip.js';

export const version = '0.5.0';

const CSS_HREF = new URL('../dist/radius.css', import.meta.url).href;
/** Wait for appear stagger before allowing any reflow */
const APPEAR_GRACE_MS = 1800;

function ensureCSS() {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-radius-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = CSS_HREF;
  link.dataset.radiusCss = '1';
  document.head.appendChild(link);
}

/** Board size from the host. Narrow screens use the host’s height so the diagram fills the phone. */
export function boardSize(el, frame) {
  const raw =
    el.clientWidth ||
    el.parentElement?.clientWidth ||
    (typeof window !== 'undefined' ? Math.min(1100, window.innerWidth - 32) : 960);
  const w = Math.max(280, Math.round(raw));
  // Playground preview: the rails already reserved their rows, so the board
  // must use the leftover host box instead of a ratio that overflows them.
  if (el?.dataset?.fitBoard === 'host') {
    const hostH = Math.round(el.clientHeight || el.parentElement?.clientHeight || 0);
    if (hostH >= 80) return { w, h: hostH };
  }
  if (frame === 'slide') {
    return { w, h: Math.max(180, Math.round((w * 9) / 16)) };
  }
  const ratioH = Math.max(
    280,
    Math.round(w * Math.min(0.85, Math.max(0.55, 640 / Math.max(w, 1)))),
  );
  const narrow = typeof window !== 'undefined' && window.innerWidth <= 1100;
  if (narrow && document.body?.classList.contains('embed')) {
    const viewH = Math.round(window.innerHeight || 0);
    if (viewH >= 220) return { w, h: viewH };
  }
  if (narrow) {
    const hostH = Math.round(el.clientHeight || el.parentElement?.clientHeight || 0);
    if (hostH >= 220) return { w, h: hostH };
  }
  return { w, h: ratioH };
}

function snapshotFoldState(el) {
  const groups = {};
  const nodes = {};
  el.querySelectorAll('.radius-group[data-id]').forEach((g) => {
    groups[g.dataset.id] = g.dataset.collapsed === 'true';
  });
  el.querySelectorAll('.radius-node[data-expandable="true"]').forEach((n) => {
    nodes[n.dataset.id] = n.dataset.collapsed === 'true';
  });
  return { groups, nodes, storyIndex: el._radius?.interact?.index?.() ?? -1 };
}

function restoreFoldState(spec, laid, snap) {
  if (!snap) return;
  for (const [id, collapsed] of Object.entries(snap.groups || {})) {
    const box = laid.groupBoxes?.[id];
    if (!box || !box.expandable) continue;
    box.collapsed = collapsed;
    box.h = collapsed ? box.hCollapsed : box.hExpanded;
    box.w = collapsed ? (box.wCollapsed ?? box.w) : (box.wExpanded ?? box.w);
    box.x = collapsed ? (box.xCollapsed ?? box.x) : (box.xExpanded ?? box.x);
  }
  for (const [id, collapsed] of Object.entries(snap.nodes || {})) {
    const box = laid.boxes?.[id];
    if (!box?.expandable) continue;
    box.collapsed = collapsed;
    box.h = collapsed ? box.hCollapsed : box.hExpanded;
  }
  for (const g of spec.groups || []) {
    if (snap.groups[g.id] != null) g.collapsed = snap.groups[g.id];
  }
  for (const n of spec.nodes || []) {
    if (snap.nodes[n.id] != null) n.collapsed = snap.nodes[n.id];
  }
}

/** After expand/collapse, re-layout so parents and siblings make space. */
function foldHooks(el, opts = {}) {
  return {
    onFoldChange(focusId) {
      if (el._radius?._reflowing) return;
      if (el._radius) el._radius._reflowing = true;
      const board = el.querySelector('.radius-board');
      const snap =
        board && !prefersReducedMotion() && el._radius?.spec?.motion !== 'none'
          ? snapshotFlip(board)
          : null;
      el.classList.add('is-reflowing');
      reflow(el, {
        ...el._radius?.opts,
        ...opts,
        keepObserver: true,
        quiet: true,
        force: true, // same viewport size, but fold state changed
      })
        .then(() => {
          el.classList.remove('is-reflowing');
          const nextBoard = el.querySelector('.radius-board');
          if (snap && nextBoard) playFlip(nextBoard, snap, { focusId: focusId || null });
        })
        .catch(() => {
          el.classList.remove('is-reflowing');
        })
        .finally(() => {
          if (el._radius) el._radius._reflowing = false;
        });
    },
  };
}

/**
 * Window resize, and the playground host box.
 * Never observe the board itself — paint changes its height and would loop.
 */
function bindResize(el, opts = {}) {
  if (typeof window === 'undefined') return () => {};

  const metricH = () =>
    el.dataset.fitBoard === 'host' ? el.clientHeight || 0 : window.innerHeight || 0;

  const state = {
    lastW: el.clientWidth || 0,
    lastH: metricH(),
    timer: 0,
    busy: false,
    readyAt: Date.now() + APPEAR_GRACE_MS,
  };

  const sizeChanged = (w, h) => {
    const widthChanged = Math.abs(w - state.lastW) >= 24;
    const heightChanged =
      el.dataset.fitBoard === 'host'
        ? Math.abs(h - state.lastH) >= 24
        : document.body?.classList.contains('embed') && Math.abs(h - state.lastH) >= 48;
    return widthChanged || heightChanged;
  };

  const onWin = () => {
    const fit = el.dataset.fitBoard === 'host';
    if (!fit && Date.now() < state.readyAt) return;
    if (state.busy || el._radius?._reflowing) return;
    const w = el.clientWidth || 0;
    const h = metricH();
    if (!w || !sizeChanged(w, h)) return;
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      if (!fit && Date.now() < state.readyAt) return;
      if (state.busy || el._radius?._reflowing) return;
      const nextW = el.clientWidth || 0;
      const nextH = metricH();
      if (!nextW || !sizeChanged(nextW, nextH)) return;

      state.busy = true;
      if (el._radius) el._radius._reflowing = true;
      reflow(el, { ...el._radius?.opts, ...opts, keepObserver: true, quiet: true })
        .then(() => {
          state.lastW = el.clientWidth || nextW;
          state.lastH = metricH();
        })
        .catch(() => {})
        .finally(() => {
          state.busy = false;
          if (el._radius) el._radius._reflowing = false;
        });
    }, 220);
  };

  window.addEventListener('resize', onWin, { passive: true });
  const vv = el.dataset.fitBoard === 'host' ? window.visualViewport : null;
  if (vv) {
    vv.addEventListener('resize', onWin, { passive: true });
    vv.addEventListener('scroll', onWin, { passive: true });
  }
  // Host box only — the board itself must not be observed (paint changes it).
  let ro = null;
  if (el.dataset.fitBoard === 'host' && typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => onWin());
    ro.observe(el);
  }
  el._radiusResize = state;
  return () => {
    window.clearTimeout(state.timer);
    window.removeEventListener('resize', onWin);
    if (vv) {
      vv.removeEventListener('resize', onWin);
      vv.removeEventListener('scroll', onWin);
    }
    ro?.disconnect();
    el._radiusResize = null;
  };
}

/**
 * Recompute layout for current host width.
 * Checks size BEFORE destroying interact so appear fade-in is not aborted.
 */
export async function reflow(el, opts = {}) {
  const prev = el._radius;
  if (!prev?.spec) return null;

  const size = opts.size || boardSize(el, prev.spec.frame);
  const prevBoard = prev.layout?.board;
  // Skip only for resize no-ops — fold changes must always re-pack (force)
  if (
    !opts.force &&
    prevBoard &&
    Math.abs(prevBoard.w - size.w) < 24 &&
    Math.abs(prevBoard.h - size.h) < 24
  ) {
    return prev;
  }

  const snap = snapshotFoldState(el);
  // Apply fold state to spec BEFORE layout so parents shrink/grow with children
  for (const g of prev.spec.groups || []) {
    if (snap.groups[g.id] != null) g.collapsed = snap.groups[g.id];
  }
  for (const n of prev.spec.nodes || []) {
    if (snap.nodes[n.id] != null) n.collapsed = snap.nodes[n.id];
  }

  prev.interact?.destroy?.();
  if (!opts.keepObserver) prev._unresize?.();

  const laid = opts.sync ? layout(prev.spec, size) : await layoutAsync(prev.spec, size);
  restoreFoldState(prev.spec, laid, snap);
  applyUserSizes(prev.spec, laid, prev.userSizes);
  const paintSpec = opts.quiet ? { ...prev.spec, motion: 'none' } : prev.spec;
  paint(el, paintSpec, laid);
  const interact = bindInteract(el, paintSpec, laid, foldHooks(el, opts));
  // Restore story visuals without re-folding — fold state already painted
  if (snap.storyIndex >= 0) interact.step?.(snap.storyIndex, { folds: false });

  const unresize = opts.keepObserver
    ? prev._unresize
    : opts.noResize
      ? () => {}
      : bindResize(el, opts);

  el._radius = {
    spec: prev.spec,
    layout: laid,
    interact,
    report: layoutReport(prev.spec, laid),
    version,
    _unresize: unresize,
    source: prev.source,
    opts: prev.opts,
    userSizes: prev.userSizes || {},
    _reflowing: false,
  };
  return el._radius;
}

/**
 * Mount a Radius diagram into `el`.
 * Responsive via window resize after appear grace period.
 */
export async function render(el, source, opts = {}) {
  if (!el) throw new Error('Radius.render: missing element');
  ensureCSS();

  el._radius?.interact?.destroy?.();
  el._radius?._unresize?.();

  let spec;
  try {
    spec = typeof source === 'string' ? parse(source) : parse(JSON.stringify(source));
  } catch (e) {
    el.className = 'radius-root radius-error';
    el.innerHTML = `<pre class="radius-error-box">${escapeHtml(formatError(e))}</pre>`;
    throw e;
  }

  if (opts.theme) spec.theme = opts.theme;
  if (opts.engine) spec.engine = opts.engine;
  // Playground rails skin an imported diagram without rewriting its text.
  for (const key of ['ground', 'look', 'glass', 'font', 'motion', 'route', 'frame']) {
    if (opts[key]) spec[key] = opts[key];
  }

  el.style.width = '100%';
  el.style.maxWidth = '100%';
  el.style.boxSizing = 'border-box';

  if (typeof requestAnimationFrame !== 'undefined' && !opts.size) {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  const size = opts.size || boardSize(el, spec.frame);
  const laid = opts.sync ? layout(spec, size) : await layoutAsync(spec, size);
  const userSizes = el._radius?.userSizes || opts.userSizes || {};
  applyUserSizes(spec, laid, userSizes);
  paint(el, spec, laid);
  const interact = bindInteract(el, spec, laid, foldHooks(el, opts));
  const unresize = opts.noResize ? () => {} : bindResize(el, opts);

  el._radius = {
    spec,
    layout: laid,
    interact,
    report: layoutReport(spec, laid),
    version,
    _unresize: unresize,
    source,
    opts,
    userSizes,
    _reflowing: false,
  };
  return el._radius;
}

export function renderSync(el, source, opts = {}) {
  return render(el, source, { ...opts, sync: true });
}

function applyEmbedClass() {
  if (typeof document === 'undefined' || !document.body) return;
  try {
    if (new URLSearchParams(location.search).has('embed')) document.body.classList.add('embed');
  } catch {
    /* ignore */
  }
}

export async function mountAll(root = document) {
  applyEmbedClass();
  ensureCSS();
  const nodes = root.querySelectorAll(
    'pre.radius, pre.mermaid, [data-radius], code.language-radius, code.language-mermaid',
  );
  const out = [];
  for (const node of nodes) {
    const source = node.textContent;
    const host = document.createElement('div');
    host.className = 'radius-mount';
    host._radiusSource = source;
    try {
      host.dataset.radiusSource = source;
    } catch {
      /* ignore */
    }
    node.replaceWith(host);
    try {
      const result = await render(host, source);
      out.push(result);
      fillNearbySnippet(host, source);
    } catch {
      fillNearbySnippet(host, source);
    }
  }
  return out;
}

function fillNearbySnippet(host, source) {
  if (typeof document === 'undefined') return;
  const scope = host.parentElement || document;
  const panel = scope.querySelector('details.snippet pre, .radius-snippet pre, [data-radius-snippet]');
  if (panel && source) panel.textContent = source.trim();
}

function autoMount() {
  if (typeof document === 'undefined') return;
  const run = () => {
    applyEmbedClass();
    mountAll(document).catch(() => {});
  };
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
    glass: [...(ENUMS.GLASS || ['frost', 'solid', 'none'])],
    wires: 'all | off | <wire names> — edge groups via wire:name on edges',
    layers: {
      architecture: [...ENUMS.ARCH_LAYERS],
      time: [...ENUMS.TIME_LAYERS],
    },
    layout: {
      omit: 'Default — Radius auto-layouts (template flow).',
      coarse: 'template: + optional dir:',
      hints: 'rank, order, lane, span on nodes; never x/y or font-size',
      engine: 'auto|elk|native',
      responsive: 'window resize reflows after appear grace; no ResizeObserver on board',
    },
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

export { parse, layout, layoutAsync, layoutReport, paint, bindInteract, applyWiresFilter, normalizeWires, wireVisible };

export const Radius = {
  version,
  render,
  renderSync,
  reflow,
  mountAll,
  help,
  parse,
  layout,
  layoutAsync,
  boardSize,
  applyWiresFilter,
  normalizeWires,
  wireVisible,
};

if (typeof window !== 'undefined') {
  window.Radius = Radius;
  autoMount();
}

export default Radius;
