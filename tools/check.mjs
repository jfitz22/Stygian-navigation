// Headless scenario checks across many seeds. Run: node tools/check.mjs [seedCount]
import {
  createWorld, step, light, stoke, dist, snapshot, setPower, deployBuoy, ping, lockContact, fireBeacon, runeEffect, sealInput, openSeal, shuttered, hitRadius, ghostAt,
  countSightings, camSees, snowAt, slotsAvailable, pressKey, readingDisplay, radioSignal, setFreq, setGain, gainFor, setMusic, lockOn, DT,
  pressBoard, runeFunction, lockFromCamera, aimQuality, startRepair, sip, camCode, setLever, pressPlate, setCamTurn, camIsUnlocked, selectCam, gm,
  relockCase, setVerdict, isUp, inShoal, saveWorld, loadWorld, echoSeen, SYSTEMS,
} from '../src/sim.js';
import { OBSERVATORY, CENTER, REACH, TUNING as T, TOMB_RADIUS, CAMERAS, CELL, RADIO_TABLE, BOARD_GRID, SHOALS, SIZE_CUT, COLD_WATER, FIELDS } from '../src/scenario.js';
import { keypadCode, RUNES, REPAIR_RULES, repairAction } from '../src/glyphs.js';
import { checkPassword, RULES as PW_RULES, WRONG_TRIES } from '../src/password.js';

const SEEDS = Array.from({ length: Number(process.argv[2]) || 40 }, (_, i) => 1000 + i * 37);
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };
const pct = (a, b) => (100 * a / b).toFixed(0) + '%';
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
// Fire until it hits (the roll can miss even a good shot). Returns the number of shots it took, or 0.
function fireUntilHit(w, color, target, tries = 8) {
  for (let k = 1; k <= tries; k++) {
    w.broken.launcher = false; w.beacons.stock = Math.max(w.beacons.stock, 1); w.beacons[color === 'red' ? 'stock' : color] = Math.max(1, w.beacons[color === 'red' ? 'stock' : color]);
    const n0 = w.events.length; fireBeacon(w, color);
    for (let i = 0; i < 400 && !w.events.slice(n0).some(e => e.type === 'hit' || e.type === 'miss'); i++) step(w, DT);
    if (w.events.slice(n0).some(e => e.type === 'hit' && (!target || e.berg === target.id))) return k;
  }
  return 0;
}
const VALID3 = 'Jerry!StygiaV';   // passes the first three password rules
const keepFurnace = w => { if (w.furnace.heat < 50) { if (!w.furnace.chute) w.furnace.chute = T.chuteMax; stoke(w); } };   // a diligent stoker with a full chute

function run(seed, seconds, each) {
  const w = createWorld(seed); light(w);
  for (let i = 0; i < seconds / DT; i++) { if (i % 50 === 0) keepFurnace(w); step(w, DT); if (each) each(w, i); }
  return w;
}

