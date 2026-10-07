/**
 * Layout — native packers + optional elkjs for graph templates.
 * Timeline / deck / hub / mindmap / constellation / sequence / hierarchy stay Radius-native.
 */

import { measureNode, measureFace, FACE_H, FACE_W, LABEL_GROW_MAX_W } from './labels.js';
import {
  parkFoldedChildren,
  routeEdges,
  edgeRouteMode,
  deconflictEdgeLabels,
  collectLabelObstacles,
} from './edges.js';
import { layoutWithElk, usesElk } from './layout-elk.js';
import { packConstellation3d, projectConstellation } from './orbit.js';

const PAD = 48;
const GAP = 28;
/** Extra parent height so wrap U-turn edges stay inside the lower/higher row’s parent. */
const WRAP_EDGE_PAD = 36;
const TITLE_H = 36;
const NEST = 12;
/** Expanded virtual group: tiny bare label, not a card strip. */
const VIRTUAL_HEAD = 22;

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
    const r =
      nodes.find((n) => n.id === id)?.rank != null
        ? Number(nodes.find((n) => n.id === id).rank)
        : preds.length
          ? Math.max(...preds.map((p) => ranks[p] ?? 0)) + 1
          : 0;
    ranks[id] = r;
    for (const t of outs[id] || []) {
      indeg[t]--;
      if (indeg[t] <= 0) queue.push(t);
    }
  }
  for (const id of ids) if (ranks[id] == null) ranks[id] = 0;
  return ranks;
}

function sortNodes(list) {
  return [...list].sort((a, b) => {
    const ao = a.order != null ? a.order : 0;
    const bo = b.order != null ? b.order : 0;
    if (ao !== bo) return ao - bo;
    return 0;
  });
}

function layoutProcess(spec, board) {
  const nodes = sortNodes(spec.nodes);
  const sizes = nodes.map((n) => measureNode(n));
  const totalW = sizes.reduce((s, x) => s + x.w, 0) + GAP * Math.max(0, nodes.length - 1);
  let x = Math.max(PAD, (board.w - totalW) / 2);
  const y = board.h / 2 - FACE_H / 2;
  const boxes = {};
  nodes.forEach((node, i) => {
    const { w, h } = sizes[i];
    boxes[node.id] = { x, y: y - (h - FACE_H) / 2, w, h, rank: i, measure: sizes[i] };
    x += w + GAP;
  });
  return boxes;
}

function layoutDeck(spec, board) {
  const nodes = sortNodes(spec.nodes);
  const n = nodes.length;
  const cols = Math.min(3, n);
  const rows = Math.ceil(n / cols);
  const sizes = nodes.map((n) => measureNode(n));
  const cellW = (board.w - PAD * 2 - GAP * (cols - 1)) / cols;
  const cellH = (board.h - PAD * 2 - TITLE_H - GAP * (rows - 1)) / rows;
  const boxes = {};
  nodes.forEach((node, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const { w, h } = sizes[i];
    boxes[node.id] = {
      x: PAD + c * (cellW + GAP) + (cellW - w) / 2,
      y: PAD + TITLE_H + r * (cellH + GAP) + (cellH - h) / 2,
      w,
      h,
      rank: i,
      measure: sizes[i],
    };
  });
  return boxes;
}

function layoutHub(spec, board) {
  const boxes = {};
  const cx = board.w / 2;
  const cy = board.h / 2 + 8;
  const nodes = sortNodes(spec.nodes);
  const hub = nodes[0];
  const satellites = nodes.slice(1);
  const hs = measureNode(hub);
  boxes[hub.id] = { x: cx - hs.w / 2, y: cy - hs.h / 2, w: hs.w, h: hs.h, rank: 0, measure: hs };
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
      measure: s,
    };
  });
  return boxes;
}

/** Bias measure toward square faces for circle / diamond / hex. */
function measureMindmapNode(node) {
  const shape = node.shape || 'rect';
  const s = measureNode(node);
  if (shape === 'circle' || shape === 'diamond' || shape === 'hex') {
    const side = Math.max(s.w, s.h, 56);
    return { ...s, w: side, h: side };
  }
  if (shape === 'oval') {
    return { ...s, w: Math.max(s.w, 88), h: Math.max(s.h, 48) };
  }
  return s;
}

/**
 * Radial multi-depth mindmap: root at center, children on rings in parent sectors.
 * Tree from `parent:` attrs and/or edges (from → to = parent → child when no parent set).
 */
function layoutMindmap(spec, board) {
  const boxes = {};
  const nodes = sortNodes(spec.nodes);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const kids = Object.fromEntries(nodes.map((n) => [n.id, []]));

  // Explicit parent: edges
  for (const n of nodes) {
    if (n.parent && byId[n.parent] && n.parent !== n.id) {
      kids[n.parent].push(n.id);
    }
  }
  // Edge-inferred parents when child has no parent:
  for (const e of spec.edges || []) {
    if (!byId[e.from] || !byId[e.to] || e.from === e.to) continue;
    const child = byId[e.to];
    if (child.parent) continue;
    if (kids[e.to].includes(e.from)) continue; // would cycle
    if (!kids[e.from].includes(e.to)) kids[e.from].push(e.to);
  }
  for (const id of Object.keys(kids)) {
    kids[id] = kids[id]
      .filter((cid, i, a) => a.indexOf(cid) === i)
      .sort((a, b) => {
        const ao = byId[a].order != null ? Number(byId[a].order) : byId[a].rank != null ? Number(byId[a].rank) : 0;
        const bo = byId[b].order != null ? Number(byId[b].order) : byId[b].rank != null ? Number(byId[b].rank) : 0;
        if (ao !== bo) return ao - bo;
        return String(a).localeCompare(String(b));
      });
  }

  const hasParent = new Set();
  for (const list of Object.values(kids)) for (const c of list) hasParent.add(c);
  const incoming = new Set((spec.edges || []).map((e) => e.to));
  let root =
    nodes.find((n) => !n.parent && !hasParent.has(n.id) && !incoming.has(n.id)) ||
    nodes.find((n) => !n.parent && !hasParent.has(n.id)) ||
    nodes[0];

  const cx = board.w / 2;
  const cy = board.h / 2 + 8;
  const maxR = Math.min(board.w, board.h) * 0.42;
  const R0 = Math.min(board.w, board.h) * 0.22;
  const Rstep = Math.max(90, (maxR - R0) / 3);

  const depthOf = {};
  const angleOf = {};
  const spanOf = {};
  const placed = new Set();

  function placeTree(id, depth, a0, a1) {
    const node = byId[id];
    if (!node || placed.has(id)) return;
    placed.add(id);
    depthOf[id] = depth;
    const mid = (a0 + a1) / 2;
    angleOf[id] = mid;
    spanOf[id] = a1 - a0;
    const s = measureMindmapNode(node);
    const R = depth === 0 ? 0 : R0 + (depth - 1) * Rstep;
    const px = cx + Math.cos(mid) * R - s.w / 2;
    const py = cy + Math.sin(mid) * R - s.h / 2;
    boxes[id] = {
      x: px,
      y: py,
      w: s.w,
      h: s.h,
      rank: depth,
      measure: s,
      shape: node.shape || 'rect',
    };
    const children = kids[id] || [];
    if (!children.length) return;

    // Expanded table: each child is a row element stacked under this face
    const expandable = children.length > 0 && node.expandable !== false;
    const collapsed = expandable ? node.collapsed !== false : false;
    if (node.shape === 'table' && expandable && !collapsed) {
      const rowW = Math.max(s.w, 160);
      let ry = py + s.h + 4;
      let maxRowW = rowW;
      children.forEach((cid, i) => {
        const child = byId[cid];
        if (!child || placed.has(cid)) return;
        placed.add(cid);
        const cs = measureMindmapNode(child);
        const rw = Math.max(rowW, cs.w);
        maxRowW = Math.max(maxRowW, rw);
        boxes[cid] = {
          x: px,
          y: ry,
          w: rw,
          h: cs.h,
          rank: depth + 1,
          measure: cs,
          shape: child.shape || 'rect',
          parentNode: id,
        };
        depthOf[cid] = depth + 1;
        angleOf[cid] = mid;
        ry += cs.h + 2;
      });
      boxes[id].w = maxRowW;
      boxes[id].h = ry - py + 2;
      boxes[id].hExpanded = boxes[id].h;
      children.forEach((cid) => {
        if (boxes[cid]) boxes[cid].w = maxRowW;
      });
      return;
    }

    const slice = (a1 - a0) / children.length;
    children.forEach((cid, i) => {
      placeTree(cid, depth + 1, a0 + i * slice, a0 + (i + 1) * slice);
    });
  }

  // Full circle for root's children; root itself at center
  placeTree(root.id, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);

  // Orphans (not under root) — place on outer ring
  let orphanI = 0;
  const orphans = nodes.filter((n) => !boxes[n.id]);
  for (const n of orphans) {
    const a = -Math.PI / 2 + (orphanI++ * 2 * Math.PI) / Math.max(orphans.length, 1);
    const s = measureMindmapNode(n);
    const R = maxR;
    boxes[n.id] = {
      x: cx + Math.cos(a) * R - s.w / 2,
      y: cy + Math.sin(a) * R - s.h / 2,
      w: s.w,
      h: s.h,
      rank: 99,
      measure: s,
      shape: n.shape || 'rect',
    };
  }

  // Same fold model as cloud/timeline: expandable parents drill element-by-element.
  // Collapsed → park kids; edges promote to the parent face (existing edge logic).
  for (const n of nodes) {
    const b = boxes[n.id];
    if (!b) continue;
    const childIds = kids[n.id] || [];
    const expandable = childIds.length > 0 && n.expandable !== false;
    const collapsed = expandable ? n.collapsed !== false : false;
    const faceH = b.measure?.h ?? b.h;
    b.expandable = expandable;
    b.collapsed = collapsed;
    b.isParent = expandable;
    b.childIds = childIds.slice();
    b.shape = n.shape || b.shape || 'rect';
    if (!expandable) {
      b.hCollapsed = b.h;
      b.hExpanded = b.h;
      continue;
    }
    // Expanded table already grew b.h around stacked row elements.
    const tableOpen = n.shape === 'table' && !collapsed;
    b.hCollapsed = faceH;
    b.hExpanded = tableOpen ? b.h : faceH;
    if (!tableOpen && !collapsed) {
      // Radial children sit outside the face — parent box stays face-sized.
      b.h = faceH;
      b.hExpanded = faceH;
    }
    for (const cid of childIds) {
      const cb = boxes[cid];
      if (!cb) continue;
      cb.parentNode = n.id;
      if (collapsed) {
        cb.folded = true;
        cb.x = b.x;
        cb.y = b.y;
        cb.w = b.w;
        cb.h = faceH;
      }
    }
  }

  return boxes;
}

