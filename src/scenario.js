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
  contactFade: 90,         // seconds a sonar contact stays on the chart
  flowShow: 25,            // seconds the current arrows from a ping stay on the chart
  buoyRebuild: 30,         // seconds to build a new buoy after the shark eats one
  currentRefresh: 4,       // seconds between current readings while powered
  // furnace
  furnaceStartHeat: 62,
  burnIdle: 0.0255,        // heat lost per second with nothing switched on
  burnSteps: [0.0595, 0.0935, 0.136], // ...plus this for the first, second and third system (1: 0.085, 2: 0.18, 3: 0.31 a second)
  damperBurn: 0.6,         // the LOW damper burns this fraction of the heat...
  damperSlow: 1.6,         // ...but everything powered works this much slower (spin-up, readings, scans, repairs, tracking)
  heatLogEvery: 2,         // seconds between furnace log samples (the log keeps three minutes)
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
  // operator fatigue
  fatigueRate: 1 / 360,    // fatigue gained per second (0..1): six minutes to nodding off
  sipRelief: 0.45,
  // beacons
  beaconSpeed: 200,        // miles per second
  beaconStock: 6,          // plain red beacons at the start of the watch; more come only from the workshop
  orangeStock: 3,          // sounding charges: an echo on impact, no ping
  greenStock: 3,           // transmitter beacons: the Navy's call
  cureTime: 15,            // seconds a sealed beacon cures in the rack while the WORKSHOP is powered
  // the officers' stations: a defence event for each, every few minutes
  defenceEvery: { gunnery: [180, 300], signals: [180, 420], engineer: [180, 420] },   // seconds between one station's events
  rewardCooldown: 60,      // seconds before a station's steady puzzle can pay out again (Minesweeper, Lights Out)
  defenceGap: 45,          // seconds kept between any two stations' events
  overheatHeat: 90,        // furnace heat in the red: Engineering's breakers trip too
  overheatEvery: 60,       // ...at most this often
  hitLarge: 14,            // beacon hit radius for large ice: hitLarge + length * hitPerMile
  hitPerMile: 0.6,
  hitSmall: 14,
  jamEvery: [4, 7],        // the launcher jams after this many shots (random in range)
  revealDelay: 3.5,        // seconds between the blue light and the win screen
  // hit chance: the expected miss distance (sigma) is the fix's own error plus the ice's speed times how wrong the
  // drift model might be (relErr) times the time from the fix to impact. Chance = 1 - exp(-R^2 / 2 sigma^2), then a roll.
  aimFixErr: 3,            // miles: a sonar contact or an orb sighting is good to about this
  aimTrackRel: 0.03,       // an orb's drift measurement is good to about 3%
  aimReadRel: 0.025,       // a fresh current reading taken next to the ice
  aimAgeRel: 0.0004,       // the sea turns: the model gets worse per second since the fix
  aimDistFull: 90,         // miles: a reading taken closer than this to the ice is as good as it gets
  aimDistScale: 900,       // ...and much worse beyond that: a reading this far off is no better than none
  aimReadFull: 30,         // seconds a reading (or an orb's track) stays fresh
  aimFixFull: 30,          // seconds a fix stays fresh (for the advice line only)
  aimStale: 0.003,         // per second beyond fresh
  aimMaxChance: 0.99,      // only a beacon's own telemetry is certain
  // rune board effects
  shutterTime: 20,         // seconds the sonar and orb shutters stay down
  decoyRange: 1.5,         // the decoy lands this many buoy ranges from the buoy
  // frozen monsters: released by a beacon hit, they swim for the buoy at the Grindmaw's speeds
  monsterIdleFade: 20,     // seconds a monster lingers with no buoy in the water before it fades
  monsterFadeTime: 3,      // seconds it takes to fade from the chart
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
  minorRepairTime: 8,      // furnace grate, launcher, winch, radio receiver, scanner, sonar head
  // breakage
  sonarStrainWindow: 20,   // seconds: a third ping inside this window overdrives the sonar head
  sonarStrainPings: 3,
  buoyStormTime: 20,       // seconds a buoy can sit inside a storm before it is torn loose
  buoyStormSnow: 0.3,      // how deep in the storm counts
  scannerBlowChance: 0.34, // chance the scanner blows its fuse after a positive reading
  unlockedHeat: 0.6,       // an unlocked orb heats at this fraction of the rate
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

