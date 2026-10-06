// SUCCUBUS: a cameo of about 4.5 seconds. On the chart and the launcher she rises into view, raises a clawed hand
// and blows a kiss; on the orb feed she stands over a glowing grate and holds her billowing dress down.
// Clean vector art, animated with SVG (wings, hair, tail, hand, blink, skirt) inside a CSS entrance and exit.
import * as audio from './audio.js';

const OUT = '#231430';   // ink outline
const LINE = `stroke="${OUT}" stroke-width="2" stroke-linejoin="round"`;

// shared pieces, drawn around a head centred on (cx, cy)
function horns(id, cx, cy, s = 1) {
  const horn = side => {
    const m = v => cx + side * v * s, y = v => cy + v * s;
    return `<path d="M${m(22)},${y(-38)} C${m(30)},${y(-78)} ${m(70)},${y(-96)} ${m(96)},${y(-70)} C${m(118)},${y(-46)} ${m(104)},${y(-12)} ${m(78)},${y(-16)} C${m(62)},${y(-18)} ${m(58)},${y(-36)} ${m(72)},${y(-42)} C${m(84)},${y(-46)} ${m(90)},${y(-34)} ${m(84)},${y(-28)} C${m(92)},${y(-42)} ${m(84)},${y(-62)} ${m(66)},${y(-62)} C${m(48)},${y(-62)} ${m(40)},${y(-46)} ${m(36)},${y(-30)} Z" fill="url(#horn${id})" ${LINE}/>
      ${[0.25, 0.45, 0.65].map(k => `<path d="M${m(30 + k * 70)},${y(-60 - k * 22)} q${side * 4 * s},${10 * s} ${side * 2 * s},${18 * s}" stroke="#5c3a66" stroke-width="2" fill="none"/>`).join('')}`;
  };
  return horn(-1) + horn(1);
}
function ear(cx, cy, side, s = 1) {
  const m = v => cx + side * v * s, y = v => cy + v * s;
  return `<path d="M${m(34)},${y(-4)} L${m(66)},${y(-30)} L${m(40)},${y(14)} Z" fill="url(#skinD${'ID'})" ${LINE}/>
    <circle cx="${m(39)}" cy="${y(18)}" r="${2.4 * s}" fill="#d7c46a" stroke="${OUT}" stroke-width="1"/><path d="M${m(39)},${y(20)} l${-2 * s},${7 * s} l${2 * s},${4 * s} l${2 * s},${-4 * s} Z" fill="#c8102e" stroke="${OUT}" stroke-width="1"/>`;
}
function eye(x, y, s, wink, begin) {
  // eyeshadow, white, violet iris, heavy upper lid with lashes; the lid closes for a wink
  const lid = `<path d="M${x - 11 * s},${y} C${x - 6 * s},${y - 7 * s} ${x + 6 * s},${y - 7 * s} ${x + 12 * s},${y - 1 * s}" stroke="${OUT}" stroke-width="${2.6 * s}" fill="none" stroke-linecap="round"/>
    <path d="M${x + 12 * s},${y - 1 * s} l${4 * s},${-3 * s} M${x + 8 * s},${y - 4 * s} l${3 * s},${-4 * s}" stroke="${OUT}" stroke-width="${1.6 * s}"/>`;
  const ball = `<path d="M${x - 11 * s},${y} C${x - 5 * s},${y - 6 * s} ${x + 6 * s},${y - 6 * s} ${x + 12 * s},${y - 1 * s} C${x + 6 * s},${y + 5 * s} ${x - 5 * s},${y + 5 * s} ${x - 11 * s},${y} Z" fill="#f4f0ff"/>
    <circle cx="${x + 1 * s}" cy="${y - 0.5 * s}" r="${4.6 * s}" fill="#9b5de5"/><circle cx="${x + 1 * s}" cy="${y - 0.5 * s}" r="${2 * s}" fill="#2a0f3a"/><circle cx="${x + 2.6 * s}" cy="${y - 2 * s}" r="${1.2 * s}" fill="#fff"/>`;
  const shadow = `<ellipse cx="${x}" cy="${y - 6 * s}" rx="${14 * s}" ry="${6 * s}" fill="#7b3fa8" opacity=".55"/>`;
  if (!wink) return shadow + ball + lid;
  return shadow + `<g transform="translate(${x},${y - 1 * s})"><g><animateTransform attributeName="transform" type="scale" values="1 1;1 0.08;1 0.08;1 1" keyTimes="0;0.3;0.7;1" begin="${begin}" dur="0.5s" fill="freeze"/>
      <g transform="translate(${-x},${-(y - 1 * s)})">${ball}</g></g></g>` + lid;
}

