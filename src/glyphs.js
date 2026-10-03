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

// A dial with four zones split by tick marks: L, M, H and the red. The needle sits in the middle of its zone.
export function gaugeSVG(g, ink = '#f4f1e6', dim = '#8a8f86') {
  const cx = 52, cy = 58, R = 40, pt = (deg, r) => [cx + Math.sin(deg * Math.PI / 180) * r, cy - Math.cos(deg * Math.PI / 180) * r];
  const arc = (a0, a1, col) => { const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R); return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} A${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${col}" stroke-width="7"/>`; };
  const ticks = [-90, -45, 0, 45, 90].map(a => { const [x0, y0] = pt(a, R - 9), [x1, y1] = pt(a, R + 5); return `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="${ink}" stroke-width="2.5"/>`; }).join('');
  const labels = [['L', -67], ['M', -22], ['H', 22]].map(([t, a]) => { const [x, y] = pt(a, R + 11); return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" font-size="11" font-family="IBM Plex Mono" font-weight="600" fill="${ink}" text-anchor="middle">${t}</text>`; }).join('');
  const na = { LOW: -67, MIDDLE: -22, HIGH: 22, RED: 67 }[g], [nx, ny] = pt(na, R - 4);
  return `<svg class="gauge" viewBox="0 0 104 64">${arc(-90, 45, dim)}${arc(45, 90, '#ff4b3a')}${ticks}${labels}
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="#b08d57"/></svg>`;
}

// Repair board rules, shared by the game, the manuals and the tests. First rule that fits; otherwise OPEN.
// gauge: LOW | MIDDLE | HIGH | RED · lamp: R | W | B | D (dark)
export const REPAIR_RULES = [
  { q: 'Is the needle in the RED?', test: r => r.gauge === 'RED', then: 'CUT' },
  { q: 'Is the lamp DARK?', test: r => r.lamp === 'D', then: 'CLOSE' },
  { q: 'Is the lamp RED and the needle in H?', test: r => r.lamp === 'R' && r.gauge === 'HIGH', then: 'CUT' },
  { q: 'Is the lamp BLUE and the needle in M or H?', test: r => r.lamp === 'B' && r.gauge !== 'LOW', then: 'CLOSE' },
  { q: 'Is the lamp WHITE and the needle in H?', test: r => r.lamp === 'W' && r.gauge === 'HIGH', then: 'CLOSE' },
];
export const REPAIR_DEFAULT = 'OPEN';
export function repairAction(row) { for (const rule of REPAIR_RULES) if (rule.test(row)) return rule.then; return REPAIR_DEFAULT; }

// ---------- the sonar printout ----------
// Height of the echo trace above the baseline at x (0..ECHO_W). The first spike is the surface (taller for longer ice);
// then one bump per chamber; then the tail. `k` is the sweep number: a monster's pulse swells and fades from one
// sweep to the next.
export const ECHO_W = 186;
export function echoAt(e, len, x, k = 0, seed = 0) {
  let y = 0;
  if (x > 10 && x < 24) y += Math.min(72, 16 + len * 1.8) * Math.sin((x - 10) / 14 * Math.PI);
  for (const h of e.humps) if (x > h.x && x < h.x + 18) y += 36 * h.h * Math.sin((x - h.x) / 18 * Math.PI);
  const tail = (e.humps.length ? e.humps[e.humps.length - 1].x + 18 : 26) + 8;
  if (x > tail) {
    if (e.tail === 'wavy') y += 8 * Math.sin((x - tail) / 4.2);
    if (e.tail === 'pulse') {
      const amp = 0.45 + 0.55 * Math.abs(Math.sin(k * 1.9 + seed));
      const u = (x - tail) % 16;
      if (u > 3 && u < 6) y += 20 * amp * Math.sin((u - 3) / 3 * Math.PI);
      if (u > 7 && u < 10) y += 11 * amp * Math.sin((u - 7) / 3 * Math.PI);
    }
  }
  return y;
}
// Example printouts for the manuals: one per echo class.
export const ECHO_EXAMPLES = {
  solid: { humps: [], tail: 'flat' },
  caverns: { humps: [{ x: 44, h: 1 }, { x: 76, h: 0.5 }, { x: 93, h: 0.78 }], tail: 'flat' },
  halls: { humps: [{ x: 44, h: 0.85 }, { x: 68, h: 0.85 }, { x: 92, h: 0.85 }], tail: 'flat' },
  flooded: { humps: [{ x: 44, h: 1 }, { x: 76, h: 0.5 }], tail: 'wavy' },
  monster: { humps: [{ x: 44, h: 0.85 }, { x: 68, h: 0.85 }, { x: 92, h: 0.85 }], tail: 'pulse' },
};