function layoutFlow(spec, board) {
  const ranks = layeredOrder(spec.nodes, spec.edges);
  const byRank = {};
  for (const n of sortNodes(spec.nodes)) {
    const r = n.rank != null ? Number(n.rank) : ranks[n.id];
    (byRank[r] ||= []).push(n);
  }
  const rankKeys = Object.keys(byRank).map(Number).sort((a, b) => a - b);
  const boxes = {};
  const horizontal = !spec.dir || spec.dir === 'lr' || spec.dir === 'rl';
  if (horizontal) {
    const colW = (board.w - PAD * 2) / Math.max(rankKeys.length, 1);
    rankKeys.forEach((r, ri) => {
      const col = byRank[r];
      const sizes = col.map((n) => measureNode(n));
      const totalH = sizes.reduce((s, x) => s + x.h, 0) + GAP * Math.max(0, col.length - 1);
      let y = Math.max(PAD + TITLE_H, (board.h - totalH) / 2);
      const xi = spec.dir === 'rl' ? rankKeys.length - 1 - ri : ri;
      col.forEach((node, i) => {
        const { w, h } = sizes[i];
        boxes[node.id] = {
          x: PAD + xi * colW + (colW - w) / 2,
          y,
          w,
          h,
          rank: r,
          measure: sizes[i],
          lane: node.lane,
        };
        y += h + GAP;
      });
    });
  } else {
    const rowH = (board.h - PAD * 2 - TITLE_H) / Math.max(rankKeys.length, 1);
    rankKeys.forEach((r, ri) => {
      const row = byRank[r];
      const sizes = row.map((n) => measureNode(n));
      const totalW = sizes.reduce((s, x) => s + x.w, 0) + GAP * Math.max(0, row.length - 1);
      let x = Math.max(PAD, (board.w - totalW) / 2);
      const yi = spec.dir === 'bt' ? rankKeys.length - 1 - ri : ri;
      row.forEach((node, i) => {
        const { w, h } = sizes[i];
        boxes[node.id] = {
          x,
          y: PAD + TITLE_H + yi * rowH + (rowH - h) / 2,
          w,
          h,
          rank: r,
          measure: sizes[i],
          lane: node.lane,
        };
        x += w + GAP;
      });
    });
  }
  return boxes;
}

