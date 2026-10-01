// Authored scenario for The Last Watch.
// Coordinates are miles. x grows east, y grows south (screen style).
// Time is real seconds since the furnace was lit.

export const MAP_W = 4000;
export const MAP_H = 2600;
export const OBSERVATORY = { x: 2000, y: 2480 };
export const TOMB_RADIUS = 1000;

export const TUNING = {
  buoyDeployRange: 1500,   // how far from the observatory a buoy can be dropped
  buoyRadius: 420,         // sonar reach around the buoy
  sonarDelay: 6,           // seconds between ping and result
  contactFade: 50,         // seconds a sonar contact stays on the map
  buoyRebuild: 30,         // seconds to build a new buoy after the shark eats one
  currentRefresh: 4,       // seconds between current readings while powered
  powerSlots: 3,           // how many systems the furnace can run at once
  beaconSpeed: 80,         // miles per second
  beaconStock: 12,
  beaconRebuild: 60,
  scanTime: 14,            // seconds of good alignment to finish a metal scan
  alignRadius: 40,         // miles of prediction error before alignment hits zero
  radioAlignRadius: 90,
  radioWidth: 5,           // how sharp the radio peak is (frequency units)
  camRange: 450,
  camFov: 70 * Math.PI / 180,
  camHeatUp: 0.9,          // heat per second while watched
  camCoolDown: 1.2,
  remorhazTrigger: 65,
  remorhazGiveUp: 30,
  remorhazSpeed: 1.5,
  remorhazSpawnDist: 130,
  repairTime: 15,
  sharkWindow: 120,        // seconds a ping is remembered
  sharkTrigger: 3,         // pings in one area within the window that draw the shark
  sharkNoiseArea: 260,     // pings within this distance count as "the same area"
  sharkSpeed: 3.2,
  sharkRoamSpeed: 0.6,
  sharkKillDist: 18,
};

// Drift fields. Each vortex: centre, peak speed (mi/s), radius of peak speed,
// direction (+1 clockwise on screen, -1 counter-clockwise).
export const DEEP_VORTICES = [
  { x: 2950, y: 1250, vmax: 0.70, rpk: 600, dir: 1 },   // the eastern deep gyre (Elgarz rides it)
  { x: 850, y: 1250, vmax: 0.12, rpk: 220, dir: -1 },   // slow eddy that holds the Tomb
];
export const SURFACE_VORTICES = [
  { x: 1650, y: 1250, vmax: 0.55, rpk: 650, dir: -1 },  // the western surface gyre
];
export const SURFACE_DRIFT = { x: 0.06, y: 0 };

// Wind: direction it blows FROM (compass degrees), veering over the session.
export function windAt(t) {
  const from = 290 + 60 * Math.min(1, t / 1200) + 8 * Math.sin(t / 70);
  const speed = 10 + 3 * Math.sin(t / 110);
  const toward = (from + 180) * Math.PI / 180;
  return { x: Math.sin(toward) * speed, y: -Math.cos(toward) * speed, from: ((from % 360) + 360) % 360, speed };
}

// Storms move across the map and snow out cameras inside them.
export const STORMS = [
  { t0: 120, t1: 520, x0: 2400, y0: 300, x1: 3300, y1: 1300, r: 380 },
  { t0: 480, t1: 980, x0: 900, y0: 600, x1: 2200, y1: 1700, r: 420 },
  { t0: 900, t1: 1500, x0: 3600, y0: 700, x1: 2600, y1: 1900, r: 400 },
];

// Fixed camera posts. `facing` is a compass bearing in degrees.
export const CAMERAS = [
  { id: 'c1', name: 'GALLOWS REACH', x: 3880, y: 1720, facing: 300 },
  { id: 'c2', name: 'SOUTHEAST POST', x: 3200, y: 2250, facing: 10 },
  { id: 'c3', name: 'SALTGRAVE', x: 2350, y: 2050, facing: 345 },
  { id: 'c4', name: 'WESTERN WATCH', x: 900, y: 1950, facing: 35 },
  { id: 'c5', name: 'MIDSEA PILLAR', x: 2000, y: 1250, facing: 290 },
];

