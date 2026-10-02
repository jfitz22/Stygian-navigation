// Design aid: the camera posts are spaced evenly round the island; this searches for the bearing each
// one should START at so that Elgarz's possible routes pass through camera view as often as possible.
// (The crew can turn the cameras during play; this only sets where they point when the watch begins.)
// Run: node tools/tune-cameras.mjs   (prints facings to paste into CAMERAS in scenario.js)
import { createWorld, step, light, trace, DT } from '../src/sim.js';
import { CENTER, REACH, TUNING as T, CAMERAS } from '../src/scenario.js';

const SEEDS = Array.from({ length: 24 }, (_, i) => 5000 + i * 53);
const traces = [];
for (const seed of SEEDS) {
  const w = createWorld(seed); light(w);
  for (let i = 0; i < T.elgarzSpawnAt / DT - 1; i++) { if (w.furnace.heat < 50) w.furnace.heat = 60; step(w, DT); }
  const e = w.reserve.find(b => b.elgarz);
  for (let k = 0; k < 10; k++) {
    const a = w.spawnRng() * Math.PI * 2, r = T.spawnRimFrac * REACH;
    traces.push(trace(w, { ...e, x: CENTER.x + Math.cos(a) * r, y: CENTER.y + Math.sin(a) * r }, w.t, 1200, 5));
  }
}
const P = traces[0].length;
console.log(`${traces.length} routes, ${P} samples each`);

const fov = T.camFov / 2, range = T.camRange;
const FACINGS = Array.from({ length: 24 }, (_, i) => i * 15);
// seen[cam][facingIndex][trace] = bit array
const seen = CAMERAS.map(c => FACINGS.map(f => traces.map(tr => {
  const bits = new Uint8Array(P);
  tr.forEach((p, i) => {
    const d = Math.hypot(p.x - c.x, p.y - c.y); if (d > range) return;
    let rel = Math.atan2(p.x - c.x, -(p.y - c.y)) - f * Math.PI / 180;
    while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
    if (Math.abs(rel) <= fov) bits[i] = 1;
  });
  return bits;
})));
function windows(bits) {      // separate sightings of >= 15 s (3 samples)
  let n = 0, run = 0;
  for (let i = 0; i <= bits.length; i++) { if (i < bits.length && bits[i]) run++; else { if (run >= 3) n++; run = 0; } }
  return n;
}
function score(choice) {
  let s = 0, two = 0;
  for (let ti = 0; ti < traces.length; ti++) {
    const m = new Uint8Array(P);
    choice.forEach((fi, ci) => { const b = seen[ci][fi][ti]; for (let i = 0; i < P; i++) m[i] |= b[i]; });
    const n = windows(m); s += Math.min(n, 3); if (n >= 2) two++;
  }
  return { s, two };
}
let choice = CAMERAS.map(c => FACINGS.indexOf(Math.round(c.facing / 15) * 15 % 360));
for (let pass = 0; pass < 3; pass++) {
  for (let ci = 0; ci < CAMERAS.length; ci++) {
    let best = choice[ci], bs = -1;
    for (let fi = 0; fi < FACINGS.length; fi++) { const c = [...choice]; c[ci] = fi; const { s } = score(c); if (s > bs) { bs = s; best = fi; } }
    choice[ci] = best;
  }
  const { s, two } = score(choice);
  console.log(`pass ${pass + 1}: score ${s}, routes with 2+ sightings ${two}/${traces.length}`);
}
console.log(CAMERAS.map((c, i) => `  ${c.id} ${c.name}: facing ${FACINGS[choice[i]]}`).join('\n'));
console.log('FACINGS = [' + choice.map(i => FACINGS[i]).join(', ') + ']');
