// Authored scenario for The Last Watch.
// Coordinates are miles. x grows east, y grows south (screen style).
// The map is the square drawn around the observatory's reach. Time is real seconds since the furnace was first lit.

export const MAP = 3600;
export const MAP_W = MAP, MAP_H = MAP;
export const CENTER = { x: MAP / 2, y: MAP / 2 };
export const OBSERVATORY = CENTER;           // the Last Watch stands on an island in the middle of the sea
export const REACH = 1800;                   // radius of the reach circle; only the map corners lie outside it
export const GRID = 12;                      // chart squares per side
export const CELL = MAP / GRID;              // 300 mi
export const ISLAND_R = 90;
export const TOMB_RADIUS = 300;

export const TUNING = {
  buoyDeployRange: 1650,   // how far from the observatory a buoy can be dropped
  buoyRadius: 360,         // sonar reach around the buoy
  sonarDelay: 5,           // seconds between ping and result
  focusDelay: 3,           // seconds for a focused ping to return
  contactFade: 90,         // seconds a sonar contact stays on the chart
  flowShow: 25,            // seconds the current arrows from a ping stay on the chart
  buoyRebuild: 30,         // seconds to build a new buoy after the shark eats one
  currentRefresh: 4,       // seconds between current readings while powered
  // furnace
  furnaceStartHeat: 62,
  furnaceBurn: 0.3,        // heat lost per second
  stokeAmount: 22,         // heat one shovel adds (over stokeRamp seconds)
  stokeRamp: 2,
  furnaceBlowout: 100,     // heat at which the furnace blows out
  furnaceCooldown: 7,      // seconds before a blown-out furnace can be relit (after the grate is repaired)
  slotHeat: [40, 20, 0.01],// heat needed for 3, 2, 1 power slots
  chuteMax: 4,             // shovels the fuel chute holds
  chuteStart: 2,
  // rune board
  boardFlipEvery: 60,      // seconds between flips
  boardFlipPresses: 4,     // presses that also flip it
  // camera control (overhead deck)
  camTurnRate: 24,         // degrees per second while an arrow is held
  plateLockout: 4,         // seconds the plates lock after a wrong code
  // camera tracking
  trackTime: 4,            // seconds a locked iceberg must stay in the camera's view to measure its drift
  trackNoise: 0.03,        // the camera's drift measurement is good to about 3%
  coffeeHeat: 6,           // heat brewing coffee costs
  coffeeBrew: 12,          // seconds to brew
  coffeeSips: 3,
  ventHeat: 15,            // heat the VENT rune dumps
  // operator fatigue
  fatigueRate: 1 / 420,    // fatigue gained per second (0..1)
  sipRelief: 0.45,
  // beacons
  beaconSpeed: 200,        // miles per second
  beaconStock: 12,         // plain red beacons; the rack rebuilds
  beaconRebuild: 40,
  orangeStock: 6,          // sounding charges: an echo on impact, no ping. Never rebuild.
  blueStock: 6,            // drift logs: the ice's path is recorded from impact. Never rebuild.
  greenStock: 4,           // "this is Elgarz" beacons. They never rebuild.
  driftLogEvery: 5,        // seconds between drift-log points
  hitLarge: 6,             // beacon hit radius for large ice: hitLarge + length * hitPerMile
  hitPerMile: 0.45,
  hitSmall: 8,
  jamEvery: [4, 7],        // the launcher jams after this many shots (random in range)
  revealDelay: 3.5,        // seconds between the blue light and the win screen
  // aim quality: each bar is full up to *Full, then falls to zero over *Span
  aimFixFull: 18, aimFixSpan: 90,          // seconds since the fix
  aimReadFull: 15, aimReadSpan: 75,        // seconds since the current reading
  aimDistFull: 90, aimDistSpan: 330,       // miles between the reading and the target
  aimTrackFull: 15, aimTrackSpan: 75,      // seconds since the orb last measured the drift
  // scanner
  scanTime: 12,            // seconds of good alignment to finish a metal scan
  alignRadius: 60,         // miles of prediction error before alignment hits zero
  alignNeeded: 0.5,
  runeLockout: 8,
  detuneAfter: 50,         // seconds the buoy conditions must disagree with the setting before it drifts out of tune
  // radio
  radioAlignRadius: 180,
  radioWidth: 45,          // how wide a signal's peak is on the dial (frequency units)
  radioReadable: 0.7,      // signal strength needed to read the lamps
  gainWindow: 1.3,         // how far the gain can be off and still read the lamps
  stationGain: 3,          // gain the cabin wireless stations need
  fuseClip: 12,            // seconds of clipping before the radio fuse blows (a warning shows from halfway)
  // cameras
  camRange: 680,
  camFov: 90 * Math.PI / 180,
  camHeatUp: 1.8,          // heat per second while watched
  camCoolDown: 2.6,
  remorhazTrigger: 65,     // about 36 s of watching
  remorhazGiveUp: 30,
  remorhazSpeed: 3,
  remorhazSpawnDist: 130,
  repairTime: 15,          // camera repair sled
  minorRepairTime: 8,      // furnace grate, launcher, winch, fuse
  // the Grindmaw
  sharkSpeed: 3.5,         // miles per second near its target
  sharkFastSpeed: 9,       // miles per second while far from its target
  sharkNearDist: 450,      // 1.5 chart squares
  sharkRoamSpeed: 0.6,
  sharkKillDist: 25,
  // spawning
  elgarzSpawnAt: 180,
  lateDecoys: [360, 660],  // seconds at which two more named bergs drift in
  spawnRimFrac: 0.86,
  spawnMinSightings: 2,
  // drift
  rimHold: 0.8,            // fraction of REACH where the sea starts pushing ice back inward
  rimPull: 0.0045,
  tombSpeed: 1.3,          // miles per second the Tomb travels (GM lever multiplies it)
  tombRepelBand: 160,      // Elgarz starts to swerve this far outside the Tomb's ring
  tombDrawPull: 1.2,       // how hard the Gilded Hulk is drawn back if it ever strays from the Tomb (mi/s)
  hulkOrbitR: 170,         // the Gilded Hulk circles the Tomb at this distance, always inside the ring
  hulkOrbitSpeed: 0.7,     // miles per second round the Tomb
  // pressure
  pressureAt: 600,         // after 10 minutes: storms come more often and Old Tom wakes
  tomAt: 600,
  // case board
  sweepBin: 30,            // frequency units per sweep cell; covering every cell counts as a full sweep
  sweepAlign: 0.4,         // the lock must be at least this well aligned for a sweep to count
};

