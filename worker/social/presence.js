// Live visitor counts: one Durable Object for the whole site, one hibernating WebSocket per open tab.
// A browser's tabs share a random id, so each visitor counts once. Nothing is written to storage.
//
// Client -> counter:  {p: 'anime:episode'} when the page changes, {p: ''} on any other page
// Counter -> client:  {n: visitors on the site, e: {episode: viewers}} for the anime that client is watching
import { DurableObject } from 'cloudflare:workers';

const BROADCAST_MS = 15_000;

export class Presence extends DurableObject {
  async fetch(request) {
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ c: new URL(request.url).searchParams.get('cid') });
    return new Response(null, { status: 101, webSocket: client });
  }

  tally() {
    const everyone = new Set();
    const animes = new Map();
    for (const ws of this.ctx.getWebSockets()) {
      const { c, a, e } = ws.deserializeAttachment() || {};
      if (!c) continue;
      everyone.add(c);
      if (!a) continue;
      if (!animes.has(a)) animes.set(a, new Map());
      const eps = animes.get(a);
      if (!eps.has(e)) eps.set(e, new Set());
      eps.get(e).add(c);
    }
    const counts = new Map();
    for (const [a, eps] of animes) counts.set(a, Object.fromEntries([...eps].map(([e, ids]) => [e, ids.size])));
    return { n: everyone.size, counts };
  }

  push(ws, { n, counts }) {
    const { a } = ws.deserializeAttachment() || {};
    try {
      ws.send(JSON.stringify({ n, e: (a && counts.get(a)) || {} }));
    } catch {
      // Already closed.
    }
  }

  async webSocketMessage(ws, message) {
    let page;
    try {
      page = String(JSON.parse(message).p ?? '');
    } catch {
      return;
    }
    const m = page.match(/^(\d{1,9}):(\d{1,6})$/);
    ws.serializeAttachment({ c: ws.deserializeAttachment()?.c, a: m ? m[1] : null, e: m ? m[2] : null });
    this.push(ws, this.tally());
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + BROADCAST_MS);
  }

  webSocketClose(ws) {
    try {
      ws.close();
    } catch {
      // Already closed.
    }
  }

  webSocketError(ws) {
    this.webSocketClose(ws);
  }

  // Runs only while someone is connected, so an empty site costs nothing.
  async alarm() {
    const sockets = this.ctx.getWebSockets();
    if (!sockets.length) return;
    const tally = this.tally();
    for (const ws of sockets) this.push(ws, tally);
    await this.ctx.storage.setAlarm(Date.now() + BROADCAST_MS);
  }
}
