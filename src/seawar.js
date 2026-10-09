// The Fleet Officer's shared sea: a PROTOTYPE. Battleship on one board, with fog, glaciers and moving ships.
// Pure, no DOM: the prototype page (fleet-proto.html), the tests and the balance runs all share it.
//
// One 11 x 11 sea. Our home waters are the bottom rows, theirs the top. Every beat both fleets act at once: each ship
// fires, moves one square, or turns 90 degrees. We see the squares around our own ships; the rest is fog. Glaciers
// drift through the middle and stop ships and shells. The departments load specials with a flag code that only the
// Fleet Officer's codebook reads. Sink their fleet and ours is refitted, and a new wave comes.

export const SW = {
  N: 11, home: 3, beat: 25, glaciers: 5, drift: 3, cooldown: 75,
  fade: 8,              // shot marks fade after this many beats: ships move, so old news goes stale
  ours: [2, 3, 3, 3], theirs: [4, 3, 3, 2],
  enemyMove: 0.12,      // chance an undamaged enemy ship moves instead of firing
  enemyRetreat: 0.35,   // chance a badly damaged one pulls back
  enemyFire: 0.8,       // chance an enemy ship has its gun ready on a beat (it reloads otherwise)
  enemyWild: 0.6,       // chance a blind enemy shot goes anywhere rather than at our home waters
};
export const CREW = ['fleet', 'gunnery', 'signals', 'engineer'];
export const OUR_NAMES = ['THE LANTERN', 'THE CINDERWAKE', 'THE GALLOWS', 'THE BRIMSTONE'];
export const THEIR_NAMES = ['THE IRON TITHE', 'THE WAILING SAINT', 'THE NINTH COIL', 'THE BLACK LEDGER'];
export const SHELLS = { broadside: 'BROADSIDE', starshell: 'STAR SHELL', beacon: 'ORANGE BEACON' };
export const SPECIALS = { gunnery: 'artillery', signals: 'scan', engineer: 'repair' };

// ---------- the flag code ----------
// Eight signal flags. A department hoists three; the Fleet Officer's codebook reads each by its position in the
// hoist (top, middle, bottom) and gives a rune. The department enters the three runes to load its special.
export const FLAGS = ['RED', 'BLUE CROSS', 'CHEQUER', 'YELLOW PENNANT', 'WHITE SWALLOWTAIL', 'BLACK BALL', 'STRIPES', 'BORDER'];
export const CODE_RUNES = 8;   // runes 0..7 on the entry pad
// CODEBOOK[position][flag] -> rune
export const CODEBOOK = [
  [3, 6, 1, 7, 0, 4, 2, 5],
  [5, 0, 7, 2, 6, 1, 4, 3],
  [1, 4, 0, 5, 3, 7, 6, 2],
];
export const flagCode = flags => flags.map((f, pos) => CODEBOOK[pos][f]);

export function makeRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const key = (x, y) => x + ',' + y;
const inside = (x, y) => x >= 0 && y >= 0 && x < SW.N && y < SW.N;
export const cellsOf = s => Array.from({ length: s.len }, (_, i) => s.dir === 'h' ? [s.x + i, s.y] : [s.x, s.y + i]);
export const sunk = s => s.hits.size >= s.len;
const alive = ships => ships.filter(s => !sunk(s));