// ---------- the sea ----------
// Two pairs of gyres. The deep pair sits east and west of the island and drives a jet south past it;
// the surface pair sits north and south and drives a jet east. Their centres wander slowly, so ice
// does not ride the same ring forever. Each vortex: centre, peak speed (mi/s), radius of peak speed,
// direction (+1 clockwise on screen), wander amplitude and period.
export function makeField(rng) {
  const g = (cx, cy, vmax, dir) => ({
    cx: CENTER.x + cx, cy: CENTER.y + cy, vmax: vmax * (0.88 + rng() * 0.24), rpk: 680 + rng() * 80, dir,
    ax: 140 + rng() * 80, ay: 140 + rng() * 80, ph: rng() * Math.PI * 2, per: 260 + rng() * 140,
  });
  return {
    deep: [g(-780, 0, 2.0, 1), g(780, 0, 2.0, -1)],
    surface: [g(0, -780, 1.7, -1), g(0, 780, 1.7, 1)],
    windBase: rng() * 360,            // compass degrees the wind blows FROM at the start
    windVeer: (rng() < 0.5 ? -1 : 1) * (110 + rng() * 60),
    windPh: rng() * Math.PI * 2,
    coldAxis: rng() * Math.PI * 2,    // the cold side of the sea
    tempPh: rng() * Math.PI * 2,
  };
}
export function vortexAt(v, t) {
  const k = 2 * Math.PI * t / v.per;
  return { x: v.cx + v.ax * Math.sin(k + v.ph), y: v.cy + v.ay * Math.cos(k * 0.77 + v.ph), vmax: v.vmax, rpk: v.rpk, dir: v.dir };
}

