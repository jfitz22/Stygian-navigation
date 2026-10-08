// The station games: the puzzle generators and their rules. Pure, no DOM, so the tests can check that every board
// can be solved. The drawing and the controls live in station.js.
//   Triggered defences: Gunnery Missile Command, Signals the cable (Snake), Engineering the wires.
//   Steady, optional puzzles with a reward: Signals Minesweeper, Engineering Lights Out.

export const GAME_TIME = { missile: 30, snake: 45, wires: 20 };   // seconds each defence lasts

// ---------- Lights Out (Engineering's steady puzzle): a 6 x 6 breaker panel ----------
export const LO = 6;
// Pressing a breaker flips it and its four neighbours.
export function loPress(board, i, n = LO) {
  const x = i % n, y = Math.floor(i / n), out = [...board];
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < n && ny < n) out[ny * n + nx] ^= 1;
  }
  return out;
}
// A board made by pressing 4 to 7 different breakers on a dark panel: those same presses solve it.
export function loBoard(rng, n = LO) {
  for (;;) {
    const k = 4 + Math.floor(rng() * 4), presses = new Set();
    while (presses.size < k) presses.add(Math.floor(rng() * n * n));
    let b = Array(n * n).fill(0);
    for (const p of presses) b = loPress(b, p, n);
    if (b.some(Boolean)) return { board: b, solution: [...presses] };
  }
}
export const loSolved = b => b.every(v => !v);

// ---------- Minesweeper (Signals' steady puzzle): 8 x 8, 8 mines, solvable without guessing ----------
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

// ---------- Missile Command (Gunnery): seven towers, two kinds of attack ----------
// 'fall': devil fire falls from the sky. 'arc': devil skiffs on the horizon lob shells that arc in from the sides.
// The schedule: [{ at (s), from (0..1), to (tower 0..6), speed }]. More fire later in the watch.
export const MISSILE_KINDS = ['fall', 'arc'];
export function missileWaves(rng, watchMinutes, kind = 'fall') {
  const n = Math.round(16 + Math.min(12, watchMinutes / 1.5)), out = [];
  for (let i = 0; i < n; i++) {
    const from = kind === 'arc' ? (rng() < 0.5 ? rng() * 0.18 : 0.82 + rng() * 0.18) : rng();
    out.push({ at: 1.5 + (i / n) * (GAME_TIME.missile - 9) + rng() * 2, from, to: Math.floor(rng() * 7), speed: 1.1 + rng() * 0.5 });
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------- The cable (Signals' defence): Snake ----------
// Splice the buoy's cable: steer the splice head round the grid and collect the loose ends. It starts four long and
// grows with every end; touch the wall or the cable itself and the splice fails.
export const SN = { W: 20, H: 13, start: 4, need: 8, step: 0.13 };
export function snakeStart() {
  const y = Math.floor(SN.H / 2);
  return Array.from({ length: SN.start }, (_, i) => [SN.start + 1 - i, y]);   // head first, moving right
}
// A free square for the next loose end, away from the walls.
export function snakeFood(rng, body) {
  const taken = new Set(body.map(c => c.join()));
  for (;;) { const c = [1 + Math.floor(rng() * (SN.W - 2)), 1 + Math.floor(rng() * (SN.H - 2))]; if (!taken.has(c.join())) return c; }
}
// One move. Returns { body, ate, dead }.
export function snakeMove(body, dir, food) {
  const [hx, hy] = body[0], head = [hx + dir[0], hy + dir[1]];
  const ate = food && head[0] === food[0] && head[1] === food[1];
  const next = [head, ...body.slice(0, ate ? body.length : body.length - 1)];
  const dead = head[0] < 0 || head[1] < 0 || head[0] >= SN.W || head[1] >= SN.H || next.slice(1).some(c => c[0] === head[0] && c[1] === head[1]);
  return { body: next, ate, dead };
}

// ---------- The wires (Engineering's defence) ----------
// Six loose wires on the left, six terminals on the right, matched by colour and stripe. The terminals are shuffled.
export const WIRES = [
  { id: 'R', color: '#e33b2a', stripe: null }, { id: 'Y', color: '#f2b01e', stripe: null }, { id: 'B', color: '#3b7bff', stripe: null },
  { id: 'RW', color: '#e33b2a', stripe: '#f4f1e6' }, { id: 'YK', color: '#f2b01e', stripe: '#111' }, { id: 'BW', color: '#3b7bff', stripe: '#f4f1e6' },
];
export function wiresBoard(rng) {
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const left = shuffle(WIRES.map(w => w.id));
  let right; do { right = shuffle(left); } while (right.some((id, i) => id === left[i]));   // no wire starts opposite its terminal
  return { left, right };
}
