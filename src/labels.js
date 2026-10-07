/**
 * Label packing ladder:
 *   1) single line + stretch box horizontally up to maxBoxW
 *   2) only after max width is hit: wrap at full font (if height allows)
 *   3) shrink font, still single line
 *   4) shrink font with wrap
 *   5) ellipsis
 * Agents never set font-size; IR keeps the full string.
 */

export const LABEL_MAX_PX = 14; // under-icon caption (pack shrinks toward min when tight)
export const LABEL_MIN_PX = 9;
export const DEFAULT_MAX_LINES = 2;
/** Preferred face width ceiling — stretch here before wrapping. */
export const LABEL_GROW_MAX_W = 200;
/** Glyph face — AWS-style icon above centered label. */
export const ICON_FACE = 48;
/** Smallest glyph tile when the pack slot is very tight. */
export const ICON_MIN = 24;
/**
 * Slot width at which the glyph stays full-size. Narrower slots scale the
 * icon (and therefore the face) so deep nested children honour parent width.
 */
export const ICON_PREFER_W = 110;
/** Collapsed / text-only element face (no icon). */
export const FACE_W = 100;
export const FACE_H = 52;

/** Scale icon to the available face width (never above ICON_FACE). */
export function iconSizeForWidth(maxBoxW, base = ICON_FACE) {
  const budget = Math.max(32, Number(maxBoxW) || ICON_PREFER_W);
  const t = Math.min(1, budget / ICON_PREFER_W);
  return Math.max(ICON_MIN, Math.min(base, Math.round(base * t)));
}

