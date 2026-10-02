import {
  createWorld, newSeed, step, light, stoke, slotsAvailable, setPower, isUp, selectCam, deployBuoy, ping, lockContact, lockFromCamera,
  setDrift, ghostAt, lockedBerg, alignment, pressKey, setFreq, setGain, setMusic, radioSignal, fireBeacon, readingDisplay,
  startRepair, badRepair, gm, cameraView, snowAt, stormsAt, dist, snapshot, SYSTEMS, DT,
  pressBoard, runeFunction, sip, setColor, aimQuality, brokenList, BREAKABLE, setLever, pressPlate, setCamTurn, camIsUnlocked,
} from './sim.js';
import { MAP, CENTER, OBSERVATORY, REACH, ISLAND_R, GRID, CELL, TOMB_RADIUS, TUNING as T, BOARD_PAGES } from './scenario.js';
import { glyphSVG } from './glyphs.js';
import * as audio from './audio.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const world = createWorld(Number(params.get('seed')) || newSeed());

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
  repairSel: null,
  noteCorner: 0,
  tickerQ: [],             // GM messages waiting for the wire service
};
const fmt = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const ago = s => fmt(s) + ' ago';
const COLORS = { red: '#ff4b3a', amber: '#ffb347', blue: '#6fa8ff', green: '#5cff9d' };
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
function toast(msg, kind = '') {
  const t = $('toast'); t.textContent = msg; t.className = 'show ' + kind;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.className = kind, 3600);
}
// Pneumatic-tube notes land in the four corners of the chart in turn.
function note(text) {
  const k = ui.noteCorner++ % 4, box = $('notes');
  const old = box.querySelector('.c' + k); if (old) old.remove();
  const n = document.createElement('div'); n.className = 'note c' + k; n.textContent = text;
  n.onclick = () => n.remove();
  box.appendChild(n); audio.sfx.buoy();
}
function look(up) { $('stage').classList.toggle('up', up); audio.sfx.clunk(); }
$('lookup').onclick = () => look(true);
$('gofire').onclick = () => look(true);
$('lookdown').onclick = () => look(false);
const togglePause = () => gm(world, 'pause');
$('pausebtn').onclick = togglePause;
$('resume').onclick = () => { if (world.paused) togglePause(); };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowUp') look(true);
  if (e.key === 'ArrowDown') look(false);
  if (e.key === 'p' || e.key === 'P') togglePause();
});

// ---------- intro / sound ----------
$('begin').onclick = () => { audio.unlock(); $('intro').classList.add('hidden'); audio.sfx.click(); };
function toggleMute() { audio.setMuted(!audio.isMuted()); $('mute').textContent = audio.isMuted() ? 'SOUND OFF' : 'SOUND ON'; }
$('mute').onclick = toggleMute;
addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M') && e.target.tagName !== 'INPUT') toggleMute(); });

