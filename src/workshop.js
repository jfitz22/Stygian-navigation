// The beacon workshop. Each beacon is built to the design of the department that designed its parts, so each
// recipe lives in that department's book. Pure, no DOM: shared by the Gunnery station, the books and the tests.
//
// A build: take a casing (a serial and a status lamp, random every time), fit the parts the recipes call for,
// pack the charge chamber, seal. Then it cures in the rack while the WORKSHOP switch is on.

export const COLORS = ['red', 'orange', 'green'];
export const SLOTS = { red: ['fuse', 'fins', 'cap'], orange: ['fuse', 'fins', 'cap', 'core'], green: ['fuse', 'fins', 'cap', 'core', 'crystal'] };
export const SERIAL_LETTERS = 'ABDEKMRSTUVX', VOWELS = 'AEU', SERIAL_DIGITS = '23456789';
export const LAMPS = ['R', 'Y', 'G'];

// Every part in the tray, by slot. A part's id says what it looks like.
export const PARTS = {
  fuse: ['1R', '2R', '1W', '2W'],                          // one or two bands, red or white
  fins: ['STRAIGHT', 'SWEPT', 'SPLIT'],
  cap: ['BRASS', 'IRON', 'GLASS'],
  core: ['1B', '2B', '3B', '4B', '1U', '2U', '3U', '4U'],  // notches, then the seal: B brass, U rubber
  crystal: ['3C', '5C', '7C', '3S', '5S', '7S', '3P', '5P', '7P'], // facets, then the tint: C clear, S smoky, P rose
};
export const PART_LABEL = {
  fuse: p => `${p[0] === '1' ? 'one' : 'two'} ${p[1] === 'R' ? 'red' : 'white'} band${p[0] === '1' ? '' : 's'}`,
  fins: p => p.toLowerCase(), cap: p => p.toLowerCase(),
  core: p => `${p[0]} notch${p[0] === '1' ? '' : 'es'}, ${p[1] === 'B' ? 'brass' : 'rubber'} seal`,
  crystal: p => `${p[0]} facets, ${{ C: 'clear', S: 'smoky', P: 'rose' }[p[1]]}`,
};

export function newCasing(rng) {
  const L = () => SERIAL_LETTERS[Math.floor(rng() * SERIAL_LETTERS.length)], D = () => SERIAL_DIGITS[Math.floor(rng() * SERIAL_DIGITS.length)];
  return { serial: L() + L() + L() + '-' + D() + D(), lamp: LAMPS[Math.floor(rng() * 3)] };
}
const letters = c => c.serial.slice(0, 3), digits = c => [Number(c.serial[4]), Number(c.serial[5])];
const hasVowel = c => [...letters(c)].some(ch => VOWELS.includes(ch));

// The Navy's call band for a casing (Gunnery's codebook): by the serial's last digit.
export const callBand = c => { const d = digits(c)[1]; return d <= 4 ? 'LOW' : d <= 7 ? 'MID' : 'HIGH'; };

// ---- the recipes, as each book prints them; `pick` gives the right part for a casing ----
export const RECIPES = {
  // Gunnery & Targeting: the shell, for every beacon
  gunnery: [
    { slot: 'fuse', text: 'FUSE: two bands if the serial\'s digits add up to an odd number, otherwise one. The bands are white if the serial has a vowel (A, E, U), otherwise red.',
      pick: c => ((digits(c)[0] + digits(c)[1]) % 2 ? '2' : '1') + (hasVowel(c) ? 'W' : 'R') },
    { slot: 'fins', text: 'FINS: if the two digits are the same, or one apart, SPLIT. Otherwise by the lamp: red SWEPT, yellow STRAIGHT, green SWEPT.',
      pick: c => { const [a, b] = digits(c); return Math.abs(a - b) <= 1 ? 'SPLIT' : c.lamp === 'Y' ? 'STRAIGHT' : 'SWEPT'; } },
    { slot: 'cap', text: 'CAP: orange and green take GLASS. A red beacon takes IRON if the second digit is bigger than the first, otherwise BRASS.',
      pick: (c, color) => color !== 'red' ? 'GLASS' : digits(c)[1] > digits(c)[0] ? 'IRON' : 'BRASS' },
  ],
  // Engineering & Power: the sounding core, for orange and green
  engineer: [
    { slot: 'core', text: 'SOUNDING CORE, NOTCHES: the serial\'s first digit, halved and rounded up, but never more than 4.',
      pick: c => String(Math.min(4, Math.ceil(digits(c)[0] / 2))) },
    { slot: 'core', text: 'SOUNDING CORE, SEAL: RUBBER if the lamp is green or the serial has an R in it, otherwise BRASS.',
      pick: c => c.lamp === 'G' || letters(c).includes('R') ? 'U' : 'B' },
  ],
  // Signals & Sonar: the transmitter crystal, for green
  signals: [
    { slot: 'crystal', text: 'TRANSMITTER CRYSTAL, FACETS: cut for the call band (ask Gunnery): LOW 3, MID 5, HIGH 7.',
      pick: c => ({ LOW: '3', MID: '5', HIGH: '7' })[callBand(c)] },
    { slot: 'crystal', text: 'TRANSMITTER CRYSTAL, TINT: CLEAR if the serial has two letters the same, otherwise by the lamp: red ROSE, yellow SMOKY, green CLEAR.',
      pick: c => { const l = letters(c); return new Set(l).size < 3 ? 'C' : { R: 'P', Y: 'S', G: 'C' }[c.lamp]; } },
  ],
};
export const GUNNERY_CALL = 'THE CALL BAND: from the serial\'s last digit: 2–4 LOW, 5–7 MID, 8–9 HIGH. Signals needs it to cut a transmitter crystal.';

