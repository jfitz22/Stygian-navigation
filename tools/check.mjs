// Headless scenario checks across many seeds. Run: node tools/check.mjs [seedCount]
import {
  createWorld, step, light, stoke, dist, snapshot, setPower, deployBuoy, ping, lockContact, setDrift, fireBeacon,
  countSightings, camSees, snowAt, slotsAvailable, pressKey, readingDisplay, radioSignal, setFreq, setGain, gainFor, setMusic, lockOn, DT,
  pressBoard, runeFunction, lockFromCamera, aimQuality, startRepair, sip, camCode, setLever, pressPlate, setCamTurn, camIsUnlocked, selectCam, gm,
  relockCase, setVerdict, isUp,
} from '../src/sim.js';
import { OBSERVATORY, CENTER, REACH, TUNING as T, TOMB_RADIUS, CAMERAS, CELL, RADIO_TABLE, BOARD_GRID } from '../src/scenario.js';
import { keypadCode, RUNES } from '../src/glyphs.js';

const SEEDS = Array.from({ length: Number(process.argv[2]) || 40 }, (_, i) => 1000 + i * 37);
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };
const pct = (a, b) => (100 * a / b).toFixed(0) + '%';
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const keepFurnace = w => { if (w.furnace.heat < 50) { if (!w.furnace.chute) w.furnace.chute = T.chuteMax; stoke(w); } };   // a diligent stoker with a full chute

function run(seed, seconds, each) {
  const w = createWorld(seed); light(w);
  for (let i = 0; i < seconds / DT; i++) { if (i % 50 === 0) keepFurnace(w); step(w, DT); if (each) each(w, i); }
  return w;
}

