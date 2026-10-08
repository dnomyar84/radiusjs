/**
 * Hover / focus / keyboard story + element-face expand/collapse
 * (groups and expandable node parents) with staggered child reveal.
 * Double-click expanded group body (not the face/label) → zoom to that parent.
 * Double-click empty board outside the diagram toggles edges. While zoomed, that
 * same gesture still zooms out. Double-click a line toggles every edge label.
 * Escape resets zoom.
 * Fit to Screen keeps the whole diagram in the board.
 * Fit to width matches the board width and scrolls vertically.
 * Drag-resize via SE handle (grow free; shrink to content floor).
 */

import { routeEdges, edgeRouteMode } from './edges.js';
import { nodeMinSize, groupMinSize, clampSize } from './resize.js';
import { applyWiresFilter } from './paint.js';
import { normalizeWires } from './parse.js';
import { bindOrbit } from './orbit.js';
import { contentFitTransform, fitWidthTransform } from './layout.js';

function prefersReduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Both endpoints must be ready before an edge onboards (appear sequence).
 * Exported for regression tests — FOUC when only `from` was ready.
 */
export function isEndpointReady(el, motion = 'tasteful') {
  if (!el) return false;
  const cls = el.classList;
  const has = (c) => (typeof cls.contains === 'function' ? cls.contains(c) : !!cls?.[c]);
  if (has('is-folded') || has('is-folded-group')) return false;
  if (has('will-appear')) return false;
  if (
    motion !== 'none' &&
    (has('radius-node') || has('is-collapsed')) &&
    !has('is-shown')
  ) {
    return false;
  }
  return true;
}

/**
 * Edge chrome gestures.
 * `empty` — double-click outside every node and group. Toggles all edges,
 * unless the board is zoomed, in which case it zooms out (one gesture, one job).
 * `line` — double-click a stroke or its label. Toggles the label layer.
 * Labels stay as they were when edges come back. Hiding edges hides labels too.
 */
export function nextEdgeChrome(state, gesture) {
  const edges = state?.edges === 'off' ? 'off' : 'on';
  const labels = state?.labels === 'off' ? 'off' : 'on';
  const zoomed = !!state?.zoomed;
  if (gesture === 'line') {
    if (edges === 'off') return { edges, labels, zoomed, action: 'none' };
    return {
      edges,
      labels: labels === 'off' ? 'on' : 'off',
      zoomed,
      action: 'labels',
    };
  }
  if (gesture === 'empty') {
    if (zoomed) return { edges, labels, zoomed: false, action: 'zoom-out' };
    return {
      edges: edges === 'off' ? 'on' : 'off',
      labels,
      zoomed: false,
      action: 'edges',
    };
  }
  return { edges, labels, zoomed, action: 'none' };
}

