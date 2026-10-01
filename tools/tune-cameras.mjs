// Design aid: search for camera posts that catch Elgarz's possible routes most often.
// Run: node tools/tune-cameras.mjs   (prints a CAMERAS list to paste into scenario.js)
import { createWorld, step, light, trace, DT } from '../src/sim.js';
import { CENTER, REACH, TUNING as T } from '../src/scenario.js';

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
const cands = [];
for (let x = 200; x < 3400; x += 200) for (let y = 200; y < 3400; y += 200) {
  const r = Math.hypot(x - CENTER.x, y - CENTER.y);
  if (r < 250 || r > 1450) continue;
  for (let f = 0; f < 360; f += 30) cands.push({ x, y, facing: f });
}
const seen = cands.map(c => traces.map(tr => {
  const bits = new Uint8Array(P);
  tr.forEach((p, i) => {
    const d = Math.hypot(p.x - c.x, p.y - c.y); if (d > range) return;
    let rel = Math.atan2(p.x - c.x, -(p.y - c.y)) - c.facing * Math.PI / 180;
    while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
    if (Math.abs(rel) <= fov) bits[i] = 1;
  });
  return bits;
}));
function windows(bits) {      // separate sightings of >= 15 s (3 samples)
  let n = 0, run = 0;
  for (let i = 0; i <= bits.length; i++) { if (i < bits.length && bits[i]) run++; else { if (run >= 3) n++; run = 0; } }
  return n;
}
let union = traces.map(() => new Uint8Array(P));
const chosen = [];
for (let k = 0; k < 7; k++) {
  let best = -1, bs = -1;
  cands.forEach((c, ci) => {
    if (chosen.some(o => Math.hypot(o.x - c.x, o.y - c.y) < 450)) return;   // spread the posts out
    let s = 0;
    for (let ti = 0; ti < traces.length; ti++) {
      const u = union[ti], b = seen[ci][ti], m = new Uint8Array(P);
      for (let i = 0; i < P; i++) m[i] = u[i] | b[i];
      s += Math.min(windows(m), 3);
    }
    if (s > bs) { bs = s; best = ci; }
  });
  chosen.push(cands[best]);
  union = union.map((u, ti) => u.map((v, i) => v | seen[best][ti][i]));
  const counts = union.map(windows);
  console.log(`camera ${k + 1}: (${cands[best].x}, ${cands[best].y}) facing ${cands[best].facing} · routes with 2+ sightings ${counts.filter(n => n >= 2).length}/${traces.length}`);
}
const names = ['GALLOWS REACH', 'HOARFROST SPIRE', 'SOUTHEAST POST', 'SALTGRAVE', 'CHAIN ROCK', 'WESTERN WATCH', 'MIDSEA PILLAR'];
console.log(chosen.map((c, i) => `  { id: 'c${i + 1}', name: '${names[i]}', x: ${c.x}, y: ${c.y}, facing: ${c.facing} },`).join('\n'));
