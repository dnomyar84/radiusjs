/**
 * Mermaid diagram text → Radius input (nodes, edges, groups).
 * Draw.io will target this same input later (src/drawio.js); it is not parsed yet.
 *
 * Covered: flowchart, sequence, class, state, er, mindmap, timeline, journey,
 * gitGraph, C4, requirement. Charts (pie, gantt, sankey, …) are refused.
 */

const CHART = /^(pie|gantt|xychart(?:-beta)?|sankey(?:-beta)?|quadrantChart|radar(?:-beta)?|block(?:-beta)?|packet(?:-beta)?|kanban|architecture(?:-beta)?|zenuml|treemap(?:-beta)?)\b/i;

const START = /^(flowchart|graph|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|mindmap|timeline|journey|gitGraph|C4(?:Context|Container|Component|Dynamic|Deployment)|requirementDiagram)\b/i;

export function looksLikeMermaid(text) {
  const line = firstLine(text);
  return START.test(line) || CHART.test(line);
}

export function isDrawio(text) {
  const t = String(text || '').trim();
  return /^\s*(?:<\?xml|<\s*mxfile|<\s*mxGraphModel)\b/i.test(t) || /<\s*mxfile[\s>]/i.test(t);
}

export function mermaidToInput(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  const lines = text
    .split('\n')
    .map((l) => l.replace(/%%.*$/, '').trimEnd())
    .filter((l) => l.trim() && !/^\s*%%/.test(l));
  const head = (lines[0] || '').trim();
  const body = lines.slice(1);
  if (CHART.test(head)) {
    const kind = head.split(/\s+/)[0];
    const err = new Error(
      `${kind} is a chart. Radius imports flowchart, sequence, class, state, er, mindmap, timeline, journey, git, C4, and requirement diagrams.`,
    );
    err.radius = true;
    err.path = 'import';
    err.fix = err.message;
    err.see = 'RADIUS.md#import';
    throw err;
  }
  if (/^sequenceDiagram\b/i.test(head)) return parseSequence(body);
  if (/^classDiagram\b/i.test(head)) return parseClass(body);
  if (/^stateDiagram\b/i.test(head)) return parseState(body);
  if (/^erDiagram\b/i.test(head)) return parseEr(body);
  if (/^mindmap\b/i.test(head)) return parseMindmap(body);
  if (/^timeline\b/i.test(head)) return parseTimeline(body);
  if (/^journey\b/i.test(head)) return parseJourney(body);
  if (/^gitGraph\b/i.test(head)) return parseGit(body);
  if (/^C4/i.test(head)) return parseC4(body);
  if (/^requirementDiagram\b/i.test(head)) return parseRequirement(body);
  if (/^(flowchart|graph)\b/i.test(head)) return parseFlow(head, body);
  const err = new Error(`Unsupported Mermaid diagram "${head.split(/\s+/)[0] || 'text'}".`);
  err.radius = true;
  err.path = 'import';
  err.fix = 'Use flowchart, sequenceDiagram, classDiagram, stateDiagram, erDiagram, mindmap, or timeline.';
  err.see = 'RADIUS.md#import';
  throw err;
}

function firstLine(text) {
  return String(text || '')
    .replace(/^\s*```\s*(?:mermaid|radius)?\s*/i, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('%%') && l !== '```') || '';
}

function safeId(raw, used) {
  let id = String(raw || '')
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^[^A-Za-z_]+/, '');
  if (!id) id = 'n';
  const base = id;
  let i = 2;
  while (used.has(id)) id = `${base}_${i++}`;
  used.add(id);
  return id;
}

function mapDir(token) {
  const s = String(token || '').toLowerCase();
  if (s === 'lr') return 'lr';
  if (s === 'rl') return 'rl';
  if (s === 'bt') return 'bt';
  return 'tb';
}

function blankInput(template, extra = {}) {
  return {
    template,
    title: null,
    dir: null,
    route: null,
    nodes: [],
    edges: [],
    groups: [],
    ...extra,
  };
}

/* ------------------------------ flowchart ------------------------------ */

const SHAPE_RES = [
  [/^\[\[([^\]]*)\]\]/, 'sub'],
  [/^\(\[([^\]]*)\]\)/, 'round'],
  [/^\[\(([^)]*)\)\]/, 'cylinder'],
  [/^\(\(([^)]*)\)\)/, 'circle'],
  [/^\[\\([^\]\\]*)\\\]/, 'parallelogram'],
  [/^\[\/([^\]/]*)\/\]/, 'parallelogram'],
  [/^\[\\([^\]/]*)\/\]/, 'trap'],
  [/^\[\/([^\]\\]*)\\\]/, 'trap'],
  [/^\{\{([^}]*)\}\}/, 'hex'],
  [/^\[([^\]]*)\]/, 'rect'],
  [/^\(([^)]*)\)/, 'round'],
  [/^\{([^}]*)\}/, 'diamond'],
  [/^>([^\]]*)\]/, 'flag'],
];

