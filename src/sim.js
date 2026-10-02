// The Last Watch simulation. Pure logic, no DOM. Runs in the browser and in Node.
import {
  MAP, CENTER, OBSERVATORY, REACH, ISLAND_R, TOMB_RADIUS, TUNING as T, CAMERAS, NOTABLES,
  GENERIC_COUNT, GENERIC_TRANSMIT, GENERIC_METAL, GENERIC_TRIAD, GENERIC_HOLLOW, PLATE_ORDER, windLever, tempLever,
  makeField, vortexAt, windAt, tempAt, makeStorms, stormThrough, bandOf, BAND_RANGE, CARRIERS, encodeLamps, NOISE_SIGNALS, STATIONS,
  BOARD_GRID, BOARD_PAGES,
} from './scenario.js';
import { RUNES, makePlate, keypadCode, shuffle, octantName } from './glyphs.js';

export const SYSTEMS = ['cameras', 'sonar', 'radio', 'scanner', 'currents'];
export const SPINUP = { cameras: 1, sonar: 1.5, radio: 2, scanner: 4, currents: 1.5 };
export const DT = 0.1;
export const BREAKABLE = { furnace: 'FURNACE GRATE', launcher: 'BEACON LAUNCHER', winch: 'BUOY WINCH', fuse: 'RADIO FUSE' };
// GM levers (multipliers). 1 is the designed game.
export const LEVERS = { drift: 1, tomb: 1, elgarz: 1, shark: 1, burn: 1, remorhaz: 1, aim: 1, fatigue: 1 };

// ---------- helpers ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hyp = Math.hypot;
export const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const KNOTS = 6;   // mi/s -> knots on the dials

function vortex(px, py, v) {
  const dx = px - v.x, dy = py - v.y;
  const r = hyp(dx, dy);
  if (r < 1) return { x: 0, y: 0 };
  const s = v.vmax * (r / v.rpk) * Math.exp(1 - r / v.rpk);
  return { x: v.dir * (-dy / r) * s, y: v.dir * (dx / r) * s };
}
// The sea holds its ice: water near the rim of reach flows back inward, water at the island flows outward.
function rimFlow(x, y) {
  const dx = x - CENTER.x, dy = y - CENTER.y, r = hyp(dx, dy) || 1;
  const hold = T.rimHold * REACH;
  let k = 0;
  if (r > hold) k = -T.rimPull * (r - hold);
  else if (r < ISLAND_R + 160) k = 0.006 * (ISLAND_R + 160 - r);
  return { x: dx / r * k, y: dy / r * k };
}
function field(list, x, y, t) {
  const rf = rimFlow(x, y);
  let vx = rf.x, vy = rf.y;
  for (const v of list) { const w = vortex(x, y, vortexAt(v, t)); vx += w.x; vy += w.y; }
  return { x: vx, y: vy };
}
export const deepAt = (F, x, y, t) => field(F.deep, x, y, t);
export const surfaceAt = (F, x, y, t) => field(F.surface, x, y, t);
// The true drift rule. Large bergs ride the deep current, small ones ride the surface and wind.
export function driftOf(F, large, x, y, t) {
  const d = deepAt(F, x, y, t), s = surfaceAt(F, x, y, t);
  if (large) return { x: d.x, y: d.y };
  const w = windAt(t, F);
  return { x: s.x + 0.03 * w.x, y: s.y + 0.03 * w.y };
}
export function stormsAt(w, t) {
  const out = [];
  for (const s of w.storms) {
    if (t < s.t0 || t > s.t1) continue;
    const k = (t - s.t0) / (s.t1 - s.t0);
    const fade = Math.min(1, (t - s.t0) / 40, (s.t1 - t) / 40);
    out.push({ x: s.x0 + (s.x1 - s.x0) * k, y: s.y0 + (s.y1 - s.y0) * k, r: s.r, strength: fade });
  }
  return out;
}
export function snowAt(w, x, y, t) {
  let snow = 0;
  for (const s of stormsAt(w, t)) {
    const d = hyp(x - s.x, y - s.y);
    if (d < s.r) snow = Math.max(snow, s.strength * (1 - (d / s.r) ** 2));
  }
  return snow;
}
export function bearingDeg(from, to) {
  const b = Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI;
  return (b + 360) % 360;
}
export function inReach(p) { return dist(p, CENTER) <= REACH; }
// Is a point inside a camera's view (range and field of view)?
export function camSees(cam, p, margin = 0) {
  const d = dist(p, cam);
  if (d > T.camRange || d < 2) return false;
  const b = Math.atan2(p.x - cam.x, -(p.y - cam.y));
  let rel = b - cam.facing * Math.PI / 180;
  while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
  return Math.abs(rel) <= T.camFov / 2 + margin;
}

// ---------- movement (shared by the game and the spawn planner, so plans come true) ----------
// The Tomb processes through the sea at a steady pace, steered by the deep current and a slow
// clockwise turn round the island, so it never stalls in slack water.
function advanceTomb(w, tomb, t, dt) {
  const d = deepAt(w.field, tomb.x, tomb.y, t);
  const dx = tomb.x - CENTER.x, dy = tomb.y - CENTER.y, r = hyp(dx, dy) || 1;
  let hx = d.x + (-dy / r) * 0.35, hy = d.y + (dx / r) * 0.35;
  if (r < 520) { hx += dx / r * 0.8; hy += dy / r * 0.8; }
  const h = hyp(hx, hy) || 1, sp = T.tombSpeed * w.levers.tomb * w.levers.drift;
  tomb.x += hx / h * sp * dt; tomb.y += hy / h * sp * dt;
}
function advanceBerg(w, b, tomb, t, dt) {
  const v = driftOf(w.field, b.large, b.x, b.y, t);
  const k = w.levers.drift * (b.elgarz ? w.levers.elgarz : 1);
  v.x *= k; v.y *= k;
  const dx = b.x - tomb.x, dy = b.y - tomb.y, d = hyp(dx, dy) || 1;
  if (b.elgarz) {
    // Elgarz will not go near the Tomb of Levistus. It swerves away.
    const edge = TOMB_RADIUS + T.tombRepelBand;
    if (d < edge) { const f = 1.8 * (1 - (d - TOMB_RADIUS) / T.tombRepelBand); v.x += dx / d * f; v.y += dy / d * f; }
  } else if (b.tombDrawn && d > TOMB_RADIUS * 0.5) {
    // the Gilded Hulk is drawn to the Tomb
    v.x -= dx / d * T.tombDrawPull; v.y -= dy / d * T.tombDrawPull;
  }
  b.x += v.x * dt; b.y += v.y * dt;
  if (b.elgarz) {
    const ex = b.x - tomb.x, ey = b.y - tomb.y, ed = hyp(ex, ey) || 1, min = TOMB_RADIUS + 15;
    if (ed < min) { b.x = tomb.x + ex / ed * min; b.y = tomb.y + ey / ed * min; }
  }
}

