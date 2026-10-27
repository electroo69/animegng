import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyApi } from '../worker/proxy.js';
const ctx = { waitUntil(p) { p.catch(() => {}); } };
test('proxy preserves nested paths and search while stripping client credentials', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url.href, 'https://animegng-api.vercel.app/api/watch/21/1?lang=dub');
    assert.equal(init.headers.Cookie, undefined);
    return Response.json({ available: true });
  };
  try {
    const response = await proxyApi(new Request('https://animegng.pages.dev/api/watch/21/1?lang=dub', {headers:{Cookie:'private'}}), {}, ctx);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).available, true);
  } finally { globalThis.fetch = original; }
});
test('proxy rejects unsupported methods and non-JSON backend responses', async () => {
  assert.equal((await proxyApi(new Request('https://site.test/api/home',{method:'POST'}),{},ctx)).status,405);
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>Login</html>',{headers:{'Content-Type':'text/html'}});
  try {
    const response = await proxyApi(new Request('https://site.test/api/home'),{},ctx);
    assert.equal(response.status,502);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  } finally { globalThis.fetch=original; }
});
