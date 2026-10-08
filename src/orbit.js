/**
 * Constellation — 3D relationship cloud.
 * Layout packs nodes in a ball with edge springs; camera orbits with
 * slow auto-spin and pointer drag (GitHub Pages / static friendly).
 */

function prefersReduced() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Fibonacci sphere seed — even coverage for n points on a unit sphere. */
export function fibonacciSphere(n, radius = 1) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    pts.push({
      x: Math.cos(theta) * r * radius,
      y: y * radius,
      z: Math.sin(theta) * r * radius,
    });
  }
  return pts;
}

/**
 * Force-pack nodes in 3D from edge springs + pairwise repulsion.
 * @returns {Record<string, {x:number,y:number,z:number}>}
 */
export function packConstellation3d(nodes, edges, { radius = 220, iterations = 90 } = {}) {
  const ids = nodes.map((n) => n.id);
  const n = ids.length;
  if (!n) return {};

  const seed = fibonacciSphere(n, radius * 0.92);
  const pos = {};
  ids.forEach((id, i) => {
    pos[id] = { ...seed[i] };
  });

  const links = (edges || []).filter((e) => pos[e.from] && pos[e.to] && e.from !== e.to);
  const idIndex = Object.fromEntries(ids.map((id, i) => [id, i]));

  for (let iter = 0; iter < iterations; iter++) {
    const cool = 1 - iter / iterations;
    const forces = Object.fromEntries(ids.map((id) => [id, { x: 0, y: 0, z: 0 }]));

    // Repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = ids[i];
        const b = ids[j];
        const dx = pos[a].x - pos[b].x;
        const dy = pos[a].y - pos[b].y;
        const dz = pos[a].z - pos[b].z;
        const dist2 = dx * dx + dy * dy + dz * dz + 0.01;
        const dist = Math.sqrt(dist2);
        const force = ((radius * 0.55) ** 2 / dist2) * cool;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        forces[a].x += fx;
        forces[a].y += fy;
        forces[a].z += fz;
        forces[b].x -= fx;
        forces[b].y -= fy;
        forces[b].z -= fz;
      }
    }

    // Edge springs — shorter rest for denser relationship clouds
    const rest = radius * 0.42;
    for (const e of links) {
      const a = e.from;
      const b = e.to;
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const dz = pos[b].z - pos[a].z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      const pull = (dist - rest) * 0.06 * cool;
      const fx = (dx / dist) * pull;
      const fy = (dy / dist) * pull;
      const fz = (dz / dist) * pull;
      forces[a].x += fx;
      forces[a].y += fy;
      forces[a].z += fz;
      forces[b].x -= fx;
      forces[b].y -= fy;
      forces[b].z -= fz;
    }

    // Soft parent springs (tree edges) when parent: is set
    for (const node of nodes) {
      if (!node.parent || !pos[node.parent] || !pos[node.id]) continue;
      const a = node.parent;
      const b = node.id;
      const dx = pos[b].x - pos[a].x;
      const dy = pos[b].y - pos[a].y;
      const dz = pos[b].z - pos[a].z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      const pull = (dist - rest * 0.85) * 0.08 * cool;
      forces[a].x += (dx / dist) * pull;
      forces[a].y += (dy / dist) * pull;
      forces[a].z += (dz / dist) * pull;
      forces[b].x -= (dx / dist) * pull;
      forces[b].y -= (dy / dist) * pull;
      forces[b].z -= (dz / dist) * pull;
    }

    // Integrate + gentle shell constraint (keeps a round cloud)
    for (const id of ids) {
      pos[id].x += forces[id].x;
      pos[id].y += forces[id].y;
      pos[id].z += forces[id].z;
      const len = Math.hypot(pos[id].x, pos[id].y, pos[id].z) || 1;
      const target = radius * (0.55 + 0.4 * ((idIndex[id] % 5) / 5));
      const mix = 0.12;
      const shell = target / len;
      pos[id].x = pos[id].x * (1 - mix) + pos[id].x * shell * mix;
      pos[id].y = pos[id].y * (1 - mix) + pos[id].y * shell * mix;
      pos[id].z = pos[id].z * (1 - mix) + pos[id].z * shell * mix;
    }
  }

  return pos;
}

/** Rotate then perspective-project a 3D point into board pixels. */
export function projectPoint(p, cam, board) {
  const { yaw = 0, pitch = 0.35, scale = 1, cx, cy } = cam;
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  // yaw around Y, then pitch around X
  let x = p.x * cosY - p.z * sinY;
  let z = p.x * sinY + p.z * cosY;
  let y = p.y * cosP - z * sinP;
  z = p.y * sinP + z * cosP;

  const perspective = 520;
  const depth = perspective / (perspective + z);
  const px = (cx ?? board.w / 2) + x * scale * depth;
  const py = (cy ?? board.h / 2) + y * scale * depth;
  return { x: px, y: py, z, depth };
}

export function projectConstellation(space, cam, board, sizes) {
  const out = {};
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const [id, p] of Object.entries(space)) {
    const proj = projectPoint(p, cam, board);
    out[id] = proj;
    zMin = Math.min(zMin, proj.z);
    zMax = Math.max(zMax, proj.z);
  }
  const span = Math.max(1, zMax - zMin);
  for (const [id, proj] of Object.entries(out)) {
    const t = (proj.z - zMin) / span;
    const s = sizes[id] || { w: 100, h: 48 };
    proj.scale = 0.62 + 0.38 * t;
    proj.opacity = 0.45 + 0.55 * t;
    proj.zIndex = Math.round(10 + t * 900);
    proj.left = proj.x - (s.w * proj.scale) / 2;
    proj.top = proj.y - (s.h * proj.scale) / 2;
  }
  return out;
}

