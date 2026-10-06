// SUCCUBUS: a cameo of about 4.5 seconds. A purple succubus stands over a glowing grate in Hell, Marilyn-style,
// holding down a billowing white dress, glancing aside with a surprised "oh". A heart beats beside her and pops
// as she goes. She appears on the orb feed and over the rune board, which she blocks while she is there.
import * as audio from './audio.js';

const OUT = '#231430';
const L = `stroke="${OUT}" stroke-width="2" stroke-linejoin="round"`;

function horns(id) {
  const h = sd => {
    const m = v => 150 + sd * v, y = v => 128 + v;
    return `<path d="M${m(24)},${y(-40)} C${m(30)},${y(-80)} ${m(68)},${y(-96)} ${m(92)},${y(-72)} C${m(112)},${y(-50)} ${m(100)},${y(-18)} ${m(78)},${y(-22)} C${m(64)},${y(-24)} ${m(60)},${y(-38)} ${m(72)},${y(-44)} C${m(82)},${y(-48)} ${m(88)},${y(-38)} ${m(82)},${y(-32)} C${m(90)},${y(-46)} ${m(82)},${y(-64)} ${m(66)},${y(-64)} C${m(50)},${y(-64)} ${m(42)},${y(-48)} ${m(38)},${y(-32)} Z" fill="url(#horn${id})" ${L}/>`;
  };
  return h(-1) + h(1);
}
function ear(id, sd) {
  const m = v => 150 + sd * v, y = v => 128 + v;
  return `<path d="M${m(32)},${y(-6)} L${m(54)},${y(-24)} L${m(37)},${y(10)} Z" fill="url(#skinD${id})" ${L}/>
    <path d="M${m(36)},${y(12)} l${-1.5 * sd},6 l1.5,4 l1.5,-4 Z" fill="#c8102e" stroke="${OUT}" stroke-width="1"/>`;
}
// eyes glancing aside: almond shape, violet iris shifted left, heavy lash line
function eye(id, x, y) {
  const w = 13.6, h = 6.8, look = -3, cid = `eye${id}${x}`;
  const shape = `M${x - w},${y} C${x - w * 0.5},${y - h} ${x + w * 0.5},${y - h} ${x + w},${y - 1} C${x + w * 0.5},${y + h * 0.8} ${x - w * 0.5},${y + h * 0.8} ${x - w},${y} Z`;
  return `<clipPath id="${cid}"><path d="${shape}"/></clipPath>
    <ellipse cx="${x}" cy="${y - 7}" rx="${w + 3}" ry="7" fill="#7b3fa8" opacity=".5"/>
    <path d="${shape}" fill="#f6f2ff"/>
    <g clip-path="url(#${cid})"><circle cx="${x + look}" cy="${y}" r="5.7" fill="#8f4fd8"/><circle cx="${x + look}" cy="${y}" r="2.5" fill="#200a2e"/><circle cx="${x + look + 1.8}" cy="${y - 1.8}" r="1.4" fill="#fff"/></g>
    <path d="M${x - w},${y} C${x - w * 0.5},${y - h} ${x + w * 0.5},${y - h} ${x + w},${y - 1}" stroke="${OUT}" stroke-width="3.1" fill="none" stroke-linecap="round"/>
    <path d="M${x + w - 1},${y - 2} l5,-4 M${x + w - 5},${y - 4} l3,-5" stroke="${OUT}" stroke-width="1.6"/>`;
}
const curls = id => [[118, 92, 13], [124, 74, 14], [140, 62, 15], [160, 60, 15], [178, 70, 14], [186, 88, 13], [112, 110, 10], [190, 106, 10]]
  .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#hair${id})" ${L}/><path d="M${x - r * 0.5},${y} a${r * 0.5},${r * 0.5} 0 1 1 ${r * 0.6},${r * 0.3}" stroke="#c9bd9f" stroke-width="1.5" fill="none"/>`).join('');

const SKIRT = ['M86,206 C70,220 54,244 52,266 C72,258 92,268 120,264 C148,268 168,258 188,266 C186,244 170,220 154,206 Z',
  'M86,206 C66,210 46,226 40,248 C62,252 88,262 120,256 C152,262 178,252 200,248 C194,226 174,210 154,206 Z',
  'M86,206 C62,200 40,204 32,222 C54,234 86,246 120,240 C154,246 186,234 208,222 C200,204 178,200 154,206 Z'];
const HEART = 'M0,7 C-14,-6 -7,-17 0,-8 C7,-17 14,-6 0,7 Z';
const POP_AT = 3.95;   // seconds: the heart pops as she goes