/** Nested group + node-parent packing; collapsed = element face. */
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
      members: spec.nodes.filter((n) => !n.parent).map((n) => n.id),
      family: null,
      parent: null,
      children: [],
      collapsed: false,
      expandable: false,
      kind: null,
      layer: null,
    });
  }

  const byId = Object.fromEntries(allGroups.map((g) => [g.id, g]));
  const roots = [];
  for (const g of allGroups) {
    if (g.parent && byId[g.parent]) byId[g.parent].children.push(g);
    else roots.push(g);
  }
  // Stable order: rank / order / declaration — matters for dir:tb vertical stacks
  roots.sort((a, b) => {
    const ar = a.rank != null ? Number(a.rank) : a.order != null ? Number(a.order) : 0;
    const br = b.rank != null ? Number(b.rank) : b.order != null ? Number(b.order) : 0;
    if (ar !== br) return ar - br;
    return 0;
  });

  const memberSet = new Set(allGroups.flatMap((g) => g.members));
  const orphans = spec.nodes.filter((n) => !memberSet.has(n.id) && !n.group && !n.parent);
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
      kind: null,
    });
  }

  const boxes = {};
  const groupBoxes = {};
  const colGap = GAP;
  const usable = board.w - PAD * 2;
  const top = PAD + TITLE_H + 8;
  const vertical = spec.dir === 'tb' || spec.dir === 'bt';
  const rtlStack = spec.dir === 'bt';

  const nodeById = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));

  function childNodesOf(id) {
    return sortNodes(spec.nodes.filter((n) => n.parent === id));
  }

  /** Heavier / deeper trees get a wider horizontal share. */
  function subtreeWeight(g) {
    let w = 1 + g.children.length * 2;
    const childMemberIds = new Set(g.children.flatMap((c) => c.members));
    const directMembers = g.members.filter((id) => !childMemberIds.has(id));
    w += directMembers.length * 0.75;
    for (const c of g.children) w += subtreeWeight(c);
    // Expanded parents need room for children to wrap side-by-side
    if (!g.collapsed) w *= 1.4;
    return Math.max(1, w);
  }

  /** Natural width of a node tree (collapsed face or expanded children + pad). */
  function contentWidthForNodeTree(node) {
    const face = measureNode(node);
    const kids = childNodesOf(node.id);
    const expandable = kids.length > 0 && node.expandable !== false;
    const collapsed = expandable ? node.collapsed !== false : false;
    if (!expandable || collapsed) return face.w;
    let maxKid = 0;
    for (const k of kids) maxKid = Math.max(maxKid, contentWidthForNodeTree(k));
    return Math.max(face.w, maxKid + NEST * 2);
  }

  function directRootsForGroup(g) {
    const childMemberIds = new Set(g.children.flatMap((c) => c.members));
    const direct = sortNodes(
      g.members
        .filter((id) => !childMemberIds.has(id))
        .map((id) => nodeById[id])
        .filter(Boolean)
        .filter((n) => !n.parent || !g.members.includes(n.parent)),
    );
    return direct.filter((n) => !n.parent || !direct.some((p) => p.id === n.parent));
  }

  /**
   * Content-weighted width for a group.
   * When members/child-groups need to wrap, claim available width (not a
   * single-column hug) so flowPack fills horizontally before growing taller.
   * Pass fill:false when sizing a sibling unit inside a parent flow so one
   * expanded virtual child does not steal the entire row.
   */
  function contentWidthForGroup(g, availW, { fill = true } = {}) {
    const face = measureFace(g.label || g.id, g.kind, {
      maxBoxW: Math.max(FACE_W + 40, availW - 16),
    });
    const faceW = Math.max(FACE_W, face.w + 24);
    const expandable =
      g.expandable !== false && (g.members.length > 0 || g.children.length > 0);
    if (g.collapsed && expandable) return Math.min(availW, faceW);

    const innerAvail = Math.max(FACE_W, availW - NEST * 2);
    const rootsNodes = directRootsForGroup(g);
    const nodeWs = rootsNodes.map((n) => contentWidthForNodeTree(n));
    const childWs = g.children.map((c) => contentWidthForGroup(c, innerAvail, { fill: false }));

    const rowW =
      nodeWs.length > 0
        ? nodeWs.reduce((s, w) => s + w, 0) + GAP * Math.max(0, nodeWs.length - 1)
        : 0;
    const stackW = nodeWs.length ? Math.max(...nodeWs) : 0;
    // If one row fits, hug it; if not, take full inner width so children wrap L→R
    const membersW =
      rowW <= innerAvail ? Math.max(rowW, stackW) : innerAvail;

    const childRowW =
      childWs.length > 0
        ? childWs.reduce((s, w) => s + w, 0) + GAP * Math.max(0, childWs.length - 1)
        : 0;
    const childStack = childWs.length ? Math.max(...childWs) : 0;
    const nestedW =
      childRowW <= innerAvail ? Math.max(childRowW, childStack) : innerAvail;

    let content = Math.max(faceW, membersW, nestedW, FACE_W);
    // Expanded virtual regions fill their assigned slot (not necessarily the
    // grandparent — callers pass the slot width as availW).
    if (fill && !g.collapsed && g.virtual) content = Math.max(content, innerAvail);
    return Math.min(availW, content + NEST * 2);
  }

  /** Cap flow unit width so nested parents still place several children per row. */
  function flowUnitCap(availW, count) {
    if (count <= 1) return availW;
    const cols = Math.max(2, Math.ceil(Math.sqrt(count)));
    return Math.max(72, (availW - GAP * (cols - 1)) / cols);
  }

  function packNodeTree(node, gx, gy, gw, rankBase) {
    // Remeasure against the real slot (no 56px floor) so deep nests shrink icon+text
    const face = measureNode(node, {
      maxBoxW: Math.max(32, Math.min(LABEL_GROW_MAX_W, gw)),
    });
    const kids = childNodesOf(node.id);
    const expandable = kids.length > 0 && node.expandable !== false;
    const collapsed = expandable ? node.collapsed !== false : false;
    const asTable = node.shape === 'table';

    if (!expandable || collapsed) {
      const w = Math.min(gw, asTable ? Math.max(face.w, Math.min(gw, 200)) : face.w);
      boxes[node.id] = {
        x: gx + (gw - w) / 2,
        y: gy,
        w,
        h: face.h,
        rank: rankBase,
        group: node.group,
        measure: face,
        expandable,
        collapsed: expandable ? true : !!node.collapsed,
        hCollapsed: face.h,
        hExpanded: face.h,
        isParent: expandable,
        childIds: kids.map((k) => k.id),
        layer: node.layer,
        shape: node.shape || 'rect',
      };
      kids.forEach((k, i) => {
        boxes[k.id] = {
          x: gx,
          y: gy,
          w: face.w,
          h: face.h,
          rank: rankBase + i + 1,
          group: node.group,
          parentNode: node.id,
          folded: true,
          measure: measureNode(k),
          shape: k.shape || 'rect',
        };
      });
      return face.h;
    }

    // Table parents: each child is a full-width row element (drill + edges work).
    const natural = asTable ? gw : contentWidthForNodeTree(node);
    const usedW = Math.min(gw, Math.max(natural, asTable ? Math.min(gw, 240) : 0));
    const usedX = gx + (gw - usedW) / 2;
    const innerW = Math.max(40, usedW - (asTable ? 4 : NEST * 2));
    const rowX = usedX + (asTable ? 2 : NEST);
    const rowGap = asTable ? 2 : 10;

    let y = gy + face.h + (asTable ? 4 : 8);
    let innerH = 0;
    kids.forEach((k, i) => {
      const kh = packNodeTree(k, rowX, y, innerW, rankBase + i + 1);
      if (boxes[k.id]) {
        boxes[k.id].parentNode = node.id;
        if (asTable) {
          boxes[k.id].x = rowX;
          boxes[k.id].w = innerW;
        }
      }
      y += kh + rowGap;
      innerH += kh + rowGap;
    });
    const hExpanded = face.h + (asTable ? 4 : 8) + innerH + (asTable ? 4 : 8);
    boxes[node.id] = {
      x: usedX,
      y: gy,
      w: usedW,
      h: hExpanded,
      rank: rankBase,
      group: node.group,
      measure: face,
      expandable: true,
      collapsed: false,
      hCollapsed: face.h,
      hExpanded,
      isParent: true,
      childIds: kids.map((k) => k.id),
      layer: node.layer,
      shape: node.shape || 'rect',
      faceOnly: face,
    };
    return hExpanded;
  }

  /**
   * Wrap units left→right, top→bottom.
   * When wrapping, split counts as evenly as possible across rows
   * (not a packed first row + short remainder like 7+2).
   * Leftover width on each row is spread into slot widths.
   * Each unit: { w, place(x, y, slotW) => heightUsed }
   */
  function flowPack(innerX, startY, innerW, units, gap = GAP) {
    if (!units.length) return { h: 0, rowCount: 0 };
    const sized = units.map((u) => ({
      u,
      w: Math.max(24, Math.min(u.w, innerW)),
    }));
    const n = sized.length;

    const rowFits = (items) => {
      if (!items.length) return true;
      let w = items[0].w;
      for (let i = 1; i < items.length; i++) w += gap + items[i].w;
      return w <= innerW + 0.5;
    };

    // Minimum rows required by width (greedy)
    let minRows = 1;
    let curW = 0;
    let curCount = 0;
    for (const it of sized) {
      const need = it.w + (curCount ? gap : 0);
      if (curCount && curW + need > innerW + 0.5) {
        minRows++;
        curW = it.w;
        curCount = 1;
      } else {
        curW += curCount ? need : it.w;
        curCount++;
      }
    }

    // Prefer balanced counts per row; bump row count if a slice is too wide
    let rows = null;
    for (let rowCount = minRows; rowCount <= n; rowCount++) {
      const base = Math.floor(n / rowCount);
      const rem = n % rowCount;
      const counts = Array.from({ length: rowCount }, (_, i) => base + (i < rem ? 1 : 0));
      const candidate = [];
      let idx = 0;
      let ok = true;
      for (const c of counts) {
        if (c <= 0) continue;
        const slice = sized.slice(idx, idx + c);
        idx += c;
        if (!rowFits(slice)) {
          ok = false;
          break;
        }
        candidate.push(slice);
      }
      if (ok) {
        rows = candidate;
        break;
      }
    }
    if (!rows) {
      // Fallback: classic greedy wrap
      rows = [];
      let cur = [];
      let wSum = 0;
      for (const it of sized) {
        const need = it.w + (cur.length ? gap : 0);
        if (cur.length && wSum + need > innerW + 0.5) {
          rows.push(cur);
          cur = [];
          wSum = 0;
        }
        cur.push(it);
        wSum += cur.length === 1 ? it.w : need;
      }
      if (cur.length) rows.push(cur);
    }

    // Equal-count wrap (e.g. 8 → 2×4): shared column tracks so top/bottom
    // cells line up. Per-row leftover stretch made column midpoints drift.
    const colCount = Math.max(...rows.map((r) => r.length));
    const gridAligned =
      rows.length >= 2 && rows.every((r) => r.length === colCount);

    let y = startY;
    let maxBottom = startY;
    for (let ri = 0; ri < rows.length; ri++) {
      const items = rows[ri];
      let rowH = 0;
      if (gridAligned) {
        const colW = Math.max(24, (innerW - gap * (colCount - 1)) / colCount);
        for (let i = 0; i < items.length; i++) {
          const x = innerX + i * (colW + gap);
          const h = items[i].u.place(x, y, colW);
          rowH = Math.max(rowH, h);
        }
      } else {
        const gaps = gap * Math.max(0, items.length - 1);
        const used = items.reduce((s, it) => s + it.w, 0) + gaps;
        const leftover = Math.max(0, innerW - used);
        const extra = items.length ? leftover / items.length : 0;
        let x = innerX;
        for (const it of items) {
          const slotW = Math.min(innerW, it.w + extra);
          const h = it.u.place(x, y, slotW);
          rowH = Math.max(rowH, h);
          x += slotW + gap;
        }
      }
      maxBottom = Math.max(maxBottom, y + rowH);
      if (ri < rows.length - 1) y += rowH + gap;
    }
    return { h: Math.max(0, maxBottom - startY), rowCount: rows.length };
  }

  function packGroup(g, gx, gy, gw, depth, rankBase) {
    const rootsNodes = directRootsForGroup(g);
    const expandable =
      g.expandable !== false && (g.members.length > 0 || g.children.length > 0);
    const virtual = !!g.virtual;
    const collapsed = !!(g.collapsed && expandable);
    // Measure against the real slot width so parent labels stay one line when space allows
    const face = measureFace(g.label || g.id, g.kind, {
      maxBoxW: Math.max(FACE_W + 40, gw - 16),
    });
    // Virtual expanded captions are uppercase CSS — measure that so wrap matches paint
    const captionFace =
      virtual && !collapsed
        ? measureFace(g.label || g.id, null, {
            maxBoxW: Math.max(96, gw - 20),
            pad: 20,
            maxPx: 10,
            minPx: 9,
            minBoxH: 14,
            maxBoxH: 36,
            lineH: 1.2,
            uppercase: true,
          })
        : face;
    const paintFace = virtual && !collapsed ? captionFace : face;
    const hCollapsed = Math.max(FACE_H, face.h);
    const wCollapsed = Math.min(gw, Math.max(FACE_W, face.w + 24));
    const xCollapsed = gx + (gw - wCollapsed) / 2;
    // Virtual expanded frames fill the slot so children can wrap; solid parents hug content
    const hugW = contentWidthForGroup(g, gw);
    const layoutW = !collapsed && virtual ? gw : collapsed ? wCollapsed : hugW;
    const layoutX = collapsed ? xCollapsed : gx + (gw - layoutW) / 2;

    groupBoxes[g.id] = {
      x: layoutX,
      y: gy,
      w: layoutW,
      wExpanded: virtual ? gw : hugW,
      wCollapsed,
      h: hCollapsed,
      hCollapsed,
      hExpanded: hCollapsed,
      label: g.label,
      family: g.family,
      kind: g.kind,
      parent: g.parent || null,
      depth,
      members: g.members.slice(),
      childIds: g.children.map((c) => c.id),
      collapsed,
      expandable,
      virtual,
      layer: g.layer,
      face: paintFace,
      xExpanded: virtual ? gx : gx + (gw - hugW) / 2,
      xCollapsed,
    };

    const packW = virtual || collapsed ? Math.max(layoutW, hugW, wCollapsed) : layoutW;
    const packX = virtual && !collapsed ? gx : layoutX;
    const innerW = Math.max(FACE_W, packW - NEST * 2);
    const innerX = packX + NEST;
    // Head pad must clear the painted header (chip + label + CSS pad) so
    // children never sit under the parent face.
    const headPad =
      !collapsed && virtual
        ? Math.max(
            VIRTUAL_HEAD,
            Math.ceil((captionFace.lines?.length || 1) * captionFace.fontPx * 1.2 + 10),
          )
        : Math.max(hCollapsed, face.h) + (collapsed ? 0 : 12);
    const contentTop = gy + headPad + (virtual && !collapsed ? 6 : 8);

    // Cap unit widths so subparents fill L→R before wrapping (same rule as root)
    const unitCount = rootsNodes.length + g.children.length;
    const unitCap = flowUnitCap(innerW, unitCount);

    const units = [
      ...rootsNodes.map((node, i) => ({
        w: Math.min(unitCap, contentWidthForNodeTree(node)),
        place(x, y, w) {
          const nh = packNodeTree(node, x, y, w, rankBase + i);
          if (boxes[node.id]) {
            boxes[node.id].group = g.id;
            if (collapsed) boxes[node.id].folded = true;
          }
          if (collapsed) {
            childNodesOf(node.id).forEach((k) => {
              if (boxes[k.id]) boxes[k.id].folded = true;
            });
          }
          return nh;
        },
      })),
      ...g.children.map((child, ci) => ({
        w: Math.min(
          unitCap,
          Math.max(FACE_W, contentWidthForGroup(child, innerW, { fill: false })),
        ),
        place(x, y, w) {
          const ch = packGroup(child, x, y, w, depth + 1, rankBase + 100 * (ci + 1));
          const cb = groupBoxes[child.id];
          if (cb && collapsed) cb.folded = true;
          return ch;
        },
      })),
    ];

    const packed = units.length ? flowPack(innerX, contentTop, innerW, units) : { h: 0, rowCount: 0 };
    // Multi-row wrap: grow this parent so edge U-turns stay inside (lower/higher
    // endpoint rule — never skirt through a neighbor swimlane).
    const wrapPad = packed.rowCount > 1 ? WRAP_EDGE_PAD : 0;
    const hExpanded = Math.max(
      hCollapsed + 40,
      headPad + (virtual && !collapsed ? 6 : 10) + packed.h + wrapPad + NEST,
    );

    const box = groupBoxes[g.id];
    box.hExpanded = hExpanded;
    box.wExpanded = virtual ? gw : Math.max(hugW, packW);
    if (collapsed) {
      box.h = hCollapsed;
      box.x = xCollapsed;
      box.w = wCollapsed;
      return hCollapsed;
    }
    box.h = hExpanded;
    box.w = layoutW;
    box.x = layoutX;
    return hExpanded;
  }

  // Root packing: weight by tree depth/breadth, flow-wrap rows (or vertical stack when dir:tb|bt).
  // Avoids equal columns (deep trees cramped; shallow trees with empty air below).
  const MIN_ROOT_W = Math.max(FACE_W + 48, 160);
  const weights = roots.map((g) => subtreeWeight(g));
  const weightSum = weights.reduce((s, w) => s + w, 0) || 1;

  const preferred = roots.map((g, i) => {
    const hug = contentWidthForGroup(g, usable);
    const share = (weights[i] / weightSum) * usable;
    // Collapsed: hug the face. Expanded: at least weighted share so kids can wrap.
    if (g.collapsed) return Math.min(usable, Math.max(MIN_ROOT_W, hug));
    return Math.min(usable, Math.max(MIN_ROOT_W, hug, share));
  });

  if (vertical) {
    // Top→bottom stack still uses the full board width so children fill L→R
    // inside each band (no narrow centered column with empty right gutter).
    const ordered = rtlStack ? [...roots].reverse() : roots;
    const placed = [];
    let y = top;
    for (let i = 0; i < ordered.length; i++) {
      const g = ordered[i];
      const idx = roots.indexOf(g);
      const h = packGroup(g, PAD, y, usable, 0, idx * 1000);
      placed.push({ id: g.id, h });
      y += h + colGap;
    }
    // Leftover board height (same idea as horizontal leftover → slot widths):
    //  · any expanded root → grow each band's height equally (top-aligned content)
    //  · all collapsed → equal gaps including top/bottom
    // Skip when content already fills/overflows (fit-scale handles that).
    if (placed.length > 1) {
      const contentH = placed.reduce((s, p) => s + p.h, 0);
      const avail = Math.max(0, board.h - PAD - top);
      const free = avail - contentH;
      if (free > 16) {
        const anyExpanded = ordered.some((g) => {
          const expandable =
            g.expandable !== false && (g.members.length > 0 || g.children.length > 0);
          return expandable && !g.collapsed;
        });
        if (anyExpanded) {
          // Equal swimlane slots fill the board; content is re-spread inside
          // each taller band (same idea as leftover width → wider child slots).
          const gap = colGap;
          const stretch = Math.max(0, free - gap * Math.max(0, placed.length - 1));
          const slotH = stretch / placed.length;
          let ny = top;
          for (let i = 0; i < placed.length; i++) {
            const p = placed[i];
            const gb = groupBoxes[p.id];
            const bandH = p.h + slotH;
            if (gb) {
              const dy = ny - gb.y;
              gb.y = ny;
              gb.h = bandH;
              gb.hExpanded = bandH;
              if (dy) shiftGroupTreeContents(gb, boxes, groupBoxes, dy);
              if (slotH > 8) spreadBandContentVertically(gb, boxes, groupBoxes, slotH);
            }
            ny += bandH + (i < placed.length - 1 ? gap : 0);
          }
        } else {
          const gap = free / (placed.length + 1);
          let ny = top + gap;
          for (const p of placed) {
            const gb = groupBoxes[p.id];
            if (gb) {
              const dy = ny - gb.y;
              gb.y = ny;
              if (dy) shiftGroupTreeContents(gb, boxes, groupBoxes, dy);
            }
            ny += p.h + gap;
          }
        }
      }
    }
    return { boxes, groupBoxes };
  }

  function shiftGroupTreeContents(gb, boxesMap, groupMap, dy) {
    if (!gb || !dy) return;
    for (const id of gb.members || []) {
      const b = boxesMap[id];
      if (b && !b.folded) b.y += dy;
    }
    for (const cid of gb.childIds || []) {
      const child = groupMap[cid];
      if (!child) continue;
      child.y += dy;
      shiftGroupTreeContents(child, boxesMap, groupMap, dy);
    }
  }

  /** Cluster direct children into rows; fold leftover height into equal gutters. */
  function spreadBandContentVertically(gb, boxesMap, groupMap, spare) {
    if (!gb || spare < 8) return;
    const items = [];
    for (const id of gb.members || []) {
      const b = boxesMap[id];
      if (b && !b.folded) items.push({ kind: 'node', id, y: b.y, h: b.h });
    }
    for (const cid of gb.childIds || []) {
      const child = groupMap[cid];
      if (child && !child.folded) items.push({ kind: 'group', id: cid, y: child.y, h: child.h });
    }
    if (!items.length) return;
    items.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
    const rows = [];
    for (const it of items) {
      const last = rows[rows.length - 1];
      if (!last || Math.abs(it.y - last.y) > 6) rows.push({ y: it.y, items: [it] });
      else last.items.push(it);
    }
    // Preserve natural row spacing; add equal leading / between / trailing gutters
    const gutter = spare / (rows.length + 1);
    for (let i = 0; i < rows.length; i++) {
      const dy = gutter * (i + 1);
      if (!dy) continue;
      for (const it of rows[i].items) {
        if (it.kind === 'node') {
          const b = boxesMap[it.id];
          if (b) b.y += dy;
        } else {
          const child = groupMap[it.id];
          if (child) {
            child.y += dy;
            shiftGroupTreeContents(child, boxesMap, groupMap, dy);
          }
        }
      }
    }
  }

  let x = PAD;
  let y = top;
  let rowH = 0;
  let rowStart = 0;

  function flushRowNormalize(from, to, rowY, rowHeight) {
    // If a single-row fit left unused space, give the leftover to heavier roots
    if (from >= to) return;
    const gapTotal = colGap * Math.max(0, to - from - 1);
    let used = gapTotal;
    for (let i = from; i < to; i++) used += preferred[i];
    const leftover = Math.max(0, usable - used);
    if (leftover < 8 || to - from < 1) return;
    const rowWeight = weights.slice(from, to).reduce((s, w) => s + w, 0) || 1;
    let cx = PAD;
    for (let i = from; i < to; i++) {
      const extra = leftover * (weights[i] / rowWeight);
      const slot = preferred[i] + extra;
      packGroup(roots[i], cx, rowY, slot, 0, i * 1000);
      cx += slot + colGap;
    }
  }

  // First pass: place with preferred widths; wrap when the next root won't fit
  const rowRanges = [];
  for (let i = 0; i < roots.length; i++) {
    let slot = preferred[i];
    if (x > PAD && x + slot > PAD + usable) {
      rowRanges.push({ from: rowStart, to: i, y, h: rowH });
      x = PAD;
      y += rowH + colGap;
      rowH = 0;
      rowStart = i;
    }
    // Last item on a wrapping row may take remaining width
    const remain = PAD + usable - x;
    if (i === roots.length - 1 || x + preferred[i + 1] + colGap > PAD + usable) {
      slot = Math.max(slot, Math.min(remain, Math.max(slot, remain * 0.92)));
    }
    slot = Math.min(slot, remain);
    preferred[i] = slot;
    const h = packGroup(roots[i], x, y, slot, 0, i * 1000);
    x += slot + colGap;
    rowH = Math.max(rowH, h);
  }
  rowRanges.push({ from: rowStart, to: roots.length, y, h: rowH });

  // Re-pack each row distributing leftover width (including single-root rows)
  for (const row of rowRanges) {
    let used = colGap * Math.max(0, row.to - row.from - 1);
    for (let i = row.from; i < row.to; i++) used += preferred[i];
    const leftover = usable - used;
    if (leftover < 12) continue;
    const rowWeight = weights.slice(row.from, row.to).reduce((s, w) => s + w, 0) || 1;
    let cx = PAD;
    for (let i = row.from; i < row.to; i++) {
      const slot = preferred[i] + leftover * (weights[i] / rowWeight);
      packGroup(roots[i], cx, row.y, slot, 0, i * 1000);
      cx += slot + colGap;
    }
  }

  return { boxes, groupBoxes };
}

