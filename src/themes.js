/** Theme tokens — board look. Kind chips keep family colors on top. */
export const THEMES = {
  paper: {
    surface: '#f7f4ef',
    surface2: '#efe9e0',
    ink: '#1c1917',
    muted: '#78716c',
    accent: '#d4a017',
    line: '#d6d3d1',
    card: '#fffcf7',
    shadow: 'rgba(28, 25, 23, 0.12)',
  },
  night: {
    surface: '#0c0f14',
    surface2: '#151a22',
    ink: '#e7ecf3',
    muted: '#9aa3b2',
    accent: '#e0b43a',
    line: '#2a3340',
    card: '#121821',
    shadow: 'rgba(0, 0, 0, 0.45)',
  },
  /**
   * Indigo — dark purple→green architecture void (verified eGIS / pilot boards).
   * Default ground: aurora. Amber accent; cyan / violet / emerald glows.
   */
  indigo: {
    surface: '#0a0c18',
    surface2: '#12102a',
    ink: '#f1f5f9',
    muted: '#a5b4c8',
    accent: '#fbbf24',
    glow2: '#22d3ee',
    glow3: '#8b5cf6',
    glow4: '#34d399',
    line: '#3d3a68',
    card: '#1c1a34',
    shadow: 'rgba(26, 20, 60, 0.5)',
  },
  ios: {
    surface: '#f2f2f7',
    surface2: '#e5e5ea',
    ink: '#1c1c1e',
    muted: '#8e8e93',
    accent: '#007aff',
    line: '#c7c7cc',
    card: '#ffffff',
    shadow: 'rgba(0, 0, 0, 0.08)',
  },
  material: {
    surface: '#f7f2fa',
    surface2: '#ebe4f0',
    ink: '#1d1b20',
    muted: '#79747e',
    accent: '#6750a4',
    line: '#cac4d0',
    card: '#fffbfe',
    shadow: 'rgba(29, 27, 32, 0.14)',
  },
  esri: {
    surface: '#f4efe6',
    surface2: '#e8e0d2',
    ink: '#1b2a34',
    muted: '#6b7c86',
    accent: '#c4a35a',
    line: '#cfc4b2',
    card: '#fffaf2',
    shadow: 'rgba(27, 42, 52, 0.12)',
  },
  aws: {
    surface: '#161d26',
    surface2: '#1f2a37',
    ink: '#f0f3f7',
    muted: '#9db0c3',
    accent: '#ff9900',
    line: '#2f3d4d',
    card: '#1a2430',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
  azure: {
    surface: '#f3f8fc',
    surface2: '#e6eef6',
    ink: '#16253a',
    muted: '#5b6b7c',
    accent: '#0078d4',
    line: '#c5d3e0',
    card: '#ffffff',
    shadow: 'rgba(22, 37, 58, 0.12)',
  },
  gcp: {
    surface: '#f8fafb',
    surface2: '#eef2f5',
    ink: '#202124',
    muted: '#5f6368',
    accent: '#1a73e8',
    line: '#dadce0',
    card: '#ffffff',
    shadow: 'rgba(32, 33, 36, 0.12)',
  },
  oci: {
    surface: '#1a1514',
    surface2: '#26201e',
    ink: '#f5ebe8',
    muted: '#b5a09a',
    accent: '#c74634',
    line: '#3a302d',
    card: '#211b19',
    shadow: 'rgba(0, 0, 0, 0.45)',
  },
  k8s: {
    surface: '#f4f7fb',
    surface2: '#e8eef6',
    ink: '#1a2740',
    muted: '#5c6b82',
    accent: '#326ce5',
    line: '#c5d0e0',
    card: '#ffffff',
    shadow: 'rgba(26, 39, 64, 0.12)',
  },
  nutanix: {
    surface: '#f2f6f8',
    surface2: '#e4ebee',
    ink: '#15232b',
    muted: '#5d707a',
    accent: '#1a7a9c',
    line: '#c5d3d9',
    card: '#ffffff',
    shadow: 'rgba(21, 35, 43, 0.12)',
  },
  /**
   * Neon isometric tech — the common “AI infographic” look:
   * dark void, CPU/chip focal glow (cyan + amber + violet),
   * converging circuitry, neon strokes, 2.5D perspective.
   * Also known as cyber-neon / isometric HUD / synthwave circuit.
   */
  neon: {
    surface: '#07060f',
    surface2: '#0e0b1c',
    ink: '#e8f7ff',
    muted: '#8eb6d4',
    accent: '#2de2e6',
    glow2: '#ff7a18',
    glow3: '#b84dff',
    line: '#1c3a55',
    card: '#101228',
    shadow: 'rgba(45, 226, 230, 0.35)',
  },
};

export const THEME_IDS = Object.keys(THEMES);

export function resolveTheme(id) {
  return THEMES[id] || THEMES.paper;
}
