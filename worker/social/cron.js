// Hourly: turn newly aired episodes of subscribed anime into in-app notifications.
import { now, uid } from './util.js';

export async function notifyNewEpisodes(env) {
  const { results: subs } = await env.DB.prepare('SELECT DISTINCT anime_id FROM subscriptions').all();
  if (!subs.length) return;
  const wanted = new Set(subs.map((s) => s.anime_id));
  const origin = env.API_ORIGIN || 'https://animegng-api.vercel.app';
  // The two most recent pages cover well over an hour of releases.
  const aired = [];
  for (const page of [1, 2]) {
    const res = await fetch(`${origin}/api/latest-aired?page=${page}&limit=50`, { headers: { Accept: 'application/json' } });
    if (!res.ok) break;
    aired.push(...(await res.json()).results);
  }
  for (const item of aired) {
    if (!wanted.has(item.anime.id) || new Date(item.aired_at).getTime() > now()) continue;
    const { results: due } = await env.DB.prepare('SELECT user_id FROM subscriptions WHERE anime_id = ? AND last_notified_episode < ?').bind(item.anime.id, item.episode).all();
    if (!due.length) continue;
    const payload = JSON.stringify({ anime_id: item.anime.id, episode: item.episode, title: item.anime.title, cover: item.anime.cover_image?.large });
    await env.DB.batch([
      ...due.map((d) => env.DB.prepare('INSERT INTO notifications (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)').bind(uid(), d.user_id, 'episode', payload, now())),
      env.DB.prepare('UPDATE subscriptions SET last_notified_episode = ? WHERE anime_id = ? AND last_notified_episode < ?').bind(item.episode, item.anime.id, item.episode),
    ]);
  }
}
