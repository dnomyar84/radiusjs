/**
 * Edge endpoint resolution — parent↔parent attach, and promote
 * child endpoints to the nearest visible collapsed ancestor.
 */

/** Build membership + parent indexes from a spec. */
export function edgeIndex(spec) {
  const nodesById = Object.fromEntries((spec.nodes || []).map((n) => [n.id, n]));
  const groupsById = Object.fromEntries((spec.groups || []).map((g) => [g.id, g]));
  const memberOf = {};
  for (const g of spec.groups || []) {
    for (const m of g.members || []) memberOf[m] = g.id;
  }
  const childOf = {};
  for (const n of spec.nodes || []) {
    if (n.parent) childOf[n.id] = n.parent;
  }
  return { nodesById, groupsById, memberOf, childOf, spec };
}

function parentNodeCollapsed(pid, idx) {
  const p = idx.nodesById[pid];
  if (!p) return false;
  const hasKids = (idx.spec.nodes || []).some((c) => c.parent === pid);
  if (!hasKids) return false;
  return p.collapsed !== false;
}

/**
 * Resolve an IR endpoint id to the nearest visible attach target
 * using collapse state from the spec (pre-layout / ELK).
 */
export function promoteEndpoint(id, idx) {
  let cur = id;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);

    if (idx.groupsById[cur]) {
      const parent = idx.groupsById[cur].parent;
      if (parent && idx.groupsById[parent]?.collapsed) {
        cur = parent;
        continue;
      }
      return cur;
    }

    if (idx.nodesById[cur]) {
      const pid = idx.childOf[cur];
      if (pid && parentNodeCollapsed(pid, idx)) {
        cur = pid;
        continue;
      }
      let gid = idx.memberOf[cur] || (pid ? idx.memberOf[pid] : null);
      while (gid) {
        if (idx.groupsById[gid]?.collapsed) return promoteEndpoint(gid, idx);
        gid = idx.groupsById[gid]?.parent;
      }
      return cur;
    }

    return cur;
  }
  return cur;
}

/**
 * Rewrite edges so endpoints reference visible parents when children
 * sit inside collapsed containers. Drops self-loops after promotion.
 */