// ---------- world-level properties per seed ----------
const stats = { spawnT: [], sightings: [], firstSight: [], minTomb: [], tombMove: [], medianPath: [], ruledOut: [], outOfReach: [], transmit: [], stormHits: [] };
let triadNoMetal = 0, triadNotHollow = 0;
let elgarzLeft = 0, triadOthers = 0, fullMatch = 0, hulkInRing = 0, oneSign = [], hollowShare = [];
for (const seed of SEEDS) {
  const w0 = createWorld(seed);
  stats.transmit.push([...w0.bergs, ...w0.reserve].filter(b => b.radio).length / (w0.bergs.length + w0.reserve.length));
  const ice0 = [...w0.bergs, ...w0.reserve], triad = b => b.radio && b.radio.decoded === 'BRW' && b.radio.band === 'MID';
  triadOthers += ice0.filter(b => !b.elgarz && triad(b)).length;
  fullMatch += ice0.filter(b => !b.elgarz && !b.tombDrawn && b.hollow && b.metal && triad(b)).length;
  oneSign.push(ice0.filter(b => !b.elgarz && (b.metal || triad(b))).length);
  if (ice0.some(b => triad(b) && !b.metal)) triadNoMetal++;
  if (ice0.some(b => triad(b) && !b.hollow)) triadNotHollow++;
  hollowShare.push(ice0.filter(b => b.hollow).length / ice0.length);
  const track = [], tomb0 = { ...w0.tomb };
  const start = {}, path = {}, prev = {}, entered = new Set();
  let spawnT = null, tombPath = 0, tombPrev = null, hulkMax = 0;
  const w = run(seed, 1200, (w, i) => {
    const e = w.bergs.find(b => b.elgarz);
    if (e && spawnT == null) spawnT = w.t;
    if (i % 10 === 0) {
      if (e) track.push({ t: w.t, x: e.x, y: e.y, tomb: dist(e, w.tomb) });
      if (tombPrev) tombPath += dist(w.tomb, tombPrev); tombPrev = { x: w.tomb.x, y: w.tomb.y };
      for (const b of w.bergs) {
        if (prev[b.id]) path[b.id] = (path[b.id] || 0) + dist(b, prev[b.id]);
        prev[b.id] = { x: b.x, y: b.y };
        if (!b.elgarz && dist(b, w.tomb) < TOMB_RADIUS) entered.add(b.id);
        if (b.tombDrawn) hulkMax = Math.max(hulkMax, dist(b, w.tomb));
      }
    }
  });
  stats.spawnT.push(spawnT);
  const s = countSightings(track);
  stats.sightings.push(s.n); stats.firstSight.push(s.first ?? 9999);
  stats.minTomb.push(Math.min(...track.map(p => p.tomb)));
  if (track.some(p => dist(p, CENTER) > REACH)) elgarzLeft++;
  stats.tombMove.push(tombPath);
  const paths = Object.values(path).sort((a, b) => a - b);
  stats.medianPath.push(paths[Math.floor(paths.length / 2)]);
  if (hulkMax < TOMB_RADIUS) hulkInRing++;
  stats.ruledOut.push(entered.size);
  stats.outOfReach.push(w.bergs.filter(b => dist(b, CENTER) > REACH).length);
  { const early = w.storms.filter(st => st.t1 < 1200); const hit = early.filter(st => { for (let t = st.t0; t < st.t1; t += 5) if (snowAt(w, CAMERAS.find(c => c.id === st.cam).x, CAMERAS.find(c => c.id === st.cam).y, t) > 0.5) return true; return false; }).length; stats.stormHits.push(hit === early.length ? hit : -1); }
}
const lo = a => Math.min(...a).toFixed(0), hi = a => Math.max(...a).toFixed(0), av = a => mean(a).toFixed(1);
console.log(`Seeds: ${SEEDS.length}`);
console.log(`Elgarz sightings per session: min ${lo(stats.sightings)} avg ${av(stats.sightings)} max ${hi(stats.sightings)}; first sighting ${lo(stats.firstSight)}-${hi(stats.firstSight)}s`);
console.log(`Elgarz closest to the Tomb: ${lo(stats.minTomb)} mi (ring ${TOMB_RADIUS})`);
console.log(`Tomb travel in 20 min: ${lo(stats.tombMove)}-${hi(stats.tombMove)} mi (${(mean(stats.tombMove) / CELL).toFixed(1)} squares avg)`);
console.log(`Median iceberg travel in 20 min: ${lo(stats.medianPath)}-${hi(stats.medianPath)} mi (${(mean(stats.medianPath) / CELL).toFixed(1)} squares avg)`);
console.log(`Bergs that enter the Tomb ring: ${lo(stats.ruledOut)}-${hi(stats.ruledOut)} (avg ${av(stats.ruledOut)})`);
console.log(`Share of ice that transmits: ${pct(Math.min(...stats.transmit), 1)} minimum`);
check(stats.spawnT.every(t => t != null && Math.abs(t - T.elgarzSpawnAt) < 1), 'Elgarz joins the sea at 3:00 in every seed');
check(stats.sightings.every(n => n >= 2), 'Elgarz passes through camera view at least twice in every seed');
check(elgarzLeft === 0, 'Elgarz never leaves reach');
check(stats.minTomb.every(d => d >= TOMB_RADIUS), 'Elgarz never enters the Tomb ring');
check(mean(stats.medianPath) >= 4.5 * CELL, 'Typical ice crosses at least 4.5 chart squares in 20 minutes');
check(mean(stats.tombMove) >= 3.5 * CELL && Math.min(...stats.tombMove) >= 1.2 * CELL, 'The Tomb drifts several squares');
check(mean(stats.ruledOut) >= 3, 'Some ice wanders into the Tomb ring and can be ruled out');
check(stats.outOfReach.every(n => n <= 2), 'Ice stays inside reach (at most 2 strays per seed)');
check(stats.transmit.every(x => x >= 1 / 3), 'At least a third of the ice transmits');
console.log(`Decoys singing the Triad: ${(triadOthers / SEEDS.length).toFixed(1)} per seed · ice with metal or the Triad: ${lo(oneSign)}-${hi(oneSign)}`);
check(triadOthers / SEEDS.length >= 3, 'Several decoys also sing the Triad, so the radio alone proves nothing');
check(fullMatch === 0, 'No decoy except the Gilded Hulk is hollow, metal and Triad');
check(hulkInRing === SEEDS.length, `The Gilded Hulk stays inside the Tomb ring all watch (${hulkInRing}/${SEEDS.length} seeds)`);
check(triadNoMetal === SEEDS.length && triadNotHollow === SEEDS.length, 'Every seed has Triad ice without metal and Triad ice that is not hollow');
check(Math.min(...oneSign) >= 12, 'Plenty of ice shows metal or the Triad, not just the echo');
console.log(`Share of ice that rings hollow: ${pct(Math.min(...hollowShare), 1)}-${pct(Math.max(...hollowShare), 1)}`);
check(mean(hollowShare) > 0.28 && mean(hollowShare) < 0.4, 'About a third of all ice rings hollow');
check(stats.stormHits.every(n => n >= 5), 'At least five storms in twenty minutes, each whiting out the orb it is aimed at');

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
  const w3 = createWorld(1); light(w3); w3.furnace.chute = 0;
  check(!stoke(w3), 'Stoking needs fuel in the chute');
  const w2 = createWorld(1); light(w2); stoke(w2); stoke(w2); for (let i = 0; i < 50; i++) step(w2, DT);
  check(w2.furnace.lit === false && w2.t < w2.furnace.outUntil, 'Overfeeding the furnace blows it out');
  for (let i = 0; i < 80; i++) step(w2, DT);
  check(!light(w2), 'A blown furnace cracks its grate and cannot be relit');
  startRepair(w2, 'furnace'); for (let i = 0; i < 100; i++) step(w2, DT);
  check(light(w2), 'After the grate is repaired the furnace relights');
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
  check(!w.buoy && w.broken.winch, 'A buoy left at the ping is eaten and the winch breaks');
  const w2 = sharkSetup(5); ping(w2);
  for (let i = 0; i < 2000; i++) { step(w2, DT); if (i % 50 === 0) keepFurnace(w2); }
  deployBuoy(w2, CENTER.x, CENTER.y + 1200);
  for (let i = 0; i < 3000; i++) { step(w2, DT); if (i % 50 === 0) keepFurnace(w2); }
  check(!!w2.buoy, 'A buoy moved away before the Grindmaw arrives survives');
  const r0 = dist(w2.shark, CENTER), p0 = { x: w2.shark.x, y: w2.shark.y };
  for (let i = 0; i < 600; i++) { step(w2, DT); if (i % 50 === 0) keepFurnace(w2); }
  check(w2.shark.mode === 'patrol' && Math.abs(dist(w2.shark, CENTER) - r0) < 5 && dist(w2.shark, p0) > 100, 'With no buoy at the ping, the Grindmaw circles the Watch at that distance');
  // camera posts disagree about the wind
  let distinct = 0;
  for (const seed of SEEDS.slice(0, 20)) {
    const wc = createWorld(seed); light(wc); for (let i = 0; i < 3000; i++) { keepFurnace(wc); step(wc, DT); }
    const codes = new Set(wc.cams.map(c => { selectCam(wc, c.id); const k = camCode(wc); return k.wind + k.temp; }));
    distinct += codes.size;
  }
  console.log(`Different lever settings across the 7 cameras: ${(distinct / 20).toFixed(1)} on average`);
  check(distinct / 20 >= 3, 'Cameras usually need different lever settings');
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

