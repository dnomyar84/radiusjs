import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse, normalizeWires, wireVisible } from '../src/parse.js';
import { layout, layoutAsync, layoutReport } from '../src/layout.js';
import {
  approxTextWidth,
  fitLabel,
  measureNode,
  ICON_FACE,
  ICON_MIN,
  iconSizeForWidth,
} from '../src/labels.js';

describe('parse 0.5', () => {
  it('parses layout hints and time layers', () => {
    const spec = parse(`
template: timeline
dir: lr
nodes:
  a[Assess]{rank:0 time:2024 Q1}
  b[Pilot]{rank:1 time:2024 Q2}
`);
    assert.equal(spec.template, 'timeline');
    assert.equal(spec.dir, 'lr');
    assert.equal(spec.nodes[0].rank, 0);
    assert.equal(spec.nodes[0].time, '2024 Q1');
    assert.equal(spec.nodes[1].time, '2024 Q2');
  });

  it('rejects raw x/y and font-size', () => {
    assert.throws(
      () => parse('nodes:\n  a[A]{x:10}'),
      (e) => e.radius && /layout/i.test(e.see),
    );
    assert.throws(
      () => parse('font-size: 12\nnodes:\n  a[A]'),
      (e) => e.radius,
    );
  });

  it('parses expand all and collapse all story steps', () => {
    const spec = parse(`
nodes:
  a[A]
groups:
  g[G]{members:a collapsed:true}
story:
  expand all
  collapse all
  expand-all
  collapseAll
`);
    assert.deepEqual(spec.story[0], { type: 'expandAll' });
    assert.deepEqual(spec.story[1], { type: 'collapseAll' });
    assert.deepEqual(spec.story[2], { type: 'expandAll' });
    assert.deepEqual(spec.story[3], { type: 'collapseAll' });
  });

  it('parses wire groups and wires filter', () => {
    const spec = parse(`
wires: flow trust
nodes:
  a[A]
  b[B]
  c[C]
edges:
  a --> b{wire:flow}
  a --> c: dns{wire:trust}
  b --> c
story:
  wires off
  wires flow
  wires all
`);
    assert.equal(spec.wires.mode, 'only');
    assert.deepEqual(spec.wires.names, ['flow', 'trust']);
    assert.equal(spec.edges[0].wire, 'flow');
    assert.equal(spec.edges[1].wire, 'trust');
    assert.equal(spec.edges[1].label, 'dns');
    assert.equal(spec.edges[2].wire, 'main');
    assert.equal(spec.story[0].type, 'wires');
    assert.equal(spec.story[0].wires.mode, 'off');
    assert.equal(spec.story[2].wires.mode, 'all');
    assert.equal(wireVisible('flow', spec.wires), true);
    assert.equal(wireVisible('main', spec.wires), false);
    assert.equal(wireVisible('main', normalizeWires('off')), false);
    assert.equal(wireVisible('x', normalizeWires('all')), true);
  });

  it('defaults omit template to flow', () => {
    const spec = parse('nodes:\n  a[A]\n  b[B]\nedges:\n  a --> b');
    assert.equal(spec.template, 'flow');
  });
});