/**
 * Timeline — tick-marked rail with year → half → quarter → month drill-in.
 * Visible ticks = collapsed parents + leaves (expand replaces a tick with its children).
 * Packs left→right; U-turns onto the next row when full.
 * Optional `grain:` (parse) sets initial expand depth; `time:` captions ticks.
 */
function layoutTimeline(spec, board) {
  const boxes = {};
  const groupBoxes = {};
  const ranks = layeredOrder(spec.nodes, spec.edges || []);
  const byId = Object.fromEntries(spec.nodes.map((n) => [n.id, n]));

  function kids(id) {
    return [...spec.nodes.filter((n) => n.parent === id)].sort((a, b) => {
      const ao = a.order != null ? Number(a.order) : a.rank != null ? Number(a.rank) : 0;
      const bo = b.order != null ? Number(b.order) : b.rank != null ? Number(b.rank) : 0;
      if (ao !== bo) return ao - bo;
      return String(a.id).localeCompare(String(b.id));
    });
  }

  function seqOf(n) {
    if (n.rank != null) return Number(n.rank);
    if (n.order != null) return Number(n.order);
    return ranks[n.id] ?? 0;
  }

  function parkDescendants(node, px, py, pw, ph) {
    for (const c of kids(node.id)) {
      const ck = kids(c.id);
      boxes[c.id] = {
        x: px,
        y: py,
        w: pw,
        h: ph,
        parentNode: node.id,
        folded: true,
        measure: measureNode(c),
        layer: c.layer,
        lane: c.lane,
        time: c.time || null,
        expandable: ck.length > 0,
        collapsed: ck.length > 0,
        isParent: ck.length > 0,
        childIds: ck.map((k) => k.id),
        hCollapsed: ph,
        hExpanded: ph,
      };
      parkDescendants(c, px, py, pw, ph);
    }
  }

  /** Units on the rail: leaf/collapsed event, or expanded cluster of child units. */
  function collectUnits(node) {
    const children = kids(node.id);
    const expandable = children.length > 0;
    const collapsed = expandable ? node.collapsed !== false : false;
    if (expandable && !collapsed) {
      return [
        {
          type: 'cluster',
          node,
          children: children.flatMap(collectUnits),
          expandable: true,
          collapsed: false,
        },
      ];
    }
    return [
      {
        type: 'leaf',
        node,
        expandable,
        collapsed: expandable,
        kids: children,
      },
    ];
  }

  const roots = sortNodes(spec.nodes.filter((n) => !n.parent || !byId[n.parent]));
  const units = roots.flatMap(collectUnits);

  function unitWidth(u) {
    if (u.type === 'leaf') return measureNode(u.node).w;
    const gap = Math.max(20, GAP - 4);
    const inner = u.children.reduce((s, c, i) => s + unitWidth(c) + (i ? gap : 0), 0);
    const head = measureNode(u.node).w;
    return Math.max(inner, head);
  }

  const maxRowInner = Math.max(200, board.w - PAD * 2);
  const cardGap = Math.max(20, GAP - 4);
  const rowPitch = 132;
  const stem = 16;
  const clusterHeadGap = 6;

  // Pack top-level units into serpentine rows
  const rows = [];
  let cur = [];
  let curW = 0;
  for (const u of units) {
    const w = unitWidth(u);
    const need = w + (cur.length ? cardGap : 0);
    if (cur.length && curW + need > maxRowInner) {
      rows.push(cur);
      cur = [u];
      curW = w;
    } else {
      cur.push(u);
      curW += need;
    }
  }
  if (cur.length) rows.push(cur);
  if (!rows.length) return { boxes, groupBoxes, axis: { ticks: [], segments: [], polyline: [] } };

  const top0 = PAD + TITLE_H + 56;
  const ticks = [];
  const polyline = [];
  const segments = [];
  let seqCounter = 0;

  function placeLeaf(u, x, axisY, parentId) {
    const n = u.node;
    const m = measureNode(n);
    const yCard = axisY - stem - m.h;
    const cx = x + m.w / 2;
    const childIds = (u.kids || []).map((c) => c.id);
    boxes[n.id] = {
      x,
      y: yCard,
      w: m.w,
      h: m.h,
      rank: seqOf(n),
      measure: m,
      expandable: u.expandable,
      collapsed: u.collapsed,
      isParent: u.expandable,
      childIds,
      parentNode: parentId || n.parent || null,
      layer: n.layer,
      lane: n.lane,
      span: Math.max(1, n.span || 1),
      time: n.time || null,
      hCollapsed: m.h,
      hExpanded: m.h,
      axisIndex: polyline.length,
    };
    if (u.collapsed && u.kids?.length) parkDescendants(n, x, yCard, m.w, m.h);
    const tickLabel = n.time || (n.layer ? String(n.layer) : null);
    ticks.push({
      id: n.id,
      x: cx,
      y: axisY,
      label: n.time || null,
      layer: n.layer || null,
      major: n.layer === 'year' || n.layer === 'half',
      row: 0,
      seq: seqCounter++,
    });
    return { w: m.w, pts: [{ x: cx, y: axisY, id: n.id }], tickIds: [n.id] };
  }

  function placeUnit(u, x, axisY, parentId) {
    if (u.type === 'leaf') return placeLeaf(u, x, axisY, parentId);

    // Expanded cluster: children on the rail, parent as spanning header above
    const n = u.node;
    const head = measureNode(n);
    let cx = x;
    const childPts = [];
    const childTickIds = [];
    let maxChildTop = axisY;
    for (let i = 0; i < u.children.length; i++) {
      const ch = u.children[i];
      const placed = placeUnit(ch, cx, axisY, n.id);
      childPts.push(...placed.pts);
      childTickIds.push(...placed.tickIds);
      if (boxes[ch.type === 'leaf' ? ch.node.id : ch.node.id]) {
        maxChildTop = Math.min(maxChildTop, boxes[ch.node.id]?.y ?? maxChildTop);
      }
      // For nested clusters, width already accounted
      cx += placed.w + (i < u.children.length - 1 ? cardGap : 0);
    }
    const totalW = Math.max(head.w, cx - x);
    const firstX = x;
    const yHead = Math.min(maxChildTop, axisY - stem - 40) - head.h - clusterHeadGap;
    boxes[n.id] = {
      x: firstX + (totalW - Math.max(head.w, Math.min(totalW, head.w + 40))) / 2,
      y: yHead,
      w: Math.max(head.w, Math.min(totalW, head.w + 80)),
      h: head.h,
      rank: seqOf(n),
      measure: head,
      faceOnly: head,
      expandable: true,
      collapsed: false,
      isParent: true,
      childIds: kids(n.id).map((c) => c.id),
      parentNode: parentId || n.parent || null,
      layer: n.layer,
      lane: n.lane,
      span: Math.max(1, n.span || 1),
      time: n.time || null,
      hCollapsed: head.h,
      hExpanded: head.h,
      axisBand: true,
    };
    // Center parent over children span
    boxes[n.id].x = firstX + (totalW - boxes[n.id].w) / 2;
    boxes[n.id].y = yHead;
    return { w: totalW, pts: childPts, tickIds: childTickIds };
  }

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const rtl = ri % 2 === 1;
    const axisY = top0 + ri * rowPitch;
    const widths = row.map(unitWidth);
    const totalW = widths.reduce((s, w, i) => s + w + (i ? cardGap : 0), 0);
    let cursor = rtl ? board.w - PAD - totalW : PAD;
    const rowPts = [];

    const orderIdx = rtl ? [...row.keys()].reverse() : [...row.keys()];
    // Place in visual left-to-right for coordinates; chronological travel differs for rtl
    const placeOrder = row;
    if (rtl) {
      cursor = board.w - PAD;
      for (let i = 0; i < placeOrder.length; i++) {
        const u = placeOrder[i];
        const w = widths[i];
        cursor -= w;
        const placed = placeUnit(u, cursor, axisY, null);
        rowPts.push(...placed.pts);
        cursor -= i < placeOrder.length - 1 ? cardGap : 0;
      }
    } else {
      for (let i = 0; i < placeOrder.length; i++) {
        const placed = placeUnit(placeOrder[i], cursor, axisY, null);
        rowPts.push(...placed.pts);
        cursor += placed.w + (i < placeOrder.length - 1 ? cardGap : 0);
      }
    }

    // Travel order along the rail
    const travelPts = rtl ? [...rowPts].reverse() : rowPts;
    // Fix tick row index
    for (const t of ticks) {
      if (travelPts.some((p) => p.id === t.id)) t.row = ri;
    }

    if (travelPts.length) {
      const d = travelPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      segments.push({ d, row: ri, kind: 'row' });
      polyline.push(...travelPts);
    }

    if (ri < rows.length - 1) {
      const y0 = axisY;
      const y1 = top0 + (ri + 1) * rowPitch;
      const turnX = rtl ? PAD : board.w - PAD;
      segments.push({ d: `M ${turnX} ${y0} L ${turnX} ${y1}`, row: ri, kind: 'uturn' });
      polyline.push({ x: turnX, y: y0, id: null }, { x: turnX, y: y1, id: null });
    }
  }

  if (polyline.length >= 1) {
    const first = polyline[0];
    const last = polyline[polyline.length - 1];
    const padX = 20;
    const lastRtl = (rows.length - 1) % 2 === 1;
    segments.unshift({
      d: `M ${first.x - padX} ${first.y} L ${first.x} ${first.y}`,
      kind: 'cap',
    });
    segments.push({
      d: `M ${last.x} ${last.y} L ${last.x + (lastRtl ? -padX : padX)} ${last.y}`,
      kind: 'cap',
    });
  }

  // Ensure every node has a box (park orphans)
  for (const n of spec.nodes) {
    if (!boxes[n.id]) {
      boxes[n.id] = {
        x: PAD,
        y: top0,
        w: 1,
        h: 1,
        folded: true,
        measure: measureNode(n),
        layer: n.layer,
      };
    }
  }

  return {
    boxes,
    groupBoxes,
    axis: {
      ticks,
      segments,
      polyline,
      rows: rows.length,
      grain: spec.grain || null,
    },
  };
}

