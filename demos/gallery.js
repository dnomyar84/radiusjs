/**
 * Examples shell — categorized left nav, diagram-first iframe, styling playground.
 * Hash routes: #/playground | #/demo/<id>
 */
import { BEAUTY_PRESETS, CATEGORIES, DEMOS, STYLE_PRESETS, VERSION } from './catalog.js';
import { THEMES } from '../src/themes.js';
import { ENUMS } from '../src/parse.js';
import { reflow as radiusReflow, render as radiusRender } from '../dist/radius.js';

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
    beauty: 'indigo',
    style: 'mindmap',
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

/* Drawer + snap rails: phone, including landscape. Tablet and laptop keep the list open. */
const narrowQuery = window.matchMedia('(max-width: 759px), (max-height: 499px)');

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
    blurb.textContent = 'Snap a look, then a diagram style. The source stays folded until you open it.';
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

  const swatches = BEAUTY_PRESETS.map((preset) => {
    const t = THEMES[preset.theme];
    const caption = beautyCaption(preset);
    return `<button type="button" class="play-swatch" data-beauty="${esc(preset.id)}" title="${esc(caption)}" style="--swatch:${esc(t.surface)}; background: linear-gradient(135deg, ${esc(t.surface)} 40%, ${esc(t.accent)} 100%)"></button>`;
  }).join('');

  const styles = STYLE_PRESETS.map(
    (preset) =>
      `<button type="button" class="play-style" data-style="${esc(preset.id)}">${esc(preset.label)}</button>`,
  ).join('');

  host.innerHTML = `
    <div class="play-sheet-head">
      <h2>Style</h2>
      <button type="button" class="sheet-close" id="style-close">Close</button>
    </div>
    <section class="play-rail" data-rail="beauty">
      <h2>Beauty</h2>
      <p class="play-rail-name" id="beauty-name"></p>
      <div class="play-swatches play-carousel" id="beauty-carousel">${swatches}</div>
    </section>
    <section class="play-rail" data-rail="style">
      <h2>Diagram</h2>
      <p class="play-rail-name" id="style-name"></p>
      <div class="play-styles play-carousel" id="style-carousel">${styles}</div>
    </section>
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
      if (sel.name === 'theme' || sel.name === 'ground') {
        const match = BEAUTY_PRESETS.find(
          (p) => p.theme === state.play.theme && p.ground === state.play.ground,
        );
        if (match) state.play.beauty = match.id;
      }
      syncRails({ recenter: true });
      renderPlayground();
    });
  });

  host.querySelectorAll('.play-swatch').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyBeauty(btn.dataset.beauty, { recenter: true });
    });
  });

  host.querySelectorAll('.play-style').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyStyle(btn.dataset.style, { recenter: true });
    });
  });

  $('#style-close')?.addEventListener('click', () => setStyleOpen(false));
  bindSnapCarousel($('#beauty-carousel'), '.play-swatch', (el) => applyBeauty(el.dataset.beauty));
  bindSnapCarousel($('#style-carousel'), '.play-style', (el) => applyStyle(el.dataset.style));
  syncRails({ recenter: true });
}

function beautyCaption(preset) {
  return preset ? `${preset.label} · ${preset.ground}` : '';
}

function applyBeauty(id, { recenter = false } = {}) {
  const preset = BEAUTY_PRESETS.find((p) => p.id === id);
  if (!preset || preset.id === state.play.beauty) {
    syncRails({ recenter });
    return;
  }
  state.play.beauty = preset.id;
  state.play.theme = preset.theme;
  state.play.ground = preset.ground;
  syncRails({ recenter });
  renderPlayground();
}

function applyStyle(id, { recenter = false } = {}) {
  const preset = STYLE_PRESETS.find((p) => p.id === id);
  if (!preset || preset.id === state.play.style) {
    syncRails({ recenter });
    return;
  }
  state.play.style = preset.id;
  if (preset.route) state.play.route = preset.route;
  syncRails({ recenter });
  renderPlayground();
}

function centerItem(el, smooth) {
  const scroller = el?.parentElement;
  if (!scroller) return;
  const left = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
  scroller.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
}

function itemAtCenter(scroller, itemSel) {
  if (!scroller) return null;
  const mid = scroller.scrollLeft + scroller.clientWidth / 2;
  let best = null;
  let bestD = Infinity;
  scroller.querySelectorAll(itemSel).forEach((el) => {
    const c = el.offsetLeft + el.offsetWidth / 2;
    const d = Math.abs(c - mid);
    if (d < bestD) {
      bestD = d;
      best = el;
    }
  });
  return best;
}

function bindSnapCarousel(scroller, itemSel, pick) {
  if (!scroller || scroller.dataset.carousel) return;
  scroller.dataset.carousel = '1';
  let timer = 0;
  const preview = () => {
    const el = itemAtCenter(scroller, itemSel);
    if (!el) return;
    scroller.querySelectorAll(itemSel).forEach((b) => {
      b.classList.toggle('is-active', b === el);
    });
    const rail = scroller.closest('.play-rail');
    const name = rail?.querySelector('.play-rail-name');
    if (name) name.textContent = el.dataset.beauty
      ? beautyCaption(BEAUTY_PRESETS.find((p) => p.id === el.dataset.beauty))
      : el.textContent;
  };
  scroller.addEventListener('scroll', () => {
    if (!narrowQuery.matches) return;
    preview();
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      const el = itemAtCenter(scroller, itemSel);
      if (el) pick(el);
    }, 70);
  }, { passive: true });
}

function field(name, label, values, current) {
  const opts = values
    .map((v) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`)
    .join('');
  return `<div class="play-field"><label for="play-${esc(name)}">${esc(label)}</label>
    <select id="play-${esc(name)}" name="${esc(name)}">${opts}</select></div>`;
}

