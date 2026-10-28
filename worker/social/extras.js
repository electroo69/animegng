// Rate limits, client IP, transactional email, one-time tokens and Web Push.
import { fail, now, publicOrigin, sha256, token } from './util.js';

// The Pages proxy forwards the visitor's IP with a shared secret; direct hits use Cloudflare's header.
export function clientIp(request, env) {
  const fwd = request.headers.get('X-AG-Client-IP');
  if (fwd && env.PROXY_SECRET && request.headers.get('X-AG-Proxy') === env.PROXY_SECRET) return fwd;
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/** Fixed-window limit: at most `max` hits per `windowSec` for `key`, else 429. */
export async function rateLimit(env, key, max, windowSec) {
  const t = now();
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, count, reset_at) VALUES (?1, 1, ?2)
     ON CONFLICT (key) DO UPDATE SET count = CASE WHEN reset_at < ?3 THEN 1 ELSE count + 1 END,
       reset_at = CASE WHEN reset_at < ?3 THEN ?2 ELSE reset_at END
     RETURNING count, reset_at`,
  ).bind(key, t + windowSec * 1000, t).first();
  if (row.count > max) fail(429, `Too many attempts. Try again in ${Math.ceil((row.reset_at - t) / 60000)} min.`);
}

// ------------------------------------------------------------------ email (Resend)

// Email is on when the RESEND_API_KEY secret is set (animegng.com verified in Resend).
export const emailEnabled = (env) => !!env.RESEND_API_KEY;
const FROM = (env) => env.EMAIL_FROM || 'AnimeGang <noreply@animegng.com>';

export async function sendEmail(env, to, subject, text, html) {
  if (!emailEnabled(env)) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM(env), to: [to], subject, text, html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return true;
  } catch (err) {
    console.error(JSON.stringify({ event: 'email_error', message: err.message }));
    return false;
  }
}

const shell = (title, body, link, cta) => `<!doctype html><html><body style="margin:0;background:#0b0b10;font-family:system-ui,sans-serif;color:#e8e8ee">
<div style="max-width:480px;margin:0 auto;padding:32px 24px"><p style="font-size:20px;font-weight:800;margin:0 0 16px;color:#ff1f2d">AnimeGang</p>
<h1 style="font-size:18px;margin:0 0 12px;color:#fff">${title}</h1><p style="line-height:1.6;color:#b8b8c4">${body}</p>
${link ? `<p style="margin:24px 0"><a href="${link}" style="background:#ff1f2d;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${cta}</a></p>` : ''}
<p style="font-size:12px;color:#6b6b78;margin-top:32px">If you didn't request this, you can ignore this email.</p></div></body></html>`;

export const emails = {
  reset: (link) => ['Reset your AnimeGang password', `Reset your password: ${link}\nThe link expires in 1 hour.`, shell('Reset your password', 'Click below to choose a new password. The link expires in 1 hour.', link, 'Reset password')],
  magic: (link) => ['Your AnimeGang sign-in link', `Sign in: ${link}\nThe link expires in 15 minutes.`, shell('Sign in to AnimeGang', 'Click below to sign in. The link expires in 15 minutes and works once.', link, 'Sign in')],
  verify: (link) => ['Confirm your email for AnimeGang', `Confirm your email: ${link}`, shell('Confirm your email', 'Confirm this address to use it for sign-in links, password resets and episode alerts.', link, 'Confirm email')],
  episode: (title, ep, link) => [`${title} episode ${ep} is out`, `${title} episode ${ep} just aired. Watch: ${link}`, shell(`${title} — episode ${ep} is out`, 'A new episode of a show you follow just aired.', link, 'Watch now')],
};

// ------------------------------------------------------------------ one-time tokens

const TTL = { reset: 3600_000, magic: 900_000, verify: 86400_000 };

export async function issueToken(env, userId, kind, email = null) {
  const t = token();
  await env.DB.prepare('DELETE FROM auth_tokens WHERE user_id = ? AND kind = ?').bind(userId, kind).run();
  await env.DB.prepare('INSERT INTO auth_tokens (id, user_id, kind, email, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(t), userId, kind, email, now() + TTL[kind]).run();
  return t;
}

/** Consumes a token (single use). Returns { user_id, email } or fails. */
export async function useToken(env, t, kind) {
  const row = await env.DB.prepare('DELETE FROM auth_tokens WHERE id = ? AND kind = ? RETURNING user_id, email, expires_at').bind(await sha256(String(t || '')), kind).first();
  if (!row || row.expires_at < now()) fail(400, 'This link is invalid or has expired');
  return row;
}

export const linkTo = (env, path) => `${publicOrigin(env)}${path}`;

// ------------------------------------------------------------------ Web Push (no payload)
// The push only wakes the service worker (public/sw.js), which fetches the newest notification
// itself, so no payload encryption is needed: just a VAPID-signed empty POST.

export const VAPID_PUBLIC = 'BFRKKptAQ0zNLG33BeArhxy-PCCC9VvDQGesgdIi2aUcz3AqV8DBmavwMTDYCRt0rbydFEzO3CBGENFOTp0OcwI';
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let signingKey;
async function vapidJwt(env, audience) {
  signingKey ??= await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud: audience, exp: Math.floor(now() / 1000) + 12 * 3600, sub: 'https://animegng.com' })}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

export async function pushTo(env, userIds) {
  if (!env.VAPID_PRIVATE_JWK || !userIds.length) return;
  const { results } = await env.DB.prepare(`SELECT endpoint FROM push_subscriptions WHERE user_id IN (${userIds.map(() => '?').join(',')})`).bind(...userIds).all();
  await Promise.all(results.map(async ({ endpoint }) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { TTL: '86400', Urgency: 'normal', Authorization: `vapid t=${await vapidJwt(env, new URL(endpoint).origin)}, k=${VAPID_PUBLIC}`, 'Content-Length': '0' },
      });
      if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
    } catch {
      /* transient push service error; next episode will retry */
    }
  }));
}
