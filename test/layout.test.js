import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from '../src/parse.js';
import { layout, layoutReport } from '../src/layout.js';

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

  it('appearOrder covers every node', () => {
    const spec = parse(fixture('process.radius.md'));
    const laid = layout(spec, board);
    assert.equal(laid.appearOrder.length, spec.nodes.length);
    assert.deepEqual([...laid.appearOrder].sort(), spec.nodes.map((n) => n.id).sort());
  });
});
