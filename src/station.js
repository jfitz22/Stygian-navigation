// An officer's station: joined to the game with the operator's code. Draws the game's snapshot and sends actions
// back; the game decides what they do. Each station has a steady job, the shared fleet, and a defence game that
// the game triggers every few minutes.
import { openLink, cleanCode } from './link.js';
import { mountFleet } from './fleetui.js';
import * as WS from './workshop.js';
import * as GA from './games.js';
import { glyphSVG, echoAt, ECHO_W } from './glyphs.js';
import { GRID, CELL, CAMERAS, TUNING as T } from './scenario.js';
import { drawFurnaceLog, furnaceNumbers } from './furnacelog.js';
import { mulberry32 } from './sim.js';
import * as audio from './audio.js';

const $ = id => document.getElementById(id);
const ROLE_NAME = { gunnery: 'GUNNERY & TARGETING', signals: 'SIGNALS & SONAR', engineer: 'ENGINEERING & POWER' };
const JOB = { gunnery: 'THE BEACON WORKSHOP', signals: 'THE CASE BOARD', engineer: 'THE FURNACE' };
const FIRST = {
  gunnery: ['<b>Build beacons</b> at the workshop: your book has the shell; Engineering has the core; Signals has the crystal.', '<b>When devil fire comes</b>, click to burst flak in its path: every tower it reaches is an orb lost.', '<b>The fleet</b> is everyone\'s: pick a rune and a number, then FIRE.'],
  signals: ['<b>Keep the case board</b>: decode each radio pattern and type in its call sign. The sonar here is a copy of the operator\'s.', '<b>Minesweeping</b> is optional: complete a sweep and the guns beacon a glacier for free.', '<b>When the buoy cable snaps</b>, steer with the arrow keys and collect the ends; the walls wrap round, your own cable does not.'],
  engineer: ['<b>Keep the furnace alive</b>: the log shows where the heat is heading. Set the shed order and the damper.', '<b>The breaker panel</b> is optional: clear it for a free shovel of fuel.', '<b>When the fuse box blows</b>, drag each wire to the terminal of its colour and stripe.'],
};
const SYS_LABEL = { cameras: 'ORBS', sonar: 'SONAR', radio: 'RADIO', scanner: 'SCANNER', currents: 'CURRENTS', repair: 'REPAIR', workshop: 'WORKSHOP' };
const fmt = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const COLS = 'ABCDEFGHIJKL';
const gridRef = p => p ? COLS[Math.max(0, Math.min(GRID - 1, Math.floor(p.x / CELL)))] + (Math.max(0, Math.min(GRID - 1, Math.floor(p.y / CELL))) + 1) : '--';

// ---------- joining ----------
const params = new URLSearchParams(location.search);
let role = params.get('role'), code = cleanCode(params.get('code'));
try { role = role || localStorage.getItem('lastwatch-station-role'); code = code || cleanCode(localStorage.getItem('lastwatch-station-code')); } catch (e) { }
let snap = null, snapAt = 0, netState = '', linkedOnce = false;
const games = {};   // game id -> { born, at }: every game heard on this code
const link = openLink(m => {
  if (!m.ss) return;
  const g = m.ss, now = performance.now();
  games[g.iid] = { born: g.born, at: now };
  const live = Object.entries(games).filter(([, v]) => now - v.at < 4000).sort((a, b) => b[1].born - a[1].born);
  if (live.length && live[0][0] !== g.iid) return;   // an older game still open on this code: follow the newest
  snap = g; snapAt = now; linkedOnce = true;
}, s => { netState = s; });
const send = act => link.send({ station: { role, iid: snap ? snap.iid : null, ...act } });
// the game's clock, run on between updates
const ticking = () => snap && !snap.paused && !snap.hold && snap.started && !snap.reinforce;
const nowT = () => !snap ? 0 : snap.t + (ticking() ? Math.min(2, (performance.now() - snapAt) / 1000) : 0);

document.querySelectorAll('#roles button').forEach(b => b.onclick = () => { role = b.dataset.role; document.querySelectorAll('#roles button').forEach(x => x.classList.toggle('sel', x === b)); });
if (role) { const b = document.querySelector(`#roles [data-role="${role}"]`); if (b) b.classList.add('sel'); }
$('code').value = code || '';
$('go').onclick = () => {
  code = cleanCode($('code').value);
  if (!role) { $('joinmsg').textContent = 'Choose a station first.'; return; }
  if (/[0O1IL]/.test($('code').value.toUpperCase())) { $('joinmsg').textContent = 'Codes never use 0, O, 1, I or L: check the code.'; return; }
  try { localStorage.setItem('lastwatch-station-role', role); localStorage.setItem('lastwatch-station-code', code); } catch (e) { }
  audio.unlock(); takeStation();
};
// sound: on by default; the alarm is the thing to hear
let muted = false; try { muted = localStorage.getItem('lastwatch-station-mute') === '1'; } catch (e) { }
audio.setMuted(muted);
const muteBtn = document.createElement('button'); muteBtn.className = 'small'; muteBtn.id = 'mute';
const showMute = () => { muteBtn.textContent = muted ? 'SOUND OFF' : 'SOUND ON'; };
muteBtn.onclick = () => { muted = !muted; audio.setMuted(muted); showMute(); try { localStorage.setItem('lastwatch-station-mute', muted ? '1' : '0'); } catch (e) { } };
showMute(); $('switch').before(muteBtn);
// a first-time card for each station, until they say they have it
function firstCard() {
  let seen = false; try { seen = localStorage.getItem('lastwatch-station-seen-' + role) === '1'; } catch (e) { }
  const el = $('firstcard'); el.classList.toggle('hidden', seen);
  if (seen) return;
  el.innerHTML = `<b class="ft">${ROLE_NAME[role]}</b><ul>${FIRST[role].map(l => '<li>' + l + '</li>').join('')}</ul><button class="btn">GOT IT</button>`;
  el.querySelector('button').onclick = () => { el.classList.add('hidden'); try { localStorage.setItem('lastwatch-station-seen-' + role, '1'); } catch (e) { } };
}
// reconnect by itself when the relay drops
setInterval(() => { if (code && /CLOSED|CHANNEL_ERROR|TIMED_OUT|OFFLINE/.test(netState)) link.rejoin(); }, 5000);
$('switch').onclick = () => { $('desk').classList.add('hidden'); $('join').classList.remove('hidden'); };
function takeStation() {
  link.join(code);
  $('join').classList.add('hidden'); $('desk').classList.remove('hidden');
  $('rolename').textContent = '· ' + ROLE_NAME[role] + ' ·';
  $('jobtitle').textContent = JOB[role];
  document.title = 'The Last Watch · ' + ROLE_NAME[role];
  jobKey = ''; $('jobbody').innerHTML = '';
  if ($('sonarpanel')) $('sonarpanel').classList.add('hidden');
  if (role === 'gunnery') buildWorkshop();
  if (role === 'engineer') buildFurnace();
  if (role === 'signals') buildSonar();
  buildSteady();
  firstCard();
}
setInterval(() => { if (role && !$('desk').classList.contains('hidden')) send({ hello: true, doing: doing() }); }, 2000);
// a few words for the operator's crew board
function doing() {
  if (current && !current.done) return 'defending';
  if (role === 'gunnery') return ws.casing ? 'building a ' + ws.color + ' beacon' : 'at the bench';
  if (role === 'signals') return steady.state && steady.state.choosing ? 'choosing a reward' : steady.state && !steady.state.over ? 'minesweeping' : 'keeping the case board';
  if (role === 'engineer') return steady.state && !steady.state.over ? 'on the breaker panel' : 'watching the furnace';
  return '';
}

