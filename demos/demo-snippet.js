/** Copy the fence text into the snippet panel (from the original pre before mount). */
const mounted = document.querySelector('.radius-mount, .radius-root');
const panel = document.querySelector('details.snippet pre');
// Auto-mount replaces <pre class="radius"> — stash from a data attribute if needed.
// Rebuild from session: read first script's sibling... Instead, demos keep source in a template.
const src = document.querySelector('script[type="radius-source"]');
if (panel) {
  if (src) {
    panel.textContent = src.textContent.trim();
  } else {
    // Fallback: try recovering from Radius instance
    const host = document.querySelector('.radius-mount, .radius-root');
    panel.textContent = host?._radius
      ? '(mounted — see RADIUS.md)'
      : 'Reload after editing the fence in the HTML source.';
  }
}
