// Synthesised sound. No audio files needed.
let ctx = null, master = null, muted = false;
let staticNode = null, staticGain = null, toneOscs = [], toneGain = null, musicTimer = null, humGain = null;

export function unlock() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  // furnace hum
  const hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 46;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
  humGain = ctx.createGain(); humGain.gain.value = 0;
  hum.connect(lp).connect(humGain).connect(master); hum.start();
  // radio static
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = buf.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  staticNode = ctx.createBufferSource(); staticNode.buffer = buf; staticNode.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.6;
  staticGain = ctx.createGain(); staticGain.gain.value = 0;
  staticNode.connect(bp).connect(staticGain).connect(master); staticNode.start();
  // radio song tones
  toneGain = ctx.createGain(); toneGain.gain.value = 0; toneGain.connect(master);
}
export function setMuted(m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.05); }
export const isMuted = () => muted;

function env(node, t, a, peak, d) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, type, dur, vol = 0.2, when = 0, slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain(); env(g, t, 0.01, vol, dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, freq = 1000, when = 0, q = 1) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.005, vol, dur);
  s.connect(f).connect(g).connect(master); s.start(t);
}

export const sfx = {
  click: () => { noise(0.03, 0.25, 3000, 0, 2); },
  clunk: () => { tone(90, 'square', 0.12, 0.25, 0, 50); noise(0.08, 0.3, 400); },
  deny: () => { tone(140, 'sawtooth', 0.18, 0.15); tone(110, 'sawtooth', 0.22, 0.15, 0.12); },
  ignite: () => { noise(1.4, 0.4, 300, 0, 0.5); tone(60, 'sawtooth', 1.5, 0.2, 0.2, 45); },
  ping: () => { tone(1400, 'sine', 1.2, 0.35, 0, 1300); tone(1400, 'sine', 0.8, 0.08, 0.35, 1300); },
  echo: () => { tone(1250, 'sine', 0.25, 0.12); tone(1250, 'sine', 0.25, 0.08, 0.18); },
  buoy: () => { noise(0.4, 0.3, 600); tone(200, 'triangle', 0.3, 0.15, 0.3, 120); },
  lock: () => { tone(880, 'square', 0.06, 0.1); tone(1320, 'square', 0.08, 0.1, 0.07); },
  rune: () => { tone(520, 'triangle', 0.15, 0.2); },
  runefail: () => { noise(0.5, 0.35, 5000, 0, 0.3); tone(90, 'sawtooth', 0.4, 0.2); },
  calibrated: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 'triangle', 0.25, 0.15, i * 0.09)); },
  scandone: () => { tone(330, 'sine', 0.5, 0.2); tone(495, 'sine', 0.6, 0.2, 0.15); },
  launch: () => { noise(0.8, 0.4, 900, 0, 0.4); tone(300, 'sawtooth', 0.7, 0.12, 0, 900); },
  hit: () => { tone(196, 'triangle', 1.2, 0.3); tone(294, 'triangle', 1.2, 0.2, 0.05); },
  miss: () => { noise(0.9, 0.3, 500, 0, 0.4); },
  alarm: () => { [0, 0.3, 0.6].forEach(w => tone(740, 'square', 0.18, 0.1, w)); },
  sharkhunt: () => { tone(55, 'sawtooth', 2.5, 0.35, 0, 40); },
  buoydead: () => { noise(1.2, 0.5, 200, 0, 0.5); tone(70, 'square', 0.6, 0.25); },
  camdead: () => { noise(0.6, 0.5, 2500, 0, 0.3); tone(80, 'square', 0.4, 0.25, 0.1); },
  remorhaz: () => { tone(42, 'sawtooth', 1.8, 0.3); },
  spark: () => { noise(0.25, 0.4, 6000, 0, 0.5); },
  repaired: () => { tone(660, 'triangle', 0.2, 0.15); tone(880, 'triangle', 0.3, 0.15, 0.15); },
  coffee: () => { for (let i = 0; i < 9; i++) noise(0.12, 0.12, 300 + Math.random() * 300, i * 0.22, 2); },
  wipers: () => { noise(0.35, 0.18, 1200, 0, 1); noise(0.35, 0.18, 1200, 0.45, 1); },
  bell: () => { [1, 2.76, 5.4].forEach((m, i) => tone(196 * m, 'sine', 3 - i * 0.6, 0.18 / (i + 1))); },
  lamps: () => { tone(1200, 'square', 0.03, 0.08); },
  stoke: () => { noise(0.35, 0.35, 250, 0, 0.8); noise(0.6, 0.2, 900, 0.25, 0.5); },
  blowout: () => { noise(1.6, 0.6, 150, 0, 0.4); tone(55, 'sawtooth', 1.2, 0.3, 0, 30); },
  reveal: () => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 'sine', 2.2, 0.12, i * 0.12)); noise(2.5, 0.08, 6000, 0, 0.3); },
  flip: () => { for (let i = 0; i < 3; i++) noise(0.05, 0.25, 2500, i * 0.06, 3); },
  fuel: () => { for (let i = 0; i < 6; i++) noise(0.08, 0.22, 500 + Math.random() * 400, i * 0.07, 2); },
  turn: () => { tone(160, 'square', 0.25, 0.08, 0, 120); noise(0.25, 0.12, 800, 0, 1); },
  vent: () => { noise(1.2, 0.35, 3000, 0, 0.4); },
  stamp: () => { noise(0.12, 0.6, 180, 0, 0.6); tone(70, 'square', 0.15, 0.3); },
  confetti: () => { noise(0.12, 0.5, 1800, 0, 0.7); [784, 988, 1175, 1568].forEach((f, i) => tone(f, 'triangle', 0.18, 0.1, 0.08 + i * 0.07)); for (let i = 0; i < 10; i++) noise(0.04, 0.12, 4000 + Math.random() * 3000, 0.1 + Math.random() * 0.9, 3); },
  jig: () => { [392, 523, 494, 523, 587, 523, 494, 440, 392, 523, 494, 523, 659, 587, 523, 587].forEach((f, i) => tone(f, 'square', 0.14, 0.06, i * 0.17)); },
  puff: () => { noise(0.5, 0.35, 700, 0, 0.5); },
  alarm: () => { for (let i = 0; i < 8; i++) tone(520, 'sawtooth', 0.42, 0.055, i * 0.5, 720); },
  coolant: () => { noise(1.6, 0.22, 5200, 0, 0.4); tone(110, 'sine', 1.2, 0.12, 0.1, 55); for (let i = 0; i < 6; i++) noise(0.08, 0.08, 600 + Math.random() * 500, 0.3 + i * 0.18, 3); },
  purge: () => { noise(0.9, 0.35, 380, 0, 0.5); tone(140, 'square', 0.18, 0.18, 0.75, 60); noise(0.15, 0.3, 200, 0.8, 0.8); },
  shutter: () => { for (let i = 0; i < 14; i++) noise(0.05, 0.16, 1400 + (i % 3) * 300, i * 0.06, 2.5); tone(70, 'square', 0.25, 0.22, 0.9); noise(0.2, 0.35, 160, 0.9, 0.7); },
  seal: () => { tone(220, 'square', 0.14, 0.11); tone(165, 'square', 0.3, 0.11, 0.15); noise(0.12, 0.3, 260, 0.15, 0.8); },
  reboot: () => { tone(320, 'sawtooth', 1.3, 0.16, 0, 38); noise(1.0, 0.18, 300, 0.2, 0.5); [523, 659, 784, 1046].forEach((f, i) => tone(f, 'square', 0.1, 0.07, 1.7 + i * 0.12)); },
  pop: () => { noise(0.05, 0.4, 2400, 0, 2); tone(880, 'sine', 0.12, 0.12, 0, 1760); for (let i = 0; i < 5; i++) noise(0.03, 0.08, 5000 + Math.random() * 3000, 0.05 + i * 0.04, 4); },
  sultry: () => {
    [[220, 247, 0.45, 0], [262, 262, 0.3, 0.5], [294, 262, 0.7, 0.85], [247, 220, 0.9, 1.6]].forEach(([a, b, d, w]) => { tone(a, 'triangle', d, 0.12, w, b); tone(a * 2, 'sine', d, 0.03, w, b * 2); });
    noise(0.06, 0.16, 2600, 1.15, 4);   // the kiss
    tone(1300, 'sine', 0.22, 0.07, 2.6, 2500); tone(1500, 'sine', 0.55, 0.07, 2.95, 760);   // the whistle
  },
  win: () => { [196, 247, 294, 392].forEach((f, i) => tone(f, 'triangle', 2.5, 0.18, i * 0.25)); },
};