// ---------- world-level properties per seed ----------
const stats = { spawnT: [], sightings: [], firstSight: [], minTomb: [], tombMove: [], medianPath: [], ruledOut: [], outOfReach: [], transmit: [], stormHits: [] };
let triadNoMetal = 0, triadNotHalls = 0;
let elgarzLeft = 0, triadOthers = 0, fullMatch = 0, hulkInRing = 0, oneSign = [];
for (const seed of SEEDS) {
  const w0 = createWorld(seed);
  stats.transmit.push([...w0.bergs, ...w0.reserve].filter(b => b.radio).length / (w0.bergs.length + w0.reserve.length));
  const ice0 = [...w0.bergs, ...w0.reserve], triad = b => b.radio && b.radio.decoded === 'BRW' && b.radio.band === 'MID';
  triadOthers += ice0.filter(b => !b.elgarz && triad(b)).length;
  fullMatch += ice0.filter(b => !b.elgarz && !b.tombDrawn && b.echo.sig === 'halls' && b.metal && triad(b)).length;
  oneSign.push(ice0.filter(b => !b.elgarz && (b.metal || triad(b))).length);
  if (ice0.some(b => triad(b) && !b.metal)) triadNoMetal++;
  if (ice0.some(b => triad(b) && b.echo.sig !== 'halls')) triadNotHalls++;
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
check(fullMatch === 0, 'No decoy except the Gilded Hulk is halls, metal and Triad');
check(hulkInRing === SEEDS.length, `The Gilded Hulk stays inside the Tomb ring all watch (${hulkInRing}/${SEEDS.length} seeds)`);
check(triadNoMetal === SEEDS.length && triadNotHalls === SEEDS.length, 'Every seed has Triad ice without metal and Triad ice that is not halls');
check(Math.min(...oneSign) >= 12, 'Plenty of ice shows metal or the Triad, not just the echo');
{
  let ok = true;
  for (const seed of SEEDS) {
    const w0 = createWorld(seed), all = [...w0.bergs, ...w0.reserve], big = all.filter(b => b.length > SIZE_CUT), tr = b => b.radio && b.radio.decoded === 'BRW' && b.radio.band === 'MID';
    const n = sig => big.filter(b => b.echo.sig === sig).length, H = big.filter(b => b.echo.sig === 'halls');
    const shape = [all.length, all.length - big.length, n('solid'), n('caverns'), n('flooded'), n('monster'), n('halls'), H.filter(b => !b.metal && !tr(b)).length, H.filter(b => b.metal && !tr(b)).length, H.filter(b => !b.metal && tr(b)).length, H.filter(b => b.metal && tr(b)).length].join(',');
    if (shape !== '60,20,15,6,4,5,10,3,2,3,2') { ok = false; console.log('composition', seed, shape); }
    const evenOK = all.every(b => { const g = b.echo.humps.slice(1).map((h, i) => h.x - b.echo.humps[i].x), ev = g.every(x => Math.abs(x - g[0]) < 0.5) && b.echo.humps.every(h => h.h === b.echo.humps[0].h);
      return b.echo.sig === 'solid' ? b.echo.humps.length === 0 : b.echo.sig === 'caverns' ? b.echo.humps.length >= 2 && !ev : b.echo.sig === 'flooded' ? b.echo.tail === 'wavy' : ev && b.echo.humps.length >= 3; });
    if (!evenOK) { ok = false; console.log('echo shapes', seed); }
    if (all.some(b => b.length > 19.5 && b.length <= SIZE_CUT + 0.5)) { ok = false; console.log('ambiguous size', seed); }
  }
  check(ok, '60 ice: 20 small; large 15 solid, 6 caverns, 4 flooded, 5 monsters, 10 halls (3 plain, 2 metal, 3 Triad, 2 all three); printouts match their class');
}
{
  const g = createWorld(1000).bergs.filter(b => b.field === 'graveyard'), c = { x: g.reduce((a, b) => a + b.x, 0) / g.length, y: g.reduce((a, b) => a + b.y, 0) / g.length };
  check(FIELDS.length === 1 && g.length === 5 && Math.min(...g.map(b => dist(b, c))) > 60, 'One named field, the Graveyard, spread out');
}
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
  light(w2); const asked = w2.seal && w2.seal.reason === 'relight'; sealInput(w2, VALID3);
  check(asked && w2.furnace.lit, 'After the grate is repaired the furnace relights (once the password is entered)');
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
  check(!radioSignal(w).lamps, 'The radio hears nothing from ice without a beacon');
  b.tag = 'red';
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
      if (!['FUEL', 'COFFEE'].every(f => fns.includes(f))) ok = false;
      for (let p = 0; p < 4; p++) { pressBoard(w, p); w.seal = null; }
    }
  }
  check(ok, 'Every rune board page has fuel and coffee');
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
  {
    const all = Object.values(BOARD_GRID).flat(), houseOf = fn => Object.keys(BOARD_GRID).filter(h => BOARD_GRID[h].includes(fn));
    check(all.length === 16 && all.filter(f => f === 'FUEL').length === 2 && all.filter(f => f === 'COFFEE').length === 2 && houseOf('FUEL').length === 2 && houseOf('COFFEE').length === 2,
      'The board has two FUELs and two COFFEEs, each pair in different houses');
    const w9 = createWorld(9); light(w9); let ok = true;
    for (let i = 0; i < 300; i++) { const fns = w9.board.runes.map(r => runeFunction(r, w9.board.page)); if (!fns.includes('FUEL') || !fns.includes('COFFEE')) ok = false; w9.board.nextFlip = 0; step(w9, DT); }
    check(ok, 'Every board dealt has at least one FUEL and one COFFEE');
  }
  {
    const w8 = createWorld(3); light(w8); w8.board.nextFlip = 1e9;
    for (const fn of ['CONFETTI', 'DEVIL']) {
      const k = w8.board.runes.findIndex(r => runeFunction(r, w8.board.page) === fn);
      if (k < 0) continue; const n0 = w8.board.presses; w8.events.length = 0; pressBoard(w8, k);
      check(w8.events.some(e => e.type === fn.toLowerCase()) && w8.board.presses !== n0, fn + ' fires its effect and still counts as a press');
    }
  }
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
  const b = w.bergs.find(b => b.radio); b.tag = 'red'; lockOn(w, b.id, b.x, b.y, w.t, 'camera');
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
  const fresh = aimQuality(w).q, near = dist(w.lock, b) < 200;
  for (let i = 0; i < 1500; i++) { keepFurnace(w); step(w, DT); }
  const stale = aimQuality(w).q;
  check(near && fresh >= 90 && stale < fresh, `The hit chance is high for a fresh close fix and falls as it ages (${fresh} -> ${stale})`);
}

