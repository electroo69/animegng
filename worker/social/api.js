// Account & community API, served at /api/u/* (the Pages site proxies these paths to this Worker).
import { changePassword, confirmEmail, currentUser, emailLink, login, logout, magicVerify, oauthCallback, oauthStart, providers, register, requestEmailVerify, requireUser, resetPassword } from './auth.js';
import { clientIp, rateLimit, VAPID_PUBLIC } from './extras.js';
import { body, checkOrigin, clean, fail, HttpError, json, now, ORIGINS, privateUser, publicUser, uid } from './util.js';

const int = (v, name) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) fail(400, `Invalid ${name}`);
  return n;
};
// Small, trusted-shape anime card stored alongside rows so lists render without another lookup.
function card(a) {
  if (!a || typeof a !== 'object') fail(400, 'Missing anime');
  const pick = { id: int(a.id, 'anime id'), title: a.title, cover_image: a.cover_image, banner_image: a.banner_image ?? null, format: a.format ?? null, episodes: a.episodes ?? null, season_year: a.season_year ?? null, genres: Array.isArray(a.genres) ? a.genres.slice(0, 5) : [], average_score: a.average_score ?? null, next_airing_episode: a.next_airing_episode ?? null, status: a.status ?? null };
  const s = JSON.stringify(pick);
  if (s.length > 4000) fail(400, 'Anime data too large');
  return s;
}
const parse = (rows, key = 'anime') => rows.map((r) => ({ ...r, [key]: JSON.parse(r[key]) }));

// ------------------------------------------------------------------ history (continue watching)

async function historyList(env, user) {
  const { results } = await env.DB.prepare('SELECT anime_id, episode, episode_title, thumbnail, anime, position, duration, updated_at FROM history WHERE user_id = ? ORDER BY updated_at DESC LIMIT 60').bind(user.id).all();
  return parse(results);
}

async function historyPut(env, user, d) {
  await env.DB.prepare(`INSERT INTO history (user_id, anime_id, episode, episode_title, thumbnail, anime, position, duration, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, anime_id) DO UPDATE SET episode = excluded.episode, episode_title = excluded.episode_title, thumbnail = excluded.thumbnail,
      anime = excluded.anime, position = excluded.position, duration = excluded.duration, updated_at = excluded.updated_at
    WHERE excluded.updated_at >= history.updated_at`)
    .bind(user.id, int(d.anime?.id, 'anime id'), int(d.episode, 'episode'), d.episode_title ? String(d.episode_title).slice(0, 200) : null,
      d.thumbnail ? String(d.thumbnail).slice(0, 500) : null, card(d.anime), Math.floor(Number(d.position) || 0), Math.floor(Number(d.duration) || 0), Math.min(Number(d.updated_at) || now(), now()))
    .run();
}

// ------------------------------------------------------------------ manga (MangaGang: continue reading, saved, reading list)

const MANGA_ID = /^[0-9A-Z]{26}$/;
const MANGA_LISTS = new Set(['saved', 'plan']);
const mangaId = (v, name) => (MANGA_ID.test(String(v)) ? String(v) : fail(400, `Invalid ${name}`));
const mangaList = (v) => (MANGA_LISTS.has(v) ? v : fail(400, 'Invalid list'));
function mangaCard(m) {
  if (!m || typeof m !== 'object') fail(400, 'Missing manga');
  return JSON.stringify({ id: mangaId(m.id, 'manga id'), title: String(m.title ?? '').slice(0, 200), cover: String(m.cover ?? '').slice(0, 300), slug: m.slug ? String(m.slug).slice(0, 200) : null });
}

async function mangaHistoryList(env, user) {
  const { results } = await env.DB.prepare('SELECT series, chapter_id, chapter_name, updated_at FROM manga_history WHERE user_id = ? ORDER BY updated_at DESC LIMIT 60').bind(user.id).all();
  return parse(results, 'series');
}

async function mangaHistoryPut(env, user, d) {
  const series = mangaCard(d.series);
  await env.DB.prepare(`INSERT INTO manga_history (user_id, series_id, series, chapter_id, chapter_name, updated_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT (user_id, series_id) DO UPDATE SET series = excluded.series, chapter_id = excluded.chapter_id, chapter_name = excluded.chapter_name, updated_at = excluded.updated_at
    WHERE excluded.updated_at >= manga_history.updated_at`)
    .bind(user.id, JSON.parse(series).id, series, mangaId(d.chapter_id, 'chapter id'), String(d.chapter_name ?? 'Chapter').slice(0, 120), Math.min(Number(d.updated_at) || now(), now()))
    .run();
}