// Wind: direction it blows FROM (compass degrees), veering over the session.
export function windAt(t, F) {
  const from = F.windBase + F.windVeer * Math.min(1, t / 1200) + 14 * Math.sin(t / 110 + F.windPh);
  const speed = 10 + 3 * Math.sin(t / 110);
  const toward = (from + 180) * Math.PI / 180;
  return { x: Math.sin(toward) * speed, y: -Math.cos(toward) * speed, from: ((from % 360) + 360) % 360, speed };
}

// Water temperature (°) at a point. Colder on one side of the sea and much colder near the Tomb.
export function tempAt(x, y, t, F, tomb) {
  const ax = Math.cos(F.coldAxis), ay = Math.sin(F.coldAxis);
  const along = ((x - CENTER.x) * ax + (y - CENTER.y) * ay) / REACH;     // -1..1
  const d = tomb ? Math.hypot(x - tomb.x, y - tomb.y) : 1e9;
  return -28 - 13 * along - 20 * Math.exp(-((d / 500) ** 2)) - 8 * Math.min(1, t / 1200) + 4 * Math.sin(t / 170 + F.tempPh);
}

// Storms: each one is aimed to pass over a camera post during the session.
// Two storms in the first ten minutes, then one every two to three minutes for as long as the watch runs.
export function makeStorms(rng) {
  const cams = [...CAMERAS].sort(() => rng() - 0.5);
  const times = [160 + rng() * 140, 380 + rng() * 140];
  for (let t = 600 + rng() * 60; t < 4000; t += 120 + rng() * 60) times.push(t);
  return times.map((tc, i) => { const c = cams[i % cams.length]; return stormThrough(c, tc, rng() * Math.PI * 2, c.id); });
}
// A storm that passes over point p at time tc, travelling at angle ang.
export function stormThrough(p, tc, ang, cam = null) {
  const half = 700, dur = 150;
  return {
    cam, t0: tc - dur, t1: tc + dur, r: 360,
    x0: p.x - Math.cos(ang) * half, y0: p.y - Math.sin(ang) * half,
    x1: p.x + Math.cos(ang) * half, y1: p.y + Math.sin(ang) * half,
  };
}

// Camera posts, spaced evenly round the island. `facing` is the compass bearing each one starts at;
// the operator can turn them from the rune board.
// Starting bearings found by tools/tune-cameras.mjs.
const START_FACING = [180, 75, 90, 0, 15, 285, 165];
const post = (id, name, k) => {
  const bearing = k * 360 / 7 + 10, a = bearing * Math.PI / 180, r = 1050;
  return { id, name, x: Math.round(CENTER.x + Math.sin(a) * r), y: Math.round(CENTER.y - Math.cos(a) * r), facing: START_FACING[k] };
};
export const CAMERAS = [
  post('c1', 'GALLOWS REACH', 0),
  post('c2', 'HOARFROST SPIRE', 1),
  post('c3', 'SALTGRAVE', 2),
  post('c4', 'SOUTHERN POST', 3),
  post('c5', 'CHAIN ROCK', 4),
  post('c6', 'WESTERN WATCH', 5),
  post('c7', 'MIDSEA PILLAR', 6),
];

