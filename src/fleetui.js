// Fleet command: the Watch's naval defences as a plotting table. Mounted on the operator's cabin wall and on every
// officer's station. It only draws a fleet state and calls `send(action)`; the game decides what happens.
//   deploy / redeploy: drag the ships onto our table (ROTATE, R or right click turns one), then READY
//   play: pick a rune and a number (or click the enemy table), FIRE; the enemy answers
import { SIZE, SHIPS, SHIP_NAMES, ENEMY_NAMES, COL_RUNES, IDLE_SHOT, ENEMY_DELAY, REDEPLOY_TIME, cellsOf, key } from './fleet.js';
import { glyphSVG } from './glyphs.js';

const css = `
.fl { font-family: 'IBM Plex Mono', monospace; color: #e8dfc6; display: grid; gap: 8px; }
.fl .top { display: flex; align-items: center; gap: 10px; }
.fl .status { flex: 1; font-size: 13px; letter-spacing: 1px; color: #cfc6ab; min-height: 18px; }
.fl .status b { color: #ffb347; }
.fl .clockbar { height: 7px; background: #0a0806; border: 1px solid #3a2d1c; border-radius: 4px; overflow: hidden; }
.fl .clockbar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #a3291c, #ffb347); transition: width .25s linear; }
.fl .clockbar.enemy i { background: linear-gradient(90deg, #ff4b3a, #ff9a8a); }
.fl .clockbar.redeploy i { background: linear-gradient(90deg, #1f6b45, #5cff9d); }
.fl .tables { display: flex; gap: 12px; flex-wrap: wrap; }
.fl .table .lbl { font-size: 11px; letter-spacing: 2px; color: #b9a77c; margin: 0 0 3px 2px; }
.fl .table .lbl b { color: #e8cf98; }
.fl svg.plot { display: block; border: 2px solid #6e5430; border-radius: 6px; box-shadow: inset 0 0 30px #000, 0 2px 10px #000; }
.fl .enemyT .cellhit { cursor: crosshair; }
.fl .ourT.deploy .cellhit { cursor: copy; }
.fl .hull { cursor: grab; }
.fl .fire { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.fl .fire button { min-width: 34px; height: 34px; background: #1b1712; color: #e8cf98; border: 1px solid #6e5430; font: 600 14px 'IBM Plex Mono', monospace; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 3px; }
.fl .fire button:hover:not(:disabled) { background: #2a2016; }
.fl .fire button.on { background: #6e5430; color: #000; }
.fl .fire button:disabled { opacity: .3; cursor: default; }
.fl .fire .go { background: #5a1a12; color: #fdd; border: 2px solid #c33; padding: 0 18px; letter-spacing: 3px; font-family: 'Cinzel', serif; height: 40px; }
.fl .entry { min-width: 92px; height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #0a0806; border: 1px solid #3a2d1c; color: #ffb347; font: 600 18px 'Share Tech Mono', monospace; border-radius: 3px; }
.fl .entry svg { color: #ffb347; }
.fl .log { font-size: 12px; line-height: 1.5; max-height: 118px; overflow: hidden; background: #0a0f12; border: 1px solid #1e2c33; border-radius: 4px; padding: 5px 8px; }
.fl .log div { opacity: .5; } .fl .log div:first-child { opacity: 1; } .fl .log div:nth-child(2) { opacity: .75; }
.fl .log .hit { color: #ffb347; } .fl .log .struck { color: #ff8a7a; } .fl .log .safe { color: #9ad0ff; } .fl .log .info { color: #5cff9d; } .fl .log .miss { color: #b9c4c8; }
.fl .dock { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.fl .dock .dship { cursor: grab; padding: 2px 4px; border: 1px dashed #4a5560; border-radius: 4px; }
.fl .dock .dship.placed { opacity: .35; }
.fl .dock .dship small { display: block; font-size: 9px; letter-spacing: 1px; color: #9aa; text-align: center; }
.fl .btn2 { background: #1b1712; color: #e8cf98; border: 1px solid #6e5430; padding: 7px 12px; font: 600 12px 'IBM Plex Mono', monospace; letter-spacing: 1px; cursor: pointer; border-radius: 3px; }
.fl .ready { background: #1f4a3a; color: #d9ffe6; border: 2px solid #2bd96b; padding: 8px 16px; font: 600 13px 'Cinzel', serif; letter-spacing: 3px; cursor: pointer; border-radius: 3px; }
.fl .ready:disabled { opacity: .35; cursor: default; }
.fl .hint { font-size: 11px; color: #8e9a90; }
@keyframes flshell { from { transform: translate(var(--sx), var(--sy)) scale(1.6); opacity: .2; } 85% { opacity: 1; } to { transform: translate(0, 0) scale(.6); opacity: 0; } }
@keyframes flring { 0% { transform: scale(.15); opacity: 0; } 40% { opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
@keyframes flslide { from { transform: translate(var(--fx), var(--fy)); } to { transform: translate(0, 0); } }
@keyframes flburn { from { opacity: .55; } to { opacity: 1; } }
.fl .shell { animation: flshell .6s ease-in forwards; transform-box: fill-box; transform-origin: center; }
.fl .ring { animation: flring .9s ease-out .55s both; transform-box: fill-box; transform-origin: center; }
.fl .slide { animation: flslide 1.6s cubic-bezier(.4, 0, .2, 1) both; }
.fl .flame { animation: flburn .5s ease-in-out infinite alternate; }
`;
let styled = false;

