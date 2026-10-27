import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {sync} from './sync-embeds.mjs';
const root=path.resolve(import.meta.dirname,'..');
process.chdir(root);
const lockPath=path.join(root,'.embed-backfill.lock');
const lock=await fs.open(lockPath,'wx');
await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));
await fs.mkdir('.wrangler',{recursive:true});
const statusFile=path.join(root,'.wrangler','backfill-status.json');
const status={pid:process.pid,startedAt:new Date().toISOString(),phase:'starting',batches:0,changed:0};
const update=async patch=>{Object.assign(status,patch,{updatedAt:new Date().toISOString()});await fs.writeFile(statusFile+'.tmp',JSON.stringify(status,null,2));await fs.rename(statusFile+'.tmp',statusFile);};
const run=(command,args)=>new Promise((resolve,reject)=>{
 const child=spawn(command,args,{cwd:root,stdio:'inherit',windowsHide:true,shell:false});
 child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${command} exited ${code}`)));
});
const npm=path.join(path.dirname(process.execPath),'node_modules','npm','bin','npm-cli.js');
const wrangler=path.join(root,'node_modules','wrangler','bin','wrangler.js');
let unpublished=0,lastPublish=0;
async function publish(){
 await update({phase:'publishing'});
 const dirty=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8',windowsHide:true}).trimEnd().split('\n').filter(Boolean);
 const unsafe=dirty.filter(line=>!/^ (M|A) (\.embed-sync-state\.json|\.embed-catalog\.json|public\/embeds\/)/.test(line)&&!/^\?\? (\.embed-catalog\.json|public\/embeds\/)/.test(line));
 if(unsafe.length)throw new Error('Source changes need review before publishing: '+unsafe.join(', '));
 await run(process.execPath,[npm,'run','build']);
 await run(process.execPath,[wrangler,'pages','deploy','dist','--project-name','animegng','--branch','main','--commit-dirty=true']);
 await run(process.execPath,[wrangler,'deploy']);
 unpublished=0;lastPublish=Date.now();await update({lastPublishedAt:new Date().toISOString()});
}
try {
 // An already-running discovery batch may finish first; never start a second writer.
 while(true){
  try {await fs.access(path.join(root,'.embed-sync.lock'));}
  catch(e){if(e.code==='ENOENT')break;throw e;}
  const owner=JSON.parse(await fs.readFile(path.join(root,'.embed-sync.lock'),'utf8'));
  try{process.kill(owner.pid,0);}catch{throw new Error('Stale sync lock requires review');}
  await update({phase:'waiting-for-active-sync'});
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 while(true){
  await update({phase:'discovering'});
  const result=await sync({root,maxRequests:200,catalogOnly:true});
  console.log(JSON.stringify(result));await update({lastBatch:result});
  if(result.stopped&&result.stopped!=='BUDGET')throw new Error(result.stopped);
  if(result.catalogComplete)break;
 }
 while(true){
  await update({phase:'importing'});
  const result=await sync({root,maxRequests:200});
  console.log(JSON.stringify(result));unpublished+=result.changed;
  await update({batches:status.batches+1,changed:status.changed+result.changed,lastBatch:result,unpublished});
  if(result.stopped&&result.stopped!=='BUDGET')throw new Error(result.stopped);
  if(unpublished&&(Date.now()-lastPublish>=3600000||!result.queuedTitles))await publish();
  if(!result.queuedTitles)break;
 }
 await update({phase:'complete'});
}catch(e){console.error(e);await update({phase:'stopped',error:e.message,unpublished});process.exitCode=1;}
finally{await lock.close();await fs.unlink(lockPath);}