// ---------- the ice ----------
// 60 floes: 20 small (fail the size test), 20 large and solid, 20 large and hollow.
// Elgarz is over 20 miles long; anything 20 or under is not Elgarz.
// Echo: `humps` after the surface spike, and the tail shape. Radio: `decoded` after the manual's procedure,
// in `band`, sent on `carrier` (null = random). Ice over 8 miles rides the deep current.
export const SIZE_CUT = 20;
const H = (humps = 2) => ({ humps, tail: 'ring' }), SOLID = { humps: 0, tail: 'flat' };
const TRIAD = { decoded: 'BRW', band: 'MID', carrier: null };
export const NOTABLES = [
  // hollow, metal and the Triad
  { id: 'elgarz', name: 'Elgarz', length: 26, elgarz: true, spawn: 'elgarz', hollow: true, metal: true, echo: H(3), radio: TRIAD, look: 'elgarz' },
  { id: 'hulk', name: 'The Gilded Hulk', length: 24, hollow: true, metal: true, echo: H(3), radio: TRIAD, look: 'hulk', tombDrawn: true },
  // hollow and metal, the wrong signal or none
  { id: 'convoy', name: 'The Drowned Convoy', length: 23, hollow: true, metal: true, echo: H(2), radio: { decoded: 'BRW', band: 'LOW', carrier: 'JAGGED' }, look: 'convoy' },
  { id: 'shadow', name: "Coldsteel's Shadow", length: 27, spawn: 'late', hollow: true, metal: true, echo: H(3), radio: null, look: 'shadow' },
  // hollow and the Triad, no metal
  { id: 'herald', name: 'The Frozen Herald', length: 22, spawn: 'late', hollow: true, metal: false, echo: H(2), radio: { decoded: 'BRW', band: 'MID', carrier: 'JAGGED' }, look: 'plain' },
  { id: 'choir', name: 'The Penitent Choir', length: 21, hollow: true, metal: false, echo: H(2), radio: { decoded: 'BRW', band: 'MID', carrier: 'STEPPED' }, look: 'choir' },
  // hollow, nothing else
  { id: 'sepulcher', name: "Angel's Sepulcher", length: 22, hollow: true, metal: false, echo: H(1), radio: { decoded: 'WWB', band: 'MID', carrier: 'JAGGED' }, look: 'sepulcher' },
  { id: 'tolling', name: 'The Tolling Berg', length: 21, hollow: true, metal: false, echo: H(1), radio: { decoded: 'BBR', band: 'MID', carrier: 'STEPPED' }, look: 'bell' },
  // large and solid
  { id: 'horn', name: "Geryon's Shed Horn", length: 23, hollow: false, metal: true, echo: SOLID, radio: { decoded: 'BRW', band: 'MID', carrier: 'STEPPED' }, look: 'horn' },
  { id: 'cradle', name: "Leviathan's Cradle", length: 24, hollow: false, metal: false, echo: { humps: 2, tail: 'fuzz' }, radio: { decoded: 'WWB', band: 'LOW', carrier: 'SMOOTH' }, look: 'cradle' },
  { id: 'cairn', name: 'The Iron Cairn', length: 21, hollow: false, metal: true, echo: SOLID, radio: { decoded: 'RRW', band: 'MID', carrier: 'SMOOTH' }, look: 'cairn' },
  { id: 'arsenal', name: 'The Broken Arsenal', length: 22, hollow: false, metal: true, echo: SOLID, radio: { decoded: 'WRB', band: 'MID', carrier: 'SMOOTH' }, look: 'arsenal' },
  // small
  { id: 'raft', name: "The Pilgrims' Raft", length: 5, hollow: false, metal: true, echo: { humps: 0, tail: 'fuzzflat' }, radio: { decoded: 'RBW', band: 'MID', carrier: 'STEPPED' }, look: 'plain' },
];
// Named fields: groups of large ice that start together and drift apart slowly.
// Each member: hollow, metal, radio (null = silent), echo humps.
export const FIELDS = [
  { id: 'graveyard', name: 'The Graveyard', look: 'grave', shape: 'grid', members: [
    { hollow: true, metal: false, radio: TRIAD }, { hollow: true, metal: false, radio: TRIAD }, { hollow: true, metal: false, radio: TRIAD },
    { hollow: true, metal: false, radio: { decoded: 'BBR', band: 'MID', carrier: null } }, { hollow: true, metal: false, radio: null },
  ] },
  { id: 'chain', name: 'The Chain', look: 'chain', shape: 'line', members: [
    { hollow: false, metal: true, radio: TRIAD }, { hollow: false, metal: true, radio: { decoded: 'RRW', band: 'MID', carrier: null } },
    { hollow: false, metal: true, radio: null }, { hollow: false, metal: true, radio: { decoded: 'RRW', band: 'HIGH', carrier: null } }, { hollow: false, metal: false, radio: null },
  ] },
  { id: 'crown', name: 'The Crown', look: 'crown', shape: 'ring', members: [
    { hollow: true, metal: true, radio: { decoded: 'BRW', band: 'HIGH', carrier: null } }, { hollow: true, metal: true, radio: { decoded: 'BRW', band: 'LOW', carrier: null } },
    { hollow: true, metal: true, radio: { decoded: 'WRB', band: 'MID', carrier: null } }, { hollow: false, metal: false, radio: { decoded: 'WWB', band: 'HIGH', carrier: null } },
  ] },
];
// Unnamed ice that fills out the 60. { count, hollow, metal, triad, transmit (share), large }
export const FILLER = [
  { count: 1, large: true, hollow: true, metal: false, triad: true },          // hollow + Triad, no metal
  { count: 3, large: true, hollow: true, metal: false, transmit: 0.5 },        // hollow, nothing else
  { count: 2, large: true, hollow: false, metal: true, transmit: 0.5 },        // solid with wreckage
  { count: 2, large: true, hollow: false, metal: false, triad: true },         // solid, sings the Triad
  { count: 6, large: true, hollow: false, metal: false, transmit: 0.5 },       // solid giants
  { count: 2, large: false, hollow: false, metal: false, triad: true },        // small, Triad (cut by size)
  { count: 3, large: false, hollow: false, metal: true, transmit: 0.4 },       // small with wreckage
  { count: 4, large: false, hollow: true, metal: false, transmit: 0.4 },       // small and hollow (cut by size)
  { count: 10, large: false, hollow: false, metal: false, transmit: 0.5 },     // small floes
];

