// Headless scenario checks across many seeds. Run: node tools/check.mjs [seedCount]
import {
  createWorld, step, light, stoke, dist, snapshot, setPower, deployBuoy, ping, lockContact, setDrift, fireBeacon,
  countSightings, camSees, snowAt, slotsAvailable, pressKey, readingDisplay, radioSignal, setFreq, setGain, gainFor, setMusic, lockOn, DT,
} from '../src/sim.js';
import { OBSERVATORY, CENTER, REACH, TUNING as T, TOMB_RADIUS, CAMERAS, CELL, RADIO_TABLE } from '../src/scenario.js';
import { keypadCode, RUNES } from '../src/glyphs.js';

const SEEDS = Array.from({ length: Number(process.argv[2]) || 40 }, (_, i) => 1000 + i * 37);
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };
const pct = (a, b) => (100 * a / b).toFixed(0) + '%';
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const keepFurnace = w => { if (w.furnace.heat < 50) stoke(w); };   // a diligent stoker

function run(seed, seconds, each) {
  const w = createWorld(seed); light(w);
  for (let i = 0; i < seconds / DT; i++) { if (i % 50 === 0) keepFurnace(w); step(w, DT); if (each) each(w, i); }
  return w;
}

// ---------- world-level properties per seed ----------
const stats = { spawnT: [], sightings: [], firstSight: [], minTomb: [], tombMove: [], medianPath: [], ruledOut: [], outOfReach: [], transmit: [], stormHits: [] };
let elgarzLeft = 0, triadOthers = 0;
for (const seed of SEEDS) {
  const w0 = createWorld(seed);
  stats.transmit.push([...w0.bergs, ...w0.reserve].filter(b => b.radio).length / (w0.bergs.length + w0.reserve.length));
  triadOthers += [...w0.bergs, ...w0.reserve].filter(b => !b.elgarz && b.radio && b.radio.decoded === 'BRW' && b.radio.band === 'MID').length;
  const track = [], tomb0 = { ...w0.tomb };
  const start = {}, path = {}, prev = {}, entered = new Set();
  let spawnT = null;
  const w = run(seed, 1200, (w, i) => {
    const e = w.bergs.find(b => b.elgarz);
    if (e && spawnT == null) spawnT = w.t;
    if (i % 10 === 0) {
      if (e) track.push({ t: w.t, x: e.x, y: e.y, tomb: dist(e, w.tomb) });
      for (const b of w.bergs) {
        if (prev[b.id]) path[b.id] = (path[b.id] || 0) + dist(b, prev[b.id]);
        prev[b.id] = { x: b.x, y: b.y };
        if (!b.elgarz && dist(b, w.tomb) < TOMB_RADIUS) entered.add(b.id);
      }
    }
  });
  stats.spawnT.push(spawnT);
  const s = countSightings(track);
  stats.sightings.push(s.n); stats.firstSight.push(s.first ?? 9999);
  stats.minTomb.push(Math.min(...track.map(p => p.tomb)));
  if (track.some(p => dist(p, CENTER) > REACH)) elgarzLeft++;
  stats.tombMove.push(dist(tomb0, w.tomb));
  const paths = Object.values(path).sort((a, b) => a - b);
  stats.medianPath.push(paths[Math.floor(paths.length / 2)]);
  stats.ruledOut.push(entered.size);
  stats.outOfReach.push(w.bergs.filter(b => dist(b, CENTER) > REACH).length);
  stats.stormHits.push(w.storms.filter(st => { for (let t = st.t0; t < st.t1; t += 5) if (snowAt(w, CAMERAS.find(c => c.id === st.cam).x, CAMERAS.find(c => c.id === st.cam).y, t) > 0.5) return true; return false; }).length);
}
const lo = a => Math.min(...a).toFixed(0), hi = a => Math.max(...a).toFixed(0), av = a => mean(a).toFixed(1);
console.log(`Seeds: ${SEEDS.length}`);
console.log(`Elgarz sightings per session: min ${lo(stats.sightings)} avg ${av(stats.sightings)} max ${hi(stats.sightings)}; first sighting ${lo(stats.firstSight)}-${hi(stats.firstSight)}s`);
console.log(`Elgarz closest to the Tomb: ${lo(stats.minTomb)} mi (ring ${TOMB_RADIUS})`);
console.log(`Tomb drift in 20 min: ${lo(stats.tombMove)}-${hi(stats.tombMove)} mi (${(mean(stats.tombMove) / CELL).toFixed(1)} squares avg)`);
console.log(`Median iceberg travel in 20 min: ${lo(stats.medianPath)}-${hi(stats.medianPath)} mi (${(mean(stats.medianPath) / CELL).toFixed(1)} squares avg)`);
console.log(`Bergs that enter the Tomb ring: ${lo(stats.ruledOut)}-${hi(stats.ruledOut)} (avg ${av(stats.ruledOut)})`);
console.log(`Share of ice that transmits: ${pct(Math.min(...stats.transmit), 1)} minimum`);
check(stats.spawnT.every(t => t != null && Math.abs(t - T.elgarzSpawnAt) < 1), 'Elgarz joins the sea at 3:00 in every seed');
check(stats.sightings.every(n => n >= 2), 'Elgarz passes through camera view at least twice in every seed');
check(elgarzLeft === 0, 'Elgarz never leaves reach');
check(stats.minTomb.every(d => d >= TOMB_RADIUS), 'Elgarz never enters the Tomb ring');
check(mean(stats.medianPath) >= 3 * CELL, 'Typical ice crosses at least 3 chart squares in 20 minutes');
check(Math.min(...stats.tombMove) >= CELL, 'The Tomb visibly drifts (at least one square)');
check(mean(stats.ruledOut) >= 3, 'Some ice wanders into the Tomb ring and can be ruled out');
check(stats.outOfReach.every(n => n <= 2), 'Ice stays inside reach (at most 2 strays per seed)');
check(stats.transmit.every(x => x >= 1 / 3), 'At least a third of the ice transmits');
check(triadOthers === 0, 'Only Elgarz decodes to the Triad');
check(stats.stormHits.every(n => n === 3), 'Every storm whites out the camera it is aimed at');

