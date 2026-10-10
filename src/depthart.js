// The depth-charge fight's sprites and the disguised warship, painted on flat magenta like the stokehold's: keyed out
// and cropped to their outline on load. The backdrop is used as it is. Starts loading on first call.
import { keyed } from './stokeart.js';
const NAMES = ['backdrop', 'destroyer', 'sub', 'whale', 'warship'];
const art = {};
let started = false;
export function depthArt() {
  if (!started) {
    started = true;
    for (const n of NAMES) {
      const img = new Image();
      img.onload = () => { try { art[n] = n === 'backdrop' ? img : keyed(img); } catch (e) { art[n] = img; } };
      img.src = new URL('../assets/depth/' + n + '.webp', import.meta.url).href;
    }
  }
  return art;
}
// Draw a keyed sprite into a box of width w, keeping its own shape, its feet at y (bottom) and centred on x.
// flip mirrors it (they are all painted facing right). Returns false if it has not loaded.
export function drawDepth(ctx, name, x, y, w, flip = false) {
  const a = art[name]; if (!a || !a.width) return false;
  const h = w * a.height / a.width;
  ctx.save(); ctx.translate(x, y - h);
  if (flip) { ctx.scale(-1, 1); ctx.drawImage(a, -w / 2, 0, w, h); } else ctx.drawImage(a, -w / 2, 0, w, h);
  ctx.restore();
  return true;
}