// ---------- the fleet ----------
const fleetUI = mountFleet($('fleet'), () => ({ fleet: snap && snap.fleet, t: nowT() }), a => { send(a); audio.sfx.click(); }, { cell: 30, onShot: l => (l.hit ? audio.sfx.hit : audio.sfx.miss)() });

// ---------- the main loop ----------
let jobKey = '';
const reported = new Set();
function safely(name, fn) { try { fn(); } catch (e) { if (!reported.has(name)) { reported.add(name); console.error('station panel "' + name + '" failed:', e); } } }
function frame() {
  const live = snap && performance.now() - snapAt < 4000;
  $('link').innerHTML = `<i class="${live ? 'on' : netState === 'SUBSCRIBED' || netState === 'LOCAL' ? 'wait' : 'off'}"></i><span>${live ? 'linked to the Watch' : code ? 'waiting for the Watch · code ' + code : 'not linked'}</span>`;
  $('lost').classList.toggle('hidden', !(linkedOnce && !live && !$('desk').classList.contains('hidden')));
  if (snap) {
    $('clock').textContent = snap.hold === 'deploy' ? 'DEPLOY' : fmt(nowT());
    safely('fleet', () => fleetUI.render());
    if (role === 'gunnery') safely('workshop', drawWorkshop);
    if (role === 'signals') { safely('sonar', drawSonar); safely('case board', drawCaseBoard); }
    if (role === 'engineer') safely('furnace', drawFurnace);
    safely('steady', () => drawSteady());
    safely('defence', checkDefence);
    $('alert').classList.toggle('hidden', !snap.reinforce);
    if (snap.reinforce) { $('alerttitle').textContent = 'DEVIL REINFORCEMENTS'; $('alerttext').textContent = 'The fleet is lost and the enemy is landing. The watch is paused until the officer of the watch gives the word.'; }
  }
  requestAnimationFrame(frame);
}

// =====================================================================
// GUNNERY: the beacon workshop
// =====================================================================
const ws = { color: 'red', casing: null, fitted: {}, pieces: [], placed: [], held: null, msg: '', bad: [] };
window.__ws = ws;   // for automated checks
const PIECE_COLORS = ['#b0743a', '#8a5a2b', '#c99a4b', '#6e4a22', '#a3652c', '#d0a86a'];
const C = 40;   // chamber cell size

function partSVG(slot, id) {
  const s = 46, ink = '#e8dfc6';
  if (slot === 'fuse') {
    const n = Number(id[0]), col = id[1] === 'R' ? '#ff4b3a' : '#f4f1e6';
    return `<svg width="${s}" height="${s}" viewBox="0 0 46 46"><rect x="17" y="4" width="12" height="38" rx="3" fill="#4a4036" stroke="${ink}"/>${[...Array(n)].map((_, i) => `<rect x="17" y="${14 + i * 9}" width="12" height="5" fill="${col}"/>`).join('')}<path d="M23 4 Q28 0 25 -2" stroke="${ink}" fill="none"/></svg>`;
  }
  if (slot === 'fins') {
    const body = `<rect x="18" y="4" width="10" height="30" fill="#4a4036" stroke="${ink}"/>`;
    const f = { STRAIGHT: 'M18 26 L8 26 L8 40 L18 34 M28 26 L38 26 L38 40 L28 34', SWEPT: 'M18 22 L6 40 L18 34 M28 22 L40 40 L28 34', SPLIT: 'M18 24 L8 30 L12 34 L6 40 L18 34 M28 24 L38 30 L34 34 L40 40 L28 34' }[id];
    return `<svg width="${s}" height="${s}" viewBox="0 0 46 46">${body}<path d="${f}" fill="#8a7a5a" stroke="${ink}" stroke-linejoin="round"/></svg>`;
  }
  if (slot === 'cap') {
    const fill = { BRASS: '#c9a24b', IRON: '#9aa3ab', GLASS: 'rgba(170,220,255,.45)' }[id];
    return `<svg width="${s}" height="${s}" viewBox="0 0 46 46"><path d="M10 36 L10 22 Q23 2 36 22 L36 36 Z" fill="${fill}" stroke="${ink}" stroke-width="1.5"/>${id === 'GLASS' ? '<path d="M16 20 Q20 12 24 11" stroke="#fff" fill="none"/>' : ''}</svg>`;
  }
  if (slot === 'core') {
    const n = Number(id[0]), seal = id[1] === 'B' ? '#c9a24b' : '#3d3d3d';
    return `<svg width="${s}" height="${s}" viewBox="0 0 46 46"><rect x="12" y="6" width="22" height="30" rx="4" fill="#5a6470" stroke="${ink}"/>${[...Array(n)].map((_, i) => `<rect x="30" y="${10 + i * 6}" width="6" height="3" fill="#0c0e10"/>`).join('')}<rect x="10" y="36" width="26" height="6" rx="2" fill="${seal}" stroke="${ink}"/></svg>`;
  }
  if (slot === 'crystal') {
    const n = Number(id[0]), tint = { C: 'rgba(220,240,255,.75)', S: 'rgba(150,150,165,.9)', P: 'rgba(255,150,180,.8)' }[id[1]];
    const pts = [...Array(n)].map((_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return `${(23 + Math.cos(a) * 18).toFixed(1)},${(24 + Math.sin(a) * 18).toFixed(1)}`; }).join(' ');
    return `<svg width="${s}" height="${s}" viewBox="0 0 46 46"><polygon points="${pts}" fill="${tint}" stroke="${ink}" stroke-width="1.5"/></svg>`;
  }
  return '';
}
const SLOT_LABEL = { fuse: 'FUSE', fins: 'FINS', cap: 'CAP', core: 'SOUNDING CORE', crystal: 'TRANSMITTER CRYSTAL' };