function readNode(s, i) {
  const slice = s.slice(i);
  const idm = slice.match(/^\s*([A-Za-z_][\w-]*)/);
  if (!idm) return null;
  const id = idm[1];
  let j = i + idm[0].length;
  const rest = s.slice(j);
  for (const [re, shape] of SHAPE_RES) {
    const sm = rest.match(re);
    if (sm) {
      return { id, label: (sm[1] || id).trim() || id, shape, end: j + sm[0].length };
    }
  }
  return { id, label: id, shape: null, end: j };
}

const LINK_RES = [
  [/^\s*<-->\s*(?:\|([^|]*)\|\s*)?/, { line: 'solid', head: 'arrow', tail: 'arrow' }],
  [/^\s*<-\.->\s*(?:\|([^|]*)\|\s*)?/, { line: 'dotted', head: 'arrow', tail: 'arrow' }],
  [/^\s*o--o\s*(?:\|([^|]*)\|\s*)?/, { line: 'solid', head: 'circle', tail: 'circle' }],
  [/^\s*x--x\s*(?:\|([^|]*)\|\s*)?/, { line: 'solid', head: 'cross', tail: 'cross' }],
  [/^\s*--o\s*(?:\|([^|]*)\|\s*)?/, { line: 'solid', head: 'circle', tail: 'none' }],
  [/^\s*--x\s*(?:\|([^|]*)\|\s*)?/, { line: 'solid', head: 'cross', tail: 'none' }],
  [/^\s*==\s+(.+?)\s+==>\s*/, { line: 'thick', head: 'arrow', tail: 'none', label: 1 }],
  [/^\s*--\s+(.+?)\s+-->\s*/, { line: 'solid', head: 'arrow', tail: 'none', label: 1 }],
  [/^\s*-\.\s+(.+?)\s+\.->\s*/, { line: 'dotted', head: 'arrow', tail: 'none', label: 1 }],
  [/^\s*-\.->\s*(?:\|([^|]*)\|\s*)?/, { line: 'dotted', head: 'arrow', tail: 'none' }],
  [/^\s*==+>\s*(?:\|([^|]*)\|\s*)?/, { line: 'thick', head: 'arrow', tail: 'none' }],
  [/^\s*===+\s*(?:\|([^|]*)\|\s*)?/, { line: 'thick', head: 'none', tail: 'none' }],
  [/^\s*-+>\s*(?:\|([^|]*)\|\s*)?/, { line: 'solid', head: 'arrow', tail: 'none' }],
  [/^\s*---+\s*(?:\|([^|]*)\|\s*)?/, { line: 'solid', head: 'none', tail: 'none' }],
];

function readLink(s, i) {
  const slice = s.slice(i);
  for (const [re, spec] of LINK_RES) {
    const m = slice.match(re);
    if (!m) continue;
    const label = (spec.label ? m[spec.label] : m[1]) || null;
    return {
      end: i + m[0].length,
      line: spec.line,
      head: spec.head,
      tail: spec.tail,
      label: label ? String(label).trim() : null,
    };
  }
  return null;
}

function readNodeList(s, i) {
  const first = readNode(s, i);
  if (!first) return null;
  const list = [first];
  let j = first.end;
  while (j < s.length) {
    const amp = s.slice(j).match(/^\s*&\s*/);
    if (!amp) break;
    const nxt = readNode(s, j + amp[0].length);
    if (!nxt) break;
    list.push(nxt);
    j = nxt.end;
  }
  return { list, end: j };
}

