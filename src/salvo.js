// The Fleet Officer's battle, version 2: "Salvo & Soundings". A PROTOTYPE. Pure, no DOM.
//
// Two boards, as in Battleship: ours, which we see, and theirs, which we map with our shots. Their ships never move,
// so every mark stays true. Each round both fleets fire a salvo at once: one shot for every ship still afloat. A round
// lasts up to a minute; the Fleet Officer can fire sooner. Glaciers drift a square a round in a direction everyone can
// see; they stop shells, and a glacier that drifts into a ship scrapes it (a free clue on their board, a hazard on ours).
// The departments load specials with the flag code read from the Fleet Officer's codebook:
//   Signals: a sounding, the number of ship squares in one row or column.
//   Gunnery: a heavy shell, a 2 x 2 burst.
//   Engineering: a boost, one of our ships moves a square (their hits on it go stale).
// Sinking a ship shows its outline. Sink their fleet and ours is refitted, and a new wave comes.
// ---------- the flag code ----------
// Eight signal flags. A department hoists three; the Fleet Officer's codebook reads each by its place in the hoist
// (top, middle, bottom) and gives a rune. The department enters the three runes to load its special.
export const FLAGS = ['RED', 'BLUE CROSS', 'CHEQUER', 'YELLOW PENNANT', 'WHITE SWALLOWTAIL', 'BLACK BALL', 'STRIPES', 'BORDER'];
export const CODE_RUNES = 8;   // runes 0..7 on the entry pad
export const CODEBOOK = [      // CODEBOOK[place in the hoist][flag] -> rune
  [3, 6, 1, 7, 0, 4, 2, 5],
  [5, 0, 7, 2, 6, 1, 4, 3],
  [1, 4, 0, 5, 3, 7, 6, 2],
];
export const flagCode = flags => flags.map((f, pos) => CODEBOOK[pos][f]);
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const SV = {
  N: 12, round: 60, glaciers: 4, cooldown: 75,
  ours: [2, 3, 3, 3], theirs: [4, 3, 3, 2],
  enemyAim: 1,   // chance each enemy shot follows its plan (otherwise it goes wild)
  enemyExtra: 1, // extra enemy shots a round (their flagship's guns), while they have ships afloat
};
export const CREW = ['fleet', 'gunnery', 'signals', 'engineer'];
export const OUR_NAMES = ['THE LANTERN', 'THE CINDERWAKE', 'THE GALLOWS', 'THE BRIMSTONE'];
export const THEIR_NAMES = ['THE IRON TITHE', 'THE WAILING SAINT', 'THE NINTH COIL', 'THE BLACK LEDGER'];
export const SPECIAL = { gunnery: 'heavy', signals: 'sounding', engineer: 'boost' };
export const SPECIAL_NAME = { heavy: 'HEAVY SHELL', sounding: 'SOUNDING', boost: 'BOOST' };

const key = (x, y) => x + ',' + y;
const inside = (x, y) => x >= 0 && y >= 0 && x < SV.N && y < SV.N;
export const cellsOf = s => Array.from({ length: s.len }, (_, i) => s.dir === 'h' ? [s.x + i, s.y] : [s.x, s.y + i]);
export const sunk = s => s.hits.size >= s.len;
export const afloat = ships => ships.filter(s => !sunk(s));
export const colName = x => 'ABCDEFGHIJKLMNOP'[x];
export const shipAt = (ships, x, y) => ships.find(s => cellsOf(s).some(c => c[0] === x && c[1] === y));
export const iceAt = (board, x, y) => board.glaciers.some(g => g.x === x && g.y === y);

function newBoard(rng, lens, side) {
  const b = { glaciers: [], ships: [] };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let tries = 0; b.glaciers.length < SV.glaciers && tries < 500; tries++) {
    const x = Math.floor(rng() * SV.N), y = Math.floor(rng() * SV.N), [dx, dy] = DIRS[Math.floor(rng() * 4)];
    if (b.glaciers.some(g => Math.abs(g.x - x) + Math.abs(g.y - y) < 3)) continue;
    b.glaciers.push({ x, y, dx, dy });
  }
  lens.forEach((len, i) => {
    for (let tries = 0; tries < 5000; tries++) {
      const dir = rng() < 0.5 ? 'h' : 'v', s = { id: side[0] + i, side, len, dir, x: Math.floor(rng() * SV.N), y: Math.floor(rng() * SV.N), hits: new Set(),
        crew: side === 'ours' ? CREW[i] : null, name: (side === 'ours' ? OUR_NAMES : THEIR_NAMES)[i] };
      if (fits(b, s)) { b.ships.push(s); return; }
    }
    throw new Error('could not place the fleet');
  });
  return b;
}
// a footprint is free: on the board, off the ice, not touching another ship
function fits(b, s, ignore = null) {
  return cellsOf(s).every(([x, y]) => inside(x, y) && !iceAt(b, x, y) &&
    !b.ships.some(o => o !== ignore && o.id !== s.id && cellsOf(o).some(([ox, oy]) => Math.abs(ox - x) <= 1 && Math.abs(oy - y) <= 1)));
}

