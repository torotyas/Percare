<!-- © 2026 凱波工作室 Kaibo Studio -->
/* Emergency page: quick links to find a 24h / exotic vet near the user (opens Google Maps search, which uses the
   phone's location), the owner's own vet contacts, No medical advice. */
(function(){
const PC=window.PC, {S,$,esc,sp,hdr,DB}=PC;
const maps=q=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
const EXOTIC_Q={rabbit:'兔子 動物醫院',guinea:'天竺鼠 特殊寵物 動物醫院',hamster:'倉鼠 特殊寵物 動物醫院',bird:'鳥類 動物醫院',reptile:'爬蟲 動物醫院',fish:'水族 獸醫',other:'特殊寵物 動物醫院'};
function render(){
  const v=$('v-sos'), p=PC.pet(), st=S.settings, sid=p?p.species:null;
  const tel=(n,l,cls)=>n?`<a class="big-btn ${cls}" href="tel:${esc(n.replace(/[^\d+]/g,''))}">📞 <span>${esc(l)}<small>${esc(n)}</small></span></a>`:'';
  v.innerHTML=hdr('🚑','緊急就醫','先打電話給醫院，告知正在前往')+`<div class="pad">
   <a class="big-btn red" href="${maps('24小時動物醫院')}" target="_blank" rel="noopener">🏥 <span>找附近 24 小時動物醫院<small>開啟 Google 地圖，依你目前位置搜尋</small></span></a>
   ${sid&&EXOTIC_Q[sid]?`<a class="big-btn orange" href="${maps(EXOTIC_Q[sid])}" target="_blank" rel="noopener">${sp(p).i} <span>找可看${esc(sp(p).n)}的醫院<small>特殊寵物請先打電話確認能否看診</small></span></a>`:''}
   ${tel(st.vetPhone,(st.vetName||'常去的動物醫院'),'teal')}${tel(st.erPhone,(st.erName||'急診醫院'),'teal')}
   <div class="card"><div class="sec-h"><h3>我的醫院電話</h3><button class="btn sm ghost" id="editVet">${st.vetPhone||st.erPhone?'編輯':'＋ 設定'}</button></div><div class="meta">先存好常去的醫院和最近的 24 小時急診電話，緊急時一鍵撥打。</div></div>
   ${p?`<button class="big-btn orange" id="ecBtn">🪪 <span>${esc(p.name)} 的緊急資料卡<small>照片、晶片、主人與醫院電話，可列印或分享</small></span></button>`:''}
   ${p?`<button class="big-btn teal" id="showVet" style="cursor:pointer">🩺 <span>給獸醫看 ${esc(p.name)} 的摘要<small>過敏、用藥、近 3 個月紀錄</small></span></button>`:''}
   <div class="srcs" style="text-align:center">本 app 不提供醫療建議，有疑慮請聯絡獸醫。</div></div>`;
  $('editVet').onclick=()=>PC.openSheet(`<div class="shead"><h2>我的醫院電話</h2><button class="x" data-close>✕</button></div><form id="vf">
    <div class="f"><label>常去的動物醫院</label><input name="vetName" maxlength="30" value="${esc(st.vetName)}"></div><div class="f"><label>電話</label><input name="vetPhone" type="tel" maxlength="20" value="${esc(st.vetPhone)}"></div>
    <div class="f"><label>24 小時急診醫院</label><input name="erName" maxlength="30" value="${esc(st.erName)}"></div><div class="f"><label>電話</label><input name="erPhone" type="tel" maxlength="20" value="${esc(st.erPhone)}"></div>
    <button class="btn full">儲存</button></form>`, box=>{ box.querySelector('#vf').onsubmit=async e=>{ e.preventDefault(); S.settings={...S.settings,...Object.fromEntries(new FormData(e.target))}; await DB.setMeta('settings',S.settings); PC.closeSheet(); render(); }; });
  const eb=$('ecBtn'); if(eb) eb.onclick=()=>showEcard(p);
  const sv=$('showVet'); if(sv) sv.onclick=()=>{ PC.passportMode='vet'; PC.go('passport'); };
}
async function ecard(p){ const st=S.settings, pass=p.passport||{}, W=1080, H=680, c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d');
  const F='"PingFang TC","Noto Sans CJK TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
  x.fillStyle='#fff'; x.fillRect(0,0,W,H); x.fillStyle='#e5484d'; x.fillRect(0,0,W,110); x.fillStyle='#fff'; x.font=`900 52px ${F}`; x.fillText('🚑 緊急資料卡',48,74);
  const u=p.photoFileId&&S.urls[p.photoFileId]; const img=u?await new Promise(r=>{ const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=u; }):null;
  const px=48, py=150, s=260; x.fillStyle='#e6f4f1'; x.fillRect(px,py,s,s);
  if(img){ const k=Math.max(s/img.width,s/img.height); x.save(); x.beginPath(); x.rect(px,py,s,s); x.clip(); x.drawImage(img,px+(s-img.width*k)/2,py+(s-img.height*k)/2,img.width*k,img.height*k); x.restore(); } else { x.font=`160px ${F}`; x.textAlign='center'; x.fillText(sp(p).i,px+s/2,py+195); x.textAlign='left'; }
  let y=200; const X=350; x.fillStyle='#2d3b38'; x.font=`900 64px ${F}`; x.fillText(p.name.slice(0,12),X,y); y+=60;
  x.font=`500 34px ${F}`; x.fillStyle='#6f817d'; x.fillText([sp(p).n,p.breed,p.sex&&p.sex!=='未知'?p.sex:''].filter(Boolean).join('・').slice(0,22),X,y); y+=70;
  const row=(k,v)=>{ if(!v) return; x.fillStyle='#e5484d'; x.font=`700 34px ${F}`; x.fillText(k,X,y); x.fillStyle='#2d3b38'; x.font=`600 36px ${F}`; x.fillText(String(v).slice(0,24),X+170,y); y+=62; };
  row('晶片',p.chip); row('主人',[pass.ownerName,pass.phone].filter(Boolean).join(' ')||'（請到護照頁填電話）'); row('醫院',[st.vetName,st.vetPhone].filter(Boolean).join(' ')); row('急診',[st.erName,st.erPhone].filter(Boolean).join(' '));
  const al=PC.recs(p.id,'allergy').map(r=>r.title); if(al.length){ y=Math.max(y,440); row('過敏',al.join('、')); }
  x.fillStyle='#8c9a97'; x.font=`400 24px ${F}`; x.fillText('寵物健康護照・飼主自行填寫',48,H-30);
  return c; }
async function showEcard(p){ const c=await ecard(p); const url=c.toDataURL('image/png');
  PC.openSheet(`<div class="shead"><h2>緊急資料卡</h2><button class="x" data-close>✕</button></div><img class="ecard" src="${url}" alt="緊急資料卡">
   <div class="row"><button class="btn full" id="ecShare">📤 分享／儲存</button><button class="btn ghost full" id="ecPrint">🖨️ 列印</button></div>`, box=>{
    const blob=()=>new Promise(r=>c.toBlob(r,'image/png'));
    box.querySelector('#ecShare').onclick=async()=>{ const b=await blob(), fn=`緊急資料卡-${p.name}.png`; const r=await window.Platform.Share.image(b,fn,p.name+' 緊急資料卡').catch(()=>'unsupported'); if(r!=='shared') window.Platform.Share.download(b,fn); };
    box.querySelector('#ecPrint').onclick=()=>{ const w=window.open(''); if(!w) return; w.document.write(`<img src="${url}" style="width:100%" onload="print()">`); w.document.close(); }; }); }
PC.VIEWS.sos=render;
})();
