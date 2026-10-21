<!-- © 2026 凱波工作室 Kaibo Studio -->
/* 小幫手（phase 1 on-device micro-tools）. Everything runs on the phone: no API key, no backend, no data upload.
   1) 拍照辨識：Tesseract.js OCR (chi_tra+eng), lazy-loaded from CDN only when used → regex parse → editable form → save.
   2) 說一句記錄：Web Speech API (zh-TW) or typed text → rule parser → care check-ins / weight → preview → save.
   3) 看診前整理：facts from the last 3 months → printable / shareable page.
   4) 文字排提醒：「每3個月驅蟲」「下週三回診」→ reminders → preview → save.
   Parsers only extract what the owner wrote/photographed. They never judge health or give medical advice. */
(function(){
const PC=window.PC, {S,$,esc,fmtD,sp,openSheet,closeSheet,save,dstr,today}=PC;
const A=PC.AI={};
const pad=n=>String(n).padStart(2,'0');
const D=(y,m,d)=>{ const x=new Date(y,m-1,d); return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d?dstr(x):null; };
const addDays=(n,base)=>{ const d=base?new Date(base+'T00:00:00'):new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()+n); return dstr(d); };
const addIv=(n,u,base)=>{ const d=base?new Date(base+'T00:00:00'):new Date(); if(u==='day')d.setDate(d.getDate()+n); else if(u==='week')d.setDate(d.getDate()+7*n); else if(u==='month')d.setMonth(d.getMonth()+n); else d.setFullYear(d.getFullYear()+n); return dstr(d); };
const bare=s=>String(s||'').replace(/^[^\p{L}\p{N}]+/u,'').trim();

/* ---------- Chinese numerals → digits (only right before a unit, so 「一起」 stays) ---------- */
const CN={零:0,〇:0,一:1,二:2,兩:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
function cnInt(s){ if(/^\d+$/.test(s)) return +s; let n=0,cur=0; for(const ch of s){ if(ch in CN) cur=CN[ch]; else if(ch==='十'){ n+=(cur||1)*10; cur=0; } else if(ch==='百'){ n+=(cur||1)*100; cur=0; } } return n+cur; }
function cnNum(s){ const [i,f]=s.split('點'); const v=cnInt(i||'零'); return f?parseFloat(v+'.'+[...f].map(c=>CN[c]??c).join('')):v; }
const UNIT_AHEAD='(?=\\s*(?:公斤|公克|克|分鐘|分|小時|次|天|日|週|周|星期|禮拜|個月|月|年|碗|顆|錠|包|kg|g))';
const normNums=t=>String(t).replace(/[０-９．]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(new RegExp('([零〇一二兩三四五六七八九十百]+(?:點[零〇一二三四五六七八九]+)?)'+UNIT_AHEAD,'g'),m=>String(cnNum(m)));
A.normNums=normNums;

/* ---------- pets mentioned by name ---------- */
function petsIn(t){ const ps=S.pets.filter(p=>p.name&&t.includes(p.name)); return ps.length?ps:(PC.pet()?[PC.pet()]:[]); }
const stripPets=t=>S.pets.reduce((s,p)=>p.name?s.split(p.name).join(''):s,t);

/* ======================= 1) OCR ======================= */
const OCR_SRC='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
let ocrWorker=null;
const loadScript=src=>new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=()=>rej(new Error('load')); document.head.appendChild(s); });
async function ocr(blob,onProg){
  if(A.engine) return A.engine(blob,onProg);                     // test hook / future engine (e.g. native ML Kit or cloud AI)
  if(!ocrWorker){
    if(navigator.onLine===false) throw Object.assign(new Error('offline'),{offline:true});
    try{ if(!window.Tesseract) await loadScript(OCR_SRC);
      ocrWorker=await window.Tesseract.createWorker('chi_tra+eng',1,{logger:m=>onProg&&m.status&&onProg(m)}); }
    catch(e){ ocrWorker=null; throw Object.assign(new Error('offline'),{offline:true}); } }
  const r=await ocrWorker.recognize(blob); return r.data.text||''; }

/* dates: 2026/10/21, 2026-10-21, 2026年10月21日, 民國 115/10/21 (ROC), 10/21, 10月21日 */
function datesIn(line){ const out=[]; const t=normNums(line).replace(/\s+/g,'');
  const re=/(?:(\d{2,4})[\/\.\-年])?(\d{1,2})[\/\.\-月](\d{1,2})(?![\d])/g; let m;
  while((m=re.exec(t))){ let y=m[1]?+m[1]:null; if(y!=null&&y<1000) y+=1911; const mo=+m[2], d=+m[3];
    if(y==null){ if(!/月/.test(m[0])&&!/\//.test(m[0])) continue; y=new Date().getFullYear(); }
    const s=D(y,mo,d); if(s) out.push(s); }
  return out; }
const NEXT_KW=/回診|複診|覆診|下次|下回|預約|追蹤|next/i;
function parseOcr(raw){
  const text=normNums(String(raw||'').replace(/([\u3400-\u9fff：:])[ \t]+(?=[\u3400-\u9fff：:])/g,'$1').replace(/([\u3400-\u9fff])[ \t]+(?=[:：])/g,'$1').replace(/NTS/g,'NT$')).replace(/[|｜]/g,' ');
  const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const r={kind:'visit',title:'',date:'',nextDate:'',clinic:'',dose:'',freq:'',amount:'',raw:String(raw||'')};
  const sc={medication:0,vaccine:0,receipt:0};
  if(/疫苗|狂犬|[三四五六七八九十]合一|DHPP|DHLPP|FVRCP|FeLV|Rabies|vaccin/i.test(text)) sc.vaccine+=3;
  if(/藥袋|藥名|品名|用法|用量|錠|膠囊|mg|毫克|藥水|軟膏|滴劑|每日|一天|飯後|飯前|口服|外用/i.test(text)) sc.medication+=2;
  if(/收據|發票|明細|合計|總計|總額|金額|應收|實收|NT\$|元/i.test(text)) sc.receipt+=2;
  const best=Object.entries(sc).sort((a,b)=>b[1]-a[1])[0]; r.kind=best[1]>0?best[0]:'visit';
  for(const l of lines){ if(!r.clinic&&/動物醫院|動物診所|獸醫院|寵物醫院|獸醫診所|Animal|Vet/i.test(l)) r.clinic=l.replace(/^(醫院|院所|診所)\s*[:：]\s*/,'').slice(0,40); }
  // dates: the one on a "回診/下次" line is the next visit; the first other one is the record date
  lines.forEach((l,i)=>{ const ds=datesIn(l); if(!ds.length) return;
    if(NEXT_KW.test(l)||(r.kind==='vaccine'&&/下次|到期|有效/.test(l))){ if(!r.nextDate) r.nextDate=ds[ds.length-1]; }
    else if(!r.date) r.date=ds[0]; });
  if(!r.nextDate){ lines.forEach((l,i)=>{ if(!r.nextDate&&NEXT_KW.test(l)&&lines[i+1]){ const ds=datesIn(lines[i+1]); if(ds.length) r.nextDate=ds[0]; } }); }
  if(r.date&&r.nextDate&&r.date===r.nextDate) r.date='';
  // amount: labelled total first, else the biggest "NT$ / 元" number
  let am=text.match(/(?:合計|總計|總額|總金額|金額|應收|實收|應付|小計)\D{0,6}?([\d,]+(?:\.\d+)?)/);
  if(!am){ const all=[...text.matchAll(/(?:NT\$?|\$)\s*([\d,]+)|([\d,]+)\s*元/gi)].map(x=>+(x[1]||x[2]).replace(/,/g,'')).filter(n=>n>0); if(all.length) am=[0,String(Math.max(...all))]; }
  if(am) r.amount=String(am[1]).replace(/,/g,'');
  // drug / vaccine name
  const nameLine=r.kind==='vaccine'?lines.find(l=>/疫苗|狂犬|[三四五六七八九十]合一|DHPP|DHLPP|FVRCP|FeLV|Rabies/i.test(l)&&!NEXT_KW.test(l))
    :lines.find(l=>/藥名|品名|錠|膠囊|mg|毫克|藥水|軟膏|滴劑|ml/i.test(l)&&!/醫院|診所|電話|地址|日期/.test(l));
  if(nameLine){ let n=nameLine.replace(/^(藥名|品名|藥品名稱|疫苗名稱|名稱)\s*[:：]?\s*/,'').replace(/^[\u3400-\u9fff]{1,5}\s*[:：]\s*/,'');
    if(r.kind!=='vaccine') n=n.split(/\s+\d|\d+(?:\.\d+)?\s*(?:mg|毫克|ml|cc|錠|顆|粒)|每日|一天|用法/i)[0];
    r.title=n.replace(/[:：]\s*$/,'').trim().slice(0,40); }
  const dose=text.match(/(?:每次|一次)?\s*(\d+(?:\.\d+)?|半|1\/2|1\/4)\s*(mg|毫克|ml|cc|錠|顆|粒|包|滴)/i); if(dose) r.dose=dose[0].trim();
  const fq=text.match(/(?:每日|一天|一日)\s*\d\s*次|每\s*\d+\s*小時|每天\s*\d\s*次|\b(?:SID|BID|TID|QID|QD|Q12H|Q8H)\b/i); if(fq) r.freq=fq[0].replace(/\s+/g,'');
  if(r.kind==='receipt'&&!r.title) r.title='就醫收據';
  return r; }
A.parseOcr=parseOcr;

const KIND_OPTS=[['medication','💊 藥袋／用藥'],['vaccine','💉 疫苗卡'],['receipt','🧾 收據'],['visit','🏥 就醫／回診單']];
function ocrSheet(){ const p=PC.pet(); if(!p) return PC.go('pets');
  openSheet(`<div class="shead"><h2>📷 拍照辨識</h2><button class="x" data-close>✕</button></div>
   <div class="srcs">拍藥袋、疫苗卡、收據或回診單，自動幫你填表；儲存前都可以修改。辨識在手機上進行，照片不會上傳。</div>
   <label class="big-btn teal" style="cursor:pointer">📷 <span>拍照<small>對準文字、光線充足效果最好</small></span><input type="file" id="ocrCam" accept="image/*" capture="environment" hidden></label>
   <label class="big-btn orange" style="cursor:pointer">🖼️ <span>從相簿選<small>也可以選截圖</small></span><input type="file" id="ocrPick" accept="image/*" hidden></label>
   <button class="btn ghost full" id="ocrManual">✍️ 不拍照，直接手動填</button>`, box=>{
    const go=async e=>{ const f=e.target.files[0]; if(f) runOcr(f); };
    box.querySelector('#ocrCam').onchange=go; box.querySelector('#ocrPick').onchange=go;
    box.querySelector('#ocrManual').onclick=()=>ocrForm({kind:'medication'},null); }); }
async function runOcr(file){
  openSheet(`<div class="shead"><h2>辨識中…</h2><button class="x" data-close>✕</button></div><div class="ai-prog"><div class="bar"><i id="ocrBar"></i></div><div class="meta" id="ocrMsg">準備辨識模組…（第一次使用需下載約 15 MB，之後會快很多）</div></div>`);
  let blob=file; try{ blob=await PC.resizeImage(file,1800,0.9); }catch(e){}
  const msg=s=>{ const m=$('ocrMsg'); if(m) m.textContent=s; };
  try{ const txt=await ocr(blob,m=>{ const b=$('ocrBar'); if(b&&m.progress!=null) b.style.width=Math.round(m.progress*100)+'%'; msg(m.status==='recognizing text'?'辨識文字中…':'下載辨識模組中…'); });
    const r=parseOcr(txt); ocrForm(r,file,txt.trim()?'':'沒有辨識到文字，請手動填寫或重拍。'); }
  catch(e){ ocrForm({kind:'medication'},file,e.offline?'目前沒有網路，無法下載辨識模組。照片已保留，請先手動填寫，連上網路後再試拍照辨識。':'辨識失敗：'+(e.message||e)+'。請手動填寫。'); } }
function ocrForm(r,file,warn){ const p=PC.pet(); let kind=r.kind||'medication';
  const draw=()=>{ const k=kind==='receipt'?'visit':kind, K=PC.KINDS[k];
    const val=key=>key==='date'?(r.date||today()):key==='title'&&kind==='receipt'&&!r.title?'就醫收據':key==='followUp'?r.nextDate:key==='nextDate'?r.nextDate:key==='prescribedBy'?r.clinic:key==='notes'?[r.amount&&kind!=='receipt'&&k!=='visit'?'金額 NT$'+r.amount:''].filter(Boolean).join(''):r[key];
    const inp=([key,label,t,req,opts])=>{ const v=esc(val(key)||'');
      if(t==='area') return `<div class="f"><label>${label}</label><textarea name="${key}" rows="2" maxlength="1000">${v}</textarea></div>`;
      if(t==='select') return `<div class="f"><label>${label}</label><select name="${key}">${opts.map(o=>`<option>${o}</option>`).join('')}</select></div>`;
      return `<div class="f"><label>${label}</label><input name="${key}" type="${t==='date'?'date':'text'}" maxlength="120" value="${v}"${req?' required':''}></div>`; };
    const nd=r.nextDate;
    openSheet(`<div class="shead"><h2>確認內容</h2><button class="x" data-close>✕</button></div>
     ${warn?`<div class="info">${esc(warn)}</div>`:'<div class="info">✨ 已自動填入，請核對後再儲存（辨識可能有錯字）。</div>'}
     <form id="of"><div class="f"><label>毛孩</label><select name="petId">${S.pets.map(x=>`<option value="${x.id}"${x.id===p.id?' selected':''}>${sp(x).i} ${esc(x.name)}</option>`).join('')}</select></div>
     <div class="f"><label>這是什麼</label><div class="opt">${KIND_OPTS.map(([v,l])=>`<label><input type="radio" name="kind" value="${v}"${v===kind?' checked':''}><span>${l}</span></label>`).join('')}</div></div>
     ${K.fields.map(inp).join('')}
     ${k!=='medication'||nd?`<label class="check"><input type="checkbox" name="mkrem"${nd?' checked':''}><span>依「${k==='vaccine'?'下次施打':'回診日期'}」建立提醒</span></label>${k==='medication'&&nd?`<div class="srcs">回診日：${fmtD(nd)}</div>`:''}`:''}
     ${file?'<label class="check"><input type="checkbox" name="keep" checked><span>把照片存成附件</span></label>':''}
     ${r.raw?`<details class="raw"><summary>辨識出的原始文字</summary><pre>${esc(r.raw)}</pre></details>`:''}
     <button class="btn full">✓ 確認儲存</button></form>`, box=>{
      const f=box.querySelector('#of');
      f.querySelectorAll('[name=kind]').forEach(x=>x.onchange=()=>{ // keep typed values when switching type
        const fd=Object.fromEntries(new FormData(f)); Object.assign(r,{title:fd.title??r.title,date:fd.date??r.date,nextDate:fd.nextDate||fd.followUp||r.nextDate,clinic:fd.clinic||fd.prescribedBy||r.clinic,amount:fd.amount??r.amount,dose:fd.dose??r.dose,freq:fd.freq??r.freq}); kind=x.value; draw(); });
      f.onsubmit=async e=>{ e.preventDefault(); const fd=Object.fromEntries(new FormData(f)); const data={};
        K.fields.forEach(([key])=>data[key]=(fd[key]||'').trim());
        if(kind==='receipt') data.receipt=true;
        const att=[]; if(file&&fd.keep){ try{ att.push(await PC.storeUpload(file,fd.petId)); }catch(err){} }
        const rec=await save('records',{...data,kind:k,petId:fd.petId,attachments:att,source:'ocr'});
        let rem=null; const due=k==='vaccine'?rec.nextDate:k==='medication'?r.nextDate:rec.followUp;
        if(fd.mkrem&&due){ rem=await save('reminders',{petId:fd.petId,type:k==='vaccine'?'vaccine':'checkup',title:k==='vaccine'?rec.title:`回診${(rec.clinic||rec.prescribedBy)?'（'+(rec.clinic||rec.prescribedBy)+'）':''}`,date:due,every:'',unit:'month',sourceRecordId:rec.id}); PC.syncNotifs(); }
        closeSheet(); PC.rerender(); toast(`✅ 已存到「${PC.KINDS[k].n}」${rem?'・已建立提醒':''}`); }; }); };
  draw(); }

/* ======================= 2) 語音快速記錄 ======================= */
const EAT=/吃|餵|飯|飼料|罐頭|零食/, DRINK=/喝水|喝了/;
function parseVoice(raw){
  const text=normNums(String(raw||'')).trim(); const pets=petsIn(text); const out=[];
  const segs=stripPets(text).split(/[，,、。；;！!？?\n]|然後|還有|並且|而且|另外/).map(s=>s.replace(/^(今天|剛剛|剛才|早上|中午|下午|晚上|今早|今晚|有|也|又|都|已經|幫他|幫她|幫牠|帶他|帶她|帶牠|\s)+/,'').trim()).filter(Boolean);
  for(const seg of segs){
    const w=seg.match(/(?:體重|秤重|重)\s*(?:是|為|有|約)?\s*(\d+(?:\.\d+)?)\s*(公斤|公克|克|kg|g)?/i)||seg.match(/(\d+(?:\.\d+)?)\s*(公斤|kg)/i);
    if(w){ out.push({type:'weight',value:+w[1],unit:/公克|克|^g$/i.test(w[2]||'')?'g':(w[2]?'kg':''),text:seg}); continue; }
    for(const p of pets){ const its=PC.careItems(p); let it=its.find(x=>bare(x.name)&&seg.includes(bare(x.name)));
      if(!it&&/遛狗|遛/.test(seg)) it=its.find(x=>/散步/.test(x.name));
      if(!it&&EAT.test(seg)) it=its.find(x=>/餵食/.test(x.name))||{id:'v-eat',name:'🍚 吃飯'};
      if(!it&&DRINK.test(seg)) it=its.find(x=>/換水|喝水/.test(x.name))||{id:'v-drink',name:'💧 喝水'};
      if(it){ const note=seg===bare(it.name)?'':seg; const ex=out.find(o=>o.type==='care'&&o.itemName===it.name&&o.text===seg);
        if(!ex) out.push({type:'care',itemId:it.id,itemName:it.name,note,text:seg}); }
      else if(!out.find(o=>o.type==='note'&&o.text===seg)) out.push({type:'note',text:seg}); } }
  return {pets,items:out}; }
A.parseVoice=parseVoice;
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function voiceSheet(prefill){ if(!PC.pet()) return PC.go('pets');
  openSheet(`<div class="shead"><h2>🎙️ 說一句記錄</h2><button class="x" data-close>✕</button></div>
   <div class="srcs">例如：「波比今天吃了半碗、散步30分鐘、體重3.2公斤、刷牙」。會先給你看結果，確認後才儲存。</div>
   ${SR?'<button class="mic" id="micBtn">🎙️<small>按一下開始說</small></button>':'<div class="info">這個瀏覽器不支援語音辨識，可以直接打字，或用鍵盤上的🎤麥克風輸入。</div>'}
   <div class="f"><label>內容</label><textarea id="vTxt" rows="3" maxlength="300" placeholder="波比今天吃了半碗、散步30分鐘、刷牙">${esc(prefill||'')}</textarea></div>
   <button class="btn full" id="vGo">看看會記錄什麼</button><div id="vPrev"></div>`, box=>{
    const ta=box.querySelector('#vTxt'), mic=box.querySelector('#micBtn');
    if(mic){ let rec=null; mic.onclick=()=>{ if(rec){ rec.stop(); return; }
      try{ rec=new SR(); }catch(e){ return; } rec.lang='zh-TW'; rec.interimResults=true; rec.continuous=false; const base=ta.value?ta.value+'，':'';
      rec.onresult=ev=>{ ta.value=base+[...ev.results].map(r=>r[0].transcript).join(''); };
      rec.onerror=ev=>{ mic.querySelector('small').textContent=ev.error==='not-allowed'?'沒有麥克風權限，請改用打字':ev.error==='network'?'語音辨識需要網路，請改用打字':'沒聽清楚，再試一次'; };
      rec.onend=()=>{ rec=null; mic.classList.remove('on'); if(!/權限|網路|再試/.test(mic.querySelector('small').textContent)) mic.querySelector('small').textContent='按一下開始說'; if(ta.value.trim()) preview(); };
      mic.classList.add('on'); mic.querySelector('small').textContent='聆聽中…再按一下結束'; rec.start(); }; }
    const preview=()=>{ const res=parseVoice(ta.value); const pv=box.querySelector('#vPrev');
      if(!res.items.length){ pv.innerHTML='<div class="meta" style="margin-top:10px">沒有找到可以記錄的項目。試試「刷牙」「散步30分鐘」「體重3.2公斤」。</div>'; return; }
      const names=res.pets.map(p=>esc(p.name)).join('、');
      const wu=p=>{ const m=sp(p).checkin.find(m=>m.k==='weight'); return m?m.unit:null; };
      pv.innerHTML=`<div class="sec">將記錄給：${names}</div><div class="card">${res.items.map((it,i)=>`<label class="check"><input type="checkbox" data-i="${i}"${it.type==='note'?'':' checked'}><span>${it.type==='weight'?`⚖️ 體重 ${it.value} ${it.unit||wu(res.pets[0])||''}`:it.type==='care'?`✅ ${esc(it.itemName)}${it.note?`<div class="sub">備註：${esc(it.note)}</div>`:''}`:`📝 備註<div class="sub">${esc(it.text)}</div>`}</span></label>`).join('')}</div>
       <button class="btn full" id="vSave">✓ 確認記錄</button>`;
      pv.querySelector('#vSave').onclick=async()=>{ const pick=[...pv.querySelectorAll('[data-i]')].filter(x=>x.checked).map(x=>res.items[+x.dataset.i]); let n=0;
        for(const p of res.pets) for(const it of pick){
          if(it.type==='weight'){ const u=wu(p); if(!u) continue; let v=it.value; if(it.unit==='kg'&&u==='g') v=Math.round(v*1000); if(it.unit==='g'&&u==='kg') v=Math.round(v)/1000; await save('checkins',{petId:p.id,at:new Date().toISOString(),metrics:{weight:v},note:'',source:'voice'}); n++; }
          else if(it.type==='care'){ const its=PC.careItems(p); const own=its.find(x=>bare(x.name)===bare(it.itemName))||{id:it.itemId,name:it.itemName}; await PC.careCheckIn([p],own,it.note); n++; }
          else { await save('carelogs',{petId:p.id,itemId:'v-note',name:'📝 備註',at:new Date().toISOString(),note:it.text}); n++; } }
        closeSheet(); PC.rerender(); toast(`✅ 已記錄 ${n} 筆`); }; };
    box.querySelector('#vGo').onclick=preview; if(prefill) preview(); }); }

/* ======================= 3) 看診前整理 ======================= */
function summaryText(p){ const d=PC.summaryData(p); const L=[`【${p.name} 看診前整理】`,`期間：${fmtD(dstr(d.since))} – ${fmtD(today())}`,''];
  d.sec.forEach(s=>{ L.push('■ '+s.t); (s.kv||[]).forEach(([k,v])=>L.push(`${k}：${v}`)); (s.lines||[]).forEach(l=>L.push('・'+l)); L.push(''); });
  L.push('以上為飼主自行記錄的資料，僅供獸醫參考，不是診斷。'); return L.join('\n'); }
A.summaryText=summaryText;
function vetSheet(){ const p=PC.pet(); if(!p) return PC.go('pets');
  openSheet(`<div class="shead"><h2>🩺 看診前整理</h2><button class="x" data-close>✕</button></div>
   <div class="row no-print"><button class="btn sm" id="vsShare">📤 分享</button><button class="btn sm ghost" id="vsPrint">🖨️ 列印</button><button class="btn sm ghost" id="vsPdf">📄 PDF</button></div>
   <div id="vsBody" class="print-area"><h2 class="print-only">${esc(p.name)} 看診前整理</h2></div>`, box=>{
    PC.renderVetMode(p,box.querySelector('#vsBody')); const b=box.querySelector('#vsBody');
    b.insertAdjacentHTML('afterbegin',`<h2 class="print-only">${esc(p.name)} 看診前整理（${fmtD(dstr(PC.daysAgo(90)))} – ${fmtD(today())}）</h2>`);
    const pb=b.querySelector('#pdfBtn'); if(pb) pb.closest('.row').classList.add('no-print');
    box.querySelector('#vsPdf').onclick=()=>pb&&pb.click();
    box.querySelector('#vsPrint').onclick=()=>{ if(window.Platform.isNative()){ pb&&pb.click(); return; } document.body.classList.add('printing'); window.print(); setTimeout(()=>document.body.classList.remove('printing'),500); };
    box.querySelector('#vsShare').onclick=async()=>{ const t=summaryText(p), sh=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Share;
      try{ if(window.Platform.isNative()&&sh){ await sh.share({title:p.name+' 看診前整理',text:t}); return; }
        if(navigator.share){ await navigator.share({title:p.name+' 看診前整理',text:t}); return; }
        await navigator.clipboard.writeText(t); toast('已複製文字，可以貼到 LINE 給醫院'); }
      catch(e){ if(e&&e.name==='AbortError') return; window.Platform.Share.download(new Blob([t],{type:'text/plain'}),`看診前整理-${p.name}-${today()}.txt`); } }; }); }

/* ======================= 4) 文字排提醒 ======================= */
const UNIT={天:'day',日:'day',週:'week',周:'week',星期:'week',禮拜:'week',個月:'month',月:'month',年:'year'};
const WD={一:1,二:2,三:3,四:4,五:5,六:6,日:0,天:0};
function typeOf(t){ return /疫苗|狂犬|合一/.test(t)?'vaccine':/心絲蟲/.test(t)?'heartworm':/驅蟲|除蚤|蚤|壁蝨/.test(t)?'deworm':/藥/.test(t)?'med':/回診|複診|檢查|健檢|看醫生|看診|抽血|洗牙/.test(t)?'checkup':/美容|剪指甲|洗澡|剃毛|修毛/.test(t)?'groom':/換水|清潔|清籠|換墊料|清貓砂|清濾/.test(t)?'habitat':'custom'; }
function weekday(prefix,w,base){ const d=base?new Date(base+'T00:00:00'):new Date(); d.setHours(0,0,0,0); const dow=(d.getDay()+6)%7; const mon=new Date(d); mon.setDate(d.getDate()-dow);
  const wk=prefix==='下下'?2:prefix==='下'?1:0; const tgt=(WD[w]+6)%7; const r=new Date(mon); r.setDate(mon.getDate()+wk*7+tgt);
  if(!prefix&&r<d) r.setDate(r.getDate()+7); return dstr(r); }
function parseSchedule(raw,base){
  const text=normNums(String(raw||'')); const out=[];
  for(let seg of text.split(/[，,；;。\n]|然後|還有/).map(s=>s.trim()).filter(Boolean)){
    const pets=petsIn(seg); let s=stripPets(seg), date='', every='', unit='month', m;
    if((m=s.match(/每\s*(\d+|半)?\s*(個月|星期|禮拜|天|日|週|周|月|年)/))){ if(m[1]==='半'){ every=m[2]==='年'?'6':'1'; unit=m[2]==='年'?'month':UNIT[m[2]]; } else { every=String(m[1]?+m[1]:1); unit=UNIT[m[2]]; } s=s.replace(m[0],' '); }
    if((m=s.match(/(下下|下|這|本)?\s*(?:週|周|星期|禮拜)\s*([一二三四五六日天])/))){ date=weekday(m[1]==='下下'||m[1]==='下'?m[1]:'',m[2],base); s=s.replace(m[0],' '); }
    else if((m=s.match(/大後天|後天|明天|今天/))){ date=addDays({今天:0,明天:1,後天:2,大後天:3}[m[0]],base); s=s.replace(m[0],' '); }
    else if((m=s.match(/(\d+)\s*(個月|星期|禮拜|天|日|週|周|年)\s*後/))){ date=addIv(+m[1],UNIT[m[2]],base); s=s.replace(m[0],' '); }
    else if((m=s.match(/下個?月\s*(\d{1,2})\s*[號日]/))){ const d=base?new Date(base+'T00:00:00'):new Date(); date=D(d.getMonth()===11?d.getFullYear()+1:d.getFullYear(),(d.getMonth()+1)%12+1,+m[1])||''; s=s.replace(m[0],' '); }
    else if((m=s.match(/(?:(\d{2,4})\s*[\/\-年.])?\s*(\d{1,2})\s*[\/月.]\s*(\d{1,2})\s*[日號]?/))){ let y=m[1]?+m[1]:null; if(y&&y<1000) y+=1911; const b=base||today(); if(!y){ y=+b.slice(0,4); if(D(y,+m[2],+m[3])<b) y++; } date=D(y,+m[2],+m[3])||''; s=s.replace(m[0],' '); }
    let title=s.replace(/提醒我?|記得|要|去|帶|一次|的時候|時候|那天|之後|再/g,' ').replace(/\s+/g,'').replace(/^[的在]+|[的了]+$/g,'');
    if(!title) continue;
    if(!date) date=every?addIv(+every,unit,base):(base||today());
    const type=typeOf(title); if(/^打?疫苗$/.test(title)) title='疫苗'; 
    for(const p of pets) out.push({petId:p.id,type,title,date,every,unit,text:seg}); }
  return out; }
A.parseSchedule=parseSchedule;
function schedSheet(prefill){ if(!PC.pet()) return PC.go('pets');
  const U={day:'天',week:'週',month:'個月',year:'年'};
  openSheet(`<div class="shead"><h2>⏰ 一句話排提醒</h2><button class="x" data-close>✕</button></div>
   <div class="srcs">例如：「每3個月驅蟲」「下週三回診」「每年打疫苗」「10/30 剪指甲」，可以一次打好幾句。頻率請依獸醫建議。</div>
   <div class="f"><textarea id="sTxt" rows="3" maxlength="300" placeholder="每3個月驅蟲，下週三回診">${esc(prefill||'')}</textarea></div>
   ${SR?'<button class="btn sm ghost" id="sMic">🎙️ 用說的</button> ':''}<button class="btn" id="sGo">排排看</button><div id="sPrev"></div>`, box=>{
    const ta=box.querySelector('#sTxt'), pv=box.querySelector('#sPrev');
    const sm=box.querySelector('#sMic'); if(sm) sm.onclick=()=>{ const r=new SR(); r.lang='zh-TW'; r.onresult=e=>{ ta.value=(ta.value?ta.value+'，':'')+e.results[0][0].transcript; preview(); }; r.start(); };
    const preview=()=>{ const L=parseSchedule(ta.value);
      if(!L.length){ pv.innerHTML='<div class="meta" style="margin-top:10px">看不懂這句，試試「每3個月驅蟲」或「下週三回診」。</div>'; return; }
      pv.innerHTML=`<div class="sec">預覽（可修改）</div>${L.map((r,i)=>{ const p=PC.pet(r.petId); return `<div class="card" data-i="${i}"><label class="check"><input type="checkbox" class="on" checked><span><b>${esc(p.name)}</b>・${PC.RTYPES[r.type]}</span></label>
        <div class="f2"><div class="f"><label>名稱</label><input class="ti" maxlength="40" value="${esc(r.title)}"></div><div class="f"><label>日期</label><input class="da" type="date" value="${r.date}"></div></div>
        <div class="f2"><div class="f"><label>每隔</label><input class="ev" type="number" min="1" max="99" inputmode="numeric" placeholder="不重複" value="${esc(r.every)}"></div><div class="f"><label>單位</label><select class="un">${Object.entries(U).map(([k,v])=>`<option value="${k}"${k===r.unit?' selected':''}>${v}</option>`).join('')}</select></div></div></div>`; }).join('')}
       <button class="btn full" id="sSave">✓ 建立提醒</button>`;
      pv.querySelector('#sSave').onclick=async()=>{ let n=0; for(const c of pv.querySelectorAll('[data-i]')){ if(!c.querySelector('.on').checked) continue; const r=L[+c.dataset.i];
          const da=c.querySelector('.da').value; if(!da) continue; const ev=c.querySelector('.ev').value;
          await save('reminders',{petId:r.petId,type:r.type,title:c.querySelector('.ti').value.trim(),date:da,every:ev?String(Math.max(1,parseInt(ev))):'',unit:c.querySelector('.un').value,lastNotified:null,source:'text'}); n++; }
        PC.syncNotifs(); closeSheet(); PC.rerender(); toast(`⏰ 已建立 ${n} 個提醒`); }; };
    box.querySelector('#sGo').onclick=preview; if(prefill) preview(); }); }

/* ---------- shared toast + home entry ---------- */
let tT; function toast(h){ let t=$('toast'); if(!t){ t=document.createElement('div'); t.id='toast'; t.className='toast'; document.body.appendChild(t); } t.innerHTML=h; t.classList.add('on'); clearTimeout(tT); tT=setTimeout(()=>t.classList.remove('on'),4000); }
A.toolsHtml=()=>`<div class="sec">✨ 小幫手</div><div class="tools">
  <button data-tool="ocr"><i>📷</i>拍照辨識<small>藥袋・疫苗卡・收據</small></button>
  <button data-tool="voice"><i>🎙️</i>說一句記錄<small>吃飯・散步・體重</small></button>
  <button data-tool="vet"><i>🩺</i>看診前整理<small>近 3 個月一頁看完</small></button>
  <button data-tool="sched"><i>⏰</i>一句話排提醒<small>每3個月驅蟲…</small></button></div>`;
A.bind=root=>root.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>({ocr:ocrSheet,voice:()=>voiceSheet(),vet:vetSheet,sched:()=>schedSheet()})[b.dataset.tool]());
Object.assign(A,{ocrSheet,ocrForm,voiceSheet,vetSheet,schedSheet,runOcr});
})();
