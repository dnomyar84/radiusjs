/**
 * Soft container washes for group parents (AWS Architecture–style regions).
 * Index is a stable hash of the group id — same id → same pastel every render.
 */

/** Curated pastels that sit well together on light and dark boards. */
export const GROUP_PASTELS = [
  '#A8C8E0', // powder blue
  '#B5D4A8', // sage
  '#E0CFA8', // sand
  '#C8B8E0', // lavender
  '#E0B8B8', // rose
  '#A8D4CC', // mint
  '#D8C0D4', // mauve
  '#B0C8D8', // steel blue
  '#D4D0A8', // olive wash
  '#C4A890', // peach taupe
  '#A8D0B8', // seafoam
  '#D4B8A0', // apricot
  '#B8B8D8', // periwinkle
  '#C8D4A8', // celery
  '#E0C0A8', // blush sand
  '#A8C0D0', // slate mist
];

/** FNV-1a → palette index (deterministic, order-independent of other groups). */
export function pastelForKey(key) {
  const s = String(key ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const i = h >>> 0;
  return GROUP_PASTELS[i % GROUP_PASTELS.length];
}

/** Mix strength — lighter wash on dark themes so glyphs stay readable. */
export function pastelMixPct(themeId) {
  const dark = new Set(['night', 'indigo', 'neon', 'aws', 'oci', 'nutanix', 'esri']);
  return dark.has(String(themeId || '').toLowerCase()) ? 20 : 32;
}
