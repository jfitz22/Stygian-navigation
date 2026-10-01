// Headless scenario checks. Run: node tools/check.mjs
import { createWorld, step, light, dist, snapshot, setPower, deployBuoy, ping, lockContact, setDrift, fireBeacon } from '../src/sim.js';
import { OBSERVATORY, TUNING, TOMB_RADIUS, CAMERAS } from '../src/scenario.js';

const DT = 0.1;
let failures = 0;
const check = (ok, msg) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg); if (!ok) failures++; };

function run(seconds, w = createWorld(1717)) {
  light(w);
  const log = [];
  for (let i = 0; i < seconds / DT; i++) {
    step(w, DT);
    if (i % 10 === 0) log.push(JSON.parse(JSON.stringify(snapshot(w))));
  }
  return { w, log };
}

const { log } = run(1800);
const E = s => s.bergs.find(b => b.elgarz);

// Elgarz arrival: first second inside buoy-reachable water (deploy range + sonar radius)
const reach = TUNING.buoyDeployRange + TUNING.buoyRadius;
const arrive = log.find(s => dist(E(s), OBSERVATORY) <= reach);
console.log('Elgarz enters sonar reach at', arrive ? arrive.t.toFixed(0) + 's' : 'never');
check(arrive && arrive.t >= 195 && arrive.t <= 240, 'Elgarz arrives between 3:15 and 4:00');

const minTomb = Math.min(...log.map(s => dist(E(s), s.tomb)));
console.log('Elgarz closest approach to the Tomb:', minTomb.toFixed(0), 'mi');
check(minTomb >= TOMB_RADIUS + 50, 'Elgarz stays more than 1,050 mi from the Tomb');

const stays = log.filter(s => s.t >= 240 && s.t <= 1500).every(s => dist(E(s), OBSERVATORY) <= reach);
check(stays, 'Elgarz stays in sonar reach from 4:00 to 25:00');

// how many bergs ever enter the Tomb ring during 20 minutes
const entered = new Set();
for (const s of log.filter(s => s.t <= 1200)) for (const b of s.bergs) if (dist(b, s.tomb) < TOMB_RADIUS) entered.add(b.id);
console.log('Bergs that enter the Tomb ring by 20:00:', entered.size, 'of', log[0].bergs.length);
check(entered.size >= 10, 'At least 10 bergs can be ruled out with the Tomb ring');
check(!entered.has('elgarz'), 'Elgarz never enters the ring');

// cameras that see Elgarz at some point
for (const c of CAMERAS) {
  const seen = log.filter(s => {
    const e = E(s); const d = dist(e, c);
    if (d > TUNING.camRange) return false;
    const b = Math.atan2(e.x - c.x, -(e.y - c.y)) * 180 / Math.PI;
    let rel = ((b - c.facing + 540) % 360) - 180;
    return Math.abs(rel) < 35;
  });
  if (seen.length) console.log(`  camera ${c.name} sees Elgarz from ${seen[0].t.toFixed(0)}s to ${seen.at(-1).t.toFixed(0)}s`);
}
for (const c of CAMERAS) {
  const counts = log.filter((_, i) => i % 60 === 0).map(s => s.bergs.filter(b => {
    const d = dist(b, c); if (d > TUNING.camRange) return false;
    const br = Math.atan2(b.x - c.x, -(b.y - c.y)) * 180 / Math.PI;
    return Math.abs(((br - c.facing + 540) % 360) - 180) < 35;
  }).length);
  console.log(`  ${c.name} bergs in view each minute: ${counts.join(' ')}`);
}

// Elgarz path summary
for (const s of log.filter((_, i) => i % 60 === 0)) {
  const e = E(s);
  console.log(`  t=${(s.t / 60).toFixed(0).padStart(2)}m elgarz (${e.x.toFixed(0)}, ${e.y.toFixed(0)}) obs ${dist(e, OBSERVATORY).toFixed(0)} tomb ${dist(e, s.tomb).toFixed(0)} tomb@(${s.tomb.x.toFixed(0)},${s.tomb.y.toFixed(0)})`);
}

// determinism
const a = run(300).w, b = run(300).w;
check(JSON.stringify(snapshot(a)) === JSON.stringify(snapshot(b)), 'Same seed gives the same world');

// ---- shark rule: two pings are safe, three pings in one area draw it ----
function sharkTest(pings) {
  const w = createWorld(1717); light(w);
  setPower(w, 'sonar', true); for (let i = 0; i < 20; i++) step(w, DT);
  deployBuoy(w, 2000, 1500); for (let i = 0; i < 50; i++) step(w, DT);
  for (let k = 0; k < pings; k++) { ping(w); for (let i = 0; i < 70; i++) step(w, DT); }
  for (let i = 0; i < 20; i++) step(w, DT);
  return w.shark.mode;
}
check(sharkTest(2) === 'roam', 'Two pings in one area do not draw the Grindmaw');
check(sharkTest(3) === 'hunt', 'Three pings in one area draw the Grindmaw');

// ---- a competent shot wins; a sloppy shot misses ----
function shot({ drift, readNearTarget, delay }) {
  const w = createWorld(1717); light(w);
  for (let i = 0; i < 4200; i++) step(w, DT);         // 7:00
  ['sonar', 'currents'].forEach(sys => setPower(w, sys, true));
  for (let i = 0; i < 30; i++) step(w, DT);
  const e = w.bergs.find(b => b.elgarz);
  const dd = dist(e, OBSERVATORY);
  const k = readNearTarget ? Math.min(1, 1490 / dd) : 0.75;
  deployBuoy(w, OBSERVATORY.x + (e.x - OBSERVATORY.x) * k, OBSERVATORY.y + (e.y - OBSERVATORY.y) * k);
  for (let i = 0; i < 100; i++) step(w, DT);
  ping(w); for (let i = 0; i < 70; i++) step(w, DT);
  const c = w.contacts.find(c => c.bergId === 'elgarz');
  if (!c) return 'no contact';
  lockContact(w, c); setDrift(w, drift);
  for (let i = 0; i < delay * 10; i++) step(w, DT);
  fireBeacon(w, 'green');
  for (let i = 0; i < 600; i++) step(w, DT);
  return w.won ? 'win' : 'miss';
}
check(shot({ drift: 'deep', readNearTarget: true, delay: 5 }) === 'win', 'Fresh lock + deep drift + nearby reading hits Elgarz');
check(shot({ drift: 'surface', readNearTarget: true, delay: 20 }) === 'miss', 'Wrong drift setting misses');

process.exit(failures ? 1 : 0);
