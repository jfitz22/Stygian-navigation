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

const TUNE = [392, 440, 392, 330, 294, 330, 392, 0, 440, 494, 523, 494, 440, 392, 330, 0];
export function setMusic(on) {
  clearInterval(musicTimer); musicTimer = null;
  if (!on || !ctx) return;
  let i = 0;
  musicTimer = setInterval(() => {
    const f = TUNE[i++ % TUNE.length];
    if (f) { tone(f, 'triangle', 0.32, 0.07); tone(f / 2, 'sine', 0.32, 0.04); }
    if (Math.random() < 0.3) noise(0.05, 0.03, 4000);
  }, 340);
}