// ---------- setting up ----------
export function newSea(seed) {
  const sea = {
    seed, rng: makeRng(seed), t: 0, beat: 0, nextBeat: SW.beat, phase: 'deploy', wave: 1,
    glaciers: [], ours: [], theirs: [], ourShots: new Map(), theirShots: new Map(),
    orders: new Map(), tokens: [], flare: null, scans: [], log: [], events: [],
    ai: { hits: [], contact: null, shot: new Map() },
    dept: {},
  };
  placeGlaciers(sea);
  sea.ours = placeFleet(sea, 'ours', SW.ours, [SW.N - SW.home, SW.N - 1]);
  sea.theirs = placeFleet(sea, 'theirs', SW.theirs, [0, SW.home - 1]);
  for (const d of ['gunnery', 'signals', 'engineer']) sea.dept[d] = newFlags(sea, d);
  return sea;
}
function placeGlaciers(sea) {
  const lo = SW.home, hi = SW.N - SW.home - 1;
  for (let tries = 0; sea.glaciers.length < SW.glaciers && tries < 500; tries++) {
    const x = Math.floor(sea.rng() * SW.N), y = lo + Math.floor(sea.rng() * (hi - lo + 1)), two = sea.rng() < 0.5;
    const cells = two ? [[x, y], [x + 1, y]] : [[x, y]];
    if (cells.some(([cx, cy]) => !inside(cx, cy) || sea.glaciers.some(g => g.cells.some(([gx, gy]) => Math.abs(gx - cx) + Math.abs(gy - cy) < 2)))) continue;
    sea.glaciers.push({ cells });
  }
}
function placeFleet(sea, side, lens, [r0, r1]) {
  const ships = [];
  lens.forEach((len, i) => {
    for (let tries = 0; tries < 2000; tries++) {
      const dir = sea.rng() < 0.5 ? 'h' : 'v';
      const s = { id: side[0] + i, side, len, dir, x: Math.floor(sea.rng() * SW.N), y: r0 + Math.floor(sea.rng() * (r1 - r0 + 1)), hits: new Set(),
        crew: side === 'ours' ? CREW[i] : null, name: (side === 'ours' ? OUR_NAMES : THEIR_NAMES)[i], marked: false, spotted: -1 };
      if (cellsOf(s).every(([x, y]) => y >= r0 && y <= r1) && !blocked(sea, s, null, ships)) { ships.push(s); return; }
    }
    throw new Error('could not place the ' + side + ' fleet');
  });
  return ships;
}
// What stands in the way of this footprint: 'edge', 'ice', a ship, or null.
function blocked(sea, s, ignore, extra = []) {
  for (const [x, y] of cellsOf(s)) {
    if (!inside(x, y)) return 'edge';
    if (sea.glaciers.some(g => g.cells.some(c => c[0] === x && c[1] === y))) return 'ice';
    for (const o of [...sea.ours, ...sea.theirs, ...extra]) if (o !== ignore && o.id !== s.id && !sunk(o) && cellsOf(o).some(c => c[0] === x && c[1] === y)) return o;
  }
  return null;
}
export const iceAt = (sea, x, y) => sea.glaciers.some(g => g.cells.some(c => c[0] === x && c[1] === y));
export const shipAt = (ships, x, y) => ships.find(s => !sunk(s) && cellsOf(s).some(c => c[0] === x && c[1] === y));

// During deployment: put one of our ships at x, y, facing dir, inside our home waters. Returns true if it fits.
export function deploy(sea, id, x, y, dir) {
  const s = sea.ours.find(o => o.id === id); if (!s || sea.phase !== 'deploy') return false;
  const t = { ...s, x, y, dir };
  if (!cellsOf(t).every(([cx, cy]) => cy >= SW.N - SW.home && cy < SW.N && cx >= 0 && cx < SW.N) || blocked(sea, t, s)) return false;
  Object.assign(s, { x, y, dir }); return true;
}
export function begin(sea) { sea.phase = 'battle'; sea.nextBeat = sea.t + SW.beat; log(sea, 'THE ENEMY FLEET IS ON THE HORIZON'); }

// ---------- what each side can see ----------
// The squares within one of any of a side's ships.
export function vision(sea, side) {
  const v = new Set();
  for (const s of alive(side === 'ours' ? sea.ours : sea.theirs)) for (const [x, y] of cellsOf(s)) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (inside(x + dx, y + dy)) v.add(key(x + dx, y + dy));
  return v;
}
// The enemy ships we can see right now, and why.
export function seenEnemies(sea) {
  const v = vision(sea, 'ours'), out = [];
  for (const s of alive(sea.theirs)) {
    const cells = cellsOf(s), lit = c => sea.flare && Math.abs(c[0] - sea.flare.x) <= 1 && Math.abs(c[1] - sea.flare.y) <= 1;
    if (s.marked || s.spotted >= sea.beat || cells.some(c => v.has(key(...c)) || lit(c))) out.push(s);
  }
  return out;
}

