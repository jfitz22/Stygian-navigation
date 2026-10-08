import {
  createWorld, newSeed, step, light, stoke, slotsAvailable, setPower, isUp, selectCam, deployBuoy, ping, lockContact, lockFromCamera,
  ghostAt, lockedBerg, alignment, pressKey, setFreq, setGain, setMusic, radioSignal, fireBeacon, readingDisplay,
  startRepair, badRepair, gm, cameraView, snowAt, stormsAt, dist, snapshot, SYSTEMS, DT,
  saveWorld, loadWorld, pressBoard, runeFunction, sip, setColor, aimQuality, brokenList, BREAKABLE, scannerReach, inShoal, setLever, pressPlate, setCamTurn, camIsUnlocked, camWeather, setVerdict, relockCase,
  setDamper, setPriority, furnaceState, sonarStrain, repairWorking, stationAction, ROLES, stationSnapshot,
} from './sim.js';
import { MAP, CENTER, OBSERVATORY, REACH, ISLAND_R, GRID, CELL, TOMB_RADIUS, TUNING as T, BOARD_PAGES, SHOALS, SIZE_CUT } from './scenario.js';
import { glyphSVG, echoAt, ECHO_W } from './glyphs.js';
import { makeRepairBoard, repairAction, ownerOf, DEPTS } from './repair.js';
import { drawFurnaceLog, furnaceNumbers, N_COLOR } from './furnacelog.js';
import { mountFleet } from './fleetui.js';
import * as audio from './audio.js';
import { openLink, newRoomCode, cleanCode, NET_ENABLED } from './link.js';
import { checkPassword, keyboardOnly, WRONG_TRIES } from './password.js';
import { sealInput, shuttered } from './sim.js';
import { succubus } from './succubus.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const world = createWorld(Number(params.get('seed')) || newSeed(), { deploy: true });

const HOME = () => ({ cx: CENTER.x, cy: CENTER.y, z: Math.min(744, 708) / MAP * 0.97 });
const ui = {
  view: HOME(),
  selected: null,          // selected sonar contact id
  color: 'red',
  buoyMode: false,
  wipeUntil: 0,
  coffee: 0, brewing: false,
  camHits: [],
  repair: {},              // system id -> repair board
  zoom: {},                // camera id -> true while zoomed in
  repairSel: null,
  noteCorner: 0,
  tickerQ: [],             // GM messages waiting for the wire service
  log: [],                 // recent toasts, newest last
  logOpen: false,
  hover: null,             // mouse position over the chart
  notesGone: [],           // Jerry's notes the crew has thrown away
  started: false,
};
const fmt = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const ago = s => fmt(s) + ' ago';
const COLORS = { red: '#ff4b3a', orange: '#ffb347', green: '#5cff9d' };
const COLOR_LABEL = { red: 'RED<br><small>PLAIN</small>', orange: 'ORANGE<br><small>SOUNDING</small>', blue: 'BLUE<br><small>DRIFT LOG</small>', green: 'THIS IS<br>ELGARZ' };
const STOCK = { red: 'stock', orange: 'orange', green: 'green' };
const REVEAL = '#7fd8ff';
const COLS = 'ABCDEFGHIJKL';
const gridRef = (x, y) => COLS[Math.max(0, Math.min(GRID - 1, Math.floor(x / CELL)))] + (Math.max(0, Math.min(GRID - 1, Math.floor(y / CELL))) + 1);
$('watchno').innerHTML = 'WATCH<br>No. ' + world.seed;
$('introseed').textContent = 'Watch No. ' + world.seed;

// ---------- stage scaling ----------
function fit() {
  const s = Math.min(innerWidth / 1920, innerHeight / 1080);
  $('stage').style.transform = `scale(${s})`;
}
addEventListener('resize', fit); fit();
function canvasPoint(cv, e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
}

// ---------- toasts & notes ----------
let toastTimer = null;
// A toast that also goes on the wire service ticker, so the result is seen on the stream.
function wire(msg, kind = '') { toast(msg, kind); ui.tickerQ.push(msg); }
function toast(msg, kind = '') {
  ui.log.push({ t: world.t, msg, kind }); if (ui.log.length > 40) ui.log.shift(); if (ui.logOpen) drawLog();
  const t = $('toast'); t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = kind, 3600);
}
function drawLog() {
  const rows = ui.log.slice(-10).reverse();
  $('logdrawer').innerHTML = rows.length ? rows.map(r => `<div class="row ${r.kind}"><b>${fmt(r.t)}</b>${r.msg.replace(/</g, '&lt;')}</div>`).join('') : '<div class="empty">Nothing yet.</div>';
}
$('btn-log').onclick = () => { ui.logOpen = !ui.logOpen; $('logdrawer').classList.toggle('hidden', !ui.logOpen); $('btn-log').classList.toggle('on', ui.logOpen); if (ui.logOpen) drawLog(); };
// Pneumatic-tube notes land in the four corners of the chart in turn.
function note(text) {
  const k = ui.noteCorner++ % 4, box = $('notes');
  const old = box.querySelector('.c' + k); if (old) old.remove();
  const n = document.createElement('div'); n.className = 'note c' + k; n.textContent = text;
  n.onclick = () => n.remove();
  box.appendChild(n); audio.sfx.buoy();
}
// Look up (the overhead deck), down (the main board) or left (the cabin).
function look(where) {
  if (where === true) where = 'up'; if (where === false) where = 'main';
  $('stage').classList.toggle('up', where === 'up'); $('stage').classList.toggle('left', where === 'left'); audio.sfx.clunk();
}
const lookingLeft = () => $('stage').classList.contains('left');
$('lookup').onclick = () => look('up');
$('gofire').onclick = () => look('up');
$('lookdown').onclick = () => look('main');
$('lookleft').onclick = () => look('left');
$('lookback').onclick = () => look('main');
$('godeploy').onclick = () => look('left');
const togglePause = () => gm(world, 'pause');
$('pausebtn').onclick = togglePause;
$('resume').onclick = () => { if (world.paused) togglePause(); };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowUp') look('up');
  if (e.key === 'ArrowDown') look('main');
  if (e.key === 'l' || e.key === 'L') look(lookingLeft() ? 'main' : 'left');
  if (e.key === 'p' || e.key === 'P') togglePause();
  if (!ui.started || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ') { e.preventDefault(); document.activeElement && document.activeElement.blur(); ping(world); }
  if (e.key >= '1' && e.key <= '7') { const c = world.cams[+e.key - 1]; if (c) { selectCam(world, c.id); audio.sfx.click(); } }
});

// ---------- intro / sound ----------
const SAVE_KEY = 'lastwatch-save:' + location.pathname;
function readSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.v === 10 && s.w ? s : null; } catch (e) { return null; } }
function writeSave() {
  if (!ui.started) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 10, seed: world.seed, t: world.t, w: saveWorld(world), log: ui.log, notesGone: ui.notesGone })); } catch (e) { /* storage full or blocked: carry on unsaved */ }
}
function takeWatch() { audio.unlock(); $('intro').classList.add('hidden'); audio.sfx.click(); ui.started = true; writeSave(); }
const saved = readSave(), seedParam = Number(params.get('seed'));
if (saved && (!seedParam || seedParam === saved.seed)) {
  $('resumewatch').classList.remove('hidden');
  $('resumewatch').textContent = `RESUME WATCH No. ${saved.seed} (${fmt(saved.t)})`;
  $('begin').textContent = 'NEW WATCH';
  $('resumewatch').onclick = () => {
    const w = loadWorld(saved.w);
    for (const k of Object.keys(world)) delete world[k];
    Object.assign(world, w);
    ui.log = saved.log || []; ui.notesGone = saved.notesGone || [];
    document.querySelectorAll('#jnotes .jnote').forEach(n => { if (ui.notesGone.includes(n.dataset.k)) n.remove(); });
    $('watchno').innerHTML = 'WATCH<br>No. ' + world.seed;
    takeWatch();
    audio.setHum(world.furnace.lit ? 1 : 0); audio.setMusic(world.music);
    toast('WATCH RESUMED', 'info');
  };
}
$('begin').onclick = () => {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  takeWatch();
};
setInterval(writeSave, 5000);
addEventListener('pagehide', writeSave);
function toggleMute() { audio.setMuted(!audio.isMuted()); $('mute').textContent = audio.isMuted() ? 'SOUND OFF' : 'SOUND ON'; }
$('mute').onclick = toggleMute;
addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M') && e.target.tagName !== 'INPUT') toggleMute(); });

// ---------- furnace & power ----------
$('ignite').onclick = () => light(world);
$('mug').onclick = () => sip(world);
$('stoke').onclick = () => stoke(world);
const SYS_LABEL = { cameras: 'ORBS', sonar: 'SONAR', radio: 'RADIO', scanner: 'SCANNER', currents: 'CURRENTS', repair: 'REPAIR', workshop: 'WORKSHOP' };
for (const s of SYSTEMS) {
  const d = document.createElement('div'); d.className = 'sw'; d.id = 'sw-' + s;
  d.innerHTML = `<div class="lamp"></div><div class="slot"><div class="knob"></div></div><div>${SYS_LABEL[s]}</div>`;
  d.querySelector('.slot').onclick = () => { setPower(world, s, !world.power[s].on); };
  $('switches').appendChild(d);
}

// ---------- cameras ----------
for (const c of world.cams) {
  const b = document.createElement('button'); b.className = 'camb'; b.id = 'cb-' + c.id;
  b.innerHTML = `${c.name}<div class="heat"><div></div></div><div class="trem">STILL</div>`;
  b.onclick = () => { selectCam(world, c.id); audio.sfx.click(); };
  $('camsel').appendChild(b);
}
$('camcanvas').addEventListener('click', e => {
  const p = canvasPoint($('camcanvas'), e);
  const hit = [...ui.camHits].reverse().find(h => p.x >= h.x0 && p.x <= h.x1 && p.y >= h.y0 && p.y <= h.y1);
  if (hit) lockFromCamera(world, hit.id);
});

// ---------- repair bay ----------
// Every machine shows the same kind of board; its owner's book has the flowchart that reads it.
let repairKey = '';
function drawRepairBay() {
  const list = brokenList(world);
  $('repaircount').textContent = list.length ? list.length + ' broken' : 'all sound';
  if (!list.find(x => x.id === ui.repairSel)) ui.repairSel = list.length ? list[0].id : null;
  const key = list.map(x => x.id + (world.repairs[x.id] ? '*' : '')).join(',') + '|' + ui.repairSel;
  if (key !== repairKey) {
    repairKey = key;
    $('repairtabs').innerHTML = '';
    for (const x of list) {
      const b = document.createElement('button'); b.textContent = x.name;
      b.className = (x.id === ui.repairSel ? 'sel ' : '') + (world.repairs[x.id] ? 'busy' : '');
      b.onclick = () => { ui.repairSel = x.id; audio.sfx.click(); };
      $('repairtabs').appendChild(b);
    }
    $('repairboard').dataset.ver = '';
  }
  const el = $('repairboard');
  if (!ui.repairSel) { if (el.dataset.ver !== 'none') { el.dataset.ver = 'none'; el.innerHTML = '<div class="rb-sub" style="margin-top:20px">Nothing is broken. Long may it last.</div>'; } return; }
  const item = list.find(x => x.id === ui.repairSel);
  if (world.repairs[item.id]) {
    const working = repairWorking(world, item.id), ver = 'busy' + working + Math.ceil(world.repairs[item.id] - world.t);
    if (el.dataset.ver === ver) return;
    el.dataset.ver = ver;
    el.innerHTML = working
      ? `<div class="rb-title">REPAIR CREW AT WORK</div><div class="rb-sub">${item.name} back in service in ${Math.ceil(world.repairs[item.id] - world.t)}s</div>`
      : `<div class="rb-title">REPAIR CREW WAITING</div><div class="rb-sub">The repair bay has no power. Switch REPAIR on at the furnace and they carry on.</div>`;
    return;
  }
  let b = ui.repair[item.id]; if (!b) { b = ui.repair[item.id] = makeRepairBoard(ownerOf(item.id)); b.lockUntil = 0; }
  const ver = item.id + ':' + (b.ver || 0);
  if (el.dataset.ver === ver) return;
  el.dataset.ver = ver;
  el.innerHTML = `<div class="rb-title">${item.name}: BROKEN <span class="rb-dept">${DEPTS[b.dept]} FLOWCHART</span></div>
    <div class="rb-sub">Set every conduit, then send the crew. ${item.id === 'furnace' ? 'The grate is mended by hand: no power needed.' : 'The crew needs the REPAIR switch on.'}</div>
    <div class="rb-rows">${b.rows.map((r, i) => `
      <div class="rb-row r11"><b>${i + 1}</b>
        <span class="rlights">${r.lights.map(l => `<span class="rlamp ${l}"></span>`).join('')}</span>
        <span class="rgauge"><b>${String(r.gauge).padStart(2, '0')}</b><i><em style="width:${r.gauge}%"></em></i></span>
        <span class="rcode">${r.code}</span>
        <div class="act">${['OPEN', 'CLOSE', 'CUT'].map(a => `<button data-i="${i}" data-a="${a}" class="${r.set === a ? 'sel' : ''}">${a}</button>`).join('')}</div>
      </div>`).join('')}</div>
    <button class="rb-go">SEND THE REPAIR CREW</button>`;
  el.querySelectorAll('.act button').forEach(btn => btn.onclick = () => { b.rows[+btn.dataset.i].set = btn.dataset.a; b.ver = (b.ver || 0) + 1; audio.sfx.click(); });
  el.querySelector('.rb-go').onclick = () => {
    if (world.t < b.lockUntil) return;
    const wrong = b.rows.filter(r => r.set !== repairAction(b.dept, r));
    if (!wrong.length) { if (startRepair(world, item.id)) { delete ui.repair[item.id]; el.dataset.ver = ''; } }
    else { wrong.forEach(r => r.set = null); b.lockUntil = world.t + 4; b.ver = (b.ver || 0) + 1; badRepair(world); toast(`SPARKS! ${wrong.length} CONDUIT${wrong.length > 1 ? 'S' : ''} WRONG. THEY HAVE RESET.`); }
  };
}

