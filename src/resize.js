/**
 * User drag-resize overrides — grow freely, shrink to content floor.
 * Runtime only (not IR): agents never emit w/h.
 */

import { FACE_W, FACE_H } from './labels.js';
import { routeEdges, edgeRouteMode } from './edges.js';

export const RESIZE_MIN_W = 96;
export const RESIZE_MIN_H = 44;

/** Natural content floor for a node box. */
export function nodeMinSize(box) {
  const mw = box?.measure?.w ?? box?.faceOnly?.w ?? FACE_W;
  const mh = box?.measure?.h ?? box?.faceOnly?.h ?? FACE_H;
  return {
    minW: Math.max(RESIZE_MIN_W, Math.round(mw * 0.92)),
    minH: Math.max(RESIZE_MIN_H, Math.round(mh * 0.92)),
  };
}

/** Floor for a group — collapsed face, or expanded content bbox. */
export function groupMinSize(id, g, laid, spec) {
  const faceW = g?.face?.w ?? g?.wCollapsed ?? FACE_W;
  const faceH = g?.face?.h ?? g?.hCollapsed ?? FACE_H;
  let minW = Math.max(RESIZE_MIN_W, Math.round(faceW * 0.92));
  let minH = Math.max(RESIZE_MIN_H, Math.round(faceH * 0.92));

  if (g && !g.collapsed) {
    const pad = 14;
    let maxR = g.x + minW;
    let maxB = g.y + Math.max(minH, (g.hCollapsed || FACE_H) + 24);
    const meta = (spec.groups || []).find((x) => x.id === id);
    const members = meta?.members || [];
    for (const mid of members) {
      const b = laid.boxes?.[mid];
      if (!b || b.folded) continue;
      maxR = Math.max(maxR, b.x + b.w + pad);
      maxB = Math.max(maxB, b.y + b.h + pad);
    }
    for (const child of (spec.groups || []).filter((c) => c.parent === id)) {
      const cg = laid.groupBoxes?.[child.id];
      if (!cg || cg.folded) continue;
      const ch = cg.collapsed ? cg.hCollapsed : (cg.hExpanded ?? cg.h);
      const cw = cg.collapsed ? (cg.wCollapsed ?? cg.w) : (cg.wExpanded ?? cg.w);
      maxR = Math.max(maxR, cg.x + cw + pad);
      maxB = Math.max(maxB, cg.y + ch + pad);
    }
    minW = Math.max(minW, Math.round(maxR - g.x));
    minH = Math.max(minH, Math.round(maxB - g.y));
  }
  return { minW, minH };
}

export function clampSize(w, h, minW, minH) {
  return {
    w: Math.max(minW, Math.round(w)),
    h: Math.max(minH, Math.round(h)),
  };
}

/**
 * Apply persisted user sizes onto a laid result and re-route edges.
 * @returns {object} laid (mutated)
 */
export function applyUserSizes(spec, laid, userSizes) {
  if (!userSizes || !laid) return laid;
  for (const [id, sz] of Object.entries(userSizes)) {
    if (!sz || !(sz.w > 0 || sz.h > 0)) continue;

    const b = laid.boxes?.[id];
    if (b && !b.folded) {
      const { minW, minH } = nodeMinSize(b);
      const next = clampSize(sz.w ?? b.w, sz.h ?? b.h, minW, minH);
      b.w = next.w;
      b.h = next.h;
      b.userSized = true;
      if (b.expandable) {
        if (b.collapsed) {
          b.wCollapsed = next.w;
          // Collapsed face height stays near face; allow slight grow only
          b.hCollapsed = Math.max(minH, Math.min(next.h, Math.max(b.hCollapsed || minH, minH + 24)));
          b.h = b.hCollapsed;
        } else {
          b.hExpanded = next.h;
          b.wExpanded = next.w;
        }
      }
      continue;
    }

    const g = laid.groupBoxes?.[id];
    if (g) {
      const { minW, minH } = groupMinSize(id, g, laid, spec);
      const next = clampSize(sz.w ?? g.w, sz.h ?? (g.collapsed ? g.hCollapsed : g.hExpanded), minW, minH);
      g.w = next.w;
      g.userSized = true;
      if (g.collapsed) {
        g.wCollapsed = next.w;
        g.hCollapsed = Math.max(minH, Math.min(next.h, Math.max(g.hCollapsed || minH, minH + 24)));
        g.h = g.hCollapsed;
      } else {
        g.wExpanded = next.w;
        g.hExpanded = next.h;
        g.h = next.h;
      }
    }
  }

  laid.routes = routeEdges(laid.boxes, spec.edges || [], laid.groupBoxes || {}, {
    mode: edgeRouteMode(spec),
  });
  return laid;
}
