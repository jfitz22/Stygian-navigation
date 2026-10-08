// The fleet panel: deployment, the two grids and the firing pad. Mounted on the operator's cabin wall and on every
// officer's station. It only draws a fleet state and calls `send(action)`; the game decides what happens.
import { SIZE, SHIPS, SHIP_NAMES, ENEMY_NAMES, COL_RUNES, IDLE_SHOT, ENEMY_DELAY, cellsOf, key } from './fleet.js';
import { glyphSVG } from './glyphs.js';

const css = `
.fl { display: grid; gap: 10px; font-family: 'IBM Plex Mono', monospace; color: #e8dfc6; }
.fl .grids { display: flex; gap: 18px; flex-wrap: wrap; }
.fl .gwrap .lbl { font-size: 11px; letter-spacing: 2px; color: #b9a77c; margin-bottom: 4px; }
.fl .grid { display: grid; grid-template-columns: 22px repeat(${SIZE}, var(--c)); grid-template-rows: 22px repeat(${SIZE}, var(--c)); gap: 2px; }
.fl .hd { display: flex; align-items: center; justify-content: center; font-size: 12px; color: #b9a77c; }
.fl .hd svg { color: #e8cf98; }
.fl .cell { border: 1px solid #22404a; position: relative; overflow: visible;
  background: repeating-linear-gradient(170deg, #0c1a22 0 6px, #0e1f28 6px 9px); background-size: 40px 40px; animation: flsea 6s linear infinite; }
@keyframes flsea { to { background-position: 40px 12px; } }
.fl .cell.ship { background: linear-gradient(#5d6873, #3e4750); border-color: #8a96a2; animation: none; }
.fl .cell.ship.sunk { background: #3a1410; border-color: #a33; }
.fl .cell.hit::after, .fl .cell.miss::after { content: ''; position: absolute; inset: 28%; border-radius: 50%; }
.fl .cell.hit::after { background: #ff4b3a; box-shadow: 0 0 8px #ff4b3a; }
.fl .cell.miss::after { background: #6c8a96; inset: 38%; }
.fl .cell.aim { outline: 2px solid #ffb347; z-index: 1; }
.fl .cell.drop { background: #1f4a3a; }
.fl .cell.bad { background: #4a1f1f; }
.fl .enemy .cell { cursor: crosshair; }
.fl .dock { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; min-height: 34px; }
.fl .dship { display: flex; gap: 2px; cursor: grab; padding: 3px; border: 1px dashed #8a96a2; }
.fl .dship.v { flex-direction: column; }
.fl .dship i { width: calc(var(--c) * .7); height: calc(var(--c) * .7); background: #4b5560; display: block; }
.fl .dship.placed { opacity: .35; }
.fl .pad { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.fl .pad button { min-width: 36px; height: 36px; background: #1b1712; color: #e8cf98; border: 1px solid #6e5430; font: 600 14px 'IBM Plex Mono', monospace; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.fl .pad button:hover { background: #2a2016; }
.fl .pad button.fire { background: #5a1a12; color: #fdd; border-color: #a33; padding: 0 16px; letter-spacing: 2px; }
.fl .pad button:disabled { opacity: .35; cursor: default; }
.fl .entry { min-width: 90px; height: 36px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #0a0806; border: 1px solid #3a2d1c; color: #ffb347; font: 600 18px 'Share Tech Mono', monospace; }
.fl .status { font-size: 13px; letter-spacing: 1px; color: #cfc6ab; min-height: 18px; }
.fl .status b { color: #ffb347; }
.fl .ready { background: #1f4a3a; color: #d9ffe6; border: 2px solid #2bd96b; padding: 8px 18px; font: 600 14px 'Cinzel', serif; letter-spacing: 3px; cursor: pointer; }
.fl .ready:disabled { opacity: .35; cursor: default; }
.fl .hint { font-size: 11px; color: #8e9a90; }
.fl .clockbar { height: 8px; background: #0a0806; border: 1px solid #3a2d1c; border-radius: 4px; overflow: hidden; }
.fl .clockbar i { display: block; height: 100%; background: linear-gradient(90deg, #a3291c, #ffb347); transition: width .25s linear; }
.fl .clockbar.enemy i { background: linear-gradient(90deg, #ff4b3a, #ff9a8a); }
.fl .log { font-size: 12px; line-height: 1.5; max-height: 132px; overflow: hidden; border-top: 1px solid #2a2a2a; padding-top: 6px; }
.fl .log div { opacity: .55; } .fl .log div:first-child { opacity: 1; } .fl .log div:nth-child(2) { opacity: .8; }
.fl .log .hit { color: #ffb347; } .fl .log .struck { color: #ff8a7a; } .fl .log .safe { color: #9ad0ff; } .fl .log .info { color: #5cff9d; }
.fl .cell.shellin::before { content: ''; position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; margin: -4px; border-radius: 50%; background: #ffe4a0; box-shadow: 0 0 10px #ffb347; animation: flshell .55s ease-in forwards; z-index: 3; }
@keyframes flshell { from { transform: translate(-60px, -140px) scale(1.8); opacity: .3; } 90% { opacity: 1; } to { transform: none; opacity: 0; } }
.fl .cell.splash::after, .fl .cell.blast::after { inset: -6px !important; border-radius: 50%; animation: flring .8s ease-out .5s backwards; }
.fl .cell.splash::after { background: none !important; border: 2px solid #9ad0ff; box-shadow: 0 0 10px #9ad0ff; }
.fl .cell.blast::after { background: radial-gradient(circle, #fff1c0, #ff7a2a 45%, rgba(255,60,30,0) 70%) !important; }
@keyframes flring { from { transform: scale(.2); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
.fl .cell.sunk { animation: flburn 1.2s ease-in-out infinite alternate; }
@keyframes flburn { to { box-shadow: inset 0 0 12px #ff4b3a; } }
`;
let styled = false;

