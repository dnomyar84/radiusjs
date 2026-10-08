import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parse.js';
import { layout } from '../src/layout.js';

function overlaps(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.w - 0.5 && a.x + a.w > b.x + 0.5 && a.y < b.y + b.h - 0.5 && a.y + a.h > b.y + 0.5;
}

function actorBoxes(spec, laid) {
  return spec.nodes
    .filter((n) => n.role !== 'note' && n.role !== 'bar')
    .map((n) => laid.boxes[n.id]);
}

describe('mermaid import', () => {
  it('reads a flowchart with shapes, labels, and a subgraph', () => {
    const spec = parse(`flowchart LR
      start([Start]) --> gate{Ready?}
      gate -->|Yes| work[Build]
      gate -->|No| stop([Stop])
      work --> db[(Save)]
      subgraph ship [Release]
        work
        db
      end
    `);
    assert.equal(spec.template, 'cloud');
    assert.equal(spec.dir, 'lr');
    assert.equal(spec.nodes.find((n) => n.id === 'gate').shape, 'diamond');
    assert.equal(spec.nodes.find((n) => n.id === 'db').shape, 'cylinder');
    assert.equal(spec.edges.find((e) => e.from === 'gate' && e.to === 'work').label, 'Yes');
    assert.equal(spec.groups[0].collapsed, false);
    assert.ok(spec.groups[0].members.includes('work'));
  });

  it('reads sequence messages, a note, and a loop', () => {
    const spec = parse(`sequenceDiagram
      actor Alice
      participant Bob
      Alice->>Bob: Hello
      Bob-->>Alice: Hi
      Note right of Alice: Quiet
      loop Every minute
        Bob->>Bob: Check
      end
    `);
    assert.equal(spec.template, 'sequence');
    assert.equal(spec.edges[0].head, 'arrow');
    assert.equal(spec.edges[1].line, 'dotted');
    assert.ok(spec.nodes.some((n) => n.role === 'note'));
    assert.equal(spec.groups[0].label.startsWith('loop'), true);
    assert.ok(spec.groups[0].span >= 1);
  });

  it('reads class, state, er, mindmap, and timeline', () => {
    const klass = parse(`classDiagram
      class Animal { +name }
      class Dog
      Animal <|-- Dog
    `);
    assert.equal(klass.template, 'class');
    assert.equal(klass.edges[0].head, 'triangle');
    assert.ok(klass.nodes.some((n) => n.parent));

    const state = parse(`stateDiagram-v2
      [*] --> Still
      Still --> Moving : go
      Moving --> [*]
    `);
    assert.equal(state.template, 'state');
    assert.equal(state.edges.length, 3);

    const er = parse(`erDiagram
      CUSTOMER ||--o{ ORDER : places
    `);
    assert.equal(er.template, 'er');
    assert.match(er.edges[0].label, /places/);

    const map = parse(`mindmap
      root((Idea))
        A
          B
        C
    `);
    assert.equal(map.template, 'mindmap');
    assert.equal(map.nodes.length, 4);
    assert.ok(map.edges.length >= 3);

    const time = parse(`timeline
      title History
      section 2024
        Q1 : Start
        Q2 : Grow
    `);
    assert.equal(time.template, 'timeline');
    assert.equal(time.title, 'History');
    assert.equal(time.nodes.length, 2);
  });

  it('refuses charts and names draw.io for later', () => {
    assert.throws(
      () => parse('pie title Pets\n  "Dogs" : 40'),
      (e) => e.radius && e.path === 'import' && /chart/.test(e.fix),
    );
    assert.throws(
      () => parse('<mxfile><diagram></diagram></mxfile>'),
      (e) => e.radius && /draw\.io/i.test(e.fix),
    );
  });

  it('keeps a radius edge style', () => {
    const spec = parse(`template: flow
nodes:
  a[A]
  b[B]{shape:cylinder}
edges:
  a --> b: go{line:dotted head:open tail:none}
`);
    assert.equal(spec.nodes[1].shape, 'cylinder');
    assert.equal(spec.edges[0].line, 'dotted');
    assert.equal(spec.edges[0].head, 'open');
  });
});

describe('sequence layout', () => {
  const source = `template: sequence
title: Checkout
nodes:
  alice[Alice]{shape:oval}
  api[API]
  db[Orders]{shape:cylinder}
  note1[In stock?]{role:note shape:note lane:api side:right rank:0}
edges:
  alice --> api: Place order
  api --> db: Insert
  db --> api: ok{line:dotted}
  api --> alice: Confirmed
groups:
  stock[alt in stock]{rank:1 span:2 virtual:true expandable:false}
`;

  for (const board of [
    { name: 'laptop', w: 1280, h: 720 },
    { name: 'phone', w: 390, h: 700 },
  ]) {
    it(`places actors, notes, and messages without overlap on ${board.name}`, () => {
      const spec = parse(source);
      const laid = layout(spec, board);
      const actors = actorBoxes(spec, laid);
      assert.equal(actors.length, 3);
      for (let i = 0; i < actors.length; i++) {
        for (let j = i + 1; j < actors.length; j++) {
          assert.equal(overlaps(actors[i], actors[j]), false);
        }
      }
      const note = laid.boxes.note1;
      for (const actor of actors) assert.equal(overlaps(note, actor), false);
      const heads = Math.max(...actors.map((b) => b.y + b.h));
      for (const route of laid.routes.filter((r) => r.routeMode === 'sequence')) {
        const y = route.labelY;
        assert.ok(y > heads, 'message stays below the actors');
      }
      assert.ok(laid.frames?.length === 1);
      const frame = laid.frames[0];
      assert.ok(frame.y > heads - 4, 'fragment does not cover actor faces');
      for (const actor of actors) {
        assert.ok(actor.x >= 0 && actor.x + actor.w <= (laid.groupBoxes._extent.x + laid.groupBoxes._extent.w) + 2);
      }
    });
  }
});
