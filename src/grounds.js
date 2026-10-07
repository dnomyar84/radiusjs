/** SVG/CSS grounds — line/geometry/vector, no photos. */

let _patternSeq = 0;

function svgPattern(prefix, content, size = 64) {
  const id = `${prefix}-${++_patternSeq}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" class="radius-ground-svg" aria-hidden="true">
  <defs>
    <pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${content}</pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#${id})"/>
</svg>`;
}

/** Prefer ink-tinted stroke so grounds read on light and dark surfaces. */
function patternStroke(line, ink) {
  if (!ink) return line;
  // Simple mid mix without color-mix() in SVG attributes
  return line;
}

export function groundHTML(ground, tone = 'muted', accent = '#d4a017', line = '#d6d3d1', glows = {}) {
  const op = tone === 'strong' ? 0.9 : 0.62;
  const ink = glows.ink || '#1c1917';
  // Pattern marks need contrast vs surface; plain theme.line is often too faint
  const stroke = glows.pattern || ink;
  const a = accent;
  const g2 = glows.glow2 || '#ff7a18';
  const g3 = glows.glow3 || '#b84dff';

  switch (ground) {
    case 'none':
      return '';
    case 'solid':
      return `<div class="radius-ground radius-ground-solid" style="opacity:${op}"></div>`;
    case 'wash':
      return `<div class="radius-ground radius-ground-wash" style="opacity:${op}"></div>`;
    case 'vignette':
      return `<div class="radius-ground radius-ground-vignette" style="opacity:${op}"></div>`;
    case 'grid':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern('rg', `<path d="M64 0H0V64" fill="none" stroke="${stroke}" stroke-width="1" opacity="0.35"/>`)}</div>`;
    case 'dots':
      // CSS dots — no SVG id collisions when multiple boards share a page
      return `<div class="radius-ground radius-ground-dots" style="opacity:${op}"></div>`;
    case 'hex':
      return hexGroundHTML(stroke, a, op);
    case 'aurora':
      // Full-strength wash — tone only softens slightly
      return auroraGroundHTML(a, g2, g3, glows.glow4, tone === 'muted' ? 0.92 : 1);
    case 'circuit':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rc',
        `<path d="M0 32 H20 M44 32 H64 M32 0 V20 M32 44 V64" stroke="${stroke}" fill="none" stroke-width="1.2" opacity="0.45"/>
         <circle cx="32" cy="32" r="4" fill="none" stroke="${a}" stroke-width="1"/>
         <circle cx="20" cy="32" r="2" fill="${stroke}" opacity="0.5"/>
         <circle cx="44" cy="32" r="2" fill="${stroke}" opacity="0.5"/>`,
      )}</div>`;
    case 'chip':
      return chipGroundHTML(a, g2, g3, op);
    case 'matrix':
      return matrixGroundHTML(tone);
    case 'mesh':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rm',
        `<circle cx="16" cy="16" r="2" fill="${stroke}" opacity="0.45"/><circle cx="48" cy="48" r="2" fill="${stroke}" opacity="0.45"/>
         <path d="M16 16 L48 48 M48 16 L16 48" stroke="${stroke}" stroke-width="0.8" opacity="0.35"/>`,
      )}</div>`;
    case 'roads':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rr',
        `<path d="M0 32 H64 M32 0 V64" stroke="${stroke}" stroke-width="3" fill="none" opacity="0.35"/>
         <path d="M0 32 H64 M32 0 V64" stroke="${a}" stroke-width="0.6" stroke-dasharray="4 6" fill="none"/>`,
      )}</div>`;
    case 'helix':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rx',
        `<path d="M16 0 C32 16 32 48 16 64 M48 0 C32 16 32 48 48 64" fill="none" stroke="${stroke}" stroke-width="1.2" opacity="0.4"/>
         <path d="M20 16 H44 M18 32 H46 M20 48 H44" stroke="${a}" stroke-width="0.8"/>`,
      )}</div>`;
    case 'hatch':
    case 'diagonal':
      return hatchGroundHTML(stroke, op);
    case 'contour':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rco',
        `<path d="M8 48 C20 40 28 28 40 24 C52 20 56 12 60 8" fill="none" stroke="${stroke}" stroke-width="1" opacity="0.4"/>
         <path d="M4 56 C18 50 30 40 42 36 C54 32 58 24 62 18" fill="none" stroke="${stroke}" stroke-width="0.9" opacity="0.35"/>
         <path d="M12 40 C24 34 32 26 44 22 C52 18 56 14 58 10" fill="none" stroke="${a}" stroke-width="0.8" opacity="0.7"/>`,
        64,
      )}</div>`;
    case 'parcels':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rp',
        `<path d="M4 8 H28 V36 H4 Z M28 8 H44 V24 H28 Z M44 8 H60 V40 H44 Z M28 24 H44 V52 H28 Z M4 36 H28 V56 H4 Z M44 40 H60 V56 H44 Z"
          fill="none" stroke="${stroke}" stroke-width="1" opacity="0.4"/>
         <path d="M16 20 H20 M36 14 H40 M50 22 H54" stroke="${a}" stroke-width="1" stroke-linecap="round"/>`,
        64,
      )}</div>`;
    case 'globe':
    case 'globe-horizon':
    case 'globe-corner':
      return globeHTML(ground, stroke, a, op);
    case 'worldmap':
    case 'atlas':
      return worldMapHTML(tone);
    default:
      return `<div class="radius-ground radius-ground-wash" style="opacity:${op}"></div>`;
  }
}

/** Purple → cyan → emerald board wash (indigo theme default). */
function auroraGroundHTML(accent, cyan, violet, emerald, op) {
  const v = violet || '#8b5cf6';
  const c = cyan || '#22d3ee';
  const e = emerald || '#34d399';
  const am = accent || '#fbbf24';
  return `<div class="radius-ground radius-ground-aurora" aria-hidden="true" style="opacity:${op};--aurora-violet:${v};--aurora-cyan:${c};--aurora-emerald:${e};--aurora-amber:${am}"></div>`;
}

/** Soft hex tiling over a dark purple–blue gradient wash. */
function hexGroundHTML(stroke, accent, op) {
  const uid = `hx-${++_patternSeq}`;
  const lineOp = Math.max(0.4, Math.min(0.9, op));
  // Prefer a pale stroke so hexes read on the dark wash
  const line = stroke || '#9eb6e8';
  return `<div class="radius-ground radius-ground-hex" aria-hidden="true">
    <div class="radius-hex-wash"></div>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" class="radius-ground-svg radius-hex-lines" style="opacity:${lineOp}">
      <defs>
        <pattern id="${uid}" width="56" height="64" patternUnits="userSpaceOnUse">
          <path d="M28 2 L50 15 V41 L28 54 L6 41 V15 Z" fill="none" stroke="${line}" stroke-width="1" opacity="0.42"/>
          <path d="M28 2 L50 15 V41 L28 54 L6 41 V15 Z" transform="translate(28,32)" fill="none" stroke="${line}" stroke-width="1" opacity="0.28"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#${uid})"/>
    </svg>
  </div>`;
}

/** Soft diagonal hatch over a board-wide gradient wash. */
function hatchGroundHTML(stroke, op) {
  const uid = `ht-${++_patternSeq}`;
  // Wide tile so lines read as sparse diagonals, not dense zebra
  const tile = 28;
  // Keep gradient at full strength; only mute the hatch strokes
  const lineOp = Math.max(0.35, Math.min(0.85, op));
  return `<div class="radius-ground radius-ground-hatch" aria-hidden="true">
    <div class="radius-hatch-wash"></div>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" class="radius-ground-svg radius-hatch-lines" style="opacity:${lineOp}">
      <defs>
        <pattern id="${uid}" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
          <line x1="0" y1="0" x2="0" y2="${tile}" stroke="${stroke}" stroke-width="1" opacity="0.28"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#${uid})"/>
    </svg>
  </div>`;
}

/** Matrix rain — full-bleed black → green wash + tiled glyph columns. */
function matrixGroundHTML(tone = 'muted') {
  const uid = `mx-${++_patternSeq}`;
  const rainOp = tone === 'strong' ? 0.55 : 0.4;
  // One tile: vertical code columns (0/1) that repeat across the board
  const cols = [
    { x: 6, chars: '01001101', bright: 0 },
    { x: 22, chars: '10110010', bright: 3 },
    { x: 38, chars: '11010110', bright: 5 },
    { x: 54, chars: '00101101', bright: 1 },
    { x: 70, chars: '11100010', bright: 6 },
    { x: 86, chars: '01011011', bright: 2 },
  ];
  let glyphs = '';
  for (const c of cols) {
    for (let i = 0; i < c.chars.length; i++) {
      const y = 12 + i * 14;
      const head = i === c.bright;
      const near = Math.abs(i - c.bright) <= 1;
      const fill = head ? '#6dff9a' : near ? '#1f9a4a' : '#0d4a28';
      const op = head ? 0.55 : near ? 0.32 : 0.14 + (i % 3) * 0.03;
      glyphs += `<text x="${c.x}" y="${y}" fill="${fill}" fill-opacity="${op}" font-size="11" font-family="ui-monospace,Consolas,monospace">${c.chars[i]}</text>`;
    }
  }
  return `<div class="radius-ground radius-ground-matrix" aria-hidden="true">
    <div class="radius-matrix-wash"></div>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" class="radius-ground-svg radius-matrix-rain" style="opacity:${rainOp}">
      <defs>
        <pattern id="${uid}" width="100" height="120" patternUnits="userSpaceOnUse">${glyphs}</pattern>
        <linearGradient id="${uid}-veil" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.55"/>
          <stop offset="55%" stop-color="#020805" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#041a0c" stop-opacity="0.35"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#${uid})"/>
      <rect width="100%" height="100%" fill="url(#${uid}-veil)"/>
    </svg>
  </div>`;
}

/** Glowing energy / electricity field — no chip plate. */
function chipGroundHTML(cyan, amber, violet, op) {
  const uid = `chip-${++_patternSeq}`;
  const arcs = `
    <defs>
      <filter id="${uid}-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="${uid}-bloom" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <linearGradient id="${uid}-bus" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${cyan}" stop-opacity="0"/>
        <stop offset="35%" stop-color="${cyan}" stop-opacity="1"/>
        <stop offset="65%" stop-color="${violet}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${amber}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- soft ambient haze -->
    <g opacity="0.35" filter="url(#${uid}-bloom)">
      <path d="M0 180 Q160 40 320 180 T640 180" fill="none" stroke="${cyan}" stroke-width="14"/>
      <path d="M0 220 Q200 340 400 200 T640 240" fill="none" stroke="${violet}" stroke-width="12"/>
    </g>
    <!-- main power buses -->
    <g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#${uid}-glow)">
      <path d="M0 90 H640" stroke="url(#${uid}-bus)" stroke-width="1.6" opacity="0.85"/>
      <path d="M0 270 H640" stroke="url(#${uid}-bus)" stroke-width="1.4" opacity="0.7"/>
      <path d="M120 0 V360" stroke="${cyan}" stroke-width="1.1" opacity="0.45"/>
      <path d="M320 0 V360" stroke="${violet}" stroke-width="1.1" opacity="0.4"/>
      <path d="M520 0 V360" stroke="${amber}" stroke-width="1.1" opacity="0.45"/>
    </g>
    <!-- lightning forks / energy arcs -->
    <g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#${uid}-glow)" opacity="0.95">
      <path d="M40 40 L90 70 L70 110 L130 150 L110 200 L180 240 L160 300 L220 340"
        stroke="${cyan}" stroke-width="1.8"/>
      <path d="M90 70 L140 50 L170 90" stroke="${cyan}" stroke-width="1.2" opacity="0.8"/>
      <path d="M130 150 L190 130 L210 170" stroke="${violet}" stroke-width="1.2"/>
      <path d="M600 30 L540 80 L570 120 L500 170 L530 220 L450 270 L480 320 L400 350"
        stroke="${amber}" stroke-width="1.8"/>
      <path d="M540 80 L500 55 L470 95" stroke="${amber}" stroke-width="1.2"/>
      <path d="M500 170 L440 150 L420 190" stroke="${violet}" stroke-width="1.2"/>
      <path d="M280 20 L300 80 L270 120 L310 170 L280 220 L330 270 L300 320"
        stroke="${violet}" stroke-width="1.5"/>
      <path d="M300 80 L350 60 L360 100" stroke="${cyan}" stroke-width="1.1"/>
      <path d="M310 170 L370 155 L380 195" stroke="${amber}" stroke-width="1.1"/>
      <path d="M20 300 L80 260 L140 290 L200 250 L260 285 L340 245 L420 290 L500 255 L580 300 L620 270"
        stroke="${cyan}" stroke-width="1.35" opacity="0.85"/>
      <path d="M80 260 L100 220 L150 230" stroke="${violet}" stroke-width="1"/>
      <path d="M200 250 L230 210 L270 240" stroke="${amber}" stroke-width="1"/>
      <path d="M420 290 L450 250 L490 275" stroke="${violet}" stroke-width="1"/>
    </g>
    <!-- junction sparks -->
    <g filter="url(#${uid}-bloom)">
      <circle cx="90" cy="70" r="3" fill="${cyan}"/>
      <circle cx="130" cy="150" r="2.5" fill="${violet}"/>
      <circle cx="180" cy="240" r="3" fill="${cyan}"/>
      <circle cx="300" cy="80" r="2.5" fill="${violet}"/>
      <circle cx="310" cy="170" r="3" fill="${amber}"/>
      <circle cx="540" cy="80" r="3" fill="${amber}"/>
      <circle cx="500" cy="170" r="2.5" fill="${violet}"/>
      <circle cx="450" cy="270" r="3" fill="${amber}"/>
      <circle cx="200" cy="250" r="2.5" fill="${cyan}"/>
      <circle cx="420" cy="290" r="2.5" fill="${violet}"/>
      <circle cx="320" cy="180" r="4" fill="${cyan}" opacity="0.7"/>
    </g>
    <!-- dashed current ticks -->
    <g fill="none" stroke-dasharray="3 10" opacity="0.55">
      <path d="M0 90 H640" stroke="${cyan}" stroke-width="0.7"/>
      <path d="M0 270 H640" stroke="${amber}" stroke-width="0.7"/>
    </g>
  `;
  return `<div class="radius-ground radius-ground-chip" style="opacity:${op}">
    <div class="radius-chip-glow"></div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${arcs}</svg>
  </div>`;
}

function globeHTML(mode, stroke, accent, op) {
  const globe = `
    <circle cx="100" cy="100" r="72" fill="none" stroke="${stroke}" stroke-width="1.2"/>
    <ellipse cx="100" cy="100" rx="28" ry="72" fill="none" stroke="${stroke}" stroke-width="0.8"/>
    <ellipse cx="100" cy="100" rx="72" ry="22" fill="none" stroke="${stroke}" stroke-width="0.8"/>
    <path d="M40 90 C60 70 90 75 110 85 C130 95 150 80 168 95" fill="none" stroke="${accent}" stroke-width="1" opacity="0.7"/>
    <path d="M55 120 C80 110 120 125 150 115" fill="none" stroke="${accent}" stroke-width="1" opacity="0.5"/>
  `;
  let style = 'inset:0;';
  let view = '0 0 200 200';
  if (mode === 'globe-horizon') {
    style = 'left:0;right:0;bottom:-20%;height:55%;';
  } else if (mode === 'globe-corner') {
    style = 'right:4%;bottom:4%;width:28%;height:36%;';
  }
  return `<div class="radius-ground radius-ground-globe" style="opacity:${op};${style}">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${globe}</svg>
  </div>`;
}

/** Subtle world map — ocean wash + lat/lon grid + real landmass SVG (masked). */
function worldMapHTML(tone = 'muted') {
  const uid = `wm-${++_patternSeq}`;
  const mapOp = tone === 'strong' ? 0.55 : 0.38;
  let mapHref = '';
  try {
    mapHref = new URL('../dist/worldmap.svg', import.meta.url).href;
  } catch {
    mapHref = './worldmap.svg';
  }
  let grid = '';
  for (let i = 1; i < 12; i++) {
    const x = (640 / 12) * i;
    grid += `<line x1="${x}" y1="0" x2="${x}" y2="360" stroke="#7b8fd4" stroke-width="0.6" opacity="${i % 3 === 0 ? 0.28 : 0.14}"/>`;
  }
  for (let j = 1; j < 8; j++) {
    const y = (360 / 8) * j;
    grid += `<line x1="0" y1="${y}" x2="640" y2="${y}" stroke="#8b7ec8" stroke-width="0.6" opacity="${j === 4 ? 0.32 : 0.14}"/>`;
  }
  return `<div class="radius-ground radius-ground-worldmap" aria-hidden="true">
    <div class="radius-worldmap-wash"></div>
    <div class="radius-worldmap-land" style="opacity:${mapOp};-webkit-mask-image:url('${mapHref}');mask-image:url('${mapHref}');"></div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" class="radius-worldmap-svg">
      <g fill="none">${grid}</g>
    </svg>
  </div>`;
}
