/** SVG/CSS grounds — line/geometry/vector, no photos. */

function svgPattern(id, content, size = 64) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" class="radius-ground-svg">
  <defs>
    <pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse">${content}</pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#${id})" opacity="0.55"/>
</svg>`;
}

export function groundHTML(ground, tone = 'muted', accent = '#d4a017', line = '#d6d3d1', glows = {}) {
  const op = tone === 'strong' ? 0.85 : 0.45;
  const stroke = line;
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
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern('rg', `<path d="M64 0H0V64" fill="none" stroke="${stroke}" stroke-width="1"/>`)}</div>`;
    case 'dots':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern('rd', `<circle cx="8" cy="8" r="1.2" fill="${stroke}"/>`)}</div>`;
    case 'hex':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rh',
        `<path d="M32 4 L56 18 V46 L32 60 L8 46 V18 Z" fill="none" stroke="${stroke}" stroke-width="1"/>`,
        56,
      )}</div>`;
    case 'circuit':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rc',
        `<path d="M0 32 H20 M44 32 H64 M32 0 V20 M32 44 V64" stroke="${stroke}" fill="none" stroke-width="1.2"/>
         <circle cx="32" cy="32" r="4" fill="none" stroke="${a}" stroke-width="1"/>
         <circle cx="20" cy="32" r="2" fill="${stroke}"/>
         <circle cx="44" cy="32" r="2" fill="${stroke}"/>`,
      )}</div>`;
    case 'chip':
      return chipGroundHTML(a, g2, g3, op);
    case 'matrix':
      return `<div class="radius-ground radius-ground-matrix" style="opacity:${op}" data-accent="${a}"></div>`;
    case 'mesh':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rm',
        `<circle cx="16" cy="16" r="2" fill="${stroke}"/><circle cx="48" cy="48" r="2" fill="${stroke}"/>
         <path d="M16 16 L48 48 M48 16 L16 48" stroke="${stroke}" stroke-width="0.8"/>`,
      )}</div>`;
    case 'roads':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rr',
        `<path d="M0 32 H64 M32 0 V64" stroke="${stroke}" stroke-width="3" fill="none"/>
         <path d="M0 32 H64 M32 0 V64" stroke="${a}" stroke-width="0.6" stroke-dasharray="4 6" fill="none"/>`,
      )}</div>`;
    case 'helix':
      return `<div class="radius-ground" style="opacity:${op}">${svgPattern(
        'rx',
        `<path d="M16 0 C32 16 32 48 16 64 M48 0 C32 16 32 48 48 64" fill="none" stroke="${stroke}" stroke-width="1.2"/>
         <path d="M20 16 H44 M18 32 H46 M20 48 H44" stroke="${a}" stroke-width="0.8"/>`,
      )}</div>`;
    case 'globe':
    case 'globe-horizon':
    case 'globe-corner':
      return globeHTML(ground, stroke, a, op);
    default:
      return `<div class="radius-ground radius-ground-wash" style="opacity:${op}"></div>`;
  }
}

/** Isometric CPU + converging neon traces (AI-infographic staple). */
function chipGroundHTML(cyan, amber, violet, op) {
  const traces = `
    <g opacity="0.9" stroke-linecap="round" stroke-linejoin="round" fill="none">
      <path d="M40 280 L180 200 L260 200" stroke="${cyan}" stroke-width="1.4"/>
      <path d="M60 40 L200 120 L260 120" stroke="${violet}" stroke-width="1.2"/>
      <path d="M560 40 L420 130 L340 130" stroke="${amber}" stroke-width="1.3"/>
      <path d="M580 300 L430 220 L340 220" stroke="${cyan}" stroke-width="1.2"/>
      <path d="M20 160 L160 160 L220 180" stroke="${amber}" stroke-width="1"/>
      <path d="M600 160 L460 160 L380 180" stroke="${violet}" stroke-width="1"/>
      <path d="M120 320 L220 240 L260 240" stroke="${violet}" stroke-width="1"/>
      <path d="M500 320 L400 250 L340 250" stroke="${amber}" stroke-width="1"/>
      <path d="M300 20 L300 100 L310 110" stroke="${cyan}" stroke-width="1.1"/>
      <path d="M320 340 L320 270" stroke="${violet}" stroke-width="1.1"/>
      <circle cx="180" cy="200" r="2.5" fill="${cyan}"/>
      <circle cx="200" cy="120" r="2.5" fill="${violet}"/>
      <circle cx="420" cy="130" r="2.5" fill="${amber}"/>
      <circle cx="430" cy="220" r="2.5" fill="${cyan}"/>
      <circle cx="160" cy="160" r="2" fill="${amber}"/>
      <circle cx="460" cy="160" r="2" fill="${violet}"/>
    </g>
    <g transform="translate(248 128)">
      <defs>
        <linearGradient id="chipFace" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1a2340"/>
          <stop offset="100%" stop-color="#0a0e1c"/>
        </linearGradient>
        <filter id="chipGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <!-- 2.5D isometric plate -->
      <g filter="url(#chipGlow)">
        <path d="M40 20 L120 0 L200 20 L120 40 Z" fill="${cyan}" opacity="0.25"/>
        <path d="M40 20 L40 70 L120 90 L120 40 Z" fill="${violet}" opacity="0.2"/>
        <path d="M120 40 L120 90 L200 70 L200 20 Z" fill="${amber}" opacity="0.18"/>
        <path d="M48 28 L120 12 L184 28 L120 44 Z" fill="url(#chipFace)" stroke="${cyan}" stroke-width="1.2"/>
        <rect x="88" y="22" width="64" height="40" rx="3" transform="skewX(-18) translate(18,0)"
          fill="#060814" stroke="${amber}" stroke-width="1"/>
        <path d="M95 30 h12 m8 0 h12 m8 0 h12 M95 38 h12 m8 0 h12 m8 0 h12 M95 46 h12 m8 0 h12 m8 0 h12"
          stroke="${cyan}" stroke-width="1.4" opacity="0.9"/>
        <circle cx="120" cy="28" r="18" fill="${cyan}" opacity="0.12"/>
        <circle cx="100" cy="36" r="22" fill="${violet}" opacity="0.1"/>
        <circle cx="140" cy="36" r="20" fill="${amber}" opacity="0.1"/>
      </g>
    </g>
  `;
  return `<div class="radius-ground radius-ground-chip" style="opacity:${op}">
    <div class="radius-chip-glow"></div>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">${traces}</svg>
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
