// Accounts: username/password (PBKDF2), plus Google and Discord sign-in when their OAuth
// credentials are configured as Worker secrets (GOOGLE_CLIENT_ID/SECRET, DISCORD_CLIENT_ID/SECRET).
// Sessions are random tokens in an HttpOnly cookie; only their SHA-256 is stored.
import { b64, cookie, cookies, fail, json, now, publicOrigin, publicUser, sha256, token, uid, unb64 } from './util.js';
import { clientIp, emailEnabled, emails, issueToken, linkTo, rateLimit, sendEmail, useToken } from './extras.js';

const SESSION_COOKIE = 'ag_session';
const SESSION_DAYS = 30;
const ITERATIONS = 100_000; // Workers' PBKDF2 maximum

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS }, key, 256);
  return b64(bits);
}

function sameHash(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function currentUser(request, env) {
  const t = cookies(request)[SESSION_COOKIE];
  if (!t) return null;
  const row = await env.DB.prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?',
  ).bind(await sha256(t), now()).first();
  return row && !row.banned ? row : null;
}

export async function requireUser(request, env) {
  const u = await currentUser(request, env);
  if (!u) fail(401, 'Please log in');
  return u;
}

async function startSession(env, userId) {
  const t = token();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(t), userId, now() + SESSION_DAYS * 86400_000, now()).run();
  return cookie(SESSION_COOKIE, t, SESSION_DAYS * 86400);
}

const USERNAME = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(request, env, data) {
  await rateLimit(env, `register:${clientIp(request, env)}`, 5, 3600);
  const username = String(data.username || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const password = String(data.password || '');
  if (!USERNAME.test(username)) fail(400, 'Username must be 3–20 letters, numbers or underscores');
  if (!EMAIL.test(email) || email.length > 200) fail(400, 'Enter a valid email address');
  if (password.length < 8 || password.length > 200) fail(400, 'Password must be at least 8 characters');
  if (await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first()) fail(409, 'That username is taken');
  if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()) fail(409, 'That email already has an account');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const id = uid();
  await env.DB.prepare('INSERT INTO users (id, username, display_name, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, username, username, email, await hashPassword(password, salt), b64(salt), now()).run();
  // Confirm the address when email sending is on; until then it's stored unconfirmed.
  if (emailEnabled(env)) {
    const t = await issueToken(env, id, 'verify', email);
    const [subject, text, html] = emails.verify(linkTo(env, `/api/u/me/email/verify?t=${t}`));
    await sendEmail(env, email, subject, text, html);
  }
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  return json({ user: publicUser(user) }, 201, { 'Set-Cookie': await startSession(env, id) });
}

export async function login(request, env, data) {
  const name = String(data.username || '').trim().toLowerCase();
  await rateLimit(env, `login-ip:${clientIp(request, env)}`, 10, 900);
  await rateLimit(env, `login-user:${name}`, 20, 900);
  const user = await env.DB.prepare(`SELECT * FROM users WHERE ${name.includes('@') ? 'email' : 'username'} = ?`).bind(name).first();
  const ok = user?.password_hash && sameHash(await hashPassword(String(data.password || ''), unb64(user.password_salt)), user.password_hash);
  if (!ok) fail(401, 'Wrong username or password');
  if (user.banned) fail(403, 'This account is banned');
  return json({ user: publicUser(user) }, 200, { 'Set-Cookie': await startSession(env, user.id) });
}

export async function logout(request, env) {
  const t = cookies(request)[SESSION_COOKIE];
  if (t) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(t)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookie(SESSION_COOKIE, '', 0) });
}

// ------------------------------------------------------------------ OAuth (Google, Discord)