// ---------- shoals: rocks that scatter the sonar, each beside an orb (outside its starting view) ----------
export const SHOALS = [['c2', 115], ['c4', -120], ['c6', 125]].map(([cam, turn], i) => {
  const c = CAMERAS.find(k => k.id === cam), a = (c.facing + turn) * Math.PI / 180, d = 380;
  return { id: 's' + (i + 1), name: ['Gullet Rocks', 'The Teeth', 'Saint Brine Shoal'][i], cam, x: Math.round(c.x + Math.sin(a) * d), y: Math.round(c.y - Math.cos(a) * d), r: 260 };
});

// ---------- focused ping: pitch knob ----------
// One knob with four settings. Read the setting from the target's length and the water temperature at the buoy.
export const PITCHES = ['○', '△', '□', '◇'];
export const PITCH_LENGTH_BANDS = [[21, 25], [26, 99]];               // miles, as shown on the printout
export function pitchFor(lengthMi, waterTemp) {
  const row = lengthMi > 25 ? 1 : 0, col = waterTemp < -40 ? 0 : waterTemp <= -25 ? 1 : 2;
  return Math.min(3, row + col);
}

// ---------- radio ----------
// band: LOW < 400, MID 400-699, HIGH >= 700
export function bandOf(freq) { return freq < 400 ? 'LOW' : freq < 700 ? 'MID' : 'HIGH'; }
export const BAND_RANGE = { LOW: [130, 380], MID: [420, 680], HIGH: [720, 970] };
export const CARRIERS = ['SMOOTH', 'STEPPED', 'JAGGED'];

// The manual's procedure. Shown lamps -> decoded lamps.
export function decodeLamps(shown, carrier) {
  if (carrier === 'STEPPED') return [...shown].reverse().join('');
  if (carrier === 'JAGGED') return [...shown].map(c => c === 'R' ? 'B' : c === 'B' ? 'R' : c).join('');
  return shown;
}
// Every transform is its own inverse, so encoding is the same operation.
export const encodeLamps = decodeLamps;