// ---------- world ----------
function makeShape(rng, look, large) {
  // Silhouette as a list of [x (0..1 along length), height (0..1)] points.
  const n = large ? 14 : 9;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const edge = Math.sin(Math.PI * u) ** (large ? 0.35 : 0.7);
    let h = edge * (0.45 + 0.55 * rng());
    if (look === 'elgarz' || look === 'shadow') h = edge * (0.5 + 0.08 * rng());   // long, low, flat-topped
    if (look === 'horn' && i === Math.floor(n * 0.6)) h = 2.4;
    if (look === 'cairn' && i === Math.floor(n / 2)) h = 2.2;
    if (look === 'bell') h = edge * (0.9 + 0.1 * Math.sin(u * Math.PI));
    if (look === 'hulk') h = edge * (0.62 + 0.1 * rng());
    pts.push([u, h]);
  }
  return pts;
}
function randomInReach(rng, rMin, rMax) {
  const a = rng() * Math.PI * 2, r = Math.sqrt(rMin * rMin + rng() * (rMax * rMax - rMin * rMin));
  return { x: CENTER.x + Math.cos(a) * r, y: CENTER.y + Math.sin(a) * r };
}
function makeRadio(rng, spec) {
  const carrier = spec.carrier || CARRIERS[Math.floor(rng() * 3)];
  const [lo, hi] = BAND_RANGE[spec.band];
  return { decoded: spec.decoded, band: spec.band, carrier, shown: encodeLamps(spec.decoded, carrier), freq: Math.round((lo + rng() * (hi - lo)) * 10) / 10 };
}

// ---------- rune board ----------
export function runeFunction(runeId, page) {
  const r = RUNES[runeId];
  return BOARD_GRID[r.house][(r.weight - 1 + page) % 4];
}
const MUST_HAVE = ['FUEL', 'COFFEE', 'WIPERS'];
function dealBoard(w, rng) {
  const b = w.board;
  b.page = Math.floor(rng() * 4);
  for (let tries = 0; tries < 200; tries++) {
    const ids = shuffle(RUNES.map((_, i) => i), rng).slice(0, 12);
    const fns = ids.map(i => runeFunction(i, b.page));
    if (MUST_HAVE.every(f => fns.includes(f)) && ids.filter(i => runeFunction(i, b.page) === 'LAUNCH').length <= 1) { b.runes = ids; break; }
  }
  b.presses = 0; b.nextFlip = w.t + T.boardFlipEvery;
}

export function newSeed() { return Math.floor(Math.random() * 90000) + 10000; }

export function createWorld(seed = newSeed()) {
  const gen = mulberry32(seed);
  const F = makeField(gen);
  const storms = makeStorms(mulberry32(seed + 101));
  // start the Tomb in moving water, so it visibly drifts
  let tombStart, best = 0;
  for (let k = 0; k < 400; k++) {
    const p = randomInReach(gen, 650, 1250), v = deepAt(F, p.x, p.y, 0), sp = Math.hypot(v.x, v.y);
    if (sp > best) { best = sp; tombStart = p; }
    if (sp >= 1.5) break;
  }
  const bergs = [], reserve = [];
  let num = 1;
  for (const n of NOTABLES) {
    let p = randomInReach(gen, 300, T.rimHold * REACH);
    if (n.tombDrawn) { let k = 0; while (dist(p, tombStart) > 700 && k++ < 200) p = randomInReach(gen, 300, T.rimHold * REACH); }
    const b = {
      id: n.id, name: n.name, num: num++, x: p.x, y: p.y, large: n.large, length: n.length,
      hollow: n.hollow, metal: n.metal, echo: n.echo, radio: n.radio ? makeRadio(gen, n.radio) : null, look: n.look,
      elgarz: !!n.elgarz, tombDrawn: !!n.tombDrawn, notable: true, shape: makeShape(gen, n.look, n.large), tag: null, scan: 0, scanned: false,
    };
    if (n.spawn) reserve.push({ ...b, spawnAt: n.spawn === 'elgarz' ? T.elgarzSpawnAt : T.lateDecoys[reserve.filter(r => !r.elgarz).length] }); else bergs.push(b);
  }
  let triads = 0;
  for (let i = 0; i < GENERIC_COUNT; i++) {
    const large = gen() < 0.35;
    const p = randomInReach(gen, 250, T.rimHold * REACH + 80);
    const tx = gen() < GENERIC_TRANSMIT, metal = gen() < GENERIC_METAL, hollow = gen() < GENERIC_HOLLOW, humps = 1 + Math.floor(gen() * 2);
    let ns = NOISE_SIGNALS[Math.floor(gen() * NOISE_SIGNALS.length)];
    if (tx && triads < GENERIC_TRIAD && !metal) { ns = ['BRW', 'MID']; triads++; }
    bergs.push({
      id: 'g' + i, name: metal ? 'Ice with wreckage' : hollow ? 'Ice caves' : 'Unremarkable ice', num: num++, x: p.x, y: p.y, large,
      length: large ? 9.5 + gen() * 9 : 1.5 + gen() * 4,
      hollow, metal, echo: hollow ? { humps, tail: 'ring' } : { humps: 0, tail: gen() < 0.5 ? 'flat' : 'fuzzflat' },
      radio: tx ? makeRadio(gen, { decoded: ns[0], band: ns[1] }) : null, look: 'plain', elgarz: false, notable: false,
      shape: makeShape(gen, 'plain', large), tag: null, scan: 0, scanned: false,
    });
  }
  const all = [...bergs, ...reserve];
  // shuffle numbering so notables are not obviously the low numbers
  const nums = shuffle(all.map((_, i) => i + 1), gen);
  all.forEach((b, i) => { b.num = nums[i]; });
  // the cabin wireless stations, kept clear of Elgarz's frequency
  const ef = all.find(b => b.elgarz).radio.freq;
  const stations = STATIONS.map(s => {
    let r; do { r = makeRadio(gen, s); } while (Math.abs(r.freq - ef) < 1.6 * T.radioWidth);
    return { ...s, ...r };
  });

  const cams = CAMERAS.map(c => ({ ...c, heat: 0, broken: false, tremor: 0 }));
  const sharkStart = randomInReach(gen, 900, 1500);
  const rng = mulberry32(seed ^ 0x2545F491);

  const w = {
    seed, rng, spawnRng: mulberry32(seed + 0x51ED), boardRng: mulberry32(seed + 0xB0A2D), field: F, storms, stations,
    t: 0, started: false, paused: false, won: false, wonAt: null, reveal: null,
    levers: { ...LEVERS },
    bergs, reserve,
    tomb: { x: tombStart.x, y: tombStart.y },
    furnace: { lit: false, heat: 0, pending: 0, outUntil: 0, everLit: false, chute: T.chuteStart },
    power: Object.fromEntries(SYSTEMS.map(s => [s, { on: false, ready: 0, since: 0 }])),
    broken: { furnace: false, launcher: false, winch: false, fuse: false },
    repairs: {},        // system or camera id -> time the repair finishes
    cams, activeCam: 'c1',
    remorhazes: [],
    buoy: null, buoyRebuildAt: 0, buoyCount: 0,
    pings: [], contacts: [], flows: [],
    lastPing: null,     // the Grindmaw always swims toward this
    shark: { x: sharkStart.x, y: sharkStart.y, heading: gen() * 6.28, mode: 'roam' },
    readings: null, readingAt: -99,
    lock: null,         // {bergId, x, y, t0, source}
    drift: 'surface',
    scanner: { calibrated: false, calCode: null, lockoutUntil: 0, plate: makePlate(gen), pressed: [], frozen: null, code: null, lastPress: 0 },
    radio: { freq: 300.0, gain: 5, clipTime: 0 },
    music: false, lamps: 0, wipe: null,
    coffee: { brewUntil: 0, sips: 0 }, fatigue: 0,
    board: { page: 0, runes: [], presses: 0, nextFlip: 0, flippedAt: -99 },
    color: 'red',
    camUnlocked: {},    // camera id -> time its unlock runs out
    camTurn: 0,         // -1, 0, +1 while an arrow is held
    camPanel: { wind: 'MIDDLE', temp: 'MIDDLE', pressed: [], lockout: 0 },
    beacons: { stock: T.beaconStock, nextAt: 0, green: T.greenStock, flying: [], splashes: [], shots: 0, jamAt: 0, last: null },
    tags: [], events: [],
    elgarzPlan: null,
  };
  w.beacons.jamAt = T.jamEvery[0] + Math.floor(rng() * (T.jamEvery[1] - T.jamEvery[0] + 1));
  dealBoard(w, w.boardRng);
  return w;
}