function art(id) {
  const head = `<g transform="translate(120,84) scale(0.8) translate(-150,-128)">${horns(id)}${ear(id, -1)}${ear(id, 1)}
    <path d="M116,108 C116,146 132,170 150,174 C168,170 184,146 184,108 C184,84 170,74 150,74 C130,74 116,84 116,108 Z" fill="url(#skin${id})" ${L}/>
    ${eye(id, 135, 120)}${eye(id, 165, 120)}
    <path d="M123,99 C130,93 140,94 146,99 M155,98 C162,92 172,93 178,98" stroke="${OUT}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M150,128 C148,137 150,140 154,140" stroke="#6f6a9c" stroke-width="1.6" fill="none"/>
    <ellipse cx="150" cy="152" rx="6" ry="5.5" fill="#c8102e" stroke="${OUT}" stroke-width="1.4"/><ellipse cx="150" cy="152.5" rx="3" ry="3" fill="#4a0a1a"/>
    <circle cx="169" cy="145" r="1.8" fill="${OUT}"/>
    <ellipse cx="128" cy="138" rx="7" ry="3" fill="#e080c0" opacity=".45"/><ellipse cx="172" cy="138" rx="7" ry="3" fill="#e080c0" opacity=".45"/>
    ${curls(id)}</g>`;
  // the heart: beats beside her, then swells and bursts into sparks
  const sparks = Array.from({ length: 8 }, (_, i) => {
    const a = i / 8 * Math.PI * 2, dx = Math.cos(a) * 26, dy = Math.sin(a) * 26;
    return `<circle r="3" fill="#ff5c8a" opacity="0"><animate attributeName="opacity" values="1;0" begin="${POP_AT + 0.12}s" dur="0.45s" fill="freeze"/>
      <animateTransform attributeName="transform" type="translate" values="0 0;${dx.toFixed(1)} ${dy.toFixed(1)}" begin="${POP_AT + 0.12}s" dur="0.45s" fill="freeze"/></circle>`;
  }).join('');
  const heart = `<g transform="translate(204,128)">
    <g><animateTransform attributeName="transform" type="scale" values="1;1.22;1;1.12;1" dur="0.8s" repeatCount="5" additive="sum"/>
      <animateTransform attributeName="transform" type="scale" values="1;1.9" begin="${POP_AT}s" dur="0.14s" fill="freeze" additive="sum"/>
      <animate attributeName="opacity" values="1;0" begin="${POP_AT + 0.1}s" dur="0.08s" fill="freeze"/>
      <path d="${HEART}" fill="#ff3d7a" stroke="#7a0a30" stroke-width="1.4" transform="scale(1.3)"/><path d="M-5,-5 C-7,-9 -3,-11 -1,-8" stroke="#ffd0dc" stroke-width="1.6" fill="none"/></g>
    ${sparks}</g>`;
  return `<svg viewBox="0 0 240 400" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="skin${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9b4dd"/><stop offset="1" stop-color="#8d88bb"/></linearGradient>
    <linearGradient id="skinD${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a8a3d2"/><stop offset="1" stop-color="#7c77aa"/></linearGradient>
    <linearGradient id="hair${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#d6cbb0"/></linearGradient>
    <linearGradient id="horn${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4b2f57"/><stop offset="1" stop-color="#160b1c"/></linearGradient>
    <linearGradient id="dress${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e6ddf2"/></linearGradient>
    <radialGradient id="wing${id}" cx=".7" cy=".8" r=".9"><stop offset="0" stop-color="#ff8fe0"/><stop offset=".6" stop-color="#c03a9e"/><stop offset="1" stop-color="#5a1650"/></radialGradient></defs>
  <ellipse cx="120" cy="384" rx="96" ry="20" fill="#ff6a2a" opacity=".5"><animate attributeName="opacity" values=".3;.7;.3" dur="0.5s" repeatCount="indefinite"/></ellipse>
  ${[0, 1, 2, 3].map(i => `<path d="M${84 + i * 24},376 C${76 + i * 24},350 ${92 + i * 24},330 ${84 + i * 24},300" stroke="#ffd2b0" stroke-width="5" fill="none" stroke-linecap="round" opacity="0">
    <animate attributeName="opacity" values="0;.5;0" dur="1.1s" begin="${i * 0.27}s" repeatCount="indefinite"/>
    <animateTransform attributeName="transform" type="translate" values="0 20;0 -30" dur="1.1s" begin="${i * 0.27}s" repeatCount="indefinite"/></path>`).join('')}
  <rect x="34" y="372" width="172" height="18" rx="3" fill="#2b2f33" ${L}/>${Array.from({ length: 9 }, (_, i) => `<rect x="${44 + i * 18}" y="376" width="9" height="10" fill="#ff5a1a"/>`).join('')}
  <g><animateTransform attributeName="transform" type="rotate" values="-10 138 270;12 138 270;-10 138 270" dur="1s" repeatCount="indefinite"/>
    <path d="M136,270 C172,286 204,276 208,244" stroke="${OUT}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M136,270 C172,286 204,276 208,244" stroke="#7b5fa8" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M208,244 l-12,-4 l16,-14 l6,18 Z" fill="#7b5fa8" ${L}/></g>
  <path d="M96,104 L50,62 L42,98 L60,100 L52,124 L84,120 Z" fill="url(#wing${id})" ${L}/><path d="M144,104 L190,62 L198,98 L180,100 L188,124 L156,120 Z" fill="url(#wing${id})" ${L}/>
  <path d="M98,226 C92,276 98,320 104,366 L118,366 C118,320 120,276 120,226 Z M122,226 C122,276 124,320 124,366 L138,366 C144,320 148,276 142,226 Z" fill="url(#skin${id})" ${L}/>
  <path d="M100,364 L122,364 L120,374 L98,374 Z M122,364 L144,364 L144,374 L124,374 Z" fill="#c8102e" ${L}/>
  <path d="${SKIRT[0]}" fill="url(#dress${id})" ${L}><animate attributeName="d" values="${SKIRT[0]};${SKIRT[1]};${SKIRT[2]};${SKIRT[1]};${SKIRT[0]}" dur="0.9s" repeatCount="indefinite"/></path>
  <path d="M110,206 L120,262 L130,206 Z" fill="url(#dress${id})" ${L}/>
  <path d="M97,108 C88,128 88,150 99,166 C97,184 98,198 102,210 L138,210 C142,198 143,184 141,166 C152,150 152,128 143,108 Z" fill="url(#skin${id})" ${L}/>
  <path d="M96,132 C88,152 94,170 106,174 C100,188 100,200 102,210 L138,210 C140,200 140,188 134,174 C146,170 152,152 144,132 C136,130 128,138 122,156 L120,172 L118,156 C112,138 104,130 96,132 Z" fill="url(#dress${id})" ${L}/>
  <path d="M100,146 C104,140 112,142 116,152 M140,146 C136,140 128,142 124,152 M104,162 C108,168 114,168 118,164 M136,162 C132,168 126,168 122,164" stroke="#c9bde0" stroke-width="2" fill="none"/>
  <path d="M100,132 L110,92 M140,132 L130,92" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
  <path d="M98,114 C86,146 92,186 113,210 M142,114 C154,146 148,186 127,210" stroke="${OUT}" stroke-width="10" stroke-linecap="round" fill="none"/>
  <path d="M98,114 C86,146 92,186 113,210 M142,114 C154,146 148,186 127,210" stroke="#a7a2d0" stroke-width="7" stroke-linecap="round" fill="none"/>
  <ellipse cx="114" cy="212" rx="8" ry="6" fill="url(#skinD${id})" ${L}/><ellipse cx="126" cy="212" rx="8" ry="6" fill="url(#skinD${id})" ${L}/>
  <path d="M112,70 L128,70 L130,96 L110,96 Z" fill="url(#skinD${id})" ${L}/>
  ${head}${heart}</svg>`;
}

