/**
 * Examples shell — categorized left nav, diagram-first iframe, styling playground.
 * Hash routes: #/playground | #/demo/<id>
 */
import { CATEGORIES, DEMOS, PLAYGROUND_BASE, VERSION } from './catalog.js';
import { THEMES } from '../src/themes.js';
import { ENUMS } from '../src/parse.js';
import { render as radiusRender } from '../dist/radius.js';

const THEME_IDS = Object.keys(THEMES);
const GROUNDS = [...ENUMS.GROUNDS];
const LOOKS = [...ENUMS.LOOKS];
const GLASS = [...(ENUMS.GLASS || ['frost', 'solid', 'none'])];
const FONTS = ['system', 'modern', 'display'];
const MOTIONS = [...ENUMS.MOTIONS];
const ROUTES = [...(ENUMS.ROUTES || ['ortho', 'curve', 'straight'])];
const FRAMES = [...ENUMS.FRAMES];

const state = {
  mode: 'demo', // 'demo' | 'playground'
  demoId: null,
  play: {
    theme: 'indigo',
    ground: 'dots',
    look: 'elevated',
    glass: 'frost',
    font: 'modern',
    motion: 'tasteful',
    route: 'curve',
    frame: 'system',
  },
};

const $ = (sel, root = document) => root.querySelector(sel);

function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '').trim();
  if (!raw || raw === 'playground' || raw.startsWith('playground')) {
    return { mode: 'playground', demoId: null };
  }
  const m = raw.match(/^(?:demo\/)?([\w-]+)/);
  const id = m?.[1];
  if (id && DEMOS[id]) return { mode: 'demo', demoId: id };
  // filename fallback
  const byFile = Object.values(DEMOS).find((d) => d.file === id || d.file === `${id}.html`);
  if (byFile) return { mode: 'demo', demoId: byFile.id };
  return { mode: 'demo', demoId: CATEGORIES.find((c) => c.demos)?.demos?.[0] || '20-mindmap' };
}

function setHash(mode, demoId) {
  const next = mode === 'playground' ? '#/playground' : `#/demo/${demoId}`;
  if (location.hash !== next) history.replaceState(null, '', next);
}

function buildNav(filter = '') {
  const nav = $('#gallery-nav');
  const q = filter.trim().toLowerCase();
  const parts = [];

  for (const cat of CATEGORIES) {
    if (cat.special === 'playground') {
      if (q && !`${cat.label} ${cat.hint || ''}`.toLowerCase().includes(q)) continue;
      parts.push(`
        <div class="nav-cat" data-cat="${cat.id}">
          <span class="nav-cat-label">${esc(cat.label)}</span>
          <ul>
            <li>
              <button type="button" class="nav-link is-special" data-route="playground">
                <strong>Style lab</strong>
                <span>${esc(cat.hint || 'Live theme & ground preview')}</span>
              </button>
            </li>
          </ul>
        </div>`);
      continue;
    }

    const items = (cat.demos || [])
      .map((id) => DEMOS[id])
      .filter(Boolean)
      .filter((d) => {
        if (!q) return true;
        const hay = `${d.title} ${d.blurb} ${(d.tags || []).join(' ')} ${cat.label}`.toLowerCase();
        return hay.includes(q);
      });
    if (!items.length) continue;

    parts.push(`
      <div class="nav-cat" data-cat="${cat.id}">
        <span class="nav-cat-label">${esc(cat.label)}</span>
        <ul>
          ${items
            .map(
              (d) => `
            <li>
              <button type="button" class="nav-link" data-route="demo" data-id="${esc(d.id)}">
                <strong>${esc(d.title)}</strong>
                <span>${esc(d.blurb)}</span>
              </button>
            </li>`,
            )
            .join('')}
        </ul>
      </div>`);
  }

  nav.innerHTML = parts.length
    ? parts.join('')
    : `<p class="nav-empty">No demos match “${esc(filter)}”.</p>`;

  nav.querySelectorAll('[data-route]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.route;
      if (route === 'playground') navigate('playground');
      else navigate('demo', btn.dataset.id);
      setNavOpen(false);
    });
  });

  syncNavActive();
}

function syncNavActive() {
  document.querySelectorAll('.nav-link').forEach((btn) => {
    const on =
      (state.mode === 'playground' && btn.dataset.route === 'playground') ||
      (state.mode === 'demo' && btn.dataset.id === state.demoId);
    btn.classList.toggle('is-active', !!on);
  });
}

const narrowQuery = window.matchMedia('(max-width: 1100px)');

function galleryEl() {
  return document.querySelector('.gallery');
}

function syncBackdrop() {
  const gallery = galleryEl();
  const open = !!(gallery?.classList.contains('nav-open') || gallery?.classList.contains('style-open'));
  const backdrop = $('#nav-backdrop');
  if (backdrop) backdrop.hidden = !open;
  document.body.classList.toggle('sheet-lock', open);
}

