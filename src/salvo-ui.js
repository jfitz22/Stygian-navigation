// The Fleet Officer prototype, version 2 ("Salvo & Soundings"): draws both boards and takes the orders.
// The rules live in salvo.js.
import * as S from './salvo.js';
import { glyphSVG } from './glyphs.js';
import * as audio from './audio.js';

const { SV } = S;
const $ = id => document.getElementById(id);
const CREW_COL = { fleet: '#c9a24b', gunnery: '#d9573f', signals: '#5b9bd5', engineer: '#5cbf7a' };
const CREW_NAME = { fleet: 'FLEET OFFICER', gunnery: 'GUNNERY', signals: 'SIGNALS', engineer: 'ENGINEERING' };
let bt, sel = null, pending = null, soundDir = 'row', boostShip = null, paused = false, last = performance.now();

function start() {
  bt = S.newBattle(Math.floor(Math.random() * 1e9));
  sel = bt.ours.ships[0].id; pending = null; boostShip = null;
  $('over').classList.add('hidden');
  buildDepts(); draw();
}

// ---------- flags and runes (as in the first prototype) ----------
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
    S.FLAGS.map((name, f) => `<tr><td style="text-align:left">${flagSVG(f, 30, 19)} <span class="hint">${name}</span></td>${[0, 1, 2].map(p => `<td>${rune(S.CODEBOOK[p][f], 18)}</td>`).join('')}</tr>`).join('');
}
const entry = { gunnery: [], signals: [], engineer: [] }, bad = {};
function buildDepts() {
  const what = { gunnery: 'heavy shell · a 2 × 2 burst', signals: 'sounding · ship squares in a row or column', engineer: 'boost · one of our ships moves a square' };
  $('depts').innerHTML = ['gunnery', 'signals', 'engineer'].map(d => `<div class="panel dept" id="d-${d}">
    <h2 style="color:${CREW_COL[d]}">${CREW_NAME[d]} <span class="hint">· ${what[d]}</span></h2>
    <div class="hint">On the officer's own station in the real game. Describe the flags to the Fleet Officer, then enter the runes they read back.</div>
    <div style="display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start">
      <div class="hoist"></div>
      <div><div class="code"></div><div class="pad">${Array.from({ length: S.CODE_RUNES }, (_, i) => `<button data-r="${i}">${rune(i, 22)}</button>`).join('')}</div>
      <div class="row"><button data-back>⌫</button></div><div class="state"></div></div>
    </div></div>`).join('');
  for (const d of ['gunnery', 'signals', 'engineer']) {
    const el = $('d-' + d);
    el.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      if (bt.dept[d].state !== 'flags') return;
      entry[d].push(+b.dataset.r); audio.sfx.click(); bad[d] = false;
      if (entry[d].length === 3) { const r = S.enterCode(bt, d, entry[d]); bad[d] = r === 'wrong'; (r === 'loaded' ? audio.sfx.calibrated : audio.sfx.deny)(); entry[d] = []; }
      draw();
    });
    el.querySelector('[data-back]').onclick = () => { entry[d].pop(); draw(); };
  }
}

