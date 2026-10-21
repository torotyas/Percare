/* 首頁 (minimal): current pet's one-tap care check-ins, next reminder, big SOS button. Settings sheet: backup/restore, feedback.
   Care items live on pet.careItems [{id,name,every(days, 0 = no interval),daily}]; taps go to the `carelogs` store
   {petId,itemId,name,at,note}. Undo = soft delete. No medical advice anywhere. */
(function(){
const PC=window.PC, {DB,S,$,esc,sp,ava,hdr,empty,openSheet,closeSheet,save,remove,petBar,bindPetBar,fmtDT,dstr,CARE_DEFAULTS}=PC;
const APP_VERSION='0.2.0';
const DAILY=/刷牙|散步|餵食|噴水/;
const D=864e5;
const items=p=>p.careItems||(CARE_DEFAULTS[p.species]||CARE_DEFAULTS.other).map((n,i)=>({id:'d'+i,name:n,every:DAILY.test(n)?1:0,daily:DAILY.test(n)}));
async function ensureItems(p){ if(!p.careItems){ const r=await save('pets',{...p,careItems:items(p)}); return r; } return p; }
const logs=(petId,itemId)=>S.carelogs.filter(l=>l.petId===petId&&(!itemId||l.itemId===itemId)).sort((a,b)=>b.at.localeCompare(a.at));
const dayKey=iso=>dstr(new Date(iso));
const daysSince=iso=>Math.round((new Date(PC.today()+'T00:00:00')-new Date(dayKey(iso)+'T00:00:00'))/D);
function streak(L){ const days=new Set(L.map(l=>dayKey(l.at))); let d=new Date(); if(!days.has(dstr(d))) d.setDate(d.getDate()-1); let n=0; while(days.has(dstr(d))){ n++; d.setDate(d.getDate()-1); } return n; }
const bare=s=>s.replace(/^[^\p{L}\p{N}]+/u,'').trim();
function stat(p,it){ const L=logs(p.id,it.id), last=L[0];
  const ago=last?daysSince(last.at):null;
  const agoT=last?(ago===0?'今天 '+fmtDT(last.at).split(' ')[1]:ago+' 天前'):'還沒記錄';
  let next=''; if(it.every&&last){ const n=it.every-ago; next=n>0?`${n} 天後`:n===0?'今天該做':`已過 ${-n} 天`; }
  return {L,last,ago,agoT,next,doneToday:ago===0,st:it.daily?streak(L):0,cnt30:L.filter(l=>Date.now()-new Date(l.at)<=30*D).length}; }
let toastT;
function toast(html,undo){ let t=$('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); }
  t.innerHTML=html+(undo?' <button class="btn sm" id="undoBtn">復原</button>':''); t.classList.add('on'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('on'),5000);
  if(undo) $('undoBtn').onclick=async()=>{ t.classList.remove('on'); await undo(); }; }
/* matching reminder (same pet, title/type contains the care name, due within 7 days or overdue) is completed and advanced */
async function matchReminder(p,it){ const nm=bare(it.name); if(!nm) return null;
  const r=S.reminders.filter(r=>r.petId===p.id&&PC.daysTo(r.date)<=7&&(PC.remTitle(r).includes(nm)||nm.includes(PC.remTitle(r)))).sort((a,b)=>a.date.localeCompare(b.date))[0];
  if(!r) return null; await PC.completeReminder(r,'care_checkin'); return r; }
async function checkIn(pets,it,note){ const out=[];
  for(const p of pets){ const its=items(p).find(x=>bare(x.name)===bare(it.name))||it;
    const l=await save('carelogs',{petId:p.id,itemId:its.id,name:its.name,at:new Date().toISOString(),note:note||''});
    const r=await matchReminder(p,its); out.push({l,r,p}); }
  return out; }
async function tap(p,it,note){ const res=await checkIn([p],it,note); const {l,r}=res[0]; render();
  toast(`✅ ${esc(p.name)}：${esc(it.name)} 已記錄${r?'・提醒已更新':''}`, async()=>{ await remove('carelogs',l.id); render(); }); }
function noteSheet(p,it){ openSheet(`<div class="shead"><h2>${esc(it.name)}・加備註</h2><button class="x" data-close>✕</button></div>
  <form id="nf"><div class="f"><label>備註</label><textarea name="note" rows="3" maxlength="300" placeholder="例如：用了新牙膏"></textarea></div><button class="btn full">記錄</button></form>`,
  box=>{ box.querySelector('#nf').onsubmit=async e=>{ e.preventDefault(); const n=e.target.note.value.trim(); closeSheet(); await tap(p,it,n); }; box.querySelector('textarea').focus(); }); }
function historySheet(p){ const L=logs(p.id).slice(0,60);
  openSheet(`<div class="shead"><h2>${esc(p.name)} 的照護紀錄</h2><button class="x" data-close>✕</button></div>
  ${L.length?L.map(l=>`<div class="list-item"><div class="grow"><b>${esc(l.name)}</b><div class="meta">${fmtDT(l.at)}${l.createdBy&&l.createdBy!==DB.me?'・家人':''}</div>${l.note?`<div class="note">${esc(l.note)}</div>`:''}</div><button class="btn sm ghost" data-del="${l.id}">刪除</button></div>`).join(''):'<div class="meta">還沒有紀錄</div>'}`,
  box=>box.querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{ if(!confirm('刪除這筆紀錄？')) return; await remove('carelogs',b.dataset.del); historySheet(p); render(); })); }
function itemsSheet(p){ const its=items(p);
  openSheet(`<div class="shead"><h2>管理打卡項目</h2><button class="x" data-close>✕</button></div>
  <div class="srcs" style="margin-bottom:8px">「間隔」是你自己想多久做一次，用來顯示「幾天後」；填 0 代表不提醒。勾「每日」會計算連續天數。</div>
  <form id="itf">${its.map((it,i)=>`<div class="itrow" data-i="${i}"><input name="n${i}" maxlength="12" value="${esc(it.name)}"><input name="e${i}" type="number" min="0" max="365" inputmode="numeric" value="${it.every||0}" title="間隔天數"><span class="meta">天</span><label class="meta"><input type="checkbox" name="d${i}"${it.daily?' checked':''}>每日</label><button type="button" class="btn sm ghost" data-rm="${i}">✕</button></div>`).join('')}
  <div class="itrow"><input name="newName" maxlength="12" placeholder="新增項目，例如：🦴 潔牙骨"><button type="button" class="btn sm" id="itAdd">＋</button></div>
  <button class="btn full" style="margin-top:10px">儲存</button></form>`, box=>{
    const f=box.querySelector('#itf');
    const collect=()=>its.map((it,i)=>({...it,name:(f['n'+i].value||'').trim()||it.name,every:Math.max(0,parseInt(f['e'+i].value)||0),daily:f['d'+i].checked}));
    box.querySelectorAll('[data-rm]').forEach(b=>b.onclick=async()=>{ const c=collect(); c.splice(+b.dataset.rm,1); await save('pets',{...p,careItems:c}); itemsSheet(PC.pet(p.id)); render(); });
    $('itAdd').onclick=async()=>{ const n=f.newName.value.trim(); if(!n) return; const c=collect(); c.push({id:DB.uuid(),name:n,every:0,daily:false}); await save('pets',{...p,careItems:c}); itemsSheet(PC.pet(p.id)); render(); };
    f.onsubmit=async e=>{ e.preventDefault(); await save('pets',{...p,careItems:collect()}); closeSheet(); render(); }; }); }
function multiSheet(){ const names=[...new Set(S.pets.flatMap(p=>items(p).map(i=>i.name)))];
  openSheet(`<div class="shead"><h2>多隻一起打卡</h2><button class="x" data-close>✕</button></div><form id="mf">
   <div class="f"><label>項目</label><div class="opt">${names.map((n,i)=>`<label><input type="radio" name="it" value="${esc(n)}"${i?'':' checked'}><span>${esc(n)}</span></label>`).join('')}</div></div>
   <div class="f"><label>毛孩</label>${S.pets.map(p=>`<label class="check"><input type="checkbox" name="p" value="${p.id}" checked><span>${sp(p).i} ${esc(p.name)}</span></label>`).join('')}</div>
   <button class="btn full">一起記錄</button></form>`, box=>{ box.querySelector('#mf').onsubmit=async e=>{ e.preventDefault(); const fd=new FormData(e.target); const nm=fd.get('it'); const ps=fd.getAll('p').map(id=>PC.pet(id)).filter(Boolean); if(!ps.length) return;
     const res=await checkIn(ps,{id:'x',name:nm}); closeSheet(); render(); toast(`✅ ${ps.length} 隻已記錄「${esc(nm)}」`, async()=>{ for(const x of res) await remove('carelogs',x.l.id); render(); }); }; }); }
function settingsSheet(){
  openSheet(`<div class="shead"><h2>設定</h2><button class="x" data-close>✕</button></div>
   <button class="big-btn teal" id="bkExp">💾 <span>備份資料<small>下載一個 JSON 檔（不含照片與附件）</small></span></button>
   <label class="big-btn teal" style="cursor:pointer">📥 <span>從備份還原<small>合併匯入，不會刪除目前資料</small></span><input type="file" id="bkImp" accept="application/json,.json" hidden></label>
   <a class="big-btn orange" id="fb" href="#">✉️ <span>意見回饋<small>寄信給開發者</small></span></a>
   <div class="srcs" style="text-align:center">毛孩健康護照 v${APP_VERSION}・本 app 不提供醫療建議，有疑慮請聯絡獸醫。</div>`, box=>{
    $('bkExp').onclick=async()=>{ const d=await DB.exportAll(); window.Platform.Share.download(new Blob([JSON.stringify(d)],{type:'application/json'}),`毛孩護照備份-${PC.today()}.json`); };
    $('bkImp').onchange=async e=>{ const file=e.target.files[0]; if(!file) return; try{ const n=await DB.importAll(JSON.parse(await file.text())); await PC.load(); closeSheet(); render(); toast(`已還原 ${n} 筆資料`); }catch(err){ alert('還原失敗：'+err.message); } };
    $('fb').href='mailto:kai.pobi666@gmail.com?subject='+encodeURIComponent('PetCare 意見回饋')+'&body='+encodeURIComponent(`\n\n\n---\nApp 版本：${APP_VERSION}\n裝置：${navigator.userAgent}`); }); }
const inApp=/Line\/|FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent);
async function render(){
  const v=$('v-home'); let p=PC.pet();
  const banner=inApp&&!sessionStorage.getItem('pcIab')?`<div class="info iab">📱 你正在 LINE／FB／IG 內建瀏覽器中，資料可能無法保存。請點右上角「⋯」選「用 Safari／Chrome 開啟」。<button class="btn sm ghost" id="iabX">知道了</button></div>`:'';
  v.innerHTML=hdr('🐾',p?p.name:'毛孩健康護照',p?'今天的照護':'','<button class="btn sm ghost" id="setBtn" aria-label="設定">⚙️</button>')+petBar()+`<div class="pad">${banner}<div id="hm"></div>
   <button class="sos-big" id="sosBig">🚑 緊急求助<small>撥打醫院・找附近 24 小時急診</small></button></div>`;
  bindPetBar(v,render); $('setBtn').onclick=settingsSheet; $('sosBig').onclick=()=>PC.go('sos');
  const ix=$('iabX'); if(ix) ix.onclick=()=>{ sessionStorage.setItem('pcIab','1'); render(); };
  if(!p){ $('hm').innerHTML=empty('🐾','先幫你家的寶貝建一本護照吧！','<br><button class="btn" id="hAdd">＋ 新增毛孩</button>'); $('hAdd').onclick=()=>{ PC.go('pets'); PC.petForm(); }; return; }
  p=await ensureItems(p);
  const its=items(p);
  const btn=it=>{ const s=stat(p,it); return `<button class="care-btn${s.doneToday?' done':''}" data-it="${it.id}"><span class="cn">${esc(it.name)}</span><span class="cs">${s.agoT}${s.next?'・'+s.next:''}</span><span class="cs">${it.daily&&s.st?`🔥 連續 ${s.st} 天`:`30 天 ${s.cnt30} 次`}</span></button>`; };
  const up=S.reminders.filter(r=>r.petId===p.id).sort((a,b)=>a.date.localeCompare(b.date))[0];
  $('hm').innerHTML=`<div class="care-grid">${its.map(btn).join('')}</div>
   <div class="row care-links"><button class="btn sm ghost" id="hHist">🕘 紀錄</button><button class="btn sm ghost" id="hItems">✏️ 項目</button>${S.pets.length>1?'<button class="btn sm ghost" id="hMulti">🐾 多隻一起</button>':''}</div>
   <div class="srcs" style="text-align:center;margin:2px 0 10px">點一下記錄・長按可加備註</div>
   <div class="card tap" id="hRem">${up?(()=>{ const [cls,txt]=PC.whenTxt(up); return `<div class="rem"><div class="t"><div class="meta">下一個提醒</div><b>${esc(PC.remTitle(up))}</b></div><span class="when ${cls}">${txt}</span></div>`; })():'<div class="meta">沒有提醒・點這裡新增</div>'}</div>`;
  const grid=v.querySelector('.care-grid');
  grid.querySelectorAll('[data-it]').forEach(b=>{ const it=its.find(x=>x.id===b.dataset.it); let t, long=false;
    const start=()=>{ long=false; t=setTimeout(()=>{ long=true; noteSheet(p,it); },550); }, cancel=()=>clearTimeout(t);
    b.addEventListener('pointerdown',start); b.addEventListener('pointerup',cancel); b.addEventListener('pointerleave',cancel); b.addEventListener('pointercancel',cancel);
    b.addEventListener('contextmenu',e=>e.preventDefault());
    b.onclick=()=>{ if(long){ long=false; return; } tap(p,it); }; });
  $('hHist').onclick=()=>historySheet(p); $('hItems').onclick=()=>itemsSheet(p); const m=$('hMulti'); if(m) m.onclick=multiSheet;
  $('hRem').onclick=()=>PC.go('care');
}
PC.VIEWS.home=render;
Object.assign(PC,{careItems:items,careLogs:logs,careCheckIn:checkIn,APP_VERSION});
})();
