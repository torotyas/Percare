<!-- © 2026 凱波工作室 Kaibo Studio -->
/* P1 health profile: multi-pet, multi-species, species-specific fields, medical records with attachments,
   and an append-only medication log (who gave which med when) to help avoid double dosing. */
(function(){
const PC=window.PC, {DB,SPECIES,S,$,esc,fmtD,fmtDT,age,sp,ava,hdr,empty,openSheet,closeSheet,field,save,remove,storeUpload,photoUrl,today}=PC;
const SEX=['未知','公','母'];
const KINDS={
 allergy:{n:'過敏',i:'⚠️',fields:[['title','過敏原 *','text',1],['reaction','反應','text'],['severity','嚴重程度','select',0,['','輕微','中等','嚴重']],['date','發現日期','date'],['notes','備註','area']]},
 condition:{n:'病史／長期狀況',i:'📋',fields:[['title','疾病或狀況 *','text',1],['date','診斷日期','date'],['status','目前狀態','select',0,['進行中','長期控制','已痊癒']],['notes','備註','area']]},
 vaccine:{n:'疫苗',i:'💉',fields:[['title','疫苗名稱 *','text',1],['date','施打日期 *','date',1],['nextDate','下次施打（依獸醫建議）','date'],['clinic','醫院','text'],['notes','備註','area']]},
 medication:{n:'用藥',i:'💊',fields:[['title','藥名 *','text',1],['dose','劑量','text'],['freq','頻率（依處方）','text'],['date','開始日期','date'],['endDate','結束日期','date'],['purpose','用途','text'],['prescribedBy','開立醫院／獸醫','text'],['notes','備註','area']]},
 visit:{n:'就醫紀錄',i:'🏥',fields:[['date','就診日期 *','date',1],['clinic','醫院','text'],['title','就診原因／症狀 *','text',1],['vetSays','獸醫說明（照獸醫原話記錄）','area'],['followUp','回診日期','date'],['amount','費用（元）','text'],['notes','備註','area']]},
 test:{n:'檢驗',i:'🧪',fields:[['date','檢驗日期 *','date',1],['title','檢驗項目 *','text',1],['result','結果摘要（照報告記錄）','area'],['notes','備註','area']]}
};
const ORDER=['allergy','medication','condition','vaccine','visit','test'];
const recs=(petId,kind)=>S.records.filter(r=>r.petId===petId&&(!kind||r.kind===kind)).sort((a,b)=>(b.date||b.createdAt).localeCompare(a.date||a.createdAt));
const medActive=r=>!r.endDate||r.endDate>=today();
const medLog=medId=>S.actions.filter(a=>a.kind==='med_given'&&a.refId===medId).sort((a,b)=>b.at.localeCompare(a.at));
let detailId=null;

function renderList(){
  const v=$('v-pets');
  if(detailId&&S.pets.find(p=>p.id===detailId)) return renderDetail(detailId);
  detailId=null;
  v.innerHTML=hdr('🐾','毛孩健康護照','每隻毛孩一本健康檔案','<button class="btn sm" id="addPet">＋ 新增</button>')+'<div class="pad" id="plist"></div>';
  $('addPet').onclick=()=>petForm();
  if(!S.pets.length){ $('plist').innerHTML=empty('🐾','還沒有毛孩檔案。<br>狗、貓、兔、鳥、倉鼠、天竺鼠、爬蟲、魚都可以建立，<br>先幫你家的寶貝（例如波比）建一本護照吧！','<br><button class="btn" id="emptyAdd">＋ 新增毛孩</button>'); $('emptyAdd').onclick=()=>petForm(); return; }
  $('plist').innerHTML=S.pets.map(p=>{ const al=recs(p.id,'allergy').length, meds=recs(p.id,'medication').filter(medActive).length;
    const due=S.reminders.filter(r=>r.petId===p.id&&PC.daysTo(r.date)<=7).length;
    return `<div class="card tap" data-open="${p.id}"><div class="pet">${ava(p)}<div style="flex:1;min-width:0"><div class="nm">${esc(p.name)}</div><div class="meta">${[sp(p).i+' '+sp(p).n,p.breed,age(p.birthday)].filter(Boolean).map(esc).join('・')}</div>
    <div style="margin-top:5px">${al?`<span class="badge red">過敏 ${al}</span>`:''}${meds?`<span class="badge warn">用藥中 ${meds}</span>`:''}${due?`<span class="badge">提醒 ${due}</span>`:''}</div></div><span style="font-size:20px;color:#9bb">›</span></div></div>`; }).join('');
  $('plist').onclick=async e=>{ const c=e.target.closest('[data-open]'); if(c){ detailId=c.dataset.open; await PC.setCur(detailId); renderDetail(detailId); window.scrollTo(0,0);} };
}
function attrRows(p){ return sp(p).profile.map(f=>p.attributes&&p.attributes[f.k]?`<dt>${esc(f.n)}</dt><dd>${esc(f.t==='date'?fmtD(p.attributes[f.k]):p.attributes[f.k])}</dd>`:'').join(''); }
function thumbs(ids){ if(!ids||!ids.length) return ''; return `<div class="thumbs">${ids.map(id=>`<button class="th" data-file="${id}">📎</button>`).join('')}</div>`; }
async function hydrateThumbs(root){ for(const b of root.querySelectorAll('[data-file]')){ const f=await DB.getFile(b.dataset.file); if(!f){ b.textContent='已刪除'; continue; } if(f.type.startsWith('image/')) b.innerHTML=`<img src="${await photoUrl(f.id)}" alt="">`; else b.textContent=(f.name||'文件').slice(0,14); } }
async function openFile(id){ const f=await DB.getFile(id); if(!f) return; const u=await photoUrl(id);
  if(f.type.startsWith('image/')) openSheet(`<div class="shead"><h2>${esc(f.name||'照片')}</h2><button class="x" data-close>✕</button></div><img src="${u}" style="width:100%;border-radius:12px">`);
  else window.PC.Platform_open?window.PC.Platform_open(u):window.open(u,'_blank'); }
function recLine(r){ const k=KINDS[r.kind]; let sub=[];
  if(r.kind==='allergy') sub=[r.reaction,r.severity];
  if(r.kind==='condition') sub=[r.status,r.date&&'診斷 '+fmtD(r.date)];
  if(r.kind==='vaccine') sub=[fmtD(r.date),r.nextDate&&'下次 '+fmtD(r.nextDate),r.clinic];
  if(r.kind==='medication') sub=[r.dose,r.freq,r.date&&fmtD(r.date)+' 起',r.endDate&&'到 '+fmtD(r.endDate)];
  if(r.kind==='visit') sub=[fmtD(r.date),r.clinic,r.amount&&'NT$'+r.amount,r.followUp&&'回診 '+fmtD(r.followUp)];
  if(r.kind==='test') sub=[fmtD(r.date),r.result];
  let extra='';
  if(r.kind==='medication'&&medActive(r)){ const log=medLog(r.id); const last=log[0];
    extra=`<div class="row" style="margin-top:6px"><button class="btn sm green" data-give="${r.id}">✓ 記錄給藥</button><span class="meta" style="align-self:center">${last?`上次：${fmtDT(last.at)}（${last.by===DB.me?'我':'家人'}）`:'尚無給藥紀錄'}</span></div>`; }
  return `<div class="list-item"><div class="grow"><b>${esc(r.title||k.n)}</b>${r.kind==='medication'&&!medActive(r)?' <span class="badge">已停藥</span>':''}<div class="meta">${sub.filter(Boolean).map(esc).join('・')}</div>${r.kind==='visit'&&r.vetSays?`<div class="note">${esc(r.vetSays)}</div>`:''}${thumbs(r.attachments)}${extra}</div><button class="btn sm ghost" data-edit="${r.id}">✏️</button></div>`; }
function renderDetail(id){
  const p=PC.pet(id), v=$('v-pets');
  v.innerHTML=hdr('',p.name,[sp(p).i+' '+sp(p).n,p.breed,age(p.birthday)].filter(Boolean).join('・'),`<button class="btn sm ghost" id="editPet">編輯</button>`,true)+`<div class="pad">
   <div class="card"><div class="pet">${ava(p,72)}<dl class="kv" style="flex:1;margin:0">${p.sex&&p.sex!=='未知'?`<dt>性別</dt><dd>${esc(p.sex)}</dd>`:''}${p.birthday?`<dt>生日</dt><dd>${fmtD(p.birthday)}</dd>`:''}${p.chip?`<dt>晶片</dt><dd>${esc(p.chip)}</dd>`:''}${attrRows(p)}</dl></div>
   ${p.notes?`<div class="note" style="margin-top:8px">${esc(p.notes)}</div>`:''}
   <div class="row"><button class="btn sm ghost" data-go="track">📈 每日紀錄</button><button class="btn sm ghost" data-go="passport">🪪 護照／QR</button><button class="btn sm ghost" data-go="summary">📄 就醫摘要</button></div></div>
   ${ORDER.map(k=>{ const list=recs(p.id,k); return `<div class="card"><div class="sec-h"><h3>${KINDS[k].i} ${KINDS[k].n}（${list.length}）</h3><button class="btn sm ghost" data-add="${k}">＋ 新增</button></div>${list.length?list.map(recLine).join(''):`<div class="meta">尚無紀錄</div>`}</div>`; }).join('')}
   <div class="srcs" style="text-align:center">資料只存在這支手機（IndexedDB）。家人共享與雲端備份將在之後的版本提供。</div></div>`;
  v.querySelector('[data-back]').onclick=()=>{ detailId=null; renderList(); };
  $('editPet').onclick=()=>petForm(p.id);
  v.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>recForm(b.dataset.add,null,p.id));
  v.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{ const r=S.records.find(x=>x.id===b.dataset.edit); recForm(r.kind,r.id,p.id); });
  v.querySelectorAll('[data-give]').forEach(b=>b.onclick=()=>giveMed(b.dataset.give));
  v.querySelectorAll('[data-file]').forEach(b=>b.onclick=()=>openFile(b.dataset.file));
  v.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{ if(b.dataset.go==='summary'){ PC.passportMode='vet'; PC.go('passport'); } else { if(b.dataset.go==='passport') PC.passportMode='public'; PC.go(b.dataset.go);} });
  hydrateThumbs(v);
}
async function giveMed(medId){
  const r=S.records.find(x=>x.id===medId); const last=medLog(medId)[0];
  if(last && new Date(last.at).toDateString()===new Date().toDateString()){
    if(!confirm(`「${r.title}」今天 ${fmtDT(last.at).split(' ')[1]} 已經記錄過給藥（${last.by===DB.me?'我':'家人'}）。\n確定要再記錄一次嗎？請先確認沒有重複給藥。`)) return; }
  const a=await DB.logAction({kind:'med_given',petId:r.petId,refId:medId,title:r.title,dose:r.dose||''}); S.actions.push(a); PC.rerender();
}
function petForm(id){
  const p=S.pets.find(x=>x.id===id)||{species:'dog',attributes:{}}; let photoFileId=p.photoFileId||null, newPhoto=null;
  const attrsHtml=sp=>SPECIES[sp].profile.map(f=>field(f,(p.species===sp&&p.attributes)?p.attributes[f.k]:'')).join('');
  openSheet(`<div class="shead"><h2>${id?'編輯毛孩':'新增毛孩'}</h2><button class="x" data-close>✕</button></div>
  <form id="pf">
   <div class="f photo-pick"><div id="pv">${ava(p,72)}</div><div><label class="btn sm ghost" for="ph">📷 選擇照片</label><input id="ph" type="file" accept="image/*" hidden></div></div>
   <div class="f"><label>名字 *</label><input name="name" required maxlength="30" value="${esc(p.name)}" placeholder="例如：波比"></div>
   <div class="f"><label>物種</label><select name="species">${Object.entries(SPECIES).map(([k,s])=>`<option value="${k}"${p.species===k?' selected':''}>${s.i} ${s.n}</option>`).join('')}</select></div>
   <div class="f2"><div class="f"><label>品種</label><input name="breed" maxlength="30" value="${esc(p.breed)}"></div><div class="f"><label>性別</label><select name="sex">${SEX.map(s=>`<option${p.sex===s?' selected':''}>${s}</option>`).join('')}</select></div></div>
   <div class="f2"><div class="f"><label>生日（可估計）</label><input name="birthday" type="date" value="${esc(p.birthday)}"></div><div class="f"><label>晶片號碼</label><input name="chip" maxlength="20" inputmode="numeric" value="${esc(p.chip)}"></div></div>
   <div id="attrs">${attrsHtml(p.species)}</div>
   <div class="f"><label>備註／外觀特徵</label><textarea name="notes" rows="2" maxlength="300">${esc(p.notes)}</textarea></div>
   <div class="srcs" style="margin:-4px 0 10px">體重請到「紀錄」記錄，會自動畫成趨勢圖。</div>
   <button class="btn full" type="submit">儲存</button>
   ${id?'<div class="row"><button type="button" class="btn ghost full" id="pdel" style="color:#e5484d">刪除這本護照</button></div>':''}
  </form>`, box=>{
    const f=box.querySelector('#pf');
    f.species.onchange=()=>{ box.querySelector('#attrs').innerHTML=attrsHtml(f.species.value); };
    box.querySelector('#ph').onchange=async e=>{ const file=e.target.files[0]; if(!file) return; try{ newPhoto=await PC.resizeImage(file,800,0.85); box.querySelector('#pv').innerHTML=`<div class="ava" style="width:72px;height:72px"><img src="${URL.createObjectURL(newPhoto)}"></div>`; }catch(err){ alert('無法讀取這張照片'); } };
    f.onsubmit=async e=>{ e.preventDefault(); const fd=Object.fromEntries(new FormData(f)); const attributes={};
      SPECIES[fd.species].profile.forEach(x=>{ const v=fd['a_'+x.k]; if(v) attributes[x.k]=v; });
      if(newPhoto){ if(photoFileId) await DB.delFile(photoFileId); photoFileId=await DB.putFile(newPhoto,{name:'photo.jpg',petId:p.id}); await photoUrl(photoFileId); }
      const rec=await save('pets',{...p,name:fd.name.trim(),species:fd.species,breed:fd.breed.trim(),sex:fd.sex,birthday:fd.birthday,chip:fd.chip.trim(),notes:fd.notes.trim(),attributes,photoFileId,templateVersion:1});
      await PC.setCur(rec.id); closeSheet(); PC.rerender(); };
    const d=box.querySelector('#pdel'); if(d) d.onclick=async()=>{ if(!confirm(`確定刪除「${p.name}」的護照與所有紀錄？`)) return; await remove('pets',id);
      for(const st of ['records','checkins','reminders']) for(const r of S[st].filter(x=>x.petId===id)) await remove(st,r.id);
      detailId=null; S.cur=S.pets[0]?S.pets[0].id:null; closeSheet(); PC.rerender(); };
  });
}
function recForm(kind,id,petId){
  const K=KINDS[kind], r=S.records.find(x=>x.id===id)||{kind,petId,attachments:[]}; let att=[...(r.attachments||[])]; const pending=[];
  const inp=([k,label,t,req,opts])=>{ const v=esc(r[k]); const rq=req?' required':'';
    if(t==='area') return `<div class="f"><label>${label}</label><textarea name="${k}" rows="3" maxlength="1000">${v}</textarea></div>`;
    if(t==='select') return `<div class="f"><label>${label}</label><select name="${k}">${opts.map(o=>`<option${r[k]===o?' selected':''}>${o}</option>`).join('')}</select></div>`;
    return `<div class="f"><label>${label}</label><input name="${k}" type="${t==='date'?'date':'text'}" maxlength="120" value="${v}"${rq}></div>`; };
  openSheet(`<div class="shead"><h2>${K.i} ${id?'編輯':'新增'}${K.n}</h2><button class="x" data-close>✕</button></div>
  <form id="rf">${K.fields.map(inp).join('')}
   <div class="f"><label>附件（照片、檢驗報告、收據、PDF）</label><label class="btn sm ghost" for="af">📎 加入檔案</label><input id="af" type="file" accept="image/*,application/pdf" multiple hidden><div class="thumbs" id="athumbs"></div></div>
   ${kind==='vaccine'?'<label class="check"><input type="checkbox" name="mkrem" checked><span>依「下次施打」日期建立提醒</span></label>':''}
   <button class="btn full" type="submit">儲存</button>
   ${id?'<div class="row"><button type="button" class="btn ghost full" id="rdel" style="color:#e5484d">刪除</button></div>':''}</form>`, box=>{
    const f=box.querySelector('#rf'), th=box.querySelector('#athumbs');
    const drawTh=async()=>{ th.innerHTML=att.map(a=>`<button type="button" class="th" data-file="${a}" title="點一下移除">📎</button>`).join('')+pending.map((p,i)=>`<button type="button" class="th" data-pend="${i}">${p.type.startsWith('image/')?`<img src="${URL.createObjectURL(p)}">`:esc(p.name.slice(0,12))}</button>`).join(''); await hydrateThumbs(th); };
    th.onclick=e=>{ const b=e.target.closest('button'); if(!b) return; if(!confirm('移除這個附件？')) return; if(b.dataset.file) att=att.filter(x=>x!==b.dataset.file); else pending.splice(+b.dataset.pend,1); drawTh(); };
    box.querySelector('#af').onchange=e=>{ pending.push(...e.target.files); e.target.value=''; drawTh(); };
    drawTh();
    f.onsubmit=async e=>{ e.preventDefault(); const fd=Object.fromEntries(new FormData(f));
      try{ for(const file of pending) att.push(await storeUpload(file,petId)); }catch(err){ alert('附件儲存失敗：'+err.message); return; }
      const removed=(r.attachments||[]).filter(x=>!att.includes(x)); for(const x of removed) await DB.delFile(x);
      const data={}; K.fields.forEach(([k])=>data[k]=(fd[k]||'').trim());
      const rec=await save('records',{...r,...data,kind,petId,attachments:att});
      if(kind==='vaccine'&&fd.mkrem&&rec.nextDate){ const ex=S.reminders.find(x=>x.sourceRecordId===rec.id);
        await save('reminders',{...(ex||{}),petId,type:'vaccine',title:rec.title,date:rec.nextDate,every:'',unit:'year',sourceRecordId:rec.id}); PC.syncNotifs&&PC.syncNotifs(); }
      closeSheet(); PC.rerender(); };
    const d=box.querySelector('#rdel'); if(d) d.onclick=async()=>{ if(!confirm('刪除這筆紀錄？')) return; await remove('records',id); closeSheet(); PC.rerender(); };
  });
}
PC.VIEWS.pets=renderList;
Object.assign(PC,{KINDS,recs,medActive,medLog,petForm,openPetDetail:id=>{detailId=id;PC.go('pets');}});
})();
