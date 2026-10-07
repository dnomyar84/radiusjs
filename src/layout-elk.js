/**
 * ELK adapter — graph templates delegate geometry to elkjs.
 * EPL-2.0 dependency; see NOTICE. Radius stays MIT façade.
 */

import { measureNode } from './labels.js';
import { parkFoldedChildren, promoteEdges, routeEdges } from './edges.js';

const DIR_MAP = {
  lr: 'RIGHT',
  rl: 'LEFT',
  tb: 'DOWN',
  bt: 'UP',
};

const GRAPH_TEMPLATES = new Set(['flow', 'sequence', 'hierarchy', 'cloud', 'k8s', 'gis']);

let elkPromise = null;

export function usesElk(spec) {
  if (spec.engine === 'native' || spec.engine === 'fallback') return false;
  if (spec.engine === 'elk') return true;
  // auto: prefer native in browser (no import map for elkjs); Node may use elk
  if (typeof window !== 'undefined') return false;
  return GRAPH_TEMPLATES.has(spec.template);
}

async function loadElk() {
  if (elkPromise) return elkPromise;
  elkPromise = (async () => {
    try {
      const mod = await import('elkjs/lib/elk.bundled.js');
      const ELK = mod.default || mod.ELK || mod;
      return new ELK();
    } catch (e) {
      // Browser CDN fallback (pinned — never @latest)
      if (typeof window !== 'undefined') {
        await import('https://cdn.jsdelivr.net/npm/elkjs@0.9.3/lib/elk.bundled.js');
        const ELK = window.ELK;
        if (!ELK) throw e;
        return new ELK();
      }
      throw e;
    }
  })();
  return elkPromise;
}

function sortByOrder(list) {
  return [...list].sort((a, b) => {
    const ao = a.order != null ? a.order : 0;
    const bo = b.order != null ? b.order : 0;
    if (ao !== bo) return ao - bo;
    return String(a.id).localeCompare(String(b.id));
  });
}

function toElkNode(node) {
  const m = measureNode(node);
  const opts = {};
  if (node.rank != null && Number.isFinite(node.rank)) {
    opts['elk.layered.layering.layerConstraint'] = 'FIRST_SEPARATE';
    opts['org.eclipse.elk.layered.layering.layerConstraint'] = 'FIRST_SEPARATE';
    opts['elk.position'] = `(${node.rank * 200},0)`;
  }
  if (node.lane) {
    opts['elk.alg.layered.crossingMinimization.semiInteractive'] = 'true';
  }
  return {
    id: node.id,
    width: m.w,
    height: m.h,
    labels: [{ text: node.label || node.id }],
    layoutOptions: opts,
    _measure: m,
  };
}

