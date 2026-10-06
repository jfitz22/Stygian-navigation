// The furnace log: heat over the last three minutes, and where it is heading. Drawn only from furnaceState()
// (or the same object in a GM snapshot), so the panel can hang in the cabin now and move to the Engineer's station later.
import { projectHeat } from './sim.js';
import { TUNING as T } from './scenario.js';

export const N_COLOR = ['#9aa59c', '#5cff9d', '#9ad0ff', '#ff8a7a'];   // 0, 1, 2, 3 systems running
const PAST = 180, AHEAD = 180;
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// When the current setting will lose a system, and when the fire will go out (seconds from now, or null).
export function furnaceOutlook(fs) {
  if (!fs.lit) return { drop: null, out: null };
  const p = projectHeat(fs, fs.n, AHEAD);
  const d = p.find(q => q.n < fs.n), o = p.find(q => q.heat <= 0);
  return { drop: d ? d.dt : null, out: o ? o.dt : null };
}

export function furnaceNumbers(fs) {
  if (!fs.lit) return `<div class="fnum big"><b>COLD</b><span>THE FURNACE IS OUT</span></div>`;
  const o = furnaceOutlook(fs);
  const cell = (v, k, cls = '') => `<div class="fnum ${cls}"><b>${v}</b><span>${k}</span></div>`;
  return cell(fs.heat.toFixed(1), 'HEAT', 'big') +
    cell(fs.burn.toFixed(2) + '/s', 'BURNING') +
    cell(`${fs.n} of ${fs.slots}`, 'SYSTEMS ON / ROOM FOR') +
    cell(fs.chute, 'SHOVELS IN THE CHUTE') +
    cell(o.drop != null ? mmss(o.drop) : '—', fs.n ? `UNTIL ${fs.n} → ${fs.n - 1} SYSTEMS` : 'NOTHING TO SHED', o.drop != null && o.drop < 30 ? 'warn' : '') +
    cell(o.out != null ? mmss(o.out) : `> ${mmss(AHEAD)}`, 'UNTIL THE FIRE GOES OUT', o.out != null && o.out < 60 ? 'warn' : '') +
    cell(fs.damper === 'low' ? 'LOW' : 'NORMAL', 'DAMPER');
}

export function drawFurnaceLog(cv, fs) {
  const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, L = 56, R = W - 40, Tp = 18, B = H - 34;
  const X = dt => L + (dt + PAST) / (PAST + AHEAD) * (R - L), Y = h => B - Math.max(0, Math.min(105, h)) / 105 * (B - Tp);
  ctx.fillStyle = '#0b0f0d'; ctx.fillRect(0, 0, W, H);
  // bands: how many systems the heat allows, and the blowout
  const [s3, s2] = T.slotHeat;
  const band = (h0, h1, col, label) => { ctx.fillStyle = col; ctx.fillRect(L, Y(h1), R - L, Y(h0) - Y(h1)); ctx.fillStyle = 'rgba(232,223,198,.45)'; ctx.font = '600 12px IBM Plex Mono'; ctx.textAlign = 'left'; ctx.fillText(label, L + 8, Y(h1) + 16); };
  band(0, s2, 'rgba(92,255,157,.04)', 'ROOM FOR 1 SYSTEM');
  band(s2, s3, 'rgba(154,208,255,.05)', 'ROOM FOR 2');
  band(s3, 90, 'rgba(255,138,122,.04)', 'ROOM FOR 3');
  band(90, T.furnaceBlowout, 'rgba(255,75,58,.22)', 'BLOWOUT AT ' + T.furnaceBlowout);
  ctx.strokeStyle = 'rgba(232,223,198,.18)'; ctx.lineWidth = 1;
  for (const h of [0, s2, s3, 90, T.furnaceBlowout]) { ctx.beginPath(); ctx.moveTo(L, Y(h) + .5); ctx.lineTo(R, Y(h) + .5); ctx.stroke(); }
  ctx.fillStyle = 'rgba(232,223,198,.6)'; ctx.font = '11px IBM Plex Mono'; ctx.textAlign = 'right';
  for (const h of [0, 20, 40, 60, 80, 100]) ctx.fillText(h, L - 8, Y(h) + 4);
  ctx.textAlign = 'center';
  for (let s = -PAST; s <= AHEAD; s += 30) { ctx.fillText(s === 0 ? 'NOW' : (s > 0 ? '+' : '−') + mmss(Math.abs(s)), X(s), B + 18); ctx.strokeStyle = 'rgba(232,223,198,.07)'; ctx.beginPath(); ctx.moveTo(X(s) + .5, Tp); ctx.lineTo(X(s) + .5, B); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(232,207,152,.6)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(0) + .5, Tp); ctx.lineTo(X(0) + .5, B); ctx.stroke(); ctx.setLineDash([]);
  // the last three minutes
  const log = (fs.log || []).filter(p => fs.t - p.t <= PAST);
  ctx.lineWidth = 3;
  for (let i = 1; i < log.length; i++) {
    ctx.strokeStyle = N_COLOR[Math.min(3, log[i].n)]; ctx.beginPath();
    ctx.moveTo(X(log[i - 1].t - fs.t), Y(log[i - 1].heat)); ctx.lineTo(X(log[i].t - fs.t), Y(log[i].heat)); ctx.stroke();
  }
  if (log.length) { ctx.strokeStyle = N_COLOR[Math.min(3, fs.n)]; ctx.beginPath(); ctx.moveTo(X(log[log.length - 1].t - fs.t), Y(log[log.length - 1].heat)); ctx.lineTo(X(0), Y(fs.lit ? fs.heat : 0)); ctx.stroke(); }
  if (!fs.lit) { ctx.lineWidth = 1; ctx.fillStyle = 'rgba(232,223,198,.7)'; ctx.font = '600 16px IBM Plex Mono'; ctx.textAlign = 'center'; ctx.fillText('THE FURNACE IS OUT', X(AHEAD / 2), Y(50)); return; }
  // the next three minutes: solid for what is on now, dotted for the other choices
  for (const n of new Set([1, 2, 3, Math.min(3, fs.n)])) {
    const now = n === fs.n, p = projectHeat(fs, n, AHEAD);
    ctx.lineWidth = now ? 3 : 1.6; ctx.setLineDash(now ? [] : [6, 6]);
    ctx.strokeStyle = N_COLOR[n]; ctx.globalAlpha = now ? 1 : 0.75; ctx.beginPath();
    p.forEach((q, i) => i ? ctx.lineTo(X(q.dt), Y(q.heat)) : ctx.moveTo(X(q.dt), Y(q.heat)));
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const end = p[p.length - 1];
    ctx.fillStyle = N_COLOR[n]; ctx.font = (now ? '600 ' : '') + '12px IBM Plex Mono'; ctx.textAlign = 'left';
    ctx.fillText(end.heat <= 0 ? `${n}: OUT ${mmss(end.dt)}` : `${n}${now ? ' (NOW)' : ''}`, Math.min(X(end.dt) + 6, R - 70), Y(end.heat) - 4);
  }
  ctx.lineWidth = 1;
}
