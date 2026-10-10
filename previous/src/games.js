// The station games: the puzzle generators and their rules. Pure, no DOM, so the tests can check that every board
// can be solved. The drawing and the controls live in station.js.
//   Triggered defences: Gunnery Missile Command, Signals the cable (Snake), Engineering the stokehold (Tapper).
//   Steady, optional puzzles with a reward: Signals Minesweeper, Engineering Lights Out.

export const GAME_TIME = { missile: 30, snake: 45, stoke: 45, depth: 45 };   // seconds each defence lasts

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
export const MISSILE_SPEED = 0.75;   // devil fire flies at three quarters of its old speed
export function missileWaves(rng, watchMinutes, kind = 'fall') {
  const n = Math.round(16 + Math.min(12, watchMinutes / 1.5)), out = [];
  for (let i = 0; i < n; i++) {
    if (kind === 'arc' && i % 10 >= 7) continue;   // the skiffs' arcing shells are harder to stop: about 30% fewer
    const from = kind === 'arc' ? (rng() < 0.5 ? rng() * 0.18 : 0.82 + rng() * 0.18) : rng();
    out.push({ at: 1.5 + (i / n) * (GAME_TIME.missile - 9) + rng() * 2, from, to: Math.floor(rng() * 7), speed: (1.1 + rng() * 0.5) * MISSILE_SPEED });
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------- The cable (Signals' defence): Snake ----------
// Splice the buoy's cable: steer the splice head round the grid and collect the loose ends. It starts fifteen long and
// grows with every end, to twenty-five. Through a wall it comes out the other side; touch the cable itself, or one of
// the stray sparks drifting through the water, and the splice fails. A loose end left too long sinks, and another floats up.
// grace: for the first few seconds of play the splice cannot fail (the cable passes through itself and the sparks)
export const SN = { W: 17, H: 13, start: 15, need: 10, step: 0.13, sparks: 3, sparkSpeed: 2.2, sink: 6, grace: 5 };
export function snakeStart() {
  // head first, moving right along the middle row; the tail curls down the left side
  const y = Math.floor(SN.H / 2), row = Math.min(SN.start, SN.W - 3), body = [];
  for (let i = 0; i < row; i++) body.push([row + 1 - i, y]);
  for (let k = 1; body.length < SN.start; k++) body.push([2, y + k]);
  return body;
}
// The stray sparks: each drifts in a straight line (wrapping like the cable), starting well clear of the cable.
export function sparksStart(rng, body) {
  const out = [], near = (x, y) => body.some(c => Math.abs(c[0] - x) + Math.abs(c[1] - y) < 3) || out.some(s => Math.abs(s.x - x) + Math.abs(s.y - y) < 4);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let tries = 0; out.length < SN.sparks && tries < 500; tries++) {
    const x = Math.floor(rng() * SN.W), y = Math.floor(rng() * SN.H);
    if (near(x, y)) continue;
    const [dx, dy] = DIRS[Math.floor(rng() * DIRS.length)];
    out.push({ x, y, dx, dy });
  }
  return out;
}
export function sparksStep(sparks, dt) {
  for (const s of sparks) { s.x = (s.x + s.dx * SN.sparkSpeed * dt + SN.W) % SN.W; s.y = (s.y + s.dy * SN.sparkSpeed * dt + SN.H) % SN.H; }
}
// The square a spark is in now.
export const sparkCell = s => [Math.round(s.x) % SN.W, Math.round(s.y) % SN.H];
export const sparkHits = (sparks, cell) => sparks.some(s => { const c = sparkCell(s); return c[0] === cell[0] && c[1] === cell[1]; });
// A free square for the next loose end, away from the walls.
export function snakeFood(rng, body) {
  const taken = new Set(body.map(c => c.join()));
  for (;;) { const c = [1 + Math.floor(rng() * (SN.W - 2)), 1 + Math.floor(rng() * (SN.H - 2))]; if (!taken.has(c.join())) return c; }
}
// One move. Returns { body, ate, dead }.
export function snakeMove(body, dir, food) {
  const [hx, hy] = body[0], head = [(hx + dir[0] + SN.W) % SN.W, (hy + dir[1] + SN.H) % SN.H];   // the walls wrap
  const ate = food && head[0] === food[0] && head[1] === food[1];
  const next = [head, ...body.slice(0, ate ? body.length : body.length - 1)];
  const dead = next.slice(1).some(c => c[0] === head[0] && c[1] === head[1]);
  return { body: next, ate, dead };
}

// ---------- The stokehold (Engineering's defence): Tapper ----------
// Four boiler fires, one at the end of each deck. Each drains on its own; the stoker runs between decks and flings coal,
// which takes a moment to slide down the deck. A fire that goes out, or one stoked past the top, is a fail; three
// fails and the defence is lost. A dead fire relights low and a burst one vents back to the middle, so play goes on.
export const ST = {
  lanes: 4, travel: 0.85, lump: 22, cooldown: 0.22, fails: 3,
  low: 25, high: 70, top: 90,       // the green band; under it the fire is dying, over it roaring; at the top it bursts
  drain: [4.07, 8.97],                // heat lost per second, at the start and at the end (each fire scaled by its own pace)
  pace: [0.6, 1.5], repace: [5, 9],   // each fire's own pace, re-rolled every few seconds
  start: [42, 62], relight: 38, vent: 50, flash: 1.1,
};
export function stokeStart(rng) {
  const lanes = Array.from({ length: ST.lanes }, () => ({ heat: ST.start[0] + rng() * (ST.start[1] - ST.start[0]), pace: ST.pace[0] + rng() * (ST.pace[1] - ST.pace[0]), repaceAt: ST.repace[0] + rng() * (ST.repace[1] - ST.repace[0]), flash: null, flashAt: -9 }));
  return { t: 0, lanes, coal: [], fails: 0, lastThrow: -9 };
}
// Fling a shovel down a deck. Returns false while the shovel is still swinging.
export function stokeThrow(st, lane) {
  if (st.t - st.lastThrow < ST.cooldown || lane < 0 || lane >= ST.lanes) return false;
  st.lastThrow = st.t; st.coal.push({ lane, at: st.t });
  return true;
}
export const stokeState = l => l.flash ? l.flash : l.heat < ST.low ? 'dying' : l.heat > ST.high ? 'roaring' : 'good';
// Advance by dt (the defence lasts GAME_TIME.stoke). Returns what happened: [{ type: 'land'|'out'|'burst', lane }].
export function stokeStep(st, dt, rng, length = GAME_TIME.stoke) {
  const ev = [];
  st.t += dt;
  const ramp = Math.min(1, st.t / length), drain = ST.drain[0] + (ST.drain[1] - ST.drain[0]) * ramp;
  st.coal = st.coal.filter(c => {
    if (st.t - c.at < ST.travel) return true;
    const l = st.lanes[c.lane]; l.heat += ST.lump; ev.push({ type: 'land', lane: c.lane });
    return false;
  });
  st.lanes.forEach((l, i) => {
    if (l.flash && st.t - l.flashAt > ST.flash) l.flash = null;
    if (st.t >= l.repaceAt) { l.pace = ST.pace[0] + rng() * (ST.pace[1] - ST.pace[0]); l.repaceAt = st.t + ST.repace[0] + rng() * (ST.repace[1] - ST.repace[0]); }
    l.heat -= drain * l.pace * dt;
    if (l.heat <= 0) { st.fails++; l.heat = ST.relight; l.flash = 'out'; l.flashAt = st.t; ev.push({ type: 'out', lane: i }); }
    else if (l.heat >= ST.top) { st.fails++; l.heat = ST.vent; l.flash = 'burst'; l.flashAt = st.t; ev.push({ type: 'burst', lane: i }); }
  });
  return ev;
}

// ---------- The dispatch (the Fleet Officer's steady puzzle): Mastermind with signal lights ----------
// An enemy dispatch is four signal lights from six colours (a colour may repeat). Eight tries. Each try is marked:
// a full mark for every light right in colour and place, a half mark for every other light right in colour only.
export const MM = { len: 4, colors: ['RED', 'AMBER', 'GREEN', 'BLUE', 'WHITE', 'VIOLET'], tries: 8 };
export const MM_HEX = ['#e33b2a', '#f2a01e', '#2bb35e', '#3b7bff', '#f4f1e6', '#a05cff'];
export const mmSecret = rng => Array.from({ length: MM.len }, () => Math.floor(rng() * MM.colors.length));
export function mmScore(secret, guess) {
  let full = 0; const a = [], b = [];
  secret.forEach((c, i) => { if (guess[i] === c) full++; else { a.push(c); b.push(guess[i]); } });
  let half = 0; for (const c of b) { const j = a.indexOf(c); if (j >= 0) { half++; a.splice(j, 1); } }
  return { full, half };
}

// ---------- Depth charges (the Fleet Officer's defence): Space Invaders, upside down ----------
// A destroyer runs along the surface; enemy submarines and psionic whales come up from below in a formation that
// sweeps side to side and rises at each turn. Drop charges on them; dodge their torpedoes and psionic pulses.
// Three hits on the destroyer, or anything reaching the surface, and the fight is lost; hold 45 s (or clear them) to win.
export const DC = { W: 480, H: 360, surface: 52, shipY: 34, shipW: 54, shipSpeed: 230, chargeSpeed: 170, chargeGap: 0.4, charges: 3,
  cols: 7, rows: 3, gapX: 54, gapY: 34, top: 214, march: 26, rise: 16, fireEvery: 1.35, torpSpeed: 85, pulseSpeed: 65, lives: 4 };
export function depthStart(rng) {
  const foes = [];
  const left = (DC.W - (DC.cols - 1) * DC.gapX) / 2;
  for (let r = 0; r < DC.rows; r++) for (let c = 0; c < DC.cols; c++) foes.push({ x: left + c * DC.gapX, y: DC.top + r * DC.gapY, kind: r === DC.rows - 1 ? 'whale' : 'sub', alive: true });
  return { t: 0, x: DC.W / 2, foes, dir: 1, charges: [], shots: [], lives: DC.lives, fireIn: 1.4, lastDrop: -9, over: false, won: false, hitFlash: 0 };
}
export const depthSize = f => f.kind === 'whale' ? [40, 18] : [34, 12];
// Drop a charge if one is ready. Returns true if it went in.
export function depthDrop(st) {
  if (st.over || st.t - st.lastDrop < DC.chargeGap || st.charges.length >= DC.charges) return false;
  st.charges.push({ x: st.x, y: DC.shipY + 8 }); st.lastDrop = st.t; return true;
}
// Advance by dt. move: -1, 0 or 1 (the helm). Returns events: [{ type: 'kill'|'hit'|'surfaced'|'won'|'lost', ... }].
export function depthStep(st, dt, move, rng, length = GAME_TIME.depth) {
  const ev = []; if (st.over) return ev;
  st.t += dt; st.hitFlash = Math.max(0, st.hitFlash - dt);
  st.x = Math.max(DC.shipW / 2, Math.min(DC.W - DC.shipW / 2, st.x + move * DC.shipSpeed * dt));
  const alive = st.foes.filter(f => f.alive);
  // the formation sweeps, faster as it thins, and rises at each turn
  const speed = DC.march * (1 + (DC.cols * DC.rows - alive.length) * 0.06);
  let turn = false;
  for (const f of alive) { f.x += st.dir * speed * dt; if ((st.dir > 0 && f.x > DC.W - 24) || (st.dir < 0 && f.x < 24)) turn = true; }
  if (turn) { st.dir = -st.dir; for (const f of alive) f.y -= DC.rise; }
  // charges sink; a charge that meets a hull blows it
  for (const c of st.charges) {
    c.y += DC.chargeSpeed * dt;
    const f = alive.find(f => { const [w, h] = depthSize(f); return f.alive && Math.abs(c.x - f.x) < w / 2 + 4 && Math.abs(c.y - f.y) < h / 2 + 4; });
    if (f) { f.alive = false; c.dead = true; ev.push({ type: 'kill', kind: f.kind, x: f.x, y: f.y }); }
    if (c.y > DC.H) c.dead = true;
  }
  st.charges = st.charges.filter(c => !c.dead);
  // the topmost foe in a column fires up at the destroyer
  st.fireIn -= dt;
  const live = st.foes.filter(f => f.alive);
  if (st.fireIn <= 0 && live.length) {
    const cols = {}; for (const f of live) { const k = Math.round(f.x); if (!cols[k] || f.y < cols[k].y) cols[k] = f; }
    const front = Object.values(cols), near = front.filter(f => Math.abs(f.x - st.x) < 120), pool = near.length && rng() < 0.6 ? near : front;
    const f = pool[Math.floor(rng() * pool.length)];
    st.shots.push({ x: f.x, y: f.y - 10, kind: f.kind === 'whale' ? 'pulse' : 'torp' });
    st.fireIn = DC.fireEvery * (0.6 + rng() * 0.8) * (0.55 + 0.45 * live.length / (DC.cols * DC.rows));
  }
  for (const s of st.shots) {
    s.y -= (s.kind === 'pulse' ? DC.pulseSpeed : DC.torpSpeed) * dt;
    if (s.y <= DC.shipY + 8 && Math.abs(s.x - st.x) < DC.shipW / 2 + (s.kind === 'pulse' ? 8 : 2)) { s.dead = true; st.lives--; st.hitFlash = 0.4; ev.push({ type: 'hit' }); }
    if (s.y < 0) s.dead = true;
  }
  st.shots = st.shots.filter(s => !s.dead);
  if (live.some(f => f.y - depthSize(f)[1] / 2 <= DC.surface)) { st.over = true; ev.push({ type: 'surfaced' }, { type: 'lost' }); return ev; }
  if (st.lives <= 0) { st.over = true; ev.push({ type: 'lost' }); return ev; }
  if (!live.length || st.t >= length) { st.over = true; st.won = true; ev.push({ type: 'won' }); }
  return ev;
}