const PROVIDERS = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid profile email',
    profile: async (access) => {
      const p = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${access}` } })).json();
      return { id: p.sub, name: p.name || p.email?.split('@')[0], avatar: p.picture };
    },
  },
  discord: {
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    scope: 'identify',
    profile: async (access) => {
      const p = await (await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access}` } })).json();
      return { id: p.id, name: p.global_name || p.username, avatar: p.avatar ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png?size=128` : null };
    },
  },
};
const creds = (env, p) => ({ id: env[`${p.toUpperCase()}_CLIENT_ID`], secret: env[`${p.toUpperCase()}_CLIENT_SECRET`] });

export const providers = (env) => json({ google: !!creds(env, 'google').id, discord: !!creds(env, 'discord').id, email: emailEnabled(env) });

// ------------------------------------------------------------------ password & email flows

export async function changePassword(env, me, data) {
  if (me.password_hash) {
    const ok = sameHash(await hashPassword(String(data.current || ''), unb64(me.password_salt)), me.password_hash);
    if (!ok) fail(401, 'Current password is wrong');
  }
  await setPassword(env, me.id, String(data.password || ''));
  // Other devices are signed out; keep this one signed in with a fresh session.
  return json({ ok: true }, 200, { 'Set-Cookie': await startSession(env, me.id) });
}

async function setPassword(env, userId, password) {
  if (password.length < 8 || password.length > 200) fail(400, 'Password must be at least 8 characters');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(await hashPassword(password, salt), b64(salt), userId),
    env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId), // sign out other devices
  ]);
}

// Sends a reset or sign-in link if an account has this verified email. Always answers the same,
// so the form can't be used to discover which emails have accounts.
export async function emailLink(request, env, data, kind) {
  if (!emailEnabled(env)) fail(503, 'Email is not available yet');
  const email = String(data.email || '').trim().toLowerCase();
  await rateLimit(env, `${kind}-ip:${clientIp(request, env)}`, 5, 3600);
  await rateLimit(env, `${kind}-email:${email}`, 3, 3600);
  const user = await env.DB.prepare('SELECT id, banned FROM users WHERE email = ?').bind(email).first();
  if (user && !user.banned) {
    const t = await issueToken(env, user.id, kind);
    const [subject, text, html] = kind === 'reset' ? emails.reset(linkTo(env, `/reset?t=${t}`)) : emails.magic(linkTo(env, `/api/u/auth/magic/verify?t=${t}`));
    await sendEmail(env, email, subject, text, html);
  }
  return json({ ok: true });
}

export async function resetPassword(request, env, data) {
  await rateLimit(env, `reset-submit:${clientIp(request, env)}`, 10, 3600);
  const { user_id } = await useToken(env, data.token, 'reset');
  await setPassword(env, user_id, String(data.password || ''));
  const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user_id).first();
  return json({ user: publicUser(user) }, 200, { 'Set-Cookie': await startSession(env, user_id) });
}

export async function magicVerify(request, env) {
  const { user_id } = await useToken(env, new URL(request.url).searchParams.get('t'), 'magic');
  return new Response(null, { status: 302, headers: { Location: `${publicOrigin(env)}/`, 'Set-Cookie': await startSession(env, user_id) } });
}

export async function requestEmailVerify(request, env, me, data) {
  if (!emailEnabled(env)) fail(503, 'Email is not available yet');
  const email = String(data.email || '').trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 200) fail(400, 'Enter a valid email address');
  await rateLimit(env, `verify:${me.id}`, 5, 3600);
  if (await env.DB.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').bind(email, me.id).first()) fail(409, 'That email is used by another account');
  const t = await issueToken(env, me.id, 'verify', email);
  const [subject, text, html] = emails.verify(linkTo(env, `/api/u/me/email/verify?t=${t}`));
  if (!(await sendEmail(env, email, subject, text, html))) fail(502, "Couldn't send the email, try again later");
  return json({ ok: true });
}

export async function confirmEmail(request, env) {
  const { user_id, email } = await useToken(env, new URL(request.url).searchParams.get('t'), 'verify');
  await env.DB.prepare('UPDATE users SET email = ?, email_verified = 1 WHERE id = ?').bind(email, user_id).run();
  return new Response(null, { status: 302, headers: { Location: `${publicOrigin(env)}/settings?email=verified` } });
}

export async function oauthStart(request, env, provider) {
  const p = PROVIDERS[provider];
  const c = creds(env, provider);
  if (!p || !c.id) fail(404, 'Sign-in method not available');
  const state = token(16);
  const back = new URL(request.url).searchParams.get('next') || '/';
  const url = new URL(p.authorize);
  url.search = new URLSearchParams({ client_id: c.id, redirect_uri: `${publicOrigin(env)}/api/u/auth/${provider}/callback`, response_type: 'code', scope: p.scope, state, prompt: 'select_account' });
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), 'Set-Cookie': cookie('ag_oauth', `${state}|${back.startsWith('/') ? back : '/'}`, 600) },
  });
}

export async function oauthCallback(request, env, provider) {
  const p = PROVIDERS[provider];
  const c = creds(env, provider);
  if (!p || !c.id) fail(404, 'Sign-in method not available');
  const q = new URL(request.url).searchParams;
  const [state, back] = (cookies(request).ag_oauth || '').split('|');
  if (!state || state !== q.get('state') || !q.get('code')) fail(400, 'Sign-in expired, please try again');
  const tok = await (await fetch(p.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, code: q.get('code'), grant_type: 'authorization_code', redirect_uri: `${publicOrigin(env)}/api/u/auth/${provider}/callback` }),
  })).json();
  if (!tok.access_token) fail(400, 'Sign-in failed');
  const prof = await p.profile(tok.access_token);
  const col = `${provider}_id`;
  let user = await env.DB.prepare(`SELECT * FROM users WHERE ${col} = ?`).bind(prof.id).first();
  if (!user) {
    let base = String(prof.name || 'user').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 14) || 'user';
    if (base.length < 3) base += 'fan';
    let username = base;
    for (let n = 0; await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first(); n++) username = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
    const id = uid();
    await env.DB.prepare(`INSERT INTO users (id, username, display_name, avatar, ${col}, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, username, String(prof.name || username).slice(0, 40), prof.avatar, prof.id, now()).run();
    user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  }
  if (user.banned) fail(403, 'This account is banned');
  const headers = new Headers({ Location: `${publicOrigin(env)}${back || '/'}` });
  headers.append('Set-Cookie', await startSession(env, user.id));
  headers.append('Set-Cookie', cookie('ag_oauth', '', 0));
  return new Response(null, { status: 302, headers });
}
