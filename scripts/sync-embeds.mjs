import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function sync({root, fetchImpl=fetch, maxRequests=100, catalogOnly=false, intervalMs=1200}) {
  const read=async(file,fallback)=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
  const save=async(file,data)=>{const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(data,null,2)+'\n');await fs.rename(tmp,file);};
  const lockPath=path.join(root,'.embed-sync.lock');
  const lock=await fs.open(lockPath,'wx');
  await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
  let requests=0,changed=0,stopped=null,last=0;
  let state,catalog;
  const statePath=path.join(root,'.embed-sync-state.json');
  const catalogPath=path.join(root,'.embed-catalog.json');
  try {
    state=await read(statePath,{offset:0,queue:[],attempts:{}});
    state.completed??={};state.skipped??={};
    catalog=await read(catalogPath,{offset:0,total:null,complete:false,titles:{}});
    const queued=new Set(state.queue.map(j=>j.slug));
    const enqueue=a=>{if(a.anime_id&&!queued.has(a.anime_id)&&!state.completed[a.anime_id]&&!state.skipped[a.anime_id]){state.queue.push({slug:a.anime_id,next:1});queued.add(a.anime_id);}};
    let checkpointCount=0;
    async function checkpoint(catalogChanged=false){
      if(catalogChanged||++checkpointCount%20===0)await save(statePath,state);
      if(catalogChanged)await save(catalogPath,catalog);
    }
    async function get(route){
      if(requests>=maxRequests)throw new Error('BUDGET');
      await new Promise(r=>setTimeout(r,Math.max(0,intervalMs-(Date.now()-last))));last=Date.now();requests++;
      const res=await fetchImpl('https://reanime.to'+route,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
      if(!res.ok)throw new Error(`STOP_HTTP_${res.status}`);
      if(!res.headers.get('content-type')?.includes('application/json'))throw new Error('STOP_NON_JSON');
      return res.json();
    }
    async function discover(){
      const page=await get(`/api/v1/search?playable=true&limit=100&offset=${catalog.offset}`);
      if(!Array.isArray(page.results)||!Number.isSafeInteger(page.total)||page.total<0)throw new Error('STOP_SCHEMA');
      if(!page.results.length&&catalog.offset<page.total)throw new Error('STOP_EMPTY_CATALOG_PAGE');
      for(const a of page.results){
        if(!a.anime_id)throw new Error('STOP_SCHEMA');
        catalog.titles[a.anime_id]={title:a.title?.english||a.title?.romaji||a.anime_id,episodes:Number(a.episodes)||0};
        enqueue(a);
      }
      catalog.offset+=page.results.length;catalog.total=page.total;
      catalog.complete=catalog.offset>=page.total;catalog.updatedAt=new Date().toISOString();
      await checkpoint(true);
    }
    async function syncEpisode(id,mal,ep){
      if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(ep)||ep<=0)throw new Error('STOP_INVALID_EPISODE');
      const key=`${id}:${ep}`;
      if(Date.now()-(state.attempts[key]||0)<6*3600000)return;
      const file=path.join(root,'public','embeds',`${id}.json`),map=await read(file,{});
      // Backfill preserves existing links; recent releases still get refreshed after a week.
      if(map[ep]&&Date.now()-Date.parse(map[ep].verifiedAt)<7*86400000)return;
      const route=`/api/flix/${id}/${ep}${mal?'?mal='+mal:''}`;
      const d=await get(route);
      if(d.success!==true||!Array.isArray(d.servers))throw new Error('STOP_SCHEMA');
      const servers={sub:[],dub:[]};
      for(const s of d.servers){
        let u;try{u=new URL(s.dataLink);}catch{continue;}
        if(u.protocol!=='https:'||u.hostname!=='flixcloud.cc'||!/^\/e\/[a-zA-Z0-9_-]+$/.test(u.pathname))continue;
        const lang=['sub','s-sub'].includes(s.dataType)?'sub':['dub','s-dub'].includes(s.dataType)?'dub':null;
        if(lang)servers[lang].push({id:String(s.$id),name:String(s.serverName),embed_url:u.href,softsub:!!s.softsub});
      }
      state.attempts[key]=Date.now();
      if(!servers.sub.length&&!servers.dub.length)return;
      for(const list of Object.values(servers))list.sort((a,b)=>(a.name==='HD-2'?-1:b.name==='HD-2'?1:a.name.localeCompare(b.name)));
      map[ep]={verifiedAt:new Date().toISOString(),source:'https://reanime.to'+route,verification:'provider-response; playback not individually tested',servers};
      await save(file,map);changed++;
    }
    await fs.mkdir(path.join(root,'public','embeds'),{recursive:true});
    if(catalogOnly){while(!catalog.complete)await discover();}
    else {
      const home=await get('/api/v1/home');
      if(!Array.isArray(home.latest_aired)||!Array.isArray(home.new_on_site))throw new Error('STOP_SCHEMA');
      for(const a of home.latest_aired.slice(0,20)){
        if(requests>=Math.max(2,Math.floor(maxRequests/3)))break;
        if(a.anilist_id&&Number(a.episode?.episode_number)>0)await syncEpisode(Number(a.anilist_id),null,Number(a.episode.episode_number));
      }
      for(const a of home.new_on_site)enqueue(a);
      if(!catalog.complete)await discover();
      while(state.queue.length){
        const job=state.queue[0];
        if(!job.id){
          const d=await get('/api/v1/anime/'+encodeURIComponent(job.slug));
          if(!d||typeof d!=='object'||!('anilist_id' in d))throw new Error('STOP_SCHEMA');
          job.id=Number(d.anilist_id);job.mal=Number(d.mal_id)||null;
          job.total=Math.max(Number(d.subbed)||0,Number(d.dubbed)||0,Number(d.last_episode)||0);
          if(!Number.isSafeInteger(job.id)||job.id<=0||!Number.isSafeInteger(job.total)||job.total<=0){
            state.skipped[job.slug]={reason:'No explicit AniList ID or episode count',at:new Date().toISOString()};
            state.queue.shift();await checkpoint();continue;
          }
        }
        if(job.next<=job.total){await syncEpisode(job.id,job.mal,job.next);job.next++;}
        state.queue.shift();
        if(job.next>job.total)state.completed[job.slug]={id:job.id,total:job.total,at:new Date().toISOString()};
        else state.queue.push(job);
        await checkpoint();
      }
    }
  }catch(e){stopped=e.cause?.code ? `${e.message}: ${e.cause.code}` : e.message;}
  finally {
    try {if(state)await save(statePath,state);if(catalog)await save(catalogPath,catalog);}
    finally {await lock.close();await fs.unlink(lockPath);}
  }
  return {requests,changed,queuedTitles:state?.queue.length,discoveredTitles:Object.keys(catalog?.titles||{}).length,catalogTotal:catalog?.total,catalogComplete:catalog?.complete,completedTitles:Object.keys(state?.completed||{}).length,skippedTitles:Object.keys(state?.skipped||{}).length,stopped};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const result=await sync({root:path.resolve(import.meta.dirname,'..'),maxRequests:Math.min(200,Math.max(1,Number(process.env.SYNC_MAX_REQUESTS)||100)),catalogOnly:process.argv.includes('--catalog-only')});
  console.log(JSON.stringify(result));
  if(result.stopped&&result.stopped!=='BUDGET')process.exitCode=1;
}
