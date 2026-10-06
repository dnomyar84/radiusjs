/**
 * Layout — template-driven packing (no dagre/elk).
 * Returns boxes in board coordinates.
 */

const PAD = 48;
const GAP = 28;
const NODE_W = 148;
const NODE_H = 72;
const GROUP_PAD = 20;
const TITLE_H = 36;

function measureNode(node) {
  const label = node.label || node.id;
  const lines = Math.min(3, Math.ceil(label.length / 18));
  const h = Math.max(NODE_H, 52 + lines * 16);
  const w = Math.min(200, Math.max(NODE_W, 24 + Math.min(label.length, 22) * 7));
  return { w, h };
}

function layeredOrder(nodes, edges) {
  const ids = nodes.map((n) => n.id);
  const indeg = Object.fromEntries(ids.map((id) => [id, 0]));
  const outs = Object.fromEntries(ids.map((id) => [id, []]));
  for (const e of edges) {
    if (indeg[e.to] != null) indeg[e.to]++;
    if (outs[e.from]) outs[e.from].push(e.to);
  }
  const ranks = {};
  const queue = ids.filter((id) => indeg[id] === 0);
  if (!queue.length) queue.push(...ids);
  let guard = 0;
  while (queue.length && guard++ < ids.length * 3) {
    const id = queue.shift();
    if (ranks[id] != null) continue;
    const preds = edges.filter((e) => e.to === id).map((e) => e.from);
    const r = preds.length ? Math.max(...preds.map((p) => (ranks[p] ?? 0))) + 1 : 0;
    ranks[id] = r;
    for (const t of outs[id] || []) {
      indeg[t]--;
      if (indeg[t] <= 0) queue.push(t);
    }
  }
  for (const id of ids) if (ranks[id] == null) ranks[id] = 0;
  return ranks;
}

function layoutProcess(spec, board) {
  const n = spec.nodes.length;
  const sizes = spec.nodes.map(measureNode);
  const totalW = sizes.reduce((s, x) => s + x.w, 0) + GAP * Math.max(0, n - 1);
  let x = Math.max(PAD, (board.w - totalW) / 2);
  const y = board.h / 2 - NODE_H / 2;
  const boxes = {};
  spec.nodes.forEach((node, i) => {
    const { w, h } = sizes[i];
    boxes[node.id] = { x, y: y - (h - NODE_H) / 2, w, h, rank: i };
    x += w + GAP;
  });
  return boxes;
}

function layoutDeck(spec, board) {
  const n = spec.nodes.length;
  const cols = Math.min(3, n);
  const rows = Math.ceil(n / cols);
  const sizes = spec.nodes.map(measureNode);
  const cellW = (board.w - PAD * 2 - GAP * (cols - 1)) / cols;
  const cellH = (board.h - PAD * 2 - TITLE_H - GAP * (rows - 1)) / rows;
  const boxes = {};
  spec.nodes.forEach((node, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const { w, h } = sizes[i];
    boxes[node.id] = {
      x: PAD + c * (cellW + GAP) + (cellW - w) / 2,
      y: PAD + TITLE_H + r * (cellH + GAP) + (cellH - h) / 2,
      w,
      h,
      rank: i,
    };
  });
  return boxes;
}

function layoutHub(spec, board) {
  const boxes = {};
  const cx = board.w / 2;
  const cy = board.h / 2 + 8;
  const hub = spec.nodes[0];
  const satellites = spec.nodes.slice(1);
  const hs = measureNode(hub);
  boxes[hub.id] = { x: cx - hs.w / 2, y: cy - hs.h / 2, w: hs.w, h: hs.h, rank: 0 };
  const R = Math.min(board.w, board.h) * 0.32;
  satellites.forEach((node, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(satellites.length, 1);
    const s = measureNode(node);
    boxes[node.id] = {
      x: cx + Math.cos(a) * R - s.w / 2,
      y: cy + Math.sin(a) * R - s.h / 2,
      w: s.w,
      h: s.h,
      rank: i + 1,
    };
  });
  return boxes;
}

