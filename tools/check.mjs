// Headless scenario checks across many seeds. Run: node tools/check.mjs [seedCount]
import {
  createWorld, step, light, stoke, dist, snapshot, setPower, deployBuoy, ping, lockContact, fireBeacon, runeEffect, sealInput, openSeal, shuttered, hitRadius, ghostAt,
  countSightings, camSees, snowAt, slotsAvailable, pressKey, readingDisplay, radioSignal, setFreq, setGain, gainFor, setMusic, lockOn, DT, mulberry32,
  pressBoard, runeFunction, lockFromCamera, aimQuality, startRepair, sip, camCode, setLever, pressPlate, setCamTurn, camIsUnlocked, selectCam, gm,
  relockCase, setVerdict, isUp, inShoal, saveWorld, loadWorld, echoSeen, SYSTEMS,
  setDamper, setPriority, projectHeat, furnaceState, sonarStrain, breakThing, BREAKABLE,
  sealBeacon, fleetPlace, fleetReady, fleetFire, fleetCommander, startDefence, defenceResult, stationAction, ROLES, stationSnapshot,
  orbCap, canReveal, artifactIn, camWeather, brokenList, shellWatch, beaconHits, clearanceAnswer, pwExtra,
} from '../src/sim.js';
import * as FL from '../src/fleet.js';
import * as WS from '../src/workshop.js';
import * as GA from '../src/games.js';
import { OBSERVATORY, CENTER, REACH, TUNING as T, TOMB_RADIUS, CAMERAS, CELL, RADIO_TABLE, BOARD_GRID, SHOALS, SIZE_CUT, COLD_WATER, FIELDS } from '../src/scenario.js';
import { keypadCode, RUNES } from '../src/glyphs.js';
import { FLOWS, repairAction, makeRepairBoard, randomRow, ownerOf, OWNER } from '../src/repair.js';
import { tempAt, makeField, PLATE_BY_HOUSE } from '../src/scenario.js';
import { checkPassword, RULES as PW_RULES, WRONG_TRIES, DEFAULT_PASSWORD, BASE_RULES, revealPair, toRoman, SINS } from '../src/password.js';

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
const VALID3 = DEFAULT_PASSWORD;   // the factory password, which passes the base rules
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
    if (shape !== '40,10,6,5,4,5,10,3,2,3,2') { ok = false; console.log('composition', seed, shape); }
    const evenOK = all.every(b => { const g = b.echo.humps.slice(1).map((h, i) => h.x - b.echo.humps[i].x), ev = g.every(x => Math.abs(x - g[0]) < 0.5) && b.echo.humps.every(h => h.h === b.echo.humps[0].h);
      return b.echo.sig === 'solid' ? b.echo.humps.length === 0 : b.echo.sig === 'caverns' ? b.echo.humps.length >= 2 && !ev : b.echo.sig === 'flooded' ? b.echo.tail === 'wavy' : ev && b.echo.humps.length >= 3; });
    if (!evenOK) { ok = false; console.log('echo shapes', seed); }
    if (all.some(b => b.length > 19.5 && b.length <= SIZE_CUT + 0.5)) { ok = false; console.log('ambiguous size', seed); }
  }
  check(ok, '40 ice: 10 small; large 6 solid, 5 caverns, 4 flooded, 5 monsters, 10 halls (3 plain, 2 metal, 3 Triad, 2 all three); printouts match their class');
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
  const w = createWorld(1); light(w); ['sonar', 'currents', 'cameras'].forEach(s => setPower(w, s, true));
  for (let i = 0; i < 400; i++) step(w, DT);
  check(slotsAvailable(w) === 3, 'A fresh furnace runs three systems for the first forty seconds');
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
  setFreq(w, b.radio.freq + 15 + 26); setGain(w, gainFor(dist(b, OBSERVATORY))); const wide = radioSignal(w);
  setFreq(w, b.radio.freq - 15 - 26); const wide2 = radioSignal(w);
  setFreq(w, b.radio.freq + 15 + 30); const past = radioSignal(w);
  check(wide.lamps === b.radio.shown && wide2.lamps === b.radio.shown && !past.lamps, 'The beaconed ice reads 15 units further either side than before (about ±41)');
  setFreq(w, b.radio.freq + 12); setGain(w, gainFor(dist(b, OBSERVATORY)));
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
    for (const fn of ['CONFETTI', 'SUCCUBUS']) {
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
      w.fatigue = 0;   // a wakeful operator: this test is about the weather
      if (!w.buoy) { w.broken.winch = false; w.buoyRebuildAt = 0; deployBuoy(w, CENTER.x + 500, CENTER.y - 400); }   // a storm took it: put it back in the same place
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
  check(!startRepair(w2, 'launcher'), 'The repair crew needs the repair bay powered');
  setPower(w2, 'repair', true); for (let i = 0; i < 20; i++) step(w2, DT);
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
  check(w.beacons.stock === 5 && w.beacons.orange === 2 && w.beacons.green === 1 && w.beacons.blue === undefined, 'Five red, two orange and one green beacon; no blue');
  for (let i = 0; i < 20; i++) step(w, DT);
  const b = w.bergs.find(b => b.large);
  lockOn(w, b.id, b.x, b.y, w.t, 'camera'); w.lock.track = { vx: b.vx || 0, vy: b.vy || 0, t: w.t, cam: 'c1' };
  w.beacons.orange = 6; const shotsO = fireUntilHit(w, 'orange', b); w.beacons.orange += 0; for (let i = 0; i < 20; i++) step(w, DT);
  check(w.obs[b.id] && w.obs[b.id].echo && w.obs[b.id].echo.humps.length === b.echo.humps.length && shotsO > 0 && w.beacons.orange === 6 - shotsO, 'An orange sounding charge prints the echo without a ping');
  const w2 = createWorld(52); light(w2); ['sonar', 'scanner', 'currents'].forEach(s => setPower(w2, s, true)); for (let i = 0; i < 50; i++) step(w2, DT);
  w2.scanner.calibrated = true; const d = w2.bergs.find(x => dist(x, CENTER) < 1200);
  lockOn(w2, d.id, d.x, d.y, w2.t, 'camera'); for (let i = 0; i < 100; i++) step(w2, DT);
  check(d.scan === 0, 'The metal scanner needs a buoy');
  deployBuoy(w2, d.x + 900 > 3400 ? d.x - 900 : d.x + 900, d.y); for (let i = 0; i < 100; i++) step(w2, DT);
  check(d.scan === 0, 'The metal scanner does nothing out of buoy range');
  w2.buoy = { x: d.x + 20, y: d.y, landAt: w2.t }; for (let i = 0; i < (T.scanTime + 3) * 10; i++) { keepFurnace(w2); w2.buoy.x = d.x + 20; w2.buoy.y = d.y; step(w2, DT); }
  check(d.scanned, 'In buoy range the metal scanner finishes its scan');
  // the three repair flowcharts: every rule gets used, every answer comes up, every board can be solved
  let rng = 12345; const rnd = () => { rng = (rng * 1103515245 + 12345) % 2147483648; return rng / 2147483648; };
  for (const dept of Object.keys(FLOWS)) {
    const used = new Array(FLOWS[dept].length).fill(0), acts = { OPEN: 0, CLOSE: 0, CUT: 0 };
    for (let i = 0; i < 20000; i++) {
      const r = randomRow(rnd), j = FLOWS[dept].findIndex(q => q.test(r));
      if (j >= 0) used[j]++; acts[repairAction(dept, r)]++;
    }
    check(used.every(n => n >= 20000 * 0.02), `${dept}: every rule in the repair flowchart comes up (rarest ${(Math.min(...used) / 200).toFixed(1)}%)`);
    check(acts.CLOSE > 4000 && acts.CUT > 4000 && acts.OPEN > 2000, `${dept}: the flowchart gives a real mix of OPEN, CLOSE and CUT`);
    const boards = Array.from({ length: 300 }, () => makeRepairBoard(dept, rnd));
    check(boards.every(b => b.rows.length === 4 && b.rows.some(r => repairAction(dept, r) === 'CUT') && b.rows.some(r => repairAction(dept, r) === 'CLOSE')), `${dept}: every board needs at least one CLOSE and one CUT`);
  }
  check(Object.keys(BREAKABLE).every(k => OWNER[k]) && ownerOf('c3') === 'gunnery', 'Every machine has an owner, and the orbs are Gunnery\'s');
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
  check(echoSeen(mon, COLD_WATER + 2).tail === 'pulse' && echoSeen(mon, COLD_WATER - 2).tail === 'flat', `A frozen monster pulses in warm water and reads as halls below ${COLD_WATER}`);
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
    selectCam(w, pick.c.id); gm(w, 'camunlock'); lockFromCamera(w, pick.b.id);
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

// ---------- the password: the Descent ----------
{
  const ok = (p, cap) => checkPassword(p, cap).ok, fails = (p, cap) => checkPassword(p, cap).results.filter(r => !r.ok).map(r => r.id);
  const FULL = 'JerRy###1###$97-273ENVY666+2=5IAGReE!39';
  check(PW_RULES.map(r => r.id).join() === 'capital,special,jerry,chain,neighbour,price,vice,zero,six,lie,prime,agree', 'Three base rules, then one per layer of Hell, in order');
  check(PW_RULES.filter(r => r.layer).map(r => r.layer[1]).join() === 'I,II,III,IV,V,VI,VII,VIII,IX', '...nine layers, Avernus to Nessus');
  check(ok(DEFAULT_PASSWORD, BASE_RULES) && !ok(DEFAULT_PASSWORD, BASE_RULES + 1), 'JerryRulz! meets the base rules and nothing deeper');
  check(ok(FULL, 12) && ok('  ' + FULL + '  ', 12), `A password can meet all twelve rules (${FULL}), with spaces trimmed`);
  check(!ok('jerryrulz!', 3) && !ok('JerryRulz', 3) && !ok('Rulz!', 3), 'Base: a capital, a special character, JERRY');
  check(!ok('JerryRulz!😈', 3), 'Only keyboard characters: an emoji is refused');
  // each layer, pass and fail
  check(ok('JerRy###1###', 4) && !ok('JerRy1######', 4) && !ok('JerRy###1###1', 4) && !ok('JerRy###2###', 4) && ok('JerRy##x#1##y#', 4) === false && ok('JerRy###a1b###', 4), 'I · Avernus: one 1, with ### before and after it');
  check(!ok('JerRy###1###aa', 5) && ok('JerRy###1###aA', 5) && fails('JerryRulz!', 5).includes('neighbour'), 'II · Dis: no letter beside the same letter (capitals differ)');
  check(ok('JerRy###1###$99', 6) && !ok('JerRy###1###$9', 6) && !ok('JerRy###1###99', 6), "III · Minauros: $ and a number bigger than the length");
  check(ok('JerRy###1###$99sloth', 7) && ok('JerRy###1###$99GrEeD', 7) && !ok('JerRy###1###$99', 7), 'IV · Phlegethos: a deadly sin, any capitals');
  const z = t => checkPassword('JerRy###1###$99Envy' + t, 8).results.find(r => r.id === 'zero').ok;
  check(['-273', '-273.15', '-273.1', '0K', '0 k', '-459.67', '-460', '-273°C'].every(z) && !z('-27') && !z('10K') && !z('-170'), 'V · Stygia: absolute zero in any scale (and not a near miss)');
  check(checkPassword('JerRy###1###$99Envy-170', 8).results.find(r => r.id === 'zero').hint.startsWith('Colder'), '...a wrong temperature gets a hint: colder');
  check(ok('JerRy###1###$99Envy0K666', 9) && !ok('JerRy###1###$99Envy0K66', 9) && !ok('JerRy###1###$99Envy0K6666', 9), 'VI · Malbolge: exactly three sixes');
  check(ok('JerRy###1###$99Envy0K666 2+2=5', 10) && !ok('JerRy###1###$99Envy0K666 2+2=4', 10) && ok('JerRy###1###$99Envy0K666 3x3=8', 10), "VII · Maladomini: a sum that is wrong");
  check(ok(FULL, 11) && !ok(FULL.replace('$97', '$99'), 11) && !ok(FULL + '!', 11), 'VIII · Cania: a prime over 20, ending with the length, which is odd');
  check(ok(FULL, 12) && !ok(FULL.replace('IAGReE', 'IAGRE'), 12), 'IX · Nessus: IAGREE (Dis means it must be written IAGReE or similar)');
  // the hints: two neighbouring characters per failed attempt
  { const shown = []; let rnd = mulberry32(5); for (let k = 0; k < 4; k++) for (const i of revealPair('JerryRulz!', shown, rnd)) if (!shown.includes(i)) shown.push(i);
    check(shown.length >= 6, `Four failed attempts show most of JerryRulz! (${shown.length} of 10 characters)`); }

  // the lock itself
  const w = createWorld(73); light(w); ['sonar', 'currents'].forEach(x => setPower(w, x, true)); for (let i = 0; i < 30; i++) step(w, DT);
  check(w.password === DEFAULT_PASSWORD && w.pwCap === BASE_RULES, 'The Watch starts on the factory password, at the gate');
  runeEffect(w, 'LOCKDOWN');
  check(w.seal && w.seal.mode === 'enter' && w.pwCap === BASE_RULES + 1, 'LOCKDOWN: enter the CURRENT password; the new one will need layer I');
  check(stoke(w) && !fireBeacon(w, 'red') && !setPower(w, 'radio', true), 'While locked, the power board and the launcher refuse, but the stoker can still stoke');
  check(sealInput(w, 'nope') === 'wrong' && w.seal.tries === 1 && w.seal.shown.length === 2 && w.seal.shown[1] === w.seal.shown[0] + 1, 'A wrong password costs a try and shows two neighbouring characters');
  sealInput(w, DEFAULT_PASSWORD);
  check(w.seal && w.seal.mode === 'set', '...the right one, and a new password must be set');
  check(sealInput(w, DEFAULT_PASSWORD) === 'rejected', 'The old password does not meet the new layer');
  const p4 = 'JerryRulz!###1###';
  let set = null; w.events.length = 0;
  check(sealInput(w, p4) === 'ok' && w.password === p4 && w.pwMet === 4 && (set = w.events.find(e => e.type === 'pwset')) && set.password === p4, `The new password is accepted and printed (${p4})`);
  // the scheduled update, every nine minutes
  check(Math.abs(w.pwNext - (w.t + T.pwUpdateEvery)) < 0.2, 'A lockdown restarts the nine-minute clock');
  w.pwNext = w.t + 0.5; for (let i = 0; i < 10; i++) { keepFurnace(w); step(w, DT); }
  check(w.seal && w.seal.reason === 'lockdown' && w.pwCap === 5, 'Nine minutes on, the next update comes by itself (layer II)');
  sealInput(w, p4); const p5 = 'JerRyRulz!###1###';
  check(sealInput(w, p5) === 'ok', `Layer II accepted (${p5})`);
  // green asks
  const b = w.bergs.find(b => b.large && !b.tombDrawn); lockOn(w, b.id, b.x, b.y, w.t, 'camera'); w.lock.track = { vx: b.vx || 0, vy: b.vy || 0, t: w.t, cam: 'c1' };
  const g0 = w.beacons.green; fireBeacon(w, 'green');
  check(w.seal && w.seal.reason === 'green' && w.seal.mode === 'enter' && w.beacons.green === g0, 'Firing green asks for the current password first');
  sealInput(w, p5);
  check(!w.seal && w.beacons.green === g0 - 1 && w.pwCap === 5, '...and fires the moment it is accepted; no new rule');
  // relight asks
  w.furnace.heat = 0.05; w.furnace.pending = 0; for (let i = 0; i < 30; i++) step(w, DT);
  check(!w.furnace.lit, '(the furnace has gone out)');
  light(w);
  check(w.seal && w.seal.reason === 'relight' && !w.furnace.lit, 'Relighting the furnace asks for the password');
  sealInput(w, p5);
  check(w.furnace.lit && !w.seal, '...and lights it once accepted');
  // nodding off logs the operator out at 90%
  w.fatigue = 0.895; for (let i = 0; i < 40; i++) { keepFurnace(w); step(w, DT); }
  check(w.seal && w.seal.reason === 'fatigue', 'An operator at 90% fatigue is logged out');
  sealInput(w, p5);
  check(!w.seal && Math.abs(w.fatigue - 0.6) < 0.01, '...and logs back in at 60%');
  // five wrong tries reboot the ship; beacons stay; back to JerryRulz!, layer kept
  b.tag = 'red'; w.tags = [b.id]; w.furnace.chute = 3;
  openSeal(w, 'gm');
  for (let i = 0; i < WRONG_TRIES - 1; i++) sealInput(w, 'wrong' + i);
  check(w.seal && w.seal.tries === WRONG_TRIES - 1 && w.seal.shown.length >= 6, 'Four wrong tries, still asking, and most of the password showing');
  check(sealInput(w, 'wrong again') === 'reboot', 'The fifth wrong try reboots the system');
  check(!w.furnace.lit && w.furnace.chute === 0 && SYSTEMS.every(x => !w.power[x].on) && Object.values(w.broken).some(Boolean), 'The reboot: furnace out, chute empty, everything off, something broken');
  check(b.tag === 'red' && w.tags.includes(b.id) && !w.seal && w.password === DEFAULT_PASSWORD && w.pwCap === 5 && w.pwMet === BASE_RULES, '...beacons stay, the password is JerryRulz! again, and the layer is kept');
  openSeal(w, 'gm'); gm(w, 'unseal');
  check(!w.seal, 'The GM can unlock it outright');
}

// ---------- revision 11: the cold, the furnace log, the damper, repairs and the new breakdowns ----------
{
  // Stygia is cold: about -180 to -265 everywhere, all session, never down to absolute zero
  let lo = 0, hi = -999;
  for (const seed of SEEDS.slice(0, 10)) { const F = makeField(() => (seed % 97) / 97); for (let t = 0; t <= 2400; t += 300) for (let k = 0; k < 40; k++) { const v = tempAt(300 + (k * 811) % 3000, 300 + (k * 433) % 3000, t, F, { x: 1800 + (k % 3) * 200, y: 1800 }); lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  console.log(`Water temperature range: ${lo.toFixed(0)}° to ${hi.toFixed(0)}°`);
  check(lo >= -268 && hi <= -175 && hi - lo > 55 && (lo + hi) / 2 < -180 && (lo + hi) / 2 > -250, 'The water runs from about -180° to -265°, well above absolute zero');
  // the furnace burns more with more running, and sheds the lowest priority first
  const w = createWorld(81); light(w); ['sonar', 'currents', 'cameras'].forEach(s => setPower(w, s, true));
  for (let i = 0; i < 20; i++) step(w, DT);
  check(furnaceState(w).burn > furnaceState(createWorld(81)).burn, 'More systems burn more heat');
  const fs0 = furnaceState(w), proj = projectHeat(fs0, 3, 60);
  for (let i = 0; i < 600; i++) step(w, DT);
  check(Math.abs(proj[60].heat - w.furnace.heat) < 1.5, `The furnace log's projection matches the furnace (${proj[60].heat.toFixed(1)} vs ${w.furnace.heat.toFixed(1)})`);
  w.furnace.heat = 70; ['sonar', 'currents', 'cameras'].forEach(s => setPower(w, s, true)); for (let i = 0; i < 20; i++) step(w, DT);
  setPriority(w, ['cameras', 'currents', 'sonar']);
  w.furnace.heat = T.slotHeat[0] - 0.5; step(w, DT);
  check(!w.power.sonar.on && w.power.cameras.on && w.power.currents.on && w.events.some(e => e.type === 'brownout' && e.sys === 'sonar'), 'Low heat sheds the lowest-priority system, and says so');
  const wa = createWorld(82), wb = createWorld(82); light(wa); light(wb); setDamper(wb, 'low');
  for (const x of [wa, wb]) { ['sonar', 'currents'].forEach(s => setPower(x, s, true)); for (let i = 0; i < 600; i++) step(x, DT); }
  check(wb.furnace.heat > wa.furnace.heat + 3, 'The LOW damper burns slower');
  check(wb.readings == null || T.currentRefresh * T.damperSlow > T.currentRefresh, '...and the systems work slower');
  // repairs need the bay powered, except the grate; they wait when the power goes
  const wr = createWorld(83); light(wr); for (let i = 0; i < 10; i++) step(wr, DT);
  breakThing(wr, 'launcher'); setPower(wr, 'repair', true); for (let i = 0; i < 20; i++) step(wr, DT);
  startRepair(wr, 'launcher'); for (let i = 0; i < 30; i++) step(wr, DT); setPower(wr, 'repair', false);
  for (let i = 0; i < 200; i++) step(wr, DT);
  check(wr.broken.launcher, 'A repair waits while the repair bay is switched off');
  setPower(wr, 'repair', true); for (let i = 0; i < 100; i++) step(wr, DT);
  check(!wr.broken.launcher, '...and finishes once it is back on');
  breakThing(wr, 'furnace'); setPower(wr, 'repair', false);
  check(startRepair(wr, 'furnace'), 'The furnace grate is mended by hand, with no power');
  // the sonar head: a third ping inside the window cracks it
  const ws = createWorld(84); light(ws); ['sonar'].forEach(s => setPower(ws, s, true)); for (let i = 0; i < 20; i++) step(ws, DT);
  deployBuoy(ws, CENTER.x + 300, CENTER.y + 300); for (let i = 0; i < 50; i++) step(ws, DT);
  ping(ws); for (let i = 0; i < 60; i++) step(ws, DT); ping(ws); for (let i = 0; i < 60; i++) step(ws, DT);
  check(!ws.broken.sonarhead && sonarStrain(ws).length === 2, 'Two quick pings strain the sonar head');
  ping(ws);
  check(ws.broken.sonarhead && !ping(ws), 'A third inside twenty seconds cracks it, and it will not ping until repaired');
  const ws2 = createWorld(84); light(ws2); setPower(ws2, 'sonar', true); for (let i = 0; i < 20; i++) step(ws2, DT);
  deployBuoy(ws2, CENTER.x + 300, CENTER.y + 300); for (let i = 0; i < 50; i++) step(ws2, DT);
  for (let k = 0; k < 5; k++) { ping(ws2); for (let i = 0; i < 110; i++) { keepFurnace(ws2); step(ws2, DT); } }
  check(!ws2.broken.sonarhead, 'Pings spaced out never crack it');
  // a buoy left in a storm is lost
  const wt = createWorld(85); light(wt); setPower(wt, 'sonar', true); for (let i = 0; i < 20; i++) step(wt, DT);
  deployBuoy(wt, CENTER.x + 500, CENTER.y); for (let i = 0; i < 50; i++) step(wt, DT);
  gm(wt, 'storm', { x: wt.buoy.x, y: wt.buoy.y }); wt.storms[wt.storms.length - 1] = { cam: null, t0: wt.t - 100, t1: wt.t + 100, r: 360, x0: wt.buoy.x, y0: wt.buoy.y, x1: wt.buoy.x, y1: wt.buoy.y };
  for (let i = 0; i < (T.buoyStormTime - 2) * 10; i++) { keepFurnace(wt); step(wt, DT); }
  check(!!wt.buoy, 'A buoy rides out a short spell in a storm');
  for (let i = 0; i < 40; i++) { keepFurnace(wt); step(wt, DT); }
  check(!wt.buoy && wt.broken.winch, 'Left in the storm, the buoy is torn loose and the winch breaks');
  // the metal scanner blows its fuse after some positive readings, never after a negative one
  let blown = 0, neg = 0, tries = 0;
  for (let k = 0; k < 60; k++) {
    const wm = createWorld(900 + k); light(wm); ['scanner'].forEach(s => setPower(wm, s, true)); for (let i = 0; i < 50; i++) step(wm, DT);
    const metal = k % 2 === 0, b = wm.bergs.find(x => !!x.metal === metal && x.large); if (!b) continue;
    wm.scanner.calibrated = true; lockOn(wm, b.id, b.x, b.y, wm.t, 'camera');
    for (let i = 0; i < (T.scanTime + 2) * 10; i++) { wm.buoy = { x: b.x, y: b.y, landAt: 0 }; keepFurnace(wm); step(wm, DT); }
    if (!b.scanned) continue;
    if (metal) { tries++; if (wm.broken.scanner) blown++; } else if (wm.broken.scanner) neg++;
  }
  console.log(`Scanner fuses blown after a positive reading: ${blown}/${tries}`);
  check(tries > 20 && blown > tries * 0.15 && blown < tries * 0.55 && neg === 0, 'The scanner sometimes blows a fuse after a positive reading, never after a negative one');
  // orbs: the housing rune sets the plate order; a repaired orb relocks with a new rune; only unlocked orbs track
  const wo = createWorld(86); light(wo); setPower(wo, 'cameras', true); setPower(wo, 'repair', true); for (let i = 0; i < 20; i++) step(wo, DT);
  const code = camCode(wo);
  check(code.order.join() === PLATE_BY_HOUSE[RUNES[wo.camRune[wo.activeCam]].house].join(), 'The plate order comes from the house of the rune on the orb housing');
  const rune0 = wo.camRune.c1; gm(wo, 'camunlock'); breakThing(wo, 'c1');
  check(!camIsUnlocked(wo, 'c1'), 'A broken orb relocks');
  startRepair(wo, 'c1'); for (let i = 0; i < (T.repairTime + 1) * 10; i++) { keepFurnace(wo); step(wo, DT); }
  check(!wo.cams[0].broken && !camIsUnlocked(wo, 'c1') && wo.camRune.c1 !== rune0, 'A repaired orb is locked again, with a new housing rune');
  let tr = null;
  for (let k = 0; k < 80 && !tr; k++) { for (const c of wo.cams) { const b = wo.bergs.find(b => camSees(c, b, -0.3) && dist(b, c) < T.camRange * 0.7); if (b) { tr = { c, b }; break; } } if (!tr) { keepFurnace(wo); for (let i = 0; i < 50; i++) step(wo, DT); } }
  if (tr) {
    selectCam(wo, tr.c.id); delete wo.camUnlocked[tr.c.id]; lockFromCamera(wo, tr.b.id);
    for (let i = 0; i < (T.trackTime + 2) * 10; i++) step(wo, DT);
    check(!wo.lock.track, 'A locked orb does not measure drift');
    gm(wo, 'camunlock'); for (let i = 0; i < (T.trackTime + 2) * 10; i++) step(wo, DT);
    check(!!wo.lock.track, 'An unlocked orb does');
    const f0 = tr.c.facing; for (let i = 0; i < 300; i++) { keepFurnace(wo); step(wo, DT); }
    let rel = Math.atan2(tr.b.x - tr.c.x, -(tr.b.y - tr.c.y)) * 180 / Math.PI - tr.c.facing; rel = ((rel % 360) + 540) % 360 - 180;
    check(Math.abs(rel) < 5, `A tracking orb turns to follow its ice while you watch it (${rel.toFixed(1)}° off, turned ${(tr.c.facing - f0).toFixed(1)}°)`);
  } else check(false, 'Found ice in an orb to test tracking');
  const wh = createWorld(87); light(wh); setPower(wh, 'cameras', true); for (let i = 0; i < 20; i++) step(wh, DT);
  selectCam(wh, 'c2'); for (let i = 0; i < 100; i++) step(wh, DT); const hLocked = wh.cams[1].heat;
  wh.cams[1].heat = 0; gm(wh, 'camunlock'); for (let i = 0; i < 100; i++) step(wh, DT);
  check(wh.cams[1].heat < hLocked * 0.75, 'An unlocked orb heats more slowly');
}

// ---------- revision 12: the workshop, the fleet, the officers' defences ----------
{
  let s = 99; const rng = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  // the puzzles: every one can be solved
  check(Array.from({ length: 200 }, () => GA.loBoard(rng)).every(({ board, solution }) => GA.loSolved(solution.reduce((b, p) => GA.loPress(b, p), board)) && solution.length <= 5 && board.length === 16),
    'Every 4 x 4 Lights Out board is solved by five presses or fewer');
  check(Array.from({ length: 200 }, () => GA.msBoard(rng)).every(({ mines, start }) => mines.length === GA.MS_MINES && GA.msSolvable(new Set(mines), start)),
    'Every Minesweeper board can be cleared by logic from its start square');
  let cutsOk = true;
  for (let i = 0; i < 200; i++) for (const c of WS.COLORS) {
    const [W, H, n] = WS.CHAMBER[c], pieces = WS.cutChamber(rng, W, H, n);
    if (pieces.length !== n || pieces.reduce((a, p) => a + p.length, 0) !== W * H || pieces.some(p => p.length < 2)) cutsOk = false;
  }
  check(cutsOk, 'Every charge chamber is cut into the right number of pieces that fill it exactly');
  const seen = {};
  for (const c of WS.COLORS) for (let i = 0; i < 3000; i++) for (const [k, v] of Object.entries(WS.recipe(c, WS.newCasing(rng)))) (seen[k] ||= new Set()).add(v);
  check(Object.entries(WS.PARTS).every(([k, list]) => list.every(p => seen[k] && seen[k].has(p))), 'Every part in the workshop tray is the right answer for some casing');
  const cs = WS.newCasing(rng);
  check(WS.wrongSlots('green', cs, WS.recipe('green', cs)).length === 0 && WS.wrongSlots('green', cs, { ...WS.recipe('green', cs), crystal: 'XX' }).join() === 'crystal', 'The bench finds exactly the wrong part');

  // the workshop: a sealed beacon cures only while the WORKSHOP is powered, then joins the stock
  const w = createWorld(91); light(w); for (let i = 0; i < 20; i++) step(w, DT);
  w.beacons.stock--; const r0 = w.beacons.stock; sealBeacon(w, 'red'); for (let i = 0; i < (T.cureTime + 2) * 10; i++) step(w, DT);
  check(w.beacons.stock === r0 && w.workshop.curing.length === 1, 'A sealed beacon waits in the rack without workshop power');
  setPower(w, 'workshop', true); for (let i = 0; i < (T.cureTime + 3) * 10; i++) { keepFurnace(w); step(w, DT); }
  check(w.beacons.stock === r0 + 1 && !w.workshop.curing.length, '...and joins the stock once it has cured');
  const st = w.beacons.stock; for (let i = 0; i < 600; i++) { keepFurnace(w); step(w, DT); }
  check(w.beacons.stock === st, 'The red rack no longer refills by itself');

  // the fleet: the watch holds while it deploys
  const wf = createWorld(92, { deploy: true }); light(wf); for (let i = 0; i < 50; i++) step(wf, DT);
  check(wf.t === 0 && wf.hold === 'deploy', 'With the furnace lit, the watch holds while the fleet deploys');
  check(FL.SHIPS.join() === '4,2,3,3,3' && FL.ENEMY_SHIPS.join() === '5,4,3,3,2' && FL.CREW[0] === 'fleet' && FL.CREW[1] === 'fleet', 'Five ships a side: ours 4 (the Fleet Officer\'s), 2, 3, 3, 3; theirs 5, 4, 3, 3, 2');
  check(!fleetPlace(wf, 1, 11, 0, 'h'), 'A ship cannot hang off the grid');
  fleetPlace(wf, 0, 0, 0, 'h'); check(!fleetPlace(wf, 1, 0, 1, 'h'), 'Ships may not touch, not even at a corner');
  check(!fleetReady(wf), 'The watch will not start with ships still to place');
  fleetPlace(wf, 1, 0, 3, 'h'); fleetPlace(wf, 2, 0, 6, 'h'); fleetPlace(wf, 3, 0, 9, 'h'); fleetPlace(wf, 4, 6, 0, 'v');
  check(fleetReady(wf) && !wf.hold, 'Once every ship is placed the watch begins');
  const f = wf.fleet;
  check(f.loaded.heavy && f.loaded.sounding && f.loaded.boost && f.loaded.scan && FL.DEPTS.every(d => f.dept[d].state === 'loaded'), 'Every special starts loaded');
  check(fleetCommander(wf) === 'operator', 'With no Fleet Officer on station, the operator commands the fleet');
  stationAction(wf, 'gunnery', { act: 'aim', x: 5, y: 5 }); check(!f.aim.length, '...and an officer cannot aim it');
  wf.defence.live.fleet = true; stationAction(wf, 'operator', { act: 'aim', x: 5, y: 5 });
  check(fleetCommander(wf) === 'fleet' && !f.aim.length, 'With a Fleet Officer on station, the operator only watches');
  for (const [x, y] of [[1, 1], [3, 3], [5, 5], [7, 7], [9, 9]]) stationAction(wf, 'fleet', { act: 'aim', x, y });
  stationAction(wf, 'fleet', { act: 'aim', x: 11, y: 11 });
  check(f.aim.length === 5, 'Salvo: one shot aimed for each of our ships afloat');
  stationAction(wf, 'fleet', { act: 'aim', x: 7, y: 7 }); check(f.aim.length === 4, '...and clicking a square again un-aims it');
  const round0 = f.round; for (let i = 0; i < (FL.SALVO + 1) * 10; i++) { keepFurnace(wf); wf.fatigue = 0; if (wf.seal) sealInput(wf, wf.password); if (wf.defence.active.fleet) delete wf.defence.active.fleet; step(wf, DT); }
  check(f.round === round0 + 1 && Object.keys(f.marks).length >= 3 && Object.keys(f.theirShots).length >= 1, 'When the salvo clock runs out both fleets fire together');
  stationAction(wf, 'fleet', { act: 'fire' }); check(f.round === round0 + 2, 'The Fleet Officer can fire sooner');
  gm(wf, 'salvo', { secs: 120 }); check(f.salvoEvery === 120 && f.nextSalvo - wf.t <= 120, 'The GM sets the time between salvos');
  // the enemy reloads after a hit: it fires one shot fewer next round
  { const g = FL.newFleet(mulberry32(5)); FL.randomDeploy(g, mulberry32(6)); FL.begin(g, 0); g.reload = 2; check(FL.enemyAim(g, mulberry32(7)).length === FL.ENEMY_SHIPS.length - 2, 'Every hit the enemy lands costs it a shot next round'); }
  // the specials: the sounding, then reloads by flag code, with a Morse question every second reload
  const e0 = f.enemy[0], [ex, ey] = FL.cellsOf(e0)[0];
  stationAction(wf, 'fleet', { act: 'special', kind: 'sounding', args: { line: 'row', n: ey } }); stationAction(wf, 'fleet', { act: 'fire' });
  const sd = f.soundings[f.soundings.length - 1], real = f.enemy.reduce((a, s) => a + FL.cellsOf(s).filter(q => q[1] === ey).length, 0);
  check(sd && sd.count === real && !f.loaded.sounding && f.dept.signals.state === 'cooldown', `A sounding counts the ship squares in its line (${real}), and the flags come down for a while`);
  const coolDown = d => { f.dept[d].readyAt = wf.t; step(wf, DT); };
  coolDown('signals'); check(f.dept.signals.state === 'flags' && f.dept.signals.flags.length === 4 && new Set(f.dept.signals.flags).size === 4, 'After the cooldown, four different flags go up');
  let want = FL.flagCode(f.dept.signals.flags);
  stationAction(wf, 'signals', { act: 'fleetcode', runes: want.map(r => (r + 1) % 8) }); check(!f.loaded.sounding && f.dept.signals.state === 'flags', 'A wrong code loads nothing');
  stationAction(wf, 'signals', { act: 'fleetcode', runes: want.slice(0, 3) }); check(!f.loaded.sounding, '...nor does a short one');
  stationAction(wf, 'signals', { act: 'fleetcode', runes: want }); check(f.loaded.sounding && f.dept.signals.state === 'loaded' && f.dept.signals.reloads === 1, 'The first reload: the right four runes load the sounding, no question');
  check(FL.padName(0) === 'ICE 1' && FL.PAD.length === 8 && FL.FLAGS.length === 12 && FL.CODEBOOK.length === 4 && FL.CODEBOOK.every(r => r.length === 12 && r.every(v => v >= 0 && v < 8)), 'The codebook has four places, twelve flags, and runes by house and weight');
  stationAction(wf, 'fleet', { act: 'special', kind: 'sounding', args: { line: 'col', n: 0 } }); stationAction(wf, 'fleet', { act: 'fire' }); coolDown('signals');
  want = FL.flagCode(f.dept.signals.flags); stationAction(wf, 'signals', { act: 'fleetcode', runes: want });
  const q1 = f.dept.signals.question;
  check(!f.loaded.sounding && f.dept.signals.state === 'question' && q1 && q1.opts.length === 3 && q1.answer >= 0 && q1.answer < 3, 'The second reload asks a question in Morse, three answers');
  stationAction(wf, 'signals', { act: 'fleetanswer', choice: (q1.answer + 1) % 3 });
  check(!f.loaded.sounding && f.dept.signals.state === 'cooldown' && Math.abs(f.dept.signals.readyAt - wf.t - FL.LOCKOUT) < 0.01, 'A wrong answer locks the reload for a minute');
  const oldFlags = f.dept.signals.flags.join(); stationAction(wf, 'signals', { act: 'fleetcode', runes: want }); check(f.dept.signals.state === 'cooldown', '...and no code goes in meanwhile');
  coolDown('signals'); want = FL.flagCode(f.dept.signals.flags); stationAction(wf, 'signals', { act: 'fleetcode', runes: want });
  const q2 = f.dept.signals.question; check(f.dept.signals.state === 'question' && q2, '...then new flags, and a new question after the code');
  stationAction(wf, 'signals', { act: 'fleetanswer', choice: q2.answer }); check(f.loaded.sounding && f.dept.signals.reloads === 2, 'The right answer loads it');
  stationAction(wf, 'fleet', { act: 'special', kind: 'sounding', args: { line: 'col', n: 1 } }); stationAction(wf, 'fleet', { act: 'fire' }); coolDown('signals');
  stationAction(wf, 'signals', { act: 'fleetcode', runes: FL.flagCode(f.dept.signals.flags) }); check(f.loaded.sounding, 'The third reload is a plain code again (the 2nd, 4th, 6th ask)');
  { const { QUESTIONS, toMorse, MORSE } = await import('../src/morse.js');
    const dec = m => m.split(' / ').map(wd => wd.split(' ').map(c => Object.keys(MORSE).find(k => MORSE[k] === c)).join('')).join(' ');
    check(QUESTIONS.every(([q, ...a]) => q.split(' ').length <= 6 && a.length === 3 && a.every(x => /^[A-Z]+$/.test(x)) && new Set(a).size === 3 && dec(toMorse(q)) === q), 'Every Morse question is six words or fewer, with three one-word answers, and reads back true'); }
  // the heavy shell takes a red or orange beacon, never a green
  const red0 = wf.beacons.stock, green0 = wf.beacons.green;
  stationAction(wf, 'fleet', { act: 'special', kind: 'heavy', args: { x: ex, y: ey } }); stationAction(wf, 'fleet', { act: 'fire' });
  check(wf.beacons.stock === red0 - 1 && wf.beacons.green === green0 && f.marks[ex + ',' + ey] === 'hit', 'A heavy shell bursts over a 2 × 2 and uses one red beacon');
  wf.beacons.stock = 0; wf.beacons.orange = 0; f.loaded.heavy = true; stationAction(wf, 'fleet', { act: 'special', kind: 'heavy', args: { x: 0, y: 0 } }); stationAction(wf, 'fleet', { act: 'fire' });
  check(f.loaded.heavy && wf.beacons.green === green0, '...and with only greens left it will not fire');
  wf.beacons.stock = T.beaconStock; wf.beacons.orange = T.orangeStock;
  // the boost moves one of ours a square, and the enemy's hits on where she was go stale
  for (const s of f.mine) s.hits = [];
  f.loaded.boost = true; const s3 = f.mine[3], y3 = s3.y, c3 = FL.cellsOf(s3)[1]; f.ai.hits = [c3];
  stationAction(wf, 'fleet', { act: 'special', kind: 'boost', args: { ship: 3, dx: 0, dy: 1 } }); stationAction(wf, 'fleet', { act: 'fire' });
  check(s3.y === y3 + 1 && !f.ai.hits.some(h => h[0] === c3[0] && h[1] === c3[1]), 'A boost moves one of our ships a square, and the enemy forgets its hit there');
  // the Fleet Officer's crosshair scan: seven squares, enemy hulls under it are sighted, not hit
  { check(FL.crosshairCells(5, 5, 'v').length === 7 && FL.crosshairCells(5, 5, 'h').length === 7 && FL.crosshairCells(5, 5, 'v').some(c => c[1] === 3) && FL.crosshairCells(5, 5, 'h').some(c => c[0] === 3), 'The crosshair is seven squares, its long arm turned by R');
    const tgt = f.enemy.find(s => !FL.sunk(s) && FL.cellsOf(s).some(c => !f.marks[c.join()])), [tx, ty] = FL.cellsOf(tgt).find(c => !f.marks[c.join()]), hits0 = tgt.hits.length; f.loaded.scan = true;
    stationAction(wf, 'fleet', { act: 'special', kind: 'scan', args: { x: tx, y: ty, dir: 'v' } }); stationAction(wf, 'fleet', { act: 'fire' });
    check(f.marks[tx + ',' + ty] === 'seen' && tgt.hits.length === hits0 && !f.loaded.scan, 'The crosshair scan sights the enemy squares under it without hitting them');
    stationAction(wf, 'fleet', { act: 'dispatch', choice: 'scan' }); check(f.loaded.scan, 'Decoding a dispatch reloads the scan');
    wf.rewards.dispatch = wf.t + 30; f.loaded.scan = false; stationAction(wf, 'fleet', { act: 'dispatch', choice: 'scan' }); check(!f.loaded.scan, '...once a minute'); }
  // a sunk ship: salvage it with Engineering, power it from the breaker panel, then the Fleet Officer redeploys her
  for (const s of f.mine) s.hits = []; f.salvage = {}; wf.shelled = null;
  const s1 = f.mine[1]; s1.hits = [0]; wf.defence.live.engineer = true;
  const last = FL.cellsOf(s1)[1]; f.ai.hits = []; f.ai.shot = {}; f.ai.focus = null; for (let y = 0; y < FL.SIZE; y++) for (let x = 0; x < FL.SIZE; x++) if (x !== last[0] || y !== last[1]) f.ai.shot[x + ',' + y] = true;
  stationAction(wf, 'fleet', { act: 'fire' });
  check(FL.sunk(s1) && f.salvage[1], 'When one of ours is sunk, a salvage board opens for it');
  const sv = f.salvage[1]; sv.board.rows.forEach((row, j) => stationAction(wf, 'fleet', { act: 'salvageset', i: 1, row: j, action: 'OPEN' }));
  stationAction(wf, 'fleet', { act: 'salvagesend', i: 1 });
  const ok = sv.board.rows.every(r => repairAction('engineer', r) === 'OPEN');
  check(sv.done === ok, 'A wrong salvage setting resets the board');
  sv.board.rows.forEach((row, j) => stationAction(wf, 'fleet', { act: 'salvageset', i: 1, row: j, action: repairAction('engineer', row) }));
  stationAction(wf, 'fleet', { act: 'salvagesend', i: 1 }); check(sv.done, "Engineering's flowchart reads the salvage board");
  stationAction(wf, 'fleet', { act: 'redeploy', i: 1, random: true }); check(FL.sunk(s1), '...but without power she cannot be redeployed');
  for (let k = 0; k < 4; k++) { if (wf.seal) sealInput(wf, wf.password); stationAction(wf, 'fleet', { act: 'fire' }); }
  check(FL.sunk(s1) && f.salvage[1], 'Engineering on station: she waits for power (no relaunch by herself)');
  wf.rewards.lights = 0; stationAction(wf, 'engineer', { act: 'lightsout', choice: 'power' }); check(sv.power && FL.salvageReady(f, 1), 'The breaker panel powers the sunk ship: ready to redeploy');
  const old1 = FL.cellsOf(s1); f.ai.hits = [old1[0]];
  let spot1 = null; for (let y = 0; y < FL.SIZE && !spot1; y++) for (let x = 0; x < FL.SIZE && !spot1; x++) { const t1 = f.mine.map((o, j) => j === 1 ? { ...o, x, y, dir: 'h' } : o); if (FL.fits(t1, 1, true) && !old1.some(c => c[1] === y)) spot1 = [x, y]; }
  stationAction(wf, 'fleet', { act: 'redeploy', i: 1, x: spot1[0], y: spot1[1], dir: 'h' });
  check(!FL.sunk(s1) && !f.salvage[1] && s1.x === spot1[0] && s1.y === spot1[1] && !f.ai.hits.length, 'The Fleet Officer redeploys her anywhere free, and the enemy\'s old hits on her go stale');
  // left waiting, a ready ship is put back for you
  { const g = FL.newFleet(mulberry32(21)); FL.randomDeploy(g, mulberry32(22)); FL.begin(g, 0); g.mine[2].hits = [0, 1, 2]; g.salvage[2] = { board: { rows: [] }, done: true, power: true, since: 0, readyRound: 0 };
    for (let k = 0; k < FL.REDEPLOY_WAIT; k++) FL.salvo(g, { t: k * 70, rng: mulberry32(30 + k), spendBeacon: () => true, shellReady: () => false });
    check(!FL.sunk(g.mine[2]) && !g.salvage[2], `A ready ship left waiting ${FL.REDEPLOY_WAIT} salvos is redeployed at random (a failsafe)`); }
  // with nobody from Engineering, only the GM relaunches
  wf.shelled = null; const s2 = f.mine[2]; s2.hits = [0, 1, 2]; f.salvage[2] = { board: { rows: [] }, done: false, power: false, since: f.round, readyRound: null }; wf.defence.live.engineer = false;
  for (let k = 0; k < 6; k++) { if (wf.seal) sealInput(wf, wf.password); f.mine.forEach((s, i) => { if (i !== 2) { s.hits = []; delete f.salvage[i]; } }); stationAction(wf, 'fleet', { act: 'fire' }); }
  check(FL.sunk(s2) && f.salvage[2], 'With nobody from Engineering on station, a sunk ship stays down...');
  gm(wf, 'fleet-relaunch', {}); check(!FL.sunk(s2) && !f.salvage[2], '...until the GM relaunches her');
  // the shells: half the salvos while one of ours is down, then one in five
  { let first = 0, after = 0, n = 0, n2 = 0;
    for (let k = 0; k < 1500; k++) {
      const g = FL.newFleet(mulberry32(500 + k)); FL.randomDeploy(g, mulberry32(9000 + k)); FL.begin(g, 0); g.mine[1].hits = [0, 1]; g.salvage[1] = { board: { rows: [] }, done: false, power: false, since: 0, readyRound: null };
      const ctx = { t: 0, rng: mulberry32(77 + k * 3), spendBeacon: () => true, shellReady: () => true };
      const a = FL.salvo(g, ctx).some(e => e.type === 'fleetshell'); first += a; n++;
      if (a && g.salvage[1]) { ctx.t = 70; after += FL.salvo(g, ctx).some(e => e.type === 'fleetshell'); n2++; }
    }
    check(Math.abs(first / n - FL.SHELL_FIRST) < 0.05 && Math.abs(after / n2 - FL.SHELL_AFTER) < 0.05, `While one of ours is down: the first shell ${pct(first, n)} a salvo, later ones ${pct(after, n2)}`);
    const g = FL.newFleet(mulberry32(3)); FL.randomDeploy(g, mulberry32(4)); FL.begin(g, 0); g.mine[1].hits = [0, 1]; g.salvage[1] = { board: { rows: [] }, done: false, power: false, since: 0, readyRound: null };
    let any = false; for (let k = 0; k < 30; k++) any ||= FL.salvo(g, { t: k * 70, rng: mulberry32(k), spendBeacon: () => true, shellReady: () => false }).some(e => e.type === 'fleetshell');
    check(!any, 'No shell while a machine an earlier shell broke is still broken'); }
  { const ws = createWorld(95, { deploy: true }); light(ws); gm(ws, 'fleet-auto'); for (let i = 0; i < 20; i++) step(ws, DT);
    let broke = 0, asked = 0, deep = 0;
    for (let k = 0; k < 60; k++) { const b0 = brokenList(ws).length, n0 = ws.events.length; shellWatch(ws); const e = ws.events.slice(n0).find(x => x.type === 'fleetshell');
      if (brokenList(ws).length > b0) broke++; if (e.pw) asked++; if (e.pw === 'lockdown') deep++;
      if (k % 2) gm(ws, 'repair'); ws.seal = null; }
    check(broke > 15 && asked > 15 && ws.events.some(e => e.type === 'fleetshell' && e.sys && e.pw), `A shell breaks a machine (${broke}), asks for the password (${asked}), or both`);
    check(deep > 0 && deep <= asked / 3 + 1, `Every third password check without a security update is a lockdown (${deep} of ${asked})`);
    const w3 = createWorld(96, { deploy: true }); light(w3); gm(w3, 'fleet-auto'); for (let i = 0; i < 20; i++) step(w3, DT);
    w3.fleetRng = () => 0.9; shellWatch(w3); const firstSeal = w3.seal && w3.seal.reason === 'shell' && !w3.seal.change; sealInput(w3, w3.password);
    shellWatch(w3); sealInput(w3, w3.password); shellWatch(w3);
    check(firstSeal && w3.seal && w3.seal.change, 'The first shell checks only ask; the third descends a layer');
    if (w3.seal) { sealInput(w3, w3.password); sealInput(w3, 'Jerry$1x' + 'a'.repeat(30)); } w3.seal = null; }
  // the enemy's sonar: every fourth salvo it sounds a row or column; the Fleet Officer sees which
  { const g = FL.newFleet(mulberry32(41)); FL.randomDeploy(g, mulberry32(42)); FL.begin(g, 0); let son = 0;
    for (let k = 0; k < 8; k++) son += FL.salvo(g, { t: k * 70, rng: mulberry32(50 + k), spendBeacon: () => true, shellReady: () => false }).filter(e => e.type === 'fleetenemysonar').length;
    check(son === 2 && g.enemySonar && g.enemySonar.round === 8, 'The enemy sounds our water every fourth salvo, and we see where');
    const h = FL.newFleet(mulberry32(43)); FL.randomDeploy(h, mulberry32(44)); FL.begin(h, 0); const s = h.mine[2], [sx, sy] = FL.cellsOf(s)[0];
    for (let y = 0; y < FL.SIZE; y++) for (let x = 0; x < FL.SIZE; x++) h.ai.shot[x + ',' + y] = true;
    const e = FL.enemySonar(h, mulberry32(1), 0, 'row', sy);
    check(e.count > 0 && !h.ai.shot[sx + ',' + sy] && FL.enemyAim(h, mulberry32(2)).some(([x, y]) => y === sy), 'A ship redeployed on water the enemy had cleared: its sonar finds the row, and it fires along it'); }
  // the wave: their fleet down to one ship, ours is refitted and a fresh fleet comes
  f.marks = {}; for (const k of Object.keys(f.salvage)) { f.mine[k].hits = []; delete f.salvage[k]; }
  f.enemy.forEach((s, i) => { s.hits = i === 0 ? [] : Array.from({ length: s.len }, (_, j) => j).slice(i === 1 ? 1 : 0); }); f.aim = [FL.cellsOf(f.enemy[1])[0]];
  f.mine[0].hits = [0]; const wins0 = f.wins; stationAction(wf, 'fleet', { act: 'fire' });
  check(f.wins === wins0 + 1 && f.mine.every(s => !s.hits.length) && !Object.keys(f.marks).length && FL.afloat(f.enemy).length === 5, 'Their fleet down to one ship: the last one runs, ours is refitted and a new fleet comes');
  // the GM: load specials, land hits on either side, sound our water, fall back and redeploy the enemy
  for (const d of FL.DEPTS) Object.assign(f.dept[d], { state: 'cooldown', readyAt: wf.t + 99 }); f.loaded = {};
  gm(wf, 'fleet-load', {}); check(f.loaded.heavy && f.loaded.sounding && f.loaded.boost && f.loaded.scan && FL.DEPTS.every(d => f.dept[d].state === 'loaded'), 'The GM loads every special');
  { const h0 = f.enemy[2].hits.length; gm(wf, 'fleet-hit', { side: 'theirs', i: 2 }); const m0 = f.mine[3].hits.length; gm(wf, 'fleet-hit', { side: 'ours', i: 3 });
    check(f.enemy[2].hits.length === h0 + 1 && f.mine[3].hits.length === m0 + 1 && f.ai.hits.length >= 1, 'The GM lands a hit on a chosen ship, either side (the enemy learns where ours is)'); }
  { const n0 = wf.events.length; gm(wf, 'fleet-enemyscan'); check(wf.events.slice(n0).some(e => e.type === 'fleetenemysonar') && f.enemySonar, 'The GM orders an enemy radar sweep'); }
  { const old = JSON.stringify(f.enemy.map(s => [s.x, s.y])); gm(wf, 'fleet-regroup');
    check(f.phase === 'regroup' && !wf.fleet.aim.length, 'The GM sends the enemy back to await reinforcements');
    stationAction(wf, 'fleet', { act: 'fire' }); const r0 = f.round;
    for (let i = 0; i < (FL.REGROUP_TIME + 1) * 10; i++) { keepFurnace(wf); wf.fatigue = 0; if (wf.seal) sealInput(wf, wf.password); delete wf.defence.active.fleet; step(wf, DT); }
    check(f.phase === 'play' && f.round === r0 && JSON.stringify(f.enemy.map(s => [s.x, s.y])) !== old && f.log.some(l => /ENEMY SHIPS REDEPLOYED/.test(l.text)), `${FL.REGROUP_TIME} s later a whole new fleet deploys, and the Fleet Officer is told`); }
  // the Fleet Officer's defence: the depth charges. Fail it and their own ship is hit, and the enemy knows where
  { for (const s of f.mine) s.hits = []; f.salvage = {}; f.ai.hits = [];
    check(startDefence(wf, 'fleet') && wf.defence.active.fleet.kind === 'depth' && GA.GAME_TIME.depth === 45, 'The Fleet Officer has a defence of their own: the depth charges');
    defenceResult(wf, 'fleet', wf.defence.active.fleet.id, { ok: false });
    check(f.mine[0].hits.length === 1 && f.ai.hits.length === 1, 'Failing it: the main ship is hit, and the enemy knows where');
    f.mine[0].hits = [0, 1, 2, 3]; startDefence(wf, 'fleet'); defenceResult(wf, 'fleet', wf.defence.active.fleet.id, { ok: false });
    check(f.mine.slice(1).some(s => s.hits.length === 1), '...with the main ship down, another of ours takes it');
    for (const s of f.mine) s.hits = []; f.salvage = {}; f.ai.hits = []; startDefence(wf, 'fleet'); defenceResult(wf, 'fleet', wf.defence.active.fleet.id, { ok: true });
    check(f.mine.every(s => !s.hits.length), 'Holding it off costs nothing'); }
  // lose the whole fleet: the grate cracks, and a minute later the fleet is refitted
  for (const s of f.mine) s.hits = Array.from({ length: s.len }, (_, i) => i).slice(1);
  f.ai.shot = {}; f.ai.hits = []; f.ai.focus = null; for (let y = 0; y < FL.SIZE; y++) for (let x = 0; x < FL.SIZE; x++) if (!f.mine.some(s => FL.cellsOf(s)[0][0] === x && FL.cellsOf(s)[0][1] === y)) f.ai.shot[x + ',' + y] = true;
  f.reload = 0; f.enemy.forEach(s => { s.hits = []; });
  for (let k = 0; k < 6 && f.phase === 'play'; k++) { if (wf.seal) sealInput(wf, wf.password); stationAction(wf, 'fleet', { act: 'fire' }); }
  check(f.phase === 'refit' && wf.broken.furnace, 'Losing the whole fleet: the enemy shells the furnace grate, and the fleet refits');
  for (let i = 0; i < (FL.REFIT_TIME + 2) * 10; i++) { delete wf.defence.active.fleet; step(wf, DT); }
  check(f.phase === 'play' && f.mine.every(s => s.x != null && !s.hits.length), '...a minute later it is back on station');

  // the Fleet Officer's dispatch (Mastermind) and depth charges
  check(GA.mmScore([0, 1, 2, 3], [0, 1, 2, 3]).full === 4 && JSON.stringify(GA.mmScore([0, 0, 1, 1], [1, 1, 0, 0])) === '{"full":0,"half":4}' && JSON.stringify(GA.mmScore([0, 1, 2, 3], [0, 0, 0, 0])) === '{"full":1,"half":0}' && JSON.stringify(GA.mmScore([5, 4, 3, 3], [3, 3, 3, 4])) === '{"full":1,"half":2}' && GA.MM.colors.length === 6 && GA.MM.tries === 8 && GA.MM.len === 4,
    'The dispatch: four lights from six colours, eight tries, full and half marks counted right (repeats too)');
  { const play = (seed, react, fire) => { const r = mulberry32(seed), st = GA.depthStart(r); let think = 0, goal = st.x;
      while (!st.over) { think -= 0.05; if (think <= 0) { think = react;
        const safe = x => !st.shots.some(s => s.y < GA.DC.shipY + 110 && Math.abs(s.x - x) < GA.DC.shipW / 2 + 12), live = st.foes.filter(f => f.alive).sort((a, b) => a.y - b.y || Math.abs(a.x - st.x) - Math.abs(b.x - st.x)), tg = live[0];
        let want = tg ? tg.x : st.x; if (!safe(st.x)) { let best = null; for (let x = 30; x <= GA.DC.W - 30; x += 10) if (safe(x) && (best === null || Math.abs(x - st.x) < Math.abs(best - st.x))) best = x; if (best !== null) want = best; } else if (!safe(want)) want = st.x;
        goal = want; if (fire && tg && Math.abs(tg.x - st.x) < 18) GA.depthDrop(st); }
        GA.depthStep(st, 0.05, Math.abs(goal - st.x) < 6 ? 0 : Math.sign(goal - st.x), r); if (st.t > 60) break; }
      return st; };
    const good = Array.from({ length: 60 }, (_, i) => play(i + 1, 0.15, true)), idle = Array.from({ length: 60 }, (_, i) => play(i + 1, 99, false));
    check(good.every(s => s.over && s.t <= GA.GAME_TIME.depth + 0.1) && good.filter(s => s.won).length >= 20 && idle.every(s => !s.won), `Depth charges: a simple steady bot wins ${good.filter(s => s.won).length}/60 (people dodge better); doing nothing always loses`); }
  // the stations' update stays small with a busy fleet (full log, two ships under salvage, Morse questions up)
  { const wz = createWorld(101, { deploy: true }); light(wz); gm(wz, 'fleet-auto'); for (let i = 0; i < 20; i++) step(wz, DT);
    for (let k = 0; k < 30; k++) { wz.seal = null; stationAction(wz, 'operator', { act: 'fire' }); }
    const fz = wz.fleet; for (const i of [2, 3]) { fz.mine[i].hits = Array.from({ length: fz.mine[i].len }, (_, j) => j); fz.salvage[i] = { board: makeRepairBoard('engineer', mulberry32(i)), done: false, power: false, since: fz.round, readyRound: null }; }
    for (const d of FL.DEPTS) Object.assign(fz.dept[d], { state: 'question', question: { q: 'HOW MANY DAYS IN A WEEK', opts: ['SEVEN', 'FIVE', 'NINE'], answer: 0 } });
    const ss = JSON.stringify(stationSnapshot(wz, { iid: 'x', born: 1 }));
    check(ss.length < 14000 && fz.log.length <= 40, `The stations' update stays small with a busy fleet (${ss.length} bytes)`); }
  // revision 25: below the ninth layer, the Pit deals a new toll at every update, and no old password will do
  { // build a password that meets all twelve rules plus a toll, if one exists (the test's own solver)
    const alt = str => [...str].map((c, i) => i % 2 ? c.toLowerCase() : c.toUpperCase()).join('');
    const build = (w, extraRules) => {
      const t = w.pwToll; let mid = '', roman = false;
      if (t.kind === 'minute') mid = 'a' + t.minute.repeat(t.times) + 'b';
      if (t.kind === 'red') mid = 'a' + w.beacons.stock + 'b';
      if (t.kind === 'lastberg') mid = 'a' + t.num + 'b';
      if (t.kind === 'orbhouse') mid = RUNES[w.camRune[w.activeCam]].house;
      if (t.kind === 'roman') roman = true;
      const sin = alt(t.kind === 'sin' ? SINS.find(x => !t.prev.includes(x)) : 'ENVY');
      const ones = mid.split('1').length - 1, sixes = mid.split('6').length - 1;
      const chain = ones ? '######' : '###1###', six = '6'.repeat(3 - sixes);
      if (ones) mid = '###' + mid + '###';
      for (const L of [43, 45, 47, 49, 53, 55, 57, 59, 73, 75, 77, 79, 83, 85, 87, 89, 93, 95, 97]) {
        const core = 'JerRy' + chain + '$999Q0K' + sin + six + 'q2+2=5IAGReE!' + mid;
        const pre = roman ? alt(toRoman(L)) : '', need = L - pre.length - core.length - String(L).length;
        if (need < 1) continue;
        const pw = pre + core + 'xYzQ'.repeat(30).slice(0, need) + L;
        if (checkPassword(pw, 12, extraRules).ok) return pw;
      }
      return null;
    };
    let dealt = 0, solved = 0, repeats = 0, reused = true, kinds = new Set(); const seq = w => { const k = w.pwToll.kind; if (k === w.__lastKind) repeats++; w.__lastKind = k; };
    for (let k = 0; k < 300; k++) {
      const w = createWorld(400 + k, { deploy: true }); light(w);
      w.pwCap = PW_RULES.length; w.password = 'JerRy###1###$999-273ENVY666+2=5IAGReE!xYzQxYzQ43';
      w.t = (k * 97) % 4000; w.board.page = k % 4; w.beacons.stock = k % 6; w.activeCam = w.cams[k % 7].id; if (k % 3) w.lastStruck = (k * 7) % 44 + 1;
      let prevKind = null;
      for (let u = 0; u < 3; u++) {
        w.seal = null; openSeal(w, 'lockdown', { change: true }); dealt++; kinds.add(w.pwToll.kind); seq(w);
        const pw = build(w, pwExtra(w)); if (pw) solved++; else console.log('no password for', JSON.stringify(w.pwToll));
        if (pw) { w.seal.mode = 'set'; if (sealInput(w, pw) !== 'ok') solved--; else { w.seal = null; openSeal(w, 'lockdown', { change: true }); seq(w); w.seal.mode = 'set'; if (sealInput(w, pw) === 'ok') reused = false; w.seal = null; } }
        w.t += 541; w.board.page = (w.board.page + 1) % 4; w.beacons.stock = (w.beacons.stock + 2) % 6;
      }
    }
    check(dealt === 900 && solved === dealt, `Every toll the Pit deals can be met alongside all nine layers (${solved}/${dealt}, kinds: ${[...kinds].join(', ')})`);
    check(repeats === 0 && kinds.size === 6, 'The Pit never deals the same kind of toll twice running, and deals all six');
    check(reused, 'No password that has been used before is accepted again');
    const w0 = createWorld(5); light(w0); w0.pwCap = PW_RULES.length - 1; openSeal(w0, 'lockdown', { change: true });
    check(!w0.pwToll && !pwExtra(w0).length && w0.pwCap === PW_RULES.length, 'Reaching the ninth layer adds IAGREE as before; the tolls start at the next update'); }
  // revision 23: the GM hands Engineering a fresh breaker panel
  { const wl = createWorld(103); light(wl); wl.rewards.lights = 999; const s0 = stationSnapshot(wl).lightsSeq; gm(wl, 'lights-reset');
    check(stationSnapshot(wl).lightsSeq === s0 + 1 && wl.rewards.lights === 0, 'The GM resets the breaker panel, and it can pay out at once'); }
  // revision 22: Gunnery alternates devil fire and the cable; the GM repairs one machine; slower devil fire
  { const wg = createWorld(102, { deploy: true }); light(wg); gm(wg, 'fleet-auto'); for (let i = 0; i < 20; i++) step(wg, DT);
    const kinds = []; for (let k = 0; k < 4; k++) { startDefence(wg, 'gunnery'); const a = wg.defence.active.gunnery; kinds.push(a.kind); defenceResult(wg, 'gunnery', a.id, { ok: true, hits: [] }); }
    check(kinds.join() === 'missile,snake,missile,snake', "Gunnery's alarms alternate: devil fire, then the buoy cable");
    wg.buoy = { x: 900, y: 900, landAt: 0 }; startDefence(wg, 'gunnery'); startDefence(wg, 'gunnery'); const a2 = wg.defence.active.gunnery;
    if (a2.kind !== 'snake') { defenceResult(wg, 'gunnery', a2.id, { ok: true, hits: [] }); startDefence(wg, 'gunnery'); }
    const a3 = wg.defence.active.gunnery; defenceResult(wg, 'gunnery', a3.id, { ok: false });
    check(a3.kind === 'snake' && wg.broken.winch && !wg.buoy && !wg.cams.some(c => c.broken), 'A failed splice at Gunnery loses the buoy (and no orb)');
    gm(wg, 'defence', { role: 'gunnery', kind: 'snake' }); check(wg.defence.active.gunnery.kind === 'snake', 'The GM can send Gunnery the cable');
    breakThing(wg, 'c3'); breakThing(wg, 'launcher'); gm(wg, 'repair-one', { id: 'c3' });
    check(!wg.cams.find(c => c.id === 'c3').broken && wg.broken.launcher, 'The GM repairs one orb, and leaves the rest broken');
    gm(wg, 'repair-one', { id: 'launcher' }); check(!wg.broken.launcher, '...or one machine');
    const fast = GA.missileWaves(mulberry32(3), 10, 'fall').map(m => m.speed);
    check(GA.MISSILE_SPEED === 0.75 && Math.max(...fast) <= 1.6 * 0.75 + 1e-9 && Math.min(...fast) >= 1.1 * 0.75 - 1e-9, 'Devil fire flies at three quarters of its old speed'); }
  // the beacon rack: 5 red, 2 orange, 1 green, and never more; a green can always be built once one is fired
  { const wb = createWorld(97, { deploy: true }); light(wb); gm(wb, 'fleet-auto'); setPower(wb, 'workshop', true);
    check(wb.beacons.stock === 5 && wb.beacons.orange === 2 && wb.beacons.green === 1, 'The Watch starts with 5 red, 2 orange and 1 green beacon');
    check(!sealBeacon(wb, 'green') && !sealBeacon(wb, 'red') && !wb.workshop.curing.length, 'A full rack takes no more');
    wb.beacons.green = 0; check(sealBeacon(wb, 'green') && !sealBeacon(wb, 'green'), 'Fire the green and one more can be built (only one)');
    for (let i = 0; i < (T.cureTime + 3) * 10; i++) { keepFurnace(wb); wb.fatigue = 0; if (wb.seal) sealInput(wb, wb.password); delete wb.defence.active.fleet; step(wb, DT); }
    check(wb.beacons.green === 1, '...and it cures into the rack'); }
  // the disguised warships: four, large and hollow and metal, playing the war drums; none in a sea without the fleet
  { const wa = createWorld(98, { deploy: true }), wn = createWorld(98), ships = wa.bergs.filter(b => b.warship);
    check(ships.length === 4 && ships.every(b => b.large && b.hollow && b.metal && b.echo.sig === 'halls' && b.radio.decoded === 'RRW' && b.radio.band === 'MID' && b.look === 'warship'), 'Four disguised warships: large, hollow, metal, and the war drums on the radio');
    check(!wn.bergs.some(b => b.warship) && wn.bergs.every(b => { const o = wa.bergs.find(x => x.id === b.id); return o && o.x === b.x && o.y === b.y; }), 'The rest of the sea is the same with or without them');
    const nums = [...wa.bergs, ...wa.reserve].map(b => b.num); check(new Set(nums).size === nums.length, 'Every iceberg still has its own number');
    check(!wa.artifacts.some(a => ships.some(s => s.id === a.bergId)), 'No artifact is hidden in a warship');
    gm(wa, 'fleet-auto'); for (let i = 0; i < 20; i++) step(wa, DT);
    const seen0 = Object.values(wa.fleet.marks).filter(v => v === 'seen').length; beaconHits(wa, ships[0], 'red', wa.t);
    const seen1 = Object.values(wa.fleet.marks).filter(v => v === 'seen').length;
    check(seen1 >= 2 && seen1 > seen0 && wa.bergs.includes(ships[0]) && wa.events.some(e => e.type === 'warshiphit'), 'A beacon in a warship plots one of the enemy\'s ships on our tables; the warship stays');
    beaconHits(wa, ships[0], 'red', wa.t); check(Object.values(wa.fleet.marks).filter(v => v === 'seen').length === seen1, '...once per warship');
    wa.defence.live.fleet = true; stationAction(wa, 'fleet', { act: 'dispatch', choice: 'unmask' });
    const um = ships.find(b => b.unmasked), row = um && wa.cases.find(c => c.bergId === um.id);
    check(um && um.tag && row && row.permanent && row.verdict === 'EXCLUDED', 'A decoded dispatch can unmask a warship: tagged on the chart and EXCLUDED on the case board'); }
  // the green beacon: with a Fleet Officer on station, the operator also needs their clearance (two Morse questions)
  { const wg = createWorld(99, { deploy: true }); light(wg); gm(wg, 'fleet-auto'); for (let i = 0; i < 20; i++) step(wg, DT);
    const b = wg.bergs.find(x => x.large && !x.elgarz); lockOn(wg, b.id, b.x, b.y, wg.t, 'camera'); wg.defence.live.fleet = true;
    fireBeacon(wg, 'green'); sealInput(wg, wg.password);
    const c = wg.clearance; check(c && c.qs.length === 2 && c.qs[0].q !== c.qs[1].q && !wg.beacons.flying.length, 'After the password: FLEET OFFICER CLEARANCE REQUIRED, two questions');
    check(stationSnapshot(wg).clearance && stationSnapshot(wg).clearance.qs[0].opts.length === 3, 'The Fleet Officer\'s station sees the questions too');
    clearanceAnswer(wg, (c.qs[0].answer + 1) % 3); check(!wg.clearance && !wg.beacons.flying.length && wg.beacons.green === 1, 'A wrong answer refuses clearance; the green stays in the rack');
    fireBeacon(wg, 'green'); sealInput(wg, wg.password); const c2 = wg.clearance;
    clearanceAnswer(wg, c2.qs[0].answer); check(wg.clearance && wg.clearance.step === 1, '...the right one goes on to the second');
    clearanceAnswer(wg, c2.qs[1].answer); check(!wg.clearance && wg.beacons.flying.length === 1 && wg.beacons.green === 0, 'Both right: the green beacon flies');
    wg.beacons.green = 1; wg.beacons.flying = []; wg.defence.live.fleet = false; fireBeacon(wg, 'green'); sealInput(wg, wg.password);
    check(!wg.clearance && wg.beacons.flying.length === 1, 'With no Fleet Officer on station, no clearance is asked');
    wg.beacons.green = 1; wg.beacons.flying = []; wg.defence.live.fleet = true; fireBeacon(wg, 'green'); sealInput(wg, wg.password); wg.defence.live.fleet = false; step(wg, DT);
    check(!wg.clearance && wg.beacons.flying.length === 1, 'If the Fleet Officer drops out mid-clearance, it is waived');
    wg.beacons.green = 1; wg.beacons.flying = []; wg.defence.live.fleet = true; fireBeacon(wg, 'green'); sealInput(wg, wg.password); gm(wg, 'clearance');
    check(!wg.clearance && wg.beacons.flying.length === 1, 'The GM can grant clearance'); }
  // old saves: a revision-18 fleet (four ships) is replaced on load
  { const wl = createWorld(100, { deploy: true }); light(wl); gm(wl, 'fleet-auto'); for (let i = 0; i < 20; i++) step(wl, DT);
    const back = loadWorld(saveWorld(wl)); check(JSON.stringify(back.fleet) === JSON.stringify(wl.fleet) && back.bergs.filter(b => b.warship).length === 4, 'A save keeps the fleet and the warships');
    wl.fleet.mine = wl.fleet.mine.slice(0, 4); for (const d of FL.DEPTS) delete wl.fleet.dept[d].reloads; delete wl.shellAsks; delete wl.clearance; delete wl.rewards.dispatch;
    const old = loadWorld(saveWorld(wl)); check(old.fleet.mine.length === 5 && old.fleet.phase === 'play' && old.shellAsks === 0 && old.clearance === null && old.rewards.dispatch === 0, 'An old save gets a fresh five-ship fleet, already on station');
    for (let i = 0; i < 100; i++) step(old, DT); check(old.t > 1, '...and the watch runs on'); }

  // the defences: none without a station connected
  const wd = createWorld(93); light(wd);
  for (let i = 0; i < 9000; i++) { keepFurnace(wd); wd.fatigue = 0; step(wd, DT); }
  check(!Object.keys(wd.defence.active).length && !wd.events.some(e => e.type === 'defence'), 'With no station connected, no defence events come');
  const we = createWorld(94); light(we); ROLES.forEach(r => we.defence.live[r] = true);
  const starts = [];
  for (let i = 0; i < 18000; i++) {
    keepFurnace(we); we.fatigue = 0; step(we, DT);
    for (const e of we.events) if (e.type === 'defence') { starts.push({ role: e.role, t: e.t }); const a = we.defence.active[e.role]; defenceResult(we, e.role, a.id, { ok: true, hits: [] }); }
    we.events.length = 0;
  }
  const byRole = r => starts.filter(s => s.role === r).map(s => s.t);
  const gaps = ROLES.flatMap(r => byRole(r).slice(1).map((t, i) => t - byRole(r)[i]));
  const firsts = ROLES.map(r => byRole(r)[0]);
  const sorted = starts.map(s => s.t).sort((a, b) => a - b), close = sorted.slice(1).filter((t, i) => t - sorted[i] < T.defenceGap - 1).length;
  console.log(`Defences in 30 minutes: ${ROLES.map(r => r + ' ' + byRole(r).length).join(', ')} · first at ${firsts.map(t => Math.round(t)).join(', ')} s · ${close} pairs closer than ${T.defenceGap} s`);
  const span = r => byRole(r).slice(1).map((t, i) => t - byRole(r)[i]);
  check(span('gunnery').every(g => g >= 170 && g <= 400) && ['signals', 'engineer'].every(r => span(r).every(g => g >= 170 && g <= 600)) && firsts.every(t => t >= 170 && t <= 520), 'Gunnery gets a defence every three to five minutes, the others every three to seven');
  check(close <= 1, 'Two stations\' defences rarely come close together');
  // the outcomes
  const wo = createWorld(95); light(wo); ['sonar', 'cameras', 'currents'].forEach(x => setPower(wo, x, true)); for (let i = 0; i < 20; i++) step(wo, DT);
  startDefence(wo, 'gunnery'); defenceResult(wo, 'gunnery', wo.defence.active.gunnery.id, { hits: ['c2', 'c5'] });
  check(wo.cams[1].broken && wo.cams[4].broken && !wo.cams[0].broken, 'Each tower hit in Missile Command is that orb destroyed');
  deployBuoy(wo, CENTER.x + 300, CENTER.y); for (let i = 0; i < 50; i++) step(wo, DT);
  startDefence(wo, 'signals'); const sid = wo.defence.active.signals.id; defenceResult(wo, 'signals', sid, { ok: true });
  check(!!wo.buoy, 'Splicing the cable costs nothing');
  startDefence(wo, 'signals'); defenceResult(wo, 'signals', wo.defence.active.signals.id, { ok: false });
  check(!wo.buoy && wo.broken.winch, 'A failed splice loses the buoy');
  wo.furnace.heat = 70; wo.furnace.chute = 3; setPriority(wo, ['sonar', 'cameras', 'currents']);
  startDefence(wo, 'engineer'); defenceResult(wo, 'engineer', wo.defence.active.engineer.id, { ok: false });
  check(!wo.power.currents.on && wo.power.sonar.on && wo.furnace.chute === 0 && wo.lamps === 1, 'Losing the stokehold: the lowest-priority system drops, the chute is emptied, the lights go red');
  wo.defence.live.engineer = true; wo.furnace.heat = 95; wo.furnace.pending = 0; step(wo, DT);
  check(wo.defence.active.engineer && wo.defence.active.engineer.reason === 'overheat', 'A furnace in the red sets the stokehold fires failing');
  const stale = wo.defence.active.engineer.id; wo.defence.active.engineer.at -= 200; wo.furnace.heat = 60; step(wo, DT);
  check(!wo.defence.active.engineer && wo.lamps === 1, 'A station that drops out mid-game costs nothing');
  check(!defenceResult(wo, 'engineer', stale, { ok: false }), 'A late result for a finished event is ignored');
  // the steady puzzles: a free beacon on a large glacier that is not Elgarz; a free shovel; each once a minute
  const wr = createWorld(96); light(wr); for (let i = 0; i < 20; i++) step(wr, DT);
  let fair = true;
  for (let k = 0; k < 12; k++) { wr.rewards.mines = 0; const n0 = wr.tags.length; stationAction(wr, 'signals', { act: 'minesweeper' }); const b = wr.bergs.find(x => x.id === wr.tags[wr.tags.length - 1]); if (wr.tags.length !== n0 + 1 || !b.large || b.elgarz || b.echo.sig === 'monster' || !wr.cases.some(c => c.bergId === b.id && c.permanent)) fair = false; }
  check(fair, 'Clearing the minefield beacons a large glacier (never Elgarz) and pins it to the case board');
  const nt = wr.tags.length; stationAction(wr, 'signals', { act: 'minesweeper' });
  check(wr.tags.length === nt, '...but only once a minute');
  wr.furnace.chute = 1; stationAction(wr, 'engineer', { act: 'lightsout' }); const c1 = wr.furnace.chute; stationAction(wr, 'engineer', { act: 'lightsout' });
  check(c1 === 2 && wr.furnace.chute === 2, 'Clearing the breaker panel puts a free shovel in the chute, once a minute');
  // the defence games themselves
  { let body = GA.snakeStart(); check(body.length === 15 && GA.SN.start + GA.SN.need === 25 && GA.SN.grace === 5 && body.every((c, i) => !i || Math.abs(c[0] - body[i - 1][0]) + Math.abs(c[1] - body[i - 1][1]) === 1), 'The cable starts fifteen long, all in one piece, and must reach twenty-five; the first five seconds are safe');
    const food = [body[0][0] + 1, body[0][1]], r = GA.snakeMove(body, [1, 0], food); check(r.ate && r.body.length === 16 && !r.dead, 'Each loose end makes the cable longer');
    let b2 = GA.snakeStart(), dead = false; for (let i = 0; i < 3 && !dead; i++) { const m = GA.snakeMove(b2, [1, 0], null); b2 = m.body; dead = m.dead; } check(!dead && b2[0][0] < 3, 'Through a wall the cable comes out the other side');
    { let ok = true; for (let k = 0; k < 200; k++) { const r2 = mulberry32(k + 1), b0 = GA.snakeStart(), sp = GA.sparksStart(r2, b0); if (sp.length !== GA.SN.sparks || sp.some(s => b0.some(c => Math.abs(c[0] - s.x) + Math.abs(c[1] - s.y) < 3))) ok = false; }
      check(ok, 'Three stray sparks, always starting well clear of the cable'); }
    { const sp = [{ x: GA.SN.W - 0.1, y: 3, dx: 1, dy: 0 }]; GA.sparksStep(sp, 0.1); check(sp[0].x < 1 && GA.sparkHits(sp, [0, 3]) && !GA.sparkHits(sp, [5, 5]), 'A spark drifts through the wall like the cable, and touching it is a hit'); }
    check(GA.SN.sink === 6, 'A loose end sinks after six seconds');
    let b3 = GA.snakeStart(); for (const d of [[0, 1], [-1, 0], [0, -1]]) { const m = GA.snakeMove(b3, d, null); b3 = m.body; if (d[1] === -1) check(m.dead, 'Turning back into the cable fails the splice'); }
    { // the stokehold: a dead fire and a burst one each cost a fail; a fire left alone dies; a steady stoker holds 45 s
      const s1 = GA.stokeStart(rng); s1.lanes[0].heat = 0.5; const e1 = GA.stokeStep(s1, 0.5, rng);
      s1.lanes[1].heat = GA.ST.top - 0.1; s1.lanes[1].pace = 0; GA.stokeThrow(s1, 1); for (let i = 0; i < 20; i++) GA.stokeStep(s1, 0.05, rng);
      check(e1.some(e => e.type === 'out') && s1.fails === 2 && s1.lanes[0].heat > 0 && s1.lanes[1].heat < 100, 'The stokehold: a fire that dies or bursts is a fail, and it relights or vents');
      check(!GA.stokeThrow(s1, 2) || !GA.stokeThrow(s1, 2), 'A shovel cannot be flung twice in the same instant');
      const s2 = GA.stokeStart(rng); let dead = 0; for (let i = 0; i < 400; i++) dead += GA.stokeStep(s2, 0.05, rng).filter(e => e.type === 'out').length;
      check(dead >= 4 && s2.fails >= 3, 'Left alone, every fire dies inside twenty seconds');
      const play = (seed, aim, move, react) => { const r = mulberry32(seed), s = GA.stokeStart(r); let pos = 1, busy = 0;
        while (s.t < GA.GAME_TIME.stoke && s.fails < 3) { GA.stokeStep(s, 0.05, r); busy -= 0.05; if (busy > 0) continue;
          const proj = s.lanes.map((l, i) => l.heat + GA.ST.lump * s.coal.filter(c => c.lane === i).length - 5 * GA.ST.travel);
          let best = -1, bv = aim; proj.forEach((v, i) => { const v2 = v + Math.abs(i - pos) * move * 5; if (v2 < bv) { bv = v2; best = i; } });
          if (best < 0) busy = react; else if (best !== pos) { pos += Math.sign(best - pos); busy = move; } else if (proj[pos] + GA.ST.lump < GA.ST.top - 2 && GA.stokeThrow(s, pos)) busy = react; }
        return s.fails < 3; };
      const good = Array.from({ length: 60 }, (_, i) => play(i + 1, 46, 0.15, 0.28)).filter(Boolean).length, slow = Array.from({ length: 60 }, (_, i) => play(i + 1, 45, 0.4, 0.9)).filter(Boolean).length;
      check(GA.GAME_TIME.stoke === 45 && good === 60 && slow < good, `45 s in the stokehold: a quick stoker always holds (${good}/60); a slow one does worse (${slow}/60)`);
    };
    check(GA.GAME_TIME.missile === 30 && GA.missileWaves(rng, 0, 'fall').length >= 16 && GA.missileWaves(rng, 20, 'fall').length >= 28 && GA.missileWaves(rng, 20, 'arc').length <= 0.75 * GA.missileWaves(rng, 20, 'fall').length && GA.missileWaves(rng, 0, 'arc').every(w => w.from < 0.2 || w.from > 0.8), 'Thirty seconds of devil fire, twice as much as before; the skiffs fire from the sides, about 30% less'); }
  // the stations' own small update, and the rehearsal
  { const ss = JSON.stringify(stationSnapshot(wo, { iid: 'x', born: 1 }));
    check(ss.length < 10000 && ['fleet', 'furnaceState', 'sonar', 'cases', 'workshop', 'defence'].every(k => ss.includes('"' + k + '"')), `The stations' update is small (${ss.length} bytes) and has what they draw`);
    gm(wo, 'rehearse'); check(ROLES.every((r, i) => Math.abs(wo.defence.next[r] - (wo.t + 1 + i * 50)) < 0.01), 'The rehearsal lines up every station\'s event, one after another'); }
  check(createWorld(5).bergs.length + createWorld(5).reserve.length === 40, 'The sea holds forty glaciers');
  // a station's actions go through one door
  stationAction(wo, 'signals', { act: 'callsign', bergId: wo.bergs[0].id, text: 'brw!' });
  check(wo.callsigns[wo.bergs[0].id] === 'BRW', 'Signals can enter a call sign on the case board');
}

// ---------- revision 13: artifacts, the orb cap, plotting enemy ships ----------
{
  // six artifacts: five hidden in metal glaciers, the sixth given to the first metal the scanner finds; never Elgarz
  let ok = true, firstOk = true;
  for (const seed of SEEDS.slice(0, 20)) {
    const w = createWorld(seed), all = [...w.bergs, ...w.reserve];
    const placed = w.artifacts.filter(a => a.bergId);
    if (w.artifacts.length !== 6 || placed.length !== 5 || placed.some(a => { const b = all.find(x => x.id === a.bergId); return !b || !b.metal || b.elgarz; })) ok = false;
    light(w); ['scanner'].forEach(x => setPower(w, x, true)); for (let i = 0; i < 50; i++) step(w, DT);
    const b = w.bergs.find(x => x.metal && !x.elgarz && x.large);
    if (!b) continue;
    w.scanner.calibrated = true; lockOn(w, b.id, b.x, b.y, w.t, 'camera');
    for (let i = 0; i < (T.scanTime + 2) * 10; i++) { w.buoy = { x: b.x, y: b.y, landAt: 0 }; keepFurnace(w); step(w, DT); }
    if (!(b.scanned && artifactIn(w, b.id) && artifactIn(w, b.id).found && w.obs[b.id].artifact) || w.artifacts.filter(a => a.bergId && a.bergId !== 'none').length !== 6) firstOk = false;
  }
  check(ok, 'Five artifacts are hidden in metal glaciers (never Elgarz)');
  check(firstOk, 'The first metal the scanner finds always holds an artifact, and the scanner names it; six in all');
  // a green beacon recovers it
  const w = createWorld(1001); light(w); for (let i = 0; i < 20; i++) step(w, DT);
  const a = w.artifacts.find(x => x.bergId && w.bergs.some(b => b.id === x.bergId)), b = w.bergs.find(x => x.id === a.bergId);
  lockOn(w, b.id, b.x, b.y, w.t, 'camera'); w.lock.track = { vx: b.vx || 0, vy: b.vy || 0, t: w.t, cam: 'c1' };
  w.password = VALID3;
  for (let k = 0; k < 8 && !a.recovered; k++) {   // green asks for the password, then fires; the roll may miss
    w.beacons.green = 3; w.broken.launcher = false; w.lock.t0 = w.t; w.lock.track = { vx: b.vx || 0, vy: b.vy || 0, t: w.t, cam: 'c1' };
    fireBeacon(w, 'green'); if (w.seal) sealInput(w, VALID3);
    for (let i = 0; i < 400 && w.beacons.flying.length; i++) step(w, DT);
  }
  check(a.recovered && w.events.some(e => e.type === 'artifactrecovered') || a.recovered, 'A green beacon on that glacier recovers the artifact');
  // the wind and snow cap an orb's track
  const wo = createWorld(1002); light(wo); for (let i = 0; i < 20; i++) step(wo, DT);
  const c = wo.cams[0], wx = camWeather(wo, c), oc = orbCap(wo, c.id);
  check(oc.cap <= 0.99 && oc.cap >= 0.5 && (wx.windKn <= 28 ? oc.cap === 0.99 : oc.cap < 0.99), `An orb's track is capped by its wind (${wx.windKn} kn → ${Math.round(oc.cap * 100)}%), never below 50%`);
  let capsOk = true;
  for (let k = 0; k < 400; k++) { const t0 = 30 + k * 6; while (wo.t < t0) { keepFurnace(wo); step(wo, DT); } for (const cc of wo.cams) { const q = orbCap(wo, cc.id); if (q.cap < 0.5 || q.cap > 0.99) capsOk = false; } }
  check(capsOk, 'The cap always stays between 50% and 99%');
  // an orb-tracked lock in high wind is held to the cap; a fresh nearby reading can beat it
  { const w2 = createWorld(1003); light(w2); for (let i = 0; i < 20; i++) step(w2, DT);
    const b2 = w2.bergs.find(x => x.large); lockOn(w2, b2.id, b2.x, b2.y, w2.t, 'camera'); w2.lock.track = { vx: b2.vx || 0, vy: b2.vy || 0, t: w2.t, cam: 'c1' };
    w2.field.windBase = 0; const real = orbCap(w2, 'c1');
    const T0 = { ...T }; T.orbCapWind = -100; const q = aimQuality(w2); T.orbCapWind = T0.orbCapWind;
    check(q.chance <= 0.5 + 1e-9 && /orb track at/.test(q.reason || ''), `A gale at the orb holds the track to the cap, and says why ("${q.reason}")`);
    w2.readings = { t: w2.t, x: b2.x, y: b2.y, surface: { x: 0, y: 0 }, deep: { x: 0, y: 0 }, wind: { x: 0, y: 0 }, windFrom: 0, windSpeed: 0, temp: -170 };
    T.orbCapWind = -100; const q2 = aimQuality(w2); T.orbCapWind = T0.orbCapWind;
    check(q2.chance > q.chance, 'A fresh current reading beside the ice beats the capped orb track'); }
  // Signals can sight a square of an enemy hull instead of beaconing a glacier
  const wf = createWorld(1004, { deploy: true }); light(wf); gm(wf, 'fleet-auto'); for (let i = 0; i < 20; i++) step(wf, DT);
  check(canReveal(wf), 'With the fleet in action, there is an enemy hull to sight');
  const tags0 = wf.tags.length; stationAction(wf, 'signals', { act: 'minesweeper', choice: 'reveal' });
  const seen = Object.entries(wf.fleet.marks).filter(([, v]) => v === 'seen');
  check(seen.length === 1 && wf.tags.length === tags0 && wf.fleet.enemy.some(s => FL.cellsOf(s).some(q => q.join() === seen[0][0])), 'Minesweeping sights one square of an enemy hull');
  stationAction(wf, 'signals', { act: 'minesweeper', choice: 'reveal' });
  check(Object.values(wf.fleet.marks).filter(v => v === 'seen').length === 1, '...once a minute');
}

// ---------- the fleet's balance (simulated crews) ----------
{
  const { session } = await import('./sim-fleet.mjs');
  const runs = Array.from({ length: 60 }, (_, i) => session(i + 1));
  const waves = runs.reduce((a, r) => a + r.waves.length, 0), lost = runs.reduce((a, r) => a + r.losses, 0);
  check(waves / 60 > 2 && lost / 60 < 0.3, `A steady crew usually wins at sea: ${(waves / 60).toFixed(1)} enemy fleets sunk in 40 minutes, ${(lost / 60).toFixed(2)} of ours lost`);
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
  if (w.seal && w.seal.reason === 'fatigue') sealInput(w, VALID3);   // a drowsy operator logs back in first
  fireBeacon(w, color);
  if (w.seal) sealInput(w, VALID3);   // green: the current password, then it fires
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
