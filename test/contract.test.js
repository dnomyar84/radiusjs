/**
 * Contract suite — RADIUS.md guarantees that the older suites only sample.
 * Sequence and hierarchy are their own packers, not flow aliases.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse, ENUMS, normalizeWires, wireVisible, applyTimelineGrain } from '../src/parse.js';
import { layout, layoutAsync } from '../src/layout.js';
import { paint } from '../src/paint.js';
import { help } from '../src/radius.js';
import { THEME_IDS, resolveTheme } from '../src/themes.js';
import { groundHTML } from '../src/grounds.js';
import { kindMeta } from '../src/kinds.js';
import { applyUserSizes, clampSize } from '../src/resize.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const board = { w: 960, h: 540 };
const css = readFileSync(join(root, 'dist/radius.css'), 'utf8');

function fence(body) {
  return parse(body);
}

function host() {
  return { style: { setProperty() {} }, dataset: {}, className: '' };
}

describe('contract · parse', () => {
  it('rejects coordinates, size, and raw CSS on the document', () => {
    for (const key of ['x', 'y', 'font-size', 'style']) {
      assert.throws(
        () => parse(JSON.stringify({ [key]: 1, nodes: [{ id: 'a', label: 'A' }] })),
        (e) => e.radius && e.see === 'RADIUS.md#layout',
        key,
      );
    }
  });

  it('rejects unknown template, ground, look, motion, frame, engine, route, and shape', () => {
    const cases = [
      ['template: nope\nnodes:\n  a[A]', 'template'],
      ['ground: nope\nnodes:\n  a[A]', 'ground'],
      ['look: nope\nnodes:\n  a[A]', 'look'],
      ['motion: nope\nnodes:\n  a[A]', 'motion'],
      ['frame: nope\nnodes:\n  a[A]', 'frame'],
      ['engine: nope\nnodes:\n  a[A]', 'engine'],
      ['route: nope\nnodes:\n  a[A]', 'route'],
      ['nodes:\n  a[A]{shape:star}', 'shape'],
    ];
    for (const [src, path] of cases) {
      assert.throws(() => parse(src), (e) => e.radius && e.path === path, path);
    }
  });

  it('rejects an edge to an unknown endpoint and a diagram with no nodes', () => {
    assert.throws(
      () => parse('nodes:\n  a[A]\nedges:\n  a --> missing'),
      (e) => e.radius && e.path === 'edges',
    );
    assert.throws(
      () => parse('title: empty'),
      (e) => e.radius && e.path === 'nodes',
    );
  });

  it('maps dir, glass, engine, and shape aliases', () => {
    const spec = parse(`
dir: down
glass: opaque
engine: elkjs
nodes:
  a[Start]{shape:decision}
  b[End]{shape:terminator}
edges:
  a --> b
`);
    assert.equal(spec.dir, 'tb');
    assert.equal(spec.glass, 'solid');
    assert.equal(spec.engine, 'elk');
    assert.equal(spec.nodes[0].shape, 'diamond');
    assert.equal(spec.nodes[1].shape, 'oval');
  });

  it('parses story verbs and wire filters', () => {
    const spec = parse(`
wires: flow trust
nodes:
  a[A]
  b[B]
edges:
  a --> b: DNS{wire:trust}
story:
  expand all
  collapse-all
  wires off
  wires flow
  focus a
  replace a with b
`);
    assert.equal(spec.wires.mode, 'only');
    assert.deepEqual(spec.wires.names, ['flow', 'trust']);
    assert.equal(spec.edges[0].wire, 'trust');
    assert.deepEqual(
      spec.story.map((s) => s.type),
      ['expandAll', 'collapseAll', 'wires', 'wires', 'focus', 'replace'],
    );
    assert.equal(spec.story[2].wires.mode, 'off');
    assert.equal(spec.story[3].wires.mode, 'only');
    assert.equal(wireVisible('trust', spec.wires), true);
    assert.equal(wireVisible('main', spec.wires), false);
    assert.equal(wireVisible('trust', normalizeWires('off')), false);
    assert.equal(wireVisible('trust', normalizeWires('all')), true);
  });

  it('applies timeline grain by collapsing finer parents', () => {
    const nodes = [
      { id: 'y', layer: 'year', parent: null, collapsed: null },
      { id: 'q', layer: 'quarter', parent: 'y', collapsed: null },
      { id: 'd', layer: 'day', parent: 'q', collapsed: null },
    ];
    applyTimelineGrain(nodes, 'quarter');
    assert.equal(nodes.find((n) => n.id === 'y').collapsed, false);
    assert.equal(nodes.find((n) => n.id === 'q').collapsed, true);
  });

  it('caps stack multiplicity at 4', () => {
    const spec = parse('nodes:\n  a[Many]{stack:9}\n  b[Pair]{stack:true}');
    assert.equal(spec.nodes[0].stack, 4);
    assert.equal(spec.nodes[1].stack, 2);
  });
});

describe('contract · every theme, template, and ground', () => {
  it('parses every theme and resolves a palette', () => {
    for (const id of THEME_IDS) {
      const spec = fence(`theme: ${id}\nnodes:\n  a[A]`);
      assert.equal(spec.theme, id);
      const theme = resolveTheme(id);
      assert.ok(theme.surface);
      assert.ok(theme.ink);
      assert.ok(theme.accent);
    }
    assert.equal(THEME_IDS.length, ENUMS.THEMES.size);
  });

  it('lays out every template with both endpoints and a route', () => {
    for (const template of ENUMS.TEMPLATES) {
      const spec = fence(`template: ${template}\nengine: native\nnodes:\n  a[A]\n  b[B]\nedges:\n  a --> b`);
      const laid = layout(spec, board);
      assert.ok(laid.boxes.a && laid.boxes.b, template);
      if (!laid.boxes.b.folded) {
        assert.ok(laid.routes.length >= 1, `${template} route`);
      }
      assert.equal(laid.engine, 'native', template);
    }
  });

  it('paints every ground without throwing', () => {
    for (const ground of ENUMS.GROUNDS) {
      const html = groundHTML(ground);
      assert.equal(typeof html, 'string', ground);
    }
  });

  it('defaults sequence to a grid and hierarchy to dots', () => {
    assert.equal(fence('template: sequence\nnodes:\n  a[A]').ground, 'grid');
    assert.equal(fence('template: hierarchy\nnodes:\n  a[A]').ground, 'dots');
  });

  it('help() lists the same themes and templates as the parser', () => {
    const card = help();
    assert.equal(card.version, '0.5.0');
    assert.deepEqual([...card.themes].sort(), [...THEME_IDS].sort());
    assert.deepEqual([...card.templates].sort(), [...ENUMS.TEMPLATES].sort());
  });
});

describe('contract · sequence', () => {
  const src = `
template: sequence
engine: native
motion: none
nodes:
  client[Client]
  api[API]
  db[DB]
edges:
  client --> api: request
  api --> db: query
  db --> api: rows
  api --> api: retry
`;

  it('keeps lifeline heads on one band and stacks messages downward', () => {
    const laid = layout(fence(src), board);
    const ys = ['client', 'api', 'db'].map((id) => laid.boxes[id].y);
    assert.ok(Math.max(...ys) - Math.min(...ys) < 8, 'heads share a top band');
    const messages = laid.routes.filter((r) => r.routeMode === 'sequence' && r.from !== r.to);
    assert.equal(messages.length, 3);
    assert.ok(messages[0].labelY < messages[1].labelY);
    assert.ok(messages[1].labelY < messages[2].labelY);
    const loop = laid.routes.find((r) => r.routeMode === 'sequence' && r.from === 'api' && r.to === 'api');
    assert.match(loop.d, /L /);
    const lives = laid.routes.filter((r) => r.routeMode === 'sequence-life');
    assert.equal(lives.length, 3);
    assert.ok(lives.every((r) => /M [\d.]+ [\d.]+ L [\d.]+ [\d.]+/.test(r.d)));
  });

  it('turns heads down the side when dir is tb', () => {
    const laid = layout(fence(src.replace('template: sequence', 'template: sequence\ndir: tb')), board);
    const xs = ['client', 'api', 'db'].map((id) => laid.boxes[id].x);
    assert.ok(Math.max(...xs) - Math.min(...xs) < 8);
    const ys = ['client', 'api', 'db'].map((id) => laid.boxes[id].y);
    assert.ok(ys[0] < ys[1] && ys[1] < ys[2]);
    assert.ok(laid.routes.every((r) => r.routeMode === 'sequence' || r.routeMode === 'sequence-life'));
    assert.equal(laid.routes.filter((r) => r.routeMode === 'sequence-life').length, 3);
  });

  it('stays on the sequence packer under layoutAsync auto', async () => {
    const laid = await layoutAsync(fence(src), board);
    assert.equal(laid.engine, 'native');
    assert.ok(laid.routes.every((r) => r.routeMode === 'sequence' || r.routeMode === 'sequence-life'));
  });

  it('paints sequence messages and declares lifeline CSS', () => {
    const spec = fence(src);
    const laid = layout(spec, board);
    const el = host();
    paint(el, spec, laid);
    assert.equal(el.dataset.template, 'sequence');
    assert.equal(el.dataset.dir, 'lr');
    assert.match(el.innerHTML, /request/);
    assert.match(el.innerHTML, /is-lifeline/);
    assert.match(el.innerHTML, /stroke-dasharray="4 5"/);
    assert.match(css, /\.radius-edge\.is-lifeline/);
  });
});

describe('contract · hierarchy', () => {
  const src = `
template: hierarchy
engine: native
nodes:
  root[Org]{collapsed:false}
  eng[Eng]{parent:root}
  mkt[Mkt]{parent:root}
`;

  it('places children on the next row under the root', () => {
    const laid = layout(fence(src), board);
    const root = laid.boxes.root;
    const eng = laid.boxes.eng;
    const mkt = laid.boxes.mkt;
    assert.ok(eng.y > root.y + root.h * 0.5, 'child sits below the root');
    assert.ok(Math.abs(eng.y - mkt.y) < 8, 'siblings share a generation');
    assert.equal(eng.folded, undefined);
  });

  it('numbers each generation from the root', () => {
    const laid = layout(fence(src), board);
    assert.equal(laid.boxes.root.rank, 0);
    assert.equal(laid.boxes.eng.rank, 1);
    assert.equal(laid.boxes.mkt.rank, 1);
  });

  it('grows to the right when dir is lr', () => {
    const laid = layout(fence(src.replace('template: hierarchy', 'template: hierarchy\ndir: lr')), board);
    assert.ok(laid.boxes.eng.x > laid.boxes.root.x + laid.boxes.root.w * 0.5);
  });

  it('folds children when the parent starts collapsed', () => {
    const laid = layout(
      fence(src.replace('{collapsed:false}', '{collapsed:true}')),
      board,
    );
    assert.equal(laid.boxes.root.collapsed, true);
    assert.equal(laid.boxes.eng.folded, true);
    assert.equal(laid.boxes.mkt.folded, true);
  });

  it('infers the tree from edges when parent: is omitted', () => {
    const laid = layout(
      fence(`
template: hierarchy
engine: native
nodes:
  root[Org]{collapsed:false}
  eng[Eng]
  mkt[Mkt]
edges:
  root --> eng
  root --> mkt
`),
      board,
    );
    assert.ok(laid.boxes.eng.y > laid.boxes.root.y);
    assert.ok(laid.boxes.mkt.y > laid.boxes.root.y);
  });
});

describe('contract · resize', () => {
  it('refuses to shrink a node under its content floor', () => {
    const spec = fence('template: flow\nengine: native\nnodes:\n  a[Start]\n  b[Done]\nedges:\n  a --> b');
    const laid = layout(spec, board);
    const before = laid.boxes.a.w;
    applyUserSizes(spec, laid, { a: { w: 4, h: 4 } });
    assert.ok(laid.boxes.a.w >= before * 0.9);
    assert.equal(laid.boxes.a.userSized, true);
    assert.deepEqual(clampSize(10, 10, 40, 20), { w: 40, h: 20 });
  });
});