describe('labels', () => {
  it('keeps short labels on one line when width allows', () => {
    const fit = fitLabel('Event bus', { maxBoxW: 220, pad: 28, maxLines: 2 });
    assert.equal(fit.lines.length, 1);
    assert.equal(fit.truncated, false);
    assert.equal(fit.display, 'Event bus');
  });

  it('truncates long labels with ellipsis when they cannot fit', () => {
    const fit = fitLabel(
      'Ingest gateway with a deliberately long label for ellipsis testing and more words',
      { maxBoxW: 160, pad: 56, maxLines: 2, maxPx: 15, minPx: 11 },
    );
    assert.equal(fit.truncated, true);
    assert.match(fit.display, /…/);
    assert.ok(fit.full.length > fit.display.replace(/…/g, '').length);
  });

  it('stretches horizontally before wrapping when maxBoxW allows', () => {
    const wide = fitLabel('Management cluster', {
      maxBoxW: 400,
      pad: 28,
      maxLines: 2,
      minPx: 11,
      maxPx: 15,
      maxBoxH: 80,
    });
    assert.equal(wide.lines.length, 1, 'grow width keeps one line');
    assert.equal(wide.fontPx, 15);
    assert.ok(wide.w > 160);
    assert.equal(wide.truncated, false);
  });

  it('wraps at full font only after max width is hit', () => {
    const fit = fitLabel('Management cluster control', {
      maxBoxW: 200,
      pad: 20,
      maxLines: 2,
      minPx: 11,
      maxPx: 15,
      maxBoxH: 80,
    });
    assert.ok(approxTextWidth(fit.full, 15) > 200 - 20, 'max width exhausted');
    assert.ok(fit.lines.length >= 2, 'wrap after stretch ceiling');
    assert.equal(fit.fontPx, 15, 'keep full font when wrapping');
    assert.equal(fit.w, 200, 'stay at max stretched width');
    assert.equal(fit.truncated, false);
  });

  it('shrinks single line when wrap would exceed max height', () => {
    const fit = fitLabel('Management cluster', {
      maxBoxW: 200,
      pad: 28,
      maxLines: 2,
      minPx: 11,
      maxPx: 15,
      maxBoxH: 36, // too short for a 2-line block at full size
    });
    assert.equal(fit.lines.length, 1);
    assert.ok(fit.fontPx < 15, 'shrink instead of wrap');
    assert.equal(fit.truncated, false);
  });

  it('scales glyph icon down when the pack slot is narrower than prefer width', () => {
    assert.equal(iconSizeForWidth(200), ICON_FACE);
    assert.ok(iconSizeForWidth(77) < ICON_FACE, 'deep nest slot shrinks logo');
    assert.ok(iconSizeForWidth(77) >= ICON_MIN);
    const tight = measureNode(
      { id: 'x', label: 'Private ingress controller — inter-pod proxy', kind: 'esri.lb' },
      { maxBoxW: 77 },
    );
    assert.ok(tight.icon < ICON_FACE);
    assert.ok(tight.w <= 77, 'face never exceeds slot');
    assert.ok(tight.fontPx <= 14);
    const roomy = measureNode(
      { id: 'y', label: 'Portal', kind: 'esri.portal' },
      { maxBoxW: 200 },
    );
    assert.equal(roomy.icon, ICON_FACE);
  });
});