// ---------- the kiss ----------
function kissArt(id) {
  const cx = 150, cy = 128;
  return `<svg viewBox="0 0 300 380" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="skin${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b4dd"/><stop offset="1" stop-color="#8d88bb"/></linearGradient>
    <linearGradient id="skinD${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8a3d2"/><stop offset="1" stop-color="#7c77aa"/></linearGradient>
    <linearGradient id="hair${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#d6cbb0"/></linearGradient>
    <linearGradient id="horn${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b2f57"/><stop offset="1" stop-color="#160b1c"/></linearGradient>
    <radialGradient id="wing${id}" cx=".7" cy=".8" r=".9"><stop offset="0" stop-color="#ff8fe0"/><stop offset=".6" stop-color="#c03a9e"/><stop offset="1" stop-color="#5a1650"/></radialGradient>
    <linearGradient id="armor${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4a80"/><stop offset="1" stop-color="#2b1838"/></linearGradient>
    <linearGradient id="cape${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f07ac8"/><stop offset="1" stop-color="#8e2c7c"/></linearGradient>
  </defs>
  <g><animateTransform attributeName="transform" type="rotate" values="0 104 222;-9 104 222;0 104 222" dur="1.4s" repeatCount="indefinite"/>
    <path d="M104,222 L30,60 L14,104 L44,120 L18,160 L56,168 L40,206 L84,200 Z" fill="url(#wing${id})" ${LINE}/>
    <path d="M104,222 L30,60 M104,222 L44,120 M104,222 L56,168" stroke="#3a1838" stroke-width="3" fill="none"/></g>
  <g><animateTransform attributeName="transform" type="rotate" values="0 196 222;9 196 222;0 196 222" dur="1.4s" repeatCount="indefinite"/>
    <path d="M196,222 L270,60 L286,104 L256,120 L282,160 L244,168 L260,206 L216,200 Z" fill="url(#wing${id})" ${LINE}/>
    <path d="M196,222 L270,60 M196,222 L256,120 M196,222 L244,168" stroke="#3a1838" stroke-width="3" fill="none"/></g>
  <path d="M58,380 C46,296 66,224 112,198 L188,198 C234,224 254,296 242,380 Z" fill="url(#cape${id})" ${LINE}/>
  <g><animateTransform attributeName="transform" type="rotate" values="-1.5 150 120;1.5 150 120;-1.5 150 120" dur="2.2s" repeatCount="indefinite"/>
    <path d="M100,110 C84,180 88,262 104,306 L132,286 L168,286 L196,306 C212,262 216,180 200,110 C196,58 104,58 100,110 Z" fill="url(#hair${id})" ${LINE}/></g>
  ${horns(id, cx, cy)}
  <path d="M137,166 L163,166 L168,208 L132,208 Z" fill="url(#skinD${id})" ${LINE}/>
  <path d="M82,380 C80,296 98,226 130,206 L170,206 C202,226 220,296 218,380 Z" fill="url(#skin${id})" ${LINE}/>
  <path d="M116,266 C124,252 140,252 148,264 M152,264 C160,252 176,252 184,266" stroke="#6f6a9c" stroke-width="2" fill="none" opacity=".8"/>
  <path d="M150,262 C149,272 149,280 150,290" stroke="#6f6a9c" stroke-width="2" fill="none"/>
  <path d="M92,380 L96,292 C104,262 128,258 144,274 C147,278 149,284 150,292 C151,284 153,278 156,274 C172,258 196,262 204,292 L208,380 Z" fill="url(#armor${id})" ${LINE}/>
  <path d="M104,292 C110,276 126,272 138,282 M196,292 C190,276 174,272 162,282" stroke="#a487c0" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M150,300 L159,314 L150,330 L141,314 Z" fill="#d7193c" stroke="${OUT}" stroke-width="1.5"/><path d="M150,304 L154,314 L150,320 L146,314 Z" fill="#ff8a9c"/>
  <path d="M96,356 L204,350" stroke="#2a1a14" stroke-width="7"/><rect x="132" y="345" width="16" height="12" rx="2" fill="none" stroke="#b8a070" stroke-width="2.5"/>
  <path d="M68,252 C70,226 96,216 120,226 C110,236 106,250 108,264 C96,256 82,256 68,252 Z" fill="url(#armor${id})" ${LINE}/>
  <path d="M86,236 L98,244 L88,254 L76,246 Z" fill="#d7193c" stroke="${OUT}" stroke-width="1.5"/>
  ${ear(cx, cy, -1).replaceAll('ID', id)}${ear(cx, cy, 1).replaceAll('ID', id)}
  <path d="M112,112 C112,150 128,174 150,176 C172,174 188,150 188,112 C188,82 172,72 150,72 C128,72 112,82 112,112 Z" fill="url(#skin${id})" ${LINE}/>
  ${eye(135, 120, 1, false)}${eye(166, 120, 1, true, '2.4s')}
  <path d="M124,104 C130,98 140,98 146,103 M156,101 C163,94 173,96 178,102" stroke="${OUT}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M149,128 C147,138 149,142 153,142" stroke="#6f6a9c" stroke-width="1.8" fill="none"/>
  <path d="M138,152 C144,148 148,149 151,151 C154,149 158,148 164,152 C158,160 144,160 138,152 Z" fill="#c43a5e" stroke="${OUT}" stroke-width="1.5"/>
  <path d="M142,152 C148,151 155,151 160,152" stroke="#7a1a34" stroke-width="1.2" fill="none"/><ellipse cx="146" cy="155" rx="3" ry="1.2" fill="#ff9ab0"/>
  <ellipse cx="126" cy="140" rx="8" ry="3.5" fill="#d872b8" opacity=".45"/><ellipse cx="174" cy="140" rx="8" ry="3.5" fill="#d872b8" opacity=".45"/>
  <g><animateTransform attributeName="transform" type="rotate" values="-2 150 90;2 150 90;-2 150 90" dur="2.2s" repeatCount="indefinite"/>
    <path d="M110,116 C104,84 120,62 150,60 C178,60 196,80 192,112 C184,92 172,84 160,86 C168,96 168,108 162,118 C156,98 140,88 124,94 C116,100 112,108 110,116 Z" fill="url(#hair${id})" ${LINE}/>
    <path d="M128,74 C140,70 160,70 172,78 M120,96 C128,86 142,84 150,88" stroke="#c9bd9f" stroke-width="1.5" fill="none"/>
    <path d="M110,116 C104,150 108,190 118,226 L106,232 C96,196 96,150 100,118 Z M190,116 C196,150 194,190 186,226 L198,232 C206,196 206,150 200,118 Z" fill="url(#hair${id})" ${LINE}/></g>
  <g><animateTransform attributeName="transform" type="translate" values="70 170;70 170;0 0;0 0;34 -18;34 -18;80 190" keyTimes="0;0.22;0.33;0.42;0.5;0.72;1" dur="4.5s" fill="freeze"/>
    <path d="M172,190 C168,176 172,160 182,154 L188,140 L192,154 L198,138 L201,154 L208,142 L208,158 L216,150 L212,170 C212,184 204,196 192,200 Z" fill="url(#armor${id})" ${LINE}/>
    <path d="M188,140 l-2,-8 M198,138 l0,-8 M208,142 l2,-8 M216,150 l5,-5" stroke="${OUT}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M176,196 L170,240 L196,244 L194,200 Z" fill="url(#armor${id})" ${LINE}/></g>
  ${[1.95, 2.7].map((b, i) => `<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.75;1" begin="${b}s" dur="1.6s" fill="freeze"/>
    <animateTransform attributeName="transform" type="translate" values="196 140;${250 + i * 20} ${60 - i * 20}" begin="${b}s" dur="1.6s" fill="freeze"/>
    <path d="M0,6 C-12,-6 -6,-16 0,-8 C6,-16 12,-6 0,6 Z" fill="#ff3d7a" stroke="#7a0a30" stroke-width="1.2" transform="scale(${1.6 + i * 0.6})"/></g>`).join('')}
</svg>`;
}