// ---------- case board ----------
{
  const w = createWorld(21); light(w); ['sonar', 'currents', 'radio'].forEach(s => setPower(w, s, true));
  for (let i = 0; i < 20; i++) step(w, DT);
  const b = w.bergs.find(b => b.radio && b.length > SIZE_CUT && !b.tombDrawn && !inShoal(b) && dist(b, CENTER) < 1300);
  deployBuoy(w, b.x + 20, b.y); for (let i = 0; i < 60; i++) step(w, DT); ping(w); for (let i = 0; i < 60; i++) step(w, DT);
  lockContact(w, w.contacts.find(c => c.bergId === b.id));
  check(w.cases.length === 1 && !w.cases[0].permanent && w.obs[b.id].length === Math.round(b.length) && w.obs[b.id].echo && w.obs[b.id].echo.humps.length === b.echo.humps.length, 'Locking ice from sonar puts it on the case board (temporarily) with its length and its printed echo');
  fireUntilHit(w, 'red', b); for (let i = 0; i < 20; i++) step(w, DT);
  check(w.cases[0].permanent, 'A beacon hit pins the ice to the case board');
  const other = w.bergs.find(x => x.id !== b.id); lockOn(w, other.id, other.x, other.y, w.t, 'camera');
  check(w.cases.length === 2 && w.cases.filter(c => !c.permanent).length === 1, 'Locking other ice adds one temporary row');
  const other2 = w.bergs.find(x => x.id !== b.id && x.id !== other.id); lockOn(w, other2.id, other2.x, other2.y, w.t, 'camera');
  check(w.cases.length === 2, 'Only the ice you are locked on keeps a temporary row');
  relockCase(w, b.id);
  check(w.lock.bergId === b.id && w.lock.source === 'beacon' && dist(w.lock, b) < 1, 'A beaconed row re-locks from its live position');
  for (let i = 0; i < 600; i++) { keepFurnace(w); step(w, DT); }
  const aqB = aimQuality(w);
  check(aqB.source === 'beacon' && aqB.q === 100 && dist(w.lock, b) < 1, 'Beaconed ice reports its own position and drift: aim stays full a minute later');
  setFreq(w, b.radio.freq); setGain(w, gainFor(dist(b, OBSERVATORY))); for (let i = 0; i < 10; i++) step(w, DT);
  check(w.obs[b.id].radio && w.obs[b.id].radio.shown === b.radio.shown, 'Reading the radio records the signal on the case board');
  for (let f = 100; f <= 1000; f += 10) { setFreq(w, f); relockCase(w, b.id); step(w, DT); }
  check(w.obs[b.id].swept, 'Sweeping the whole band marks the radio SWEPT');
  setVerdict(w, b.id, 'EXCLUDED'); check(w.cases.find(c => c.bergId === b.id).verdict === 'EXCLUDED', 'Verdicts can be set');
  setVerdict(w, b.id, '?'); check(w.cases.find(c => c.bergId === b.id).verdict === '?', '...and undone');
  const w2 = createWorld(22); light(w2);
  check(Object.values(w2.checklist).every(v => !v), 'The startup checklist starts empty');
  setPower(w2, 'sonar', true); for (let i = 0; i < 20; i++) step(w2, DT); deployBuoy(w2, CENTER.x + 300, CENTER.y); for (let i = 0; i < 50; i++) step(w2, DT); ping(w2);
  setPower(w2, 'cameras', true);
  check(w2.checklist.sonar && w2.checklist.buoy && w2.checklist.orbs, 'The checklist ticks itself off');
}

// ---------- payloads, scanner range, repair rules ----------
{
  const w = createWorld(51); light(w);
  check(w.beacons.orange === 6 && w.beacons.blue === 6 && w.beacons.green === 4, 'Six orange, six blue and four green beacons');
  for (let i = 0; i < 20; i++) step(w, DT);
  const b = w.bergs.find(b => b.large);
  lockOn(w, b.id, b.x, b.y, w.t, 'camera'); w.lock.track = { vx: b.vx || 0, vy: b.vy || 0, t: w.t, cam: 'c1' };
  w.beacons.orange = 6; const shotsO = fireUntilHit(w, 'orange', b); w.beacons.orange += 0; for (let i = 0; i < 20; i++) step(w, DT);
  check(w.obs[b.id] && w.obs[b.id].echo && w.obs[b.id].echo.humps.length === b.echo.humps.length && shotsO > 0 && w.beacons.orange === 6 - shotsO, 'An orange sounding charge prints the echo without a ping');
  const c = w.bergs.find(x => x.large && x.id !== b.id);
  lockOn(w, c.id, c.x, c.y, w.t, 'camera'); w.lock.track = { vx: c.vx || 0, vy: c.vy || 0, t: w.t, cam: 'c1' };
  fireUntilHit(w, 'blue', c); for (let i = 0; i < 300; i++) step(w, DT);
  check(c.driftLog && c.driftLog.length >= 4, 'A blue beacon starts a drift log');
  const w2 = createWorld(52); light(w2); ['sonar', 'scanner', 'currents'].forEach(s => setPower(w2, s, true)); for (let i = 0; i < 50; i++) step(w2, DT);
  w2.scanner.calibrated = true; const d = w2.bergs.find(x => dist(x, CENTER) < 1200);
  lockOn(w2, d.id, d.x, d.y, w2.t, 'camera'); for (let i = 0; i < 100; i++) step(w2, DT);
  check(d.scan === 0, 'The metal scanner needs a buoy');
  deployBuoy(w2, d.x + 900 > 3400 ? d.x - 900 : d.x + 900, d.y); for (let i = 0; i < 100; i++) step(w2, DT);
  check(d.scan === 0, 'The metal scanner does nothing out of buoy range');
  w2.buoy = { x: d.x + 20, y: d.y, landAt: w2.t }; for (let i = 0; i < (T.scanTime + 3) * 10; i++) { keepFurnace(w2); w2.buoy.x = d.x + 20; w2.buoy.y = d.y; step(w2, DT); }
  check(d.scanned, 'In buoy range the metal scanner finishes its scan');
  // every repair combination: the flowchart order equals the game's rules, and every board has a CUT and a CLOSE
  const combos = []; for (const gauge of ['LOW', 'MIDDLE', 'HIGH', 'RED']) for (const lamp of ['R', 'W', 'B', 'D']) combos.push({ gauge, lamp });
  const viaChart = r => { for (const rule of REPAIR_RULES) if (rule.test(r)) return rule.then; return 'OPEN'; };
  check(combos.every(r => viaChart(r) === repairAction(r)), 'The repair flowchart matches the game for all 16 combinations');
  const acts = new Set(combos.map(repairAction));
  check(acts.has('CUT') && acts.has('CLOSE') && acts.has('OPEN'), 'The repair rules can produce CUT, CLOSE and OPEN');
}