function emit(w, type, data = {}) { w.events.push({ type, t: w.t, ...data }); }

// ---------- furnace & power ----------
export function slotsAvailable(w) {
  const f = w.furnace;
  if (!f.lit) return 0;
  const [a, b, c] = T.slotHeat;
  return f.heat >= a ? 3 : f.heat >= b ? 2 : f.heat >= c ? 1 : 0;
}
export function light(w) {
  const f = w.furnace;
  if (f.lit) return false;
  if (w.broken.furnace) { emit(w, 'deny', { msg: 'THE GRATE IS CRACKED · REPAIR IT ON THE OVERHEAD DECK' }); return false; }
  if (w.t < f.outUntil) { emit(w, 'deny', { msg: 'THE GRATE IS STILL TOO HOT TO RELIGHT' }); return false; }
  f.lit = true; f.heat = f.everLit ? 30 : T.furnaceStartHeat; f.pending = 0;
  f.everLit = true; w.started = true;
  emit(w, 'ignite');
  return true;
}
export function stoke(w) {
  const f = w.furnace;
  if (!f.lit) { emit(w, 'deny', { msg: 'LIGHT THE FURNACE FIRST' }); return false; }
  if (f.chute <= 0) { emit(w, 'deny', { msg: 'THE FUEL CHUTE IS EMPTY · FILL IT FROM THE RUNE BOARD' }); return false; }
  f.chute--; f.pending += T.stokeAmount; emit(w, 'stoke');
  return true;
}
function spendHeat(w, n) { const f = w.furnace; f.heat = Math.max(0.5, f.heat - n); }
function allOff(w) { for (const s of SYSTEMS) w.power[s].on = false; }
export function setPower(w, sys, on) {
  if (!w.furnace.lit) { emit(w, 'deny', { msg: 'THE FURNACE IS COLD' }); return false; }
  const p = w.power[sys];
  if (on === p.on) return true;
  if (on) {
    const used = SYSTEMS.filter(s => w.power[s].on).length;
    if (used >= slotsAvailable(w)) { emit(w, 'deny', { msg: used >= 3 ? 'FURNACE AT CAPACITY · SWITCH SOMETHING OFF' : 'NOT ENOUGH HEAT · STOKE THE FURNACE' }); return false; }
    p.on = true; p.ready = w.t + SPINUP[sys]; p.since = w.t; emit(w, 'power', { sys, on: true });
  } else {
    p.on = false; emit(w, 'power', { sys, on: false });
  }
  return true;
}
export const isUp = (w, sys) => w.power[sys].on && w.t >= w.power[sys].ready && !(sys === 'radio' && w.broken.fuse);

export function selectCam(w, id) { if (w.activeCam !== id) { w.activeCam = id; emit(w, 'camswitch'); } }

// ---------- rune board ----------
export function pressBoard(w, slot) {
  const b = w.board, rid = b.runes[slot];
  if (rid == null) return;
  const fn = runeFunction(rid, b.page), f = w.furnace;
  emit(w, 'board', { fn });
  const needFire = () => { if (!f.lit) { emit(w, 'deny', { msg: 'THAT NEEDS THE FURNACE LIT' }); return false; } return true; };
  if (fn === 'FUEL') { if (f.chute >= T.chuteMax) emit(w, 'deny', { msg: 'THE FUEL CHUTE IS FULL' }); else { f.chute++; emit(w, 'fuel'); } }
  if (fn === 'COFFEE') {
    if (w.coffee.sips > 0 || w.t < w.coffee.brewUntil) emit(w, 'deny', { msg: 'THE POT IS ALREADY FULL' });
    else if (needFire()) { spendHeat(w, T.coffeeHeat); w.coffee.brewUntil = w.t + T.coffeeBrew; emit(w, 'brew'); }
  }
  if (fn === 'WIPERS') { w.wipe = { cam: w.activeCam, until: w.t + 8 }; emit(w, 'wipers'); }
  if (fn === 'WIRELESS') { w.music = !w.music; emit(w, 'wireless', { on: w.music }); }
  if (fn === 'LAMPS') { w.lamps = (w.lamps + 1) % 3; emit(w, 'lamps', { mode: w.lamps }); }
  if (fn === 'LAUNCH') {
    if (w.color === 'green') emit(w, 'deny', { msg: 'GREEN BEACONS FIRE ONLY FROM THE LAUNCHER TRIGGER' });
    else fireBeacon(w, w.color);
  }
  if (fn === 'BELL') emit(w, 'bell');
  if (fn === 'VENT') { if (f.lit) { f.heat = Math.max(0.5, f.heat - T.ventHeat); f.pending = 0; } emit(w, 'vent'); }
  if (fn === 'NOTHING') emit(w, 'dud');
  if (++b.presses >= T.boardFlipPresses) flipBoard(w);
}
export function flipBoard(w) { dealBoard(w, w.boardRng); w.board.flippedAt = w.t; emit(w, 'flip', { page: BOARD_PAGES[w.board.page] }); }
export function sip(w) {
  if (w.coffee.sips <= 0) return false;
  w.coffee.sips--; w.fatigue = Math.max(0, w.fatigue - T.sipRelief); emit(w, 'sip');
  return true;
}
export function setColor(w, c) { w.color = c; }

// ---------- sonar ----------
export function deployBuoy(w, x, y) {
  if (!isUp(w, 'sonar')) { emit(w, 'deny', { msg: 'SONAR IS UNPOWERED' }); return false; }
  if (w.broken.winch) { emit(w, 'deny', { msg: 'THE BUOY WINCH IS BROKEN · REPAIR IT ON THE OVERHEAD DECK' }); return false; }
  if (w.t < w.buoyRebuildAt) { emit(w, 'deny', { msg: 'NO BUOY ON THE RACK YET' }); return false; }
  if (dist({ x, y }, OBSERVATORY) > T.buoyDeployRange) { emit(w, 'deny', { msg: 'OUT OF LAUNCHER RANGE' }); return false; }
  w.buoy = { x, y, landAt: w.t + 4 }; w.buoyCount++;
  emit(w, 'buoy', { x, y });
  return true;
}

