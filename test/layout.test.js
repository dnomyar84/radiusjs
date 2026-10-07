import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from '../src/parse.js';
import { layout, layoutReport, contentFitTransform, contentExtent } from '../src/layout.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, 'fixtures', name), 'utf8');
const board = { w: 960, h: 540 };

describe('layout L1', () => {
  it('process places equal-ish cells left to right', () => {
    const spec = parse(fixture('process.radius.md'));
    const laid = layout(spec, board);
    const ids = spec.nodes.map((n) => n.id);
    for (const id of ids) assert.ok(laid.boxes[id], id);
    assert.ok(laid.boxes.a.x < laid.boxes.b.x);
    assert.ok(laid.boxes.b.x < laid.boxes.c.x);
    const report = layoutReport(spec, laid);
    assert.equal(report.overlaps.length, 0);
  });

  it('cloud groups expose fold metrics', () => {
    const spec = parse(fixture('migration.radius.md'));
    const laid = layout(spec, board);
    assert.ok(laid.groupBoxes.src);
    assert.ok(laid.groupBoxes.dst);
    assert.equal(laid.groupBoxes.src.collapsed, true);
    assert.ok(laid.groupBoxes.src.hExpanded > laid.groupBoxes.src.hCollapsed);
    assert.deepEqual(laid.groupBoxes.src.members, ['hci', 'arc', 'vms']);
    const report = layoutReport(spec, laid);
    assert.equal(report.overlaps.length, 0);
  });

  it('hub puts first node near center', () => {
    const spec = parse(`
theme: neon
template: hub
nodes:
  core[Core]
  a[A]
  b[B]
  c[C]
`);
    const laid = layout(spec, board);
    const core = laid.boxes.core;
    const cx = core.x + core.w / 2;
    assert.ok(Math.abs(cx - board.w / 2) < 40);
    assert.equal(layoutReport(spec, laid).overlaps.length, 0);
  });

  it('boxes stay inside board padding', () => {
    const spec = parse(fixture('migration.radius.md'));
    const laid = layout(spec, board);
    for (const [id, b] of Object.entries(laid.boxes)) {
      assert.ok(b.x >= -1, id);
      assert.ok(b.y >= -1, id);
      assert.ok(b.x + b.w <= board.w + 1, id);
      assert.ok(b.y + b.h <= board.h + 1, id);
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), id);
    }
  });

  it('nests child groups under parent', () => {
    const spec = parse(`
theme: paper
template: cloud
groups:
  src[Source]{family:azure members:hci}
  compute[Compute]{family:azure parent:src members:vms aks}
nodes:
  hci[HCI]{kind:azure.hci}
  vms[VMs]{kind:azure.vm}
  aks[AKS]{kind:azure.aks}
`);
    const laid = layout(spec, board);
    assert.ok(laid.groupBoxes.src.childIds.includes('compute'));
    assert.equal(laid.groupBoxes.compute.parent, 'src');
    assert.ok(laid.groupBoxes.compute.depth >= 1);
    assert.ok(laid.boxes.vms.y > laid.groupBoxes.compute.y);
  });

  it('fit-scale shrinks when packed content exceeds the board', () => {
    const mk = (prefix, n) =>
      Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(' ');
    const mkNodes = (prefix, n) =>
      Array.from(
        { length: n },
        (_, i) => `  ${prefix}${i}[${prefix} service ${i}]{kind:aws.ec2}`,
      ).join('\n');
    const spec = parse(`
theme: paper
template: cloud
dir: tb
groups:
  a[A]{family:aws virtual members:${mk('a', 8)}}
  b[B]{family:aws virtual members:${mk('b', 8)}}
  c[C]{family:aws virtual members:${mk('c', 8)}}
nodes:
${mkNodes('a', 8)}
${mkNodes('b', 8)}
${mkNodes('c', 8)}
`);
    for (const g of spec.groups) g.collapsed = false;
    const laid = layout(spec, { w: 640, h: 360 });
    const fit = contentFitTransform(laid);
    assert.ok(fit.scale < 1, `expected fit-scale < 1, got ${fit.scale}`);
    const ext = contentExtent(laid);
    const scaledH = (ext.maxY - ext.minY) * fit.scale;
    assert.ok(scaledH <= 360 - 32 + 1, `scaled height ${scaledH} should fit board`);
  });

  it('dir:tb spreads collapsed roots across board height', () => {
    const spec = parse(`
theme: paper
template: cloud
dir: tb
groups:
  a[Lane A]{virtual members:a0}
  b[Lane B]{virtual members:b0}
  c[Lane C]{virtual members:c0}
  d[Lane D]{virtual members:d0}
nodes:
  a0[A0]
  b0[B0]
  c0[C0]
  d0[D0]
`);
    for (const g of spec.groups) g.collapsed = true;
    const board = { w: 800, h: 560 };
    const laid = layout(spec, board);
    const ys = ['a', 'b', 'c', 'd'].map((id) => laid.groupBoxes[id].y);
    const hs = ['a', 'b', 'c', 'd'].map((id) => laid.groupBoxes[id].h);
    // Equal gaps between faces (and top/bottom): spacing between midpoints ≈ equal
    const mids = ys.map((y, i) => y + hs[i] / 2);
    const gaps = [mids[1] - mids[0], mids[2] - mids[1], mids[3] - mids[2]];
    const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    for (const g of gaps) {
      assert.ok(Math.abs(g - avg) < 4, `uneven mid gaps ${gaps.join(',')}`);
    }
    // Uses vertical space — last face not clustered near the top
    const lastBottom = ys[3] + hs[3];
    assert.ok(lastBottom > board.h * 0.55, `last bottom ${lastBottom} should reach lower board`);
    assert.ok(ys[0] > 40, `first face should sit below a leading gap, got y=${ys[0]}`);
  });

  it('dir:tb also spreads leftover height when roots are expanded', () => {
    const spec = parse(`
theme: paper
template: cloud
dir: tb
groups:
  a[Lane A]{virtual members:a0 a1}
  b[Lane B]{virtual members:b0 b1}
nodes:
  a0[A0]
  a1[A1]
  b0[B0]
  b1[B1]
`);
    for (const g of spec.groups) g.collapsed = false;
    const board = { w: 900, h: 720 };
    const laid = layout(spec, board);
    const a = laid.groupBoxes.a;
    const b = laid.groupBoxes.b;
    // Expanded bands grow to use leftover height (not just gutters)
    assert.ok(a.h + b.h > 280, `bands should stretch into leftover, a=${a.h} b=${b.h}`);
    assert.ok(Math.abs(a.h - b.h) < 8, `equal stretch, a=${a.h} b=${b.h}`);
    assert.ok(b.y + b.h <= board.h - 46, 'still inside board');
    assert.ok(laid.boxes.a0.y >= a.y, 'child stays inside shifted parent');
    // Children re-guttered inside the taller band (not stuck under the caption)
    const headRoom = laid.boxes.a0.y - a.y;
    assert.ok(headRoom > 28, `content should drop into vertical gutters, headRoom=${headRoom}`);
  });

  it('nested subparent also fills horizontal space before wrapping', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `n${i}`);
    const nodes = ids.map((id, i) => `  ${id}[Service ${i}]{kind:aws.ec2}`).join('\n');
    const spec = parse(`
theme: paper
template: cloud
groups:
  outer[Outer]{virtual}
  inner[Inner]{parent:outer virtual members:${ids.join(' ')}}
nodes:
${nodes}
`);
    for (const g of spec.groups) g.collapsed = false;
    const laid = layout(spec, { w: 720, h: 520 });
    const tops = Object.values(laid.boxes).map((b) => Math.round(b.y));
    const counts = {};
    for (const y of tops) counts[y] = (counts[y] || 0) + 1;
    const rowCounts = Object.values(counts).sort((a, b) => b - a);
    assert.ok(rowCounts[0] >= 3, `inner pack should put ≥3 on first row, got ${rowCounts.join('+')}`);
    if (rowCounts.length >= 2) {
      assert.ok(
        Math.abs(rowCounts[0] - rowCounts[1]) <= 2,
        `nested rows should be fairly even, got ${rowCounts.join('+')}`,
      );
    }
  });

  it('flowPack balances children across wrap rows', () => {
    // Nine equal faces that need two rows → prefer 5+4, not 7+2
    const ids = Array.from({ length: 9 }, (_, i) => `n${i}`);
    const nodes = ids.map((id) => `  ${id}[Node]{kind:aws.ec2}`).join('\n');
    const spec = parse(`
theme: paper
template: cloud
groups:
  zone[Zone]{family:aws virtual members:${ids.join(' ')}}
nodes:
${nodes}
`);
    spec.groups[0].collapsed = false;
    const laid = layout(spec, { w: 520, h: 480 });
    const tops = Object.values(laid.boxes).map((b) => Math.round(b.y));
    const counts = {};
    for (const y of tops) counts[y] = (counts[y] || 0) + 1;
    const rowCounts = Object.values(counts).sort((a, b) => b - a);
    assert.ok(rowCounts.length >= 2, `expected wrap, got ${JSON.stringify(counts)}`);
    assert.ok(
      Math.abs(rowCounts[0] - rowCounts[1]) <= 1,
      `row counts should be even, got ${rowCounts.join('+')}`,
    );
  });

  it('equal wrap rows share column tracks (top/bottom line up)', () => {
    // Eight varied labels → 2×4; column midpoints must match across rows
    const labels = [
      'Basemap Services',
      'Geocode Services',
      'Routing Services',
      'GP Services',
      'Feature Services',
      'Map Services',
      'Image Services',
      'Scene Services',
    ];
    const nodes = labels
      .map((label, i) => `  n${i}[${label}]{kind:esri.map}`)
      .join('\n');
    const spec = parse(`
theme: paper
template: cloud
groups:
  zone[Zone]{family:esri virtual members:${labels.map((_, i) => `n${i}`).join(' ')}}
nodes:
${nodes}
`);
    spec.groups[0].collapsed = false;
    // Wide board so eight faces wrap as 4+4 (not 3+3+2)
    const laid = layout(spec, { w: 1100, h: 520 });
    const boxes = labels.map((_, i) => ({ id: `n${i}`, ...laid.boxes[`n${i}`] }));
    const ys = [...new Set(boxes.map((b) => Math.round(b.y)))].sort((a, b) => a - b);
    assert.equal(ys.length, 2, `expected 2 rows, got ${ys.join(',')}`);
    const top = boxes.filter((b) => Math.round(b.y) === ys[0]).sort((a, b) => a.x - b.x);
    const bot = boxes.filter((b) => Math.round(b.y) === ys[1]).sort((a, b) => a.x - b.x);
    assert.equal(top.length, 4);
    assert.equal(bot.length, 4);
    for (let i = 0; i < 4; i++) {
      const midTop = top[i].x + top[i].w / 2;
      const midBot = bot[i].x + bot[i].w / 2;
      assert.ok(
        Math.abs(midTop - midBot) < 2,
        `col ${i} mid drift ${midTop - midBot}`,
      );
    }
  });

  it('constellation packs nodes with 3d space and orbit metadata', () => {
    const spec = parse(`
theme: indigo
template: constellation
engine: native
nodes:
  a[A]
  b[B]
  c[C]
  d[D]
edges:
  a --> b
  b --> c
  c --> a
  a --> d
  d --> b
`);
    const laid = layout(spec, board);
    assert.ok(laid.orbit?.space?.a, 'orbit space for a');
    assert.ok(Number.isFinite(laid.orbit.space.a.x));
    assert.ok(Number.isFinite(laid.orbit.space.a.z));
    assert.equal(laid.orbit.skipFit, true);
    for (const id of ['a', 'b', 'c', 'd']) {
      assert.ok(laid.boxes[id], id);
      assert.ok(laid.boxes[id].space, `${id} space`);
    }
    assert.ok(laid.routes.length >= 4);
    assert.ok(laid.routes[0].d.includes('L'), 'chord edges');
  });

  it('mindmap places root near center with shaped children', () => {
    const spec = parse(`
theme: indigo
template: mindmap
engine: native
nodes:
  hub[Hub]{shape:circle}
  a[A]{parent:hub shape:oval}
  b[B]{parent:hub shape:hex}
edges:
  hub --> a
  hub --> b
`);
    const laid = layout(spec, board);
    const hub = laid.boxes.hub;
    const cx = hub.x + hub.w / 2;
    const cy = hub.y + hub.h / 2;
    assert.ok(Math.abs(cx - board.w / 2) < 50, `hub cx ${cx}`);
    assert.ok(Math.abs(cy - (board.h / 2 + 8)) < 50, `hub cy ${cy}`);
    assert.equal(hub.shape, 'circle');
    assert.equal(laid.boxes.a.shape, 'oval');
    assert.ok(laid.boxes.a.expandable === false || laid.boxes.a.parentNode === 'hub');
    assert.equal(layoutReport(spec, laid).overlaps.length, 0);
  });

  it('table parent stacks each child as a row element', () => {
    const spec = parse(`
theme: paper
template: cloud
engine: native
groups:
  zone[Zone]{family:aws virtual members:matrix collapsed:false}
nodes:
  matrix[Risks]{shape:table collapsed:false}
  r1[Likelihood]{parent:matrix}
  r2[Impact]{parent:matrix}
  r3[Mitigation]{parent:matrix shape:diamond}
`);
    const laid = layout(spec, board);
    const p = laid.boxes.matrix;
    const r1 = laid.boxes.r1;
    const r2 = laid.boxes.r2;
    const r3 = laid.boxes.r3;
    assert.equal(p.shape, 'table');
    assert.equal(p.collapsed, false);
    assert.equal(p.expandable, true);
    assert.ok(!r1.folded && !r2.folded && !r3.folded);
    assert.equal(r1.parentNode, 'matrix');
    assert.equal(r3.shape, 'diamond');
    assert.ok(r2.y > r1.y + r1.h - 1, 'rows stack vertically');
    assert.ok(r3.y > r2.y + r2.h - 1);
    assert.ok(Math.abs(r1.w - r2.w) < 1, 'row widths match');
    assert.ok(p.h > p.hCollapsed, 'expanded table taller than header');
  });

  it('cloud fills horizontal space before stacking taller', () => {
    const members = Array.from({ length: 8 }, (_, i) => `n${i}`).join(' ');
    const nodes = Array.from(
      { length: 8 },
      (_, i) => `  n${i}[Node ${i}]{kind:aws.ec2}`,
    ).join('\n');
    const spec = parse(`
theme: paper
template: cloud
groups:
  zone[Zone]{family:aws virtual members:${members}}
nodes:
${nodes}
`);
    // Expand virtual so members flow-pack
    spec.groups.find((g) => g.id === 'zone').collapsed = false;
    const laid = layout(spec, board);
    const xs = Object.values(laid.boxes).map((b) => b.x + b.w);
    const right = Math.max(...xs);
    // Several faces should share the first row (not a single left column)
    const tops = Object.values(laid.boxes).map((b) => b.y);
    const minY = Math.min(...tops);
    const onFirstRow = Object.values(laid.boxes).filter((b) => Math.abs(b.y - minY) < 8);
    assert.ok(onFirstRow.length >= 3, `expected ≥3 on first row, got ${onFirstRow.length}`);
    // Row should reach well past the left third of the board
    assert.ok(right > board.w * 0.45, `rightmost ${right} should use horizontal space`);
  });
});