export const RADIO_TABLE = {
  BRW: { LOW: 'The Bull alone. A fragment of Geryon.', MID: 'THE TRIAD: Glass, Ember and the Bull.', HIGH: 'A fallen choir: Glass and Ember. No Bull.' },
  WRB: { LOW: 'Ice settling. No meaning.', MID: "Geryon's name spoken backwards. A mockery, not the Triad.", HIGH: 'Frost singing in a crevasse. No meaning.' },
  RBW: { LOW: 'Pack ice grinding. No meaning.', MID: 'A herald calling for a lord who never answers.', HIGH: 'Gulls of the Styx. No meaning.' },
  RRW: { LOW: 'Echo of an old storm. No meaning.', MID: 'War drums of a devil legion.', HIGH: 'An infernal armoury humming in its sleep.' },
  WWB: { LOW: 'Whale-song of the Styx.', MID: 'A celestial lament. Something holy is buried here.', HIGH: 'Wind across a chimney of ice. No meaning.' },
  BBR: { LOW: 'Floes knocking together. No meaning.', MID: 'A drowned bell, ringing in a hollow.', HIGH: 'Static from the Tomb. No meaning.' },
};
// Meaningless hums for plain ice (decoded, band).
export const NOISE_SIGNALS = [['WRB', 'LOW'], ['WRB', 'HIGH'], ['RBW', 'LOW'], ['RBW', 'HIGH'], ['RRW', 'LOW'], ['WWB', 'HIGH'], ['BBR', 'LOW'], ['BBR', 'HIGH'], ['WBW', 'MID'], ['RWR', 'LOW']];
// The cabin wireless. When MUSIC is on these play on the band and can be tuned like anything else.
export const STATIONS = [
  { id: 'st1', decoded: 'BRW', band: 'MID', carrier: 'SMOOTH', name: 'an old recording of a choir' },
  { id: 'st2', decoded: 'WWB', band: 'LOW', carrier: 'STEPPED', name: 'a dance band from the Bronze Citadel' },
  { id: 'st3', decoded: 'RRW', band: 'HIGH', carrier: 'JAGGED', name: 'a sermon from Dis' },
];

// ---------- rune board ----------
// Each rune's house and weight pick a function from this grid. On page N, count the rune's weight
// forward N-1 steps (4 wraps round to 1) before reading the grid.
export const BOARD_GRID = {
  Ice: ['WIPERS', 'FUEL', 'LAMPS', 'CONFETTI'],
  Iron: ['LAUNCH', 'FUEL', 'VENT', 'DEVIL'],
  Ember: ['COFFEE', 'FUEL', 'LAMPS', 'BELL'],
  Bone: ['WIRELESS', 'COFFEE', 'BELL', 'NOTHING'],
};
export const BOARD_PAGES = ['I', 'II', 'III', 'IV'];

// ---------- camera unlock panel ----------
// Shape plates: the order depends on the rune board page.
export const PLATES = ['CIRCLE', 'TRIANGLE', 'SQUARE'];
export const PLATE_ORDER = [
  ['CIRCLE', 'TRIANGLE', 'SQUARE'],   // page I
  ['TRIANGLE', 'SQUARE', 'CIRCLE'],   // page II
  ['SQUARE', 'CIRCLE', 'TRIANGLE'],   // page III
  ['CIRCLE', 'SQUARE', 'TRIANGLE'],   // page IV
];
// Levers: set from the weather readout on the camera feed (wind in knots, air temperature in degrees).
export function windLever(kn) { return kn < 30 ? 'DOWN' : kn <= 38 ? 'MIDDLE' : 'UP'; }
export function tempLever(deg) { return deg < -40 ? 'DOWN' : deg <= -25 ? 'MIDDLE' : 'UP'; }