/**
 * Route timeline edges along the tick axis (prefer rail path over cutting across).
 */
function routeTimelineEdges(boxes, edges, axis) {
  if (!axis?.polyline?.length) {
    return routeEdges(boxes, edges, {}, { mode: 'ortho' });
  }
  const tickOf = Object.fromEntries((axis.ticks || []).map((t) => [t.id, t]));
  const poly = axis.polyline;
  const indexOf = {};
  poly.forEach((p, i) => {
    if (p.id) indexOf[p.id] = i;
  });

  const routes = [];
  for (const e of edges || []) {
    const a = boxes[e.from];
    const b = boxes[e.to];
    if (!a || !b) continue;
    const ia = indexOf[e.from];
    const ib = indexOf[e.to];
    let points;
    if (ia != null && ib != null && ia !== ib) {
      const lo = Math.min(ia, ib);
      const hi = Math.max(ia, ib);
      const slice = poly.slice(lo, hi + 1).map((p) => ({ x: p.x, y: p.y }));
      if (ia > ib) slice.reverse();
      // Drop from tick down/up to card edge, then along rail
      const t0 = tickOf[e.from];
      const t1 = tickOf[e.to];
      const fromBottom = { x: a.x + a.w / 2, y: a.y + a.h };
      const toBottom = { x: b.x + b.w / 2, y: b.y + b.h };
      points = [
        fromBottom,
        { x: t0.x, y: t0.y },
        ...slice.slice(1, -1),
        { x: t1.x, y: t1.y },
        toBottom,
      ];
    } else {
      // Fallback ortho
      const r = routeEdges(
        { [e.from]: a, [e.to]: b },
        [e],
        {},
        { mode: 'ortho' },
      )[0];
      if (r) {
        routes.push(r);
        continue;
      }
      points = [
        { x: a.x + a.w / 2, y: a.y + a.h },
        { x: b.x + b.w / 2, y: b.y + b.h },
      ];
    }
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const mid = points[Math.floor(points.length / 2)];
    routes.push({
      ...e,
      d,
      labelX: mid.x,
      labelY: mid.y - 10,
      resolvedFrom: e.from,
      resolvedTo: e.to,
      fromEndpoint: 'node',
      toEndpoint: 'node',
      logicalFrom: e.from,
      logicalTo: e.to,
      wire: e.wire || 'main',
      mergedCount: 1,
      routeMode: 'timeline-axis',
    });
  }
  return deconflictEdgeLabels(routes, collectLabelObstacles({}));
}

