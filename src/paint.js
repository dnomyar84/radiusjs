import { resolveTheme } from './themes.js';
import { kindMeta, FAMILIES } from './kinds.js';
import { groundHTML } from './grounds.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function familyTint(family) {
  const f = FAMILIES[family];
  if (!f) return null;
  return f.fill;
}

export function paint(host, spec, laid) {
  const theme = resolveTheme(spec.theme);
  const board = laid.board;

  host.className = `radius-root look-${spec.look} motion-${spec.motion} frame-${spec.frame} font-${spec.font}`;
  host.dataset.theme = spec.theme;
  host.dataset.template = spec.template;
  host.dataset.ground = spec.ground;
  host.style.setProperty('--radius-surface', theme.surface);
  host.style.setProperty('--radius-surface-2', theme.surface2);
  host.style.setProperty('--radius-ink', theme.ink);
  host.style.setProperty('--radius-muted', theme.muted);
  host.style.setProperty('--radius-accent', theme.accent);
  host.style.setProperty('--radius-glow-2', theme.glow2 || theme.accent);
  host.style.setProperty('--radius-glow-3', theme.glow3 || theme.accent);
  host.style.setProperty('--radius-line', theme.line);
  host.style.setProperty('--radius-card', theme.card);
  host.style.setProperty('--radius-shadow', theme.shadow);
  host.style.setProperty('--radius-board-w', `${board.w}px`);
  host.style.setProperty('--radius-board-h', `${board.h}px`);

  const ground = groundHTML(
    spec.ground,
    spec.groundTone,
    theme.accent,
    theme.line,
    { glow2: theme.glow2, glow3: theme.glow3 },
  );

  const groupEls = Object.entries(laid.groupBoxes || {})
    .map(([id, g]) => {
      if (id.startsWith('_')) return '';
      const tint = familyTint(g.family);
      const border = tint ? `border-color:${tint};` : '';
      const head = tint ? `background:${tint}22;color:${tint};` : '';
      const collapsed = g.collapsed ? 'true' : 'false';
      const h = g.collapsed ? g.hCollapsed : g.hExpanded;
      const count = (g.members || []).length;
      const chev = g.expandable
        ? `<button type="button" class="radius-fold-btn" aria-expanded="${g.collapsed ? 'false' : 'true'}" title="Expand or collapse">${g.collapsed ? '▸' : '▾'}</button>`
        : '';
      return `<div class="radius-group${g.collapsed ? ' is-collapsed' : ' is-expanded'}${g.expandable ? ' is-expandable' : ''}" data-id="${esc(id)}" data-family="${esc(g.family || '')}" data-parent="${esc(g.parent || '')}" data-depth="${g.depth || 0}" data-collapsed="${collapsed}" data-expandable="${g.expandable ? 'true' : 'false'}" data-members="${esc((g.members || []).join(','))}" data-children="${esc((g.childIds || []).join(','))}" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${h}px;${border}">
        <div class="radius-group-head" style="${head}">
          ${chev}
          <span class="radius-group-title">${esc(g.label || id)}</span>
          <span class="radius-group-count">${count}</span>
        </div>
      </div>`;
    })
    .join('');

  const edges = (laid.routes || [])
    .map((r) => {
      const fromG = laid.boxes[r.from]?.group;
      const toG = laid.boxes[r.to]?.group;
      return `<path class="radius-edge" data-from="${esc(r.from)}" data-to="${esc(r.to)}" data-from-group="${esc(fromG || '')}" data-to-group="${esc(toG || '')}" d="${r.d}" fill="none" marker-end="url(#radius-arrow)"/>`;
    })
    .join('');

  const nodes = spec.nodes
    .map((n) => {
      const b = laid.boxes[n.id];
      if (!b) return '';
      const km = kindMeta(n.kind);
      const chip = n.kind
        ? `<span class="radius-chip" style="background:${km.fill};color:${km.on}">${esc(km.mono)}</span>`
        : '';
      const appearIdx = laid.appearOrder.indexOf(n.id);
      const gMeta = b.group && laid.groupBoxes?.[b.group];
      const folded = gMeta?.collapsed ? ' is-folded' : '';
      return `<div class="radius-node${folded}" data-id="${esc(n.id)}" data-kind="${esc(n.kind || '')}" data-group="${esc(b.group || '')}" data-appear-index="${appearIdx}" tabindex="0" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px">
        ${chip}
        <span class="radius-label">${esc(n.label)}</span>
      </div>`;
    })
    .join('');

  const title = spec.title
    ? `<div class="radius-title">${esc(spec.title)}</div>`
    : '';

  host.innerHTML = `
    <div class="radius-board" role="img" aria-label="${esc(spec.title || 'Radius diagram')}">
      ${ground}
      ${title}
      ${groupEls}
      <svg class="radius-edges" width="${board.w}" height="${board.h}">
        <defs>
          <marker id="radius-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="${theme.muted}"/>
          </marker>
        </defs>
        ${edges}
      </svg>
      <div class="radius-nodes">${nodes}</div>
      <div class="radius-story-hint" hidden>→ story</div>
    </div>
  `;

  return host;
}