// ---------- furnace & power ----------
$('ignite').onclick = () => light(world);
$('mug').onclick = () => sip(world);
$('stoke').onclick = () => stoke(world);
const SYS_LABEL = { cameras: 'CAMERAS', sonar: 'SONAR', radio: 'RADIO', scanner: 'SCANNER', currents: 'CURRENTS' };
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
const GAUGES = ['LOW', 'MIDDLE', 'HIGH', 'RED'], LAMPS = ['R', 'W', 'B', 'D'];
function makeBoard() {
  const rows = [], r = Math.random;
  for (let i = 0; i < 5; i++) {
    const g = r(), gauge = g < 0.3 ? 'LOW' : g < 0.6 ? 'MIDDLE' : g < 0.85 ? 'HIGH' : 'RED';
    rows.push({ gauge, lamp: LAMPS[Math.floor(r() * 4)], set: null });
  }
  return { rows, lockUntil: 0 };
}
// The manual's repair rules: first rule that fits; if none fits, CLOSE.
function correctAction(row) {
  if (row.gauge === 'RED') return 'CUT';
  if (row.lamp === 'D') return 'CLOSE';
  if (row.lamp === 'B' && row.gauge === 'LOW') return 'OPEN';
  if (row.lamp === 'W' && row.gauge !== 'HIGH') return 'OPEN';
  if (row.lamp === 'R' && row.gauge === 'LOW') return 'OPEN';
  return 'CLOSE';
}
function gaugeSVG(g) {
  const ang = { LOW: -60, MIDDLE: -15, HIGH: 30, RED: 70 }[g] * Math.PI / 180;
  const x = 32 + Math.sin(ang) * 24, y = 32 - Math.cos(ang) * 24;
  return `<svg class="gauge" viewBox="0 0 64 36"><path d="M8 32 A24 24 0 0 1 49 15" fill="none" stroke="#8a8f86" stroke-width="5"/><path d="M49 15 A24 24 0 0 1 56 32" fill="none" stroke="#ff4b3a" stroke-width="5"/>
    <line x1="32" y1="32" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#f4f1e6" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="3" fill="#b08d57"/></svg>`;
}
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
    el.dataset.ver = 'busy';
    el.innerHTML = `<div class="rb-title">REPAIR CREW AT WORK</div><div class="rb-sub">${item.name} back in service in ${Math.ceil(world.repairs[item.id] - world.t)}s</div>`;
    return;
  }
  let b = ui.repair[item.id]; if (!b) b = ui.repair[item.id] = makeBoard();
  const ver = item.id + ':' + (b.ver || 0);
  if (el.dataset.ver === ver) return;
  el.dataset.ver = ver;
  el.innerHTML = `<div class="rb-title">${item.name}: BROKEN</div>
    <div class="rb-sub">Set every conduit, then send the repair crew. The Operations Manual knows the rules.</div>
    <div class="rb-rows">${b.rows.map((r, i) => `
      <div class="rb-row g2"><b>${i + 1}</b>${gaugeSVG(r.gauge)}<span class="rlamp ${r.lamp}"></span>
        <div class="act">${['OPEN', 'CLOSE', 'CUT'].map(a => `<button data-i="${i}" data-a="${a}" class="${r.set === a ? 'sel' : ''}">${a}</button>`).join('')}</div>
      </div>`).join('')}</div>
    <button class="rb-go">SEND THE REPAIR CREW</button>`;
  el.querySelectorAll('.act button').forEach(btn => btn.onclick = () => { b.rows[+btn.dataset.i].set = btn.dataset.a; b.ver = (b.ver || 0) + 1; audio.sfx.click(); });
  el.querySelector('.rb-go').onclick = () => {
    if (world.t < b.lockUntil) return;
    const wrong = b.rows.filter(r => r.set !== correctAction(r));
    if (!wrong.length) { startRepair(world, item.id); delete ui.repair[item.id]; el.dataset.ver = ''; }
    else { wrong.forEach(r => r.set = null); b.lockUntil = world.t + 4; b.ver = (b.ver || 0) + 1; badRepair(world); toast(`SPARKS! ${wrong.length} CONDUIT${wrong.length > 1 ? 'S' : ''} WRONG. THEY HAVE RESET.`); }
  };
}

