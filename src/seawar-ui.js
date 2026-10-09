// The Fleet Officer prototype page: draws the shared sea and takes the orders. The rules live in seawar.js.
import * as SEA from './seawar.js';
import { glyphSVG } from './glyphs.js';
import * as audio from './audio.js';

const { SW } = SEA;
const $ = id => document.getElementById(id);
const C = 48, O = 38, N = SW.N;
const CREW_COL = { fleet: '#c9a24b', gunnery: '#d9573f', signals: '#5b9bd5', engineer: '#5cbf7a' };
const CREW_NAME = { fleet: 'FLEET OFFICER', gunnery: 'GUNNERY', signals: 'SIGNALS', engineer: 'ENGINEERING' };
let sea, sel = null, mode = 'fire', pendingToken = null, broadDir = 'h', paused = false, last = performance.now();

function start() {
  sea = SEA.newSea(Math.floor(Math.random() * 1e9));
  sel = sea.ours[0].id; mode = 'fire'; pendingToken = null;
  $('over').classList.add('hidden');
  buildDepts(); draw();
}

// ---------- flags and runes ----------
function flagSVG(f, w = 54, h = 34) {
  const box = `<rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="#000" stroke-width="1"/>`;
  const d = {
    0: `<rect width="${w}" height="${h}" fill="#d22"/>`,
    1: `<rect width="${w}" height="${h}" fill="#fff"/><rect x="${w / 2 - 5}" width="10" height="${h}" fill="#236"/><rect y="${h / 2 - 5}" width="${w}" height="10" fill="#236"/>`,
    2: `<rect width="${w}" height="${h}" fill="#fff"/>` + [0, 1, 2, 3].flatMap(i => [0, 1].map(j => `<rect x="${i * w / 4}" y="${j * h / 2}" width="${w / 4}" height="${h / 2}" fill="${(i + j) % 2 ? '#111' : '#fff'}"/>`)).join(''),
    3: `<polygon points="0,0 ${w},${h / 2} 0,${h}" fill="#f2c21e" stroke="#000"/>`,
    4: `<polygon points="0,0 ${w},0 ${w * 0.7},${h / 2} ${w},${h} 0,${h}" fill="#fff" stroke="#000"/>`,
    5: `<rect width="${w}" height="${h}" fill="#f2c21e"/><circle cx="${w / 2}" cy="${h / 2}" r="${h / 3}" fill="#111"/>`,
    6: `<rect width="${w}" height="${h}" fill="#fff"/>` + [0, 2, 4].map(i => `<rect y="${i * h / 5}" width="${w}" height="${h / 5}" fill="#d22"/>`).join(''),
    7: `<rect width="${w}" height="${h}" fill="#fff"/><rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="#236"/>`,
  }[f];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${d}${f === 3 || f === 4 ? '' : box}</svg>`;
}
const rune = (i, s = 20, col = '#e8dfc6') => glyphSVG(i, s, col, 1.2);

function buildCodebook() {
  $('codebook').innerHTML = '<tr><th>FLAG</th><th>TOP</th><th>MIDDLE</th><th>BOTTOM</th></tr>' +
    SEA.FLAGS.map((name, f) => `<tr><td style="text-align:left">${flagSVG(f, 30, 19)} <span class="hint">${name}</span></td>${[0, 1, 2].map(p => `<td>${rune(SEA.CODEBOOK[p][f], 18)}</td>`).join('')}</tr>`).join('');
}

const entry = { gunnery: [], signals: [], engineer: [] }, shell = { gunnery: 'broadside' };
function buildDepts() {
  $('depts').innerHTML = ['gunnery', 'signals', 'engineer'].map(d => `<div class="panel dept" id="d-${d}">
    <h2 style="color:${CREW_COL[d]}">${CREW_NAME[d]} <span class="hint">· ${d === 'gunnery' ? 'special artillery' : d === 'signals' ? 'aerial scan' : 'repair party'}</span></h2>
    <div class="hint">On the officer's own station in the real game. Describe the flags to the Fleet Officer, then enter the runes they read back.</div>
    ${d === 'gunnery' ? `<div class="row">${Object.entries(SEA.SHELLS).map(([k, v]) => `<button data-shell="${k}">${v}</button>`).join('')}</div>` : ''}
    <div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start">
      <div class="hoist"></div>
      <div><div class="code"></div><div class="pad">${Array.from({ length: SEA.CODE_RUNES }, (_, i) => `<button data-r="${i}">${rune(i, 22)}</button>`).join('')}</div>
      <div class="row"><button data-back>⌫</button></div><div class="state"></div></div>
    </div></div>`).join('');
  for (const d of ['gunnery', 'signals', 'engineer']) {
    const el = $('d-' + d);
    el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      if (sea.dept[d].state !== 'flags') return;
      entry[d].push(+b.dataset.r); audio.sfx.click();
      if (entry[d].length === 3) {
        const r = SEA.enterCode(sea, d, entry[d], shell[d]);
        el.querySelector('.state').className = 'state ' + (r === 'loaded' ? 'ok' : 'bad');
        if (r === 'loaded') audio.sfx.calibrated(); else audio.sfx.deny();
        entry[d] = [];
      }
      draw();
    });
    el.querySelector('[data-back]').onclick = () => { entry[d].pop(); draw(); };
    el.querySelectorAll('[data-shell]').forEach(b => b.onclick = () => { shell[d] = b.dataset.shell; draw(); });
  }
}

// ---------- the board ----------
const px = x => O + x * C, py = y => O + y * C;
function cellFromEvent(e) {
  const svg = $('board'), r = svg.getBoundingClientRect(), k = 570 / r.width;
  const x = Math.floor(((e.clientX - r.left) * k - O) / C), y = Math.floor(((e.clientY - r.top) * k - O) / C);
  return x >= 0 && y >= 0 && x < N && y < N ? [x, y] : null;
}
function shipRect(s, col, o = {}) {
  const [x0, y0] = [px(s.x), py(s.y)], w = (s.dir === 'h' ? s.len : 1) * C, h = (s.dir === 'v' ? s.len : 1) * C;
  return `<rect x="${x0 + 5}" y="${y0 + 5}" width="${w - 10}" height="${h - 10}" rx="16" fill="${o.fill || col}" fill-opacity="${o.op ?? 0.9}" stroke="${o.stroke || '#000'}" stroke-width="${o.sw || 1.5}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''}/>`;
}
function draw() {
  const vis = SEA.vision(sea, 'ours'), seen = SEA.seenEnemies(sea);
  let b = `<rect width="570" height="570" fill="#0a1418"/>`;
  // water, home waters, grid labels
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const home = y >= N - SW.home ? '#12302a' : y < SW.home ? '#2a1414' : '#0f2430';
    b += `<rect x="${px(x)}" y="${py(y)}" width="${C}" height="${C}" fill="${home}" stroke="#1d3a44" stroke-width="1"/>`;
  }
  for (let i = 0; i < N; i++) b += `<text x="${px(i) + C / 2}" y="26" fill="#9aa59c" font-size="13" text-anchor="middle">${SEA.colName(i)}</text><text x="20" y="${py(i) + C / 2 + 5}" fill="#9aa59c" font-size="13" text-anchor="middle">${i + 1}</text>`;
  // our old shots: hits, misses, ice, fading with age
  for (const [k, v] of sea.ourShots) {
    const [x, y] = k.split(',').map(Number), a = Math.max(0.25, 1 - (sea.beat - v.beat) / SW.fade), cx = px(x) + C / 2, cy = py(y) + C / 2;
    if (v.r === 'hit') b += `<path d="M${cx - 11} ${cy - 11}L${cx + 11} ${cy + 11}M${cx + 11} ${cy - 11}L${cx - 11} ${cy + 11}" stroke="#ff6a2a" stroke-width="4" opacity="${a}"/>`;
    else b += `<circle cx="${cx}" cy="${cy}" r="5" fill="${v.r === 'ice' ? '#bfe8ff' : '#e8dfc6'}" opacity="${a * 0.8}"/>`;
  }
  // glaciers
  for (const g of sea.glaciers) for (const [x, y] of g.cells) b += `<rect x="${px(x) + 4}" y="${py(y) + 4}" width="${C - 8}" height="${C - 8}" rx="9" fill="#cfe6ef" stroke="#7fb3c8" stroke-width="2"/><path d="M${px(x) + 12} ${py(y) + 30}l8 -10l7 6l8 -12" stroke="#7fb3c8" stroke-width="2" fill="none"/>`;
  // enemy ships we can see
  for (const s of seen) {
    b += shipRect(s, '#7a1d14', { stroke: s.marked ? '#ffb347' : '#ff6a4a', sw: s.marked ? 4 : 2.5, op: 0.85 });
    SEA.cellsOf(s).forEach((c, i) => { if (s.hits.has(i)) b += `<circle cx="${px(c[0]) + C / 2}" cy="${py(c[1]) + C / 2}" r="8" fill="#ff6a2a"/>`; });
  }
  // fog over what our ships cannot see (the bottom home waters are always ours)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!vis.has(x + ',' + y) && !(sea.flare && Math.abs(x - sea.flare.x) <= 1 && Math.abs(y - sea.flare.y) <= 1)) b += `<rect x="${px(x)}" y="${py(y)}" width="${C}" height="${C}" fill="#05090b" fill-opacity="0.42"/>`;
  if (sea.flare) b += `<rect x="${px(sea.flare.x - 1)}" y="${py(sea.flare.y - 1)}" width="${3 * C}" height="${3 * C}" fill="#ffe28a" fill-opacity="0.12" stroke="#ffe28a" stroke-dasharray="6 4"/>`;
  // enemy shells that splashed near us
  for (const [k, v] of sea.theirShots) {
    const [x, y] = k.split(',').map(Number); if (sea.beat - v.beat > 1) continue;
    b += `<circle cx="${px(x) + C / 2}" cy="${py(y) + C / 2}" r="15" fill="none" stroke="${v.r === 'hit' ? '#ff3b1f' : '#9fd0ff'}" stroke-width="2.5"/>`;
  }
  // our ships
  for (const s of sea.ours) {
    const dead = SEA.sunk(s), col = CREW_COL[s.crew];
    b += shipRect(s, col, { fill: dead ? '#3a3a3a' : col, stroke: s.id === sel ? '#fff' : '#000', sw: s.id === sel ? 3 : 1.5 });
    SEA.cellsOf(s).forEach((c, i) => { if (s.hits.has(i)) b += `<circle cx="${px(c[0]) + C / 2}" cy="${py(c[1]) + C / 2}" r="9" fill="#ff3b1f" stroke="#ffd36a" stroke-width="2"/>`; });
    const [cx, cy] = SEA.cellsOf(s)[0];
    b += `<text x="${px(cx) + 14}" y="${py(cy) + 29}" fill="#111" font-size="15" font-weight="700">${sea.ours.indexOf(s) + 1}</text>`;
  }
  // scans
  for (const sc of sea.scans) b += `<rect x="${px(sc.x - 1)}" y="${py(sc.y - 1)}" width="${3 * C}" height="${3 * C}" fill="none" stroke="#5b9bd5" stroke-width="3" stroke-dasharray="8 5"/><text x="${px(sc.x) + C / 2}" y="${py(sc.y) + C / 2 + 12}" fill="#9fd0ff" font-size="34" font-weight="700" text-anchor="middle">${sc.n}</text>`;
  // this beat's orders
  for (const [id, o] of sea.orders) {
    const s = sea.ours.find(x => x.id === id), n = sea.ours.indexOf(s) + 1, col = CREW_COL[s.crew];
    if (o.type === 'fire' || o.type === 'special') {
      const cx = px(o.x) + C / 2, cy = py(o.y) + C / 2, tk = o.type === 'special' && sea.tokens.find(t => t.id === o.token);
      const area = tk && (tk.kind === 'scan' || tk.kind === 'starshell') ? 1 : 0;
      if (tk && tk.kind === 'broadside') for (let i = -1; i <= 1; i++) { const [x, y] = o.dir === 'v' ? [o.x, o.y + i] : [o.x + i, o.y]; b += `<circle cx="${px(x) + C / 2}" cy="${py(y) + C / 2}" r="13" fill="none" stroke="${col}" stroke-width="3"/>`; }
      if (area) b += `<rect x="${px(o.x - 1)}" y="${py(o.y - 1)}" width="${3 * C}" height="${3 * C}" fill="none" stroke="${col}" stroke-width="3" stroke-dasharray="4 4"/>`;
      b += `<circle cx="${cx}" cy="${cy}" r="15" fill="none" stroke="${col}" stroke-width="3"/><path d="M${cx} ${cy - 21}V${cy + 21}M${cx - 21} ${cy}H${cx + 21}" stroke="${col}" stroke-width="2"/><text x="${cx + 16}" y="${cy - 12}" fill="${col}" font-size="14" font-weight="700">${n}</text>`;
    } else b += shipRect(SEA.moved(s, o), col, { op: 0.15, dash: '6 5', stroke: col, sw: 2.5 });
  }
  $('board').innerHTML = b;
  panels(seen);
}

