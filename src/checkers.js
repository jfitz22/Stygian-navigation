// Checkers with Jerry. Pure rules, no DOM. Row 0 is the top of the board; you play the light pieces ('w', king 'W')
// from the bottom and Jerry the dark ones ('b', king 'B') from the top. Pieces sit on the dark squares.
// Captures are compulsory, a capturing piece keeps jumping, and reaching the far row crowns it (which ends the move).

export function newBoard() {
  const B = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) { if (r < 3) B[r][c] = 'b'; if (r > 4) B[r][c] = 'w'; }
  return B;
}
export const sideOf = p => p ? p.toLowerCase() : null;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const DIRS = { w: [[-1, -1], [-1, 1]], b: [[1, -1], [1, 1]], K: [[-1, -1], [-1, 1], [1, -1], [1, 1]] };
const dirsOf = p => p === 'W' || p === 'B' ? DIRS.K : DIRS[p];
const crowns = (p, r) => (p === 'w' && r === 0) || (p === 'b' && r === 7);

// every capture sequence starting from (r, c)
function jumps(B, r, c, p, path, caps, out) {
  let more = false;
  for (const [dr, dc] of dirsOf(p)) {
    const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
    if (!inside(lr, lc) || B[lr][lc] || !B[mr][mc] || sideOf(B[mr][mc]) === sideOf(p) || caps.some(([a, b]) => a === mr && b === mc)) continue;
    more = true;
    const np = [...path, [lr, lc]], nc = [...caps, [mr, mc]];
    if (crowns(p, lr)) out.push({ path: np, caps: nc });
    else {
      const was = B[r][c]; B[r][c] = null; B[lr][lc] = p;
      jumps(B, lr, lc, p, np, nc, out);
      B[lr][lc] = null; B[r][c] = was;
    }
  }
  if (!more && caps.length) out.push({ path, caps });
}
export function legalMoves(B, side) {
  const caps = [], steps = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = B[r][c]; if (sideOf(p) !== side) continue;
    const found = []; jumps(B, r, c, p, [[r, c]], [], found); caps.push(...found);
    for (const [dr, dc] of dirsOf(p)) { const nr = r + dr, nc = c + dc; if (inside(nr, nc) && !B[nr][nc]) steps.push({ path: [[r, c], [nr, nc]], caps: [] }); }
  }
  return caps.length ? caps : steps;
}
export function applyMove(B, m) {
  const N = B.map(row => [...row]), [r0, c0] = m.path[0], [r1, c1] = m.path[m.path.length - 1];
  let p = N[r0][c0]; N[r0][c0] = null;
  for (const [r, c] of m.caps) N[r][c] = null;
  if (crowns(p, r1)) p = p.toUpperCase();
  N[r1][c1] = p;
  return N;
}
export const count = (B, side) => B.flat().filter(p => sideOf(p) === side).length;
// The side to move has no moves (or no pieces): the other side has won.
export const gameOver = (B, toMove) => legalMoves(B, toMove).length === 0;

// Jerry plays greedily, with a little randomness: take the most, crown when he can, don't hang pieces.
export function jerryMove(B, rng = Math.random) {
  const moves = legalMoves(B, 'b');
  let best = null, bs = -1e9;
  for (const m of moves) {
    const N = applyMove(B, m), [r1] = m.path[m.path.length - 1], p = B[m.path[0][0]][m.path[0][1]];
    const reply = legalMoves(N, 'w'), lost = reply.reduce((a, q) => Math.max(a, q.caps.length), 0);
    const s = m.caps.length * 10 + (p === 'b' && r1 === 7 ? 6 : 0) - lost * 8 + (p === 'b' ? r1 * 0.3 : 0) + rng() * 3;
    if (s > bs) { bs = s; best = m; }
  }
  return best;
}
