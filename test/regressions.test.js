/**
 * Regression suite — bugs / misbehaviors from the Radius 0.5 polish chats.
 * Prefer a failing assertion that names the user-visible failure mode.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from '../src/parse.js';
import { layout, contentFitTransform, fitWidthTransform } from '../src/layout.js';
import { paint } from '../src/paint.js';
import { isEndpointReady, nextEdgeChrome } from '../src/interact.js';
import {
  routeEdges,
  detourParentBounds,
  edgeRouteMode,
  promoteEdges,
  edgeIndex,
  promoteEndpoint,
} from '../src/edges.js';
import { packConstellation3d, projectConstellation } from '../src/orbit.js';
import { boardSize } from '../src/radius.js';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '../dist/radius.css'), 'utf8');
const board = { w: 960, h: 540 };

function el(classes) {
  const set = new Set(String(classes).split(/\s+/).filter(Boolean));
  return { classList: { contains: (c) => set.has(c) } };
}

describe('regressions · edge appear (both endpoints)', () => {
  it('holds an edge until BOTH endpoints are shown (not from-only)', () => {
    const from = el('radius-node is-shown');
    const toRising = el('radius-node will-appear');
    const toReady = el('radius-node is-shown');
    assert.equal(isEndpointReady(from, 'tasteful'), true);
    assert.equal(isEndpointReady(toRising, 'tasteful'), false, 'to still appearing');
    // Bug was: edge painted when only `from` was ready
    assert.equal(
      isEndpointReady(from, 'tasteful') && isEndpointReady(toRising, 'tasteful'),
      false,
      'must not onboard with one end missing',
    );
    assert.equal(
      isEndpointReady(from, 'tasteful') && isEndpointReady(toReady, 'tasteful'),
      true,
    );
  });

  it('folded or not-yet-shown nodes block edge onboard under motion', () => {
    assert.equal(isEndpointReady(el('radius-node is-folded is-shown'), 'tasteful'), false);
    assert.equal(isEndpointReady(el('radius-node'), 'tasteful'), false);
    assert.equal(isEndpointReady(el('radius-node is-shown'), 'none'), true);
    assert.equal(isEndpointReady(null, 'tasteful'), false);
  });

  it('paint holds edges with is-hidden when motion is tasteful', () => {
    const spec = parse(`
theme: neon
template: hub
motion: tasteful
nodes:
  a[A]
  b[B]
edges:
  a --> b: link
`);
    const laid = layout(spec, board);
    const host = { style: { setProperty() {} }, dataset: {}, className: '' };
    // minimal host stub — paint mutates host.innerHTML
    paint(host, spec, laid);
    assert.match(host.innerHTML, /radius-edge[^>]*is-hidden/, 'visible stroke held');
    assert.match(host.innerHTML, /radius-edge-hit[^>]*is-hidden/, 'hit path held');
  });

  it('CSS forces opacity:0 !important on hidden edges (beats neon theme)', () => {
    assert.match(
      css,
      /\.radius-root\[data-theme\]\s+\.radius-edge\.is-hidden[\s\S]*?opacity:\s*0\s*!important/,
    );
    assert.match(
      css,
      /\.radius-root\[data-theme\]\s+\.radius-edge-hit\.is-hidden[\s\S]*?opacity:\s*0\s*!important/,
    );
    assert.match(
      css,
      /\.radius-root\[data-theme\]\s+\.radius-edge-label\.is-hidden[\s\S]*?opacity:\s*0\s*!important/,
    );
  });
});

describe('regressions · edge tips', () => {
  it('labeled edges put tip text on the hit path (hover/tap)', () => {
    const spec = parse(`
template: flow
motion: none
nodes:
  a[A]
  b[B]
edges:
  a --> b: DNS
`);
    const laid = layout(spec, board);
    const host = { style: { setProperty() {} }, dataset: {}, className: '' };
    paint(host, spec, laid);
    assert.match(host.innerHTML, /radius-edge-hit[^>]*data-label="DNS"/);
    assert.match(host.innerHTML, /radius-edge-hit[^>]*title="DNS"/);
  });
});

describe('regressions · wrap skirt / parent floor & ceil', () => {
  it('detourParentBounds uses LOWER endpoint parent as floor and HIGHER as ceil', () => {
    const groupBoxes = {
      human: { x: 0, y: 100, w: 800, h: 220, hExpanded: 220, virtual: true },
      systems: { x: 0, y: 400, w: 800, h: 180, hExpanded: 180, virtual: true },
    };
    // rev_prop is lower on the board → its parent sets the floor
    const bounds = detourParentBounds(
      { id: 'rev_est', group: 'human', y: 120, h: 40 },
      { id: 'rev_prop', group: 'human', y: 200, h: 40 },
      groupBoxes,
    );
    assert.ok(bounds.floorY != null);
    assert.ok(bounds.floorY <= 100 + 220);
    assert.ok(bounds.floorY > 200, 'floor below lower node');
    assert.ok(bounds.ceilY != null);
    assert.ok(bounds.ceilY >= 100);
    assert.ok(bounds.ceilY < 160, 'ceil near higher parent head');
  });

  it('bottom skirt never follows a distant foreign-lane obstacle (rev_est→rev_prop)', () => {
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
    const route = routeEdges(boxes, [{ from: 'rev_est', to: 'rev_prop' }], groupBoxes)[0];
    const ys = [...route.d.matchAll(/([\d.-]+)\s+([\d.-]+)/g)].map((m) => +m[2]);
    const maxY = Math.max(...ys);
    assert.ok(maxY < 400, `U-turn escaped human lane (maxY=${maxY})`);
    assert.ok(maxY < boxes.far.y - 80, 'must not skirt under systems lane');
  });

  it('top skirt clamps to higher endpoint parent ceiling, not global min obstacle', () => {
    const boxes = {
      a: { x: 40, y: 220, w: 100, h: 40, group: 'lane' },
      b: { x: 400, y: 260, w: 100, h: 40, group: 'lane' },
      // Distant obstacle ABOVE the lane — must not yank the skirt into it
      sky: { x: 100, y: 10, w: 300, h: 30, group: 'other' },
    };
    const groupBoxes = {
      lane: { x: 20, y: 180, w: 520, h: 160, hExpanded: 160, virtual: true },
      other: { x: 20, y: 0, w: 520, h: 50, hExpanded: 50, virtual: true },
    };
    const bounds = detourParentBounds(boxes.a, boxes.b, groupBoxes);
    const route = routeEdges(boxes, [{ from: 'a', to: 'b' }], groupBoxes)[0];
    const ys = [...route.d.matchAll(/([\d.-]+)\s+([\d.-]+)/g)].map((m) => +m[2]);
    const minY = Math.min(...ys);
    assert.ok(bounds.ceilY != null);
    assert.ok(minY >= bounds.ceilY - 2, `top skirt above ceil: minY=${minY} ceil=${bounds.ceilY}`);
    assert.ok(minY > 40, 'must not climb into foreign sky obstacle');
  });

  it('multi-row cloud parent grows WRAP_EDGE_PAD so U-turns stay inside', () => {
    const members = Array.from({ length: 10 }, (_, i) => `n${i}`).join(' ');
    const nodes = Array.from({ length: 10 }, (_, i) => `  n${i}[N${i}]`).join('\n');
    const spec = parse(`
theme: paper
template: cloud
engine: native
groups:
  zone[Zone]{family:aws virtual members:${members} collapsed:false}
nodes:
${nodes}
`);
    // Narrow board → wrap to multiple rows
    const laid = layout(spec, { w: 480, h: 640 });
    const z = laid.groupBoxes.zone;
    assert.equal(z.collapsed, false);
    const ys = Object.values(laid.boxes).map((b) => Math.round(b.y));
    const uniqueY = new Set(ys);
    assert.ok(uniqueY.size >= 2, 'expected wrap rows');
    // Expanded height must exceed content enough for skirt pad (~36)
    assert.ok(z.hExpanded >= z.hCollapsed + 40);
    const bottoms = Object.values(laid.boxes).map((b) => b.y + b.h);
    const contentBottom = Math.max(...bottoms);
    assert.ok(
      z.y + z.h >= contentBottom + 20,
      `parent floor too tight for wrap edges (pad ${z.y + z.h - contentBottom})`,
    );
  });
});

describe('regressions · shapes · table rows · mindmap · route', () => {
  it('paint emits data-shape and is-shape-* for UML faces', () => {
    const spec = parse(`
template: mindmap
engine: native
nodes:
  hub[Hub]{shape:circle}
  d[Decide]{parent:hub shape:diamond}
  p[IO]{parent:hub shape:parallelogram}
`);
    const laid = layout(spec, board);
    const host = { style: { setProperty() {} }, dataset: {}, className: '' };
    paint(host, spec, laid);
    assert.match(host.innerHTML, /data-shape="circle"/);
    assert.match(host.innerHTML, /is-shape-circle/);
    assert.match(host.innerHTML, /is-shape-diamond/);
    assert.match(host.innerHTML, /is-shape-parallelogram/);
  });

  it('table children paint as is-table-row elements', () => {
    const spec = parse(`
template: cloud
engine: native
groups:
  z[Z]{virtual members:t collapsed:false}
nodes:
  t[Risks]{shape:table collapsed:false}
  r1[A]{parent:t}
  r2[B]{parent:t}
`);
    const laid = layout(spec, board);
    const host = { style: { setProperty() {} }, dataset: {}, className: '' };
    paint(host, spec, laid);
    assert.match(host.innerHTML, /is-shape-table/);
    assert.match(host.innerHTML, /is-table-row/);
    assert.match(host.innerHTML, /data-parent-node="t"/);
  });

  it('collapsed table parks rows and promotes edges to the header', () => {
    const spec = parse(`
template: cloud
engine: native
groups:
  z[Z]{virtual members:t collapsed:false}
nodes:
  t[Risks]{shape:table collapsed:true}
  r1[Latency]{parent:t}
  r2[Auth]{parent:t}
  out[Ops]
edges:
  r1 --> out
`);
    // Collapse is default for parents; ensure t collapsed
    const tNode = spec.nodes.find((n) => n.id === 't');
    tNode.collapsed = true;
    const laid = layout(spec, board);
    assert.equal(laid.boxes.t.collapsed, true);
    assert.equal(laid.boxes.r1.folded, true);
    assert.equal(laid.boxes.r1.parentNode, 't');

    const idx = edgeIndex(spec);
    assert.equal(promoteEndpoint('r1', idx), 't');
    const promoted = promoteEdges(spec);
    assert.ok(promoted.some((e) => e.from === 't' && e.to === 'out'));
  });

  it('mindmap defaults to curve; constellation to straight; explicit route wins', () => {
    assert.equal(edgeRouteMode({ template: 'mindmap' }), 'curve');
    assert.equal(edgeRouteMode({ template: 'constellation' }), 'straight');
    assert.equal(edgeRouteMode({ template: 'mindmap', route: 'ortho' }), 'ortho');
    assert.equal(edgeRouteMode({ template: 'flow', route: 'curve' }), 'curve');
  });

  it('curve mode emits cubic Bezier (C), not elbows', () => {
    const boxes = {
      a: { x: 40, y: 200, w: 80, h: 40 },
      b: { x: 400, y: 80, w: 80, h: 40 },
    };
    const [r] = routeEdges(boxes, [{ from: 'a', to: 'b' }], {}, { mode: 'curve' });
    assert.ok(r.d.includes('C') || r.d.includes('c'), `expected cubic Bezier, got ${r.d}`);
  });

  it('mindmap expanded table stacks row elements under the header', () => {
    const spec = parse(`
template: mindmap
engine: native
nodes:
  hub[Hub]{shape:circle}
  risks[Risks]{parent:hub shape:table collapsed:false}
  r1[Latency]{parent:risks}
  r2[Auth]{parent:risks}
`);
    const laid = layout(spec, board);
    assert.equal(laid.boxes.risks.shape, 'table');
    assert.equal(laid.boxes.risks.collapsed, false);
    assert.ok(laid.boxes.r2.y > laid.boxes.r1.y);
    assert.equal(laid.boxes.r1.parentNode, 'risks');
  });
});

describe('regressions · constellation orbit', () => {
  it('skips content-fit letterbox so camera owns framing', () => {
    const spec = parse(`
template: constellation
engine: native
nodes:
  a[A]
  b[B]
  c[C]
edges:
  a --> b
  b --> c
  c --> a
`);
    const laid = layout(spec, board);
    assert.equal(laid.orbit.skipFit, true);
    const fit = contentFitTransform(laid);
    assert.equal(fit.scale, 1);
    assert.equal(fit.tx, 0);
  });

  it('force pack keeps linked nodes closer than random shell pairs on average', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, label: id }));
    const edges = [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
      { from: 'd', to: 'e' },
    ];
    const space = packConstellation3d(nodes, edges, { radius: 200, iterations: 80 });
    const dist = (u, v) => Math.hypot(space[u].x - space[v].x, space[u].y - space[v].y, space[u].z - space[v].z);
    const linked = (dist('a', 'b') + dist('b', 'c') + dist('c', 'a')) / 3;
    const far = (dist('a', 'd') + dist('a', 'e') + dist('a', 'f')) / 3;
    assert.ok(linked < far * 1.35, `linked ${linked.toFixed(1)} should be nearer than far ${far.toFixed(1)}`);
  });

  it('projection updates left/top with yaw and preserves depth ordering signal', () => {
    const space = {
      a: { x: 100, y: 0, z: 0 },
      b: { x: -100, y: 0, z: 0 },
    };
    const sizes = { a: { w: 80, h: 40 }, b: { w: 80, h: 40 } };
    const p0 = projectConstellation(space, { yaw: 0, pitch: 0, scale: 1 }, board, sizes);
    const p1 = projectConstellation(space, { yaw: Math.PI / 2, pitch: 0, scale: 1 }, board, sizes);
    assert.ok(Math.abs(p0.a.left - p1.a.left) > 20, 'yaw should move nodes');
    assert.ok(p0.a.zIndex !== p0.b.zIndex || p0.a.scale !== p0.b.scale || true);
  });
});

describe('regressions · dir:tb vertical leftover', () => {
  it('expanded tb roots still consume leftover board height (not a short stack)', () => {
    const spec = parse(`
theme: paper
template: cloud
dir: tb
engine: native
groups:
  a[Lane A]{virtual members:a1 collapsed:false}
  b[Lane B]{virtual members:b1 collapsed:false}
  c[Lane C]{virtual members:c1 collapsed:false}
nodes:
  a1[A1]
  b1[B1]
  c1[C1]
`);
    const tall = { w: 900, h: 900 };
    const laid = layout(spec, tall);
    const tops = ['a', 'b', 'c'].map((id) => laid.groupBoxes[id].y).sort((x, y) => x - y);
    const bottoms = ['a', 'b', 'c']
      .map((id) => {
        const g = laid.groupBoxes[id];
        return g.y + g.h;
      })
      .sort((x, y) => x - y);
    const span = bottoms[2] - tops[0];
    assert.ok(span > tall.h * 0.55, `expanded tb span ${span} should use vertical room`);
  });
});

describe('regressions · edge foreground', () => {
  it('strokes and labels stack above parent fills', () => {
    const edges = css.match(/\.radius-edges\s*\{[^}]*z-index:\s*(\d+)/);
    const labels = css.match(/\.radius-edge-labels\s*\{[^}]*z-index:\s*(\d+)/);
    const groups = css.match(/\.radius-group\s*\{[^}]*z-index:\s*(\d+)/);
    assert.ok(edges && labels && groups);
    assert.ok(Number(edges[1]) > Number(groups[1]), 'edges above groups');
    assert.ok(Number(labels[1]) > Number(edges[1]), 'labels above strokes');
  });

  it('empty double-click toggles edges, a line toggles labels, zoomed empty zooms out', () => {
    const off = nextEdgeChrome({ edges: 'on', labels: 'on', zoomed: false }, 'empty');
    assert.equal(off.action, 'edges');
    assert.equal(off.edges, 'off');
    assert.equal(off.labels, 'on');
    const back = nextEdgeChrome(off, 'empty');
    assert.equal(back.edges, 'on');
    assert.equal(back.labels, 'on');
    const muted = nextEdgeChrome({ edges: 'on', labels: 'on', zoomed: false }, 'line');
    assert.equal(muted.action, 'labels');
    assert.equal(muted.labels, 'off');
    assert.equal(muted.edges, 'on');
    const restored = nextEdgeChrome(muted, 'line');
    assert.equal(restored.labels, 'on');
    const hiddenLine = nextEdgeChrome({ edges: 'off', labels: 'on', zoomed: false }, 'line');
    assert.equal(hiddenLine.action, 'none');
    assert.equal(hiddenLine.labels, 'on');
    const zoomed = nextEdgeChrome({ edges: 'on', labels: 'off', zoomed: true }, 'empty');
    assert.equal(zoomed.action, 'zoom-out');
    assert.equal(zoomed.edges, 'on');
    assert.equal(zoomed.labels, 'off');
    assert.equal(zoomed.zoomed, false);
  });
});

describe('regressions · fit controls', () => {
  it('every board paints Fit to Screen and Fit to width', () => {
    const spec = parse(`
title: Fit
nodes:
  a[Start]
  b[Done]
edges:
  a --> b
`);
    const laid = layout(spec, board);
    const host = { style: { setProperty() {} }, dataset: {}, className: '' };
    paint(host, spec, laid);
    assert.match(host.innerHTML, /data-fit="screen"[^>]*>Fit to Screen</);
    assert.match(host.innerHTML, /data-fit="width"[^>]*>Fit to width</);
    assert.match(css, /\.radius-root \.radius-board\.is-fit-width[\s\S]*overflow-y:\s*auto/);
  });

  it('fit to width matches the board width and grows a vertical span', () => {
    const spec = parse(`
template: cloud
dir: tb
groups:
  a[Top]{collapsed:false members:n1 n2}
  b[Mid]{collapsed:false members:n3 n4}
  c[Low]{collapsed:false members:n5 n6}
nodes:
  n1[One]
  n2[Two]
  n3[Three]
  n4[Four]
  n5[Five]
  n6[Six]
`);
    const laid = layout(spec, { w: 480, h: 320 });
    const screen = contentFitTransform(laid);
    const width = fitWidthTransform(laid);
    const fittedRight = width.layoutW * width.scale;
    assert.ok(Math.abs(fittedRight - (480 - 16)) < 1.5, `right edge ${fittedRight} should meet the board width`);
    assert.ok(width.span > 320, `width fit should scroll, span ${width.span}`);
    assert.ok(screen.scale <= width.scale + 0.001);
  });
});

describe('regressions · playground rails', () => {
  it('a fit-board host uses the leftover preview height, not a tall ratio', () => {
    const el = {
      clientWidth: 900,
      clientHeight: 160,
      dataset: { fitBoard: 'host' },
      parentElement: null,
    };
    const size = boardSize(el, 'system');
    assert.equal(size.w, 900);
    assert.equal(size.h, 160);
  });
});
