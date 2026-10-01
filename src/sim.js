// The Last Watch simulation. Pure logic, no DOM. Runs in the browser and in Node.
import {
  MAP, CENTER, OBSERVATORY, REACH, ISLAND_R, TOMB_RADIUS, TUNING as T, CAMERAS, NOTABLES, GENERIC_COUNT, GENERIC_TRANSMIT,
  makeField, vortexAt, windAt, tempAt, makeStorms, bandOf, BAND_RANGE, CARRIERS, encodeLamps, NOISE_SIGNALS, STATIONS,
} from './scenario.js';
import { makePlate, keypadCode, shuffle, octantName } from './glyphs.js';

export const SYSTEMS = ['cameras', 'sonar', 'radio', 'scanner', 'currents'];
export const SPINUP = { cameras: 1, sonar: 1.5, radio: 2, scanner: 4, currents: 1.5 };
export const DT = 0.1;

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
function advanceTomb(w, tomb, t, dt) {
  const d = deepAt(w.field, tomb.x, tomb.y, t);
  let vx = d.x * T.tombDriftFactor, vy = d.y * T.tombDriftFactor;
  const dx = tomb.x - CENTER.x, dy = tomb.y - CENTER.y, r = hyp(dx, dy) || 1;
  if (r < 520) { vx += dx / r * 0.4; vy += dy / r * 0.4; }
  tomb.x += vx * dt; tomb.y += vy * dt;
}
function advanceBerg(w, b, tomb, t, dt) {
  const v = driftOf(w.field, b.large, b.x, b.y, t);
  if (b.elgarz) {
    // Elgarz will not go near the Tomb of Levistus. It swerves away.
    const dx = b.x - tomb.x, dy = b.y - tomb.y, d = hyp(dx, dy) || 1, edge = TOMB_RADIUS + T.tombRepelBand;
    if (d < edge) { const k = 1.8 * (1 - (d - TOMB_RADIUS) / T.tombRepelBand); v.x += dx / d * k; v.y += dy / d * k; }
  }
  b.x += v.x * dt; b.y += v.y * dt;
  if (b.elgarz) {
    const dx = b.x - tomb.x, dy = b.y - tomb.y, d = hyp(dx, dy) || 1, min = TOMB_RADIUS + 15;
    if (d < min) { b.x = tomb.x + dx / d * min; b.y = tomb.y + dy / d * min; }
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

export function newSeed() { return Math.floor(Math.random() * 90000) + 10000; }

export function createWorld(seed = newSeed()) {
  const gen = mulberry32(seed);
  const F = makeField(gen);
  const storms = makeStorms(mulberry32(seed + 101));
  let tombStart; do { tombStart = randomInReach(gen, 650, 1250); } while (Math.hypot(deepAt(F, tombStart.x, tombStart.y, 0).x, deepAt(F, tombStart.x, tombStart.y, 0).y) < 0.9);
  const bergs = [], reserve = [];
  let num = 1;
  for (const n of NOTABLES) {
    const p = randomInReach(gen, 300, T.rimHold * REACH);
    const b = {
      id: n.id, name: n.name, num: num++, x: p.x, y: p.y, large: n.large, length: n.length,
      hollow: n.hollow, metal: n.metal, echo: n.echo, radio: n.radio ? makeRadio(gen, n.radio) : null, look: n.look,
      elgarz: !!n.elgarz, notable: true, shape: makeShape(gen, n.look, n.large), tag: null, scan: 0, scanned: false,
    };
    if (n.spawn) reserve.push({ ...b, spawnAt: n.spawn === 'elgarz' ? T.elgarzSpawnAt : T.lateDecoys[reserve.filter(r => !r.elgarz).length] }); else bergs.push(b);
  }
  for (let i = 0; i < GENERIC_COUNT; i++) {
    const large = gen() < 0.35;
    const p = randomInReach(gen, 250, T.rimHold * REACH + 80);
    const tx = gen() < GENERIC_TRANSMIT;
    const ns = NOISE_SIGNALS[Math.floor(gen() * NOISE_SIGNALS.length)];
    bergs.push({
      id: 'g' + i, name: 'Unremarkable ice', num: num++, x: p.x, y: p.y, large,
      length: large ? 9.5 + gen() * 9 : 1.5 + gen() * 4,
      hollow: false, metal: false, echo: { humps: 0, tail: gen() < 0.5 ? 'flat' : 'fuzzflat' },
      radio: tx ? makeRadio(gen, { decoded: ns[0], band: ns[1] }) : null, look: 'plain', elgarz: false, notable: false,
      shape: makeShape(gen, 'plain', large), tag: null, scan: 0, scanned: false,
    });
  }
  // at least a third of all ice transmits
  const all = [...bergs, ...reserve];
  for (const b of all) {
    if (all.filter(x => x.radio).length * 3 >= all.length + 3) break;
    if (!b.radio) { const ns = NOISE_SIGNALS[Math.floor(gen() * NOISE_SIGNALS.length)]; b.radio = makeRadio(gen, { decoded: ns[0], band: ns[1] }); }
  }
  // shuffle numbering so notables are not obviously the low numbers
  const nums = shuffle(all.map((_, i) => i + 1), gen);
  all.forEach((b, i) => { b.num = nums[i]; });
  // the cabin wireless stations, kept clear of Elgarz's frequency
  const ef = all.find(b => b.elgarz).radio.freq;
  const stations = STATIONS.map(s => {
    let r; do { r = makeRadio(gen, s); } while (Math.abs(r.freq - ef) < 3 * T.radioWidth);
    return { ...s, ...r };
  });

  const cams = CAMERAS.map(c => ({ ...c, heat: 0, broken: false, repair: null, tremor: 0 }));
  const sharkStart = randomInReach(gen, 900, 1500);
  const rng = mulberry32(seed ^ 0x2545F491);

  const w = {
    seed, rng, spawnRng: mulberry32(seed + 0x51ED), field: F, storms, stations,
    t: 0, started: false, paused: false, won: false, wonAt: null, reveal: null,
    bergs, reserve,
    tomb: { x: tombStart.x, y: tombStart.y },
    furnace: { lit: false, heat: 0, pending: 0, outUntil: 0, everLit: false },
    power: Object.fromEntries(SYSTEMS.map(s => [s, { on: false, ready: 0, since: 0 }])),
    cams, activeCam: 'c1',
    remorhazes: [],
    buoy: null, buoyRebuildAt: 0, buoyCount: 0,
    pings: [],          // pending pings {tS, deliverAt, at:{x,y}}
    contacts: [],       // delivered sonar contacts
    lastPing: null,     // the Grindmaw always swims toward this
    shark: { x: sharkStart.x, y: sharkStart.y, heading: gen() * 6.28, mode: 'roam' },
    readings: null,     // latest buoy reading
    readingAt: -99,
    lock: null,         // {bergId, x, y, t0, source}
    drift: 'surface',   // launcher/scanner drift selector
    scanner: { calibrated: false, lockoutUntil: 0, plate: makePlate(gen), pressed: [], frozen: null, code: null, lastPress: 0 },
    radio: { freq: 300.0, gain: 5 },
    music: false,
    beacons: { stock: T.beaconStock, nextAt: 0, green: T.greenStock, flying: [], splashes: [] },
    tags: [],
    events: [],
    elgarzPlan: null,
  };
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
  if (w.t < f.outUntil) { emit(w, 'deny', { msg: 'THE GRATE IS STILL TOO HOT TO RELIGHT' }); return false; }
  f.lit = true; f.heat = f.everLit ? 30 : T.furnaceStartHeat; f.pending = 0;
  f.everLit = true; w.started = true;
  emit(w, 'ignite');
  return true;
}
export function stoke(w) {
  const f = w.furnace;
  if (!f.lit) { emit(w, 'deny', { msg: 'LIGHT THE FURNACE FIRST' }); return false; }
  f.pending += T.stokeAmount; emit(w, 'stoke');
  return true;
}
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
export const isUp = (w, sys) => w.power[sys].on && w.t >= w.power[sys].ready;

export function selectCam(w, id) { if (w.activeCam !== id) { w.activeCam = id; emit(w, 'camswitch'); } }

// ---------- sonar ----------
export function deployBuoy(w, x, y) {
  if (!isUp(w, 'sonar')) { emit(w, 'deny', { msg: 'SONAR IS UNPOWERED' }); return false; }
  if (w.t < w.buoyRebuildAt) { emit(w, 'deny', { msg: 'NO BUOY ON THE RACK YET' }); return false; }
  if (dist({ x, y }, OBSERVATORY) > T.buoyDeployRange) { emit(w, 'deny', { msg: 'OUT OF LAUNCHER RANGE' }); return false; }
  w.buoy = { x, y, landAt: w.t + 4 }; w.buoyCount++;
  if (T.recalibrateOnNewBuoy) uncalibrate(w);
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
      const a = w.rng() * Math.PI * 2, e = w.rng() * 5;
      found.push({ bergId: b.id, x: b.x + Math.cos(a) * e, y: b.y + Math.sin(a) * e, length: b.length, large: b.large });
    }
  }
  w.pings.push({ tS: w.t, deliverAt: w.t + T.sonarDelay, at, found });
  w.lastPing = { x: at.x, y: at.y, t: w.t };
  if (w.shark.mode !== 'hunt') emit(w, 'sharkhunt');
  w.shark.mode = 'hunt';
  emit(w, 'ping');
  return true;
}

