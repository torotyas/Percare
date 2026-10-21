<!-- © 2026 凱波工作室 Kaibo Studio -->
/* P2 quick check-ins by species + trend charts.
   No anomaly alerts or health judgments: charts show recorded values only. */
(function(){
const PC=window.PC, {S,$,esc,fmtD,fmtDT,sp,hdr,empty,openSheet,closeSheet,save,remove,petBar,bindPetBar,daysAgo}=PC;
let range=30;
const entries=petId=>S.checkins.filter(c=>c.petId===petId).sort((a,b)=>a.at.localeCompare(b.at));
const median=a=>{ const s=[...a].sort((x,y)=>x-y), n=s.length; return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):NaN; };
function chart(p,m){
  const from=daysAgo(range).toISOString();
  const pts=entries(p.id).filter(c=>c.at>=from&&c.metrics&&c.metrics[m.k]!=null&&c.metrics[m.k]!=='').map(c=>({t:new Date(c.at),v:+c.metrics[m.k]}));
  if(pts.length<2) return `<div class="meta">至少要 2 筆紀錄才會畫圖（目前 ${pts.length} 筆）</div>`;
  const W=340,H=130,L=34,R=18,T=10,B=22;
  const t0=+daysAgo(range), t1=Date.now();
  let lo,hi; if(m.t==='ord'){ lo=Math.min(...m.opts.map(o=>o[0])); hi=Math.max(...m.opts.map(o=>o[0])); } else { lo=Math.min(...pts.map(x=>x.v)); hi=Math.max(...pts.map(x=>x.v)); const padv=Math.max((hi-lo)*0.15,m.err||0.5); lo-=padv; hi+=padv; }
  const X=t=>L+(t-t0)/(t1-t0)*(W-L-R), Y=v=>T+(hi-v)/(hi-lo||1)*(H-T-B);
  const path=pts.map((x,i)=>(i?'L':'M')+X(+x.t).toFixed(1)+' '+Y(x.v).toFixed(1)).join(' ');
  const ticks=m.t==='ord'?m.opts.map(o=>[o[0],o[1]]):[lo+(hi-lo)*0.15,(lo+hi)/2,hi-(hi-lo)*0.15].map(v=>[v,(Math.round(v*10)/10)+'']);
  const xt=[range,Math.round(range/2),0].map(d=>{ const dt=daysAgo(d); return [X(+dt),`${dt.getMonth()+1}/${dt.getDate()}`]; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(m.n)}趨勢圖">
   ${ticks.map(([v,l])=>`<line x1="${L}" x2="${W-R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#e3ecea"/><text x="${L-4}" y="${Y(v)+3}" text-anchor="end">${esc(l.length>4?l.slice(0,4):l)}</text>`).join('')}
   ${xt.map(([x,l],i)=>`<text x="${x}" y="${H-6}" text-anchor="${i===0?'start':i===2?'end':'middle'}">${l}</text>`).join('')}
   <path d="${path}" fill="none" stroke="#2f9e8f" stroke-width="2.2" stroke-linejoin="round"/>
   ${pts.map(x=>`<circle cx="${X(+x.t)}" cy="${Y(x.v)}" r="3" fill="#2f9e8f"/>`).join('')}</svg>`;
}
function wChange(p,m){ const from=daysAgo(range).toISOString(); const pts=entries(p.id).filter(c=>c.at>=from&&c.metrics&&c.metrics.weight!=null&&c.metrics.weight!=='').map(c=>+c.metrics.weight);
  if(pts.length<2) return ''; const a=pts[0], b=pts[pts.length-1], pc=a?((b-a)/a*100):0, r=v=>Math.round(v*100)/100;
  return `<div class="meta wchg">期間變化：${r(a)} → ${r(b)} ${esc(m.unit)}（${pc>=0?'+':''}${r(pc)}%）</div>`; }
function catSummary(p,m){
  const from=daysAgo(range).toISOString(); const list=entries(p.id).filter(c=>c.at>=from&&c.metrics&&c.metrics[m.k]!=null&&c.metrics[m.k]!=='');
  if(!list.length) return '<div class="meta">尚無紀錄</div>';
  const cnt={}; list.forEach(c=>{ const v=m.t==='bool'?(c.metrics[m.k]?'有':'沒有'):c.metrics[m.k]; cnt[v]=(cnt[v]||0)+1; });
  return `<div>${Object.entries(cnt).map(([k,n])=>`<span class="badge${(m.t==='bool'?k==='有':k!==m.opts[0])?' warn':''}">${esc(k)} ${n} 次</span>`).join('')}</div>`;
}
const showVal=(m,v)=>{ if(v==null||v==='') return null; if(m.t==='bool') return v?m.n:null; if(m.t==='ord'){ const o=m.opts.find(o=>o[0]===+v); return m.n+'：'+(o?o[1]:v); } if(m.t==='num') return m.n+' '+v+(m.unit?' '+m.unit:''); return m.n+'：'+v; };
function render(){
  const v=$('v-track'), p=PC.pet();
  v.innerHTML=hdr('📈','每日紀錄','體重、食慾、排便…依物種不同',p?'<button class="btn sm" id="addCk">＋ 打卡</button>':'')+petBar()+'<div class="pad" id="tk"></div>';
  bindPetBar(v,render);
  if(!p){ $('tk').innerHTML=empty('📈','先建立毛孩檔案，才能開始記錄。','<br><button class="btn" id="toP">前往建立</button>'); $('toP').onclick=()=>{PC.go('pets');PC.petForm();}; return; }
  $('addCk').onclick=()=>ckForm(p);
  const M=sp(p).checkin, list=entries(p.id);
  const todayDone=list.some(c=>c.at.slice(0,10)===PC.today());
  let h=`<div class="card"><div class="sec-h"><h3>${sp(p).i} ${esc(p.name)}</h3><div class="seg">${[[30,'1M'],[90,'3M'],[180,'6M'],[365,'1Y']].map(([d,l])=>`<button data-r="${d}" class="${range===d?'on':''}">${l}</button>`).join('')}</div></div>
    <div class="meta">${todayDone?'✅ 今天已打卡':'今天還沒打卡'}・共 ${list.length} 筆紀錄</div>${todayDone?'':'<button class="btn full" id="ck2" style="margin-top:10px">＋ 今日快速打卡</button>'}</div>`;
  M.forEach(m=>{ h+=`<div class="card"><div class="sec-h"><h3>${esc(m.n)}${m.unit?`（${esc(m.unit)}）`:''}</h3></div>${m.t==='num'||m.t==='ord'?chart(p,m):catSummary(p,m)}${m.k==='weight'?wChange(p,m):''}</div>`; });
  const recent=[...list].reverse().slice(0,10);
  h+=`<div class="card"><h3 style="font-size:15px;margin-bottom:4px">最近紀錄</h3>${recent.length?recent.map(c=>`<div class="list-item"><div class="grow"><b>${fmtDT(c.at)}</b><div class="meta">${M.map(m=>showVal(m,c.metrics[m.k])).filter(Boolean).map(esc).join('・')||'—'}</div>${c.note?`<div class="note">${esc(c.note)}</div>`:''}</div><button class="btn sm ghost" data-ck="${c.id}">✏️</button></div>`).join(''):'<div class="meta">尚無紀錄</div>'}</div>
  <div class="srcs" style="text-align:center">圖表只呈現你記錄的數值。本 app 不提供醫療建議，有疑慮請聯絡獸醫。</div>`;
  $('tk').innerHTML=h;
  v.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{ range=+b.dataset.r; render(); });
  const c2=$('ck2'); if(c2) c2.onclick=()=>ckForm(p);
  v.querySelectorAll('[data-ck]').forEach(b=>b.onclick=()=>ckForm(p,S.checkins.find(c=>c.id===b.dataset.ck)));
}
function ckForm(p,c){
  c=c||{petId:p.id,metrics:{}}; const M=sp(p).checkin; const now=new Date(); const local=c.at?new Date(c.at):now;
  const lv=new Date(local.getTime()-local.getTimezoneOffset()*6e4).toISOString().slice(0,16);
  const inp=m=>{ const v=c.metrics[m.k];
    if(m.t==='num') return `<div class="f"><label>${esc(m.n)}${m.unit?`（${esc(m.unit)}）`:''}</label><input name="${m.k}" type="number" inputmode="decimal" step="${m.step}" value="${v==null?'':v}"></div>`;
    if(m.t==='bool') return `<label class="check"><input type="checkbox" name="${m.k}"${v?' checked':''}><span>${esc(m.n)}</span></label>`;
    const opts=m.t==='ord'?m.opts:m.opts.map(o=>[o,o]);
    return `<div class="f"><label>${esc(m.n)}</label><div class="opt">${opts.map(([val,l])=>`<label><input type="radio" name="${m.k}" value="${val}"${String(v)===String(val)?' checked':''}><span>${esc(l)}</span></label>`).join('')}</div></div>`; };
  openSheet(`<div class="shead"><h2>${sp(p).i} ${esc(p.name)} 打卡</h2><button class="x" data-close>✕</button></div>
  <form id="cf"><div class="f"><label>時間</label><input type="datetime-local" name="at" value="${lv}"></div>
  ${M.filter(m=>m.t!=='bool').map(inp).join('')}<div class="card" style="padding:4px 12px">${M.filter(m=>m.t==='bool').map(inp).join('')}</div>
  <div class="f"><label>其他觀察／症狀（選填）</label><textarea name="note" rows="2" maxlength="300" placeholder="例如：早上吐了一次黃水"></textarea></div>
  <div class="srcs" style="margin:-4px 0 10px">只填有觀察到的項目即可。出現緊急狀況請直接到「緊急」頁。</div>
  <button class="btn full" type="submit">儲存</button>${c.id?'<div class="row"><button type="button" class="btn ghost full" id="cdel" style="color:#e5484d">刪除</button></div>':''}</form>`, box=>{
    const f=box.querySelector('#cf'); if(c.note) f.note.value=c.note;
    f.onsubmit=async e=>{ e.preventDefault(); const fd=new FormData(f); const metrics={};
      M.forEach(m=>{ if(m.t==='bool'){ if(fd.get(m.k)) metrics[m.k]=true; else if(c.metrics[m.k]!=null) metrics[m.k]=false; return; } const v=fd.get(m.k); if(v==null||v==='') return; metrics[m.k]=(m.t==='num'||m.t==='ord')?+v:v; });
      await save('checkins',{...c,petId:p.id,at:new Date(fd.get('at')).toISOString(),metrics,note:(fd.get('note')||'').trim()}); closeSheet(); render(); };
    const d=box.querySelector('#cdel'); if(d) d.onclick=async()=>{ await remove('checkins',c.id); closeSheet(); render(); };
  });
}
PC.VIEWS.track=render;
Object.assign(PC,{checkinsOf:entries,showVal,median});
})();