// ---------- one ping, the echo classes, currents on ping, shoals ----------
{
  const w = createWorld(61); light(w); ['sonar', 'currents'].forEach(s => setPower(w, s, true)); for (let i = 0; i < 20; i++) step(w, DT);
  const b = w.bergs.find(x => x.length > SIZE_CUT && !inShoal(x) && dist(x, CENTER) < 1300);
  deployBuoy(w, b.x + 30, b.y); for (let i = 0; i < 45; i++) step(w, DT);
  check(w.readings && w.t - w.readings.t < 1, 'The buoy reads the current as soon as it lands');
  for (let i = 0; i < 20; i++) step(w, DT); const r0 = w.readings.t;
  ping(w);
  check(w.readings.t === w.t && w.readings.t > r0, 'A ping also takes a current reading');
  for (let i = 0; i < 60; i++) step(w, DT);
  const c = w.contacts.find(c => c.bergId === b.id);
  check(c && c.echo && c.echo.humps.length === b.echo.humps.length, 'One ping prints the full echo of every contact');
  const mon = { echo: { sig: 'monster', humps: [{ x: 44, h: 0.85 }, { x: 68, h: 0.85 }, { x: 92, h: 0.85 }], tail: 'pulse' } };
  check(echoSeen(mon, COLD_WATER + 2).tail === 'pulse' && echoSeen(mon, COLD_WATER - 2).tail === 'flat', 'A frozen monster pulses in warm water and reads as halls below -40');
  check(SHOALS.length === 4 && SHOALS.every(s => { const c = CAMERAS.find(k => k.id === s.cam); return dist(s, c) < T.camRange && !camSees(c, s) && dist(s, CENTER) + s.r * 0.5 < T.buoyDeployRange; }), 'Four shoals, each within reach of an orb but outside its starting view');
}
// ---------- frozen monsters ----------
{
  const w = createWorld(63); light(w); ['sonar', 'currents'].forEach(s => setPower(w, s, true)); for (let i = 0; i < 20; i++) step(w, DT);
  const m = w.bergs.find(b => b.echo.sig === 'monster' && !b.tombDrawn);
  m.x = CENTER.x + 500; m.y = CENTER.y; deployBuoy(w, m.x + 250, m.y); for (let i = 0; i < 50; i++) step(w, DT);
  lockOn(w, m.id, m.x, m.y, w.t, 'camera'); w.lock.track = { vx: m.vx || 0, vy: m.vy || 0, t: w.t, cam: 'c1' };
  fireUntilHit(w, 'red', m); for (let i = 0; i < 100 && !w.monsters.length; i++) step(w, DT);
  check(w.monsters.length === 1 && m.released && m.echo.sig === 'caverns', 'A beacon hit on a frozen monster lets it out (and leaves empty caverns)');
  const d0 = dist(w.monsters[0], w.buoy); for (let i = 0; i < 30; i++) step(w, DT);
  check(dist(w.monsters[0], w.buoy) < d0, 'The monster swims for the buoy');
  w.buoyRebuildAt = 0; deployBuoy(w, w.buoy.x - 30, w.buoy.y - 30); step(w, DT);
  check(w.monsters[0] && w.monsters[0].fadeAt == null, 'Nudging the buoy a little does not shake it off');
  deployBuoy(w, CENTER.x - 900, CENTER.y); step(w, DT);
  check(w.monsters.length === 1 && w.monsters[0].fadeAt != null, 'Moving the buoy a full buoy radius away makes it fade');
  for (let i = 0; i < 40; i++) step(w, DT);
  check(w.monsters.length === 0, '...and it is gone from the sea');
  // left alone, it eats the buoy
  const w2 = createWorld(64); light(w2); setPower(w2, 'sonar', true); for (let i = 0; i < 20; i++) step(w2, DT);
  const m2 = w2.bergs.find(b => b.echo.sig === 'monster' && !b.tombDrawn); m2.x = CENTER.x; m2.y = CENTER.y + 600;
  deployBuoy(w2, m2.x + 200, m2.y); for (let i = 0; i < 50; i++) step(w2, DT);
  lockOn(w2, m2.id, m2.x, m2.y, w2.t, 'camera'); w2.lock.track = { vx: m2.vx || 0, vy: m2.vy || 0, t: w2.t, cam: 'c1' };
  w2.shark.x = 0; w2.shark.y = 0; w2.lastPing = null; fireUntilHit(w2, 'red', m2);
  for (let i = 0; i < 1500 && w2.buoy; i++) { keepFurnace(w2); step(w2, DT); }
  check(!w2.buoy && w2.broken.winch && w2.events.some(e => e.type === 'buoydead' && e.who === 'monster'), 'A monster that reaches the buoy destroys it');
  const g = createWorld(65); gm(g, 'move-berg', { id: g.bergs[3].id, x: 1234, y: 2345 });
  check(g.bergs[3].x === 1234 && g.bergs[3].y === 2345, 'The GM can drag ice to a new spot');
}
{
  const w2 = createWorld(62); light(w2); setPower(w2, 'sonar', true); for (let i = 0; i < 20; i++) step(w2, DT);
  const sh = SHOALS[0]; w2.bergs[0].x = sh.x; w2.bergs[0].y = sh.y; w2.bergs[1].x = sh.x + sh.r + 60; w2.bergs[1].y = sh.y;
  deployBuoy(w2, sh.x + sh.r + 40, sh.y); for (let i = 0; i < 60; i++) step(w2, DT); w2.bergs[0].x = sh.x; w2.bergs[0].y = sh.y; ping(w2); for (let i = 0; i < 60; i++) step(w2, DT);
  check(!w2.contacts.some(c => c.bergId === w2.bergs[0].id), 'Ice inside a shoal gives no sonar echo');
  w2.buoyRebuildAt = 0; deployBuoy(w2, sh.x, sh.y); for (let i = 0; i < 200; i++) { keepFurnace(w2); step(w2, DT); } ping(w2); const before = w2.contacts.length; for (let i = 0; i < 60; i++) step(w2, DT);
  check(w2.pings.length === 0 || w2.contacts.length === before, 'A buoy on the rocks gets no echoes at all');
}

