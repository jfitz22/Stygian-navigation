// Fleet command: the Watch's naval battle as two plotting tables. Mounted on the operator's cabin wall, on the Fleet
// Officer's station and (to watch) on every officer's station. It only draws a fleet state and calls send(action);
// the game decides what happens.
//   command: deploy our ships, aim the salvo, fire, place the specials, work the salvage boards, redeploy
//   view:    the same tables, to watch
//   opts.compact: the small version for the departments' stations (tables side by side, a short log, no salvage)
// mountFleetDept draws a department's flag hoist, rune pad and Morse question, for loading its special.
import { SIZE, SHIPS, SHIP_NAMES, ENEMY_NAMES, COL_RUNES, CREW, PAD, SPECIAL, SPECIAL_NAME, HOIST, REDEPLOY_WAIT, cellsOf, sunk, afloat, flagSVG, padName, crosshairCells } from './fleet.js';
import { glyphSVG } from './glyphs.js';
import { ACTIONS } from './repair.js';
import { toMorse } from './morse.js';

const css = `
.fl { font-family: 'IBM Plex Mono', monospace; color: #e8dfc6; display: grid; gap: 8px; align-content: start; }
.fl .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.fl .status { flex: 1; min-width: 200px; font-size: 13px; letter-spacing: 1px; color: #cfc6ab; min-height: 18px; }
.fl .status b { color: #ffb347; }
.fl .clockbar { height: 7px; background: #0a0806; border: 1px solid #3a2d1c; border-radius: 4px; overflow: hidden; }
.fl .clockbar i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #a3291c, #ffb347); transition: width .25s linear; }
.fl .body { display: flex; gap: 14px; align-items: flex-start; flex-wrap: wrap; }
.fl .tables { display: flex; gap: 14px; flex-wrap: wrap; align-items: flex-start; }
.fl.compact .tables { gap: 8px; flex-wrap: nowrap; }
.fl .side { flex: 1 1 260px; min-width: 240px; max-width: 460px; display: grid; gap: 8px; align-content: start; }
.fl .table .lbl { font-size: 11px; letter-spacing: 2px; color: #b9a77c; margin: 0 0 3px 2px; }
.fl.compact .table .lbl { font-size: 10px; letter-spacing: 1px; }
.fl .table .lbl b { color: #e8cf98; }
.fl svg.plot { display: block; border: 2px solid #6e5430; border-radius: 6px; box-shadow: inset 0 0 30px #000, 0 2px 10px #000; max-width: 100%; height: auto; }
.fl.cmd .enemyT svg { cursor: crosshair; }
.fl .hull { cursor: grab; }
.fl .go { background: #5a1a12; color: #fdd; border: 2px solid #c33; padding: 0 22px; letter-spacing: 3px; font: 600 15px 'Cinzel', serif; height: 42px; cursor: pointer; border-radius: 3px; }
.fl .go:disabled { opacity: .35; cursor: default; }
.fl .aimed { font: 600 22px 'Share Tech Mono', monospace; color: #ffb347; }
.fl .specials { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 12px; }
.fl .sp { display: inline-flex; align-items: center; gap: 6px; background: #1b1712; color: #e8cf98; border: 1px solid #6e5430; padding: 5px 10px 5px 6px; font: 600 12px 'IBM Plex Mono', monospace; letter-spacing: 1px; cursor: pointer; border-radius: 3px; touch-action: none; }
.fl .sp svg { flex: none; }
.fl .sp.ready { box-shadow: 0 0 0 1px #ffb347 inset; animation: flready 1.6s ease-in-out infinite alternate; }
.fl .sp.armed { background: #6e5430; color: #000; animation: none; } .fl .sp.planned { border-color: #5cff9d; color: #5cff9d; animation: none; }
.fl .sp.off { opacity: .35; cursor: default; animation: none; box-shadow: none; }
@keyframes flready { from { box-shadow: 0 0 0 1px #ffb347 inset, 0 0 2px #ffb347; } to { box-shadow: 0 0 0 1px #ffb347 inset, 0 0 10px #ffb347; } }
.fl .tip { font-size: 12px; color: #ffcf7a; min-height: 16px; }
.fl .log { font-size: 12px; line-height: 1.5; max-height: 152px; overflow: hidden; background: #0a0f12; border: 1px solid #1e2c33; border-radius: 4px; padding: 5px 8px; }
.fl.compact .log { max-height: 58px; font-size: 11px; }
.fl .log div { opacity: .55; } .fl .log div:first-child { opacity: 1; } .fl .log div:nth-child(2) { opacity: .8; }
.fl .log .hit { color: #ffb347; } .fl .log .struck { color: #ff8a7a; } .fl .log .info { color: #5cff9d; } .fl .log .miss { color: #b9c4c8; }
.fl .dock { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.fl .dock .dship { cursor: grab; padding: 2px 4px; border: 1px dashed #4a5560; border-radius: 4px; }
.fl .dock .dship.placed { opacity: .35; }
.fl .dock .dship small { display: block; font-size: 9px; letter-spacing: 1px; color: #9aa; text-align: center; }
.fl .btn2 { background: #1b1712; color: #e8cf98; border: 1px solid #6e5430; padding: 7px 12px; font: 600 12px 'IBM Plex Mono', monospace; letter-spacing: 1px; cursor: pointer; border-radius: 3px; }
.fl .btn2:disabled { opacity: .35; cursor: default; }
.fl .btn2.on { background: #e8cf98; color: #111; }
.fl .ready { background: #1f4a3a; color: #d9ffe6; border: 2px solid #2bd96b; padding: 8px 16px; font: 600 13px 'Cinzel', serif; letter-spacing: 3px; cursor: pointer; border-radius: 3px; }
.fl .ready:disabled { opacity: .35; cursor: default; }
.fl .hint { font-size: 11px; color: #8e9a90; }
.fl .salvage { border: 1px solid #6e5430; border-radius: 5px; padding: 8px 10px; background: #120f0b; }
.fl .salvage.wait { border-color: #ffb347; } .fl .salvage.go { border-color: #5cff9d; box-shadow: 0 0 10px rgba(92,255,157,.25); }
.fl .salvage h4 { margin: 0 0 6px; font: 600 13px 'Cinzel', serif; letter-spacing: 2px; color: #ffb347; }
.fl .salvage .big { font: 600 13px 'IBM Plex Mono', monospace; letter-spacing: 1px; color: #ffcf7a; margin: 4px 0; }
.fl .salvage.go .big { color: #5cff9d; }
.fl .srow { display: grid; grid-template-columns: 62px 40px 48px repeat(3, auto); gap: 5px; align-items: center; margin: 3px 0; font-size: 12px; }
.fl .srow i { display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 1px solid #000; margin-right: 2px; }
.fl .srow button { background: #1b1712; color: #cfc6ab; border: 1px solid #4a3a24; padding: 3px 6px; font: 600 11px 'IBM Plex Mono', monospace; cursor: pointer; border-radius: 3px; }
.fl .srow button.on { background: #e8cf98; color: #111; }
.fl .regroup { border: 1px dashed #ffb347; border-radius: 6px; padding: 18px; text-align: center; color: #ffcf7a; font: 600 13px 'IBM Plex Mono', monospace; letter-spacing: 2px; }
@keyframes flshell { from { transform: translate(var(--sx), var(--sy)) scale(1.6); opacity: .2; } 85% { opacity: 1; } to { transform: translate(0, 0) scale(.6); opacity: 0; } }
@keyframes flring { 0% { transform: scale(.15); opacity: 0; } 40% { opacity: 1; } 100% { transform: scale(1.8); opacity: 0; } }
@keyframes flburn { from { opacity: .55; } to { opacity: 1; } }
@keyframes flburst { 0% { transform: scale(.2); opacity: 0; } 30% { opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes flsweepx { from { transform: scaleX(0); opacity: .9; } 80% { opacity: .7; } to { transform: scaleX(1); opacity: 0; } }
@keyframes flsweepy { from { transform: scaleY(0); opacity: .9; } 80% { opacity: .7; } to { transform: scaleY(1); opacity: 0; } }
@keyframes flflash { 0%, 100% { opacity: 0; } 20%, 60% { opacity: 1; } 40%, 80% { opacity: .3; } }
@keyframes flwake { from { opacity: .9; } to { opacity: 0; } }
.fl .shell { animation: flshell .6s ease-in both; transform-box: fill-box; transform-origin: center; }
.fl .ring { animation: flring .9s ease-out both; transform-box: fill-box; transform-origin: center; }
.fl .flame { animation: flburn .5s ease-in-out infinite alternate; }
.fl .burst { animation: flburst 1.1s ease-out both; transform-box: fill-box; transform-origin: center; }
.fl .sweepx { animation: flsweepx 1.4s ease-out both; transform-box: fill-box; transform-origin: left; }
.fl .sweepy { animation: flsweepy 1.4s ease-out both; transform-box: fill-box; transform-origin: top; }
.fl .flash { animation: flflash 1.6s ease-in-out both; }
.fl .wake { animation: flwake 2s ease-out both; }
.fd { display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: start; font-family: 'IBM Plex Mono', monospace; color: #e8dfc6; }
.fd .hoist { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; padding: 5px; background: #0a0806; border: 1px solid #3a2d1c; border-radius: 4px; min-width: 60px; min-height: 150px; justify-content: center; }
.fd .pad { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.fd .pad button { background: #1b1712; border: 1px solid #6e5430; border-radius: 3px; padding: 3px 2px; cursor: pointer; color: #e8cf98; display: flex; flex-direction: column; align-items: center; font: 600 10px 'IBM Plex Mono', monospace; letter-spacing: 1px; }
.fd .pad button:disabled { opacity: .35; cursor: default; }
.fd .code { display: flex; gap: 5px; align-items: center; min-height: 30px; margin: 4px 0; }
.fd .state { font-size: 12px; color: #9aa59c; } .fd .state.ok { color: #5cff9d; } .fd .state.bad { color: #ff8a7a; }
.fd .morse { font: 600 20px 'Share Tech Mono', monospace; letter-spacing: 3px; color: #ffd36a; background: #0a0806; border: 1px solid #3a2d1c; border-radius: 4px; padding: 6px 10px; margin: 6px 0; word-break: break-word; line-height: 1.4; }
.fd .answers { display: grid; gap: 5px; }
.fd .answers button { text-align: left; background: #1b1712; color: #ffd36a; border: 1px solid #6e5430; border-radius: 3px; padding: 6px 10px; font: 600 18px 'Share Tech Mono', monospace; letter-spacing: 3px; cursor: pointer; }
.fd .answers button b { font: 600 11px 'IBM Plex Mono', monospace; color: #b9a77c; letter-spacing: 1px; margin-right: 10px; }
.fd .locked { font: 600 14px 'IBM Plex Mono', monospace; color: #ff8a7a; letter-spacing: 2px; }
`;
let styled = false;
const style = () => { if (!styled) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); styled = true; } };
const LIGHT_COL = { R: '#e33b2a', Y: '#f2b01e', G: '#2bb35e' };
export const CREW_COL = { fleet: '#c9a24b', gunnery: '#d9573f', signals: '#5b9bd5', engineer: '#5cbf7a' };
const CREW_NAME = { fleet: 'FLEET OFFICER', gunnery: 'GUNNERY', signals: 'SIGNALS', engineer: 'ENGINEERING' };
const shipCrew = i => i === 0 ? 'FLEET OFFICER (MAIN)' : CREW_NAME[CREW[i]];
// Dots and dashes, big enough to read across a table.
export const morseText = s => toMorse(s).replace(/\./g, '•').replace(/-/g, '−').replace(/ \/ /g, '   /   ');
// The specials' icons (24 x 24, currentColor).
export const SP_ICON = {
  heavy: '<svg width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5M4 4l3.5 3.5M16.5 16.5L20 20M20 4l-3.5 3.5M7.5 16.5L4 20"/></g></svg>',
  sounding: '<svg width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="4" cy="12" r="2" fill="currentColor"/><path d="M8 7a7 7 0 0 1 0 10M12 4a11 11 0 0 1 0 16M16 1.5a14 14 0 0 1 0 21"/></g></svg>',
  boost: '<svg width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 5l7 7-7 7M12 5l7 7-7 7"/></g></svg>',
  scan: '<svg width="24" height="24" viewBox="0 0 24 24"><g fill="currentColor"><rect x="9" y="9" width="6" height="6"/><rect x="9" y="1" width="6" height="7" opacity=".7"/><rect x="9" y="16" width="6" height="7" opacity=".7"/><rect x="2" y="9" width="6" height="6" opacity=".7"/><rect x="16" y="9" width="6" height="6" opacity=".7"/></g></svg>',
};
const SP_TIP = {
  heavy: 'A 2 × 2 burst; uses one red or orange beacon. Loaded by Gunnery.',
  sounding: 'Drag onto their table; R turns it; counts the ship squares in that row or column. Loaded by Signals.',
  boost: 'Moves one of our ships a square (the enemy loses track of her). Loaded by Engineering.',
  scan: 'Seven squares in a cross; R turns the long arm. Enemy hulls under it are sighted, not hit. Reloaded by decoding a dispatch.',
};

