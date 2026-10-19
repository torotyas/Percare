/* Emergency page: quick links to find a 24h / exotic vet near the user (opens Google Maps search, which uses the
   phone's location), the owner's own vet contacts, and general red-flag guidance with sources. NOT a diagnosis. */
(function(){
const PC=window.PC, {S,$,esc,sp,hdr,DB,RED_FLAGS,FLAG_GROUP}=PC;
const maps=q=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);
const EXOTIC_Q={rabbit:'兔子 動物醫院',guinea:'天竺鼠 特殊寵物 動物醫院',hamster:'倉鼠 特殊寵物 動物醫院',bird:'鳥類 動物醫院',reptile:'爬蟲 動物醫院',fish:'水族 獸醫',other:'特殊寵物 動物醫院'};
function render(){
  const v=$('v-sos'), p=PC.pet(), st=S.settings, sid=p?p.species:null;
  const groups=['general',...(sid?FLAG_GROUP[sid]:['bird','small','reptile','fish'])];
  const tel=(n,l,cls)=>n?`<a class="big-btn ${cls}" href="tel:${esc(n.replace(/[^\d+]/g,''))}">📞 <span>${esc(l)}<small>${esc(n)}</small></span></a>`:'';
  v.innerHTML=hdr('🚑','緊急就醫','先打電話給醫院，告知正在前往')+`<div class="pad">
   <a class="big-btn red" href="${maps('24小時動物醫院')}" target="_blank" rel="noopener">🏥 <span>找附近 24 小時動物醫院<small>開啟 Google 地圖，依你目前位置搜尋</small></span></a>
   ${sid&&EXOTIC_Q[sid]?`<a class="big-btn orange" href="${maps(EXOTIC_Q[sid])}" target="_blank" rel="noopener">${sp(p).i} <span>找可看${esc(sp(p).n)}的醫院<small>特殊寵物請先打電話確認能否看診</small></span></a>`:''}
   ${tel(st.vetPhone,(st.vetName||'常去的動物醫院'),'teal')}${tel(st.erPhone,(st.erName||'急診醫院'),'teal')}
   <div class="card"><div class="sec-h"><h3>我的醫院電話</h3><button class="btn sm ghost" id="editVet">${st.vetPhone||st.erPhone?'編輯':'＋ 設定'}</button></div><div class="meta">先存好常去的醫院和最近的 24 小時急診電話，緊急時一鍵撥打。</div></div>
   ${p?`<button class="big-btn teal" id="showVet" style="cursor:pointer">🩺 <span>給獸醫看 ${esc(p.name)} 的摘要<small>過敏、用藥、近 3 個月紀錄</small></span></button>`:''}
   <div class="info">⚠️ 以下是一般性的緊急警訊整理，<b>不是診斷</b>，也不能取代獸醫判斷。只要擔心，就打電話給獸醫。</div>
   ${groups.map(g=>{ const G=RED_FLAGS[g]; return `<div class="card"><h3 style="font-size:15px">${esc(G.t)}</h3><ul class="flag">${G.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>${G.src.length?`<div class="srcs">來源：${G.src.map(([n,u])=>`<a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join('')}</div>`:''}</div>`; }).join('')}
   <div class="srcs" style="text-align:center">中文為本 app 整理翻譯，內容尚待獸醫顧問審閱。</div></div>`;
  $('editVet').onclick=()=>PC.openSheet(`<div class="shead"><h2>我的醫院電話</h2><button class="x" data-close>✕</button></div><form id="vf">
    <div class="f"><label>常去的動物醫院</label><input name="vetName" maxlength="30" value="${esc(st.vetName)}"></div><div class="f"><label>電話</label><input name="vetPhone" type="tel" maxlength="20" value="${esc(st.vetPhone)}"></div>
    <div class="f"><label>24 小時急診醫院</label><input name="erName" maxlength="30" value="${esc(st.erName)}"></div><div class="f"><label>電話</label><input name="erPhone" type="tel" maxlength="20" value="${esc(st.erPhone)}"></div>
    <button class="btn full">儲存</button></form>`, box=>{ box.querySelector('#vf').onsubmit=async e=>{ e.preventDefault(); S.settings={...S.settings,...Object.fromEntries(new FormData(e.target))}; await DB.setMeta('settings',S.settings); PC.closeSheet(); render(); }; });
  const sv=$('showVet'); if(sv) sv.onclick=()=>{ PC.passportMode='vet'; PC.go('passport'); };
}
PC.VIEWS.sos=render;
})();