function subgraphHeader(rest, used) {
  const t = rest.trim();
  const bracket = t.match(/^([A-Za-z_][\w-]*)\s*\[([^\]]*)\]\s*$/);
  if (bracket) return { id: safeId(bracket[1], used), label: bracket[2].trim() || bracket[1] };
  if (/^[A-Za-z_][\w-]*$/.test(t)) return { id: safeId(t, used), label: t };
  const label = t.replace(/^["']|["']$/g, '');
  return { id: safeId(label, used), label };
}

function parseFlow(head, body) {
  const dirMatch = head.match(/\b(TB|TD|BT|RL|LR)\b/i);
  const doc = blankInput('flow', { dir: mapDir(dirMatch ? dirMatch[1] : 'TB') });
  const used = new Set();
  const root = { id: null, lines: [], groups: [], dir: doc.dir };
  const stack = [root];

  for (const raw of body) {
    const line = raw.trim();
    if (!line || line === '```') continue;
    const sub = line.match(/^subgraph\s+(.+)$/i);
    if (sub) {
      const g = {
        ...subgraphHeader(sub[1], used),
        parent: stack.length > 1 ? stack[stack.length - 1].id : null,
        lines: [],
        groups: [],
        dir: null,
        virtual: true,
        collapsed: false,
        expandable: true,
        members: [],
      };
      stack[stack.length - 1].groups.push(g);
      stack.push(g);
      continue;
    }
    if (/^end$/i.test(line)) {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const direction = line.match(/^direction\s+(TB|TD|BT|RL|LR)$/i);
    if (direction) {
      stack[stack.length - 1].dir = mapDir(direction[1]);
      continue;
    }
    if (/^(style|classDef|class|click|linkStyle|accTitle|accDescr)\b/i.test(line)) continue;
    const title = line.match(/^title\s*:\s*(.+)$/i) || line.match(/^title\s+(.+)$/i);
    if (title && stack.length === 1) {
      doc.title = title[1].trim();
      continue;
    }
    stack[stack.length - 1].lines.push(line);
  }

  const nodes = [];
  const byId = new Map();

  function upsert(info, groupId) {
    let node = byId.get(info.id);
    if (!node) {
      const id = used.has(info.id) ? safeId(info.id, used) : (used.add(info.id), info.id);
      node = {
        id,
        label: info.label || info.id,
        shape: info.shape,
        group: groupId,
        collapsed: false,
      };
      byId.set(info.id, node);
      nodes.push(node);
    } else {
      if (info.label && info.label !== info.id) node.label = info.label;
      if (info.shape) node.shape = info.shape;
      if (groupId) node.group = groupId;
    }
    return node;
  }

  function walk(block) {
    for (const line of block.lines) {
      for (const stmt of line.split(';')) {
        const chunk = stmt.trim();
        if (!chunk) continue;
        let i = 0;
        let left = readNodeList(chunk, i);
        if (!left) continue;
        i = left.end;
        const link = readLink(chunk, i);
        if (!link) {
          for (const info of left.list) upsert(info, block.id);
          continue;
        }
        const rights = [];
        while (link && i < chunk.length) {
          i = link.end;
          const right = readNodeList(chunk, i);
          if (!right) break;
          for (const a of left.list) {
            for (const b of right.list) {
              const from = upsert(a, block.id);
              const to = upsert(b, block.id);
              doc.edges.push({
                from: from.id,
                to: to.id,
                label: link.label,
                line: link.line,
                head: link.head,
                tail: link.tail,
              });
            }
          }
          i = right.end;
          left = right;
          const next = readLink(chunk, i);
          if (!next) {
            for (const info of right.list) upsert(info, block.id);
            break;
          }
          link.end = next.end;
          link.label = next.label;
          link.line = next.line;
          link.head = next.head;
          link.tail = next.tail;
          rights.push(right);
        }
      }
    }
    for (const g of block.groups) {
      doc.groups.push({
        id: g.id,
        label: g.label,
        parent: g.parent,
        dir: g.dir,
        virtual: true,
        collapsed: false,
        expandable: true,
        members: [],
      });
      walk(g);
    }
  }

  walk(root);
  for (const g of doc.groups) {
    g.members = nodes.filter((n) => n.group === g.id).map((n) => n.id);
  }
  // Nested subgraphs become the container. A plain flowchart stays a ranked flow.
  if (doc.groups.length) doc.template = 'cloud';
  doc.nodes = nodes;
  if (!doc.nodes.length) {
    const err = new Error('Mermaid flowchart has no nodes.');
    err.radius = true;
    err.path = 'import';
    err.fix = 'Add at least one node, for example A[Start] --> B[Done].';
    err.see = 'RADIUS.md#import';
    throw err;
  }
  return doc;
}

/* ------------------------------ sequence ------------------------------ */

function parseSequence(body) {
  const doc = blankInput('sequence');
  const used = new Set();
  const aliases = new Map();
  const actors = [];
  let auto = false;
  let nMsg = 0;
  const frag = [];
  const active = new Map();

  function ensureActor(name, shape) {
    const key = name.trim();
    if (aliases.has(key)) return aliases.get(key);
    const id = safeId(key, used);
    aliases.set(key, id);
    actors.push(key);
    doc.nodes.push({ id, label: key, shape: shape || null, collapsed: false });
    return id;
  }

  function knownNames() {
    return [...aliases.keys()].sort((a, b) => b.length - a.length);
  }

  function closeFrag(endLabel) {
    const top = frag.pop();
    if (!top) return;
    const span = nMsg - top.start;
    if (span > 0) doc.groups.push({
      id: top.id,
      label: top.label,
      parent: frag.length ? frag[frag.length - 1].id : null,
      rank: top.start,
      span,
      virtual: true,
      collapsed: false,
      expandable: false,
      members: [],
    });
    if (endLabel) {
      frag.push({
        id: safeId(endLabel, used),
        label: endLabel,
        start: nMsg,
      });
    }
  }

  for (const raw of body) {
    const line = raw.trim();
    if (!line || line === '```') continue;
    if (/^autonumber\b/i.test(line)) {
      auto = true;
      continue;
    }
    const part = line.match(/^(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i);
    if (part) {
      const name = (part[3] || part[2]).trim();
      const key = part[2].trim();
      const id = ensureActor(name, /^actor$/i.test(part[1]) ? 'oval' : null);
      aliases.set(key, id);
      if (part[3]) aliases.set(part[3].trim(), id);
      const node = doc.nodes.find((n) => n.id === id);
      if (node && part[3]) node.label = part[3].trim();
      continue;
    }
    const note = line.match(/^Note\s+(right of|left of|over)\s+(.+?)\s*:\s*(.*)$/i);
    if (note) {
      const side = /left/i.test(note[1]) ? 'left' : /over/i.test(note[1]) ? 'over' : 'right';
      const who = note[2].split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
      const lanes = who.map((w) => ensureActor(w));
      doc.nodes.push({
        id: safeId(`note_${nMsg}_${note[3].slice(0, 12)}`, used),
        label: note[3].trim() || 'Note',
        role: 'note',
        shape: 'note',
        lane: lanes.join(','),
        side,
        rank: nMsg - 1,
        collapsed: false,
      });
      continue;
    }
    const open = line.match(/^(loop|alt|opt|par|critical|break|rect)\s*(.*)$/i);
    if (open) {
      const label = `${open[1].toLowerCase()}${open[2] ? ` ${open[2].trim()}` : ''}`.trim();
      frag.push({ id: safeId(label, used), label, start: nMsg });
      continue;
    }
    if (/^(else|and)\b/i.test(line)) {
      const label = line.replace(/^(else|and)\b/i, (_, w) => w.toLowerCase()).trim();
      closeFrag(label);
      continue;
    }
    if (/^end$/i.test(line)) {
      closeFrag(null);
      continue;
    }
    const act = line.match(/^activate\s+(.+)$/i);
    if (act) {
      const id = ensureActor(act[1].trim());
      active.set(id, nMsg);
      continue;
    }
    const deact = line.match(/^deactivate\s+(.+)$/i);
    if (deact) {
      const id = ensureActor(deact[1].trim());
      const start = active.has(id) ? active.get(id) : nMsg - 1;
      active.delete(id);
      doc.nodes.push({
        id: safeId(`bar_${id}_${start}`, used),
        label: '',
        role: 'bar',
        lane: id,
        rank: Math.max(0, start),
        span: Math.max(1, nMsg - start),
      });
      continue;
    }

    const names = knownNames();
    let left = null;
    let rest = line;
    if (names.length) {
      for (const name of names) {
        if (line.startsWith(name) && /^\s*(->>|-->>|-->|->|<<->>|--x|-x|--\)|-\))/.test(line.slice(name.length))) {
          left = name;
          rest = line.slice(name.length);
          break;
        }
      }
    }
    if (!left) {
      const guess = line.match(/^(.+?)\s*(->>|-->>|-->|->|<<->>|--x|-x|--\)|-\))\s*/);
      if (!guess) continue;
      left = guess[1].trim();
      rest = line.slice(guess[1].length);
    }
    const arrow = rest.match(/^\s*(<<->>|-->>|-->|->>|->|--x|-x|--\)|-\))\s*/);
    if (!arrow) continue;
    const after = rest.slice(arrow[0].length);
    let right = null;
    let text = '';
    if (names.length) {
      for (const name of names) {
        if (after.startsWith(name) && /^\s*:/.test(after.slice(name.length))) {
          right = name;
          text = after.slice(name.length).replace(/^\s*:\s*/, '');
          break;
        }
      }
    }
    if (!right) {
      const rm = after.match(/^(.*?)\s*:\s*(.*)$/);
      if (!rm) continue;
      right = rm[1].trim();
      text = rm[2];
    }
    const fromId = ensureActor(left);
    const toId = ensureActor(right);
    const token = arrow[1];
    const style = arrowStyle(token);
    nMsg += 1;
    doc.edges.push({
      from: fromId,
      to: toId,
      label: auto ? `${nMsg} ${text.trim()}`.trim() : text.trim() || null,
      ...style,
    });
  }
  while (frag.length) closeFrag(null);
  for (const [id, start] of active) {
    doc.nodes.push({
      id: safeId(`bar_${id}_${start}`, used),
      label: '',
      role: 'bar',
      lane: id,
      rank: start,
      span: Math.max(1, nMsg - start),
    });
  }
  return doc;
}

