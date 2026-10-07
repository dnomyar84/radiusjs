/**
 * Parse ```radius fences / text into IR.
 * Errors: { path, fix, see } for agent retry loops.
 */

const TEMPLATES = new Set([
  'deck', 'process', 'hub', 'sequence', 'hierarchy', 'flow', 'bars',
  'gis', 'cloud', 'k8s', 'nkp', 'timeline', 'mindmap', 'constellation',
]);

/** UML / flowchart-inspired faces — meaning documented in RADIUS.md */
const SHAPES = new Set([
  'rect', 'round', 'oval', 'circle', 'diamond', 'parallelogram', 'hex', 'table',
]);

const ROUTES = new Set(['curve', 'ortho', 'straight']);

const THEMES = new Set([
  'paper', 'night', 'indigo', 'ios', 'material', 'esri', 'aws', 'azure', 'gcp', 'oci', 'k8s', 'nutanix', 'neon',
]);

const LOOKS = new Set(['flat', 'elevated', 'perspective']);
const MOTIONS = new Set(['tasteful', 'none', 'bold']);
const FRAMES = new Set(['slide', 'system']);
const DIRS = new Set(['lr', 'rl', 'tb', 'bt']);
const GROUNDS = new Set([
  'none', 'solid', 'wash', 'vignette', 'grid', 'dots', 'matrix', 'circuit', 'chip',
  'mesh', 'hex', 'aurora', 'roads', 'helix', 'hatch', 'diagonal', 'contour', 'parcels',
  'globe', 'globe-horizon', 'globe-corner', 'worldmap', 'atlas',
]);

const GLASS = new Set(['frost', 'solid', 'none']);

const ARCH_LAYERS = new Set(['conceptual', 'logical', 'physical']);
const TIME_LAYERS = new Set(['year', 'half', 'quarter', 'month', 'week', 'day']);
const TIME_GRAIN_ORDER = ['year', 'half', 'quarter', 'month', 'week', 'day'];

function timeGrainDepth(layer) {
  if (!layer) return null;
  const i = TIME_GRAIN_ORDER.indexOf(String(layer).toLowerCase());
  return i < 0 ? null : i;
}

/**
 * Expand coarser parents and collapse at/finer than `grain` so the rail
 * shows year / half / quarter / month ticks as requested.
 */
export function applyTimelineGrain(nodes, grain) {
  const g = timeGrainDepth(normalizeLayer(grain) || grain);
  if (g == null || !nodes?.length) return nodes;
  for (const n of nodes) {
    const kids = nodes.filter((c) => c.parent === n.id);
    if (!kids.length) continue;
    const d = timeGrainDepth(n.layer);
    if (d == null) {
      const hit = kids.some(function hitGrain(c) {
        const cd = timeGrainDepth(c.layer);
        if (cd === g) return true;
        return nodes.filter((x) => x.parent === c.id).some(hitGrain);
      });
      n.collapsed = !hit;
      continue;
    }
    if (d < g) n.collapsed = false;
    else n.collapsed = true;
  }
  return nodes;
}

const FORBIDDEN_LAYOUT_KEYS = new Set([
  'x', 'y', 'left', 'top', 'width', 'height', 'w', 'h',
  'fontsize', 'font-size', 'style', 'css', 'px', 'transform',
]);

function err(path, fix, see) {
  const e = new Error(fix);
  e.path = path;
  e.fix = fix;
  e.see = see;
  e.radius = true;
  return e;
}

function stripFence(raw) {
  let t = String(raw ?? '').trim();
  const open = /^```\s*radius\s*\r?\n?/i;
  if (open.test(t)) {
    t = t.replace(open, '');
    t = t.replace(/\r?\n?```\s*$/i, '');
  }
  return t.trim();
}

/** Bare flags written without `:true` (e.g. `{parent:mha virtual collapsed:true}`). */
const BARE_BOOL_FLAGS = new Set([
  'virtual',
  'collapsed',
  'expandable',
  'fold',
  'stack',
]);