// el: container · get(): { fleet, t, mode: 'command' | 'view', beacons, engineerLive } · send(action)
// opts: { cell, onShot(last), compact }
export function mountFleet(el, get, send, opts = {}) {
  style(); el.classList.add('fl'); el.classList.toggle('compact', !!opts.compact);
  const C = opts.cell || 30, M = 24, W = M + SIZE * C + 6;
  const ui = { held: null, heldDir: 'h', grab: 0, hover: null, sel: null, key: '', armed: null, soundDir: 'row', scanDir: 'v', boostShip: null, redeploy: null, animRound: null, seenRound: null };
  const P = (x, y) => [M + x * C, M + y * C];
  const cmd = () => get().mode === 'command';

  function hull(len, color, stroke) {
    const L = len * C, y0 = C * 0.2, y1 = C * 0.8, bow = C * 0.42;
    let g = `<path d="M ${C * 0.18} ${y0} L ${L - bow} ${y0} Q ${L - C * 0.06} ${C * 0.5} ${L - bow} ${y1} L ${C * 0.18} ${y1} Q ${C * 0.04} ${C * 0.5} ${C * 0.18} ${y0} Z" fill="${color}" stroke="${stroke}" stroke-width="1.5"/>`;
    g += `<line x1="${C * 0.3}" y1="${C * 0.5}" x2="${L - bow}" y2="${C * 0.5}" stroke="rgba(0,0,0,.35)"/>`;
    for (let i = 0; i < len; i++) g += `<circle cx="${i * C + C * 0.5}" cy="${C * 0.5}" r="${C * 0.13}" fill="rgba(0,0,0,.4)" stroke="${stroke}" stroke-width=".8"/>`;
    return g;
  }
  const place = s => s.dir === 'h' ? `translate(${P(s.x, s.y).join(',')})` : `translate(${P(s.x, s.y)[0] + C},${P(s.x, s.y)[1]}) rotate(90)`;
  function sea(kind) {
    const cx = M + SIZE * C / 2, cy = cx;
    let b = `<defs><radialGradient id="sea-${kind}${C}" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${kind === 'mine' ? '#0f2a2c' : '#132226'}"/><stop offset="1" stop-color="#040a0c"/></radialGradient>
      <radialGradient id="flame${C}" cx="50%" cy="60%" r="50%"><stop offset="0" stop-color="#fff1c0"/><stop offset=".45" stop-color="#ff7a2a"/><stop offset="1" stop-color="rgba(255,60,30,0)"/></radialGradient></defs>`;
    b += `<rect width="${W}" height="${W}" fill="url(#sea-${kind}${C})"/>`;
    for (const r of [1, 2, 3]) b += `<circle cx="${cx}" cy="${cy}" r="${r * SIZE * C / 6.5}" fill="none" stroke="rgba(92,255,157,.09)"/>`;
    for (let i = 0; i <= SIZE; i++) b += `<line x1="${M + i * C}" y1="${M}" x2="${M + i * C}" y2="${M + SIZE * C}" stroke="rgba(127,216,255,.08)"/><line x1="${M}" y1="${M + i * C}" x2="${M + SIZE * C}" y2="${M + i * C}" stroke="rgba(127,216,255,.08)"/>`;
    for (let x = 0; x < SIZE; x++) b += `<g transform="translate(${M + x * C + C / 2 - 7},5)" color="#e8cf98">${glyphSVG(COL_RUNES[x], 14)}</g>`;
    for (let y = 0; y < SIZE; y++) b += `<text x="${M / 2}" y="${M + y * C + C / 2 + 4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#b9a77c">${y + 1}</text>`;
    return b;
  }
  const flame = (x, y) => { const [px, py] = P(x, y); return `<circle class="flame" cx="${px + C / 2}" cy="${py + C / 2}" r="${C * 0.32}" fill="url(#flame${C})"/>`; };
  const ring = (x, y) => { const [px, py] = P(x, y); return `<circle cx="${px + C / 2}" cy="${py + C / 2}" r="${C * 0.16}" fill="none" stroke="#7fa6b3" stroke-width="1.5"/>`; };
  const lineRect = (line, n, pad = 0) => { const row = line === 'row', [px, py] = row ? P(0, n) : P(n, 0); return { x: px + pad, y: py + pad, w: (row ? SIZE * C : C) - 2 * pad, h: (row ? C : SIZE * C) - 2 * pad, row }; };
  const cellsRect = (cells, fill, stroke, extra = '') => cells.map(([x, y]) => { const [px, py] = P(x, y); return `<rect ${extra} x="${px + 2}" y="${py + 2}" width="${C - 4}" height="${C - 4}" rx="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`; }).join('');
  function landing(list, mine) {   // the shells of the latest salvo coming down
    let b = '';
    list.forEach(([x, y, r], i) => { const [px, py] = P(x, y), mx = px + C / 2, my = py + C / 2, d = (i * 0.08).toFixed(2);
      b += `<circle class="shell" style="--sx:${mine ? 60 : -60}px;--sy:-120px;animation-delay:${d}s" cx="${mx}" cy="${my}" r="4" fill="#ffe4a0"/><circle class="ring" style="animation-delay:${(i * 0.08 + 0.55).toFixed(2)}s" cx="${mx}" cy="${my}" r="${C * 0.55}" fill="${r === 'hit' ? `url(#flame${C})` : 'none'}" stroke="${r === 'hit' ? '#ff7a2a' : '#9ad0ff'}" stroke-width="2"/>`; });
    return b;
  }

  function enemyTable(f) {
    let b = sea('enemy');
    for (const sd of f.soundings) {
      const r = lineRect(sd.line, sd.n);
      b += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="rgba(91,155,213,.13)"/>`;
      b += `<text x="${r.row ? M + SIZE * C - 4 : r.x + C / 2}" y="${r.row ? r.y + C / 2 + 4 : M + SIZE * C + 2}" text-anchor="${r.row ? 'end' : 'middle'}" font-family="Cinzel" font-weight="800" font-size="${C * 0.5}" fill="#9fd0ff" opacity=".9">${sd.count}</text>`;
    }
    if (f.scanned && f.scanned.length) b += cellsRect(f.scanned, 'rgba(92,255,214,.06)', 'rgba(92,255,214,.35)', 'stroke-dasharray="2 3"');
    f.enemy.forEach((s, i) => { if (sunk(s)) b += `<g transform="${place(s)}">${hull(s.len, '#3a1410', '#a33')}<title>${ENEMY_NAMES[i]}</title></g>`; });
    for (const [k, v] of Object.entries(f.marks)) {
      const [x, y] = k.split(',').map(Number), [px, py] = P(x, y);
      if (v === 'hit') b += flame(x, y);
      else if (v === 'miss') b += ring(x, y);
      else if (v === 'clear') b += `<circle cx="${px + C / 2}" cy="${py + C / 2}" r="${C * 0.06}" fill="#5c6a6c"/>`;
      else if (v === 'seen') b += `<rect x="${px + 3}" y="${py + 3}" width="${C - 6}" height="${C - 6}" rx="${C / 4}" fill="rgba(255,179,71,.12)" stroke="#ffb347" stroke-dasharray="4 3" stroke-width="2"><title>an enemy hull, sighted (not yet hit)</title></rect>`;
    }
    for (const [x, y] of f.aim) { const [px, py] = P(x, y), mx = px + C / 2, my = py + C / 2; b += `<circle cx="${mx}" cy="${my}" r="${C * 0.34}" fill="none" stroke="#ffb347" stroke-width="2.5"/><line x1="${mx}" y1="${py + 2}" x2="${mx}" y2="${py + C - 2}" stroke="#ffb347"/><line x1="${px + 2}" y1="${my}" x2="${px + C - 2}" y2="${my}" stroke="#ffb347"/>`; }
    if (f.plan.heavy) { const [px, py] = P(f.plan.heavy.x, f.plan.heavy.y); b += `<rect x="${px + 2}" y="${py + 2}" width="${2 * C - 4}" height="${2 * C - 4}" fill="rgba(217,87,63,.18)" stroke="#d9573f" stroke-width="3" stroke-dasharray="7 4"/>`; }
    if (f.plan.sounding) { const r = lineRect(f.plan.sounding.line, f.plan.sounding.n, 1); b += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="#5b9bd5" stroke-width="3" stroke-dasharray="7 4"/>`; }
    if (f.plan.scan) b += cellsRect(crosshairCells(f.plan.scan.x, f.plan.scan.y, f.plan.scan.dir), 'rgba(92,255,214,.15)', '#5cffd6', 'stroke-dasharray="5 3"');
    if (f.last && ui.animRound === f.last.round) {
      const u = f.last.used || {};
      if (u.sounding) { const r = lineRect(u.sounding.line, u.sounding.n); b += `<rect class="${r.row ? 'sweepx' : 'sweepy'}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="rgba(159,208,255,.45)"/>`; }
      if (u.scan) b += cellsRect(u.scan, 'rgba(92,255,214,.5)', '#5cffd6', 'class="flash"');
      if (u.heavy) { const [px, py] = P(u.heavy.x, u.heavy.y); b += `<circle class="burst" cx="${px + C}" cy="${py + C}" r="${C * 1.3}" fill="url(#flame${C})" stroke="#ffb347" stroke-width="3"/>`; }
      b += landing(f.last.ours, false);
    }
    b += `<g class="preview"></g>`;
    return `<svg class="plot" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${b}</svg>`;
  }
  function ourTable(f) {
    let b = sea('mine');
    if (f.enemySonar) {   // the enemy's last sounding of our water
      const r = lineRect(f.enemySonar.line, f.enemySonar.n);
      b += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="rgba(255,75,58,.12)" stroke="rgba(255,75,58,.5)" stroke-dasharray="6 4"><title>the enemy sounded this line: ${f.enemySonar.count} of our squares</title></rect>`;
      if (f.last && ui.animRound === f.last.round && f.enemySonar.round === f.last.round) b += `<rect class="${r.row ? 'sweepx' : 'sweepy'}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="rgba(255,75,58,.45)"/>`;
      b += `<text x="${r.row ? M + SIZE * C - 4 : r.x + C / 2}" y="${r.row ? r.y + C / 2 + 4 : M + SIZE * C + 2}" text-anchor="${r.row ? 'end' : 'middle'}" font-family="Cinzel" font-weight="800" font-size="${C * 0.5}" fill="#ff8a7a">${f.enemySonar.count}</text>`;
    }
    f.mine.forEach((s, i) => {
      if (s.x == null) return;
      const gone = sunk(s), col = gone ? '#3a3a3a' : ui.sel === i || ui.boostShip === i ? '#8c9aa6' : '#5d6873';
      b += `<g class="hull" data-i="${i}" transform="${place(s)}" ${gone ? 'opacity=".55"' : ''}>${hull(s.len, col, gone ? '#777' : CREW_COL[s.crew])}<title>${SHIP_NAMES[i]} · ${shipCrew(i)}${gone ? ' · SUNK' : ''}</title></g>`;
    });
    for (const [k, v] of Object.entries(f.theirShots)) { const [x, y] = k.split(',').map(Number); b += v === 'hit' ? flame(x, y) : ring(x, y); }
    if (f.plan.boost) { const s = f.mine[f.plan.boost.ship]; if (s) b += `<g transform="${place({ ...s, x: s.x + f.plan.boost.dx, y: s.y + f.plan.boost.dy })}" opacity=".6">${hull(s.len, 'none', '#5cbf7a')}</g>`; }
    if (f.last && ui.animRound === f.last.round) {
      const u = f.last.used || {};
      if (u.boost && f.mine[u.boost.ship]) { const s = f.mine[u.boost.ship]; b += `<g class="wake" transform="${place({ ...s, x: s.x - u.boost.dx, y: s.y - u.boost.dy })}">${hull(s.len, 'rgba(92,191,122,.25)', '#5cbf7a')}</g>`; }
      b += landing(f.last.theirs, true);
    }
    b += `<g class="preview"></g>`;
    return `<svg class="plot" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${b}</svg>`;
  }
  // the right-hand column: one dashboard for every ship of ours that is down
  function salvagePanels(f, g, command) {
    const list = Object.entries(f.salvage); if (!list.length) return '';
    return list.map(([i, s]) => {
      const ready = s.done && s.power, eng = g.engineerLive !== false;
      let state;
      if (ready) state = `<div class="big">READY TO REDEPLOY</div><div class="hint">${command ? 'Place her anywhere free on our table (R turns her), or at random.' : 'The Fleet Officer places her.'} If she waits ${REDEPLOY_WAIT} salvos she is put to sea for you.</div>
        ${command ? `<div style="display:flex;gap:6px;margin-top:6px"><button class="btn2${ui.redeploy === Number(i) ? ' on' : ''}" data-redeploy="${i}">PLACE HER</button><button class="btn2" data-redeployrandom="${i}">AT RANDOM</button></div>` : ''}`;
      else if (s.done) state = `<div class="big">WAITING ON POWER FROM ENGINEERING</div><div class="hint">The breaker panel: clear it and choose POWER THE SUNK SHIP.${eng ? '' : ' Nobody holds Engineering: the operator can (LOOK RIGHT).'}</div>`;
      else state = `<div class="hint">${command ? 'Read each row to Engineering; set what their flowchart says; send the salvage crew.' : 'The Fleet Officer works this board with Engineering.'} ${s.power ? 'Power: <b style="color:#5cff9d">ON</b>.' : eng ? 'Then power from Engineering\'s breaker panel.' : 'Then power from the breaker panel: nobody holds Engineering, so the operator works it (LOOK RIGHT).'}</div>
        ${s.board.rows.map((r, j) => `<div class="srow"><span>${r.lights.map(l => `<i style="background:${LIGHT_COL[l]}"></i>`).join('')}</span><b>${r.gauge}</b><b>${r.code}</b>${ACTIONS.map(a => `<button data-sal="${i}" data-row="${j}" data-act="${a}" class="${r.set === a ? 'on' : ''}" ${command ? '' : 'disabled'}>${a}</button>`).join('')}</div>`).join('')}
        ${command ? `<button class="btn2" data-salsend="${i}" ${s.board.rows.every(r => r.set) ? '' : 'disabled'}>SEND THE SALVAGE CREW</button>` : ''}`;
      return `<div class="salvage${ready ? ' go' : s.done ? ' wait' : ''}"><h4>SALVAGE · ${SHIP_NAMES[i]} <span class="hint">(${shipCrew(Number(i))})</span></h4>${state}</div>`;
    }).join('');
  }

  function render() {
    const g = get(), f = g.fleet;
    if (!f || f.phase === 'off') { if (el.innerHTML) el.innerHTML = ''; ui.key = ''; return; }
    if (f.last && f.last.round !== ui.seenRound) { const fresh = ui.seenRound !== null; ui.seenRound = f.last.round; if (fresh) { ui.animRound = f.last.round; if (opts.onShot) opts.onShot(f.last); setTimeout(() => { ui.animRound = null; ui.key = ''; }, 2400); } }
    if (ui.redeploy != null && !(f.salvage[ui.redeploy] && f.salvage[ui.redeploy].done && f.salvage[ui.redeploy].power)) ui.redeploy = null;
    const k = JSON.stringify([g.mode, f.phase, f.mine, f.marks, f.theirShots, f.aim, f.plan, f.loaded, f.soundings, f.salvage, f.round, f.wave, f.log.length, f.scanned, f.enemySonar, ui.held, ui.sel, ui.armed, ui.boostShip, ui.redeploy, ui.animRound, g.beacons, g.engineerLive]);
    if (k !== ui.key) { ui.key = k; build(f, g); }
    status(f, g);
  }
  function status(f, g) {
    const st = el.querySelector('.status'), bar = el.querySelector('.clockbar'); if (!st) return;
    let text, frac = 0;
    if (f.phase === 'deploy') text = g.mode === 'command' ? 'DEPLOY THE FLEET. Drag each ship onto our table (ships may not touch). ROTATE, R or right click turns it.' : 'The fleet is being deployed.';
    else if (f.phase === 'refit') { const s = Math.max(0, Math.ceil(f.refitUntil - g.t)); text = `<b>THE FLEET IS LOST.</b> Refitted and back on station in <b>${s} s</b>.`; frac = s / 60; }
    else if (f.phase === 'regroup') { const s = Math.max(0, Math.ceil(f.regroupUntil - g.t)); text = `<b>THE ENEMY HAS FALLEN BACK</b> to await reinforcements · a new fleet in <b>${s} s</b>`; frac = s / 90; }
    else { const s = Math.max(0, Math.ceil(f.nextSalvo - g.t)); text = `<b>NEXT SALVO IN ${s} s</b> · ${opts.compact ? '' : `time between salvos ${f.salvoEvery} s · `}wave ${f.wave}`; frac = s / f.salvoEvery; }
    if (st.innerHTML !== text) st.innerHTML = text;
    if (bar) bar.firstElementChild.style.width = (Math.min(1, frac) * 100).toFixed(1) + '%';
  }

  function build(f, g) {
    const command = g.mode === 'command', deploying = f.phase === 'deploy', play = f.phase === 'play';
    el.classList.toggle('cmd', command);
    const n = afloat(f.mine).length;
    const dock = deploying && command ? `<div class="dock">${f.mine.map((s, i) => `<div class="dship${s.x != null ? ' placed' : ''}" data-i="${i}"><svg width="${SHIPS[i] * 16}" height="16" viewBox="0 0 ${SHIPS[i] * C} ${C}">${hull(SHIPS[i], '#5d6873', CREW_COL[CREW[i]])}</svg><small>${SHIP_NAMES[i]} · ${shipCrew(i)}</small></div>`).join('')}
        <button class="btn2" data-rot>⟳ ROTATE</button><button class="btn2" data-random>RANDOM</button>
        <button class="ready" ${f.mine.every(s => s.x != null) ? '' : 'disabled'}>THE FLEET IS READY · BEGIN THE WATCH</button></div>` : '';
    const fire = play && command ? `<button class="go">FIRE</button><span class="aimed">${f.aim.length}/${n}</span><span class="hint">shots aimed</span>` : '';
    const sp = play && !opts.compact ? `<div class="specials">${['heavy', 'sounding', 'boost', 'scan'].map(kind => {
      const loaded = !!f.loaded[kind], planned = !!f.plan[kind], noBeacon = kind === 'heavy' && g.beacons != null && g.beacons <= 0;
      return `<button class="sp${ui.armed === kind ? ' armed' : ''}${planned ? ' planned' : loaded && command ? ' ready' : ''}${!loaded || !command ? ' off' : ''}" data-sp="${kind}" title="${SP_TIP[kind]}">${SP_ICON[kind]}${SPECIAL_NAME[kind]}${planned ? ' ✓' : loaded ? '' : ' · not loaded'}${noBeacon && loaded ? ' (NO BEACON)' : ''}</button>`;
    }).join('')}</div><div class="tip"></div>` : play && opts.compact ? `<div class="specials">${['heavy', 'sounding', 'boost', 'scan'].map(kind => `<span title="${SPECIAL_NAME[kind]}" style="display:inline-flex;align-items:center;gap:3px;color:${f.loaded[kind] ? '#ffb347' : '#555'}">${SP_ICON[kind]}${f.loaded[kind] ? 'READY' : '—'}</span>`).join('')}</div>` : '';
    const enemy = play || f.phase === 'refit' ? `<div class="table enemyT"><div class="lbl">THEIR WATERS · <b>${afloat(f.enemy).length}</b> OF ${ENEMY_NAMES.length} AFLOAT</div>${enemyTable(f)}</div>`
      : f.phase === 'regroup' ? `<div class="table enemyT"><div class="lbl">THEIR WATERS</div><div class="regroup" style="width:${W}px;max-width:100%">THE ENEMY HAS FALLEN BACK<br>TO AWAIT REINFORCEMENTS</div></div>` : '';
    const legend = `<div class="hint" style="margin-top:3px">${f.mine.map((s, i) => `<span style="color:${CREW_COL[s.crew]}">■ ${opts.compact ? shipCrew(i).replace(' (MAIN)', '★').replace('ENGINEERING', 'ENG.').replace('FLEET OFFICER', 'FLEET') : shipCrew(i)}${sunk(s) ? ' (SUNK)' : s.hits.length ? ' (' + s.hits.length + ')' : ''}</span>`).join(' · ')}</div>`;
    const log = `<div class="log">${f.log.slice(opts.compact ? -3 : -9).reverse().map(l => `<div class="${l.kind}">${l.text}</div>`).join('') || '<div class="info">The enemy fleet is out there somewhere.</div>'}</div>`;
    const tables = `<div class="tables">${enemy}<div class="table ourT"><div class="lbl">OUR FLEET · <b>${afloat(f.mine).length}</b> OF ${SHIP_NAMES.length} AFLOAT</div>${ourTable(f)}${legend}</div></div>`;
    const down = Object.keys(f.salvage).length;
    el.innerHTML = `<div class="top"><div class="status"></div>${fire}</div><div class="clockbar"><i></i></div>${dock}${sp}
      ${opts.compact ? `${tables}${down ? `<div class="hint" style="color:#ffb347">${down} of ours down: the Fleet Officer is salvaging${down > 1 ? ' them' : ' her'}.</div>` : ''}${log}`
        : `<div class="body">${tables}<div class="side">${salvagePanels(f, g, command)}${log}<div class="hint">Victories ${f.wins} · fleets lost ${f.losses}${command ? '' : ' · the Fleet Officer commands the fleet'}</div></div></div>`}`;
    if (command && play) wirePlay(f);
    if (command && deploying) wireDeploy(f);
    if (command) {
      el.querySelectorAll('[data-sal]').forEach(b => b.onclick = () => send({ act: 'salvageset', i: Number(b.dataset.sal), row: Number(b.dataset.row), action: b.dataset.act }));
      el.querySelectorAll('[data-salsend]').forEach(b => b.onclick = () => send({ act: 'salvagesend', i: Number(b.dataset.salsend) }));
      el.querySelectorAll('[data-redeploy]').forEach(b => b.onclick = () => { const i = Number(b.dataset.redeploy); ui.redeploy = ui.redeploy === i ? null : i; ui.armed = null; ui.heldDir = 'h'; ui.key = ''; render(); });
      el.querySelectorAll('[data-redeployrandom]').forEach(b => b.onclick = () => { send({ act: 'redeploy', i: Number(b.dataset.redeployrandom), random: true }); ui.redeploy = null; });
    }
    tip(f);
  }
  function tip(f) {
    const t = el.querySelector('.tip'); if (!t) return;
    t.innerHTML = ui.redeploy != null ? `REDEPLOY ${SHIP_NAMES[ui.redeploy]}: click our table where she should go. R turns her (now ${ui.heldDir === 'h' ? 'ACROSS' : 'DOWN'}). Esc cancels.` :
      ui.armed === 'heavy' ? 'HEAVY SHELL: click their table where the 2 × 2 should land. Esc cancels.' :
      ui.armed === 'sounding' ? `SOUNDING: drag it over their table and let go (or click). R turns it: now a ${ui.soundDir === 'row' ? 'ROW' : 'COLUMN'}.` :
      ui.armed === 'scan' ? `CROSSHAIR SCAN: click their table for the centre. R turns the long arm: now ${ui.scanDir === 'v' ? 'UP AND DOWN' : 'ACROSS'}.` :
      ui.armed === 'boost' ? (ui.boostShip == null ? 'BOOST: click one of our ships.' : 'BOOST: an arrow key (or click a square next to it) sends it one square that way.') : '';
  }
  // the square under the pointer; the screen matrix keeps it right when a damaged station lists to one side
  function cellAt(svg, e) {
    let px, py; const m = svg.getScreenCTM && svg.getScreenCTM();
    if (m) { const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); px = q.x; py = q.y; }
    else { const r = svg.getBoundingClientRect(); px = (e.clientX - r.left) * W / r.width; py = (e.clientY - r.top) * W / r.height; }
    const x = Math.floor((px - M) / C), y = Math.floor((py - M) / C);
    return x >= 0 && y >= 0 && x < SIZE && y < SIZE ? [x, y] : null;
  }
  function enemyPreview(svg, c) {
    const g = svg.querySelector('.preview'); if (!g) return;
    if (!c) { g.innerHTML = ''; return; }
    if (ui.armed === 'sounding') { const r = lineRect(ui.soundDir, ui.soundDir === 'row' ? c[1] : c[0]); g.innerHTML = `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="rgba(91,155,213,.25)" stroke="#9fd0ff" stroke-width="2"/>`; }
    else if (ui.armed === 'scan') g.innerHTML = cellsRect(crosshairCells(c[0], c[1], ui.scanDir), 'rgba(92,255,214,.22)', '#5cffd6');
    else if (ui.armed === 'heavy') { const [px, py] = P(Math.min(SIZE - 2, c[0]), Math.min(SIZE - 2, c[1])); g.innerHTML = `<rect x="${px + 2}" y="${py + 2}" width="${2 * C - 4}" height="${2 * C - 4}" fill="rgba(217,87,63,.25)" stroke="#ff8a7a" stroke-width="2"/>`; }
    else g.innerHTML = '';
  }
  function wirePlay(f) {
    const esvg = el.querySelector('.enemyT svg'), osvg = el.querySelector('.ourT svg');
    el.querySelector('.go').onclick = () => send({ act: 'fire' });
    el.querySelectorAll('[data-sp]').forEach(b => {
      const kind = b.dataset.sp;
      b.onpointerdown = e => {
        if (!f.loaded[kind]) return;
        if (f.plan[kind]) { send({ act: 'special', kind, args: null }); ui.armed = null; return; }   // planned already: take it back
        ui.armed = ui.armed === kind ? null : kind; ui.boostShip = null; ui.redeploy = null; ui.key = ''; render();
      };
    });
    if (esvg) {
      esvg.onpointermove = e => enemyPreview(esvg, cellAt(esvg, e));
      esvg.onpointerleave = () => enemyPreview(esvg, null);
      esvg.onclick = e => {
        const c = cellAt(esvg, e); if (!c) return;
        if (ui.armed === 'heavy') { send({ act: 'special', kind: 'heavy', args: { x: c[0], y: c[1] } }); ui.armed = null; return; }
        if (ui.armed === 'sounding') { send({ act: 'special', kind: 'sounding', args: { line: ui.soundDir, n: ui.soundDir === 'row' ? c[1] : c[0] } }); ui.armed = null; return; }
        if (ui.armed === 'scan') { send({ act: 'special', kind: 'scan', args: { x: c[0], y: c[1], dir: ui.scanDir } }); ui.armed = null; return; }
        send({ act: 'aim', x: c[0], y: c[1] });
      };
    }
    if (osvg) {
      osvg.onpointermove = e => { if (ui.redeploy != null) { ui.hover = cellAt(osvg, e); redeployPreview(f); } };
      osvg.onpointerleave = () => { if (ui.redeploy != null) { ui.hover = null; redeployPreview(f); } };
      osvg.onclick = e => {
        const c = cellAt(osvg, e); if (!c) return;
        if (ui.redeploy != null) { send({ act: 'redeploy', i: ui.redeploy, x: c[0], y: c[1], dir: ui.heldDir }); ui.redeploy = null; ui.hover = null; ui.key = ''; return; }
        if (ui.armed !== 'boost') return;
        const i = f.mine.findIndex(s => !sunk(s) && cellsOf(s).some(q => q[0] === c[0] && q[1] === c[1]));
        if (i >= 0) { ui.boostShip = i; ui.key = ''; render(); return; }
        if (ui.boostShip != null) { const s = f.mine[ui.boostShip], cs = cellsOf(s); const near = cs.find(q => Math.abs(q[0] - c[0]) + Math.abs(q[1] - c[1]) === 1); if (near) boost(c[0] - near[0], c[1] - near[1]); }
      };
    }
  }
  function redeployPreview(f) {
    const g = el.querySelector('.ourT .preview'); if (!g) return;
    if (ui.redeploy == null || !ui.hover) { g.innerHTML = ''; return; }
    const s = { len: SHIPS[ui.redeploy], x: ui.hover[0], y: ui.hover[1], dir: ui.heldDir }, cells = cellsOf(s);
    const others = f.mine.filter((o, j) => j !== ui.redeploy && !sunk(o)).flatMap(o => cellsOf(o));
    const ok = cells.every(([x, y]) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && others.every(([ox, oy]) => Math.abs(ox - x) > 1 || Math.abs(oy - y) > 1));
    g.innerHTML = `<g transform="${place(s)}" opacity=".75">${hull(s.len, ok ? '#1f6b45' : '#6b1f1f', ok ? '#5cff9d' : '#ff4b3a')}</g>`;
  }
  function boost(dx, dy) { if (ui.boostShip == null) return; send({ act: 'special', kind: 'boost', args: { ship: ui.boostShip, dx, dy } }); ui.armed = null; ui.boostShip = null; ui.key = ''; }
  // the sounding is dragged: let go over their table to place it
  addEventListener('pointerup', e => {
    const { fleet: f } = get();
    if (ui.armed === 'sounding' && f && f.phase === 'play') {
      const svg = el.querySelector('.enemyT svg'); const c = svg && cellAt(svg, e);
      if (c && e.target.closest && !e.target.closest('[data-sp]')) { send({ act: 'special', kind: 'sounding', args: { line: ui.soundDir, n: ui.soundDir === 'row' ? c[1] : c[0] } }); ui.armed = null; ui.key = ''; }
    }
  });
  addEventListener('pointermove', e => { if (ui.armed !== 'sounding') return; const svg = el.querySelector('.enemyT svg'); if (svg) enemyPreview(svg, cellAt(svg, e)); });

  // deployment: drag a ship from the dock or the table; it lands where the square under the pointer says
  function wireDeploy(f) {
    const svg = el.querySelector('.ourT svg.plot');
    const pick = (i, grab = 0) => { ui.held = i; ui.sel = i; ui.grab = grab; ui.heldDir = f.mine[i].x != null ? f.mine[i].dir : ui.heldDir; };
    el.querySelectorAll('.dship').forEach(d => d.onpointerdown = e => { e.preventDefault(); pick(Number(d.dataset.i), 0); ui.key = ''; render(); });
    el.querySelectorAll('.ourT .hull').forEach(h => h.onpointerdown = e => {
      e.preventDefault(); const i = Number(h.dataset.i), s = f.mine[i], c = cellAt(svg, e);
      pick(i, c ? Math.max(0, s.dir === 'h' ? c[0] - s.x : c[1] - s.y) : 0); ui.key = ''; render();
    });
    el.querySelector('[data-rot]').onclick = rotate;
    el.querySelector('[data-random]').onclick = () => send({ act: 'randomdeploy' });
    el.querySelector('.ready').onclick = () => send({ act: 'ready' });
    if (svg) svg.onpointermove = e => { if (ui.held == null) return; ui.hover = cellAt(svg, e); preview(f); };
  }
  const anchor = () => ui.hover && (ui.heldDir === 'h' ? [ui.hover[0] - ui.grab, ui.hover[1]] : [ui.hover[0], ui.hover[1] - ui.grab]);
  function preview(f) {
    const g = el.querySelector('.ourT .preview'); if (!g) return;
    const a = anchor(); if (ui.held == null || !a) { g.innerHTML = ''; return; }
    const s = { len: SHIPS[ui.held], x: a[0], y: a[1], dir: ui.heldDir }, cells = cellsOf(s);
    const others = f.mine.filter((o, j) => j !== ui.held).flatMap(o => cellsOf(o));
    const ok = cells.every(([x, y]) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && others.every(([ox, oy]) => Math.abs(ox - x) > 1 || Math.abs(oy - y) > 1));
    g.innerHTML = `<g transform="${place(s)}" opacity=".75">${hull(s.len, ok ? '#1f6b45' : '#6b1f1f', ok ? '#5cff9d' : '#ff4b3a')}</g>`;
  }
  function rotate() {
    const { fleet: f } = get(); if (!f) return;
    if (ui.held != null) { ui.heldDir = ui.heldDir === 'h' ? 'v' : 'h'; preview(f); return; }
    if (ui.sel != null && f.mine[ui.sel] && f.mine[ui.sel].x != null) { const s = f.mine[ui.sel]; send({ act: 'place', i: ui.sel, x: s.x, y: s.y, dir: s.dir === 'h' ? 'v' : 'h' }); }
  }
  addEventListener('pointerup', () => {
    const { fleet: f } = get();
    if (ui.held == null || !f || f.phase !== 'deploy' || !cmd()) { ui.held = null; return; }
    const a = anchor();
    if (a) send({ act: 'place', i: ui.held, x: a[0], y: a[1], dir: ui.heldDir });
    ui.held = null; ui.hover = null; ui.key = ''; render();
  });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || !cmd()) return;
    const { fleet: f } = get(); if (!f || !el.offsetParent) return;   // only when this table is on screen
    if (e.key === 'r' || e.key === 'R') {
      if (f.phase === 'deploy' && (ui.held != null || ui.sel != null)) { e.preventDefault(); rotate(); }
      else if (ui.redeploy != null) { e.preventDefault(); ui.heldDir = ui.heldDir === 'h' ? 'v' : 'h'; tip(f); redeployPreview(f); }
      else if (ui.armed === 'sounding') { e.preventDefault(); ui.soundDir = ui.soundDir === 'row' ? 'col' : 'row'; tip(f); const svg = el.querySelector('.enemyT svg'); if (svg) enemyPreview(svg, null); }
      else if (ui.armed === 'scan') { e.preventDefault(); ui.scanDir = ui.scanDir === 'v' ? 'h' : 'v'; tip(f); const svg = el.querySelector('.enemyT svg'); if (svg) enemyPreview(svg, null); }
    }
    const mv = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (mv && ui.armed === 'boost' && ui.boostShip != null) { e.preventDefault(); boost(...mv); }
    if (e.key === 'Escape') { ui.armed = null; ui.boostShip = null; ui.redeploy = null; ui.key = ''; render(); }
  });
  el.addEventListener('contextmenu', e => { const { fleet: f } = get(); if (f && f.phase === 'deploy' && cmd()) { e.preventDefault(); rotate(); } });
  return { render };
}

