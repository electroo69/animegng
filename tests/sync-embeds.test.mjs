import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {sync} from '../scripts/sync-embeds.mjs';
const fixture=async t=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'anime-sync-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return root;};
const json=x=>Response.json(x);
test('catalog discovery resumes and includes every page without duplicate jobs',async t=>{
 const root=await fixture(t),offsets=[];
 const fetchImpl=async url=>{const o=Number(new URL(url).searchParams.get('offset'));offsets.push(o);return json({total:3,results:o===0?[{anime_id:'a'},{anime_id:'b'}]:[{anime_id:'c'}]});};
 const first=await sync({root,fetchImpl,catalogOnly:true,maxRequests:1,intervalMs:0});
 assert.equal(first.stopped,'BUDGET');assert.equal(first.queuedTitles,2);
 const second=await sync({root,fetchImpl,catalogOnly:true,maxRequests:2,intervalMs:0});
 assert.deepEqual(offsets,[0,2]);assert.equal(second.catalogComplete,true);assert.equal(second.queuedTitles,3);
});
test('backfill rotates titles and checkpoints the blocked episode without losing it',async t=>{
 const root=await fixture(t);
 await fs.writeFile(path.join(root,'.embed-catalog.json'),JSON.stringify({complete:true,total:2,titles:{a:{},b:{}}}));
 await fs.writeFile(path.join(root,'.embed-sync-state.json'),JSON.stringify({queue:[{slug:'a',id:1,next:1,total:20},{slug:'b',id:2,next:1,total:20}],attempts:{}}));
 const calls=[];
 const fetchImpl=async url=>{const p=new URL(url).pathname;calls.push(p);if(p.endsWith('/home'))return json({latest_aired:[],new_on_site:[]});if(p==='/api/flix/2/1')return new Response('',{status:429});return json({success:true,servers:[{$id:'s',dataType:'sub',serverName:'HD-2',dataLink:'https://flixcloud.cc/e/real'}]});};
 const r=await sync({root,fetchImpl,maxRequests:10,intervalMs:0});
 assert.equal(r.stopped,'STOP_HTTP_429');assert.equal(r.changed,1);
 assert.deepEqual(calls,['/api/v1/home','/api/flix/1/1','/api/flix/2/1']);
 const state=JSON.parse(await fs.readFile(path.join(root,'.embed-sync-state.json')));
 assert.equal(state.queue[0].slug,'b');assert.equal(state.queue[0].next,1);assert.equal(state.queue[1].next,2);
 await assert.rejects(fs.access(path.join(root,'.embed-sync.lock')));
});
test('concurrent sync is rejected without removing the active lock',async t=>{
 const root=await fixture(t),file=path.join(root,'.embed-sync.lock');await fs.writeFile(file,'active');
 await assert.rejects(sync({root,fetchImpl:()=>{throw new Error('must not fetch');}}),{code:'EEXIST'});
 assert.equal(await fs.readFile(file,'utf8'),'active');
});