function buildWorkshop() {
  $('jobbody').innerHTML = `
    <div class="ws-top">
      <span class="lbl" style="margin:0">BUILD</span>
      ${WS.COLORS.map(c => `<button class="btn" data-color="${c}">${c.toUpperCase()}</button>`).join('')}
      <button class="btn" id="take">TAKE A CASING</button>
      <div class="ws-stock" id="stock"></div>
    </div>
    <div id="benchwrap"></div>
    <div class="rack" id="rack"></div>`;
  document.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { dropFloat(); ws.color = b.dataset.color; ws.casing = null; drawBench(); });
  $('take').onclick = () => { takeCasing(); audio.sfx.clunk(); };
  drawBench();
}
function dropFloat() { if (floatEl) { floatEl.remove(); floatEl = null; } ws.held = null; }
function takeCasing() {
  dropFloat();
  ws.casing = WS.newCasing(Math.random); ws.fitted = {}; ws.placed = []; ws.held = null; ws.msg = ''; ws.bad = [];
  const [W, H, n] = WS.CHAMBER[ws.color];
  ws.pieces = WS.cutChamber(Math.random, W, H, n).map((cells, i) => {
    let c = cells; for (let k = Math.floor(Math.random() * 4); k > 0; k--) c = WS.rotate(c);
    return { id: i, cells: c, color: PIECE_COLORS[i % PIECE_COLORS.length] };
  });
  drawBench();
}
function pieceHTML(cells, size, color) {
  const W = Math.max(...cells.map(c => c[0])) + 1, H = Math.max(...cells.map(c => c[1])) + 1, set = new Set(cells.map(c => c.join()));
  let h = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) h += set.has(x + ',' + y) ? `<i class="f" style="background:${color}"></i>` : '<i></i>';
  return { html: h, style: `grid-template-columns:repeat(${W},${size}px);grid-template-rows:repeat(${H},${size}px)` };
}
function drawBench() {
  document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('sel', b.dataset.color === ws.color));
  const el = $('benchwrap');
  if (!ws.casing) { el.innerHTML = `<p class="hint" style="margin-top:14px">Choose the colour, then TAKE A CASING. Red: the Gunnery book. Orange: ask Engineering for the sounding core. Green: Engineering's core and Signals' transmitter crystal.</p>`; return; }
  const slots = WS.SLOTS[ws.color], [W, H] = WS.CHAMBER[ws.color];
  const placedIds = new Set(ws.placed.map(p => p.id));
  el.innerHTML = `
    <div class="ws-bench">
      <div>
        <div class="casing"><div class="lbl">CASING · ${ws.color.toUpperCase()}</div><div class="serial">${ws.casing.serial}</div><div class="lampbig ${ws.casing.lamp}"></div></div>
        <div class="slots">${slots.map(s => `<div class="slot${ws.bad.includes(s) ? ' bad' : ''}" data-slot="${s}">${ws.fitted[s] ? `<span class="part" data-from="${s}">${partSVG(s, ws.fitted[s])}</span>` : ''}<span>${SLOT_LABEL[s]}</span></div>`).join('')}</div>
      </div>
      <div>
        <div class="lbl">THE TRAY · drag a part onto its slot</div>
        <div class="tray">${slots.map(s => `<div class="trayrow"><span class="lbl">${SLOT_LABEL[s].split(' ').pop()}</span>${WS.PARTS[s].map(p => `<span class="part${ws.fitted[s] === p ? ' fitted' : ''}" draggable="true" data-slot="${s}" data-part="${p}" title="${WS.PART_LABEL[s](p)}">${partSVG(s, p)}</span>`).join('')}</div>`).join('')}</div>
      </div>
    </div>
    <div class="lbl" style="margin-top:12px">THE CHARGE CHAMBER · drag every block in until it is full · right click or R turns the block you hold</div>
    <div class="chamber-wrap">
      <div class="chamber" id="chamber" style="grid-template-columns:repeat(${W},${C}px);width:${W * C + 6}px;height:${H * C + 6}px">${'<div class="c"></div>'.repeat(W * H)}
        ${ws.placed.map(p => { const ph = pieceHTML(p.cells, C, ws.pieces[p.id].color); return `<div class="placed" data-id="${p.id}" style="left:${p.x * C}px;top:${p.y * C}px;${ph.style}">${ph.html}</div>`; }).join('')}</div>
      <div class="pieces">${ws.pieces.filter(p => !placedIds.has(p.id) && (!ws.held || ws.held.id !== p.id)).map(p => { const ph = pieceHTML(p.cells, 32, p.color); return `<div class="piece" data-id="${p.id}" style="${ph.style}">${ph.html}</div>`; }).join('')}</div>
    </div>
    <div class="ws-actions"><button class="seal" id="seal">SEAL THE BEACON</button><span class="ws-msg">${ws.msg}</span></div>`;
  // parts: drag (or click) into the slot
  el.querySelectorAll('.tray .part').forEach(p => {
    p.ondragstart = e => e.dataTransfer.setData('text/plain', p.dataset.slot + ':' + p.dataset.part);
    p.onclick = () => { ws.fitted[p.dataset.slot] = p.dataset.part; ws.bad = []; audio.sfx.click(); drawBench(); };
  });
  el.querySelectorAll('.slot').forEach(s => {
    s.ondragover = e => { e.preventDefault(); s.classList.add('over'); };
    s.ondragleave = () => s.classList.remove('over');
    s.ondrop = e => { e.preventDefault(); const [slot, part] = e.dataTransfer.getData('text/plain').split(':'); if (slot === s.dataset.slot) { ws.fitted[slot] = part; ws.bad = []; audio.sfx.click(); } drawBench(); };
    s.ondblclick = () => { delete ws.fitted[s.dataset.slot]; drawBench(); };
  });
  // the charge blocks
  el.querySelectorAll('.piece').forEach(p => p.onpointerdown = e => grabPiece(e, Number(p.dataset.id), 32, p));
  el.querySelectorAll('.chamber .placed').forEach(p => p.onpointerdown = e => {
    const id = Number(p.dataset.id); ws.placed = ws.placed.filter(q => q.id !== id); grabPiece(e, id, C, p);
  });
  $('seal').onclick = seal;
}
let floatEl = null;
function grabPiece(e, id, size, el) {
  e.preventDefault();
  const r = el.getBoundingClientRect();
  ws.held = { id, cells: ws.pieces[id].cells, gx: Math.floor((e.clientX - r.left) / size), gy: Math.floor((e.clientY - r.top) / size) };
  if (!ws.held.cells.some(([x, y]) => x === ws.held.gx && y === ws.held.gy)) { ws.held.gx = ws.held.cells[0][0]; ws.held.gy = ws.held.cells[0][1]; }
  floatEl = document.createElement('div'); floatEl.className = 'floating'; document.body.appendChild(floatEl);
  paintFloat(); moveFloat(e); drawBench();
}
function paintFloat() { if (!floatEl || !ws.held) return; const ph = pieceHTML(ws.held.cells, C, ws.pieces[ws.held.id].color); floatEl.style.cssText += ';' + ph.style; floatEl.innerHTML = ph.html; }
function moveFloat(e) { if (!floatEl || !ws.held) return; floatEl.style.left = (e.clientX - ws.held.gx * C - C / 2) + 'px'; floatEl.style.top = (e.clientY - ws.held.gy * C - C / 2) + 'px'; }
addEventListener('pointermove', moveFloat);
addEventListener('pointerup', e => {
  if (!ws.held) { if (floatEl) dropFloat(); return; }
  const ch = $('chamber'), [W, H] = WS.CHAMBER[ws.color];
  if (ch) {
    const r = ch.getBoundingClientRect(), cx = Math.floor((e.clientX - r.left - 3) / C) - ws.held.gx, cy = Math.floor((e.clientY - r.top - 3) / C) - ws.held.gy;
    const trial = [...ws.placed, { id: ws.held.id, cells: ws.held.cells, x: cx, y: cy }];
    const cells = trial.flatMap(p => p.cells.map(([x, y]) => [x + p.x, y + p.y]));
    const fits = cells.every(([x, y]) => x >= 0 && y >= 0 && x < W && y < H) && new Set(cells.map(c => c.join())).size === cells.length;
    if (fits) { ws.placed = trial; audio.sfx.click(); }
  }
  ws.pieces[ws.held.id].cells = ws.held.cells;
  ws.held = null; if (floatEl) { floatEl.remove(); floatEl = null; }
  drawBench();
});
const turnHeld = () => { if (!ws.held) return false; ws.held.cells = WS.rotate(ws.held.cells); ws.held.gx = ws.held.cells[0][0]; ws.held.gy = ws.held.cells[0][1]; paintFloat(); return true; };
addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && turnHeld()) e.preventDefault(); });
addEventListener('contextmenu', e => { if (ws.held || e.target.closest('.piece, .chamber')) { e.preventDefault(); if (!turnHeld()) { const p = e.target.closest('.piece'); if (p) { const id = Number(p.dataset.id); ws.pieces[id].cells = WS.rotate(ws.pieces[id].cells); drawBench(); } } } });
function seal() {
  if (!ws.casing) return;
  const wrong = WS.wrongSlots(ws.color, ws.casing, ws.fitted), [W, H] = WS.CHAMBER[ws.color];
  if (wrong.length) {
    ws.bad = wrong; wrong.forEach(s => delete ws.fitted[s]);
    ws.msg = `The casing rattles: the ${wrong.map(s => SLOT_LABEL[s].toLowerCase()).join(' and the ')} ${wrong.length > 1 ? 'pop' : 'pops'} back out.`;
    audio.sfx.spark(); drawBench(); return;
  }
  if (ws.placed.length !== ws.pieces.length || !WS.packed(W, H, ws.placed)) { ws.msg = 'The charge is not packed: fill the chamber.'; audio.sfx.deny(); drawBench(); return; }
  send({ act: 'seal', color: ws.color }); audio.sfx.calibrated();
  ws.casing = null; ws.msg = ''; drawBench();
  $('benchwrap').insertAdjacentHTML('afterbegin', `<p class="ws-msg" style="margin-top:12px">SEALED. The ${ws.color} beacon is in the rack: it cures while the WORKSHOP switch is on.</p>`);
}
function drawWorkshop() {
  const s = snap, k = JSON.stringify([s.beacons, s.orange, s.green, s.workshop, s.power && s.power.workshop]);
  if (k === jobKey) return;
  jobKey = k;
  $('stock').innerHTML = `<span>RED <b>${s.beacons}</b></span><span style="color:#ffb347">ORANGE <b>${s.orange}</b></span><span style="color:#5cff9d">GREEN <b>${s.green}</b></span>`;
  const q = s.workshop.curing;
  $('rack').innerHTML = q.length ? `<span class="lbl">THE RACK</span> ${q.map((b, i) => `<span class="q" style="color:${{ red: '#ff8a7a', orange: '#ffb347', green: '#5cff9d' }[b.color]}">${b.color.toUpperCase()} ${i === 0 ? (s.power.workshop ? 'curing · ' + Math.ceil(b.left) + ' s' : 'waiting for WORKSHOP power') : 'waiting'}</span>`).join('')}` : '<span class="hint">The rack is empty.</span>';
}

