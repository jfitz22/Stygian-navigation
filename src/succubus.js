// SUCCUBUS: a cheeky pixel-art cameo across the screens, about 4.5 seconds.
// The pin-up blows a kiss on the chart and the launcher, the dress-over-a-grate gag plays on the orb feed,
// and a stockinged leg kicks out from behind the frame everywhere else.
// Each picture is drawn as vector art, rendered small and scaled up, so it comes out properly pixelated.
import * as audio from './audio.js';

const SKIN = '#f2bba3', SKIN2 = '#d9967c', RED = '#c8102e', RED2 = '#ff3355', INK = '#1a0b10', DRESS = '#fbf4ea', DRESS2 = '#d9cfc0', BLONDE = '#f7e27a';

const LEG = `
  <defs><pattern id="net" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8M0 0H8" stroke="${INK}" stroke-width="1.8"/></pattern>
  <clipPath id="lc"><path d="M0,66 C55,64 115,78 150,90 C170,70 188,48 203,26 L219,33 C206,62 186,104 160,130 C115,138 55,146 0,148 Z"/></clipPath></defs>
  <path d="M0,66 C55,64 115,78 150,90 C170,70 188,48 203,26 L219,33 C206,62 186,104 160,130 C115,138 55,146 0,148 Z" fill="${SKIN}"/>
  <rect width="260" height="160" fill="url(#net)" clip-path="url(#lc)" opacity=".9"/>
  <path d="M150,92 C162,104 162,118 158,128" stroke="${SKIN2}" stroke-width="3" fill="none" opacity=".7"/>
  <path d="M16,66 C22,96 22,122 14,148" stroke="${INK}" stroke-width="10" fill="none"/>
  <path d="M40,68 C46,96 46,122 39,146" stroke="${RED}" stroke-width="7" fill="none"/>
  <path d="M34,104 l-9,-7 l1,14 Z M46,104 l9,-7 l-1,14 Z" fill="${RED2}"/><circle cx="40" cy="104" r="4" fill="${RED2}"/>
  <path d="M200,30 C205,16 216,6 230,1 C239,-1 243,6 236,12 C229,19 225,27 221,38 Z" fill="${RED}"/>
  <path d="M216,37 L223,34 L246,58 L241,60 Z" fill="${RED}"/>
  <path d="M203,28 L220,35" stroke="${INK}" stroke-width="3"/>
  <path d="M207,18 C214,10 222,6 228,5" stroke="${RED2}" stroke-width="2" fill="none"/>`;

const PINUP = `
  <path d="M58,170 C20,150 6,112 10,84 C22,104 30,108 40,104 C34,122 44,138 62,150 Z" fill="#5b1530"/>
  <path d="M142,170 C180,150 194,112 190,84 C178,104 170,108 160,104 C166,122 156,138 138,150 Z" fill="#5b1530"/>
  <path d="M150,200 C178,196 188,172 176,156 C172,170 160,176 152,178" stroke="${RED}" stroke-width="5" fill="none"/>
  <path d="M176,156 l-3,-14 l12,8 Z" fill="${RED}"/>
  <g transform="translate(0,18)">
  <ellipse cx="100" cy="82" rx="54" ry="60" fill="#5a1424"/>
  <path d="M78,38 C68,22 64,10 71,0 C76,14 84,24 90,32 Z M122,38 C132,22 136,10 129,0 C124,14 116,24 110,32 Z" fill="#2a0a10"/>
  </g>
  <path d="M40,230 C40,196 56,176 84,168 L89,150 L111,150 L116,168 C144,176 160,196 160,230 Z" fill="${SKIN}"/>
  <path d="M46,230 L50,190 C58,176 80,174 92,186 C96,190 99,196 100,202 C101,196 104,190 108,186 C120,174 142,176 150,190 L154,230 Z" fill="${RED}"/>
  <path d="M84,182 C90,186 95,192 100,202 C105,192 110,186 116,182" stroke="${SKIN2}" stroke-width="2" fill="none"/>
  <path d="M58,186 C64,180 76,178 86,184 M114,184 C124,178 136,180 142,186" stroke="${RED2}" stroke-width="2" fill="none" opacity=".8"/>
  <g transform="translate(0,18)">
  <ellipse cx="100" cy="88" rx="30" ry="36" fill="${SKIN}"/>
  <path d="M70,80 C70,50 92,40 112,46 C126,50 134,64 132,84 C124,66 108,60 96,62 C86,64 76,70 70,80 Z" fill="#6e1a2c"/>
  <path d="M80,86 Q87,80 94,86" stroke="${INK}" stroke-width="3" fill="none"/>
  <path d="M78,82 l-5,-4 M82,80 l-3,-6" stroke="${INK}" stroke-width="2"/>
  <ellipse cx="114" cy="86" rx="7" ry="5" fill="#fff"/><circle cx="115" cy="86" r="3.5" fill="#3b1a5a"/>
  <path d="M106,80 Q114,75 123,80 M121,79 l5,-4 M117,77 l2,-5" stroke="${INK}" stroke-width="2" fill="none"/>
  <ellipse cx="82" cy="100" rx="6" ry="3" fill="#ff7b8f" opacity=".6"/><ellipse cx="120" cy="100" rx="6" ry="3" fill="#ff7b8f" opacity=".6"/>
  <ellipse cx="101" cy="109" rx="6" ry="5" fill="${RED}"/><ellipse cx="101" cy="108" rx="3" ry="1.6" fill="#ff8aa0"/>
  <path d="M118,124 C126,110 136,104 142,106 C146,108 144,114 138,116 C144,116 146,122 140,124 C134,126 126,128 122,128 Z" fill="${SKIN}"/>
  <path d="M138,108 l8,-4 M140,114 l9,-2 M139,121 l8,1" stroke="${SKIN2}" stroke-width="2"/>  </g>`;

