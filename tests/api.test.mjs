import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../worker/app.js';

const ctx = { waitUntil(p) { p.catch(() => {}); } };
test('runs on Node without a Cloudflare Cache API', async () => {
  const response = await handle(new Request('https://example.test/api'), '/', ctx);
  assert.equal(response.status, 200);
  assert.ok((await response.json()).routes.some(r => r.path === '/home'));
  assert.match(response.headers.get('Cache-Control'), /s-maxage=600/);
});
test('preflight and invalid requests need no upstream calls', async () => {
  assert.equal((await handle(new Request('https://example.test/api/home', {method:'OPTIONS'}), '/home', ctx)).status, 204);
  assert.equal((await handle(new Request('https://example.test/api/anime/bad'), '/anime/bad', ctx)).status, 400);
  assert.equal((await handle(new Request('https://example.test/api/nope'), '/nope', ctx)).status, 404);
});
test('upstream failures remain JSON and are never cached', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({errors:[{message:'Upstream unavailable'}]}), {status:503});
  try {
    const response = await handle(new Request('https://example.test/api/home'), '/home', ctx);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal((await response.json()).error, 'Upstream unavailable');
  } finally { globalThis.fetch = original; }
});
test('video-provider failure preserves episode data without caching the outage', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('graphql.anilist.co')) return Response.json({data:{Media:{id:999999,idMal:999999,title:{english:'Test anime'},episodes:2,studios:{edges:[]},relations:{edges:[]},characters:{edges:[]},staff:{edges:[]},recommendations:{nodes:[]}}}});
    if (String(url).includes('api.ani.zip')) return Response.json({episodes:{1:{title:{en:'First episode'}}}});
    if (String(url).includes('api.jikan.moe')) return Response.json({data:[],pagination:{has_next_page:false}});
    return new Response('{}',{status:403});
  };
  try {
    const response = await handle(new Request('https://example.test/api/watch/999999/1'),'/watch/999999/1',ctx);
    const data = await response.json();
    assert.equal(response.status,200);
    assert.equal(data.episode.title,'First episode');
    assert.equal(data.available,false);
    assert.match(data.server_error,/video provider/);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  } finally {globalThis.fetch=original;}
});
