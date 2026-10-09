// The fleet: the Watch's naval battle against a devil fleet. "Salvo & Soundings". Pure, no DOM, so it runs in the
// game, on the stations and in the tests; the fleet object holds only plain data, so it travels in the snapshots.
//
// Two 12 x 12 boards: ours, and theirs, mapped by our shots. Their ships never move. Ships never touch.
// Rounds: every so often (the GM sets it; 70 s to start) both fleets fire a salvo at once, one shot for every ship
// afloat. The Fleet Officer (or, with no Fleet Officer, the operator) aims, and may fire sooner. Every hit the enemy
// lands costs it a shot the next round: its guns have to reload.
// The departments load specials with a flag code that only the Fleet Officer's codebook reads:
//   Gunnery: a heavy shell, a 2 x 2 burst (it uses one of the Watch's red or orange beacons)
//   Signals: a sounding, how many ship squares lie in one row or column
//   Engineering: a boost, one of our ships moves a square (the enemy's hits on it go stale)
// A sunk ship of ours is salvaged: the Fleet Officer works the salvage board with Engineering's flowchart, and
// Engineering's breaker panel powers it up. With no Engineering on station it relaunches by itself after a few rounds.
// While one of ours is down the enemy has a line on the Watch, and now and then shells it.
// Sink their fleet: ours is refitted, and a new fleet comes. Lose ours: the fleet is refitted after a minute.
import { RUNES } from './glyphs.js';
import { makeRepairBoard, repairAction } from './repair.js';

export const SIZE = 12;
export const SHIPS = [2, 3, 3, 3];                      // ours: the flagship, then the departments' ships
export const ENEMY_SHIPS = [4, 3, 3, 2];
export const CREW = ['fleet', 'gunnery', 'signals', 'engineer'];
export const SHIP_NAMES = ['THE LANTERN', 'THE CINDERWAKE', 'THE GALLOWS', 'THE BRIMSTONE'];
export const ENEMY_NAMES = ['THE WAILING TITHE', 'THE BRASS PENITENT', 'THE CINDER WIDOW', 'THE HOLLOW CENSER'];
export const COL_RUNES = [0, 5, 10, 13, 2, 7, 8, 15, 1, 4, 11, 14];   // RUNES indices for the column marks
export const square = (x, y) => RUNES[COL_RUNES[x]].name.toUpperCase() + ' ' + (y + 1);
export const SALVO = 70;          // seconds between salvos, to start (the GM can change it)
export const SPECIAL_COOLDOWN = 75;
export const SALVAGE_AUTO = 5;    // rounds before a sunk ship relaunches by itself (with no Engineering on station)
export const SHELL_EVERY = 3;     // rounds between shells on the Watch while one of ours is down
export const REFIT_TIME = 60;     // seconds to refit after the whole fleet is lost

// ---------- the flag code ----------
// Twelve signal flags. A department hoists three; the Fleet Officer's codebook reads each by its place in the hoist
// and gives a rune by its house and weight. The department presses those three runes on its pad.
export const FLAGS = ['RED', 'BLUE CROSS', 'CHEQUER', 'YELLOW PENNANT', 'WHITE SWALLOWTAIL', 'BLACK BALL',
  'STRIPES', 'BORDER', 'GREEN DIAGONAL', 'BLUE TRIANGLE', 'RED SALTIRE', 'HALVES'];
