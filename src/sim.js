// The Last Watch simulation. Pure logic, no DOM. Runs in the browser and in Node.
import {
  MAP_W, MAP_H, OBSERVATORY, TUNING as T, DEEP_VORTICES, SURFACE_VORTICES, SURFACE_DRIFT,
  windAt, STORMS, CAMERAS, NOTABLES, ELGARZ_START_ANGLE, GENERIC_COUNT, TOMB, bandOf,
} from './scenario.js';

export const SYSTEMS = ['cameras', 'sonar', 'radio', 'scanner', 'currents'];
export const SPINUP = { cameras: 1, sonar: 1.5, radio: 2, scanner: 4, currents: 1.5 };

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

function vortex(px, py, v) {
  const dx = px - v.x, dy = py - v.y;
  const r = hyp(dx, dy);
  if (r < 1) return { x: 0, y: 0 };
  const s = v.vmax * (r / v.rpk) * Math.exp(1 - r / v.rpk);
  return { x: v.dir * (-dy / r) * s, y: v.dir * (dx / r) * s };
}
export function deepAt(x, y) {
  let vx = 0, vy = 0;
  for (const v of DEEP_VORTICES) { const w = vortex(x, y, v); vx += w.x; vy += w.y; }
  return { x: vx, y: vy };
}
export function surfaceAt(x, y) {
  let vx = SURFACE_DRIFT.x, vy = SURFACE_DRIFT.y;
  for (const v of SURFACE_VORTICES) { const w = vortex(x, y, v); vx += w.x; vy += w.y; }
  return { x: vx, y: vy };
}
// The true drift rule. Large bergs ride the deep current, small ones ride the surface and wind.
export function driftOf(large, x, y, t) {
  const d = deepAt(x, y), s = surfaceAt(x, y);
  if (large) return { x: 0.85 * d.x + 0.15 * s.x, y: 0.85 * d.y + 0.15 * s.y };
  const w = windAt(t);
  return { x: s.x + 0.03 * w.x, y: s.y + 0.03 * w.y };
}
export function stormsAt(t) {
  const out = [];
  for (const s of STORMS) {
    if (t < s.t0 || t > s.t1) continue;
    const k = (t - s.t0) / (s.t1 - s.t0);
    const fade = Math.min(1, (t - s.t0) / 60, (s.t1 - t) / 60);
    out.push({ x: s.x0 + (s.x1 - s.x0) * k, y: s.y0 + (s.y1 - s.y0) * k, r: s.r, strength: fade });
  }
  return out;
}
export function snowAt(x, y, t) {
  let snow = 0;
  for (const s of stormsAt(t)) {
    const d = hyp(x - s.x, y - s.y);
    if (d < s.r) snow = Math.max(snow, s.strength * (1 - (d / s.r) ** 2));
  }
  return snow;
}
export function bearingDeg(from, to) {
  const b = Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI;
  return (b + 360) % 360;
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
    if (look === 'elgarz') h = edge * (0.5 + 0.08 * rng());          // long, low, flat-topped
    if (look === 'horn' && i === Math.floor(n * 0.6)) h = 2.4;
    if (look === 'cairn' && i === Math.floor(n / 2)) h = 2.2;
    if (look === 'bell') h = edge * (0.9 + 0.1 * Math.sin(u * Math.PI));
    pts.push([u, h]);
  }
  return pts;
}

function orbitStart(o) {
  const c = o.field === 'deep' ? DEEP_VORTICES[0] : SURFACE_VORTICES[0];
  return { x: c.x + o.r * Math.cos(o.a), y: c.y + o.r * Math.sin(o.a) };
}