export function newBattle(seed) {
  const rng = makeRng(seed);
  const bt = {
    seed, rng, t: 0, round: 0, phase: 'deploy', wave: 1, nextRound: SV.round,
    ours: newBoard(rng, SV.ours, 'ours'), theirs: newBoard(rng, SV.theirs, 'theirs'),
    marks: new Map(),       // our shots on their board: key -> 'hit' | 'miss' | 'ice' | 'scrape'
    incoming: new Map(),    // their shots on ours: key -> { r, round }
    aim: [], specials: [], tokens: [], soundings: [], log: [], dept: {},
    ai: { shot: new Set(), hits: [] },
  };
  for (const d of ['gunnery', 'signals', 'engineer']) bt.dept[d] = flagsFor(bt);
  return bt;
}
function flagsFor(bt) { const f = []; while (f.length < 3) { const n = Math.floor(bt.rng() * FLAGS.length); if (!f.includes(n)) f.push(n); } return { state: 'flags', flags: f, readyAt: 0 }; }
function log(bt, text) { bt.log.unshift({ round: bt.round, text }); if (bt.log.length > 50) bt.log.pop(); }

// ---------- deployment ----------
export function deploy(bt, id, x, y, dir) {
  const s = bt.ours.ships.find(o => o.id === id); if (!s || bt.phase !== 'deploy') return false;
  const t = { ...s, x, y, dir }; if (!fits(bt.ours, t, s)) return false;
  Object.assign(s, { x, y, dir }); return true;
}
export function begin(bt) { bt.phase = 'battle'; bt.nextRound = bt.t + SV.round; log(bt, 'THE ENEMY FLEET IS ON THE HORIZON'); }

// ---------- aiming ----------
export const shotsAllowed = bt => afloat(bt.ours.ships).length;
// Toggle a shot on their board. Returns false when the salvo is full or the square is already known.
export function toggleAim(bt, x, y) {
  const i = bt.aim.findIndex(a => a[0] === x && a[1] === y);
  if (i >= 0) { bt.aim.splice(i, 1); return true; }
  if (!inside(x, y) || bt.aim.length >= shotsAllowed(bt) || bt.marks.has(key(x, y))) return false;
  bt.aim.push([x, y]); return true;
}

// ---------- specials ----------
export function enterCode(bt, dept, runes) {
  const d = bt.dept[dept]; if (!d || d.state !== 'flags') return 'not ready';
  const want = flagCode(d.flags);
  if (runes.length !== 3 || runes.some((r, i) => r !== want[i])) { log(bt, `${dept.toUpperCase()}: THE CODE DOES NOT MATCH THE FLAGS`); return 'wrong'; }
  bt.tokens.push({ id: 'k' + Math.floor(bt.rng() * 1e9), dept, kind: SPECIAL[dept] }); d.state = 'loaded';
  log(bt, `${dept === 'engineer' ? 'ENGINEERING' : dept.toUpperCase()} LOADED: ${SPECIAL_NAME[SPECIAL[dept]]}`);
  return 'loaded';
}
// Use a loaded special this round. heavy: { x, y } (top-left of the 2 x 2); sounding: { line: 'row'|'col', n };
// boost: { ship, dx, dy }. Fired with the salvo.
export function useSpecial(bt, tokenId, args) {
  const tk = bt.tokens.find(t => t.id === tokenId); if (!tk || bt.phase !== 'battle') return false;
  if (tk.kind === 'boost') {
    const s = bt.ours.ships.find(o => o.id === args.ship); if (!s || sunk(s)) return false;
    const t = { ...s, x: s.x + args.dx, y: s.y + args.dy }; if (!fits(bt.ours, t, s)) return false;
  }
  bt.specials = bt.specials.filter(p => p.token !== tokenId);
  bt.specials.push({ token: tokenId, kind: tk.kind, ...args }); return true;
}
export function cancelSpecial(bt, tokenId) { bt.specials = bt.specials.filter(p => p.token !== tokenId); }

// ---------- time ----------
export function tick(bt, dt) {
  bt.t += dt;
  for (const d of Object.values(bt.dept)) if (d.state === 'cooldown' && bt.t >= d.readyAt) Object.assign(d, flagsFor(bt));
  if (bt.phase === 'battle' && bt.t >= bt.nextRound) return fire(bt);
  return [];
}