// The right part for each slot of a beacon of this colour.
export function recipe(color, c) {
  const g = Object.fromEntries(RECIPES.gunnery.map(r => [r.slot, r.pick(c, color)]));
  const out = { fuse: g.fuse, fins: g.fins, cap: g.cap };
  if (color !== 'red') out.core = RECIPES.engineer[0].pick(c) + RECIPES.engineer[1].pick(c);
  if (color === 'green') out.crystal = RECIPES.signals[0].pick(c) + RECIPES.signals[1].pick(c);
  return out;
}
// Which fitted slots are wrong (or empty).
export function wrongSlots(color, c, fitted) {
  const want = recipe(color, c);
  return SLOTS[color].filter(s => fitted[s] !== want[s]);
}

// ---- the charge chamber: a W x H grid cut into n pieces, which the builder packs back in ----
export const CHAMBER = { red: [4, 4, 4], orange: [5, 4, 5], green: [5, 5, 6] };
// Grow n connected regions from random seeds until the grid is full. Every piece then has a known place,
// so the puzzle always has a solution. Pieces of a single cell are avoided.
export function cutChamber(rng, W, H, n) {
  for (let tries = 0; tries < 500; tries++) {
    const grid = Array(W * H).fill(-1), cells = [...grid.keys()];
    for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
    cells.slice(0, n).forEach((c, i) => { grid[c] = i; });
    const nb = c => { const x = c % W, y = Math.floor(c / W), out = []; if (x > 0) out.push(c - 1); if (x < W - 1) out.push(c + 1); if (y > 0) out.push(c - W); if (y < H - 1) out.push(c + W); return out; };
    let left = W * H - n;
    while (left > 0) {
      const frontier = [];
      grid.forEach((g, c) => { if (g >= 0) for (const d of nb(c)) if (grid[d] < 0) frontier.push([d, g]); });
      const [d, g] = frontier[Math.floor(rng() * frontier.length)];
      grid[d] = g; left--;
    }
    const sizes = Array(n).fill(0); grid.forEach(g => sizes[g]++);
    if (sizes.every(s => s >= 2 && s <= Math.ceil(W * H / n) + 2)) {
      return Array.from({ length: n }, (_, i) => normalise(grid.map((g, c) => g === i ? [c % W, Math.floor(c / W)] : null).filter(Boolean)));
    }
  }
  throw new Error('could not cut the chamber');
}
export function normalise(cells) {
  const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
export const rotate = cells => normalise(cells.map(([x, y]) => [-y, x]));   // a quarter turn
// Does this set of placed pieces fill a W x H chamber exactly? placed: [{ cells, x, y }]
export function packed(W, H, placed) {
  const seen = new Set();
  for (const p of placed) for (const [cx, cy] of p.cells) {
    const x = cx + p.x, y = cy + p.y;
    if (x < 0 || y < 0 || x >= W || y >= H || seen.has(x + ',' + y)) return false;
    seen.add(x + ',' + y);
  }
  return seen.size === W * H;
}