function arrowStyle(token) {
  if (token === '<<->>') return { line: 'solid', head: 'arrow', tail: 'arrow' };
  if (token === '-->>') return { line: 'dotted', head: 'arrow', tail: 'none' };
  if (token === '-->') return { line: 'dotted', head: 'none', tail: 'none' };
  if (token === '->>') return { line: 'solid', head: 'arrow', tail: 'none' };
  if (token === '->') return { line: 'solid', head: 'none', tail: 'none' };
  if (token === '--x') return { line: 'dotted', head: 'cross', tail: 'none' };
  if (token === '-x') return { line: 'solid', head: 'cross', tail: 'none' };
  if (token === '--)') return { line: 'dotted', head: 'open', tail: 'none' };
  if (token === '-)') return { line: 'solid', head: 'open', tail: 'none' };
  return { line: 'solid', head: 'arrow', tail: 'none' };
}

/* -------------------------------- class -------------------------------- */

function parseClass(body) {
  const doc = blankInput('class', { dir: 'tb' });
  const used = new Set();
  const ids = new Map();

  function ensure(name, label) {
    if (ids.has(name)) {
      const id = ids.get(name);
      if (label) {
        const node = doc.nodes.find((n) => n.id === id);
        if (node) node.label = label;
      }
      return id;
    }
    const id = safeId(name, used);
    ids.set(name, id);
    doc.nodes.push({
      id,
      label: label || name,
      shape: 'table',
      collapsed: false,
    });
    return id;
  }

  const flat = [];
  let buf = null;
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    if (buf) {
      buf.push(line);
      if (line.includes('}')) {
        flat.push(buf.join('\n'));
        buf = null;
      }
      continue;
    }
    if (/^class\s+/i.test(line) && line.includes('{') && !line.includes('}')) {
      buf = [line];
      continue;
    }
    flat.push(line);
  }

  for (const line of flat) {
    const block = line.match(/^class\s+([A-Za-z_][\w-]*)(?:\s*~\s*([^~{]+)\s*~)?\s*\{([^}]*)\}/i);
    if (block) {
      const id = ensure(block[1], block[2]?.trim());
      for (const mem of block[3].split(/[;\n]/)) {
        const t = mem.trim();
        if (!t) continue;
        doc.nodes.push({
          id: safeId(`${block[1]}_${t}`, used),
          label: t,
          parent: id,
        });
      }
      continue;
    }
    const decl = line.match(/^class\s+([A-Za-z_][\w-]*)(?:\s*~\s*([^~]+)\s*~)?\s*$/i);
    if (decl) {
      ensure(decl[1], decl[2]?.trim());
      continue;
    }
    const rel = classRel(line);
    if (rel) {
      doc.edges.push({
        from: ensure(rel.from),
        to: ensure(rel.to),
        label: rel.label,
        line: rel.line,
        head: rel.head,
        tail: rel.tail,
      });
      continue;
    }
    const attr = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.+)$/);
    if (attr) {
      const id = ensure(attr[1]);
      doc.nodes.push({
        id: safeId(`${attr[1]}_${attr[2]}`, used),
        label: attr[2].trim(),
        parent: id,
      });
    }
  }
  return doc;
}

