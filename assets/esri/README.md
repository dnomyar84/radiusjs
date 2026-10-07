# Esri-family icons (Radius)

MIT-original product-role glyphs for `esri.*` kinds. **Not** Esri / ArcGIS trademark artwork.

- Chip background uses family blue `#0079c1`; glyphs are white strokes.
- Runtime copies live in `dist/icons/esri/`.
- To overlay a licensed Esri icon pack later: replace files here (same filenames), run
  `node scripts/gen-esri-icons.js` (or copy into `dist/icons/esri/`), or retarget `src/icons.js`.

Filenames match the kind leaf (`esri.portal` → `portal.svg`). Fallback glyph: `esri.svg`.
