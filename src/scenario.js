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
  contactFade: 40,         // seconds a sonar contact stays on the chart
  buoyRebuild: 30,         // seconds to build a new buoy after the shark eats one
  currentRefresh: 4,       // seconds between current readings while powered
  // furnace
  furnaceStartHeat: 62,
  furnaceBurn: 0.3,        // heat lost per second
  stokeAmount: 22,         // heat one shovel adds (over stokeRamp seconds)
  stokeRamp: 2,
  furnaceBlowout: 100,     // heat at which the furnace blows out
  furnaceCooldown: 7,      // seconds before a blown-out furnace can be relit
  slotHeat: [40, 20, 0.01],// heat needed for 3, 2, 1 power slots
  // beacons
  beaconSpeed: 150,        // miles per second
  beaconStock: 12,         // red / amber / blue share this rack
  beaconRebuild: 40,
  greenStock: 6,           // "this is Elgarz" beacons. They never rebuild.
  hitLarge: 5,            // beacon hit radius for large ice: hitLarge + length * hitPerMile
  hitPerMile: 0.4,
  hitSmall: 6,
  revealDelay: 3.5,        // seconds between the blue light and the win screen
  // scanner
  scanTime: 12,            // seconds of good alignment to finish a metal scan
  alignRadius: 60,         // miles of prediction error before alignment hits zero
  alignNeeded: 0.5,
  runeLockout: 8,
  recalibrateOnNewBuoy: false,
  // radio
  radioAlignRadius: 160,
  radioWidth: 30,          // how wide a signal's peak is on the dial (frequency units)
  gainWindow: 0.9,         // how far the gain can be off and still read the lamps
  stationGain: 3,          // gain the cabin wireless stations need
  // cameras
  camRange: 560,
  camFov: 84 * Math.PI / 180,
  camHeatUp: 1.5,          // heat per second while watched
  camCoolDown: 2.6,
  remorhazTrigger: 65,     // about 43 s of watching
  remorhazGiveUp: 30,
  remorhazSpeed: 2.2,
  remorhazSpawnDist: 130,
  repairTime: 15,
  // the Grindmaw
  sharkSpeed: 3.0,         // miles per second, always toward the latest ping
  sharkRoamSpeed: 0.6,
  sharkKillDist: 25,
  // spawning
  elgarzSpawnAt: 180,
  lateDecoys: [360, 660],  // seconds at which two more named bergs drift in
  spawnRimFrac: 0.86,
  spawnMinSightings: 2,
  // drift
  rimHold: 0.8,            // fraction of REACH where the sea starts pushing ice back inward
  rimPull: 0.0035,
  tombDriftFactor: 0.42,
  tombRepelBand: 160,      // Elgarz starts to swerve this far outside the Tomb's ring
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
    deep: [g(-780, 0, 1.55, 1), g(780, 0, 1.55, -1)],
    surface: [g(0, -780, 1.3, -1), g(0, 780, 1.3, 1)],
    windBase: 200 + rng() * 140,      // compass degrees the wind blows FROM at the start
    windVeer: (rng() < 0.5 ? -1 : 1) * (50 + rng() * 30),
    coldAxis: rng() * Math.PI * 2,    // the cold side of the sea
  };
}
export function vortexAt(v, t) {
  const k = 2 * Math.PI * t / v.per;
  return { x: v.cx + v.ax * Math.sin(k + v.ph), y: v.cy + v.ay * Math.cos(k * 0.77 + v.ph), vmax: v.vmax, rpk: v.rpk, dir: v.dir };
}

// Wind: direction it blows FROM (compass degrees), veering over the session.
export function windAt(t, F) {
  const from = F.windBase + F.windVeer * Math.min(1, t / 1200) + 5 * Math.sin(t / 95);
  const speed = 10 + 3 * Math.sin(t / 110);
  const toward = (from + 180) * Math.PI / 180;
  return { x: Math.sin(toward) * speed, y: -Math.cos(toward) * speed, from: ((from % 360) + 360) % 360, speed };
}

// Water temperature (°) at a point. Colder on one side of the sea and much colder near the Tomb.
export function tempAt(x, y, t, F, tomb) {
  const ax = Math.cos(F.coldAxis), ay = Math.sin(F.coldAxis);
  const along = ((x - CENTER.x) * ax + (y - CENTER.y) * ay) / REACH;     // -1..1
  const d = tomb ? Math.hypot(x - tomb.x, y - tomb.y) : 1e9;
  return -30 - 13 * along - 20 * Math.exp(-((d / 500) ** 2)) - 3 * Math.min(1, t / 1200);
}

// Storms: each one is aimed to pass over a camera post during the session.
export function makeStorms(rng) {
  const cams = [...CAMERAS].sort(() => rng() - 0.5);
  const windows = [[300, 480], [600, 780], [900, 1080]];
  return windows.map(([lo, hi], i) => {
    const cam = cams[i], tc = lo + rng() * (hi - lo), ang = rng() * Math.PI * 2, half = 700, dur = 150;
    return {
      cam: cam.id, t0: tc - dur, t1: tc + dur, r: 360,
      x0: cam.x - Math.cos(ang) * half, y0: cam.y - Math.sin(ang) * half,
      x1: cam.x + Math.cos(ang) * half, y1: cam.y + Math.sin(ang) * half,
    };
  });
}

