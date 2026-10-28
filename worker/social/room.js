// Watch-party room: one Durable Object per party. Uses the WebSocket Hibernation API, so an idle
// room costs nothing while people are watching.
//
// Client -> room:  {t:'chat', body} | {t:'sync', playing, position} (host) | {t:'media', episode, lang} (host)
//                  {t:'react', emoji} | {t:'ping'}
// Room -> client:  {t:'hello', you, room} | {t:'state', state} | {t:'chat', msg} | {t:'members', members, host}
//                  {t:'react', emoji, user} | {t:'error', message}
// `state.position` is the playhead at `state.at` (ms); clients add elapsed time while playing.
import { DurableObject } from 'cloudflare:workers';
import { clean, uid } from './util.js';

const MAX_CHAT = 150;
const REACTIONS = new Set(['😂', '😮', '😭', '🔥', '❤️', '👏', '💀', '😡']);

export class PartyRoom extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      const d = await request.json();
      await this.ctx.storage.put('room', {
        host: d.host.id,
        createdBy: d.host,
        anime: d.anime,
        episode: d.episode,
        lang: d.lang,
        state: { playing: false, position: d.position || 0, at: Date.now() },
        created: Date.now(),
      });
      await this.ctx.storage.put('chat', []);
      return Response.json({ ok: true });
    }
    const room = await this.ctx.storage.get('room');
    if (!room) return Response.json({ error: 'Room not found' }, { status: 404 });
    if (url.pathname === '/info') return Response.json({ room: this.view(room), members: this.members().length });
    if (url.pathname === '/ws') {
      const user = JSON.parse(request.headers.get('X-User') || 'null');
      if (!user) return new Response('Unauthorized', { status: 401 });
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server, [user.id]);
      server.serializeAttachment(user);
      // The party creator gets host back when they rejoin; otherwise an empty room makes the joiner host.
      if (room.host !== user.id && (user.id === room.createdBy.id || !this.members().some((m) => m.id === room.host))) {
        room.host = user.id;
        await this.ctx.storage.put('room', room);
      }
      server.send(JSON.stringify({ t: 'hello', you: user, room: this.view(room), chat: (await this.ctx.storage.get('chat')) || [] }));
      this.broadcastMembers(room);
      return new Response(null, { status: 101, webSocket: client });
    }
    return new Response('Not found', { status: 404 });
  }

  view(room) {
    return { anime: room.anime, episode: room.episode, lang: room.lang, state: room.state, host: room.host, createdBy: room.createdBy };
  }

  members() {
    const seen = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const u = ws.deserializeAttachment();
      if (u) seen.set(u.id, { id: u.id, display_name: u.display_name, username: u.username, avatar: u.avatar });
    }
    return [...seen.values()];
  }

  send(msg, except) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(data);
      } catch {
        /* closing socket */
      }
    }
  }

  broadcastMembers(room) {
    this.send({ t: 'members', members: this.members(), host: room.host });
  }

  async webSocketMessage(ws, raw) {
    const user = ws.deserializeAttachment();
    let m;
    try {
      m = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    const room = await this.ctx.storage.get('room');
    if (!room || !user) return;
    const isHost = room.host === user.id;

    if (m.t === 'ping') return ws.send(JSON.stringify({ t: 'pong', now: Date.now() }));

    if (m.t === 'chat') {
      const text = clean(String(m.body || '').trim()).slice(0, 300);
      if (!text) return;
      // 1 message per 700 ms per user.
      const last = user._last || 0;
      if (Date.now() - last < (user.guest ? 2000 : 700)) return ws.send(JSON.stringify({ t: 'error', message: 'Slow down' }));
      ws.serializeAttachment({ ...user, _last: Date.now() });
      const msg = { id: uid(), user: { id: user.id, display_name: user.display_name, avatar: user.avatar }, body: text, at: Date.now(), position: Number(m.position) || null };
      const chat = ((await this.ctx.storage.get('chat')) || []).concat(msg).slice(-MAX_CHAT);
      await this.ctx.storage.put('chat', chat);
      return this.send({ t: 'chat', msg });
    }

    if (m.t === 'react' && REACTIONS.has(m.emoji)) {
      return this.send({ t: 'react', emoji: m.emoji, user: user.display_name });
    }

    if (!isHost) return; // everything below is host-only
    if (m.t === 'sync') {
      room.state = { playing: !!m.playing, position: Math.max(0, Number(m.position) || 0), at: Date.now() };
      await this.ctx.storage.put('room', room);
      return this.send({ t: 'state', state: room.state }, ws);
    }
    if (m.t === 'media') {
      const ep = Number(m.episode);
      if (!Number.isInteger(ep) || ep < 1) return;
      room.episode = ep;
      room.lang = m.lang === 'dub' ? 'dub' : 'sub';
      room.state = { playing: false, position: 0, at: Date.now() };
      await this.ctx.storage.put('room', room);
      return this.send({ t: 'room', room: this.view(room) });
    }
    if (m.t === 'transfer' && m.to) {
      if (!this.members().some((x) => x.id === m.to)) return;
      room.host = m.to;
      await this.ctx.storage.put('room', room);
      this.send({ t: 'room', room: this.view(room) });
      return this.broadcastMembers(room);
    }
  }

  async webSocketClose(ws) {
    const user = ws.deserializeAttachment();
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    const room = await this.ctx.storage.get('room');
    if (!room) return;
    const members = this.members().filter((m) => m.id !== user?.id || this.ctx.getWebSockets(user.id).length > 1);
    // Host left: hand control to whoever is still here.
    if (user?.id === room.host && !this.ctx.getWebSockets(user.id).some((s) => s !== ws) && members.length) {
      room.host = members[0].id;
      await this.ctx.storage.put('room', room);
      this.send({ t: 'room', room: this.view(room) });
    }
    this.send({ t: 'members', members, host: room.host });
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }
}