// ---------- map ----------
const mapCv = $('mapcanvas'), mctx = mapCv.getContext('2d');
const W2S = (x, y) => ({ x: (x - ui.view.cx) * ui.view.z + mapCv.width / 2, y: (y - ui.view.cy) * ui.view.z + mapCv.height / 2 });
const S2W = (x, y) => ({ x: (x - mapCv.width / 2) / ui.view.z + ui.view.cx, y: (y - mapCv.height / 2) / ui.view.z + ui.view.cy });
let drag = null;
mapCv.addEventListener('mousedown', e => { const p = canvasPoint(mapCv, e); drag = { x: p.x, y: p.y, cx: ui.view.cx, cy: ui.view.cy, moved: false }; });
mapCv.addEventListener('mousemove', e => { ui.hover = drag && drag.moved ? null : canvasPoint(mapCv, e); });
mapCv.addEventListener('mouseleave', () => { ui.hover = null; });
addEventListener('mousemove', e => {
  if (!drag) return; const p = canvasPoint(mapCv, e);
  if (Math.hypot(p.x - drag.x, p.y - drag.y) > 4) drag.moved = true;
  if (drag.moved) { ui.view.cx = drag.cx - (p.x - drag.x) / ui.view.z; ui.view.cy = drag.cy - (p.y - drag.y) / ui.view.z; }
});
addEventListener('mouseup', e => {
  if (!drag) return; const d = drag; drag = null;
  if (d.moved) return;
  const p = canvasPoint(mapCv, e), wp = S2W(p.x, p.y);
  if (ui.buoyMode) { if (deployBuoy(world, wp.x, wp.y)) ui.buoyMode = false; return; }
  const c = nearestContact(wp, 18 / ui.view.z);
  if (c) selectContact(c);
});
mapCv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(canvasPoint(mapCv, e), e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
function zoomAt(p, k) {
  const before = S2W(p.x, p.y);
  ui.view.z = Math.min(1.6, Math.max(HOME().z * 0.9, ui.view.z * k));
  const after = S2W(p.x, p.y);
  ui.view.cx += before.x - after.x; ui.view.cy += before.y - after.y;
}
$('btn-zin').onclick = () => zoomAt({ x: mapCv.width / 2, y: mapCv.height / 2 }, 1.3);
$('btn-zout').onclick = () => zoomAt({ x: mapCv.width / 2, y: mapCv.height / 2 }, 1 / 1.3);
$('btn-home').onclick = () => { ui.view = HOME(); };
$('btn-buoy').onclick = () => { ui.buoyMode = !ui.buoyMode; audio.sfx.click(); };

function nearestContact(p, maxD) {
  let best = null, bd = maxD;
  for (const c of world.contacts) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
  return best;
}
function selectContact(c) { ui.selected = c.id; lockContact(world, c); }

function drawMap() {
  const ctx = mctx, Wd = mapCv.width, Ht = mapCv.height, z = ui.view.z, t = world.t;
  ctx.fillStyle = '#0a1418'; ctx.fillRect(0, 0, Wd, Ht);
  const m0 = W2S(0, 0), m1 = W2S(MAP, MAP), c0 = W2S(CENTER.x, CENTER.y);
  const g = ctx.createRadialGradient(c0.x, c0.y, 0, c0.x, c0.y, REACH * z);
  g.addColorStop(0, '#16303a'); g.addColorStop(1, '#0f2229');
  ctx.fillStyle = g; ctx.fillRect(m0.x, m0.y, m1.x - m0.x, m1.y - m0.y);
  // out-of-reach corners
  ctx.save(); ctx.beginPath(); ctx.rect(m0.x, m0.y, m1.x - m0.x, m1.y - m0.y); ctx.arc(c0.x, c0.y, REACH * z, 0, Math.PI * 2, true); ctx.clip('evenodd');
  ctx.fillStyle = 'rgba(5,9,11,.75)'; ctx.fillRect(m0.x, m0.y, m1.x - m0.x, m1.y - m0.y);
  ctx.strokeStyle = 'rgba(176,141,87,.08)';
  for (let k = -MAP; k < MAP * 2; k += 120) { const a = W2S(k, 0), b = W2S(k + MAP, MAP); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  ctx.restore();
  // grid
  ctx.strokeStyle = 'rgba(160,200,200,.09)'; ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    const a = W2S(i * CELL, 0), b = W2S(i * CELL, MAP); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const c = W2S(0, i * CELL), d = W2S(MAP, i * CELL); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(176,141,87,.4)'; ctx.strokeRect(m0.x, m0.y, m1.x - m0.x, m1.y - m0.y);
  ctx.setLineDash([2, 5]); ctx.strokeStyle = 'rgba(232,207,152,.35)'; ctx.beginPath(); ctx.arc(c0.x, c0.y, REACH * z, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  // storms
  for (const s of stormsAt(world, t)) {
    const c = W2S(s.x, s.y), r = s.r * z;
    const sg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    sg.addColorStop(0, `rgba(200,210,225,${0.3 * s.strength})`); sg.addColorStop(1, 'rgba(200,210,225,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(220,230,240,${0.25 * s.strength})`;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(c.x, c.y, r * (0.3 + k * 0.2), t * 0.3 + k * 2, t * 0.3 + k * 2 + 2.2); ctx.stroke(); }
    ctx.fillStyle = `rgba(230,235,245,${0.6 * s.strength})`; ctx.font = '11px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('STORM', c.x, c.y + 4);
  }
  // launcher range (only while dropping a buoy)
  if (ui.buoyMode) {
    ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(255,179,71,.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c0.x, c0.y, T.buoyDeployRange * z, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,179,71,.9)'; ctx.font = '12px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('CLICK INSIDE THE DASHED LINE TO DROP A BUOY', Wd / 2, 46);
  }
  // shoals: rocks that scatter the sonar
  for (const s of SHOALS) {
    const c = W2S(s.x, s.y), r = s.r * z;
    ctx.save(); ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.clip();
    ctx.fillStyle = 'rgba(70,58,44,.35)'; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
    ctx.strokeStyle = 'rgba(200,170,120,.25)';
    for (let k = -r * 2; k < r * 2; k += 7) { ctx.beginPath(); ctx.moveTo(c.x + k, c.y - r); ctx.lineTo(c.x + k + r * 2, c.y + r); ctx.stroke(); }
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,170,120,.6)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(220,195,150,.8)'; ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText(s.name.toUpperCase(), c.x, c.y + 3); ctx.fillText('ROCKS · NO SONAR', c.x, c.y + 13);
  }
  // tomb + ring
  { const c = W2S(world.tomb.x, world.tomb.y);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(154,208,255,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(c.x, c.y, TOMB_RADIUS * z, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(154,208,255,.06)'; ctx.fill();
    ctx.save(); ctx.translate(c.x, c.y); ctx.fillStyle = '#cfefff'; ctx.shadowColor = '#9ad0ff'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 0); ctx.lineTo(0, 9); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#123'; ctx.fillRect(-1.2, -4, 2.4, 7); ctx.restore();
    ctx.fillStyle = '#cfefff'; ctx.font = '600 11px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('TOMB OF LEVISTUS', c.x, c.y + TOMB_RADIUS * z + 13); }
  // cameras
  for (const c of world.cams) {
    const p = W2S(c.x, c.y), active = world.activeCam === c.id && isUp(world, 'cameras');
    const f = c.facing * Math.PI / 180, hf = T.camFov / 2;
    ctx.fillStyle = c.broken ? 'rgba(255,75,58,.08)' : active ? 'rgba(255,179,71,.17)' : 'rgba(255,179,71,.05)';
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    for (let a = -hf; a <= hf + 0.01; a += hf / 8) ctx.lineTo(p.x + Math.sin(f + a) * T.camRange * z, p.y - Math.cos(f + a) * T.camRange * z);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.broken ? '#ff4b3a' : '#e8cf98'; ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText(c.broken ? c.name + ' ✕' : c.name, p.x, p.y + 15);
  }
  // island & observatory
  { const o = W2S(OBSERVATORY.x, OBSERVATORY.y);
    ctx.fillStyle = '#2b2620'; ctx.beginPath();
    for (let a = 0; a <= 6.3; a += 0.3) { const r = ISLAND_R * (1 + 0.18 * Math.sin(a * 3) + 0.1 * Math.sin(a * 7)) * z; a ? ctx.lineTo(o.x + Math.cos(a) * r, o.y + Math.sin(a) * r) : ctx.moveTo(o.x + r, o.y); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#8b6b3d'; ctx.stroke();
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(o.x, o.y - 10); ctx.lineTo(o.x + 7, o.y + 4); ctx.lineTo(o.x - 7, o.y + 4); ctx.fill();
    ctx.font = '600 11px Cinzel'; ctx.textAlign = 'center'; ctx.fillText('THE LAST WATCH', o.x, o.y + ISLAND_R * z + 14); }
  // buoy
  if (world.buoy) {
    const b = W2S(world.buoy.x, world.buoy.y), landed = t >= world.buoy.landAt;
    ctx.strokeStyle = 'rgba(92,255,157,.25)'; ctx.beginPath(); ctx.arc(b.x, b.y, T.buoyRadius * z, 0, 7); ctx.stroke();
    if (!landed) { const o = W2S(OBSERVATORY.x, OBSERVATORY.y), k = 1 - (world.buoy.landAt - t) / 4; ctx.strokeStyle = 'rgba(255,179,71,.6)'; ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + (b.x - o.x) * k, o.y + (b.y - o.y) * k); ctx.stroke(); }
    ctx.fillStyle = landed ? '#5cff9d' : '#ffb347'; ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill();
    ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('BUOY', b.x, b.y - 9);
    for (const p of world.pings) { const k = (t - p.tS) / T.sonarDelay; if (k < 1) { ctx.strokeStyle = `rgba(92,255,157,${1 - k})`; ctx.beginPath(); ctx.arc(b.x, b.y, T.buoyRadius * z * k, 0, 7); ctx.stroke(); } }
  }
  // what the water was doing round the buoy at the last echo
  for (const fl of world.flows) {
    const a = Math.max(0, 1 - (t - fl.t) / T.flowShow);
    for (const p of fl.pts) {
      const q = W2S(p.x, p.y);
      for (const [v, col] of [[p.deep, '169,139,255'], [p.surf, '111,208,255']]) {
        const L = 34 * z * Math.min(2.2, Math.hypot(v.x, v.y)) / 0.19 * 0.19 + 6, ang = Math.atan2(v.y, v.x);
        const ex = q.x + Math.cos(ang) * L, ey = q.y + Math.sin(ang) * L;
        ctx.strokeStyle = `rgba(${col},${0.75 * a})`; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(ang - 0.5) * 5, ey - Math.sin(ang - 0.5) * 5); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(ang + 0.5) * 5, ey - Math.sin(ang + 0.5) * 5); ctx.stroke();
      }
    }
    ctx.lineWidth = 1;
    if (fl.pts.length) { const q = W2S(fl.pts[0].x, fl.pts[0].y); ctx.fillStyle = `rgba(200,190,255,${0.8 * a})`; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText('DEEP', q.x, q.y - 6); ctx.fillStyle = `rgba(150,220,255,${0.8 * a})`; ctx.fillText('SURFACE', q.x + 34, q.y - 6); }
  }
  // sonar trails: successive pings of the same ice are joined
  const byBerg = {};
  for (const c of world.contacts) (byBerg[c.bergId] = byBerg[c.bergId] || []).push(c);
  for (const list of Object.values(byBerg)) {
    if (list.length < 2) continue;
    list.sort((a, b) => a.tS - b.tS);
    for (let i = 1; i < list.length; i++) {
      const a = W2S(list[i - 1].x, list[i - 1].y), b = W2S(list[i].x, list[i].y), al = Math.max(0, 1 - (t - list[i].tD) / T.contactFade);
      ctx.strokeStyle = `rgba(92,255,157,${0.15 + 0.5 * al})`; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // contacts
  for (const c of world.contacts) {
    const p = W2S(c.x, c.y), a = Math.max(0, 1 - (t - c.tD) / T.contactFade);
    const r = 1.25 * Math.max(2.5, Math.min(9, (c.large ? 3 : 2) + c.length * 0.18));
    ctx.fillStyle = `rgba(92,255,157,${0.25 + 0.75 * a})`; ctx.shadowColor = '#5cff9d'; ctx.shadowBlur = 8 * a;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    if (ui.selected === c.id) { ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#ffb347'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText('PINGED ' + fmt(c.tS), p.x + r + 8, p.y + 14); }
  }
  // lock & ghost
  if (world.lock) {
    const l = world.lock, p0 = W2S(l.x, l.y), g = ghostAt(world, t), pg = W2S(g.x, g.y);
    const aq = aimQuality(world), rr = (12 + (t - l.t0) * 0.6 + (aq.readDist ?? 400) * 0.08) * z + 6;
    ctx.strokeStyle = 'rgba(244,241,230,.5)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(pg.x, pg.y); ctx.stroke();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#f4f1e6'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pg.x, pg.y, rr, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pg.x - 6, pg.y); ctx.lineTo(pg.x + 6, pg.y); ctx.moveTo(pg.x, pg.y - 6); ctx.lineTo(pg.x, pg.y + 6); ctx.stroke();
    ctx.strokeStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(p0.x - 4, p0.y - 4); ctx.lineTo(p0.x + 4, p0.y + 4); ctx.moveTo(p0.x + 4, p0.y - 4); ctx.lineTo(p0.x - 4, p0.y + 4); ctx.stroke();
    ctx.fillStyle = '#f4f1e6'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText(`PREDICTED · ${gridRef(g.x, g.y)} · HIT ${aq.q}%`, pg.x + rr + 4, pg.y - 4);
  }
  // tagged bergs (live); excluded ones dim
  for (const b of world.bergs) {
    if (!b.tag) continue;
    const p = W2S(b.x, b.y), col = COLORS[b.tag], row = world.cases.find(c => c.bergId === b.id), ex = row && row.verdict === 'EXCLUDED';
    ctx.globalAlpha = ex ? 0.3 : 1;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = ex ? 0 : 10; ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    ctx.fillStyle = 'rgba(232,226,208,.55)'; ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText('#' + b.num, p.x + 7, p.y + 3);
    ctx.globalAlpha = 1;
  }
  // the blue light of Coldsteel
  if (world.reveal) {
    const b = world.bergs.find(b => b.id === world.reveal.bergId), p = W2S(b.x, b.y), k = t - world.reveal.t;
    for (let i = 0; i < 3; i++) { const q = ((k * 0.6 + i / 3) % 1); ctx.strokeStyle = `rgba(127,216,255,${1 - q})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, 8 + q * 60, 0, 7); ctx.stroke(); }
    ctx.lineWidth = 1; ctx.fillStyle = REVEAL; ctx.shadowColor = REVEAL; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }
  // beacons in flight & splashes
  for (const f of world.beacons.flying) {
    const k = (t - f.t0) / (f.t1 - f.t0), a = W2S(f.x0, f.y0), b = W2S(f.x1, f.y1);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 60;
    ctx.strokeStyle = COLORS[f.color] + '66'; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
    const px = (1 - k) ** 2 * a.x + 2 * (1 - k) * k * mx + k * k * b.x, py = (1 - k) ** 2 * a.y + 2 * (1 - k) * k * my + k * k * b.y;
    ctx.fillStyle = COLORS[f.color]; ctx.shadowColor = COLORS[f.color]; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(px, py, 4, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff3'; ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, 7); ctx.stroke();
  }
  for (const s of world.beacons.splashes) {
    const p = W2S(s.x, s.y), k = (t - s.t) / 40;
    ctx.strokeStyle = `rgba(150,180,200,${1 - k})`; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + 10 * Math.min(1, (t - s.t) / 2), 0, 7); ctx.stroke();
    ctx.fillStyle = `rgba(150,180,200,${1 - k})`; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('MISS', p.x, p.y - 12);
    if (s.tx != null) { const q = W2S(s.tx, s.ty); ctx.strokeStyle = `rgba(255,179,71,${0.7 * (1 - k)})`; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, 7); ctx.stroke(); ctx.fillStyle = `rgba(255,179,71,${0.8 * (1 - k)})`; ctx.fillText('TARGET WAS HERE', q.x, q.y + 16); }
  }
  // the Grindmaw (always tracked)
  { const s = world.shark, p = W2S(s.x, s.y);
    if (s.mode === 'hunt' && world.lastPing) { const q = W2S(world.lastPing.x, world.lastPing.y); ctx.strokeStyle = 'rgba(255,75,58,.55)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255,75,58,.5)'; ctx.beginPath(); ctx.moveTo(q.x - 5, q.y - 5); ctx.lineTo(q.x + 5, q.y + 5); ctx.moveTo(q.x + 5, q.y - 5); ctx.lineTo(q.x - 5, q.y + 5); ctx.stroke(); }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(s.heading); ctx.fillStyle = '#ff4b3a'; ctx.shadowColor = '#ff4b3a'; ctx.shadowBlur = s.mode === 'roam' ? 4 : 14;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#ff8a7a'; ctx.font = '600 10px IBM Plex Mono'; ctx.textAlign = 'center';
    ctx.fillText(s.mode === 'hunt' ? 'THE GRINDMAW · SWIMMING TO THE PING' : s.mode === 'patrol' ? 'THE GRINDMAW · CIRCLING THE WATCH' : 'THE GRINDMAW', p.x, p.y + 20); }
  // monsters let out of the ice
  for (const m of world.monsters) {
    const p = W2S(m.x, m.y), fade = m.fadeAt != null ? Math.max(0, 1 - (t - m.fadeAt) / T.monsterFadeTime) : 1;
    ctx.globalAlpha = fade;
    if (world.buoy && m.fadeAt == null) { const q = W2S(world.buoy.x, world.buoy.y); ctx.strokeStyle = 'rgba(255,75,58,.5)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = '#ff4b3a'; ctx.shadowColor = '#ff4b3a'; ctx.shadowBlur = 12; ctx.beginPath();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t, r = i % 2 ? 4 : 9; i ? ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r) : ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff8a7a'; ctx.font = '600 10px IBM Plex Mono'; ctx.textAlign = 'center';
    ctx.fillText(m.fadeAt != null ? 'MONSTER · SINKING AWAY' : `MONSTER FROM #${m.num} · AFTER THE BUOY`, p.x, p.y + 21);
    ctx.globalAlpha = 1;
  }
  // Old Tom
  if (world.tom.mode !== 'asleep') {
    const s = world.tom, p = W2S(s.x, s.y);
    if (s.mode === 'hunt' && s.target) { const q = W2S(s.target.x, s.target.y); ctx.strokeStyle = 'rgba(255,122,42,.55)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); ctx.setLineDash([]); }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(s.heading); ctx.fillStyle = '#ff7a2a'; ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 4); ctx.lineTo(0, 9); ctx.lineTo(-7, 4); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#ffae7a'; ctx.font = '600 10px IBM Plex Mono'; ctx.textAlign = 'center';
    ctx.fillText(s.mode === 'hunt' ? 'OLD TOM · SWIMMING TO THE SPLASH' : 'OLD TOM · CIRCLING THE WATCH', p.x, p.y + 21);
  }
  // grid labels pinned to the chart edges
  ctx.font = '600 11px IBM Plex Mono'; ctx.fillStyle = 'rgba(232,207,152,.85)';
  ctx.fillStyle = 'rgba(10,20,24,.75)'; ctx.fillRect(0, 0, Wd, 16); ctx.fillRect(0, 0, 20, Ht);
  ctx.fillStyle = 'rgba(232,207,152,.85)'; ctx.textAlign = 'center';
  for (let i = 0; i < GRID; i++) {
    const a = W2S((i + 0.5) * CELL, 0); if (a.x > 24 && a.x < Wd - 4) ctx.fillText(COLS[i], a.x, 12);
    const b = W2S(0, (i + 0.5) * CELL); if (b.y > 22 && b.y < Ht - 4) ctx.fillText(String(i + 1), 10, b.y + 4);
  }
  // compass & scale
  ctx.fillStyle = 'rgba(232,207,152,.8)'; ctx.font = '600 13px Cinzel'; ctx.textAlign = 'center'; ctx.fillText('N', Wd - 24, Ht - 50);
  ctx.strokeStyle = 'rgba(232,207,152,.8)'; ctx.beginPath(); ctx.moveTo(Wd - 24, Ht - 44); ctx.lineTo(Wd - 24, Ht - 20); ctx.stroke();
  const sb = CELL * z; ctx.beginPath(); ctx.moveTo(28, Ht - 14); ctx.lineTo(28 + sb, Ht - 14); ctx.stroke(); ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText('300 mi', 28, Ht - 20);
  drawHover(ctx, Wd);
}
// A small label over the contact under the mouse: number and length, nothing else.
function drawHover(ctx, Wd) {
  const h = ui.hover, c = h && !ui.buoyMode ? nearestContact(S2W(h.x, h.y), 18 / ui.view.z) : null;
  mapCv.style.cursor = ui.buoyMode ? 'crosshair' : c ? 'pointer' : drag && drag.moved ? 'grabbing' : 'grab';
  if (!c) return;
  const b = world.bergs.find(b => b.id === c.bergId); if (!b) return;
  const p = W2S(c.x, c.y), k = 9;
  ctx.strokeStyle = 'rgba(232,207,152,.9)'; ctx.lineWidth = 1.2; ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(p.x + sx * k, p.y + sy * (k - 4)); ctx.lineTo(p.x + sx * k, p.y + sy * k); ctx.lineTo(p.x + sx * (k - 4), p.y + sy * k); }
  ctx.stroke(); ctx.lineWidth = 1;
  const text = `#${b.num} · ${Math.round(c.length)} mi`;
  ctx.font = '11px IBM Plex Mono'; const tw = ctx.measureText(text).width, dot = b.tag ? 10 : 0, w = tw + dot + 14, ht = 18;
  let x = p.x + k + 6, y = p.y - k - ht - 2;
  if (x + w > Wd - 4) x = p.x - k - 6 - w; if (y < 20) y = p.y + k + 4;
  ctx.fillStyle = 'rgba(10,14,16,.88)'; ctx.strokeStyle = 'rgba(180,150,90,.8)';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + 0.5, y + 0.5, w, ht, 3) : ctx.rect(x + 0.5, y + 0.5, w, ht); ctx.fill(); ctx.stroke();
  if (b.tag) { ctx.fillStyle = COLORS[b.tag]; ctx.beginPath(); ctx.arc(x + 10, y + ht / 2 + 0.5, 3, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#f4f1e6'; ctx.textAlign = 'left'; ctx.fillText(text, x + 7 + dot, y + 13);
}

// ---------- camera view ----------
const camCv = $('camcanvas'), cctx = camCv.getContext('2d');
const HORIZON = 132;
function drawCamera() {
  const cam = world.cams.find(c => c.id === world.activeCam), ctx = cctx, Wd = camCv.width, Ht = camCv.height, t = world.t;
  $('camname').textContent = cam.name + ' · ' + gridRef(cam.x, cam.y) + ' · facing ' + String(Math.round(cam.facing)).padStart(3, '0') + '°';
  const up = isUp(world, 'cameras');
  $('camoff').textContent = world.power.cameras.on ? 'WARMING UP' : 'NO POWER';
  $('camoff').classList.toggle('hidden', up);
  $('camdead').classList.toggle('hidden', !(up && cam.broken));
  ui.camHits = [];
  const open = camIsUnlocked(world, cam.id);
  if (!open) ui.zoom[cam.id] = false;
  const Z = ui.zoom[cam.id] ? 2 : 1;
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON); sky.addColorStop(0, '#04110e'); sky.addColorStop(1, '#16302c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, Wd, HORIZON);
  for (let k = 0; k < 3; k++) {
    ctx.strokeStyle = `rgba(92,255,180,${0.06 + 0.03 * k})`; ctx.lineWidth = 14 - k * 4; ctx.beginPath();
    for (let x = 0; x <= Wd; x += 8) { const y = 30 + k * 18 + 10 * Math.sin(x / 70 + t * 0.15 + k + cam.facing); x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  const sea = ctx.createLinearGradient(0, HORIZON, 0, Ht); sea.addColorStop(0, '#1d2f33'); sea.addColorStop(1, '#070d10');
  ctx.fillStyle = sea; ctx.fillRect(0, HORIZON, Wd, Ht - HORIZON);
  ctx.strokeStyle = 'rgba(180,220,220,.06)';
  for (let y = HORIZON + 4; y < Ht; y += 6 + (y - HORIZON) * 0.08) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(Wd, y); ctx.stroke(); }
  // shoal rocks on the horizon
  for (const s of SHOALS) {
    const d = dist(s, cam); if (d > T.camRange + s.r) continue;
    for (let k = -3; k <= 3; k++) {
      const a = Math.atan2(s.x - cam.x, -(s.y - cam.y)) + k * 0.06;
      let rel = a - cam.facing * Math.PI / 180; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      if (Math.abs(rel) > T.camFov / 2 / Z) continue;
      const sx = Wd / 2 + (rel / (T.camFov / 2 / Z)) * (Wd / 2), base = HORIZON + 3600 / Math.max(60, d), hgt = (14 + ((k * 7 + 11) % 9) * 3) * Z;
      ctx.fillStyle = 'rgba(28,24,22,.9)'; ctx.beginPath(); ctx.moveTo(sx - 18, base); ctx.lineTo(sx - 6, base - hgt); ctx.lineTo(sx + 3, base - hgt * 0.6); ctx.lineTo(sx + 9, base - hgt * 0.9); ctx.lineTo(sx + 20, base); ctx.fill();
    }
  }
  const hf = T.camFov / 2 / Z;
  const items = cameraView(world, cam).filter(it => Math.abs(it.rel) <= hf + 0.15 / Z);
  for (const it of items) {
    const sx = Wd / 2 + (it.rel / hf) * (Wd / 2), d = Math.max(it.d, 15);
    const base = HORIZON + 3600 / d, fog = Math.min(0.5, (d / T.camRange) * 0.55);
    if (it.kind === 'remorhaz') { drawRemorhaz(ctx, sx, base, d, t, it.o.phase); continue; }
    if (it.kind === 'tomb') { drawTomb(ctx, sx, base, d, fog); continue; }
    const b = it.o, width = Math.min(520 * Z, b.length * 4200 * Z / d), hScale = Math.min(160 * Z, b.large ? width * 0.22 : width * 0.55);
    const x0 = sx - width / 2;
    if (world.reveal && world.reveal.bergId === b.id) drawReveal(ctx, sx, base, width, t - world.reveal.t);
    ctx.beginPath(); ctx.moveTo(x0, base);
    for (const [u, h] of b.shape) ctx.lineTo(x0 + u * width, base - h * hScale);
    ctx.lineTo(x0 + width, base); ctx.closePath();
    const ig = ctx.createLinearGradient(0, base - hScale * 1.2, 0, base);
    const lum = b.look === 'horn' ? [220, 210, 190] : b.look === 'cairn' || b.look === 'arsenal' ? [150, 160, 170] : b.look === 'hulk' ? [214, 205, 170] : [220, 236, 240];
    ig.addColorStop(0, `rgba(${lum.join(',')},${1 - fog})`); ig.addColorStop(1, `rgba(${lum.map(v => v * 0.45).join(',')},${1 - fog * 0.9})`);
    ctx.fillStyle = ig; ctx.fill();
    const sg = ctx.createLinearGradient(x0, 0, x0 + width, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0.10)'); sg.addColorStop(0.55, 'rgba(0,0,0,0)'); sg.addColorStop(1, `rgba(10,25,40,${0.45 * (1 - fog)})`);
    ctx.fillStyle = sg; ctx.fill();
    ctx.strokeStyle = `rgba(240,252,255,${0.7 * (1 - fog)})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); b.shape.forEach(([u, h], k) => { const px = x0 + u * width, py = base - h * hScale; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke(); ctx.lineWidth = 1;
    drawFeature(ctx, b, x0, base, width, hScale, fog, t);
    ctx.fillStyle = `rgba(200,230,235,${0.08 * (1 - fog)})`; ctx.fillRect(x0, base, width, Math.max(1, hScale * 0.15));
    const top = base - hScale * 1.4 - (b.look === 'horn' || b.look === 'cairn' ? hScale * 1.4 : 0);
    ui.camHits.push({ id: b.id, x0: x0 - 4, x1: x0 + width + 4, y0: top - 6, y1: base + 6 });
    if (world.lock && world.lock.bergId === b.id) {
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 2; const yy = top - 6, x1 = x0 + width;
      ctx.beginPath(); ctx.moveTo(x0 - 6, yy + 10); ctx.lineTo(x0 - 6, yy); ctx.lineTo(x0 + 4, yy); ctx.moveTo(x1 - 4, yy); ctx.lineTo(x1 + 6, yy); ctx.lineTo(x1 + 6, yy + 10);
      ctx.moveTo(x0 - 6, base - 4); ctx.lineTo(x0 - 6, base + 6); ctx.lineTo(x0 + 4, base + 6); ctx.moveTo(x1 - 4, base + 6); ctx.lineTo(x1 + 6, base + 6); ctx.lineTo(x1 + 6, base - 4); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = '#ffb347'; ctx.font = '11px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('LOCKED', x0 + width / 2, yy - 4);
    }
    if (world.cases.some(c => c.bergId === b.id && c.permanent) || (world.lock && world.lock.bergId === b.id)) { ctx.fillStyle = 'rgba(232,226,208,.6)'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('#' + b.num, x0 + width / 2, base + 14); }
    if (b.tag) { const row = world.cases.find(c => c.bergId === b.id); ctx.globalAlpha = row && row.verdict === 'EXCLUDED' ? 0.3 : 1; ctx.fillStyle = COLORS[b.tag]; ctx.shadowColor = COLORS[b.tag]; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x0 + width / 2, base - hScale * 0.6, 3 + (1 - fog) * 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1; }
  }
  const wiped = world.wipe && world.wipe.cam === cam.id && t < world.wipe.until;
  const snow = Math.max(0, snowAt(world, cam.x, cam.y, t) - (wiped ? 0.8 : 0));
  if (snow > 0.02) {
    ctx.fillStyle = `rgba(200,210,220,${snow * 0.8})`; ctx.fillRect(0, 0, Wd, Ht);
    ctx.fillStyle = `rgba(255,255,255,${0.4 + snow * 0.5})`;
    for (let i = 0; i < 300 * snow; i++) { const x = (i * 97.13 + t * 140 * (1 + i % 3)) % Wd, y = (i * 53.7 + t * 90 * (1 + i % 2)) % Ht; ctx.fillRect(x, y, 2, 2); }
    if (snow > 0.25) { ctx.fillStyle = 'rgba(40,50,60,.85)'; ctx.font = '600 12px IBM Plex Mono'; ctx.textAlign = 'right'; ctx.fillText('SNOW ON THE LENS', Wd - 8, Ht - 8); }
  }
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let i = 0; i < 300; i++) ctx.fillRect(Math.random() * Wd, Math.random() * Ht, 1, 1);
  ctx.fillStyle = 'rgba(232,207,152,.8)'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center';
  // bearing tape: fixed marks every 10 degrees that slide as the camera turns
  for (let b = Math.ceil((cam.facing - 50) / 10) * 10; b <= cam.facing + 50; b += 10) {
    const x = Wd / 2 + ((b - cam.facing) * Math.PI / 180 / hf) * Wd / 2;
    if (x < 10 || x > Wd - 10) continue;
    ctx.fillRect(x, 0, 1, 6); ctx.fillText(String(((b % 360) + 360) % 360).padStart(3, '0'), x, 17);
  }
  ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(Wd / 2 - 5, 0); ctx.lineTo(Wd / 2 + 5, 0); ctx.lineTo(Wd / 2, 7); ctx.fill(); ctx.fillStyle = 'rgba(232,207,152,.8)';
  ctx.textAlign = 'left'; ctx.fillText('● REC ' + fmt(t) + (Z > 1 ? '   ZOOM ×2' : ''), 8, Ht - 8);
  // weather station on the post: what the camera control levers are set from
  { const wx = camWeather(world, cam);
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(Wd - 196, 24, 188, 22);
    ctx.fillStyle = '#9ad0ff'; ctx.font = '600 12px IBM Plex Mono'; ctx.textAlign = 'right';
    ctx.fillText(`WIND ${wx.windKn} kn · AIR ${wx.air}°`, Wd - 14, 40); ctx.textAlign = 'left'; }
  const lk = world.lock, lb = lockedBerg(world);
  if (lk && lb && up && items.some(it => it.o === lb)) {
    const done = lk.track && lk.track.cam === cam.id && t - lk.track.t < 1.5, k = lk.trackSince != null ? Math.min(1, (t - lk.trackSince) / (T.trackTime * (world.damper === 'low' ? T.damperSlow : 1))) : 0;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, 24, 330, 40);
    ctx.fillStyle = !open ? '#cfc6ab' : done ? '#5cff9d' : '#ffb347'; ctx.font = '600 12px IBM Plex Mono';
    ctx.fillText(!open ? `#${lb.num} IN VIEW · UNLOCK THE ORB TO TRACK IT` : done ? `TRACKING #${lb.num} ✓ DRIFT MEASURED` : `TRACKING #${lb.num} · MEASURING DRIFT ${Math.round(k * 100)}%`, 14, 40);
    const L = Math.round(lb.length); ctx.fillStyle = L <= SIZE_CUT ? '#ff6a5a' : '#e8dfc6';
    ctx.fillText(`SIZE ≈${L} mi`, 14, 57);
  }
}
function drawReveal(ctx, sx, base, width, k) {
  const a = Math.min(1, k / 1.2), w = Math.max(30, width * 0.6) * (1 + 0.1 * Math.sin(k * 6));
  const g = ctx.createLinearGradient(sx - w / 2, 0, sx + w / 2, 0);
  g.addColorStop(0, 'rgba(127,216,255,0)'); g.addColorStop(0.5, `rgba(190,240,255,${0.85 * a})`); g.addColorStop(1, 'rgba(127,216,255,0)');
  ctx.fillStyle = g; ctx.fillRect(sx - w / 2, 0, w, base);
  const h = ctx.createRadialGradient(sx, base - 10, 0, sx, base - 10, width * 0.9 + 40);
  h.addColorStop(0, `rgba(127,216,255,${0.7 * a})`); h.addColorStop(1, 'rgba(127,216,255,0)');
  ctx.fillStyle = h; ctx.fillRect(sx - width - 60, 0, width * 2 + 120, camCv.height);
}
function drawFeature(ctx, b, x0, base, w, h, fog, t) {
  const a = 1 - fog;
  if (b.look === 'elgarz' || b.look === 'shadow') {
    ctx.strokeStyle = `rgba(20,30,40,${0.8 * a})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0 + w * 0.22, base - h * 0.32); ctx.lineTo(x0 + w * 0.68, base - h * 0.32); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = `rgba(30,40,55,${0.5 * a})`;
    for (let i = 0; i < 6; i++) { const u = 0.1 + i * 0.14; ctx.beginPath(); ctx.moveTo(x0 + w * u, base - h * 0.15); ctx.lineTo(x0 + w * (u + 0.05), base - h * 0.42); ctx.stroke(); }
  } else if (b.look === 'convoy') {
    ctx.strokeStyle = `rgba(40,30,25,${0.9 * a})`; ctx.lineWidth = 1.5;
    for (const u of [0.25, 0.48, 0.7]) { ctx.beginPath(); ctx.moveTo(x0 + w * u, base - h * 0.5); ctx.lineTo(x0 + w * u + 3, base - h * 2.4); ctx.moveTo(x0 + w * u - 6, base - h * 1.7); ctx.lineTo(x0 + w * u + 8, base - h * 1.8); ctx.stroke(); }
    ctx.lineWidth = 1;
  } else if (b.look === 'hulk') {
    ctx.fillStyle = `rgba(200,160,70,${0.55 * a})`;
    for (let i = 0; i < 4; i++) ctx.fillRect(x0 + w * (0.18 + i * 0.17), base - h * 0.55, Math.max(2, w * 0.05), Math.max(2, h * 0.18));
  } else if (b.look === 'cradle') {
    for (let i = 0; i < 3; i++) { const k = ((t * 0.5 + i / 3) % 1); ctx.fillStyle = `rgba(230,240,245,${(1 - k) * 0.5 * a})`; ctx.beginPath(); ctx.arc(x0 + w * (0.4 + 0.1 * i), base - h * (1 + k * 2.5), 3 + k * 8, 0, 7); ctx.fill(); }
  } else if (b.look === 'choir') {
    ctx.fillStyle = `rgba(20,25,35,${0.75 * a})`;
    for (let i = 0; i < 6; i++) ctx.fillRect(x0 + w * (0.2 + i * 0.1), base - h * 0.55, Math.max(1.5, w * 0.03), Math.max(2, h * 0.22));
  } else if (b.look === 'sepulcher') {
    const g = ctx.createRadialGradient(x0 + w / 2, base - h * 0.4, 0, x0 + w / 2, base - h * 0.4, w * 0.3);
    g.addColorStop(0, `rgba(255,230,160,${0.5 * a * (0.7 + 0.3 * Math.sin(t))})`); g.addColorStop(1, 'rgba(255,230,160,0)'); ctx.fillStyle = g; ctx.fillRect(x0, base - h, w, h);
  } else if (b.look === 'arsenal') {
    ctx.strokeStyle = `rgba(30,25,20,${0.9 * a})`;
    for (let i = 0; i < 5; i++) { const u = 0.15 + i * 0.17; ctx.beginPath(); ctx.moveTo(x0 + w * u, base - h * 0.6); ctx.lineTo(x0 + w * u + (i % 2 ? 6 : -5), base - h * 1.4); ctx.stroke(); }
  }
}
function drawTomb(ctx, sx, base, d, fog) {
  const w = Math.min(320, 9 * 4200 / d), h = w * 0.7, a = 1 - fog;
  ctx.fillStyle = `rgba(200,235,255,${0.55 * a})`; ctx.beginPath(); ctx.moveTo(sx - w / 2, base); ctx.lineTo(sx - w * 0.2, base - h); ctx.lineTo(sx + w * 0.25, base - h * 0.85); ctx.lineTo(sx + w / 2, base); ctx.fill();
  ctx.fillStyle = `rgba(20,30,50,${0.7 * a})`; ctx.fillRect(sx - w * 0.04, base - h * 0.6, w * 0.08, h * 0.35);
}
function drawRemorhaz(ctx, sx, base, d, t, ph) {
  const L = Math.min(260, 900 / d * 6), bob = Math.sin(t * 6 + ph) * L * 0.03;
  for (let i = 0; i < 7; i++) {
    const x = sx - L / 2 + i * L / 7, y = base - L * 0.08 + Math.sin(t * 5 + i + ph) * L * 0.02 + bob;
    ctx.fillStyle = '#1a1210'; ctx.beginPath(); ctx.ellipse(x, y, L * 0.09, L * 0.07, 0, 0, 7); ctx.fill();
    ctx.fillStyle = `rgba(255,${120 + 60 * Math.sin(t * 8 + i)},40,.95)`; ctx.shadowColor = '#ff7a2a'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.moveTo(x - L * 0.04, y - L * 0.05); ctx.lineTo(x, y - L * 0.14); ctx.lineTo(x + L * 0.04, y - L * 0.05); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.fillStyle = 'rgba(255,240,220,.25)';
  for (let i = 0; i < 4; i++) { const k = (t * 0.7 + i / 4) % 1; ctx.beginPath(); ctx.arc(sx - L * 0.3 + i * L * 0.2, base - L * (0.15 + k * 0.4), L * 0.03 + k * L * 0.06, 0, 7); ctx.fill(); }
}

// ---------- currents, wind & temperature ----------
const curCv = $('curcanvas'), kctx = curCv.getContext('2d');
function drawCurrents() {
  const ctx = kctx, r = world.readings, up = isUp(world, 'currents'), D = readingDisplay(r);
  ctx.fillStyle = '#070b12'; ctx.fillRect(0, 0, curCv.width, curCv.height);
  const age = r ? world.t - r.t : 0;
  $('curage').textContent = !world.power.currents.on ? (r ? 'UNPOWERED · last read ' + ago(age) : 'UNPOWERED') : !world.buoy ? 'needs a buoy in the water' : r ? 'at the buoy (' + gridRef(r.x, r.y) + ') · ' + ago(age) : 'reading...';
  const dim = !r ? 0.15 : up ? 1 : 0.45;
  const dials = [
    { label: 'WIND', v: r && r.wind, k: 1 / 14, col: '#e8e2d0', text: D ? `FROM ${D.windOct} · ${D.windKn} kn` : '--' },
    { label: 'SURFACE', v: r && r.surface, k: 1 / 2, col: '#6fd0ff', text: D ? `${D.surfKn.toFixed(1)} kn` : '--' },
    { label: 'DEEP', v: r && r.deep, k: 1 / 2, col: '#a98bff', text: D ? `${D.deepKn.toFixed(1)} kn` : '--' },
  ];
  dials.forEach((d, i) => {
    const cx = 66 + i * 124, cy = 66, R = 50;
    ctx.globalAlpha = dim;
    ctx.strokeStyle = '#3a4250'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.fillStyle = '#7d8799'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center';
    ['N', 'E', 'S', 'W'].forEach((n, j) => ctx.fillText(n, cx + Math.sin(j * Math.PI / 2) * (R - 9), cy - Math.cos(j * Math.PI / 2) * (R - 9) + 4));
    if (d.v) {
      const m = Math.min(1, Math.hypot(d.v.x, d.v.y) * d.k), ang = Math.atan2(d.v.x, -d.v.y);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); ctx.strokeStyle = d.col; ctx.fillStyle = d.col; ctx.lineWidth = 4; ctx.shadowColor = d.col; ctx.shadowBlur = 8;
      const L = 12 + 26 * m; ctx.beginPath(); ctx.moveTo(0, L * 0.6); ctx.lineTo(0, -L); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -L - 8); ctx.lineTo(7, -L + 4); ctx.lineTo(-7, -L + 4); ctx.fill(); ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#cfc6ab'; ctx.font = '600 11px IBM Plex Mono'; ctx.fillText(d.label, cx, 134);
    ctx.fillStyle = d.col; ctx.font = '12px IBM Plex Mono'; ctx.fillText(d.text, cx, 150);
  });
  // thermometer
  const tx = 440, top = 14, bot = 112;
  ctx.globalAlpha = dim;
  ctx.strokeStyle = '#3a4250'; ctx.lineWidth = 2; ctx.strokeRect(tx - 8, top, 16, bot - top); ctx.beginPath(); ctx.arc(tx, bot + 8, 11, 0, 7); ctx.stroke();
  ctx.fillStyle = '#7d8799'; ctx.font = '9px IBM Plex Mono'; ctx.textAlign = 'left';
  for (const v of [-10, -30, -50, -70]) { const y = bot - (v + 70) / 60 * (bot - top); ctx.fillRect(tx + 9, y, 5, 1); ctx.fillText(v + '°', tx + 16, y + 3); }
  if (D) { const y = bot - Math.max(0, Math.min(1, (D.temp + 70) / 60)) * (bot - top); ctx.fillStyle = '#9ad0ff'; ctx.shadowColor = '#9ad0ff'; ctx.shadowBlur = 8; ctx.fillRect(tx - 4, y, 8, bot - y + 4); ctx.beginPath(); ctx.arc(tx, bot + 8, 8, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center'; ctx.fillStyle = '#cfc6ab'; ctx.font = '600 11px IBM Plex Mono'; ctx.fillText('WATER', tx, 134);
  ctx.fillStyle = '#9ad0ff'; ctx.font = '12px IBM Plex Mono'; ctx.fillText(D ? `${D.temp}°` : '--', tx, 150);
}

// ---------- sonar ----------
const sonCv = $('sonarcanvas'), sctx = sonCv.getContext('2d');
const SON_R = 140;
function sonarXY(x, y) { const b = world.buoy; return { x: 150 + (x - b.x) / T.buoyRadius * SON_R, y: 150 + (y - b.y) / T.buoyRadius * SON_R }; }
sonCv.addEventListener('click', e => {
  if (!world.buoy) return; const p = canvasPoint(sonCv, e);
  let best = null, bd = 18;
  for (const c of world.contacts) { const q = sonarXY(c.x, c.y); const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = c; } }
  if (best) selectContact(best);
});
function drawSonar() {
  const ctx = sctx, t = world.t, up = isUp(world, 'sonar'), cracked = world.broken.sonarhead;
  $('sonaroff').classList.toggle('hidden', up && !cracked);
  $('sonaroff').innerHTML = cracked ? 'SONAR HEAD CRACKED<br><small>REPAIR IT ON THE OVERHEAD DECK ▲</small>' : world.power.sonar.on ? 'WARMING UP' : 'NO POWER';
  const strain = sonarStrain(world).sort((a, b) => b - a), bars = $('strainbars').children;
  for (let i = 0; i < bars.length; i++) bars[i].firstElementChild.style.width = ((strain[i] || 0) * 100).toFixed(0) + '%';
  $('strain').classList.toggle('hot', strain.length >= T.sonarStrainPings - 1);
  $('strainmsg').textContent = strain.length >= T.sonarStrainPings - 1 ? 'ONE MORE PING NOW CRACKS IT' : strain.length ? 'EASING OFF' : 'COOL';
  ctx.fillStyle = 'rgba(2,10,6,.35)'; ctx.fillRect(0, 0, 300, 300);
  ctx.strokeStyle = 'rgba(92,255,157,.18)';
  for (const r of [SON_R / 3, SON_R * 2 / 3, SON_R]) { ctx.beginPath(); ctx.arc(150, 150, r, 0, 7); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(10, 150); ctx.lineTo(290, 150); ctx.moveTo(150, 10); ctx.lineTo(150, 290); ctx.stroke();
  const stat = $('sonarstat');
  if (!world.buoy) {
    const wait = world.buoyRebuildAt - t;
    stat.textContent = wait > 0 ? `buoy rebuilding · ${Math.ceil(wait)}s` : 'no buoy · use DROP BUOY on the chart';
    ctx.fillStyle = 'rgba(92,255,157,.5)'; ctx.font = '12px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText(wait > 0 ? 'BUOY LOST' : 'NO BUOY', 150, 140);
    return;
  }
  const pending = world.pings.find(p => !p.delivered);
  stat.textContent = pending ? `listening · ${Math.ceil(pending.deliverAt - t)}s` : t < world.buoy.landAt ? 'buoy sinking...' : 'ready · buoy at ' + gridRef(world.buoy.x, world.buoy.y);
  if (world.buoy.storm > 0) {
    const left = Math.max(0, Math.ceil(T.buoyStormTime - world.buoy.storm));
    stat.textContent = `STORM OVER THE BUOY · LOST IN ${left} s`;
    ctx.fillStyle = `rgba(255,75,58,${0.55 + 0.45 * Math.sin(t * 8)})`; ctx.font = '600 13px IBM Plex Mono'; ctx.textAlign = 'center';
    ctx.fillText(`STORM OVER THE BUOY · ${left} s`, 150, 290);
  }
  if (pending) {
    const k = (t - pending.tS) / T.sonarDelay;
    ctx.strokeStyle = `rgba(92,255,157,${1 - k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(150, 150, SON_R * k, 0, 7); ctx.stroke(); ctx.lineWidth = 1;
  }
  const ang = t * 1.5;
  ctx.strokeStyle = 'rgba(92,255,157,.5)'; ctx.beginPath(); ctx.moveTo(150, 150); ctx.lineTo(150 + Math.sin(ang) * SON_R, 150 - Math.cos(ang) * SON_R); ctx.stroke();
  for (const c of world.contacts) {
    const q = sonarXY(c.x, c.y), a = Math.max(0, 1 - (t - c.tD) / T.contactFade), r = Math.max(2.5, Math.min(8, 2 + c.length * 0.25));
    if (Math.hypot(q.x - 150, q.y - 150) > 150) continue;
    ctx.fillStyle = `rgba(160,255,200,${0.2 + 0.8 * a})`; ctx.shadowColor = '#5cff9d'; ctx.shadowBlur = 10 * a;
    ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    if (ui.selected === c.id) { ctx.strokeStyle = '#ffb347'; ctx.beginPath(); ctx.arc(q.x, q.y, r + 5, 0, 7); ctx.stroke(); }
  }
  if (world.tom.mode !== 'asleep' && dist(world.tom, world.buoy) < T.buoyRadius) {
    const q = sonarXY(world.tom.x, world.tom.y);
    ctx.fillStyle = `rgba(255,122,42,${0.6 + 0.4 * Math.sin(t * 5)})`; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffae7a'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('OLD TOM', q.x, q.y - 10);
  }
  for (const m of world.monsters) {
    if (m.fadeAt != null || dist(m, world.buoy) >= T.buoyRadius) continue;
    const q = sonarXY(m.x, m.y);
    ctx.fillStyle = `rgba(255,75,58,${0.6 + 0.4 * Math.sin(t * 8)})`; ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, 7); ctx.fill();
    ctx.fillStyle = '#ff8a7a'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('MONSTER', q.x, q.y - 10);
  }
  if (dist(world.shark, world.buoy) < T.buoyRadius) {
    const q = sonarXY(world.shark.x, world.shark.y);
    ctx.fillStyle = `rgba(255,75,58,${0.6 + 0.4 * Math.sin(t * 6)})`; ctx.shadowColor = '#ff4b3a'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff8a7a'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('GRINDMAW', q.x, q.y - 10);
  }
}
const ECHO = $('echocanvas').getContext('2d'), EW = ECHO_W, EH = 150, SWEEP = 2.5;
function drawEcho() {
  const ctx = ECHO, c = world.contacts.find(c => c.id === ui.selected), base = 124;
  ctx.fillStyle = '#e8dfc6'; ctx.fillRect(0, 0, EW, EH);
  ctx.strokeStyle = 'rgba(120,90,60,.22)'; ctx.lineWidth = 1;
  for (let x = 0; x < EW; x += 16) { ctx.beginPath(); ctx.moveTo(x + 0.5, 16); ctx.lineTo(x + 0.5, base + 6); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(80,55,30,.45)'; ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(EW, base + 0.5); ctx.stroke();
  if (!c) { $('echoinfo').innerHTML = 'Click a contact on the sonar or the chart to print its echo and lock onto it.'; return; }
  const b = world.bergs.find(b => b.id === c.bergId), e = c.echo || { humps: [], tail: 'flat', temp: null };
  let seed = 0; for (const ch of c.id) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  const now = performance.now() / 1000, k = Math.floor(now / SWEEP), cur = (now % SWEEP) / SWEEP * EW;
  const trace = (x0, x1, kk, alpha) => {
    ctx.strokeStyle = `rgba(42,26,10,${alpha})`; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let x = Math.floor(x0); x <= x1; x++) { const y = base - echoAt(e, c.length, x, kk, seed) - (Math.random() - 0.5) * 1.2; x > x0 ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
  };
  trace(cur, EW, k - 1, 0.22);      // what is left of the last sweep
  trace(0, cur, k, 0.95);           // the sweep being drawn now
  ctx.strokeStyle = 'rgba(176,120,40,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cur + 0.5, 16); ctx.lineTo(cur + 0.5, base + 6); ctx.stroke();
  ctx.fillStyle = '#3a2a10'; ctx.font = '600 11px IBM Plex Mono'; ctx.textAlign = 'left';
  ctx.fillText(e.temp != null ? `WATER ${e.temp}°` : 'WATER --', 4, 12);
  ctx.textAlign = 'right'; ctx.fillText(`#${b ? b.num : '?'} · ${Math.round(c.length)} mi`, EW - 4, 12);
  ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText(`PING ${fmt(c.tS)}`, 4, EH - 6);
  $('echoinfo').innerHTML = `Contact pinged at <b>${fmt(c.tS)}</b> in <b>${gridRef(c.x, c.y)}</b>. Length ≈ <b${Math.round(c.length) <= SIZE_CUT ? ' style="color:var(--threat)"' : ''}>${Math.round(c.length)} mi</b>`;
}

// ---------- radio ----------
const radCv = $('radiocanvas'), rctx = radCv.getContext('2d');
$('freqslider').addEventListener('input', e => setFreq(world, Number(e.target.value)));
$('gain').addEventListener('input', e => setGain(world, Number(e.target.value)));
document.querySelectorAll('.fine button').forEach(b => b.onclick = () => { setFreq(world, world.radio.freq + Number(b.dataset.d)); audio.sfx.click(); });
const WAVE = {
  SMOOTH: p => Math.sin(p),
  STEPPED: p => (Math.sin(p) >= 0 ? 1 : -1) * 0.92,
  JAGGED: p => ((p / (2 * Math.PI)) % 1) * 2 - 1,
};
function drawRadio() {
  const up = isUp(world, 'radio'), sig = radioSignal(world), t = world.t, ctx = rctx;
  $('radiooff').classList.toggle('hidden', up); $('radiooff').innerHTML = world.broken.fuse ? 'RECEIVER BURNT OUT<br><small style="font-size:12px;letter-spacing:2px">REPAIR IT IN THE REPAIR BAY →</small>' : world.power.radio.on ? 'WARMING UP' : 'NO POWER';
  $('freq').textContent = world.radio.freq.toFixed(1);
  if (document.activeElement !== $('freqslider')) $('freqslider').value = world.radio.freq;
  if (document.activeElement !== $('gain')) $('gain').value = world.radio.gain;
  $('gainval').textContent = world.radio.gain.toFixed(1);
  $('radiosrc').textContent = world.music ? 'cabin wireless is ON' : 'hears beaconed ice only';
  const fuse = world.radio.clipTime / T.fuseClip;
  $('p-radio').classList.toggle('fusehot', fuse > 0.5);
  $('fusefill').style.width = Math.min(100, fuse * 100) + '%';
  $('fusemeter').classList.toggle('hot', fuse > 0.5);
  $('strength').style.width = (sig.strength * 100).toFixed(0) + '%';
  $('cliplamp').firstElementChild.className = 'lamp ' + (sig.clip ? 'on' : 'off');
  ctx.fillStyle = 'rgba(3,8,6,.6)'; ctx.fillRect(0, 0, 300, 110);
  ctx.strokeStyle = 'rgba(176,141,87,.45)'; ctx.setLineDash([3, 4]);
  for (const y of [55 - 40, 55 + 40]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(300, y); ctx.stroke(); }
  ctx.setLineDash([]); ctx.strokeStyle = 'rgba(92,255,157,.12)'; ctx.beginPath(); ctx.moveTo(0, 55); ctx.lineTo(300, 55); ctx.stroke();
  if (up) {
    const amp = Math.min(sig.amplitude, 1.6), f = WAVE[sig.carrier] || WAVE.SMOOTH;
    ctx.strokeStyle = '#5cff9d'; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let x = 0; x < 300; x++) {
      let v = sig.carrier ? f(x / 9 + t * 7) * amp : 0;
      if (sig.clip) v = Math.max(-1, Math.min(1, v));
      const noise = (Math.random() - 0.5) * (0.9 * (1 - sig.strength) + 0.06);
      const y = 55 - 40 * (v + noise);
      x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(232,207,152,.7)'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'left';
    ctx.fillText(sig.clip ? (world.radio.clipTime > T.fuseClip * 0.5 ? 'FUSE HOT · LOWER THE GAIN NOW' : 'CLIPPING · LOWER THE GAIN') : sig.strength > 0.75 && !sig.lamps ? 'MATCH THE GAIN TO THE BRASS LINES' : !lockedBerg(world) && !world.music ? 'NO TARGET LOCKED' : lockedBerg(world) && !lockedBerg(world).tag && sig.strength < 0.3 ? 'NO BEACON IN THIS ICE · NOTHING TO HEAR' : '', 6, 12);
    ctx.textAlign = 'right'; ctx.fillText(sig.band, 294, 106);
  }
  const lamps = document.querySelectorAll('#songlamps span');
  const song = sig.lamps, stp = Math.floor(t / 0.6) % 5;
  lamps.forEach((l, i) => { l.className = song && stp < 3 && i <= stp ? song[i] : ''; });
  audio.setStatic(up ? (1 - sig.strength) * 0.8 : 0);
  audio.setSong(up ? song : null, sig.strength);
}

// ---------- scanner ----------
const alCv = $('aligncanvas'), actx = alCv.getContext('2d');
let padKey = '';
function drawScanner() {
  const up = isUp(world, 'scanner');
  $('scanoff').classList.toggle('hidden', up); $('scanoff').innerHTML = world.broken.scanner ? 'SCANNER FUSE BLOWN<br><small style="font-size:12px;letter-spacing:2px">REPAIR IT IN THE REPAIR BAY ↑</small>' : world.power.scanner.on ? 'WARMING UP' : 'NO POWER';
  const a = scannerReach(world, lockedBerg(world)), ctx = actx;
  ctx.clearRect(0, 0, 200, 130);
  ctx.lineWidth = 10;
  [['#5a1a12', -Math.PI, -Math.PI * 0.98], ['#1f6b45', -Math.PI * 0.98, 0]].forEach(([c, s, e]) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(100, 110, 80, s, e); ctx.stroke(); });
  ctx.lineWidth = 1;
  const ang = -Math.PI + a * Math.PI + Math.sin(world.t * 13) * 0.01 + Math.sin(world.t * 1.7) * world.fatigue * 0.18;
  ctx.strokeStyle = '#f4f1e6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(100, 110); ctx.lineTo(100 + Math.cos(ang) * 74, 110 + Math.sin(ang) * 74); ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = '#b08d57'; ctx.beginPath(); ctx.arc(100, 110, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#cfc6ab'; ctx.font = '11px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('BUOY RANGE', 100, 128);
  const b = lockedBerg(world);
  $('scanbar').style.width = ((b ? b.scan : 0) * 100) + '%';
  const lamp = $('metallamp'), txt = $('metaltext');
  if (!b) { lamp.className = 'lamp off'; txt.textContent = 'NO TARGET LOCKED'; }
  else if (b.scanned) { lamp.className = 'lamp ' + (b.metal ? 'on' : 'no'); txt.textContent = b.metal ? 'WORKED METAL FOUND' : 'NO METAL'; }
  else if (!world.scanner.calibrated) { lamp.className = 'lamp off'; txt.textContent = 'NEEDS CALIBRATION'; }
  else if (a > 0) { lamp.className = 'lamp off'; txt.textContent = 'SCANNING...'; }
  else { lamp.className = 'lamp off'; txt.textContent = world.buoy ? 'OUT OF BUOY RANGE' : 'NEEDS A BUOY'; }
  const s = world.scanner, r = world.readings, locked = world.t < s.lockoutUntil;
  const key = [s.calibrated, s.plate.join(','), s.pressed.join(','), locked, !!r].join('|');
  if (key !== padKey) {
    padKey = key;
    const pad = $('runepad'); pad.innerHTML = '';
    s.plate.forEach((rid, i) => {
      const btn = document.createElement('button'); btn.className = 'rune' + (s.pressed.includes(i) || s.calibrated ? ' done' : '');
      btn.innerHTML = glyphSVG(rid, 38); btn.disabled = s.calibrated || locked || !r;
      btn.onclick = () => pressKey(world, i);
      pad.appendChild(btn);
    });
    $('runelbl').innerHTML = s.calibrated ? 'CALIBRATED <span style="color:var(--phos)">✓</span>' :
      !r ? 'CALIBRATION<br><span style="color:#9aa;letter-spacing:0">Needs a buoy reading.</span>' :
      locked ? 'CALIBRATION<br><span style="color:var(--threat);letter-spacing:0">Wrong rune. The plate has shifted.</span>' :
      `CALIBRATION<br><span style="color:#9aa;letter-spacing:0">${s.pressed.length ? s.pressed.length + ' of 4 set' : 'Set the plate for the water at the buoy.'}</span>`;
  }
  if (locked && Math.floor(world.t * 2) % 2 === 0) padKey = '';
}

// ---------- target lock (main board) and beacon launcher (overhead deck) ----------
for (const [k, v] of Object.entries(COLORS)) {
  const b = document.createElement('button'); b.className = 'col'; b.dataset.c = k; b.style.background = v;
  b.innerHTML = COLOR_LABEL[k];
  b.onclick = () => { setColor(world, k); audio.sfx.click(); };
  $('colors').appendChild(b);
}
$('fire').onclick = () => fireBeacon(world, world.color);
const lampClass = q => q == null ? 'off' : q >= 70 ? 'good' : q >= 40 ? 'fair' : 'poor';
const SOURCE = { beacon: 'BEACON', orb: 'ORB', sonar: 'SONAR', 'case board': 'CASE BOARD' };
function drawLock() {
  const l = world.lock, b = lockedBerg(world), aq = aimQuality(world);
  $('locknum').textContent = $('locknum2').textContent = b ? '#' + b.num : '--';
  const g = l && ghostAt(world, world.t);
  $('lockinfo').innerHTML = !l || !aq ? 'No lock. Click a sonar contact, or an iceberg in an orb.' :
    `Fix from <b>${SOURCE[aq.source] || aq.source.toUpperCase()}</b>, ${aq.source === 'beacon' ? '<b>live</b>' : '<b>' + ago(world.t - l.t0) + '</b>'}${world.obs[b.id] && world.obs[b.id].length != null ? ` · ≈${world.obs[b.id].length} mi` : ''}<br>Predicted in <b>${gridRef(g.x, g.y)}</b>${b.tag ? ` · tagged <b style="color:${COLORS[b.tag]}">${b.tag.toUpperCase()}</b>` : ''}`;
  const q = aq ? aq.q : null;
  $('aimnum').textContent = $('aimnum2').textContent = q == null ? '--' : q + '%';
  $('aimlamp').className = $('aimlamp2').className = 'lamp ' + lampClass(q);
  // one plain line: what is making the number, or what would fix it
  const why = !aq ? 'Lock onto an iceberg to aim.' : aq.reason ? aq.reason.charAt(0).toUpperCase() + aq.reason.slice(1) + '.'
    : aq.source === 'beacon' ? '<b>Its beacon reports where it is.</b>' : l.track ? '<b>The orb is tracking its drift.</b>' : aq.q >= 85 ? '<b>Good lock.</b> Fire soon.' : '';
  for (const id of ['aimwhy', 'aimwhy2']) { const el = $(id); if (el.innerHTML !== why) el.innerHTML = why; el.classList.toggle('low', !!(aq && aq.reason)); }
  document.querySelectorAll('.col').forEach(x => x.classList.toggle('sel', x.dataset.c === world.color));
  const green = world.color === 'green', bc = world.beacons, left = bc[STOCK[world.color]];
  $('fire').classList.toggle('green', green);
  $('fire').disabled = !l || world.broken.launcher || left <= 0;
  $('fire').innerHTML = `FIRE ${world.color.toUpperCase()} · ${left} LEFT`;
  $('jammed').classList.toggle('hidden', !world.broken.launcher);
  $('launchstat').textContent = world.broken.launcher ? 'JAMMED' : bc.flying.length ? 'beacon in flight' : 'ready';
  const rack = $('rack'), key = [bc.stock, bc.orange, bc.green].join('/');
  if (rack.dataset.n !== key) {
    rack.dataset.n = key;
    const pips = (n, max, cls) => Array.from({ length: max }, (_, i) => `<i class="${cls} ${i < n ? '' : 'empty'}"></i>`).join('');
    rack.innerHTML = pips(bc.stock, Math.max(T.beaconStock, bc.stock), 'r') + '<b></b>' + pips(bc.orange, Math.max(T.orangeStock, bc.orange), 'o') + '<b></b>' + pips(bc.green, Math.max(T.greenStock, bc.green), 'g');
  }
  // beacons now come from the Gunnery workshop: show what is curing
  const cq = world.workshop.curing[0], k = cq ? 1 - cq.left / T.cureTime : 0;
  $('rackfill').firstElementChild.firstElementChild.style.width = (k * 100).toFixed(1) + '%';
  $('rackfill').lastElementChild.textContent = !cq ? 'NEW BEACONS COME FROM THE GUNNERY WORKSHOP' : isUp(world, 'workshop') ? `${cq.color.toUpperCase()} BEACON CURING · ${Math.ceil(cq.left)} s${world.workshop.curing.length > 1 ? ' · ' + (world.workshop.curing.length - 1) + ' MORE' : ''}` : `${world.workshop.curing.length} SEALED · SWITCH THE WORKSHOP ON TO CURE`;
  const last = bc.last, rep = $('shotreport'), rkey = last ? last.t : 0;
  if (rep.dataset.t !== String(rkey) && last) {
    rep.dataset.t = String(rkey);
    rep.innerHTML = last.wild
      ? (last.hit ? `<b class="hit">LAUNCHED WILD</b> with nothing locked, and it struck #${last.num}.` : '<b class="miss">LAUNCHED WILD</b> with nothing locked. It splashed into open water.')
      : last.hit
      ? `<b class="hit">HIT #${last.num}</b> with ${last.color.toUpperCase()}. The hit chance was ${last.q}%.`
      : `<b class="miss">MISSED #${last.num}${last.by != null ? ' BY ' + last.by + ' mi' : ''}</b>. The hit chance was ${last.q}%.<br>Why: ${last.reasons.join('; ')}.`;
  }
}

// ---------- camera control (overhead deck) ----------
document.querySelectorAll('.lever button').forEach(b => b.onclick = () => setLever(world, b.parentElement.dataset.lever, b.dataset.pos));
document.querySelectorAll('#plates button').forEach(b => b.onclick = () => pressPlate(world, b.dataset.shape));
$('zoombtn').onclick = () => { const id = world.activeCam; ui.zoom[id] = !ui.zoom[id]; audio.sfx.click(); };
for (const [id, dir] of [['turnleft', -1], ['turnright', 1]]) {
  const b = $(id);
  const start = e => { e.preventDefault(); setCamTurn(world, dir); b.classList.add('held'); audio.sfx.turn(); };
  const stop = () => { if (world.camTurn === dir) setCamTurn(world, 0); b.classList.remove('held'); };
  b.addEventListener('mousedown', start); b.addEventListener('touchstart', start, { passive: false });
  b.addEventListener('mouseup', stop); b.addEventListener('mouseleave', stop); b.addEventListener('touchend', stop);
}
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.repeat) return;
  if (e.key === 'ArrowLeft') setCamTurn(world, -1);
  if (e.key === 'ArrowRight') setCamTurn(world, 1);
});
addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setCamTurn(world, 0); });
function drawCamCtl() {
  const cam = world.cams.find(c => c.id === world.activeCam), open = camIsUnlocked(world, cam.id), p = world.camPanel;
  $('camctlname').textContent = cam.name + (open ? ' · UNLOCKED' : ' · LOCKED');
  $('camlocked').classList.toggle('hidden', open); $('camopen').classList.toggle('hidden', !open);
  if (open) {
    $('facingnum').textContent = String(Math.round(cam.facing) % 360).padStart(3, '0') + '°';
    const lk = world.lock, following = lk && lk.track && lk.track.cam === cam.id;
    $('unlockleft').textContent = following ? 'FOLLOWING ITS ICE' : 'UNLOCKED UNTIL IT BREAKS';
    $('zoombtn').classList.toggle('on', !!ui.zoom[cam.id]); $('zoombtn').textContent = ui.zoom[cam.id] ? 'ZOOM ×2 · ON' : 'ZOOM ×2';
    return;
  }
  const rid = world.camRune[cam.id];
  if ($('housingrune').dataset.r !== String(rid)) { $('housingrune').dataset.r = rid; $('housingrune').innerHTML = glyphSVG(rid, 58); }
  document.querySelectorAll('.lever').forEach(l => l.querySelectorAll('button').forEach(b => b.classList.toggle('sel', p[l.dataset.lever] === b.dataset.pos)));
  document.querySelectorAll('#platedots i').forEach((d, i) => d.classList.toggle('on', i < p.pressed.length));
  const bad = world.t < p.lockout;
  $('camctlhint').classList.toggle('bad', bad);
  $('camctlhint').textContent = bad ? 'WRONG CODE · THE SERVOS ARE RESETTING' : 'Levers from WIND and AIR on the feed. Plates in the order for the housing rune\'s house.';
}

// ---------- rune board ----------
let boardKey = '';
function drawBoard() {
  const b = world.board, key = b.page + '|' + b.runes.join(',');
  if (key !== boardKey) {
    const flipped = boardKey !== '';
    boardKey = key;
    const pad = $('boardpad'); pad.innerHTML = '';
    b.runes.forEach((rid, i) => {
      const btn = document.createElement('button'); btn.className = 'brune'; btn.innerHTML = glyphSVG(rid, 54);
      btn.onclick = () => { btn.classList.add('pressed'); setTimeout(() => btn.classList.remove('pressed'), 250); pressBoard(world, i); };
      pad.appendChild(btn);
    });
    $('flippage').textContent = BOARD_PAGES[b.page];
    if (flipped) { const f = $('flippage'); f.classList.remove('flip'); void f.offsetWidth; f.classList.add('flip'); }
  }
  $('flipbar').firstElementChild.style.width = Math.max(0, Math.min(100, (b.nextFlip - world.t) / T.boardFlipEvery * 100)) + '%';
  const pips = Array.from({ length: T.chuteMax }, (_, i) => `<i class="${i < world.furnace.chute ? 'f' : ''}"></i>`).join('');
  if ($('chute2').innerHTML !== pips) { $('chute2').innerHTML = pips; $('chute').innerHTML = pips; }
}

// ---------- case board ----------
const CARRIER_GLYPH = { SMOOTH: '∿', STEPPED: '⊓', JAGGED: '⩘' };
// A small copy of the printout (the pulse drawn at full size, so the case board remembers it).
function miniEcho(e) {
  const pts = [];
  const tail = (e.humps.length ? e.humps[e.humps.length - 1].x + 18 : 26) + 8;   // the tail is drawn larger, so wavy and pulsing still show
  for (let x = 0; x <= ECHO_W; x += 1.5) pts.push(`${(x * 72 / ECHO_W).toFixed(1)},${(20 - echoAt(e, 14, x, 0, 0.9) * (x > tail ? 0.6 : 0.3)).toFixed(1)}`);
  return `<svg class="mini" width="72" height="24" viewBox="0 0 72 24"><polyline points="${pts.join(' ')}" fill="none" stroke="#e8dfc6" stroke-width="1.1"/></svg>`;
}
const tf = v => v == null ? '<span class="tile q">?</span>' : v ? '<span class="tile T">T</span>' : '<span class="tile F">F</span>';
const caseCache = {};
let caseKey = '';
function drawCases() {
  const rows = world.cases.map(c => {
    const b = world.bergs.find(x => x.id === c.bergId) || {}, o = world.obs[c.bergId] || {};
    const pos = b.tag ? b : c.seen, sq = pos ? gridRef(pos.x, pos.y) : '--';
    return { c, b, o, sq };
  }).sort((a, z) => (a.c.verdict === 'EXCLUDED') - (z.c.verdict === 'EXCLUDED') || (a.c.permanent - z.c.permanent) || a.c.added - z.c.added);
  const lockId = world.lock && world.lock.bergId;
  const key = JSON.stringify(rows.map(r => [r.c.bergId, r.c.permanent, r.c.verdict, r.sq, r.o, world.callsigns[r.c.bergId]])) + lockId;
  if (key === caseKey) return;
  caseKey = key;
  $('caserows').innerHTML = rows.map(({ c, b, o, sq }) => {
    const prev = caseCache[c.bergId] || {}, now = { sq, h: JSON.stringify(o.echo), m: o.metal, r: JSON.stringify(o.radio) + o.swept, v: c.verdict };
    const fl = k => prev[k] !== undefined && prev[k] !== now[k] ? ' flip' : '';
    caseCache[c.bergId] = now;
    const cs = world.callsigns[c.bergId], radio = o.radio ? `${cs ? `<span class="csign">${cs}</span>` : ''}<span class="rdots">${[...o.radio.shown].map(x => `<i class="${x}"></i>`).join('')}</span><span class="rtext">${Math.round(o.radio.freq)} ${o.radio.band} ${CARRIER_GLYPH[o.radio.carrier]}${o.swept ? ' · SWEPT' : ''}</span>`
      : o.swept ? '<span class="tile F">SWEPT</span>' : '<span class="tile q">?</span>';
    return `<div class="caserow${c.permanent ? '' : ' temp'}${c.verdict === 'EXCLUDED' ? ' excluded' : ''}${lockId === c.bergId ? ' locked' : ''}" data-id="${c.bergId}">
      <span class="tile">#${b.num}${o.length != null ? `<small style="font-size:10px;opacity:.7;margin-left:4px">${o.length}mi</small>` : ''}</span><span class="odo${prev.sq !== undefined && prev.sq !== sq ? ' roll' : ''}">${sq}</span>
      <span class="echocell ${fl('h').trim()}">${o.echo ? miniEcho(o.echo) + `<small>${o.echo.temp}°</small>` : '<span class="tile q">?</span>'}</span>
      <span class="${fl('m').trim()}">${tf(o.metal)}</span>
      <span class="${fl('r').trim()}">${radio}</span>
      ${c.permanent ? `<button class="verdict ${c.verdict}">${c.verdict}</button>` : '<span class="keephint">BEACON IT<br>TO KEEP IT</span>'}
      ${c.verdict === 'EXCLUDED' ? '<div class="stamp">EXCLUDED</div>' : ''}
    </div>`;
  }).join('') || '<div class="rb-sub" style="padding:8px">No ice yet. Lock onto an iceberg to look at it here.</div>';
  $('caserows').querySelectorAll('.caserow').forEach(r => {
    r.onclick = () => { relockCase(world, r.dataset.id); audio.sfx.lock(); };
    const vb = r.querySelector('.verdict'); if (vb) vb.onclick = e => { e.stopPropagation(); const v = r.querySelector('.verdict').textContent; setVerdict(world, r.dataset.id, v === '?' ? 'SUSPECT' : v === 'SUSPECT' ? 'EXCLUDED' : '?'); };
  });
}

// ---------- Jerry's notes (and GM handouts) ----------
const NOTE_AT = {   // positions on the rig, chosen to sit on empty space rather than controls
  checklist: [1120, 822], orbs: [40, 1080], orbctl: [360, 1452], sonar: [1716, 1490], furnace: [26, 1580], scanner: [1730, 610],
  radio: [250, 404], runes: [880, 500], case: [1700, 1080], chart: [1100, 900], launcher: [430, 70], currents: [1700, 1750], cabin: [-700, 1690],
};
const JERRY = [
  ['orbs', "Remorhaz smell the heat of the scrying orbs. Look away when you're not using one."],
  ['orbctl', 'Orb gears freeze solid. Set the levers to the weather ON THE ORB before you turn it.'],
  ['sonar', "Every ping rings the Grindmaw's dinner bell. Ping, then MOVE the buoy."],
  ['furnace', 'Two shovels. NEVER three. Fill the chute from the rune board first.'],
  ['scanner', 'Scanner rides on the buoy. Ice has to be near the buoy. Re-set it when the weather turns.'],
  ['radio', 'Gain DOWN, Jerry. Two receivers this week.'],
  ['runes', 'Runes change every page. CHECK THE BOOK, Jerry.'],
];
function jnote(at, text, gmNote = false) {
  const [x, y] = NOTE_AT[at] || NOTE_AT.chart;
  const n = document.createElement('div'); n.className = 'jnote' + (gmNote ? ' gm' : '');
  n.style.left = (x + (gmNote ? (Math.random() - 0.5) * 60 : 0)) + 'px'; n.style.top = (y + (gmNote ? (Math.random() - 0.5) * 40 : 0)) + 'px';
  n.style.transform = `rotate(${((Math.random() - 0.5) * 7).toFixed(1)}deg)`;
  n.innerHTML = '<span class="x">✕</span>' + text.replace(/</g, '&lt;');
  if (!gmNote) n.dataset.k = at;
  n.onclick = () => { n.remove(); if (!gmNote) ui.notesGone.push(at); };
  $('jnotes').appendChild(n);
}
JERRY.forEach(([at, text]) => jnote(at, text));

// ---------- the password lock ----------
const SEAL_TITLE = { lockdown: 'PASSWORD SECURITY UPDATE REQUIRED', green: 'AUTHORISE THE GREEN BEACON', relight: 'FURNACE INTERLOCK', fatigue: 'OPERATOR LOGGED OUT', gm: 'LOCKED BY THE WATCH OFFICER', reboot: 'SYSTEM REBOOTED', station: 'STATION LOCKOUT' };
ui.sealKey = '';
function drawSeal() {
  const s = world.seal, term = $('sealterm');
  document.querySelectorAll('.sealcover').forEach(c => c.classList.toggle('hidden', !s));
  if (!s) { if (!term.classList.contains('hidden')) term.classList.add('hidden'); return; }
  const key = [s.reason, s.mode, world.pwCap].join('|');
  if (ui.sealKey !== key) {
    ui.sealKey = key; term.classList.remove('hidden');
    const set = s.mode === 'set', update = s.reason === 'lockdown';
    // a lockdown is a security update: the rules in force are on screen from the start, even while the old password is entered
    const sub = update ? (set ? 'PLEASE IMPROVE YOUR PASSWORD. EVERY RULE BELOW MUST PASS.' : 'PLEASE IMPROVE YOUR PASSWORD. FIRST, ENTER THE CURRENT ONE.')
      : set ? (s.reason === 'reboot' ? 'SET A FRESH PASSWORD. EVERY RULE BELOW MUST PASS.' : 'SET A PASSWORD. EVERY RULE BELOW MUST PASS.') : 'ENTER THE PASSWORD.';
    term.innerHTML = `<div class="t">${SEAL_TITLE[s.reason] || 'LOCKED'}</div>
      <div class="sub">${sub}</div>
      <input id="sealin" type="text" spellcheck="false" autocomplete="off" maxlength="120" placeholder="${set ? 'new password' : 'current password'}">
      <div class="warn" id="sealwarn"></div>
      <button id="sealgo">${set ? 'SET PASSWORD' : 'ENTER'}</button>
      ${set ? '' : '<div class="tries" id="sealtries"></div>'}
      ${set || update ? `${set ? '' : '<div class="sub">THE NEW PASSWORD WILL NEED:</div>'}<ol class="rules${set ? '' : ' pending'}" id="sealrules"></ol>` : ''}`;
    if (!set && update) $('sealrules').innerHTML = checkPassword('', world.pwCap, { pages: s.pages }).results.map(r => `<li>${r.text}</li>`).join('');
    const inp = $('sealin');
    const submit = () => { const r = sealInput(world, inp.value); if (r === 'wrong') { inp.value = ''; inp.focus({ preventScroll: true }); } if (r === 'reboot') ui.sealKey = ''; };
    inp.addEventListener('input', () => {
      if (!keyboardOnly(inp.value)) { inp.value = inp.value.replace(/[^\x20-\x7E]/g, ''); $('sealwarn').textContent = 'Keyboard letters, numbers and symbols only.'; } else $('sealwarn').textContent = '';
      refreshSealRules();
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    $('sealgo').onclick = submit;
    setTimeout(() => inp.focus({ preventScroll: true }), 50);
  }
  if (s.mode === 'set') refreshSealRules();
  else {
    const left = WRONG_TRIES - s.tries, txt = s.tries ? `${left} ${left === 1 ? 'TRY' : 'TRIES'} LEFT BEFORE THE SYSTEM REBOOTS` : `${WRONG_TRIES} WRONG TRIES AND THE SYSTEM REBOOTS`;
    if ($('sealtries').textContent !== txt) $('sealtries').textContent = txt;
  }
}
// the rule list ticks as you type (and every frame, since a board flip can satisfy the page rule)
function refreshSealRules() {
  const s = world.seal; if (!s || s.mode !== 'set' || !$('sealrules')) return;
  const chk = checkPassword($('sealin').value, world.pwCap, { pages: s.pages });
  const html = chk.results.map(r => `<li class="${r.ok ? 'ok' : ''}">${r.text}</li>`).join('');
  if ($('sealrules').innerHTML !== html) $('sealrules').innerHTML = html;
  $('sealgo').disabled = !chk.ok;
}
// typing in the terminal must never scroll the cockpit out of place
$('stage').addEventListener('scroll', () => { $('stage').scrollTop = 0; $('stage').scrollLeft = 0; });
function drawShutters() {
  const down = shuttered(world);
  document.querySelectorAll('.shutter').forEach(s => s.classList.toggle('down', down));
}

// ---------- the two silly runes ----------
const fxCv = $('fx'), fxCtx = fxCv.getContext('2d');
let fx = null;
function confetti() {
  audio.sfx.confetti();
  const C = ['#ff4b3a', '#ffb347', '#5cff9d', '#6fa8ff', '#f4f1e6', '#ff7ad9'], parts = [];
  for (const ox of [300, 960, 1620]) for (let i = 0; i < 90; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, v = 500 + Math.random() * 700;
    parts.push({ x: ox, y: 1080, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: C[i % C.length] });
  }
  const start = !fx; fx = { parts, t0: performance.now(), last: performance.now() };
  if (start) requestAnimationFrame(drawFx);
}
function drawFx(now) {
  if (!fx) return;
  const dt = Math.min(0.05, (now - fx.last) / 1000), age = (now - fx.t0) / 1000; fx.last = now;
  fxCtx.clearRect(0, 0, 1920, 1080);
  if (age > 3.2) { fx = null; return; }
  fxCtx.globalAlpha = Math.min(1, (3.2 - age) / 0.6);
  for (const p of fx.parts) {
    p.vy += 900 * dt; p.vx *= 0.99; p.vy *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
    fxCtx.save(); fxCtx.translate(p.x, p.y); fxCtx.rotate(p.r); fxCtx.scale(1, Math.cos(p.r * 1.7)); fxCtx.fillStyle = p.c; fxCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); fxCtx.restore();
  }
  fxCtx.globalAlpha = 1;
  requestAnimationFrame(drawFx);
}
const DEVIL_SVG = `<svg viewBox="0 0 150 210" xmlns="http://www.w3.org/2000/svg"><g transform="translate(0,20)">
  <path d="M100 150 Q140 150 132 118 Q128 104 140 98 L136 112 L126 104" fill="none" stroke="#c4221a" stroke-width="5" stroke-linecap="round"/>
  <path d="M126 98 L144 94 L136 110 Z" fill="#c4221a"/>
  <line x1="30" y1="40" x2="22" y2="182" stroke="#3a2a1a" stroke-width="5"/>
  <path d="M18 36 L18 18 M30 34 L30 10 M42 36 L42 18 M18 36 Q30 44 42 36" fill="none" stroke="#9a9a9a" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="78" cy="122" rx="30" ry="36" fill="#d8291f"/>
  <path d="M58 150 L52 178 L64 178 M98 150 L104 178 L92 178" fill="none" stroke="#d8291f" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M52 108 L32 86 M104 108 L126 82" stroke="#d8291f" stroke-width="8" stroke-linecap="round"/>
  <circle cx="78" cy="66" r="30" fill="#e0342a"/>
  <path d="M52 50 Q40 32 50 20 Q52 36 60 44 Z M104 50 Q116 32 106 20 Q104 36 96 44 Z" fill="#f0e6d0"/>
  <g transform="rotate(-8 78 36)">
    <rect x="58" y="34" width="40" height="6" rx="2" fill="#111"/>
    <rect x="64" y="2" width="28" height="34" rx="2" fill="#151515"/>
    <rect x="64" y="26" width="28" height="5" fill="#8a1a14"/>
  </g>
  <path d="M62 60 L72 64 M94 60 L84 64" stroke="#2a0a08" stroke-width="3" stroke-linecap="round"/>
  <circle cx="68" cy="68" r="3.5" fill="#ffe14a"/><circle cx="88" cy="68" r="3.5" fill="#ffe14a"/>
  <path d="M64 80 Q78 94 92 80 Q78 86 64 80 Z" fill="#2a0a08"/>
  <path d="M74 92 Q78 104 82 92" fill="#3a0e0a"/>
</g></svg>`;
// He dances on the chart, the orb, the sonar, the radio and the scanner at once.
const DEVIL_SPOTS = () => [
  [document.querySelector('#p-map .screen.chart'), null],
  [$('camscreen'), null],
  [document.querySelector('#p-sonar .screen.round'), null],
  [$('radiocanvas').parentElement, null],
  [$('p-scan'), { left: 14, top: 46, width: 200, height: 130 }],
];
const DEVIL_TIME = 5000;
let devilTimer = null;
function devil() {
  clearTimeout(devilTimer);
  document.querySelectorAll('.devil').forEach(d => d.remove());
  audio.sfx.jig(); setTimeout(() => audio.sfx.jig(), 2720);
  for (const [el, box] of DEVIL_SPOTS()) {
    if (!el) continue;
    const bw = box ? box.width : el.clientWidth, bh = box ? box.height : el.clientHeight;
    const h = Math.min(bh * 0.9, 220), w = h * 150 / 210;
    const d = document.createElement('div'); d.className = 'devil';
    Object.assign(d.style, { width: w + 'px', height: h + 'px', left: ((box ? box.left : 0) + bw / 2 - w / 2) + 'px', top: ((box ? box.top : 0) + bh / 2 - h / 2) + 'px' });
    d.innerHTML = DEVIL_SVG; d.firstElementChild.style.animationDelay = (-Math.random() * 0.36).toFixed(2) + 's';
    el.appendChild(d);
  }
  devilTimer = setTimeout(() => {
    audio.sfx.puff();
    document.querySelectorAll('.devil').forEach(d => {
      d.classList.add('puff');
      const W = parseFloat(d.style.width), H = parseFloat(d.style.height);
      for (let i = 0; i < 6; i++) { const sm = document.createElement('div'); sm.className = 'smoke'; const r = W * (0.2 + Math.random() * 0.15); Object.assign(sm.style, { width: r + 'px', height: r + 'px', left: (W / 2 - r / 2 + (Math.random() - 0.5) * W * 0.5) + 'px', top: (H / 2 - r / 2 + (Math.random() - 0.5) * H * 0.4) + 'px' }); d.appendChild(sm); }
    });
    devilTimer = setTimeout(() => document.querySelectorAll('.devil').forEach(d => d.remove()), 750);
  }, DEVIL_TIME - 100);
}

// ---------- ending cutscene ----------
let cut = null;
function startCutscene() { cut = { t0: performance.now() }; $('cutscene').classList.remove('hidden'); audio.sfx.sharkhunt(); }
const LINES = ['MY HUMBLE SERVANTS.', 'THROUGH PERSISTENCE, YOU HAVE FOUND ME.', 'MY GATES AWAIT THEE.'];
function drawCut(now) {
  if (!cut) return;
  const ctx = $('cutcanvas').getContext('2d'), W = 744, H = 708, k = (now - cut.t0) / 1000;
  ctx.fillStyle = '#020604'; ctx.fillRect(0, 0, W, H);
  if (k < 8) {
    // a flickering feed: Geryon's silhouette
    const fl = 0.75 + 0.25 * Math.sin(k * 23) * Math.sin(k * 7);
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(120,200,160,${Math.random() * 0.12})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    ctx.save(); ctx.translate(W / 2, H * 0.47); ctx.globalAlpha = Math.min(1, k / 1.5) * fl;
    ctx.fillStyle = '#0c1a14'; ctx.strokeStyle = '#7fd8a8'; ctx.lineWidth = 2; ctx.shadowColor = '#5cff9d'; ctx.shadowBlur = 18;
    ctx.beginPath();   // wings
    ctx.moveTo(-60, -60); ctx.quadraticCurveTo(-260, -200, -330, 40); ctx.lineTo(-250, 0); ctx.lineTo(-220, 70); ctx.lineTo(-150, 30); ctx.lineTo(-110, 90); ctx.lineTo(-60, 40);
    ctx.lineTo(60, 40); ctx.lineTo(110, 90); ctx.lineTo(150, 30); ctx.lineTo(220, 70); ctx.lineTo(250, 0); ctx.lineTo(330, 40); ctx.quadraticCurveTo(260, -200, 60, -60); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();   // body and head with horns
    ctx.moveTo(-110, 260); ctx.lineTo(-120, 40); ctx.quadraticCurveTo(-100, -40, -48, -70); ctx.lineTo(-40, -120);
    ctx.quadraticCurveTo(-120, -150, -110, -230); ctx.quadraticCurveTo(-80, -160, -30, -150); ctx.quadraticCurveTo(0, -175, 30, -150);
    ctx.quadraticCurveTo(80, -160, 110, -230); ctx.quadraticCurveTo(120, -150, 40, -120); ctx.lineTo(48, -70); ctx.quadraticCurveTo(100, -40, 120, 40); ctx.lineTo(110, 260); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#bfffd8'; ctx.shadowBlur = 24; ctx.beginPath(); ctx.arc(-16, -118, 4, 0, 7); ctx.arc(16, -118, 4, 0, 7); ctx.fill();
    ctx.restore();
    const chars = Math.floor(Math.max(0, k - 1.2) * 16);
    let used = 0;
    ctx.font = '600 22px Cinzel'; ctx.textAlign = 'center'; ctx.fillStyle = '#d8ffe8'; ctx.shadowColor = '#5cff9d'; ctx.shadowBlur = 10;
    LINES.forEach((line, i) => { const n = Math.max(0, Math.min(line.length, chars - used)); used += line.length; if (n) ctx.fillText(line.slice(0, n), W / 2, H - 110 + i * 32); });
    ctx.shadowBlur = 0; ctx.font = '11px IBM Plex Mono'; ctx.fillStyle = 'rgba(160,255,200,.6)'; ctx.fillText('INCOMING · SOURCE: ELGARZ · SIGNAL HELD', W / 2, 30);
    for (let y = 0; y < H; y += 3) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, y, W, 1); }
  } else {
    // a sonar section of the keep buried in the glacier
    const s = Math.min(1, (k - 8) / 5), cx = W / 2, cy = H * 0.55;
    ctx.strokeStyle = 'rgba(92,255,157,.15)'; for (let r = 60; r < 420; r += 60) { ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI); ctx.stroke(); }
    ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, 500, Math.PI, Math.PI + s * Math.PI); ctx.closePath(); ctx.clip();
    ctx.strokeStyle = '#7fd8ff'; ctx.lineWidth = 2; ctx.fillStyle = 'rgba(127,216,255,.08)';
    ctx.beginPath(); ctx.moveTo(60, cy); ctx.lineTo(120, cy - 140); ctx.lineTo(200, cy - 190); ctx.lineTo(290, cy - 170); ctx.lineTo(370, cy - 230); ctx.lineTo(470, cy - 180); ctx.lineTo(560, cy - 200); ctx.lineTo(640, cy - 120); ctx.lineTo(690, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#5cff9d'; ctx.fillStyle = 'rgba(92,255,157,.14)'; ctx.lineWidth = 2;
    const keep = [[250, 60, 70], [300, 110, 40], [340, 150, 70], [420, 110, 40], [460, 60, 70]];
    for (const [x, h, w2] of keep) { ctx.fillRect(x - w2 / 2, cy - h, w2, h); ctx.strokeRect(x - w2 / 2, cy - h, w2, h); for (let i = 0; i < w2; i += 12) ctx.strokeRect(x - w2 / 2 + i, cy - h - 8, 6, 8); }
    ctx.beginPath(); ctx.moveTo(340, cy); ctx.lineTo(340, cy - 40); ctx.arc(355, cy - 40, 15, Math.PI, 0); ctx.lineTo(370, cy); ctx.stroke();
    ctx.restore();
    const a = Math.PI + s * Math.PI; ctx.strokeStyle = 'rgba(92,255,157,.8)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 420, cy + Math.sin(a) * 420); ctx.stroke();
    ctx.font = '12px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(160,255,200,.85)';
    ctx.fillText('SONAR SECTION · ELGARZ', 20, 30);
    if (s > 0.6) { ctx.fillText('CITADEL COLDSTEEL', 300, cy - 210 + 30); ctx.fillText('HOLLOW · WORKED METAL · THE TRIAD', 20, H - 30); }
  }
  if (k > 16.5 && !cut.done) { cut.done = true; $('wintime').textContent = 'Marked at ' + fmt(world.t) + ' on the watch clock.'; $('winscreen').classList.remove('hidden'); }
}

// ---------- wire service (ticker) ----------
let tickX = 0, tickW = 0;
function tickerText() {
  const items = [];
  while (ui.tickerQ.length) items.push('<b>' + ui.tickerQ.shift() + '</b>');
  const D = readingDisplay(world.readings);
  items.push(D ? `BUOY ${gridRef(world.readings.x, world.readings.y)}: WIND FROM ${D.windOct} ${D.windKn} KN · WATER ${D.temp}° · SURFACE ${D.surfKn.toFixed(1)} KN · DEEP ${D.deepKn.toFixed(1)} KN` : 'NO BUOY READING · DROP A BUOY AND POWER THE CURRENTS');
  const storms = stormsAt(world, world.t);
  items.push(storms.length ? storms.map(st => 'STORM OVER ' + gridRef(st.x, st.y)).join(' · ') : 'SKIES CLEAR OVER THE FIFTH');
  items.push(world.shark.mode === 'hunt' ? 'THE GRINDMAW IS SWIMMING FOR ' + gridRef(world.lastPing.x, world.lastPing.y) : world.shark.mode === 'patrol' ? 'THE GRINDMAW IS CIRCLING THE WATCH, NOW IN ' + gridRef(world.shark.x, world.shark.y) : 'THE GRINDMAW IS IN ' + gridRef(world.shark.x, world.shark.y));
  if (world.tom.mode !== 'asleep') items.push(world.tom.mode === 'hunt' ? 'OLD TOM IS SWIMMING FOR ' + gridRef(world.tom.target.x, world.tom.target.y) : 'OLD TOM IS CIRCLING THE WATCH, NOW IN ' + gridRef(world.tom.x, world.tom.y));
  items.push(`RUNE BOARD PAGE ${BOARD_PAGES[world.board.page]} · FLIPS IN ${Math.max(0, Math.ceil(world.board.nextFlip - world.t))} S`);
  const br = brokenList(world); if (br.length) items.push('BROKEN: ' + br.map(x => x.name).join(', '));
  if (world.fatigue > 0.6) items.push('THE OPERATOR IS NODDING OFF · COFFEE ADVISED');
  return items.join(' &nbsp;✦&nbsp; ') + ' &nbsp;✦&nbsp; ';
}
const CHECKS = [['coffee', 'BREW COFFEE (rune board)'], ['fuel', 'FILL THE FUEL CHUTE (rune board)'], ['sonar', 'POWER THE SONAR'], ['buoy', 'DROP A BUOY'], ['orbs', 'POWER THE SCRYING ORBS']];
let checkKey = '';
function drawTicker(dt) {
  const el = $('tickertext'), ck = world.checklist, done = Object.values(ck).every(Boolean);
  $('checklist').classList.toggle('hidden', done); el.style.visibility = done ? 'visible' : 'hidden';
  if (!done) {
    const key = JSON.stringify(ck);
    if (key !== checkKey) { checkKey = key; $('checklist').innerHTML = '<div class="cktitle">STARTUP CHECKLIST</div>' + CHECKS.map(([k, t]) => `<div class="ck ${ck[k] ? 'done' : ''}">${ck[k] ? '☑' : '☐'} ${t}</div>`).join(''); }
    return;
  }
  if (!tickW || tickX < -tickW || ui.tickerQ.length) { el.innerHTML = tickerText(); tickW = el.offsetWidth; tickX = 600; }
  tickX -= 110 * dt; el.style.transform = `translateX(${tickX}px)`;
}

// ---------- furnace, power & misc panel state ----------
function drawPower() {
  const f = world.furnace, slotsNow = slotsAvailable(world);
  let used = 0;
  for (const s of SYSTEMS) {
    const p = world.power[s], el = $('sw-' + s);
    if (p.on) used++;
    el.classList.toggle('on', p.on); el.classList.toggle('spin', p.on && world.t < p.ready);
  }
  $('powcount').textContent = f.lit ? `${used} of ${slotsNow} in use` : 'furnace cold';
  $('stage').classList.toggle('lit', f.lit); $('stage').classList.toggle('hot', f.lit && f.heat > 90);
  $('flames').style.height = f.lit ? (20 + f.heat * 1.05) + '%' : '0';
  $('heatfill').style.height = Math.min(100, f.heat) + '%';
  $('heatfill').classList.toggle('hot', f.heat > 90);
  const cooling = !f.lit && world.t < f.outUntil;
  $('ignite').disabled = f.lit || cooling || world.broken.furnace;
  $('ignite').textContent = world.broken.furnace ? 'GRATE CRACKED' : cooling ? `COOLING ${Math.ceil(f.outUntil - world.t)}` : f.everLit ? 'RELIGHT' : 'LIGHT';
  $('stoke').disabled = !f.lit || f.chute <= 0;
  $('stoke').textContent = f.chute > 0 ? 'STOKE' : 'CHUTE EMPTY';
  const st = $('furnacestat');
  const msg = !f.lit ? (world.broken.furnace ? 'GRATE CRACKED · REPAIR IT ON THE OVERHEAD DECK' : cooling ? 'BLOWN OUT · WAIT, THEN RELIGHT' : f.everLit ? 'THE FURNACE HAS GONE OUT · RELIGHT' : 'LIGHT THE FURNACE') :
    f.heat > 90 ? 'TOO HOT · DO NOT STOKE' : f.heat < T.slotHeat[0] ? (f.chute ? 'LOW HEAT · STOKE THE FURNACE' : 'LOW HEAT · FILL THE FUEL CHUTE ▲') : '';
  st.textContent = msg; st.classList.toggle('warn', !!msg && world.furnace.everLit);
  for (const c of world.cams) {
    const el = $('cb-' + c.id);
    el.classList.toggle('active', world.activeCam === c.id); el.classList.toggle('broken', c.broken);
    el.querySelector('.heat div').style.width = c.heat + '%';
    const tr = el.querySelector('.trem');
    tr.textContent = c.broken ? (world.repairs[c.id] ? 'REPAIRING' : 'DESTROYED') : c.tremor > 0 ? 'SHAKING' : 'STILL';
    tr.classList.toggle('on', c.tremor > 0 && !c.broken);
  }
  const cf = world.coffee, brewing = cf.brewUntil > world.t;
  $('mugfill').style.height = (brewing ? (1 - (cf.brewUntil - world.t) / T.coffeeBrew) : cf.sips / T.coffeeSips) * 100 + '%';
  $('mug').classList.toggle('hot', cf.sips > 0 || brewing); $('mug').classList.toggle('full', cf.sips > 0);
  $('mugstat').innerHTML = brewing ? 'BREWING...' : cf.sips ? `${cf.sips} SIP${cf.sips > 1 ? 'S' : ''} LEFT<br>CLICK TO DRINK` : 'POT EMPTY<br>BREW ON THE RUNE BOARD';
  // operator fatigue and cabin lighting
  const fa = world.fatigue;
  // tiredness darkens the edges first and creeps inward
  const clear = Math.max(12, 100 - Math.max(0, fa - 0.1) * 100), dark = Math.min(0.95, fa * 1.15);
  const grad = fa < 0.1 ? 'none' : `radial-gradient(ellipse at center, transparent ${clear * 0.55}%, rgba(0,0,0,${(dark * 0.55).toFixed(2)}) ${clear * 0.85}%, rgba(0,0,0,${dark.toFixed(2)}) ${Math.min(100, clear * 1.05 + 10)}%)`;
  if ($('fatigue').dataset.g !== grad) { $('fatigue').dataset.g = grad; $('fatigue').style.background = grad; }
  const lid = Math.min(1, fa * 0.95) * 17 + (($('blink').classList.contains('shut')) ? 17 : 0);
  $('lidtop').setAttribute('y', -34 + lid); $('lidbot').setAttribute('y', 34 - lid);
  $('eyestat').textContent = fa < 0.25 ? 'ALERT' : fa < 0.5 ? 'TIRED' : fa < 0.75 ? 'DROWSY' : 'NODDING OFF';
  $('eyestat').classList.toggle('warn', fa >= 0.75);
  document.querySelectorAll('#main .screen canvas, #main canvas').forEach(c => { c.style.filter = fa > 0.3 ? `blur(${((fa - 0.3) * 1.6).toFixed(2)}px)` : ''; });
  $('main').style.transform = fa > 0.5 ? `translate(${Math.sin(world.t * 0.7) * (fa - 0.5) * 8}px, ${Math.sin(world.t * 0.53) * (fa - 0.5) * 5}px)` : '';
  if (fa > 0.65 && !$('blink').classList.contains('shut') && Math.random() < (fa - 0.6) * 0.012) { $('blink').classList.add('shut'); setTimeout(() => $('blink').classList.remove('shut'), 260 + fa * 300); }
  $('stage').classList.toggle('redlamp', world.lamps === 1); $('stage').classList.toggle('greenlamp', world.lamps === 2);
  $('clock').textContent = fmt(world.t);
  $('btn-buoy').classList.toggle('armed', ui.buoyMode);
}

// ---------- events ----------
const camName = id => world.cams.find(c => c.id === id).name;
const BROKE_MSG = { launcher: 'THE BEACON LAUNCHER JAMMED', fuse: 'THE RADIO RECEIVER BURNT OUT', winch: 'THE BUOY WINCH IS BROKEN', furnace: 'THE GRATE CRACKED',
  scanner: 'THE METAL SCANNER BLEW ITS FUSE', sonarhead: 'THE SONAR HEAD CRACKED · TOO MANY PINGS' };
function handleEvents() {
  for (const e of world.events) {
    switch (e.type) {
      case 'deny': audio.sfx.deny(); toast(e.msg); break;
      case 'ignite': audio.sfx.ignite(); audio.setHum(1); break;
      case 'stoke': audio.sfx.stoke(); break;
      case 'blowout': audio.sfx.blowout(); audio.setHum(0); toast('THE FURNACE BLEW OUT · EVERYTHING IS DARK'); break;
      case 'furnaceout': audio.sfx.buoydead(); audio.setHum(0); toast('THE FURNACE HAS GONE OUT · RELIGHT IT'); break;
      case 'brownout': audio.sfx.alarm(); toast(`HEAT TOO LOW · ${SYS_LABEL[e.sys]} SWITCHED OFF (LOWEST PRIORITY)`); break;
      case 'damper': audio.sfx.clunk(); toast(e.mode === 'low' ? 'DAMPER LOW · SLOWER BURN, SLOWER SYSTEMS' : 'DAMPER NORMAL', 'info'); break;
      case 'priority': audio.sfx.click(); break;
      case 'buoystorm': audio.sfx.alarm(); toast(`A STORM IS OVER THE BUOY · MOVE IT WITHIN ${T.buoyStormTime} S OR LOSE IT`); break;
      case 'power': audio.sfx.clunk(); break;
      case 'buoy': audio.sfx.buoy(); break;
      case 'ping': audio.sfx.ping(); break;
      case 'echo': audio.sfx.echo(); toast(e.scattered ? 'THE BUOY IS ON THE ROCKS · THE PING SCATTERED' : e.n ? `ECHO RETURNED · ${e.n} CONTACT${e.n > 1 ? 'S' : ''}` : 'ECHO RETURNED · NOTHING THERE', 'info'); break;
      case 'lock': audio.sfx.lock(); break;
      case 'rune': audio.sfx.rune(); break;
      case 'runefail': audio.sfx.runefail(); break;
      case 'calibrated': audio.sfx.calibrated(); toast('SCANNER CALIBRATED', 'info'); break;
      case 'scandone': audio.sfx.scandone(); break;
      case 'launch': audio.sfx.launch(); if (e.wild) toast('LAUNCH WITH NOTHING LOCKED · THE BEACON FLIES WILD'); break;
      case 'hit': audio.sfx.hit(); if (e.color !== 'green') toast(`BEACON STRUCK ICEBERG #${e.num}`, 'info'); break;
      case 'greenwrong': toast(`GREEN BEACON STRUCK #${e.num} · NOTHING ANSWERS`); break;
      case 'reveal': audio.sfx.reveal(); toast(`GREEN BEACON STRUCK #${e.num} · THE ICE IS BLAZING BLUE`, 'info'); break;
      case 'miss': audio.sfx.miss(); toast(e.wild ? 'THE WILD BEACON SPLASHED INTO OPEN WATER' : `MISSED #${e.num}${e.by != null ? ' BY ' + e.by + ' MI' : ''} · SEE THE LAUNCHER REPORT ▲`); break;
      case 'sharkhunt': audio.sfx.sharkhunt(); toast('THE GRINDMAW HEARD THE PING · IT IS COMING'); break;
      case 'buoydead': ui.buoyDeadAt = world.t; audio.sfx.buoydead(); toast(e.who === 'storm' ? 'THE STORM TORE THE BUOY LOOSE · REPAIR THE WINCH ▲' : e.who === 'tom' ? 'OLD TOM TOOK THE BUOY · REPAIR THE WINCH ▲' : e.who === 'monster' ? 'THE MONSTER TOOK THE BUOY · REPAIR THE WINCH ▲' : 'THE GRINDMAW TOOK THE BUOY · REPAIR THE WINCH ▲'); break;
      case 'monster': audio.sfx.sharkhunt(); toast(`SOMETHING WAS FROZEN IN #${e.num} · IT IS LOOSE AND SWIMMING FOR THE BUOY`); break;
      case 'monsterfade': audio.sfx.buoy(); toast(e.fed ? 'THE MONSTER SINKS AWAY, FED' : 'THE MONSTER LOST THE BUOY AND SANK AWAY', e.fed ? '' : 'info'); break;
      case 'remorhaz': if (world.activeCam === e.cam) audio.sfx.remorhaz(); break;
      case 'camdead': audio.sfx.camdead(); toast(`${camName(e.cam)} ORB DESTROYED`); break;
      case 'repairstart': audio.sfx.click(); toast('REPAIR CREW SENT', 'info'); break;
      case 'repaired': audio.sfx.repaired(); toast((world.cams.find(c => c.id === e.id) ? camName(e.id) + ' ORB' : BREAKABLE[e.id]) + ' REPAIRED', 'info'); break;
      case 'broke': audio.sfx.camdead(); if (e.sys !== 'winch' || ui.buoyDeadAt !== world.t) toast(BROKE_MSG[e.sys] + ' · REPAIR BAY ▲'); break;
      case 'detune': audio.sfx.runefail(); toast('THE WATER HAS CHANGED · THE SCANNER HAS DRIFTED OUT OF TUNE'); break;
      case 'flip': audio.sfx.flip(); break;
      case 'defence': audio.sfx.alarm(); toast({ gunnery: 'GUNNERY STATION: DEVIL FIRE INBOUND ON THE TOWERS', signals: 'SIGNALS STATION: THE BUOY CABLE HAS SNAPPED', engineer: e.reason === 'overheat' ? 'THE FURNACE IS IN THE RED · ENGINEERING: THE FUSE BOX HAS BLOWN' : 'ENGINEERING STATION: THE FUSE BOX HAS BLOWN' }[e.role]); break;
      case 'freebeacon': audio.sfx.launch(); wire(`SIGNALS COMPLETED A MINESWEEP · THE GUNS FIRED · A BEACON STRUCK #${e.num}`, 'info'); break;
      case 'freefuel': audio.sfx.fuel(); wire(e.full ? 'ENGINEERING CLEARED THE BREAKER PANEL · THE CHUTE WAS ALREADY FULL' : 'ENGINEERING CLEARED THE BREAKER PANEL · A FREE SHOVEL IN THE CHUTE', 'info'); break;
      case 'defencedone': if (e.ok) wire({ gunnery: 'GUNNERY HELD THE TOWERS', signals: 'SIGNALS SPLICED THE BUOY CABLE', engineer: 'ENGINEERING REWIRED THE FUSE BOX' }[e.role], 'info');
        else { audio.sfx.camdead(); wire({ gunnery: `DEVIL FIRE STRUCK ${e.n} TOWER${e.n > 1 ? 'S' : ''} · THOSE ORBS ARE DOWN`, signals: 'THE SPLICE FAILED · THE BUOY IS LOST · REPAIR THE WINCH ▲', engineer: `THE FUSE BOX FAILED · ${e.sys ? SYS_LABEL[e.sys] + ' IS OFF, ' : ''}A SHOVEL LOST, LIGHTS RED` }[e.role]); } break;
      case 'fleetwin': audio.sfx.reveal(); wire('THE ENEMY FLEET IS SUNK · REDEPLOY THE FLEET · A NEW ENEMY IS ON THE HORIZON', 'info'); break;
      case 'defencelost': break;
      case 'beaconsealed': audio.sfx.clunk(); toast(`GUNNERY SEALED A ${e.color.toUpperCase()} BEACON · IT CURES WHILE THE WORKSHOP IS ON`, 'info'); break;
      case 'beaconready': audio.sfx.calibrated(); toast(`A ${e.color.toUpperCase()} BEACON IS READY IN THE LAUNCHER`, 'info'); break;
      case 'callsign': audio.sfx.flip(); break;
      case 'fleetplace': audio.sfx.click(); break;
      case 'fleetready': audio.sfx.calibrated(); look('main'); toast('THE FLEET IS DEPLOYED · THE WATCH BEGINS', 'info'); break;
      case 'fleetshot': if (e.by === 'them') { if (e.hit) audio.sfx.camdead(); toast(`THE ENEMY FLEET FIRED${e.free ? ' (NOBODY WAS SHOOTING)' : ''} · ${e.sunk >= 0 ? 'THEY SANK ONE OF OURS' : e.hit ? 'A HIT ON OUR FLEET' : 'A MISS'} · LOOK LEFT ◀`, e.hit ? '' : 'info'); }
        else { audio.sfx[e.hit ? 'hit' : 'miss'](); if (e.sunk >= 0) toast('WE SANK AN ENEMY SHIP', 'info'); } break;
      case 'reinforcements': audio.sfx.alarm(); break;
      case 'reinforced': toast('THE REINFORCEMENTS ARE BEATEN OFF · THE FLEET IS REFITTED', 'info'); break;
      case 'casepinned': audio.sfx.flip(); toast(`#${e.num} IS PINNED TO THE CASE BOARD`, 'info'); break;
      case 'observed': audio.sfx.flip(); break;
      case 'verdict': if (e.v === 'EXCLUDED') audio.sfx.stamp(); else audio.sfx.click(); break;
      case 'checklist': audio.sfx.lamps(); if (e.done) toast('STARTUP COMPLETE · THE WIRE SERVICE IS LIVE', 'info'); break;
      case 'pressure': audio.sfx.alarm(); toast('THE WIND IS RISING · STORMS WILL COME MORE OFTEN'); break;
      case 'tomwakes': audio.sfx.sharkhunt(); toast('SOMETHING ELSE IS IN THE WATER · OLD TOM HAS WOKEN'); break;
      case 'fusewarn': audio.sfx.alarm(); toast('RADIO FUSE OVERHEATING · LOWER THE GAIN'); break;
      case 'tracked': audio.sfx.lock(); toast(`ORB TRACKING #${e.num} · DRIFT MEASURED`, 'info'); break;
      case 'camunlocked': audio.sfx.calibrated(); toast(camName(e.cam) + ' ORB UNLOCKED', 'info'); break;
      case 'camfail': audio.sfx.runefail(); break;
      case 'plate': case 'lever': audio.sfx.click(); break;
      case 'paused': audio.sfx.bell(); break;
      case 'resumed': audio.sfx.click(); break;
      case 'fuel': audio.sfx.fuel(); break;
      case 'turn': audio.sfx.turn(); break;
      case 'brew': audio.sfx.coffee(); toast('THE COFFEE IS ON', 'info'); break;
      case 'brewed': audio.sfx.lamps(); toast('COFFEE IS READY · CLICK THE MUG', 'info'); break;
      case 'sip': audio.sfx.click(); break;
      case 'cabinradio': audio.setMusic(e.on); toast(e.on ? 'THE CABIN RADIO IS PLAYING · ITS STATIONS ARE ON THE BAND' : 'THE CABIN RADIO IS OFF', 'info'); break;
      case 'lights': audio.sfx.lamps(); toast(['CABIN LIGHTS NORMAL', 'EMERGENCY LIGHTING · RED', 'NIGHT LIGHTING · GREEN'][e.mode], e.mode ? '' : 'info'); break;
      case 'alarm': audio.sfx.alarm(); break;
      case 'coolant': audio.sfx.coolant(); toast('COOLANT FLOODS THE ORB HOUSINGS · EVERY ORB IS COLD', 'info'); break;
      case 'purge': audio.sfx.purge(); toast(e.n ? `FUEL CHUTE PURGED · ${e.n} SHOVEL${e.n > 1 ? 'S' : ''} LOST` : 'FUEL CHUTE PURGED · IT WAS EMPTY ANYWAY'); break;
      case 'shutter': audio.sfx.shutter(); toast(`SHUTTERS DOWN OVER THE SONAR AND THE ORBS · ${T.shutterTime} S`); break;
      case 'decoy': audio.sfx.launch(); toast('DECOY AWAY · THE GRINDMAW IS CHASING THE NOISE', 'info'); break;
      case 'succubus': succubus(); break;
      case 'sealed': audio.sfx.seal(); toast(SEAL_TITLE[e.reason] + (e.mode === 'set' ? ' · SET A PASSWORD' : ' · ENTER THE PASSWORD')); break;
      case 'pwwrong': audio.sfx.deny(); toast(`WRONG PASSWORD · ${e.left} ${e.left === 1 ? 'TRY' : 'TRIES'} BEFORE THE SYSTEM REBOOTS`); break;
      case 'pwaccepted': audio.sfx.calibrated(); if (e.next === 'set') toast('PASSWORD ACCEPTED · NOW SET A NEW ONE', 'info'); break;
      case 'pwset': audio.sfx.calibrated(); toast('PASSWORD SET · WRITE IT DOWN', 'info'); break;
      case 'unsealed': ui.sealKey = ''; break;
      case 'reboot': audio.sfx.reboot(); toast('FIVE WRONG PASSWORDS · THE SYSTEM HAS REBOOTED'); break;
      case 'confetti': confetti(); break;
      case 'devil': devil(); break;
      case 'telemetry': audio.sfx.lock(); toast(`BEACON TELEMETRY FROM #${e.num} · LIVE POSITION AND DRIFT`, 'info'); break;
      case 'spark': audio.sfx.spark(); break;
      case 'win': audio.sfx.win(); look(false); startCutscene(); break;
    }
  }
  world.events.length = 0;
}
$('wincontinue').onclick = () => { $('winscreen').classList.add('hidden'); $('cutscene').classList.add('hidden'); cut = null; };
$('ping').onclick = () => ping(world);

// ---------- the cabin (look left): the furnace log and the fleet ----------
document.querySelectorAll('#damper button').forEach(b => b.onclick = () => setDamper(world, b.dataset.m));
let prioKey = '', dragSys = null;
function drawPriority() {
  const key = world.priority.join() + '|' + SYSTEMS.map(s => world.power[s].on ? 1 : 0).join('');
  if (key === prioKey) return;
  prioKey = key;
  const el = $('prio'); el.innerHTML = '';
  world.priority.forEach((s, i) => {
    const li = document.createElement('li'); li.draggable = true; li.dataset.s = s;
    li.innerHTML = `<span class="grip">≡</span><b>${i + 1}</b><span class="nm">${SYS_LABEL[s]}</span><i class="${world.power[s].on ? 'on' : ''}"></i><button data-d="-1">▲</button><button data-d="1">▼</button>`;
    li.querySelectorAll('button').forEach(btn => btn.onclick = () => { const p = [...world.priority], j = i + Number(btn.dataset.d); if (j < 0 || j >= p.length) return; [p[i], p[j]] = [p[j], p[i]]; setPriority(world, p); });
    li.addEventListener('dragstart', () => { dragSys = s; li.classList.add('drag'); });
    li.addEventListener('dragend', () => { dragSys = null; li.classList.remove('drag'); });
    li.addEventListener('dragover', e => e.preventDefault());
    li.addEventListener('drop', e => { e.preventDefault(); if (!dragSys || dragSys === s) return; const p = world.priority.filter(x => x !== dragSys); p.splice(p.indexOf(s) + (world.priority.indexOf(dragSys) < i ? 1 : 0), 0, dragSys); setPriority(world, p); });
    el.appendChild(li);
  });
}
let flogAt = 0;
function drawCabin() {
  if (!lookingLeft() && world.t - flogAt < 2 && world.hold !== 'deploy') return;   // out of sight: keep it fresh, but cheaply
  flogAt = world.t;
  const fs = furnaceState(world);
  const nums = furnaceNumbers(fs); if ($('flognums').innerHTML !== nums) $('flognums').innerHTML = nums;
  drawFurnaceLog($('flogcanvas'), fs);
  document.querySelectorAll('#damper button').forEach(b => b.classList.toggle('sel', b.dataset.m === world.damper));
  drawPriority();
  fleetUI.render();
}
// The fleet: the Watch's naval defences, on the cabin wall (and on every officer's station).
const fleetUI = mountFleet($('fleetwall'), () => ({ fleet: world.fleet, t: world.t }), a => { stationAction(world, 'operator', a); audio.sfx.click(); }, { cell: 34 });

// ---------- the officers' stations ----------
// Each station says hello every few seconds; a station not heard from for a while counts as gone, and its defence
// events are skipped. Their actions go straight into the world.
const stationSeen = {};
function onStation(m) {
  if (!ROLES.includes(m.role)) return;
  if (m.iid && m.iid !== GAME_ID) return;   // that station follows another game on this code
  stationSeen[m.role] = performance.now();
  if (!m.hello) { stationAction(world, m.role, m); snapSoon = true; }
}
let snapSoon = false;
function drawStations() {
  const html = ROLES.map(r => `<i class="${world.defence.live[r] ? 'on' : ''}${world.defence.active[r] ? ' busy' : ''}" title="${STATION_NAME[r]}${world.defence.live[r] ? ' station connected' : ' station not connected'}">${r[0].toUpperCase()}</i>`).join('');
  if ($('stationlamps').innerHTML !== html) $('stationlamps').innerHTML = html;
  // the fleet must be deployed before the watch begins
  const deploying = world.hold === 'deploy' && ui.started;
  $('deploybanner').classList.toggle('hidden', !deploying || lookingLeft());
  $('reinforce').classList.toggle('hidden', !world.reinforce);
  $('twogames').classList.toggle('hidden', performance.now() - otherGameAt > 5000);
}
const STATION_NAME = { gunnery: 'Gunnery', signals: 'Signals', engineer: 'Engineering' };

// ---------- GM link ----------
// Same computer: a browser channel. Another computer: the GM types the code shown on the top bar.
const ROOM_KEY = 'lastwatch-room:' + location.pathname;
let roomCode = null; try { roomCode = cleanCode(localStorage.getItem(ROOM_KEY)); } catch (e) { }
if (!roomCode || roomCode.length < 4) { roomCode = newRoomCode(); try { localStorage.setItem(ROOM_KEY, roomCode); } catch (e) { } }
let gmSeenAt = -1e9, netStatus = NET_ENABLED ? 'CONNECTING' : 'LOCAL';
const gmLink = openLink(m => onGm(m), s => { netStatus = s; });
gmLink.join(roomCode);
$('introseed').textContent += NET_ENABLED ? ` · GM code ${roomCode}` : '';
function drawGmLink() {
  const el = $('gmcode'); if (!NET_ENABLED) { el.textContent = ''; return; }
  const linked = performance.now() - gmSeenAt < 12000, txt = `GM ${roomCode} <i class="${linked ? 'on' : netStatus === 'SUBSCRIBED' ? 'wait' : 'off'}"></i>`;
  if (el.innerHTML !== txt) { el.innerHTML = txt; el.title = linked ? 'The GM page is connected' : netStatus === 'SUBSCRIBED' ? 'Waiting for the GM to connect with this code' : 'Not connected to the GM relay'; }
}
const GAME_ID = Math.random().toString(36).slice(2, 10), GAME_BORN = Date.now();
let otherGameAt = -1e9;
function onGm(m) {
  if (m.ss) { if (m.ss.iid !== GAME_ID) otherGameAt = performance.now(); return; }   // another game tab on this code
  if (m.snap) return;                       // our own snapshots, echoed by another game tab
  if (m.station) { onStation(m.station); return; }
  if (m.hello) { gmSeenAt = performance.now(); return; }
  gmSeenAt = performance.now();
  if (m.cmd === 'reset') { const u = new URL(location.href); u.searchParams.set('seed', m.seed || newSeed()); location.href = u.toString(); }
  else if (m.cmd) gm(world, m.cmd, m.arg || {});
  if (m.note) note(m.note);
  if (m.handout) { jnote(m.handout.at, m.handout.text, true); audio.sfx.buoy(); }
  if (m.ticker) ui.tickerQ.push(String(m.ticker).toUpperCase());
}
let lastSnap = 0;
// Over the network once a second on a timer: animation frames stop in a background tab, timers do not.
setInterval(() => gmLink.send({ snap: snapshot(world) }), 1000);
// The officers' stations get their own small update, four times a second on this computer and twice over the network.
let ssTick = 0;
const sendStations = (remote = true) => { if (ui.started) gmLink.send({ ss: stationSnapshot(world, { iid: GAME_ID, born: GAME_BORN, selected: ui.selected }) }, remote); };
setInterval(() => sendStations(ssTick++ % 2 === 0), 250);

// ---------- loop ----------
// The watch runs on the real clock, whether or not this tab is on screen: a browser pauses animation frames in a
// hidden or covered window, so the simulation also ticks on a timer and catches up on what it missed.
let last = performance.now(), acc = 0;
function simTick() {
  const now = performance.now();
  acc += Math.min(10, (now - last) / 1000); last = now;
  if (!ui.started) acc = 0;
  while (acc >= DT) { step(world, DT); acc -= DT; }
  if (snapSoon) { snapSoon = false; sendStations(); }
  const t = performance.now();
  for (const r of ROLES) world.defence.live[r] = t - (stationSeen[r] || -1e9) < 7000;
}
setInterval(simTick, 100);
function frame(now) {
  simTick();
  handleEvents();
  drawMap(); drawCamera(); drawCurrents(); drawSonar(); drawEcho(); drawRadio(); drawScanner(); drawLock(); drawPower(); drawBoard(); drawRepairBay(); drawCamCtl(); drawCases(); drawCut(now); $('pausecard').classList.toggle('hidden', !world.paused); $('pausebtn').textContent = world.paused ? '▶ RESUME' : '❚❚ PAUSE'; drawTicker(Math.min(0.1, (now - (frame.prev || now)) / 1000)); frame.prev = now;
  if (now - lastSnap > 500) {
    lastSnap = now;
    gmLink.send({ snap: snapshot(world) }, false);   // twice a second on this computer while the game is in view
  }
  drawGmLink(); drawSeal(); drawShutters(); drawCabin(); drawStations();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__world = world;
// debug hooks for automated playthroughs
window.__dbg = { step: secs => { for (let i = 0; i < secs / DT; i++) step(world, DT); }, selectContact };