function panels(seen) {
  const battle = sea.phase === 'battle';
  $('phase').textContent = sea.phase === 'deploy' ? 'DEPLOY THE FLEET' : battle ? `WAVE ${sea.wave} · BEAT ${sea.beat + 1}` : 'THE FLEET IS LOST';
  $('deploybtns').style.display = sea.phase === 'deploy' ? '' : 'none';
  $('battlebtns').style.display = battle ? '' : 'none';
  const left = Math.max(0, sea.nextBeat - sea.t);
  $('beatline').textContent = battle ? `Both fleets act in ${Math.ceil(left)} s${paused ? ' (PAUSED)' : ''}. ${sea.orders.size} of ${sea.ours.filter(s => !SEA.sunk(s)).length} ships have orders.` : sea.phase === 'deploy' ? 'Place each ship in our home waters (the bottom three rows), then BEGIN.' : '';
  $('beatbar').firstElementChild.style.width = battle ? (100 * (1 - left / SW.beat)) + '%' : '0';
  const s = sea.ours.find(x => x.id === sel);
  $('selname').innerHTML = s ? `<b style="color:${CREW_COL[s.crew]}">${sea.ours.indexOf(s) + 1} · ${s.name}</b> <span class="hint">(${CREW_NAME[s.crew]} · ${s.len} long · ${SEA.sunk(s) ? 'SUNK' : s.hits.size ? s.hits.size + ' hole' + (s.hits.size > 1 ? 's' : '') : 'sound'})</span>${pendingToken ? ' · <b>pick a square for the special</b>' + (pendingToken.kind === 'broadside' ? ` (R turns the line: ${broadDir === 'h' ? 'across' : 'down'})` : '') : ''}` : 'Click one of our ships (or press 1–4).';
  document.querySelectorAll('#orderbtns button').forEach(x => x.disabled = !battle || !s || SEA.sunk(s));
  const th = sea.tokens.length ? 'SPECIALS READY: ' + sea.tokens.map(t => `<button data-token="${t.id}" class="${pendingToken && pendingToken.id === t.id ? 'on' : ''}" ${battle && s && !SEA.sunk(s) ? '' : 'disabled'}>${t.kind === 'scan' ? 'AERIAL SCAN' : t.kind === 'repair' ? 'REPAIR PARTY' : SEA.SHELLS[t.kind]}</button>`).join('') : '<span class="hint">No specials loaded. The departments load them with the flag code.</span>';
  if ($('tokens').innerHTML !== th) $('tokens').innerHTML = th;
  $('tokens').querySelectorAll('[data-token]').forEach(btn => btn.onclick = () => { pendingToken = sea.tokens.find(t => t.id === btn.dataset.token); draw(); });
  $('orders').innerHTML = sea.ours.map((x, i) => { const o = sea.orders.get(x.id); return `<div style="color:${SEA.sunk(x) ? '#666' : CREW_COL[x.crew]}">${i + 1} ${x.name}: ${SEA.sunk(x) ? 'SUNK' : !o ? '<span class="hint">no order (holds fire)</span>' : o.type === 'fire' ? 'FIRE AT ' + SEA.colName(o.x) + (o.y + 1) : o.type === 'move' ? 'MOVE ' + ({ '0,-1': 'NORTH', '0,1': 'SOUTH', '-1,0': 'WEST', '1,0': 'EAST' })[o.dx + ',' + o.dy] : o.type === 'turn' ? 'TURN' : 'SPECIAL AT ' + SEA.colName(o.x) + (o.y + 1)}</div>`; }).join('');
  $('log').innerHTML = sea.log.map(l => `<div><span class="hint">${l.beat}</span> ${l.text}</div>`).join('');
  for (const d of ['gunnery', 'signals', 'engineer']) {
    const el = $('d-' + d), st = sea.dept[d]; if (!el) continue;
    el.querySelector('.hoist').innerHTML = st.state === 'flags' ? st.flags.map(f => flagSVG(f)).join('') : `<div class="hint" style="width:54px;height:110px;display:flex;align-items:center;justify-content:center;border:1px dashed #333">${st.state === 'loaded' ? 'LOADED' : Math.ceil(st.readyAt - sea.t) + ' s'}</div>`;
    el.querySelector('.code').innerHTML = entry[d].map(r => rune(r, 24, '#ffd36a')).join('') + '<span class="hint">' + '·'.repeat(3 - entry[d].length) + '</span>';
    const sEl = el.querySelector('.state'); if (st.state !== 'flags' || !sEl.classList.contains('bad')) sEl.className = 'state' + (st.state === 'loaded' ? ' ok' : '');
    sEl.textContent = st.state === 'flags' ? (sEl.classList.contains('bad') ? 'That code does not match. Check the flags again.' : 'Flags hoisted: read them out.') : st.state === 'loaded' ? 'Loaded: the Fleet Officer can fire it.' : 'Fired. New flags soon.';
    el.querySelectorAll('[data-shell]').forEach(x => x.classList.toggle('on', shell[d] === x.dataset.shell));
  }
  $('help').innerHTML = sea.phase === 'deploy' ? 'Click a ship, then click where its first square goes. R turns it. RANDOM places them all.' :
    'Click our ship, then click any square to <b>fire</b> at it. Arrow keys or ↑↓←→ to <b>move</b>, T to <b>turn</b>. A special: pick it, then click its square. Each ship gets one order a beat; both fleets act together.';
  if (sea.phase === 'lost') { $('over').classList.remove('hidden'); $('overtext').textContent = `You held for ${sea.wave - 1} wave${sea.wave === 2 ? '' : 's'}.`; }
}

