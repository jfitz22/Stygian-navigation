import { BANNER_CATALOG } from './banner-catalog.js';
import { OPERATOR_PANELS, DROP_MS, HOLD_MS, LIFT_MS, bannerEnd } from './banners.js';

// Host timestamps drive all views. A snapshot refresh never restarts the animation.
export function createBannerUI(role, dismiss) {
  const layers = new Map();
  let lastEvent = null, hostAt = 0, receivedAt = 0;
  const remove = key => {
    const layer = layers.get(key); if (!layer) return;
    layer.observer.disconnect();
    for (const [el, inert] of layer.inert) el.inert = inert;
    layer.cover.remove(); layer.target.style.position = layer.position; layers.delete(key);
  };
  const clear = () => { for (const key of [...layers.keys()]) remove(key); };
  const targetFor = key => {
    if (!key.includes(':')) return document.getElementById(key);
    const id = key.split(':')[1];
    return document.getElementById(id === 'job' && !document.getElementById('defence')?.classList.contains('hidden') ? 'defence' : id);
  };
  const covered = key => layers.has(key);
  // Canvas games also listen on window; inert alone cannot stop those shortcuts.
  const onKey = e => {
    if (e.target.closest?.('.curtain-pull')) return;
    const blocked = role === 'operator'
      ? (e.key === ' ' && covered('p-sonar')) || (/^Arrow(Left|Right)$/.test(e.key) && covered('p-cams'))
      : covered(role + ':job') && /^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight| |r|R)$/.test(e.key);
    if (blocked) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  addEventListener('keydown', onKey, true);
  addEventListener('pagehide', clear);
  return { covered, clear, destroy() { clear(); removeEventListener('keydown', onKey, true); removeEventListener('pagehide', clear); }, update(event, hostNow) {
    if (!event) { clear(); lastEvent = null; return; }
    if (event.id !== lastEvent) { clear(); lastEvent = event.id; }
    if (hostNow !== hostAt) { hostAt = hostNow; receivedAt = performance.now(); }
    const now = hostAt + performance.now() - receivedAt;
    const keys = role === 'operator' ? OPERATOR_PANELS : [role + ':job', role + ':fleetpanel'];
    for (const key of keys) {
      const panel = event.panels.find(p => p.key === key), target = targetFor(key);
      const end = panel ? bannerEnd(event, panel) : 0;
      if (!target || !panel || now >= end + LIFT_MS) { remove(key); continue; }
      if (layers.get(key)?.target !== target) remove(key);
      let layer = layers.get(key);
      if (!layer) {
        const cover = document.createElement('div'); cover.className = 'study-curtain'; cover.dataset.bannerKey = key;
        const asset = BANNER_CATALOG.find(a => a.id === panel.image);
        cover.innerHTML = '<div class="curtain-cloth"><img><div class="curtain-greeting">Hey Sailor <span>♥</span></div><div class="curtain-hem"></div></div><div class="curtain-roller"></div><button class="curtain-pull" aria-label="Pull cord to roll up banner"><span class="rope"></span><span class="pull-handle">PULL UP</span></button>';
        const image = cover.querySelector('img'); image.src = asset?.path || ''; image.alt = asset?.title || 'Playdevil banner';
        layer = { target, cover, position: target.style.position, inert: new Map(), pending: false, sentAt: 0 };
        if (getComputedStyle(target).position === 'static') target.style.position = 'relative';
        const lock = () => { for (const el of target.children) { if (el === cover || layer.inert.has(el)) continue; layer.inert.set(el, el.inert); el.inert = true; } };
        lock(); layer.observer = new MutationObserver(lock); layer.observer.observe(target, { childList: true }); target.append(cover); layers.set(key, layer);
        cover.querySelector('button').onclick = e => { e.preventDefault(); e.stopPropagation(); layer.pending = true; layer.sentAt = now; dismiss(event.id, key); };
        for (const type of ['pointerdown', 'pointerup', 'click']) cover.addEventListener(type, e => e.stopPropagation());
      }
      // Retry a lost relay command until the host acknowledges it in a snapshot.
      if (layer.pending && panel.dismissedAt == null && now - layer.sentAt > 1000) { layer.sentAt = now; dismiss(event.id, key); }
      const age = now - event.at, reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      let drop = age < 0 ? 0 : age < DROP_MS ? 1 - (1 - age / DROP_MS) ** 3 : 1;
      if (now >= end) drop = 1 - ((now - end) / LIFT_MS) ** 2;
      if (reduced) drop = now >= end ? 0 : 1;
      layer.cover.style.setProperty('--drop', Math.max(0, drop));
      layer.cover.classList.toggle('waiting', panel.sticky && age > DROP_MS + HOLD_MS);
    }
  } };
}