// ---------- the boards ----------
const geo = (W, M) => { const C = (W - M - 8) / SV.N; return { C, px: x => M + x * C, py: y => M + y * C }; };
const TH = geo(520, 40), OU = geo(350, 26);
function cellAt(svg, e, g, W) {
  const r = svg.getBoundingClientRect(), k = W / r.width, x = Math.floor(((e.clientX - r.left) * k - g.px(0)) / g.C), y = Math.floor(((e.clientY - r.top) * k - g.py(0)) / g.C);
  return x >= 0 && y >= 0 && x < SV.N && y < SV.N ? [x, y] : null;
}
function water(g, W, label) {
  let b = `<rect width="${W}" height="${W}" fill="#0a1418"/>`;
  for (let y = 0; y < SV.N; y++) for (let x = 0; x < SV.N; x++) b += `<rect x="${g.px(x)}" y="${g.py(y)}" width="${g.C}" height="${g.C}" fill="#0f2430" stroke="#1d3a44"/>`;
  if (label) for (let i = 0; i < SV.N; i++) b += `<text x="${g.px(i) + g.C / 2}" y="${g.py(0) - 10}" fill="#9aa59c" font-size="${label}" text-anchor="middle">${S.colName(i)}</text><text x="${g.px(0) - 14}" y="${g.py(i) + g.C / 2 + 5}" fill="#9aa59c" font-size="${label}" text-anchor="middle">${i + 1}</text>`;
  return b;
}
function glaciers(board, g) {
  let b = '';
  for (const gl of board.glaciers) {
    const x = g.px(gl.x), y = g.py(gl.y), c = g.C, cx = x + c / 2, cy = y + c / 2;
    b += `<rect x="${x + 3}" y="${y + 3}" width="${c - 6}" height="${c - 6}" rx="${c / 5}" fill="#cfe6ef" stroke="#7fb3c8" stroke-width="2"/>`;
    b += `<path d="M${cx} ${cy}l${gl.dx * c * 0.42} ${gl.dy * c * 0.42}" stroke="#2a6f8f" stroke-width="3"/><circle cx="${cx + gl.dx * c * 0.42}" cy="${cy + gl.dy * c * 0.42}" r="${c / 9}" fill="#2a6f8f"/>`;
  }
  return b;
}
const shipBox = (s, g, o = {}) => { const w = (s.dir === 'h' ? s.len : 1) * g.C, h = (s.dir === 'v' ? s.len : 1) * g.C; return `<rect x="${g.px(s.x) + 3}" y="${g.py(s.y) + 3}" width="${w - 6}" height="${h - 6}" rx="${g.C / 3}" fill="${o.fill || 'none'}" stroke="${o.stroke || '#000'}" stroke-width="${o.sw || 1.5}" ${o.dash ? `stroke-dasharray="${o.dash}"` : ''}/>`; };

