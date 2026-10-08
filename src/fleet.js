// The fleet: the Watch's naval defences against a devil fleet, played as Battleship on an 8 x 8 grid.
// Columns are marked with runes and rows with numbers, for flavour only. Pure, no DOM, so it runs in tests.
// Cells are [x, y] with x the column (0-7) and y the row (0-7). A ship is { len, x, y, dir: 'h' | 'v' }.

export const SIZE = 8;
export const SHIPS = [4, 3, 3, 2];
import { RUNES } from './glyphs.js';
export const SHIP_NAMES = ['THE CINDERWAKE', 'THE GALLOWS', 'THE BRIMSTONE', 'THE LANTERN'];
export const ENEMY_NAMES = ['THE WAILING TITHE', 'THE BRASS PENITENT', 'THE CINDER WIDOW', 'THE HOLLOW CENSER'];
// A square as the crew says it: the column rune's name, then the row number.
export const square = (x, y) => RUNES[COL_RUNES[x]].name.toUpperCase() + ' ' + (y + 1);
export const COL_RUNES = [0, 5, 10, 13, 2, 7, 8, 15];   // RUNES indices for the column marks
export const ENEMY_DELAY = 3;          // seconds before the enemy answers a shot
export const IDLE_SHOT = 45;           // seconds of silence before the enemy takes a free shot
export const ENEMY_CARELESS = 0.3;     // how often the enemy fires blind even when it has a hit to follow