// ---------- the Marilyn, over a grate in Hell ----------
function marilynArt(id) {
  const cx = 120, cy = 84, s = 0.74;
  const skirt = ['M86,206 C70,220 54,244 52,266 C72,258 92,268 120,264 C148,268 168,258 188,266 C186,244 170,220 154,206 Z',
    'M86,206 C66,210 46,226 40,248 C62,252 88,262 120,256 C152,262 178,252 200,248 C194,226 174,210 154,206 Z',
    'M86,206 C62,200 40,204 32,222 C54,234 86,246 120,240 C154,246 186,234 208,222 C200,204 178,200 154,206 Z'];
  return `<svg viewBox="0 0 240 400" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="skin${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b4dd"/><stop offset="1" stop-color="#8d88bb"/></linearGradient>
    <linearGradient id="skinD${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8a3d2"/><stop offset="1" stop-color="#7c77aa"/></linearGradient>
    <linearGradient id="hair${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#d6cbb0"/></linearGradient>
    <linearGradient id="horn${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b2f57"/><stop offset="1" stop-color="#160b1c"/></linearGradient>
    <linearGradient id="dress${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6ddf2"/></linearGradient>
    <radialGradient id="glow${id}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff7a2a" stop-opacity=".9"/><stop offset="1" stop-color="#ff2a2a" stop-opacity="0"/></radialGradient>
    <radialGradient id="wing${id}" cx=".7" cy=".8" r=".9"><stop offset="0" stop-color="#ff8fe0"/><stop offset=".6" stop-color="#c03a9e"/><stop offset="1" stop-color="#5a1650"/></radialGradient>
  </defs>
  <ellipse cx="120" cy="384" rx="96" ry="22" fill="url(#glow${id})"><animate attributeName="opacity" values=".6;1;.6" dur="0.5s" repeatCount="indefinite"/></ellipse>
  ${[0, 1, 2, 3].map(i => `<path d="M${84 + i * 24},376 C${76 + i * 24},350 ${92 + i * 24},330 ${84 + i * 24},300" stroke="#ffd2b0" stroke-width="5" fill="none" stroke-linecap="round" opacity="0">
    <animate attributeName="opacity" values="0;.55;0" dur="1.1s" begin="${i * 0.27}s" repeatCount="indefinite"/>
    <animateTransform attributeName="transform" type="translate" values="0 20;0 -30" dur="1.1s" begin="${i * 0.27}s" repeatCount="indefinite"/></path>`).join('')}
  <rect x="34" y="372" width="172" height="18" rx="3" fill="#2b2f33" ${LINE}/>
  ${Array.from({ length: 9 }, (_, i) => `<rect x="${44 + i * 18}" y="376" width="9" height="10" fill="#ff5a1a" opacity=".85"/>`).join('')}
  <g><animateTransform attributeName="transform" type="rotate" values="-10 138 270;12 138 270;-10 138 270" dur="1s" repeatCount="indefinite"/>
    <path d="M136,270 C172,286 204,276 208,244" stroke="${OUT}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M136,270 C172,286 204,276 208,244" stroke="#7b5fa8" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M208,244 l-12,-4 l16,-14 l6,18 Z" fill="#7b5fa8" ${LINE}/></g>
  <path d="M96,104 L52,64 L44,98 L62,100 L54,124 L84,120 Z" fill="url(#wing${id})" ${LINE}/>
  <path d="M144,104 L188,64 L196,98 L178,100 L186,124 L156,120 Z" fill="url(#wing${id})" ${LINE}/>
  <path d="M98,226 C92,276 98,320 104,366 L118,366 C118,320 120,276 120,226 Z M122,226 C122,276 124,320 124,366 L138,366 C144,320 148,276 142,226 Z" fill="url(#skin${id})" ${LINE}/>
  <path d="M106,300 C110,304 114,304 116,300 M128,300 C131,304 135,304 138,300" stroke="#6f6a9c" stroke-width="1.5" fill="none"/>
  <path d="M100,364 L122,364 L120,374 L98,374 Z M122,364 L144,364 L144,374 L124,374 Z" fill="#c8102e" ${LINE}/>
  <path d="M100,374 L98,386 M144,374 L146,386" stroke="#c8102e" stroke-width="3.5"/>
  <path d="${skirt[0]}" fill="url(#dress${id})" ${LINE}>
    <animate attributeName="d" values="${skirt[0]};${skirt[1]};${skirt[2]};${skirt[1]};${skirt[0]}" dur="0.9s" repeatCount="indefinite"/></path>
  <path d="M110,206 L120,262 L130,206 Z" fill="url(#dress${id})" ${LINE}/>
  <path d="M98,108 C92,140 92,176 100,208 L140,208 C148,176 148,140 142,108 Z" fill="url(#skin${id})" ${LINE}/>
  <path d="M98,124 C94,152 96,182 100,208 L140,208 C144,182 146,152 142,124 C136,124 128,128 122,140 L120,164 L118,140 C112,128 104,124 98,124 Z" fill="url(#dress${id})" ${LINE}/>
  <path d="M104,140 C108,134 114,136 118,144 M136,140 C132,134 126,136 122,144" stroke="#c9bde0" stroke-width="2" fill="none"/>
  <path d="M100,124 L110,90 M140,124 L130,90" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/><path d="M100,124 L110,90 M140,124 L130,90" stroke="${OUT}" stroke-width="1" fill="none" opacity=".4"/>
  <path d="M99,114 C88,146 94,186 113,210 M141,114 C152,146 146,186 127,210" stroke="${OUT}" stroke-width="10" stroke-linecap="round" fill="none"/>
  <path d="M99,114 C88,146 94,186 113,210 M141,114 C152,146 146,186 127,210" stroke="#a7a2d0" stroke-width="7" stroke-linecap="round" fill="none"/>
  <ellipse cx="114" cy="212" rx="8" ry="6" fill="url(#skinD${id})" ${LINE}/><ellipse cx="126" cy="212" rx="8" ry="6" fill="url(#skinD${id})" ${LINE}/>
  <path d="M112,72 L128,72 L130,96 L110,96 Z" fill="url(#skinD${id})" ${LINE}/>
  <g transform="translate(${cx},${cy}) scale(${s}) translate(${-150},${-128})">
    ${horns(id, 150, 128)}
    ${ear(150, 128, -1).replaceAll('ID', id)}${ear(150, 128, 1).replaceAll('ID', id)}
    <path d="M112,112 C112,150 128,174 150,176 C172,174 188,150 188,112 C188,82 172,72 150,72 C128,72 112,82 112,112 Z" fill="url(#skin${id})" ${LINE}/>
    ${eye(135, 120, 1, false)}${eye(166, 120, 1, true, '1.6s')}
    <path d="M124,104 C130,98 140,98 146,103 M156,101 C163,94 173,96 178,102" stroke="${OUT}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M136,150 C142,146 158,146 164,150 C160,162 140,162 136,150 Z" fill="#c8102e" stroke="${OUT}" stroke-width="1.5"/><path d="M140,151 C146,154 154,154 160,151" stroke="#fff" stroke-width="2" fill="none"/>
    <circle cx="170" cy="146" r="2" fill="${OUT}"/>
    <ellipse cx="126" cy="140" rx="8" ry="3.5" fill="#d872b8" opacity=".45"/><ellipse cx="174" cy="140" rx="8" ry="3.5" fill="#d872b8" opacity=".45"/>
    <path d="M104,118 C92,92 102,62 130,54 C150,48 176,52 190,70 C202,86 200,108 194,120 C188,104 180,96 170,98 C178,88 172,76 160,78 C152,90 142,96 128,96 C138,86 136,76 126,76 C114,82 108,98 104,118 Z" fill="url(#hair${id})" ${LINE}/>
    <path d="M104,118 C96,126 98,140 108,142 C112,132 110,124 104,118 Z M194,120 C202,128 200,142 190,144 C186,134 188,126 194,120 Z" fill="url(#hair${id})" ${LINE}/>
    <path d="M122,64 C134,58 150,58 160,64 M168,62 C178,64 186,72 188,82 M118,86 C124,80 132,80 136,84" stroke="#c9bd9f" stroke-width="2" fill="none"/>
  </g>
</svg>`;
}