function drawTheirs() {
  const g = TH; let b = water(g, 520, 14);
  // soundings: a band along the line, the count in the margin
  for (const sd of bt.soundings) {
    const row = sd.line === 'row';
    b += row ? `<rect x="${g.px(0)}" y="${g.py(sd.n)}" width="${g.C * SV.N}" height="${g.C}" fill="#5b9bd5" fill-opacity=".14"/>` : `<rect x="${g.px(sd.n)}" y="${g.py(0)}" width="${g.C}" height="${g.C * SV.N}" fill="#5b9bd5" fill-opacity=".14"/>`;
    b += `<circle cx="${row ? 14 : g.px(sd.n) + g.C / 2}" cy="${row ? g.py(sd.n) + g.C / 2 : 14}" r="12" fill="#5b9bd5"/><text x="${row ? 14 : g.px(sd.n) + g.C / 2}" y="${(row ? g.py(sd.n) + g.C / 2 : 14) + 5}" fill="#081018" font-size="14" font-weight="700" text-anchor="middle">${sd.count}</text>`;
  }
  b += glaciers(bt.theirs, g);
  for (const s of bt.theirs.ships) if (S.sunk(s)) b += shipBox(s, g, { fill: '#5a1a12', stroke: '#ff6a4a', sw: 2.5 });
  for (const [k, v] of bt.marks) {
    const [x, y] = k.split(',').map(Number), cx = g.px(x) + g.C / 2, cy = g.py(y) + g.C / 2, r = g.C * 0.27;
    if (v === 'hit') b += `<path d="M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}" stroke="#ff6a2a" stroke-width="4"/>`;
    else if (v === 'miss') b += `<circle cx="${cx}" cy="${cy}" r="${g.C * 0.11}" fill="#e8dfc6"/>`;
    else if (v === 'ice') b += `<circle cx="${cx}" cy="${cy}" r="${g.C * 0.11}" fill="#bfe8ff"/>`;
    else if (v === 'clear') b += `<circle cx="${cx}" cy="${cy}" r="${g.C * 0.06}" fill="#6b7a7c"/>`;
  }
  // this round's aim and specials
  for (const [x, y] of bt.aim) { const cx = g.px(x) + g.C / 2, cy = g.py(y) + g.C / 2; b += `<circle cx="${cx}" cy="${cy}" r="${g.C * 0.33}" fill="none" stroke="#c9a24b" stroke-width="3"/><path d="M${cx} ${cy - g.C * 0.45}V${cy + g.C * 0.45}M${cx - g.C * 0.45} ${cy}H${cx + g.C * 0.45}" stroke="#c9a24b" stroke-width="2"/>`; }
  for (const p of bt.specials) {
    if (p.kind === 'heavy') b += `<rect x="${g.px(p.x) + 2}" y="${g.py(p.y) + 2}" width="${2 * g.C - 4}" height="${2 * g.C - 4}" fill="#d9573f" fill-opacity=".2" stroke="#d9573f" stroke-width="3" stroke-dasharray="7 4"/>`;
    if (p.kind === 'sounding') b += p.line === 'row' ? `<rect x="${g.px(0)}" y="${g.py(p.n) + 2}" width="${g.C * SV.N}" height="${g.C - 4}" fill="none" stroke="#5b9bd5" stroke-width="3" stroke-dasharray="7 4"/>` : `<rect x="${g.px(p.n) + 2}" y="${g.py(0)}" width="${g.C - 4}" height="${g.C * SV.N}" fill="none" stroke="#5b9bd5" stroke-width="3" stroke-dasharray="7 4"/>`;
  }
  $('theirs').innerHTML = b;
  const left = S.afloat(bt.theirs.ships).map(s => s.len).sort((a, b) => b - a);
  $('theirnote').textContent = `· afloat: ${left.length ? left.map(n => n + '-long').join(', ') : 'none'}`;
}
function drawOurs() {
  const g = OU; let b = water(g, 350, 10);
  b += glaciers(bt.ours, g);
  for (const [k, v] of bt.incoming) { if (bt.round - v.round > 0) continue; const [x, y] = k.split(',').map(Number); b += `<circle cx="${g.px(x) + g.C / 2}" cy="${g.py(y) + g.C / 2}" r="${g.C * 0.42}" fill="none" stroke="${v.r === 'hit' ? '#ff3b1f' : '#9fd0ff'}" stroke-width="2"/>`; }
  for (const s of bt.ours.ships) {
    const dead = S.sunk(s);
    b += shipBox(s, g, { fill: dead ? '#3a3a3a' : CREW_COL[s.crew], stroke: s.id === sel || s.id === boostShip ? '#fff' : '#000', sw: s.id === sel || s.id === boostShip ? 3 : 1.5 });
    S.cellsOf(s).forEach((c, i) => { if (s.hits.has(i)) b += `<circle cx="${g.px(c[0]) + g.C / 2}" cy="${g.py(c[1]) + g.C / 2}" r="${g.C * 0.22}" fill="#ff3b1f" stroke="#ffd36a" stroke-width="1.5"/>`; });
    const [x, y] = S.cellsOf(s)[0]; b += `<text x="${g.px(x) + g.C * 0.32}" y="${g.py(y) + g.C * 0.66}" fill="#111" font-size="12" font-weight="700">${bt.ours.ships.indexOf(s) + 1}</text>`;
  }
  for (const p of bt.specials) if (p.kind === 'boost') { const s = bt.ours.ships.find(o => o.id === p.ship); if (s) b += shipBox({ ...s, x: s.x + p.dx, y: s.y + p.dy }, g, { stroke: '#5cbf7a', sw: 2.5, dash: '5 4' }); }
  $('ours').innerHTML = b;
}