export function setHum(level) { if (humGain) humGain.gain.setTargetAtTime(level * 0.08, ctx.currentTime, 0.3); }
export function setStatic(level) { if (staticGain) staticGain.gain.setTargetAtTime(level * 0.12, ctx.currentTime, 0.05); }

const SONG_FREQ = { R: 196, W: 392, B: 294 };
let songKey = null, songTimer = null;
export function setSong(song, strength) {
  if (!ctx) return;
  const key = song ? song : null;
  if (key === songKey) { if (toneGain) toneGain.gain.setTargetAtTime(key ? 0.12 * strength : 0, ctx.currentTime, 0.1); return; }
  songKey = key;
  clearInterval(songTimer); toneOscs.forEach(o => o.stop()); toneOscs = [];
  if (!key) { toneGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05); return; }
  toneGain.gain.setTargetAtTime(0.12 * strength, ctx.currentTime, 0.1);
  const play = () => [...key].forEach((c, i) => {
    const t = ctx.currentTime + i * 0.45;
    const o = ctx.createOscillator(); o.type = c === 'R' ? 'sawtooth' : c === 'W' ? 'sine' : 'triangle';
    o.frequency.value = SONG_FREQ[c];
    const g = ctx.createGain(); env(g, t, 0.02, 0.8, 0.38);
    o.connect(g).connect(toneGain); o.start(t); o.stop(t + 0.45);
  });
  play(); songTimer = setInterval(play, 1800);
}