export function ping(w) {
  if (!isUp(w, 'sonar')) { emit(w, 'deny', { msg: 'SONAR IS UNPOWERED' }); return false; }
  if (!w.buoy || w.t < w.buoy.landAt) { emit(w, 'deny', { msg: 'NO BUOY IN THE WATER' }); return false; }
  if (w.pings.some(p => p.deliverAt > w.t)) { emit(w, 'deny', { msg: 'STILL LISTENING FOR THE LAST ECHO' }); return false; }
  const at = { x: w.buoy.x, y: w.buoy.y };
  const found = [];
  for (const b of w.bergs) {
    if (dist(b, at) <= T.buoyRadius) {
      const a = w.rng() * Math.PI * 2, e = w.rng() * 3;
      found.push({ bergId: b.id, x: b.x + Math.cos(a) * e, y: b.y + Math.sin(a) * e, length: b.length, large: b.large });
    }
  }
  // what the water is doing round the buoy, drawn on the chart when the echo returns
  const flow = [];
  for (let gx = -2; gx <= 2; gx++) for (let gy = -2; gy <= 2; gy++) {
    const x = at.x + gx * 140, y = at.y + gy * 140;
    if (hyp(gx * 140, gy * 140) > T.buoyRadius) continue;
    flow.push({ x, y, deep: deepAt(w.field, x, y, w.t), surf: surfaceAt(w.field, x, y, w.t) });
  }
  w.pings.push({ tS: w.t, deliverAt: w.t + T.sonarDelay, at, found, flow });
  w.lastPing = { x: at.x, y: at.y, t: w.t };
  if (w.shark.mode !== 'hunt') emit(w, 'sharkhunt');
  w.shark.mode = 'hunt';
  emit(w, 'ping');
  return true;
}

// ---------- lock & prediction ----------
export function lockOn(w, bergId, x, y, t0, source) {
  w.lock = { bergId, x, y, t0, source, trackSince: null, track: null };
  emit(w, 'lock', { source });
  return w.bergs.find(b => b.id === bergId);
}
export function lockContact(w, c) { return lockOn(w, c.bergId, c.x, c.y, c.tS, 'sonar'); }
// A camera estimates position from bearing and apparent size, to within a few miles.
export function lockFromCamera(w, bergId) {
  const b = w.bergs.find(b => b.id === bergId);
  const a = w.rng() * Math.PI * 2, e = 1 + w.rng() * 2;
  return lockOn(w, bergId, b.x + Math.cos(a) * e, b.y + Math.sin(a) * e, w.t, 'camera');
}
export function setDrift(w, mode) { w.drift = mode; emit(w, 'click'); }

// Predicted ("ghost") position of the locked target, using only what the observatory measured.
export function modelVelocity(w) {
  if (w.lock && w.lock.track) return { x: w.lock.track.vx, y: w.lock.track.vy };
  const r = w.readings;
  if (!r) return { x: 0, y: 0 };
  const k = w.levers.drift;
  if (w.drift === 'deep') return { x: r.deep.x * k, y: r.deep.y * k };
  return { x: (r.surface.x + 0.03 * r.wind.x) * k, y: (r.surface.y + 0.03 * r.wind.y) * k };
}
export function ghostAt(w, t) {
  if (!w.lock) return null;
  const v = modelVelocity(w), dt = t - w.lock.t0;
  return { x: w.lock.x + v.x * dt, y: w.lock.y + v.y * dt };
}
export function lockedBerg(w) { return w.lock ? w.bergs.find(b => b.id === w.lock.bergId) : null; }
export function alignment(w, radius = T.alignRadius) {
  const b = lockedBerg(w); if (!b) return 0;
  return clamp(1 - dist(ghostAt(w, w.t), b) / radius, 0, 1);
}
// Aim quality from things the crew can see: fix age, reading age, and how far the reading was taken from the target.
export function aimQuality(w) {
  const l = w.lock, r = w.readings;
  if (!l) return null;
  const g = ghostAt(w, w.t);
  const fixAge = w.t - l.t0, readAge = r ? w.t - r.t : null, readDist = r ? dist(r, g) : null;
  const fFix = clamp(1 - (fixAge - 12) / 60, 0, 1);
  if (l.track) {
    // the camera measured the drift itself: no buoy needed
    const trackAge = w.t - l.track.t, fTrack = clamp(1 - (trackAge - 10) / 50, 0, 1);
    return { q: Math.round(100 * fFix * fTrack), fixAge, readAge, readDist, drift: 'camera', tracked: true, trackAge, cam: l.track.cam, flight: dist(OBSERVATORY, g) / T.beaconSpeed, fFix, fTrack, fRead: 1, fDist: 1 };
  }
  const fRead = r ? clamp(1 - (readAge - 10) / 50, 0, 1) : 0;
  const fDist = r ? clamp(1 - (readDist - 90) / 330, 0, 1) : 0;
  const q = Math.round(100 * fFix * fRead * fDist);
  return { q, fixAge, readAge, readDist, drift: w.drift, flight: dist(OBSERVATORY, g) / T.beaconSpeed, fFix, fRead, fDist };
}

// ---------- buoy readings ----------
// The numbers exactly as the Currents panel shows them. The scanner code is computed from these.
export function readingDisplay(r) {
  if (!r) return null;
  return {
    windFrom: r.windFrom, windOct: octantName(r.windFrom), windKn: Math.round(r.windSpeed * 3.4),
    surfKn: Number((hyp(r.surface.x, r.surface.y) * KNOTS).toFixed(1)),
    deepKn: Number((hyp(r.deep.x, r.deep.y) * KNOTS).toFixed(1)),
    temp: Math.round(r.temp),
  };
}

// ---------- scanner keypad ----------
export function pressKey(w, slot) {
  const s = w.scanner;
  if (s.calibrated || w.t < s.lockoutUntil) return;
  if (!w.readings) { emit(w, 'deny', { msg: 'THE SCANNER NEEDS A BUOY READING' }); return; }
  if (!s.frozen) { s.frozen = readingDisplay(w.readings); s.code = keypadCode(s.plate, s.frozen); }
  s.lastPress = w.t;
  if (s.plate[slot] === s.code[s.pressed.length]) {
    s.pressed.push(slot); emit(w, 'rune');
    if (s.pressed.length === 4) { s.calibrated = true; s.calCode = s.code.join(','); emit(w, 'calibrated'); }
  } else {
    s.lockoutUntil = w.t + T.runeLockout; s.pressed = []; s.frozen = null; s.code = null;
    s.plate = shuffle(s.plate, w.rng);
    emit(w, 'runefail');
  }
}
function checkTune(w) {
  const s = w.scanner;
  if (!s.calibrated || !w.readings) return;
  const now = keypadCode(s.plate, readingDisplay(w.readings)).join(',');
  if (s.calCode == null) { s.calCode = now; return; }
  if (now === s.calCode) { s.mismatchSince = null; return; }
  // the water has to stay different for a while before the plate drifts out of tune
  if (s.mismatchSince == null) { s.mismatchSince = w.t; return; }
  if (w.t - s.mismatchSince >= T.detuneAfter) { s.mismatchSince = null; s.calibrated = false; s.calCode = null; s.pressed = []; s.frozen = null; s.code = null; emit(w, 'detune'); }
}