// =====================================================================
// SIGNALS: a copy of the sonar, and the detailed case board
// =====================================================================
function buildSonar() {
  $('jobbody').insertAdjacentHTML('beforebegin', '');
  if (!$('sonarpanel')) $('job').insertAdjacentHTML('beforebegin', `<section id="sonarpanel" class="panel"><h2>THE SONAR <small>a copy of the operator's screen</small></h2>
    <div class="sonarrow"><canvas id="sonarcv" width="300" height="300"></canvas><div><div class="lbl">ECHO PRINTOUT · the contact the operator has selected</div><canvas id="echocv" width="300" height="160"></canvas><div id="sonarinfo" class="hint"></div></div></div>
    <div id="stormwarn" class="hidden"></div></section>`);
  $('sonarpanel').classList.remove('hidden');
}
function drawSonar() {
  const so = snap.sonar; if (!so || !$('sonarcv')) return;
  const ctx = $('sonarcv').getContext('2d'), R = 140, t = performance.now() / 1000;
  ctx.fillStyle = '#020a06'; ctx.fillRect(0, 0, 300, 300);
  ctx.strokeStyle = 'rgba(92,255,157,.18)';
  for (const r of [R / 3, R * 2 / 3, R]) { ctx.beginPath(); ctx.arc(150, 150, r, 0, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(10, 150); ctx.lineTo(290, 150); ctx.moveTo(150, 10); ctx.lineTo(150, 290); ctx.stroke();
  ctx.font = '12px IBM Plex Mono'; ctx.textAlign = 'center';
  if (!so.up || !so.buoy) {
    ctx.fillStyle = 'rgba(92,255,157,.5)';
    ctx.fillText(!so.up ? 'SONAR OFF' : so.rebuild > 0 && so.rebuild < 1e6 ? 'BUOY LOST · REBUILDING ' + Math.ceil(so.rebuild) + ' s' : 'NO BUOY IN THE WATER', 150, 145);
  } else {
    const xy = p => [150 + (p.x - so.buoy.x) / T.buoyRadius * R, 150 + (p.y - so.buoy.y) / T.buoyRadius * R];
    const a = t * 1.5; ctx.strokeStyle = 'rgba(92,255,157,.5)'; ctx.beginPath(); ctx.moveTo(150, 150); ctx.lineTo(150 + Math.sin(a) * R, 150 - Math.cos(a) * R); ctx.stroke();
    for (const c of so.contacts) {
      const [x, y] = xy(c); if (Math.hypot(x - 150, y - 150) > 150) continue;
      const fade = Math.max(0.2, 1 - c.age / T.contactFade), r = Math.max(2.5, Math.min(8, 2 + c.length * 0.25));
      ctx.fillStyle = `rgba(160,255,200,${fade})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      if (snap.selected === c.id) { ctx.strokeStyle = '#ffb347'; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 7); ctx.stroke(); }
      if (c.num != null) { ctx.fillStyle = 'rgba(232,223,198,.6)'; ctx.font = '10px IBM Plex Mono'; ctx.fillText('#' + c.num, x, y - r - 4); }
    }
    for (const h of so.hunters) {
      const [x, y] = xy(h), col = { grindmaw: '#ff4b3a', tom: '#ff7a2a', monster: '#ff4b3a' }[h.kind];
      ctx.fillStyle = col; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff9a8a'; ctx.font = '10px IBM Plex Mono'; ctx.fillText({ grindmaw: 'GRINDMAW', tom: 'OLD TOM', monster: 'MONSTER' }[h.kind], x, y - 10);
    }
    if (so.pinging) { ctx.fillStyle = 'rgba(92,255,157,.7)'; ctx.font = '11px IBM Plex Mono'; ctx.fillText('LISTENING...', 150, 292); }
  }
  // the storm warning
  const sw = $('stormwarn'), storm = so.buoy && so.buoy.storm > 0;
  sw.classList.toggle('hidden', !storm);
  if (storm) sw.textContent = `STORM OVER THE BUOY · IT WILL BE TORN LOOSE IN ${Math.max(0, Math.ceil(T.buoyStormTime - so.buoy.storm))} s · TELL THE OPERATOR TO MOVE IT`;
  // the selected contact's printout
  const ec = $('echocv').getContext('2d'), c = so.contacts.find(x => x.id === snap.selected);
  ec.fillStyle = '#e8dfc6'; ec.fillRect(0, 0, 300, 160);
  ec.strokeStyle = 'rgba(120,90,60,.22)'; for (let x = 0; x < 300; x += 16) { ec.beginPath(); ec.moveTo(x + .5, 16); ec.lineTo(x + .5, 136); ec.stroke(); }
  if (!c || !c.echo) { ec.fillStyle = '#6b5a3a'; ec.font = '12px IBM Plex Mono'; ec.textAlign = 'center'; ec.fillText('No contact selected', 150, 84); $('sonarinfo').textContent = ''; return; }
  const k = Math.floor(t / 2.5), base = 132;
  ec.strokeStyle = '#2a1a0a'; ec.lineWidth = 1.6; ec.beginPath();
  for (let x = 0; x <= 300; x++) { const ex = x * ECHO_W / 300, y = base - echoAt(c.echo, c.length, ex, k, 0); x ? ec.lineTo(x, y) : ec.moveTo(x, y); }
  ec.stroke(); ec.lineWidth = 1;
  ec.fillStyle = '#3a2a10'; ec.font = '600 11px IBM Plex Mono'; ec.textAlign = 'left'; ec.fillText(c.echo.temp != null ? 'WATER ' + c.echo.temp + '°' : '', 4, 12);
  ec.textAlign = 'right'; ec.fillText(`#${c.num != null ? c.num : '?'} · ${Math.round(c.length)} mi`, 296, 12);
  $('sonarinfo').innerHTML = `Length <b${Math.round(c.length) <= 20 ? ' style="color:#ff6a5a"' : ''}>${Math.round(c.length)} mi</b>. Read the bumps and the tail with your book.`;
}

// =====================================================================
// SIGNALS: the detailed case board
// =====================================================================
const SHAPE = { SMOOTH: 'smooth', STEPPED: 'stepped', JAGGED: 'jagged' };
function miniEcho(e) {
  const pts = [];
  for (let x = 0; x <= ECHO_W; x += 1.5) pts.push(`${(x * 150 / ECHO_W).toFixed(1)},${(42 - echoAt(e, 18, x, 0, 0.9) * 0.45).toFixed(1)}`);
  return `<svg width="150" height="46" viewBox="0 0 150 46"><rect width="150" height="46" fill="#e8dfc6"/><polyline points="${pts.join(' ')}" fill="none" stroke="#2a1a0a" stroke-width="1.3"/></svg>`;
}
function drawCaseBoard() {
  const rows = (snap.cases || []).filter(c => c.num != null);
  const focused = document.activeElement && document.activeElement.tagName === 'INPUT';
  const k = JSON.stringify(rows);
  if (k === jobKey || focused) return;
  jobKey = k;
  $('jobbody').innerHTML = rows.length ? `<table class="cb"><tr><th>ICE</th><th>SEEN</th><th>ECHO</th><th>METAL</th><th>RADIO (as shown)</th><th>CALL SIGN</th><th>VERDICT</th></tr>${rows.map(c => {
    const o = c.obs || {}, r = o.radio;
    return `<tr class="${c.permanent ? '' : 'temp'} ${c.verdict === 'EXCLUDED' ? 'excluded' : ''}">
      <td><span class="num">#${c.num}</span><br><small${o.length != null && o.length <= 20 ? ' style="color:#ff6a5a"' : ''}>${o.length != null ? o.length + ' mi' : ''}</small></td>
      <td>${gridRef(c.seen)}</td>
      <td>${o.echo ? miniEcho(o.echo) + `<br><small>water ${o.echo.temp}°</small>` : '<span class="tile">?</span>'}</td>
      <td>${o.metal == null ? '<span class="tile">?</span>' : o.metal ? '<span class="tile T">METAL</span>' + (o.artifact ? '<br><small style="color:#c58cff">✦ ' + o.artifact + '</small>' : '') : '<span class="tile F">NONE</span>'}</td>
      <td>${r ? [...r.shown].map(x => `<span class="rl ${x}"></span>`).join('') + `<br><small>${SHAPE[r.carrier] || ''} · ${r.band} · ${Math.round(r.freq)}</small>` : o.swept ? '<span class="tile F">SILENT</span>' : '<span class="tile">?</span>'}</td>
      <td>${c.permanent ? `<input data-id="${c.bergId}" value="${c.callsign || ''}" maxlength="3" placeholder="RWB">` : ''}</td>
      <td>${c.permanent ? `<button class="btn" data-v="${c.bergId}">${c.verdict}</button>` : '<small>beacon it to keep it</small>'}</td></tr>`;
  }).join('')}</table><p class="hint">Type the call sign you decoded (R, W, B) and press Enter: the operator's board shows it, and Gunnery can read its meaning.</p>`
    : '<p class="hint">No ice on the case board yet. It fills as the operator locks onto ice and beacons it.</p>';
  $('jobbody').querySelectorAll('input').forEach(i => {
    const go = () => { send({ act: 'callsign', bergId: i.dataset.id, text: i.value }); jobKey = ''; };
    i.onkeydown = e => { if (e.key === 'Enter') { go(); i.blur(); } };
    i.onblur = go;
  });
  $('jobbody').querySelectorAll('[data-v]').forEach(b => b.onclick = () => { const v = b.textContent; send({ act: 'verdict', bergId: b.dataset.v, v: v === '?' ? 'SUSPECT' : v === 'SUSPECT' ? 'EXCLUDED' : '?' }); });
}

// =====================================================================
// ENGINEERING: the furnace
// =====================================================================
function buildFurnace() {
  $('jobbody').innerHTML = `<div class="fnums" id="fnums"></div><canvas id="flog" width="1100" height="520"></canvas>
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px">
      <div><div class="lbl">DAMPER</div><button class="btn" data-m="normal">NORMAL</button> <button class="btn" data-m="low">LOW</button></div>
      <div style="flex:1"><div class="lbl">SHED ORDER · the bottom switches off first</div><ol class="prio" id="prio"></ol></div>
    </div>`;
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => send({ act: 'damper', mode: b.dataset.m }));
}
let flogAt = 0;
function drawFurnace() {
  const fs = snap.furnaceState; if (!fs) return;
  const n = furnaceNumbers(fs); if ($('fnums').innerHTML !== n) $('fnums').innerHTML = n;
  if (performance.now() - flogAt > 100) {
    flogAt = performance.now();
    const dt = nowT() - snap.t, run = { ...fs, t: fs.t + dt, heat: fs.lit ? Math.max(0, fs.heat - fs.burn * dt) : 0 };
    drawFurnaceLog($('flog'), run);
  }
  document.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('sel', b.dataset.m === fs.damper));
  const k = JSON.stringify([fs.priority, fs.on]);
  if (k === jobKey) return;
  jobKey = k;
  $('prio').innerHTML = fs.priority.map((s, i) => `<li><b>${i + 1}</b><span>${SYS_LABEL[s]}</span><i class="${fs.on.includes(s) ? 'on' : ''}"></i><button data-i="${i}" data-d="-1">▲</button><button data-i="${i}" data-d="1">▼</button></li>`).join('');
  $('prio').querySelectorAll('button').forEach(b => b.onclick = () => {
    const p = [...fs.priority], i = Number(b.dataset.i), j = i + Number(b.dataset.d);
    if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; send({ act: 'priority', list: p });
  });
}

// =====================================================================
// THE STEADY PUZZLES (optional, with a reward)
// =====================================================================
// Signals: Minesweeper. Clear a field and a red beacon strikes a glacier for free (once a minute).
// Engineering: Lights Out, 6 x 6. Clear a panel and a free shovel goes in the furnace chute (once a minute).
const steady = { kind: null, state: null, msg: '' };
function buildSteady() {
  steady.kind = role === 'signals' ? 'mines' : role === 'engineer' ? 'lights' : null;
  $('steady').classList.toggle('hidden', !steady.kind);
  if (!steady.kind) return;
  $('steadytitle').innerHTML = steady.kind === 'mines' ? 'MINESWEEPING <small>complete a sweep for a free beacon on a random iceberg</small>' : 'THE BREAKER PANEL <small>clear it for a free shovel of fuel</small>';
  newSteadyBoard();
}
const cooldownLeft = () => !snap || !snap.rewards ? 0 : Math.max(0, (snap.rewards[steady.kind === 'mines' ? 'mines' : 'lights'] || 0) - snap.t);
function newSteadyBoard() {
  const rng = mulberry32(Math.floor(Math.random() * 1e9));
  if (steady.kind === 'mines') { const { mines, start } = GA.msBoard(rng), M = new Set(mines), open = new Set(); GA.msOpen(M, open, start); steady.state = { M, open, flags: new Set(), boom: -1, over: false }; }
  else steady.state = { board: GA.loBoard(rng).board, over: false };
  steady.msg = ''; drawSteady(true);
}
let steadyKey = '';
function drawSteady(force) {
  if (!steady.kind || !steady.state) return;
  const cd = Math.ceil(cooldownLeft()), waiting = steady.state.over && cd > 0;
  const k = JSON.stringify([waiting ? cd : -1, steady.msg, snap && snap.canReveal]) + (force ? Math.random() : '');
  if (k === steadyKey && !force) return;
  steadyKey = k;
  // after a win, wait for the game's cooldown to arrive and run out before the next board
  if (steady.state.over && steady.state.won && cd <= 0 && performance.now() - steady.state.wonAt > 4000) { newSteadyBoard(); return; }
  if (steady.kind === 'mines') drawMinesSteady(cd); else drawLightsSteady(cd);
}
function drawMinesSteady(cd) {
  const st = steady.state, { M, open, flags } = st;
  let h = '';
  for (let i = 0; i < GA.MS * GA.MS; i++) {
    const n = GA.msCount(M, i);
    if (st.boom >= 0 && M.has(i)) h += '<div class="o m"></div>';
    else if (open.has(i)) h += `<div class="o n${n}">${n || ''}</div>`;
    else h += `<div class="${flags.has(i) ? 'f' : ''}" data-i="${i}"></div>`;
  }
  $('steadybody').innerHTML = `<div class="steadygrid">
    <div class="ms small">${h}</div>
    <div class="howto" style="max-width:330px">
      Mines have drifted into the approaches. <b>Complete a sweep</b> and choose your reward: <b>a beacon strikes a random iceberg</b>, or <b>an enemy ship is plotted</b> on the fleet tables.<br><br>
      <b>The numbers:</b> each one says how many of the eight squares touching it hold a mine. A <b>1</b> with only one hidden square beside it: that square is a mine.<br><br>
      <b>Left click</b> opens a square. <b>Right click</b> flags a mine. Start from the open patch; every field can be solved without guessing.<br><br>
      ${M.size - flags.size} mines unflagged. Nothing is lost if you hit one: start a new field.
    </div></div>
    <div class="reward">${steady.msg}${st.over && !st.won ? ' <button class="btn" id="msnew">NEW FIELD</button>' : ''}${st.choosing ? ` <button class="btn" id="rwbeacon">BEACON AN ICEBERG</button> <button class="btn" id="rwreveal" ${snap && snap.canReveal ? '' : 'disabled title="No enemy ship left to plot (or the fleet is not in action)"'}>PLOT AN ENEMY SHIP</button>` : ''}${st.over && st.won && !st.choosing && cd > 0 ? ` The next sweep opens in ${cd} s.` : ''}</div>`;
  const nb = $('msnew'); if (nb) nb.onclick = newSteadyBoard;
  const choose = c => { st.choosing = false; st.wonAt = performance.now(); steady.msg = c === 'reveal' ? 'SWEEP COMPLETE. An enemy ship is plotted on the fleet tables.' : 'SWEEP COMPLETE. The guns are firing.'; send({ act: 'minesweeper', choice: c }); audio.sfx.calibrated(); drawSteady(true); };
  if ($('rwbeacon')) $('rwbeacon').onclick = () => choose('beacon');
  if ($('rwreveal')) $('rwreveal').onclick = () => choose('reveal');
  if (st.over) return;
  $('steadybody').querySelectorAll('.ms [data-i]').forEach(d => {
    d.onclick = () => {
      const i = Number(d.dataset.i); if (flags.has(i)) return;
      if (M.has(i)) { st.boom = i; st.over = true; st.won = false; steady.msg = 'A mine. The field is lost: start another.'; audio.sfx.blowout(); drawSteady(true); return; }
      GA.msOpen(M, open, i); audio.sfx.click();
      if (open.size === GA.MS * GA.MS - M.size) { st.over = true; st.won = true; st.choosing = true; steady.msg = 'THE SWEEP IS COMPLETE. Choose:'; audio.sfx.calibrated(); }
      drawSteady(true);
    };
    d.oncontextmenu = e => { e.preventDefault(); const i = Number(d.dataset.i); flags.has(i) ? flags.delete(i) : flags.add(i); drawSteady(true); };
  });
}
function drawLightsSteady(cd) {
  const st = steady.state;
  $('steadybody').innerHTML = `<div class="steadygrid">
    <div class="lo6${st.over ? ' rest' : ''}">${st.board.map((v, i) => `<button class="${v ? 'on' : ''}" data-i="${i}"></button>`).join('')}</div>
    <div class="howto" style="max-width:330px">
      The breakers on the boiler line. <b>Get every breaker dark</b> and the boiler hands the furnace <b>a free shovel of fuel</b>.<br><br>
      <b>Pressing a breaker flips it and its four neighbours</b> (up, down, left, right).<br><br>
      One free shovel a minute. Take your time: nothing goes wrong here.
    </div></div>
    <div class="reward">${steady.msg}${st.over && cd > 0 ? ` The next panel lights up in ${cd} s.` : ''}</div>`;
  if (st.over) return;
  $('steadybody').querySelectorAll('.lo6 button').forEach(b => b.onclick = () => {
    st.board = GA.loPress(st.board, Number(b.dataset.i)); audio.sfx.click();
    if (GA.loSolved(st.board)) { st.over = true; st.won = true; st.wonAt = performance.now(); steady.msg = 'PANEL CLEAR. A shovel of fuel drops into the chute.'; send({ act: 'lightsout' }); audio.sfx.calibrated(); }
    drawSteady(true);
  });
}

// =====================================================================
// THE DEFENCES (triggered by the game; an inset console, never the whole screen)
// =====================================================================
const DEF_TITLE = {
  missile: ['DEVIL FIRE INBOUND', 'Shoot it down before it reaches the towers. Click to burst flak in its path.'],
  missileArc: ['DEVIL SKIFFS ON THE HORIZON', 'Their shells arc in from the sides. Click to burst flak in their path.'],
  snake: ['THE BUOY CABLE HAS SNAPPED', `Splice it: steer with the arrow keys (or WASD) and collect ${GA.SN.need} loose ends. Do not touch the walls or the cable.`],
  wires: ['THE FUSE BOX HAS BLOWN', 'Drag each loose wire to the terminal of the same colour and stripe.'],
};
let current = null;
const finished = new Set();
function checkDefence() {
  const a = snap.defence && snap.defence.active && snap.defence.active[role];
  if (current && (!a || a.id !== current.id)) { if (!current.done) closeDefence(); }
  if (a && !current && !finished.has(a.id)) startDefence(a);
}
function startDefence(a) {
  if (!DEF_TITLE[a.kind]) { finished.add(a.id); return; }
  current = { id: a.id, kind: a.kind, rng: mulberry32(a.seed), t0: performance.now(), done: false };
  const title = a.kind === 'missile' && current.rng() < 0.5 ? (current.arc = true, DEF_TITLE.missileArc) : DEF_TITLE[a.kind];
  $('dtitle').textContent = title[0]; $('dsub').textContent = title[1];
  $('dresult').classList.add('hidden'); $('defence').classList.remove('hidden');
  $('defence').scrollIntoView({ behavior: 'smooth', block: 'start' });
  audio.sfx.alarm();
  ({ missile: startMissile, snake: startSnake, wires: startWires })[a.kind](current);
  tickDefence();
}
function tickDefence() {
  if (!current || current.done) return;
  const left = GA.GAME_TIME[current.kind] - (performance.now() - current.t0) / 1000;
  $('dtime').textContent = fmt(Math.max(0, left));
  if (left <= 0) current.timeout && current.timeout();
  if (current && !current.done && current.tick) current.tick();
  if (current && !current.done) requestAnimationFrame(tickDefence);
}
function finishDefence(ok, res, text) {
  if (!current || current.done) return;
  current.done = true; finished.add(current.id);
  send({ act: 'defence', id: current.id, res: { ok, ...res } });
  const r = $('dresult'); r.textContent = text; r.className = ok ? 'ok' : 'bad';
  (ok ? audio.sfx.calibrated : audio.sfx.blowout)();
  setTimeout(closeDefence, 2600);
}
function closeDefence() { $('defence').classList.add('hidden'); $('dbody').innerHTML = ''; if (current && current.cleanup) current.cleanup(); current = null; }

// ---------- The cable (Signals): Snake ----------
function startSnake(g) {
  const S = 30, W = GA.SN.W * S, H = GA.SN.H * S;
  $('dbody').innerHTML = `<canvas width="${W}" height="${H}"></canvas><p class="hint" style="text-align:center">Arrow keys or WASD. Click the board first if the keys do nothing.</p>`;
  const cv = $('dbody').querySelector('canvas'), ctx = cv.getContext('2d');
  let body = GA.snakeStart(), dir = [1, 0], queued = [], food = GA.snakeFood(g.rng, body), got = 0, acc = 0, last = null, seenAt = null, dead = false;
  const KEYS = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
  const onKey = e => {
    const d = KEYS[e.key]; if (!d || g.done) return;
    e.preventDefault();
    const prev = queued.length ? queued[queued.length - 1] : dir;
    if (d[0] === -prev[0] && d[1] === -prev[1]) return;   // no turning back on yourself
    if (queued.length < 2) queued.push(d);
  };
  addEventListener('keydown', onKey);
  g.cleanup = () => removeEventListener('keydown', onKey);
  g.timeout = () => finishDefence(false, {}, 'OUT OF TIME · THE BUOY DRIFTS AWAY');
  const READY = 1.2;
  g.tick = () => {
    // frames stop while the tab is hidden: never move more than a step or two at once, and start the READY count
    // from the first frame the officer can actually see
    const nowT = performance.now(), dt = last == null ? 0 : Math.min(0.2, (nowT - last) / 1000); last = nowT;
    if (seenAt == null) seenAt = nowT;
    const since = (nowT - seenAt) / 1000;
    if (since > READY && !dead) {
      acc += dt;
      while (acc >= GA.SN.step && !dead && !g.done) {
        acc -= GA.SN.step;
        if (queued.length) dir = queued.shift();
        const r = GA.snakeMove(body, dir, food);
        body = r.body;
        if (r.dead) { dead = true; finishDefence(false, {}, 'THE SPLICE FAILED · THE BUOY IS LOST'); break; }
        if (r.ate) { got++; audio.sfx.click(); if (got >= GA.SN.need) { finishDefence(true, {}, 'THE CABLE IS SPLICED'); break; } food = GA.snakeFood(g.rng, body); }
      }
    }
    // draw: the sea floor, the cable, the loose end
    ctx.fillStyle = '#06131a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(92,255,157,.06)';
    for (let x = 0; x <= GA.SN.W; x++) { ctx.beginPath(); ctx.moveTo(x * S, 0); ctx.lineTo(x * S, H); ctx.stroke(); }
    for (let y = 0; y <= GA.SN.H; y++) { ctx.beginPath(); ctx.moveTo(0, y * S); ctx.lineTo(W, y * S); ctx.stroke(); }
    ctx.fillStyle = '#ffb347'; ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(food[0] * S + S / 2, food[1] * S + S / 2, S * 0.3, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = dead ? '#a33' : '#c9a24b';
    body.forEach(([x, y], i) => { if (i) { ctx.beginPath(); ctx.roundRect(x * S + 3, y * S + 3, S - 6, S - 6, 6); ctx.fill(); } });
    ctx.fillStyle = dead ? '#ff4b3a' : '#5cff9d'; ctx.beginPath(); ctx.arc(body[0][0] * S + S / 2, body[0][1] * S + S / 2, S * 0.36, 0, 7); ctx.fill();
    ctx.lineWidth = 1;
    ctx.fillStyle = '#e8cf98'; ctx.font = '600 16px IBM Plex Mono'; ctx.textAlign = 'left';
    ctx.fillText(`CABLE ${body.length} / ${GA.SN.start + GA.SN.need}`, 10, 22);
    if (since <= READY) { ctx.textAlign = 'center'; ctx.font = '800 30px Cinzel'; ctx.fillText('READY...', W / 2, H / 2); }
  };
  cv.tabIndex = 0; cv.focus({ preventScroll: true });
}

// ---------- The wires (Engineering) ----------
function startWires(g) {
  const { left, right } = GA.wiresBoard(g.rng), byId = Object.fromEntries(GA.WIRES.map(w => [w.id, w]));
  const W = 640, H = 380, LX = 70, RX = 570, ROW = i => 45 + i * 58, done = new Set();
  let drag = null;
  const wireLine = (x1, y1, x2, y2, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${w.color}" stroke-width="12" stroke-linecap="round"/>` + (w.stripe ? `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${w.stripe}" stroke-width="4" stroke-dasharray="10 10"/>` : '');
  const draw = () => {
    let b = `<rect width="${W}" height="${H}" fill="#14110d"/>`;
    left.forEach((id, i) => { const w = byId[id]; b += wireLine(10, ROW(i), LX, ROW(i), w); });
    right.forEach((id, i) => { const w = byId[id]; b += `<rect class="term" data-id="${id}" x="${RX - 14}" y="${ROW(i) - 18}" width="56" height="36" rx="4" fill="#2a2016" stroke="#b08d57" stroke-width="2"/>` + wireLine(RX + 6, ROW(i), RX + 34, ROW(i), w); });
    for (const id of done) { const i = left.indexOf(id), j = right.indexOf(id); b += wireLine(LX, ROW(i), RX - 14, ROW(j), byId[id]); }
    if (drag) b += wireLine(LX, ROW(left.indexOf(drag.id)), drag.x, drag.y, byId[drag.id]);
    left.forEach((id, i) => { if (!done.has(id)) b += `<circle class="end" data-id="${id}" cx="${LX}" cy="${ROW(i)}" r="13" fill="#e8dfc6" stroke="#000" stroke-width="2"/>`; });
    $('dbody').innerHTML = `<svg class="wiresvg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${b}</svg>`;
    const svgEl = $('dbody').querySelector('svg');
    svgEl.querySelectorAll('.end').forEach(e => e.onpointerdown = ev => { ev.preventDefault(); if (g.done) return; const p = pt(svgEl, ev); drag = { id: e.dataset.id, x: p.x, y: p.y }; draw(); });
  };
  const pt = (svgEl, ev) => { const r = svgEl.getBoundingClientRect(); return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height }; };
  const move = ev => { if (!drag) return; const svgEl = $('dbody').querySelector('svg'); if (!svgEl) return; const p = pt(svgEl, ev); drag.x = p.x; drag.y = p.y; draw(); };
  const up = ev => {
    if (!drag) return;
    const t = document.elementFromPoint(ev.clientX, ev.clientY), id = drag.id; drag = null;
    if (t && t.classList.contains('term')) {
      if (t.dataset.id === id) { done.add(id); audio.sfx.click(); if (done.size === left.length) { draw(); finishDefence(true, {}, 'THE FUSE BOX IS REWIRED'); return; } }
      else audio.sfx.spark();
    }
    draw();
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
  g.cleanup = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
  g.timeout = () => finishDefence(false, {}, 'TOO SLOW · A SYSTEM HAS DROPPED');
  draw();
}

// ---------- Missile Command (Gunnery): devil fire from the sky, or shells arcing in from skiffs on the horizon ----------
function startMissile(g) {
  const W = 980, H = 520, GROUND = 470, BX = W / 2, HORIZON = 120, arc = !!g.arc;
  $('dbody').innerHTML = `<canvas class="aim" width="${W}" height="${H}"></canvas>`;
  const cv = $('dbody').querySelector('canvas'), ctx = cv.getContext('2d');
  const towers = CAMERAS.map((c, i) => ({ id: c.id, name: c.name, x: 70 + i * (W - 140) / 6, down: !!(snap.cams && snap.cams[i] && snap.cams[i].broken), hit: false }));
  const waves = GA.missileWaves(g.rng, snap.t / 60, arc ? 'arc' : 'fall').map(w => ({ ...w, x0: arc ? w.from * W : 40 + w.from * (W - 80), y0: arc ? HORIZON : 0, alive: true, spawned: false, trail: [] }));
  const shots = [], bursts = [], booms = [];
  let lastShot = -9;
  const now = () => (performance.now() - g.t0) / 1000;
  cv.onclick = e => {
    if (g.done) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height, t = now();
    if (t - lastShot < 0.3 || shots.length >= 3 || y > GROUND - 10) return;
    lastShot = t; shots.push({ x, y, t0: t, dur: Math.hypot(x - BX, y - GROUND) / 1000 }); audio.sfx.click();
  };
  const finish = () => {
    const hits = towers.filter(t => t.hit && !t.down).map(t => t.id);
    finishDefence(hits.length === 0, { hits }, hits.length ? `${hits.length} TOWER${hits.length > 1 ? 'S' : ''} HIT · THOSE ORBS ARE DOWN` : 'EVERY TOWER STANDS');
  };
  g.timeout = finish;
  const pos = (w, tw, k) => arc
    ? { x: w.x0 + (tw.x - w.x0) * k, y: w.y0 + (GROUND - w.y0) * k - 230 * 4 * k * (1 - k) }
    : { x: w.x0 + (tw.x - w.x0) * k, y: GROUND * k };
  g.tick = () => {
    const t = now();
    for (const w of waves) {
      if (!w.alive || t < w.at) continue;
      const tw = towers[w.to], dur = 7.2 / w.speed, k = Math.min(1, (t - w.at) / dur), p = pos(w, tw, k);
      w.x = p.x; w.y = p.y; w.spawned = true; w.trail.push(p); if (w.trail.length > 40) w.trail.shift();
      if (k >= 1) { w.alive = false; booms.push({ x: tw.x, y: GROUND, t0: t }); if (!tw.down) tw.hit = true; audio.sfx.blowout(); }
    }
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; if (t - s.t0 >= s.dur) { bursts.push({ x: s.x, y: s.y, t0: t }); shots.splice(i, 1); } }
    for (const b of bursts) {
      const a = t - b.t0, r = a < 0.3 ? 48 * a / 0.3 : a < 0.65 ? 48 : Math.max(0, 48 * (1 - (a - 0.65) / 0.3));
      b.r = r;
      for (const w of waves) if (w.alive && w.spawned && Math.hypot(w.x - b.x, w.y - b.y) < r) { w.alive = false; booms.push({ x: w.x, y: w.y, t0: t, small: true }); }
    }
    // draw
    ctx.fillStyle = '#05080a'; ctx.fillRect(0, 0, W, H);
    if (arc) {
      ctx.fillStyle = '#0b1a22'; ctx.fillRect(0, HORIZON, W, GROUND - HORIZON);
      ctx.strokeStyle = 'rgba(127,216,255,.25)'; ctx.beginPath(); ctx.moveTo(0, HORIZON); ctx.lineTo(W, HORIZON); ctx.stroke();
      for (const x of [60, 140, W - 140, W - 60]) { ctx.fillStyle = '#2a1010'; ctx.beginPath(); ctx.moveTo(x - 30, HORIZON); ctx.lineTo(x + 30, HORIZON); ctx.lineTo(x + 20, HORIZON + 10); ctx.lineTo(x - 20, HORIZON + 10); ctx.fill(); ctx.fillRect(x - 2, HORIZON - 26, 4, 26); ctx.fillStyle = '#7a2a1a'; ctx.beginPath(); ctx.moveTo(x + 2, HORIZON - 24); ctx.lineTo(x + 18, HORIZON - 14); ctx.lineTo(x + 2, HORIZON - 8); ctx.fill(); }
    }
    ctx.fillStyle = '#1a1410'; ctx.fillRect(0, GROUND, W, H - GROUND);
    for (const tw of towers) {
      const dead = tw.down || tw.hit;
      ctx.fillStyle = dead ? '#3a1410' : '#5a6470'; ctx.fillRect(tw.x - 14, GROUND - 34, 28, 34);
      ctx.fillStyle = dead ? '#5a1a12' : '#7fd8ff'; ctx.beginPath(); ctx.arc(tw.x, GROUND - 42, 10, 0, 7); ctx.fill();
      ctx.fillStyle = dead ? '#ff8a7a' : '#cfc6ab'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText(tw.name, tw.x, GROUND + 20);
    }
    ctx.fillStyle = '#b08d57'; ctx.beginPath(); ctx.moveTo(BX - 26, GROUND); ctx.lineTo(BX, GROUND - 26); ctx.lineTo(BX + 26, GROUND); ctx.fill();
    ctx.lineWidth = 2;
    for (const w of waves) if (w.alive && w.spawned) {
      ctx.strokeStyle = 'rgba(255,75,58,.6)'; ctx.beginPath(); w.trail.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
      ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(w.x, w.y, 4, 0, 7); ctx.fill();
    }
    for (const s of shots) { const k = (t - s.t0) / s.dur; ctx.strokeStyle = 'rgba(127,216,255,.8)'; ctx.beginPath(); ctx.moveTo(BX, GROUND - 26); ctx.lineTo(BX + (s.x - BX) * k, GROUND - 26 + (s.y - GROUND + 26) * k); ctx.stroke(); }
    for (const b of bursts) if (b.r > 0) { ctx.fillStyle = 'rgba(232,207,152,.35)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.strokeStyle = '#e8cf98'; ctx.stroke(); }
    for (const b of booms) { const a = t - b.t0; if (a < 0.6) { ctx.fillStyle = `rgba(255,120,60,${0.8 - a})`; ctx.beginPath(); ctx.arc(b.x, b.y, (b.small ? 14 : 34) * (0.4 + a), 0, 7); ctx.fill(); } }
    ctx.lineWidth = 1;
    if (waves.every(w => !w.alive) && !g.done) finish();
  };
}

// ---------- start ----------
requestAnimationFrame(frame);
if (role && code) takeStation();
