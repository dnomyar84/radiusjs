/**
 * FLIP fold motion — lead the viewer from collapsed face → expanded layout.
 * Capture before reflow; play after paint (invert → none).
 */

export function prefersReducedMotion() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Snapshot visible node/group boxes relative to the board. */
export function snapshotFlip(board) {
  if (!board) return new Map();
  const br = board.getBoundingClientRect();
  const map = new Map();
  board.querySelectorAll('.radius-node[data-id], .radius-group[data-id]').forEach((el) => {
    if (el.classList.contains('is-folded') || el.classList.contains('is-folded-group')) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return;
    map.set(el.dataset.id, {
      x: r.left - br.left,
      y: r.top - br.top,
      w: r.width,
      h: r.height,
    });
  });
  return map;
}

/**
 * Morph surviving elements from old → new geometry; soft-enter newcomers.
 * Only `focusId` (the folded parent) gets scale + mild elevation.
 * Siblings translate only — never scale/z-boost (that covered children).
 * @param {HTMLElement} board
 * @param {Map} before snapshotFlip result
 * @param {{ duration?: number, stagger?: number, focusId?: string }} opts
 */
export function playFlip(board, before, opts = {}) {
  if (!board || !before?.size || prefersReducedMotion()) return;
  const duration = opts.duration ?? 420;
  const stagger = opts.stagger ?? 55;
  const focusId = opts.focusId || null;
  const br = board.getBoundingClientRect();

  const edges = board.querySelector('.radius-edges');
  const edgeLabels = board.querySelector('.radius-edge-labels');
  const axis = board.querySelector('.radius-axis');
  const soft = [edges, edgeLabels, axis].filter(Boolean);
  for (const el of soft) {
    el.style.transition = 'none';
    el.style.opacity = '0';
  }

  const moving = [];
  const entering = [];

  board.querySelectorAll('.radius-node[data-id], .radius-group[data-id]').forEach((el) => {
    if (el.classList.contains('is-folded') || el.classList.contains('is-folded-group')) return;
    const id = el.dataset.id;
    const prev = before.get(id);
    const r = el.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return;
    const next = {
      x: r.left - br.left,
      y: r.top - br.top,
      w: r.width,
      h: r.height,
    };

    if (!prev) {
      entering.push(el);
      return;
    }

    const dx = prev.x - next.x;
    const dy = prev.y - next.y;
    const isFocus = focusId && id === focusId;
    const sx = isFocus ? prev.w / Math.max(next.w, 1) : 1;
    const sy = isFocus ? prev.h / Math.max(next.h, 1) : 1;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.02 && Math.abs(sy - 1) < 0.02) {
      return;
    }

    // Focus: scale morph. Siblings: translate only (no z-boost, no blow-up).
    el.classList.add(isFocus ? 'is-flipping-focus' : 'is-flipping-soft');
    el.style.transformOrigin = 'top left';
    el.style.transition = 'none';
    el.style.transform = isFocus
      ? `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
      : `translate(${dx}px, ${dy}px)`;
    moving.push(el);
  });

  for (const el of entering) {
    el.classList.add('will-appear', 'is-fold-enter');
    el.classList.remove('is-shown');
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const ease = 'var(--radius-ease, cubic-bezier(0.22, 1, 0.36, 1))';
      for (const el of moving) {
        el.style.transition = `transform ${duration}ms ${ease}`;
        el.style.transform = 'none';
      }
      for (const el of soft) {
        el.style.transition = `opacity ${Math.round(duration * 0.7)}ms ${ease}`;
        el.style.opacity = '1';
      }
      entering.forEach((el, i) => {
        window.setTimeout(() => {
          el.classList.add('is-shown');
          el.classList.remove('will-appear');
        }, Math.round(duration * 0.28) + i * stagger);
      });
      window.setTimeout(() => {
        for (const el of moving) {
          el.classList.remove('is-flipping-focus', 'is-flipping-soft');
          el.style.transition = '';
          el.style.transform = '';
          el.style.transformOrigin = '';
        }
        for (const el of entering) {
          el.classList.remove('is-fold-enter');
        }
        for (const el of soft) {
          el.style.transition = '';
          el.style.opacity = '';
        }
      }, duration + 60);
    });
  });
}