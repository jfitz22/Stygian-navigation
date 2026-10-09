// The stokehold's painted sprites. They are drawn on flat magenta: on load each one is keyed out (with the pink fringe
// pulled back towards grey) and cropped to its own outline, so the game can place them by their real size.
const NAMES = ['backdrop', 'box-out', 'box-dying', 'box-good', 'box-roaring', 'box-burst', 'coal', 'gauge', 'smoke', 'steam', 'stoker-ready', 'stoker-throw'];
const art = {};
let started = false;

function keyed(img) {
  const w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h), p = d.data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], m = Math.min(r, b) - g;   // how magenta a pixel is
    if (m > 110 && r > 150 && b > 150) p[i + 3] = 0;
    else if (m > 45 && r > 100 && b > 100) {                               // the soft edge: part see-through, the pink taken out
      p[i + 3] = Math.round(255 * Math.max(0, Math.min(1, (110 - m) / 65)));
      p[i] = Math.max(0, r - m * 0.7); p[i + 2] = Math.max(0, b - m * 0.7);
    }
    if (p[i + 3] > 24) { const k = i / 4, x = k % w, y = (k - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  ctx.putImageData(d, 0, 0);
  if (x1 < 0) return c;
  const out = document.createElement('canvas'); out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

// The sprites loaded so far, by name (the backdrop as it is, the rest keyed and cropped). Starts loading on first call.
export function stokeArt() {
  if (!started) {
    started = true;
    for (const n of NAMES) {
      const img = new Image();
      img.onload = () => { try { art[n] = n === 'backdrop' ? img : keyed(img); } catch (e) { art[n] = img; } };
      img.src = new URL('../assets/stokehold/' + n + '.webp', import.meta.url).href;
    }
  }
  return art;
}
