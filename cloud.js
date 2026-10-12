import {createClient} from './supabase.js';
import {PhotoCodec} from './cloud-core.js';
await window.passportReady;
const bridge=window.passportBridge,config=window.PASSPORT_CONFIG;
const tools=document.createElement('div');tools.id='cloud-tools';tools.innerHTML='<span id="cloud-message" role="status"></span><button id="sync-now">Sync now</button>';
document.querySelector('#utility').append(tools);
const message=tools.querySelector('#cloud-message'),tell=text=>message.textContent=text;
let busy=false,paused=true,serial=0,timer=null,conflict=null,suppressed=false;
const client=createClient(config.supabaseUrl,config.supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const codec=new PhotoCodec({
 async upload(path,blob){const {error}=await client.storage.from(config.bucket).upload(path,blob,{contentType:blob.type,upsert:false});if(error&&String(error.statusCode)!=='409'&&!/already exists|duplicate/i.test(error.message||''))throw error},
 async download(path){const {data,error}=await client.storage.from(config.bucket).download(path);if(error)throw error;return data}
});
const panel=document.createElement('section');panel.className='cloud-panel';panel.innerHTML='<article><h2>Your little book of memories</h2><p class="message" role="status">Opening the passport…</p><button class="btn" id="retry-open">Try again</button><button class="btn" id="draft-open">Open a draft on this device</button></article>';document.body.append(panel);
const lock=text=>{panel.hidden=false;panel.querySelector('.message').textContent=text;document.documentElement.classList.add('cloud-gated')};
const unlock=()=>{panel.hidden=true;document.documentElement.classList.remove('cloud-gated')};
function changed(){if(paused||suppressed)return;serial++;bridge.setMeta({dirty:true});tell(navigator.onLine?'Saved draft · waiting to sync':'Offline · saved draft on this device');clearTimeout(timer);timer=setTimeout(sync,1200)}
window.onPassportChange=changed;
async function readCloud(){const {data,error}=await client.from('passport_shared').select('state,revision').eq('id','aangi').single();if(error)throw error;return data}
async function applyCloud(row,guard){const state=await codec.decode(row.state);if(guard!==undefined&&(serial!==guard||bridge.getMeta().dirty))return false;suppressed=true;try{await bridge.replace(state,{revision:row.revision,dirty:false})}finally{suppressed=false}return true}
function showConflict(row){
 conflict=row;clearTimeout(timer);tell('The cloud passport changed on another device. Choose which version to keep.');
 const box=document.createElement('section');box.className='cloud-panel';box.id='conflict-panel';box.innerHTML='<article><h2>Two versions of your passport</h2><p>Your draft and the shared passport have both changed. Download your draft first if you want to keep both.</p><button id="conflict-backup" class="btn">Back up this draft</button><button id="cloud-wins" class="btn">Use cloud version</button><button id="local-wins" class="btn">Keep this device version</button><p class="message" role="status"></p></article>';document.querySelector('#conflict-panel')?.remove();document.body.append(box);
 box.querySelector('#conflict-backup').onclick=()=>document.querySelector('#backup').click();
 box.querySelector('#cloud-wins').onclick=async()=>{try{await applyCloud(await readCloud());conflict=null;box.remove();tell('Cloud memories loaded')}catch{box.querySelector('.message').textContent='Could not load cloud memories. Your draft is still here.'}};
 box.querySelector('#local-wins').onclick=async()=>{bridge.setMeta({revision:row.revision,dirty:true});await bridge.flush();conflict=null;box.remove();sync()};
}
async function sync(){
 if(busy||paused||conflict)return;
 if(!navigator.onLine){tell('Offline · saved draft on this device');return}
 busy=true;const before=serial;
 try{
  if(!bridge.getMeta().dirty){const row=await readCloud();if(row.revision!==bridge.getMeta().revision)await applyCloud(row,before);tell(bridge.getMeta().dirty?'Draft changes waiting to sync':'Saved to the shared passport');return}
  const expected=bridge.getMeta().revision,snapshot=bridge.getState();tell('Saving photos and memories…');
  const payload=await codec.encode(snapshot);const {data,error}=await client.rpc('save_shared_passport',{expected_revision:expected,new_state:payload});
  if(error){if(error.message?.includes('journal_conflict')){showConflict(await readCloud());return}throw error}
  bridge.setMeta({revision:Number(data),dirty:before!==serial});await bridge.flush();tell(before===serial?'Saved to the shared passport':'Saved draft · more changes waiting');
 }catch(error){tell('Cloud save unavailable · your draft stays on this device');console.warn('Passport sync did not complete:',error.code||error.status||'connection');}
 finally{busy=false;clearTimeout(timer);if(!conflict&&navigator.onLine)timer=setTimeout(sync,bridge.getMeta().dirty?15000:30000)}
}
let opening=false,scoped=false;
async function open(){
 if(opening)return;opening=true;paused=true;lock('Opening the shared passport…');
 try{if(!scoped){await bridge.scope('shared-aangi');scoped=true}const row=await readCloud();
  if(bridge.getMeta().dirty){paused=false;unlock();if(bridge.getMeta().revision!==row.revision)showConflict(row);else sync();return}
  await applyCloud(row);paused=false;unlock();tell('Shared passport · anyone with the link can view and edit');timer=setTimeout(sync,30000);
 }catch{lock('The cloud passport is unavailable right now. Retry, or write a draft on this device and sync it later.');tell('Cloud connection unavailable')}
 finally{opening=false}
}
tools.querySelector('#sync-now').onclick=()=>sync();panel.querySelector('#retry-open').onclick=open;
panel.querySelector('#draft-open').onclick=()=>{if(opening)return;paused=false;unlock();tell('Working on this device · cloud saving is pending')};
addEventListener('online',()=>sync());addEventListener('offline',()=>tell('Offline · saved draft on this device'));
addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!paused)sync()});
await open();