// ---------- rune board ----------
{
  let ok = true;
  for (const seed of SEEDS) {
    const w = createWorld(seed);
    for (let k = 0; k < 6; k++) {
      const fns = w.board.runes.map(r => runeFunction(r, w.board.page));
      if (!['FUEL', 'COFFEE', 'WIPERS'].every(f => fns.includes(f))) ok = false;
      for (let p = 0; p < 4; p++) pressBoard(w, p);
    }
  }
  check(ok, 'Every rune board page has fuel, coffee and wipers');
  const w = createWorld(3); light(w); const f0 = w.furnace.chute;
  pressBoard(w, w.board.runes.findIndex(r => runeFunction(r, w.board.page) === 'FUEL'));
  check(w.furnace.chute === f0 + 1, 'The FUEL rune fills the chute');
  // camera control: levers + plates unlock the camera on screen; then it turns freely
  const w4 = createWorld(3); light(w4); for (let i = 0; i < 10; i++) step(w4, DT);
  const c0 = w4.cams[0].facing;
  setCamTurn(w4, 1); for (let i = 0; i < 20; i++) step(w4, DT); setCamTurn(w4, 0);
  check(w4.cams[0].facing === c0, 'A locked camera does not turn');
  const code = camCode(w4); setLever(w4, 'wind', code.wind); setLever(w4, 'temp', code.temp);
  pressPlate(w4, code.order[1]); pressPlate(w4, code.order[0]); pressPlate(w4, code.order[2]);
  check(!camIsUnlocked(w4, 'c1'), 'The wrong plate order does not unlock');
  for (let i = 0; i < (T.plateLockout + 1) * 10; i++) step(w4, DT);
  code.order.forEach(sh => pressPlate(w4, sh));
  check(camIsUnlocked(w4, 'c1'), 'The right levers and plate order unlock the camera');
  const h0 = w4.furnace.heat;
  setCamTurn(w4, 1); for (let i = 0; i < 20; i++) step(w4, DT); setCamTurn(w4, 0);
  check(Math.abs(((w4.cams[0].facing - c0 + 360) % 360) - 2 * T.camTurnRate) < 1 && h0 - w4.furnace.heat < 1, 'An unlocked camera turns smoothly and costs no heat');
  for (let i = 0; i < 3000; i++) { keepFurnace(w4); step(w4, DT); }
  check(camIsUnlocked(w4, 'c1'), 'An unlocked camera stays unlocked');
  w4.cams[0].heat = 100; selectCam(w4, 'c1'); setPower(w4, 'cameras', true); w4.levers.remorhaz = 1;
  for (let i = 0; i < 1500 && !w4.cams[0].broken; i++) { keepFurnace(w4); w4.cams[0].heat = 100; step(w4, DT); }
  check(w4.cams[0].broken && !camIsUnlocked(w4, 'c1'), 'A destroyed camera loses its unlock');
  const w7 = createWorld(3); light(w7); gm(w7, 'pause'); const tp = w7.t; step(w7, DT);
  check(w7.paused && w7.t === tp, 'Pausing stops the watch'); gm(w7, 'pause'); step(w7, DT);
  check(!w7.paused && w7.t > tp, 'Resuming starts it again');
  const w5 = createWorld(3); light(w5); w5.board.nextFlip = 1e9; const pg = w5.board.page;
  for (let i = 0; i < T.boardFlipPresses; i++) pressBoard(w5, w5.board.runes.findIndex(r => runeFunction(r, w5.board.page) === 'NOTHING') >= 0 ? w5.board.runes.findIndex(r => runeFunction(r, w5.board.page) === 'NOTHING') : 0);
  check(w5.board.flippedAt === w5.t, 'The board flips after a few presses');
  const w6 = createWorld(3); light(w6); w6.fatigue = 0.9; w6.coffee.sips = 1; sip(w6);
  check(w6.fatigue < 0.5, 'A sip of coffee clears fatigue');
}