describe('edge spacing', () => {
  it('mindmap defaults to curve routes', async () => {
    const { routeEdges, edgeRouteMode } = await import('../src/edges.js');
    assert.equal(edgeRouteMode({ template: 'mindmap' }), 'curve');
    assert.equal(edgeRouteMode({ template: 'flow', route: 'curve' }), 'curve');
    assert.equal(edgeRouteMode({ template: 'flow' }), 'ortho');
    const boxes = {
      a: { x: 80, y: 200, w: 60, h: 40 },
      b: { x: 320, y: 80, w: 60, h: 40 },
    };
    const [route] = routeEdges(boxes, [{ from: 'a', to: 'b' }], {}, { mode: 'curve' });
    assert.ok(route.d.includes('C') || route.d.includes('c'), `expected cubic path, got ${route.d}`);
  });

  it('offsets parallel elbows when several edges share a corridor', async () => {
    const { routeEdges } = await import('../src/edges.js');
    const boxes = {
      a: { x: 0, y: 40, w: 80, h: 40 },
      b: { x: 0, y: 120, w: 80, h: 40 },
      c: { x: 0, y: 200, w: 80, h: 40 },
      d: { x: 280, y: 100, w: 80, h: 40 },
    };
    const routes = routeEdges(boxes, [
      { from: 'a', to: 'd' },
      { from: 'b', to: 'd' },
      { from: 'c', to: 'd' },
    ]);
    const offsets = new Set(routes.map((r) => r.channelOffset));
    assert.equal(routes.length, 3);
    assert.ok(offsets.size >= 2, 'parallel edges should use different channel offsets');
  });

  it('row-wrap edges stay inside the lower endpoint parent floor', async () => {
    const { routeEdges, detourParentBounds } = await import('../src/edges.js');
    // End of row → start of next row; distant lane must not pull the skirt down.
    const boxes = {
      rev_est: { x: 900, y: 200, w: 160, h: 44, group: 'human' },
      rev_prop: { x: 40, y: 280, w: 160, h: 44, group: 'human' },
      mid: { x: 480, y: 200, w: 160, h: 44, group: 'human' },
      far: { x: 200, y: 900, w: 400, h: 60, group: 'systems' },
    };
    const groupBoxes = {
      human: { x: 20, y: 160, w: 1100, h: 200, hExpanded: 200, virtual: true },
      systems: { x: 20, y: 860, w: 1100, h: 120, hExpanded: 120, virtual: true },
    };
    const bounds = detourParentBounds(
      { id: 'rev_est', group: 'human', y: 200, h: 44 },
      { id: 'rev_prop', group: 'human', y: 280, h: 44 },
      groupBoxes,
    );
    assert.ok(bounds.floorY != null && bounds.floorY <= 160 + 200);
    assert.ok(bounds.ceilY != null && bounds.ceilY >= 160);

    const route = routeEdges(boxes, [{ from: 'rev_est', to: 'rev_prop' }], groupBoxes)[0];
    const ys = [...route.d.matchAll(/([\d.-]+)\s+([\d.-]+)/g)].map((m) => +m[2]);
    const maxY = Math.max(...ys);
    const minY = Math.min(...ys);
    assert.ok(maxY <= bounds.floorY + 1, `bottom skirt past parent floor: maxY=${maxY} floor=${bounds.floorY}`);
    assert.ok(minY >= bounds.ceilY - 1, `top skirt above parent ceiling: minY=${minY} ceil=${bounds.ceilY}`);
    assert.ok(maxY < boxes.far.y - 40, `must not skirt under far lane (maxY=${maxY})`);
  });

  it('spaces parallel vertical mid-runs evenly in x', async () => {
    const { routeEdges } = await import('../src/edges.js');
    const boxes = {
      a: { x: 0, y: 20, w: 80, h: 36 },
      b: { x: 0, y: 100, w: 80, h: 36 },
      c: { x: 0, y: 180, w: 80, h: 36 },
      x: { x: 300, y: 20, w: 80, h: 36 },
      y: { x: 300, y: 100, w: 80, h: 36 },
      z: { x: 300, y: 180, w: 80, h: 36 },
    };
    const routes = routeEdges(boxes, [
      { from: 'a', to: 'x' },
      { from: 'b', to: 'y' },
      { from: 'c', to: 'z' },
    ]);
    const mids = routes
      .map((r) => {
        const pts = [...r.d.matchAll(/([ML])\s+([\d.-]+)\s+([\d.-]+)/g)].map((m) => ({
          x: +m[2],
          y: +m[3],
        }));
        // Vertical mid segment of hvh: consecutive points with same x, different y
        for (let i = 0; i < pts.length - 1; i++) {
          if (Math.abs(pts[i].x - pts[i + 1].x) < 0.5 && Math.abs(pts[i].y - pts[i + 1].y) > 1) {
            return pts[i].x;
          }
        }
        return r.channel;
      })
      .filter((v) => v != null)
      .sort((a, b) => a - b);
    assert.equal(mids.length, 3);
    const g0 = mids[1] - mids[0];
    const g1 = mids[2] - mids[1];
    assert.ok(Math.abs(g0 - g1) < 1.5, `uneven gaps ${g0} vs ${g1}`);
    assert.ok(g0 >= 14, `lanes too tight (${g0})`);
  });

  it('enters a vertical face horizontally and a horizontal face vertically', async () => {
    const { routeEdges } = await import('../src/edges.js');
    // a left of d → attach right→left (both vertical faces) → last segment horizontal
    const side = routeEdges(
      {
        a: { x: 0, y: 80, w: 80, h: 40 },
        d: { x: 280, y: 40, w: 80, h: 120 },
      },
      [{ from: 'a', to: 'd' }],
    )[0];
    const pts = [...side.d.matchAll(/([ML])\s+([\d.-]+)\s+([\d.-]+)/g)].map((m) => ({
      x: +m[2],
      y: +m[3],
    }));
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    assert.ok(Math.abs(last.y - prev.y) < 0.5, 'entry into left/right face must be horizontal');
    assert.ok(Math.abs(last.x - prev.x) > 1, 'entry must move in x');

    // a above d → attach bottom→top → last segment vertical
    const top = routeEdges(
      {
        a: { x: 100, y: 0, w: 80, h: 40 },
        d: { x: 100, y: 200, w: 80, h: 40 },
      },
      [{ from: 'a', to: 'd' }],
    )[0];
    const tpts = [...top.d.matchAll(/([ML])\s+([\d.-]+)\s+([\d.-]+)/g)].map((m) => ({
      x: +m[2],
      y: +m[3],
    }));
    const tLast = tpts[tpts.length - 1];
    const tPrev = tpts[tpts.length - 2];
    assert.ok(Math.abs(tLast.x - tPrev.x) < 0.5, 'entry into top/bottom face must be vertical');
    assert.ok(Math.abs(tLast.y - tPrev.y) > 1, 'entry must move in y');
  });

  it('separates overlapping edge labels', async () => {
    const { deconflictEdgeLabels } = await import('../src/edges.js');
    const routes = deconflictEdgeLabels([
      { label: '443', labelX: 100, labelY: 50 },
      { label: '443', labelX: 102, labelY: 51 },
      { label: '6443', labelX: 105, labelY: 52 },
    ]);
    const ys = routes.map((r) => r.labelY);
    const xs = routes.map((r) => r.labelX);
    // Not all stacked on the same point
    assert.ok(new Set(ys).size + new Set(xs).size > 2);
    // Pairwise boxes should not heavily overlap after deconflict
    const boxes = routes.map((r) => {
      const w = Math.min(120, Math.max(32, String(r.label).length * 6.4 + 14));
      return { x1: r.labelX - w / 2, x2: r.labelX + w / 2, y1: r.labelY - 18, y2: r.labelY };
    });
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const ox = Math.min(boxes[i].x2, boxes[j].x2) - Math.max(boxes[i].x1, boxes[j].x1);
        const oy = Math.min(boxes[i].y2, boxes[j].y2) - Math.max(boxes[i].y1, boxes[j].y1);
        assert.ok(ox <= 0 || oy <= 0, `labels ${i} and ${j} still overlap`);
      }
    }
  });

  it('routes around expanded virtual group captions', async () => {
    const { collectObstacles, virtualCaptionBox } = await import('../src/edges.js');
    const groupBoxes = {
      tier: {
        x: 0,
        y: 0,
        w: 400,
        h: 280,
        collapsed: false,
        virtual: true,
        label: 'Web tier',
      },
    };
    const boxes = {
      a: { x: 40, y: 80, w: 80, h: 40, group: 'tier' },
      b: { x: 280, y: 80, w: 80, h: 40, group: 'tier' },
    };
    const obs = collectObstacles(boxes, groupBoxes);
    const cap = obs.find((o) => o.kind === 'caption');
    assert.ok(cap, 'virtual caption is an obstacle');
    assert.equal(cap.id, 'tier__caption');
    const expected = virtualCaptionBox('tier', groupBoxes.tier);
    assert.equal(cap.x, expected.x);
    assert.equal(cap.y, expected.y);
    // Nodes still block; expanded frame itself does not
    assert.ok(obs.some((o) => o.id === 'a' && o.kind === 'node'));
    assert.ok(!obs.some((o) => o.id === 'tier' && o.kind === 'group'));
  });

  it('edge labels clear virtual group captions', async () => {
    const { deconflictEdgeLabels, virtualCaptionBox } = await import('../src/edges.js');
    const cap = virtualCaptionBox('tier', {
      x: 0,
      y: 0,
      w: 300,
      label: 'Administration pods',
    });
    const routes = deconflictEdgeLabels(
      [{ label: 'entry', labelX: cap.x + cap.w / 2, labelY: cap.y + cap.h }],
      [cap],
    );
    const w = Math.min(120, Math.max(32, 5 * 6.4 + 14));
    const lx1 = routes[0].labelX - w / 2;
    const lx2 = routes[0].labelX + w / 2;
    const ly1 = routes[0].labelY - 18;
    const ly2 = routes[0].labelY;
    const ox = Math.min(lx2, cap.x + cap.w) - Math.max(lx1, cap.x);
    const oy = Math.min(ly2, cap.y + cap.h) - Math.max(ly1, cap.y);
    assert.ok(ox <= 0 || oy <= 0, 'edge label still overlaps virtual caption');
  });

  it('collectLabelObstacles includes expanded virtual captions', async () => {
    const { collectLabelObstacles } = await import('../src/edges.js');
    const fixed = collectLabelObstacles({
      ns: {
        x: 10,
        y: 20,
        w: 400,
        h: 300,
        collapsed: false,
        virtual: true,
        label: 'arcgis namespace',
      },
      hidden: {
        x: 0,
        y: 0,
        w: 100,
        h: 80,
        collapsed: true,
        virtual: true,
        label: 'collapsed',
      },
    });
    assert.ok(fixed.some((o) => o.kind === 'caption' && o.id === 'ns__caption'));
    assert.ok(!fixed.some((o) => o.id === 'hidden__caption'));
  });

  it('edge labels clear virtual dotted borders', async () => {
    const { deconflictEdgeLabels, collectLabelObstacles, virtualBorderBoxes } =
      await import('../src/edges.js');
    const g = { x: 0, y: 0, w: 200, h: 160, collapsed: false, virtual: true, label: 'Web' };
    const borders = virtualBorderBoxes('tier', g);
    assert.equal(borders.length, 4);
    const fixed = collectLabelObstacles({ tier: g });
    assert.ok(fixed.some((o) => o.kind === 'vborder'));
    assert.ok(fixed.some((o) => o.kind === 'caption'));

    // Place label dead-center on the left dashed edge
    const left = borders.find((b) => b.id.endsWith('__bl'));
    const routes = deconflictEdgeLabels(
      [{ label: '443', labelX: left.x + left.w / 2, labelY: left.y + left.h / 2 + 9 }],
      fixed,
    );
    const w = Math.min(120, Math.max(32, 3 * 6.4 + 14));
    const lx1 = routes[0].labelX - w / 2;
    const lx2 = routes[0].labelX + w / 2;
    const ly1 = routes[0].labelY - 18;
    const ly2 = routes[0].labelY;
    for (const b of borders) {
      const ox = Math.min(lx2, b.x + b.w) - Math.max(lx1, b.x);
      const oy = Math.min(ly2, b.y + b.h) - Math.max(ly1, b.y);
      assert.ok(ox <= 0 || oy <= 0, `edge label still overlaps border ${b.id}`);
    }
  });

  it('merges grandchild edges into one parent→parent when both sides fold', async () => {
    const { routeEdges } = await import('../src/edges.js');
    const boxes = {
      p: { x: 0, y: 0, w: 120, h: 64, collapsed: true, isParent: true },
      q: { x: 300, y: 0, w: 120, h: 64, collapsed: true, isParent: true },
      a1: { x: 0, y: 0, w: 1, h: 1, folded: true, parentNode: 'p' },
      a2: { x: 0, y: 0, w: 1, h: 1, folded: true, parentNode: 'p' },
      a3: { x: 0, y: 0, w: 1, h: 1, folded: true, parentNode: 'p' },
      b1: { x: 300, y: 0, w: 1, h: 1, folded: true, parentNode: 'q' },
      b2: { x: 300, y: 0, w: 1, h: 1, folded: true, parentNode: 'q' },
    };
    const routes = routeEdges(boxes, [
      { from: 'a1', to: 'b1', label: '443' },
      { from: 'a2', to: 'b1', label: '6443' },
      { from: 'a3', to: 'b2', label: '443' },
      { from: 'a1', to: 'a2' }, // same parent — dropped as self-loop
    ]).filter((r) => r.d && !r.hidden);
    assert.equal(routes.length, 1);
    assert.equal(routes[0].resolvedFrom, 'p');
    assert.equal(routes[0].resolvedTo, 'q');
    assert.equal(routes[0].mergedCount, 3);
    // Distinct labels union onto the surviving chip; duplicates collapse
    assert.equal(routes[0].label, '443 · 6443');
  });

  it('mergeEdgeLabels unions distinct port labels', async () => {
    const { mergeEdgeLabels } = await import('../src/edges.js');
    assert.equal(mergeEdgeLabels('443', '6443', '443'), '443 · 6443');
    assert.equal(mergeEdgeLabels('443 · 6443', '7443'), '443 · 6443 · 7443');
    assert.equal(mergeEdgeLabels(null, '53'), '53');
    assert.equal(mergeEdgeLabels(null, null), null);
  });
});