function parseAttrs(s) {
  const out = {};
  if (!s) return out;
  // Turn bare flags into flag:true so they are not swallowed into the previous value
  // (`parent:mha virtual` must not become parent="mha virtual").
  const normalized = String(s).replace(
    /(^|\s)(virtual|collapsed|expandable|fold|stack)(?!\s*[:=])(?=\s|$)/gi,
    (_, sp, flag) => `${sp}${flag}:true`,
  );
  const keys = [];
  const re = /(\w[\w-]*)\s*[:=]\s*/g;
  let m;
  while ((m = re.exec(normalized))) {
    keys.push({ key: m[1], valueStart: m.index + m[0].length, keyStart: m.index });
  }
  for (let i = 0; i < keys.length; i++) {
    const end = i + 1 < keys.length ? keys[i + 1].keyStart : normalized.length;
    let val = normalized.slice(keys[i].valueStart, end).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // Peel any leftover bare flags from multi-token values
    const parts = val.split(/\s+/).filter(Boolean);
    while (parts.length > 1 && BARE_BOOL_FLAGS.has(parts[parts.length - 1].toLowerCase())) {
      out[parts.pop().toLowerCase()] = 'true';
    }
    out[keys[i].key] = parts.join(' ');
  }
  return out;
}

function rejectForbiddenAttrs(attrs, path) {
  for (const key of Object.keys(attrs || {})) {
    const k = key.toLowerCase().replace(/_/g, '');
    if (FORBIDDEN_LAYOUT_KEYS.has(k) || FORBIDDEN_LAYOUT_KEYS.has(key.toLowerCase())) {
      throw err(
        path,
        'Omit coordinates and typography (x/y/font-size). Use template or rank/lane/order/dir hints — Radius packs labels.',
        'RADIUS.md#layout',
      );
    }
  }
}

/**
 * Node lines:
 *   id[Label]{kind:azure.hci family:azure}
 *   id[Label] kind:azure.hci
 *   - id: Label (kind: …)
 */
function parseNodeLine(line, path) {
  const trimmed = line.replace(/^\s*-\s*/, '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  let id, label, rest = '';

  const bracket = /^([A-Za-z_][\w-]*)\s*\[([^\]]*)\]\s*(.*)$/;
  const bm = trimmed.match(bracket);
  if (bm) {
    id = bm[1];
    label = bm[2];
    rest = bm[3];
  } else {
    const colon = /^([A-Za-z_][\w-]*)\s*:\s*(.+)$/;
    const cm = trimmed.match(colon);
    if (cm) {
      id = cm[1];
      const parts = cm[2].split(/\s+(?=\w[\w-]*\s*[:=])/);
      label = parts[0].replace(/^["']|["']$/g, '');
      rest = parts.slice(1).join(' ');
    } else {
      throw err(path, `Node line must be id[Label]{…} or id: Label. Got: ${trimmed}`, 'RADIUS.md#nodes');
    }
  }

  const brace = rest.match(/\{([^}]*)\}/);
  const attrs = { ...parseAttrs(brace ? brace[1] : rest.replace(/^\s*\{|\}\s*$/g, '')) };
  if (!brace && rest.includes('kind:')) Object.assign(attrs, parseAttrs(rest));
  rejectForbiddenAttrs(attrs, path);

  return {
    id,
    label: label || id,
    kind: attrs.kind || null,
    role: attrs.role || null,
    group: attrs.group || null,
    parent: attrs.parent || null,
    layer: normalizeLayer(attrs.layer),
    appear: attrs.appear != null ? Number(attrs.appear) : null,
    collapsed: attrs.collapsed != null ? parseBool(attrs.collapsed, false) : null,
    expandable: attrs.expandable != null ? parseBool(attrs.expandable, true) : null,
    rank: attrs.rank != null ? Number(attrs.rank) : null,
    order: attrs.order != null ? Number(attrs.order) : null,
    lane: attrs.lane || null,
    span: attrs.span != null ? Number(attrs.span) : null,
    time: attrs.time != null ? String(attrs.time) : null,
    stack: normalizeStack(attrs.stack),
    maxLines: attrs.maxlines != null || attrs.maxLines != null
      ? Number(attrs.maxlines || attrs.maxLines)
      : null,
    shape: normalizeShape(attrs.shape),
  };
}

function normalizeShape(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'rectangle' || s === 'box') return 'rect';
  if (s === 'ellipse' || s === 'terminator') return 'oval';
  if (s === 'rounded' || s === 'stadium' || s === 'pill') return 'round';
  if (s === 'decision' || s === 'rhombus') return 'diamond';
  if (s === 'io' || s === 'input' || s === 'output' || s === 'para') return 'parallelogram';
  if (s === 'hexagon' || s === 'prep') return 'hex';
  if (s === 'grid' || s === 'rows' || s === 'tabular') return 'table';
  if (!SHAPES.has(s)) {
    throw err(
      'shape',
      `shape must be rect|round|oval|circle|diamond|parallelogram|hex|table (got "${v}").`,
      'RADIUS.md#shapes',
    );
  }
  return s;
}