// ---------- input ----------
$('board').addEventListener('click', e => {
  const c = cellFromEvent(e); if (!c) return;
  const [x, y] = c, own = SEA.shipAt(sea.ours, x, y) || sea.ours.find(s => SEA.cellsOf(s).some(q => q[0] === x && q[1] === y));
  if (sea.phase === 'deploy') {
    if (own) { sel = own.id; draw(); return; }
    const s = sea.ours.find(q => q.id === sel); if (s && SEA.deploy(sea, s.id, x, y, s.dir)) audio.sfx.click(); else audio.sfx.deny();
    draw(); return;
  }
  if (sea.phase !== 'battle') return;
  if (pendingToken) {
    if (pendingToken.kind === 'repair' && !own) { audio.sfx.deny(); return; }
    SEA.setOrder(sea, sel, { type: 'special', token: pendingToken.id, x, y, dir: broadDir }); pendingToken = null; audio.sfx.click(); draw(); return;
  }
  if (own && !SEA.sunk(own)) { sel = own.id; draw(); return; }
  if (SEA.setOrder(sea, sel, { type: 'fire', x, y })) audio.sfx.click();
  draw();
});
document.querySelectorAll('[data-move]').forEach(b => b.onclick = () => { const [dx, dy] = b.dataset.move.split(',').map(Number); SEA.setOrder(sea, sel, { type: 'move', dx, dy }); draw(); });
document.querySelector('[data-turn]').onclick = () => { SEA.setOrder(sea, sel, { type: 'turn' }); draw(); };
document.querySelector('[data-clear]').onclick = () => { SEA.setOrder(sea, sel, null); pendingToken = null; draw(); };
document.querySelector('[data-mode]').onclick = () => { pendingToken = null; draw(); };
$('turnd').onclick = () => { const s = sea.ours.find(q => q.id === sel); if (s) SEA.deploy(sea, s.id, s.x, s.y, s.dir === 'h' ? 'v' : 'h') || audio.sfx.deny(); draw(); };
$('random').onclick = () => { sea.ours = SEA.newSea(Math.floor(Math.random() * 1e9)).ours; sel = sea.ours[0].id; draw(); };
$('begin').onclick = () => { audio.unlock && audio.unlock(); SEA.begin(sea); audio.sfx.alarm(); draw(); };
$('ready').onclick = () => { if (sea.phase === 'battle') { handle(SEA.ready(sea)); draw(); } };
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'RESUME' : 'PAUSE'; };
$('newgame').onclick = start; $('again').onclick = start;
$('enemy').oninput = e => { SW.enemyFire = +e.target.value; $('enemyval').textContent = Math.round(SW.enemyFire * 100) + '%'; };
$('beatlen').oninput = e => { SW.beat = +e.target.value; $('beatval').textContent = SW.beat + ' s'; if (sea.phase === 'battle') sea.nextBeat = Math.min(sea.nextBeat, sea.t + SW.beat); };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key;
  if (/^[1-4]$/.test(k)) { const s = sea.ours[+k - 1]; if (s) { sel = s.id; pendingToken = null; draw(); } return; }
  if (k === 'r' || k === 'R') { if (sea.phase === 'deploy') $('turnd').onclick(); else { broadDir = broadDir === 'h' ? 'v' : 'h'; draw(); } return; }
  if (sea.phase !== 'battle') return;
  const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[k];
  if (mv) { e.preventDefault(); SEA.setOrder(sea, sel, { type: 'move', dx: mv[0], dy: mv[1] }); draw(); }
  if (k === 't' || k === 'T') { SEA.setOrder(sea, sel, { type: 'turn' }); draw(); }
  if (k === 'f' || k === 'F') { pendingToken = null; draw(); }
  if (k === 'Enter') { e.preventDefault(); handle(SEA.ready(sea)); draw(); }
});

function handle(ev) {
  for (const e of ev) {
    if (e.type === 'hit') (e.side === 'theirs' ? audio.sfx.hit : audio.sfx.blowout)();
    if (e.type === 'sunk') e.side === 'theirs' ? audio.sfx.reveal() : audio.sfx.camdead();
    if (e.type === 'wave') audio.sfx.win();
  }
  if (ev.length || sea.phase === 'battle') { if (!sea.ours.find(s => s.id === sel && !SEA.sunk(s))) { const a = sea.ours.find(s => !SEA.sunk(s)); sel = a ? a.id : null; } }
}
function loop() {
  const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
  if (!paused) { const ev = SEA.tick(sea, dt); if (ev.length) handle(ev); }
  draw();
}
buildCodebook(); start(); setInterval(loop, 250);
