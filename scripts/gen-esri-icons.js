/** Generate MIT-original Esri-family chip icons → assets/esri + dist/icons/esri */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = [path.join(root, 'assets/esri'), path.join(root, 'dist/icons/esri')];

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>\n`;
}

const icons = {
  portal:
    '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/><circle cx="12" cy="12.5" r="1.2" fill="#fff" stroke="none"/>',
  map: '<path d="M4 6.5l5-1.5 6 1.5 5-1.5v13l-5 1.5-6-1.5-5 1.5z"/><path d="M9 5v13M15 6.5v13"/>',
  agol: '<path d="M6 15a6 6 0 1 1 11.2-3"/><path d="M7 18h11a3 3 0 0 0 0-6h-.4"/><circle cx="12" cy="10" r="1.4" fill="#fff" stroke="none"/>',
  gdb: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v8c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 10c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  feature:
    '<path d="M4 16l5-8 4 5 3-4 4 7"/><circle cx="9" cy="8" r="1.3" fill="#fff" stroke="none"/><circle cx="13" cy="13" r="1.3" fill="#fff" stroke="none"/><circle cx="16" cy="9" r="1.3" fill="#fff" stroke="none"/>',
  scene: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  notebook: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  server:
    '<rect x="4" y="3.5" width="16" height="5" rx="1"/><rect x="4" y="9.5" width="16" height="5" rx="1"/><rect x="4" y="15.5" width="16" height="5" rx="1"/><circle cx="7" cy="6" r="0.8" fill="#fff" stroke="none"/><circle cx="7" cy="12" r="0.8" fill="#fff" stroke="none"/><circle cx="7" cy="18" r="0.8" fill="#fff" stroke="none"/>',
  datastore: '<path d="M4 7h16v3H4zM4 12h16v3H4zM4 17h16v3H4z"/><path d="M7 8.5h2M7 13.5h2M7 18.5h2"/>',
  experience: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M3.5 9h17M7 5v4"/>',
  enterprise:
    '<path d="M5 20V6.5L12 3l7 3.5V20"/><path d="M9 20v-5h6v5M9 10h1.5M13.5 10H15M9 13h1.5M13.5 13H15"/>',
  manager:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6"/>',
  identity:
    '<path d="M12 3.5l7 3v5.2c0 4.2-2.9 7.1-7 8.8-4.1-1.7-7-4.6-7-8.8V6.5l7-3z"/><path d="M10 12l1.5 1.5L14.5 10"/>',
  relational:
    '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 9h16M4 13h16M4 17h16M9 5v14M15 5v14"/>',
  spatiotemporal:
    '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/><path d="M5 12h1.5M17.5 12H19M12 5v1.5M12 17.5V19"/>',
  objectstore: '<path d="M8 8h8v8H8z"/><path d="M10 6h8v8M6 10h8v8"/>',
  raster:
    '<path d="M5 5h4v4H5zM10 5h4v4h-4zM15 5h4v4h-4zM5 10h4v4H5zM10 10h4v4h-4zM15 10h4v4h-4zM5 15h4v4H5zM10 15h4v4h-4zM15 15h4v4h-4z"/>',
  gp: '<circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><circle cx="12" cy="17" r="2.5"/><path d="M9 8.5l2 6.5M15 8.5l-2 6.5M9.5 7h5"/>',
  webadaptor:
    '<rect x="3.5" y="8" width="7" height="8" rx="1"/><rect x="13.5" y="8" width="7" height="8" rx="1"/><path d="M10.5 12h3"/>',
  tilecache: '<path d="M4 8l4-3 4 3-4 3zM12 8l4-3 4 3-4 3zM8 14l4-3 4 3-4 3zM4 14l4-3 4 3-4 3z"/>',
  geoevent: '<path d="M3 12h4l2-5 3 10 3-7 2 2h4"/>',
  geoanalytics: '<path d="M5 19V10M10 19V6M15 19v-8M20 19V8"/><path d="M4 19h17"/>',
  image:
    '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><circle cx="9" cy="10" r="1.6"/><path d="M3.5 16l4.5-4 3.5 3 3-2.5 6 3.5"/>',
  mission:
    '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
  knowledge:
    '<circle cx="7" cy="8" r="2"/><circle cx="17" cy="8" r="2"/><circle cx="12" cy="17" r="2"/><path d="M8.8 9.2l6.4 0M8.5 9.8l2.5 5.2M15.5 9.8l-2.5 5.2"/>',
  workflow:
    '<rect x="3.5" y="9" width="5" height="6" rx="1"/><rect x="9.5" y="9" width="5" height="6" rx="1"/><rect x="15.5" y="9" width="5" height="6" rx="1"/><path d="M8.5 12h1M14.5 12h1"/>',
  hosting: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
  lb: '<path d="M4 12h6M14 7h6M14 17h6M10 12l4-5M10 12l4 5"/>',
  esri: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.8 2.5 13.2 0 16M12 4c-2.5 2.8-2.5 13.2 0 16"/>',
};

for (const dir of dirs) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(icons)) {
    fs.writeFileSync(path.join(dir, `${name}.svg`), svg(body));
  }
}

fs.writeFileSync(
  path.join(root, 'assets/esri/README.md'),
  `# Esri-family icons (Radius)

MIT-original product-role glyphs for \`esri.*\` kinds. **Not** Esri / ArcGIS trademark artwork.

- Chip background uses family blue \`#0079c1\`; glyphs are white strokes.
- Runtime copies live in \`dist/icons/esri/\`.
- To overlay a licensed Esri icon pack later: replace files here (same filenames), run
  \`node scripts/gen-esri-icons.js\` (or copy into \`dist/icons/esri/\`), or retarget \`src/icons.js\`.

Filenames match the kind leaf (\`esri.portal\` → \`portal.svg\`). Fallback glyph: \`esri.svg\`.
`,
);

console.log(`wrote ${Object.keys(icons).length} icons × ${dirs.length} dirs`);