// ---------- radio ----------
export function gainFor(d) { return clamp(1.5 + 7.5 * d / REACH, 1, 9.5); }
export function setFreq(w, f) { w.radio.freq = Math.round(clamp(f, 100, 999.9) * 10) / 10; }
export function setGain(w, g) { w.radio.gain = Math.round(clamp(g, 0, 10) * 10) / 10; }
export function setMusic(w, on) { w.music = !!on; }
function radioSources(w) {
  const out = [];
  const b = lockedBerg(w);
  if (b && b.radio) out.push({ kind: 'ice', ...b.radio, base: alignment(w, T.radioAlignRadius), need: gainFor(dist(b, OBSERVATORY)) });
  if (w.music) for (const s of w.stations) out.push({ kind: 'station', ...s, base: 1, need: T.stationGain });
  return out;
}
export function radioSignal(w) {
  const none = { strength: 0, amplitude: 0, clip: false, carrier: null, lamps: null, band: bandOf(w.radio.freq), kind: null };
  if (!isUp(w, 'radio')) return none;
  let best = null, bs = 0;
  for (const s of radioSources(w)) {
    const k = s.base * Math.exp(-(((w.radio.freq - s.freq) / T.radioWidth) ** 2));
    if (k > bs) { bs = k; best = s; }
  }
  if (!best || bs < 0.02) return none;
  const amplitude = bs * w.radio.gain / best.need;
  const readable = bs > T.radioReadable && Math.abs(w.radio.gain - best.need) <= T.gainWindow;
  return { strength: bs, amplitude, clip: amplitude > 1.15, carrier: best.carrier, lamps: readable ? best.shown : null, band: bandOf(w.radio.freq), kind: best.kind, need: best.need };
}

// ---------- beacons ----------
export function fireBeacon(w, color) {
  if (w.broken.launcher) { emit(w, 'deny', { msg: 'THE LAUNCHER IS JAMMED · REPAIR IT' }); return false; }
  if (!w.lock) { emit(w, 'deny', { msg: 'NO TARGET LOCKED' }); return false; }
  const green = color === 'green';
  if (green ? w.beacons.green <= 0 : w.beacons.stock <= 0) { emit(w, 'deny', { msg: green ? 'NO GREEN BEACONS LEFT' : 'BEACON RACK EMPTY' }); return false; }
  const aq = aimQuality(w);
  let aim = ghostAt(w, w.t);
  for (let i = 0; i < 4; i++) aim = ghostAt(w, w.t + dist(OBSERVATORY, aim) / T.beaconSpeed);
  const tf = dist(OBSERVATORY, aim) / T.beaconSpeed;
  if (green) w.beacons.green--;
  else { w.beacons.stock--; if (!w.beacons.nextAt || w.beacons.nextAt < w.t) w.beacons.nextAt = w.t + T.beaconRebuild; }
  const target = lockedBerg(w);
  w.beacons.flying.push({
    x0: OBSERVATORY.x, y0: OBSERVATORY.y, x1: aim.x, y1: aim.y, t0: w.t, t1: w.t + tf, color,
    report: { bergId: target.id, num: target.num, large: target.large, fixAge: aq.fixAge, readAge: aq.readAge, readDist: aq.readDist, drift: aq.drift, q: aq.q, tracked: !!aq.tracked, trackAge: aq.trackAge },
  });
  emit(w, 'launch', { color });
  const bc = w.beacons;
  if (++bc.shots >= bc.jamAt) { w.broken.launcher = true; bc.shots = 0; bc.jamAt = T.jamEvery[0] + Math.floor(w.rng() * (T.jamEvery[1] - T.jamEvery[0] + 1)); emit(w, 'broke', { sys: 'launcher' }); }
  return true;
}
// Why a shot missed, in words the crew can act on.
function missReasons(rep, berg) {
  const out = [];
  if (rep.tracked) {
    if (rep.fixAge > 25) out.push(`the fix was ${Math.round(rep.fixAge)} s old`);
    if (rep.trackAge > 20) out.push(`the camera last measured its drift ${Math.round(rep.trackAge)} s before the shot`);
    if (!out.length) out.push('the ice turned in the current after the camera lost sight of it');
    return out;
  }
  if (rep.drift === 'surface' && berg.large) out.push('the drift switch was on SURFACE, but this ice is large and rides the DEEP current');
  if (rep.drift === 'deep' && !berg.large) out.push('the drift switch was on DEEP, but this ice is small and rides the SURFACE');
  if (rep.fixAge > 25) out.push(`the fix was ${Math.round(rep.fixAge)} s old`);
  if (rep.readAge == null) out.push('there was no current reading, so the prediction never moved');
  else {
    if (rep.readDist > 160) out.push(`the current was read ${Math.round(rep.readDist)} mi from the target`);
    if (rep.readAge > 20) out.push(`the current reading was ${Math.round(rep.readAge)} s old`);
  }
  if (!out.length) out.push('the sea moved more than the reading said it would');
  return out;
}

// ---------- repairs ----------
export function brokenList(w) {
  const out = [];
  for (const c of w.cams) if (c.broken) out.push({ id: c.id, name: c.name + ' CAMERA', cam: true });
  for (const k of Object.keys(BREAKABLE)) if (w.broken[k]) out.push({ id: k, name: BREAKABLE[k], cam: false });
  return out;
}
export function startRepair(w, id) {
  if (w.repairs[id]) return;
  const cam = w.cams.find(c => c.id === id);
  if (cam ? !cam.broken : !w.broken[id]) return;
  w.repairs[id] = w.t + (cam ? T.repairTime : T.minorRepairTime);
  emit(w, 'repairstart', { id });
}
export function badRepair(w) { emit(w, 'spark'); }
function finishRepair(w, id) {
  delete w.repairs[id];
  const cam = w.cams.find(c => c.id === id);
  if (cam) { cam.broken = false; cam.heat = 0; }
  else {
    w.broken[id] = false;
    if (id === 'winch' && !w.buoy) w.buoyRebuildAt = w.t + 20;
    if (id === 'fuse') w.radio.clipTime = 0;
  }
  emit(w, 'repaired', { id });
}