function normalizeRoute(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'orthogonal' || s === 'elbow') return 'ortho';
  if (s === 'bezier' || s === 'curved' || s === 'organic') return 'curve';
  if (s === 'line' || s === 'direct') return 'straight';
  if (!ROUTES.has(s)) {
    throw err('route', `route must be curve|ortho|straight (got "${v}").`, 'RADIUS.md#route');
  }
  return s;
}

/** `stack:true` or `stack:2` — backing plates for “many” instances (max 4). */
function normalizeStack(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['true', 'yes', 'on', 'stack', 'stacked'].includes(s)) return 2;
  if (['false', 'no', 'off', '0'].includes(s)) return null;
  const n = Number(s);
  if (Number.isFinite(n) && n >= 1) return Math.min(4, Math.max(1, Math.floor(n)));
  return null;
}

function normalizeLayer(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (['conceptual', 'concept', 'c', '0'].includes(s)) return 'conceptual';
  if (['logical', 'logic', 'l', '1'].includes(s)) return 'logical';
  if (['physical', 'phys', 'p', '2'].includes(s)) return 'physical';
  if (['year', 'y'].includes(s)) return 'year';
  if (['half', 'h', '1h', '2h'].includes(s)) return 'half';
  if (['quarter', 'q'].includes(s)) return 'quarter';
  if (['month', 'm'].includes(s)) return 'month';
  if (['week', 'w'].includes(s)) return 'week';
  if (['day', 'd'].includes(s)) return 'day';
  if (ARCH_LAYERS.has(s) || TIME_LAYERS.has(s)) return s;
  return s;
}

function parseEdgeLine(line, path) {
  const trimmed = line.replace(/^\s*-\s*/, '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  // a --> b
  // a --> b: label
  // a --> b{wire:flow}
  // a --> b: label{wire:flow}
  const m = trimmed.match(
    /^([A-Za-z_][\w-]*)\s*(-->|->|—>|=>)\s*([A-Za-z_][\w-]*)\s*(?::\s*([^:{]*?))?\s*(?:\{([^}]*)\})?\s*$/,
  );
  if (!m) throw err(path, `Edge must be a --> b or a --> b: label{wire:name}. Got: ${trimmed}`, 'RADIUS.md#edges');
  const attrs = parseAttrs(m[5] || '');
  rejectForbiddenAttrs(attrs, path);
  const labelFromColon = (m[4] || '').trim() || null;
  return {
    from: m[1],
    to: m[3],
    label: labelFromColon || (attrs.label != null ? String(attrs.label) : null),
    wire: normalizeWireName(attrs.wire || attrs.wires || attrs.band || null),
  };
}

function parseStoryLine(line) {
  const t = line.replace(/^\s*-\s*/, '').trim();
  if (!t || t.startsWith('#')) return null;
  if (/^expand\s*[-_]?\s*all$/i.test(t) || /^expandall$/i.test(t)) return { type: 'expandAll' };
  if (/^collapse\s*[-_]?\s*all$/i.test(t) || /^collapseall$/i.test(t)) return { type: 'collapseAll' };
  const expand = t.match(/^expand\s+(\S+)$/i);
  if (expand) return { type: 'expand', id: expand[1] };
  const collapse = t.match(/^collapse\s+(\S+)$/i);
  if (collapse) return { type: 'collapse', id: collapse[1] };
  const wires = t.match(/^wires?\s*:?\s*(.+)$/i);
  if (wires) return { type: 'wires', wires: normalizeWires(wires[1]) };
  const focus = t.match(/^focus\s+(.+)$/i);
  if (focus) return { type: 'focus', ids: focus[1].split(/[\s,]+/).filter(Boolean) };
  const replace = t.match(/^replace\s+(\S+)\s+with\s+(\S+)$/i);
  if (replace) return { type: 'replace', from: replace[1], to: replace[2] };
  const show = t.match(/^show\s+(.+)$/i);
  if (show) return { type: 'show', ids: show[1].split(/[\s,]+/).filter(Boolean) };
  return { type: 'focus', ids: t.split(/[\s,]+/).filter(Boolean) };
}

function normalizeStoryStep(s) {
  if (s == null) return null;
  if (typeof s === 'string') return parseStoryLine(s);
  if (typeof s !== 'object') return null;
  const type = String(s.type || '').toLowerCase().replace(/_/g, '');
  if (type === 'expandall') return { type: 'expandAll' };
  if (type === 'collapseall') return { type: 'collapseAll' };
  if (type === 'expand' && s.id) return { type: 'expand', id: String(s.id) };
  if (type === 'collapse' && s.id) return { type: 'collapse', id: String(s.id) };
  if ((type === 'focus' || type === 'show') && (s.ids || s.id)) {
    const ids = s.ids || [s.id];
    return { type: type === 'show' ? 'show' : 'focus', ids: (Array.isArray(ids) ? ids : [ids]).map(String) };
  }
  if (type === 'replace' && s.from && s.to) return { type: 'replace', from: String(s.from), to: String(s.to) };
  if (type === 'wires' || type === 'wire') {
    return { type: 'wires', wires: normalizeWires(s.wires ?? s.wire ?? s.names ?? s.value) };
  }
  return s;
}

function parseBool(v, fallback) {
  if (v == null || v === '') return fallback;
  const s = String(v).toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'off'].includes(s)) return false;
  return fallback;
}