function sequenceAxis(spec) {
  const dir = spec.dir || 'lr';
  return {
    verticalHeads: dir === 'tb' || dir === 'bt',
    reverse: dir === 'rl' || dir === 'bt',
  };
}

/** Lifeline heads. Messages are routed separately in document order. */
function layoutSequence(spec, board) {
  const nodes = sortNodes(spec.nodes);
  const { verticalHeads, reverse } = sequenceAxis(spec);
  const ordered = reverse ? [...nodes].reverse() : nodes;
  const boxes = {};
  const n = Math.max(ordered.length, 1);
  ordered.forEach((node, i) => {
    const s = measureNode(node);
    if (!verticalHeads) {
      const slot = (board.w - PAD * 2) / n;
      boxes[node.id] = {
        x: PAD + slot * i + (slot - s.w) / 2,
        y: PAD,
        w: s.w,
        h: s.h,
        rank: i,
        measure: s,
        shape: node.shape || 'rect',
      };
    } else {
      const slot = (board.h - PAD * 2) / n;
      boxes[node.id] = {
        x: PAD,
        y: PAD + slot * i + (slot - s.h) / 2,
        w: s.w,
        h: s.h,
        rank: i,
        measure: s,
        shape: node.shape || 'rect',
      };
    }
  });
  return boxes;
}

