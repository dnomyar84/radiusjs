import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from '../src/parse.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, 'fixtures', name), 'utf8');

describe('parse L0', () => {
  it('parses a process fence', () => {
    const spec = parse(fixture('process.radius.md'));
    assert.equal(spec.theme, 'paper');
    assert.equal(spec.template, 'process');
    assert.equal(spec.nodes.length, 3);
    assert.equal(spec.edges.length, 2);
    assert.equal(spec.nodes[0].id, 'a');
  });

  it('parses cloud migration with groups and story', () => {
    const spec = parse(fixture('migration.radius.md'));
    assert.equal(spec.theme, 'paper');
    assert.equal(spec.template, 'cloud');
    assert.equal(spec.groups.length, 2);
    assert.equal(spec.groups[0].collapsed, true);
    assert.equal(spec.groups[0].family, 'azure');
    assert.ok(spec.nodes.find((n) => n.id === 'hci').group === 'src');
    assert.ok(spec.story.some((s) => s.type === 'expand'));
    assert.ok(spec.story.some((s) => s.type === 'collapse'));
  });

  it('defaults neon to chip ground and perspective look', () => {
    const spec = parse(`
theme: neon
template: hub
nodes:
  a[Core]
  b[Edge]
edges:
  a --> b
`);
    assert.equal(spec.theme, 'neon');
    assert.equal(spec.ground, 'chip');
    assert.equal(spec.look, 'perspective');
  });

  it('accepts azure.hci aliases', () => {
    const spec = parse(`
template: flow
nodes:
  x[HCI]{kind:azure.stackhci}
`);
    // kind kept as authored; kinds.js normalizes at paint
    assert.equal(spec.nodes[0].kind, 'azure.stackhci');
  });

  it('returns structured errors for unknown theme', () => {
    assert.throws(
      () => parse('theme: nope\nnodes:\n  a[A]'),
      (e) => e.radius && e.path === 'theme' && /RADIUS\.md#themes/.test(e.see),
    );
  });

  it('rejects empty docs', () => {
    assert.throws(
      () => parse(''),
      (e) => e.radius && e.path === 'root',
    );
  });

  it('parses JSON IR', () => {
    const spec = parse(JSON.stringify({
      theme: 'nutanix',
      template: 'nkp',
      nodes: [{ id: 'm', label: 'Mgt', kind: 'nkp.management' }],
      edges: [],
    }));
    assert.equal(spec.template, 'nkp');
    assert.equal(spec.nodes[0].kind, 'nkp.management');
  });
});