async function mangaLibraryList(env, user) {
  const { results } = await env.DB.prepare('SELECT list, series, added_at FROM manga_library WHERE user_id = ? ORDER BY added_at DESC LIMIT 1000').bind(user.id).all();
  return parse(results, 'series');
}

async function mangaLibraryPut(env, user, list, d) {
  const series = mangaCard(d.series);
  await env.DB.prepare('INSERT OR IGNORE INTO manga_library (user_id, list, series_id, series, added_at) VALUES (?, ?, ?, ?, ?)')
    .bind(user.id, mangaList(list), JSON.parse(series).id, series, Math.min(Number(d.added_at) || now(), now()))
    .run();
}

// ------------------------------------------------------------------ comments

const COMMENT_COLS = `c.id, c.anime_id, c.episode, c.parent_id, c.body, c.spoiler, c.ts, c.likes, c.dislikes, c.reply_count, c.deleted, c.created_at,
  u.id AS user_id, u.username, u.display_name, u.avatar, u.is_admin`;
const shapeComment = (r) => ({
  id: r.id, anime_id: r.anime_id, episode: r.episode, parent_id: r.parent_id, spoiler: !!r.spoiler, ts: r.ts,
  body: r.deleted ? null : r.body, deleted: !!r.deleted, likes: r.likes, dislikes: r.dislikes, reply_count: r.reply_count, created_at: r.created_at,
  my_vote: r.my_vote ?? 0, user: { id: r.user_id, username: r.username, display_name: r.display_name, avatar: r.avatar, is_admin: !!r.is_admin },
});

async function commentsList(env, user, q) {
  const anime = int(q.get('anime'), 'anime'), ep = int(q.get('ep'), 'episode');
  const parent = q.get('parent');
  const sort = q.get('sort') === 'top' ? 'c.likes - c.dislikes DESC, c.created_at DESC' : parent ? 'c.created_at ASC' : 'c.created_at DESC';
  const limit = Math.min(50, Number(q.get('limit')) || 20);
  const offset = Math.max(0, Number(q.get('offset')) || 0);
  const { results } = await env.DB.prepare(`SELECT ${COMMENT_COLS}, (SELECT value FROM votes v WHERE v.user_id = ? AND v.target_type = 'comment' AND v.target_id = c.id) AS my_vote
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.anime_id = ? AND c.episode = ? AND ${parent ? 'c.parent_id = ?' : 'c.parent_id IS NULL'} AND u.banned = 0 AND NOT (c.deleted = 1 AND c.reply_count = 0)
    ORDER BY ${sort} LIMIT ? OFFSET ?`)
    .bind(user?.id ?? '', anime, ep, ...(parent ? [parent] : []), limit + 1, offset).all();
  const total = parent ? null : (await env.DB.prepare('SELECT COUNT(*) AS n FROM comments WHERE anime_id = ? AND episode = ? AND deleted = 0').bind(anime, ep).first()).n;
  return { total, has_more: results.length > limit, items: results.slice(0, limit).map(shapeComment) };
}