// The cabin radio: a lo-fi loop, made on the spot. Fmaj7 · Em7 · Dm7 · Cmaj7 at 76 bpm.
const LOFI = { chords: [[174.6, 220, 261.6, 329.6], [164.8, 196, 246.9, 293.7], [146.8, 174.6, 220, 261.6], [130.8, 164.8, 196, 246.9]],
  bass: [87.3, 82.4, 73.4, 65.4], lead: [523.3, 587.3, 659.3, 784, 880], kick: [0, 7, 10], snare: [4, 12] };
let musicBus = null, musicNext = 0, musicStep = 0;
function mvoice(freq, type, dur, vol, t, attack = 0.01, slideTo = null) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
  o.connect(g).connect(musicBus); o.start(t); o.stop(t + attack + dur + 0.05);
}
function mnoise(dur, vol, freq, t, q = 1) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(musicBus); src.start(t);
}
function lofiStep(t, i) {
  const bar = Math.floor(i / 16) % 4, st = i % 16, swing = st % 2 ? 0.035 : 0;
  t += swing;
  if (st === 0) LOFI.chords[bar].forEach((f, k) => { mvoice(f, 'sine', 2.4, 0.05, t + k * 0.012, 0.03); mvoice(f * 2, 'triangle', 0.9, 0.012, t + k * 0.012, 0.02); });
  if (st === 8 && Math.random() < 0.5) LOFI.chords[bar].slice(1).forEach((f, k) => mvoice(f, 'sine', 1.2, 0.03, t + k * 0.02, 0.03));
  if (st === 0 || st === 8) mvoice(LOFI.bass[bar], 'sine', 0.55, 0.16, t, 0.01);
  if (st === 11) mvoice(LOFI.bass[bar] * 1.5, 'sine', 0.3, 0.09, t, 0.01);
  if (LOFI.kick.includes(st)) mvoice(120, 'sine', 0.25, 0.3, t, 0.003, 42);
  if (LOFI.snare.includes(st)) { mnoise(0.18, 0.09, 1800, t, 0.8); mvoice(190, 'triangle', 0.08, 0.04, t); }
  if (st % 2 === 0) mnoise(0.035, st % 4 ? 0.025 : 0.035, 8000, t, 1.2);
  if (st % 4 === 2 && Math.random() < 0.18) mvoice(LOFI.lead[Math.floor(Math.random() * LOFI.lead.length)], 'sine', 0.7, 0.025, t, 0.02);
  if (Math.random() < 0.3) mnoise(0.012, 0.03, 3000 + Math.random() * 3000, t + Math.random() * 0.2, 5);   // vinyl crackle
}
export function setMusic(on) {
  clearInterval(musicTimer); musicTimer = null;
  if (!ctx) return;
  if (!musicBus) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.4;
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(lp).connect(master);
  }
  musicBus.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, on ? 0.3 : 0.15);
  if (!on) return;
  const sixteenth = 60 / 76 / 4;
  musicNext = ctx.currentTime + 0.1; musicStep = 0;
  musicTimer = setInterval(() => { while (musicNext < ctx.currentTime + 0.25) { lofiStep(musicNext, musicStep++); musicNext += sixteenth; } }, 60);
}

