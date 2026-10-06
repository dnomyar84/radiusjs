/**
 * Parse ```radius fences / text into IR.
 * Errors: { path, fix, see } for agent retry loops.
 */

const TEMPLATES = new Set([
  'deck', 'process', 'hub', 'sequence', 'hierarchy', 'flow', 'bars',
  'gis', 'cloud', 'k8s', 'nkp',
]);

const THEMES = new Set([
  'paper', 'night', 'ios', 'material', 'esri', 'aws', 'azure', 'gcp', 'oci', 'k8s', 'nutanix', 'neon',
]);

const LOOKS = new Set(['flat', 'elevated', 'perspective']);
const MOTIONS = new Set(['tasteful', 'none', 'bold']);
const FRAMES = new Set(['slide', 'system']);
const GROUNDS = new Set([
  'none', 'solid', 'wash', 'vignette', 'grid', 'dots', 'matrix', 'circuit', 'chip',
  'mesh', 'hex', 'roads', 'helix', 'contour', 'parcels', 'globe', 'globe-horizon', 'globe-corner',
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

function parseAttrs(s) {
  const out = {};
  if (!s) return out;
  const re = /(\w[\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\],}]+))/g;
  let m;
  while ((m = re.exec(s))) {
    out[m[1]] = m[2] ?? m[3] ?? m[4];
  }
  return out;
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

  return {
    id,
    label: label || id,
    kind: attrs.kind || null,
    role: attrs.role || null,
    group: attrs.group || null,
    appear: attrs.appear != null ? Number(attrs.appear) : null,
  };
}

function parseEdgeLine(line, path) {
  const trimmed = line.replace(/^\s*-\s*/, '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const m = trimmed.match(/^([A-Za-z_][\w-]*)\s*(-->|->|—>|=>)\s*([A-Za-z_][\w-]*)\s*(?::\s*(.+))?$/);
  if (!m) throw err(path, `Edge must be a --> b. Got: ${trimmed}`, 'RADIUS.md#edges');
  return { from: m[1], to: m[3], label: (m[4] || '').trim() || null };
}

function parseStoryLine(line) {
  const t = line.replace(/^\s*-\s*/, '').trim();
  if (!t || t.startsWith('#')) return null;
  const expand = t.match(/^expand\s+(\S+)$/i);
  if (expand) return { type: 'expand', id: expand[1] };
  const collapse = t.match(/^collapse\s+(\S+)$/i);
  if (collapse) return { type: 'collapse', id: collapse[1] };
  const focus = t.match(/^focus\s+(.+)$/i);
  if (focus) return { type: 'focus', ids: focus[1].split(/[\s,]+/).filter(Boolean) };
  const replace = t.match(/^replace\s+(\S+)\s+with\s+(\S+)$/i);
  if (replace) return { type: 'replace', from: replace[1], to: replace[2] };
  const show = t.match(/^show\s+(.+)$/i);
  if (show) return { type: 'show', ids: show[1].split(/[\s,]+/).filter(Boolean) };
  return { type: 'focus', ids: t.split(/[\s,]+/).filter(Boolean) };
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
  if (template === 'gis') return 'hex';
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
      throw err('root', `Invalid JSON: ${e.message}`, 'RADIUS.md#json');
    }
  }

  const lines = text.split(/\r?\n/);
  const meta = {
    theme: 'paper',
    template: 'flow',
    frame: 'slide',
    look: 'elevated',
    motion: 'tasteful',
    font: 'modern',
    ground: null,
    title: null,
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
        if (key in meta || key === 'groundtone') {
          if (key === 'groundtone') meta.groundTone = val;
          else meta[key] = val;
        }
        continue;
      }
      // bare node before sections
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
      groups.push({
        id: gm[1],
        label: gm[2] || gm[1],
        family: attrs.family || null,
        members: (attrs.members || '').split(/[\s,]+/).filter(Boolean),
        collapsed: parseBool(attrs.collapsed, false) || parseBool(attrs.fold, false),
        expandable: parseBool(attrs.expandable, true),
      });
    } else if (section === 'story') {
      const s = parseStoryLine(line);
      if (s) story.push(s);
    }
  }

  // assign group membership from node.group or groups.members
  for (const g of groups) {
    for (const mid of g.members) {
      const n = nodes.find((x) => x.id === mid);
      if (n) n.group = g.id;
    }
  }

  return normalizeSpec({ ...meta, nodes, edges, groups, story });
}

export function normalizeSpec(input) {
  const theme = input.theme || 'paper';
  const spec = {
    theme,
    template: input.template || 'flow',
    frame: input.frame || 'slide',
    look: input.look || (theme === 'neon' ? 'perspective' : 'elevated'),
    motion: input.motion || 'tasteful',
    font: input.font || 'modern',
    ground: input.ground || null,
    groundTone: input.groundTone || (theme === 'neon' ? 'strong' : 'muted'),
    title: input.title || null,
    nodes: Array.isArray(input.nodes) ? input.nodes.map(normalizeNode) : [],
    edges: Array.isArray(input.edges) ? input.edges.map(normalizeEdge) : [],
    groups: Array.isArray(input.groups) ? input.groups : [],
    story: Array.isArray(input.story) ? input.story : [],
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

  if (!spec.ground) spec.ground = defaultGround(spec.template, spec.frame, spec.theme);
  if (!GROUNDS.has(spec.ground)) {
    throw err('ground', `Unknown ground "${spec.ground}".`, 'RADIUS.md#grounds');
  }

  if (!spec.nodes.length) {
    throw err('nodes', 'At least one node is required.', 'RADIUS.md#nodes');
  }

  const ids = new Set(spec.nodes.map((n) => n.id));
  for (const e of spec.edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) {
      throw err('edges', `Edge ${e.from} --> ${e.to} references unknown node.`, 'RADIUS.md#edges');
    }
  }

  return spec;
}

function normalizeNode(n) {
  if (typeof n === 'string') return { id: n, label: n, kind: null, group: null, appear: null, role: null };
  return {
    id: n.id,
    label: n.label || n.id,
    kind: n.kind || null,
    group: n.group || null,
    appear: n.appear != null ? Number(n.appear) : null,
    role: n.role || null,
  };
}

function normalizeEdge(e) {
  return { from: e.from, to: e.to, label: e.label || null };
}

export const ENUMS = { TEMPLATES, THEMES, LOOKS, MOTIONS, FRAMES, GROUNDS };