// ---------- orders ----------
// order: { type: 'fire', x, y } | { type: 'move', dx, dy } | { type: 'turn' } | { type: 'special', token, x, y, dir }
export function setOrder(sea, id, order) {
  const s = sea.ours.find(o => o.id === id);
  if (!s || sunk(s) || sea.phase !== 'battle') return false;
  if (!order) { sea.orders.delete(id); return true; }
  if (order.type === 'special') {
    const tk = sea.tokens.find(t => t.id === order.token); if (!tk) return false;
    for (const [oid, o] of sea.orders) if (o.type === 'special' && o.token === order.token && oid !== id) sea.orders.delete(oid);   // a token is used once
  }
  sea.orders.set(id, order); return true;
}
// Where a ship would end up after a move or a turn (the turn pivots on its second square).
export function moved(s, o) {
  if (o.type === 'move') return { ...s, x: s.x + o.dx, y: s.y + o.dy };
  if (o.type === 'turn') {
    const p = Math.min(1, s.len - 1), [px, py] = cellsOf(s)[p];
    return s.dir === 'h' ? { ...s, dir: 'v', x: px, y: py - p } : { ...s, dir: 'h', x: px - p, y: py };
  }
  return s;
}

// ---------- the department specials ----------
function newFlags(sea, dept) {
  const flags = []; while (flags.length < 3) { const f = Math.floor(sea.rng() * FLAGS.length); if (!flags.includes(f)) flags.push(f); }
  return { state: 'flags', flags, readyAt: 0 };
}
// A department enters its three runes. Gunnery also picks the shell. Returns 'loaded', 'wrong' or 'not ready'.
export function enterCode(sea, dept, runes, shell = 'broadside') {
  const d = sea.dept[dept]; if (!d || d.state !== 'flags') return 'not ready';
  const want = flagCode(d.flags);
  if (runes.length !== 3 || runes.some((r, i) => r !== want[i])) { log(sea, `${dept.toUpperCase()}: THE CODE DOES NOT MATCH THE FLAGS`); return 'wrong'; }
  const kind = dept === 'gunnery' ? (SHELLS[shell] ? shell : 'broadside') : SPECIALS[dept];
  sea.tokens.push({ id: 'k' + Math.floor(sea.rng() * 1e9), dept, kind });
  d.state = 'loaded';
  log(sea, `${dept.toUpperCase()} LOADED: ${kind === 'scan' ? 'AN AERIAL SCAN' : kind === 'repair' ? 'A REPAIR PARTY' : SHELLS[kind]}`);
  return 'loaded';
}

// ---------- time ----------
// Advance the clock; a beat resolves when it comes due. Returns the events of any beat that resolved.
export function tick(sea, dt) {
  sea.t += dt;
  for (const d of Object.values(sea.dept)) if (d.state === 'cooldown' && sea.t >= d.readyAt) Object.assign(d, newFlags(sea));
  if (sea.phase === 'battle' && sea.t >= sea.nextBeat) return resolveBeat(sea);
  return [];
}
export function ready(sea) { if (sea.phase === 'battle') return resolveBeat(sea); return []; }

function log(sea, text) { sea.log.unshift({ beat: sea.beat, text }); if (sea.log.length > 40) sea.log.pop(); }