function layoutFlow(spec, board) {
  const ranks = layeredOrder(spec.nodes, spec.edges);
  const byRank = {};
  for (const n of spec.nodes) {
    const r = ranks[n.id];
    (byRank[r] ||= []).push(n);
  }
  const rankKeys = Object.keys(byRank).map(Number).sort((a, b) => a - b);
  const boxes = {};
  const colW = (board.w - PAD * 2) / Math.max(rankKeys.length, 1);
  rankKeys.forEach((r, ri) => {
    const col = byRank[r];
    const sizes = col.map(measureNode);
    const totalH = sizes.reduce((s, x) => s + x.h, 0) + GAP * Math.max(0, col.length - 1);
    let y = Math.max(PAD + TITLE_H, (board.h - totalH) / 2);
    col.forEach((node, i) => {
      const { w, h } = sizes[i];
      boxes[node.id] = {
        x: PAD + ri * colW + (colW - w) / 2,
        y,
        w,
        h,
        rank: r,
      };
      y += h + GAP;
    });
  });
  return boxes;
}

function layoutCloud(spec, board) {
  const allGroups = (spec.groups || []).map((g) => ({
    ...g,
    members: (g.members?.length
      ? g.members
      : spec.nodes.filter((n) => n.group === g.id).map((n) => n.id)
    ).filter(Boolean),
    children: [],
  }));

  if (!allGroups.length) {
    allGroups.push({
      id: '_default',
      label: '',
      members: spec.nodes.map((n) => n.id),
      family: null,
      parent: null,
      children: [],
      collapsed: false,
      expandable: false,
    });
  }

  const byId = Object.fromEntries(allGroups.map((g) => [g.id, g]));
  const roots = [];
  for (const g of allGroups) {
    if (g.parent && byId[g.parent]) byId[g.parent].children.push(g);
    else roots.push(g);
  }

  const memberSet = new Set(allGroups.flatMap((g) => g.members));
  const orphans = spec.nodes.filter((n) => !memberSet.has(n.id) && !n.group);
  if (orphans.length) {
    roots.push({
      id: '_ungrouped',
      label: '',
      members: orphans.map((n) => n.id),
      family: null,
      parent: null,
      children: [],
      collapsed: false,
      expandable: false,
    });
  }

  // Nodes claimed by nested groups should not also pack in the parent
  const boxes = {};
  const groupBoxes = {};
  const colGap = GAP;
  const usable = board.w - PAD * 2 - colGap * Math.max(0, roots.length - 1);
  const colW = usable / Math.max(roots.length, 1);
  const top = PAD + TITLE_H + 8;
  const maxH = board.h - top - PAD;

  function packGroup(g, gx, gy, gw, depth, rankBase) {
    const childMemberIds = new Set(g.children.flatMap((c) => c.members));
    const nodes = g.members
      .filter((id) => !childMemberIds.has(id))
      .map((id) => spec.nodes.find((n) => n.id === id))
      .filter(Boolean);

    const nestPad = 12;
    const header = 32;
    const gap = nodes.length + g.children.length > 4 ? 12 : 18;

    // Measure children first (recursive heights)
    const childLayouts = [];
    let childBlockH = 0;
    g.children.forEach((child, ci) => {
      const innerW = gw - nestPad * 2;
      const est = estimateGroupHeight(child);
      childLayouts.push({ child, h: est, ci });
      childBlockH += est + (ci ? gap : 0);
    });

    const sizes = nodes.map(measureNode);
    const nodesH = sizes.reduce((s, x) => s + x.h, 0) + gap * Math.max(0, nodes.length - 1);
    const rawInner = header + (nodes.length ? nodesH + 8 : 0) + (g.children.length ? childBlockH + 8 : 0);
    const gh = Math.max(48, rawInner + nestPad);
    const hCollapsed = 48;

    groupBoxes[g.id] = {
      x: gx,
      y: gy,
      w: gw,
      h: Math.min(gh, maxH - (gy - top)),
      hCollapsed,
      hExpanded: Math.min(gh, maxH - (gy - top)),
      label: g.label,
      family: g.family,
      parent: g.parent || null,
      depth,
      members: g.members.slice(),
      childIds: g.children.map((c) => c.id),
      collapsed: !!g.collapsed,
      expandable: g.expandable !== false && (g.members.length > 0 || g.children.length > 0),
    };

    const box = groupBoxes[g.id];
    const scale = Math.min(1, (box.hExpanded - header - nestPad) / Math.max(1, rawInner - header));

    let y = gy + header;
    nodes.forEach((node, i) => {
      const { w, h } = sizes[i];
      const nh = Math.max(40, h * scale);
      const nw = Math.min(w, gw - nestPad * 2);
      boxes[node.id] = {
        x: gx + (gw - nw) / 2,
        y,
        w: nw,
        h: nh,
        rank: rankBase + i,
        group: g.id,
      };
      y += nh + gap * scale;
    });

    g.children.forEach((child, ci) => {
      const ch = childLayouts[ci].h * scale;
      packGroup(child, gx + nestPad, y, gw - nestPad * 2, depth + 1, rankBase + 100 * (ci + 1));
      // fix height after pack
      if (groupBoxes[child.id]) {
        groupBoxes[child.id].hExpanded = Math.max(groupBoxes[child.id].hExpanded, 48);
        y += groupBoxes[child.id].hExpanded + gap * scale;
      } else {
        y += ch + gap * scale;
      }
    });

    // Recompute expanded height from content
    const contentBottom = y + nestPad / 2;
    box.hExpanded = Math.max(hCollapsed, contentBottom - gy);
    if (!box.collapsed) box.h = box.hExpanded;
    else box.h = hCollapsed;
    return box.hExpanded;
  }

  function estimateGroupHeight(g) {
    const childMemberIds = new Set(g.children.flatMap((c) => c.members));
    const nodes = g.members
      .filter((id) => !childMemberIds.has(id))
      .map((id) => spec.nodes.find((n) => n.id === id))
      .filter(Boolean);
    const gap = 14;
    const nodesH = nodes.reduce((s, n) => s + measureNode(n).h + gap, 0);
    const kids = g.children.reduce((s, c) => s + estimateGroupHeight(c) + gap, 0);
    return 40 + nodesH + kids + 16;
  }

  roots.forEach((g, gi) => {
    const gx = PAD + gi * (colW + colGap);
    packGroup(g, gx, top, colW, 0, gi * 1000);
  });

  return { boxes, groupBoxes };
}