export const key = (x, y) => x + ',' + y;
export function cellsOf(s) {
  if (s.x == null) return [];
  return Array.from({ length: s.len }, (_, i) => s.dir === 'h' ? [s.x + i, s.y] : [s.x, s.y + i]);
}
const inside = ([x, y]) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
// Can ship i sit where it is, given the others? (Unplaced ships are ignored.)
export function fits(ships, i) {
  const mine = cellsOf(ships[i]);
  if (!mine.length || !mine.every(inside)) return false;
  const taken = new Set();
  ships.forEach((s, j) => { if (j !== i) for (const c of cellsOf(s)) taken.add(key(...c)); });
  return mine.every(c => !taken.has(key(...c)));
}
export function randomFleet(rng) {
  for (;;) {
    const ships = [];
    let ok = true;
    for (const len of SHIPS) {
      let placed = false;
      for (let k = 0; k < 200 && !placed; k++) {
        const dir = rng() < 0.5 ? 'h' : 'v', x = Math.floor(rng() * SIZE), y = Math.floor(rng() * SIZE);
        ships.push({ len, x, y, dir });
        if (fits(ships, ships.length - 1)) placed = true; else ships.pop();
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
}
// After a victory: every ship moves a few squares (and may turn), so the enemy has to search again.
export function shiftFleet(ships, rng) {
  const nudge = s => {
    for (;;) {
      const c = { len: s.len, x: s.x + Math.floor(rng() * 5) - 2, y: s.y + Math.floor(rng() * 5) - 2, dir: rng() < 0.25 ? (s.dir === 'h' ? 'v' : 'h') : s.dir };
      if (c.x !== s.x || c.y !== s.y || c.dir !== s.dir) return c;
    }
  };
  for (let tries = 0; tries < 2000; tries++) {
    const out = ships.map(nudge);
    if (out.every((_, i) => fits(out, i))) return out;
  }
  return randomFleet(rng);
}

export function newFleet(rng, deploy) {
  return {
    phase: deploy ? 'deploy' : 'play',
    mine: deploy ? SHIPS.map(len => ({ len, x: null, y: null, dir: 'h' })) : randomFleet(rng),
    enemy: randomFleet(rng),
    myShots: {},      // where we fired: key -> 'hit' | 'miss'
    theirShots: {},   // where they fired at us
    enemyAt: null,    // when the enemy fires next (after our shot)
    idleFrom: 0,      // when the last shot was fired by anyone
    wins: 0, losses: 0, last: null,
    log: [],          // the battle log, newest last: [{ t, text, kind }]
  };
}
export const allPlaced = f => f.mine.every(s => s.x != null);
// Place (or move) one of our ships during deployment. Returns true if it fits.
export function placeShip(f, i, x, y, dir) {
  if (f.phase !== 'deploy' || !f.mine[i]) return false;
  const was = f.mine[i];
  f.mine[i] = { len: was.len, x, y, dir: dir === 'v' ? 'v' : 'h' };
  if (fits(f.mine, i)) return true;
  f.mine[i] = was; return false;
}
const sunk = (ship, shots) => cellsOf(ship).every(c => shots[key(...c)] === 'hit');
export const shipsLeft = (ships, shots) => ships.filter(s => !sunk(s, shots)).length;

// One shot at a fleet. Returns { x, y, hit, sunk: index | -1, all: everything sunk }, or null if already fired there.
function shoot(ships, shots, x, y) {
  if (!inside([x, y]) || shots[key(x, y)]) return null;
  const i = ships.findIndex(s => cellsOf(s).some(([a, b]) => a === x && b === y));
  shots[key(x, y)] = i >= 0 ? 'hit' : 'miss';
  const isSunk = i >= 0 && sunk(ships[i], shots);
  return { x, y, hit: i >= 0, sunk: isSunk ? i : -1, all: ships.every(s => sunk(s, shots)) };
}
export const fireAtEnemy = (f, x, y) => shoot(f.enemy, f.myShots, x, y);
export const fireAtUs = (f, x, y) => shoot(f.mine, f.theirShots, x, y);

// Where the enemy aims: next to an unfinished hit (in line with it if it has two), otherwise a fresh square
// on a checkerboard. Sometimes it fires blind.
export function enemyAim(f, rng) {
  const shots = f.theirShots, open = (x, y) => inside([x, y]) && !shots[key(x, y)];
  const hits = Object.keys(shots).filter(k => shots[k] === 'hit').map(k => k.split(',').map(Number))
    .filter(([x, y]) => { const s = f.mine.find(s => cellsOf(s).some(([a, b]) => a === x && b === y)); return s && !sunk(s, shots); });
  if (hits.length && rng() >= ENEMY_CARELESS) {
    const cand = [];
    for (const [x, y] of hits) {
      const inLine = hits.filter(([a, b]) => (a === x && Math.abs(b - y) === 1) || (b === y && Math.abs(a - x) === 1));
      const dirs = inLine.length ? (inLine[0][0] === x ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]) : [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        let nx = x + dx, ny = y + dy;
        while (inside([nx, ny]) && shots[key(nx, ny)] === 'hit') { nx += dx; ny += dy; }
        if (open(nx, ny)) cand.push([nx, ny]);
      }
    }
    if (cand.length) return cand[Math.floor(rng() * cand.length)];
  }
  const all = [];
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) if (open(x, y)) all.push([x, y]);
  const checker = all.filter(([x, y]) => (x + y) % 2 === 0);
  const pool = checker.length && rng() > ENEMY_CARELESS ? checker : all;
  return pool[Math.floor(rng() * pool.length)];
}

// The battle log: one line per shot, as the radio would report it.
export function logShot(f, by, r, t) {
  if (!r) return;
  const sq = square(r.x, r.y), afloat = f.mine.filter(s => !cellsOf(s).every(c => f.theirShots[key(...c)] === 'hit'));
  let text, kind = r.hit ? 'hit' : 'miss';
  if (by === 'us') {
    const gun = afloat.length ? SHIP_NAMES[f.mine.indexOf(afloat[Math.floor(t * 7) % afloat.length])] : 'THE WATCH';
    text = r.sunk >= 0 ? `${gun} fires on ${sq}: a hit. ${ENEMY_NAMES[r.sunk]} IS SINKING.` : r.hit ? `${gun} fires on ${sq}: a hit, and fire aboard.` : `${gun} fires on ${sq}: a splash, nothing there.`;
  } else {
    const i = f.mine.findIndex(s => cellsOf(s).some(([a, b]) => a === r.x && b === r.y));
    text = r.sunk >= 0 ? `Enemy shell on ${sq}. ${SHIP_NAMES[r.sunk]} IS GOING DOWN.` : r.hit ? `Enemy shell on ${sq}: ${SHIP_NAMES[i]} is hit.` : `Enemy shell on ${sq}: it falls short.`;
    kind = r.hit ? 'struck' : 'safe';
  }
  f.log.push({ t, text, kind }); if (f.log.length > 30) f.log.shift();
}