// Both fleets fire at once.
export function fire(bt) {
  if (bt.phase !== 'battle') return [];
  const ev = [];
  bt.round++; bt.nextRound = bt.t + SV.round;
  const theirAim = enemyAim(bt);
  // 1. specials before the shells: the boost moves first, the sounding reads the board as it stands
  const extra = [];
  for (const p of bt.specials) {
    const ti = bt.tokens.findIndex(t => t.id === p.token); if (ti < 0) continue;
    const tk = bt.tokens.splice(ti, 1)[0], d = bt.dept[tk.dept];
    d.state = 'cooldown'; d.readyAt = bt.t + SV.cooldown;
    if (p.kind === 'boost') {
      const s = bt.ours.ships.find(o => o.id === p.ship), t = s && { ...s, x: s.x + p.dx, y: s.y + p.dy };
      if (s && !sunk(s) && fits(bt.ours, t, s)) { s.x = t.x; s.y = t.y; log(bt, `ENGINEERING BOOSTS ${s.name} ONE SQUARE`); ev.push({ type: 'boost', ship: s.id }); }
      else log(bt, 'THE BOOST HAD NOWHERE TO GO');
    }
    if (p.kind === 'sounding') {
      let count = 0; for (let i = 0; i < SV.N; i++) { const [x, y] = p.line === 'row' ? [i, p.n] : [p.n, i]; if (shipAt(bt.theirs.ships, x, y)) count++; }
      bt.soundings.push({ line: p.line, n: p.n, count, round: bt.round });
      log(bt, `SOUNDING ${p.line === 'row' ? 'ROW ' + (p.n + 1) : 'COLUMN ' + colName(p.n)}: ${count} SHIP SQUARE${count === 1 ? '' : 'S'}`);
    }
    if (p.kind === 'heavy') { for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) extra.push([p.x + dx, p.y + dy]); log(bt, `A HEAVY SHELL ON ${colName(p.x)}${p.y + 1}`); }
  }
  bt.specials = [];
  // 2. our salvo
  for (const [x, y] of [...bt.aim, ...extra]) {
    if (!inside(x, y) || bt.marks.get(key(x, y)) === 'hit') continue;
    if (iceAt(bt.theirs, x, y)) { bt.marks.set(key(x, y), 'ice'); continue; }
    const s = shipAt(bt.theirs.ships, x, y);
    if (!s) { bt.marks.set(key(x, y), 'miss'); continue; }
    s.hits.add(cellsOf(s).findIndex(c => c[0] === x && c[1] === y)); bt.marks.set(key(x, y), 'hit');
    ev.push({ type: 'hit', side: 'theirs', x, y, len: s.len });
    if (sunk(s)) { log(bt, `${s.name} (${s.len} LONG) IS SUNK`); ev.push({ type: 'sunk', side: 'theirs', ship: s.id }); outline(bt, s); }
    else log(bt, `HIT ON ${colName(x)}${y + 1}: A ${s.len}-LONG SHIP`);
  }
  if (!ev.some(e => e.type === 'hit') && bt.aim.length) log(bt, `ROUND ${bt.round}: ${bt.aim.length} SHOT${bt.aim.length > 1 ? 'S' : ''}, NO HITS`);
  bt.aim = [];
  // 3. their salvo
  for (const [x, y] of theirAim) {
    bt.ai.shot.add(key(x, y));
    if (iceAt(bt.ours, x, y)) continue;
    const s = afloat(bt.ours.ships).find(o => cellsOf(o).some(c => c[0] === x && c[1] === y));
    bt.incoming.set(key(x, y), { r: s ? 'hit' : 'miss', round: bt.round });
    if (!s) continue;
    const i = cellsOf(s).findIndex(c => c[0] === x && c[1] === y);
    if (s.hits.has(i)) continue;
    s.hits.add(i); bt.ai.hits.push([x, y]);
    ev.push({ type: 'hit', side: 'ours', ship: s.id, crew: s.crew, x, y });
    log(bt, sunk(s) ? `${s.name} IS SUNK` : `${s.name} IS HIT`);
    if (sunk(s)) ev.push({ type: 'sunk', side: 'ours', ship: s.id, crew: s.crew });
  }
  // 4. the glaciers drift; one that runs into a ship scrapes it
  for (const side of ['ours', 'theirs']) drift(bt, side, ev);
  // 5. the wave
  if (!afloat(bt.theirs.ships).length) {
    bt.wave++; ev.push({ type: 'wave', wave: bt.wave });
    for (const s of bt.ours.ships) s.hits.clear();
    bt.theirs = newBoard(bt.rng, SV.theirs, 'theirs'); bt.marks.clear(); bt.soundings = []; bt.incoming.clear(); bt.ai = { shot: new Set(), hits: [] };
    log(bt, `THE ENEMY FLEET IS SUNK · OURS IS REFITTED · WAVE ${bt.wave} IS ON THE HORIZON`);
  } else if (!afloat(bt.ours.ships).length) { bt.phase = 'lost'; ev.push({ type: 'lost' }); log(bt, 'THE FLEET IS LOST'); }
  return ev;
}
// A sunk ship shows its outline, and (ships never touch) the water round it is marked clear.
function outline(bt, s) {
  for (const [x, y] of cellsOf(s)) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const k = key(x + dx, y + dy); if (inside(x + dx, y + dy) && !bt.marks.has(k) && !iceAt(bt.theirs, x + dx, y + dy)) bt.marks.set(k, 'clear');
  }
}
function drift(bt, side, ev) {
  const b = bt[side];
  for (const g of b.glaciers) {
    let nx = g.x + g.dx, ny = g.y + g.dy;
    if (!inside(nx, ny)) { g.dx = -g.dx; g.dy = -g.dy; nx = g.x + g.dx; ny = g.y + g.dy; }
    if (b.glaciers.some(o => o !== g && o.x === nx && o.y === ny)) { g.dx = -g.dx; g.dy = -g.dy; continue; }
    const s = b.ships.find(o => cellsOf(o).some(c => c[0] === nx && c[1] === ny));
    if (s) {   // the ice grinds into the hull and turns back
      g.dx = -g.dx; g.dy = -g.dy;
      if (sunk(s)) continue;
      const i = cellsOf(s).findIndex(c => c[0] === nx && c[1] === ny);
      if (!s.hits.has(i)) {
        s.hits.add(i);
        if (side === 'theirs') { bt.marks.set(key(nx, ny), 'hit'); log(bt, `THE GLACIER AT ${colName(g.x)}${g.y + 1} STRUCK A SHIP AT ${colName(nx)}${ny + 1}`); }
        else { bt.ai.hits.push([nx, ny]); log(bt, `A GLACIER SCRAPED ${s.name}`); }
        ev.push({ type: 'scrape', side, x: nx, y: ny });
        if (sunk(s)) { log(bt, `${s.name} IS SUNK`); ev.push({ type: 'sunk', side, ship: s.id, crew: s.crew }); if (side === 'theirs') outline(bt, s); }
      }
      continue;
    }
    g.x = nx; g.y = ny;
    if (side === 'theirs') bt.marks.delete(key(nx, ny));   // the ice moved over an old mark
  }
}