const $ = id => document.getElementById(id);
// [element, optional box inside it, blocks clicks underneath?]
const SPOTS = () => [
  [$('camscreen'), null, false],
  [$('p-board'), { left: 0, top: 36, width: $('p-board').clientWidth, height: $('p-board').clientHeight - 36 }, true],
];
export const SUCC_TIME = 4500;
let timer = null, uid = 0;
export function succubus() {
  clearTimeout(timer); document.querySelectorAll('.succ, .succblock').forEach(d => d.remove());
  audio.sfx.sultry();
  setTimeout(() => audio.sfx.pop(), POP_AT * 1000);
  for (const [el, box, blocks] of SPOTS()) {
    if (!el) continue;
    const bw = box ? box.width : el.clientWidth, bh = box ? box.height : el.clientHeight, ox = box ? box.left : 0, oy = box ? box.top : 0;
    if (blocks) {   // a veil over the whole board: nothing under her can be pressed while she is there
      const v = document.createElement('div'); v.className = 'succblock';
      Object.assign(v.style, { left: ox + 'px', top: oy + 'px', width: bw + 'px', height: bh + 'px' });
      el.appendChild(v);
    }
    const h = Math.min(bh * 0.96, 560), w = h * 240 / 400;
    const d = document.createElement('div'); d.className = 'succ marilyn';
    Object.assign(d.style, { width: w + 'px', height: h + 'px', top: (oy + bh - h) + 'px', left: (ox + (bw - w) / 2) + 'px' });
    d.innerHTML = art('s' + (++uid));
    el.appendChild(d);
  }
  timer = setTimeout(() => document.querySelectorAll('.succ, .succblock').forEach(d => d.remove()), SUCC_TIME);
}
export const previewArt = () => art('p' + (++uid));   // for checking the art
