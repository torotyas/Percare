<!-- © 2026 凱波工作室 Kaibo Studio -->
/* Local-first data layer on IndexedDB.
   Every record carries sync-ready fields: id (uuid), createdAt, updatedAt, createdBy, deletedAt (soft delete), so a
   later Supabase sync can upsert by id and resolve conflicts with updatedAt. Files (photos/documents) are Blobs in the
   `files` store (no base64 in localStorage). `actions` is append-only (who did what, e.g. med_given). */
(function(){
const NAME='petcare', VER=2, STORES=['meta','pets','records','checkins','reminders','actions','files','carelogs'];
let db;
const uuid=()=> (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16);}));
const req=r=>new Promise((res,rej)=>{ r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); });
const tx=(store,mode='readonly')=>db.transaction(store,mode).objectStore(store);
const DB={
  uuid,
  async open(){
    if(db) return db;
    db=await new Promise((res,rej)=>{ const o=indexedDB.open(NAME,VER);
      o.onupgradeneeded=()=>{ /* v1→v2: adds `carelogs` (quick care check-ins); existing stores untouched */ const d=o.result; STORES.forEach(s=>{ if(!d.objectStoreNames.contains(s)) d.createObjectStore(s,{keyPath:s==='meta'?'k':'id'}); }); };
      o.onsuccess=()=>res(o.result); o.onerror=()=>rej(o.error); });
    if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(()=>{});
    let me=await this.meta('deviceUser'); if(!me){ me='local:'+uuid(); await this.setMeta('deviceUser',me); }
    this.me=me; return db;
  },
  async meta(k){ const r=await req(tx('meta').get(k)); return r?r.v:undefined; },
  async setMeta(k,v){ await req(tx('meta','readwrite').put({k,v})); },
  async all(store){ const rows=await req(tx(store).getAll()); return rows.filter(r=>!r.deletedAt); },
  async get(store,id){ return req(tx(store).get(id)); },
  async put(store,obj){
    const now=new Date().toISOString();
    const rec={...obj, id:obj.id||uuid(), createdAt:obj.createdAt||now, createdBy:obj.createdBy||this.me, updatedAt:now, updatedBy:this.me, deletedAt:obj.deletedAt||null};
    await req(tx(store,'readwrite').put(rec)); return rec;
  },
  async softDelete(store,id){ const r=await this.get(store,id); if(r) await this.put(store,{...r,deletedAt:new Date().toISOString()}); },
  // append-only action log (e.g. med_given, reminder_done). Never edited, only voided by a later action if needed.
  async logAction(a){ return this.put('actions',{...a, at:a.at||new Date().toISOString(), by:this.me}); },
  async putFile(blob,meta={}){ const id=uuid(); await req(tx('files','readwrite').put({id,blob,name:meta.name||'',type:blob.type,size:blob.size,petId:meta.petId||null,createdAt:new Date().toISOString(),createdBy:this.me})); return id; },
  async getFile(id){ return id?req(tx('files').get(id)):null; },
  async delFile(id){ await req(tx('files','readwrite').delete(id)); },
  async usage(){ if(navigator.storage&&navigator.storage.estimate){ const e=await navigator.storage.estimate(); return e; } return null; },
  /* restore a backup made by exportAll: upsert every row by id (newer updatedAt wins), never deletes local data */
  async importAll(data){ if(!data||data.app!=='petcare') throw new Error('不是寵物護照的備份檔'); let n=0;
    for(const s of STORES.filter(s=>s!=='files'&&Array.isArray(data[s]))) for(const row of data[s]){ const key=s==='meta'?row.k:row.id; if(key==null) continue;
      if(s!=='meta'){ const cur=await req(tx(s).get(key)); if(cur&&cur.updatedAt&&row.updatedAt&&cur.updatedAt>row.updatedAt) continue; }
      if(s==='meta'&&row.k==='deviceUser') continue; await req(tx(s,'readwrite').put(row)); n++; }
    return n; },
  async exportAll(){ const out={app:'petcare',version:2,exportedAt:new Date().toISOString()}; for(const s of STORES.filter(s=>s!=='files')) out[s]=await req(tx(s).getAll()); return out; }
};
window.PC=window.PC||{}; window.PC.DB=DB;
})();