const grate = [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${26 + i * 15}" y="274" width="8" height="10" fill="#0c0e10"/>`).join('');
const curls = [[64, 40, 13], [76, 30, 14], [92, 28, 14], [106, 38, 13], [62, 56, 11], [108, 54, 11]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${BLONDE}"/>`).join('');
const SKIRT_DOWN = `<path d="M52,166 C30,162 16,140 26,118 C36,136 50,144 62,146 C72,154 98,154 108,146 C120,144 134,136 144,118 C154,140 140,162 118,166 C104,184 66,184 52,166 Z" fill="${DRESS}"/>
  <path d="M34,128 C44,142 56,146 64,150 M136,128 C126,142 114,146 106,150 M85,152 L85,180" stroke="${DRESS2}" stroke-width="2" fill="none"/>`;
const SKIRT_UP = `<path d="M52,170 C20,160 6,124 22,104 C30,128 46,138 62,140 C70,150 100,150 108,140 C124,138 140,128 148,104 C164,124 150,160 118,170 C104,186 66,186 52,170 Z" fill="${DRESS}"/>
  <path d="M30,118 C40,136 54,142 64,146 M140,118 C130,136 116,142 106,146 M85,150 L85,182" stroke="${DRESS2}" stroke-width="2" fill="none"/>`;
const VENT = up => `
  <rect x="18" y="270" width="134" height="18" rx="2" fill="#2b2f33"/>${grate}
  <path d="M104,206 C120,214 132,218 140,222 C142,214 150,206 156,204" stroke="${RED}" stroke-width="4" fill="none"/>
  <path d="M156,204 l-2,-12 l10,8 Z" fill="${RED}"/>
  <path d="M62,180 C58,206 62,236 68,268 L80,268 C80,240 83,210 84,180 Z M86,180 C87,210 90,240 90,268 L102,268 C108,236 112,206 108,180 Z" fill="${SKIN}"/>
  <path d="M70,222 C73,226 77,226 80,222 M90,222 C93,226 97,226 100,222" stroke="${SKIN2}" stroke-width="1.5" fill="none"/>
  <path d="M56,268 L80,268 L80,276 L58,276 Z M90,268 L114,268 L112,276 L90,276 Z" fill="${RED}"/>
  <path d="M60,276 L58,286 M112,276 L114,286" stroke="${RED}" stroke-width="3"/>
  ${up ? SKIRT_UP : SKIRT_DOWN}
  <path d="M62,148 C58,126 60,108 66,96 L104,96 C110,108 112,126 108,148 C96,154 74,154 62,148 Z" fill="${DRESS}"/>
  <path d="M70,98 L85,128 L100,98" stroke="${DRESS2}" stroke-width="2" fill="${SKIN}"/>
  <path d="M70,98 L80,72 M100,98 L90,72" stroke="${DRESS}" stroke-width="5"/>
  <path d="M64,100 C54,120 56,144 78,162 M106,100 C116,120 114,144 92,162" stroke="${SKIN}" stroke-width="8" stroke-linecap="round" fill="none"/>
  <ellipse cx="79" cy="163" rx="6" ry="4" fill="${SKIN}"/><ellipse cx="91" cy="163" rx="6" ry="4" fill="${SKIN}"/>
  <rect x="80" y="62" width="10" height="14" fill="${SKIN}"/>
  ${curls}
  <ellipse cx="85" cy="48" rx="19" ry="23" fill="${SKIN}"/>
  <path d="M68,40 C72,26 98,24 104,38 C96,32 80,32 68,40 Z" fill="${BLONDE}"/>
  <path d="M68,24 C62,14 62,6 66,0 C68,10 72,16 76,20 Z M102,24 C108,14 108,6 104,0 C102,10 98,16 94,20 Z" fill="#2a0a10"/>
  <path d="M73,48 Q79,44 84,48" stroke="${INK}" stroke-width="2.5" fill="none"/>
  <ellipse cx="94" cy="48" rx="5" ry="3.5" fill="#fff"/><circle cx="95" cy="48" r="2.5" fill="#2a4a8a"/>
  <path d="M89,43 Q95,40 100,43" stroke="${INK}" stroke-width="2" fill="none"/>
  <circle cx="96" cy="58" r="1.6" fill="${INK}"/>
  <path d="M78,61 Q85,58 92,61 Q85,67 78,61 Z" fill="${RED}"/>`;

const ART = { leg: [260, 160, [LEG]], pinup: [200, 230, [PINUP]], vent: [170, 290, [VENT(false), VENT(true)]] };
const frames = {};
function toPixels(w, h, body, scale = 3) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = Math.round(w / scale); c.height = Math.round(h / scale);
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(img, 0, 0, c.width, c.height);
      res(c);
    };
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`);
  });
}
export const ready = (async () => { for (const [k, [w, h, bodies]] of Object.entries(ART)) frames[k] = await Promise.all(bodies.map(b => toPixels(w, h, b))); })();
export const artFrames = () => frames;   // for checking the art

const $ = id => document.getElementById(id);
// [kind, element, optional box inside it]
const SPOTS = () => [
  ['pinup', document.querySelector('#p-map .screen.chart'), null],
  ['pinup', $('p-launch'), { left: 330, top: 50, width: 280, height: 350 }],
  ['vent', $('camscreen'), null],
  ['leg', document.querySelector('#p-sonar .screen.round'), null],
  ['leg', $('radiocanvas') && $('radiocanvas').parentElement, null],
  ['leg', $('p-scan'), { left: 14, top: 46, width: 200, height: 130 }],
];
export const SUCC_TIME = 4500;
let timer = null;
export function succubus() {
  if (!frames.vent || frames.vent.some(f => !f)) return;
  clearTimeout(timer); document.querySelectorAll('.succ').forEach(d => { clearInterval(d._flip); d.remove(); });
  audio.sfx.sultry();
  for (const [kind, el, box] of SPOTS()) {
    if (!el) continue;
    const bw = box ? box.width : el.clientWidth, bh = box ? box.height : el.clientHeight, ox = box ? box.left : 0, oy = box ? box.top : 0;
    const [aw, ah] = ART[kind];
    const h = kind === 'leg' ? Math.min(bh * 0.7, bw * 0.6 * ah / aw) : Math.min(bh * 0.92, 340), w = h * aw / ah;
    const d = document.createElement('div'); d.className = 'succ ' + kind;
    Object.assign(d.style, { width: w + 'px', height: h + 'px', top: (oy + (kind === 'leg' ? (bh - h) / 2 : bh - h)) + 'px', left: (ox + (kind === 'leg' ? 0 : (bw - w) / 2)) + 'px' });
    const cs = frames[kind].map((src, i) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); if (i) c.style.visibility = 'hidden'; d.appendChild(c); return c; });
    if (kind === 'vent') { let k = 0; d._flip = setInterval(() => { k ^= 1; cs[0].style.visibility = k ? 'hidden' : ''; cs[1].style.visibility = k ? '' : 'hidden'; }, 260); }
    if (kind === 'pinup') for (const t of [1.1, 2.2, 3.2]) { const h2 = document.createElement('span'); h2.className = 'heart'; h2.textContent = '♥'; h2.style.animationDelay = t + 's'; d.appendChild(h2); }
    el.appendChild(d);
  }
  timer = setTimeout(() => document.querySelectorAll('.succ').forEach(d => { clearInterval(d._flip); d.remove(); }), SUCC_TIME);
}