// ---------- the weather detunes the scanner ----------
{
  const detunes = [];
  for (const seed of SEEDS.slice(0, 15)) {
    const w = createWorld(seed); light(w); ['sonar', 'currents', 'scanner'].forEach(s => setPower(w, s, true));
    for (let i = 0; i < 20; i++) step(w, DT);
    deployBuoy(w, CENTER.x + 500, CENTER.y - 400);
    let n = 0;
    for (let i = 0; i < 11800; i++) {
      if (i % 50 === 0) keepFurnace(w);
      if (!w.scanner.calibrated && w.readings && i % 300 === 0) w.scanner.calibrated = true, w.scanner.calCode = null;
      const was = w.scanner.calibrated; step(w, DT); if (was && !w.scanner.calibrated) n++;
    }
    detunes.push(n);
  }
  console.log(`Scanner detunes per watch with the buoy left in one place: ${detunes.join(' ')}`);
  check(mean(detunes) >= 2 && mean(detunes) <= 6 && Math.min(...detunes) >= 1, 'Changing weather detunes the scanner a few times a watch, not constantly');
}

// ---------- breakdowns ----------
{
  const w = createWorld(8); light(w); setPower(w, 'radio', true); for (let i = 0; i < 30; i++) step(w, DT);
  const b = w.bergs.find(b => b.radio); lockOn(w, b.id, b.x, b.y, w.t, 'camera');
  setFreq(w, b.radio.freq); setGain(w, 10);
  for (let i = 0; i < (T.fuseClip + 1) * 10; i++) { lockOn(w, b.id, b.x, b.y, w.t, 'camera'); step(w, DT); }
  check(w.broken.fuse, 'Clipping too long blows the radio fuse');
  const w2 = createWorld(8); light(w2); for (let i = 0; i < 30; i++) step(w2, DT);
  const g = w2.bergs[0]; let shots = 0;
  while (!w2.broken.launcher && shots < 20) { lockOn(w2, g.id, g.x, g.y, w2.t, 'camera'); fireBeacon(w2, 'red'); shots++; }
  check(w2.broken.launcher && shots >= T.jamEvery[0] && shots <= T.jamEvery[1], `The launcher jams every few shots (${shots})`);
  startRepair(w2, 'launcher'); for (let i = 0; i < 100; i++) step(w2, DT);
  check(!w2.broken.launcher, 'A repaired launcher fires again');
}

