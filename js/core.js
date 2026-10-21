<!-- © 2026 凱波工作室 Kaibo Studio -->
/* Shared helpers, in-memory state (loaded from IndexedDB at boot), tabs and bottom sheet. */
(function(){
const PC=window.PC, {DB,SPECIES}=PC;
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,'0');
const dstr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>dstr(new Date());
const daysTo=s=>Math.round((new Date(s+'T00:00:00')-new Date(today()+'T00:00:00'))/864e5);
const fmtD=s=>{ if(!s) return ''; const d=new Date(s.length<=10?s+'T00:00:00':s); return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`; };
const fmtDT=s=>{ const d=new Date(s); return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const daysAgo=n=>{ const d=new Date(); d.setDate(d.getDate()-n); return d; };
function age(b){ if(!b) return ''; const d=new Date(b), n=new Date(); let m=(n.getFullYear()-d.getFullYear())*12+n.getMonth()-d.getMonth(); if(n.getDate()<d.getDate()) m--; if(m<0) return ''; return m<12?`${m} 個月`:`${Math.floor(m/12)} 歲${m%12?` ${m%12} 個月`:''}`; }
const ageMonths=b=>{ if(!b) return null; const d=new Date(b), n=new Date(); return (n.getFullYear()-d.getFullYear())*12+n.getMonth()-d.getMonth(); };
const sp=p=>SPECIES[p&&p.species]||SPECIES.other;

const S={pets:[],records:[],checkins:[],reminders:[],actions:[],carelogs:[],cur:null,settings:{},urls:{}};
async function load(){ for(const k of ['pets','records','checkins','reminders','actions','carelogs']) S[k]=await DB.all(k); S.cur=await DB.meta('currentPet'); S.settings=(await DB.meta('settings'))||{};
  if(!S.pets.find(p=>p.id===S.cur)) S.cur=S.pets[0]?S.pets[0].id:null;
  for(const p of S.pets) await photoUrl(p.photoFileId); }
async function save(store,obj){ const r=await DB.put(store,obj); const arr=S[store]; const i=arr.findIndex(x=>x.id===r.id); i>=0?arr[i]=r:arr.push(r); return r; }
async function remove(store,id){ await DB.softDelete(store,id); S[store]=S[store].filter(x=>x.id!==id); }
async function photoUrl(fid){ if(!fid) return ''; if(S.urls[fid]) return S.urls[fid]; const f=await DB.getFile(fid); if(!f) return ''; return S.urls[fid]=URL.createObjectURL(f.blob); }
const pet=id=>S.pets.find(p=>p.id===(id||S.cur));
async function setCur(id){ S.cur=id; await DB.setMeta('currentPet',id); }
function ava(p,size){ const u=p&&p.photoFileId&&S.urls[p.photoFileId]; return `<div class="ava"${size?` style="width:${size}px;height:${size}px;flex-basis:${size}px"`:''}>${u?`<img src="${u}" alt="">`:sp(p).i}</div>`; }
function petBar(onPick){ if(S.pets.length<2) return ''; return `<div class="petbar">${S.pets.map(p=>`<button class="petchip${p.id===S.cur?' on':''}" data-pick="${p.id}">${ava(p)}${esc(p.name)}</button>`).join('')}</div>`; }
function bindPetBar(root,rerender){ root.querySelectorAll('[data-pick]').forEach(b=>b.onclick=async()=>{ await setCur(b.dataset.pick); rerender(); }); }
function hdr(icon,title,sub,right='',back=''){ return `<div class="hdr"><div class="top">${back?`<button class="back" data-back>‹</button>`:`<div class="logo">${icon}</div>`}<div style="min-width:0"><h1>${esc(title)}</h1>${sub?`<div class="hi">${esc(sub)}</div>`:''}</div>${right?`<div class="act">${right}</div>`:''}</div></div>`; }
function empty(big,text,btn){ return `<div class="empty"><div class="big">${big}</div>${text}${btn||''}</div>`; }

/* resize an image File to a JPEG Blob (reused from pet-friendly-app, now returns Blob for IndexedDB) */
function resizeImage(file,max=1024,q=0.85){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>{ const k=Math.min(1,max/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k); c.getContext('2d').drawImage(img,0,0,c.width,c.height); URL.revokeObjectURL(img.src); c.toBlob(b=>b?res(b):rej(new Error('encode')),'image/jpeg',q); }; img.onerror=rej; img.src=URL.createObjectURL(file); }); }
async function storeUpload(file,petId){ const blob=file.type.startsWith('image/')?await resizeImage(file,1600,0.85):file; if(blob.size>15*1024*1024) throw new Error('檔案超過 15 MB'); return DB.putFile(blob,{name:file.name,petId}); }

/* tabs */
const VIEWS={}; let current='pets';
function go(t){ current=t; document.querySelectorAll('.view').forEach(v=>v.classList.toggle('on',v.id==='v-'+t)); document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===t)); VIEWS[t]&&VIEWS[t](); window.scrollTo(0,0); if(location.hash!=='#'+t) history.replaceState(null,'','#'+t); }
const rerender=()=>VIEWS[current]&&VIEWS[current]();
/* sheet */
function openSheet(html,onMount){ $('sheetbox').innerHTML='<div class="grab"></div>'+html; $('sheet').classList.add('on'); document.body.style.overflow='hidden'; $('sheetbox').scrollTop=0; onMount&&onMount($('sheetbox')); }
function closeSheet(){ $('sheet').classList.remove('on'); document.body.style.overflow=''; }

/* generic form field renderer for templates */
function field(f,val,prefix='a_'){ const n=prefix+f.k, v=val==null?'':val;
  if(f.t==='select') return `<div class="f"><label>${esc(f.n)}</label><select name="${n}">${f.opts.map(o=>`<option${o===v?' selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
  if(f.t==='date') return `<div class="f"><label>${esc(f.n)}</label><input type="date" name="${n}" value="${esc(v)}"></div>`;
  if(f.t==='number') return `<div class="f"><label>${esc(f.n)}</label><input type="number" inputmode="decimal" step="any" name="${n}" value="${esc(v)}"></div>`;
  return `<div class="f"><label>${esc(f.n)}</label><input name="${n}" maxlength="60" value="${esc(v)}"></div>`; }

Object.assign(PC,{$,esc,pad,dstr,today,daysTo,fmtD,fmtDT,daysAgo,age,ageMonths,sp,S,load,save,remove,photoUrl,pet,setCur,ava,petBar,bindPetBar,hdr,empty,resizeImage,storeUpload,VIEWS,go,rerender,openSheet,closeSheet,field,get current(){return current;}});
})();