// ---------- map ----------
const mapCv = $('mapcanvas'), mctx = mapCv.getContext('2d');
const W2S = (x, y) => ({ x: (x - ui.view.cx) * ui.view.z + mapCv.width / 2, y: (y - ui.view.cy) * ui.view.z + mapCv.height / 2 });
const S2W = (x, y) => ({ x: (x - mapCv.width / 2) / ui.view.z + ui.view.cx, y: (y - mapCv.height / 2) / ui.view.z + ui.view.cy });
let drag = null;
mapCv.addEventListener('mousedown', e => { const p = canvasPoint(mapCv, e); drag = { x: p.x, y: p.y, cx: ui.view.cx, cy: ui.view.cy, moved: false }; });
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
  const c = nearestContact(wp, 14 / ui.view.z);
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
    const r = Math.max(2.5, Math.min(9, (c.large ? 3 : 2) + c.length * 0.18));
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
    ctx.fillStyle = '#f4f1e6'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText(`PREDICTED (${aq.tracked ? 'CAMERA TRACK' : world.drift.toUpperCase()}) · ${gridRef(g.x, g.y)} · AIM ${aq.q}%`, pg.x + rr + 4, pg.y - 4);
  }
  // tagged bergs (live)
  for (const b of world.bergs) {
    if (!b.tag) continue;
    const p = W2S(b.x, b.y), col = COLORS[b.tag];
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.fillRect(-5, -5, 10, 10); ctx.restore();
    ctx.fillStyle = col; ctx.font = '600 11px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText('#' + b.num, p.x + 9, p.y + 4);
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
    ctx.fillText(s.mode === 'hunt' ? 'THE GRINDMAW · SWIMMING TO THE PING' : s.mode === 'circle' ? 'THE GRINDMAW · CIRCLING' : 'THE GRINDMAW', p.x, p.y + 20); }
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
  const items = cameraView(world, cam);
  const hf = T.camFov / 2;
  for (const it of items) {
    const sx = Wd / 2 + (it.rel / hf) * (Wd / 2), d = Math.max(it.d, 15);
    const base = HORIZON + 3600 / d, fog = Math.min(0.5, (d / T.camRange) * 0.55);
    if (it.kind === 'remorhaz') { drawRemorhaz(ctx, sx, base, d, t, it.o.phase); continue; }
    if (it.kind === 'tomb') { drawTomb(ctx, sx, base, d, fog); continue; }
    const b = it.o, width = Math.min(520, b.length * 4200 / d), hScale = Math.min(160, b.large ? width * 0.22 : width * 0.55);
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
    if (b.tag) { ctx.fillStyle = COLORS[b.tag]; ctx.shadowColor = COLORS[b.tag]; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x0 + width / 2, base - hScale * 0.6, 3 + (1 - fog) * 3, 0, 7); ctx.fill(); ctx.shadowBlur = 0; }
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
  for (let k = -40; k <= 40; k += 10) { const x = Wd / 2 + (k * Math.PI / 180 / hf) * Wd / 2; ctx.fillRect(x, 0, 1, 6); ctx.fillText(String((cam.facing + k + 360) % 360).padStart(3, '0'), x, 17); }
  ctx.textAlign = 'left'; ctx.fillText('● REC ' + fmt(t), 8, Ht - 8);
  const lk = world.lock, lb = lockedBerg(world);
  if (lk && lb && up && cameraView(world, cam).some(it => it.o === lb)) {
    const done = lk.track && lk.track.cam === cam.id && t - lk.track.t < 1.5, k = lk.trackSince != null ? Math.min(1, (t - lk.trackSince) / T.trackTime) : 0;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, 24, 250, 22);
    ctx.fillStyle = done ? '#5cff9d' : '#ffb347'; ctx.font = '600 12px IBM Plex Mono';
    ctx.fillText(done ? `TRACKING #${lb.num} ✓ DRIFT MEASURED` : `TRACKING #${lb.num} · MEASURING DRIFT ${Math.round(k * 100)}%`, 14, 40);
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
  let best = null, bd = 14;
  for (const c of world.contacts) { const q = sonarXY(c.x, c.y); const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = c; } }
  if (best) selectContact(best);
});
function drawSonar() {
  const ctx = sctx, t = world.t, up = isUp(world, 'sonar');
  $('sonaroff').classList.toggle('hidden', up); $('sonaroff').textContent = world.power.sonar.on ? 'WARMING UP' : 'NO POWER';
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
  if (dist(world.shark, world.buoy) < T.buoyRadius) {
    const q = sonarXY(world.shark.x, world.shark.y);
    ctx.fillStyle = `rgba(255,75,58,${0.6 + 0.4 * Math.sin(t * 6)})`; ctx.shadowColor = '#ff4b3a'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(q.x, q.y, 6, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff8a7a'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('GRINDMAW', q.x, q.y - 10);
  }
}
const ECHO = $('echocanvas').getContext('2d');
function drawEcho() {
  const ctx = ECHO, c = world.contacts.find(c => c.id === ui.selected);
  ctx.fillStyle = '#e8dfc6'; ctx.fillRect(0, 0, 176, 110);
  ctx.strokeStyle = 'rgba(120,90,60,.25)'; for (let x = 0; x < 176; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 110); ctx.stroke(); }
  if (!c) { $('echoinfo').innerHTML = 'Click a contact on the sonar or the chart to print its echo and lock onto it.'; return; }
  const b = world.bergs.find(b => b.id === c.bergId), e = b.echo;
  let seed = 0; for (const ch of c.id) seed = (seed * 31 + ch.charCodeAt(0)) % 9973;
  const rnd = i => (Math.sin(seed + i * 12.9898) * 43758.5453) % 1;
  ctx.strokeStyle = '#2a1a0a'; ctx.lineWidth = 1.6; ctx.beginPath();
  const base = 88;
  for (let x = 0; x < 176; x++) {
    let y = base + rnd(x) * 1.5;
    if (x > 14 && x < 26) y -= 60 * Math.sin((x - 14) / 12 * Math.PI);
    for (let h = 0; h < e.humps; h++) { const c0 = 48 + h * 26; if (x > c0 && x < c0 + 18) y -= 30 * Math.sin((x - c0) / 18 * Math.PI); }
    const tail = 50 + e.humps * 26;
    if (x > tail) {
      if (e.tail === 'ring') y -= 9 * Math.sin((x - tail) / 3) * Math.exp(-(x - tail) / 45);
      if (e.tail === 'fuzz' || e.tail === 'fuzzflat') y -= (rnd(x * 7) - 0.5) * 14 * (e.tail === 'fuzz' ? 1 : 0.5);
    }
    x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = '#3a2a10'; ctx.font = '10px IBM Plex Mono'; ctx.fillText(`PING ${fmt(c.tS)}`, 4, 106);
  $('echoinfo').innerHTML = `Contact pinged at <b>${fmt(c.tS)}</b> in <b>${gridRef(c.x, c.y)}</b><br>Length ≈ <b>${Math.round(c.length)} mi</b>`;
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
  $('radiooff').classList.toggle('hidden', up); $('radiooff').innerHTML = world.broken.fuse ? 'FUSE BLOWN<br><small style="font-size:12px;letter-spacing:2px">REPAIR IT ON THE OVERHEAD DECK ▲</small>' : world.power.radio.on ? 'WARMING UP' : 'NO POWER';
  $('freq').textContent = world.radio.freq.toFixed(1);
  if (document.activeElement !== $('freqslider')) $('freqslider').value = world.radio.freq;
  if (document.activeElement !== $('gain')) $('gain').value = world.radio.gain;
  $('gainval').textContent = world.radio.gain.toFixed(1);
  $('radiosrc').textContent = world.music ? 'cabin wireless is ON' : 'tuned to the locked target';
  $('p-radio').classList.toggle('fusehot', world.radio.clipTime > 1.5);
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
    ctx.fillText(sig.clip ? (world.radio.clipTime > 1.5 ? 'FUSE HOT · LOWER THE GAIN NOW' : 'CLIPPING · LOWER THE GAIN') : sig.strength > 0.75 && !sig.lamps ? 'MATCH THE GAIN TO THE BRASS LINES' : !lockedBerg(world) && !world.music ? 'NO TARGET LOCKED' : '', 6, 12);
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
  $('scanoff').classList.toggle('hidden', up); $('scanoff').textContent = world.power.scanner.on ? 'WARMING UP' : 'NO POWER';
  const a = world.lock ? alignment(world) : 0, ctx = actx;
  ctx.clearRect(0, 0, 200, 130);
  ctx.lineWidth = 10;
  [['#5a1a12', -Math.PI, -Math.PI * (1.2 - T.alignNeeded)], ['#5a4a12', -Math.PI * (1.2 - T.alignNeeded), -Math.PI * (1 - T.alignNeeded)], ['#1f6b45', -Math.PI * (1 - T.alignNeeded), 0]].forEach(([c, s, e]) => { ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(100, 110, 80, s, e); ctx.stroke(); });
  ctx.lineWidth = 1;
  const ang = -Math.PI + a * Math.PI + Math.sin(world.t * 13) * 0.01 + Math.sin(world.t * 1.7) * world.fatigue * 0.18;
  ctx.strokeStyle = '#f4f1e6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(100, 110); ctx.lineTo(100 + Math.cos(ang) * 74, 110 + Math.sin(ang) * 74); ctx.stroke(); ctx.lineWidth = 1;
  ctx.fillStyle = '#b08d57'; ctx.beginPath(); ctx.arc(100, 110, 7, 0, 7); ctx.fill();
  ctx.fillStyle = '#cfc6ab'; ctx.font = '11px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('ALIGNMENT', 100, 128);
  const b = lockedBerg(world);
  $('scanbar').style.width = ((b ? b.scan : 0) * 100) + '%';
  const lamp = $('metallamp'), txt = $('metaltext');
  if (!b) { lamp.className = 'lamp off'; txt.textContent = 'NO TARGET LOCKED'; }
  else if (b.scanned) { lamp.className = 'lamp ' + (b.metal ? 'on' : 'no'); txt.textContent = b.metal ? 'WORKED METAL FOUND' : 'NO METAL'; }
  else if (!world.scanner.calibrated) { lamp.className = 'lamp off'; txt.textContent = 'NEEDS CALIBRATION'; }
  else if (a > T.alignNeeded) { lamp.className = 'lamp off'; txt.textContent = 'SCANNING...'; }
  else { lamp.className = 'lamp off'; txt.textContent = 'HOLD ALIGNMENT'; }
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
document.querySelectorAll('#drift button').forEach(b => b.onclick = () => setDrift(world, b.dataset.v));
for (const [k, v] of Object.entries(COLORS)) {
  const b = document.createElement('button'); b.className = 'col'; b.dataset.c = k; b.style.background = v;
  b.innerHTML = k === 'green' ? 'THIS IS<br>ELGARZ' : k.toUpperCase();
  b.onclick = () => { setColor(world, k); audio.sfx.click(); };
  $('colors').appendChild(b);
}
$('fire').onclick = () => fireBeacon(world, world.color);
const lampClass = q => q == null ? 'off' : q >= 70 ? 'good' : q >= 40 ? 'fair' : 'poor';
function factorRow(label, value, k) {
  const col = k >= 0.75 ? 'var(--phos)' : k >= 0.4 ? 'var(--amber)' : 'var(--threat)';
  return `<div class="row"><div>${label}<br><b>${value}</b></div><div class="bar"><div style="width:${Math.round(k * 100)}%;background:${col}"></div></div></div>`;
}
function drawLock() {
  const l = world.lock, b = lockedBerg(world), aq = aimQuality(world);
  $('locknum').textContent = $('locknum2').textContent = b ? '#' + b.num : '--';
  const g = l && ghostAt(world, world.t);
  $('lockinfo').innerHTML = !l ? 'No lock. Click a sonar contact or an iceberg on camera.' :
    `Fix from <b>${l.source.toUpperCase()}</b>, <b>${ago(world.t - l.t0)}</b><br>Predicted in <b>${gridRef(g.x, g.y)}</b>${b.tag ? ` · tagged <b style="color:${COLORS[b.tag]}">${b.tag.toUpperCase()}</b>` : ''}`;
  document.querySelectorAll('#drift button').forEach(x => x.classList.toggle('sel', x.dataset.v === world.drift));
  const r = world.readings;
  $('driftinfo').innerHTML = aq && aq.tracked ? `<b style="color:var(--phos)">CAMERA TRACK</b>: using the drift the ${camName(aq.cam)} camera measured ${ago(aq.trackAge)}. The drift switch is not used.` : !r ? 'No current reading yet. The prediction will not move. Track the ice on a camera, or read the current with a buoy.' : `Predicting with the <b>${world.drift.toUpperCase()}</b> current read at ${gridRef(r.x, r.y)}, ${ago(world.t - r.t)}.`;
  const q = aq ? aq.q : null;
  $('aimnum').textContent = $('aimnum2').textContent = q == null ? '--' : q + '%';
  $('aimlamp').className = $('aimlamp2').className = 'lamp ' + lampClass(q);
  // advice pop-up when aim quality is low
  let tip = '';
  if (aq && q < 50) {
    if (aq.tracked) tip = aq.fFix < aq.fTrack ? '<b>Low aim quality.</b> The fix is old. Bring the ice back into a camera view to refresh it.' : '<b>Low aim quality.</b> The camera lost sight of the ice a while ago. Find it on a camera again.';
    else if (!world.buoy || !world.power.currents.on) tip = '<b>Low aim quality.</b> Switch on <b>CURRENTS</b> with a buoy in the water, or <b>track the ice on a camera</b> for a few seconds.';
    else if (aq.readAge == null) tip = '<b>Low aim quality.</b> Waiting for the first current reading from the buoy.';
    else if (aq.fDist < 0.5) tip = '<b>Low aim quality.</b> The current was read far from the target. Drop the buoy right next to it.';
    else if (aq.fRead < 0.5) tip = '<b>Low aim quality.</b> The current reading is old. Keep <b>CURRENTS</b> powered.';
    else tip = '<b>Low aim quality.</b> The fix is old. Ping again or click the ice on camera to re-lock.';
  }
  for (const id of ['aimtip', 'aimtip2']) { const el = $(id); el.classList.toggle('hidden', !tip); if (el.innerHTML !== tip) el.innerHTML = tip; }
  $('aimfactors').innerHTML = !aq ? '<div class="note2">Lock onto an iceberg to aim.</div>' :
    factorRow('FIX AGE', Math.round(aq.fixAge) + ' s', aq.fFix) +
    (aq.tracked
      ? factorRow('CAMERA TRACK (' + camName(aq.cam) + ')', Math.round(aq.trackAge) + ' s ago', aq.fTrack) +
        `<div class="note2"><b style="color:var(--phos)">Drift measured by camera.</b> No buoy needed and the drift switch is not used. Flight time about ${Math.round(aq.flight)} s.</div>`
      : factorRow('CURRENT READING AGE', aq.readAge == null ? 'none' : Math.round(aq.readAge) + ' s', aq.fRead) +
        factorRow('READING TAKEN FROM TARGET', aq.readDist == null ? 'none' : Math.round(aq.readDist) + ' mi', aq.fDist) +
        `<div class="note2">Drift switch: <b>${aq.drift.toUpperCase()}</b>. Flight time about ${Math.round(aq.flight)} s. Aim quality cannot tell if the drift switch is wrong for this ice. Tip: track the ice on a camera to measure its drift directly.</div>`);
  document.querySelectorAll('.col').forEach(x => x.classList.toggle('sel', x.dataset.c === world.color));
  const green = world.color === 'green', bc = world.beacons;
  $('fire').classList.toggle('green', green);
  $('fire').disabled = !l || world.broken.launcher || (green ? bc.green <= 0 : bc.stock <= 0);
  $('fire').innerHTML = green ? `FIRE GREEN · ${bc.green} LEFT` : 'FIRE BEACON';
  $('jammed').classList.toggle('hidden', !world.broken.launcher);
  $('launchstat').textContent = world.broken.launcher ? 'JAMMED' : bc.flying.length ? 'beacon in flight' : 'ready';
  const rack = $('rack'), key = bc.stock + '/' + bc.green;
  if (rack.dataset.n !== key) {
    rack.dataset.n = key;
    rack.innerHTML = Array.from({ length: T.beaconStock }, (_, i) => `<i class="${i < bc.stock ? '' : 'empty'}"></i>`).join('') + '<b></b>' +
      Array.from({ length: T.greenStock }, (_, i) => `<i class="g ${i < bc.green ? '' : 'empty'}"></i>`).join('');
  }
  const last = bc.last, rep = $('shotreport'), rkey = last ? last.t : 0;
  if (rep.dataset.t !== String(rkey) && last) {
    rep.dataset.t = String(rkey);
    rep.innerHTML = last.hit
      ? `<b class="hit">HIT #${last.num}</b>${last.intended ? '' : ' (not the iceberg you locked)'} with ${last.color.toUpperCase()}. Aim quality was ${last.q}%.`
      : `<b class="miss">MISSED #${last.num}${last.by != null ? ' BY ' + last.by + ' mi' : ''}</b>. Aim quality was ${last.q}%.<br>Why: ${last.reasons.join('; ')}.`;
  }
}

// ---------- camera control (overhead deck) ----------
document.querySelectorAll('.lever button').forEach(b => b.onclick = () => setLever(world, b.parentElement.dataset.lever, b.dataset.pos));
document.querySelectorAll('#plates button').forEach(b => b.onclick = () => pressPlate(world, b.dataset.shape));
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
    $('unlockleft').textContent = 'UNLOCKED · ' + fmt(world.camUnlocked[cam.id] - world.t) + ' LEFT';
    return;
  }
  document.querySelectorAll('.lever').forEach(l => l.querySelectorAll('button').forEach(b => b.classList.toggle('sel', p[l.dataset.lever] === b.dataset.pos)));
  document.querySelectorAll('#platedots i').forEach((d, i) => d.classList.toggle('on', i < p.pressed.length));
  const bad = world.t < p.lockout;
  $('camctlhint').classList.toggle('bad', bad);
  $('camctlhint').textContent = bad ? 'WRONG CODE · THE SERVOS ARE RESETTING' : 'Set both levers, then press the three plates in order. The manual has the code.';
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

// ---------- wire service (ticker) ----------
let tickX = 0, tickW = 0;
function tickerText() {
  const items = [];
  while (ui.tickerQ.length) items.push('<b>' + ui.tickerQ.shift() + '</b>');
  const D = readingDisplay(world.readings);
  items.push(D ? `BUOY ${gridRef(world.readings.x, world.readings.y)}: WIND FROM ${D.windOct} ${D.windKn} KN · WATER ${D.temp}° · SURFACE ${D.surfKn.toFixed(1)} KN · DEEP ${D.deepKn.toFixed(1)} KN` : 'NO BUOY READING · DROP A BUOY AND POWER THE CURRENTS');
  const storms = stormsAt(world, world.t);
  items.push(storms.length ? storms.map(st => 'STORM OVER ' + gridRef(st.x, st.y)).join(' · ') : 'SKIES CLEAR OVER THE FIFTH');
  items.push(world.shark.mode === 'hunt' ? 'THE GRINDMAW IS SWIMMING FOR ' + gridRef(world.lastPing.x, world.lastPing.y) : 'THE GRINDMAW IS IN ' + gridRef(world.shark.x, world.shark.y));
  items.push(`RUNE BOARD PAGE ${BOARD_PAGES[world.board.page]} · FLIPS IN ${Math.max(0, Math.ceil(world.board.nextFlip - world.t))} S`);
  const br = brokenList(world); if (br.length) items.push('BROKEN: ' + br.map(x => x.name).join(', '));
  if (world.fatigue > 0.6) items.push('THE OPERATOR IS NODDING OFF · COFFEE ADVISED');
  return items.join(' &nbsp;✦&nbsp; ') + ' &nbsp;✦&nbsp; ';
}
function drawTicker(dt) {
  const el = $('tickertext');
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
  $('stage').classList.toggle('night', world.lamps === 1); $('stage').classList.toggle('redlamp', world.lamps === 2);
  $('clock').textContent = fmt(world.t);
  $('btn-buoy').classList.toggle('armed', ui.buoyMode);
}

// ---------- events ----------
const camName = id => world.cams.find(c => c.id === id).name;
function handleEvents() {
  for (const e of world.events) {
    switch (e.type) {
      case 'deny': audio.sfx.deny(); toast(e.msg); break;
      case 'ignite': audio.sfx.ignite(); audio.setHum(1); break;
      case 'stoke': audio.sfx.stoke(); break;
      case 'blowout': audio.sfx.blowout(); audio.setHum(0); toast('THE FURNACE BLEW OUT · EVERYTHING IS DARK'); break;
      case 'furnaceout': audio.sfx.buoydead(); audio.setHum(0); toast('THE FURNACE HAS GONE OUT · RELIGHT IT'); break;
      case 'brownout': audio.sfx.clunk(); toast(`NOT ENOUGH HEAT · ${e.sys.toUpperCase()} SHUT DOWN`); break;
      case 'power': audio.sfx.clunk(); break;
      case 'buoy': audio.sfx.buoy(); break;
      case 'ping': audio.sfx.ping(); break;
      case 'echo': audio.sfx.echo(); toast(e.n ? `ECHO RETURNED · ${e.n} CONTACT${e.n > 1 ? 'S' : ''}` : 'ECHO RETURNED · NOTHING THERE', 'info'); break;
      case 'lock': audio.sfx.lock(); break;
      case 'rune': audio.sfx.rune(); break;
      case 'runefail': audio.sfx.runefail(); break;
      case 'calibrated': audio.sfx.calibrated(); toast('SCANNER CALIBRATED', 'info'); break;
      case 'scandone': audio.sfx.scandone(); break;
      case 'launch': audio.sfx.launch(); break;
      case 'hit': audio.sfx.hit(); if (e.color !== 'green') toast(`BEACON STRUCK ICEBERG #${e.num}`, 'info'); break;
      case 'greenwrong': toast(`GREEN BEACON STRUCK #${e.num} · NOTHING ANSWERS`); break;
      case 'reveal': audio.sfx.reveal(); toast(`GREEN BEACON STRUCK #${e.num} · THE ICE IS BLAZING BLUE`, 'info'); break;
      case 'miss': audio.sfx.miss(); toast(`MISSED #${e.num}${e.by != null ? ' BY ' + e.by + ' MI' : ''} · SEE THE LAUNCHER REPORT ▲`); break;
      case 'sharkhunt': audio.sfx.sharkhunt(); toast('THE GRINDMAW HEARD THE PING · IT IS COMING'); break;
      case 'buoydead': audio.sfx.buoydead(); break;
      case 'remorhaz': if (world.activeCam === e.cam) audio.sfx.remorhaz(); break;
      case 'camdead': audio.sfx.camdead(); toast(`${camName(e.cam)} CAMERA DESTROYED`); break;
      case 'repairstart': audio.sfx.click(); toast('REPAIR CREW SENT', 'info'); break;
      case 'repaired': audio.sfx.repaired(); toast((world.cams.find(c => c.id === e.id) ? camName(e.id) + ' CAMERA' : BREAKABLE[e.id]) + ' REPAIRED', 'info'); break;
      case 'broke': audio.sfx.camdead(); if (e.sys === 'launcher') toast('THE BEACON LAUNCHER JAMMED · REPAIR BAY ▲'); if (e.sys === 'fuse') toast('THE RADIO FUSE BLEW · REPAIR BAY ▲'); if (e.sys === 'winch') toast('THE GRINDMAW TORE THE WINCH CABLE · REPAIR BAY ▲'); if (e.sys === 'furnace') toast('THE GRATE CRACKED · REPAIR BAY ▲'); break;
      case 'detune': audio.sfx.runefail(); toast('THE WATER HAS CHANGED · THE SCANNER HAS DRIFTED OUT OF TUNE'); break;
      case 'flip': audio.sfx.flip(); break;
      case 'tracked': audio.sfx.lock(); toast(`CAMERA TRACKING #${e.num} · DRIFT MEASURED · NO BUOY NEEDED`, 'info'); break;
      case 'camunlocked': audio.sfx.calibrated(); toast(camName(e.cam) + ' CAMERA UNLOCKED FOR 2 MINUTES', 'info'); break;
      case 'camfail': audio.sfx.runefail(); break;
      case 'plate': case 'lever': audio.sfx.click(); break;
      case 'paused': audio.sfx.bell(); break;
      case 'resumed': audio.sfx.click(); break;
      case 'fuel': audio.sfx.fuel(); break;
      case 'turn': audio.sfx.turn(); break;
      case 'brew': audio.sfx.coffee(); toast('THE COFFEE IS ON', 'info'); break;
      case 'brewed': audio.sfx.lamps(); toast('COFFEE IS READY · CLICK THE MUG', 'info'); break;
      case 'sip': audio.sfx.click(); break;
      case 'vent': audio.sfx.vent(); toast('FURNACE VENTED', 'info'); break;
      case 'wipers': { const wp = $('wiper'); wp.classList.remove('go'); void wp.offsetWidth; wp.classList.add('go'); audio.sfx.wipers(); break; }
      case 'wireless': audio.setMusic(e.on); toast(e.on ? 'THE CABIN WIRELESS IS PLAYING' : 'THE CABIN WIRELESS IS OFF', 'info'); break;
      case 'lamps': audio.sfx.lamps(); break;
      case 'bell': audio.sfx.bell(); break;
      case 'dud': audio.sfx.clunk(); break;
      case 'spark': audio.sfx.spark(); break;
      case 'win': audio.sfx.win(); $('wintime').textContent = 'Marked at ' + fmt(world.t) + ' on the watch clock.'; $('winscreen').classList.remove('hidden'); break;
    }
  }
  world.events.length = 0;
}
$('wincontinue').onclick = () => $('winscreen').classList.add('hidden');
$('ping').onclick = () => ping(world);

// ---------- GM link ----------
const gmChan = 'BroadcastChannel' in window ? new BroadcastChannel('lastwatch-gm:' + location.pathname.replace(/[^/]*$/, '')) : null;
if (gmChan) gmChan.onmessage = ev => {
  const m = ev.data || {};
  if (m.cmd === 'reset') { const u = new URL(location.href); u.searchParams.set('seed', m.seed || newSeed()); location.href = u.toString(); }
  else if (m.cmd) gm(world, m.cmd, m.arg || {});
  if (m.note) note(m.note);
  if (m.ticker) ui.tickerQ.push(String(m.ticker).toUpperCase());
};
let lastSnap = 0;

// ---------- loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  while (acc >= DT) { step(world, DT); acc -= DT; }
  handleEvents();
  drawMap(); drawCamera(); drawCurrents(); drawSonar(); drawEcho(); drawRadio(); drawScanner(); drawLock(); drawPower(); drawBoard(); drawRepairBay(); drawCamCtl(); $('pausecard').classList.toggle('hidden', !world.paused); $('pausebtn').textContent = world.paused ? '▶ RESUME' : '❚❚ PAUSE'; drawTicker(Math.min(0.1, (now - (frame.prev || now)) / 1000)); frame.prev = now;
  if (gmChan && now - lastSnap > 500) { lastSnap = now; gmChan.postMessage({ snap: snapshot(world) }); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__world = world;
// debug hooks for automated playthroughs
window.__dbg = { step: secs => { for (let i = 0; i < secs / DT; i++) step(world, DT); }, selectContact };