// ---------- aim quality ----------
{
  const w = createWorld(12); light(w); ['sonar', 'currents'].forEach(s => setPower(w, s, true)); for (let i = 0; i < 20; i++) step(w, DT);
  const b = w.bergs[3]; deployBuoy(w, b.x, b.y); for (let i = 0; i < 60; i++) step(w, DT);
  lockFromCamera(w, b.id);
  const fresh = aimQuality(w).q;
  for (let i = 0; i < 600; i++) { step(w, DT); }
  const stale = aimQuality(w).q;
  check(dist(w.lock, b) < 200 && fresh >= 80 && stale < fresh, `Aim quality is high for a fresh close fix and falls as it ages (${fresh} -> ${stale})`);
}

// ---------- case board ----------
{
  const w = createWorld(21); light(w); ['sonar', 'currents', 'radio'].forEach(s => setPower(w, s, true));
  for (let i = 0; i < 20; i++) step(w, DT);
  const b = w.bergs.find(b => b.radio && b.large && dist(b, CENTER) < 1300);
  deployBuoy(w, b.x + 20, b.y); for (let i = 0; i < 60; i++) step(w, DT); ping(w); for (let i = 0; i < 60; i++) step(w, DT);
  lockContact(w, w.contacts.find(c => c.bergId === b.id));
  check(w.cases.length === 1 && !w.cases[0].permanent && w.obs[b.id].hollow === b.hollow, 'Locking ice from sonar puts it on the case board (temporarily) with its HOLLOW reading');
  setDrift(w, 'deep'); fireBeacon(w, 'red'); for (let i = 0; i < 150; i++) step(w, DT);
  check(w.cases[0].permanent, 'A beacon hit pins the ice to the case board');
  const other = w.bergs.find(x => x.id !== b.id); lockOn(w, other.id, other.x, other.y, w.t, 'camera');
  check(w.cases.length === 2 && w.cases.filter(c => !c.permanent).length === 1, 'Locking other ice adds one temporary row');
  const other2 = w.bergs.find(x => x.id !== b.id && x.id !== other.id); lockOn(w, other2.id, other2.x, other2.y, w.t, 'camera');
  check(w.cases.length === 2, 'Only the ice you are locked on keeps a temporary row');
  relockCase(w, b.id);
  check(w.lock.bergId === b.id && w.lock.source === 'beacon' && dist(w.lock, b) < 1, 'A beaconed row re-locks from its live position');
  setFreq(w, b.radio.freq); setGain(w, gainFor(dist(b, OBSERVATORY))); for (let i = 0; i < 10; i++) step(w, DT);
  check(w.obs[b.id].radio && w.obs[b.id].radio.shown === b.radio.shown, 'Reading the radio records the signal on the case board');
  for (let f = 100; f <= 1000; f += 10) { setFreq(w, f); relockCase(w, b.id); step(w, DT); }
  check(w.obs[b.id].swept, 'Sweeping the whole band marks the radio SWEPT');
  setVerdict(w, b.id, 'EXCLUDED'); check(w.cases.find(c => c.bergId === b.id).verdict === 'EXCLUDED', 'Verdicts can be set');
  setVerdict(w, b.id, '?'); check(w.cases.find(c => c.bergId === b.id).verdict === '?', '...and undone');
  const w2 = createWorld(22); light(w2);
  check(Object.values(w2.checklist).every(v => !v), 'The startup checklist starts empty');
  setPower(w2, 'sonar', true); for (let i = 0; i < 20; i++) step(w2, DT); deployBuoy(w2, CENTER.x + 300, CENTER.y); for (let i = 0; i < 50; i++) step(w2, DT); ping(w2);
  check(w2.checklist.sonar && w2.checklist.buoy && w2.checklist.ping, 'The checklist ticks itself off');
}