// ---------- lock & prediction ----------
export function lockOn(w, bergId, x, y, t0, source) {
  w.lock = { bergId, x, y, t0, source };
  emit(w, 'lock', { source });
  return w.bergs.find(b => b.id === bergId);
}
export function lockContact(w, c) { return lockOn(w, c.bergId, c.x, c.y, c.tS, 'sonar'); }
// A camera estimates position from bearing and apparent size.
export function lockFromCamera(w, bergId) {
  const b = w.bergs.find(b => b.id === bergId);
  const a = w.rng() * Math.PI * 2, e = 4 + w.rng() * 6;
  return lockOn(w, bergId, b.x + Math.cos(a) * e, b.y + Math.sin(a) * e, w.t, 'camera');
}
export function setDrift(w, mode) { w.drift = mode; emit(w, 'click'); }

// Predicted ("ghost") position of the locked target, using only what the observatory measured.
export function modelVelocity(w) {
  const r = w.readings;
  if (!r) return { x: 0, y: 0 };
  if (w.drift === 'deep') return { x: r.deep.x, y: r.deep.y };
  return { x: r.surface.x + 0.03 * r.wind.x, y: r.surface.y + 0.03 * r.wind.y };
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
function uncalibrate(w) { const s = w.scanner; s.calibrated = false; s.pressed = []; s.frozen = null; s.code = null; }
export function pressKey(w, slot) {
  const s = w.scanner;
  if (s.calibrated || w.t < s.lockoutUntil) return;
  if (!w.readings) { emit(w, 'deny', { msg: 'THE SCANNER NEEDS A BUOY READING' }); return; }
  if (!s.frozen) { s.frozen = readingDisplay(w.readings); s.code = keypadCode(s.plate, s.frozen); }
  s.lastPress = w.t;
  if (s.plate[slot] === s.code[s.pressed.length]) {
    s.pressed.push(slot); emit(w, 'rune');
    if (s.pressed.length === 4) { s.calibrated = true; emit(w, 'calibrated'); }
  } else {
    s.lockoutUntil = w.t + T.runeLockout; s.pressed = []; s.frozen = null; s.code = null;
    s.plate = shuffle(s.plate, w.rng);
    emit(w, 'runefail');
  }
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
  const readable = bs > 0.75 && Math.abs(w.radio.gain - best.need) <= T.gainWindow;
  return { strength: bs, amplitude, clip: amplitude > 1.15, carrier: best.carrier, lamps: readable ? best.shown : null, band: bandOf(w.radio.freq), kind: best.kind, need: best.need };
}

// ---------- beacons ----------
export function fireBeacon(w, color) {
  if (!w.lock) { emit(w, 'deny', { msg: 'NO TARGET LOCKED' }); return false; }
  const green = color === 'green';
  if (green ? w.beacons.green <= 0 : w.beacons.stock <= 0) { emit(w, 'deny', { msg: green ? 'NO GREEN BEACONS LEFT' : 'BEACON RACK EMPTY' }); return false; }
  let aim = ghostAt(w, w.t);
  for (let i = 0; i < 4; i++) aim = ghostAt(w, w.t + dist(OBSERVATORY, aim) / T.beaconSpeed);
  const tf = dist(OBSERVATORY, aim) / T.beaconSpeed;
  if (green) w.beacons.green--;
  else { w.beacons.stock--; if (!w.beacons.nextAt || w.beacons.nextAt < w.t) w.beacons.nextAt = w.t + T.beaconRebuild; }
  w.beacons.flying.push({ x0: OBSERVATORY.x, y0: OBSERVATORY.y, x1: aim.x, y1: aim.y, t0: w.t, t1: w.t + tf, color });
  emit(w, 'launch');
  return true;
}

export function startRepair(w, camId) {
  const c = w.cams.find(c => c.id === camId);
  if (!c || !c.broken || c.repair) return;
  c.repair = w.t + T.repairTime; emit(w, 'repairstart');
}
export function badRepair(w) { emit(w, 'spark'); }

// ---------- spawning ----------
// Count separate camera sightings of a moving point list [{t,x,y}].
export function countSightings(track, minLen = 15, gap = 10) {
  let n = 0, inView = false, start = 0, lastSeen = -1e9, first = null;
  for (const p of track) {
    const seen = CAMERAS.some(c => camSees(c, p));
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
  if (CAMERAS.some(c => camSees(c, p, 0.2))) return false;
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
  const scored = rimCandidates(w).map(p => ({ p, s: countSightings(trace(w, { ...b, ...p }, w.t, end)) }));
  let ok = scored.filter(c => c.s.n >= T.spawnMinSightings && c.s.first != null && c.s.first < w.t + 600);
  if (!ok.length) ok = [scored.sort((a, b) => b.s.n - a.s.n)[0]];
  const pick = ok[Math.floor(w.spawnRng() * ok.length)];
  w.elgarzPlan = { x: pick.p.x, y: pick.p.y, sightings: pick.s.n, firstSighting: pick.s.first, candidates: ok.length };
  return pick.p;
}
function spawnFromReserve(w, b) {
  let p;
  if (b.elgarz) p = spawnElgarz(w, b);
  else { const c = rimCandidates(w); p = c[Math.floor(w.spawnRng() * c.length)] || { x: CENTER.x, y: CENTER.y - T.spawnRimFrac * REACH }; }
  b.x = p.x; b.y = p.y; delete b.spawnAt;
  w.bergs.push(b);
  emit(w, 'spawn', { berg: b.id });
}
export function spawnDue(w) {
  for (const b of [...w.reserve]) if (w.t >= b.spawnAt) { w.reserve.splice(w.reserve.indexOf(b), 1); spawnFromReserve(w, b); }
}

// ---------- GM commands ----------
export function gm(w, cmd) {
  if (cmd === 'pause') w.paused = !w.paused;
  if (cmd === 'repair') { w.cams.forEach(c => { c.broken = false; c.repair = null; c.heat = 0; }); w.remorhazes = []; w.buoyRebuildAt = 0; }
  if (cmd === 'restock') { w.beacons.stock = T.beaconStock; w.beacons.green = T.greenStock; }
  if (cmd === 'shark-home') { const a = Math.atan2(w.shark.y - CENTER.y, w.shark.x - CENTER.x) + Math.PI; w.shark.x = CENTER.x + Math.cos(a) * 1500; w.shark.y = CENTER.y + Math.sin(a) * 1500; w.lastPing = null; w.shark.mode = 'roam'; }
  if (cmd === 'calibrate') { w.scanner.calibrated = true; }
  if (cmd === 'stoke') { const f = w.furnace; f.lit = true; f.everLit = true; w.started = true; f.heat = 70; f.pending = 0; f.outUntil = 0; }
  if (cmd === 'spawn') { for (const b of [...w.reserve].filter(b => b.elgarz)) { w.reserve.splice(w.reserve.indexOf(b), 1); spawnFromReserve(w, b); } }
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
    f.pending -= add; f.heat += add - T.furnaceBurn * dt;
    if (f.heat >= T.furnaceBlowout) {
      f.lit = false; f.heat = 0; f.pending = 0; f.outUntil = t + T.furnaceCooldown; allOff(w);
      emit(w, 'blowout');
    } else if (f.heat <= 0) {
      f.lit = false; f.heat = 0; f.pending = 0; allOff(w); emit(w, 'furnaceout');
    }
  }
  const slots = slotsAvailable(w);
  const on = SYSTEMS.filter(s => w.power[s].on).sort((a, b) => w.power[b].since - w.power[a].since);
  while (on.length > slots) { const s = on.shift(); w.power[s].on = false; emit(w, 'brownout', { sys: s }); }

  // move the Tomb, then the ice
  advanceTomb(w, w.tomb, t - dt, dt);
  for (const b of w.bergs) advanceBerg(w, b, w.tomb, t, dt);

  // sonar deliveries
  for (const p of w.pings) {
    if (!p.delivered && t >= p.deliverAt) {
      p.delivered = true;
      for (const c of p.found) w.contacts.push({ ...c, tS: p.tS, tD: t, id: 'k' + Math.floor(w.rng() * 1e9) });
      emit(w, 'echo', { n: p.found.length });
    }
  }
  w.pings = w.pings.filter(p => !p.delivered || t - p.deliverAt < 1);
  w.contacts = w.contacts.filter(c => t - c.tD < T.contactFade);

  // buoy readings
  if (isUp(w, 'currents') && w.buoy && t >= w.buoy.landAt && t - w.readingAt >= T.currentRefresh) {
    const F = w.field, s = surfaceAt(F, w.buoy.x, w.buoy.y, t), d = deepAt(F, w.buoy.x, w.buoy.y, t), wi = windAt(t, F);
    w.readings = {
      t, x: w.buoy.x, y: w.buoy.y, surface: s, deep: d, wind: { x: wi.x, y: wi.y }, windFrom: wi.from, windSpeed: wi.speed,
      temp: tempAt(w.buoy.x, w.buoy.y, t, F, w.tomb),
    };
    w.readingAt = t; emit(w, 'reading');
  }

  // scanner
  const s = w.scanner;
  if (s.frozen && !s.calibrated && t - s.lastPress > 25) { s.frozen = null; s.code = null; s.pressed = []; }
  const lb = lockedBerg(w);
  if (isUp(w, 'scanner') && lb && s.calibrated && !lb.scanned && alignment(w) > T.alignNeeded) {
    lb.scan += dt / T.scanTime;
    if (lb.scan >= 1) { lb.scan = 1; lb.scanned = true; emit(w, 'scandone', { metal: lb.metal }); }
  }

  // cameras heat and remorhazes
  for (const c of w.cams) {
    const watched = isUp(w, 'cameras') && w.activeCam === c.id && !c.broken;
    c.heat = clamp(c.heat + (watched ? T.camHeatUp : -T.camCoolDown) * dt, 0, 100);
    if (c.repair && t >= c.repair) { c.broken = false; c.repair = null; c.heat = 0; emit(w, 'repaired'); }
    const has = w.remorhazes.some(r => r.cam === c.id);
    if (!c.broken && !has && c.heat >= T.remorhazTrigger) {
      const ang = (c.facing + (w.rng() - 0.5) * 40) * Math.PI / 180;
      w.remorhazes.push({ cam: c.id, x: c.x + Math.sin(ang) * T.remorhazSpawnDist, y: c.y - Math.cos(ang) * T.remorhazSpawnDist, phase: w.rng() * 6 });
      emit(w, 'remorhaz', { cam: c.id });
    }
  }
  for (const r of w.remorhazes) {
    const c = w.cams.find(c => c.id === r.cam), d = dist(r, c);
    c.tremor = clamp(1 - d / T.remorhazSpawnDist, 0, 1);
    if (c.heat < T.remorhazGiveUp && d > 20) { r.gone = true; emit(w, 'burrow', { cam: c.id }); continue; }
    if (d < 6) { r.gone = true; c.broken = true; c.heat = 0; c.tremor = 0; emit(w, 'camdead', { cam: c.id }); continue; }
    r.x += (c.x - r.x) / d * T.remorhazSpeed * dt; r.y += (c.y - r.y) / d * T.remorhazSpeed * dt;
  }
  for (const c of w.cams) if (!w.remorhazes.some(r => r.cam === c.id && !r.gone)) c.tremor = 0;
  w.remorhazes = w.remorhazes.filter(r => !r.gone);

  // the Grindmaw: always swims toward the latest ping
  const sh = w.shark;
  if (w.lastPing) {
    const tg = w.lastPing, d = dist(sh, tg);
    if (d > 4) {
      sh.mode = 'hunt';
      sh.heading = Math.atan2(tg.x - sh.x, -(tg.y - sh.y));
      const k = Math.min(d, T.sharkSpeed * dt);
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
    w.buoy = null; w.buoyRebuildAt = t + T.buoyRebuild;
    emit(w, 'buoydead');
  }

  // beacons
  const bc = w.beacons;
  if (bc.stock < T.beaconStock && bc.nextAt && t >= bc.nextAt) { bc.stock++; bc.nextAt = bc.stock < T.beaconStock ? t + T.beaconRebuild : 0; }
  for (const fl of bc.flying) {
    if (t >= fl.t1 && !fl.done) {
      fl.done = true;
      let best = null, bd = 1e9;
      for (const b of w.bergs) {
        const d = hyp(b.x - fl.x1, b.y - fl.y1), hitR = b.large ? T.hitLarge + b.length * T.hitPerMile : T.hitSmall;
        if (d < hitR && d < bd) { bd = d; best = b; }
      }
      if (best) {
        best.tag = fl.color; if (!w.tags.includes(best.id)) w.tags.push(best.id);
        emit(w, 'hit', { berg: best.id, num: best.num, color: fl.color });
        if (fl.color === 'green') {
          if (best.elgarz) { if (!w.reveal) { w.reveal = { t, bergId: best.id }; emit(w, 'reveal', { num: best.num }); } }
          else emit(w, 'greenwrong', { num: best.num });
        }
      } else {
        bc.splashes.push({ x: fl.x1, y: fl.y1, t });
        emit(w, 'miss');
      }
    }
  }
  bc.flying = bc.flying.filter(fl => !fl.done);
  bc.splashes = bc.splashes.filter(s => t - s.t < 40);
  if (w.reveal && t - w.reveal.t >= T.revealDelay) win(w);
}

// What a camera sees: bergs and remorhazes inside its fixed view, sorted far to near.
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
    seed: w.seed, t: w.t, won: w.won, paused: w.paused, started: w.started,
    bergs: w.bergs.map(b => ({ id: b.id, num: b.num, name: b.name, x: b.x, y: b.y, large: b.large, hollow: b.hollow, metal: b.metal, radio: b.radio, elgarz: b.elgarz, notable: b.notable, tag: b.tag })),
    pending: w.reserve.map(b => ({ name: b.name, elgarz: b.elgarz })), elgarzAt: pend ? pend.spawnAt : null, elgarzPlan: w.elgarzPlan,
    tomb: { x: w.tomb.x, y: w.tomb.y }, shark: { x: w.shark.x, y: w.shark.y, mode: w.shark.mode }, lastPing: w.lastPing, buoy: w.buoy,
    cams: w.cams.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y, facing: c.facing, heat: c.heat, broken: c.broken })),
    remorhazes: w.remorhazes.map(r => ({ x: r.x, y: r.y, cam: r.cam })),
    storms: stormsAt(w, w.t),
    lock: w.lock, ghost: ghostAt(w, w.t), power: Object.fromEntries(SYSTEMS.map(s => [s, w.power[s].on])),
    beacons: w.beacons.stock, green: w.beacons.green, calibrated: w.scanner.calibrated,
    furnace: { lit: w.furnace.lit, heat: w.furnace.heat }, music: w.music,
    stations: w.stations.map(s => ({ freq: s.freq, decoded: s.decoded, band: s.band })),
    code: w.readings ? keypadCode(w.scanner.plate, readingDisplay(w.readings)) : null,
  };
}
