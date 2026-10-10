// The fleet: the Watch's naval battle against a devil fleet. Pure, no DOM, so it runs in the game, on the stations and
// in the tests; the fleet object holds only plain data, so it travels in the snapshots.
//
// Two 12 x 12 boards: ours, and theirs, mapped by our shots. Their ships never move. Ships never touch.
// Five ships a side. Ours: the Fleet Officer's main ship (4) and their picket (2), then Gunnery's, Signals' and
// Engineering's (3 each). Theirs: 5, 4, 3, 3, 2.
// Rounds: every so often (the GM sets it; 70 s to start) both fleets fire a salvo at once, one shot for every ship
// afloat. The Fleet Officer (or, with no Fleet Officer, the operator) aims, and may fire sooner. Every hit the enemy
// lands costs it a shot the next round. Every fourth salvo the enemy also sounds a row or column of our water.
// Specials (all loaded at the start):
//   Gunnery: a heavy shell, a 2 x 2 burst (it uses one of the Watch's red or orange beacons)
//   Signals: a sounding, how many ship squares lie in one row or column
//   Engineering: a boost, one of our ships moves a square (the enemy's hits on it go stale)
//   The Fleet Officer: a crosshair scan, seven squares; enemy hulls under it are sighted (not hit)
// The departments reload theirs with a flag code (four flags, read in the Fleet Officer's codebook); every second
// reload also asks a question in Morse code. The Fleet Officer reloads the scan by decoding an enemy dispatch.
// A sunk ship of ours is salvaged: the salvage board (Engineering's flowchart) and power (Engineering's breaker panel);
// then the Fleet Officer redeploys her anywhere. With no Engineering on station, the GM relaunches her.
// While one of ours is down the enemy may shell the Watch. Bring their fleet down to one ship: ours is refitted and a
// fresh enemy fleet deploys. Lose ours: the fleet is refitted after a minute.
import { RUNES } from './glyphs.js';
import { makeRepairBoard, repairAction } from './repair.js';
import { pickQuestion } from './morse.js';

export const SIZE = 12;
export const SHIPS = [4, 2, 3, 3, 3];                   // ours
export const ENEMY_SHIPS = [5, 4, 3, 3, 2];
export const CREW = ['fleet', 'fleet', 'gunnery', 'signals', 'engineer'];
export const MAIN = { fleet: 0, gunnery: 2, signals: 3, engineer: 4 };   // the ship whose state each station shows
export const SHIP_NAMES = ['THE WARDEN', 'THE LANTERN', 'THE CINDERWAKE', 'THE GALLOWS', 'THE BRIMSTONE'];
export const ENEMY_NAMES = ['THE IRON TITHE', 'THE WAILING SAINT', 'THE BRASS PENITENT', 'THE CINDER WIDOW', 'THE HOLLOW CENSER'];
export const COL_RUNES = [0, 5, 10, 13, 2, 7, 8, 15, 1, 4, 11, 14];   // RUNES indices for the column marks
export const square = (x, y) => RUNES[COL_RUNES[x]].name.toUpperCase() + ' ' + (y + 1);
export const SALVO = 70;          // seconds between salvos, to start (the GM can change it)
export const SPECIAL_COOLDOWN = 75;
export const LOCKOUT = 60;        // a wrong Morse answer locks the department's reload this long
export const ENEMY_SONAR_EVERY = 4;
export const SHELL_FIRST = 0.5, SHELL_AFTER = 0.2;   // the chance a salvo shells the Watch while one of ours is down
export const REDEPLOY_WAIT = 3;   // salvos a salvaged ship waits to be redeployed before it is placed for you
export const REFIT_TIME = 60;     // seconds to refit after the whole fleet is lost
export const REGROUP_TIME = 90;   // seconds the enemy falls back before a full redeploy (the GM's call)

// ---------- the flag code ----------
// Twelve signal flags. A department hoists four; the Fleet Officer's codebook reads each by its place in the hoist
// and gives a rune by its house and weight. The department presses those four runes on its pad.
export const FLAGS = ['RED', 'BLUE CROSS', 'CHEQUER', 'YELLOW PENNANT', 'WHITE SWALLOWTAIL', 'BLACK BALL',
  'STRIPES', 'BORDER', 'GREEN DIAGONAL', 'BLUE TRIANGLE', 'RED SALTIRE', 'HALVES'];