function defaultGround(template, frame, theme) {
  if (theme === 'neon') return 'chip';
  if (theme === 'indigo') return 'aurora';
  if (template === 'gis') return 'parcels';
  if (template === 'timeline') return 'grid';
  if (template === 'mindmap' || template === 'hierarchy') return 'dots';
  if (template === 'sequence') return 'grid';
  if (template === 'constellation') return 'aurora';
  if (template === 'cloud' || template === 'nkp') return 'circuit';
  if (template === 'k8s') return 'hex';
  if (frame === 'slide' || template === 'deck' || template === 'process') return 'wash';
  return 'dots';
}

export function parse(raw) {
  const text = stripFence(raw);
  if (!text) throw err('root', 'Empty Radius document.', 'RADIUS.md#quickstart');

  if (text.trimStart().startsWith('{')) {
    try {
      return normalizeSpec(JSON.parse(text));
    } catch (e) {
      if (e.radius) throw e;
      throw err('root', `Invalid JSON: ${e.message}`, 'RADIUS.md#json');
    }
  }

  const lines = text.split(/\r?\n/);
  const meta = {
    theme: undefined,
    template: undefined,
    frame: undefined,
    look: undefined,
    motion: undefined,
    font: undefined,
    ground: undefined,
    glass: undefined,
    wires: undefined,
    title: null,
    dir: undefined,
    engine: undefined,
    grain: undefined,
    route: undefined,
  };
  const nodes = [];
  const edges = [];
  const groups = [];
  const story = [];
  let section = 'meta';

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^(nodes|edges|groups|story)\s*:?\s*$/i);
    if (sectionMatch) {
      section = sectionMatch[1].toLowerCase();
      continue;
    }

    if (section === 'meta') {
      const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.+)$/);
      if (kv) {
        const key = kv[1].toLowerCase();
        const val = kv[2].trim().replace(/^["']|["']$/g, '');
        if (FORBIDDEN_LAYOUT_KEYS.has(key.replace(/_/g, ''))) {
          throw err(
            key,
            'Omit coordinates and typography. Use template or rank/lane/order/dir — Radius packs labels.',
            'RADIUS.md#layout',
          );
        }
        if (key === 'groundtone') meta.groundTone = val;
        else if (key === 'dir' || key === 'direction') meta.dir = val.toLowerCase();
        else if (key === 'engine' || key === 'layout') meta.engine = val.toLowerCase();
        else if (key === 'wires' || key === 'links' || key === 'showedges') meta.wires = val;
        else if (key === 'edges' && isWiresToggle(val)) meta.wires = val;
        else if (key === 'route' || key === 'routing') meta.route = val.toLowerCase();
        else if (key in meta || ['theme', 'template', 'frame', 'look', 'motion', 'font', 'ground', 'glass', 'title'].includes(key)) {
          meta[key] = val;
        }
        continue;
      }
      section = 'nodes';
    }

    const path = `${section}[${nodes.length + edges.length}]`;
    if (section === 'nodes') {
      const n = parseNodeLine(line, path);
      if (n) nodes.push(n);
    } else if (section === 'edges') {
      const e = parseEdgeLine(line, path);
      if (e) edges.push(e);
    } else if (section === 'groups') {
      const gm = line.replace(/^\s*-\s*/, '').match(/^([A-Za-z_][\w-]*)\s*(?:\[([^\]]*)\])?\s*(?:\{([^}]*)\})?/);
      if (!gm) throw err(path, 'Group: id[Title]{family:azure}', 'RADIUS.md#groups');
      const attrs = parseAttrs(gm[3] || '');
      rejectForbiddenAttrs(attrs, path);
      groups.push({
        id: gm[1],
        label: gm[2] || gm[1],
        family: attrs.family || null,
        kind: attrs.kind || null,
        parent: attrs.parent || null,
        layer: normalizeLayer(attrs.layer) || 'conceptual',
        members: (attrs.members || '').split(/[\s,]+/).filter(Boolean),
        collapsed: parseBool(attrs.collapsed, false) || parseBool(attrs.fold, false),
        expandable: parseBool(attrs.expandable, true),
        virtual: parseBool(attrs.virtual, false),
        rank: attrs.rank != null ? Number(attrs.rank) : null,
        order: attrs.order != null ? Number(attrs.order) : null,
        lane: attrs.lane || null,
        align: attrs.align || null,
      });
    } else if (section === 'story') {
      const s = parseStoryLine(line);
      if (s) story.push(s);
    }
  }

  for (const g of groups) {
    for (const mid of g.members) {
      const n = nodes.find((x) => x.id === mid);
      if (n) n.group = g.id;
    }
  }

  return normalizeSpec({ ...meta, nodes, edges, groups, story });
}

