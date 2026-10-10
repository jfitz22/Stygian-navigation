import { createBannerUI } from './banner-ui.js';
import {art,sprite,artOn} from './art-assets.js';
import { stokeArt } from './stokeart.js';
// An officer's station: joined to the game with the operator's code. Draws the game's snapshot and sends actions
// back; the game decides what they do. Each station has a steady job, the shared fleet, and a defence game that
// the game triggers every few minutes.
import { openLink, cleanCode } from './link.js';
import { mountFleet, mountFleetDept, morseText } from './fleetui.js';
import { MAIN } from './fleet.js';
import * as WS from './workshop.js';
import * as GA from './games.js';
import { glyphSVG, echoAt, ECHO_W } from './glyphs.js';
import { GRID, CELL, CAMERAS, TUNING as T } from './scenario.js';
import { drawFurnaceLog, furnaceNumbers } from './furnacelog.js';
import { mulberry32, artifactText } from './sim.js';
import * as audio from './audio.js';

const $ = id => document.getElementById(id);
const ROLE_NAME = { gunnery: 'GUNNERY & TARGETING', signals: 'SIGNALS & SONAR', engineer: 'ENGINEERING & POWER', fleet: 'FLEET COMMAND' };
const JOB = { gunnery: 'THE BEACON WORKSHOP', signals: 'THE CASE BOARD', engineer: 'THE FURNACE', fleet: 'FLEET COMMAND' };
const FIRST = {
  fleet: ['<b>You command the fleet.</b> Click their table to aim one shot for each of our ships afloat; both fleets fire together when the salvo clock runs out, or when you press FIRE. Your own ship is the four-long.', '<b>The specials</b> start loaded. The departments reload theirs with four flags: your codebook turns each into a rune, and every second reload a Morse question too (your book has the table). Your own crosshair scan reloads when you decode a dispatch (below).', '<b>A sunk ship</b> is salvaged: read its board to Engineering, wait for their power, then place her back at sea. <b>When the depth-charge alarm sounds</b>, steer with ← → and drop charges with SPACE.'],
  gunnery: ['<b>Build beacons</b> at the workshop: your book has the shell; Engineering has the core; Signals has the crystal.', '<b>When devil fire comes</b>, click to burst flak in its path: every tower it reaches is an orb lost.', '<b>Your special</b> (the heavy shell) reloads by flag code: describe your four flags to the Fleet Officer, press the runes they read back. Every second reload asks a Morse question.'],
  signals: ['<b>Keep the case board</b>: decode each radio pattern and type in its call sign. The sonar here is a copy of the operator\'s.', '<b>Minesweeping</b> is optional: complete a sweep and the guns beacon a glacier for free.', '<b>When the buoy cable snaps</b>, steer with the arrow keys and collect the ends; the walls wrap round, your own cable does not.'],
  engineer: ['<b>Keep the furnace alive</b>: the log shows where the heat is heading. Set the shed order and the damper.', '<b>The breaker panel</b> is optional: clear it for a free shovel of fuel.', '<b>When the stokehold fires fail</b>, run the decks with ↑ ↓ and fling coal with SPACE: keep all four fires in the green.'],
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
const ticking = () => snap && !snap.paused && !snap.hold && snap.started;
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
  document.body.dataset.role = role;
  $('jobtitle').textContent = JOB[role];
  document.title = 'The Last Watch · ' + ROLE_NAME[role];
  jobKey = ''; $('jobbody').innerHTML = '';
  if ($('sonarpanel')) $('sonarpanel').classList.add('hidden');
  if (role === 'gunnery') buildWorkshop();
  if (role === 'engineer') buildFurnace();
  if (role === 'signals') buildSonar();
  // the Fleet Officer's job is the fleet itself; the other officers watch it, and load their own special
  $('fleetpanel').classList.toggle('hidden', role === 'fleet');
  $('job').classList.toggle('fleetjob', role === 'fleet');
  $('fleetdept').classList.toggle('hidden', role === 'fleet');
  $('leftcol').classList.toggle('wide', role === 'fleet'); $('rightcol').classList.toggle('hidden', role === 'fleet');
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
  if (role === 'fleet') return snap && snap.clearance ? 'clearing a green beacon' : snap && snap.fleet && Object.keys(snap.fleet.salvage || {}).length ? 'salvaging a ship' : steady.state && !steady.state.over ? 'decoding a dispatch' : 'commanding the fleet';
  return '';
}