// ---------- determinism ----------
const a = run(4321, 300), b = run(4321, 300);
check(JSON.stringify(snapshot(a)) === JSON.stringify(snapshot(b)), 'Same seed gives the same world');

// ---------- furnace ----------
{
  const w = createWorld(1); light(w);
  for (let i = 0; i < 600; i++) step(w, DT);
  check(slotsAvailable(w) === 3, 'A fresh furnace runs three systems for the first minute');
  for (let i = 0; i < 1500; i++) step(w, DT);
  check(slotsAvailable(w) < 3, 'Left alone for over 2 minutes, the furnace loses power slots');
  const w2 = createWorld(1); light(w2); stoke(w2); stoke(w2); for (let i = 0; i < 50; i++) step(w2, DT);
  check(w2.furnace.lit === false && w2.t < w2.furnace.outUntil, 'Overfeeding the furnace blows it out');
  for (let i = 0; i < 80; i++) step(w2, DT);
  check(light(w2), 'A blown furnace can be relit after the cooldown');
}

// ---------- the Grindmaw ----------
function sharkSetup(seed) {
  const w = createWorld(seed); light(w); setPower(w, 'sonar', true);
  for (let i = 0; i < 20; i++) step(w, DT);
  w.shark.x = CENTER.x + 900; w.shark.y = CENTER.y; w.lastPing = null;
  deployBuoy(w, CENTER.x - 600, CENTER.y); for (let i = 0; i < 50; i++) step(w, DT);
  return w;
}
{
  const w = sharkSetup(5); const d0 = dist(w.shark, w.buoy);
  ping(w); for (let i = 0; i < 300; i++) { step(w, DT); if (i % 50 === 0) keepFurnace(w); }
  check(dist(w.shark, w.buoy) < d0 - 60, 'After a ping the Grindmaw swims toward it');
  for (let i = 0; i < 6000 && w.buoy; i++) { step(w, DT); if (i % 50 === 0) keepFurnace(w); }
  check(!w.buoy, 'A buoy left at the ping is eventually eaten');
  const w2 = sharkSetup(5); ping(w2);
  for (let i = 0; i < 2000; i++) { step(w2, DT); if (i % 50 === 0) keepFurnace(w2); }
  deployBuoy(w2, CENTER.x, CENTER.y + 1200);
  for (let i = 0; i < 3000; i++) { step(w2, DT); if (i % 50 === 0) keepFurnace(w2); }
  check(!!w2.buoy, 'A buoy moved away before the Grindmaw arrives survives');
}

// ---------- scanner keypad ----------
{
  let ok = 0, guesses = 0;
  for (const seed of SEEDS) {
    const w = createWorld(seed); light(w); ['sonar', 'currents', 'scanner'].forEach(s => setPower(w, s, true));
    for (let i = 0; i < 20; i++) step(w, DT);
    deployBuoy(w, CENTER.x + 400, CENTER.y - 300); for (let i = 0; i < 100; i++) step(w, DT);
    const code = keypadCode(w.scanner.plate, readingDisplay(w.readings));
    check.quiet = true;
    for (const rid of code) pressKey(w, w.scanner.plate.indexOf(rid));
    if (w.scanner.calibrated) ok++;
    const naive = [0, 1, 2, 3].map(i => w.scanner.plate[i]);
    if (naive.join() === code.join()) guesses++;
  }
  check(ok === SEEDS.length, 'Following the manual calibrates the scanner in every seed');
  check(guesses === 0, 'Pressing the first four keys left to right never works');
  const houses = createWorld(9).scanner.plate.map(i => RUNES[i].house);
  check(['Ice', 'Iron', 'Ember', 'Bone'].every(h => houses.filter(x => x === h).length >= 2), 'Every plate has at least two runes of every house');
}

