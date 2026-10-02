import {
  createWorld, newSeed, step, light, stoke, slotsAvailable, setPower, isUp, selectCam, deployBuoy, ping, lockContact, lockFromCamera,
  setDrift, ghostAt, lockedBerg, alignment, pressKey, setFreq, setGain, setMusic, radioSignal, fireBeacon, readingDisplay,
  startRepair, badRepair, gm, cameraView, snowAt, stormsAt, dist, snapshot, SYSTEMS, DT,
} from './sim.js';
import { MAP, CENTER, OBSERVATORY, REACH, ISLAND_R, GRID, CELL, TOMB_RADIUS, TUNING as T } from './scenario.js';
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
  music: false, lamps: 0,
  camHits: [],
  repair: {},              // camId -> board
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
function note(text) { const n = $('note'); n.textContent = text; n.classList.remove('hidden'); audio.sfx.buoy(); }
$('note').onclick = () => $('note').classList.add('hidden');

// ---------- intro / sound ----------
$('begin').onclick = () => { audio.unlock(); $('intro').classList.add('hidden'); audio.sfx.click(); };
function toggleMute() { audio.setMuted(!audio.isMuted()); $('mute').textContent = audio.isMuted() ? 'SOUND OFF' : 'SOUND ON'; }
$('mute').onclick = toggleMute;
addEventListener('keydown', e => { if ((e.key === 'm' || e.key === 'M') && e.target.tagName !== 'INPUT') toggleMute(); });

// ---------- furnace & power ----------
$('ignite').onclick = () => light(world);
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