function routeSequenceEdges(boxes, edges, board, spec) {
  const { verticalHeads } = sequenceAxis(spec);
  const list = edges || [];
  const routes = [];
  const count = Math.max(list.length, 1);
  const push = (e, d, labelX, labelY, routeMode = 'sequence') => {
    routes.push({
      ...e,
      d,
      labelX,
      labelY,
      resolvedFrom: e.from,
      resolvedTo: e.to,
      fromEndpoint: 'node',
      toEndpoint: 'node',
      logicalFrom: e.from,
      logicalTo: e.to,
      wire: e.wire || 'main',
      mergedCount: 1,
      routeMode,
      decorative: routeMode === 'sequence-life',
    });
  };

  const heads = Object.values(boxes);
  if (!verticalHeads) {
    const headBottom = heads.length ? Math.max(...heads.map((b) => b.y + b.h)) : PAD;
    const foot = board.h - PAD;
    for (const b of heads) {
      const x = b.x + b.w / 2;
      const id = Object.keys(boxes).find((k) => boxes[k] === b);
      if (!id) continue;
      push(
        { from: id, to: id, label: null, wire: 'main' },
        `M ${x} ${b.y + b.h} L ${x} ${foot}`,
        null,
        null,
        'sequence-life',
      );
    }
    const span = Math.max(24, foot - headBottom);
    const step = span / count;
    list.forEach((e, i) => {
      const a = boxes[e.from];
      const b = boxes[e.to];
      if (!a || !b) return;
      const y = headBottom + step * i + step * 0.45;
      const x1 = a.x + a.w / 2;
      const x2 = b.x + b.w / 2;
      if (e.from === e.to) {
        const loop = 28;
        push(
          e,
          `M ${x1} ${y} L ${x1 + loop} ${y} L ${x1 + loop} ${y + 18} L ${x1} ${y + 18}`,
          x1 + loop + 6,
          y + 2,
        );
      } else {
        push(e, `M ${x1} ${y} L ${x2} ${y}`, (x1 + x2) / 2, y - 14);
      }
    });
  } else {
    const headRight = heads.length ? Math.max(...heads.map((b) => b.x + b.w)) : PAD;
    const foot = board.w - PAD;
    for (const b of heads) {
      const y = b.y + b.h / 2;
      const id = Object.keys(boxes).find((k) => boxes[k] === b);
      if (!id) continue;
      push(
        { from: id, to: id, label: null, wire: 'main' },
        `M ${b.x + b.w} ${y} L ${foot} ${y}`,
        null,
        null,
        'sequence-life',
      );
    }
    const span = Math.max(24, foot - headRight);
    const step = span / count;
    list.forEach((e, i) => {
      const a = boxes[e.from];
      const b = boxes[e.to];
      if (!a || !b) return;
      const x = headRight + step * i + step * 0.45;
      const y1 = a.y + a.h / 2;
      const y2 = b.y + b.h / 2;
      if (e.from === e.to) {
        const loop = 22;
        push(
          e,
          `M ${x} ${y1} L ${x} ${y1 + loop} L ${x + 18} ${y1 + loop} L ${x + 18} ${y1}`,
          x + 4,
          y1 + loop + 8,
        );
      } else {
        push(e, `M ${x} ${y1} L ${x} ${y2}`, x + 8, (y1 + y2) / 2);
      }
    });
  }
  return deconflictEdgeLabels(routes, []);
}

function treeIndex(spec) {
  const nodes = sortNodes(spec.nodes);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const kids = Object.fromEntries(nodes.map((n) => [n.id, []]));
  for (const n of nodes) {
    if (n.parent && byId[n.parent] && n.parent !== n.id) kids[n.parent].push(n.id);
  }
  for (const e of spec.edges || []) {
    if (!byId[e.from] || !byId[e.to] || e.from === e.to) continue;
    if (byId[e.to].parent) continue;
    if (kids[e.to].includes(e.from)) continue;
    if (!kids[e.from].includes(e.to)) kids[e.from].push(e.to);
  }
  for (const id of Object.keys(kids)) {
    kids[id] = [...new Set(kids[id])].sort((a, b) => {
      const ao = byId[a].order != null ? Number(byId[a].order) : byId[a].rank != null ? Number(byId[a].rank) : 0;
      const bo = byId[b].order != null ? Number(byId[b].order) : byId[b].rank != null ? Number(byId[b].rank) : 0;
      if (ao !== bo) return ao - bo;
      return String(a).localeCompare(String(b));
    });
  }
  return { nodes, byId, kids };
}

/**
 * Orthogonal tree. `parent:` and edges (from → to) build generations.
 * Default dir grows downward; lr/rl grow across; bt/rl reverse the axis.
 */
function layoutHierarchy(spec, board) {
  const { nodes, byId, kids } = treeIndex(spec);
  const childSet = new Set();
  for (const list of Object.values(kids)) for (const c of list) childSet.add(c);
  let roots = nodes.filter((n) => !childSet.has(n.id));
  if (!roots.length && nodes[0]) roots = [nodes[0]];

  const levels = [];
  const seen = new Set();
  const queue = roots.map((n) => [n.id, 0]);
  while (queue.length) {
    const [id, d] = queue.shift();
    if (!id || seen.has(id) || !byId[id]) continue;
    seen.add(id);
    if (!levels[d]) levels[d] = [];
    levels[d].push(id);
    for (const c of kids[id] || []) queue.push([c, d + 1]);
  }
  const rest = nodes.filter((n) => !seen.has(n.id));
  if (rest.length) {
    if (!levels[0]) levels[0] = [];
    for (const n of rest) levels[0].push(n.id);
  }

  const vertical = spec.dir !== 'lr' && spec.dir !== 'rl';
  const reverse = spec.dir === 'bt' || spec.dir === 'rl';
  const boxes = {};
  const levelCount = Math.max(levels.length, 1);
  levels.forEach((ids, d) => {
    const sizes = ids.map((id) => measureNode(byId[id]));
    const slotCount = Math.max(ids.length, 1);
    if (vertical) {
      const rowH = (board.h - PAD * 2) / levelCount;
      const y0 = reverse ? board.h - PAD - (d + 1) * rowH : PAD + d * rowH;
      const slot = (board.w - PAD * 2) / slotCount;
      ids.forEach((id, i) => {
        const s = sizes[i];
        boxes[id] = {
          x: PAD + slot * i + (slot - s.w) / 2,
          y: y0 + (rowH - s.h) / 2,
          w: s.w,
          h: s.h,
          rank: d,
          measure: s,
          shape: byId[id].shape || 'rect',
        };
      });
    } else {
      const colW = (board.w - PAD * 2) / levelCount;
      const x0 = reverse ? board.w - PAD - (d + 1) * colW : PAD + d * colW;
      const slot = (board.h - PAD * 2) / slotCount;
      ids.forEach((id, i) => {
        const s = sizes[i];
        boxes[id] = {
          x: x0 + (colW - s.w) / 2,
          y: PAD + slot * i + (slot - s.h) / 2,
          w: s.w,
          h: s.h,
          rank: d,
          measure: s,
          shape: byId[id].shape || 'rect',
        };
      });
    }
  });

  for (const n of nodes) {
    const b = boxes[n.id];
    if (!b) continue;
    const childIds = kids[n.id] || [];
    const expandable = childIds.length > 0 && n.expandable !== false;
    // Show the tree unless the author set collapsed:true (parent: defaults to that).
    const collapsed = expandable && n.collapsed === true;
    b.expandable = expandable;
    b.collapsed = collapsed;
    b.isParent = expandable;
    b.childIds = childIds.slice();
    for (const cid of childIds) {
      const cb = boxes[cid];
      if (!cb) continue;
      cb.parentNode = n.id;
      if (collapsed) {
        cb.folded = true;
        cb.x = b.x;
        cb.y = b.y;
      }
    }
  }
  return boxes;
}

function layoutNkp(spec, board) {
  const hub =
    spec.nodes.find((n) => (n.kind || '').includes('management')) || sortNodes(spec.nodes)[0];
  const rest = sortNodes(spec.nodes.filter((n) => n.id !== hub.id));
  return layoutHub({ ...spec, nodes: [hub, ...rest] }, board);
}

/**
 * Constellation — 3D relationship cloud (projected). Camera orbit is live in interact.
 */
function layoutConstellation(spec, board) {
  const nodes = sortNodes(spec.nodes);
  const sizes = {};
  const measures = {};
  for (const n of nodes) {
    const m = measureNode(n);
    measures[n.id] = m;
    sizes[n.id] = { w: m.w, h: m.h };
  }
  const R = Math.min(board.w, board.h) * 0.36;
  const space = packConstellation3d(nodes, spec.edges || [], {
    radius: Math.max(120, R),
    iterations: Math.min(120, 40 + nodes.length * 3),
  });
  const cam = {
    yaw: 0.55,
    pitch: 0.4,
    scale: 1,
    cx: board.w / 2,
    cy: board.h / 2 + 6,
  };
  const proj = projectConstellation(space, cam, board, sizes);
  const boxes = {};
  for (const n of nodes) {
    const m = measures[n.id];
    const p = proj[n.id] || { left: board.w / 2, top: board.h / 2, scale: 1, zIndex: 1 };
    boxes[n.id] = {
      x: p.left,
      y: p.top,
      w: m.w,
      h: m.h,
      rank: 0,
      measure: m,
      shape: n.shape || 'rect',
      space: space[n.id],
      depthScale: p.scale,
      zIndex: p.zIndex,
    };
  }
  boxes._orbit = { space, cam, skipFit: true };
  return boxes;
}

