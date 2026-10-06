import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKind, kindMeta, familyOf } from '../src/kinds.js';
import { THEME_IDS, resolveTheme } from '../src/themes.js';

describe('kinds + themes', () => {
  it('normalizes azure HCI aliases', () => {
    assert.equal(normalizeKind('azure.stackhci'), 'azure.hci');
    assert.equal(normalizeKind('azure.local'), 'azure.hci');
  });

  it('family colors exist for cloud vendors', () => {
    for (const k of ['azure.hci', 'nutanix.nci', 'nkp.management', 'ctr.pod', 'esri.portal']) {
      const f = familyOf(k);
      assert.ok(f.fill.startsWith('#'));
      assert.ok(kindMeta(k).mono.length >= 1);
    }
  });

  it('ships neon among themes', () => {
    assert.ok(THEME_IDS.includes('neon'));
    const t = resolveTheme('neon');
    assert.ok(t.glow2);
    assert.ok(t.glow3);
    assert.equal(t.surface.startsWith('#'), true);
  });
});