export const HOIST = 4;
export const PAD = [0, 2, 5, 7, 8, 10, 13, 15];          // the eight runes on every department's pad (RUNES indices)
export const CODEBOOK = [                               // CODEBOOK[place in the hoist][flag] -> pad position
  [3, 6, 1, 7, 0, 4, 2, 5, 6, 1, 3, 0],
  [5, 0, 7, 2, 6, 1, 4, 3, 1, 7, 0, 5],
  [1, 4, 0, 5, 3, 7, 6, 2, 4, 2, 7, 6],
  [7, 2, 5, 0, 4, 6, 1, 3, 0, 5, 2, 1],
];
export const padName = i => `${RUNES[PAD[i]].house.toUpperCase()} ${RUNES[PAD[i]].weight}`;
export const flagCode = flags => flags.map((f, pos) => CODEBOOK[pos][f]);
export const SPECIAL = { gunnery: 'heavy', signals: 'sounding', engineer: 'boost', fleet: 'scan' };
export const SPECIAL_NAME = { heavy: 'HEAVY SHELL', sounding: 'SOUNDING', boost: 'BOOST', scan: 'CROSSHAIR SCAN' };
export const DEPTS = ['gunnery', 'signals', 'engineer'];

// The flags as pictures (plain SVG text): used by the stations and the Fleet Officer's book.
export function flagSVG(f, w = 54, h = 34) {
  const box = `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" fill="none" stroke="#000"/>`;
  const d = [
    `<rect width="${w}" height="${h}" fill="#d22"/>`,
    `<rect width="${w}" height="${h}" fill="#fff"/><rect x="${w / 2 - 5}" width="10" height="${h}" fill="#236"/><rect y="${h / 2 - 5}" width="${w}" height="10" fill="#236"/>`,
    `<rect width="${w}" height="${h}" fill="#fff"/>` + [0, 1, 2, 3].flatMap(i => [0, 1].map(j => `<rect x="${i * w / 4}" y="${j * h / 2}" width="${w / 4}" height="${h / 2}" fill="${(i + j) % 2 ? '#111' : '#fff'}"/>`)).join(''),
    `<polygon points="0,0 ${w},${h / 2} 0,${h}" fill="#f2c21e" stroke="#000"/>`,
    `<polygon points="0,0 ${w},0 ${w * 0.7},${h / 2} ${w},${h} 0,${h}" fill="#fff" stroke="#000"/>`,
    `<rect width="${w}" height="${h}" fill="#f2c21e"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 3}" fill="#111"/>`,
    `<rect width="${w}" height="${h}" fill="#fff"/>` + [0, 2, 4].map(i => `<rect y="${i * h / 5}" width="${w}" height="${h / 5}" fill="#d22"/>`).join(''),
    `<rect width="${w}" height="${h}" fill="#fff"/><rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="#236"/>`,
    `<rect width="${w}" height="${h}" fill="#fff"/><polygon points="0,${h} 0,${h * 0.55} ${w * 0.55},0 ${w},0" fill="#2a8a3a"/>`,
    `<rect width="${w}" height="${h}" fill="#fff"/><polygon points="0,0 ${w * 0.6},${h / 2} 0,${h}" fill="#236"/>`,
    `<rect width="${w}" height="${h}" fill="#fff"/><path d="M0 0L${w} ${h}M${w} 0L0 ${h}" stroke="#d22" stroke-width="8"/>`,
    `<rect width="${w}" height="${h}" fill="#f2c21e"/><rect width="${w / 2}" height="${h}" fill="#d22"/>`,
  ][f];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${d}${f === 3 || f === 4 ? '' : box}</svg>`;
}

// ---------- ships ----------
export const key = (x, y) => x + ',' + y;
export function cellsOf(s) {
  if (!s || s.x == null) return [];
  return Array.from({ length: s.len }, (_, i) => s.dir === 'h' ? [s.x + i, s.y] : [s.x, s.y + i]);
}
export const sunk = s => s.hits.length >= s.len;
export const afloat = ships => ships.filter(s => s.x != null && !sunk(s));
const inside = ([x, y]) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
// Can ship i sit where it is? On the board, and not touching another ship (not even at a corner). Sunk ships of ours
// waiting for salvage do not count: their wrecks are under the water.
export function fits(ships, i, ignoreSunk = false) {
  const mine = cellsOf(ships[i]);
  if (!mine.length || !mine.every(inside)) return false;
  return ships.every((o, j) => j === i || (ignoreSunk && sunk(o)) || cellsOf(o).every(([ox, oy]) => mine.every(([x, y]) => Math.abs(ox - x) > 1 || Math.abs(oy - y) > 1)));
}
export function randomFleet(rng, lens) {
  for (;;) {
    const ships = [];
    for (const len of lens) {
      let placed = false;
      for (let k = 0; k < 400 && !placed; k++) {
        ships.push({ len, x: Math.floor(rng() * SIZE), y: Math.floor(rng() * SIZE), dir: rng() < 0.5 ? 'h' : 'v', hits: [] });
        if (fits(ships, ships.length - 1)) placed = true; else ships.pop();
      }
      if (!placed) break;
    }
    if (ships.length === lens.length) return ships;
  }
}
const ourShips = () => SHIPS.map((len, i) => ({ len, x: null, y: null, dir: 'h', hits: [], crew: CREW[i] }));
function flags(rng) { const f = []; while (f.length < HOIST) { const n = Math.floor(rng() * FLAGS.length); if (!f.includes(n)) f.push(n); } return f; }
const freshDept = rng => ({ state: 'loaded', flags: flags(rng), readyAt: 0, reloads: 0, question: null });

export function newFleet(rng) {
  return {
    phase: 'deploy', mine: ourShips(), enemy: randomFleet(rng, ENEMY_SHIPS),
    marks: {},        // our shots on their board: key -> 'hit' | 'miss' | 'clear' | 'seen'
    theirShots: {},   // their shots on ours: key -> 'hit' | 'miss'
    aim: [], plan: {}, loaded: { heavy: true, sounding: true, boost: true, scan: true }, soundings: [], salvage: {},
    dept: Object.fromEntries(DEPTS.map(d => [d, freshDept(rng)])),
    round: 0, wave: 1, wins: 0, losses: 0, salvoEvery: SALVO, nextSalvo: null, reload: 0, shellsDown: 0,
    refitUntil: null, regroupUntil: null, enemySonar: null, scanned: [],
    ai: { shot: {}, hits: [], focus: null }, last: null, log: [],
  };
}
function log(f, t, text, kind = '') { f.log.push({ t, text, kind }); if (f.log.length > 40) f.log.shift(); }

// ---------- deployment ----------
export function placeShip(f, i, x, y, dir) {
  if (f.phase !== 'deploy' || !f.mine[i]) return false;
  const was = { ...f.mine[i] }; Object.assign(f.mine[i], { x, y, dir });
  if (!fits(f.mine, i)) { Object.assign(f.mine[i], was); return false; }
  return true;
}
export const allPlaced = f => f.mine.every(s => s.x != null);
export function randomDeploy(f, rng) { const r = randomFleet(rng, SHIPS); f.mine.forEach((s, i) => Object.assign(s, { x: r[i].x, y: r[i].y, dir: r[i].dir, hits: [] })); }
export function begin(f, t) { if (f.phase !== 'deploy' || !allPlaced(f)) return false; f.phase = 'play'; f.nextSalvo = t + f.salvoEvery; log(f, t, 'THE ENEMY FLEET IS ON THE HORIZON', 'info'); return true; }

// ---------- aiming ----------
export const shotsAllowed = f => afloat(f.mine).length;
export function toggleAim(f, x, y) {
  if (f.phase !== 'play') return false;
  const i = f.aim.findIndex(a => a[0] === x && a[1] === y);
  if (i >= 0) { f.aim.splice(i, 1); return true; }
  const m = f.marks[key(x, y)];
  if (!inside([x, y]) || f.aim.length >= shotsAllowed(f) || (m && m !== 'seen')) return false;
  f.aim.push([x, y]); return true;
}

// ---------- specials ----------
export const deptName = d => ({ gunnery: 'GUNNERY', signals: 'SIGNALS', engineer: 'ENGINEERING', fleet: 'THE FLEET OFFICER' })[d];
// A department enters its four runes. Returns 'loaded', 'question' (a Morse question follows), 'wrong' or 'not ready'.
export function enterCode(f, dept, runes, t, rng = Math.random) {
  const d = f.dept[dept]; if (!d || d.state !== 'flags') return 'not ready';
  const want = flagCode(d.flags);
  if (!Array.isArray(runes) || runes.length !== HOIST || runes.some((r, i) => r !== want[i])) { log(f, t, `${deptName(dept)}: THE CODE DOES NOT MATCH THE FLAGS`, 'struck'); return 'wrong'; }
  if ((d.reloads + 1) % 2 === 0) { d.state = 'question'; d.question = pickQuestion(rng); return 'question'; }   // every second reload
  return loadDept(f, dept, t);
}
function loadDept(f, dept, t) {
  const d = f.dept[dept]; d.state = 'loaded'; d.question = null; d.reloads++; f.loaded[SPECIAL[dept]] = true;
  log(f, t, `${deptName(dept)} LOADED A ${SPECIAL_NAME[SPECIAL[dept]]}`, 'info');
  return 'loaded';
}
// The Morse question's answer (an index into its three options). Wrong: no reload for a minute, then new flags.
export function answerQuestion(f, dept, choice, t) {
  const d = f.dept[dept]; if (!d || d.state !== 'question' || !d.question) return 'not ready';
  if (choice === d.question.answer) return loadDept(f, dept, t);
  Object.assign(d, { state: 'cooldown', readyAt: t + LOCKOUT, question: null, locked: true });
  log(f, t, `${deptName(dept)} ANSWERED THE MORSE WRONG · NO RELOAD FOR A MINUTE`, 'struck');
  return 'wrong';
}
// The GM loads a special outright (a department's, or the Fleet Officer's scan).
export function forceLoad(f, dept, t) {
  if (dept === 'fleet') { f.loaded.scan = true; log(f, t, 'THE CROSSHAIR SCAN IS READY', 'info'); return true; }
  if (!f.dept[dept]) return false;
  return loadDept(f, dept, t) === 'loaded';
}
export const reloadScan = (f, t) => { f.loaded.scan = true; log(f, t, 'A DISPATCH DECODED · THE CROSSHAIR SCAN IS READY', 'info'); };
// Plan a loaded special for this salvo (or clear it with args = null).
//   heavy: { x, y } the top-left of the 2 x 2 · sounding: { line: 'row' | 'col', n } · boost: { ship, dx, dy }
//   scan: { x, y, dir } the centre of the crosshair; dir 'v' or 'h' is its long arm
export function planSpecial(f, kind, args) {
  if (f.phase !== 'play' || !f.loaded[kind]) return false;
  if (!args) { delete f.plan[kind]; return true; }
  const c = v => Math.max(0, Math.min(SIZE - 1, v | 0));
  if (kind === 'heavy') { f.plan.heavy = { x: Math.min(SIZE - 2, c(args.x)), y: Math.min(SIZE - 2, c(args.y)) }; return true; }
  if (kind === 'sounding') { if (!['row', 'col'].includes(args.line)) return false; f.plan.sounding = { line: args.line, n: c(args.n) }; return true; }
  if (kind === 'scan') { f.plan.scan = { x: c(args.x), y: c(args.y), dir: args.dir === 'h' ? 'h' : 'v' }; return true; }
  if (kind === 'boost') {
    const s = f.mine[args.ship]; if (!s || sunk(s) || s.x == null || Math.abs(args.dx) + Math.abs(args.dy) !== 1) return false;
    const t = f.mine.map((o, j) => j === args.ship ? { ...o, x: o.x + args.dx, y: o.y + args.dy } : o);
    if (!fits(t, args.ship, true)) return false;
    f.plan.boost = { ship: args.ship, dx: args.dx, dy: args.dy }; return true;
  }
  return false;
}
// The crosshair: the centre, one square each way on the short arm, two each way on the long arm.
export const crosshairCells = (x, y, dir = 'v') => [[0, 0], ...(dir === 'v' ? [[0, -1], [0, -2], [0, 1], [0, 2], [-1, 0], [1, 0]] : [[-1, 0], [-2, 0], [1, 0], [2, 0], [0, -1], [0, 1]])].map(([dx, dy]) => [x + dx, y + dy]).filter(inside);
function spend(f, kind, t) {
  delete f.loaded[kind]; delete f.plan[kind];
  const dept = DEPTS.find(d => SPECIAL[d] === kind);
  if (dept) Object.assign(f.dept[dept], { state: 'cooldown', readyAt: t + SPECIAL_COOLDOWN, question: null, locked: false });
}
// One of our ships has moved (boost, redeploy): the enemy's hits on where she was are stale.
function forget(f, oldCells) { f.ai.hits = f.ai.hits.filter(([x, y]) => !oldCells.some(c => c[0] === x && c[1] === y)); }

// ---------- salvage ----------
export function salvageSet(f, i, row, action) { const s = f.salvage[i]; if (!s || s.done || !s.board.rows[row]) return false; s.board.rows[row].set = action; return true; }
export function salvageSend(f, i, t) {
  const s = f.salvage[i]; if (!s || s.done) return null;
  if (s.board.rows.some(r => !r.set)) return null;
  const ok = s.board.rows.every(r => r.set === repairAction('engineer', r));
  if (ok) { s.done = true; log(f, t, `SALVAGE CREW ON ${SHIP_NAMES[i]}: THE HULL IS SOUND${s.power ? ' · READY TO REDEPLOY' : ' · SHE NEEDS POWER FROM ENGINEERING'}`, 'info'); readyIf(f, i); }
  else { s.board.rows.forEach(r => { r.set = null; }); log(f, t, `THE SALVAGE ON ${SHIP_NAMES[i]} WENT WRONG · RESET`, 'struck'); }
  return ok;
}
// Engineering's breaker panel powers a sunk ship (the oldest first). Returns the ship, or -1 if none needed it.
export function salvagePower(f, t) {
  const waiting = Object.entries(f.salvage).filter(([, s]) => !s.power).sort((a, b) => a[1].since - b[1].since);
  if (!waiting.length) return -1;
  const [i, s] = waiting[0]; s.power = true; log(f, t, `ENGINEERING POWERED ${SHIP_NAMES[i]}${s.done ? ' · READY TO REDEPLOY' : ' · THE SALVAGE BOARD IS STILL TO DO'}`, 'info');
  readyIf(f, Number(i));
  return Number(i);
}
function readyIf(f, i) { const s = f.salvage[i]; if (s && s.done && s.power && s.readyRound == null) s.readyRound = f.round; }
export const needsPower = f => Object.values(f.salvage).some(s => !s.power);
// Relaunch a salvaged ship where the commander puts her (anywhere free), or at random. Returns true if she is back.
export const salvageReady = (f, i) => !!(f.salvage[i] && f.salvage[i].done && f.salvage[i].power);
export function redeploy(f, i, x, y, dir, t, force = false) {
  const s = f.mine[i]; if (!s || !f.salvage[i] || f.phase !== 'play' || (!force && !salvageReady(f, i))) return false;
  const old = cellsOf(s), was = { x: s.x, y: s.y, dir: s.dir };
  Object.assign(s, { x, y, dir });
  if (!fits(f.mine, i, true)) { Object.assign(s, was); return false; }
  s.hits = []; delete f.salvage[i]; forget(f, old);
  log(f, t, `${SHIP_NAMES[i]} IS RELAUNCHED`, 'info');
  return true;
}
export function redeployRandom(f, i, rng, t, force = false) {
  for (let k = 0; k < 800; k++) if (redeploy(f, i, Math.floor(rng() * SIZE), Math.floor(rng() * SIZE), rng() < 0.5 ? 'h' : 'v', t, force)) return true;
  return false;
}

// Minesweeping's reward: one square of an enemy ship nobody has hit is marked for the gunners.
export function canSpot(f) { return f.phase === 'play' && f.enemy.some(s => !sunk(s) && cellsOf(s).some(c => !f.marks[key(...c)])); }
export function spot(f, rng, t) {
  const cells = f.enemy.filter(s => !sunk(s)).flatMap(s => cellsOf(s)).filter(c => !f.marks[key(...c)]);
  if (!cells.length) return null;
  const c = cells[Math.floor(rng() * cells.length)]; f.marks[key(...c)] = 'seen';
  log(f, t, `SIGNALS SWEPT THE APPROACHES · AN ENEMY HULL IS SIGHTED AT ${square(...c)}`, 'info');
  return c;
}
// A beacon lodged in a disguised warship in the ice: its sister ship at sea shows on our tables, whole.
export function revealShip(f, rng, t) {
  const pool = f.enemy.map((s, i) => i).filter(i => !sunk(f.enemy[i]) && cellsOf(f.enemy[i]).some(c => f.marks[key(...c)] !== 'hit'));
  if (!pool.length || f.phase !== 'play') return -1;
  const i = pool[Math.floor(rng() * pool.length)];
  for (const c of cellsOf(f.enemy[i])) if (f.marks[key(...c)] !== 'hit') f.marks[key(...c)] = 'seen';
  log(f, t, `A BEACON IN A DISGUISED WARSHIP · ${ENEMY_NAMES[i]} IS PLOTTED ON OUR TABLES`, 'info');
  return i;
}
// A hit on one of our ships by other means (the GM, or the Fleet Officer losing the depth-charge fight). The enemy
// learns where she is. Returns events.
export function hitOurs(f, i, rng, t, why = '') {
  const s = f.mine[i]; if (!s || sunk(s) || s.x == null) return [];
  const free = cellsOf(s).map((c, j) => j).filter(j => !s.hits.includes(j));
  const j = free[Math.floor(rng() * free.length)], c = cellsOf(s)[j];
  s.hits.push(j); f.theirShots[key(...c)] = 'hit'; f.ai.shot[key(...c)] = true; f.ai.hits.push(c);
  log(f, t, `${SHIP_NAMES[i]} IS HIT${why}`, 'struck');
  const ev = [{ type: 'fleethit', ship: i, crew: s.crew }];
  if (sunk(s)) ev.push(...sinkOurs(f, i, rng, t));
  return ev;
}
export function hitTheirs(f, i, t) {
  const s = f.enemy[i]; if (!s || sunk(s)) return [];
  const j = cellsOf(s).map((c, k) => k).find(k => !s.hits.includes(k)), c = cellsOf(s)[j];
  s.hits.push(j); f.marks[key(...c)] = 'hit';
  const ev = [];
  if (sunk(s)) { log(f, t, `${ENEMY_NAMES[i]} (${s.len} LONG) IS SUNK`, 'hit'); outline(f, s); ev.push({ type: 'fleetsunk', side: 'theirs', ship: i }); }
  else log(f, t, `HIT ON ${square(...c)}: A ${s.len}-LONG SHIP`, 'hit');
  return ev;
}
function sinkOurs(f, i, rng, t) {
  log(f, t, `${SHIP_NAMES[i]} IS SUNK`, 'struck');
  f.salvage[i] = { board: makeRepairBoard('engineer', rng), done: false, power: false, since: f.round, readyRound: null };
  return [{ type: 'fleetsunk', side: 'ours', ship: i, crew: f.mine[i].crew }];
}

// ---------- the round ----------
// ctx: { t, rng, engineerLive, spendBeacon(): bool, shellReady(): bool }. Returns events.
export function tick(f, ctx) {
  const ev = [];
  for (const d of DEPTS) { const st = f.dept[d]; if (st.state === 'cooldown' && ctx.t >= st.readyAt) Object.assign(st, { state: 'flags', flags: flags(ctx.rng), question: null, locked: false }); }
  if (f.phase === 'refit' && ctx.t >= f.refitUntil) refit(f, ctx, ev);
  if (f.phase === 'regroup' && ctx.t >= f.regroupUntil) {
    f.enemy = randomFleet(ctx.rng, ENEMY_SHIPS); clearTables(f); f.phase = 'play'; f.regroupUntil = null; f.nextSalvo = ctx.t + f.salvoEvery;
    log(f, ctx.t, 'ENEMY SHIPS REDEPLOYED · THEIR WATERS ARE UNKNOWN AGAIN', 'info'); ev.push({ type: 'fleetregrouped' });
  }
  if (f.phase === 'play' && f.nextSalvo != null && ctx.t >= f.nextSalvo) ev.push(...salvo(f, ctx));
  ev.push(...checkEnd(f, ctx.rng, ctx.t));   // a hit outside the salvo (the GM, the depth charges) can end it too
  if (f.phase === 'play' && f.nextSalvo == null) f.nextSalvo = ctx.t + f.salvoEvery;   // failsafe: the clock always runs
  return ev;
}
// The GM's call: the enemy falls back to await reinforcements, then a whole new fleet deploys.
export function regroup(f, t) { if (f.phase !== 'play') return false; f.phase = 'regroup'; f.regroupUntil = t + REGROUP_TIME; f.aim = []; log(f, t, `THE ENEMY FALLS BACK TO AWAIT REINFORCEMENTS · A NEW FLEET IN ${REGROUP_TIME} s`, 'info'); return true; }

export function salvo(f, ctx) {
  if (f.phase !== 'play') return [];
  const { t, rng } = ctx, ev = [];
  f.round++; f.nextSalvo = t + f.salvoEvery;
  const theirAim = enemyAim(f, rng);
  const ours = [], theirs = [], used = {};
  // specials first: the boost moves, the sounding and the scan read the water as it stands, the heavy shell joins
  const extra = [];
  if (f.plan.boost) {
    const p = f.plan.boost, s = f.mine[p.ship], moved = f.mine.map((o, j) => j === p.ship ? { ...o, x: o.x + p.dx, y: o.y + p.dy } : o);
    if (s && !sunk(s) && fits(moved, p.ship, true)) { const old = cellsOf(s); s.x += p.dx; s.y += p.dy; forget(f, old); log(f, t, `ENGINEERING BOOSTS ${SHIP_NAMES[p.ship]} ONE SQUARE`, 'info'); ev.push({ type: 'fleetboost', ship: p.ship }); used.boost = { ship: p.ship, dx: p.dx, dy: p.dy }; }
    spend(f, 'boost', t);
  }
  if (f.plan.sounding) {
    const p = f.plan.sounding; let count = 0;
    for (let i = 0; i < SIZE; i++) { const [x, y] = p.line === 'row' ? [i, p.n] : [p.n, i]; if (f.enemy.some(s => cellsOf(s).some(c => c[0] === x && c[1] === y))) count++; }
    f.soundings.push({ line: p.line, n: p.n, count, round: f.round });
    log(f, t, `SOUNDING ${p.line === 'row' ? 'ROW ' + (p.n + 1) : 'COLUMN ' + RUNES[COL_RUNES[p.n]].name.toUpperCase()}: ${count} SHIP SQUARE${count === 1 ? '' : 'S'}`, 'info');
    ev.push({ type: 'fleetsounding', line: p.line, n: p.n, count }); used.sounding = { line: p.line, n: p.n };
    spend(f, 'sounding', t);
  }
  if (f.plan.scan) {
    const p = f.plan.scan, cells = crosshairCells(p.x, p.y, p.dir); let found = 0;
    for (const c of cells) if (f.enemy.some(s => !sunk(s) && cellsOf(s).some(q => q[0] === c[0] && q[1] === c[1])) && f.marks[key(...c)] !== 'hit') { f.marks[key(...c)] = 'seen'; found++; }
    f.scanned = cells; log(f, t, `CROSSHAIR SCAN ON ${square(p.x, p.y)}: ${found} ENEMY SQUARE${found === 1 ? '' : 'S'} SIGHTED`, 'info');
    ev.push({ type: 'fleetscan', found }); used.scan = cells;
    spend(f, 'scan', t);
  }
  if (f.plan.heavy) {
    if (ctx.spendBeacon && ctx.spendBeacon()) { const p = f.plan.heavy; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) extra.push([p.x + dx, p.y + dy]); log(f, t, `A HEAVY SHELL ON ${square(p.x, p.y)}`, 'info'); spend(f, 'heavy', t); ev.push({ type: 'fleetheavy' }); used.heavy = { x: p.x, y: p.y }; }
    else { log(f, t, 'NO RED OR ORANGE BEACON TO FIRE THE HEAVY SHELL', 'struck'); delete f.plan.heavy; }
  }
  // our salvo
  for (const [x, y] of [...f.aim, ...extra]) {
    const k = key(x, y); if (!inside([x, y]) || f.marks[k] === 'hit') continue;
    const i = f.enemy.findIndex(s => cellsOf(s).some(c => c[0] === x && c[1] === y));
    if (i < 0) { f.marks[k] = 'miss'; ours.push([x, y, 'miss']); continue; }
    const s = f.enemy[i], idx = cellsOf(s).findIndex(c => c[0] === x && c[1] === y);
    if (!s.hits.includes(idx)) s.hits.push(idx);
    f.marks[k] = 'hit'; ours.push([x, y, 'hit']);
    if (sunk(s)) { log(f, t, `${ENEMY_NAMES[i]} (${s.len} LONG) IS SUNK`, 'hit'); ev.push({ type: 'fleetsunk', side: 'theirs', ship: i }); outline(f, s); }
    else log(f, t, `HIT ON ${square(x, y)}: A ${s.len}-LONG SHIP`, 'hit');
  }
  if (f.aim.length && !ours.some(o => o[2] === 'hit')) log(f, t, `SALVO ${f.round}: ${ours.length} SHOT${ours.length === 1 ? '' : 'S'}, NO HITS`, 'miss');
  f.aim = [];
  // their salvo; every hit costs them a shot next round
  let landed = 0;
  for (const [x, y] of theirAim) {
    f.ai.shot[key(x, y)] = true;
    const i = f.mine.findIndex(s => !sunk(s) && cellsOf(s).some(c => c[0] === x && c[1] === y));
    f.theirShots[key(x, y)] = i < 0 ? 'miss' : 'hit'; theirs.push([x, y, i < 0 ? 'miss' : 'hit']);
    if (i < 0) continue;
    const s = f.mine[i], idx = cellsOf(s).findIndex(c => c[0] === x && c[1] === y);
    if (s.hits.includes(idx)) continue;
    s.hits.push(idx); f.ai.hits.push([x, y]); landed++;
    ev.push({ type: 'fleethit', ship: i, crew: s.crew });
    if (sunk(s)) ev.push(...sinkOurs(f, i, rng, t)); else log(f, t, `${SHIP_NAMES[i]} IS HIT`, 'struck');
  }
  f.reload = landed;
  // every fourth salvo the enemy sounds a row or column of our water (we see where)
  if (f.round % ENEMY_SONAR_EVERY === 0) ev.push(enemySonar(f, rng, t));
  f.last = { round: f.round, t, ours, theirs, used };
  // a salvaged ship left waiting is put back for you
  for (const [i, s] of Object.entries(f.salvage)) if (s.readyRound != null && f.round - s.readyRound >= REDEPLOY_WAIT && redeployRandom(f, Number(i), rng, t)) ev.push({ type: 'fleetrelaunch', ship: Number(i), crew: f.mine[i].crew });
  // while one of ours is down the enemy may shell the Watch: half the time at first, then one salvo in five
  if (!Object.keys(f.salvage).length) f.shellsDown = 0;
  else if ((!ctx.shellReady || ctx.shellReady()) && rng() < (f.shellsDown ? SHELL_AFTER : SHELL_FIRST)) { f.shellsDown++; ev.push({ type: 'fleetshell' }); }
  ev.push(...checkEnd(f, rng, t));
  ev.push({ type: 'fleetsalvo', ours, theirs });
  return ev;
}
// The end of a wave (one enemy ship left: the last one runs), or of our fleet.
function checkEnd(f, rng, t) {
  if (f.phase !== 'play') return [];
  if (afloat(f.enemy).length <= 1) {
    f.wins++; f.wave++;
    for (const s of f.mine) s.hits = [];
    f.enemy = randomFleet(rng, ENEMY_SHIPS); clearTables(f); f.salvage = {}; f.shellsDown = 0;
    log(f, t, 'THE ENEMY FLEET IS BROKEN · OURS IS REFITTED · A NEW FLEET IS ON THE HORIZON', 'info'); return [{ type: 'fleetwin' }];
  }
  if (!afloat(f.mine).length) {
    f.losses++; f.phase = 'refit'; f.refitUntil = t + REFIT_TIME; f.aim = []; f.plan = {};
    log(f, t, 'THE FLEET IS LOST · IT IS REFITTED IN A MINUTE', 'struck'); return [{ type: 'fleetlost' }];
  }
  return [];
}
function clearTables(f) { f.marks = {}; f.theirShots = {}; f.aim = []; f.soundings = []; f.scanned = []; f.ai = { shot: {}, hits: [], focus: null }; f.reload = 0; f.plan = {}; f.enemySonar = null; }
function refit(f, ctx, ev) {
  randomDeploy(f, ctx.rng); f.enemy = randomFleet(ctx.rng, ENEMY_SHIPS); clearTables(f); f.salvage = {}; f.shellsDown = 0;
  f.phase = 'play'; f.nextSalvo = ctx.t + f.salvoEvery; f.refitUntil = null;
  log(f, ctx.t, 'THE FLEET IS REFITTED AND BACK ON STATION', 'info'); ev.push({ type: 'fleetrefit' });
}
// A sunk ship shows itself, and (ships never touch) the water round it is clear.
function outline(f, s) {
  for (const [x, y] of cellsOf(s)) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const k = key(x + dx, y + dy); if (inside([x + dx, y + dy]) && (!f.marks[k] || f.marks[k] === 'seen')) f.marks[k] = 'clear';
  }
}

// ---------- the enemy ----------
// Its sonar: the row or column it knows least about. If ours are there, it forgets what it thought it knew of that
// line (a ship may have been redeployed onto water it had cleared) and works along it.
export function enemySonar(f, rng, t, line, n) {
  if (line == null) {
    let best = null;
    for (const l of ['row', 'col']) for (let k = 0; k < SIZE; k++) {
      let unknown = 0; for (let i = 0; i < SIZE; i++) { const [x, y] = l === 'row' ? [i, k] : [k, i]; if (!f.ai.shot[key(x, y)]) unknown++; }
      const score = unknown + rng() * 3; if (!best || score > best.score) best = { l, k, score };
    }
    line = best.l; n = best.k;
  }
  let count = 0; const cells = [];
  for (let i = 0; i < SIZE; i++) { const [x, y] = line === 'row' ? [i, n] : [n, i]; cells.push([x, y]); if (f.mine.some(s => !sunk(s) && cellsOf(s).some((c, j) => c[0] === x && c[1] === y && !s.hits.includes(j)))) count++; }
  if (count) { for (const c of cells) if (f.theirShots[key(...c)] !== 'hit') delete f.ai.shot[key(...c)]; f.ai.focus = { line, n }; }
  f.enemySonar = { line, n, count, round: f.round };
  log(f, t, `THE ENEMY SOUNDS OUR ${line === 'row' ? 'ROW ' + (n + 1) : 'COLUMN ' + RUNES[COL_RUNES[n]].name.toUpperCase()}`, 'struck');
  return { type: 'fleetenemysonar', line, n, count };
}
// One shot per ship afloat, less one for every hit it landed last round. It works round its hits (along a line once
// it has two), then along a line its sonar found us in, then hunts on a chequerboard.
export function enemyAim(f, rng) {
  const n = Math.max(1, afloat(f.enemy).length - (f.reload || 0)), out = [], taken = new Set(), ai = f.ai;
  const fresh = (x, y) => inside([x, y]) && !ai.shot[key(x, y)] && !taken.has(key(x, y));
  // hits on a ship of ours still afloat and still there are live; the rest are dropped once tried round
  ai.hits = ai.hits.filter(([x, y]) => f.mine.some(s => !sunk(s) && cellsOf(s).some(c => c[0] === x && c[1] === y)) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fresh(x + dx, y + dy)));
  const targets = [];
  for (const [x, y] of ai.hits) {
    const line = ai.hits.filter(([a, b]) => (a === x && Math.abs(b - y) === 1) || (b === y && Math.abs(a - x) === 1));
    const dirs = line.length ? (line[0][0] === x ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) { let k = 1; while (ai.hits.some(([a, b]) => a === x + dx * k && b === y + dy * k)) k++; if (fresh(x + dx * k, y + dy * k)) targets.push([x + dx * k, y + dy * k]); }
  }
  const focus = [];
  if (ai.focus) { for (let i = 0; i < SIZE; i++) { const c = ai.focus.line === 'row' ? [i, ai.focus.n] : [ai.focus.n, i]; if (fresh(...c)) focus.push(c); } if (!focus.length) ai.focus = null; }
  for (let i = 0; i < n; i++) {
    let tg = null;
    const c = targets.filter(([x, y]) => fresh(x, y)); if (c.length) tg = c[Math.floor(rng() * c.length)];
    if (!tg) { const fc = focus.filter(([x, y]) => fresh(x, y)); if (fc.length) tg = fc[Math.floor(rng() * fc.length)]; }
    for (let tries = 0; !tg && tries < 400; tries++) { const x = Math.floor(rng() * SIZE), y = Math.floor(rng() * SIZE); if (fresh(x, y) && (x + y) % 2 === 0) tg = [x, y]; }
    for (let tries = 0; !tg && tries < 400; tries++) { const x = Math.floor(rng() * SIZE), y = Math.floor(rng() * SIZE); if (fresh(x, y)) tg = [x, y]; }
    if (tg) { taken.add(key(...tg)); out.push(tg); }
  }
  return out;
}