// ---------- the fleet ----------
const shotSound = l => (l.ours.some(o => o[2] === 'hit') ? audio.sfx.hit : audio.sfx.miss)();
const engineerLive = () => !!(snap && snap.defence && snap.defence.live && snap.defence.live.engineer);
const fleetUI = mountFleet($('fleet'), () => ({ fleet: snap && snap.fleet, t: nowT(), mode: 'view', engineerLive: engineerLive() }), a => send(a), { cell: 15, compact: true, onShot: shotSound });
// the Fleet Officer commands from their own station (its job panel)
let commandUI = null;
const fleetCommandUI = () => commandUI || (commandUI = mountFleet($('jobbody'), () => ({ fleet: snap && snap.fleet, t: nowT(), mode: snap && snap.commander === 'fleet' ? 'command' : 'view', beacons: snap ? snap.beacons + snap.orange : null, engineerLive: engineerLive() }), a => { send(a); audio.sfx.click(); }, { cell: 31, onShot: shotSound }));
const deptUI = mountFleetDept($('fleetdeptbody'), () => ({ fleet: snap && snap.fleet, t: nowT() }), a => { send(a); audio.sfx.click(); }, () => role);
// a hit on your ship cracks your screen; the worse the ship, the worse the glass
// One hit: the glass cracks. Two: the station lists ten degrees. Sunk: the lights go red. All of it until she is
// redeployed (or the fleet refitted). The Fleet Officer's own ship is the four-long.
function drawCracks() {
  const f = snap && snap.fleet, el = $('cracks');
  const ship = f && f.mine && f.mine[MAIN[role]];
  const hits = !ship || f.phase === 'off' || ship.x == null ? 0 : ship.hits.length, gone = hits > 0 && hits >= ship.len;
  const k = gone ? 'sunk' : String(hits);
  if (el.dataset.k === k) return; el.dataset.k = k;
  el.className = gone ? 'sev10' : hits ? 'sev' + Math.min(9, hits * 3) : '';
  el.innerHTML = hits ? crackSVG(gone ? 1 : Math.min(0.8, 0.3 + hits * 0.2)) : '';
  document.body.classList.toggle('tilt', hits >= 2);
  document.body.classList.toggle('redlight', gone);
  if (hits && !gone) audio.sfx.blowout();
}
function crackSVG(sev) {
  const lines = [['M0 120 L180 230 L260 200 L420 330', 'M180 230 L150 380', 'M260 200 L300 90'], ['M1920 60 L1700 220 L1620 200 L1480 360', 'M1700 220 L1760 420'], ['M960 1080 L1010 860 L940 760 L1060 600', 'M1010 860 L1180 900', 'M940 760 L820 700'], ['M0 900 L240 820 L300 880 L520 760'], ['M1920 820 L1700 760 L1600 820']];
  const n = Math.max(1, Math.round(sev * lines.length));
  return `<svg viewBox="0 0 1920 1080" preserveAspectRatio="none">${lines.slice(0, n).flat().map(d => `<path d="${d}" fill="none" stroke="rgba(220,235,245,.55)" stroke-width="${sev >= 1 ? 3 : 2}"/><path d="${d}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1" transform="translate(2,2)"/>`).join('')}</svg>`;
}

// The green beacon needs the Fleet Officer's clearance: the operator sees two questions in Morse and three answers.
// The Fleet Officer sees the same here, reads them with the book's table, and tells the operator which to choose.
let clearKey = '';
function drawClearance() {
  const c = snap && snap.clearance, el = $('clearpanel');
  const k = c ? JSON.stringify(c) : '';
  if (k === clearKey) return; clearKey = k;
  el.classList.toggle('hidden', !c);
  if (!c) { el.innerHTML = ''; return; }
  const q = c.qs[c.step];
  el.innerHTML = `<h2>CLEARANCE REQUESTED <small>the operator is firing a GREEN beacon · question ${c.step + 1} of ${c.qs.length}</small></h2>
    <div class="howto">The operator's console asks this in Morse. Decode it with the table in your book and tell them which answer (A, B or C). One wrong answer and the green beacon stays in the rack.</div>
    <div class="morsebig">${morseText(q.q)}</div>
    <div class="morseopts">${q.opts.map((o, i) => `<div><b>${'ABC'[i]}</b> ${morseText(o)}</div>`).join('')}</div>`;
  audio.sfx.alarm();
}

