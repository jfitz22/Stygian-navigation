// Balance runs for the Fleet Officer prototype: a sensible simulated Fleet Officer against the enemy, many seeds.
import * as SEA from '../src/seawar.js';
const { SW } = SEA;
const key = (x, y) => x + ',' + y;
export function botBeat(sea, r, skill = { codeDelay: 30, advance: 0.3, useSpecials: true }) {
  // the departments load their specials some time after the flags go up
  for (const [d, st] of Object.entries(sea.dept)) { st.seenAt ??= sea.t; if (st.state !== 'flags') st.seenAt = null; else if (sea.t - st.seenAt > skill.codeDelay) SEA.enterCode(sea, d, SEA.flagCode(st.flags), r() < 0.5 ? 'broadside' : 'beacon'); }
  const seen = SEA.seenEnemies(sea).flatMap(s => SEA.cellsOf(s).filter((c, i) => !s.hits.has(i)));
  const hitsOpen = [...sea.ourShots].filter(([k, v]) => v.r === 'hit').map(([k]) => k.split(',').map(Number)).filter(([x, y]) => SEA.shipAt(sea.theirs, x, y));
  const fresh = (x, y) => x >= 0 && y >= 0 && x < SW.N && y < SW.N && !sea.ourShots.has(key(x, y)) && !SEA.iceAt(sea, x, y);
  const taken = new Set(), pick = () => {
    let t = seen.find(c => !taken.has(key(...c)));
    if (!t) for (const [x, y] of hitsOpen) { const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(c => fresh(...c) && !taken.has(key(...c))); if (n.length) { t = n[0]; break; } }
    for (let i = 0; !t && i < 300; i++) { const x = Math.floor(r() * SW.N), y = Math.floor(r() * (SW.N - SW.home)); if (fresh(x, y) && !taken.has(key(x, y)) && (x + y) % 2 === 0) t = [x, y]; }
    if (t) taken.add(key(...t)); return t;
  };
  const ships = sea.ours.filter(s => !SEA.sunk(s));
  for (const s of ships) {
    const tk = sea.tokens.find(t => ![...sea.orders.values()].some(o => o.token === t.id));
    if (skill.useSpecials && tk) {
      if (tk.kind === 'repair') { const d = sea.ours.find(o => o.hits.size && !SEA.sunk(o)); if (d) { const [x, y] = SEA.cellsOf(d)[0]; SEA.setOrder(sea, s.id, { type: 'special', token: tk.id, x, y }); continue; } }
      else if (tk.kind === 'scan') { if (!seen.length && !hitsOpen.length) { SEA.setOrder(sea, s.id, { type: 'special', token: tk.id, x: 1 + Math.floor(r() * 9), y: 1 + Math.floor(r() * 3) }); continue; } }
      else { const t = pick(); if (t) { SEA.setOrder(sea, s.id, { type: 'special', token: tk.id, x: t[0], y: t[1], dir: r() < 0.5 ? 'h' : 'v' }); continue; } }
    }
    if (!seen.length && !hitsOpen.length && r() < skill.advance && s.y > SW.home + 1) { SEA.setOrder(sea, s.id, { type: 'move', dx: 0, dy: -1 }); continue; }
    const t = pick(); if (t) SEA.setOrder(sea, s.id, { type: 'fire', x: t[0], y: t[1] });
  }
}
export function session(seed, minutes = 40, skill) {
  const sea = SEA.newSea(seed), r = SEA.makeRng(seed * 31 + 7); SEA.begin(sea);
  const waveTimes = [], lostAt = [], specials = { used: 0 }; let waveStart = 0, losses = 0;
  while (sea.t < minutes * 60) {
    if (sea.phase === 'lost') { losses++; lostAt.push(sea.t); break; }
    botBeat(sea, r, skill);
    const before = sea.tokens.length;
    const ev = SEA.tick(sea, SW.beat);
    specials.used += Math.max(0, before - sea.tokens.length);
    for (const e of ev) if (e.type === 'wave') { waveTimes.push(sea.t - waveStart); waveStart = sea.t; }
  }
  return { waves: waveTimes.length, waveTimes, lost: losses > 0, lostAt: lostAt[0], specials: specials.used, oursLeft: sea.ours.filter(s => !SEA.sunk(s)).length };
}
if (process.argv[1] && process.argv[1].endsWith('sim-seawar.mjs')) {
  const runs = Array.from({ length: 200 }, (_, i) => session(i + 1));
  const wt = runs.flatMap(r => r.waveTimes).sort((a, b) => a - b), q = p => (wt[Math.floor(p * (wt.length - 1))] / 60).toFixed(1);
  const lost = runs.filter(r => r.lost);
  console.log(`200 sessions of 40 min at ${SW.beat} s a beat`);
  console.log(`waves won per session: avg ${(runs.reduce((a, r) => a + r.waves, 0) / runs.length).toFixed(1)} · a wave takes ${q(0.5)} min (10%: ${q(0.1)}, 90%: ${q(0.9)})`);
  console.log(`fleets lost: ${lost.length}/200${lost.length ? ' · at ' + (lost.reduce((a, r) => a + r.lostAt, 0) / lost.length / 60).toFixed(1) + ' min on average' : ''}`);
  console.log(`specials fired per wave: ${(runs.reduce((a, r) => a + r.specials, 0) / Math.max(1, runs.reduce((a, r) => a + r.waves + (r.lost ? 1 : 0), 0))).toFixed(1)}`);
}