function draw() {
  drawTheirs(); drawOurs();
  const battle = bt.phase === 'battle', left = Math.max(0, bt.nextRound - bt.t), n = S.shotsAllowed(bt);
  $('phase').textContent = bt.phase === 'deploy' ? 'DEPLOY THE FLEET' : battle ? `WAVE ${bt.wave} · ROUND ${bt.round + 1}` : 'THE FLEET IS LOST';
  $('deploybtns').style.display = bt.phase === 'deploy' ? '' : 'none';
  $('battlebtns').style.display = battle ? '' : 'none';
  $('roundline').textContent = battle ? `Both fleets fire in ${Math.ceil(left)} s${paused ? ' (PAUSED)' : ''}, or press FIRE. One shot for each of our ships afloat; they fire back at the same moment.` : bt.phase === 'deploy' ? 'Click a ship on our board, then click where its first square goes. R turns it. Ships may not touch.' : '';
  $('roundbar').firstElementChild.style.width = battle ? (100 * (1 - left / SV.round)) + '%' : '0';
  $('shots').textContent = `${bt.aim.length}/${n}`;
  // the loaded specials
  const th = bt.tokens.length ? 'SPECIALS: ' + bt.tokens.map(t => { const on = bt.specials.some(p => p.token === t.id); return `<button data-token="${t.id}" class="${on || (pending && pending.id === t.id) ? 'on' : ''}" ${battle ? '' : 'disabled'}>${S.SPECIAL_NAME[t.kind]}${on ? ' ✓' : ''}</button>`; }).join('') : '<span class="hint">No specials loaded. The departments load them with the flag code.</span>';
  if ($('tokens').innerHTML !== th) $('tokens').innerHTML = th;
  $('tokens').querySelectorAll('[data-token]').forEach(btn => btn.onclick = () => {
    const tk = bt.tokens.find(t => t.id === btn.dataset.token);
    if (bt.specials.some(p => p.token === tk.id)) { S.cancelSpecial(bt, tk.id); pending = null; } else { pending = tk; boostShip = null; }
    draw();
  });
  $('specialhint').innerHTML = !pending ? '' : pending.kind === 'heavy' ? 'HEAVY SHELL: click their board where the 2 × 2 burst should land (its top-left square).' :
    pending.kind === 'sounding' ? `SOUNDING: click any square on their board to sound its ${soundDir === 'row' ? 'ROW' : 'COLUMN'}. R switches row and column.` :
    `BOOST: click one of our ships, then an arrow (or arrow key). ${boostShip ? `<span class="row">${[['↑', 0, -1], ['↓', 0, 1], ['←', -1, 0], ['→', 1, 0]].map(([l, dx, dy]) => `<button data-boost="${dx},${dy}">${l}</button>`).join('')}</span>` : ''}`;
  $('specialhint').querySelectorAll('[data-boost]').forEach(btn => btn.onclick = () => { const [dx, dy] = btn.dataset.boost.split(',').map(Number); doBoost(dx, dy); });
  $('help').textContent = battle ? 'Click squares to aim (click again to un-aim). Every mark stays true: their ships never move. Ice drifts the way its arrow points; a glacier that runs into a ship scrapes it, and the log says where.' : '';
  $('ourhelp').textContent = battle ? 'Rings show where their last salvo landed. A boost moves one of our ships a square: their hits on it go stale.' : '';
  $('log').innerHTML = bt.log.map(l => `<div><span class="hint">${l.round}</span> ${l.text}</div>`).join('');
  for (const d of ['gunnery', 'signals', 'engineer']) {
    const el = $('d-' + d), st = bt.dept[d]; if (!el) continue;
    el.querySelector('.hoist').innerHTML = st.state === 'flags' ? st.flags.map(f => flagSVG(f)).join('') : `<div class="hint" style="width:54px;height:110px;display:flex;align-items:center;justify-content:center;border:1px dashed #333">${st.state === 'loaded' ? 'LOADED' : Math.ceil(st.readyAt - bt.t) + ' s'}</div>`;
    el.querySelector('.code').innerHTML = entry[d].map(r => rune(r, 24, '#ffd36a')).join('') + '<span class="hint">' + '·'.repeat(3 - entry[d].length) + '</span>';
    const sEl = el.querySelector('.state');
    sEl.className = 'state' + (st.state === 'loaded' ? ' ok' : bad[d] ? ' bad' : '');
    sEl.textContent = st.state === 'flags' ? (bad[d] ? 'That code does not match. Check the flags again.' : 'Flags hoisted: read them out.') : st.state === 'loaded' ? 'Loaded: the Fleet Officer can use it.' : 'Used. New flags soon.';
  }
  if (bt.phase === 'lost') { $('over').classList.remove('hidden'); $('overtext').textContent = `You held for ${bt.wave - 1} wave${bt.wave === 2 ? '' : 's'}.`; }
}
function doBoost(dx, dy) { if (!pending || pending.kind !== 'boost' || !boostShip) return; if (S.useSpecial(bt, pending.id, { ship: boostShip, dx, dy })) { pending = null; boostShip = null; audio.sfx.click(); } else audio.sfx.deny(); draw(); }

