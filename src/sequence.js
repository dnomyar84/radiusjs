/**
 * Sequence layout — participants, lifelines, stacked messages.
 * Rows never share a band, so labels, notes, and actors do not pile up.
 * Fragment frames are painted with the strokes (see laid.frames).
 */

import { measureNode } from './labels.js';

const PAD = 28;
const ROW = 48;
const MIN_COL = 112;

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function routeOf(edge, d, labelX, labelY, labelW) {
  return {
    ...edge,
    d,
    labelX,
    labelY,
    labelW,
    resolvedFrom: edge.from,
    resolvedTo: edge.to,
    fromEndpoint: 'node',
    toEndpoint: 'node',
    logicalFrom: edge.from,
    logicalTo: edge.to,
    wire: edge.wire || 'main',
    line: edge.line || 'solid',
    head: edge.head || 'arrow',
    tail: edge.tail || 'none',
    mergedCount: 1,
    routeMode: 'sequence',
  };
}

function groupDepth(group, byId) {
  let d = 0;
  let parent = group.parent;
  while (parent && byId[parent] && d < 8) {
    d += 1;
    parent = byId[parent].parent;
  }
  return d;
}

/**
 * @returns {{ boxes, groupBoxes, routes, frames }}
 */
export function layoutSequence(spec, board) {
  const actors = (spec.nodes || []).filter((n) => n.role !== 'note' && n.role !== 'bar');
  const notes = (spec.nodes || []).filter((n) => n.role === 'note');
  const bars = (spec.nodes || []).filter((n) => n.role === 'bar');
  const messages = [...(spec.edges || [])];

  const rows = [];
  for (const n of notes) {
    if (num(n.rank, 0) < 0) rows.push({ kind: 'note', node: n });
  }
  messages.forEach((edge, i) => {
    rows.push({ kind: 'msg', edge, msg: i });
    for (const n of notes) {
      if (num(n.rank, -999) === i) rows.push({ kind: 'note', node: n });
    }
  });
  for (const n of notes) {
    if (n.rank == null) rows.push({ kind: 'note', node: n });
  }

  const colCount = Math.max(actors.length, 1);
  const naturalW = PAD * 2 + colCount * MIN_COL;
  const width = Math.max(board.w || 960, naturalW);
  const colW = (width - PAD * 2) / colCount;
  const topBand = spec.title ? 56 : 20;

  const boxes = {};
  const measures = actors.map((n) => measureNode(n, { maxBoxW: Math.max(72, colW - 20) }));
  const headH = Math.max(44, ...measures.map((m) => m.h), 44);
  actors.forEach((n, i) => {
    const m = measures[i];
    const w = Math.min(m.w, colW - 16);
    const h = m.h;
    boxes[n.id] = {
      x: PAD + i * colW + (colW - w) / 2,
      y: topBand,
      w,
      h,
      rank: i,
      measure: m,
      shape: n.shape || 'rect',
      role: n.role || null,
    };
  });

  const actorIndex = Object.fromEntries(actors.map((a, i) => [a.id, i]));
  const center = (id) => {
    const b = boxes[id];
    if (!b) return PAD + colW / 2;
    return b.x + b.w / 2;
  };

  const routes = [];
  const rowY = [];
  let yCursor = topBand + headH + 22;
  let minX = PAD;
  let maxX = width - PAD;

  for (const row of rows) {
    if (row.kind === 'msg') {
      const e = row.edge;
      const y = yCursor + 16;
      rowY[row.msg] = y;
      const self = e.from === e.to;
      if (self) {
        const x = center(e.from);
        const box = boxes[e.from];
        const loop = 36;
        const roomRight = width - 8 - (x + 8);
        const goRight = !box || roomRight >= loop;
        const x2 = goRight ? x + loop : x - loop;
        const y2 = y + 20;
        routes.push(routeOf(
          e,
          `M ${x} ${y} L ${x2} ${y} L ${x2} ${y2} L ${x + (goRight ? 6 : -6)} ${y2}`,
          (x + x2) / 2,
          y,
          72,
        ));
        minX = Math.min(minX, Math.min(x, x2) - 8);
        maxX = Math.max(maxX, Math.max(x, x2) + 8);
        yCursor += ROW + 10;
      } else {
        const x1 = center(e.from);
        const x2 = center(e.to);
        const gap = Math.max(48, Math.abs(x2 - x1) - 28);
        routes.push(routeOf(e, `M ${x1} ${y} L ${x2} ${y}`, (x1 + x2) / 2, y, Math.min(160, gap)));
        yCursor += ROW;
      }
    } else {
      const n = row.node;
      const lanes = String(n.lane || actors[0]?.id || '')
        .split(/[\s,]+/)
        .filter(Boolean);
      const a = lanes[0];
      const b = lanes[lanes.length - 1] || a;
      const ia = actorIndex[a] ?? 0;
      const ib = actorIndex[b] ?? ia;
      const side = n.side || (lanes.length > 1 ? 'over' : 'right');
      let x;
      let w;
      if (side === 'over' && ia !== ib) {
        const left = center(actors[Math.min(ia, ib)].id) + 16;
        const right = center(actors[Math.max(ia, ib)].id) - 16;
        x = left;
        w = Math.max(80, right - left);
      } else if (side === 'left') {
        w = Math.max(72, colW * 0.46);
        x = center(a) - 16 - w;
      } else {
        w = Math.max(72, Math.min(colW - 28, 180));
        x = center(a) + 16;
      }
      const h = 36;
      boxes[n.id] = {
        x,
        y: yCursor,
        w,
        h,
        rank: n.rank,
        measure: measureNode({ ...n, label: n.label || n.id }, { maxBoxW: w }),
        shape: n.shape || 'note',
        role: 'note',
      };
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + w);
      yCursor += h + 12;
    }
  }

  const bottom = yCursor + 18;

  for (const bar of bars) {
    const host = bar.lane && boxes[bar.lane] ? bar.lane : actors[0]?.id;
    if (!host || !boxes[host]) continue;
    const r0 = Math.max(0, num(bar.rank, 0));
    const span = Math.max(1, num(bar.span, 1));
    const y1 = (rowY[r0] ?? topBand + headH + 28) - 12;
    const last = Math.min(messages.length - 1, r0 + span - 1);
    const y2 = (rowY[last] ?? y1) + 14;
    boxes[bar.id] = {
      x: center(host) - 5,
      y: y1,
      w: 10,
      h: Math.max(18, y2 - y1),
      role: 'bar',
      shape: 'rect',
      measure: { w: 10, h: Math.max(18, y2 - y1), display: '', full: '', lines: [''], fontPx: 1 },
    };
  }

  for (const actor of actors) {
    const x = center(actor.id);
    const y1 = boxes[actor.id].y + boxes[actor.id].h + 2;
    const y2 = bottom - 6;
    if (y2 <= y1) continue;
    routes.push({
      from: actor.id,
      to: actor.id,
      label: null,
      wire: 'main',
      line: 'dotted',
      head: 'none',
      tail: 'none',
      d: `M ${x} ${y1} L ${x} ${y2}`,
      labelX: null,
      labelY: null,
      resolvedFrom: actor.id,
      resolvedTo: actor.id,
      fromEndpoint: 'node',
      toEndpoint: 'node',
      logicalFrom: actor.id,
      logicalTo: actor.id,
      mergedCount: 1,
      routeMode: 'lifeline',
    });
  }

  const byId = Object.fromEntries((spec.groups || []).map((g) => [g.id, g]));
  const frames = [];
  for (const g of spec.groups || []) {
    if (g.rank == null || !messages.length) continue;
    const start = Math.max(0, num(g.rank, 0));
    const span = Math.max(1, num(g.span, 1));
    const depth = groupDepth(g, byId);
    const inset = 6 + depth * 12;
    const y1 = (rowY[start] ?? topBand + headH) - 20;
    const last = Math.min(messages.length - 1, start + span - 1);
    const y2 = (rowY[last] ?? y1) + 16;
    frames.push({
      x: PAD - 4 + inset,
      y: y1,
      w: Math.max(40, width - (PAD - 4) * 2 - inset * 2),
      h: Math.max(26, y2 - y1),
      label: g.label || g.id,
    });
    minX = Math.min(minX, frames[frames.length - 1].x);
    maxX = Math.max(maxX, frames[frames.length - 1].x + frames[frames.length - 1].w);
  }

  for (const b of Object.values(boxes)) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.w);
  }

  const groupBoxes = {
    _extent: {
      x: minX - 4,
      y: Math.min(topBand, ...Object.values(boxes).map((b) => b.y)) - 4,
      w: maxX - minX + 12,
      h: bottom - Math.min(topBand, ...Object.values(boxes).map((b) => b.y)) + 12,
    },
  };

  return { boxes, groupBoxes, routes, frames };
}