export function createWorld(seed = 1717) {
  const rng = mulberry32(seed);
  const bergs = [];
  let num = 1;
  for (const n of NOTABLES) {
    const o = { ...n.orbit };
    if (n.elgarz) o.a = ELGARZ_START_ANGLE;
    const p = orbitStart(o);
    bergs.push({
      id: n.id, name: n.name, num: num++, x: p.x, y: p.y, large: n.large, length: n.length,
      hollow: n.hollow, metal: n.metal, echo: n.echo, radio: n.radio, look: n.look,
      elgarz: !!n.elgarz, shape: makeShape(rng, n.look, n.large), tag: null, scan: 0, scanned: false,
    });
  }
  for (let i = 0; i < GENERIC_COUNT; i++) {
    const large = rng() < 0.35;
    const field = large ? 'deep' : 'surface';
    const p = orbitStart({ field, r: 180 + rng() * 900, a: rng() * Math.PI * 2 });
    p.x = clamp(p.x, 200, MAP_W - 200); p.y = clamp(p.y, 150, 2250);
    bergs.push({
      id: 'g' + i, name: 'Unremarkable ice', num: num++, x: p.x, y: p.y, large,
      length: large ? 9.5 + rng() * 9 : 1.5 + rng() * 4,
      hollow: false, metal: false, echo: { humps: 0, tail: rng() < 0.5 ? 'flat' : 'fuzzflat' },
      radio: null, look: 'plain', elgarz: false, shape: makeShape(rng, 'plain', large), tag: null, scan: 0, scanned: false,
    });
  }
  // shuffle numbering so notables are not obviously the low numbers
  const nums = bergs.map((_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
  bergs.forEach((b, i) => { b.num = nums[i]; });

  const cams = CAMERAS.map(c => ({ ...c, heat: 0, broken: false, repair: null, tremor: 0 }));

  return {
    seed, rng, t: 0, paused: false, won: false, wonAt: null, lit: false,
    bergs,
    tomb: { x: TOMB.x, y: TOMB.y },
    power: Object.fromEntries(SYSTEMS.map(s => [s, { on: false, ready: 0 }])),
    cams, activeCam: 'c1',
    remorhazes: [],
    buoy: null, buoyRebuildAt: 0,
    pings: [],          // pending pings {tS, deliverAt, at:{x,y}}
    contacts: [],       // delivered sonar contacts
    noise: [],          // {x,y,level}
    shark: { x: 3400, y: 2100, mode: 'roam', target: null, heading: 0, seen: true },
    readings: null,     // latest current/wind reading
    readingAt: -99,
    lock: null,         // {bergId, x, y, t0, source}
    drift: 'surface',   // launcher/scanner drift selector
    scanner: { calibrated: false, lockoutUntil: 0, runes: null, pressed: [] },
    radio: { freq: 300.0 },
    beacons: { stock: T.beaconStock, nextAt: 0, flying: [], splashes: [] },
    tags: [],           // order of tagging
    events: [],         // for audio/UI: {type, ...}
    notes: [],
  };
}

function emit(w, type, data = {}) { w.events.push({ type, t: w.t, ...data }); }

// ---------- commands (called by UI) ----------
export function light(w) {
  if (w.lit) return;
  w.lit = true; emit(w, 'ignite');
}

export function setPower(w, sys, on) {
  if (!w.lit) { emit(w, 'deny', { msg: 'THE FURNACE IS COLD' }); return false; }
  const p = w.power[sys];
  if (on === p.on) return true;
  if (on) {
    const used = SYSTEMS.filter(s => w.power[s].on).length;
    if (used >= T.powerSlots) { emit(w, 'deny', { msg: 'FURNACE AT CAPACITY · SWITCH SOMETHING OFF' }); return false; }
    p.on = true; p.ready = w.t + SPINUP[sys]; emit(w, 'power', { sys, on: true });
  } else {
    p.on = false; emit(w, 'power', { sys, on: false });
  }
  return true;
}
export const isUp = (w, sys) => w.power[sys].on && w.t >= w.power[sys].ready;

export function selectCam(w, id) { if (w.activeCam !== id) { w.activeCam = id; emit(w, 'camswitch'); } }

export function deployBuoy(w, x, y) {
  if (!isUp(w, 'sonar')) { emit(w, 'deny', { msg: 'SONAR IS UNPOWERED' }); return false; }
  if (w.t < w.buoyRebuildAt) { emit(w, 'deny', { msg: 'NO BUOY ON THE RACK YET' }); return false; }
  if (dist({ x, y }, OBSERVATORY) > T.buoyDeployRange) { emit(w, 'deny', { msg: 'OUT OF LAUNCHER RANGE' }); return false; }
  w.buoy = { x, y, landAt: w.t + 4 };
  emit(w, 'buoy', { x, y });
  return true;
}

export function ping(w) {
  if (!isUp(w, 'sonar')) { emit(w, 'deny', { msg: 'SONAR IS UNPOWERED' }); return false; }
  if (!w.buoy || w.t < w.buoy.landAt) { emit(w, 'deny', { msg: 'NO BUOY IN THE WATER' }); return false; }
  if (w.pings.some(p => p.deliverAt > w.t)) { emit(w, 'deny', { msg: 'STILL LISTENING FOR THE LAST ECHO' }); return false; }
  const at = { x: w.buoy.x, y: w.buoy.y };
  // sample the world now
  const found = [];
  for (const b of w.bergs) {
    if (dist(b, at) <= T.buoyRadius) {
      const a = w.rng() * Math.PI * 2, e = w.rng() * 5;
      found.push({ bergId: b.id, x: b.x + Math.cos(a) * e, y: b.y + Math.sin(a) * e, length: b.length, large: b.large });
    }
  }
  const sharkFound = dist(w.shark, at) <= T.buoyRadius ? { x: w.shark.x, y: w.shark.y } : null;
  w.pings.push({ tS: w.t, deliverAt: w.t + T.sonarDelay, at, found, sharkFound });
  // noise in this area
  let n = w.noise.find(z => dist(z, at) < T.sharkNoiseArea);
  if (!n) { n = { x: at.x, y: at.y, times: [] }; w.noise.push(n); }
  n.times.push(w.t);
  emit(w, 'ping');
  return true;
}

export function lockOn(w, bergId, x, y, t0, source) {
  w.lock = { bergId, x, y, t0, source };
  const b = w.bergs.find(b => b.id === bergId);
  emit(w, 'lock', { source });
  return b;
}
// Lock from a sonar contact
export function lockContact(w, c) { return lockOn(w, c.bergId, c.x, c.y, c.tS, 'sonar'); }
// Lock from a camera sighting: the camera estimates position from bearing and apparent size
export function lockFromCamera(w, bergId) {
  const b = w.bergs.find(b => b.id === bergId);
  const a = w.rng() * Math.PI * 2, e = 4 + w.rng() * 6;
  return lockOn(w, bergId, b.x + Math.cos(a) * e, b.y + Math.sin(a) * e, w.t, 'camera');
}

export function setDrift(w, mode) { w.drift = mode; emit(w, 'click'); }

// Predicted ("ghost") position of the locked target at time t, using only what the
// observatory has measured: the latest current reading and the drift selector.
export function modelVelocity(w) {
  const r = w.readings;
  if (!r) return { x: 0, y: 0 };
  if (w.drift === 'deep') return { x: r.deep.x, y: r.deep.y };
  return { x: r.surface.x + 0.03 * r.wind.x, y: r.surface.y + 0.03 * r.wind.y };
}
export function ghostAt(w, t) {
  if (!w.lock) return null;
  const v = modelVelocity(w);
  const dt = t - w.lock.t0;
  return { x: w.lock.x + v.x * dt, y: w.lock.y + v.y * dt };
}
export function lockedBerg(w) { return w.lock ? w.bergs.find(b => b.id === w.lock.bergId) : null; }
export function alignment(w, radius = T.alignRadius) {
  const b = lockedBerg(w); if (!b) return 0;
  const g = ghostAt(w, w.t);
  return clamp(1 - dist(g, b) / radius, 0, 1);
}

// Rune calibration
export function newRunes(w) {
  const ids = [];
  while (ids.length < 4) { const k = Math.floor(w.rng() * 16); if (!ids.includes(k)) ids.push(k); }
  w.scanner.runes = ids; w.scanner.pressed = [];
}
export function pressRune(w, idx, correctOrder) {
  const s = w.scanner;
  if (w.t < s.lockoutUntil || s.calibrated) return;
  const expected = correctOrder[s.pressed.length];
  if (idx === expected) {
    s.pressed.push(idx); emit(w, 'rune');
    if (s.pressed.length === 4) { s.calibrated = true; emit(w, 'calibrated'); }
  } else {
    s.lockoutUntil = w.t + 8; emit(w, 'runefail'); newRunes(w);
  }
}

export function setFreq(w, f) { w.radio.freq = clamp(f, 100, 999.9); }
export function radioSignal(w) {
  if (!isUp(w, 'radio')) return { strength: 0, song: null };
  const b = lockedBerg(w);
  if (!b || !b.radio) return { strength: 0, song: null };
  const a = alignment(w, T.radioAlignRadius);
  const s = a * Math.exp(-(((w.radio.freq - b.radio.freq) / T.radioWidth) ** 2));
  return { strength: s, song: s > 0.75 ? b.radio.song : null, band: bandOf(w.radio.freq) };
}

export function fireBeacon(w, color) {
  if (!w.lock) { emit(w, 'deny', { msg: 'NO TARGET LOCKED' }); return false; }
  if (w.beacons.stock <= 0) { emit(w, 'deny', { msg: 'BEACON RACK EMPTY' }); return false; }
  let aim = ghostAt(w, w.t);
  for (let i = 0; i < 4; i++) {
    const tf = dist(OBSERVATORY, aim) / T.beaconSpeed;
    aim = ghostAt(w, w.t + tf);
  }
  const tf = dist(OBSERVATORY, aim) / T.beaconSpeed;
  w.beacons.stock--;
  if (!w.beacons.nextAt || w.beacons.nextAt < w.t) w.beacons.nextAt = w.t + T.beaconRebuild;
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

// ---------- GM commands ----------
export function gm(w, cmd) {
  if (cmd === 'pause') w.paused = !w.paused;
  if (cmd === 'repair') { w.cams.forEach(c => { c.broken = false; c.repair = null; c.heat = 0; }); w.remorhazes = []; w.buoyRebuildAt = 0; }
  if (cmd === 'restock') w.beacons.stock = T.beaconStock;
  if (cmd === 'shark-home') { w.shark.mode = 'roam'; w.shark.x = 3700; w.shark.y = 2300; w.noise = []; }
  if (cmd === 'calibrate') w.scanner.calibrated = true;
  if (cmd === 'win') win(w);
}
function win(w) { if (!w.won) { w.won = true; w.wonAt = w.t; emit(w, 'win'); } }

// ---------- step ----------
export function step(w, dt) {
  if (w.paused || !w.lit) return;
  w.t += dt;
  const t = w.t;

  // move ice
  for (const b of w.bergs) {
    const v = driftOf(b.large, b.x, b.y, t);
    b.x += v.x * dt; b.y += v.y * dt;
    // keep inside the sea
    if (b.x < 150) b.x += 0.3 * dt; if (b.x > MAP_W - 150) b.x -= 0.3 * dt;
    if (b.y < 120) b.y += 0.3 * dt; if (b.y > 2300) b.y -= 0.4 * dt;
  }
  { const v = driftOf(true, w.tomb.x, w.tomb.y, t); w.tomb.x += v.x * dt; w.tomb.y += v.y * dt; }

  // sonar deliveries
  for (const p of w.pings) {
    if (!p.delivered && t >= p.deliverAt) {
      p.delivered = true;
      for (const f of p.found) w.contacts.push({ ...f, tS: p.tS, tD: t, id: 'k' + Math.floor(w.rng() * 1e9) });
      if (p.sharkFound) w.contacts.push({ shark: true, x: p.sharkFound.x, y: p.sharkFound.y, tS: p.tS, tD: t, id: 's' + p.tS });
      emit(w, 'echo', { n: p.found.length });
    }
  }
  w.pings = w.pings.filter(p => !p.delivered || t - p.deliverAt < 1);
  w.contacts = w.contacts.filter(c => t - c.tD < T.contactFade);

  // current readings
  if (isUp(w, 'currents') && w.buoy && t >= w.buoy.landAt && t - w.readingAt >= T.currentRefresh) {
    const n = () => 1 + (w.rng() - 0.5) * 0.08;
    const s = surfaceAt(w.buoy.x, w.buoy.y), d = deepAt(w.buoy.x, w.buoy.y), wi = windAt(t);
    w.readings = {
      t, x: w.buoy.x, y: w.buoy.y,
      surface: { x: s.x * n(), y: s.y * n() }, deep: { x: d.x * n(), y: d.y * n() },
      wind: { x: wi.x * n(), y: wi.y * n() }, windFrom: wi.from, windSpeed: wi.speed,
    };
    w.readingAt = t; emit(w, 'reading');
  }

  // scanner
  const lb = lockedBerg(w);
  if (isUp(w, 'scanner') && lb && w.scanner.calibrated && !lb.scanned) {
    if (alignment(w) > 0.55) {
      lb.scan += dt / T.scanTime;
      if (lb.scan >= 1) { lb.scan = 1; lb.scanned = true; emit(w, 'scandone', { metal: lb.metal }); }
    }
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
    const c = w.cams.find(c => c.id === r.cam);
    const d = dist(r, c);
    c.tremor = clamp(1 - d / T.remorhazSpawnDist, 0, 1);
    if (c.heat < T.remorhazGiveUp && d > 20) { r.gone = true; emit(w, 'burrow', { cam: c.id }); continue; }
    if (d < 6) { r.gone = true; c.broken = true; c.heat = 0; c.tremor = 0; emit(w, 'camdead', { cam: c.id }); continue; }
    r.x += (c.x - r.x) / d * T.remorhazSpeed * dt; r.y += (c.y - r.y) / d * T.remorhazSpeed * dt;
  }
  for (const c of w.cams) if (!w.remorhazes.some(r => r.cam === c.id && !r.gone)) c.tremor = 0;
  w.remorhazes = w.remorhazes.filter(r => !r.gone);

  // shark
  for (const n of w.noise) n.times = n.times.filter(pt => t - pt < T.sharkWindow);
  w.noise = w.noise.filter(n => n.times.length > 0);
  const sh = w.shark;
  const loud = w.noise.filter(n => n.times.length >= T.sharkTrigger)[0];
  if (loud && w.buoy && dist(loud, w.buoy) < T.sharkNoiseArea) {
    if (sh.mode !== 'hunt') emit(w, 'sharkhunt');
    sh.mode = 'hunt'; sh.target = { x: w.buoy.x, y: w.buoy.y };
  } else if (sh.mode === 'hunt' && (!w.buoy || dist(sh.target, w.buoy) > 1)) { sh.mode = 'roam'; }
  if (sh.mode === 'hunt') {
    const d = dist(sh, sh.target);
    sh.heading = Math.atan2(sh.target.x - sh.x, -(sh.target.y - sh.y));
    if (d > 1) { sh.x += (sh.target.x - sh.x) / d * Math.min(d, T.sharkSpeed * dt); sh.y += (sh.target.y - sh.y) / d * Math.min(d, T.sharkSpeed * dt); }
    if (w.buoy && dist(sh, w.buoy) < T.sharkKillDist) {
      w.buoy = null; w.buoyRebuildAt = t + T.buoyRebuild; sh.mode = 'roam';
      w.noise = w.noise.filter(n => dist(n, sh) > T.sharkNoiseArea);
      emit(w, 'buoydead');
    }
  } else {
    sh.heading += (Math.sin(t / 23) * 0.4) * dt * 0.2;
    sh.x += Math.sin(sh.heading) * T.sharkRoamSpeed * dt; sh.y -= Math.cos(sh.heading) * T.sharkRoamSpeed * dt;
    if (sh.x < 300 || sh.x > MAP_W - 300 || sh.y < 200 || sh.y > 2300) sh.heading += Math.PI * dt * 0.5;
  }

  // beacons
  const bc = w.beacons;
  if (bc.stock < T.beaconStock && bc.nextAt && t >= bc.nextAt) { bc.stock++; bc.nextAt = bc.stock < T.beaconStock ? t + T.beaconRebuild : 0; }
  for (const f of bc.flying) {
    if (t >= f.t1 && !f.done) {
      f.done = true;
      let best = null, bd = 1e9;
      for (const b of w.bergs) {
        const d = hyp(b.x - f.x1, b.y - f.y1);
        const hitR = b.large ? 8 + b.length * 0.6 : 7;
        if (d < hitR && d < bd) { bd = d; best = b; }
      }
      if (best) {
        best.tag = f.color; if (!w.tags.includes(best.id)) w.tags.push(best.id);
        emit(w, 'hit', { berg: best.id, num: best.num });
        if (best.elgarz) win(w);
      } else {
        bc.splashes.push({ x: f.x1, y: f.y1, t });
        emit(w, 'miss');
      }
    }
  }
  bc.flying = bc.flying.filter(f => !f.done);
  bc.splashes = bc.splashes.filter(s => t - s.t < 40);
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
  return {
    t: w.t, won: w.won, paused: w.paused,
    bergs: w.bergs.map(b => ({ id: b.id, num: b.num, name: b.name, x: b.x, y: b.y, large: b.large, hollow: b.hollow, metal: b.metal, radio: b.radio, elgarz: b.elgarz, tag: b.tag })),
    tomb: w.tomb, shark: { x: w.shark.x, y: w.shark.y, mode: w.shark.mode }, buoy: w.buoy,
    cams: w.cams.map(c => ({ id: c.id, name: c.name, x: c.x, y: c.y, heat: c.heat, broken: c.broken })),
    remorhazes: w.remorhazes.map(r => ({ x: r.x, y: r.y, cam: r.cam })),
    lock: w.lock, ghost: ghostAt(w, w.t), power: Object.fromEntries(SYSTEMS.map(s => [s, w.power[s].on])),
    beacons: w.beacons.stock, calibrated: w.scanner.calibrated,
  };
}
