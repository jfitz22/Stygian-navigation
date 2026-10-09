import { BANNER_CATALOG } from './banner-catalog.js';

export const DROP_MS = 700, HOLD_MS = 5000, LIFT_MS = 550;
export const OPERATOR_PANELS = ['p-sonar', 'p-map', 'p-cams', 'p-board', 'p-launch', 'p-fleet'];
export const OFFICER_ROLES = ['gunnery', 'signals', 'engineer'];
export const BANNER_PANELS = [...OPERATOR_PANELS, ...OFFICER_ROLES.flatMap(r => [r + ':job', r + ':fleetpanel'])];

// A separate stream: rolling magazine covers must never change ice, runes or combat.
export function rollBanners(w, now = Date.now()) {
  const seq = w.bannerSeq = (w.bannerSeq || 0) + 1;
  let seed = ((Number(w.seed) || 0) ^ Math.imul(seq, 0x9e3779b9)) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const images = shuffle(BANNER_CATALOG.map(a => a.id)).slice(0, 2);
  // Only connected officers can receive a persistent obstruction.
  const sticky = new Set(shuffle([...OPERATOR_PANELS, ...OFFICER_ROLES.filter(r => w.defence?.live?.[r]).map(r => r + ':job')]).slice(0, 1 + Math.floor(random() * 2)));
  const order = shuffle([...BANNER_PANELS]);
  w.bannerEvent = { id: `${now}-${seq}`, at: now, images, panels: order.map((key, i) => ({ key, image: images[i % 2], sticky: sticky.has(key), dismissedAt: null })) };
  return w.bannerEvent;
}

export function bannerEnd(event, panel) {
  return panel.dismissedAt ?? (panel.sticky ? Infinity : event.at + DROP_MS + HOLD_MS);
}
export function bannerActive(event, key, now = Date.now()) {
  const p = event?.panels.find(p => p.key === key);
  return !!p && now < bannerEnd(event, p) + LIFT_MS;
}
export function dismissBanner(w, role, eventId, key, now = Date.now()) {
  const event = w.bannerEvent;
  if (!event || event.id !== eventId) return false;
  if (role === 'operator' ? !OPERATOR_PANELS.includes(key) : !OFFICER_ROLES.includes(role) || !key.startsWith(role + ':')) return false;
  const panel = event.panels.find(p => p.key === key);
  if (!panel || panel.dismissedAt != null) return false;
  panel.dismissedAt = now;
  return true;
}
