// Shared helpers for the account/community API (worker/social).

export const now = () => Date.now();
export const uid = () => crypto.randomUUID();

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};

export const json = (data, status = 200, headers = {}) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });

export async function body(request, max = 20_000) {
  const text = await request.text();
  if (text.length > max) fail(413, 'Request too large');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return fail(400, 'Invalid JSON');
  }
}

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const token = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
export const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
export const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function cookies(request) {
  const out = {};
  for (const part of (request.headers.get('Cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export const cookie = (name, value, maxAge) =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

// Mutations must come from our own pages (cookies are SameSite=Lax as well).
const ORIGINS = new Set(['https://animegng.com', 'https://www.animegng.com', 'https://animegng.pages.dev', 'https://animegng.drop-share-free.workers.dev', 'http://localhost:5173', 'http://localhost:5174']);
export function checkOrigin(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  const origin = request.headers.get('Origin');
  if (!origin || !ORIGINS.has(origin)) fail(403, 'Cross-site request blocked');
}

// The public site address, used for OAuth redirect URIs (requests arrive through the Pages proxy).
export const publicOrigin = (env) => env.PUBLIC_ORIGIN || 'https://animegng.com';

// Light profanity masking for public text. Not exhaustive; reports + admin deletion cover the rest.
const BAD = /\b(fuck(?:ing|er|ed)?|shit|cunt|nigg(?:a|er)s?|faggots?|retards?|bitch(?:es)?|whores?|rape)\b/gi;
export const clean = (s) => s.replace(BAD, (w) => w[0] + '*'.repeat(w.length - 1));

export const privateUser = (u) => (u ? { ...publicUser(u), email: u.email ?? null, email_verified: !!u.email_verified, email_notify: !!u.email_notify, has_password: !!u.password_hash } : null);
export const publicUser = (u) => (u ? { id: u.id, username: u.username, display_name: u.display_name, avatar: u.avatar, is_admin: !!u.is_admin } : null);
