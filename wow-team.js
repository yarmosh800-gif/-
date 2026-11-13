import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.58.0';
const db=createClient('https://mkwupwbpgfdvaciowgel.supabase.co','sb_publishable_OfuG19Samqr0tCsQmIr9eA_QBVwa98X');
const isTasks=location.pathname.endsWith('tasks.html'), embed=isTasks&&new URLSearchParams(location.search).get('embed')==='1';
let me=null,role=null,active=false,connecting=false,localDraft=null,known=new Map(),channel=null,refreshing=false;
const $=q=>document.querySelector(q),copy=x=>JSON.parse(JSON.stringify(x));
const state=s=>{const n=$('#team-state');if(n)n.textContent=s};
const say=s=>{const n=$('#team-message');if(n)n.textContent=s};
function panel(){
 if(embed)return;
 const css=document.createElement('style');css.textContent='#wow-team{border:1px solid #e4d4df;background:#fff;border-radius:10px;padding:10px 13px;margin:8px 0 15px;font-size:12px;color:#644d5a}#wow-team .line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}#team-state{flex:1;color:#987685}#wow-team button{border:1px solid #d6b8c9;border-radius:7px;background:white;color:#80344d;padding:6px 9px;cursor:pointer;font-size:11px}#wow-team input{border:1px solid #d6b8c9;border-radius:7px;padding:6px 9px;max-width:220px}#wow-team form{display:flex;gap:7px;margin:10px 0;flex-wrap:wrap}#wow-team details{margin-top:9px}#team-message{color:#99526d;font-size:11px}';document.head.append(css);
 const box=document.createElement('div');box.id='wow-team';box.innerHTML='<div class="line"><b>◉ Команда WOW</b><span id="team-state">Проверка…</span><button id="team-toggle">Войти</button><button id="team-out" hidden>Выйти</button></div><form id="team-login" hidden><input id="team-email" type="email" placeholder="Рабочая почта" required><button>Получить ссылку для входа</button></form><p id="team-message"></p><details id="team-tools" hidden><summary>Участники · перенос локальных правок</summary><form id="team-add-form" hidden><input id="team-invite" type="email" placeholder="Почта участника" required><button>Добавить в команду</button></form><div id="team-members"></div><button id="team-import" type="button">Перенести мои локальные изменения</button><p style="font-size:10px">Импорт может заменить общие версии этих изменений. Он запускается только по вашему подтверждению.</p></details>';
 const target=isTasks?$('.content'):document.querySelector('main');target?.insertBefore(box,isTasks?target.firstChild:target.querySelector('.top')?.nextSibling||target.firstChild);
 $('#team-toggle').onclick=()=>$('#team-login').hidden=!$('#team-login').hidden;
 $('#team-out').onclick=async()=>{await db.auth.signOut();location.reload()};
 $('#team-login').onsubmit=async e=>{e.preventDefault();state('Отправляем письмо…');const email=$('#team-email').value.trim().toLowerCase();const {error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});if(error)state('Ошибка: '+error.message);else{state('Письмо отправлено');say('Откройте ссылку из письма на этом устройстве.')}};
 $('#team-add-form').onsubmit=async e=>{e.preventDefault();const email=$('#team-invite').value.trim().toLowerCase();const {error}=await db.from('wow_members').insert({email,role:'editor'});if(error)say(error.message);else{say('Добавлен '+email);$('#team-invite').value='';listMembers()}};
 $('#team-import').onclick=importDraft;
}
async function listMembers(){if(!role||!$('#team-members'))return;const {data}=await db.from('wow_members').select('email,role');$('#team-members').textContent=(data||[]).map(x=>x.email+(x.role==='admin'?' (админ)':'')).join(' · ')}
async function connect(){
 if(connecting||active)return;connecting=true;
 try{
 const {data:{user}}=await db.auth.getUser();
 if(!user){active=false;state('Локально · войдите для общего редактирования');return}
 me=user;
 const {data,error}=await db.from('wow_members').select('role,email').eq('email',String(user.email||'').toLowerCase()).maybeSingle();
 if(error||!data){active=false;state('Нет доступа: '+user.email);say('Попросите администратора добавить этот email.');if($('#team-out'))$('#team-out').hidden=false;return}
 role=data.role;active=true;
 if($('#team-tools')){$('#team-tools').hidden=false;$('#team-toggle').hidden=true;$('#team-out').hidden=false;$('#team-login').hidden=true;$('#team-add-form').hidden=role!=='admin'}
 state('● Общая база · '+user.email);listMembers();await loadRemote(true);
 channel=db.channel('wow-team-'+(isTasks?'tasks':'docs')).on('postgres_changes',{event:'*',schema:'public',table:'wow_records'},()=>loadRemote(false)).subscribe();
 setInterval(()=>{if(document.visibilityState==='visible')loadRemote(false)},15000);
 }finally{connecting=false}
}
function busy(){const a=document.activeElement;return !!(a&&(a.isContentEditable||(['INPUT','TEXTAREA','SELECT'].includes(a.tagName)&&!a.closest('#wow-team'))))}
async function loadRemote(first){
 if(!active||refreshing||(!first&&busy()))return;refreshing=true;
 try{
  const {data,error}=await db.from('wow_records').select('id,kind,payload,sort_order,updated_at').order('sort_order');
  if(error){state('Ошибка загрузки: '+error.message);return}
  known=new Map((data||[]).map(x=>[x.id,JSON.stringify(x.payload)]));
  if(isTasks&&window.wowTaskBridge)window.wowTaskBridge.apply((data||[]).filter(x=>x.kind==='task').map(x=>x.payload),first);
  if(!isTasks&&window.wowDocsBridge)for(const type of ['notion','edit','retro']){const r=(data||[]).find(x=>x.id==='doc:'+type);if(r)window.wowDocsBridge.apply(type,r.payload,first)}
  if(first)state('● Общая база · '+me.email);
 }finally{refreshing=false}
}
const queued=new Map();let timer=null,flushing=false;
function enqueue(row){if(!active)return;queued.set(row.id,row);clearTimeout(timer);timer=setTimeout(flush,900)}
async function flush(){
 if(!active||flushing)return;flushing=true;
 const rows=[...queued.values()];queued.clear();
 if(rows.length){const {error}=await db.from('wow_records').upsert(rows,{onConflict:'id'});if(error){rows.forEach(x=>queued.set(x.id,x));state('Не сохранилось: '+error.message)}else state('✓ Сохранено для команды · '+me.email)}
 flushing=false;if(queued.size){clearTimeout(timer);timer=setTimeout(flush,1500)}
}
const api={get ready(){return active},saveDoc:(type,payload)=>enqueue({id:'doc:'+type,kind:'doc',payload:copy(payload),sort_order:0}),saveTasks:(items)=>{
 if(!active)return;items.forEach((t,i)=>{const j=JSON.stringify(t);if(j!==known.get(t.id)){known.set(t.id,j);enqueue({id:t.id,kind:'task',payload:copy(t),sort_order:i})}})
},removeTask:async id=>{if(!active)return;const {error}=await db.from('wow_records').delete().eq('id',id);if(error)state('Ошибка удаления: '+error.message)},refresh:()=>loadRemote(false)};
window.wowTeam=api;
function setup(){
 if(isTasks&&window.wowTaskBridge){localDraft=copy(window.wowTaskBridge.collect());window.wowTaskBridge.onChange=api.saveTasks;window.wowTaskBridge.onDelete=api.removeTask}
 if(!isTasks&&window.wowDocsBridge){localDraft=copy(window.wowDocsBridge.collect());window.wowDocsBridge.onChange=api.saveDoc}
}
async function importDraft(){
 if(!active)return;
 if(isTasks){
  const rows=(localDraft||[]).filter(t=>!window.wowTaskBridge.seedMatches(t));
  if(!rows.length){say('Изменений относительно исходного списка нет.');return}
  if(!confirm('Отправить '+rows.length+' локальных изменений в общую базу? Одноимённые задачи могут быть заменены.'))return;
  rows.forEach((t,i)=>enqueue({id:t.id,kind:'task',payload:t,sort_order:i}));await flush();await loadRemote(false);say('Локальные задачи перенесены.');
 }else{
  if(!confirm('Перенести локальные правки? Общая версия этих разделов будет заменена.'))return;
  for(const k of ['notion','edit','retro'])if(localDraft?.[k]&&Object.keys(localDraft[k]).length)api.saveDoc(k,localDraft[k]);
  await flush();await loadRemote(false);say('Локальные правки перенесены.');
 }
}
function boot(){panel();setup();db.auth.onAuthStateChange((_e,s)=>{if(s?.user&&!active)setTimeout(connect,0)});connect().catch(e=>state('Ошибка: '+e.message))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