function buildElkGraph(spec) {
  const dir = DIR_MAP[spec.dir || 'lr'] || 'RIGHT';
  const groups = spec.groups || [];
  const byGroup = Object.fromEntries(groups.map((g) => [g.id, { ...g, children: [], memberNodes: [] }]));
  for (const g of groups) {
    if (g.parent && byGroup[g.parent]) byGroup[g.parent].children.push(byGroup[g.id]);
  }
  const memberIds = new Set();
  for (const g of groups) {
    for (const mid of g.members || []) {
      const n = spec.nodes.find((x) => x.id === mid);
      if (n) {
        byGroup[g.id].memberNodes.push(n);
        memberIds.add(mid);
      }
    }
  }

  const childNodeIds = new Set(spec.nodes.filter((n) => n.parent).map((n) => n.id));

  function groupToElk(g) {
    const nested = g.children.map(groupToElk);
    const nodes = sortByOrder(g.memberNodes.filter((n) => !childNodeIds.has(n.id) || n.parent == null)).map(toElkNode);
    // node-parent trees as compound children
    const parents = g.memberNodes.filter((n) => spec.nodes.some((c) => c.parent === n.id));
    for (const p of parents) {
      const kids = sortByOrder(spec.nodes.filter((c) => c.parent === p.id)).map(toElkNode);
      const pm = measureNode(p);
      nested.push({
        id: p.id,
        width: pm.w,
        height: p.collapsed ? pm.h : undefined,
        labels: [{ text: p.label || p.id }],
        children: p.collapsed ? [] : kids,
        layoutOptions: {
          'elk.padding': '[top=48,left=12,bottom=12,right=12]',
        },
        _measure: pm,
        _collapsed: !!p.collapsed,
      });
      memberIds.add(p.id);
      kids.forEach((k) => memberIds.add(k.id));
    }

    const face = measureNode({ label: g.label || g.id, kind: g.kind });
    return {
      id: g.id,
      labels: [{ text: g.label || g.id }],
      children: [...nodes.filter((n) => !parents.some((p) => p.id === n.id)), ...nested],
      layoutOptions: {
        'elk.padding': '[top=56,left=16,bottom=16,right=16]',
        'elk.direction': dir,
      },
      _face: face,
      _group: true,
      _collapsed: !!g.collapsed,
      width: g.collapsed ? face.w + 24 : undefined,
      height: g.collapsed ? face.h : undefined,
    };
  }

  const roots = groups.filter((g) => !g.parent || !byGroup[g.parent]).map((g) => groupToElk(byGroup[g.id]));
  const topNodes = sortByOrder(
    spec.nodes.filter((n) => !memberIds.has(n.id) && !n.parent),
  ).map(toElkNode);

  // top-level node parents
  const topParents = spec.nodes.filter(
    (n) => !n.parent && spec.nodes.some((c) => c.parent === n.id) && !memberIds.has(n.id),
  );
  for (const p of topParents) {
    const kids = sortByOrder(spec.nodes.filter((c) => c.parent === p.id)).map(toElkNode);
    const pm = measureNode(p);
    topNodes.push({
      id: p.id,
      labels: [{ text: p.label || p.id }],
      children: p.collapsed ? [] : kids,
      layoutOptions: { 'elk.padding': '[top=48,left=12,bottom=12,right=12]' },
      _measure: pm,
      width: p.collapsed ? pm.w : undefined,
      height: p.collapsed ? pm.h : undefined,
    });
  }

  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': dir,
      'elk.spacing.nodeNode': '28',
      'elk.layered.spacing.nodeNodeBetweenLayers': '48',
      'elk.padding': '[top=48,left=40,bottom=40,right=40]',
      'elk.edgeRouting': 'ORTHOGONAL',
    },
    children: roots.length ? [...roots, ...topNodes.filter((n) => !topParents.some((p) => p.id === n.id))] : topNodes,
    edges: promoteEdges(spec).map((e, i) => ({
      id: `e${i}_${e.from}_${e.to}`,
      sources: [e.from],
      targets: [e.to],
      labels: e.label ? [{ text: e.label }] : [],
      _logicalFrom: e.logicalFrom,
      _logicalTo: e.logicalTo,
    })),
  };
}

function collectBoxes(elkNode, boxes, groupBoxes, ox = 0, oy = 0, parentGroup = null) {
  const x = (elkNode.x || 0) + ox;
  const y = (elkNode.y || 0) + oy;
  if (elkNode._group) {
    const face = elkNode._face || { w: 160, h: 64 };
    groupBoxes[elkNode.id] = {
      x,
      y,
      w: elkNode.width || face.w,
      h: elkNode._collapsed ? face.h : elkNode.height || face.h,
      hCollapsed: face.h,
      hExpanded: elkNode._collapsed ? Math.max(face.h * 3, elkNode.height || 180) : elkNode.height || face.h,
      label: elkNode.labels?.[0]?.text || elkNode.id,
      family: null,
      kind: null,
      parent: parentGroup,
      depth: 0,
      members: (elkNode.children || []).filter((c) => !c._group).map((c) => c.id),
      childIds: (elkNode.children || []).filter((c) => c._group).map((c) => c.id),
      collapsed: !!elkNode._collapsed,
      expandable: true,
      layer: null,
    };
    if (!elkNode._collapsed) {
      for (const c of elkNode.children || []) {
        collectBoxes(c, boxes, groupBoxes, x, y, elkNode.id);
      }
    }
    return;
  }

  // compound node parent
  if (elkNode.children && elkNode.children.length) {
    boxes[elkNode.id] = {
      x,
      y,
      w: elkNode.width,
      h: elkNode._collapsed ? elkNode._measure?.h || 64 : elkNode.height,
      rank: 0,
      group: parentGroup,
      expandable: true,
      collapsed: !!elkNode._collapsed,
      hCollapsed: elkNode._measure?.h || 64,
      hExpanded: elkNode.height,
      isParent: true,
    };
    if (!elkNode._collapsed) {
      for (const c of elkNode.children || []) {
        collectBoxes(c, boxes, groupBoxes, x, y, parentGroup);
        if (boxes[c.id]) boxes[c.id].parentNode = elkNode.id;
      }
    }
    return;
  }

  boxes[elkNode.id] = {
    x,
    y,
    w: elkNode.width,
    h: elkNode.height,
    rank: 0,
    group: parentGroup,
    measure: elkNode._measure,
  };
}

