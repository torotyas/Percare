/* Care reminders (reused from pet-friendly-app: interval math, overdue grouping, .ics export, notifier).
   Species "examples" are suggestions only, not predictions; intervals must follow the vet's advice.
   Completing a reminder writes an append-only action (who/when). */
(function(){
const PC=window.PC, {DB,S,$,esc,fmtD,sp,hdr,empty,openSheet,closeSheet,save,remove,ava,today,daysTo,petBar,bindPetBar}=PC;
const {Notifier,Share}=window.Platform;
const RTYPES={vaccine:'💉 疫苗',deworm:'💊 驅蟲',heartworm:'❤️ 心絲蟲預防',med:'💊 用藥',checkup:'🩺 健康檢查',groom:'✂️ 美容／剪指甲',habitat:'🏠 環境清潔／換水',custom:'📝 自訂'};
const UNITS={day:'天',week:'週',month:'個月',year:'年'};
function addInterval(s,n,u){ const d=new Date(s+'T00:00:00'); if(u==='day')d.setDate(d.getDate()+n); else if(u==='week')d.setDate(d.getDate()+7*n); else if(u==='month')d.setMonth(d.getMonth()+n); else if(u==='year')d.setFullYear(d.getFullYear()+n); return PC.dstr(d); }
const fmtW=s=>{ const d=new Date(s+'T00:00:00'); return `${d.getMonth()+1}/${d.getDate()}（${'日一二三四五六'[d.getDay()]}）`; };
const remTitle=r=>r.title||RTYPES[r.type].slice(2).trim();
const remLabel=r=>{ const p=PC.pet(r.petId); return `${p?p.name:'毛孩'}：${remTitle(r)}`; };
function whenTxt(r){ const n=daysTo(r.date); if(n<0) return ['over',`逾期 ${-n} 天`]; if(n===0) return ['over','今天']; if(n<=7) return ['soon',`${n} 天後`]; return ['later',fmtW(r.date)]; }
const isIOS=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const standalone=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
function notifInfo(){ const s=Notifier.state();
  return s==='native'?'🔔 已使用手機系統通知（app 關閉時也會提醒）。':s==='granted'?'🔔 已開啟通知：打開 app 時會提醒到期項目。網頁版在 app 關閉時不會推播，重要提醒建議再「加到行事曆」。':s==='denied'?'🔕 通知已被封鎖，可到設定開啟；或用「加到行事曆」。':s==='unsupported'?(isIOS&&!standalone?'📱 iPhone 請先用 Safari「分享 → 加入主畫面」，從主畫面打開後才能開啟通知（iOS 16.4 以上），且只在 app 開著時提醒。可用「加到行事曆」讓行事曆準時提醒。':'這個瀏覽器不支援通知，可用「加到行事曆」。'):'🔔 <button class="btn sm" id="askN">開啟通知</button> 打開 app 時提醒到期項目，或用「加到行事曆」。'; }
function render(){
  const v=$('v-care'), p=PC.pet();
  v.innerHTML=hdr('⏰','照護提醒','疫苗、驅蟲、用藥、換水…',S.pets.length?'<button class="btn sm" id="addRem">＋ 新增</button>':'')+`<div class="pad"><div class="info" id="ni">${notifInfo()}</div><div id="rl"></div></div>`;
  const b=$('askN'); if(b) b.onclick=async()=>{ await Notifier.request(); render(); checkDue(); };
  if(!S.pets.length){ $('rl').innerHTML=empty('⏰','先建立毛孩檔案，才能設定提醒。','<br><button class="btn" id="toP">前往建立</button>'); $('toP').onclick=()=>{PC.go('pets');PC.petForm();}; return; }
  $('addRem').onclick=()=>remForm();
  const sorted=[...S.reminders].sort((a,b)=>a.date.localeCompare(b.date));
  const g=[['⚠️ 逾期／今天',sorted.filter(r=>daysTo(r.date)<=0)],['📆 30 天內',sorted.filter(r=>daysTo(r.date)>0&&daysTo(r.date)<=30)],['🗓️ 之後',sorted.filter(r=>daysTo(r.date)>30)]];
  const row=r=>{ const pp=PC.pet(r.petId); const [cls,txt]=whenTxt(r);
    return `<div class="card"><div class="rem">${pp?ava(pp,44):''}<div class="t"><b>${esc(remTitle(r))}</b><div>${esc(pp?pp.name:'')}・${RTYPES[r.type].split(' ')[0]} ${r.every?`每 ${r.every} ${UNITS[r.unit]}`:'單次'}・${fmtW(r.date)}</div></div><span class="when ${cls}">${txt}</span></div>
    <div class="row"><button class="btn sm green" data-done="${r.id}">✓ 完成${r.every?'，排下一次':''}</button><button class="btn sm ghost" data-ics="${r.id}">📅 加到行事曆</button><button class="btn sm ghost" data-redit="${r.id}">✏️</button></div></div>`; };
  const done=S.actions.filter(a=>a.kind==='reminder_done').sort((a,b)=>b.at.localeCompare(a.at)).slice(0,5);
  $('rl').innerHTML=(S.reminders.length?g.filter(x=>x[1].length).map(([t,l])=>`<div class="sec">${t}（${l.length}）</div>`+l.map(row).join('')).join(''):empty('📋','還沒有提醒。點右上角「＋ 新增」。'))
   +(done.length?`<div class="sec">✅ 最近完成</div><div class="card">${done.map(a=>`<div class="list-item"><div class="grow"><b>${esc(a.title)}</b><div class="meta">${PC.fmtDT(a.at)}・${a.by===DB.me?'我':'家人'}</div></div></div>`).join('')}</div>`:'');
  $('rl').onclick=async e=>{ const b=e.target.closest('button'); if(!b) return; const r=S.reminders.find(x=>x.id===(b.dataset.done||b.dataset.ics||b.dataset.redit)); if(!r) return;
    if(b.dataset.done){ const a=await DB.logAction({kind:'reminder_done',petId:r.petId,refId:r.id,title:remLabel(r),dueDate:r.date}); S.actions.push(a);
      if(r.every){ let nd=addInterval(r.date,+r.every,r.unit); while(daysTo(nd)<0) nd=addInterval(nd,+r.every,r.unit); await save('reminders',{...r,date:nd,lastNotified:null}); } else await remove('reminders',r.id);
      syncNotifs(); render(); }
    if(b.dataset.ics) exportIcs(r);
    if(b.dataset.redit) remForm(r.id); };
}
function remForm(id){
  const p0=PC.pet(); const r=S.reminders.find(x=>x.id===id)||{petId:p0.id,type:'vaccine',date:today(),every:'',unit:'month'};
  const ex=pid=>{ const pp=PC.pet(pid); return sp(pp).reminderExamples; };
  openSheet(`<div class="shead"><h2>${id?'編輯提醒':'新增提醒'}</h2><button class="x" data-close>✕</button></div>
  <form id="rf"><div class="f"><label>毛孩</label><select name="petId">${S.pets.map(p=>`<option value="${p.id}"${p.id===r.petId?' selected':''}>${sp(p).i} ${esc(p.name)}</option>`).join('')}</select></div>
   <div class="f"><label>常見提醒範例（點一下帶入名稱）</label><div class="opt" id="exs"></div><div class="srcs">只是常見的照護項目範例，不代表你的毛孩一定需要；頻率請依獸醫或專業建議設定。</div></div>
   <div class="f"><label>類型</label><select name="type">${Object.entries(RTYPES).map(([k,v])=>`<option value="${k}"${r.type===k?' selected':''}>${v}</option>`).join('')}</select></div>
   <div class="f"><label>名稱</label><input name="title" maxlength="40" value="${esc(r.title)}" placeholder="例如：狂犬病疫苗"></div>
   <div class="f"><label>日期 *</label><input name="date" type="date" required value="${esc(r.date)}"></div>
   <div class="f2"><div class="f"><label>重複間隔</label><input name="every" type="number" min="1" max="99" inputmode="numeric" value="${esc(r.every)}" placeholder="不重複"></div><div class="f"><label>單位</label><select name="unit">${Object.entries(UNITS).map(([k,v])=>`<option value="${k}"${r.unit===k?' selected':''}>${v}</option>`).join('')}</select></div></div>
   <button class="btn full" type="submit">儲存提醒</button>${id?'<div class="row"><button type="button" class="btn ghost full" id="rdel" style="color:#e5484d">刪除提醒</button></div>':''}</form>`, box=>{
    const f=box.querySelector('#rf');
    const drawEx=()=>{ box.querySelector('#exs').innerHTML=ex(f.petId.value).map(t=>`<label><input type="button" data-ex="${esc(t)}"><span>${esc(t)}</span></label>`).join(''); };
    drawEx(); f.petId.onchange=drawEx;
    box.querySelector('#exs').onclick=e=>{ const b=e.target.closest('label'); if(!b) return; f.title.value=b.querySelector('input').dataset.ex; };
    f.onsubmit=async e=>{ e.preventDefault(); const fd=Object.fromEntries(new FormData(f));
      await save('reminders',{...r,petId:fd.petId,type:fd.type,title:fd.title.trim(),date:fd.date,every:fd.every?String(Math.max(1,parseInt(fd.every))):'',unit:fd.unit,lastNotified:r.date===fd.date?r.lastNotified:null});
      closeSheet(); syncNotifs(); PC.go('care'); checkDue(); };
    const d=box.querySelector('#rdel'); if(d) d.onclick=async()=>{ await remove('reminders',id); closeSheet(); syncNotifs(); render(); };
  });
}
function exportIcs(r){
  const d=r.date.replace(/-/g,''), nd=addInterval(r.date,1,'day').replace(/-/g,''); const freq={day:'DAILY',week:'WEEKLY',month:'MONTHLY',year:'YEARLY'}[r.unit];
  const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,''); const e=s=>s.replace(/[\\;,]/g,m=>'\\'+m).replace(/\n/g,'\\n');
  const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PetCare//v1//ZH-TW','BEGIN:VEVENT',`UID:${r.id}@petcare.local`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${d}`,`DTEND;VALUE=DATE:${nd}`,`SUMMARY:${e('🐾 '+remLabel(r))}`,...(r.every?[`RRULE:FREQ=${freq};INTERVAL=${r.every}`]:[]),'BEGIN:VALARM','ACTION:DISPLAY',`DESCRIPTION:${e(remLabel(r))}`,'TRIGGER:PT9H','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
  Share.download(new Blob([ics],{type:'text/calendar'}),`reminder-${r.date}.ics`); }
async function checkDue(){ if(Notifier.isNative()) return;
  for(const r of S.reminders){ if(daysTo(r.date)<=0&&r.lastNotified!==r.date){ const ok=await Notifier.show('🐾 照護提醒',remLabel(r)); if(ok){ r.lastNotified=r.date; await DB.put('reminders',r); } } } }
const syncNotifs=()=>Notifier.sync(S.reminders,remLabel);
PC.VIEWS.care=render;
Object.assign(PC,{checkDue,syncNotifs,remLabel});
})();