const $ = id => document.getElementById(id);
// [kind, element, optional box inside it]
const SPOTS = () => [
  ['kiss', document.querySelector('#p-map .screen.chart'), null],
  ['kiss', $('p-launch'), { left: 320, top: 40, width: 300, height: 364 }],
  ['marilyn', $('camscreen'), null],
];
const ART = { kiss: [300, 380, kissArt], marilyn: [240, 400, marilynArt] };
export const SUCC_TIME = 4500;
let timer = null, uid = 0;
export function succubus() {
  clearTimeout(timer); document.querySelectorAll('.succ').forEach(d => d.remove());
  audio.sfx.sultry();
  for (const [kind, el, box] of SPOTS()) {
    if (!el) continue;
    const bw = box ? box.width : el.clientWidth, bh = box ? box.height : el.clientHeight, ox = box ? box.left : 0, oy = box ? box.top : 0;
    const [aw, ah, draw] = ART[kind], h = Math.min(bh * (kind === 'kiss' ? 0.86 : 0.95), 560), w = h * aw / ah;
    const d = document.createElement('div'); d.className = 'succ ' + kind;
    Object.assign(d.style, { width: w + 'px', height: h + 'px', top: (oy + bh - h) + 'px', left: (ox + (bw - w) / 2) + 'px' });
    d.innerHTML = draw('s' + (++uid));
    el.appendChild(d);
  }
  timer = setTimeout(() => document.querySelectorAll('.succ').forEach(d => d.remove()), SUCC_TIME);
}
export const previewArt = kind => ART[kind][2]('p' + (++uid));   // for checking the art
