/**
 * Gallery catalog — newest demos stack at top (GitHub Pages shell).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CATEGORIES, DEMOS, VERSION } from '../demos/catalog.js';
import { demoFrameUrl } from '../demos/gallery.js';

const here = dirname(fileURLToPath(import.meta.url));
const demosDir = join(here, '../demos');

describe('gallery catalog', () => {
  it('pins a version string for the examples shell', () => {
    assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('stacks newest demos first under New', () => {
    const neu = CATEGORIES.find((c) => c.id === 'new');
    assert.ok(neu?.demos?.length);
    assert.equal(neu.demos[0], '23-hierarchy', 'newest demo must lead New');
    assert.ok(neu.demos.includes('22-sequence'));
    assert.ok(neu.demos.includes('21-constellation'));
    assert.ok(neu.demos.includes('20-mindmap'));
    // Numeric order in the New list should be descending for leading ids
    const nums = neu.demos
      .map((id) => Number(String(DEMOS[id]?.file || '').match(/^(\d+)/)?.[1]))
      .filter((n) => Number.isFinite(n));
    for (let i = 1; i < nums.length; i++) {
      assert.ok(nums[i - 1] >= nums[i], `New list not newest-first at ${nums[i - 1]} then ${nums[i]}`);
    }
  });

  it('playground is a special left-nav entry (not an iframe demo)', () => {
    const play = CATEGORIES.find((c) => c.id === 'playground');
    assert.equal(play.special, 'playground');
    assert.ok(!play.demos);
  });

  it('every catalog demo file exists on disk', () => {
    for (const d of Object.values(DEMOS)) {
      assert.ok(
        readdirSync(demosDir).includes(d.file),
        `missing demos/${d.file}`,
      );
    }
  });

  it('resolves a demo iframe next to the gallery, not the site root', () => {
    const href = demoFrameUrl('20-mindmap.html', 'https://dnomyar84.github.io/radiusjs/demos/gallery.js');
    assert.equal(href, 'https://dnomyar84.github.io/radiusjs/demos/20-mindmap.html?embed=1');
    const bare = demoFrameUrl('20-mindmap.html', 'https://dnomyar84.github.io/radiusjs/demos/gallery.js');
    assert.equal(new URL(bare).pathname, '/radiusjs/demos/20-mindmap.html');
  });

  it('constellation is reachable from Layout & Look categories', () => {
    const layout = CATEGORIES.find((c) => c.id === 'layout');
    const look = CATEGORIES.find((c) => c.id === 'look');
    assert.ok(layout.demos.includes('21-constellation'));
    assert.ok(look.demos.includes('21-constellation'));
  });
});
