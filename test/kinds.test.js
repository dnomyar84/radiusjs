import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKind, kindMeta, familyOf } from '../src/kinds.js';
import { pastelForKey, GROUP_PASTELS } from '../src/pastels.js';
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

  it('attaches vendor icon URLs for product kinds', () => {
    const portal = kindMeta('esri.portal');
    assert.ok(portal.icon);
    assert.match(portal.icon, /icons\/esri\/portal\.svg/);
    const fallback = kindMeta('esri.unknownthing');
    assert.match(fallback.icon, /icons\/esri\/esri\.svg/);
    assert.match(kindMeta('aws.s3').icon, /icons\/aws\/s3\.svg/);
    assert.equal(kindMeta('aws.s3').fill, '#3F8624', 'storage category green');
    assert.equal(kindMeta('aws.lambda').fill, '#ED7100', 'compute category orange');
    assert.equal(kindMeta('aws.vpc').fill, '#8C4FFF', 'network category purple');
    assert.match(kindMeta('azure.aks').icon, /icons\/azure\/aks\.svg/);
    assert.equal(kindMeta('nutanix.ahv').icon, null);
  });

  it('assigns stable pastels per group id', () => {
    assert.equal(pastelForKey('vpc'), pastelForKey('vpc'));
    assert.ok(GROUP_PASTELS.includes(pastelForKey('public')));
    assert.notEqual(pastelForKey('vpc'), pastelForKey('data'), 'distinct ids usually differ');
  });

  it('ships neon among themes', () => {
    assert.ok(THEME_IDS.includes('neon'));
    const t = resolveTheme('neon');
    assert.ok(t.glow2);
    assert.ok(t.glow3);
    assert.equal(t.surface.startsWith('#'), true);
  });

  it('ships indigo among themes', () => {
    assert.ok(THEME_IDS.includes('indigo'));
    const t = resolveTheme('indigo');
    assert.ok(t.surface);
    assert.equal(t.accent, '#fbbf24');
    assert.ok(t.glow4);
  });
});