// Both fleets act at once: moves and turns first, then every shell lands.
export function resolveBeat(sea) {
  const ev = [];
  sea.beat++; sea.nextBeat = sea.t + SW.beat;
  const theirOrders = enemyOrders(sea);
  // 1. moves and turns, ours then theirs. Steaming into a hidden ship stops you, and shows it for a beat.
  for (const [s, o] of [...[...sea.orders].map(([id, o]) => [sea.ours.find(x => x.id === id), o]), ...theirOrders]) {
    if (!s || sunk(s) || (o.type !== 'move' && o.type !== 'turn')) continue;
    const t = moved(s, o), b = blocked(sea, t, s);
    if (!b) { s.x = t.x; s.y = t.y; s.dir = t.dir; continue; }
    if (b && typeof b === 'object' && b.side !== s.side) {
      if (s.side === 'ours') { b.spotted = sea.beat; log(sea, `${s.name} NEARLY RAMMED AN ENEMY SHIP · IT IS SIGHTED`); }
      else sea.ai.contact = [b.x, b.y];
      ev.push({ type: 'ram', ship: s.id });
    } else if (s.side === 'ours') log(sea, `${s.name} COULD NOT ${o.type === 'turn' ? 'TURN' : 'MOVE'}: ${b === 'ice' ? 'ICE IN THE WAY' : b === 'edge' ? 'THE EDGE OF THE SEA' : 'A SHIP IN THE WAY'}`);
  }
  // 2. the shells
  sea.flare = null;
  const ourFire = [];
  for (const [id, o] of sea.orders) {
    const s = sea.ours.find(x => x.id === id); if (!s || sunk(s)) continue;
    if (o.type === 'fire') ourFire.push([o.x, o.y, null]);
    if (o.type === 'special') {
      const ti = sea.tokens.findIndex(t => t.id === o.token); if (ti < 0) continue;
      const tk = sea.tokens.splice(ti, 1)[0], d = sea.dept[tk.dept];
      d.state = 'cooldown'; d.readyAt = sea.t + SW.cooldown;
      if (tk.kind === 'broadside') { for (let i = -1; i <= 1; i++) ourFire.push(o.dir === 'v' ? [o.x, o.y + i, null] : [o.x + i, o.y, null]); log(sea, `${s.name} FIRES A BROADSIDE`); }
      if (tk.kind === 'beacon') ourFire.push([o.x, o.y, 'beacon']);
      if (tk.kind === 'starshell') { sea.flare = { x: o.x, y: o.y }; log(sea, `${s.name} FIRES A STAR SHELL OVER ${colName(o.x)}${o.y + 1}`); }
      if (tk.kind === 'scan') {
        let n = 0; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (shipAt(sea.theirs, o.x + dx, o.y + dy)) n++;
        sea.scans.push({ x: o.x, y: o.y, n, beat: sea.beat }); log(sea, `AERIAL SCAN OVER ${colName(o.x)}${o.y + 1}: ${n} ENEMY SQUARE${n === 1 ? '' : 'S'}`);
      }
      if (tk.kind === 'repair') {
        const r = shipAt(sea.ours, o.x, o.y) || sea.ours.find(x => cellsOf(x).some(c => c[0] === o.x && c[1] === o.y));
        if (r && r.hits.size && !sunk(r)) { r.hits.delete([...r.hits][0]); log(sea, `THE REPAIR PARTY PATCHES ${r.name}`); ev.push({ type: 'repair', ship: r.id }); }
        else log(sea, 'THE REPAIR PARTY FOUND NOTHING TO MEND');
      }
    }
  }
  for (const [x, y, beacon] of ourFire) {
    if (!inside(x, y)) continue;
    const k = key(x, y);
    if (iceAt(sea, x, y)) { sea.ourShots.set(k, { r: 'ice', beat: sea.beat }); continue; }
    const t = shipAt(sea.theirs, x, y);
    if (!t) { sea.ourShots.set(k, { r: 'miss', beat: sea.beat }); continue; }
    t.hits.add(cellsOf(t).findIndex(c => c[0] === x && c[1] === y)); sea.ourShots.set(k, { r: 'hit', beat: sea.beat });
    if (beacon) { t.marked = true; log(sea, `AN ORANGE BEACON IS LODGED IN ${t.name} · IT CANNOT HIDE`); }
    ev.push({ type: 'hit', side: 'theirs', ship: t.id, x, y });
    if (sunk(t)) { log(sea, `${t.name} IS SUNK`); ev.push({ type: 'sunk', side: 'theirs', ship: t.id }); }
  }
  for (const [s, o] of theirOrders) {
    if (o.type !== 'fire' || sunk(s)) continue;
    const k = key(o.x, o.y);
    sea.ai.shot.set(k, sea.beat);
    if (iceAt(sea, o.x, o.y)) continue;
    const t = shipAt(sea.ours, o.x, o.y);
    sea.theirShots.set(k, { r: t ? 'hit' : 'miss', beat: sea.beat });
    if (!t) continue;
    t.hits.add(cellsOf(t).findIndex(c => c[0] === o.x && c[1] === o.y));
    sea.ai.hits.push({ x: o.x, y: o.y, ship: t.id }); sea.ai.contact = [o.x, o.y];
    ev.push({ type: 'hit', side: 'ours', ship: t.id, crew: t.crew, x: o.x, y: o.y });
    log(sea, `${t.name} IS HIT`);
    if (sunk(t)) { log(sea, `${t.name} IS SUNK`); ev.push({ type: 'sunk', side: 'ours', ship: t.id, crew: t.crew }); }
  }
  sea.orders.clear();
  for (const m of [sea.ourShots, sea.theirShots]) for (const [k, v] of m) if (sea.beat - v.beat >= SW.fade) m.delete(k);
  sea.ai.hits = sea.ai.hits.filter(h => sea.beat - (sea.ai.shot.get(key(h.x, h.y)) ?? -99) < SW.fade);
  sea.scans = sea.scans.filter(s => sea.beat - s.beat < 2);
  // 3. the ice drifts
  if (sea.beat % SW.drift === 0) drift(sea);
  // 4. a wave won, or the fleet lost
  if (!alive(sea.theirs).length) {
    sea.wave++; ev.push({ type: 'wave', wave: sea.wave });
    for (const s of sea.ours) s.hits.clear();
    sea.theirs = placeFleet(sea, 'theirs', SW.theirs, [0, SW.home - 1]);
    sea.ourShots.clear(); sea.theirShots.clear(); sea.ai = { hits: [], contact: null, shot: new Map() };
    log(sea, `THE ENEMY FLEET IS SUNK · OURS IS REFITTED · WAVE ${sea.wave} IS ON THE HORIZON`);
  } else if (!alive(sea.ours).length) { sea.phase = 'lost'; ev.push({ type: 'lost' }); log(sea, 'THE FLEET IS LOST'); }
  sea.events.push(...ev);
  return ev;
}
function drift(sea) {
  for (const g of sea.glaciers) {
    const [dx, dy] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(sea.rng() * 4)];
    const cells = g.cells.map(([x, y]) => [x + dx, y + dy]);
    if (cells.some(([x, y]) => !inside(x, y) || y < SW.home || y > SW.N - SW.home - 1)) continue;
    const others = sea.glaciers.filter(o => o !== g);
    if (cells.some(([x, y]) => others.some(o => o.cells.some(c => c[0] === x && c[1] === y)) || shipAt(sea.ours, x, y) || shipAt(sea.theirs, x, y))) continue;
    g.cells = cells;
  }
}
export const colName = x => 'ABCDEFGHIJK'[x];