/**
 * Bind slow auto-spin + drag orbit. Updates node transforms and edge chords.
 * @returns {{ destroy: Function }}
 */
export function bindOrbit(root, spec, laid) {
  const board = root.querySelector('.radius-board');
  const space = laid.orbit?.space;
  if (!board || !space || spec.template !== 'constellation') {
    return { destroy() {} };
  }

  board.classList.add('is-orbit');
  board.dataset.orbit = '1';

  const cam = {
    yaw: laid.orbit.yaw ?? 0.4,
    pitch: laid.orbit.pitch ?? 0.38,
    scale: laid.orbit.scale ?? 1,
    cx: laid.board.w / 2,
    cy: laid.board.h / 2 + 8,
  };

  const sizes = {};
  for (const [id, b] of Object.entries(laid.boxes || {})) {
    sizes[id] = { w: b.w, h: b.h };
  }

  const nodeEls = [...board.querySelectorAll('.radius-node[data-id]')];
  const byId = Object.fromEntries(nodeEls.map((el) => [el.dataset.id, el]));
  const edgePaths = [
    ...board.querySelectorAll('.radius-edge[data-edge-id]'),
    ...board.querySelectorAll('.radius-edge-hit[data-edge-id]'),
    ...board.querySelectorAll('.radius-edge-pipe[data-edge-id]'),
  ];
  const pathsByEdge = new Map();
  for (const path of edgePaths) {
    const eid = path.dataset.edgeId;
    if (!eid) continue;
    if (!pathsByEdge.has(eid)) pathsByEdge.set(eid, []);
    pathsByEdge.get(eid).push(path);
  }
  const edgeLabels = [...board.querySelectorAll('.radius-edge-label[data-edge-id]')];

  let pointerDown = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;
  let raf = 0;
  let spin = !prefersReduced() && spec.motion !== 'none';
  const spinSpeed = spec.motion === 'bold' ? 0.0042 : 0.0016;
  let resumeTimer = 0;

  function apply() {
    const proj = projectConstellation(space, cam, laid.board, sizes);
    for (const [id, p] of Object.entries(proj)) {
      const el = byId[id];
      if (!el) continue;
      el.style.left = `${p.left}px`;
      el.style.top = `${p.top}px`;
      el.style.transform = `scale(${p.scale})`;
      el.style.opacity = String(p.opacity);
      el.style.zIndex = String(p.zIndex);
      el.dataset.depth = p.z.toFixed(1);
    }

    for (const paths of pathsByEdge.values()) {
      const sample = paths[0];
      const a = proj[sample.dataset.from];
      const b = proj[sample.dataset.to];
      if (!a || !b) continue;
      const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
      for (const el of paths) el.setAttribute('d', d);
    }
    for (const lab of edgeLabels) {
      const a = proj[lab.dataset.from];
      const b = proj[lab.dataset.to];
      if (!a || !b) continue;
      lab.style.left = `${(a.x + b.x) / 2}px`;
      lab.style.top = `${(a.y + b.y) / 2 - 10}px`;
      lab.style.opacity = String(Math.min(a.opacity, b.opacity) * 0.95);
      lab.style.zIndex = String(Math.round((a.zIndex + b.zIndex) / 2));
    }
  }

  function tick() {
    if (spin && !dragging) cam.yaw += spinSpeed;
    apply();
    raf = requestAnimationFrame(tick);
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    const t = e.target;
    if (t.closest?.('.radius-fold-btn, .radius-resize, a, button, .radius-orbit-hint')) return;
    pointerDown = true;
    dragging = false;
    startX = lastX = e.clientX;
    startY = lastY = e.clientY;
    board.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!pointerDown) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const total = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (!dragging && total > 6) {
      dragging = true;
      spin = false;
      board.classList.add('is-orbit-dragging');
    }
    if (!dragging) return;
    lastX = e.clientX;
    lastY = e.clientY;
    cam.yaw += dx * 0.008;
    cam.pitch = Math.max(-1.2, Math.min(1.2, cam.pitch + dy * 0.006));
  }

  function onPointerUp(e) {
    if (!pointerDown) return;
    const wasDrag = dragging;
    pointerDown = false;
    dragging = false;
    board.classList.remove('is-orbit-dragging');
    try {
      board.releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    if (wasDrag) {
      window.clearTimeout(resumeTimer);
      if (!prefersReduced() && spec.motion !== 'none') {
        resumeTimer = window.setTimeout(() => {
          spin = true;
        }, 1600);
      }
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const next = cam.scale * (e.deltaY > 0 ? 0.94 : 1.06);
    cam.scale = Math.max(0.45, Math.min(2.4, next));
  }

  board.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('pointermove', onPointerMove);
  board.addEventListener('pointerup', onPointerUp);
  board.addEventListener('pointercancel', onPointerUp);
  board.addEventListener('wheel', onWheel, { passive: false });

  // Hint
  let hint = board.querySelector('.radius-orbit-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'radius-orbit-hint';
    hint.textContent = 'Drag to orbit · scroll to zoom · slow spin';
    board.appendChild(hint);
  }

  apply();
  raf = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.clearTimeout(resumeTimer);
      board.removeEventListener('pointerdown', onPointerDown);
      board.removeEventListener('pointermove', onPointerMove);
      board.removeEventListener('pointerup', onPointerUp);
      board.removeEventListener('pointercancel', onPointerUp);
      board.removeEventListener('wheel', onWheel);
      board.classList.remove('is-orbit', 'is-orbit-dragging');
      hint?.remove();
    },
  };
}
