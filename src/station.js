// An officer's station: joined to the game with the operator's code. Draws the game's snapshot and sends actions
// back; the game decides what they do. Each station has a steady job, the shared fleet, and a defence game that
// the game triggers every few minutes.
import { openLink, cleanCode } from './link.js';
import { mountFleet } from './fleetui.js';
import * as WS from './workshop.js';
import * as GA from './games.js';
import { glyphSVG, echoAt, ECHO_W } from './glyphs.js';
import { GRID, CELL, CAMERAS } from './scenario.js';
import { drawFurnaceLog, furnaceNumbers } from './furnacelog.js';
import { mulberry32 } from './sim.js';
import * as audio from './audio.js';

const $ = id => document.getElementById(id);
const ROLE_NAME = { gunnery: 'GUNNERY & TARGETING', signals: 'SIGNALS & SONAR', engineer: 'ENGINEERING & POWER' };
const JOB = { gunnery: 'THE BEACON WORKSHOP', signals: 'THE CASE BOARD', engineer: 'THE FURNACE' };
const SYS_LABEL = { cameras: 'ORBS', sonar: 'SONAR', radio: 'RADIO', scanner: 'SCANNER', currents: 'CURRENTS', repair: 'REPAIR', workshop: 'WORKSHOP' };
const fmt = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const COLS = 'ABCDEFGHIJKL';
const gridRef = p => p ? COLS[Math.max(0, Math.min(GRID - 1, Math.floor(p.x / CELL)))] + (Math.max(0, Math.min(GRID - 1, Math.floor(p.y / CELL))) + 1) : '--';

// ---------- joining ----------
const params = new URLSearchParams(location.search);
let role = params.get('role'), code = cleanCode(params.get('code'));
try { role = role || localStorage.getItem('lastwatch-station-role'); code = code || cleanCode(localStorage.getItem('lastwatch-station-code')); } catch (e) { }
let snap = null, snapAt = 0, netState = '';
const link = openLink(m => { if (m.snap) { snap = m.snap; snapAt = performance.now(); } }, s => { netState = s; });
const send = act => link.send({ station: { role, ...act } });

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
$('switch').onclick = () => { $('desk').classList.add('hidden'); $('join').classList.remove('hidden'); };
function takeStation() {
  link.join(code);
  $('join').classList.add('hidden'); $('desk').classList.remove('hidden');
  $('rolename').textContent = '· ' + ROLE_NAME[role] + ' ·';
  $('jobtitle').textContent = JOB[role];
  document.title = 'The Last Watch · ' + ROLE_NAME[role];
  jobKey = ''; $('jobbody').innerHTML = '';
  if (role === 'gunnery') buildWorkshop();
  if (role === 'engineer') buildFurnace();
}
setInterval(() => { if (role && !$('desk').classList.contains('hidden')) send({ hello: true }); }, 2000);

// ---------- the fleet ----------
const fleetUI = mountFleet($('fleet'), () => ({ fleet: snap && snap.fleet, t: snap ? snap.t : 0 }), a => { send(a); audio.sfx.click(); }, { cell: 30 });