// ---------- spawning ----------
// Count separate camera sightings of a moving point list [{t,x,y}].
export function countSightings(track, cams = CAMERAS, minLen = 15, gap = 10) {
  let n = 0, inView = false, start = 0, lastSeen = -1e9, first = null;
  for (const p of track) {
    const seen = cams.some(c => camSees(c, p));
    if (seen) {
      if (!inView) { if (p.t - lastSeen > gap) start = p.t; inView = true; }
      lastSeen = p.t;
    } else if (inView) {
      inView = false;
      if (lastSeen - start >= minLen) { n++; if (first == null) first = start; }
    }
  }
  if (inView && lastSeen - start >= minLen) { n++; if (first == null) first = start; }
  return { n, first };
}
function hiddenSpot(w, p) {
  if (w.buoy && dist(p, w.buoy) < T.buoyRadius + 200) return false;
  if (w.cams.some(c => camSees(c, p, 0.2))) return false;
  if (dist(p, w.tomb) < TOMB_RADIUS + 250) return false;
  return true;
}
// Trace where a berg would go from here, using the same movement code as the game.
export function trace(w, b0, fromT, toT, step = 5) {
  const b = { ...b0 }, tomb = { ...w.tomb }, out = [];
  let t = fromT, i = 0;
  while (t < toT) {
    advanceTomb(w, tomb, t, DT); t += DT; advanceBerg(w, b, tomb, t, DT);
    if (++i % Math.round(step / DT) === 0) out.push({ t, x: b.x, y: b.y, tomb: { x: tomb.x, y: tomb.y } });
  }
  return out;
}
function rimCandidates(w, n = 48) {
  const out = [], off = w.spawnRng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = off + i / n * Math.PI * 2, r = T.spawnRimFrac * REACH;
    const p = { x: CENTER.x + Math.cos(a) * r, y: CENTER.y + Math.sin(a) * r };
    if (hiddenSpot(w, p)) out.push(p);
  }
  return out;
}
function spawnElgarz(w, b) {
  const end = Math.max(1200, w.t + 600);
  const scored = rimCandidates(w).map(p => ({ p, s: countSightings(trace(w, { ...b, ...p }, w.t, end), w.cams) }));
  let ok = scored.filter(c => c.s.n >= T.spawnMinSightings && c.s.first != null && c.s.first < w.t + 600);
  if (!ok.length) ok = [scored.sort((a, b) => b.s.n - a.s.n)[0]];
  const pick = ok[Math.floor(w.spawnRng() * ok.length)];
  w.elgarzPlan = { x: pick.p.x, y: pick.p.y, sightings: pick.s.n, firstSighting: pick.s.first, candidates: ok.length };
  return pick.p;
}
function spawnFromReserve(w, b, at = null) {
  let p = at;
  if (!p && b.elgarz) p = spawnElgarz(w, b);
  else if (!p) { const c = rimCandidates(w); p = c[Math.floor(w.spawnRng() * c.length)] || { x: CENTER.x, y: CENTER.y - T.spawnRimFrac * REACH }; }
  b.x = p.x; b.y = p.y; delete b.spawnAt;
  w.bergs.push(b);
  emit(w, 'spawn', { berg: b.id });
}
export function spawnDue(w) {
  for (const b of [...w.reserve]) if (w.t >= b.spawnAt) { w.reserve.splice(w.reserve.indexOf(b), 1); spawnFromReserve(w, b); }
}

// ---------- GM commands ----------
export function gm(w, cmd, arg = {}) {
  if (cmd === 'pause') { w.paused = !w.paused; emit(w, w.paused ? 'paused' : 'resumed'); }
  if (cmd === 'camunlock') { w.camUnlocked[w.activeCam] = true; }
  if (cmd === 'repair') {
    w.cams.forEach(c => { c.broken = false; c.heat = 0; }); w.remorhazes = [];
    for (const k of Object.keys(w.broken)) w.broken[k] = false;
    w.repairs = {}; w.buoyRebuildAt = 0; w.radio.clipTime = 0;
  }
  if (cmd === 'restock') { w.beacons.stock = T.beaconStock; w.beacons.green = T.greenStock; }
  if (cmd === 'shark-home') { const a = Math.atan2(w.shark.y - CENTER.y, w.shark.x - CENTER.x) + Math.PI; w.shark.x = CENTER.x + Math.cos(a) * 1500; w.shark.y = CENTER.y + Math.sin(a) * 1500; w.lastPing = null; w.shark.mode = 'roam'; }
  if (cmd === 'shark-to') { w.lastPing = { x: arg.x, y: arg.y, t: w.t }; w.shark.mode = 'hunt'; }
  if (cmd === 'calibrate') { w.scanner.calibrated = true; w.scanner.calCode = null; }
  if (cmd === 'stoke') { const f = w.furnace; w.broken.furnace = false; f.lit = true; f.everLit = true; w.started = true; f.heat = 70; f.pending = 0; f.outUntil = 0; f.chute = T.chuteMax; }
  if (cmd === 'spawn') { for (const b of [...w.reserve].filter(b => b.elgarz)) { w.reserve.splice(w.reserve.indexOf(b), 1); spawnFromReserve(w, b); } }
  if (cmd === 'place-elgarz') {
    const r = w.reserve.find(b => b.elgarz);
    if (r) { w.reserve.splice(w.reserve.indexOf(r), 1); spawnFromReserve(w, r, { x: arg.x, y: arg.y }); w.elgarzPlan = null; }
    else { const e = w.bergs.find(b => b.elgarz); e.x = arg.x; e.y = arg.y; }
  }
  if (cmd === 'storm') w.storms.push(stormThrough({ x: arg.x, y: arg.y }, w.t + 30, w.rng() * Math.PI * 2));
  if (cmd === 'clear-storms') w.storms = w.storms.filter(s => s.t0 > w.t + 1).map(s => s);
  if (cmd === 'lever' && arg.name in w.levers) w.levers[arg.name] = Number(arg.value);
  if (cmd === 'flip') flipBoard(w);
  if (cmd === 'coffee') { w.coffee.sips = T.coffeeSips; w.fatigue = 0; }
  if (cmd === 'win') win(w);
}
function win(w) { if (!w.won) { w.won = true; w.wonAt = w.t; emit(w, 'win'); } }