// Echo signatures: `humps` after the surface spike, and the tail shape.
// Radio: `freq` and a three-lamp `song` (R, W, B).
// `large` bergs ride the deep current, small ones ride the surface and wind.
export const NOTABLES = [
  {
    id: 'elgarz', name: 'Elgarz', large: true, length: 26, elgarz: true,
    orbit: { field: 'deep', v: 0, r: 600, a: null }, // start angle solved below
    hollow: true, metal: true, echo: { humps: 3, tail: 'ring' },
    radio: { freq: 612.0, song: 'BRW' },
    look: 'elgarz',
  },
  {
    id: 'convoy', name: 'The Drowned Convoy', large: true, length: 14,
    orbit: { field: 'deep', v: 0, r: 380, a: 2.2 },
    hollow: true, metal: true, echo: { humps: 2, tail: 'ring' }, radio: null, look: 'convoy',
  },
  {
    id: 'horn', name: "Geryon's Shed Horn", large: true, length: 12,
    orbit: { field: 'deep', v: 0, r: 880, a: 3.6 },
    hollow: false, metal: true, echo: { humps: 0, tail: 'flat' },
    radio: { freq: 255.0, song: 'BRW' }, look: 'horn',
  },
  {
    id: 'cradle', name: "Leviathan's Cradle", large: true, length: 16,
    orbit: { field: 'deep', v: 0, r: 720, a: 5.3 },
    hollow: false, metal: false, echo: { humps: 2, tail: 'fuzz' }, radio: null, look: 'cradle',
  },
  {
    id: 'choir', name: 'The Penitent Choir', large: false, length: 7,
    orbit: { field: 'surface', r: 520, a: 0.4 },
    hollow: true, metal: false, echo: { humps: 2, tail: 'ring' },
    radio: { freq: 781.0, song: 'BRW' }, look: 'choir',
  },
  {
    id: 'sepulcher', name: "Angel's Sepulcher", large: false, length: 5,
    orbit: { field: 'surface', r: 820, a: 1.9 },
    hollow: true, metal: false, echo: { humps: 1, tail: 'ring' },
    radio: { freq: 488.0, song: 'WWB' }, look: 'sepulcher',
  },
  {
    id: 'cairn', name: 'The Iron Cairn', large: false, length: 4,
    orbit: { field: 'surface', r: 330, a: 4.4 },
    hollow: false, metal: true, echo: { humps: 0, tail: 'flat' },
    radio: { freq: 846.0, song: 'RRW' }, look: 'cairn',
  },
  {
    id: 'arsenal', name: 'The Broken Arsenal', large: false, length: 5,
    orbit: { field: 'surface', r: 950, a: 5.6 },
    hollow: false, metal: true, echo: { humps: 0, tail: 'flat' }, radio: null, look: 'arsenal',
  },
  {
    id: 'tolling', name: 'The Tolling Berg', large: false, length: 4,
    orbit: { field: 'surface', r: 700, a: 3.1 },
    hollow: true, metal: false, echo: { humps: 1, tail: 'ring' }, radio: null, look: 'bell',
  },
];

// Elgarz's starting angle on the deep gyre, solved by tools/check.mjs so that
// it crosses into buoy range at about 3:30.
export const ELGARZ_START_ANGLE = -0.05;

export const GENERIC_COUNT = 56;

// The Tomb of Levistus. It rides the slow western deep eddy.
export const TOMB = { x: 760, y: 1180, large: true };

// Radio decoding table (also printed in the manual).
// band: LOW < 400, MID 400-699, HIGH >= 700
export const RADIO_TABLE = {
  BRW: { LOW: 'The Bull alone. A fragment of Geryon.', MID: "THE TRIAD: Glass, Ember and the Bull. Geryon's house.", HIGH: 'A fallen choir: Glass and Ember. No Bull.' },
  RRW: { LOW: 'Ice settling. No meaning.', MID: 'War drums of a devil legion.', HIGH: 'An infernal armoury humming in its sleep.' },
  WWB: { LOW: 'Whale-song of the Styx.', MID: 'A celestial lament. Something holy is buried here.', HIGH: 'Frost singing in a crevasse. No meaning.' },
};

export function bandOf(freq) {
  return freq < 400 ? 'LOW' : freq < 700 ? 'MID' : 'HIGH';
}
