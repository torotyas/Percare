<!-- © 2026 凱波工作室 Kaibo Studio -->
/* P3 vet-visit summary (last 3 months): shown on-screen in 就醫模式 and exportable as PDF.
   PDF pages are drawn on canvas (system CJK fonts, so no font embedding) and packed with jsPDF (bundled locally).
   Owner-recorded data only; no interpretation or diagnosis. */
(function(){
const PC=window.PC, {S,esc,fmtD,fmtDT,sp,age,daysAgo}=PC;
const {Share}=window.Platform;
function summaryData(p){
  const since=daysAgo(90), sinceS=PC.dstr(since), T=sp(p), recs=k=>PC.recs(p.id,k);
  const ck=PC.checkinsOf(p.id).filter(c=>c.at>=since.toISOString());
  const wM=T.checkin.find(m=>m.k==='weight');
  const weights=wM?PC.checkinsOf(p.id).filter(c=>c.metrics&&c.metrics.weight!=null).map(c=>({t:new Date(c.at),v:+c.metrics.weight})):[];
  const w90=weights.filter(x=>x.t>=since); const lastW=weights[weights.length-1];
  const sec=[];
  const basic=[['物種',[T.i+' '+T.n,p.breed].filter(Boolean).join('・')],['性別',p.sex&&p.sex!=='未知'?p.sex:''],['生日',p.birthday?fmtD(p.birthday)+'（'+age(p.birthday)+'）':''],['晶片',p.chip],
    ['最近體重',lastW?`${lastW.v} ${wM.unit}（${fmtD(PC.dstr(lastW.t))}）`:''],...T.profile.map(f=>[f.n,p.attributes&&p.attributes[f.k]?(f.t==='date'?fmtD(p.attributes[f.k]):p.attributes[f.k]):''])].filter(x=>x[1]);
  sec.push({t:'基本資料',kv:basic});
  const al=recs('allergy'); sec.push({t:'⚠️ 過敏',lines:al.length?al.map(r=>[r.title,r.reaction,r.severity].filter(Boolean).join('・')):['無紀錄（不代表沒有過敏）']});
  const meds=recs('medication'), act=meds.filter(PC.medActive);
  const medLines=act.map(r=>{ const log=PC.medLog(r.id).filter(a=>a.at>=since.toISOString()); return `${r.title}${r.dose?' '+r.dose:''}${r.freq?'・'+r.freq:''}${r.date?'・'+fmtD(r.date)+' 起':''}${log.length?`・近 3 個月記錄給藥 ${log.length} 次，最後 ${fmtDT(log[0].at)}`:''}`; });
  const stopped=meds.filter(r=>!PC.medActive(r)&&(r.endDate||'')>=sinceS).map(r=>`（已停）${r.title}・${fmtD(r.date)}–${fmtD(r.endDate)}`);
  sec.push({t:'💊 用藥',lines:[...medLines,...stopped].length?[...medLines,...stopped]:['無紀錄']});
  const cond=recs('condition'); sec.push({t:'📋 病史／長期狀況',lines:cond.length?cond.map(r=>[r.title,r.status,r.date&&'診斷 '+fmtD(r.date)].filter(Boolean).join('・')):['無紀錄']});
  const vacc={}; recs('vaccine').forEach(r=>{ if(!vacc[r.title]||vacc[r.title].date<r.date) vacc[r.title]=r; });
  sec.push({t:'💉 疫苗（各項最近一次）',lines:Object.values(vacc).length?Object.values(vacc).map(r=>`${r.title}・${fmtD(r.date)}${r.clinic?'・'+r.clinic:''}`):['無紀錄']});
  const vis=recs('visit').filter(r=>(r.date||'')>=sinceS); sec.push({t:'🏥 近 3 個月就醫',lines:vis.length?vis.map(r=>`${fmtD(r.date)}・${r.clinic||''}・${r.title}${r.vetSays?'｜獸醫說明：'+r.vetSays:''}`):['無紀錄']});
  const tests=recs('test').filter(r=>(r.date||'')>=sinceS); sec.push({t:'🧪 近 3 個月檢驗',lines:tests.length?tests.map(r=>`${fmtD(r.date)}・${r.title}${r.result?'：'+r.result:''}`):['無紀錄']});
  if(wM){ const vs=w90.map(x=>Math.round(x.v*100)/100); sec.push({t:`📈 近 3 個月體重（${wM.unit}）`,lines:vs.length?[`${vs.length} 筆紀錄；第一筆 ${vs[0]}、最近一筆 ${vs[vs.length-1]}；範圍 ${Math.min(...vs)}–${Math.max(...vs)}`]:['無紀錄'],chart:w90.length>=2?{pts:w90,unit:wM.unit}:null}); }
  const obs=[]; T.checkin.filter(m=>m.t!=='num').forEach(m=>{ const cnt={}; ck.forEach(c=>{ const v=c.metrics&&c.metrics[m.k]; if(v==null||v==='') return; const l=m.t==='bool'?(v?'有':'沒有'):m.t==='ord'?((m.opts.find(o=>o[0]===+v)||[])[1]||v):v; cnt[l]=(cnt[l]||0)+1; }); if(Object.keys(cnt).length) obs.push(`${m.n}：${Object.entries(cnt).map(([k,n])=>`${k} ${n}`).join('、')}`); });
  T.checkin.filter(m=>m.t==='num'&&m.k!=='weight').forEach(m=>{ const vs=ck.map(c=>c.metrics&&c.metrics[m.k]).filter(v=>v!=null&&v!=='').map(Number); if(vs.length) obs.push(`${m.n}：${vs.length} 筆，範圍 ${Math.min(...vs)}–${Math.max(...vs)}${m.unit?' '+m.unit:''}`); });
  sec.push({t:`📝 近 3 個月每日紀錄（共 ${ck.length} 筆）`,lines:obs.length?obs:['無紀錄']});
  if(PC.careLogs){ const cl=PC.careLogs(p.id).filter(l=>l.at>=since.toISOString()); const g={}; cl.forEach(l=>{ (g[l.name]=g[l.name]||[]).push(l); });
    sec.push({t:`✅ 近 3 個月照護打卡（共 ${cl.length} 次）`,lines:cl.length?Object.entries(g).map(([n,L])=>`${n.replace(/^[^\p{L}\p{N}]+/u,'')}：${L.length} 次，最近 ${fmtDT(L[0].at)}${L.filter(x=>x.note).length?'（備註：'+L.filter(x=>x.note).slice(0,3).map(x=>x.note).join('；')+'）':''}`):['無紀錄']}); }
  const notes=ck.filter(c=>c.note).reverse().slice(0,15).map(c=>`${fmtDT(c.at)}　${c.note}`);
  sec.push({t:'🗒️ 飼主觀察到的症狀／備註',lines:notes.length?notes:['無']});
  return {p,sec,generated:new Date(),since};
}
function svgChart(ch){ const W=320,H=110,L=30,R=6,T=8,B=18; const ts=ch.pts.map(x=>+x.t), vs=ch.pts.map(x=>x.v); const t0=Math.min(...ts),t1=Math.max(...ts); let lo=Math.min(...vs),hi=Math.max(...vs); const pd=(hi-lo)*0.2||0.5; lo-=pd; hi+=pd;
  const X=t=>L+(t-t0)/((t1-t0)||1)*(W-L-R), Y=v=>T+(hi-v)/(hi-lo)*(H-T-B);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><path d="${ch.pts.map((x,i)=>(i?'L':'M')+X(+x.t)+' '+Y(x.v)).join(' ')}" fill="none" stroke="#2f9e8f" stroke-width="2"/>${ch.pts.map(x=>`<circle cx="${X(+x.t)}" cy="${Y(x.v)}" r="2.5" fill="#2f9e8f"/>`).join('')}<text x="${L-3}" y="${Y(hi-pd)+3}" text-anchor="end">${Math.round((hi-pd)*100)/100}</text><text x="${L-3}" y="${Y(lo+pd)+3}" text-anchor="end">${Math.round((lo+pd)*100)/100}</text><text x="${L}" y="${H-4}">${fmtD(PC.dstr(new Date(t0)))}</text><text x="${W-R}" y="${H-4}" text-anchor="end">${fmtD(PC.dstr(new Date(t1)))}</text></svg>`; }
function renderVetMode(p,el){ const d=summaryData(p);
  el.innerHTML=`<div class="info">🩺 給獸醫看的完整摘要（近 3 個月）。只在你的手機上顯示或匯出 PDF，不會放進項圈 QR。</div>
   ${d.sec.map(s=>`<div class="card"><h3 style="font-size:15px;margin-bottom:6px">${esc(s.t)}</h3>${s.kv?`<dl class="kv" style="margin:0">${s.kv.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`:''}${(s.lines||[]).map(l=>`<div class="note" style="margin:3px 0">${esc(l)}</div>`).join('')}${s.chart?svgChart(s.chart):''}</div>`).join('')}
   <div class="row"><button class="btn full" id="pdfBtn">📄 匯出 PDF</button></div>
   <div class="srcs" style="text-align:center">以上為飼主自行記錄的資料，僅供獸醫參考，不是診斷。產生時間：${fmtDT(d.generated.toISOString())}</div>`;
  el.querySelector('#pdfBtn').onclick=async e=>{ e.target.disabled=true; e.target.textContent='產生中…'; try{ const b=await pdfBlob(p); await Share.download(b,`就醫摘要-${p.name}-${PC.today()}.pdf`); }catch(err){ alert('PDF 產生失敗：'+err.message); } e.target.disabled=false; e.target.textContent='📄 匯出 PDF'; };
}
const FONT='"PingFang TC","Noto Sans CJK TC","Noto Sans TC","Microsoft JhengHei",sans-serif';
async function pages(p){ const d=summaryData(p), W=1240, H=1754, M=90, out=[]; let c,x,y;
  const photo=p.photoFileId&&S.urls[p.photoFileId]?await new Promise(r=>{const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=S.urls[p.photoFileId];}):null;
  const newPage=()=>{ c=document.createElement('canvas'); c.width=W; c.height=H; x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,W,H); out.push(c); y=M;
    x.fillStyle='#8c9a97'; x.font=`400 20px ${FONT}`; x.textAlign='left'; x.fillText(`${p.name}・就醫摘要（近 3 個月）`,M,H-50); x.textAlign='right'; x.fillText(`第 ${out.length} 頁・飼主自行記錄，僅供參考，不是診斷`,W-M,H-50); x.textAlign='left'; };
  const need=h=>{ if(y+h>H-110) newPage(); };
  const wrap=(t,font,maxW)=>{ x.font=font; const L=[]; let line=''; for(const ch of [...t]){ if(x.measureText(line+ch).width>maxW){ L.push(line); line=ch; } else line+=ch; } if(line) L.push(line); return L; };
  newPage();
  x.fillStyle='#2f9e8f'; x.fillRect(0,0,W,150); x.fillStyle='#fff'; x.font=`900 54px ${FONT}`; x.fillText(`${p.name} 就醫摘要`,M,92); x.font=`400 24px ${FONT}`; x.fillText(`期間：${fmtD(PC.dstr(d.since))} – ${fmtD(PC.today())}　產生：${fmtDT(d.generated.toISOString())}`,M,132);
  if(photo){ const s=120, k=Math.max(s/photo.width,s/photo.height); x.save(); x.beginPath(); x.arc(W-M-60,75,60,0,7); x.clip(); x.drawImage(photo,W-M-120+(s-photo.width*k)/2,15+(s-photo.height*k)/2,photo.width*k,photo.height*k); x.restore(); }
  y=200;
  for(const s of d.sec){ need(90); x.fillStyle='#174a43'; x.font=`700 32px ${FONT}`; x.fillText(s.t,M,y); y+=14; x.fillStyle='#dcebe7'; x.fillRect(M,y,W-2*M,3); y+=40;
    x.fillStyle='#2d3b38';
    if(s.kv) for(const [k,v] of s.kv){ const L=wrap(String(v),`400 26px ${FONT}`,W-2*M-200); need(L.length*38); x.font=`700 26px ${FONT}`; x.fillStyle='#6f817d'; x.fillText(k,M,y); x.fillStyle='#2d3b38'; x.font=`400 26px ${FONT}`; L.forEach(l=>{ x.fillText(l,M+200,y); y+=38; }); }
    for(const t of (s.lines||[])){ const L=wrap('• '+t,`400 26px ${FONT}`,W-2*M-20); need(L.length*38); x.font=`400 26px ${FONT}`; L.forEach((l,i)=>{ x.fillText(i?'  '+l:l,M+10,y); y+=38; }); }
    if(s.chart){ const ch=s.chart, h=260; need(h+20); const L=M+70, R=W-M, T=y, B=y+h-40; const ts=ch.pts.map(q=>+q.t), vs=ch.pts.map(q=>q.v); const t0=Math.min(...ts), t1=Math.max(...ts); let lo=Math.min(...vs), hi=Math.max(...vs); const pd=(hi-lo)*0.2||0.5; lo-=pd; hi+=pd;
      const X=t=>L+(t-t0)/((t1-t0)||1)*(R-L), Y=v=>T+(hi-v)/(hi-lo)*(B-T);
      x.strokeStyle='#e3ecea'; x.lineWidth=2; [lo+pd,(lo+hi)/2,hi-pd].forEach(v=>{ x.beginPath(); x.moveTo(L,Y(v)); x.lineTo(R,Y(v)); x.stroke(); x.fillStyle='#6f817d'; x.font=`400 20px ${FONT}`; x.textAlign='right'; x.fillText(String(Math.round(v*100)/100),L-10,Y(v)+7); x.textAlign='left'; });
      x.strokeStyle='#2f9e8f'; x.lineWidth=4; x.beginPath(); ch.pts.forEach((q,i)=>{ i?x.lineTo(X(+q.t),Y(q.v)):x.moveTo(X(+q.t),Y(q.v)); }); x.stroke(); x.fillStyle='#2f9e8f'; ch.pts.forEach(q=>{ x.beginPath(); x.arc(X(+q.t),Y(q.v),6,0,7); x.fill(); });
      x.fillStyle='#6f817d'; x.font=`400 20px ${FONT}`; x.fillText(fmtD(PC.dstr(new Date(t0))),L,B+32); x.textAlign='right'; x.fillText(fmtD(PC.dstr(new Date(t1))),R,B+32); x.textAlign='left'; y+=h; }
    y+=24; }
  need(120); x.fillStyle='#f4f7f6'; x.fillRect(M,y,W-2*M,96); x.fillStyle='#6f817d'; x.font=`400 22px ${FONT}`; x.fillText('本摘要由飼主於 App 中自行記錄後產生，未經獸醫審核；內容僅供獸醫參考，不構成診斷或治療建議。',M+20,y+40); x.fillText('「無紀錄」代表飼主沒有在 App 中記錄，不代表沒有發生。',M+20,y+76);
  return out; }
async function pdfBlob(p){ const cs=await pages(p); const {jsPDF}=window.jspdf; const doc=new jsPDF({unit:'mm',format:'a4',compress:true});
  cs.forEach((c,i)=>{ if(i) doc.addPage(); doc.addImage(c.toDataURL('image/jpeg',0.9),'JPEG',0,0,210,297); }); return doc.output('blob'); }
Object.assign(PC,{summaryData,renderVetMode,summaryPages:pages,pdfBlob});
})();