// Water temperature (°) at a point: Stygia runs from about -125° to -250°. Colder on one side of the sea and much colder
// near the Tomb.
export function tempAt(x, y, t, F, tomb) {
  const ax = Math.cos(F.coldAxis), ay = Math.sin(F.coldAxis);
  const along = ((x - CENTER.x) * ax + (y - CENTER.y) * ay) / REACH;     // -1..1
  const d = tomb ? Math.hypot(x - tomb.x, y - tomb.y) : 1e9;
  return -160 - 26 * along - 40 * Math.exp(-((d / 500) ** 2)) - 16 * Math.min(1, t / 1200) + 8 * Math.sin(t / 170 + F.tempPh);
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
// 40 floes: 10 small (fail the size test) and 30 large. Elgarz is over 20 miles long; anything 20 or under is not Elgarz.
// Every floe has an echo class, read from the sonar printout:
//   solid    no bumps, flat tail
//   caverns  uneven bumps, flat tail                (natural caves)
//   halls    even bumps, flat tail                  (built chambers: where Elgarz is)
//   flooded  bumps, wavy tail                       (brine-filled caves)
//   monster  even bumps, pulsing tail               (something frozen inside; a beacon hit lets it out)
// Below COLD_WATER a monster is too cold to pulse, and reads exactly like halls.
// Large ice: 6 solid, 5 caverns, 4 flooded, 5 monsters, 10 halls (3 plain, 2 metal, 3 Triad, 2 with everything).
// Radio: `decoded` after the manual's procedure, in `band`, sent on `carrier` (null = random). Ice over 8 miles rides the deep current.
export const SIZE_CUT = 20;
export const ECHO_CLASSES = ['solid', 'caverns', 'halls', 'flooded', 'monster'];
export const COLD_WATER = -185;          // below this a monster does not pulse
const TRIAD = { decoded: 'BRW', band: 'MID', carrier: null };
export const NOTABLES = [
  // halls, metal and the Triad
  { id: 'elgarz', name: 'Elgarz', length: 26, elgarz: true, spawn: 'elgarz', sig: 'halls', metal: true, humps: 3, radio: TRIAD, look: 'elgarz' },
  { id: 'hulk', name: 'The Gilded Hulk', length: 24, sig: 'halls', metal: true, humps: 3, radio: TRIAD, look: 'hulk', tombDrawn: true },
  // halls and metal, the wrong signal or none
  { id: 'convoy', name: 'The Drowned Convoy', length: 23, sig: 'halls', metal: true, radio: { decoded: 'BRW', band: 'LOW', carrier: 'JAGGED' }, look: 'convoy' },
  { id: 'shadow', name: "Coldsteel's Shadow", length: 27, spawn: 'late', sig: 'halls', metal: true, humps: 3, radio: null, look: 'shadow' },
  // halls and the Triad, no metal
  { id: 'herald', name: 'The Frozen Herald', length: 22, spawn: 'late', sig: 'halls', metal: false, radio: { decoded: 'BRW', band: 'MID', carrier: 'JAGGED' }, look: 'plain' },
  { id: 'choir', name: 'The Penitent Choir', length: 21, sig: 'halls', metal: false, radio: { decoded: 'BRW', band: 'MID', carrier: 'STEPPED' }, look: 'choir' },
  // halls, nothing else
  { id: 'sepulcher', name: "Angel's Sepulcher", length: 22, sig: 'halls', metal: false, radio: { decoded: 'WWB', band: 'MID', carrier: 'JAGGED' }, look: 'sepulcher' },
  // flooded
  { id: 'tolling', name: 'The Tolling Berg', length: 21, sig: 'flooded', metal: false, radio: { decoded: 'BBR', band: 'MID', carrier: 'STEPPED' }, look: 'bell' },
  // a frozen monster
  { id: 'cradle', name: "Leviathan's Cradle", length: 24, sig: 'monster', metal: false, radio: { decoded: 'WWB', band: 'LOW', carrier: 'SMOOTH' }, look: 'cradle' },
  // large and solid
  { id: 'horn', name: "Geryon's Shed Horn", length: 23, sig: 'solid', metal: true, radio: { decoded: 'BRW', band: 'MID', carrier: 'STEPPED' }, look: 'horn' },
  { id: 'cairn', name: 'The Iron Cairn', length: 21, sig: 'solid', metal: true, radio: { decoded: 'RRW', band: 'MID', carrier: 'SMOOTH' }, look: 'cairn' },
  { id: 'arsenal', name: 'The Broken Arsenal', length: 22, sig: 'solid', metal: true, radio: { decoded: 'WRB', band: 'MID', carrier: 'SMOOTH' }, look: 'arsenal' },
  // small
  { id: 'raft', name: "The Pilgrims' Raft", length: 5, sig: 'solid', metal: true, radio: { decoded: 'RBW', band: 'MID', carrier: 'STEPPED' }, look: 'plain' },
];
// The one named field: large ice that starts loosely together and drifts apart.
export const FIELDS = [
  { id: 'graveyard', name: 'The Graveyard', look: 'grave', members: [
    { sig: 'halls', metal: false, radio: TRIAD }, { sig: 'monster', metal: false, radio: TRIAD }, { sig: 'caverns', metal: false, radio: TRIAD },
    { sig: 'caverns', metal: false, radio: { decoded: 'BBR', band: 'MID', carrier: null } }, { sig: 'flooded', metal: false, radio: null },
  ] },
];
export const FIELD_SPREAD = [120, 300];   // miles from the field's centre to each member
// Unnamed ice that fills out the 40. { count, large, sig, metal, triad, transmit (share) }
export const FILLER = [
  { count: 2, large: true, sig: 'halls', metal: false, transmit: 0.5 },
  { count: 1, large: true, sig: 'monster', metal: true, transmit: 0.5 },
  { count: 2, large: true, sig: 'monster', metal: false, transmit: 0.5 },
  { count: 1, large: true, sig: 'flooded', metal: true, transmit: 0.5 },
  { count: 1, large: true, sig: 'flooded', metal: false, triad: true },
  { count: 1, large: true, sig: 'caverns', metal: true, transmit: 0.5 },
  { count: 1, large: true, sig: 'caverns', metal: false, triad: true },
  { count: 1, large: true, sig: 'caverns', metal: false, transmit: 0.5 },
  { count: 1, large: true, sig: 'solid', metal: false, triad: true },
  { count: 2, large: true, sig: 'solid', metal: false, transmit: 0.5 },
  { count: 1, large: false, sig: 'solid', metal: true, transmit: 0.4 },
  { count: 1, large: false, sig: 'caverns', metal: false, triad: true },
  { count: 3, large: false, sig: 'caverns', metal: false, transmit: 0.4 },
  { count: 4, large: false, sig: 'solid', metal: false, transmit: 0.5 },
];

// ---------- shoals: rocks that scatter the sonar, each beside an orb (outside its starting view) ----------
export const SHOALS = [['c2', 115], ['c4', -120], ['c6', 125], ['c1', -120]].map(([cam, turn], i) => {
  const c = CAMERAS.find(k => k.id === cam), a = (c.facing + turn) * Math.PI / 180, d = 380;
  return { id: 's' + (i + 1), name: ['Gullet Rocks', 'The Teeth', 'Saint Brine Shoal', 'The Anvil'][i], cam, x: Math.round(c.x + Math.sin(a) * d), y: Math.round(c.y - Math.cos(a) * d), r: 260 };
});

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
// Two FUELs and two COFFEEs, each pair in different houses. COFFEE's neighbours in Ember are consequences,
// so miscounting the page shift there costs something.
export const BOARD_GRID = {
  Ice: ['COFFEE', 'SUCCUBUS', 'COOLANT', 'CONFETTI'],
  Iron: ['FUEL', 'SHUTTER', 'LAUNCH', 'DEVIL'],
  Ember: ['COFFEE', 'PURGE', 'ALARM', 'LIGHTS'],
  Bone: ['DECOY', 'LOCKDOWN', 'RADIO', 'FUEL'],
};
export const BOARD_PAGES = ['I', 'II', 'III', 'IV'];

// ---------- camera unlock panel ----------
// Shape plates: the order depends on the house of the rune carved on the orb's housing (Signals reads the rune).
export const PLATES = ['CIRCLE', 'TRIANGLE', 'SQUARE'];
export const PLATE_BY_HOUSE = {
  Ice: ['CIRCLE', 'TRIANGLE', 'SQUARE'],
  Iron: ['TRIANGLE', 'SQUARE', 'CIRCLE'],
  Ember: ['SQUARE', 'CIRCLE', 'TRIANGLE'],
  Bone: ['CIRCLE', 'SQUARE', 'TRIANGLE'],
};
// Levers: set from the weather readout on the camera feed (wind in knots, air temperature in degrees).
export function windLever(kn) { return kn < 30 ? 'DOWN' : kn <= 38 ? 'MIDDLE' : 'UP'; }
export function tempLever(deg) { return deg < -185 ? 'DOWN' : deg <= -155 ? 'MIDDLE' : 'UP'; }