export function normalizeSpec(input) {
  if (input && typeof input === 'object') {
    for (const key of Object.keys(input)) {
      const k = key.toLowerCase().replace(/_/g, '');
      if (FORBIDDEN_LAYOUT_KEYS.has(k)) {
        throw err(
          key,
          'Omit coordinates and typography. Use template or rank/lane/order/dir — Radius packs labels.',
          'RADIUS.md#layout',
        );
      }
    }
  }

  const theme = input.theme || 'paper';
  const spec = {
    theme,
    template: input.template || 'flow',
    frame: input.frame || 'slide',
    look: input.look || 'elevated',
    motion: input.motion || 'tasteful',
    font: input.font || 'modern',
    ground: input.ground || null,
    groundTone: input.groundTone || (theme === 'neon' ? 'strong' : 'muted'),
    glass: normalizeGlass(input.glass),
    wires: normalizeWires(input.wires ?? input.links ?? input.showEdges ?? input.showedges),
    title: input.title || null,
    dir: normalizeDir(input.dir || input.direction),
    engine: normalizeEngine(input.engine || input.layout),
    grain: normalizeGrain(input.grain),
    route: normalizeRoute(input.route || input.routing),
    nodes: inferNodeParents(
      Array.isArray(input.nodes) ? input.nodes.map(normalizeNode) : [],
    ),
    edges: Array.isArray(input.edges) ? input.edges.map(normalizeEdge) : [],
    groups: Array.isArray(input.groups)
      ? input.groups.map((g) => ({
          ...g,
          kind: g.kind || null,
          family: g.family || null,
          parent: g.parent || null,
          layer: normalizeLayer(g.layer) || 'conceptual',
          members: Array.isArray(g.members) ? g.members : [],
          collapsed: !!g.collapsed,
          expandable: g.expandable !== false,
          virtual: !!g.virtual,
          rank: g.rank != null ? Number(g.rank) : null,
          order: g.order != null ? Number(g.order) : null,
          lane: g.lane || null,
          align: g.align || null,
        }))
      : [],
    story: Array.isArray(input.story)
      ? input.story.map(normalizeStoryStep).filter(Boolean)
      : [],
  };

  if (!THEMES.has(spec.theme)) {
    throw err('theme', `Unknown theme "${spec.theme}". Use one of: ${[...THEMES].join(', ')}`, 'RADIUS.md#themes');
  }
  if (!TEMPLATES.has(spec.template)) {
    throw err('template', `Unknown template "${spec.template}".`, 'RADIUS.md#templates');
  }
  if (!LOOKS.has(spec.look)) throw err('look', `look must be flat|elevated|perspective`, 'RADIUS.md#look');
  if (!MOTIONS.has(spec.motion)) throw err('motion', `motion must be tasteful|none|bold`, 'RADIUS.md#motion');
  if (!FRAMES.has(spec.frame)) throw err('frame', `frame must be slide|system`, 'RADIUS.md#frame');
  if (spec.dir && !DIRS.has(spec.dir)) {
    throw err('dir', 'dir must be lr|rl|tb|bt', 'RADIUS.md#layout');
  }

  if (!spec.ground) spec.ground = defaultGround(spec.template, spec.frame, spec.theme);
  if (!GROUNDS.has(spec.ground)) {
    throw err('ground', `Unknown ground "${spec.ground}".`, 'RADIUS.md#grounds');
  }
  if (!GLASS.has(spec.glass)) {
    throw err('glass', 'glass must be frost|solid|none', 'RADIUS.md#glass');
  }
  if (!spec.wires || !['all', 'off', 'only'].includes(spec.wires.mode)) {
    throw err(
      'wires',
      'wires must be on|off|all|none or a list of wire names (e.g. wires: flow trust)',
      'RADIUS.md#wires',
    );
  }

  if (!spec.nodes.length) {
    throw err('nodes', 'At least one node is required.', 'RADIUS.md#nodes');
  }

  if (spec.template === 'timeline' && spec.grain) {
    applyTimelineGrain(spec.nodes, spec.grain);
  }

  const ids = new Set(spec.nodes.map((n) => n.id));
  const groupIds = new Set(spec.groups.map((g) => g.id));
  for (const e of spec.edges) {
    const fromOk = ids.has(e.from) || groupIds.has(e.from);
    const toOk = ids.has(e.to) || groupIds.has(e.to);
    if (!fromOk || !toOk) {
      throw err(
        'edges',
        `Edge ${e.from} --> ${e.to} references unknown node or group.`,
        'RADIUS.md#edges',
      );
    }
  }

  return spec;
}

