// Calibration runes. Each glyph is a list of polylines on a 10 x 10 grid.
// Shared by the game and the printed Operations Manual.

export const HOUSES = ['Ice', 'Iron', 'Ember', 'Bone']; // clockwise order on the wheel

export const RUNES = [
  // Ice
  { name: 'Shard', house: 'Ice', weight: 1, looks: 'a tall thin diamond', d: [[[5, 1], [7, 5], [5, 9], [3, 5], [5, 1]]] },
  { name: 'Frost Star', house: 'Ice', weight: 2, looks: 'an asterisk with six arms', d: [[[5, 1], [5, 9]], [[1.5, 3], [8.5, 7]], [[1.5, 7], [8.5, 3]]] },
  { name: 'Icicle Comb', house: 'Ice', weight: 3, looks: 'a bar with three teeth hanging down', d: [[[1, 2], [9, 2]], [[2, 2], [2, 7]], [[5, 2], [5, 9]], [[8, 2], [8, 7]]] },
  { name: 'Floe', house: 'Ice', weight: 4, looks: 'a flat hexagon', d: [[[1, 5], [3, 2.5], [7, 2.5], [9, 5], [7, 7.5], [3, 7.5], [1, 5]]] },
  // Iron
  { name: 'Gallows', house: 'Iron', weight: 1, looks: 'an upside-down L with a hook', d: [[[2, 9], [2, 1], [8, 1], [8, 4]]] },
  { name: 'Chain', house: 'Iron', weight: 2, looks: 'two linked rings, one above the other', d: [[[5, 1], [7, 3], [5, 5], [3, 3], [5, 1]], [[5, 5], [7, 7], [5, 9], [3, 7], [5, 5]]] },
  { name: 'Anvil', house: 'Iron', weight: 3, looks: 'a T standing on a wide foot', d: [[[1, 2], [9, 2]], [[5, 2], [5, 8]], [[2, 8], [8, 8]]] },
  { name: 'Nail Cross', house: 'Iron', weight: 4, looks: 'an X with a bar through the middle', d: [[[2, 2], [8, 8]], [[8, 2], [2, 8]], [[1, 5], [9, 5]]] },
  // Ember
  { name: 'Flame', house: 'Ember', weight: 1, looks: 'a zigzag climbing upward', d: [[[2, 9], [4, 5], [5, 7], [7, 2], [8, 9]]] },
  { name: 'Coal Eye', house: 'Ember', weight: 2, looks: 'a square with a dot in the middle', d: [[[2, 2], [8, 2], [8, 8], [2, 8], [2, 2]], [[5, 4.6], [5, 5.4]]] },
  { name: 'Forge Arrow', house: 'Ember', weight: 3, looks: 'an arrow pointing up with a crossbar', d: [[[5, 9], [5, 1]], [[2, 4], [5, 1], [8, 4]], [[3, 6.5], [7, 6.5]]] },
  { name: 'Brand', house: 'Ember', weight: 4, looks: 'a trident', d: [[[5, 9], [5, 2]], [[2, 2], [2, 5], [8, 5], [8, 2]]] },
  // Bone
  { name: 'Rib', house: 'Bone', weight: 1, looks: 'a backwards C with a spine line', d: [[[3, 1], [3, 9]], [[3, 2], [7, 3], [7, 7], [3, 8]]] },
  { name: 'Skull Gate', house: 'Bone', weight: 2, looks: 'an arch with two dots inside', d: [[[2, 9], [2, 4], [5, 1], [8, 4], [8, 9]], [[4, 5], [4, 5.8]], [[6, 5], [6, 5.8]]] },
  { name: 'Knucklebone', house: 'Bone', weight: 3, looks: 'an hourglass', d: [[[2, 1], [8, 1], [2, 9], [8, 9], [2, 1]]] },
  { name: 'Jaw', house: 'Bone', weight: 4, looks: 'a W with a line under it', d: [[[1, 2], [3, 7], [5, 3], [7, 7], [9, 2]], [[1, 9], [9, 9]]] },
];

// Which house leads, from the wind direction (degrees the wind blows FROM).
export function leadingHouse(windFrom) {
  const oct = Math.round(((windFrom % 360) + 360) % 360 / 45) % 8; // 0=N,1=NE,...
  return ['Ice', 'Ice', 'Ember', 'Ember', 'Bone', 'Bone', 'Iron', 'Iron'][oct];
}
export function octantName(windFrom) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((windFrom % 360) + 360) % 360 / 45) % 8];
}

export function shuffle(a, rng) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Calibration keypad. A plate holds 9 runes: at least two from every house.
export function makePlate(rng) {
  const ids = [];
  for (const h of HOUSES) {
    const pool = RUNES.map((_, i) => i).filter(i => RUNES[i].house === h);
    while (ids.filter(i => RUNES[i].house === h).length < 2) {
      const k = pool[Math.floor(rng() * pool.length)]; if (!ids.includes(k)) ids.push(k);
    }
  }
  while (ids.length < 9) { const k = Math.floor(rng() * RUNES.length); if (!ids.includes(k)) ids.push(k); }
  return shuffle(ids, rng);
}

export function tempBandName(temp) { return temp < -40 ? 'BITTER' : temp <= -25 ? 'COLD' : 'RIME'; }

// The manual's procedure. `cond` is what the Currents panel shows:
// { windFrom (deg), deepKn, surfKn, temp } with the numbers exactly as displayed.
// Returns the four runes (RUNES indices) in the order they must be pressed.
export function keypadCode(plate, cond) {
  const lead = HOUSES.indexOf(leadingHouse(cond.windFrom));
  const step = cond.deepKn > cond.surfKn ? 1 : -1;          // deep faster: clockwise round the wheel
  const band = tempBandName(cond.temp);
  const out = [];
  for (let k = 0; k < 4; k++) {
    const house = HOUSES[(lead + step * k + 8) % 4];
    const mine = plate.filter(i => RUNES[i].house === house).sort((a, b) => RUNES[a].weight - RUNES[b].weight);
    out.push(band === 'BITTER' ? mine[mine.length - 1] : band === 'COLD' ? mine[0] : mine[1]);
  }
  return out;
}

export function glyphSVG(i, size = 40, stroke = 'currentColor', width = 1.1) {
  const paths = RUNES[i].d.map(line => `<polyline points="${line.map(p => p.join(',')).join(' ')}" />`).join('');
  return `<svg viewBox="0 0 10 10" width="${size}" height="${size}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}
