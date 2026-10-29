import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../worker/app.js';
import * as manga from '../worker/manga.js';

const ctx = { waitUntil(p) { p.catch(() => {}); } };
const ID = '01J76XY7E9FNDZ1DBBM6PBJPFK';

const CARD = `<article class="bg-base-300 flex gap-4 p-4"><a href="https://weebcentral.com/series/${ID}/One-Piece"></a>
<span class="tooltip tooltip-bottom" data-tip="Official Translation"></span>
<a href="https://weebcentral.com/series/${ID}/One-Piece" class="line-clamp-1 link link-hover">One Piece &amp; Friends</a>
<div class="opacity-70"><strong>Year:</strong> <span>1997</span></div>
<div class="opacity-70"><strong>Status:</strong> <span>Ongoing</span></div>
<div><strong class="opacity-70">Author(s): </strong><span><a href="https://weebcentral.com/search?author=ODA" class="link">ODA Eiichiro</a></span></div>
<div class="opacity-70"><strong>Tag(s): </strong><span>Action,</span> <span>Shounen</span></div></article>`;

function withHtml(map, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const hit = Object.entries(map).find(([k]) => String(url).includes(k));
    return new Response(hit ? hit[1] : 'not found', { status: hit ? 200 : 404 });
  };
  return fn().finally(() => { globalThis.fetch = original; });
}

test('parses search result cards', () => withHtml({ '/search/data': CARD }, async () => {
  const { results, has_next } = await manga.search({ q: 'one piece' });
  assert.equal(has_next, false);
  assert.deepEqual(results[0], {
    id: ID, slug: 'One-Piece', title: 'One Piece & Friends',
    cover: `https://temp.compsci88.com/cover/small/${ID}.webp`, cover_large: `https://temp.compsci88.com/cover/normal/${ID}.webp`,
    year: 1997, status: 'Ongoing', type: null, authors: ['ODA Eiichiro'], tags: ['Action', 'Shounen'], official: true,
  });
}));

test('parses chapter lists newest first and page images in order', () => withHtml({
  [`/series/${ID}/full-chapter-list`]: `<a href="/chapters/01M52CHK8P0DVE505KQ6MA0H68" class="x"><span class="">Chapter 10.5</span><time datetime="2026-10-16T12:00:00Z"></time></a>
    <a href="/chapters/01J76XYYR7VK2XCSHBZT8BZ4C2" class="x"><span class="">Chapter 1</span></a>`,
  [`/series/${ID}`]: '<h1 class="hidden md:block text-2xl font-bold">One Piece</h1><p class="whitespace-pre-wrap break-words">A &quot;pirate&quot; story.</p>',
  '/images': '<img\n src="https://cdn.test/1.png"\n alt="Page 1"><img src="https://cdn.test/logo.png" alt="logo"><img src="https://cdn.test/2.png" alt="Page 2">',
}, async () => {
  const s = await manga.series(ID);
  assert.equal(s.description, 'A "pirate" story.');
  assert.deepEqual(s.chapters.map((c) => [c.name, c.number, c.date]), [['Chapter 10.5', 10.5, '2026-10-16T12:00:00Z'], ['Chapter 1', 1, null]]);
  assert.deepEqual((await manga.chapter('01M52CHK8P0DVE505KQ6MA0H68')).pages, ['https://cdn.test/1.png', 'https://cdn.test/2.png']);
}));

test('manga routes reject malformed ids without calling the source', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('should not fetch'); };
  try {
    for (const path of ['/manga/series/abc', '/manga/chapter/..%2Fadmin']) {
      const res = await handle(new Request(`https://example.test/api${path}`), path, ctx);
      assert.equal(res.status, 400);
    }
  } finally { globalThis.fetch = original; }
});
