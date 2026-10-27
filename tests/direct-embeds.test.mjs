import test from 'node:test';
import assert from 'node:assert/strict';
import { proxyApi } from '../worker/proxy.js';
import { directServers } from '../worker/direct-embeds.js';
const ctx={waitUntil(p){p.catch(()=>{});}};
test('verified episode uses metadata only, with no video-provider lookup',async()=>{
  const original=globalThis.fetch, calls=[];
  globalThis.fetch=async url=>{
    if(url.pathname.startsWith('/embeds/'))return new Response('',{status:404});
    calls.push(url.pathname);
    if(url.pathname==='/api/anime/21') return Response.json({id:21,title:{english:'One Piece'}});
    if(url.pathname==='/api/anime/21/episodes') return Response.json({total:2,data:[{episode_number:1,title:'First'}]});
    throw new Error('Unexpected upstream call');
  };
  try{
    const response=await proxyApi(new Request('https://site.test/api/watch/21/1'),{},ctx);
    const data=await response.json();
    assert.equal(response.status,200);assert.equal(data.available,true);
    assert.equal(data.episode.title,'First');assert.equal(data.next_episode,2);
    assert.equal(data.server_error,undefined);
    assert.deepEqual(calls.sort(),['/api/anime/21','/api/anime/21/episodes']);
  }finally{globalThis.fetch=original;}
});
test('unknown episodes never reuse a different episode link',()=>{
  assert.equal(directServers(21,2),null);assert.equal(directServers(20,1),null);
});
test('mapped server list requires no backend request',async()=>{
  const original=globalThis.fetch;globalThis.fetch=()=>{throw new Error('No backend expected');};
  try{const r=await proxyApi(new Request('https://site.test/api/servers/21/1'),{},ctx);assert.equal((await r.json()).dub.length,2);}finally{globalThis.fetch=original;}
});
test('new static mappings work without adding Worker code',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{
    if(url.pathname==='/embeds/209502.json')return Response.json({'4':{servers:{sub:[{id:'test',name:'HD-2',embed_url:'https://flixcloud.cc/e/test?v=2',softsub:false}],dub:[]}}});
    throw new Error('No provider request expected');
  };
  try{const r=await proxyApi(new Request('https://site.test/api/servers/209502/4'),{},ctx);assert.equal(r.status,200);assert.equal((await r.json()).sub[0].id,'test');}finally{globalThis.fetch=original;}
});
