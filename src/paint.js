import { resolveTheme } from './themes.js';
import { kindMeta, FAMILIES } from './kinds.js';
import { groundHTML } from './grounds.js';
import { normalizeWires, wireVisible } from './parse.js';
import { pastelForKey, pastelMixPct } from './pastels.js';
import { contentFitTransform } from './layout.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Apply wire-group visibility on a painted root (document filter or story step). */
export function applyWiresFilter(root, wires) {
  if (!root) return;
  const state = normalizeWires(wires);
  root.dataset.wires =
    state.mode === 'only' ? state.names.join(' ') : state.mode;
  root.querySelectorAll('[data-wire]').forEach((el) => {
    const on = wireVisible(el.dataset.wire || 'main', state);
    el.classList.toggle('is-wire-off', !on);
    el.setAttribute('aria-hidden', on ? 'false' : 'true');
  });
}

function familyTint(family) {
  const f = FAMILIES[family];
  if (!f) return null;
  return f.fill;
}

function labelHTML(full, measure, className = 'radius-label') {
  const text = measure?.display || full;
  const title = measure?.full || full;
  const px = measure?.fontPx != null ? Number(measure.fontPx) : null;
  // CSS uses --radius-label-px so packing shrinks beat fixed rem rules
  const font = px
    ? `font-size:${px}px;--radius-label-px:${px}px;`
    : '';
  const lines = measure?.lines || String(text).split('\n');
  const multi = lines.length > 1;
  const cls = `${className}${multi ? ' is-multiline' : ' is-single'}${measure?.truncated ? ' is-truncated' : ''}`;
  const body = lines.map((l) => esc(l)).join('<br>');
  return `<span class="${cls}" title="${esc(title)}" style="${font}">${body}</span>`;
}

/** Chronological rail + tick marks for template: timeline */
function axisHTML(axis, board, theme) {
  if (!axis?.ticks?.length) return '';
  const stroke = theme?.muted || '#78716c';
  const accent = theme?.accent || stroke;
  const lines = (axis.segments || [])
    .map(
      (s) =>
        `<path class="radius-axis-line${s.kind === 'uturn' ? ' is-uturn' : ''}" d="${s.d}" fill="none" stroke="${esc(stroke)}" />`,
    )
    .join('');
  const ticks = axis.ticks
    .map((t) => {
      const label = t.label
        ? `<text class="radius-axis-tick-label" x="${t.x}" y="${t.y + 22}" text-anchor="middle" fill="${esc(stroke)}">${esc(t.label)}</text>`
        : '';
      return `<g class="radius-axis-tick" data-id="${esc(t.id)}">
      <line class="radius-axis-stem" x1="${t.x}" y1="${t.y - 10}" x2="${t.x}" y2="${t.y + 10}" stroke="${esc(stroke)}"/>
      <circle class="radius-axis-dot" cx="${t.x}" cy="${t.y}" r="4" fill="${esc(accent)}" stroke="${esc(stroke)}"/>
      ${label}
    </g>`;
    })
    .join('');
  return `<svg class="radius-axis" width="${board.w}" height="${board.h}" aria-hidden="true">${lines}${ticks}</svg>`;
}

function chipHTML(kind, iconPx = 48) {
  if (!kind) return '';
  const km = kindMeta(kind);
  const px = Math.max(16, Math.round(Number(iconPx) || 48));
  const img = Math.max(12, Math.round((px * 2) / 3));
  const size = `--radius-icon-px:${px}px;width:${px}px;height:${px}px;min-width:${px}px;`;
  if (km.icon) {
    return `<span class="radius-chip radius-chip-icon" style="background:${km.fill};${size}" title="${esc(km.id)}"><img src="${esc(km.icon)}" alt="" width="${img}" height="${img}" decoding="async"/></span>`;
  }
  const tileFs = Math.max(8, Math.round(px * 0.28));
  return `<span class="radius-chip radius-chip-tile" style="background:${km.fill};color:${km.on};${size};font-size:${tileFs}px">${esc(km.mono)}</span>`;
}