function layoutNkp(spec, board) {
  // Hub-spoke: first node or kind nkp.management as hub
  const hub =
    spec.nodes.find((n) => (n.kind || '').includes('management')) || spec.nodes[0];
  const rest = spec.nodes.filter((n) => n.id !== hub.id);
  const fake = { ...spec, nodes: [hub, ...rest] };
  return layoutHub(fake, board);
}

function routeEdges(boxes, edges) {
  return edges.map((e) => {
    const a = boxes[e.from];
    const b = boxes[e.to];
    if (!a || !b) return null;
    const x1 = a.x + a.w;
    const y1 = a.y + a.h / 2;
    const x2 = b.x;
    const y2 = b.y + b.h / 2;
    const mx = (x1 + x2) / 2;
    // orthogonal: H then V then H
    const d = `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
    return { ...e, d, x1, y1, x2, y2 };
  }).filter(Boolean);
}

export function layout(spec, board = { w: 960, h: 540 }) {
  const t = spec.template;
  let boxes;
  let groupBoxes = {};

  if (t === 'process') boxes = layoutProcess(spec, board);
  else if (t === 'deck' || t === 'bars') boxes = layoutDeck(spec, board);
  else if (t === 'hub') boxes = layoutHub(spec, board);
  else if (t === 'nkp') boxes = layoutNkp(spec, board);
  else if (t === 'cloud' || t === 'gis' || t === 'k8s') {
    const r = layoutCloud(spec, board);
    boxes = r.boxes;
    groupBoxes = r.groupBoxes;
  } else {
    // flow, sequence, hierarchy — layered
    boxes = layoutFlow(spec, board);
  }

  // appear order: explicit appear, else rank, else index
  const appearOrder = [...spec.nodes]
    .map((n, i) => ({
      id: n.id,
      order: n.appear != null ? n.appear : (boxes[n.id]?.rank ?? i),
      i,
    }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((x) => x.id);

  const routes = routeEdges(boxes, spec.edges);

  return {
    board,
    boxes,
    groupBoxes,
    routes,
    appearOrder,
    metrics: {
      gap: GAP,
      pad: PAD,
      nodeCount: spec.nodes.length,
      edgeCount: spec.edges.length,
    },
  };
}

export function layoutReport(spec, laid) {
  const overlaps = [];
  const ids = Object.keys(laid.boxes);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = laid.boxes[ids[i]];
      const b = laid.boxes[ids[j]];
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      if (ox > 1 && oy > 1) overlaps.push([ids[i], ids[j], ox * oy]);
    }
  }
  return { overlaps, appearOrder: laid.appearOrder, metrics: laid.metrics };
}
