import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createWorld, saveWorld, loadWorld, runeEffect, stationAction, stationSnapshot, RUNE_FUNCTIONS } from '../src/sim.js';
import { rollBanners, dismissBanner, bannerActive, BANNER_PANELS } from '../src/banners.js';
import { BANNER_CATALOG } from '../src/banner-catalog.js';

assert.equal(BANNER_CATALOG.length, 15);
for (const asset of BANNER_CATALOG) assert.ok(existsSync(new URL('../' + asset.path, import.meta.url)), asset.path);
const seen = new Set();
for (let seed = 1; seed <= 200; seed++) {
  const w = createWorld(seed), before = [w.rng.s, w.camRng.s, w.boardRng.s, w.spawnRng.s];
  w.defence.live = { gunnery: true, signals: true, engineer: true };
  const e = rollBanners(w, 10000);
  assert.equal(new Set(e.images).size, 2);
  e.images.forEach(i => seen.add(i));
  assert.deepEqual(new Set(e.panels.map(p => p.key)), new Set(BANNER_PANELS));
  assert.ok(e.panels.every(p => e.images.includes(p.image)));
  const sticky = e.panels.filter(p => p.sticky);
  assert.ok(sticky.length >= 1 && sticky.length <= 2);
  for (const p of e.panels) {
    assert.ok(bannerActive(e, p.key, 15000));
    assert.equal(bannerActive(e, p.key, 16250), p.sticky);
  }
  assert.deepEqual(before, [w.rng.s, w.camRng.s, w.boardRng.s, w.spawnRng.s]);
  const p = sticky[0], role = p.key.includes(':') ? p.key.split(':')[0] : 'operator';
  assert.equal(dismissBanner(w, 'invalid', e.id, p.key, 17000), false);
  assert.equal(dismissBanner(w, role, 'stale-event', p.key, 17000), false);
  assert.equal(dismissBanner(w, role, e.id, p.key, 17000), true);
  assert.equal(dismissBanner(w, role, e.id, p.key, 18000), false);
  assert.equal(p.dismissedAt, 17000);
  assert.equal(bannerActive(e, p.key, 17550), false);
  const restored = loadWorld(saveWorld(w));
  assert.deepEqual(restored.bannerEvent, e);
  assert.deepEqual(stationSnapshot(restored).bannerEvent, e);
  const next = rollBanners(w, 20000);
  assert.notEqual(next.id, e.id);
  assert.equal(dismissBanner(w, role, e.id, p.key, 21000), false);
}
assert.equal(seen.size, 15, 'every catalog entry can be rolled');
const w = createWorld(9);
assert.equal(stationSnapshot(w).bannerEvent, null, 'old saves need no migration');
assert.equal(RUNE_FUNCTIONS.indexOf('DEVIL'), 12, 'legacy rune indices stay stable');
for (const fn of ['DEVIL', 'SUCCUBUS']) {
  runeEffect(w, fn);
  assert.equal(w.bannerEvent.images.length, 2);
  const p = w.bannerEvent.panels.find(p => p.key === 'engineer:job');
  stationAction(w, 'engineer', { act: 'banner-dismiss', eventId: w.bannerEvent.id, key: p.key });
  assert.ok(p.dismissedAt);
}
console.log('PASS banner catalog, 200 rolls, gameplay RNG isolation, timing, authorization, duplicate/stale dismissal, save/resume and legacy aliases');