function classRel(line) {
  const cleaned = line.replace(/"[^"]*"/g, ' ').replace(/\s+/g, ' ').trim();
  const m = cleaned.match(/^([A-Za-z_][\w-]*)\s*(<\|--|<\|..|\*--|o--|-->|<--|<?\.\.>|\.\.>|--|\.\.)\s*([A-Za-z_][\w-]*)\s*(?::\s*(.*))?$/);
  if (!m) return null;
  const left = m[1];
  const op = m[2];
  const right = m[3];
  const label = m[4] ? m[4].trim() : null;
  if (op === '<|--' || op === '<|..') {
    return { from: right, to: left, label, line: op.includes('..') ? 'dotted' : 'solid', head: 'triangle', tail: 'none' };
  }
  if (op === '*--' || op === 'o--') {
    return { from: right, to: left, label, line: 'solid', head: op === '*--' ? 'diamond' : 'odiamond', tail: 'none' };
  }
  if (op === '<--') return { from: right, to: left, label, line: 'solid', head: 'arrow', tail: 'none' };
  if (op === '-->') return { from: left, to: right, label, line: 'solid', head: 'arrow', tail: 'none' };
    if (op.includes('..>')) return { from: left, to: right, label, line: 'dotted', head: 'arrow', tail: 'none' };
  if (op === '..') return { from: left, to: right, label, line: 'dotted', head: 'none', tail: 'none' };
  return { from: left, to: right, label, line: 'solid', head: 'none', tail: 'none' };
}