// Fixed camera posts. `facing` is a compass bearing in degrees.
// Placed by tools/tune-cameras.mjs to catch the routes Elgarz can take.
export const CAMERAS = [
  { id: 'c1', name: 'GALLOWS REACH', x: 1800, y: 1000, facing: 180 },
  { id: 'c2', name: 'HOARFROST SPIRE', x: 2600, y: 800, facing: 210 },
  { id: 'c3', name: 'WESTERN WATCH', x: 600, y: 1400, facing: 180 },
  { id: 'c4', name: 'SALTGRAVE', x: 2800, y: 1400, facing: 60 },
  { id: 'c5', name: 'CHAIN ROCK', x: 1200, y: 800, facing: 150 },
  { id: 'c6', name: 'SOUTHERN POST', x: 1600, y: 2200, facing: 0 },
  { id: 'c7', name: 'MIDSEA PILLAR', x: 2800, y: 2000, facing: 90 },
];

// Echo signatures: `humps` after the surface spike, and the tail shape.
// Radio: `decoded` is what the crew should get after the manual's procedure, in `band`, sent on `carrier`.
// `large` bergs ride the deep current, small ones ride the surface and wind.
export const NOTABLES = [
  { id: 'elgarz', name: 'Elgarz', large: true, length: 26, elgarz: true, spawn: 'elgarz',
    hollow: true, metal: true, echo: { humps: 3, tail: 'ring' },
    radio: { decoded: 'BRW', band: 'MID', carrier: null }, look: 'elgarz' },
  { id: 'convoy', name: 'The Drowned Convoy', large: true, length: 14,
    hollow: true, metal: true, echo: { humps: 2, tail: 'ring' },
    radio: { decoded: 'BRW', band: 'LOW', carrier: 'JAGGED' }, look: 'convoy' },
  { id: 'hulk', name: 'The Gilded Hulk', large: true, length: 18,
    hollow: true, metal: true, echo: { humps: 3, tail: 'ring' },
    radio: { decoded: 'BRW', band: 'HIGH', carrier: 'SMOOTH' }, look: 'hulk' },
  { id: 'shadow', name: "Coldsteel's Shadow", large: true, length: 22, spawn: 'late',
    hollow: true, metal: true, echo: { humps: 3, tail: 'ring' }, radio: null, look: 'shadow' },
  { id: 'horn', name: "Geryon's Shed Horn", large: true, length: 12,
    hollow: false, metal: true, echo: { humps: 0, tail: 'flat' },
    radio: { decoded: 'WRB', band: 'MID', carrier: 'STEPPED' }, look: 'horn' },
  { id: 'cradle', name: "Leviathan's Cradle", large: true, length: 16,
    hollow: false, metal: false, echo: { humps: 2, tail: 'fuzz' },
    radio: { decoded: 'WWB', band: 'LOW', carrier: 'SMOOTH' }, look: 'cradle' },
  { id: 'herald', name: 'The Frozen Herald', large: true, length: 10, spawn: 'late',
    hollow: true, metal: false, echo: { humps: 2, tail: 'ring' },
    radio: { decoded: 'RBW', band: 'MID', carrier: 'SMOOTH' }, look: 'plain' },
  { id: 'choir', name: 'The Penitent Choir', large: false, length: 7,
    hollow: true, metal: false, echo: { humps: 2, tail: 'ring' },
    radio: { decoded: 'BRW', band: 'HIGH', carrier: 'STEPPED' }, look: 'choir' },
  { id: 'sepulcher', name: "Angel's Sepulcher", large: false, length: 5,
    hollow: true, metal: false, echo: { humps: 1, tail: 'ring' },
    radio: { decoded: 'WWB', band: 'MID', carrier: 'JAGGED' }, look: 'sepulcher' },
  { id: 'cairn', name: 'The Iron Cairn', large: false, length: 4,
    hollow: false, metal: true, echo: { humps: 0, tail: 'flat' },
    radio: { decoded: 'RRW', band: 'MID', carrier: 'SMOOTH' }, look: 'cairn' },
  { id: 'arsenal', name: 'The Broken Arsenal', large: false, length: 5,
    hollow: false, metal: true, echo: { humps: 0, tail: 'flat' },
    radio: { decoded: 'RRW', band: 'HIGH', carrier: 'JAGGED' }, look: 'arsenal' },
  { id: 'tolling', name: 'The Tolling Berg', large: false, length: 4,
    hollow: true, metal: false, echo: { humps: 1, tail: 'ring' },
    radio: { decoded: 'BBR', band: 'MID', carrier: 'STEPPED' }, look: 'bell' },
  { id: 'raft', name: "The Pilgrims' Raft", large: false, length: 3,
    hollow: false, metal: true, echo: { humps: 0, tail: 'fuzzflat' }, radio: null, look: 'plain' },
];

export const GENERIC_COUNT = 48;
export const GENERIC_TRANSMIT = 0.3;     // share of plain ice that hums something meaningless

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
  BRW: { LOW: 'The Bull alone. A fragment of Geryon.', MID: "THE TRIAD: Glass, Ember and the Bull. Geryon's house.", HIGH: 'A fallen choir: Glass and Ember. No Bull.' },
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
