// Public collaborative editing for WOW Dashboard. No login required.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const db=createClient('https://mkwupwbpgfdvaciowgel.supabase.co','sb_publishable_OfuG19Samqr0tCsQmIr9eA_QBVwa98X',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const $=s=>document.querySelector(s),clone=x=>JSON.parse(JSON.stringify(x));
let connected=false,loading=false,writing=false,dirty=new Map(),timer=null,localDraft=null,known=new Map();
function status(message){if(/Ошибка|ошибка/i.test(String(message)))console.error('[WOW sync]',message)}
// Collaboration runs silently without an interface panel.
function busy(){const el=document.activeElement;return !!(el&&(el.isContentEditable||(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)&&!el.closest('#wow-shared'))))}
async function load(first=false){
 if(!connected||loading||writing||dirty.size||(!first&&busy()))return;loading=true;
 try{const {data,error}=await db.from('wow_records').select('id,payload').eq('kind','doc');if(error){status('Ошибка чтения: '+error.message);return}
 for(const row of data||[]){known.set(row.id,JSON.stringify(row.payload));const type=row.id.slice(4);if(['notion','edit','retro'].includes(type))window.wowDocsBridge?.apply(type,row.payload,first)}
 status('✓ Общая база подключена · без входа')}finally{loading=false}
}
function saveDoc(type,payload){
 if(!connected||!['notion','edit','retro'].includes(type))return;
 const id='doc:'+type,value=clone(payload);if(known.get(id)===JSON.stringify(value))return;
 dirty.set(id,{id,kind:'doc',payload:value,sort_order:0});clearTimeout(timer);timer=setTimeout(flush,700);status('Сохраняем изменения…');
}
async function flush(){
 if(writing||!connected)return;writing=true;const items=[...dirty.values()];dirty.clear();
 for(const item of items){const {error}=await db.from('wow_records').upsert(item,{onConflict:'id'});if(error){dirty.set(item.id,item);status('Ошибка сохранения: '+error.message)}else known.set(item.id,JSON.stringify(item.payload))}
 writing=false;if(dirty.size)timer=setTimeout(flush,2000);else{status('✓ Сохранено для всех');load(false)}
}
async function importLocal(){
 if(!connected||!localDraft)return;if(!confirm('Перенести локальные изменения этого браузера в общую базу? Они заменят текущие общие версии соответствующих разделов.'))return;
 for(const type of ['notion','edit','retro']){const data=localDraft[type];if(data&&Object.keys(data).length)saveDoc(type,data)}
 await flush();status('Локальные изменения перенесены');try{localStorage.removeItem('wow_team_docs_draft_backup_v1')}catch(e){}
}
async function init(){
 if(!window.wowDocsBridge)return;
 const key='wow_team_docs_draft_backup_v1';localDraft=clone(window.wowDocsBridge.collect());
 try{if(!localStorage.getItem(key)&&!localStorage.getItem('wow_team_docs_initialized'))localStorage.setItem(key,JSON.stringify(localDraft));localDraft=JSON.parse(localStorage.getItem(key)||JSON.stringify(localDraft))}catch(e){}
 window.wowDocsBridge.onChange=saveDoc;connected=true;await load(true);
 try{localStorage.setItem('wow_team_docs_initialized','1')}catch(e){}
 db.channel('wow-public-docs').on('postgres_changes',{event:'*',schema:'public',table:'wow_records',filter:'kind=eq.doc'},()=>load(false)).subscribe();
 setInterval(()=>{if(document.visibilityState==='visible')load(false)},12000);window.addEventListener('focus',()=>load(false));
 window.wowTeam={get ready(){return connected},saveDoc,refresh:()=>load(false)};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(e=>status('Ошибка: '+e.message)),{once:true});
else init().catch(e=>status('Ошибка: '+e.message));