/* -------------------------------- state -------------------------------- */

function parseState(body) {
  const doc = blankInput('state', { dir: 'tb' });
  const used = new Set();
  const stack = [{ id: null }];
  const nodes = new Map();

  function ensure(name, label, shape) {
    const key = `${stack[stack.length - 1].id || 'root'}::${name}`;
    if (nodes.has(name) && name !== '[*]') return nodes.get(name);
    if (name === '[*]') {
      const side = shape === 'dbl' ? 'stop' : 'start';
      const scope = stack[stack.length - 1].id || 'root';
      const idKey = `${scope}_${side}`;
      if (nodes.has(idKey)) return nodes.get(idKey);
      const id = safeId(idKey, used);
      const node = {
        id,
        label: shape === 'dbl' ? '◎' : '●',
        shape: shape || 'circle',
        group: stack.length > 1 ? stack[stack.length - 1].id : null,
        collapsed: false,
      };
      doc.nodes.push(node);
      nodes.set(idKey, id);
      return id;
    }
    if (nodes.has(name)) return nodes.get(name);
    const id = safeId(name, used);
    doc.nodes.push({
      id,
      label: label || name,
      shape: shape || 'round',
      group: stack.length > 1 ? stack[stack.length - 1].id : null,
      collapsed: false,
    });
    nodes.set(name, id);
    return id;
  }

  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    const named = line.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z_][\w-]*)\s*(\{)?\s*$/i);
    if (named) {
      ensure(named[2], named[1], 'round');
      if (named[3]) {
        const id = nodes.get(named[2]);
        doc.groups.push({
          id,
          label: named[1],
          parent: stack.length > 1 ? stack[stack.length - 1].id : null,
          virtual: true,
          collapsed: false,
          expandable: true,
          members: [],
        });
        stack.push({ id });
      }
      continue;
    }
    const open = line.match(/^state\s+([A-Za-z_][\w-]*)\s*\{\s*$/i);
    if (open) {
      let id = nodes.get(open[1]);
      if (!id) id = safeId(open[1], used);
      nodes.set(open[1], id);
      doc.nodes = doc.nodes.filter((n) => n.id !== id);
      doc.groups.push({
        id,
        label: open[1],
        parent: stack.length > 1 ? stack[stack.length - 1].id : null,
        virtual: true,
        collapsed: false,
        expandable: true,
        members: [],
      });
      stack.push({ id });
      continue;
    }
    if (/^[{}]$/.test(line) || /^end$/i.test(line) || line === '}') {
      if (stack.length > 1) stack.pop();
      continue;
    }
    const trans = line.match(/^(.+?)\s*-->\s*(.+?)(?:\s*:\s*(.*))?$/);
    if (trans) {
      const left = trans[1].trim();
      const right = trans[2].trim();
      const from = ensure(left, left === '[*]' ? '●' : left, left === '[*]' ? 'circle' : 'round');
      const to = ensure(right, right === '[*]' ? '◎' : right, right === '[*]' ? 'dbl' : 'round');
      doc.edges.push({
        from,
        to,
        label: trans[3] ? trans[3].trim() : null,
        line: 'solid',
        head: 'arrow',
        tail: 'none',
      });
    }
  }
  for (const g of doc.groups) {
    g.members = doc.nodes.filter((n) => n.group === g.id).map((n) => n.id);
  }
  return doc;
}

/* ---------------------------------- er --------------------------------- */

