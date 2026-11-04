// The shared sky: family members flying at the same time see each other's balloons.
// A WebSocket at /api/sky that only relays: each one says where their balloon is, the server passes it on to
// whoever is in the same galaxy. Nothing is simulated or stored here.
//
// Who may come in: a galaxy's owner (admin password on that device) or a device let into a private galaxy
// (`skyMember`). A room is a galaxy; you only join one you may enter (`canEnterSlug`), checked again every
// minute, so turning someone away takes them out of the sky too.
//
// Protocol (JSON, one message per frame):
//   → hello {device, auth}            ← welcome {id, name}  (or the socket closes 4401)
//   → join {g}                        ← room {g, peers:[{id, name, s}]} · others get in {id, name}
//                                     ← nope {g}  if the door is closed
//   → s {s:[...]}  state              others get s {id, s}
//   → to {to, e:{k, ...}}             that one gets ev {from, e}: bump, say {text}, gas, the expedition's
//                                     invite/join/leave/look/cross, and voice: sdp {d}, ice {c} (nothing is kept)
//                                     ← out {id}  someone left the room
import { WebSocketServer } from 'ws';
import crypto from 'crypto';
import * as galaxies from './galaxies.js';

const MAX_MSG = 12000;        // bytes: a state is ~120, a voice offer (WebRTC SDP) a few thousand
const MAX_RATE = 40;          // messages per second per socket, well over the 10 it sends
const RECHECK_MS = 60 * 1000; // doors are asked again this often
const HELLO_MS = 8000;        // say who you are within this, or goodbye

const rooms = new Map(); // slug -> Set(client)

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function others(c, msg) { for (const o of rooms.get(c.room) || []) if (o !== c) send(o.ws, msg); }
function leave(c) {
  if (!c.room) return;
  const r = rooms.get(c.room);
  r?.delete(c);
  if (r && !r.size) rooms.delete(c.room);
  others(c, { t: 'out', id: c.id });
  c.room = null;
}

export function attachSky(server, ezePassword) {
  const wss = new WebSocketServer({ server, path: '/api/sky', maxPayload: MAX_MSG * 4 });
  const hellos = new Map(); // ip -> recent hello times, so the door isn't hammered

  wss.on('connection', (ws, req) => {
    const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const c = { ws, id: crypto.randomBytes(5).toString('base64url'), name: '', who: null, device: '', room: null, state: null, n: 0, sec: 0, alive: true };
    const late = setTimeout(() => { if (!c.name) ws.close(4401, 'who are you'); }, HELLO_MS);
    ws.on('pong', () => { c.alive = true; });

    ws.on('message', async (raw) => {
      if (raw.length > MAX_MSG) return;
      const sec = Math.floor(Date.now() / 1000);
      if (sec !== c.sec) { c.sec = sec; c.n = 0; }
      if (++c.n > MAX_RATE) return;
      let m;
      try { m = JSON.parse(raw); } catch { return; }

      if (m.t === 'hello' && !c.name) {
        const now = Date.now(), recent = (hellos.get(ip) || []).filter((t) => now - t < 60 * 1000);
        if (recent.length >= 30) return ws.close(4429, 'slow down');
        recent.push(now); hellos.set(ip, recent);
        const owner = await galaxies.ownerOf(typeof m.auth === 'string' ? m.auth : '', ezePassword).catch(() => null);
        const member = await galaxies.skyMember(String(m.device || ''), owner?.slug, owner?.name).catch(() => null);
        if (!member) return ws.close(4401, 'no sky for you');
        clearTimeout(late);
        Object.assign(c, { name: member.name, who: owner?.slug || null, device: String(m.device || '') });
        return send(ws, { t: 'welcome', id: c.id, name: c.name });
      }
      if (!c.name) return;

      if (m.t === 'join') {
        const g = String(m.g || '').slice(0, 40);
        if (g === c.room) return;
        leave(c);
        c.state = null;
        if (!(await galaxies.canEnterSlug(g, c.device, c.who).catch(() => false))) return send(ws, { t: 'nope', g });
        if (!rooms.has(g)) rooms.set(g, new Set());
        const r = rooms.get(g);
        send(ws, { t: 'room', g, peers: [...r].map((o) => ({ id: o.id, name: o.name, s: o.state })) });
        r.add(c);
        c.room = g;
        return others(c, { t: 'in', id: c.id, name: c.name });
      }
      // one to one: a bump, a word, a gallon of gas, an invitation. Only to someone in the same room
      if (m.t === 'to' && c.room && typeof m.to === 'string' && m.e && typeof m.e === 'object' && typeof m.e.k === 'string') {
        for (const o of rooms.get(c.room) || []) if (o.id === m.to && o !== c) send(o.ws, { t: 'ev', from: c.id, e: m.e });
        return;
      }
      if (m.t === 's' && c.room && raw.length < 600 && Array.isArray(m.s) && m.s.length <= 16 && m.s.every((v) => typeof v === 'number' && Number.isFinite(v))) {
        c.state = m.s;
        others(c, { t: 's', id: c.id, s: m.s });
      }
    });
    ws.on('close', () => { clearTimeout(late); leave(c); });
    ws.on('error', () => {});
    ws.c = c;
  });

  // heartbeat: a socket that stops answering is gone (a phone that went to sleep)
  setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.c.alive) { ws.terminate(); continue; }
      ws.c.alive = false;
      ws.ping();
    }
  }, 20 * 1000).unref();

  // doors change (someone turned away): ask again for everyone in a room
  setInterval(async () => {
    for (const [g, r] of rooms) for (const c of [...r]) {
      if (!(await galaxies.skyMember(c.device, c.who, c.name).catch(() => null))) { leave(c); c.ws.close(4401, 'no sky for you'); continue; }
      if (!(await galaxies.canEnterSlug(g, c.device, c.who).catch(() => false))) { leave(c); send(c.ws, { t: 'nope', g }); }
    }
  }, RECHECK_MS).unref();

  return wss;
}

// Voice goes browser to browser (WebRTC); phones on 4G/5G usually can't reach each other directly, so a relay of
// our own (coturn on the VPS, `use-auth-secret`) carries it when needed. Credentials last six hours and are made
// from the shared secret, nothing stored. Without TURN_SECRET only a direct connection is tried (same network).
export function iceServers() {
  const secret = process.env.TURN_SECRET, host = process.env.TURN_HOST || 'ezeangeloni.xyz';
  if (!secret) return [];
  const username = `${Math.floor(Date.now() / 1000) + 6 * 3600}:cronovisor`;
  const credential = crypto.createHmac('sha1', secret).update(username).digest('base64');
  return [
    { urls: `stun:${host}:3478` },
    { urls: [`turn:${host}:3478?transport=udp`, `turn:${host}:3478?transport=tcp`], username, credential },
  ];
}