// el: container · get(): { fleet, t } · send(action) · opts.cell: cell size in px
export function mountFleet(el, get, send, opts = {}) {
  if (!styled) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); styled = true; }
  el.classList.add('fl'); el.style.setProperty('--c', (opts.cell || 30) + 'px');
  const ui = { entry: [], held: null, heldDir: 'h', hover: null, key: '', shotKey: null };
  const runeHead = x => glyphSVG(COL_RUNES[x], 16);

  function gridHTML(kind, f) {
    let h = '<div class="hd"></div>';
    for (let x = 0; x < SIZE; x++) h += `<div class="hd">${runeHead(x)}</div>`;
    const ships = kind === 'mine' ? f.mine : f.enemy, shots = kind === 'mine' ? f.theirShots : f.myShots;
    const shipAt = {}; ships.forEach((s, i) => cellsOf(s).forEach(c => { shipAt[key(...c)] = i; }));
    const sunk = i => cellsOf(ships[i]).every(c => shots[key(...c)] === 'hit');
    for (let y = 0; y < SIZE; y++) {
      h += `<div class="hd">${y + 1}</div>`;
      for (let x = 0; x < SIZE; x++) {
        const k = key(x, y), i = shipAt[k], show = i != null && (kind === 'mine' || sunk(i));
        const aim = kind === 'enemy' && ui.entry.length === 2 && ui.entry[0] === x && ui.entry[1] === y;
        const nm = show ? (kind === 'mine' ? SHIP_NAMES[i] : ENEMY_NAMES[i]) : '';
        h += `<div class="cell${show ? ' ship' : ''}${show && sunk(i) ? ' sunk' : ''}${shots[k] ? ' ' + shots[k] : ''}${aim ? ' aim' : ''}" data-x="${x}" data-y="${y}"${nm ? ` title="${nm}"` : ''}></div>`;
      }
    }
    return h;
  }

  function render() {
    const { fleet: f, t } = get();
    if (!f || f.phase === 'off') { if (el.innerHTML) el.innerHTML = ''; ui.key = ''; return; }
    const myTurn = f.phase === 'play' && f.enemyAt == null;
    const k = JSON.stringify([f.phase, f.mine, f.myShots, f.theirShots, f.enemyAt != null, f.wins, f.losses, ui.entry, ui.held, f.phase === 'deploy' ? 0 : f.enemy.length]);
    const idle = f.phase === 'play' && myTurn ? Math.max(0, Math.ceil(IDLE_SHOT - (t - f.idleFrom))) : null;
    const st = el.querySelector('.status');
    const statusText = f.phase === 'deploy' ? 'DEPLOY THE FLEET. Drag each ship onto the grid; right click or R turns it.'
      : !myTurn ? '<b>INCOMING: THE ENEMY IS FIRING...</b>'
      : `<b>YOUR SHOT.</b> Choose a square. If nobody fires, the enemy fires anyway in <b>${idle} s</b>.`;
    if (k === ui.key) { if (st && st.innerHTML !== statusText) st.innerHTML = statusText; clockBar(f, t); return; }
    ui.key = k;
    if (f.phase === 'deploy') {
      el.innerHTML = `<div class="status">${statusText}</div>
        <div class="dock">${f.mine.map((s, i) => `<div class="dship${s.x != null ? ' placed' : ''}" data-i="${i}" title="${SHIP_NAMES[i]}">${'<i></i>'.repeat(SHIPS[i])}</div>`).join('')}
          <span class="hint">${f.mine.filter(s => s.x != null).length} of ${SHIPS.length} placed</span></div>
        <div class="gwrap mine"><div class="lbl">OUR FLEET</div><div class="grid">${gridHTML('mine', f)}</div></div>
        <div><button class="ready" ${f.mine.every(s => s.x != null) ? '' : 'disabled'}>THE FLEET IS READY · BEGIN THE WATCH</button></div>`;
      wireDeploy(f);
    } else {
      const left = (ships, shots) => ships.filter(s => !cellsOf(s).every(c => shots[key(...c)] === 'hit')).length;
      el.innerHTML = `<div class="status">${statusText}</div>
        <div class="grids">
          <div class="gwrap enemy"><div class="lbl">ENEMY WATERS · ${left(f.enemy, f.myShots)} OF ${ENEMY_NAMES.length} AFLOAT</div><div class="grid">${gridHTML('enemy', f)}</div></div>
          <div class="gwrap mine"><div class="lbl">OUR FLEET · ${left(f.mine, f.theirShots)} OF ${SHIP_NAMES.length} AFLOAT</div><div class="grid">${gridHTML('mine', f)}</div></div>
        </div>
        <div class="pad">${[...Array(SIZE).keys()].map(x => `<button data-col="${x}">${runeHead(x)}</button>`).join('')}</div>
        <div class="pad">${[...Array(SIZE).keys()].map(y => `<button data-row="${y}">${y + 1}</button>`).join('')}
          <span class="entry">${ui.entry[0] != null ? runeHead(ui.entry[0]) : '·'} ${ui.entry[1] != null ? ui.entry[1] + 1 : '·'}</span>
          <button data-back>⌫</button><button class="fire" ${myTurn && ui.entry.length === 2 ? '' : 'disabled'}>FIRE</button></div>
        <div class="clockbar"><i></i></div>
        <div class="log">${(f.log || []).slice(-6).reverse().map(l => `<div class="${l.kind}">${l.text}</div>`).join('') || '<div class="info">The enemy fleet is somewhere out there. Fire when ready.</div>'}</div>
        <div class="hint">Victories ${f.wins} · losses ${f.losses}. Anyone at any station can fire.</div>`;
      el.querySelectorAll('[data-col]').forEach(b => b.onclick = () => { ui.entry = [Number(b.dataset.col)]; render(); });
      el.querySelectorAll('[data-row]').forEach(b => b.onclick = () => { if (ui.entry.length === 1) { ui.entry = [ui.entry[0], Number(b.dataset.row)]; render(); } });
      el.querySelector('[data-back]').onclick = () => { ui.entry = ui.entry.slice(0, -1); render(); };
      el.querySelector('.fire').onclick = () => { if (ui.entry.length === 2) { send({ act: 'fire', x: ui.entry[0], y: ui.entry[1] }); ui.entry = []; render(); } };
      el.querySelectorAll('.enemy .cell').forEach(c => c.onclick = () => { ui.entry = [Number(c.dataset.x), Number(c.dataset.y)]; render(); });
      clockBar(f, t);
      // the latest shot: a shell falls on the square, then a splash or a blast
      const lk = f.last ? f.last.by + f.last.t : null;
      if (lk && lk !== ui.shotKey) {
        const fresh = ui.shotKey !== null; ui.shotKey = lk;
        if (fresh && f.last.x != null) {
          const c = el.querySelector(`.${f.last.by === 'us' ? 'enemy' : 'mine'} .cell[data-x="${f.last.x}"][data-y="${f.last.y}"]`);
          if (c) { c.classList.add('shellin', f.last.hit ? 'blast' : 'splash'); setTimeout(() => c.classList.remove('shellin', 'blast', 'splash'), 1400); }
          if (opts.onShot) opts.onShot(f.last);
        }
      }
    }
  }
  // the countdown: our turn drains towards the enemy's free shot; their turn runs down to their salvo
  function clockBar(f, t) {
    const bar = el.querySelector('.clockbar'); if (!bar || f.phase !== 'play') return;
    const enemy = f.enemyAt != null, k = enemy ? Math.max(0, (f.enemyAt - t) / ENEMY_DELAY) : Math.max(0, 1 - (t - f.idleFrom) / IDLE_SHOT);
    bar.classList.toggle('enemy', enemy); bar.firstElementChild.style.width = (k * 100).toFixed(1) + '%';
  }

  // deployment: drag a ship from the dock (or the grid) and drop it on a square; R or right click turns it
  function wireDeploy(f) {
    const pick = (i, dir) => { ui.held = i; ui.heldDir = dir || (f.mine[i].x != null ? f.mine[i].dir : ui.heldDir); };
    el.querySelectorAll('.dship').forEach(d => d.onpointerdown = e => { e.preventDefault(); pick(Number(d.dataset.i)); render(); });
    el.querySelectorAll('.mine .cell').forEach(c => {
      c.onpointerdown = e => {
        if (e.button === 2) return;
        const x = Number(c.dataset.x), y = Number(c.dataset.y), i = f.mine.findIndex(s => cellsOf(s).some(([a, b]) => a === x && b === y));
        if (i >= 0) { e.preventDefault(); pick(i); render(); }
      };
      c.onpointerenter = () => { if (ui.held != null) { ui.hover = [Number(c.dataset.x), Number(c.dataset.y)]; paintHover(f); } };
    });
    el.querySelector('.ready').onclick = () => send({ act: 'ready' });
    paintHover(f);
  }
  function paintHover(f) {
    el.querySelectorAll('.mine .cell').forEach(c => c.classList.remove('drop', 'bad'));
    if (ui.held == null || !ui.hover) return;
    const len = SHIPS[ui.held], [hx, hy] = ui.hover;
    const cells = Array.from({ length: len }, (_, i) => ui.heldDir === 'h' ? [hx + i, hy] : [hx, hy + i]);
    const others = new Set(); f.mine.forEach((s, j) => { if (j !== ui.held) cellsOf(s).forEach(c => others.add(key(...c))); });
    const ok = cells.every(([x, y]) => x < SIZE && y < SIZE && !others.has(key(x, y)));
    for (const [x, y] of cells) { const c = el.querySelector(`.mine .cell[data-x="${x}"][data-y="${y}"]`); if (c) c.classList.add(ok ? 'drop' : 'bad'); }
  }
  const drop = () => {
    const { fleet: f } = get();
    if (ui.held == null || !f || f.phase !== 'deploy') { ui.held = null; return; }
    if (ui.hover) send({ act: 'place', i: ui.held, x: ui.hover[0], y: ui.hover[1], dir: ui.heldDir });
    ui.held = null; ui.hover = null; ui.key = ''; render();
  };
  const turn = () => { if (ui.held != null) { ui.heldDir = ui.heldDir === 'h' ? 'v' : 'h'; const { fleet: f } = get(); if (f) paintHover(f); } };
  addEventListener('pointerup', drop);
  addEventListener('keydown', e => { if ((e.key === 'r' || e.key === 'R') && ui.held != null) { e.preventDefault(); turn(); } });
  el.addEventListener('contextmenu', e => { if (get().fleet && get().fleet.phase === 'deploy') { e.preventDefault(); turn(); } });
  return { render };
}