describe('layout fold + timeline', () => {
  it('collapsed group is element-sized', () => {
    const spec = parse(`
template: cloud
groups:
  g[System]{members:a b collapsed:true}
nodes:
  a[A]
  b[B]
`);
    const laid = layout(spec, { w: 960, h: 540 });
    const g = laid.groupBoxes.g;
    assert.ok(g);
    assert.equal(g.collapsed, true);
    assert.ok(g.hCollapsed <= 80, `face height ${g.hCollapsed}`);
    assert.equal(g.h, g.hCollapsed);
  });

  it('timeline packs instances on a tick axis (wraps when needed)', () => {
    const spec = parse(`
template: timeline
dir: lr
nodes:
  a[Assess]{rank:0 time:Q1}
  b[Pilot]{rank:1 time:Q2}
  c[Scale]{rank:2 time:Q3}
  d[Harden]{rank:3 time:Q4}
  e[Cutover]{rank:4 time:Y2}
  f[Optimize]{rank:5 time:Y2Q2}
edges:
  a --> b
  b --> c
  c --> d
  d --> e
  e --> f
`);
    const laid = layout(spec, { w: 420, h: 540 });
    assert.ok(laid.boxes.a);
    assert.ok(laid.boxes.b);
    assert.ok(laid.boxes.a.x < laid.boxes.b.x, 'first row left→right');
    assert.ok(laid.axis?.ticks?.length >= 6, 'tick per instance');
    assert.equal(laid.axis.ticks[0].label, 'Q1');
    assert.ok(laid.axis.segments?.some((s) => s.kind === 'row'));
    // Narrow board forces U-turn onto a second row
    assert.ok(laid.axis.rows >= 2, 'wraps to second rail');
    assert.ok(laid.axis.segments.some((s) => s.kind === 'uturn'), 'has U-turn');
  });

  it('node parent creates expandable face', () => {
    const spec = parse(`
template: cloud
nodes:
  sys[System]{layer:conceptual}
  api[API]{parent:sys layer:logical}
  db[DB]{parent:sys layer:logical}
`);
    const laid = layout(spec, { w: 960, h: 540 });
    assert.equal(laid.boxes.sys.expandable, true);
    assert.equal(laid.boxes.sys.collapsed, true);
    assert.ok(laid.boxes.api.folded || laid.boxes.api.parentNode === 'sys');
  });
});

describe('elk async', () => {
  it('layoutAsync returns boxes for flow', async () => {
    const spec = parse(`
template: flow
engine: auto
nodes:
  a[A]
  b[B]
edges:
  a --> b
`);
    const laid = await layoutAsync(spec, { w: 960, h: 540 });
    assert.ok(laid.boxes.a);
    assert.ok(laid.boxes.b);
    assert.ok(laid.engine === 'elk' || laid.engine === 'native');
    const report = layoutReport(spec, laid);
    assert.ok(Array.isArray(report.overlaps));
    assert.ok(Array.isArray(report.labelOverflow));
  });
});
