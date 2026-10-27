import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const statePath=path.join(root,'.embed-sync-state.json');
const read=async(file,other)=>{try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return other;throw e;}};
const state=await read(statePath,{offset:0,queue:[],attempts:{}});
const max=Math.min(200,Math.max(1,Number(process.env.SYNC_MAX_REQUESTS)||100));
let requests=0,changed=0,stopped=null,last=0;
async function get(route){
  if(requests>=max)throw new Error('BUDGET');
  await new Promise(r=>setTimeout(r,Math.max(0,1200-(Date.now()-last))));last=Date.now();requests++;
  const res=await fetch('https://reanime.to'+route,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
  if(!res.ok)throw new Error(`STOP_HTTP_${res.status}`);
  if(!res.headers.get('content-type')?.includes('application/json'))throw new Error('STOP_NON_JSON');
  return res.json();
}
async function save(file,data){const tmp=file+'.tmp';await fs.writeFile(tmp,JSON.stringify(data,null,2)+'\n');await fs.rename(tmp,file);}
async function syncEpisode(id,mal,ep){
  if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(ep)||ep<=0)return;
  const key=`${id}:${ep}`;
  if(Date.now()-(state.attempts[key]||0)<6*3600000)return;
  const file=path.join(root,'public','embeds',`${id}.json`),map=await read(file,{});
  if(map[ep]&&Date.now()-Date.parse(map[ep].verifiedAt)<7*86400000)return;
  const route=`/api/flix/${id}/${ep}${mal?'?mal='+Number(mal):''}`;
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
try{
  const home=await get('/api/v1/home');
  // Recent episodes first; at most 20 so historical backfill gets a share each run.
  for(const a of (home.latest_aired||[]).slice(0,20)){
    if(requests>=Math.max(2,Math.floor(max/3)))break;
    if(a.anilist_id)await syncEpisode(Number(a.anilist_id),null,Number(a.episode?.episode_number));
  }
  for(const a of home.new_on_site||[])if(a.anime_id&&!state.queue.some(x=>x.slug===a.anime_id))state.queue.push({slug:a.anime_id,next:1});
  if(state.queue.length<100){
    const page=await get(`/api/v1/search?playable=true&limit=20&offset=${state.offset}`);
    if(!Array.isArray(page.results))throw new Error('STOP_SCHEMA');
    for(const a of page.results)if(a.anime_id&&!state.queue.some(x=>x.slug===a.anime_id))state.queue.push({slug:a.anime_id,next:1});
    state.offset+=page.results.length;
    if(!page.results.length||state.offset>=page.total)state.offset=0;
  }
  while(state.queue.length){
    const job=state.queue[0];
    if(!job.id){const d=await get('/api/v1/anime/'+encodeURIComponent(job.slug));job.id=Number(d.anilist_id);job.mal=Number(d.mal_id)||null;job.total=Math.max(Number(d.subbed)||0,Number(d.dubbed)||0,Number(d.last_episode)||0);if(!job.id||!job.total){state.queue.shift();continue;}}
    if(job.next>job.total){state.queue.shift();continue;}
    await syncEpisode(job.id,job.mal,job.next);job.next++;
  }
}catch(e){stopped=e.message;}finally{await save(statePath,state);}
console.log(JSON.stringify({requests,changed,queuedTitles:state.queue.length,catalogOffset:state.offset,stopped}));
if(stopped&&stopped!=='BUDGET')process.exitCode=1;