// ---------- the enemy ----------
// Each enemy ship fires each beat, at what it can see, then around its hits, then into the fog (mostly at our home
// waters). Now and then one moves towards its last contact; a badly damaged one pulls back.
export function enemyOrders(sea) {
  sea.ai.shot = sea.ai.shot || new Map();
  const out = [], taken = new Set(), r = sea.rng, v = vision(sea, 'theirs');
  const fresh = (x, y) => inside(x, y) && !(sea.beat - (sea.ai.shot.get(key(x, y)) ?? -99) < SW.fade) && !taken.has(key(x, y));
  const seen = alive(sea.ours).flatMap(s => cellsOf(s).filter((c, i) => !s.hits.has(i) && v.has(key(...c))));
  const openHits = sea.ai.hits.filter(h => { const s = sea.ours.find(o => o.id === h.ship); return s && !sunk(s); });
  for (const s of alive(sea.theirs)) {
    const damaged = s.hits.size * 2 >= s.len;
    if (damaged && r() < SW.enemyRetreat) { out.push([s, { type: 'move', dx: 0, dy: -1 }]); continue; }
    if (!damaged && sea.ai.contact && r() < SW.enemyMove) {
      const [cx, cy] = sea.ai.contact, dx = Math.sign(cx - s.x), dy = Math.sign(cy - s.y);
      out.push([s, Math.abs(cy - s.y) > Math.abs(cx - s.x) ? { type: 'move', dx: 0, dy } : { type: 'move', dx, dy: 0 }]); continue;
    }
    if (r() > SW.enemyFire) continue;   // reloading
    let target = seen.find(c => !taken.has(key(...c)));
    if (!target) for (const h of openHits) { const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [h.x + dx, h.y + dy]).filter(c => fresh(...c)); if (n.length) { target = n[Math.floor(r() * n.length)]; break; } }
    for (let tries = 0; !target && tries < 300; tries++) {
      const x = Math.floor(r() * SW.N), y = r() < SW.enemyWild ? SW.home + Math.floor(r() * (SW.N - SW.home)) : SW.N - SW.home - 1 + Math.floor(r() * (SW.home + 1));   // never into their own waters
      if (fresh(x, y) && (x + y) % 2 === 0) target = [x, y];
    }
    if (!target) target = [Math.floor(r() * SW.N), Math.floor(r() * SW.N)];
    taken.add(key(...target)); out.push([s, { type: 'fire', x: target[0], y: target[1] }]);
  }
  return out;
}
