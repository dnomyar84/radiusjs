/**
 * Gallery catalog — newest demos stack at top (GitHub Pages shell).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BEAUTY_PRESETS, CATEGORIES, DEMOS, STYLE_PRESETS, VERSION } from '../demos/catalog.js';
import { ENUMS, parse } from '../src/parse.js';
import { layout } from '../src/layout.js';

const here = dirname(fileURLToPath(import.meta.url));
const demosDir = join(here, '../demos');

describe('gallery catalog', () => {
  it('pins a version string for the examples shell', () => {
    assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('stacks newest demos first under New', () => {
    const neu = CATEGORIES.find((c) => c.id === 'new');
    assert.ok(neu?.demos?.length);
    assert.equal(neu.demos[0], '21-constellation', 'constellation must lead New');
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

  it('playground rails cover a look and a diagram style', () => {
    assert.ok(BEAUTY_PRESETS.length >= 2);
    assert.ok(STYLE_PRESETS.some((s) => s.id === 'mindmap'));
    assert.ok(STYLE_PRESETS.some((s) => s.label === 'Flow chart'));
    assert.ok(STYLE_PRESETS.some((s) => s.label === 'AWS'));
    const phone = { w: 390, h: 520 };
    for (const look of BEAUTY_PRESETS) {
      assert.ok(ENUMS.THEMES.has(look.theme), look.id);
      assert.ok(ENUMS.GROUNDS.has(look.ground), look.id);
    }
    for (const style of STYLE_PRESETS) {
      const spec = parse(`theme: indigo\nground: dots\nroute: ${style.route}\nframe: system\n${style.fence}`);
      const laid = layout(spec, phone);
      assert.ok(Object.keys(laid.boxes).length >= 2, style.id);
    }
    const constellation = STYLE_PRESETS.find((s) => s.id === 'constellation');
    const cloud = parse(constellation.fence);
    assert.equal(cloud.template, 'constellation');
    assert.equal(cloud.nodes.length, 20);
  });

  it('constellation is reachable from Layout & Look categories', () => {
    const layout = CATEGORIES.find((c) => c.id === 'layout');
    const look = CATEGORIES.find((c) => c.id === 'look');
    assert.ok(layout.demos.includes('21-constellation'));
    assert.ok(look.demos.includes('21-constellation'));
  });
});