export function bindInteract(root, spec, laid, hooks = {}) {
  const board = root.querySelector('.radius-board');
  if (!board) return { destroy() {}, step() {}, next() {}, prev() {}, expand() {}, collapse() {} };

  const nodes = [...board.querySelectorAll('.radius-node')];
  const edges = [...board.querySelectorAll('.radius-edge')];
  const edgeHits = [...board.querySelectorAll('.radius-edge-hit')];
  const edgeLabels = [...board.querySelectorAll('.radius-edge-label')];
  const groups = [...board.querySelectorAll('.radius-group[data-id]')];
  const byId = Object.fromEntries(nodes.map((el) => [el.dataset.id, el]));
  const groupById = Object.fromEntries(groups.map((el) => [el.dataset.id, el]));

  let hot = null;
  let hotEdge = null;
  let storyIndex = -1;
  const story = spec.story || [];
  let activeWires = normalizeWires(spec.wires);
  const motion = prefersReduced() ? 'none' : spec.motion;
  const stagger = motion === 'bold' ? 110 : motion === 'none' ? 0 : 80;
  const timers = new Set();
  let foldTimer = 0;

  let foldFocusId = null;

  function requestFoldReflow(focusId) {
    if (!hooks.onFoldChange) return false;
    if (focusId) foldFocusId = focusId;
    window.clearTimeout(foldTimer);
    foldTimer = window.setTimeout(() => {
      const id = foldFocusId;
      foldFocusId = null;
      hooks.onFoldChange(id);
    }, 40);
    return true;
  }

  function later(fn, ms) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function edgeTouches(edge, id) {
    if (!id || !edge) return false;
    return (
      edge.dataset.from === id ||
      edge.dataset.to === id ||
      edge.dataset.logicalFrom === id ||
      edge.dataset.logicalTo === id
    );
  }

  function syncEdgeAccent() {
    const mark = (el) => {
      const on =
        (hotEdge && el.dataset.edgeId === hotEdge) ||
        (!hotEdge && hot && edgeTouches(el, hot));
      el.classList.toggle('is-hot', !!on);
      el.classList.toggle('is-accent', !!on);
    };
    edges.forEach(mark);
    edgeHits.forEach(mark);
    edgeLabels.forEach(mark);
    board.querySelectorAll('.radius-edge-pipe').forEach(mark);
  }

  function setHot(id) {
    if (hot && byId[hot]) byId[hot].classList.remove('is-hot');
    if (hot && groupById[hot]) groupById[hot].classList.remove('is-hot');
    hot = id;
    if (hot && byId[hot]) byId[hot].classList.add('is-hot');
    if (hot && groupById[hot]) groupById[hot].classList.add('is-hot');
    if (id) {
      hotEdge = null;
      hideEdgeTip({ force: true });
    }
    syncEdgeAccent();
  }

  function setHotEdge(edgeId, from, to) {
    hotEdge = edgeId || null;
    // Soft-highlight endpoints while the arrow is hovered
    nodes.forEach((el) => {
      const on = hotEdge && (el.dataset.id === from || el.dataset.id === to);
      el.classList.toggle('is-hot', !!on);
    });
    groups.forEach((el) => {
      const on = hotEdge && (el.dataset.id === from || el.dataset.id === to);
      el.classList.toggle('is-hot', !!on);
    });
    hot = null;
    syncEdgeAccent();
    if (!hotEdge) hideEdgeTip();
  }

  let tipPinned = false;
  let tipTimer = 0;

  function edgeLabelText(edgeId) {
    if (!edgeId) return '';
    const hit = edgeHits.find((h) => h.dataset.edgeId === edgeId);
    if (hit?.dataset?.label) return hit.dataset.label;
    const lab = edgeLabels.find((l) => l.dataset.edgeId === edgeId);
    return (lab?.textContent || lab?.getAttribute('title') || '').trim();
  }

  function hideEdgeTip({ force = false } = {}) {
    if (tipPinned && !force) return;
    tipPinned = false;
    window.clearTimeout(tipTimer);
    tipTimer = 0;
    const tip = board.querySelector('.radius-edge-tip');
    if (tip) tip.classList.remove('is-on');
  }

  /** Floating tip for edge labels — native SVG title is unreliable; tap needs this. */
  function showEdgeTip(edgeId, clientX, clientY) {
    const text = edgeLabelText(edgeId);
    if (!text) {
      hideEdgeTip({ force: true });
      return;
    }
    let tip = board.querySelector('.radius-edge-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'radius-edge-tip';
      tip.setAttribute('role', 'tooltip');
      board.appendChild(tip);
    }
    tip.textContent = text;
    const br = board.getBoundingClientRect();
    const x = Math.max(16, Math.min(br.width - 16, clientX - br.left));
    const y = Math.max(36, Math.min(br.height - 12, clientY - br.top));
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    tip.classList.add('is-on');
  }

  function memberIds(gid) {
    const g = groupById[gid];
    if (!g) return [];
    return (g.dataset.members || '').split(',').filter(Boolean);
  }

  function childGroupIds(gid) {
    const meta = laid.groupBoxes?.[gid];
    return meta?.childIds || [];
  }

  function allDescendantNodeIds(gid) {
    const out = [...memberIds(gid)];
    childGroupIds(gid).forEach((cid) => {
      out.push(...allDescendantNodeIds(cid));
    });
    return out;
  }

  /** Endpoint is ready to grow wires — not folded and not still in appear stagger. */
  function endpointReady(el) {
    return isEndpointReady(el, motion);
  }

  function syncEdges() {
    const allEdgeEls = [...edges, ...edgeHits, ...board.querySelectorAll('.radius-edge-pipe')];
    const hiddenIds = new Set();
    allEdgeEls.forEach((edge) => {
      const from = byId[edge.dataset.from] || groupById[edge.dataset.from];
      const to = byId[edge.dataset.to] || groupById[edge.dataset.to];
      // Reveal only when BOTH ends have onboarded (follows appear sequence)
      const hidden = !endpointReady(from) || !endpointReady(to);
      edge.classList.toggle('is-hidden', !!hidden);
      if (hidden && edge.dataset.edgeId) hiddenIds.add(edge.dataset.edgeId);
    });
    // Keep labels in lockstep with their edge — never leave stranded chips
    edgeLabels.forEach((lab) => {
      const eid = lab.dataset.edgeId;
      const edge = edges.find((e) => e.dataset.edgeId === eid);
      const hidden = !edge || edge.classList.contains('is-hidden') || hiddenIds.has(eid);
      lab.classList.toggle('is-hidden', !!hidden);
    });
  }

  function revealMembers(gid, { animate = true } = {}) {
    const ids = memberIds(gid);
    childGroupIds(gid).forEach((cid) => {
      const cg = groupById[cid];
      if (!cg) return;
      cg.classList.remove('is-folded-group');
      if (cg.dataset.collapsed !== 'true') revealMembers(cid, { animate });
    });
    ids.forEach((id, i) => {
      const el = byId[id];
      if (!el) return;
      const home = el.dataset.group;
      if (home && home !== gid && groupById[home]?.dataset.collapsed === 'true') return;
      if (home && home !== gid && groupById[home]?.classList.contains('is-folded-group')) return;
      const parentNode = el.dataset.parentNode;
      if (parentNode && byId[parentNode]?.dataset.collapsed === 'true') return;
      el.classList.remove('is-folded');
      if (!animate || motion === 'none') {
        el.classList.add('is-shown');
        el.classList.remove('will-appear');
        return;
      }
      el.classList.remove('is-shown');
      el.classList.add('will-appear');
      later(() => {
        el.classList.add('is-shown');
        el.classList.remove('will-appear');
        syncEdges();
      }, i * stagger);
    });
    later(syncEdges, ids.length * stagger + 30);
  }

  function hideMembers(gid) {
    allDescendantNodeIds(gid).forEach((id) => {
      const el = byId[id];
      if (!el) return;
      el.classList.add('is-folded');
      el.classList.remove('is-shown', 'will-appear', 'is-focus', 'is-hot');
    });
    childGroupIds(gid).forEach((cid) => {
      const cg = groupById[cid];
      if (!cg) return;
      cg.classList.add('is-folded-group');
      hideMembers(cid);
    });
    syncEdges();
  }

  function setGroupCollapsed(gid, collapsed, opts = {}) {
    const g = groupById[gid];
    const meta = laid.groupBoxes?.[gid];
    if (!g || !meta || g.dataset.expandable === 'false') return;
    const next = !!collapsed;
    const prev = g.dataset.collapsed === 'true';

    // Unchanged — do not re-animate or reflow (story restore after quiet reflow)
    if (prev === next) {
      if (next) hideMembers(gid);
      return;
    }

    g.dataset.collapsed = next ? 'true' : 'false';
    g.classList.toggle('is-collapsed', next);
    g.classList.toggle('is-expanded', !next);
    meta.collapsed = next;
    // Keep spec in sync for layout reflow
    const sg = spec.groups?.find((x) => x.id === gid);
    if (sg) sg.collapsed = next;

    // Prefer full reflow so parents + siblings make space for nested expands
    if (opts.reflow !== false && requestFoldReflow(gid)) return;

    g.style.height = `${next ? meta.hCollapsed : meta.hExpanded}px`;
    if (next) {
      g.style.width = `${Math.min(meta.w, Math.max(160, (meta.face?.w || 160) + 24))}px`;
    } else {
      g.style.width = `${meta.wExpanded ?? meta.w}px`;
      g.style.left = `${meta.xExpanded ?? meta.x}px`;
    }

    const btn = g.querySelector('.radius-fold-btn');
    if (btn) {
      btn.textContent = next ? '▸' : '▾';
      btn.setAttribute('aria-expanded', next ? 'false' : 'true');
    }

    if (next) hideMembers(gid);
    else revealMembers(gid, { animate: true });
  }

  function childNodeIds(pid) {
    const meta = laid.boxes?.[pid];
    return meta?.childIds || nodes.filter((n) => n.dataset.parentNode === pid).map((n) => n.dataset.id);
  }

  function setNodeCollapsed(nid, collapsed, opts = {}) {
    const el = byId[nid];
    const meta = laid.boxes?.[nid];
    if (!el || !meta?.expandable) return;
    const next = !!collapsed;
    const prev = el.dataset.collapsed === 'true';

    // Unchanged — fold kids quietly; never re-stagger appear (timeline flicker)
    if (prev === next) {
      if (next) {
        childNodeIds(nid).forEach((id) => {
          const child = byId[id];
          if (!child) return;
          child.classList.add('is-folded');
          child.classList.remove('is-shown', 'will-appear');
        });
      }
      return;
    }

    el.dataset.collapsed = next ? 'true' : 'false';
    el.classList.toggle('is-collapsed-node', next);
    meta.collapsed = next;
    const sn = spec.nodes?.find((x) => x.id === nid);
    if (sn) sn.collapsed = next;

    if (opts.reflow !== false && requestFoldReflow(nid)) return;

    el.style.height = `${next ? meta.hCollapsed : meta.hExpanded}px`;
    if (next && meta.faceOnly) {
      el.style.width = `${meta.faceOnly.w}px`;
      el.style.height = `${meta.hCollapsed}px`;
    } else if (!next) {
      el.style.width = `${meta.w}px`;
      el.style.height = `${meta.hExpanded}px`;
    }
    const btn = el.querySelector('.radius-fold-btn');
    if (btn) {
      btn.textContent = next ? '▸' : '▾';
      btn.setAttribute('aria-expanded', next ? 'false' : 'true');
    }
    const kids = childNodeIds(nid);
    kids.forEach((id, i) => {
      const child = byId[id];
      if (!child) return;
      if (next) {
        child.classList.add('is-folded');
        child.classList.remove('is-shown', 'will-appear');
      } else {
        child.classList.remove('is-folded');
        if (motion === 'none') child.classList.add('is-shown');
        else {
          child.classList.add('will-appear');
          later(() => {
            child.classList.add('is-shown');
            child.classList.remove('will-appear');
            syncEdges();
          }, i * stagger);
        }
      }
    });
    syncEdges();
  }

  function toggleGroup(gid) {
    const g = groupById[gid];
    if (!g) return;
    setGroupCollapsed(gid, g.dataset.collapsed !== 'true');
  }

  function toggleNode(nid) {
    const el = byId[nid];
    if (!el || el.dataset.expandable !== 'true') return;
    setNodeCollapsed(nid, el.dataset.collapsed !== 'true');
  }

  function expandTarget(id) {
    if (groupById[id]) setGroupCollapsed(id, false);
    else if (byId[id]) setNodeCollapsed(id, false);
  }

  function collapseTarget(id) {
    if (groupById[id]) setGroupCollapsed(id, true);
    else if (byId[id]) setNodeCollapsed(id, true);
  }

  /** Expand or collapse every expandable group + node parent — one reflow. */
  function setAllCollapsed(collapsed) {
    const next = !!collapsed;
    let changed = false;
    groups.forEach((g) => {
      if (g.dataset.expandable === 'false') return;
      if ((g.dataset.collapsed === 'true') === next) return;
      setGroupCollapsed(g.dataset.id, next, { reflow: false });
      changed = true;
    });
    nodes.forEach((el) => {
      if (el.dataset.expandable !== 'true') return;
      if ((el.dataset.collapsed === 'true') === next) return;
      setNodeCollapsed(el.dataset.id, next, { reflow: false });
      changed = true;
    });
    if (changed) requestFoldReflow();
  }

  nodes.forEach((el) => {
    el.addEventListener('pointerenter', () => setHot(el.dataset.id));
    el.addEventListener('pointerleave', (e) => {
      if (hot !== el.dataset.id) return;
      // Ignore leave when crossing into a child (chip, fold btn, label)
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      setHot(null);
    });
    el.addEventListener('focus', () => setHot(el.dataset.id));
    el.addEventListener('click', (e) => {
      if (el.dataset.expandable === 'true' && (e.target.closest('.radius-node-face') || e.target.closest('.radius-fold-btn'))) {
        e.preventDefault();
        e.stopPropagation();
        toggleNode(el.dataset.id);
        return;
      }
      setHot(el.dataset.id);
    });
  });

  function bindEdgeHover(el) {
    el.addEventListener('pointerenter', (e) => {
      tipPinned = false;
      setHotEdge(el.dataset.edgeId, el.dataset.from, el.dataset.to);
      showEdgeTip(el.dataset.edgeId, e.clientX, e.clientY);
    });
    el.addEventListener('pointermove', (e) => {
      if (hotEdge !== el.dataset.edgeId || tipPinned) return;
      if (!edgeLabelText(el.dataset.edgeId)) return;
      showEdgeTip(el.dataset.edgeId, e.clientX, e.clientY);
    });
    el.addEventListener('pointerleave', (e) => {
      if (hotEdge !== el.dataset.edgeId) return;
      // Moving between hit path and any sibling with the same edge id
      const next = e.relatedTarget;
      if (next && next.dataset?.edgeId === el.dataset.edgeId) return;
      if (tipPinned) return;
      setHotEdge(null);
    });
    // Tap: pin tip so touch users can read the label
    el.addEventListener('click', (e) => {
      if (!edgeLabelText(el.dataset.edgeId)) return;
      e.stopPropagation();
      tipPinned = true;
      setHotEdge(el.dataset.edgeId, el.dataset.from, el.dataset.to);
      showEdgeTip(el.dataset.edgeId, e.clientX, e.clientY);
      window.clearTimeout(tipTimer);
      tipTimer = window.setTimeout(() => {
        tipPinned = false;
        hideEdgeTip({ force: true });
        if (hotEdge === el.dataset.edgeId) setHotEdge(null);
      }, 2800);
    });
  }
  // Hit paths only — visible strokes are pointer-events: none (avoids enter/leave thrash)
  edgeHits.forEach(bindEdgeHover);
  // Labels themselves also tip + hot the edge
  edgeLabels.forEach((lab) => {
    lab.style.pointerEvents = 'auto';
    lab.style.cursor = 'pointer';
    bindEdgeHover(lab);
  });

  board.addEventListener('pointerdown', (e) => {
    if (!tipPinned) return;
    if (e.target?.closest?.('.radius-edge-hit, .radius-edge-label, .radius-edge-tip')) return;
    tipPinned = false;
    hideEdgeTip({ force: true });
    setHotEdge(null);
  });

  /** Live-update SVG edge paths from current laid boxes. */
  function paintRoutes() {
    const routes = routeEdges(laid.boxes, spec.edges || [], laid.groupBoxes || {}, {
      mode: edgeRouteMode(spec),
    });
    laid.routes = routes;
    const svg = board.querySelector('.radius-edges');
    if (!svg) return;
    const pipes = [...svg.querySelectorAll('.radius-edge-pipe')];
    const hits = [...svg.querySelectorAll('.radius-edge-hit')];
    const verts = [...svg.querySelectorAll('.radius-edge')];
    routes.forEach((r, i) => {
      if (pipes[i] && r.d) pipes[i].setAttribute('d', r.d);
      if (hits[i] && r.d) hits[i].setAttribute('d', r.d);
      if (verts[i] && r.d) verts[i].setAttribute('d', r.d);
      if (verts[i]) {
        const attachFrom = r.resolvedFrom || r.from;
        const attachTo = r.resolvedTo || r.to;
        const eid = `e${i}_${attachFrom}_${attachTo}`;
        const tipText =
          (r.mergedCount || 1) > 1
            ? `${r.mergedCount} connections${r.label ? `: ${r.label}` : ''}`
            : r.label || '';
        for (const el of [pipes[i], hits[i], verts[i]]) {
          if (!el) continue;
          el.dataset.edgeId = eid;
          el.dataset.from = attachFrom;
          el.dataset.to = attachTo;
        }
        if (hits[i]) {
          if (tipText) {
            hits[i].dataset.label = tipText;
            hits[i].setAttribute('title', tipText);
          } else {
            delete hits[i].dataset.label;
            hits[i].removeAttribute('title');
          }
        }
      }
    });
    // Labels are a subset — match by edge-id, never by array index
    const labeled = routes
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.label && r.labelX != null && !r.hidden);
    edgeLabels.forEach((lab) => {
      const match = labeled.find(({ r, i }) => {
        const eid = `e${i}_${r.resolvedFrom || r.from}_${r.resolvedTo || r.to}`;
        return lab.dataset.edgeId === eid || (
          lab.dataset.from === (r.resolvedFrom || r.from) &&
          lab.dataset.to === (r.resolvedTo || r.to)
        );
      });
      if (!match) {
        lab.classList.add('is-hidden');
        return;
      }
      lab.style.left = `${match.r.labelX}px`;
      lab.style.top = `${match.r.labelY || 0}px`;
      lab.dataset.edgeId = `e${match.i}_${match.r.resolvedFrom || match.r.from}_${match.r.resolvedTo || match.r.to}`;
    });
    // Re-apply appear / fold visibility — never force labels on during stagger
    syncEdges();
  }

  function persistUserSize(id, w, h) {
    const root = board.closest('.radius-root') || board.parentElement;
    if (!root?._radius) return;
    if (!root._radius.userSizes) root._radius.userSizes = {};
    root._radius.userSizes[id] = { w, h };
  }

  function bindResizeHandle(hostEl, kind) {
    const handle = hostEl.querySelector('.radius-resize');
    if (!handle) return;
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = hostEl.dataset.id;
      const box = kind === 'group' ? laid.groupBoxes?.[id] : laid.boxes?.[id];
      if (!box) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = kind === 'group'
        ? (box.collapsed ? (box.wCollapsed ?? box.w) : (box.wExpanded ?? box.w))
        : box.w;
      const startH = kind === 'group'
        ? (box.collapsed ? box.hCollapsed : (box.hExpanded ?? box.h))
        : box.h;
      const mins = kind === 'group'
        ? groupMinSize(id, box, laid, spec)
        : nodeMinSize(box);

      const root = board.closest('.radius-root') || board.parentElement;
      root?.classList.add('is-resizing');
      handle.classList.add('is-active');
      hostEl.classList.add('is-resizing');
      handle.setPointerCapture?.(e.pointerId);

      const onMove = (ev) => {
        const dw = ev.clientX - startX;
        const dh = ev.clientY - startY;
        const next = clampSize(startW + dw, startH + dh, mins.minW, mins.minH);
        hostEl.style.width = `${next.w}px`;
        hostEl.style.height = `${next.h}px`;
        hostEl.style.transition = 'none';

        if (kind === 'group') {
          box.w = next.w;
          box.h = next.h;
          if (box.collapsed) {
            box.wCollapsed = next.w;
            box.hCollapsed = next.h;
          } else {
            box.wExpanded = next.w;
            box.hExpanded = next.h;
          }
        } else {
          box.w = next.w;
          box.h = next.h;
          if (box.expandable && box.collapsed) {
            box.wCollapsed = next.w;
            box.hCollapsed = next.h;
          } else if (box.expandable && !box.collapsed) {
            box.wExpanded = next.w;
            box.hExpanded = next.h;
          }
        }
        box.userSized = true;
        paintRoutes();
      };

      const onUp = (ev) => {
        handle.releasePointerCapture?.(ev.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        root?.classList.remove('is-resizing');
        handle.classList.remove('is-active');
        hostEl.classList.remove('is-resizing');
        hostEl.style.transition = '';
        const w = parseFloat(hostEl.style.width) || startW;
        const h = parseFloat(hostEl.style.height) || startH;
        persistUserSize(id, w, h);
        setHot(id);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });
  }

  nodes.forEach((el) => {
    if (!el.classList.contains('is-folded')) bindResizeHandle(el, 'node');
  });
  groups.forEach((g) => {
    if (!g.classList.contains('is-folded-group')) bindResizeHandle(g, 'group');
  });

  const world = board.querySelector('.radius-iso-world');
  const zoomOutBtn = board.querySelector('.radius-zoom-out');
  const fitButtons = [...board.querySelectorAll('.radius-fit-btn')];
  const hintEl = board.querySelector('.radius-story-hint');
  const hintIdle = story.length
    ? '← → story · click face to expand · double-click body to zoom'
    : 'Click face to expand / collapse · double-click body to zoom';
  if (!root.dataset.fitMode) root.dataset.fitMode = 'screen';

  function viewLaid() {
    const w = Math.max(1, board.clientWidth || laid.board?.w || 1);
    const h = Math.max(1, board.clientHeight || laid.board?.h || 1);
    return { ...laid, board: { ...(laid.board || {}), w, h } };
  }

  function syncZoomChrome() {
    const zoomed = !!root.dataset.zoomed;
    const mode = root.dataset.fitMode || 'screen';
    if (zoomOutBtn) zoomOutBtn.hidden = !zoomed;
    for (const btn of fitButtons) {
      const on = !zoomed && btn.dataset.fit === mode;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    if (hintEl && !hintEl.hidden) {
      hintEl.textContent = zoomed
        ? 'Zoomed in · Zoom out / Esc / double-click body again'
        : hintIdle;
    }
  }

  function applyScreenFit() {
    if (!world) return;
    const fit = contentFitTransform(viewLaid());
    world.style.setProperty('--radius-fit-scale', String(fit.scale));
    world.style.setProperty('--radius-fit-x', `${fit.tx}px`);
    world.style.setProperty('--radius-fit-y', `${fit.ty}px`);
    world.style.removeProperty('--radius-fit-zoom');
    board.classList.remove('is-fit-width');
    board.style.removeProperty('--radius-fit-span');
    board.style.removeProperty('--radius-fit-layout-w');
    board.style.removeProperty('--radius-fit-layout-h');
  }

  function applyWidthFit() {
    if (!world) return;
    const fit = fitWidthTransform(viewLaid());
    world.style.setProperty('--radius-fit-scale', '1');
    world.style.setProperty('--radius-fit-x', '0px');
    world.style.setProperty('--radius-fit-y', '0px');
    board.classList.add('is-fit-width');
    board.style.setProperty('--radius-fit-zoom', String(fit.scale));
    board.style.setProperty('--radius-fit-span', `${fit.span}px`);
    board.style.setProperty('--radius-fit-layout-w', `${fit.layoutW}px`);
    board.style.setProperty('--radius-fit-layout-h', `${fit.layoutH}px`);
    board.scrollTop = 0;
  }

  function applyFit(mode) {
    const next = mode === 'width' ? 'width' : 'screen';
    root.dataset.fitMode = next;
    delete root.dataset.zoomed;
    root.classList.remove('is-zoomed');
    groups.forEach((g) => g.classList.remove('is-zoom-target'));
    if (next === 'width') applyWidthFit();
    else applyScreenFit();
    syncZoomChrome();
  }

  function clearZoom() {
    applyFit(root.dataset.fitMode || 'screen');
  }

  function zoomToGroup(gid) {
    const box = laid.groupBoxes?.[gid];
    if (!world || !box || box.folded) return;
    if (root.dataset.zoomed === gid) {
      clearZoom();
      return;
    }
    const pad = 28;
    const vw = Math.max(1, board.clientWidth);
    const vh = Math.max(1, board.clientHeight);
    const scale = Math.min(
      (vw - pad * 2) / Math.max(box.w, 1),
      (vh - pad * 2) / Math.max(box.h, 1),
      3,
    );
    const tx = pad + (vw - pad * 2 - box.w * scale) / 2 - box.x * scale;
    const ty = pad + (vh - pad * 2 - box.h * scale) / 2 - box.y * scale;
    board.classList.remove('is-fit-width');
    world.style.setProperty('--radius-fit-scale', String(scale));
    world.style.setProperty('--radius-fit-x', `${tx}px`);
    world.style.setProperty('--radius-fit-y', `${ty}px`);
    root.dataset.zoomed = gid;
    root.classList.add('is-zoomed');
    groups.forEach((g) => g.classList.toggle('is-zoom-target', g.dataset.id === gid));
    syncZoomChrome();
  }

  function pointInRect(pt, r) {
    return pt.x >= r.left && pt.x <= r.right && pt.y >= r.top && pt.y <= r.bottom;
  }

  function applyEdgeChrome(next) {
    const edges = next?.edges === 'off' ? 'off' : 'on';
    const labels = next?.labels === 'off' ? 'off' : 'on';
    root.dataset.edges = edges;
    root.dataset.edgeLabels = labels;
    root.classList.toggle('is-edges-off', edges === 'off');
    root.classList.toggle('is-labels-off', labels === 'off');
  }

  function edgeChromeState() {
    return {
      edges: root.dataset.edges,
      labels: root.dataset.edgeLabels,
      zoomed: !!root.dataset.zoomed,
    };
  }

  function onBoardDblClick(e) {
    if (
      e.target.closest(
        '.radius-view-controls, .radius-story-hint, .radius-orbit-hint, .radius-resize, .radius-group-face, .radius-fold-btn',
      )
    ) {
      return;
    }
    // A line (or its label chip) toggles the label layer. The stroke stays.
    if (e.target.closest('.radius-edge-hit, .radius-edge-label')) {
      const next = nextEdgeChrome(edgeChromeState(), 'line');
      if (next.action === 'labels') {
        e.preventDefault();
        e.stopPropagation();
        applyEdgeChrome(next);
        hideEdgeTip({ force: true });
      }
      return;
    }
    if (e.target.closest('.radius-node')) return;
    const pt = { x: e.clientX, y: e.clientY };
    for (const n of nodes) {
      if (n.classList.contains('is-folded')) continue;
      if (pointInRect(pt, n.getBoundingClientRect())) return;
    }
    // Smallest expanded parent whose body (not face) contains the point.
    // A collapsed card still counts as inside the diagram, so it does not
    // toggle edges.
    let hit = null;
    let hitArea = Infinity;
    let insideGroup = false;
    for (const g of groups) {
      if (g.classList.contains('is-folded-group')) continue;
      const r = g.getBoundingClientRect();
      if (!pointInRect(pt, r)) continue;
      insideGroup = true;
      if (g.dataset.collapsed === 'true') continue;
      const face = g.querySelector('.radius-group-face');
      if (face && pointInRect(pt, face.getBoundingClientRect())) continue;
      const area = r.width * r.height;
      if (area < hitArea) {
        hit = g;
        hitArea = area;
      }
    }
    if (hit) {
      e.preventDefault();
      zoomToGroup(hit.dataset.id);
      return;
    }
    if (insideGroup) return;
    const next = nextEdgeChrome(edgeChromeState(), 'empty');
    if (next.action === 'zoom-out') {
      e.preventDefault();
      clearZoom();
      return;
    }
    if (next.action === 'edges') {
      e.preventDefault();
      applyEdgeChrome(next);
    }
  }

  groups.forEach((g) => {
    if (g.dataset.expandable === 'false') return;
    const face = g.querySelector('.radius-group-face') || g.querySelector('.radius-group-head');
    if (!face) return;
    const onToggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleGroup(g.dataset.id);
    };
    face.addEventListener('pointerenter', () => setHot(g.dataset.id));
    face.addEventListener('pointerleave', (e) => {
      if (hot !== g.dataset.id) return;
      if (e.relatedTarget && (face.contains(e.relatedTarget) || g.contains(e.relatedTarget))) return;
      setHot(null);
    });
    face.addEventListener('focus', () => setHot(g.dataset.id));
    face.addEventListener('click', onToggle);
    // Keep expand/collapse face from also triggering board zoom
    face.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    face.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') onToggle(e);
    });
    face.tabIndex = 0;
    face.setAttribute('role', 'button');
    face.setAttribute('aria-label', `Expand or collapse ${g.dataset.id}`);
  });

  board.addEventListener('dblclick', onBoardDblClick);
  const viewControls = board.querySelector('.radius-view-controls');
  viewControls?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  for (const btn of fitButtons) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyFit(btn.dataset.fit);
    });
  }
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearZoom();
    });
  }
  if (root.dataset.fitMode === 'width') applyFit('width');
  else syncZoomChrome();

  function clearStoryClasses() {
    nodes.forEach((el) => {
      el.classList.remove('is-focus', 'is-ghost', 'is-dim', 'is-solid');
    });
  }

  function applyStep(step, { folds = true } = {}) {
    if (!step) return;
    if (step.type === 'wires') {
      activeWires = normalizeWires(step.wires);
      applyWiresFilter(root, activeWires);
      return;
    }
    clearStoryClasses();
    if (step.type === 'expandAll') {
      if (folds) setAllCollapsed(false);
      return;
    }
    if (step.type === 'collapseAll') {
      if (folds) setAllCollapsed(true);
      return;
    }
    if (step.type === 'expand') {
      if (folds) expandTarget(step.id);
      return;
    }
    if (step.type === 'collapse') {
      if (folds) collapseTarget(step.id);
      return;
    }
    if (step.type === 'focus' || step.type === 'show') {
      const set = new Set(step.ids || []);
      if (folds) {
        set.forEach((id) => {
          const n = byId[id];
          const gid = n?.dataset.group;
          if (gid && groupById[gid]?.dataset.collapsed === 'true') setGroupCollapsed(gid, false);
          const pid = n?.dataset.parentNode;
          if (pid && byId[pid]?.dataset.collapsed === 'true') setNodeCollapsed(pid, false);
        });
      }
      nodes.forEach((el) => {
        if (el.classList.contains('is-folded')) return;
        if (set.has(el.dataset.id)) el.classList.add('is-focus');
        else el.classList.add('is-dim');
      });
    } else if (step.type === 'replace') {
      nodes.forEach((el) => {
        if (!el.classList.contains('is-folded')) el.classList.add('is-dim');
      });
      if (folds) {
        [step.from, step.to].forEach((id) => {
          const n = byId[id];
          const gid = n?.dataset.group;
          if (gid && groupById[gid]?.dataset.collapsed === 'true') setGroupCollapsed(gid, false);
        });
      }
      if (byId[step.from]) {
        byId[step.from].classList.remove('is-dim', 'is-folded');
        byId[step.from].classList.add('is-ghost');
      }
      if (byId[step.to]) {
        byId[step.to].classList.remove('is-dim', 'is-folded');
        byId[step.to].classList.add('is-solid', 'is-focus');
      }
    }
  }

  function go(i, { folds = true } = {}) {
    if (!story.length) return storyIndex;
    storyIndex = Math.max(-1, Math.min(story.length - 1, i));
    if (storyIndex < 0) {
      clearStoryClasses();
      activeWires = normalizeWires(spec.wires);
      applyWiresFilter(root, activeWires);
      return storyIndex;
    }
    applyStep(story[storyIndex], { folds });
    return storyIndex;
  }

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      go(storyIndex + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      go(storyIndex - 1);
    } else if (e.key === 'Escape') {
      if (root.dataset.zoomed) {
        e.preventDefault();
        clearZoom();
        return;
      }
      go(-1);
      setHot(null);
    }
  }

  board.tabIndex = 0;
  board.addEventListener('keydown', onKey);
  applyEdgeChrome(edgeChromeState());

  const hasFolds = groups.some((g) => g.dataset.expandable === 'true')
    || nodes.some((n) => n.dataset.expandable === 'true');
  if (hintEl && (story.length || hasFolds)) {
    hintEl.hidden = false;
    syncZoomChrome();
  }

  // Fold collapsed members FIRST so they never enter the appear stagger
  // (otherwise timers fight is-folded and cause flicker / uneven transitions).
  groups.forEach((g) => {
    if (g.dataset.collapsed === 'true') hideMembers(g.dataset.id);
  });
  nodes.forEach((el) => {
    if (el.dataset.expandable === 'true' && el.dataset.collapsed === 'true') {
      setNodeCollapsed(el.dataset.id, true, { reflow: false });
    }
  });

  const nodeAppear = (laid.appearOrder || nodes.map((n) => n.dataset.id)).filter((id) => {
    const el = byId[id];
    return el && !el.classList.contains('is-folded');
  });
  // Collapsed group faces are element cards too — include them in the stagger
  const groupAppear = groups.filter(
    (g) =>
      g.dataset.collapsed === 'true' &&
      !g.classList.contains('is-folded-group') &&
      g.dataset.expandable !== 'false',
  );
  const appearItems = [
    ...groupAppear.map((g) => ({ el: g, id: g.dataset.id })),
    ...nodeAppear.map((id) => ({ el: byId[id], id })).filter((x) => x.el),
  ];

  if (motion === 'none') {
    appearItems.forEach(({ el }) => el.classList.add('is-shown'));
    nodes.forEach((el) => {
      if (!el.classList.contains('is-folded')) el.classList.add('is-shown');
    });
  } else {
    // Hold every wire until endpoints rise — prevents a full graph flash
    // before the appear sequence, and keeps edges in lockstep with nodes.
    const edgeLayer = [
      ...edges,
      ...edgeHits,
      ...edgeLabels,
      ...board.querySelectorAll('.radius-edge-pipe'),
    ];
    edgeLayer.forEach((el) => el.classList.add('is-hidden'));

    const rise = motion === 'bold' ? 14 : 8;
    board.style.setProperty('--radius-rise', `${rise}px`);
    appearItems.forEach(({ el }, i) => {
      el.classList.add('will-appear');
      later(() => {
        if (el.classList.contains('is-folded') || el.classList.contains('is-folded-group')) return;
        el.classList.add('is-shown');
        el.classList.remove('will-appear');
        syncEdges();
      }, i * stagger);
    });
  }

  syncEdges();

  const orbit = bindOrbit(root, spec, laid);

  return {
    next: () => go(storyIndex + 1),
    prev: () => go(storyIndex - 1),
    step: (i, opts) => go(i, opts),
    index: () => storyIndex,
    expand: (id) => expandTarget(id),
    collapse: (id) => collapseTarget(id),
    expandAll: () => setAllCollapsed(false),
    collapseAll: () => setAllCollapsed(true),
    toggle: (id) => {
      if (groupById[id]) toggleGroup(id);
      else toggleNode(id);
    },
    destroy() {
      orbit.destroy?.();
      window.clearTimeout(foldTimer);
      window.clearTimeout(tipTimer);
      tipPinned = false;
      timers.forEach((id) => clearTimeout(id));
      board.removeEventListener('keydown', onKey);
      board.removeEventListener('dblclick', onBoardDblClick);
      clearZoom();
    },
  };
}