// ---------- radio ----------
{
  const w = createWorld(77); light(w); ['radio', 'currents', 'sonar'].forEach(s => setPower(w, s, true));
  for (let i = 0; i < 30; i++) step(w, DT);
  const b = w.bergs.find(b => b.radio && b.notable);
  lockOn(w, b.id, b.x, b.y, w.t, 'camera');
  setFreq(w, b.radio.freq); setGain(w, gainFor(dist(b, OBSERVATORY)));
  let sig = radioSignal(w);
  check(sig.lamps === b.radio.shown, 'Tuned and gained correctly, the lamps show the signal');
  setFreq(w, b.radio.freq + 12); sig = radioSignal(w);
  check(sig.strength > 0.75, 'The tuning window is forgiving (12 units off still reads)');
  setFreq(w, b.radio.freq); setGain(w, 10); sig = radioSignal(w);
  check(!sig.lamps, 'Too much gain clips the signal and the lamps go dark');
  setMusic(w, true); const st = w.stations[0]; setFreq(w, st.freq); setGain(w, T.stationGain); sig = radioSignal(w);
  check(sig.kind === 'station' && sig.lamps === st.shown, 'With music on, the cabin wireless stations can be tuned');
  check(!!RADIO_TABLE.BRW.MID.includes('TRIAD'), 'The Triad entry exists');
}

// ---------- shots ----------
function shot(seed, { drift, readNear, delay, color = 'green' }) {
  const w = createWorld(seed); light(w);
  for (let i = 0; i < 3000; i++) { if (i % 50 === 0) keepFurnace(w); step(w, DT); }     // 5:00
  ['sonar', 'currents'].forEach(s => setPower(w, s, true));
  for (let i = 0; i < 30; i++) step(w, DT);
  const e = w.bergs.find(b => b.elgarz);
  const dd = dist(e, OBSERVATORY), k = readNear ? Math.min(1, (T.buoyDeployRange - 10) / dd) : 0.25;
  const bx = OBSERVATORY.x + (e.x - OBSERVATORY.x) * k, by = OBSERVATORY.y + (e.y - OBSERVATORY.y) * k;
  deployBuoy(w, readNear ? bx + 40 : bx, readNear ? by + 40 : by);
  for (let i = 0; i < 100; i++) step(w, DT);
  if (!readNear) { const near = { x: OBSERVATORY.x + (e.x - OBSERVATORY.x) * Math.min(1, 1600 / dd), y: OBSERVATORY.y + (e.y - OBSERVATORY.y) * Math.min(1, 1600 / dd) }; deployBuoy(w, near.x, near.y); for (let i = 0; i < 50; i++) step(w, DT); ping(w); for (let i = 0; i < 60; i++) step(w, DT); const c = w.contacts.find(c => c.bergId === 'elgarz'); if (!c) return 'no contact'; lockContact(w, c); setDrift(w, drift); deployBuoy(w, bx, by); for (let i = 0; i < 50; i++) step(w, DT); }
  else { ping(w); for (let i = 0; i < 60; i++) step(w, DT); const c = w.contacts.find(c => c.bergId === 'elgarz'); if (!c) return 'no contact'; lockContact(w, c); setDrift(w, drift); }
  for (let i = 0; i < delay * 10; i++) step(w, DT);
  fireBeacon(w, color);
  for (let i = 0; i < 400; i++) { if (i % 50 === 0) keepFurnace(w); step(w, DT); }
  return w.won ? 'win' : e.tag ? 'tag' : 'miss';
}
const good = SEEDS.slice(0, 20).map(s => shot(s, { drift: 'deep', readNear: true, delay: 8 }));
const wrongDrift = SEEDS.slice(0, 20).map(s => shot(s, { drift: 'surface', readNear: true, delay: 8 }));
const farRead = SEEDS.slice(0, 20).map(s => shot(s, { drift: 'deep', readNear: false, delay: 8 }));
const amber = SEEDS.slice(0, 5).map(s => shot(s, { drift: 'deep', readNear: true, delay: 8, color: 'amber' }));
console.log(`Careful green shots: ${good.filter(r => r === 'win').length}/20 win · wrong drift: ${wrongDrift.filter(r => r === 'win').length}/20 · reading far from target: ${farRead.filter(r => r === 'win').length}/20`);
check(good.filter(r => r === 'win').length >= 18, 'A fresh lock + right drift + nearby reading hits Elgarz (18 of 20 seeds)');
check(wrongDrift.filter(r => r === 'win').length <= 2, 'The wrong drift setting misses');
check(farRead.filter(r => r === 'win').length <= 10, 'A reading taken far from the target usually misses');
check(amber.every(r => r !== 'win'), 'Only a green beacon wins');

process.exit(failures ? 1 : 0);