// ---------- repair board ----------
function makeBoard() {
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const r = Math.random;
    rows.push({ sheath: ['brass', 'iron', 'porcelain'][Math.floor(r() * 3)], frost: r() < 0.4, star: r() < 0.35, lit: r() < 0.55, set: null });
  }
  return { rows, lockUntil: 0 };
}
function correctAction(row) {
  if (!row.lit && row.sheath === 'porcelain') return 'CUT';
  if (row.frost && row.star) return 'SHUT';
  if (row.sheath === 'iron' && !row.frost) return 'OPEN';
  if (row.sheath === 'brass') return row.lit ? 'OPEN' : 'SHUT';
  return 'SHUT';
}
function renderBoard(cam) {
  const el = $('repairboard');
  if (cam.repair) {
    const left = Math.ceil(cam.repair - world.t);
    el.innerHTML = `<div class="rb-title">REPAIR SLED EN ROUTE</div><div class="rb-sub">${cam.name} back online in ${left}s</div>`;
    el.dataset.cam = ''; return;
  }
  let b = ui.repair[cam.id]; if (!b) b = ui.repair[cam.id] = makeBoard();
  if (el.dataset.cam === cam.id && el.dataset.ver === String(b.ver || 0)) return;
  el.dataset.cam = cam.id; el.dataset.ver = String(b.ver || 0);
  el.innerHTML = `<div class="rb-title">${cam.name}: CAMERA DESTROYED</div>
    <div class="rb-sub">Set every conduit, then dispatch the repair sled. The Operations Manual knows the rules.</div>
    <div class="rb-rows">${b.rows.map((r, i) => `
      <div class="rb-row"><b>${i + 1}</b>
        <div class="sheath ${r.sheath}" style="${r.frost ? 'background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.75) 0 2px,transparent 2px 5px),' + (r.sheath === 'brass' ? 'linear-gradient(#e2c27f,#8b6b3d)' : r.sheath === 'iron' ? 'linear-gradient(#777,#333)' : 'linear-gradient(#fff,#c9c4b8)') : ''}"></div>
        <span>${r.star ? '★ star' : ''}</span><span>${r.frost ? 'frost' : ''}</span>
        <span class="lamp ${r.lit ? 'on' : 'off'}" style="width:14px;height:14px"></span>
        <div class="act">${['OPEN', 'SHUT', 'CUT'].map(a => `<button data-i="${i}" data-a="${a}" class="${r.set === a ? 'sel' : ''}">${a}</button>`).join('')}</div>
      </div>`).join('')}</div>
    <button class="rb-go">DISPATCH REPAIR SLED</button>`;
  el.querySelectorAll('.act button').forEach(btn => btn.onclick = () => { b.rows[+btn.dataset.i].set = btn.dataset.a; b.ver = (b.ver || 0) + 1; audio.sfx.click(); });
  el.querySelector('.rb-go').onclick = () => {
    if (world.t < b.lockUntil) return;
    const wrong = b.rows.filter(r => r.set !== correctAction(r));
    if (!wrong.length) { startRepair(world, cam.id); delete ui.repair[cam.id]; el.dataset.ver = ''; }
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
    const rr = (12 + (t - l.t0) * 0.5) * z + 6;
    ctx.strokeStyle = 'rgba(244,241,230,.5)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(pg.x, pg.y); ctx.stroke();
    ctx.setLineDash([5, 4]); ctx.strokeStyle = '#f4f1e6'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pg.x, pg.y, rr, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pg.x - 6, pg.y); ctx.lineTo(pg.x + 6, pg.y); ctx.moveTo(pg.x, pg.y - 6); ctx.lineTo(pg.x, pg.y + 6); ctx.stroke();
    ctx.strokeStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(p0.x - 4, p0.y - 4); ctx.lineTo(p0.x + 4, p0.y + 4); ctx.moveTo(p0.x + 4, p0.y - 4); ctx.lineTo(p0.x - 4, p0.y + 4); ctx.stroke();
    ctx.fillStyle = '#f4f1e6'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText('PREDICTED · ' + gridRef(g.x, g.y), pg.x + rr + 4, pg.y - 4);
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
  $('camname').textContent = cam.name + ' · ' + gridRef(cam.x, cam.y) + ' · facing ' + cam.facing + '°';
  const up = isUp(world, 'cameras');
  $('camoff').textContent = world.power.cameras.on ? 'WARMING UP' : 'NO POWER';
  $('camoff').classList.toggle('hidden', up);
  const rb = $('repairboard');
  if (up && cam.broken) { rb.classList.remove('hidden'); renderBoard(cam); } else { rb.classList.add('hidden'); rb.dataset.cam = ''; }
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
  const snow = Math.max(0, snowAt(world, cam.x, cam.y, t) - (t < ui.wipeUntil ? 0.8 : 0));
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
  $('radiooff').classList.toggle('hidden', up); $('radiooff').textContent = world.power.radio.on ? 'WARMING UP' : 'NO POWER';
  $('freq').textContent = world.radio.freq.toFixed(1);
  if (document.activeElement !== $('freqslider')) $('freqslider').value = world.radio.freq;
  if (document.activeElement !== $('gain')) $('gain').value = world.radio.gain;
  $('gainval').textContent = world.radio.gain.toFixed(1);
  $('radiosrc').textContent = world.music ? 'cabin wireless is ON' : 'tuned to the locked target';
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
    ctx.fillText(sig.clip ? 'CLIPPING · LOWER THE GAIN' : sig.strength > 0.75 && !sig.lamps ? 'MATCH THE GAIN TO THE BRASS LINES' : !lockedBerg(world) && !world.music ? 'NO TARGET LOCKED' : '', 6, 12);
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
  const ang = -Math.PI + a * Math.PI + Math.sin(world.t * 13) * 0.01;
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

// ---------- lock & beacon ----------
document.querySelectorAll('#drift button').forEach(b => b.onclick = () => setDrift(world, b.dataset.v));
for (const [k, v] of Object.entries(COLORS)) {
  const b = document.createElement('button'); b.className = 'col'; b.dataset.c = k; b.style.background = v;
  b.innerHTML = k === 'green' ? 'THIS IS<br>ELGARZ' : k.toUpperCase();
  b.onclick = () => { ui.color = k; audio.sfx.click(); };
  $('colors').appendChild(b);
}
$('fire').onclick = () => fireBeacon(world, ui.color);
function drawLock() {
  const l = world.lock, b = lockedBerg(world);
  $('locknum').textContent = b ? '#' + b.num : '--';
  const g = l && ghostAt(world, world.t);
  $('lockinfo').innerHTML = !l ? 'No lock. Click a sonar contact or an iceberg on camera.' :
    `Fix from <b>${l.source.toUpperCase()}</b>, <b>${ago(world.t - l.t0)}</b><br>Predicted in <b>${gridRef(g.x, g.y)}</b>${b.tag ? ` · tagged <b style="color:${COLORS[b.tag]}">${b.tag.toUpperCase()}</b>` : ''}`;
  document.querySelectorAll('#drift button').forEach(x => x.classList.toggle('sel', x.dataset.v === world.drift));
  const r = world.readings;
  $('driftinfo').innerHTML = !r ? 'No current reading yet. The prediction will not move.' : `Using the buoy reading from ${gridRef(r.x, r.y)}, ${ago(world.t - r.t)}.`;
  document.querySelectorAll('.col').forEach(x => x.classList.toggle('sel', x.dataset.c === ui.color));
  const green = ui.color === 'green', bc = world.beacons;
  $('fire').classList.toggle('green', green);
  $('fire').disabled = !l || (green ? bc.green <= 0 : bc.stock <= 0);
  $('fire').innerHTML = green ? `FIRE · ${bc.green} LEFT` : 'FIRE BEACON';
  const rack = $('rack'), key = bc.stock + '/' + bc.green;
  if (rack.dataset.n !== key) {
    rack.dataset.n = key;
    rack.innerHTML = Array.from({ length: T.beaconStock }, (_, i) => `<i class="${i < bc.stock ? '' : 'empty'}"></i>`).join('') + '<b></b>' +
      Array.from({ length: T.greenStock }, (_, i) => `<i class="g ${i < bc.green ? '' : 'empty'}"></i>`).join('');
  }
}

// ---------- cabin comforts (they move around) ----------
const COMFORTS = [
  { id: 'coffee', ico: '☕', label: 'COFFEE' },
  { id: 'wipers', ico: '⌒', label: 'WIPERS' },
  { id: 'music', ico: '♫', label: 'MUSIC' },
  { id: 'lamps', ico: '✺', label: 'LAMPS' },
  { id: 'bell', ico: '🔔', label: 'BELL' },
];
const slots = COMFORTS.map((_, i) => i);
COMFORTS.forEach((c, i) => {
  const b = document.createElement('button'); b.className = 'comfort'; b.id = 'cf-' + c.id; b.style.left = (i * 94) + 'px';
  b.innerHTML = `<span class="ico">${c.ico}</span>${c.label}`;
  b.onclick = () => { comfort(c.id); setTimeout(() => shuffleComforts(i), 500); };
  $('comforts').appendChild(b);
});
function shuffleComforts(i) {
  if (Math.random() < 0.35) return;
  let j = Math.floor(Math.random() * COMFORTS.length); if (j === i) j = (j + 1) % COMFORTS.length;
  [slots[i], slots[j]] = [slots[j], slots[i]];
  COMFORTS.forEach((c, k) => { $('cf-' + c.id).style.left = (slots[k] * 94) + 'px'; });
  audio.sfx.clunk();
}
function comfort(id) {
  if (id === 'coffee') { ui.brewing = true; audio.sfx.coffee(); }
  if (id === 'wipers') { ui.wipeUntil = world.t + 8; const w = $('wiper'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); audio.sfx.wipers(); }
  if (id === 'music') { ui.music = !ui.music; setMusic(world, ui.music); audio.setMusic(ui.music); audio.sfx.click(); }
  if (id === 'lamps') { ui.lamps = (ui.lamps + 1) % 3; $('stage').classList.toggle('warm', ui.lamps === 1); $('stage').classList.toggle('red', ui.lamps === 2); audio.sfx.lamps(); }
  if (id === 'bell') audio.sfx.bell();
}
$('mug').onclick = () => { if (ui.coffee > 0.1) { ui.coffee = Math.max(0, ui.coffee - 0.34); audio.sfx.click(); } };

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
  $('ignite').disabled = f.lit || cooling;
  $('ignite').textContent = cooling ? `COOLING ${Math.ceil(f.outUntil - world.t)}` : f.everLit ? 'RELIGHT' : 'LIGHT';
  $('stoke').disabled = !f.lit;
  const st = $('furnacestat');
  const msg = !f.lit ? (cooling ? 'BLOWN OUT · WAIT, THEN RELIGHT' : f.everLit ? 'THE FURNACE HAS GONE OUT · RELIGHT' : 'LIGHT THE FURNACE') :
    f.heat > 90 ? 'TOO HOT · DO NOT STOKE' : f.heat < T.slotHeat[0] ? 'LOW HEAT · STOKE THE FURNACE' : '';
  st.textContent = msg; st.classList.toggle('warn', !!msg && world.furnace.everLit);
  for (const c of world.cams) {
    const el = $('cb-' + c.id);
    el.classList.toggle('active', world.activeCam === c.id); el.classList.toggle('broken', c.broken);
    el.querySelector('.heat div').style.width = c.heat + '%';
    const tr = el.querySelector('.trem');
    tr.textContent = c.broken ? (c.repair ? 'REPAIRING' : 'DESTROYED') : c.tremor > 0 ? 'SHAKING' : 'STILL';
    tr.classList.toggle('on', c.tremor > 0 && !c.broken);
  }
  if (ui.brewing) { ui.coffee = Math.min(1, ui.coffee + 1 / 12 / 60); if (ui.coffee >= 1) ui.brewing = false; }
  $('mugfill').style.height = (ui.coffee * 100) + '%';
  $('mug').classList.toggle('hot', ui.coffee > 0.05);
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
      case 'miss': audio.sfx.miss(); toast('BEACON MISSED · IT FELL INTO THE SEA'); break;
      case 'sharkhunt': audio.sfx.sharkhunt(); toast('THE GRINDMAW HEARD THE PING · IT IS COMING'); break;
      case 'buoydead': audio.sfx.buoydead(); toast('THE GRINDMAW TOOK THE BUOY'); break;
      case 'remorhaz': if (world.activeCam === e.cam) audio.sfx.remorhaz(); break;
      case 'camdead': audio.sfx.camdead(); toast(`${camName(e.cam)} CAMERA DESTROYED`); break;
      case 'repairstart': audio.sfx.click(); toast('REPAIR SLED DISPATCHED', 'info'); break;
      case 'repaired': audio.sfx.repaired(); toast('CAMERA BACK ONLINE', 'info'); break;
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
  else if (m.cmd) gm(world, m.cmd);
  if (m.note) note(m.note);
};
let lastSnap = 0;

// ---------- loop ----------
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.25, (now - last) / 1000); last = now;
  while (acc >= DT) { step(world, DT); acc -= DT; }
  handleEvents();
  drawMap(); drawCamera(); drawCurrents(); drawSonar(); drawEcho(); drawRadio(); drawScanner(); drawLock(); drawPower();
  if (gmChan && now - lastSnap > 500) { lastSnap = now; gmChan.postMessage({ snap: snapshot(world) }); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.__world = world;
// debug hooks for automated playthroughs
window.__dbg = { step: secs => { for (let i = 0; i < secs / DT; i++) step(world, DT); }, selectContact };