function normalizeDir(v) {
  if (!v) return null;
  const s = String(v).toLowerCase();
  if (s === 'right' || s === '→') return 'lr';
  if (s === 'left' || s === '←') return 'rl';
  if (s === 'down' || s === '↓') return 'tb';
  if (s === 'up' || s === '↑') return 'bt';
  return s;
}

function normalizeGrain(v) {
  if (v == null || v === '') return null;
  const s = normalizeLayer(v) || String(v).toLowerCase();
  if (!TIME_LAYERS.has(s)) {
    throw err(
      'grain',
      `grain must be year|half|quarter|month|week|day (got "${v}").`,
      'RADIUS.md#timeline',
    );
  }
  return s;
}

function normalizeEngine(v) {
  if (!v) return 'auto';
  const s = String(v).toLowerCase();
  if (['elk', 'elkjs', 'auto', 'native', 'fallback'].includes(s)) {
    return s === 'elkjs' ? 'elk' : s;
  }
  throw err('engine', 'engine must be auto|elk|native', 'RADIUS.md#layout');
}

function normalizeNode(n) {
  if (typeof n === 'string') {
    return {
      id: n,
      label: n,
      kind: null,
      group: null,
      parent: null,
      layer: null,
      appear: null,
      role: null,
      collapsed: null,
      expandable: null,
      rank: null,
      order: null,
      lane: null,
      span: null,
      time: null,
      stack: null,
      maxLines: null,
      shape: null,
    };
  }
  rejectForbiddenAttrs(n, `nodes[${n.id || '?'}]`);
  return {
    id: n.id,
    label: n.label || n.id,
    kind: n.kind || null,
    group: n.group || null,
    parent: n.parent || null,
    layer: normalizeLayer(n.layer),
    appear: n.appear != null ? Number(n.appear) : null,
    role: n.role || null,
    collapsed: n.collapsed == null ? null : !!n.collapsed,
    expandable: n.expandable == null ? null : !!n.expandable,
    rank: n.rank != null ? Number(n.rank) : null,
    order: n.order != null ? Number(n.order) : null,
    lane: n.lane || null,
    span: n.span != null ? Number(n.span) : null,
    time: n.time != null ? String(n.time) : null,
    stack: normalizeStack(n.stack),
    maxLines: n.maxLines != null ? Number(n.maxLines) : null,
    shape: normalizeShape(n.shape),
  };
}

