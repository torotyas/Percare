/* 寵物護照 (pet passport), the central screen.
   - 走失模式 / public info (default for the collar tag): ONLY the fields the owner ticks. Full medical history is never
     included by default.
   - 就醫模式 (for vets): full 3-month summary on the owner's phone, or exported as PDF (summary.js).
   v1 (no backend): the collar QR encodes the selected public info as PLAIN TEXT, so any phone camera can read it without
   the app. Limitation: printed text can't be updated or revoked; reprint after changes.
   v2 (with backend): the QR switches to a short URL like https://<domain>/p/<id> → live public profile that the owner
   controls and can revoke (passport_links table), plus an expiring vet-access link (mode='vet', expires_at). */
(function(){
const PC=window.PC, {S,$,esc,sp,hdr,empty,save,ava,petBar,bindPetBar,openSheet,closeSheet}=PC;
const {Share}=window.Platform;
qrcode.stringToBytes=qrcode.stringToBytesFuncs['UTF-8'];
const FIELDS=[
 ['name','名字',true,''],['species','物種／品種',true,''],['lostMsg','「我走失了，請打電話給我的家人」',true,''],['phone','主人電話',true,'需填寫下方電話'],
 ['ownerName','主人稱呼',false,''],['allergies','緊急過敏',false,'取自健康檔案的過敏紀錄'],['meds','必要用藥',false,'取自目前用藥'],['chip','晶片號碼',false,'可選；拾獲者可請醫院掃描']];
const defaults=()=>({fields:Object.fromEntries(FIELDS.map(f=>[f[0],f[2]])),phone:'',ownerName:'',msg:'我走失了，請打電話給我的家人'});
const pp=p=>{ const d=defaults(), x=p.passport||{}; return {...d,...x,fields:{...d.fields,...(x.fields||{})}}; };
function qrText(p){ const c=pp(p), F=c.fields, L=['【寵物護照】'];
  if(F.name) L.push(p.name);
  if(F.species) L.push([sp(p).n,p.breed].filter(Boolean).join('・'));
  if(F.lostMsg) L.push(c.msg||defaults().msg);
  if(F.phone&&c.phone) L.push('電話：'+c.phone+(F.ownerName&&c.ownerName?'（'+c.ownerName+'）':''));
  else if(F.ownerName&&c.ownerName) L.push('主人：'+c.ownerName);
  if(F.allergies){ const a=PC.recs(p.id,'allergy').map(r=>r.title+(r.severity==='嚴重'?'（嚴重）':'')); if(a.length) L.push('過敏：'+a.join('、')); }
  if(F.meds){ const m=PC.recs(p.id,'medication').filter(PC.medActive).map(r=>[r.title,r.dose,r.freq].filter(Boolean).join(' ')); if(m.length) L.push('必要用藥：'+m.join('；')); }
  if(F.chip&&p.chip) L.push('晶片：'+p.chip);
  return L.join('\n'); }
const bytes=s=>new TextEncoder().encode(s).length;
function makeQR(text){ const q=qrcode(0,'M'); q.addData(text,'Byte'); q.make(); return q; }
function drawQR(canvas,q,px){ const n=q.getModuleCount(), quiet=4, size=(n+quiet*2)*px; canvas.width=canvas.height=size; const x=canvas.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,size,size); x.fillStyle='#000';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(q.isDark(r,c)) x.fillRect((c+quiet)*px,(r+quiet)*px,px,px); }
function sizeWarn(b,n){ if(b>400) return `<div class="note-neutral" style="background:#ffe3e3;color:#a61e1e">⚠️ 內容太長（${b} 位元組，QR ${n}×${n} 格），小吊牌很可能掃不到。請減少勾選項目或縮短文字。</div>`;
  if(b>200) return `<div class="note-neutral" style="background:#fff3bf;color:#7a5600">⚠️ 內容偏長（${b} 位元組，QR ${n}×${n} 格）。建議精簡，或把吊牌印大一點並實際用手機測試能否掃描。</div>`;
  return `<div class="srcs">QR 內容 ${b} 位元組（${n}×${n} 格）。印出後請先用手機相機實測。</div>`; }
const FONT='"PingFang TC","Noto Sans CJK TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
function tagCanvas(p){ const q=makeQR(qrText(p)), W=720, H=900, c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  x.fillStyle='#fff'; x.fillRect(0,0,W,H); x.strokeStyle='#2f9e8f'; x.lineWidth=14; x.strokeRect(7,7,W-14,H-14);
  x.fillStyle='#2f9e8f'; x.fillRect(7,7,W-14,150); x.fillStyle='#fff'; x.textAlign='center'; x.font=`900 76px ${FONT}`; x.fillText(p.name,W/2,108);
  const qc=document.createElement('canvas'); const n=q.getModuleCount(); const px=Math.max(2,Math.floor(560/(n+8))); drawQR(qc,q,px);
  const s=qc.width; x.imageSmoothingEnabled=false; x.drawImage(qc,(W-s)/2,180+(560-s)/2);
  x.fillStyle='#2d3b38'; x.font=`700 40px ${FONT}`; x.fillText('用手機相機掃描',W/2,800); x.font=`500 30px ${FONT}`; x.fillStyle='#6f817d'; x.fillText('Scan me・寵物護照',W/2,850);
  return c; }
const blobOf=c=>new Promise(r=>c.toBlob(r,'image/png'));
let mode='public';
function render(){
  const v=$('v-passport'), p=PC.pet(); if(PC.passportMode){ mode=PC.passportMode; PC.passportMode=null; }
  v.innerHTML=hdr('🪪','寵物護照','項圈 QR・就醫摘要')+petBar()+'<div class="pad" id="pp"></div>'; bindPetBar(v,render);
  if(!p){ $('pp').innerHTML=empty('🪪','先建立毛孩檔案，才能製作護照與項圈 QR。','<br><button class="btn" id="toP">前往建立</button>'); $('toP').onclick=()=>{PC.go('pets');PC.petForm();}; return; }
  const seg=`<div class="seg" style="margin-bottom:12px">${[['public','🏷️ 走失模式（公開）'],['vet','🩺 就醫模式']].map(([k,l])=>`<button data-m="${k}" class="${mode===k?'on':''}" style="flex:1">${l}</button>`).join('')}</div>`;
  $('pp').innerHTML=`<div class="card"><div class="pet">${ava(p,64)}<div><div class="nm">${esc(p.name)}</div><div class="meta">${sp(p).i} ${esc([sp(p).n,p.breed,PC.age(p.birthday)].filter(Boolean).join('・'))}</div></div></div></div>${seg}<div id="pm"></div>`;
  v.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ mode=b.dataset.m; render(); });
  mode==='public'?renderPublic(p):PC.renderVetMode(p,$('pm'));
}
function renderPublic(p){
  const c=pp(p), text=qrText(p), q=makeQR(text), n=q.getModuleCount(), b=bytes(text);
  $('pm').innerHTML=`<div class="info">🔒 項圈上的 QR 任何人都掃得到，只放你勾選的資訊。<b>完整病史預設不會放進去。</b>電話公開前請想清楚。</div>
  <div class="card"><h3 style="font-size:15px;margin-bottom:4px">要公開的資訊</h3>
   ${FIELDS.map(([k,l,,sub])=>`<label class="check"><input type="checkbox" data-fk="${k}"${c.fields[k]?' checked':''}><span>${esc(l)}${sub?`<div class="sub">${esc(sub)}</div>`:''}</span></label>`).join('')}
   <div class="f2" style="margin-top:8px"><div class="f"><label>主人電話</label><input id="ppPhone" type="tel" maxlength="20" value="${esc(c.phone)}" placeholder="09xx-xxx-xxx"></div><div class="f"><label>主人稱呼</label><input id="ppOwner" maxlength="12" value="${esc(c.ownerName)}" placeholder="例如：Kai"></div></div>
   <div class="f"><label>走失訊息</label><input id="ppMsg" maxlength="40" value="${esc(c.msg)}"></div></div>
  <div class="card qrbox"><canvas id="qrc"></canvas>${sizeWarn(b,n)}<div class="qrtext">${esc(text)}</div>
   <div class="row" style="justify-content:center"><button class="btn" id="dlTag">⬇️ 下載吊牌圖</button><button class="btn ghost" id="shTag">📤 分享</button><button class="btn ghost" id="poster">🆘 協尋海報</button></div>
   <div class="srcs">這一版 QR 是純文字（不需安裝 app、不需網路）。印出後無法遠端修改或撤回；更改電話請重新列印。之後的版本會改成可隨時修改、撤回的短網址。</div></div>`;
  drawQR($('qrc'),q,Math.max(3,Math.floor(300/(n+8))));
  const upd=async()=>{ const nc=pp(p); $('pm').querySelectorAll('[data-fk]').forEach(i=>nc.fields[i.dataset.fk]=i.checked); nc.phone=$('ppPhone').value.trim(); nc.ownerName=$('ppOwner').value.trim(); nc.msg=$('ppMsg').value.trim();
    const r=await save('pets',{...p,passport:nc}); renderPublic(r); };
  $('pm').querySelectorAll('[data-fk]').forEach(i=>i.onchange=upd); ['ppPhone','ppOwner','ppMsg'].forEach(id=>$(id).onchange=upd);
  $('dlTag').onclick=async()=>Share.download(await blobOf(tagCanvas(p)),`護照吊牌-${p.name}.png`);
  $('shTag').onclick=async()=>{ const r=await Share.image(await blobOf(tagCanvas(p)),`tag-${p.id.slice(0,8)}.png`,`${p.name} 的寵物護照吊牌`); if(r==='unsupported') Share.download(await blobOf(tagCanvas(p)),`護照吊牌-${p.name}.png`); };
  $('poster').onclick=()=>posterSheet(p);
}
/* lost-pet poster (reused from pet-friendly-app, minor feature) */
function posterSheet(p){ const c=pp(p); const L=p.lostDraft||{};
  openSheet(`<div class="shead"><h2>🆘 協尋海報</h2><button class="x" data-close>✕</button></div>
  <form id="lf"><div class="f"><label>外觀特徵</label><textarea name="features" rows="2" maxlength="120">${esc(L.features!=null?L.features:[p.breed,p.notes].filter(Boolean).join('，'))}</textarea></div>
  <div class="f"><label>最後出現地點 *</label><input name="place" maxlength="60" value="${esc(L.place)}"></div>
  <div class="f"><label>最後出現時間 *</label><input name="time" type="datetime-local" value="${esc(L.time)}"></div>
  <div class="f"><label>聯絡電話 *</label><input name="phone" type="tel" maxlength="20" value="${esc(L.phone||c.phone)}"></div></form>
  <canvas id="poster" width="1080" height="1440" style="width:100%;border-radius:12px;background:#fff"></canvas>
  <div class="row"><button class="btn" id="pdl">⬇️ 下載</button><button class="btn green" id="psh">📤 分享</button></div>
  <div class="info" style="margin-top:10px">💡 也請通報附近動物醫院、里長、動物保護單位，並到社群協尋社團張貼。共享的協尋看板需要後端，會在之後版本提供。</div>`, box=>{
    const f=box.querySelector('#lf'), cv=box.querySelector('#poster');
    const draw=async()=>{ const d=Object.fromEntries(new FormData(f)); p.lostDraft=d; const x=cv.getContext('2d'), W=1080, H=1440;
      x.fillStyle='#fffaf5'; x.fillRect(0,0,W,H); x.fillStyle='#e5484d'; x.fillRect(0,0,W,210); x.fillStyle='#fff'; x.textAlign='center'; x.font=`900 112px ${FONT}`; x.fillText('協 尋 毛 孩',W/2,140); x.font=`500 34px ${FONT}`; x.fillText('LOST PET・請幫忙留意',W/2,190);
      const ph=560, py=250, px=(W-ph)/2; const u=p.photoFileId&&S.urls[p.photoFileId];
      if(u){ const img=await new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=u;}); if(img){ const s=Math.max(ph/img.width,ph/img.height); x.save(); x.beginPath(); x.rect(px,py,ph,ph); x.clip(); x.drawImage(img,px+(ph-img.width*s)/2,py+(ph-img.height*s)/2,img.width*s,img.height*s); x.restore(); } }
      else { x.fillStyle='#e6f4f1'; x.fillRect(px,py,ph,ph); x.font=`260px ${FONT}`; x.fillText(sp(p).i,W/2,py+ph/2+90); }
      x.fillStyle='#3a2a24'; x.font=`900 92px ${FONT}`; x.fillText(p.name,W/2,py+ph+105); x.font=`500 38px ${FONT}`; x.fillStyle='#7a5a4c'; x.fillText([sp(p).n,p.breed,PC.age(p.birthday)].filter(Boolean).join('・'),W/2,py+ph+165);
      x.textAlign='left'; let y=py+ph+240; const t=d.time?new Date(d.time):null;
      [['特徵',d.features],['地點',d.place||'（請填寫）'],['時間',t&&!isNaN(t)?`${t.getFullYear()}/${t.getMonth()+1}/${t.getDate()} ${PC.pad(t.getHours())}:${PC.pad(t.getMinutes())}`:'（請填寫）'],['晶片',p.chip]].forEach(([k,val])=>{ if(!val) return; x.fillStyle='#e5484d'; x.font=`700 38px ${FONT}`; x.fillText(k,90,y); x.fillStyle='#3a2a24'; x.font=`500 38px ${FONT}`; x.fillText(String(val).slice(0,22),240,y); y+=62; });
      x.fillStyle='#ffe3e3'; x.fillRect(60,H-200,W-120,150); x.fillStyle='#c92a2a'; x.textAlign='center'; x.font=`700 40px ${FONT}`; x.fillText('有消息請聯絡',W/2,H-140); x.font=`900 64px ${FONT}`; x.fillText(d.phone||'（請填寫電話）',W/2,H-72); };
    f.oninput=draw; draw();
    const ok=()=>{ const d=Object.fromEntries(new FormData(f)); if(!d.place||!d.time||!d.phone){ alert('請填寫地點、時間和電話'); return false; } save('pets',{...p,lostDraft:d}); return true; };
    box.querySelector('#pdl').onclick=async()=>{ if(ok()) Share.download(await blobOf(cv),`協尋-${p.name}.png`); };
    box.querySelector('#psh').onclick=async()=>{ if(!ok()) return; const d=p.lostDraft; const r=await Share.image(await blobOf(cv),`lost-${p.id.slice(0,8)}.png`,`【協尋】${p.name}，最後出現在 ${d.place}，請聯絡 ${d.phone}`); if(r==='unsupported') Share.download(await blobOf(cv),`協尋-${p.name}.png`); };
  }); }
PC.VIEWS.passport=render;
Object.assign(PC,{qrText,makeQR,tagCanvas,passportFields:FIELDS});
})();