// ---------- step ----------
export function step(w, dt = DT) {
  if (w.paused || !w.started) return;
  w.t += dt;
  const t = w.t;

  spawnDue(w);

  // furnace
  const f = w.furnace;
  if (f.lit) {
    const add = Math.min(f.pending, T.stokeAmount / T.stokeRamp * dt);
    f.pending -= add; f.heat += add - T.furnaceBurn * w.levers.burn * dt;
    if (f.heat >= T.furnaceBlowout) {
      f.lit = false; f.heat = 0; f.pending = 0; f.outUntil = t + T.furnaceCooldown; allOff(w);
      w.broken.furnace = true;
      emit(w, 'blowout'); emit(w, 'broke', { sys: 'furnace' });
    } else if (f.heat <= 0) {
      f.lit = false; f.heat = 0; f.pending = 0; allOff(w); emit(w, 'furnaceout');
    }
  }
  const slots = slotsAvailable(w);
  const on = SYSTEMS.filter(s => w.power[s].on).sort((a, b) => w.power[b].since - w.power[a].since);
  while (on.length > slots) { const s = on.shift(); w.power[s].on = false; emit(w, 'brownout', { sys: s }); }

  // rune board, coffee, fatigue
  if (t >= w.board.nextFlip) flipBoard(w);
  if (w.coffee.brewUntil && t >= w.coffee.brewUntil) { w.coffee.brewUntil = 0; w.coffee.sips = T.coffeeSips; emit(w, 'brewed'); }
  w.fatigue = clamp(w.fatigue + T.fatigueRate * w.levers.fatigue * dt, 0, 1);

  // repairs
  for (const [id, until] of Object.entries(w.repairs)) if (t >= until) finishRepair(w, id);

  // move the Tomb, then the ice
  advanceTomb(w, w.tomb, t - dt, dt);
  for (const b of w.bergs) advanceBerg(w, b, w.tomb, t, dt);

  // sonar deliveries
  for (const p of w.pings) {
    if (!p.delivered && t >= p.deliverAt) {
      p.delivered = true;
      for (const c of p.found) w.contacts.push({ ...c, tS: p.tS, tD: t, id: 'k' + Math.floor(w.rng() * 1e9) });
      w.flows.push({ t, pts: p.flow });
      emit(w, 'echo', { n: p.found.length });
    }
  }
  w.pings = w.pings.filter(p => !p.delivered || t - p.deliverAt < 1);
  w.contacts = w.contacts.filter(c => t - c.tD < T.contactFade);
  w.flows = w.flows.filter(fl => t - fl.t < T.flowShow);

  // buoy readings
  if (isUp(w, 'currents') && w.buoy && t >= w.buoy.landAt && t - w.readingAt >= T.currentRefresh) {
    const F = w.field, s = surfaceAt(F, w.buoy.x, w.buoy.y, t), d = deepAt(F, w.buoy.x, w.buoy.y, t), wi = windAt(t, F);
    w.readings = {
      t, x: w.buoy.x, y: w.buoy.y, surface: s, deep: d, wind: { x: wi.x, y: wi.y }, windFrom: wi.from, windSpeed: wi.speed,
      temp: tempAt(w.buoy.x, w.buoy.y, t, F, w.tomb),
    };
    w.readingAt = t; emit(w, 'reading');
    checkTune(w);
  }

  // scanner
  const s = w.scanner;
  if (s.frozen && !s.calibrated && t - s.lastPress > 25) { s.frozen = null; s.code = null; s.pressed = []; }
  const lb = lockedBerg(w);
  if (isUp(w, 'scanner') && lb && s.calibrated && !lb.scanned && alignment(w) > T.alignNeeded) {
    lb.scan += dt / T.scanTime;
    if (lb.scan >= 1) { lb.scan = 1; lb.scanned = true; emit(w, 'scandone', { metal: lb.metal }); }
  }

  // radio fuse
  if (isUp(w, 'radio')) {
    const sig = radioSignal(w);
    w.radio.clipTime = sig.clip ? w.radio.clipTime + dt : Math.max(0, w.radio.clipTime - dt * 2);
    if (w.radio.clipTime >= T.fuseClip) { w.broken.fuse = true; w.radio.clipTime = 0; emit(w, 'broke', { sys: 'fuse' }); }
  }

  // cameras heat and remorhazes
  for (const c of w.cams) {
    const watched = isUp(w, 'cameras') && w.activeCam === c.id && !c.broken;
    c.heat = clamp(c.heat + (watched ? T.camHeatUp * w.levers.remorhaz : -T.camCoolDown) * dt, 0, 100);
    const has = w.remorhazes.some(r => r.cam === c.id);
    if (!c.broken && !has && c.heat >= T.remorhazTrigger && w.levers.remorhaz > 0) {
      const ang = (c.facing + (w.rng() - 0.5) * 40) * Math.PI / 180;
      w.remorhazes.push({ cam: c.id, x: c.x + Math.sin(ang) * T.remorhazSpawnDist, y: c.y - Math.cos(ang) * T.remorhazSpawnDist, phase: w.rng() * 6 });
      emit(w, 'remorhaz', { cam: c.id });
    }
  }
  // turning the unlocked camera
  const ac = w.cams.find(c => c.id === w.activeCam);
  if (w.camTurn && camIsUnlocked(w, ac.id)) ac.facing = (ac.facing + w.camTurn * T.camTurnRate * dt + 360) % 360;
  // a camera watching the locked ice measures its drift
  trackStep(w, ac, dt);
  for (const r of w.remorhazes) {
    const c = w.cams.find(c => c.id === r.cam), d = dist(r, c);
    c.tremor = clamp(1 - d / T.remorhazSpawnDist, 0, 1);
    if (c.heat < T.remorhazGiveUp && d > 20) { r.gone = true; emit(w, 'burrow', { cam: c.id }); continue; }
    if (d < 6) { r.gone = true; c.broken = true; c.heat = 0; c.tremor = 0; delete w.camUnlocked[c.id]; emit(w, 'camdead', { cam: c.id }); continue; }
    const sp = T.remorhazSpeed * Math.max(0.5, w.levers.remorhaz);
    r.x += (c.x - r.x) / d * sp * dt; r.y += (c.y - r.y) / d * sp * dt;
  }
  for (const c of w.cams) if (!w.remorhazes.some(r => r.cam === c.id && !r.gone)) c.tremor = 0;
  w.remorhazes = w.remorhazes.filter(r => !r.gone);

  // the Grindmaw: always swims toward the latest ping, fast when far away
  const sh = w.shark;
  if (w.lastPing) {
    const tg = w.lastPing, d = dist(sh, tg);
    if (d > 4) {
      sh.mode = 'hunt';
      sh.heading = Math.atan2(tg.x - sh.x, -(tg.y - sh.y));
      const speed = (d > T.sharkNearDist ? T.sharkFastSpeed : T.sharkSpeed) * w.levers.shark;
      const k = Math.min(d, speed * dt);
      sh.x += (tg.x - sh.x) / d * k; sh.y += (tg.y - sh.y) / d * k;
    } else {
      sh.mode = 'circle';
      sh.heading += 0.35 * dt;
      sh.x += Math.sin(sh.heading) * 1.2 * dt; sh.y -= Math.cos(sh.heading) * 1.2 * dt;
    }
  } else {
    sh.mode = 'roam';
    sh.heading += Math.sin(t / 23) * 0.08 * dt;
    sh.x += Math.sin(sh.heading) * T.sharkRoamSpeed * dt; sh.y -= Math.cos(sh.heading) * T.sharkRoamSpeed * dt;
    if (dist(sh, CENTER) > REACH * 0.85) sh.heading += Math.PI * dt * 0.5;
  }
  if (w.buoy && t >= w.buoy.landAt && dist(sh, w.buoy) < T.sharkKillDist) {
    w.buoy = null; w.buoyRebuildAt = Infinity; w.broken.winch = true;
    emit(w, 'buoydead'); emit(w, 'broke', { sys: 'winch' });
  }

  // beacons
  const bc = w.beacons;
  if (bc.stock < T.beaconStock && bc.nextAt && t >= bc.nextAt) { bc.stock++; bc.nextAt = bc.stock < T.beaconStock ? t + T.beaconRebuild : 0; }
  for (const fl of bc.flying) {
    if (t >= fl.t1 && !fl.done) {
      fl.done = true;
      let best = null, bd = 1e9;
      for (const b of w.bergs) {
        const d = hyp(b.x - fl.x1, b.y - fl.y1), hitR = (b.large ? T.hitLarge + b.length * T.hitPerMile : T.hitSmall) * w.levers.aim;
        if (d < hitR && d < bd) { bd = d; best = b; }
      }
      const target = w.bergs.find(b => b.id === fl.report.bergId);
      if (best) {
        best.tag = fl.color; if (!w.tags.includes(best.id)) w.tags.push(best.id);
        bc.last = { t, hit: true, num: best.num, intended: best.id === fl.report.bergId, color: fl.color, q: fl.report.q };
        emit(w, 'hit', { berg: best.id, num: best.num, color: fl.color });
        if (fl.color === 'green') {
          if (best.elgarz) { if (!w.reveal) { w.reveal = { t, bergId: best.id }; emit(w, 'reveal', { num: best.num }); } }
          else emit(w, 'greenwrong', { num: best.num });
        }
      } else {
        const by = target ? Math.round(dist(target, { x: fl.x1, y: fl.y1 })) : null;
        bc.splashes.push({ x: fl.x1, y: fl.y1, t, tx: target && target.x, ty: target && target.y });
        bc.last = { t, hit: false, num: fl.report.num, by, color: fl.color, q: fl.report.q, reasons: target ? missReasons(fl.report, target) : [] };
        emit(w, 'miss', { num: fl.report.num, by });
      }
    }
  }
  bc.flying = bc.flying.filter(fl => !fl.done);
  bc.splashes = bc.splashes.filter(s => t - s.t < 40);
  if (w.reveal && t - w.reveal.t >= T.revealDelay) win(w);
}