// A department's share of the fleet: its flag hoist, rune pad and, every second reload, a question in Morse.
// Signals' pad shows only the runes (find them in the rune catalogue); Gunnery's and Engineering's show each rune's
// house and weight. get(): { fleet, t }
export function mountFleetDept(el, get, send, roleOf) {
  style(); el.classList.add('fd');
  const who = () => typeof roleOf === 'function' ? roleOf() : roleOf;
  const ui = { entry: [], key: '', bad: false };
  function render() {
    const role = who(), { fleet: f, t } = get(); if (!f || f.phase === 'off' || !f.dept || !f.dept[role]) { if (el.innerHTML) el.innerHTML = ''; ui.key = ''; return; }
    const d = f.dept[role], left = Math.max(0, Math.ceil((d.readyAt || 0) - (t || 0)));
    const k = JSON.stringify([role, d, ui.entry, ui.bad, f.loaded, d.state === 'cooldown' ? left : 0]);
    if (k === ui.key) return; ui.key = k;
    if (d.state !== 'flags') ui.entry = [];
    const ready = d.state === 'flags', named = role !== 'signals', name = SPECIAL_NAME[SPECIAL[role]];
    const askNext = (d.reloads + 1) % 2 === 0;
    let side;
    if (d.state === 'question' && d.question) {
      side = `<div class="hint">THE CODE IS GOOD. <b style="color:#ffd36a">A question comes over the wire in Morse.</b> Read it to the Fleet Officer: their book has the Morse table. Choose the answer.</div>
        <div class="morse">${morseText(d.question.q)}</div>
        <div class="answers">${d.question.opts.map((o, i) => `<button data-ans="${i}"><b>${'ABC'[i]}</b>${morseText(o)}</button>`).join('')}</div>
        <div class="state bad">A wrong answer locks your reload for a minute.</div>`;
    } else if (d.state === 'cooldown') {
      side = d.locked ? `<div class="locked">WRONG ANSWER · RELOAD LOCKED · ${left} s</div><div class="hint">New flags, and a new question, when the lock lifts.</div>` : `<div class="hint">The ${name.toLowerCase()} has been fired. New flags go up in ${left} s.</div>`;
    } else if (d.state === 'loaded') {
      side = `<div class="state ok" style="font-size:14px">${SP_ICON[SPECIAL[role]]} THE ${name} IS LOADED.</div><div class="hint">The Fleet Officer fires it.${askNext ? ' Your next reload will also ask a Morse question.' : ''}</div>`;
    } else {
      side = `<div class="hint">Describe these four flags, top to bottom, to the Fleet Officer. Press the four runes they read back${named ? '' : ' (they will name each by its house and weight: find it in your rune catalogue)'}.${askNext ? ' <b style="color:#ffd36a">This reload also asks a question in Morse.</b>' : ''}</div>
        <div class="code">${ui.entry.map(i => glyphSVG(PAD[i], 26, '#ffd36a')).join('')}<span class="hint">${'·'.repeat(HOIST - ui.entry.length)}</span>${ui.entry.length ? '<button class="sp" data-back style="padding:2px 8px">⌫</button>' : ''}</div>
        <div class="pad">${PAD.map((r, i) => `<button data-p="${i}" ${ready ? '' : 'disabled'}>${glyphSVG(r, 24)}${named ? `<span>${padName(i)}</span>` : ''}</button>`).join('')}</div>
        <div class="state ${ui.bad ? 'bad' : ''}">${ui.bad ? 'That code does not match the flags. Check them again.' : role === 'gunnery' ? 'Each heavy shell uses one of the Watch\'s red or orange beacons.' : ''}</div>`;
    }
    el.innerHTML = `<div class="hoist">${ready ? d.flags.map(fl => flagSVG(fl, 50, 32)).join('') : `<span class="hint" style="font-size:11px;text-align:center">${d.state === 'loaded' ? 'LOADED' : d.state === 'question' ? 'MORSE' : 'FLAGS DOWN'}</span>`}</div><div>${side}</div>`;
    el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      if (ui.entry.length >= HOIST) return;
      ui.entry.push(Number(b.dataset.p)); ui.bad = false;
      if (ui.entry.length === HOIST) {
        send({ act: 'fleetcode', runes: ui.entry });
        ui.entry = [];
        setTimeout(() => { const { fleet: f2 } = get(); if (f2 && f2.dept[who()] && f2.dept[who()].state === 'flags') { ui.bad = true; ui.key = ''; render(); } }, 2500);   // the game checks the code; still flags a moment later means it did not match
      }
      ui.key = ''; render();
    });
    el.querySelectorAll('[data-ans]').forEach(b => b.onclick = () => { send({ act: 'fleetanswer', choice: Number(b.dataset.ans) }); el.querySelectorAll('[data-ans]').forEach(x => { x.disabled = true; }); });
    const back = el.querySelector('[data-back]'); if (back) back.onclick = () => { ui.entry.pop(); ui.key = ''; render(); };
  }
  return { render };
}
