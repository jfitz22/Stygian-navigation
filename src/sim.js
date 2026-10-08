// The Last Watch simulation. Pure logic, no DOM. Runs in the browser and in Node.
import {
  MAP, CENTER, OBSERVATORY, REACH, ISLAND_R, TOMB_RADIUS, TUNING as T, CAMERAS, NOTABLES,
  FIELDS, FIELD_SPREAD, FILLER, SHOALS, SIZE_CUT, COLD_WATER, PLATE_BY_HOUSE, windLever, tempLever,
  makeField, vortexAt, windAt, tempAt, makeStorms, stormThrough, bandOf, BAND_RANGE, CARRIERS, encodeLamps, NOISE_SIGNALS, STATIONS,
  BOARD_GRID, BOARD_PAGES,
} from './scenario.js';
import { RUNES, makePlate, keypadCode, shuffle, octantName } from './glyphs.js';
import { checkPassword, passwordMatches, FIRST_RULES, RULES_PER_LOCKDOWN, RULES as PW_RULES, WRONG_TRIES } from './password.js';
import * as FL from './fleet.js';
import { GAME_TIME } from './games.js';
export const PAYLOAD = { red: 'stock', orange: 'orange', green: 'green' };

export const SYSTEMS = ['cameras', 'sonar', 'radio', 'scanner', 'currents', 'repair', 'workshop'];
export const SPINUP = { cameras: 1, sonar: 1.5, radio: 2, scanner: 4, currents: 1.5, repair: 1, workshop: 1 };
// The order the furnace sheds systems when the heat drops: last in this list goes first. The crew can reorder it.
export const DEFAULT_PRIORITY = ['sonar', 'cameras', 'currents', 'radio', 'scanner', 'repair', 'workshop'];
// The officers' stations and the defence each one plays.
export const ROLES = ['gunnery', 'signals', 'engineer'];
export const DEFENCE = { gunnery: 'missile', signals: 'snake', engineer: 'wires' };
export const DT = 0.1;
export const BREAKABLE = { furnace: 'FURNACE GRATE', launcher: 'BEACON LAUNCHER', winch: 'BUOY WINCH', fuse: 'RADIO RECEIVER', scanner: 'METAL SCANNER', sonarhead: 'SONAR HEAD' };
// GM levers (multipliers). 1 is the designed game.
export const LEVERS = { drift: 1, tomb: 1, elgarz: 1, shark: 1, burn: 1, remorhaz: 1, aim: 1, fatigue: 1 };