function syncRails({ recenter = false } = {}) {
  const beauty = BEAUTY_PRESETS.find((p) => p.id === state.play.beauty);
  const style = STYLE_PRESETS.find((p) => p.id === state.play.style);
  document.querySelectorAll('.play-swatch').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.beauty === state.play.beauty);
  });
  document.querySelectorAll('.play-style').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.style === state.play.style);
  });
  const beautyName = $('#beauty-name');
  if (beautyName) beautyName.textContent = beautyCaption(beauty);
  const styleName = $('#style-name');
  if (styleName) styleName.textContent = style?.label || '';
  for (const name of ['theme', 'ground', 'look', 'glass', 'font', 'motion', 'route', 'frame']) {
    const sel = document.querySelector(`#play-controls select[name="${name}"]`);
    if (sel && state.play[name] && sel.value !== state.play[name]) sel.value = state.play[name];
  }
  if (recenter && narrowQuery.matches) {
    const beautyEl = document.querySelector(`.play-swatch[data-beauty="${CSS.escape(state.play.beauty)}"]`);
    const styleEl = document.querySelector(`.play-style[data-style="${CSS.escape(state.play.style)}"]`);
    requestAnimationFrame(() => {
      if (beautyEl) centerItem(beautyEl, false);
      if (styleEl) centerItem(styleEl, false);
    });
  }
}

function composePlayFence() {
  const p = state.play;
  const style = STYLE_PRESETS.find((s) => s.id === p.style) || STYLE_PRESETS[0];
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
  // Strip meta keys from the style sample so the rails win.
  const body = String(style.fence || '').replace(
    /^(theme|ground|look|glass|font|motion|route|frame|groundTone|groundtone)\s*:.*$/gim,
    '',
  ).trim();
  return `${meta}\n${body}`;
}

let playSeq = 0;

/** First measure can run before the rail rows settle. Repaint to the leftover box. */
async function fitPlayBoard(mount, seq) {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (seq !== playSeq || !mount) return;
  const painted = Number.parseFloat(mount.style.getPropertyValue('--radius-board-h')) || 0;
  const hostH = mount.clientHeight || 0;
  const hostW = mount.clientWidth || 0;
  const paintedW = Number.parseFloat(mount.style.getPropertyValue('--radius-board-w')) || 0;
  if (hostH < 80 || hostW < 80) return;
  if (Math.abs(hostH - painted) < 24 && Math.abs(hostW - paintedW) < 24) return;
  await radiusReflow(mount, { keepObserver: true, quiet: true, force: true });
}

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
    await fitPlayBoard(mount, seq);
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

function syncVisualViewport() {
  const vv = window.visualViewport;
  const h = Math.round(vv?.height || window.innerHeight || 0);
  const top = Math.round(vv?.offsetTop || 0);
  if (h > 0) document.documentElement.style.setProperty('--g-vvh', `${h}px`);
  document.documentElement.style.setProperty('--g-vv-top', `${top}px`);
}

function init() {
  syncVisualViewport();
  window.visualViewport?.addEventListener('resize', syncVisualViewport, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncVisualViewport, { passive: true });
  window.addEventListener('resize', syncVisualViewport, { passive: true });

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
