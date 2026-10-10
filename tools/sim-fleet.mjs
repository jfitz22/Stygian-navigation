// Balance runs for the fleet battle: a steady simulated Fleet Officer (and departments) against the enemy.
import * as FL from '../src/fleet.js';
import { repairAction } from '../src/repair.js';
const key = (x, y) => x + ',' + y;
function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function botRound(f, r, t, k) {
  // departments load their specials some while after the flags go up
  for (const d of FL.DEPTS) {
    const st = f.dept[d]; st.seen ??= t; if (st.state !== 'flags' && st.state !== 'question') st.seen = null;
    else if (st.state === 'question') FL.answerQuestion(f, d, r() < k.morseRight ? st.question.answer : (st.question.answer + 1) % 3, t);
    else if (t - st.seen > k.codeDelay && (d !== 'gunnery' || k.beacons > 0)) FL.enterCode(f, d, FL.flagCode(st.flags), t, r);
  }
  // the Fleet Officer decodes a dispatch every so often, which reloads the crosshair scan
  if (t >= k.nextDispatch) { FL.reloadScan(f, t); k.nextDispatch = t + k.dispatchEvery; }
  // salvage: the board takes a while; power comes from the breaker panel
  for (const [i, s] of Object.entries(f.salvage)) {
    if (k.engineer && !s.done && f.round - s.since >= k.salvageRounds) { s.board.rows.forEach((row, j) => FL.salvageSet(f, i, j, repairAction('engineer', row))); FL.salvageSend(f, i, t); }
    if (k.engineer && !s.power && f.round - s.since >= k.powerRounds) FL.salvagePower(f, t);
    if (FL.salvageReady(f, i)) FL.redeployRandom(f, Number(i), r, t);
  }
  const N = FL.SIZE, known = (x, y) => !!f.marks[key(x, y)] && f.marks[key(x, y)] !== 'seen';
  const hits = Object.entries(f.marks).filter(([, v]) => v === 'hit').map(([q]) => q.split(',').map(Number)).filter(([x, y]) => f.enemy.some(s => !FL.sunk(s) && FL.cellsOf(s).some(c => c[0] === x && c[1] === y)));
  const cand = Object.entries(f.marks).filter(([, v]) => v === 'seen').map(([q]) => q.split(',').map(Number));
  for (const [x, y] of hits) {
    const line = hits.filter(([a, b]) => (a === x && Math.abs(b - y) === 1) || (b === y && Math.abs(a - x) === 1));
    const dirs = line.length ? (line[0][0] === x ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) { let j = 1; while (hits.some(([a, b]) => a === x + dx * j && b === y + dy * j)) j++; const nx = x + dx * j, ny = y + dy * j; if (nx >= 0 && ny >= 0 && nx < N && ny < N && !known(nx, ny)) cand.push([nx, ny]); }
  }
  const weight = (x, y) => { let w = 1; for (const sd of f.soundings) { const on = sd.line === 'row' ? y === sd.n : x === sd.n; if (!on) continue; let found = 0; for (let i = 0; i < N; i++) { const [a, b] = sd.line === 'row' ? [i, sd.n] : [sd.n, i]; if (f.marks[key(a, b)] === 'hit') found++; } w *= sd.count > found ? 3 : 0.05; } return w; };
  if (f.loaded.sounding && !hits.length) FL.planSpecial(f, 'sounding', { line: r() < 0.5 ? 'row' : 'col', n: Math.floor(r() * N) });
  if (f.loaded.scan && !hits.length && !cand.length) FL.planSpecial(f, 'scan', { x: 2 + Math.floor(r() * (N - 4)), y: 2 + Math.floor(r() * (N - 4)), dir: r() < 0.5 ? 'h' : 'v' });
  if (f.loaded.heavy && cand.length) FL.planSpecial(f, 'heavy', { x: cand[0][0], y: cand[0][1] });
  if (f.loaded.boost) { const i = f.mine.findIndex(s => s.hits.length && !FL.sunk(s)); if (i >= 0) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (FL.planSpecial(f, 'boost', { ship: i, dx, dy })) break; }
  const n = FL.shotsAllowed(f);
  for (const [x, y] of cand) if (f.aim.length < n && !f.aim.some(a => a[0] === x && a[1] === y)) FL.toggleAim(f, x, y);
  const pool = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!known(x, y) && (x + y) % 2 === 0) pool.push([x, y, weight(x, y) * r()]);
  pool.sort((a, b) => b[2] - a[2]);
  for (const [x, y] of pool) { if (f.aim.length >= n) break; FL.toggleAim(f, x, y); }
}
export function session(seed, { minutes = 40, round = 40, codeDelay = 40, engineer = true, salvageRounds = 2, powerRounds = 2, beacons = 99, morseRight = 0.85, dispatchEvery = 240 } = {}) {
  const rng = rngOf(seed), r = rngOf(seed * 7 + 3), f = FL.newFleet(rng); FL.randomDeploy(f, rng); FL.begin(f, 0);
  const k = { codeDelay, engineer, salvageRounds, powerRounds, beacons, morseRight, dispatchEvery, nextDispatch: dispatchEvery }; let t = 0, start = 0, waves = [], losses = 0, shells = 0, sinks = 0;
  while (t < minutes * 60) {
    botRound(f, r, t, k);
    t += round;
    const ev = FL.tick(f, { t: Math.max(t, f.nextSalvo || t), rng, engineerLive: engineer, spendBeacon: () => k.beacons-- > 0, shellReady: () => true });
    for (const e of ev) { if (e.type === 'fleetwin') { waves.push(t - start); start = t; } if (e.type === 'fleetlost') losses++; if (e.type === 'fleetshell') shells++; if (e.type === 'fleetsunk' && e.side === 'ours') sinks++; }
  }
  return { waves, losses, shells, sinks };
}
if (process.argv[1] && process.argv[1].endsWith('sim-fleet.mjs')) {
  for (const [label, o] of [['steady crew, Engineering on station', {}], ['no Engineering (no relaunch until the wave ends)', { engineer: false }], ['slow crew', { codeDelay: 90, salvageRounds: 4, powerRounds: 4 }]]) {
    const runs = Array.from({ length: 200 }, (_, i) => session(i + 1, o));
    const w = runs.flatMap(x => x.waves).sort((a, b) => a - b), lost = runs.reduce((a, x) => a + x.losses, 0), waves = w.length;
    console.log(`${label}: a wave ${(w[w.length >> 1] / 60).toFixed(1)} min · ${(waves / 200).toFixed(1)} waves/40 min · fleets lost ${(lost / 200).toFixed(2)} a session · ships sunk ${(runs.reduce((a, x) => a + x.sinks, 0) / 200).toFixed(1)} · shells on the Watch ${(runs.reduce((a, x) => a + x.shells, 0) / 200).toFixed(1)} a session`);
  }
}