// el: container · get(): { fleet, t } · send(action) · opts.cell: square size · opts.onShot(last)
export function mountFleet(el, get, send, opts = {}) {
  if (!styled) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); styled = true; }
  el.classList.add('fl');
  const C = opts.cell || 30, M = 22, W = M + SIZE * C + 6;   // square size, margin for the labels, table size
  const ui = { entry: [], held: null, heldDir: 'h', grab: 0, hover: null, sel: null, key: '', shotKey: null, slideFor: null };
  const P = (x, y) => [M + x * C, M + y * C];

  // a hull silhouette, drawn lying east-west in its own squares; vertical ships are turned
  function hull(len, color, stroke, extra = '') {
    const L = len * C, y0 = C * 0.2, y1 = C * 0.8, bow = C * 0.42;
    let g = `<path d="M ${C * 0.18} ${y0} L ${L - bow} ${y0} Q ${L - C * 0.06} ${C * 0.5} ${L - bow} ${y1} L ${C * 0.18} ${y1} Q ${C * 0.04} ${C * 0.5} ${C * 0.18} ${y0} Z" fill="${color}" stroke="${stroke}" stroke-width="1.5"/>`;
    g += `<line x1="${C * 0.3}" y1="${C * 0.5}" x2="${L - bow}" y2="${C * 0.5}" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
    for (let i = 0; i < len; i++) g += `<circle cx="${i * C + C * 0.5}" cy="${C * 0.5}" r="${C * 0.13}" fill="rgba(0,0,0,.4)" stroke="${stroke}" stroke-width=".8"/>`;
    return g + extra;
  }
  const place = s => s.dir === 'h' ? `translate(${P(s.x, s.y).join(',')})` : `translate(${P(s.x, s.y)[0] + C},${P(s.x, s.y)[1]}) rotate(90)`;

  function plot(kind, f) {
    const mine = kind === 'mine', ships = mine ? f.mine : f.enemy, shots = mine ? f.theirShots : f.myShots;
    const sunk = s => cellsOf(s).length && cellsOf(s).every(c => shots[key(...c)] === 'hit');
    const cx = M + SIZE * C / 2, cy = M + SIZE * C / 2;
    let b = `<defs><radialGradient id="sea-${kind}" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${mine ? '#0f2a2c' : '#132226'}"/><stop offset="1" stop-color="#040a0c"/></radialGradient>
      <radialGradient id="flame" cx="50%" cy="60%" r="50%"><stop offset="0" stop-color="#fff1c0"/><stop offset=".45" stop-color="#ff7a2a"/><stop offset="1" stop-color="rgba(255,60,30,0)"/></radialGradient></defs>`;
    b += `<rect width="${W}" height="${W}" fill="url(#sea-${kind})"/>`;
    for (const r of [1, 2, 3]) b += `<circle cx="${cx}" cy="${cy}" r="${r * SIZE * C / 6.5}" fill="none" stroke="rgba(92,255,157,.09)"/>`;
    b += `<line x1="${cx}" y1="${M}" x2="${cx}" y2="${M + SIZE * C}" stroke="rgba(92,255,157,.07)"/><line x1="${M}" y1="${cy}" x2="${M + SIZE * C}" y2="${cy}" stroke="rgba(92,255,157,.07)"/>`;
    for (let i = 0; i <= SIZE; i++) b += `<line x1="${M + i * C}" y1="${M}" x2="${M + i * C}" y2="${M + SIZE * C}" stroke="rgba(127,216,255,.07)"/><line x1="${M}" y1="${M + i * C}" x2="${M + SIZE * C}" y2="${M + i * C}" stroke="rgba(127,216,255,.07)"/>`;
    for (let x = 0; x < SIZE; x++) b += `<g transform="translate(${M + x * C + C / 2 - 7},4)" color="#e8cf98">${glyphSVG(COL_RUNES[x], 14)}</g>`;
    for (let y = 0; y < SIZE; y++) b += `<text x="${M / 2}" y="${M + y * C + C / 2 + 4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#b9a77c">${y + 1}</text>`;
    // squares already fired on are dimmed; the square being built up is marked
    for (const k of Object.keys(shots)) { const [x, y] = k.split(',').map(Number); b += `<rect x="${P(x, y)[0] + 1}" y="${P(x, y)[1] + 1}" width="${C - 2}" height="${C - 2}" fill="rgba(0,0,0,.35)"/>`; }
    if (!mine && ui.entry.length) {
      const [x, y] = ui.entry;
      b += `<rect x="${P(x, 0)[0]}" y="${M}" width="${C}" height="${SIZE * C}" fill="rgba(255,179,71,.06)"/>`;
      if (y != null) { const [px, py] = P(x, y); b += `<rect x="${M}" y="${py}" width="${SIZE * C}" height="${C}" fill="rgba(255,179,71,.06)"/><circle cx="${px + C / 2}" cy="${py + C / 2}" r="${C * 0.38}" fill="none" stroke="#ffb347" stroke-width="2"/><line x1="${px + C / 2}" y1="${py + 2}" x2="${px + C / 2}" y2="${py + C - 2}" stroke="#ffb347"/><line x1="${px + 2}" y1="${py + C / 2}" x2="${px + C - 2}" y2="${py + C / 2}" stroke="#ffb347"/>`; }
    }
    // where our ships were before a redeploy, and the ships themselves
    const slide = mine && f.phase === 'redeploy' && f.prevMine && ui.slideFor !== f.redeployUntil;
    if (mine && f.phase === 'redeploy' && f.prevMine) for (const s of f.prevMine) if (s.x != null) b += `<g transform="${place(s)}"><rect x="2" y="${C * 0.18}" width="${s.len * C - 4}" height="${C * 0.64}" rx="${C * 0.3}" fill="none" stroke="rgba(232,207,152,.35)" stroke-dasharray="4 4"/></g>`;
    ships.forEach((s, i) => {
      if (s.x == null) return;
      const gone = sunk(s);
      if (!mine && !gone) return;
      const color = gone ? '#3a1410' : ui.sel === i && mine ? '#7c8a96' : '#5d6873', stroke = gone ? '#a33' : '#a9b6c2';
      const prev = slide && f.prevMine[i], fx = prev ? P(prev.x, prev.y)[0] - P(s.x, s.y)[0] : 0, fy = prev ? P(prev.x, prev.y)[1] - P(s.x, s.y)[1] : 0;
      b += `<g class="${prev ? 'slide' : ''}" style="--fx:${fx}px;--fy:${fy}px"><g class="${mine ? 'hull' : ''}" data-i="${i}" transform="${place(s)}">${hull(s.len, color, stroke)}<title>${(mine ? SHIP_NAMES : ENEMY_NAMES)[i]}</title></g></g>`;
      if (gone) { const [px, py] = P(s.x, s.y); b += `<text x="${px + (s.dir === 'h' ? s.len * C / 2 : C / 2)}" y="${py + (s.dir === 'h' ? C / 2 : s.len * C / 2) + 4}" text-anchor="middle" font-family="Cinzel" font-size="11" font-weight="800" fill="#ff8a7a" letter-spacing="2">SUNK</text>`; }
    });
    // hits burn; misses leave a ring
    for (const [k, v] of Object.entries(shots)) {
      const [x, y] = k.split(',').map(Number), [px, py] = P(x, y), mx = px + C / 2, my = py + C / 2;
      b += v === 'hit' ? `<circle class="flame" cx="${mx}" cy="${my}" r="${C * 0.3}" fill="url(#flame)"/>` : `<circle cx="${mx}" cy="${my}" r="${C * 0.16}" fill="none" stroke="#7fa6b3" stroke-width="1.5"/>`;
    }
    // the latest shot lands with a shell and a splash or a blast
    const last = f.last, lk = last ? last.by + last.t : null;
    if (last && lk === ui.anim && (last.by === 'us') === !mine) {
      const [px, py] = P(last.x, last.y), mx = px + C / 2, my = py + C / 2;
      b += `<circle class="shell" cx="${mx}" cy="${my}" r="4" fill="#ffe4a0" style="--sx:${mine ? 60 : -60}px;--sy:-120px"/>`;
      b += `<circle class="ring" cx="${mx}" cy="${my}" r="${C * 0.55}" fill="${last.hit ? 'url(#flame)' : 'none'}" stroke="${last.hit ? '#ff7a2a' : '#9ad0ff'}" stroke-width="2"/>`;
    }
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) b += `<rect class="cellhit" data-x="${x}" data-y="${y}" x="${P(x, y)[0]}" y="${P(x, y)[1]}" width="${C}" height="${C}" fill="transparent"/>`;
    b += `<g class="preview"></g>`;
    return `<svg class="plot" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${b}</svg>`;
  }

  const left = (ships, shots) => ships.filter(s => !cellsOf(s).every(c => shots[key(...c)] === 'hit')).length;
  function render() {
    const { fleet: f, t } = get();
    if (!f || f.phase === 'off') { if (el.innerHTML) el.innerHTML = ''; ui.key = ''; return; }
    const lk = f.last ? f.last.by + f.last.t : null;
    if (lk !== ui.shotKey) { const fresh = ui.shotKey !== null; ui.shotKey = lk; if (fresh && f.last) { ui.anim = lk; if (opts.onShot) opts.onShot(f.last); setTimeout(() => { ui.anim = null; ui.key = ''; }, 1700); } }
    const k = JSON.stringify([f.phase, f.mine, f.myShots, f.theirShots, f.enemyAt != null, f.wins, f.losses, ui.entry, ui.held, ui.sel, ui.anim, (f.log || []).length, f.prevMine]);
    if (k !== ui.key) { ui.key = k; build(f); }
    status(f, t);
  }
  function status(f, t) {
    const st = el.querySelector('.status'), bar = el.querySelector('.clockbar'); if (!st) return;
    let text, frac = 0, cls = '';
    if (f.phase === 'deploy') text = 'DEPLOY THE FLEET. Drag each ship onto our table. ROTATE (or R, or right click) turns the ship you hold or last touched.';
    else if (f.phase === 'redeploy') { const s = Math.max(0, Math.ceil(f.redeployUntil - t)); text = `<b>VICTORY.</b> The fleet has moved to new stations. Redeploy if you like: the new enemy holds its fire for <b>${s} s</b>.`; frac = s / REDEPLOY_TIME; cls = 'redeploy'; }
    else if (f.enemyAt != null) { text = '<b>INCOMING: THE ENEMY IS FIRING...</b>'; frac = Math.max(0, (f.enemyAt - t) / ENEMY_DELAY); cls = 'enemy'; }
    else { const s = Math.max(0, Math.ceil(IDLE_SHOT - (t - f.idleFrom))); text = `<b>YOUR SHOT.</b> Pick a rune and a number, then FIRE. The enemy fires anyway in <b>${s} s</b>.`; frac = s / IDLE_SHOT; }
    if (st.innerHTML !== text) st.innerHTML = text;
    if (bar) { bar.className = 'clockbar ' + cls; bar.firstElementChild.style.width = (Math.min(1, frac) * 100).toFixed(1) + '%'; }
  }

  function build(f) {
    const deploying = f.phase === 'deploy' || f.phase === 'redeploy', myTurn = f.phase === 'play' && f.enemyAt == null;
    const fired = ui.entry.length === 2 && f.myShots[key(...ui.entry)];
    const dock = deploying ? `<div class="dock">${f.mine.map((s, i) => `<div class="dship${s.x != null ? ' placed' : ''}" data-i="${i}"><svg width="${SHIPS[i] * 18}" height="18" viewBox="0 0 ${SHIPS[i] * C} ${C}">${hull(SHIPS[i], '#5d6873', '#a9b6c2')}</svg><small>${SHIP_NAMES[i]}</small></div>`).join('')}
        <button class="btn2" data-rot>⟳ ROTATE</button>
        <button class="ready" ${f.mine.every(s => s.x != null) ? '' : 'disabled'}>${f.phase === 'redeploy' ? 'READY · RESUME THE ACTION' : 'THE FLEET IS READY · BEGIN THE WATCH'}</button></div>` : '';
    const pad = f.phase === 'play' ? `<div class="fire">${[...Array(SIZE).keys()].map(x => `<button data-col="${x}" class="${ui.entry[0] === x ? 'on' : ''}">${glyphSVG(COL_RUNES[x], 18)}</button>`).join('')}</div>
      <div class="fire">${[...Array(SIZE).keys()].map(y => `<button data-row="${y}" class="${ui.entry[1] === y ? 'on' : ''}" ${ui.entry.length && f.myShots[key(ui.entry[0], y)] ? 'disabled' : ''}>${y + 1}</button>`).join('')}
        <span class="entry">${ui.entry[0] != null ? glyphSVG(COL_RUNES[ui.entry[0]], 18) : '·'} ${ui.entry[1] != null ? ui.entry[1] + 1 : '·'}</span>
        <button data-back title="Clear">⌫</button><button class="go" ${myTurn && ui.entry.length === 2 && !fired ? '' : 'disabled'}>FIRE</button></div>` : '';
    el.innerHTML = `<div class="top"><div class="status"></div></div><div class="clockbar"><i></i></div>
      ${dock}
      <div class="tables">
        ${f.phase === 'play' || f.phase === 'redeploy' ? `<div class="table enemyT"><div class="lbl">ENEMY WATERS · <b>${left(f.enemy, f.myShots)}</b> OF ${ENEMY_NAMES.length} AFLOAT</div>${plot('enemy', f)}</div>` : ''}
        <div class="table ourT${deploying ? ' deploy' : ''}"><div class="lbl">OUR FLEET · <b>${left(f.mine, f.theirShots)}</b> OF ${SHIP_NAMES.length} AFLOAT</div>${plot('mine', f)}</div>
      </div>
      ${pad}
      <div class="log">${(f.log || []).slice(-6).reverse().map(l => `<div class="${l.kind}">${l.text}</div>`).join('') || '<div class="info">The enemy fleet is out there somewhere. Fire when ready.</div>'}</div>
      <div class="hint">Victories ${f.wins} · losses ${f.losses} · anyone at any station can fire.</div>`;
    if (f.phase === 'redeploy' && f.prevMine) ui.slideFor = f.redeployUntil;
    if (f.phase === 'play') wirePlay(f);
    if (deploying) wireDeploy(f);
  }
  function wirePlay(f) {
    el.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { ui.entry = [Number(b.dataset.col)]; ui.key = ''; render(); });
    el.querySelectorAll('[data-row]').forEach(b => b.onclick = () => { if (ui.entry.length) { ui.entry = [ui.entry[0], Number(b.dataset.row)]; ui.key = ''; render(); } });
    const back = el.querySelector('[data-back]'); if (back) back.onclick = () => { ui.entry = ui.entry.slice(0, -1); ui.key = ''; render(); };
    const go = el.querySelector('.go'); if (go) go.onclick = () => { if (ui.entry.length === 2) { send({ act: 'fire', x: ui.entry[0], y: ui.entry[1] }); ui.entry = []; ui.key = ''; } };
    el.querySelectorAll('.enemyT .cellhit').forEach(c => c.onclick = () => { const x = Number(c.dataset.x), y = Number(c.dataset.y); if (f.myShots[key(x, y)]) return; ui.entry = [x, y]; ui.key = ''; render(); });
  }

  // deployment: drag a ship from the dock or the table; it is placed where the square under the pointer says
  function wireDeploy(f) {
    const svg = el.querySelector('.ourT svg.plot');
    const pick = (i, grab = 0) => { ui.held = i; ui.sel = i; ui.grab = grab; ui.heldDir = f.mine[i].x != null ? f.mine[i].dir : ui.heldDir; };
    el.querySelectorAll('.dship').forEach(d => d.onpointerdown = e => { e.preventDefault(); pick(Number(d.dataset.i), 0); ui.key = ''; render(); });
    el.querySelectorAll('.ourT .hull').forEach(h => h.onpointerdown = e => {
      e.preventDefault(); const i = Number(h.dataset.i), s = f.mine[i], c = cellAt(svg, e);
      pick(i, c ? Math.max(0, s.dir === 'h' ? c[0] - s.x : c[1] - s.y) : 0); ui.key = ''; render();
    });
    el.querySelector('[data-rot]').onclick = rotate;
    el.querySelector('.ready').onclick = () => send({ act: 'ready' });
    if (svg) svg.onpointermove = e => { if (ui.held == null) return; ui.hover = cellAt(svg, e); preview(f); };
  }
  function cellAt(svg, e) {
    const r = svg.getBoundingClientRect(), x = Math.floor(((e.clientX - r.left) * W / r.width - M) / C), y = Math.floor(((e.clientY - r.top) * W / r.height - M) / C);
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? [x, y] : null;
  }
  const anchor = () => ui.hover && (ui.heldDir === 'h' ? [ui.hover[0] - ui.grab, ui.hover[1]] : [ui.hover[0], ui.hover[1] - ui.grab]);
  function preview(f) {
    const g = el.querySelector('.ourT .preview'); if (!g) return;
    const a = anchor(); if (ui.held == null || !a) { g.innerHTML = ''; return; }
    const s = { len: SHIPS[ui.held], x: a[0], y: a[1], dir: ui.heldDir }, cells = cellsOf(s);
    const others = new Set(); f.mine.forEach((o, j) => { if (j !== ui.held) cellsOf(o).forEach(c => others.add(key(...c))); });
    const ok = cells.every(([x, y]) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && !others.has(key(x, y)));
    g.innerHTML = `<g transform="${place(s)}" opacity=".75">${hull(s.len, ok ? '#1f6b45' : '#6b1f1f', ok ? '#5cff9d' : '#ff4b3a')}</g>`;
  }
  function rotate() {
    const { fleet: f } = get(); if (!f) return;
    if (ui.held != null) { ui.heldDir = ui.heldDir === 'h' ? 'v' : 'h'; preview(f); return; }
    if (ui.sel != null && f.mine[ui.sel] && f.mine[ui.sel].x != null) { const s = f.mine[ui.sel]; send({ act: 'place', i: ui.sel, x: s.x, y: s.y, dir: s.dir === 'h' ? 'v' : 'h' }); }
  }
  addEventListener('pointerup', () => {
    const { fleet: f } = get();
    if (ui.held == null || !f || (f.phase !== 'deploy' && f.phase !== 'redeploy')) { ui.held = null; return; }
    const a = anchor();
    if (a) send({ act: 'place', i: ui.held, x: a[0], y: a[1], dir: ui.heldDir });
    ui.held = null; ui.hover = null; ui.key = ''; render();
  });
  addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && (ui.held != null || ui.sel != null) && e.target.tagName !== 'INPUT') { const { fleet: f } = get(); if (f && (f.phase === 'deploy' || f.phase === 'redeploy')) { e.preventDefault(); rotate(); } } });
  el.addEventListener('contextmenu', e => { const { fleet: f } = get(); if (f && (f.phase === 'deploy' || f.phase === 'redeploy')) { e.preventDefault(); rotate(); } });
  return { render };
}
