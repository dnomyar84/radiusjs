/**
 * Hover / focus / keyboard story + Eraser-like group expand/collapse
 * with staggered child reveal.
 */

function prefersReduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function bindInteract(root, spec, laid) {
  const board = root.querySelector('.radius-board');
  if (!board) return { destroy() {}, step() {}, next() {}, prev() {}, expand() {}, collapse() {} };

  const nodes = [...board.querySelectorAll('.radius-node')];
  const edges = [...board.querySelectorAll('.radius-edge')];
  const groups = [...board.querySelectorAll('.radius-group[data-id]')];
  const byId = Object.fromEntries(nodes.map((el) => [el.dataset.id, el]));
  const groupById = Object.fromEntries(groups.map((el) => [el.dataset.id, el]));

  let hot = null;
  let storyIndex = -1;
  const story = spec.story || [];
  const motion = prefersReduced() ? 'none' : spec.motion;
  const stagger = motion === 'bold' ? 110 : motion === 'none' ? 0 : 80;
  const timers = new Set();

  function later(fn, ms) {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function setHot(id) {
    if (hot && byId[hot]) byId[hot].classList.remove('is-hot');
    hot = id;
    if (hot && byId[hot]) byId[hot].classList.add('is-hot');
  }

  function memberIds(gid) {
    const g = groupById[gid];
    if (!g) return [];
    return (g.dataset.members || '').split(',').filter(Boolean);
  }

  function childGroupIds(gid) {
    const meta = laid.groupBoxes?.[gid];
    return meta?.childIds || [];
  }

  function allDescendantNodeIds(gid) {
    const out = [...memberIds(gid)];
    childGroupIds(gid).forEach((cid) => {
      out.push(...allDescendantNodeIds(cid));
    });
    return out;
  }

  function syncEdges() {
    edges.forEach((edge) => {
      const from = byId[edge.dataset.from];
      const to = byId[edge.dataset.to];
      const hidden =
        !from ||
        !to ||
        from.classList.contains('is-folded') ||
        to.classList.contains('is-folded') ||
        from.classList.contains('will-appear');
      edge.classList.toggle('is-hidden', !!hidden);
    });
  }

  function revealMembers(gid, { animate = true } = {}) {
    const ids = memberIds(gid);
    // show nested group frames
    childGroupIds(gid).forEach((cid) => {
      const cg = groupById[cid];
      if (!cg) return;
      cg.classList.remove('is-folded-group');
      // keep nested collapsed state until user expands
      if (cg.dataset.collapsed !== 'true') revealMembers(cid, { animate });
    });
    ids.forEach((id, i) => {
      const el = byId[id];
      if (!el) return;
      // skip if lives in a still-collapsed child group
      const home = el.dataset.group;
      if (home && home !== gid && groupById[home]?.dataset.collapsed === 'true') return;
      if (home && home !== gid && groupById[home]?.classList.contains('is-folded-group')) return;
      el.classList.remove('is-folded');
      if (!animate || motion === 'none') {
        el.classList.add('is-shown');
        el.classList.remove('will-appear');
        return;
      }
      el.classList.remove('is-shown');
      el.classList.add('will-appear');
      later(() => {
        el.classList.add('is-shown');
        el.classList.remove('will-appear');
        syncEdges();
      }, i * stagger);
    });
    later(syncEdges, ids.length * stagger + 30);
  }

  function hideMembers(gid) {
    allDescendantNodeIds(gid).forEach((id) => {
      const el = byId[id];
      if (!el) return;
      el.classList.add('is-folded');
      el.classList.remove('is-shown', 'will-appear', 'is-focus', 'is-hot');
    });
    childGroupIds(gid).forEach((cid) => {
      const cg = groupById[cid];
      if (!cg) return;
      cg.classList.add('is-folded-group');
      hideMembers(cid);
    });
    syncEdges();
  }

  function setGroupCollapsed(gid, collapsed) {
    const g = groupById[gid];
    const meta = laid.groupBoxes?.[gid];
    if (!g || !meta || g.dataset.expandable === 'false') return;

    g.dataset.collapsed = collapsed ? 'true' : 'false';
    g.classList.toggle('is-collapsed', collapsed);
    g.classList.toggle('is-expanded', !collapsed);
    g.style.height = `${collapsed ? meta.hCollapsed : meta.hExpanded}px`;

    const btn = g.querySelector('.radius-fold-btn');
    if (btn) {
      btn.textContent = collapsed ? '▸' : '▾';
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    if (collapsed) hideMembers(gid);
    else revealMembers(gid, { animate: true });
  }

  function toggleGroup(gid) {
    const g = groupById[gid];
    if (!g) return;
    setGroupCollapsed(gid, g.dataset.collapsed !== 'true');
  }

  nodes.forEach((el) => {
    el.addEventListener('pointerenter', () => setHot(el.dataset.id));
    el.addEventListener('pointerleave', () => {
      if (hot === el.dataset.id) setHot(null);
    });
    el.addEventListener('focus', () => setHot(el.dataset.id));
    el.addEventListener('click', () => setHot(el.dataset.id));
  });

  groups.forEach((g) => {
    if (g.dataset.expandable === 'false') return;
    const head = g.querySelector('.radius-group-head');
    if (!head) return;
    const onToggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleGroup(g.dataset.id);
    };
    head.addEventListener('click', onToggle);
    head.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') onToggle(e);
    });
    head.tabIndex = 0;
    head.setAttribute('role', 'button');
    head.setAttribute('aria-label', `Expand or collapse ${g.dataset.id}`);
  });

  function clearStoryClasses() {
    nodes.forEach((el) => {
      el.classList.remove('is-focus', 'is-ghost', 'is-dim', 'is-solid');
    });
  }

  function applyStep(step) {
    clearStoryClasses();
    if (!step) return;
    if (step.type === 'expand') {
      setGroupCollapsed(step.id, false);
      return;
    }
    if (step.type === 'collapse') {
      setGroupCollapsed(step.id, true);
      return;
    }
    if (step.type === 'focus' || step.type === 'show') {
      const set = new Set(step.ids || []);
      // auto-expand groups that contain focused ids
      set.forEach((id) => {
        const n = byId[id];
        const gid = n?.dataset.group;
        if (gid && groupById[gid]?.dataset.collapsed === 'true') setGroupCollapsed(gid, false);
      });
      nodes.forEach((el) => {
        if (el.classList.contains('is-folded')) return;
        if (set.has(el.dataset.id)) el.classList.add('is-focus');
        else el.classList.add('is-dim');
      });
    } else if (step.type === 'replace') {
      nodes.forEach((el) => {
        if (!el.classList.contains('is-folded')) el.classList.add('is-dim');
      });
      [step.from, step.to].forEach((id) => {
        const n = byId[id];
        const gid = n?.dataset.group;
        if (gid && groupById[gid]?.dataset.collapsed === 'true') setGroupCollapsed(gid, false);
      });
      if (byId[step.from]) {
        byId[step.from].classList.remove('is-dim', 'is-folded');
        byId[step.from].classList.add('is-ghost');
      }
      if (byId[step.to]) {
        byId[step.to].classList.remove('is-dim', 'is-folded');
        byId[step.to].classList.add('is-solid', 'is-focus');
      }
    }
  }

  function go(i) {
    if (!story.length) return storyIndex;
    storyIndex = Math.max(-1, Math.min(story.length - 1, i));
    if (storyIndex < 0) {
      clearStoryClasses();
      return storyIndex;
    }
    applyStep(story[storyIndex]);
    return storyIndex;
  }

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      go(storyIndex + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      go(storyIndex - 1);
    } else if (e.key === 'Escape') {
      go(-1);
      setHot(null);
    }
  }

  board.tabIndex = 0;
  board.addEventListener('keydown', onKey);

  const hint = board.querySelector('.radius-story-hint');
  const hasFolds = groups.length > 0;
  if (hint && (story.length || hasFolds)) {
    hint.hidden = false;
    hint.textContent = story.length
      ? '← → story · click group to expand'
      : 'Click group header to expand / collapse';
  }

  // Initial appear: skip folded members; stagger the rest
  const order = (laid.appearOrder || nodes.map((n) => n.dataset.id)).filter((id) => {
    const el = byId[id];
    return el && !el.classList.contains('is-folded');
  });

  if (motion === 'none') {
    order.forEach((id) => byId[id]?.classList.add('is-shown'));
  } else {
    const rise = motion === 'bold' ? 14 : 8;
    board.style.setProperty('--radius-rise', `${rise}px`);
    order.forEach((id, i) => {
      const el = byId[id];
      if (!el) return;
      el.classList.add('will-appear');
      later(() => {
        el.classList.add('is-shown');
        el.classList.remove('will-appear');
        syncEdges();
      }, i * stagger);
    });
  }

  // Start collapsed groups hidden
  groups.forEach((g) => {
    if (g.dataset.collapsed === 'true') hideMembers(g.dataset.id);
  });
  syncEdges();

  return {
    next: () => go(storyIndex + 1),
    prev: () => go(storyIndex - 1),
    step: (i) => go(i),
    index: () => storyIndex,
    expand: (id) => setGroupCollapsed(id, false),
    collapse: (id) => setGroupCollapsed(id, true),
    toggle: (id) => toggleGroup(id),
    destroy() {
      timers.forEach((id) => clearTimeout(id));
      board.removeEventListener('keydown', onKey);
    },
  };
}