function finish(spec, board, boxes, groupBoxes, extra = {}) {
  const orbitMeta = boxes._orbit || null;
  if (boxes._orbit) delete boxes._orbit;

  parkFoldedChildren(spec, boxes, groupBoxes);
  const appearOrder = [...spec.nodes]
    .map((n, i) => ({
      id: n.id,
      order: n.appear != null ? n.appear : (boxes[n.id]?.rank ?? i),
      i,
    }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((x) => x.id);

  let routes =
    extra.routes || routeEdges(boxes, spec.edges, groupBoxes, { mode: edgeRouteMode(spec) });

  // Constellation: chord edges between projected centers (orbit updates live)
  if (orbitMeta?.space && spec.template === 'constellation') {
    routes = (spec.edges || [])
      .map((e) => {
        const a = boxes[e.from];
        const b = boxes[e.to];
        if (!a || !b) return null;
        const x1 = a.x + a.w / 2;
        const y1 = a.y + a.h / 2;
        const x2 = b.x + b.w / 2;
        const y2 = b.y + b.h / 2;
        return {
          ...e,
          d: `M ${x1} ${y1} L ${x2} ${y2}`,
          x1,
          y1,
          x2,
          y2,
          labelX: (x1 + x2) / 2,
          labelY: (y1 + y2) / 2 - 10,
          resolvedFrom: e.from,
          resolvedTo: e.to,
          fromEndpoint: 'node',
          toEndpoint: 'node',
          logicalFrom: e.from,
          logicalTo: e.to,
          wire: e.wire || 'main',
          mergedCount: 1,
          routeMode: 'constellation',
        };
      })
      .filter(Boolean);
  }

  return {
    board,
    boxes,
    groupBoxes,
    routes,
    appearOrder,
    axis: extra.axis || null,
    engine: extra.engine || 'native',
    orbit: orbitMeta
      ? {
          space: orbitMeta.space,
          yaw: orbitMeta.cam?.yaw,
          pitch: orbitMeta.cam?.pitch,
          scale: orbitMeta.cam?.scale ?? 1,
          skipFit: true,
        }
      : extra.orbit || null,
    metrics: {
      gap: GAP,
      pad: PAD,
      nodeCount: spec.nodes.length,
      edgeCount: spec.edges.length,
      engine: extra.engine || 'native',
    },
  };
}

export function layoutNative(spec, board = { w: 960, h: 540 }) {
  const t = spec.template;
  let boxes;
  let groupBoxes = {};

  if (t === 'process') boxes = layoutProcess(spec, board);
  else if (t === 'deck' || t === 'bars') boxes = layoutDeck(spec, board);
  else if (t === 'hub') boxes = layoutHub(spec, board);
  else if (t === 'mindmap') boxes = layoutMindmap(spec, board);
  else if (t === 'constellation') boxes = layoutConstellation(spec, board);
  else if (t === 'sequence') {
    boxes = layoutSequence(spec, board);
    return finish(spec, board, boxes, {}, {
      engine: 'native',
      routes: routeSequenceEdges(boxes, spec.edges, board, spec),
    });
  } else if (t === 'hierarchy') boxes = layoutHierarchy(spec, board);
  else if (t === 'nkp') boxes = layoutNkp(spec, board);
  else if (t === 'timeline') {
    const r = layoutTimeline(spec, board);
    return finish(spec, board, r.boxes, r.groupBoxes, {
      engine: 'native',
      axis: r.axis,
      routes: routeTimelineEdges(r.boxes, spec.edges, r.axis),
    });
  } else if (t === 'cloud' || t === 'gis' || t === 'k8s') {
    const r = layoutCloud(spec, board);
    boxes = r.boxes;
    groupBoxes = r.groupBoxes;
  } else {
    boxes = layoutFlow(spec, board);
  }

  return finish(spec, board, boxes, groupBoxes, { engine: 'native' });
}

/** Sync layout (native). Prefer layoutAsync when ELK is desired. */
export function layout(spec, board = { w: 960, h: 540 }) {
  return layoutNative(spec, board);
}

/** Async layout — tries elkjs for graph templates, falls back to native. */
export async function layoutAsync(spec, board = { w: 960, h: 540 }) {
  if (usesElk(spec) && spec.template !== 'timeline') {
    try {
      const elkLaid = await layoutWithElk(spec, board);
      if (elkLaid && Object.keys(elkLaid.boxes).length) {
        const appearOrder = [...spec.nodes]
          .map((n, i) => ({
            id: n.id,
            order: n.appear != null ? n.appear : (elkLaid.boxes[n.id]?.rank ?? i),
            i,
          }))
          .sort((a, b) => a.order - b.order || a.i - b.i)
          .map((x) => x.id);
        return {
          ...elkLaid,
          appearOrder,
          routes: (() => {
            const base =
              elkLaid.routes ||
              routeEdges(elkLaid.boxes, spec.edges, elkLaid.groupBoxes, {
                mode: edgeRouteMode(spec),
              });
            // routeEdges already deconflicts vs captions; ELK routes need an explicit pass
            if (elkLaid.routes) {
              return deconflictEdgeLabels(
                base,
                collectLabelObstacles(elkLaid.groupBoxes),
              );
            }
            return base;
          })(),
          metrics: {
            gap: GAP,
            pad: PAD,
            nodeCount: spec.nodes.length,
            edgeCount: spec.edges.length,
            engine: 'elk',
          },
        };
      }
    } catch {
      /* fall through */
    }
  }
  return layoutNative(spec, board);
}

/**
 * Bounding box of visible nodes + groups (ignores folded).
 * Used to shrink the stage when expand packs past the slide canvas.
 */
export function contentExtent(laid) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = 0;
  let maxY = 0;
  const visit = (b) => {
    if (!b || b.folded) return;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  };
  for (const b of Object.values(laid.boxes || {})) visit(b);
  for (const b of Object.values(laid.groupBoxes || {})) visit(b);
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return { minX, minY, maxX, maxY };
}

/**
 * Scale + translate so the content AABB fits inside the board.
 * Keeps shrinking (no hard 0.55 floor) until vertical/horizontal overflow is gone.
 * transform-origin is 0,0 — apply as translate(tx,ty) scale(s).
 */
export function contentFitTransform(laid, { pad = 16, min = 0.12 } = {}) {
  const board = laid?.board;
  if (!board?.w || !board?.h) return { scale: 1, tx: 0, ty: 0 };
  // Constellation camera owns framing — don't letterbox-scale the projection
  if (laid?.orbit?.skipFit) return { scale: 1, tx: 0, ty: 0 };
  const { minX, minY, maxX, maxY } = contentExtent(laid);
  if (maxX <= minX || maxY <= minY) return { scale: 1, tx: 0, ty: 0 };

  // Already inside the padded board — leave layout as packed
  if (minX >= pad && minY >= pad && maxX <= board.w - pad && maxY <= board.h - pad) {
    return { scale: 1, tx: 0, ty: 0 };
  }

  const cw = Math.max(1, maxX - minX);
  const ch = Math.max(1, maxY - minY);
  const availW = Math.max(1, board.w - pad * 2);
  const availH = Math.max(1, board.h - pad * 2);
  const scale = Math.max(min, Math.min(1, availW / cw, availH / ch));
  const tx = pad + (availW - cw * scale) / 2 - minX * scale;
  const ty = pad + (availH - ch * scale) / 2 - minY * scale;
  return { scale, tx, ty };
}

/** @deprecated prefer contentFitTransform — returns scale only */
export function contentFitScale(laid, opts) {
  return contentFitTransform(laid, opts).scale;
}

export function layoutReport(spec, laid) {
  const overlaps = [];
  const ids = Object.keys(laid.boxes).filter((id) => !laid.boxes[id].folded);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = laid.boxes[ids[i]];
      const b = laid.boxes[ids[j]];
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      if (ox > 1 && oy > 1) overlaps.push([ids[i], ids[j], ox * oy]);
    }
  }
  const labelOverflow = [];
  for (const n of spec.nodes) {
    const b = laid.boxes[n.id];
    if (!b || b.folded) continue;
    const m = b.measure;
    if (m?.truncated) labelOverflow.push({ id: n.id, truncated: true });
  }
  return {
    overlaps,
    labelOverflow,
    appearOrder: laid.appearOrder,
    metrics: laid.metrics,
    engine: laid.engine,
    fitScale: contentFitTransform(laid).scale,
  };
}