// ---------- camera control & tracking ----------
// Once unlocked, a camera stays unlocked until it is destroyed.
export const camIsUnlocked = (w, id) => !!w.camUnlocked[id];
// The weather readout on a camera's feed: wind speed and the air temperature at that post.
export function camWeather(w, cam) {
  const wi = windAt(w.t, w.field);
  return { windKn: Math.round(wi.speed * 3.4), windOct: octantName(wi.from), air: Math.round(tempAt(cam.x, cam.y, w.t, w.field, w.tomb) - 4) };
}
export function setCamTurn(w, dir) { w.camTurn = dir; }
export function camCode(w) {
  const wx = camWeather(w, w.cams.find(c => c.id === w.activeCam));
  return { order: PLATE_ORDER[w.board.page], wind: windLever(wx.windKn), temp: tempLever(wx.air) };
}
export function setLever(w, name, pos) { w.camPanel[name] = pos; emit(w, 'lever'); }
export function pressPlate(w, shape) {
  const p = w.camPanel;
  if (w.t < p.lockout || camIsUnlocked(w, w.activeCam)) return;
  p.pressed.push(shape); emit(w, 'plate');
  if (p.pressed.length < 3) return;
  const code = camCode(w);
  const ok = p.pressed.join() === code.order.join() && p.wind === code.wind && p.temp === code.temp;
  p.pressed = [];
  if (ok) { w.camUnlocked[w.activeCam] = true; emit(w, 'camunlocked', { cam: w.activeCam }); }
  else { p.lockout = w.t + T.plateLockout; emit(w, 'camfail'); }
}
function trackStep(w, cam, dt) {
  const l = w.lock; if (!l) return;
  const b = w.bergs.find(b => b.id === l.bergId); if (!b) return;
  const seeing = isUp(w, 'cameras') && !cam.broken && camSees(cam, b) && snowAt(w, cam.x, cam.y, w.t) < 0.5;
  if (!seeing) { l.trackSince = null; return; }
  if (l.trackSince == null) l.trackSince = w.t;
  if (w.t - l.trackSince < T.trackTime) return;
  // measured: a fresh fix from the camera and the ice's real drift (to within a few percent)
  const v = driftOf(w.field, b.large, b.x, b.y, w.t), k = w.levers.drift * (b.elgarz ? w.levers.elgarz : 1);
  if (!l.track || w.t - l.track.t > 1) {
    const n = () => 1 + (w.rng() - 0.5) * 2 * T.trackNoise;
    if (!l.track) emit(w, 'tracked', { num: b.num });
    l.track = { vx: v.x * k * n(), vy: v.y * k * n(), t: w.t, cam: cam.id };
    const a = w.rng() * Math.PI * 2, e = w.rng() * 2;
    l.x = b.x + Math.cos(a) * e; l.y = b.y + Math.sin(a) * e; l.t0 = w.t;
  }
}

// What a camera sees: bergs and remorhazes inside its view, sorted far to near.
export function cameraView(w, cam) {
  const items = [];
  const face = cam.facing * Math.PI / 180;
  const consider = (o, kind) => {
    const d = dist(o, cam);
    if (d > T.camRange || d < 2) return;
    const b = Math.atan2(o.x - cam.x, -(o.y - cam.y));
    let rel = b - face; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
    if (Math.abs(rel) > T.camFov / 2 + 0.15) return;
    items.push({ o, kind, d, rel });
  };
  for (const b of w.bergs) consider(b, 'berg');
  for (const r of w.remorhazes) if (r.cam === cam.id) consider(r, 'remorhaz');
  consider(w.tomb, 'tomb');
  items.sort((a, b) => b.d - a.d);
  return items;
}

// Compact truth snapshot for the GM window.
export function snapshot(w) {
  const pend = w.reserve.find(b => b.elgarz);
  return {
    seed: w.seed, t: w.t, won: w.won, paused: w.paused, started: w.started, levers: w.levers,
    bergs: w.bergs.map(b => ({ id: b.id, num: b.num, name: b.name, x: b.x, y: b.y, large: b.large, hollow: b.hollow, metal: b.metal, radio: b.radio, elgarz: b.elgarz, notable: b.notable, tombDrawn: b.tombDrawn, tag: b.tag })),
    pending: w.reserve.map(b => ({ name: b.name, elgarz: b.elgarz })), elgarzAt: pend ? pend.spawnAt : null, elgarzPlan: w.elgarzPlan,
    tomb: { x: w.tomb.x, y: w.tomb.y }, shark: { x: w.shark.x, y: w.shark.y, mode: w.shark.mode }, lastPing: w.lastPing, buoy: w.buoy,
    cams: w.cams.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y, facing: c.facing, heat: c.heat, broken: c.broken })),
    remorhazes: w.remorhazes.map(r => ({ x: r.x, y: r.y, cam: r.cam })),
    storms: stormsAt(w, w.t),
    lock: w.lock, ghost: ghostAt(w, w.t), power: Object.fromEntries(SYSTEMS.map(s => [s, w.power[s].on])),
    beacons: w.beacons.stock, green: w.beacons.green, calibrated: w.scanner.calibrated, broken: brokenList(w).map(b => b.name),
    furnace: { lit: w.furnace.lit, heat: w.furnace.heat, chute: w.furnace.chute }, music: w.music, fatigue: w.fatigue,
    camCode: camCode(w), activeCam: w.activeCam, camUnlocked: Object.keys(w.camUnlocked),
    board: { page: BOARD_PAGES[w.board.page], fns: w.board.runes.map(r => runeFunction(r, w.board.page)) },
    stations: w.stations.map(s => ({ freq: s.freq, decoded: s.decoded, band: s.band })),
    code: w.readings ? keypadCode(w.scanner.plate, readingDisplay(w.readings)) : null,
  };
}