export const PAD = [0, 2, 5, 7, 8, 10, 13, 15];          // the eight runes on every department's pad (RUNES indices)
export const CODEBOOK = [                               // CODEBOOK[place in the hoist][flag] -> pad position
  [3, 6, 1, 7, 0, 4, 2, 5, 6, 1, 3, 0],
  [5, 0, 7, 2, 6, 1, 4, 3, 1, 7, 0, 5],
  [1, 4, 0, 5, 3, 7, 6, 2, 4, 2, 7, 6],
];
export const padName = i => `${RUNES[PAD[i]].house.toUpperCase()} ${RUNES[PAD[i]].weight}`;
export const flagCode = flags => flags.map((f, pos) => CODEBOOK[pos][f]);
export const SPECIAL = { gunnery: 'heavy', signals: 'sounding', engineer: 'boost' };
export const SPECIAL_NAME = { heavy: 'HEAVY SHELL', sounding: 'SOUNDING', boost: 'BOOST' };
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
  if (s.x == null) return [];
  return Array.from({ length: s.len }, (_, i) => s.dir === 'h' ? [s.x + i, s.y] : [s.x, s.y + i]);
}
export const sunk = s => s.hits.length >= s.len;
export const afloat = ships => ships.filter(s => s.x != null && !sunk(s));
const inside = ([x, y]) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
// Can ship i sit where it is? On the board, and not touching another ship (not even at a corner).
export function fits(ships, i) {
  const mine = cellsOf(ships[i]);
  if (!mine.length || !mine.every(inside)) return false;
  return ships.every((o, j) => j === i || cellsOf(o).every(([ox, oy]) => mine.every(([x, y]) => Math.abs(ox - x) > 1 || Math.abs(oy - y) > 1)));
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
function flags(rng) { const f = []; while (f.length < 3) { const n = Math.floor(rng() * FLAGS.length); if (!f.includes(n)) f.push(n); } return f; }

export function newFleet(rng) {
  return {
    phase: 'deploy', mine: ourShips(), enemy: randomFleet(rng, ENEMY_SHIPS),
    marks: {},        // our shots on their board: key -> 'hit' | 'miss' | 'clear' | 'seen'
    theirShots: {},   // their shots on ours: key -> 'hit' | 'miss'
    aim: [], plan: {}, loaded: {}, soundings: [], salvage: {},
    dept: Object.fromEntries(DEPTS.map(d => [d, { state: 'flags', flags: flags(rng), readyAt: 0 }])),
    round: 0, wave: 1, wins: 0, losses: 0, salvoEvery: SALVO, nextSalvo: null, reload: 0, shellRound: null, refitUntil: null,
    ai: { shot: {}, hits: [] }, last: null, log: [],
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
// A department enters the three runes (pad positions). Returns 'loaded', 'wrong' or 'not ready'.
export function enterCode(f, dept, runes, t) {
  const d = f.dept[dept]; if (!d || d.state !== 'flags') return 'not ready';
  const want = flagCode(d.flags);
  if (!Array.isArray(runes) || runes.length !== 3 || runes.some((r, i) => r !== want[i])) { log(f, t, `${deptName(dept)}: THE CODE DOES NOT MATCH THE FLAGS`, 'struck'); return 'wrong'; }
  d.state = 'loaded'; f.loaded[SPECIAL[dept]] = true;
  log(f, t, `${deptName(dept)} LOADED A ${SPECIAL_NAME[SPECIAL[dept]]}`, 'info');
  return 'loaded';
}
export const deptName = d => ({ gunnery: 'GUNNERY', signals: 'SIGNALS', engineer: 'ENGINEERING', fleet: 'THE FLEET OFFICER' })[d];
// Plan a loaded special for this salvo (or clear it with args = null).
//   heavy: { x, y } the top-left of the 2 x 2 · sounding: { line: 'row' | 'col', n } · boost: { ship, dx, dy }
export function planSpecial(f, kind, args) {
  if (f.phase !== 'play' || !f.loaded[kind]) return false;
  if (!args) { delete f.plan[kind]; return true; }
  if (kind === 'heavy') { const x = Math.max(0, Math.min(SIZE - 2, args.x | 0)), y = Math.max(0, Math.min(SIZE - 2, args.y | 0)); f.plan.heavy = { x, y }; return true; }
  if (kind === 'sounding') { if (!['row', 'col'].includes(args.line)) return false; f.plan.sounding = { line: args.line, n: Math.max(0, Math.min(SIZE - 1, args.n | 0)) }; return true; }
  if (kind === 'boost') {
    const s = f.mine[args.ship]; if (!s || sunk(s) || Math.abs(args.dx) + Math.abs(args.dy) !== 1) return false;
    const t = f.mine.map((o, j) => j === args.ship ? { ...o, x: o.x + args.dx, y: o.y + args.dy } : o);
    if (!fits(t, args.ship)) return false;
    f.plan.boost = { ship: args.ship, dx: args.dx, dy: args.dy }; return true;
  }
  return false;
}
function spend(f, kind, t) { const dept = Object.keys(SPECIAL).find(d => SPECIAL[d] === kind); delete f.loaded[kind]; delete f.plan[kind]; Object.assign(f.dept[dept], { state: 'cooldown', readyAt: t + SPECIAL_COOLDOWN }); }

// ---------- salvage ----------
// The salvage board for a sunk ship of ours: set every row (OPEN, CLOSE or CUT by Engineering's flowchart), then send.
export function salvageSet(f, i, row, action) { const s = f.salvage[i]; if (!s || s.done || !s.board.rows[row]) return false; s.board.rows[row].set = action; return true; }
export function salvageSend(f, i, t) {
  const s = f.salvage[i]; if (!s || s.done) return null;
  if (s.board.rows.some(r => !r.set)) return null;
  const ok = s.board.rows.every(r => r.set === repairAction('engineer', r));
  if (ok) { s.done = true; log(f, t, `SALVAGE CREW ON ${SHIP_NAMES[i]}: THE HULL IS SOUND${s.power ? '' : ' · IT NEEDS POWER FROM ENGINEERING'}`, 'info'); }
  else { s.board.rows.forEach(r => { r.set = null; }); s.tries = (s.tries || 0) + 1; log(f, t, `THE SALVAGE ON ${SHIP_NAMES[i]} WENT WRONG · RESET`, 'struck'); }
  return ok;
}
// Engineering's breaker panel powers a sunk ship (the oldest first). Returns the ship, or -1 if none needed it.
export function salvagePower(f, t) {
  const waiting = Object.entries(f.salvage).filter(([, s]) => !s.power).sort((a, b) => a[1].since - b[1].since);
  if (!waiting.length) return -1;
  const [i, s] = waiting[0]; s.power = true; log(f, t, `ENGINEERING POWERED ${SHIP_NAMES[i]}${s.done ? '' : ' · THE SALVAGE BOARD IS STILL TO DO'}`, 'info');
  return Number(i);
}
export const needsPower = f => Object.values(f.salvage).some(s => !s.power);

// Minesweeping's reward: one square of an enemy ship nobody has hit is marked for the gunners.
export function canSpot(f) { return f.phase === 'play' && f.enemy.some(s => !sunk(s) && cellsOf(s).some(c => !f.marks[key(...c)])); }
export function spot(f, rng, t) {
  const cells = f.enemy.filter(s => !sunk(s)).flatMap(s => cellsOf(s)).filter(c => !f.marks[key(...c)]);
  if (!cells.length) return null;
  const c = cells[Math.floor(rng() * cells.length)]; f.marks[key(...c)] = 'seen';
  log(f, t, `SIGNALS SWEPT THE APPROACHES · AN ENEMY HULL IS SIGHTED AT ${square(...c)}`, 'info');
  return c;
}

// ---------- the round ----------
// ctx: { t, rng, engineerLive, spendBeacon(): bool, shellReady(): bool }. Returns events.
export function tick(f, ctx) {
  const ev = [];
  for (const d of DEPTS) { const st = f.dept[d]; if (st.state === 'cooldown' && ctx.t >= st.readyAt) Object.assign(st, { state: 'flags', flags: flags(ctx.rng) }); }
  if (f.phase === 'refit' && ctx.t >= f.refitUntil) refit(f, ctx, ev);
  if (f.phase === 'play' && f.nextSalvo != null && ctx.t >= f.nextSalvo) ev.push(...salvo(f, ctx));
  return ev;
}
export function salvo(f, ctx) {
  if (f.phase !== 'play') return [];
  const { t, rng } = ctx, ev = [];
  f.round++; f.nextSalvo = t + f.salvoEvery;
  const theirAim = enemyAim(f, rng);
  const ours = [], theirs = [];
  // specials first: the boost moves, the sounding reads the water as it stands, the heavy shell joins the salvo
  const extra = [];
  if (f.plan.boost) {
    const p = f.plan.boost, s = f.mine[p.ship], moved = f.mine.map((o, j) => j === p.ship ? { ...o, x: o.x + p.dx, y: o.y + p.dy } : o);
    if (s && !sunk(s) && fits(moved, p.ship)) { s.x += p.dx; s.y += p.dy; log(f, t, `ENGINEERING BOOSTS ${SHIP_NAMES[p.ship]} ONE SQUARE`, 'info'); ev.push({ type: 'fleetboost', ship: p.ship }); }
    spend(f, 'boost', t);
  }
  if (f.plan.sounding) {
    const p = f.plan.sounding; let count = 0;
    for (let i = 0; i < SIZE; i++) { const [x, y] = p.line === 'row' ? [i, p.n] : [p.n, i]; if (f.enemy.some(s => cellsOf(s).some(c => c[0] === x && c[1] === y))) count++; }
    f.soundings.push({ line: p.line, n: p.n, count, round: f.round });
    log(f, t, `SOUNDING ${p.line === 'row' ? 'ROW ' + (p.n + 1) : 'COLUMN ' + RUNES[COL_RUNES[p.n]].name.toUpperCase()}: ${count} SHIP SQUARE${count === 1 ? '' : 'S'}`, 'info');
    spend(f, 'sounding', t);
  }
  if (f.plan.heavy) {
    if (ctx.spendBeacon && ctx.spendBeacon()) { const p = f.plan.heavy; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) extra.push([p.x + dx, p.y + dy]); log(f, t, `A HEAVY SHELL ON ${square(p.x, p.y)}`, 'info'); spend(f, 'heavy', t); }
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
    if (sunk(s)) {
      log(f, t, `${SHIP_NAMES[i]} IS SUNK`, 'struck'); ev.push({ type: 'fleetsunk', side: 'ours', ship: i, crew: s.crew });
      if (!Object.keys(f.salvage).length) f.shellRound = f.round;
      f.salvage[i] = { board: makeRepairBoard('engineer', rng), done: false, power: false, since: f.round };
    } else log(f, t, `${SHIP_NAMES[i]} IS HIT`, 'struck');
  }
  f.reload = landed;
  f.last = { round: f.round, t, ours, theirs };
  // salvage: a ship relaunches once it is sound and powered (or by itself, if nobody from Engineering is on station)
  for (const [i, s] of Object.entries(f.salvage)) {
    if ((s.done && s.power) || (!ctx.engineerLive && f.round - s.since >= SALVAGE_AUTO)) {
      f.mine[i].hits = []; delete f.salvage[i];
      log(f, t, `${SHIP_NAMES[i]} IS RELAUNCHED`, 'info'); ev.push({ type: 'fleetrelaunch', ship: Number(i), crew: f.mine[i].crew });
    }
  }
  // while one of ours is down, the enemy has a line on the Watch
  if (Object.keys(f.salvage).length && f.round - f.shellRound >= SHELL_EVERY && (!ctx.shellReady || ctx.shellReady())) { f.shellRound = f.round; ev.push({ type: 'fleetshell' }); }
  // the end of a wave, or of our fleet
  if (!afloat(f.enemy).length) {
    f.wins++; f.wave++;
    for (const s of f.mine) s.hits = [];
    f.enemy = randomFleet(rng, ENEMY_SHIPS); reset(f);
    log(f, t, `THE ENEMY FLEET IS SUNK · OURS IS REFITTED · A NEW FLEET IS ON THE HORIZON`, 'info'); ev.push({ type: 'fleetwin' });
  } else if (!afloat(f.mine).length) {
    f.losses++; f.phase = 'refit'; f.refitUntil = t + REFIT_TIME;
    log(f, t, 'THE FLEET IS LOST · IT IS REFITTED IN A MINUTE', 'struck'); ev.push({ type: 'fleetlost' });
  }
  ev.push({ type: 'fleetsalvo', ours, theirs });
  return ev;
}
function reset(f) { f.marks = {}; f.theirShots = {}; f.aim = []; f.soundings = []; f.salvage = {}; f.ai = { shot: {}, hits: [] }; f.reload = 0; f.shellRound = null; f.plan = {}; }
function refit(f, ctx, ev) {
  randomDeploy(f, ctx.rng); f.enemy = randomFleet(ctx.rng, ENEMY_SHIPS); reset(f);
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
// One shot per ship afloat, less one for every hit it landed last round. It works round its hits (along a line once
// it has two), then hunts on a chequerboard. Our boosts make its old hits stale; it drops them once tried round.
export function enemyAim(f, rng) {
  const n = Math.max(1, afloat(f.enemy).length - (f.reload || 0)), out = [], taken = new Set(), ai = f.ai;
  const fresh = (x, y) => inside([x, y]) && !ai.shot[key(x, y)] && !taken.has(key(x, y));
  ai.hits = ai.hits.filter(([x, y]) => f.mine.some(s => !sunk(s) && cellsOf(s).some(c => c[0] === x && c[1] === y)) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => fresh(x + dx, y + dy)));
  const targets = [];
  for (const [x, y] of ai.hits) {
    const line = ai.hits.filter(([a, b]) => (a === x && Math.abs(b - y) === 1) || (b === y && Math.abs(a - x) === 1));
    const dirs = line.length ? (line[0][0] === x ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of dirs) { let k = 1; while (ai.hits.some(([a, b]) => a === x + dx * k && b === y + dy * k)) k++; if (fresh(x + dx * k, y + dy * k)) targets.push([x + dx * k, y + dy * k]); }
  }
  for (let i = 0; i < n; i++) {
    let tg = null;
    const c = targets.filter(([x, y]) => fresh(x, y)); if (c.length) tg = c[Math.floor(rng() * c.length)];
    for (let tries = 0; !tg && tries < 400; tries++) { const x = Math.floor(rng() * SIZE), y = Math.floor(rng() * SIZE); if (fresh(x, y) && (x + y) % 2 === 0) tg = [x, y]; }
    for (let tries = 0; !tg && tries < 400; tries++) { const x = Math.floor(rng() * SIZE), y = Math.floor(rng() * SIZE); if (fresh(x, y)) tg = [x, y]; }
    if (tg) { taken.add(key(...tg)); out.push(tg); }
  }
  return out;
}
