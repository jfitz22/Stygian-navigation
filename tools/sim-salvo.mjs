// Balance runs for "Salvo & Soundings": a steady simulated Fleet Officer against the enemy, many seeds.
import * as S from '../src/salvo.js';
const { SV } = S;
const key = (x, y) => x + ',' + y;
export function botRound(bt, r, k = { codeDelay: 40 }) {
  for (const [d, st] of Object.entries(bt.dept)) { st.seen ??= bt.t; if (st.state !== 'flags') st.seen = null; else if (bt.t - st.seen > k.codeDelay) S.enterCode(bt, d, S.flagCode(st.flags)); }
  const N = SV.N, known = (x, y) => bt.marks.has(key(x, y)) || S.iceAt(bt.theirs, x, y);
  const hits = [...bt.marks].filter(([, v]) => v === 'hit').map(([q]) => q.split(',').map(Number)).filter(([x, y]) => { const s = S.shipAt(bt.theirs.ships, x, y); return s && !S.sunk(s); });
  const cand = [];
  for (const [x, y] of hits) {
    const line = hits.filter(([a, b]) => (a === x && Math.abs(b - y) === 1) || (b === y && Math.abs(a - x) === 1));
    const dirs = line.length ? (line[0][0] === x ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) { let j = 1; while (hits.some(([a, b]) => a === x + dx * j && b === y + dy * j)) j++; const nx = x + dx * j, ny = y + dy * j; if (nx >= 0 && ny >= 0 && nx < N && ny < N && !known(nx, ny)) cand.push([nx, ny]); }
  }
  // soundings steer the hunt: rows and columns that still hold more ship than we have found
  const weight = (x, y) => { let w = 1; for (const sd of bt.soundings) { const on = sd.line === 'row' ? y === sd.n : x === sd.n; if (!on) continue; let found = 0; for (let i = 0; i < N; i++) { const [a, b] = sd.line === 'row' ? [i, sd.n] : [sd.n, i]; if (bt.marks.get(key(a, b)) === 'hit') found++; } w *= sd.count > found ? 3 : 0.05; } return w; };
  for (const tk of bt.tokens) {
    if (bt.specials.some(p => p.token === tk.id)) continue;
    if (tk.kind === 'sounding' && !hits.length) { const line = r() < 0.5 ? 'row' : 'col'; S.useSpecial(bt, tk.id, { line, n: Math.floor(r() * N) }); }
    if (tk.kind === 'heavy' && cand.length) { const [x, y] = cand[0]; S.useSpecial(bt, tk.id, { x: Math.min(N - 2, x), y: Math.min(N - 2, y) }); }
    if (tk.kind === 'boost') { const s = bt.ours.ships.find(o => o.hits.size && !S.sunk(o)); if (s) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (S.useSpecial(bt, tk.id, { ship: s.id, dx, dy })) break; }
  }
  const n = S.shotsAllowed(bt);
  for (const [x, y] of cand) if (bt.aim.length < n && !bt.aim.some(a => a[0] === x && a[1] === y)) S.toggleAim(bt, x, y);
  const pool = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!known(x, y) && (x + y) % 2 === 0) pool.push([x, y, weight(x, y) * r()]);
  pool.sort((a, b) => b[2] - a[2]);
  for (const [x, y] of pool) { if (bt.aim.length >= n) break; S.toggleAim(bt, x, y); }
}
export function session(seed, minutes = 40, roundSecs = 35, k) {
  const bt = S.newBattle(seed), r = S.makeRng(seed * 13 + 1); S.begin(bt);
  const waves = []; let start = 0, rounds = 0, lost = false;
  while (bt.t < minutes * 60) {
    botRound(bt, r, k);
    const ev = S.tick(bt, 0) .concat(S.fire(bt)); bt.t += roundSecs; rounds++;
    for (const e of ev) if (e.type === 'wave') { waves.push(rounds - start); start = rounds; }
    if (bt.phase === 'lost') { lost = true; break; }
  }
  return { waves, lost };
}
if (process.argv[1] && process.argv[1].endsWith('sim-salvo.mjs')) {
  for (const N of [10, 12, 13, 14]) {
    SV.N = N;
    const runs = Array.from({ length: 200 }, (_, i) => session(i + 1));
    const w = runs.flatMap(x => x.waves).sort((a, b) => a - b), lost = runs.filter(x => x.lost).length;
    console.log(`${N}x${N}: a wave takes ${w[w.length >> 1]} rounds (10%: ${w[Math.floor(w.length * .1)]}, 90%: ${w[Math.floor(w.length * .9)]}) = ~${(w[w.length >> 1] * 35 / 60).toFixed(1)} min at 35 s a round · ${(w.length / 200).toFixed(1)} waves per 40 min · waves lost ${(lost / (w.length + lost) * 100).toFixed(0)}%`);
  }
}