function parseEr(body) {
  const doc = blankInput('er', { dir: 'lr' });
  const used = new Set();
  const ids = new Map();
  function ensure(name) {
    if (ids.has(name)) return ids.get(name);
    const id = safeId(name, used);
    ids.set(name, id);
    doc.nodes.push({ id, label: name, shape: 'table', collapsed: false });
    return id;
  }
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s*:\s*(.*)$/);
    if (!m) continue;
    const from = ensure(m[1]);
    const to = ensure(m[3]);
    doc.edges.push({
      from,
      to,
      label: `${m[4].trim()} · ${m[2]}`.trim(),
      line: 'solid',
      head: 'none',
      tail: 'none',
    });
  }
  return doc;
}

/* -------------------------------- mindmap ------------------------------ */

function parseMindmap(body) {
  const doc = blankInput('mindmap', { route: 'curve' });
  const used = new Set();
  const stack = [];
  for (const raw of body) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^\s*/)[0].replace(/\t/g, '  ').length;
    const info = readNode(raw.trim(), 0) || { id: safeId(raw.trim(), used), label: raw.trim(), shape: null };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];
    const id = safeId(info.id || info.label, used);
    doc.nodes.push({
      id,
      label: info.label || id,
      shape: info.shape,
      parent: parent ? parent.id : null,
      collapsed: false,
    });
    if (parent) doc.edges.push({ from: parent.id, to: id });
    stack.push({ indent, id });
  }
  const kids = new Map();
  for (const n of doc.nodes) {
    if (!n.parent) continue;
    kids.set(n.parent, (kids.get(n.parent) || 0) + 1);
  }
  if (doc.nodes.length > 20) {
    for (const n of doc.nodes) {
      const depth = depthOf(n, doc.nodes);
      if (depth >= 2 && kids.get(n.id)) n.collapsed = true;
    }
  }
  return doc;
}

function depthOf(node, nodes) {
  let d = 0;
  let parent = node.parent;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  while (parent && byId[parent] && d < 12) {
    d += 1;
    parent = byId[parent].parent;
  }
  return d;
}

/* -------------------------- timeline / journey ------------------------- */

function parseTimeline(body) {
  const doc = blankInput('timeline', { dir: 'lr' });
  const used = new Set();
  let section = '';
  let rank = 0;
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    const title = line.match(/^title\s+(.+)$/i);
    if (title) {
      doc.title = title[1].trim();
      continue;
    }
    const sec = line.match(/^section\s+(.+)$/i);
    if (sec) {
      section = sec[1].trim();
      continue;
    }
    const parts = line.split(':').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    const time = [section, parts[0]].filter(Boolean).join(' ');
    const events = parts.length > 1 ? parts.slice(1) : [parts[0]];
    for (const ev of events) {
      doc.nodes.push({
        id: safeId(ev, used),
        label: ev,
        time,
        rank: rank++,
      });
    }
  }
  for (let i = 1; i < doc.nodes.length; i++) {
    doc.edges.push({ from: doc.nodes[i - 1].id, to: doc.nodes[i].id, head: 'arrow', tail: 'none', line: 'solid' });
  }
  return doc;
}

function parseJourney(body) {
  const doc = blankInput('timeline', { dir: 'lr' });
  const used = new Set();
  let section = '';
  let rank = 0;
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    const title = line.match(/^title\s+(.+)$/i);
    if (title) {
      doc.title = title[1].trim();
      continue;
    }
    const sec = line.match(/^section\s+(.+)$/i);
    if (sec) {
      section = sec[1].trim();
      continue;
    }
    const m = line.match(/^(.+?)\s*:\s*([0-9.]+)\s*:\s*(.*)$/);
    if (!m) continue;
    doc.nodes.push({
      id: safeId(m[1], used),
      label: `${m[1].trim()} · ${m[2]}`,
      time: section || m[3].trim(),
      rank: rank++,
    });
  }
  for (let i = 1; i < doc.nodes.length; i++) {
    doc.edges.push({ from: doc.nodes[i - 1].id, to: doc.nodes[i].id });
  }
  return doc;
}

/* --------------------------------- git --------------------------------- */

