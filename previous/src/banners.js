import { BANNER_CATALOG } from './banner-catalog.js';

// The covers drop in DROP_MS and start to lift 5 s after the press. The cords appear (and work) after CORD_MS.
export const DROP_MS = 700, HOLD_MS = 4300, LIFT_MS = 550, CORD_MS = 3000;
// STICKY covers stay down until their cord is pulled: up to OFFICER_STICKY of them on connected officers, the rest on the operator.
export const STICKY = 4, OFFICER_STICKY = 2;
export const OPERATOR_PANELS = ['p-sonar', 'p-map', 'p-cams', 'p-board', 'p-launch', 'p-fleet'];
export const OFFICER_ROLES = ['gunnery', 'signals', 'engineer', 'fleet'];
// each officer's two covered panels (the Fleet Officer has no fleet panel of their own: their dispatch instead)
export const officerPanels = r => [r + ':job', r + (r === 'fleet' ? ':steady' : ':fleetpanel')];
export const BANNER_PANELS = [...OPERATOR_PANELS, ...OFFICER_ROLES.flatMap(officerPanels)];

// A separate stream: rolling magazine covers must never change ice, runes or combat.
export function rollBanners(w, now = Date.now()) {
  const seq = w.bannerSeq = (w.bannerSeq || 0) + 1;
  let seed = ((Number(w.seed) || 0) ^ Math.imul(seq, 0x9e3779b9)) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const images = shuffle(BANNER_CATALOG.map(a => a.id)).slice(0, 2);
  // Only connected officers can receive a persistent obstruction; with nobody connected all four land on the operator.
  const officers = shuffle(OFFICER_ROLES.filter(r => w.defence?.live?.[r]).map(r => r + ':job')).slice(0, OFFICER_STICKY);
  const sticky = new Set([...officers, ...shuffle([...OPERATOR_PANELS]).slice(0, STICKY - officers.length)]);
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
  if (!panel || panel.dismissedAt != null || now < event.at + CORD_MS) return false;   // no cord to pull yet
  panel.dismissedAt = now;
  return true;
}
