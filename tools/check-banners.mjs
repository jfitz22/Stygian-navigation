import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createWorld, saveWorld, loadWorld, runeEffect, stationAction, stationSnapshot, RUNE_FUNCTIONS } from '../src/sim.js';
import { rollBanners, dismissBanner, bannerActive, BANNER_PANELS, OPERATOR_PANELS } from '../src/banners.js';
import { BANNER_CATALOG } from '../src/banner-catalog.js';

assert.equal(BANNER_CATALOG.length, 15);
for (const asset of BANNER_CATALOG) assert.ok(existsSync(new URL('../' + asset.path, import.meta.url)), asset.path);
const seen = new Set();
for (let seed = 1; seed <= 200; seed++) {
  const w = createWorld(seed), before = [w.rng.s, w.camRng.s, w.boardRng.s, w.spawnRng.s];
  const nLive = seed % 4;   // 0 to 3 officers connected
  w.defence.live = { gunnery: nLive > 0, signals: nLive > 1, engineer: nLive > 2 };
  const e = rollBanners(w, 10000);
  assert.equal(new Set(e.images).size, 2);
  e.images.forEach(i => seen.add(i));
  assert.deepEqual(new Set(e.panels.map(p => p.key)), new Set(BANNER_PANELS));
  assert.ok(e.panels.every(p => e.images.includes(p.image)));
  const sticky = e.panels.filter(p => p.sticky);
  assert.equal(sticky.length, 4, 'four covers stay down');
  const onOperator = sticky.filter(p => OPERATOR_PANELS.includes(p.key)).length;
  assert.equal(onOperator, 4 - Math.min(2, nLive), 'two on connected officers where possible, the rest on the operator');
  assert.ok(sticky.every(p => OPERATOR_PANELS.includes(p.key) || (p.key.endsWith(':job') && w.defence.live[p.key.split(':')[0]])), 'only connected officers get one');
  for (const p of e.panels) {
    assert.ok(bannerActive(e, p.key, 14900));
    assert.equal(bannerActive(e, p.key, 15560), p.sticky, 'the rest lift from 5 s');
  }
  assert.deepEqual(before, [w.rng.s, w.camRng.s, w.boardRng.s, w.spawnRng.s]);
  const p = sticky[0], role = p.key.includes(':') ? p.key.split(':')[0] : 'operator';
  assert.equal(dismissBanner(w, role, e.id, p.key, 12900), false, 'no cord before 3 s');
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
  assert.ok(!p.dismissedAt, 'a pull in the first three seconds does nothing');
  assert.ok(dismissBanner(w, 'engineer', w.bannerEvent.id, p.key, w.bannerEvent.at + 3000));
}
console.log('PASS banner catalog, 200 rolls, four sticky covers spread to connected officers, cords from 3 s, gameplay RNG isolation, timing, authorization, duplicate/stale dismissal, save/resume and legacy aliases');