async function commentCreate(env, user, d) {
  const text = String(d.body || '').trim();
  const live = d.ts !== undefined && d.ts !== null;
  if (!text) fail(400, 'Comment is empty');
  if (text.length > (live ? 200 : 2000)) fail(400, live ? 'Live comments are limited to 200 characters' : 'Comment is too long');
  // Basic flood control: one comment every 8 seconds per user.
  const last = await env.DB.prepare('SELECT created_at FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first();
  if (last && now() - last.created_at < 8000) fail(429, 'Slow down a little before commenting again');
  const anime = int(d.anime_id, 'anime'), ep = int(d.episode, 'episode');
  let parent = null;
  if (d.parent_id) {
    parent = await env.DB.prepare('SELECT id, user_id, anime_id, episode, parent_id FROM comments WHERE id = ?').bind(String(d.parent_id)).first();
    if (!parent || parent.anime_id !== anime || parent.episode !== ep) fail(400, 'Reply target not found');
    if (parent.parent_id) parent = await env.DB.prepare('SELECT id, user_id, anime_id, episode FROM comments WHERE id = ?').bind(parent.parent_id).first(); // one level of threading
  }
  const id = uid();
  const stmts = [
    env.DB.prepare('INSERT INTO comments (id, anime_id, episode, user_id, parent_id, body, spoiler, ts, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, anime, ep, user.id, parent?.id ?? null, clean(text), d.spoiler ? 1 : 0, live ? Math.max(0, Number(d.ts)) : null, now()),
  ];
  if (parent) {
    stmts.push(env.DB.prepare('UPDATE comments SET reply_count = reply_count + 1 WHERE id = ?').bind(parent.id));
    if (parent.user_id !== user.id) {
      stmts.push(env.DB.prepare('INSERT INTO notifications (id, user_id, type, payload, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind(uid(), parent.user_id, 'reply', JSON.stringify({ from: user.display_name, anime_id: anime, episode: ep, comment_id: id, excerpt: clean(text).slice(0, 120) }), now()));
    }
  }
  await env.DB.batch(stmts);
  const row = await env.DB.prepare(`SELECT ${COMMENT_COLS} FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`).bind(id).first();
  return shapeComment(row);
}

// Votes: one per user per target; counters kept in sync in the same batch.
async function vote(env, user, type, target, value) {
  value = Math.sign(Number(value) || 0);
  const prev = (await env.DB.prepare('SELECT value FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?').bind(user.id, type, target).first())?.value ?? 0;
  if (prev === value) return value;
  const dl = (value === 1 ? 1 : 0) - (prev === 1 ? 1 : 0);
  const dd = (value === -1 ? 1 : 0) - (prev === -1 ? 1 : 0);
  const stmts = [
    value
      ? env.DB.prepare('INSERT INTO votes (user_id, target_type, target_id, value, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET value = excluded.value').bind(user.id, type, target, value, now())
      : env.DB.prepare('DELETE FROM votes WHERE user_id = ? AND target_type = ? AND target_id = ?').bind(user.id, type, target),
  ];
  if (type === 'comment') stmts.push(env.DB.prepare('UPDATE comments SET likes = likes + ?, dislikes = dislikes + ? WHERE id = ?').bind(dl, dd, target));
  else {
    const [a, e] = target.split(':').map(Number);
    stmts.push(env.DB.prepare('INSERT INTO episode_stats (anime_id, episode, likes, dislikes) VALUES (?, ?, ?, ?) ON CONFLICT DO UPDATE SET likes = likes + excluded.likes, dislikes = dislikes + excluded.dislikes').bind(a, e, dl, dd));
  }
  await env.DB.batch(stmts);
  return value;
}

// ------------------------------------------------------------------ router

const routes = [];
const on = (method, pattern, handler) => routes.push([method, new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), handler, `${method} ${pattern}`]);

on('GET', '/me', async (r, env, { user }) => json({ user: privateUser(user) }));
on('POST', '/me/password', async (r, env, { me, data }) => changePassword(env, me, data));
on('POST', '/me/email', async (r, env, { me, data }) => requestEmailVerify(r, env, me, data));
on('GET', '/me/email/verify', async (r, env) => confirmEmail(r, env));
on('POST', '/auth/forgot', async (r, env, { data }) => emailLink(r, env, data, 'reset'));
on('POST', '/auth/magic', async (r, env, { data }) => emailLink(r, env, data, 'magic'));
on('GET', '/auth/magic/verify', async (r, env) => magicVerify(r, env));
on('POST', '/auth/reset', async (r, env, { data }) => resetPassword(r, env, data));
on('GET', '/push/key', async () => json({ key: VAPID_PUBLIC }));
on('POST', '/push/subscribe', async (r, env, { me, data }) => {
  const endpoint = String(data.endpoint || '');
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000) fail(400, 'Invalid push subscription');
  await env.DB.prepare('INSERT OR REPLACE INTO push_subscriptions (endpoint, user_id, created_at) VALUES (?, ?, ?)').bind(endpoint, me.id, now()).run();
  return json({ ok: true });
});
on('POST', '/push/unsubscribe', async (r, env, { me, data }) => {
  await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').bind(String(data.endpoint || ''), me.id).run();
  return json({ ok: true });
});
on('PATCH', '/me', async (r, env, { me, data }) => {
  const name = String(data.display_name ?? me.display_name).trim().slice(0, 40);
  if (!name) fail(400, 'Display name is required');
  const notify = data.email_notify === undefined ? me.email_notify : data.email_notify ? 1 : 0;
  await env.DB.prepare('UPDATE users SET display_name = ?, email_notify = ? WHERE id = ?').bind(clean(name), notify, me.id).run();
  return json({ user: privateUser({ ...me, display_name: clean(name), email_notify: notify }) });
});
on('DELETE', '/me', async (r, env, { me }) => {
  await env.DB.batch([env.DB.prepare('DELETE FROM comments WHERE user_id = ?').bind(me.id), env.DB.prepare('DELETE FROM users WHERE id = ?').bind(me.id)]);
  return logout(r, env);
});

on('GET', '/auth/providers', async (r, env) => providers(env));
on('POST', '/auth/register', async (r, env, { data }) => register(r, env, data));
on('POST', '/auth/login', async (r, env, { data }) => login(r, env, data));
on('POST', '/auth/logout', async (r, env) => logout(r, env));
on('GET', '/auth/:provider', async (r, env, { p }) => oauthStart(r, env, p.provider));
on('GET', '/auth/:provider/callback', async (r, env, { p }) => oauthCallback(r, env, p.provider));

on('GET', '/history', async (r, env, { me }) => json({ items: await historyList(env, me) }));
on('PUT', '/history', async (r, env, { me, data }) => (await historyPut(env, me, data), json({ ok: true })));
on('POST', '/history/import', async (r, env, { me, data }) => {
  for (const e of (Array.isArray(data.items) ? data.items : []).slice(0, 60)) await historyPut(env, me, e).catch(() => {});
  return json({ items: await historyList(env, me) });
});
on('DELETE', '/history/:anime', async (r, env, { me, p }) => {
  await env.DB.prepare('DELETE FROM history WHERE user_id = ? AND anime_id = ?').bind(me.id, int(p.anime, 'anime')).run();
  return json({ ok: true });
});

on('GET', '/manga/history', async (r, env, { me }) => json({ items: await mangaHistoryList(env, me) }));
on('PUT', '/manga/history', async (r, env, { me, data }) => (await mangaHistoryPut(env, me, data), json({ ok: true })));
on('POST', '/manga/history/import', async (r, env, { me, data }) => {
  for (const e of (Array.isArray(data.items) ? data.items : []).slice(0, 60)) await mangaHistoryPut(env, me, e).catch(() => {});
  return json({ items: await mangaHistoryList(env, me) });
});
on('DELETE', '/manga/history/:series', async (r, env, { me, p }) => {
  await env.DB.prepare('DELETE FROM manga_history WHERE user_id = ? AND series_id = ?').bind(me.id, mangaId(p.series, 'manga id')).run();
  return json({ ok: true });
});
on('GET', '/manga/library', async (r, env, { me }) => json({ items: await mangaLibraryList(env, me) }));
on('POST', '/manga/library/import', async (r, env, { me, data }) => {
  for (const e of (Array.isArray(data.items) ? data.items : []).slice(0, 500)) await mangaLibraryPut(env, me, e.list, e).catch(() => {});
  return json({ items: await mangaLibraryList(env, me) });
});
on('PUT', '/manga/library/:list', async (r, env, { me, p, data }) => {
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM manga_library WHERE user_id = ?').bind(me.id).first()).n;
  if (n >= 1000) fail(400, 'Your manga library is full (1000 entries)');
  await mangaLibraryPut(env, me, p.list, data);
  return json({ ok: true });
});
on('DELETE', '/manga/library/:list/:series', async (r, env, { me, p }) => {
  await env.DB.prepare('DELETE FROM manga_library WHERE user_id = ? AND list = ? AND series_id = ?').bind(me.id, mangaList(p.list), mangaId(p.series, 'manga id')).run();
  return json({ ok: true });
});

on('GET', '/playlists', async (r, env, { me }) => {
  const { results: lists } = await env.DB.prepare('SELECT id, name, created_at FROM playlists WHERE user_id = ? ORDER BY created_at').bind(me.id).all();
  const { results: items } = await env.DB.prepare('SELECT i.playlist_id, i.anime_id, i.anime, i.added_at FROM playlist_items i JOIN playlists p ON p.id = i.playlist_id WHERE p.user_id = ? ORDER BY i.added_at DESC').bind(me.id).all();
  const parsed = parse(items);
  return json({ items: lists.map((l) => ({ ...l, items: parsed.filter((i) => i.playlist_id === l.id) })) });
});
on('POST', '/playlists', async (r, env, { me, data }) => {
  const name = clean(String(data.name || '').trim().slice(0, 60));
  if (!name) fail(400, 'Playlist name is required');
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM playlists WHERE user_id = ?').bind(me.id).first()).n;
  if (n >= 50) fail(400, 'Playlist limit reached');
  const id = uid();
  await env.DB.prepare('INSERT INTO playlists (id, user_id, name, created_at) VALUES (?, ?, ?, ?)').bind(id, me.id, name, now()).run();
  return json({ id, name, items: [] }, 201);
});
const ownPlaylist = async (env, me, id) => (await env.DB.prepare('SELECT id FROM playlists WHERE id = ? AND user_id = ?').bind(id, me.id).first()) || fail(404, 'Playlist not found');
on('PATCH', '/playlists/:id', async (r, env, { me, p, data }) => {
  await ownPlaylist(env, me, p.id);
  const name = clean(String(data.name || '').trim().slice(0, 60));
  if (!name) fail(400, 'Playlist name is required');
  await env.DB.prepare('UPDATE playlists SET name = ? WHERE id = ?').bind(name, p.id).run();
  return json({ ok: true });
});
on('DELETE', '/playlists/:id', async (r, env, { me, p }) => {
  await ownPlaylist(env, me, p.id);
  await env.DB.batch([env.DB.prepare('DELETE FROM playlist_items WHERE playlist_id = ?').bind(p.id), env.DB.prepare('DELETE FROM playlists WHERE id = ?').bind(p.id)]);
  return json({ ok: true });
});
on('POST', '/playlists/:id/items', async (r, env, { me, p, data }) => {
  await ownPlaylist(env, me, p.id);
  await env.DB.prepare('INSERT OR REPLACE INTO playlist_items (playlist_id, anime_id, anime, added_at) VALUES (?, ?, ?, ?)').bind(p.id, int(data.anime?.id, 'anime id'), card(data.anime), now()).run();
  return json({ ok: true });
});
on('DELETE', '/playlists/:id/items/:anime', async (r, env, { me, p }) => {
  await ownPlaylist(env, me, p.id);
  await env.DB.prepare('DELETE FROM playlist_items WHERE playlist_id = ? AND anime_id = ?').bind(p.id, int(p.anime, 'anime')).run();
  return json({ ok: true });
});

on('GET', '/subscriptions', async (r, env, { me }) => {
  const { results } = await env.DB.prepare('SELECT anime_id, anime, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC').bind(me.id).all();
  return json({ items: parse(results) });
});
on('PUT', '/subscriptions/:anime', async (r, env, { me, p, data }) => {
  const a = JSON.parse(card(data.anime));
  if (a.id !== int(p.anime, 'anime')) fail(400, 'Anime mismatch');
  // Start from the latest aired episode so subscribing doesn't immediately notify about old ones.
  const aired = a.next_airing_episode ? a.next_airing_episode.episode - 1 : a.episodes || 0;
  await env.DB.prepare('INSERT OR IGNORE INTO subscriptions (user_id, anime_id, anime, last_notified_episode, created_at) VALUES (?, ?, ?, ?, ?)').bind(me.id, a.id, JSON.stringify(a), aired, now()).run();
  return json({ subscribed: true });
});
on('DELETE', '/subscriptions/:anime', async (r, env, { me, p }) => {
  await env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ? AND anime_id = ?').bind(me.id, int(p.anime, 'anime')).run();
  return json({ subscribed: false });
});

on('GET', '/notifications', async (r, env, { me }) => {
  const { results } = await env.DB.prepare('SELECT id, type, payload, read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 40').bind(me.id).all();
  const unread = (await env.DB.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0').bind(me.id).first()).n;
  return json({ unread, items: results.map((n) => ({ ...n, read: !!n.read, payload: JSON.parse(n.payload) })) });
});
on('POST', '/notifications/read', async (r, env, { me }) => {
  await env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0').bind(me.id).run();
  return json({ ok: true });
});

// Per-anime state for the current user in one call: subscribed? which playlists?
on('GET', '/anime/:anime/state', async (r, env, { user, p }) => {
  if (!user) return json({ subscribed: false, playlists: [] });
  const id = int(p.anime, 'anime');
  const sub = await env.DB.prepare('SELECT 1 FROM subscriptions WHERE user_id = ? AND anime_id = ?').bind(user.id, id).first();
  const { results } = await env.DB.prepare('SELECT i.playlist_id FROM playlist_items i JOIN playlists p ON p.id = i.playlist_id WHERE p.user_id = ? AND i.anime_id = ?').bind(user.id, id).all();
  return json({ subscribed: !!sub, playlists: results.map((x) => x.playlist_id) });
});

on('GET', '/episodes/:anime/:ep', async (r, env, { user, p }) => {
  const a = int(p.anime, 'anime'), e = int(p.ep, 'episode');
  const s = await env.DB.prepare('SELECT likes, dislikes FROM episode_stats WHERE anime_id = ? AND episode = ?').bind(a, e).first();
  const my = user ? (await env.DB.prepare("SELECT value FROM votes WHERE user_id = ? AND target_type = 'episode' AND target_id = ?").bind(user.id, `${a}:${e}`).first())?.value ?? 0 : 0;
  return json({ likes: s?.likes ?? 0, dislikes: s?.dislikes ?? 0, my_vote: my });
});
on('PUT', '/episodes/:anime/:ep/vote', async (r, env, { me, p, data }) => {
  const a = int(p.anime, 'anime'), e = int(p.ep, 'episode');
  const my = await vote(env, me, 'episode', `${a}:${e}`, data.value);
  const s = await env.DB.prepare('SELECT likes, dislikes FROM episode_stats WHERE anime_id = ? AND episode = ?').bind(a, e).first();
  return json({ likes: s?.likes ?? 0, dislikes: s?.dislikes ?? 0, my_vote: my });
});

on('GET', '/comments', async (r, env, { user, q }) => json(await commentsList(env, user, q)));
on('POST', '/comments', async (r, env, { me, data }) => json(await commentCreate(env, me, data), 201));
on('DELETE', '/comments/:id', async (r, env, { me, p }) => {
  const c = await env.DB.prepare('SELECT user_id FROM comments WHERE id = ?').bind(p.id).first();
  if (!c) fail(404, 'Comment not found');
  if (c.user_id !== me.id && !me.is_admin) fail(403, 'Not allowed');
  await env.DB.prepare('UPDATE comments SET deleted = 1 WHERE id = ?').bind(p.id).run();
  return json({ ok: true });
});
on('PUT', '/comments/:id/vote', async (r, env, { me, p, data }) => {
  if (!(await env.DB.prepare('SELECT 1 FROM comments WHERE id = ? AND deleted = 0').bind(p.id).first())) fail(404, 'Comment not found');
  const my = await vote(env, me, 'comment', p.id, data.value);
  const c = await env.DB.prepare('SELECT likes, dislikes FROM comments WHERE id = ?').bind(p.id).first();
  return json({ ...c, my_vote: my });
});
on('POST', '/comments/:id/report', async (r, env, { me, p, data }) => {
  await env.DB.prepare('INSERT OR IGNORE INTO reports (id, comment_id, user_id, reason, created_at) VALUES (?, ?, ?, ?, ?)').bind(uid(), p.id, me.id, String(data.reason || '').slice(0, 200), now()).run();
  // Auto-hide after 5 independent reports; admins can review the reports table.
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM reports WHERE comment_id = ?').bind(p.id).first()).n;
  if (n >= 5) await env.DB.prepare('UPDATE comments SET deleted = 1 WHERE id = ?').bind(p.id).run();
  return json({ ok: true });
});

// Live (timestamped) comments for an episode, oldest moment first.
on('GET', '/live', async (r, env, { q }) => {
  const anime = int(q.get('anime'), 'anime'), ep = int(q.get('ep'), 'episode');
  const { results } = await env.DB.prepare(`SELECT c.id, c.ts, c.body, c.spoiler, u.display_name, u.username FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.anime_id = ? AND c.episode = ? AND c.ts IS NOT NULL AND c.deleted = 0 AND u.banned = 0 ORDER BY c.ts LIMIT 3000`).bind(anime, ep).all();
  return json({ items: results.map((c) => ({ ...c, spoiler: !!c.spoiler })) });
});

on('POST', '/admin/ban', async (r, env, { me, data }) => {
  if (!me.is_admin) fail(403, 'Admins only');
  const u = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(String(data.username || '')).first();
  if (!u) fail(404, 'User not found');
  await env.DB.batch([env.DB.prepare('UPDATE users SET banned = 1 WHERE id = ?').bind(u.id), env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(u.id)]);
  return json({ ok: true });
});

// Watch-party rooms (Durable Objects, see room.js).
on('POST', '/rooms', async (r, env, { me, data }) => {
  await rateLimit(env, `rooms:${me.id}`, 10, 3600);
  const id = env.ROOMS.newUniqueId();
  const stub = env.ROOMS.get(id);
  await stub.fetch('https://room/init', {
    method: 'POST',
    body: JSON.stringify({ host: publicUser(me), anime: JSON.parse(card(data.anime)), episode: int(data.episode, 'episode'), lang: data.lang === 'dub' ? 'dub' : 'sub', position: Math.max(0, Number(data.position) || 0) }),
  });
  return json({ id: id.toString() }, 201);
});
on('GET', '/rooms/:id', async (r, env, { user, p }) => {
  let id;
  try {
    id = env.ROOMS.idFromString(p.id);
  } catch {
    fail(404, 'Room not found');
  }
  const stub = env.ROOMS.get(id);
  const url = new URL(r.url);
  if (r.headers.get('Upgrade') === 'websocket') {
    // Signed-out visitors join as guests with a chosen (or generated) name.
    const guestName = clean(String(url.searchParams.get('name') || '').trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 24)) || `Guest-${Math.floor(Math.random() * 9000 + 1000)}`;
    const gid = String(url.searchParams.get('gid') || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36) || uid();
    const who = user ? publicUser(user) : { id: `guest-${gid}`, username: null, display_name: `${guestName} (guest)`, avatar: null, is_admin: false, guest: true };
    if (!user) await rateLimit(env, `guest-join:${clientIp(r, env)}`, 30, 600);
    const h = new Headers(r.headers);
    h.set('X-User', JSON.stringify(who));
    return stub.fetch(new Request('https://room/ws', { headers: h }));
  }
  return stub.fetch(`https://room/info${url.search}`);
});

// Live visitor counts (presence.js). WebSocket upgrades aren't covered by checkOrigin, so check here.
on('GET', '/presence', async (r, env, { q }) => {
  if (r.headers.get('Upgrade') !== 'websocket') fail(426, 'WebSocket required');
  if (!ORIGINS.has(r.headers.get('Origin'))) fail(403, 'Cross-site request blocked');
  const cid = String(q.get('cid') || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 36) || uid();
  const stub = env.PRESENCE.get(env.PRESENCE.idFromName('site'));
  return stub.fetch(new Request(`https://presence/ws?cid=${cid}`, { headers: r.headers }));
});

const PUBLIC = new Set(['GET /presence', 'GET /me/email/verify', 'POST /auth/forgot', 'POST /auth/magic', 'GET /auth/magic/verify', 'POST /auth/reset', 'GET /push/key', 'GET /me', 'GET /auth/providers', 'POST /auth/register', 'POST /auth/login', 'POST /auth/logout', 'GET /auth/:provider', 'GET /auth/:provider/callback', 'GET /anime/:anime/state', 'GET /episodes/:anime/:ep', 'GET /comments', 'GET /live', 'GET /rooms/:id']);

export async function handleSocial(request, env, path) {
  try {
    checkOrigin(request);
    for (const [method, re, handler, key] of routes) {
      if (method !== request.method) continue;
      const m = path.match(re);
      if (!m) continue;
      const user = await currentUser(request, env);
      const me = PUBLIC.has(key) ? user : user ?? (await requireUser(request, env));
      const data = ['POST', 'PUT', 'PATCH'].includes(method) ? await body(request) : {};
      return await handler(request, env, { user, me, data, p: m.groups ?? {}, q: new URL(request.url).searchParams });
    }
    return json({ error: 'Not found' }, 404);
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    console.error(JSON.stringify({ event: 'social_error', path, message: err.message }));
    return json({ error: 'Something went wrong' }, 500);
  }
}