function inferNodeParents(nodes) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (!n.parent || !byId[n.parent] || n.parent === n.id) continue;
    const p = byId[n.parent];
    if (p.expandable == null) p.expandable = true;
    if (p.collapsed == null) p.collapsed = true;
    if (!n.group && p.group) n.group = p.group;
  }
  for (const n of nodes) {
    const kids = nodes.filter((c) => c.parent === n.id);
    if (kids.length && n.expandable == null) n.expandable = true;
  }
  return nodes;
}

function normalizeEdge(e) {
  return {
    from: e.from,
    to: e.to,
    label: e.label || null,
    wire: normalizeWireName(e.wire || e.wires || e.band || null),
  };
}

function normalizeWireName(v) {
  if (v == null || v === '') return 'main';
  const s = String(v)
    .trim()
    .toLowerCase()
    .replace(/[^\w-]+/g, '-');
  return s || 'main';
}

function normalizeGlass(v) {
  if (v == null || v === '') return 'frost';
  const s = String(v).trim().toLowerCase();
  if (s === 'true' || s === 'yes' || s === 'on') return 'frost';
  if (s === 'false' || s === 'off' || s === 'opaque') return 'solid';
  return s;
}

function isWiresToggle(v) {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return ['on', 'off', 'true', 'false', 'yes', 'no', 'none', 'hide', 'show', 'all', '0', '1'].includes(s);
}

/**
 * Document / story wire filter.
 * - `{ mode:'all' }` — every edge
 * - `{ mode:'off' }` — conceptual (no lines)
 * - `{ mode:'only', names:['flow','trust'] }` — named wire groups only
 */
export function normalizeWires(v) {
  if (v == null || v === '') return { mode: 'all', names: [] };
  if (typeof v === 'object' && !Array.isArray(v) && v.mode) {
    const mode = String(v.mode).toLowerCase();
    if (mode === 'off' || mode === 'none') return { mode: 'off', names: [] };
    if (mode === 'all' || mode === 'on') return { mode: 'all', names: [] };
    const names = (Array.isArray(v.names) ? v.names : [])
      .map(normalizeWireName)
      .filter(Boolean);
    return { mode: 'only', names: [...new Set(names)] };
  }
  if (Array.isArray(v)) {
    const names = v.map(normalizeWireName).filter(Boolean);
    if (!names.length) return { mode: 'off', names: [] };
    return { mode: 'only', names: [...new Set(names)] };
  }
  const s = String(v).trim().toLowerCase();
  if (['off', 'false', 'no', 'none', 'hide', '0'].includes(s)) return { mode: 'off', names: [] };
  if (['on', 'true', 'yes', 'show', 'all', '1'].includes(s)) return { mode: 'all', names: [] };
  const names = s
    .split(/[\s,|/]+/)
    .map(normalizeWireName)
    .filter(Boolean);
  if (!names.length) return { mode: 'all', names: [] };
  return { mode: 'only', names: [...new Set(names)] };
}

/** Whether an edge's wire group is visible under the current filter. */
export function wireVisible(wire, wires) {
  const w = normalizeWires(wires);
  if (w.mode === 'off') return false;
  if (w.mode === 'all') return true;
  return w.names.includes(normalizeWireName(wire));
}

export const ENUMS = {
  TEMPLATES,
  THEMES,
  LOOKS,
  MOTIONS,
  FRAMES,
  GROUNDS,
  GLASS,
  WIRES: new Set(['on', 'off', 'all', 'none']),
  DIRS,
  SHAPES,
  ROUTES,
  ARCH_LAYERS,
  TIME_LAYERS,
};