function parseGit(body) {
  const doc = blankInput('flow', { dir: 'lr', title: 'git' });
  const used = new Set();
  let branch = 'main';
  const heads = { main: null };
  let n = 0;
  function add(label, parents) {
    const id = safeId(`c${++n}`, used);
    doc.nodes.push({ id, label, collapsed: false });
    for (const p of parents) {
      if (p) doc.edges.push({ from: p, to: id });
    }
    heads[branch] = id;
    return id;
  }
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    if (/^commit\b/i.test(line)) {
      const label = line.replace(/^commit(?:\s+id:\s*\S+)?\s*/i, '').trim() || `commit ${n + 1}`;
      add(label, [heads[branch]]);
    } else if (/^branch\s+/i.test(line)) {
      const name = line.split(/\s+/)[1];
      heads[name] = heads[branch] || null;
    } else if (/^checkout\s+/i.test(line)) {
      branch = line.split(/\s+/)[1] || branch;
      if (!(branch in heads)) heads[branch] = null;
    } else if (/^merge\s+/i.test(line)) {
      const other = line.split(/\s+/)[1];
      const id = safeId(`c${++n}`, used);
      doc.nodes.push({ id, label: `merge ${other}`, collapsed: false });
      if (heads[branch]) doc.edges.push({ from: heads[branch], to: id });
      if (heads[other]) doc.edges.push({ from: heads[other], to: id, line: 'dotted' });
      heads[branch] = id;
    }
  }
  return doc;
}

/* ---------------------------------- C4 --------------------------------- */

function parseC4(body) {
  const doc = blankInput('cloud');
  const used = new Set();
  const stack = [];
  const decl = /^(Person|Person_Ext|System|System_Ext|SystemDb|SystemQueue|Container|ContainerDb|ContainerQueue|Component|ComponentDb|Boundary|Enterprise_Boundary|System_Boundary|Container_Boundary)\s*\(\s*([^,)]+)\s*,\s*"([^"]*)"(?:\s*,\s*"([^"]*)")?\s*\)\s*(\{)?/i;
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    const title = line.match(/^title\s+(.+)$/i);
    if (title) {
      doc.title = title[1].trim();
      continue;
    }
    if (line === '}' || line === '{') {
      if (line === '}' && stack.length) stack.pop();
      continue;
    }
    const rel = line.match(/^Rel(?:_\w+)?\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*"([^"]*)"/i);
    if (rel) {
      doc.edges.push({
        from: idOf(rel[1].trim(), used),
        to: idOf(rel[2].trim(), used),
        label: rel[3],
      });
      continue;
    }
    const m = line.match(decl);
    if (!m) continue;
    const kind = m[1];
    const rawId = m[2].trim();
    const label = m[3];
    const id = safeId(rawId, used);
    const boundary = /boundary/i.test(kind);
    if (boundary) {
      doc.groups.push({
        id,
        label,
        parent: stack.length ? stack[stack.length - 1] : null,
        virtual: true,
        collapsed: false,
        expandable: true,
        members: [],
      });
      if (m[5] || line.includes('{')) stack.push(id);
      continue;
    }
    const shape = /person/i.test(kind) ? 'oval' : /db/i.test(kind) ? 'cylinder' : 'rect';
    doc.nodes.push({
      id,
      label,
      shape,
      group: stack.length ? stack[stack.length - 1] : null,
      collapsed: false,
    });
  }
  for (const g of doc.groups) {
    g.members = doc.nodes.filter((n) => n.group === g.id).map((n) => n.id);
  }
  if (!doc.groups.length) doc.template = 'flow';
  return doc;
}

function idOf(raw, used) {
  const want = String(raw).replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^[^A-Za-z_]+/, '') || 'n';
  if (used.has(want)) return want;
  return safeId(raw, used);
}

/* ----------------------------- requirement ----------------------------- */

function parseRequirement(body) {
  const doc = blankInput('flow', { dir: 'lr' });
  const used = new Set();
  let buf = null;
  const blocks = [];
  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    if (buf) {
      buf.push(line);
      if (line.includes('}')) {
        blocks.push(buf.join('\n'));
        buf = null;
      }
      continue;
    }
    if (/^(requirement|element|functionalRequirement|performanceRequirement)\b/i.test(line) && line.includes('{') && !line.includes('}')) {
      buf = [line];
      continue;
    }
    blocks.push(line);
  }
  for (const block of blocks) {
    const head = block.match(/^(requirement|element|functionalRequirement|performanceRequirement)\s+([A-Za-z_][\w-]*)/i);
    if (head) {
      const text = (block.match(/text\s*:\s*(.+)/i) || [])[1];
      doc.nodes.push({
        id: safeId(head[2], used),
        label: text ? text.trim() : head[2],
        shape: /element/i.test(head[1]) ? 'oval' : 'rect',
        collapsed: false,
      });
      continue;
    }
    const rel = block.match(/^([A-Za-z_][\w-]*)\s+-\s*([A-Za-z]+)\s*->\s*([A-Za-z_][\w-]*)/);
    if (rel) {
      doc.edges.push({
        from: idOf(rel[1], used),
        to: idOf(rel[3], used),
        label: rel[2],
      });
    }
  }
  return doc;
}