export function promoteEdges(spec) {
  const idx = edgeIndex(spec);
  const out = [];
  const seen = new Set();
  for (const e of spec.edges || []) {
    const from = promoteEndpoint(e.from, idx);
    const to = promoteEndpoint(e.to, idx);
    if (!from || !to || from === to) continue;
    const key = `${from}->${to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...e,
      from,
      to,
      logicalFrom: e.from,
      logicalTo: e.to,
      promoted: from !== e.from || to !== e.to,
    });
  }
  return out;
}

/**
 * Post-layout: walk folded boxes up to a visible node or group face.
 * Nodes inside a folded/collapsed ancestor group climb even if their own
 * `folded` flag was not set (e.g. expand child tiers, then collapse parent).
 * @returns {{ id, endpoint, x, y, w, h } | null}
 */
export function resolveVisibleEndpoint(id, boxes, groupBoxes = {}) {
  let cur = id;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);

    const n = boxes[cur];
    if (n) {
      if (n.parentNode && boxes[n.parentNode]?.collapsed) {
        cur = n.parentNode;
        continue;
      }
      // Climb one ancestor group at a time when that group is collapsed or folded
      let gid = n.group;
      let climbTo = null;
      while (gid) {
        const ag = groupBoxes[gid];
        if (!ag) break;
        if (ag.collapsed || ag.folded) {
          climbTo = gid;
          break;
        }
        gid = ag.parent;
      }
      if (climbTo) {
        cur = climbTo;
        continue;
      }
      if (n.folded) {
        if (n.parentNode) {
          cur = n.parentNode;
          continue;
        }
        if (n.group) {
          cur = n.group;
          continue;
        }
        return null;
      }
      return {
        id: cur,
        endpoint: 'node',
        group: n.group || null,
        x: n.x,
        y: n.y,
        w: n.w,
        h: n.isParent && n.collapsed ? (n.hCollapsed ?? n.h) : n.h,
      };
    }

    const g = groupBoxes[cur];
    if (g) {
      if (g.folded && g.parent) {
        cur = g.parent;
        continue;
      }
      // Collapsed group nested under another collapsed/folded parent
      if (g.collapsed && g.parent) {
        const p = groupBoxes[g.parent];
        if (p && (p.collapsed || p.folded)) {
          cur = g.parent;
          continue;
        }
      }
      return {
        id: cur,
        endpoint: 'group',
        group: g.parent || cur,
        x: g.x,
        y: g.y,
        w: g.collapsed ? (g.wCollapsed ?? g.w) : (g.wExpanded ?? g.w),
        h: g.collapsed ? g.hCollapsed : (g.hExpanded ?? g.h),
      };
    }

    return null;
  }
  return null;
}

function dominantSide(box, toward) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const tx = toward.x + (toward.w || 0) / 2;
  const ty = toward.y + (toward.h || 0) / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  // Prefer the facing side when boxes share a corridor (stacked or side-by-side)
  const overlapX =
    Math.min(box.x + box.w, toward.x + (toward.w || 0)) - Math.max(box.x, toward.x);
  const overlapY =
    Math.min(box.y + box.h, toward.y + (toward.h || 0)) - Math.max(box.y, toward.y);
  const minW = Math.min(box.w, toward.w || box.w);
  const minH = Math.min(box.h, toward.h || box.h);
  if (overlapX > minW * 0.2 && Math.abs(dy) >= Math.abs(dx) * 0.55) {
    return dy >= 0 ? 'bottom' : 'top';
  }
  if (overlapY > minH * 0.2 && Math.abs(dx) >= Math.abs(dy) * 0.55) {
    return dx >= 0 ? 'right' : 'left';
  }
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'bottom' : 'top';
}

const PORT_GAP = 12;
const CHANNEL_GAP = 16;
const AVOID_PAD = 8;

/** Point on a box face, staggered when several edges share the side. */
function portPoint(box, side, index, count) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const maxOff =
    side === 'left' || side === 'right'
      ? Math.max(10, box.h * 0.38)
      : Math.max(10, box.w * 0.38);
  const raw = count <= 1 ? 0 : (index - (count - 1) / 2) * PORT_GAP;
  const o = Math.max(-maxOff, Math.min(maxOff, raw));
  switch (side) {
    case 'right':
      return { x: box.x + box.w, y: cy + o };
    case 'left':
      return { x: box.x, y: cy + o };
    case 'bottom':
      return { x: cx + o, y: box.y + box.h };
    case 'top':
    default:
      return { x: cx + o, y: box.y };
  }
}

function sortPortOrder(items, side) {
  return [...items].sort((a, b) => {
    if (side === 'left' || side === 'right') return a.otherY - b.otherY || a.i - b.i;
    return a.otherX - b.otherX || a.i - b.i;
  });
}

/**
 * Bare caption AABB for an expanded virtual group (CSS: top/left inset, ~0.62rem).
 * Expanded frames stay corridors; only this label chip must be avoided.
 */
export function virtualCaptionBox(id, g) {
  const text = String(g.label || id).toUpperCase();
  const lines = g.face?.lines?.length || (g.face?.display || text).split('\n').length || 1;
  const fontPx = g.face?.fontPx || 10;
  // Match .is-virtual.is-expanded face; use measured face when present
  const w = Math.min(
    Math.max(40, (g.w || 120) - 12),
    g.face?.w != null
      ? Math.ceil(g.face.w + 8)
      : Math.ceil(text.length * 7.2 + 36),
  );
  const h = Math.max(26, Math.ceil(lines * fontPx * 1.2 + 8));
  return {
    id: `${id}__caption`,
    x: g.x + 4,
    y: g.y + 2,
    w,
    h,
    kind: 'caption',
    groupId: id,
  };
}

/**
 * Thin bands along an expanded virtual group's dotted frame.
 * Label-only — edges still cross the corridor; chips must not sit on the dash.
 */
export function virtualBorderBoxes(id, g) {
  const t = 12; // avoid band thickness (border + breathing room)
  const { x, y, w, h } = g;
  if (!(w > 0 && h > 0)) return [];
  return [
    { id: `${id}__bt`, x: x - t / 2, y: y - t / 2, w: w + t, h: t, kind: 'vborder', groupId: id },
    { id: `${id}__bb`, x: x - t / 2, y: y + h - t / 2, w: w + t, h: t, kind: 'vborder', groupId: id },
    { id: `${id}__bl`, x: x - t / 2, y: y + t / 2, w: t, h: Math.max(0, h - t), kind: 'vborder', groupId: id },
    { id: `${id}__br`, x: x + w - t / 2, y: y + t / 2, w: t, h: Math.max(0, h - t), kind: 'vborder', groupId: id },
  ];
}

/** Caption + dotted-frame bands for edge-label deconflict (not path routing). */
export function collectLabelObstacles(groupBoxes = {}) {
  const out = [];
  for (const [id, g] of Object.entries(groupBoxes || {})) {
    if (!g || g.folded || g.collapsed || !g.virtual || id.startsWith('_')) continue;
    out.push(virtualCaptionBox(id, g));
    out.push(...virtualBorderBoxes(id, g));
  }
  return out;
}

/** Visible boxes that edges must not cross (folded / park boxes skipped). */
export function collectObstacles(boxes, groupBoxes = {}) {
  const out = [];
  for (const [id, b] of Object.entries(boxes || {})) {
    if (!b || b.folded) continue;
    const h = b.isParent && b.collapsed ? (b.hCollapsed ?? b.h) : b.h;
    const stack = Math.min(4, Math.max(0, Number(b.stack) || 0));
    const extra = stack * 5;
    out.push({ id, x: b.x, y: b.y, w: b.w + extra, h: h + extra, kind: 'node' });
  }
  for (const [id, g] of Object.entries(groupBoxes || {})) {
    if (!g || g.folded || id.startsWith('_')) continue;
    // Expanded virtual: keep frame open, but block the bare caption text.
    if (!g.collapsed && g.virtual) {
      out.push(virtualCaptionBox(id, g));
      continue;
    }
    // Expanded solid frames are corridors — only collapsed faces block.
    if (!g.collapsed) continue;
    out.push({
      id,
      x: g.x,
      y: g.y,
      w: g.wCollapsed ?? g.w,
      h: g.hCollapsed ?? g.h,
      kind: 'group',
    });
  }
  return out;
}

function inflate(box, pad = AVOID_PAD) {
  return {
    id: box.id,
    x: box.x - pad,
    y: box.y - pad,
    w: box.w + pad * 2,
    h: box.h + pad * 2,
  };
}

/** Segment vs AABB (inclusive), treating near-miss as hit. */
function segHitsBox(x1, y1, x2, y2, box) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < box.x || minX > box.x + box.w || maxY < box.y || minY > box.y + box.h) {
    return false;
  }
  // Axis-aligned segment: clip to box projection
  if (Math.abs(x1 - x2) < 0.5) {
    const x = x1;
    return x >= box.x && x <= box.x + box.w && maxY >= box.y && minY <= box.y + box.h;
  }
  if (Math.abs(y1 - y2) < 0.5) {
    const y = y1;
    return y >= box.y && y <= box.y + box.h && maxX >= box.x && minX <= box.x + box.w;
  }
  // Diagonal: sample a few points (enough for short chords)
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return true;
  }
  return false;
}

function polylineHits(points, obstacles) {
  if (!points || points.length < 2) return false;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    for (const raw of obstacles) {
      const box = inflate(raw);
      if (segHitsBox(a.x, a.y, b.x, b.y, box)) return true;
    }
  }
  return false;
}

function pathResult(points, style, channel) {
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  const mid = points[Math.floor(points.length / 2)] || points[0];
  const mid2 = points[Math.ceil((points.length - 1) / 2)] || mid;
  return {
    d,
    points,
    labelX: (mid.x + mid2.x) / 2,
    labelY: (mid.y + mid2.y) / 2 - 8,
    style,
    channel,
  };
}

const PORT_STUB = 14;

function sideIsHoriz(side) {
  return side === 'left' || side === 'right';
}

/** Point just outside a port, along the face normal (exit or approach). */
function stubOutside(p, side, len = PORT_STUB) {
  switch (side) {
    case 'right':
      return { x: p.x + len, y: p.y };
    case 'left':
      return { x: p.x - len, y: p.y };
    case 'bottom':
      return { x: p.x, y: p.y + len };
    case 'top':
    default:
      return { x: p.x, y: p.y - len };
  }
}

function segmentAxis(a, b) {
  if (Math.abs(a.y - b.y) < 0.5) return 'h';
  if (Math.abs(a.x - b.x) < 0.5) return 'v';
  return 'd';
}

/** First/last segments must meet the face perpendicularly (and from outside). */
function approachesOk(points, fromSide, toSide) {
  if (!points || points.length < 2) return false;
  const wantFirst = sideIsHoriz(fromSide) ? 'h' : 'v';
  const wantLast = sideIsHoriz(toSide) ? 'h' : 'v';
  if (segmentAxis(points[0], points[1]) !== wantFirst) return false;
  if (segmentAxis(points[points.length - 2], points[points.length - 1]) !== wantLast) {
    return false;
  }
  const a0 = points[0];
  const a1 = points[1];
  const b0 = points[points.length - 2];
  const b1 = points[points.length - 1];
  const exitOk =
    (fromSide === 'left' && a1.x <= a0.x + 0.5) ||
    (fromSide === 'right' && a1.x >= a0.x - 0.5) ||
    (fromSide === 'top' && a1.y <= a0.y + 0.5) ||
    (fromSide === 'bottom' && a1.y >= a0.y - 0.5);
  const enterOk =
    (toSide === 'left' && b0.x <= b1.x + 0.5) ||
    (toSide === 'right' && b0.x >= b1.x - 0.5) ||
    (toSide === 'top' && b0.y <= b1.y + 0.5) ||
    (toSide === 'bottom' && b0.y >= b1.y - 0.5);
  return exitOk && enterOk;
}

/** Resolve mid-channel coordinate: prefer shared absolute lane, else mid + offset. */
function midChannel(a, b, channelOffset, channelAbs) {
  if (channelAbs != null && Number.isFinite(channelAbs)) return channelAbs;
  return (a + b) / 2 + (channelOffset || 0);
}

function buildStraight(p1, p2, channelOffset) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * channelOffset;
  const oy = (dx / len) * channelOffset;
  const a = { x: p1.x + ox, y: p1.y + oy };
  const b = { x: p2.x + ox, y: p2.y + oy };
  return pathResult([a, b], 'straight', channelOffset);
}

function sideNormal(side) {
  switch (side) {
    case 'right':
      return { x: 1, y: 0 };
    case 'left':
      return { x: -1, y: 0 };
    case 'bottom':
      return { x: 0, y: 1 };
    default:
      return { x: 0, y: -1 };
  }
}

function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/**
 * Mermaid-like organic cubic: stub out of faces, then C through control points
 * pulled along port normals (with slight parallel offset).
 */
function buildCurve(p1, p2, fromSide, toSide, channelOffset = 0) {
  const out = stubOutside(p1, fromSide);
  const inn = stubOutside(p2, toSide);
  const dx = inn.x - out.x;
  const dy = inn.y - out.y;
  const dist = Math.hypot(dx, dy) || 1;
  const pull = Math.min(140, Math.max(36, dist * 0.42));
  const n1 = sideNormal(fromSide);
  const n2 = sideNormal(toSide);
  const px = (-dy / dist) * (channelOffset || 0);
  const py = (dx / dist) * (channelOffset || 0);
  const c1 = { x: out.x + n1.x * pull + px, y: out.y + n1.y * pull + py };
  const c2 = { x: inn.x + n2.x * pull + px, y: inn.y + n2.y * pull + py };
  const d = `M ${p1.x} ${p1.y} L ${out.x} ${out.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${inn.x} ${inn.y} L ${p2.x} ${p2.y}`;
  const samples = [p1, out];
  for (let i = 1; i <= 8; i++) samples.push(cubicPoint(out, c1, c2, inn, i / 8));
  samples.push(p2);
  const mid = samples[Math.floor(samples.length / 2)];
  return {
    d,
    points: samples,
    labelX: mid.x,
    labelY: mid.y - 8,
    style: 'curve',
    channel: channelOffset,
  };
}

/**
 * Ortho route that exits perpendicular to fromSide and enters perpendicular to toSide.
 * H↔H → hvh; V↔V → vhv; H→V → hv; V→H → vh (with optional mid channel).
 * `channelAbs` is a shared corridor coordinate so parallel elbows space evenly.
 */
function buildOrthogonal(p1, p2, fromSide, toSide, channelOffset, channelAbs = null) {
  const out = stubOutside(p1, fromSide);
  const inn = stubOutside(p2, toSide);
  const fromH = sideIsHoriz(fromSide);
  const toH = sideIsHoriz(toSide);

  if (fromH && toH) {
    const mx = midChannel(out.x, inn.x, channelOffset, channelAbs);
    return pathResult(
      [p1, out, { x: mx, y: out.y }, { x: mx, y: inn.y }, inn, p2],
      'hvh',
      mx,
    );
  }
  if (!fromH && !toH) {
    const my = midChannel(out.y, inn.y, channelOffset, channelAbs);
    return pathResult(
      [p1, out, { x: out.x, y: my }, { x: inn.x, y: my }, inn, p2],
      'vhv',
      my,
    );
  }
  if (fromH && !toH) {
    // Horizontal exit → vertical entry
    const mx = midChannel(out.x, inn.x, channelOffset, channelAbs);
    return pathResult(
      [p1, out, { x: mx, y: out.y }, { x: mx, y: inn.y }, inn, p2],
      'hv',
      mx,
    );
  }
  // Vertical exit → horizontal entry
  const my = midChannel(out.y, inn.y, channelOffset, channelAbs);
  return pathResult(
    [p1, out, { x: out.x, y: my }, { x: inn.x, y: my }, inn, p2],
    'vh',
    my,
  );
}

/** Candidate mid-X channels: shared lane plus clear detours beside obstacles. */
function channelXs(p1, p2, obstacles, channelOffset, channelAbs = null) {
  const base = midChannel(p1.x, p2.x, channelOffset, channelAbs);
  const xs = [base, base - CHANNEL_GAP, base + CHANNEL_GAP];
  const lo = Math.min(p1.x, p2.x);
  const hi = Math.max(p1.x, p2.x);
  for (const o of obstacles) {
    if (o.x + o.w < lo - 40 || o.x > hi + 40) continue;
    xs.push(o.x - AVOID_PAD - 4);
    xs.push(o.x + o.w + AVOID_PAD + 4);
  }
  xs.push(lo - 28, hi + 28);
  return [...new Set(xs.map((v) => Math.round(v)))];
}

function channelYs(p1, p2, obstacles, channelOffset, channelAbs = null) {
  const base = midChannel(p1.y, p2.y, channelOffset, channelAbs);
  const ys = [base, base - CHANNEL_GAP, base + CHANNEL_GAP];
  const lo = Math.min(p1.y, p2.y);
  const hi = Math.max(p1.y, p2.y);
  for (const o of obstacles) {
    if (o.y + o.h < lo - 40 || o.y > hi + 40) continue;
    ys.push(o.y - AVOID_PAD - 4);
    ys.push(o.y + o.h + AVOID_PAD + 4);
  }
  ys.push(lo - 28, hi + 28);
  return [...new Set(ys.map((v) => Math.round(v)))];
}

/**
 * Go-around corridors stay inside the relevant parent:
 *  · bottom skirt → lower endpoint’s parent (floor)
 *  · top skirt    → higher endpoint’s parent (ceiling)
 * Layout grows that parent when a wrap U-turn needs room.
 */
const PARENT_EDGE_INSET = 10;
/** Local band for left/right go-arounds (vertical skirts use parent floor/ceil). */
const AROUND_LOCAL = 72;

/** @returns {{ floorY: number|null, ceilY: number|null }} */
export function detourParentBounds(a, b, groupBoxes = {}) {
  if (!a || !b) return { floorY: null, ceilY: null };
  const aBottom = a.y + a.h;
  const bBottom = b.y + b.h;
  const lower = aBottom >= bBottom ? a : b;
  const higher = a.y <= b.y ? a : b;
  const lowerGid = lower.group || (lower.endpoint === 'group' ? lower.id : null);
  const higherGid = higher.group || (higher.endpoint === 'group' ? higher.id : null);
  const lowerParent = lowerGid ? groupBoxes[lowerGid] : null;
  const higherParent = higherGid ? groupBoxes[higherGid] : null;
  const floorY = lowerParent
    ? lowerParent.y + (lowerParent.hExpanded ?? lowerParent.h) - PARENT_EDGE_INSET
    : null;
  // Stay under the caption / head pad of the higher endpoint’s parent
  const head = higherParent?.virtual ? 28 : 36;
  const ceilY = higherParent ? higherParent.y + head : null;
  return { floorY, ceilY };
}

function aroundTop(p1, p2, fromSide, toSide, obstacles, channelOffset, bounds = null) {
  const out = stubOutside(p1, fromSide);
  const inn = stubOutside(p2, toSide);
  const x0 = Math.min(out.x, inn.x) - 24;
  const x1 = Math.max(out.x, inn.x) + 24;
  const portTop = Math.min(out.y, inn.y);
  let top = portTop - 28;
  for (const o of obstacles) {
    if (o.x + o.w < x0 || o.x > x1) continue;
    // Only clear obstacles between the ceiling and the ports
    if (bounds?.ceilY != null && o.y + o.h < bounds.ceilY) continue;
    if (o.y > Math.max(out.y, inn.y) + 8) continue;
    if (o.y + o.h < portTop - 80) continue;
    top = Math.min(top, o.y - AVOID_PAD - 6);
  }
  top += channelOffset * 0.25;
  // Highest allowed: higher endpoint’s parent interior
  if (bounds?.ceilY != null) {
    top = Math.max(top, bounds.ceilY);
    // Still leave a stub above the higher port when parent is tight
    top = Math.min(top, portTop - 14);
  }
  const pts = [p1, out, { x: out.x, y: top }, { x: inn.x, y: top }, inn, p2];
  return pathResult(pts, 'avoid-top', top);
}

function aroundBottom(p1, p2, fromSide, toSide, obstacles, channelOffset, bounds = null) {
  const out = stubOutside(p1, fromSide);
  const inn = stubOutside(p2, toSide);
  const x0 = Math.min(out.x, inn.x) - 24;
  const x1 = Math.max(out.x, inn.x) + 24;
  const portBot = Math.max(out.y, inn.y);
  let bot = portBot + 28;
  for (const o of obstacles) {
    if (o.x + o.w < x0 || o.x > x1) continue;
    // Only clear obstacles between the ports and the parent floor
    if (bounds?.floorY != null && o.y > bounds.floorY) continue;
    if (o.y + o.h < Math.min(out.y, inn.y) - 8) continue;
    if (o.y > portBot + 80) continue;
    bot = Math.max(bot, o.y + o.h + AVOID_PAD + 6);
  }
  bot += channelOffset * 0.25;
  // Lowest allowed: lower endpoint’s parent interior
  if (bounds?.floorY != null) {
    bot = Math.min(bot, bounds.floorY);
    bot = Math.max(bot, portBot + 14);
  }
  return pathResult(
    [p1, out, { x: out.x, y: bot }, { x: inn.x, y: bot }, inn, p2],
    'avoid-bottom',
    bot,
  );
}

function aroundLeft(p1, p2, fromSide, toSide, obstacles, channelOffset) {
  const out = stubOutside(p1, fromSide);
  const inn = stubOutside(p2, toSide);
  const y0 = Math.min(out.y, inn.y) - 24;
  const y1 = Math.max(out.y, inn.y) + 24;
  const bandLo = Math.min(out.x, inn.x) - AROUND_LOCAL;
  const bandHi = Math.max(out.x, inn.x) + 8;
  let left = Math.min(out.x, inn.x) - 28;
  for (const o of obstacles) {
    if (o.y + o.h < y0 || o.y > y1) continue;
    if (o.x + o.w < bandLo || o.x > bandHi) continue;
    left = Math.min(left, o.x - AVOID_PAD - 6);
  }
  left += channelOffset * 0.25;
  return pathResult(
    [p1, out, { x: left, y: out.y }, { x: left, y: inn.y }, inn, p2],
    'avoid-left',
    left,
  );
}

function aroundRight(p1, p2, fromSide, toSide, obstacles, channelOffset) {
  const out = stubOutside(p1, fromSide);
  const inn = stubOutside(p2, toSide);
  const y0 = Math.min(out.y, inn.y) - 24;
  const y1 = Math.max(out.y, inn.y) + 24;
  const bandLo = Math.min(out.x, inn.x) - 8;
  const bandHi = Math.max(out.x, inn.x) + AROUND_LOCAL;
  let right = Math.max(out.x, inn.x) + 28;
  for (const o of obstacles) {
    if (o.y + o.h < y0 || o.y > y1) continue;
    if (o.x + o.w < bandLo || o.x > bandHi) continue;
    right = Math.max(right, o.x + o.w + AVOID_PAD + 6);
  }
  right += channelOffset * 0.25;
  return pathResult(
    [p1, out, { x: right, y: out.y }, { x: right, y: inn.y }, inn, p2],
    'avoid-right',
    right,
  );
}

function pathLength(points) {
  let n = 0;
  for (let i = 1; i < points.length; i++) {
    n += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return n;
}

function estimateLabelSize(label) {
  if (!label) return { w: 0, h: 0 };
  const text = String(label);
  return {
    w: Math.min(120, Math.max(32, text.length * 6.4 + 14)),
    h: 18,
  };
}

/** Visual AABB for an edge label anchored at (x,y) with CSS translate(-50%, -100%). */
function labelAABB(x, y, w, h) {
  return { x: x - w / 2, y: y - h, w, h };
}

function aabbHitsObstacles(box, obstacles, pad = 4) {
  if (!box || !box.w) return false;
  for (const o of obstacles || []) {
    const ox = o.x - pad;
    const oy = o.y - pad;
    const ow = o.w + pad * 2;
    const oh = o.h + pad * 2;
    if (box.x + box.w <= ox || box.x >= ox + ow || box.y + box.h <= oy || box.y >= oy + oh) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Pick label anchor along the path: prefer the longest clear segment midpoint.
 * Falls back to geometric mid if nothing clears.
 */
function placeLabelOnPath(points, label, obstacles) {
  const { w, h } = estimateLabelSize(label);
  const mid = points[Math.floor(points.length / 2)] || points[0];
  const mid2 = points[Math.ceil((points.length - 1) / 2)] || mid;
  const fallback = {
    labelX: (mid.x + mid2.x) / 2,
    labelY: (mid.y + mid2.y) / 2 - 8,
  };
  if (!w || !points || points.length < 2) return fallback;

  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 8) continue;
    // Sample along the segment (and slightly above for horizontal runs)
    const samples = Math.max(3, Math.min(9, Math.floor(len / 24) + 1));
    for (let s = 1; s < samples; s++) {
      const t = s / samples;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;
      const candidates = [
        { x, y: y - 8 },
        { x, y: y - h - 4 },
        { x, y: y + 4 },
      ];
      for (const c of candidates) {
        const box = labelAABB(c.x, c.y, w, h);
        const hit = aabbHitsObstacles(box, obstacles);
        // Prefer long segments, mid-ish placement, clear of boxes
        const midness = 1 - Math.abs(t - 0.5) * 2;
        const score = (hit ? -4000 : 2000) + len * 2 + midness * 40;
        if (score > bestScore) {
          bestScore = score;
          best = { labelX: c.x, labelY: c.y, hit };
        }
      }
    }
  }
  if (!best) return fallback;
  return { labelX: best.labelX, labelY: best.labelY, labelHit: !!best.hit };
}

/** Priority weights — shorter/simpler first; creative wraps cost more. */
const ROUTE_STYLE_COST = {
  straight: 0,
  curve: 4,
  hvh: 10,
  vhv: 10,
  hv: 15,
  vh: 15,
  'avoid-top': 120,
  'avoid-bottom': 130,
  'avoid-left': 140,
  'avoid-right': 140,
  'lane-above': 80,
  'lane-below': 90,
  'lane-c-above': 220,
  'lane-c-below': 240,
  'lane-wrap-above': 420,
  'lane-wrap-below': 440,
};

function uLanePath(p1, p2, out, inn, laneY, style) {
  return pathResult(
    [p1, out, { x: out.x, y: laneY }, { x: inn.x, y: laneY }, inn, p2],
    style,
    laneY,
  );
}

/**
 * Creative label corridors when a short chord has no room for text:
 * U (up→across→down / down→across→up), then C, then longer wrap.
 */
function labelLaneDetours(p1, p2, fromSide, toSide, obstacles, channelOffset, labelW) {
  const out = stubOutside(p1, fromSide);
  const inn = stubOutside(p2, toSide);
  const fromH = sideIsHoriz(fromSide);
  const toH = sideIsHoriz(toSide);
  const outList = [];
  const pad = AVOID_PAD + 6;
  const labelClear = Math.max(22, (labelW || 40) * 0.15 + 18);

  if (fromH && toH) {
    // Horizontal ports: lanes above / below the pair
    let above = Math.min(out.y, inn.y) - labelClear;
    let below = Math.max(out.y, inn.y) + labelClear;
    for (const o of obstacles) {
      // Only obstacles that overlap the x-span between stubs
      const spanLo = Math.min(out.x, inn.x) - 8;
      const spanHi = Math.max(out.x, inn.x) + 8;
      if (o.x + o.w < spanLo || o.x > spanHi) continue;
      above = Math.min(above, o.y - pad - 4);
      below = Math.max(below, o.y + o.h + pad + 4);
    }
    above += channelOffset * 0.2;
    below += channelOffset * 0.2;
    outList.push(uLanePath(p1, p2, out, inn, above, 'lane-above'));
    outList.push(uLanePath(p1, p2, out, inn, below, 'lane-below'));

    // C-shape: step back past the source, then lane across, then into target
    let back = Math.min(out.x, inn.x) - 36 - Math.abs(channelOffset);
    let ahead = Math.max(out.x, inn.x) + 36 + Math.abs(channelOffset);
    for (const o of obstacles) {
      back = Math.min(back, o.x - pad);
      ahead = Math.max(ahead, o.x + o.w + pad);
    }
    // Prefer stepping behind the exit direction
    const stepX = fromSide === 'right' ? Math.min(back, out.x - 28) : Math.max(ahead, out.x + 28);
    for (const [laneY, style] of [
      [above - 12, 'lane-c-above'],
      [below + 12, 'lane-c-below'],
    ]) {
      outList.push(
        pathResult(
          [
            p1,
            out,
            { x: stepX, y: out.y },
            { x: stepX, y: laneY },
            { x: inn.x, y: laneY },
            inn,
            p2,
          ],
          style,
          laneY,
        ),
      );
    }

    // Longer wrap: back → far lane → past target → into approach
    const farAbove = above - 36;
    const farBelow = below + 36;
    const pastX = toSide === 'left' ? Math.max(ahead, inn.x + 28) : Math.min(back, inn.x - 28);
    for (const [laneY, style] of [
      [farAbove, 'lane-wrap-above'],
      [farBelow, 'lane-wrap-below'],
    ]) {
      outList.push(
        pathResult(
          [
            p1,
            out,
            { x: stepX, y: out.y },
            { x: stepX, y: laneY },
            { x: pastX, y: laneY },
            { x: pastX, y: inn.y },
            inn,
            p2,
          ],
          style,
          laneY,
        ),
      );
    }
  } else if (!fromH && !toH) {
    // Vertical ports: lanes left / right
    let left = Math.min(out.x, inn.x) - labelClear;
    let right = Math.max(out.x, inn.x) + labelClear;
    for (const o of obstacles) {
      const spanLo = Math.min(out.y, inn.y) - 8;
      const spanHi = Math.max(out.y, inn.y) + 8;
      if (o.y + o.h < spanLo || o.y > spanHi) continue;
      left = Math.min(left, o.x - pad - 4);
      right = Math.max(right, o.x + o.w + pad + 4);
    }
    left += channelOffset * 0.2;
    right += channelOffset * 0.2;
    outList.push(
      pathResult(
        [p1, out, { x: left, y: out.y }, { x: left, y: inn.y }, inn, p2],
        'lane-above', // reuse weight tier (left ≈ above priority)
        left,
      ),
    );
    outList.push(
      pathResult(
        [p1, out, { x: right, y: out.y }, { x: right, y: inn.y }, inn, p2],
        'lane-below',
        right,
      ),
    );
  }

  return outList;
}

/**
 * Prefer clear routes: ortho → label lanes → go-around.
 * Weighted cost: length + bends + style priority; label/box hits heavily penalized.
 */
function buildAvoidingRoute(
  p1,
  p2,
  fromSide,
  toSide,
  obstacles,
  excludeIds,
  channelOffset,
  preferStraight,
  label = null,
  channelAbs = null,
  parentBounds = null,
  preferCurve = false,
) {
  const obs = (obstacles || []).filter((o) => !excludeIds.has(o.id));
  const candidates = [];
  const out = stubOutside(p1, fromSide);
  const inn = stubOutside(p2, toSide);
  const fromH = sideIsHoriz(fromSide);
  const toH = sideIsHoriz(toSide);
  const { w: labelW } = estimateLabelSize(label);

  if (preferCurve) {
    candidates.push(buildCurve(p1, p2, fromSide, toSide, channelOffset));
    // Mild alternate bends for parallel spokes
    candidates.push(buildCurve(p1, p2, fromSide, toSide, channelOffset + 12));
    candidates.push(buildCurve(p1, p2, fromSide, toSide, channelOffset - 12));
  }

  if (preferStraight) {
    candidates.push(buildStraight(p1, p2, channelOffset));
  }

  // Primary: respect both port normals (skipped as primary when curving)
  if (!preferCurve) {
    candidates.push(buildOrthogonal(p1, p2, fromSide, toSide, channelOffset, channelAbs));

    if (fromH && toH) {
      for (const mx of channelXs(out, inn, obs, channelOffset, channelAbs)) {
        candidates.push(
          pathResult(
            [p1, out, { x: mx, y: out.y }, { x: mx, y: inn.y }, inn, p2],
            'hvh',
            mx,
          ),
        );
      }
    } else if (!fromH && !toH) {
      for (const my of channelYs(out, inn, obs, channelOffset, channelAbs)) {
        candidates.push(
          pathResult(
            [p1, out, { x: out.x, y: my }, { x: inn.x, y: my }, inn, p2],
            'vhv',
            my,
          ),
        );
      }
    } else if (fromH && !toH) {
      for (const mx of channelXs(out, inn, obs, channelOffset, channelAbs)) {
        candidates.push(
          pathResult(
            [p1, out, { x: mx, y: out.y }, { x: mx, y: inn.y }, inn, p2],
            'hv',
            mx,
          ),
        );
      }
    } else {
      for (const my of channelYs(out, inn, obs, channelOffset, channelAbs)) {
        candidates.push(
          pathResult(
            [p1, out, { x: out.x, y: my }, { x: inn.x, y: my }, inn, p2],
            'vh',
            my,
          ),
        );
      }
    }
  }

  // Label corridors / go-arounds — ortho only (curves prefer soft organic paths)
  if (!preferCurve) {
    if (label) {
      candidates.push(...labelLaneDetours(p1, p2, fromSide, toSide, obs, channelOffset, labelW));
    }
    candidates.push(
      aroundTop(p1, p2, fromSide, toSide, obs, channelOffset, parentBounds),
      aroundBottom(p1, p2, fromSide, toSide, obs, channelOffset, parentBounds),
      aroundLeft(p1, p2, fromSide, toSide, obs, channelOffset),
      aroundRight(p1, p2, fromSide, toSide, obs, channelOffset),
    );
  } else {
    // Fallback ortho if every curve is terrible
    candidates.push(buildOrthogonal(p1, p2, fromSide, toSide, channelOffset, channelAbs));
  }

  let best = null;
  let bestCost = Infinity;

  for (const c of candidates) {
    if (!c?.points?.length) continue;
    const placed = placeLabelOnPath(c.points, label, obs);
    c.labelX = placed.labelX;
    c.labelY = placed.labelY;
    const len = pathLength(c.points);
    const bends = Math.max(0, c.points.length - 2);
    const legal =
      preferStraight || preferCurve || approachesOk(c.points, fromSide, toSide);
    const pathHit = polylineHits(c.points, obs);
    const labelHit =
      !!label &&
      aabbHitsObstacles(
        labelAABB(placed.labelX, placed.labelY, labelW, estimateLabelSize(label).h),
        obs,
      );
    const styleCost = ROUTE_STYLE_COST[c.style] ?? 160;
    const manh = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
    // Punish board-spanning detours so a local U-turn beats a clear global skirt
    const excess = Math.max(0, len - manh * 1.4);
    let cost = len + bends * 26 + styleCost + excess * 4;
    if (!legal) cost += 6000;
    // Curves may graze boxes — soft penalty so organic wins over huge skirts
    if (pathHit) cost += preferCurve && c.style === 'curve' ? 180 : 1e6;
    if (labelHit) cost += 9000;
    if (cost < bestCost) {
      bestCost = cost;
      best = c;
    }
  }

  return best || candidates[0];
}

function channelBucket(style, ideal) {
  // Coarser bins so parallel L↔R (vertical mid-runs) share one corridor
  return `${style}:${Math.round(ideal / 48)}`;
}

/** Union distinct labels when several edges collapse to one parent↔parent arrow. */
export function mergeEdgeLabels(...labels) {
  const parts = [];
  const seen = new Set();
  for (const raw of labels) {
    if (raw == null || raw === '') continue;
    for (const piece of String(raw).split(/\s*[·|,;/]\s*/)) {
      const t = piece.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      parts.push(t);
    }
  }
  return parts.length ? parts.join(' · ') : null;
}

/** Prefer straight chords in isometric / perspective worlds; mindmap uses curves. */
export function edgeRouteMode(spec) {
  if (!spec) return 'ortho';
  if (spec.route === 'curve' || spec.route === 'ortho' || spec.route === 'straight') {
    return spec.route;
  }
  if (spec.template === 'mindmap') return 'curve';
  if (spec.template === 'constellation') return 'straight';
  if (spec.look === 'perspective' || spec.theme === 'neon') return 'straight';
  return 'ortho';
}

/**
 * Route IR edges with fold promotion + self-spaced turns + box avoidance.
 * @param {object} [opts]
 * @param {'ortho'|'straight'|'curve'} [opts.mode]
 */
export function routeEdges(boxes, edges, groupBoxes = {}, opts = {}) {
  const mode = opts.mode || 'ortho';
  const preferStraight = mode === 'straight';
  const preferCurve = mode === 'curve';
  const obstacles = collectObstacles(boxes, groupBoxes);
  const drafts = [];

  for (let i = 0; i < edges.length; i++) {
    const e = edges[i];
    const a = resolveVisibleEndpoint(e.from, boxes, groupBoxes);
    const b = resolveVisibleEndpoint(e.to, boxes, groupBoxes);
    if (!a || !b) continue;
    if (a.id === b.id) {
      // Self-loop after promotion (child→child under same collapsed parent) — drop
      continue;
    }
    drafts.push({
      e,
      a,
      b,
      hidden: false,
      fromSide: dominantSide(a, b),
      toSide: dominantSide(b, a),
      otherFromX: b.x + b.w / 2,
      otherFromY: b.y + b.h / 2,
      otherToX: a.x + a.w / 2,
      otherToY: a.y + a.h / 2,
      i,
      logicalFrom: e.logicalFrom || e.from,
      logicalTo: e.logicalTo || e.to,
      mergedCount: 1,
    });
  }

  // Parent/child fold: many grandchild edges that promote to the same
  // visible pair collapse to a single arrow (not N parallel parent→parent).
  const collapsed = [];
  const byPair = new Map();
  for (const d of drafts) {
    const key = `${d.a.id}\0${d.b.id}`;
    const prev = byPair.get(key);
    if (prev) {
      prev.mergedCount += 1;
      prev.mergedLogical = prev.mergedLogical || [
        { from: prev.logicalFrom, to: prev.logicalTo },
      ];
      prev.mergedLogical.push({ from: d.logicalFrom, to: d.logicalTo });
      // Union distinct edge labels onto the surviving chip (e.g. 443 · 6443)
      const mergedLabel = mergeEdgeLabels(prev.e.label, d.e.label);
      if (mergedLabel && mergedLabel !== prev.e.label) {
        prev.e = { ...prev.e, label: mergedLabel };
      }
      continue;
    }
    byPair.set(key, d);
    collapsed.push(d);
  }

  // Stagger ports that share a face
  const fromGroups = new Map();
  const toGroups = new Map();
  for (const d of collapsed) {
    const fk = `${d.a.id}:${d.fromSide}`;
    const tk = `${d.b.id}:${d.toSide}`;
    if (!fromGroups.has(fk)) fromGroups.set(fk, []);
    if (!toGroups.has(tk)) toGroups.set(tk, []);
    fromGroups.get(fk).push(d);
    toGroups.get(tk).push(d);
  }
  for (const [, list] of fromGroups) {
    const side = list[0].fromSide;
    const ordered = sortPortOrder(
      list.map((d) => ({ d, otherX: d.otherFromX, otherY: d.otherFromY, i: d.i })),
      side,
    );
    ordered.forEach((item, idx) => {
      item.d.fromSlot = idx;
      item.d.fromCount = ordered.length;
    });
  }
  for (const [, list] of toGroups) {
    const side = list[0].toSide;
    const ordered = sortPortOrder(
      list.map((d) => ({ d, otherX: d.otherToX, otherY: d.otherToY, i: d.i })),
      side,
    );
    ordered.forEach((item, idx) => {
      item.d.toSlot = idx;
      item.d.toCount = ordered.length;
    });
  }

  // Ideal mid channels, then spread siblings in the same corridor
  for (const d of collapsed) {
    d.p1 = portPoint(d.a, d.fromSide, d.fromSlot ?? 0, d.fromCount ?? 1);
    d.p2 = portPoint(d.b, d.toSide, d.toSlot ?? 0, d.toCount ?? 1);
    if (preferStraight) {
      d.style = 'straight';
      d.ideal = 0;
      d.bucket = `straight:${d.a.id}->${d.b.id}`;
    } else if (preferCurve) {
      d.style = 'curve';
      d.ideal = 0;
      d.bucket = `curve:${d.a.id}->${d.b.id}`;
    } else {
      const fromH = d.fromSide === 'left' || d.fromSide === 'right';
      const toH = d.toSide === 'left' || d.toSide === 'right';
      d.style = fromH && toH ? 'hvh' : !fromH && !toH ? 'vhv' : fromH ? 'hv' : 'vh';
      d.ideal =
        fromH && toH
          ? (d.p1.x + d.p2.x) / 2
          : !fromH && !toH
            ? (d.p1.y + d.p2.y) / 2
            : fromH
              ? (d.p1.x + d.p2.x) / 2
              : (d.p1.y + d.p2.y) / 2;
      d.bucket = channelBucket(d.style, d.ideal);
    }
  }

  const buckets = new Map();
  for (const d of collapsed) {
    if (!buckets.has(d.bucket)) buckets.set(d.bucket, []);
    buckets.get(d.bucket).push(d);
  }
  for (const list of buckets.values()) {
    // Order along the transverse axis so equal lane gaps read top→bottom / left→right
    list.sort((a, b) => {
      const aVert = a.style === 'hvh' || a.style === 'hv';
      const bVert = b.style === 'hvh' || b.style === 'hv';
      if (aVert && bVert) {
        return (a.p1.y + a.p2.y) / 2 - (b.p1.y + b.p2.y) / 2 || a.i - b.i;
      }
      const aHoriz = a.style === 'vhv' || a.style === 'vh';
      const bHoriz = b.style === 'vhv' || b.style === 'vh';
      if (aHoriz && bHoriz) {
        return (a.p1.x + a.p2.x) / 2 - (b.p1.x + b.p2.x) / 2 || a.i - b.i;
      }
      return a.ideal - b.ideal || a.i - b.i;
    });
    // Shared corridor center — offsets alone space siblings (not mid_i + offset_i)
    const base = list.reduce((s, d) => s + d.ideal, 0) / list.length;
    list.forEach((d, idx) => {
      d.channelOffset = (idx - (list.length - 1) / 2) * CHANNEL_GAP;
      d.channel = base + d.channelOffset;
    });
  }

  const routed = collapsed.map((d) => {
    const exclude = new Set([d.a.id, d.b.id]);
    const parentBounds = detourParentBounds(d.a, d.b, groupBoxes);
    const routedPath = buildAvoidingRoute(
      d.p1,
      d.p2,
      d.fromSide,
      d.toSide,
      obstacles,
      exclude,
      d.channelOffset || 0,
      preferStraight,
      d.e.label || null,
      d.channel ?? null,
      parentBounds,
      preferCurve,
    );
    return {
      ...d.e,
      d: routedPath.d,
      x1: d.p1.x,
      y1: d.p1.y,
      x2: d.p2.x,
      y2: d.p2.y,
      labelX: routedPath.labelX,
      labelY: routedPath.labelY,
      resolvedFrom: d.a.id,
      resolvedTo: d.b.id,
      fromEndpoint: d.a.endpoint,
      toEndpoint: d.b.endpoint,
      logicalFrom: d.logicalFrom,
      logicalTo: d.logicalTo,
      channelOffset: d.channelOffset || 0,
      channel: d.channel,
      wire: d.e.wire || 'main',
      mergedCount: d.mergedCount || 1,
      promoted: d.a.id !== d.logicalFrom || d.b.id !== d.logicalTo,
      routeMode: routedPath.style || mode,
    };
  });
  const fixed = [
    ...collectLabelObstacles(groupBoxes),
    ...obstacles.filter((o) => o.kind === 'node' || o.kind === 'group' || o.kind === 'caption'),
  ];
  return deconflictEdgeLabels(routed, fixed);
}

/**
 * Separate overlapping edge labels (CSS: translate(-50%, -100%) at labelX/labelY).
 * Multi-pass AABB push — vertical first, then horizontal when heavily stacked.
 * @param {object[]} [fixed] immovable AABBs (virtual captions, dotted borders) to clear
 */
export function deconflictEdgeLabels(routes, fixed = []) {
  if (!routes?.length) return routes || [];
  const items = routes
    .filter((r) => r.label && r.labelX != null && !r.hidden)
    .map((r) => {
      const text = String(r.label);
      const w = Math.min(120, Math.max(32, text.length * 6.4 + 14));
      const h = 18;
      return { r, w, h, x: r.labelX, y: r.labelY || 0 };
    });

  const PAD = 5;
  const CAP_PAD = 8;
  const fixedBoxes = (fixed || []).map((f) => ({
    x1: f.x,
    x2: f.x + f.w,
    y1: f.y,
    y2: f.y + f.h,
    kind: f.kind || 'fixed',
  }));

  for (let pass = 0; pass < 16; pass++) {
    let moved = false;
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        // Visual box: anchor at (x,y), translated -50% x / -100% y
        const ax1 = a.x - a.w / 2;
        const ax2 = a.x + a.w / 2;
        const ay1 = a.y - a.h;
        const ay2 = a.y;
        const bx1 = b.x - b.w / 2;
        const bx2 = b.x + b.w / 2;
        const by1 = b.y - b.h;
        const by2 = b.y;
        const overlapX = Math.min(ax2, bx2) - Math.max(ax1, bx1);
        const overlapY = Math.min(ay2, by2) - Math.max(ay1, by1);
        if (overlapX <= 0 || overlapY <= 0) continue;

        const pushY = overlapY / 2 + PAD;
        // Keep a above, push b down (larger y)
        if (a.y <= b.y) {
          a.y -= pushY;
          b.y += pushY;
        } else {
          b.y -= pushY;
          a.y += pushY;
        }
        // When mostly stacked on the same x, also fan horizontally
        if (overlapX > Math.min(a.w, b.w) * 0.45) {
          const pushX = overlapX / 2 + PAD;
          if (a.x <= b.x) {
            a.x -= pushX * 0.6;
            b.x += pushX * 0.6;
          } else {
            b.x -= pushX * 0.6;
            a.x += pushX * 0.6;
          }
        }
        moved = true;
      }

      // Push edge labels clear of fixed obstacles (captions + dotted borders)
      const a = items[i];
      for (const f of fixedBoxes) {
        const pad = f.kind === 'caption' ? CAP_PAD : PAD;
        let guard = 0;
        while (guard++ < 6) {
          const ax1 = a.x - a.w / 2;
          const ax2 = a.x + a.w / 2;
          const ay1 = a.y - a.h;
          const ay2 = a.y;
          const overlapX = Math.min(ax2, f.x2) - Math.max(ax1, f.x1);
          const overlapY = Math.min(ay2, f.y2) - Math.max(ay1, f.y1);
          if (overlapX <= 0 || overlapY <= 0) break;

          const opts = [
            { dx: -(overlapX + pad), dy: 0, cost: overlapX + pad },
            { dx: overlapX + pad, dy: 0, cost: overlapX + pad },
            { dx: 0, dy: -(overlapY + pad), cost: overlapY + pad },
            { dx: 0, dy: overlapY + pad, cost: overlapY + pad },
          ];
          // Captions sit at the top of frames — prefer sliding below into content
          if (f.kind === 'caption') opts[3].cost *= 0.4;
          opts.sort((p, q) => p.cost - q.cost);
          a.x += opts[0].dx;
          a.y += opts[0].dy;
          moved = true;
        }
      }
    }
    if (!moved) break;
  }

  for (const it of items) {
    it.r.labelX = Math.round(it.x);
    it.r.labelY = Math.round(it.y);
  }
  return routes;
}

/**
 * Ensure folded children of collapsed parents exist as park boxes
 * so resolveVisibleEndpoint can climb to the parent face.
 */
export function parkFoldedChildren(spec, boxes, groupBoxes) {
  for (const g of spec.groups || []) {
    const gb = groupBoxes[g.id];
    if (!gb) continue;
    if (g.collapsed) {
      for (const mid of g.members || []) {
        if (!boxes[mid]) {
          boxes[mid] = { x: gb.x, y: gb.y, w: 1, h: 1, folded: true, group: g.id };
        } else {
          boxes[mid].folded = true;
          boxes[mid].group = g.id;
        }
      }
      for (const child of (spec.groups || []).filter((c) => c.parent === g.id)) {
        const childG = groupBoxes[child.id];
        if (childG) {
          childG.folded = true;
          childG.parent = g.id;
        }
      }
    }
  }
  for (const n of spec.nodes || []) {
    if (!n.parent) continue;
    const p = boxes[n.parent];
    if (!p?.collapsed) continue;
    if (!boxes[n.id]) {
      boxes[n.id] = {
        x: p.x,
        y: p.y,
        w: 1,
        h: 1,
        folded: true,
        parentNode: n.parent,
        group: p.group || null,
      };
    } else {
      boxes[n.id].folded = true;
      boxes[n.id].parentNode = n.parent;
    }
  }
  return boxes;
}
