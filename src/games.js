// The station defence games: the puzzle generators and their rules. Pure, no DOM, so the tests can check that
// every board can be solved. The drawing and the controls live in station.js.

export const GAME_TIME = { missile: 60, mines: 90, lights: 60 };   // seconds each defence lasts

// ---------- Lights Out (Engineering): a 5 x 5 breaker panel ----------
export const LO = 5;
// Pressing a breaker flips it and its four neighbours.
export function loPress(board, i) {
  const x = i % LO, y = Math.floor(i / LO), out = [...board];
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < LO && ny < LO) out[ny * LO + nx] ^= 1;
  }
  return out;
}
// A board made by pressing 3 to 5 different breakers on a dark panel: those same presses solve it.
export function loBoard(rng) {
  for (;;) {
    const n = 3 + Math.floor(rng() * 3), presses = new Set();
    while (presses.size < n) presses.add(Math.floor(rng() * LO * LO));
    let b = Array(LO * LO).fill(0);
    for (const p of presses) b = loPress(b, p);
    if (b.some(Boolean)) return { board: b, solution: [...presses] };
  }
}
export const loSolved = b => b.every(v => !v);

// ---------- Minesweeper (Signals): 8 x 8, 8 mines, solvable without guessing ----------
export const MS = 8, MS_MINES = 8;
const nbrs = i => { const x = i % MS, y = Math.floor(i / MS), out = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < MS && ny < MS) out.push(ny * MS + nx); } return out; };
export const msNeighbours = nbrs;
export const msCount = (mines, i) => nbrs(i).filter(j => mines.has(j)).length;
// Open a cell; zeros spread. Returns the set of newly opened cells.
export function msOpen(mines, open, i) {
  const out = [], stack = [i];
  while (stack.length) {
    const c = stack.pop();
    if (open.has(c) || mines.has(c)) continue;
    open.add(c); out.push(c);
    if (msCount(mines, c) === 0) stack.push(...nbrs(c));
  }
  return out;
}
// Can logic alone clear the board from this start? Uses the two classic rules: a number already satisfied
// opens its other neighbours; a number that needs all its hidden neighbours flags them; and the subset rule
// between two numbers.
export function msSolvable(mines, start) {
  const open = new Set(), flag = new Set();
  msOpen(mines, open, start);
  for (let guard = 0; guard < 500; guard++) {
    let progress = false;
    const info = [];
    for (const c of open) {
      const n = msCount(mines, c), hidden = nbrs(c).filter(j => !open.has(j) && !flag.has(j)), flagged = nbrs(c).filter(j => flag.has(j)).length;
      if (!hidden.length) continue;
      const need = n - flagged;
      if (need === 0) { for (const j of hidden) msOpen(mines, open, j); progress = true; }
      else if (need === hidden.length) { for (const j of hidden) flag.add(j); progress = true; }
      else info.push({ hidden: new Set(hidden), need });
    }
    if (!progress) {
      for (const a of info) for (const b of info) {
        if (a === b || a.hidden.size >= b.hidden.size || ![...a.hidden].every(j => b.hidden.has(j))) continue;
        const rest = [...b.hidden].filter(j => !a.hidden.has(j)), diff = b.need - a.need;
        if (diff === 0 && rest.length) { for (const j of rest) msOpen(mines, open, j); progress = true; }
        else if (diff === rest.length && rest.length) { for (const j of rest) flag.add(j); progress = true; }
      }
    }
    if (open.size === MS * MS - MS_MINES) return true;
    if (!progress) return false;
  }
  return false;
}
// A board, its start cell (opened for the player), always solvable by logic.
export function msBoard(rng) {
  for (;;) {
    const start = Math.floor(rng() * MS * MS), keepClear = new Set([start, ...nbrs(start)]), mines = new Set();
    while (mines.size < MS_MINES) { const c = Math.floor(rng() * MS * MS); if (!keepClear.has(c)) mines.add(c); }
    if (msSolvable(mines, start)) return { mines: [...mines], start };
  }
}

// ---------- Missile Command (Gunnery): seven towers, waves of devil fire ----------
// The schedule of incoming fire for one defence: [{ at (s), from (0..1 across the top), to (tower index 0..6) }].
// More fire later in the watch.
export function missileWaves(rng, watchMinutes) {
  const n = Math.round(8 + Math.min(6, watchMinutes / 3)), out = [];
  for (let i = 0; i < n; i++) out.push({ at: 3 + (i / n) * (GAME_TIME.missile - 12) + rng() * 4, from: rng(), to: Math.floor(rng() * 7), speed: 0.9 + rng() * 0.5 });
  return out.sort((a, b) => a.at - b.at);
}