// ---------- input ----------
$('theirs').addEventListener('click', e => {
  if (bt.phase !== 'battle') return;
  const c = cellAt($('theirs'), e, TH, 520); if (!c) return;
  const [x, y] = c;
  if (pending && pending.kind === 'heavy') { S.useSpecial(bt, pending.id, { x: Math.min(SV.N - 2, x), y: Math.min(SV.N - 2, y) }); pending = null; audio.sfx.click(); draw(); return; }
  if (pending && pending.kind === 'sounding') { S.useSpecial(bt, pending.id, { line: soundDir, n: soundDir === 'row' ? y : x }); pending = null; audio.sfx.click(); draw(); return; }
  if (S.toggleAim(bt, x, y)) audio.sfx.click(); else audio.sfx.deny();
  draw();
});
$('ours').addEventListener('click', e => {
  const c = cellAt($('ours'), e, OU, 350); if (!c) return;
  const [x, y] = c, own = S.shipAt(bt.ours.ships, x, y);
  if (bt.phase === 'deploy') {
    if (own) { sel = own.id; draw(); return; }
    const s = bt.ours.ships.find(q => q.id === sel); (s && S.deploy(bt, s.id, x, y, s.dir) ? audio.sfx.click : audio.sfx.deny)(); draw(); return;
  }
  if (pending && pending.kind === 'boost' && own && !S.sunk(own)) { boostShip = own.id; draw(); }
});
$('turnd').onclick = () => { const s = bt.ours.ships.find(q => q.id === sel); if (s && !S.deploy(bt, s.id, s.x, s.y, s.dir === 'h' ? 'v' : 'h')) audio.sfx.deny(); draw(); };
$('random').onclick = () => { bt.ours = S.newBattle(Math.floor(Math.random() * 1e9)).ours; sel = bt.ours.ships[0].id; draw(); };
$('begin').onclick = () => { audio.unlock && audio.unlock(); S.begin(bt); audio.sfx.alarm(); draw(); };
$('fire').onclick = () => handle(S.fire(bt));
$('pause').onclick = () => { paused = !paused; $('pause').textContent = paused ? 'RESUME' : 'PAUSE'; };
$('newgame').onclick = start; $('again').onclick = start;
$('roundlen').oninput = e => { SV.round = +e.target.value; $('roundval').textContent = SV.round + ' s'; if (bt.phase === 'battle') bt.nextRound = Math.min(bt.nextRound, bt.t + SV.round); };
$('extra').oninput = e => { SV.enemyExtra = +e.target.value; $('extraval').textContent = SV.enemyExtra; };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'r' || e.key === 'R') { if (bt.phase === 'deploy') $('turnd').onclick(); else { soundDir = soundDir === 'row' ? 'col' : 'row'; draw(); } return; }
  const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (mv && pending && pending.kind === 'boost') { e.preventDefault(); doBoost(...mv); return; }
  if (e.key === 'Enter' && bt.phase === 'battle') { e.preventDefault(); handle(S.fire(bt)); }
  if (e.key === 'Escape') { pending = null; boostShip = null; draw(); }
});
function handle(ev) {
  for (const e of ev) {
    if (e.type === 'hit') (e.side === 'theirs' ? audio.sfx.hit : audio.sfx.blowout)();
    if (e.type === 'sunk') e.side === 'theirs' ? audio.sfx.reveal() : audio.sfx.camdead();
    if (e.type === 'scrape') audio.sfx.spark();
    if (e.type === 'wave') audio.sfx.win();
  }
  if (!ev.some(e => e.type === 'hit' && e.side === 'theirs')) audio.sfx.miss();
  draw();
}
function loop() {
  const now = performance.now(), dt = Math.min(1, (now - last) / 1000); last = now;
  if (!paused) { const ev = S.tick(bt, dt); if (ev.length) handle(ev); }
  draw();
}
buildCodebook(); start(); setInterval(loop, 250);