function setNavOpen(open) {
  const gallery = galleryEl();
  const toggle = $('#nav-toggle');
  gallery?.classList.toggle('nav-open', !!open);
  if (open) gallery?.classList.remove('style-open');
  if (toggle) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Hide examples' : 'Show examples');
  }
  const styleBtn = $('#style-toggle');
  if (styleBtn && open) styleBtn.setAttribute('aria-expanded', 'false');
  syncBackdrop();
}

function setStyleOpen(open) {
  const gallery = galleryEl();
  const toggle = $('#style-toggle');
  gallery?.classList.toggle('style-open', !!open);
  if (open) gallery?.classList.remove('nav-open');
  if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  const navBtn = $('#nav-toggle');
  if (navBtn && open) {
    navBtn.setAttribute('aria-expanded', 'false');
    navBtn.setAttribute('aria-label', 'Show examples');
  }
  syncBackdrop();
}

function syncChrome() {
  const narrow = narrowQuery.matches;
  const play = state.mode === 'playground';
  galleryEl()?.classList.toggle('is-playground', play);
  const styleBtn = $('#style-toggle');
  if (styleBtn) styleBtn.hidden = !(narrow && play);
  if (!narrow) {
    setNavOpen(false);
    setStyleOpen(false);
  }
}

function navigate(mode, demoId) {
  state.mode = mode;
  state.demoId = demoId || state.demoId;
  setHash(mode, state.demoId);
  if (mode !== 'playground') setStyleOpen(false);
  renderStage();
  syncNavActive();
  syncChrome();
}

/** Gallery iframe: hide the demo's own bar even when the page has no snippet script. */
function applyEmbed(frame) {
  let doc;
  try {
    doc = frame.contentDocument;
  } catch {
    return;
  }
  if (!doc?.body) return;
  doc.body.classList.add('embed');
  doc.querySelectorAll('details.snippet[open]').forEach((el) => el.removeAttribute('open'));
}

function bindFrame() {
  const frame = $('#stage-frame');
  if (!frame || frame.dataset.embedBound) return;
  frame.dataset.embedBound = '1';
  frame.addEventListener('load', () => applyEmbed(frame));
}

function renderStage() {
  const frame = $('#stage-frame');
  const play = $('#stage-playground');
  const title = $('#stage-title');
  const blurb = $('#stage-blurb');

  if (state.mode === 'playground') {
    frame.hidden = true;
    frame.removeAttribute('src');
    play.classList.add('is-visible');
    title.textContent = 'Styling playground';
    blurb.textContent = 'Browse themes and grounds — live preview updates as you change controls.';
    ensurePlaygroundBuilt();
    renderPlayground();
    return;
  }

  play.classList.remove('is-visible');
  frame.hidden = false;
  const demo = DEMOS[state.demoId];
  if (!demo) return;
  title.textContent = demo.title;
  blurb.textContent = demo.blurb;
  const src = `${demo.file}?embed=1`;
  if (frame.dataset.src !== src) {
    frame.dataset.src = src;
    frame.src = src;
  }
}

function ensurePlaygroundBuilt() {
  const host = $('#play-controls');
  if (!host || host.dataset.ready) return;
  host.dataset.ready = '1';

  const swatches = THEME_IDS.map((id) => {
    const t = THEMES[id];
    return `<button type="button" class="play-swatch" data-theme="${esc(id)}" title="${esc(id)}" style="--swatch:${esc(t.surface)}; background: linear-gradient(135deg, ${esc(t.surface)} 40%, ${esc(t.accent)} 100%)"></button>`;
  }).join('');

  host.innerHTML = `
    <div class="play-sheet-head">
      <h2>Style</h2>
      <button type="button" class="sheet-close" id="style-close">Close</button>
    </div>
    <h2>Palette</h2>
    <p class="palette-name" id="palette-name"></p>
    <div class="play-swatches palette-carousel" id="play-swatches">${swatches}</div>
    <div class="play-fields">
    ${field('theme', 'Theme', THEME_IDS, state.play.theme)}
    ${field('ground', 'Ground', GROUNDS, state.play.ground)}
    ${field('look', 'Look', LOOKS, state.play.look)}
    ${field('glass', 'Glass', GLASS, state.play.glass)}
    ${field('font', 'Font', FONTS, state.play.font)}
    ${field('motion', 'Motion', MOTIONS, state.play.motion)}
    ${field('route', 'Route', ROUTES, state.play.route)}
    ${field('frame', 'Frame', FRAMES, state.play.frame)}
    </div>
  `;

  host.querySelectorAll('select').forEach((sel) => {
    sel.addEventListener('change', () => {
      state.play[sel.name] = sel.value;
      if (sel.name === 'theme') syncSwatches({ recenter: true });
      renderPlayground();
    });
  });

  host.querySelectorAll('.play-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.play.theme = btn.dataset.theme;
      const sel = host.querySelector('select[name="theme"]');
      if (sel) sel.value = state.play.theme;
      syncSwatches({ recenter: true });
      renderPlayground();
    });
  });

  $('#style-close')?.addEventListener('click', () => setStyleOpen(false));
  bindPaletteCarousel();
  syncSwatches({ recenter: true });
}

function centerPalette(el, smooth) {
  const scroller = el?.parentElement;
  if (!scroller) return;
  const left = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
  scroller.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
}

