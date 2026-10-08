/**
 * Examples shell — categorized left nav, diagram-first iframe, styling playground.
 * Hash routes: #/playground | #/demo/<id>
 */
import { CATEGORIES, DEMOS, PLAYGROUND_BASE, VERSION, colorPresets } from './catalog.js';
import { THEMES } from '../src/themes.js';
import { reflow as radiusReflow, render as radiusRender } from '../dist/radius.js';

const COLOR_PRESETS = colorPresets();

const state = {
  mode: 'demo', // 'demo' | 'playground'
  demoId: null,
  play: {
    theme: 'indigo',
    custom: null,
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
                <span>${esc(cat.hint || 'Paste Radius or Mermaid · color only')}</span>
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
    blurb.textContent = 'Paste Radius or Mermaid. The rails change color only.';
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

  const swatches = COLOR_PRESETS.map((preset) => {
    const t = THEMES[preset.theme];
    return `<button type="button" class="play-swatch" data-color="${esc(preset.id)}" title="${esc(preset.label)}" aria-label="${esc(preset.label)}" style="--swatch:${esc(t.surface)}; background: linear-gradient(135deg, ${esc(t.surface)} 40%, ${esc(t.accent)} 100%)"></button>`;
  }).join('');

  const names = COLOR_PRESETS.map(
    (preset) =>
      `<button type="button" class="play-style" data-color="${esc(preset.id)}">${esc(preset.label)}</button>`,
  ).join('');

  host.innerHTML = `
    <div class="play-sheet-head">
      <h2>Color</h2>
      <button type="button" class="sheet-close" id="style-close">Close</button>
    </div>
    <section class="play-rail" data-rail="swatch">
      <h2>Color</h2>
      <p class="play-rail-name" id="color-swatch-name"></p>
      <div class="play-swatches play-carousel" id="beauty-carousel">${swatches}</div>
    </section>
    <section class="play-rail" data-rail="name">
      <h2>Color</h2>
      <p class="play-rail-name" id="color-name-name"></p>
      <div class="play-styles play-carousel" id="style-carousel">${names}</div>
    </section>
  `;

  host.querySelectorAll('[data-color]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyColor(btn.dataset.color, { recenter: 'all' });
    });
  });

  $('#style-close')?.addEventListener('click', () => setStyleOpen(false));
  bindSnapCarousel($('#beauty-carousel'), '[data-color]', (el) =>
    applyColor(el.dataset.color, { recenter: 'other', from: el.parentElement }),
  );
  bindSnapCarousel($('#style-carousel'), '[data-color]', (el) =>
    applyColor(el.dataset.color, { recenter: 'other', from: el.parentElement }),
  );
  syncRails({ recenter: 'all' });
}

function colorPreset(id) {
  return COLOR_PRESETS.find((p) => p.id === id);
}

function applyColor(id, { recenter = false, from = null } = {}) {
  const preset = colorPreset(id);
  if (!preset) {
    syncRails({ recenter, from });
    return;
  }
  const changed = preset.theme !== state.play.theme;
  state.play.theme = preset.theme;
  syncRails({ recenter, from });
  if (changed) renderPlayground();
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
    if (name) name.textContent = colorPreset(el.dataset.color)?.label || el.textContent || '';
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

function syncRails({ recenter = false, from = null } = {}) {
  const preset = colorPreset(state.play.theme) || COLOR_PRESETS[0];
  const label = preset?.label || '';
  document.querySelectorAll('#play-controls [data-color]').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.color === state.play.theme);
    if (b.classList.contains('play-style')) b.setAttribute('aria-pressed', b.classList.contains('is-active') ? 'true' : 'false');
  });
  const swatchName = $('#color-swatch-name');
  const chipName = $('#color-name-name');
  if (swatchName) swatchName.textContent = label;
  if (chipName) chipName.textContent = label;
  if (!recenter || !narrowQuery.matches) return;
  const theme = state.play.theme;
  requestAnimationFrame(() => {
    document.querySelectorAll(`#play-controls [data-color="${CSS.escape(theme)}"]`).forEach((el) => {
      if (recenter === 'other' && from && el.parentElement === from) return;
      centerItem(el, false);
    });
  });
}

function playSource() {
  return state.play.custom != null ? state.play.custom : PLAYGROUND_BASE;
}

let playTimer = 0;

function bindSourceEditor() {
  const area = $('#play-source-edit');
  const box = document.querySelector('.play-source');
  if (box && !box.dataset.ready) {
    box.dataset.ready = '1';
    box.open = !narrowQuery.matches;
  }
  if (!area || area.dataset.bound) return;
  area.dataset.bound = '1';
  area.addEventListener('input', () => {
    state.play.custom = area.value;
    window.clearTimeout(playTimer);
    playTimer = window.setTimeout(() => renderPlayground(), 160);
  });
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
  const errEl = $('#play-error');
  if (!mount) return;
  bindSourceEditor();
  const fence = playSource();
  const area = $('#play-source-edit');
  if (area && document.activeElement !== area && area.value !== fence) area.value = fence;
  const seq = ++playSeq;
  errEl?.classList.remove('is-visible');
  try {
    await radiusRender(mount, fence, {
      animate: false,
      theme: state.play.theme,
    });
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