// ---------- helpers ----------
export function mulberry32(seed) {
  const f = function () {
    f.s = (f.s + 0x6D2B79F5) >>> 0;
    let t = f.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.s = seed >>> 0;
  return f;
}
// Save and resume a whole watch. Random generators keep their exact state, Infinity survives,
// and objects shared in two places (Old Tom's target is the last splash) stay shared.
export function saveWorld(w) {
  const seen = new Map();
  const enc = (v, path) => {
    if (typeof v === 'function') return { __rng: v.s };
    if (typeof v === 'number' && !isFinite(v)) return { __num: String(v) };
    if (!v || typeof v !== 'object') return v;
    if (seen.has(v)) return { __ref: seen.get(v) };
    seen.set(v, path);
    if (Array.isArray(v)) return v.map((x, i) => enc(x, [...path, i]));
    const o = {}; for (const k of Object.keys(v)) if (v[k] !== undefined) o[k] = enc(v[k], [...path, k]); return o;
  };
  return JSON.stringify(enc(w, []));
}
export function loadWorld(json) {
  const refs = [];
  const dec = (v, parent, key) => {
    if (!v || typeof v !== 'object') return v;
    if ('__rng' in v) return mulberry32(v.__rng);
    if ('__num' in v) return Number(v.__num);
    if ('__ref' in v) { refs.push([parent, key, v.__ref]); return null; }
    for (const k of Object.keys(v)) v[k] = dec(v[k], v, k);
    return v;
  };
  const w = dec(JSON.parse(json));
  for (const [parent, key, path] of refs) parent[key] = path.reduce((o, k) => o[k], w);
  return w;
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
  const x0 = b.x, y0 = b.y;
  moveBerg(w, b, tomb, t, dt);
  b.vx = (b.x - x0) / dt; b.vy = (b.y - y0) / dt;
}
function moveBerg(w, b, tomb, t, dt) {
  if (b.tombDrawn) {
    // the Gilded Hulk circles the Tomb slowly, always inside its ring
    const dx = b.x - tomb.x, dy = b.y - tomb.y, d = hyp(dx, dy) || 1;
    if (d > TOMB_RADIUS * 0.9) { const sp = Math.min(d, (T.tombSpeed * w.levers.tomb * w.levers.drift + T.tombDrawPull) * dt); b.x -= dx / d * sp; b.y -= dy / d * sp; return; }
    const r = d + (T.hulkOrbitR - d) * Math.min(1, 0.2 * dt), a = Math.atan2(dy, dx) + T.hulkOrbitSpeed * w.levers.drift / Math.max(60, r) * dt;
    b.x = tomb.x + Math.cos(a) * r; b.y = tomb.y + Math.sin(a) * r;
    return;
  }
  const v = driftOf(w.field, b.large, b.x, b.y, t);
  const k = w.levers.drift * (b.elgarz ? w.levers.elgarz : 1);
  v.x *= k; v.y *= k;
  const dx = b.x - tomb.x, dy = b.y - tomb.y, d = hyp(dx, dy) || 1;
  if (b.elgarz) {
    // Elgarz will not go near the Tomb of Levistus. It swerves away.
    const edge = TOMB_RADIUS + T.tombRepelBand;
    if (d < edge) { const f = 1.8 * (1 - (d - TOMB_RADIUS) / T.tombRepelBand); v.x += dx / d * f; v.y += dy / d * f; }
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
    if (look === 'crown') h = edge * (i % 2 ? 0.55 : 1.6 + 0.6 * rng());           // tall and spiky
    if (look === 'grave') h = edge * (i % 3 === 1 ? 1.1 : 0.6);                      // blocky headstones
    pts.push([u, h]);
  }
  return pts;
}
// The sonar printout for an echo class. Bumps are chambers: even (built) or uneven (natural).
function makeEcho(rng, sig, n = null) {
  if (sig === 'solid') return { sig, humps: [], tail: 'flat' };
  const even = sig === 'halls' || sig === 'monster' || (sig === 'flooded' && rng() < 0.5);
  const count = n || (even ? 3 + (rng() < 0.4 ? 1 : 0) : 2 + (rng() < 0.5 ? 1 : 0));
  const humps = []; let x = 44;
  for (let i = 0; i < count; i++) {
    if (even) { humps.push({ x, h: 0.85 }); x += 24; }
    else { humps.push({ x: Math.round(x), h: Math.round([1, 0.5, 0.78][i % 3] * (0.92 + rng() * 0.12) * 100) / 100 }); x += i % 2 ? 15 + rng() * 4 : 30 + rng() * 6; }
  }
  return { sig, humps, tail: sig === 'flooded' ? 'wavy' : sig === 'monster' ? 'pulse' : 'flat' };
}
// What the printout shows for this ice in water at `temp`: a monster below COLD_WATER is too cold to pulse.
export function echoSeen(b, temp) {
  const tc = Math.round(temp);
  return { humps: b.echo.humps, tail: b.echo.tail === 'pulse' && tc < COLD_WATER ? 'flat' : b.echo.tail, temp: tc };
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
const MUST_HAVE = ['FUEL', 'COFFEE'];
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

// opts.deploy: the fleet is in play, and the watch holds at the start until the crew has deployed it. The game always
// does this; without it (the scenario tests) there is no fleet at all.
export function createWorld(seed = newSeed(), opts = {}) {
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
  // ice over 8 miles rides the deep current
  const mk = (id, name, p, length, o, look, notable) => ({
    id, name, num: num++, x: p.x, y: p.y, large: length > 8, length,
    hollow: o.sig !== 'solid', metal: o.metal, echo: makeEcho(gen, o.sig, o.humps),
    radio: o.radio ? makeRadio(gen, o.radio) : null, look, elgarz: !!o.elgarz, tombDrawn: !!o.tombDrawn, notable,
    shape: makeShape(gen, look, length > 8), tag: null, scan: 0, scanned: false,
  });
  const bigLen = () => Math.round(21 + gen() * 9), smallLen = () => Math.round((2 + gen() * 13) * 10) / 10;
  for (const n of NOTABLES) {
    let p = randomInReach(gen, 300, T.rimHold * REACH);
    if (n.tombDrawn) { const a = gen() * Math.PI * 2; p = { x: tombStart.x + Math.cos(a) * T.hulkOrbitR, y: tombStart.y + Math.sin(a) * T.hulkOrbitR }; }
    const b = mk(n.id, n.name, p, n.length, n, n.look, true);
    if (n.spawn) reserve.push({ ...b, spawnAt: n.spawn === 'elgarz' ? T.elgarzSpawnAt : T.lateDecoys[reserve.filter(r => !r.elgarz).length] }); else bergs.push(b);
  }
  // the named field starts loosely together and drifts apart
  for (const fld of FIELDS) {
    const c = randomInReach(gen, 600, 1200), ang = gen() * Math.PI * 2;
    fld.members.forEach((m, i) => {
      const a = ang + i / fld.members.length * 6.283 + (gen() - 0.5) * 0.6, r = FIELD_SPREAD[0] + gen() * (FIELD_SPREAD[1] - FIELD_SPREAD[0]);
      bergs.push({ ...mk(fld.id + i, fld.name, { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }, bigLen(), m, fld.look, true), field: fld.id });
    });
  }
  // the rest of the sea
  let gi = 0;
  for (const f of FILLER) for (let k = 0; k < f.count; k++) {
    const length = f.large ? bigLen() : smallLen(), ns = NOISE_SIGNALS[Math.floor(gen() * NOISE_SIGNALS.length)];
    const radio = f.triad ? { decoded: 'BRW', band: 'MID' } : gen() < (f.transmit || 0) ? { decoded: ns[0], band: ns[1] } : null;
    const name = f.metal ? 'Ice with wreckage' : { halls: 'Ice halls', caverns: 'Ice caves', flooded: 'Flooded ice', monster: 'Something frozen' }[f.sig] || (f.large ? 'A plain giant' : 'A small floe');
    bergs.push(mk('g' + gi++, name, randomInReach(gen, 250, T.rimHold * REACH + 80), length, { sig: f.sig, metal: f.metal, radio }, f.sig === 'monster' ? 'cradle' : 'plain', false));
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
  // the rune carved on each orb's housing (a new one every time the orb is repaired)
  const camRng = mulberry32(seed + 0xCA11);
  const camRune = Object.fromEntries(cams.map(c => [c.id, Math.floor(camRng() * RUNES.length)]));
  const sharkStart = randomInReach(gen, 900, 1500);
  const rng = mulberry32(seed ^ 0x2545F491);

  const w = {
    seed, rng, camRng, spawnRng: mulberry32(seed + 0x51ED), boardRng: mulberry32(seed + 0xB0A2D), field: F, storms, stations,
    t: 0, started: false, paused: false, won: false, wonAt: null, reveal: null,
    levers: { ...LEVERS },
    bergs, reserve,
    tomb: { x: tombStart.x, y: tombStart.y },
    furnace: { lit: false, heat: 0, pending: 0, outUntil: 0, everLit: false, chute: T.chuteStart },
    priority: [...DEFAULT_PRIORITY], damper: 'normal', heatLog: [], heatLogAt: 0,
    power: Object.fromEntries(SYSTEMS.map(s => [s, { on: false, ready: 0, since: 0 }])),
    broken: { furnace: false, launcher: false, winch: false, fuse: false, scanner: false, sonarhead: false },
    repairs: {},        // system or camera id -> time the repair finishes
    cams, activeCam: 'c1',
    remorhazes: [],
    sonarPings: [],     // when the sonar head was last driven: three inside the strain window cracks it
    buoy: null, buoyRebuildAt: 0, buoyCount: 0,
    pings: [], contacts: [], flows: [],
    lastPing: null,     // the Grindmaw always swims toward this
    shark: { x: sharkStart.x, y: sharkStart.y, heading: gen() * 6.28, mode: 'roam' },
    readings: null, readingAt: -99,
    lock: null,         // {bergId, x, y, t0, source}
    scanner: { calibrated: false, calCode: null, lockoutUntil: 0, plate: makePlate(gen), pressed: [], frozen: null, code: null, lastPress: 0 },
    radio: { freq: 300.0, gain: 5, clipTime: 0 },
    music: false, lamps: 0, wipe: null,   // lamps: 0 normal, 1 red, 2 green
    shutterUntil: 0,
    password: null, pwCap: FIRST_RULES, pwSets: 0,
    seal: null,         // the password lock while it is up: {reason, mode: 'enter'|'set', change, pending, tries, pages}
    coffee: { brewUntil: 0, sips: 0 }, fatigue: 0,
    board: { page: 0, runes: [], presses: 0, nextFlip: 0, flippedAt: -99 },
    color: 'red',
    camUnlocked: {},    // camera id -> true while unlocked (until it breaks)
    camRune,            // camera id -> RUNES index carved on its housing
    camTurn: 0,         // -1, 0, +1 while an arrow is held
    camPanel: { wind: 'MIDDLE', temp: 'MIDDLE', pressed: [], lockout: 0 },
    cases: [],          // case board rows {bergId, permanent, verdict, seen:{x,y,t}}
    obs: {},            // what the crew has measured, per iceberg {length, echo, metal, radio, swept}
    sweep: { bergId: null, bins: [] },
    tom: { x: 0, y: 0, heading: 0, mode: 'asleep', patrolR: 0, target: null },
    lastSplash: null,   // Old Tom swims to where the last buoy came down
    checklist: { coffee: false, fuel: false, sonar: false, buoy: false, orbs: false },
    pressure: false,
    beacons: { stock: T.beaconStock, orange: T.orangeStock, green: T.greenStock, flying: [], splashes: [], shots: 0, jamAt: 0, last: null },
    workshop: { curing: [], made: 0 },   // sealed beacons waiting to cure: [{ color, left }]
    callsigns: {},      // iceberg id -> the call sign Signals decoded
    fleet: opts.deploy ? FL.newFleet(mulberry32(seed + 0xF1EE7), true) : { phase: 'off' }, fleetRng: mulberry32(seed + 0xF1EE8),
    hold: opts.deploy ? 'deploy' : null,   // the watch does not run while this is set
    reinforce: false,   // devil reinforcements: paused until the GM resumes
    defence: { next: {}, active: {}, live: {}, overheatAt: -999, seq: 0 }, defRng: mulberry32(seed + 0xDEF0),
    rewards: { mines: 0, lights: 0 },   // when each steady puzzle can pay out again
    monsters: [],       // released from frozen ice by a beacon hit
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
export function light(w, opts = {}) {
  const f = w.furnace;
  if (f.lit) return false;
  if (w.seal && !opts.auth) { emit(w, 'deny', { msg: 'THE FURNACE IS LOCKED · ENTER THE PASSWORD' }); return false; }
  if (w.broken.furnace) { emit(w, 'deny', { msg: 'THE GRATE IS CRACKED · REPAIR IT ON THE OVERHEAD DECK' }); return false; }
  if (w.t < f.outUntil) { emit(w, 'deny', { msg: 'THE GRATE IS STILL TOO HOT TO RELIGHT' }); return false; }
  // relighting is interlocked: the password first
  if (f.everLit && !opts.auth) { openSeal(w, 'relight', { pending: 'light' }); return false; }
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
// The damper: LOW burns slower, but everything powered works slower.
export const slowK = w => w.damper === 'low' ? T.damperSlow : 1;
export function setDamper(w, mode) { if (mode !== 'low' && mode !== 'normal') return; if (w.damper !== mode) { w.damper = mode; emit(w, 'damper', { mode }); } }
// The crew's shed order (first = kept longest). Any system missing from the list keeps its old place at the end.
export function setPriority(w, list) {
  const clean = list.filter((s, i) => SYSTEMS.includes(s) && list.indexOf(s) === i);
  w.priority = [...clean, ...w.priority.filter(s => !clean.includes(s))];
  emit(w, 'priority');
}
// Heat lost per second with n systems running.
export const burnRate = (n, burnLever = 1, damper = 'normal') => (T.burnIdle + T.burnSteps.slice(0, n).reduce((a, b) => a + b, 0)) * burnLever * (damper === 'low' ? T.damperBurn : 1);
const slotsAt = h => { const [a, b, c] = T.slotHeat; return h >= a ? 3 : h >= b ? 2 : h >= c ? 1 : 0; };
// The furnace in plain numbers: what the furnace log (and the GM) needs. Works on a snapshot too.
export function furnaceState(w) {
  const f = w.furnace, on = SYSTEMS.filter(s => w.power[s].on);
  return { lit: f.lit, heat: f.heat, pending: f.pending, chute: f.chute, on, n: on.length, damper: w.damper, priority: w.priority,
    burnLever: w.levers.burn, burn: f.lit ? burnRate(on.length, w.levers.burn, w.damper) : 0, slots: slotsAvailable(w), log: w.heatLog, t: w.t };
}
// Where the heat goes over the next secs seconds with n systems on and no more shovels. Systems drop as the heat
// falls below each slot line. Returns [{dt, heat, n}], ending when the fire goes out.
export function projectHeat(fs, n, secs = 180, stepS = 1) {
  if (!fs.lit) return [];
  let h = fs.heat, pend = fs.pending, k = Math.min(n, slotsAt(h)), out = [{ dt: 0, heat: h, n: k }];
  for (let s = stepS; s <= secs; s += stepS) {
    const add = Math.min(pend, T.stokeAmount / T.stokeRamp * stepS); pend -= add;
    h += add - burnRate(k, fs.burnLever, fs.damper) * stepS;
    k = Math.min(k, slotsAt(h));
    if (h <= 0) { out.push({ dt: s, heat: 0, n: 0 }); break; }
    out.push({ dt: s, heat: h, n: k });
  }
  return out;
}
function allOff(w) { for (const s of SYSTEMS) w.power[s].on = false; }
export function setPower(w, sys, on) {
  if (!w.furnace.lit) { emit(w, 'deny', { msg: 'THE FURNACE IS COLD' }); return false; }
  if (w.seal) { emit(w, 'deny', { msg: 'THE POWER BOARD IS LOCKED · ENTER THE PASSWORD' }); return false; }
  const p = w.power[sys];
  if (on === p.on) return true;
  if (on) {
    const used = SYSTEMS.filter(s => w.power[s].on).length;
    if (used >= slotsAvailable(w)) { emit(w, 'deny', { msg: used >= 3 ? 'FURNACE AT CAPACITY · SWITCH SOMETHING OFF' : 'NOT ENOUGH HEAT · STOKE THE FURNACE' }); return false; }
    p.on = true; p.ready = w.t + SPINUP[sys] * slowK(w); p.since = w.t; if (sys === 'sonar') tick(w, 'sonar'); if (sys === 'cameras') tick(w, 'orbs'); emit(w, 'power', { sys, on: true });
  } else {
    p.on = false; emit(w, 'power', { sys, on: false });
  }
  return true;
}
export const isUp = (w, sys) => w.power[sys].on && w.t >= w.power[sys].ready && !(sys === 'radio' && w.broken.fuse) && !(sys === 'scanner' && w.broken.scanner);

export function selectCam(w, id) { if (w.activeCam !== id) { w.activeCam = id; emit(w, 'camswitch'); } }

// ---------- rune board ----------
export function pressBoard(w, slot) {
  const b = w.board, rid = b.runes[slot];
  if (rid == null) return;
  const fn = runeFunction(rid, b.page);
  emit(w, 'board', { fn });
  runeEffect(w, fn);
  if (++b.presses >= T.boardFlipPresses) flipBoard(w);
}
// What each rune function does. The GM can fire any of these directly.
export const RUNE_FUNCTIONS = ['FUEL', 'COFFEE', 'COOLANT', 'DECOY', 'LAUNCH', 'PURGE', 'SHUTTER', 'LOCKDOWN', 'LIGHTS', 'RADIO', 'ALARM', 'CONFETTI', 'DEVIL', 'SUCCUBUS'];
export function runeEffect(w, fn) {
  const f = w.furnace;
  if (fn === 'FUEL') { if (f.chute >= T.chuteMax) emit(w, 'deny', { msg: 'THE FUEL CHUTE IS FULL' }); else { f.chute++; tick(w, 'fuel'); emit(w, 'fuel'); } }
  if (fn === 'COFFEE') {
    if (w.coffee.sips > 0 || w.t < w.coffee.brewUntil) emit(w, 'deny', { msg: 'THE POT IS ALREADY FULL' });
    else if (!f.lit) emit(w, 'deny', { msg: 'THAT NEEDS THE FURNACE LIT' });
    else { spendHeat(w, T.coffeeHeat); w.coffee.brewUntil = w.t + T.coffeeBrew; tick(w, 'coffee'); emit(w, 'brew'); }
  }
  if (fn === 'COOLANT') { for (const c of w.cams) c.heat = 0; emit(w, 'coolant'); }   // remorhazes give up on a cold orb
  if (fn === 'DECOY') fireDecoy(w);
  if (fn === 'LAUNCH') fireBeacon(w, 'red', { rune: true });
  if (fn === 'PURGE') { const n = f.chute; f.chute = 0; emit(w, 'purge', { n }); }
  if (fn === 'SHUTTER') { w.shutterUntil = w.t + T.shutterTime; emit(w, 'shutter'); }
  if (fn === 'LOCKDOWN') { if (w.seal) emit(w, 'deny', { msg: 'ALREADY LOCKED' }); else openSeal(w, 'lockdown', { change: true }); }
  if (fn === 'LIGHTS') { w.lamps = (w.lamps + 1) % 3; emit(w, 'lights', { mode: w.lamps }); }
  if (fn === 'RADIO') { w.music = !w.music; emit(w, 'cabinradio', { on: w.music }); }
  if (fn === 'ALARM' || fn === 'CONFETTI' || fn === 'DEVIL' || fn === 'SUCCUBUS') emit(w, fn.toLowerCase());
}
export const shuttered = w => w.t < w.shutterUntil;
// A noisemaker fired from the buoy, landing to the side of the Grindmaw's approach so it swerves off the buoy.
function fireDecoy(w) {
  const b = w.buoy;
  if (!b || w.t < b.landAt) { emit(w, 'deny', { msg: 'NO BUOY TO FIRE THE DECOY FROM' }); return; }
  const sh = w.shark, d = dist(sh, b), r = T.decoyRange * T.buoyRadius;
  const ux = d > 1 ? (b.x - sh.x) / d : 1, uy = d > 1 ? (b.y - sh.y) / d : 0;
  const pick = s => ({ x: b.x - uy * r * s, y: b.y + ux * r * s });
  let p = [pick(1), pick(-1)].sort((p, q) => dist(p, CENTER) - dist(q, CENTER))[0];
  const dc = dist(p, CENTER), lim = REACH * 0.9;
  if (dc > lim) p = { x: CENTER.x + (p.x - CENTER.x) * lim / dc, y: CENTER.y + (p.y - CENTER.y) * lim / dc };
  w.lastPing = { x: p.x, y: p.y, t: w.t, decoy: true };
  if (w.shark.mode !== 'hunt') emit(w, 'sharkhunt');
  w.shark.mode = 'hunt';
  emit(w, 'decoy', { x: p.x, y: p.y });
}
export function flipBoard(w) {
  dealBoard(w, w.boardRng); w.board.flippedAt = w.t;
  if (w.seal && !w.seal.pages.includes(w.board.page)) w.seal.pages.push(w.board.page);   // any page seen while the lock is up counts
  emit(w, 'flip', { page: BOARD_PAGES[w.board.page] });
}

// ---------- the password lock ----------
// One lock over the chart, the furnace controls and the launcher. Some triggers only ask for the password;
// LOCKDOWN changes it (enter the old one, then set a new one under more rules). No password yet: set one.
export function openSeal(w, reason, { change = false, pending = null } = {}) {
  if (w.seal) return false;
  if (change && w.password) w.pwCap = Math.min(PW_RULES.length, w.pwCap + RULES_PER_LOCKDOWN);
  w.seal = { reason, mode: w.password ? 'enter' : 'set', change: change || !w.password, pending, tries: 0, pages: [w.board.page], opened: w.t };
  emit(w, 'sealed', { reason, mode: w.seal.mode });
  return true;
}
// The operator types at the terminal. Returns 'ok' | 'wrong' | 'rejected' | 'reboot'.
export function sealInput(w, text) {
  const s = w.seal; if (!s) return 'ok';
  if (s.mode === 'enter') {
    if (passwordMatches(w.password, text)) {
      if (s.change) { s.mode = 'set'; emit(w, 'pwaccepted', { next: 'set' }); return 'ok'; }
      emit(w, 'pwaccepted', {}); finishSeal(w); return 'ok';
    }
    s.tries++;
    if (s.tries >= WRONG_TRIES) { reboot(w); return 'reboot'; }
    emit(w, 'pwwrong', { left: WRONG_TRIES - s.tries });
    return 'wrong';
  }
  const chk = checkPassword(text, w.pwCap, { pages: s.pages });
  if (!chk.ok) { emit(w, 'deny', { msg: chk.ascii ? 'THAT PASSWORD BREAKS A RULE' : 'KEYBOARD LETTERS, NUMBERS AND SYMBOLS ONLY' }); return 'rejected'; }
  w.password = chk.value; w.pwSets++;
  emit(w, 'pwset', { rules: w.pwCap });
  finishSeal(w);
  return 'ok';
}
export const sealRules = w => w.seal ? checkPassword('', w.pwCap, { pages: w.seal.pages }).results.map(r => r.text) : [];
function finishSeal(w) {
  const p = w.seal && w.seal.pending;
  w.seal = null; emit(w, 'unsealed');
  if (p === 'light') light(w, { auth: true });
  if (p === 'green') fireBeacon(w, 'green', { auth: true });
  if (p === 'fatigue') w.fatigue = Math.min(w.fatigue, 0.7);
}
// Too many wrong tries: the ship reboots. Fire out, chute empty, everything off, one or two things break.
// Beacons already fired, the case board and the chart all stay. Then a fresh password, under the same rules.
function reboot(w) {
  const f = w.furnace;
  f.lit = false; f.heat = 0; f.pending = 0; f.chute = 0; allOff(w);
  const pool = ['furnace', 'launcher', 'winch', 'fuse'].filter(k => !w.broken[k]), n = 1 + Math.floor(w.rng() * 2), broke = [];
  for (let i = 0; i < n && pool.length; i++) { const k = pool.splice(Math.floor(w.rng() * pool.length), 1)[0]; w.broken[k] = true; broke.push(k); if (k === 'winch') w.buoy = null; }
  w.password = null;
  w.seal = { reason: 'reboot', mode: 'set', change: true, pending: null, tries: 0, pages: [w.board.page], opened: w.t };
  emit(w, 'reboot', { broke });
  for (const k of broke) emit(w, 'broke', { sys: k });
}
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
  w.buoy = { x, y, landAt: w.t + 4 }; w.buoyCount++; w.readingAt = -99;
  w.lastSplash = { x, y, t: w.t + 4 }; w.tom.target = w.lastSplash; tick(w, 'buoy');
  emit(w, 'buoy', { x, y });
  return true;
}

export function ping(w) {
  if (!isUp(w, 'sonar')) { emit(w, 'deny', { msg: 'SONAR IS UNPOWERED' }); return false; }
  if (shuttered(w)) { emit(w, 'deny', { msg: 'THE SONAR IS SHUTTERED' }); return false; }
  if (!w.buoy || w.t < w.buoy.landAt) { emit(w, 'deny', { msg: 'NO BUOY IN THE WATER' }); return false; }
  if (w.broken.sonarhead) { emit(w, 'deny', { msg: 'THE SONAR HEAD IS CRACKED · REPAIR IT ON THE OVERHEAD DECK' }); return false; }
  if (w.pings.some(p => p.deliverAt > w.t)) { emit(w, 'deny', { msg: 'STILL LISTENING FOR THE LAST ECHO' }); return false; }
  const at = { x: w.buoy.x, y: w.buoy.y };
  const found = [];
  const buoyOnRock = inShoal(at);
  for (const b of w.bergs) {
    if (!buoyOnRock && dist(b, at) <= T.buoyRadius && !inShoal(b)) {
      const a = w.rng() * Math.PI * 2, e = w.rng() * 3;
      found.push({ bergId: b.id, x: b.x + Math.cos(a) * e, y: b.y + Math.sin(a) * e, length: b.length, large: b.large, echo: echoSeen(b, tempAt(b.x, b.y, w.t, w.field, w.tomb)) });
    }
  }
  // a ping also takes a current reading at the buoy
  if (isUp(w, 'currents')) takeReading(w);
  // what the water is doing round the buoy, drawn on the chart when the echo returns
  const flow = [];
  for (let gx = -2; gx <= 2; gx++) for (let gy = -2; gy <= 2; gy++) {
    const x = at.x + gx * 140, y = at.y + gy * 140;
    if (hyp(gx * 140, gy * 140) > T.buoyRadius) continue;
    flow.push({ x, y, deep: deepAt(w.field, x, y, w.t), surf: surfaceAt(w.field, x, y, w.t) });
  }
  w.pings.push({ tS: w.t, deliverAt: w.t + T.sonarDelay * slowK(w), at, found, flow, scattered: buoyOnRock });
  w.lastPing = { x: at.x, y: at.y, t: w.t };
  if (w.shark.mode !== 'hunt') emit(w, 'sharkhunt');
  w.shark.mode = 'hunt';
  emit(w, 'ping');
  // driving the head too hard cracks it: this ping still goes out
  w.sonarPings = w.sonarPings.filter(t0 => w.t - t0 < T.sonarStrainWindow); w.sonarPings.push(w.t);
  if (w.sonarPings.length >= T.sonarStrainPings) { w.sonarPings = []; w.broken.sonarhead = true; emit(w, 'broke', { sys: 'sonarhead' }); }
  return true;
}

// How hard the sonar head is working: for each recent ping, how much of the strain window it still fills (1 → 0).
export const sonarStrain = w => w.sonarPings.filter(t0 => w.t - t0 < T.sonarStrainWindow).map(t0 => 1 - (w.t - t0) / T.sonarStrainWindow);

// ---------- lock & prediction ----------
export function lockOn(w, bergId, x, y, t0, source) {
  w.lock = { bergId, x, y, t0, source, trackSince: null, track: null };
  caseRow(w, bergId, false); seen(w, bergId, x, y, t0);
  emit(w, 'lock', { source });
  return w.bergs.find(b => b.id === bergId);
}
export function lockContact(w, c) {
  const b = lockOn(w, c.bergId, c.x, c.y, c.tS, 'sonar');
  // the printout gives its length and its echo, as it looked in the water at the time
  if (b) { record(w, b.id, 'length', Math.round(b.length)); if (c.echo) record(w, b.id, 'echo', c.echo); }
  return b;
}
// A camera estimates position from bearing and apparent size, to within a few miles.
export function lockFromCamera(w, bergId) {
  const b = w.bergs.find(b => b.id === bergId);
  const a = w.rng() * Math.PI * 2, e = 1 + w.rng() * 2;
  const res = lockOn(w, bergId, b.x + Math.cos(a) * e, b.y + Math.sin(a) * e, w.t, 'camera');
  record(w, bergId, 'length', Math.round(b.length));   // the orb estimates its length
  return res;
}

// Predicted ("ghost") position of the locked target, using only what the observatory measured.
// The current is chosen by the ice's measured size: large ice rides the deep water, small ice the surface and wind.
export function modelVelocity(w) {
  if (w.lock && w.lock.track) return { x: w.lock.track.vx, y: w.lock.track.vy };
  const r = w.readings, b = lockedBerg(w);
  if (!r) return { x: 0, y: 0 };
  const k = w.levers.drift;
  if (!b || b.large) return { x: r.deep.x * k, y: r.deep.y * k };
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
export const hitRadius = (w, b) => (b.large ? T.hitLarge + b.length * T.hitPerMile : T.hitSmall) * w.levers.aim;
// The honest hit chance. The shot rolls against exactly this number.
export function aimQuality(w) {
  const l = w.lock, b = lockedBerg(w);
  if (!l || !b) return null;
  const g = ghostAt(w, w.t), flight = dist(OBSERVATORY, g) / T.beaconSpeed, fixAge = w.t - l.t0, R = hitRadius(w, b);
  const source = l.track && l.track.cam === 'beacon' ? 'beacon' : l.track ? 'orb' : l.source === 'camera' ? 'orb' : l.source;
  if (source === 'beacon') return { q: 100, chance: 1, source, fixAge: 0, flight, R, sigma: 0, reason: null };
  const speed = Math.hypot(b.vx || 0, b.vy || 0), span = fixAge + flight, r = w.readings;
  let rel, reason = null;
  if (l.track) {
    const age = w.t - l.track.t;
    rel = T.aimTrackRel + Math.max(0, age - T.aimReadFull) * T.aimStale;
    if (age > T.aimReadFull) reason = `the orb lost sight of it ${Math.round(age)} s ago: find it in an orb again`;
  } else if (!r) {
    rel = 1;   // no reading: the prediction cannot move at all
    reason = l.source === 'camera' ? 'keep it in the orb a few seconds to measure its drift, or read the current with a buoy' : 'no current reading yet: power CURRENTS with the buoy in the water';
  } else {
    const rd = dist(r, g), ra = w.t - r.t;
    rel = T.aimReadRel + Math.min(1, Math.pow(Math.max(0, rd - T.aimDistFull) / T.aimDistScale, 1.5)) + Math.max(0, ra - T.aimReadFull) * T.aimStale;
    if (rd > 300) reason = `the current was read ${Math.round(rd)} mi from the ice: move the buoy closer`;
    else if (ra > T.aimReadFull * 2) reason = 'the current reading is old: keep CURRENTS powered, or ping again';
    else if (l.source === 'camera') reason = 'keep it in the orb a few seconds to measure its drift';
  }
  rel += span * T.aimAgeRel;
  const sigma = T.aimFixErr + speed * rel * span;
  if (!reason && fixAge > T.aimFixFull) reason = `the fix is ${Math.round(fixAge)} s old: ping again or find it in an orb`;
  const chance = Math.min(T.aimMaxChance, 1 - Math.exp(-(R * R) / (2 * sigma * sigma)));
  return { q: Math.round(chance * 100), chance, source, fixAge, flight, R, sigma, reason: chance < 0.85 ? reason : null };
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

function takeReading(w) {
  if (!w.buoy || w.t < w.buoy.landAt) return;
  const F = w.field, t = w.t, s = surfaceAt(F, w.buoy.x, w.buoy.y, t), d = deepAt(F, w.buoy.x, w.buoy.y, t), wi = windAt(t, F);
  w.readings = {
    t, x: w.buoy.x, y: w.buoy.y, surface: s, deep: d, wind: { x: wi.x, y: wi.y }, windFrom: wi.from, windSpeed: wi.speed,
    temp: tempAt(w.buoy.x, w.buoy.y, t, F, w.tomb),
  };
  w.readingAt = t; emit(w, 'reading');
  checkTune(w);
}

// ---------- scanner keypad ----------
export function pressKey(w, slot) {
  const s = w.scanner;
  if (s.calibrated || w.t < s.lockoutUntil) return;
  if (w.broken.scanner) { emit(w, 'deny', { msg: 'THE SCANNER FUSE HAS BLOWN · REPAIR IT' }); return; }
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
  // the beacon in the ice amplifies its energies; ice without a beacon is out of earshot
  if (b && b.radio && b.tag) out.push({ kind: 'ice', ...b.radio, base: 1, need: gainFor(dist(b, OBSERVATORY)) });
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
  return { strength: bs, amplitude, clip: amplitude > 1.15, carrier: best.carrier, lamps: readable ? best.shown : null, band: bandOf(w.radio.freq), kind: best.kind, need: best.need, srcFreq: best.freq };
}

// ---------- beacons ----------
export function fireBeacon(w, color, opts = {}) {
  if (w.seal) { emit(w, 'deny', { msg: 'THE LAUNCHER IS LOCKED · ENTER THE PASSWORD' }); return false; }
  if (w.broken.launcher) { emit(w, 'deny', { msg: 'THE LAUNCHER IS JAMMED · REPAIR IT' }); return false; }
  const key = PAYLOAD[color] || 'stock';
  if (w.beacons[key] <= 0) { emit(w, 'deny', { msg: key === 'stock' ? 'BEACON RACK EMPTY' : `NO ${color.toUpperCase()} BEACONS LEFT` }); return false; }
  const target = lockedBerg(w);
  if (!target && !opts.rune) { emit(w, 'deny', { msg: 'NO TARGET LOCKED' }); return false; }
  // the accusation needs the password
  if (color === 'green' && !opts.auth) { openSeal(w, 'green', { pending: 'green' }); return false; }
  let fl;
  if (target) {
    const aq = aimQuality(w);
    let aim = ghostAt(w, w.t);
    for (let i = 0; i < 4; i++) aim = ghostAt(w, w.t + dist(OBSERVATORY, aim) / T.beaconSpeed);
    const tf = dist(OBSERVATORY, aim) / T.beaconSpeed;
    // the roll decides; the flight is drawn to match it: a hit lands on the ice, a miss just beside it
    const willHit = w.rng() < aq.chance, fut = futureOf(w, target, tf);
    let x1 = fut.x, y1 = fut.y, by = null;
    if (!willHit) {
      const d = dist(aim, fut), ang = d > 1 ? Math.atan2(aim.y - fut.y, aim.x - fut.x) : w.rng() * Math.PI * 2;
      by = Math.round(hitRadius(w, target) * (1.15 + w.rng() * 1.1)); x1 = fut.x + Math.cos(ang) * by; y1 = fut.y + Math.sin(ang) * by;
    }
    fl = { x0: OBSERVATORY.x, y0: OBSERVATORY.y, x1, y1, t0: w.t, t1: w.t + tf, color,
      bergId: target.id, num: target.num, chance: aq.chance, q: aq.q, reason: aq.reason, willHit, by };
  } else {
    // LAUNCH from the rune board with nothing locked: it goes somewhere in reach
    const a = w.rng() * Math.PI * 2, r = Math.sqrt(w.rng()) * T.buoyDeployRange, x = CENTER.x + Math.cos(a) * r, y = CENTER.y + Math.sin(a) * r;
    fl = { x0: OBSERVATORY.x, y0: OBSERVATORY.y, x1: x, y1: y, t0: w.t, t1: w.t + dist(OBSERVATORY, { x, y }) / T.beaconSpeed, color, wild: true };
  }
  w.beacons[key]--;
  w.beacons.flying.push(fl);
  emit(w, 'launch', { color, wild: !!fl.wild });
  const bc = w.beacons;
  if (++bc.shots >= bc.jamAt) { w.broken.launcher = true; bc.shots = 0; bc.jamAt = T.jamEvery[0] + Math.floor(w.rng() * (T.jamEvery[1] - T.jamEvery[0] + 1)); emit(w, 'broke', { sys: 'launcher' }); }
  return true;
}
// Where a berg will be in `seconds`, using the same movement code as the game.
function futureOf(w, b0, seconds) {
  const b = { ...b0 }, tomb = { ...w.tomb }, n = Math.max(1, Math.round(seconds / DT));
  let t = w.t;
  for (let i = 0; i < n; i++) { advanceTomb(w, tomb, t, DT); t += DT; advanceBerg(w, b, tomb, t, DT); }
  return { x: b.x, y: b.y };
}
function beaconHits(w, b, color, t) {
  const bc = w.beacons;
  b.tag = color; if (!w.tags.includes(b.id)) w.tags.push(b.id);
  if (!w.cases.find(c => c.bergId === b.id && c.permanent)) { caseRow(w, b.id, true); emit(w, 'casepinned', { num: b.num }); }
  emit(w, 'hit', { berg: b.id, num: b.num, color });
  if (color === 'orange') record(w, b.id, 'echo', echoSeen(b, tempAt(b.x, b.y, t, w.field, w.tomb)), { length: Math.round(b.length) });
  if (b.echo.sig === 'monster' && !b.released) releaseMonster(w, b);
  if (color === 'green') {
    if (b.elgarz) { if (!w.reveal) { w.reveal = { t, bergId: b.id }; emit(w, 'reveal', { num: b.num }); } }
    else emit(w, 'greenwrong', { num: b.num });
  }
}
function resolveBeacon(w, fl, t) {
  const bc = w.beacons;
  if (fl.wild) {
    // nothing was locked: real physics, it hits whatever happens to be there
    let best = null, bd = 1e9;
    for (const b of w.bergs) { const d = dist(b, { x: fl.x1, y: fl.y1 }); if (d < hitRadius(w, b) && d < bd) { bd = d; best = b; } }
    if (best) { bc.last = { t, hit: true, num: best.num, intended: false, color: fl.color, q: null, wild: true }; beaconHits(w, best, fl.color, t); }
    else { bc.splashes.push({ x: fl.x1, y: fl.y1, t }); bc.last = { t, hit: false, num: null, by: null, color: fl.color, q: null, wild: true, reasons: ['nothing was locked, so it flew wild'] }; emit(w, 'miss', { num: null, by: null, wild: true }); }
    return;
  }
  const target = w.bergs.find(b => b.id === fl.bergId);
  if (target && fl.willHit) { bc.last = { t, hit: true, num: target.num, intended: true, color: fl.color, q: fl.q }; beaconHits(w, target, fl.color, t); return; }
  // a miss splashes just outside the hit radius, where the flight was drawn to
  bc.splashes.push({ x: fl.x1, y: fl.y1, t, tx: target && target.x, ty: target && target.y });
  bc.last = { t, hit: false, num: fl.num, by: fl.by, color: fl.color, q: fl.q, reasons: [fl.reason || `the odds were ${fl.q}%, and the sea won this one`] };
  emit(w, 'miss', { num: fl.num, by: fl.by });
}

// ---------- repairs ----------
export function brokenList(w) {
  const out = [];
  for (const c of w.cams) if (c.broken) out.push({ id: c.id, name: c.name + ' ORB', cam: true });
  for (const k of Object.keys(BREAKABLE)) if (w.broken[k]) out.push({ id: k, name: BREAKABLE[k], cam: false });
  return out;
}
// The crew needs the repair bay powered, except at the furnace grate, which is mended by hand (or a cold furnace
// could never be fixed). Returns true when the crew sets off.
export function startRepair(w, id) {
  if (w.repairs[id]) return false;
  const cam = w.cams.find(c => c.id === id);
  if (cam ? !cam.broken : !w.broken[id]) return false;
  if (id !== 'furnace' && !isUp(w, 'repair')) { emit(w, 'deny', { msg: 'THE REPAIR BAY HAS NO POWER · SWITCH IT ON' }); return false; }
  w.repairs[id] = w.t + (cam ? T.repairTime : T.minorRepairTime);
  emit(w, 'repairstart', { id });
  return true;
}
// Is a repair making progress right now? (It waits while the repair bay is off.)
export const repairWorking = (w, id) => id === 'furnace' || isUp(w, 'repair');
export function badRepair(w) { emit(w, 'spark'); }
function finishRepair(w, id) {
  delete w.repairs[id];
  const cam = w.cams.find(c => c.id === id);
  if (cam) { cam.broken = false; cam.heat = 0; delete w.camUnlocked[cam.id]; w.camRune[cam.id] = newHousingRune(w, cam.id); }
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
  if (cmd === 'pause' && !w.reinforce) { w.paused = !w.paused; emit(w, w.paused ? 'paused' : 'resumed'); }
  if (cmd === 'camunlock') { w.camUnlocked[w.activeCam] = true; }
  if (cmd === 'confetti' || cmd === 'devil') emit(w, cmd);
  if (cmd === 'repair') {
    w.cams.forEach(c => { c.broken = false; c.heat = 0; }); w.remorhazes = []; w.sonarPings = [];
    for (const k of Object.keys(w.broken)) w.broken[k] = false;
    w.repairs = {}; w.buoyRebuildAt = 0; w.radio.clipTime = 0;
  }
  if (cmd === 'restock') { w.beacons.stock = T.beaconStock; w.beacons.orange = T.orangeStock; w.beacons.green = T.greenStock; }
  if (cmd === 'defence' && ROLES.includes(arg.role)) startDefence(w, arg.role, 'gm');
  if (cmd === 'rehearse') ROLES.forEach((r, i) => { w.defence.next[r] = w.t + 1 + i * 50; });
  if (cmd === 'reinforced') endReinforcements(w);
  if (cmd === 'fleet-auto' && w.fleet.phase === 'deploy') { w.fleet.mine = FL.randomFleet(w.fleetRng); fleetReady(w); }
  if (cmd === 'shark-home' && w.tom.mode !== 'asleep') { const a = Math.atan2(w.tom.y - CENTER.y, w.tom.x - CENTER.x) + Math.PI; w.tom.x = CENTER.x + Math.cos(a) * 1500; w.tom.y = CENTER.y + Math.sin(a) * 1500; w.tom.target = null; w.tom.patrolR = 1500; }
  if (cmd === 'shark-home') { const a = Math.atan2(w.shark.y - CENTER.y, w.shark.x - CENTER.x) + Math.PI; w.shark.x = CENTER.x + Math.cos(a) * 1500; w.shark.y = CENTER.y + Math.sin(a) * 1500; w.lastPing = null; w.shark.mode = 'roam'; }
  if (cmd === 'shark-to') { w.lastPing = { x: arg.x, y: arg.y, t: w.t }; w.shark.mode = 'hunt'; }
  if (cmd === 'tom-to') { if (w.tom.mode === 'asleep') { w.tom.x = arg.x; w.tom.y = arg.y; emit(w, 'tomwakes'); } w.tom.mode = 'hunt'; w.tom.target = { x: arg.x, y: arg.y, t: w.t }; }
  if (cmd === 'wake-tom') { if (w.tom.mode === 'asleep') { w.tom.x = CENTER.x; w.tom.y = CENTER.y - REACH * 0.85; w.tom.mode = 'roam'; emit(w, 'tomwakes'); } }
  if (cmd === 'calibrate') { w.scanner.calibrated = true; w.scanner.calCode = null; }
  if (cmd === 'stoke') { const f = w.furnace; w.broken.furnace = false; f.lit = true; f.everLit = true; w.started = true; f.heat = 70; f.pending = 0; f.outUntil = 0; f.chute = T.chuteMax; }
  if (cmd === 'spawn') { for (const b of [...w.reserve].filter(b => b.elgarz)) { w.reserve.splice(w.reserve.indexOf(b), 1); spawnFromReserve(w, b); } }
  if (cmd === 'place-elgarz') {
    const r = w.reserve.find(b => b.elgarz);
    if (r) { w.reserve.splice(w.reserve.indexOf(r), 1); spawnFromReserve(w, r, { x: arg.x, y: arg.y }); w.elgarzPlan = null; }
    else { const e = w.bergs.find(b => b.elgarz); e.x = arg.x; e.y = arg.y; }
  }
  if (cmd === 'move-berg') { const b = w.bergs.find(b => b.id === arg.id); if (b) { b.x = arg.x; b.y = arg.y; } }
  if (cmd === 'storm') w.storms.push(stormThrough({ x: arg.x, y: arg.y }, w.t + 30, w.rng() * Math.PI * 2));
  if (cmd === 'clear-storms') w.storms = w.storms.filter(s => s.t0 > w.t + 1).map(s => s);
  if (cmd === 'lever' && arg.name in w.levers) w.levers[arg.name] = Number(arg.value);
  if (cmd === 'flip') flipBoard(w);
  if (cmd === 'coffee') { w.coffee.sips = T.coffeeSips; w.fatigue = 0; }
  if (cmd === 'win') win(w);
  if (cmd === 'rune' && RUNE_FUNCTIONS.includes(arg.fn)) runeEffect(w, arg.fn);
  if (cmd === 'seal') openSeal(w, 'gm');
  if (cmd === 'lockdown') openSeal(w, 'lockdown', { change: true });
  if (cmd === 'unseal' && w.seal) { const p = w.seal.pending; w.seal = null; emit(w, 'unsealed'); if (p === 'fatigue') w.fatigue = Math.min(w.fatigue, 0.7); }
  if (cmd === 'lights-normal') { w.lamps = 0; emit(w, 'lights', { mode: 0 }); }
  if (cmd === 'shutter-up') w.shutterUntil = 0;
  if (cmd === 'break') breakThing(w, arg.id);
  if (cmd === 'damper') setDamper(w, arg.mode);
}
// The GM can break anything: a machine id from BREAKABLE, or an orb's camera id.
export function breakThing(w, id) {
  const cam = w.cams.find(c => c.id === id);
  if (cam) { if (!cam.broken) { cam.broken = true; cam.heat = 0; cam.tremor = 0; delete w.camUnlocked[id]; w.remorhazes = w.remorhazes.filter(r => r.cam !== id); emit(w, 'camdead', { cam: id }); } return; }
  if (!(id in w.broken) || w.broken[id]) return;
  w.broken[id] = true;
  if (id === 'winch') { w.buoy = null; w.buoyRebuildAt = Infinity; }
  if (id === 'furnace' && w.furnace.lit) { const f = w.furnace; f.lit = false; f.heat = 0; f.pending = 0; f.outUntil = w.t + T.furnaceCooldown; allOff(w); emit(w, 'blowout'); }
  emit(w, 'broke', { sys: id });
}
function win(w) { if (!w.won) { w.won = true; w.wonAt = w.t; emit(w, 'win'); } }

// ---------- step ----------
export function step(w, dt = DT) {
  if (w.paused || !w.started || w.hold) return;
  w.t += dt;
  const t = w.t;

  spawnDue(w);

  // furnace
  const f = w.furnace;
  if (f.lit) {
    const add = Math.min(f.pending, T.stokeAmount / T.stokeRamp * dt);
    f.pending -= add; f.heat += add - burnRate(SYSTEMS.filter(s => w.power[s].on).length, w.levers.burn, w.damper) * dt;
    if (f.heat >= T.furnaceBlowout) {
      f.lit = false; f.heat = 0; f.pending = 0; f.outUntil = t + T.furnaceCooldown; allOff(w);
      w.broken.furnace = true;
      emit(w, 'blowout'); emit(w, 'broke', { sys: 'furnace' });
    } else if (f.heat <= 0) {
      f.lit = false; f.heat = 0; f.pending = 0; allOff(w); emit(w, 'furnaceout');
    }
  }
  const slots = slotsAvailable(w);
  // too little heat for everything: shed the lowest-priority system first, loudly
  const on = SYSTEMS.filter(s => w.power[s].on).sort((a, b) => w.priority.indexOf(b) - w.priority.indexOf(a));
  while (on.length > slots) { const s = on.shift(); w.power[s].on = false; emit(w, 'brownout', { sys: s }); }
  if (t >= w.heatLogAt) { w.heatLogAt = t + T.heatLogEvery; w.heatLog.push({ t, heat: f.lit ? f.heat : 0, n: SYSTEMS.filter(s => w.power[s].on).length }); if (w.heatLog.length > 180 / T.heatLogEvery + 1) w.heatLog.shift(); }

  // rune board, coffee, fatigue
  if (t >= w.board.nextFlip) flipBoard(w);
  if (w.coffee.brewUntil && t >= w.coffee.brewUntil) { w.coffee.brewUntil = 0; w.coffee.sips = T.coffeeSips; emit(w, 'brewed'); }
  w.fatigue = clamp(w.fatigue + T.fatigueRate * w.levers.fatigue * dt, 0, 1);
  if (w.fatigue >= 1 && !w.seal) openSeal(w, 'fatigue', { pending: 'fatigue' });   // the console logs the operator out

  // repairs
  // a repair waits while its bay has no power, and runs slower on the LOW damper
  for (const id of Object.keys(w.repairs)) {
    if (!repairWorking(w, id)) w.repairs[id] += dt; else if (slowK(w) > 1) w.repairs[id] += dt * (1 - 1 / slowK(w));
    if (t >= w.repairs[id]) finishRepair(w, id);
  }

  // move the Tomb, then the ice
  advanceTomb(w, w.tomb, t - dt, dt);
  for (const b of w.bergs) {
    advanceBerg(w, b, w.tomb, t, dt);
  }

  // sonar deliveries
  for (const p of w.pings) {
    if (!p.delivered && t >= p.deliverAt) {
      p.delivered = true;
      for (const c of p.found) { w.contacts.push({ ...c, tS: p.tS, tD: t, id: 'k' + Math.floor(w.rng() * 1e9) }); seen(w, c.bergId, c.x, c.y, p.tS); }
      w.flows.push({ t, pts: p.flow });
      emit(w, 'echo', { n: p.found.length, scattered: p.scattered });
    }
  }
  w.pings = w.pings.filter(p => !p.delivered || t - p.deliverAt < 1);
  w.contacts = w.contacts.filter(c => t - c.tD < T.contactFade);
  w.flows = w.flows.filter(fl => t - fl.t < T.flowShow);

  // buoy readings
  if (isUp(w, 'currents') && t - w.readingAt >= T.currentRefresh * slowK(w)) takeReading(w);
  // a buoy left inside a storm is torn loose and takes the winch cable with it
  if (w.buoy && t >= w.buoy.landAt) {
    const inStorm = snowAt(w, w.buoy.x, w.buoy.y, t) > T.buoyStormSnow;
    if (inStorm) {
      if (!w.buoy.storm) emit(w, 'buoystorm');
      w.buoy.storm = (w.buoy.storm || 0) + dt;
      if (w.buoy.storm >= T.buoyStormTime) {
        w.buoy = null; w.buoyRebuildAt = Infinity; w.broken.winch = true;
        emit(w, 'buoydead', { who: 'storm' }); emit(w, 'broke', { sys: 'winch' });
      }
    } else w.buoy.storm = 0;
  }

  // scanner
  const s = w.scanner;
  if (s.frozen && !s.calibrated && t - s.lastPress > 25) { s.frozen = null; s.code = null; s.pressed = []; }
  const lb = lockedBerg(w);
  if (isUp(w, 'scanner') && lb && s.calibrated && !lb.scanned && scannerReach(w, lb) > 0) {
    lb.scan += dt / (T.scanTime * slowK(w));
    if (lb.scan >= 1) {
      lb.scan = 1; lb.scanned = true; record(w, lb.id, 'metal', lb.metal); emit(w, 'scandone', { metal: lb.metal });
      // a positive reading sometimes blows the scanner's fuse: the reading counts, then it needs repairing
      if (lb.metal && w.rng() < T.scannerBlowChance) { w.broken.scanner = true; emit(w, 'broke', { sys: 'scanner' }); }
    }
  }

  // radio fuse, radio readings and band sweeps for the case board
  if (isUp(w, 'radio')) {
    const sig = radioSignal(w);
    if (lb && sig.lamps && sig.kind === 'ice') record(w, lb.id, 'radio', { freq: lb.radio.freq, band: lb.radio.band, carrier: lb.radio.carrier, shown: lb.radio.shown });
    if (lb && lb.tag) {
      if (w.sweep.bergId !== lb.id) w.sweep = { bergId: lb.id, bins: [] };
      const bin = Math.floor((w.radio.freq - 100) / T.sweepBin), nBins = Math.ceil(900 / T.sweepBin);
      if (!w.sweep.bins.includes(bin)) { w.sweep.bins.push(bin); if (w.sweep.bins.length >= nBins) record(w, lb.id, 'swept', true); }
    }
    const was = w.radio.clipTime;
    w.radio.clipTime = sig.clip ? w.radio.clipTime + dt : Math.max(0, w.radio.clipTime - dt * 2);
    if (was < T.fuseClip * 0.5 && w.radio.clipTime >= T.fuseClip * 0.5) emit(w, 'fusewarn');
    if (w.radio.clipTime >= T.fuseClip) { w.broken.fuse = true; w.radio.clipTime = 0; emit(w, 'broke', { sys: 'fuse' }); }
  }

  // cameras heat and remorhazes
  for (const c of w.cams) {
    const watched = isUp(w, 'cameras') && w.activeCam === c.id && !c.broken;
    c.heat = clamp(c.heat + (watched ? T.camHeatUp * w.levers.remorhaz * (camIsUnlocked(w, c.id) ? T.unlockedHeat : 1) : -T.camCoolDown) * dt, 0, 100);
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
  else followStep(w, ac, dt);
  // a camera watching the locked ice measures its drift
  trackStep(w, ac, dt);
  beaconStep(w);
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

  // after ten minutes the sea turns meaner: Old Tom wakes
  if (!w.pressure && t >= T.pressureAt) { w.pressure = true; emit(w, 'pressure'); }
  if (w.tom.mode === 'asleep' && t >= T.tomAt) {
    const a = w.rng() * Math.PI * 2; w.tom.x = CENTER.x + Math.cos(a) * REACH * 0.85; w.tom.y = CENTER.y + Math.sin(a) * REACH * 0.85;
    w.tom.mode = 'roam'; if (w.lastSplash) w.tom.target = w.lastSplash; emit(w, 'tomwakes');
  }
  if (w.tom.mode !== 'asleep') hunterStep(w, w.tom, 'tom', w.tom.target, -1, dt);
  // the Grindmaw: always swims toward the latest ping, fast when far away
  const sh = w.shark;
  if (w.lastPing && !w.lastPing.reached) {
    const tg = w.lastPing, d = dist(sh, tg);
    if (d > 4) {
      sh.mode = 'hunt';
      sh.heading = Math.atan2(tg.x - sh.x, -(tg.y - sh.y));
      const speed = (d > T.sharkNearDist ? T.sharkFastSpeed : T.sharkSpeed) * w.levers.shark;
      const k = Math.min(d, speed * dt);
      sh.x += (tg.x - sh.x) / d * k; sh.y += (tg.y - sh.y) / d * k;
    } else {
      // reached the ping: from here it circles the Last Watch at this distance until the next ping
      tg.reached = true;
      sh.patrolR = clamp(dist(sh, CENTER), 320, REACH * 0.9);
    }
  }
  if (w.lastPing && w.lastPing.reached) {
    sh.mode = 'patrol';
    const a = Math.atan2(sh.y - CENTER.y, sh.x - CENTER.x) + T.sharkSpeed * w.levers.shark / sh.patrolR * dt;
    const nx = CENTER.x + Math.cos(a) * sh.patrolR, ny = CENTER.y + Math.sin(a) * sh.patrolR;
    sh.heading = Math.atan2(nx - sh.x, -(ny - sh.y));
    sh.x = nx; sh.y = ny;
  } else if (!w.lastPing) {
    sh.mode = 'roam';
    sh.heading += Math.sin(t / 23) * 0.08 * dt;
    sh.x += Math.sin(sh.heading) * T.sharkRoamSpeed * dt; sh.y -= Math.cos(sh.heading) * T.sharkRoamSpeed * dt;
    if (dist(sh, CENTER) > REACH * 0.85) sh.heading += Math.PI * dt * 0.5;
  }
  monsterStep(w, dt);
  for (const [h, who] of [[sh, 'grindmaw'], [w.tom, 'tom'], ...w.monsters.filter(m => m.fadeAt == null).map(m => [m, 'monster'])]) {
    if (h.mode === 'asleep' || !w.buoy || t < w.buoy.landAt || dist(h, w.buoy) >= T.sharkKillDist) continue;
    w.buoy = null; w.buoyRebuildAt = Infinity; w.broken.winch = true;
    emit(w, 'buoydead', { who }); emit(w, 'broke', { sys: 'winch' });
    if (who === 'monster') { h.fadeAt = t; emit(w, 'monsterfade', { num: h.num, fed: true }); }
  }

  // beacons
  const bc = w.beacons;
  workshopStep(w, dt);
  fleetStep(w);
  defenceStep(w);
  for (const fl of bc.flying) {
    if (t >= fl.t1 && !fl.done) { fl.done = true; resolveBeacon(w, fl, t); }
  }
  bc.flying = bc.flying.filter(fl => !fl.done);
  bc.splashes = bc.splashes.filter(s => t - s.t < 40);
  if (w.reveal && t - w.reveal.t >= T.revealDelay) win(w);
}

// ---------- the beacon workshop: sealed beacons cure one at a time while the WORKSHOP is powered ----------
export function sealBeacon(w, color) {
  if (!PAYLOAD[color]) return false;
  w.workshop.curing.push({ color, left: T.cureTime }); emit(w, 'beaconsealed', { color });
  return true;
}
function workshopStep(w, dt) {
  const q = w.workshop.curing[0];
  if (!q || !isUp(w, 'workshop')) return;
  q.left -= dt / slowK(w);
  if (q.left <= 0) { w.workshop.curing.shift(); w.beacons[PAYLOAD[q.color]]++; w.workshop.made++; emit(w, 'beaconready', { color: q.color }); }
}

// ---------- the fleet ----------
export function fleetPlace(w, i, x, y, dir) { const ok = FL.placeShip(w.fleet, i, x, y, dir); if (ok) emit(w, 'fleetplace'); return ok; }
// All ships placed: the watch can begin.
export function fleetReady(w) {
  const f = w.fleet;
  if (f.phase === 'redeploy') { f.phase = 'play'; f.idleFrom = w.t; f.prevMine = null; emit(w, 'fleetready', { redeploy: true }); return true; }
  if (f.phase !== 'deploy' || !FL.allPlaced(f)) return false;
  f.phase = 'play'; f.idleFrom = w.t; w.hold = null; emit(w, 'fleetready');
  return true;
}
// Our shot. Only on our turn (the enemy answers each shot before the next).
export function fleetFire(w, x, y) {
  const f = w.fleet;
  if (f.phase !== 'play' || w.reinforce || f.enemyAt != null) return null;
  const r = FL.fireAtEnemy(f, x, y);
  if (!r) return null;
  f.last = { by: 'us', ...r, t: w.t }; FL.logShot(f, 'us', r, w.t); emit(w, 'fleetshot', { by: 'us', ...r });
  if (r.all) { f.wins++; emit(w, 'fleetwin'); resetFleets(w); f.prevMine = f.prevMineShift; f.phase = 'redeploy'; f.redeployUntil = w.t + FL.REDEPLOY_TIME; return r; }
  f.enemyAt = w.t + FL.ENEMY_DELAY; f.idleFrom = w.t;
  return r;
}
function enemyShot(w, free) {
  const f = w.fleet, [x, y] = FL.enemyAim(f, w.fleetRng), r = FL.fireAtUs(f, x, y);
  f.enemyAt = null; f.idleFrom = w.t;
  if (!r) return;
  f.last = { by: 'them', ...r, t: w.t, free }; FL.logShot(f, 'them', r, w.t); if (free) f.log[f.log.length - 1].text = 'Nobody was firing. ' + f.log[f.log.length - 1].text; emit(w, 'fleetshot', { by: 'them', free, ...r });
  if (r.all) { f.losses++; w.reinforce = true; w.paused = true; emit(w, 'reinforcements'); }
}
function fleetStep(w) {
  const f = w.fleet;
  if (f.phase === 'redeploy' && w.t >= f.redeployUntil) fleetReady(w);
  if (f.phase !== 'play' || w.reinforce) return;
  if (f.enemyAt != null && w.t >= f.enemyAt) enemyShot(w, false);
  else if (f.enemyAt == null && w.t - f.idleFrom >= FL.IDLE_SHOT) enemyShot(w, true);
}
// A new enemy fleet, and ours shifted a few squares and repaired, so play carries on.
function resetFleets(w) {
  const f = w.fleet;
  f.prevMineShift = f.mine.map(s => ({ ...s }));
  f.mine = FL.shiftFleet(f.mine, w.fleetRng); f.enemy = FL.randomFleet(w.fleetRng);
  f.myShots = {}; f.theirShots = {}; f.enemyAt = null; f.idleFrom = w.t;
  (f.log = f.log || []).push({ t: w.t, text: 'A new enemy fleet on the horizon. Our ships are refitted and take new stations.', kind: 'info' });
}
// The GM has fought off the reinforcements at the table: the watch resumes.
function endReinforcements(w) {
  if (!w.reinforce) return;
  w.reinforce = false; resetFleets(w); w.paused = false; emit(w, 'reinforced'); emit(w, 'resumed');
}

// ---------- the officers' defences ----------
// Each station gets an event every few minutes, never close to another station's. A station that is not connected
// is skipped (its event is put off), so the watch plays on without it.
const randBetween = (w, [a, b]) => a + w.defRng() * (b - a);
function scheduleDefence(w, role, from) {
  const d = w.defence;
  let at = from + randBetween(w, T.defenceEvery[role]);
  for (let k = 0; k < 20; k++) {
    const clash = ROLES.some(r => r !== role && d.next[r] != null && Math.abs(d.next[r] - at) < T.defenceGap);
    if (!clash) break;
    at += T.defenceGap;
  }
  d.next[role] = at;
}
export function startDefence(w, role, reason = 'timer') {
  const d = w.defence;
  if (d.active[role]) return false;
  d.active[role] = { id: ++d.seq, kind: DEFENCE[role], seed: Math.floor(w.defRng() * 1e9), at: w.t, reason };
  emit(w, 'defence', { role, kind: DEFENCE[role], reason });
  return true;
}
function defenceStep(w) {
  const d = w.defence, t = w.t;
  for (const role of ROLES) {
    if (d.next[role] == null) scheduleDefence(w, role, 0);
    const a = d.active[role];
    // a station that dropped out mid-game: no result is coming, so no penalty
    if (a && t - a.at > GAME_TIME[a.kind] + 40) { delete d.active[role]; emit(w, 'defencelost', { role }); }
    if (t >= d.next[role]) {
      if (d.live[role] && !d.active[role]) startDefence(w, role);
      scheduleDefence(w, role, t);
    }
  }
  const f = w.furnace;
  if (f.lit && f.heat > T.overheatHeat && t - d.overheatAt >= T.overheatEvery && d.live.engineer && !d.active.engineer) {
    d.overheatAt = t; startDefence(w, 'engineer', 'overheat');
  }
}
// A station reports how its defence went. Gunnery: res.hits = the camera ids of the towers hit.
export function defenceResult(w, role, id, res = {}) {
  const a = w.defence.active[role];
  if (!a || a.id !== id) return false;
  delete w.defence.active[role];
  if (role === 'gunnery') {
    const hits = (res.hits || []).filter(c => w.cams.some(k => k.id === c && !k.broken));
    for (const c of hits) breakThing(w, c);
    emit(w, 'defencedone', { role, ok: !hits.length, n: hits.length });
  } else if (!res.ok) {
    if (role === 'signals') { const had = !!w.buoy; w.broken.winch = false; breakThing(w, 'winch'); emit(w, 'defencedone', { role, ok: false, buoy: had }); }
    if (role === 'engineer') {
      const on = SYSTEMS.filter(s => w.power[s].on).sort((a, b) => w.priority.indexOf(b) - w.priority.indexOf(a));
      if (on.length) { w.power[on[0]].on = false; emit(w, 'brownout', { sys: on[0] }); }
      w.furnace.chute = Math.max(0, w.furnace.chute - 1); w.lamps = 1;
      emit(w, 'defencedone', { role, ok: false, sys: on[0] || null });
    }
  } else emit(w, 'defencedone', { role, ok: true });
  return true;
}

// ---------- everything a station can ask for ----------
export function setCallsign(w, bergId, text) { w.callsigns[bergId] = String(text || '').toUpperCase().replace(/[^RWB]/g, '').slice(0, 3); emit(w, 'callsign'); }
// ---------- the steady puzzles: optional, with a small reward ----------
// Signals' Minesweeper: a red beacon strikes a glacier for free (always large, never Elgarz; the crew is not told).
export function minesReward(w) {
  if (w.t < w.rewards.mines) return false;
  const pool = w.bergs.filter(b => b.large && !b.elgarz && !b.tag && b.echo.sig !== 'monster' && inReach(b));
  if (!pool.length) return false;
  const b = pool[Math.floor(w.defRng() * pool.length)];
  w.rewards.mines = w.t + T.rewardCooldown;
  beaconHits(w, b, 'red', w.t);
  emit(w, 'freebeacon', { num: b.num });
  return true;
}
// Engineering's Lights Out: a free shovel in the fuel chute.
export function lightsReward(w) {
  if (w.t < w.rewards.lights) return false;
  w.rewards.lights = w.t + T.rewardCooldown;
  const f = w.furnace, had = f.chute;
  f.chute = Math.min(T.chuteMax, f.chute + 1);
  emit(w, 'freefuel', { full: had === f.chute });
  return true;
}
export function stationAction(w, role, a) {
  if (!a || !a.act) return;
  if (a.act === 'minesweeper' && role === 'signals') minesReward(w);
  if (a.act === 'lightsout' && role === 'engineer') lightsReward(w);
  if (a.act === 'seal' && role === 'gunnery') sealBeacon(w, a.color);
  if (a.act === 'defence') defenceResult(w, role, a.id, a.res);
  if (a.act === 'callsign') setCallsign(w, a.bergId, a.text);
  if (a.act === 'verdict') setVerdict(w, a.bergId, a.v);
  if (a.act === 'priority') setPriority(w, a.list || []);
  if (a.act === 'damper') setDamper(w, a.mode);
  if (a.act === 'place') fleetPlace(w, a.i, a.x, a.y, a.dir);
  if (a.act === 'ready') fleetReady(w);
  if (a.act === 'fire') fleetFire(w, a.x, a.y);
}

// ---------- frozen monsters ----------
// A beacon hit cracks the ice and lets it out. It swims for the buoy at the Grindmaw's speeds. Move the buoy at least
// one buoy radius from where it was when the monster woke and it loses interest and fades. It also fades if there is
// no buoy in the water for a while, or once it has eaten one.
function releaseMonster(w, b) {
  b.released = true; b.echo = makeEcho(w.rng, 'caverns'); b.hollow = true;   // the chamber it slept in is empty now
  const m = { x: b.x, y: b.y, heading: 0, anchor: w.buoy ? { x: w.buoy.x, y: w.buoy.y } : null, born: w.t, idle: 0, fadeAt: null, num: b.num, mode: 'hunt' };
  w.monsters.push(m);
  emit(w, 'monster', { num: b.num });
}
function monsterStep(w, dt) {
  const t = w.t;
  for (const m of w.monsters) {
    if (m.fadeAt != null) continue;
    const bu = w.buoy;
    if (bu && !m.anchor) m.anchor = { x: bu.x, y: bu.y };
    if (bu && m.anchor && dist(bu, m.anchor) >= T.buoyRadius) { m.fadeAt = t; emit(w, 'monsterfade', { num: m.num }); continue; }
    if (!bu) { m.idle += dt; if (m.idle >= T.monsterIdleFade) { m.fadeAt = t; emit(w, 'monsterfade', { num: m.num }); } continue; }
    m.idle = 0;
    const d = dist(m, bu); if (d < 1) continue;
    m.heading = Math.atan2(bu.x - m.x, -(bu.y - m.y));
    const k = Math.min(d, (d > T.sharkNearDist ? T.sharkFastSpeed : T.sharkSpeed) * w.levers.shark * dt);
    m.x += (bu.x - m.x) / d * k; m.y += (bu.y - m.y) / d * k;
  }
  w.monsters = w.monsters.filter(m => m.fadeAt == null || t - m.fadeAt < T.monsterFadeTime);
}

// ---------- Old Tom: swims to the last buoy splashdown, then circles the Watch the other way ----------
function hunterStep(w, h, who, tg, dir, dt) {
  if (tg && !tg.reachedBy?.includes(who)) {
    const d = dist(h, tg);
    if (d > 4) {
      h.mode = 'hunt'; h.heading = Math.atan2(tg.x - h.x, -(tg.y - h.y));
      const k = Math.min(d, (d > T.sharkNearDist ? T.sharkFastSpeed : T.sharkSpeed) * w.levers.shark * dt);
      h.x += (tg.x - h.x) / d * k; h.y += (tg.y - h.y) / d * k;
      return;
    }
    (tg.reachedBy = tg.reachedBy || []).push(who);
    h.patrolR = clamp(dist(h, CENTER), 320, REACH * 0.9);
  }
  if (!h.patrolR) h.patrolR = clamp(dist(h, CENTER), 320, REACH * 0.9);
  h.mode = 'patrol';
  const a = Math.atan2(h.y - CENTER.y, h.x - CENTER.x) + dir * T.sharkSpeed * w.levers.shark / h.patrolR * dt;
  const nx = CENTER.x + Math.cos(a) * h.patrolR, ny = CENTER.y + Math.sin(a) * h.patrolR;
  h.heading = Math.atan2(nx - h.x, -(ny - h.y)); h.x = nx; h.y = ny;
}

// ---------- case board ----------
function tick(w, k) { if (!w.checklist[k]) { w.checklist[k] = true; emit(w, 'checklist', { item: k, done: Object.values(w.checklist).every(Boolean) }); } }
function caseRow(w, bergId, permanent) {
  // only one temporary row at a time: the ice you are locked on
  w.cases = w.cases.filter(c => c.permanent || c.bergId === bergId);
  let row = w.cases.find(c => c.bergId === bergId);
  if (!row) { row = { bergId, permanent, verdict: '?', seen: null, added: w.t }; w.cases.push(row); }
  if (permanent) row.permanent = true;
  return row;
}
function seen(w, bergId, x, y, t) {
  const row = w.cases.find(c => c.bergId === bergId);
  if (row && (!row.seen || t >= row.seen.t)) row.seen = { x, y, t };
}
function record(w, bergId, key, value, extra = {}) {
  const o = w.obs[bergId] = w.obs[bergId] || { length: null, echo: null, metal: null, radio: null, swept: false };
  const before = JSON.stringify(o);
  o[key] = value; Object.assign(o, extra);
  if (JSON.stringify(o) !== before) emit(w, 'observed', { bergId, key });
}
export function setVerdict(w, bergId, v) { const row = w.cases.find(c => c.bergId === bergId); if (row) { row.verdict = v; emit(w, 'verdict', { v }); } }
// Lock onto ice from its case board row: live if it carries a beacon, otherwise from where it was last seen.
export function relockCase(w, bergId) {
  const b = w.bergs.find(b => b.id === bergId), row = w.cases.find(c => c.bergId === bergId);
  if (!b || !row) return;
  if (b.tag) return lockOn(w, b.id, b.x, b.y, w.t, 'beacon');
  if (row.seen) return lockOn(w, b.id, row.seen.x, row.seen.y, row.seen.t, 'case board');
}

// ---------- shoals ----------
export const inShoal = p => SHOALS.some(s => dist(p, s) <= s.r);
// ---------- metal scanner: it rides on the buoy ----------
// 1 when the ice is right beside the buoy, falling to 0 at the edge of the buoy's range.
export function scannerReach(w, b) {
  if (!b || !w.buoy || w.t < w.buoy.landAt) return 0;
  return clamp(1 - dist(b, w.buoy) / T.buoyRadius, 0, 1);
}

// ---------- beacon telemetry: ice carrying a beacon reports where it is and how it moves ----------
function beaconStep(w) {
  const l = w.lock; if (!l) return;
  const b = w.bergs.find(b => b.id === l.bergId); if (!b || !b.tag) return;
  if (!l.track || l.track.cam !== 'beacon') emit(w, 'telemetry', { num: b.num });
  l.x = b.x; l.y = b.y; l.t0 = w.t; l.source = 'beacon';
  l.track = { vx: b.vx || 0, vy: b.vy || 0, t: w.t, cam: 'beacon' };
}

// ---------- camera control & tracking ----------
// Once unlocked, a camera stays unlocked until it is destroyed.
export const camIsUnlocked = (w, id) => !!w.camUnlocked[id];
// The weather readout on a camera's feed: wind speed and the air temperature at that post.
export function camWeather(w, cam) {
  const wi = windAt(w.t, w.field);
  // each post sits in its own gusts: the wind there differs from post to post and drifts over time
  const local = 9 * Math.sin(cam.x / 410 + cam.y / 530 + w.field.windPh) + 6 * Math.sin(w.t / 75 + cam.x / 290 - cam.y / 370);
  return { windKn: Math.round(wi.speed * 3.4 + local), windOct: octantName(wi.from), air: Math.round(tempAt(cam.x, cam.y, w.t, w.field, w.tomb) - 8) };
}
export function setCamTurn(w, dir) { w.camTurn = dir; }
export function camCode(w) {
  const wx = camWeather(w, w.cams.find(c => c.id === w.activeCam));
  const rune = RUNES[w.camRune[w.activeCam]];
  return { order: PLATE_BY_HOUSE[rune.house], wind: windLever(wx.windKn), temp: tempLever(wx.air), rune: w.camRune[w.activeCam], house: rune.house };
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
// A fresh housing rune for an orb, never the same as the one it had.
function newHousingRune(w, id) {
  let r; do { r = Math.floor(w.camRng() * RUNES.length); } while (r === w.camRune[id]);
  return r;
}
// An unlocked orb that is tracking the locked ice turns to keep it centred, while you watch it.
function followStep(w, cam, dt) {
  const l = w.lock, b = lockedBerg(w);
  if (!l || !b || !l.track || l.track.cam !== cam.id || !camIsUnlocked(w, cam.id) || cam.broken || !isUp(w, 'cameras')) return;
  let rel = bearingDeg(cam, b) - cam.facing; while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
  const turn = clamp(rel, -T.camTurnRate * dt, T.camTurnRate * dt);
  cam.facing = (cam.facing + turn + 360) % 360;
}
function trackStep(w, cam, dt) {
  const l = w.lock; if (!l) return;
  if (!camIsUnlocked(w, cam.id)) { l.trackSince = null; return; }   // only an unlocked orb can measure drift
  const b = w.bergs.find(b => b.id === l.bergId); if (!b) return;
  const seeing = isUp(w, 'cameras') && !cam.broken && camSees(cam, b) && snowAt(w, cam.x, cam.y, w.t) < 0.5;
  if (!seeing) { l.trackSince = null; return; }
  if (l.trackSince == null) l.trackSince = w.t;
  if (w.t - l.trackSince < T.trackTime * slowK(w)) return;
  // measured: a fresh fix from the camera and the ice's real drift (to within a few percent)
  if (!l.track || w.t - l.track.t > 1) {
    const n = () => 1 + (w.rng() - 0.5) * 2 * T.trackNoise;
    if (!l.track) emit(w, 'tracked', { num: b.num });
    l.track = { vx: (b.vx || 0) * n(), vy: (b.vy || 0) * n(), t: w.t, cam: cam.id };
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

// What the officers' stations need, and nothing else: small enough to send twice a second over the network.
export function stationSnapshot(w, extra = {}) {
  const sonar = { buoy: w.buoy ? { x: w.buoy.x, y: w.buoy.y, landing: w.t < w.buoy.landAt, storm: w.buoy.storm || 0 } : null,
    rebuild: w.buoy ? 0 : Math.max(0, w.buoyRebuildAt - w.t), broken: w.broken.sonarhead || w.broken.winch, up: isUp(w, 'sonar'),
    contacts: w.contacts.map(c => ({ id: c.id, x: c.x, y: c.y, length: c.length, echo: c.echo, age: w.t - c.tD, num: (w.bergs.find(b => b.id === c.bergId) || {}).num })),
    hunters: [['grindmaw', w.shark], ...(w.tom.mode !== 'asleep' ? [['tom', w.tom]] : []), ...w.monsters.filter(m => m.fadeAt == null).map(m => ['monster', m])]
      .filter(([, h]) => w.buoy && dist(h, w.buoy) < T.buoyRadius).map(([kind, h]) => ({ kind, x: h.x, y: h.y })),
    pinging: w.pings.some(p => !p.delivered) };
  return {
    ...extra, t: w.t, started: w.started, paused: w.paused, hold: w.hold, reinforce: w.reinforce, won: w.won,
    furnaceState: furnaceState(w), power: Object.fromEntries(SYSTEMS.map(s => [s, w.power[s].on])),
    beacons: w.beacons.stock, orange: w.beacons.orange, green: w.beacons.green, workshop: w.workshop,
    fleet: w.fleet, defence: { active: w.defence.active }, rewards: w.rewards, callsigns: w.callsigns,
    cams: w.cams.map(c => ({ id: c.id, broken: c.broken })), sonar,
    cases: w.cases.map(c => ({ bergId: c.bergId, seen: c.seen, callsign: w.callsigns[c.bergId] || null, num: (w.bergs.find(b => b.id === c.bergId) || {}).num, permanent: c.permanent, verdict: c.verdict, obs: w.obs[c.bergId] || null })),
  };
}

// Compact truth snapshot for the GM window.
export function snapshot(w) {
  const pend = w.reserve.find(b => b.elgarz);
  return {
    seed: w.seed, t: w.t, won: w.won, paused: w.paused, started: w.started, levers: w.levers,
    bergs: w.bergs.map(b => ({ id: b.id, num: b.num, name: b.name, x: b.x, y: b.y, large: b.large, length: b.length, sig: b.echo.sig, released: !!b.released, hollow: b.hollow, metal: b.metal, radio: b.radio, elgarz: b.elgarz, notable: b.notable, tombDrawn: b.tombDrawn, tag: b.tag })),
    pending: w.reserve.map(b => ({ name: b.name, elgarz: b.elgarz })), elgarzAt: pend ? pend.spawnAt : null, elgarzPlan: w.elgarzPlan,
    tomb: { x: w.tomb.x, y: w.tomb.y }, shark: { x: w.shark.x, y: w.shark.y, mode: w.shark.mode }, lastPing: w.lastPing, buoy: w.buoy,
    cams: w.cams.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y, facing: c.facing, heat: c.heat, broken: c.broken })),
    remorhazes: w.remorhazes.map(r => ({ x: r.x, y: r.y, cam: r.cam })),
    storms: stormsAt(w, w.t),
    lock: w.lock, ghost: ghostAt(w, w.t), power: Object.fromEntries(SYSTEMS.map(s => [s, w.power[s].on])),
    beacons: w.beacons.stock, orange: w.beacons.orange, green: w.beacons.green, workshop: w.workshop, fleet: w.fleet, hold: w.hold, reinforce: w.reinforce,
    defence: { next: w.defence.next, active: w.defence.active, live: w.defence.live }, callsigns: w.callsigns, rewards: w.rewards, calibrated: w.scanner.calibrated, broken: brokenList(w).map(b => b.name),
    furnace: { lit: w.furnace.lit, heat: w.furnace.heat, chute: w.furnace.chute }, music: w.music, fatigue: w.fatigue,
    camCode: camCode(w), activeCam: w.activeCam, tom: { x: w.tom.x, y: w.tom.y, mode: w.tom.mode },
    furnaceState: furnaceState(w), sonarStrain: sonarStrain(w), camRune: w.camRune, brokenIds: Object.keys(w.broken).filter(k => w.broken[k]),
    seal: w.seal ? { reason: w.seal.reason, mode: w.seal.mode, tries: w.seal.tries } : null, password: w.password, pwCap: w.pwCap, lamps: w.lamps, shuttered: shuttered(w),
    shoals: SHOALS, monsters: w.monsters.map(m => ({ x: m.x, y: m.y, num: m.num, fading: m.fadeAt != null })),
    cases: w.cases.map(c => ({ bergId: c.bergId, seen: c.seen, callsign: w.callsigns[c.bergId] || null, num: (w.bergs.find(b => b.id === c.bergId) || {}).num, permanent: c.permanent, verdict: c.verdict, obs: w.obs[c.bergId] || null })), camUnlocked: Object.keys(w.camUnlocked),
    board: { page: BOARD_PAGES[w.board.page], fns: w.board.runes.map(r => runeFunction(r, w.board.page)) },
    stations: w.stations.map(s => ({ freq: s.freq, decoded: s.decoded, band: s.band })),
    code: w.readings ? keypadCode(w.scanner.plate, readingDisplay(w.readings)) : null,
  };
}