// ---------- the main loop ----------
let jobKey = '';
function frame() {
  const live = snap && performance.now() - snapAt < 4000;
  $('link').innerHTML = `<i class="${live ? 'on' : netState === 'SUBSCRIBED' || netState === 'LOCAL' ? 'wait' : 'off'}"></i><span>${live ? 'linked to the Watch' : code ? 'waiting for the Watch · code ' + code : 'not linked'}</span>`;
  if (snap) {
    $('clock').textContent = snap.hold === 'deploy' ? 'DEPLOY' : fmt(snap.t);
    fleetUI.render();
    if (role === 'gunnery') drawWorkshop();
    if (role === 'signals') drawCaseBoard();
    if (role === 'engineer') drawFurnace();
    checkDefence();
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
      <td>${o.metal == null ? '<span class="tile">?</span>' : o.metal ? '<span class="tile T">METAL</span>' : '<span class="tile F">NONE</span>'}</td>
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
  if (performance.now() - flogAt > 500) { flogAt = performance.now(); drawFurnaceLog($('flog'), fs); }
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
// THE DEFENCES
// =====================================================================
const DEF_TITLE = { missile: ['DEVIL FIRE INBOUND', 'Shoot it down before it reaches the towers. Click to burst flak.'], mines: ['MINES IN THE APPROACHES', 'Clear the field: left click opens, right click flags. Touch a mine and the buoy is lost.'], lights: ['THE BREAKERS HAVE TRIPPED', 'Get every breaker dark. Each press flips a breaker and its four neighbours.'] };
let current = null;
const finished = new Set();
function checkDefence() {
  const a = snap.defence && snap.defence.active && snap.defence.active[role];
  if (current && (!a || a.id !== current.id)) { if (!current.done) closeDefence(); }
  if (a && !current && !finished.has(a.id)) startDefence(a);
}
function startDefence(a) {
  current = { id: a.id, kind: a.kind, rng: mulberry32(a.seed), t0: performance.now(), done: false };
  $('dtitle').textContent = DEF_TITLE[a.kind][0]; $('dsub').textContent = DEF_TITLE[a.kind][1];
  $('dresult').classList.add('hidden'); $('defence').classList.remove('hidden');
  audio.sfx.alarm();
  ({ missile: startMissile, mines: startMines, lights: startLights })[a.kind](current);
  tickDefence();
}
function tickDefence() {
  if (!current || current.done) return;
  const left = GA.GAME_TIME[current.kind] - (performance.now() - current.t0) / 1000;
  $('dtime').textContent = fmt(Math.max(0, left));
  if (left <= 0) current.timeout && current.timeout();
  if (current.tick) current.tick();
  if (!current.done) requestAnimationFrame(tickDefence);
}
function finishDefence(ok, res, text) {
  if (!current || current.done) return;
  current.done = true; finished.add(current.id);
  send({ act: 'defence', id: current.id, res: { ok, ...res } });
  const r = $('dresult'); r.textContent = text; r.className = ok ? 'ok' : 'bad';
  (ok ? audio.sfx.calibrated : audio.sfx.blowout)();
  setTimeout(closeDefence, 2600);
}
function closeDefence() { $('defence').classList.add('hidden'); $('dbody').innerHTML = ''; current = null; }

// ---------- Lights Out ----------
function startLights(g) {
  let { board } = GA.loBoard(g.rng);
  const draw = () => {
    $('dbody').innerHTML = `<div class="lo">${board.map((v, i) => `<button class="${v ? 'on' : ''}" data-i="${i}"></button>`).join('')}</div>`;
    $('dbody').querySelectorAll('button').forEach(b => b.onclick = () => {
      if (g.done) return;
      board = GA.loPress(board, Number(b.dataset.i)); audio.sfx.click(); draw();
      if (GA.loSolved(board)) finishDefence(true, {}, 'BREAKERS RESET');
    });
  };
  g.timeout = () => finishDefence(false, {}, 'TOO SLOW · A SYSTEM HAS DROPPED');
  draw();
}

// ---------- Minesweeper ----------
function startMines(g) {
  const { mines, start } = GA.msBoard(g.rng), M = new Set(mines), open = new Set(), flags = new Set();
  GA.msOpen(M, open, start);
  const draw = (boom = -1) => {
    let h = '';
    for (let i = 0; i < GA.MS * GA.MS; i++) {
      const n = GA.msCount(M, i);
      if (i === boom || (boom >= 0 && M.has(i))) h += '<div class="o m"></div>';
      else if (open.has(i)) h += `<div class="o n${n}">${n || ''}</div>`;
      else h += `<div class="${flags.has(i) ? 'f' : ''}" data-i="${i}"></div>`;
    }
    $('dbody').innerHTML = `<div class="ms">${h}</div><p class="hint" style="text-align:center">${M.size - flags.size} mines unflagged</p>`;
    $('dbody').querySelectorAll('[data-i]').forEach(d => {
      d.onclick = () => {
        if (g.done) return;
        const i = Number(d.dataset.i); if (flags.has(i)) return;
        if (M.has(i)) { draw(i); finishDefence(false, {}, 'A MINE · THE BUOY IS LOST'); return; }
        GA.msOpen(M, open, i); audio.sfx.click();
        if (open.size === GA.MS * GA.MS - M.size) { draw(); finishDefence(true, {}, 'THE FIELD IS CLEAR'); return; }
        draw();
      };
      d.oncontextmenu = e => { e.preventDefault(); if (g.done) return; const i = Number(d.dataset.i); flags.has(i) ? flags.delete(i) : flags.add(i); draw(); };
    });
  };
  g.timeout = () => { draw(); finishDefence(false, {}, 'OUT OF TIME · THE BUOY IS LOST'); };
  draw();
}

// ---------- Missile Command ----------
function startMissile(g) {
  const W = 980, H = 580, GROUND = 530, BX = W / 2;
  $('dbody').innerHTML = `<canvas width="${W}" height="${H}"></canvas>`;
  const cv = $('dbody').querySelector('canvas'), ctx = cv.getContext('2d');
  const towers = CAMERAS.map((c, i) => ({ id: c.id, name: c.name, x: 70 + i * (W - 140) / 6, down: !!(snap.cams && snap.cams[i] && snap.cams[i].broken), hit: false }));
  const waves = GA.missileWaves(g.rng, snap.t / 60).map(w => ({ ...w, x0: 40 + w.from * (W - 80), alive: true, spawned: false }));
  const shots = [], bursts = [], booms = [];
  let lastShot = -9;
  const now = () => (performance.now() - g.t0) / 1000;
  cv.onclick = e => {
    if (g.done) return;
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height, t = now();
    if (t - lastShot < 0.35 || shots.length >= 3 || y > GROUND - 10) return;
    lastShot = t; shots.push({ x, y, t0: t, dur: Math.hypot(x - BX, y - GROUND) / 900 }); audio.sfx.click();
  };
  const finish = () => {
    const hits = towers.filter(t => t.hit && !t.down).map(t => t.id);
    finishDefence(hits.length === 0, { hits }, hits.length ? `${hits.length} TOWER${hits.length > 1 ? 'S' : ''} HIT · THOSE ORBS ARE DOWN` : 'EVERY TOWER STANDS');
  };
  g.timeout = finish;
  g.tick = () => {
    const t = now();
    for (const w of waves) {
      if (!w.alive || t < w.at) continue;
      const tw = towers[w.to], dur = 7 / w.speed, k = Math.min(1, (t - w.at) / dur);
      w.x = w.x0 + (tw.x - w.x0) * k; w.y = 0 + GROUND * k; w.spawned = true;
      if (k >= 1) { w.alive = false; booms.push({ x: tw.x, y: GROUND, t0: t }); if (!tw.down) tw.hit = true; audio.sfx.blowout(); }
    }
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; if (t - s.t0 >= s.dur) { bursts.push({ x: s.x, y: s.y, t0: t }); shots.splice(i, 1); } }
    for (const b of bursts) {
      const a = t - b.t0, r = a < 0.35 ? 46 * a / 0.35 : a < 0.7 ? 46 : Math.max(0, 46 * (1 - (a - 0.7) / 0.3));
      b.r = r;
      for (const w of waves) if (w.alive && w.spawned && Math.hypot(w.x - b.x, w.y - b.y) < r) { w.alive = false; booms.push({ x: w.x, y: w.y, t0: t, small: true }); }
    }
    // draw
    ctx.fillStyle = '#05080a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a1410'; ctx.fillRect(0, GROUND, W, H - GROUND);
    for (const tw of towers) {
      const dead = tw.down || tw.hit;
      ctx.fillStyle = dead ? '#3a1410' : '#5a6470'; ctx.fillRect(tw.x - 14, GROUND - 34, 28, 34);
      ctx.fillStyle = dead ? '#5a1a12' : '#7fd8ff'; ctx.beginPath(); ctx.arc(tw.x, GROUND - 42, 10, 0, 7); ctx.fill();
      ctx.fillStyle = dead ? '#ff8a7a' : '#cfc6ab'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText(tw.name, tw.x, GROUND + 20);
    }
    ctx.fillStyle = '#b08d57'; ctx.beginPath(); ctx.moveTo(BX - 26, GROUND); ctx.lineTo(BX, GROUND - 26); ctx.lineTo(BX + 26, GROUND); ctx.fill();
    ctx.lineWidth = 2;
    for (const w of waves) if (w.alive && w.spawned) { ctx.strokeStyle = 'rgba(255,75,58,.7)'; ctx.beginPath(); ctx.moveTo(w.x0, 0); ctx.lineTo(w.x, w.y); ctx.stroke(); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(w.x, w.y, 4, 0, 7); ctx.fill(); }
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