// ---------- the main loop ----------
let jobKey = '';
const reported = new Set();
function safely(name, fn) { try { fn(); } catch (e) { if (!reported.has(name)) { reported.add(name); console.error('station panel "' + name + '" failed:', e); } } }
let bannerUI, bannerRole;
function frame() {
  if (role === 'engineer') stokeArt();   // load the stokehold art early, so the first call shows it
  if (role !== bannerRole) { bannerUI?.destroy(); bannerRole = role; bannerUI = createBannerUI(role, (eventId, key) => send({act:'banner-dismiss', eventId, key})); }

  const live = snap && performance.now() - snapAt < 4000;
  $('link').innerHTML = `<i class="${live ? 'on' : netState === 'SUBSCRIBED' || netState === 'LOCAL' ? 'wait' : 'off'}"></i><span>${live ? 'linked to the Watch' : code ? 'waiting for the Watch · code ' + code : 'not linked'}</span>`;
  $('lost').classList.toggle('hidden', !(linkedOnce && !live && !$('desk').classList.contains('hidden')));
  if (snap) {
    $('clock').textContent = snap.hold === 'deploy' ? 'DEPLOY' : fmt(nowT());
    if (role === 'fleet') safely('fleet command', () => fleetCommandUI().render()); else { safely('fleet', () => fleetUI.render()); safely('fleet dept', () => deptUI.render()); }
    safely('cracks', drawCracks);
    if (role === 'fleet') safely('clearance', drawClearance);
    if (role === 'gunnery') safely('workshop', drawWorkshop);
    if (role === 'signals') { safely('sonar', drawSonar); safely('case board', drawCaseBoard); }
    if (role === 'engineer') safely('furnace', drawFurnace);
    safely('steady', () => drawSteady());
    safely('defence', checkDefence);
  }
  if (bannerUI) bannerUI.update($('desk').classList.contains('hidden') ? null : snap?.bannerEvent, snap?.bannerNow);
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
  { const cap = { red: T.beaconStock, orange: T.orangeStock, green: T.greenStock }[ws.color], have = { red: snap.beacons, orange: snap.orange, green: snap.green }[ws.color] + snap.workshop.curing.filter(q => q.color === ws.color).length;
    if (have >= cap) { ws.msg = `The rack is full: it holds ${cap} ${ws.color} beacon${cap > 1 ? 's' : ''}. Fire one first.`; audio.sfx.deny(); drawBench(); return; } }
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
  if (!$('sonarpanel')) $('job').insertAdjacentHTML('beforebegin', `<section id="sonarpanel" class="panel"><h2>THE SONAR <small>a copy of the operator's screen · click any contact to read its echo</small></h2>
    <div class="sonarrow"><canvas id="sonarcv" width="300" height="300"></canvas><div><div class="lbl" id="echolbl">ECHO PRINTOUT · the contact the operator has selected</div><canvas id="echocv" width="300" height="160"></canvas><div id="sonarinfo" class="hint"></div></div></div>
    <div id="stormwarn" class="hidden"></div></section>`);
  $('sonarpanel').classList.remove('hidden');
  // Signals can read any contact's echo for themselves. It changes nothing on the operator's screen.
  $('sonarcv').onclick = e => {
    const r = $('sonarcv').getBoundingClientRect(), x = (e.clientX - r.left) * 300 / r.width, y = (e.clientY - r.top) * 300 / r.height;
    let best = null, bd = 16;
    for (const h of sonarDots) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h.id; } }
    myPick = best;
  };
}
let myPick = null, sonarDots = [];
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
    sonarDots = [];
    for (const c of so.contacts) {
      const [x, y] = xy(c); if (Math.hypot(x - 150, y - 150) > 150) continue;
      sonarDots.push({ id: c.id, x, y });
      const fade = Math.max(0.2, 1 - c.age / T.contactFade), r = Math.max(2.5, Math.min(8, 2 + c.length * 0.25));
      ctx.fillStyle = `rgba(160,255,200,${fade})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      if (snap.selected === c.id) { ctx.strokeStyle = '#ffb347'; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 7); ctx.stroke(); }
      if (myPick === c.id) { ctx.strokeStyle = '#6fc8ff'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(x, y, r + 9, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
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
  if (myPick && !so.contacts.some(x => x.id === myPick)) myPick = null;   // that echo has faded
  const mine = myPick && so.contacts.find(x => x.id === myPick), ec = $('echocv').getContext('2d'), c = mine || so.contacts.find(x => x.id === snap.selected);
  const lbl = mine ? "ECHO PRINTOUT · SIGNALS' PICK · click empty water to follow the operator" : "ECHO PRINTOUT · the contact the operator has selected";
  if ($('echolbl').textContent !== lbl) $('echolbl').textContent = lbl;
  ec.fillStyle = '#e8dfc6'; ec.fillRect(0, 0, 300, 160);
  ec.strokeStyle = 'rgba(120,90,60,.22)'; for (let x = 0; x < 300; x += 16) { ec.beginPath(); ec.moveTo(x + .5, 16); ec.lineTo(x + .5, 136); ec.stroke(); }
  if (!c || !c.echo) { ec.fillStyle = '#6b5a3a'; ec.font = '12px IBM Plex Mono'; ec.textAlign = 'center'; ec.fillText('Click a contact on the sonar', 150, 84); $('sonarinfo').textContent = ''; return; }
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
      <td>${o.metal == null ? '<span class="tile">?</span>' : o.metal ? '<span class="tile T">METAL</span>' + (o.artifact ? '<br><small style="color:#c58cff" title="' + artifactText(o.artifact).replace(/"/g, '&quot;') + '">✦ ' + o.artifact + '</small>' : '') : '<span class="tile F">NONE</span>'}</td>
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
  steady.kind = role === 'signals' ? 'mines' : role === 'engineer' ? 'lights' : role === 'fleet' ? 'dispatch' : null;
  $('steady').classList.toggle('hidden', !steady.kind);
  if (!steady.kind) return;
  $('steadytitle').innerHTML = { mines: 'MINESWEEPING <small>complete a sweep for a free beacon on a random iceberg</small>', lights: 'THE BREAKER PANEL <small>clear it for a free shovel of fuel</small>', dispatch: 'AN ENEMY DISPATCH <small>decode its signal lights to reload your crosshair scan</small>' }[steady.kind];
  newSteadyBoard();
}
const cooldownLeft = () => !snap || !snap.rewards ? 0 : Math.max(0, (snap.rewards[steady.kind] || 0) - snap.t);
function newSteadyBoard() {
  const rng = mulberry32(Math.floor(Math.random() * 1e9));
  if (steady.kind === 'mines') { const { mines, start } = GA.msBoard(rng), M = new Set(mines), open = new Set(); GA.msOpen(M, open, start); steady.state = { M, open, flags: new Set(), boom: -1, over: false }; }
  else if (steady.kind === 'dispatch') steady.state = { secret: GA.mmSecret(rng), guesses: [], cur: [], over: false };
  else steady.state = { board: GA.loBoard(rng).board, over: false };
  steady.msg = ''; drawSteady(true);
}
let steadyKey = '';
function drawSteady(force) {
  if (!steady.kind || !steady.state) return;
  const cd = Math.ceil(cooldownLeft()), waiting = steady.state.over && cd > 0;
  const k = JSON.stringify([waiting ? cd : -1, steady.msg, snap && snap.canReveal, snap && snap.needsPower, snap && snap.canUnmask]) + (force ? Math.random() : '');
  if (k === steadyKey && !force) return;
  steadyKey = k;
  // after a win, wait for the game's cooldown to arrive and run out before the next board
  if (steady.state.over && steady.state.won && cd <= 0 && performance.now() - steady.state.wonAt > 4000) { newSteadyBoard(); return; }
  if (steady.kind === 'mines') drawMinesSteady(cd); else if (steady.kind === 'dispatch') drawDispatchSteady(cd); else drawLightsSteady(cd);
}
// The Fleet Officer's dispatch: four signal lights from six colours, eight tries (Mastermind).
function drawDispatchSteady(cd) {
  const st = steady.state, N = GA.MM.len, lamp = (c, size = 26) => `<i class="mmlamp" style="width:${size}px;height:${size}px;background:${c == null ? '#1a1612' : GA.MM_HEX[c]};${c == null ? '' : 'box-shadow:0 0 8px ' + GA.MM_HEX[c]}"></i>`;
  const pegs = sc => `<span class="mmpegs">${Array.from({ length: N }, (_, i) => `<i class="${i < sc.full ? 'full' : i < sc.full + sc.half ? 'half' : ''}"></i>`).join('')}</span>`;
  const rows = st.guesses.map(g => `<div class="mmrow">${g.guess.map(c => lamp(c)).join('')}${pegs(g.score)}</div>`).join('');
  const cur = !st.over ? `<div class="mmrow cur">${Array.from({ length: N }, (_, i) => lamp(st.cur[i])).join('')}<span class="hint">try ${st.guesses.length + 1} of ${GA.MM.tries}</span></div>` : '';
  const reveal = st.over && !st.won ? `<div class="mmrow">${st.secret.map(c => lamp(c)).join('')}<span class="hint">the dispatch was</span></div>` : '';
  $('steadybody').innerHTML = `<div class="steadygrid">
    <div class="mmboard">${rows}${cur}${reveal}
      ${!st.over ? `<div class="mmpick">${GA.MM.colors.map((n, i) => `<button data-c="${i}" title="${n}">${lamp(i, 30)}</button>`).join('')}<button class="btn" data-mmback>⌫</button><button class="btn" data-mmgo ${st.cur.length === N ? '' : 'disabled'}>SEND</button></div>` : ''}</div>
    <div class="howto" style="max-width:330px">
      An enemy dispatch, flashed as <b>four signal lights</b> from six colours (a colour may repeat). Guess it in <b>eight tries</b>.<br><br>
      After each try: a <b>bright peg</b> for every light right in colour and place; a <b>dim peg</b> for every other light right in colour only.<br><br>
      Decode it and choose: <b>reload your crosshair scan</b>, or <b>unmask a disguised warship</b> on the operator's chart.
    </div></div>
    <div class="reward">${steady.msg}${st.over && !st.won ? ' <button class="btn" id="mmnew">NEW DISPATCH</button>' : ''}${st.choosing ? ` <button class="btn" id="mmscan">RELOAD THE CROSSHAIR SCAN</button> <button class="btn" id="mmunmask" ${snap && snap.canUnmask ? '' : 'disabled title="No disguised warship left to unmask"'}>UNMASK A WARSHIP</button>` : ''}${st.over && st.won && !st.choosing && cd > 0 ? ` The next dispatch comes in ${cd} s.` : ''}</div>`;
  const nb = $('mmnew'); if (nb) nb.onclick = newSteadyBoard;
  const choose = c => { st.choosing = false; st.wonAt = performance.now(); steady.msg = c === 'unmask' ? 'DECODED. A disguised warship is marked on the operator\'s chart.' : 'DECODED. The crosshair scan is loaded.'; send({ act: 'dispatch', choice: c }); audio.sfx.calibrated(); drawSteady(true); };
  if ($('mmscan')) $('mmscan').onclick = () => choose('scan');
  if ($('mmunmask')) $('mmunmask').onclick = () => choose('unmask');
  if (st.over) return;
  $('steadybody').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { if (st.cur.length < N) { st.cur.push(Number(b.dataset.c)); audio.sfx.click(); drawSteady(true); } });
  const back = $('steadybody').querySelector('[data-mmback]'); if (back) back.onclick = () => { st.cur.pop(); drawSteady(true); };
  const go = $('steadybody').querySelector('[data-mmgo]');
  if (go) go.onclick = () => {
    if (st.cur.length !== N) return;
    const score = GA.mmScore(st.secret, st.cur); st.guesses.push({ guess: st.cur, score }); st.cur = [];
    if (score.full === N) { st.over = true; st.won = true; st.choosing = true; steady.msg = 'THE DISPATCH IS DECODED. Choose:'; audio.sfx.calibrated(); }
    else if (st.guesses.length >= GA.MM.tries) { st.over = true; st.won = false; steady.msg = 'The dispatch is lost in the static.'; audio.sfx.deny(); }
    else audio.sfx.click();
    drawSteady(true);
  };
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
      Mines have drifted into the approaches. <b>Complete a sweep</b> and choose your reward: <b>a beacon strikes a random iceberg</b>, or <b>a square of an enemy hull is sighted</b> on the fleet tables.<br><br>
      <b>The numbers:</b> each one says how many of the eight squares touching it hold a mine. A <b>1</b> with only one hidden square beside it: that square is a mine.<br><br>
      <b>Left click</b> opens a square. <b>Right click</b> flags a mine. Start from the open patch; every field can be solved without guessing.<br><br>
      ${M.size - flags.size} mines unflagged. Nothing is lost if you hit one: start a new field.
    </div></div>
    <div class="reward">${steady.msg}${st.over && !st.won ? ' <button class="btn" id="msnew">NEW FIELD</button>' : ''}${st.choosing ? ` <button class="btn" id="rwbeacon">BEACON AN ICEBERG</button> <button class="btn" id="rwreveal" ${snap && snap.canReveal ? '' : 'disabled title="No enemy ship left to plot (or the fleet is not in action)"'}>SIGHT AN ENEMY HULL</button>` : ''}${st.over && st.won && !st.choosing && cd > 0 ? ` The next sweep opens in ${cd} s.` : ''}</div>`;
  const nb = $('msnew'); if (nb) nb.onclick = newSteadyBoard;
  const choose = c => { st.choosing = false; st.wonAt = performance.now(); steady.msg = c === 'reveal' ? 'SWEEP COMPLETE. An enemy hull is sighted on the fleet tables.' : 'SWEEP COMPLETE. The guns are firing.'; send({ act: 'minesweeper', choice: c }); audio.sfx.calibrated(); drawSteady(true); };
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
      The breakers on the boiler line. <b>Get every breaker dark</b> and choose: <b>a free shovel of fuel</b>, or, while one of our ships is being salvaged, <b>power for that ship</b>.<br><br>
      <b>Pressing a breaker flips it and its four neighbours</b> (up, down, left, right).<br><br>
      One free shovel a minute. Take your time: nothing goes wrong here.
    </div></div>
    <div class="reward">${steady.msg}${st.choosing ? ` <button class="btn" id="lofuel">A SHOVEL OF FUEL</button> <button class="btn" id="lopower" ${snap && snap.needsPower ? '' : 'disabled title="No ship is waiting for power"'}>POWER THE SUNK SHIP</button>` : ''}${st.over && !st.choosing && cd > 0 ? ` The next panel lights up in ${cd} s.` : ''}</div>`;
  const pick = c => { st.choosing = false; st.wonAt = performance.now(); steady.msg = c === 'power' ? 'PANEL CLEAR. Power goes to the ship under salvage.' : 'PANEL CLEAR. A shovel of fuel drops into the chute.'; send({ act: 'lightsout', choice: c }); audio.sfx.calibrated(); drawSteady(true); };
  if ($('lofuel')) $('lofuel').onclick = () => pick('fuel');
  if ($('lopower')) $('lopower').onclick = () => pick('power');
  if (st.over) return;
  $('steadybody').querySelectorAll('.lo6 button').forEach(b => b.onclick = () => {
    st.board = GA.loPress(st.board, Number(b.dataset.i)); audio.sfx.click();
    if (GA.loSolved(st.board)) { st.over = true; st.won = true; st.wonAt = performance.now(); audio.sfx.calibrated();
      if (snap && snap.needsPower) { st.choosing = true; steady.msg = 'PANEL CLEAR. Choose:'; }
      else { steady.msg = 'PANEL CLEAR. A shovel of fuel drops into the chute.'; send({ act: 'lightsout', choice: 'fuel' }); } }
    drawSteady(true);
  });
}

// =====================================================================
// THE DEFENCES (triggered by the game; an inset console, never the whole screen)
// =====================================================================
const DEF_TITLE = {
  missile: ['DEVIL FIRE INBOUND', 'Shoot it down before it reaches the towers. Click to burst flak in its path.'],
  missileArc: ['DEVIL SKIFFS ON THE HORIZON', 'Their shells arc in from the sides. Click to burst flak in their path.'],
  snake: ['THE BUOY CABLE HAS SNAPPED', `Splice it: steer with the arrow keys (or WASD) and collect ${GA.SN.need} loose ends before they sink. Do not touch the cable or the stray sparks; the walls wrap round.`],
  stoke: ['THE STOKEHOLD FIRES ARE FAILING', 'Keep all four fires in the green. ↑ ↓ (or W S) changes deck, SPACE flings coal. A fire that dies or bursts is a fail; three and the stokehold is lost.'],
  depth: ['ENEMY SUBMARINES BELOW', 'Your destroyer runs the surface. ← → (or A D) steers, SPACE drops a depth charge. Dodge their torpedoes and do not let them surface. Lose, and your own ship takes a hit.'],
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
  ({ missile: startMissile, snake: startSnake, stoke: startStoke, depth: startDepth })[a.kind](current);
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
  const sparks = GA.sparksStart(g.rng, body);
  let foodAge = 0;
  const fail = text => { dead = true; audio.sfx.spark(); finishDefence(false, {}, text); };
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
      GA.sparksStep(sparks, dt);
      foodAge += dt;
      if (foodAge > GA.SN.sink) { food = GA.snakeFood(g.rng, body); foodAge = 0; audio.sfx.puff(); }   // the loose end sank; another floats up
      if (GA.sparkHits(sparks, body[0]) && !g.done) fail('A STRAY SPARK HIT THE SPLICE · THE BUOY IS LOST');
      while (acc >= GA.SN.step && !dead && !g.done) {
        acc -= GA.SN.step;
        if (queued.length) dir = queued.shift();
        const r = GA.snakeMove(body, dir, food);
        body = r.body;
        if (r.dead) { fail('THE SPLICE FAILED · THE BUOY IS LOST'); break; }
        if (GA.sparkHits(sparks, body[0])) { fail('A STRAY SPARK HIT THE SPLICE · THE BUOY IS LOST'); break; }
        if (r.ate) { got++; audio.sfx.click(); if (got >= GA.SN.need) { finishDefence(true, {}, 'THE CABLE IS SPLICED'); break; } food = GA.snakeFood(g.rng, body); foodAge = 0; }
      }
    }
    // draw: the sea floor, the cable, the loose end
    ctx.fillStyle = '#06131a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(92,255,157,.06)';
    for (let x = 0; x <= GA.SN.W; x++) { ctx.beginPath(); ctx.moveTo(x * S, 0); ctx.lineTo(x * S, H); ctx.stroke(); }
    for (let y = 0; y <= GA.SN.H; y++) { ctx.beginPath(); ctx.moveTo(0, y * S); ctx.lineTo(W, y * S); ctx.stroke(); }
    // the loose end, shrinking and dimming as it sinks, with a ring that runs out
    const left = Math.max(0, 1 - foodAge / GA.SN.sink), fx = food[0] * S + S / 2, fy = food[1] * S + S / 2;
    ctx.fillStyle = `rgba(255,179,71,${0.35 + 0.65 * left})`; ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(fx, fy, S * (0.18 + 0.14 * left), 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = left < 0.35 ? '#ff6a4a' : 'rgba(255,207,122,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(fx, fy, S * 0.46, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
    // the stray sparks: crackling blue-white, with the square they are in faintly marked
    for (const sp of sparks) {
      const [cx, cy] = GA.sparkCell(sp); ctx.fillStyle = 'rgba(120,200,255,.10)'; ctx.fillRect(cx * S, cy * S, S, S);
      const px = sp.x * S + S / 2, py = sp.y * S + S / 2, t = nowT / 1000;
      ctx.strokeStyle = '#bfe8ff'; ctx.shadowColor = '#6fc8ff'; ctx.shadowBlur = 14; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + t * 7, r = S * (0.22 + 0.16 * Math.abs(Math.sin(t * 23 + k * 2.1))); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); }
      ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px, py, S * 0.12, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.lineWidth = 1;
    }
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

// ---------- The stokehold (Engineering): Tapper. Four decks, four fires, one stoker ----------
function startStoke(g) {
  const W = 960, H = 540, FLOOR = [96, 202, 311, 419], STOKER_X = 30, BOX_R = 948, BOX_H = 80, DOOR = 0.12;
  $('dbody').innerHTML = `<canvas width="${W}" height="${H}" tabindex="0"></canvas><p class="hint" style="text-align:center">↑ ↓ or W S to change deck · SPACE to fling coal. Click the stokehold first if the keys do nothing.</p>`;
  const cv = $('dbody').querySelector('canvas'), ctx = cv.getContext('2d'), art = stokeArt();
  const st = GA.stokeStart(g.rng), fx = [];
  let pos = 1, last = null, thrownAt = -9, shake = 0, ended = false;
  const now = () => (performance.now() - g.t0) / 1000;
  const onKey = e => {
    if (g.done) return;
    if (['ArrowUp', 'w', 'W'].includes(e.key)) { pos = Math.max(0, pos - 1); e.preventDefault(); }
    else if (['ArrowDown', 's', 'S'].includes(e.key)) { pos = Math.min(GA.ST.lanes - 1, pos + 1); e.preventDefault(); }
    else if (e.key === ' ') { e.preventDefault(); if (!e.repeat && GA.stokeThrow(st, pos)) { thrownAt = st.t; audio.sfx.stoke(); } }
  };
  addEventListener('keydown', onKey);
  cv.onclick = () => cv.focus();
  setTimeout(() => cv.focus({ preventScroll: true }), 50);
  g.cleanup = () => removeEventListener('keydown', onKey);
  const end = () => {
    if (ended) return; ended = true;
    const ok = st.fails < GA.ST.fails;
    finishDefence(ok, {}, ok ? 'THE STOKEHOLD HELD' : 'THE STOKEHOLD FIRES FAILED · THE CHUTE IS EMPTY');
  };
  g.timeout = end;
  // drawing helpers: a sprite by its height, anchored bottom-left; a placeholder until the art arrives
  const put = (name, x, yBottom, h, alpha = 1) => {
    const im = art[name]; if (!im) return 0;
    const w = h * im.width / im.height; ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(im, x, yBottom - h, w, h); ctx.restore(); return w;
  };
  const boxW = () => art['box-good'] ? BOX_H * art['box-good'].width / art['box-good'].height : 92;
  g.tick = () => {
    // the fires follow the real clock in small steps, however seldom the screen is drawn
    const t = now(), dt = last == null ? 0 : Math.min(0.1, t - last); last = t;
    while (!ended && st.t < t - 0.05) for (const e of GA.stokeStep(st, 0.05, g.rng)) {
      if (e.type === 'out') { audio.sfx.puff(); fx.push({ kind: 'smoke', lane: e.lane, at: t }); shake = 0.35; }
      if (e.type === 'burst') { audio.sfx.vent(); audio.sfx.blowout(); fx.push({ kind: 'steam', lane: e.lane, at: t }); shake = 0.5; }
      if (st.fails >= GA.ST.fails) { end(); break; }
    }
    shake = Math.max(0, shake - dt);
    ctx.save();
    if (shake) ctx.translate((Math.random() - 0.5) * 10 * shake, (Math.random() - 0.5) * 8 * shake);
    if (art.backdrop) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(art.backdrop, 0, 0, W, H); } else { ctx.fillStyle = '#16120c'; ctx.fillRect(0, 0, W, H); }
    const bw = boxW(), bx = BOX_R - bw, door = bx + bw * DOOR;
    st.lanes.forEach((l, i) => {
      const fy = FLOOR[i], state = GA.stokeState(l), danger = state === 'dying' || state === 'roaring', blink = danger && Math.floor(t * 4) % 2 === 0;
      if (i === pos) { ctx.fillStyle = 'rgba(255,190,90,.16)'; ctx.fillRect(0, fy - 92, W, 92); }
      // the heat gauge beside the fire: the green band, the needle
      const gx = bx - 22, gh = 66, gy = fy - 8 - gh, hy = v => gy + gh - Math.max(0, Math.min(GA.ST.top, v)) / GA.ST.top * gh;
      ctx.fillStyle = 'rgba(10,8,6,.85)'; ctx.fillRect(gx - 2, gy - 2, 14, gh + 4);
      ctx.fillStyle = '#7a1d14'; ctx.fillRect(gx, gy, 10, gh);
      ctx.fillStyle = '#2f7a3a'; ctx.fillRect(gx, hy(GA.ST.high), 10, hy(GA.ST.low) - hy(GA.ST.high));
      ctx.fillStyle = blink ? '#ffffff' : '#ffd36a'; ctx.fillRect(gx - 4, hy(l.heat) - 2, 18, 4);
      // the fire, with a pulse round it when it is in danger
      if (danger) { ctx.save(); ctx.shadowColor = state === 'dying' ? '#6fb3ff' : '#ff3b1f'; ctx.shadowBlur = blink ? 28 : 10; }
      if (!put('box-' + state, bx, fy, BOX_H)) { ctx.fillStyle = { out: '#333', dying: '#5a2a1a', good: '#c8641e', roaring: '#ffd060', burst: '#fff' }[state]; ctx.fillRect(bx, fy - BOX_H, bw, BOX_H); }
      if (danger) ctx.restore();
      if (blink) { ctx.fillStyle = state === 'dying' ? '#9fd0ff' : '#ff8a6a'; ctx.font = '600 13px IBM Plex Mono'; ctx.textAlign = 'right'; ctx.fillText(state === 'dying' ? 'DYING' : 'TOO HOT', gx - 8, fy - 40); }
    });
    // coal in flight: slides down the deck and drops in at the door
    for (const c of st.coal) {
      const p = Math.min(1, (st.t - c.at) / GA.ST.travel), x = STOKER_X + 90 + (door - STOKER_X - 100) * p, y = FLOOR[c.lane] - 34 - Math.sin(p * Math.PI) * 16;
      if (!put('coal', x - 14, y + 14, 26)) { ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill(); }
    }
    // the stoker, mid-throw for a moment after each shovel
    const throwing = st.t - thrownAt < 0.18;
    if (!put(throwing ? 'stoker-throw' : 'stoker-ready', STOKER_X, FLOOR[pos], 88) && !put('stoker-throw', STOKER_X, FLOOR[pos], 88)) { ctx.fillStyle = '#2f5e33'; ctx.fillRect(STOKER_X, FLOOR[pos] - 88, 40, 88); }
    // smoke from a dead fire, steam from a burst one
    for (const f of fx) {
      const age = t - f.at; if (age > 1.4) continue;
      put(f.kind, bx + bw * 0.25 - age * 10, FLOOR[f.lane] - 30 - age * 40, 70 + age * 30, Math.max(0, 1 - age / 1.4));
    }
    // three gauges for the three fails, at the foot of the stokehold
    for (let k = 0; k < GA.ST.fails; k++) {
      const x = 18 + k * 50, y = H - 12, broken = k < st.fails;
      if (!put('gauge', x, y, 42, broken ? 0.55 : 1)) { ctx.fillStyle = '#b08d57'; ctx.beginPath(); ctx.arc(x + 21, y - 21, 20, 0, 7); ctx.fill(); }
      if (broken) { ctx.strokeStyle = '#ff3b1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 9, y - 33); ctx.lineTo(x + 21, y - 21); ctx.lineTo(x + 15, y - 12); ctx.moveTo(x + 21, y - 21); ctx.lineTo(x + 34, y - 26); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(10,8,6,.7)'; ctx.fillRect(170, H - 44, 250, 32); ctx.fillStyle = '#ffd36a'; ctx.font = '600 14px IBM Plex Mono'; ctx.textAlign = 'left';
    ctx.fillText(`FAILS ${st.fails} OF ${GA.ST.fails}`, 182, H - 23);
    ctx.restore();
  };
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
      for (const x of [60, 140, W - 140, W - 60]) { if(sprite(ctx,'skiff',x-36,HORIZON-49,72,58,[70,150,1160,920]))continue; ctx.fillStyle = '#2a1010'; ctx.beginPath(); ctx.moveTo(x - 30, HORIZON); ctx.lineTo(x + 30, HORIZON); ctx.lineTo(x + 20, HORIZON + 10); ctx.lineTo(x - 20, HORIZON + 10); ctx.fill(); ctx.fillRect(x - 2, HORIZON - 26, 4, 26); ctx.fillStyle = '#7a2a1a'; ctx.beginPath(); ctx.moveTo(x + 2, HORIZON - 24); ctx.lineTo(x + 18, HORIZON - 14); ctx.lineTo(x + 2, HORIZON - 8); ctx.fill(); }
    }
    ctx.fillStyle = '#1a1410'; ctx.fillRect(0, GROUND, W, H - GROUND);
    for (const tw of towers) {
      const dead = tw.down || tw.hit;
      ctx.save();if(dead)ctx.globalAlpha=.35;const painted=sprite(ctx,'tower',tw.x-21,GROUND-76,42,76,[350,125,570,1000]);ctx.restore();if(!painted){ctx.fillStyle = dead ? '#3a1410' : '#5a6470'; ctx.fillRect(tw.x - 14, GROUND - 34, 28, 34);}
      ctx.fillStyle = dead ? '#5a1a12' : '#7fd8ff'; ctx.beginPath(); ctx.arc(tw.x, GROUND - (painted?65:42), painted?5:10, 0, 7); ctx.fill();
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

// ---------- Depth charges (the Fleet Officer): Space Invaders, upside down ----------
// Placeholder art (shapes); sprites named depth-destroyer, depth-sub, depth-whale are used if they ever load.
function startDepth(g) {
  const W = GA.DC.W, H = GA.DC.H, S = 2;
  $('dbody').innerHTML = `<canvas width="${W * S}" height="${H * S}" tabindex="0"></canvas><p class="hint" style="text-align:center">← → or A D to steer · SPACE drops a charge (three in the water at most). Click the board first if the keys do nothing.</p>`;
  const cv = $('dbody').querySelector('canvas'), ctx = cv.getContext('2d'); cv.focus();
  const st = GA.depthStart(g.rng), keys = {}, booms = [];
  const onKey = e => {
    const k = e.key; if (g.done) return;
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', ' '].includes(k)) e.preventDefault();
    if (e.type === 'keydown' && k === ' ') { if (GA.depthDrop(st)) audio.sfx.click(); return; }
    keys[k.toLowerCase()] = e.type === 'keydown';
  };
  addEventListener('keydown', onKey); addEventListener('keyup', onKey);
  g.cleanup = () => { removeEventListener('keydown', onKey); removeEventListener('keyup', onKey); };
  let last = performance.now();
  const finish = (ok, why) => finishDefence(ok, {}, ok ? 'THE SUBMARINES ARE BEATEN OFF' : why === 'surfaced' ? 'THEY SURFACED · YOUR SHIP IS HIT' : 'THE DESTROYER IS CRIPPLED · YOUR SHIP IS HIT');
  g.timeout = () => { if (!g.done) finish(!st.over || st.won); };
  g.tick = () => {
    const now = performance.now(); let dt = Math.min(0.1, (now - last) / 1000); last = now;
    const move = (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
    while (dt > 0 && !st.over) { const h = Math.min(0.05, dt); dt -= h;
      for (const e of GA.depthStep(st, h, move, g.rng)) {
        if (e.type === 'kill') { booms.push({ x: e.x, y: e.y, t: st.t }); audio.sfx.blowout(); }
        if (e.type === 'hit') audio.sfx.spark();
        if (e.type === 'won') finish(true); if (e.type === 'surfaced') st.why = 'surfaced'; if (e.type === 'lost') finish(false, st.why);
      } }
    ctx.save(); ctx.scale(S, S);
    // the sea: lighter at the surface, black in the deep
    const sea = ctx.createLinearGradient(0, 0, 0, H); sea.addColorStop(0, '#2a4a5a'); sea.addColorStop(0.16, '#123040'); sea.addColorStop(1, '#02080c');
    ctx.fillStyle = '#0a0f14'; ctx.fillRect(0, 0, W, GA.DC.surface - 8); ctx.fillStyle = sea; ctx.fillRect(0, GA.DC.surface - 8, W, H);
    ctx.strokeStyle = 'rgba(160,220,255,.5)'; ctx.beginPath(); for (let x = 0; x <= W; x += 8) ctx.lineTo(x, GA.DC.surface - 8 + Math.sin(x / 14 + st.t * 3) * 2); ctx.stroke();
    // the destroyer
    const hx = st.x, hy = GA.DC.shipY, flash = st.hitFlash > 0 && Math.floor(st.t * 20) % 2;
    if (!sprite(ctx, 'depth-destroyer', hx - 30, hy - 16, 60, 26)) {
      ctx.fillStyle = flash ? '#ff8a7a' : '#7d8a96'; ctx.beginPath(); ctx.moveTo(hx - 28, hy); ctx.lineTo(hx + 28, hy); ctx.lineTo(hx + 22, hy + 9); ctx.lineTo(hx - 24, hy + 9); ctx.fill();
      ctx.fillStyle = flash ? '#ffb3a8' : '#a5b2bd'; ctx.fillRect(hx - 10, hy - 9, 18, 9); ctx.fillRect(hx - 2, hy - 16, 4, 8);
    }
    // charges, foes, their fire
    for (const c of st.charges) { ctx.fillStyle = '#e8cf98'; ctx.fillRect(c.x - 4, c.y - 5, 8, 10); ctx.fillStyle = '#5a4630'; ctx.fillRect(c.x - 4, c.y - 1, 8, 2); }
    for (const f of st.foes) {
      if (!f.alive) continue; const [w, h] = GA.depthSize(f);
      if (sprite(ctx, f.kind === 'whale' ? 'depth-whale' : 'depth-sub', f.x - w / 2, f.y - h / 2, w, h)) continue;
      if (f.kind === 'whale') { const glow = 0.5 + 0.5 * Math.sin(st.t * 4 + f.x); ctx.fillStyle = '#4a3a6a'; ctx.beginPath(); ctx.ellipse(f.x, f.y, w / 2, h / 2, 0, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(f.x + w / 2 - 4, f.y); ctx.lineTo(f.x + w / 2 + 8, f.y - 7); ctx.lineTo(f.x + w / 2 + 8, f.y + 7); ctx.fill(); ctx.fillStyle = `rgba(200,140,255,${glow})`; ctx.beginPath(); ctx.arc(f.x - w / 4, f.y - 2, 3, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = '#5a1e18'; ctx.beginPath(); ctx.ellipse(f.x, f.y, w / 2, h / 2, 0, 0, 7); ctx.fill(); ctx.fillRect(f.x - 4, f.y - h / 2 - 6, 8, 6); ctx.fillStyle = '#ff8a5a'; ctx.fillRect(f.x - 1, f.y - h / 2 - 9, 2, 3); }
    }
    for (const s of st.shots) {
      if (s.kind === 'pulse') { ctx.strokeStyle = 'rgba(200,140,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, 7 + Math.sin(st.t * 12) * 2, 0, 7); ctx.stroke(); ctx.lineWidth = 1; }
      else { ctx.fillStyle = '#ffd36a'; ctx.fillRect(s.x - 1.5, s.y - 7, 3, 12); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(s.x - 1, s.y + 5, 2, 10); }
    }
    for (const b of booms) { const a = st.t - b.t; if (a < 0.6) { ctx.fillStyle = `rgba(200,240,255,${0.7 - a})`; ctx.beginPath(); ctx.arc(b.x, b.y, 8 + a * 50, 0, 7); ctx.fill(); } }
    ctx.fillStyle = 'rgba(10,8,6,.75)'; ctx.fillRect(6, H - 24, 200, 18); ctx.fillStyle = '#ffd36a'; ctx.font = '600 11px IBM Plex Mono'; ctx.textAlign = 'left';
    ctx.fillText(`HULL ${'■'.repeat(Math.max(0, st.lives))}${'□'.repeat(GA.DC.lives - Math.max(0, st.lives))}  ·  ${st.foes.filter(f => f.alive).length} BELOW`, 12, H - 11);
    ctx.restore();
  };
}

// ---------- start ----------
requestAnimationFrame(frame);
if (role && code) takeStation();