// ---------- beacon telemetry: shots at beaconed ice land ----------
{
  let shots = 0, hits = 0;
  for (const seed of SEEDS.slice(0, 20)) {
    const w = createWorld(seed); light(w); for (let i = 0; i < 20; i++) step(w, DT);
    for (const b of w.bergs.filter(b => b.length > SIZE_CUT && !b.tombDrawn && dist(b, CENTER) < 1500).slice(0, 2)) {
      b.tag = 'red'; lockOn(w, b.id, b.x, b.y, w.t, 'camera');
      for (let i = 0; i < 300; i++) { keepFurnace(w); step(w, DT); }
      w.broken.launcher = false; const n0 = w.events.length; fireBeacon(w, 'red'); shots++;
      for (let i = 0; i < 1500 && !w.events.slice(n0).some(e => e.type === 'hit' || e.type === 'miss'); i++) { keepFurnace(w); step(w, DT); }
      if (w.events.slice(n0).some(e => e.type === 'hit' && e.berg === b.id)) hits++;
    }
  }
  check(hits / shots >= 0.9, `Shots at beaconed ice land (${hits}/${shots})`);
}

// ---------- save and resume ----------
{
  let ok = true;
  for (const seed of SEEDS.slice(0, 6)) {
    const a = createWorld(seed); light(a); ['sonar', 'currents', 'cameras'].forEach(x => setPower(a, x, true));
    for (let i = 0; i < 2000; i++) { keepFurnace(a); step(a, DT); }
    deployBuoy(a, CENTER.x + 400, CENTER.y); for (let i = 0; i < 200; i++) step(a, DT); ping(a);
    for (let i = 0; i < 4000; i++) { keepFurnace(a); step(a, DT); }
    const b = loadWorld(saveWorld(a));
    for (const w of [a, b]) for (let i = 0; i < 3000; i++) { keepFurnace(w); step(w, DT); }
    if (JSON.stringify(snapshot(a)) !== JSON.stringify(snapshot(b)) || saveWorld(a) !== saveWorld(b)) { ok = false; console.log('resume diverged', seed); }
  }
  check(ok, 'A saved watch resumes and carries on exactly as the original would');
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

// ---------- the hit chance is honest ----------
{
  let n = 0, sumP = 0, hits = 0, onIce = 0, landed = 0;
  for (const seed of SEEDS.slice(0, 30)) {
    const w = createWorld(seed); light(w); ['sonar', 'currents'].forEach(x => setPower(w, x, true)); for (let i = 0; i < 30; i++) step(w, DT);
    const b = w.bergs.find(b => b.length > SIZE_CUT && !inShoal(b) && !b.tombDrawn && dist(b, CENTER) < 1200);
    deployBuoy(w, b.x + 40, b.y); for (let i = 0; i < 60; i++) step(w, DT); ping(w); for (let i = 0; i < 60; i++) step(w, DT);
    const c = w.contacts.find(c => c.bergId === b.id); if (!c) continue; lockContact(w, c);
    for (const wait of [0, 25, 25, 25, 25, 25]) {
      for (let i = 0; i < wait * 10; i++) { keepFurnace(w); step(w, DT); }
      w.broken.launcher = false; w.beacons.stock = 12; b.tag = null; w.tags = []; w.lock.track = null; w.lock.source = 'sonar';   // keep it a sonar shot, not beacon telemetry
      const aq = aimQuality(w), n0 = w.events.length; fireBeacon(w, 'red'); const fl = w.beacons.flying.at(-1);
      for (let i = 0; i < 300 && !w.events.slice(n0).some(e => e.type === 'hit' || e.type === 'miss'); i++) step(w, DT);
      const hit = w.events.slice(n0).some(e => e.type === 'hit' && e.berg === b.id);
      n++; sumP += aq.chance; hits += hit;
      if (hit) { landed++; if (dist(b, { x: fl.x1, y: fl.y1 }) < hitRadius(w, b) + 5) onIce++; }
      b.tag = null; w.tags = [];
    }
  }
  console.log(`Hit chance: stated ${(100 * sumP / n).toFixed(1)}% on average, actual ${(100 * hits / n).toFixed(1)}% over ${n} shots`);
  check(Math.abs(sumP - hits) / n < 0.06, 'The hit chance shown is the real chance of hitting (within 6 points over many shots)');
  check(landed > 0 && onIce === landed, 'A hit lands on the ice: the beacon flies to where the ice really is');
  const w = createWorld(71); light(w); w.levers.drift = 1; for (let i = 0; i < 30; i++) step(w, DT);
  const b = w.bergs.find(b => b.large); lockOn(w, b.id, b.x, b.y, w.t - 120, 'sonar'); setPower(w, 'currents', true);
  w.readings = { t: w.t, x: b.x, y: b.y, surface: { x: 0, y: 0 }, deep: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, windFrom: 0, windSpeed: 0, temp: -30 };
  const slow = aimQuality(w).q; w.levers.drift = 2.5; for (let i = 0; i < 2; i++) step(w, DT); w.readings.t = w.t; const fast = aimQuality(w).q;
  w.levers.aim = 2; const forgiving = aimQuality(w).q;
  check(fast < slow && forgiving > fast, `Faster drift lowers the hit chance and beacon forgiveness raises it (${slow} -> ${fast} -> ${forgiving})`);
}

// ---------- rune board effects ----------
{
  const w = createWorld(72); light(w); ['sonar', 'cameras'].forEach(x => setPower(w, x, true)); for (let i = 0; i < 30; i++) step(w, DT);
  w.cams.forEach(c => c.heat = 80); runeEffect(w, 'COOLANT');
  check(w.cams.every(c => c.heat === 0), 'COOLANT cools every orb at once');
  w.furnace.chute = 3; runeEffect(w, 'PURGE');
  check(w.furnace.chute === 0, 'PURGE empties the fuel chute');
  deployBuoy(w, CENTER.x + 400, CENTER.y); for (let i = 0; i < 50; i++) step(w, DT);
  runeEffect(w, 'SHUTTER');
  check(shuttered(w) && !ping(w), 'SHUTTER covers the sonar: no pinging until it lifts');
  for (let i = 0; i < (T.shutterTime + 1) * 10; i++) { keepFurnace(w); step(w, DT); }
  check(!shuttered(w) && ping(w), '...and it lifts by itself after twenty seconds');
  w.shark.x = CENTER.x + 400; w.shark.y = CENTER.y - 1200; runeEffect(w, 'DECOY');
  const dd = dist(w.lastPing, w.buoy);
  check(w.lastPing.decoy && Math.abs(dd - T.decoyRange * T.buoyRadius) < 60 && dist(w.lastPing, CENTER) <= REACH * 0.9 + 1, 'DECOY lands about one and a half buoy ranges from the buoy, and the Grindmaw chases it');
  const l0 = w.lamps; runeEffect(w, 'LIGHTS'); const l1 = w.lamps; runeEffect(w, 'LIGHTS'); const l2 = w.lamps; runeEffect(w, 'LIGHTS');
  check(l0 === 0 && l1 === 1 && l2 === 2 && w.lamps === 0, 'LIGHTS cycles normal, red, green, normal');
  const m0 = w.music; runeEffect(w, 'RADIO'); check(w.music !== m0, 'RADIO switches the cabin radio');
  w.lock = null; const st = w.beacons.stock; runeEffect(w, 'LAUNCH');
  check(w.beacons.stock === st - 1 && w.beacons.flying.some(f => f.wild), 'LAUNCH with nothing locked fires a beacon somewhere wild');
}

// ---------- the password ----------
{
  // the rules, one at a time, in order
  const p8 = (() => { const base = 'Jerry!StygiaV-Pride-Bel-II-'; for (let L = base.length; L < 90; L++) { const ls = String(L); let need = 42 - [...ls].reduce((a, c) => a + +c, 0), fill = ''; while (need > 0) { const d = Math.min(9, need); fill += d; need -= d; } const p = base + ls + fill; if (p.length === L) return p; } })();
  const ctx = { pages: [1] }, ok = (p, cap) => checkPassword(p, cap, ctx).ok;
  check(PW_RULES.map(r => r.id).join() === 'jerry,case,hell,length,sin,devil,digits,page', 'The password rules come in the agreed order');
  check(p8 && ok(p8, 8) && ok('  ' + p8 + '  ', 8), `A password that obeys all eight rules passes (${p8}), with spaces trimmed`);
  check(!ok('jerry!stygiav', 3) && !ok('JerryStygiaV', 3) && !ok('Jerry!Stygia', 3) && ok('Jerry!DisII', 3) && ok('jErRy?avernusI', 3), 'Rules 1-3: JERRY in any case; a capital and a symbol; a layer of Hell with its numeral in capitals');
  check(!ok('Jerry😈StygiaV', 3), 'Only keyboard characters: an emoji is refused');
  check(ok(p8, 8) && !ok(p8.replace('II', 'IV'), 8) && checkPassword(p8.replace('II', 'IV'), 8, { pages: [3] }).ok, 'The page rule wants the numeral of a page shown while the lock was open');
  check(!ok(p8.slice(0, -1), 8), 'Change one digit and the sum or the length breaks');

  // the lock itself
  const w = createWorld(73); light(w); ['sonar', 'currents'].forEach(x => setPower(w, x, true)); for (let i = 0; i < 30; i++) step(w, DT);
  runeEffect(w, 'LOCKDOWN');
  check(w.seal && w.seal.mode === 'set' && w.pwCap === 3, 'The first LOCKDOWN asks the crew to set a password under three rules');
  check(!stoke(w) && !fireBeacon(w, 'red') && !setPower(w, 'radio', true), 'While locked, the furnace, the power board and the launcher refuse');
  check(sealInput(w, 'jerry') === 'rejected' && w.seal, 'A password that breaks a rule is refused');
  check(sealInput(w, VALID3) === 'ok' && !w.seal && w.password === VALID3, 'A good password is set and the lock lifts');
  runeEffect(w, 'LOCKDOWN');
  check(w.seal.mode === 'enter' && w.pwCap === 4, 'The next LOCKDOWN asks for the password, and one more rule will apply');
  check(sealInput(w, 'nope') === 'wrong' && w.seal.tries === 1, 'A wrong password costs a try');
  sealInput(w, VALID3);
  check(w.seal && w.seal.mode === 'set', '...the right one, and a new password must be set');
  check(sealInput(w, VALID3) === 'rejected', 'The old password no longer satisfies the new rules');
  const p5 = 'Jerry!StygiaV-Pride' + (() => { for (let L = 20; L < 40; L++) { const t = 'Jerry!StygiaV-Pride' + L; if (t.length === L) return L; } })();
  check(sealInput(w, p5) === 'ok' && w.password === p5, `A password meeting four rules is accepted (${p5})`);
  // green asks
  const b = w.bergs.find(b => b.large && !b.tombDrawn); lockOn(w, b.id, b.x, b.y, w.t, 'camera'); w.lock.track = { vx: b.vx || 0, vy: b.vy || 0, t: w.t, cam: 'c1' };
  const g0 = w.beacons.green; fireBeacon(w, 'green');
  check(w.seal && w.seal.reason === 'green' && w.beacons.green === g0, 'Firing green asks for the password first');
  sealInput(w, p5);
  check(!w.seal && w.beacons.green === g0 - 1, '...and fires the moment it is accepted');
  // relight asks
  w.furnace.heat = 0.05; for (let i = 0; i < 5; i++) step(w, DT);
  check(!w.furnace.lit, '(the furnace has gone out)');
  light(w);
  check(w.seal && w.seal.reason === 'relight' && !w.furnace.lit, 'Relighting the furnace asks for the password');
  sealInput(w, p5);
  check(w.furnace.lit && !w.seal, '...and lights it once accepted');
  // nodding off logs the operator out
  w.fatigue = 0.999; for (let i = 0; i < 20; i++) { keepFurnace(w); step(w, DT); }
  check(w.seal && w.seal.reason === 'fatigue', 'An operator who nods off is logged out');
  sealInput(w, p5);
  check(!w.seal && w.fatigue <= 0.7, '...and logs back in drowsy, not fresh');
  // five wrong tries reboot the ship; beacons stay
  b.tag = 'red'; w.tags = [b.id]; w.furnace.chute = 3;
  openSeal(w, 'gm');
  for (let i = 0; i < WRONG_TRIES - 1; i++) sealInput(w, 'wrong' + i);
  check(w.seal && w.seal.tries === WRONG_TRIES - 1, 'Four wrong tries and it is still asking');
  check(sealInput(w, 'wrong again') === 'reboot', 'The fifth wrong try reboots the system');
  check(!w.furnace.lit && w.furnace.chute === 0 && SYSTEMS.every(x => !w.power[x].on) && Object.values(w.broken).some(Boolean), 'The reboot: furnace out, chute empty, everything off, something broken');
  check(b.tag === 'red' && w.tags.includes(b.id) && w.seal && w.seal.mode === 'set' && w.password == null, '...beacons stay where they were, and a fresh password must be set');
  gm(w, 'unseal');
  check(!w.seal, 'The GM can unlock it outright');
  // a board flip while the lock is open: either page counts
  const w2 = createWorld(74); light(w2); for (let i = 0; i < 10; i++) step(w2, DT);
  w2.pwCap = 8; runeEffect(w2, 'LOCKDOWN'); w2.pwCap = 8; const pg0 = w2.board.page;
  let flips = 0; while (w2.board.page === pg0 && flips < 50) { w2.board.nextFlip = 0; step(w2, DT); flips++; }
  check(w2.seal.pages.includes(pg0) && w2.seal.pages.includes(w2.board.page), 'A board flip while the lock is open: both pages count for the page rule');
}

// ---------- shots ----------
function shot(seed, { readNear, delay, color = 'green' }) {
  const w = createWorld(seed); light(w);
  for (let i = 0; i < 3000; i++) { if (i % 50 === 0) keepFurnace(w); step(w, DT); }     // 5:00
  ['sonar', 'currents'].forEach(s => setPower(w, s, true));
  for (let i = 0; i < 30; i++) step(w, DT);
  const e = w.bergs.find(b => b.elgarz);
  const dd = dist(e, OBSERVATORY), k = readNear ? Math.min(1, (T.buoyDeployRange - 10) / dd) : 0.25;
  const bx = OBSERVATORY.x + (e.x - OBSERVATORY.x) * k, by = OBSERVATORY.y + (e.y - OBSERVATORY.y) * k;
  deployBuoy(w, readNear ? bx + 40 : bx, readNear ? by + 40 : by);
  for (let i = 0; i < 100; i++) step(w, DT);
  if (!readNear) { const near = { x: OBSERVATORY.x + (e.x - OBSERVATORY.x) * Math.min(1, 1600 / dd), y: OBSERVATORY.y + (e.y - OBSERVATORY.y) * Math.min(1, 1600 / dd) }; deployBuoy(w, near.x, near.y); for (let i = 0; i < 50; i++) step(w, DT); ping(w); for (let i = 0; i < 60; i++) step(w, DT); const c = w.contacts.find(c => c.bergId === 'elgarz'); if (!c) return 'no contact'; lockContact(w, c); deployBuoy(w, bx, by); for (let i = 0; i < 50; i++) step(w, DT); }
  else { ping(w); for (let i = 0; i < 60; i++) step(w, DT); const c = w.contacts.find(c => c.bergId === 'elgarz'); if (!c) return 'no contact'; lockContact(w, c); }
  for (let i = 0; i < delay * 10; i++) step(w, DT);
  fireBeacon(w, color);
  if (w.seal) sealInput(w, VALID3);   // first green: set a password, then it fires
  for (let i = 0; i < 400; i++) { if (i % 50 === 0) keepFurnace(w); step(w, DT); }
  return w.won ? 'win' : e.tag ? 'tag' : 'miss';
}
const good = SEEDS.slice(0, 20).map(s => shot(s, { readNear: true, delay: 8 }));
const farRead = SEEDS.slice(0, 20).map(s => shot(s, { readNear: false, delay: 8 }));
const amber = SEEDS.slice(0, 5).map(s => shot(s, { readNear: true, delay: 8, color: 'orange' }));
console.log(`Careful green shots: ${good.filter(r => r === 'win').length}/20 win · reading far from target: ${farRead.filter(r => r === 'win').length}/20`);
check(good.filter(r => r === 'win').length >= 18, 'A fresh lock with a nearby reading hits Elgarz (18 of 20 seeds), password and all');
check(farRead.filter(r => r === 'win').length <= 10, 'A reading taken far from the target usually misses');
check(amber.every(r => r !== 'win'), 'Only a green beacon wins');

process.exit(failures ? 1 : 0);