function paletteAtCenter() {
  const scroller = $('#play-swatches');
  if (!scroller) return null;
  const mid = scroller.scrollLeft + scroller.clientWidth / 2;
  let best = null;
  let bestD = Infinity;
  scroller.querySelectorAll('.play-swatch').forEach((el) => {
    const c = el.offsetLeft + el.offsetWidth / 2;
    const d = Math.abs(c - mid);
    if (d < bestD) {
      bestD = d;
      best = el;
    }
  });
  return best;
}

function bindPaletteCarousel() {
  const scroller = $('#play-swatches');
  if (!scroller || scroller.dataset.carousel) return;
  scroller.dataset.carousel = '1';
  let timer = 0;
  const applyCenter = () => {
    if (!narrowQuery.matches) return;
    const el = paletteAtCenter();
    if (!el) return;
    const id = el.dataset.theme;
    scroller.querySelectorAll('.play-swatch').forEach((b) => {
      b.classList.toggle('is-active', b === el);
    });
    const name = $('#palette-name');
    if (name) name.textContent = id;
    if (!id || id === state.play.theme) return;
    state.play.theme = id;
    const sel = document.querySelector('#play-controls select[name="theme"]');
    if (sel) sel.value = id;
    renderPlayground();
  };
  scroller.addEventListener('scroll', () => {
    if (!narrowQuery.matches) return;
    const el = paletteAtCenter();
    if (el) {
      scroller.querySelectorAll('.play-swatch').forEach((b) => {
        b.classList.toggle('is-active', b === el);
      });
      const name = $('#palette-name');
      if (name) name.textContent = el.dataset.theme;
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(applyCenter, 70);
  }, { passive: true });
}

function field(name, label, values, current) {
  const opts = values
    .map((v) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`)
    .join('');
  return `<div class="play-field"><label for="play-${esc(name)}">${esc(label)}</label>
    <select id="play-${esc(name)}" name="${esc(name)}">${opts}</select></div>`;
}

function syncSwatches({ recenter = false } = {}) {
  document.querySelectorAll('.play-swatch').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.theme === state.play.theme);
  });
  const name = $('#palette-name');
  if (name) name.textContent = state.play.theme;
  if (recenter && narrowQuery.matches) {
    const el = document.querySelector(`.play-swatch[data-theme="${CSS.escape(state.play.theme)}"]`);
    requestAnimationFrame(() => centerPalette(el, false));
  }
}

function composePlayFence() {
  const p = state.play;
  const meta = [
    `theme: ${p.theme}`,
    `ground: ${p.ground}`,
    `look: ${p.look}`,
    `glass: ${p.glass}`,
    `font: ${p.font}`,
    `motion: ${p.motion}`,
    `route: ${p.route}`,
    `frame: ${p.frame}`,
  ].join('\n');
  // Strip meta keys from base so controls win
  const body = PLAYGROUND_BASE.replace(
    /^(theme|ground|look|glass|font|motion|route|frame|groundTone|groundtone)\s*:.*$/gim,
    '',
  ).trim();
  return `${meta}\n${body}`;
}

let playSeq = 0;

async function renderPlayground() {
  const mount = $('#play-mount');
  const source = $('#play-source-pre');
  const errEl = $('#play-error');
  if (!mount) return;
  const fence = composePlayFence();
  if (source) source.textContent = fence;
  const seq = ++playSeq;
  errEl?.classList.remove('is-visible');
  try {
    await radiusRender(mount, fence, { animate: false });
    if (seq !== playSeq) return;
  } catch (e) {
    if (seq !== playSeq) return;
    if (errEl) {
      errEl.textContent = e?.radius
        ? JSON.stringify({ path: e.path, fix: e.fix, see: e.see }, null, 2)
        : String(e?.message || e);
      errEl.classList.add('is-visible');
    }
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function init() {
  const ver = $('#gallery-version');
  if (ver) ver.textContent = VERSION;

  buildNav();
  bindFrame();
  $('#nav-search')?.addEventListener('input', (e) => buildNav(e.target.value));

  $('#nav-toggle')?.addEventListener('click', () => {
    setNavOpen(!galleryEl()?.classList.contains('nav-open'));
  });
  $('#nav-close')?.addEventListener('click', () => setNavOpen(false));
  $('#nav-backdrop')?.addEventListener('click', () => {
    setNavOpen(false);
    setStyleOpen(false);
  });
  $('#style-toggle')?.addEventListener('click', () => {
    setStyleOpen(!galleryEl()?.classList.contains('style-open'));
  });
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    setNavOpen(false);
    setStyleOpen(false);
  });
  narrowQuery.addEventListener('change', syncChrome);

  window.addEventListener('hashchange', () => {
    const next = parseHash();
    state.mode = next.mode;
    state.demoId = next.demoId;
    if (next.mode !== 'playground') setStyleOpen(false);
    renderStage();
    syncNavActive();
    syncChrome();
  });

  const start = parseHash();
  state.mode = start.mode;
  state.demoId = start.demoId || '20-mindmap';
  setHash(state.mode, state.demoId);
  renderStage();
  syncNavActive();
  syncChrome();
}

init();