export function paint(host, spec, laid) {
  const theme = resolveTheme(spec.theme);
  const board = laid.board;

  host.className = `radius-root look-${spec.look} motion-${spec.motion} frame-${spec.frame} font-${spec.font} glass-${spec.glass || 'frost'}`;
  host.dataset.theme = spec.theme;
  host.dataset.template = spec.template;
  host.dataset.ground = spec.ground;
  host.dataset.glass = spec.glass || 'frost';
  host.dataset.engine = laid.engine || 'native';
  host.dataset.wires =
    spec.wires?.mode === 'only' ? (spec.wires.names || []).join(' ') : spec.wires?.mode || 'all';
  host.style.setProperty('--radius-surface', theme.surface);
  host.style.setProperty('--radius-surface-2', theme.surface2);
  host.style.setProperty('--radius-ink', theme.ink);
  host.style.setProperty('--radius-muted', theme.muted);
  host.style.setProperty('--radius-accent', theme.accent);
  host.style.setProperty('--radius-glow-2', theme.glow2 || theme.accent);
  host.style.setProperty('--radius-glow-3', theme.glow3 || theme.accent);
  if (theme.glow4) host.style.setProperty('--radius-glow-4', theme.glow4);
  host.style.setProperty('--radius-line', theme.line);
  host.style.setProperty('--radius-card', theme.card);
  host.style.setProperty('--radius-shadow', theme.shadow);
  host.style.setProperty('--radius-board-w', `${board.w}px`);
  host.style.setProperty('--radius-board-h', `${board.h}px`);
  const fit = contentFitTransform(laid);
  host.style.setProperty('--radius-fit-scale', String(fit.scale));
  host.style.setProperty('--radius-fit-x', `${fit.tx}px`);
  host.style.setProperty('--radius-fit-y', `${fit.ty}px`);
  host.dataset.fitScale = fit.scale < 0.999 ? fit.scale.toFixed(3) : '1';

  const ground = groundHTML(
    spec.ground,
    spec.groundTone,
    theme.accent,
    theme.line,
    { glow2: theme.glow2, glow3: theme.glow3, glow4: theme.glow4 },
  );

  const washMix = pastelMixPct(spec.theme);
  const groupEls = Object.entries(laid.groupBoxes || {})
    .map(([id, g]) => {
      if (id.startsWith('_')) return '';
      const tint = familyTint(g.family) || (g.kind ? kindMeta(g.kind).fill : null);
      const wash = pastelForKey(id);
      const border = tint ? `border-color:${tint};` : `border-color:color-mix(in srgb, ${wash} 55%, var(--radius-line));`;
      const virtual = !!g.virtual;
      const head = tint
        ? g.collapsed
          ? `background:${tint}22;color:${tint};`
          : `color:${tint};`
        : '';
      const collapsed = g.collapsed ? 'true' : 'false';
      const h = g.collapsed ? g.hCollapsed : g.hExpanded;
      // AWS-style: dotted virtual regions get a stable pastel backing (same id → same color)
      const awsWash = virtual && !g.collapsed;
      const washStyle = awsWash
        ? `--radius-group-wash:${wash};--radius-group-wash-mix:${washMix}%;`
        : '';
      // Virtual expanded: bare text only — no chip chrome.
      // Solid expanded headers use a slim chip so the strip stays thin.
      const chip =
        virtual && !g.collapsed
          ? ''
          : chipHTML(
              g.kind || (g.family ? `${g.family}.x` : ''),
              g.collapsed ? 28 : 22,
            );
      const chev = g.expandable
        ? `<button type="button" class="radius-fold-btn" aria-expanded="${g.collapsed ? 'false' : 'true'}" title="Expand or collapse">${g.collapsed ? '▸' : '▾'}</button>`
        : '';
      const face = labelHTML(g.label || id, g.face, 'radius-label');
      const layer = g.layer ? ` data-layer="${esc(g.layer)}"` : '';
      const cls = [
        'radius-group',
        g.collapsed ? 'is-collapsed' : 'is-expanded',
        g.expandable ? 'is-expandable' : '',
        g.folded ? 'is-folded-group' : '',
        virtual ? 'is-virtual' : '',
        awsWash ? 'has-wash' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<div class="${cls}" data-id="${esc(id)}" data-family="${esc(g.family || '')}" data-parent="${esc(g.parent || '')}" data-depth="${g.depth || 0}" data-collapsed="${collapsed}" data-expandable="${g.expandable ? 'true' : 'false'}" data-virtual="${virtual ? 'true' : 'false'}" data-members="${esc((g.members || []).join(','))}" data-children="${esc((g.childIds || []).join(','))}"${layer} style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${h}px;${border}${washStyle}">
        <div class="radius-group-face radius-element-face" style="${head}" role="button" tabindex="0">
          ${chip}
          ${face}
          ${chev}
        </div>
        <span class="radius-resize" data-resize="se" title="Drag to resize" aria-hidden="true"></span>
      </div>`;
    })
    .join('');

  const pipes = spec.theme === 'neon' || spec.look === 'perspective';
  const axisSvg = axisHTML(laid.axis, board, theme);
  const wires = normalizeWires(spec.wires);
  // Hold wires until interact onboards endpoints (avoids full-graph flash)
  const holdAppear = spec.motion && spec.motion !== 'none' ? ' is-hidden' : '';
  const edges = (laid.routes || [])
    .map((r, i) => {
      if (!r.d || r.hidden) return '';
      // Timeline rail already shows sequence — only paint labeled gate strokes
      if (r.routeMode === 'timeline-axis' && !r.label) return '';
      const wire = r.wire || 'main';
      const off = wireVisible(wire, wires) ? '' : ' is-wire-off';
      const attachFrom = r.resolvedFrom || r.from;
      const attachTo = r.resolvedTo || r.to;
      const fromG = laid.boxes[attachFrom]?.group || (laid.groupBoxes?.[attachFrom] ? attachFrom : '');
      const toG = laid.boxes[attachTo]?.group || (laid.groupBoxes?.[attachTo] ? attachTo : '');
      const logicalFrom = r.logicalFrom || r.from;
      const logicalTo = r.logicalTo || r.to;
      const eid = `e${i}_${esc(attachFrom)}_${esc(attachTo)}`;
      // Tip text lives on the hit path (pointer target); visible stroke is events:none
      const tipText =
        (r.mergedCount || 1) > 1
          ? `${r.mergedCount} connections${r.label ? `: ${r.label}` : ''}`
          : r.label || '';
      const tipAttr = tipText
        ? ` data-label="${esc(tipText)}" title="${esc(tipText)}"`
        : '';
      const meta = `class="radius-edge-hit${off}${holdAppear}" data-wire="${esc(wire)}" data-from="${esc(attachFrom)}" data-to="${esc(attachTo)}" data-logical-from="${esc(logicalFrom)}" data-logical-to="${esc(logicalTo)}" data-from-endpoint="${esc(r.fromEndpoint || 'node')}" data-to-endpoint="${esc(r.toEndpoint || 'node')}" data-from-group="${esc(fromG || '')}" data-to-group="${esc(toG || '')}" data-edge-id="${eid}" data-merged="${r.mergedCount || 1}"${tipAttr}`;
      const edgeMeta = `class="radius-edge${off}${holdAppear}" data-wire="${esc(wire)}" data-from="${esc(attachFrom)}" data-to="${esc(attachTo)}" data-logical-from="${esc(logicalFrom)}" data-logical-to="${esc(logicalTo)}" data-from-endpoint="${esc(r.fromEndpoint || 'node')}" data-to-endpoint="${esc(r.toEndpoint || 'node')}" data-from-group="${esc(fromG || '')}" data-to-group="${esc(toG || '')}" data-edge-id="${eid}" data-merged="${r.mergedCount || 1}"`;
      const shell = pipes
        ? `<path class="radius-edge-pipe${off}${holdAppear}" data-wire="${esc(wire)}" data-edge-id="${eid}" d="${r.d}" fill="none"/>`
        : '';
      return `${shell}<path ${meta} d="${r.d}" fill="none" stroke="transparent" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/><path ${edgeMeta} d="${r.d}" fill="none" marker-end="url(#radius-arrow)"/>`;
    })
    .join('');

  const edgeLabels = (laid.routes || [])
    .map((r, i) => {
      if (!r.label || r.labelX == null || r.hidden) return '';
      if (r.routeMode === 'timeline-axis' && !r.label) return '';
      const wire = r.wire || 'main';
      const off = wireVisible(wire, wires) ? '' : ' is-wire-off';
      const attachFrom = r.resolvedFrom || r.from;
      const attachTo = r.resolvedTo || r.to;
      const eid = `e${i}_${esc(attachFrom)}_${esc(attachTo)}`;
      return `<div class="radius-edge-label${off}${holdAppear}" data-wire="${esc(wire)}" data-edge-id="${eid}" data-from="${esc(attachFrom)}" data-to="${esc(attachTo)}" style="left:${r.labelX}px;top:${r.labelY || 0}px" title="${esc(r.label)}">${esc(r.label)}</div>`;
    })
    .join('');

  const nodes = spec.nodes
    .map((n) => {
      const b = laid.boxes[n.id];
      if (!b) return '';
      const measure = b.faceOnly || b.measure;
      const iconPx = measure?.icon != null ? Number(measure.icon) : 48;
      const chip = chipHTML(n.kind, iconPx);
      const expandedParent = !!(b.expandable && !b.collapsed);
      const glyphCls = n.kind
        ? expandedParent
          ? ' is-parent-frame'
          : ' is-glyph'
        : ' is-text';
      const appearIdx = laid.appearOrder.indexOf(n.id);
      const gMeta = b.group && laid.groupBoxes?.[b.group];
      const folded =
        b.folded || gMeta?.collapsed || gMeta?.folded
          ? ' is-folded'
          : '';
      const parentFolded = b.parentNode && laid.boxes[b.parentNode]?.collapsed
        ? ' is-folded'
        : '';
      const expandable = b.expandable ? ' is-expandable-node' : '';
      const collapsed = b.collapsed ? ' is-collapsed-node' : '';
      const faceH = b.isParent && !b.collapsed && b.faceOnly ? b.faceOnly.h : null;
      const chev = b.expandable
        ? `<button type="button" class="radius-fold-btn" aria-expanded="${b.collapsed ? 'false' : 'true'}">${b.collapsed ? '▸' : '▾'}</button>`
        : '';
      const layer = n.layer ? ` data-layer="${esc(n.layer)}"` : '';
      const stackN = n.stack != null ? Math.min(4, Math.max(1, Number(n.stack) || 2)) : 0;
      const stackCls = stackN ? ' is-stack' : '';
      const stackAttr = stackN ? ` data-stack="${stackN}"` : '';
      const plates = stackN
        ? Array.from({ length: stackN }, (_, i) => {
            const o = (i + 1) * 5;
            return `<span class="radius-stack-plate" aria-hidden="true" style="--stack-x:${o}px;--stack-y:${o}px;--stack-i:${i}"></span>`;
          }).join('')
        : '';
      const shape = n.shape || b.shape || 'rect';
      const shapeCls = shape !== 'rect' ? ` is-shape-${esc(shape)}` : '';
      const parentBox = b.parentNode ? laid.boxes[b.parentNode] : null;
      const tableRow =
        parentBox && (parentBox.shape === 'table' || spec.nodes.find((p) => p.id === b.parentNode)?.shape === 'table')
          ? ' is-table-row'
          : '';
      const styleExtra = [
        faceH != null ? `height:${b.h}px;` : '',
        glyphCls.includes('is-glyph') ? `--radius-icon-px:${iconPx}px;` : '',
      ].join('');
      return `<div class="radius-node${folded}${parentFolded}${expandable}${collapsed}${stackCls}${glyphCls}${shapeCls}${tableRow}" data-id="${esc(n.id)}" data-kind="${esc(n.kind || '')}" data-shape="${esc(shape)}" data-group="${esc(b.group || '')}" data-parent-node="${esc(b.parentNode || '')}" data-appear-index="${appearIdx}" data-collapsed="${b.collapsed ? 'true' : 'false'}" data-expandable="${b.expandable ? 'true' : 'false'}"${stackAttr}${layer} tabindex="0" style="left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.isParent && !b.collapsed ? b.h : b.h}px;${styleExtra}">
        ${plates}
        <div class="radius-node-face radius-element-face">
          ${chip}
          ${labelHTML(n.label, measure)}
          ${chev}
        </div>
        <span class="radius-resize" data-resize="se" title="Drag to resize" aria-hidden="true"></span>
      </div>`;
    })
    .join('');

  const title = spec.title
    ? `<div class="radius-title" title="${esc(spec.title)}">${esc(spec.title)}</div>`
    : '';

  host.innerHTML = `
    <div class="radius-board" role="img" aria-label="${esc(spec.title || 'Radius diagram')}">
      ${ground}
      ${title}
      <div class="radius-iso-world" style="--radius-fit-scale:${fit.scale};--radius-fit-x:${fit.tx}px;--radius-fit-y:${fit.ty}px">
        ${axisSvg}
        <svg class="radius-edges" width="${board.w}" height="${board.h}">
          <defs>
            <marker id="radius-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="${theme.muted}"/>
            </marker>
          </defs>
          ${edges}
        </svg>
        <div class="radius-edge-labels">${edgeLabels}</div>
        ${groupEls}
        <div class="radius-nodes">${nodes}</div>
      </div>
      <div class="radius-fit-span" aria-hidden="true"></div>
      <div class="radius-story-hint" hidden>→ story</div>
      <div class="radius-view-controls">
        <button type="button" class="radius-fit-btn is-active" data-fit="screen" aria-pressed="true" title="Show the whole diagram in the board">Fit to Screen</button>
        <button type="button" class="radius-fit-btn" data-fit="width" aria-pressed="false" title="Match the diagram to the board width and scroll vertically">Fit to width</button>
        <button type="button" class="radius-zoom-out" hidden title="Zoom out to full diagram (Esc)">Zoom out</button>
      </div>
    </div>
  `;

  return host;
}
