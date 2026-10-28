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

// Email layout in the site's style (dark card, logo, red→blue accent, red gradient button).
// Tables + inline styles because email clients ignore most modern CSS.
const shell = (title, body, link, cta) => `<!doctype html><html><head><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#07070a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07070a;padding:32px 12px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
    <tr><td align="center" style="padding:0 0 24px"><a href="https://animegng.com"><img src="https://animegng.com/logo.png" width="200" alt="AnimeGang" style="display:block;width:200px;height:auto;border:0"></a></td></tr>
    <tr><td style="background:#121219;border:1px solid #23232e;border-radius:18px;overflow:hidden">
      <div style="height:4px;background:#ff1f2d;background-image:linear-gradient(90deg,#ff1f2d,#2b4bff)"></div>
      <div style="padding:32px 32px 28px">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#ff1f2d;font-weight:600">AnimeGang</p>
        <h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;color:#ffffff;font-weight:800">${title}</h1>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#b4b4c2">${body}</p>
        ${link ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px"><tr><td style="border-radius:12px;background:#ff1f2d;background-image:linear-gradient(135deg,#ff1f2d,#c4000c)">
          <a href="${link}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${cta}</a></td></tr></table>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6e6e7c">Button not working? Paste this link into your browser:<br><a href="${link}" style="color:#8ea2ff;word-break:break-all">${link}</a></p>` : ''}
      </div>
    </td></tr>
    <tr><td align="center" style="padding:22px 12px 0;font-size:12px;line-height:1.7;color:#5c5c6a">
      If you didn't request this, you can ignore this email.<br>
      <a href="https://animegng.com" style="color:#8a8a98;text-decoration:none">animegng.com</a> &nbsp;·&nbsp; <a href="https://animegng.com/settings" style="color:#8a8a98;text-decoration:none">Email settings</a> &nbsp;·&nbsp; <a href="mailto:support@animegng.com" style="color:#8a8a98;text-decoration:none">Support</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;

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