// ---------- the enemy ----------
// One shot per ship afloat: around its open hits first (following a line once it has two), then a parity hunt.
// Our boosts make its hits stale; it drops those once it has tried round them.
export function enemyAim(bt) {
  const r = bt.rng, n = afloat(bt.theirs.ships).length + SV.enemyExtra, out = [], taken = new Set(), ai = bt.ai;
  const fresh = (x, y) => inside(x, y) && !ai.shot.has(key(x, y)) && !taken.has(key(x, y));
  // open hits: on a ship of ours that is still afloat and still there
  ai.hits = ai.hits.filter(([x, y]) => { const s = afloat(bt.ours.ships).find(o => cellsOf(o).some(c => c[0] === x && c[1] === y)); return s ? true : [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fresh(x + dx, y + dy)); });
  const targets = [];
  for (const [x, y] of ai.hits) {
    const line = ai.hits.filter(([a, b]) => (a === x && Math.abs(b - y) === 1) || (b === y && Math.abs(a - x) === 1));
    const dirs = line.length ? (line[0][0] === x ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) { let k = 1; while (ai.hits.some(([a, b]) => a === x + dx * k && b === y + dy * k)) k++; if (fresh(x + dx * k, y + dy * k)) targets.push([x + dx * k, y + dy * k]); }
  }
  for (let i = 0; i < n; i++) {
    let t = null;
    if (r() < SV.enemyAim) { const c = targets.filter(([x, y]) => fresh(x, y)); if (c.length) t = c[Math.floor(r() * c.length)]; }
    for (let tries = 0; !t && tries < 400; tries++) { const x = Math.floor(r() * SV.N), y = Math.floor(r() * SV.N); if (fresh(x, y) && (x + y) % 2 === 0) t = [x, y]; }
    for (let tries = 0; !t && tries < 400; tries++) { const x = Math.floor(r() * SV.N), y = Math.floor(r() * SV.N); if (fresh(x, y)) t = [x, y]; }
    if (t) { taken.add(key(...t)); out.push(t); }
  }
  return out;
}