/** Approx glyph width (Node + browser without canvas). */
export function approxTextWidth(text, fontPx = LABEL_MAX_PX) {
  const s = String(text ?? '');
  let units = 0;
  for (const ch of s) {
    if (ch === ' ') units += 0.33;
    else if (/[ilI1|'`,.]/.test(ch)) units += 0.45;
    else if (/[mwMW@%]/.test(ch)) units += 1.15;
    else if (ch.charCodeAt(0) > 127) units += 1.05;
    else units += 0.72;
  }
  return units * fontPx;
}

/**
 * Fit label into a box.
 * Priority: stretch horizontally (one line) → wrap after max width → shrink → ellipsis.
 * @returns {{ w, h, fontPx, lines, display, truncated, full }}
 */
export function fitLabel(full, opts = {}) {
  const text = String(full ?? '').replace(/\s+/g, ' ').trim();
  const maxBoxW = opts.maxBoxW ?? LABEL_GROW_MAX_W;
  const minBoxW = opts.minBoxW ?? 120;
  const minBoxH = opts.minBoxH ?? FACE_H;
  const maxBoxH = opts.maxBoxH ?? 120;
  const pad = opts.pad ?? 56; // horizontal chrome (padding + chip + chevron)
  const maxLines = Math.max(1, opts.maxLines ?? DEFAULT_MAX_LINES);
  const minPx = opts.minPx ?? LABEL_MIN_PX;
  const maxPx = opts.maxPx ?? LABEL_MAX_PX;
  const lineH = opts.lineH ?? 1.25;
  const textMaxW = Math.max(40, maxBoxW - pad);

  if (!text) {
    return {
      w: minBoxW,
      h: minBoxH,
      fontPx: maxPx,
      lines: [''],
      display: '',
      truncated: false,
      full: '',
    };
  }

  const textBlockH = (lines, fontPx) =>
    Math.ceil(lines.length * fontPx * lineH) + 24;

  const boxH = (lines, fontPx) =>
    Math.max(minBoxH, Math.min(maxBoxH, textBlockH(lines, fontPx)));

  const boxW = (lines, fontPx) => {
    const tw = Math.max(...lines.map((l) => approxTextWidth(l.replace(/…$/u, ''), fontPx)));
    return Math.min(maxBoxW, Math.max(minBoxW, Math.ceil(tw + pad)));
  };

  /** Wrap only after horizontal max is exhausted; keep box at maxBoxW. */
  const tryWrap = (fontPx) => {
    if (maxLines <= 1) return null;
    const lines = wrapWords(text, textMaxW, fontPx, maxLines);
    const complete = joinedLength(lines) >= text.length;
    const overflow = linesOverflow(lines, textMaxW, fontPx);
    if (!complete || overflow) return null;
    if (textBlockH(lines, fontPx) > maxBoxH) return null; // not enough vertical room
    return {
      w: maxBoxW,
      h: boxH(lines, fontPx),
      fontPx,
      lines,
      display: lines.join('\n'),
      truncated: false,
      full: text,
    };
  };

  // --- 1) Single line at max font; stretch width up to maxBoxW ---
  {
    const fontPx = maxPx;
    const need = approxTextWidth(text, fontPx);
    if (need <= textMaxW) {
      const lines = [text];
      return {
        w: boxW(lines, fontPx),
        h: boxH(lines, fontPx),
        fontPx,
        lines,
        display: text,
        truncated: false,
        full: text,
      };
    }
  }

  // --- 2) Max width hit → wrap at full font when height allows ---
  {
    const wrapped = tryWrap(maxPx);
    if (wrapped) return wrapped;
  }

  // --- 3) Shrink font, still single line (still at maxBoxW) ---
  for (let fontPx = maxPx - 1; fontPx >= minPx; fontPx -= 1) {
    const need = approxTextWidth(text, fontPx);
    if (need <= textMaxW) {
      const lines = [text];
      return {
        w: maxBoxW,
        h: boxH(lines, fontPx),
        fontPx,
        lines,
        display: text,
        truncated: false,
        full: text,
      };
    }
  }

  // --- 4) Wrap + shrink font ---
  for (let fontPx = maxPx - 1; fontPx >= minPx; fontPx -= 1) {
    const wrapped = tryWrap(fontPx);
    if (wrapped) return wrapped;
  }

  // --- 5) Ellipsis ---
  {
    const fontPx = minPx;
    const lines = ellipsizeLines(text, textMaxW, fontPx, maxLines);
    return {
      w: maxBoxW,
      h: boxH(lines, fontPx),
      fontPx,
      lines,
      display: lines.join('\n'),
      truncated: true,
      full: text,
    };
  }
}

function joinedLength(lines) {
  return lines.join(' ').replace(/…$/u, '').replace(/\s+/g, ' ').trim().length;
}

function linesOverflow(lines, maxW, fontPx) {
  return lines.some((l) => approxTextWidth(l.replace(/…$/u, ''), fontPx) > maxW + 1);
}

function wrapWords(text, maxW, fontPx, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (!words.length) return [''];
  // Prefer keeping on one line when the whole string fits
  if (approxTextWidth(text, fontPx) <= maxW) return [text];

  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (approxTextWidth(next, fontPx) <= maxW) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      if (lines.length >= maxLines) {
        // remainder discarded; ellipsis pass will mark truncated
        return lines;
      }
      cur = w;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines.length ? lines : [words[0]];
}

function ellipsizeLines(text, maxW, fontPx, maxLines) {
  if (maxLines <= 1 || approxTextWidth(text, fontPx) <= maxW) {
    const budget = maxW - approxTextWidth('…', fontPx);
    let cut = text;
    while (cut.length > 1 && approxTextWidth(cut, fontPx) > budget) {
      cut = cut.slice(0, -1);
    }
    return [`${cut.trimEnd()}…`];
  }

  const lines = wrapWords(text, maxW, fontPx, maxLines);
  const fullLen = text.length;
  if (joinedLength(lines) >= fullLen && !linesOverflow(lines, maxW, fontPx)) {
    return lines;
  }
  const last = lines[lines.length - 1] || '';
  const budget = maxW - approxTextWidth('…', fontPx);
  let cut = last.replace(/…$/u, '');
  while (cut.length > 1 && approxTextWidth(cut, fontPx) > budget) {
    cut = cut.slice(0, -1);
  }
  lines[lines.length - 1] = `${cut.trimEnd()}…`;
  return lines;
}

/**
 * Node box size.
 * - With `kind`: glyph column (icon + caption under it).
 * - Without: compact text card (timeline milestones, plain labels) — wrap, no icon room.
 */
export function measureNode(node, opts = {}) {
  const maxLines = node.maxLines != null ? Number(node.maxLines) : DEFAULT_MAX_LINES;
  const hasKind = !!(node.kind || opts.forceIcon);

  if (!hasKind) {
    // Prefer stretching one line up to LABEL_GROW_MAX_W before wrapping
    const maxBoxW = opts.maxBoxW ?? LABEL_GROW_MAX_W;
    const fit = fitLabel(node.label || node.id, {
      pad: 20,
      maxLines,
      minBoxW: Math.min(72, maxBoxW),
      minBoxH: 40,
      maxBoxW,
      maxBoxH: 72,
      maxPx: opts.maxPx ?? 15,
      minPx: opts.minPx ?? 10,
      lineH: 1.25,
    });
    const labelH = Math.ceil((fit.lines?.length || 1) * fit.fontPx * 1.25) + 20;
    return {
      ...fit,
      w: fit.w,
      h: Math.max(40, Math.min(72, labelH)),
      glyph: false,
    };
  }

  const maxBoxW = Math.max(32, opts.maxBoxW ?? LABEL_GROW_MAX_W);
  // Shrink logo with the slot — fixed 48px tiles ignore nested parent width.
  const icon = iconSizeForWidth(maxBoxW, opts.icon ?? ICON_FACE);
  const gap = 6;
  const padY = 14; // face padding top+bottom — must match CSS
  const fit = fitLabel(node.label || node.id, {
    pad: 8,
    maxLines,
    minBoxW: Math.min(icon + 8, maxBoxW),
    minBoxH: 22,
    maxBoxW,
    maxBoxH: 56,
    maxPx: opts.maxPx ?? LABEL_MAX_PX,
    minPx: opts.minPx ?? LABEL_MIN_PX,
    lineH: 1.25,
  });
  const labelH = Math.max(
    22,
    Math.ceil((fit.lines?.length || 1) * fit.fontPx * 1.25) + 4,
  );
  return {
    ...fit,
    // Never claim wider than the slot we were asked to fit.
    w: Math.min(maxBoxW, Math.max(icon + 12, fit.w)),
    h: padY + icon + gap + labelH,
    glyph: true,
    icon,
  };
}

export function measureFace(label, kind, opts = {}) {
  // Collapsed group / header faces: compact horizontal chip+label (not glyph column).
  // Pass maxBoxW = available group width so captions stay one line when the region is wide.
  const maxBoxW = opts.maxBoxW ?? Math.max(FACE_W + 100, LABEL_GROW_MAX_W);
  const text = opts.uppercase ? String(label ?? '').toUpperCase() : label;
  const minBoxH = opts.minBoxH ?? FACE_H;
  const fit = fitLabel(text, {
    pad: opts.pad ?? (kind ? 52 : 28),
    maxLines: opts.maxLines ?? 2,
    minBoxW: Math.min(FACE_W, maxBoxW),
    minBoxH,
    maxBoxW,
    maxBoxH: opts.maxBoxH ?? FACE_H + 20,
    maxPx: opts.maxPx ?? 14,
    minPx: opts.minPx ?? 10,
    lineH: opts.lineH ?? 1.25,
  });
  return { ...fit, w: fit.w, h: Math.max(minBoxH, fit.h), glyph: false };
}
