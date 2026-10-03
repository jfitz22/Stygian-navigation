// The GM link. Same computer: a BroadcastChannel between tabs. Another computer: a Supabase Realtime
// broadcast channel named by a short room code. Messages are plain objects either way.
import { SUPABASE_URL, SUPABASE_KEY } from './net-config.js';

export const NET_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // no I, L, O, 0 or 1 to misread on stream
export function newRoomCode() { return Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join(''); }
export const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

let clientP = null;
function client() {
  if (!clientP) clientP = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 10 } } }));
  return clientP;
}

// onMessage(msg), onStatus('LOCAL' | 'CONNECTING' | 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'OFFLINE')
export function openLink(onMessage, onStatus = () => {}) {
  const local = 'BroadcastChannel' in window ? new BroadcastChannel('lastwatch-gm:' + location.pathname.replace(/[^/]*$/, '')) : null;
  if (local) local.onmessage = ev => onMessage(ev.data || {});
  let remote = null, ready = false, room = null;
  const link = {
    get room() { return room; },
    get online() { return ready; },
    async join(code) {
      code = cleanCode(code);
      if (code === room && remote) return;
      if (remote) { const sb = await client(); sb.removeChannel(remote); remote = null; ready = false; }
      room = code;
      if (!NET_ENABLED || !code) { onStatus('LOCAL'); return; }
      onStatus('CONNECTING');
      try {
        const sb = await client();
        if (room !== code) return;
        const ch = sb.channel('lastwatch-' + code, { config: { broadcast: { self: false } } });
        ch.on('broadcast', { event: 'm' }, ({ payload }) => onMessage(payload || {}));
        ch.subscribe(s => { if (remote !== ch) return; ready = s === 'SUBSCRIBED'; onStatus(s); });
        remote = ch;
      } catch (e) { onStatus('OFFLINE'); }
    },
    // remote = false keeps a message on this computer (used to send fewer snapshots over the network)
    send(msg, toRemote = true) {
      if (local) local.postMessage(msg);
      if (toRemote && remote && ready) remote.send({ type: 'broadcast', event: 'm', payload: msg });
    },
  };
  return link;
}