// ---------- Old Tom ----------
{
  const w = createWorld(31); light(w); setPower(w, 'sonar', true);
  for (let i = 0; i < 5900; i++) { keepFurnace(w); step(w, DT); }
  check(w.tom.mode === 'asleep', 'Old Tom sleeps for the first ten minutes');
  for (let i = 0; i < 200; i++) { keepFurnace(w); step(w, DT); }
  check(w.tom.mode !== 'asleep', 'Old Tom wakes after ten minutes');
  w.tom.x = CENTER.x + 1400; w.tom.y = CENTER.y;
  if (!isUp(w, 'sonar')) setPower(w, 'sonar', true); for (let i = 0; i < 30; i++) step(w, DT);
  w.broken.winch = false; w.buoyRebuildAt = 0; deployBuoy(w, CENTER.x - 500, CENTER.y);
  const d0 = dist(w.tom, w.buoy); for (let i = 0; i < 100; i++) { keepFurnace(w); step(w, DT); }
  check(w.tom.mode === 'hunt' && dist(w.tom, w.buoy) < d0 - 50, 'Old Tom swims for the buoy splashdown');
  for (let i = 0; i < 3000 && w.buoy; i++) { keepFurnace(w); step(w, DT); }
  check(!w.buoy, 'Old Tom eats a buoy left at the splashdown');
  const a0 = Math.atan2(w.tom.y - CENTER.y, w.tom.x - CENTER.x); for (let i = 0; i < 100; i++) { keepFurnace(w); step(w, DT); }
  let da = Math.atan2(w.tom.y - CENTER.y, w.tom.x - CENTER.x) - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  check(w.tom.mode === 'patrol' && da < 0, 'Then Old Tom circles the Watch the opposite way to the Grindmaw');
}

// ---------- a long watch ----------
{
  const w = createWorld(41); light(w); ['sonar', 'currents', 'cameras'].forEach(s => setPower(w, s, true));
  let ok = true, snowLate = false;
  try { for (let i = 0; i < 24000; i++) { keepFurnace(w); step(w, DT); if (w.t > 1300 && w.cams.some(c => snowAt(w, c.x, c.y, w.t) > 0.5)) snowLate = true; if (i % 900 === 0 && isUp(w, 'sonar') && w.buoy) ping(w); } } catch (e) { ok = false; console.log(e); }
  check(ok && w.t > 2399, 'A 40-minute watch runs without errors');
  check(snowLate, 'Storms keep coming after twenty minutes');
}

// ---------- camera tracking: hit without a buoy ----------
{
  let hits = 0, tries = 0;
  for (const seed of SEEDS.slice(0, 15)) {
    const w = createWorld(seed); light(w); setPower(w, 'cameras', true);
    for (let i = 0; i < 20; i++) step(w, DT);
    let pick = null;
    for (let k = 0; k < 120 && !pick; k++) {
      for (const c of w.cams) { const b = w.bergs.find(b => camSees(c, b, -0.25) && dist(b, c) < T.camRange * 0.7); if (b) { pick = { c, b }; break; } }
      if (!pick) { keepFurnace(w); for (let i = 0; i < 50; i++) step(w, DT); }
    }
    if (!pick) continue;
    tries++;
    selectCam(w, pick.c.id); lockFromCamera(w, pick.b.id);
    for (let i = 0; i < (T.trackTime + 2) * 10; i++) step(w, DT);
    if (!w.lock.track) continue;
    fireBeacon(w, 'red');
    for (let i = 0; i < 200; i++) step(w, DT);
    if (w.beacons.last && w.beacons.last.hit && w.beacons.last.intended) hits++;
  }
  console.log(`Camera-tracked shots with no buoy: ${hits}/${tries} hit`);
  check(tries >= 10 && hits >= tries - 1, 'Tracking ice on a camera lets a beacon hit it without a buoy');
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
