// The repair bay. One board for every machine; each department reads it with its own flowchart.
// Shared by the game, the three manuals and the tests. Pure, no DOM.
//
// A broken machine shows four conduit rows. Each row has three status lights (left to right: R red, Y yellow,
// G green), a gauge reading (0-99) and a fault code (letter, digit, letter). Each row is set OPEN, CLOSE or CUT:
// the first rule in the owner's flowchart that fits; if none fits, OPEN. Every board needs at least one CLOSE and one CUT.

export const LIGHTS = ['R', 'Y', 'G'];
export const CODE_LETTERS = 'AEUKRSTVX', CODE_DIGITS = '23456789', VOWELS = 'AEU';
export const ROWS = 4;
export const ACTIONS = ['OPEN', 'CLOSE', 'CUT'];
export const DEPTS = { engineer: 'ENGINEERING', gunnery: 'GUNNERY', signals: 'SIGNALS' };

// Who owns (and repairs) each machine. Orbs are camera ids (c1..c7): all Gunnery's.
export const OWNER = { furnace: 'engineer', fuse: 'engineer', scanner: 'engineer', winch: 'signals', sonarhead: 'signals', launcher: 'gunnery' };
export const ownerOf = id => OWNER[id] || 'gunnery';

const count = (r, c) => r.lights.filter(x => x === c).length;
const digit = r => Number(r.code[1]);
// gauge bands for the Engineer
const band = g => g < 30 ? 'LOW' : g < 70 ? 'MID' : 'HIGH';

export const FLOWS = {
  // Signals: the order of the lights and the fault code. The gauge only counts as HIGH (50 or more) or LOW.
  signals: [
    { q: 'Do the lights read GREEN, YELLOW, RED, in that order?', then: 'OPEN', test: r => r.lights.join('') === 'GYR' },
    { q: 'Are the code\'s two letters the same?', then: 'CUT', test: r => r.code[0] === r.code[2] },
    { q: 'Are all three lights the same colour?', then: 'CLOSE', test: r => r.lights[0] === r.lights[1] && r.lights[1] === r.lights[2] },
    { q: 'Is the middle light RED and the gauge HIGH (50 or more)?', then: 'CUT', test: r => r.lights[1] === 'R' && r.gauge >= 50 },
    { q: 'Does the code have a vowel (A, E, U) and is the first light GREEN?', then: 'CLOSE', test: r => [...r.code].some(c => VOWELS.includes(c)) && r.lights[0] === 'G' },
    { q: 'Is the code\'s digit odd and the last light RED?', then: 'CUT', test: r => digit(r) % 2 === 1 && r.lights[2] === 'R' },
    { q: 'Is the code\'s digit above 5 and no light YELLOW?', then: 'CLOSE', test: r => digit(r) > 5 && !r.lights.includes('Y') },
  ],
  // Gunnery: the exact gauge value. The lights are only counted.
  gunnery: [
    { q: 'Is the gauge 90 or more?', then: 'CUT', test: r => r.gauge >= 90 },
    { q: 'Is the gauge under 20?', then: 'CLOSE', test: r => r.gauge < 20 },
    { q: 'Is no light RED and the gauge under 40?', then: 'OPEN', test: r => count(r, 'R') === 0 && r.gauge < 40 },
    { q: 'Does the gauge end in 0 or 5?', then: 'CLOSE', test: r => r.gauge % 5 === 0 },
    { q: 'Are two or more lights RED?', then: 'CUT', test: r => count(r, 'R') >= 2 },
    { q: 'Is the gauge even and any light RED?', then: 'CLOSE', test: r => r.gauge % 2 === 0 && count(r, 'R') > 0 },
    { q: 'Do the gauge\'s two digits add up to 10 or more?', then: 'CUT', test: r => Math.floor(r.gauge / 10) + r.gauge % 10 >= 10 },
  ],
  // Engineer: gauge bands (LOW under 30, MID 30-69, HIGH 70 or more) and how many lights of each colour.
  engineer: [
    { q: 'Are all three lights GREEN?', then: 'OPEN', test: r => count(r, 'G') === 3 },
    { q: 'Is the gauge HIGH and any light RED?', then: 'CUT', test: r => band(r.gauge) === 'HIGH' && count(r, 'R') > 0 },
    { q: 'Are two or more lights YELLOW?', then: 'CLOSE', test: r => count(r, 'Y') >= 2 },
    { q: 'Is the gauge LOW and no light GREEN?', then: 'CUT', test: r => band(r.gauge) === 'LOW' && count(r, 'G') === 0 },
    { q: 'Does the code\'s digit match the gauge\'s first digit?', then: 'CLOSE', test: r => digit(r) === Math.floor(r.gauge / 10) },
    { q: 'Is the gauge MID and exactly one light RED?', then: 'CUT', test: r => band(r.gauge) === 'MID' && count(r, 'R') === 1 },
    { q: 'Is the gauge LOW and exactly one light GREEN?', then: 'CLOSE', test: r => band(r.gauge) === 'LOW' && count(r, 'G') === 1 },
  ],
};
export const DEFAULT_ACTION = 'OPEN';

export function repairAction(dept, row) {
  for (const rule of FLOWS[dept]) if (rule.test(row)) return rule.then;
  return DEFAULT_ACTION;
}
export function randomRow(rng) {
  const pick = s => s[Math.floor(rng() * s.length)];
  return {
    lights: [pick(LIGHTS), pick(LIGHTS), pick(LIGHTS)],
    gauge: Math.floor(rng() * 100),
    code: pick(CODE_LETTERS) + pick(CODE_DIGITS) + pick(CODE_LETTERS),
  };
}
// A board for one broken machine: four rows, at least one CLOSE and one CUT under its owner's flowchart.
export function makeRepairBoard(dept, rng = Math.random) {
  for (;;) {
    const rows = Array.from({ length: ROWS }, () => randomRow(rng));
    const acts = rows.map(r => repairAction(dept, r));
    if (acts.includes('CLOSE') && acts.includes('CUT')) return { dept, rows: rows.map(r => ({ ...r, set: null })) };
  }
}