function routeFromElk(elkGraph, edges) {
  const byId = Object.fromEntries(edges.map((e) => [`${e.from}->${e.to}`, e]));
  const routes = [];
  for (const e of elkGraph.edges || []) {
    const from = e.sources[0];
    const to = e.targets[0];
    const sections = e.sections || [];
    let d = '';
    if (sections.length) {
      const s = sections[0];
      d = `M ${s.startPoint.x} ${s.startPoint.y}`;
      for (const bp of s.bendPoints || []) d += ` L ${bp.x} ${bp.y}`;
      d += ` L ${s.endPoint.x} ${s.endPoint.y}`;
    }
    const meta = byId[`${from}->${to}`] || { from, to, label: null };
    routes.push({
      ...meta,
      d: d || null,
      label: meta.label,
      labelX: e.labels?.[0]?.x,
      labelY: e.labels?.[0]?.y,
    });
  }
  return routes;
}

/**
 * @returns {Promise<object|null>} laid or null if ELK unavailable
 */
export async function layoutWithElk(spec, board) {
  if (!usesElk(spec)) return null;
  let elk;
  try {
    elk = await loadElk();
  } catch {
    return null;
  }

  const graph = buildElkGraph(spec);
  // collapsed groups: shrink children away
  for (const g of spec.groups || []) {
    const node = findElk(graph, g.id);
    if (node && g.collapsed) {
      node.children = [];
      node._collapsed = true;
      const face = node._face || { w: 160, h: 64 };
      node.width = face.w + 8;
      node.height = face.h;
    }
  }

  const result = await elk.layout(graph);
  const boxes = {};
  const groupBoxes = {};
  for (const c of result.children || []) {
    collectBoxes(c, boxes, groupBoxes, 0, 0, null);
  }

  // Enrich group meta from spec
  for (const g of spec.groups || []) {
    if (groupBoxes[g.id]) {
      groupBoxes[g.id].family = g.family;
      groupBoxes[g.id].kind = g.kind;
      groupBoxes[g.id].layer = g.layer;
      groupBoxes[g.id].parent = g.parent || null;
      groupBoxes[g.id].members = g.members.slice();
      groupBoxes[g.id].collapsed = !!g.collapsed;
      groupBoxes[g.id].virtual = !!g.virtual;
      groupBoxes[g.id].label = g.label || groupBoxes[g.id].label;
      groupBoxes[g.id].xExpanded = groupBoxes[g.id].x;
      groupBoxes[g.id].xCollapsed = groupBoxes[g.id].x;
      groupBoxes[g.id].wCollapsed = groupBoxes[g.id].wCollapsed ?? groupBoxes[g.id].w;
      if (g.collapsed) {
        groupBoxes[g.id].h = groupBoxes[g.id].hCollapsed;
      }
    }
  }

  // Scale/fit into board if needed
  const all = [...Object.values(boxes), ...Object.values(groupBoxes)];
  let maxX = 0;
  let maxY = 0;
  for (const b of all) {
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  const pad = 24;
  const sx = maxX > board.w - pad ? (board.w - pad) / maxX : 1;
  const sy = maxY > board.h - pad ? (board.h - pad) / maxY : 1;
  const scale = Math.min(1, sx, sy);
  if (scale < 1) {
    for (const b of all) {
      b.x *= scale;
      b.y *= scale;
      b.w *= scale;
      b.h *= scale;
      if (b.hCollapsed) b.hCollapsed *= scale;
      if (b.hExpanded) b.hExpanded *= scale;
    }
  }

  parkFoldedChildren(spec, boxes, groupBoxes);
  const routes = routeEdges(boxes, spec.edges, groupBoxes);

  return {
    board,
    boxes,
    groupBoxes,
    routes,
    engine: 'elk',
  };
}

function findElk(node, id) {
  if (node.id === id) return node;
  for (const c of node.children || []) {
    const f = findElk(c, id);
    if (f) return f;
  }
  return null;
}
